import { query } from '../config/db.js';
import bcrypt from 'bcrypt';

class User {
    /**
     * Create a new user with hashed password
     */
    static async create(email, password, name, role = 'user') {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await query(
            'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, created_at',
            [email, hashedPassword, name, role]
        );
        return result.rows[0];
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
