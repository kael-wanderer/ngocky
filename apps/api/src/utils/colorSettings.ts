import { prisma } from '../config/database';
import { ValidationError } from './errors';

export const COLOR_SETTING_UNASSIGNED_KEY = 'UNASSIGNED';
export const CAKEO_COLOR_MODULE = 'CAKEO';
export const CAKEO_COLOR_SCOPE = 'ASSIGNEE';
export const DEFAULT_UNASSIGNED_COLOR = '#94a3b8';

const RESERVED_DEFAULTS: Record<string, string> = {
    'cong.buithanh@gmail.com': '#3b82f6',
    'kist.t1108@gmail.com': '#22c55e',
};

const FALLBACK_PALETTE = [
    '#8b5cf6',
    '#f59e0b',
    '#ef4444',
    '#14b8a6',
    '#ec4899',
    '#6366f1',
    '#84cc16',
    '#f97316',
    '#06b6d4',
    '#a855f7',
];

function normalizeColor(color: string) {
    return color.trim().toLowerCase();
}

export async function listCakeoAssignableUsers() {
    return prisma.user.findMany({
        where: { active: true, role: { not: 'OWNER' } },
        select: { id: true, name: true, email: true },
        orderBy: [{ name: 'asc' }, { email: 'asc' }],
    });
}

export function buildDefaultCakeoColorEntries(users: Array<{ id: string; email: string }>) {
    const usedColors = new Set<string>([DEFAULT_UNASSIGNED_COLOR]);
    const entries = [{ entityKey: COLOR_SETTING_UNASSIGNED_KEY, color: DEFAULT_UNASSIGNED_COLOR }];

    for (const user of users) {
        const reserved = RESERVED_DEFAULTS[user.email.toLowerCase()];
        if (reserved && !usedColors.has(reserved)) {
            entries.push({ entityKey: user.id, color: reserved });
            usedColors.add(reserved);
            continue;
        }

        const nextFallback = FALLBACK_PALETTE.find((color) => !usedColors.has(color));
        if (!nextFallback) {
            throw new ValidationError('Not enough default colors configured for Ca Keo assignees');
        }

        entries.push({ entityKey: user.id, color: nextFallback });
        usedColors.add(nextFallback);
    }

    return entries;
}

export async function getCakeoColorSettings() {
    const [users, stored] = await Promise.all([
        listCakeoAssignableUsers(),
        prisma.moduleColorSetting.findMany({
            where: { module: CAKEO_COLOR_MODULE as any, scope: CAKEO_COLOR_SCOPE as any },
            orderBy: { createdAt: 'asc' },
        }),
    ]);

    const defaults = buildDefaultCakeoColorEntries(users);
    const storedByKey = new Map<string, string>(stored.map((entry: { entityKey: string; color: string }) => [entry.entityKey, normalizeColor(entry.color)]));

    return {
        users,
        entries: defaults.map((entry) => ({
            entityKey: entry.entityKey,
            color: storedByKey.get(entry.entityKey) || entry.color,
        })),
    };
}

export async function saveCakeoColorSettings(rawEntries: Array<{ entityKey: string; color: string }>) {
    const users = await listCakeoAssignableUsers();
    const validKeys = new Set<string>([COLOR_SETTING_UNASSIGNED_KEY, ...users.map((user: { id: string }) => user.id)]);
    const normalizedEntries = rawEntries.map((entry) => ({
        entityKey: entry.entityKey,
        color: normalizeColor(entry.color),
    }));

    if (normalizedEntries.length !== validKeys.size) {
        throw new ValidationError('Color settings must include Unassigned and every active Ca Keo assignee');
    }

    const seenKeys = new Set<string>();
    const seenColors = new Set<string>();

    for (const entry of normalizedEntries) {
        if (!validKeys.has(entry.entityKey)) {
            throw new ValidationError('Unknown assignee in color settings');
        }
        if (seenKeys.has(entry.entityKey)) {
            throw new ValidationError('Duplicate assignee entries are not allowed');
        }
        if (seenColors.has(entry.color)) {
            throw new ValidationError('Colors must be unique within Ca Keo');
        }
        seenKeys.add(entry.entityKey);
        seenColors.add(entry.color);
    }

    await prisma.$transaction([
        prisma.moduleColorSetting.deleteMany({
            where: { module: CAKEO_COLOR_MODULE as any, scope: CAKEO_COLOR_SCOPE as any },
        }),
        prisma.moduleColorSetting.createMany({
            data: normalizedEntries.map((entry) => ({
                module: CAKEO_COLOR_MODULE as any,
                scope: CAKEO_COLOR_SCOPE as any,
                entityKey: entry.entityKey,
                color: entry.color,
            })),
        }),
    ]);

    return getCakeoColorSettings();
}

export async function resetCakeoColorSettings() {
    const users = await listCakeoAssignableUsers();
    const defaults = buildDefaultCakeoColorEntries(users);
    return saveCakeoColorSettings(defaults);
}
