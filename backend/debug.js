import request from 'supertest';
import app from './src/app.js';
import { query } from './src/config/db.js';
import bcrypt from 'bcrypt';

// Mock DB globally as setup.js would
global.__mockDbQuery = async (text, params) => {
    if (text.includes('SELECT * FROM users WHERE email')) {
        const hashedPassword = await bcrypt.hash('password123', 1);
        return { rows: [{ id: 1, name: 'Test', email: 'test@example.com', password_hash: hashedPassword }] };
    }
    return { rows: [] };
};

const run = async () => {
    console.log('--- TEST: POST /api/auth/register (VALIDATION ERROR) ---');
    let res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'T', email: 'not-an-email', password: '123' });
    console.log(JSON.stringify(res.body, null, 2));

    console.log('\n--- TEST: POST /api/auth/login (SUCCESS) ---');
    res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });
    console.log(JSON.stringify(res.body, null, 2));
    process.exit(0);
};

run();
