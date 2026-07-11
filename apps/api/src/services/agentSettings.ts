import { AgentProvider, type AgentProviderConfig } from '@prisma/client';
import { prisma } from '../config/database';
import { config } from '../config/env';
import { decryptSecret, encryptSecret } from '../utils/secrets';
import { validateAgentEndpoint } from '../utils/safeAgentEndpoint';

export type AgentEffort = 'auto' | 'low' | 'medium' | 'high';
export type AgentKeySource = 'db' | 'env' | null;

const DEFAULT_MODELS: Record<AgentProvider, string> = {
    OPENAI: 'gpt-4o-mini',
    ANTHROPIC: 'claude-sonnet-4-6',
    OPENAI_COMPATIBLE: 'model',
};

export type AgentProviderStatus = {
    provider: AgentProvider;
    configured: boolean;
    keyLast4: string | null;
    keySource: AgentKeySource;
    baseUrl: string | null;
    model: string;
    effort: AgentEffort;
};

export type ActiveAgentConfig = {
    provider: AgentProvider;
    apiKey: string | null;
    baseUrl: string | null;
    model: string;
    effort: AgentEffort;
};

export type AgentSettingsUpdate = {
    activeProvider: AgentProvider;
    model: string;
    effort: AgentEffort;
    baseUrl?: string | null;
    apiKey?: string | null;
};

function normalizeEffort(value: string): AgentEffort {
    return ['auto', 'low', 'medium', 'high'].includes(value) ? value as AgentEffort : 'auto';
}

export class AgentSettingsService {
    private static async migrateLegacyOpenaiConfig() {
        const existing = await prisma.agentProviderConfig.findUnique({ where: { provider: 'OPENAI' } });
        if (existing) return existing;
        const legacy = await prisma.appSetting.findUnique({ where: { id: 1 } });
        if (!legacy?.openaiKeyCiphertext) return null;
        return prisma.agentProviderConfig.create({
            data: {
                provider: 'OPENAI',
                model: DEFAULT_MODELS.OPENAI,
                keyCiphertext: legacy.openaiKeyCiphertext,
                keyLast4: legacy.openaiKeyLast4,
            },
        });
    }

    static async get() {
        await this.migrateLegacyOpenaiConfig();
        const [setting, rows] = await Promise.all([
            prisma.agentSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
            prisma.agentProviderConfig.findMany(),
        ]);
        const byProvider = new Map<AgentProvider, AgentProviderConfig>(rows.map((row: AgentProviderConfig) => [row.provider, row]));
        const providers = (Object.values(AgentProvider) as AgentProvider[]).map((provider): AgentProviderStatus => {
            const row = byProvider.get(provider);
            const envKey = provider === 'OPENAI' ? config.OPENAI_API_KEY : undefined;
            const keySource: AgentKeySource = row?.keyCiphertext ? 'db' : envKey ? 'env' : null;
            const configured = provider === 'OPENAI_COMPATIBLE'
                ? Boolean(row?.baseUrl && row.model)
                : Boolean(keySource);
            return {
                provider,
                configured,
                keyLast4: row?.keyCiphertext ? row.keyLast4 : envKey?.slice(-4) ?? null,
                keySource,
                baseUrl: row?.baseUrl ?? null,
                model: row?.model ?? DEFAULT_MODELS[provider],
                effort: normalizeEffort(row?.effort ?? 'auto'),
            };
        });
        return { activeProvider: setting.activeProvider, providers };
    }

    static async update(data: AgentSettingsUpdate) {
        if (data.activeProvider === 'OPENAI_COMPATIBLE' && data.baseUrl) {
            await validateAgentEndpoint(data.baseUrl);
        }
        await prisma.$transaction([
            prisma.agentSetting.upsert({
                where: { id: 1 },
                update: { activeProvider: data.activeProvider },
                create: { id: 1, activeProvider: data.activeProvider },
            }),
            prisma.agentProviderConfig.upsert({
                where: { provider: data.activeProvider },
                update: {
                    model: data.model,
                    effort: data.effort,
                    baseUrl: data.activeProvider === 'OPENAI_COMPATIBLE' ? data.baseUrl : null,
                    ...(data.apiKey ? { keyCiphertext: encryptSecret(data.apiKey), keyLast4: data.apiKey.slice(-4) } : {}),
                },
                create: {
                    provider: data.activeProvider,
                    model: data.model,
                    effort: data.effort,
                    baseUrl: data.activeProvider === 'OPENAI_COMPATIBLE' ? data.baseUrl : null,
                    ...(data.apiKey ? { keyCiphertext: encryptSecret(data.apiKey), keyLast4: data.apiKey.slice(-4) } : {}),
                },
            }),
        ]);
        return this.get();
    }

    static async clearKey(provider: AgentProvider) {
        await prisma.agentProviderConfig.upsert({
            where: { provider },
            update: { keyCiphertext: null, keyLast4: null },
            create: { provider, model: DEFAULT_MODELS[provider] },
        });
        return this.get();
    }

    static async setProviderKey(provider: AgentProvider, apiKey: string) {
        await prisma.agentProviderConfig.upsert({
            where: { provider },
            update: { keyCiphertext: encryptSecret(apiKey), keyLast4: apiKey.slice(-4) },
            create: { provider, model: DEFAULT_MODELS[provider], keyCiphertext: encryptSecret(apiKey), keyLast4: apiKey.slice(-4) },
        });
        return this.get();
    }

    static async getActiveConfig() {
        await this.migrateLegacyOpenaiConfig();
        const setting = await prisma.agentSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
        return this.getProviderConfig(setting.activeProvider);
    }

    static async getProviderConfig(provider: AgentProvider, override: Partial<AgentSettingsUpdate> = {}): Promise<ActiveAgentConfig | null> {
        const row = await prisma.agentProviderConfig.findUnique({ where: { provider } });
        const storedKey = row?.keyCiphertext ? decryptSecret(row.keyCiphertext) : null;
        const hasKeyOverride = Object.prototype.hasOwnProperty.call(override, 'apiKey');
        const apiKey = hasKeyOverride
            ? override.apiKey ?? null
            : storedKey ?? (provider === 'OPENAI' ? config.OPENAI_API_KEY : null) ?? null;
        const model = override.model ?? row?.model ?? DEFAULT_MODELS[provider];
        const baseUrl = provider === 'OPENAI_COMPATIBLE' ? override.baseUrl ?? row?.baseUrl ?? null : null;
        if (provider !== 'OPENAI_COMPATIBLE' && !apiKey) return null;
        if (provider === 'OPENAI_COMPATIBLE' && !baseUrl) return null;
        return { provider, apiKey, baseUrl, model, effort: override.effort ?? normalizeEffort(row?.effort ?? 'auto') };
    }
}
