import { z } from 'zod';
import { PAGE_TEMPLATE_BY_TYPE, PAGE_TEMPLATES } from '../config/pageTemplates';

const moduleTypes = PAGE_TEMPLATES.map((template) => template.moduleType) as [string, ...string[]];

export const createPageSchema = z.object({
    name: z.string().trim().min(1).max(60),
    moduleType: z.enum(moduleTypes),
    group: z.enum(['personal', 'family', 'hobby']),
    icon: z.string().max(40).optional(),
}).superRefine((value, context) => {
    const template = PAGE_TEMPLATE_BY_TYPE[value.moduleType as keyof typeof PAGE_TEMPLATE_BY_TYPE];
    if (!template?.available) context.addIssue({ code: 'custom', path: ['moduleType'], message: 'Template is not available yet' });
    if (template?.group !== value.group) context.addIssue({ code: 'custom', path: ['group'], message: `Template belongs to ${template?.group}` });
});

export const updatePageSchema = z.object({
    name: z.string().trim().min(1).max(60).optional(),
    icon: z.string().max(40).nullable().optional(),
});
