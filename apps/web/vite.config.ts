import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode, command }) => {
    // Load env ONLY from apps/web/ directory — NOT from monorepo root
    // This prevents root .env VITE_API_URL from leaking into the app
    const env = loadEnv(mode, __dirname, '');
    const proxyTarget = env.PROXY_TARGET || 'http://localhost:3001';
    console.log(`[vite] proxy /api -> ${proxyTarget}`);

    return {
        plugins: [react()],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
        server: {
            port: 5173,
            proxy: {
                '/api': {
                    target: proxyTarget,
                    changeOrigin: true,
                    secure: false,             // Allow self-signed / HTTPS targets
                    cookieDomainRewrite: 'localhost', // Rewrite cookie domain for local browser
                },
            },
        },
        // Dev server: force relative /api so the Vite proxy handles it.
        // Builds (web + desktop) honor VITE_API_URL from env/.env instead.
        define: command === 'serve'
            ? { 'import.meta.env.VITE_API_URL': JSON.stringify('') }
            : {},
    };
});
