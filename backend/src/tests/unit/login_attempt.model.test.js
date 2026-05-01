import { jest } from '@jest/globals';

// --- Mocks ---

const mockQuery = jest.fn();

jest.unstable_mockModule('../../utils/config/db.js', () => ({
    query: mockQuery,
}));

const { default: LoginAttempt } = await import('../../models/login_attempt.model.js');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LoginAttempt model', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('trackFailure', () => {
        it('upserts a failure record and returns the row', async () => {
            const fakeRow = { email: 'a@b.com', attempt_count: 1 };
            mockQuery.mockResolvedValue({ rows: [fakeRow] });

            const result = await LoginAttempt.trackFailure('a@b.com', '1.2.3.4', 'hash123', 'Chrome');

            expect(mockQuery).toHaveBeenCalledTimes(1);
            expect(mockQuery.mock.calls[0][0]).toMatch(/INSERT INTO login_attempts/);
            expect(result).toEqual(fakeRow);
        });

        it('passes all four parameters to the query', async () => {
            mockQuery.mockResolvedValue({ rows: [{}] });
            await LoginAttempt.trackFailure('x@y.com', '5.6.7.8', 'abcdef', 'Firefox/120');
            const params = mockQuery.mock.calls[0][1];
            expect(params).toEqual(['x@y.com', '5.6.7.8', 'abcdef', 'Firefox/120']);
        });
    });

    describe('lockTuple', () => {
        it('updates locked_until for the matching tuple', async () => {
            mockQuery.mockResolvedValue({ rows: [] });
            await LoginAttempt.lockTuple('a@b.com', '1.1.1.1', 'hash');
            expect(mockQuery.mock.calls[0][0]).toMatch(/locked_until/);
            expect(mockQuery.mock.calls[0][1]).toEqual(['a@b.com', '1.1.1.1', 'hash']);
        });
    });

    describe('clearTuple', () => {
        it('deletes the matching tuple', async () => {
            mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
            await LoginAttempt.clearTuple('a@b.com', '1.1.1.1', 'hash');
            expect(mockQuery.mock.calls[0][0]).toMatch(/DELETE FROM login_attempts/);
        });
    });

    describe('checkStatus', () => {
        it('returns the record when tuple exists', async () => {
            const row = { email: 'a@b.com', locked_until: null, attempt_count: 2 };
            mockQuery.mockResolvedValue({ rows: [row] });
            const result = await LoginAttempt.checkStatus('a@b.com', '1.1.1.1', 'hash');
            expect(result).toEqual(row);
        });

        it('returns undefined when no tuple exists', async () => {
            mockQuery.mockResolvedValue({ rows: [] });
            const result = await LoginAttempt.checkStatus('ghost@b.com', '1.1.1.1', 'hash');
            expect(result).toBeUndefined();
        });
    });

    describe('markAlertSent', () => {
        it('updates last_security_alert_sent_at for the tuple', async () => {
            mockQuery.mockResolvedValue({ rows: [] });
            await LoginAttempt.markAlertSent('a@b.com', '1.1.1.1', 'hash');
            expect(mockQuery.mock.calls[0][0]).toMatch(/last_security_alert_sent_at/);
        });
    });
});
