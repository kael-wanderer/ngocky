# Changelog

All notable changes to this project will be documented in this file.

---

## [2026-03-07] - Feature Enhancement & Architectural Refinement

### Added

- **Project Boards**: introduced a new data model and UI for managing separate project boards.
- **Goal Units**: added `unit` field to goals (e.g., "times", "mins", "km") for more precise tracking.
- **Goal Tracking Type**: supported `BY_FREQUENCY` and `BY_QUANTITY` logic.
- **Goal Deletion**: enabled users to permanently remove goals.
- **Mandatory Field Indicators**: added red asterisks (`*`) to all required input fields across the app.
- **VPS Deployment Secrets**: added support for `VPS_PORT` and `VPS_SSH_PASSPHRASE` in GitHub Actions.

### Changed

- **Project Structure**: refactored the project system into a two-level architecture (Boards > Tasks) with Kanban views.
- **Goal Progress**: fixed percentage calculation and allowed progress to exceed 100%.
- **Authentication**: hardened cookie settings for better subdomain compatibility on VPS.
- **Check-in Validation**: restricted check-ins to a 45-day window and prevented future dates.
- **GitHub Action**: automated `.env` generation on the VPS using GitHub Secrets.

### Fixed

- **Unauthorized (401) Error**: addressed CORS and token synchronization issues on the production environment.
- **Goal Reset Logic**: fixed background reset of period counts for weekly and monthly goals.
