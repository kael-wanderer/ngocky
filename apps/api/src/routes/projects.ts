import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createProjectSchema, updateProjectSchema, createTaskSchema, updateTaskSchema } from '../validators/modules';
import { sendSuccess, sendCreated, sendPaginated, sendMessage } from '../utils/response';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { resolveReminderFields } from '../utils/reminders';

const router = Router();
router.use(authenticate);

const canAccessBoard = (board: { ownerId: string; isShared?: boolean }, userId: string) =>
    board.ownerId === userId || !!board.isShared;
const canAccessTask = (task: { createdById?: string; isShared?: boolean; project: { ownerId: string; isShared?: boolean } }, userId: string) =>
    task.project.ownerId === userId || !!task.project.isShared || !!task.isShared;

// --- Project Boards ---

// List project boards (owned by current user OR shared)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const boards = await prisma.project.findMany({
            where: {
                OR: [
                    { ownerId: userId },
                    { isShared: true },
                ],
            },
            include: {
                _count: { select: { tasks: true } },
                owner: { select: { id: true, name: true } },
            },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        });
        sendSuccess(res, boards);
    } catch (err) { next(err); }
});

// Batch reorder boards
router.post('/reorder', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { ids } = req.body as { ids: string[] };
        if (!Array.isArray(ids)) return sendMessage(res, 'Invalid');
        await Promise.all(ids.map((id, index) => prisma.project.update({ where: { id }, data: { sortOrder: index } })));
        sendMessage(res, 'Reordered');
    } catch (err) { next(err); }
});

// Create board
router.post('/', validate(createProjectSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const board = await prisma.project.create({
            data: {
                ...req.body,
                ownerId: req.user!.userId,
            },
        });
        sendCreated(res, board);
    } catch (err) { next(err); }
});

// Get board details with tasks — owner or shared access
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const board = await prisma.project.findUnique({
            where: { id: req.params.id },
            include: {
                owner: { select: { id: true, name: true } },
                tasks: {
                    include: {
                        assignee: { select: { id: true, name: true } },
                        createdBy: { select: { id: true, name: true } },
                    },
                    orderBy: [{ kanbanOrder: 'asc' }, { createdAt: 'desc' }],
                },
            },
        });
        if (!board) throw new NotFoundError('Project Board');
        if (!canAccessBoard(board as any, userId)) throw new ForbiddenError('You do not have access to this project board');
        sendSuccess(res, board);
    } catch (err) { next(err); }
});

// Update board — owner or shared access
router.patch('/:id', validate(updateProjectSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const board = await prisma.project.findUnique({ where: { id: req.params.id } });
        if (!board) throw new NotFoundError('Project Board');
        if (!canAccessBoard(board as any, userId)) throw new ForbiddenError('You do not have access to this project board');
        const updated = await prisma.project.update({
            where: { id: req.params.id },
            data: req.body,
        });
        sendSuccess(res, updated);
    } catch (err) { next(err); }
});

// Delete board — only owner
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const board = await prisma.project.findUnique({ where: { id: req.params.id } });
        if (!board) throw new NotFoundError('Project Board');
        if (board.ownerId !== userId) throw new ForbiddenError('You do not have access to this project board');
        await prisma.project.delete({ where: { id: req.params.id } });
        sendMessage(res, 'Project board and all its tasks deleted');
    } catch (err) { next(err); }
});

// --- Tasks ---

// List tasks across all projects for the current user (for dashboard / reports)
router.get('/tasks/all', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
        const userId = req.user!.userId;

        // Return tasks from boards owned by current user OR shared boards
        const where: any = {
            OR: [
                { project: { ownerId: userId } },
                { project: { isShared: true } },
                { isShared: true },
            ],
        };
        if (req.query.status) where.status = req.query.status;

        const [tasks, total] = await Promise.all([
            prisma.projectTask.findMany({
                where, skip: (page - 1) * limit, take: limit,
                include: { project: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.projectTask.count({ where }),
        ]);

        sendPaginated(res, tasks, total, page, limit);
    } catch (err) { next(err); }
});

// Create task in a board — owner or shared access
router.post('/tasks', validate(createTaskSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const board = await prisma.project.findUnique({ where: { id: req.body.projectId } });
        if (!board) throw new NotFoundError('Project Board');
        if (!canAccessBoard(board as any, userId)) throw new ForbiddenError('You do not have access to this project board');

        const task = await prisma.projectTask.create({
            data: {
                ...req.body,
                ...resolveReminderFields(req.body, {
                    anchorDate: req.body.deadline,
                    anchorLabel: 'task deadline',
                }),
                deadline: req.body.deadline ? new Date(req.body.deadline) : undefined,
                createdById: userId,
            },
            include: { assignee: { select: { id: true, name: true } } },
        });
        sendCreated(res, task);
    } catch (err) { next(err); }
});

// Update task — owner or shared access
router.patch('/tasks/:id', validate(updateTaskSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const existing = await prisma.projectTask.findUnique({
            where: { id: req.params.id },
            include: { project: { select: { ownerId: true, isShared: true } } },
        });
        if (!existing) throw new NotFoundError('Task');
        if (!canAccessTask(existing as any, userId)) throw new ForbiddenError('You do not have access to this task');
        const reminderFields = resolveReminderFields(
            { ...existing, ...req.body },
            {
                anchorDate: req.body.deadline === undefined ? existing.deadline : req.body.deadline,
                anchorLabel: 'task deadline',
                current: existing,
            },
        );

        const task = await prisma.projectTask.update({
            where: { id: req.params.id },
            data: {
                ...req.body,
                ...reminderFields,
                deadline: req.body.deadline ? new Date(req.body.deadline) : req.body.deadline,
            },
            include: { assignee: { select: { id: true, name: true } } },
        });
        sendSuccess(res, task);
    } catch (err) { next(err); }
});

// Reorder task (Kanban)
router.patch('/tasks/:id/reorder', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const { kanbanOrder, status } = req.body;
        const existing = await prisma.projectTask.findUnique({
            where: { id: req.params.id },
            include: { project: { select: { ownerId: true, isShared: true } } },
        });
        if (!existing) throw new NotFoundError('Task');
        if (!canAccessTask(existing as any, userId)) throw new ForbiddenError('You do not have access to this task');

        const task = await prisma.projectTask.update({
            where: { id: req.params.id },
            data: { kanbanOrder, ...(status && { status }) },
        });
        sendSuccess(res, task);
    } catch (err) { next(err); }
});

// Delete task — owner or shared access
router.delete('/tasks/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const existing = await prisma.projectTask.findUnique({
            where: { id: req.params.id },
            include: { project: { select: { ownerId: true, isShared: true } } },
        });
        if (!existing) throw new NotFoundError('Task');
        if (!canAccessTask(existing as any, userId)) throw new ForbiddenError('You do not have access to this task');

        await prisma.projectTask.delete({ where: { id: req.params.id } });
        sendMessage(res, 'Task deleted');
    } catch (err) { next(err); }
});

export default router;
