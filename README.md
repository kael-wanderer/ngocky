# NgốcKý – Family Record Management

A private family record management web app for managing goals, standalone tasks, project tasks, housework, calendars, expenses, assets, learning records, ideas, keyboard collections, hobby funds, analytics, notifications, a Telegram assistant, and per-user feature-based navigation.

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
| Funds | `GET/POST /api/funds` | Hobby fund transaction CRUD |
| Keyboard | `GET/POST /api/keyboards` | Keyboard collection CRUD |
| Ca Keo | `GET/POST /api/cakeos` | Ca Keo task CRUD |
| Ca Keo | `GET /api/cakeos/users` | List all users for assigner dropdown |
| Analytics | `GET /api/reports/*` | Analytics chart data + CSV |
| Alerts | `GET/POST /api/alerts` | Notification rule CRUD |
| Scheduled Reports | `GET/POST /api/scheduled-reports` | Scheduled report CRUD |
| Service | `GET /api/service/due-notifications` | n8n reminder polling |
| Service | `GET /api/service/due-reports` | n8n scheduled report polling |
| Settings | `GET/PATCH /api/settings/profile` | Profile settings |
| Assistant | `POST /api/assistant/telegram/message` | Telegram assistant inbound message |
| Assistant | `POST /api/assistant/link-code` | Generate Telegram link code |
| Assistant | `GET /api/assistant/link-status` | Telegram link status |
| Assistant | `DELETE /api/assistant/telegram/link` | Revoke Telegram link |

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

## Telegram Assistant

NgocKy includes a Telegram assistant as a chat-first entry point into existing modules.

Current scope:

- create standalone tasks
- mark standalone tasks done or reopen them
- update project task status
- query projects and project tasks
- query calendar events using natural-language time ranges
- query personal tasks such as `today`, `tomorrow`, and `this week`
- log quick expenses and query expense history
- log goal check-ins and query goal progress
- query housework items and mark them done

Operating rules:

- Telegram is only the chat UI
- n8n handles webhook transport/orchestration
- NgocKy API remains the source of truth for identity, validation, execution, and audit logging
- low-confidence or ambiguous write actions use confirmation/disambiguation instead of blind execution
- only linked Telegram users can execute assistant actions

Account linking:

- user generates a one-time link code from `User Settings > Assistant`
- user sends `/link <code>` to the Telegram bot
- link codes expire after 15 minutes
- one Telegram chat can only be linked to one NgocKy user

## Modules

- **Dashboard** – Summary cards, filters (`Today`, `This week`, `Next week`, `This month`, `Next month`, `Status`, `Category`), overdue feed for true due items, pinned items, and category-based panels (`Goal`, `Project`, `Task`, `Housework`, `Calendar`, `Expense`, `Assets`, `Learning`, `Ideas`)
- **Goals** – Recurring goals with check-in tracking, progress bars, reset periods (`Weekly`, `Monthly`, `Quarterly`), sharing, dashboard pinning, drag reorder, and optional reminders
- **Tasks** – Standalone tasks with repeat rules (`Daily`, `Weekly`, `Monthly`, `Quarterly`), payment-task support, sharing, dashboard pinning, drag reorder, and optional reminders
- **Projects** – Shared boards with kanban + list view, project task types (`Task`, `Bug`, `Feature`, `Story`, `Epic`), priorities, deadlines, assignees, drag-and-drop status updates, and per-item sharing
- **Housework** – Rule-based recurring housework (`One time`, `Daily`, `Weekly`, `Monthly`, `Quarterly`, `Half yearly`, `Yearly`) with explicit `Mark Complete`, grouped operational states, sharing, and optional reminders
- **Calendar** – Today/week/month views, color-coded events, optional repeat (`Daily`, `Weekly`, `Monthly`, `Quarterly`), shared visibility, participants, and optional pre-start reminders
- **Assets** – Home appliance/device registry with sharing, warranty tracking, maintenance records, linked maintenance calendar events, reminder support, and automatic expense creation when a maintenance log includes cost
- **Expenses** – Filtered table with edit/delete actions, `type` (`Pay` / `Receive`), type-specific categories, scopes (`Personal`, `Family`, `Keo`, `Project`), sharing, sortable columns, running totals in `VND`, shorthand amount input such as `600k` and `82M`, and pagination with page size options `25`, `50`, `100`
- **Learning** – Topic-first learning management with shared topics, topic categories (`Soft-skill`, `Expertise`, `AI`, `Other`), shared ownership display on histories, duplicate actions, and progress/deadline tracking
- **Ideas** – Topic-first idea capture with shared topics, shared ownership display on logs, duplicate actions, and category/status tracking
- **Ca Keo** – Kid task/calendar tracker with three views: Calendar (monthly grid), List (table with per-person pending/done stats), and Kanban (columns: Todo, In Progress, Done, Cancelled); fields include Title, Category (School/Activity/Medical/Entertainment/Home/Other), Status, Assigner (dynamic from DB users), Start/End date+time, Description, Color, Show on main Calendar flag, and optional notifications; Ca Keo items marked "Show on main Calendar" appear on the main Calendar page with a pink Ca Keo badge
- **Keyboard** – Keyboard collection table with category/tag/color/spec/extras/condition/price metadata, alternating row striping, sortable columns, always-visible filters, CSV import, pagination, and double-click edit
- **Funds** – Hobby transaction ledger with fields `Description`, `Type` (`Buy`, `Sell`, `Top-up`), `Scope` (`Mechanical keyboard`, `Play Station`), `Category` (`Keycap`, `Kit`, `Shipping`, `Accessories`, `Other`), `Condition`, `Date`, and `Amount`; supports CSV import, pagination, shorthand amount input such as `600k` and `82M`, and keyboard-linked `Buy`/`Sell` automation
- **Assistant** – Telegram-based assistant for quick task actions, calendar queries, expense logging, goal check-ins, housework updates, and project/project-task lookup with confirmation/disambiguation for ambiguous writes
- **Analytics** – Charts and summaries for project items, standalone tasks, goals, calendar, housework, expenses, assets, learning, and ideas with time-aware filters
- **Notifications** – Rule-based notification settings with drag reorder, double-click-to-edit, and schedule-time based due logic
- **Scheduled Reports** – Scheduled report management with drag reorder, double-click-to-edit, report types `Weekly Summary`, `Next Week Tasks`, `Today Tasks`, and `Tomorrow Tasks`, and schedule frequencies including `One Time`, `Daily`, `Weekly`, `Monthly`, and `Quarterly`
- **Settings** – Profile, Features, notifications, Assistant link management, password change, TOTP MFA enrollment, and theme picker with immediate apply (`Blue Purple`, `Grey Black`, `Red Accent`, `Dark`, `Modern Green`, `Multi Color Block`); profile/notification fields use explicit Save buttons
- **User Management** – Admin-only user creation, role assignment, activate/deactivate
- **Navigation** – Grouped, collapsible sidebar with customizable cross-group drag arrangement for non-admin pages and per-user visibility controlled by the `Features` settings tab

## Dashboard Filters

- **Time**: `TODAY`, `THIS_WEEK`, `NEXT_WEEK`, `THIS_MONTH`, `NEXT_MONTH`
- **Status**:
  - `PENDING`: not completed yet in selected range
  - `COMPLETED`: completed items in selected range (where lifecycle supports completion state)
  - `OVERDUE`: items with due/deadline date before today
- **Category** (multi-select): `goal`, `project`, `housework`, `calendar`, `expense`, `assets`, `learning`, `idea`

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
- Appliances & Devices
- Learning topics
- Idea topics

## Feature Visibility

Navigation visibility is user-configurable from `User Settings > Features`.

- **Personal**: Tasks, Projects, Goals, Expenses, Ideas
- **Family**: Calendar, Ca Keo, Housework, Assets
- **Hobby**: Keyboard, Funds, Learning

Behavior:

- checking a child item shows that page in the navigator
- unchecking a child item hides that page from the navigator
- hidden pages also redirect away if visited directly by URL
- if all child items inside a group are unchecked, that group disappears from the sidebar
- dashboard, analytics, settings, and admin pages are not controlled by these feature toggles

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
- `PAY`: `AI`, `Ca Keo`, `Food`, `Gift`, `Healthcare`, `House`, `Insurance`, `Maintenance`, `Education`, `Entertainment`, `Family Support`, `Shopping`, `Transportation`, `Utilities`, `Other`

## Recent Changes

Recent product updates include:

- project item type added with options `Task`, `Bug`, `Feature`, `Story`, `Epic`
- project page wording updated from `Task` to `Item` where needed to avoid confusion with standalone tasks
- analytics page renamed from `Reports` and expanded to cover `Project`, `Task`, `Goal`, `Calendar`, `Asset`, `Housework`, `Expenses`, `Learning`, and `Ideas`

## Pagination

List-style modules can use pagination controls with:

- page numbers
- `Prev` / `Next` buttons
- page size options `25`, `50`, `100`

Current pages using this pattern:

- Expenses
- Funds
- Keyboard

Recommended terms for future requests:

- `pagination`
- `page size`
- `items per page`

## Hobby Automation

Funds and Keyboard now have a limited cross-module automation flow for mechanical keyboard transactions:

- when `Funds.scope = Mechanical keyboard`
- and `Type = Buy`
- and `Category` is `Keycap`, `Kit`, or `Accessories`
- the app automatically creates a new Keyboard item

For mechanical keyboard sell transactions:

- the Funds form shows a `Keyboard Item` picker
- the selected keyboard item is deleted when the sell transaction is created
- if the selected item cannot be found, the backend returns `not matching item in collection`

Current buy mapping:

- `Funds.description` -> `Keyboard.name`
- `Funds.amount` -> `Keyboard.price`
- `Funds.category` -> `Keyboard.category`
- `Funds.condition` -> Keyboard condition display field

## Amount Input

The app supports compact amount and price input in key money-entry flows.

Examples:

- `600k` -> `600000`
- `2M` -> `2000000`
- `7.8M` -> `7800000`

This is currently supported in:

- Expenses amount
- Funds amount
- Keyboard price
- standalone payment task amount
- asset maintenance cost
- collection item price
- analytics filters now support time-aware filtering across all analytics modules, with tab-specific type/category/scope controls
- scheduled reports now support `Weekly Summary`, `Next Week Tasks`, `Today Tasks`, and `Tomorrow Tasks`
- report frequency `One Time` now runs as a true one-time job instead of a disabled `None` state
- reports and notifications now expose explicit enable/disable controls for notification rules and schedules
- alert rules are evaluated by `GET /api/service/due-notifications`, so n8n can deliver rule-based notifications without extra workflow branching
- goals/tasks and notifications/scheduled reports are now split into separate pages instead of shared tab-only navigation
- sidebar navigation is now grouped into `Dashboard`, `Personal`, `Family`, `Settings`, and `Admin`, with collapsible groups and drag customization
- tasks, notifications, and scheduled reports now support persisted manual drag reorder
- notification rules and scheduled reports now support double-click edit from the card list
- settings profile and notification sections now require explicit `Save` instead of auto-saving on blur/change
- the `Assets` product label is now `Appliances & Devices` in the UI
- maintenance logs with non-empty cost now automatically create a matching personal expense in category `Maintenance`

## Auth Session

- Access token and refresh token lifetimes are controlled by environment variables such as `JWT_EXPIRY` and `JWT_REFRESH_EXPIRY`.
- The frontend keeps the access token in `localStorage` and relies on the refresh-token cookie to renew expired access tokens.
- If refresh fails, the user is redirected back to login.
- alert rules now fire once per scheduled Vietnam local day; the visible cooldown control has been removed from the notifications UI
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
