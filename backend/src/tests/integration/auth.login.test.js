import { jest } from '@jest/globals';
import request from 'supertest';

// --- Mocks (all must be declared before any imports) ---

const mockUserMethods = {
    findByEmail: jest.fn(),
    comparePassword: jest.fn(),
    updateLastLogin: jest.fn().mockResolvedValue(),
};

const mockLoginAttemptMethods = {
    checkStatus: jest.fn(),
    trackFailure: jest.fn(),
    lockTuple: jest.fn(),
    clearTuple: jest.fn(),
    markAlertSent: jest.fn(),
};

const mockSettingsService = {
    getStorageControls: jest.fn().mockResolvedValue({ allow_public_registration: true }),
};

const mockSendEmail = jest.fn().mockResolvedValue();

jest.unstable_mockModule('../../models/user.model.js', () => ({ default: mockUserMethods }));
jest.unstable_mockModule('../../models/login_attempt.model.js', () => ({ default: mockLoginAttemptMethods }));
jest.unstable_mockModule('../../services/settings.service.js', () => ({ default: mockSettingsService }));
jest.unstable_mockModule('../../utils/services/email.service.js', () => ({ default: mockSendEmail }));

// --- App import after mocks ---
const { default: app } = await import('../../app.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACTIVE_USER = {
    id: 'uuid-1',
    email: 'alice@example.com',
    name: 'Alice Smith',
    role: 'user',
    status: 'ACTIVE',
    password_hash: '$hashed$',
};

const loginPayload = { email: 'alice@example.com', password: 'SecurePass1!' };

const noLock = null; // checkStatus returns null → not locked
const activeLock = {
    locked_until: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    attempt_count: 5,
    last_security_alert_sent_at: null,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockLoginAttemptMethods.checkStatus.mockResolvedValue(noLock);
        mockLoginAttemptMethods.trackFailure.mockResolvedValue({ attempt_count: 1, last_security_alert_sent_at: null });
        mockLoginAttemptMethods.lockTuple.mockResolvedValue();
        mockLoginAttemptMethods.clearTuple.mockResolvedValue();
        mockLoginAttemptMethods.markAlertSent.mockResolvedValue();
    });

    describe('successful login', () => {
        it('returns 200 with token and user data', async () => {
            mockUserMethods.findByEmail.mockResolvedValue(ACTIVE_USER);
            mockUserMethods.comparePassword.mockResolvedValue(true);

            const res = await request(app).post('/api/auth/login').send(loginPayload);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data.token).toBeDefined();
            expect(res.body.data.email).toBe(ACTIVE_USER.email);
            expect(res.body.data.password_hash).toBeUndefined();
        });

        it('clears the login-attempt tuple on success', async () => {
            mockUserMethods.findByEmail.mockResolvedValue(ACTIVE_USER);
            mockUserMethods.comparePassword.mockResolvedValue(true);

            await request(app).post('/api/auth/login').send(loginPayload);

            expect(mockLoginAttemptMethods.clearTuple).toHaveBeenCalled();
        });
    });

    describe('failed login', () => {
        it('returns 401 with generic message when user does not exist', async () => {
            mockUserMethods.findByEmail.mockResolvedValue(null);

            const res = await request(app).post('/api/auth/login').send(loginPayload);

            expect(res.status).toBe(401);
            expect(res.body.message).toBe('Invalid email or password');
        });

        it('returns 401 with generic message when password is wrong', async () => {
            mockUserMethods.findByEmail.mockResolvedValue(ACTIVE_USER);
            mockUserMethods.comparePassword.mockResolvedValue(false);

            const res = await request(app).post('/api/auth/login').send(loginPayload);

            expect(res.status).toBe(401);
            expect(res.body.message).toBe('Invalid email or password');
        });

        it('tracks a failure record on wrong password', async () => {
            mockUserMethods.findByEmail.mockResolvedValue(ACTIVE_USER);
            mockUserMethods.comparePassword.mockResolvedValue(false);

            await request(app).post('/api/auth/login').send(loginPayload);

            expect(mockLoginAttemptMethods.trackFailure).toHaveBeenCalled();
        });
    });

    describe('brute force protection', () => {
        it('returns 401 immediately when tuple is locked', async () => {
            mockLoginAttemptMethods.checkStatus.mockResolvedValue(activeLock);

            const res = await request(app).post('/api/auth/login').send(loginPayload);

            expect(res.status).toBe(401);
            // User/password lookup should be short-circuited
            expect(mockUserMethods.findByEmail).not.toHaveBeenCalled();
        });

        it('locks the tuple after 5 consecutive failures', async () => {
            mockUserMethods.findByEmail.mockResolvedValue(ACTIVE_USER);
            mockUserMethods.comparePassword.mockResolvedValue(false);
            mockLoginAttemptMethods.trackFailure.mockResolvedValue({
                attempt_count: 5,
                last_security_alert_sent_at: null,
            });

            await request(app).post('/api/auth/login').send(loginPayload);

            expect(mockLoginAttemptMethods.lockTuple).toHaveBeenCalled();
        });

        it('sends security email after the 3rd failure (within cooldown)', async () => {
            mockUserMethods.findByEmail.mockResolvedValue(ACTIVE_USER);
            mockUserMethods.comparePassword.mockResolvedValue(false);
            mockLoginAttemptMethods.trackFailure.mockResolvedValue({
                attempt_count: 3,
                last_security_alert_sent_at: null,
            });

            await request(app).post('/api/auth/login').send(loginPayload);

            // Give the async sendEmail call a tick to execute
            await new Promise((r) => setImmediate(r));
            expect(mockSendEmail).toHaveBeenCalledWith(
                expect.objectContaining({ subject: expect.stringContaining('Security Alert') })
            );
        });

        it('does not re-send security email within the 15-min cooldown', async () => {
            mockUserMethods.findByEmail.mockResolvedValue(ACTIVE_USER);
            mockUserMethods.comparePassword.mockResolvedValue(false);
            // Alert was sent recently (5 minutes ago)
            const recentAlert = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            mockLoginAttemptMethods.trackFailure.mockResolvedValue({
                attempt_count: 3,
                last_security_alert_sent_at: recentAlert,
            });

            await request(app).post('/api/auth/login').send(loginPayload);
            await new Promise((r) => setImmediate(r));

            expect(mockSendEmail).not.toHaveBeenCalled();
        });
    });

    describe('account status enforcement', () => {
        it('returns 403 for a SUSPENDED account', async () => {
            mockUserMethods.findByEmail.mockResolvedValue({ ...ACTIVE_USER, status: 'SUSPENDED' });
            mockUserMethods.comparePassword.mockResolvedValue(true);

            const res = await request(app).post('/api/auth/login').send(loginPayload);

            expect(res.status).toBe(403);
            expect(res.body.message).toMatch(/suspended/i);
        });

        it('returns 403 for an INACTIVE account', async () => {
            mockUserMethods.findByEmail.mockResolvedValue({ ...ACTIVE_USER, status: 'INACTIVE' });
            mockUserMethods.comparePassword.mockResolvedValue(true);

            const res = await request(app).post('/api/auth/login').send(loginPayload);

            expect(res.status).toBe(403);
            expect(res.body.message).toMatch(/inactive/i);
        });
    });

    describe('input validation', () => {
        it('returns 400 when email is missing', async () => {
            const res = await request(app).post('/api/auth/login').send({ password: 'pass' });
            expect(res.status).toBe(400);
        });

        it('returns 400 when password is missing', async () => {
            const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com' });
            expect(res.status).toBe(400);
        });
    });
});
