# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Scripts live in the root `package.json` — read them there. Non-obvious bits only:

- **Tests:** `cd apps/api && npm test`. Single file: `cd apps/api && npx vitest run src/test/path/to/file.test.ts`. Tests run sequentially (`fileParallelism: false`) against a **real database**. No web-side tests exist.
- **Dev migration with a name:** `cd apps/api && npx prisma migrate dev --name <migration-name>` (the root `db:*` scripts only cover generate/deploy/seed).

## Architecture

### Monorepo Structure
npm workspaces. No shared packages — types and utilities are duplicated across apps where needed.

### Conventions

- **Env access:** all env vars go through `apps/api/src/config/env.ts`, never `process.env` directly.
- **Styling:** Tailwind CSS only; 3 themes (stored in settings, applied immediately).

### Shared Patterns

**Notification system** — All modules with reminders share `src/components/NotificationFields.tsx`:
```ts
import NotificationFields, { buildNotificationPayload, emptyNotification, loadNotificationState } from '../components/NotificationFields';
// Form init: spread ...emptyNotification
// Edit load: spread ...loadNotificationState(record)
// Submit: spread ...buildNotificationPayload(formState)
// UI: <NotificationFields form={form} setForm={setForm} />
```

**Route protection** — JWT in `Authorization: Bearer` header + httpOnly refresh cookie. Roles: `OWNER > ADMIN > USER`. The `requireRole` middleware handles authorization.

**Validation** — All API inputs validated with Zod via `validate(schema)` middleware before route handlers.

**VND currency** — Expenses use integer VND (no decimals). Format with `toLocaleString('vi-VN')`.

### Database
- After any schema change: `npm run db:generate` then create a migration.
- Seed creates the OWNER user from env vars (`OWNER_EMAIL`, `OWNER_PASSWORD`, `OWNER_NAME`).

## Environment Variables

Copy `.env.example` to `.env` at the repo root — it lists every var. Two whose purpose isn't obvious from the name:
- `ASSISTANT_API_KEY` — n8n webhook auth key
- `OPENAI_API_KEY` — AI assistant feature
