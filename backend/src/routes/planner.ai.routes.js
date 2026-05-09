import { Router } from 'express';
import PlannerAIController from '../controllers/planner.ai.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = Router();

// All AI routes require authentication
router.use(protect);

/**
 * @route   POST /api/planner/ai/chat
 * @desc    Chat with the AI Planning Assistant and execute actions
 * @access  Private (Student)
 */
router.post('/chat', PlannerAIController.chat);

export default router;
