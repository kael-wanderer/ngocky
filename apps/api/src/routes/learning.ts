import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendSuccess, sendCreated, sendMessage } from '../utils/response';
import { NotFoundError } from '../utils/errors';
import {
    createLearningTopicSchema,
    updateLearningTopicSchema,
    createLearningHistorySchema,
    updateLearningHistorySchema,
} from '../validators/phase2';

const router = Router();
router.use(authenticate);

router.get('/topics', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const where: any = {
            OR: [
                { userId },
                { isShared: true },
            ],
        };
        const topics = await prisma.learningTopic.findMany({
            where,
            include: {
                histories: {
                    orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        sendSuccess(res, topics);
    } catch (err) { next(err); }
});

router.post('/topics', validate(createLearningTopicSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const topic = await prisma.learningTopic.create({
            data: {
                ...req.body,
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
            where: { id: req.params.id, userId: req.user!.userId },
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
        const existing = await prisma.learningTopic.findFirst({
            where: { id: req.params.id, userId: req.user!.userId },
        });
        if (!existing) throw new NotFoundError('Learning topic not found');

        await prisma.learningTopic.delete({ where: { id: req.params.id } });
        sendMessage(res, 'Learning topic deleted');
    } catch (err) { next(err); }
});

router.post('/histories', validate(createLearningHistorySchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const topic = await prisma.learningTopic.findFirst({
            where: { id: req.body.topicId, userId: req.user!.userId },
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
        const existing = await prisma.learningItem.findFirst({
            where: { id: req.params.id, userId: req.user!.userId },
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
        const existing = await prisma.learningItem.findFirst({
            where: { id: req.params.id, userId: req.user!.userId },
        });
        if (!existing) throw new NotFoundError('Learning history not found');

        await prisma.learningItem.delete({ where: { id: req.params.id } });
        sendMessage(res, 'Learning history deleted');
    } catch (err) { next(err); }
});

export default router;
