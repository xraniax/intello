import { jest } from '@jest/globals';
import crypto from 'crypto';

// --- Mocks ---

const mockQuery = jest.fn();

jest.unstable_mockModule('../../utils/config/db.js', () => ({
    query: mockQuery,
}));

// bcrypt is a native module — mock it at the module level
jest.unstable_mockModule('bcrypt', () => ({
    default: {
        hash: jest.fn().mockResolvedValue('$hashed$'),
        compare: jest.fn(),
    },
}));

const { default: User } = await import('../../models/user.model.js');
const { default: bcrypt } = await import('bcrypt');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fakeUser = {
    id: 'uuid-1',
    email: 'alice@example.com',
    name: 'Alice',
    role: 'user',
    status: 'ACTIVE',
    password_hash: '$hashed$',
};

// ─── comparePassword ──────────────────────────────────────────────────────────

describe('User.comparePassword', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns true when password matches hash', async () => {
        bcrypt.compare.mockResolvedValue(true);
        const result = await User.comparePassword('secret123', '$hashed$');
        expect(result).toBe(true);
        expect(bcrypt.compare).toHaveBeenCalledWith('secret123', '$hashed$');
    });

    it('returns false when password does not match', async () => {
        bcrypt.compare.mockResolvedValue(false);
        const result = await User.comparePassword('wrong', '$hashed$');
        expect(result).toBe(false);
    });

    it('returns false immediately when no hash is stored (social login user)', async () => {
        const result = await User.comparePassword('anything', null);
        expect(result).toBe(false);
        expect(bcrypt.compare).not.toHaveBeenCalled();
    });
});

// ─── createResetToken ─────────────────────────────────────────────────────────

describe('User.createResetToken', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns a hex string token and stores its SHA-256 hash in DB', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const token = await User.createResetToken('uuid-1');

        expect(typeof token).toBe('string');
        expect(token).toHaveLength(64); // 32 bytes → 64 hex chars

        // Verify that the stored hash corresponds to the returned token
        const expectedHash = crypto.createHash('sha256').update(token).digest('hex');
        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining('reset_token_hash'),
            expect.arrayContaining([expectedHash])
        );
    });
});

// ─── findByResetToken ─────────────────────────────────────────────────────────

describe('User.findByResetToken', () => {
    beforeEach(() => jest.clearAllMocks());

    it('hashes the token before querying and returns the user', async () => {
        mockQuery.mockResolvedValue({ rows: [fakeUser] });

        const plainToken = 'a'.repeat(64);
        const result = await User.findByResetToken(plainToken);

        const expectedHash = crypto.createHash('sha256').update(plainToken).digest('hex');
        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining('reset_token_hash'),
            expect.arrayContaining([expectedHash])
        );
        expect(result).toEqual(fakeUser);
    });

    it('returns undefined when token does not match / is expired', async () => {
        mockQuery.mockResolvedValue({ rows: [] });
        const result = await User.findByResetToken('invalid');
        expect(result).toBeUndefined();
    });
});

// ─── create ───────────────────────────────────────────────────────────────────

describe('User.create', () => {
    beforeEach(() => jest.clearAllMocks());

    it('hashes the password before inserting', async () => {
        mockQuery.mockResolvedValue({ rows: [fakeUser] });

        await User.create('alice@example.com', 'plaintext', 'Alice');

        expect(bcrypt.hash).toHaveBeenCalledWith('plaintext', 12);
        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO users'),
            expect.arrayContaining(['alice@example.com', '$hashed$', 'Alice'])
        );
    });

    it('inserts null password_hash for social login users (no password)', async () => {
        mockQuery.mockResolvedValue({ rows: [{ ...fakeUser, password_hash: null }] });

        await User.create('bob@google.com', null, 'Bob', 'user', 'google', 'google-id-1');

        expect(bcrypt.hash).not.toHaveBeenCalled();
        const queryArgs = mockQuery.mock.calls[0][1];
        expect(queryArgs[1]).toBeNull(); // second param is password_hash
    });
});

// ─── findByEmail ──────────────────────────────────────────────────────────────

describe('User.findByEmail', () => {
    beforeEach(() => jest.clearAllMocks());

    it('queries by email and returns the first row', async () => {
        mockQuery.mockResolvedValue({ rows: [fakeUser] });
        const result = await User.findByEmail('alice@example.com');
        expect(result).toEqual(fakeUser);
        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining('WHERE email'),
            ['alice@example.com']
        );
    });

    it('returns undefined when no matching user', async () => {
        mockQuery.mockResolvedValue({ rows: [] });
        const result = await User.findByEmail('ghost@example.com');
        expect(result).toBeUndefined();
    });
});

// ─── updatePassword ───────────────────────────────────────────────────────────

describe('User.updatePassword', () => {
    beforeEach(() => jest.clearAllMocks());

    it('hashes new password and clears reset token fields', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await User.updatePassword('uuid-1', 'newSecret!');

        expect(bcrypt.hash).toHaveBeenCalledWith('newSecret!', 12);
        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining('reset_token_hash = NULL'),
            expect.arrayContaining(['$hashed$', 'uuid-1'])
        );
    });
});
