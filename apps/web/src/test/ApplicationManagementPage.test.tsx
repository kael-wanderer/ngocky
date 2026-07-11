import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    create: vi.fn(), update: vi.fn(), remove: vi.fn(), updateSettings: vi.fn(), updateOverride: vi.fn(), resetOverride: vi.fn(),
    appSettings: { appName: 'NgốcKý', logoUrl: null, enabledGroups: ['personal', 'family', 'hobby'] },
    pages: [{ id: 'page-1', name: 'Work', slug: 'work', moduleType: 'TASK', group: 'personal' }],
    templates: [
        { moduleType: 'TASK', label: 'Tasks', name: 'Tasks', visible: true, group: 'personal', rootLabel: 'tasks', available: true },
        { moduleType: 'IDEA', label: 'Ideas', name: 'Ideas', visible: true, group: 'personal', rootLabel: 'topics', available: false },
    ],
}));
let role: 'OWNER' | 'ADMIN' = 'OWNER';

vi.mock('../stores/auth', () => ({ useAuthStore: (selector: any) => selector({ user: { role } }) }));
vi.mock('../api/appSettings', () => ({
    useAppSettings: () => ({ data: mocks.appSettings }),
    useUpdateAppSettings: () => ({ mutateAsync: mocks.updateSettings, isPending: false }),
}));
vi.mock('../api/pages', () => ({
    usePages: () => ({ data: mocks.pages }),
    usePageTemplates: () => ({ data: mocks.templates }),
    useCreatePage: () => ({ mutateAsync: mocks.create, isPending: false }),
    useUpdatePage: () => ({ mutateAsync: mocks.update }),
    useUpdateBuiltInPage: () => ({ mutateAsync: mocks.update }),
    useDeletePage: () => ({ mutateAsync: mocks.remove }),
    useUpdateTemplateOverride: () => ({ mutateAsync: mocks.updateOverride }),
    useResetTemplateOverride: () => ({ mutateAsync: mocks.resetOverride }),
    getPageDeletePreview: () => Promise.resolve({ id: 'page-1', name: 'Work', moduleType: 'TASK', rootLabel: 'tasks', itemCount: 2 }),
}));

import ApplicationManagementPage from '../pages/admin/ApplicationManagementPage';

describe('ApplicationManagementPage', () => {
    beforeEach(() => {
        role = 'OWNER';
        [mocks.create, mocks.update, mocks.remove, mocks.updateSettings, mocks.updateOverride, mocks.resetOverride].forEach((mock) => mock.mockReset());
        mocks.create.mockResolvedValue({});
        mocks.update.mockResolvedValue({});
        mocks.updateOverride.mockResolvedValue({});
        mocks.resetOverride.mockResolvedValue({});
    });

    it('shows owner application controls and lists unavailable templates as disabled', async () => {
        render(<ApplicationManagementPage />);
        expect(screen.getByLabelText(/app name/i)).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /^tasks$/i })).toBeInTheDocument();
        const ideasOption = screen.getByRole('option', { name: /ideas.*coming soon/i }) as HTMLOptionElement;
        expect(ideasOption).toBeDisabled();
        expect(await screen.findByText(/2 items/i)).toBeInTheDocument();
    });

    it('lets admins manage pages without application identity controls', () => {
        role = 'ADMIN';
        render(<ApplicationManagementPage />);
        expect(screen.queryByLabelText(/app name/i)).not.toBeInTheDocument();
        expect(screen.getByLabelText(/page name/i)).toBeInTheDocument();
    });

    it('creates a page in its canonical group', async () => {
        render(<ApplicationManagementPage />);
        fireEvent.change(screen.getByLabelText(/page name/i), { target: { value: 'Client work' } });
        fireEvent.click(screen.getByRole('button', { name: /create/i }));
        await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ name: 'Client work', moduleType: 'TASK', group: 'personal' }));
    });

    it('filters templates after selecting a module', () => {
        render(<ApplicationManagementPage />);
        fireEvent.change(screen.getByLabelText(/^module$/i), { target: { value: 'family' } });
        expect(screen.getByLabelText(/^template$/i)).toBeDisabled();
        expect(screen.getByRole('option', { name: /no templates available yet/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
    });

    it('requires the exact page name before destructive deletion', async () => {
        mocks.remove.mockResolvedValue({});
        const prompt = vi.spyOn(window, 'prompt').mockReturnValueOnce('wrong').mockReturnValueOnce('Work');
        render(<ApplicationManagementPage />);
        fireEvent.click(screen.getAllByTitle(/delete page/i).at(-1)!);
        await waitFor(() => expect(prompt).toHaveBeenCalled());
        expect(mocks.remove).not.toHaveBeenCalled();
        fireEvent.click(screen.getAllByTitle(/delete page/i).at(-1)!);
        await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith('page-1'));
        prompt.mockRestore();
    });

    it('renames a page inline with Enter, without a prompt dialog', async () => {
        const prompt = vi.spyOn(window, 'prompt');
        render(<ApplicationManagementPage />);
        fireEvent.click(screen.getAllByTitle(/rename page/i).at(-1)!);
        const input = screen.getByDisplayValue('Work');
        fireEvent.change(input, { target: { value: 'Home Tasks' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ id: 'page-1', body: { name: 'Home Tasks' } }));
        expect(prompt).not.toHaveBeenCalled();
        prompt.mockRestore();
    });

    it('cancels inline rename on Escape without saving', () => {
        render(<ApplicationManagementPage />);
        fireEvent.click(screen.getAllByTitle(/rename page/i).at(-1)!);
        const input = screen.getByDisplayValue('Work');
        fireEvent.change(input, { target: { value: 'Something else' } });
        fireEvent.keyDown(input, { key: 'Escape' });
        expect(mocks.update).not.toHaveBeenCalled();
        expect(screen.getByText('Work')).toBeInTheDocument();
    });

    it('lets an OWNER move a template to another module group', async () => {
        render(<ApplicationManagementPage />);
        const groupSelects = screen.getAllByDisplayValue(/personal/i);
        const templateGroupSelect = groupSelects[groupSelects.length - 1];
        fireEvent.change(templateGroupSelect, { target: { value: 'hobby' } });
        await waitFor(() => expect(mocks.updateOverride).toHaveBeenCalledWith({ moduleType: 'IDEA', body: { group: 'hobby' } }));
    });
});
