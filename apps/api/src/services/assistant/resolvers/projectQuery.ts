import { prisma } from '../../../config/database';
import { escapeMd } from '../utils';
import { ASSISTANT_POLICIES } from '../policies';
import type { ResolverContext, ResolverResult } from './types';

/**
 * query_projects — List the user's active projects with task counts.
 *
 * Entities: (none required)
 */
export async function resolveProjectQuery(
    _entities: Record<string, any>,
    ctx: ResolverContext,
): Promise<ResolverResult> {
    const projects = await prisma.project.findMany({
        where: {
            OR: [{ ownerId: ctx.userId }, { isShared: true }],
        },
        include: {
            tasks: {
                select: { status: true },
            },
        },
        orderBy: [{ pinToDashboard: 'desc' }, { sortOrder: 'asc' }],
        take: ASSISTANT_POLICIES.MAX_QUERY_RESULTS,
    });

    if (projects.length === 0) {
        return { reply: 'No projects found\\.', requiresConfirmation: false };
    }

    const lines = projects.map(p => {
        const total = p.tasks.length;
        const done = p.tasks.filter(t => t.status === 'DONE').length;
        const inProgress = p.tasks.filter(t => t.status === 'IN_PROGRESS').length;
        const statusBadge = boardStatusBadge(p.boardStatus);
        const progress = total > 0 ? ` — ${done}/${total} done` : ' — no tasks';
        const wip = inProgress > 0 ? `, ${inProgress} in progress` : '';
        return `📋 *${escapeMd(p.name)}* ${statusBadge}${escapeMd(progress + wip)}`;
    });

    return {
        reply: `*Your projects:*\n${lines.join('\n')}`,
        requiresConfirmation: false,
    };
}

function boardStatusBadge(status: string): string {
    switch (status) {
        case 'PLAN': return '\\[Plan\\] ';
        case 'IN_PROGRESS': return '\\[Active\\] ';
        case 'DONE': return '\\[Done\\] ';
        case 'ON_HOLD': return '\\[On Hold\\] ';
        default: return '';
    }
}
