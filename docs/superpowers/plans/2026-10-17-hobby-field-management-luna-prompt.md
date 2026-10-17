# Codex Luna prompt — Hobby Field Management

Paste everything below the line into Codex (Luna). One run = one task. Next run: same prompt, change `TASK = N`.

---

TASK = 1

You are implementing one task of a fixed plan in the NgocKy monorepo (repo root = current directory). Every design decision is already made. Do not redesign, rename, add features, or "improve" anything outside the task. If something in this prompt or the plan is impossible as written, STOP and report the exact problem — do not invent a workaround.

## Read first

1. `CLAUDE.md` (repo conventions).
2. `docs/superpowers/plans/2026-10-17-hobby-field-management.md` — read "Global Constraints", "Review Focus", and **only Task {TASK}** in full.
3. `docs/superpowers/specs/2026-10-17-hobby-field-management-design.md` — reference only.
4. For Task 7: open `docs/superpowers/specs/2026-10-17-hobby-field-management-mockup.html` and match its layout.

## Hard rules

- Work on branch `feat/hobby-field-management` (create from `main` in Task 1, reuse after).
- Follow the task's steps in order: failing test → run (must FAIL) → implement → run (must PASS) → full suite → commit.
- Commit message exactly as the task's last step says, ending with a blank line then `Co-Authored-By: Codex <noreply@openai.com>`. One commit per task. Stage only files you changed (never `git add -A`; `apps/web/tsconfig.tsbuildinfo`, `package-lock.json`, `data/` and `.claude/` have unrelated changes — do not stage them).
- API tests: `cd apps/api && npx vitest run src/test/<file>.test.ts`, full suite `cd apps/api && npm test`. Type check: `cd apps/api && npx tsc --noEmit -p .`. Web build: `npm run build -w apps/web` from repo root.
- Never read `process.env` directly (use `apps/api/src/config/env.ts`). No raw SQL in app code — Prisma client only. Migration `.sql` files are the only SQL you write.
- Errors: throw `ValidationError` (400), `ForbiddenError` (403), `NotFoundError` (404) from `apps/api/src/utils/errors.ts`.
- Routes: `authenticate` from `middleware/auth.ts`, `authorize('OWNER','ADMIN')` for mutations, `validate(schema)` / `validate(schema, 'params')` from `middleware/validate.ts`.
- Do not touch Task 1–9 files that belong to other tasks.
- Do NOT run `prisma migrate dev`, `migrate reset`, or anything against a real/VPS database. Task 1 Step 7 (Postgres check on a DB copy) — skip it and say "Step 7 left for owner" in your report.

## Pinned code (use exactly; the plan references these)

### Defaults (Task 2, `apps/api/src/services/hobbyOptions.ts`)

```ts
export const HOBBY_FIELDS = ['category', 'condition', 'spec', 'tag', 'color'] as const;
export type HobbyField = (typeof HOBBY_FIELDS)[number];
export type BuiltInCategoryKey = 'KEYCAP' | 'KIT' | 'SHIPPING' | 'ACCESSORIES' | 'OTHER';
export type HobbyOption = { id: string; label: string; color?: string; builtInKey?: BuiltInCategoryKey };
export type HobbyOptions = Record<HobbyField, HobbyOption[]>;
export type HobbyUsage = Record<HobbyField, Record<string, number>>;

export const COLOR_FIELDS: HobbyField[] = ['category', 'color'];
export const MOVE_ONLY_FIELDS: HobbyField[] = ['category', 'condition'];
const AUTO_CREATE_KEYS: BuiltInCategoryKey[] = ['KEYCAP', 'KIT', 'ACCESSORIES'];

const DEFAULT_CATEGORIES: Array<{ label: string; color: string; builtInKey: BuiltInCategoryKey }> = [
    { label: 'Keycap', color: '#16a34a', builtInKey: 'KEYCAP' },
    { label: 'Kit', color: '#2563eb', builtInKey: 'KIT' },
    { label: 'Shipping', color: '#ea580c', builtInKey: 'SHIPPING' },
    { label: 'Accessories', color: '#6b7280', builtInKey: 'ACCESSORIES' },
    { label: 'Other', color: '#6b7280', builtInKey: 'OTHER' },
];
const DEFAULT_CONDITIONS = ['BNIB', 'Used'];
const DEFAULT_SPECS = ['Base', 'Novel', 'Space', 'Accent', 'Hiragana', 'Icon Mode', 'Alpha', 'Mod', 'Fix Kit', 'Solder', 'Hotswap', 'Plate Alu', 'Plate PC', 'Plate PEI', 'Plate CF', 'Plate PP', 'Deskmat'];
const DEFAULT_TAGS = ['Board 1', 'Board 2', 'Board 3', 'Board 4', 'Board 5', 'Board 6', 'Board 7', 'Board 8', 'Board 9', 'Board 10', 'Board 11', 'Board 12', 'Board 13', 'Board 14', 'Board 15', 'Board 16', 'Board 17', 'Stock'];
const DEFAULT_COLORS: Array<[string, string]> = [
    ['Blue', '#2563eb'], ['PC', '#6b7280'], ['Purple', '#7c3aed'], ['Red', '#dc2626'], ['Gray', '#6b7280'],
    ['Green', '#16a34a'], ['Black', '#111827'], ['Silver', '#94a3b8'], ['Copper', '#b45309'], ['Brown', '#92400e'],
    ['Rose Gold', '#c2410c'], ['Orange', '#ea580c'], ['Beige', '#a16207'], ['Colorful', '#db2777'],
];
const LEGACY_SPEC_ALIASES: Record<string, string> = { 'icon mod': 'Icon Mode' };
const LEGACY_CONDITION: Record<string, string> = { USED: 'Used', BNIB: 'BNIB' };

export function shouldCreateKeyboardFromFund(type: string, scope: string, builtInKey: BuiltInCategoryKey | null): boolean {
    return type === 'BUY' && scope === 'MECHANICAL_KEYBOARD' && !!builtInKey && AUTO_CREATE_KEYS.includes(builtInKey);
}
```

(The old alias map's other entries were pure case variants; the case-insensitive pass covers them.) Ids: `crypto.randomUUID()` from `node:crypto`.

### Label resolution (Task 2)

```ts
const norm = (value: string) => value.trim().toLowerCase();

static resolveLabel(options: HobbyOptions, field: HobbyField, raw: unknown): string | null {
    if (raw === null || raw === undefined) return null;
    const text = String(raw).trim();
    if (!text) return null;
    const list = options[field];
    if (field === 'category') {
        const byKey = list.find((option) => option.builtInKey === text.toUpperCase());
        if (byKey) return byKey.label;
    }
    if (field === 'condition' && LEGACY_CONDITION[text.toUpperCase()]) {
        const legacy = LEGACY_CONDITION[text.toUpperCase()];
        const hit = list.find((option) => norm(option.label) === norm(legacy));
        if (hit) return hit.label;
    }
    if (field === 'spec' && LEGACY_SPEC_ALIASES[norm(text)]) {
        const hit = list.find((option) => norm(option.label) === norm(LEGACY_SPEC_ALIASES[norm(text)]));
        if (hit) return hit.label;
    }
    return list.find((option) => norm(option.label) === norm(text))?.label ?? null;
}
```

### Lazy fill algorithm (Task 2, `get()`)

1. `const row = await prisma.appSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } })`.
2. If `row.hobbyOptions` is an object with an array `category`, return it parsed (each field defaults to `[]`).
3. Else, inside `prisma.$transaction(async (tx) => { ... })`:
   a. Build defaults (above) into a `HobbyOptions`.
   b. `const keyboards = await tx.keyboard.findMany({ select: { id: true, category: true, tag: true, color: true, description: true, spec: true } })`; `const funds = await tx.fundTransaction.findMany({ select: { id: true, category: true, condition: true } })`.
   c. For each record value per field (keyboard: `category→category`, `description→condition`, `tag`, `color`, each `spec` entry; fund: `category`, `condition`): `resolved = resolveLabel(options, field, value)`. If `null` and value non-empty: append `{ id, label: value.trim() }` to that field (category appended gets color `#6b7280`, color appended gets `#6b7280`), and `resolved = value.trim()`. If `resolved !== value`, record the row for rewrite.
   d. Rewrite changed rows: `tx.keyboard.update({ where: { id }, data: {...changed fields, spec: dedupedSpecArray } })`, `tx.fundTransaction.update(...)`.
   e. `tx.appSetting.update({ where: { id: 1 }, data: { hobbyOptions: options } })`.
4. Return options.

### Rename/delete cascade (Task 3)

| field | Keyboard column | Fund column |
|---|---|---|
| category | `category` | `category` |
| condition | `description` | `condition` |
| tag | `tag` | — |
| color | `color` | — |
| spec | `spec` (JSON array) | — |

Scalar columns: `updateMany({ where: { [col]: oldLabel }, data: { [col]: newLabelOrNull } })`.
Spec: `findMany({ select: { id: true, spec: true } })`, for rows whose array contains `oldLabel`: replace (or remove on clear), dedupe keeping first occurrence, `update`. Run all of it plus the `appSetting` JSON write inside one `prisma.$transaction(async (tx) => ...)`.

Rename duplicate rule: reject if another option (different `id`) in the field has `norm(label) === norm(newLabel)`.
Delete rules, in this order: unknown id → `NotFoundError('Option')`; `builtInKey` → `ForbiddenError('Built-in category cannot be deleted')`; `mode === 'move'` and (`targetId === id` or target not found) → `ValidationError('Invalid move target')`; usage > 0 and `mode === 'clear'` and field in `MOVE_ONLY_FIELDS` → `ValidationError('This field can only be moved, not cleared')`.
Reorder: `ids` must have the same length as the field and contain every id exactly once, else `ValidationError('Order must list every option once')`.

### Validators (Task 3, `apps/api/src/validators/hobbyOptions.ts`)

```ts
import { z } from 'zod';
import { HOBBY_FIELDS } from '../services/hobbyOptions';

const label = z.string().trim().min(1).max(60);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const hobbyFieldParamsSchema = z.object({ field: z.enum(HOBBY_FIELDS) });
export const hobbyOptionParamsSchema = z.object({ field: z.enum(HOBBY_FIELDS), id: z.string().min(1).max(64) });
export const createHobbyOptionSchema = z.object({ label, color: color.optional() }).strict();
export const updateHobbyOptionSchema = z.object({ label: label.optional(), color: color.optional() }).strict()
    .refine((value) => value.label !== undefined || value.color !== undefined, { message: 'Nothing to update' });
export const reorderHobbyOptionsSchema = z.object({ ids: z.array(z.string().min(1).max(64)).max(500) }).strict();
export const deleteHobbyOptionSchema = z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('move'), targetId: z.string().min(1).max(64) }).strict(),
    z.object({ mode: z.literal('clear') }).strict(),
]);
```

Service rejects `color` when field not in `COLOR_FIELDS`: `ValidationError('Color is only allowed for category and color')`.

### Router (Task 3, `apps/api/src/routes/hobbyOptions.ts`)

Order of routes matters: declare `PUT '/:field/order'` before `PATCH/DELETE '/:field/:id'`. Pattern per handler: `async (req, res, next) => { try { ... } catch (err) { next(err); } }`, responses with `res.status(201).json(...)`, `res.json(...)`, `res.status(204).end()` (same style as `routes/app-settings.ts`). `router.use(authenticate)` at top. Mount in `apps/api/src/app.ts` on the line **before** `app.use('/api/app-settings', appSettingsRoutes)`:
`app.use('/api/app-settings/hobby-options', hobbyOptionRoutes);`

### Web (Tasks 7–8)

- API client: copy the style of `apps/web/src/api/appSettings.ts`. Base path `/app-settings/hobby-options`.
- Hook file `apps/web/src/hooks/useHobbyOptions.ts`: `useQuery({ queryKey: ['hobby-options'], queryFn: hobbyOptions.list, staleTime: 60_000 })`. Empty value while loading: `{ category: [], condition: [], spec: [], tag: [], color: [] }`.
- Icon: `SlidersHorizontal` from `lucide-react`. Lock: `Lock`. Drag: `GripVertical`. Edit/delete: `Pencil`, `Trash2` (same classes as the Keyboard table action buttons).
- Modal shell: copy the outer markup of `KeyboardModal` in `apps/web/src/pages/KeyboardPage.tsx` (`fixed inset-0 bg-black/50 ...`, `max-w-md` instead of `max-w-2xl`).
- Colors in Tailwind: use the existing `bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700` pairs as KeyboardPage does, and `var(--color-text)` / `var(--color-text-secondary)` for text.
- Never call `window.confirm` / `window.alert`.

## Report at the end (keep it short)

- Task number, commit hash, files changed.
- Test commands run and their pass/fail counts (paste the summary line only).
- Anything skipped (e.g. Task 1 Step 7) and why.
- Any place where this prompt or the plan did not match the code — quote the file:line.
