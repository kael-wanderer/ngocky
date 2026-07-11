import { describe, expect, it, vi } from 'vitest';
import type { ActiveAgentConfig } from '../services/agentSettings';
import { AnthropicProviderAdapter } from '../services/assistant/providers/anthropic';
import { providerConfigFingerprint } from '../services/assistant/providers/factory';
import { OpenAIProviderAdapter } from '../services/assistant/providers/openai';

const openaiSettings: ActiveAgentConfig = {
    provider: 'OPENAI', apiKey: 'sk-secret-value', baseUrl: null, model: 'gpt-test', effort: 'low',
};

describe('agent provider adapters', () => {
    it('normalizes OpenAI models and structured output', async () => {
        const create = vi.fn(async () => ({ choices: [{ message: { content: '{"intent":"help"}' } }] }));
        const adapter = new OpenAIProviderAdapter(openaiSettings, {
            models: { list: vi.fn(async () => ({ data: [{ id: 'gpt-a' }] })) } as any,
            chat: { completions: { create } } as any,
        });

        expect(await adapter.listModels()).toEqual([{ id: 'gpt-a' }]);
        expect(await adapter.generateStructuredIntent({ systemPrompt: 'system', userText: 'hello' })).toBe('{"intent":"help"}');
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: 'gpt-test', reasoning_effort: 'low' }));
    });

    it('returns sanitized OpenAI connection failures', async () => {
        const adapter = new OpenAIProviderAdapter(openaiSettings, {
            models: { list: vi.fn() } as any,
            chat: { completions: { create: vi.fn(async () => { throw { status: 401, message: 'secret upstream body' }; }) } } as any,
        });
        expect(await adapter.testConnection()).toMatchObject({ success: false, error: { category: 'authentication', message: 'Authentication failed' } });
    });

    it('normalizes Claude models and text blocks', async () => {
        const settings: ActiveAgentConfig = { provider: 'ANTHROPIC', apiKey: 'sk-ant-secret', baseUrl: null, model: 'claude-test', effort: 'high' };
        const create = vi.fn(async () => ({ content: [{ type: 'text', text: '{"intent":"help"}' }] }));
        const adapter = new AnthropicProviderAdapter(settings, {
            models: { list: vi.fn(async () => ({ data: [{ id: 'claude-a', display_name: 'Claude A' }] })) } as any,
            messages: { create } as any,
        });

        expect(await adapter.listModels()).toEqual([{ id: 'claude-a', name: 'Claude A' }]);
        expect(await adapter.generateStructuredIntent({ systemPrompt: 'system', userText: 'hello' })).toBe('{"intent":"help"}');
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: 'claude-test', output_config: { effort: 'high' } }));
    });

    it('changes non-secret fingerprints when connection configuration changes', () => {
        const first = providerConfigFingerprint(openaiSettings);
        const changedModel = providerConfigFingerprint({ ...openaiSettings, model: 'gpt-other' });
        const changedKey = providerConfigFingerprint({ ...openaiSettings, apiKey: 'another-secret' });
        expect(first).not.toBe(changedModel);
        expect(first).not.toBe(changedKey);
        expect(first).not.toContain(openaiSettings.apiKey!);
    });
});
