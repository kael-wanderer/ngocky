# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Scripts live in the root `package.json` — read them there. Non-obvious bits only:

- **API tests:** `cd apps/api && npm test`. Single file: `cd apps/api && npx vitest run src/test/path/to/file.test.ts`. They run sequentially (`fileParallelism: false`) against a throwaway **SQLite** database (`prisma/test.db`, schema generated from `schema.prisma` by `src/test/setup.ts`), never the Postgres in `.env`. Run `npm run db:generate` once after `npm ci`.
- **Web tests:** `cd apps/web && npm test` (vitest + jsdom, files in `apps/web/src/test/`).
- **Typecheck:** `npm run lint` (it is `tsc --noEmit` for api and web; there is no ESLint). The API build fails on type errors.
- **Dev migration with a name:** `cd apps/api && npx prisma migrate dev --name <migration-name>` (the root `db:*` scripts only cover generate/deploy/seed).

## Architecture

### Monorepo Structure
npm workspaces. No shared packages — types and utilities are duplicated across apps where needed.

### Conventions

- **Env access:** all env vars go through `apps/api/src/config/env.ts`, never `process.env` directly.
- **Styling:** Tailwind CSS only. Themes are CSS-variable sets (the `Theme` enum in `schema.prisma`, about 15), stored per user and applied immediately. Use the theme variables (`var(--color-*)`), never Tailwind `dark:` variants.
- **Rich text:** render stored HTML only through `toRichTextHtml` (`apps/web/src/utils/richText.ts`), which sanitizes it.
- **Dates:** for a local `YYYY-MM-DD` use `toLocalDateInput` (`apps/web/src/utils/dates.ts`), not `toISOString()`.

### Shared Patterns

**Notification system** — All modules with reminders share `src/components/NotificationFields.tsx`:
```ts
import NotificationFields, { buildNotificationPayload, emptyNotification, loadNotificationState } from '../components/NotificationFields';
// Form init: spread ...emptyNotification
// Edit load: spread ...loadNotificationState(record)
// Submit: spread ...buildNotificationPayload(formState)
// UI: <NotificationFields form={form} setForm={setForm} />
```

**Route protection** — JWT in `Authorization: Bearer` header + httpOnly refresh cookie. Roles: `OWNER > ADMIN > USER`. `authenticate` then `authorize('OWNER', 'ADMIN')` (`apps/api/src/middleware/auth.ts`) handle it. Role checks are not enough: every per-user record needs an ownership check (`userId`, or `isShared` where sharing applies), and never pass `req.body` to Prisma without a Zod schema.

**Validation** — All API inputs validated with Zod via `validate(schema)` middleware before route handlers.

**VND currency** — Expenses use integer VND (no decimals). Format with `toLocaleString('vi-VN')`.

### Database
- After any schema change: `npm run db:generate` then create a migration.
- Seed creates the OWNER user from env vars (`OWNER_EMAIL`, `OWNER_PASSWORD`, `OWNER_NAME`).

## Environment Variables

Copy `.env.example` to `.env` at the repo root — it lists every var. Two whose purpose isn't obvious from the name:
- `ASSISTANT_API_KEY` — n8n auth key for `/api/assistant` and `/api/service`; random per start when unset
- `OPENAI_API_KEY` — AI assistant feature
