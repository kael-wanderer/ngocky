import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createStandaloneTaskSchema, updateStandaloneTaskSchema } from '../validators/modules';
import { sendSuccess, sendCreated, sendPaginated, sendMessage } from '../utils/response';
import { NotFoundError } from '../utils/errors';

const router = Router();
router.use(authenticate);

function addRepeat(date: Date, repeatFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY') {
    const next = new Date(date);
    if (repeatFrequency === 'DAILY') next.setDate(next.getDate() + 1);
    else if (repeatFrequency === 'WEEKLY') next.setDate(next.getDate() + 7);
    else next.setMonth(next.getMonth() + 1);
    return next;
}

function endOfDay(date: Date) {
    const next = new Date(date);
    next.setHours(23, 59, 59, 999);
    return next;
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
        const userId = req.user!.userId;
        const where: any = {
            OR: [
                { userId },
                { isShared: true },
            ],
        };

        const [tasks, total] = await Promise.all([
            prisma.task.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                include: { user: { select: { id: true, name: true } } },
                orderBy: [
                    { sortOrder: 'asc' },
                    { dueDate: 'asc' },
                    { createdAt: 'desc' },
                ],
            }),
            prisma.task.count({ where }),
        ]);

        sendPaginated(res, tasks, total, page, limit);
    } catch (err) { next(err); }
});

router.post('/', validate(createStandaloneTaskSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const task = await prisma.task.create({
            data: {
                ...req.body,
                dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
                repeatUntil: req.body.repeatUntil ? new Date(req.body.repeatUntil) : null,
                notificationDate: req.body.notificationDate ? new Date(req.body.notificationDate) : null,
                userId: req.user!.userId,
            },
            include: { user: { select: { id: true, name: true } } },
        });
        sendCreated(res, task);
    } catch (err) { next(err); }
});

router.patch('/:id', validate(updateStandaloneTaskSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
        if (!existing) throw new NotFoundError('Task');
        if (existing.userId !== req.user!.userId) throw new NotFoundError('Task');

        const task = await prisma.task.update({
            where: { id: req.params.id },
            data: {
                ...req.body,
                dueDate: req.body.dueDate === null ? null : req.body.dueDate ? new Date(req.body.dueDate) : undefined,
                repeatUntil: req.body.repeatUntil === null ? null : req.body.repeatUntil ? new Date(req.body.repeatUntil) : undefined,
                notificationDate: req.body.notificationDate === null ? null : req.body.notificationDate ? new Date(req.body.notificationDate) : undefined,
                completedAt: req.body.status && req.body.status !== 'DONE' ? null : undefined,
            },
            include: { user: { select: { id: true, name: true } } },
        });
        sendSuccess(res, task);
    } catch (err) { next(err); }
});

router.post('/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
        if (!existing) throw new NotFoundError('Task');
        if (existing.userId !== req.user!.userId) throw new NotFoundError('Task');

        const completedAt = new Date();
        if (existing.repeatFrequency && existing.dueDate) {
            const nextDueDate = addRepeat(existing.dueDate, existing.repeatFrequency);
            const repeatLimit = existing.repeatEndType === 'ON_DATE' && existing.repeatUntil
                ? endOfDay(existing.repeatUntil)
                : null;

            const updated = await prisma.task.update({
                where: { id: existing.id },
                data: repeatLimit && nextDueDate > repeatLimit
                    ? { status: 'DONE', completedAt }
                    : { dueDate: nextDueDate, status: 'PLANNED', completedAt },
                include: { user: { select: { id: true, name: true } } },
            });
            sendSuccess(res, updated);
            return;
        }

        const updated = await prisma.task.update({
            where: { id: existing.id },
            data: { status: 'DONE', completedAt },
            include: { user: { select: { id: true, name: true } } },
        });
        sendSuccess(res, updated);
    } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
        if (!existing) throw new NotFoundError('Task');
        if (existing.userId !== req.user!.userId) throw new NotFoundError('Task');
        await prisma.task.delete({ where: { id: req.params.id } });
        sendMessage(res, 'Task deleted');
    } catch (err) { next(err); }
});

export default router;
