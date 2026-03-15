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
            if (report.frequency === 'ONE_TIME') return true;
            if (report.frequency === 'DAILY') return true;
            if (report.frequency === 'WEEKDAY') return currentDay >= 1 && currentDay <= 5; // Mon–Fri
            if (report.frequency === 'WEEKEND') return currentDay === 0 || currentDay === 6; // Sun or Sat
            if (report.frequency === 'WEEKLY') return currentDay === (report.dayOfWeek ?? 1);
            if (report.frequency === 'MONTHLY') return vnNow.getUTCDate() === (report.dayOfMonth ?? 1);
            if (report.frequency === 'QUARTERLY') {
                const month = vnNow.getUTCMonth();
                return month % 3 === 0 && vnNow.getUTCDate() === (report.dayOfMonth ?? 1);
            }
            return false;
        });

        const oneTimeIds = due
            .filter(report => report.frequency === 'ONE_TIME')
            .map(report => report.id);

        if (oneTimeIds.length > 0) {
            await prisma.scheduledReport.updateMany({
                where: { id: { in: oneTimeIds } },
                data: { active: false },
            });
            due.forEach((report) => {
                if (oneTimeIds.includes(report.id)) {
                    report.active = false;
                }
            });
        }

        sendSuccess(res, due);
    } catch (err) { next(err); }
});

/**
 * GET /api/service/report-data/:reportId
 * Returns assembled data for a specific ScheduledReport.
 * Supports WEEKLY_SUMMARY, NEXT_WEEK_TASKS, TODAY_TASKS, and TOMORROW_TASKS.
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

        function getDayRange(offsetDays: number) {
            const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
            const startVN = new Date(vnNow);
            startVN.setUTCDate(vnNow.getUTCDate() + offsetDays);
            startVN.setUTCHours(0, 0, 0, 0);
            const endVN = new Date(startVN);
            endVN.setUTCHours(23, 59, 59, 999);
            return {
                start: new Date(startVN.getTime() - 7 * 60 * 60 * 1000),
                end: new Date(endVN.getTime() - 7 * 60 * 60 * 1000),
            };
        }

        if (report.reportType === 'WEEKLY_SUMMARY' || report.reportType === 'SUMMARY') {
            const { start, end } = getWeekRange(0);

            const [goals, projectTasks, standaloneTasks, housework, calendar, expenses, assets, learning, ideas] = await Promise.all([
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
                prisma.task.findMany({
                    where: { userId, updatedAt: { gte: start, lte: end } },
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
                prisma.maintenanceRecord.findMany({
                    where: { userId, serviceDate: { gte: start, lte: end } },
                    include: { asset: { select: { name: true } } },
                    orderBy: { serviceDate: 'desc' },
                    take: 20,
                }),
                prisma.learningItem.findMany({
                    where: { userId, updatedAt: { gte: start, lte: end } },
                    include: { topic: { select: { title: true } } },
                    orderBy: { updatedAt: 'desc' },
                    take: 20,
                }),
                prisma.idea.findMany({
                    where: { userId, updatedAt: { gte: start, lte: end } },
                    orderBy: { updatedAt: 'desc' },
                    take: 20,
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
                project: {
                    done: projectTasks.filter(t => t.status === 'DONE').map(t => ({ title: t.title, project: t.project.name, deadline: t.deadline })),
                    inProgress: projectTasks.filter(t => t.status === 'IN_PROGRESS').map(t => ({ title: t.title, project: t.project.name, deadline: t.deadline })),
                    total: projectTasks.length,
                },
                tasks: {
                    done: standaloneTasks.filter(t => t.status === 'DONE').map(t => ({ title: t.title, dueDate: t.dueDate })),
                    inProgress: standaloneTasks.filter(t => t.status === 'IN_PROGRESS').map(t => ({ title: t.title, dueDate: t.dueDate })),
                    total: standaloneTasks.length,
                },
                housework: housework.map(h => ({ title: h.title, completedDate: h.lastCompletedDate })),
                calendar: calendar.map(e => ({ title: e.title, startDate: e.startDate, location: e.location, allDay: e.allDay })),
                assets: assets.map(a => ({
                    asset: a.asset.name,
                    serviceType: a.serviceType,
                    description: a.description,
                    serviceDate: a.serviceDate,
                    cost: a.cost,
                })),
                learning: learning.map(l => ({
                    title: l.title,
                    topic: l.topic?.title || null,
                    status: l.status,
                    progress: l.progress,
                    deadline: l.deadline,
                })),
                ideas: ideas.map(i => ({
                    title: i.title,
                    category: i.category,
                    status: i.status,
                    updatedAt: i.updatedAt,
                })),
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

        if (report.reportType === 'NEXT_WEEK_TASKS' || report.reportType === 'TODAY_TASKS' || report.reportType === 'TOMORROW_TASKS') {
            const { start, end } = report.reportType === 'TODAY_TASKS'
                ? getDayRange(0)
                : report.reportType === 'TOMORROW_TASKS'
                    ? getDayRange(1)
                    : getWeekRange(1);

            const [goals, project, tasks, housework, calendar] = await Promise.all([
                prisma.goal.findMany({
                    where: { userId, active: true },
                    orderBy: { sortOrder: 'asc' },
                }),
                prisma.projectTask.findMany({
                    where: { project: { ownerId: userId }, deadline: { gte: start, lte: end }, status: { not: 'DONE' } },
                    include: { project: { select: { name: true } } },
                    orderBy: [{ deadline: 'asc' }],
                }),
                prisma.task.findMany({
                    where: { userId, dueDate: { gte: start, lte: end }, status: { notIn: ['DONE', 'ARCHIVED'] } },
                    orderBy: [{ dueDate: 'asc' }],
                }),
                prisma.houseworkItem.findMany({
                    where: { createdById: userId, nextDueDate: { gte: start, lte: end }, active: true },
                    orderBy: { nextDueDate: 'asc' },
                }),
                prisma.calendarEvent.findMany({
                    where: { createdById: userId, startDate: { gte: start, lte: end } },
                    orderBy: { startDate: 'asc' },
                }),
            ]);

            return sendSuccess(res, {
                reportType: report.reportType,
                sections: report.sections ?? [],
                user: userInfo,
                period: { start, end },
                goals: goals
                    .map((goal) => {
                        const periodEnd = getGoalPeriodEnd(goal.currentPeriodStart, goal.periodType);
                        return {
                            title: goal.title,
                            currentCount: goal.currentCount,
                            targetCount: goal.targetCount,
                            unit: goal.unit,
                            periodType: goal.periodType,
                            dueDate: periodEnd,
                            completed: goal.currentCount >= goal.targetCount,
                        };
                    })
                    .filter((goal) => {
                        if (report.reportType === 'TODAY_TASKS' || report.reportType === 'TOMORROW_TASKS') {
                            return !goal.completed;
                        }
                        return goal.dueDate >= start && goal.dueDate <= end;
                    }),
                project: project.map(t => ({
                    title: t.title,
                    priority: t.priority,
                    type: t.type,
                    project: t.project.name,
                    deadline: t.deadline,
                    status: t.status,
                })),
                tasks: tasks.map(t => ({
                    title: t.title,
                    priority: t.priority,
                    dueDate: t.dueDate,
                    status: t.status,
                })),
                housework: housework.map(h => ({ title: h.title, dueDate: h.nextDueDate, frequencyType: h.frequencyType })),
                calendar: calendar.map(e => ({ title: e.title, startDate: e.startDate, location: e.location, allDay: e.allDay })),
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
            email: true,
            notificationChannel: true,
            notificationEmail: true,
            telegramChatId: true,
        };

        const [goals, projectTasks, tasks, housework, maintenance, calendar, alertRules] = await Promise.all([
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
            prisma.alertRule.findMany({
                where: { active: true },
                include: { user: { select: userSelect } },
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

        const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
        const currentDay = vnNow.getUTCDay();
        const currentTotalMinutes = vnNow.getUTCHours() * 60 + vnNow.getUTCMinutes();
        const TIME_WINDOW = 15;
        const firedRuleIds = new Set<string>();

        const isSameVietnamDate = (left: Date, right: Date) => {
            const leftVn = new Date(left.getTime() + 7 * 60 * 60 * 1000);
            const rightVn = new Date(right.getTime() + 7 * 60 * 60 * 1000);

            return leftVn.getUTCFullYear() === rightVn.getUTCFullYear()
                && leftVn.getUTCMonth() === rightVn.getUTCMonth()
                && leftVn.getUTCDate() === rightVn.getUTCDate();
        };

        const isAlertRuleDue = (rule: { time: string | null; frequency: string; dayOfWeek: number | null; dayOfMonth: number | null; lastSentAt: Date | null }) => {
            const [h, m] = (rule.time || '08:00').split(':').map(Number);
            const diff = currentTotalMinutes - (h * 60 + m);
            if (diff < 0 || diff >= TIME_WINDOW) return false;
            if (rule.lastSentAt && isSameVietnamDate(rule.lastSentAt, now)) return false;
            if (rule.frequency === 'DAILY') return true;
            if (rule.frequency === 'WEEKLY') return currentDay === (rule.dayOfWeek ?? 1);
            if (rule.frequency === 'MONTHLY') return vnNow.getUTCDate() === (rule.dayOfMonth ?? 1);
            return false;
        };

        const activeGoals = await prisma.goal.findMany({
            where: { active: true },
            include: { user: { select: userSelect } },
        });
        const standaloneTasks = await prisma.task.findMany({
            where: { status: { notIn: ['DONE', 'ARCHIVED'] } },
            include: { user: { select: userSelect } },
        });
        const allCalendarEvents = await prisma.calendarEvent.findMany({
            include: { createdBy: { select: userSelect } },
        });
        const activeHousework = await prisma.houseworkItem.findMany({
            where: { active: true },
            include: { createdBy: { select: userSelect } },
        });
        const upcomingMaintenance = await prisma.maintenanceRecord.findMany({
            where: { nextRecommendedDate: { not: null } },
            include: {
                asset: { select: { name: true } },
                user: { select: userSelect },
            },
        });
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(todayStart);
        todayEnd.setHours(23, 59, 59, 999);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        for (const rule of alertRules) {
            if (!isAlertRuleDue(rule)) continue;

            if (rule.moduleType === 'GOAL' && rule.conditionType === 'PROGRESS_BELOW') {
                const threshold = Number(rule.conditionValue ?? 0);
                const matches = activeGoals.filter((goal) => {
                    if (goal.userId !== rule.userId || goal.targetCount <= 0) return false;
                    const progress = (goal.currentCount / goal.targetCount) * 100;
                    return progress < threshold;
                });

                matches.forEach((goal) => {
                    const progress = Math.round((goal.currentCount / goal.targetCount) * 100);
                    notifications.push({
                        type: 'GOAL',
                        sourceType: 'ALERT_RULE',
                        id: `${rule.id}:${goal.id}`,
                        ruleId: rule.id,
                        title: goal.title,
                        subtitle: `${rule.name}: ${progress}% < ${threshold}%`,
                        dueDate: getGoalPeriodEnd(goal.currentPeriodStart, goal.periodType),
                        user: rule.user,
                    } as any);
                });
                if (matches.length > 0) firedRuleIds.add(rule.id);
            }

            if (rule.moduleType === 'TASK' && (rule.conditionType === 'OVERDUE' || rule.conditionType === 'DUE_TODAY')) {
                const matches = standaloneTasks.filter((task) => {
                    if (task.userId !== rule.userId || !task.dueDate) return false;
                    if (rule.conditionType === 'OVERDUE') return task.dueDate < todayStart;
                    return task.dueDate >= todayStart && task.dueDate <= todayEnd;
                });

                matches.forEach((task) => {
                    notifications.push({
                        type: 'TASK',
                        sourceType: 'ALERT_RULE',
                        id: `${rule.id}:${task.id}`,
                        ruleId: rule.id,
                        title: task.title,
                        subtitle: rule.name,
                        dueDate: task.dueDate,
                        priority: task.priority,
                        user: rule.user,
                    } as any);
                });
                if (matches.length > 0) firedRuleIds.add(rule.id);
            }

            if (rule.moduleType === 'HOUSEWORK' && (rule.conditionType === 'OVERDUE' || rule.conditionType === 'DUE_TODAY')) {
                const matches = activeHousework.filter((item) => {
                    if (item.createdById !== rule.userId || !item.nextDueDate) return false;
                    if (rule.conditionType === 'OVERDUE') return item.nextDueDate < todayStart;
                    return item.nextDueDate >= todayStart && item.nextDueDate <= todayEnd;
                });

                matches.forEach((item) => {
                    notifications.push({
                        type: 'HOUSEWORK',
                        sourceType: 'ALERT_RULE',
                        id: `${rule.id}:${item.id}`,
                        ruleId: rule.id,
                        title: item.title,
                        subtitle: rule.name,
                        dueDate: item.nextDueDate,
                        user: rule.user,
                    } as any);
                });
                if (matches.length > 0) firedRuleIds.add(rule.id);
            }

            if (rule.moduleType === 'CALENDAR' && rule.conditionType === 'DUE_TODAY') {
                const matches = allCalendarEvents.filter((event) => {
                    if (event.createdById !== rule.userId) return false;
                    return event.startDate >= todayStart && event.startDate <= todayEnd;
                });

                matches.forEach((event) => {
                    notifications.push({
                        type: 'CALENDAR',
                        sourceType: 'ALERT_RULE',
                        id: `${rule.id}:${event.id}`,
                        ruleId: rule.id,
                        title: event.title,
                        subtitle: rule.name,
                        dueDate: event.startDate,
                        location: event.location,
                        allDay: event.allDay,
                        user: rule.user,
                    } as any);
                });
                if (matches.length > 0) firedRuleIds.add(rule.id);
            }

            if (rule.moduleType === 'ASSETS' && rule.conditionType === 'MAINTENANCE_DUE') {
                const matches = upcomingMaintenance.filter((record) => (
                    record.userId === rule.userId
                    && !!record.nextRecommendedDate
                    && record.nextRecommendedDate <= todayEnd
                ));

                matches.forEach((record) => {
                    notifications.push({
                        type: 'MAINTENANCE',
                        sourceType: 'ALERT_RULE',
                        id: `${rule.id}:${record.id}`,
                        ruleId: rule.id,
                        title: record.description,
                        subtitle: `${record.asset.name} · ${rule.name}`,
                        dueDate: record.nextRecommendedDate,
                        user: rule.user,
                    } as any);
                });
                if (matches.length > 0) firedRuleIds.add(rule.id);
            }

            if (rule.moduleType === 'EXPENSE' && rule.conditionType === 'THRESHOLD_EXCEEDED') {
                const threshold = Number(rule.conditionValue ?? 0);
                const expensesForMonth = await prisma.expense.findMany({
                    where: { userId: rule.userId, type: 'PAY', date: { gte: monthStart, lte: monthEnd } },
                });
                const total = expensesForMonth.reduce((sum, expense) => sum + expense.amount, 0);
                if (total > threshold) {
                    notifications.push({
                        type: 'TASK',
                        sourceType: 'ALERT_RULE',
                        id: `${rule.id}:expenses`,
                        ruleId: rule.id,
                        title: 'Budget exceeded',
                        subtitle: `${rule.name}: ${Math.round(total)} > ${Math.round(threshold)}`,
                        dueDate: now,
                        user: rule.user,
                    } as any);
                    firedRuleIds.add(rule.id);
                }
            }
        }

        if (firedRuleIds.size > 0) {
            await prisma.alertRule.updateMany({
                where: { id: { in: Array.from(firedRuleIds) } },
                data: { lastSentAt: now },
            });
        }

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
            case 'ALERT_RULE':
                await prisma.alertRule.update({ where: { id: id.split(':')[0] }, data: { lastSentAt: new Date() } });
                break;
            default:
                throw new ValidationError('Unsupported sourceType');
        }

        sendSuccess(res, { id, sourceType, ...data });
    } catch (err) { next(err); }
});

export default router;
