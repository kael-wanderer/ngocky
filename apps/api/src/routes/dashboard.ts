import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { sendSuccess } from '../utils/response';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const now = new Date();
        const userId = req.user!.userId;

        // Week boundaries (Mon-Sun)
        const dayOfWeek = now.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        // Month boundaries
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        const [
            tasksThisWeek, tasksThisMonth,
            houseworkThisWeek, houseworkThisMonth,
            upcomingEvents, recentExpenses,
            overdueHousework, overdueProjects,
            pinnedGoals, pinnedProjects, pinnedHousework,
            goals,
        ] = await Promise.all([
            // Tasks (projects) due this week
            prisma.project.count({
                where: { deadline: { gte: weekStart, lt: weekEnd }, status: { not: 'DONE' } },
            }),
            // Tasks due this month
            prisma.project.count({
                where: { deadline: { gte: monthStart, lt: monthEnd }, status: { not: 'DONE' } },
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
                where: { startDate: { gte: now, lt: weekEnd } },
                orderBy: { startDate: 'asc' },
                take: 10,
                include: { createdBy: { select: { name: true } } },
            }),
            // Recent expenses
            prisma.expense.findMany({
                orderBy: { date: 'desc' },
                take: 5,
                include: { user: { select: { name: true } } },
            }),
            // Overdue housework
            prisma.houseworkItem.count({
                where: { nextDueDate: { lt: now }, active: true },
            }),
            // Overdue projects
            prisma.project.count({
                where: { deadline: { lt: now }, status: { notIn: ['DONE', 'ARCHIVED'] } },
            }),
            // Pinned goals
            prisma.goal.findMany({
                where: { pinToDashboard: true, active: true },
                take: 10,
                include: { user: { select: { name: true } } },
            }),
            // Pinned projects
            prisma.project.findMany({
                where: { pinToDashboard: true, status: { not: 'ARCHIVED' } },
                take: 10,
                include: { assignee: { select: { name: true } } },
            }),
            // Pinned housework
            prisma.houseworkItem.findMany({
                where: { pinToDashboard: true, active: true },
                take: 10,
                include: { assignee: { select: { name: true } } },
            }),
            // Active goals for current user
            prisma.goal.findMany({
                where: { userId, active: true },
                take: 10,
                include: { _count: { select: { checkIns: true } } },
            }),
        ]);

        sendSuccess(res, {
            summary: {
                tasksThisWeek,
                tasksThisMonth,
                houseworkThisWeek,
                houseworkThisMonth,
                upcomingEventsCount: upcomingEvents.length,
                overdueHousework,
                overdueProjects,
            },
            upcomingEvents,
            recentExpenses,
            pinnedGoals,
            pinnedProjects,
            pinnedHousework,
            goals,
        });
    } catch (err) { next(err); }
});

export default router;
