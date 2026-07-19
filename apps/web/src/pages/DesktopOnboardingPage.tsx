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

type DbFields = { host: string; port: string; database: string; user: string; password: string };

const emptyDb: DbFields = { host: '', port: '5432', database: 'ngocky', user: '', password: '' };

function buildDbUrl(db: DbFields) {
    return `postgresql://${encodeURIComponent(db.user)}:${encodeURIComponent(db.password)}@${db.host.trim()}:${db.port.trim()}/${db.database.trim()}`;
}

function DbConnectionForm({ db, setDb, advanced, setAdvanced, rawUrl, setRawUrl }: {
    db: DbFields;
    setDb: (db: DbFields) => void;
    advanced: boolean;
    setAdvanced: (v: boolean) => void;
    rawUrl: string;
    setRawUrl: (v: string) => void;
}) {
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
    const effectiveUrl = advanced ? rawUrl.trim() : buildDbUrl(db);

    async function testConnection() {
        setTesting(true);
        setTestResult(null);
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('test_db_connection', { databaseUrl: effectiveUrl });
            setTestResult({ ok: true, message: 'Connected' });
        } catch (e: any) {
            setTestResult({ ok: false, message: e?.message || String(e) });
        }
        setTesting(false);
    }

    return (
        <div className="space-y-3">
            {!advanced ? (
                <div className="grid gap-3 md:grid-cols-2">
                    <label className="block text-sm">
                        Host
                        <input className="mt-1 w-full rounded border p-2" placeholder="192.168.1.10 or db.abc.supabase.co" value={db.host} onChange={(e) => setDb({ ...db, host: e.target.value })} />
                    </label>
                    <label className="block text-sm">
                        Port
                        <input className="mt-1 w-full rounded border p-2" value={db.port} onChange={(e) => setDb({ ...db, port: e.target.value })} />
                    </label>
                    <label className="block text-sm">
                        Database
                        <input className="mt-1 w-full rounded border p-2" value={db.database} onChange={(e) => setDb({ ...db, database: e.target.value })} />
                    </label>
                    <label className="block text-sm">
                        User
                        <input className="mt-1 w-full rounded border p-2" value={db.user} onChange={(e) => setDb({ ...db, user: e.target.value })} />
                    </label>
                    <label className="block text-sm md:col-span-2">
                        Password
                        <input type="password" className="mt-1 w-full rounded border p-2" value={db.password} onChange={(e) => setDb({ ...db, password: e.target.value })} />
                    </label>
                </div>
            ) : (
                <label className="block text-sm">
                    Connection string
                    <input
                        className="mt-1 w-full rounded border p-2"
                        placeholder="postgresql://user:pass@host:5432/dbname (Supabase: use pooler port 6543 and append ?pgbouncer=true)"
                        value={rawUrl}
                        onChange={(e) => setRawUrl(e.target.value)}
                    />
                </label>
            )}
            <div className="flex items-center gap-3">
                <button type="button" onClick={testConnection} disabled={testing} className="rounded border px-3 py-1.5 text-sm disabled:opacity-50">
                    {testing ? 'Testing…' : 'Test connection'}
                </button>
                <button type="button" onClick={() => setAdvanced(!advanced)} className="text-sm text-blue-600 underline">
                    {advanced ? 'Use simple form' : 'Advanced: paste connection string'}
                </button>
            </div>
            {testResult && (
                <p className={`text-sm ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                    {testResult.ok ? '✓ ' : '✗ '}{testResult.message}
                </p>
            )}
        </div>
    );
}

export default function DesktopOnboardingPage() {
    const [mode, setMode] = useState<string | null>(null);
    const [serverUrl, setServerUrl] = useState('https://api.ngocky.kael.io.vn/api');
    const [db, setDb] = useState<DbFields>(emptyDb);
    const [advanced, setAdvanced] = useState(false);
    const [rawUrl, setRawUrl] = useState('');
    const [telegramBotToken, setTelegramBotToken] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    async function save() {
        setSaving(true);
        setError('');
        try {
            const effectiveDbUrl = advanced ? rawUrl.trim() : buildDbUrl(db);
            if (mode === 'shared') {
                if (advanced && !/^postgres(ql)?:\/\//.test(effectiveDbUrl)) {
                    throw new Error('Connection string must start with postgresql://');
                }
                if (!advanced && (!db.host.trim() || !db.database.trim() || !db.user.trim())) {
                    throw new Error('Host, database, and user are required');
                }
            }
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('set_desktop_config', {
                config: {
                    mode,
                    databaseUrl: mode === 'shared' ? effectiveDbUrl : null,
                    telegramBotToken: telegramBotToken.trim() || null,
                    jwtSecret: randomSecret(),
                    jwtRefreshSecret: randomSecret(),
                },
            });
            // Drop any session carried over from a previous mode/install so the
            // new backend runs its own login / first-run setup instead of riding
            // a stale token (wrong secret + empty local DB = "logged in, no data").
            window.localStorage.removeItem('ngocky_token');
            window.localStorage.removeItem('ngocky_user');
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
                    <div className="space-y-2">
                        <div className="text-sm font-medium">Family Postgres database</div>
                        <p className="text-xs text-gray-500">Any database name works — it just has to exist on the server. Tables are created automatically on first start.</p>
                        <DbConnectionForm db={db} setDb={setDb} advanced={advanced} setAdvanced={setAdvanced} rawUrl={rawUrl} setRawUrl={setRawUrl} />
                    </div>
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
