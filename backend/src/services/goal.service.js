import Goal, { StudySession } from '../models/goal.model.js';
import { engineClient } from './engine.client.js';

/**
 * Goal Service
 * Business logic for study goals and progress tracking
 */
class GoalService {
    /**
     * Create a new study goal
     */
    static async createGoal(userId, goalData) {
        // Validate goal data
        this.validateGoalData(goalData);

        // Check for duplicate active goals of same type for same subject
        if (goalData.subjectId) {
            const existingGoals = await Goal.findByUserId(userId, {
                status: 'active',
                subjectId: goalData.subjectId
            });

            const duplicate = existingGoals.find(g => 
                g.goal_type === goalData.goalType && 
                g.goal_period === goalData.goalPeriod
            );

            if (duplicate) {
                const error = new Error(`You already have an active ${goalData.goalPeriod} ${goalData.goalType} goal for this subject`);
                error.code = 'DUPLICATE_GOAL';
                throw error;
            }
        }

        const goal = await Goal.create(userId, goalData);
        return this.formatGoalResponse(goal);
    }

    /**
     * Get all goals for a user with progress
     */
    static async getUserGoals(userId, filters = {}) {
        const goals = await Goal.findByUserId(userId, filters);
        return goals.map(goal => this.formatGoalResponse(goal));
    }

    /**
     * Get a single goal by ID
     */
    static async getGoalById(goalId, userId) {
        const goal = await Goal.findById(goalId, userId);
        if (!goal) {
            const error = new Error('Goal not found');
            error.code = 'GOAL_NOT_FOUND';
            throw error;
        }
        return this.formatGoalResponse(goal);
    }

    /**
     * Update a goal
     */
    static async updateGoal(goalId, userId, updates) {
        // Don't allow changing goal_type or goal_period for active goals
        if (updates.status === 'active' || !updates.status) {
            const existingGoal = await Goal.findById(goalId, userId);
            if (!existingGoal) {
                const error = new Error('Goal not found');
                error.code = 'GOAL_NOT_FOUND';
                throw error;
            }

            // Reset progress if target changes significantly
            if (updates.targetValue && 
                Math.abs(updates.targetValue - existingGoal.target_value) > existingGoal.target_value * 0.5) {
                updates.currentValue = 0;
            }
        }

        const goal = await Goal.update(goalId, userId, updates);
        return this.formatGoalResponse(goal);
    }

    /**
     * Delete a goal
     */
    static async deleteGoal(goalId, userId) {
        const deleted = await Goal.delete(goalId, userId);
        if (!deleted) {
            const error = new Error('Goal not found');
            error.code = 'GOAL_NOT_FOUND';
            throw error;
        }
        return { success: true };
    }

    /**
     * Get goal statistics for dashboard
     */
    static async getGoalStats(userId) {
        const stats = await Goal.getStats(userId);
        const weeklyProgress = await Goal.getWeeklyProgress(userId);
        
        return {
            ...stats,
            weeklyProgress: weeklyProgress.map(g => ({
                id: g.id,
                title: g.title,
                type: g.goal_type,
                target: g.target_value,
                current: g.current_value,
                percentage: Math.min(100, parseInt(g.percentage)),
                streak: g.streak_count,
                subject: g.subject_name
            }))
        };
    }

    /**
     * Start a study session
     */
    static async startStudySession(userId, sessionData) {
        const session = await StudySession.start(userId, sessionData);
        return {
            sessionId: session.id,
            startedAt: session.started_at,
            message: 'Study session started'
        };
    }

    /**
     * End a study session and update goal progress
     */
    static async endStudySession(sessionId, userId, sessionData) {
        const session = await StudySession.end(sessionId, userId, sessionData);
        
        if (!session) {
            const error = new Error('Session not found');
            error.code = 'SESSION_NOT_FOUND';
            throw error;
        }

        // Get updated goals
        const activeGoals = await Goal.findByUserId(userId, { status: 'active' });

        return {
            session: {
                id: session.id,
                duration: Math.round(session.duration_minutes),
                endedAt: session.ended_at
            },
            affectedGoals: activeGoals
                .filter(g => g.current_value > 0)
                .map(g => ({
                    id: g.id,
                    title: g.title,
                    progress: Math.min(100, Math.round((g.current_value / g.target_value) * 100))
                }))
        };
    }

    /**
     * Get study history for a user
     */
    static async getStudyHistory(userId, filters = {}) {
        const { days = 30 } = filters;
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);

        const [sessions, dailyTime, totalTime] = await Promise.all([
            StudySession.findByUserId(userId, {
                fromDate: fromDate.toISOString().split('T')[0],
                limit: 100
            }),
            StudySession.getDailyStudyTime(userId, days),
            StudySession.getTotalStudyTime(
                userId, 
                fromDate.toISOString().split('T')[0],
                new Date().toISOString().split('T')[0]
            )
        ]);

        return {
            totalMinutes: totalTime,
            dailyBreakdown: dailyTime,
            recentSessions: sessions.map(s => ({
                id: s.id,
                type: s.session_type,
                duration: s.duration_minutes,
                subject: s.subject_name,
                goal: s.goal_title,
                startedAt: s.started_at,
                notes: s.notes_taken
            }))
        };
    }

    /**
     * Get study streak
     */
    static async getStudyStreak(userId) {
        const streak = await StudySession.getStudyStreak(userId);
        return { streak };
    }

    /**
     * Get goals needing reminders (for cron job)
     */
    static async getGoalsNeedingReminders() {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 8); // HH:MM:SS
        const dayOfWeek = now.getDay() || 7; // 1-7 (Monday-Sunday)

        const goals = await Goal.findGoalsNeedingReminders(currentTime, dayOfWeek);
        
        return goals.map(goal => ({
            goalId: goal.id,
            userId: goal.user_id,
            userEmail: goal.email,
            userName: goal.user_name,
            title: goal.title,
            target: goal.target_value,
            current: goal.current_value,
            period: goal.goal_period,
            percentage: Math.round((goal.current_value / goal.target_value) * 100)
        }));
    }

    /**
     * Mark reminder as sent
     */
    static async markReminderSent(goalId) {
        await Goal.markReminderSent(goalId);
    }

    /**
     * Quick study time logging (without session tracking)
     */
    static async logStudyTime(userId, minutes, subjectId = null) {
        // Create a completed session
        const session = await StudySession.start(userId, {
            subjectId,
            sessionType: 'manual_log'
        });

        // Immediately end it with the specified duration
        await StudySession.end(session.id, userId, {
            notes: `Manually logged ${minutes} minutes`
        });

        // Manually update the duration to the logged amount
        const { query } = await import('../utils/config/db.js');
        await query(
            `UPDATE study_sessions 
             SET duration_minutes = $1 
             WHERE id = $2`,
            [minutes, session.id]
        );

        return {
            success: true,
            minutesLogged: minutes,
            sessionId: session.id
        };
    }

    /**
     * Generate an AI study plan using the Engine
     */
    static async generateStudyPlan(userId, requestData) {
        try {
            // requestData should match the engine's PlanGenerateRequest schema
            const response = await engineClient.post('/generate-plan', requestData);
            return response.data;
        } catch (error) {
            console.error("Engine failed to generate study plan:", error?.response?.data || error);
            throw new Error('Failed to generate study plan from AI Engine');
        }
    }

    /**
     * Activate a generated study plan
     */
    static async activateStudyPlan(userId, planData) {
        // Here we can save the sessions to DB or update existing goals.
        // For simplicity we'll just return a success payload and acknowledge activation.
        return { success: true, plan: planData };
    }

    // Helper methods
    static validateGoalData(goalData) {
        const { title, goalType, goalPeriod, targetValue } = goalData;

        if (!title || title.trim().length < 3) {
            const error = new Error('Goal title must be at least 3 characters');
            error.code = 'INVALID_TITLE';
            throw error;
        }

        if (!['study_time', 'material_completion', 'quiz_completion', 'exam_score'].includes(goalType)) {
            const error = new Error('Invalid goal type');
            error.code = 'INVALID_GOAL_TYPE';
            throw error;
        }

        if (!['daily', 'weekly', 'monthly'].includes(goalPeriod)) {
            const error = new Error('Invalid goal period');
            error.code = 'INVALID_GOAL_PERIOD';
            throw error;
        }

        if (!targetValue || targetValue < 1 || targetValue > 10000) {
            const error = new Error('Target value must be between 1 and 10000');
            error.code = 'INVALID_TARGET';
            throw error;
        }

        // Validate reminder days if provided
        if (goalData.reminderDays) {
            if (!Array.isArray(goalData.reminderDays) || 
                !goalData.reminderDays.every(d => d >= 1 && d <= 7)) {
                const error = new Error('Reminder days must be an array of numbers 1-7');
                error.code = 'INVALID_REMINDER_DAYS';
                throw error;
            }
        }
    }

    static formatGoalResponse(goal) {
        if (!goal) return null;

        return {
            id: goal.id,
            userId: goal.user_id,
            subjectId: goal.subject_id,
            subjectName: goal.subject_name,
            title: goal.title,
            description: goal.description,
            goalType: goal.goal_type,
            goalPeriod: goal.goal_period,
            status: goal.status,
            targetValue: goal.target_value,
            targetScore: goal.target_score,
            currentValue: goal.current_value,
            completionPercentage: Math.min(100, parseInt(goal.completion_percentage || 0)),
            streakCount: goal.streak_count,
            longestStreak: goal.longest_streak,
            reminderTime: goal.reminder_time,
            reminderDays: goal.reminder_days,
            startDate: goal.start_date,
            endDate: goal.end_date,
            completedAt: goal.completed_at,
            createdAt: goal.created_at,
            updatedAt: goal.updated_at
        };
    }
}

export default GoalService;
