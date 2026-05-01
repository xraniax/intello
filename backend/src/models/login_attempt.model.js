import { query } from '../utils/config/db.js';

class LoginAttempt {
    static async trackFailure(email, ip, userAgentHash, userAgent) {
        const res = await query(`
            INSERT INTO login_attempts (email, ip_address, user_agent_hash, user_agent)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (email, ip_address, user_agent_hash) DO UPDATE SET
                attempt_count = CASE 
                    WHEN login_attempts.window_started_at < NOW() - INTERVAL '15 minutes' THEN 1
                    ELSE login_attempts.attempt_count + 1
                END,
                window_started_at = CASE 
                    WHEN login_attempts.window_started_at < NOW() - INTERVAL '15 minutes' THEN NOW()
                    ELSE login_attempts.window_started_at
                END,
                last_attempt_at = NOW()
            RETURNING *;
        `, [email, ip, userAgentHash, userAgent]);
        return res.rows[0];
    }
    
    static async lockTuple(email, ip, userAgentHash) {
        await query(`
            UPDATE login_attempts
            SET locked_until = NOW() + INTERVAL '15 minutes'
            WHERE email = $1 AND ip_address = $2 AND user_agent_hash = $3
        `, [email, ip, userAgentHash]);
    }
    
    static async markAlertSent(email, ip, userAgentHash) {
        await query(`
            UPDATE login_attempts
            SET last_security_alert_sent_at = NOW()
            WHERE email = $1 AND ip_address = $2 AND user_agent_hash = $3
        `, [email, ip, userAgentHash]);
    }
    
    static async checkStatus(email, ip, userAgentHash) {
        const res = await query(`
            SELECT * FROM login_attempts 
            WHERE email = $1 AND ip_address = $2 AND user_agent_hash = $3
        `, [email, ip, userAgentHash]);
        return res.rows[0];
    }

    static async clearTuple(email, ip, userAgentHash) {
        await query(`
            DELETE FROM login_attempts 
            WHERE email = $1 AND ip_address = $2 AND user_agent_hash = $3
        `, [email, ip, userAgentHash]);
    }
}

export default LoginAttempt;
