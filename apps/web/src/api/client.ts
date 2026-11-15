import axios from 'axios';

const AUTH_BYPASS_PATHS = ['/auth/login', '/auth/verify-mfa', '/auth/refresh', '/auth/logout'];

export function getApiBaseUrl() {
    if (typeof window !== 'undefined') {
        return window.localStorage?.getItem('ngocky_api_url')?.trim() || import.meta.env.VITE_API_URL || '/api';
    }
    return import.meta.env.VITE_API_URL || '/api';
}

const api = axios.create({
    baseURL: getApiBaseUrl(),
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true, // Enable cookies
});

// Request interceptor: add auth token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('ngocky_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// One refresh at a time: the server rotates the refresh token, so parallel
// refreshes would invalidate each other and log the user out.
let refreshInFlight: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
    if (!refreshInFlight) {
        refreshInFlight = axios
            .post(`${getApiBaseUrl()}/auth/refresh`, {}, { withCredentials: true })
            .then((res) => {
                const { accessToken } = res.data.data;
                localStorage.setItem('ngocky_token', accessToken);
                return accessToken as string;
            })
            .finally(() => {
                refreshInFlight = null;
            });
    }
    return refreshInFlight;
}

// Response interceptor: handle 401 and refresh token
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config;
        const requestUrl = String(original?.url || '');
        const shouldBypassRefresh = AUTH_BYPASS_PATHS.some((path) => requestUrl.includes(path));

        if (error.response?.status === 401 && original && !original._retry && !shouldBypassRefresh && localStorage.getItem('ngocky_token')) {
            original._retry = true;
            let accessToken: string;
            try {
                // refreshToken is in an HTTP-only cookie
                accessToken = await refreshAccessToken();
            } catch {
                localStorage.removeItem('ngocky_token');
                localStorage.removeItem('ngocky_user');
                window.location.href = '/login';
                return Promise.reject(error);
            }
            original.headers.Authorization = `Bearer ${accessToken}`;
            return api(original);
        }
        return Promise.reject(error);
    }
);

export default api;
