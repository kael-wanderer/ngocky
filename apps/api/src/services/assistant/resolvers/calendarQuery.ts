import { prisma } from '../../../config/database';
import type { CalendarEvent } from '@prisma/client';
import { escapeMd, localDayToUTCRange, formatLocalDateTime } from '../utils';
import { ASSISTANT_POLICIES } from '../policies';
import type { ResolverContext, ResolverResult } from './types';

/**
 * query_calendar — List calendar events in a date range.
 *
 * Entities:
 *   dateRange: { from: YYYY-MM-DD, to: YYYY-MM-DD } (required)
 *   keyword?: string (optional title search)
 */
export async function resolveCalendarQuery(
    entities: Record<string, any>,
    ctx: ResolverContext,
): Promise<ResolverResult> {
    const dateRange = entities.dateRange as { from: string; to: string } | undefined;

    if (!dateRange?.from || !dateRange?.to) {
        return {
            reply: "Please specify a date range\\. Try: _what events do I have tomorrow?_",
            requiresConfirmation: false,
        };
    }

    const { start: rangeStart } = localDayToUTCRange(dateRange.from, ctx.timezone);
    const { end: rangeEnd } = localDayToUTCRange(dateRange.to, ctx.timezone);

    const where: any = {
        OR: [
            { createdById: ctx.userId },
            { participants: { some: { userId: ctx.userId } } },
            { isShared: true },
        ],
        AND: [
            {
                OR: [
                    // Non-recurring: startDate within range
                    {
                        repeatFrequency: null,
                        startDate: { gte: rangeStart, lte: rangeEnd },
                    },
                    // Recurring: starts before range end and repeats into range
                    {
                        repeatFrequency: { not: null },
                        startDate: { lte: rangeEnd },
                        OR: [
                            { repeatEndType: 'NEVER' },
                            { repeatEndType: null },
                            { repeatUntil: null },
                            { repeatUntil: { gte: rangeStart } },
                        ],
                    },
                ],
            },
        ],
    };

    if (entities.keyword) {
        where.title = { contains: entities.keyword as string, mode: 'insensitive' };
    }

    const events = await prisma.calendarEvent.findMany({
        where,
        orderBy: { startDate: 'asc' },
        take: ASSISTANT_POLICIES.MAX_QUERY_RESULTS,
    });

    if (events.length === 0) {
        const label = dateRange.from === dateRange.to
            ? `on ${dateRange.from}`
            : `${dateRange.from} → ${dateRange.to}`;
        return {
            reply: `No events found ${escapeMd(label)}\\.`,
            requiresConfirmation: false,
        };
    }

    const lines = (events as CalendarEvent[]).map(e => {
        const start = formatLocalDateTime(e.startDate, ctx.timezone, !!(e as any).allDay === false);
        return `📅 *${escapeMd(e.title)}* — ${escapeMd(start)}`;
    });

    const rangeLabel = dateRange.from === dateRange.to
        ? `*Events on ${escapeMd(dateRange.from)}:*`
        : `*Events ${escapeMd(dateRange.from)} → ${escapeMd(dateRange.to)}:*`;

    return {
        reply: `${rangeLabel}\n${lines.join('\n')}`,
        requiresConfirmation: false,
    };
}
