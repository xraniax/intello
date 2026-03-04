import express from 'express';
import MaterialController from '../controllers/material.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

// All material routes are protected
router.use(protect);

router.post('/upload', MaterialController.upload);
router.get('/history', MaterialController.getHistory);

export default router;
