import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from './client';
import type { ModuleGroupId } from './appSettings';

export type PageModuleType = 'TASK' | 'PROJECT' | 'EXPENSE' | 'GOAL' | 'IDEA' | 'CALENDAR' | 'CAKEO' | 'HOUSEWORK' | 'ASSET' | 'HEALTHBOOK' | 'KEYBOARD' | 'FUND' | 'LEARNING';

export type PageTemplateDto = {
    moduleType: PageModuleType;
    label: string;
    group: ModuleGroupId;
    rootLabel: string;
    available: boolean;
    name: string;
    visible: boolean;
};

export type PageDeletePreview = {
    id: string;
    name: string;
    moduleType: PageModuleType;
    rootLabel: string;
    itemCount: number;
};

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

export function usePageTemplates() {
    return useQuery<PageTemplateDto[]>({
        queryKey: ['page-templates'],
        queryFn: async () => (await api.get('/pages/templates')).data,
        staleTime: 5 * 60_000,
    });
}

export async function getPageDeletePreview(id: string) {
    return (await api.get(`/pages/${id}/delete-preview`)).data as PageDeletePreview;
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
        mutationFn: ({ id, body }: { id: string; body: Partial<Pick<PageInstanceDto, 'name' | 'icon'>> }) => api.put(`/pages/${id}`, body),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pages'] }),
    });
}

export function useUpdateBuiltInPage() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ moduleType, body }: { moduleType: PageModuleType; body: { name?: string; visible?: boolean } }) => api.put(`/pages/templates/${moduleType}`, body),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['page-templates'] }),
    });
}

export function useDeletePage() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => (await api.delete(`/pages/${id}`)).data as { deletedItems: number },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pages'] }),
    });
}
