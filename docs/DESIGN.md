# NgocKy Project Design

## Overview

NgocKy is a family productivity hub designed to manage personal and household tasks, track goals, and monitor expenses. It is built as a monorepo with a React/Vite frontend and an Express/Prisma/PostgreSQL backend, hosted on a VPS via Docker/Caddy.

---

## 🏗 Core Modules

### 1. Goal Tracking System

Tracks personal habits and achievement targets over specific time intervals.

- **Models**: `Goal`, `GoalCheckIn`.
- **Period Types**: `WEEKLY` (Monday-Sunday), `MONTHLY` (1st-Last day).
- **Tracking Types**:
  - `BY_FREQUENCY`: Counts each check-in once (e.g., "Gym workout 3 times/week").
  - `BY_QUANTITY`: Sums a 'quantity' value (e.g., "Read 60 mins/day").
- **UI**: Visual progress bars showing percentage completion, supporting >100% achievements.

### 2. Project Management (Two-Level Kanban)

Allows organizing tasks into distinct boards with a modern Kanban view.

- **Boards**: Each `Project` acts as a top-level board (e.g., "Home Improvement", "Work").
- **Tasks**: `ProjectTask` items within a board, categorized by:
  - **Status**: `PLANNED`, `IN_PROGRESS`, `DONE`, `ARCHIVED`.
  - **Priority**: `LOW`, `MEDIUM`, `HIGH`, `URGENT`.
- **Task Sharing**: Individual tasks can also be marked as shared so they appear to all users even when the board itself is not shared.
- **Navigation**: Uses a project selection flow first, then enters the board view with breadcrumb navigation.

### 3. Expense Tracking

Monitors family and personal spending.

- **Type**: `PAY` (outgoing) and `RECEIVE` (incoming).
- **Scope**: `PERSONAL`, `FAMILY`, `KEO`, `PROJECT`.
- **Categories**:
  - `RECEIVE`: Salary, Top-up, Sell
  - `PAY`: Food, Utilities, Healthcare, Shopping, Transport, Home Maintenance, Education, AI, Entertainment, Other
- **UI Behavior**:
  - `PAY` amounts are shown in red.
  - `RECEIVE` amounts are shown in green.
  - Each expense can be marked `shared` to appear for all users.
  - Expense table supports ascending/descending sort on every visible column.
  - Expense input accepts shorthand values such as `82M` and stores them as numeric VND amounts.
  - Expense summary is split into `Total income`, `Total payment`, and `Remaining fund`.

### 4. Learning Topics & Histories

Learning is organized in two layers:

- **Topic**: top-level subject such as `DevOps`.
- **History**: individual learning entry under a selected topic.

This mirrors the asset/log interaction model:

- user creates a topic first
- user selects a topic
- user adds histories under that topic

### 5. Idea Topics & Logs

Ideas follow the same two-layer structure as Learning and Assets:

- **Topic**: top-level idea bucket such as `Startup`, `Garden`, or `Content`
- **Log**: individual note/history entry under a selected idea topic

Interaction model:

- user creates an idea topic first
- user selects the topic
- user adds logs under that topic

This replaces the old flat "add idea item" flow and avoids invalid log creation without a parent topic.

---

## 🔐 Security & Infrastructure

### Authentication

- Uses **JWT** for authentication.
- **Access Token**: Short-lived, stored in memory/localStorage.
- **Refresh Token**: Long-lived (7 days), stored in an **HTTP-only, Secure cookie**.
- **CORS**: Restricted to the frontend domain (`https://ngocky.kael.io.vn`).

### Deployment (CI/CD)

- **GitHub Actions**: Automated pipeline builds Docker images and pushes to GHCR.
- **VPS Deployment**: Uses `docker-compose.prod.yml`, automated by SSH and GitHub Secrets.
- **Environment Management**: `.env` is generated on-the-fly on the VPS during deployment.
- **Observed Dev Pattern**: Localhost web may be configured to call the VPS API directly. In that setup, backend code changes only become visible locally after the VPS deployment updates the running API.
- **Theme Application**: Theme selection is applied client-side immediately after settings save; no logout/login cycle is required.

### Tech Stack

- **Frontend**: React, TanStack Query, Zustand, Axios, Lucide Icons.
- **Backend**: Node.js, Express, Prisma (ORM), zod.
- **Database**: PostgreSQL.
- **Hosting**: Caddy (Reverse Proxy/SSL), Docker.

---

## Dashboard Filtering & Status Semantics

### Time Filter

Dashboard supports four time ranges:

- `THIS_WEEK`
- `NEXT_WEEK`
- `THIS_MONTH`
- `NEXT_MONTH`

These are applied server-side in `GET /api/dashboard`.

### Status Filter

Dashboard supports:

- `PENDING`: not completed yet in selected range.
- `COMPLETED`: completed items in selected range, where module lifecycle supports completion.
- `OVERDUE`: due/deadline before `now`.

### Category Filter

Multi-select categories on Dashboard:

- `goal`
- `project`
- `housework`
- `calendar`
- `expense`
- `assets`
- `learning`

### Reports Coverage

Reports currently expose chart data for:

- tasks
- goals
- housework
- expenses
- learning
- ideas

### Alerts Coverage

Alert rules support modules including:

- `GOALS`
- `PROJECTS`
- `HOUSEWORK`
- `LEARNING`
- `CALENDAR`
- `ASSETS`

### Overdue Feed Coverage

Unified overdue feed includes modules with due/deadline fields:

- `ProjectTask.deadline`
- `HouseworkItem.nextDueDate`
- `LearningItem.deadline`
- `MaintenanceRecord.nextRecommendedDate`
- `CalendarEvent.startDate` (missed start)

Expense currently has no separate unpaid due-date field (only payment date), so expense overdue debt is not inferred.

---

## Housework Recurrence & Completion UX

### Frequency Types

- `ONE_TIME`
- `DAILY`
- `WEEKLY`
- `MONTHLY`
- `QUARTERLY`
- `HALF_YEARLY`
- `YEARLY`

(`CUSTOM` removed from UI selection.)

### Recurrence Rule Fields

- `dayOfWeek` for weekly
- `dayOfMonth` for monthly/yearly/periodic rules
- `monthOfPeriod` for quarterly/half-yearly
- `monthOfYear` for yearly

### Completion Flow

- User clicks `Mark Complete` in Housework list.
- Backend computes next due date by recurrence rule (not by simple +7 in rule-based mode).
- Housework UI groups items by operational status:
  - `Overdue`
  - `Due Today`
  - `Upcoming`
  - `Unscheduled`
