import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { validate } from '../middleware/validate';
import { normalizeGroups } from '../services/appSettings';
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

        const { appName, enabledGroups, owner, hiddenPages } = req.body;
        const password = await hashPassword(owner.password);
        const builtInPages = Object.fromEntries((hiddenPages ?? []).map((type: string) => [type, { visible: false }]));

        await prisma.$transaction(async (tx) => {
            await tx.user.create({
                data: {
                    email: owner.email,
                    name: owner.name,
                    password,
                    role: 'OWNER',
                    active: true,
                },
            });
            await tx.appSetting.upsert({
                where: { id: 1 },
                update: {
                    appName,
                    enabledGroups: normalizeGroups(enabledGroups),
                    setupCompleted: true,
                    ...(Object.keys(builtInPages).length > 0 ? { builtInPages } : {}),
                },
                create: {
                    id: 1,
                    appName,
                    enabledGroups: normalizeGroups(enabledGroups),
                    setupCompleted: true,
                    ...(Object.keys(builtInPages).length > 0 ? { builtInPages } : {}),
                },
            });
        });
        res.status(201).json({ ok: true });
    } catch (err) {
        next(err);
    }
});

export default router;
