# Module System & White-Label Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app white-label-able for open source: rename the app at setup time, gate Family/Hobby module groups app-wide (Personal + core always on), first-run setup wizard, and template-based page instances — admins add new pages under a module group from a template (Task / Project / Expense / Goal) without code changes.

**Architecture:** A singleton `AppSetting` row holds app name + enabled module groups; a public endpoint exposes it pre-auth. A `PageInstance` table holds admin-created pages; each is a named instance of an existing module type. Existing module tables (`Task`, `Project`, `Expense`, `Goal`) gain a nullable `instanceId` — `NULL` means the built-in default page, so all existing data and routes keep working unchanged. New pages route to `/p/:slug` which renders the existing page component with an `instanceId` prop.

**Tech Stack:** Existing stack only. Prisma migration ×2, Express routes ×2 new files, Zod validators, React Router param route, Zustand store extension.

## Global Constraints

- **Backward compatible:** existing routes (`/tasks`, `/projects`, `/expenses`, `/goals`, …) and existing data behave exactly as today. `instanceId = null` is the default everywhere.
- App-level module groups: `personal` is always enabled (server enforces); `family` and `hobby` are toggleable by OWNER. Per-user feature flags (existing `featureXxx` columns on `User`) remain as personal visibility preferences layered **under** the app-level gate: a route is visible iff `group enabled app-wide AND user flag on`.
- Page instances support exactly 4 template types in v1: `TASK`, `PROJECT`, `EXPENSE`, `GOAL`. Instances can be assigned to any group (`personal` | `family` | `hobby`). No custom fields, no schema-less pages (explicitly out of scope).
- All new API inputs validated with Zod via the existing `validate(schema)` middleware (`apps/api/src/middleware/validate.ts`).
- All env access through `apps/api/src/config/env.ts`, never `process.env` directly.
- After each schema change: `npm run db:generate`, then `cd apps/api && npx prisma migrate dev --name <name>`, then **mirror the same change into `apps/api/prisma/schema.test.prisma`** (SQLite test schema — kept in sync by hand; enums there follow the existing style in that file, check how existing enums are declared and copy the style).
- API tests live in `apps/api/src/test/`, run with `cd apps/api && npm test` (sequential, real SQLite DB). Follow the structure of an existing test file (read one, e.g. whatever covers goals or settings, before writing new tests).
- Commit after each task. `feat:` prefix.
- **Run this plan AFTER the 2026-07-10-codebase-refactor plan** (page folders). If refactor not done, page-component file paths in Tasks 8–9 refer to the old `pages/XxxPage.tsx` files instead — adapt paths, logic identical.

---

### Task 1: AppSetting model + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`, `apps/api/prisma/schema.test.prisma`

**Interfaces:**
- Produces: Prisma model `AppSetting` — consumed by Tasks 2, 3.

**Steps:**

- [ ] **Step 1: Add model** to `schema.prisma`:

```prisma
model AppSetting {
  id             Int      @id @default(1)
  appName        String   @default("NgốcKý")
  enabledGroups  Json     @default("[\"personal\",\"family\",\"hobby\"]")
  setupCompleted Boolean  @default(false)
  updatedAt      DateTime @updatedAt
}
```

- [ ] **Step 2: Migrate:** `cd apps/api && npx prisma migrate dev --name app-settings && npm run db:generate` (run from repo root for db:generate if the script lives there). Expected: migration created, client regenerated.
- [ ] **Step 3: Mirror model into `schema.test.prisma`** (same fields; keep SQLite-compatible — `Json` is supported by Prisma on SQLite).
- [ ] **Step 4: Verify:** `cd apps/api && npm test` — existing suite passes (test DB now includes the table).
- [ ] **Step 5: Commit** `feat: add AppSetting model`

### Task 2: App-settings service + routes

**Files:**
- Create: `apps/api/src/services/appSettings.ts`, `apps/api/src/routes/app-settings.ts`, `apps/api/src/validators/appSettings.ts`, `apps/api/src/test/app-settings.test.ts`
- Modify: `apps/api/src/app.ts` (mount route)

**Interfaces:**
- Produces:
  - `AppSettingsService.get(): Promise<{ appName: string; enabledGroups: string[]; setupCompleted: boolean }>` — upserts the singleton row on first read.
  - `AppSettingsService.update(data: { appName?: string; enabledGroups?: string[] }): Promise<same>` — consumed by Task 3 (setup) and the route.
  - HTTP: `GET /api/app-settings` (public, no auth — login page needs the app name), `PUT /api/app-settings` (OWNER only).

**Steps:**

- [ ] **Step 1: Write failing test** `apps/api/src/test/app-settings.test.ts` (follow the request/auth helper pattern of an existing test file — read one first):

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';
// + whatever login/owner-helper the existing tests use

describe('app-settings', () => {
    it('GET is public and returns defaults', async () => {
        const res = await request(app).get('/api/app-settings');
        expect(res.status).toBe(200);
        expect(res.body.appName).toBe('NgốcKý');
        expect(res.body.enabledGroups).toContain('personal');
    });

    it('PUT requires OWNER', async () => {
        const res = await request(app).put('/api/app-settings').send({ appName: 'X' });
        expect(res.status).toBe(401);
    });

    it('PUT updates name and groups, personal cannot be disabled', async () => {
        const token = await loginAsOwner(); // reuse existing test helper
        const res = await request(app)
            .put('/api/app-settings')
            .set('Authorization', `Bearer ${token}`)
            .send({ appName: 'FamilyHub', enabledGroups: ['family'] });
        expect(res.status).toBe(200);
        expect(res.body.appName).toBe('FamilyHub');
        expect(res.body.enabledGroups).toEqual(expect.arrayContaining(['personal', 'family']));
        expect(res.body.enabledGroups).not.toContain('hobby');
    });
});
```

- [ ] **Step 2: Run** `npx vitest run src/test/app-settings.test.ts` — expect FAIL (404 route missing).
- [ ] **Step 3: Implement service** `apps/api/src/services/appSettings.ts`:

```ts
import { prisma } from '../config/database';

const GROUPS = ['personal', 'family', 'hobby'] as const;
export type ModuleGroup = (typeof GROUPS)[number];

function normalizeGroups(raw: unknown): ModuleGroup[] {
    const list = Array.isArray(raw) ? raw.filter((g): g is ModuleGroup => (GROUPS as readonly string[]).includes(g)) : [];
    // personal is always on
    return [...new Set(['personal' as ModuleGroup, ...list])];
}

export class AppSettingsService {
    static async get() {
        const row = await prisma.appSetting.upsert({
            where: { id: 1 },
            update: {},
            create: { id: 1 },
        });
        return { appName: row.appName, enabledGroups: normalizeGroups(row.enabledGroups), setupCompleted: row.setupCompleted };
    }

    static async update(data: { appName?: string; enabledGroups?: string[]; setupCompleted?: boolean }) {
        await this.get(); // ensure row exists
        const row = await prisma.appSetting.update({
            where: { id: 1 },
            data: {
                ...(data.appName !== undefined ? { appName: data.appName } : {}),
                ...(data.enabledGroups !== undefined ? { enabledGroups: normalizeGroups(data.enabledGroups) } : {}),
                ...(data.setupCompleted !== undefined ? { setupCompleted: data.setupCompleted } : {}),
            },
        });
        return { appName: row.appName, enabledGroups: normalizeGroups(row.enabledGroups), setupCompleted: row.setupCompleted };
    }
}
```

- [ ] **Step 4: Validator** `apps/api/src/validators/appSettings.ts`:

```ts
import { z } from 'zod';

export const updateAppSettingsSchema = z.object({
    appName: z.string().trim().min(1).max(60).optional(),
    enabledGroups: z.array(z.enum(['personal', 'family', 'hobby'])).optional(),
});
```

- [ ] **Step 5: Route** `apps/api/src/routes/app-settings.ts` (copy middleware import style from an existing route file):

```ts
import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { updateAppSettingsSchema } from '../validators/appSettings';
import { AppSettingsService } from '../services/appSettings';

const router = Router();

router.get('/', async (_req, res, next) => {
    try {
        res.json(await AppSettingsService.get());
    } catch (err) { next(err); }
});

router.put('/', authenticate, requireRole('OWNER'), validate(updateAppSettingsSchema), async (req, res, next) => {
    try {
        res.json(await AppSettingsService.update(req.body));
    } catch (err) { next(err); }
});

export default router;
```

Check the real names/signatures in `apps/api/src/middleware/auth.ts` (`authenticate`, `requireRole`) and match them exactly.

- [ ] **Step 6: Mount** in `apps/api/src/app.ts`: `app.use('/api/app-settings', appSettingsRoutes);` alongside existing mounts.
- [ ] **Step 7: Run test** — PASS. Run full suite `npm test` — PASS.
- [ ] **Step 8: Commit** `feat: app settings API (name, module groups)`

### Task 3: Setup wizard API

**Files:**
- Create: `apps/api/src/routes/setup.ts`, `apps/api/src/validators/setup.ts`, `apps/api/src/test/setup-wizard.test.ts`
- Modify: `apps/api/src/app.ts` (mount), `apps/api/src/index.ts` (make env-var owner seeding optional)

**Interfaces:**
- Consumes: `AppSettingsService.update` (Task 2); `AuthService` password-hashing — read `apps/api/src/services/auth.ts:219` `seedOwner()` and reuse its hashing approach (same bcrypt call/rounds).
- Produces: `GET /api/setup/status` → `{ needsSetup: boolean }` (public). `POST /api/setup` → creates OWNER + writes app settings; only allowed while no user exists. Consumed by web Task 6 and by the macOS plan.

**Steps:**

- [ ] **Step 1: Failing test** `apps/api/src/test/setup-wizard.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('setup wizard', () => {
    it('reports needsSetup=true on empty DB', async () => {
        const res = await request(app).get('/api/setup/status');
        expect(res.status).toBe(200);
        expect(res.body.needsSetup).toBe(true);
    });

    it('creates owner and app settings, then locks', async () => {
        const res = await request(app).post('/api/setup').send({
            appName: 'FamilyHub',
            enabledGroups: ['personal', 'family'],
            owner: { email: 'boss@example.com', password: 'Secret123!', name: 'Boss' },
        });
        expect(res.status).toBe(201);

        const status = await request(app).get('/api/setup/status');
        expect(status.body.needsSetup).toBe(false);

        const again = await request(app).post('/api/setup').send({
            appName: 'Hijack', enabledGroups: [], owner: { email: 'evil@example.com', password: 'x'.repeat(10), name: 'Evil' },
        });
        expect(again.status).toBe(403);

        // owner can actually log in
        const login = await request(app).post('/api/auth/login').send({ email: 'boss@example.com', password: 'Secret123!' });
        expect(login.status).toBe(200);
    });
});
```

Adjust the login endpoint path/body to the real one in `apps/api/src/routes/auth.ts`.

- [ ] **Step 2: Run** — FAIL (404).
- [ ] **Step 3: Validator** `apps/api/src/validators/setup.ts`:

```ts
import { z } from 'zod';

export const setupSchema = z.object({
    appName: z.string().trim().min(1).max(60),
    enabledGroups: z.array(z.enum(['personal', 'family', 'hobby'])),
    owner: z.object({
        email: z.string().email(),
        password: z.string().min(8).max(128),
        name: z.string().trim().min(1).max(80),
    }),
});
```

- [ ] **Step 4: Route** `apps/api/src/routes/setup.ts`. Security note (this is a trust boundary — do not simplify): the POST must re-check `userCount === 0` inside the handler, not rely on the client having seen `needsSetup: true`.

```ts
import { Router } from 'express';
import { prisma } from '../config/database';
import { validate } from '../middleware/validate';
import { setupSchema } from '../validators/setup';
import { AppSettingsService } from '../services/appSettings';
// import the same bcrypt helper AuthService.seedOwner uses

const router = Router();

router.get('/status', async (_req, res, next) => {
    try {
        const count = await prisma.user.count();
        res.json({ needsSetup: count === 0 });
    } catch (err) { next(err); }
});

router.post('/', validate(setupSchema), async (req, res, next) => {
    try {
        const count = await prisma.user.count();
        if (count > 0) return res.status(403).json({ error: 'Setup already completed' });
        const { appName, enabledGroups, owner } = req.body;
        await prisma.user.create({
            data: {
                email: owner.email,
                name: owner.name,
                password: await hashPassword(owner.password), // exact same hashing as AuthService.seedOwner
                role: 'OWNER',
            },
        });
        await AppSettingsService.update({ appName, enabledGroups, setupCompleted: true });
        res.status(201).json({ ok: true });
    } catch (err) { next(err); }
});

export default router;
```

If `AuthService` has no exported hash helper, extract one (move the bcrypt call from `seedOwner` into a small exported function and reuse it in both places — do not duplicate the bcrypt rounds constant).

- [ ] **Step 5: Mount** `app.use('/api/setup', setupRoutes);` in `app.ts`.
- [ ] **Step 6: Keep env seeding working:** in `apps/api/src/index.ts`, `AuthService.seedOwner()` stays but must be a no-op when `OWNER_EMAIL` is unset (check its current behavior; if it throws on missing env, guard it: `if (config.OWNER_EMAIL) await AuthService.seedOwner();`). Docker users keep env-based seeding; fresh installs without env get the wizard.
- [ ] **Step 7: Run tests** — PASS. Full suite — PASS.
- [ ] **Step 8: Commit** `feat: first-run setup wizard API`

### Task 4: PageInstance model + instanceId columns

**Files:**
- Modify: `apps/api/prisma/schema.prisma`, `apps/api/prisma/schema.test.prisma`

**Interfaces:**
- Produces: `PageInstance` model; `instanceId String?` on `Task`, `Project`, `Expense`, `Goal`. Consumed by Tasks 5, 7.

**Steps:**

- [ ] **Step 1: Add to `schema.prisma`:**

```prisma
enum PageModuleType {
  TASK
  PROJECT
  EXPENSE
  GOAL
}

model PageInstance {
  id          String         @id @default(cuid())
  name        String
  slug        String         @unique
  moduleType  PageModuleType
  group       String         // 'personal' | 'family' | 'hobby'
  icon        String?
  createdById String
  createdBy   User           @relation(fields: [createdById], references: [id])
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  tasks    Task[]
  projects Project[]
  expenses Expense[]
  goals    Goal[]
}
```

And on each of `Task`, `Project`, `Expense`, `Goal`:

```prisma
  instanceId String?
  instance   PageInstance? @relation(fields: [instanceId], references: [id], onDelete: Cascade)

  @@index([instanceId])
```

(`onDelete: Cascade` — deleting a page deletes its items; the delete endpoint in Task 5 warns via item count first. Add the `pageInstances PageInstance[]` back-relation on `User`.)

- [ ] **Step 2: Migrate** `npx prisma migrate dev --name page-instances`, regenerate client.
- [ ] **Step 3: Mirror into `schema.test.prisma`.**
- [ ] **Step 4: Verify** `npm test` — existing suite still green (all existing rows have `instanceId = null`, nothing filters on it yet).
- [ ] **Step 5: Commit** `feat: PageInstance model and instanceId columns`

### Task 5: Pages API + instance filtering in module routes

**Files:**
- Create: `apps/api/src/routes/pages.ts`, `apps/api/src/validators/pages.ts`, `apps/api/src/test/pages.test.ts`
- Modify: `apps/api/src/app.ts`; `apps/api/src/routes/tasks.ts`, `projects.ts`, `expenses.ts`, `goals.ts`; their validators in `apps/api/src/validators/`

**Interfaces:**
- Produces:
  - `GET /api/pages` (any authed user) → `PageInstance[]`; `POST /api/pages` / `PUT /api/pages/:id` / `DELETE /api/pages/:id` (ADMIN+). POST body `{ name, moduleType, group, icon? }`; slug generated server-side from name (lowercase, dashes, suffix `-2` on collision).
  - Module list endpoints accept `?instanceId=<id>`; **omitted or empty → filter `instanceId: null`** (default pages never show instance data). Create/update endpoints accept optional `instanceId` in body.
- Consumes: `PageInstance` model (Task 4).

**Steps:**

- [ ] **Step 1: Failing tests** `apps/api/src/test/pages.test.ts`:

```ts
describe('page instances', () => {
    it('ADMIN creates a page, slug generated', async () => {
        const res = await ownerReq().post('/api/pages').send({ name: 'Work Tasks', moduleType: 'TASK', group: 'personal' });
        expect(res.status).toBe(201);
        expect(res.body.slug).toBe('work-tasks');
    });

    it('USER cannot create a page', async () => {
        const res = await userReq().post('/api/pages').send({ name: 'X', moduleType: 'TASK', group: 'personal' });
        expect(res.status).toBe(403);
    });

    it('tasks are partitioned by instanceId', async () => {
        const page = (await ownerReq().post('/api/pages').send({ name: 'Work', moduleType: 'TASK', group: 'personal' })).body;
        await ownerReq().post('/api/tasks').send({ /* minimal valid task body — copy from existing tasks test */ title: 'default task' });
        await ownerReq().post('/api/tasks').send({ title: 'work task', instanceId: page.id });

        const defaults = (await ownerReq().get('/api/tasks')).body;
        const work = (await ownerReq().get(`/api/tasks?instanceId=${page.id}`)).body;
        expect(defaults.map((t: any) => t.title)).toContain('default task');
        expect(defaults.map((t: any) => t.title)).not.toContain('work task');
        expect(work.map((t: any) => t.title)).toEqual(['work task']);
    });

    it('rejects unknown instanceId on create', async () => {
        const res = await ownerReq().post('/api/tasks').send({ title: 'x', instanceId: 'nope' });
        expect(res.status).toBe(400);
    });
});
```

(`ownerReq`/`userReq` = whatever auth helpers the existing tests use; the task body must match the real `tasks` validator — read `apps/api/src/routes/tasks.ts` and its validator first.)

- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement `routes/pages.ts` + `validators/pages.ts`.** Validator:

```ts
import { z } from 'zod';

export const createPageSchema = z.object({
    name: z.string().trim().min(1).max(60),
    moduleType: z.enum(['TASK', 'PROJECT', 'EXPENSE', 'GOAL']),
    group: z.enum(['personal', 'family', 'hobby']),
    icon: z.string().max(40).optional(),
});
export const updatePageSchema = createPageSchema.partial().omit({ moduleType: true });
```

Slug helper in the route file:

```ts
function slugify(name: string) {
    return name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'page';
}
async function uniqueSlug(name: string) {
    const base = slugify(name);
    let slug = base;
    for (let i = 2; await prisma.pageInstance.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
    return slug;
}
```

Routes: GET list (authenticate only), POST/PUT/DELETE with `requireRole('ADMIN')`. DELETE returns `{ deletedItems: n }` — count related rows before delete so the UI can confirm.

- [ ] **Step 4: Instance filtering in the 4 module routes.** Worked example for `tasks.ts` — apply the identical pattern to `projects.ts`, `expenses.ts`, `goals.ts`:

  1. In the module's Zod create/update schema add: `instanceId: z.string().cuid().optional().nullable()`.
  2. In the list handler, where the Prisma `where` object is built, add:

  ```ts
  const instanceId = typeof req.query.instanceId === 'string' && req.query.instanceId ? req.query.instanceId : null;
  where.instanceId = instanceId;
  ```

  3. In the create handler, if `req.body.instanceId` is set, verify it exists and its `moduleType` matches (TASK for tasks route, etc.); 400 otherwise:

  ```ts
  if (req.body.instanceId) {
      const page = await prisma.pageInstance.findUnique({ where: { id: req.body.instanceId } });
      if (!page || page.moduleType !== 'TASK') return res.status(400).json({ error: 'Invalid instanceId' });
  }
  ```

  4. Pass `instanceId: req.body.instanceId ?? null` into the create data.
  5. **Do not** allow changing `instanceId` on update (strip it from update data) — moving items between pages is out of scope v1.
  6. Check each route's secondary endpoints (stats/summary endpoints inside the same file, e.g. expense totals) — any aggregate the page displays must take the same `instanceId` filter.

  Note for `goals.ts`: the goals route serves both Goals and Tasks tabs? No — tasks live in `tasks.ts`. Read both files; whichever queries `Task`/`Goal` tables for lists gets the filter.
  Note for `projects.ts`: `ProjectTask` rows belong to a project; they inherit partitioning via their project — no `instanceId` needed on `ProjectTask`.
  Note for dashboards/reports (`dashboard.ts`, `reports/`): v1 leaves them aggregating over **all** rows (default + instances). Acceptable; document in README later. Do not change them in this plan.

- [ ] **Step 5: Mount** `app.use('/api/pages', pagesRoutes);`. Run tests — PASS. Full suite — PASS.
- [ ] **Step 6: Commit** `feat: page instances API and instance filtering`

### Task 6: Web — app settings, branding, setup wizard

**Files:**
- Create: `apps/web/src/pages/SetupPage.tsx`, `apps/web/src/api/appSettings.ts`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/layouts/AppLayout.tsx`, `apps/web/src/pages/LoginPage.tsx`, `apps/web/src/stores/` (add or extend a store)

**Interfaces:**
- Consumes: `GET /api/app-settings`, `GET /api/setup/status`, `POST /api/setup` (Tasks 2–3).
- Produces: `useAppSettings()` TanStack Query hook in `apps/web/src/api/appSettings.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import client from './client'; // match real export of api/client.ts

export type AppSettings = { appName: string; enabledGroups: Array<'personal' | 'family' | 'hobby'>; setupCompleted: boolean };

export function useAppSettings() {
    return useQuery<AppSettings>({
        queryKey: ['app-settings'],
        queryFn: async () => (await client.get('/app-settings')).data,
        staleTime: 5 * 60_000,
    });
}
```

(Match the axios instance's baseURL convention — check whether existing calls use `/api/...` or `/...`.)

**Steps:**

- [ ] **Step 1: Hook + branding.** In `AppLayout.tsx` and `LoginPage.tsx`, replace the hardcoded app-name strings (grep `NgốcKý` / `NgocKy` in both files) with `useAppSettings().data?.appName ?? 'NgốcKý'`. Set `document.title = appName` in an effect in `App.tsx`.
- [ ] **Step 2: Setup gate.** In `App.tsx`, before rendering routes, query `/api/setup/status` (only when unauthenticated); if `needsSetup`, render `<SetupPage />` instead of the login route.
- [ ] **Step 3: `SetupPage.tsx`** — single page, three sections in one form (match LoginPage's visual style — read it first): app name input; module group checkboxes (Personal checked+disabled, Family, Hobby); owner account (name, email, password + confirm). Client-side check password === confirm. Submit → `POST /api/setup` → on success invalidate `['app-settings']` and redirect to `/login`.
- [ ] **Step 4: Group gating in nav.** In `config/features.ts` add:

```ts
export function getEnabledGroups(appGroups?: string[] | null): Array<FeatureGroup['id']> {
    const enabled = new Set(appGroups ?? ['personal', 'family', 'hobby']);
    enabled.add('personal');
    return FEATURE_GROUPS.map((g) => g.id).filter((id) => enabled.has(id));
}
```

Sidebar (in `AppLayout.tsx`) hides groups not in `getEnabledGroups(appSettings?.enabledGroups)`. `FeatureRoute` in `App.tsx` also blocks routes whose group is disabled: extend `isRouteAccessible(route, user, appGroups)` — route's group looked up via `FEATURE_GROUPS`; disabled group → inaccessible regardless of user flags or mobile nav.
- [ ] **Step 5: Settings UI for OWNER.** In `SettingsPage.tsx` (or `pages/settings/` post-refactor) add an "Application" section visible to OWNER only: app name text field + Family/Hobby toggles → `PUT /api/app-settings`, invalidate `['app-settings']` on success.
- [ ] **Step 6: Update web tests.** If `apps/web/src/test/features.test.ts` exists (from the refactor plan), extend it: disabled group blocks route regardless of user flags — `expect(isRouteAccessible('/keyboard', user, ['personal'])).toBe(false)` and enabled group keeps old behavior. Keep the third parameter optional so existing 2-arg tests still pass. Run `npm test` in apps/web.
- [ ] **Step 7: Verify:** `npx tsc --noEmit && npm run build`. Manual: wipe dev DB (`npx prisma migrate reset` in apps/api) → open app → wizard appears → complete it → login works → rename app in Settings → header + title update; disable Hobby → Keyboard/Funds/Learning vanish from sidebar and direct URL `/keyboard` redirects to `/`.
- [ ] **Step 8: Commit** `feat: setup wizard, app branding, module group gating`

### Task 7: Web — instance pages

**Files:**
- Create: `apps/web/src/api/pages.ts`, `apps/web/src/pages/InstancePage.tsx`, `apps/web/src/components/AddPageModal.tsx`
- Modify: `apps/web/src/App.tsx` (route `/p/:slug`), `apps/web/src/layouts/AppLayout.tsx` (sidebar instances + Add page button), the four page components (`pages/goals/index.tsx`, `pages/projects/index.tsx`, `ExpensesPage.tsx`→`pages/expenses/`, tasks view inside goals — see Step 3)

**Interfaces:**
- Consumes: `/api/pages` CRUD (Task 5); module endpoints' `?instanceId` (Task 5).
- Produces: each of the four module page components accepts optional prop `instanceId?: string` and `pageTitle?: string`. **Contract:** when `instanceId` is set, every list query, every aggregate query, and every create mutation for that page's primary entity carries it; query keys include it (`['tasks', instanceId]`) so pages don't share cache.

**Steps:**

- [ ] **Step 1: `api/pages.ts`** — `usePages()` query (`['pages']`), `useCreatePage/useUpdatePage/useDeletePage` mutations invalidating `['pages']`.
- [ ] **Step 2: Route + resolver.** In `App.tsx`:

```tsx
<Route path="p/:slug" element={<FeatureRouteForInstance><InstancePage /></FeatureRouteForInstance>} />
```

`InstancePage.tsx` reads `slug` via `useParams`, finds the page in `usePages()` data (loading → null; unknown slug → `<Navigate to="/" replace />`), then renders by `moduleType`:

```tsx
const byType = {
    TASK: (p: PageInstanceDto) => <GoalsPage forcedTab="TASKS" instanceId={p.id} pageTitle={p.name} />,
    PROJECT: (p: PageInstanceDto) => <ProjectsPage instanceId={p.id} pageTitle={p.name} />,
    EXPENSE: (p: PageInstanceDto) => <ExpensesPage instanceId={p.id} pageTitle={p.name} />,
    GOAL: (p: PageInstanceDto) => <GoalsPage forcedTab="GOALS" instanceId={p.id} pageTitle={p.name} />,
};
```

Instance-page access follows its group: reuse `getEnabledGroups`; disabled group → redirect `/`.
- [ ] **Step 3: Thread `instanceId` through the four components.** Worked example (tasks view): add prop `instanceId?: string`; in every `useQuery` for the task list change key to `['tasks', instanceId ?? 'default', ...existing key parts]` and append `instanceId` to the request params when set; in create mutation body add `instanceId`; after mutations invalidate the instance-scoped key. Render `pageTitle ?? 'Tasks'` as the heading. Repeat identically for projects, expenses, goals. Grep each component for its `queryKey` usages to catch aggregates (e.g. expense month summary) — all of them get the instanceId param.
- [ ] **Step 4: Sidebar.** In `AppLayout.tsx`, under each visible group render its instances from `usePages()` (`NavLink to={`/p/${page.slug}`}`, icon default `FileText` from lucide). Below each group (ADMIN+ only) an "+ Add page" affordance opening `AddPageModal` with name, template (Task/Project/Expense/Goal), group preselected. Page context menu or small edit affordance → rename/delete (delete confirms with `deletedItems` count from the API).
- [ ] **Step 5: Verify:** typecheck + build. Manual: create "Work Tasks" (TASK, personal) → appears in sidebar → add tasks there → `/tasks` does NOT show them and vice versa → create an EXPENSE page and confirm its totals exclude default expenses → delete the page, confirm items count warning, sidebar updates.
- [ ] **Step 6: Commit** `feat: template-based page instances in web UI`

### Task 8: Open-source packaging pass

**Files:**
- Create: `LICENSE` (MIT, copyright holder = repo owner), `CONTRIBUTING.md` (short: setup steps, test commands, PR expectations)
- Modify: `README.md`, `.env.example`, `docker-compose.yml`, `apps/api/src/config/env.ts`

**Steps:**

- [ ] **Step 1: `.env.example` audit** — every var present with placeholder values, no real emails/domains. `OWNER_*` vars marked optional ("leave unset to use the in-app setup wizard").
- [ ] **Step 2: Zero-edit compose:** in `docker-compose.yml` give safe dev defaults via `${VAR:-default}` for DB credentials and CORS; JWT secrets must NOT default silently — in `env.ts`, when `NODE_ENV !== 'production'` and a JWT secret is missing, generate a random one at boot with a loud console warning; in production missing secret still exits with error (keep current behavior).
- [ ] **Step 3: README rewrite:** what it is, screenshot placeholder, quick start (`docker compose up -d` → open localhost → wizard), module/template concept, dev setup, license badge.
- [ ] **Step 4: Verify:** fresh clone simulation — `git clean -xdf` in a scratch copy, `docker compose up -d`, complete wizard, create one item. 
- [ ] **Step 5: Commit** `chore: open-source packaging (license, readme, zero-config compose)`
