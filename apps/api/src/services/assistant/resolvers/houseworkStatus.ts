import { prisma } from '../../../config/database';
import type { HouseworkItem } from '@prisma/client';
import { escapeMd } from '../utils';
import { ASSISTANT_POLICIES } from '../policies';
import type { ResolverContext, ResolverResult } from './types';

function calculateNextDueDateSimple(item: { frequencyType: string }): Date {
    const next = new Date();
    switch (item.frequencyType) {
        case 'DAILY': next.setDate(next.getDate() + 1); break;
        case 'WEEKLY': next.setDate(next.getDate() + 7); break;
        case 'MONTHLY': next.setMonth(next.getMonth() + 1); break;
        case 'QUARTERLY': next.setMonth(next.getMonth() + 3); break;
        case 'HALF_YEARLY': next.setMonth(next.getMonth() + 6); break;
        case 'YEARLY': next.setFullYear(next.getFullYear() + 1); break;
    }
    return next;
}

/**
 * update_housework_status — Mark a housework item as complete.
 *
 * Entities:
 *   itemTitle: string (required)
 */
export async function resolveHouseworkStatus(
    entities: Record<string, any>,
    ctx: ResolverContext,
): Promise<ResolverResult> {
    const itemId = (entities.itemId as string | undefined)?.trim();
    const itemTitle = (entities.itemTitle as string | undefined)?.trim();

    if (itemId) {
        const item = await prisma.houseworkItem.findFirst({
            where: {
                id: itemId,
                OR: [{ createdById: ctx.userId }, { isShared: true }],
                active: true,
            },
        });

        if (!item) {
            return {
                reply: 'That housework item is no longer available\\. Please send the request again\\.',
                requiresConfirmation: false,
            };
        }

        return completeHouseworkItem(item);
    }

    if (!itemTitle) {
        return {
            reply: 'Which chore should I mark done? Try: _mark dishes done_',
            requiresConfirmation: false,
        };
    }

    const matches = await prisma.houseworkItem.findMany({
        where: {
            OR: [{ createdById: ctx.userId }, { isShared: true }],
            title: { contains: itemTitle, mode: 'insensitive' },
            active: true,
        },
        orderBy: { nextDueDate: 'asc' },
        take: ASSISTANT_POLICIES.MAX_DISAMBIGUATION_OPTIONS + 1,
    });

    if (matches.length === 0) {
        return {
            reply: `No housework item found matching _${escapeMd(itemTitle)}_\\.`,
            requiresConfirmation: false,
        };
    }

    if (matches.length > 1) {
        const typedMatches = matches as HouseworkItem[];
        const list = typedMatches
            .slice(0, ASSISTANT_POLICIES.MAX_DISAMBIGUATION_OPTIONS)
            .map((item, i) => `${i + 1}\\. ${escapeMd(item.title)}`)
            .join('\n');

        return {
            reply: `Found multiple items matching _${escapeMd(itemTitle)}_\\. Reply with a number or send cancel\\.\n${list}`,
            requiresConfirmation: true,
            pendingIntent: 'update_housework_status',
            pendingPayload: {
                kind: 'select_option',
                prompt: `Found multiple items matching _${escapeMd(itemTitle)}_\\. Reply with a number or send cancel\\.\n${list}`,
                parsedIntent: {
                    intent: 'update_housework_status',
                    confidence: 1,
                    entities: { itemTitle },
                },
                options: typedMatches
                    .slice(0, ASSISTANT_POLICIES.MAX_DISAMBIGUATION_OPTIONS)
                    .map(item => ({
                        label: item.title,
                        entities: { itemId: item.id, itemTitle: item.title },
                    })),
            },
        };
    }

    return completeHouseworkItem(matches[0]);
}

async function completeHouseworkItem(item: {
    id: string;
    title: string;
    frequencyType: string;
}): Promise<ResolverResult> {
    const now = new Date();
    const data: Record<string, any> = { lastCompletedDate: now };

    if (item.frequencyType !== 'ONE_TIME') {
        data.nextDueDate = calculateNextDueDateSimple(item);
    } else {
        data.active = false;
    }

    await prisma.houseworkItem.update({ where: { id: item.id }, data });

    return {
        reply: `✅ Marked done: *${escapeMd(item.title)}*\\.`,
        requiresConfirmation: false,
    };
}
