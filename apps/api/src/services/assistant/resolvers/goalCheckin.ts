import { prisma } from '../../../config/database';
import type { Goal } from '@prisma/client';
import { escapeMd } from '../utils';
import { ASSISTANT_POLICIES } from '../policies';
import type { ResolverContext, ResolverResult } from './types';

/**
 * goal_checkin — Log a check-in for a goal.
 *
 * Entities:
 *   goalTitle: string (required)
 *   quantity?: number (default 1)
 *   note?: string
 */
export async function resolveGoalCheckin(
    entities: Record<string, any>,
    ctx: ResolverContext,
): Promise<ResolverResult> {
    const goalId = (entities.goalId as string | undefined)?.trim();
    const goalTitle = (entities.goalTitle as string | undefined)?.trim();
    const quantity = typeof entities.quantity === 'number' ? entities.quantity : 1;
    const note = (entities.note as string | undefined)?.trim() ?? undefined;

    if (goalId) {
        const goal = await prisma.goal.findFirst({
            where: {
                id: goalId,
                OR: [{ userId: ctx.userId }, { isShared: true }],
                active: true,
            },
        });

        if (!goal) {
            return {
                reply: 'That goal is no longer available\\. Please send the request again\\.',
                requiresConfirmation: false,
            };
        }

        return logCheckin(goal, quantity, note, ctx.userId);
    }

    if (!goalTitle) {
        return {
            reply: 'Which goal? Try: _logged 5km for running goal_',
            requiresConfirmation: false,
        };
    }

    const matches = await prisma.goal.findMany({
        where: {
            OR: [{ userId: ctx.userId }, { isShared: true }],
            title: { contains: goalTitle, mode: 'insensitive' },
            active: true,
        },
        orderBy: { createdAt: 'desc' },
        take: ASSISTANT_POLICIES.MAX_DISAMBIGUATION_OPTIONS + 1,
    });

    if (matches.length === 0) {
        return {
            reply: `No active goal found matching _${escapeMd(goalTitle)}_\\.`,
            requiresConfirmation: false,
        };
    }

    if (matches.length > 1) {
        const typedMatches = matches as Goal[];
        const list = typedMatches
            .slice(0, ASSISTANT_POLICIES.MAX_DISAMBIGUATION_OPTIONS)
            .map((goal, i) => `${i + 1}\\. ${escapeMd(goal.title)}`)
            .join('\n');

        return {
            reply: `Found multiple goals matching _${escapeMd(goalTitle)}_\\. Reply with a number or send cancel\\.\n${list}`,
            requiresConfirmation: true,
            pendingIntent: 'goal_checkin',
            pendingPayload: {
                kind: 'select_option',
                prompt: `Found multiple goals matching _${escapeMd(goalTitle)}_\\. Reply with a number or send cancel\\.\n${list}`,
                parsedIntent: {
                    intent: 'goal_checkin',
                    confidence: 1,
                    entities: { goalTitle, quantity, note },
                },
                options: typedMatches
                    .slice(0, ASSISTANT_POLICIES.MAX_DISAMBIGUATION_OPTIONS)
                    .map(goal => ({
                        label: goal.title,
                        entities: { goalId: goal.id, goalTitle: goal.title, quantity, note },
                    })),
            },
        };
    }

    return logCheckin(matches[0], quantity, note, ctx.userId);
}

async function logCheckin(
    goal: {
        id: string;
        title: string;
        trackingType: string;
        currentCount: number;
        unit: string | null;
    },
    quantity: number,
    note: string | undefined,
    userId: string,
): Promise<ResolverResult> {
    await prisma.goalCheckIn.create({
        data: {
            goalId: goal.id,
            userId,
            quantity,
            note,
            date: new Date(),
        },
    });

    const increment = goal.trackingType === 'BY_FREQUENCY' ? 1 : quantity;
    await prisma.goal.update({
        where: { id: goal.id },
        data: { currentCount: { increment } },
    });

    const quantityStr = goal.trackingType === 'BY_QUANTITY' && goal.unit
        ? `${quantity} ${goal.unit}`
        : `${quantity}x`;

    return {
        reply: `🎯 Check\\-in logged for *${escapeMd(goal.title)}*: ${escapeMd(quantityStr)}\\.`,
        requiresConfirmation: false,
    };
}
