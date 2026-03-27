import { query } from '../utils/config/db.js';

class Log {
    /**
     * Create a new activity log.
     * @param {string} userId - ID of the user performing the action (can be null for system actions).
     * @param {string} action - The action performed (e.g., 'UPDATE_STATUS', 'USER_LOGIN').
     * @param {string} entityType - Type of entity affected (e.g., 'users', 'files', 'system').
     * @param {string} entityId - ID of the entity affected.
     * @param {object} details - Additional metadata stored as JSON.
     */
    /**
     * Create a new administrative log.
     */
    static async create(adminId, action, targetType, targetId, details = {}) {
        const result = await query(
            'INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [adminId, action, targetType, targetId, JSON.stringify(details)]
        );
        return result.rows[0];
    }

    /**
     * Fetch all logs with filtering, sorting, and pagination.
     */
    static async findAll(filters = {}) {
        const { sortBy = 'created_at', order = 'DESC', page = 1, limit = 100 } = filters;
        
        let sql = `
            SELECT l.*, u.name as user_name, u.email as user_email
            FROM admin_logs l
            LEFT JOIN users u ON l.admin_id = u.id
            WHERE 1=1
        `;
        const params = [];
        let idx = 1;

        if (filters.action) {
            sql += ` AND l.action = $${idx}`;
            params.push(filters.action);
            idx++;
        }
        if (filters.targetType) {
            sql += ` AND l.target_type = $${idx}`;
            params.push(filters.targetType);
            idx++;
        }

        const validSortColumns = ['action', 'target_type', 'created_at'];
        const sortColumn = validSortColumns.includes(sortBy) ? `l.${sortBy}` : 'l.created_at';
        const sortDirection = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        const offset = (Math.max(1, page) - 1) * limit;

        sql += ` ORDER BY ${sortColumn} ${sortDirection} LIMIT $${idx} OFFSET $${idx + 1}`;
        params.push(limit, offset);

        const result = await query(sql, params);
        return result.rows;
    }
}

export default Log;
