import MaterialService from '../services/material.service.js';
import SettingsService from '../services/settings.service.js';
import engineClient from '../services/engine.client.js';
import asyncHandler from '../utils/asyncHandler.js';
import fs from 'fs';

/**
 * Safely delete a temp file without throwing.
 * Used to ensure uploaded files are cleaned up even if processing fails.
 */
const safeDelete = (filePath) => {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (err) {
        console.warn(`[MaterialController] Could not clean up temp file (${filePath}):`, err.message);
    }
};

class MaterialController {
    /**
     * Upload endpoint: accepts a PDF file and/or raw text content.
     *
     * NEW Processing pipeline:
     *   1. Receive file locally via Multer.
     *   2. Immediately forward the physical file to the Python AI Engine.
     *   3. Python Engine handles ALL text extraction, chunking, processing.
     *   4. Python Engine returns the final processed JSON result.
     *   5. Backend saves the processed result in Postgres.
     *   6. Clean up the temp file locally.
     */
    static upload = asyncHandler(async (req, res) => {
        console.log('[MaterialController] Upload Headers:', JSON.stringify(req.headers, null, 2));
        console.log('[MaterialController] Upload request body:', req.body);
        const { title, content, type, subjectId } = req.body;
        const file = req.file;
        console.log('[MaterialController] Upload file present:', !!file);
        console.log('[MaterialController] Upload subjectId:', subjectId);

        if (!file && !content) {
            res.status(400);
            throw new Error('Content is required — upload a PDF or paste text.');
        }

        try {
            // Forward everything directly to Python Engine via the Service layer
            const uploadedDocument = await MaterialService.processDocument(
                req.user.id,
                file,
                title,
                content || '',
                type || 'upload',
                subjectId
            );

            res.status(201).json({
                status: 'success',
                data: uploadedDocument,
            });
        } catch (error) {
            // Only scrape the physical file from the NFS drive if a database/processing error halted the pipeline
            if (file) {
                safeDelete(file.path);
            }
            throw error;
        }
    });

    static getOne = asyncHandler(async (req, res) => {
        const { id } = req.params;

        const material = await MaterialService.getMaterialById(req.user.id, id);

        if (!material) {
            res.status(404);
            throw new Error('Material not found');
        }

        res.status(200).json({
            status: 'success',
            data: material
        });
    });

    static getHistory = asyncHandler(async (req, res) => {
        const history = await MaterialService.getUserHistory(req.user.id);
        res.status(200).json({
            status: 'success',
            data: history
        });
    });

    static chatCombined = asyncHandler(async (req, res) => {
        const { materialIds, question } = req.body;
        if (!materialIds || !question) {
            res.status(400);
            throw new Error('materialIds and question are required');
        }

        const result = await MaterialService.chatWithContext(req.user.id, materialIds, question);
        res.status(200).json({ status: 'success', data: result });
    });

    static generateCombined = asyncHandler(async (req, res) => {
        console.log('[MaterialController] generateCombined body:', JSON.stringify(req.body, null, 2));
        const { materialIds, taskType, subjectId, genOptions } = req.body;
        if (!materialIds || !taskType) {
            res.status(400);
            throw new Error('materialIds and taskType are required');
        }

        const result = await MaterialService.generateWithContext(req.user.id, subjectId, materialIds, taskType, genOptions);
        res.status(200).json({ status: 'success', data: result });
    });

    static generateCombinedStream = asyncHandler(async (req, res) => {
        const reqStart = Date.now();
        console.log('[TRACE][BACKEND_STREAM_RECV] timestamp=%d body=%s', reqStart, JSON.stringify(req.body));
        const { materialIds, taskType, subjectId, genOptions } = req.body;
        if (!materialIds || !taskType) {
            res.status(400);
            throw new Error('materialIds and taskType are required');
        }

        console.log('[TRACE][BACKEND_STREAM_FWD] forwarding to engine timestamp=%d', Date.now());
        const response = await MaterialService.generateStream(req.user.id, materialIds, taskType, subjectId, genOptions);
        const engineResponseMs = Date.now() - reqStart;
        console.log('[TRACE][BACKEND_ENGINE_RESP] engine_response_ms=%d status=%d', engineResponseMs, response.status);

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        let firstChunk = true;
        let chunkCount = 0;
        response.data.on('data', (chunk) => {
            chunkCount++;
            if (firstChunk) {
                console.log('[TRACE][BACKEND_FIRST_CHUNK] time_to_first_chunk_ms=%d', Date.now() - reqStart);
                firstChunk = false;
            }
        });

        console.log('[TRACE][BACKEND_PIPE_START] timestamp=%d time_since_request_ms=%d', Date.now(), Date.now() - reqStart);
        response.data.pipe(res);

        response.data.on('end', () => {
            console.log('[TRACE][BACKEND_PIPE_END] total_ms=%d chunks_piped=%d', Date.now() - reqStart, chunkCount);
        });

        response.data.on('error', (err) => {
            console.error('[TRACE][BACKEND_PIPE_ERROR] total_ms=%d error=%s', Date.now() - reqStart, err.message);
        });

        req.on('close', () => {
            const totalMs = Date.now() - reqStart;
            console.log('[TRACE][BACKEND_CLIENT_CLOSE] total_ms=%d chunks_piped=%d', totalMs, chunkCount);
            if (response.data.destroy) response.data.destroy();
        });
    });

    static syncStatus = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const updated = await MaterialService.checkJobStatus(req.user.id, id);
        res.status(200).json({
            status: 'success',
            data: updated
        });
    });

    static cancelJob = asyncHandler(async (req, res) => {
        const { id } = req.params;
        await MaterialService.cancelJob(req.user.id, id);
        res.status(200).json({ status: 'success', message: 'Job cancellation requested' });
    });

    static streamJob = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const material = await MaterialService.checkJobStatus(req.user.id, id);

        if (!material || !material.job_id) {
            res.status(404);
            throw new Error('Streaming not available for this material');
        }

        console.log(`[MaterialController] Proxying stream for job: ${material.job_id}`);

        const response = await engineClient.get(
            `/job/${material.job_id}/stream`,
            {
            responseType: 'stream',
            timeout: 0 // Disable timeout for long-lived streams
            }
        );

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        response.data.pipe(res);

        // Handle client disconnect
        req.on('close', () => {
            console.log(`[MaterialController] Client closed connection for job: ${material.job_id}`);
            if (response.data.destroy) response.data.destroy();
        });
    });

    static delete = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const deleted = await MaterialService.deleteMaterial(id, req.user.id);

        if (!deleted) {
            res.status(404);
            throw new Error('Document not found or already deleted');
        }

        res.status(200).json({
            status: 'success',
            message: 'Document moved to trash successfully'
        });
    });

    static getTrash = asyncHandler(async (req, res) => {
        const trash = await MaterialService.getTrash(req.user.id);
        res.status(200).json({
            status: 'success',
            data: trash
        });
    });

    static restore = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const restored = await MaterialService.restoreMaterial(id, req.user.id);
        res.status(200).json({
            status: 'success',
            message: 'Document restored successfully',
            data: restored
        });
    });

    static permanentDelete = asyncHandler(async (req, res) => {
        const { id } = req.params;
        await MaterialService.permanentDeleteMaterial(id, req.user.id);
        res.status(200).json({
            status: 'success',
            message: 'Document permanently deleted'
        });
    });

    static emptyTrash = asyncHandler(async (req, res) => {
        const count = await MaterialService.emptyTrash(req.user.id);
        res.status(200).json({
            status: 'success',
            message: `${count} item${count !== 1 ? 's' : ''} permanently deleted`
        });
    });

    static update = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const updates = req.body;

        const updated = await MaterialService.updateMaterial(req.user.id, id, updates);

        res.status(200).json({
            status: 'success',
            data: updated
        });
    });

    static getSettings = asyncHandler(async (req, res) => {
        const controls = await SettingsService.getStorageControls();
        res.status(200).json({ status: 'success', data: controls });
    });
}

export default MaterialController;
