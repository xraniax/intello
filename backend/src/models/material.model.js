import { query } from '../config/db.js';

class Material {
    /**
     * Store new material and AI processing intention
     */
    static async create(userId, subjectId, title, content, type) {
        const result = await query(
            'INSERT INTO materials (user_id, subject_id, title, content, type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [userId, subjectId, title, content, type]
        );
        return result.rows[0];
    }

    /**
     * Update material with results from AI engine
     */
    static async updateAIResult(materialId, aiResult) {
        const result = await query(
            'UPDATE materials SET ai_generated_content = $2, processed_at = NOW() WHERE id = $1 RETURNING *',
            [materialId, aiResult]
        );
        return result.rows[0];
    }

    /**
     * Get all materials for a specific user with subject info
     */
    static async findByUserId(userId) {
        const result = await query(
            `SELECT m.*, s.name as subject_name,
            json_build_object('id', s.id, 'name', s.name) as subject
            FROM materials m
            LEFT JOIN subjects s ON m.subject_id = s.id
            WHERE m.user_id = $1 
            ORDER BY m.created_at DESC`,
            [userId]
        );
        return result.rows;
    }

    /**
     * Fetch a single material by ID (Security: check user_id if needed in service)
     */
    static async findById(id) {
        const result = await query(
            `SELECT m.*, s.name as subject_name,
            json_build_object('id', s.id, 'name', s.name) as subject
            FROM materials m
            LEFT JOIN subjects s ON m.subject_id = s.id
            WHERE m.id = $1`,
            [id]
        );
        return result.rows[0];
    }

    /**
     * Get materials by subject ID
     */
    static async findBySubjectId(subjectId, userId) {
        const result = await query(
            'SELECT * FROM materials WHERE subject_id = $1 AND user_id = $2 ORDER BY created_at DESC',
            [subjectId, userId]
        );
        return result.rows;
    }

    /**
     * Find multiple materials by IDs for context grounding
     */
    static async findByIds(ids, userId) {
        if (!ids || ids.length === 0) return [];
        const result = await query(
            'SELECT * FROM materials WHERE id = ANY($1) AND user_id = $2 ORDER BY created_at DESC',
            [ids, userId]
        );
        return result.rows;
    }

    /**
     * Remove a material
     */
    static async delete(id) {
        await query('DELETE FROM materials WHERE id = $1', [id]);
        return true;
    }
}

export default Material;
