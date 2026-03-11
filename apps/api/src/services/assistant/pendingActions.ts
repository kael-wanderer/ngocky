import { AssistantChannel, ExecutionStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { executeIntent } from './actionExecutor';
import type { ParsedIntent } from './intentParser';
import { ASSISTANT_POLICIES } from './policies';
import type { ResolverContext, ResolverResult } from './resolvers/types';
import { escapeMd } from './utils';

type PendingOption = {
    label: string;
    entities: Record<string, any>;
};

type SelectOptionPayload = {
    kind: 'select_option';
    prompt: string;
    parsedIntent: ParsedIntent;
    options: PendingOption[];
};

type ConfirmWritePayload = {
    kind: 'confirm_write';
    prompt: string;
    parsedIntent: ParsedIntent;
};

type CollectFieldPayload = {
    kind: 'collect_field';
    prompt: string;
    parsedIntent: ParsedIntent;
    field: 'amount' | 'category' | 'title' | 'taskTitle' | 'goalTitle' | 'itemTitle';
};

export type PendingActionPayload =
    | SelectOptionPayload
    | ConfirmWritePayload
    | CollectFieldPayload;

type PendingRecord = {
    id: string;
    userId: string;
    intent: string;
    payload: PendingActionPayload;
    expiresAt: Date;
};

type PendingResolution =
    | { reply: string; requiresConfirmation: false; keepPending: true }
    | ({ keepPending: false; parsed?: ParsedIntent } & ResolverResult);

export async function createPendingAction(
    userId: string,
    intent: string,
    payload: PendingActionPayload,
): Promise<void> {
    const expiresAt = new Date(
        Date.now() + ASSISTANT_POLICIES.PENDING_ACTION_TTL_MINUTES * 60 * 1000,
    );

    await prisma.assistantPendingAction.deleteMany({
        where: { userId, channel: AssistantChannel.TELEGRAM },
    });

    await prisma.assistantPendingAction.create({
        data: {
            userId,
            channel: AssistantChannel.TELEGRAM,
            intent,
            payload: payload as any,
            expiresAt,
        },
    });
}

export async function getActivePendingAction(userId: string): Promise<PendingRecord | null> {
    const pending = await prisma.assistantPendingAction.findFirst({
        where: { userId, channel: AssistantChannel.TELEGRAM },
        orderBy: { createdAt: 'desc' },
    });

    if (!pending) return null;

    if (pending.expiresAt < new Date()) {
        await prisma.assistantPendingAction.delete({ where: { id: pending.id } });
        return null;
    }

    return {
        id: pending.id,
        userId: pending.userId,
        intent: pending.intent,
        payload: pending.payload as unknown as PendingActionPayload,
        expiresAt: pending.expiresAt,
    };
}

export async function resolvePendingActionReply(
    pending: PendingRecord,
    input: string,
    ctx: ResolverContext,
): Promise<PendingResolution> {
    const normalized = input.trim();

    if (isCancelReply(normalized)) {
        await prisma.assistantPendingAction.delete({ where: { id: pending.id } });
        await prisma.assistantActionLog.create({
            data: {
                userId: ctx.userId,
                channel: AssistantChannel.TELEGRAM,
                intent: pending.intent,
                requestPayload: pending.payload as any,
                executionStatus: ExecutionStatus.CANCELLED,
                resultSummary: 'User cancelled pending assistant action.',
            },
        });
        return {
            reply: 'Cancelled\\. Send a new message when you want to try again\\.',
            requiresConfirmation: false,
            keepPending: false,
        };
    }

    switch (pending.payload.kind) {
        case 'select_option':
            return resolveSelectOption(pending, normalized, ctx);
        case 'confirm_write':
            return resolveConfirmWrite(pending, normalized, ctx);
        case 'collect_field':
            return resolveCollectField(pending, normalized, ctx);
        default:
            return {
                reply: 'That pending action is not supported\\. Please send the request again\\.',
                requiresConfirmation: false,
                keepPending: false,
            };
    }
}

export function buildLowConfidencePending(parsed: ParsedIntent): PendingActionPayload {
    const summary = summarizeWriteIntent(parsed);
    return {
        kind: 'confirm_write',
        parsedIntent: parsed,
        prompt:
            `I think you want me to ${summary}\\.\n` +
            '1\\. Confirm\n' +
            '2\\. Cancel',
    };
}

function isCancelReply(input: string): boolean {
    const normalized = input.trim().toLowerCase();
    return normalized === 'cancel' || normalized === '2' || normalized === 'no';
}

function isConfirmReply(input: string): boolean {
    const normalized = input.trim().toLowerCase();
    return normalized === '1' || normalized === 'yes' || normalized === 'y' || normalized === 'confirm' || normalized === 'ok';
}

async function resolveSelectOption(
    pending: PendingRecord,
    input: string,
    ctx: ResolverContext,
): Promise<PendingResolution> {
    const payload = pending.payload as SelectOptionPayload;
    const choice = Number.parseInt(input, 10);
    const options = payload.options;

    if (!Number.isInteger(choice) || choice < 1 || choice > options.length) {
        return {
            reply: `Reply with a number from 1 to ${options.length}, or send cancel\\.`,
            requiresConfirmation: false,
            keepPending: true,
        };
    }

    const selected = options[choice - 1];
    const parsed: ParsedIntent = {
        ...payload.parsedIntent,
        entities: {
            ...payload.parsedIntent.entities,
            ...selected.entities,
        },
    };

    await prisma.assistantPendingAction.delete({ where: { id: pending.id } });
    const result = await executeIntent(parsed, ctx);
    return { ...result, keepPending: false, parsed };
}

async function resolveConfirmWrite(
    pending: PendingRecord,
    input: string,
    ctx: ResolverContext,
): Promise<PendingResolution> {
    const payload = pending.payload as ConfirmWritePayload;
    if (!isConfirmReply(input)) {
        return {
            reply: 'Reply with `1` to confirm or `cancel` to stop\\.',
            requiresConfirmation: false,
            keepPending: true,
        };
    }

    await prisma.assistantPendingAction.delete({ where: { id: pending.id } });
    const parsed = payload.parsedIntent;
    const result = await executeIntent(
        { ...parsed, confidence: Math.max(parsed.confidence, 1) },
        ctx,
    );
    return { ...result, keepPending: false, parsed };
}

async function resolveCollectField(
    pending: PendingRecord,
    input: string,
    ctx: ResolverContext,
): Promise<PendingResolution> {
    const payload = pending.payload as CollectFieldPayload;
    const parsed = payload.parsedIntent;
    const entities = { ...parsed.entities };

    if (payload.field === 'amount') {
        const amount = parseAmountInput(input);
        if (!amount) {
            return {
                reply: 'I still need a valid amount\\. Example: `50000` or `200k`\\.',
                requiresConfirmation: false,
                keepPending: true,
            };
        }
        entities.amount = amount;
    } else {
        if (!input.trim()) {
            return {
                reply: 'Please send the missing value, or send cancel\\.',
                requiresConfirmation: false,
                keepPending: true,
            };
        }
        entities[payload.field] = input.trim();
    }

    await prisma.assistantPendingAction.delete({ where: { id: pending.id } });
    const nextParsed: ParsedIntent = { ...parsed, entities, confidence: Math.max(parsed.confidence, 1) };
    const result = await executeIntent(nextParsed, ctx);
    return { ...result, keepPending: false, parsed: nextParsed };
}

function summarizeWriteIntent(parsed: ParsedIntent): string {
    switch (parsed.intent) {
        case 'create_task':
            return `create the task *${escapeMd(parsed.entities.title ?? 'untitled')}*`;
        case 'update_task_status':
            return `update the task *${escapeMd(parsed.entities.taskTitle ?? parsed.entities.taskId ?? 'task')}*`;
        case 'update_project_task_status':
            return `update the project task *${escapeMd(parsed.entities.taskTitle ?? parsed.entities.taskId ?? 'task')}*`;
        case 'create_expense':
            return `log an expense${parsed.entities.amount ? ` for *${escapeMd(String(parsed.entities.amount))}*` : ''}`;
        case 'goal_checkin':
            return `log a check\\-in for *${escapeMd(parsed.entities.goalTitle ?? parsed.entities.goalId ?? 'goal')}*`;
        case 'update_housework_status':
            return `mark *${escapeMd(parsed.entities.itemTitle ?? parsed.entities.itemId ?? 'housework item')}* done`;
        default:
            return 'perform this action';
    }
}

function parseAmountInput(input: string): number | null {
    const normalized = input.trim().toLowerCase().replace(/\s+/g, '');
    if (!normalized) return null;

    const direct = normalized.match(/^(\d+(?:[.,]\d+)?)(k|tr|triệu|trieu)?$/i);
    if (!direct) return null;

    const rawValue = Number.parseFloat(direct[1].replace(',', '.'));
    if (Number.isNaN(rawValue) || rawValue <= 0) return null;

    const suffix = direct[2]?.toLowerCase();
    if (!suffix) return Math.round(rawValue);
    if (suffix === 'k') return Math.round(rawValue * 1_000);
    return Math.round(rawValue * 1_000_000);
}
