import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createStandaloneTaskSchema, updateStandaloneTaskSchema } from '../validators/modules';
import { sendSuccess, sendCreated, sendPaginated, sendMessage } from '../utils/response';
import { NotFoundError } from '../utils/errors';
import { resolveReminderFields } from '../utils/reminders';

const router = Router();
router.use(authenticate);

async function getNextTaskSortOrder(userId: string) {
    const aggregate = await prisma.task.aggregate({
        where: { userId },
        _max: { sortOrder: true },
    });
    return (aggregate._max.sortOrder ?? -1) + 1;
}

function addRepeat(date: Date, repeatFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY') {
    const next = new Date(date);
    if (repeatFrequency === 'DAILY') next.setDate(next.getDate() + 1);
    else if (repeatFrequency === 'WEEKLY') next.setDate(next.getDate() + 7);
    else if (repeatFrequency === 'MONTHLY') next.setMonth(next.getMonth() + 1);
    else next.setMonth(next.getMonth() + 3);
    return next;
}

function endOfDay(date: Date) {
    const next = new Date(date);
    next.setHours(23, 59, 59, 999);
    return next;
}

async function createExpenseFromTask(tx: Prisma.TransactionClient, task: {
    title: string;
    amount?: number | null;
    expenseCategory?: string | null;
    scope?: 'PERSONAL' | 'FAMILY' | 'KEO' | 'PROJECT' | null;
    userId: string;
}, completedAt: Date) {
    if (!task.amount || !task.expenseCategory) return;

    await tx.expense.create({
        data: {
            description: task.title,
            type: 'PAY',
            category: task.expenseCategory,
            date: completedAt,
            amount: task.amount,
            note: 'Automated task item',
            scope: task.scope || 'PERSONAL',
            isShared: false,
            userId: task.userId,
        },
    });
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

router.post('/reorder', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id: unknown): id is string => typeof id === 'string') : [];
        if (ids.length === 0) return sendSuccess(res, []);

        const owned = await prisma.task.findMany({
            where: { id: { in: ids }, userId: req.user!.userId },
            select: { id: true },
        });
        const ownedIds = new Set(owned.map((task: { id: string }) => task.id));
        const orderedIds = ids.filter((id: string) => ownedIds.has(id));

        await Promise.all(orderedIds.map((id: string, index: number) => prisma.task.update({
            where: { id },
            data: { sortOrder: index },
        })));

        sendSuccess(res, orderedIds);
    } catch (err) { next(err); }
});

router.post('/', validate(createStandaloneTaskSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sortOrder = await getNextTaskSortOrder(req.user!.userId);
        const task = await prisma.task.create({
            data: {
                ...req.body,
                ...resolveReminderFields(req.body, {
                    anchorDate: req.body.dueDate,
                    anchorLabel: 'task deadline',
                }),
                amount: req.body.amount ?? null,
                expenseCategory: req.body.expenseCategory ?? null,
                scope: req.body.scope ?? 'PERSONAL',
                dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
                repeatUntil: req.body.repeatUntil ? new Date(req.body.repeatUntil) : null,
                sortOrder,
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
        const reminderFields = resolveReminderFields(
            { ...existing, ...req.body },
            {
                anchorDate: req.body.dueDate === undefined ? existing.dueDate : req.body.dueDate,
                anchorLabel: 'task deadline',
                current: existing,
            },
        );

        const nextStatus = req.body.status ?? existing.status;
        const markingDoneNow = nextStatus === 'DONE' && existing.status !== 'DONE';
        const completedAt = markingDoneNow ? new Date() : req.body.status && req.body.status !== 'DONE' ? null : undefined;
        const nextTaskType = req.body.taskType ?? existing.taskType;
        const shouldCreateExpense = markingDoneNow
            && nextTaskType === 'PAYMENT'
            && (req.body.createExpenseAutomatically ?? existing.createExpenseAutomatically);

        const task = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            if (shouldCreateExpense) {
                await createExpenseFromTask(tx, {
                    title: req.body.title ?? existing.title,
                    amount: req.body.amount === null ? null : req.body.amount ?? existing.amount,
                    expenseCategory: req.body.expenseCategory === null ? null : req.body.expenseCategory ?? existing.expenseCategory,
                    scope: req.body.scope ?? existing.scope,
                    userId: existing.userId,
                }, completedAt as Date);
            }

            return tx.task.update({
                where: { id: req.params.id },
                data: {
                    ...req.body,
                    ...reminderFields,
                    amount: req.body.amount === null ? null : req.body.amount ?? undefined,
                    expenseCategory: req.body.expenseCategory === null ? null : req.body.expenseCategory ?? undefined,
                    scope: req.body.scope ?? undefined,
                    dueDate: req.body.dueDate === null ? null : req.body.dueDate ? new Date(req.body.dueDate) : undefined,
                    repeatUntil: req.body.repeatUntil === null ? null : req.body.repeatUntil ? new Date(req.body.repeatUntil) : undefined,
                    completedAt,
                },
                include: { user: { select: { id: true, name: true } } },
            });
        });
        sendSuccess(res, task);
    } catch (err) { next(err); }
});

router.post('/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
        if (!existing) throw new NotFoundError('Task');
        if (existing.userId !== req.user!.userId) throw new NotFoundError('Task');

        const paymentTask = existing as typeof existing & {
            taskType?: 'TASK' | 'PAYMENT';
            amount?: number | null;
            expenseCategory?: string | null;
            scope?: 'PERSONAL' | 'FAMILY' | 'KEO' | 'PROJECT' | null;
            createExpenseAutomatically?: boolean;
        };

        const completedAt = new Date();
        const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            if (paymentTask.taskType === 'PAYMENT' && paymentTask.createExpenseAutomatically) {
                await createExpenseFromTask(tx, paymentTask, completedAt);
            }

            if (existing.repeatFrequency && existing.dueDate) {
                const nextDueDate = addRepeat(existing.dueDate, existing.repeatFrequency);
                const repeatLimit = existing.repeatEndType === 'ON_DATE' && existing.repeatUntil
                    ? endOfDay(existing.repeatUntil)
                    : null;
                const nextReminderFields = repeatLimit && nextDueDate > repeatLimit
                    ? resolveReminderFields(
                        { ...existing, notificationEnabled: false },
                        {
                            anchorDate: nextDueDate,
                            anchorLabel: 'task deadline',
                            current: existing,
                        },
                    )
                    : resolveReminderFields(
                        { ...existing, dueDate: nextDueDate },
                        {
                            anchorDate: nextDueDate,
                            anchorLabel: 'task deadline',
                            current: existing,
                        },
                    );

                return tx.task.update({
                    where: { id: existing.id },
                    data: repeatLimit && nextDueDate > repeatLimit
                        ? { status: 'DONE', completedAt, ...nextReminderFields }
                        : { dueDate: nextDueDate, status: 'PLANNED', completedAt: null, ...nextReminderFields },
                    include: { user: { select: { id: true, name: true } } },
                });
            }

            return tx.task.update({
                where: { id: existing.id },
                data: {
                    status: 'DONE',
                    completedAt,
                    ...resolveReminderFields(
                        { ...existing, notificationEnabled: false },
                        {
                            anchorDate: existing.dueDate,
                            anchorLabel: 'task deadline',
                            current: existing,
                        },
                    ),
                },
                include: { user: { select: { id: true, name: true } } },
            });
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
