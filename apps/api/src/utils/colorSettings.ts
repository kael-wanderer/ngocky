import { prisma } from '../config/database';
import { ValidationError } from './errors';

export const COLOR_SETTING_UNASSIGNED_KEY = 'UNASSIGNED';
export const CAKEO_COLOR_MODULE = 'CAKEO';
export const CALENDAR_COLOR_MODULE = 'CALENDAR';
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

function buildEffectiveModuleEntries(
    module: typeof CAKEO_COLOR_MODULE | typeof CALENDAR_COLOR_MODULE,
    users: Array<{ id: string; email: string }>,
    stored: Array<{ entityKey: string; color: string }>,
) {
    const defaults = buildDefaultCakeoColorEntries(users).filter((entry) => entry.entityKey !== COLOR_SETTING_UNASSIGNED_KEY);
    const storedByKey = new Map<string, string>(stored.map((entry) => [entry.entityKey, normalizeColor(entry.color)]));
    const userEntries = defaults.map((entry) => ({
        entityKey: entry.entityKey,
        color: storedByKey.get(entry.entityKey) || entry.color,
    }));

    return module === CAKEO_COLOR_MODULE
        ? [{ entityKey: COLOR_SETTING_UNASSIGNED_KEY, color: DEFAULT_UNASSIGNED_COLOR }, ...userEntries]
        : userEntries;
}

async function getStoredModuleEntries(module: typeof CAKEO_COLOR_MODULE | typeof CALENDAR_COLOR_MODULE) {
    return prisma.moduleColorSetting.findMany({
        where: { module: module as any, scope: CAKEO_COLOR_SCOPE as any },
        orderBy: { createdAt: 'asc' },
    });
}

export async function getModuleColorSettings(module: typeof CAKEO_COLOR_MODULE | typeof CALENDAR_COLOR_MODULE, currentUserId: string) {
    const [users, stored] = await Promise.all([
        listCakeoAssignableUsers(),
        getStoredModuleEntries(module),
    ]);

    const entries = buildEffectiveModuleEntries(module, users, stored as Array<{ entityKey: string; color: string }>);
    const currentUserEntry = entries.find((entry) => entry.entityKey === currentUserId) || null;
    const usedColors = entries
        .filter((entry) => entry.entityKey !== currentUserId)
        .map((entry) => entry.color);

    return {
        entries,
        currentUserEntry,
        usedColors,
    };
}

export async function saveOwnModuleColorSetting(
    module: typeof CAKEO_COLOR_MODULE | typeof CALENDAR_COLOR_MODULE,
    userId: string,
    color: string,
) {
    const normalizedColor = normalizeColor(color);
    const settings = await getModuleColorSettings(module, userId);

    if (settings.usedColors.includes(normalizedColor)) {
        throw new ValidationError('This color is already used in this module. Please choose a different color.');
    }

    await prisma.moduleColorSetting.upsert({
        where: {
            module_scope_entityKey: {
                module: module as any,
                scope: CAKEO_COLOR_SCOPE as any,
                entityKey: userId,
            },
        },
        update: { color: normalizedColor },
        create: {
            module: module as any,
            scope: CAKEO_COLOR_SCOPE as any,
            entityKey: userId,
            color: normalizedColor,
        },
    });

    return getModuleColorSettings(module, userId);
}

export async function resetOwnModuleColorSetting(
    module: typeof CAKEO_COLOR_MODULE | typeof CALENDAR_COLOR_MODULE,
    userId: string,
) {
    await prisma.moduleColorSetting.deleteMany({
        where: {
            module: module as any,
            scope: CAKEO_COLOR_SCOPE as any,
            entityKey: userId,
        },
    });

    return getModuleColorSettings(module, userId);
}
