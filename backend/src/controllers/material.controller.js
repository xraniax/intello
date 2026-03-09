import MaterialService from '../services/material.service.js';
import asyncHandler from '../utils/asyncHandler.js';

class MaterialController {
    static upload = asyncHandler(async (req, res) => {
        const { title, content, type, subjectId } = req.body;

        if (!content || !type) {
            res.status(400);
            throw new Error('Content and type are required');
        }

        const material = await MaterialService.processMaterial(
            req.user.id,
            title || 'Untitled',
            content,
            type,
            subjectId
        );

        res.status(201).json({
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
        const { materialIds, taskType } = req.body;
        if (!materialIds || !taskType) {
            res.status(400);
            throw new Error('materialIds and taskType are required');
        }

        const result = await MaterialService.generateWithContext(req.user.id, materialIds, taskType);
        res.status(200).json({ status: 'success', data: result });
    });
}

export default MaterialController;
