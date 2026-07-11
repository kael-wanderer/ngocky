import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    save: vi.fn(), discover: vi.fn(), test: vi.fn(), remove: vi.fn(), refresh: vi.fn(),
}));

vi.mock('../api/agentSettings', () => ({
    useAgentSettings: () => ({
        isLoading: false,
        data: {
            activeProvider: 'OPENAI',
            providers: [
                { provider: 'OPENAI', configured: true, keyLast4: '1234', keySource: 'env', baseUrl: null, model: 'gpt-test', effort: 'auto' },
                { provider: 'ANTHROPIC', configured: false, keyLast4: null, keySource: null, baseUrl: null, model: 'claude-test', effort: 'auto' },
                { provider: 'OPENAI_COMPATIBLE', configured: false, keyLast4: null, keySource: null, baseUrl: 'https://example.com/v1', model: 'custom-model', effort: 'low' },
            ],
        },
    }),
    useRefreshAgentSettings: () => mocks.refresh,
    saveAgentSettings: mocks.save,
    discoverAgentModels: mocks.discover,
    testAgentConnection: mocks.test,
    deleteAgentKey: mocks.remove,
}));

import AgentSettingsPage from '../pages/admin/AgentSettingsPage';

describe('AgentSettingsPage', () => {
    beforeEach(() => {
        Object.values(mocks).forEach((mock) => mock.mockReset());
        mocks.save.mockResolvedValue({});
        mocks.refresh.mockResolvedValue(undefined);
    });

    it('shows masked status and provider-specific fields', async () => {
        render(<AgentSettingsPage />);
        expect(await screen.findByText(/1234/)).toBeInTheDocument();
        expect(screen.queryByLabelText(/base url/i)).not.toBeInTheDocument();
        fireEvent.change(screen.getByLabelText(/provider/i), { target: { value: 'OPENAI_COMPATIBLE' } });
        expect(await screen.findByLabelText(/base url/i)).toBeInTheDocument();
    });

    it('saves without placing a blank key in the request', async () => {
        render(<AgentSettingsPage />);
        fireEvent.click(await screen.findByRole('button', { name: /^save$/i }));
        await waitFor(() => expect(mocks.save).toHaveBeenCalled());
        expect(mocks.save.mock.calls[0][0]).not.toHaveProperty('apiKey');
    });

    it('falls back to manual model entry when discovery fails', async () => {
        mocks.discover.mockRejectedValue({ response: { data: { message: 'Models unavailable' } } });
        render(<AgentSettingsPage />);
        fireEvent.click(await screen.findByRole('button', { name: /load models/i }));
        expect(await screen.findByText(/enter a model ID manually/i)).toBeInTheDocument();
    });
});
