import { Router, Request, Response, NextFunction } from 'express';
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

// ─── Assets ─────────────────────────────────────────────────────────────────

router.post('/', validate(createAssetSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const asset = await prisma.asset.create({
            data: {
                ...req.body,
                purchaseDate: req.body.purchaseDate ? new Date(req.body.purchaseDate) : undefined,
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

        const [assets, total] = await Promise.all([
            prisma.asset.findMany({
                where: { userId: req.user!.userId },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.asset.count({ where: { userId: req.user!.userId } }),
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

        const record = await prisma.maintenanceRecord.create({
            data: {
                ...req.body,
                serviceDate: new Date(req.body.serviceDate),
                nextRecommendedDate: req.body.nextRecommendedDate ? new Date(req.body.nextRecommendedDate) : undefined,
                userId: req.user!.userId,
                assetId,
            },
        });
        sendCreated(res, record);
    } catch (err) { next(err); }
});

router.get('/:id/maintenance', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const assetId = paramStr(req, 'id');
        const records = await prisma.maintenanceRecord.findMany({
            where: { assetId, userId: req.user!.userId },
            orderBy: { serviceDate: 'desc' },
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

        const updated = await prisma.maintenanceRecord.update({
            where: { id: recordId },
            data: {
                ...req.body,
                serviceDate: req.body.serviceDate ? new Date(req.body.serviceDate) : undefined,
                nextRecommendedDate: req.body.nextRecommendedDate === null ? null : req.body.nextRecommendedDate ? new Date(req.body.nextRecommendedDate) : undefined,
            },
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

        await prisma.maintenanceRecord.delete({ where: { id: recordId } });
        sendMessage(res, 'Maintenance record deleted');
    } catch (err) { next(err); }
});

export default router;
