# Implementation Plan - Goals & Tasks Expansion

This document tracks the next product expansion centered on the Goals area becoming a combined Goals and Tasks workspace.

---

## 🏗 Features & Refinements

### 0. Ca Keo Module ✅

Kid task and calendar tracker under the Family sidebar group.

- [x] **Schema**: `CaKeo` model with title, description, category, status, assignerId (FK → User), startDate, endDate, allDay, color, showOnCalendar, notification fields, isShared, ownerId
- [x] **Feature flag**: `featureCaKeo` on User, under Family feature group in Settings > Features
- [x] **API**: CRUD at `/api/cakeos`, plus `/api/cakeos/users` for live assigner dropdown
- [x] **Calendar view**: monthly grid identical to main Calendar, colored dots, day panel with tasks + quick-add
- [x] **List view**: flat table with per-person pending/done stat cards (dynamic from DB users), filter by status/assignee/category
- [x] **Kanban view**: 4 columns (Todo / In Progress / Done / Cancelled), quick-add per column
- [x] **Main Calendar integration**: items with `showOnCalendar = true` appear in main Calendar with pink "Ca Keo" badge; read-only in that context
- [x] **Notification support**: uses shared `NotificationFields` component
- [x] **Migration**: `20260313000000_add_cakeo_module`

---

### 1. Goals Workspace Refactor

Goal: keep the current Goals experience intact while refactoring the page into a two-tab workspace.

- [x] **Goal features baseline**: Existing goal tracking remains available as the first tab.
- [ ] **Page Rename**: Rename the page experience from a goals-only screen to a combined `Goals & Tasks` workspace.
- [ ] **Tabbed Layout**: Add `Goals` and `Tasks` tabs similar to the existing `Reports & Notifications` tab pattern.
- [ ] **Navigation Update**: Update sidebar/menu labels to reflect the combined workspace without breaking discoverability.

### 2. Standalone Tasks Module

Goal: add lightweight personal tasks outside the Project Kanban system.

- [ ] **Task Model**: Introduce a standalone task entity for personal actionable items.
- [ ] **Task Fields**: Support title, description, due date, repeat settings, status, reminders, and optional pin-to-dashboard.
- [ ] **Tasks Tab UI**: Add list and create/edit flows under the new `Tasks` tab.
- [ ] **Repeat Logic**: Support one-time and recurring tasks without forcing them into Calendar.
- [ ] **Dashboard Integration**: Add standalone task visibility to Dashboard cards/filters where appropriate.

### 3. Scheduled Payment Workflow

Goal: support future obligations that become expense records only after completion.

- [ ] **Payment Task Extension**: Allow a task to optionally carry amount, expense type, category, and scope metadata.
- [ ] **Completion Automation**: When a payment task is marked done, automatically create an `Expense` record.
- [ ] **Duplicate Prevention**: Store a link between the task and generated expense so completion is idempotent.
- [ ] **Audit Rules**: Define how editing/reopening a completed payment task affects the linked expense.

### 4. Asset -> Calendar Automation

Goal: turn `nextRecommendedDate` on maintenance records into optional calendar reminders.

- [ ] **Linked Calendar Event**: When a maintenance record has `nextRecommendedDate`, create or sync a related calendar event.
- [ ] **Back-Reference Storage**: Store the linked calendar event id on the maintenance record or in a dedicated relation table.
- [ ] **Sync Rules**: Update or remove the linked event when the maintenance record changes.

### 5. UI/UX Notes

Goal: keep the first release additive and easy to understand.

- [ ] **Tab Consistency**: Reuse the `Reports & Notifications` tab interaction pattern for `Goals` and `Tasks`.
- [ ] **Entry Points**: Add `Add Task` button only inside the `Tasks` tab.
- [ ] **Terminology**: Keep module language consistent:
  - Goal = target or habit
  - Task = actionable work item
  - Event = time-based calendar item
  - Expense = historical payment/income record

### 6. Delivery Sequence

Recommended implementation order:

1. **Docs and UX framing**
   - finalize `Goals & Tasks` terminology and tab structure
2. **Standalone tasks MVP**
   - schema, API, UI, dashboard filter integration
3. **Scheduled payment automation**
   - task completion creates expense
4. **Asset calendar automation**
   - maintenance next date creates/syncs calendar event

## 🚀 Deployment / Migration Notes

- [ ] Add Prisma migrations for standalone tasks and related automation links.
- [ ] Regenerate Prisma client after schema changes.
- [ ] Backfill or default task-related fields for existing users where needed.

## 🧪 Testing Coverage

- [ ] **API Tests**: task CRUD, recurrence, and completion flows.
- [ ] **Automation Tests**: task -> expense and asset -> calendar sync behavior.
- [ ] **UI Tests**: tab switching, task creation, and pin/filter behavior.
- [ ] **Regression Tests**: verify Goals tab keeps current goal tracking behavior unchanged.
