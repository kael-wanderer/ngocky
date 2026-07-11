import OpenAI from 'openai';
import type { ActiveAgentConfig } from '../../agentSettings';
import type { AgentConnectionResult, AgentIntentInput, AgentModel, AgentProviderAdapter } from './types';
import { sanitizedProviderError } from './types';

export type OpenAIClientLike = Pick<OpenAI, 'models' | 'chat'>;

function effortParams(effort: ActiveAgentConfig['effort']) {
    return effort === 'auto' ? {} : { reasoning_effort: effort };
}

export class OpenAIProviderAdapter implements AgentProviderAdapter {
    constructor(protected readonly settings: ActiveAgentConfig, protected readonly client: OpenAIClientLike) {}

    async listModels(): Promise<AgentModel[]> {
        const page = await this.client.models.list();
        return page.data.map((model) => ({ id: model.id }));
    }

    async testConnection(): Promise<AgentConnectionResult> {
        const started = Date.now();
        try {
            await this.client.chat.completions.create({
                model: this.settings.model,
                max_completion_tokens: 1,
                messages: [{ role: 'user', content: 'Reply OK' }],
                ...effortParams(this.settings.effort),
            } as any);
            return { success: true, provider: this.settings.provider, model: this.settings.model, latencyMs: Date.now() - started };
        } catch (error) {
            return {
                success: false,
                provider: this.settings.provider,
                model: this.settings.model,
                latencyMs: Date.now() - started,
                error: sanitizedProviderError(error),
            };
        }
    }

    async generateStructuredIntent(input: AgentIntentInput) {
        const response = await this.client.chat.completions.create({
            model: this.settings.model,
            max_completion_tokens: input.maxTokens ?? 512,
            messages: [
                { role: 'system', content: input.systemPrompt },
                { role: 'user', content: input.userText },
            ],
            ...effortParams(this.settings.effort),
        } as any);
        return response.choices[0]?.message?.content ?? '';
    }
}
