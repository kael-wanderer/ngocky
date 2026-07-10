import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';

vi.mock('../api/client', () => ({
    default: {
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
        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>,
        );

        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
        expect(document.querySelector('input[type="password"]')).toBeTruthy();
    });
});
