# Implementation Plan - Phase 2: Core Enhancements

This document tracks the implementation status of Phase 2 features for the NgocKy Family Productivity Hub.

---

## 🏗 Features & Refinements

### 1. Goal Tracking System (Refined)

Goal: Enhance frequency/quantity tracking, progress visualization, and validation.

- [x] **Units & Tracking Type**: Added `unit` and `trackingType` enum to Goal model.
- [x] **Progress Logic**: Fixed calculation to show actual units (e.g., 1/2) instead of base check-in counts.
- [x] **Over-achievement**: Enabled visualization of progress exceeding 100%.
- [x] **Validation**: Restricted check-in dates to the last 45 days and prevented future dates.
- [x] **Goal Deletion**: Added API and UI support for removing goals.
- [x] **Auto-Reset**: Implemented background reset logic for Weekly (Monday) and Monthly (1st) cycles.

### 2. Project Kanban Boards

Goal: Restructure projects into a two-level hierarchy for better organization.

- [x] **Board Model**: Created `Project` boards to act as separate workspaces.
- [x] **Sub-tasks**: Refactored `ProjectTask` items to reside within specific boards.
- [x] **Navigation Flow**: Implemented a selection screen for boards before entering the Kanban view.
- [x] **UX Improvements**: Added breadcrumbs and a back button for easier internal navigation.

### 3. UI/UX Polishing

Goal: Improve form usability and general aesthetics.

- [x] **Mandatory Indicators**: Added red asterisks (`*`) to all required input fields.
- [x] **Responsive Layout**: Ensured modals and board views scale correctly on mobile.
- [x] **Status Badges**: Refined priority and status coloring in Kanban cards.

### 4. Security & Production Stability

Goal: Harden the system for VPS deployment and resolve auth issues.

- [x] **401 Unauthorized Fix**: Hardened CORS origin configuration and token synchronization.
- [x] **Cookie Management**: Set `sameSite: 'none'` and `secure: true` for cross-domain auth support in production.
- [x] **Token Persistence**: Improved handling of refresh tokens in HTTP-only cookies.

---

## 🚀 Deployment Automation

### GitHub Actions (CI/CD)

- [x] **VPS Connection**: Added support for `VPS_PORT` and `VPS_SSH_PASSPHRASE`.
- [x] **Secret Injection**: Automated `.env` generation on the VPS using GitHub Secrets (DB Passwords, JWT Secrets, etc.).
- [x] **Automated Seeding**: Deployment script now automatically runs `prisma migrate deploy` and `db:seed`.

---

## 🧪 Testing Coverage (Next Phase)

- [ ] **API Unit Tests**: Coverage for Auth, Goals, and Project routes using Vitest.
- [ ] **E2E Tests**: Critical path testing for goal completion and expense tracking.
- [ ] **Automated CI Tests**: Integrate test runs into the GitHub Action pipeline.
