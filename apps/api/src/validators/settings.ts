import { z } from 'zod';

export const updateOwnModuleColorSchema = z.object({
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #3b82f6'),
});
