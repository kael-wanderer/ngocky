import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendSuccess, sendCreated, sendMessage } from '../utils/response';
import { NotFoundError } from '../utils/errors';
import {
    createIdeaTopicSchema,
    updateIdeaTopicSchema,
    createIdeaLogSchema,
    updateIdeaLogSchema,
} from '../validators/phase2';

const router = Router();
router.use(authenticate);

async function getNextIdeaTopicSortOrder(userId: string) {
    const aggregate = await prisma.ideaTopic.aggregate({
        where: { userId },
        _max: { sortOrder: true },
    });
    return (aggregate._max.sortOrder ?? -1) + 1;
}

router.get('/topics', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const where: any = {
            OR: [
                { userId: req.user!.userId },
                { isShared: true },
            ],
        };
        const topics = await prisma.ideaTopic.findMany({
            where,
            include: {
                user: { select: { id: true, name: true } },
                logs: {
                    orderBy: { createdAt: 'desc' },
                },
            },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        });
        sendSuccess(res, topics);
    } catch (err) { next(err); }
});

router.post('/topics/reorder', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { ids } = req.body as { ids: string[] };
        if (!Array.isArray(ids)) return sendMessage(res, 'Invalid');

        const ownedTopics = await prisma.ideaTopic.findMany({
            where: { id: { in: ids }, userId: req.user!.userId },
            select: { id: true },
        });
        const ownedIds = ids.filter((id) => ownedTopics.some((topic) => topic.id === id));
        if (!ownedIds.length) throw new NotFoundError('Idea topic not found');

        await prisma.$transaction(ownedIds.map((id, index) => prisma.ideaTopic.update({
            where: { id },
            data: { sortOrder: index },
        })));
        sendMessage(res, 'Reordered');
    } catch (err) { next(err); }
});

router.post('/topics', validate(createIdeaTopicSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sortOrder = await getNextIdeaTopicSortOrder(req.user!.userId);
        const topic = await prisma.ideaTopic.create({
            data: {
                ...req.body,
                sortOrder,
                userId: req.user!.userId,
            },
            include: { logs: true },
        });
        sendCreated(res, topic);
    } catch (err) { next(err); }
});

router.patch('/topics/:id', validate(updateIdeaTopicSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const existing = await prisma.ideaTopic.findFirst({
            where: { id: req.params.id, userId: req.user!.userId },
        });
        if (!existing) throw new NotFoundError('Idea topic not found');

        const updated = await prisma.ideaTopic.update({
            where: { id: req.params.id },
            data: req.body,
            include: { logs: true },
        });
        sendSuccess(res, updated);
    } catch (err) { next(err); }
});

router.delete('/topics/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const existing = await prisma.ideaTopic.findFirst({
            where: { id: req.params.id, userId: req.user!.userId },
        });
        if (!existing) throw new NotFoundError('Idea topic not found');

        await prisma.ideaTopic.delete({ where: { id: req.params.id } });
        sendMessage(res, 'Idea topic deleted');
    } catch (err) { next(err); }
});

router.post('/logs', validate(createIdeaLogSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const topic = await prisma.ideaTopic.findFirst({
            where: { id: req.body.topicId, userId: req.user!.userId },
        });
        if (!topic) throw new NotFoundError('Idea topic not found');

        const log = await prisma.idea.create({
            data: {
                ...req.body,
                userId: req.user!.userId,
            },
            include: { topic: true },
        });
        sendCreated(res, log);
    } catch (err) { next(err); }
});

router.patch('/logs/:id', validate(updateIdeaLogSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const existing = await prisma.idea.findFirst({
            where: { id: req.params.id, userId: req.user!.userId },
        });
        if (!existing) throw new NotFoundError('Idea log not found');

        const updated = await prisma.idea.update({
            where: { id: req.params.id },
            data: req.body,
            include: { topic: true },
        });
        sendSuccess(res, updated);
    } catch (err) { next(err); }
});

router.delete('/logs/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const existing = await prisma.idea.findFirst({
            where: { id: req.params.id, userId: req.user!.userId },
        });
        if (!existing) throw new NotFoundError('Idea log not found');

        await prisma.idea.delete({ where: { id: req.params.id } });
        sendMessage(res, 'Idea log deleted');
    } catch (err) { next(err); }
});

export default router;
