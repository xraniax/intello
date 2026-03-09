import express from 'express';
import MaterialController from '../controllers/material.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { aiLimiter } from '../middlewares/rateLimiter.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { uploadMaterialSchema, chatCombinedSchema, generateCombinedSchema } from '../validators/material.validator.js';

const router = express.Router();

// All material routes are protected
router.use(protect);

router.post('/upload', aiLimiter, validate(uploadMaterialSchema), MaterialController.upload);
router.get('/history', MaterialController.getHistory);
router.post('/chat-combined', aiLimiter, validate(chatCombinedSchema), MaterialController.chatCombined);
router.post('/generate-combined', aiLimiter, validate(generateCombinedSchema), MaterialController.generateCombined);

export default router;
