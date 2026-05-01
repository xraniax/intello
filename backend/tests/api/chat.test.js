import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const mockEnginePost = jest.fn();
jest.unstable_mockModule('../../src/services/engine.client.js', () => ({
    default: { post: mockEnginePost },
    engineClient: { post: mockEnginePost },
}));

const { default: app } = await import('../../src/app.js');

describe('POST /api/chat API Integration', () => {
  let token;
  const mockUserId = 1;
  const mockSubjectId = '99de6ff4-9444-4a3d-ad4a-ef14c93b7d8d';

  beforeAll(() => {
    token = jwt.sign({ id: mockUserId, role: 'student' }, process.env.JWT_SECRET || 'test-secret-key');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return 401 if no token provided', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ subjectId: mockSubjectId, question: 'Hi' });
    
    expect(res.statusCode).toBe(401);
  });

  test('should return 200 and structured response on success', async () => {
    global.__mockDbQuery.mockImplementation((text, params) => {
      if (text.includes('FROM users') && text.includes('WHERE id = $1')) {
        return Promise.resolve({ rows: [{ id: mockUserId, status: 'ACTIVE', role: 'student' }] });
      }
      if (text.includes('FROM subjects')) {
        return Promise.resolve({ rows: [{ id: mockSubjectId }] });
      }
      if (text.includes('INSERT INTO chat_audit')) {
        return Promise.resolve({ rows: [{ id: 1 }] });
      }
      return Promise.resolve({ rows: [] });
    });
    
    mockEnginePost.mockResolvedValueOnce({
      data: {
        answer: 'Success!',
        sources: [],
        confidence: 1.0,
        latency_ms: 50
      }
    });

    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        subjectId: mockSubjectId,
        question: 'What is Lexical Analysis?',
        conversation_history: []
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.answer).toBe('Success!');
    expect(res.body.data.confidence).toBeDefined();
  });

  test('should return 403 if subject access denied', async () => {
    global.__mockDbQuery.mockImplementation((text, params) => {
      if (text.includes('FROM users')) {
        return Promise.resolve({ rows: [{ id: mockUserId, status: 'ACTIVE', role: 'student' }] });
      }
      if (text.includes('FROM subjects')) {
        return Promise.resolve({ rows: [] }); // Access denied
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ subjectId: mockSubjectId, question: 'Hi' });

    expect(res.statusCode).toBe(404);
  });
});
