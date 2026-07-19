# Changelog

All notable changes to this project will be documented in this file.

---

## [2026-07-19] - Desktop DB Connection UX & Scheduled Reports

### Added

- **Split-field DB form** in desktop onboarding (host/port/database/user/password) with a **Test connection** button (`test_db_connection` Tauri command — spawns the sidecar in `DB_CHECK_ONLY=true` probe mode, same driver semantics as runtime) and an Advanced raw-connection-string toggle.
- **Offline engine choice**: built-in SQLite (default) or bring-your-own PostgreSQL (host prefilled `127.0.0.1`, install link). Sidecar provider now follows `database_url` presence, not mode.
- **Settings storage panel** (desktop): shows engine + location (credential-stripped for Postgres) via `get_storage_info`; SQLite gets a two-click **Reset data** button (`reset_offline_data` kills the sidecar and deletes `ngocky.db*`).
- **Setup wizard page selection**: per-template checkboxes under each module group; unchecked templates land as `builtInPages: { visible: false }` overrides (`POST /api/setup` accepts optional `hiddenPages`). Setup now runs in a single transaction.
- **Scheduled reports on desktop** (modes 2/3): `tickReports()` in the local scheduler polls `GET /api/service/due-reports` + `report-data/:id`, formats via new `services/reportFormatter.ts` (plain text, ≤4000 chars, `sections` filter, VND `vi-VN`), delivers via Telegram + OS notification feed.
- **Report send dedupe**: `ScheduledReport.lastSentAt` + atomic claim-on-read in `due-reports` (20-min guard) — two shared-mode desktops (or a double-firing n8n) send each report exactly once. Migration `20260719120000_scheduled_report_last_sent`.
- **Shared-mode scheduler choice** in onboarding: built-in scheduler (recommended) or self-hosted n8n (`schedulerMode: "n8n"` → sidecar starts with `SCHEDULER_ENABLED=false`).

### Changed

- **Frozen desktop migration baselines**: `generate-baselines.mjs` now renders `000_baseline.sql` from committed snapshots (`prisma/baseline/`); post-baseline schema changes ship as numbered diffs (`prisma/desktop-diffs/<provider>/`) copied into resources at package time.

### Notes

- Report catch-up after downtime is intentionally not done (server-side 15-min due window is the contract). Email channel still deferred.

## [2026-07-18] - Desktop Offline Modes

### Added

- **Desktop mode 2 (single-user offline, SQLite)**: `--variant desktop` generates a SQLite Prisma client; `DB_PROVIDER=sqlite` selects it at runtime with an env-driven `DATABASE_URL`. Fully local, no network. Baseline SQL generated per provider.
- **Desktop mode 3 (thick client + shared Postgres)**: the Express API is bundled (esbuild) and packaged as a Node SEA binary, spawned by Tauri as a sidecar on `127.0.0.1:21473`. Onboarding mode-chooser (thin / offline / shared) writes `desktop-config.json` and relaunches.
- **Runtime migration runner** (`services/migrationRunner.ts`): applies shipped baseline SQL at boot via `MIGRATIONS_DIR`, tracked in `_app_migrations`, idempotent and safe under concurrent mode-3 clients (Postgres advisory lock).
- **Local scheduler** (`services/scheduler.ts`, `SCHEDULER_ENABLED=true`): in-sidecar replacement for n8n reminder delivery. Boot catch-up (24h) + 5-min interval with wall-clock-gap lookback. Delivers via Telegram (`TELEGRAM_BOT_TOKEN`) and exposes fired reminders at `GET /api/notifications/recent`; the desktop frontend turns those into OS notifications.
- **`lookbackMinutes`** query param on `GET /api/service/due-notifications` (default 1, max 7 days) for catch-up scans. `/api/service` routes now accept the assistant API key or a JWT owner/admin session.

### Notes

- SEA base uses an official self-contained node fetched at package time (host homebrew node is dynamically linked / not injectable).

## [2026-07-17] - Food Menu Columns & Table Column Toggle

### Added

- **Food Menu**: 4 new optional fields — Address, District, Open hours, Price (estimated) — shown after Distance in table, form, CSV/JSON import (`address`, `district`, `openHours`/`open hours`, `priceEst`/`price`). Migration `20260717000000_add_food_place_details`.
- **Column show/hide toggle**: shared `ColumnToggle` component + `useHiddenColumns` hook (localStorage-persisted per template). Wired into Food, Expenses, Housework (list view), Ca Keo (list view), Funds, Keyboard, Users.

### Documentation

- DESIGN.md: planned desktop deployment modes (thin client / single-user offline SQLite / thick client + shared Postgres), scheduler idempotency and alert-reliability constraints.

## [2026-07-11] - Cross-Cutting Page Instance Integration

### Added

- **Dashboard Links**: Pinned records now carry originating custom-page metadata and route back through `/p/:slug`.
- **Report Filters**: Report raw-record queries and CSV exports accept validated `instanceId` filters; omitted filters remain built-in-only.
- **Automation Metadata**: Due notifications preserve page origin metadata for custom records.
- **Assistant Resolution**: Assistant page names resolve case-insensitively and return clarification instead of guessing when names are ambiguous.

### Documentation

- Documented Admin pages, provider setup, custom endpoint security, template isolation, deletion behavior, and legacy OpenAI compatibility.

## [2026-07-11] - Production Verification

- GitHub Actions immutable-image deployment completed successfully.
- Production `/version.json` matched revision `9ce94ce069d7638c5f393328164fa8afe54fd639`.
- Production API health check returned `{"status":"ok","version":"1.0.0"}`.


## [2026-07-11] - Funds Page Instances

### Added

- **Funds Instances**: Added dedicated transaction and import isolation coverage.

### Changed

- **Availability**: Enabled the Funds template after focused tests passed.

---

## [2026-07-11] - Keyboard Page Instances

### Added

- **Keyboard Instances**: Added dedicated list/create/import isolation coverage and instance-aware import assignment.

### Changed

- **Availability**: Enabled the Keyboard template after focused tests passed.

---

## [2026-07-11] - Healthbook Page Instances

### Added

- **Healthbook Instances**: Added dedicated person list/create/detail isolation coverage and instance-aware person ownership boundaries.

### Changed

- **Availability**: Enabled the Healthbook template after focused tests passed.

---

## [2026-07-11] - Assets Page Instances

### Added

- **Assets Instances**: Added dedicated asset list/create/update/delete isolation coverage.

### Changed

- **Availability**: Enabled the Assets template after focused tests passed.

---

## [2026-07-11] - Housework Page Instances

### Added

- **Housework Instances**: Added dedicated isolation coverage for list, create, and recurring completion boundaries.

### Changed

- **Availability**: Enabled the Housework template after focused tests passed.

---

## [2026-07-11] - Ca Keo Page Instances

### Added

- **Ca Keo Instances**: Added dedicated instance isolation coverage for create, list, and cross-instance update protection.

### Changed

- **Availability**: Enabled the Ca Keo template after its focused tests passed.

---

## [2026-07-11] - Calendar Page Instances

### Added

- **Calendar Instances**: Added instance-scoped event list, create, update, read, delete, participant boundaries, and custom-page query keys.
- **Calendar Tests**: Added dedicated Calendar instance isolation coverage.

### Changed

- **Custom Calendar Overlays**: Custom calendars no longer load built-in Task, Housework, or Ca Keo overlays.
- **Availability**: Enabled the Calendar template after focused tests passed.

---

## [2026-07-11] - Template Instance Foundations

### Added

- **Ideas and Learning Instances**: Added instance-aware topic/history partitioning, scoped mutations, and custom-page query keys for the Ideas and Learning templates.
- **Module UI Preparation**: Added instance props and query-key plumbing to Calendar, Ca Keo, Housework, Assets, Keyboard, and Funds pages.

### Changed

- **Template Availability**: Ideas and Learning are enabled; the remaining expanded templates stay unavailable until their nested routes and import/file/overlay behavior are fully isolated.

### Verification

- API page tests: 12 passed.
- Web tests: 24 passed.

---

## [2026-07-11] - Application Management and Template Foundation

### Added

- **Application Management**: Added an OWNER/ADMIN page for template inventory and centralized custom-page creation, stable rename, deletion previews, typed confirmation, and deletion.
- **Application Branding**: Added an OWNER-only logo uploader with preview and default-logo restoration.
- **Template Catalog**: Added canonical metadata and schema support for Personal, Family, and Hobby page templates while keeping unfinished templates unavailable for creation.
- **Instance Registry**: Added lazy frontend component registration for the four currently implemented custom-page templates.

### Changed

- **Page Ownership**: Custom pages and their root records are reassigned to an OWNER when their creator account is deleted.
- **Navigation**: Removed page mutation controls from the sidebar and applied application group gates plus per-user template visibility to custom links.
- **Built-in Pages**: Added rename, safe removal, and restore controls while preserving existing module data.
- **Page Creation**: Split creation into Module, filtered Template, and Page name controls.
- **User Settings**: Moved application identity and group controls to Admin and redirected the legacy Application tab URL.

---

## [2026-07-11] - Multi-Provider Agent Settings

### Added

- **Agent Providers**: Added encrypted, persistent configuration for OpenAI, Claude, and custom OpenAI-compatible endpoints.
- **Agent Settings**: Added an OWNER-only Admin page for provider selection, API keys, model discovery, model ID entry, reasoning effort, and connection testing.
- **Endpoint Security**: Added DNS-aware SSRF protection, redirect validation, connection pinning, timeouts, and response-size limits for custom providers.

### Changed

- **Assistant Parsing**: Replaced the hard-coded OpenAI client and model with provider adapters while preserving regex fallback behavior.
- **User Settings**: Removed AI credentials from the Application tab; application identity and module-group controls remain until Application Management ships in Batch 2.
- **Legacy Compatibility**: Existing encrypted OpenAI credentials and the `OPENAI_API_KEY` environment fallback continue to work through the new provider store.

---

## [2026-07-11] - Deployment Verification

### Changed

- **Immutable Releases**: GitHub Actions now publishes and deploys API and web images tagged with the triggering commit SHA while retaining `latest` for convenience.
- **Build Identity**: Production images include the source revision label, and the web container exposes the deployed revision at `/version.json`.
- **Frontend Caching**: Nginx now prevents caching of `index.html` and `version.json` while caching content-hashed assets immutably.
- **Deployment Checks**: Production deployments are serialized, and the workflow verifies API health, frontend revision, and both running image revisions before reporting success.
- **Manual Deployments**: The deployment workflow can now be started manually from GitHub Actions.

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

## [2026-03-08] - Record/Event Semantics and Scheduling Updates

### Added

- **MFA**: Added TOTP MFA in Settings with QR enrollment, manual setup key, verification code activation, and second-step login verification.
- **Reminder Offsets**: Added reminder controls for Goals, Project Tasks, Housework, and Calendar Events using `notificationEnabled`, `reminderOffsetValue`, and `reminderOffsetUnit`.
- **Dashboard Today Filter**: Added `Today` to the dashboard time presets.
- **Project Type**: Added project type values `PERSONAL`, `WORK`, `FOR_FUN`, and `STUDY`.
- **Calendar Repeat**: Added calendar recurrence support with `DAILY`, `WEEKLY`, and `MONTHLY` plus repeat end modes `NEVER` and `ON_DATE`.
- **Asset Warranty**: Added `warrantyMonths` at asset level.
- **Asset Sharing**: Added asset-level `isShared`.
- **Learning Sharing & Duplication**: Added shared learning topics plus duplicate actions for topics and histories.
- **Idea Sharing & Duplication**: Added shared idea topics plus duplicate actions for topics and logs.
- **Expense Time Presets**: Added expense filters for `Last quarter`, `Last month`, `This month`, `This quarter`, and `Custom`.
- **User Admin Actions**: Added user delete and reset-password actions in the admin UI with role-based restrictions.

### Changed

- **Branding**: Browser/tab title now uses `NgốcKý - Family record management`.
- **Navigation Label**: Renamed `Alerts` to `Scheduled Action` in the application UI.
- **Dashboard Semantics**: Reclassified calendar items as `events` and expense/asset-learning-idea logs as `records`.
- **Overdue Scope**: Dashboard overdue logic now applies only to true deadline-based items (`ProjectTask.deadline`, `HouseworkItem.nextDueDate`).
- **Dashboard Date Panels**: Calendar events, asset logs, and learning histories are now shown by selected time range only and are no longer classified as `Pending`, `Completed`, or `Overdue`.
- **Auth Error Handling**: Frontend 401 refresh logic now skips `/auth/login`, `/auth/logout`, and `/auth/refresh`, so failed login attempts surface normally instead of looking like an instant sign-out.
- **Modal Backdrop Handling**: Dialogs now dismiss only on direct backdrop press, preventing accidental closure during mouse-based text selection inside forms.

### Documentation

- **README**: Updated product name, sharing behavior, item semantics, and today’s feature changes.
- **Design Notes**: Added explicit event vs. record vs. deadline-item model and updated shared-item visibility rules.

---

## [2026-03-03] - Initial VPS Deployment
