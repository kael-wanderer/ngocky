import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createFundSchema, updateFundSchema } from '../validators/modules';
import { sendSuccess, sendCreated, sendPaginated, sendMessage } from '../utils/response';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';

const router = Router();
router.use(authenticate);

function normalizeCondition(type: unknown, condition: unknown) {
    if (type === 'TOP_UP') {
        return null;
    }

    return condition ?? null;
}

function isMechanicalKeyboardScope(scope: unknown) {
    return scope === 'MECHANICAL_KEYBOARD';
}

function shouldCreateKeyboardFromFund(type: unknown, scope: unknown, category: unknown) {
    return type === 'BUY'
        && isMechanicalKeyboardScope(scope)
        && ['KEYCAP', 'KIT', 'ACCESSORIES'].includes(String(category ?? ''));
}

function mapFundCategoryToKeyboardCategory(category: unknown) {
    const raw = String(category ?? '').toUpperCase();
    if (raw === 'KEYCAP') return 'Keycap';
    if (raw === 'KIT') return 'Kit';
    if (raw === 'ACCESSORIES') return 'Accessories';
    if (raw === 'SHIPPING') return 'Shipping';
    if (raw === 'OTHER') return 'Other';
    return null;
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
        const type = req.query.type as string;
        const scope = req.query.scope as string;
        const category = req.query.category as string;
        const condition = req.query.condition as string;
        const dateFrom = req.query.dateFrom as string;
        const dateTo = req.query.dateTo as string;

        const where: any = { userId: req.user!.userId };
        if (type) where.type = type;
        if (scope) where.scope = scope;
        if (category) where.category = category;
        if (condition) where.condition = condition;
        if (dateFrom || dateTo) {
            where.date = {};
            if (dateFrom) where.date.gte = new Date(dateFrom);
            if (dateTo) where.date.lte = new Date(dateTo);
        }

        const [funds, total] = await Promise.all([
            prisma.fundTransaction.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { date: 'desc' },
            }),
            prisma.fundTransaction.count({ where }),
        ]);

        sendPaginated(res, funds, total, page, limit);
    } catch (err) { next(err); }
});

router.post('/', validate(createFundSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const fund = await prisma.$transaction(async (tx: any) => {
            const normalizedCondition = normalizeCondition(req.body.type, req.body.condition);
            const { keyboardItemId, keyboardItemName, ...fundData } = req.body;

            if (shouldCreateKeyboardFromFund(fundData.type, fundData.scope, fundData.category)) {
                const lastKeyboard = await tx.keyboard.aggregate({
                    where: { ownerId: userId },
                    _max: { sortOrder: true },
                });

                await tx.keyboard.create({
                    data: {
                        name: fundData.description,
                        price: fundData.amount,
                        category: mapFundCategoryToKeyboardCategory(fundData.category),
                        description: normalizedCondition,
                        spec: [],
                        note: 'Created from Funds',
                        isShared: false,
                        ownerId: userId,
                        sortOrder: (lastKeyboard._max.sortOrder ?? -1) + 1,
                    },
                });
            }

            if (fundData.type === 'SELL' && isMechanicalKeyboardScope(fundData.scope)) {
                const where = keyboardItemId
                    ? { id: keyboardItemId, ownerId: userId }
                    : {
                        name: keyboardItemName || fundData.description,
                        ownerId: userId,
                    };

                const keyboard = await tx.keyboard.findFirst({ where });
                if (!keyboard) {
                    throw new ValidationError('not matching item in collection');
                }

                await tx.keyboard.delete({ where: { id: keyboard.id } });
            }

            return tx.fundTransaction.create({
                data: {
                    ...fundData,
                    condition: normalizedCondition,
                    date: new Date(fundData.date),
                    userId,
                },
            });
        });
        sendCreated(res, fund);
    } catch (err) { next(err); }
});

router.post('/import', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const rows: any[] = Array.isArray(req.body.items) ? req.body.items : [];
        if (!rows.length) {
            return sendSuccess(res, { created: 0 });
        }

        const parseDate = (value: unknown) => {
            if (!value) return new Date();
            const parsed = new Date(String(value));
            return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
        };

        const parseAmount = (value: unknown) => {
            if (value == null || value === '') return 0;
            if (typeof value === 'number') return value;
            const normalized = String(value).trim().replace(/,/g, '').toUpperCase();
            const match = normalized.match(/^(\d+(?:\.\d+)?)([KMB])?$/);
            if (!match) return Number(normalized) || 0;
            const base = Number(match[1]);
            const multiplierMap: Record<string, number> = { K: 1_000, M: 1_000_000, B: 1_000_000_000 };
            const multiplier = match[2] ? multiplierMap[match[2]] : 1;
            return Math.round(base * multiplier);
        };

        const normalizeType = (value: unknown) => {
            const normalized = String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
            return ['BUY', 'SELL', 'TOP_UP'].includes(normalized) ? normalized : 'BUY';
        };

        const normalizeScope = (value: unknown) => {
            const normalized = String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
            return ['MECHANICAL_KEYBOARD', 'PLAY_STATION'].includes(normalized) ? normalized : 'MECHANICAL_KEYBOARD';
        };

        const normalizeCategory = (value: unknown) => {
            const normalized = String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
            return ['KEYCAP', 'KIT', 'SHIPPING', 'ACCESSORIES', 'OTHER'].includes(normalized) ? normalized : 'OTHER';
        };

        const parseConditionValue = (value: unknown) => {
            const normalized = String(value ?? '').trim().toUpperCase();
            if (normalized === 'USED') return 'USED';
            if (normalized === 'BNIB') return 'BNIB';
            return null;
        };

        const items = rows
            .map((row) => {
                const type = normalizeType(row.type);

                return {
                    description: String(row.description ?? '').trim(),
                    type,
                    scope: normalizeScope(row.scope),
                    category: normalizeCategory(row.category),
                    condition: normalizeCondition(type, parseConditionValue(row.condition)),
                    date: parseDate(row.date),
                    amount: parseAmount(row.amount),
                    userId: req.user!.userId,
                };
            })
            .filter((row) => row.description && row.amount > 0);

        if (!items.length) {
            return sendSuccess(res, { created: 0 });
        }

        await prisma.fundTransaction.createMany({
            data: items,
        });

        sendCreated(res, { created: items.length });
    } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const fund = await prisma.fundTransaction.findUnique({ where: { id: req.params.id } });
        if (!fund) throw new NotFoundError('Fund transaction');
        if (fund.userId !== req.user!.userId) throw new ForbiddenError('You do not have access to this fund transaction');
        sendSuccess(res, fund);
    } catch (err) { next(err); }
});

router.patch('/:id', validate(updateFundSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const existing = await prisma.fundTransaction.findUnique({ where: { id: req.params.id } });
        if (!existing) throw new NotFoundError('Fund transaction');
        if (existing.userId !== req.user!.userId) throw new ForbiddenError('Only the owner can update this fund transaction');
        const fundData = Object.fromEntries(
            Object.entries(req.body).filter(([key]) => key !== 'keyboardItemId' && key !== 'keyboardItemName'),
        ) as Record<string, unknown>;

        const fund = await prisma.fundTransaction.update({
            where: { id: req.params.id },
            data: {
                ...fundData,
                condition: (fundData.type !== undefined || fundData.condition !== undefined)
                    ? normalizeCondition(fundData.type ?? existing.type, fundData.condition ?? existing.condition)
                    : undefined,
                date: fundData.date ? new Date(String(fundData.date)) : undefined,
            },
        });
        sendSuccess(res, fund);
    } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const existing = await prisma.fundTransaction.findUnique({ where: { id: req.params.id } });
        if (!existing) throw new NotFoundError('Fund transaction');
        if (existing.userId !== req.user!.userId) throw new ForbiddenError('Only the owner can delete this fund transaction');

        await prisma.fundTransaction.delete({ where: { id: req.params.id } });
        sendMessage(res, 'Fund transaction deleted');
    } catch (err) { next(err); }
});

export default router;
