import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { sendSuccess } from '../utils/response';

const router = Router();
router.use(authenticate);

type TimeRangeKey = 'TODAY' | 'THIS_WEEK' | 'NEXT_WEEK' | 'THIS_MONTH' | 'NEXT_MONTH';
type StatusFilterKey = 'PENDING' | 'COMPLETED' | 'OVERDUE';

function getWeekStart(now: Date): Date {
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
}

function getTimeRange(now: Date, rangeKey: TimeRangeKey) {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const weekStart = getWeekStart(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const nextWeekEnd = new Date(weekEnd);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthAfterNextStart = new Date(now.getFullYear(), now.getMonth() + 2, 1);

    switch (rangeKey) {
        case 'TODAY':
            return { start: todayStart, end: tomorrowStart };
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
        const timeRange = (['TODAY', 'THIS_WEEK', 'NEXT_WEEK', 'THIS_MONTH', 'NEXT_MONTH'].includes(rawRange) ? rawRange : 'THIS_WEEK') as TimeRangeKey;
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
        const visibleGoalWhere = {
            OR: [
                { userId },
                { isShared: true },
            ],
            active: true,
        };
        const visibleExpenseWhere = {
            OR: [
                { userId },
                { isShared: true },
            ],
        };

        const visibleEventWhere = {
            OR: [
                { createdById: userId },
                { isShared: true },
            ],
        };
        const visibleLearningWhere = {
            OR: [
                { userId },
                { topic: { isShared: true } },
            ],
        };
        const visibleAssetRecordWhere = {
            OR: [
                { userId },
                { asset: { isShared: true } },
            ],
        };

        const [
            tasksThisWeek, tasksThisMonth,
            houseworkThisWeek, houseworkThisMonth,
            upcomingEvents, dueTasks,
            dueHousework, learningRecords, expensesInRange, assetRecords,
            overdueHousework, overdueProjects,
            overdueTaskItems, overdueHouseworkItems,
            pinnedGoals, pinnedProjects, pinnedHousework, pinnedBoards, pinnedEvents, pinnedAssets,
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
                where: {
                    ...visibleEventWhere,
                    startDate: { gte: filterStart, lt: filterEnd },
                },
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
            // Learning records in selected range. Records do not participate in status/overdue.
            prisma.learningItem.findMany({
                where: {
                    ...visibleLearningWhere,
                    createdAt: { gte: filterStart, lt: filterEnd },
                },
                orderBy: { createdAt: 'asc' },
                take: 20,
                include: { user: { select: { name: true } }, topic: { select: { title: true } } },
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
            // Asset maintenance records in selected range. Records do not participate in status/overdue.
            prisma.maintenanceRecord.findMany({
                where: {
                    ...visibleAssetRecordWhere,
                    serviceDate: { gte: filterStart, lt: filterEnd },
                },
                orderBy: { serviceDate: 'asc' },
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
            // Pinned goals
            prisma.goal.findMany({
                where: { ...visibleGoalWhere, pinToDashboard: true },
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
                },
                take: 10,
                include: { assignee: { select: { name: true } } },
            }),
            prisma.project.findMany({
                where: {
                    OR: [
                        { ownerId: userId },
                        { isShared: true },
                    ],
                    pinToDashboard: true,
                },
                take: 10,
                include: { _count: { select: { tasks: true } } },
            }),
            prisma.calendarEvent.findMany({
                where: {
                    pinToDashboard: true,
                    OR: [
                        { createdById: userId },
                        { isShared: true },
                    ],
                },
                take: 10,
                include: { createdBy: { select: { name: true } } },
            }),
            prisma.maintenanceRecord.findMany({
                where: {
                    userId,
                    pinToDashboard: true,
                },
                take: 10,
                include: {
                    asset: { select: { name: true } },
                    user: { select: { name: true } },
                },
            }),
            // Active goals for current user
            prisma.goal.findMany({
                where: visibleGoalWhere,
                take: 50,
                include: { _count: { select: { checkIns: true } } },
            }),
        ]);

        const filteredGoals = goals.filter((goal: any) => {
            if (statusFilter === 'COMPLETED') return goal.currentCount >= goal.targetCount;
            if (statusFilter === 'PENDING') return goal.currentCount < goal.targetCount;
            return false;
        }).slice(0, 10);

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
                        sampleTaskTitle: task.title,
                        sampleTaskStatus: task.status,
                    });
                    return acc;
                }
                current.dueTaskCount += 1;
                if (task.deadline && (!current.earliestDeadline || new Date(task.deadline).getTime() < new Date(current.earliestDeadline).getTime())) {
                    current.earliestDeadline = task.deadline;
                    current.sampleTaskTitle = task.title;
                    current.sampleTaskStatus = task.status;
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
                projectId: t.projectId,
                meta: [t.project?.name, t.status, t.assignee?.name].filter(Boolean).join(' · ') || null,
            })),
            ...pinnedHousework.map((h: any) => ({
                id: h.id,
                type: 'HOUSEWORK',
                title: h.title,
                date: h.nextDueDate,
                meta: [h.assignee?.name, h.lastCompletedDate ? 'Completed' : 'Pending'].filter(Boolean).join(' · ') || null,
            })),
            ...pinnedBoards.map((p: any) => ({
                id: p.id,
                type: 'PROJECT',
                title: p.name,
                date: p.updatedAt,
                meta: `${p._count?.tasks || 0} tasks`,
            })),
            ...pinnedEvents.map((e: any) => ({
                id: e.id,
                type: 'CALENDAR',
                title: e.title,
                date: e.startDate,
                meta: e.createdBy?.name || null,
            })),
            ...pinnedAssets.map((a: any) => ({
                id: a.id,
                type: 'ASSET',
                title: a.asset?.name || 'Asset',
                assetId: a.assetId,
                date: a.serviceDate,
                meta: [a.description, a.user?.name].filter(Boolean).join(' · ') || null,
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
                overdueLearning: 0,
                overdueAssets: 0,
                overdueEvents: 0,
                overdueItemsTotal: overdueHousework + overdueProjects,
            },
            upcomingEvents,
            dueTasks,
            dueProjects,
            dueHousework,
            dueLearning: learningRecords,
            expenses: expensesInRange,
            dueAssets: assetRecords,
            overdueItems,
            pinnedGoals,
            pinnedTasks: pinnedProjects,
            pinnedHousework,
            pinnedItems,
            goals: filteredGoals,
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
