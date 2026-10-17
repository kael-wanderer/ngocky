import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { HobbyField, HobbyOptionsService } from '../services/hobbyOptions';
import {
    createHobbyOptionSchema,
    deleteHobbyOptionSchema,
    hobbyFieldParamsSchema,
    hobbyOptionParamsSchema,
    reorderHobbyOptionsSchema,
    updateHobbyOptionSchema,
} from '../validators/hobbyOptions';

const router = Router();
router.use(authenticate);

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await HobbyOptionsService.getWithUsage());
    } catch (err) {
        next(err);
    }
});

router.post(
    '/:field',
    authorize('OWNER', 'ADMIN'),
    validate(hobbyFieldParamsSchema, 'params'),
    validate(createHobbyOptionSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            res.status(201).json(await HobbyOptionsService.add(req.params.field as HobbyField, req.body));
        } catch (err) {
            next(err);
        }
    },
);

router.put(
    '/:field/order',
    authorize('OWNER', 'ADMIN'),
    validate(hobbyFieldParamsSchema, 'params'),
    validate(reorderHobbyOptionsSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            res.json(await HobbyOptionsService.reorder(req.params.field as HobbyField, req.body.ids));
        } catch (err) {
            next(err);
        }
    },
);

router.patch(
    '/:field/:id',
    authorize('OWNER', 'ADMIN'),
    validate(hobbyOptionParamsSchema, 'params'),
    validate(updateHobbyOptionSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            res.json(await HobbyOptionsService.update(req.params.field as HobbyField, req.params.id, req.body));
        } catch (err) {
            next(err);
        }
    },
);

router.delete(
    '/:field/:id',
    authorize('OWNER', 'ADMIN'),
    validate(hobbyOptionParamsSchema, 'params'),
    validate(deleteHobbyOptionSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await HobbyOptionsService.remove(req.params.field as HobbyField, req.params.id, req.body);
            res.status(204).end();
        } catch (err) {
            next(err);
        }
    },
);

export default router;
