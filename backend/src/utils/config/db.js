import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const isTest = process.env.NODE_ENV === 'test';

// Skip real pool creation in test mode to prevent dangling connections
const pool = isTest ? { on: () => { } } : new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
});

if (!isTest) {
    pool.on('connect', () => console.log('Connected to PostgreSQL'));
    pool.on('error', (err) => console.error('Unexpected PostgreSQL idle client error:', err.message));
}

/**
 * Executes a parameterized SQL query.
 */
export const query = async (text, params) => {
    if (isTest && global.__mockDbQuery) {
        return global.__mockDbQuery(text, params);
    }
    return pool.query(text, params);
};

export default pool;
