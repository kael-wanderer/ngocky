import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendSuccess, sendCreated, sendPaginated, sendMessage } from '../utils/response';
import { NotFoundError } from '../utils/errors';
import { paramStr, queryInt } from '../utils/query';
import { createIdeaSchema, updateIdeaSchema } from '../validators/phase2';

const router = Router();
router.use(authenticate);

router.post('/', validate(createIdeaSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const item = await prisma.idea.create({
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
            prisma.idea.findMany({
                where: { userId: req.user!.userId },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.idea.count({ where: { userId: req.user!.userId } }),
        ]);

        sendPaginated(res, items, total, page, limit);
    } catch (err) { next(err); }
});

router.patch('/:id', validate(updateIdeaSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = paramStr(req, 'id');
        const item = await prisma.idea.findFirst({
            where: { id, userId: req.user!.userId },
        });
        if (!item) throw new NotFoundError('Idea not found');

        const updated = await prisma.idea.update({
            where: { id },
            data: req.body,
        });
        sendSuccess(res, updated);
    } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = paramStr(req, 'id');
        const item = await prisma.idea.findFirst({
            where: { id, userId: req.user!.userId },
        });
        if (!item) throw new NotFoundError('Idea not found');

        await prisma.idea.delete({ where: { id } });
        sendMessage(res, 'Idea deleted');
    } catch (err) { next(err); }
});

export default router;
