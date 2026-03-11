import { prisma } from '../../../config/database';
import type { Task } from '@prisma/client';
import { escapeMd, localDayToUTCRange, formatLocalDateTime } from '../utils';
import { ASSISTANT_POLICIES } from '../policies';
import type { ResolverContext, ResolverResult } from './types';

/**
 * query_tasks — List standalone tasks for a date range.
 *
 * Entities:
 *   dateRange?: { from: YYYY-MM-DD, to: YYYY-MM-DD }
 *   status?: 'PLANNED' | 'IN_PROGRESS' | 'DONE'
 */
export async function resolveTaskQuery(
    entities: Record<string, any>,
    ctx: ResolverContext,
): Promise<ResolverResult> {
    const where: any = {
        OR: [
            { userId: ctx.userId },
            { isShared: true },
        ],
        status: { not: 'ARCHIVED' },
    };

    const statusFilter = entities.status as string | undefined;
    if (statusFilter && ['PLANNED', 'IN_PROGRESS', 'DONE'].includes(statusFilter)) {
        where.status = statusFilter;
    }

    const dateRange = entities.dateRange as { from: string; to: string } | undefined;
    if (dateRange?.from && dateRange?.to) {
        const { start } = localDayToUTCRange(dateRange.from, ctx.timezone);
        const { end } = localDayToUTCRange(dateRange.to, ctx.timezone);
        where.dueDate = { gte: start, lte: end };
    }

    const tasks = await prisma.task.findMany({
        where,
        orderBy: [{ dueDate: 'asc' }, { sortOrder: 'asc' }],
        take: ASSISTANT_POLICIES.MAX_QUERY_RESULTS,
    });

    if (tasks.length === 0) {
        const rangeLabel = dateRange?.from
            ? `for ${dateRange.from === dateRange.to ? dateRange.from : `${dateRange.from} → ${dateRange.to}`}`
            : '';
        return {
            reply: `No tasks found ${escapeMd(rangeLabel)}\\.`,
            requiresConfirmation: false,
        };
    }

    const lines = (tasks as Task[]).map(t => {
        const due = t.dueDate
            ? ` \\(due ${escapeMd(formatLocalDateTime(t.dueDate, ctx.timezone, false))}\\)`
            : '';
        const status = t.status === 'DONE' ? '✅' : t.status === 'IN_PROGRESS' ? '🔄' : '⬜';
        return `${status} ${escapeMd(t.title)}${due}`;
    });

    const header = dateRange?.from
        ? `*Tasks ${escapeMd(dateRange.from === dateRange.to ? `on ${dateRange.from}` : `${dateRange.from} → ${dateRange.to}`)}:*`
        : '*Tasks:*';

    return {
        reply: `${header}\n${lines.join('\n')}`,
        requiresConfirmation: false,
    };
}
