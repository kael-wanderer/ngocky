import { z } from 'zod';

const notificationRefinement = (data: any, ctx: z.RefinementCtx) => {
    if (!data.notificationEnabled) return;

    if (!data.reminderOffsetUnit) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reminderOffsetUnit'], message: 'reminderOffsetUnit is required when notification is enabled' });
    } else if (data.reminderOffsetUnit === 'ON_DATE') {
        if (!data.notificationDate) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['notificationDate'], message: 'notificationDate is required when type is ON_DATE' });
        if (!data.notificationTime) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['notificationTime'], message: 'notificationTime is required when type is ON_DATE' });
    } else {
        if (!data.reminderOffsetValue) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reminderOffsetValue'], message: 'reminderOffsetValue is required when notification is enabled' });
        if (!data.notificationTime) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['notificationTime'], message: 'notificationTime is required when notification is enabled' });
    }
};

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

const maintenanceRecordSchemaBase = z.object({
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
    notificationTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    pinToDashboard: z.boolean().optional(),
    addToCalendar: z.boolean().optional(),
    addExpense: z.boolean().optional(),
});

export const createMaintenanceRecordSchema = maintenanceRecordSchemaBase.superRefine(notificationRefinement);
export const createMaintenanceRecordBodySchema = maintenanceRecordSchemaBase.omit({ assetId: true }).superRefine(notificationRefinement);

export const updateMaintenanceRecordSchema = maintenanceRecordSchemaBase.partial().omit({ assetId: true }).superRefine(notificationRefinement);

export const createLearningTopicSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    category: z.enum(['Soft-skill', 'Expertise', 'AI', 'Other']).optional(),
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
    pinToDashboard: z.boolean().optional(),
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
    field: z.enum(['Project', 'Blog', 'App', 'Collection', 'Hobby', 'Creative', 'Other']).optional(),
    tags: z.array(z.string()).optional(),
    status: z.enum(['OPEN', 'REVIEWING', 'ARCHIVED']).optional(),
    pinToDashboard: z.boolean().optional(),
});

export const updateIdeaLogSchema = createIdeaLogSchema.partial().omit({ topicId: true });

export const createAlertRuleSchema = z.object({
    name: z.string().min(1).max(200),
    moduleType: z.string().min(1),
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    time: z.string().optional(),
    conditionType: z.string().min(1),
    conditionValue: z.string().optional(),
    cooldownHours: z.number().int().min(1).optional(),
    active: z.boolean().optional(),
});

export const updateAlertRuleSchema = createAlertRuleSchema.partial();

export const createScheduledReportSchema = z.object({
    name: z.string().min(1).max(200),
    reportType: z.string().min(1),
    dateRangePreset: z.string().optional(),
    frequency: z.enum(['ONE_TIME', 'DAILY', 'WEEKDAY', 'WEEKEND', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'NONE']).optional(),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    sections: z.array(z.string()).optional(),
    time: z.string().optional(),
    notificationChannel: z.enum(['EMAIL', 'TELEGRAM', 'BOTH']).optional(),
    recipients: z.array(z.string()).optional(),
    active: z.boolean().optional(),
});

export const updateScheduledReportSchema = createScheduledReportSchema.partial();

// ─── Healthbook ──────────────────────────────────────────────────────────────

export const createHealthPersonSchema = z.object({
    name: z.string().min(1).max(200),
    dateOfBirth: z.string().datetime().nullable().optional(),
    gender: z.string().optional(),
    mobile: z.string().optional(),
    personalId: z.string().optional(),
    idIssueDate: z.string().datetime().nullable().optional(),
    passportNumber: z.string().optional(),
    passportIssueDate: z.string().datetime().nullable().optional(),
    bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).nullable().optional(),
    weight: z.number().nonnegative().optional(),
    height: z.number().nonnegative().optional(),
    allergies: z.string().optional(),
    chronicConditions: z.string().optional(),
    currentMedications: z.string().optional(),
    info: z.string().optional(),
    emergencyContact1Name: z.string().optional(),
    emergencyContact1Phone: z.string().optional(),
    emergencyContact1Relationship: z.string().optional(),
    emergencyContact2Name: z.string().optional(),
    emergencyContact2Phone: z.string().optional(),
    emergencyContact2Relationship: z.string().optional(),
    insuranceProvider: z.string().optional(),
    insuranceCardNumber: z.string().optional(),
    policyNumber: z.string().optional(),
    insuranceExpiry: z.string().datetime().nullable().optional(),
    coverageType: z.string().optional(),
    workInsuranceProvider: z.string().optional(),
    workInsuranceCardNo: z.string().optional(),
    workInsurancePolicyHolder: z.string().optional(),
    workInsuranceId: z.string().optional(),
    workInsuranceValidFrom: z.string().datetime().nullable().optional(),
    notes: z.string().optional(),
    isShared: z.boolean().optional(),
});

export const updateHealthPersonSchema = createHealthPersonSchema.partial();

const healthLogNotificationFields = {
    notificationEnabled: z.boolean().optional(),
    reminderOffsetValue: z.number().int().positive().nullable().optional(),
    reminderOffsetUnit: z.enum(['MINUTES', 'HOURS', 'DAYS', 'ON_DATE']).nullable().optional(),
    notificationDate: z.string().datetime().nullable().optional(),
    notificationTime: z.string().nullable().optional(),
    notificationCooldownHours: z.number().int().nonnegative().optional(),
};

export const createHealthLogSchema = z.object({
    date: z.string().datetime(),
    type: z.enum(['REGULAR_CHECKUP', 'DOCTOR_VISIT', 'EMERGENCY', 'VACCINATION', 'PRESCRIPTION', 'LAB_RESULT', 'OTHER']).optional(),
    location: z.string().optional(),
    doctor: z.string().optional(),
    symptoms: z.string().optional(),
    description: z.string().optional(),
    cost: z.number().nonnegative().optional(),
    prescription: z.string().optional(),
    nextCheckupDate: z.string().datetime().nullable().optional(),
    addExpense: z.boolean().optional(),
    addToCalendar: z.boolean().optional(),
    pinToDashboard: z.boolean().optional(),
    ...healthLogNotificationFields,
}).superRefine((data, ctx) => {
    if (data.addExpense && (data.cost == null || data.cost <= 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cost'], message: 'Cost is required when "Add expense" is checked' });
    }
});

export const updateHealthLogSchema = z.object({
    date: z.string().datetime().optional(),
    type: z.enum(['REGULAR_CHECKUP', 'DOCTOR_VISIT', 'EMERGENCY', 'VACCINATION', 'PRESCRIPTION', 'LAB_RESULT', 'OTHER']).optional(),
    location: z.string().optional(),
    doctor: z.string().optional(),
    symptoms: z.string().optional(),
    description: z.string().optional(),
    cost: z.number().nonnegative().optional(),
    prescription: z.string().optional(),
    nextCheckupDate: z.string().datetime().nullable().optional(),
    addExpense: z.boolean().optional(),
    addToCalendar: z.boolean().optional(),
    pinToDashboard: z.boolean().optional(),
    ...healthLogNotificationFields,
});
