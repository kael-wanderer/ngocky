import { randomUUID } from 'node:crypto';
import { prisma } from '../config/database';

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
