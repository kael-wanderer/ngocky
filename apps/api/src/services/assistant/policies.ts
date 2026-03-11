/**
 * Assistant policy constants shared across all resolvers and the pipeline.
 */
export const ASSISTANT_POLICIES = {
    /** Minimum LLM confidence to execute a write without confirmation */
    MIN_CONFIDENCE: 0.75,

    /** Minutes before a pending action (disambiguation/confirmation) expires */
    PENDING_ACTION_TTL_MINUTES: 15,

    /** Minutes before a link code expires */
    LINK_CODE_TTL_MINUTES: 15,

    /** Max options shown in a disambiguation list */
    MAX_DISAMBIGUATION_OPTIONS: 5,

    /** Max inbound messages per chatId per minute */
    RATE_LIMIT_PER_MINUTE: 20,

    /** Max items returned in any query result */
    MAX_QUERY_RESULTS: 10,
} as const;

/** Intents supported in V1 */
export const ASSISTANT_INTENTS = [
    'create_task',
    'update_task_status',
    'update_project_task_status',
    'query_calendar',
    'query_tasks',
    'create_expense',
    'goal_checkin',
    'query_housework',
    'update_housework_status',
    'link_telegram',
    'help',
    'fallback',
] as const;

export type AssistantIntent = (typeof ASSISTANT_INTENTS)[number];

export const HELP_TEXT = `NgocKy Assistant — available commands:

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

Send /link <code> to connect your NgocKy account\\.`;

export const FALLBACK_TEXT =
    "I didn't understand that\\. Send /help to see what I can do\\.";

export const UNLINKED_TEXT =
    'Your Telegram account is not linked to NgocKy\\. ' +
    'Open Settings in the NgocKy app to generate a link code, ' +
    'then send `/link <code>` here\\.';
