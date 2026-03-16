import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import fs from 'fs';
import path from 'path';

const token = global.generateTestToken(1);
const __dirname = path.resolve();

describe('Materials API Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/materials/chat-combined', () => {
        it('should return AI response successfully', async () => {
            // Mock DB: return 2 existing materials
            global.__mockDbQuery.mockResolvedValueOnce({
                rows: [
                    { id: 1, title: 'Doc1', content: 'Text 1' },
                    { id: 2, title: 'Doc2', content: 'Text 2' }
                ]
            });
            // Mock Axios: AI Engine Success
            global.__mockAxiosPost.mockResolvedValueOnce({
                data: { status: 'success', result: 'AI Chat Answer' }
            });

            const res = await request(app)
                .post('/api/materials/chat-combined')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    materialIds: [1, 2],
                    question: 'What is this about?'
                });

            expect(res.status).toBe(200);
            expect(res.body.data.result).toBe('AI Chat Answer');
        });

        it('should return 503 when AI Engine times out or is unreachable', async () => {
            // Mock DB
            global.__mockDbQuery.mockResolvedValueOnce({
                rows: [{ id: 1, title: 'Doc1', content: 'Text 1' }]
            });

            // Mock Axios to throw ECONNABORTED (timeout)
            const mockAxios = (await import('axios')).default;
            const timeoutError = new Error('timeout');
            timeoutError.code = 'ECONNABORTED';
            global.__mockAxiosPost.mockRejectedValueOnce(timeoutError);

            const res = await request(app)
                .post('/api/materials/chat-combined')
                .set('Authorization', `Bearer ${token}`)
                .send({ materialIds: [1], question: 'Q' });

            expect(res.status).toBe(503);
            expect(res.body.code).toBe('ENGINE_TIMEOUT');
        });

        it('should return 400 for missing question or empty materialIds (Zod validation)', async () => {
            const res = await request(app)
                .post('/api/materials/chat-combined')
                .set('Authorization', `Bearer ${token}`)
                .send({ materialIds: [], question: '' });

            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
            expect(res.body.errors.materialIds).toBeDefined();
            expect(res.body.errors.question).toBeDefined();
        });
    });

    describe('POST /api/materials/generate-combined', () => {
        it('should generate materials successfully', async () => {
            global.__mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 1, title: 'A', content: 'B' }] });
            global.__mockAxiosPost.mockResolvedValueOnce({
                data: { status: 'success', result: 'AI Summary' }
            });

            const res = await request(app)
                .post('/api/materials/generate-combined')
                .set('Authorization', `Bearer ${token}`)
                .send({ materialIds: [1], taskType: 'summary' });

            expect(res.status).toBe(200);
            expect(res.body.data.result).toBe('AI Summary');
        });
    });

    describe('POST /api/materials/upload', () => {
        it('should upload text content manually successfully', async () => {
            // Mock Subject.findByName (fallback subject generation)
            global.__mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 99, name: 'Imported Materials' }] });
            // Mock Material.create
            global.__mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 10, title: 'Text Note' }] });
            // Mock Material.findById (before processing)
            global.__mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 10, title: 'Text Note' }] });

            // Mock Engine AI Processing
            global.__mockAxiosPost.mockResolvedValueOnce({ data: { data: { result: 'Generated Notes', extracted_text: 'This is my manual note', chunks: [], embeddings: [] } } });

            // Mock Material.updateContent
            global.__mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 10, title: 'Text Note' }] });
            // Mock Material.updateAIResult
            global.__mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 10, result: 'Generated Notes' }] });
            // Mock final Material.findById
            global.__mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 10, result: 'Generated Notes' }] });

            const res = await request(app)
                .post('/api/materials/upload')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    title: 'Text Note',
                    content: 'This is my manual note',
                    type: 'upload'
                });

            expect(res.status).toBe(201);
            expect(res.body.status).toBe('success');
        });

        it('should return 400 if text content is empty and no file is uploaded', async () => {
            const res = await request(app)
                .post('/api/materials/upload')
                .set('Authorization', `Bearer ${token}`)
                .send({ title: 'A', type: 'upload' }); // missing content

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Content is required');
        });
    });
});
