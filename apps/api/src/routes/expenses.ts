import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createExpenseSchema, updateExpenseSchema } from '../validators/modules';
import { sendSuccess, sendCreated, sendPaginated, sendMessage } from '../utils/response';
import { NotFoundError } from '../utils/errors';

const router = Router();
router.use(authenticate);

// List expenses
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
        const userId = req.query.userId as string;
        const category = req.query.category as string;
        const scope = req.query.scope as string;
        const dateFrom = req.query.dateFrom as string;
        const dateTo = req.query.dateTo as string;

        const where: any = {};
        if (userId) where.userId = userId;
        if (category) where.category = category;
        if (scope) where.scope = scope;
        if (dateFrom || dateTo) {
            where.date = {};
            if (dateFrom) where.date.gte = new Date(dateFrom);
            if (dateTo) where.date.lte = new Date(dateTo);
        }

        const [expenses, total] = await Promise.all([
            prisma.expense.findMany({
                where, skip: (page - 1) * limit, take: limit,
                include: { user: { select: { id: true, name: true } } },
                orderBy: { date: 'desc' },
            }),
            prisma.expense.count({ where }),
        ]);

        sendPaginated(res, expenses, total, page, limit);
    } catch (err) { next(err); }
});

// Create expense
router.post('/', validate(createExpenseSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const expense = await prisma.expense.create({
            data: {
                ...req.body,
                date: new Date(req.body.date),
                userId: req.user!.userId,
            },
            include: { user: { select: { id: true, name: true } } },
        });
        sendCreated(res, expense);
    } catch (err) { next(err); }
});

// Get expense
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const expense = await prisma.expense.findUnique({
            where: { id: req.params.id },
            include: { user: { select: { id: true, name: true } } },
        });
        if (!expense) throw new NotFoundError('Expense');
        sendSuccess(res, expense);
    } catch (err) { next(err); }
});

// Update expense
router.patch('/:id', validate(updateExpenseSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const expense = await prisma.expense.update({
            where: { id: req.params.id },
            data: {
                ...req.body,
                date: req.body.date ? new Date(req.body.date) : undefined,
            },
            include: { user: { select: { id: true, name: true } } },
        });
        sendSuccess(res, expense);
    } catch (err) { next(err); }
});

// Delete expense
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        await prisma.expense.delete({ where: { id: req.params.id } });
        sendMessage(res, 'Expense deleted');
    } catch (err) { next(err); }
});

export default router;
