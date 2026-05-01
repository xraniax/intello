import { query } from '../utils/config/db.js';

class SystemAlert {
    static async create(data) {
        const { type, severity = 'ERROR', title, message, userId = null, entityId = null } = data;
        const result = await query(
            `INSERT INTO system_alerts (type, severity, title, message, user_id, entity_id) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [type, severity, title, message, userId, entityId]
        );
        return result.rows[0];
    }

    static async getTotalCount(filters = {}) {
        const { isResolved } = filters;
        let sql = 'SELECT COUNT(*)::int as count FROM system_alerts WHERE 1=1';
        const params = [];
        let idx = 1;

        if (isResolved !== undefined) {
            sql += ` AND is_resolved = $${idx}`;
            params.push(isResolved);
            idx++;
        }

        const result = await query(sql, params);
        return result.rows[0].count;
    }

    static async findAll(filters = {}) {
        const { isResolved, page = 1, limit = 50 } = filters;
        let sql = 'SELECT a.*, u.name as user_name FROM system_alerts a LEFT JOIN users u ON a.user_id = u.id WHERE 1=1';
        const params = [];
        let idx = 1;

        if (isResolved !== undefined) {
            sql += ` AND a.is_resolved = $${idx}`;
            params.push(isResolved);
            idx++;
        }

        const offset = (Math.max(1, page) - 1) * limit;
        sql += ` ORDER BY a.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
        params.push(limit, offset);

        const result = await query(sql, params);
        return result.rows;
    }

    static async resolve(id) {
        const result = await query(
            'UPDATE system_alerts SET is_resolved = TRUE WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    }

    static async delete(id) {
        await query('DELETE FROM system_alerts WHERE id = $1', [id]);
        return true;
    }

    static async getUnresolvedCount() {
        const result = await query('SELECT COUNT(*) FROM system_alerts WHERE is_resolved = FALSE');
        return parseInt(result.rows[0].count);
    }
}

export default SystemAlert;
