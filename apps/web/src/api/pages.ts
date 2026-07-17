import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from './client';
import type { ModuleGroupId } from './appSettings';

export type PageModuleType = 'TASK' | 'PROJECT' | 'EXPENSE' | 'GOAL' | 'IDEA' | 'CALENDAR' | 'CAKEO' | 'HOUSEWORK' | 'ASSET' | 'HEALTHBOOK' | 'KEYBOARD' | 'FOODPLACE' | 'FUND' | 'LEARNING';

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

export type FoodPlace = {
    id: string;
    name: string;
    tag: string | null;
    type: string | null;
    distance: string | null;
    address: string | null;
    district: string | null;
    openHours: string | null;
    priceEst: string | null;
    rating: number | null;
    mapLink: string | null;
    note: string | null;
    isShared: boolean;
    ownerId: string;
    sortOrder: number;
};

export type FoodOptions = { tags: string[]; types: string[]; distances: string[] };

export const foods = {
    list: (params: { instanceId?: string; tag?: string; type?: string; distance?: string } = {}) => api.get('/foods', { params: { ...params, page: 1, limit: 1000 } }),
    create: (body: Partial<FoodPlace> & { name: string; instanceId?: string }) => api.post('/foods', body),
    update: (id: string, body: Partial<FoodPlace>, instanceId?: string) => api.patch(`/foods/${id}`, body, { params: instanceId ? { instanceId } : {} }),
    remove: (id: string, instanceId?: string) => api.delete(`/foods/${id}`, { params: instanceId ? { instanceId } : {} }),
    import: (items: Array<Partial<FoodPlace>>, instanceId?: string) => api.post('/foods/import', { items, instanceId }, { params: instanceId ? { instanceId } : {} }),
    getOptions: () => api.get<FoodOptions>('/app-settings/food-options'),
    updateOptions: (body: Partial<FoodOptions>) => api.patch<FoodOptions>('/app-settings/food-options', body),
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

export function useUpdateTemplateOverride() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ moduleType, body }: { moduleType: PageModuleType; body: { label?: string; group?: ModuleGroupId } }) => api.put(`/pages/templates/${moduleType}/override`, body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['page-templates'] });
            queryClient.invalidateQueries({ queryKey: ['pages'] });
        },
    });
}

export function useResetTemplateOverride() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (moduleType: PageModuleType) => api.delete(`/pages/templates/${moduleType}/override`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['page-templates'] });
            queryClient.invalidateQueries({ queryKey: ['pages'] });
        },
    });
}

export function useDeletePage() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => (await api.delete(`/pages/${id}`)).data as { deletedItems: number },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pages'] }),
    });
}
