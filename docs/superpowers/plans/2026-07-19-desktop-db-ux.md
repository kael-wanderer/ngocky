# Desktop DB Connection UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Friendlier desktop DB setup — split-field Postgres form with "Test connection", explicit SQLite-vs-Postgres choice for offline mode, storage info + data reset in Settings, and per-template page selection in the setup wizard.

**Architecture:** Desktop app (Tauri v2) bundles the API as a Node SEA sidecar (`ngocky-api`). Onboarding (`DesktopOnboardingPage.tsx`) writes `desktop-config.json` via Tauri commands in `apps/desktop/src-tauri/src/lib.rs`; the sidecar then serves the web app locally, and the web `SetupPage.tsx` (shown when `GET /api/setup/status` says `needsSetup`) creates the owner + app settings. "Test connection" reuses the sidecar itself in a check-only mode (same connection semantics as runtime, zero new dependencies). Page visibility already exists as `builtInPages` overrides on the `AppSetting` row (id=1) — the wizard just writes `{ visible: false }` entries.

**Tech Stack:** Tauri v2 (Rust), tauri-plugin-shell sidecar, React 19 + Tailwind, Express + Prisma 6 (postgres + separate SQLite desktop client), Zod, vitest.

## Global Constraints

- No new dependencies (Rust crates, npm packages) — everything reuses what is installed.
- API env validation (`apps/api/src/config/env.ts`) requires `JWT_SECRET`/`JWT_REFRESH_SECRET` with **min length 16** — any dummy values passed for check-only runs must be ≥16 chars.
- Web app has no test infra; web tasks are verified with `npm run lint` (tsc) from repo root.
- Rust changes verified with `cargo check` in `apps/desktop/src-tauri` (full desktop bundle build is a separate manual step; see `docs/` test plan).
- API tests: `cd apps/api && npx vitest run src/test/<file>` — sequential, real (SQLite test) DB.
- Existing UI copy style: sentence case, short helper text under inputs. Tailwind only, `lucide-react` icons.
- `window.confirm` is a no-op inside Tauri — destructive buttons use a two-click "armed" pattern (button text changes to "Click again to confirm", disarms after 5s).
- All desktop-config commands live in `apps/desktop/src-tauri/src/lib.rs`; register every new command in the `tauri::generate_handler![...]` list.

---

### Task 1: Sidecar DB-check mode

**Files:**
- Modify: `apps/api/src/index.ts`

**Interfaces:**
- Consumes: existing `prisma` singleton (`src/config/database.ts`).
- Produces: process contract used by Task 2 — when env `DB_CHECK_ONLY=true`, the process connects, runs `SELECT 1`, prints `DB_CHECK_OK` to stdout, exits 0. On failure it exits non-zero with the error on stderr (existing `main().catch` handler). It never starts the HTTP server, never runs migrations (Task 2 does not set `MIGRATIONS_DIR`), never seeds.

- [ ] **Step 1: Add the check branch**

In `apps/api/src/index.ts`, insert after the `✅ Database connected` log and **before** the `MIGRATIONS_DIR` block:

```ts
    // Desktop onboarding "Test connection": probe and exit, no server.
    if (process.env.DB_CHECK_ONLY === 'true') {
        await prisma.$queryRawUnsafe('SELECT 1');
        console.log('DB_CHECK_OK');
        process.exit(0);
    }
```

`$queryRawUnsafe('SELECT 1')` is valid on both postgres and sqlite clients.

- [ ] **Step 2: Verify success path manually**

Run (uses the sqlite test db so no postgres needed):

```bash
cd apps/api && DB_CHECK_ONLY=true DATABASE_URL="file:./prisma/test.db" NODE_ENV=test \
  JWT_SECRET=check-only-secret-0000 JWT_REFRESH_SECRET=check-only-secret-0000 \
  npx tsx src/index.ts; echo "exit=$?"
```

Expected: output contains `DB_CHECK_OK`, `exit=0`.

- [ ] **Step 3: Verify failure path manually**

```bash
cd apps/api && DB_CHECK_ONLY=true DB_PROVIDER=postgres \
  DATABASE_URL="postgresql://nobody:wrong@127.0.0.1:59999/nope" \
  JWT_SECRET=check-only-secret-0000 JWT_REFRESH_SECRET=check-only-secret-0000 \
  npx tsx src/index.ts; echo "exit=$?"
```

Expected: `❌ Failed to start:` on stderr, `exit=1`. (Connection error, not a Zod env error — if you see a Zod error, the dummy secrets are too short.)

- [ ] **Step 4: Run API test suite to confirm no regression**

Run: `cd apps/api && npm test`
Expected: all tests pass (the branch is inert without `DB_CHECK_ONLY`).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "feat: sidecar DB_CHECK_ONLY probe mode for desktop test-connection"
```

---

### Task 2: Tauri `test_db_connection` command

**Files:**
- Modify: `apps/desktop/src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: Task 1's `DB_CHECK_ONLY` process contract; bundled sidecar `ngocky-api`; bundled `prisma/query-engine.node` resource (same path `spawn_sidecar` uses).
- Produces: Tauri command `test_db_connection(databaseUrl: string) -> Result<(), String>` — `Ok` on reachable DB, `Err(message)` otherwise. Frontend (Tasks 4/5) calls `invoke('test_db_connection', { databaseUrl })`.

- [ ] **Step 1: Add the command**

Add to `apps/desktop/src-tauri/src/lib.rs` (after `clear_desktop_config`):

```rust
// Spawn the sidecar in check-only mode (Task 1 contract): it connects,
// prints DB_CHECK_OK, and exits. Same driver + TLS behavior as real runtime.
#[tauri::command]
async fn test_db_connection(app: tauri::AppHandle, database_url: String) -> Result<(), String> {
    let resources = app.path().resource_dir().map_err(|e| e.to_string())?;
    let envs: Vec<(String, String)> = vec![
        ("NODE_ENV".into(), "production".into()),
        ("DB_CHECK_ONLY".into(), "true".into()),
        ("DATABASE_URL".into(), database_url),
        ("DB_PROVIDER".into(), "postgres".into()),
        // env.ts requires >=16 chars; values are never used in check mode.
        ("JWT_SECRET".into(), "check-only-secret-0000".into()),
        ("JWT_REFRESH_SECRET".into(), "check-only-secret-0000".into()),
        ("PRISMA_QUERY_ENGINE_LIBRARY".into(), resources.join("prisma").join("query-engine.node").display().to_string()),
    ];
    let output = app
        .shell()
        .sidecar("ngocky-api")
        .map_err(|e| e.to_string())?
        .envs(envs)
        .output()
        .await
        .map_err(|e| e.to_string())?;
    if output.status.success() && String::from_utf8_lossy(&output.stdout).contains("DB_CHECK_OK") {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(stderr
            .lines()
            .rev()
            .find(|l| !l.trim().is_empty())
            .unwrap_or("Connection failed")
            .to_string())
    }
}
```

- [ ] **Step 2: Register the command**

Change the handler list:

```rust
        .invoke_handler(tauri::generate_handler![get_desktop_config, set_desktop_config, clear_desktop_config, test_db_connection])
```

- [ ] **Step 3: Compile check**

Run: `cd apps/desktop/src-tauri && cargo check`
Expected: no errors. (If `.output()` is missing on the sidecar command builder, confirm `tauri-plugin-shell` is the v2 plugin — it exposes `output()` returning `Output { status, stdout, stderr }`.)

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/src/lib.rs
git commit -m "feat: test_db_connection Tauri command via sidecar check mode"
```

---

### Task 3: Provider chosen by database_url presence (offline-postgres support)

**Files:**
- Modify: `apps/desktop/src-tauri/src/lib.rs` (function `spawn_sidecar`)

**Interfaces:**
- Consumes: `DesktopConfig { mode, database_url, .. }`.
- Produces: rule relied on by Tasks 5/6/7 — **any** non-empty `database_url` in config means postgres; empty/absent + mode `offline` means bundled SQLite. Shared mode always stores a `database_url`, so its behavior is unchanged.

- [ ] **Step 1: Change the provider selection in `spawn_sidecar`**

Replace:

```rust
    let (db_url, provider) = if mode == "offline" {
        (format!("file:{}", data_dir.join("ngocky.db").display()), "sqlite")
    } else {
        (cfg.database_url.clone().unwrap_or_default(), "postgres")
    };
```

with:

```rust
    // Offline mode may bring its own postgres (config stores a database_url);
    // only an empty url falls back to the bundled SQLite file.
    let configured_url = cfg.database_url.clone().unwrap_or_default();
    let (db_url, provider) = if configured_url.is_empty() {
        (format!("file:{}", data_dir.join("ngocky.db").display()), "sqlite")
    } else {
        (configured_url, "postgres")
    };
```

Note: `mode` is still used later in `spawn_sidecar`'s caller; do not remove the `let mode = ...` line if other references remain — check compiler output.

- [ ] **Step 2: Compile check**

Run: `cd apps/desktop/src-tauri && cargo check`
Expected: no errors (remove the now-unused `mode` binding inside `spawn_sidecar` if the compiler warns and nothing else uses it).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/lib.rs
git commit -m "feat: sidecar provider follows database_url presence (offline postgres)"
```

---

### Task 4: Split-field DB form with Test connection (onboarding)

**Files:**
- Modify: `apps/web/src/pages/DesktopOnboardingPage.tsx`

**Interfaces:**
- Consumes: `invoke('test_db_connection', { databaseUrl })` from Task 2.
- Produces: local component `DbConnectionForm` and helper `buildDbUrl` reused by Task 5 (same file). `DbFields` type: `{ host: string; port: string; database: string; user: string; password: string }`.

- [ ] **Step 1: Replace the single connection-string input with the split form**

In `DesktopOnboardingPage.tsx`, add above the default export:

```tsx
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
```

- [ ] **Step 2: Wire it into the shared-mode branch**

In the default export, replace state `const [databaseUrl, setDatabaseUrl] = useState('');` with:

```tsx
    const [db, setDb] = useState<DbFields>(emptyDb);
    const [advanced, setAdvanced] = useState(false);
    const [rawUrl, setRawUrl] = useState('');
```

Replace the `{mode === 'shared' && (...)}` block with:

```tsx
                {mode === 'shared' && (
                    <div className="space-y-2">
                        <div className="text-sm font-medium">Family Postgres database</div>
                        <p className="text-xs text-gray-500">Any database name works — it just has to exist on the server. Tables are created automatically on first start.</p>
                        <DbConnectionForm db={db} setDb={setDb} advanced={advanced} setAdvanced={setAdvanced} rawUrl={rawUrl} setRawUrl={setRawUrl} />
                    </div>
                )}
```

In `save()`, replace the validation + `databaseUrl` usage:

```tsx
            const effectiveDbUrl = advanced ? rawUrl.trim() : buildDbUrl(db);
            if (mode === 'shared') {
                if (advanced && !/^postgres(ql)?:\/\//.test(effectiveDbUrl)) {
                    throw new Error('Connection string must start with postgresql://');
                }
                if (!advanced && (!db.host.trim() || !db.database.trim() || !db.user.trim())) {
                    throw new Error('Host, database, and user are required');
                }
            }
```

and in the `invoke('set_desktop_config', ...)` payload use:

```tsx
                    databaseUrl: mode === 'shared' ? effectiveDbUrl : null,
```

(Task 5 extends this same expression for offline-postgres.)

- [ ] **Step 3: Lint**

Run: `npm run lint` (repo root)
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/DesktopOnboardingPage.tsx
git commit -m "feat: split-field DB form with test connection in desktop onboarding"
```

---

### Task 5: Offline engine choice (SQLite vs PostgreSQL)

**Files:**
- Modify: `apps/web/src/pages/DesktopOnboardingPage.tsx`

**Interfaces:**
- Consumes: `DbConnectionForm`, `buildDbUrl`, `emptyDb` from Task 4; provider rule from Task 3 (non-empty `databaseUrl` ⇒ postgres).
- Produces: config writes — offline+SQLite stores `databaseUrl: null`; offline+postgres stores the assembled URL.

- [ ] **Step 1: Add engine state and cards**

Add state in the default export:

```tsx
    const [offlineEngine, setOfflineEngine] = useState<'sqlite' | 'postgres'>('sqlite');
```

Add after the `{mode === 'thin' && (...)}` block:

```tsx
                {mode === 'offline' && (
                    <div className="space-y-3">
                        <div className="text-sm font-medium">Where should offline data live?</div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <button
                                onClick={() => setOfflineEngine('sqlite')}
                                className={`rounded-lg border p-4 text-left ${offlineEngine === 'sqlite' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}`}
                            >
                                <div className="font-medium">Built-in (SQLite) — recommended</div>
                                <div className="mt-1 text-sm text-gray-500">A single file on this Mac. Zero setup. Reset anytime from Settings.</div>
                            </button>
                            <button
                                onClick={() => setOfflineEngine('postgres')}
                                className={`rounded-lg border p-4 text-left ${offlineEngine === 'postgres' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}`}
                            >
                                <div className="font-medium">PostgreSQL</div>
                                <div className="mt-1 text-sm text-gray-500">
                                    Use a Postgres server you run yourself. Don't have one?{' '}
                                    <a className="text-blue-600 underline" href="https://www.postgresql.org/download/macosx/" target="_blank" rel="noreferrer">Install PostgreSQL for macOS</a>.
                                </div>
                            </button>
                        </div>
                        {offlineEngine === 'postgres' && (
                            <DbConnectionForm db={db} setDb={setDb} advanced={advanced} setAdvanced={setAdvanced} rawUrl={rawUrl} setRawUrl={setRawUrl} />
                        )}
                    </div>
                )}
```

When mode `offline` is picked and `offlineEngine === 'postgres'`, default the host: initialize by changing the `setMode` click handler on mode cards:

```tsx
                            onClick={() => {
                                setMode(m.id);
                                if (m.id === 'offline' && !db.host) setDb({ ...db, host: '127.0.0.1' });
                            }}
```

- [ ] **Step 2: Extend save() for offline-postgres**

Update the validation and payload from Task 4:

```tsx
            const usesPostgres = mode === 'shared' || (mode === 'offline' && offlineEngine === 'postgres');
            const effectiveDbUrl = advanced ? rawUrl.trim() : buildDbUrl(db);
            if (usesPostgres) {
                if (advanced && !/^postgres(ql)?:\/\//.test(effectiveDbUrl)) {
                    throw new Error('Connection string must start with postgresql://');
                }
                if (!advanced && (!db.host.trim() || !db.database.trim() || !db.user.trim())) {
                    throw new Error('Host, database, and user are required');
                }
            }
```

payload:

```tsx
                    databaseUrl: usesPostgres ? effectiveDbUrl : null,
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/DesktopOnboardingPage.tsx
git commit -m "feat: offline mode engine choice (built-in SQLite or own Postgres)"
```

---

### Task 6: `get_storage_info` and `reset_offline_data` Tauri commands

**Files:**
- Modify: `apps/desktop/src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: `DesktopConfig`, `SidecarChild` state, provider rule from Task 3.
- Produces:
  - `get_storage_info() -> StorageInfo` where `StorageInfo = { mode: string, engine: 'SQLite' | 'PostgreSQL' | 'Server', location: string }` (camelCase over the wire; postgres location is credential-stripped).
  - `reset_offline_data() -> Result<(), String>` — kills the sidecar, deletes `ngocky.db` + `-wal`/`-shm`. Frontend relaunches afterwards.

- [ ] **Step 1: Add both commands**

```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StorageInfo {
    mode: String,
    engine: String,
    location: String,
}

#[tauri::command]
fn get_storage_info(app: tauri::AppHandle) -> StorageInfo {
    let cfg = load_config(&app);
    let mode = cfg.mode.clone().unwrap_or_default();
    match cfg.database_url.as_deref() {
        Some(url) if !url.is_empty() => {
            // Strip credentials: keep everything after the last '@'.
            let location = match url.rfind('@') {
                Some(at) => format!("postgresql://{}", &url[at + 1..]),
                None => url.to_string(),
            };
            StorageInfo { mode, engine: "PostgreSQL".into(), location }
        }
        _ if mode == "offline" => {
            let data_dir = app.path().app_data_dir().expect("no app data dir");
            StorageInfo { mode, engine: "SQLite".into(), location: data_dir.join("ngocky.db").display().to_string() }
        }
        _ => StorageInfo { mode, engine: "Server".into(), location: String::new() },
    }
}

// Wipe the offline SQLite database. Kills the sidecar first so the file
// isn't recreated mid-delete; caller relaunches the app afterwards.
#[tauri::command]
fn reset_offline_data(app: tauri::AppHandle, state: tauri::State<SidecarChild>) -> Result<(), String> {
    if let Some(child) = state.0.lock().unwrap().take() {
        child.kill().ok();
    }
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    for suffix in ["", "-wal", "-shm"] {
        let path = data_dir.join(format!("ngocky.db{suffix}"));
        match fs::remove_file(&path) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e.to_string()),
        }
    }
    Ok(())
}
```

- [ ] **Step 2: Register both**

```rust
        .invoke_handler(tauri::generate_handler![get_desktop_config, set_desktop_config, clear_desktop_config, test_db_connection, get_storage_info, reset_offline_data])
```

- [ ] **Step 3: Compile check**

Run: `cd apps/desktop/src-tauri && cargo check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/src/lib.rs
git commit -m "feat: storage info + offline data reset Tauri commands"
```

---

### Task 7: Settings storage panel (engine, location, reset data)

**Files:**
- Modify: `apps/web/src/pages/SettingsPage.tsx` (the `isTauri` block inside `tab === 'features'`, currently ~lines 555–578)

**Interfaces:**
- Consumes: `get_storage_info` and `reset_offline_data` from Task 6; existing `isTauri` from `../components/DesktopGate`; existing "Switch mode / reset" button stays as-is.
- Produces: user-visible storage facts (answers "what engine, what file/host, how do I reset").

- [ ] **Step 1: Load storage info**

Near the other hooks in `SettingsPage`, add:

```tsx
    const [storageInfo, setStorageInfo] = useState<{ mode: string; engine: string; location: string } | null>(null);
    const [resetArmed, setResetArmed] = useState(false);
    useEffect(() => {
        if (!isTauri) return;
        import('@tauri-apps/api/core').then(({ invoke }) =>
            invoke<{ mode: string; engine: string; location: string }>('get_storage_info').then(setStorageInfo).catch(() => {})
        );
    }, []);
```

(`useEffect` may need adding to the react import.)

- [ ] **Step 2: Render the panel**

Inside the existing `{isTauri && (...)}` card, above the "Switch mode / reset" button, add:

```tsx
                                    {storageInfo && storageInfo.engine !== 'Server' && (
                                        <div className="text-sm space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
                                            <div><span className="font-medium" style={{ color: 'var(--color-text)' }}>Engine:</span> {storageInfo.engine}</div>
                                            <div className="break-all"><span className="font-medium" style={{ color: 'var(--color-text)' }}>Location:</span> {storageInfo.location}</div>
                                        </div>
                                    )}
                                    {storageInfo?.engine === 'SQLite' && (
                                        <button
                                            className="btn-secondary"
                                            style={{ color: 'var(--color-danger, #dc2626)' }}
                                            onClick={async () => {
                                                if (!resetArmed) {
                                                    setResetArmed(true);
                                                    setTimeout(() => setResetArmed(false), 5000);
                                                    return;
                                                }
                                                const { invoke } = await import('@tauri-apps/api/core');
                                                await invoke('reset_offline_data');
                                                localStorage.removeItem('ngocky_token');
                                                localStorage.removeItem('ngocky_user');
                                                const { relaunch } = await import('@tauri-apps/plugin-process');
                                                await relaunch();
                                            }}
                                        >
                                            {resetArmed ? 'Click again to erase all data' : 'Reset data (erase everything)'}
                                        </button>
                                    )}
```

`window.confirm` is a no-op in Tauri — the two-click armed pattern above is the established workaround.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/SettingsPage.tsx
git commit -m "feat: settings storage panel with engine info and offline data reset"
```

---

### Task 8: Setup API accepts hidden pages

**Files:**
- Modify: `apps/api/src/validators/setup.ts`
- Modify: `apps/api/src/routes/setup.ts`
- Test: `apps/api/src/test/setup-wizard.test.ts`

**Interfaces:**
- Consumes: existing `builtInPages` override convention (`apps/api/src/config/pageTemplates.ts` — `{ [moduleType]: { visible?: boolean } }` on `AppSetting` id=1; `applyBuiltInPageOverrides` treats `visible !== false` as visible).
- Produces: `POST /api/setup` body gains optional `hiddenPages: PageModuleType[]`. Task 9 sends it.

- [ ] **Step 1: Write the failing test**

Append to the `describe('setup wizard', ...)` block in `apps/api/src/test/setup-wizard.test.ts`:

```ts
    it('hides deselected page templates via builtInPages overrides', async () => {
        const res = await request(app).post('/api/setup').send({
            appName: 'FamilyHub',
            enabledGroups: ['personal', 'hobby'],
            hiddenPages: ['FUND', 'KEYBOARD'],
            owner: { email: 'boss2@example.com', password: 'Secret123!', name: 'Boss' },
        });
        expect(res.status).toBe(201);

        const { prisma } = await import('../config/database');
        const settings = await prisma.appSetting.findUnique({ where: { id: 1 } });
        expect(settings?.builtInPages).toMatchObject({
            FUND: { visible: false },
            KEYBOARD: { visible: false },
        });
    });
```

Note: tests share one DB and run sequentially — the earlier test in this file already completes setup, so this test will hit the 403 lock **unless it runs in a fresh describe/file state**. Check how this test file resets state (see `src/test/` setup helpers used by sibling tests, e.g. a `beforeEach` truncation). If the suite truncates between tests, the code above works as-is; if not, move this `it` into its own `describe` with the same reset the first test relies on. Mirror whatever the existing file does — do not invent a new reset mechanism.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/test/setup-wizard.test.ts`
Expected: new test FAILS — `hiddenPages` is stripped/rejected by the current schema, `builtInPages` stays empty.

- [ ] **Step 3: Extend the validator**

`apps/api/src/validators/setup.ts`:

```ts
import { z } from 'zod';

const PAGE_TYPES = [
    'TASK', 'PROJECT', 'EXPENSE', 'GOAL', 'IDEA', 'CALENDAR', 'CAKEO',
    'HOUSEWORK', 'ASSET', 'HEALTHBOOK', 'KEYBOARD', 'FOODPLACE', 'FUND', 'LEARNING',
] as const;

export const setupSchema = z.object({
    appName: z.string().trim().min(1).max(60),
    enabledGroups: z.array(z.enum(['personal', 'family', 'hobby'])),
    hiddenPages: z.array(z.enum(PAGE_TYPES)).optional(),
    owner: z.object({
        email: z.string().email(),
        password: z.string().min(8).max(128),
        name: z.string().trim().min(1).max(80),
    }),
});
```

- [ ] **Step 4: Write the overrides in the route**

`apps/api/src/routes/setup.ts` — in the POST handler, change the destructure and add after `AppSettingsService.update(...)`:

```ts
        const { appName, enabledGroups, owner, hiddenPages } = req.body;
```

```ts
        if (Array.isArray(hiddenPages) && hiddenPages.length > 0) {
            await prisma.appSetting.update({
                where: { id: 1 },
                data: { builtInPages: Object.fromEntries(hiddenPages.map((type: string) => [type, { visible: false }])) },
            });
        }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/test/setup-wizard.test.ts`
Expected: PASS (all tests in file).

- [ ] **Step 6: Full API suite**

Run: `cd apps/api && npm test`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/validators/setup.ts apps/api/src/routes/setup.ts apps/api/src/test/setup-wizard.test.ts
git commit -m "feat: setup wizard accepts hiddenPages to pre-hide page templates"
```

---

### Task 9: Template checkboxes in web SetupPage

**Files:**
- Modify: `apps/web/src/pages/SetupPage.tsx`

**Interfaces:**
- Consumes: `POST /api/setup` with `hiddenPages` (Task 8). Template list mirrors `apps/api/src/config/pageTemplates.ts` `PAGE_TEMPLATES` (client-side copy — this codebase intentionally duplicates types across apps; no shared package).
- Produces: wizard UI — per enabled group, checkboxes for that group's templates, all checked by default; unchecked ones are sent as `hiddenPages`.

- [ ] **Step 1: Add the template constant and state**

In `SetupPage.tsx`, above the component:

```tsx
// Mirrors apps/api/src/config/pageTemplates.ts PAGE_TEMPLATES (no shared package).
const PAGE_TEMPLATES: { type: string; label: string; group: ModuleGroupId }[] = [
    { type: 'TASK', label: 'Tasks', group: 'personal' },
    { type: 'PROJECT', label: 'Projects', group: 'personal' },
    { type: 'EXPENSE', label: 'Expenses', group: 'personal' },
    { type: 'GOAL', label: 'Goals', group: 'personal' },
    { type: 'IDEA', label: 'Ideas', group: 'personal' },
    { type: 'CALENDAR', label: 'Calendar', group: 'family' },
    { type: 'CAKEO', label: 'Ca Keo (Child)', group: 'family' },
    { type: 'HOUSEWORK', label: 'Housework', group: 'family' },
    { type: 'ASSET', label: 'Assets', group: 'family' },
    { type: 'HEALTHBOOK', label: 'Healthbook', group: 'family' },
    { type: 'FOODPLACE', label: 'Food Menu', group: 'family' },
    { type: 'KEYBOARD', label: 'Keyboard', group: 'hobby' },
    { type: 'FUND', label: 'Funds', group: 'hobby' },
    { type: 'LEARNING', label: 'Learning', group: 'hobby' },
];
```

Inside the component add:

```tsx
    const [hiddenPages, setHiddenPages] = useState<string[]>([]);

    const togglePage = (type: string, checked: boolean) => {
        setHiddenPages((current) => checked ? current.filter((t) => t !== type) : [...new Set([...current, type])]);
    };
```

- [ ] **Step 2: Render checkboxes under each enabled group**

In the Module Groups section, inside the existing `.map((group) => (...))`, extend the rendered block so each group row is followed by its templates when the group is enabled. Replace the current `<label key={group.id} ...>...</label>` with:

```tsx
                        <div key={group.id} className="rounded-lg border px-4 py-3 space-y-2" style={{ borderColor: 'var(--color-border)' }}>
                            <label className="flex items-center justify-between">
                                <span className="font-medium" style={{ color: 'var(--color-text)' }}>{group.label}</span>
                                <input
                                    type="checkbox"
                                    checked={groups.includes(group.id)}
                                    disabled={group.disabled}
                                    onChange={(event) => toggleGroup(group.id, event.target.checked)}
                                />
                            </label>
                            {groups.includes(group.id) && (
                                <div className="grid gap-1 md:grid-cols-2 pl-1">
                                    {PAGE_TEMPLATES.filter((t) => t.group === group.id).map((t) => (
                                        <label key={t.type} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                            <input
                                                type="checkbox"
                                                checked={!hiddenPages.includes(t.type)}
                                                onChange={(event) => togglePage(t.type, event.target.checked)}
                                            />
                                            {t.label}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
```

- [ ] **Step 3: Send hiddenPages on submit**

In `handleSubmit`, extend the POST body (only pages from enabled groups matter; disabled groups are already hidden by `enabledGroups`):

```tsx
            const enabledTypes = PAGE_TEMPLATES.filter((t) => groups.includes(t.group)).map((t) => t.type);
            await api.post('/setup', {
                appName,
                enabledGroups: groups,
                hiddenPages: hiddenPages.filter((t) => enabledTypes.includes(t)),
                owner: { name: owner.name, email: owner.email, password: owner.password },
            });
```

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/SetupPage.tsx
git commit -m "feat: per-template page checkboxes in setup wizard"
```

---

### Task 10: Manual end-to-end verification (desktop bundle)

**Files:** none (verification only). Reference: `docs/` manual test plan for desktop offline modes.

- [ ] **Step 1: Rebuild the desktop bundle** (web changes require a desktop rebuild — sidecar + frontend are bundled):

Follow the existing build steps (`apps/api/scripts/build-sidecar.mjs`, `apps/api/scripts/package-sidecar.sh`, then Tauri build). Use the same commands as the last desktop release (see `docs/` test plan / recent commits `7258724`, `f0903f9`).

- [ ] **Step 2: Walk the matrix**

1. Shared mode: fill split form with a bad host → Test connection shows ✗ with a real error; fix it → ✓ Connected; Continue → app boots, SetupPage shows; uncheck two templates → after login they're hidden (Settings → pages shows them `visible: false`).
2. Offline + SQLite: pick built-in card → Continue → SetupPage → Settings shows Engine SQLite + file path; Reset data (two clicks) → app relaunches into fresh SetupPage.
3. Offline + PostgreSQL: pick postgres card (host prefilled 127.0.0.1) → Test → Continue → boots against local postgres; Settings shows Engine PostgreSQL + credential-stripped location.
4. Thin mode: unchanged — no DB form, storage panel shows nothing extra.

- [ ] **Step 3: Commit any doc updates**

```bash
git add docs/
git commit -m "docs: desktop DB UX test notes"
```

---

## Explicitly out of scope (agreed adjustments)

- **No dedicated `?schema=` field** — Advanced raw-string mode covers it; add a field when a real multi-family-on-one-server user appears.
- **No postgres "reset data" button** — Settings shows engine + location so postgres users know what to target with their own tools.
- **No in-wizard page name/template editor** — checkboxes only; rename/add later in the existing pages UI.
- **No per-feature migration sets** — full schema always deploys (existing behavior, keep).
