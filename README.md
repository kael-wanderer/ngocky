# NgốcKý – Family Productivity App

A private family productivity web app for managing tasks, goals, housework, expenses, calendars, and reports.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, TanStack Query, Zustand, Recharts |
| Backend | Node.js, Express, TypeScript, Prisma ORM, Zod |
| Database | PostgreSQL 16 |
| Infra | Docker, Docker Compose, GitHub Actions, Caddy |

## Quick Start (Development)

### Prerequisites

- Node.js 20+
- PostgreSQL (local or remote)

### 1. Clone and install

```bash
git clone <repo-url> NgocKy && cd NgocKy
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your database URL and secrets
```

### 3. Setup database

```bash
cd apps/api
npx prisma migrate dev --name init
npx prisma generate
npm run db:seed          # Creates owner + sample data
```

### 4. Start development

```bash
# Terminal 1: Backend
cd apps/api && npm run dev

# Terminal 2: Frontend
cd apps/web && npm run dev
```

Open <http://localhost:5173>

### Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Owner | <owner@ngocky.local> | ChangeMe123! |
| Admin | <admin@ngocky.local> | Admin123! |
| User | <user@ngocky.local> | User1234! |

## Production Deployment

### Docker Compose

```bash
# On VPS at /opt/ngocky
cp .env.example .env
# Edit .env for production values

docker compose up -d --build
```

### Caddy Config

Add to your Caddyfile:

```
ngocky.kael.io.vn {
    reverse_proxy ngocky-web:80
}
```

### GitHub Actions Secrets

Set these in your repo settings:

| Secret | Description |
|--------|-------------|
| `VPS_HOST` | VPS IP address |
| `VPS_USER` | SSH username |
| `VPS_SSH_KEY` | SSH private key |

## Project Structure

```
NgocKy/
├── apps/
│   ├── api/           # Express backend
│   │   ├── prisma/    # Schema, migrations, seed
│   │   └── src/       # Routes, services, middleware
│   └── web/           # React frontend
│       └── src/       # Pages, components, stores
├── docker-compose.yml
├── .github/workflows/deploy.yml
└── .env.example
```

## API Routes

| Group | Endpoint | Description |
|-------|----------|-------------|
| Auth | `POST /api/auth/login` | Login with JWT |
| Auth | `POST /api/auth/refresh` | Refresh token |
| Auth | `GET /api/auth/me` | Current user |
| Users | `GET/POST /api/users` | User management |
| Dashboard | `GET /api/dashboard` | Summary data (`timeRange`, `status`) |
| Goals | `GET/POST /api/goals` | Goal CRUD |
| Check-ins | `POST /api/checkins` | Log check-ins |
| Projects | `GET/POST /api/projects` | Project CRUD |
| Housework | `GET/POST /api/housework` | Housework CRUD |
| Housework | `POST /api/housework/:id/complete` | Mark complete |
| Calendar | `GET/POST /api/calendar` | Event CRUD |
| Expenses | `GET/POST /api/expenses` | Expense CRUD |
| Reports | `GET /api/reports/*` | Report data + CSV |
| Reports | `GET /api/reports/notifications/due-items` | n8n integration |
| Settings | `GET/PATCH /api/settings/profile` | Profile settings |

## Architecture Decisions

1. **Monorepo with npm workspaces** – Simple, no extra tooling needed
2. **JWT + refresh token rotation** – Secure auth without session storage
3. **Prisma ORM** – Type-safe database access with migrations
4. **CSS custom properties for theming** – Theme switching without rebuilding
5. **TanStack Query** – Server state management with caching
6. **Zustand** – Lightweight client state (auth only)
7. **Docker multi-stage builds** – Small production images
8. **nginx for frontend** – Fast static serving with SPA fallback + API proxy

## n8n Integration

The API exposes endpoints for n8n to:

- Fetch due items needing notification: `GET /api/reports/notifications/due-items`
- Get report data in JSON: `GET /api/reports/*`
- Export CSV: `GET /api/reports/export/tasks`, `GET /api/reports/export/expenses`

All endpoints require Bearer token authentication.

## Modules

- **Dashboard** – Summary cards, filters (`Time`, `Status`, `Category`), overdue feed, and category-based panels (`Goal`, `Project`, `Task`, `Housework`, `Calendar`, `Expense`, `Assets`, `Learning`, `Pinned Items`)
- **Goals** – Recurring goals (weekly/monthly) with check-in tracking and progress bars
- **Projects** – Kanban board + list view with priorities, deadlines, assignees, drag-and-drop status updates, board edit/refresh, and shared family boards
- **Housework** – Rule-based recurring housework (`One time`, `Daily`, `Weekly`, `Monthly`, `Quarterly`, `Half yearly`, `Yearly`) with explicit `Mark Complete` action and grouped states (`Overdue`, `Due Today`, `Upcoming`, `Unscheduled`)
- **Calendar** – Month view with event dots, day detail panel, color-coded events
- **Expenses** – Filtered table with category/scope/date filters and totals displayed in `VND`
- **Reports** – Charts (bar, pie) for tasks, goals, housework, and expenses
- **Settings** – Profile, notifications, theme picker (3 themes), password change
- **User Management** – Admin-only user creation, role assignment, activate/deactivate

## Dashboard Filters

- **Time**: `THIS_WEEK`, `NEXT_WEEK`, `THIS_MONTH`, `NEXT_MONTH`
- **Status**:
  - `PENDING`: not completed yet in selected range
  - `COMPLETED`: completed items in selected range (where lifecycle supports completion state)
  - `OVERDUE`: items with due/deadline date before now
- **Category** (multi-select): `goal`, `project`, `housework`, `calendar`, `expense`, `assets`, `learning`

## Overdue Scope

Dashboard overdue feed currently includes modules with due/deadline fields:

- `ProjectTask.deadline`
- `HouseworkItem.nextDueDate`
- `LearningItem.deadline`
- `MaintenanceRecord.nextRecommendedDate`
- `CalendarEvent.startDate` (missed start time)

Expense overdue is not computed separately because current schema has payment date only (`Expense.date`), not a dedicated unpaid due date field.

## Project Sharing Rules

- Boards support `isShared` toggle ("Share with all family users").
- Shared boards are visible to all users.
- Shared boards allow all users to read board details and create/edit/reorder/delete tasks.
- Board deletion is owner-only, even when board is shared.

## Project Sharing Verification Checklist

1. Login as board owner and create/edit a board with `isShared = true`.
2. Login as another user and verify the shared board appears in `/projects`.
3. As non-owner, create and update a task in the shared board.
4. As non-owner, verify board delete action is not available/forbidden.
5. As owner, verify board delete still works.
