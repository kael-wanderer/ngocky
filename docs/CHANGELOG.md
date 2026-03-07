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

### Changed

- **Goal Progress Logic**: Fixed backend calculation to support `BY_FREQUENCY` vs `BY_QUANTITY` units properly.
- **Dashboard UI**: Renamed "Pinned Projects" and "Overdue Projects" to "Tasks" for better architectural consistency.
- **Deployment**: Enhanced GitHub Actions for more reliable VPS secret injection and build caching.
- **Goal/Project Progress Display**: Switched progress labels from raw counts to percentage in Goals and Dashboard widgets.

### Fixed

- **Goal Tracking Bug**: Resolved issue where quantity was ignored or miscalculated in frequency-based goals.
- **Zod Validation**: Updated API schemas to allow `unit` and `trackingType` during creation/update.
- **401 Unauthorized**: Resolved session invalidation on VPS by hardening cookie security.
- **Projects Modal Focus Bug**: Fixed edit modal unexpectedly closing during text selection by using safer backdrop close handling.

---

## [2026-03-03] - Initial VPS Deployment
