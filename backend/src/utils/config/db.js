import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const isTest = process.env.NODE_ENV === 'test';

if (!isTest && !process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set. Cannot start without a database connection.');
    console.error('   Local:   set DATABASE_URL in backend/.env');
    console.error('   Staging: use docker-compose.staging.yml with --env-file .env.staging');
    process.exit(1);
}

const pool = isTest ? { on: () => { } } : new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
});

if (!isTest) {
    pool.on('connect', () => console.log('Connected to PostgreSQL'));
    pool.on('error', (err) => console.error('Unexpected PostgreSQL idle client error:', err.message));
}

export const query = async (text, params) => {
    if (isTest && global.__mockDbQuery) {
        return global.__mockDbQuery(text, params);
    }
    return pool.query(text, params);
};

/**
 * Run `callback(client)` inside a single PostgreSQL transaction.
 * Commits on success, rolls back on any thrown error.
 * In test mode the callback receives a mock client backed by global.__mockDbQuery.
 */
export const withTransaction = async (callback) => {
    if (isTest && global.__mockDbQuery) {
        const mockClient = { query: (text, params) => global.__mockDbQuery(text, params) };
        return callback(mockClient);
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

export default pool;
