import { query } from '../utils/config/db.js';
import bcrypt from 'bcrypt';

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
            'INSERT INTO users (email, password_hash, name, role, auth_provider, provider_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, name, role, created_at',
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
                'UPDATE users SET auth_provider = $1, provider_id = $2 WHERE id = $3 RETURNING id, email, name, role, created_at',
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
            'SELECT id, email, name, role, created_at FROM users WHERE id = $1',
            [id]
        );
        return result.rows[0];
    }

    /**
     * Compare provided password with stored hash
     */
    static async comparePassword(password, hashedPassword) {
        return bcrypt.compare(password, hashedPassword);
    }
}

export default User;
