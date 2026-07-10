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

Owners can also create new pages from four built-in templates:

- Task
- Project
- Expense
- Goal

Template pages are isolated from the built-in pages. For example, tasks created in a custom "Work Tasks" page do not appear in the default `/tasks` page, and default tasks do not appear in that custom page. Dashboards and reports currently aggregate across default and custom page data.

Per-user feature visibility still applies under the app-wide group gate. A route is visible only when its module group is enabled and the signed-in user has that feature enabled.

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
