import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { builtInPageParamsSchema, createPageSchema, updateBuiltInPageSchema, updatePageSchema } from '../validators/pages';
import { applyBuiltInPageOverrides, PAGE_TEMPLATES, PAGE_TEMPLATE_BY_TYPE, type BuiltInPageOverride } from '../config/pageTemplates';
import { countPageRoots, getPageInstance } from '../services/pageInstances';

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

async function uniqueSlug(name: string) {
    const base = slugify(name);
    let slug = base;
    for (let i = 2; ; i++) {
        const existing = await prisma.pageInstance.findUnique({ where: { slug } });
        if (!existing) return slug;
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

router.get('/templates', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const settings = await prisma.appSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
        res.json(applyBuiltInPageOverrides(settings.builtInPages));
    } catch (err) { next(err); }
});

router.put(
    '/templates/:moduleType',
    authorize('OWNER', 'ADMIN'),
    validate(builtInPageParamsSchema, 'params'),
    validate(updateBuiltInPageSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const settings = await prisma.appSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
            const current = settings.builtInPages && typeof settings.builtInPages === 'object' && !Array.isArray(settings.builtInPages)
                ? settings.builtInPages as Record<string, BuiltInPageOverride>
                : {};
            const moduleType = req.params.moduleType;
            const builtInPages = { ...current, [moduleType]: { ...current[moduleType], ...req.body } };
            const updated = await prisma.appSetting.update({ where: { id: 1 }, data: { builtInPages } });
            res.json(applyBuiltInPageOverrides(updated.builtInPages).find((template) => template.moduleType === moduleType));
        } catch (err) { next(err); }
    },
);

router.get('/:id/delete-preview', authorize('OWNER', 'ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = await getPageInstance(req.params.id);
        res.json({
            id: page.id,
            name: page.name,
            moduleType: page.moduleType,
            rootLabel: PAGE_TEMPLATE_BY_TYPE[page.moduleType].rootLabel,
            itemCount: await countPageRoots(page.id, page.moduleType),
        });
    } catch (err) { next(err); }
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
        await getPageInstance(req.params.id);

        const page = await prisma.pageInstance.update({
            where: { id: req.params.id },
            data: {
                ...req.body,
            },
        });
        res.json(page);
    } catch (err) {
        next(err);
    }
});

router.delete('/:id', authorize('OWNER', 'ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const existing = await getPageInstance(req.params.id);
        const deletedItems = await countPageRoots(existing.id, existing.moduleType);

        await prisma.pageInstance.delete({ where: { id: existing.id } });
        res.json({ deletedItems });
    } catch (err) {
        next(err);
    }
});

export default router;
