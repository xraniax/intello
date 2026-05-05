import { query } from '../utils/config/db.js';

const DATA_MISSING_DELETED_AT = /deleted_at|column "deleted_at" does not exist|column s\.deleted_at does not exist/i;

async function trySubjectQuery(execFn, fallbackFn) {
    try {
        return await execFn();
    } catch (err) {
        if (err && err.message && DATA_MISSING_DELETED_AT.test(err.message)) {
            if (fallbackFn) return await fallbackFn();
            return null;
        }
        throw err;
    }
}

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
        return trySubjectQuery(
            async () => {
                const result = await query(
                    'SELECT *, last_activity_at AS "lastActivityAt" FROM subjects WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
                    [id, userId]
                );
                return result.rows[0];
            },
            async () => {
                const result = await query(
                    'SELECT *, last_activity_at AS "lastActivityAt" FROM subjects WHERE id = $1 AND user_id = $2',
                    [id, userId]
                );
                return result.rows[0];
            }
        );
    }

    /**
     * Find by name for a user (useful for auto-creation)
     */
    static async findByName(userId, name) {
        return trySubjectQuery(
            async () => {
                const result = await query(
                    'SELECT *, last_activity_at AS "lastActivityAt" FROM subjects WHERE user_id = $1 AND name = $2 AND deleted_at IS NULL LIMIT 1',
                    [userId, name]
                );
                return result.rows[0];
            },
            async () => {
                const result = await query(
                    'SELECT *, last_activity_at AS "lastActivityAt" FROM subjects WHERE user_id = $1 AND name = $2 LIMIT 1',
                    [userId, name]
                );
                return result.rows[0];
            }
        );
    }

    /**
     * Get total count of subjects for a user
     */
    static async getCountByUserId(userId) {
        return trySubjectQuery(
            async () => {
                const result = await query(
                    'SELECT COUNT(*)::int as count FROM subjects WHERE user_id = $1 AND deleted_at IS NULL',
                    [userId]
                );
                return result.rows[0].count;
            },
            async () => {
                const result = await query(
                    'SELECT COUNT(*)::int as count FROM subjects WHERE user_id = $1',
                    [userId]
                );
                return result.rows[0].count;
            }
        );
    }

    /**
     * Fetch all subjects for a user with material counts
     */
    static async findAllByUserId(userId, pagination = null) {
        const buildQuery = (withDeletedFilter) => {
            let sql = `
                SELECT s.*, s.last_activity_at AS "lastActivityAt", count(m.id)::int as material_count
                 FROM subjects s
                 LEFT JOIN materials m ON s.id = m.subject_id AND m.deleted_at IS NULL
                 WHERE s.user_id = $1${withDeletedFilter ? ' AND s.deleted_at IS NULL' : ''}
                 GROUP BY s.id
                 ORDER BY s.last_activity_at DESC
            `;
            const params = [userId];
            if (pagination) {
                const { limit, offset } = pagination;
                sql += ` LIMIT $2 OFFSET $3`;
                params.push(limit, offset);
            }
            return { sql, params };
        };

        return trySubjectQuery(
            async () => {
                const { sql, params } = buildQuery(true);
                const result = await query(sql, params);
                return result.rows;
            },
            async () => {
                const { sql, params } = buildQuery(false);
                const result = await query(sql, params);
                return result.rows;
            }
        );
    }

    /**
     * Update subject name and description
     */
    static async update(id, userId, name, description) {
        const result = await query(
            'UPDATE subjects SET name = $1, description = $2, last_activity_at = NOW(), updated_at = NOW() WHERE id = $3 AND user_id = $4 RETURNING *, last_activity_at AS "lastActivityAt"',
            [name, description, id, userId]
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
     * Soft delete subject and mark it as trashed.
     */
    static async delete(id, userId) {
        return trySubjectQuery(
            async () => {
                const result = await query(
                    'UPDATE subjects SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING *',
                    [id, userId]
                );
                return result.rowCount > 0;
            },
            async () => {
                const result = await query(
                    'DELETE FROM subjects WHERE id = $1 AND user_id = $2 RETURNING *',
                    [id, userId]
                );
                return result.rowCount > 0;
            }
        );
    }

    /**
     * Restore a soft-deleted subject
     */
    static async restore(id, userId) {
        return trySubjectQuery(
            async () => {
                const result = await query(
                    'UPDATE subjects SET deleted_at = NULL, updated_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL RETURNING *',
                    [id, userId]
                );
                return result.rowCount > 0;
            },
            async () => false
        );
    }

    /**
     * Permanently delete a soft-deleted subject
     */
    static async permanentDelete(id, userId) {
        return trySubjectQuery(
            async () => {
                const result = await query(
                    'DELETE FROM subjects WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL RETURNING *',
                    [id, userId]
                );
                return result.rowCount > 0;
            },
            async () => false
        );
    }

    static async getDeletedCount(userId) {
        return trySubjectQuery(
            async () => {
                const result = await query(
                    'SELECT COUNT(*)::int as count FROM subjects WHERE user_id = $1 AND deleted_at IS NOT NULL',
                    [userId]
                );
                return result.rows[0].count;
            },
            async () => 0
        );
    }

    static async findDeleted(userId, ttlDays = 30, pagination = null) {
        const days = String(Math.max(1, parseInt(ttlDays, 10)));
        const buildQuery = (withDeletedFilter) => {
            let sql = `
                SELECT s.*, s.deleted_at + ($2 || ' days')::interval AS expires_at, count(m.id)::int as material_count
                 FROM subjects s
                 LEFT JOIN materials m ON s.id = m.subject_id
                 WHERE s.user_id = $1${withDeletedFilter ? ' AND s.deleted_at IS NOT NULL' : ''}
                 GROUP BY s.id
                 ORDER BY s.deleted_at DESC
            `;
            const params = [userId, days];
            if (pagination) {
                const { limit, offset } = pagination;
                sql += ` LIMIT $3 OFFSET $4`;
                params.push(limit, offset);
            }
            return { sql, params };
        };

        return trySubjectQuery(
            async () => {
                const { sql, params } = buildQuery(true);
                const result = await query(sql, params);
                return result.rows;
            },
            async () => []
        );
    }
}

export default Subject;
