import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from './client';

export type ModuleGroupId = 'personal' | 'family' | 'hobby';
export type FoodOptions = { tags: string[]; types: string[]; distances: string[] };

export type AppSettings = {
    appName: string;
    logoUrl: string | null;
    enabledGroups: ModuleGroupId[];
    setupCompleted: boolean;
    foodOptions: FoodOptions;
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
        mutationFn: (body: Partial<Pick<AppSettings, 'appName' | 'logoUrl' | 'enabledGroups'>>) => api.put('/app-settings', body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['app-settings'] });
        },
    });
}
