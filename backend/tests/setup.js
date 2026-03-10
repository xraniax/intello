import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

// Set up required environment variables for tests
process.env.JWT_SECRET = 'test-secret-key';
process.env.ENGINE_URL = 'http://localhost:8000';
process.env.NODE_ENV = 'test';

// Global mocks
global.__mockDbQuery = jest.fn().mockImplementation((text, params) => {
    // Automatically mock the protect middleware's user lookup
    if (text && text.includes('SELECT * FROM users WHERE id = $1')) {
        return Promise.resolve({ rows: [{ id: params[0], name: 'Test User', email: 'test@example.com' }] });
    }
    return Promise.resolve({ rows: [] });
});
global.__mockAxiosPost = jest.fn();

// Provide a global helper to generate test tokens
global.generateTestToken = (userId = 1) => {
    return 'test-bypass-token';
};
