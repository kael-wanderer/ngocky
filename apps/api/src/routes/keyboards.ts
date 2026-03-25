import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { sendSuccess, sendCreated, sendMessage, sendPaginated } from '../utils/response';
import { NotFoundError } from '../utils/errors';
import { parseCompactAmountInput } from '../utils/amount';

const router = Router();
router.use(authenticate);

const KEYBOARD_SPEC_ORDER = ['Base', 'Novel', 'Space', 'Accent', 'Hiragana', 'Icon Mode', 'Alpha', 'Mod', 'Fix Kit', 'Solder', 'Hotswap', 'Plate Alu', 'Plate PC', 'Plate PEI', 'Plate CF', 'Plate PP', 'Deskmat'];
const KEYBOARD_SPEC_ALIASES: Record<string, string> = {
    'icon mod': 'Icon Mode',
    'icon mode': 'Icon Mode',
    mod: 'Mod',
    'fix kit': 'Fix Kit',
    accent: 'Accent',
    base: 'Base',
    novel: 'Novel',
    space: 'Space',
    hiragana: 'Hiragana',
    alpha: 'Alpha',
    solder: 'Solder',
    hotswap: 'Hotswap',
    'plate alu': 'Plate Alu',
    'plate pc': 'Plate PC',
    'plate pei': 'Plate PEI',
    'plate cf': 'Plate CF',
    'plate pp': 'Plate PP',
    deskmat: 'Deskmat',
};
const KEYBOARD_SPEC_RANK = new Map(KEYBOARD_SPEC_ORDER.map((spec, index) => [spec, index]));

function normalizeSpecLabel(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return KEYBOARD_SPEC_ALIASES[trimmed.toLowerCase()] || trimmed;
}

function normalizeStringList(payload: any) {
    const rawValues = Array.isArray(payload)
        ? payload.map((item) => String(item).trim()).filter(Boolean)
        : typeof payload === 'string'
            ? payload.split(',').map((item) => item.trim()).filter(Boolean)
            : [];

    return rawValues
        .map(normalizeSpecLabel)
        .filter(Boolean)
        .filter((value, index, array) => array.indexOf(value) === index)
        .sort((left, right) => {
            const leftRank = KEYBOARD_SPEC_RANK.get(left) ?? Number.MAX_SAFE_INTEGER;
            const rightRank = KEYBOARD_SPEC_RANK.get(right) ?? Number.MAX_SAFE_INTEGER;
            if (leftRank !== rightRank) return leftRank - rightRank;
            return left.localeCompare(right, undefined, { sensitivity: 'base' });
        });
}

function serializeKeyboard(keyboard: any) {
    return {
        ...keyboard,
        spec: normalizeStringList(keyboard.spec),
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
        const { name, price, category, tag, color, spec, description, note, isShared } = req.body;
        const last = await prisma.keyboard.aggregate({ where: { ownerId: userId }, _max: { sortOrder: true } });
        const keyboard = await prisma.keyboard.create({
            data: {
                name,
                price: parseCompactAmountInput(price),
                category: category ?? null,
                tag: tag ?? null,
                color: color ?? null,
                spec: normalizeStringList(spec),
                description: description ?? null,
                note: note ?? null,
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
        const { name, price, category, tag, color, spec, description, note, isShared } = req.body;
        const updated = await prisma.keyboard.update({
            where: { id: kb.id },
            data: {
                ...(name !== undefined && { name }),
                ...(price !== undefined && { price: parseCompactAmountInput(price) }),
                ...(category !== undefined && { category }),
                ...(tag !== undefined && { tag }),
                ...(color !== undefined && { color }),
                ...(spec !== undefined && { spec: normalizeStringList(spec) }),
                ...(description !== undefined && { description }),
                ...(note !== undefined && { note }),
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
                return {
                    name: String(r.name ?? '').trim() || 'Untitled',
                    price: parseCompactAmountInput(r.price),
                    category: r.category ?? null,
                    tag: r.tag ?? null,
                    color: r.color ?? null,
                    spec: normalizeStringList(r.spec),
                    description: r.description ?? null,
                    note: r.note ?? null,
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
