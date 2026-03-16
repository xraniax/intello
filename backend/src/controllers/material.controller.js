import MaterialService from '../services/material.service.js';
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
        const { title, content, type, subjectId } = req.body;
        const file = req.file;

        const originalFilename = file ? file.originalname : '';
        const rawContent = content || '';

        if (!file && !rawContent) {
            res.status(400);
            throw new Error('Content is required — upload a PDF or paste text.');
        }

        try {
            // Forward everything directly to Python Engine via the Service layer
            const material = await MaterialService.processDocument(
                req.user.id,
                file,
                (title && title.trim()) || originalFilename || 'Untitled Resource',
                rawContent,
                type || 'upload',
                subjectId
            );

            res.status(201).json({
                status: 'success',
                data: material,
            });
        } finally {
            if (file) {
                safeDelete(file.path);
            }
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

    static delete = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const deleted = await MaterialService.deleteMaterial(id, req.user.id);

        if (!deleted) {
            res.status(404);
            throw new Error('Material not found or already deleted');
        }

        res.status(200).json({
            status: 'success',
            message: 'Material deleted successfully'
        });
    });
}

export default MaterialController;
