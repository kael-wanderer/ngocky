import { z } from 'zod';

export const setupSchema = z.object({
    appName: z.string().trim().min(1).max(60),
    enabledGroups: z.array(z.enum(['personal', 'family', 'hobby'])),
    owner: z.object({
        email: z.string().email(),
        password: z.string().min(8).max(128),
        name: z.string().trim().min(1).max(80),
    }),
});
