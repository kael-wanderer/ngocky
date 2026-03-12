import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendSuccess, sendMessage } from '../utils/response';
import { config } from '../config/env';
import { buildOtpAuthUrl, buildQrCodeUrl, generateTotpSecret, verifyTotpCode } from '../utils/mfa';
import { UnauthorizedError, ValidationError } from '../utils/errors';
import { updateOwnModuleColorSchema } from '../validators/settings';
import { CAKEO_COLOR_MODULE, CALENDAR_COLOR_MODULE, getModuleColorSettings, resetOwnModuleColorSetting, saveOwnModuleColorSetting } from '../utils/colorSettings';

const router = Router();
router.use(authenticate);

const profileSelect: any = {
    id: true,
    email: true,
    name: true,
    role: true,
    theme: true,
    mfaEnabled: true,
    notificationEnabled: true,
    notificationChannel: true,
    notificationEmail: true,
    telegramChatId: true,
    timezone: true,
    avatarUrl: true,
    mobileNavItems: true,
    featureGoals: true,
    featureProjects: true,
    featureIdeas: true,
    featureLearning: true,
    featureExpenses: true,
    featureTasks: true,
    featureHousework: true,
    featureAssets: true,
    featureCalendar: true,
    featureKeyboard: true,
    featureFunds: true,
    featureCaKeo: true,
} as const;

const PHONE_VIEW_ALLOWED_ROUTES = [
    '/',
    '/reports',
    '/tasks',
    '/projects',
    '/expenses',
    '/goals',
    '/ideas',
    '/calendar',
    '/cakeo',
    '/housework',
    '/assets',
    '/keyboard',
    '/funds',
    '/learning',
    '/settings',
] as const;

function normalizeMobileNavItems(value: unknown) {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) throw new ValidationError('Phone View must be an array of routes');

    const next = value
        .map((item) => String(item))
        .filter((item) => PHONE_VIEW_ALLOWED_ROUTES.includes(item as any));

    if (next.length < 3 || next.length > 6) throw new ValidationError('Phone View must contain between 3 and 6 modules');
    if (new Set(next).size !== next.length) throw new ValidationError('Phone View modules must be unique');

    return next;
}

// Get profile/settings
router.get('/profile', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user: any = await prisma.user.findUnique({
            where: { id: req.user!.userId },
            select: profileSelect,
        });
        sendSuccess(res, user);
    } catch (err) { next(err); }
});

// Update profile
router.patch('/profile', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const allowedFields = [
            'name',
            'email',
            'theme',
            'notificationEnabled',
            'notificationChannel',
            'notificationEmail',
            'telegramChatId',
            'timezone',
            'avatarUrl',
            'mobileNavItems',
            'featureGoals',
            'featureProjects',
            'featureIdeas',
            'featureLearning',
            'featureExpenses',
            'featureTasks',
            'featureHousework',
            'featureAssets',
            'featureCalendar',
            'featureKeyboard',
            'featureFunds',
            'featureCaKeo',
        ];
        const data: any = {};
        allowedFields.forEach((f) => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
        const mobileNavItems = normalizeMobileNavItems(req.body.mobileNavItems);
        if (mobileNavItems !== undefined) data.mobileNavItems = mobileNavItems;

        const user = await prisma.user.update({
            where: { id: req.user!.userId },
            data,
            select: profileSelect,
        });
        sendSuccess(res, user);
    } catch (err) { next(err); }
});

router.get('/color-settings/cakeo', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await getModuleColorSettings(CAKEO_COLOR_MODULE, req.user!.userId);
        sendSuccess(res, data);
    } catch (err) { next(err); }
});

router.put('/color-settings/cakeo', validate(updateOwnModuleColorSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await saveOwnModuleColorSetting(CAKEO_COLOR_MODULE, req.user!.userId, req.body.color);
        sendSuccess(res, data);
    } catch (err) { next(err); }
});

router.post('/color-settings/cakeo/reset', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await resetOwnModuleColorSetting(CAKEO_COLOR_MODULE, req.user!.userId);
        sendSuccess(res, data);
    } catch (err) { next(err); }
});

router.get('/color-settings/calendar', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await getModuleColorSettings(CALENDAR_COLOR_MODULE, req.user!.userId);
        sendSuccess(res, data);
    } catch (err) { next(err); }
});

router.put('/color-settings/calendar', validate(updateOwnModuleColorSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await saveOwnModuleColorSetting(CALENDAR_COLOR_MODULE, req.user!.userId, req.body.color);
        sendSuccess(res, data);
    } catch (err) { next(err); }
});

router.post('/color-settings/calendar/reset', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await resetOwnModuleColorSetting(CALENDAR_COLOR_MODULE, req.user!.userId);
        sendSuccess(res, data);
    } catch (err) { next(err); }
});

router.get('/mfa', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user: any = await prisma.user.findUnique({
            where: { id: req.user!.userId },
            select: { email: true, mfaEnabled: true, mfaPendingSecret: true } as any,
        });
        if (!user) throw new UnauthorizedError();

        if (!user.mfaPendingSecret) {
            return sendSuccess(res, { enabled: !!user.mfaEnabled, pending: false });
        }

        const appName = 'NgốcKý';
        const otpauthUrl = buildOtpAuthUrl(user.mfaPendingSecret, user.email, appName);
        return sendSuccess(res, {
            enabled: !!user.mfaEnabled,
            pending: true,
            manualKey: user.mfaPendingSecret,
            otpauthUrl,
            qrCodeUrl: buildQrCodeUrl(otpauthUrl),
        });
    } catch (err) { next(err); }
});

router.post('/mfa/setup', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const existing: any = await prisma.user.findUnique({
            where: { id: req.user!.userId },
            select: { email: true, mfaEnabled: true } as any,
        });
        if (!existing) throw new UnauthorizedError();

        const secret = generateTotpSecret();
        await prisma.user.update({
            where: { id: req.user!.userId },
            data: { mfaPendingSecret: secret } as any,
        });

        const appName = 'NgốcKý';
        const otpauthUrl = buildOtpAuthUrl(secret, existing.email, appName);
        sendSuccess(res, {
            enabled: !!existing.mfaEnabled,
            pending: true,
            manualKey: secret,
            otpauthUrl,
            qrCodeUrl: buildQrCodeUrl(otpauthUrl),
        });
    } catch (err) { next(err); }
});

router.post('/mfa/enable', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const code = String(req.body.code || '');
        const user: any = await prisma.user.findUnique({
            where: { id: req.user!.userId },
            select: { mfaPendingSecret: true } as any,
        });
        if (!user?.mfaPendingSecret || !verifyTotpCode(user.mfaPendingSecret, code)) {
            throw new UnauthorizedError('Invalid verification code');
        }

        await prisma.user.update({
            where: { id: req.user!.userId },
            data: {
                mfaEnabled: true,
                mfaSecret: user.mfaPendingSecret,
                mfaPendingSecret: null,
            } as any,
        });
        sendMessage(res, 'MFA enabled');
    } catch (err) { next(err); }
});

router.post('/mfa/disable', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const code = String(req.body.code || '');
        const user: any = await prisma.user.findUnique({
            where: { id: req.user!.userId },
            select: { mfaEnabled: true, mfaSecret: true } as any,
        });
        if (!user?.mfaEnabled || !user.mfaSecret || !verifyTotpCode(user.mfaSecret, code)) {
            throw new UnauthorizedError('Invalid verification code');
        }

        await prisma.user.update({
            where: { id: req.user!.userId },
            data: {
                mfaEnabled: false,
                mfaSecret: null,
                mfaPendingSecret: null,
            } as any,
        });
        sendMessage(res, 'MFA disabled');
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
