import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createEventSchema, updateEventSchema } from '../validators/modules';
import { sendSuccess, sendCreated, sendPaginated, sendMessage } from '../utils/response';
import { NotFoundError, ValidationError } from '../utils/errors';
import { buildVisibleCalendarEventWhere } from '../utils/calendarVisibility';
import { resolveReminderFields } from '../utils/reminders';

const router = Router();
router.use(authenticate);

function addDaysLocal(date: Date, amount: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
}

function addWeeksLocal(date: Date, amount: number) {
    return addDaysLocal(date, amount * 7);
}

function addMonthsLocal(date: Date, amount: number) {
    const next = new Date(date);
    next.setMonth(next.getMonth() + amount);
    return next;
}

function endOfDayLocal(date: Date) {
    const next = new Date(date);
    next.setHours(23, 59, 59, 999);
    return next;
}

function assertEndAfterStart(startDate?: string | Date | null, endDate?: string | Date | null) {
    if (!startDate || !endDate) return;

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;

    if (end <= start) {
        throw new ValidationError('End time must be after start time');
    }
}

function expandRecurringEvent(event: any, rangeStart?: Date, rangeEnd?: Date) {
    if (!event.repeatFrequency || !rangeStart || !rangeEnd) return [event];

    const instances: any[] = [];
    let cursor = new Date(event.startDate);
    const until = event.repeatEndType === 'ON_DATE' && event.repeatUntil ? endOfDayLocal(new Date(event.repeatUntil)) : null;
    const durationMs = event.endDate ? new Date(event.endDate).getTime() - new Date(event.startDate).getTime() : 0;

    while (cursor <= rangeEnd) {
        if (until && cursor > until) break;
        if (cursor >= rangeStart) {
            instances.push({
                ...event,
                id: `${event.id}::${cursor.toISOString()}`,
                sourceEventId: event.id,
                startDate: cursor.toISOString(),
                endDate: event.endDate ? new Date(cursor.getTime() + durationMs).toISOString() : null,
            });
        }

        if (event.repeatFrequency === 'DAILY') cursor = addDaysLocal(cursor, 1);
        else if (event.repeatFrequency === 'WEEKLY') cursor = addWeeksLocal(cursor, 1);
        else if (event.repeatFrequency === 'MONTHLY') cursor = addMonthsLocal(cursor, 1);
        else cursor = addMonthsLocal(cursor, 3);

        if (!until && instances.length > 366) break;
    }

    return instances;
}

// List events (with date range filter)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
        const startFrom = req.query.startFrom as string;
        const startTo = req.query.startTo as string;
        const rangeStart = startFrom ? new Date(startFrom) : undefined;
        const rangeEnd = startTo ? new Date(startTo) : undefined;

        const where: any = buildVisibleCalendarEventWhere(req.user!.userId);

        if (rangeStart || rangeEnd) {
            const effectiveStart = rangeStart || new Date(0);
            const effectiveEnd = rangeEnd || new Date('9999-12-31T23:59:59.999Z');
            where.AND = [
                {
                    OR: [
                        {
                            repeatFrequency: null,
                            startDate: {
                                gte: effectiveStart,
                                lte: effectiveEnd,
                            },
                        },
                        {
                            repeatFrequency: { not: null },
                            startDate: { lte: effectiveEnd },
                            OR: [
                                { repeatEndType: 'NEVER' },
                                { repeatEndType: null },
                                { repeatUntil: null },
                                { repeatUntil: { gte: effectiveStart } },
                            ],
                        },
                    ],
                },
            ];
        }

        const [events, total] = await Promise.all([
            prisma.calendarEvent.findMany({
                where, skip: (page - 1) * limit, take: limit,
                include: {
                    createdBy: { select: { id: true, name: true } },
                    participants: { include: { user: { select: { id: true, name: true } } } },
                },
                orderBy: { startDate: 'asc' },
            }),
            prisma.calendarEvent.count({ where }),
        ]);

        const expanded = (rangeStart || rangeEnd)
            ? events.flatMap((event: any) => expandRecurringEvent(
                event,
                rangeStart,
                rangeEnd,
            ))
            : events;

        sendPaginated(res, expanded, rangeStart || rangeEnd ? expanded.length : total, page, limit);
    } catch (err) { next(err); }
});

// Create event
router.post('/', validate(createEventSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { participantIds, ...data } = req.body;
        assertEndAfterStart(data.startDate, data.endDate);
        const reminderFields = resolveReminderFields(data, {
            anchorDate: data.startDate,
            anchorLabel: 'event start time',
        });
        const event = await prisma.calendarEvent.create({
            data: {
                ...data,
                ...reminderFields,
                startDate: new Date(data.startDate),
                endDate: data.endDate ? new Date(data.endDate) : undefined,
                createdById: req.user!.userId,
                ...(participantIds?.length && {
                    participants: {
                        create: participantIds.map((userId: string) => ({ userId })),
                    },
                }),
            },
            include: {
                createdBy: { select: { id: true, name: true } },
                participants: { include: { user: { select: { id: true, name: true } } } },
            },
        });
        sendCreated(res, event);
    } catch (err) { next(err); }
});

// Get event
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const event = await prisma.calendarEvent.findUnique({
            where: { id: req.params.id },
            include: {
                createdBy: { select: { id: true, name: true } },
                participants: { include: { user: { select: { id: true, name: true } } } },
            },
        });
        if (!event) throw new NotFoundError('Event');
        sendSuccess(res, event);
    } catch (err) { next(err); }
});

// Update event
router.patch('/:id', validate(updateEventSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { participantIds, ...data } = req.body;
        const existing = await prisma.calendarEvent.findUnique({
            where: { id: req.params.id },
            select: {
                id: true,
                startDate: true,
                endDate: true,
                notificationEnabled: true,
                reminderOffsetUnit: true,
                reminderOffsetValue: true,
                notificationDate: true,
                notificationTime: true,
                notificationCooldownHours: true,
                lastNotificationSentAt: true,
            },
        });
        if (!existing) throw new NotFoundError('Event');

        assertEndAfterStart(
            data.startDate ?? existing.startDate,
            data.endDate === undefined ? existing.endDate : data.endDate,
        );

        const reminderFields = resolveReminderFields(
            { ...existing, ...data },
            {
                anchorDate: data.startDate ?? existing.startDate,
                anchorLabel: 'event start time',
                current: existing,
            },
        );

        if (participantIds !== undefined) {
            await prisma.eventParticipant.deleteMany({ where: { eventId: req.params.id } });
            if (participantIds.length) {
                await prisma.eventParticipant.createMany({
                    data: participantIds.map((userId: string) => ({ eventId: req.params.id, userId })),
                });
            }
        }

        const event = await prisma.calendarEvent.update({
            where: { id: req.params.id },
            data: {
                ...data,
                ...reminderFields,
                startDate: data.startDate ? new Date(data.startDate) : undefined,
                endDate: data.endDate ? new Date(data.endDate) : undefined,
            },
            include: {
                createdBy: { select: { id: true, name: true } },
                participants: { include: { user: { select: { id: true, name: true } } } },
            },
        });
        sendSuccess(res, event);
    } catch (err) { next(err); }
});

// Delete event
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        await prisma.calendarEvent.delete({ where: { id: req.params.id } });
        sendMessage(res, 'Event deleted');
    } catch (err) { next(err); }
});

export default router;
