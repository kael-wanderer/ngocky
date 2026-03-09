# NgốcKý Project Design

## Overview

NgốcKý is a family record management hub designed to manage personal and household tasks, track goals, record events, and monitor expenses. It is built as a monorepo with a React/Vite frontend and an Express/Prisma/PostgreSQL backend, hosted on a VPS via Docker/Caddy.

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
- **Reminder Model**: Goals can enable reminders using `notificationEnabled` plus a reminder offset (`MINUTES`, `HOURS`, `DAYS`) relative to the current goal period end.

### 2. Goal & Tasks Workspace

The current Goals area evolves into a two-tab workspace:

- **Goals**: existing goal tracking experience
- **Tasks**: standalone personal tasks that do not need to belong to a project board

This keeps personal planning in one place without forcing all work into Project boards or Calendar events.

Task intent is:

- **Task** = something actionable that the user needs to do
- **Calendar event** = something scheduled to happen at a date/time
- **Expense** = historical money movement after something happened

Initial standalone task capabilities:

- one-time or recurring task
- due date / next due date
- status such as `PENDING`, `DONE`, `ARCHIVED`
- reminder support
- optional dashboard pinning

Follow-on workflow automation direction:

- a task may optionally represent a scheduled payment
- when a payment task is marked done, the app can automatically create an `Expense`
- asset maintenance records may optionally generate or sync a future Calendar event from `nextRecommendedDate`

This keeps each module as the source of truth for its own domain while allowing controlled cross-module automation.

### 3. Project Management (Two-Level Kanban)

Allows organizing tasks into distinct boards with a modern Kanban view.

- **Boards**: Each `Project` acts as a top-level board (e.g., "Home Improvement", "Work").
- **Tasks**: `ProjectTask` items within a board, categorized by:
  - **Status**: `PLANNED`, `IN_PROGRESS`, `DONE`, `ARCHIVED`.
  - **Priority**: `LOW`, `MEDIUM`, `HIGH`, `URGENT`.
- **Task Sharing**: Individual tasks can also be marked as shared so they appear to all users even when the board itself is not shared.
- **Task Reminders**: Tasks can enable reminders with an offset before `deadline`.
- **Navigation**: Uses a project selection flow first, then enters the board view with breadcrumb navigation.

### 4. Expense Tracking

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

Scheduled or future payments should not live directly in Expenses. They belong to Tasks first, and generate Expenses only when completed if automation is enabled.

### 5. Learning Topics & Histories

Learning is organized in two layers:

- **Topic**: top-level subject such as `DevOps`.
- **History**: individual learning entry under a selected topic.

This mirrors the asset/log interaction model:

- user creates a topic first
- user selects a topic
- user adds histories under that topic

Learning topics can be shared to all users. Histories are records, not deadline-managed tasks.

### 6. Idea Topics & Logs

Ideas follow the same two-layer structure as Learning and Assets:

- **Topic**: top-level idea bucket such as `Startup`, `Garden`, or `Content`
- **Log**: individual note/history entry under a selected idea topic

Interaction model:

- user creates an idea topic first
- user selects the topic
- user adds logs under that topic

This replaces the old flat "add idea item" flow and avoids invalid log creation without a parent topic.

Idea topics can be shared to all users. Idea logs are records, not deadline-managed tasks.

### 7. Calendar Events

Calendar items are events:

- they have a scheduled date/time
- they may repeat (`DAILY`, `WEEKLY`, `MONTHLY`)
- they can end `NEVER` or `ON_DATE`
- they may define an optional reminder offset before `startDate`
- they are not treated as `Pending`, `Completed`, or `Overdue`

Calendar also serves as a destination module for linked reminders generated from other domains, such as future asset maintenance follow-ups.

### 8. Record Modules

The following modules are treated as records:

- Expenses
- Asset maintenance logs
- Learning histories
- Idea logs

Records are date-based entries. They are shown by time range but not by overdue/deadline logic.

### 9. Cross-Module Automation Principles

Cross-module automation is allowed when one record is clearly derived from another module's completion or scheduling state.

Planned patterns:

- `Task -> Expense`
  - Use case: scheduled payment
  - Rule: only create the expense when the task is marked done
- `MaintenanceRecord -> CalendarEvent`
  - Use case: remind the user about the next recommended service date
  - Rule: create or sync a linked calendar event when `nextRecommendedDate` is set

Design constraints:

- each automation should store a link to its derived record to avoid duplicates
- updates should sync the linked record instead of creating a new one
- source modules remain editable without losing the derived relationship
- automations should be optional and explicit, not implicit for every record

---

## 🔐 Security & Infrastructure

### Authentication

- Uses **JWT** for authentication.
- **Access Token**: Short-lived, stored in memory/localStorage.
- **Refresh Token**: Long-lived (7 days), stored in an **HTTP-only, Secure cookie**.
- **CORS**: Restricted to the frontend domain (`https://ngocky.kael.io.vn`).
- **MFA**: Users can enable TOTP-based MFA with a pending enrollment secret, QR/manual setup key, code verification to activate, and code verification again to disable.

### Deployment (CI/CD)

- **GitHub Actions**: Automated pipeline builds Docker images and pushes to GHCR.
- **VPS Deployment**: Uses `docker-compose.prod.yml`, automated by SSH and GitHub Secrets.
- **Environment Management**: `.env` is generated on-the-fly on the VPS during deployment.
- **Observed Dev Pattern**: Localhost web may be configured to call the VPS API directly. In that setup, backend code changes only become visible locally after the VPS deployment updates the running API.
- **Theme Application**: Theme selection is applied client-side immediately after settings save; no logout/login cycle is required.
- **Refresh Behavior**: Frontend token refresh applies only to expired authenticated API calls. Login/logout/refresh requests are excluded so auth failures are shown directly instead of causing redirect loops.

### Modal Interaction

- Dialog backdrops close only when the pointer is pressed directly on the backdrop.
- Mouse text selection inside a modal no longer closes the form accidentally.

### Tech Stack

- **Frontend**: React, TanStack Query, Zustand, Axios, Lucide Icons.
- **Backend**: Node.js, Express, Prisma (ORM), zod.
- **Database**: PostgreSQL.
- **Hosting**: Caddy (Reverse Proxy/SSL), Docker.

---

## Dashboard Filtering & Status Semantics

### Time Filter

Dashboard supports five time ranges:

- `TODAY`
- `THIS_WEEK`
- `NEXT_WEEK`
- `THIS_MONTH`
- `NEXT_MONTH`

These are applied server-side in `GET /api/dashboard`.

### Status Filter

Dashboard supports:

- `PENDING`: not completed yet in selected range.
- `COMPLETED`: completed items in selected range, where module lifecycle supports completion.
- `OVERDUE`: due/deadline before today.

### Category Filter

Multi-select categories on Dashboard:

- `goal`
- `task`
- `project`
- `housework`
- `calendar`
- `expense`
- `assets`
- `learning`
- `idea`

### Reports Coverage

Reports currently expose chart data for:

- tasks
- goals
- housework
- expenses
- learning
- ideas

### Scheduled Action Coverage

Scheduled action rules support modules including:

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

Calendar events and record modules are excluded from overdue logic.

### Shared Item Rule

Shared modules use a consistent visibility rule:

- `isShared = true` -> visible to all users
- `isShared = false` -> visible only to the owner/creator unless a parent shared container grants access

This rule currently applies to:

- Goals
- standalone Tasks
- Project boards
- Project tasks
- Calendar events
- Expenses
- Assets
- Learning topics
- Idea topics

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
