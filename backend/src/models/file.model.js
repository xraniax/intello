import { query } from '../utils/config/db.js';

class File {
    /**
     * Track a new file upload.
     */
    static async create(userId, subjectId, filename, originalName, mimeType, sizeBytes, path) {
        const result = await query(
            `INSERT INTO files (user_id, subject_id, filename, original_name, mime_type, size_bytes, path)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [userId, subjectId, filename, originalName, mimeType, sizeBytes, path]
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
     * Find all files for an admin (with user and subject details).
     */
    static async findAll(filters = {}) {
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

        sql += ` ORDER BY f.created_at DESC`;

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
     * Get total storage usage for a user.
     */
    static async getUserStorageUsage(userId) {
        const result = await query(
            'SELECT COALESCE(SUM(size_bytes), 0)::bigint as usage_bytes FROM files WHERE user_id = $1',
            [userId]
        );
        return result.rows[0].usage_bytes;
    }
}

export default File;
