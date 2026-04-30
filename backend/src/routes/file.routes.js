import express from 'express';
import FileController from '../controllers/file.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/:document_id', FileController.download);

export default router;
