import { create } from 'zustand';

interface User {
    id: string;
    email: string;
    name: string;
    role: 'OWNER' | 'ADMIN' | 'USER';
    theme: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    login: (user: User, token: string) => void;
    logout: () => void;
    setUser: (user: User) => void;
    initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: null,
    isAuthenticated: false,

    login: (user, token) => {
        localStorage.setItem('ngocky_token', token);
        localStorage.setItem('ngocky_user', JSON.stringify(user));
        set({ user, token, isAuthenticated: true });

        // Apply theme
        document.documentElement.className = '';
        if (user.theme === 'GREY_BLACK') document.documentElement.classList.add('theme-grey-black');
        else if (user.theme === 'RED_ACCENT') document.documentElement.classList.add('theme-red-accent');
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
        set({ user: null, token: null, isAuthenticated: false });
    },

    setUser: (user) => {
        localStorage.setItem('ngocky_user', JSON.stringify(user));
        set({ user });
    },

    initialize: () => {
        const token = localStorage.getItem('ngocky_token');
        const userStr = localStorage.getItem('ngocky_user');
        if (token && userStr) {
            try {
                const user = JSON.parse(userStr);
                set({ user, token, isAuthenticated: true });
                // Apply theme
                document.documentElement.className = '';
                if (user.theme === 'GREY_BLACK') document.documentElement.classList.add('theme-grey-black');
                else if (user.theme === 'RED_ACCENT') document.documentElement.classList.add('theme-red-accent');
            } catch {
                localStorage.removeItem('ngocky_token');
                localStorage.removeItem('ngocky_user');
            }
        }
    },
}));
