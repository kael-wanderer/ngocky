import { prisma, iContains } from '../../../config/database';
import { escapeMd, formatVND } from '../utils';
import { ASSISTANT_POLICIES } from '../policies';
import type { ResolverContext, ResolverResult } from './types';

export async function resolveKeyboardQuery(
    entities: Record<string, any>,
    ctx: ResolverContext,
): Promise<ResolverResult> {
    const where: any = {
        OR: [{ ownerId: ctx.userId }, { isShared: true }],
    };

    const keyword = (entities.keyword as string | undefined)?.trim();
    const tag = (entities.tag as string | undefined)?.trim();
    const color = (entities.color as string | undefined)?.trim();
    const category = (entities.category as string | undefined)?.trim();

    const and: any[] = [];
    if (keyword) and.push({ name: iContains(keyword) });
    if (tag) and.push({ tag: iContains(tag) });
    if (color) and.push({ color: iContains(color) });
    if (category) and.push({ category: iContains(category) });
    if (and.length) where.AND = and;

    const keyboards = await prisma.keyboard.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        take: ASSISTANT_POLICIES.MAX_QUERY_RESULTS,
    });

    if (keyboards.length === 0) {
        return { reply: 'No keyboard items found\\.', requiresConfirmation: false };
    }

    const lines = keyboards.map((item: any) => {
        const parts = [
            item.category ? `[${item.category}]` : '',
            item.tag ? `#${item.tag}` : '',
            item.color ? item.color : '',
            typeof item.price === 'number' && item.price > 0 ? formatVND(item.price) : '',
        ].filter(Boolean);

        return `⌨️ *${escapeMd(item.name)}*${parts.length ? ` — ${escapeMd(parts.join(' · '))}` : ''}`;
    });

    return {
        reply: `*Keyboard items:*\n${lines.join('\n')}`,
        requiresConfirmation: false,
    };
}
