import { query } from '../utils/config/db.js';
import { COMPLETED, FAILED, PROCESSING, normalizeStatus } from '../constants/status.enum.js';
import { enforceGenerationConstraintsForPersistence } from '../utils/generationConstraints.js';

class Material {
    /**
     * Store new material linked to the authenticated user and their chosen subject.
     */
    static async create(userId, subjectId, title, content, type, status = null, jobId = null) {
        // Default status logic if not explicitly provided
        const finalStatus = status || (jobId ? PROCESSING : COMPLETED);
        
        const result = await query(
            'INSERT INTO materials (user_id, subject_id, title, content, type, job_id, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [userId, subjectId, title, content, type, jobId, normalizeStatus(finalStatus)]
        );
        return result.rows[0];
    }

    /**
     * Update material with AI engine results and mark as completed.
     * user_id is enforced in the WHERE clause to prevent IDOR (Insecure Direct Object Reference).
     */
    static async updateAIResult(materialId, userId, aiResult, constraints = null) {
        const finalResult = enforceGenerationConstraintsForPersistence(aiResult, constraints || {});
        const result = await query(
            'UPDATE materials SET ai_generated_content = $2, processed_at = NOW(), completed_at = NOW(), status = $4 WHERE id = $1 AND user_id = $3 AND deleted_at IS NULL RETURNING *',
            [materialId, finalResult, userId, COMPLETED]
        );
        return result.rows[0];
    }

    /**
     * Update only the content of a material.
     */
    static async updateContent(materialId, userId, content) {
        const result = await query(
            'UPDATE materials SET content = $2 WHERE id = $1 AND user_id = $3 AND deleted_at IS NULL RETURNING *',
            [materialId, content, userId]
        );
        return result.rows[0];
    }

    /**
     * Update only the status of a material with automatic timestamp management.
     * user_id enforced to prevent IDOR.
     */
    static async updateStatus(materialId, userId, status, jobId = null) {
        const normalizedStatus = normalizeStatus(status);
        
        // Auto-timestamps:
        // - PROCESSING sets started_at
        // - COMPLETED/FAILED sets completed_at
        const startedAtSql = normalizedStatus === PROCESSING ? ', started_at = COALESCE(started_at, NOW())' : '';
        const completedAtSql = (normalizedStatus === COMPLETED || normalizedStatus === FAILED) ? ', completed_at = NOW()' : '';

        const sql = jobId 
            ? `UPDATE materials SET status = $2, job_id = $4 ${startedAtSql} ${completedAtSql} WHERE id = $1 AND user_id = $3 AND deleted_at IS NULL RETURNING *`
            : `UPDATE materials SET status = $2 ${startedAtSql} ${completedAtSql} WHERE id = $1 AND user_id = $3 AND deleted_at IS NULL RETURNING *`;
        
        const params = jobId ? [materialId, normalizedStatus, userId, jobId] : [materialId, normalizedStatus, userId];
        const result = await query(sql, params);
        return result.rows[0];
    }

    /**
     * Update job progress details.
     */
    static async updateJobProgress(materialId, userId, status, startedAt = null, completedAt = null) {
        const sql = `
            UPDATE materials 
            SET status = $2, 
                started_at = COALESCE($4, started_at), 
                completed_at = COALESCE($5, completed_at)
            WHERE id = $1 AND user_id = $3 AND deleted_at IS NULL
            RETURNING *`;
        const result = await query(sql, [materialId, status, userId, startedAt, completedAt]);
        return result.rows[0];
    }

    /**
     * Record a job failure.
     */
    static async recordFailure(materialId, userId, errorMessage) {
        const result = await query(
            'UPDATE materials SET status = $4, error_message = $2, completed_at = NOW() WHERE id = $1 AND user_id = $3 AND deleted_at IS NULL RETURNING *',
            [materialId, errorMessage, userId, FAILED]
        );
        return result.rows[0];
    }

    /**
     * Get count of all non-deleted materials for a user
     */
    static async getCountByUserId(userId) {
        const result = await query(
            `SELECT COUNT(*)::int as count 
             FROM materials 
             WHERE user_id = $1 AND deleted_at IS NULL`,
            [userId]
        );
        return result.rows[0].count;
    }

    /**
     * Get all materials for a specific user with subject info
     */
    static async findByUserId(userId, pagination = null) {
        let sql = `
            SELECT m.*, s.name as subject_name,
            f.path as file_path,
            json_build_object('id', s.id, 'name', s.name) as subject
            FROM materials m
            LEFT JOIN subjects s ON m.subject_id = s.id
            LEFT JOIN files f ON f.material_id = m.id
            WHERE m.user_id = $1 AND m.deleted_at IS NULL
            ORDER BY m.created_at DESC
        `;
        const params = [userId];

        if (pagination) {
            const { limit, offset } = pagination;
            sql += ` LIMIT $2 OFFSET $3`;
            params.push(limit, offset);
        }

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Fetch a single material by ID (Security: enforce user_id)
     */
    static async findById(id, userId) {
        const result = await query(
            `SELECT m.*, s.name as subject_name,
            f.path as file_path,
            json_build_object('id', s.id, 'name', s.name) as subject
            FROM materials m
            LEFT JOIN subjects s ON m.subject_id = s.id
            LEFT JOIN files f ON f.material_id = m.id
            WHERE m.id = $1 AND m.user_id = $2 AND m.deleted_at IS NULL`,
            [id, userId]
        );
        return result.rows[0];
    }

    /**
     * Get materials by subject ID
     */
    static async findBySubjectId(subjectId, userId) {
        const result = await query(
            `SELECT m.*, f.path as file_path 
            FROM materials m 
            LEFT JOIN files f ON f.material_id = m.id 
            WHERE m.subject_id = $1 AND m.user_id = $2 AND m.deleted_at IS NULL
            ORDER BY m.created_at DESC`,
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
        // Guard: only pass valid UUID strings to ANY($1) to prevent 'malformed array literal' errors
        const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const validIds = ids.filter(id => typeof id === 'string' && UUID_PATTERN.test(id));
        if (validIds.length === 0) return [];
        const result = await query(
            `SELECT m.*, f.path as file_path 
            FROM materials m 
            LEFT JOIN files f ON f.material_id = m.id 
            WHERE m.id = ANY($1) AND m.user_id = $2 AND m.deleted_at IS NULL
            ORDER BY m.created_at DESC`,
            [validIds, userId]
        );
        return result.rows;
    }

    /**
     * Find a material by title for a specific user and subject (for duplicate checks)
     */
    static async findByTitle(userId, subjectId, title) {
        const result = await query(
            'SELECT * FROM materials WHERE user_id = $1 AND subject_id = $2 AND LOWER(TRIM(title)) = LOWER(TRIM($3)) AND deleted_at IS NULL',
            [userId, subjectId, title]
        );
        return result.rows[0];
    }

    /**
     * Delete a material (Soft Delete).
     * user_id enforced for IDOR protection — users can only delete their own materials.
     */
    static async delete(id, userId) {
        const result = await query(
            'UPDATE materials SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *', 
            [id, userId]
        );
        return result.rowCount > 0;
    }

    /**
     * Soft-delete all active materials in a subject.
     */
    static async deleteBySubject(subjectId, userId) {
        const result = await query(
            'UPDATE materials SET deleted_at = NOW() WHERE subject_id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING id',
            [subjectId, userId]
        );
        return result.rows;
    }

    /**
     * Restore a soft-deleted material.
     */
    static async restore(id, userId) {
        const result = await query(
            'UPDATE materials SET deleted_at = NULL WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, userId]
        );
        return result.rowCount > 0;
    }

    /**
     * Restore all deleted materials for a subject.
     */
    static async restoreBySubject(subjectId, userId) {
        const result = await query(
            'UPDATE materials SET deleted_at = NULL WHERE subject_id = $1 AND user_id = $2 AND deleted_at IS NOT NULL RETURNING id',
            [subjectId, userId]
        );
        return result.rows;
    }

    /**
     * Permanently hard-delete a single material (must already be soft-deleted).
     */
    static async permanentDelete(id, userId) {
        const result = await query(
            'DELETE FROM materials WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL RETURNING *',
            [id, userId]
        );
        return result.rowCount > 0;
    }

    /**
     * Permanently hard-delete all soft-deleted materials in a subject.
     */
    static async permanentDeleteBySubject(subjectId, userId) {
        const result = await query(
            'DELETE FROM materials WHERE subject_id = $1 AND user_id = $2 AND deleted_at IS NOT NULL RETURNING id',
            [subjectId, userId]
        );
        return result.rows;
    }

    /**
     * Permanently hard-delete all soft-deleted materials for a user.
     * Returns the list of deleted rows so callers can clean up associated files.
     */
    static async emptyTrash(userId) {
        const result = await query(
            'DELETE FROM materials WHERE user_id = $1 AND deleted_at IS NOT NULL RETURNING id',
            [userId]
        );
        return result.rows; // [{ id }, ...]
    }

    /**
     * Get count of deleted materials for a user
     */
    static async getDeletedCount(userId) {
        const result = await query(
            `SELECT COUNT(*)::int as count 
             FROM materials 
             WHERE user_id = $1 AND deleted_at IS NOT NULL`,
            [userId]
        );
        return result.rows[0].count;
    }

    /**
     * Find all deleted materials for the user (Trash View).
     * Includes computed expires_at based on trash TTL.
     */
    static async findDeleted(userId, ttlDays = 30, pagination = null) {
        const days = String(Math.max(1, parseInt(ttlDays, 10)));
        let sql = `
            SELECT m.*, s.name as subject_name, f.path as file_path,
             (m.deleted_at + ($2 || ' days')::interval) AS expires_at
             FROM materials m
             LEFT JOIN subjects s ON m.subject_id = s.id
             LEFT JOIN files f ON f.material_id = m.id
             WHERE m.user_id = $1 AND m.deleted_at IS NOT NULL
             ORDER BY m.deleted_at DESC
        `;
        const params = [userId, days];

        if (pagination) {
            const { limit, offset } = pagination;
            sql += ` LIMIT $3 OFFSET $4`;
            params.push(limit, offset);
        }

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Find IDs of materials that have been in the trash longer than ttlDays.
     */
    static async findExpiredTrash(ttlDays = 30) {
        const days = String(Math.max(1, parseInt(ttlDays, 10)));
        const result = await query(
            `SELECT id FROM materials
             WHERE deleted_at IS NOT NULL
             AND deleted_at < NOW() - ($1 || ' days')::interval`,
            [days]
        );
        return result.rows; // [{ id }]
    }

    /**
     * Hard-delete all materials that have been in the trash longer than ttlDays.
     * Files records are cascade-deleted by Postgres FK — GC disk files first.
     */
    static async deleteExpiredTrash(ttlDays = 30) {
        const days = String(Math.max(1, parseInt(ttlDays, 10)));
        const result = await query(
            `DELETE FROM materials
             WHERE deleted_at IS NOT NULL
             AND deleted_at < NOW() - ($1 || ' days')::interval
             RETURNING id`,
            [days]
        );
        return result.rows.length;
    }

    /**
     * Update material metadata (e.g., title).
     * Enforces user_id for security.
     */
    static async updateById(id, userId, updates) {
        const allowedFields = ['title'];
        const fields = [];
        const values = [];
        let paramIdx = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = $${paramIdx}`);
                values.push(value);
                paramIdx++;
            }
        }

        if (fields.length === 0) return null;

        values.push(id, userId);
        const sql = `UPDATE materials SET ${fields.join(', ')} WHERE id = $${paramIdx} AND user_id = $${paramIdx + 1} AND deleted_at IS NULL RETURNING *`;
        const result = await query(sql, values);
        return result.rows[0];
    }
}

export default Material;

