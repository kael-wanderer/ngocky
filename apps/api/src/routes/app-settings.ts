import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppSettingsService } from '../services/appSettings';
import { updateAppSettingsSchema } from '../validators/appSettings';

const router = Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await AppSettingsService.get());
    } catch (err) {
        next(err);
    }
});

router.put(
    '/',
    authenticate,
    authorize('OWNER'),
    validate(updateAppSettingsSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            res.json(await AppSettingsService.update(req.body));
        } catch (err) {
            next(err);
        }
    },
);

export default router;
