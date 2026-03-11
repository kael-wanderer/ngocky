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

goal_checkin:
  entities: { "goalTitle": "string (required)", "quantity": <number, optional default 1>, "note": "string (optional)" }
  examples: "logged 5km for running goal", "check in running 5km", "đăng ký chạy bộ 5km", "tập gym xong"

query_housework:
  entities: { "dateRange": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" } (optional) }
  examples: "what chores are due today", "việc nhà hôm nay", "show housework this week"

update_housework_status:
  entities: { "itemTitle": "string (required)" }
  examples: "mark dishes done", "đánh dấu hoàn thành rửa bát", "complete vacuuming", "done with sweeping"

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
- lịch / sự kiện / event = query_calendar
- task / việc cần làm = query_tasks or create_task (context-dependent)
- việc nhà / chores / dọn = housework
- goal / mục tiêu / chạy bộ / tập gym / đăng ký = goal_checkin

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

    if (/\b(check.?in|logged|đăng ký|chạy bộ|tập gym|goal)\b/i.test(t)) {
        return { intent: 'goal_checkin', confidence: 0.6, entities: {} };
    }

    if (/\b(what chores|việc nhà.*today|chores.*today|việc nhà hôm nay)\b/i.test(t)) {
        return { intent: 'query_housework', confidence: 0.7, entities: { dateRange: { from: today, to: today } } };
    }

    if (/\b(việc nhà|chores|housework)\b/i.test(t)) {
        return { intent: 'query_housework', confidence: 0.6, entities: {} };
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
