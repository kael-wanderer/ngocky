type TauriWindow = Window & { __TAURI_INTERNALS__?: unknown };

function isTauriRuntime() {
    return typeof window !== 'undefined' && Boolean((window as TauriWindow).__TAURI_INTERNALS__);
}

export async function openExternal(url: string) {
    if (isTauriRuntime()) {
        try {
            const { openUrl } = await import('@tauri-apps/plugin-opener');
            await openUrl(url);
            return;
        } catch {
            // Fall back to the browser behavior if the desktop plugin is unavailable.
        }
    }

    window.open(url, '_blank', 'noopener,noreferrer');
}
