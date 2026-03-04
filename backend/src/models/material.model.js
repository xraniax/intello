import { query } from '../config/db.js';

class Material {
    /**
     * Store new material and AI processing intention
     */
    static async create(userId, title, content, type) {
        const result = await query(
            'INSERT INTO materials (user_id, title, content, type) VALUES ($1, $2, $3, $4) RETURNING *',
            [userId, title, content, type]
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
     * Get all materials for a specific user
     */
    static async findByUserId(userId) {
        const result = await query(
            'SELECT * FROM materials WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        return result.rows;
    }

    /**
     * Fetch a single material by ID
     */
    static async findById(id) {
        const result = await query('SELECT * FROM materials WHERE id = $1', [id]);
        return result.rows[0];
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
