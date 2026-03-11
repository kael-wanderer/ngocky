# NgốcKý Project Design

## Overview

NgốcKý is a family record management hub designed to manage personal and household tasks, track goals, record events, monitor expenses, and support Telegram-based assistant interactions. It is built as a monorepo with a React/Vite frontend and an Express/Prisma/PostgreSQL backend, hosted on a VPS via Docker/Caddy.

---

## 🏗 Core Modules

### 1. Goal Tracking System

Tracks personal habits and achievement targets over specific time intervals.

- **Models**: `Goal`, `GoalCheckIn`.
- **Period Types**: `WEEKLY` (Monday-Sunday), `MONTHLY` (1st-Last day), `QUARTERLY` (Jan-Apr-Jul-Oct boundaries).
- **Tracking Types**:
  - `BY_FREQUENCY`: Counts each check-in once (e.g., "Gym workout 3 times/week").
  - `BY_QUANTITY`: Sums a 'quantity' value (e.g., "Read 60 mins/day").
- **UI**: Visual progress bars showing percentage completion, supporting >100% achievements.
- **Reminder Model**: Goals can enable reminders using `notificationEnabled` plus a pre-deadline notification policy. Reminders must not be scheduled after the relevant deadline boundary. Overdue handling belongs to `Reports & Notifications`, not item reminders.

### 2. Goals and Standalone Tasks

Goals and standalone Tasks are now exposed as separate pages in navigation, while still serving the same personal-planning domain.

- **Goals**: recurring target tracking and check-ins
- **Tasks**: standalone personal tasks that do not need to belong to a project board

Task intent is:

- **Task** = something actionable that the user needs to do
- **Calendar event** = something scheduled to happen at a date/time
- **Expense** = historical money movement after something happened

Initial standalone task capabilities:

- one-time or recurring task
- recurring frequencies: `DAILY`, `WEEKLY`, `MONTHLY`, `QUARTERLY`
- due date / next due date
- status such as `PENDING`, `DONE`, `ARCHIVED`
- reminder support
- optional dashboard pinning
- manual drag reorder with persisted `sortOrder`

Payment-task UI note:

- payment tasks keep internal status for completion/reopen flow
- the `Status` field is hidden in the task form for `PAYMENT` items
- payment task cards do not show the status badge in the list

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
  - `PAY`: AI, Ca Keo, Food, Gift, Healthcare, House, Insurance, Maintenance, Education, Entertainment, Family Support, Shopping, Transportation, Utilities, Other
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

Navigation note:

- Learning now lives under the `Hobby` sidebar group instead of `Personal`
- Learning visibility can be enabled or disabled per user from `Settings > Features`

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
- they may repeat (`DAILY`, `WEEKLY`, `MONTHLY`, `QUARTERLY`)
- they can end `NEVER` or `ON_DATE`
- they may define an optional reminder before `startDate`
- they are not treated as `Pending`, `Completed`, or `Overdue`

Calendar also serves as a destination module for linked reminders generated from other domains, such as future asset maintenance follow-ups.

### 8. Record Modules

The following modules are treated as records:

- Expenses
- Funds
- Asset maintenance logs
- Learning histories
- Idea logs

Records are date-based entries. They are shown by time range but not by overdue/deadline logic.

### 9. Cross-Module Automation Principles

Cross-module automation is allowed when one record is clearly derived from another module's completion or scheduling state.

Implemented / planned patterns:

- `Task -> Expense`
  - Use case: scheduled payment
  - Rule: only create the expense when the task is marked done
- `MaintenanceRecord -> CalendarEvent`
  - Use case: remind the user about the next recommended service date
  - Rule: create or sync a linked calendar event when `nextRecommendedDate` is set
- `MaintenanceRecord -> Expense`
  - Use case: record appliance/device servicing costs immediately
  - Rule: when a maintenance log is created with non-empty `cost`, create an expense with:
    - `description = serviceType`
    - `type = PAY`
    - `scope = PERSONAL`
    - `date = serviceDate`
    - `category = Maintenance`
    - `amount = cost`
    - `note = description`

Design constraints:

- each automation should store a link to its derived record to avoid duplicates
- updates should sync the linked record instead of creating a new one
- source modules remain editable without losing the derived relationship
- automations should be optional and explicit, not implicit for every record

Current practical note:

- `MaintenanceRecord -> Expense` is currently one-way on create
- editing or deleting a maintenance record does not yet update/delete the derived expense

### 10. Notification & Reminder Model

NgocKy supports item-level reminders on selected modules such as Goals, Project Tasks, Housework, Calendar, Maintenance, and standalone Tasks.

Reminder principles:

- reminders are always **pre-deadline** or **pre-start**, never post-deadline
- once an item becomes overdue, follow-up belongs to `Reports & Notifications`
- reminder evaluation should use a single computed datetime field (`notificationDate`) as the source of truth for delivery

Supported reminder modes:

- `ON_DATE`
  - user picks an explicit date and time
  - validation must ensure the notification datetime is before the item deadline/start
- `DAYS BEFORE`
  - user picks an offset plus a send time
  - system computes `notificationDate = deadline/start - N days`, anchored to the chosen send time
- `HOURS BEFORE`
  - system computes `notificationDate = deadline/start - N hours`

For date-only items, a reminder time is still required so the system can derive an exact timestamp.

Delivery and spam prevention:

- n8n may poll every 15 minutes
- the API/database remains the source of truth for reminder eligibility
- each reminder-enabled item should store:
  - `notificationDate`
  - `lastNotificationSentAt`
  - `notificationCooldownHours` with default `24`
- cooldown prevents repeated sends every polling cycle
- a reminder is eligible only when:
  - item is still active / not done / not archived
  - current time is at or after `notificationDate`
  - current time is still before the item deadline/start
  - `lastNotificationSentAt` is null or older than the cooldown window

This design intentionally separates two concerns:

- **item reminders**: notify before the deadline/start
- **overdue alerts**: notify after the deadline, managed by `Reports & Notifications`

Alert-rule scheduling note:

- scheduled alert rules now use their configured `time` plus `lastSentAt` to send only once per Vietnam local day within the poll window
- the user-facing `cooldown` control was removed from the Notifications UI because it no longer defines the effective schedule

### 11. Notifications and Scheduled Reports

Notifications and Scheduled Reports are now separate pages in the sidebar, though they still share the same backend scheduling domain.

- **Notifications**
  - rule-based alerts for modules such as Goals, Tasks, Housework, Calendar, Expenses, and Appliances & Devices
  - supports enable/disable, duplicate, drag reorder, and double-click edit
- **Scheduled Reports**
  - supports `Weekly Summary`, `Next Week Tasks`, `Today Tasks`, and `Tomorrow Tasks`
  - supports schedule frequencies `ONE_TIME`, `DAILY`, `WEEKLY`, `MONTHLY`, and `QUARTERLY`
  - supports enable/disable, duplicate, drag reorder, and double-click edit
  - `Today Tasks` uses the same data shape as `Tomorrow Tasks` but targets the current local day instead of the next one
  - `Quarterly` scheduled reports currently use the existing `dayOfMonth` selector and run in Jan/Apr/Jul/Oct

### 12. Telegram Assistant

NgocKy includes a Telegram assistant that uses chat as an alternate UI for selected actions.

Current supported scope:

- create standalone tasks
- update standalone task status
- update project task status
- query projects and project tasks
- query calendar events with natural-language date filters
- query standalone tasks
- create and query expenses
- log goal check-ins and query goals
- query and update housework status

Boundary decisions:

- Telegram is only the frontend channel
- n8n is transport/orchestration, not the source of truth
- NgocKy API owns identity, authorization, validation, ambiguity handling, execution, and audit logging
- the LLM is used for intent extraction, not direct database writes

Identity and linking:

- one Telegram chat maps to one NgocKy user
- user generates a one-time link code from Settings
- user sends `/link <code>` to the bot
- link code validity is 15 minutes
- verified link state is stored separately from the basic user profile

Safety and UX rules:

- write actions do not always require confirmation
- confirmation is required when confidence is low, multiple matches exist, required fields are missing, or multiple items could be affected
- when multiple matches exist, the assistant responds with a short disambiguation list instead of guessing
- all assistant writes must be auditable

### 13. Navigation Model

The application sidebar now supports grouped navigation with persisted user customization.

Fixed groups:

- `Dashboard`: Dashboard, Analytics
- `Personal`: Tasks, Projects, Goals, Expenses, Ideas
- `Family`: Housework, Assets, Calendar
- `Hobby`: Learning, Funds
- `Settings`: Reports, Notifications, User Settings
- `Admin`: User Management

Behavior:

- groups can be expanded/collapsed
- collapse state is persisted in local browser storage
- non-admin pages can be drag-reordered within a group
- non-admin pages can also be dragged across groups
- admin navigation remains fixed to avoid role/permission ambiguity
- page visibility is controlled per user in `Settings > Features`
- if all child pages in a feature group are disabled, that whole group disappears from the sidebar
- hidden pages are also blocked at the route level and redirect to dashboard if opened directly

### 14. Settings Save Model

Settings behavior is intentionally mixed based on action type:

- **Profile** fields (`name`, `email`, `timezone`) now use local draft state and require explicit `Save`
- **Features** fields control module visibility per user and require explicit `Save`
  - `Personal`: Tasks, Projects, Goals, Expenses, Ideas
  - `Family`: Housework, Assets, Calendar
  - `Hobby`: Learning, Funds
- **Notification** fields (`notificationEnabled`, `notificationChannel`, `notificationEmail`, `telegramChatId`) also require explicit `Save`
- **Assistant** tab manages Telegram link generation, link status, and revocation
- **Theme** changes still apply immediately
- **Avatar upload** still updates immediately after upload

### 15. Auth Session Model

- access token expiry is controlled by `JWT_EXPIRY`
- refresh token lifetime is controlled by `JWT_REFRESH_EXPIRY`
- the frontend stores the access token in `localStorage`
- refresh uses an HTTP-only cookie on `/api/auth`
- if an expired access token cannot be refreshed, the app redirects to login

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

### Analytics Time Filter

Analytics uses these time presets, in this display order:

- `Today`
- `This Week`
- `Last Week`
- `This Month`
- `Last Month`
- `This Quarter`
- `Last Quarter`
- `This Year`
- `Last Year`
- `Custom`

Preset definitions:

- `Today`: current local day only
- `This Week`: Monday to Sunday of the current week
- `Last Week`: Monday to Sunday of the previous week
- `This Month`: first to last day of the current month
- `Last Month`: first to last day of the previous month
- `This Quarter`: current quarter based on Jan-Apr-Jul-Oct boundaries
- `Last Quarter`: previous quarter based on Jan-Apr-Jul-Oct boundaries
- `This Year`: January 1 to December 31 of the current year
- `Last Year`: January 1 to December 31 of the previous year
- `Custom`: explicit start/end dates chosen by the user

Concrete examples for Wednesday, March 11, 2026:

- `Today`: March 11, 2026
- `This Week`: March 9, 2026 to March 15, 2026
- `Last Week`: March 2, 2026 to March 8, 2026
- `This Month`: March 1, 2026 to March 31, 2026
- `Last Month`: February 1, 2026 to February 28, 2026
- `This Quarter`: January 1, 2026 to March 31, 2026
- `Last Quarter`: October 1, 2025 to December 31, 2025
- `This Year`: January 1, 2026 to December 31, 2026
- `Last Year`: January 1, 2025 to December 31, 2025

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
- Housework items
- Calendar events
- Expenses
- Assets
- Learning topics
- Idea topics

### Shared Item Display Rule

Shared items use a consistent ownership display pattern across modules:

- owner view: show `Shared` under or beside the item so the owner knows the item is shared
- non-owner view: still show the shared item, but also show `Owner: <name>` under the item to avoid confusion about ownership

Interaction rule:

- shared visibility does not grant edit/delete/complete rights by default
- unless a module explicitly supports collaborative editing, non-owners should be view-only

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
