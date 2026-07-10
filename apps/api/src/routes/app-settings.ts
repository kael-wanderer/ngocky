import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppSettingsService } from '../services/appSettings';
import { updateAppSettingsSchema, setOpenaiKeySchema } from '../validators/appSettings';

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

// OpenAI key management — write-only: responses carry status, never the key.
router.get('/openai-key', authenticate, authorize('OWNER'), async (_req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await AppSettingsService.getOpenaiKeyStatus());
    } catch (err) {
        next(err);
    }
});

router.put(
    '/openai-key',
    authenticate,
    authorize('OWNER'),
    validate(setOpenaiKeySchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await AppSettingsService.setOpenaiKey(req.body.key);
            res.json(await AppSettingsService.getOpenaiKeyStatus());
        } catch (err) {
            next(err);
        }
    },
);

router.delete('/openai-key', authenticate, authorize('OWNER'), async (_req: Request, res: Response, next: NextFunction) => {
    try {
        await AppSettingsService.clearOpenaiKey();
        res.json(await AppSettingsService.getOpenaiKeyStatus());
    } catch (err) {
        next(err);
    }
});

export default router;
