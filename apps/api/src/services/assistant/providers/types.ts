import type { ActiveAgentConfig } from '../../agentSettings';

export type AgentModel = { id: string; name?: string };
export type AgentConnectionResult = {
    success: boolean;
    provider: ActiveAgentConfig['provider'];
    model: string;
    latencyMs: number;
    error?: { category: string; message: string };
};
export type AgentIntentInput = { systemPrompt: string; userText: string; maxTokens?: number };

export interface AgentProviderAdapter {
    listModels(): Promise<AgentModel[]>;
    testConnection(): Promise<AgentConnectionResult>;
    generateStructuredIntent(input: AgentIntentInput): Promise<string>;
}

export function sanitizedProviderError(error: unknown) {
    const status = typeof error === 'object' && error && 'status' in error ? Number((error as any).status) : 0;
    const category = status === 401 || status === 403 ? 'authentication'
        : status === 404 ? 'model_or_endpoint'
            : status === 429 ? 'rate_limit'
                : status >= 500 ? 'provider'
                    : error instanceof DOMException && error.name === 'AbortError' ? 'timeout'
                        : 'connection';
    const message = category === 'authentication' ? 'Authentication failed'
        : category === 'model_or_endpoint' ? 'Model or endpoint was not found'
            : category === 'rate_limit' ? 'Provider rate limit reached'
                : category === 'timeout' ? 'Provider request timed out'
                    : category === 'provider' ? 'Provider service error'
                        : 'Could not connect to provider';
    return { category, message };
}
