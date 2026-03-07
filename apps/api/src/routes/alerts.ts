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

router.post('/', validate(createAlertRuleSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const item = await prisma.alertRule.create({
            data: {
                ...req.body,
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
                orderBy: { createdAt: 'desc' },
            }),
            prisma.alertRule.count({ where: { userId: req.user!.userId } }),
        ]);

        sendPaginated(res, items, total, page, limit);
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
