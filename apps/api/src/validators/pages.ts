import { z } from 'zod';
import { PAGE_TEMPLATES } from '../config/pageTemplates';

const moduleTypes = PAGE_TEMPLATES.map((template) => template.moduleType) as [string, ...string[]];

export const createPageSchema = z.object({
    name: z.string().trim().min(1).max(60),
    moduleType: z.enum(moduleTypes),
    group: z.enum(['personal', 'family', 'hobby']),
    icon: z.string().max(40).optional(),
});

export const updatePageSchema = z.object({
    name: z.string().trim().min(1).max(60).optional(),
    icon: z.string().max(40).nullable().optional(),
});

export const builtInPageParamsSchema = z.object({
    moduleType: z.enum(moduleTypes),
});

export const updateBuiltInPageSchema = z.object({
    name: z.string().trim().min(1).max(60).optional(),
    visible: z.boolean().optional(),
}).refine((value) => value.name !== undefined || value.visible !== undefined, 'No changes supplied');

export const templateOverrideSchema = z.object({
    label: z.string().trim().min(1).max(60).optional(),
    group: z.enum(['personal', 'family', 'hobby']).optional(),
}).refine((value) => value.label !== undefined || value.group !== undefined, 'No changes supplied');
