import { prisma } from '../../../config/database';
import type { Task } from '@prisma/client';
import { escapeMd } from '../utils';
import { ASSISTANT_POLICIES } from '../policies';
import type { ResolverContext, ResolverResult } from './types';

/**
 * update_task_status — Mark a standalone task done or reopen it.
 *
 * Entities:
 *   taskTitle: string (required)
 *   status: 'done' | 'reopen' (required)
 */
export async function resolveTaskStatus(
    entities: Record<string, any>,
    ctx: ResolverContext,
): Promise<ResolverResult> {
    const taskId = (entities.taskId as string | undefined)?.trim();
    const taskTitle = (entities.taskTitle as string | undefined)?.trim();
    const statusRaw = (entities.status as string | undefined)?.toLowerCase();

    if (!taskTitle) {
        return { reply: "Which task should I update? Try: _mark pay electricity done_", requiresConfirmation: false };
    }
    if (!statusRaw || !['done', 'reopen'].includes(statusRaw)) {
        return { reply: "Supported status values are _done_ or _reopen_\\.", requiresConfirmation: false };
    }

    const newStatus = statusRaw === 'done' ? 'DONE' : 'PLANNED';

    if (taskId) {
        const task = await prisma.task.findFirst({
            where: { id: taskId, userId: ctx.userId, status: { not: 'ARCHIVED' } },
            select: { id: true, title: true },
        });

        if (!task) {
            return {
                reply: 'That task is no longer available\\. Please send the request again\\.',
                requiresConfirmation: false,
            };
        }

        await prisma.task.update({
            where: { id: task.id },
            data: {
                status: newStatus,
                completedAt: newStatus === 'DONE' ? new Date() : null,
            },
        });
        const verb = newStatus === 'DONE' ? '✅ Marked done' : '🔄 Reopened';
        return {
            reply: `${verb}: *${escapeMd(task.title)}*\\.`,
            requiresConfirmation: false,
        };
    }

    // Fuzzy search: tasks belonging to this user that contain the title
    const matches = await prisma.task.findMany({
        where: {
            userId: ctx.userId,
            title: { contains: taskTitle, mode: 'insensitive' },
            status: { not: 'ARCHIVED' },
        },
        orderBy: { createdAt: 'desc' },
        take: ASSISTANT_POLICIES.MAX_DISAMBIGUATION_OPTIONS + 1,
    });

    if (matches.length === 0) {
        return {
            reply: `No task found matching _${escapeMd(taskTitle)}_\\. Check the title and try again\\.`,
            requiresConfirmation: false,
        };
    }

    if (matches.length === 1) {
        await prisma.task.update({
            where: { id: matches[0].id },
            data: {
                status: newStatus,
                completedAt: newStatus === 'DONE' ? new Date() : null,
            },
        });
        const verb = newStatus === 'DONE' ? '✅ Marked done' : '🔄 Reopened';
        return {
            reply: `${verb}: *${escapeMd(matches[0].title)}*\\.`,
            requiresConfirmation: false,
        };
    }

    // Multiple matches — ask the user to be more specific
    const typedMatches = matches as Task[];
    const list = typedMatches
        .slice(0, ASSISTANT_POLICIES.MAX_DISAMBIGUATION_OPTIONS)
        .map((t, i) => `${i + 1}\\. ${escapeMd(t.title)}`)
        .join('\n');

    return {
        reply: `Found multiple tasks matching _${escapeMd(taskTitle)}_\\. Please be more specific:\n${list}`,
        requiresConfirmation: true,
        pendingIntent: 'update_task_status',
        pendingPayload: {
            kind: 'select_option',
            prompt: `Found multiple tasks matching _${escapeMd(taskTitle)}_\\. Reply with a number or send cancel\\.\n${list}`,
            parsedIntent: {
                intent: 'update_task_status',
                confidence: 1,
                entities: { status: statusRaw, taskTitle },
            },
            options: typedMatches
                .slice(0, ASSISTANT_POLICIES.MAX_DISAMBIGUATION_OPTIONS)
                .map(t => ({
                    label: t.title,
                    entities: { taskId: t.id, taskTitle: t.title, status: statusRaw },
                })),
        },
    };
}
