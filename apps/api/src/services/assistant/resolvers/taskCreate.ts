import { prisma } from '../../../config/database';
import { escapeMd, parseEndOfDay } from '../utils';
import type { ResolverContext, ResolverResult } from './types';

/**
 * create_task — Create a standalone task for the user.
 *
 * Entities:
 *   title: string (required)
 *   dueDate?: string (ISO datetime or YYYY-MM-DD)
 *   priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
 */
export async function resolveTaskCreate(
    entities: Record<string, any>,
    ctx: ResolverContext,
): Promise<ResolverResult> {
    const title = (entities.title as string | undefined)?.trim();
    if (!title) {
        return {
            reply: "I need a task title\\. Try: _add task pay electricity bill tomorrow_",
            requiresConfirmation: false,
        };
    }

    const priority = entities.priority ?? 'LOW';
    const dueDateRaw = entities.dueDate as string | undefined;
    const dueDate = dueDateRaw ? parseEndOfDay(dueDateRaw, ctx.timezone) : null;

    // Get next sort order
    const aggregate = await prisma.task.aggregate({
        where: { userId: ctx.userId },
        _max: { sortOrder: true },
    });
    const sortOrder = (aggregate._max.sortOrder ?? -1) + 1;

    await prisma.task.create({
        data: {
            title,
            priority,
            dueDate,
            status: 'PLANNED',
            sortOrder,
            userId: ctx.userId,
        },
    });

    let reply = `✅ Created task: *${escapeMd(title)}*`;
    if (dueDate) {
        reply += `\\. Due: ${escapeMd(dueDate.toLocaleDateString('en-US', { timeZone: ctx.timezone, month: 'short', day: 'numeric', year: 'numeric' }))}`;
    }
    reply += `\\.`;

    return { reply, requiresConfirmation: false };
}
