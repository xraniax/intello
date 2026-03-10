import { jest } from '@jest/globals';
import request from 'supertest';

// Use the app minus the server listener
import app from '../../src/app.js';
// DB is mocked globally in setup.js via global.__mockDbQuery
import User from '../../src/models/user.model.js';
import bcrypt from 'bcrypt';

describe('Auth API Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/auth/register', () => {
        it('should register a new user successfully', async () => {
            // Mock DB to return nothing for findByEmail (no duplicate email)
            global.__mockDbQuery.mockResolvedValueOnce({ rows: [] });
            // Mock DB to return the newly created user
            global.__mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test User', email: 'test@example.com' }] });

            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test User',
                    email: 'test@example.com',
                    password: 'password123'
                });

            expect(res.status).toBe(201);
            expect(res.body.status).toBe('success');
            expect(res.body.data.email).toBe('test@example.com');
            expect(res.body.data.token).toBeDefined();
        });

        it('should return 409 if email already exists', async () => {
            // Mock DB to find an existing user
            global.__mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 1, email: 'test@example.com' }] });

            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test User',
                    email: 'test@example.com',
                    password: 'password123'
                });

            expect(res.status).toBe(409);
            expect(res.body.status).toBe('error');
            expect(res.body.code).toBe(409);
        });

        it('should return 400 for invalid email or short password (Zod validation)', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'T', // too short
                    email: 'not-an-email',
                    password: '123' // too short
                });

            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
            expect(res.body.errors.email).toBeDefined();
            expect(res.body.errors.password).toBeDefined();
            expect(res.body.errors.name).toBeDefined();
        });
    });

    describe('POST /api/auth/login', () => {
        it('should login successfully with correct credentials', async () => {
            const hashedPassword = await bcrypt.hash('password123', 1);
            // Mock DB to return user with hashed password
            global.__mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test', email: 'test@example.com', password_hash: hashedPassword }] });

            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });

            expect(res.status).toBe(200);
            expect(res.body.data.token).toBeDefined();
        });

        it('should return 401 for incorrect password', async () => {
            const hashedPassword = await bcrypt.hash('password123', 1);
            global.__mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 1, email: 'test@example.com', password_hash: hashedPassword }] });

            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'wrongpassword'
                });

            expect(res.status).toBe(401);
            expect(res.body.message).toBe('Invalid email or password');
        });

        it('should return 401 for non-existent email', async () => {
            global.__mockDbQuery.mockResolvedValueOnce({ rows: [] }); // User not found

            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'unknown@example.com',
                    password: 'password123'
                });

            expect(res.status).toBe(401);
            expect(res.body.message).toBe('Invalid email or password');
        });
    });
});
