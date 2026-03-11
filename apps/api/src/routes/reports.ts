import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { sendSuccess } from '../utils/response';
import { buildVisibleCalendarEventWhere } from '../utils/calendarVisibility';

const router = Router();
router.use(authenticate);

function getRangeFromPreset(preset?: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const weekStart = new Date(todayStart);
    weekStart.setDate(todayStart.getDate() - (todayStart.getDay() === 0 ? 6 : todayStart.getDay() - 1));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    switch ((preset || '').toUpperCase()) {
        case 'TODAY':
            return { start: todayStart, end: tomorrowStart };
        case 'WEEK':
            return { start: weekStart, end: weekEnd };
        case 'MONTH':
            return { start: monthStart, end: monthEnd };
        default:
            return null;
    }
}

function getDateBounds(req: Request) {
    const preset = req.query.timeRange as string;
    const presetRange = getRangeFromPreset(preset);
    const dateFrom = (req.query.dateFrom as string) || presetRange?.start?.toISOString();
    const dateTo = (req.query.dateTo as string) || presetRange?.end?.toISOString();
    return {
        dateFrom: dateFrom ? new Date(dateFrom) : null,
        dateTo: dateTo ? new Date(dateTo) : null,
    };
}

function buildRangeValue(start: Date | null, end: Date | null) {
    if (!start && !end) return null;
    const range: Record<string, Date> = {};
    if (start) range.gte = start;
    if (end) range.lte = end;
    return range;
}

function buildDateFilter(req: Request, primaryField: string, fallbackField = 'createdAt') {
    const { dateFrom, dateTo } = getDateBounds(req);
    const range = buildRangeValue(dateFrom, dateTo);
    if (!range) return {};
    return {
        OR: [
            { [primaryField]: range },
            {
                AND: [
                    { [primaryField]: null },
                    { [fallbackField]: range },
                ],
            },
        ],
    };
}

function subtractReminderOffset(target: Date, value?: number | null, unit?: string | null) {
    const reminderAt = new Date(target);
    const amount = value && value > 0 ? value : 0;
    if (!amount) return reminderAt;
    switch (unit) {
        case 'MINUTES':
            reminderAt.setMinutes(reminderAt.getMinutes() - amount);
            break;
        case 'HOURS':
            reminderAt.setHours(reminderAt.getHours() - amount);
            break;
        case 'DAYS':
        default:
            reminderAt.setDate(reminderAt.getDate() - amount);
            break;
    }
    return reminderAt;
}

function getGoalPeriodEnd(goal: { currentPeriodStart: Date; periodType: string }) {
    const end = new Date(goal.currentPeriodStart);
    if (goal.periodType === 'MONTHLY') {
        end.setMonth(end.getMonth() + 1);
    } else if (goal.periodType === 'QUARTERLY') {
        end.setMonth(end.getMonth() + 3);
    } else {
        end.setDate(end.getDate() + 7);
    }
    return end;
}

function buildVisibleStandaloneTaskWhere(userId: string) {
    return {
        OR: [
            { userId },
            { isShared: true },
        ],
    };
}

function buildVisibleProjectItemWhere(userId: string) {
    return {
        OR: [
            { project: { ownerId: userId } },
            { project: { isShared: true } },
            { isShared: true },
        ],
    };
}

function buildVisibleAssetWhere(userId: string) {
    return {
        OR: [
            { userId },
            { isShared: true },
        ],
    };
}

router.get('/raw-records', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const module = String(req.query.module || '').toLowerCase();
        const type = req.query.type as string;
        const scope = req.query.scope as string;
        const category = req.query.category as string;

        switch (module) {
            case 'project': {
                const items = await prisma.projectTask.findMany({
                    where: {
                        AND: [
                            buildVisibleProjectItemWhere(userId),
                            buildDateFilter(req, 'deadline'),
                            ...(type ? [{ type: type as any }] : []),
                            ...(category ? [{ category }] : []),
                        ],
                    },
                    include: {
                        project: { select: { name: true } },
                        assignee: { select: { name: true } },
                    },
                    orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
                    take: 200,
                });
                return sendSuccess(res, items.map((item) => ({
                    id: item.id,
                    title: item.title,
                    type: item.type,
                    status: item.status,
                    priority: item.priority,
                    category: item.category,
                    project: item.project.name,
                    assignee: item.assignee?.name || null,
                    deadline: item.deadline,
                    updatedAt: item.updatedAt,
                })));
            }
            case 'tasks': {
                const items = await prisma.task.findMany({
                    where: {
                        AND: [
                            buildVisibleStandaloneTaskWhere(userId),
                            buildDateFilter(req, 'dueDate'),
                            ...(type ? [{ taskType: type as any }] : []),
                        ],
                    },
                    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
                    take: 200,
                });
                return sendSuccess(res, items.map((item) => ({
                    id: item.id,
                    title: item.title,
                    taskType: item.taskType,
                    status: item.status,
                    priority: item.priority,
                    dueDate: item.dueDate,
                    amount: item.amount,
                    expenseCategory: item.expenseCategory,
                    updatedAt: item.updatedAt,
                })));
            }
            case 'goals': {
                const items = await prisma.goal.findMany({
                    where: {
                        active: true,
                        AND: [
                            {
                                OR: [
                                    { userId },
                                    { isShared: true },
                                ],
                            },
                            buildDateFilter(req, 'startDate'),
                        ],
                    },
                    orderBy: { sortOrder: 'asc' },
                    take: 200,
                });
                return sendSuccess(res, items.map((item) => {
                    const periodEnd = getGoalPeriodEnd(item);
                    const completionRate = item.targetCount > 0 ? Math.min(100, Math.round((item.currentCount / item.targetCount) * 100)) : 0;
                    return {
                        id: item.id,
                        title: item.title,
                        periodType: item.periodType,
                        currentCount: item.currentCount,
                        targetCount: item.targetCount,
                        unit: item.unit,
                        active: item.active,
                        periodStart: item.currentPeriodStart,
                        periodEnd,
                        completionRate,
                    };
                }));
            }
            case 'calendar': {
                const items = await prisma.calendarEvent.findMany({
                    where: {
                        AND: [
                            buildVisibleCalendarEventWhere(userId),
                            buildDateFilter(req, 'startDate'),
                            ...(category ? [{ category }] : []),
                        ],
                    },
                    orderBy: { startDate: 'asc' },
                    take: 200,
                });
                return sendSuccess(res, items.map((item) => ({
                    id: item.id,
                    title: item.title,
                    category: item.category,
                    startDate: item.startDate,
                    endDate: item.endDate,
                    allDay: item.allDay,
                    location: item.location,
                    color: item.color,
                })));
            }
            case 'housework': {
                const items = await prisma.houseworkItem.findMany({
                    where: {
                        active: true,
                        AND: [
                            {
                                OR: [
                                    { assigneeId: userId },
                                    { createdById: userId },
                                    { isShared: true },
                                ],
                            },
                            buildDateFilter(req, 'nextDueDate'),
                        ],
                    },
                    include: {
                        assignee: { select: { name: true } },
                    },
                    orderBy: [{ nextDueDate: 'asc' }, { createdAt: 'desc' }],
                    take: 200,
                });
                return sendSuccess(res, items.map((item) => ({
                    id: item.id,
                    title: item.title,
                    frequencyType: item.frequencyType,
                    nextDueDate: item.nextDueDate,
                    lastCompletedDate: item.lastCompletedDate,
                    active: item.active,
                    assignee: item.assignee?.name || null,
                    estimatedCost: item.estimatedCost,
                })));
            }
            case 'expenses': {
                const where: any = {
                    OR: [
                        { userId },
                        { isShared: true },
                    ],
                };
                const { dateFrom, dateTo } = getDateBounds(req);
                if (dateFrom || dateTo) {
                    where.date = {};
                    if (dateFrom) where.date.gte = dateFrom;
                    if (dateTo) where.date.lte = dateTo;
                }
                if (type) where.type = type;
                if (scope) where.scope = scope;
                if (category) where.category = category;

                const items = await prisma.expense.findMany({
                    where,
                    include: { user: { select: { name: true } } },
                    orderBy: { date: 'desc' },
                    take: 200,
                });
                return sendSuccess(res, items.map((item) => ({
                    id: item.id,
                    date: item.date,
                    description: item.description,
                    type: item.type,
                    scope: item.scope,
                    category: item.category,
                    amount: item.amount,
                    user: item.user.name,
                    note: item.note,
                })));
            }
            case 'assets': {
                const items = await prisma.asset.findMany({
                    where: {
                        AND: [
                            buildVisibleAssetWhere(userId),
                            buildDateFilter(req, 'purchaseDate'),
                            ...(type ? [{ type }] : []),
                        ],
                    },
                    include: {
                        _count: { select: { maintenanceRecords: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 200,
                });
                return sendSuccess(res, items.map((item) => ({
                    id: item.id,
                    name: item.name,
                    type: item.type,
                    brand: item.brand,
                    model: item.model,
                    purchaseDate: item.purchaseDate,
                    warrantyMonths: item.warrantyMonths,
                    maintenanceCount: item._count.maintenanceRecords,
                })));
            }
            case 'learning': {
                const items = await prisma.learningItem.findMany({
                    where: {
                        AND: [
                            {
                                OR: [
                                    { userId },
                                    { topic: { isShared: true } },
                                ],
                            },
                            buildDateFilter(req, 'deadline'),
                        ],
                    },
                    include: {
                        topic: { select: { title: true } },
                    },
                    orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
                    take: 200,
                });
                return sendSuccess(res, items.map((item) => ({
                    id: item.id,
                    title: item.title,
                    topic: item.topic?.title || null,
                    status: item.status,
                    progress: item.progress,
                    deadline: item.deadline,
                    target: item.target,
                })));
            }
            case 'ideas': {
                const items = await prisma.idea.findMany({
                    where: {
                        AND: [
                            {
                                OR: [
                                    { userId },
                                    { topic: { isShared: true } },
                                ],
                            },
                            buildDateFilter(req, 'createdAt'),
                        ],
                        ...(category ? { category } : {}),
                    },
                    include: {
                        topic: { select: { title: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 200,
                });
                return sendSuccess(res, items.map((item) => ({
                    id: item.id,
                    title: item.title,
                    topic: item.topic?.title || null,
                    category: item.category,
                    status: item.status,
                    tags: item.tags,
                    createdAt: item.createdAt,
                })));
            }
            default:
                return sendSuccess(res, []);
        }
    } catch (err) { next(err); }
});

// Tasks by status
router.get('/tasks-by-status', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const type = req.query.type as string;
        const result = await prisma.task.groupBy({
            by: ['status'],
            where: {
                AND: [
                    buildVisibleStandaloneTaskWhere(userId),
                    buildDateFilter(req, 'dueDate'),
                    ...(type ? [{ taskType: type as any }] : []),
                ],
            },
            _count: { _all: true },
        });
        sendSuccess(res, result.map((r) => ({ status: r.status, count: r._count._all })));
    } catch (err) { next(err); }
});

router.get('/project-items-by-status', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const type = req.query.type as string;
        const category = req.query.category as string;
        const result = await prisma.projectTask.groupBy({
            by: ['status'],
            where: {
                AND: [
                    buildVisibleProjectItemWhere(userId),
                    buildDateFilter(req, 'deadline'),
                    ...(type ? [{ type: type as any }] : []),
                    ...(category ? [{ category }] : []),
                ],
            },
            _count: { _all: true },
        });
        sendSuccess(res, result.map((r) => ({ status: r.status, count: r._count._all })));
    } catch (err) { next(err); }
});

router.get('/project-items-by-type', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const category = req.query.category as string;
        const result = await prisma.projectTask.groupBy({
            by: ['type'],
            where: {
                AND: [
                    buildVisibleProjectItemWhere(userId),
                    buildDateFilter(req, 'deadline'),
                    ...(category ? [{ category }] : []),
                ],
            },
            _count: { _all: true },
        });
        sendSuccess(res, result.map((r) => ({ type: r.type, count: r._count._all })));
    } catch (err) { next(err); }
});

// Overdue tasks
router.get('/overdue-tasks', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tasks = await prisma.task.findMany({
            where: {
                ...buildVisibleStandaloneTaskWhere(userId),
                dueDate: { lt: todayStart },
                status: { notIn: ['DONE', 'ARCHIVED'] },
            },
            include: { user: { select: { name: true } } },
            orderBy: { dueDate: 'asc' },
        });
        sendSuccess(res, tasks);
    } catch (err) { next(err); }
});

router.get('/calendar-overview', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const category = req.query.category as string;
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);
        const events = await prisma.calendarEvent.findMany({
            where: {
                AND: [
                    buildVisibleCalendarEventWhere(userId),
                    buildDateFilter(req, 'startDate'),
                    ...(category ? [{ category }] : []),
                ],
            },
            select: {
                id: true,
                startDate: true,
                allDay: true,
            },
        });
        const summary = {
            total: events.length,
            today: 0,
            upcoming: 0,
            past: 0,
            allDay: 0,
        };
        events.forEach((event) => {
            if (event.allDay) summary.allDay += 1;
            if (event.startDate >= todayStart && event.startDate < tomorrowStart) summary.today += 1;
            else if (event.startDate >= tomorrowStart) summary.upcoming += 1;
            else summary.past += 1;
        });
        sendSuccess(res, summary);
    } catch (err) { next(err); }
});

router.get('/calendar-by-category', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const events = await prisma.calendarEvent.findMany({
            where: {
                AND: [
                    buildVisibleCalendarEventWhere(userId),
                    buildDateFilter(req, 'startDate'),
                ],
            },
            select: { category: true },
        });
        const grouped = new Map<string, number>();
        events.forEach((event) => {
            const key = event.category || 'General';
            grouped.set(key, (grouped.get(key) || 0) + 1);
        });
        sendSuccess(res, Array.from(grouped.entries()).map(([category, count]) => ({ category, count })));
    } catch (err) { next(err); }
});

router.get('/asset-overview', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const type = req.query.type as string;
        const visibleAssets = buildVisibleAssetWhere(userId);
        const [assets, maintenance] = await Promise.all([
            prisma.asset.findMany({
                where: {
                    AND: [
                        visibleAssets,
                        buildDateFilter(req, 'purchaseDate'),
                        ...(type ? [{ type }] : []),
                    ],
                },
                select: {
                    id: true,
                    type: true,
                    purchaseDate: true,
                    warrantyMonths: true,
                },
            }),
            prisma.maintenanceRecord.findMany({
                where: { asset: visibleAssets },
                select: {
                    cost: true,
                    nextRecommendedDate: true,
                },
            }),
        ]);
        const now = new Date();
        const summary = {
            totalAssets: assets.length,
            withWarranty: assets.filter((asset) => !!asset.warrantyMonths).length,
            upcomingMaintenance: maintenance.filter((record) => record.nextRecommendedDate && record.nextRecommendedDate >= now).length,
            totalMaintenanceCost: maintenance.reduce((sum, record) => sum + (record.cost || 0), 0),
        };
        sendSuccess(res, summary);
    } catch (err) { next(err); }
});

router.get('/assets-by-type', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const assets = await prisma.asset.findMany({
            where: {
                AND: [
                    buildVisibleAssetWhere(userId),
                    buildDateFilter(req, 'purchaseDate'),
                ],
            },
            select: { type: true },
        });
        const grouped = new Map<string, number>();
        assets.forEach((asset) => {
            const key = asset.type || 'Uncategorized';
            grouped.set(key, (grouped.get(key) || 0) + 1);
        });
        sendSuccess(res, Array.from(grouped.entries()).map(([type, count]) => ({ type, count })));
    } catch (err) { next(err); }
});

// Goal completion rates
router.get('/goal-completion', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const goals = await prisma.goal.findMany({
            where: {
                active: true,
                AND: [
                    {
                        OR: [
                            { userId },
                            { isShared: true },
                        ],
                    },
                    buildDateFilter(req, 'startDate'),
                ],
            },
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
router.get('/housework-status', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const where: any = {
            active: true,
            AND: [
                {
                    OR: [
                        { assigneeId: userId },
                        { createdById: userId },
                        { isShared: true },
                    ],
                },
                buildDateFilter(req, 'nextDueDate'),
            ],
        };
        const [total, overdue, completed] = await Promise.all([
            prisma.houseworkItem.count({ where }),
            prisma.houseworkItem.count({ where: { ...where, nextDueDate: { lt: todayStart } } }),
            prisma.houseworkItem.count({ where: { ...where, lastCompletedDate: { not: null } } }),
        ]);
        sendSuccess(res, { total, overdue, completed, onTrack: total - overdue });
    } catch (err) { next(err); }
});

// Learning by status
router.get('/learning-status', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const result = await prisma.learningItem.groupBy({
            by: ['status'],
            where: {
                AND: [
                    {
                        OR: [
                            { userId },
                            { topic: { isShared: true } },
                        ],
                    },
                    buildDateFilter(req, 'deadline'),
                ],
            },
            _count: { _all: true },
        });
        sendSuccess(res, result.map((r) => ({ status: r.status, count: r._count._all })));
    } catch (err) { next(err); }
});

// Learning by topic
router.get('/learning-topics', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const topics = await prisma.learningTopic.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { userId },
                            { isShared: true },
                        ],
                    },
                    buildDateFilter(req, 'createdAt'),
                ],
            },
            include: { _count: { select: { histories: true } } },
            orderBy: { title: 'asc' },
        });
        sendSuccess(res, topics.map((topic) => ({
            topic: topic.title,
            count: topic._count.histories,
        })));
    } catch (err) { next(err); }
});

// Ideas by status
router.get('/ideas-status', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const category = req.query.category as string;
        const result = await prisma.idea.groupBy({
            by: ['status'],
            where: {
                AND: [
                    {
                        OR: [
                            { userId },
                            { topic: { isShared: true } },
                        ],
                    },
                    buildDateFilter(req, 'createdAt'),
                ],
                ...(category ? { category } : {}),
            },
            _count: { _all: true },
        });
        sendSuccess(res, result.map((r) => ({ status: r.status, count: r._count._all })));
    } catch (err) { next(err); }
});

// Ideas by topic
router.get('/idea-topics', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const topics = await prisma.ideaTopic.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { userId },
                            { isShared: true },
                        ],
                    },
                    buildDateFilter(req, 'createdAt'),
                ],
            },
            include: { _count: { select: { logs: true } } },
            orderBy: { title: 'asc' },
        });
        sendSuccess(res, topics.map((topic) => ({
            topic: topic.title,
            count: topic._count.logs,
        })));
    } catch (err) { next(err); }
});

// Expense summary by period/category
router.get('/expense-summary', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const preset = req.query.timeRange as string;
        const presetRange = getRangeFromPreset(preset);
        const dateFrom = (req.query.dateFrom as string) || presetRange?.start?.toISOString();
        const dateTo = (req.query.dateTo as string) || presetRange?.end?.toISOString();
        const groupByField = (req.query.groupBy as string) || 'category';
        const type = req.query.type as string;
        const scope = req.query.scope as string;
        const category = req.query.category as string;

        const where: any = {
            OR: [
                { userId },
                { isShared: true },
            ],
        };
        if (dateFrom || dateTo) {
            where.date = {};
            if (dateFrom) where.date.gte = new Date(dateFrom);
            if (dateTo) where.date.lte = new Date(dateTo);
        }
        if (type) where.type = type;
        if (scope) where.scope = scope;
        if (category) where.category = category;

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
        const [taskCandidates, houseworkCandidates, goalCandidates, calendarCandidates] = await Promise.all([
            prisma.projectTask.findMany({
                where: { deadline: { not: null }, status: { notIn: ['DONE', 'ARCHIVED'] }, notificationEnabled: true },
                select: {
                    id: true,
                    title: true,
                    deadline: true,
                    status: true,
                    notificationEnabled: true,
                    reminderOffsetValue: true,
                    reminderOffsetUnit: true,
                    assignee: { select: { id: true, name: true, notificationChannel: true, notificationEmail: true, telegramChatId: true } },
                },
            }),
            prisma.houseworkItem.findMany({
                where: { nextDueDate: { not: null }, active: true, notificationEnabled: true },
                select: {
                    id: true,
                    title: true,
                    nextDueDate: true,
                    active: true,
                    notificationEnabled: true,
                    reminderOffsetValue: true,
                    reminderOffsetUnit: true,
                    assignee: { select: { id: true, name: true, notificationChannel: true, notificationEmail: true, telegramChatId: true } },
                },
            }),
            prisma.goal.findMany({
                where: { active: true, notificationEnabled: true },
                select: {
                    id: true,
                    title: true,
                    periodType: true,
                    currentPeriodStart: true,
                    notificationEnabled: true,
                    reminderOffsetValue: true,
                    reminderOffsetUnit: true,
                    user: { select: { id: true, name: true, notificationChannel: true, notificationEmail: true, telegramChatId: true } },
                },
            }),
            prisma.calendarEvent.findMany({
                where: { notificationEnabled: true },
                select: {
                    id: true,
                    title: true,
                    startDate: true,
                    notificationEnabled: true,
                    reminderOffsetValue: true,
                    reminderOffsetUnit: true,
                    createdBy: { select: { id: true, name: true, notificationChannel: true, notificationEmail: true, telegramChatId: true } },
                },
            }),
        ]);

        const dueProjectTasks = taskCandidates.filter((item) => item.deadline && subtractReminderOffset(item.deadline, item.reminderOffsetValue, item.reminderOffsetUnit) <= now);
        const dueHousework = houseworkCandidates.filter((item) => item.nextDueDate && subtractReminderOffset(item.nextDueDate, item.reminderOffsetValue, item.reminderOffsetUnit) <= now);
        const dueGoals = goalCandidates.filter((item) => subtractReminderOffset(getGoalPeriodEnd(item), item.reminderOffsetValue, item.reminderOffsetUnit) <= now);
        const dueCalendarEvents = calendarCandidates.filter((item) => subtractReminderOffset(item.startDate, item.reminderOffsetValue, item.reminderOffsetUnit) <= now);

        sendSuccess(res, { dueProjects: dueProjectTasks, dueHousework, dueGoals, dueCalendarEvents });
    } catch (err) { next(err); }
});

export default router;
