# Chat Assistant Design

## Goal

Add a Telegram-based assistant for NgocKy so a user can:

- create items from natural language
- update task status from chat
- query calendar events with natural language filters
- log expenses quickly
- check in on goals
- query and update housework status

Telegram is the chat UI. NgocKy API remains the system of record for identity, authorization, validation, and database writes.

## Product Scope

### V1 capabilities

- create standalone tasks from Telegram
- mark standalone tasks done / reopen
- update project task status
- query calendar events by natural language date/time filters
- query personal tasks such as `today`, `tomorrow`, `this week`
- add a quick expense log (amount + category + optional note)
- query expense history by date range or category
- log a goal check-in (progress value + goal name)
- query goal progress
- query housework items by status/due date
- mark a housework item done
- list projects with task counts and board status
- list project tasks filtered by project name or status

### Out of scope for V1

- delete actions
- generic free-form edit of any field
- goal creation or editing
- project task creation
- learning / ideas management
- appliances and devices management
- notification and scheduled action management via chat
- expense reports or goal reports via chat
- voice/image handling
- multi-step autonomous workflows

### V1.5 candidates

- query expense summary / spending report by date range
- create project tasks
- quick-capture learning items and ideas
- housework assignment to family members

## Current System Fit

The current codebase already has all domain APIs needed for V1 execution:

- standalone task CRUD in `apps/api/src/routes/tasks.ts`
- project task status flows in `apps/api/src/routes/projects.ts`
- calendar querying in `apps/api/src/routes/calendar.ts`
- expense creation in `apps/api/src/routes/expenses.ts`
- goal check-in in `apps/api/src/routes/checkins.ts`
- housework CRUD in `apps/api/src/routes/housework.ts`
- user notification profile already includes `telegramChatId`
- n8n is already used as an integration/polling layer for notifications and scheduled actions

What is missing is an assistant layer:

- inbound Telegram webhook handling
- Telegram-to-user binding and verification
- machine-to-machine auth for assistant execution
- intent parsing and action routing
- audit logging and confirmation state

No new domain CRUD endpoints are required. The assistant resolvers call existing domain routes internally.

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

### n8n workflow structure

The n8n workflow for inbound Telegram messages:

1. **Telegram Trigger node** — webhook mode, registered via BotFather webhook URL
2. **Code node** — normalize payload: extract `chatId`, `telegramUserId`, `username`, `messageId`, `text`, `messageType`
3. **If node** — skip non-text messages (photos, stickers, voice) with a polite reply
4. **HTTP Request node** — `POST /api/assistant/telegram/message` with `X-Assistant-Api-Key` header
5. **HTTP Request node (Telegram sendMessage)** — send `reply` text back to the user's `chatId`

A separate n8n workflow handles outbound notifications (morning summary, deadlines). These are independent and do not share state with the assistant workflow.

## Telegram Bot Setup

### Bot creation

- Create bot via BotFather: `/newbot`
- Set webhook (not polling) pointing to the n8n webhook trigger URL
- Register commands with BotFather for discoverability:
  - `/start` — welcome message and usage instructions
  - `/help` — list available commands
  - `/link <code>` — link Telegram account to NgocKy

### Message type handling

In V1, only text messages are processed. Other message types (photo, sticker, voice, document) receive a fixed reply:

> "I can only process text messages right now. Send /help for available commands."

### Telegram message formatting

Use **MarkdownV2** mode for Telegram responses. Key rules:
- Escape special characters: `.`, `!`, `-`, `(`, `)`, `>`, `#`
- Keep responses under 4096 characters (Telegram limit)
- Use bold (`*text*`) for item titles, inline code (`` `value` ``) for dates/statuses
- Do not use HTML mode

### Response length guidelines

- Task created: 1–2 lines
- Task/housework status update: 1 line
- Calendar query result: max 10 items, each on its own line
- Task query result: max 10 items, grouped by status if mixed
- Expense logged: 1 line
- Goal check-in logged: 1 line
- Clarification request: max 5 options shown

## Identity Model

### Telegram binding

One Telegram chat should map to exactly one NgocKy user. A unique constraint on `telegramChatId` in `TelegramLink` enforces this.

Recommended flow:

1. user opens NgocKy Settings
2. user generates a one-time link code (expires in 15 minutes)
3. user sends `/link <code>` to the Telegram bot
4. NgocKy verifies the code, checks for existing binding, and stores the Telegram chat binding
5. bot replies with a confirmation message

### Why not use only `telegramChatId`

The current `telegramChatId` field is useful, but not enough by itself for a safe assistant. We also need:

- verified link status
- when and how the binding was created
- optional link reset/revoke support
- uniqueness enforcement at the DB level

## Intent Model

The LLM should return structured intents, not direct prose-only decisions.

### V1 intent set

- `create_task`
- `update_task_status`
- `update_project_task_status`
- `query_projects`
- `query_project_tasks`
- `query_calendar`
- `query_tasks`
- `create_expense`
- `query_expenses`
- `goal_checkin`
- `query_goals`
- `query_housework`
- `update_housework_status`
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

```json
{
  "intent": "create_expense",
  "confidence": 0.95,
  "entities": {
    "amount": 150000,
    "category": "FOOD",
    "note": "lunch with client"
  }
}
```

```json
{
  "intent": "goal_checkin",
  "confidence": 0.88,
  "entities": {
    "goalName": "running",
    "value": 5,
    "unit": "km",
    "note": "felt good"
  }
}
```

### Vietnamese and multilingual handling

Users may write in Vietnamese, English, or mixed. The LLM system prompt must explicitly instruct:

- accept input in any language
- return intent and entity fields in English (enum-compatible values)
- map Vietnamese phrases to correct enum values:
  - `"xong"`, `"hoàn thành"`, `"done rồi"` → status `DONE`
  - `"mở lại"`, `"chưa xong"` → status `PLANNED`
  - `"đang làm"`, `"in progress"` → status `IN_PROGRESS`
  - `"cao"`, `"urgent"` → priority `HIGH`
  - `"thấp"` → priority `LOW`
- date expressions like `"ngày mai"`, `"tuần này"`, `"sáng mai"` must be resolved to ISO dates using the user's timezone

### Timezone in date parsing

The LLM system prompt must include the user's configured timezone (default `Asia/Ho_Chi_Minh`). All relative date expressions (`"tomorrow"`, `"this week"`, `"ngày mai"`) must be resolved to absolute ISO dates anchored to the user's local time, not UTC.

The `intentParser` service injects the user's timezone from their settings record into the LLM prompt at runtime.

### `help` and `fallback` responses

`help` intent reply:

```
NgocKy Assistant — available commands:

*Tasks*
• "add task <title> [due <date>]"
• "mark <task name> done"
• "what tasks do I have today"

*Calendar*
• "what events do I have tomorrow"
• "show events this week"

*Expenses*
• "spent <amount> on <category>"

*Goals*
• "logged <value> km for running goal"

*Housework*
• "what chores are due today"
• "mark dishes done"

Send /link <code> to connect your NgocKy account.
```

`fallback` intent reply:

```
I didn't understand that. Send /help to see what I can do.
```

## Safety and UX Rules

### Confirmation policy

Do not require confirmation for every write. Require it when:

- confidence is below 0.75
- more than one matching task exists
- required fields are missing
- the action would affect multiple items

### Matching policy

For commands like `mark electricity task done`:

- if one clear match exists, execute
- if multiple matches exist, ask the user to choose (show up to 5 options)
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
- `userId` (unique — one NgocKy user per Telegram chat)
- `telegramChatId` (unique — one Telegram chat per NgocKy user)
- `telegramUserId`
- `telegramUsername`
- `linkCode` (nullable — cleared after successful link)
- `linkCodeExpiresAt` (nullable — 15-minute TTL)
- `verifiedAt`
- `createdAt`
- `updatedAt`

Purpose:

- verified mapping between Telegram and NgocKy user
- uniqueness enforced at DB level on both `userId` and `telegramChatId`

### `AssistantMessage`

- `id`
- `userId`
- `channel` (`TELEGRAM`)
- `externalMessageId`
- `direction` (`INBOUND`, `OUTBOUND`)
- `rawText`
- `normalizedText`
- `intent` (nullable — for inbound messages, once parsed)
- `confidence` (nullable)
- `createdAt`

Purpose:

- message history and debugging
- correlate message → action log without additional joins

### `AssistantActionLog`

- `id`
- `userId`
- `channel`
- `intent`
- `confidence`
- `requestPayload`
- `resolvedEntities`
- `executionStatus` (`SUCCESS`, `FAILED`, `PENDING_CONFIRMATION`, `CANCELLED`)
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

- `POST /api/assistant/telegram/message`
  - main entrypoint from n8n, authenticated with `X-Assistant-Api-Key`
- `POST /api/assistant/telegram/link`
  - link code verification, authenticated with `X-Assistant-Api-Key`
- `POST /api/assistant/telegram/confirm`
  - confirm pending action, authenticated with `X-Assistant-Api-Key`
- `POST /api/assistant/link-code`
  - generate link code, authenticated with browser JWT (called from Settings UI)
- `DELETE /api/assistant/telegram/link`
  - revoke Telegram binding, authenticated with browser JWT (called from Settings UI)

### Internal service layout

- `apps/api/src/routes/assistant.ts`
- `apps/api/src/services/assistant/telegram.ts`
- `apps/api/src/services/assistant/messageNormalizer.ts`
- `apps/api/src/services/assistant/intentParser.ts`
- `apps/api/src/services/assistant/actionExecutor.ts`
- `apps/api/src/services/assistant/policies.ts`
- `apps/api/src/services/assistant/resolvers/taskCreate.ts`
- `apps/api/src/services/assistant/resolvers/taskStatus.ts`
- `apps/api/src/services/assistant/resolvers/taskQuery.ts`
- `apps/api/src/services/assistant/resolvers/projectTaskStatus.ts`
- `apps/api/src/services/assistant/resolvers/calendarQuery.ts`
- `apps/api/src/services/assistant/resolvers/expenseCreate.ts`
- `apps/api/src/services/assistant/resolvers/goalCheckin.ts`
- `apps/api/src/services/assistant/resolvers/houseworkQuery.ts`
- `apps/api/src/services/assistant/resolvers/houseworkStatus.ts`

### Rate limiting

The `/api/assistant/telegram/message` endpoint must be rate-limited per `chatId`: maximum 20 requests per minute. This prevents abuse from looped or bot-generated messages.

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

Supported transitions:

- `done` → sets status to `DONE` via `POST /api/tasks/:id/complete`
- `reopen` → sets status to `PLANNED` via `PATCH /api/tasks/:id`

For standalone tasks and project tasks, use separate resolver logic because matching and routes differ.

### Query calendar

Examples:

- `what do I have tomorrow morning`
- `show family events this weekend`
- `what events next week in HCMC`
- `lịch tuần này có gì không`

The assistant converts this into structured filters:

- date range (resolved from user's timezone)
- text keyword
- category
- location

### Create expense

Examples:

- `spent 150k on coffee`
- `chi 500 nghìn tiền điện`
- `food expense 80000`

Required: amount. Optional: category, note. Amount is always VND.

### Goal check-in

Examples:

- `logged 5km run today`
- `chạy 3km buổi sáng`
- `read 30 pages for reading goal`

Resolver searches active goals by name match, then calls `POST /api/checkins`.

### Query housework

Examples:

- `what chores are due today`
- `show pending housework`
- `việc nhà hôm nay có gì`

Returns active, non-archived housework items filtered by status and due date.

### Update housework status

Examples:

- `mark dishes done`
- `rửa bát xong rồi`

Uses same one-match / multi-match / no-match policy as task status updates.

## AI Placement

### Recommended first version

Use n8n to call the LLM if that is faster operationally, but require NgocKy API to validate and execute.

### Better long-term version

Move LLM calling into NgocKy API so:

- prompts and schemas are versioned with code
- logging stays in one place
- retries and fallbacks are easier to manage

## Environment Variables

New variables required (add to `.env` and deployment secrets):

| Variable | Purpose |
|----------|---------|
| `ASSISTANT_API_KEY` | Shared secret between n8n and NgocKy assistant routes |
| `ANTHROPIC_API_KEY` | LLM API key (if calling Claude directly from NgocKy) |
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather (used by n8n Telegram nodes) |

## Security

- assistant routes must use service-to-service authentication (`X-Assistant-Api-Key`), not browser JWTs
- n8n must include the API key header on every call to the assistant endpoint
- Telegram chat identity must be verified before write actions are allowed
- every write action must be attributable to a specific NgocKy user
- assistant execution must respect existing role and ownership rules
- link codes expire after 15 minutes
- a single Telegram chat can only be linked to one NgocKy user (DB-level uniqueness)
- rate limiting per chatId on inbound message endpoint

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
- linked Telegram user can log an expense
- linked Telegram user can log a goal check-in
- linked Telegram user can query and update housework status
- ambiguous commands produce clarification instead of wrong writes
- all assistant writes are auditable
- Vietnamese and mixed-language inputs are handled correctly
