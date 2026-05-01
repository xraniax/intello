import { jest } from '@jest/globals';

// --- Mocks ---

const mockQuery = jest.fn();
const mockGetStorageControls = jest.fn();
const mockFindById = jest.fn();
const mockSystemAlertCreate = jest.fn().mockResolvedValue({});

jest.unstable_mockModule('../../utils/config/db.js', () => ({
    query: mockQuery,
}));

jest.unstable_mockModule('../../services/settings.service.js', () => ({
    default: { getStorageControls: mockGetStorageControls },
}));

jest.unstable_mockModule('../../models/user.model.js', () => ({
    default: { findById: mockFindById },
}));

jest.unstable_mockModule('../../models/system_alert.model.js', () => ({
    default: { create: mockSystemAlertCreate },
}));

// --- Dynamic imports ---
const { default: QuotaService } = await import('../../services/quota.service.js');

// --- Helpers ---

const MB = 1024 * 1024;
const GB = 1024 * MB;

const defaultControls = {
    default_user_quota_mb: 500,
    max_cluster_size_bytes: 10 * GB,
};

const makeStorageRow = (usedBytes, limitBytes = 500 * MB, status = 'ACTIVE') => ({
    used_bytes: usedBytes,
    storage_limit_bytes: limitBytes,
    status,
});

// ─── getUserStorageStats ───────────────────────────────────────────────────────

describe('QuotaService.getUserStorageStats', () => {
    beforeEach(() => jest.clearAllMocks());

    it('throws if userId is falsy', async () => {
        await expect(QuotaService.getUserStorageStats(null)).rejects.toThrow('User ID is required');
    });

    it('returns correct stats for a user with usage', async () => {
        mockQuery.mockResolvedValue({ rows: [makeStorageRow(100 * MB, 500 * MB)] });
        mockGetStorageControls.mockResolvedValue(defaultControls);

        const stats = await QuotaService.getUserStorageStats('user-1');

        expect(stats.usedBytes).toBe(100 * MB);
        expect(stats.limitBytes).toBe(500 * MB);
        expect(stats.status).toBe('ACTIVE');
    });

    it('falls back to default quota when user has no uploads yet', async () => {
        mockQuery.mockResolvedValue({ rows: [] });
        mockFindById.mockResolvedValue({ id: 'user-1', storage_limit_bytes: null, status: 'ACTIVE' });
        mockGetStorageControls.mockResolvedValue(defaultControls);

        const stats = await QuotaService.getUserStorageStats('user-1');

        expect(stats.usedBytes).toBe(0);
        expect(stats.limitBytes).toBe(500 * MB);
    });

    it('throws when user is not found and no rows returned', async () => {
        mockQuery.mockResolvedValue({ rows: [] });
        mockFindById.mockResolvedValue(null);
        mockGetStorageControls.mockResolvedValue(defaultControls);

        await expect(QuotaService.getUserStorageStats('ghost')).rejects.toThrow('User not found');
    });
});

// ─── checkUploadAllowance ──────────────────────────────────────────────────────

describe('QuotaService.checkUploadAllowance', () => {
    beforeEach(() => jest.clearAllMocks());

    const makeGlobalRow = (totalUsedBytes) => ({ rows: [{ total_used_bytes: totalUsedBytes }] });

    // Simulate getUserStorageStats and getGlobalStorageStats via query mock
    const setupMocks = ({ usedBytes, limitBytes, totalUsedBytes, status = 'ACTIVE' }) => {
        mockGetStorageControls.mockResolvedValue(defaultControls);

        // First query → getUserStorageStats
        mockQuery
            .mockResolvedValueOnce({ rows: [makeStorageRow(usedBytes, limitBytes, status)] })
            // Second query → getGlobalStorageStats
            .mockResolvedValueOnce(makeGlobalRow(totalUsedBytes));
    };

    it('throws ACCOUNT_SUSPENDED when user is suspended', async () => {
        setupMocks({ usedBytes: 0, limitBytes: 500 * MB, totalUsedBytes: 0, status: 'SUSPENDED' });

        await expect(QuotaService.checkUploadAllowance('user-1', 10 * MB))
            .rejects.toMatchObject({ code: 'ACCOUNT_SUSPENDED', statusCode: 403 });
    });

    it('throws STORAGE_FULL when global capacity is exceeded', async () => {
        const nearlyFull = defaultControls.max_cluster_size_bytes - 1 * MB;
        setupMocks({ usedBytes: 0, limitBytes: 500 * MB, totalUsedBytes: nearlyFull });

        await expect(QuotaService.checkUploadAllowance('user-1', 5 * MB))
            .rejects.toMatchObject({ code: 'STORAGE_FULL', statusCode: 403 });
    });

    it('throws QUOTA_EXCEEDED when individual limit is breached', async () => {
        setupMocks({ usedBytes: 490 * MB, limitBytes: 500 * MB, totalUsedBytes: 490 * MB });

        await expect(QuotaService.checkUploadAllowance('user-1', 20 * MB))
            .rejects.toMatchObject({ code: 'QUOTA_EXCEEDED', statusCode: 403 });
    });

    it('returns { allowed: true } for a normal upload well within quota', async () => {
        setupMocks({ usedBytes: 100 * MB, limitBytes: 500 * MB, totalUsedBytes: 100 * MB });

        const result = await QuotaService.checkUploadAllowance('user-1', 10 * MB);
        expect(result).toEqual({ allowed: true, warning: false });
    });

    it('returns { allowed: true, warning: true } when post-upload usage exceeds 90%', async () => {
        // used 450 MB, limit 500 MB → uploading 10 MB brings ratio to 92 %
        setupMocks({ usedBytes: 450 * MB, limitBytes: 500 * MB, totalUsedBytes: 450 * MB });

        const result = await QuotaService.checkUploadAllowance('user-1', 10 * MB);
        expect(result.allowed).toBe(true);
        expect(result.warning).toBe(true);
    });
});
