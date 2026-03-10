import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';

const token = global.generateTestToken(1);

describe('Subjects API Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/subjects', () => {
        it('should create a subject when valid and named uniquely', async () => {
            // 1. findByName returns nothing (no duplicate)
            global.__mockDbQuery.mockResolvedValueOnce({ rows: [] });
            // 2. create Subject returns the new record
            global.__mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 10, name: 'Math', description: 'Calculus' }] });

            const res = await request(app)
                .post('/api/subjects')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Math', description: 'Calculus' });

            expect(res.status).toBe(201);
            expect(res.body.data.name).toBe('Math');
        });

        it('should return 409 if subject name already exists for user', async () => {
            // Find returns an existing record
            global.__mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 5, name: 'Math' }] });

            const res = await request(app)
                .post('/api/subjects')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Math' });

            expect(res.status).toBe(409);
            expect(res.body.code).toBe('DUPLICATE_SUBJECT');
        });

        it('should return 400 (validation error) if name is empty', async () => {
            const res = await request(app)
                .post('/api/subjects')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: '' });

            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
            expect(res.body.errors.name).toBeDefined();
        });
    });

    describe('GET /api/subjects', () => {
        it('should return an array of subjects', async () => {
            global.__mockDbQuery.mockResolvedValueOnce({
                rows: [
                    { id: 1, name: 'Math', material_count: 2 },
                    { id: 2, name: 'Science', material_count: 0 }
                ]
            });

            const res = await request(app)
                .get('/api/subjects')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBe(2);
        });
    });

    describe('PATCH /api/subjects/:id', () => {
        it('should rename successfully', async () => {
            // findByName duplicate check returns nothing
            global.__mockDbQuery.mockResolvedValueOnce({ rows: [] });
            // update returns renamed
            global.__mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Advanced Math' }] });

            const res = await request(app)
                .patch('/api/subjects/1')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Advanced Math' });

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('Advanced Math');
        });

        it('should return 409 on rename duplicate', async () => {
            // findByName returns a different subject with the same intended name
            global.__mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 2, name: 'Biology' }] });

            const res = await request(app)
                .patch('/api/subjects/1')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Biology' });

            expect(res.status).toBe(409);
            expect(res.body.code).toBe('DUPLICATE_SUBJECT');
        });
    });
});
