import { useEffect, useState } from 'react';
import DesktopOnboardingPage from '../pages/DesktopOnboardingPage';

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

type GateState = 'checking' | 'onboarding' | 'waiting-api' | 'ready';

export default function DesktopGate({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<GateState>(isTauri ? 'checking' : 'ready');

    useEffect(() => {
        if (!isTauri) return;
        (async () => {
            try {
                const { invoke } = await import('@tauri-apps/api/core');
                const cfg = await invoke<{ mode?: string }>('get_desktop_config');
                if (!cfg?.mode) return setState('onboarding');
                if (cfg.mode === 'thin') return setState('ready');
                // offline/shared: wait for sidecar health before rendering the app
                setState('waiting-api');
                for (let i = 0; i < 60; i++) {
                    try {
                        const res = await fetch('http://127.0.0.1:21473/api/health');
                        if (res.ok) return setState('ready');
                    } catch { /* not up yet */ }
                    await new Promise((r) => setTimeout(r, 500));
                }
                setState('ready'); // give up waiting; app will surface API errors
            } catch {
                setState('ready');
            }
        })();
    }, []);

    if (state === 'checking') return null;
    if (state === 'onboarding') return <DesktopOnboardingPage />;
    if (state === 'waiting-api') return (
        <div className="flex h-screen items-center justify-center text-gray-500">Starting local server…</div>
    );
    return <>{children}</>;
}
