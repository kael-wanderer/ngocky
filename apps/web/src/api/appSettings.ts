import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from './client';

export type ModuleGroupId = 'personal' | 'family' | 'hobby';

export type AppSettings = {
    appName: string;
    enabledGroups: ModuleGroupId[];
    setupCompleted: boolean;
};

export function useAppSettings() {
    return useQuery<AppSettings>({
        queryKey: ['app-settings'],
        queryFn: async () => (await api.get('/app-settings')).data,
        staleTime: 5 * 60_000,
    });
}

export function useSetupStatus(enabled = true) {
    return useQuery<{ needsSetup: boolean }>({
        queryKey: ['setup-status'],
        queryFn: async () => (await api.get('/setup/status')).data,
        enabled,
        staleTime: 30_000,
    });
}

export function useUpdateAppSettings() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (body: Partial<Pick<AppSettings, 'appName' | 'enabledGroups'>>) => api.put('/app-settings', body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['app-settings'] });
        },
    });
}

export type OpenaiKeyStatus = { configured: boolean; last4: string | null; source: 'db' | 'env' | null };

export function useOpenaiKeyStatus(enabled = true) {
    return useQuery<OpenaiKeyStatus>({
        queryKey: ['openai-key-status'],
        queryFn: async () => (await api.get('/app-settings/openai-key')).data,
        enabled,
    });
}

export function useSetOpenaiKey() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (key: string) => api.put('/app-settings/openai-key', { key }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['openai-key-status'] }),
    });
}

export function useDeleteOpenaiKey() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => api.delete('/app-settings/openai-key'),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['openai-key-status'] }),
    });
}
