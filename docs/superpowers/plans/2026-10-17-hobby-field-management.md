# Hobby Field Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owner/Admin can add, rename, reorder, recolor and delete Hobby Category, Condition, Spec, Tag and Color values from a new Field Management page; Keyboard, Funds, Reports and the assistant read those lists; existing data migrates with nothing lost.

**Architecture:** Lists live in one JSON column `AppSetting.hobbyOptions` (copy of the `foodOptions` precedent), lazily filled on first read from today's hardcoded lists plus values discovered in records. Records keep storing label text; rename/delete cascade inside a Prisma transaction. `FundTransaction.category` changes from enum to text. Built-in categories carry a fixed `builtInKey` that drives behavior instead of the label.

**Tech Stack:** Express + Prisma (Postgres; SQLite for tests/desktop) + Zod + vitest/supertest; React + React Query + Tailwind + lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-17-hobby-field-management-design.md` · Mockup: `docs/superpowers/specs/2026-10-17-hobby-field-management-mockup.html`

## Global Constraints

- Fields: `category`, `condition`, `spec`, `tag`, `color`. Shared with Funds: `category`, `condition`.
- Built-in category keys: `KEYCAP | KIT | SHIPPING | ACCESSORIES | OTHER` → labels `Keycap, Kit, Shipping, Accessories, Other`. Renamable, recolorable, reorderable, never deletable.
- Legacy mapping: `KEYCAP→Keycap, KIT→Kit, SHIPPING→Shipping, ACCESSORIES→Accessories, OTHER→Other`, `USED→Used`, `BNIB` stays.
- Label: trimmed, 1–60 chars, unique per field case-insensitively. Color: `^#[0-9a-fA-F]{6}$`, only on `category` and `color`.
- Mutations: `authenticate` + `authorize('OWNER','ADMIN')` + `validate(zodSchema)`. GET: `authenticate`, any role.
- Delete in-use `category`/`condition`: `move` only. `clear` allowed for `spec`, `tag`, `color`.
- Cascades and usage cover all users' records, all page instances. `usage` returns counts only.
- Auto-create Keyboard item from fund: `type === 'BUY' && scope === 'MECHANICAL_KEYBOARD' && builtInKey ∈ {KEYCAP, KIT, ACCESSORIES}`.
- Env via `config/env.ts` only. Tailwind + CSS theme vars only. No raw SQL string building in app code (use Prisma client; migration `.sql` files are fine).
- Page visible only for OWNER/ADMIN when `/keyboard` or `/funds` is accessible. Not a module: no change to Setup, Application Management, `enabledGroups`.
- Tests: `cd apps/api && npm test`, single: `npx vitest run src/test/<file>.test.ts`. Real SQLite test DB, sequential.

## Review Focus

1. Label differing only in whitespace/case from an existing one (`" kit "`) → rejected as duplicate on add and on rename (except renaming to a case change of itself, `Kit`→`KIT`, which is allowed). Test in Task 3.
2. Rename to a label that another option already has → 409/400, nothing cascades. Test in Task 3.
3. Delete with `move` whose `targetId` is the option itself or unknown → 400, nothing changes. Test in Task 3.
4. Keyboard record whose `spec` array holds both the renamed value and the target (`['Base','Novel']`, move Novel→Base) → result has `Base` once, no duplicate. Test in Task 3.
5. Fund created via API with legacy `KEYCAP` after `Keycap` was renamed to `Keycaps` → stored as `Keycaps`, still auto-creates keyboard. Test in Task 5.

---

## File Structure

API
- Create `apps/api/src/services/hobbyOptions.ts` — types, defaults, lazy fill, label resolution, CRUD + cascades.
- Create `apps/api/src/validators/hobbyOptions.ts` — Zod schemas for the mutations.
- Create `apps/api/src/routes/hobbyOptions.ts` — router, mounted at `/api/app-settings/hobby-options` in `app.ts` (before `/api/app-settings`).
- Modify `apps/api/prisma/schema.prisma`, regenerate `schema.test.prisma` / `schema.desktop.prisma`.
- Create `apps/api/prisma/migrations/20261017120000_hobby_field_management/migration.sql`.
- Create `apps/api/prisma/desktop-diffs/postgres/002_hobby_field_management.sql`, `.../sqlite/002_hobby_field_management.sql`.
- Modify `routes/keyboards.ts`, `routes/funds.ts`, `validators/modules.ts`, `services/assistant/intentParser.ts`, `services/assistant/resolvers/{fundCreate,fundQuery,keyboardCreate}.ts`.
- Tests: create `src/test/hobby-options.test.ts`, `src/test/hobby-options-consumers.test.ts`; update `fund-instances.test.ts`.

Web
- Create `apps/web/src/api/hobbyOptions.ts`, `apps/web/src/hooks/useHobbyOptions.ts`, `apps/web/src/pages/FieldManagementPage.tsx`.
- Modify `App.tsx`, `layouts/AppLayout.tsx`, `config/features.ts`, `pages/KeyboardPage.tsx`, `pages/FundsPage.tsx`, `pages/reports/index.tsx`, `config/keyboardFilters.ts`, `config/fundsFilters.ts`.

---

### Task 1: Schema + migrations (Fund category → text, hobbyOptions column)

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (enum `HobbyFundCategory` at ~102, `FundTransaction.category` ~827, `AppSetting` ~304)
- Create: `apps/api/prisma/migrations/20261017120000_hobby_field_management/migration.sql`
- Create: `apps/api/prisma/desktop-diffs/postgres/002_hobby_field_management.sql`, `apps/api/prisma/desktop-diffs/sqlite/002_hobby_field_management.sql`
- Modify: `apps/api/src/routes/funds.ts` (import of `HobbyFundCategory`, `normalizeCategory` ~204), `apps/api/src/validators/modules.ts:373-374`
- Test: `apps/api/src/test/fund-instances.test.ts`

**Interfaces:**
- Produces: `FundTransaction.category: String` (labels), `AppSetting.hobbyOptions: Json` (Postgres `@default("{}")`, test/desktop nullable via generator).

- [ ] **Step 1: Write the failing test** in `fund-instances.test.ts`: `it('stores legacy KEYCAP category as label Keycap')` — POST `/api/funds` with `category: 'KEYCAP', condition: 'USED'` (type BUY, scope MECHANICAL_KEYBOARD); `expect(row.category).toBe('Keycap')`, `expect(row.condition).toBe('Used')`.
- [ ] **Step 2: Run** `cd apps/api && npx vitest run src/test/fund-instances.test.ts` — Expected: FAIL (`KEYCAP` stored).
- [ ] **Step 3: Schema.** Delete `enum HobbyFundCategory`; `category String`; add `hobbyOptions Json @default("{}")` to `AppSetting`. Run `npm run db:generate` and `node scripts/generate-test-schema.mjs --variant desktop`.
- [ ] **Step 4: Postgres migration SQL** (main + `desktop-diffs/postgres/002`, identical):

```sql
ALTER TABLE "AppSetting" ADD COLUMN "hobbyOptions" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "FundTransaction" ALTER COLUMN "category" TYPE TEXT USING (
  CASE "category"::text WHEN 'KEYCAP' THEN 'Keycap' WHEN 'KIT' THEN 'Kit' WHEN 'SHIPPING' THEN 'Shipping'
  WHEN 'ACCESSORIES' THEN 'Accessories' WHEN 'OTHER' THEN 'Other' ELSE "category"::text END);
UPDATE "FundTransaction" SET "condition" = 'Used' WHERE "condition" = 'USED';
DROP TYPE "HobbyFundCategory";
```

  SQLite diff `002`: `ALTER TABLE "AppSetting" ADD COLUMN "hobbyOptions" JSONB;` plus the same mapping as five `UPDATE "FundTransaction" SET "category" = 'Keycap' WHERE "category" = 'KEYCAP';` lines and the condition `UPDATE`. Baselines stay frozen.
- [ ] **Step 5: Code.** In `validators/modules.ts` fund schema: `category: z.string().trim().min(1).max(60)`, `condition: z.string().trim().max(60).optional().nullable()`. In `routes/funds.ts` replace the `HobbyFundCategory` type with `string`; until Task 5, map legacy keys with a local `LEGACY_CATEGORY_LABELS` record and `USED→Used` on create/update/import. Keep `shouldCreateKeyboardFromFund` working on labels `Keycap|Kit|Accessories` (Task 5 replaces it).
- [ ] **Step 6: Verify.** `npx vitest run src/test/fund-instances.test.ts` PASS; `npx tsc --noEmit -p .` clean; `npm test` all pass.
- [ ] **Step 7: Verify migration on Postgres.** Against a scratch Postgres DB (copy of VPS dump, not production): `npx prisma migrate deploy`, then `SELECT category, count(*) FROM "FundTransaction" GROUP BY 1` shows only labels and counts equal the pre-migration enum counts.
- [ ] **Step 8: Commit** `feat: fund category as text + hobbyOptions column`.

---

### Task 2: Hobby options service — defaults, lazy fill, resolution

**Files:**
- Create: `apps/api/src/services/hobbyOptions.ts`
- Test: `apps/api/src/test/hobby-options.test.ts`

**Interfaces:**
- Produces:
  - `export const HOBBY_FIELDS = ['category','condition','spec','tag','color'] as const; export type HobbyField`
  - `export type BuiltInCategoryKey = 'KEYCAP'|'KIT'|'SHIPPING'|'ACCESSORIES'|'OTHER'`
  - `export type HobbyOption = { id: string; label: string; color?: string; builtInKey?: BuiltInCategoryKey }`
  - `export type HobbyOptions = Record<HobbyField, HobbyOption[]>`
  - `HobbyOptionsService.get(): Promise<HobbyOptions>` — lazy fill + save once.
  - `HobbyOptionsService.resolveLabel(options: HobbyOptions, field: HobbyField, raw: unknown): string | null` — trims; case-insensitive label match; for `category` also matches `builtInKey`; for `condition` `USED`/`BNIB` match case-insensitively; `null` if empty or unmatched.
  - `HobbyOptionsService.builtInKeyOf(options: HobbyOptions, label: string | null): BuiltInCategoryKey | null`
  - `HobbyOptionsService.ensureLabels(field: HobbyField, labels: string[]): Promise<HobbyOptions>` — appends missing labels (case-insensitive), used by imports.
  - `HobbyOptionsService.specRank(options: HobbyOptions): Map<string, number>`

- [ ] **Step 1: Write failing tests** in `hobby-options.test.ts` (`describe('hobby options fill')`):
  - `fills defaults in order`: fresh DB → `get()`; `category.map(l)` equals `['Keycap','Kit','Shipping','Accessories','Other']` with builtInKeys `KEYCAP..OTHER` and colors `Kit '#2563eb', Keycap '#16a34a', Shipping '#ea580c', Accessories '#6b7280', Other '#6b7280'`; `spec` labels equal today's `KEYBOARD_SPEC_ORDER` (17); `tag` equals 18 tags `Board 1..Board 17, Stock`; `color` equals 14 labels with today's `COLOR_TEXT_MAP` hexes; `condition` equals `['BNIB','Used']`.
  - `appends discovered values`: seed a keyboard `{ tag: 'Board 99', color: 'Teal', spec: ['Weird'] }` and a fund `{ condition: 'Mint' }` before first `get()` → each appended at the end of its field.
  - `normalizes case variants`: keyboard `{ category: 'kit', spec: ['icon mod','BASE'] }` → after `get()` the row has `category 'Kit'`, `spec ['Icon Mode','Base']`; no `kit` option created.
  - `is idempotent`: second `get()` returns identical ids; `AppSetting.hobbyOptions` written once (compare `updatedAt` unchanged or deep-equal).
  - `resolveLabel`: `('category','KEYCAP')→'Keycap'`, `('category',' kit ')→'Kit'`, `('condition','USED')→'Used'`, `('tag','nope')→null`; after renaming Keycap's label to `Keycaps` in the stored JSON, `('category','KEYCAP')→'Keycaps'`.
- [ ] **Step 2: Run** `npx vitest run src/test/hobby-options.test.ts` — FAIL (module missing).
- [ ] **Step 3: Implement** `services/hobbyOptions.ts`. Defaults copied verbatim from `web/src/config/keyboardFilters.ts`, `KeyboardPage.tsx` (`SPECS`, `COLOR_TEXT_MAP`, `CATEGORY_TEXT_MAP` — use Kit `#2563eb`, Keycap `#16a34a`), `routes/keyboards.ts` (`KEYBOARD_SPEC_ALIASES`, moved here as `LEGACY_SPEC_ALIASES`). Ids via `crypto.randomUUID()` (no cuid lib in deps). Fill runs in one `prisma.$transaction`: read distinct values (`Keyboard.category/tag/color/description/spec`, `FundTransaction.category/condition`), rewrite case variants and spec aliases with `updateMany` / per-row spec update, append unknowns, write JSON. Fill triggers only when stored value has no `category` array.
- [ ] **Step 4: Run** tests — PASS.
- [ ] **Step 5: Commit** `feat: hobby options service with lazy fill`.

---

### Task 3: Hobby options API — list, add, rename, reorder, delete

**Files:**
- Modify: `apps/api/src/services/hobbyOptions.ts`
- Create: `apps/api/src/validators/hobbyOptions.ts`, `apps/api/src/routes/hobbyOptions.ts`
- Modify: `apps/api/src/app.ts:63` (mount `app.use('/api/app-settings/hobby-options', hobbyOptionRoutes)` before `/api/app-settings`)
- Test: `apps/api/src/test/hobby-options.test.ts`

**Interfaces:**
- Consumes: Task 2 types and `get()`.
- Produces (HTTP, JSON bodies):
  - `GET /api/app-settings/hobby-options` → `{ options: HobbyOptions, usage: Record<HobbyField, Record<optionId, number>> }`
  - `POST /:field` `{ label, color? }` → `201 HobbyOption`
  - `PATCH /:field/:id` `{ label?, color? }` → `200 HobbyOption`
  - `PUT /:field/order` `{ ids: string[] }` → `200 HobbyOption[]`
  - `DELETE /:field/:id` body `{ mode: 'move', targetId: string } | { mode: 'clear' }` → `204`
- Service: `getWithUsage()`, `add(field, input)`, `update(field, id, input)`, `reorder(field, ids)`, `remove(field, id, input)`. Errors: `ValidationError` (400) for bad input/duplicate/self-move/non-permutation/clear on category|condition; `ForbiddenError` (403) for deleting a built-in; `NotFoundError` (404) for unknown id. All from `utils/errors.ts`.

- [ ] **Step 1: Write failing tests** (`describe('hobby options api')`, owner token helper as in `keyboard-instances.test.ts`, plus a USER token):
  - `GET returns options and usage`: two keyboards with tag `Stock` → `usage.tag[stockId] === 2`.
  - `GET requires auth` → 401.
  - `USER cannot mutate`: POST/PATCH/PUT/DELETE with USER token → 403 each.
  - `add`: POST `/spec { label: 'Switch Film' }` → 201, appended last. `{ label: ' base ' }` → 400. `{ label: 'x'.repeat(61) }` → 400. POST `/tag { label:'T', color:'#fff' }` → 400 (color not allowed on tag). POST `/category { label:'Switch', color:'#7c3aed' }` → 201. POST `/bogus` → 400.
  - `rename cascades`: keyboard `{ spec:['Base','Icon Mode'], category:'Kit' }`, fund `{ category:'Kit' }`; PATCH spec Icon Mode → `Icon Mod` → keyboard spec `['Base','Icon Mod']`; PATCH category Kit → `Kits` → keyboard and fund category `Kits`, option keeps `builtInKey 'KIT'`.
  - `rename to existing label rejected`: PATCH tag Board 1 → `board 2` → 400, keyboards untouched. PATCH Kit → `KIT` → 200 (own case change).
  - `reorder`: PUT `/tag/order` with reversed ids → 200 order reversed; with one id missing → 400; with a duplicate id → 400.
  - `delete move`: 2 keyboards tag `Board 3` → DELETE `{mode:'move', targetId: stockId}` → both `Stock`, option gone. `targetId` = itself → 400; unknown → 400.
  - `delete move dedupes spec`: keyboard spec `['Base','Novel']`, move Novel → Base → `['Base']`.
  - `delete clear`: tag in use → `{mode:'clear'}` → keyboard tag `null`; spec clear removes element; color clear → `null`.
  - `delete guards`: built-in Kit → 403; user-added category `Switch` in use with `clear` → 400; `condition` Used in use with `clear` → 400; unused `Switch` with `{mode:'clear'}` → 204.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Validators** in `validators/hobbyOptions.ts`: `hobbyFieldParam = z.enum(HOBBY_FIELDS)`, `labelSchema = z.string().trim().min(1).max(60)`, `colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/)`, `createHobbyOptionSchema`, `updateHobbyOptionSchema` (at least one key, `.strict()`), `reorderHobbyOptionsSchema = z.object({ ids: z.array(z.string().min(1)).max(500) }).strict()`, `deleteHobbyOptionSchema = z.discriminatedUnion('mode', [...])`. Field param and color-allowed-on-field checks in service.
- [ ] **Step 4: Service + routes.** Cascade per field in one `prisma.$transaction`:
  - `category`: `keyboard.updateMany({ where:{category:old}, data:{category:new} })` + same on `fundTransaction`.
  - `condition`: `keyboard.updateMany` on `description` + `fundTransaction.updateMany` on `condition`.
  - `tag`, `color`: `keyboard.updateMany`.
  - `spec`: load keyboards whose spec contains old (filter in app code after `findMany({ select:{id,spec} })`), map → dedupe → `update` each.
  - Usage: `groupBy` on scalar columns; spec counted in app code.
- [ ] **Step 5: Run** `npx vitest run src/test/hobby-options.test.ts` — PASS; `npm test` — PASS.
- [ ] **Step 6: Commit** `feat: hobby options API with cascading rename/delete`.

---

### Task 4: Keyboard API reads options

**Files:**
- Modify: `apps/api/src/routes/keyboards.ts` (remove `KEYBOARD_SPEC_ORDER`, `KEYBOARD_SPEC_ALIASES`, `KEYBOARD_SPEC_RANK` ~12-60; create ~91, update ~120, import ~149)
- Modify: `apps/api/src/validators/modules.ts` (add `createKeyboardSchema`, `updateKeyboardSchema`)
- Test: `apps/api/src/test/hobby-options-consumers.test.ts`

**Interfaces:**
- Consumes: `resolveLabel`, `ensureLabels`, `specRank`, `get()`.

- [ ] **Step 1: Write failing tests** (`describe('keyboard uses hobby options')`):
  - create with `{ name:'A', category:'kit', tag:'stock', spec:['icon mode','base'] }` → 201, stored `Kit`, `Stock`, `['Base','Icon Mode']` (option order).
  - create with `tag:'Unknown'` → 400; create with `name: ''` → 400; `price: 'abc'` → 400.
  - import `{ items:[{ name:'B', tag:'Board 42', spec:['Gasket'] }] }` → 201; options now contain `Board 42` and `Gasket`; row stored as given.
  - after reordering spec so `Novel` precedes `Base`, GET list returns item spec `['Novel','Base']`.
- [ ] **Step 2: Run** `npx vitest run src/test/hobby-options-consumers.test.ts` — FAIL.
- [ ] **Step 3: Implement.** Zod schemas mirror current body fields (`name` 1–200 required on create, `price` number nullable, `category|tag|color|description` string ≤60 nullable, `spec` string array ≤50, `note` ≤2000 nullable, `isShared` boolean, `instanceId` optional) — wire with `validate()`. In handlers resolve each field via `resolveLabel`; unmatched non-empty → `ValidationError`. Import: collect unknown labels per field → `ensureLabels` → then store. Sort spec with `specRank`.
- [ ] **Step 4: Run** tests — PASS; `npm test` — PASS (fix `keyboard-instances.test.ts` only if it relied on removed behavior).
- [ ] **Step 5: Commit** `feat: keyboard API validates against hobby options`.

---

### Task 5: Funds API reads options + built-in auto-create

**Files:**
- Modify: `apps/api/src/routes/funds.ts` (`shouldCreateKeyboardFromFund` ~26, `mapFundCategoryToKeyboardCategory` ~32, create ~109, import ~167-215, patch ~255); remove Task 1's local `LEGACY_CATEGORY_LABELS`
- Test: `apps/api/src/test/hobby-options-consumers.test.ts`

**Interfaces:**
- Consumes: `resolveLabel`, `builtInKeyOf`, `ensureLabels`.
- Produces: `export function shouldCreateKeyboardFromFund(type: string, scope: string, builtInKey: BuiltInCategoryKey | null): boolean` in `services/hobbyOptions.ts` (reused by Task 6).

- [ ] **Step 1: Write failing tests** (`describe('funds use hobby options')`):
  - BUY + MECHANICAL_KEYBOARD + `category:'Kit'` → keyboard item created with category `Kit`.
  - same with user-added category `Switch` → no keyboard created.
  - rename Keycap → `Keycaps`, then POST fund `category:'KEYCAP'` → stored `Keycaps`, keyboard created with `Keycaps` (Review Focus 5).
  - POST `category:'Nope'` → 400. POST `condition:'used'` → stored `Used`.
  - GET `/api/funds?category=KEYCAP` and `?category=keycap` both return the `Keycap` rows (list filter goes through `resolveLabel`; today it compares raw text at `routes/funds.ts:61`).
  - import `[{ category:'Gift', condition:'Mint', ... }]` → rows stored `Gift`/`Mint`; options contain both (no `Other` fallback).
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** Resolve category/condition via `resolveLabel`; reject unmatched on create/patch; import uses `ensureLabels`. Auto-create uses `builtInKeyOf` + `shouldCreateKeyboardFromFund`; keyboard category = fund label. Delete `mapFundCategoryToKeyboardCategory`.
- [ ] **Step 4: Run** tests + `npm test` — PASS.
- [ ] **Step 5: Commit** `feat: funds API uses shared category/condition options`.

---

### Task 6: Assistant uses options

**Files:**
- Modify: `apps/api/src/services/assistant/intentParser.ts:70-78`, `resolvers/fundCreate.ts` (`BUYABLE_CATEGORIES`, `normalizeFundCategory`, `normalizeCondition`, `mapFundCategoryToKeyboardCategory`, reply strings ~61/69), `resolvers/fundQuery.ts:30`, `resolvers/keyboardCreate.ts:9-18`
- Test: `apps/api/src/test/assistant-phase7.test.ts` (extend) or `hobby-options-consumers.test.ts`

- [ ] **Step 1: Write failing tests:** `fundCreate` resolver with entities `{ category:'kit', condition:'used', type:'BUY', scope:'MECHANICAL_KEYBOARD', ... }` → creates fund `Kit`/`Used` and keyboard; with `category:'Switch'` (user-added) → fund created, no keyboard; with `category:'nope'` → reply lists current labels, e.g. contains `_Keycap_` and `_Switch_`. `fundQuery` with `category:'keycap'` filters to `Keycap` rows. `keyboardCreate` with `category:'keycap'` → `Keycap`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** Resolvers call `HobbyOptionsService.get()` + `resolveLabel`; auto-create via `shouldCreateKeyboardFromFund`. Missing-category / missing-condition replies build the list from current labels (escape for Telegram MarkdownV2 like the existing strings). `intentParser` prompt: replace hardcoded `Kit|Keycap|...` and `KEYCAP|...` with labels joined by `|`, loaded when the prompt is built (make the builder async if needed; update its caller).
- [ ] **Step 4: Run** tests + `npm test` — PASS.
- [ ] **Step 5: Commit** `feat: assistant resolves hobby options`.

---

### Task 7: Web — Field Management page, route, nav

**Files:**
- Create: `apps/web/src/api/hobbyOptions.ts`, `apps/web/src/hooks/useHobbyOptions.ts`, `apps/web/src/pages/FieldManagementPage.tsx`
- Modify: `apps/web/src/App.tsx` (~23 lazy import, ~113 route), `apps/web/src/layouts/AppLayout.tsx` (`navItems` ~32, `navGroups.hobby` ~50, `hobbyRoutes` ~76), `apps/web/src/config/features.ts` (`isRouteAccessible`)

**Interfaces:**
- Produces:
  - `hobbyOptions.list(): Promise<{ options: HobbyOptions; usage: HobbyUsage }>`, `.add(field, body)`, `.update(field, id, body)`, `.reorder(field, ids)`, `.remove(field, id, body)` — via `api/client`.
  - `useHobbyOptions(): { options: HobbyOptions; usage: HobbyUsage; isLoading: boolean }` (query key `['hobby-options']`, empty arrays while loading).
  - `labelsOf(options, field): string[]`, `colorOf(options, field, label): string | undefined`, `builtInKeyOf(options, label)` exported from the hook file.
  - Types `HobbyField`, `HobbyOption`, `HobbyOptions`, `HobbyUsage` duplicated from API (repo has no shared package).

- [ ] **Step 1: Access rule.** In `features.ts` `isRouteAccessible`: for `'/field-management'` return `(source?.role === 'OWNER' || source?.role === 'ADMIN') && (isRouteAccessible('/keyboard', source, appGroups) || isRouteAccessible('/funds', source, appGroups))` (widen the `source` type with optional `role`).
- [ ] **Step 2: Nav + route.** Add `{ to: '/field-management', icon: SlidersHorizontal, label: 'Field Management' }` after Learning; add to hobby `navGroups` items and `hobbyRoutes`. Route `<Route path="field-management" element={<AdminRoute><FeatureRoute route="/field-management"><FieldManagementPage /></FeatureRoute></AdminRoute>} />`.
- [ ] **Step 3: Page** per mockup: header (icon, title "Field Management", `"{fields} fields · {values} values · shared across Hobby"`, search input filtering rows across cards). Card grid `grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(290px,1fr))]`, order Category, Spec, Color, Tag, Condition. Card header: title + count + "used by" pills (Category/Condition: Keyboard, Funds; others: Keyboard). Row: drag handle (HTML5 drag, `onDrop` → `reorder`), value (Category/Color in their color with swatch; Spec as chip), usage count, edit (inline input, Enter saves, Esc cancels; Category/Color also show `ColorPicker` or a swatch row), delete or `Lock` icon for built-ins with title "Built-in: can rename/recolor, not delete". Collapse to 6 rows with "Show all N ▾". Add input + "+ Add" at bottom (Category/Color with swatch, default `#6b7280`).
- [ ] **Step 4: Confirm modals** (only when usage > 0), same modal shell as `KeyboardModal`: Rename — `"{n} keyboards use this {field}. They will be updated too."` (category/condition also mention fund records); Delete — radio "Move them to [select]" and, for spec/tag/color only, "Clear {field} on those keyboards". Unused values rename/delete immediately with no popup (spec). Never use `window.confirm` — it is a no-op in the desktop webview.
- [ ] **Step 4b: One mutation at a time.** While any hobby-options mutation is pending, disable every add/edit/delete/drag control on the page (API reads-modifies-writes one JSON value; parallel writes on Postgres can drop one).
- [ ] **Step 5: Errors** shown as inline red text under the card (API `message`), matching existing pages' error style; invalidate `['hobby-options']` and `['keyboards']`, `['funds']` after mutations.
- [ ] **Step 6: Verify.** `npm run build -w apps/web` succeeds (tsc + vite). Run the app, log in as OWNER: page visible under Hobby, all five cards render existing values in light and `theme-dark`; disable Keyboard and Funds feature flags → nav item gone, `/field-management` redirects; log in as USER → not visible, URL redirects.
- [ ] **Step 7: Commit** `feat(web): field management page`.

---

### Task 8: Web — consumers read options

**Files:**
- Modify: `apps/web/src/pages/KeyboardPage.tsx` (constants 32-80, `getKeyboardPriceColor` ~177, summary ~373, filters ~448-468, modal ~650-700, CSV import), `apps/web/src/pages/FundsPage.tsx` (~13-24, defaults ~121/285), `apps/web/src/pages/reports/index.tsx` (~55-65, ~805, ~1119, ~1500-1545), `apps/web/src/config/keyboardFilters.ts`, `apps/web/src/config/fundsFilters.ts`

**Interfaces:**
- Consumes: `useHobbyOptions`, `labelsOf`, `colorOf`, `builtInKeyOf` (Task 7).

- [ ] **Step 1: Keyboard page.** Remove `CATEGORIES/TAGS/COLORS/SPECS/CONDITIONS/SPEC_ALIASES/SPEC_ORDER/COLOR_TEXT_MAP/CATEGORY_TEXT_MAP`; read from hook. Summary cards and `getKeyboardPriceColor` switch on `builtInKeyOf(options, item.category)` (`KIT`, `KEYCAP`, `ACCESSORIES`) — card titles show the current label. Spec sort by option order.
- [ ] **Step 2: Funds page.** Category/Condition dropdowns `value = label`; default category = label of `builtInKey 'KEYCAP'`, default BUY condition = `Used` label. Type/Scope unchanged.
- [ ] **Step 3: Reports.** Keyboard filters + funds filters read hook; keyboard summary by `builtInKey`. Drop stale saved filter values not in current labels when reading localStorage.
- [ ] **Step 4: Config cleanup.** Delete `KEYBOARD_FILTER_CATEGORIES/TAGS/COLORS`, `FUNDS_CATEGORY_OPTIONS`, `FUNDS_CONDITION_OPTIONS`; `matchesKeyboardFilters` unchanged in signature.
- [ ] **Step 5: Verify.** `rg -n "KEYBOARD_FILTER_(TAGS|COLORS|CATEGORIES)|FUNDS_(CATEGORY|CONDITION)_OPTIONS|'Rose Gold'" apps/web/src` → no hits. `npm run build -w apps/web` passes. In the running app: add tag `Board 18` on Field Management → appears in Keyboard filter + form + Reports filter without reload beyond query refetch; rename Kit → Kits → Keyboard summary card titled `Kits` with same total; Funds dropdown shows `Kits`.
- [ ] **Step 6: Commit** `feat(web): keyboard, funds, reports read hobby options`.

---

### Task 9: Docs + full verification

**Files:**
- Modify: `docs/CHANGELOG.md`, `CLAUDE.md` only if a new non-obvious convention emerged (likely not).

- [ ] **Step 1:** `cd apps/api && npm test` — all pass; `npx tsc --noEmit -p .` clean; `npm run db:generate:desktop` succeeds.
- [ ] **Step 2:** `npm run build -w apps/web` passes.
- [ ] **Step 3:** Desktop SQLite smoke: start sidecar against a copy of an existing desktop SQLite file → migration runner applies `002_hobby_field_management.sql` once; Field Management shows existing values.
- [ ] **Step 4:** CHANGELOG entry: Field Management page; fund category migrated to text; deploy note "test migration on DB copy first".
- [ ] **Step 5: Commit** `docs: changelog for hobby field management`.
