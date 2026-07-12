# Codex task list — Desktop login config + Food Menu module

Two independent tasks. Do them in order; commit each separately.
Repo: NgốcKý monorepo — `apps/web` (React+Vite), `apps/api` (Express+Prisma), `apps/desktop` (Tauri v2).
Conventions: no ESLint/Prettier; `npm run lint` = `tsc --noEmit` for both apps and must pass.
API tests: `cd apps/api && npm test` (sequential, real DB).

---

## TASK 1 — Desktop: configurable API URL + remember email

The web bundle is shared by browser and the Tauri desktop app. Desktop needs the API base URL
changeable at runtime without a rebuild. Also add a safe "remember me" (email only).

### Context files
- `apps/web/src/api/client.ts` — axios instance. Line 3: `const API_URL = import.meta.env.VITE_API_URL || '/api';`
  Read once at module load. Refresh call (~line 33) also uses `API_URL`.
- `apps/web/src/pages/LoginPage.tsx` — login form (email, password, MFA). Error via `setError`.
- Desktop detected by `window.__TAURI_INTERNALS__` (see `apps/web/src/utils/externalLinks.ts`).

### Requirements
1. **Runtime-overridable base URL.** Add an exported helper `getApiBaseUrl()` in `client.ts`:
   `localStorage.getItem('ngocky_api_url')?.trim() || import.meta.env.VITE_API_URL || '/api'`.
   Use it for the axios `baseURL` AND the refresh call.
2. **Server URL field on LoginPage** — collapsible "Advanced / Server URL" section, collapsed by default,
   **shown only on desktop** (`window.__TAURI_INTERNALS__` present; hidden on web).
   - Text input pre-filled with current effective base URL.
   - On Save/blur: validate it starts with `http://` or `https://` (inline error otherwise),
     write trimmed value to `localStorage['ngocky_api_url']` (remove key if emptied),
     then `window.location.reload()` so the new baseURL takes effect.
3. **Remember email.** "Remember me" checkbox. On successful login, if checked, store ONLY the email in
   `localStorage['ngocky_saved_email']`; if unchecked, remove the key. On load, pre-fill email + check box
   if the key exists. **Never store the password.**

### Constraints
- No new deps, no Tauri rust plugins. localStorage only. MFA flow untouched. Match existing Tailwind style.
- Session persistence across restarts already works via the httpOnly refresh cookie — do not touch tokens.

### Acceptance
- Desktop: expand Server URL, change + save → app reconnects on reload. Web: no field shown, login unchanged.
- Remember me → email pre-filled next launch; password never persisted. `npm run lint` passes.

---

## TASK 2 — Food Menu module (new template)

A new page template for the **hobby/family** group: a list of food places/restaurants with filtering and a
"pick for me" suggestion. Mirrors the existing **KEYBOARD** template exactly — clone every KEYBOARD touchpoint.
The whole point: replace a Google Sheet used by a telegram bot to answer "dinner + nearby" style queries.
Build web CRUD + filter now; the list endpoint's filters make it bot-ready later (bot itself out of scope).

### Data shape (from the source sheet)
| Sheet column | Field |
|---|---|
| Name | `name` (required) |
| Tag (All day / Breakfast / Dinner / Dessert) | `tag` |
| Type (Bún / Cab / Meat / Light / Beer / Cơm …) | `type` |
| Distance (Nearby / Not far / Far) | `distance` |
| Rating | `rating` (Int? 1–5) |
| — | `mapLink` (String?, Google Maps URL) |
| — | `note` (String?) |

Tag / Type / Distance are **editable dropdowns** (user can add/remove option values in-app) — NOT hardcoded.
Store the option lists in `AppSetting.foodOptions` (see below); the record stores the chosen string
(no FK enforcement — loose, fine for a family app).

### 2A. Backend

**Prisma (`apps/api/prisma/schema.prisma`):**
1. Add `FOODPLACE` to `enum PageModuleType` (near line 219, next to KEYBOARD).
2. New model, cloned from `Keyboard` (line ~1001):
   ```prisma
   model FoodPlace {
     id         String   @id @default(cuid())
     name       String
     tag        String?
     type       String?
     distance   String?
     rating     Int?
     mapLink    String?
     note       String?
     isShared   Boolean  @default(false)
     ownerId    String
     instanceId String?
     sortOrder  Int      @default(0)
     createdAt  DateTime @default(now())
     updatedAt  DateTime @updatedAt

     owner    User          @relation(fields: [ownerId], references: [id], onDelete: Cascade)
     instance PageInstance? @relation(fields: [instanceId], references: [id], onDelete: Cascade)

     @@index([ownerId])
     @@index([instanceId])
   }
   ```
3. Add back-relations: `foodPlaces FoodPlace[]` on both `model User` (near line 293, alongside `keyboards`)
   and `model PageInstance` (near line 380, alongside `keyboards`).
4. Add `foodOptions Json @default("{\"tags\":[],\"types\":[],\"distances\":[]}")` to `model AppSetting` (~line 301).
5. Migration: `cd apps/api && npx prisma migrate dev --name add-food-place` then `npm run db:generate`.

**Route (`apps/api/src/routes/foods.ts`)** — clone `routes/keyboards.ts`, drop the keyboard `spec`/price
normalization. Handlers:
- `GET /` — paginated list; `where` includes `instanceId` + `OR:[{ownerId},{isShared:true}]`.
  Also accept optional query filters `tag`, `type`, `distance` (exact match, applied to `where` when present)
  so the endpoint answers "dinner + nearby" for the future bot.
- `POST /` — `assertPageInstance(instanceId, 'FOODPLACE')`; create with name/tag/type/distance/rating/mapLink/note.
- `PATCH /:id`, `DELETE /:id` — same ownership checks as keyboards.
- `POST /import` — same bulk pattern (used to import the sheet CSV/JSON later).
Mount in `apps/api/src/app.ts`: `import foodRoutes from './routes/foods';` + `app.use('/api/foods', foodRoutes);`.

**Options endpoints (`AppSetting.foodOptions`):** add to the existing app-settings route
(find where `AppSetting` is read/written — same place `templateOverrides`/`appName` are served):
- `GET` returns `foodOptions`. `PATCH` accepts `{ tags?, types?, distances? }` (arrays of trimmed non-empty
  strings, de-duped) and upserts row id=1. Reuse the existing settings auth (owner/admin).

**Template registry:**
- `apps/api/src/config/pageTemplates.ts` — add to `PAGE_TEMPLATES` (near KEYBOARD, line ~54):
  `{ moduleType: 'FOODPLACE', label: 'Food Menu', group: 'family', rootLabel: 'places', available: true },`
- `apps/api/src/services/pageInstances.ts` — add `case 'FOODPLACE': return prisma.foodPlace.count({ where: { instanceId: id } });`
  to `countPageRoots` (and any other `switch (moduleType)` that enumerates every type — grep `KEYBOARD` in that file and mirror).
- Grep the repo for every remaining `'KEYBOARD'` / `KEYBOARD:` occurrence in `apps/api/src` (assistant
  intentParser/actionExecutor are optional — skip AI assistant wiring for now) and mirror only the
  page-instance/template ones.

**Seed the options** with the sheet's values so dropdowns aren't empty:
`tags: ["All day","Breakfast","Dinner","Dessert"]`,
`types: ["Bún","Cab","Cơm","Meat","Light","Beer","General","Cuốn"]`,
`distances: ["Nearby","Not far","Far"]`.
Do this in the seed script (`apps/api/prisma/seed*`) as an idempotent upsert of `AppSetting.foodOptions`
only if currently empty.

### 2B. Web (clone KEYBOARD touchpoints)

- `apps/web/src/pages/FoodPage.tsx` — clone `pages/KeyboardPage.tsx`. Columns: Name, Tag, Type, Distance,
  Rating, map-link icon (opens `mapLink` in system browser via the existing external-link util), note.
  - Filter bar: Tag / Type / Distance dropdowns sourced from `foodOptions` (fetch via the settings API).
  - **"Pick for me"** button: pick a random row from the currently-filtered set and highlight it.
  - Add/Edit modal: the three editable dropdowns (a combobox that lets you type a new value; on save of a
    new value, PATCH it into `foodOptions` so it persists), rating (1–5), mapLink, note.
  - **Manage options** popover/small dialog: add/remove values in each of the three lists (PATCH settings).
  - Uses `instanceId` + sharing exactly like KeyboardPage.
- `apps/web/src/config/foodFilters.ts` — clone `config/keyboardFilters.ts` shape: a `matchesFoodFilters(item, filters)`
  helper + `DEFAULT_FOOD_FILTERS`. Filter values come from `foodOptions` at runtime (not a hardcoded `as const`).
- `apps/web/src/config/pageTemplates.tsx` — lazy-import `FoodPage`, add `FOODPLACE: Food` to the map (mirror line 21/36).
- `apps/web/src/config/features.ts` — add `featureFood: true` (line ~11), nav entry `{ to: '/food', label: 'Food Menu' }`,
  settings toggle `{ key: 'featureFood', label: 'Food Menu', route: '/food' }`, and the two maps
  (`FOODPLACE: 'featureFood'`, `'/food': 'FOODPLACE'`).
- `apps/web/src/api/pages.ts` — add a `foods` API client mirroring the keyboards one (list/create/update/delete/import),
  plus `foodOptions` get/patch.
- `apps/web/src/App.tsx` — lazy `FoodPage` + `<Route path="food" element={<FeatureRoute route="/food"><FoodPage/></FeatureRoute>} />` (mirror line 22/111).
- `apps/web/src/layouts/AppLayout.tsx` — nav item `{ to: '/food', icon: <Utensils>, label: 'Food Menu' }` in the
  **family** group (import `Utensils` from lucide-react); add `/food` to the family group's `items` array.
- Add `featureFood Boolean @default(true)` to `model User` in schema (mirror `featureKeyboard`, line ~259) and
  include it in seed/user creation defaults — grep `featureKeyboard` and mirror everywhere it appears (api + web).

### Constraints & verification
- Follow existing patterns exactly; no new deps. `npm run lint` (both apps) passes.
- `cd apps/api && npm test` passes (mirror `test/keyboard-instances.test.ts` → `food-instances.test.ts` if
  quick; otherwise ensure existing tests still pass).
- Manual: create a Food Menu page instance, add a few rows, filter by Tag=Dinner + Distance=Nearby, hit
  "Pick for me", edit an option list, confirm persistence after reload.

### Out of scope (do NOT build)
- Telegram/bot endpoint (filter API already covers it), offline desktop sync, AI-assistant intent wiring for Food.
