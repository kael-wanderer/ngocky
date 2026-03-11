import { prisma } from '../../../config/database';
import { escapeMd, formatVND } from '../utils';
import type { ResolverContext, ResolverResult } from './types';

/**
 * create_expense — Log a personal expense.
 *
 * Entities:
 *   amount: number (VND, required)
 *   category: string (required)
 *   note?: string
 *   date?: YYYY-MM-DD (default today)
 */
export async function resolveExpenseCreate(
    entities: Record<string, any>,
    ctx: ResolverContext,
): Promise<ResolverResult> {
    const amount = typeof entities.amount === 'number' ? entities.amount : parseFloat(entities.amount);
    const category = (entities.category as string | undefined)?.trim();
    const note = (entities.note as string | undefined)?.trim() ?? null;
    const dateStr = (entities.date as string | undefined) ?? ctx.today;

    if (!amount || isNaN(amount) || amount <= 0) {
        return {
            reply: 'I need the amount\\. Reply with the amount only, or send cancel\\.',
            requiresConfirmation: true,
            pendingIntent: 'create_expense',
            pendingPayload: {
                kind: 'collect_field',
                prompt: 'I need the amount\\. Reply with the amount only, or send cancel\\.',
                parsedIntent: {
                    intent: 'create_expense',
                    confidence: 1,
                    entities: {
                        ...entities,
                        category,
                        note,
                        date: dateStr,
                    },
                },
                field: 'amount',
            },
        };
    }
    if (!category) {
        return {
            reply: 'I need the category\\. Reply with the category only, or send cancel\\.',
            requiresConfirmation: true,
            pendingIntent: 'create_expense',
            pendingPayload: {
                kind: 'collect_field',
                prompt: 'I need the category\\. Reply with the category only, or send cancel\\.',
                parsedIntent: {
                    intent: 'create_expense',
                    confidence: 1,
                    entities: {
                        ...entities,
                        amount,
                        note,
                        date: dateStr,
                    },
                },
                field: 'category',
            },
        };
    }

    // Parse date — use noon UTC on that day (locale-independent)
    const date = new Date(`${dateStr.slice(0, 10)}T12:00:00.000Z`);

    await prisma.expense.create({
        data: {
            description: note ?? category,
            type: 'PAY',
            category,
            date,
            amount,
            note,
            scope: 'PERSONAL',
            isShared: false,
            userId: ctx.userId,
        },
    });

    return {
        reply: `💸 Logged expense: *${escapeMd(formatVND(amount))}* — ${escapeMd(category)}\\.`,
        requiresConfirmation: false,
    };
}
