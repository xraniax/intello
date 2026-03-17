import express from 'express';
import SubjectController from '../controllers/subject.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { createSubjectSchema, renameSubjectSchema } from '../middlewares/subject.validator.js';

const router = express.Router();

// All subject routes are protected
router.use(protect);

router.post('/', validate(createSubjectSchema), SubjectController.create);
router.get('/', SubjectController.getAll);
router.get('/:id', SubjectController.getOne);
router.patch('/:id', validate(renameSubjectSchema), SubjectController.rename);
router.delete('/:id', SubjectController.delete);

export default router;
