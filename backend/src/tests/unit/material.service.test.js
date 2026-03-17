import { jest } from '@jest/globals';
import { mockUser, mockMaterial, mockSubject } from '../utils/mockData.js';

// Define mocks before anything else
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
        delete: jest.fn()
    }
}));

jest.unstable_mockModule('../../services/subject.service.js', () => ({
    default: {
        getOrCreateImportedSubject: jest.fn()
    }
}));

jest.unstable_mockModule('axios', () => ({
    default: {
        post: jest.fn()
    }
}));

// Import everything after mocks are defined
const { default: axios } = await import('axios');
const { default: Material } = await import('../../models/material.model.js');
const { default: SubjectService } = await import('../../services/subject.service.js');
const { default: MaterialService } = await import('../../services/material.service.js');

describe('MaterialService Unit Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('processDocument', () => {
        it('should successfully process a text-only document', async () => {
            // Setup mocks using the imported (mocked) modules
            SubjectService.getOrCreateImportedSubject.mockResolvedValue(mockSubject);
            Material.create.mockResolvedValue(mockMaterial);
            Material.findById.mockResolvedValue(mockMaterial);
            Material.updateContent.mockResolvedValue({ ...mockMaterial, content: 'Extracted text' });
            Material.updateAIResult.mockResolvedValue(mockMaterial);

            axios.post.mockResolvedValue({
                data: {
                    status: 'success',
                    data: {
                        extracted_text: 'Extracted text',
                        result: 'AI Result',
                        chunks: [],
                        embeddings: []
                    }
                }
            });

            const result = await MaterialService.processDocument(
                mockUser.id,
                null,
                'Test Title',
                'Raw content',
                'summary'
            );

            expect(Material.create).toHaveBeenCalled();
            expect(result.status).toBe('completed');
        });

        it('should handle AI engine failure by marking status as failed', async () => {
            SubjectService.getOrCreateImportedSubject.mockResolvedValue(mockSubject);
            Material.create.mockResolvedValue(mockMaterial);
            Material.findById.mockResolvedValue(mockMaterial);

            axios.post.mockRejectedValue(new Error('Engine Down'));

            const result = await MaterialService.processDocument(
                mockUser.id,
                null,
                'Title',
                'Content',
                'summary'
            );

            expect(Material.updateStatus).toHaveBeenCalledWith(expect.anything(), mockUser.id, 'failed');
        });
    });
});
