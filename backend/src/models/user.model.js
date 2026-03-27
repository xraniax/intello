import { query } from '../utils/config/db.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// Cost factor for bcrypt key derivation. Higher = slower brute force.
// 12 rounds is a good balance of security and performance.
const BCRYPT_ROUNDS = 12;

class User {
    /**
     * Create a new user. password_hash is optional for social login users.
     */
    static async create(email, password = null, name, role = 'user', authProvider = 'local', providerId = null) {
        let hashedPassword = null;
        if (password) {
            hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
        }

        const result = await query(
            'INSERT INTO users (email, password_hash, name, role, auth_provider, provider_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, name, role, status, last_login_at, created_at, avatar_url, settings, achievements',
            [email, hashedPassword, name, role, authProvider, providerId]
        );
        return result.rows[0];
    }

    /**
     * Find or create a user by their social provider ID.
     */
    static async findOrCreateByProvider(email, name, provider, providerId) {
        // Try finding by provider details first
        const existingByProvider = await query(
            'SELECT * FROM users WHERE auth_provider = $1 AND provider_id = $2',
            [provider, providerId]
        );

        if (existingByProvider.rows[0]) {
            return existingByProvider.rows[0];
        }

        // If not found by provider, check by email (to link accounts)
        const existingByEmail = await this.findByEmail(email);
        if (existingByEmail) {
            // Link existing account to this provider
            const result = await query(
                'UPDATE users SET auth_provider = $1, provider_id = $2 WHERE id = $3 RETURNING id, email, name, role, status, last_login_at, created_at, avatar_url, settings, achievements',
                [provider, providerId, existingByEmail.id]
            );
            return result.rows[0];
        }

        // Otherwise create new user
        return await this.create(email, null, name, 'user', provider, providerId);
    }

    /**
     * Find user by email for authentication
     */
    static async findByEmail(email) {
        const result = await query('SELECT * FROM users WHERE email = $1', [email]);
        return result.rows[0];
    }

    /**
     * Find user by ID for session/profile
     */
    static async findById(id) {
        const result = await query(
            'SELECT id, email, name, role, status, created_at, last_login_at, last_active_at, reset_token_hash, reset_token_expires, avatar_url, settings, achievements FROM users WHERE id = $1',
            [id]
        );
        return result.rows[0];
    }

    /**
     * Update user's last_active_at timestamp.
     */
    static async updateLastActive(id) {
        await query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [id]);
    }

    /**
     * Update user's last_login_at timestamp.
     */
    static async updateLastLogin(id) {
        await query('UPDATE users SET last_login_at = NOW(), last_active_at = NOW() WHERE id = $1', [id]);
    }

    /**
     * Set password reset token for a user.
     * Returns the unhashed token.
     */
    static async createResetToken(id) {
        // Generate a random token
        const resetToken = crypto.randomBytes(32).toString('hex');

        // Hash the token
        const tokenHash = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');

        // Set expiration (1 hour from now)
        const THIRTY_MIN = 30 * 60 * 1000;
        const expires = new Date(Date.now() + THIRTY_MIN);

        await query(
            'UPDATE users SET reset_token_hash = $1, reset_token_expires = $2 WHERE id = $3',
            [tokenHash, expires, id]
        );

        return resetToken;
    }

    /**
     * Clear reset token for a user.
     */
    static async clearResetToken(id) {
        await query(
            'UPDATE users SET reset_token_hash = NULL, reset_token_expires = NULL WHERE id = $1',
            [id]
        );
    }

    /**
     * Find user by password reset token.
     * Checks both the hash and expiration.
     */
    static async findByResetToken(token) {
        const tokenHash = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        const result = await query(
            'SELECT * FROM users WHERE reset_token_hash = $1 AND reset_token_expires > NOW()',
            [tokenHash]
        );
        return result.rows[0];
    }

    /**
     * Update user's password and clear reset token.
     */
    static async updatePassword(id, password) {
        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

        await query(
            'UPDATE users SET password_hash = $1, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = $2',
            [hashedPassword, id]
        );
    }

    /**
     * Fetch all users for admin management.
     * Includes material counts and storage estimation.
     */
    static async findAll(filters = {}) {
        const { sortBy = 'created_at', order = 'DESC', page = 1, limit = 1000 } = filters;
        const validSortColumns = ['name', 'email', 'role', 'status', 'created_at', 'last_active_at', 'storage_usage_bytes'];
        const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
        const sortDirection = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        const offset = (Math.max(1, page) - 1) * limit;

        const result = await query(
            `SELECT u.id, u.email, u.name, u.role, u.status, u.created_at, u.last_active_at, u.storage_limit_bytes, u.avatar_url, u.settings, u.achievements,
             (SELECT COUNT(*)::int FROM materials m WHERE m.user_id = u.id AND UPPER(m.status) != 'FAILED') as material_count,
             (SELECT COUNT(*)::int FROM subjects s WHERE s.user_id = u.id) as workspace_count,
             ((SELECT COALESCE(SUM(f.size_bytes), 0)::bigint FROM files f
               WHERE f.user_id = u.id) + 
              (SELECT COALESCE(SUM(OCTET_LENGTH(COALESCE(m.content, ''))), 0)::bigint FROM materials m
               WHERE m.user_id = u.id AND UPPER(m.status) != 'FAILED')
             ) as storage_usage_bytes
             FROM users u
             ORDER BY ${sortColumn} ${sortDirection}
             LIMIT $1 OFFSET $2`,
             [limit, offset]
        );
        return result.rows;
    }

    /**
     * Administrative update of user status or role.
     */
    static async adminUpdate(id, updates) {
        const fields = [];
        const values = [];
        let idx = 1;

        for (const [key, value] of Object.entries(updates)) {
            fields.push(`${key} = $${idx++}`);
            values.push(value);
        }

        if (fields.length === 0) return null;

        values.push(id);
        const result = await query(
            `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, email, name, role, status, storage_limit_bytes, avatar_url, settings, achievements`,
            values
        );
        return result.rows[0];
    }

    /**
     * Delete user and all associated data.
     */
    static async delete(id) {
        const result = await query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
        return result.rowCount > 0;
    }

    /**
     * Compare provided password with stored hash
     */
    static async comparePassword(password, hashedPassword) {
        if (!hashedPassword) return false;
        return bcrypt.compare(password, hashedPassword);
    }
}

export default User;
