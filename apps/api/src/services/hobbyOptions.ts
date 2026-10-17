import { randomUUID } from 'node:crypto';
import { prisma } from '../config/database';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';

export const HOBBY_FIELDS = ['category', 'condition', 'spec', 'tag', 'color'] as const;
export type HobbyField = (typeof HOBBY_FIELDS)[number];
export type BuiltInCategoryKey = 'KEYCAP' | 'KIT' | 'SHIPPING' | 'ACCESSORIES' | 'OTHER';
export type HobbyOption = { id: string; label: string; color?: string; builtInKey?: BuiltInCategoryKey };
export type HobbyOptions = Record<HobbyField, HobbyOption[]>;
export type HobbyUsage = Record<HobbyField, Record<string, number>>;

export const COLOR_FIELDS: HobbyField[] = ['category', 'color'];
export const MOVE_ONLY_FIELDS: HobbyField[] = ['category', 'condition'];
const AUTO_CREATE_KEYS: BuiltInCategoryKey[] = ['KEYCAP', 'KIT', 'ACCESSORIES'];

const DEFAULT_CATEGORIES: Array<{ label: string; color: string; builtInKey: BuiltInCategoryKey }> = [
    { label: 'Keycap', color: '#16a34a', builtInKey: 'KEYCAP' },
    { label: 'Kit', color: '#2563eb', builtInKey: 'KIT' },
    { label: 'Shipping', color: '#ea580c', builtInKey: 'SHIPPING' },
    { label: 'Accessories', color: '#6b7280', builtInKey: 'ACCESSORIES' },
    { label: 'Other', color: '#6b7280', builtInKey: 'OTHER' },
];
const DEFAULT_CONDITIONS = ['BNIB', 'Used'];
const DEFAULT_SPECS = ['Base', 'Novel', 'Space', 'Accent', 'Hiragana', 'Icon Mode', 'Alpha', 'Mod', 'Fix Kit', 'Solder', 'Hotswap', 'Plate Alu', 'Plate PC', 'Plate PEI', 'Plate CF', 'Plate PP', 'Deskmat'];
const DEFAULT_TAGS = ['Board 1', 'Board 2', 'Board 3', 'Board 4', 'Board 5', 'Board 6', 'Board 7', 'Board 8', 'Board 9', 'Board 10', 'Board 11', 'Board 12', 'Board 13', 'Board 14', 'Board 15', 'Board 16', 'Board 17', 'Stock'];
const DEFAULT_COLORS: Array<[string, string]> = [
    ['Blue', '#2563eb'], ['PC', '#6b7280'], ['Purple', '#7c3aed'], ['Red', '#dc2626'], ['Gray', '#6b7280'],
    ['Green', '#16a34a'], ['Black', '#111827'], ['Silver', '#94a3b8'], ['Copper', '#b45309'], ['Brown', '#92400e'],
    ['Rose Gold', '#c2410c'], ['Orange', '#ea580c'], ['Beige', '#a16207'], ['Colorful', '#db2777'],
];
const LEGACY_SPEC_ALIASES: Record<string, string> = { 'icon mod': 'Icon Mode' };
const LEGACY_CONDITION: Record<string, string> = { USED: 'Used', BNIB: 'BNIB' };

const norm = (value: string) => value.trim().toLowerCase();

function buildDefaults(): HobbyOptions {
    return {
        category: DEFAULT_CATEGORIES.map(({ label, color, builtInKey }) => ({ id: randomUUID(), label, color, builtInKey })),
        condition: DEFAULT_CONDITIONS.map((label) => ({ id: randomUUID(), label })),
        spec: DEFAULT_SPECS.map((label) => ({ id: randomUUID(), label })),
        tag: DEFAULT_TAGS.map((label) => ({ id: randomUUID(), label })),
        color: DEFAULT_COLORS.map(([label, color]) => ({ id: randomUUID(), label, color })),
    };
}

function parseStoredOptions(value: unknown): HobbyOptions | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const stored = value as Partial<Record<HobbyField, unknown>>;
    if (!Array.isArray(stored.category)) return null;
    return Object.fromEntries(HOBBY_FIELDS.map((field) => [field, Array.isArray(stored[field]) ? stored[field] : []])) as HobbyOptions;
}

function nonEmptyText(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text || null;
}

function appendOption(options: HobbyOptions, field: HobbyField, label: string) {
    if (options[field].some((option) => norm(option.label) === norm(label))) return;
    const option: HobbyOption = { id: randomUUID(), label };
    if (COLOR_FIELDS.includes(field)) option.color = '#6b7280';
    options[field].push(option);
}

function assertField(field: string): asserts field is HobbyField {
    if (!(HOBBY_FIELDS as readonly string[]).includes(field)) throw new ValidationError('Invalid field');
}

function assertColorAllowed(field: HobbyField, color: string | undefined) {
    if (color !== undefined && !COLOR_FIELDS.includes(field)) {
        throw new ValidationError('Color is only allowed for category and color');
    }
}

function emptyUsage(options: HobbyOptions): HobbyUsage {
    return Object.fromEntries(HOBBY_FIELDS.map((field) => [
        field,
        Object.fromEntries(options[field].map(({ id }) => [id, 0])),
    ])) as HobbyUsage;
}

function incrementUsage(usage: HobbyUsage, options: HobbyOptions, field: HobbyField, label: string | null, count: number) {
    if (label === null) return;
    const option = options[field].find((item) => item.label === label);
    if (option) usage[field][option.id] = (usage[field][option.id] ?? 0) + count;
}

async function loadOptions(tx: any): Promise<HobbyOptions> {
    const row = await tx.appSetting.findUnique({ where: { id: 1 } });
    const options = parseStoredOptions(row?.hobbyOptions);
    if (!options) throw new ValidationError('Hobby options have not been initialized');
    return options;
}

async function cascadeLabel(tx: any, field: HobbyField, oldLabel: string, newLabel: string | null) {
    const data = (column: string) => ({ [column]: newLabel });
    if (field === 'category') {
        await tx.keyboard.updateMany({ where: { category: oldLabel }, data: data('category') });
        await tx.fundTransaction.updateMany({ where: { category: oldLabel }, data: data('category') });
        return;
    }
    if (field === 'condition') {
        await tx.keyboard.updateMany({ where: { description: oldLabel }, data: data('description') });
        await tx.fundTransaction.updateMany({ where: { condition: oldLabel }, data: data('condition') });
        return;
    }
    if (field === 'tag' || field === 'color') {
        await tx.keyboard.updateMany({ where: { [field]: oldLabel }, data: data(field) });
        return;
    }

    const keyboards = await tx.keyboard.findMany({ select: { id: true, spec: true } });
    for (const keyboard of keyboards) {
        if (!Array.isArray(keyboard.spec) || !keyboard.spec.includes(oldLabel)) continue;
        const replaced = keyboard.spec.flatMap((value: unknown) => value === oldLabel ? (newLabel === null ? [] : [newLabel]) : [value]);
        const seen = new Set<unknown>();
        const deduped = replaced.filter((value: unknown) => {
            if (seen.has(value)) return false;
            seen.add(value);
            return true;
        });
        await tx.keyboard.update({ where: { id: keyboard.id }, data: { spec: deduped } });
    }
}

async function labelUsage(tx: any, field: HobbyField, label: string): Promise<number> {
    if (field === 'category') {
        const [keyboards, funds] = await Promise.all([
            tx.keyboard.count({ where: { category: label } }),
            tx.fundTransaction.count({ where: { category: label } }),
        ]);
        return keyboards + funds;
    }
    if (field === 'condition') {
        const [keyboards, funds] = await Promise.all([
            tx.keyboard.count({ where: { description: label } }),
            tx.fundTransaction.count({ where: { condition: label } }),
        ]);
        return keyboards + funds;
    }
    if (field === 'tag' || field === 'color') return tx.keyboard.count({ where: { [field]: label } });
    const keyboards = await tx.keyboard.findMany({ select: { spec: true } });
    return keyboards.filter((keyboard: { spec: unknown }) => Array.isArray(keyboard.spec) && keyboard.spec.includes(label)).length;
}

export function shouldCreateKeyboardFromFund(type: string, scope: string, builtInKey: BuiltInCategoryKey | null): boolean {
    return type === 'BUY' && scope === 'MECHANICAL_KEYBOARD' && !!builtInKey && AUTO_CREATE_KEYS.includes(builtInKey);
}

export class HobbyOptionsService {
    static resolveLabel(options: HobbyOptions, field: HobbyField, raw: unknown): string | null {
        if (raw === null || raw === undefined) return null;
        const text = String(raw).trim();
        if (!text) return null;
        const list = options[field];
        if (field === 'category') {
            const byKey = list.find((option) => option.builtInKey === text.toUpperCase());
            if (byKey) return byKey.label;
        }
        if (field === 'condition' && LEGACY_CONDITION[text.toUpperCase()]) {
            const legacy = LEGACY_CONDITION[text.toUpperCase()];
            const hit = list.find((option) => norm(option.label) === norm(legacy));
            if (hit) return hit.label;
        }
        if (field === 'spec' && LEGACY_SPEC_ALIASES[norm(text)]) {
            const hit = list.find((option) => norm(option.label) === norm(LEGACY_SPEC_ALIASES[norm(text)]));
            if (hit) return hit.label;
        }
        return list.find((option) => norm(option.label) === norm(text))?.label ?? null;
    }

    static async get(): Promise<HobbyOptions> {
        const row = await prisma.appSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
        const parsed = parseStoredOptions(row.hobbyOptions);
        if (parsed) return parsed;

        return prisma.$transaction(async (tx) => {
            const fresh = await tx.appSetting.findUnique({ where: { id: 1 } });
            const already = parseStoredOptions(fresh?.hobbyOptions);
            if (already) return already;

            const options = buildDefaults();
            const keyboards = await tx.keyboard.findMany({
                select: { id: true, category: true, tag: true, color: true, description: true, spec: true },
            });
            const funds = await tx.fundTransaction.findMany({ select: { id: true, category: true, condition: true } });

            for (const keyboard of keyboards) {
                const data: Record<string, unknown> = {};
                const scalarValues: Array<[HobbyField, string, unknown]> = [
                    ['category', 'category', keyboard.category],
                    ['condition', 'description', keyboard.description],
                    ['tag', 'tag', keyboard.tag],
                    ['color', 'color', keyboard.color],
                ];
                for (const [field, column, value] of scalarValues) {
                    let resolved = HobbyOptionsService.resolveLabel(options, field, value);
                    if (resolved === null) {
                        const text = nonEmptyText(value);
                        if (text !== null) {
                            appendOption(options, field, text);
                            resolved = text;
                        }
                    }
                    if (resolved !== value) data[column] = resolved;
                }

                const rawSpec = Array.isArray(keyboard.spec) ? keyboard.spec : [];
                const normalizedSpec: string[] = [];
                for (const value of rawSpec) {
                    let resolved = HobbyOptionsService.resolveLabel(options, 'spec', value);
                    if (resolved === null) {
                        const text = nonEmptyText(value);
                        if (text !== null) {
                            appendOption(options, 'spec', text);
                            resolved = text;
                        }
                    }
                    if (resolved !== null && !normalizedSpec.includes(resolved)) normalizedSpec.push(resolved);
                }
                if (JSON.stringify(normalizedSpec) !== JSON.stringify(rawSpec)) data.spec = normalizedSpec;
                if (Object.keys(data).length) await tx.keyboard.update({ where: { id: keyboard.id }, data });
            }

            for (const fund of funds) {
                const data: Record<string, unknown> = {};
                for (const [field, column, value] of [
                    ['category', 'category', fund.category],
                    ['condition', 'condition', fund.condition],
                ] as Array<[HobbyField, string, unknown]>) {
                    let resolved = HobbyOptionsService.resolveLabel(options, field, value);
                    if (resolved === null) {
                        const text = nonEmptyText(value);
                        if (text !== null) {
                            appendOption(options, field, text);
                            resolved = text;
                        }
                    }
                    if (resolved !== value) data[column] = resolved;
                }
                if (Object.keys(data).length) await tx.fundTransaction.update({ where: { id: fund.id }, data });
            }

            await tx.appSetting.update({ where: { id: 1 }, data: { hobbyOptions: options } });
            return options;
        }, { timeout: 30_000, maxWait: 10_000 });
    }

    static async getWithUsage(): Promise<{ options: HobbyOptions; usage: HobbyUsage }> {
        const options = await this.get();
        const usage = emptyUsage(options);
        const [keyboardCategories, fundCategories, keyboardConditions, fundConditions, tags, colors, keyboardsWithSpecs] = await Promise.all([
            prisma.keyboard.groupBy({ by: ['category'], _count: { _all: true } }),
            prisma.fundTransaction.groupBy({ by: ['category'], _count: { _all: true } }),
            prisma.keyboard.groupBy({ by: ['description'], _count: { _all: true } }),
            prisma.fundTransaction.groupBy({ by: ['condition'], _count: { _all: true } }),
            prisma.keyboard.groupBy({ by: ['tag'], _count: { _all: true } }),
            prisma.keyboard.groupBy({ by: ['color'], _count: { _all: true } }),
            prisma.keyboard.findMany({ select: { spec: true } }),
        ]);
        for (const row of keyboardCategories) incrementUsage(usage, options, 'category', row.category, row._count._all);
        for (const row of fundCategories) incrementUsage(usage, options, 'category', row.category, row._count._all);
        for (const row of keyboardConditions) incrementUsage(usage, options, 'condition', row.description, row._count._all);
        for (const row of fundConditions) incrementUsage(usage, options, 'condition', row.condition, row._count._all);
        for (const row of tags) incrementUsage(usage, options, 'tag', row.tag, row._count._all);
        for (const row of colors) incrementUsage(usage, options, 'color', row.color, row._count._all);
        for (const keyboard of keyboardsWithSpecs) {
            if (!Array.isArray(keyboard.spec)) continue;
            for (const label of new Set(keyboard.spec.filter((value): value is string => typeof value === 'string'))) {
                incrementUsage(usage, options, 'spec', label, 1);
            }
        }
        return { options, usage };
    }

    static async add(field: HobbyField, input: { label: string; color?: string }): Promise<HobbyOption> {
        assertField(field);
        assertColorAllowed(field, input.color);
        await this.get();
        return prisma.$transaction(async (tx) => {
            const options = await loadOptions(tx);
            if (options[field].some((option) => norm(option.label) === norm(input.label))) {
                throw new ValidationError('An option with this label already exists');
            }
            const option: HobbyOption = { id: randomUUID(), label: input.label.trim() };
            if (input.color !== undefined) option.color = input.color;
            options[field].push(option);
            await tx.appSetting.update({ where: { id: 1 }, data: { hobbyOptions: options } });
            return option;
        });
    }

    static async update(field: HobbyField, id: string, input: { label?: string; color?: string }): Promise<HobbyOption> {
        assertField(field);
        assertColorAllowed(field, input.color);
        await this.get();
        return prisma.$transaction(async (tx) => {
            const options = await loadOptions(tx);
            const index = options[field].findIndex((option) => option.id === id);
            if (index < 0) throw new NotFoundError('Option');
            const current = options[field][index];
            if (input.label !== undefined) {
                const label = input.label.trim();
                if (options[field].some((option) => option.id !== id && norm(option.label) === norm(label))) {
                    throw new ValidationError('An option with this label already exists');
                }
                if (label !== current.label) await cascadeLabel(tx, field, current.label, label);
                current.label = label;
            }
            if (input.color !== undefined) current.color = input.color;
            await tx.appSetting.update({ where: { id: 1 }, data: { hobbyOptions: options } });
            return current;
        });
    }

    static async reorder(field: HobbyField, ids: string[]): Promise<HobbyOption[]> {
        assertField(field);
        await this.get();
        return prisma.$transaction(async (tx) => {
            const options = await loadOptions(tx);
            const current = options[field];
            if (ids.length !== current.length || new Set(ids).size !== ids.length || current.some(({ id }) => !ids.includes(id))) {
                throw new ValidationError('Order must list every option once');
            }
            const byId = new Map(current.map((option) => [option.id, option]));
            options[field] = ids.map((id) => byId.get(id)!);
            await tx.appSetting.update({ where: { id: 1 }, data: { hobbyOptions: options } });
            return options[field];
        });
    }

    static async remove(field: HobbyField, id: string, input: { mode: 'move'; targetId: string } | { mode: 'clear' }): Promise<void> {
        assertField(field);
        await this.get();
        await prisma.$transaction(async (tx) => {
            const options = await loadOptions(tx);
            const index = options[field].findIndex((option) => option.id === id);
            if (index < 0) throw new NotFoundError('Option');
            const option = options[field][index];
            if (option.builtInKey) throw new ForbiddenError('Built-in category cannot be deleted');

            let target: HobbyOption | undefined;
            if (input.mode === 'move') {
                target = options[field].find((candidate) => candidate.id === input.targetId);
                if (input.targetId === id || !target) throw new ValidationError('Invalid move target');
            }

            const usage = await labelUsage(tx, field, option.label);
            if (usage > 0 && input.mode === 'clear' && MOVE_ONLY_FIELDS.includes(field)) {
                throw new ValidationError('This field can only be moved, not cleared');
            }
            if (input.mode === 'move') {
                await cascadeLabel(tx, field, option.label, target!.label);
            } else if (usage > 0) {
                await cascadeLabel(tx, field, option.label, null);
            }
            options[field].splice(index, 1);
            await tx.appSetting.update({ where: { id: 1 }, data: { hobbyOptions: options } });
        });
    }

    static async ensureLabels(field: HobbyField, labels: string[]): Promise<HobbyOptions> {
        const options = await this.get();
        for (const raw of labels) {
            const label = raw.trim();
            if (label) appendOption(options, field, label);
        }
        await prisma.appSetting.update({ where: { id: 1 }, data: { hobbyOptions: options } });
        return options;
    }

    static builtInKeyOf(options: HobbyOptions, label: string | null): BuiltInCategoryKey | null {
        if (label === null) return null;
        return options.category.find((option) => norm(option.label) === norm(label))?.builtInKey ?? null;
    }

    static specRank(options: HobbyOptions): Map<string, number> {
        return new Map(options.spec.map((option, index) => [option.label, index]));
    }
}
