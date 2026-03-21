import { query } from '../utils/config/db.js';

class Subject {
    /**
     * Create a new academic subject
     */
    static async create(userId, name, description) {
        const result = await query(
            'INSERT INTO subjects (user_id, name, description, last_activity_at) VALUES ($1, $2, $3, NOW()) RETURNING *, last_activity_at AS "lastActivityAt"',
            [userId, name, description]
        );
        return result.rows[0];
    }

    /**
     * Get subject by ID and User ID (Security)
     */
    static async findById(id, userId) {
        const result = await query(
            'SELECT *, last_activity_at AS "lastActivityAt" FROM subjects WHERE id = $1 AND user_id = $2', 
            [id, userId]
        );
        return result.rows[0];
    }

    /**
     * Find by name for a user (useful for auto-creation)
     */
    static async findByName(userId, name) {
        const result = await query(
            'SELECT *, last_activity_at AS "lastActivityAt" FROM subjects WHERE user_id = $1 AND name = $2 LIMIT 1', 
            [userId, name]
        );
        return result.rows[0];
    }

    /**
     * Fetch all subjects for a user with material counts
     */
    static async findAllByUserId(userId) {
        const result = await query(
            `SELECT s.*, s.last_activity_at AS "lastActivityAt", count(m.id)::int as material_count 
             FROM subjects s 
             LEFT JOIN materials m ON s.id = m.subject_id 
             WHERE s.user_id = $1 
             GROUP BY s.id 
             ORDER BY s.last_activity_at DESC`,
            [userId]
        );
        return result.rows;
    }

    /**
     * Update subject name
     */
    static async update(id, userId, name) {
        const result = await query(
            'UPDATE subjects SET name = $1, last_activity_at = NOW(), updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *, last_activity_at AS "lastActivityAt"',
            [name, id, userId]
        );
        return result.rows[0];
    }

    /**
     * Update the last activity timestamp for a subject
     */
    static async touch(id, userId) {
        const result = await query(
            'UPDATE subjects SET last_activity_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *, last_activity_at AS "lastActivityAt"',
            [id, userId]
        );
        return result.rows[0];
    }

    /**
     * Delete subject (Cascades to materials based on DB constraint)
     */
    static async delete(id, userId) {
        const result = await query('DELETE FROM subjects WHERE id = $1 AND user_id = $2 RETURNING *', [id, userId]);
        return result.rowCount > 0;
    }
}

export default Subject;
