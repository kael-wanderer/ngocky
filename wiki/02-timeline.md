# Timeline

Dated milestones, most-recent-relevant first. Dates are from `docs/CHANGELOG.md`.

## 2026-03 — Phase 2: core enhancements & expansion (current)
Heaviest period of feature growth. Highlights:
- **Auth & security:** TOTP MFA (QR + manual key enrollment), hardened refresh cookies,
  cleaner 401 handling that no longer causes redirect loops on failed login.
- **Goals & Tasks split:** Goals and standalone Tasks became separate pages; clearer
  Task vs Event vs Expense semantics.
- **Projects:** two-level Kanban, board + per-task sharing, drag-and-drop status moves.
- **Expenses:** `PAY`/`RECEIVE` types, VND display, shorthand input (`82M`, `600k`),
  income/payment/remaining-fund split, per-column sort, pagination.
- **New family/hobby modules:** Ca Keo (kids tracker), Keyboard, Funds, Healthbook.
- **Records refactor:** Learning, Ideas, Assets reworked into topic → log/history shape.
- **Notifications overhaul:** shared `NotificationFields` component across all modules;
  Notifications vs Scheduled Reports split into separate pages.
- **Reminder model:** pre-deadline reminders with `notificationDate`,
  `lastNotificationSentAt`, and a cooldown to prevent poll-cycle spam.
- **Dashboard/Analytics:** time/status/category filters, status buckets, broad chart coverage.
- **Navigation:** grouped sidebar (Dashboard / Personal / Family / Hobby / Settings / Admin)
  with per-user feature flags and persisted collapse state.
- **Theming:** 3 themes that apply immediately on save.
- **Telegram assistant:** create/update/query across tasks, projects, calendar, expenses,
  goals, housework; one-time `/link <code>` identity binding.

## 2026-03-03 — Initial VPS deployment
First production deploy: Docker images via GitHub Actions → GHCR → VPS, Caddy for TLS,
PostgreSQL 16, owner account seeded from env.

## In progress / next (from `docs/IMPLEMENTATION_PLAN.md`)
- **Goals & Tasks workspace:** finish the tabbed `Goals & Tasks` layout.
- **Scheduled payment workflow:** payment Task → auto-create Expense on completion (idempotent link).
- **Asset → Calendar automation:** `nextRecommendedDate` creates/syncs a calendar reminder.
- **Calendar UX:** Google-Calendar-style Today timeline + week grid; shared user colors.
- **Analytics:** Ca Keo analytics still planned.

## On-hold / restart log
_No on-hold periods recorded yet. If work pauses, log the date, why, and the resume
pointer here — then read [lessons.md](lessons.md) before picking it back up._

## Read next
- [Architecture](03-architecture.md)
- [Lessons](lessons.md)
