import { prisma } from '../../../config/database';
import { escapeMd } from '../utils';
import { ASSISTANT_POLICIES } from '../policies';
import type { ResolverContext, ResolverResult } from './types';

/**
 * query_goals — List active goals with progress for the user.
 *
 * Entities: (none required)
 */
export async function resolveGoalQuery(
    _entities: Record<string, any>,
    ctx: ResolverContext,
): Promise<ResolverResult> {
    const goals = await prisma.goal.findMany({
        where: {
            OR: [{ userId: ctx.userId }, { isShared: true }],
            active: true,
        },
        orderBy: [{ pinToDashboard: 'desc' }, { sortOrder: 'asc' }],
        take: ASSISTANT_POLICIES.MAX_QUERY_RESULTS,
    });

    if (goals.length === 0) {
        return { reply: 'No active goals found\\.', requiresConfirmation: false };
    }

    const lines = goals.map(g => {
        const pct = g.targetCount > 0 ? Math.min(100, Math.round((g.currentCount / g.targetCount) * 100)) : 0;
        const bar = buildBar(pct);
        const unit = g.unit ?? 'times';
        return `🎯 *${escapeMd(g.title)}* — ${g.currentCount}/${g.targetCount} ${escapeMd(unit)} \\(${pct}%\\)\n   ${bar}`;
    });

    return {
        reply: `*Your goals:*\n${lines.join('\n')}`,
        requiresConfirmation: false,
    };
}

function buildBar(pct: number): string {
    const filled = Math.round(pct / 10);
    return '▓'.repeat(filled) + '░'.repeat(10 - filled);
}
