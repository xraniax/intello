import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

// --- Mocks (must come before imports) ---

const mockFindById = jest.fn();
const mockUpdateLastActive = jest.fn().mockResolvedValue();

jest.unstable_mockModule('../../models/user.model.js', () => ({
    default: {
        findById: mockFindById,
        updateLastActive: mockUpdateLastActive,
    },
}));

// --- Dynamic imports after mocks ---
const { protect, adminOnly } = await import('../../middlewares/auth.middleware.js');

// --- Helpers ---

const JWT_SECRET = 'test-secret-key'; // matches tests/setup.js

const makeReq = (overrides = {}) => ({
    headers: {},
    ...overrides,
});

const makeRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

const signToken = (payload, expiresIn = '1h') =>
    jwt.sign(payload, JWT_SECRET, { expiresIn });

// --- protect middleware ---

describe('protect middleware', () => {
    const next = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = JWT_SECRET;
        process.env.NODE_ENV = 'test';
    });

    it('returns 401 when Authorization header is absent', async () => {
        const req = makeReq();
        const res = makeRes();
        await protect(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when Bearer token is malformed', async () => {
        const req = makeReq({ headers: { authorization: 'Bearer not.a.jwt' } });
        const res = makeRes();
        await protect(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'TOKEN_INVALID' })
        );
    });

    it('returns 401 with TOKEN_EXPIRED when token is expired', async () => {
        const expiredToken = signToken({ id: 99 }, '-1s');
        const req = makeReq({ headers: { authorization: `Bearer ${expiredToken}` } });
        const res = makeRes();
        await protect(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'TOKEN_EXPIRED' })
        );
    });

    it('returns 401 when decoded user does not exist in DB', async () => {
        mockFindById.mockResolvedValue(null);
        const token = signToken({ id: 42 });
        const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
        const res = makeRes();
        await protect(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 when user account is SUSPENDED', async () => {
        mockFindById.mockResolvedValue({ id: 1, status: 'SUSPENDED', role: 'user' });
        const token = signToken({ id: 1 });
        const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
        const res = makeRes();
        await protect(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'ACCOUNT_SUSPENDED' })
        );
    });

    it('calls next() and attaches user for a valid active user', async () => {
        const user = { id: 1, status: 'ACTIVE', role: 'user', name: 'Alice' };
        mockFindById.mockResolvedValue(user);
        const token = signToken({ id: 1 });
        const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
        const res = makeRes();
        await protect(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(req.user).toEqual(user);
    });

    it('uses the test bypass token in NODE_ENV=test', async () => {
        const req = makeReq({ headers: { authorization: 'Bearer test-bypass-token' } });
        const res = makeRes();
        await protect(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(req.user).toMatchObject({ id: 1, email: 'test@example.com' });
        expect(mockFindById).not.toHaveBeenCalled();
    });

    it('returns 500 when JWT_SECRET env var is missing', async () => {
        const saved = process.env.JWT_SECRET;
        delete process.env.JWT_SECRET;
        const req = makeReq({ headers: { authorization: 'Bearer sometoken' } });
        const res = makeRes();
        await protect(req, res, next);
        expect(res.status).toHaveBeenCalledWith(500);
        process.env.JWT_SECRET = saved;
    });
});

// --- adminOnly middleware ---

describe('adminOnly middleware', () => {
    const next = jest.fn();

    beforeEach(() => jest.clearAllMocks());

    it('returns 403 when user is not admin', () => {
        const req = { user: { id: 1, role: 'user' } };
        const res = makeRes();
        adminOnly(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 when req.user is absent', () => {
        const req = {};
        const res = makeRes();
        adminOnly(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('calls next() when user has admin role', () => {
        const req = { user: { id: 99, role: 'admin' } };
        const res = makeRes();
        adminOnly(req, res, next);
        expect(next).toHaveBeenCalled();
    });
});
