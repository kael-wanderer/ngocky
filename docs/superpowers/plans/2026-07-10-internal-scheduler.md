# Internal Scheduler (n8n Replacement) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three n8n workflows with in-process services so the app is self-contained — required for the macOS desktop app, and removes the n8n dependency for open-source server users.

**Architecture:** The n8n workflows are thin: cron → GET `/api/service/due-notifications` / `due-reports` → format (code nodes) → send via Telegram bot API / SMTP → POST back "sent". We move that loop inside the API: a `node-cron`-free `setInterval` scheduler calls the same service functions directly and sends via small Telegram/email sender modules. The Telegram assistant (workflow 3, webhook-based) gets a long-polling alternative (`getUpdates`) for machines without a public URL. Everything is env-gated so your VPS can keep using n8n untouched until you flip the switch.

**Tech Stack:** Existing Express/Prisma. New dep: `nodemailer` (SMTP). Telegram via plain `fetch` (Node 20 global). No cron library — `setInterval` is enough for a 15-minute tick (`// ponytail: setInterval tick, upgrade to node-cron if users need cron expressions`).

## Global Constraints

- **Default off.** `SCHEDULER_ENABLED` and `TELEGRAM_POLLING` default to `false`. Existing VPS deployment with n8n keeps working with zero behavior change. Double-send protection: user enables either n8n or the internal scheduler, never both — say so in README.
- **Do not break the `/api/service/*` routes** — n8n still calls them until decommissioned. Extract logic into services; routes become thin wrappers.
- The exact message formatting lives in the n8n **code nodes** — read `n8n/workflows/1.NgocKy-send-notification-v1.1.json` and `2.NgocKy-Schedule-Actionn-v1.1.json`, find the `code` nodes (`Split Notifications`, `Format Notification`, `Split Reports`, `Format Messages`), and port their JS bodies faithfully. Telegram messages use MarkdownV2 — keep the escaping.
- All env access through `src/config/env.ts`. New vars all optional: `SCHEDULER_ENABLED`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_POLLING`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
- `schema.test.prisma` is auto-generated — never edit. Use `iContains()` for any case-insensitive contains.
- Tests in `apps/api/src/test/`, run `cd apps/api && npm test`. Suite is 32/32 green — keep it green. Commit per task, `feat:` prefix.
- Work on a branch; do not push to `main` (auto-deploys to VPS).

---

### Task 1: Extract due-notification and due-report logic into services

**Files:**
- Create: `apps/api/src/services/scheduler/dueItems.ts`
- Modify: `apps/api/src/routes/service.ts`

**Interfaces:**
- Produces:
  - `getDueNotifications(): Promise<DueNotification[]>` — exact logic currently inside `GET /api/service/due-notifications` (routes/service.ts:536), including the user notification-settings join.
  - `markNotificationsSent(items: SentMarker[]): Promise<void>` — logic from `POST /api/service/due-notifications/sent` (routes/service.ts:873).
  - `getDueReports(): Promise<DueReport[]>` — from `GET /api/service/due-reports` (routes/service.ts:18).
  - `getReportData(reportId: string): Promise<ReportData>` — from `GET /api/service/report-data/:reportId` (routes/service.ts:87).
  - Type shapes: whatever those handlers currently `res.json()` — lift the payload construction verbatim into the service functions and type them from usage.

**Steps:**

- [ ] **Step 1:** Move the handler bodies into the four exported functions. Routes call the functions and `sendSuccess(res, ...)` the result — responses byte-identical to today.
- [ ] **Step 2:** Run `npm test` — the existing `service-notifications.test.ts` must still pass unchanged (it exercises the routes).
- [ ] **Step 3:** Commit `feat: extract scheduler due-item services from service routes`

### Task 2: Telegram + email senders

**Files:**
- Create: `apps/api/src/services/scheduler/senders.ts`
- Modify: `apps/api/src/config/env.ts` (add optional vars listed in Global Constraints), `.env.example`
- Test: `apps/api/src/test/scheduler-senders.test.ts`

**Interfaces:**
- Produces:
  - `sendTelegram(chatId: string, text: string): Promise<boolean>` — POST `https://api.telegram.org/bot${TELegram token}/sendMessage` with `{ chat_id, text, parse_mode: 'MarkdownV2' }` via global `fetch`. Returns false (and `console.error`s) on failure instead of throwing — one dead chat must not kill the batch.
  - `sendEmail(to: string, subject: string, html: string): Promise<boolean>` — nodemailer transport from SMTP_* env; returns false if SMTP unconfigured.
  - `telegramConfigured(): boolean`, `emailConfigured(): boolean`.

**Steps:**

- [ ] **Step 1:** `cd apps/api && npm install nodemailer && npm install -D @types/nodemailer`
- [ ] **Step 2:** Implement senders. Unit test with `vi.stubGlobal('fetch', vi.fn())`: telegram called with right URL/body; returns false on non-ok response; `sendEmail` returns false when SMTP env missing.
- [ ] **Step 3:** `npm test` green. Commit `feat: telegram and email senders`

### Task 3: Notification + report jobs (port the n8n code nodes)

**Files:**
- Create: `apps/api/src/services/scheduler/jobs.ts`
- Test: `apps/api/src/test/scheduler-jobs.test.ts`

**Interfaces:**
- Consumes: Task 1 functions, Task 2 senders.
- Produces: `runNotificationJob(): Promise<{ sent: number; failed: number }>`, `runReportJob(): Promise<{ sent: number; failed: number }>`.

**Steps:**

- [ ] **Step 1:** Port formatting from the n8n code nodes (see Global Constraints). Flow per item: format message → pick channel from the user's `notificationChannel` (TELEGRAM needs `telegramChatId`; EMAIL needs `notificationEmail`, falling back per current n8n `if` nodes — read them) → send → collect successfully sent items → `markNotificationsSent(...)`. Reports: for each due report, `getReportData(id)`, format, send to its recipients, then mark sent the way n8n does today (check workflow 2's final HTTP node; if it only relies on `lastRunAt` via the due query, replicate exactly).
- [ ] **Step 2:** Tests: seed a due AlertRule + user with telegram channel (copy the seeding style from `service-notifications.test.ts`), stub fetch, run `runNotificationJob()`, assert one send + item marked sent + second run sends nothing.
- [ ] **Step 3:** `npm test` green. Commit `feat: in-process notification and report jobs`

### Task 4: Scheduler loop + boot wiring

**Files:**
- Create: `apps/api/src/services/scheduler/index.ts`
- Modify: `apps/api/src/index.ts`

**Interfaces:**
- Produces: `startScheduler(): { stop(): void }` — immediate first run after 30s (let boot settle), then every 15 minutes; each tick runs both jobs inside try/catch with `console.error` (a failing tick never crashes the process, and overlapping runs are skipped with an `isRunning` flag).
- Consumes: called from `index.ts` main/`startServer` when `config.SCHEDULER_ENABLED === 'true'`.

**Steps:**

- [ ] **Step 1:** Implement + wire. Log one line per tick: `⏰ scheduler: notifications sent=N failed=M, reports sent=N failed=M`.
- [ ] **Step 2:** Manual verify: `SCHEDULER_ENABLED=true` + test bot token against dev DB, watch a due notification arrive in Telegram.
- [ ] **Step 3:** Commit `feat: internal 15-minute scheduler loop`

### Task 5: Telegram assistant long-polling (replaces workflow 3 for desktop)

**Files:**
- Create: `apps/api/src/services/scheduler/telegramPolling.ts`
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/src/test/telegram-polling.test.ts`

**Interfaces:**
- Consumes: the same assistant pipeline the webhook route uses — read `apps/api/src/routes/assistant.ts` `POST /telegram/message` handler and call the underlying service function directly (extract one if the logic is inline, same pattern as Task 1).
- Produces: `startTelegramPolling(): { stop(): void }` — long-poll `getUpdates` (`timeout=30`, tracking `offset`), for each message: extract chatId/userId/username/text exactly as workflow 3's `extract_user_message` code node does, run the assistant pipeline, `sendTelegram(chatId, reply)`. Gated by `TELEGRAM_POLLING === 'true'` + bot token present. Never run polling and the n8n webhook simultaneously (Telegram rejects getUpdates while a webhook is set — log a clear error explaining `deleteWebhook`).

**Steps:**

- [ ] **Step 1:** Implement; wire into `index.ts` behind the env gate.
- [ ] **Step 2:** Test: stub fetch to return one fake update, assert assistant called and reply sent with right chat_id, offset advances.
- [ ] **Step 3:** Manual verify with a test bot: message the bot, get an assistant reply, no n8n involved.
- [ ] **Step 4:** Commit `feat: telegram assistant long-polling mode`

### Task 6: Docs + desktop plan hookup

**Files:**
- Modify: `README.md`, `docs/superpowers/plans/2026-07-10-macos-app.md`

**Steps:**

- [ ] **Step 1:** README section "Notifications & assistant without n8n": set `SCHEDULER_ENABLED=true` (+ SMTP/Telegram vars), or keep n8n and leave it false — never both. n8n workflows stay in `n8n/workflows/` for those who prefer them.
- [ ] **Step 2:** In the macOS plan's Electron `main.ts` env block, add `SCHEDULER_ENABLED: 'true'` and `TELEGRAM_POLLING: 'true'` (polling only matters when a bot token is configured). Update the plan's "Known ceilings" list: reminders now work while the app is open; still nothing fires when the app is closed (that's inherent to a local app — note `launchd` background agent as a future option).
- [ ] **Step 3:** Commit `docs: internal scheduler usage and desktop wiring`
