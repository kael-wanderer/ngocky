# Desktop Offline Modes (2 + 3) + Local Scheduler — Design

Date: 2026-07-18. Extends `docs/DESIGN.md` § "Desktop App Deployment Modes".
Scope: full build — sidecar packaging, mode 3, mode 2 (SQLite), scheduler. Email channel deferred.

## Modes recap

| Mode | Frontend | API | DB |
|---|---|---|---|
| 1. Thin client | remote webapp URL | VPS | VPS Postgres |
| 2. Single-user offline | bundled | local sidecar | local SQLite file |
| 3. Thick client + shared DB | bundled | local sidecar | remote Postgres (LAN/Supabase) |

One Tauri binary. Mode chosen at first-launch onboarding, stored in Tauri app config (JSON in app data dir). Mode 3 = mode 2 with remote `DATABASE_URL`.

## 1. Architecture

- Mode 1 unchanged: webview loads remote URL.
- Modes 2/3: Tauri serves bundled web dist; spawns API sidecar bound to `127.0.0.1:<free port>`; frontend base URL set to `http://127.0.0.1:<port>/api` at runtime.
- Tauri lifecycle: spawn sidecar on launch, poll `/api/health` before showing UI, kill sidecar on exit.

## 2. Sidecar packaging

- Express app compiled to a single executable with **Node SEA** (fallback: `pkg`) and registered as a Tauri sidecar per target platform.
- Prisma query engine native libraries shipped as Tauri resources next to the executable; sidecar sets `PRISMA_QUERY_ENGINE_LIBRARY` to that path.
- Sidecar reads config via env passed by Tauri: `DB_PROVIDER` (`postgres`|`sqlite`), `DATABASE_URL`, `PORT`, JWT secrets (generated once at onboarding, stored in app config).

## 3. Database — dual Prisma schemas

- `apps/api/prisma/schema.prisma` (Postgres) unchanged.
- New `apps/api/prisma/schema.sqlite.prisma`, generated to a separate client output dir. Runtime switch in `src/config/database.ts` by `DB_PROVIDER`.
- SQLite incompatibilities:
  - **Enums → `String`.** Zod validators already constrain values at the API boundary; no logic change.
  - **Scalar arrays → JSON string.** (De)serialize at service layer only where such fields exist.
- Pre-work: audit pass listing every enum and array field in the schema; the SQLite schema and any serialization shims come from that list.
- Maintenance rule: every future migration edits both schema files.

## 4. Migrations — custom tiny runner (no Prisma CLI in sidecar)

- Prisma CLI/schema-engine is too heavy to embed in SEA. Instead:
  - Migration `.sql` files (per provider) shipped as Tauri resources.
  - Small runner in sidecar startup: `_app_migrations` table tracks applied filenames; applies pending ones in order, each in a transaction.
  - Mode 3 concurrency: Postgres advisory lock around the run so two family clients can't double-apply.
- Dev workflow unchanged (`prisma migrate dev` against Postgres); SQLite `.sql` files generated via `prisma migrate diff` against the SQLite schema.

## 5. Scheduler + alerts

- In-process minute tick inside sidecar (replaces n8n for modes 2/3).
- **Idempotency**: fire = `UPDATE ... SET firedAt = now() WHERE id = ? AND firedAt IS NULL`; first writer wins across concurrent mode-3 clients.
- **Catch-up scan** on sidecar startup and Tauri resume-from-sleep event: fire overdue unfired notifications (late delivery accepted; guaranteed delivery = mode 1 only).
- Channels: OS native notification (Tauri notification API) + Telegram (reuse `apps/api/src/services/assistant/telegram.ts` + agent settings) + persist to existing Alerts module.
- **Email deferred** — add nodemailer + SMTP settings later if Telegram insufficient.

## 6. Onboarding + auth

- First-launch screen: pick mode.
  - Mode 1: enter server URL (current behavior).
  - Mode 2: owner account form (name/email/password) → seeds local SQLite.
  - Mode 3: Postgres connection string (Supabase pooler port 6543 hint) → migrate → create or log in owner.
- Existing JWT auth kept in all modes (sidecar is localhost-only in 2/3). Mode 3 role checks are client-side only — accepted family-trust trade-off.

## 7. Testing

- Existing API test suite runs unchanged (Postgres).
- Add: full API suite run with `DB_PROVIDER=sqlite`; migration-runner unit test; scheduler idempotency test (two concurrent fires → exactly one alert).

## Build order

1. Sidecar packaging (SEA + Prisma engines + Tauri spawn/health-check)
2. Mode 3 (onboarding, connection string, migration runner on Postgres)
3. Mode 2 (enum/array audit → SQLite schema → serialization shims → SQLite migration files)
4. Scheduler (tick, idempotent fire, catch-up, channels)

## Out of scope

Sync between modes, email channel, server-side scheduling (Supabase pg_cron), untrusted-user security for mode 3.
