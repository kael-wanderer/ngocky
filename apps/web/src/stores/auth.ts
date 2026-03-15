import { create } from 'zustand';
import type { FeatureFlags } from '../config/features';

interface User extends FeatureFlags {
    id: string;
    email: string;
    name: string;
    role: 'OWNER' | 'ADMIN' | 'USER';
    theme: string;
    mfaEnabled?: boolean;
    avatarUrl?: string | null;
    mobileNavItems?: string[];
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isInitialized: boolean;
    login: (user: User, token: string) => void;
    logout: () => void;
    setUser: (user: User) => void;
    initialize: () => void;
    refreshUser: () => Promise<void>;
}

const applyTheme = (theme?: string) => {
    document.documentElement.className = '';
    if (theme === 'GREY_BLACK') document.documentElement.classList.add('theme-grey-black');
    else if (theme === 'RED_ACCENT') document.documentElement.classList.add('theme-red-accent');
    else if (theme === 'DARK') document.documentElement.classList.add('theme-dark');
    else if (theme === 'MODERN_GREEN') document.documentElement.classList.add('theme-modern-green');
    else if (theme === 'MULTI_COLOR_BLOCK') document.documentElement.classList.add('theme-multi-color-block');
    else if (theme === 'PAPER_MINT') document.documentElement.classList.add('theme-paper-mint');
    else if (theme === 'AMBER_LEDGER') document.documentElement.classList.add('theme-amber-ledger');
    else if (theme === 'OCEAN_INK') document.documentElement.classList.add('theme-ocean-ink');
    else if (theme === 'MIDNIGHT_PLUM') document.documentElement.classList.add('theme-midnight-plum');
};

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: null,
    isAuthenticated: false,
    isInitialized: false,

    login: (user, token) => {
        localStorage.setItem('ngocky_token', token);
        localStorage.setItem('ngocky_user', JSON.stringify(user));
        set({ user, token, isAuthenticated: true, isInitialized: true });
        applyTheme(user.theme);
    },

    logout: async () => {
        try {
            // Re-import api to avoid circular dependency
            const { default: api } = await import('../api/client');
            await api.post('/auth/logout');
        } catch (err) {
            console.error('Logout error:', err);
        }
        localStorage.removeItem('ngocky_token');
        localStorage.removeItem('ngocky_user');
        document.documentElement.className = '';
        set({ user: null, token: null, isAuthenticated: false, isInitialized: true });
    },

    setUser: (user) => {
        localStorage.setItem('ngocky_user', JSON.stringify(user));
        set({ user });
        applyTheme(user.theme);
    },

    initialize: () => {
        const token = localStorage.getItem('ngocky_token');
        const userStr = localStorage.getItem('ngocky_user');
        if (token && userStr) {
            try {
                const user = JSON.parse(userStr);
                set({ user, token, isAuthenticated: true, isInitialized: true });
                applyTheme(user.theme);
                return;
            } catch {
                localStorage.removeItem('ngocky_token');
                localStorage.removeItem('ngocky_user');
            }
        }
        set({ user: null, token: null, isAuthenticated: false, isInitialized: true });
    },

    refreshUser: async () => {
        const token = localStorage.getItem('ngocky_token');
        if (!token) return;
        try {
            const { default: api } = await import('../api/client');
            const res = await api.get('/auth/me');
            const fresh = res.data.data;
            if (!fresh) return;
            localStorage.setItem('ngocky_user', JSON.stringify(fresh));
            set({ user: fresh });
            applyTheme(fresh.theme);
        } catch {
            // silently ignore — stale localStorage data will be used
        }
    },
}));
