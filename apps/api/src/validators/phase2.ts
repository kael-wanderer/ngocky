import { z } from 'zod';

export const createAssetSchema = z.object({
    name: z.string().min(1).max(200),
    type: z.string().optional(),
    brand: z.string().optional(),
    model: z.string().optional(),
    serialNumber: z.string().optional(),
    purchaseDate: z.string().datetime().nullable().optional(),
    warrantyMonths: z.number().int().nonnegative().optional(),
    isShared: z.boolean().optional(),
    note: z.string().optional(),
});

export const updateAssetSchema = createAssetSchema.partial();

export const createMaintenanceRecordSchema = z.object({
    assetId: z.string().min(1),
    serviceDate: z.string().datetime(),
    description: z.string().min(1),
    serviceType: z.string().optional(),
    cost: z.number().nonnegative().optional(),
    vendor: z.string().optional(),
    nextRecommendedDate: z.string().datetime().nullable().optional(),
    kilometers: z.number().int().nonnegative().optional(),
    notificationEnabled: z.boolean().optional(),
    reminderOffsetValue: z.number().int().positive().optional(),
    reminderOffsetUnit: z.enum(['HOURS', 'DAYS', 'ON_DATE']).optional(),
    notificationDate: z.string().datetime().nullable().optional(),
    pinToDashboard: z.boolean().optional(),
});

export const updateMaintenanceRecordSchema = createMaintenanceRecordSchema.partial().omit({ assetId: true });

export const createLearningTopicSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    isShared: z.boolean().optional(),
});

export const updateLearningTopicSchema = createLearningTopicSchema.partial();

export const createLearningHistorySchema = z.object({
    topicId: z.string().min(1),
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    target: z.string().optional(),
    progress: z.number().int().min(0).max(100).optional(),
    deadline: z.string().datetime().nullable().optional(),
    status: z.enum(['PLANNED', 'IN_PROGRESS', 'DONE', 'ARCHIVED']).optional(),
    notificationEnabled: z.boolean().optional(),
});

export const updateLearningHistorySchema = createLearningHistorySchema.partial().omit({ topicId: true });

export const createIdeaTopicSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    isShared: z.boolean().optional(),
});

export const updateIdeaTopicSchema = createIdeaTopicSchema.partial();

export const createIdeaLogSchema = z.object({
    topicId: z.string().min(1),
    title: z.string().min(1).max(200),
    content: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    status: z.enum(['OPEN', 'REVIEWING', 'ARCHIVED']).optional(),
});

export const updateIdeaLogSchema = createIdeaLogSchema.partial().omit({ topicId: true });

export const createAlertRuleSchema = z.object({
    name: z.string().min(1).max(200),
    moduleType: z.string().min(1),
    frequency: z.enum(['DAILY', 'WEEKLY']).optional(),
    conditionType: z.string().min(1),
    conditionValue: z.string().optional(),
    notificationChannel: z.enum(['EMAIL', 'TELEGRAM', 'BOTH']).optional(),
    active: z.boolean().optional(),
});

export const updateAlertRuleSchema = createAlertRuleSchema.partial();

export const createScheduledReportSchema = z.object({
    reportType: z.string().min(1),
    dateRangePreset: z.string().optional(),
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    sections: z.array(z.string()).optional(),
    time: z.string().optional(),
    notificationChannel: z.enum(['EMAIL', 'TELEGRAM', 'BOTH']).optional(),
    recipients: z.array(z.string()).optional(),
    active: z.boolean().optional(),
});

export const updateScheduledReportSchema = createScheduledReportSchema.partial();
