import Anthropic from '@anthropic-ai/sdk';
import type { ActiveAgentConfig } from '../../agentSettings';
import type { AgentConnectionResult, AgentIntentInput, AgentModel, AgentProviderAdapter } from './types';
import { sanitizedProviderError } from './types';

export type AnthropicClientLike = Pick<Anthropic, 'models' | 'messages'>;

function effortParams(effort: ActiveAgentConfig['effort']) {
    return effort === 'auto' ? {} : { output_config: { effort } };
}

export class AnthropicProviderAdapter implements AgentProviderAdapter {
    constructor(private readonly settings: ActiveAgentConfig, private readonly client: AnthropicClientLike) {}

    async listModels(): Promise<AgentModel[]> {
        const page = await this.client.models.list({ limit: 100 });
        return page.data.map((model) => ({ id: model.id, name: model.display_name }));
    }

    async testConnection(): Promise<AgentConnectionResult> {
        const started = Date.now();
        try {
            await this.client.messages.create({
                model: this.settings.model,
                max_tokens: 1,
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
        const response = await this.client.messages.create({
            model: this.settings.model,
            max_tokens: input.maxTokens ?? 512,
            system: input.systemPrompt,
            messages: [{ role: 'user', content: input.userText }],
            ...effortParams(this.settings.effort),
        } as any);
        return response.content
            .filter((block): block is Anthropic.TextBlock => block.type === 'text')
            .map((block) => block.text)
            .join('');
    }
}
