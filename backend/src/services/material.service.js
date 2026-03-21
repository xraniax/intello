import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import Material from '../models/material.model.js';
import Subject from '../models/subject.model.js';
import SubjectService from './subject.service.js';

class MaterialService {
    /**
     * processDocument passes the entire upload payload (PDF + text) to the Python AI engine.
     * The Python engine handles ALL extraction, chunking, and AI processing, completely
     * removing the load from the Node.js backend.
     */
    static async processDocument(userId, file, title, content, type, subjectId = null) {
        // Fallback for title: 1. Manual title, 2. Filename, 3. Default string
        const baseTitle = title || (file ? file.originalname : 'Untitled Material');
        const normalizedTitle = baseTitle.trim();
        const opContext = { userId, subjectId, title: normalizedTitle, operation: 'processDocument' };

        // 1. Resolve subject
        let finalSubjectId = subjectId;
        if (!finalSubjectId) {
            const importedSubject = await SubjectService.getOrCreateImportedSubject(userId);
            finalSubjectId = importedSubject.id;
            opContext.subjectId = finalSubjectId;
        }

        // 2. Strict Duplicate Check (Normalize before comparison)
        const existing = await Material.findByTitle(userId, finalSubjectId, normalizedTitle);
        if (existing) {
            console.warn(`[MaterialService] Duplicate detected: ${JSON.stringify(opContext)}`);
            const error = new Error('A document with this title already exists in this subject.');
            error.statusCode = 409;
            error.code = 'DUPLICATE_MATERIAL';
            throw error;
        }

        console.info(`[MaterialService] Starting processing: ${JSON.stringify(opContext)}`);

        // 3. Save original placeholder record
        const documentRecord = await Material.create(userId, finalSubjectId, normalizedTitle, content, type);
        
        // 3b. Update Subject activity
        await Subject.touch(finalSubjectId, userId);
        
        const fullDocument = await Material.findById(documentRecord.id, userId);

        try {
            // 4. Construct multipart/form-data payload for Python Engine
            const formData = new FormData();
            formData.append('content', content || '');
            formData.append('task_type', type || 'upload');

            if (file) {
                formData.append('file', fs.createReadStream(file.path), file.originalname);
            } else {
                // If no file (text-only note), send a virtual dummy file to satisfy engine requirement
                const dummyContent = Buffer.from(content || '');
                formData.append('file', dummyContent, { filename: 'note.pdf', contentType: 'application/pdf' });
            }

            // 5. Send directly to Python Engine's process-document route
            const aiResponse = await axios.post(`${process.env.ENGINE_URL}/process-document`, formData, {
                headers: {
                    ...formData.getHeaders()
                },
                timeout: 30000 // PDF parsing and AI might take a while
            });

            // 6. Update DB with Extracted Text and AI result
            const aiData = aiResponse.data.data || aiResponse.data; // Handle both nested and flat responses if engine changes

            // We update the content column in case Python pulled text from the PDF
            await Material.updateContent(documentRecord.id, userId, aiData.extracted_text || content);

            const updatedDocument = await Material.updateAIResult(documentRecord.id, userId, {
                result: aiData.result || aiData.message || 'Processed successfully',
                chunks: aiData.chunks || [],
                embeddings: aiData.embeddings || []
            });

            console.info(`[MaterialService] Processing successful: ${documentRecord.id}`);

            // Return fully populated document record
            return await Material.findById(updatedDocument.id, userId);
        } catch (error) {
            console.error(`[MaterialService] AI Processing Error: ${error.message}`, { ...opContext, materialId: documentRecord.id });
            if (error.response) {
                console.error('[MaterialService] Engine Response:', error.response.data);
            }

            // 7. Mark as failed in DB
            await Material.updateStatus(documentRecord.id, userId, 'failed');
            return await Material.findById(documentRecord.id, userId);
        }
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
     * Delete a material by ID.
     * Enforces user_id for security.
     */
    static async deleteMaterial(materialId, userId) {
        return await Material.delete(materialId, userId);
    }
}

export default MaterialService;
