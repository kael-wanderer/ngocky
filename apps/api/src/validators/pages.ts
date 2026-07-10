import { z } from 'zod';

export const createPageSchema = z.object({
    name: z.string().trim().min(1).max(60),
    moduleType: z.enum(['TASK', 'PROJECT', 'EXPENSE', 'GOAL']),
    group: z.enum(['personal', 'family', 'hobby']),
    icon: z.string().max(40).optional(),
});

export const updatePageSchema = createPageSchema.partial().omit({ moduleType: true });
