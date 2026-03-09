import { z } from 'zod';

export const createSubjectSchema = z.object({
    name: z.string().min(1, { message: 'Subject name is required' }),
    description: z.string().optional(),
});

export const renameSubjectSchema = z.object({
    name: z.string().min(1, { message: 'Subject name is required' }),
});
