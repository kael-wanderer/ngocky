import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { sendSuccess, sendCreated, sendMessage } from '../utils/response';
import { NotFoundError } from '../utils/errors';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
    try {
        const userId = req.user!.userId;
        const keyboards = await prisma.keyboard.findMany({
            where: { OR: [{ ownerId: userId }, { isShared: true }] },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        });
        sendSuccess(res, keyboards);
    } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
    try {
        const userId = req.user!.userId;
        const { name, price, category, tag, color, spec, extras, description, note, stab, switchAlpha, switchMod, assembler, isShared } = req.body;
        const last = await prisma.keyboard.aggregate({ where: { ownerId: userId }, _max: { sortOrder: true } });
        const keyboard = await prisma.keyboard.create({
            data: {
                name,
                price: price != null ? Number(price) : null,
                category: category ?? null,
                tag: tag ?? null,
                color: color ?? null,
                spec: spec ?? [],
                extras: extras ?? [],
                description: description ?? null,
                note: note ?? null,
                stab: stab ?? null,
                switchAlpha: switchAlpha ?? null,
                switchMod: switchMod ?? null,
                assembler: assembler ?? null,
                isShared: !!isShared,
                ownerId: userId,
                sortOrder: (last._max.sortOrder ?? -1) + 1,
            },
        });
        sendCreated(res, keyboard);
    } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
    try {
        const userId = req.user!.userId;
        const kb = await prisma.keyboard.findFirst({
            where: { id: req.params.id, OR: [{ ownerId: userId }, { isShared: true }] },
        });
        if (!kb) throw new NotFoundError('Keyboard not found');
        const { name, price, category, tag, color, spec, extras, description, note, stab, switchAlpha, switchMod, assembler, isShared } = req.body;
        const updated = await prisma.keyboard.update({
            where: { id: kb.id },
            data: {
                ...(name !== undefined && { name }),
                ...(price !== undefined && { price: price != null ? Number(price) : null }),
                ...(category !== undefined && { category }),
                ...(tag !== undefined && { tag }),
                ...(color !== undefined && { color }),
                ...(spec !== undefined && { spec }),
                ...(extras !== undefined && { extras }),
                ...(description !== undefined && { description }),
                ...(note !== undefined && { note }),
                ...(stab !== undefined && { stab }),
                ...(switchAlpha !== undefined && { switchAlpha }),
                ...(switchMod !== undefined && { switchMod }),
                ...(assembler !== undefined && { assembler }),
                ...(isShared !== undefined && { isShared }),
            },
        });
        sendSuccess(res, updated);
    } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
    try {
        const userId = req.user!.userId;
        const kb = await prisma.keyboard.findFirst({ where: { id: req.params.id, ownerId: userId } });
        if (!kb) throw new NotFoundError('Keyboard not found');
        await prisma.keyboard.delete({ where: { id: kb.id } });
        sendMessage(res, 'Deleted');
    } catch (e) { next(e); }
});

router.post('/import', async (req, res, next) => {
    try {
        const userId = req.user!.userId;
        const rows: any[] = req.body.items ?? [];
        if (!rows.length) return sendSuccess(res, { created: 0 });

        const last = await prisma.keyboard.aggregate({ where: { ownerId: userId }, _max: { sortOrder: true } });
        let order = (last._max.sortOrder ?? -1) + 1;

        await prisma.keyboard.createMany({
            data: rows.map(r => ({
                name: String(r.name ?? '').trim() || 'Untitled',
                price: r.price != null ? Number(r.price) : null,
                category: r.category ?? null,
                tag: r.tag ?? null,
                color: r.color ?? null,
                spec: Array.isArray(r.spec) ? r.spec : (r.spec ? String(r.spec).split(',').map((s: string) => s.trim()).filter(Boolean) : []),
                extras: Array.isArray(r.extras) ? r.extras : (r.extras ? String(r.extras).split(',').map((s: string) => s.trim()).filter(Boolean) : []),
                description: r.description ?? null,
                note: r.note ?? null,
                stab: r.stab ?? null,
                switchAlpha: r.switchAlpha ?? null,
                switchMod: r.switchMod ?? null,
                assembler: r.assembler ?? null,
                isShared: false,
                ownerId: userId,
                sortOrder: order++,
            })),
        });

        sendCreated(res, { created: rows.length });
    } catch (e) { next(e); }
});

export default router;
