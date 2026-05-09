import { z } from 'zod';

const isoDateOrDate = z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional());

const actionField = z.object({
    action: z.string(),
}).passthrough();

// --- Goals ---

export const createGoalSchema = actionField.extend({
    action: z.literal('create_goal'),
    title: z.string().min(3).max(255),
    description: z.string().optional(),
    subjectId: z.string().uuid().optional(),
    startDate: isoDateOrDate,
    endDate: isoDateOrDate,
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
    milestones: z.array(z.union([
        z.string().min(3).max(255),
        z.object({
            title: z.string().min(3).max(255),
            description: z.string().optional(),
            dueDate: isoDateOrDate,
        }),
    ])).optional(),
}).passthrough();

export const updateGoalSchema = createGoalSchema.partial().extend({
    action: z.literal('create_goal').optional(),
    status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED']).optional(),
}).passthrough();

// --- Tasks ---

export const createTaskSchema = actionField.extend({
    action: z.literal('create_task'),
    title: z.string().min(3).max(255),
    description: z.string().optional(),
    goalId: z.string().uuid().optional(),
    milestoneId: z.string().uuid().optional(),
    dueDate: isoDateOrDate,
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
}).passthrough();

export const updateTaskSchema = createTaskSchema.partial().extend({
    action: z.literal('create_task').optional(),
    status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
}).passthrough();

// --- Habits ---

export const createHabitSchema = actionField.extend({
    action: z.literal('create_habit'),
    title: z.string().min(3).max(255),
    description: z.string().optional(),
    frequency: z.enum(['DAILY', 'WEEKLY']).default('DAILY'),
    targetCount: z.number().int().min(1).default(1),
}).passthrough();

export const updateHabitSchema = createHabitSchema.partial().extend({
    action: z.literal('create_habit').optional(),
    status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
}).passthrough();

// --- Schedule Blocks ---

export const createScheduleBlockSchema = actionField.extend({
    action: z.literal('create_schedule_block'),
    title: z.string().min(3).max(255),
    startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    dayOfWeek: z.number().int().min(1).max(7).optional(),
    blockDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{3,6}$/).default('#3b82f6'),
}).passthrough();

// --- Preferences ---

export const updatePreferencesSchema = actionField.extend({
    action: z.literal('update_preferences'),
    focusModeDuration: z.number().int().min(1).max(240).optional(),
    breakDuration: z.number().int().min(1).max(60).optional(),
    activeHoursStart: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    activeHoursEnd: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
}).passthrough();
