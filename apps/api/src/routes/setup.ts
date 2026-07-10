import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { validate } from '../middleware/validate';
import { AppSettingsService } from '../services/appSettings';
import { hashPassword } from '../services/auth';
import { setupSchema } from '../validators/setup';

const router = Router();

router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const count = await prisma.user.count();
        res.json({ needsSetup: count === 0 });
    } catch (err) {
        next(err);
    }
});

router.post('/', validate(setupSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const count = await prisma.user.count();
        if (count > 0) {
            return res.status(403).json({ error: 'Setup already completed' });
        }

        const { appName, enabledGroups, owner } = req.body;
        await prisma.user.create({
            data: {
                email: owner.email,
                name: owner.name,
                password: await hashPassword(owner.password),
                role: 'OWNER',
                active: true,
            },
        });
        await AppSettingsService.update({ appName, enabledGroups, setupCompleted: true });
        res.status(201).json({ ok: true });
    } catch (err) {
        next(err);
    }
});

export default router;
