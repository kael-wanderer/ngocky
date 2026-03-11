import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createFundSchema, updateFundSchema } from '../validators/modules';
import { sendSuccess, sendCreated, sendPaginated, sendMessage } from '../utils/response';
import { ForbiddenError, NotFoundError } from '../utils/errors';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
        const type = req.query.type as string;
        const scope = req.query.scope as string;
        const category = req.query.category as string;
        const dateFrom = req.query.dateFrom as string;
        const dateTo = req.query.dateTo as string;

        const where: any = { userId: req.user!.userId };
        if (type) where.type = type;
        if (scope) where.scope = scope;
        if (category) where.category = category;
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
        const fund = await prisma.fundTransaction.create({
            data: {
                ...req.body,
                date: new Date(req.body.date),
                userId: req.user!.userId,
            },
        });
        sendCreated(res, fund);
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

        const fund = await prisma.fundTransaction.update({
            where: { id: req.params.id },
            data: {
                ...req.body,
                date: req.body.date ? new Date(req.body.date) : undefined,
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
