import { jest } from '@jest/globals';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockAxiosPost = jest.fn();
jest.unstable_mockModule('axios', () => ({
    default: {
        post: mockAxiosPost,
        create: jest.fn().mockReturnValue({
            post: mockAxiosPost,
            get: jest.fn(),
            interceptors: {
                request: { use: jest.fn() },
                response: { use: jest.fn() }
            }
        })
    }
}));

const mockQuery = jest.fn();
jest.unstable_mockModule('../../utils/config/db.js', () => ({
    query: mockQuery,
    default: { query: mockQuery }
}));

// Mock Material model to satisfy any static cleanup or calls
jest.unstable_mockModule('../../models/material.model.js', () => ({
    default: { findById: jest.fn() }
}));

// ─── Dynamic Imports ──────────────────────────────────────────────────────────

const { default: ExamService } = await import('../../services/exam.service.js');
const { default: axios } = await import('axios');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExamService - Semantic Grading Regression Tests', () => {
    const userId = 'user-123';
    const examId = 'exam-456';
    const mockExamRecord = {
        userId,
        exam: {
            questions: [
                {
                    id: 'q-1',
                    type: 'short_answer',
                    question: 'What is polymorphism?',
                    acceptedAnswers: ['Ability to take multiple forms']
                }
            ]
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // Mock the db query to return our exam material
        mockQuery.mockResolvedValue({
            rows: [{
                id: examId,
                subject_id: 'sub-789',
                title: 'Test Exam',
                type: 'exam',
                ai_generated_content: JSON.stringify({
                    questions: mockExamRecord.exam.questions,
                    answer_sheet: [{ question_id: 'q-1', answer: 'Ability to take multiple forms', explanation: 'OOP concept' }]
                }),
                created_at: new Date().toISOString()
            }]
        });
    });

    it('grades short answer questions successfully when engine is healthy', async () => {
        mockAxiosPost.mockResolvedValue({
            data: {
                normalized_score: 0.9,
                feedback: 'Excellent explanation.'
            }
        });

        const payload = {
            examId,
            answers: [{
                questionId: 'q-1',
                answerText: 'Objects taking many forms'
            }]
        };

        const result = await ExamService.submitExam(userId, payload);
        
        expect(result.score).toBeGreaterThan(0);
        expect(result.details[0].isCorrect).toBe(true);
        expect(result.details[0].explanation).toBe('Excellent explanation.');
        expect(mockAxiosPost).toHaveBeenCalled();
    });

    it('does not silently return 0 on infrastructure failure (fails loudly)', async () => {
        // Force an infrastructure failure (e.g., network error or timeout)
        mockAxiosPost.mockRejectedValue(new Error('Network Error / Engine Down'));

        const payload = {
            examId,
            answers: [{
                questionId: 'q-1',
                answerText: 'Some answer'
            }]
        };

        // Expect the entire submission to fail loudly
        await expect(
            ExamService.submitExam(userId, payload)
        ).rejects.toThrow('Semantic grading unavailable');
        
        expect(mockAxiosPost).toHaveBeenCalled();
    });
});
