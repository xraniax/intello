/**
 * Materials API integration tests.
 *
 * engineClient is mocked at module level so no HTTP calls reach the engine.
 * UUID-valid material IDs are used because the service validates them.
 */
import { jest } from '@jest/globals';
import request from 'supertest';

// ─── Mock engineClient (must be before app import) ───────────────────────────

const mockEnginePost = jest.fn();
const mockEngineGet  = jest.fn();

jest.unstable_mockModule('../../src/services/engine.client.js', () => ({
    default: { post: mockEnginePost, get: mockEngineGet },
    engineClient: { post: mockEnginePost, get: mockEngineGet },
}));

jest.unstable_mockModule('../../src/utils/services/email.service.js', () => ({
    default: jest.fn().mockResolvedValue({}),
}));

const { default: app } = await import('../../src/app.js');

// ─── Test constants ───────────────────────────────────────────────────────────

const AUTH = { Authorization: 'Bearer test-bypass-token' };

const UUID1 = '11111111-1111-1111-1111-111111111111';
const UUID2 = '22222222-2222-2222-2222-222222222222';
const UUID_SUBJ = '99999999-9999-9999-9999-999999999999';
const UUID_NEW_MAT = '33333333-3333-3333-3333-333333333333';

const completedMaterial = (id, content = 'Some readable text content for the AI.') => ({
    id,
    title: `Doc ${id.slice(0, 4)}`,
    content,
    subject_id: UUID_SUBJ,
    status: 'COMPLETED',
    user_id: 1,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Materials API Integration', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        const SettingsService = (await import('../../src/services/settings.service.js')).default;
        SettingsService.CACHE = {};
        SettingsService.LAST_FETCH = 0;
        // Restore smart routing after clearAllMocks
        global.__mockDbQuery.mockImplementation((text, params) => {
            if (!text) return Promise.resolve({ rows: [] });
            if (text.includes('FROM users') && text.includes('WHERE id = $1')) {
                return Promise.resolve({ rows: [{ id: params?.[0], name: 'Test', email: 'test@example.com', role: 'user', status: 'ACTIVE' }] });
            }
            if (text.includes('admin_settings')) return Promise.resolve({ rows: [] });
            if (text.includes('login_attempts')) return Promise.resolve({ rows: [], rowCount: 0 });
            return Promise.resolve({ rows: [] });
        });
    });

    // ─── POST /api/materials/chat-combined ───────────────────────────────────

    describe('POST /api/materials/chat-combined', () => {
        it('returns 200 with AI response when engine succeeds', async () => {
            // Material.findByIds → two completed docs
            global.__mockDbQuery.mockImplementation((text, params) => {
                if (!text) return Promise.resolve({ rows: [] });
                if (text.includes('FROM users') && text.includes('WHERE id = $1')) {
                    return Promise.resolve({ rows: [{ id: params?.[0], name: 'Test', email: 'test@example.com', role: 'user', status: 'ACTIVE' }] });
                }
                if (text.includes('admin_settings')) return Promise.resolve({ rows: [] });
                if (text.includes('login_attempts')) return Promise.resolve({ rows: [], rowCount: 0 });
                if (text.includes('FROM materials') && text.includes('ANY')) {
                    return Promise.resolve({ rows: [completedMaterial(UUID1), completedMaterial(UUID2)] });
                }
                return Promise.resolve({ rows: [] });
            });

            mockEnginePost.mockResolvedValueOnce({
                data: { status: 'success', result: 'AI Chat Answer' },
            });

            const res = await request(app)
                .post('/api/materials/chat-combined')
                .set(AUTH)
                .send({ materialIds: [UUID1, UUID2], question: 'What is this about?' });

            expect(res.status).toBe(200);
            expect(res.body.data.result).toBe('AI Chat Answer');
        });

        it('returns 503 when engine throws an error', async () => {
            global.__mockDbQuery.mockImplementation((text, params) => {
                if (!text) return Promise.resolve({ rows: [] });
                if (text.includes('FROM users') && text.includes('WHERE id = $1')) {
                    return Promise.resolve({ rows: [{ id: params?.[0], name: 'Test', email: 'test@example.com', role: 'user', status: 'ACTIVE' }] });
                }
                if (text.includes('admin_settings')) return Promise.resolve({ rows: [] });
                if (text.includes('login_attempts')) return Promise.resolve({ rows: [], rowCount: 0 });
                if (text.includes('FROM materials') && text.includes('ANY')) {
                    return Promise.resolve({ rows: [completedMaterial(UUID1)] });
                }
                return Promise.resolve({ rows: [] });
            });

            mockEnginePost.mockRejectedValueOnce(new Error('timeout'));

            const res = await request(app)
                .post('/api/materials/chat-combined')
                .set(AUTH)
                .send({ materialIds: [UUID1], question: 'Q?' });

            expect(res.status).toBe(503);
            // The error handler falls back to statusCode when err.code is unset
            expect([503, 'ENGINE_UNAVAILABLE']).toContain(res.body.code);
        });

        it('returns 400 when materialIds or question is missing', async () => {
            const res = await request(app)
                .post('/api/materials/chat-combined')
                .set(AUTH)
                .send({ materialIds: [UUID1] }); // no question

            expect(res.status).toBe(400);
        });
    });

    // ─── POST /api/materials/generate-combined ───────────────────────────────

    describe('POST /api/materials/generate-combined', () => {
        it('returns 200 with material_id when generation job is queued', async () => {
            global.__mockDbQuery.mockImplementation((text, params) => {
                if (!text) return Promise.resolve({ rows: [] });
                if (text.includes('FROM users') && text.includes('WHERE id = $1')) {
                    return Promise.resolve({ rows: [{ id: params?.[0], name: 'Test', email: 'test@example.com', role: 'user', status: 'ACTIVE' }] });
                }
                if (text.includes('admin_settings')) return Promise.resolve({ rows: [] });
                if (text.includes('login_attempts')) return Promise.resolve({ rows: [], rowCount: 0 });
                if (text.includes('FROM materials') && text.includes('ANY')) {
                    return Promise.resolve({ rows: [completedMaterial(UUID1)] });
                }
                if (text.includes('FROM subjects') && text.includes('WHERE id = $1')) {
                    return Promise.resolve({ rows: [{ id: UUID_SUBJ, name: 'Biology', user_id: 1 }] });
                }
                if (text.includes('FROM materials') && text.includes('WHERE title = $1')) {
                    return Promise.resolve({ rows: [] }); // no duplicate title
                }
                if (text.includes('INSERT INTO materials')) {
                    return Promise.resolve({ rows: [{ id: UUID_NEW_MAT, title: 'Summary of Doc', status: 'PENDING_JOB' }] });
                }
                return Promise.resolve({ rows: [] });
            });

            mockEnginePost.mockResolvedValueOnce({
                data: { status: 'success', job_id: 'job_123' },
            });

            const res = await request(app)
                .post('/api/materials/generate-combined')
                .set(AUTH)
                .send({ materialIds: [UUID1], taskType: 'summary', subjectId: UUID_SUBJ });

            expect(res.status).toBe(200);
            expect(res.body.data).toBeDefined();
        });

        it('returns 400 when required fields are absent', async () => {
            const res = await request(app)
                .post('/api/materials/generate-combined')
                .set(AUTH)
                .send({ materialIds: [UUID1] }); // missing taskType

            expect(res.status).toBe(400);
        });
    });

    // ─── POST /api/materials/upload ──────────────────────────────────────────

    describe('POST /api/materials/upload', () => {
        it('returns 400 when neither file nor text content is provided', async () => {
            const res = await request(app)
                .post('/api/materials/upload')
                .set(AUTH)
                .send({ title: 'A', type: 'upload' });

            expect(res.status).toBe(400);
        });
    });
});
