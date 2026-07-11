# NgocKy

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

NgocKy is a self-hosted family and personal productivity app. It includes goals, tasks, project boards, expenses, calendars, housework, assets, learning records, ideas, reports, notifications, and an optional Telegram assistant.

The app is white-label friendly: the first-run setup wizard lets you choose the app name, create the owner account, and enable the module groups you want.

## Preview

Screenshot coming soon.

## Quick Start

Prerequisites:

- Docker and Docker Compose

Start the app:

```bash
cp .env.example .env
docker compose up -d --build
```

Open <http://localhost:5173> and complete the setup wizard. Leave `OWNER_EMAIL` and `OWNER_PASSWORD` unset in `.env` to use the wizard. If you prefer automatic owner seeding, set `OWNER_EMAIL`, `OWNER_PASSWORD`, and optionally `OWNER_NAME` before starting the API.

By default, PostgreSQL is exposed on host port `5433` to avoid clashing with a local PostgreSQL install.
The web app is exposed on `WEB_PORT` (`5173` by default) and the API is exposed on `API_PORT` (`3001` by default).

## Modules And Pages

NgocKy has three top-level module groups:

- `Personal` is always enabled.
- `Family` can be enabled or disabled by the owner.
- `Hobby` can be enabled or disabled by the owner.

Owners and admins can manage custom pages from **Admin > Application Management**. The catalog currently contains these templates:

- Task
- Project
- Expense
- Goal
- Ideas
- Calendar
- Ca Keo (Child)
- Housework
- Assets
- Healthbook
- Keyboard
- Funds
- Learning

Template pages are isolated from built-in pages by `instanceId`. A custom page can be renamed without changing its slug, and deleting it shows a typed deletion preview before its root records and children are removed. Dashboard pinned records and report queries preserve the originating page `{id, name, slug}` so links can return to `/p/:slug`.

Per-user feature visibility still applies under the app-wide group gate. A route is visible only when its module group is enabled and the signed-in user has that feature enabled.

## Admin And Agent Providers

The owner can configure the assistant from **Admin > Agent Settings**. Credentials are encrypted at rest, write-only, and never returned to the browser. Supported providers are OpenAI, Anthropic Claude, and Custom OpenAI-compatible endpoints. Custom endpoints must be public HTTPS URLs unless `ALLOW_PRIVATE_AGENT_ENDPOINTS=true` is explicitly enabled for a trusted deployment.

The legacy `OPENAI_API_KEY` environment fallback and `/api/app-settings/openai-key` compatibility endpoints remain temporarily available for existing deployments. Move credentials to Agent Settings before removing those legacy fields in a future migration.

## Development

Prerequisites:

- Node.js 20+
- PostgreSQL 16+ or Docker

Install dependencies:

```bash
npm install
cp .env.example .env
```

Run database migrations and generate Prisma clients:

```bash
cd apps/api
npm run db:migrate:dev
npm run db:generate
```

Start the app:

```bash
# terminal 1
cd apps/api && npm run dev

# terminal 2
cd apps/web && npm run dev
```

Open <http://localhost:5173>.

## Tests

Backend:

```bash
cd apps/api
npm test
npx tsc --noEmit
```

Frontend:

```bash
cd apps/web
npm test
npx tsc --noEmit
npm run build
```

## Project Structure

```text
NgocKy/
├── apps/
│   ├── api/           # Express, Prisma, PostgreSQL
│   └── web/           # React, Vite, Tailwind CSS
├── docs/              # Project plans and notes
├── docker-compose.yml
├── .env.example
└── README.md
```

## Deployment Notes

For production, set strong values for:

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `DB_PASSWORD`
- `ASSISTANT_API_KEY`
- `CORS_ORIGIN`

Development can boot without JWT secrets; the API generates ephemeral secrets and prints a warning. Production still requires explicit secrets.

## License

NgocKy is released under the [MIT License](LICENSE).
