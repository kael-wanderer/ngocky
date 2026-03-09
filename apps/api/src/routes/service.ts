import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate, authorize } from '../middleware/auth';
import { sendSuccess } from '../utils/response';
import { ValidationError } from '../utils/errors';
import { getGoalPeriodEnd, getReminderCutoff, isReminderDue } from '../utils/reminders';

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
            const diff = currentTotalMinutes - (h * 60 + m);
            // One-sided window: fire only when current time is 0–14 min past scheduled time
            if (diff < 0 || diff >= TIME_WINDOW) return false;
            if (report.frequency === 'DAILY') return true;
            if (report.frequency === 'WEEKLY') return currentDay === (report.dayOfWeek ?? 1);
            if (report.frequency === 'MONTHLY') return vnNow.getUTCDate() === (report.dayOfMonth ?? 1);
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
                sections: report.sections ?? [],
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
                sections: report.sections ?? [],
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

        const [goals, projectTasks, tasks, housework, maintenance, calendar] = await Promise.all([
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
            prisma.task.findMany({
                where: { notificationEnabled: true, notificationDate: { gte: windowStart, lte: windowEnd }, status: { not: 'DONE' } },
                include: { user: { select: userSelect } },
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
            ...goals
                .filter((g) => isReminderDue(now, g) && getReminderCutoff(getGoalPeriodEnd(g.currentPeriodStart, g.periodType)) > now)
                .map(g => ({
                    type: 'GOAL',
                    sourceType: 'GOAL',
                    id: g.id,
                    title: g.title,
                    dueDate: getGoalPeriodEnd(g.currentPeriodStart, g.periodType),
                    notificationDate: g.notificationDate,
                    notificationTime: g.notificationTime,
                    user: g.user,
                })),
            ...projectTasks
                .filter((t) => isReminderDue(now, t) && !!t.deadline && getReminderCutoff(t.deadline) > now)
                .map(t => ({
                    type: 'TASK',
                    sourceType: 'PROJECT_TASK',
                    id: t.id,
                    title: t.title,
                    subtitle: t.project.name,
                    dueDate: t.deadline,
                    priority: t.priority,
                    notificationDate: t.notificationDate,
                    notificationTime: t.notificationTime,
                    user: t.createdBy,
                })),
            ...tasks
                .filter((t) => isReminderDue(now, t) && !!t.dueDate && getReminderCutoff(t.dueDate) > now)
                .map(t => ({
                    type: 'TASK',
                    sourceType: 'TASK',
                    id: t.id,
                    title: t.title,
                    dueDate: t.dueDate,
                    notificationDate: t.notificationDate,
                    notificationTime: t.notificationTime,
                    user: t.user,
                })),
            ...housework
                .filter((h) => isReminderDue(now, h) && !!h.nextDueDate && getReminderCutoff(h.nextDueDate) > now)
                .map(h => ({
                    type: 'HOUSEWORK',
                    sourceType: 'HOUSEWORK',
                    id: h.id,
                    title: h.title,
                    dueDate: h.nextDueDate,
                    notificationDate: h.notificationDate,
                    notificationTime: h.notificationTime,
                    user: h.createdBy,
                })),
            ...maintenance
                .filter((m) => isReminderDue(now, m) && !!m.nextRecommendedDate && getReminderCutoff(m.nextRecommendedDate) > now)
                .map(m => ({
                    type: 'MAINTENANCE',
                    sourceType: 'MAINTENANCE',
                    id: m.id,
                    title: m.description,
                    subtitle: m.asset.name,
                    dueDate: m.nextRecommendedDate,
                    notificationDate: m.notificationDate,
                    notificationTime: m.notificationTime,
                    user: m.user,
                })),
            ...calendar
                .filter((e) => isReminderDue(now, e) && getReminderCutoff(e.startDate) > now)
                .map(e => ({
                    type: 'CALENDAR',
                    sourceType: 'CALENDAR',
                    id: e.id,
                    title: e.title,
                    dueDate: e.startDate,
                    location: e.location,
                    allDay: e.allDay,
                    notificationDate: e.notificationDate,
                    notificationTime: e.notificationTime,
                    user: e.createdBy,
                })),
        ];

        sendSuccess(res, notifications);
    } catch (err) { next(err); }
});

router.post('/due-notifications/sent', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { sourceType, id } = req.body as { sourceType?: string; id?: string };
        if (!sourceType || !id) throw new ValidationError('sourceType and id are required');

        const data = { lastNotificationSentAt: new Date() };

        switch (sourceType) {
            case 'GOAL':
                await prisma.goal.update({ where: { id }, data });
                break;
            case 'PROJECT_TASK':
                await prisma.projectTask.update({ where: { id }, data });
                break;
            case 'TASK':
                await prisma.task.update({ where: { id }, data });
                break;
            case 'HOUSEWORK':
                await prisma.houseworkItem.update({ where: { id }, data });
                break;
            case 'MAINTENANCE':
                await prisma.maintenanceRecord.update({ where: { id }, data });
                break;
            case 'CALENDAR':
                await prisma.calendarEvent.update({ where: { id }, data });
                break;
            default:
                throw new ValidationError('Unsupported sourceType');
        }

        sendSuccess(res, { id, sourceType, ...data });
    } catch (err) { next(err); }
});

export default router;
