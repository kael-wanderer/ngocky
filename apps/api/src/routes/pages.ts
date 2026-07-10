import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createPageSchema, updatePageSchema } from '../validators/pages';
import { NotFoundError } from '../utils/errors';

const router = Router();

router.use(authenticate);

function slugify(name: string) {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/gi, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'page';
}

async function uniqueSlug(name: string, currentId?: string) {
    const base = slugify(name);
    let slug = base;
    for (let i = 2; ; i++) {
        const existing = await prisma.pageInstance.findUnique({ where: { slug } });
        if (!existing || existing.id === currentId) return slug;
        slug = `${base}-${i}`;
    }
}

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const pages = await prisma.pageInstance.findMany({
            orderBy: [{ group: 'asc' }, { createdAt: 'asc' }],
        });
        res.json(pages);
    } catch (err) {
        next(err);
    }
});

router.post('/', authorize('OWNER', 'ADMIN'), validate(createPageSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = await prisma.pageInstance.create({
            data: {
                ...req.body,
                slug: await uniqueSlug(req.body.name),
                createdById: req.user!.userId,
            },
        });
        res.status(201).json(page);
    } catch (err) {
        next(err);
    }
});

router.put('/:id', authorize('OWNER', 'ADMIN'), validate(updatePageSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const existing = await prisma.pageInstance.findUnique({ where: { id: req.params.id } });
        if (!existing) throw new NotFoundError('Page');

        const page = await prisma.pageInstance.update({
            where: { id: req.params.id },
            data: {
                ...req.body,
                ...(req.body.name ? { slug: await uniqueSlug(req.body.name, existing.id) } : {}),
            },
        });
        res.json(page);
    } catch (err) {
        next(err);
    }
});

router.delete('/:id', authorize('OWNER', 'ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const existing = await prisma.pageInstance.findUnique({ where: { id: req.params.id } });
        if (!existing) throw new NotFoundError('Page');

        const [tasks, projects, expenses, goals] = await Promise.all([
            prisma.task.count({ where: { instanceId: existing.id } }),
            prisma.project.count({ where: { instanceId: existing.id } }),
            prisma.expense.count({ where: { instanceId: existing.id } }),
            prisma.goal.count({ where: { instanceId: existing.id } }),
        ]);
        const deletedItems = tasks + projects + expenses + goals;

        await prisma.pageInstance.delete({ where: { id: existing.id } });
        res.json({ deletedItems });
    } catch (err) {
        next(err);
    }
});

export default router;
