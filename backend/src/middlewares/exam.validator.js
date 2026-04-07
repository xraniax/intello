import { z } from 'zod';

const questionTypeSchema = z.enum([
    'single_choice',
    'multiple_select',
    'short_answer',
    'problem',
    'fill_blank',
    'matching',
    'scenario',
]);
const difficultySchema = z.enum(['Intro', 'Inter', 'Adv', 'Progression', 'Balanced', 'Default', 'Hard', 'Expert', 'easy', 'medium', 'hard', 'mixed']);

export const generateExamSchema = z.object({
    subject_id: z.string().uuid().or(z.string().min(1)),
    numberOfQuestions: z.number().int().min(1).max(100),
    difficulty: difficultySchema.default('mixed'),
    topics: z.array(z.string().trim().min(1)).min(1),
    types: z.array(questionTypeSchema).min(1),
    title: z.string().trim().min(1).max(120).optional(),
    timeLimit: z.number().int().min(1).max(300).optional(),
});

export const submitExamSchema = z.object({
    examId: z.string().trim().min(1),
    answers: z.array(
        z.object({
            questionId: z.string().trim().min(1),
            selectedAnswers: z.array(z.number().int().min(0)).default([]),
            answerText: z.string().optional(),
            blankAnswers: z.array(z.string()).optional(),
            matchAnswers: z.record(z.string(), z.string()).optional(),
        })
    ).default([]),
    startedAt: z.string().datetime().optional(),
    submittedAt: z.string().datetime().optional(),
});

export const saveAttemptSchema = z.object({
    examId: z.string().trim().min(1),
    currentIndex: z.number().int().min(0).default(0),
    answers: z.array(
        z.object({
            questionId: z.string().trim().min(1),
            selectedAnswers: z.array(z.number().int().min(0)).default([]),
            answerText: z.string().optional(),
            blankAnswers: z.array(z.string()).optional(),
            matchAnswers: z.record(z.string(), z.string()).optional(),
        })
    ).default([]),
    flagged: z.record(z.string(), z.boolean()).default({}),
    startedAt: z.string().datetime().optional(),
});
