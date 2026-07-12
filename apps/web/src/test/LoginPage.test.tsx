import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginPage from '../pages/LoginPage';

vi.mock('../api/client', () => ({
    getApiBaseUrl: vi.fn(() => '/api'),
    default: {
        get: vi.fn(async () => ({ data: { appName: 'NgốcKý', enabledGroups: ['personal', 'family', 'hobby'], setupCompleted: true } })),
        post: vi.fn(),
    },
}));

vi.mock('../stores/auth', () => ({
    useAuthStore: () => ({
        login: vi.fn(),
    }),
}));

describe('LoginPage', () => {
    it('renders email and password fields', () => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <LoginPage />
                </MemoryRouter>
            </QueryClientProvider>,
        );

        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
        expect(document.querySelector('input[type="password"]')).toBeTruthy();
    });
});
