import { z } from 'zod';
import { HOBBY_FIELDS } from '../services/hobbyOptions';

const label = z.string().trim().min(1).max(60);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const hobbyFieldParamsSchema = z.object({ field: z.enum(HOBBY_FIELDS) });
export const hobbyOptionParamsSchema = z.object({ field: z.enum(HOBBY_FIELDS), id: z.string().min(1).max(64) });
export const createHobbyOptionSchema = z.object({ label, color: color.optional() }).strict();
export const updateHobbyOptionSchema = z.object({ label: label.optional(), color: color.optional() }).strict()
    .refine((value) => value.label !== undefined || value.color !== undefined, { message: 'Nothing to update' });
export const reorderHobbyOptionsSchema = z.object({ ids: z.array(z.string().min(1).max(64)).max(500) }).strict();
export const deleteHobbyOptionSchema = z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('move'), targetId: z.string().min(1).max(64) }).strict(),
    z.object({ mode: z.literal('clear') }).strict(),
]);
