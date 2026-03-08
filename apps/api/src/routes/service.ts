import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate, authorize } from '../middleware/auth';
import { sendSuccess } from '../utils/response';

const router = Router();
router.use(authenticate);
router.use(authorize('OWNER', 'ADMIN'));

/**
 * GET /api/service/due-reports
 * Returns all active ScheduledReports due to run within the next 15 minutes.
 * Includes user notification settings for routing.
 * Requires OWNER/ADMIN JWT.
 */
router.get('/due-reports', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const now = new Date();
        // Vietnam = UTC+7
        const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
        const currentDay = vnNow.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        const currentTotalMinutes = vnNow.getUTCHours() * 60 + vnNow.getUTCMinutes();
        const TIME_WINDOW = 15;

        const reports = await prisma.scheduledReport.findMany({
            where: { active: true },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        notificationChannel: true,
                        notificationEmail: true,
                        telegramChatId: true,
                        timezone: true,
                    },
                },
            },
        });

        const due = reports.filter(report => {
            const [h, m] = (report.time || '08:00').split(':').map(Number);
            const diff = Math.abs(currentTotalMinutes - (h * 60 + m));
            if (diff > TIME_WINDOW) return false;
            if (report.frequency === 'DAILY') return true;
            if (report.frequency === 'WEEKLY') return currentDay === (report.dayOfWeek ?? 1);
            return false;
        });

        sendSuccess(res, due);
    } catch (err) { next(err); }
});

/**
 * GET /api/service/report-data/:reportId
 * Returns assembled data for a specific ScheduledReport.
 * Supports WEEKLY_SUMMARY and NEXT_WEEK_TASKS.
 */
router.get('/report-data/:reportId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const report = await prisma.scheduledReport.findUnique({
            where: { id: req.params.reportId },
        });
        if (!report) return res.status(404).json({ message: 'Report not found' });

        const userId = report.userId;
        const now = new Date();

        const userInfo = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, notificationChannel: true, notificationEmail: true, telegramChatId: true },
        });

        // Calculate week boundaries in Vietnam time (UTC+7)
        function getWeekRange(offsetWeeks: number) {
            const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
            const day = vnNow.getUTCDay(); // 0=Sun
            const mondayOffset = day === 0 ? -6 : 1 - day;
            const startVN = new Date(vnNow);
            startVN.setUTCDate(vnNow.getUTCDate() + mondayOffset + offsetWeeks * 7);
            startVN.setUTCHours(0, 0, 0, 0);
            const endVN = new Date(startVN);
            endVN.setUTCDate(startVN.getUTCDate() + 6);
            endVN.setUTCHours(23, 59, 59, 999);
            return {
                start: new Date(startVN.getTime() - 7 * 60 * 60 * 1000),
                end: new Date(endVN.getTime() - 7 * 60 * 60 * 1000),
            };
        }

        if (report.reportType === 'WEEKLY_SUMMARY' || report.reportType === 'SUMMARY') {
            const { start, end } = getWeekRange(0);

            const [goals, tasks, housework, calendar, expenses] = await Promise.all([
                prisma.goal.findMany({
                    where: { userId, active: true },
                    orderBy: { sortOrder: 'asc' },
                }),
                prisma.projectTask.findMany({
                    where: { project: { ownerId: userId }, updatedAt: { gte: start, lte: end } },
                    include: { project: { select: { name: true } } },
                    orderBy: { updatedAt: 'desc' },
                    take: 30,
                }),
                prisma.houseworkItem.findMany({
                    where: { createdById: userId, lastCompletedDate: { gte: start, lte: end } },
                }),
                prisma.calendarEvent.findMany({
                    where: { createdById: userId, startDate: { gte: start, lte: end } },
                    orderBy: { startDate: 'asc' },
                }),
                prisma.expense.findMany({
                    where: { userId, date: { gte: start, lte: end } },
                    orderBy: { date: 'desc' },
                }),
            ]);

            const totalPaid = expenses.filter(e => e.type === 'PAY').reduce((s, e) => s + e.amount, 0);
            const totalReceived = expenses.filter(e => e.type === 'RECEIVE').reduce((s, e) => s + e.amount, 0);

            return sendSuccess(res, {
                reportType: 'WEEKLY_SUMMARY',
                user: userInfo,
                period: { start, end },
                goals: goals.map(g => ({
                    title: g.title,
                    currentCount: g.currentCount,
                    targetCount: g.targetCount,
                    unit: g.unit,
                    periodType: g.periodType,
                    completed: g.currentCount >= g.targetCount,
                })),
                tasks: {
                    done: tasks.filter(t => t.status === 'DONE').map(t => ({ title: t.title, project: t.project.name })),
                    inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').map(t => ({ title: t.title, project: t.project.name, deadline: t.deadline })),
                    total: tasks.length,
                },
                housework: housework.map(h => ({ title: h.title, completedDate: h.lastCompletedDate })),
                calendar: calendar.map(e => ({ title: e.title, startDate: e.startDate, location: e.location, allDay: e.allDay })),
                expenses: {
                    totalPaid: Math.round(totalPaid),
                    totalReceived: Math.round(totalReceived),
                    net: Math.round(totalReceived - totalPaid),
                    count: expenses.length,
                    items: expenses.slice(0, 10).map(e => ({
                        description: e.description,
                        amount: e.amount,
                        type: e.type,
                        category: e.category,
                        date: e.date,
                    })),
                },
            });
        }

        if (report.reportType === 'NEXT_WEEK_TASKS') {
            const { start, end } = getWeekRange(1);

            const [tasks, housework, calendar, goals] = await Promise.all([
                prisma.projectTask.findMany({
                    where: { project: { ownerId: userId }, deadline: { gte: start, lte: end }, status: { not: 'DONE' } },
                    include: { project: { select: { name: true } } },
                    orderBy: [{ deadline: 'asc' }],
                }),
                prisma.houseworkItem.findMany({
                    where: { createdById: userId, nextDueDate: { gte: start, lte: end }, active: true },
                    orderBy: { nextDueDate: 'asc' },
                }),
                prisma.calendarEvent.findMany({
                    where: { createdById: userId, startDate: { gte: start, lte: end } },
                    orderBy: { startDate: 'asc' },
                }),
                prisma.goal.findMany({
                    where: { userId, active: true },
                    orderBy: { sortOrder: 'asc' },
                }),
            ]);

            return sendSuccess(res, {
                reportType: 'NEXT_WEEK_TASKS',
                user: userInfo,
                period: { start, end },
                tasks: tasks.map(t => ({
                    title: t.title,
                    priority: t.priority,
                    project: t.project.name,
                    deadline: t.deadline,
                    status: t.status,
                })),
                housework: housework.map(h => ({ title: h.title, dueDate: h.nextDueDate, frequencyType: h.frequencyType })),
                calendar: calendar.map(e => ({ title: e.title, startDate: e.startDate, location: e.location, allDay: e.allDay })),
                goals: goals.map(g => ({
                    title: g.title,
                    currentCount: g.currentCount,
                    targetCount: g.targetCount,
                    unit: g.unit,
                    periodType: g.periodType,
                    completed: g.currentCount >= g.targetCount,
                })),
            });
        }

        sendSuccess(res, { reportType: report.reportType, message: 'Report type not yet supported' });
    } catch (err) { next(err); }
});

/**
 * GET /api/service/due-notifications
 * Returns all notification-enabled items whose notificationDate falls within the next 15-minute window.
 * Used by n8n to send reminders via Telegram/Email.
 */
router.get('/due-notifications', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const now = new Date();
        const windowStart = new Date(now.getTime() - 60 * 1000);       // -1 min (catch just-passed)
        const windowEnd = new Date(now.getTime() + 14 * 60 * 1000);    // +14 min

        const userSelect = {
            id: true,
            name: true,
            notificationChannel: true,
            notificationEmail: true,
            telegramChatId: true,
        };

        const [goals, tasks, housework, maintenance, calendar] = await Promise.all([
            prisma.goal.findMany({
                where: { notificationEnabled: true, active: true, notificationDate: { gte: windowStart, lte: windowEnd } },
                include: { user: { select: userSelect } },
            }),
            prisma.projectTask.findMany({
                where: { notificationEnabled: true, notificationDate: { gte: windowStart, lte: windowEnd }, status: { not: 'DONE' } },
                include: {
                    project: { select: { name: true } },
                    createdBy: { select: userSelect },
                },
            }),
            prisma.houseworkItem.findMany({
                where: { notificationEnabled: true, active: true, notificationDate: { gte: windowStart, lte: windowEnd } },
                include: { createdBy: { select: userSelect } },
            }),
            prisma.maintenanceRecord.findMany({
                where: { notificationEnabled: true, notificationDate: { gte: windowStart, lte: windowEnd } },
                include: {
                    asset: { select: { name: true } },
                    user: { select: userSelect },
                },
            }),
            prisma.calendarEvent.findMany({
                where: { notificationEnabled: true, notificationDate: { gte: windowStart, lte: windowEnd } },
                include: { createdBy: { select: userSelect } },
            }),
        ]);

        const notifications = [
            ...goals.map(g => ({
                id: g.id,
                type: 'GOAL',
                title: g.title,
                dueDate: null,
                notificationDate: g.notificationDate,
                user: g.user,
            })),
            ...tasks.map(t => ({
                id: t.id,
                type: 'TASK',
                title: t.title,
                subtitle: t.project.name,
                dueDate: t.deadline,
                priority: t.priority,
                notificationDate: t.notificationDate,
                user: t.createdBy,
            })),
            ...housework.map(h => ({
                id: h.id,
                type: 'HOUSEWORK',
                title: h.title,
                dueDate: h.nextDueDate,
                notificationDate: h.notificationDate,
                user: h.createdBy,
            })),
            ...maintenance.map(m => ({
                id: m.id,
                type: 'MAINTENANCE',
                title: m.description,
                subtitle: m.asset.name,
                dueDate: m.nextRecommendedDate,
                notificationDate: m.notificationDate,
                user: m.user,
            })),
            ...calendar.map(e => ({
                id: e.id,
                type: 'CALENDAR',
                title: e.title,
                dueDate: e.startDate,
                location: e.location,
                allDay: e.allDay,
                notificationDate: e.notificationDate,
                user: e.createdBy,
            })),
        ];

        sendSuccess(res, notifications);
    } catch (err) { next(err); }
});

export default router;
