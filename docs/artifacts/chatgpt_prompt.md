
# Prompt for AI Coding Agent

You are a senior full-stack engineer. Build a production-ready family productivity web app called **NgốcKý**.

Your job is to design and implement the app with a clean architecture, modern UI, Docker-based deployment, and documentation so I can continue development later.

## 1. Product Overview

Build a web app named **NgocKy** for a family to manage:

* personal tasks
* housework
* work/project tasks
* recurring goals and check-ins
* maintenance history for household assets and vehicles
* expense tracking
* shared calendar
* reports
* notifications
* basic user management

This is a **private family app**, not a public SaaS.

There is **no public registration**.
The first owner account must be seeded from environment variables when the system starts for the first time.
That owner/admin can create other family member accounts.

The app must support:

* desktop-first layout with excellent usability
* mobile-friendly UI for quick actions like check-in, create item, view calendar
* theming
* reporting
* API endpoints so **n8n** can fetch data and send notifications/reports externally

## 2. Tech Stack

Use this stack unless there is a very strong technical reason to change it:

### Frontend

* React
* Vite
* TypeScript
* Tailwind CSS
* React Router
* TanStack Query
* Zustand or Context API for lightweight client state
* a clean component library approach using reusable UI components
* chart library for reports, such as Recharts

### Backend

* Node.js
* Express
* TypeScript
* Prisma ORM
* PostgreSQL
* JWT-based authentication with refresh token flow
* bcrypt or argon2 for password hashing
* Zod for request validation

### Infra / DevOps

* Docker
* Docker Compose
* GitHub Actions for deployment
* Caddy will reverse proxy the app in production
* Separate containers:

  * 1 container for web/backend app
  * 1 container for PostgreSQL database

## 3. Deployment Environment

### VPS

* Ubuntu
* 8 GB RAM
* 4 CPU
* 50 GB SSD
* Docker already used
* Caddy already running
* n8n already running

### Domain

* Main app URL: `ngocky.kael.io.vn`
* Optional DB hostname: `db.kael.io.vn`

### Environment modes

#### Development

* frontend runs locally
* backend can run locally
* database is on VPS
* app connects to VPS PostgreSQL using env connection string

#### Production

* deploy to VPS using GitHub Actions
* run app and db with Docker Compose
* Caddy reverse proxies to the app container

## 4. Important Security Rules

Do **not** expose PostgreSQL directly to the public internet unless absolutely necessary.
Preferred design:

* the UI connects only to backend API
* backend connects to PostgreSQL
* remote DB access for development should be restricted by firewall / IP allowlist / strong credentials / SSL if possible

Do not build any feature that lets users browse raw DB tables directly from frontend.
“View/edit data remotely” means CRUD through the app UI, not a database admin panel.

Implement:

* secure auth
* role-based authorization
* audit-friendly timestamps
* soft delete where appropriate
* validation on all inputs
* rate limiting for login endpoint
* safe error handling
* env-based configuration

## 5. User Roles

Implement 3 roles:

### Owner

* seeded from `.env`
* full access
* can create admin/user
* can activate/deactivate users
* can reset user passwords
* full settings access

### Admin

* can manage normal users
* can manage all records
* can view reports
* cannot change owner account

### User

* can manage own profile
* can create/update own records
* can view shared calendar
* depending on permissions, may view family-shared modules

Use role checks in both backend and frontend.

## 6. Main Modules

Use these module names in the UI and codebase:

1. Dashboard
2. Tasks
3. Housework
4. Calendar
5. Expenses
6. Reports
7. Settings
8. User Management

Do not create a vague “Utility” section. Split features into real modules.

## 7. Information Architecture

### 7.1 Dashboard

Dashboard should be actionable, not decorative.

Include:

#### Summary cards

* tasks due this week
* tasks due this month
* housework due this week
* housework due this month
* upcoming events
* recent expenses
* overdue items

#### Dashboard lists

* tasks for current week (Monday to Sunday)
* tasks for current month
* housework for current week
* housework for current month
* items marked as “pin to dashboard” or “highlight”

#### Calendar widget

* mini/shared calendar showing all events
* upcoming 7-day agenda list

Use today’s date dynamically.

### 7.2 Tasks module

This module contains several subtypes. Design it cleanly.

#### A. Goals

Personal recurring goals like:

* gym 2 times per week
* read 10 sessions per month

Fields:

* title
* description
* owner user
* period type: weekly or monthly
* target count
* current count
* start date
* active/inactive
* notification enabled
* pin to dashboard
* status

Behavior:

* progress resets automatically based on period
* check-ins increment progress
* history should remain recorded

#### B. Projects

For work or personal projects.

Fields:

* title
* description
* category
* deadline
* priority
* status: planned / in_progress / done / archived
* assignee
* notification enabled
* pin to dashboard
* kanban order

Views:

* Kanban board
* list/table view

#### C. Learning

Track learning goals or study items.

Fields:

* title
* description
* subject/category
* target
* progress
* deadline
* status
* notification enabled

#### D. Check-ins

This is the action log for goals.

Fields:

* goal
* user
* date/time
* quantity
* note

Behavior:

* updates related goal progress
* visible as history timeline

#### E. Ideas

Simple capture area for ideas.

Fields:

* title
* note/content
* category
* tags
* status: open / reviewing / archived
* created by

## 8. Housework module

### A. Recurring Housework

Examples:

* weekly cleanup
* groceries refill
* quarterly AC cleaning

Fields:

* title
* description
* owner or assigned member
* frequency type:

  * one_time
  * weekly
  * monthly
  * quarterly
  * half_yearly
  * yearly
  * custom
* custom interval fields if custom selected
* next due date
* estimated cost optional
* notification enabled
* status
* pin to dashboard

Behavior:

* recurring items generate next due schedule logically
* overdue logic visible in dashboard/reports

### B. Maintenance History

Track service/repair history for assets.

Examples:

* motorbike oil change
* AC cleaning
* phone repair

Create 2 related entities:

#### Asset

Fields:

* name
* type
* brand
* model
* serial number optional
* purchase date optional
* note

#### Maintenance Record

Fields:

* asset
* service date
* description
* service type
* cost
* vendor/provider optional
* next recommended service date optional
* attachments optional in future-ready design
* created by

## 9. Calendar module

Shared calendar for all users.

Features:

* month / week / agenda views
* create/edit/delete events
* personal or shared event visibility
* assigned users / participants
* optional all-day event
* start/end datetime
* location
* notes
* color/category

Users should be able to see other shared events and availability context.

Do not build complex Google Calendar sync in v1.
Design backend in a way that future sync is possible.

## 10. Expenses module

Track personal and family expenses.

Fields:

* date
* description
* amount
* type/category
* paid by
* scope: personal / family
* note
* recurring yes/no

Filters:

* by user
* by category
* by date range
* by scope

Reports:

* monthly totals
* category breakdown
* trend charts

## 11. Reports module

Reports must exist in both:

* frontend visual reports
* backend API endpoints for export so n8n can consume them

Support:

* date range selection
* module selection
* table output
* chart output

Provide report types such as:

* tasks by status
* overdue tasks
* goal completion rate
* housework completion and overdue rate
* maintenance cost by asset
* expense summary by period/category/user
* calendar event counts by user/time range

API requirements:

* JSON endpoints for report data
* CSV export for selected reports
* auth-protected endpoints
* designed for n8n integration

## 12. Notification-related design

The app itself should manage notification preferences and data.
Actual sending can be handled later by n8n.

### Notification-ready fields on items

Applicable entities should have:

* notification enabled
* notification channel preference:

  * email
  * telegram
  * both
* lead time / remind before deadline options
* recipient target

### Notification API

Build API endpoints so n8n can:

* fetch due items needing notification
* fetch users and preferred channels
* fetch scheduled reports
* mark notifications as processed if needed

### Alert Rules

Settings should allow alert rule creation.

Fields:

* name
* module type: task / housework / goal / expense optional later
* frequency: daily / weekly
* condition expression or structured condition
* notification channel
* active/inactive

For v1, implement structured conditions rather than free-form DSL.

Example conditions:

* overdue items exist
* tasks due within X days
* housework due this week

## 13. Settings module

### A. Profile settings

* change password
* choose theme
* enable/disable notifications
* select channel:

  * email
  * telegram
  * both
* if email selected, show email input
* if telegram selected, show telegram chat/user input
* if both, show both fields

### B. Alert settings

Manage reusable alert rules.

### C. Scheduled reports

Fields:

* report type
* date range preset
* frequency
* day of week if needed
* time
* channel
* recipients
* active/inactive

This data is for n8n to read later.

### D. Budget settings

Fields:

* budget type/category
* period: weekly / monthly / yearly
* amount
* active/inactive

### E. Theme settings

Create 3 initial themes:

* blue/purple
* grey/black
* red-accent

### F. App info

Show version number in bottom-left sidebar/footer.

## 14. User Management module

Visible only for owner/admin depending on permission.

Features:

* list users
* create user
* activate/deactivate user
* reset/change password
* assign role
* basic profile fields
* notification contact fields

No self-registration.
No passwordless auth in v1.

## 15. UX / UI Requirements

The app should look modern, polished, and pleasant.

### Desktop

* left sidebar navigation
* top bar with page title, quick actions, user menu
* dashboard cards + data views
* clear table/list/board layouts

### Mobile

* bottom navigation
* compact cards
* quick access for:

  * check-in
  * create task
  * create housework
  * create event
* allow minimized/expandable sections to save space

### Design language

* clean
* modern
* soft but professional
* family productivity feel
* smooth spacing and strong visual hierarchy

Do not make it look like a generic admin template.

## 16. Data Model Guidance

Design a Prisma schema that supports:

* users
* roles
* sessions/tokens if needed
* goals
* goal check-ins
* projects
* learning items
* ideas
* housework items
* assets
* maintenance records
* calendar events
* expenses
* alert rules
* scheduled reports
* notification preferences
* audit timestamps

Each main entity should generally include:

* id
* createdAt
* updatedAt
* createdBy if relevant
* status if relevant

Use enums where appropriate:

* roles
* task/project statuses
* frequencies
* notification channels
* scopes
* themes

## 17. API Requirements

Build REST API with clean route organization.

Suggested route groups:

* `/api/auth`
* `/api/users`
* `/api/dashboard`
* `/api/goals`
* `/api/checkins`
* `/api/projects`
* `/api/learning`
* `/api/ideas`
* `/api/housework`
* `/api/assets`
* `/api/maintenance`
* `/api/calendar`
* `/api/expenses`
* `/api/reports`
* `/api/settings`
* `/api/alerts`
* `/api/scheduled-reports`

Implement:

* pagination
* filtering
* sorting
* validation
* consistent response structure
* centralized error handling

## 18. Authentication Flow

Requirements:

* owner account seeded from env on first startup
* login with email/username + password
* JWT access token
* refresh token support
* logout
* password change
* protected routes
* role-based guards

Seed env example:

* OWNER_NAME
* OWNER_EMAIL
* OWNER_PASSWORD

On initial boot:

* if no owner exists, create one
* if owner exists, do not recreate

## 19. Seed and Migration Requirements

Provide:

* Prisma migrations
* seed script
* owner bootstrap logic
* sample development seed data for:

  * one owner
  * one admin
  * one normal user
  * sample goals
  * sample tasks/projects
  * sample housework
  * sample events
  * sample expenses
  * sample maintenance records

## 20. DevOps Requirements

### Docker Compose

Create production-ready compose setup with:

* app service
* postgres service
* volumes for postgres persistence
* env file support
* restart policies

### Caddy

Assume Caddy will reverse proxy to app container.
Document the Caddy config example.

### GitHub Actions

Build a workflow that:

* runs lint/test/build
* builds Docker image
* deploys to VPS
* runs docker compose pull/up
* applies migrations safely

### Environment variables

Document all required env vars.

Include examples for:

* app port
* database URL
* JWT secrets
* owner seed credentials
* frontend public API URL
* app version

## 21. Expected Project Structure

Create a maintainable monorepo or clearly separated app structure.

Preferred:

* `/apps/web`
* `/apps/api`
* `/packages/shared` if needed

or a similarly clean full-stack structure.

## 22. Testing

At minimum include:

* backend unit tests for core services
* API tests for auth and critical CRUD
* frontend smoke tests for main views if feasible

If full coverage is too much, prioritize:

* auth
* goal check-in logic
* recurring housework logic
* report endpoints

## 23. MVP Priority

Build in this order:

### Phase 1

* auth
* user management basics
* dashboard
* goals + check-ins
* projects
* housework recurring items
* calendar
* expense tracking
* basic settings
* report APIs
* Docker/dev setup

### Phase 2

* maintenance history
* scheduled reports
* alert rules
* theme polishing
* mobile UX polish
* CSV export enhancements

## 24. Deliverables

I want the coding output to include:

1. full source code
2. Prisma schema
3. database migrations
4. seed scripts
5. Dockerfiles
6. docker-compose config
7. GitHub Actions deploy workflow
8. `.env.example`
9. README with setup instructions
10. API documentation
11. explanation of architecture decisions
12. sample Caddy reverse proxy config

## 25. Non-Goals for v1

Do not implement yet:

* public registration
* social login
* Google Calendar sync
* direct Telegram sending from app
* direct email sending from app
* multi-tenant SaaS logic
* native mobile app
* advanced file upload system unless needed minimally
* raw database admin interface exposed to end users

## 26. Code Quality Expectations

Write code that is:

* production-minded
* strongly typed
* modular
* easy to extend
* cleanly named
* documented where useful
* not overengineered

Avoid fake placeholder architecture with no working implementation.
Prefer a smaller working system over huge incomplete scaffolding.

## 27. Final Output Format

When you respond, provide:

1. architecture overview
2. proposed folder structure
3. Prisma data model
4. implementation plan
5. actual code
6. setup instructions
7. deployment instructions
8. assumptions and tradeoffs

If the implementation is too large for one response, start with:

* architecture
* schema
* folder structure
* bootstrap code
* auth
* core modules
* Docker/dev setup

and continue in a structured way.

---

## Better short version for faster agents

If your coding agent works better with a shorter prompt, use this condensed version:

> Build a private family productivity web app called NgocKy using React + Vite + Tailwind + TypeScript on frontend, and Node.js + Express + TypeScript + Prisma + PostgreSQL on backend.
> Features: owner-seeded auth, user management, dashboard, recurring goals with check-ins, project/task kanban, learning tracker, ideas, recurring housework, maintenance history by asset, shared calendar, expense tracking, reports, notification preferences, alert rules, scheduled reports, themes, mobile-friendly UI, Docker deployment, GitHub Actions, Caddy reverse proxy.
> No public registration. Owner account seeded from env. Backend must expose report/notification APIs for n8n.
> Use Docker Compose in production with 1 app container and 1 PostgreSQL container.
> Secure the system properly, use role-based access, validation, JWT auth, Prisma migrations, seeds, and clean architecture.
> Deliver full code, schema, Docker setup, env example, README, API docs, deployment guide, and sample data.

---

## My blunt advice

Your current requirement is good as a product idea, but bad as a build brief. If you pass the raw version to an AI agent, you’ll likely get:

* messy schema
* duplicated modules
* weak notification design
* bad security around remote DB
* pretty UI on the surface, sloppy internals underneath

What you actually need is:

1. fixed information architecture
2. strict boundaries between app UI, backend API, and DB
3. MVP-first scope
4. explicit non-goals

That’s what the prompt above does.

If you want, next I can turn this into an even stronger **Cursor / Claude Code / OpenAI Codex style execution prompt** with:

* step-by-step build order
* exact Prisma models
* exact route list
* exact Docker Compose skeleton
