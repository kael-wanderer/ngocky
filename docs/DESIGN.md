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
- **Navigation**: Uses a project selection flow first, then enters the board view with breadcrumb navigation.

### 3. Expense Tracking

Monitors family and personal spending.

- **Scope**: `PERSONAL` (private) vs `FAMILY` (visible to everyone).
- **Categories**: Food, Transport, Utilities, etc.
- **Reporting**: Aggregated totals per category and scope.

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

### Tech Stack

- **Frontend**: React, TanStack Query, Zustand, Axios, Lucide Icons.
- **Backend**: Node.js, Express, Prisma (ORM), zod.
- **Database**: PostgreSQL.
- **Hosting**: Caddy (Reverse Proxy/SSL), Docker.
