import { z } from 'zod';

export const createGoalSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    periodType: z.enum(['WEEKLY', 'MONTHLY']),
    targetCount: z.number().int().positive(),
    unit: z.string().optional().default('times'),
    trackingType: z.enum(['BY_QUANTITY', 'BY_FREQUENCY']).optional().default('BY_FREQUENCY'),
    startDate: z.string().datetime().optional(),
    notificationEnabled: z.boolean().optional(),
    pinToDashboard: z.boolean().optional(),
});

export const updateGoalSchema = createGoalSchema.partial().extend({
    active: z.boolean().optional(),
});

export const createCheckInSchema = z.object({
    goalId: z.string().min(1),
    quantity: z.number().int().positive().default(1),
    note: z.string().optional(),
    date: z.string().datetime().refine((val) => {
        const d = new Date(val);
        const now = new Date();
        const fortyFiveDaysAgo = new Date();
        fortyFiveDaysAgo.setDate(now.getDate() - 45);
        return d <= now && d >= fortyFiveDaysAgo;
    }, { message: "Date must be within the last 45 days and not in the future" }).optional(),
});

export const createProjectSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const createTaskSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    projectId: z.string().min(1),
    category: z.string().optional(),
    deadline: z.string().datetime().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    status: z.enum(['PLANNED', 'IN_PROGRESS', 'DONE', 'ARCHIVED']).optional(),
    assigneeId: z.string().optional(),
    notificationEnabled: z.boolean().optional(),
    pinToDashboard: z.boolean().optional(),
    kanbanOrder: z.number().int().optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const createHouseworkSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    assigneeId: z.string().optional(),
    frequencyType: z.enum(['ONE_TIME', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'CUSTOM']).optional(),
    customIntervalDays: z.number().int().positive().optional(),
    nextDueDate: z.string().datetime().optional(),
    estimatedCost: z.number().optional(),
    notificationEnabled: z.boolean().optional(),
    pinToDashboard: z.boolean().optional(),
});

export const updateHouseworkSchema = createHouseworkSchema.partial().extend({
    active: z.boolean().optional(),
    lastCompletedDate: z.string().datetime().optional(),
});

export const createEventSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime().optional(),
    allDay: z.boolean().optional(),
    location: z.string().optional(),
    color: z.string().optional(),
    category: z.string().optional(),
    isShared: z.boolean().optional(),
    participantIds: z.array(z.string()).optional(),
});

export const updateEventSchema = createEventSchema.partial();

export const createExpenseSchema = z.object({
    date: z.string().datetime(),
    description: z.string().min(1).max(300),
    amount: z.number().positive(),
    category: z.string().optional(),
    scope: z.enum(['PERSONAL', 'FAMILY']).optional(),
    note: z.string().optional(),
    recurring: z.boolean().optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();
