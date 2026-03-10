# NgốcKý – Family Record Management

A private family record management web app for managing goals, standalone tasks, project items, housework, calendars, expenses, assets, learning records, ideas, analytics, and notifications.

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
| Tasks | `GET/POST /api/tasks` | Standalone task CRUD |
| Check-ins | `POST /api/checkins` | Log check-ins |
| Projects | `GET/POST /api/projects` | Project CRUD |
| Assets | `GET/POST /api/assets` | Asset CRUD + maintenance |
| Learning | `GET/POST /api/learning/*` | Topics and histories |
| Ideas | `GET/POST /api/ideas/*` | Topics and logs |
| Housework | `GET/POST /api/housework` | Housework CRUD |
| Housework | `POST /api/housework/:id/complete` | Mark complete |
| Calendar | `GET/POST /api/calendar` | Event CRUD |
| Expenses | `GET/POST /api/expenses` | Expense CRUD |
| Analytics | `GET /api/reports/*` | Analytics chart data + CSV |
| Alerts | `GET/POST /api/alerts` | Notification rule CRUD |
| Scheduled Reports | `GET/POST /api/scheduled-reports` | Scheduled report CRUD |
| Service | `GET /api/service/due-notifications` | n8n reminder polling |
| Service | `GET /api/service/due-reports` | n8n scheduled report polling |
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

- Fetch due items needing notification: `GET /api/service/due-notifications`
- Get report data in JSON: `GET /api/reports/*`
- Export CSV: `GET /api/reports/export/tasks`, `GET /api/reports/export/expenses`

All endpoints require Bearer token authentication.

Reminder delivery rules:

- n8n is a poller, not the source of truth
- the backend decides whether an item is eligible to send
- reminders are only for **before** the deadline/start time
- overdue follow-up is handled separately in `Reports & Notifications`
- the reliable reminder mode today is `On Date`

Target reminder architecture:

- every reminder-enabled item should use a computed `notificationDate`
- `Days Before` should include a send-time value
- `On Date` must be validated to be before the deadline/start
- reminder spam should be prevented with persisted cooldown fields such as:
  - `lastNotificationSentAt`
  - `notificationCooldownHours` with default `24`

## Modules

- **Dashboard** – Summary cards, filters (`Today`, `This week`, `Next week`, `This month`, `Next month`, `Status`, `Category`), overdue feed for true due items, pinned items, and category-based panels (`Goal`, `Project`, `Task`, `Housework`, `Calendar`, `Expense`, `Assets`, `Learning`, `Ideas`)
- **Goals & Tasks** – Combined workspace with recurring goals, check-in tracking, standalone tasks, payment tasks, progress bars, repeat rules, sharing, and optional reminders
- **Projects** – Shared boards with kanban + list view, project item types (`Task`, `Bug`, `Feature`, `Story`, `Epic`), priorities, deadlines, assignees, drag-and-drop status updates, and per-item sharing
- **Housework** – Rule-based recurring housework (`One time`, `Daily`, `Weekly`, `Monthly`, `Quarterly`, `Half yearly`, `Yearly`) with explicit `Mark Complete`, grouped operational states, sharing, and optional reminders
- **Calendar** – Today/week/month views, color-coded events, optional repeat (`Daily`, `Weekly`, `Monthly`), shared visibility, participants, and optional pre-start reminders
- **Assets** – Asset registry with sharing, warranty tracking, maintenance records, linked maintenance calendar events, and reminder support
- **Expenses** – Filtered table with edit/delete actions, `type` (`Pay` / `Receive`), type-specific categories, scopes (`Personal`, `Family`, `Keo`, `Project`), sharing, sortable columns, and running totals in `VND`
- **Learning** – Topic-first learning management with shared topics, shared ownership display on histories, duplicate actions, and progress/deadline tracking
- **Ideas** – Topic-first idea capture with shared topics, shared ownership display on logs, duplicate actions, and category/status tracking
- **Analytics** – Charts and summaries for project items, standalone tasks, goals, calendar, housework, expenses, assets, learning, and ideas with time-aware filters
- **Reports & Notifications** – Alert rules, scheduled reports (`Weekly Summary`, `Next Week Tasks`, `Today Tasks`, `Tomorrow Tasks`), enable/disable controls, one-time schedules, and n8n delivery integration
- **Settings** – Profile, notifications, password change, TOTP MFA enrollment, and theme picker with immediate apply (`Blue Purple`, `Grey Black`, `Red Accent`, `Dark`, `Modern Green`, `Multi Color Block`)
- **User Management** – Admin-only user creation, role assignment, activate/deactivate

## Dashboard Filters

- **Time**: `TODAY`, `THIS_WEEK`, `NEXT_WEEK`, `THIS_MONTH`, `NEXT_MONTH`
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
- standalone Tasks
- Project boards
- Project items
- Housework items
- Calendar events
- Expenses
- Assets
- Learning topics
- Idea topics

Shared child records follow the shared state of their parent container:

- learning histories inherit topic sharing
- idea logs inherit topic sharing

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

## Recent Changes

Recent product updates include:

- project item type added with options `Task`, `Bug`, `Feature`, `Story`, `Epic`
- project page wording updated from `Task` to `Item` where needed to avoid confusion with standalone tasks
- analytics page renamed from `Reports` and expanded to cover `Project`, `Task`, `Goal`, `Calendar`, `Asset`, `Housework`, `Expenses`, `Learning`, and `Ideas`
- analytics filters now support time-aware filtering across all analytics modules, with tab-specific type/category/scope controls
- scheduled reports now support `Weekly Summary`, `Next Week Tasks`, `Today Tasks`, and `Tomorrow Tasks`
- report frequency `One Time` now runs as a true one-time job instead of a disabled `None` state
- reports and notifications now expose explicit enable/disable controls for notification rules and schedules
- alert rules are evaluated by `GET /api/service/due-notifications`, so n8n can deliver rule-based notifications without extra workflow branching
- shared ownership display is standardized: owners see `Shared`, non-owners see `Owner: <name>`
- shared visibility is now applied consistently across standalone tasks, projects, housework, assets, learning topics/histories, and idea topics/logs
- asset sharing, warranty tracking, and maintenance calendar sync are supported
- housework sharing is supported
- new user themes added: `Dark`, `Modern Green`, `Multi Color Block`

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
