import { jest } from '@jest/globals';

// --- Mocks ---

const mockCreate = jest.fn().mockResolvedValue({ id: 'alert-1' });
const mockFindAll = jest.fn();
const mockResolve = jest.fn();
const mockDelete = jest.fn();
const mockGetUnresolvedCount = jest.fn();

jest.unstable_mockModule('../../models/system_alert.model.js', () => ({
    default: {
        create: mockCreate,
        findAll: mockFindAll,
        resolve: mockResolve,
        delete: mockDelete,
        getUnresolvedCount: mockGetUnresolvedCount,
    },
}));

const { default: AlertService } = await import('../../services/alert.service.js');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AlertService', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('triggerGenerationFailure', () => {
        it('creates an ERROR-severity GENERATION_FAILURE alert', async () => {
            await AlertService.triggerGenerationFailure('u1', 'm1', 'Timeout');
            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'GENERATION_FAILURE',
                    severity: 'ERROR',
                    userId: 'u1',
                    entityId: 'm1',
                    message: 'Timeout',
                })
            );
        });
    });

    describe('triggerUploadFailure', () => {
        it('creates a WARNING-severity UPLOAD_FAILURE alert including the filename', async () => {
            await AlertService.triggerUploadFailure('u2', 'notes.pdf', 'Unsupported format');
            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'UPLOAD_FAILURE',
                    severity: 'WARNING',
                    userId: 'u2',
                })
            );
            const callArg = mockCreate.mock.calls[0][0];
            expect(callArg.message).toContain('notes.pdf');
        });
    });

    describe('triggerStorageCritical', () => {
        it('creates a CRITICAL-severity STORAGE_CRITICAL alert with capacity values', async () => {
            await AlertService.triggerStorageCritical(100, 95);
            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'STORAGE_CRITICAL',
                    severity: 'CRITICAL',
                })
            );
            const callArg = mockCreate.mock.calls[0][0];
            expect(callArg.message).toContain('100');
            expect(callArg.message).toContain('95');
        });
    });

    describe('triggerQuotaWarning', () => {
        it('creates a USER_QUOTA_WARNING alert containing usage values', async () => {
            await AlertService.triggerQuotaWarning('u3', '450', '500');
            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'USER_QUOTA_WARNING',
                    severity: 'WARNING',
                    userId: 'u3',
                })
            );
            const callArg = mockCreate.mock.calls[0][0];
            expect(callArg.message).toContain('450');
            expect(callArg.message).toContain('500');
        });
    });

    describe('triggerQuotaExceeded', () => {
        it('creates a USER_QUOTA_EXCEEDED ERROR alert', async () => {
            await AlertService.triggerQuotaExceeded('u4', '50', '10');
            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'USER_QUOTA_EXCEEDED',
                    severity: 'ERROR',
                    userId: 'u4',
                })
            );
        });
    });

    describe('getRecentAlerts', () => {
        it('delegates to SystemAlert.findAll with passed filters', async () => {
            const filters = { severity: 'ERROR' };
            mockFindAll.mockResolvedValue([{ id: 'a1' }]);
            const result = await AlertService.getRecentAlerts(filters);
            expect(mockFindAll).toHaveBeenCalledWith(filters);
            expect(result).toHaveLength(1);
        });
    });

    describe('resolveAlert', () => {
        it('calls SystemAlert.resolve with the alert id', async () => {
            mockResolve.mockResolvedValue({ id: 'a1', resolved: true });
            await AlertService.resolveAlert('a1');
            expect(mockResolve).toHaveBeenCalledWith('a1');
        });
    });

    describe('getStats', () => {
        it('returns unresolved_count from SystemAlert', async () => {
            mockGetUnresolvedCount.mockResolvedValue(7);
            const stats = await AlertService.getStats();
            expect(stats).toEqual({ unresolved_count: 7 });
        });
    });
});
