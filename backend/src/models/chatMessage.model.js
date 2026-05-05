import { query } from '../utils/config/db.js';

class ChatMessage {
    static async findBySession(sessionId) {
        const result = await query(
            `SELECT * FROM chat_messages
             WHERE session_id = $1
             ORDER BY created_at ASC`,
            [sessionId]
        );
        return result.rows;
    }

    static async create(sessionId, role, content, sources = [], confidence = 0, isError = false) {
        const result = await query(
            `INSERT INTO chat_messages (session_id, role, content, sources, confidence, is_error)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [sessionId, role, content, JSON.stringify(sources), confidence, isError]
        );
        return result.rows[0];
    }

    static async updateContent(id, content) {
        const result = await query(
            'UPDATE chat_messages SET content = $1 WHERE id = $2 RETURNING *',
            [content, id]
        );
        return result.rows[0] || null;
    }

    static async updateSources(id, sources, confidence) {
        const result = await query(
            'UPDATE chat_messages SET sources = $1, confidence = $2 WHERE id = $3 RETURNING *',
            [JSON.stringify(sources), confidence, id]
        );
        return result.rows[0] || null;
    }

    static async updateFeedback(id, sessionId, feedback) {
        const result = await query(
            `UPDATE chat_messages SET feedback = $1
             WHERE id = $2 AND session_id = $3 RETURNING *`,
            [feedback, id, sessionId]
        );
        return result.rows[0] || null;
    }

    static async updateBookmark(id, sessionId, bookmarked) {
        const result = await query(
            `UPDATE chat_messages SET bookmarked = $1
             WHERE id = $2 AND session_id = $3 RETURNING *`,
            [bookmarked, id, sessionId]
        );
        return result.rows[0] || null;
    }

    static async findBookmarkedBySubject(userId, subjectId) {
        const result = await query(
            `SELECT cm.*, cs.title AS session_title
             FROM chat_messages cm
             JOIN chat_sessions cs ON cm.session_id = cs.id
             WHERE cm.bookmarked = TRUE
               AND cs.user_id = $1
               AND cs.subject_id = $2
             ORDER BY cm.created_at DESC`,
            [userId, subjectId]
        );
        return result.rows;
    }
}

export default ChatMessage;
