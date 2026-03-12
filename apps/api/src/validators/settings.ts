import { z } from 'zod';

export const moduleColorEntrySchema = z.object({
    entityKey: z.string().min(1),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #3b82f6'),
});

export const updateCakeoColorSettingsSchema = z.object({
    entries: z.array(moduleColorEntrySchema).min(1),
});
