import { z } from 'zod';

const idSchema = z.union([z.string(), z.number()]).transform(v => String(v));

export const uploadMaterialSchema = z.object({
    title: z.string().trim().optional(),
    content: z.string().optional(),
    type: z.enum(['upload'], { required_error: 'Valid task type is required' }),
    subjectId: idSchema.optional(),
});

export const chatCombinedSchema = z.object({
    materialIds: z.array(idSchema).min(1, { message: 'At least one materialId is required' }),
    question: z.string().min(1, { message: 'Question is required' }),
});

export const generateCombinedSchema = z.object({
    materialIds: z.array(idSchema).min(1, { message: 'At least one materialId is required' }),
    taskType: z.enum(['summary', 'quiz', 'flashcards', 'mock_exam'], { required_error: 'Task type is required' }),
});
