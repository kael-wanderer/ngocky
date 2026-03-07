import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createGoalSchema, updateGoalSchema } from '../validators/modules';
import { sendSuccess, sendCreated, sendPaginated, sendMessage } from '../utils/response';
import { NotFoundError } from '../utils/errors';

const router = Router();
router.use(authenticate);

// Helper: calculate period start
function getPeriodStart(periodType: 'WEEKLY' | 'MONTHLY'): Date {
    const now = new Date();
    if (periodType === 'WEEKLY') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
        return new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
    }
    return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

// List goals
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
        const userId = req.query.userId as string || req.user!.userId;
        const active = req.query.active !== undefined ? req.query.active === 'true' : undefined;

        const where: any = { userId };
        if (active !== undefined) where.active = active;

        const [goals, total] = await Promise.all([
            prisma.goal.findMany({
                where, skip: (page - 1) * limit, take: limit,
                include: { _count: { select: { checkIns: true } } },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.goal.count({ where }),
        ]);

        // Auto-reset period counts if needed
        const updated = await Promise.all(goals.map(async (g) => {
            const periodStart = getPeriodStart(g.periodType);
            if (g.currentPeriodStart < periodStart) {
                // Reset count for new period
                const checkInsInPeriod = await prisma.goalCheckIn.count({
                    where: { goalId: g.id, date: { gte: periodStart } },
                });
                await prisma.goal.update({
                    where: { id: g.id },
                    data: { currentCount: checkInsInPeriod, currentPeriodStart: periodStart },
                });
                return { ...g, currentCount: checkInsInPeriod, currentPeriodStart: periodStart };
            }
            return g;
        }));

        sendPaginated(res, updated, total, page, limit);
    } catch (err) { next(err); }
});

// Create goal
router.post('/', validate(createGoalSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const periodStart = getPeriodStart(req.body.periodType);
        const goal = await prisma.goal.create({
            data: {
                ...req.body,
                startDate: req.body.startDate ? new Date(req.body.startDate) : new Date(),
                currentPeriodStart: periodStart,
                userId: req.user!.userId,
            },
        });
        sendCreated(res, goal);
    } catch (err) { next(err); }
});

// Get single goal
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const goal = await prisma.goal.findUnique({
            where: { id: req.params.id },
            include: {
                checkIns: { orderBy: { date: 'desc' }, take: 20 },
                _count: { select: { checkIns: true } },
            },
        });
        if (!goal) throw new NotFoundError('Goal');
        sendSuccess(res, goal);
    } catch (err) { next(err); }
});

// Update goal
router.patch('/:id', validate(updateGoalSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const goal = await prisma.goal.update({
            where: { id: req.params.id },
            data: req.body,
        });
        sendSuccess(res, goal);
    } catch (err) { next(err); }
});

// Delete goal
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        await prisma.goal.delete({ where: { id: req.params.id } });
        sendMessage(res, 'Goal deleted');
    } catch (err) { next(err); }
});

export default router;
