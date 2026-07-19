import { z } from 'zod';

const PAGE_TYPES = [
    'TASK', 'PROJECT', 'EXPENSE', 'GOAL', 'IDEA', 'CALENDAR', 'CAKEO',
    'HOUSEWORK', 'ASSET', 'HEALTHBOOK', 'KEYBOARD', 'FOODPLACE', 'FUND', 'LEARNING',
] as const;

export const setupSchema = z.object({
    appName: z.string().trim().min(1).max(60),
    enabledGroups: z.array(z.enum(['personal', 'family', 'hobby'])),
    hiddenPages: z.array(z.enum(PAGE_TYPES)).optional(),
    owner: z.object({
        email: z.string().email(),
        password: z.string().min(8).max(128),
        name: z.string().trim().min(1).max(80),
    }),
});
