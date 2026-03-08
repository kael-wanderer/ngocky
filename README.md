# NgốcKý – Family Record Management

A private family record management web app for managing tasks, goals, housework, expenses, calendars, assets, learning records, and reports.

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

- **Dashboard** – Summary cards, filters (`Time`, `Status`, `Category`), overdue feed for true due items, and category-based panels (`Goal`, `Project`, `Task`, `Housework`, `Calendar`, `Expense`, `Assets`, `Learning`, `Pinned Items`)
- **Goals** – Recurring goals (weekly/monthly) with check-in tracking and progress bars
- **Projects** – Kanban board + list view with priorities, deadlines, assignees, drag-and-drop status updates, board edit/refresh, shared family boards, and per-task sharing
- **Housework** – Rule-based recurring housework (`One time`, `Daily`, `Weekly`, `Monthly`, `Quarterly`, `Half yearly`, `Yearly`) with explicit `Mark Complete` action and grouped states (`Overdue`, `Due Today`, `Upcoming`, `Unscheduled`)
- **Calendar** – Today/week/month views, color-coded events, optional repeat (`Daily`, `Weekly`, `Monthly`), and owner visibility
- **Expenses** – Filtered table with edit/delete actions, `type` (`Pay` / `Receive`), type-specific categories, expanded scopes (`Personal`, `Family`, `Keo`, `Project`), per-item sharing, sortable columns, and running totals for income, payment, and remaining fund in `VND`
- **Learning** – Topic-first learning management with shared topics and duplicate actions; topic histories are treated as records
- **Ideas** – Topic-first idea capture with shared topics and duplicate actions; idea logs are treated as records
- **Reports** – Charts (bar, pie) for tasks, goals, housework, expenses, learning, and ideas
- **Scheduled Action** – Rule management with edit/duplicate support and scheduled reports
- **Settings** – Profile, notifications, theme picker (3 themes) with immediate apply, password change
- **User Management** – Admin-only user creation, role assignment, activate/deactivate

## Dashboard Filters

- **Time**: `THIS_WEEK`, `NEXT_WEEK`, `THIS_MONTH`, `NEXT_MONTH`
- **Status**:
  - `PENDING`: not completed yet in selected range
  - `COMPLETED`: completed items in selected range (where lifecycle supports completion state)
  - `OVERDUE`: items with due/deadline date before today
- **Category** (multi-select): `goal`, `project`, `housework`, `calendar`, `expense`, `assets`, `learning`

## Item Semantics

NgốcKý now treats items in three groups:

- **Deadline items**: can participate in `Pending`, `Completed`, and `Overdue`
  - `ProjectTask.deadline`
  - `HouseworkItem.nextDueDate`
- **Events**: scheduled on a date/time, but not treated as pending/completed/overdue
  - `CalendarEvent.startDate`
- **Records**: logged on a date, but not treated as pending/completed/overdue
  - `Expense.date`
  - `MaintenanceRecord.serviceDate`
  - `LearningItem.createdAt`
  - `Idea.createdAt`

Dashboard overdue feed only includes true deadline items:

- `ProjectTask.deadline`
- `HouseworkItem.nextDueDate`

Calendar events and record-style items are still shown by selected time range, but the status filter does not classify them as `Pending`, `Completed`, or `Overdue`.

## Sharing Logic

Shared visibility uses the same basic rule across modules:

- If `isShared = true`, the item is visible to all users.
- If `isShared = false`, the item is visible only to the owner/creator unless module-specific board sharing also grants access.

Current shared modules include:

- Goals
- Project boards
- Project tasks
- Calendar events
- Expenses
- Assets
- Learning topics
- Idea topics

Operational note:

- The checkbox reflects the true saved state.
- Checked means shared is enabled.
- Unchecked means the item is private.

## Local Dev With VPS API

- In the current development setup, localhost web may be configured to read the VPS API (and therefore the VPS database) instead of a local API/database.
- In that mode, backend changes such as overdue logic do not appear in localhost web until the VPS API has been deployed/restarted.
- Restarting only the local Vite server does not change backend behavior when the frontend is still pointed at the VPS API.

## Expense Type Categories

- `RECEIVE`: `Salary`, `Top-up`, `Sell`
- `PAY`: `Food`, `Utilities`, `Healthcare`, `Shopping`, `Transport`, `Home Maintenance`, `Education`, `AI`, `Entertainment`, `Other`

## 2026-03-08 Changes

Today’s updates include:

- browser/tab branding updated to `NgốcKý - Family record management`
- project type added: `Personal`, `Work`, `For Fun`, `Study`
- calendar repeat added: `Daily`, `Weekly`, `Monthly`, with end repeat `Never` or `On date`
- asset warranty months and asset sharing added
- expense time presets added: `Last quarter`, `Last month`, `This month`, `This quarter`, `Custom`
- learning topics and idea topics now support sharing plus duplicate actions for topic/log entries
- reports now support time range plus expense filters
- user management now supports delete and reset password with role restrictions
- scheduled action section renamed from `Alerts`
- dashboard logic updated so events and records are not treated as overdue/deadline items

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
