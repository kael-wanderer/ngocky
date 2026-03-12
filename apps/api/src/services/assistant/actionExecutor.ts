import { prisma } from '../../config/database';
import { AssistantChannel, ExecutionStatus } from '@prisma/client';
import type { ParsedIntent } from './intentParser';
import type { ResolverContext, ResolverResult } from './resolvers/types';
import { FALLBACK_TEXT, HELP_TEXT } from './policies';
import { resolveTaskCreate } from './resolvers/taskCreate';
import { resolveTaskStatus } from './resolvers/taskStatus';
import { resolveTaskQuery } from './resolvers/taskQuery';
import { resolveProjectTaskStatus } from './resolvers/projectTaskStatus';
import { resolveProjectQuery } from './resolvers/projectQuery';
import { resolveProjectTaskQuery } from './resolvers/projectTaskQuery';
import { resolveCalendarQuery } from './resolvers/calendarQuery';
import { resolveExpenseCreate } from './resolvers/expenseCreate';
import { resolveExpenseQuery } from './resolvers/expenseQuery';
import { resolveFundCreate } from './resolvers/fundCreate';
import { resolveFundQuery } from './resolvers/fundQuery';
import { resolveKeyboardCreate } from './resolvers/keyboardCreate';
import { resolveKeyboardQuery } from './resolvers/keyboardQuery';
import { resolveGoalCheckin } from './resolvers/goalCheckin';
import { resolveGoalQuery } from './resolvers/goalQuery';
import { resolveHouseworkQuery } from './resolvers/houseworkQuery';
import { resolveHouseworkStatus } from './resolvers/houseworkStatus';
import { resolveCaKeoCreate } from './resolvers/caKeoCreate';
import { resolveCaKeoQuery } from './resolvers/caKeoQuery';
import { resolveCaKeoStatus } from './resolvers/caKeoStatus';

// ─── Main executor ────────────────────────────────────────────────────────────

export async function executeIntent(
    parsed: ParsedIntent,
    ctx: ResolverContext,
): Promise<ResolverResult> {
    let result: ResolverResult;

    try {
        result = await dispatch(parsed, ctx);
    } catch (err: any) {
        console.error('[actionExecutor] Resolver error:', err);
        result = {
            reply: `Something went wrong\\. Please try again\\.`,
            requiresConfirmation: false,
        };
    }

    // Persist action log (fire-and-forget — don't let logging errors break the reply)
    logAssistantAction(parsed, ctx, result).catch(e =>
        console.error('[actionExecutor] Failed to log action:', e),
    );

    return result;
}

export async function dispatchIntent(
    parsed: ParsedIntent,
    ctx: ResolverContext,
): Promise<ResolverResult> {
    const { intent, entities } = parsed;

    switch (intent) {
        case 'create_task':
            return resolveTaskCreate(entities, ctx);

        case 'update_task_status':
            return resolveTaskStatus(entities, ctx);

        case 'query_tasks':
            return resolveTaskQuery(entities, ctx);

        case 'update_project_task_status':
            return resolveProjectTaskStatus(entities, ctx);

        case 'query_projects':
            return resolveProjectQuery(entities, ctx);

        case 'query_project_tasks':
            return resolveProjectTaskQuery(entities, ctx);

        case 'query_calendar':
            return resolveCalendarQuery(entities, ctx);

        case 'create_expense':
            return resolveExpenseCreate(entities, ctx);

        case 'query_expenses':
            return resolveExpenseQuery(entities, ctx);

        case 'create_fund':
            return resolveFundCreate(entities, ctx);

        case 'query_funds':
            return resolveFundQuery(entities, ctx);

        case 'create_keyboard':
            return resolveKeyboardCreate(entities, ctx);

        case 'query_keyboards':
            return resolveKeyboardQuery(entities, ctx);

        case 'goal_checkin':
            return resolveGoalCheckin(entities, ctx);

        case 'query_goals':
            return resolveGoalQuery(entities, ctx);

        case 'query_housework':
            return resolveHouseworkQuery(entities, ctx);

        case 'update_housework_status':
            return resolveHouseworkStatus(entities, ctx);

        case 'create_cakeo':
            return resolveCaKeoCreate(entities, ctx);

        case 'query_cakeos':
            return resolveCaKeoQuery(entities, ctx);

        case 'update_cakeo_status':
            return resolveCaKeoStatus(entities, ctx);

        case 'help':
            return { reply: HELP_TEXT, requiresConfirmation: false };

        case 'fallback':
        default:
            return { reply: FALLBACK_TEXT, requiresConfirmation: false };
    }
}

async function dispatch(parsed: ParsedIntent, ctx: ResolverContext): Promise<ResolverResult> {
    return dispatchIntent(parsed, ctx);
}

export async function logAssistantAction(
    parsed: ParsedIntent,
    ctx: ResolverContext,
    result: ResolverResult,
): Promise<void> {
    const status: ExecutionStatus = result.requiresConfirmation
        ? ExecutionStatus.PENDING_CONFIRMATION
        : ExecutionStatus.SUCCESS;

    await prisma.assistantActionLog.create({
        data: {
            userId: ctx.userId,
            channel: AssistantChannel.TELEGRAM,
            intent: parsed.intent,
            confidence: parsed.confidence,
            requestPayload: parsed.entities,
            executionStatus: status,
            resultSummary: result.reply.slice(0, 500),
        },
    });
}
