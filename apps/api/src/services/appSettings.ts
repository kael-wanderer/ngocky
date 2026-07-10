import { prisma } from '../config/database';
import { config } from '../config/env';
import { encryptSecret, decryptSecret } from '../utils/secrets';

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

    /** Write-only status — never returns the key itself. */
    static async getOpenaiKeyStatus(): Promise<{ configured: boolean; last4: string | null; source: 'db' | 'env' | null }> {
        const row = await prisma.appSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
        if (row.openaiKeyCiphertext) {
            return { configured: true, last4: row.openaiKeyLast4, source: 'db' };
        }
        if (config.OPENAI_API_KEY) {
            return { configured: true, last4: config.OPENAI_API_KEY.slice(-4), source: 'env' };
        }
        return { configured: false, last4: null, source: null };
    }

    static async setOpenaiKey(key: string): Promise<void> {
        await this.get();
        await prisma.appSetting.update({
            where: { id: 1 },
            data: { openaiKeyCiphertext: encryptSecret(key), openaiKeyLast4: key.slice(-4) },
        });
    }

    static async clearOpenaiKey(): Promise<void> {
        await this.get();
        await prisma.appSetting.update({
            where: { id: 1 },
            data: { openaiKeyCiphertext: null, openaiKeyLast4: null },
        });
    }

    /** Decrypted key for internal use (OpenAI client). DB-stored key wins over env. */
    static async getOpenaiKey(): Promise<string | null> {
        const row = await prisma.appSetting.findUnique({ where: { id: 1 } });
        if (row?.openaiKeyCiphertext) {
            const key = decryptSecret(row.openaiKeyCiphertext);
            if (key) return key;
        }
        return config.OPENAI_API_KEY || null;
    }
}
