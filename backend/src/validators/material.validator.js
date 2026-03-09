import { z } from 'zod';

export const uploadMaterialSchema = z.object({
    title: z.string().optional(),
    content: z.string().min(1, { message: 'Content is required' }),
    type: z.enum(['summary', 'quiz', 'note'], { required_error: 'Valid task type is required' }),
    subjectId: z.coerce.number().optional(),
});

export const chatCombinedSchema = z.object({
    materialIds: z.array(z.coerce.number()).min(1, { message: 'At least one materialId is required' }),
    question: z.string().min(1, { message: 'Question is required' }),
});

export const generateCombinedSchema = z.object({
    materialIds: z.array(z.coerce.number()).min(1, { message: 'At least one materialId is required' }),
    taskType: z.string().min(1, { message: 'Task type is required' }),
});
