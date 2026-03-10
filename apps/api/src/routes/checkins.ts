import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createCheckInSchema } from '../validators/modules';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response';
import { NotFoundError } from '../utils/errors';

const router = Router();
router.use(authenticate);

const checkInDateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

function normalizeCheckInDate(date?: string) {
    if (!date) return new Date();

    if (checkInDateOnlyPattern.test(date)) {
        const [year, month, day] = date.split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
    }

    return new Date(date);
}

// List check-ins for a goal
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
        const goalId = req.query.goalId as string;

        const where: any = { userId: req.user!.userId };
        if (goalId) where.goalId = goalId;

        const [checkIns, total] = await Promise.all([
            prisma.goalCheckIn.findMany({
                where, skip: (page - 1) * limit, take: limit,
                include: { goal: { select: { title: true } } },
                orderBy: { date: 'desc' },
            }),
            prisma.goalCheckIn.count({ where }),
        ]);

        sendPaginated(res, checkIns, total, page, limit);
    } catch (err) { next(err); }
});

// Create check-in (increments goal progress)
router.post('/', validate(createCheckInSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { goalId, quantity, note, date } = req.body;

        const goal = await prisma.goal.findUnique({ where: { id: goalId } });
        if (!goal) throw new NotFoundError('Goal');

        const checkIn = await prisma.goalCheckIn.create({
            data: {
                goalId,
                userId: req.user!.userId,
                quantity: quantity || 1,
                note,
                date: normalizeCheckInDate(date),
            },
        });

        // Increment goal current count based on tracking type
        const increment = goal.trackingType === 'BY_FREQUENCY' ? 1 : (quantity || 1);

        const updatedGoal = await prisma.goal.update({
            where: { id: goalId },
            data: { currentCount: { increment } },
        });

        sendCreated(res, { checkIn, goal: updatedGoal });
    } catch (err) { next(err); }
});

// Delete check-in
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const checkIn = await prisma.goalCheckIn.findUnique({
            where: { id: req.params.id },
            include: { goal: true },
        });
        if (checkIn) {
            await prisma.goalCheckIn.delete({ where: { id: req.params.id } });
            // Mirror the creation logic: BY_FREQUENCY always counts as 1
            const decrement = checkIn.goal.trackingType === 'BY_FREQUENCY' ? 1 : checkIn.quantity;
            await prisma.goal.update({
                where: { id: checkIn.goalId },
                data: { currentCount: { decrement } },
            });
        }
        sendSuccess(res, { deleted: true });
    } catch (err) { next(err); }
});

export default router;
