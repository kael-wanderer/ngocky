import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendSuccess, sendCreated, sendPaginated, sendMessage } from '../utils/response';
import { NotFoundError } from '../utils/errors';
import { paramStr, queryInt } from '../utils/query';
import {
    createAssetSchema,
    updateAssetSchema,
    createMaintenanceRecordSchema,
    updateMaintenanceRecordSchema,
} from '../validators/phase2';

const router = Router();
router.use(authenticate);

async function getNextAssetSortOrder(userId: string) {
    const aggregate = await prisma.asset.aggregate({
        where: { userId },
        _max: { sortOrder: true },
    });
    return (aggregate._max.sortOrder ?? -1) + 1;
}

function buildMaintenanceEventData(asset: any, payload: any, userId: string) {
    const nextRecommendedDate = payload.nextRecommendedDate ? new Date(payload.nextRecommendedDate) : null;
    if (!nextRecommendedDate) return null;

    const serviceTypeLabel = payload.serviceType?.trim() || 'Maintenance';
    const details = [payload.description, payload.vendor && `Vendor: ${payload.vendor}`].filter(Boolean).join('\n');

    return {
        title: `${asset.name}: ${serviceTypeLabel}`,
        description: details || `Next recommended service for ${asset.name}`,
        startDate: nextRecommendedDate,
        endDate: null,
        allDay: true,
        category: 'ASSET',
        isShared: !!asset.isShared,
        notificationEnabled: !!payload.notificationEnabled,
        reminderOffsetValue: payload.reminderOffsetValue ?? null,
        reminderOffsetUnit: payload.reminderOffsetUnit ?? null,
        notificationDate: payload.notificationDate ? new Date(payload.notificationDate) : null,
        pinToDashboard: !!payload.pinToDashboard,
        createdById: userId,
    };
}

async function syncMaintenanceCalendarEvent(tx: Prisma.TransactionClient, asset: any, payload: any, userId: string, linkedEventId?: string | null) {
    const eventData = buildMaintenanceEventData(asset, payload, userId);

    if (!eventData) {
        if (linkedEventId) {
            await tx.calendarEvent.delete({ where: { id: linkedEventId } });
        }
        return null;
    }

    if (linkedEventId) {
        const event = await tx.calendarEvent.update({
            where: { id: linkedEventId },
            data: eventData,
        });
        return event.id;
    }

    const event = await tx.calendarEvent.create({
        data: eventData,
    });
    return event.id;
}

// ─── Assets ─────────────────────────────────────────────────────────────────

router.post('/reorder', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { ids } = req.body as { ids: string[] };
        if (!Array.isArray(ids)) return sendMessage(res, 'Invalid');

        const ownedAssets = await prisma.asset.findMany({
            where: { id: { in: ids }, userId: req.user!.userId },
            select: { id: true },
        });

        const ownedIds = ids.filter((id) => ownedAssets.some((asset) => asset.id === id));
        if (!ownedIds.length) throw new NotFoundError('Asset not found');

        await prisma.$transaction(ownedIds.map((id, index) => prisma.asset.update({
            where: { id },
            data: { sortOrder: index },
        })));

        sendMessage(res, 'Reordered');
    } catch (err) { next(err); }
});

router.post('/', validate(createAssetSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sortOrder = await getNextAssetSortOrder(req.user!.userId);
        const asset = await prisma.asset.create({
            data: {
                ...req.body,
                purchaseDate: req.body.purchaseDate ? new Date(req.body.purchaseDate) : undefined,
                sortOrder,
                userId: req.user!.userId,
            },
        });
        sendCreated(res, asset);
    } catch (err) { next(err); }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = queryInt(req, 'page', 1);
        const limit = queryInt(req, 'limit', 20);
        const skip = (page - 1) * limit;
        const where: any = {
            OR: [
                { userId: req.user!.userId },
                { isShared: true },
            ],
        };

        const [assets, total] = await Promise.all([
            prisma.asset.findMany({
                where,
                skip,
                take: limit,
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
            }),
            prisma.asset.count({ where }),
        ]);

        sendPaginated(res, assets, total, page, limit);
    } catch (err) { next(err); }
});

router.patch('/:id', validate(updateAssetSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = paramStr(req, 'id');
        const asset = await prisma.asset.findFirst({
            where: { id, userId: req.user!.userId },
        });
        if (!asset) throw new NotFoundError('Asset not found');

        const updated = await prisma.asset.update({
            where: { id },
            data: {
                ...req.body,
                purchaseDate: req.body.purchaseDate === null ? null : req.body.purchaseDate ? new Date(req.body.purchaseDate) : undefined,
            },
        });
        sendSuccess(res, updated);
    } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = paramStr(req, 'id');
        const asset = await prisma.asset.findFirst({
            where: { id, userId: req.user!.userId },
        });
        if (!asset) throw new NotFoundError('Asset not found');

        await prisma.asset.delete({ where: { id } });
        sendMessage(res, 'Asset deleted');
    } catch (err) { next(err); }
});

// ─── Maintenance Records ────────────────────────────────────────────────────

router.post('/:id/maintenance', validate(createMaintenanceRecordSchema.omit({ assetId: true })), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const assetId = paramStr(req, 'id');
        const asset = await prisma.asset.findFirst({
            where: { id: assetId, userId: req.user!.userId },
        });
        if (!asset) throw new NotFoundError('Asset not found');

        const record = await prisma.$transaction(async (tx) => {
            const created = await tx.maintenanceRecord.create({
                data: {
                    ...req.body,
                    serviceDate: new Date(req.body.serviceDate),
                    nextRecommendedDate: req.body.nextRecommendedDate ? new Date(req.body.nextRecommendedDate) : undefined,
                    userId: req.user!.userId,
                    assetId,
                },
            });

            const linkedEventId = await syncMaintenanceCalendarEvent(tx, asset, created, req.user!.userId, null);
            if (!linkedEventId) return created;

            return tx.maintenanceRecord.update({
                where: { id: created.id },
                data: { linkedEventId },
            });
        });
        sendCreated(res, record);
    } catch (err) { next(err); }
});

router.get('/:id/maintenance', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const assetId = paramStr(req, 'id');
        const sortBy = String(req.query.sortBy || 'time');
        const sortOrder = String(req.query.sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
        const records = await prisma.maintenanceRecord.findMany({
            where: { assetId, userId: req.user!.userId },
            orderBy: sortBy === 'cost'
                ? [{ cost: sortOrder }, { serviceDate: 'desc' }]
                : [{ serviceDate: sortOrder }, { createdAt: 'desc' }],
        });
        sendSuccess(res, records);
    } catch (err) { next(err); }
});

router.patch('/:assetId/maintenance/:recordId', validate(updateMaintenanceRecordSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const assetId = paramStr(req, 'assetId');
        const recordId = paramStr(req, 'recordId');

        const record = await prisma.maintenanceRecord.findFirst({
            where: { id: recordId, assetId, userId: req.user!.userId },
        });
        if (!record) throw new NotFoundError('Record not found');

        const asset = await prisma.asset.findFirst({
            where: { id: assetId, userId: req.user!.userId },
        });
        if (!asset) throw new NotFoundError('Asset not found');

        const updated = await prisma.$transaction(async (tx) => {
            const nextState = {
                ...record,
                ...req.body,
                serviceDate: req.body.serviceDate ? new Date(req.body.serviceDate) : record.serviceDate,
                nextRecommendedDate: req.body.nextRecommendedDate === null
                    ? null
                    : req.body.nextRecommendedDate
                        ? new Date(req.body.nextRecommendedDate)
                        : record.nextRecommendedDate,
                notificationDate: req.body.notificationDate === null
                    ? null
                    : req.body.notificationDate
                        ? new Date(req.body.notificationDate)
                        : record.notificationDate,
            };

            const linkedEventId = await syncMaintenanceCalendarEvent(
                tx,
                asset,
                nextState,
                req.user!.userId,
                record.linkedEventId,
            );

            return tx.maintenanceRecord.update({
                where: { id: recordId },
                data: {
                    ...req.body,
                    serviceDate: req.body.serviceDate ? new Date(req.body.serviceDate) : undefined,
                    nextRecommendedDate: req.body.nextRecommendedDate === null ? null : req.body.nextRecommendedDate ? new Date(req.body.nextRecommendedDate) : undefined,
                    notificationDate: req.body.notificationDate === null ? null : req.body.notificationDate ? new Date(req.body.notificationDate) : undefined,
                    linkedEventId,
                },
            });
        });
        sendSuccess(res, updated);
    } catch (err) { next(err); }
});

router.delete('/:assetId/maintenance/:recordId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const assetId = paramStr(req, 'assetId');
        const recordId = paramStr(req, 'recordId');

        const record = await prisma.maintenanceRecord.findFirst({
            where: { id: recordId, assetId, userId: req.user!.userId },
        });
        if (!record) throw new NotFoundError('Record not found');

        await prisma.$transaction(async (tx) => {
            if (record.linkedEventId) {
                await tx.calendarEvent.delete({ where: { id: record.linkedEventId } });
            }
            await tx.maintenanceRecord.delete({ where: { id: recordId } });
        });
        sendMessage(res, 'Maintenance record deleted');
    } catch (err) { next(err); }
});

export default router;
