import MaterialService from '../services/material.service.js';

class MaterialController {
    static async upload(req, res, next) {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({ status: 'error', message: 'User not authenticated' });
            }

            const { title, content, type, subjectId } = req.body;
            const userId = req.user.id;

            if (!content || !type) {
                return res.status(400).json({ status: 'error', message: 'Content and type are required' });
            }

            const material = await MaterialService.processMaterial(userId, title || 'Untitled', content, type, subjectId);

            res.status(201).json({
                status: 'success',
                data: material
            });
        } catch (error) {
            next(error);
        }
    }

    static async getHistory(req, res, next) {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({ status: 'error', message: 'User not authenticated' });
            }

            const history = await MaterialService.getUserHistory(req.user.id);
            res.status(200).json({
                status: 'success',
                data: history
            });
        } catch (error) {
            next(error);
        }
    }

    static async chatCombined(req, res, next) {
        try {
            const { materialIds, question } = req.body;
            if (!materialIds || !question) {
                return res.status(400).json({ status: 'error', message: 'materialIds and question are required' });
            }

            const result = await MaterialService.chatWithContext(req.user.id, materialIds, question);
            res.status(200).json({ status: 'success', data: result });
        } catch (error) {
            next(error);
        }
    }

    static async generateCombined(req, res, next) {
        try {
            const { materialIds, taskType } = req.body;
            if (!materialIds || !taskType) {
                return res.status(400).json({ status: 'error', message: 'materialIds and taskType are required' });
            }

            const result = await MaterialService.generateWithContext(req.user.id, materialIds, taskType);
            res.status(200).json({ status: 'success', data: result });
        } catch (error) {
            next(error);
        }
    }
}

export default MaterialController;
