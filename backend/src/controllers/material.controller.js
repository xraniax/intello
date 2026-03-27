import MaterialService from '../services/material.service.js';
import SettingsService from '../services/settings.service.js';
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
        const { materialIds, taskType } = req.body;
        if (!materialIds || !taskType) {
            res.status(400);
            throw new Error('materialIds and taskType are required');
        }

        const result = await MaterialService.generateWithContext(req.user.id, materialIds, taskType);
        res.status(200).json({ status: 'success', data: result });
    });

    static syncStatus = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const updated = await MaterialService.checkJobStatus(req.user.id, id);
        res.status(200).json({
            status: 'success',
            data: updated
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
            message: 'Document deleted successfully'
        });
    });

    static getSettings = asyncHandler(async (req, res) => {
        const controls = await SettingsService.getStorageControls();
        res.status(200).json({ status: 'success', data: controls });
    });
}

export default MaterialController;
