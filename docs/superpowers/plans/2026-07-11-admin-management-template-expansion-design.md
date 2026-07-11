# Admin Management, Agent Providers, and Template Expansion Design

**Status:** Proposed  
**Date:** 2026-07-11  
**Depends on:** `2026-07-10-module-system.md`  
**Companion plan:** `2026-07-11-admin-management-template-expansion-plan.md`

## Summary

Move application-wide configuration out of User Settings and into two dedicated Admin pages:

- **Application Management** for application identity, module-group availability, and custom page lifecycle.
- **Agent Settings** for selecting and configuring OpenAI, Claude, or a custom OpenAI-compatible provider.

Expand custom pages from four templates to every current product module while preserving existing built-in pages and data. A custom page is an isolated partition of a module's existing data model and UI, not a schema-less page builder.

## Goals

1. Keep User Settings focused on the current user's preferences.
2. Give OWNER a clear application-management surface.
3. Centralize custom page creation, rename, and deletion.
4. Support one active AI provider with encrypted saved configuration per provider.
5. Add page templates for Ideas, Calendar, Ca Keo, Housework, Assets, Healthbook, Keyboard, Funds, and Learning.
6. Preserve every existing route and existing record as the built-in default partition.
7. Make page rename URL-safe and page deletion predictable.
8. Ensure reports, dashboard feeds, notifications, assistant actions, imports, reorder operations, and linked records respect page partitions.

## Non-Goals

- Arbitrary user-defined fields or schema-less databases.
- Installing executable modules or third-party plugins.
- Multiple simultaneously active AI providers or automatic provider failover in v1.
- A generic Collection template in this phase. The current Keyboard model is domain-specific.
- Moving built-in pages between groups.
- Deleting built-in pages.
- Per-page permissions beyond existing user ownership and sharing rules.
- Migrating existing built-in records into custom pages automatically.

## Terminology

- **Module group:** Personal, Family, or Hobby.
- **Template:** A supported module data model and its existing page UI, such as Ideas or Assets.
- **Built-in page:** The existing route for a template. Its records have `instanceId = null`.
- **Custom page:** A named `PageInstance` whose records have `instanceId = PageInstance.id`.
- **Root record:** The model that owns a custom-page partition. Child records inherit the partition through their root relation.

## Roles and Authorization

| Capability | OWNER | ADMIN | USER |
|---|---:|---:|---:|
| View Application Management | Yes | Yes | No |
| Change app name or enabled groups | Yes | No | No |
| View custom page inventory | Yes | Yes | No |
| Create, rename, delete custom pages | Yes | Yes | No |
| View or change Agent Settings | Yes | No | No |

The Admin sidebar is a navigation group, not a promise that every page in it has identical authorization. The API remains the source of truth.

## Navigation and Routes

Add Admin navigation entries:

- `/admin/application` -> Application Management
- `/admin/agent` -> Agent Settings
- `/users` -> User Management, unchanged

Remove the Application tab from `/settings`. Remove API-key controls from User Settings. Keep Profile, Desktop Features, Phone View, Notifications, Color Settings, Theme, Security, and Assistant as user-level settings.

The old `/settings?tab=application` URL redirects to `/admin/application` for OWNER and to `/settings` for other roles.

## Application Management

### Application Section

OWNER can edit:

- Application name
- Family group enabled state
- Hobby group enabled state

Personal is always enabled; its toggle renders disabled in the UI because it cannot be turned off server-side.

Disabling a group hides its built-in and custom pages but does not delete data. Re-enabling the group restores them.

For ordinary users, custom-page visibility follows the same layered rule as built-in modules: the application group is enabled and the user's feature flag for that template is enabled. OWNER and ADMIN can still see every page in the management inventory even when its navigation entry is hidden.

### Page Inventory

Display custom pages grouped by Personal, Family, and Hobby. Each row shows:

- Page name
- Template
- Group
- Item count
- Created date
- Actions: Rename, Delete

Built-in pages may be shown as read-only rows for context, but they cannot be renamed, moved, or deleted.

### Create Page

Creation is centralized in Application Management. Remove `Add page` controls from sidebar group headings.

Create flow:

1. Select a group.
2. Select one of that group's templates.
3. Enter a page name.
4. Create and navigate to the new page.

Templates are constrained by group:

| Group | Templates |
|---|---|
| Personal | Task, Project, Expense, Goal, Ideas |
| Family | Calendar, Ca Keo, Housework, Assets, Healthbook |
| Hobby | Keyboard, Funds, Learning |

The API validates the template-to-group mapping. A client cannot place a Healthbook page under Hobby by bypassing the UI.

### Rename and Stable URLs

`PageInstance.slug` becomes immutable after creation. Renaming changes only `name` and `updatedAt`. Existing bookmarks and links remain valid.

Slug editing is out of scope. A later explicit slug-management feature can add redirects and collision handling if required.

### Move

Out of scope for v1. With the fixed template-to-group mapping above, every template has exactly one valid group, so a move operation can never change anything. Do not build the route, UI, or tests. If a future template becomes valid in multiple groups, add move then.

### Delete

Deletion is destructive and cascades through `PageInstance`. Before confirmation, the API returns a deletion preview:

```json
{
  "pageId": "...",
  "pageName": "Home Assets",
  "template": "ASSET",
  "counts": {
    "assets": 4,
    "maintenanceRecords": 17,
    "files": 0
  },
  "totalRootItems": 4,
  "totalRelatedItems": 17
}
```

The confirmation dialog names the page and summarizes root and related records. Delete requires the page name to be typed when related records or uploaded files exist.

Deletion must clean up non-database resources such as Healthbook uploads. Database cascades alone are insufficient for files on disk.

## Template Data Architecture

### Template Enumeration

Extend `PageModuleType`:

```text
TASK, PROJECT, EXPENSE, GOAL,
IDEA,
CALENDAR, CAKEO, HOUSEWORK, ASSET, HEALTHBOOK,
KEYBOARD, FUND, LEARNING
```

Use singular enum names matching model concepts. UI labels can remain plural where natural.

### Partition Rules

| Template | Root model | Child handling |
|---|---|---|
| Task | `Task` | Direct `instanceId` |
| Project | `Project` | Project tasks inherit through project |
| Expense | `Expense` | Direct `instanceId` |
| Goal | `Goal` | Check-ins inherit through goal |
| Ideas | `IdeaTopic` | Idea logs inherit through topic |
| Calendar | `CalendarEvent` | Participants inherit through event |
| Ca Keo | `CaKeo` | Direct `instanceId` |
| Housework | `HouseworkItem` | Direct `instanceId` |
| Assets | `Asset` | Maintenance records inherit through asset |
| Healthbook | `HealthPerson` | Logs and files inherit through person/log |
| Keyboard | `Keyboard` | Direct `instanceId` |
| Funds | `FundTransaction` | Direct `instanceId` |
| Learning | `LearningTopic` | Histories inherit through topic |

Add nullable `instanceId` and a cascading `PageInstance` relation only to the root models listed above. Existing rows remain `NULL`.

### Page Creator Deletion

`PageInstance.createdBy` currently uses `onDelete: Cascade`. That means deleting the user who created a page silently deletes the page and every record inside it — including records other family members added. Change the relation to `onDelete: Restrict` and have the user-deletion flow reassign owned pages to the acting OWNER before deleting the user, or block deletion with a clear message listing the pages.

### Hierarchical Integrity

Ideas and Learning currently permit child records with nullable topic IDs. For new custom pages:

- Creating an Idea log requires a topic belonging to the same page instance.
- Creating a Learning history requires a topic belonging to the same page instance.
- Existing built-in orphan records remain valid for backward compatibility.
- Custom-page APIs never return built-in orphan records.

Child mutation routes must load the parent root and verify its `instanceId`; accepting a client-provided `instanceId` on a child is not sufficient.

Assets and Healthbook follow the same parent verification rule for maintenance, logs, and files.

### Calendar Semantics

The built-in Calendar remains the current aggregate view and may display:

- Built-in `CalendarEvent` records
- Built-in Tasks shown on calendar
- Built-in Housework shown on calendar
- Built-in Ca Keo records shown on calendar
- Asset maintenance-linked events

A custom Calendar page is an isolated event calendar. It displays only `CalendarEvent` records assigned to that page and their participants. It does not automatically aggregate records from unrelated custom Task, Housework, Ca Keo, or Asset pages.

This avoids ambiguous cross-page routing. Cross-page calendar overlays can be designed separately later.

### Linked Records

- A maintenance record generated from a custom Asset page remains under that asset.
- If maintenance creates a calendar event, that event remains in the built-in Calendar unless a future explicit target-calendar field is added.
- Expense links created from other modules continue targeting the built-in Expense page unless the user explicitly selects a custom Expense page in a future enhancement.
- Dashboard and notifications preserve links to the originating custom page.

### Query Contract

All root module list/create endpoints follow one contract:

- No `instanceId` query/body means built-in partition (`instanceId = null`).
- `instanceId=<id>` means exactly that custom partition.
- Create validates that the page exists and has the endpoint's expected template.
- Update cannot change `instanceId`.
- Get/update/delete verifies that the record is visible under the requested partition and current authorization rules.

Centralize page-instance validation in a shared service instead of duplicating route-local `assertPageInstance` functions.

## Frontend Template Contract

Each template page accepts:

```ts
type InstancePageProps = {
    instanceId?: string;
    pageTitle?: string;
};
```

Every query key includes `instanceId ?? 'default'`. Every list, create, reorder, import, export, and nested mutation sends the current instance context where applicable.

`InstancePage` uses a registry rather than an `if` chain:

```ts
const TEMPLATE_COMPONENTS: Record<PageModuleType, React.LazyExoticComponent<...>> = {
    TASK: GoalsPage,
    // ...
};
```

The API template catalog is canonical for labels, groups, availability, and management-page choices. A frontend component registry maps the returned enum to lazy page components and icons. Avoid maintaining independent template-choice lists in validators, sidebar code, and modals.

## Dashboard, Reports, Notifications, and Assistant

### Dashboard

Built-in dashboard queries remain scoped to built-in partitions by default. Custom-page records appear only when a record is explicitly pinned or when a dashboard API response includes origin metadata:

```json
{
  "instanceId": "...",
  "instanceName": "Home Projects",
  "instanceSlug": "home-projects"
}
```

Links route to `/p/:slug` instead of the built-in module page.

### Reports and Exports

- Reports default to built-in partitions to preserve current totals.
- Add an optional page filter that includes built-in and custom pages for the selected template.
- Exports from a custom page export only that page's records.
- Imports into a custom page assign all imported root records to that page.

### Notifications and Scheduled Actions

Notification generation includes `instanceId` and page routing metadata where the source supports custom pages. Existing built-in behavior remains unchanged.

### Assistant Actions

Assistant intent entities gain an optional page reference. Resolution order:

1. Exact custom page name.
2. Unique case-insensitive custom page name.
3. Built-in template name.
4. Ask for clarification when multiple pages match.

Actions must never silently write to a custom page based only on template type.

## Agent Settings

### Provider Model

Support these providers:

```text
OPENAI
ANTHROPIC
OPENAI_COMPATIBLE
```

Store one row per provider so switching providers does not discard credentials:

```prisma
model AgentSetting {
  id             Int           @id @default(1)
  activeProvider AgentProvider @default(OPENAI)
  updatedAt      DateTime      @updatedAt
}

model AgentProviderConfig {
  id            String        @id @default(cuid())
  provider      AgentProvider @unique
  baseUrl       String?
  model         String
  effort        String        @default("auto")
  keyCiphertext String?
  keyLast4      String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
}
```

Credentials remain write-only and encrypted with the existing AES-256-GCM secret helper. API responses expose only configured status, last four characters, and source (`db` or `env`).

### Provider Fields

| Provider | Base URL | API key | Model | Effort |
|---|---:|---:|---:|---:|
| OpenAI | Fixed | Required | Required | Auto/Low/Medium/High |
| Claude | Fixed | Required | Required | Auto/Low/Medium/High |
| OpenAI-compatible | Required | Optional by deployment | Required | Auto/Low/Medium/High |

Model is always explicit. Provider defaults may preselect a model, but the persisted model ID is never inferred from the API key.

### Model Discovery

Add an OWNER-only model discovery endpoint. It calls the selected provider's model-list API using the saved or submitted connection details and returns normalized options. The UI also permits manual model ID entry because compatible providers do not consistently implement model listing.

Do not hard-code a permanent model catalog. Provider model inventories change independently of application releases.

### Provider Adapter

Replace direct OpenAI construction in `intentParser.ts` with:

```ts
interface AgentProviderAdapter {
    listModels(): Promise<AgentModel[]>;
    testConnection(): Promise<AgentConnectionResult>;
    generateStructuredIntent(input: AgentIntentInput): Promise<string>;
}
```

- OpenAI adapter uses the existing `openai` package.
- OpenAI-compatible adapter uses the same package with `baseURL`.
- Claude adapter uses the official Anthropic TypeScript SDK and Messages API.
- A provider factory reads the active configuration and caches clients by a non-secret configuration fingerprint.

The parser keeps the regex fallback when no provider is configured or when provider execution fails according to the current failure policy.

### Effort

The UI exposes `auto`, `low`, `medium`, and `high`. Adapters map this to provider-supported parameters. Unsupported effort values are omitted rather than causing provider errors. Temperature remains internal and is not exposed in v1.

### Test Connection

Test Connection performs the smallest provider-appropriate request and returns:

- Success/failure
- Provider
- Model
- Latency
- Sanitized error category and message

Never return upstream response headers, keys, or full request bodies.

### Custom URL Security

Custom base URLs create a server-side request forgery boundary. The API must:

- Require `https` by default.
- Reject credentials embedded in URLs.
- Resolve DNS and block loopback, link-local, multicast, and private network destinations.
- Re-check the connected address to reduce DNS rebinding risk.
- Limit redirects and revalidate every redirect target.
- Apply short connection and response timeouts.
- Limit response size for model discovery and connection tests.
- Allow trusted private endpoints only when an explicit server environment flag enables them.

## Migration and Backward Compatibility

1. Add new enums/tables/nullable root `instanceId` fields in additive migrations.
2. Existing data remains `instanceId = null` and existing routes keep their behavior.
3. Migrate existing `AppSetting.openaiKeyCiphertext/openaiKeyLast4` into the OPENAI provider config.
4. Preserve `OPENAI_API_KEY` as an environment fallback when no DB OpenAI key exists.
5. New providers (Anthropic, OpenAI-compatible) are configured through the DB only; no per-provider environment variables. The only new env var is the `ALLOW_PRIVATE_AGENT_ENDPOINTS` security flag.
6. Remove legacy OpenAI columns only in a later cleanup migration after production verification.

## Observability

- Log provider name, model, latency, and success/failure without secrets or prompt content.
- Log custom page create/rename/delete with actor, page ID, template, and counts.
- Add active provider and page-template count to diagnostics, not public health output.
- Never log decrypted credentials.

## Acceptance Criteria

1. Application and Agent configuration no longer appears in User Settings.
2. Admin navigation exposes Application Management and Agent Settings according to role.
3. Existing built-in pages and data behave exactly as before.
4. All thirteen templates can create isolated custom pages.
5. Rename does not change a page URL.
6. Delete preview accurately counts root and child records and cleans uploaded files.
7. Every module import, export, reorder, nested mutation, dashboard link, report filter, and notification respects page context.
8. OpenAI, Claude, and a standards-compliant custom OpenAI endpoint can parse an assistant intent.
9. Credentials are encrypted, write-only, and never logged.
10. Custom endpoint validation blocks unsafe network targets by default.
11. API and web test suites pass against both PostgreSQL migration shape and generated SQLite test schema.

## Delivery Strategy

Deliver in independently deployable phases:

1. Admin navigation and centralized management for existing templates.
2. Multi-provider Agent Settings and adapters.
3. Flat templates.
4. Hierarchical templates.
5. Cross-cutting dashboard/report/notification/assistant integration.

Do not ship partially partitioned templates. A template becomes selectable only after all of its list/create/update/delete, nested, import/export, reorder, and routing paths are instance-aware.

## Provider References

- OpenAI model inventory and capabilities: <https://platform.openai.com/docs/models>
- OpenAI JavaScript SDK: <https://github.com/openai/openai-node>
- Claude model inventory API: <https://docs.claude.com/en/api/models-list>
- Claude model capabilities: <https://docs.claude.com/en/docs/about-claude/models/overview>
