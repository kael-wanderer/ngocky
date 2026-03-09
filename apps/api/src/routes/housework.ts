import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createHouseworkSchema, updateHouseworkSchema } from '../validators/modules';
import { sendSuccess, sendCreated, sendPaginated, sendMessage } from '../utils/response';
import { NotFoundError } from '../utils/errors';
import { FrequencyType, HouseworkItem } from '@prisma/client';
import { resolveReminderFields } from '../utils/reminders';

const router = Router();
router.use(authenticate);

function clampDay(year: number, month1Based: number, preferredDay: number): number {
    const maxDay = new Date(year, month1Based, 0).getDate();
    return Math.min(preferredDay, maxDay);
}

function isSameOrBefore(a: Date, b: Date): boolean {
    return a.getTime() <= b.getTime();
}

function calculateNextDueDateFromRule(item: HouseworkItem, referenceDate: Date): Date {
    const next = new Date(referenceDate);

    if (item.frequencyType === 'DAILY') {
        next.setDate(next.getDate() + 1);
        return next;
    }

    if (item.frequencyType === 'WEEKLY' && item.dayOfWeek) {
        const target = item.dayOfWeek % 7; // 1..6 = Mon..Sat, 0 = Sun
        const current = next.getDay();
        let diff = (target - current + 7) % 7;
        if (diff === 0) diff = 7;
        next.setDate(next.getDate() + diff);
        return next;
    }

    if (item.frequencyType === 'MONTHLY' && item.dayOfMonth) {
        let year = next.getFullYear();
        let month = next.getMonth() + 1;
        let candidate = new Date(year, month - 1, clampDay(year, month, item.dayOfMonth), next.getHours(), next.getMinutes(), next.getSeconds(), next.getMilliseconds());
        if (isSameOrBefore(candidate, next)) {
            month += 1;
            if (month > 12) { month = 1; year += 1; }
            candidate = new Date(year, month - 1, clampDay(year, month, item.dayOfMonth), next.getHours(), next.getMinutes(), next.getSeconds(), next.getMilliseconds());
        }
        return candidate;
    }

    if (item.frequencyType === 'QUARTERLY' && item.monthOfPeriod && item.dayOfMonth) {
        const quarterStart = Math.floor(next.getMonth() / 3) * 3 + 1; // 1,4,7,10
        let year = next.getFullYear();
        let month = quarterStart + (item.monthOfPeriod - 1);
        let candidate = new Date(year, month - 1, clampDay(year, month, item.dayOfMonth), next.getHours(), next.getMinutes(), next.getSeconds(), next.getMilliseconds());
        if (isSameOrBefore(candidate, next)) {
            month += 3;
            if (month > 12) {
                month -= 12;
                year += 1;
            }
            candidate = new Date(year, month - 1, clampDay(year, month, item.dayOfMonth), next.getHours(), next.getMinutes(), next.getSeconds(), next.getMilliseconds());
        }
        return candidate;
    }

    if (item.frequencyType === 'HALF_YEARLY' && item.monthOfPeriod && item.dayOfMonth) {
        const halfStart = next.getMonth() < 6 ? 1 : 7; // Jan or Jul
        let year = next.getFullYear();
        let month = halfStart + (item.monthOfPeriod - 1);
        let candidate = new Date(year, month - 1, clampDay(year, month, item.dayOfMonth), next.getHours(), next.getMinutes(), next.getSeconds(), next.getMilliseconds());
        if (isSameOrBefore(candidate, next)) {
            month += 6;
            if (month > 12) {
                month -= 12;
                year += 1;
            }
            candidate = new Date(year, month - 1, clampDay(year, month, item.dayOfMonth), next.getHours(), next.getMinutes(), next.getSeconds(), next.getMilliseconds());
        }
        return candidate;
    }

    if (item.frequencyType === 'YEARLY' && item.monthOfYear && item.dayOfMonth) {
        let year = next.getFullYear();
        let candidate = new Date(year, item.monthOfYear - 1, clampDay(year, item.monthOfYear, item.dayOfMonth), next.getHours(), next.getMinutes(), next.getSeconds(), next.getMilliseconds());
        if (isSameOrBefore(candidate, next)) {
            year += 1;
            candidate = new Date(year, item.monthOfYear - 1, clampDay(year, item.monthOfYear, item.dayOfMonth), next.getHours(), next.getMinutes(), next.getSeconds(), next.getMilliseconds());
        }
        return candidate;
    }

    // Backward-compatible fallback for existing records without rule fields.
    switch (item.frequencyType as FrequencyType) {
        case 'WEEKLY': next.setDate(next.getDate() + 7); break;
        case 'MONTHLY': next.setMonth(next.getMonth() + 1); break;
        case 'QUARTERLY': next.setMonth(next.getMonth() + 3); break;
        case 'HALF_YEARLY': next.setMonth(next.getMonth() + 6); break;
        case 'YEARLY': next.setFullYear(next.getFullYear() + 1); break;
        case 'CUSTOM': next.setDate(next.getDate() + (item.customIntervalDays || 30)); break;
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
        const currentUserId = req.user!.userId;

        const where: any = {
            OR: [
                { createdById: currentUserId },
                { isShared: true },
            ],
        };
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
                ...resolveReminderFields(req.body, {
                    anchorDate: req.body.nextDueDate,
                    anchorLabel: 'housework due date',
                }),
                nextDueDate: req.body.nextDueDate ? new Date(req.body.nextDueDate) : undefined,
                createdById: req.user!.userId,
            },
            include: {
                assignee: { select: { id: true, name: true } },
                createdBy: { select: { id: true, name: true } },
            },
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
        if (item.createdById !== req.user!.userId && !item.isShared) throw new NotFoundError('Housework item');
        sendSuccess(res, item);
    } catch (err) { next(err); }
});

// Update housework
router.patch('/:id', validate(updateHouseworkSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const existing = await prisma.houseworkItem.findUnique({ where: { id: req.params.id } });
        if (!existing) throw new NotFoundError('Housework item');
        if (existing.createdById !== req.user!.userId) throw new NotFoundError('Housework item');
        const reminderFields = resolveReminderFields(
            { ...existing, ...req.body },
            {
                anchorDate: req.body.nextDueDate === undefined ? existing.nextDueDate : req.body.nextDueDate,
                anchorLabel: 'housework due date',
                current: existing,
            },
        );
        const item = await prisma.houseworkItem.update({
            where: { id: req.params.id },
            data: {
                ...req.body,
                ...reminderFields,
                nextDueDate: req.body.nextDueDate ? new Date(req.body.nextDueDate) : req.body.nextDueDate,
                lastCompletedDate: req.body.lastCompletedDate ? new Date(req.body.lastCompletedDate) : req.body.lastCompletedDate,
            },
            include: {
                assignee: { select: { id: true, name: true } },
                createdBy: { select: { id: true, name: true } },
            },
        });
        sendSuccess(res, item);
    } catch (err) { next(err); }
});

// Mark as complete (advances next due date for recurring)
router.post('/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const item = await prisma.houseworkItem.findUnique({ where: { id: req.params.id } });
        if (!item) throw new NotFoundError('Housework item');
        if (item.createdById !== req.user!.userId) throw new NotFoundError('Housework item');

        const now = new Date();
        const data: any = { lastCompletedDate: now };

        if (item.frequencyType !== 'ONE_TIME') {
            data.nextDueDate = calculateNextDueDateFromRule(item, now);
            Object.assign(data, resolveReminderFields(
                { ...item, nextDueDate: data.nextDueDate },
                {
                    anchorDate: data.nextDueDate,
                    anchorLabel: 'housework due date',
                    current: item,
                },
            ));
        } else {
            data.active = false;
            Object.assign(data, resolveReminderFields(
                { ...item, notificationEnabled: false },
                {
                    anchorDate: item.nextDueDate,
                    anchorLabel: 'housework due date',
                    current: item,
                },
            ));
        }

        const updated = await prisma.houseworkItem.update({
            where: { id: req.params.id },
            data,
            include: {
                assignee: { select: { id: true, name: true } },
                createdBy: { select: { id: true, name: true } },
            },
        });
        sendSuccess(res, updated);
    } catch (err) { next(err); }
});

// Delete
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const item = await prisma.houseworkItem.findUnique({ where: { id: req.params.id } });
        if (!item) throw new NotFoundError('Housework item');
        if (item.createdById !== req.user!.userId) throw new NotFoundError('Housework item');
        await prisma.houseworkItem.delete({ where: { id: req.params.id } });
        sendMessage(res, 'Housework item deleted');
    } catch (err) { next(err); }
});

export default router;
