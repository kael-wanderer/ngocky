# Chat Assistant Implementation Plan

## Objective

Implement a Telegram chat assistant for NgocKy V1 with safe write actions and natural language querying across tasks, calendar, expenses, goals, and housework.

## Delivery Strategy

Build this as a separate assistant slice with new files and isolated routes. Do not mix assistant orchestration into existing task/calendar/expense route files beyond reusing domain logic. All new domain execution goes through assistant resolvers that call existing internal service logic.

## Environment Variables

Add these before starting implementation:

| Variable | Where | Purpose |
|----------|-------|---------|
| `ASSISTANT_API_KEY` | `.env` + deployment | Shared secret between n8n and NgocKy assistant routes |
| `ANTHROPIC_API_KEY` | `.env` + deployment | LLM API key (Option B: NgocKy calls LLM directly) |
| `TELEGRAM_BOT_TOKEN` | n8n credentials | Bot token from BotFather, used in n8n Telegram nodes |

## Phase 1: Assistant Foundations

### Backend

1. Add new Prisma models:
   - `TelegramLink` — with unique constraints on `userId` and `telegramChatId`
   - `AssistantMessage`
   - `AssistantActionLog`
   - `AssistantPendingAction`
2. Create Prisma migration
3. Generate Prisma client

### Prisma schema additions

```prisma
model TelegramLink {
  id                 String    @id @default(cuid())
  userId             String    @unique
  telegramChatId     String    @unique
  telegramUserId     String
  telegramUsername   String?
  linkCode           String?
  linkCodeExpiresAt  DateTime?
  verifiedAt         DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  user               User      @relation(fields: [userId], references: [id])
}

enum AssistantChannel {
  TELEGRAM
}

enum MessageDirection {
  INBOUND
  OUTBOUND
}

enum ExecutionStatus {
  SUCCESS
  FAILED
  PENDING_CONFIRMATION
  CANCELLED
}

model AssistantMessage {
  id                String           @id @default(cuid())
  userId            String
  channel           AssistantChannel
  externalMessageId String?
  direction         MessageDirection
  rawText           String
  normalizedText    String?
  intent            String?
  confidence        Float?
  createdAt         DateTime         @default(now())
  user              User             @relation(fields: [userId], references: [id])
}

model AssistantActionLog {
  id               String           @id @default(cuid())
  userId           String
  channel          AssistantChannel
  intent           String
  confidence       Float?
  requestPayload   Json?
  resolvedEntities Json?
  executionStatus  ExecutionStatus
  resultSummary    String?
  errorMessage     String?
  createdAt        DateTime         @default(now())
  user             User             @relation(fields: [userId], references: [id])
}

model AssistantPendingAction {
  id        String           @id @default(cuid())
  userId    String
  channel   AssistantChannel
  intent    String
  payload   Json
  expiresAt DateTime
  createdAt DateTime         @default(now())
  user      User             @relation(fields: [userId], references: [id])
}
```

### API files

Create:

- `apps/api/src/routes/assistant.ts`
- `apps/api/src/services/assistant/telegram.ts`
- `apps/api/src/services/assistant/policies.ts`

`policies.ts` defines:
- minimum confidence threshold (0.75)
- pending action TTL (15 minutes)
- max matches before disambiguation (5)
- rate limit: 20 inbound messages per chatId per minute

### Output

- assistant route registered in the API
- DB models available
- service secret authentication defined for n8n (`X-Assistant-Api-Key` header)

## Phase 2: Telegram Bot Setup

### BotFather configuration

1. Create bot via `/newbot` in BotFather
2. Register bot commands:
   - `/start` — welcome and usage
   - `/help` — available commands list
   - `/link` — account linking
3. Set webhook URL to n8n Telegram Trigger webhook endpoint

### n8n workflow: inbound message

Create n8n workflow "NgocKy Assistant — Inbound":

1. **Telegram Trigger** (webhook mode)
2. **Code node** — normalize:
   ```js
   const msg = $input.first().json.message;
   return [{
     json: {
       chatId: String(msg.chat.id),
       telegramUserId: String(msg.from.id),
       telegramUsername: msg.from.username ?? '',
       messageId: String(msg.message_id),
       text: msg.text ?? '',
       messageType: msg.text ? 'text' : 'other'
     }
   }];
   ```
3. **If node** — branch on `messageType === 'text'`
   - false branch: send fixed reply "I can only process text messages right now."
4. **HTTP Request** — `POST /api/assistant/telegram/message`
   - Header: `X-Assistant-Api-Key: {{$env.ASSISTANT_API_KEY}}`
   - Body: `{ chatId, telegramUserId, telegramUsername, messageId, text }`
5. **Telegram node (sendMessage)** — send `{{ $json.reply }}` to `chatId`

### Output

- Telegram messages flow end-to-end through n8n to NgocKy and back

## Phase 3: Telegram Link Flow

### Backend

1. `POST /api/assistant/link-code` (browser JWT auth)
   - generate 8-character alphanumeric code
   - store in `TelegramLink.linkCode` with 15-minute expiry
   - return code to UI
2. `POST /api/assistant/telegram/link` (service key auth, called from n8n)
   - receive `chatId`, `telegramUserId`, `telegramUsername`, `code`
   - validate code exists and has not expired
   - check no other user is already linked to this `chatId`
   - set `verifiedAt`, clear `linkCode` and `linkCodeExpiresAt`
   - return success reply text
3. `DELETE /api/assistant/telegram/link` (browser JWT auth)
   - delete `TelegramLink` for the current user

### n8n workflow: link command

Handle `/link <code>` as a special case in the inbound workflow:
- If text starts with `/link`, call `POST /api/assistant/telegram/link` instead of the message endpoint

### Frontend

Add to `apps/web/src/pages/SettingsPage.tsx` (or extract to `apps/web/src/components/settings/TelegramAssistantSettings.tsx`):

- "Connect Telegram" button → calls `POST /api/assistant/link-code` → shows code + 15-min countdown
- Linked state: shows linked username, `verifiedAt` date, "Disconnect" button
- Unlinked state: shows connect button

### Output

- one Telegram chat can be safely linked to one NgocKy user
- link codes expire after 15 minutes
- users can revoke their Telegram link from Settings

## Phase 4: Inbound Message Pipeline

### Backend

Create:

- `apps/api/src/services/assistant/messageNormalizer.ts`
- `apps/api/src/services/assistant/intentParser.ts`
- `apps/api/src/services/assistant/actionExecutor.ts`

### Flow (inside `POST /api/assistant/telegram/message`)

1. Validate `X-Assistant-Api-Key` header
2. Rate-limit by `chatId` (20/min)
3. Look up `TelegramLink` by `chatId` — reject with polite message if not linked
4. Store inbound `AssistantMessage` (direction: INBOUND)
5. Check for active `AssistantPendingAction` — if exists and not expired, route to confirmation handler
6. Call `intentParser` with raw text + user timezone
7. Validate intent shape and confidence
8. Route to resolver via `actionExecutor`
9. Store `AssistantActionLog`
10. Store outbound `AssistantMessage` (direction: OUTBOUND)
11. Return `{ ok, reply, requiresConfirmation }`

### Output

- one assistant entrypoint for all Telegram commands
- message and action audit trail from first message

## Phase 5: LLM Integration

### Option A (faster to ship)

n8n calls the LLM before forwarding to NgocKy. n8n passes structured JSON as `parsedIntent` field alongside `text`. NgocKy uses `parsedIntent` if present, skips LLM call.

### Option B (recommended steady-state)

NgocKy API calls the LLM directly inside `intentParser.ts`.

```
intentParser.ts
  input: rawText, userTimezone, todayISO
  output: { intent, confidence, entities }

LLM system prompt includes:
  - today's date in user's timezone
  - user's timezone (e.g. Asia/Ho_Chi_Minh)
  - full intent enum list
  - entity schemas per intent
  - Vietnamese phrase mappings
  - instruction to always return valid JSON matching the schema
```

### Recommended sequence

- Start with Option A if shipping speed matters
- Design `intentParser.ts` interface so Option B replaces internals without changing callers or routes

## Phase 6: V1 Intent Resolvers

### `create_task` → `resolvers/taskCreate.ts`

- resolve title, dueDate (timezone-anchored), priority, description
- validate: title required
- call task creation domain logic (`POST /api/tasks` equivalent)
- reply: "Created task: *{title}*. Due: {date}."

### `update_task_status` → `resolvers/taskStatus.ts`

- search standalone tasks by title fuzzy match (user-scoped)
- one match: update status
- multiple matches: create `AssistantPendingAction`, return numbered list
- no match: explain what was searched
- supported transitions: `done` → `DONE`, `reopen` → `PLANNED`

### `update_project_task_status` → `resolvers/projectTaskStatus.ts`

- search project tasks by title fuzzy match (user-scoped)
- same one/multi/none policy as task status
- supported transitions: `PLANNED`, `IN_PROGRESS`, `DONE`

### `query_calendar` → `resolvers/calendarQuery.ts`

- resolve date range from entities (timezone-anchored)
- apply optional keyword, category, location filters
- call `GET /api/calendar?startFrom=&startTo=`
- format: each event on one line with date/time and title
- max 10 results

### `query_tasks` → `resolvers/taskQuery.ts`

- resolve date range: `today`, `tomorrow`, `this week` → ISO range in user timezone
- query standalone tasks by due date range and status
- format: grouped by status, max 10 results

### `create_expense` → `resolvers/expenseCreate.ts`

- resolve amount (VND), category, optional note
- validate: amount required
- call expense creation domain logic (`POST /api/expenses` equivalent)
- reply: "Logged expense: {amount} VND — {category}."

### `goal_checkin` → `resolvers/goalCheckin.ts`

- search active goals by name match
- one match: create check-in via `POST /api/checkins`
- multiple matches: disambiguation
- reply: "Check-in logged for *{goal name}*: {value} {unit}."

### `query_housework` → `resolvers/houseworkQuery.ts`

- resolve optional status filter and date range
- call `GET /api/housework`
- filter active (non-archived) items
- format: each item on one line with due date and assignee if set
- max 10 results

### `update_housework_status` → `resolvers/houseworkStatus.ts`

- search housework items by title fuzzy match (user-scoped)
- same one/multi/none policy as task status
- supported: mark done
- call `PATCH /api/housework/:id`

### `help` intent

Return the formatted help text defined in the design document.

### `fallback` intent

Return: "I didn't understand that. Send /help to see what I can do."

## Phase 7: Confirmation and Disambiguation

Add support for pending actions:

- ambiguous task/housework match (multiple candidates)
- low-confidence write action (below 0.75)
- missing required fields (e.g. expense with no amount)

Implementation:

1. create `AssistantPendingAction` with serialized payload and 15-minute expiry
2. return a structured clarification prompt (numbered list of options)
3. next inbound message from same user is routed to confirmation handler
4. user replies with a number or `cancel`
5. resolve selection and execute stored action, or cancel and clean up

## Phase 8: Testing

### Unit tests

- intent validation and confidence thresholds
- date range parsing for Vietnamese and English inputs
- timezone-anchored date resolution
- task/housework fuzzy matching
- ambiguity branching logic
- link code generation and expiry

### Integration tests

- linked Telegram user can create task
- linked Telegram user can mark task done
- linked Telegram user can query calendar
- linked Telegram user can log expense
- linked Telegram user can log goal check-in
- linked Telegram user can query housework
- linked Telegram user can mark housework done
- unlinked chat cannot execute write actions
- expired link code is rejected
- duplicate Telegram chat link is rejected

### Suggested test files

- `apps/api/src/test/assistant-link.test.ts`
- `apps/api/src/test/assistant-create-task.test.ts`
- `apps/api/src/test/assistant-update-task.test.ts`
- `apps/api/src/test/assistant-calendar-query.test.ts`
- `apps/api/src/test/assistant-expense.test.ts`
- `apps/api/src/test/assistant-goal-checkin.test.ts`
- `apps/api/src/test/assistant-housework.test.ts`

## API Contract

### Inbound message

`POST /api/assistant/telegram/message`
Header: `X-Assistant-Api-Key: <secret>`

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
  "reply": "Created task: *Pay electricity bill*. Due: Mar 12, 2026.",
  "requiresConfirmation": false
}
```

### Link verification (called from n8n on /link command)

`POST /api/assistant/telegram/link`
Header: `X-Assistant-Api-Key: <secret>`

```json
{
  "chatId": "123456789",
  "telegramUserId": "123456789",
  "telegramUsername": "kael",
  "code": "A3K9XZ21"
}
```

### Confirm pending action

`POST /api/assistant/telegram/confirm`
Header: `X-Assistant-Api-Key: <secret>`

```json
{
  "chatId": "123456789",
  "selection": "1"
}
```

### Generate link code (browser)

`POST /api/assistant/link-code`
Header: `Authorization: Bearer <jwt>`

Response:
```json
{
  "code": "A3K9XZ21",
  "expiresAt": "2026-03-11T09:15:00.000Z"
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
- `apps/api/src/services/assistant/resolvers/taskQuery.ts`
- `apps/api/src/services/assistant/resolvers/projectTaskStatus.ts`
- `apps/api/src/services/assistant/resolvers/calendarQuery.ts`
- `apps/api/src/services/assistant/resolvers/expenseCreate.ts`
- `apps/api/src/services/assistant/resolvers/goalCheckin.ts`
- `apps/api/src/services/assistant/resolvers/houseworkQuery.ts`
- `apps/api/src/services/assistant/resolvers/houseworkStatus.ts`

### New frontend files or changes

- extend `SettingsPage.tsx` with Telegram assistant link UI
- optional helper component: `apps/web/src/components/settings/TelegramAssistantSettings.tsx`

## Risks

### Main risks

- wrong task/housework match from natural language
- inconsistent LLM output shape
- weak Telegram identity binding
- difficult debugging without audit logs
- Vietnamese date expressions misresolved without timezone

### Risk controls

- structured intent schema with Zod validation
- assistant-specific audit tables
- confirmation on ambiguity (below 0.75 confidence or multiple matches)
- one linked chat per user (DB uniqueness)
- assistant service auth (`X-Assistant-Api-Key`) for n8n
- link code 15-minute TTL
- rate limiting per chatId
- timezone injected into every LLM prompt from user settings

## Recommended Build Order

1. env vars + Prisma schema + migration
2. Telegram bot setup (BotFather + n8n workflow skeleton)
3. assistant route + service key auth + message logging
4. link flow (backend + frontend Settings UI)
5. inbound message pipeline (normalizer + executor routing)
6. LLM integration (Option A first)
7. `create_task` resolver
8. `update_task_status` resolver
9. `query_calendar` resolver
10. `query_tasks` resolver
11. `create_expense` resolver
12. `goal_checkin` resolver
13. `query_housework` + `update_housework_status` resolvers
14. confirmation/disambiguation (pending action flow)
15. Vietnamese language validation in test suite
16. frontend settings polish
17. test coverage

## Definition of Done for V1

- Telegram user can link to NgocKy account via one-time code from Settings
- assistant can create standalone task from natural language (including Vietnamese)
- assistant can mark standalone task done
- assistant can update project task status
- assistant can query calendar with natural language date filters
- assistant can log an expense
- assistant can log a goal check-in by goal name
- assistant can query and mark housework done
- ambiguous commands are handled safely with disambiguation
- all assistant actions are logged in `AssistantActionLog`
- Vietnamese and mixed-language inputs produce correct results
- unlinked Telegram chats cannot perform write actions
