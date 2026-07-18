# Desktop Offline Modes (2+3) + Local Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One Tauri binary supporting three modes — thin client (current), single-user offline (SQLite), thick client + shared Postgres — plus an in-sidecar scheduler replacing n8n for modes 2/3.

**Architecture:** The Express API is bundled (esbuild) and compiled to a single executable (Node SEA), spawned by Tauri as a sidecar on `127.0.0.1:21473` for modes 2/3. Prisma engines, migration SQL baselines ship as Tauri resources. A tiny migration runner replaces Prisma CLI at runtime. The existing n8n service endpoints (`/api/service/due-notifications` + `/sent`) become the local scheduler's contract — `lastNotificationSentAt` + `notificationCooldownHours` provide idempotency across concurrent mode-3 clients.

**Tech Stack:** Tauri 2 (plugins: shell, process, notification), Node 20 SEA + postject, esbuild, Prisma 6 (dual clients: Postgres + SQLite via existing `generate-test-schema.mjs` pipeline), React 19.

**Spec:** `docs/superpowers/specs/2026-07-18-desktop-offline-modes-design.md`

## Global Constraints

- Sidecar port fixed: `21473`, bind `127.0.0.1` only.
- Desktop config file: `<app_data_dir>/desktop-config.json`, shape `{ mode, databaseUrl, jwtSecret, jwtRefreshSecret, telegramBotToken }` (camelCase, all optional strings; `mode` ∈ `thin|offline|shared`).
- Web frontend API base override already exists: localStorage key `ngocky_api_url` (see `apps/web/src/api/client.ts:7`). Modes 2/3 set it to `http://127.0.0.1:21473/api`.
- Owner creation in modes 2/3: existing setup wizard (`/api/setup`, fires when `user.count === 0`). Do NOT build a new owner form.
- Email channel: deferred. Channels = OS notification (Tauri) + Telegram (`TELEGRAM_BOT_TOKEN` env, direct Bot API call).
- Tests: `cd apps/api && npm test` must stay green after every task. Tests run sequentially against SQLite test client (`apps/api/src/test/client`).
- Commit after every task. Commit messages end with `Co-Authored-By:` trailer per repo convention.
- All snippets assume repo root as cwd unless a `cd` is shown.

## Existing infrastructure to reuse (do not reinvent)

| Thing | Where |
|---|---|
| SQLite schema generator (arrays→Json, Json defaults→nullable) | `apps/api/scripts/generate-test-schema.mjs` |
| Prisma client switch (test SQLite vs Postgres) | `apps/api/src/config/database.ts` |
| Case-insensitive contains shim | `iContains` in `apps/api/src/config/database.ts` |
| Due-notification feed + cooldown | `apps/api/src/routes/service.ts:552` (`due-notifications`), `:895` (`/sent`), `apps/api/src/utils/reminders.ts` |
| Assistant service auth | `apps/api/src/middleware/assistantAuth.ts` — header `X-Assistant-Api-Key` = `config.ASSISTANT_API_KEY` |
| Setup wizard (owner creation) | `apps/api/src/routes/setup.ts`, web wizard already deployed |
| API base URL override | `apps/web/src/api/client.ts` `getApiBaseUrl()` |

---

# Phase 1 — Sidecar packaging

### Task 1: esbuild bundle of the API

**Files:**
- Create: `apps/api/scripts/build-sidecar.mjs`
- Modify: `apps/api/package.json` (script + devDependency)

**Interfaces:**
- Produces: `apps/api/dist-sidecar/sidecar.cjs` — self-contained CJS bundle of the API. Later tasks (SEA, Tauri) consume it.

- [ ] **Step 1: Add esbuild dev dependency**

```bash
cd apps/api && npm install --save-dev esbuild
```

- [ ] **Step 2: Write the bundle script**

Create `apps/api/scripts/build-sidecar.mjs`:

```js
// Bundles the API into a single CJS file for Node SEA packaging.
import { build } from 'esbuild';

await build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: 'dist-sidecar/sidecar.cjs',
    external: ['*.node'],
    // SEA's embedded require only resolves builtins; restore full require for
    // anything resolved at runtime (Prisma engine load).
    banner: { js: "const { createRequire } = require('node:module'); require = createRequire(process.execPath);" },
    logLevel: 'info',
});
```

- [ ] **Step 3: Add npm script**

In `apps/api/package.json` scripts:

```json
"build:sidecar": "node scripts/build-sidecar.mjs"
```

- [ ] **Step 4: Build and smoke-test the bundle with plain node**

```bash
cd apps/api && npm run build:sidecar
DATABASE_URL="file:./prisma/smoke.db" NODE_ENV=test APP_PORT=21473 JWT_SECRET=0123456789abcdef JWT_REFRESH_SECRET=0123456789abcdef node dist-sidecar/sidecar.cjs &
sleep 2 && curl -s http://127.0.0.1:21473/api/health && kill %1
```

Expected: `{"status":"ok"...}` from health. (Uses the test SQLite client because `NODE_ENV=test` — that's fine for a bundle smoke test; run `npx prisma db push --schema prisma/schema.test.prisma` first if `test.db` is missing.)

Known wrinkle: `apps/api/src/config/env.ts:7` resolves `.env` via `__dirname` — in the bundle this may not find the repo `.env`. That is acceptable: sidecar gets all env from Tauri. If the bundle crashes on dotenv, guard the call with `try/catch` in `env.ts`.

- [ ] **Step 5: Add `dist-sidecar/` to `.gitignore`, commit**

```bash
git add apps/api/scripts/build-sidecar.mjs apps/api/package.json apps/api/package-lock.json .gitignore
git commit -m "feat: esbuild sidecar bundle for desktop API"
```

### Task 2: Node SEA executable + engine/resource collection

**Files:**
- Create: `apps/api/scripts/package-sidecar.sh`
- Create: `apps/api/sea-config.json`

**Interfaces:**
- Consumes: `dist-sidecar/sidecar.cjs` from Task 1.
- Produces: `apps/desktop/src-tauri/binaries/ngocky-api-<target-triple>` (SEA executable) and `apps/desktop/src-tauri/resources/prisma/query-engine.node`. Sidecar honors env `PRISMA_QUERY_ENGINE_LIBRARY`.

- [ ] **Step 1: Write SEA config**

Create `apps/api/sea-config.json`:

```json
{
    "main": "dist-sidecar/sidecar.cjs",
    "output": "dist-sidecar/sea-prep.blob",
    "disableExperimentalSEAWarning": true
}
```

- [ ] **Step 2: Write packaging script**

Create `apps/api/scripts/package-sidecar.sh` (chmod +x):

```bash
#!/usr/bin/env bash
# Builds the SEA sidecar binary and copies Prisma engine into Tauri resources.
set -euo pipefail
cd "$(dirname "$0")/.."

TRIPLE=$(rustc -vV | sed -n 's/host: //p')
OUT_BIN="../desktop/src-tauri/binaries/ngocky-api-$TRIPLE"
RES="../desktop/src-tauri/resources"

npm run build:sidecar
node --experimental-sea-config sea-config.json

mkdir -p ../desktop/src-tauri/binaries "$RES/prisma"
cp "$(command -v node)" "$OUT_BIN"
if [[ "$(uname)" == "Darwin" ]]; then codesign --remove-signature "$OUT_BIN"; fi
npx postject "$OUT_BIN" NODE_SEA_BLOB dist-sidecar/sea-prep.blob \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
    $( [[ "$(uname)" == "Darwin" ]] && echo --macho-segment-name NODE_SEA )
if [[ "$(uname)" == "Darwin" ]]; then codesign --sign - "$OUT_BIN"; fi

# Prisma library engine (provider-agnostic query engine)
cp node_modules/.prisma/client/libquery_engine-*.node "$RES/prisma/query-engine.node"

echo "Sidecar packaged: $OUT_BIN"
```

Add to `apps/api/package.json` scripts: `"package:sidecar": "scripts/package-sidecar.sh"`.

- [ ] **Step 3: VERIFICATION GATE — run the SEA binary end to end**

```bash
cd apps/api && npm run package:sidecar
DATABASE_URL="file:$PWD/prisma/smoke.db" NODE_ENV=test APP_PORT=21473 \
  JWT_SECRET=0123456789abcdef JWT_REFRESH_SECRET=0123456789abcdef \
  PRISMA_QUERY_ENGINE_LIBRARY="$PWD/../desktop/src-tauri/resources/prisma/query-engine.node" \
  ../desktop/src-tauri/binaries/ngocky-api-* &
sleep 2 && curl -s http://127.0.0.1:21473/api/health; kill %1
```

Expected: health JSON. **If Prisma fails to load its engine inside SEA** (error mentions `Unable to require` or SEA require restrictions), fall back — no SEA: ship plain node + bundle instead. Fallback change: `package-sidecar.sh` copies `$(command -v node)` to `$OUT_BIN` unmodified and copies `dist-sidecar/sidecar.cjs` to `$RES/sidecar.cjs`; Task 3's Rust spawn then passes `sidecar.cjs` path as the first argument. Record whichever path was taken in the commit message.

- [ ] **Step 4: Commit**

```bash
git add apps/api/sea-config.json apps/api/scripts/package-sidecar.sh apps/api/package.json
git commit -m "feat: package API as Node SEA sidecar binary"
```

### Task 3: Tauri spawns the sidecar; desktop config commands

**Files:**
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Modify: `apps/desktop/src-tauri/tauri.conf.json`
- Modify: `apps/desktop/src-tauri/capabilities/default.json`

**Interfaces:**
- Consumes: sidecar binary + resources from Task 2.
- Produces: Tauri commands `get_desktop_config` → `DesktopConfig` JSON (camelCase), `set_desktop_config(config)` — used by web onboarding (Task 4). Sidecar env contract: `NODE_ENV, APP_PORT, DATABASE_URL, DB_PROVIDER, JWT_SECRET, JWT_REFRESH_SECRET, CORS_ORIGIN, MIGRATIONS_DIR, PRISMA_QUERY_ENGINE_LIBRARY, SCHEDULER_ENABLED, TELEGRAM_BOT_TOKEN`.

- [ ] **Step 1: Add plugins to Cargo.toml dependencies**

```toml
tauri-plugin-shell = "2"
tauri-plugin-process = "2"
tauri-plugin-notification = "2"
```

- [ ] **Step 2: Rewrite `apps/desktop/src-tauri/src/lib.rs`**

```rust
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

#[derive(Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct DesktopConfig {
    mode: Option<String>,
    database_url: Option<String>,
    jwt_secret: Option<String>,
    jwt_refresh_secret: Option<String>,
    telegram_bot_token: Option<String>,
}

struct SidecarChild(Mutex<Option<CommandChild>>);

fn config_path(app: &tauri::AppHandle) -> PathBuf {
    let dir = app.path().app_data_dir().expect("no app data dir");
    fs::create_dir_all(&dir).ok();
    dir.join("desktop-config.json")
}

fn load_config(app: &tauri::AppHandle) -> DesktopConfig {
    fs::read_to_string(config_path(app))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
fn get_desktop_config(app: tauri::AppHandle) -> DesktopConfig {
    load_config(&app)
}

#[tauri::command]
fn set_desktop_config(app: tauri::AppHandle, config: DesktopConfig) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(config_path(&app), json).map_err(|e| e.to_string())
}

fn spawn_sidecar(app: &tauri::AppHandle, cfg: &DesktopConfig) -> CommandChild {
    let mode = cfg.mode.clone().unwrap_or_default();
    let data_dir = app.path().app_data_dir().expect("no app data dir");
    let resources = app.path().resource_dir().expect("no resource dir");
    let (db_url, provider) = if mode == "offline" {
        (format!("file:{}", data_dir.join("ngocky.db").display()), "sqlite")
    } else {
        (cfg.database_url.clone().unwrap_or_default(), "postgres")
    };
    let mut envs: Vec<(String, String)> = vec![
        ("NODE_ENV".into(), "production".into()),
        ("APP_PORT".into(), "21473".into()),
        ("DATABASE_URL".into(), db_url),
        ("DB_PROVIDER".into(), provider.into()),
        ("JWT_SECRET".into(), cfg.jwt_secret.clone().unwrap_or_default()),
        ("JWT_REFRESH_SECRET".into(), cfg.jwt_refresh_secret.clone().unwrap_or_default()),
        ("CORS_ORIGIN".into(), "tauri://localhost,http://tauri.localhost".into()),
        ("MIGRATIONS_DIR".into(), resources.join("migrations").join(provider).display().to_string()),
        ("PRISMA_QUERY_ENGINE_LIBRARY".into(), resources.join("prisma").join("query-engine.node").display().to_string()),
        ("SCHEDULER_ENABLED".into(), "true".into()),
    ];
    if let Some(t) = &cfg.telegram_bot_token {
        envs.push(("TELEGRAM_BOT_TOKEN".into(), t.clone()));
    }
    let (_rx, child) = app
        .shell()
        .sidecar("ngocky-api")
        .expect("sidecar not bundled")
        .envs(envs)
        .spawn()
        .expect("failed to spawn sidecar");
    child
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![get_desktop_config, set_desktop_config])
        .setup(|app| {
            let cfg = load_config(app.handle());
            let child = match cfg.mode.as_deref() {
                Some("offline") | Some("shared") => Some(spawn_sidecar(app.handle(), &cfg)),
                _ => None,
            };
            app.manage(SidecarChild(Mutex::new(child)));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running NgocKy")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(state) = app.try_state::<SidecarChild>() {
                    if let Some(child) = state.0.lock().unwrap().take() {
                        child.kill().ok();
                    }
                }
            }
        });
}
```

If the fallback (no SEA) was taken in Task 2, replace the `.sidecar("ngocky-api")` builder line's spawn with `.args([resources.join("sidecar.cjs").display().to_string()])` before `.spawn()` — the binary is plain node and takes the bundle path as arg.

- [ ] **Step 3: tauri.conf.json — sidecar + resources**

In the `bundle` object add:

```json
"externalBin": ["binaries/ngocky-api"],
"resources": {
    "resources/migrations": "migrations",
    "resources/prisma": "prisma"
}
```

Create placeholder dirs so builds don't fail before Phase 2: `mkdir -p apps/desktop/src-tauri/resources/migrations/postgres apps/desktop/src-tauri/resources/migrations/sqlite` and add a `.gitkeep` in each. Add `apps/desktop/src-tauri/binaries/` and `apps/desktop/src-tauri/resources/prisma/` to `.gitignore` (build artifacts).

- [ ] **Step 4: Capabilities**

In `apps/desktop/src-tauri/capabilities/default.json`, add to `permissions`:

```json
"process:allow-restart",
"notification:default"
```

- [ ] **Step 5: Verify it compiles and runs (thin mode = no config file = no sidecar)**

```bash
cd apps/desktop && npm run dev
```

Expected: app opens as today (no sidecar spawned, no config file). Close it.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src-tauri
git commit -m "feat: tauri sidecar spawn + desktop config commands"
```

### Task 4: Desktop onboarding UI (mode chooser)

**Files:**
- Create: `apps/web/src/pages/DesktopOnboardingPage.tsx`
- Create: `apps/web/src/components/DesktopGate.tsx`
- Modify: `apps/web/src/App.tsx` (wrap app in `DesktopGate`)
- Modify: `apps/web/package.json` (deps)

**Interfaces:**
- Consumes: Tauri commands `get_desktop_config` / `set_desktop_config` (Task 3), localStorage key `ngocky_api_url`.
- Produces: first-launch mode chooser; sets config + relaunches.

- [ ] **Step 1: Add deps**

```bash
cd apps/web && npm install @tauri-apps/api @tauri-apps/plugin-process
```

- [ ] **Step 2: Create `apps/web/src/components/DesktopGate.tsx`**

```tsx
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
```

- [ ] **Step 3: Create `apps/web/src/pages/DesktopOnboardingPage.tsx`**

```tsx
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
```

- [ ] **Step 4: Wrap the app**

In `apps/web/src/App.tsx`, import `DesktopGate` and wrap the top-level rendered tree (outermost, inside providers is fine):

```tsx
import DesktopGate from './components/DesktopGate';
// ... in the return:
<DesktopGate>
    {/* existing router/layout tree unchanged */}
</DesktopGate>
```

- [ ] **Step 5: Verify web still builds + browser unaffected**

```bash
npm run lint && npm run build:web
```

Expected: clean. In a browser (`npm run dev:web`), app behaves exactly as before (gate is a no-op outside Tauri).

- [ ] **Step 6: Verify in Tauri dev**

```bash
cd apps/desktop && npm run dev
```

Expected: onboarding screen appears (no config yet). Do not complete it yet (sidecar resources land in Phase 2). Close.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat: desktop mode-chooser onboarding"
```

---

# Phase 2 — Mode 3 (shared Postgres): migration runner + baseline

### Task 5: Migration runner service (TDD)

**Files:**
- Create: `apps/api/src/services/migrationRunner.ts`
- Create: `apps/api/src/test/migration-runner.test.ts`
- Modify: `apps/api/src/config/database.ts` (export `usesSqlite`)
- Modify: `apps/api/src/index.ts` (run before seed)

**Interfaces:**
- Produces: `runMigrations(dir: string): Promise<void>` — applies `*.sql` files in `dir` in filename order, tracked in `_app_migrations(name TEXT PRIMARY KEY)`, idempotent, safe under concurrent mode-3 clients (Postgres transaction advisory lock).
- Consumes: `prisma` singleton, new export `usesSqlite: boolean` from `database.ts`.

- [ ] **Step 1: Export `usesSqlite` from database.ts**

In `apps/api/src/config/database.ts` add below `isTestDatabase`:

```ts
export const usesSqlite = isTestDatabase || process.env.DB_PROVIDER === 'sqlite';
```

- [ ] **Step 2: Write the failing test**

Create `apps/api/src/test/migration-runner.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { prisma } from '../config/database';
import { runMigrations } from '../services/migrationRunner';

describe('migration runner', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mig-'));

    beforeAll(async () => {
        await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS mig_smoke');
        await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS _app_migrations');
        writeFileSync(join(dir, '001_one.sql'), 'CREATE TABLE mig_smoke (id INTEGER PRIMARY KEY);\n');
        writeFileSync(join(dir, '002_two.sql'), 'INSERT INTO mig_smoke (id) VALUES (1);\n');
    });

    it('applies pending migrations in order, exactly once', async () => {
        await runMigrations(dir);
        await runMigrations(dir); // second run must be a no-op (002 would violate PK if reapplied)
        const rows = await prisma.$queryRawUnsafe<{ id: number }[]>('SELECT id FROM mig_smoke');
        expect(rows.length).toBe(1);
        const applied = await prisma.$queryRawUnsafe<{ name: string }[]>('SELECT name FROM _app_migrations ORDER BY name');
        expect(applied.map((r) => r.name)).toEqual(['001_one.sql', '002_two.sql']);
    });

    it('rejects unsafe filenames', async () => {
        writeFileSync(join(dir, "003_bad'name.sql"), 'SELECT 1;\n');
        await expect(runMigrations(dir)).rejects.toThrow(/unsafe migration filename/i);
    });
});
```

- [ ] **Step 3: Run test, verify failure**

```bash
cd apps/api && npx vitest run src/test/migration-runner.test.ts
```

Expected: FAIL — cannot resolve `../services/migrationRunner`.

- [ ] **Step 4: Implement `apps/api/src/services/migrationRunner.ts`**

```ts
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { prisma, usesSqlite } from '../config/database';

const LOCK_KEY = 724533177; // arbitrary app-wide advisory lock id

export async function runMigrations(dir: string) {
    await prisma.$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS _app_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)'
    );
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
        if (!/^[A-Za-z0-9._-]+$/.test(file)) throw new Error(`Unsafe migration filename: ${file}`);
    }
    await prisma.$transaction(
        async (tx) => {
            // xact-scoped lock: same connection guaranteed, auto-released on commit.
            if (!usesSqlite) await tx.$queryRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_KEY})`);
            const appliedRows = await tx.$queryRawUnsafe<{ name: string }[]>('SELECT name FROM _app_migrations');
            const applied = new Set(appliedRows.map((r) => r.name));
            for (const file of files) {
                if (applied.has(file)) continue;
                const sql = readFileSync(join(dir, file), 'utf8');
                // ponytail: naive statement split — fine for Prisma-generated DDL, breaks on
                // CREATE FUNCTION bodies; switch to a real parser if we ever ship one.
                const statements = sql
                    .split(/;\s*(?:\r?\n|$)/)
                    .map((s) => s.replace(/^\s*--[^\n]*$/gm, '').trim())
                    .filter(Boolean);
                for (const stmt of statements) await tx.$executeRawUnsafe(stmt);
                await tx.$executeRawUnsafe(`INSERT INTO _app_migrations (name) VALUES ('${file}')`);
                console.log(`✅ migration applied: ${file}`);
            }
        },
        { timeout: 120_000 }
    );
}
```

- [ ] **Step 5: Run test, verify pass; run full suite**

```bash
cd apps/api && npx vitest run src/test/migration-runner.test.ts && npm test
```

Expected: PASS, full suite green.

- [ ] **Step 6: Wire into startup**

In `apps/api/src/index.ts`, after `await prisma.$connect();`:

```ts
if (process.env.MIGRATIONS_DIR) {
    const { runMigrations } = await import('./services/migrationRunner');
    await runMigrations(process.env.MIGRATIONS_DIR);
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/services/migrationRunner.ts apps/api/src/test/migration-runner.test.ts apps/api/src/config/database.ts apps/api/src/index.ts
git commit -m "feat: runtime migration runner for desktop modes"
```

### Task 6: Baseline SQL generation + resource wiring

**Files:**
- Create: `apps/api/scripts/generate-baselines.mjs`
- Modify: `apps/api/scripts/package-sidecar.sh` (call it)

**Interfaces:**
- Produces: `apps/desktop/src-tauri/resources/migrations/postgres/000_baseline.sql` (and `sqlite/000_baseline.sql` once the desktop schema exists in Phase 3). Consumed by the migration runner via `MIGRATIONS_DIR`.

- [ ] **Step 1: Write the generator**

Create `apps/api/scripts/generate-baselines.mjs`:

```js
// Squashed schema DDL per provider, shipped as the runtime baseline migration.
// Future schema changes: add NNN_name.sql diff files next to the baseline
// (generate with `prisma migrate diff --from-schema-datamodel <old> --to-schema-datamodel <new> --script`).
import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const resources = join(root, '..', 'desktop', 'src-tauri', 'resources', 'migrations');

const targets = [
    { provider: 'postgres', schema: join(root, 'prisma', 'schema.prisma') },
    { provider: 'sqlite', schema: join(root, 'prisma', 'schema.desktop.prisma') }, // exists from Phase 3 onward
];

for (const { provider, schema } of targets) {
    if (!existsSync(schema)) {
        console.log(`skip ${provider}: ${schema} missing`);
        continue;
    }
    const out = join(resources, provider);
    mkdirSync(out, { recursive: true });
    execSync(
        `npx prisma migrate diff --from-empty --to-schema-datamodel "${schema}" --script > "${join(out, '000_baseline.sql')}"`,
        { cwd: root, stdio: ['ignore', 'inherit', 'inherit'], shell: '/bin/bash' }
    );
    console.log(`baseline written: ${provider}`);
}
```

- [ ] **Step 2: Call from packaging script**

In `apps/api/scripts/package-sidecar.sh`, after the engine copy line add:

```bash
node scripts/generate-baselines.mjs
```

- [ ] **Step 3: Generate and sanity-check**

```bash
cd apps/api && node scripts/generate-baselines.mjs
head -5 ../desktop/src-tauri/resources/migrations/postgres/000_baseline.sql
grep -c "CREATE TABLE" ../desktop/src-tauri/resources/migrations/postgres/000_baseline.sql
```

Expected: DDL starting with `CREATE TYPE`/`CREATE TABLE`; table count roughly matches model count in `schema.prisma`. Note: baseline files are generated build artifacts — add `apps/desktop/src-tauri/resources/migrations/` to `.gitignore` (keep the `.gitkeep` dirs out too; simpler: ignore the whole `resources/migrations` path and drop the Phase-1 `.gitkeep`s).

- [ ] **Step 4: Runner-vs-baseline integration check**

The Postgres baseline contains `CREATE TYPE` / `CREATE TABLE` / `CREATE INDEX` / `ALTER TABLE ... FOREIGN KEY` statements — all compatible with the naive splitter. Verify against the dev docker Postgres:

```bash
docker compose up -d db 2>/dev/null || docker compose up -d
docker compose exec -T db psql -U postgres -c "DROP DATABASE IF EXISTS mode3_test; CREATE DATABASE mode3_test;" postgres
cd apps/api && npm run build:sidecar
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/mode3_test" NODE_ENV=production APP_PORT=21473 \
  JWT_SECRET=0123456789abcdef JWT_REFRESH_SECRET=0123456789abcdef \
  MIGRATIONS_DIR="$PWD/../desktop/src-tauri/resources/migrations/postgres" \
  node dist-sidecar/sidecar.cjs &
sleep 4 && curl -s http://127.0.0.1:21473/api/health && curl -s http://127.0.0.1:21473/api/setup/status; kill %1
```

(Adjust postgres user/password to match `docker-compose.yml`.) Expected: migrations log lines, health OK, `{"needsSetup":true}`. If any statement fails to split cleanly, fix the splitter regex in `migrationRunner.ts` — do not hand-edit the baseline.

- [ ] **Step 5: Commit**

```bash
git add apps/api/scripts/generate-baselines.mjs apps/api/scripts/package-sidecar.sh .gitignore
git commit -m "feat: generate per-provider baseline SQL for desktop migrations"
```

### Task 7: Mode 3 end-to-end verification

**Files:** none created — verification checkpoint.

**Interfaces:** Consumes everything from Tasks 1–6.

- [ ] **Step 1: Fresh DB + full desktop build**

```bash
docker compose exec -T db psql -U postgres -c "DROP DATABASE IF EXISTS mode3_e2e; CREATE DATABASE mode3_e2e;" postgres
cd apps/api && npm run package:sidecar
cd ../desktop && npm run build
```

- [ ] **Step 2: Launch built app, walk the flow**

Open the built app (`apps/desktop/src-tauri/target/release/bundle/`). Verify:
1. Onboarding appears → choose "Shared database" → paste `postgresql://postgres:postgres@localhost:5433/mode3_e2e`.
2. App relaunches → "Starting local server…" → setup wizard (fresh DB) → create owner → login.
3. Create a goal; confirm it persists after app restart.
4. `psql`: `SELECT count(*) FROM "_app_migrations";` returns ≥ 1; goal row exists.

- [ ] **Step 3: Second-client simulation (idempotent migrations)**

Relaunch the app a second time while a `node dist-sidecar/sidecar.cjs` instance (same env as Task 6 Step 4, `APP_PORT=21474`) runs against the same DB. Expected: no migration errors, both serve health.

- [ ] **Step 4: Commit any fixes; update docs**

Add CHANGELOG entry under today's date: "Desktop: mode 3 (thick client + shared Postgres) — sidecar, onboarding, runtime migrations." Commit.

---

# Phase 3 — Mode 2 (offline SQLite)

### Task 8: Desktop SQLite Prisma client

**Files:**
- Modify: `apps/api/scripts/generate-test-schema.mjs` (variant support)
- Modify: `apps/api/src/config/database.ts` (desktop client branch)
- Modify: `apps/api/package.json` (script)

**Interfaces:**
- Produces: `apps/api/prisma/schema.desktop.prisma` + generated client at `apps/api/prisma/desktop-client`, selected at runtime when `DB_PROVIDER=sqlite` and not under test. `DATABASE_URL` env-driven (unlike the test client's hardcoded `file:./test.db`).

- [ ] **Step 1: Add variant support to the generator**

Rewrite `apps/api/scripts/generate-test-schema.mjs` header section:

```js
// Generates prisma/schema.test.prisma (default) or prisma/schema.desktop.prisma
// (--variant desktop) from prisma/schema.prisma. Never edit outputs by hand.
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const variant = process.argv.includes('--variant') ? process.argv[process.argv.indexOf('--variant') + 1] : 'test';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');

const variants = {
    test: {
        file: 'schema.test.prisma',
        output: '../src/test/client',
        url: '"file:./test.db"',
    },
    desktop: {
        file: 'schema.desktop.prisma',
        output: './desktop-client',
        url: 'env("DATABASE_URL")',
    },
};
const v = variants[variant];
if (!v) throw new Error(`Unknown variant: ${variant}`);

const header = `// AUTO-GENERATED from schema.prisma by scripts/generate-test-schema.mjs — do not edit.
generator client {
  provider = "prisma-client-js"
  output   = "${v.output}"
}

datasource db {
  provider = "sqlite"
  url      = ${v.url}
}
`;
```

Keep the existing `body` transformation and change the final write to:

```js
writeFileSync(join(root, 'prisma', v.file), header + '\n' + body);
console.log(`${v.file} regenerated from schema.prisma`);
```

- [ ] **Step 2: npm script + generate**

Add to `apps/api/package.json` scripts:

```json
"db:generate:desktop": "node scripts/generate-test-schema.mjs --variant desktop && prisma generate --schema prisma/schema.desktop.prisma"
```

Run it:

```bash
cd apps/api && npm run db:generate:desktop && ls prisma/desktop-client | head -3
```

Expected: generated client files. Add `apps/api/prisma/desktop-client/` and `apps/api/prisma/schema.desktop.prisma` to `.gitignore` (regenerated per build). Call `npm run db:generate:desktop` from `scripts/package-sidecar.sh` before `npm run build:sidecar`.

- [ ] **Step 3: Runtime client switch**

In `apps/api/src/config/database.ts`, replace the client selection block:

```ts
const isTestDatabase = process.env.NODE_ENV === 'test' || process.env.DATABASE_URL?.startsWith('file:');
const isDesktopSqlite = process.env.DB_PROVIDER === 'sqlite' && process.env.NODE_ENV !== 'test';

const { PrismaClient } = (
    isDesktopSqlite
        ? require('../../prisma/desktop-client')
        : isTestDatabase
            ? require('../test/client')
            : require('@prisma/client')
) as { PrismaClient: PrismaClientConstructor };
```

Note: the desktop branch must come first — mode-2 `DATABASE_URL` starts with `file:` which would otherwise select the test client (whose URL is hardcoded to `test.db`). `usesSqlite` (Task 5) already covers this branch. The esbuild bundle statically includes all three requires — `prisma/desktop-client` must exist when `build:sidecar` runs (Step 2 wiring guarantees it).

- [ ] **Step 4: Full test suite (regression)**

```bash
cd apps/api && npm test
```

Expected: green — test path unchanged.

- [ ] **Step 5: SQLite run of the full API suite (spec §7)**

The suite already runs on SQLite via the test client — that is the SQLite compatibility proof. Additionally smoke the desktop client itself:

```bash
cd apps/api && npm run build:sidecar && node scripts/generate-baselines.mjs
rm -f /tmp/ngocky-m2.db
DATABASE_URL="file:/tmp/ngocky-m2.db" DB_PROVIDER=sqlite NODE_ENV=production APP_PORT=21473 \
  JWT_SECRET=0123456789abcdef JWT_REFRESH_SECRET=0123456789abcdef \
  MIGRATIONS_DIR="$PWD/../desktop/src-tauri/resources/migrations/sqlite" \
  node dist-sidecar/sidecar.cjs &
sleep 3 && curl -s http://127.0.0.1:21473/api/setup/status; kill %1
```

Expected: `{"needsSetup":true}` — baseline applied to a fresh SQLite file via the desktop client.

- [ ] **Step 6: Commit**

```bash
git add apps/api/scripts/generate-test-schema.mjs apps/api/src/config/database.ts apps/api/package.json apps/api/scripts/package-sidecar.sh .gitignore
git commit -m "feat: desktop SQLite prisma client (mode 2)"
```

### Task 9: Mode 2 end-to-end verification

**Files:** none — verification checkpoint.

- [ ] **Step 1: Rebuild and launch**

```bash
cd apps/api && npm run package:sidecar && cd ../desktop && npm run build
```

Reset desktop config to re-trigger onboarding: delete `~/Library/Application Support/vn.kael.ngocky/desktop-config.json` (and `ngocky.db` if present).

- [ ] **Step 2: Walk the flow**

1. Launch built app → onboarding → "Offline (just me)".
2. Relaunch → setup wizard → create owner → login.
3. Create a goal, an expense, a housework item (exercises enums + notification fields on SQLite).
4. Quit fully, relaunch: data persists; no network calls to VPS (check: disconnect Wi-Fi, app still works).

- [ ] **Step 3: CHANGELOG entry, commit fixes**

"Desktop: mode 2 (single-user offline, SQLite)" under today's date. Commit.

---

# Phase 4 — Local scheduler + notification channels

### Task 10: Lookback window on due-notifications

**Files:**
- Modify: `apps/api/src/routes/service.ts:552` (due-notifications handler)
- Test: `apps/api/src/test/service-notifications.test.ts` (extend)

**Interfaces:**
- Produces: `GET /api/service/due-notifications?lookbackMinutes=N` — widens `windowStart` to `now − N minutes` (default 1, max 10080). Existing n8n callers unaffected (default preserves current behavior).

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/test/service-notifications.test.ts` (follow the file's existing helpers for auth headers and item creation — it already builds notification-due items):

```ts
it('lookbackMinutes widens the due window', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const inTwoHours = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const task = await prisma.task.create({
        data: {
            title: 'Missed while asleep',
            userId: owner.id,
            status: 'TODO',
            dueDate: inTwoHours,
            notificationEnabled: true,
            reminderOffsetUnit: 'HOURS',
            reminderOffsetValue: 4,
            notificationDate: twoHoursAgo,
            notificationTime: '09:00',
        },
    });
    const missed = await request(app)
        .get('/api/service/due-notifications')
        .set('X-Assistant-Api-Key', ASSISTANT_KEY);
    expect(missed.body.data.find((n: any) => n.id === task.id)).toBeUndefined();
    const caught = await request(app)
        .get('/api/service/due-notifications?lookbackMinutes=180')
        .set('X-Assistant-Api-Key', ASSISTANT_KEY);
    expect(caught.body.data.find((n: any) => n.id === task.id)).toBeDefined();
});
```

(Reuse the test file's actual owner fixture and key constant names — match what's already there.)

- [ ] **Step 2: Run, verify fail**

```bash
cd apps/api && npx vitest run src/test/service-notifications.test.ts
```

Expected: FAIL on the second assertion (window is fixed at −1 min).

- [ ] **Step 3: Implement**

In the due-notifications handler (`apps/api/src/routes/service.ts:552`), replace the `windowStart` line:

```ts
const lookback = Math.min(queryInt(req, 'lookbackMinutes', 1), 7 * 24 * 60);
const windowStart = new Date(now.getTime() - lookback * 60 * 1000);   // catch just-passed / missed-while-asleep
```

- [ ] **Step 4: Run tests, verify pass**

```bash
cd apps/api && npx vitest run src/test/service-notifications.test.ts && npm test
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/service.ts apps/api/src/test/service-notifications.test.ts
git commit -m "feat: lookbackMinutes param on due-notifications for catch-up scans"
```

### Task 11: Scheduler service (TDD)

**Files:**
- Create: `apps/api/src/services/scheduler.ts`
- Create: `apps/api/src/routes/notifications.ts`
- Create: `apps/api/src/test/scheduler.test.ts`
- Modify: `apps/api/src/app.ts` (mount route), `apps/api/src/index.ts` (start)

**Interfaces:**
- Produces:
  - `tick(lookbackMinutes: number, base?: string): Promise<void>` — fetches due items from own API, delivers, marks sent.
  - `startScheduler(): void` — boot catch-up (24h lookback) + 5-min interval; interval lookback = minutes since last tick + 15 (covers laptop sleep without OS wake events).
  - `recentNotifications(userId: string): FiredNotification[]` where `FiredNotification = { key: string; sourceType: string; id: string; title: string; subtitle?: string; userId: string; firedAt: string }` (in-memory, last 100).
  - `GET /api/notifications/recent` (JWT auth) → `FiredNotification[]` for the caller.
- Consumes: Task 10's lookback param; `config.ASSISTANT_API_KEY`; `TELEGRAM_BOT_TOKEN` env; the due item shape from `due-notifications` (`{ sourceType, id, title, subtitle?, user: { id, telegramChatId } }`).

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/test/scheduler.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import app from '../app';
import { prisma } from '../config/database';
import { tick, recentNotifications } from '../services/scheduler';

// Reuse whatever user-fixture helper the other tests use; shown inline here:
async function makeOwner() {
    return prisma.user.create({
        data: { email: `sched-${Date.now()}@test.local`, name: 'Sched', password: 'x', role: 'OWNER', active: true },
    });
}

describe('scheduler tick', () => {
    let server: Server;
    let base: string;

    beforeAll(async () => {
        server = app.listen(0);
        const address = server.address() as { port: number };
        base = `http://127.0.0.1:${address.port}/api`;
    });
    afterAll(() => server.close());

    it('fires a due notification once, marks it sent, exposes it to the user', async () => {
        const owner = await makeOwner();
        const task = await prisma.task.create({
            data: {
                title: 'Scheduler smoke',
                userId: owner.id,
                status: 'TODO',
                dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
                notificationEnabled: true,
                reminderOffsetUnit: 'HOURS',
                reminderOffsetValue: 4,
                notificationDate: new Date(Date.now() - 60 * 60 * 1000),
                notificationTime: '09:00',
            },
        });

        await tick(180, base);
        const fired = recentNotifications(owner.id).filter((n) => n.id === task.id);
        expect(fired.length).toBe(1);

        const marked = await prisma.task.findUnique({ where: { id: task.id } });
        expect(marked!.lastNotificationSentAt).not.toBeNull();

        await tick(180, base); // cooldown (default 24h) suppresses refire
        expect(recentNotifications(owner.id).filter((n) => n.id === task.id).length).toBe(1);
    });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
cd apps/api && npx vitest run src/test/scheduler.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/api/src/services/scheduler.ts`**

```ts
import { config } from '../config/env';

export type FiredNotification = {
    key: string;
    sourceType: string;
    id: string;
    title: string;
    subtitle?: string;
    userId: string;
    firedAt: string;
};

const recent: FiredNotification[] = [];

export function recentNotifications(userId: string): FiredNotification[] {
    return recent.filter((n) => n.userId === userId);
}

const serviceHeaders = {
    'X-Assistant-Api-Key': config.ASSISTANT_API_KEY,
    'Content-Type': 'application/json',
};

async function sendTelegram(chatId: string, text: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
    }).catch((err) => console.error('telegram send failed', err));
}

export async function tick(lookbackMinutes: number, base = `http://127.0.0.1:${config.APP_PORT}/api`) {
    try {
        const res = await fetch(`${base}/service/due-notifications?lookbackMinutes=${lookbackMinutes}`, {
            headers: serviceHeaders,
        });
        if (!res.ok) return;
        const { data } = (await res.json()) as { data: any[] };
        for (const n of data ?? []) {
            if (!n?.user?.id) continue;
            const text = `🔔 ${n.title}${n.subtitle ? ` — ${n.subtitle}` : ''}`;
            if (n.user.telegramChatId) await sendTelegram(n.user.telegramChatId, text);
            recent.unshift({
                key: `${n.sourceType}:${n.id}:${Date.now()}`,
                sourceType: n.sourceType,
                id: n.id,
                title: n.title,
                subtitle: n.subtitle ?? undefined,
                userId: n.user.id,
                firedAt: new Date().toISOString(),
            });
            if (recent.length > 100) recent.length = 100;
            await fetch(`${base}/service/due-notifications/sent`, {
                method: 'POST',
                headers: serviceHeaders,
                body: JSON.stringify({ sourceType: n.sourceType, id: n.id }),
            });
        }
    } catch (err) {
        console.error('scheduler tick failed', err);
    }
}

export function startScheduler() {
    void tick(24 * 60); // boot catch-up: fire what was missed while the machine was off
    let lastTick = Date.now();
    setInterval(() => {
        const gap = Math.ceil((Date.now() - lastTick) / 60_000) + 15; // covers laptop sleep
        lastTick = Date.now();
        void tick(gap);
    }, 5 * 60 * 1000).unref();
    console.log('⏰ local scheduler started');
}
```

- [ ] **Step 4: Route `apps/api/src/routes/notifications.ts`**

```ts
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { sendSuccess } from '../utils/response';
import { recentNotifications } from '../services/scheduler';

const router = Router();
router.use(authenticate);

router.get('/recent', (req: Request, res: Response) => {
    sendSuccess(res, recentNotifications(req.user!.userId));
});

export default router;
```

Mount in `apps/api/src/app.ts` next to the other routes:

```ts
import notificationRoutes from './routes/notifications';
app.use('/api/notifications', notificationRoutes);
```

Start in `apps/api/src/index.ts` after `app.listen` callback fires (or right after it):

```ts
if (process.env.SCHEDULER_ENABLED === 'true') {
    const { startScheduler } = await import('./services/scheduler');
    startScheduler();
}
```

- [ ] **Step 5: Run tests, verify pass; full suite**

```bash
cd apps/api && npx vitest run src/test/scheduler.test.ts && npm test
```

Expected: PASS. (Telegram not attempted — token env unset in tests.)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/scheduler.ts apps/api/src/routes/notifications.ts apps/api/src/test/scheduler.test.ts apps/api/src/app.ts apps/api/src/index.ts
git commit -m "feat: in-sidecar scheduler with catch-up scan and telegram delivery"
```

### Task 12: Desktop OS notifications (frontend poller)

**Files:**
- Create: `apps/web/src/components/DesktopNotifier.tsx`
- Modify: `apps/web/src/layouts/AppLayout.tsx` (render it)

**Interfaces:**
- Consumes: `GET /api/notifications/recent` (Task 11), `isTauri` from `DesktopGate` (Task 4), `@tauri-apps/plugin-notification`.

- [ ] **Step 1: Create `apps/web/src/components/DesktopNotifier.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { isTauri } from './DesktopGate';

type FiredNotification = { key: string; title: string; subtitle?: string };

export default function DesktopNotifier() {
    const seen = useRef(new Set<string>());
    const { data } = useQuery<FiredNotification[]>({
        queryKey: ['desktop-notifications'],
        queryFn: async () => (await api.get('/notifications/recent')).data.data,
        refetchInterval: 60_000,
        enabled: isTauri,
    });

    useEffect(() => {
        if (!data?.length) return;
        (async () => {
            const { isPermissionGranted, requestPermission, sendNotification } = await import(
                '@tauri-apps/plugin-notification'
            );
            let granted = await isPermissionGranted();
            if (!granted) granted = (await requestPermission()) === 'granted';
            for (const n of data) {
                if (seen.current.has(n.key)) continue;
                seen.current.add(n.key);
                if (granted) sendNotification({ title: n.title, body: n.subtitle ?? '' });
            }
        })();
    }, [data]);

    return null;
}
```

(If `api/client.ts` uses a named export instead of default, match it — check the import style used by `apps/web/src/api/appSettings.ts`.)

- [ ] **Step 2: Render inside `AppLayout.tsx`**

Add `<DesktopNotifier />` once, near the top of the layout's returned JSX (it renders nothing).

- [ ] **Step 3: Verify**

```bash
npm run lint && npm run build:web
```

Then in Tauri dev with an offline/shared config: create a task with a notification due now (ON_DATE, current time), wait ≤5 min (or restart app to trigger boot catch-up). Expected: OS notification appears; `GET /api/notifications/recent` (with JWT) returns it.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/DesktopNotifier.tsx apps/web/src/layouts/AppLayout.tsx
git commit -m "feat: desktop OS notifications from local scheduler"
```

### Task 13: Final verification + docs

**Files:**
- Modify: `docs/CHANGELOG.md`, `docs/DESIGN.md`

- [ ] **Step 1: Full regression**

```bash
npm run lint && cd apps/api && npm test
```

Expected: all green.

- [ ] **Step 2: Full desktop build, all three modes smoke**

```bash
cd apps/api && npm run package:sidecar && cd ../desktop && npm run build
```

- Thin: fresh config → onboarding → "Family server" → login against VPS works as before.
- Offline: Task 9 flow + one scheduler notification.
- Shared: Task 7 flow; second machine/instance sees the same data; a notification fired on one client is cooldown-suppressed on the other (check `lastNotificationSentAt`).

- [ ] **Step 3: Docs**

- `docs/DESIGN.md:743`: change section title suffix from "(planned — not yet implemented)" to "(implemented 2026-07)"; append one paragraph noting the deltas from plan: custom migration runner instead of Prisma CLI, `lastNotificationSentAt`+cooldown as the idempotency mechanism (not a `firedAt` column), scheduled-reports delivery still n8n/VPS-only.
- `docs/CHANGELOG.md`: entry for scheduler + channels.

- [ ] **Step 4: Commit**

```bash
git add docs/
git commit -m "docs: desktop modes 2/3 + local scheduler shipped"
```

---

## Deviations from spec (agreed at plan time)

- **Idempotency**: spec said `UPDATE … WHERE firedAt IS NULL`; implementation reuses the existing `lastNotificationSentAt` + `notificationCooldownHours` mechanism (`isReminderDue`) — same first-writer-wins intent, zero schema change.
- **In-app alerts persistence**: spec said "persist to existing Alerts module"; Alerts module stores *rules*, not fired instances. Fired notifications are exposed via in-memory `GET /api/notifications/recent` instead (survives nothing, but boot catch-up refires anything unmarked). Add a `NotificationLog` model later if history is wanted.
- **Scheduled reports** (`due-reports`): stay n8n/VPS-only; local scheduler covers item reminders only.
- **Wake catch-up**: no Tauri resume event; the interval computes lookback from wall-clock gap since last tick, which covers sleep more simply.
