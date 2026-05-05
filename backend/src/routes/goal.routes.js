import { Router } from 'express';
import { protect, adminOnly } from '../middlewares/auth.middleware.js';
import GoalController from '../controllers/goal.controller.js';

const router = Router();

router.use(protect);

// ── Goal CRUD ────────────────────────────────────────────────────────────────
router.post('/', GoalController.createGoal);
router.get('/', GoalController.getUserGoals);
router.get('/stats', GoalController.getGoalStats);
router.get('/streak', GoalController.getStudyStreak);
router.post('/plan/generate', GoalController.generateStudyPlan);
router.post('/plan/activate', GoalController.activateStudyPlan);

// ── Study Sessions ───────────────────────────────────────────────────────────
router.post('/sessions/start', GoalController.startStudySession);
router.post('/sessions/:id/end', GoalController.endStudySession);
router.get('/sessions/history', GoalController.getStudyHistory);

// ── Quick Time Logging ───────────────────────────────────────────────────────
router.post('/log-time', GoalController.logStudyTime);

// ── Single Goal (must be after specific routes) ──────────────────────────────
router.get('/:id', GoalController.getGoalById);
router.patch('/:id', GoalController.updateGoal);
router.delete('/:id', GoalController.deleteGoal);

// ── Admin Routes ─────────────────────────────────────────────────────────────
router.get('/admin/reminders', adminOnly, GoalController.getGoalsNeedingReminders);
router.post('/admin/reminders/:id/sent', adminOnly, GoalController.markReminderSent);

export default router;
