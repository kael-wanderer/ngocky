# Chat Assistant Design

## Goal

Add a Telegram-based assistant for NgocKy so a user can:

- create items from natural language
- update task status from chat
- query calendar events with natural language filters

Telegram is the chat UI. NgocKy API remains the system of record for identity, authorization, validation, and database writes.

## Product Scope

### V1 capabilities

- create standalone tasks from Telegram
- mark standalone tasks done / reopen
- update project task status
- query calendar events by natural language date/time filters
- query personal tasks such as `today`, `tomorrow`, `this week`

### Out of scope for V1

- delete actions
- generic free-form edit of any field
- direct expense creation
- direct goal updates
- voice/image handling
- multi-step autonomous workflows

## Current System Fit

The current codebase already has most domain APIs needed for execution:

- standalone task CRUD in `apps/api/src/routes/tasks.ts`
- project task status flows in `apps/api/src/routes/projects.ts`
- calendar querying in `apps/api/src/routes/calendar.ts`
- user notification profile already includes `telegramChatId`
- n8n is already used as an integration/polling layer for notifications and scheduled actions

What is missing is an assistant layer:

- inbound Telegram webhook handling
- Telegram-to-user binding and verification
- machine-to-machine auth for assistant execution
- intent parsing and action routing
- audit logging and confirmation state

## Architecture

### Recommended flow

1. Telegram user sends a message
2. Telegram calls an n8n webhook
3. n8n normalizes the payload and forwards it to NgocKy assistant API
4. NgocKy assistant service resolves the user by Telegram chat binding
5. NgocKy assistant service sends the text to an LLM for intent extraction
6. NgocKy validates the structured intent against policy and app data
7. NgocKy executes the action via assistant services
8. NgocKy returns a structured response
9. n8n sends the final message back to Telegram

### Boundary decisions

- Telegram is only the frontend channel
- n8n is transport/orchestration, not the source of truth
- AI may classify/extract intent, but does not directly write to the database
- NgocKy API owns:
  - user identity
  - authorization
  - validation
  - ambiguity handling
  - execution
  - audit logs

## Identity Model

### Telegram binding

One Telegram chat should map to one NgocKy user.

Recommended flow:

1. user opens NgocKy Settings
2. user generates a one-time link code
3. user sends `/link <code>` to the Telegram bot
4. NgocKy verifies the code and stores the Telegram chat binding

### Why not use only `telegramChatId`

The current `telegramChatId` field is useful, but not enough by itself for a safe assistant. We also need:

- verified link status
- when and how the binding was created
- optional link reset/revoke support

## Intent Model

The LLM should return structured intents, not direct prose-only decisions.

### Initial intent set

- `create_task`
- `update_task_status`
- `update_project_task_status`
- `query_calendar`
- `query_tasks`
- `link_telegram`
- `help`
- `fallback`

### Example structured output

```json
{
  "intent": "create_task",
  "confidence": 0.93,
  "entities": {
    "title": "Pay electricity bill",
    "dueDate": "2026-03-12",
    "priority": "HIGH"
  }
}
```

## Safety and UX Rules

### Confirmation policy

Do not require confirmation for every write. Require it when:

- confidence is low
- more than one matching task exists
- required fields are missing
- the action would affect multiple items

### Matching policy

For commands like `mark electricity task done`:

- if one clear match exists, execute
- if multiple matches exist, ask the user to choose
- if no match exists, explain what was searched

### Error policy

Assistant replies should be short and action-oriented:

- what was understood
- what was done
- what needs clarification if blocked

## Data Model Additions

Recommended new tables:

### `TelegramLink`

- `id`
- `userId`
- `telegramChatId`
- `telegramUserId`
- `telegramUsername`
- `verifiedAt`
- `createdAt`
- `updatedAt`

Purpose:

- verified mapping between Telegram and NgocKy user

### `AssistantMessage`

- `id`
- `userId`
- `channel` (`TELEGRAM`)
- `externalMessageId`
- `direction` (`INBOUND`, `OUTBOUND`)
- `rawText`
- `normalizedText`
- `createdAt`

Purpose:

- message history and debugging

### `AssistantActionLog`

- `id`
- `userId`
- `channel`
- `intent`
- `confidence`
- `requestPayload`
- `resolvedEntities`
- `executionStatus`
- `resultSummary`
- `errorMessage`
- `createdAt`

Purpose:

- audit and support debugging

### `AssistantPendingAction`

- `id`
- `userId`
- `channel`
- `intent`
- `payload`
- `expiresAt`
- `createdAt`

Purpose:

- confirmation and disambiguation state

## API Design

Create assistant-specific routes instead of reusing browser-oriented routes directly from n8n.

### Proposed routes

- `POST /api/assistant/telegram/webhook`
  - optional if NgocKy receives Telegram directly
- `POST /api/assistant/telegram/message`
  - main entrypoint from n8n
- `POST /api/assistant/telegram/link`
  - link code verification
- `POST /api/assistant/telegram/confirm`
  - confirm pending action

### Internal service layout

- `apps/api/src/routes/assistant.ts`
- `apps/api/src/services/assistant/telegram.ts`
- `apps/api/src/services/assistant/intentParser.ts`
- `apps/api/src/services/assistant/actionExecutor.ts`
- `apps/api/src/services/assistant/taskResolver.ts`
- `apps/api/src/services/assistant/calendarResolver.ts`
- `apps/api/src/services/assistant/policies.ts`

## Domain Execution Strategy

### Create standalone task

Assistant converts natural language into a validated task payload, then calls task domain logic.

Required minimum:

- title

Optional in V1:

- due date
- priority
- note

### Update task status

Supported:

- `done`
- `reopen`

For standalone tasks and project tasks, use separate resolver logic because matching and routes differ.

### Query calendar

Examples:

- `what do I have tomorrow morning`
- `show family events this weekend`
- `what events next week in HCMC`

The assistant should convert this into structured filters:

- date range
- text keyword
- category
- location
- shared/personal scope if added later

## AI Placement

### Recommended first version

Use n8n to call the LLM if that is faster operationally, but require NgocKy API to validate and execute.

### Better long-term version

Move LLM calling into NgocKy API so:

- prompts and schemas are versioned with code
- logging stays in one place
- retries and fallbacks are easier to manage

## Security

- assistant routes must use service-to-service authentication, not browser JWTs
- n8n should call assistant endpoints with a dedicated API secret
- Telegram chat identity must be verified before write actions are allowed
- every write action must be attributable to a specific NgocKy user
- assistant execution must respect existing role and ownership rules

## Observability

Track:

- inbound message count
- parsed intent distribution
- successful actions
- ambiguous matches
- failed actions
- average assistant latency

Store enough data to replay/debug a failure without exposing secrets in logs.

## V1 Success Criteria

- linked Telegram user can create a standalone task successfully
- linked Telegram user can mark a task done successfully
- linked Telegram user can query calendar events for a natural language range
- ambiguous commands produce clarification instead of wrong writes
- all assistant writes are auditable
