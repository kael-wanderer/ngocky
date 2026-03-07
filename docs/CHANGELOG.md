# Changelog

All notable changes to this project will be documented in this file.

---

## [2026-03-07] - Phase 2: Core Enhancements & UI/UX Polishing

### Added

- **Mandatory Field Indicators**: Added red asterisks (`*`) to all required inputs in Goals, Projects, Housework, Ideas, Learning, Calendar, Assets, and Expenses.
- **Project Structure**: Finalized Task vs. Board separation with specific Project selection flow.
- **Goal Management**: Added deletion and long-term history tracking support.

### Changed

- **Goal Progress Logic**: Fixed backend calculation to support `BY_FREQUENCY` vs `BY_QUANTITY` units properly.
- **Dashboard UI**: Renamed "Pinned Projects" and "Overdue Projects" to "Tasks" for better architectural consistency.
- **Deployment**: Enhanced GitHub Actions for more reliable VPS secret injection and build caching.

### Fixed

- **Goal Tracking Bug**: Resolved issue where quantity was ignored or miscalculated in frequency-based goals.
- **Zod Validation**: Updated API schemas to allow `unit` and `trackingType` during creation/update.
- **401 Unauthorized**: Resolved session invalidation on VPS by hardening cookie security.

---

## [2026-03-03] - Initial VPS Deployment
