import { z } from 'zod';

export const updateOwnModuleColorSchema = z.object({
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #3b82f6'),
});

export const createBudgetSchema = z.object({
    category: z.string().trim().min(1).max(100),
    period: z.enum(['WEEKLY', 'MONTHLY', 'YEARLY']).optional(),
    amount: z.number().finite().nonnegative(),
    active: z.boolean().optional(),
}).strict();

export const updateBudgetSchema = createBudgetSchema.partial().strict();
