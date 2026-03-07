import express from 'express';
import MaterialController from '../controllers/material.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

// All material routes are protected
router.use(protect);

router.post('/upload', MaterialController.upload);
router.get('/history', MaterialController.getHistory);
router.post('/chat-combined', MaterialController.chatCombined);
router.post('/generate-combined', MaterialController.generateCombined);

export default router;
