import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendSuccess, sendCreated, sendMessage, sendPaginated } from '../utils/response';
import { NotFoundError, ValidationError } from '../utils/errors';
import { parseCompactAmountInput } from '../utils/amount';
import { assertPageInstance } from '../services/pageInstances';
import { HobbyField, HobbyOptions, HobbyOptionsService } from '../services/hobbyOptions';
import { createKeyboardSchema, updateKeyboardSchema } from '../validators/modules';

const router = Router();
router.use(authenticate);

function resolveOptionValue(options: HobbyOptions, field: HobbyField, raw: unknown): string | null {
    if (raw === null || raw === undefined || String(raw).trim() === '') return null;
    const label = HobbyOptionsService.resolveLabel(options, field, raw);
    if (label === null) throw new ValidationError(`Unknown ${field} option`);
    return label;
}

function rawSpecValues(payload: unknown): string[] {
    if (Array.isArray(payload)) return payload.map((item) => String(item).trim()).filter(Boolean);
    if (typeof payload === 'string') return payload.split(',').map((item) => item.trim()).filter(Boolean);
    return [];
}

function normalizeSpecList(options: HobbyOptions, payload: unknown): string[] {
    const rank = HobbyOptionsService.specRank(options);
    return rawSpecValues(payload)
        .map((value) => resolveOptionValue(options, 'spec', value))
        .filter((value): value is string => value !== null)
        .filter((value, index, values) => values.indexOf(value) === index)
        .sort((left, right) => {
            const leftRank = rank.get(left) ?? Number.MAX_SAFE_INTEGER;
            const rightRank = rank.get(right) ?? Number.MAX_SAFE_INTEGER;
            if (leftRank !== rightRank) return leftRank - rightRank;
            return left.localeCompare(right, undefined, { sensitivity: 'base' });
        });
}

function sortStoredSpec(options: HobbyOptions, payload: unknown): string[] {
    const rank = HobbyOptionsService.specRank(options);
    return rawSpecValues(payload)
        .map((value) => HobbyOptionsService.resolveLabel(options, 'spec', value) ?? String(value).trim())
        .filter(Boolean)
        .filter((value, index, values) => values.indexOf(value) === index)
        .sort((left, right) => {
            const leftRank = rank.get(left) ?? Number.MAX_SAFE_INTEGER;
            const rightRank = rank.get(right) ?? Number.MAX_SAFE_INTEGER;
            if (leftRank !== rightRank) return leftRank - rightRank;
            return left.localeCompare(right, undefined, { sensitivity: 'base' });
        });
}

function serializeKeyboard(keyboard: any, options: HobbyOptions) {
    return {
        ...keyboard,
        spec: sortStoredSpec(options, keyboard.spec),
    };
}

function collectUnknown(options: HobbyOptions, field: HobbyField, raw: unknown, target: string[]) {
    if (raw === null || raw === undefined || String(raw).trim() === '') return;
    if (HobbyOptionsService.resolveLabel(options, field, raw) === null) target.push(String(raw).trim());
}

router.get('/', async (req, res, next) => {
    try {
        const options = await HobbyOptionsService.get();
        const userId = req.user!.userId;
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
        const where: any = { instanceId: typeof req.query.instanceId === 'string' ? req.query.instanceId : null, OR: [{ ownerId: userId }, { isShared: true }] };

        const [keyboards, total] = await Promise.all([
            prisma.keyboard.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
            }),
            prisma.keyboard.count({ where }),
        ]);
        sendPaginated(res, keyboards.map((keyboard) => serializeKeyboard(keyboard, options)), total, page, limit);
    } catch (e) { next(e); }
});

router.post('/', validate(createKeyboardSchema), async (req, res, next) => {
    try {
        const userId = req.user!.userId;
        const options = await HobbyOptionsService.get();
        await assertPageInstance(req.body.instanceId ?? null, 'KEYBOARD');
        const { name, price, category, tag, color, spec, description, note, isShared } = req.body;
        const last = await prisma.keyboard.aggregate({ where: { ownerId: userId }, _max: { sortOrder: true } });
        const keyboard = await prisma.keyboard.create({
            data: {
                name,
                price: parseCompactAmountInput(price),
                category: resolveOptionValue(options, 'category', category),
                tag: resolveOptionValue(options, 'tag', tag),
                color: resolveOptionValue(options, 'color', color),
                spec: normalizeSpecList(options, spec),
                description: resolveOptionValue(options, 'condition', description),
                note: note ?? null,
                isShared: !!isShared,
                ownerId: userId,
                instanceId: req.body.instanceId ?? null,
                sortOrder: (last._max.sortOrder ?? -1) + 1,
            },
        });
        sendCreated(res, serializeKeyboard(keyboard, options));
    } catch (e) { next(e); }
});

router.patch('/:id', validate(updateKeyboardSchema), async (req, res, next) => {
    try {
        const userId = req.user!.userId;
        const options = await HobbyOptionsService.get();
        const kb = await prisma.keyboard.findFirst({
            where: { id: req.params.id, instanceId: typeof req.query.instanceId === 'string' ? req.query.instanceId : null, OR: [{ ownerId: userId }, { isShared: true }] },
        });
        if (!kb) throw new NotFoundError('Keyboard not found');
        const { name, price, category, tag, color, spec, description, note, isShared } = req.body;
        const updated = await prisma.keyboard.update({
            where: { id: kb.id },
            data: {
                ...(name !== undefined && { name }),
                ...(price !== undefined && { price: parseCompactAmountInput(price) }),
                ...(category !== undefined && { category: resolveOptionValue(options, 'category', category) }),
                ...(tag !== undefined && { tag: resolveOptionValue(options, 'tag', tag) }),
                ...(color !== undefined && { color: resolveOptionValue(options, 'color', color) }),
                ...(spec !== undefined && { spec: normalizeSpecList(options, spec) }),
                ...(description !== undefined && { description: resolveOptionValue(options, 'condition', description) }),
                ...(note !== undefined && { note }),
                ...(isShared !== undefined && { isShared }),
            },
        });
        sendSuccess(res, serializeKeyboard(updated, options));
    } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
    try {
        const userId = req.user!.userId;
        const kb = await prisma.keyboard.findFirst({ where: { id: req.params.id, ownerId: userId, instanceId: typeof req.query.instanceId === 'string' ? req.query.instanceId : null } });
        if (!kb) throw new NotFoundError('Keyboard not found');
        await prisma.keyboard.delete({ where: { id: kb.id } });
        sendMessage(res, 'Deleted');
    } catch (e) { next(e); }
});

router.post('/import', async (req, res, next) => {
    try {
        const userId = req.user!.userId;
        const instanceId = typeof req.query.instanceId === 'string' ? req.query.instanceId : (req.body.instanceId ?? null);
        await assertPageInstance(instanceId, 'KEYBOARD');
        const rows: any[] = Array.isArray(req.body.items) ? req.body.items : [];
        if (!rows.length) return sendSuccess(res, { created: 0 });

        let options = await HobbyOptionsService.get();
        const unknown: Record<HobbyField, string[]> = {
            category: [], condition: [], spec: [], tag: [], color: [],
        };
        for (const row of rows) {
            collectUnknown(options, 'category', row.category, unknown.category);
            collectUnknown(options, 'condition', row.description, unknown.condition);
            collectUnknown(options, 'tag', row.tag, unknown.tag);
            collectUnknown(options, 'color', row.color, unknown.color);
            for (const value of rawSpecValues(row.spec)) collectUnknown(options, 'spec', value, unknown.spec);
        }
        for (const field of ['category', 'condition', 'spec', 'tag', 'color'] as const) {
            if (unknown[field].length) await HobbyOptionsService.ensureLabels(field, unknown[field]);
        }
        options = await HobbyOptionsService.get();

        const last = await prisma.keyboard.aggregate({ where: { ownerId: userId }, _max: { sortOrder: true } });
        let order = (last._max.sortOrder ?? -1) + 1;

        await prisma.keyboard.createMany({
            data: rows.map(r => {
                return {
                    name: String(r.name ?? '').trim() || 'Untitled',
                    price: parseCompactAmountInput(r.price),
                    category: resolveOptionValue(options, 'category', r.category),
                    tag: resolveOptionValue(options, 'tag', r.tag),
                    color: resolveOptionValue(options, 'color', r.color),
                    spec: normalizeSpecList(options, r.spec),
                    description: resolveOptionValue(options, 'condition', r.description),
                    note: r.note ?? null,
                    isShared: false,
                    ownerId: userId,
                    instanceId,
                    sortOrder: order++,
                };
            }),
        });

        sendCreated(res, { created: rows.length });
    } catch (e) { next(e); }
});

export default router;
