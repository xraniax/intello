import { query } from '../utils/config/db.js';

/**
 * Planner Repository
 * Handles all database operations for the Planner module.
 */
class PlannerRepository {
    // --- Goals ---

    static async createGoal(client, userId, goalData) {
        const { title, description, subjectId, startDate, endDate, priority } = goalData;
        const db = client || { query };
        const result = await db.query(
            `INSERT INTO planner_goals 
            (user_id, subject_id, title, description, start_date, end_date, priority)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [userId, subjectId, title, description, startDate || new Date(), endDate, priority || 'MEDIUM']
        );
        return result.rows[0];
    }

    static async getGoalById(userId, goalId) {
        const result = await query(
            'SELECT * FROM planner_goals WHERE id = $1 AND user_id = $2',
            [goalId, userId]
        );
        return result.rows[0];
    }

    static async getUserGoals(userId, filters = {}) {
        const { status, subjectId } = filters;
        let sql = 'SELECT * FROM planner_goals WHERE user_id = $1';
        const params = [userId];
        
        if (status) {
            params.push(status);
            sql += ` AND status = $${params.length}`;
        }
        if (subjectId) {
            params.push(subjectId);
            sql += ` AND subject_id = $${params.length}`;
        }
        
        sql += ' ORDER BY created_at DESC';
        const result = await query(sql, params);
        return result.rows;
    }

    // --- Milestones ---

    static async createMilestone(client, goalId, milestoneData) {
        const { title, description, dueDate } = milestoneData;
        const db = client || { query };
        const result = await db.query(
            `INSERT INTO planner_milestones (goal_id, title, description, due_date)
            VALUES ($1, $2, $3, $4)
            RETURNING *`,
            [goalId, title, description, dueDate]
        );
        return result.rows[0];
    }

    static async getMilestonesByGoalId(goalId) {
        const result = await query(
            'SELECT * FROM planner_milestones WHERE goal_id = $1 ORDER BY due_date ASC',
            [goalId]
        );
        return result.rows;
    }

    // --- Tasks ---

    static async createTask(userId, taskData) {
        const { title, description, goalId, milestoneId, dueDate, priority } = taskData;
        const result = await query(
            `INSERT INTO planner_tasks 
            (user_id, goal_id, milestone_id, title, description, due_date, priority)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [userId, goalId, milestoneId, title, description, dueDate, priority || 'MEDIUM']
        );
        return result.rows[0];
    }

    static async getUserTasks(userId, filters = {}) {
        const { status, goalId } = filters;
        let sql = 'SELECT * FROM planner_tasks WHERE user_id = $1';
        const params = [userId];
        
        if (status) {
            params.push(status);
            sql += ` AND status = $${params.length}`;
        }
        if (goalId) {
            params.push(goalId);
            sql += ` AND goal_id = $${params.length}`;
        }
        
        sql += ' ORDER BY due_date ASC, created_at DESC';
        const result = await query(sql, params);
        return result.rows;
    }

    // --- Habits ---

    static async createHabit(userId, habitData) {
        const { title, description, frequency, targetCount } = habitData;
        const result = await query(
            `INSERT INTO planner_habits (user_id, title, description, frequency, target_count)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *`,
            [userId, title, description, frequency || 'DAILY', targetCount || 1]
        );
        return result.rows[0];
    }

    static async getUserHabits(userId) {
        const result = await query(
            'SELECT * FROM planner_habits WHERE user_id = $1 AND status != $2 ORDER BY created_at DESC',
            [userId, 'ARCHIVED']
        );
        return result.rows;
    }

    // --- Schedule Blocks ---

    static async createScheduleBlock(userId, blockData) {
        const { title, startTime, endTime, dayOfWeek, blockDate, color } = blockData;
        const result = await query(
            `INSERT INTO planner_schedule_blocks 
            (user_id, title, start_time, end_time, day_of_week, block_date, color)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [userId, title, startTime, endTime, dayOfWeek, blockDate, color || '#3b82f6']
        );
        return result.rows[0];
    }

    static async getUserScheduleBlocks(userId) {
        const result = await query(
            'SELECT * FROM planner_schedule_blocks WHERE user_id = $1 ORDER BY start_time ASC',
            [userId]
        );
        return result.rows;
    }

    // --- Preferences ---

    static async getPreferences(userId) {
        const result = await query(
            'SELECT * FROM user_productivity_preferences WHERE user_id = $1',
            [userId]
        );
        return result.rows[0];
    }

    static async updatePreferences(userId, prefsData) {
        const { focusModeDuration, breakDuration, activeHoursStart, activeHoursEnd } = prefsData;
        const result = await query(
            `INSERT INTO user_productivity_preferences 
            (user_id, focus_mode_duration, break_duration, active_hours_start, active_hours_end)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id) DO UPDATE SET
                focus_mode_duration = EXCLUDED.focus_mode_duration,
                break_duration = EXCLUDED.break_duration,
                active_hours_start = EXCLUDED.active_hours_start,
                active_hours_end = EXCLUDED.active_hours_end,
                updated_at = NOW()
            RETURNING *`,
            [userId, focusModeDuration, breakDuration, activeHoursStart, activeHoursEnd]
        );
        return result.rows[0];
    }
}

export default PlannerRepository;
