# Codebase Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the four giant page components and the giant reports route into focused files, and add a web-side smoke-test harness — so the codebase is contributor-ready before open-sourcing.

**Architecture:** Pure mechanical extraction. No behavior changes, no renamed exports, no new features. Each page `pages/XxxPage.tsx` becomes a folder `pages/xxx/` whose `index.tsx` re-exports the same default component, so `App.tsx` lazy imports keep working with only a path change. Backend `routes/reports.ts` splits into per-domain files mounted by one router.

**Tech Stack:** Existing only — React 19, TypeScript, Vite, Express, vitest. New dev deps for web tests: `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `vitest`.

## Global Constraints

- **No behavior change.** This is refactor-only. If you find a bug, note it in the commit message, do not fix it in this plan.
- **Verification after every task:** `cd apps/web && npx tsc --noEmit && npm run build` (web tasks) or `cd apps/api && npx tsc --noEmit && npm test` (api tasks). Both must pass before commit.
- `App.tsx` already lazy-loads all pages via `React.lazy(() => import('./pages/XxxPage'))`. When a page becomes a folder, update the import path to `./pages/xxx` (folder with `index.tsx` default export).
- Follow existing code style: 4-space indent, Tailwind classes inline, `@/` alias available but existing pages use relative imports — keep relative imports inside a page folder.
- Extraction rule: when a piece of JSX + its local state moves to a new file, pass everything it needs as props. Do NOT introduce context providers, reducers, or new state libraries. Props are enough.
- Commit after each task with `refactor:` prefix.

## Extraction Method (applies to Tasks 1–4)

For each page split, follow this exact procedure:

1. Read the whole file first. List its top-level pieces: types/interfaces, helper functions, constants, sub-render functions or large JSX blocks (modals, forms, tab panels, tables).
2. Create the folder `apps/web/src/pages/<name>/`.
3. Move shared types + pure helpers to `types.ts` and `utils.ts` inside the folder. Export them named.
4. Move each modal/form/tab-panel into its own component file. The component receives its data and callbacks as props — signature documented per task below.
5. The remaining orchestrator (state, queries, layout) goes to `index.tsx`, default-exporting a component with the **same name and props** as before.
6. Delete the original `XxxPage.tsx`. Update the lazy import in `apps/web/src/App.tsx`.
7. `git diff --stat` sanity check: total insertions ≈ deletions (moves, not rewrites).

---

### Task 1: Split ReportsPage (127K → folder)

**Files:**
- Create: `apps/web/src/pages/reports/index.tsx`, `apps/web/src/pages/reports/types.ts`, `apps/web/src/pages/reports/utils.ts`, plus one file per report section (expected: `ExpenseReport.tsx`, `GoalReport.tsx`, `ProjectReport.tsx`, `HouseworkReport.tsx`, `HealthReport.tsx`, `FundReport.tsx`, `AssetReport.tsx` — match the actual tabs/sections found in the file)
- Delete: `apps/web/src/pages/ReportsPage.tsx`
- Modify: `apps/web/src/App.tsx` (one line: `lazy(() => import('./pages/reports'))`)

**Interfaces:**
- Produces: `pages/reports/index.tsx` default-exports `ReportsPage` (same props as today — currently none).
- Each section component signature: `function ExpenseReport({ params }: { params: ReportParams })` where `ReportParams` is the shared filter state type (date range, user filter, whatever the current page passes between sections) defined in `types.ts`. Derive the exact fields from the existing code — the rule is: whatever local state the section reads today becomes its props.

**Steps:**

- [ ] **Step 1: Read `ReportsPage.tsx` end to end.** Write down (as a comment block in your working notes, not the code) the section list and what state each section consumes.
- [ ] **Step 2: Create `types.ts` + `utils.ts`** with the shared types/helpers moved verbatim.
- [ ] **Step 3: Extract each report section** to its own file per the Extraction Method. Additionally wrap each section in `React.lazy` inside `index.tsx` so a report tab's chart code loads only when opened:

```tsx
// index.tsx pattern
import { lazy, Suspense } from 'react';
const ExpenseReport = lazy(() => import('./ExpenseReport'));
// ... render:
<Suspense fallback={<div className="p-8 text-center text-sm opacity-60">Loading…</div>}>
    {activeTab === 'EXPENSES' && <ExpenseReport params={params} />}
</Suspense>
```

- [ ] **Step 4: Update `App.tsx` import**, delete old file.
- [ ] **Step 5: Verify:** `cd apps/web && npx tsc --noEmit && npm run build`. Expected: build succeeds, `dist/assets/` now contains separate chunks per report section, and `ReportsPage` chunk shrinks from ~467 kB.
- [ ] **Step 6: Manually verify** each report tab renders (run `npm run dev`, open `/reports`, click every tab).
- [ ] **Step 7: Commit** `refactor: split ReportsPage into per-section components`

### Task 2: Split GoalsPage (112K → folder)

**Files:**
- Create: `apps/web/src/pages/goals/index.tsx`, `types.ts`, `utils.ts`, `GoalForm.tsx`, `TaskForm.tsx`, `GoalList.tsx`, `TaskList.tsx`, `CheckInModal.tsx` (adjust names to actual structure found)
- Delete: `apps/web/src/pages/GoalsPage.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Produces: `pages/goals/index.tsx` default-exports `GoalsPage({ forcedTab }: { forcedTab?: 'GOALS' | 'TASKS' })` — **must keep the `forcedTab` prop**, `App.tsx` uses it for both `/goals` and `/tasks` routes.
- Form components keep the NotificationFields pattern intact: `...emptyNotification` / `loadNotificationState` / `buildNotificationPayload` stay inside the form component that owns the form state.

**Steps:**

- [ ] **Step 1: Read file, map sections** (goals tab, tasks tab, forms, check-in modal).
- [ ] **Step 2–4: Extract** per the Extraction Method. Forms own their form state; lists receive `items` + callbacks (`onEdit(item)`, `onDelete(id)`) as props.
- [ ] **Step 5: Verify:** `npx tsc --noEmit && npm run build` pass; dev-run `/goals` and `/tasks`: create, edit (with a notification set), delete one item each.
- [ ] **Step 6: Commit** `refactor: split GoalsPage into goals/ folder`

### Task 3: Split HealthbookPage (92K → folder)

**Files:**
- Create: `apps/web/src/pages/healthbook/index.tsx`, `types.ts`, `PersonList.tsx`, `PersonDetail.tsx`, `LogForm.tsx`, `FileSection.tsx` (adjust to actual structure)
- Delete: `apps/web/src/pages/HealthbookPage.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Produces: default export `HealthbookPage` (no props). **Must keep reading `personId` from `useParams()`** — route `/healthbook/:personId` depends on it; keep that logic in `index.tsx` and pass `personId` down as a prop.

**Steps:**

- [ ] **Step 1–3: Extract** per the Extraction Method.
- [ ] **Step 4: Verify:** typecheck + build; dev-run `/healthbook`, open a person via URL `/healthbook/<id>` directly (deep-link must still work), add a log with a file.
- [ ] **Step 5: Commit** `refactor: split HealthbookPage into healthbook/ folder`

### Task 4: Split ProjectsPage (87K → folder)

**Files:**
- Create: `apps/web/src/pages/projects/index.tsx`, `types.ts`, `KanbanBoard.tsx`, `TaskCard.tsx`, `ProjectForm.tsx`, `TaskForm.tsx` (adjust to actual structure)
- Delete: `apps/web/src/pages/ProjectsPage.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Produces: default export `ProjectsPage` (no props). Drag-and-drop state stays in `KanbanBoard.tsx`; the board receives `tasks`, `onMove(taskId, newStatus)` from `index.tsx`.

**Steps:**

- [ ] **Step 1–3: Extract** per the Extraction Method.
- [ ] **Step 4: Verify:** typecheck + build; dev-run: drag a card between columns, edit a task, toggle project sharing.
- [ ] **Step 5: Commit** `refactor: split ProjectsPage into projects/ folder`

### Task 5: Split API reports route (51K → folder)

**Files:**
- Create: `apps/api/src/routes/reports/index.ts` plus one file per report domain (`expenses.ts`, `goals.ts`, `projects.ts`, `housework.ts`, `health.ts`, `funds.ts`, `assets.ts` — match actual endpoints in the file)
- Delete: `apps/api/src/routes/reports.ts`
- Modify: nothing else — `apps/api/src/app.ts` imports the route by path `./routes/reports`, which resolves to the new `reports/index.ts` automatically. Verify the exact import specifier in `app.ts` first; if it says `./routes/reports.js` or similar, update it.

**Interfaces:**
- Produces: `routes/reports/index.ts` default-exports the same Express router with identical paths and middleware. Pattern:

```ts
// routes/reports/index.ts
import { Router } from 'express';
import expenseReports from './expenses';
import goalReports from './goals';
// ...
const router = Router();
router.use(expenseReports);
router.use(goalReports);
// ...
export default router;
```

Each sub-file creates its own `Router()`, keeps the **exact same sub-paths and auth middleware** as the original, and default-exports it. Shared helpers (date-range parsing etc.) go to `routes/reports/helpers.ts`.

**Steps:**

- [ ] **Step 1: Read `reports.ts`,** list every endpoint and its middleware chain.
- [ ] **Step 2: Extract** per domain, verbatim moves.
- [ ] **Step 3: Verify:** `cd apps/api && npx tsc --noEmit && npm test`. All existing tests pass.
- [ ] **Step 4: Route parity check:** run `grep -c "router\.\(get\|post\|put\|delete\|patch\)" ` on old file (from git: `git show HEAD:apps/api/src/routes/reports.ts | grep -c ...`) vs the sum over new files. Counts must match.
- [ ] **Step 5: Commit** `refactor: split reports route into per-domain files`

### Task 6: Web test harness + smoke tests

**Files:**
- Create: `apps/web/vitest.config.ts`, `apps/web/src/test/setup.ts`, `apps/web/src/test/features.test.ts`, `apps/web/src/test/LoginPage.test.tsx`
- Modify: `apps/web/package.json` (add script + dev deps)

**Interfaces:**
- Produces: `npm test` works inside `apps/web`.

**Steps:**

- [ ] **Step 1: Install dev deps:**

```bash
cd apps/web && npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Create `apps/web/vitest.config.ts`:**

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        globals: true,
    },
});
```

- [ ] **Step 3: Create `apps/web/src/test/setup.ts`:**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Add script** to `apps/web/package.json`: `"test": "vitest run"`.
- [ ] **Step 5: Write `features.test.ts`** — pure-function unit tests, write these first because they need no mocking:

```ts
import { describe, it, expect } from 'vitest';
import { getFeatureFlags, isFeatureRouteEnabled, getMobileNavItems, isRouteAccessible, DEFAULT_MOBILE_NAV_ITEMS } from '../config/features';

describe('feature flags', () => {
    it('defaults all flags on', () => {
        expect(getFeatureFlags(null).featureGoals).toBe(true);
    });
    it('source overrides default', () => {
        expect(getFeatureFlags({ featureGoals: false }).featureGoals).toBe(false);
    });
    it('unknown route is always enabled', () => {
        expect(isFeatureRouteEnabled('/settings', { featureGoals: false })).toBe(true);
    });
    it('disabled feature blocks its route', () => {
        expect(isFeatureRouteEnabled('/goals', { featureGoals: false })).toBe(false);
    });
    it('mobile nav falls back to defaults when list invalid', () => {
        expect(getMobileNavItems({ mobileNavItems: ['/goals'] })).toEqual([...DEFAULT_MOBILE_NAV_ITEMS]);
    });
    it('route in mobile nav stays accessible even when feature off', () => {
        expect(isRouteAccessible('/goals', { featureGoals: false, mobileNavItems: ['/', '/goals', '/tasks', '/settings'] })).toBe(true);
    });
});
```

- [ ] **Step 6: Run:** `npm test` — expect all pass.
- [ ] **Step 7: Write `LoginPage.test.tsx`** — render smoke test. Mock the auth store and api client minimally:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';

vi.mock('../api/client', () => ({ default: { post: vi.fn() }, api: { post: vi.fn() } }));

describe('LoginPage', () => {
    it('renders email and password fields', () => {
        render(<MemoryRouter><LoginPage /></MemoryRouter>);
        expect(screen.getByLabelText(/email/i) || screen.getByPlaceholderText(/email/i)).toBeTruthy();
        expect(document.querySelector('input[type="password"]')).toBeTruthy();
    });
});
```

Adjust the mock to match the real export shape of `src/api/client.ts` (read it first) and the queries to the actual markup. Keep it a smoke test — renders without crashing + fields exist. No submit-flow test in this plan.

- [ ] **Step 8: Run** `npm test` — all pass. Then full check: `npx tsc --noEmit && npm run build`.
- [ ] **Step 9: Commit** `test: add web test harness with feature-flag and login smoke tests`
