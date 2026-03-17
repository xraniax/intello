import request from 'supertest';
import app from '../../app.js';
import { jest } from '@jest/globals';

// Simple bypass for auth in integration tests
const testToken = 'test-bypass-token';

describe('Material Integration Tests', () => {
    it('should get history for a user', async () => {
        const res = await request(app)
            .get('/api/materials/history')
            .set('Authorization', `Bearer ${testToken}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
    });

    it('should fail upload without content or file', async () => {
        const res = await request(app)
            .post('/api/materials/upload')
            .set('Authorization', `Bearer ${testToken}`)
            .send({});

        expect(res.status).toBe(400);
    });
});
