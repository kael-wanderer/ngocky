import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
    baseURL: API_URL,
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

// Response interceptor: handle 401 and refresh token
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config;
        if (error.response?.status === 401 && !original._retry) {
            original._retry = true;
            try {
                // refreshToken is now in HTTP-only cookie
                const res = await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
                const { accessToken } = res.data.data;
                localStorage.setItem('ngocky_token', accessToken);
                original.headers.Authorization = `Bearer ${accessToken}`;
                return api(original);
            } catch {
                localStorage.removeItem('ngocky_token');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
