import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createProjectSchema, updateProjectSchema } from '../validators/modules';
import { sendSuccess, sendCreated, sendPaginated, sendMessage } from '../utils/response';
import { NotFoundError } from '../utils/errors';

const router = Router();
router.use(authenticate);

// List projects
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
        const status = req.query.status as string;
        const assigneeId = req.query.assigneeId as string;

        const where: any = {};
        if (status) where.status = status;
        if (assigneeId) where.assigneeId = assigneeId;

        const [projects, total] = await Promise.all([
            prisma.project.findMany({
                where, skip: (page - 1) * limit, take: limit,
                include: {
                    assignee: { select: { id: true, name: true } },
                    createdBy: { select: { id: true, name: true } },
                },
                orderBy: [{ kanbanOrder: 'asc' }, { createdAt: 'desc' }],
            }),
            prisma.project.count({ where }),
        ]);

        sendPaginated(res, projects, total, page, limit);
    } catch (err) { next(err); }
});

// Create project
router.post('/', validate(createProjectSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const project = await prisma.project.create({
            data: {
                ...req.body,
                deadline: req.body.deadline ? new Date(req.body.deadline) : undefined,
                createdById: req.user!.userId,
            },
            include: { assignee: { select: { id: true, name: true } } },
        });
        sendCreated(res, project);
    } catch (err) { next(err); }
});

// Get project
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const project = await prisma.project.findUnique({
            where: { id: req.params.id },
            include: {
                assignee: { select: { id: true, name: true } },
                createdBy: { select: { id: true, name: true } },
            },
        });
        if (!project) throw new NotFoundError('Project');
        sendSuccess(res, project);
    } catch (err) { next(err); }
});

// Update project
router.patch('/:id', validate(updateProjectSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const project = await prisma.project.update({
            where: { id: req.params.id },
            data: {
                ...req.body,
                deadline: req.body.deadline ? new Date(req.body.deadline) : req.body.deadline,
            },
            include: { assignee: { select: { id: true, name: true } } },
        });
        sendSuccess(res, project);
    } catch (err) { next(err); }
});

// Reorder (kanban)
router.patch('/:id/reorder', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { kanbanOrder, status } = req.body;
        const project = await prisma.project.update({
            where: { id: req.params.id },
            data: { kanbanOrder, ...(status && { status }) },
        });
        sendSuccess(res, project);
    } catch (err) { next(err); }
});

// Delete project
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        await prisma.project.delete({ where: { id: req.params.id } });
        sendMessage(res, 'Project deleted');
    } catch (err) { next(err); }
});

export default router;
