import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from './client';
import type { ModuleGroupId } from './appSettings';

export type PageModuleType = 'TASK' | 'PROJECT' | 'EXPENSE' | 'GOAL';

export type PageInstanceDto = {
    id: string;
    name: string;
    slug: string;
    moduleType: PageModuleType;
    group: ModuleGroupId;
    icon?: string | null;
};

export function usePages() {
    return useQuery<PageInstanceDto[]>({
        queryKey: ['pages'],
        queryFn: async () => (await api.get('/pages')).data,
        staleTime: 60_000,
    });
}

export function useCreatePage() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (body: { name: string; moduleType: PageModuleType; group: ModuleGroupId; icon?: string }) => api.post('/pages', body),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pages'] }),
    });
}

export function useUpdatePage() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, body }: { id: string; body: Partial<Pick<PageInstanceDto, 'name' | 'group' | 'icon'>> }) => api.put(`/pages/${id}`, body),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pages'] }),
    });
}

export function useDeletePage() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => (await api.delete(`/pages/${id}`)).data as { deletedItems: number },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pages'] }),
    });
}
