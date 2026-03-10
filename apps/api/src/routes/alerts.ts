import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendSuccess, sendCreated, sendPaginated, sendMessage } from '../utils/response';
import { NotFoundError } from '../utils/errors';
import { paramStr, queryInt } from '../utils/query';
import { createAlertRuleSchema, updateAlertRuleSchema } from '../validators/phase2';

const router = Router();
router.use(authenticate);

async function getNextAlertRuleSortOrder(userId: string) {
    const aggregate = await prisma.alertRule.aggregate({
        where: { userId },
        _max: { sortOrder: true },
    });
    return (aggregate._max.sortOrder ?? -1) + 1;
}

router.post('/', validate(createAlertRuleSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sortOrder = await getNextAlertRuleSortOrder(req.user!.userId);
        const item = await prisma.alertRule.create({
            data: {
                ...req.body,
                sortOrder,
                userId: req.user!.userId,
            },
        });
        sendCreated(res, item);
    } catch (err) { next(err); }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = queryInt(req, 'page', 1);
        const limit = queryInt(req, 'limit', 20);
        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            prisma.alertRule.findMany({
                where: { userId: req.user!.userId },
                skip,
                take: limit,
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
            }),
            prisma.alertRule.count({ where: { userId: req.user!.userId } }),
        ]);

        sendPaginated(res, items, total, page, limit);
    } catch (err) { next(err); }
});

router.post('/reorder', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id: unknown): id is string => typeof id === 'string') : [];
        if (ids.length === 0) return sendSuccess(res, []);

        const owned = await prisma.alertRule.findMany({
            where: { id: { in: ids }, userId: req.user!.userId },
            select: { id: true },
        });
        const ownedIds = new Set(owned.map((item) => item.id));
        const orderedIds = ids.filter((id: string) => ownedIds.has(id));

        await Promise.all(orderedIds.map((id: string, index: number) => prisma.alertRule.update({
            where: { id },
            data: { sortOrder: index },
        })));

        sendSuccess(res, orderedIds);
    } catch (err) { next(err); }
});

router.patch('/:id', validate(updateAlertRuleSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = paramStr(req, 'id');
        const item = await prisma.alertRule.findFirst({
            where: { id, userId: req.user!.userId },
        });
        if (!item) throw new NotFoundError('Alert rule not found');

        const updated = await prisma.alertRule.update({
            where: { id },
            data: req.body,
        });
        sendSuccess(res, updated);
    } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = paramStr(req, 'id');
        const item = await prisma.alertRule.findFirst({
            where: { id, userId: req.user!.userId },
        });
        if (!item) throw new NotFoundError('Alert rule not found');

        await prisma.alertRule.delete({ where: { id } });
        sendMessage(res, 'Alert rule deleted');
    } catch (err) { next(err); }
});

export default router;
