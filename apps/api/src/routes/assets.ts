import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendSuccess, sendCreated, sendPaginated, sendMessage } from '../utils/response';
import { NotFoundError } from '../utils/errors';
import { paramStr, queryInt } from '../utils/query';
import { resolveReminderFields } from '../utils/reminders';
import {
    createAssetSchema,
    updateAssetSchema,
    createMaintenanceRecordBodySchema,
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
        type: 'EVENT',
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
        notificationTime: payload.notificationTime ?? null,
        lastNotificationSentAt: payload.lastNotificationSentAt ?? null,
        notificationCooldownHours: payload.notificationCooldownHours ?? 24,
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

async function createMaintenanceExpense(tx: Prisma.TransactionClient, payload: any, userId: string): Promise<string | null> {
    if (payload.cost == null) return null;

    const amount = Number(payload.cost);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const expense = await tx.expense.create({
        data: {
            description: payload.serviceType?.trim() || 'Maintenance',
            type: 'PAY',
            scope: 'PERSONAL',
            date: new Date(payload.serviceDate),
            category: 'Maintenance',
            amount,
            note: payload.description || null,
            isShared: false,
            userId,
        },
    });
    return expense.id;
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
                include: {
                    user: { select: { id: true, name: true } },
                },
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

router.post('/:id/maintenance', validate(createMaintenanceRecordBodySchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const assetId = paramStr(req, 'id');
        const asset = await prisma.asset.findFirst({
            where: { id: assetId, userId: req.user!.userId },
        });
        if (!asset) throw new NotFoundError('Asset not found');

        const { addToCalendar, addExpense, ...recordBody } = req.body;
        const record = await prisma.$transaction(async (tx) => {
            const reminderFields = resolveReminderFields(recordBody, {
                anchorDate: recordBody.nextRecommendedDate,
                anchorLabel: 'next recommended date',
            });
            const created = await tx.maintenanceRecord.create({
                data: {
                    ...recordBody,
                    ...reminderFields,
                    serviceDate: new Date(recordBody.serviceDate),
                    nextRecommendedDate: recordBody.nextRecommendedDate ? new Date(recordBody.nextRecommendedDate) : undefined,
                    userId: req.user!.userId,
                    assetId,
                },
            });

            let linkedExpenseId: string | null = null;
            if (addExpense) {
                linkedExpenseId = await createMaintenanceExpense(tx, created, req.user!.userId);
            }

            let linkedEventId: string | null = null;
            if (addToCalendar) {
                linkedEventId = await syncMaintenanceCalendarEvent(tx, asset, created, req.user!.userId, null);
            }

            if (!linkedEventId && !linkedExpenseId) return created;
            return tx.maintenanceRecord.update({
                where: { id: created.id },
                data: { linkedEventId: linkedEventId ?? undefined, linkedExpenseId: linkedExpenseId ?? undefined },
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

        const { addToCalendar, addExpense, ...updateBody } = req.body;
        const updated = await prisma.$transaction(async (tx) => {
            const nextState = {
                ...record,
                ...updateBody,
                serviceDate: updateBody.serviceDate ? new Date(updateBody.serviceDate) : record.serviceDate,
                nextRecommendedDate: updateBody.nextRecommendedDate === null
                    ? null
                    : updateBody.nextRecommendedDate
                        ? new Date(updateBody.nextRecommendedDate)
                        : record.nextRecommendedDate,
                notificationDate: updateBody.notificationDate === null
                    ? null
                    : updateBody.notificationDate
                        ? new Date(updateBody.notificationDate)
                        : record.notificationDate,
            };
            const reminderFields = resolveReminderFields(nextState, { anchorDate: nextState.nextRecommendedDate, anchorLabel: 'next recommended date', current: record });
            Object.assign(nextState, reminderFields);

            // Calendar event: explicit toggle or keep existing sync
            let linkedEventId: string | null | undefined = undefined;
            if (addToCalendar === false && record.linkedEventId) {
                try { await tx.calendarEvent.delete({ where: { id: record.linkedEventId } }); } catch { /* already gone */ }
                linkedEventId = null;
            } else if (addToCalendar === true || (addToCalendar === undefined && record.linkedEventId)) {
                linkedEventId = await syncMaintenanceCalendarEvent(tx, asset, nextState, req.user!.userId, record.linkedEventId);
            }

            // Expense: explicit toggle
            let linkedExpenseId: string | null | undefined = undefined;
            if (addExpense === true && !record.linkedExpenseId) {
                linkedExpenseId = await createMaintenanceExpense(tx, nextState, req.user!.userId);
            } else if (addExpense === false && record.linkedExpenseId) {
                try { await tx.expense.delete({ where: { id: record.linkedExpenseId } }); } catch { /* already gone */ }
                linkedExpenseId = null;
            }

            return tx.maintenanceRecord.update({
                where: { id: recordId },
                data: {
                    ...updateBody,
                    ...reminderFields,
                    serviceDate: updateBody.serviceDate ? new Date(updateBody.serviceDate) : undefined,
                    nextRecommendedDate: updateBody.nextRecommendedDate === null ? null : updateBody.nextRecommendedDate ? new Date(updateBody.nextRecommendedDate) : undefined,
                    ...(linkedEventId !== undefined && { linkedEventId }),
                    ...(linkedExpenseId !== undefined && { linkedExpenseId }),
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
                try { await tx.calendarEvent.delete({ where: { id: record.linkedEventId } }); } catch { /* already gone */ }
            }
            if ((record as any).linkedExpenseId) {
                try { await tx.expense.delete({ where: { id: (record as any).linkedExpenseId } }); } catch { /* already gone */ }
            }
            await tx.maintenanceRecord.delete({ where: { id: recordId } });
        });
        sendMessage(res, 'Maintenance record deleted');
    } catch (err) { next(err); }
});

export default router;
