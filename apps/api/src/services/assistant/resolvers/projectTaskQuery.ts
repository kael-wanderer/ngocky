import { prisma } from '../../../config/database';
import { escapeMd } from '../utils';
import { ASSISTANT_POLICIES } from '../policies';
import type { ResolverContext, ResolverResult } from './types';

/**
 * query_project_tasks — List tasks in a specific project (or all project tasks).
 *
 * Entities:
 *   projectName?: string
 *   status?: 'PLANNED' | 'IN_PROGRESS' | 'DONE'
 */
export async function resolveProjectTaskQuery(
    entities: Record<string, any>,
    ctx: ResolverContext,
): Promise<ResolverResult> {
    const projectName = (entities.projectName as string | undefined)?.trim();
    const statusFilter = (entities.status as string | undefined)?.toUpperCase();

    const taskWhere: any = {
        OR: [{ createdById: ctx.userId }, { isShared: true }],
    };
    if (statusFilter && ['PLANNED', 'IN_PROGRESS', 'DONE'].includes(statusFilter)) {
        taskWhere.status = statusFilter;
    }

    if (projectName) {
        // Find matching projects first
        const projects = await prisma.project.findMany({
            where: {
                OR: [{ ownerId: ctx.userId }, { isShared: true }],
                name: { contains: projectName, mode: 'insensitive' },
            },
            select: { id: true, name: true },
            take: 1,
        });

        if (projects.length === 0) {
            return {
                reply: `No project found matching _${escapeMd(projectName)}_\\.`,
                requiresConfirmation: false,
            };
        }

        taskWhere.projectId = projects[0].id;
    }

    const tasks = await prisma.projectTask.findMany({
        where: taskWhere,
        include: { project: { select: { name: true } } },
        orderBy: [{ status: 'asc' }, { kanbanOrder: 'asc' }],
        take: ASSISTANT_POLICIES.MAX_QUERY_RESULTS,
    });

    if (tasks.length === 0) {
        const scope = projectName ? ` in _${escapeMd(projectName)}_` : '';
        return {
            reply: `No project tasks found${scope}\\.`,
            requiresConfirmation: false,
        };
    }

    const lines = tasks.map(t => {
        const statusIcon = t.status === 'DONE' ? '✅' : t.status === 'IN_PROGRESS' ? '🔄' : '⬜';
        const project = projectName ? '' : ` \\[${escapeMd(t.project.name)}\\]`;
        const deadline = t.deadline
            ? ` \\(due ${escapeMd(t.deadline.toISOString().slice(0, 10))}\\)`
            : '';
        return `${statusIcon} ${escapeMd(t.title)}${project}${deadline}`;
    });

    const header = projectName
        ? `*Tasks in ${escapeMd(projectName)}:*`
        : '*Project tasks:*';

    return {
        reply: `${header}\n${lines.join('\n')}`,
        requiresConfirmation: false,
    };
}
