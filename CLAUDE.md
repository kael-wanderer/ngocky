# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands are run from the repo root unless noted.

### Development
```bash
npm run dev          # Start both API (port 3001) and web (port 5173) concurrently
npm run dev:api      # API only
npm run dev:web      # Web only
```

### Build
```bash
npm run build:api    # tsc compile API → dist/
npm run build:web    # tsc + vite build web → dist/
npm run lint         # tsc --noEmit for both apps (no ESLint/Prettier)
```

### Database
```bash
npm run db:generate   # prisma generate (after schema changes)
npm run db:migrate    # prisma migrate deploy (production)
npm run db:seed       # seed with owner account (from .env)
# Dev migration with name:
cd apps/api && npx prisma migrate dev --name <migration-name>
```

### Tests
```bash
cd apps/api && npm test         # vitest run (all tests)
cd apps/api && npx vitest run src/test/path/to/file.test.ts  # single test file
```
Tests run sequentially (`fileParallelism: false`) against a real database. No web-side tests exist.

### PM2 (production)
```bash
npm run pm2:start
npm run pm2:restart
npm run pm2:logs
npm run pm2:stop
```

### Docker
```bash
docker compose up -d            # Dev stack (api + web + postgres:16 on port 5433)
docker compose -f docker-compose.prod.yml up -d
```

## Architecture

### Monorepo Structure
npm workspaces: `apps/api` (Express backend) and `apps/web` (React frontend). No shared packages — types and utilities are duplicated across apps where needed.

### API (`apps/api`)
- **Entry:** `src/index.ts` connects DB, seeds owner, starts Express on port 3001
- **App setup:** `src/app.ts` — CORS, body parser (10mb), cookie parser, health check at `/api/health`, all routes mounted
- **Routes:** `src/routes/` — 23 route files, each maps to a module (goals, projects, expenses, assets, etc.)
- **Middleware:** `src/middleware/auth.ts` (JWT verify + role check), `validate.ts` (Zod), `errorHandler.ts`, `assistantAuth.ts` (n8n webhook key)
- **DB client:** singleton Prisma client at `src/config/database.ts`
- **Env:** `src/config/env.ts` — all env vars accessed through here, not `process.env` directly
- **Validators:** `src/validators/` — Zod schemas, imported into routes via `validate` middleware
- **Auth service:** `src/services/auth.ts` — login, refresh token rotation, TOTP MFA, seed owner

### Web (`apps/web`)
- **Entry:** `src/main.tsx` → `src/App.tsx` (React Router 7 routes + TanStack Query provider)
- **API calls:** `src/api/` — Axios client with base URL and auth interceptor; all mutations/queries go through TanStack Query
- **State:** Zustand in `src/stores/` for auth and UI state; server state via TanStack Query
- **Import alias:** `@/` maps to `src/` (configured in `vite.config.ts`)
- **Styling:** Tailwind CSS only; 3 themes (stored in settings, applied immediately)
- **Icons:** `lucide-react`
- **Dev proxy:** Vite proxies `/api` → `http://localhost:3001` (configurable via `PROXY_TARGET` env)

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
- PostgreSQL 16 via Prisma 6
- Schema: `apps/api/prisma/schema.prisma`
- After any schema change: `npm run db:generate` then create a migration
- Seed creates the OWNER user from env vars (`OWNER_EMAIL`, `OWNER_PASSWORD`, `OWNER_NAME`)

### CI/CD
GitHub Actions (`.github/workflows/deploy.yml`) triggers on push to `main`:
1. Builds Docker images → pushes to `ghcr.io`
2. SSH into VPS → writes `.env` from GitHub Secrets → pulls images → runs migrations → seeds → brings up containers

Web is served via nginx (SPA fallback, `/api` proxy). Caddy handles TLS termination on the VPS.

## Environment Variables

Copy `.env.example` to `.env` at the repo root. Key vars:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET`, `JWT_REFRESH_SECRET` — token signing
- `CORS_ORIGIN` — allowed origin for CORS
- `OWNER_EMAIL`, `OWNER_PASSWORD`, `OWNER_NAME` — seeded admin account
- `VITE_API_URL` — used at build time for production web bundle
- `ASSISTANT_API_KEY` — n8n webhook auth key
- `OPENAI_API_KEY` — AI assistant feature
