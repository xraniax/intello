import { jest } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';

// DB is mocked globally in tests/setup.js via global.__mockDbQuery.
// Content-based mockImplementation is used here so that new service calls
// (SettingsService, LoginAttempt) don't silently consume positional slots.

import app from '../../src/app.js';

describe('Auth API Integration', () => {
    const VALID_PASSWORD = 'Password123!';
    let hashedPassword;

    beforeAll(async () => {
        hashedPassword = await bcrypt.hash(VALID_PASSWORD, 1);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // Restore the smart routing implementation after clearAllMocks
        global.__mockDbQuery.mockImplementation((text, params) => {
            if (!text) return Promise.resolve({ rows: [] });
            if (text.includes('FROM users') && text.includes('WHERE id = $1')) {
                return Promise.resolve({ rows: [{ id: params?.[0], name: 'Test User', email: 'test@example.com', role: 'user', status: 'ACTIVE' }] });
            }
            if (text.includes('admin_settings')) return Promise.resolve({ rows: [] });
            if (text.includes('login_attempts')) {
                if (text.includes('ON CONFLICT') || (text.includes('INSERT') && text.includes('RETURNING'))) {
                    return Promise.resolve({ rows: [{ attempt_count: 1, last_security_alert_sent_at: null, locked_until: null }] });
                }
                return Promise.resolve({ rows: [], rowCount: 0 });
            }
            return Promise.resolve({ rows: [] });
        });
    });

    // ─── Registration ──────────────────────────────────────────────────────

    describe('POST /api/auth/register', () => {
        it('should register a new user successfully', async () => {
            global.__mockDbQuery.mockImplementation((text, params) => {
                if (!text) return Promise.resolve({ rows: [] });
                if (text.includes('FROM users') && text.includes('WHERE id = $1')) {
                    return Promise.resolve({ rows: [{ id: params?.[0], name: 'Test User', email: 'test@example.com', role: 'user', status: 'ACTIVE' }] });
                }
                if (text.includes('admin_settings')) return Promise.resolve({ rows: [] });
                if (text.includes('login_attempts')) return Promise.resolve({ rows: [], rowCount: 0 });
                if (text.includes('WHERE email = $1')) return Promise.resolve({ rows: [] }); // no duplicate
                if (text.includes('INSERT INTO users')) {
                    return Promise.resolve({ rows: [{ id: 1, name: 'Test User', email: 'test@example.com', role: 'user', status: 'ACTIVE' }] });
                }
                return Promise.resolve({ rows: [] });
            });

            const res = await request(app)
                .post('/api/auth/register')
                .send({ name: 'Test User', email: 'test@example.com', password: VALID_PASSWORD });

            expect(res.status).toBe(201);
            expect(res.body.status).toBe('success');
            expect(res.body.data.email).toBe('test@example.com');
            expect(res.body.data.token).toBeDefined();
        });

        it('should return 400 if email already exists', async () => {
            global.__mockDbQuery.mockImplementation((text) => {
                if (!text) return Promise.resolve({ rows: [] });
                if (text.includes('admin_settings')) return Promise.resolve({ rows: [] });
                if (text.includes('login_attempts')) return Promise.resolve({ rows: [], rowCount: 0 });
                if (text.includes('WHERE email = $1')) {
                    return Promise.resolve({ rows: [{ id: 1, email: 'test@example.com', status: 'ACTIVE' }] });
                }
                if (text.includes('FROM users') && text.includes('WHERE id = $1')) {
                    return Promise.resolve({ rows: [{ id: 1, name: 'Test User', email: 'test@example.com', role: 'user', status: 'ACTIVE' }] });
                }
                return Promise.resolve({ rows: [] });
            });

            const res = await request(app)
                .post('/api/auth/register')
                .send({ name: 'Test User', email: 'test@example.com', password: VALID_PASSWORD });

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/already registered/i);
        });

        it('should return 400 for invalid email or short password (Zod validation)', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ name: 'T', email: 'not-an-email', password: '123' });

            expect(res.status).toBe(400);
            expect(res.body.errors).toBeDefined();
        });
    });

    // ─── Login ────────────────────────────────────────────────────────────

    describe('POST /api/auth/login', () => {
        it('should login successfully with correct credentials', async () => {
            global.__mockDbQuery.mockImplementation((text, params) => {
                if (!text) return Promise.resolve({ rows: [] });
                if (text.includes('FROM users') && text.includes('WHERE id = $1')) {
                    return Promise.resolve({ rows: [{ id: params?.[0], name: 'Test User', email: 'test@example.com', role: 'user', status: 'ACTIVE' }] });
                }
                if (text.includes('admin_settings')) return Promise.resolve({ rows: [] });
                if (text.includes('login_attempts')) return Promise.resolve({ rows: [], rowCount: 0 });
                if (text.includes('WHERE email = $1')) {
                    return Promise.resolve({ rows: [{ id: 1, name: 'Test', email: 'test@example.com', password_hash: hashedPassword, status: 'ACTIVE', role: 'user' }] });
                }
                return Promise.resolve({ rows: [] });
            });

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: VALID_PASSWORD });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data.token).toBeDefined();
        });

        it('should return 401 for incorrect password', async () => {
            global.__mockDbQuery.mockImplementation((text, params) => {
                if (!text) return Promise.resolve({ rows: [] });
                if (text.includes('FROM users') && text.includes('WHERE id = $1')) {
                    return Promise.resolve({ rows: [{ id: params?.[0], name: 'Test User', email: 'test@example.com', role: 'user', status: 'ACTIVE' }] });
                }
                if (text.includes('admin_settings')) return Promise.resolve({ rows: [] });
                if (text.includes('login_attempts')) {
                    if (text.includes('ON CONFLICT') || (text.includes('INSERT') && text.includes('RETURNING'))) {
                        return Promise.resolve({ rows: [{ attempt_count: 1, last_security_alert_sent_at: null, locked_until: null }] });
                    }
                    return Promise.resolve({ rows: [], rowCount: 0 });
                }
                if (text.includes('WHERE email = $1')) {
                    return Promise.resolve({ rows: [{ id: 1, email: 'test@example.com', password_hash: hashedPassword, status: 'ACTIVE', role: 'user' }] });
                }
                return Promise.resolve({ rows: [] });
            });

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'WrongPassword123!' });

            expect(res.status).toBe(401);
            expect(res.body.message).toBe('Invalid email or password');
        });

        it('should return 401 for non-existent email', async () => {
            global.__mockDbQuery.mockImplementation((text) => {
                if (!text) return Promise.resolve({ rows: [] });
                if (text.includes('admin_settings')) return Promise.resolve({ rows: [] });
                if (text.includes('login_attempts')) {
                    if (text.includes('ON CONFLICT') || (text.includes('INSERT') && text.includes('RETURNING'))) {
                        return Promise.resolve({ rows: [{ attempt_count: 1, last_security_alert_sent_at: null, locked_until: null }] });
                    }
                    return Promise.resolve({ rows: [], rowCount: 0 });
                }
                if (text.includes('WHERE email = $1')) return Promise.resolve({ rows: [] }); // not found
                return Promise.resolve({ rows: [] });
            });

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'unknown@example.com', password: VALID_PASSWORD });

            expect(res.status).toBe(401);
            expect(res.body.message).toBe('Invalid email or password');
        });

        it('should return 403 for suspended user', async () => {
            global.__mockDbQuery.mockImplementation((text, params) => {
                if (!text) return Promise.resolve({ rows: [] });
                if (text.includes('FROM users') && text.includes('WHERE id = $1')) {
                    return Promise.resolve({ rows: [{ id: params?.[0], name: 'Test User', email: 'test@example.com', role: 'user', status: 'SUSPENDED' }] });
                }
                if (text.includes('admin_settings')) return Promise.resolve({ rows: [] });
                if (text.includes('login_attempts')) return Promise.resolve({ rows: [], rowCount: 0 });
                if (text.includes('WHERE email = $1')) {
                    return Promise.resolve({ rows: [{ id: 1, email: 'test@example.com', password_hash: hashedPassword, status: 'SUSPENDED', role: 'user' }] });
                }
                return Promise.resolve({ rows: [] });
            });

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: VALID_PASSWORD });

            expect(res.status).toBe(403);
            expect(res.body.message).toMatch(/suspended/i);
        });
    });
});
