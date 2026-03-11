# Chat Assistant Implementation Plan

## Objective

Implement a Telegram chat assistant for NgocKy V1 with safe write actions and natural language querying.

## Delivery Strategy

Build this as a separate assistant slice with new files and isolated routes. Do not mix assistant orchestration into existing task/calendar route files beyond reusing domain logic.

## Phase 1: Assistant Foundations

### Backend

1. Add new Prisma models:
   - `TelegramLink`
   - `AssistantMessage`
   - `AssistantActionLog`
   - `AssistantPendingAction`
2. Create Prisma migration
3. Generate Prisma client

### API files

Create:

- `apps/api/src/routes/assistant.ts`
- `apps/api/src/services/assistant/telegram.ts`
- `apps/api/src/services/assistant/policies.ts`

### Output

- assistant route registered in the API
- DB models available
- service secret authentication defined for n8n

## Phase 2: Telegram Link Flow

### Backend

1. Add link-code generation flow
2. Add Telegram link verification endpoint
3. Persist verified Telegram binding
4. Add revoke/reset link support

### Frontend

Add a small Settings UI section:

- generate link code
- show linked/unlinked state
- reset Telegram link

### Output

- one Telegram chat can be safely linked to one NgocKy user

## Phase 3: Inbound Message Pipeline

### Backend

Create:

- `apps/api/src/services/assistant/messageNormalizer.ts`
- `apps/api/src/services/assistant/intentParser.ts`
- `apps/api/src/services/assistant/actionExecutor.ts`

### Flow

1. accept inbound Telegram message from n8n
2. resolve linked user
3. store inbound `AssistantMessage`
4. parse intent
5. validate intent
6. execute or create pending clarification
7. store `AssistantActionLog`
8. return structured response to n8n

### Output

- one assistant entrypoint for all Telegram commands

## Phase 4: V1 Intent Support

### `create_task`

Implementation:

- resolve task payload
- validate required fields
- create standalone task

Files:

- `apps/api/src/services/assistant/resolvers/taskCreate.ts`

### `update_task_status`

Implementation:

- search candidate standalone tasks
- if exactly one match: update
- if multiple matches: create pending clarification

Files:

- `apps/api/src/services/assistant/resolvers/taskStatus.ts`

### `update_project_task_status`

Implementation:

- search candidate project tasks
- support status transitions such as `PLANNED`, `IN_PROGRESS`, `DONE`

Files:

- `apps/api/src/services/assistant/resolvers/projectTaskStatus.ts`

### `query_calendar`

Implementation:

- parse natural language date range
- parse optional keyword/category/location
- query calendar events
- return compact response formatting

Files:

- `apps/api/src/services/assistant/resolvers/calendarQuery.ts`

### `query_tasks`

Implementation:

- parse ranges like `today`, `tomorrow`, `this week`
- query standalone tasks and optionally project tasks if requested

Files:

- `apps/api/src/services/assistant/resolvers/taskQuery.ts`

## Phase 5: LLM Integration

### Option A: Faster initial delivery

n8n calls the LLM, then forwards structured output to NgocKy assistant API.

Pros:

- fastest to ship
- easy prompt iteration

Cons:

- parsing logic lives outside app code
- harder to version and test

### Option B: Recommended steady-state

NgocKy API calls the LLM directly.

Pros:

- prompts and schemas live in repo
- easier logging and testing
- fewer moving parts

Cons:

- more backend implementation work now

### Recommended sequence

- start with Option A if speed matters
- design backend interfaces so Option B can replace it later without route changes

## Phase 6: Confirmation and Disambiguation

Add support for pending actions:

- ambiguous task match
- low-confidence write action
- missing required fields

Implementation:

1. create `AssistantPendingAction`
2. return a structured clarification prompt
3. accept a follow-up confirm/select message
4. execute the stored action

## Phase 7: Testing

### Unit tests

- intent validation
- date range parsing
- task matching
- ambiguity branching

### Integration tests

- linked Telegram user can create task
- linked Telegram user can mark task done
- linked Telegram user can query calendar
- unlinked chat cannot execute write actions

### Suggested test files

- `apps/api/src/test/assistant-link.test.ts`
- `apps/api/src/test/assistant-create-task.test.ts`
- `apps/api/src/test/assistant-update-task.test.ts`
- `apps/api/src/test/assistant-calendar-query.test.ts`

## API Contract Sketch

### Inbound message

`POST /api/assistant/telegram/message`

```json
{
  "chatId": "123456789",
  "telegramUserId": "123456789",
  "telegramUsername": "kael",
  "messageId": "9001",
  "text": "create task pay electricity bill tomorrow morning"
}
```

### Response

```json
{
  "ok": true,
  "reply": "Created task: Pay electricity bill. Due: Mar 12, 2026.",
  "requiresConfirmation": false
}
```

## File Plan

### New backend files

- `apps/api/src/routes/assistant.ts`
- `apps/api/src/services/assistant/telegram.ts`
- `apps/api/src/services/assistant/messageNormalizer.ts`
- `apps/api/src/services/assistant/intentParser.ts`
- `apps/api/src/services/assistant/actionExecutor.ts`
- `apps/api/src/services/assistant/policies.ts`
- `apps/api/src/services/assistant/resolvers/taskCreate.ts`
- `apps/api/src/services/assistant/resolvers/taskStatus.ts`
- `apps/api/src/services/assistant/resolvers/projectTaskStatus.ts`
- `apps/api/src/services/assistant/resolvers/taskQuery.ts`
- `apps/api/src/services/assistant/resolvers/calendarQuery.ts`

### New frontend files or changes

- extend `SettingsPage.tsx` with Telegram assistant link UI
- optional helper component for link status if the page grows:
  - `apps/web/src/components/settings/TelegramAssistantSettings.tsx`

## Risks

### Main risks

- wrong task match from natural language
- inconsistent AI output shape
- weak Telegram identity binding
- difficult debugging without audit logs

### Risk controls

- structured intent schema validation
- assistant-specific audit tables
- confirmation on ambiguity
- one linked chat per user
- assistant service auth for n8n

## Recommended Build Order

1. schema + migration
2. link flow
3. assistant route + message logging
4. `create_task`
5. `update_task_status`
6. `query_calendar`
7. `query_tasks`
8. confirmation/disambiguation
9. frontend settings polish
10. test coverage

## Definition of Done for V1

- Telegram user can link to NgocKy account
- assistant can create standalone task
- assistant can mark standalone task done
- assistant can update project task status
- assistant can query calendar with natural language date filters
- ambiguous commands are handled safely
- all assistant actions are logged
