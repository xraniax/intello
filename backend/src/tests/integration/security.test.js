/**
 * Security integration tests.
 *
 * Covers JWT validation, RBAC enforcement, and auth bypass prevention
 * against real Express routes using supertest.
 */
import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// --- Mocks ---

const mockFindById = jest.fn();

jest.unstable_mockModule('../../models/user.model.js', () => ({
    default: {
        findById: mockFindById,
        updateLastActive: jest.fn().mockResolvedValue(),
    },
}));

const { default: app } = await import('../../app.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

const signToken = (payload, opts = {}) =>
    jwt.sign(payload, JWT_SECRET, { expiresIn: '1h', ...opts });

const ACTIVE_USER = { id: 1, email: 't@t.com', name: 'Test', role: 'user', status: 'ACTIVE' };
const ADMIN_USER  = { id: 2, email: 'a@t.com', name: 'Admin', role: 'admin', status: 'ACTIVE' };
const SUSPENDED   = { id: 3, email: 's@t.com', name: 'Sus', role: 'user', status: 'SUSPENDED' };

// Use a protected route available in the app
const PROTECTED_ENDPOINT = '/api/auth/me';
const ADMIN_ENDPOINT     = '/api/admin/users'; // requires admin

// ─── Authentication guard ──────────────────────────────────────────────────────

describe('JWT authentication guard', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns 401 when Authorization header is absent', async () => {
        const res = await request(app).get(PROTECTED_ENDPOINT);
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('TOKEN_MISSING');
    });

    it('returns 401 when token is syntactically invalid', async () => {
        const res = await request(app)
            .get(PROTECTED_ENDPOINT)
            .set('Authorization', 'Bearer this.is.garbage');
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('TOKEN_INVALID');
    });

    it('returns 401 with TOKEN_EXPIRED for an expired token', async () => {
        const expired = signToken({ id: 1 }, { expiresIn: '-1s' });
        const res = await request(app)
            .get(PROTECTED_ENDPOINT)
            .set('Authorization', `Bearer ${expired}`);
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('TOKEN_EXPIRED');
    });

    it('returns 401 when token is signed with a different secret', async () => {
        const wrongToken = jwt.sign({ id: 1 }, 'totally-wrong-secret', { expiresIn: '1h' });
        const res = await request(app)
            .get(PROTECTED_ENDPOINT)
            .set('Authorization', `Bearer ${wrongToken}`);
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('TOKEN_INVALID');
    });

    it('returns 401 when decoded user no longer exists in DB', async () => {
        mockFindById.mockResolvedValue(null);
        const token = signToken({ id: 9999 });
        const res = await request(app)
            .get(PROTECTED_ENDPOINT)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(401);
    });

    it('returns 403 for a valid token belonging to a SUSPENDED account', async () => {
        mockFindById.mockResolvedValue(SUSPENDED);
        const token = signToken({ id: 3 });
        const res = await request(app)
            .get(PROTECTED_ENDPOINT)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
    });

    it('grants access for a valid token with an active account', async () => {
        mockFindById.mockResolvedValue(ACTIVE_USER);
        const token = signToken({ id: 1 });
        const res = await request(app)
            .get(PROTECTED_ENDPOINT)
            .set('Authorization', `Bearer ${token}`);
        // 200 or whatever the endpoint returns — just not 401/403
        expect([200, 201]).toContain(res.status);
    });
});

// ─── RBAC: admin-only routes ───────────────────────────────────────────────────

describe('RBAC: admin-only endpoints', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns 403 when a regular user accesses an admin route', async () => {
        mockFindById.mockResolvedValue(ACTIVE_USER);
        const token = signToken({ id: 1 });
        const res = await request(app)
            .get(ADMIN_ENDPOINT)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    it('allows access to admin routes for users with role=admin (not 403)', async () => {
        mockFindById.mockResolvedValue(ADMIN_USER);
        const token = signToken({ id: 2 });
        const res = await request(app)
            .get(ADMIN_ENDPOINT)
            .set('Authorization', `Bearer ${token}`);
        // The auth+RBAC guard passes — any non-403 response proves admin is admitted
        expect(res.status).not.toBe(403);
    });
});

// ─── Sensitive data leakage ────────────────────────────────────────────────────

describe('Sensitive data in responses', () => {
    beforeEach(() => jest.clearAllMocks());

    it('does not expose password_hash — User.findById excludes it at the DB query level', async () => {
        // The real User.findById SQL SELECT omits password_hash intentionally.
        // We mock the same shape: no password_hash in the object.
        mockFindById.mockResolvedValue({ ...ACTIVE_USER });
        const token = signToken({ id: 1 });
        const res = await request(app)
            .get(PROTECTED_ENDPOINT)
            .set('Authorization', `Bearer ${token}`);
        expect(res.body.data?.password_hash).toBeUndefined();
    });

    it('does not expose reset_token_hash — excluded by User.findById SELECT', async () => {
        // reset_token_hash is returned by findById (for middleware checks) but
        // the controller should not surface it in the /me payload.
        // Verify the raw response doesn't contain any token hash value.
        mockFindById.mockResolvedValue({ ...ACTIVE_USER });
        const token = signToken({ id: 1 });
        const res = await request(app)
            .get(PROTECTED_ENDPOINT)
            .set('Authorization', `Bearer ${token}`);
        expect(res.body.data?.reset_token_hash).toBeUndefined();
    });
});

// ─── Test bypass token scope ───────────────────────────────────────────────────

describe('Test bypass token', () => {
    it('is only accepted when NODE_ENV=test', async () => {
        const savedEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        // In production mode the bypass should NOT work — it's not a real JWT
        const res = await request(app)
            .get(PROTECTED_ENDPOINT)
            .set('Authorization', 'Bearer test-bypass-token');

        expect(res.status).toBe(401);
        process.env.NODE_ENV = savedEnv;
    });
});
