import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import PlannerController from '../controllers/planner.controller.js';

const router = Router();

// All planner routes require authentication
router.use(protect);

// ── Overview ───────────────────────────────────────────────────────────────
router.get('/overview', PlannerController.getUserOverview);

// ── Goals & Milestones ─────────────────────────────────────────────────────
router.post('/goals', PlannerController.createGoal);
router.get('/goals/:id', PlannerController.getGoal);

// ── Tasks ──────────────────────────────────────────────────────────────────
router.post('/tasks', PlannerController.createTask);
router.get('/tasks', PlannerController.getTasks);

// ── Habits ─────────────────────────────────────────────────────────────────
router.post('/habits', PlannerController.createHabit);
router.get('/habits', PlannerController.getHabits);

// ── Schedule Blocks ────────────────────────────────────────────────────────
router.post('/schedule', PlannerController.createScheduleBlock);
router.get('/schedule', PlannerController.getSchedule);

// ── Productivity Preferences ───────────────────────────────────────────────
router.get('/preferences', PlannerController.getPreferences);
router.put('/preferences', PlannerController.updatePreferences);

export default router;
