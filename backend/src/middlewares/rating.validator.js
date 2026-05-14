import { z } from 'zod';
import { VALID_ISSUE_FLAGS } from '../models/rating.model.js';

export const submitRatingSchema = z.object({
    materialId: z.string().uuid({ message: 'Valid material UUID required.' }),

    overall_rating: z
        .number({ required_error: 'overall_rating is required.' })
        .int()
        .min(1, 'Rating must be at least 1.')
        .max(5, 'Rating must be at most 5.'),

    learning_effectiveness: z.boolean().nullable().optional(),

    difficulty_level: z
        .enum(['too_easy', 'appropriate', 'too_difficult'], {
            message: 'difficulty_level must be too_easy | appropriate | too_difficult',
        })
        .nullable()
        .optional(),

    written_feedback: z
        .string()
        .max(2000, 'Feedback must be 2000 characters or fewer.')
        .nullable()
        .optional(),

    issue_flags: z
        .array(z.enum(VALID_ISSUE_FLAGS))
        .max(VALID_ISSUE_FLAGS.length)
        .optional()
        .default([]),

    engagement_seconds: z
        .number()
        .int()
        .min(0)
        .optional()
        .default(0),
});
