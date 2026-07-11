import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    create: vi.fn(), update: vi.fn(), remove: vi.fn(), updateSettings: vi.fn(),
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
    getPageDeletePreview: () => Promise.resolve({ id: 'page-1', name: 'Work', moduleType: 'TASK', rootLabel: 'tasks', itemCount: 2 }),
}));

import ApplicationManagementPage from '../pages/admin/ApplicationManagementPage';

describe('ApplicationManagementPage', () => {
    beforeEach(() => {
        role = 'OWNER';
        [mocks.create, mocks.update, mocks.remove, mocks.updateSettings].forEach((mock) => mock.mockReset());
        mocks.create.mockResolvedValue({});
    });

    it('shows owner application controls and only available create templates', async () => {
        render(<ApplicationManagementPage />);
        expect(screen.getByLabelText(/app name/i)).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /tasks/i })).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: /ideas/i })).not.toBeInTheDocument();
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
        expect(screen.getByLabelText(/page template/i)).toBeDisabled();
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
});
