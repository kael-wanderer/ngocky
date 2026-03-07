# NgocKy – Family Productivity App – Implementation Plan

A full-stack family productivity web app with React/Vite frontend, Express/Prisma backend, PostgreSQL database, and Docker deployment.

## User Review Required

> [!IMPORTANT]
> This is a greenfield project of significant scope. I will build Phase 1 (all core modules) as a working, production-ready system. Phase 2 (maintenance history, alert rules, scheduled reports, learning/ideas modules, advanced theming, mobile polish, and testing) can follow in subsequent sessions.

> [!WARNING]
> The full app described in the requirements is very large (~50+ files, ~15K+ lines of code). I will prioritize **working code** over exhaustive boilerplate. If you'd like me to focus on specific modules first, let me know.

---

## Proposed Folder Structure

```
NgocKy/
├── apps/
│   ├── api/                    # Express + Prisma backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── seed.ts
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── index.ts        # App entry
│   │   │   ├── app.ts          # Express setup
│   │   │   ├── config/         # Env, constants
│   │   │   ├── middleware/     # Auth, error, validation
│   │   │   ├── routes/         # Route definitions
│   │   │   ├── controllers/    # Request handlers
│   │   │   ├── services/       # Business logic
│   │   │   ├── validators/     # Zod schemas
│   │   │   └── utils/          # Helpers
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                    # React + Vite frontend
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── api/            # API client + hooks (TanStack Query)
│       │   ├── components/     # Reusable UI components
│       │   ├── layouts/        # AppLayout, AuthLayout
│       │   ├── pages/          # Route pages
│       │   ├── stores/         # Zustand stores
│       │   ├── hooks/          # Custom hooks
│       │   ├── types/          # Shared types
│       │   └── utils/          # Helpers
│       ├── Dockerfile
│       ├── package.json
│       └── tsconfig.json
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── .github/workflows/deploy.yml
├── README.md
└── package.json                # Root workspace
```

---

## Proposed Changes

### 1. Project Scaffolding

#### [NEW] Root `package.json` + configs
- npm workspaces for `apps/api` and `apps/web`
- Root TypeScript config

#### [NEW] `apps/api/` – Backend setup
- Express app with middleware stack (CORS, JSON, auth, errors)
- Environment config with Zod validation
- TypeScript compilation

#### [NEW] `apps/web/` – Frontend setup
- Vite + React + TypeScript
- Tailwind CSS v3
- TanStack Query, React Router, Zustand, Recharts

---

### 2. Database Schema (Prisma)

#### [NEW] `apps/api/prisma/schema.prisma`

Key models:
| Model | Description |
|---|---|
| `User` | id, email, name, password, role (OWNER/ADMIN/USER), active, theme, notification prefs |
| `Goal` | Recurring goals with period, target count, check-in tracking |
| `GoalCheckIn` | Check-in records linked to goals |
| `Project` | Work/personal projects with kanban support |
| `LearningItem` | Learning goals |
| `Idea` | Quick idea capture |
| `HouseworkItem` | Recurring housework with frequency types |
| `Asset` | Household assets for maintenance tracking |
| `MaintenanceRecord` | Service/repair history |
| `CalendarEvent` | Shared calendar events |
| `Expense` | Expense tracking with scope |
| `AlertRule` | Notification rule definitions |
| `ScheduledReport` | Report scheduling for n8n |
| `BudgetSetting` | Budget limits by category/period |

#### [NEW] `apps/api/prisma/seed.ts`
- Bootstrap owner from env vars
- Create sample admin + user
- Populate sample data for all modules

---

### 3. Backend API

#### [NEW] Auth module (`routes/auth.ts`, `controllers/auth.ts`, `services/auth.ts`)
- POST `/api/auth/login` – JWT + refresh token
- POST `/api/auth/refresh` – Refresh access token
- POST `/api/auth/logout` – Invalidate refresh token
- POST `/api/auth/change-password` – Password change
- Rate limiting on login

#### [NEW] User management (`routes/users.ts`, etc.)
- GET/POST/PATCH `/api/users` – CRUD with role guards
- PATCH `/api/users/:id/toggle-active` – Activate/deactivate
- PATCH `/api/users/:id/reset-password` – Admin password reset

#### [NEW] Dashboard (`routes/dashboard.ts`)
- GET `/api/dashboard` – Aggregated summary data

#### [NEW] Goals + Check-ins (`routes/goals.ts`, `routes/checkins.ts`)
- Full CRUD for goals
- Check-in creation with auto goal progress update

#### [NEW] Projects (`routes/projects.ts`)
- Full CRUD + kanban reorder endpoint

#### [NEW] Housework (`routes/housework.ts`)
- Full CRUD with recurring schedule logic

#### [NEW] Calendar (`routes/calendar.ts`)
- Full CRUD for events with date range queries

#### [NEW] Expenses (`routes/expenses.ts`)
- Full CRUD with filters by user/category/date/scope

#### [NEW] Reports (`routes/reports.ts`)
- GET endpoints for various report types (JSON)
- CSV export support for key reports

#### [NEW] Settings (`routes/settings.ts`)
- Profile settings, notification prefs, budget settings, theme

---

### 4. Frontend Application

#### [NEW] Layout system
- `AppLayout` – sidebar + topbar + content area
- `AuthLayout` – centered login form
- Mobile responsive with bottom nav

#### [NEW] Auth pages
- Login page
- Auth context with token management

#### [NEW] Dashboard page
- Summary cards (tasks, housework, expenses, overdue counts)
- Weekly/monthly task lists
- Mini calendar widget

#### [NEW] Module pages
- Goals page (list + check-in modal)
- Projects page (kanban + list toggle)
- Housework page (list with due dates)
- Calendar page (month/week/agenda views)
- Expenses page (list + filters + charts)
- Reports page (charts + tables + date filters)
- Settings page (profile, theme, notifications, budgets)
- User Management page (admin-only user list)

#### [NEW] UI Component library
- Button, Input, Select, Modal, Card, Badge, Table, Tabs
- Sidebar, TopBar, BottomNav
- DatePicker, Calendar, Charts

---

### 5. Docker & DevOps

#### [NEW] `apps/api/Dockerfile`
- Multi-stage build: deps → build → production

#### [NEW] `apps/web/Dockerfile`
- Multi-stage: deps → build → nginx/static serve

#### [NEW] `docker-compose.yml`
- `api` service (port 3001)
- `web` service (port 80)
- `postgres` service (5432)
- Volumes, env files, restart policies

#### [NEW] `.github/workflows/deploy.yml`
- Lint → Build → Docker build → Deploy to VPS

#### [NEW] `.env.example`
- All required env vars documented

---

### 6. Documentation

#### [NEW] `README.md`
- Architecture overview, setup instructions, deployment guide
- Caddy config example
- API overview

---

## Verification Plan

### Automated Tests (via terminal)

Since this is a greenfield project, I'll include:

1. **Backend API smoke tests** – A test script that:
   - Starts the backend
   - Tests auth flow (login, refresh, protected routes)
   - Tests CRUD on core modules
   - Run with: `cd apps/api && npm test`

2. **Frontend build verification**:
   - Ensures the frontend builds without errors
   - Run with: `cd apps/web && npm run build`

3. **Docker build verification**:
   - Ensures Docker images build successfully
   - Run with: `docker compose build`

### Manual Verification

1. **Start the dev environment**:
   - Run `cd apps/api && npm run dev` and `cd apps/web && npm run dev`
   - Open browser to `http://localhost:5173`
   - Login with seeded owner credentials
   - Navigate through all modules and verify pages load

2. **Test auth flow manually**:
   - Login → verify JWT stored
   - Access protected routes → verify they work
   - Logout → verify redirect to login

3. **Test core CRUD**:
   - Create a goal, add a check-in, verify progress updates
   - Create a project, verify kanban view
   - Create housework items, verify due date display
   - Create calendar events, verify calendar view
   - Add expenses, verify filters work

> [!NOTE]
> More comprehensive testing (unit tests for business logic, integration tests with database) is planned for Phase 2 after core functionality is stable.
