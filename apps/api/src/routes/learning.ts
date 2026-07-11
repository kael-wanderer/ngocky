import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendSuccess, sendCreated, sendMessage } from '../utils/response';
import { NotFoundError } from '../utils/errors';
import { assertPageInstance } from '../services/pageInstances';
import {
    createLearningTopicSchema,
    updateLearningTopicSchema,
    createLearningHistorySchema,
    updateLearningHistorySchema,
} from '../validators/phase2';

const router = Router();
router.use(authenticate);

async function getNextLearningTopicSortOrder(userId: string, instanceId: string | null) {
    const aggregate = await prisma.learningTopic.aggregate({
        where: { userId, instanceId },
        _max: { sortOrder: true },
    });
    return (aggregate._max.sortOrder ?? -1) + 1;
}

router.get('/topics', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const where: any = {
            instanceId: typeof req.query.instanceId === 'string' ? req.query.instanceId : null,
            OR: [
                { userId },
                { isShared: true },
            ],
        };
        const topics = await prisma.learningTopic.findMany({
            where,
            include: {
                user: { select: { id: true, name: true } },
                histories: {
                    orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
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

        const instanceId = typeof req.query.instanceId === 'string' ? req.query.instanceId : null;
        await assertPageInstance(instanceId, 'LEARNING');
        const ownedTopics = await prisma.learningTopic.findMany({
            where: { id: { in: ids }, userId: req.user!.userId, instanceId },
            select: { id: true },
        });
        const ownedIds = ids.filter((id) => ownedTopics.some((topic) => topic.id === id));
        if (!ownedIds.length) throw new NotFoundError('Learning topic not found');

        await prisma.$transaction(ownedIds.map((id, index) => prisma.learningTopic.update({
            where: { id },
            data: { sortOrder: index },
        })));
        sendMessage(res, 'Reordered');
    } catch (err) { next(err); }
});

router.post('/topics', validate(createLearningTopicSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const instanceId = req.body.instanceId ?? null;
        await assertPageInstance(instanceId, 'LEARNING');
        const sortOrder = await getNextLearningTopicSortOrder(req.user!.userId, instanceId);
        const topic = await prisma.learningTopic.create({
            data: {
                ...req.body,
                sortOrder,
                userId: req.user!.userId,
            },
            include: { histories: true },
        });
        sendCreated(res, topic);
    } catch (err) { next(err); }
});

router.patch('/topics/:id', validate(updateLearningTopicSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const existing = await prisma.learningTopic.findFirst({
            where: { id: req.params.id, userId: req.user!.userId, instanceId: typeof req.query.instanceId === 'string' ? req.query.instanceId : null },
        });
        if (!existing) throw new NotFoundError('Learning topic not found');

        const updated = await prisma.learningTopic.update({
            where: { id: req.params.id },
            data: req.body,
            include: { histories: true },
        });
        sendSuccess(res, updated);
    } catch (err) { next(err); }
});

router.delete('/topics/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const instanceId = typeof req.query.instanceId === 'string' ? req.query.instanceId : null;
        await assertPageInstance(instanceId, 'LEARNING');
        const existing = await prisma.learningTopic.findFirst({
            where: { id: req.params.id, userId: req.user!.userId, instanceId },
        });
        if (!existing) throw new NotFoundError('Learning topic not found');

        await prisma.learningTopic.delete({ where: { id: req.params.id } });
        sendMessage(res, 'Learning topic deleted');
    } catch (err) { next(err); }
});

router.post('/histories', validate(createLearningHistorySchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const instanceId = req.body.instanceId ?? null;
        await assertPageInstance(instanceId, 'LEARNING');
        const topic = await prisma.learningTopic.findFirst({
            where: { id: req.body.topicId, userId: req.user!.userId, instanceId },
        });
        if (!topic) throw new NotFoundError('Learning topic not found');

        const history = await prisma.learningItem.create({
            data: {
                ...req.body,
                deadline: req.body.deadline ? new Date(req.body.deadline) : undefined,
                userId: req.user!.userId,
            },
            include: { topic: true },
        });
        sendCreated(res, history);
    } catch (err) { next(err); }
});

router.patch('/histories/:id', validate(updateLearningHistorySchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const instanceId = typeof req.query.instanceId === 'string' ? req.query.instanceId : null;
        await assertPageInstance(instanceId, 'LEARNING');
        const existing = await prisma.learningItem.findFirst({
            where: { id: req.params.id, userId: req.user!.userId, topic: { instanceId } },
        });
        if (!existing) throw new NotFoundError('Learning history not found');

        const updated = await prisma.learningItem.update({
            where: { id: req.params.id },
            data: {
                ...req.body,
                deadline: req.body.deadline === null ? null : req.body.deadline ? new Date(req.body.deadline) : undefined,
            },
            include: { topic: true },
        });
        sendSuccess(res, updated);
    } catch (err) { next(err); }
});

router.delete('/histories/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const instanceId = typeof req.query.instanceId === 'string' ? req.query.instanceId : null;
        await assertPageInstance(instanceId, 'LEARNING');
        const existing = await prisma.learningItem.findFirst({
            where: { id: req.params.id, userId: req.user!.userId, topic: { instanceId } },
        });
        if (!existing) throw new NotFoundError('Learning history not found');

        await prisma.learningItem.delete({ where: { id: req.params.id } });
        sendMessage(res, 'Learning history deleted');
    } catch (err) { next(err); }
});

export default router;
