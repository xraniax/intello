import express from 'express';
import MaterialController from '../controllers/material.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { aiLimiter } from '../middlewares/rateLimiter.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { uploadMaterialSchema, chatCombinedSchema, generateCombinedSchema } from '../middlewares/material.validator.js';
import { documentUpload } from '../utils/config/multer.js';

const router = express.Router();


// All material routes are protected
router.use(protect);

router.get('/settings', MaterialController.getSettings);
router.get('/trash', MaterialController.getTrash);
router.delete('/trash', MaterialController.emptyTrash);
router.post('/upload', aiLimiter, documentUpload, validate(uploadMaterialSchema), MaterialController.upload);
router.get('/history', MaterialController.getHistory);
router.post('/chat-combined', aiLimiter, validate(chatCombinedSchema), MaterialController.chatCombined);
router.post('/generate-combined', aiLimiter, validate(generateCombinedSchema), MaterialController.generateCombined);
router.post('/generate-combined/stream', aiLimiter, validate(generateCombinedSchema), MaterialController.generateCombinedStream);
router.get('/:id', MaterialController.getOne);
router.get('/:id/sync', MaterialController.syncStatus);
router.get('/:id/stream', MaterialController.streamJob);
router.post('/:id/cancel', MaterialController.cancelJob);
router.post('/:id/restore', MaterialController.restore);
router.delete('/:id/permanent', MaterialController.permanentDelete);
router.patch('/:id', MaterialController.update);
router.delete('/:id', MaterialController.delete);

export default router;
