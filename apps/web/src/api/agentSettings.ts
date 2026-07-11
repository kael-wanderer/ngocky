import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from './client';

export type AgentProvider = 'OPENAI' | 'ANTHROPIC' | 'OPENAI_COMPATIBLE';
export type AgentEffort = 'auto' | 'low' | 'medium' | 'high';
export type AgentProviderStatus = {
    provider: AgentProvider;
    configured: boolean;
    keyLast4: string | null;
    keySource: 'db' | 'env' | null;
    baseUrl: string | null;
    model: string;
    effort: AgentEffort;
};
export type AgentSettings = { activeProvider: AgentProvider; providers: AgentProviderStatus[] };
export type AgentSettingsInput = {
    activeProvider: AgentProvider;
    model: string;
    effort: AgentEffort;
    baseUrl?: string | null;
    apiKey?: string;
    useSavedKey?: boolean;
};

export function useAgentSettings() {
    return useQuery<AgentSettings>({ queryKey: ['agent-settings'], queryFn: async () => (await api.get('/agent-settings')).data });
}

export function useRefreshAgentSettings() {
    const queryClient = useQueryClient();
    return () => queryClient.invalidateQueries({ queryKey: ['agent-settings'] });
}

export async function saveAgentSettings(input: AgentSettingsInput) {
    return (await api.put<AgentSettings>('/agent-settings', input)).data;
}

export async function discoverAgentModels(input: AgentSettingsInput) {
    return (await api.post<{ models: Array<{ id: string; name?: string }> }>('/agent-settings/models', input)).data.models;
}

export async function testAgentConnection(input: AgentSettingsInput) {
    return (await api.post('/agent-settings/test', input)).data as {
        success: boolean;
        provider: AgentProvider;
        model: string;
        latencyMs: number;
        error?: { category: string; message: string };
    };
}

export async function deleteAgentKey(provider: AgentProvider) {
    return (await api.delete<AgentSettings>(`/agent-settings/${provider}/key`)).data;
}
