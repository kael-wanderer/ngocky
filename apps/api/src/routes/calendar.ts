import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createEventSchema, updateEventSchema } from '../validators/modules';
import { sendSuccess, sendCreated, sendPaginated, sendMessage } from '../utils/response';
import { NotFoundError } from '../utils/errors';
import { addDays, addMonths, addWeeks, endOfDay } from 'date-fns';

const router = Router();
router.use(authenticate);

function expandRecurringEvent(event: any, rangeStart?: Date, rangeEnd?: Date) {
    if (!event.repeatFrequency || !rangeStart || !rangeEnd) return [event];

    const instances: any[] = [];
    let cursor = new Date(event.startDate);
    const until = event.repeatEndType === 'ON_DATE' && event.repeatUntil ? endOfDay(new Date(event.repeatUntil)) : null;
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

        if (event.repeatFrequency === 'DAILY') cursor = addDays(cursor, 1);
        else if (event.repeatFrequency === 'WEEKLY') cursor = addWeeks(cursor, 1);
        else cursor = addMonths(cursor, 1);

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

        const where: any = {
            OR: [
                { createdById: req.user!.userId },
                { isShared: true },
            ],
        };

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
        const event = await prisma.calendarEvent.create({
            data: {
                ...data,
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
