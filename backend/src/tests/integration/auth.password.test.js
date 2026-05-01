import { jest } from '@jest/globals';
import request from 'supertest';

// --- Mocks ---

const mockUserMethods = {
    findByEmail: jest.fn(),
    findByResetToken: jest.fn(),
    createResetToken: jest.fn(),
    updatePassword: jest.fn(),
    clearResetToken: jest.fn(),
};

const mockSendEmail = jest.fn();

jest.unstable_mockModule('../../models/user.model.js', () => ({ default: mockUserMethods }));
jest.unstable_mockModule('../../utils/services/email.service.js', () => ({ default: mockSendEmail }));

const { default: app } = await import('../../app.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALICE = {
    id: 'uuid-1',
    email: 'alice@example.com',
    name: 'Alice Smith',
    role: 'user',
    status: 'ACTIVE',
};

// ─── POST /api/auth/forgot-password ───────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns generic success for a registered email and sends a reset email', async () => {
        mockUserMethods.findByEmail.mockResolvedValue(ALICE);
        mockUserMethods.createResetToken.mockResolvedValue('reset-token-abc');
        mockSendEmail.mockResolvedValue();

        const res = await request(app)
            .post('/api/auth/forgot-password')
            .send({ email: 'alice@example.com' });

        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/reset link has been sent/i);
        expect(mockSendEmail).toHaveBeenCalledWith(
            expect.objectContaining({ subject: expect.stringContaining('Password Reset') })
        );
    });

    it('returns the same generic success for an unregistered email (no enumeration)', async () => {
        mockUserMethods.findByEmail.mockResolvedValue(null);

        const res = await request(app)
            .post('/api/auth/forgot-password')
            .send({ email: 'ghost@example.com' });

        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/reset link has been sent/i);
        expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('returns 500 and clears token when email delivery fails', async () => {
        mockUserMethods.findByEmail.mockResolvedValue(ALICE);
        mockUserMethods.createResetToken.mockResolvedValue('reset-token-abc');
        mockSendEmail.mockRejectedValue(new Error('SMTP timeout'));

        const res = await request(app)
            .post('/api/auth/forgot-password')
            .send({ email: 'alice@example.com' });

        expect(res.status).toBe(500);
        expect(mockUserMethods.clearResetToken).toHaveBeenCalledWith(ALICE.id);
    });
});

// ─── GET /api/auth/reset-password/:token ──────────────────────────────────────

describe('GET /api/auth/reset-password/:token', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns valid:true for a valid token', async () => {
        mockUserMethods.findByResetToken.mockResolvedValue(ALICE);

        const res = await request(app).get('/api/auth/reset-password/valid-token-123');

        expect(res.status).toBe(200);
        expect(res.body.valid).toBe(true);
    });

    it('returns valid:false for an invalid or expired token', async () => {
        mockUserMethods.findByResetToken.mockResolvedValue(null);

        const res = await request(app).get('/api/auth/reset-password/expired-token');

        expect(res.status).toBe(400);
        expect(res.body.valid).toBe(false);
    });
});

// ─── POST /api/auth/reset-password ────────────────────────────────────────────

describe('POST /api/auth/reset-password', () => {
    beforeEach(() => jest.clearAllMocks());

    it('resets password and returns 200 for a valid token', async () => {
        mockUserMethods.findByResetToken.mockResolvedValue(ALICE);
        mockUserMethods.updatePassword.mockResolvedValue();

        const res = await request(app)
            .post('/api/auth/reset-password')
            .send({ token: 'valid-token', password: 'NewSecurePass1!' });

        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/password reset successful/i);
        expect(mockUserMethods.updatePassword).toHaveBeenCalledWith(ALICE.id, 'NewSecurePass1!');
    });

    it('returns 400 for an invalid or expired token', async () => {
        mockUserMethods.findByResetToken.mockResolvedValue(null);

        const res = await request(app)
            .post('/api/auth/reset-password')
            .send({ token: 'bad-token', password: 'NewSecurePass1!' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid or has expired/i);
        expect(mockUserMethods.updatePassword).not.toHaveBeenCalled();
    });

    it('returns 400 when password is too short', async () => {
        const res = await request(app)
            .post('/api/auth/reset-password')
            .send({ token: 'valid-token', password: 'short' });

        expect(res.status).toBe(400);
    });
});
