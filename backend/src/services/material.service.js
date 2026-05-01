import fs from 'fs';
import FormData from 'form-data';
import engineClient from './engine.client.js';
import Material from '../models/material.model.js';
import Subject from '../models/subject.model.js';
import File from '../models/file.model.js';
import User from '../models/user.model.js';
import SubjectService from './subject.service.js';
import SettingsService from './settings.service.js';
import QuotaService from './quota.service.js';
import FallbackGenerationService from './fallback_generation.service.js';
import { query } from '../utils/config/db.js';
import {
    COMPLETED,
    FAILED,
    FAILURE,
    PENDING_JOB,
    PROCESSING,
    RECEIVED,
    STARTED,
    SUCCESS,
    TERMINAL_STATUSES,
    normalizeStatus
} from '../constants/status.enum.js';

const generationConstraintByMaterialId = new Map();

const TASK_TYPE_TO_MATERIAL_TYPE = {
    summary: 'summary',
    quiz: 'quiz',
    flashcards: 'flashcards',
    mock_exam: 'exam'
};

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
            PENDING_JOB
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
            // 7. Construct FormData for Python Engine (supports file uploads)
            const formData = new FormData();
            formData.append('document_id', documentRecord.id);
            formData.append('subject_id', finalSubjectId);
            formData.append('user_id', userId);

            if (filePath) {
                formData.append('file_path', filePath);
                if (fs.existsSync(filePath)) {
                    formData.append('file', fs.createReadStream(filePath));
                }
            } else {
                formData.append('content', content || '');
            }

            // Send directly to Python Engine's process-document route
            const aiResponse = await ((process.env.NODE_ENV === 'test' && global.__mockAxiosPost)
                ? global.__mockAxiosPost('/process-document', formData, { headers: formData.getHeaders(), timeout: 30000 })
                : engineClient.post('/process-document', formData, {
                    headers: {
                        ...formData.getHeaders()
                    },
                    timeout: 300000
                }));

            const { job_id } = aiResponse.data;

            // 9. Update record with real job_id and shift to PROCESSING
            await Material.updateStatus(documentRecord.id, userId, PROCESSING, job_id);

            console.info(`[MaterialService] Async job triggered: ${job_id} for material: ${documentRecord.id}`);

            return await Material.findById(documentRecord.id, userId);
        } catch (error) {
            console.error(`[MaterialService] Failed to trigger AI job: ${error.message}`, { ...opContext, materialId: documentRecord?.id });
            if (documentRecord) {
                await Material.updateStatus(documentRecord.id, userId, FAILED);
            }
            return documentRecord ? await Material.findById(documentRecord.id, userId) : null;
        }
    }
    static async getMaterialById(userId, materialId) {
        return await Material.findById(materialId, userId);
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
        if (TERMINAL_STATUSES.includes(normalizeStatus(material.status))) {
            return material;
        }

        // 2. Watchdog: check if job is stuck in PROCESSING for too long (> 3 mins)
        // Note: Engine is now capped at ~2.5 min total (90s initial + 2×30s completion).
        if (normalizeStatus(material.status) === PROCESSING && material.started_at) {
            const startedAt = new Date(material.started_at);
            const now = new Date();
            const diffMinutes = (now - startedAt) / (1000 * 60);

            if (diffMinutes > 10) {
                console.warn(`[MaterialService] Job ${material.job_id} timed out after ${diffMinutes.toFixed(1)} mins.`);
                generationConstraintByMaterialId.delete(String(materialId));
                await Material.recordFailure(materialId, userId, 'Job timeout / worker failure');
                await MaterialService._garbageCollectFile(materialId);
                return await Material.findById(materialId, userId);
            }
        }

        // 3. Sync with Celery if job_id exists
        if (material.job_id) {
            try {
                const response = await engineClient.get(`/job/${material.job_id}`);
                const { status, result, error } = response.data;
                const engineStatus = normalizeStatus(status);

                // SUCCESS: Sync results to DB
                if (engineStatus === SUCCESS && result) {
                    // Check if this is a study material generation result (from task_generate)
                    if (result.material_type) {
                        const persistedConstraints = generationConstraintByMaterialId.get(String(materialId)) || {};

                        const contentStr = result.content ? (typeof result.content === 'object' ? JSON.stringify(result.content) : result.content) : null;
                        const aiContentStr = result.ai_generated_content ? (typeof result.ai_generated_content === 'string' ? result.ai_generated_content : JSON.stringify(result.ai_generated_content)) : null;

                        if (result.content && result.ai_generated_content) {
                            await query(
                                'UPDATE materials SET content = $2, ai_generated_content = $3, status = $4, completed_at = $5, processed_at = $6 WHERE id = $1 AND user_id = $7',
                                [materialId, contentStr, aiContentStr, COMPLETED, updateData.completed_at, updateData.processed_at, userId]
                            );
                        } else if (result.content) {
                            await query(
                                'UPDATE materials SET content = $2, status = $3, completed_at = $4, processed_at = $5 WHERE id = $1 AND user_id = $6',
                                [materialId, contentStr, COMPLETED, updateData.completed_at, updateData.processed_at, userId]
                            );
                        } else if (result.ai_generated_content) {
                            await query(
                                'UPDATE materials SET ai_generated_content = $2, status = $3, completed_at = $4, processed_at = $5 WHERE id = $1 AND user_id = $6',
                                [materialId, aiContentStr, COMPLETED, updateData.completed_at, updateData.processed_at, userId]
                            );
                        }
                        }

                        await Material.updateAIResult(
                            materialId,
                            userId,
                            result.ai_generated_content,
                            {
                                materialType: result.material_type,
                                ...persistedConstraints,
                            }
                        );
                        generationConstraintByMaterialId.delete(String(materialId));
                    } else {
                        // Standard document processing result (task_ocr/task_chunk/task_embed)
                        const extractedText = result.extracted_text || material.content;
                        await Material.updateContent(materialId, userId, extractedText);
                        await Material.updateAIResult(materialId, userId, {
                            chunk_count: result.chunk_count,
                            provider: result.provider,
                            model: result.model,
                            processed_at: new Date().toISOString(),
                        });
                    }
                    return await Material.findById(materialId, userId);
                }

                // ENGINE_STATUS (not DB status) — result.status comes from Celery task payload
                const errorMsg = error || result?.error || (result?.status === 'FAILED' ? result?.error : null) || 'AI Generation Failed';

                // FAILURE: Record error in DB
                if (engineStatus === FAILURE || result?.status === 'FAILED') {
                    generationConstraintByMaterialId.delete(String(materialId));
                    await Material.recordFailure(materialId, userId, errorMsg);
                    await MaterialService._garbageCollectFile(materialId);
                    return await Material.findById(materialId, userId);
                }

                // STARTED or RECEIVED: Keep as PROCESSING in DB
                if ((engineStatus === STARTED || engineStatus === RECEIVED) && normalizeStatus(material.status) !== PROCESSING) {
                    await Material.updateStatus(materialId, userId, PROCESSING);
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
     * AI Chat grounded in a subject's knowledge base.
     */
    static async chatWithContext(userId, materialIds, question) {
        const sourceDocuments = await Material.findByIds(materialIds, userId);
        if (sourceDocuments.length === 0) return { result: "No source documents selected for context." };

        // We use the subject_id of the first document to provide the search context
        const subjectId = sourceDocuments[0].subject_id;

        try {
            const payload = {
                subject_id: subjectId,
                question: question,
                top_k: 8, // Increase context for better chat
                user_id: userId
            };
            const options = { timeout: 300000 };

            const aiResponse = process.env.NODE_ENV === 'test' && global.__mockAxiosPost
                ? await global.__mockAxiosPost('/chat', payload, options)
                : await engineClient.post('/chat', payload, options);

            const result = aiResponse.data;

            // Update Subject activity
            await Subject.touch(subjectId, userId);

            // 4. Log interaction asynchronously (history)
            query(
                "INSERT INTO chat_history (user_id, subject_id, type, query, response) VALUES ($1, $2, $3, $4, $5)",
                [userId, subjectId, 'text', question, result.result || result.response || 'No response']
            ).catch(err => console.error('[MaterialService] Failed to log chat:', err.message));

            if (result.job_id) {
                console.info(`[MaterialService] Chat job triggered: ${result.job_id}`);
            }

            return result;
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
     * Streaming generation — proxies engine's /generate/stream SSE directly to the caller.
     * Returns an axios response with responseType: 'stream' so the controller can pipe it.
     */
    static async generateStream(userId, materialIds, taskType, subjectId, genOptions = {}) {
        const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const safeIds = (Array.isArray(materialIds) ? materialIds : [])
            .filter(id => typeof id === 'string' && UUID_PATTERN.test(id));

        const sourceDocuments = safeIds.length > 0
            ? await Material.findByIds(safeIds, userId)
            : [];

        const finalSubjectId = subjectId || (sourceDocuments.length > 0 ? sourceDocuments[0].subject_id : null);
        if (!finalSubjectId) throw new Error('No subject context available for generation.');

        const typeMap = { summary: 'summary', quiz: 'quiz', flashcards: 'flashcards', mock_exam: 'exam' };
        const materialType = typeMap[taskType] || 'summary';

        // Build GPS so difficulty reaches the engine prompt builder
        const gps = this._buildGPS(taskType, genOptions);

        const enginePayload = {
            subject_id: finalSubjectId,
            material_type: materialType,
            topic: (genOptions || {}).topic,
            language: (genOptions || {}).language || 'en',
            top_k: 20,
            generation_options: gps,
        };

        return engineClient.post('/generate/stream', enginePayload, {
            responseType: 'stream',
            timeout: 300000,
        });
    }

    /**
     * AI Generation grounded in a subject's knowledge base.
     */
    static async generateWithContext(userId, subjectId, materialIds, taskType, genOptions = {}) {
        // Guard: sanitize materialIds to only valid UUID strings (prevents SQL malformed array literal errors)
        const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const safeIds = (Array.isArray(materialIds) ? materialIds : [])
            .filter(id => typeof id === 'string' && UUID_PATTERN.test(id));

        const sourceDocuments = await Material.findByIds(safeIds, userId);
        if (sourceDocuments.length === 0 && !subjectId) return { result: "No source documents selected for context." };

        const finalSubjectId = subjectId || (sourceDocuments.length > 0 ? sourceDocuments[0].subject_id : null);
        if (!finalSubjectId) return { result: "No subject context available for generation." };

        // 1. Build Shared Generation Plan (GPS)
        const gps = this._buildGPS(taskType, genOptions);
        const materialType = TASK_TYPE_TO_MATERIAL_TYPE[taskType] || 'summary';

        // 2. Resolve Title (Unique Naming)
        const displayType = materialType.charAt(0).toUpperCase() + materialType.slice(1);
        const subject = await Subject.findById(finalSubjectId, userId);
        const subjectName = subject ? subject.name : 'Unknown Subject';
        let contextTitle = sourceDocuments.length === 1 ? sourceDocuments[0].title : (sourceDocuments.length > 1 ? 'Multiple Sources' : subjectName);
        const baseTitle = `${displayType} of ${contextTitle}`;
        const finalTitle = await this._resolveUniqueTitle(userId, finalSubjectId, baseTitle);

        // 3. Create placeholder record
        const materialRecord = await Material.create(
            userId,
            finalSubjectId,
            finalTitle,
            '',
            materialType,
            PENDING_JOB
        );

        const enginePayload = {
            subject_id: finalSubjectId,
            material_type: materialType,
            chunks: sourceDocuments.map(d => d.content),
            topic: genOptions.topic,
            language: genOptions.language || 'en',
            generation_options: gps
        };

        // 4. Health Watchdog & Dual-Path Routing
        try {
            console.log(`[MaterialService] Routing to Primary Path (Python Engine) for Material ${materialRecord.id}`);

            // Health Watchdog: Short timeout for triggers
            const response = await engineClient.post('/generate', enginePayload, {
                timeout: 300000
            });

            const result = response.data;
            await Material.updateStatus(materialRecord.id, userId, PROCESSING, result.job_id);
            
            return {
                status: 'accepted',
                job_id: result.job_id,
                material_id: materialRecord.id
            };

        } catch (error) {
            console.error(`[MaterialService] Primary Path Failed: ${error.message}. Triggering Fallback Path.`);
            
            // 5. Fallback Path (Synchronous Node.js + Ollama)
            try {
                const context = enginePayload.chunks.join('\n\n');
                const fallbackResult = await FallbackGenerationService.generateSync(
                    userId, 
                    materialRecord.id, 
                    materialType, 
                    gps, 
                    context
                );
                
                return {
                    status: 'success',
                    material_id: materialRecord.id,
                    is_fallback: true
                };
            } catch (fallbackError) {
                console.error(`[MaterialService] Critical Failure: Both paths failed.`, fallbackError);
                await Material.recordFailure(materialRecord.id, userId, `All generation paths failed: ${fallbackError.message}`);
                throw fallbackError;
            }
        }
    }

    /**
     * Builds the Shared Generation Policy (GPS) based on UI preferences.
     */
    static _buildGPS(taskType, options) {
        const difficultyMap = {
            'Intro': 'introductory',
            'Inter': 'intermediate',
            'Adv': 'advanced'
        };

        const gps = {
            total_count: Math.max(1, parseInt(options.count) || 5),
            difficulty: difficultyMap[options.difficulty] || 'intermediate',
            distribution: [],
            config_version: 1 // Match engine's CURRENT_CONFIG_VERSION
        };

        if (taskType === 'mock_exam') {
            const rawTypes = options.examTypes || ['single_choice', 'multiple_select', 'short_answer'];
            const types = (Array.isArray(rawTypes) && rawTypes.length > 0) ? rawTypes : ['single_choice', 'multiple_select', 'short_answer'];
            
            const countPerType = Math.floor(gps.total_count / types.length);
            
            const typeMapping = {
                'single_choice': 'mcq',
                'multiple_select': 'mcq',
                'short_answer': 'essay',
                'problem': 'essay',
                'scenario': 'essay',
                'fill_blank': 'fill_blank',
                'matching': 'matching'
            };

            gps.distribution = types.map((type, idx) => ({
                type: typeMapping[type] || 'mcq',
                count: (idx === types.length - 1) 
                    ? gps.total_count - (countPerType * (types.length - 1)) 
                    : countPerType
            }));
        } else {
            // Mapping for other types to Engine-supported Question types
            const typeMapping = {
                'quiz': 'mcq',
                'flashcards': 'mcq',
                'mock_exam': 'mcq',
                'summary': 'mcq' // Summary distribution is ignored but type must be valid
            };
            const engineType = typeMapping[taskType] || 'mcq';
            gps.distribution = [{ type: engineType, percentage: 100 }];
        }

        return gps;
    }

    /**
     * Ensure title uniqueness within a subject.
     */
    static async _resolveUniqueTitle(userId, subjectId, baseTitle) {
        let uniqueTitle = baseTitle;
        let counter = 1;
        
        while (await Material.findByTitle(userId, subjectId, uniqueTitle)) {
            uniqueTitle = `${baseTitle} (${counter})`;
            counter++;
        }
        
        return uniqueTitle;
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
     * Cancel a running AI job.
     */
    static async cancelJob(userId, materialId) {
        const material = await Material.findById(materialId, userId);
        if (!material) throw new Error('Material not found');
        if (!material.job_id) throw new Error('Material has no active job');

        try {
            // Forward cancellation to Python engine
            await engineClient.post('/job/cancel', { job_id: material.job_id }, { timeout: 5000 });

            // Revert material status to IDLE or just keep it as is?
            // Usually, we mark it as FAILED with a 'Cancelled by user' message.
            generationConstraintByMaterialId.delete(String(materialId));
            await Material.recordFailure(materialId, userId, 'Processing cancelled by user');
            return true;
        } catch (error) {
            console.error('[MaterialService] Job Cancel Error:', error.message);
            throw new Error('Failed to cancel job with AI engine');
        }
    }

    /**
     * Update material metadata (e.g. rename title).
     */
    static async updateMaterial(userId, materialId, updates) {
        if (!updates || !updates.title || updates.title.trim() === '') {
            throw new Error('Valid title is required for renaming');
        }

        const material = await Material.findById(materialId, userId);
        if (!material) {
            const error = new Error('Material not found');
            error.statusCode = 404;
            throw error;
        }

        const updated = await Material.updateById(materialId, userId, {
            title: updates.title.trim()
        });

        return updated;
    }

    /**
     * Delete a material by ID (Moves to Trash).
     * Enforces user_id for security.
     */
    static async deleteMaterial(materialId, userId) {
        // Removed garbage collection here since this is now a soft delete.
        // Files are kept so they can be restored later.
        return await Material.delete(materialId, userId);
    }

    /**
     * Find soft-deleted materials in the user's trash.
     */
    static async getTrash(userId) {
        return await Material.findDeleted(userId);
    }

    /**
     * Restore a material from the trash.
     */
    static async restoreMaterial(materialId, userId) {
        const material = await Material.restore(materialId, userId);
        if (!material) {
            throw new Error('Material not found or not in trash');
        }
        return material;
    }

    /**
     * Permanently delete a single trashed material and its associated file.
     */
    static async permanentDeleteMaterial(materialId, userId) {
        await MaterialService._garbageCollectFile(materialId);
        const deleted = await Material.permanentDelete(materialId, userId);
        if (!deleted) {
            throw new Error('Material not found or not in trash');
        }
        return true;
    }

    /**
     * Permanently delete all trashed materials for a user and their files.
     */
    static async emptyTrash(userId) {
        // Collect file info before deletion so we can clean up disk
        const trashItems = await Material.findDeleted(userId);
        await Promise.all(trashItems.map(m => MaterialService._garbageCollectFile(m.id)));
        const deleted = await Material.emptyTrash(userId);
        return deleted.length;
    }
}

export default MaterialService;
