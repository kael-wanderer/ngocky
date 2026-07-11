import type { PageModuleType } from '@prisma/client';

export type PageTemplateGroup = 'personal' | 'family' | 'hobby';

export type PageTemplate = {
    moduleType: PageModuleType;
    label: string;
    group: PageTemplateGroup;
    rootLabel: string;
    available: boolean;
};

export type BuiltInPageOverride = { name?: string; visible?: boolean };

export type TemplateOverride = { label?: string; group?: PageTemplateGroup };

function parseOverrides<T>(raw: unknown): Record<string, T> {
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, T> : {};
}

export function parseTemplateOverrideMap(raw: unknown): Record<string, TemplateOverride> {
    return parseOverrides<TemplateOverride>(raw);
}

export function applyTemplateOverrides(raw: unknown): PageTemplate[] {
    const overrides = parseOverrides<TemplateOverride>(raw);
    return PAGE_TEMPLATES.map((template) => ({
        ...template,
        label: overrides[template.moduleType]?.label?.trim() || template.label,
        group: overrides[template.moduleType]?.group ?? template.group,
    }));
}

export function applyBuiltInPageOverrides(raw: unknown, templates: PageTemplate[] = PAGE_TEMPLATES): Array<PageTemplate & { name: string; visible: boolean }> {
    const overrides = parseOverrides<BuiltInPageOverride>(raw);
    return templates.map((template) => ({
        ...template,
        name: typeof overrides[template.moduleType]?.name === 'string' ? overrides[template.moduleType].name!.trim() || template.label : template.label,
        visible: overrides[template.moduleType]?.visible !== false,
    }));
}

export const PAGE_TEMPLATES: PageTemplate[] = [
    { moduleType: 'TASK', label: 'Tasks', group: 'personal', rootLabel: 'tasks', available: true },
    { moduleType: 'PROJECT', label: 'Projects', group: 'personal', rootLabel: 'projects', available: true },
    { moduleType: 'EXPENSE', label: 'Expenses', group: 'personal', rootLabel: 'expenses', available: true },
    { moduleType: 'GOAL', label: 'Goals', group: 'personal', rootLabel: 'goals', available: true },
    { moduleType: 'IDEA', label: 'Ideas', group: 'personal', rootLabel: 'topics', available: true },
    { moduleType: 'CALENDAR', label: 'Calendar', group: 'family', rootLabel: 'events', available: true },
    { moduleType: 'CAKEO', label: 'Ca Keo (Child)', group: 'family', rootLabel: 'items', available: false },
    { moduleType: 'HOUSEWORK', label: 'Housework', group: 'family', rootLabel: 'items', available: false },
    { moduleType: 'ASSET', label: 'Assets', group: 'family', rootLabel: 'assets', available: false },
    { moduleType: 'HEALTHBOOK', label: 'Healthbook', group: 'family', rootLabel: 'people', available: false },
    { moduleType: 'KEYBOARD', label: 'Keyboard', group: 'hobby', rootLabel: 'collections', available: false },
    { moduleType: 'FUND', label: 'Funds', group: 'hobby', rootLabel: 'transactions', available: false },
    { moduleType: 'LEARNING', label: 'Learning', group: 'hobby', rootLabel: 'topics', available: true },
];

export const PAGE_TEMPLATE_BY_TYPE = Object.fromEntries(
    PAGE_TEMPLATES.map((template) => [template.moduleType, template]),
) as Record<PageModuleType, PageTemplate>;
