# NgocKy Implementation Walkthrough

The NgocKy family productivity app has been fully scaffolded with a robust, production-ready full-stack architecture. Here is a summary of the implemented features and architectural decisions.

## Full-Stack Architecture

The project is structured as a **monorepo** using npm workspaces, containing:
1. **`apps/api`**: Node.js, Express, and TypeScript backend powered by Prisma ORM.
2. **`apps/web`**: React 19, Vite, and TypeScript frontend styled with Tailwind CSS and utilizing TanStack Query for state management.

### Backend Overview
- **Database**: PostgreSQL 16 schema mapped via Prisma, featuring 16 comprehensive models (Users, Goals, Projects, Housework, Calendars, Expenses, etc.).
- **Authentication**: JWT-based auth with refresh token rotation. An **owner account** is seeded on first boot using environment variables, ensuring there is no public registration step.
- **API Structure**: 11 robust route modules providing clean REST APIs for all features. Centralized middleware handles role-based authorization guards, error parsing, and Zod validation.
- **Reporting & Notifications**: Dedicated endpoints for generating CSV exports and exposing JSON data for **n8n integration** (e.g., fetching overdue items for Telegram/email notifications).

### Frontend Highlights
- **State & Data Fetching**: `zustand` manages the global authentication state while `@tanstack/react-query` handles robust API data caching, polling, and mutations.
- **UI System**: A unified layout featuring a collapsible desktop sidebar and a responsive mobile bottom nav. Component styles (buttons, cards, inputs, badges) are reusable CSS classes in `index.css`.
- **Theming**: A native CSS variable-based theme engine supporting 3 themes: Default (Blue/Purple), Dark Mode (Grey/Black), and Red Accent.
- **Pages Built**:
  - **Login**: Secure access with JWT persistence and Axios interceptors for automatic token refreshes.
  - **Dashboard**: High-level metrics, active goal progress bars, pinned projects, and recent expenses.
  - **Goals & Check-ins**: Tracks weekly/monthly limits with a check-in interface that instantly updates visual progress.
  - **Projects**: Toggleable Kanban board and tabular list views with priority color coding and assignees.
  - **Housework**: One-click chore completion that automatically calculates and advances the `nextDueDate` based on frequency patterns (e.g., Weekly, Monthly).
  - **Calendar**: A fully custom month-view grid with day details panel, color-coded tags, and shared vs. personal filtering.
  - **Expenses**: Powerful filtering (scope, category, date limits) and total aggregation.
  - **Reports**: Data visualizations featuring Recharts (Bar & Pie charts) breaking down goals, tasks, housework states, and spending analytics.
  - **Settings**: Dynamic theme switching, profile management, and notification channel configs (Email/Telegram).
  - **Admin Panel**: Role-base user creation and account disable hooks.

## Infrastructure & Deployment
- **Docker Compose**: Pre-configured `docker-compose.yml` to spin up PostgreSQL, the Node API container, and a statically built Frontend served via Nginx with an API Proxy block. 
- **GitHub Actions**: A complete CI/CD pipeline `deploy.yml` that builds Docker images and pushes to ghcr.io, then SSHs into the VPS to automatically restart the system.

*(Phase 1 complete. See `README.md` for local testing steps.)*
