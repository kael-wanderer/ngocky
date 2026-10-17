# Hobby Field Management — Design

Date: 2026-10-17. Mockup: [`2026-10-17-hobby-field-management-mockup.html`](2026-10-17-hobby-field-management-mockup.html) (approved v3, light/dark toggle).

## Intent

Keyboard Spec, Tag, Color, Category and Condition lists are hardcoded in web and API. Funds Category/Condition are Prisma enums / Zod enums. Owner wants to add, rename, reorder and remove these values from the web, as one shared list for the whole Hobby group, without losing any existing data.

## Goals

- New page **Field Management** under Hobby in the sidebar.
- Five fields: Category (Keyboard + Funds), Condition (Keyboard + Funds), Spec, Tag, Color (Keyboard only).
- Per value: add, rename (inline), reorder (drag), delete, and for Category/Color a text color.
- Rename and delete of a value in use cascade to the records using it, after a confirm popup.
- Every list consumer reads from Field Management: Keyboard page (filters, add/edit form, CSV import), Funds page (Category, Condition), Reports page (keyboard + funds filters), API validation/normalization, assistant resolvers.
- Deploy loses nothing: existing values, order and colors appear on the page automatically; existing records keep their values.

## Non-goals

- Funds Type and Scope stay fixed enums.
- Not a module of its own: no entry in Setup, Application Management or `enabledGroups`.
- No per-category behavior checkboxes (see Built-in categories).
- No new DB table. No per-page-instance lists — one app-wide list.

## Anti-goals

- Any existing keyboard or fund record losing or changing its value on deploy.
- Renaming a built-in category breaking auto-create, summary cards or price colors.

## Decisions (owner)

- Page under Hobby, cards per field, no table (mockup v3).
- Visible in sidebar when Keyboard **or** Funds is enabled for the user **and** the user is OWNER/ADMIN; hidden otherwise. Plain USER: no access (no read-only view).
- Category and Condition shared between Keyboard and Funds.
- Built-in categories (Keycap, Kit, Shipping, Accessories, Other): renamable, recolorable, reorderable, **not deletable** (lock icon). Built-in behavior keyed by a fixed internal key, not by label. User-added categories are plain labels (like Other).
- Existing data migrated automatically.

## Data model

Copy the `foodOptions` precedent: a JSON column on `AppSetting` (id = 1).

```ts
type HobbyOption = {
  id: string;          // cuid, stable across renames
  label: string;       // what records store
  color?: string;      // hex, Category + Color only
  builtInKey?: 'KEYCAP' | 'KIT' | 'SHIPPING' | 'ACCESSORIES' | 'OTHER'; // Category only
};
type HobbyOptions = {
  category: HobbyOption[]; condition: HobbyOption[];
  spec: HobbyOption[]; tag: HobbyOption[]; color: HobbyOption[];
}; // array order = display/sort order
```

- `AppSetting.hobbyOptions Json` (Postgres `@default("{}")`; SQLite nullable like `foodOptions`).
- Records keep storing the **label text**, as Keyboard does today. Rename cascades the text.
- `FundTransaction.category`: enum `HobbyFundCategory` → `String`. Drop the enum.
- `FundTransaction.condition` is already `String?`.
- Keyboard condition lives in `Keyboard.description` (existing quirk, unchanged).

## Migration (nothing lost)

1. Schema migration (`prisma/migrations`, Postgres): add `hobbyOptions`; `ALTER COLUMN category TYPE TEXT USING` with mapping `KEYCAP→Keycap, KIT→Kit, SHIPPING→Shipping, ACCESSORIES→Accessories, OTHER→Other`; `UPDATE condition USED→Used`; drop type `HobbyFundCategory`.
2. Desktop: numbered diffs in `prisma/desktop-diffs/postgres/` and `/sqlite/` (next number after `001`). SQLite stores Prisma enums as TEXT, so its diff is the `UPDATE`s plus the new column. Update `schema.desktop.prisma` / test schema via `scripts/generate-test-schema.mjs`. Baselines stay frozen.
3. Lazy fill on read in `AppSettingsService`: when `hobbyOptions` is empty, build defaults from today's hardcoded lists (same order, colors from `COLOR_TEXT_MAP` / `CATEGORY_TEXT_MAP`, built-in keys on the 5 categories), then append any distinct value found in existing `Keyboard.category/tag/color/spec/description` and `FundTransaction.category/condition` not already present (case-insensitive). Save once. Not in `seed.ts` — deploys don't run seed.
4. One-time case normalization during the fill *(builder-check call)*: every record value that matches an option label case-insensitively but not exactly (e.g. `kit`, `used`) is rewritten to the exact label. After this, cascades and usage counts use exact equality.
5. One-time spec normalization during the fill: rewrite `Keyboard.spec` entries through today's `KEYBOARD_SPEC_ALIASES` (e.g. `icon mod` → `Icon Mode`). After this, the alias map is removed; API normalizes spec entries by case-insensitive match against option labels.

Test the Postgres migration on a copy of the VPS DB before deploy.

## API

- `GET /app-settings/hobby-options` — authenticated, any role (lists are needed to render Keyboard/Funds). Returns options plus `usage` counts per value (`{ field: { optionId: count } }`), counted across all users' records.
- Mutations, `authenticate` + `authorize('OWNER','ADMIN')`, all Zod-validated:
  - `POST /app-settings/hobby-options/:field` `{ label, color? }` — reject duplicate label (case-insensitive, trimmed), max length 60, color `^#[0-9a-f]{6}$`.
  - `PATCH /app-settings/hobby-options/:field/:id` `{ label?, color? }` — rename cascades in one transaction: Keyboard `category|tag|color|description` equality update; `spec` JSON array element replace; FundTransaction `category|condition` when field is shared.
  - `PUT /app-settings/hobby-options/:field/order` `{ ids: string[] }` — must be exact permutation.
  - `DELETE /app-settings/hobby-options/:field/:id` `{ mode: 'move', targetId } | { mode: 'clear' }` — refuse for `builtInKey` categories. `clear` sets the field null (spec: remove element). Category and Condition are **move-only** when in use *(Condition: builder-check call — fund BUY rows require a condition)*; `clear` refused for them.
  - Cascades and usage counts cover **all users' records** in every page instance (one app-wide list). `usage` exposes only counts, no record data. *(builder-check call)*
- `:field` validated against the five names. No direct `prisma.$executeRaw` string building — use Prisma client calls; spec array rewrite done in app code inside the transaction.
- Keyboard and Funds create/update validation: value must be an existing label of that field (or empty where optional). Replace `z.enum([...])` in `validators/modules.ts`. CSV import (Keyboard **and** Funds): unknown values are kept as-is and auto-added to the list (owner decided "nothing lost"; import shouldn't fail). Funds import no longer falls back to `OTHER` for unknown categories. *(Funds: builder-check call)*
- Keyboard create/update has **no Zod schema today** (`routes/keyboards.ts` reads `req.body`): add one in `validators/modules.ts` and wire `validate()`.
- Legacy keys *(builder-check call)*: fund endpoints and assistant still accept `KEYCAP|KIT|SHIPPING|ACCESSORIES|OTHER` (resolved through `builtInKey`, so they survive renames) and `BNIB|USED` (case-insensitive label match). Protects n8n workflows.
- Spec sort order in `routes/keyboards.ts` from option order.

## Built-in categories

Code that keyed on category text switches to `builtInKey` lookup via the option list:
- Fund auto-create Keyboard item (`routes/funds.ts`, `assistant/resolvers/fundCreate.ts`): BUY + MECHANICAL_KEYBOARD + builtInKey in {KEYCAP, KIT, ACCESSORIES}. Keyboard item gets the same category label (no mapping needed anymore).
- Keyboard summary cards Kit / Keycap / Accessories and Reports keyboard summary.
- Keyboard price color rules for Kit / Keycap (`getKeyboardPriceColor`).
- Assistant: `intentParser` prompt lists current category labels (read at request time); `fundQuery`/`keyboardCreate` resolve by case-insensitive label match.

## Web

- New route `/field-management`, page `FieldManagementPage.tsx`, icon `SlidersHorizontal` (lucide). Added to `allNavItems` and the hobby nav group in `AppLayout.tsx`; shown when the user has Keyboard or Funds enabled (same feature flags that hide those pages today). Route guarded the same way plus OWNER/ADMIN role; USER gets redirected like other admin-only pages.
- Layout per mockup: header + search, responsive card grid (`minmax(290px,1fr)`). Card: title, count, "used by" pills, rows (drag handle, value, usage count, edit/delete or lock), "Show all N" collapse after 6 rows, add input at bottom. Category/Color: color swatch + palette row on edit (reuse `components/ColorPicker.tsx` if it fits).
- Confirm popups only when usage > 0: rename, delete (move / clear). Unused values act immediately.
- Styling: Tailwind + CSS theme variables, works in all themes (mockup shows light + `theme-dark`).
- New `api/hobbyOptions.ts` + a `useHobbyOptions()` React Query hook. Replace constants in `KeyboardPage.tsx`, `FundsPage.tsx`, `reports/index.tsx`, `config/keyboardFilters.ts`, `config/fundsFilters.ts` (category/condition parts). Funds dropdowns now value = label.
- Saved filter state in localStorage (`ngocky:reports:keyboardFilters`, fund filters with old `KEYCAP` values) — values not in the list are dropped silently.

## Tests (API, real DB, vitest)

- Lazy fill: empty → defaults in exact order; extra values from existing records appended; idempotent.
- Spec alias normalization applied once.
- Rename cascades to keyboards (scalar + spec array) and funds; built-in key preserved.
- Delete: move and clear; built-in category delete refused (403/400); category clear refused.
- Negative: non-admin mutation → 403; unauthenticated → 401; duplicate label; bad color; bad field name; order not a permutation; label too long.
- Fund create with label `Kit` auto-creates keyboard; with user-added category does not.
- Update existing `fund-instances.test.ts` / `keyboard-instances.test.ts` for label values.

## Left to the builder

- Exact component split, drag library (none present: plain HTML5 drag or up/down fallback is fine).
- Error copy and toast style (follow existing pages).
