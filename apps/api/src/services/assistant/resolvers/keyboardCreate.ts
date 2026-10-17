import { prisma } from '../../../config/database';
import { escapeMd, formatVND } from '../utils';
import type { ResolverContext, ResolverResult } from './types';
import { HobbyOptionsService } from '../../hobbyOptions';

export async function resolveKeyboardCreate(
    entities: Record<string, any>,
    ctx: ResolverContext,
): Promise<ResolverResult> {
    const name = (entities.name as string | undefined)?.trim();
    const options = await HobbyOptionsService.get();
    const category = HobbyOptionsService.resolveLabel(options, 'category', entities.category);
    const price = entities.price == null ? null : Number.parseFloat(String(entities.price));
    const tag = (entities.tag as string | undefined)?.trim() || null;
    const color = (entities.color as string | undefined)?.trim() || null;
    const note = (entities.note as string | undefined)?.trim() || null;
    const condition = HobbyOptionsService.resolveLabel(options, 'condition', entities.condition);

    if (!name) {
        return { reply: 'I need the keyboard item name\\. Example: _add keyboard kohaku r1 kit 30m silver_\\.', requiresConfirmation: false };
    }

    const last = await prisma.keyboard.aggregate({
        where: { ownerId: ctx.userId },
        _max: { sortOrder: true },
    });

    await prisma.keyboard.create({
        data: {
            name,
            price: price && !Number.isNaN(price) ? price : null,
            category,
            tag,
            color,
            spec: [],
            description: condition,
            note,
            isShared: false,
            ownerId: ctx.userId,
            sortOrder: (last._max.sortOrder ?? -1) + 1,
        },
    });

    const priceText = price && !Number.isNaN(price) ? ` — ${escapeMd(formatVND(price))}` : '';
    return {
        reply: `⌨️ Added keyboard item: *${escapeMd(name)}*${priceText}\\.`,
        requiresConfirmation: false,
    };
}
