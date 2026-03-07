import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createEventSchema, updateEventSchema } from '../validators/modules';
import { sendSuccess, sendCreated, sendPaginated, sendMessage } from '../utils/response';
import { NotFoundError } from '../utils/errors';

const router = Router();
router.use(authenticate);

// List events (with date range filter)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
        const startFrom = req.query.startFrom as string;
        const startTo = req.query.startTo as string;

        const where: any = {};
        if (startFrom || startTo) {
            where.startDate = {};
            if (startFrom) where.startDate.gte = new Date(startFrom);
            if (startTo) where.startDate.lte = new Date(startTo);
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

        sendPaginated(res, events, total, page, limit);
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
