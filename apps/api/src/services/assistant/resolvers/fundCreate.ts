import { prisma } from '../../../config/database';
import { escapeMd, formatVND } from '../utils';
import type { ResolverContext, ResolverResult } from './types';
import { ASSISTANT_POLICIES } from '../policies';

const BUYABLE_CATEGORIES = new Set(['KEYCAP', 'KIT', 'ACCESSORIES']);

function normalizeFundType(value: unknown): 'BUY' | 'SELL' | 'TOP_UP' | null {
    const normalized = String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    return ['BUY', 'SELL', 'TOP_UP'].includes(normalized) ? (normalized as 'BUY' | 'SELL' | 'TOP_UP') : null;
}

function normalizeFundScope(value: unknown): 'MECHANICAL_KEYBOARD' | 'PLAY_STATION' | null {
    const normalized = String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    return ['MECHANICAL_KEYBOARD', 'PLAY_STATION'].includes(normalized) ? (normalized as 'MECHANICAL_KEYBOARD' | 'PLAY_STATION') : null;
}

function normalizeFundCategory(value: unknown): 'KEYCAP' | 'KIT' | 'SHIPPING' | 'ACCESSORIES' | 'OTHER' | null {
    const normalized = String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    return ['KEYCAP', 'KIT', 'SHIPPING', 'ACCESSORIES', 'OTHER'].includes(normalized)
        ? (normalized as 'KEYCAP' | 'KIT' | 'SHIPPING' | 'ACCESSORIES' | 'OTHER')
        : null;
}

function normalizeCondition(type: 'BUY' | 'SELL' | 'TOP_UP', value: unknown): 'BNIB' | 'USED' | null {
    if (type !== 'BUY') return null;
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'BNIB' || normalized === 'USED') return normalized;
    return null;
}

function mapFundCategoryToKeyboardCategory(category: 'KEYCAP' | 'KIT' | 'SHIPPING' | 'ACCESSORIES' | 'OTHER') {
    if (category === 'KEYCAP') return 'Keycap';
    if (category === 'KIT') return 'Kit';
    if (category === 'ACCESSORIES') return 'Accessories';
    if (category === 'SHIPPING') return 'Shipping';
    return 'Other';
}

export async function resolveFundCreate(
    entities: Record<string, any>,
    ctx: ResolverContext,
): Promise<ResolverResult> {
    const description = (entities.description as string | undefined)?.trim();
    const amount = typeof entities.amount === 'number' ? entities.amount : Number.parseFloat(String(entities.amount ?? ''));
    const type = normalizeFundType(entities.type);
    const scope = normalizeFundScope(entities.scope);
    const category = normalizeFundCategory(entities.category);
    const dateStr = (entities.date as string | undefined) ?? ctx.today;

    if (!description) {
        return { reply: 'I need the fund description\\. Example: _buy gmk cafe 7\\.8m mechanical keyboard keycap used_\\.', requiresConfirmation: false };
    }
    if (!type) {
        return { reply: 'I need the transaction type: _BUY_, _SELL_, or _TOP\\_UP_\\.', requiresConfirmation: false };
    }
    if (!scope) {
        return { reply: 'I need the scope: _MECHANICAL\\_KEYBOARD_ or _PLAY\\_STATION_\\.', requiresConfirmation: false };
    }
    if (!category) {
        return { reply: 'I need the category: _KEYCAP_, _KIT_, _SHIPPING_, _ACCESSORIES_, or _OTHER_\\.', requiresConfirmation: false };
    }
    if (!amount || Number.isNaN(amount) || amount <= 0) {
        return { reply: 'I need a valid amount\\. Example: `7800000` or `7\\.8m`\\.', requiresConfirmation: false };
    }

    const condition = normalizeCondition(type, entities.condition);
    if (type === 'BUY' && !condition) {
        return { reply: 'For a buy transaction, I need the condition: _BNIB_ or _USED_\\.', requiresConfirmation: false };
    }

    const payload: Record<string, any> = {
        description,
        amount,
        type,
        scope,
        category,
        condition,
        date: new Date(`${dateStr.slice(0, 10)}T12:00:00.000Z`),
        userId: ctx.userId,
    };

    if (type === 'SELL' && scope === 'MECHANICAL_KEYBOARD') {
        const keyboardName = (entities.keyboardName as string | undefined)?.trim() || description;
        const matches = await prisma.keyboard.findMany({
            where: {
                ownerId: ctx.userId,
                name: { contains: keyboardName, mode: 'insensitive' },
            },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
            take: ASSISTANT_POLICIES.MAX_DISAMBIGUATION_OPTIONS + 1,
        });

        if (matches.length === 0) {
            return {
                reply: `I couldn't find a keyboard item matching _${escapeMd(keyboardName)}_ to remove\\.`,
                requiresConfirmation: false,
            };
        }

        if (matches.length > 1) {
            const list = matches
                .slice(0, ASSISTANT_POLICIES.MAX_DISAMBIGUATION_OPTIONS)
                .map((item: any, index: number) => `${index + 1}\\. ${escapeMd(item.name)}`)
                .join('\n');

            return {
                reply: `Found multiple keyboard items matching _${escapeMd(keyboardName)}_\\. Reply with a number:\n${list}`,
                requiresConfirmation: true,
                pendingIntent: 'create_fund',
                pendingPayload: {
                    kind: 'select_option',
                    prompt: `Found multiple keyboard items matching _${escapeMd(keyboardName)}_\\. Reply with a number or send cancel\\.\n${list}`,
                    parsedIntent: {
                        intent: 'create_fund',
                        confidence: 1,
                        entities: { ...entities, description, amount, type, scope, category, condition, date: dateStr, keyboardName },
                    },
                    options: matches
                        .slice(0, ASSISTANT_POLICIES.MAX_DISAMBIGUATION_OPTIONS)
                        .map((item: any) => ({
                            label: item.name,
                            entities: { keyboardItemId: item.id, keyboardName: item.name },
                        })),
                },
            };
        }

        payload.keyboardItemId = matches[0].id;
        payload.keyboardItemName = matches[0].name;
    }

    await prisma.$transaction(async (tx: any) => {
        const { keyboardItemId, keyboardItemName, ...fundData } = payload;

        if (type === 'BUY' && scope === 'MECHANICAL_KEYBOARD' && BUYABLE_CATEGORIES.has(category)) {
            const lastKeyboard = await tx.keyboard.aggregate({
                where: { ownerId: ctx.userId },
                _max: { sortOrder: true },
            });

            await tx.keyboard.create({
                data: {
                    name: description,
                    price: amount,
                    category: mapFundCategoryToKeyboardCategory(category),
                    description: condition,
                    spec: [],
                    extras: [],
                    note: 'Created from Funds',
                    isShared: false,
                    ownerId: ctx.userId,
                    sortOrder: (lastKeyboard._max.sortOrder ?? -1) + 1,
                },
            });
        }

        if (type === 'SELL' && scope === 'MECHANICAL_KEYBOARD') {
            const keyboard = keyboardItemId
                ? await tx.keyboard.findFirst({ where: { id: keyboardItemId, ownerId: ctx.userId } })
                : await tx.keyboard.findFirst({ where: { ownerId: ctx.userId, name: keyboardItemName || description } });

            if (!keyboard) {
                throw new Error('not matching item in collection');
            }

            await tx.keyboard.delete({ where: { id: keyboard.id } });
        }

        await tx.fundTransaction.create({
            data: {
                ...fundData,
                condition,
            },
        });
    });

    return {
        reply: `💰 Logged fund: *${escapeMd(type)}* — ${escapeMd(description)} \\(${escapeMd(formatVND(amount))}\\)\\.`,
        requiresConfirmation: false,
    };
}
