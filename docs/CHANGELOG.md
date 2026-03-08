# Changelog

All notable changes to this project will be documented in this file.

---

## [2026-03-07] - Phase 2: Core Enhancements & UI/UX Polishing

### Added

- **Mandatory Field Indicators**: Added red asterisks (`*`) to all required inputs in Goals, Projects, Housework, Ideas, Learning, Calendar, Assets, and Expenses.
- **Project Structure**: Finalized Task vs. Board separation with specific Project selection flow.
- **Goal Management**: Added deletion and long-term history tracking support.
- **Project Sharing**: Added `isShared` board flag to share projects with all family users while keeping board deletion owner-only.
- **Project UX Controls**: Added board edit, manual refresh, and Kanban drag-and-drop status move support.
- **Housework Actions**: Added per-item `Edit` and `Delete` actions.
- **Housework Recurrence Rules**: Added `DAILY` frequency and rule fields (`dayOfWeek`, `dayOfMonth`, `monthOfPeriod`, `monthOfYear`) with rule-based next due scheduling.
- **Housework Status Buckets**: Added explicit Housework sections (`Overdue`, `Due Today`, `Upcoming`, `Unscheduled`) with clear `Mark Complete` action.
- **Dashboard Filters**: Added `Time`, `Status`, and multi-select `Category` filters.
- **Dashboard Coverage**: Added/updated sections for `Project`, `Task`, `Pinned Items`, `Expense`, `Assets`, `Learning`, and dedicated `Overdue` feed.
- **Branding Assets**: Added ladybug logo in Login, sidebar brand, and browser tab favicon.
- **Expense Type Model**: Added `PAY` / `RECEIVE` expense type support with expanded scopes (`PERSONAL`, `FAMILY`, `KEO`, `PROJECT`).
- **Expense Management Actions**: Added per-item `Edit` and `Delete` actions on the Expenses page.
- **Shared Items**: Added per-item `isShared` support for Expenses and Project Tasks.
- **Learning Topics**: Added topic-first learning structure so histories are created under a selected topic.

### Changed

- **Goal Progress Logic**: Fixed backend calculation to support `BY_FREQUENCY` vs `BY_QUANTITY` units properly.
- **Dashboard UI**: Renamed "Pinned Projects" and "Overdue Projects" to "Tasks" for better architectural consistency.
- **Deployment**: Enhanced GitHub Actions for more reliable VPS secret injection and build caching.
- **Goal/Project Progress Display**: Switched progress labels from raw counts to percentage in Goals and Dashboard widgets.
- **Dashboard Data Model**: `GET /api/dashboard` now accepts query params (`timeRange`, `status`) and returns filtered due/overdue datasets.
- **Expense Currency Display**: Switched UI amount formatting from USD to VND.
- **Expense UX**: Reordered expense table columns, added type filter, added `Travel`, `Hobby`, and `Home Maintenance` categories, added shorthand amount parsing (for example `82M`), and split totals into income, payment, and remaining fund with type-aware colors.
- **Expense Sorting**: Added ascending/descending sorting controls on all expense table columns.
- **Expense Category Logic**: Expense category options now depend on type: `RECEIVE` uses `Salary`, `Top-up`, `Sell`; `PAY` uses spending categories only.
- **Browser Title**: Updated browser tab branding to `NgốcKy`.
- **Dev Environment Note**: Documented that localhost web may read the VPS API/database, so backend fixes become visible locally only after VPS deployment in that setup.
- **Housework Frequency UI**: Removed `Custom` option from Housework frequency dropdown.
- **Theme Application**: Theme changes now apply immediately after saving settings; logout/login is no longer required.
- **Ideas Topics**: Reworked Ideas into topic + log structure, matching the asset/log pattern and fixing the add-idea `400` path.
- **Reports Expansion**: Added Learning and Ideas report views.
- **Alerts UX**: Added edit/duplicate actions and expanded alert module coverage to `CALENDAR` and `ASSETS`.

### Fixed

- **Goal Tracking Bug**: Resolved issue where quantity was ignored or miscalculated in frequency-based goals.
- **Zod Validation**: Updated API schemas to allow `unit` and `trackingType` during creation/update.
- **401 Unauthorized**: Resolved session invalidation on VPS by hardening cookie security.
- **Projects Modal Focus Bug**: Fixed edit modal unexpectedly closing during text selection by using safer backdrop close handling.
- **Dashboard Task Visibility**: Fixed issue where due tasks were hidden unless pinned; `Task` now shows due tasks by selected filters and `Project` shows project names with due task counts.

---

## [2026-03-03] - Initial VPS Deployment
