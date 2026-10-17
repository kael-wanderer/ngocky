import api from './client';

export type HobbyField = 'category' | 'condition' | 'spec' | 'tag' | 'color';
export type BuiltInCategoryKey = 'KEYCAP' | 'KIT' | 'SHIPPING' | 'ACCESSORIES' | 'OTHER';
export type HobbyOption = { id: string; label: string; color?: string; builtInKey?: BuiltInCategoryKey };
export type HobbyOptions = Record<HobbyField, HobbyOption[]>;
export type HobbyUsage = Record<HobbyField, Record<string, number>>;
export type HobbyOptionPayload = { label: string; color?: string };
export type HobbyDeletePayload = { mode: 'move'; targetId: string } | { mode: 'clear' };

const basePath = '/app-settings/hobby-options';

export const hobbyOptions = {
    async list(): Promise<{ options: HobbyOptions; usage: HobbyUsage }> {
        return (await api.get(basePath)).data;
    },
    async add(field: HobbyField, body: HobbyOptionPayload): Promise<HobbyOption> {
        return (await api.post(`${basePath}/${field}`, body)).data;
    },
    async update(field: HobbyField, id: string, body: Partial<HobbyOptionPayload>): Promise<HobbyOption> {
        return (await api.patch(`${basePath}/${field}/${id}`, body)).data;
    },
    async reorder(field: HobbyField, ids: string[]): Promise<HobbyOption[]> {
        return (await api.put(`${basePath}/${field}/order`, { ids })).data;
    },
    async remove(field: HobbyField, id: string, body: HobbyDeletePayload): Promise<void> {
        await api.delete(`${basePath}/${field}/${id}`, { data: body });
    },
};
