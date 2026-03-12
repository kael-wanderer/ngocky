import { prisma } from '../../../config/database';
import { escapeMd, parseEndOfDay } from '../utils';
import type { ResolverContext, ResolverResult } from './types';

/**
 * create_cakeo — Create a Ca Keo item (kid task/event) for the family.
 *
 * Entities:
 *   title: string (required)
 *   category?: 'School' | 'Activity' | 'Medical' | 'Entertainment' | 'Home' | 'Other'
 *   assignerName?: string (name of assigner — resolved to userId)
 *   startDate?: string (ISO date or YYYY-MM-DD)
 *   status?: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
 */
export async function resolveCaKeoCreate(
    entities: Record<string, any>,
    ctx: ResolverContext,
): Promise<ResolverResult> {
    const title = (entities.title as string | undefined)?.trim();
    if (!title) {
        return {
            reply: "I need a title\\. Try: _add ca keo school activity tomorrow_",
            requiresConfirmation: false,
        };
    }

    const category = (entities.category as string | undefined) ?? null;
    const status = (entities.status as string | undefined) ?? 'TODO';
    const startDateRaw = entities.startDate as string | undefined;
    const startDate = startDateRaw ? parseEndOfDay(startDateRaw, ctx.timezone) : null;

    // Resolve assigner by name if provided
    let assignerId: string | null = null;
    const assignerName = (entities.assignerName as string | undefined)?.trim();
    if (assignerName) {
        const user = await prisma.user.findFirst({
            where: { name: { contains: assignerName, mode: 'insensitive' }, active: true },
            select: { id: true },
        });
        assignerId = user?.id ?? null;
    }

    await prisma.caKeo.create({
        data: {
            title,
            category,
            status,
            assignerId,
            startDate,
            ownerId: ctx.userId,
            isShared: true,
            showOnCalendar: !!startDate,
        },
    });

    let reply = `✅ Created Ca Keo: *${escapeMd(title)}*`;
    if (category) reply += ` \\[${escapeMd(category)}\\]`;
    if (startDate) {
        reply += `\\. Date: ${escapeMd(startDate.toLocaleDateString('en-US', { timeZone: ctx.timezone, month: 'short', day: 'numeric', year: 'numeric' }))}`;
    }
    reply += `\\.`;

    return { reply, requiresConfirmation: false };
}
