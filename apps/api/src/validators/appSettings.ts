import { z } from 'zod';

export const updateAppSettingsSchema = z.object({
    appName: z.string().trim().min(1).max(60).optional(),
    logoUrl: z.string().max(500_000).nullable().optional(),
    enabledGroups: z.array(z.enum(['personal', 'family', 'hobby'])).optional(),
});

export const setOpenaiKeySchema = z.object({
    key: z.string().trim().min(20).max(256),
});
