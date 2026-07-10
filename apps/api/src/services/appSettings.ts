import { prisma } from '../config/database';

const GROUPS = ['personal', 'family', 'hobby'] as const;

export type ModuleGroup = (typeof GROUPS)[number];

export type AppSettingsDto = {
    appName: string;
    enabledGroups: ModuleGroup[];
    setupCompleted: boolean;
};

export function normalizeGroups(raw: unknown): ModuleGroup[] {
    const list = Array.isArray(raw)
        ? raw.filter((group): group is ModuleGroup => (GROUPS as readonly string[]).includes(String(group)))
        : [];
    return [...new Set(['personal' as ModuleGroup, ...list])];
}

export class AppSettingsService {
    static async get(): Promise<AppSettingsDto> {
        const row = await prisma.appSetting.upsert({
            where: { id: 1 },
            update: {},
            create: { id: 1 },
        });
        return {
            appName: row.appName,
            enabledGroups: normalizeGroups(row.enabledGroups),
            setupCompleted: row.setupCompleted,
        };
    }

    static async update(data: { appName?: string; enabledGroups?: string[]; setupCompleted?: boolean }): Promise<AppSettingsDto> {
        await this.get();
        const row = await prisma.appSetting.update({
            where: { id: 1 },
            data: {
                ...(data.appName !== undefined ? { appName: data.appName } : {}),
                ...(data.enabledGroups !== undefined ? { enabledGroups: normalizeGroups(data.enabledGroups) } : {}),
                ...(data.setupCompleted !== undefined ? { setupCompleted: data.setupCompleted } : {}),
            },
        });
        return {
            appName: row.appName,
            enabledGroups: normalizeGroups(row.enabledGroups),
            setupCompleted: row.setupCompleted,
        };
    }
}
