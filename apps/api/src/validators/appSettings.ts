import { z } from 'zod';

export const updateAppSettingsSchema = z.object({
    appName: z.string().trim().min(1).max(60).optional(),
    enabledGroups: z.array(z.enum(['personal', 'family', 'hobby'])).optional(),
});
