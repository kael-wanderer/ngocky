import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createHouseworkSchema, updateHouseworkSchema } from '../validators/modules';
import { sendSuccess, sendCreated, sendPaginated, sendMessage } from '../utils/response';
import { NotFoundError } from '../utils/errors';
import { FrequencyType } from '@prisma/client';

const router = Router();
router.use(authenticate);

// Calculate next due date based on frequency
function calculateNextDueDate(lastDate: Date, freq: FrequencyType, customDays?: number | null): Date {
    const next = new Date(lastDate);
    switch (freq) {
        case 'WEEKLY': next.setDate(next.getDate() + 7); break;
        case 'MONTHLY': next.setMonth(next.getMonth() + 1); break;
        case 'QUARTERLY': next.setMonth(next.getMonth() + 3); break;
        case 'HALF_YEARLY': next.setMonth(next.getMonth() + 6); break;
        case 'YEARLY': next.setFullYear(next.getFullYear() + 1); break;
        case 'CUSTOM': next.setDate(next.getDate() + (customDays || 30)); break;
        default: break;
    }
    return next;
}

// List housework
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
        const active = req.query.active !== undefined ? req.query.active === 'true' : undefined;

        const where: any = {};
        if (active !== undefined) where.active = active;

        const [items, total] = await Promise.all([
            prisma.houseworkItem.findMany({
                where, skip: (page - 1) * limit, take: limit,
                include: {
                    assignee: { select: { id: true, name: true } },
                    createdBy: { select: { id: true, name: true } },
                },
                orderBy: [{ nextDueDate: 'asc' }, { createdAt: 'desc' }],
            }),
            prisma.houseworkItem.count({ where }),
        ]);

        sendPaginated(res, items, total, page, limit);
    } catch (err) { next(err); }
});

// Create housework
router.post('/', validate(createHouseworkSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const item = await prisma.houseworkItem.create({
            data: {
                ...req.body,
                nextDueDate: req.body.nextDueDate ? new Date(req.body.nextDueDate) : undefined,
                createdById: req.user!.userId,
            },
            include: { assignee: { select: { id: true, name: true } } },
        });
        sendCreated(res, item);
    } catch (err) { next(err); }
});

// Get housework item
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const item = await prisma.houseworkItem.findUnique({
            where: { id: req.params.id },
            include: {
                assignee: { select: { id: true, name: true } },
                createdBy: { select: { id: true, name: true } },
            },
        });
        if (!item) throw new NotFoundError('Housework item');
        sendSuccess(res, item);
    } catch (err) { next(err); }
});

// Update housework
router.patch('/:id', validate(updateHouseworkSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const item = await prisma.houseworkItem.update({
            where: { id: req.params.id },
            data: {
                ...req.body,
                nextDueDate: req.body.nextDueDate ? new Date(req.body.nextDueDate) : req.body.nextDueDate,
                lastCompletedDate: req.body.lastCompletedDate ? new Date(req.body.lastCompletedDate) : req.body.lastCompletedDate,
            },
            include: { assignee: { select: { id: true, name: true } } },
        });
        sendSuccess(res, item);
    } catch (err) { next(err); }
});

// Mark as complete (advances next due date for recurring)
router.post('/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const item = await prisma.houseworkItem.findUnique({ where: { id: req.params.id } });
        if (!item) throw new NotFoundError('Housework item');

        const now = new Date();
        const data: any = { lastCompletedDate: now };

        if (item.frequencyType !== 'ONE_TIME') {
            data.nextDueDate = calculateNextDueDate(now, item.frequencyType, item.customIntervalDays);
        } else {
            data.active = false;
        }

        const updated = await prisma.houseworkItem.update({
            where: { id: req.params.id },
            data,
            include: { assignee: { select: { id: true, name: true } } },
        });
        sendSuccess(res, updated);
    } catch (err) { next(err); }
});

// Delete
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        await prisma.houseworkItem.delete({ where: { id: req.params.id } });
        sendMessage(res, 'Housework item deleted');
    } catch (err) { next(err); }
});

export default router;
