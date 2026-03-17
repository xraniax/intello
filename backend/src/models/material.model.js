import { query } from '../utils/config/db.js';

class Material {
    /**
     * Store new material linked to the authenticated user and their chosen subject.
     */
    static async create(userId, subjectId, title, content, type) {
        const result = await query(
            'INSERT INTO materials (user_id, subject_id, title, content, type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [userId, subjectId, title, content, type]
        );
        return result.rows[0];
    }

    /**
     * Update material with AI engine results and mark as completed.
     * user_id is enforced in the WHERE clause to prevent IDOR (Insecure Direct Object Reference).
     */
    static async updateAIResult(materialId, userId, aiResult) {
        const result = await query(
            'UPDATE materials SET ai_generated_content = $2, processed_at = NOW(), status = \'completed\' WHERE id = $1 AND user_id = $3 RETURNING *',
            [materialId, aiResult, userId]
        );
        return result.rows[0];
    }

    /**
     * Update only the content of a material.
     */
    static async updateContent(materialId, userId, content) {
        const result = await query(
            'UPDATE materials SET content = $2 WHERE id = $1 AND user_id = $3 RETURNING *',
            [materialId, content, userId]
        );
        return result.rows[0];
    }

    /**
     * Update only the status of a material (for failure handling).
     * user_id enforced to prevent IDOR.
     */
    static async updateStatus(materialId, userId, status) {
        const result = await query(
            'UPDATE materials SET status = $2 WHERE id = $1 AND user_id = $3 RETURNING *',
            [materialId, status, userId]
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
     * Fetch a single material by ID (Security: enforce user_id)
     */
    static async findById(id, userId) {
        const result = await query(
            `SELECT m.*, s.name as subject_name,
            json_build_object('id', s.id, 'name', s.name) as subject
            FROM materials m
            LEFT JOIN subjects s ON m.subject_id = s.id
            WHERE m.id = $1 AND m.user_id = $2`,
            [id, userId]
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
     * Find multiple materials by IDs for context grounding.
     * Uses PostgreSQL's ANY($1) operator for an efficient single-query batch lookup.
     * user_id scoping prevents accessing other users' materials.
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
     * Remove a material.
     * user_id enforced for IDOR protection — users can only delete their own materials.
     */
    static async delete(id, userId) {
        const result = await query('DELETE FROM materials WHERE id = $1 AND user_id = $2 RETURNING *', [id, userId]);
        return result.rowCount > 0;
    }
}

export default Material;
