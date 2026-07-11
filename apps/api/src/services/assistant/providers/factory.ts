import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { AgentSettingsService, type ActiveAgentConfig } from '../../agentSettings';
import { createSafeAgentFetch, validateAgentEndpoint } from '../../../utils/safeAgentEndpoint';
import { AnthropicProviderAdapter, type AnthropicClientLike } from './anthropic';
import { OpenAIProviderAdapter, type OpenAIClientLike } from './openai';
import { OpenAICompatibleProviderAdapter } from './openaiCompatible';
import type { AgentProviderAdapter } from './types';

type ProviderDependencies = {
    openaiClient?: (settings: ActiveAgentConfig) => OpenAIClientLike;
    anthropicClient?: (settings: ActiveAgentConfig) => AnthropicClientLike;
};

let cached: { fingerprint: string; adapter: AgentProviderAdapter } | null = null;

export function providerConfigFingerprint(settings: ActiveAgentConfig) {
    return crypto.createHash('sha256').update(JSON.stringify({
        provider: settings.provider,
        model: settings.model,
        effort: settings.effort,
        baseUrl: settings.baseUrl,
        keyHash: crypto.createHash('sha256').update(settings.apiKey ?? '').digest('hex'),
    })).digest('hex');
}

export async function createProviderAdapter(settings: ActiveAgentConfig, dependencies: ProviderDependencies = {}) {
    if (settings.provider === 'ANTHROPIC') {
        const client = dependencies.anthropicClient?.(settings) ?? new Anthropic({ apiKey: settings.apiKey ?? '' });
        return new AnthropicProviderAdapter(settings, client);
    }
    if (settings.provider === 'OPENAI_COMPATIBLE') {
        await validateAgentEndpoint(settings.baseUrl ?? '');
        const client = dependencies.openaiClient?.(settings) ?? new OpenAI({
            apiKey: settings.apiKey || 'not-required',
            baseURL: settings.baseUrl ?? undefined,
            fetch: createSafeAgentFetch(),
        });
        return new OpenAICompatibleProviderAdapter(settings, client);
    }
    const client = dependencies.openaiClient?.(settings) ?? new OpenAI({ apiKey: settings.apiKey ?? '' });
    return new OpenAIProviderAdapter(settings, client);
}

export async function getActiveProviderAdapter() {
    const settings = await AgentSettingsService.getActiveConfig();
    if (!settings) {
        cached = null;
        return null;
    }
    const nextFingerprint = providerConfigFingerprint(settings);
    if (!cached || cached.fingerprint !== nextFingerprint) {
        cached = { fingerprint: nextFingerprint, adapter: await createProviderAdapter(settings) };
    }
    return cached.adapter;
}

export function resetProviderAdapterCache() {
    cached = null;
}
