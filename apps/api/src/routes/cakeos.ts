import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { sendSuccess, sendCreated, sendMessage } from '../utils/response';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { resolveReminderFields } from '../utils/reminders';

const router = Router();
router.use(authenticate);

const itemInclude = {
    owner: { select: { id: true, name: true, email: true } },
    assigner: { select: { id: true, name: true, email: true } },
};

const CAKEO_EDITOR_EMAILS = new Set([
    'cong.buithanh@gmail.com',
    'kist.t1108@gmail.com',
]);

function canEditCakeoItem(req: Request, ownerId: string) {
    return ownerId === req.user!.userId || CAKEO_EDITOR_EMAILS.has(req.user!.email.toLowerCase());
}

function buildWhere(userId: string) {
    return {
        OR: [
            { ownerId: userId },
            { isShared: true },
            { assignerId: userId },
        ],
    };
}

// GET /api/cakeos/users — list all users (for assigner dropdown)
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const users = await prisma.user.findMany({
            where: { active: true, role: { not: 'OWNER' } },
            select: { id: true, name: true, email: true },
            orderBy: { name: 'asc' },
        });
        sendSuccess(res, users);
    } catch (err) { next(err); }
});

// GET /api/cakeos — list items
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const { status, assignerId, category, type, startFrom, startTo } = req.query as Record<string, string>;

        const where: any = buildWhere(userId);

        if (status) where.status = status;
        if (assignerId) where.assignerId = assignerId;
        if (category) where.category = category;
        if (type) where.type = type;

        if (startFrom || startTo) {
            where.startDate = {};
            if (startFrom) where.startDate.gte = new Date(startFrom);
            if (startTo) where.startDate.lte = new Date(startTo);
        }

        const items = await prisma.caKeo.findMany({
            where,
            include: itemInclude,
            orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
        });
        sendSuccess(res, items);
    } catch (err) { next(err); }
});

// POST /api/cakeos — create item
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const { title, description, type, category, status, assignerId, startDate, endDate, allDay, color, showOnCalendar, isShared, ...rest } = req.body;

        const reminderFields = resolveReminderFields(req.body, {
            anchorDate: startDate,
            anchorLabel: 'task start date',
        });

        const item = await prisma.caKeo.create({
            data: {
                title,
                description: description || null,
                type: type || 'Task',
                category: category || null,
                status: status || 'TODO',
                assignerId: assignerId || null,
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                allDay: !!allDay,
                color: color || null,
                showOnCalendar: showOnCalendar !== false,
                isShared: isShared !== false,
                ownerId: userId,
                ...reminderFields,
            },
            include: itemInclude,
        });
        sendCreated(res, item);
    } catch (err) { next(err); }
});

// PATCH /api/cakeos/:id — update item
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const existing = await prisma.caKeo.findUnique({ where: { id: req.params.id } });
        if (!existing) throw new NotFoundError('CaKeo item');
        if (!canEditCakeoItem(req, existing.ownerId)) throw new ForbiddenError('Not allowed to edit this item');

        const { title, description, type, category, status, assignerId, startDate, endDate, allDay, color, showOnCalendar, isShared } = req.body;

        const reminderFields = resolveReminderFields(
            { ...existing, ...req.body },
            {
                anchorDate: startDate ?? existing.startDate,
                anchorLabel: 'task start date',
                current: existing,
            },
        );

        const updated = await prisma.caKeo.update({
            where: { id: req.params.id },
            data: {
                ...(title !== undefined && { title }),
                ...(description !== undefined && { description: description || null }),
                ...(type !== undefined && { type: type || 'Task' }),
                ...(category !== undefined && { category: category || null }),
                ...(status !== undefined && { status }),
                ...(assignerId !== undefined && { assignerId: assignerId || null }),
                ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
                ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
                ...(allDay !== undefined && { allDay: !!allDay }),
                ...(color !== undefined && { color: color || null }),
                ...(showOnCalendar !== undefined && { showOnCalendar: !!showOnCalendar }),
                ...(isShared !== undefined && { isShared: !!isShared }),
                ...reminderFields,
            },
            include: itemInclude,
        });
        sendSuccess(res, updated);
    } catch (err) { next(err); }
});

// DELETE /api/cakeos/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const existing = await prisma.caKeo.findUnique({ where: { id: req.params.id } });
        if (!existing) throw new NotFoundError('CaKeo item');
        if (existing.ownerId !== userId) throw new ForbiddenError('Not your item');
        await prisma.caKeo.delete({ where: { id: req.params.id } });
        sendMessage(res, 'Deleted');
    } catch (err) { next(err); }
});

export default router;
