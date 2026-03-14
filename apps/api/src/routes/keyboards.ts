import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { sendSuccess, sendCreated, sendMessage, sendPaginated } from '../utils/response';
import { NotFoundError } from '../utils/errors';
import { parseCompactAmountInput } from '../utils/amount';

const router = Router();
router.use(authenticate);

function normalizeKitOnlyFields(payload: any) {
    if (payload.category === 'Kit') {
        return {
            stab: payload.stab ?? null,
            switchAlpha: payload.switchAlpha ?? null,
            switchMod: payload.switchMod ?? null,
            assembler: payload.assembler ?? null,
        };
    }

    return {
        stab: null,
        switchAlpha: null,
        switchMod: null,
        assembler: null,
    };
}

function normalizeStringList(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
    }

    if (typeof value === 'string') {
        return value.split(',').map((item) => item.trim()).filter(Boolean);
    }

    return [];
}

function mergeSpecWithExtras(spec: unknown, extras: unknown): string[] {
    return [...new Set([...normalizeStringList(spec), ...normalizeStringList(extras)])];
}

function serializeKeyboard(keyboard: any) {
    return {
        ...keyboard,
        spec: mergeSpecWithExtras(keyboard.spec, keyboard.extras),
        extras: normalizeStringList(keyboard.extras),
    };
}

router.get('/', async (req, res, next) => {
    try {
        const userId = req.user!.userId;
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
        const where = { OR: [{ ownerId: userId }, { isShared: true }] };

        const [keyboards, total] = await Promise.all([
            prisma.keyboard.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
            }),
            prisma.keyboard.count({ where }),
        ]);
        sendPaginated(res, keyboards.map(serializeKeyboard), total, page, limit);
    } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
    try {
        const userId = req.user!.userId;
        const { name, price, category, tag, color, spec, extras, description, note, stab, switchAlpha, switchMod, assembler, isShared } = req.body;
        const normalizedExtras = normalizeStringList(extras);
        const last = await prisma.keyboard.aggregate({ where: { ownerId: userId }, _max: { sortOrder: true } });
        const keyboard = await prisma.keyboard.create({
            data: {
                name,
                price: parseCompactAmountInput(price),
                category: category ?? null,
                tag: tag ?? null,
                color: color ?? null,
                spec: mergeSpecWithExtras(spec, normalizedExtras),
                extras: normalizedExtras,
                description: description ?? null,
                note: note ?? null,
                ...normalizeKitOnlyFields({ category, stab, switchAlpha, switchMod, assembler }),
                isShared: !!isShared,
                ownerId: userId,
                sortOrder: (last._max.sortOrder ?? -1) + 1,
            },
        });
        sendCreated(res, serializeKeyboard(keyboard));
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
        const nextSpec = spec !== undefined ? spec : kb.spec;
        const nextExtras = extras !== undefined ? normalizeStringList(extras) : kb.extras;
        const updated = await prisma.keyboard.update({
            where: { id: kb.id },
            data: {
                ...(name !== undefined && { name }),
                ...(price !== undefined && { price: parseCompactAmountInput(price) }),
                ...(category !== undefined && { category }),
                ...(tag !== undefined && { tag }),
                ...(color !== undefined && { color }),
                ...((spec !== undefined || extras !== undefined) && { spec: mergeSpecWithExtras(nextSpec, nextExtras) }),
                ...(extras !== undefined && { extras: nextExtras }),
                ...(description !== undefined && { description }),
                ...(note !== undefined && { note }),
                ...((category !== undefined || stab !== undefined || switchAlpha !== undefined || switchMod !== undefined || assembler !== undefined)
                    ? normalizeKitOnlyFields({
                        category: category !== undefined ? category : kb.category,
                        stab: stab !== undefined ? stab : kb.stab,
                        switchAlpha: switchAlpha !== undefined ? switchAlpha : kb.switchAlpha,
                        switchMod: switchMod !== undefined ? switchMod : kb.switchMod,
                        assembler: assembler !== undefined ? assembler : kb.assembler,
                    })
                    : {}),
                ...(isShared !== undefined && { isShared }),
            },
        });
        sendSuccess(res, serializeKeyboard(updated));
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
            data: rows.map(r => {
                const parsedExtras = normalizeStringList(r.extras);
                return {
                    name: String(r.name ?? '').trim() || 'Untitled',
                    price: parseCompactAmountInput(r.price),
                    category: r.category ?? null,
                    tag: r.tag ?? null,
                    color: r.color ?? null,
                    spec: mergeSpecWithExtras(r.spec, parsedExtras),
                    extras: parsedExtras,
                    description: r.description ?? null,
                    note: r.note ?? null,
                    ...normalizeKitOnlyFields(r),
                    isShared: false,
                    ownerId: userId,
                    sortOrder: order++,
                };
            }),
        });

        sendCreated(res, { created: rows.length });
    } catch (e) { next(e); }
});

export default router;
