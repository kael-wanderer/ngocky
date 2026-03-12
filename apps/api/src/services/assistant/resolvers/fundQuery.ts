import { prisma } from '../../../config/database';
import { escapeMd, formatVND, localDayToUTCRange } from '../utils';
import { ASSISTANT_POLICIES } from '../policies';
import type { ResolverContext, ResolverResult } from './types';

function normalizeFundEnum(value: unknown) {
    return String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

export async function resolveFundQuery(
    entities: Record<string, any>,
    ctx: ResolverContext,
): Promise<ResolverResult> {
    const where: any = { userId: ctx.userId };

    const dateRange = entities.dateRange as { from: string; to: string } | undefined;
    if (dateRange?.from && dateRange?.to) {
        const { start } = localDayToUTCRange(dateRange.from, ctx.timezone);
        const { end } = localDayToUTCRange(dateRange.to, ctx.timezone);
        where.date = { gte: start, lte: end };
    }

    const type = normalizeFundEnum(entities.type);
    if (['BUY', 'SELL', 'TOP_UP'].includes(type)) where.type = type;

    const scope = normalizeFundEnum(entities.scope);
    if (['MECHANICAL_KEYBOARD', 'PLAY_STATION'].includes(scope)) where.scope = scope;

    const category = normalizeFundEnum(entities.category);
    if (['KEYCAP', 'KIT', 'SHIPPING', 'ACCESSORIES', 'OTHER'].includes(category)) where.category = category;

    const funds = await prisma.fundTransaction.findMany({
        where,
        orderBy: { date: 'desc' },
        take: ASSISTANT_POLICIES.MAX_QUERY_RESULTS,
    });

    if (funds.length === 0) {
        return { reply: 'No fund transactions found\\.', requiresConfirmation: false };
    }

    const lines = funds.map((fund: any) => {
        const date = fund.date.toISOString().slice(0, 10);
        return `💰 *${escapeMd(fund.type)}* — ${escapeMd(fund.description)} \\[${escapeMd(fund.scope)} / ${escapeMd(fund.category)}\\] \\(${escapeMd(formatVND(fund.amount))} · ${escapeMd(date)}\\)`;
    });

    return {
        reply: `*Recent funds:*\n${lines.join('\n')}`,
        requiresConfirmation: false,
    };
}
