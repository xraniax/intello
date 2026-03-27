import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import Material from '../models/material.model.js';
import Subject from '../models/subject.model.js';
import File from '../models/file.model.js';
import User from '../models/user.model.js';
import SubjectService from './subject.service.js';
import SettingsService from './settings.service.js';
import QuotaService from './quota.service.js';
import { query } from '../utils/config/db.js';

class MaterialService {
    /**
     * processDocument passes the entire upload payload (PDF + text) to the Python AI engine.
     * The Python engine handles ALL extraction, chunking, and AI processing, completely
     * removing the load from the Node.js backend.
     */
    static async processDocument(userId, file, title, content, type, subjectId = null) {
        // 1. Quota & Status Pre-check
        // Consolidated logic in QuotaService (Checks: suspension, global limits, user limits, remaining space)
        const incomingSizeBytes = file ? file.size : Buffer.byteLength(content || '', 'utf8');
        await QuotaService.checkUploadAllowance(userId, incomingSizeBytes);

        // Fallback for title: 1. Manual title, 2. Filename, 3. Default string
        const baseTitle = title || (file ? file.originalname : 'Untitled Material');
        const normalizedTitle = baseTitle.trim();
        const opContext = { userId, subjectId, title: normalizedTitle, operation: 'processDocument' };

        // 2. Resolve subject
        let finalSubjectId = subjectId;
        if (!finalSubjectId) {
            const importedSubject = await SubjectService.getOrCreateImportedSubject(userId);
            finalSubjectId = importedSubject.id;
            opContext.subjectId = finalSubjectId;
        }

        // 3. Strict Duplicate Check
        const existing = await Material.findByTitle(userId, finalSubjectId, normalizedTitle);
        if (existing) {
            const error = new Error('A document with this title already exists in this subject.');
            error.statusCode = 409;
            error.code = 'DUPLICATE_MATERIAL';
            throw error;
        }

        // 4. Save material record FIRST (status: PENDING_JOB)
        // We need the ID to link the file record
        const documentRecord = await Material.create(
            userId, 
            finalSubjectId, 
            normalizedTitle, 
            content || '', 
            type,
            'PENDING_JOB'
        );
        
        // 5. Track File Persistence and Link to Material
        let filePath = null;
        if (file) {
            await File.create(
                userId,
                finalSubjectId,
                documentRecord.id, // Linked material_id
                file.filename,
                file.originalname,
                file.mimetype,
                file.size,
                file.path
            );
            // Ensure absolute path for cross-container consistency
            filePath = file.path.startsWith('/') ? file.path : `/app/${file.path}`;
        }

        // 6. Update Subject activity
        await Subject.touch(finalSubjectId, userId);

        console.info(`[MaterialService] Starting async processing: ${JSON.stringify(opContext)}`);

        try {
            // 7. Construct payload for Python Engine
            const params = new URLSearchParams();
            params.append('document_id', documentRecord.id);
            params.append('subject_id', finalSubjectId);
            
            if (filePath) {
                params.append('file_path', filePath);
            } else {
                // For text/notes, we still want to trigger the chain
                // The engine expects either file or file_path.
                // If it's a note, we should probably handle it differently, 
                // but for now let's ensure the PDF path works.
                params.append('content', content || '');
            }

            // 8. Trigger Async Processing in Engine
            const aiResponse = await axios.post(`${process.env.ENGINE_URL}/process-document`, params.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 10000 
            });

            const { job_id } = aiResponse.data;

            // 9. Update record with real job_id and shift to PROCESSING
            await Material.updateStatus(documentRecord.id, userId, 'PROCESSING', job_id);

            console.info(`[MaterialService] Async job triggered: ${job_id} for material: ${documentRecord.id}`);

            return await Material.findById(documentRecord.id, userId);
        } catch (error) {
            console.error(`[MaterialService] Failed to trigger AI job: ${error.message}`, { ...opContext, materialId: documentRecord.id });
            await Material.updateStatus(documentRecord.id, userId, 'FAILED');
            return await Material.findById(documentRecord.id, userId);
        }
    }

    /**
     * Poll the AI engine for a job status and sync the materials table if done.
     * 
     * Celery status → materials.status mapping:
     *   PENDING  → PENDING    (queued, not yet picked up)
     *   STARTED  → PROCESSING (worker has begun)
     *   SUCCESS  → COMPLETED
     *   FAILURE  → FAILED
     */
    /**
     * Poll the AI engine for a job status and sync the materials table if done.
     * Implements a watchdog timeout (10 mins) for stuck jobs.
     */
    static async checkJobStatus(userId, materialId) {
        let material = await Material.findById(materialId, userId);
        if (!material) return null;

        // 1. If terminal state, return DB truth immediately
        const terminalStates = ['COMPLETED', 'FAILED'];
        if (terminalStates.includes(material.status?.toUpperCase())) {
            return material;
        }

        // 2. Watchdog: check if job is stuck in PROCESSING for too long (> 10 mins)
        if (material.status === 'PROCESSING' && material.started_at) {
            const startedAt = new Date(material.started_at);
            const now = new Date();
            const diffMinutes = (now - startedAt) / (1000 * 60);

            if (diffMinutes > 10) {
                console.warn(`[MaterialService] Job ${material.job_id} timed out after ${diffMinutes.toFixed(1)} mins.`);
                await Material.recordFailure(materialId, userId, 'Job timeout / worker failure');
                await this._garbageCollectFile(materialId);
                return await Material.findById(materialId, userId);
            }
        }

        // 3. Sync with Celery if job_id exists
        if (material.job_id) {
            try {
                const response = await axios.get(`${process.env.ENGINE_URL}/job/${material.job_id}`);
                const { status, result, error } = response.data;

                // SUCCESS: Sync results to DB
                if (status === 'SUCCESS' && result) {
                    const extractedText = result.extracted_text || material.content;
                    await Material.updateContent(materialId, userId, extractedText);
                    await Material.updateAIResult(materialId, userId, {
                        chunk_count: result.chunk_count,
                        provider: result.provider,
                        model: result.model,
                        processed_at: new Date().toISOString(),
                    });
                    return await Material.findById(materialId, userId);
                }

                // FAILURE: Record error in DB
                if (status === 'FAILURE') {
                    await Material.recordFailure(materialId, userId, error || 'Unknown engine error');
                    await this._garbageCollectFile(materialId);
                    return await Material.findById(materialId, userId);
                }

                // STARTED or RECEIVED: Keep as PROCESSING in DB
                if ((status === 'STARTED' || status === 'RECEIVED') && material.status !== 'PROCESSING') {
                    await Material.updateStatus(materialId, userId, 'PROCESSING');
                    return await Material.findById(materialId, userId);
                }
            } catch (err) {
                console.error(`[MaterialService] Status sync error for ${materialId}:`, err.message);
                // On error, fallback to DB state (resilient to engine downtime)
            }
        }

        return material;
    }


    static async getUserHistory(userId) {
        return await Material.findByUserId(userId);
    }

    /**
     * AI Chat grounded in specific document IDs
     */
    static async chatWithContext(userId, materialIds, question) {
        const sourceDocuments = await Material.findByIds(materialIds, userId);
        if (sourceDocuments.length === 0) return { result: "No source documents selected for context." };

        // Combine content from selected documents
        const context = sourceDocuments.map(m => `--- SOURCE: ${m.title} ---\n${m.content}`).join('\n\n');

        try {
            const endpoint = `${process.env.ENGINE_URL}/chat`;
            const payload = { context, question };
            const options = { timeout: 15000 };

            const aiResponse = process.env.NODE_ENV === 'test' && global.__mockAxiosPost
                ? await global.__mockAxiosPost(endpoint, payload, options)
                : await axios.post(endpoint, payload, options);

            // Update Subject activity for involved materials
            // Note: In this specific implementation, we assume materials belong to a subject grounded in context
            if (sourceDocuments.length > 0 && sourceDocuments[0].subject_id) {
                await Subject.touch(sourceDocuments[0].subject_id, userId);
            }

            return aiResponse.data;
        } catch (error) {
            console.error('[MaterialService] Engine Chat Error:', error.message);
            const isTimeout = error.code === 'ECONNABORTED';
            const enhancedError = new Error(isTimeout ? 'AI engine timed out. Try with fewer documents or shorter questions.' : 'AI engine is currently unavailable. Please try again later.');
            enhancedError.statusCode = 503;
            enhancedError.code = isTimeout ? 'ENGINE_TIMEOUT' : 'ENGINE_UNAVAILABLE';
            throw enhancedError;
        }
    }

    /**
     * Generate study tools grounded in specific document IDs
     */
    static async generateWithContext(userId, materialIds, taskType) {
        const sourceDocuments = await Material.findByIds(materialIds, userId);
        if (sourceDocuments.length === 0) return { result: "No source documents selected for context." };

        const context = sourceDocuments.map(m => `--- SOURCE: ${m.title} ---\n${m.content}`).join('\n\n');

        try {
            const endpoint = `${process.env.ENGINE_URL}/generate`;
            const payload = { content: context, task_type: taskType };
            const options = { timeout: 30000 };

            const aiResponse = process.env.NODE_ENV === 'test' && global.__mockAxiosPost
                ? await global.__mockAxiosPost(endpoint, payload, options)
                : await axios.post(endpoint, payload, options);

            // Update Subject activity for involved materials
            if (sourceDocuments.length > 0 && sourceDocuments[0].subject_id) {
                await Subject.touch(sourceDocuments[0].subject_id, userId);
            }

            return aiResponse.data;
        } catch (error) {
            console.error('[MaterialService] Engine Generate Error:', error.message);
            const isTimeout = error.code === 'ECONNABORTED';
            const enhancedError = new Error(isTimeout ? 'AI engine took too long to generate content.' : 'AI engine generation failed.');
            enhancedError.statusCode = 503;
            enhancedError.code = isTimeout ? 'ENGINE_TIMEOUT' : 'ENGINE_UNAVAILABLE';
            throw enhancedError;
        }
    }
    /**
     * Internal helper to physically delete associated files from disk and DB.
     * Prevents infinite disk growth for failed or deleted materials.
     */
    static async _garbageCollectFile(materialId) {
        try {
            const existingFile = await File.findByMaterialId(materialId);
            if (existingFile) {
                if (fs.existsSync(existingFile.path)) {
                    fs.unlinkSync(existingFile.path);
                }
                await File.delete(existingFile.id);
            }
        } catch (gcErr) {
            console.error(`[GC] Failed to clean up file for material ${materialId}:`, gcErr.message);
        }
    }

    /**
     * Delete a material by ID.
     * Enforces user_id for security.
     */
    static async deleteMaterial(materialId, userId) {
        // Run garbage collection BEFORE deleting the material row, 
        // to ensure the physical path lookup succeeds.
        await this._garbageCollectFile(materialId);
        return await Material.delete(materialId, userId);
    }
}

export default MaterialService;
