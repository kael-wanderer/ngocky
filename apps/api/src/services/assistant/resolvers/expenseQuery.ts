import { prisma } from '../../../config/database';
import { escapeMd, localDayToUTCRange, formatVND } from '../utils';
import { ASSISTANT_POLICIES } from '../policies';
import type { ResolverContext, ResolverResult } from './types';

/**
 * query_expenses — List expenses for a date range, optionally filtered by category.
 *
 * Entities:
 *   dateRange?: { from: YYYY-MM-DD, to: YYYY-MM-DD }
 *   category?: string
 */
export async function resolveExpenseQuery(
    entities: Record<string, any>,
    ctx: ResolverContext,
): Promise<ResolverResult> {
    const where: any = {
        OR: [{ userId: ctx.userId }, { isShared: true }],
    };

    const dateRange = entities.dateRange as { from: string; to: string } | undefined;
    if (dateRange?.from && dateRange?.to) {
        const { start } = localDayToUTCRange(dateRange.from, ctx.timezone);
        const { end } = localDayToUTCRange(dateRange.to, ctx.timezone);
        where.date = { gte: start, lte: end };
    }

    const category = (entities.category as string | undefined)?.trim();
    if (category) {
        where.category = { contains: category, mode: 'insensitive' };
    }

    const expenses = await prisma.expense.findMany({
        where,
        orderBy: { date: 'desc' },
        take: ASSISTANT_POLICIES.MAX_QUERY_RESULTS,
    });

    if (expenses.length === 0) {
        const rangeLabel = dateRange?.from
            ? ` for ${dateRange.from === dateRange.to ? dateRange.from : `${dateRange.from} → ${dateRange.to}`}`
            : '';
        return {
            reply: `No expenses found${escapeMd(rangeLabel)}\\.`,
            requiresConfirmation: false,
        };
    }

    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const lines = expenses.map(e => {
        const cat = e.category ? ` \\[${escapeMd(e.category)}\\]` : '';
        const dateStr = e.date.toISOString().slice(0, 10);
        return `💸 ${escapeMd(formatVND(e.amount))}${cat} — ${escapeMd(e.description)} \\(${escapeMd(dateStr)}\\)`;
    });

    const header = dateRange?.from
        ? `*Expenses ${escapeMd(dateRange.from === dateRange.to ? `on ${dateRange.from}` : `${dateRange.from} → ${dateRange.to}`)}:*`
        : '*Recent expenses:*';

    return {
        reply: `${header}\n${lines.join('\n')}\n\n*Total: ${escapeMd(formatVND(total))}*`,
        requiresConfirmation: false,
    };
}
