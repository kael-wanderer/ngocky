import OpenAI from 'openai';
import { config } from '../../config/env';
import { ASSISTANT_INTENTS, type AssistantIntent } from './policies';
import { todayISO } from './utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedIntent {
    intent: AssistantIntent;
    confidence: number;
    entities: Record<string, any>;
}

// ─── LLM System Prompt ────────────────────────────────────────────────────────

function buildSystemPrompt(today: string, timezone: string): string {
    return `You are an intent parser for NgocKy, a Vietnamese family productivity assistant.
Today is ${today} (timezone: ${timezone}).

Parse the user message and return ONLY a valid JSON object — no markdown, no explanation.

Required JSON format:
{
  "intent": "<intent_name>",
  "confidence": <0.0 to 1.0>,
  "entities": { ... depends on intent }
}

Supported intents and their entity schemas:

create_task:
  entities: { "title": "string (required)", "dueDate": "ISO datetime e.g. 2026-03-12T23:59:00 (optional)", "priority": "LOW|MEDIUM|HIGH|URGENT (optional)" }
  examples: "add task pay bill tomorrow", "tạo task mua sữa ngày mai", "remind me to call doctor Friday"

update_task_status:
  entities: { "taskTitle": "string (required)", "status": "done|reopen (required)" }
  examples: "mark pay bill done", "đánh dấu hoàn thành mua sữa", "complete pay electricity"

update_project_task_status:
  entities: { "taskTitle": "string (required)", "projectName": "string (optional)", "status": "PLANNED|IN_PROGRESS|DONE (required)" }
  examples: "mark website design as in progress", "update task write report to done"

query_projects:
  entities: {}
  examples: "show my projects", "what projects do I have", "list projects", "dự án của tôi", "các dự án đang chạy"

query_project_tasks:
  entities: { "projectName": "string (optional)", "status": "PLANNED|IN_PROGRESS|DONE (optional)" }
  examples: "tasks in website project", "show tasks for app redesign", "what tasks are in progress for budget project", "pending tasks in project X", "công việc trong dự án Y"

query_calendar:
  entities: { "dateRange": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" }, "keyword": "string (optional)" }
  examples: "what events do I have tomorrow", "lịch hôm nay", "show events this week", "any meetings Friday?"

query_tasks:
  entities: { "dateRange": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" } (optional), "status": "PLANNED|IN_PROGRESS|DONE (optional)" }
  examples: "what tasks do I have today", "task hôm nay", "show my pending tasks this week"

create_expense:
  entities: { "amount": <number in VND, required>, "category": "string (required)", "note": "string (optional)", "date": "YYYY-MM-DD (optional, default today)" }
  examples: "spent 50000 on coffee", "tiêu 200k ăn trưa", "chi 150000 cho xăng"
  note: "50k" = 50000, "200k" = 200000, "1 triệu"/"1tr" = 1000000, "1.5 triệu" = 1500000

query_expenses:
  entities: { "dateRange": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" } (optional), "category": "string (optional)" }
  examples: "show expenses this month", "tell me all expenses of March", "chi tiêu tháng 3", "how much did I spend this week", "expenses last month", "show food expenses"
  note: "of March" / "tháng 3" = from 2026-03-01 to 2026-03-31; resolve month names to full date ranges

create_fund:
  entities: { "description": "string (required)", "amount": <number in VND, required>, "type": "BUY|SELL|TOP_UP (required)", "scope": "MECHANICAL_KEYBOARD|PLAY_STATION (required)", "category": "KEYCAP|KIT|SHIPPING|ACCESSORIES|OTHER (required)", "condition": "BNIB|USED (required only for BUY)", "date": "YYYY-MM-DD (optional, default today)", "keyboardName": "string (optional, used for keyboard sell matching)" }
  examples: "log buy keycap gmk cafe 7.8m mechanical keyboard used", "add sell fund kohaku r1 36m kit mechanical keyboard", "top up ps5 2m play station other"

query_funds:
  entities: { "dateRange": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" } (optional), "type": "BUY|SELL|TOP_UP (optional)", "scope": "MECHANICAL_KEYBOARD|PLAY_STATION (optional)", "category": "KEYCAP|KIT|SHIPPING|ACCESSORIES|OTHER (optional)" }
  examples: "show my funds this month", "show keyboard sell funds", "funds for play station", "buy funds in March"

create_keyboard:
  entities: { "name": "string (required)", "price": <number in VND (optional)>, "category": "Kit|Keycap|Shipping|Accessories|Other (optional)", "tag": "string (optional)", "color": "string (optional)", "condition": "BNIB|Used (optional)", "note": "string (optional)" }
  examples: "add keyboard kohaku r1 kit 30m silver", "create keycap gmk cafe 7.8m used", "new keyboard cycle 7 purple"

query_keyboards:
  entities: { "category": "Kit|Keycap|Shipping|Accessories|Other (optional)", "tag": "string (optional)", "color": "string (optional)", "keyword": "string (optional)" }
  examples: "show my keyboards", "show red keycaps", "find board 3 keyboards", "list silver kits"

goal_checkin:
  entities: { "goalTitle": "string (required)", "quantity": <number, optional default 1>, "note": "string (optional)" }
  examples: "logged 5km for running goal", "check in running 5km", "đăng ký chạy bộ 5km", "tập gym xong"

query_goals:
  entities: {}
  examples: "show my goals", "what are my goals", "goal progress", "how am I doing on my goals", "what progress of goals this week", "mục tiêu của tôi", "tiến độ mục tiêu"

query_housework:
  entities: { "dateRange": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" } (optional) }
  examples: "what chores are due today", "việc nhà hôm nay", "show housework this week"

update_housework_status:
  entities: { "itemTitle": "string (required)" }
  examples: "mark dishes done", "đánh dấu hoàn thành rửa bát", "complete vacuuming", "done with sweeping"

create_cakeo:
  entities: { "title": "string (required)", "category": "School|Activity|Medical|Entertainment|Home|Other (optional)", "assignerName": "string (optional, name of person assigned)", "startDate": "YYYY-MM-DD (optional)", "status": "TODO|IN_PROGRESS|DONE|CANCELLED (optional, default TODO)" }
  examples: "add ca keo school trip tomorrow", "tạo ca keo y tế thứ 5", "thêm lịch học cho bé hoạt động ngoại khóa", "new ca keo doctor appointment Friday"

query_cakeos:
  entities: { "dateRange": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" } (optional), "status": "TODO|IN_PROGRESS|DONE|CANCELLED (optional)", "category": "string (optional)" }
  examples: "show ca keo this week", "list ca keo today", "ca keo hôm nay", "lịch ca keo tháng này", "what ca keo do we have tomorrow", "show pending ca keo"

update_cakeo_status:
  entities: { "itemTitle": "string (required)", "status": "TODO|IN_PROGRESS|DONE|CANCELLED (required)" }
  examples: "mark school trip done", "đánh dấu ca keo khám bệnh xong", "complete ca keo activity", "cancel ca keo medical appointment"

help:
  entities: {}
  examples: "/help", "what can you do", "help me", "hướng dẫn"

fallback:
  entities: {}
  use when: message doesn't match any supported intent, is a greeting, or is unclear

Vietnamese date keywords (always resolve to absolute ISO dates):
- hôm nay = today (${today})
- ngày mai / mai = tomorrow
- hôm qua = yesterday
- tuần này = this week (Monday to Sunday)
- cuối tuần = this weekend (Saturday–Sunday)
- thứ 2 = Monday, thứ 3 = Tuesday, ..., thứ 6 = Friday, thứ 7 = Saturday, CN = Sunday

Vietnamese action keywords:
- thêm / tạo / tạo mới = create/add
- hoàn thành / xong / done / đánh dấu xong = mark done
- mở lại = reopen
- tiêu / chi / trả / spent / mua = create_expense
- fund / buy / sell / top up = create_fund or query_funds depending on context
- keyboard / keycap / kit = create_keyboard or query_keyboards depending on context
- lịch / sự kiện / event = query_calendar
- task / việc cần làm = query_tasks or create_task (context-dependent)
- việc nhà / chores / dọn = housework
- goal / mục tiêu / chạy bộ / tập gym / đăng ký = goal_checkin
- ca keo / cakeo / lịch bé / lịch con = create_cakeo or query_cakeos or update_cakeo_status depending on context

Return ONLY the JSON object.`;
}

// ─── Regex Fallback ───────────────────────────────────────────────────────────

function regexFallback(text: string, today: string): ParsedIntent {
    const t = text.toLowerCase().trim();

    if (/^\/help$|^help$|^hướng dẫn/.test(t)) {
        return { intent: 'help', confidence: 1.0, entities: {} };
    }

    if (/\b(add task|create task|tạo task|thêm task|new task|remind me to)\b/i.test(t)) {
        return {
            intent: 'create_task',
            confidence: 0.6,
            entities: { title: text.replace(/^(add task|create task|tạo task|thêm task|new task|remind me to)\s*/i, '').trim() },
        };
    }

    if (/\b(mark|đánh dấu|hoàn thành|complete|done with)\b.+\b(done|xong|hoàn thành|complete)\b/i.test(t) ||
        /\b(đánh dấu hoàn thành|mark .+ done)\b/i.test(t)) {
        const titleMatch = t.match(/\b(?:mark|complete|done with|đánh dấu hoàn thành|hoàn thành)\s+(.+?)(?:\s+(?:done|xong|hoàn thành|complete))?$/i);
        return {
            intent: 'update_task_status',
            confidence: 0.6,
            entities: { taskTitle: titleMatch?.[1]?.trim() ?? text, status: 'done' },
        };
    }

    if (/\b(what tasks|task.*today|task hôm nay|công việc hôm nay)\b/i.test(t)) {
        return { intent: 'query_tasks', confidence: 0.7, entities: { dateRange: { from: today, to: today } } };
    }

    if (/\b(what events|lịch hôm nay|lịch.*today|events.*today|calendar)\b/i.test(t)) {
        return { intent: 'query_calendar', confidence: 0.7, entities: { dateRange: { from: today, to: today } } };
    }

    if (/\b(spent|tiêu|chi |trả tiền|bought|mua)\b/i.test(t)) {
        return { intent: 'create_expense', confidence: 0.6, entities: {} };
    }

    if (/\b(show .*fund|query .*fund|funds?|giao dịch hobby|lịch sử fund)\b/i.test(t)) {
        return { intent: 'query_funds', confidence: 0.65, entities: {} };
    }

    if (/\b(log|add|create|new)\b.*\b(buy|sell|top[\s-]?up)\b.*\b(fund|keyboard|play station|ps5|keycap|kit)\b/i.test(t)) {
        return { intent: 'create_fund', confidence: 0.65, entities: {} };
    }

    if (/\b(show|list|find|query)\b.*\b(keyboard|keyboards|keycap|keycaps|kit|kits)\b/i.test(t)) {
        return { intent: 'query_keyboards', confidence: 0.65, entities: {} };
    }

    if (/\b(add|create|new)\b.*\b(keyboard|keycap|kit)\b/i.test(t)) {
        return { intent: 'create_keyboard', confidence: 0.65, entities: {} };
    }

    if (/\b(check.?in|logged|đăng ký|chạy bộ|tập gym|goal)\b/i.test(t)) {
        return { intent: 'goal_checkin', confidence: 0.6, entities: {} };
    }

    if (/\b(what chores|việc nhà.*today|chores.*today|việc nhà hôm nay)\b/i.test(t)) {
        return { intent: 'query_housework', confidence: 0.7, entities: { dateRange: { from: today, to: today } } };
    }

    if (/\b(việc nhà|chores|housework)\b/i.test(t)) {
        return { intent: 'query_housework', confidence: 0.6, entities: {} };
    }

    if (/\b(add|create|new|tạo|thêm)\b.+\b(ca keo|cakeo)\b/i.test(t) ||
        /\b(ca keo|cakeo)\b.+\b(add|create|new|tạo|thêm)\b/i.test(t)) {
        return { intent: 'create_cakeo', confidence: 0.65, entities: {} };
    }

    if (/\b(show|list|query|what|lịch)\b.+\b(ca keo|cakeo)\b/i.test(t) ||
        /\b(ca keo|cakeo)\b.+\b(today|hôm nay|this week|tuần này|tomorrow)\b/i.test(t) ||
        /\bca keo\b/i.test(t)) {
        return { intent: 'query_cakeos', confidence: 0.6, entities: {} };
    }

    if (/\b(mark|complete|done|cancel|đánh dấu)\b.+\b(ca keo|cakeo)\b/i.test(t) ||
        /\b(ca keo|cakeo)\b.+\b(done|xong|cancel|hoàn thành)\b/i.test(t)) {
        return { intent: 'update_cakeo_status', confidence: 0.6, entities: {} };
    }

    return { intent: 'fallback', confidence: 1.0, entities: {} };
}

// ─── LLM Parser ───────────────────────────────────────────────────────────────

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI | null {
    if (!config.OPENAI_API_KEY) return null;
    if (!openaiClient) {
        openaiClient = new OpenAI({ apiKey: config.OPENAI_API_KEY });
    }
    return openaiClient;
}

export async function parseIntent(text: string, timezone: string): Promise<ParsedIntent> {
    const today = todayISO(timezone);
    const client = getClient();

    if (!client) {
        // No LLM key — use regex fallback
        return regexFallback(text, today);
    }

    try {
        const response = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            max_tokens: 512,
            temperature: 0,
            messages: [
                { role: 'system', content: buildSystemPrompt(today, timezone) },
                { role: 'user', content: text },
            ],
        });

        const raw = (response.choices[0]?.message?.content ?? '')
            .replace(/^```(?:json)?\n?/, '')
            .replace(/\n?```$/, '')
            .trim();

        const parsed = JSON.parse(raw);

        // Validate that intent is in our supported list
        if (!ASSISTANT_INTENTS.includes(parsed.intent)) {
            parsed.intent = 'fallback';
            parsed.confidence = 0.5;
        }

        return {
            intent: parsed.intent as AssistantIntent,
            confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
            entities: parsed.entities ?? {},
        };
    } catch (err) {
        console.error('[intentParser] LLM call failed:', err);
        return regexFallback(text, today);
    }
}
