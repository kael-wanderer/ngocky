import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { sendSuccess, sendMessage } from '../utils/response';
import { config } from '../config/env';

const router = Router();
router.use(authenticate);

// Get profile/settings
router.get('/profile', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.userId },
            select: {
                id: true, email: true, name: true, role: true, theme: true,
                notificationEnabled: true, notificationChannel: true,
                notificationEmail: true, telegramChatId: true,
            },
        });
        sendSuccess(res, user);
    } catch (err) { next(err); }
});

// Update profile
router.patch('/profile', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const allowedFields = ['name', 'theme', 'notificationEnabled', 'notificationChannel', 'notificationEmail', 'telegramChatId'];
        const data: any = {};
        allowedFields.forEach((f) => { if (req.body[f] !== undefined) data[f] = req.body[f]; });

        const user = await prisma.user.update({
            where: { id: req.user!.userId },
            data,
            select: {
                id: true, email: true, name: true, role: true, theme: true,
                notificationEnabled: true, notificationChannel: true,
                notificationEmail: true, telegramChatId: true,
            },
        });
        sendSuccess(res, user);
    } catch (err) { next(err); }
});

// Budget settings
router.get('/budgets', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const budgets = await prisma.budgetSetting.findMany({
            where: { userId: req.user!.userId },
            orderBy: { category: 'asc' },
        });
        sendSuccess(res, budgets);
    } catch (err) { next(err); }
});

router.post('/budgets', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const budget = await prisma.budgetSetting.create({
            data: { ...req.body, userId: req.user!.userId },
        });
        sendSuccess(res, budget);
    } catch (err) { next(err); }
});

router.patch('/budgets/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const budget = await prisma.budgetSetting.update({
            where: { id: req.params.id },
            data: req.body,
        });
        sendSuccess(res, budget);
    } catch (err) { next(err); }
});

router.delete('/budgets/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        await prisma.budgetSetting.delete({ where: { id: req.params.id } });
        sendMessage(res, 'Budget deleted');
    } catch (err) { next(err); }
});

// App info
router.get('/app-info', async (_req: Request, res: Response) => {
    sendSuccess(res, {
        version: config.APP_VERSION,
        name: 'NgocKy',
        description: 'Family Productivity App',
    });
});

export default router;
