import { query } from '../utils/config/db.js';
import { FAILED } from '../constants/status.enum.js';

class File {
    /**
     * Track a new file upload linked to a material.
     */
    static async create(userId, subjectId, materialId, filename, originalName, mimeType, sizeBytes, path) {
        const result = await query(
            `INSERT INTO files (user_id, subject_id, material_id, filename, original_name, mime_type, size_bytes, path)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [userId, subjectId, materialId, filename, originalName, mimeType, sizeBytes, path]
        );
        return result.rows[0];
    }

    /**
     * Find a file by ID.
     */
    static async findById(id) {
        const result = await query('SELECT * FROM files WHERE id = $1', [id]);
        return result.rows[0];
    }

    /**
     * Find a file by its associated material ID.
     */
    static async findByMaterialId(materialId) {
        const result = await query('SELECT * FROM files WHERE material_id = $1', [materialId]);
        return result.rows[0];
    }

    /**
     * Find all files for an admin (with user and subject details).
     */
    static async findAll(filters = {}) {
        const { sortBy = 'created_at', order = 'DESC', page = 1, limit = 1000 } = filters;

        let sql = `
            SELECT f.*, u.name as user_name, u.email as user_email, s.name as subject_name
            FROM files f
            JOIN users u ON f.user_id = u.id
            LEFT JOIN subjects s ON f.subject_id = s.id
            WHERE 1=1
        `;
        const params = [];
        let idx = 1;

        if (filters.userId) {
            sql += ` AND (f.user_id::text ILIKE '%' || $${idx} || '%' OR u.email ILIKE '%' || $${idx} || '%' OR u.name ILIKE '%' || $${idx} || '%')`;
            params.push(filters.userId);
            idx++;
        }
        if (filters.subjectId) {
            sql += ` AND (f.subject_id::text ILIKE '%' || $${idx} || '%' OR s.name ILIKE '%' || $${idx} || '%')`;
            params.push(filters.subjectId);
            idx++;
        }
        if (filters.minSizeMb) {
            sql += ` AND f.size_bytes >= $${idx}`;
            params.push(filters.minSizeMb * 1024 * 1024);
            idx++;
        }
        if (filters.mimeType) {
            sql += ` AND f.mime_type = $${idx}`;
            params.push(filters.mimeType);
            idx++;
        }

        const validSortColumns = ['name', 'filename', 'original_name', 'size_bytes', 'created_at', 'size'];
        let sortColumn = 'f.created_at';
        if (validSortColumns.includes(sortBy)) {
             if (sortBy === 'name') sortColumn = 'f.original_name';
             else if (sortBy === 'size') sortColumn = 'f.size_bytes';
             else sortColumn = `f.${sortBy}`;
        }
        const sortDirection = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        const offset = (Math.max(1, page) - 1) * limit;

        sql += ` ORDER BY ${sortColumn} ${sortDirection} LIMIT $${idx} OFFSET $${idx + 1}`;
        params.push(limit, offset);

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Delete file record.
     */
    static async delete(id) {
        const result = await query('DELETE FROM files WHERE id = $1 RETURNING *', [id]);
        return result.rows[0];
    }

    /**
     * Find all files belonging to a user.
     */
    static async findByUserId(userId) {
        const result = await query('SELECT * FROM files WHERE user_id = $1', [userId]);
        return result.rows;
    }

    /**
     * Get total storage usage for a user.
     * Excludes files linked to FAILED materials.
     */
    static async getUserStorageUsage(userId) {
        const result = await query(
            `SELECT COALESCE(SUM(f.size_bytes), 0)::bigint as usage_bytes 
             FROM files f
             LEFT JOIN materials m ON f.material_id = m.id
             WHERE f.user_id = $1 AND (m.status IS NULL OR UPPER(m.status) != $2)`,
            [userId, FAILED]
        );
        return result.rows[0].usage_bytes;
    }
}

export default File;
