import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { sendSuccess } from '../utils/response';

const router = Router();
router.use(authenticate);

type TimeRangeKey = 'THIS_WEEK' | 'NEXT_WEEK' | 'THIS_MONTH' | 'NEXT_MONTH';
type StatusFilterKey = 'PENDING' | 'COMPLETED' | 'OVERDUE';

function getWeekStart(now: Date): Date {
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
}

function getTimeRange(now: Date, rangeKey: TimeRangeKey) {
    const weekStart = getWeekStart(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const nextWeekEnd = new Date(weekEnd);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthAfterNextStart = new Date(now.getFullYear(), now.getMonth() + 2, 1);

    switch (rangeKey) {
        case 'NEXT_WEEK':
            return { start: weekEnd, end: nextWeekEnd };
        case 'THIS_MONTH':
            return { start: monthStart, end: nextMonthStart };
        case 'NEXT_MONTH':
            return { start: nextMonthStart, end: monthAfterNextStart };
        case 'THIS_WEEK':
        default:
            return { start: weekStart, end: weekEnd };
    }
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const debug = String(req.query.debug || '').toLowerCase() === 'true';
        const userId = req.user!.userId;
        const rawRange = String(req.query.timeRange || 'THIS_WEEK').toUpperCase();
        const rawStatus = String(req.query.status || 'PENDING').toUpperCase();
        const timeRange = (['THIS_WEEK', 'NEXT_WEEK', 'THIS_MONTH', 'NEXT_MONTH'].includes(rawRange) ? rawRange : 'THIS_WEEK') as TimeRangeKey;
        const statusFilter = (['PENDING', 'COMPLETED', 'OVERDUE'].includes(rawStatus) ? rawStatus : 'PENDING') as StatusFilterKey;
        const { start: filterStart, end: filterEnd } = getTimeRange(now, timeRange);

        // Week boundaries (Mon-Sun)
        const weekStart = getWeekStart(now);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        // Month boundaries
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const visibleTaskWhere = {
            OR: [
                { createdById: userId },
                { project: { ownerId: userId } },
                { project: { isShared: true } },
                { isShared: true },
            ],
        };
        const visibleExpenseWhere = {
            OR: [
                { userId },
                { isShared: true },
            ],
        };

        const [
            tasksThisWeek, tasksThisMonth,
            houseworkThisWeek, houseworkThisMonth,
            upcomingEvents, dueTasks,
            dueHousework, dueLearning, expensesInRange, dueAssets,
            overdueHousework, overdueProjects, overdueLearning, overdueAssets, overdueEvents,
            overdueTaskItems, overdueHouseworkItems, overdueLearningItems, overdueAssetItems, overdueEventItems,
            pinnedGoals, pinnedProjects, pinnedHousework,
            goals,
        ] = await Promise.all([
            // Tasks (projects) due this week
            prisma.projectTask.count({
                where: { ...visibleTaskWhere, deadline: { gte: weekStart, lt: weekEnd }, status: { not: 'DONE' } },
            }),
            // Tasks due this month
            prisma.projectTask.count({
                where: { ...visibleTaskWhere, deadline: { gte: monthStart, lt: monthEnd }, status: { not: 'DONE' } },
            }),
            // Housework due this week
            prisma.houseworkItem.count({
                where: { nextDueDate: { gte: weekStart, lt: weekEnd }, active: true },
            }),
            // Housework due this month
            prisma.houseworkItem.count({
                where: { nextDueDate: { gte: monthStart, lt: monthEnd }, active: true },
            }),
            // Upcoming events (next 7 days)
            prisma.calendarEvent.findMany({
                where: statusFilter === 'OVERDUE'
                    ? { startDate: { lt: todayStart } }
                    : statusFilter === 'PENDING'
                        ? { startDate: { gte: filterStart, lt: filterEnd } }
                        : { id: '__none__' },
                orderBy: { startDate: 'asc' },
                take: 10,
                include: { createdBy: { select: { name: true } } },
            }),
            // Project tasks with closest deadlines
            prisma.projectTask.findMany({
                where: {
                    ...visibleTaskWhere,
                    ...(statusFilter === 'OVERDUE'
                        ? {
                            deadline: { lt: todayStart },
                            status: { notIn: ['DONE', 'ARCHIVED'] },
                        }
                        : statusFilter === 'COMPLETED'
                            ? {
                                deadline: { gte: filterStart, lt: filterEnd },
                                status: 'DONE',
                            }
                            : {
                                deadline: { gte: filterStart, lt: filterEnd },
                                status: { notIn: ['DONE', 'ARCHIVED'] },
                            }),
                },
                orderBy: { deadline: 'asc' },
                take: 50,
                include: {
                    assignee: { select: { name: true } },
                    project: { select: { name: true } },
                },
            }),
            // Housework due in selected range
            prisma.houseworkItem.findMany({
                where: statusFilter === 'OVERDUE'
                    ? {
                        nextDueDate: { lt: todayStart },
                        active: true,
                    }
                    : statusFilter === 'COMPLETED'
                        ? {
                            lastCompletedDate: { gte: filterStart, lt: filterEnd },
                        }
                        : {
                            nextDueDate: { gte: filterStart, lt: filterEnd },
                            active: true,
                        },
                orderBy: statusFilter === 'COMPLETED' ? { lastCompletedDate: 'desc' } : { nextDueDate: 'asc' },
                take: 10,
                include: { assignee: { select: { name: true } } },
            }),
            // Learning items due in selected range
            prisma.learningItem.findMany({
                where: statusFilter === 'OVERDUE'
                    ? {
                        userId,
                        deadline: { lt: todayStart },
                        status: { notIn: ['DONE', 'ARCHIVED'] },
                    }
                    : statusFilter === 'COMPLETED'
                        ? {
                            userId,
                            deadline: { gte: filterStart, lt: filterEnd },
                            status: 'DONE',
                        }
                        : {
                            userId,
                            deadline: { gte: filterStart, lt: filterEnd },
                            status: { notIn: ['DONE', 'ARCHIVED'] },
                        },
                orderBy: { deadline: 'asc' },
                take: 20,
                include: { user: { select: { name: true } } },
            }),
            // Expenses in selected range
            prisma.expense.findMany({
                where: statusFilter === 'OVERDUE'
                    ? { id: '__none__' }
                    : { ...visibleExpenseWhere, date: { gte: filterStart, lt: filterEnd } },
                orderBy: { date: 'asc' },
                take: 20,
                include: { user: { select: { name: true } } },
            }),
            // Asset maintenance due in selected range
            prisma.maintenanceRecord.findMany({
                where: statusFilter === 'OVERDUE'
                    ? { nextRecommendedDate: { lt: todayStart } }
                    : statusFilter === 'PENDING'
                        ? { nextRecommendedDate: { gte: filterStart, lt: filterEnd } }
                        : { id: '__none__' },
                orderBy: { nextRecommendedDate: 'asc' },
                take: 20,
                include: {
                    asset: { select: { name: true } },
                    user: { select: { name: true } },
                },
            }),
            // Overdue housework
            prisma.houseworkItem.count({
                where: { nextDueDate: { lt: todayStart }, active: true },
            }),
            // Overdue tasks
            prisma.projectTask.count({
                where: { ...visibleTaskWhere, deadline: { lt: todayStart }, status: { notIn: ['DONE', 'ARCHIVED'] } },
            }),
            // Overdue learning
            prisma.learningItem.count({
                where: { userId, deadline: { lt: todayStart }, status: { notIn: ['DONE', 'ARCHIVED'] } },
            }),
            // Overdue asset maintenance
            prisma.maintenanceRecord.count({
                where: { nextRecommendedDate: { lt: todayStart } },
            }),
            // Overdue calendar events (missed start)
            prisma.calendarEvent.count({
                where: { startDate: { lt: todayStart } },
            }),
            // Overdue task items
            prisma.projectTask.findMany({
                where: { ...visibleTaskWhere, deadline: { lt: todayStart }, status: { notIn: ['DONE', 'ARCHIVED'] } },
                orderBy: { deadline: 'asc' },
                take: 20,
                include: {
                    assignee: { select: { name: true } },
                    project: { select: { name: true } },
                },
            }),
            // Overdue housework items
            prisma.houseworkItem.findMany({
                where: { nextDueDate: { lt: todayStart }, active: true },
                orderBy: { nextDueDate: 'asc' },
                take: 20,
                include: { assignee: { select: { name: true } } },
            }),
            // Overdue learning items
            prisma.learningItem.findMany({
                where: { userId, deadline: { lt: todayStart }, status: { notIn: ['DONE', 'ARCHIVED'] } },
                orderBy: { deadline: 'asc' },
                take: 20,
                include: { user: { select: { name: true } } },
            }),
            // Overdue asset maintenance items
            prisma.maintenanceRecord.findMany({
                where: { nextRecommendedDate: { lt: todayStart } },
                orderBy: { nextRecommendedDate: 'asc' },
                take: 20,
                include: {
                    asset: { select: { name: true } },
                    user: { select: { name: true } },
                },
            }),
            // Overdue calendar events
            prisma.calendarEvent.findMany({
                where: { startDate: { lt: todayStart } },
                orderBy: { startDate: 'asc' },
                take: 20,
                include: { createdBy: { select: { name: true } } },
            }),
            // Pinned goals
            prisma.goal.findMany({
                where: { pinToDashboard: true, active: true, startDate: { gte: filterStart, lt: filterEnd } },
                take: 10,
                include: { user: { select: { name: true } } },
            }),
            // Pinned tasks
            prisma.projectTask.findMany({
                where: {
                    ...visibleTaskWhere,
                    pinToDashboard: true,
                    status: { notIn: ['DONE', 'ARCHIVED'] },
                    deadline: { gte: filterStart, lt: filterEnd },
                },
                take: 10,
                include: {
                    assignee: { select: { name: true } },
                    project: { select: { name: true } },
                },
            }),
            // Pinned housework
            prisma.houseworkItem.findMany({
                where: {
                    pinToDashboard: true,
                    active: true,
                    nextDueDate: { gte: filterStart, lt: filterEnd },
                },
                take: 10,
                include: { assignee: { select: { name: true } } },
            }),
            // Active goals for current user
            prisma.goal.findMany({
                where: { userId, active: true, startDate: { gte: filterStart, lt: filterEnd } },
                take: 10,
                include: { _count: { select: { checkIns: true } } },
            }),
        ]);

        const dueProjects = Array.from(
            dueTasks.reduce((acc: Map<string, any>, task: any) => {
                const key = task.projectId;
                const current = acc.get(key);
                if (!current) {
                    acc.set(key, {
                        id: key,
                        name: task.project?.name || 'Project',
                        earliestDeadline: task.deadline,
                        dueTaskCount: 1,
                    });
                    return acc;
                }
                current.dueTaskCount += 1;
                if (task.deadline && (!current.earliestDeadline || new Date(task.deadline).getTime() < new Date(current.earliestDeadline).getTime())) {
                    current.earliestDeadline = task.deadline;
                }
                return acc;
            }, new Map<string, any>()).values()
        ).sort((a: any, b: any) => {
            const ta = a.earliestDeadline ? new Date(a.earliestDeadline).getTime() : Number.MAX_SAFE_INTEGER;
            const tb = b.earliestDeadline ? new Date(b.earliestDeadline).getTime() : Number.MAX_SAFE_INTEGER;
            return ta - tb;
        }).slice(0, 10);

        const pinnedItems = [
            ...pinnedGoals.map((g: any) => ({
                id: g.id,
                type: 'GOAL',
                title: g.title,
                date: g.startDate,
                meta: g.user?.name || null,
            })),
            ...pinnedProjects.map((t: any) => ({
                id: t.id,
                type: 'TASK',
                title: t.title,
                date: t.deadline,
                meta: [t.project?.name, t.assignee?.name].filter(Boolean).join(' · ') || null,
            })),
            ...pinnedHousework.map((h: any) => ({
                id: h.id,
                type: 'HOUSEWORK',
                title: h.title,
                date: h.nextDueDate,
                meta: h.assignee?.name || null,
            })),
        ].sort((a, b) => {
            const ta = a.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER;
            const tb = b.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER;
            return ta - tb;
        });

        const overdueItems = [
            ...overdueTaskItems.map((t: any) => ({
                id: t.id,
                type: 'PROJECT',
                title: t.title,
                date: t.deadline,
                meta: [t.project?.name, t.assignee?.name].filter(Boolean).join(' · ') || null,
            })),
            ...overdueHouseworkItems.map((h: any) => ({
                id: h.id,
                type: 'HOUSEWORK',
                title: h.title,
                date: h.nextDueDate,
                meta: h.assignee?.name || null,
            })),
            ...overdueLearningItems.map((l: any) => ({
                id: l.id,
                type: 'LEARNING',
                title: l.title,
                date: l.deadline,
                meta: l.user?.name || null,
            })),
            ...overdueAssetItems.map((a: any) => ({
                id: a.id,
                type: 'ASSET',
                title: a.asset?.name || 'Asset',
                date: a.nextRecommendedDate,
                meta: [a.description, a.user?.name].filter(Boolean).join(' · ') || null,
            })),
            ...overdueEventItems.map((e: any) => ({
                id: e.id,
                type: 'CALENDAR',
                title: e.title,
                date: e.startDate,
                meta: e.createdBy?.name || null,
            })),
        ].sort((a, b) => {
            const ta = a.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER;
            const tb = b.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER;
            return ta - tb;
        });

        const payload: any = {
            timeRange,
            statusFilter,
            filterStart,
            filterEnd,
            summary: {
                tasksThisWeek,
                tasksThisMonth,
                houseworkThisWeek,
                houseworkThisMonth,
                upcomingEventsCount: upcomingEvents.length,
                overdueHousework,
                overdueTasks: overdueProjects,
                overdueLearning,
                overdueAssets,
                overdueEvents,
                overdueItemsTotal: overdueHousework + overdueProjects + overdueLearning + overdueAssets + overdueEvents,
            },
            upcomingEvents,
            dueTasks,
            dueProjects,
            dueHousework,
            dueLearning,
            expenses: expensesInRange,
            dueAssets,
            overdueItems,
            pinnedGoals,
            pinnedTasks: pinnedProjects,
            pinnedHousework,
            pinnedItems,
            goals,
        };

        if (debug) {
            payload.debug = {
                serverNow: now.toISOString(),
                serverTodayStart: todayStart.toISOString(),
                timezoneOffsetMinutes: now.getTimezoneOffset(),
                dueTaskDeadlines: dueTasks.slice(0, 10).map((t: any) => ({
                    id: t.id,
                    title: t.title,
                    deadline: t.deadline ? new Date(t.deadline).toISOString() : null,
                    classifiedAsOverdue: !!(t.deadline && new Date(t.deadline) < todayStart),
                })),
                overdueTaskDeadlines: overdueTaskItems.slice(0, 10).map((t: any) => ({
                    id: t.id,
                    title: t.title,
                    deadline: t.deadline ? new Date(t.deadline).toISOString() : null,
                    classifiedAsOverdue: !!(t.deadline && new Date(t.deadline) < todayStart),
                })),
            };
        }

        sendSuccess(res, payload);
    } catch (err) { next(err); }
});

export default router;
