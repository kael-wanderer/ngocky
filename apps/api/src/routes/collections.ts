import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { sendSuccess, sendCreated, sendMessage } from '../utils/response';
import { NotFoundError } from '../utils/errors';

const router = Router();
router.use(authenticate);

// ─── Collections ─────────────────────────────────────

router.get('/', async (req, res, next) => {
    try {
        const userId = req.user!.id;
        const collections = await prisma.collection.findMany({
            where: { OR: [{ ownerId: userId }, { isShared: true }] },
            include: { _count: { select: { items: true } } },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });
        sendSuccess(res, collections);
    } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
    try {
        const userId = req.user!.id;
        const { name, description, fieldSchema, isShared } = req.body;
        const last = await prisma.collection.aggregate({ where: { ownerId: userId }, _max: { sortOrder: true } });
        const collection = await prisma.collection.create({
            data: {
                name,
                description: description ?? null,
                fieldSchema: fieldSchema ?? [],
                isShared: !!isShared,
                ownerId: userId,
                sortOrder: (last._max.sortOrder ?? -1) + 1,
            },
        });
        sendCreated(res, collection);
    } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
    try {
        const userId = req.user!.id;
        const col = await prisma.collection.findFirst({
            where: { id: req.params.id, OR: [{ ownerId: userId }, { isShared: true }] },
            include: { views: { orderBy: { createdAt: 'asc' } } },
        });
        if (!col) throw new NotFoundError('Collection not found');
        sendSuccess(res, col);
    } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
    try {
        const userId = req.user!.id;
        const col = await prisma.collection.findFirst({ where: { id: req.params.id, ownerId: userId } });
        if (!col) throw new NotFoundError('Collection not found');
        const { name, description, fieldSchema, isShared } = req.body;
        const updated = await prisma.collection.update({
            where: { id: col.id },
            data: {
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(fieldSchema !== undefined && { fieldSchema }),
                ...(isShared !== undefined && { isShared }),
            },
        });
        sendSuccess(res, updated);
    } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
    try {
        const userId = req.user!.id;
        const col = await prisma.collection.findFirst({ where: { id: req.params.id, ownerId: userId } });
        if (!col) throw new NotFoundError('Collection not found');
        await prisma.collection.delete({ where: { id: col.id } });
        sendMessage(res, 'Deleted');
    } catch (e) { next(e); }
});

// ─── Items ────────────────────────────────────────────

router.get('/:id/items', async (req, res, next) => {
    try {
        const userId = req.user!.id;
        const col = await prisma.collection.findFirst({
            where: { id: req.params.id, OR: [{ ownerId: userId }, { isShared: true }] },
        });
        if (!col) throw new NotFoundError('Collection not found');

        // Build filter from query param: filters=JSON encoded array
        const rawFilters = req.query.filters ? JSON.parse(req.query.filters as string) : [];
        const items = await prisma.collectionItem.findMany({
            where: { collectionId: col.id },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });

        // Apply filters client-side (JSON field)
        const filtered = applyFilters(items, rawFilters);
        sendSuccess(res, filtered);
    } catch (e) { next(e); }
});

router.post('/:id/items', async (req, res, next) => {
    try {
        const userId = req.user!.id;
        const col = await prisma.collection.findFirst({
            where: { id: req.params.id, OR: [{ ownerId: userId }, { isShared: true }] },
        });
        if (!col) throw new NotFoundError('Collection not found');

        const { name, price, status, imageUrl, data } = req.body;
        const last = await prisma.collectionItem.aggregate({ where: { collectionId: col.id }, _max: { sortOrder: true } });
        const item = await prisma.collectionItem.create({
            data: {
                collectionId: col.id,
                name,
                price: price != null ? Number(price) : null,
                status: status ?? null,
                imageUrl: imageUrl ?? null,
                data: data ?? {},
                sortOrder: (last._max.sortOrder ?? -1) + 1,
            },
        });
        sendCreated(res, item);
    } catch (e) { next(e); }
});

router.patch('/:id/items/:itemId', async (req, res, next) => {
    try {
        const userId = req.user!.id;
        const col = await prisma.collection.findFirst({
            where: { id: req.params.id, OR: [{ ownerId: userId }, { isShared: true }] },
        });
        if (!col) throw new NotFoundError('Collection not found');
        const item = await prisma.collectionItem.findFirst({ where: { id: req.params.itemId, collectionId: col.id } });
        if (!item) throw new NotFoundError('Item not found');

        const { name, price, status, imageUrl, data } = req.body;
        const updated = await prisma.collectionItem.update({
            where: { id: item.id },
            data: {
                ...(name !== undefined && { name }),
                ...(price !== undefined && { price: price != null ? Number(price) : null }),
                ...(status !== undefined && { status }),
                ...(imageUrl !== undefined && { imageUrl }),
                ...(data !== undefined && { data }),
            },
        });
        sendSuccess(res, updated);
    } catch (e) { next(e); }
});

router.delete('/:id/items/:itemId', async (req, res, next) => {
    try {
        const userId = req.user!.id;
        const col = await prisma.collection.findFirst({
            where: { id: req.params.id, OR: [{ ownerId: userId }, { isShared: true }] },
        });
        if (!col) throw new NotFoundError('Collection not found');
        const item = await prisma.collectionItem.findFirst({ where: { id: req.params.itemId, collectionId: col.id } });
        if (!item) throw new NotFoundError('Item not found');
        await prisma.collectionItem.delete({ where: { id: item.id } });
        sendMessage(res, 'Deleted');
    } catch (e) { next(e); }
});

// ─── Views ────────────────────────────────────────────

router.get('/:id/views', async (req, res, next) => {
    try {
        const userId = req.user!.id;
        const col = await prisma.collection.findFirst({
            where: { id: req.params.id, OR: [{ ownerId: userId }, { isShared: true }] },
        });
        if (!col) throw new NotFoundError('Collection not found');
        const views = await prisma.collectionView.findMany({ where: { collectionId: col.id }, orderBy: { createdAt: 'asc' } });
        sendSuccess(res, views);
    } catch (e) { next(e); }
});

router.post('/:id/views', async (req, res, next) => {
    try {
        const userId = req.user!.id;
        const col = await prisma.collection.findFirst({
            where: { id: req.params.id, OR: [{ ownerId: userId }, { isShared: true }] },
        });
        if (!col) throw new NotFoundError('Collection not found');
        const { name, filters, sort, groupBy, visibleFields } = req.body;
        const view = await prisma.collectionView.create({
            data: { collectionId: col.id, name, filters: filters ?? [], sort: sort ?? {}, groupBy: groupBy ?? null, visibleFields: visibleFields ?? [] },
        });
        sendCreated(res, view);
    } catch (e) { next(e); }
});

router.patch('/:id/views/:viewId', async (req, res, next) => {
    try {
        const userId = req.user!.id;
        const col = await prisma.collection.findFirst({
            where: { id: req.params.id, OR: [{ ownerId: userId }, { isShared: true }] },
        });
        if (!col) throw new NotFoundError('Collection not found');
        const view = await prisma.collectionView.findFirst({ where: { id: req.params.viewId, collectionId: col.id } });
        if (!view) throw new NotFoundError('View not found');
        const { name, filters, sort, groupBy, visibleFields } = req.body;
        const updated = await prisma.collectionView.update({
            where: { id: view.id },
            data: {
                ...(name !== undefined && { name }),
                ...(filters !== undefined && { filters }),
                ...(sort !== undefined && { sort }),
                ...(groupBy !== undefined && { groupBy }),
                ...(visibleFields !== undefined && { visibleFields }),
            },
        });
        sendSuccess(res, updated);
    } catch (e) { next(e); }
});

router.delete('/:id/views/:viewId', async (req, res, next) => {
    try {
        const userId = req.user!.id;
        const col = await prisma.collection.findFirst({
            where: { id: req.params.id, OR: [{ ownerId: userId }, { isShared: true }] },
        });
        if (!col) throw new NotFoundError('Collection not found');
        const view = await prisma.collectionView.findFirst({ where: { id: req.params.viewId, collectionId: col.id } });
        if (!view) throw new NotFoundError('View not found');
        await prisma.collectionView.delete({ where: { id: view.id } });
        sendMessage(res, 'Deleted');
    } catch (e) { next(e); }
});

// ─── Filter helpers ───────────────────────────────────

type FilterCondition = { field: string; op: string; value: any };

function applyFilters(items: any[], filters: FilterCondition[]): any[] {
    if (!filters.length) return items;
    return items.filter(item => filters.every(f => matchFilter(item, f)));
}

function getFieldValue(item: any, field: string): any {
    if (['name', 'price', 'status', 'imageUrl'].includes(field)) return item[field];
    return (item.data as Record<string, any>)?.[field];
}

function matchFilter(item: any, f: FilterCondition): boolean {
    const val = getFieldValue(item, f.field);
    switch (f.op) {
        case 'eq': return String(val ?? '').toLowerCase() === String(f.value).toLowerCase();
        case 'neq': return String(val ?? '').toLowerCase() !== String(f.value).toLowerCase();
        case 'contains': return String(val ?? '').toLowerCase().includes(String(f.value).toLowerCase());
        case 'gte': return Number(val ?? 0) >= Number(f.value);
        case 'lte': return Number(val ?? 0) <= Number(f.value);
        case 'in': return Array.isArray(val)
            ? (val as string[]).some(v => (f.value as string[]).includes(v))
            : (f.value as string[]).includes(String(val ?? ''));
        case 'has': return Array.isArray(val) && (val as string[]).includes(String(f.value));
        default: return true;
    }
}

export default router;
