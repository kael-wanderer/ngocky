import { prisma } from '../../../config/database';
import type { HouseworkItem } from '@prisma/client';
import { escapeMd, localDayToUTCRange, formatLocalDateTime } from '../utils';
import { ASSISTANT_POLICIES } from '../policies';
import type { ResolverContext, ResolverResult } from './types';

type HouseworkWithAssignee = HouseworkItem & { assignee: { name: string } | null };

/**
 * query_housework — List housework items due in a date range.
 *
 * Entities:
 *   dateRange?: { from: YYYY-MM-DD, to: YYYY-MM-DD }
 */
export async function resolveHouseworkQuery(
    entities: Record<string, any>,
    ctx: ResolverContext,
): Promise<ResolverResult> {
    const where: any = {
        OR: [
            { createdById: ctx.userId },
            { isShared: true },
        ],
        active: true,
    };

    const dateRange = entities.dateRange as { from: string; to: string } | undefined;
    if (dateRange?.from && dateRange?.to) {
        const { start } = localDayToUTCRange(dateRange.from, ctx.timezone);
        const { end } = localDayToUTCRange(dateRange.to, ctx.timezone);
        where.nextDueDate = { lte: end };
        // Show items due up to end of the date range (overdue + due within range)
        where.OR = [
            { createdById: ctx.userId, nextDueDate: { lte: end } },
            { isShared: true, nextDueDate: { lte: end } },
        ];
    }

    const items = await prisma.houseworkItem.findMany({
        where,
        include: { assignee: { select: { name: true } } },
        orderBy: { nextDueDate: 'asc' },
        take: ASSISTANT_POLICIES.MAX_QUERY_RESULTS,
    });

    if (items.length === 0) {
        return {
            reply: `No housework items found\\.`,
            requiresConfirmation: false,
        };
    }

    const lines = (items as HouseworkWithAssignee[]).map(item => {
        const due = item.nextDueDate
            ? ` \\(${escapeMd(formatLocalDateTime(item.nextDueDate, ctx.timezone, false))}\\)`
            : '';
        const assignee = item.assignee ? ` — ${escapeMd(item.assignee.name)}` : '';
        return `🏠 ${escapeMd(item.title)}${due}${assignee}`;
    });

    const header = dateRange?.from
        ? `*Housework ${escapeMd(dateRange.from === dateRange.to ? `on ${dateRange.from}` : `due by ${dateRange.to}`)}:*`
        : '*Housework items:*';

    return {
        reply: `${header}\n${lines.join('\n')}`,
        requiresConfirmation: false,
    };
}
