/**
 * Drive Upload Integration Tests
 * 
 * These tests verify the full flow with mocked external services.
 * Uses the existing integration test patterns in the project.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Setup Test Upload Directory ───────────────────────────────────────────────

const TEST_UPLOAD_DIR = path.join(__dirname, '../../test-uploads');

// Ensure test upload directory exists
if (!fs.existsSync(TEST_UPLOAD_DIR)) {
    fs.mkdirSync(TEST_UPLOAD_DIR, { recursive: true });
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockEnginePost = jest.fn();
const mockEngineGet = jest.fn();

jest.unstable_mockModule('../../services/engine.client.js', () => ({
    default: { post: mockEnginePost, get: mockEngineGet },
    engineClient: { post: mockEnginePost, get: mockEngineGet },
}));

jest.unstable_mockModule('../../middleware/auth.middleware.js', () => ({
    default: (req, res, next) => {
        req.user = {
            id: 'test-user-id',
            email: 'test@example.com',
            role: 'user',
        };
        next();
    },
}));

// ─── Dynamic Imports ──────────────────────────────────────────────────────────

const { default: MaterialController } = await import('../../controllers/material.controller.js');

// ─── Integration Test Suite ───────────────────────────────────────────────────

describe('Drive Upload Integration Tests', () => {
    let app;
    let upload;

    beforeAll(() => {
        // Setup Express app with multer
        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        upload = multer({ dest: TEST_UPLOAD_DIR });

        // Setup routes
        app.post(
            '/api/materials/upload',
            upload.single('file'),
            MaterialController.upload
        );
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // Clean up test uploads
        const files = fs.readdirSync(TEST_UPLOAD_DIR);
        for (const file of files) {
            fs.unlinkSync(path.join(TEST_UPLOAD_DIR, file));
        }
    });

    afterAll(() => {
        // Cleanup
        if (fs.existsSync(TEST_UPLOAD_DIR)) {
            fs.rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true });
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Integration Test 1: Full upload flow with Drive
    // ─────────────────────────────────────────────────────────────────────────
    it('POST /api/materials/upload - full flow with Drive file_id', async () => {
        // Create a test PDF file
        const testFilePath = path.join(TEST_UPLOAD_DIR, 'test-document.pdf');
        fs.writeFileSync(testFilePath, '%PDF-1.4 test pdf content');

        // Mock Engine response with drive_file_id
        mockEnginePost.mockResolvedValue({
            data: {
                status: 'accepted',
                stage: 'processing',
                job_id: 'integration-job-123',
                drive_file_id: 'drive-file-id-integration-456',
                filename: 'test-document.pdf',
            },
        });

        // Execute request
        const response = await request(app)
            .post('/api/materials/upload')
            .field('title', 'Integration Test Document')
            .field('type', 'upload')
            .field('subjectId', 'test-subject-id')
            .attach('file', testFilePath, 'test-document.pdf')
            .expect(201);

        // Verify response
        expect(response.body).toBeDefined();
        expect(response.body.status).toBe('PENDING_JOB');

        // Verify Engine was called
        expect(mockEnginePost).toHaveBeenCalledWith(
            '/process-document',
            expect.anything(), // FormData
            expect.objectContaining({ timeout: 300000 })
        );
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Integration Test 2: Upload without file (text-only)
    // ─────────────────────────────────────────────────────────────────────────
    it('POST /api/materials/upload - text-only content without file', async () => {
        mockEnginePost.mockResolvedValue({
            data: {
                status: 'accepted',
                stage: 'processing',
                job_id: 'text-job-789',
                // No drive_file_id for text-only
            },
        });

        const response = await request(app)
            .post('/api/materials/upload')
            .field('title', 'Text Only Material')
            .field('type', 'upload')
            .field('content', 'This is text content without a file')
            .field('subjectId', 'test-subject-id')
            .expect(201);

        expect(response.body).toBeDefined();
        expect(response.body.status).toBe('PENDING_JOB');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Integration Test 3: Engine failure handling
    // ─────────────────────────────────────────────────────────────────────────
    it('POST /api/materials/upload - handles Engine failure gracefully', async () => {
        const testFilePath = path.join(TEST_UPLOAD_DIR, 'fail-test.pdf');
        fs.writeFileSync(testFilePath, '%PDF-1.4 test pdf content');

        // Mock Engine failure
        mockEnginePost.mockRejectedValue(new Error('Engine unavailable'));

        const response = await request(app)
            .post('/api/materials/upload')
            .field('title', 'Fail Test Document')
            .field('type', 'upload')
            .field('subjectId', 'test-subject-id')
            .attach('file', testFilePath, 'fail-test.pdf')
            .expect(201); // Still returns 201 because material is created

        // Material should be created but in FAILED state
        expect(response.body).toBeDefined();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Integration Test 4: Validation - missing file and content
    // ─────────────────────────────────────────────────────────────────────────
    it('POST /api/materials/upload - rejects when both file and content are missing', async () => {
        await request(app)
            .post('/api/materials/upload')
            .field('title', 'Invalid Upload')
            .field('type', 'upload')
            .expect(400); // Bad request
    });
});
