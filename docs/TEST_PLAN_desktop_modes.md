# Desktop Offline Modes — Test Plan

Manual verification for the Tauri desktop app (thin / offline / shared modes) + local scheduler.
Branch: `feat/desktop-offline-modes`. Platform notes assume macOS (arm64).

Automated coverage already green (run `npm test` from `apps/api` → 88 passing): migration runner,
`lookbackMinutes` param, scheduler tick (fire-once / mark-sent / cooldown). The cases below are the
**GUI + end-to-end** paths that automation can't drive.

> All commands below run from the **repo root** unless a `cd` is shown.

---

## 0. Prerequisites / Build

| ID | Step | Command | Expected |
| :--- | :--- | :--- | :--- |
| P-1 | Package the API sidecar (downloads official node first run) | `npm run --workspace @ngocky/api package:sidecar` | Ends with `Sidecar packaged: …/binaries/ngocky-api-<triple>`; `baseline written: postgres` + `sqlite` |
| P-2 | Confirm artifacts exist | `ls apps/desktop/src-tauri/binaries apps/desktop/src-tauri/resources/prisma apps/desktop/src-tauri/resources/migrations/{postgres,sqlite}` | binary (~108MB), `query-engine.node`, `000_baseline.sql` in each provider dir |
| P-3 | Build the desktop app | `cd apps/desktop && npm run build` | Build succeeds; bundle under `src-tauri/target/release/bundle/` |

**Config reset** (to re-trigger onboarding between modes):
`rm -rf ~/Library/Application\ Support/vn.kael.ngocky/desktop-config.json ~/Library/Application\ Support/vn.kael.ngocky/ngocky.db`

---

## 1. Onboarding & Mode 1 (thin client)

| ID | Test Case | Steps | Expected |
| :--- | :--- | :--- | :--- |
| T-1 | First-launch onboarding | Reset config, launch app | Mode-chooser appears (Family server / Offline / Shared database); no sidecar spawned |
| T-2 | Thin mode connects to VPS | Choose **Family server**, keep default server URL, Continue | App relaunches → normal login against VPS, behaves as before |
| T-3 | Thin persists choice | Quit + relaunch | No onboarding; goes straight to login (config `mode: thin`) |
| T-4 | Browser unaffected | `npm run dev:web`, open in a browser | No onboarding gate; app works exactly as before (gate is Tauri-only) |

---

## 2. Mode 2 (single-user offline, SQLite)

| ID | Test Case | Steps | Expected |
| :--- | :--- | :--- | :--- |
| O-1 | Choose offline | Reset config, launch, choose **Offline (just me)**, (optional Telegram token), Continue | Relaunch → "Starting local server…" → setup wizard (fresh DB) |
| O-2 | Owner creation | Complete setup wizard, log in | Login succeeds against the local sidecar (`127.0.0.1:21473`) |
| O-3 | CRUD across enum/notification fields | Create a goal, an expense, a housework item (with a reminder) | All save without error (exercises enums + notification fields on SQLite) |
| O-4 | Persistence across restart | Quit fully, relaunch | Data still present; no onboarding; no setup wizard |
| O-5 | Truly offline | Disable Wi-Fi, use the app | Fully functional; no calls to the VPS |
| O-6 | DB file location | `ls ~/Library/Application\ Support/vn.kael.ngocky/ngocky.db` | File exists |

---

## 3. Mode 3 (thick client + shared Postgres)

Use a reachable Postgres (LAN or Supabase). For local testing: `postgresql://ngocky:ngocky_secret@localhost:5433/<dbname>` against the dev `ngocky-db` container.

| ID | Test Case | Steps | Expected |
| :--- | :--- | :--- | :--- |
| S-1 | Choose shared | Reset config, launch, choose **Shared database**, paste connection string, Continue | Validates `postgresql://` prefix; relaunch → "Starting local server…" |
| S-2 | Runtime migration on fresh DB | Point at an empty database | Sidecar applies baseline; setup wizard appears; `SELECT count(*) FROM "_app_migrations"` ≥ 1 |
| S-3 | Owner + data | Create owner, log in, create a goal | Goal row visible in Postgres (`SELECT title FROM "Goal"`) |
| S-4 | Persistence | Restart app | Data persists; migration is a **no-op** on 2nd boot (no new `_app_migrations` rows) |
| S-5 | Second client / idempotency | Launch on a second machine (or run a 2nd sidecar) against the same DB | Both work; no migration errors; a reminder fired on one client is cooldown-suppressed on the other (check `lastNotificationSentAt`) |
| S-6 | Bad connection string | Enter a non-`postgresql://` string | Inline error, config not saved |

---

## 4. Local scheduler & notifications (modes 2/3)

| ID | Test Case | Steps | Expected |
| :--- | :--- | :--- | :--- |
| N-1 | OS notification fires | Create a task with a reminder due now (ON_DATE, current time); wait ≤5 min (or restart app to trigger boot catch-up) | macOS notification banner appears with the item title |
| N-2 | Fired feed | With a JWT, `GET http://127.0.0.1:21473/api/notifications/recent` | Returns the fired notification(s) for the logged-in user |
| N-3 | Fire once | Leave the app running past another interval | The same reminder does **not** re-fire (cooldown / `lastNotificationSentAt`) |
| N-4 | Catch-up while asleep | Create a reminder due in the past hour, then quit + relaunch | Boot catch-up (24h lookback) fires it late (one notification) |
| N-5 | Telegram delivery (optional) | Set a Telegram bot token in onboarding + a `telegramChatId` on the user | A `🔔 <title>` message arrives in Telegram |
| N-6 | Notification permission | First notification on a fresh install | macOS prompts for notification permission; granting shows the banner |

---

## 5. Regression / sanity

| ID | Test Case | Command | Expected |
| :--- | :--- | :--- | :--- |
| R-1 | API test suite | `cd apps/api && npm test` | 88 passing |
| R-2 | Typecheck | `cd apps/api && npx tsc --noEmit` and `cd apps/web && npx tsc --noEmit` | No errors, both |
| R-3 | Web build | `cd apps/web && npm run build` | Builds clean |
| R-4 | Rust compiles | `cd apps/desktop/src-tauri && cargo check` | Finished, no errors |

---

## Notes / known limits

- Local scheduler only runs while the machine is awake; guaranteed delivery still needs mode 1 (always-on server). N-4 covers the catch-up mitigation.
- Scheduled **reports** (`due-reports`) are still n8n/VPS-only — not covered by the local scheduler.
- Email channel deferred; only OS notification + Telegram are wired.
