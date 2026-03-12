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
    'query_projects',
    'query_project_tasks',
    'query_calendar',
    'query_tasks',
    'create_expense',
    'query_expenses',
    'create_fund',
    'query_funds',
    'create_keyboard',
    'query_keyboards',
    'goal_checkin',
    'query_goals',
    'query_housework',
    'update_housework_status',
    'create_cakeo',
    'query_cakeos',
    'update_cakeo_status',
    'link_telegram',
    'help',
    'fallback',
] as const;

export type AssistantIntent = (typeof ASSISTANT_INTENTS)[number];

export const WRITE_INTENTS: ReadonlySet<AssistantIntent> = new Set([
    'create_task',
    'update_task_status',
    'update_project_task_status',
    'create_expense',
    'create_fund',
    'create_keyboard',
    'goal_checkin',
    'update_housework_status',
    'create_cakeo',
    'update_cakeo_status',
]);

export const HELP_TEXT = `NgocKy Assistant - available commands:

Tasks
- add task [title] [due date]
- mark [task name] done
- what tasks do I have today

Projects
- show my projects
- tasks in website project
- mark website design as in progress

Calendar
- what events do I have tomorrow
- show events this week

Expenses
- spent [amount] on [category]
- show expenses this month
- tell me all expenses of March

Funds
- log a buy fund for 2m keycap mechanical keyboard
- show my funds this month
- show keyboard sell funds

Keyboard
- add keyboard kohaku r1 kit 30m
- show my keyboards
- show red keycaps

Goals
- show my goals
- what is my goal progress
- logged [value] km for running goal

Housework
- what chores are due today
- mark dishes done

Ca Keo
- add ca keo school trip tomorrow
- show ca keo this week
- mark school trip done

Send /link [code] to connect your NgocKy account.`;

export const FALLBACK_TEXT =
    "I didn't understand that. Send /help to see what I can do.";

export const WELCOME_TEXT =
    'Welcome to NgocKy Assistant.\n\n' +
    'I can help you manage tasks, calendar events, expenses, funds, keyboard collection items, and more from Telegram.\n\n' +
    'To get started:\n' +
    '1. Open NgocKy Settings in the web app\n' +
    '2. Go to the Assistant tab\n' +
    '3. Click Generate Link Code\n' +
    '4. Send /link [code] here to connect your account\n\n' +
    'Send /help after linking to see all commands.';

export const UNLINKED_TEXT =
    'Your Telegram account is not linked to NgocKy. ' +
    'Open Settings in the NgocKy app to generate a link code, ' +
    'then send /link [code] here.';
