import { query } from '../config/db.js';

class Subject {
    /**
     * Create a new academic subject
     */
    static async create(name, description) {
        const result = await query(
            'INSERT INTO subjects (name, description) VALUES ($1, $2) RETURNING *',
            [name, description]
        );
        return result.rows[0];
    }

    /**
     * Get subject by ID
     */
    static async findById(id) {
        const result = await query('SELECT * FROM subjects WHERE id = $1', [id]);
        return result.rows[0];
    }

    /**
     * Fetch all registered subjects
     */
    static async findAll() {
        const result = await query('SELECT * FROM subjects ORDER BY name ASC');
        return result.rows;
    }
}

export default Subject;
