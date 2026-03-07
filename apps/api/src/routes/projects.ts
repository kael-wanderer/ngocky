import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createProjectSchema, updateProjectSchema, createTaskSchema, updateTaskSchema } from '../validators/modules';
import { sendSuccess, sendCreated, sendPaginated, sendMessage } from '../utils/response';
import { NotFoundError } from '../utils/errors';

const router = Router();
router.use(authenticate);

// --- Project Boards ---

// List project boards
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const boards = await prisma.project.findMany({
            where: { ownerId: userId },
            include: { _count: { select: { tasks: true } } },
            orderBy: { createdAt: 'desc' },
        });
        sendSuccess(res, boards);
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

// Get board details (with tasks)
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const board = await prisma.project.findUnique({
            where: { id: req.params.id },
            include: {
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
        sendSuccess(res, board);
    } catch (err) { next(err); }
});

// Update board
router.patch('/:id', validate(updateProjectSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const board = await prisma.project.update({
            where: { id: req.params.id },
            data: req.body,
        });
        sendSuccess(res, board);
    } catch (err) { next(err); }
});

// Delete board
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        await prisma.project.delete({ where: { id: req.params.id } });
        sendMessage(res, 'Project board and all its tasks deleted');
    } catch (err) { next(err); }
});

// --- Tasks ---

// List all tasks (across all projects, for global view)
router.get('/tasks/all', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

        const where: any = { createdById: req.user!.userId };
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

// Create task in a board
router.post('/tasks', validate(createTaskSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const task = await prisma.projectTask.create({
            data: {
                ...req.body,
                deadline: req.body.deadline ? new Date(req.body.deadline) : undefined,
                createdById: req.user!.userId,
            },
            include: { assignee: { select: { id: true, name: true } } },
        });
        sendCreated(res, task);
    } catch (err) { next(err); }
});

// Update task
router.patch('/tasks/:id', validate(updateTaskSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const task = await prisma.projectTask.update({
            where: { id: req.params.id },
            data: {
                ...req.body,
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
        const { kanbanOrder, status } = req.body;
        const task = await prisma.projectTask.update({
            where: { id: req.params.id },
            data: { kanbanOrder, ...(status && { status }) },
        });
        sendSuccess(res, task);
    } catch (err) { next(err); }
});

// Delete task
router.delete('/tasks/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        await prisma.projectTask.delete({ where: { id: req.params.id } });
        sendMessage(res, 'Task deleted');
    } catch (err) { next(err); }
});

export default router;
