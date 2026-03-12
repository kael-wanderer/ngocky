import { prisma } from '../../../config/database';
import { escapeMd, localDayToUTCRange, formatLocalDateTime } from '../utils';
import { ASSISTANT_POLICIES } from '../policies';
import type { ResolverContext, ResolverResult } from './types';

const STATUS_EMOJI: Record<string, string> = {
    TODO: '📋',
    IN_PROGRESS: '🔄',
    DONE: '✅',
    CANCELLED: '❌',
};

/**
 * query_cakeos — List Ca Keo items with optional filters.
 *
 * Entities:
 *   dateRange?: { from: YYYY-MM-DD, to: YYYY-MM-DD }
 *   status?: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
 *   category?: string
 */
export async function resolveCaKeoQuery(
    entities: Record<string, any>,
    ctx: ResolverContext,
): Promise<ResolverResult> {
    const where: any = {
        OR: [
            { ownerId: ctx.userId },
            { isShared: true },
            { assignerId: ctx.userId },
        ],
    };

    const dateRange = entities.dateRange as { from: string; to: string } | undefined;
    if (dateRange?.from && dateRange?.to) {
        const { start } = localDayToUTCRange(dateRange.from, ctx.timezone);
        const { end } = localDayToUTCRange(dateRange.to, ctx.timezone);
        where.startDate = { gte: start, lte: end };
    }

    const status = entities.status as string | undefined;
    if (status) where.status = status;

    const category = entities.category as string | undefined;
    if (category) where.category = { contains: category, mode: 'insensitive' };

    const items = await prisma.caKeo.findMany({
        where,
        include: {
            assigner: { select: { name: true } },
        },
        orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
        take: ASSISTANT_POLICIES.MAX_QUERY_RESULTS,
    });

    if (items.length === 0) {
        return {
            reply: `No Ca Keo items found\\.`,
            requiresConfirmation: false,
        };
    }

    const lines = items.map(item => {
        const emoji = STATUS_EMOJI[item.status] ?? '📋';
        const date = item.startDate
            ? ` \\(${escapeMd(formatLocalDateTime(item.startDate, ctx.timezone, false))}\\)`
            : '';
        const assigner = item.assigner ? ` → ${escapeMd(item.assigner.name)}` : '';
        const cat = item.category ? ` \\[${escapeMd(item.category)}\\]` : '';
        return `${emoji} ${escapeMd(item.title)}${cat}${date}${assigner}`;
    });

    let header = '*Ca Keo items:*';
    if (dateRange?.from) {
        const label = dateRange.from === dateRange.to ? `on ${dateRange.from}` : `${dateRange.from} – ${dateRange.to}`;
        header = `*Ca Keo ${escapeMd(label)}:*`;
    }
    if (status) header = `*Ca Keo \\(${escapeMd(status.replace('_', ' '))}\\):*`;

    return {
        reply: `${header}\n${lines.join('\n')}`,
        requiresConfirmation: false,
    };
}
