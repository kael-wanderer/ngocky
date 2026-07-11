import { prisma } from '../config/database';
import { AgentSettingsService } from './agentSettings';

const GROUPS = ['personal', 'family', 'hobby'] as const;

export type ModuleGroup = (typeof GROUPS)[number];

export type AppSettingsDto = {
    appName: string;
    logoUrl: string | null;
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
            logoUrl: row.logoUrl,
            enabledGroups: normalizeGroups(row.enabledGroups),
            setupCompleted: row.setupCompleted,
        };
    }

    static async update(data: { appName?: string; logoUrl?: string | null; enabledGroups?: string[]; setupCompleted?: boolean }): Promise<AppSettingsDto> {
        await this.get();
        const row = await prisma.appSetting.update({
            where: { id: 1 },
            data: {
                ...(data.appName !== undefined ? { appName: data.appName } : {}),
                ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
                ...(data.enabledGroups !== undefined ? { enabledGroups: normalizeGroups(data.enabledGroups) } : {}),
                ...(data.setupCompleted !== undefined ? { setupCompleted: data.setupCompleted } : {}),
            },
        });
        return {
            appName: row.appName,
            logoUrl: row.logoUrl,
            enabledGroups: normalizeGroups(row.enabledGroups),
            setupCompleted: row.setupCompleted,
        };
    }

    /** Write-only status — never returns the key itself. */
    static async getOpenaiKeyStatus(): Promise<{ configured: boolean; last4: string | null; source: 'db' | 'env' | null }> {
        const settings = await AgentSettingsService.get();
        const openai = settings.providers.find((item) => item.provider === 'OPENAI')!;
        return { configured: openai.configured, last4: openai.keyLast4, source: openai.keySource };
    }

    static async setOpenaiKey(key: string): Promise<void> {
        await AgentSettingsService.setProviderKey('OPENAI', key);
    }

    static async clearOpenaiKey(): Promise<void> {
        await AgentSettingsService.clearKey('OPENAI');
    }

    /** Decrypted key for internal use (OpenAI client). DB-stored key wins over env. */
    static async getOpenaiKey(): Promise<string | null> {
        return (await AgentSettingsService.getProviderConfig('OPENAI'))?.apiKey ?? null;
    }
}
