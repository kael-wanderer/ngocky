import { useState } from 'react';

function randomSecret() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const MODES = [
    { id: 'thin', title: 'Family server', desc: 'Connect to the NgocKy server. Data lives on the server; alerts always delivered.' },
    { id: 'offline', title: 'Offline (just me)', desc: 'Everything stored on this computer. No account on any server, no sync.' },
    { id: 'shared', title: 'Shared database', desc: 'Run locally but share a family Postgres database (LAN or Supabase).' },
] as const;

export default function DesktopOnboardingPage() {
    const [mode, setMode] = useState<string | null>(null);
    const [serverUrl, setServerUrl] = useState('https://api.ngocky.kael.io.vn/api');
    const [databaseUrl, setDatabaseUrl] = useState('');
    const [telegramBotToken, setTelegramBotToken] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    async function save() {
        setSaving(true);
        setError('');
        try {
            if (mode === 'shared' && !/^postgres(ql)?:\/\//.test(databaseUrl.trim())) {
                throw new Error('Connection string must start with postgresql://');
            }
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('set_desktop_config', {
                config: {
                    mode,
                    databaseUrl: mode === 'shared' ? databaseUrl.trim() : null,
                    telegramBotToken: telegramBotToken.trim() || null,
                    jwtSecret: randomSecret(),
                    jwtRefreshSecret: randomSecret(),
                },
            });
            if (mode === 'thin') window.localStorage.setItem('ngocky_api_url', serverUrl.trim());
            else window.localStorage.setItem('ngocky_api_url', 'http://127.0.0.1:21473/api');
            const { relaunch } = await import('@tauri-apps/plugin-process');
            await relaunch();
        } catch (e: any) {
            setError(e?.message || String(e));
            setSaving(false);
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
            <div className="w-full max-w-2xl space-y-6">
                <h1 className="text-2xl font-semibold">Welcome to NgocKy</h1>
                <p className="text-gray-500">How do you want to store your data?</p>
                <div className="grid gap-4 md:grid-cols-3">
                    {MODES.map((m) => (
                        <button
                            key={m.id}
                            onClick={() => setMode(m.id)}
                            className={`rounded-lg border p-4 text-left ${mode === m.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}`}
                        >
                            <div className="font-medium">{m.title}</div>
                            <div className="mt-1 text-sm text-gray-500">{m.desc}</div>
                        </button>
                    ))}
                </div>
                {mode === 'thin' && (
                    <label className="block text-sm">
                        Server API URL
                        <input className="mt-1 w-full rounded border p-2" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
                    </label>
                )}
                {mode === 'shared' && (
                    <label className="block text-sm">
                        Postgres connection string
                        <input
                            className="mt-1 w-full rounded border p-2"
                            placeholder="postgresql://user:pass@host:5432/ngocky (Supabase: use pooler port 6543 and append ?pgbouncer=true)"
                            value={databaseUrl}
                            onChange={(e) => setDatabaseUrl(e.target.value)}
                        />
                    </label>
                )}
                {(mode === 'offline' || mode === 'shared') && (
                    <label className="block text-sm">
                        Telegram bot token (optional, for reminder delivery)
                        <input className="mt-1 w-full rounded border p-2" value={telegramBotToken} onChange={(e) => setTelegramBotToken(e.target.value)} />
                    </label>
                )}
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                    disabled={!mode || saving}
                    onClick={save}
                    className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
                >
                    {saving ? 'Restarting…' : 'Continue'}
                </button>
            </div>
        </div>
    );
}
