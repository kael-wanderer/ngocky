import { prisma } from '../../../config/database';
import { escapeMd } from '../utils';
import { ASSISTANT_POLICIES } from '../policies';
import type { ResolverContext, ResolverResult } from './types';

type ProjectTaskWithProject = { id: string; title: string; project: { name: string } };

/**
 * update_project_task_status — Update the status of a Kanban board task.
 *
 * Entities:
 *   taskTitle: string (required)
 *   projectName?: string (optional filter)
 *   status: 'PLANNED' | 'IN_PROGRESS' | 'DONE' (required)
 */
export async function resolveProjectTaskStatus(
    entities: Record<string, any>,
    ctx: ResolverContext,
): Promise<ResolverResult> {
    const taskId = (entities.taskId as string | undefined)?.trim();
    const taskTitle = (entities.taskTitle as string | undefined)?.trim();
    const projectName = (entities.projectName as string | undefined)?.trim();
    const status = (entities.status as string | undefined)?.toUpperCase();

    if (!taskTitle) {
        return { reply: "Which task should I update? Try: _mark website design as in progress_", requiresConfirmation: false };
    }
    if (!status || !['PLANNED', 'IN_PROGRESS', 'DONE'].includes(status)) {
        return { reply: "Supported status values are: PLANNED, IN_PROGRESS, DONE\\.", requiresConfirmation: false };
    }

    if (taskId) {
        const task = await prisma.projectTask.findFirst({
            where: {
                id: taskId,
                project: { OR: [{ ownerId: ctx.userId }, { isShared: true }] },
            },
            include: { project: { select: { name: true } } },
        });

        if (!task) {
            return {
                reply: 'That project task is no longer available\\. Please send the request again\\.',
                requiresConfirmation: false,
            };
        }

        await prisma.projectTask.update({
            where: { id: task.id },
            data: { status: status as any },
        });
        const emoji = status === 'DONE' ? '✅' : status === 'IN_PROGRESS' ? '🔄' : '📋';
        return {
            reply: `${emoji} Updated *${escapeMd(task.title)}* in *${escapeMd(task.project.name)}* → ${escapeMd(status)}\\.`,
            requiresConfirmation: false,
        };
    }

    // Build project filter — accessible boards
    const projectWhere: any = {
        OR: [{ ownerId: ctx.userId }, { isShared: true }],
    };
    if (projectName) {
        projectWhere.name = { contains: projectName, mode: 'insensitive' };
    }

    const matches = await prisma.projectTask.findMany({
        where: {
            title: { contains: taskTitle, mode: 'insensitive' },
            project: projectWhere,
        },
        include: { project: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: ASSISTANT_POLICIES.MAX_DISAMBIGUATION_OPTIONS + 1,
    });

    if (matches.length === 0) {
        return {
            reply: `No project task found matching _${escapeMd(taskTitle)}_\\.`,
            requiresConfirmation: false,
        };
    }

    if (matches.length === 1) {
        const task = matches[0];
        await prisma.projectTask.update({
            where: { id: task.id },
            data: { status: status as any },
        });
        const emoji = status === 'DONE' ? '✅' : status === 'IN_PROGRESS' ? '🔄' : '📋';
        return {
            reply: `${emoji} Updated *${escapeMd(task.title)}* in *${escapeMd(task.project.name)}* → ${escapeMd(status)}\\.`,
            requiresConfirmation: false,
        };
    }

    // Multiple matches
    const typedMatches = matches as ProjectTaskWithProject[];
    const list = typedMatches
        .slice(0, ASSISTANT_POLICIES.MAX_DISAMBIGUATION_OPTIONS)
        .map((t, i) => `${i + 1}\\. ${escapeMd(t.title)} \\(${escapeMd(t.project.name)}\\)`)
        .join('\n');

    return {
        reply: `Found multiple tasks matching _${escapeMd(taskTitle)}_\\. Reply with a number or send cancel\\.\n${list}`,
        requiresConfirmation: true,
        pendingIntent: 'update_project_task_status',
        pendingPayload: {
            kind: 'select_option',
            prompt: `Found multiple tasks matching _${escapeMd(taskTitle)}_\\. Reply with a number or send cancel\\.\n${list}`,
            parsedIntent: {
                intent: 'update_project_task_status',
                confidence: 1,
                entities: { taskTitle, projectName, status },
            },
            options: typedMatches
                .slice(0, ASSISTANT_POLICIES.MAX_DISAMBIGUATION_OPTIONS)
                .map(task => ({
                    label: `${task.title} (${task.project.name})`,
                    entities: { taskId: task.id, taskTitle: task.title, projectName: task.project.name, status },
                })),
        },
    };
}
