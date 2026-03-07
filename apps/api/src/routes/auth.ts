import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthService } from '../services/auth';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { loginSchema, changePasswordSchema, refreshTokenSchema } from '../validators/auth';
import { sendSuccess, sendMessage } from '../utils/response';

const REFRESH_TOKEN_COOKIE = 'ngocky_refresh_token';

const setRefreshTokenCookie = (res: Response, token: string) => {
    res.cookie(REFRESH_TOKEN_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/auth', // Only sent to auth routes
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
};

const clearRefreshTokenCookie = (res: Response) => {
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
        path: '/api/auth',
    });
};

const router = Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Too many login attempts, try again later' },
});

router.post('/login', loginLimiter, validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { accessToken, refreshToken, user } = await AuthService.login(req.body.email, req.body.password);
        setRefreshTokenCookie(res, refreshToken);
        sendSuccess(res, { accessToken, user });
    } catch (err) { next(err); }
});

router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE];
        const { accessToken, refreshToken: newRefreshToken, user } = await AuthService.refresh(refreshToken);
        setRefreshTokenCookie(res, newRefreshToken);
        sendSuccess(res, { accessToken, user });
    } catch (err) { next(err); }
});

router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE];
        if (refreshToken) {
            await AuthService.logout(refreshToken);
        }
        clearRefreshTokenCookie(res);
        sendMessage(res, 'Logged out successfully');
    } catch (err) { next(err); }
});

router.post('/change-password', authenticate, validate(changePasswordSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        await AuthService.changePassword(req.user!.userId, req.body.currentPassword, req.body.newPassword);
        sendMessage(res, 'Password changed successfully');
    } catch (err) { next(err); }
});

router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { prisma } = await import('../config/database');
        const user = await prisma.user.findUnique({
            where: { id: req.user!.userId },
            select: { id: true, email: true, name: true, role: true, theme: true, active: true, notificationEnabled: true, notificationChannel: true, notificationEmail: true, telegramChatId: true },
        });
        sendSuccess(res, user);
    } catch (err) { next(err); }
});

export default router;
