import { query } from '../utils/config/db.js';

/**
 * Study Goal Model
 * Manages user study goals and progress tracking
 */
class Goal {
    /**
     * Create a new study goal
     */
    static async create(userId, goalData) {
        const {
            title,
            description,
            goalType = 'study_time',
            goalPeriod = 'weekly',
            targetValue,
            targetScore = null,
            subjectId = null,
            reminderTime = null,
            reminderDays = [1, 2, 3, 4, 5, 6, 7],
            startDate = new Date(),
            endDate = null
        } = goalData;

        const result = await query(
            `INSERT INTO study_goals 
             (user_id, subject_id, title, description, goal_type, goal_period, 
              target_value, target_score, reminder_time, reminder_days, start_date, end_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING *`,
            [
                userId, subjectId, title, description, goalType, goalPeriod,
                targetValue, targetScore, reminderTime, reminderDays,
                startDate, endDate
            ]
        );
        return result.rows[0];
    }

    /**
     * Find goal by ID (with user ownership check)
     */
    static async findById(id, userId) {
        const result = await query(
            `SELECT g.*, s.name as subject_name
             FROM study_goals g
             LEFT JOIN subjects s ON g.subject_id = s.id
             WHERE g.id = $1 AND g.user_id = $2`,
            [id, userId]
        );
        return result.rows[0];
    }

    /**
     * Get all goals for a user
     */
    static async findByUserId(userId, filters = {}) {
        const { status = null, subjectId = null, limit = 50, offset = 0 } = filters;
        
        let whereClause = 'WHERE g.user_id = $1';
        const params = [userId];
        let paramIndex = 2;

        if (status) {
            whereClause += ` AND g.status = $${paramIndex++}`;
            params.push(status);
        }

        if (subjectId) {
            whereClause += ` AND g.subject_id = $${paramIndex++}`;
            params.push(subjectId);
        }

        params.push(limit, offset);

        const result = await query(
            `SELECT g.*, s.name as subject_name,
                    CASE 
                        WHEN g.target_value > 0 
                        THEN ROUND((g.current_value::numeric / g.target_value) * 100)
                        ELSE 0 
                    END as completion_percentage
             FROM study_goals g
             LEFT JOIN subjects s ON g.subject_id = s.id
             ${whereClause}
             ORDER BY 
                CASE g.status 
                    WHEN 'active' THEN 1 
                    WHEN 'paused' THEN 2 
                    WHEN 'completed' THEN 3 
                    ELSE 4 
                END,
                g.created_at DESC
             LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
            params
        );
        return result.rows;
    }

    /**
     * Count goals for a user
     */
    static async countByUserId(userId, filters = {}) {
        const { status = null } = filters;
        
        let whereClause = 'WHERE user_id = $1';
        const params = [userId];
        let paramIndex = 2;

        if (status) {
            whereClause += ` AND status = $${paramIndex++}`;
            params.push(status);
        }

        const result = await query(
            `SELECT COUNT(*)::int as count FROM study_goals ${whereClause}`,
            params
        );
        return result.rows[0].count;
    }

    /**
     * Update a goal
     */
    static async update(id, userId, updates) {
        const allowedFields = [
            'title', 'description', 'goal_type', 'goal_period', 'status',
            'target_value', 'target_score', 'current_value', 'reminder_time',
            'reminder_days', 'start_date', 'end_date'
        ];

        const fields = [];
        const values = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                fields.push(`${this.toSnakeCase(key)} = $${paramIndex++}`);
                values.push(value);
            }
        }

        if (fields.length === 0) return null;

        values.push(id, userId);

        const result = await query(
            `UPDATE study_goals 
             SET ${fields.join(', ')}, updated_at = NOW()
             WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
             RETURNING *`,
            values
        );
        return result.rows[0];
    }

    /**
     * Delete a goal
     */
    static async delete(id, userId) {
        const result = await query(
            'DELETE FROM study_goals WHERE id = $1 AND user_id = $2 RETURNING id',
            [id, userId]
        );
        return result.rowCount > 0;
    }

    /**
     * Get active goals needing reminders
     */
    static async findGoalsNeedingReminders(currentTime, dayOfWeek) {
        const result = await query(
            `SELECT g.*, u.email, u.name as user_name
             FROM study_goals g
             JOIN users u ON g.user_id = u.id
             WHERE g.status = 'active'
             AND g.reminder_time IS NOT NULL
             AND $1::time >= g.reminder_time
             AND $1::time < g.reminder_time + INTERVAL '1 hour'
             AND $2 = ANY(g.reminder_days)
             AND (g.last_reminder_sent IS NULL OR g.last_reminder_sent < CURRENT_DATE)`,
            [currentTime, dayOfWeek]
        );
        return result.rows;
    }

    /**
     * Mark reminder as sent
     */
    static async markReminderSent(id) {
        await query(
            'UPDATE study_goals SET last_reminder_sent = NOW() WHERE id = $1',
            [id]
        );
    }

    /**
     * Get goal statistics for a user
     */
    static async getStats(userId) {
        const result = await query(
            `SELECT 
                COUNT(*) FILTER (WHERE status = 'active')::int as active_goals,
                COUNT(*) FILTER (WHERE status = 'completed')::int as completed_goals,
                COUNT(*)::int as total_goals,
                COALESCE(AVG(
                    CASE WHEN target_value > 0 
                    THEN (current_value::numeric / target_value) * 100 
                    END
                ) FILTER (WHERE status = 'active'), 0)::numeric(5,2) as avg_completion,
                MAX(streak_count) as current_streak,
                MAX(longest_streak) as best_streak
             FROM study_goals
             WHERE user_id = $1`,
            [userId]
        );
        return result.rows[0];
    }

    /**
     * Get weekly progress for dashboard
     */
    static async getWeeklyProgress(userId) {
        const result = await query(
            `SELECT 
                g.id,
                g.title,
                g.goal_type,
                g.target_value,
                g.current_value,
                g.goal_period,
                CASE 
                    WHEN g.target_value > 0 
                    THEN ROUND((g.current_value::numeric / g.target_value) * 100)
                    ELSE 0 
                END as percentage,
                g.streak_count,
                s.name as subject_name
             FROM study_goals g
             LEFT JOIN subjects s ON g.subject_id = s.id
             WHERE g.user_id = $1
             AND g.status = 'active'
             AND (g.goal_period = 'weekly' OR g.goal_period = 'daily')
             ORDER BY g.created_at DESC
             LIMIT 5`,
            [userId]
        );
        return result.rows;
    }

    // Helper: convert camelCase to snake_case
    static toSnakeCase(str) {
        return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    }
}

/**
 * Study Session Model
 * Tracks actual study sessions
 */
export class StudySession {
    /**
     * Start a new study session
     */
    static async start(userId, sessionData) {
        const {
            goalId = null,
            subjectId = null,
            materialId = null,
            sessionType = 'study'
        } = sessionData;

        const result = await query(
            `INSERT INTO study_sessions 
             (user_id, goal_id, subject_id, material_id, session_type, started_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             RETURNING *`,
            [userId, goalId, subjectId, materialId, sessionType]
        );
        return result.rows[0];
    }

    /**
     * End a study session
     */
    static async end(sessionId, userId, sessionData) {
        const {
            notes = null,
            materialsViewed = 0,
            questionsAnswered = 0
        } = sessionData;

        const result = await query(
            `UPDATE study_sessions 
             SET ended_at = NOW(),
                 duration_minutes = EXTRACT(EPOCH FROM (NOW() - started_at)) / 60,
                 notes_taken = $3,
                 materials_viewed = $4,
                 questions_answered = $5
             WHERE id = $1 AND user_id = $2
             RETURNING *`,
            [sessionId, userId, notes, materialsViewed, questionsAnswered]
        );
        return result.rows[0];
    }

    /**
     * Get sessions for a user
     */
    static async findByUserId(userId, filters = {}) {
        const { fromDate = null, toDate = null, limit = 50, offset = 0 } = filters;
        
        let whereClause = 'WHERE s.user_id = $1';
        const params = [userId];
        let paramIndex = 2;

        if (fromDate) {
            whereClause += ` AND DATE(s.started_at) >= $${paramIndex++}`;
            params.push(fromDate);
        }

        if (toDate) {
            whereClause += ` AND DATE(s.started_at) <= $${paramIndex++}`;
            params.push(toDate);
        }

        params.push(limit, offset);

        const result = await query(
            `SELECT s.*, g.title as goal_title, subj.name as subject_name
             FROM study_sessions s
             LEFT JOIN study_goals g ON s.goal_id = g.id
             LEFT JOIN subjects subj ON s.subject_id = subj.id
             ${whereClause}
             ORDER BY s.started_at DESC
             LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
            params
        );
        return result.rows;
    }

    /**
     * Get total study time for a date range
     */
    static async getTotalStudyTime(userId, fromDate, toDate) {
        const result = await query(
            `SELECT COALESCE(SUM(duration_minutes), 0)::int as total_minutes
             FROM study_sessions
             WHERE user_id = $1
             AND DATE(started_at) BETWEEN $2 AND $3`,
            [userId, fromDate, toDate]
        );
        return result.rows[0].total_minutes;
    }

    /**
     * Get daily study time for the past N days
     */
    static async getDailyStudyTime(userId, days = 7) {
        const result = await query(
            `SELECT 
                DATE(started_at) as date,
                COALESCE(SUM(duration_minutes), 0)::int as minutes
             FROM study_sessions
             WHERE user_id = $1
             AND started_at >= CURRENT_DATE - INTERVAL '${days} days'
             GROUP BY DATE(started_at)
             ORDER BY date DESC`,
            [userId]
        );
        return result.rows;
    }

    /**
     * Get study streak (consecutive days with study sessions)
     */
    static async getStudyStreak(userId) {
        const result = await query(
            `WITH RECURSIVE dates AS (
                SELECT CURRENT_DATE as date
                UNION ALL
                SELECT date - 1
                FROM dates
                WHERE date > CURRENT_DATE - 365
            ),
            study_days AS (
                SELECT DISTINCT DATE(started_at) as study_date
                FROM study_sessions
                WHERE user_id = $1
            )
            SELECT COUNT(*)::int as streak
            FROM dates d
            WHERE d.date <= CURRENT_DATE
            AND d.date IN (SELECT study_date FROM study_days)
            AND NOT EXISTS (
                SELECT 1 FROM dates d2
                WHERE d2.date < d.date
                AND d2.date > COALESCE(
                    (SELECT MAX(study_date) FROM study_days WHERE study_date < d.date),
                    d.date - 1
                )
                AND d2.date NOT IN (SELECT study_date FROM study_days)
            )`,
            [userId]
        );
        return result.rows[0]?.streak || 0;
    }
}

export default Goal;
