# Desktop Scheduled Reports + Scheduler Choice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desktop offline/shared modes execute scheduled reports (today only reminders fire, reports never run), and shared-db mode lets the user choose between the built-in scheduler and their own self-hosted n8n.

**Architecture:** The sidecar's in-process scheduler (`apps/api/src/services/scheduler.ts`) gains a `tickReports()` pass that calls the same service endpoints n8n uses (`GET /api/service/due-reports`, `GET /api/service/report-data/:id`), formats the result into text, and delivers via Telegram + the existing `recent` list that `DesktopNotifier.tsx` turns into OS notifications. Cross-desktop duplicate prevention (two family Macs in shared mode) is a new `lastSentAt` column on `ScheduledReport` claimed atomically inside `due-reports`. Desktop schema delivery moves to a frozen-baseline + numbered-diff model (the pattern `generate-baselines.mjs`'s header comment already prescribes). Onboarding stores `schedulerMode` for shared mode; Rust maps it to `SCHEDULER_ENABLED`.

**Tech Stack:** Express + Prisma 6 (postgres / sqlite desktop client), vitest, React 19, Tauri v2 (Rust).

## Global Constraints

- No new dependencies (npm or Rust).
- Offline mode behavior choice is unchanged: scheduler always on. Only shared mode gets the builtin-vs-n8n choice.
- Family-server (thin) mode and VPS production are untouched except that `due-reports` becomes claim-on-read (idempotent for n8n too — n8n polls every 15 min, window is 15 min, so it still fires each report exactly once).
- API tests: `cd apps/api && npx vitest run src/test/<file>`; full suite `cd apps/api && npm test`. Sequential, real SQLite test DB.
- Web verified with `npm run lint` (root); Rust with `cd apps/desktop/src-tauri && cargo check`.
- After changing `apps/api/prisma/schema.prisma`: run `npm run db:generate` (root) AND `cd apps/api && node scripts/generate-test-schema.mjs` (regenerates `schema.test.prisma`) AND `npm run db:generate:desktop` (regenerates `schema.desktop.prisma`). Never hand-edit the generated schemas.
- Telegram message hard limit 4096 chars — formatter truncates at 4000.
- VND amounts format with `toLocaleString('vi-VN')`.
- The service router's auth: `scheduler.ts` already calls `due-notifications` with header `X-Assistant-Api-Key` (see `serviceHeaders`) and tests pass, so the whole `/api/service` router accepts that key. `due-reports`/`report-data` doc comments mentioning "OWNER/ADMIN JWT" are stale — verify once with a curl/test, don't switch auth schemes.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Freeze desktop baseline migrations (refactor, no behavior change)

**Files:**
- Create: `apps/api/prisma/baseline/postgres.prisma` (committed snapshot)
- Create: `apps/api/prisma/baseline/sqlite.prisma` (committed snapshot)
- Create: `apps/api/prisma/desktop-diffs/postgres/.gitkeep`, `apps/api/prisma/desktop-diffs/sqlite/.gitkeep`
- Modify: `apps/api/scripts/generate-baselines.mjs`

**Why:** `generate-baselines.mjs` currently regenerates `000_baseline.sql` from the *live* schema at package time. Existing installs have old `000` marked applied in `_app_migrations`, so schema changes would silently never reach them; and if we shipped a diff alongside a regenerated baseline, fresh installs would apply the column twice and crash. Freezing the baseline to a committed snapshot makes numbered diffs (Task 2) correct for both fresh and existing installs.

**Interfaces:**
- Consumes: existing `runMigrations` runner (`apps/api/src/services/migrationRunner.ts`) — applies `*.sql` sorted, tracks by filename in `_app_migrations`. No runner changes.
- Produces: resources layout `migrations/<provider>/000_baseline.sql` (from frozen snapshot) + copied `NNN_*.sql` diffs from `prisma/desktop-diffs/<provider>/`. Task 2 adds the first diff.

- [ ] **Step 1: Snapshot current schemas (BEFORE any schema edits — this task must run before Task 2)**

```bash
cd apps/api
mkdir -p prisma/baseline prisma/desktop-diffs/postgres prisma/desktop-diffs/sqlite
touch prisma/desktop-diffs/postgres/.gitkeep prisma/desktop-diffs/sqlite/.gitkeep
cp prisma/schema.prisma prisma/baseline/postgres.prisma
npm run db:generate:desktop   # ensure schema.desktop.prisma is current
cp prisma/schema.desktop.prisma prisma/baseline/sqlite.prisma
```

Add a header comment to the top of both snapshot files:

```
// FROZEN baseline snapshot — never regenerate from the live schema.
// Schema changes ship as numbered diffs in prisma/desktop-diffs/<provider>/.
```

- [ ] **Step 2: Point generate-baselines at the snapshots and copy diffs**

Replace the `targets` array and the loop tail in `apps/api/scripts/generate-baselines.mjs`:

```js
import { execSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const resources = join(root, '..', 'desktop', 'src-tauri', 'resources', 'migrations');

// Baselines are FROZEN snapshots (prisma/baseline/) — never the live schema.
// Post-baseline changes ship as committed numbered diffs (prisma/desktop-diffs/).
const targets = [
    { provider: 'postgres', schema: join(root, 'prisma', 'baseline', 'postgres.prisma') },
    { provider: 'sqlite', schema: join(root, 'prisma', 'baseline', 'sqlite.prisma') },
];

for (const { provider, schema } of targets) {
    if (!existsSync(schema)) {
        console.log(`skip ${provider}: ${schema} missing`);
        continue;
    }
    const out = join(resources, provider);
    mkdirSync(out, { recursive: true });
    execSync(
        `npx prisma migrate diff --from-empty --to-schema-datamodel "${schema}" --script > "${join(out, '000_baseline.sql')}"`,
        { cwd: root, stdio: ['ignore', 'inherit', 'inherit'], shell: '/bin/bash' }
    );
    const diffs = join(root, 'prisma', 'desktop-diffs', provider);
    if (existsSync(diffs)) {
        for (const f of readdirSync(diffs).filter((f) => f.endsWith('.sql'))) {
            cpSync(join(diffs, f), join(out, f));
        }
    }
    console.log(`baseline written: ${provider}`);
}
```

- [ ] **Step 3: Verify output identical to before**

```bash
cd apps/api && node scripts/generate-baselines.mjs
git diff --stat apps/desktop/src-tauri/resources 2>/dev/null || true
```

Expected: `baseline written: postgres` + `baseline written: sqlite`; resources dir is gitignored, but diff the regenerated `000_baseline.sql` against the previous one manually if paranoid — snapshot == live schema right now, so bytes must match.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/baseline apps/api/prisma/desktop-diffs apps/api/scripts/generate-baselines.mjs
git commit -m "refactor: freeze desktop migration baselines, ship changes as numbered diffs

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `lastSentAt` column on ScheduledReport (all providers)

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model `ScheduledReport`, ~line 877)
- Create: `apps/api/prisma/migrations/<timestamp>_scheduled_report_last_sent/migration.sql` (via prisma migrate dev)
- Create: `apps/api/prisma/desktop-diffs/postgres/001_scheduled_report_last_sent.sql`
- Create: `apps/api/prisma/desktop-diffs/sqlite/001_scheduled_report_last_sent.sql`
- Regenerated: `apps/api/prisma/schema.test.prisma`, `apps/api/prisma/schema.desktop.prisma`

**Interfaces:**
- Produces: `ScheduledReport.lastSentAt: DateTime?` — used by Task 3's claim logic.

- [ ] **Step 1: Add the field**

In `apps/api/prisma/schema.prisma`, model `ScheduledReport`, after `sortOrder`:

```prisma
  lastSentAt          DateTime?
```

- [ ] **Step 2: Regenerate clients + variant schemas**

```bash
npm run db:generate
cd apps/api && node scripts/generate-test-schema.mjs && npm run db:generate:desktop
```

- [ ] **Step 3: Dev migration (main postgres, used by VPS deploy)**

```bash
cd apps/api && npx prisma migrate dev --name scheduled_report_last_sent
```

Expected migration content: `ALTER TABLE "ScheduledReport" ADD COLUMN "lastSentAt" TIMESTAMP(3);`

- [ ] **Step 4: Desktop diffs**

```bash
cd apps/api
npx prisma migrate diff --from-schema-datamodel prisma/baseline/postgres.prisma \
  --to-schema-datamodel prisma/schema.prisma --script \
  > prisma/desktop-diffs/postgres/001_scheduled_report_last_sent.sql
npx prisma migrate diff --from-schema-datamodel prisma/baseline/sqlite.prisma \
  --to-schema-datamodel prisma/schema.desktop.prisma --script \
  > prisma/desktop-diffs/sqlite/001_scheduled_report_last_sent.sql
```

Inspect both files: each must contain ONLY the single `ALTER TABLE ... ADD COLUMN "lastSentAt" ...` statement (if anything else appears, the snapshot in Task 1 was taken after unrelated schema drift — stop and reconcile).

- [ ] **Step 5: Run full API suite (test schema picked up the column)**

Run: `cd apps/api && npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma
git commit -m "feat: ScheduledReport.lastSentAt for report send dedupe

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Claim-on-read in `due-reports`

**Files:**
- Modify: `apps/api/src/routes/service.ts` (the `/due-reports` handler, ~lines 32–95)
- Test: `apps/api/src/test/service-notifications.test.ts` (append) — or a new `apps/api/src/test/service-reports.test.ts` if that file's fixtures don't fit; follow its style either way.

**Interfaces:**
- Consumes: `lastSentAt` from Task 2.
- Produces: `GET /api/service/due-reports` returns each due report **at most once per 20-minute window**, atomically (safe with two desktops polling the same postgres). Response shape otherwise unchanged (n8n compatible).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/database';
import { config } from '../config/env';

const serviceHeaders = { 'X-Assistant-Api-Key': config.ASSISTANT_API_KEY };

function vnNowTime(): string {
    const vn = new Date(Date.now() + 7 * 60 * 60 * 1000);
    return `${String(vn.getUTCHours()).padStart(2, '0')}:${String(vn.getUTCMinutes()).padStart(2, '0')}`;
}

describe('due-reports claim', () => {
    it('returns a due report once, then suppresses within the guard window', async () => {
        const owner = await prisma.user.create({
            data: { email: `rep-${Date.now()}@test.local`, name: 'Rep', password: 'x', role: 'OWNER', active: true },
        });
        const report = await prisma.scheduledReport.create({
            data: { name: 'Daily digest', reportType: 'TODAY_TASKS', frequency: 'DAILY', time: vnNowTime(), userId: owner.id },
        });

        const first = await request(app).get('/api/service/due-reports').set(serviceHeaders);
        expect(first.status).toBe(200);
        expect(first.body.data.map((r: any) => r.id)).toContain(report.id);

        const marked = await prisma.scheduledReport.findUnique({ where: { id: report.id } });
        expect(marked!.lastSentAt).not.toBeNull();

        const second = await request(app).get('/api/service/due-reports').set(serviceHeaders);
        expect(second.body.data.map((r: any) => r.id)).not.toContain(report.id);
    });
});
```

Adjust the auth header if `service-notifications.test.ts` authenticates differently — mirror it exactly.

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/api && npx vitest run src/test/service-reports.test.ts`
Expected: FAIL — second call still contains the report, `lastSentAt` null.

- [ ] **Step 3: Implement the claim**

In the `/due-reports` handler, after the existing `due` filter (and keeping the ONE_TIME deactivation block), replace `sendSuccess(res, due);` with:

```ts
        // Claim-on-read: atomically stamp lastSentAt so concurrent pollers
        // (two family desktops, or n8n double-fire) send each report once.
        const GUARD_MS = 20 * 60 * 1000;
        const cutoff = new Date(now.getTime() - GUARD_MS);
        const claimed: typeof due = [];
        for (const report of due) {
            const result = await prisma.scheduledReport.updateMany({
                where: {
                    id: report.id,
                    OR: [{ lastSentAt: null }, { lastSentAt: { lt: cutoff } }],
                },
                data: { lastSentAt: now },
            });
            if (result.count === 1) claimed.push(report);
        }

        sendSuccess(res, claimed);
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/api && npx vitest run src/test/service-reports.test.ts`
Expected: PASS.

- [ ] **Step 5: Full suite**

Run: `cd apps/api && npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/service.ts apps/api/src/test/service-reports.test.ts
git commit -m "feat: due-reports claims lastSentAt atomically (single send per window)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Report text formatter

**Files:**
- Create: `apps/api/src/services/reportFormatter.ts`
- Test: `apps/api/src/test/report-formatter.test.ts`

**Interfaces:**
- Consumes: the JSON shapes returned by `GET /api/service/report-data/:reportId` (see `apps/api/src/routes/service.ts` — `WEEKLY_SUMMARY` shape ~lines 245–340, task-report shape ~lines 470–560).
- Produces:
  - `formatReport(name: string, data: any): string` — full Telegram text, ≤4000 chars.
  - `summaryLine(data: any): string` — one-line digest for the OS notification body.
  Task 5 imports both.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { formatReport, summaryLine } from '../services/reportFormatter';

const taskReport = {
    reportType: 'TODAY_TASKS',
    sections: [],
    page: { name: 'Personal' },
    tasks: [{ title: 'Pay bill', priority: 'HIGH', dueDate: '2026-07-19T02:00:00.000Z', status: 'IN_PROGRESS' }],
    project: [{ title: 'Ship v2', project: 'NgocKy', deadline: '2026-07-19T10:00:00.000Z', status: 'IN_PROGRESS', priority: 'MEDIUM', type: 'FEATURE' }],
    calendar: [{ title: 'Dentist', startDate: '2026-07-19T08:00:00.000Z', location: 'Q1', allDay: false }],
    expenses: [{ description: 'Coffee', amount: 45000, type: 'PAY', category: 'FOOD', date: '2026-07-19T01:00:00.000Z' }],
    goals: [], housework: [], cakeo: [], assets: [], healthbook: [], keyboard: [], funds: [], learning: [], ideas: [],
};

const weeklySummary = {
    reportType: 'WEEKLY_SUMMARY',
    sections: ['tasks', 'expenses'],
    page: { name: 'Personal' },
    period: { start: '2026-07-13T17:00:00.000Z', end: '2026-07-20T16:59:59.999Z' },
    tasks: { done: [{ title: 'Old chore', dueDate: null }], inProgress: [], total: 1 },
    project: { done: [], inProgress: [], total: 0 },
    expenses: { totalPaid: 500000, totalReceived: 0, net: -500000, count: 3, items: [] },
    goals: [], housework: [], calendar: [], assets: [], learning: [], ideas: [], cakeo: [], healthbook: [], keyboard: [], funds: [],
};

describe('formatReport', () => {
    it('formats a task report with item titles and VND amounts', () => {
        const text = formatReport('Daily digest', taskReport);
        expect(text).toContain('Daily digest');
        expect(text).toContain('Pay bill');
        expect(text).toContain('Ship v2');
        expect(text).toContain('Dentist');
        expect(text).toContain('45.000');
    });

    it('respects the sections filter on summaries', () => {
        const text = formatReport('Weekly', weeklySummary);
        expect(text).toContain('Old chore');
        expect(text).toContain('500.000');
        expect(text).not.toContain('Projects'); // 'project' not in sections
    });

    it('truncates below the Telegram limit', () => {
        const huge = { ...taskReport, tasks: Array.from({ length: 500 }, (_, i) => ({ title: `Task number ${i} with a fairly long title`, priority: 'LOW', dueDate: null, status: 'TODO' })) };
        expect(formatReport('Big', huge).length).toBeLessThanOrEqual(4000);
    });
});

describe('summaryLine', () => {
    it('counts non-empty sections', () => {
        expect(summaryLine(taskReport)).toContain('1 task');
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/api && npx vitest run src/test/report-formatter.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

`apps/api/src/services/reportFormatter.ts`:

```ts
// Formats /api/service/report-data JSON into Telegram/OS-notification text.
// Desktop replacement for the n8n formatting node. Plain text, no markdown
// (avoids Telegram parse-mode escaping issues with user content).

const MAX_LEN = 4000; // Telegram hard limit is 4096

const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}₫`;
const day = (d: string | Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit' }) : '';
const time = (d: string | Date | null | undefined) =>
    d ? new Date(d).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }) : '';

type Line = string;

function items(list: any[] | undefined, render: (x: any) => Line, cap = 10): Line[] {
    if (!Array.isArray(list) || list.length === 0) return [];
    const out = list.slice(0, cap).map((x) => `  • ${render(x)}`);
    if (list.length > cap) out.push(`  … +${list.length - cap} more`);
    return out;
}

// section key -> [heading, renderer over the report-data payload]
function sectionBlocks(d: any): Array<[string, Line[]]> {
    const isSummary = d.reportType === 'WEEKLY_SUMMARY' || d.reportType === 'SUMMARY';
    const blocks: Array<[string, Line[]]> = [];

    if (isSummary) {
        blocks.push(['goals', header('Goals', items(d.goals, (g) => `${g.title}: ${g.currentCount}/${g.targetCount} ${g.unit ?? ''}${g.completed ? ' ✅' : ''}`))]);
        blocks.push(['project', header('Projects', [
            ...items(d.project?.done, (t) => `✅ ${t.title} (${t.project})`),
            ...items(d.project?.inProgress, (t) => `▶ ${t.title} (${t.project})`),
        ])]);
        blocks.push(['tasks', header('Tasks', [
            ...items(d.tasks?.done, (t) => `✅ ${t.title}`),
            ...items(d.tasks?.inProgress, (t) => `▶ ${t.title}`),
        ])]);
        blocks.push(['expenses', header('Expenses', d.expenses?.count
            ? [`  Paid ${vnd(d.expenses.totalPaid)} · Received ${vnd(d.expenses.totalReceived)} · Net ${vnd(d.expenses.net)} (${d.expenses.count})`,
               ...items(d.expenses.items, (e) => `${e.description}: ${vnd(e.amount)}`)]
            : [])]);
    } else {
        blocks.push(['goals', header('Goals', items(d.goals, (g) => `${g.title}: ${g.currentCount}/${g.targetCount} ${g.unit ?? ''}`))]);
        blocks.push(['project', header('Projects', items(d.project, (t) => `${t.title} (${t.project})${t.deadline ? ` — ${day(t.deadline)}` : ''}`))]);
        blocks.push(['tasks', header('Tasks', items(d.tasks, (t) => `${t.title}${t.dueDate ? ` — ${day(t.dueDate)}` : ''}`))]);
        blocks.push(['expenses', header('Expenses', items(d.expenses, (e) => `${e.description}: ${vnd(e.amount)}`))]);
    }

    blocks.push(['calendar', header('Calendar', items(d.calendar, (e) => `${e.title} — ${day(e.startDate)}${e.allDay ? '' : ` ${time(e.startDate)}`}${e.location ? ` @ ${e.location}` : ''}`))]);
    blocks.push(['housework', header('Housework', items(d.housework, (h) => `${h.title}${h.dueDate ? ` — ${day(h.dueDate)}` : ''}${h.completedDate ? ` ✅ ${day(h.completedDate)}` : ''}`))]);
    blocks.push(['cakeo', header('Ca Keo', items(d.cakeo, (c) => `${c.title}${c.assigner ? ` (${c.assigner})` : ''}`))]);
    blocks.push(['assets', header('Assets', items(d.assets, (a) => `${a.asset}: ${a.serviceType}${a.cost ? ` ${vnd(a.cost)}` : ''}`))]);
    blocks.push(['healthbook', header('Healthbook', items(d.healthbook, (h) => `${h.person}: ${h.type} — ${day(h.date)}`))]);
    blocks.push(['keyboard', header('Keyboard', items(d.keyboard, (k) => `${k.name}${k.price ? ` ${vnd(k.price)}` : ''}`))]);
    blocks.push(['funds', header('Funds', items(d.funds, (f) => `${f.description ?? f.category}: ${vnd(f.amount)}`))]);
    blocks.push(['learning', header('Learning', items(d.learning, (l) => `${l.title}${l.topic ? ` (${l.topic})` : ''}${typeof l.progress === 'number' ? ` ${l.progress}%` : ''}`))]);
    blocks.push(['ideas', header('Ideas', items(d.ideas, (i) => i.title))]);
    return blocks;
}

function header(title: string, lines: Line[]): Line[] {
    return lines.length ? [`${title}:`, ...lines] : [];
}

export function formatReport(name: string, d: any): string {
    const wanted: string[] = Array.isArray(d.sections) && d.sections.length > 0 ? d.sections : [];
    const lines: Line[] = [`📊 ${name}${d.page?.name ? ` — ${d.page.name}` : ''}`];
    if (d.period) lines.push(`${day(d.period.start)} → ${day(d.period.end)}`);
    for (const [key, block] of sectionBlocks(d)) {
        if (wanted.length && !wanted.includes(key)) continue;
        if (block.length) lines.push('', ...block);
    }
    if (lines.length <= 2) lines.push('', 'Nothing to report.');
    let text = lines.join('\n');
    if (text.length > MAX_LEN) text = `${text.slice(0, MAX_LEN - 2)}…`;
    return text;
}

export function summaryLine(d: any): string {
    const count = (v: any) => (Array.isArray(v) ? v.length : typeof v?.total === 'number' ? v.total : 0);
    const parts = [
        [count(d.tasks), 'task'],
        [count(d.project), 'project item'],
        [count(d.calendar), 'event'],
        [Array.isArray(d.expenses) ? d.expenses.length : d.expenses?.count ?? 0, 'expense'],
    ] as Array<[number, string]>;
    const bits = parts.filter(([n]) => n > 0).map(([n, w]) => `${n} ${w}${n > 1 ? 's' : ''}`);
    return bits.length ? bits.join(', ') : 'Report ready';
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd apps/api && npx vitest run src/test/report-formatter.test.ts`
Expected: PASS. If an assertion fails on exact strings (locale output differs), fix the TEST expectation to the actual `vi-VN` rendering — the formatter's job is readable text, not exact bytes.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/reportFormatter.ts apps/api/src/test/report-formatter.test.ts
git commit -m "feat: report text formatter for desktop scheduler

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: `tickReports` in the local scheduler

**Files:**
- Modify: `apps/api/src/services/scheduler.ts`
- Test: `apps/api/src/test/scheduler.test.ts` (append)

**Interfaces:**
- Consumes: claim-on-read `due-reports` (Task 3), `formatReport`/`summaryLine` (Task 4), existing `sendTelegram`, `recent`, `serviceHeaders`.
- Produces: `tickReports(base?: string): Promise<void>` exported for tests; wired into `startScheduler()`'s boot call and 5-minute interval. Fired reports appear in `recentNotifications(userId)` with `sourceType: 'REPORT'` → `DesktopNotifier.tsx` shows the OS notification (no web change needed).

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/test/scheduler.test.ts` (inside the existing describe, reusing `server`/`base`/`makeOwner`):

```ts
    it('fires a due report once with OS + telegram routing state', async () => {
        const owner = await makeOwner();
        const vnNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
        const time = `${String(vnNow.getUTCHours()).padStart(2, '0')}:${String(vnNow.getUTCMinutes()).padStart(2, '0')}`;
        const report = await prisma.scheduledReport.create({
            data: { name: 'Daily digest', reportType: 'TODAY_TASKS', frequency: 'DAILY', time, userId: owner.id },
        });

        await tickReports(base);
        const fired = recentNotifications(owner.id).filter((n) => n.id === report.id);
        expect(fired.length).toBe(1);
        expect(fired[0].sourceType).toBe('REPORT');
        expect(fired[0].title).toContain('Daily digest');

        await tickReports(base); // claim guard suppresses refire
        expect(recentNotifications(owner.id).filter((n) => n.id === report.id).length).toBe(1);
    });
```

Add `tickReports` to the import from `'../services/scheduler'`.

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/api && npx vitest run src/test/scheduler.test.ts`
Expected: FAIL — `tickReports` not exported.

- [ ] **Step 3: Implement**

In `apps/api/src/services/scheduler.ts`, add import and function:

```ts
import { formatReport, summaryLine } from './reportFormatter';
```

```ts
export async function tickReports(base = `http://127.0.0.1:${config.APP_PORT}/api`) {
    try {
        const res = await fetch(`${base}/service/due-reports`, { headers: serviceHeaders });
        if (!res.ok) return;
        const { data } = (await res.json()) as { data: any[] };
        for (const report of data ?? []) {
            if (!report?.user?.id) continue;
            const dataRes = await fetch(`${base}/service/report-data/${report.id}`, { headers: serviceHeaders });
            if (!dataRes.ok) continue;
            const { data: reportData } = await dataRes.json();
            if (report.user.telegramChatId) {
                await sendTelegram(report.user.telegramChatId, formatReport(report.name, reportData));
            }
            recent.unshift({
                key: `REPORT:${report.id}:${Date.now()}`,
                sourceType: 'REPORT',
                id: report.id,
                title: `📊 ${report.name}`,
                subtitle: summaryLine(reportData),
                userId: report.user.id,
                firedAt: new Date().toISOString(),
            });
            if (recent.length > 100) recent.length = 100;
        }
    } catch (err) {
        console.error('report tick failed', err);
    }
}
```

In `startScheduler()`, add report ticking to boot and interval (reports have no lookback — the server-side 15-min window decides; reports missed while the machine was off are skipped by design, unlike reminders):

```ts
export function startScheduler() {
    void tick(24 * 60); // boot catch-up: fire what was missed while the machine was off
    void tickReports();
    let lastTick = Date.now();
    setInterval(() => {
        const gap = Math.ceil((Date.now() - lastTick) / 60_000) + 15; // covers laptop sleep
        lastTick = Date.now();
        void tick(gap);
        void tickReports();
    }, 5 * 60 * 1000).unref();
    console.log('⏰ local scheduler started');
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd apps/api && npx vitest run src/test/scheduler.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Full suite**

Run: `cd apps/api && npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/scheduler.ts apps/api/src/test/scheduler.test.ts
git commit -m "feat: local scheduler executes due scheduled reports

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Shared-mode scheduler choice (builtin vs self-n8n)

**Files:**
- Modify: `apps/web/src/pages/DesktopOnboardingPage.tsx`
- Modify: `apps/desktop/src-tauri/src/lib.rs` (`DesktopConfig` struct + `spawn_sidecar`)

**Interfaces:**
- Consumes: existing `set_desktop_config` command (extra JSON field flows through serde).
- Produces: `DesktopConfig.scheduler_mode: Option<String>` — `"n8n"` disables the in-process scheduler (`SCHEDULER_ENABLED=false`); anything else (including absent, and always for offline mode) keeps it on. Existing installs have no `schedulerMode` key → default builtin, unchanged behavior.

- [ ] **Step 1: Rust — config field + env mapping**

In `DesktopConfig`:

```rust
struct DesktopConfig {
    mode: Option<String>,
    database_url: Option<String>,
    jwt_secret: Option<String>,
    jwt_refresh_secret: Option<String>,
    telegram_bot_token: Option<String>,
    scheduler_mode: Option<String>,
}
```

In `spawn_sidecar`, replace the hardcoded `SCHEDULER_ENABLED` env entry:

```rust
        (
            "SCHEDULER_ENABLED".into(),
            // "n8n": user runs their own n8n against the shared DB — the
            // sidecar must not double-send. Anything else = builtin scheduler.
            if cfg.scheduler_mode.as_deref() == Some("n8n") { "false".into() } else { "true".into() },
        ),
```

Run: `cd apps/desktop/src-tauri && cargo check`
Expected: clean.

- [ ] **Step 2: Onboarding UI**

In `DesktopOnboardingPage.tsx`, add state:

```tsx
    const [schedulerMode, setSchedulerMode] = useState<'builtin' | 'n8n'>('builtin');
```

Inside the `{mode === 'shared' && (...)}` block, after `<DbConnectionForm ... />`, add:

```tsx
                        <div className="space-y-2">
                            <div className="text-sm font-medium">Reminders &amp; reports</div>
                            <label className="flex items-start gap-2 text-sm">
                                <input type="radio" className="mt-1" checked={schedulerMode === 'builtin'} onChange={() => setSchedulerMode('builtin')} />
                                <span>
                                    <span className="font-medium">Built-in scheduler (recommended)</span>
                                    <span className="block text-gray-500">This app checks and delivers reminders and reports while it is open. If several family computers use the same database, only one sends each alert.</span>
                                </span>
                            </label>
                            <label className="flex items-start gap-2 text-sm">
                                <input type="radio" className="mt-1" checked={schedulerMode === 'n8n'} onChange={() => setSchedulerMode('n8n')} />
                                <span>
                                    <span className="font-medium">I run my own n8n</span>
                                    <span className="block text-gray-500">The app sends nothing. Your n8n workflows must reach a running desktop's API (port 21473) to poll <code>/api/service/due-notifications</code> and <code>/api/service/due-reports</code>.</span>
                                </span>
                            </label>
                        </div>
```

Hide the Telegram token field when it is unused — change the condition on the existing Telegram input block:

```tsx
                {(mode === 'offline' || (mode === 'shared' && schedulerMode === 'builtin')) && (
```

Add to the `set_desktop_config` payload:

```tsx
                    schedulerMode: mode === 'shared' ? schedulerMode : null,
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/DesktopOnboardingPage.tsx apps/desktop/src-tauri/src/lib.rs
git commit -m "feat: shared mode chooses builtin scheduler or self-hosted n8n

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Manual verification + test-plan doc

**Files:**
- Modify: `docs/TEST_PLAN_desktop_modes.md` (append a "Scheduled reports" section)

- [ ] **Step 1: Rebuild desktop bundle** (sidecar + baselines + Tauri; same commands as the last desktop release — `package-sidecar.sh` now emits `000_baseline.sql` + `001_scheduled_report_last_sent.sql` per provider).

- [ ] **Step 2: Walk the matrix**

1. **Offline (SQLite), existing install:** upgrade → first boot logs `✅ migration applied: 001_scheduled_report_last_sent.sql`; create a scheduled report (DAILY, time = a few minutes from now) → OS notification `📊 <name>` arrives within ~5 min of the scheduled time; Telegram too if token + chat id configured. No second notification in the following 15 min.
2. **Offline, fresh install:** wipes/new machine → boot applies `000` then `001` cleanly (no duplicate-column error).
3. **Shared + builtin, two desktops open:** same report → exactly one machine delivers (check `ScheduledReport.lastSentAt` stamped once).
4. **Shared + n8n:** sidecar log shows no `⏰ local scheduler started`; nothing is sent by the app.
5. **VPS regression:** after deploy (migration runs in CI), production n8n still receives due reports exactly once per schedule.

- [ ] **Step 3: Append findings to `docs/TEST_PLAN_desktop_modes.md` and commit**

```bash
git add docs/TEST_PLAN_desktop_modes.md
git commit -m "docs: scheduled reports test matrix for desktop modes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Explicitly out of scope

- **Email delivery** — `notificationChannel: EMAIL` reports are skipped on desktop (no SMTP); Telegram + OS notification only. n8n path unaffected.
- **Report catch-up after downtime** — reminders catch up 24h on boot; reports intentionally don't (a "yesterday 08:00" digest arriving at random boot time is noise). The 15-min server window is the contract.
- **Settings UI to switch scheduler mode later** — mode switch already exists via "Switch mode / reset" re-onboarding; add a dedicated toggle only if requested.
- **n8n reachability for self-n8n users** — their responsibility (documented in onboarding copy); desktop APIs listen on `0.0.0.0:21473` already.
