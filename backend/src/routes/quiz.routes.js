import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { aiLimiter } from '../middlewares/rateLimiter.middleware.js';
import QuizController from '../controllers/quiz.controller.js';

const router = express.Router();

router.use(protect);

router.post('/start', aiLimiter, QuizController.start);
router.post('/submit-answer', aiLimiter, QuizController.submitAnswer);

export default router;
