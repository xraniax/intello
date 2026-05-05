import { query } from '../utils/config/db.js';

class ChatSession {
    static async findBySubject(userId, subjectId) {
        const result = await query(
            `SELECT id, title, created_at, updated_at
             FROM chat_sessions
             WHERE user_id = $1 AND subject_id = $2
             ORDER BY updated_at DESC`,
            [userId, subjectId]
        );
        return result.rows;
    }

    static async findById(id, userId) {
        const result = await query(
            'SELECT * FROM chat_sessions WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
        return result.rows[0] || null;
    }

    static async create(userId, subjectId, title = 'New Chat') {
        const result = await query(
            `INSERT INTO chat_sessions (user_id, subject_id, title)
             VALUES ($1, $2, $3) RETURNING *`,
            [userId, subjectId, title.slice(0, 255)]
        );
        return result.rows[0];
    }

    static async updateTitle(id, userId, title) {
        const result = await query(
            `UPDATE chat_sessions SET title = $1
             WHERE id = $2 AND user_id = $3 RETURNING *`,
            [title.slice(0, 255), id, userId]
        );
        return result.rows[0] || null;
    }

    static async touch(id, userId) {
        await query(
            'UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
    }

    static async delete(id, userId) {
        const result = await query(
            'DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2 RETURNING id',
            [id, userId]
        );
        return result.rows.length > 0;
    }
}

export default ChatSession;
