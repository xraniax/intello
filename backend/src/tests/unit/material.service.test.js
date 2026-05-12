import { jest } from '@jest/globals';
import { mockUser, mockMaterial, mockSubject } from '../utils/mockData.js';
import { COMPLETED, FAILED } from '../../constants/status.enum.js';

// ─── Mocks (must be declared before any imports) ──────────────────────────────

const mockEnginePost = jest.fn();
const mockEngineGet = jest.fn();

jest.unstable_mockModule('../../services/engine.client.js', () => ({
  default: { post: mockEnginePost, get: mockEngineGet },
  engineClient: { post: mockEnginePost, get: mockEngineGet },
}));

jest.unstable_mockModule('../../models/material.model.js', () => ({
  default: {
    create: jest.fn(),
    updateAIResult: jest.fn(),
    updateContent: jest.fn(),
    updateStatus: jest.fn(),
    findById: jest.fn(),
    findByIds: jest.fn(),
    findByUserId: jest.fn(),
    findBySubjectId: jest.fn(),
    findActiveByTitle: jest.fn(),
    findTrashedByTitle: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.unstable_mockModule('../../models/subject.model.js', () => ({
  default: { touch: jest.fn().mockResolvedValue() },
}));

jest.unstable_mockModule('../../models/file.model.js', () => ({
  default: { create: jest.fn().mockResolvedValue({ id: 'file-1' }) },
}));

jest.unstable_mockModule('../../services/subject.service.js', () => ({
  default: { getOrCreateImportedSubject: jest.fn() },
}));

jest.unstable_mockModule('../../services/quota.service.js', () => ({
  default: { checkUploadAllowance: jest.fn() },
}));

jest.unstable_mockModule('../../services/alert.service.js', () => ({
  default: {
    triggerGenerationFailure: jest.fn().mockResolvedValue({}),
    triggerUploadFailure: jest.fn().mockResolvedValue({}),
    triggerQuotaWarning: jest.fn().mockResolvedValue({}),
    triggerQuotaExceeded: jest.fn().mockResolvedValue({}),
  },
}));

jest.unstable_mockModule('../../utils/services/email.service.js', () => ({
  default: jest.fn().mockResolvedValue({}),
}));

// ─── Dynamic imports after mocks ─────────────────────────────────────────────

const { default: Material } = await import('../../models/material.model.js');
const { default: SubjectService } = await import('../../services/subject.service.js');
const { default: QuotaService } = await import('../../services/quota.service.js');
const { default: MaterialService } = await import('../../services/material.service.js');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MaterialService Unit Tests', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('processDocument', () => {
    it('successfully processes a text-only document and returns COMPLETED status', async () => {
      SubjectService.getOrCreateImportedSubject.mockResolvedValue(mockSubject);
      QuotaService.checkUploadAllowance.mockResolvedValue({ allowed: true, warning: false });
      Material.findActiveByTitle.mockResolvedValue(null);
      Material.create.mockResolvedValue(mockMaterial);
      Material.findById.mockResolvedValue(mockMaterial);
      Material.updateContent.mockResolvedValue({ ...mockMaterial, content: 'Extracted text' });
      Material.updateAIResult.mockResolvedValue({ ...mockMaterial, status: COMPLETED });
      Material.updateStatus.mockResolvedValue({ ...mockMaterial, status: COMPLETED });

      mockEnginePost.mockResolvedValue({
        data: {
          status: 'success',
          job_id: 'job-abc',
        },
      });

      const result = await MaterialService.processDocument(
        mockUser.id,
        null,
        'Test Title',
        'Raw content',
        'summary'
      );

      expect(Material.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('marks material as FAILED when the AI engine throws', async () => {
      SubjectService.getOrCreateImportedSubject.mockResolvedValue(mockSubject);
      QuotaService.checkUploadAllowance.mockResolvedValue({ allowed: true, warning: false });
      Material.findActiveByTitle.mockResolvedValue(null);
      Material.create.mockResolvedValue(mockMaterial);
      Material.findById.mockResolvedValue(mockMaterial);
      Material.updateStatus.mockResolvedValue({ ...mockMaterial, status: FAILED });

      mockEnginePost.mockRejectedValue(new Error('Engine Down'));

      await MaterialService.processDocument(mockUser.id, null, 'Title', 'Content', 'summary');

      expect(Material.updateStatus).toHaveBeenCalledWith(expect.anything(), mockUser.id, FAILED);
    });

    it('throws DUPLICATE_MATERIAL (409) when a title already exists in the subject', async () => {
      SubjectService.getOrCreateImportedSubject.mockResolvedValue(mockSubject);
      QuotaService.checkUploadAllowance.mockResolvedValue({ allowed: true, warning: false });
      Material.findActiveByTitle.mockResolvedValue(mockMaterial); // duplicate found

      await expect(
        MaterialService.processDocument(mockUser.id, null, 'Test Document', 'content', 'summary')
      ).rejects.toMatchObject({ code: 'ACTIVE_DUPLICATE_MATERIAL' });
    });

    it('throws when quota check fails', async () => {
      const quotaError = Object.assign(new Error('Quota exceeded'), {
        code: 'QUOTA_EXCEEDED',
        statusCode: 403,
      });
      QuotaService.checkUploadAllowance.mockRejectedValue(quotaError);

      await expect(
        MaterialService.processDocument(mockUser.id, null, 'Title', 'Content', 'summary')
      ).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' });
    });
  });
});
