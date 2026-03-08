import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { sendSuccess } from '../utils/response';

const router = Router();
router.use(authenticate);

// Tasks by status
router.get('/tasks-by-status', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await prisma.projectTask.groupBy({
            by: ['status'],
            _count: { id: true },
        });
        sendSuccess(res, result.map((r) => ({ status: r.status, count: r._count.id })));
    } catch (err) { next(err); }
});

// Overdue tasks
router.get('/overdue-tasks', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tasks = await prisma.projectTask.findMany({
            where: { deadline: { lt: todayStart }, status: { notIn: ['DONE', 'ARCHIVED'] } },
            include: { assignee: { select: { name: true } } },
            orderBy: { deadline: 'asc' },
        });
        sendSuccess(res, tasks);
    } catch (err) { next(err); }
});

// Goal completion rates
router.get('/goal-completion', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const goals = await prisma.goal.findMany({
            where: { active: true },
            select: { id: true, title: true, targetCount: true, currentCount: true, periodType: true, userId: true },
            orderBy: { title: 'asc' },
        });
        const data = goals.map((g) => ({
            ...g,
            completionRate: g.targetCount > 0 ? Math.min(100, Math.round((g.currentCount / g.targetCount) * 100)) : 0,
        }));
        sendSuccess(res, data);
    } catch (err) { next(err); }
});

// Housework completion/overdue
router.get('/housework-status', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const [total, overdue, completed] = await Promise.all([
            prisma.houseworkItem.count({ where: { active: true } }),
            prisma.houseworkItem.count({ where: { active: true, nextDueDate: { lt: todayStart } } }),
            prisma.houseworkItem.count({ where: { active: true, lastCompletedDate: { not: null } } }),
        ]);
        sendSuccess(res, { total, overdue, completed, onTrack: total - overdue });
    } catch (err) { next(err); }
});

// Expense summary by period/category
router.get('/expense-summary', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const dateFrom = req.query.dateFrom as string;
        const dateTo = req.query.dateTo as string;
        const groupByField = (req.query.groupBy as string) || 'category';

        const where: any = {};
        if (dateFrom || dateTo) {
            where.date = {};
            if (dateFrom) where.date.gte = new Date(dateFrom);
            if (dateTo) where.date.lte = new Date(dateTo);
        }

        if (groupByField === 'category') {
            const result = await prisma.expense.groupBy({
                by: ['category'],
                where,
                _sum: { amount: true },
                _count: { id: true },
            });
            sendSuccess(res, result.map((r) => ({
                category: r.category || 'Uncategorized',
                total: r._sum.amount || 0,
                count: r._count.id,
            })));
        } else if (groupByField === 'user') {
            const result = await prisma.expense.groupBy({
                by: ['userId'],
                where,
                _sum: { amount: true },
                _count: { id: true },
            });
            const users = await prisma.user.findMany({
                where: { id: { in: result.map((r) => r.userId) } },
                select: { id: true, name: true },
            });
            const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));
            sendSuccess(res, result.map((r) => ({
                user: userMap[r.userId] || 'Unknown',
                total: r._sum.amount || 0,
                count: r._count.id,
            })));
        } else {
            // Monthly trend
            const expenses = await prisma.expense.findMany({ where, orderBy: { date: 'asc' } });
            const monthly: Record<string, number> = {};
            expenses.forEach((e) => {
                const key = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, '0')}`;
                monthly[key] = (monthly[key] || 0) + e.amount;
            });
            sendSuccess(res, Object.entries(monthly).map(([month, total]) => ({ month, total })));
        }
    } catch (err) { next(err); }
});

// CSV export for tasks
router.get('/export/tasks', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const tasks = await prisma.projectTask.findMany({
            include: { assignee: { select: { name: true } }, createdBy: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
        });

        const header = 'Title,Status,Priority,Assignee,Deadline,Created\n';
        const rows = tasks.map((t) =>
            `"${t.title}","${t.status}","${t.priority}","${t.assignee?.name || ''}","${t.deadline?.toISOString() || ''}","${t.createdAt.toISOString()}"`
        ).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="tasks.csv"');
        res.send(header + rows);
    } catch (err) { next(err); }
});

// CSV export for expenses
router.get('/export/expenses', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const dateFrom = req.query.dateFrom as string;
        const dateTo = req.query.dateTo as string;
        const where: any = {};
        if (dateFrom || dateTo) {
            where.date = {};
            if (dateFrom) where.date.gte = new Date(dateFrom);
            if (dateTo) where.date.lte = new Date(dateTo);
        }

        const expenses = await prisma.expense.findMany({
            where,
            include: { user: { select: { name: true } } },
            orderBy: { date: 'desc' },
        });

        const header = 'Date,Description,Amount,Category,Scope,User\n';
        const rows = expenses.map((e) =>
            `"${e.date.toISOString()}","${e.description}","${e.amount}","${e.category || ''}","${e.scope}","${e.user.name}"`
        ).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="expenses.csv"');
        res.send(header + rows);
    } catch (err) { next(err); }
});

// Notification API for n8n: due items needing notification
router.get('/notifications/due-items', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const [dueProjectTasks, dueHousework, dueGoals] = await Promise.all([
            prisma.projectTask.findMany({
                where: { deadline: { lte: tomorrow }, status: { notIn: ['DONE', 'ARCHIVED'] }, notificationEnabled: true },
                include: { assignee: { select: { id: true, name: true, notificationChannel: true, notificationEmail: true, telegramChatId: true } } },
            }),
            prisma.houseworkItem.findMany({
                where: { nextDueDate: { lte: tomorrow }, active: true, notificationEnabled: true },
                include: { assignee: { select: { id: true, name: true, notificationChannel: true, notificationEmail: true, telegramChatId: true } } },
            }),
            prisma.goal.findMany({
                where: { active: true, notificationEnabled: true },
                include: { user: { select: { id: true, name: true, notificationChannel: true, notificationEmail: true, telegramChatId: true } } },
            }),
        ]);

        sendSuccess(res, { dueProjects: dueProjectTasks, dueHousework, dueGoals });
    } catch (err) { next(err); }
});

export default router;
