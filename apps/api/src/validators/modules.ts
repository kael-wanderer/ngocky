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
    isShared: z.boolean().optional(),
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

const houseworkSchemaBase = z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    assigneeId: z.string().optional(),
    frequencyType: z.enum(['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'CUSTOM']).optional(),
    dayOfWeek: z.number().int().min(1).max(7).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    monthOfPeriod: z.number().int().min(1).max(6).optional(),
    monthOfYear: z.number().int().min(1).max(12).optional(),
    customIntervalDays: z.number().int().positive().optional(),
    nextDueDate: z.string().datetime().optional(),
    estimatedCost: z.number().optional(),
    notificationEnabled: z.boolean().optional(),
    pinToDashboard: z.boolean().optional(),
});

export const createHouseworkSchema = houseworkSchemaBase.superRefine((data, ctx) => {
    switch (data.frequencyType) {
        case 'WEEKLY':
            if (!data.dayOfWeek) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dayOfWeek'], message: 'dayOfWeek is required for WEEKLY' });
            break;
        case 'MONTHLY':
            if (!data.dayOfMonth) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dayOfMonth'], message: 'dayOfMonth is required for MONTHLY' });
            break;
        case 'QUARTERLY':
            if (!data.monthOfPeriod || data.monthOfPeriod > 3) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['monthOfPeriod'], message: 'monthOfPeriod (1-3) is required for QUARTERLY' });
            }
            if (!data.dayOfMonth) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dayOfMonth'], message: 'dayOfMonth is required for QUARTERLY' });
            break;
        case 'HALF_YEARLY':
            if (!data.monthOfPeriod) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['monthOfPeriod'], message: 'monthOfPeriod (1-6) is required for HALF_YEARLY' });
            }
            if (!data.dayOfMonth) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dayOfMonth'], message: 'dayOfMonth is required for HALF_YEARLY' });
            break;
        case 'YEARLY':
            if (!data.monthOfYear) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['monthOfYear'], message: 'monthOfYear (1-12) is required for YEARLY' });
            if (!data.dayOfMonth) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dayOfMonth'], message: 'dayOfMonth is required for YEARLY' });
            break;
        default:
            break;
    }
});

export const updateHouseworkSchema = houseworkSchemaBase.partial().extend({
    active: z.boolean().optional(),
    lastCompletedDate: z.string().datetime().optional(),
}).superRefine((data, ctx) => {
    if (data.frequencyType === 'WEEKLY' && data.dayOfWeek === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dayOfWeek'], message: 'Provide dayOfWeek when changing to WEEKLY' });
    }
    if (data.frequencyType === 'MONTHLY' && data.dayOfMonth === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dayOfMonth'], message: 'Provide dayOfMonth when changing to MONTHLY' });
    }
    if (data.frequencyType === 'QUARTERLY') {
        if (data.monthOfPeriod === undefined || data.monthOfPeriod < 1 || data.monthOfPeriod > 3) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['monthOfPeriod'], message: 'Provide monthOfPeriod in 1-3 when changing to QUARTERLY' });
        }
        if (data.dayOfMonth === undefined) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dayOfMonth'], message: 'Provide dayOfMonth when changing to QUARTERLY' });
        }
    }
    if (data.frequencyType === 'HALF_YEARLY') {
        if (data.monthOfPeriod === undefined || data.monthOfPeriod < 1 || data.monthOfPeriod > 6) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['monthOfPeriod'], message: 'Provide monthOfPeriod in 1-6 when changing to HALF_YEARLY' });
        }
        if (data.dayOfMonth === undefined) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dayOfMonth'], message: 'Provide dayOfMonth when changing to HALF_YEARLY' });
        }
    }
    if (data.frequencyType === 'YEARLY') {
        if (data.monthOfYear === undefined) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['monthOfYear'], message: 'Provide monthOfYear when changing to YEARLY' });
        }
        if (data.dayOfMonth === undefined) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dayOfMonth'], message: 'Provide dayOfMonth when changing to YEARLY' });
        }
    }
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
