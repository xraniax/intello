import { jest } from '@jest/globals';

const mockEnginePost = jest.fn();
jest.unstable_mockModule('../../src/services/engine.client.js', () => ({
    default: { post: mockEnginePost },
    engineClient: { post: mockEnginePost },
}));

const { default: MaterialService } = await import('../../src/services/material.service.js');

describe('MaterialService.chat', () => {
  const mockUserId = 1;
  const mockSubjectId = '99de6ff4-9444-4a3d-ad4a-ef14c93b7d8d';
  const mockQuestion = 'Explain caching';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should fail if user does not own the subject', async () => {
    global.__mockDbQuery.mockImplementation((text) => {
        if (text.includes('FROM subjects')) return Promise.resolve({ rows: [] });
        return Promise.resolve({ rows: [] });
    });

    await expect(MaterialService.chat(mockUserId, mockSubjectId, mockQuestion, []))
      .rejects.toThrow('Subject not found or access denied');
  });

  test('should forward request to engine and log interaction', async () => {
    global.__mockDbQuery.mockImplementation((text) => {
      if (text.includes('FROM subjects')) return Promise.resolve({ rows: [{ id: mockSubjectId }] });
      if (text.includes('INSERT INTO chat_audit')) return Promise.resolve({ rows: [{ id: 456 }] });
      return Promise.resolve({ rows: [] });
    });
    
    mockEnginePost.mockResolvedValueOnce({
      data: {
        answer: 'Caching is storing data for faster access.',
        sources: [],
        confidence: 0.95,
        latency_ms: 120
      }
    });

    const result = await MaterialService.chat(mockUserId, mockSubjectId, mockQuestion, []);

    expect(result.answer).toBe('Caching is storing data for faster access.');
    expect(mockEnginePost).toHaveBeenCalled();
  });

  test('should handle engine unavailability gracefully', async () => {
    global.__mockDbQuery.mockImplementation((text) => {
        if (text.includes('FROM subjects')) return Promise.resolve({ rows: [{ id: mockSubjectId }] });
        return Promise.resolve({ rows: [] });
    });
    mockEnginePost.mockRejectedValueOnce(new Error('Engine timeout'));

    await expect(MaterialService.chat(mockUserId, mockSubjectId, mockQuestion, []))
      .rejects.toThrow(/engine is currently unavailable/i);
  });
});
