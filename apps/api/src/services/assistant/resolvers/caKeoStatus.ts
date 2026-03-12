import { prisma } from '../../../config/database';
import { escapeMd } from '../utils';
import { ASSISTANT_POLICIES } from '../policies';
import type { ResolverContext, ResolverResult } from './types';

const VALID_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'];

/**
 * update_cakeo_status — Update the status of a Ca Keo item.
 *
 * Entities:
 *   itemTitle: string (required)
 *   status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED' (required)
 *   itemId?: string (used after disambiguation)
 */
export async function resolveCaKeoStatus(
    entities: Record<string, any>,
    ctx: ResolverContext,
): Promise<ResolverResult> {
    const statusRaw = (entities.status as string | undefined)?.toUpperCase().replace(/[\s-]/g, '_');
    const status = VALID_STATUSES.includes(statusRaw ?? '') ? statusRaw! : 'DONE';

    const itemId = (entities.itemId as string | undefined)?.trim();
    if (itemId) {
        const item = await prisma.caKeo.findFirst({
            where: {
                id: itemId,
                OR: [{ ownerId: ctx.userId }, { isShared: true }, { assignerId: ctx.userId }],
            },
        });
        if (!item) {
            return {
                reply: 'That Ca Keo item is no longer available\\. Please try again\\.',
                requiresConfirmation: false,
            };
        }
        await prisma.caKeo.update({ where: { id: item.id }, data: { status } });
        return {
            reply: `✅ *${escapeMd(item.title)}* marked as ${escapeMd(status.replace('_', ' ').toLowerCase())}\\.`,
            requiresConfirmation: false,
        };
    }

    const itemTitle = (entities.itemTitle as string | undefined)?.trim();
    if (!itemTitle) {
        return {
            reply: 'Which Ca Keo item? Try: _mark school trip done_',
            requiresConfirmation: false,
        };
    }

    const matches = await prisma.caKeo.findMany({
        where: {
            OR: [{ ownerId: ctx.userId }, { isShared: true }, { assignerId: ctx.userId }],
            title: { contains: itemTitle, mode: 'insensitive' },
        },
        orderBy: { startDate: 'asc' },
        take: ASSISTANT_POLICIES.MAX_DISAMBIGUATION_OPTIONS + 1,
    });

    if (matches.length === 0) {
        return {
            reply: `No Ca Keo item found matching _${escapeMd(itemTitle)}_\\.`,
            requiresConfirmation: false,
        };
    }

    if (matches.length > 1) {
        const list = matches
            .slice(0, ASSISTANT_POLICIES.MAX_DISAMBIGUATION_OPTIONS)
            .map((item, i) => `${i + 1}\\. ${escapeMd(item.title)}`)
            .join('\n');

        return {
            reply: `Found multiple items matching _${escapeMd(itemTitle)}_\\. Reply with a number or send cancel\\.\n${list}`,
            requiresConfirmation: true,
            pendingIntent: 'update_cakeo_status',
            pendingPayload: {
                kind: 'select_option',
                prompt: `Found multiple items matching _${escapeMd(itemTitle)}_\\. Reply with a number or send cancel\\.\n${list}`,
                parsedIntent: {
                    intent: 'update_cakeo_status',
                    confidence: 1,
                    entities: { itemTitle, status },
                },
                options: matches
                    .slice(0, ASSISTANT_POLICIES.MAX_DISAMBIGUATION_OPTIONS)
                    .map(item => ({
                        label: item.title,
                        entities: { itemId: item.id, itemTitle: item.title, status },
                    })),
            },
        };
    }

    const item = matches[0];
    await prisma.caKeo.update({ where: { id: item.id }, data: { status } });
    return {
        reply: `✅ *${escapeMd(item.title)}* marked as ${escapeMd(status.replace('_', ' ').toLowerCase())}\\.`,
        requiresConfirmation: false,
    };
}
