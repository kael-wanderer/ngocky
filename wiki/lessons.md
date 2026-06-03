# Lessons — read this first if I restart in a year

Gotchas and hard-won context that aren't obvious from the code.

## Deploy & environment
- **Localhost web can read the VPS API/DB.** In that setup, backend code changes only
  become visible locally **after a VPS deploy**. If a backend fix "doesn't work" locally,
  check whether the web is pointed at the VPS API before debugging further.
- **`.env` is generated on the VPS at deploy time** from GitHub Secrets — it is not in the
  repo. To change a prod env var, change the GitHub Secret, not a local file.
- Migrations run automatically during deploy (`prisma migrate deploy`), then the owner is
  re-seeded. After any schema change: `npm run db:generate` then create a migration.

## Auth
- Refresh logic **must** skip `/auth/login|logout|refresh`. Earlier, a failed login looked
  like an instant sign-out because the 401 refresh interceptor fired on the login call itself.
- Access token in `localStorage`, refresh token in HTTP-only cookie on `/api/auth`. Don't
  move the refresh token to localStorage "for convenience" — that reopens an XSS hole.

## Reminders (the part most likely to break silently)
- The **API/DB is the source of truth**, not n8n. n8n just polls (~15 min) and delivers.
- Spam prevention depends on three fields per item: `notificationDate`,
  `lastNotificationSentAt`, `notificationCooldownHours` (default 24). A reminder fires only
  when the item is active, `now` is between `notificationDate` and the deadline, and the
  cooldown window has passed. Break any of these and you get either silence or spam.
- Reminders are **pre-deadline only**. Post-deadline nagging is a separate Reports &
  Notifications concern — don't merge the two.

## Cross-module automation
- Derived records (payment Task → Expense, Maintenance → Expense/Calendar, Fund → Keyboard)
  are currently **one-way on create**, not full bidirectional sync. Editing/deleting the
  source does **not** yet update the derived record. Don't assume sync exists.
- Always store the link between source and derived record so completion is idempotent —
  otherwise you get duplicate expenses/events.

## Money & input
- All money is **integer VND, no decimals**. Shorthand input (`600k`, `82M`, `7.8M`) is
  parsed to numeric VND on save. Format display with `toLocaleString('vi-VN')`.

## Sharing
- `isShared = true` means *visible to all*, **not** *editable by all*. Non-owners are
  view-only unless a module explicitly supports collaborative editing. Don't conflate
  visibility with permission.

## Architecture habits
- No shared package in the monorepo — types/utils are intentionally duplicated across
  `apps/api` and `apps/web`. Don't introduce a shared package abstraction for its own sake.
- Env vars are accessed through `src/config/env.ts`, never `process.env` directly.
- Notification UI everywhere uses the shared `apps/web/src/components/NotificationFields.tsx`
  helpers (`emptyNotification`, `loadNotificationState`, `buildNotificationPayload`). Reuse
  it instead of hand-rolling reminder fields per page.

## Where to look next
- [Architecture](03-architecture.md) for the system map and flows.
- `docs/CHANGELOG.md` for the authoritative dated history.
- `docs/DESIGN.md` for full module-by-module behavior (the deepest source).
