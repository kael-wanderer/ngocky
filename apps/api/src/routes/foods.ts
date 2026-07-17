import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { sendSuccess, sendCreated, sendMessage, sendPaginated } from '../utils/response';
import { NotFoundError, ValidationError } from '../utils/errors';
import { assertPageInstance } from '../services/pageInstances';

const router = Router();
router.use(authenticate);

function normalizeRating(value: unknown) {
    if (value === undefined || value === null || value === '') return null;
    const rating = Number(value);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ValidationError('Rating must be an integer from 1 to 5');
    return rating;
}

function normalizeText(value: unknown) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text || null;
}

router.get('/', async (req, res, next) => {
    try {
        const userId = req.user!.userId;
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
        const where: any = {
            instanceId: typeof req.query.instanceId === 'string' ? req.query.instanceId : null,
            OR: [{ ownerId: userId }, { isShared: true }],
        };
        for (const key of ['tag', 'type', 'distance'] as const) {
            if (typeof req.query[key] === 'string' && req.query[key].trim()) where[key] = req.query[key].trim();
        }

        const [places, total] = await Promise.all([
            prisma.foodPlace.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
            }),
            prisma.foodPlace.count({ where }),
        ]);
        sendPaginated(res, places, total, page, limit);
    } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
    try {
        const userId = req.user!.userId;
        await assertPageInstance(req.body.instanceId ?? null, 'FOODPLACE');
        const name = String(req.body.name ?? '').trim();
        if (!name) throw new ValidationError('Name is required');
        const last = await prisma.foodPlace.aggregate({ where: { ownerId: userId }, _max: { sortOrder: true } });
        const place = await prisma.foodPlace.create({
            data: {
                name,
                tag: normalizeText(req.body.tag),
                type: normalizeText(req.body.type),
                distance: normalizeText(req.body.distance),
                address: normalizeText(req.body.address),
                district: normalizeText(req.body.district),
                openHours: normalizeText(req.body.openHours),
                priceEst: normalizeText(req.body.priceEst),
                rating: normalizeRating(req.body.rating),
                mapLink: normalizeText(req.body.mapLink),
                note: normalizeText(req.body.note),
                isShared: !!req.body.isShared,
                ownerId: userId,
                instanceId: req.body.instanceId ?? null,
                sortOrder: (last._max.sortOrder ?? -1) + 1,
            },
        });
        sendCreated(res, place);
    } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
    try {
        const userId = req.user!.userId;
        const place = await prisma.foodPlace.findFirst({
            where: {
                id: req.params.id,
                instanceId: typeof req.query.instanceId === 'string' ? req.query.instanceId : null,
                OR: [{ ownerId: userId }, { isShared: true }],
            },
        });
        if (!place) throw new NotFoundError('Food place not found');
        const updated = await prisma.foodPlace.update({
            where: { id: place.id },
            data: {
                ...(req.body.name !== undefined ? { name: String(req.body.name).trim() } : {}),
                ...(req.body.tag !== undefined ? { tag: normalizeText(req.body.tag) } : {}),
                ...(req.body.type !== undefined ? { type: normalizeText(req.body.type) } : {}),
                ...(req.body.distance !== undefined ? { distance: normalizeText(req.body.distance) } : {}),
                ...(req.body.address !== undefined ? { address: normalizeText(req.body.address) } : {}),
                ...(req.body.district !== undefined ? { district: normalizeText(req.body.district) } : {}),
                ...(req.body.openHours !== undefined ? { openHours: normalizeText(req.body.openHours) } : {}),
                ...(req.body.priceEst !== undefined ? { priceEst: normalizeText(req.body.priceEst) } : {}),
                ...(req.body.rating !== undefined ? { rating: normalizeRating(req.body.rating) } : {}),
                ...(req.body.mapLink !== undefined ? { mapLink: normalizeText(req.body.mapLink) } : {}),
                ...(req.body.note !== undefined ? { note: normalizeText(req.body.note) } : {}),
                ...(req.body.isShared !== undefined ? { isShared: !!req.body.isShared } : {}),
            },
        });
        sendSuccess(res, updated);
    } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
    try {
        const place = await prisma.foodPlace.findFirst({
            where: {
                id: req.params.id,
                ownerId: req.user!.userId,
                instanceId: typeof req.query.instanceId === 'string' ? req.query.instanceId : null,
            },
        });
        if (!place) throw new NotFoundError('Food place not found');
        await prisma.foodPlace.delete({ where: { id: place.id } });
        sendMessage(res, 'Deleted');
    } catch (e) { next(e); }
});

router.post('/import', async (req, res, next) => {
    try {
        const userId = req.user!.userId;
        const instanceId = typeof req.query.instanceId === 'string' ? req.query.instanceId : (req.body.instanceId ?? null);
        await assertPageInstance(instanceId, 'FOODPLACE');
        const rows: any[] = req.body.items ?? [];
        if (!rows.length) return sendSuccess(res, { created: 0 });
        const last = await prisma.foodPlace.aggregate({ where: { ownerId: userId }, _max: { sortOrder: true } });
        let order = (last._max.sortOrder ?? -1) + 1;
        await prisma.foodPlace.createMany({
            data: rows.map((row) => ({
                name: String(row.name ?? '').trim() || 'Untitled',
                tag: normalizeText(row.tag),
                type: normalizeText(row.type),
                distance: normalizeText(row.distance),
                address: normalizeText(row.address),
                district: normalizeText(row.district),
                openHours: normalizeText(row.openHours ?? row['open hours']),
                priceEst: normalizeText(row.priceEst ?? row.price),
                rating: normalizeRating(row.rating),
                mapLink: normalizeText(row.mapLink),
                note: normalizeText(row.note),
                isShared: false,
                ownerId: userId,
                instanceId,
                sortOrder: order++,
            })),
        });
        sendCreated(res, { created: rows.length });
    } catch (e) { next(e); }
});

export default router;
