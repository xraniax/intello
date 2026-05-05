import GoalService from '../services/goal.service.js';

/**
 * Goal Controller
 * HTTP request handlers for study goals endpoints
 */
class GoalController {
    /**
     * POST /api/goals
     * Create a new study goal
     */
    static async createGoal(req, res, next) {
        try {
            const userId = req.user.id;
            const goalData = req.body;

            const goal = await GoalService.createGoal(userId, goalData);

            res.status(201).json({
                status: 'success',
                message: 'Study goal created successfully',
                data: goal
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/goals
     * Get all goals for the authenticated user
     */
    static async getUserGoals(req, res, next) {
        try {
            const userId = req.user.id;
            const filters = {
                status: req.query.status,
                subjectId: req.query.subjectId,
                limit: parseInt(req.query.limit) || 50,
                offset: parseInt(req.query.offset) || 0
            };

            const goals = await GoalService.getUserGoals(userId, filters);

            res.status(200).json({
                status: 'success',
                data: goals,
                count: goals.length
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/goals/stats
     * Get goal statistics for dashboard
     */
    static async getGoalStats(req, res, next) {
        try {
            const userId = req.user.id;

            const stats = await GoalService.getGoalStats(userId);

            res.status(200).json({
                status: 'success',
                data: stats
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/goals/:id
     * Get a single goal by ID
     */
    static async getGoalById(req, res, next) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const goal = await GoalService.getGoalById(id, userId);

            res.status(200).json({
                status: 'success',
                data: goal
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * PATCH /api/goals/:id
     * Update a goal
     */
    static async updateGoal(req, res, next) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const updates = req.body;

            const goal = await GoalService.updateGoal(id, userId, updates);

            res.status(200).json({
                status: 'success',
                message: 'Goal updated successfully',
                data: goal
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * DELETE /api/goals/:id
     * Delete a goal
     */
    static async deleteGoal(req, res, next) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            await GoalService.deleteGoal(id, userId);

            res.status(200).json({
                status: 'success',
                message: 'Goal deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/goals/sessions/start
     * Start a study session
     */
    static async startStudySession(req, res, next) {
        try {
            const userId = req.user.id;
            const sessionData = req.body;

            const session = await GoalService.startStudySession(userId, sessionData);

            res.status(201).json({
                status: 'success',
                message: 'Study session started',
                data: session
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/goals/sessions/:id/end
     * End a study session
     */
    static async endStudySession(req, res, next) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const sessionData = req.body;

            const result = await GoalService.endStudySession(id, userId, sessionData);

            res.status(200).json({
                status: 'success',
                message: 'Study session ended',
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/goals/sessions/history
     * Get study session history
     */
    static async getStudyHistory(req, res, next) {
        try {
            const userId = req.user.id;
            const filters = {
                days: parseInt(req.query.days) || 30
            };

            const history = await GoalService.getStudyHistory(userId, filters);

            res.status(200).json({
                status: 'success',
                data: history
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/goals/streak
     * Get current study streak
     */
    static async getStudyStreak(req, res, next) {
        try {
            const userId = req.user.id;

            const streak = await GoalService.getStudyStreak(userId);

            res.status(200).json({
                status: 'success',
                data: streak
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/goals/log-time
     * Quick log study time without session tracking
     */
    static async logStudyTime(req, res, next) {
        try {
            const userId = req.user.id;
            const { minutes, subjectId } = req.body;

            if (!minutes || minutes < 1 || minutes > 480) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Minutes must be between 1 and 480'
                });
            }

            const result = await GoalService.logStudyTime(userId, minutes, subjectId);

            res.status(200).json({
                status: 'success',
                message: `${minutes} minutes logged`,
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/goals/admin/reminders
     * Admin endpoint to get goals needing reminders (for cron job)
     */
    static async getGoalsNeedingReminders(req, res, next) {
        try {
            // This endpoint should be protected by admin middleware
            const goals = await GoalService.getGoalsNeedingReminders();

            res.status(200).json({
                status: 'success',
                data: goals,
                count: goals.length
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/goals/admin/reminders/:id/sent
     * Mark a reminder as sent
     */
    static async markReminderSent(req, res, next) {
        try {
            const { id } = req.params;

            await GoalService.markReminderSent(id);

            res.status(200).json({
                status: 'success',
                message: 'Reminder marked as sent'
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/goals/plan/generate
     * Generate AI study plan
     */
    static async generateStudyPlan(req, res, next) {
        try {
            const userId = req.user.id;
            const planData = await GoalService.generateStudyPlan(userId, req.body);
            res.status(200).json({
                status: 'success',
                data: planData
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/goals/plan/activate
     * Activate the generated AI study plan
     */
    static async activateStudyPlan(req, res, next) {
        try {
            const userId = req.user.id;
            const result = await GoalService.activateStudyPlan(userId, req.body);
            res.status(200).json({
                status: 'success',
                message: 'Plan activated successfully',
                data: result
            });
        } catch (error) {
            next(error);
        }
    }
}

export default GoalController;
