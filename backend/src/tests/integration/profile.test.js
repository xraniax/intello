import { jest } from '@jest/globals';
import request from 'supertest';

// --- Mocks (all must be declared before any imports) ---

process.env.NODE_ENV = 'test';
process.env.PDF_STORAGE_PATH = './tmp_test_uploads';

const mockUserMethods = {
    findById: jest.fn(),
    findByIdWithPassword: jest.fn(),
    findByEmail: jest.fn(),
    adminUpdate: jest.fn(),
    comparePassword: jest.fn(),
    updatePassword: jest.fn(),
};

const mockQuery = jest.fn();

const mockQuotaService = {
    getUserStorageStats: jest.fn(),
};

const mockLoginAttemptMethods = {
    checkStatus: jest.fn().mockResolvedValue(null),
    trackFailure: jest.fn().mockResolvedValue({ attempt_count: 1, last_security_alert_sent_at: null }),
    lockTuple: jest.fn().mockResolvedValue(),
    clearTuple: jest.fn().mockResolvedValue(),
    markAlertSent: jest.fn().mockResolvedValue(),
    getTotalFailuresByEmail: jest.fn().mockResolvedValue(0),
};

jest.unstable_mockModule('../../models/user.model.js', () => ({ default: mockUserMethods }));
jest.unstable_mockModule('../../models/login_attempt.model.js', () => ({ default: mockLoginAttemptMethods }));
jest.unstable_mockModule('../../utils/config/db.js', () => ({ query: mockQuery }));
jest.unstable_mockModule('../../services/quota.service.js', () => ({ default: mockQuotaService }));

// --- App import after mocks ---
const { default: app } = await import('../../app.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AUTH_USER = {
    id: 'uuid-1',
    email: 'alice@example.com',
    name: 'Alice Smith',
    role: 'user',
    avatar_url: null,
    created_at: '2024-01-01T00:00:00Z',
    achievements: [],
    settings: { theme: 'system', notifications: true },
};

const AUTH_TOKEN = 'test-bypass-token';

const mockSubjectsResult = { rows: [{ count: '2' }] };
const mockMaterialsResult = { rows: [{ count: '5' }] };
const mockReadinessResult = { rows: [
    { name: 'Math', readiness: 0 },
    { name: 'Science', readiness: 0 }
]};
const mockUploadsResult = { rows: [
    { id: 'upload-1', title: 'Math Notes', type: 'upload', created_at: '2024-01-01T00:00:00Z' }
]};
const mockQuizzesResult = { rows: [
    { id: 'quiz-1', title: 'Math Quiz', type: 'quiz', created_at: '2024-01-01T00:00:00Z', status: 'completed' }
]};
const mockChatResult = { rows: [
    { id: 'chat-1', query: 'What is 2+2?', response: '4', created_at: '2024-01-01T00:00:00Z' }
]};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Profile Management', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockQuotaService.getUserStorageStats.mockResolvedValue({
            used: 50,
            limit: 100,
            percentage: 50
        });
    });

    describe('GET /api/profile', () => {
        it('returns user profile with stats and activity', async () => {
            mockUserMethods.findById.mockResolvedValue(AUTH_USER);
            mockQuery.mockImplementation((queryString) => {
                if (queryString.includes('subjects')) return Promise.resolve(mockSubjectsResult);
                if (queryString.includes('materials') && queryString.includes('COUNT')) return Promise.resolve(mockMaterialsResult);
                if (queryString.includes('readiness')) return Promise.resolve(mockReadinessResult);
                if (queryString.includes('materials') && queryString.includes('upload')) return Promise.resolve(mockUploadsResult);
                if (queryString.includes('materials') && queryString.includes('quiz')) return Promise.resolve(mockQuizzesResult);
                if (queryString.includes('chat_history')) return Promise.resolve(mockChatResult);
                return Promise.resolve({ rows: [] });
            });

            const res = await request(app)
                .get('/api/profile')
                .set('Authorization', `Bearer ${AUTH_TOKEN}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.basic_info).toEqual({
                id: AUTH_USER.id,
                name: AUTH_USER.name,
                email: AUTH_USER.email,
                role: AUTH_USER.role,
                avatar_url: AUTH_USER.avatar_url,
                created_at: AUTH_USER.created_at,
                achievements: AUTH_USER.achievements
            });
            expect(res.body.data.stats).toEqual({
                total_workspaces: 2,
                total_materials: 5,
                subject_readiness: mockReadinessResult.rows
            });
            expect(res.body.data.activity).toEqual({
                recent_uploads: mockUploadsResult.rows,
                recent_quizzes: mockQuizzesResult.rows,
                recent_interactions: mockChatResult.rows
            });
            expect(res.body.data.quota).toEqual({
                used: 50,
                limit: 100,
                percentage: 50
            });
            expect(res.body.data.analytics.learning_status).toBe('Active Learner');
        });

        it('returns "Getting Started" status for new users', async () => {
            mockUserMethods.findById.mockResolvedValue(AUTH_USER);
            mockQuery.mockResolvedValue({ rows: [] }); // No activity

            const res = await request(app)
                .get('/api/profile')
                .set('Authorization', `Bearer ${AUTH_TOKEN}`);

            expect(res.status).toBe(200);
            expect(res.body.data.analytics.learning_status).toBe('Getting Started');
        });

        it('handles missing chat history table gracefully', async () => {
            mockUserMethods.findById.mockResolvedValue(AUTH_USER);
            mockQuery.mockImplementation((queryString) => {
                if (queryString.includes('chat_history')) return Promise.reject(new Error('Table does not exist'));
                return Promise.resolve({ rows: [] });
            });

            const res = await request(app)
                .get('/api/profile')
                .set('Authorization', `Bearer ${AUTH_TOKEN}`);

            expect(res.status).toBe(200);
            expect(res.body.data.activity.recent_interactions).toEqual([]);
        });

        it('returns 401 when not authenticated', async () => {
            const res = await request(app).get('/api/profile');

            expect(res.status).toBe(401);
        });
    });

    describe('PUT /api/profile', () => {
        it('updates user name successfully', async () => {
            const updatedUser = { ...AUTH_USER, name: 'Alice Johnson' };
            mockUserMethods.findById.mockResolvedValue(updatedUser);
            mockUserMethods.adminUpdate.mockResolvedValue();

            const res = await request(app)
                .put('/api/profile')
                .set('Authorization', `Bearer ${AUTH_TOKEN}`)
                .send({ name: 'Alice Johnson' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('Alice Johnson');
            expect(mockUserMethods.adminUpdate).toHaveBeenCalledWith(AUTH_USER.id, { name: 'Alice Johnson' });
        });

        it('updates avatar URL successfully', async () => {
            const updatedUser = { ...AUTH_USER, avatar_url: 'https://example.com/avatar.jpg' };
            mockUserMethods.findById.mockResolvedValue(updatedUser);
            mockUserMethods.adminUpdate.mockResolvedValue();

            const res = await request(app)
                .put('/api/profile')
                .set('Authorization', `Bearer ${AUTH_TOKEN}`)
                .send({ avatar_url: 'https://example.com/avatar.jpg' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.avatar_url).toBe('https://example.com/avatar.jpg');
        });

        it('updates settings successfully', async () => {
            const updatedUser = { ...AUTH_USER, settings: { theme: 'dark', notifications: false } };
            mockUserMethods.findById.mockResolvedValue(updatedUser);
            mockUserMethods.adminUpdate.mockResolvedValue();

            const res = await request(app)
                .put('/api/profile')
                .set('Authorization', `Bearer ${AUTH_TOKEN}`)
                .send({ settings: { theme: 'dark', notifications: false } });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.settings).toEqual({ theme: 'dark', notifications: false });
        });

        it('validates empty name', async () => {
            const res = await request(app)
                .put('/api/profile')
                .set('Authorization', `Bearer ${AUTH_TOKEN}`)
                .send({ name: '' });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Name is required');
        });

        it('validates invalid avatar URL', async () => {
            const res = await request(app)
                .put('/api/profile')
                .set('Authorization', `Bearer ${AUTH_TOKEN}`)
                .send({ avatar_url: 'not-a-url' });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Invalid avatar URL');
        });

        it('persists updates correctly', async () => {
            const updatedUser = { ...AUTH_USER, name: 'Updated Name', avatar_url: 'https://example.com/new-avatar.jpg' };
            mockUserMethods.findById.mockResolvedValue(updatedUser);
            mockUserMethods.adminUpdate.mockResolvedValue();

            await request(app)
                .put('/api/profile')
                .set('Authorization', `Bearer ${AUTH_TOKEN}`)
                .send({ name: 'Updated Name', avatar_url: 'https://example.com/new-avatar.jpg' });

            const res = await request(app)
                .get('/api/profile')
                .set('Authorization', `Bearer ${AUTH_TOKEN}`);

            expect(res.body.data.basic_info.name).toBe('Updated Name');
            expect(res.body.data.basic_info.avatar_url).toBe('https://example.com/new-avatar.jpg');
        });

        it('returns 401 when not authenticated', async () => {
            const res = await request(app)
                .put('/api/profile')
                .send({ name: 'New Name' });

            expect(res.status).toBe(401);
        });
    });

    describe('POST /api/profile/change-password', () => {
        it('changes password with correct current password', async () => {
            mockUserMethods.findByIdWithPassword.mockResolvedValue({ ...AUTH_USER, password_hash: '$oldhash' });
            mockUserMethods.comparePassword.mockResolvedValue(true);
            mockUserMethods.updatePassword.mockResolvedValue();

            const res = await request(app)
                .post('/api/profile/change-password')
                .set('Authorization', `Bearer ${AUTH_TOKEN}`)
                .send({
                    current_password: 'CurrentPass1!',
                    new_password: 'NewPass123!',
                    confirm_password: 'NewPass123!'
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Password changed successfully');
            expect(mockUserMethods.findByIdWithPassword).toHaveBeenCalledWith(AUTH_USER.id);
            expect(mockUserMethods.comparePassword).toHaveBeenCalledWith('CurrentPass1!', '$oldhash');
            expect(mockUserMethods.updatePassword).toHaveBeenCalledWith(AUTH_USER.id, 'NewPass123!');
        });

        it('rejects change when current password is wrong', async () => {
            mockUserMethods.findByIdWithPassword.mockResolvedValue({ ...AUTH_USER, password_hash: '$oldhash' });
            mockUserMethods.comparePassword.mockResolvedValue(false);

            const res = await request(app)
                .post('/api/profile/change-password')
                .set('Authorization', `Bearer ${AUTH_TOKEN}`)
                .send({
                    current_password: 'WrongPass1!',
                    new_password: 'NewPass123!',
                    confirm_password: 'NewPass123!'
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toBe('Current password is incorrect');
        });

        it('rejects change when new password does not meet requirements', async () => {
            mockUserMethods.findByIdWithPassword.mockResolvedValue({ ...AUTH_USER, password_hash: '$oldhash' });
            mockUserMethods.comparePassword.mockResolvedValue(true);

            const res = await request(app)
                .post('/api/profile/change-password')
                .set('Authorization', `Bearer ${AUTH_TOKEN}`)
                .send({
                    current_password: 'CurrentPass1!',
                    new_password: 'weak',
                    confirm_password: 'weak'
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Password must be at least 8 characters long');
        });

        it('rejects change when passwords do not match', async () => {
            mockUserMethods.findByIdWithPassword.mockResolvedValue({ ...AUTH_USER, password_hash: '$oldhash' });
            mockUserMethods.comparePassword.mockResolvedValue(true);

            const res = await request(app)
                .post('/api/profile/change-password')
                .set('Authorization', `Bearer ${AUTH_TOKEN}`)
                .send({
                    current_password: 'CurrentPass1!',
                    new_password: 'NewPass123!',
                    confirm_password: 'DifferentPass123!'
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toBe('New passwords do not match');
        });

        it('verifies old password no longer works after change', async () => {
            mockUserMethods.findByIdWithPassword.mockResolvedValue({ ...AUTH_USER, password_hash: '$oldhash' });
            mockUserMethods.comparePassword.mockResolvedValueOnce(true);
            mockUserMethods.updatePassword.mockResolvedValue();
            mockUserMethods.findByEmail.mockResolvedValue({ ...AUTH_USER, password_hash: '$newhash' });
            mockUserMethods.comparePassword.mockResolvedValueOnce(false);

            await request(app)
                .post('/api/profile/change-password')
                .set('Authorization', `Bearer ${AUTH_TOKEN}`)
                .send({
                    current_password: 'CurrentPass1!',
                    new_password: 'NewPass123!',
                    confirm_password: 'NewPass123!'
                });

            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({
                    email: AUTH_USER.email,
                    password: 'CurrentPass1!'
                });

            expect(loginRes.status).toBe(401);
        });

        it('returns 401 when not authenticated', async () => {
            const res = await request(app)
                .post('/api/profile/change-password')
                .send({
                    current_password: 'CurrentPass1!',
                    new_password: 'NewPass123!',
                    confirm_password: 'NewPass123!'
                });

            expect(res.status).toBe(401);
        });
    });
});