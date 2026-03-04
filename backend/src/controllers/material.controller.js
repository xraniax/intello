import MaterialService from '../services/material.service.js';

class MaterialController {
    static async upload(req, res, next) {
        try {
            const { title, content, type } = req.body;
            const userId = req.user.id;

            if (!content || !type) {
                return res.status(400).json({ status: 'error', message: 'Content and type are required' });
            }

            const material = await MaterialService.processMaterial(userId, title || 'Untitled', content, type);

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
            const history = await MaterialService.getUserHistory(req.user.id);
            res.status(200).json({
                status: 'success',
                data: history
            });
        } catch (error) {
            next(error);
        }
    }
}

export default MaterialController;
