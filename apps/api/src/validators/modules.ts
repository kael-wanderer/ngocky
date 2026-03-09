import { z } from 'zod';

const notificationRefinement = (data: any, ctx: z.RefinementCtx) => {
    if (data.notificationEnabled) {
        if (!data.reminderOffsetUnit) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reminderOffsetUnit'], message: 'reminderOffsetUnit is required when notification is enabled' });
        } else if (data.reminderOffsetUnit === 'ON_DATE') {
            if (!data.notificationDate) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['notificationDate'], message: 'notificationDate is required when type is ON_DATE' });
            if (!data.notificationTime) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['notificationTime'], message: 'notificationTime is required when type is ON_DATE' });
        } else {
            if (!data.reminderOffsetValue) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reminderOffsetValue'], message: 'reminderOffsetValue is required when notification is enabled' });
            if (!data.notificationTime) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['notificationTime'], message: 'notificationTime is required when notification is enabled' });
        }
    }
};

const notificationFields = {
    notificationEnabled: z.boolean().optional(),
    reminderOffsetValue: z.number().int().positive().optional(),
    reminderOffsetUnit: z.enum(['HOURS', 'DAYS', 'ON_DATE']).optional(),
    notificationDate: z.string().datetime().nullable().optional(),
    notificationTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
};

export const createGoalSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    isShared: z.boolean().optional(),
    periodType: z.enum(['WEEKLY', 'MONTHLY']),
    targetCount: z.number().int().positive(),
    unit: z.string().optional().default('times'),
    trackingType: z.enum(['BY_QUANTITY', 'BY_FREQUENCY']).optional().default('BY_FREQUENCY'),
    startDate: z.string().datetime().optional(),
    ...notificationFields,
    pinToDashboard: z.boolean().optional(),
}).superRefine(notificationRefinement);

export const updateGoalSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    isShared: z.boolean().optional(),
    periodType: z.enum(['WEEKLY', 'MONTHLY']).optional(),
    targetCount: z.number().int().positive().optional(),
    unit: z.string().optional(),
    trackingType: z.enum(['BY_QUANTITY', 'BY_FREQUENCY']).optional(),
    startDate: z.string().datetime().optional(),
    ...notificationFields,
    pinToDashboard: z.boolean().optional(),
    active: z.boolean().optional(),
}).superRefine(notificationRefinement);

const standaloneTaskSchemaBase = z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    taskType: z.enum(['TASK', 'PAYMENT']).optional(),
    amount: z.number().positive().nullable().optional(),
    expenseCategory: z.string().optional().nullable(),
    isShared: z.boolean().optional(),
    dueDate: z.string().datetime().nullable().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    status: z.enum(['PLANNED', 'IN_PROGRESS', 'DONE', 'ARCHIVED']).optional(),
    ...notificationFields,
    pinToDashboard: z.boolean().optional(),
    repeatFrequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).nullable().optional(),
    repeatEndType: z.enum(['NEVER', 'ON_DATE']).nullable().optional(),
    repeatUntil: z.string().datetime().nullable().optional(),
});

function validateStandaloneTaskRepeat(data: any, ctx: z.RefinementCtx) {
    if (data.repeatFrequency) {
        if (!data.repeatEndType) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['repeatEndType'], message: 'repeatEndType is required when repeatFrequency is set' });
        }
        if (data.repeatEndType === 'ON_DATE' && !data.repeatUntil) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['repeatUntil'], message: 'repeatUntil is required when repeat ends on date' });
        }
        if (!data.dueDate) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dueDate'], message: 'dueDate is required for recurring tasks' });
        }
    }
}

function validateStandaloneTaskPayment(data: any, ctx: z.RefinementCtx) {
    if (data.taskType !== 'PAYMENT') return;

    if (data.amount == null || Number.isNaN(data.amount)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['amount'], message: 'amount is required for payment tasks' });
    }
    if (!data.expenseCategory) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['expenseCategory'], message: 'expenseCategory is required for payment tasks' });
    }
}

export const createStandaloneTaskSchema = standaloneTaskSchemaBase.superRefine((data, ctx) => {
    validateStandaloneTaskRepeat(data, ctx);
    validateStandaloneTaskPayment(data, ctx);
    notificationRefinement(data, ctx);
});

export const updateStandaloneTaskSchema = standaloneTaskSchemaBase.partial().superRefine((data, ctx) => {
    validateStandaloneTaskRepeat(data, ctx);
    validateStandaloneTaskPayment(data, ctx);
    notificationRefinement(data, ctx);
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
    type: z.enum(['PERSONAL', 'WORK', 'FOR_FUN', 'STUDY']).optional(),
    boardStatus: z.enum(['PLAN', 'WORKING', 'COMPLETED']).optional(),
    isShared: z.boolean().optional(),
    pinToDashboard: z.boolean().optional(),
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
    isShared: z.boolean().optional(),
    ...notificationFields,
    pinToDashboard: z.boolean().optional(),
    kanbanOrder: z.number().int().optional(),
}).superRefine(notificationRefinement);

export const updateTaskSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    projectId: z.string().min(1).optional(),
    category: z.string().optional(),
    deadline: z.string().datetime().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    status: z.enum(['PLANNED', 'IN_PROGRESS', 'DONE', 'ARCHIVED']).optional(),
    assigneeId: z.string().optional(),
    isShared: z.boolean().optional(),
    ...notificationFields,
    pinToDashboard: z.boolean().optional(),
    kanbanOrder: z.number().int().optional(),
}).superRefine(notificationRefinement);

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
    ...notificationFields,
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
    notificationRefinement(data, ctx);
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
    notificationRefinement(data, ctx);
});

const eventSchemaBase = z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime().optional(),
    allDay: z.boolean().optional(),
    location: z.string().optional(),
    color: z.string().optional(),
    category: z.string().optional(),
    isShared: z.boolean().optional(),
    ...notificationFields,
    pinToDashboard: z.boolean().optional(),
    repeatFrequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).nullable().optional(),
    repeatEndType: z.enum(['NEVER', 'ON_DATE']).nullable().optional(),
    repeatUntil: z.string().datetime().nullable().optional(),
    participantIds: z.array(z.string()).optional(),
});

function validateEventDateRange(data: { startDate?: string; endDate?: string }, ctx: z.RefinementCtx) {
    if (!data.startDate || !data.endDate) return;

    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;

    if (end <= start) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['endDate'],
            message: 'End time must be after start time',
        });
    }
}

export const createEventSchema = eventSchemaBase.superRefine((data, ctx) => {
    validateEventDateRange(data, ctx);
    if (data.repeatFrequency) {
        if (!data.repeatEndType) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['repeatEndType'], message: 'repeatEndType is required when repeatFrequency is set' });
        }
        if (data.repeatEndType === 'ON_DATE' && !data.repeatUntil) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['repeatUntil'], message: 'repeatUntil is required when repeat ends on date' });
        }
    }
    notificationRefinement(data, ctx);
});

export const updateEventSchema = eventSchemaBase.partial().superRefine((data, ctx) => {
    validateEventDateRange(data, ctx);
    if (data.repeatFrequency) {
        if (!data.repeatEndType) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['repeatEndType'], message: 'repeatEndType is required when repeatFrequency is set' });
        }
        if (data.repeatEndType === 'ON_DATE' && !data.repeatUntil) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['repeatUntil'], message: 'repeatUntil is required when repeat ends on date' });
        }
    }
    notificationRefinement(data, ctx);
});

export const createExpenseSchema = z.object({
    date: z.string().datetime(),
    description: z.string().min(1).max(300),
    amount: z.number().positive(),
    type: z.enum(['PAY', 'RECEIVE']).optional(),
    isShared: z.boolean().optional(),
    category: z.string().optional(),
    scope: z.enum(['PERSONAL', 'FAMILY', 'KEO', 'PROJECT']).optional(),
    note: z.string().optional(),
    recurring: z.boolean().optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();
