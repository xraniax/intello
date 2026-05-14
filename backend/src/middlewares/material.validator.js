import { z } from 'zod';

const idSchema = z.union([z.string(), z.number()]).transform(v => String(v));

export const uploadMaterialSchema = z.object({
    title: z.string().trim().optional(),
    content: z.string().optional(),
    type: z.enum(['upload'], { required_error: 'Valid task type is required' }),
    subjectId: idSchema,
    conflictResolution: z.enum(['restore', 'duplicate']).optional(),
    skipDuplicateCheck: z.union([z.boolean(), z.string()]).optional().transform(v => v === 'true' || v === true),
});

export const chatCombinedSchema = z.object({
    materialIds: z.array(idSchema).min(1, { message: 'At least one materialId is required' }),
    question: z.string().min(1, { message: 'Question is required' }),
});

export const generateCombinedSchema = z.object({
    materialIds: z.array(idSchema).min(1, { message: 'At least one materialId is required' }),
    taskType: z.enum(['summary', 'quiz', 'flashcards', 'mock_exam', 'exam'], { required_error: 'Task type is required' }),
    subjectId: idSchema.optional(),
    genOptions: z.object({
        count: z.number().int().min(1).max(50).optional(),
        difficulty: z.string().optional(), // allow any string; engine normalises internally
        topic: z.string().optional(),
        topics: z.string().optional(),
        language: z.string().optional(),
        cardType: z.enum(['mixed', 'definition', 'Q&A', 'conceptual']).optional(),
        source: z.string().optional(),
        summary_mode: z.string().optional(),
        examTypes: z.array(z.string()).optional(),
        timeLimit: z.number().optional(),
    }).optional()
});
