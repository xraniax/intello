import express from 'express';
import SubjectController from '../controllers/subject.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

// All subject routes are protected
router.use(protect);

router.post('/', SubjectController.create);
router.get('/', SubjectController.getAll);
router.get('/:id', SubjectController.getOne);
router.patch('/:id', SubjectController.rename);
router.delete('/:id', SubjectController.delete);

export default router;
