import { z } from 'zod';

export const uploadMaterialSchema = z.object({
    content: z.string().optional(),
    type: z.enum(['upload'], { required_error: 'Valid task type is required' }),
    subjectId: z.string().optional(),
});

export const chatCombinedSchema = z.object({
    materialIds: z.array(z.coerce.number()).min(1, { message: 'At least one materialId is required' }),
    question: z.string().min(1, { message: 'Question is required' }),
});

export const generateCombinedSchema = z.object({
    materialIds: z.array(z.coerce.number()).min(1, { message: 'At least one materialId is required' }),
    taskType: z.enum(['summary', 'quiz', 'flashcards', 'mock_exam'], { required_error: 'Task type is required' }),
});
