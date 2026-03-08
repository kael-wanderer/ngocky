import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { config } from '../config/env';
import { UnauthorizedError } from '../utils/errors';
import { AuthPayload } from '../middleware/auth';

export class AuthService {
    static async login(email: string, password: string) {
        const user: any = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.active) {
            throw new UnauthorizedError('Invalid credentials');
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            throw new UnauthorizedError('Invalid credentials');
        }

        if (user.mfaEnabled && user.mfaSecret) {
            return {
                mfaRequired: true,
                mfaToken: this.generateMfaChallengeToken(user),
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    theme: user.theme,
                    mfaEnabled: true,
                },
            };
        }

        const accessToken = this.generateAccessToken(user);
        const refreshToken = await this.generateRefreshToken(user.id);

        return {
            mfaRequired: false,
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                theme: user.theme,
                mfaEnabled: !!user.mfaEnabled,
                avatarUrl: user.avatarUrl ?? null,
            },
        };
    }

    static async completeMfaLogin(mfaToken: string) {
        const payload = this.verifyMfaChallengeToken(mfaToken);
        const user: any = await prisma.user.findUnique({ where: { id: payload.userId } });
        if (!user || !user.active || !user.mfaEnabled) {
            throw new UnauthorizedError('Invalid MFA session');
        }

        const accessToken = this.generateAccessToken(user);
        const refreshToken = await this.generateRefreshToken(user.id);

        return {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                theme: user.theme,
                mfaEnabled: true,
                avatarUrl: user.avatarUrl ?? null,
            },
        };
    }

    static async refresh(refreshTokenStr: string) {
        const stored: any = await prisma.refreshToken.findUnique({
            where: { token: refreshTokenStr },
            include: { user: true },
        });

        if (!stored || stored.expiresAt < new Date() || !stored.user.active) {
            if (stored) {
                await prisma.refreshToken.delete({ where: { id: stored.id } });
            }
            throw new UnauthorizedError('Invalid refresh token');
        }

        // Rotate refresh token
        await prisma.refreshToken.delete({ where: { id: stored.id } });

        const accessToken = this.generateAccessToken(stored.user);
        const newRefreshToken = await this.generateRefreshToken(stored.user.id);

        return {
            accessToken,
            refreshToken: newRefreshToken,
            user: {
                id: stored.user.id,
                email: stored.user.email,
                name: stored.user.name,
                role: stored.user.role,
                theme: stored.user.theme,
                mfaEnabled: !!stored.user.mfaEnabled,
                avatarUrl: stored.user.avatarUrl ?? null,
            },
        };
    }

    static async logout(refreshTokenStr: string) {
        await prisma.refreshToken.deleteMany({ where: { token: refreshTokenStr } });
    }

    static async changePassword(userId: string, currentPassword: string, newPassword: string) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new UnauthorizedError('User not found');

        const valid = await bcrypt.compare(currentPassword, user.password);
        if (!valid) throw new UnauthorizedError('Current password is incorrect');

        const hashed = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

        // Invalidate all refresh tokens for this user
        await prisma.refreshToken.deleteMany({ where: { userId } });
    }

    private static generateAccessToken(user: { id: string; email: string; role: string }) {
        const payload: AuthPayload = {
            userId: user.id,
            email: user.email,
            role: user.role as any,
        };
        return jwt.sign(payload, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRY as any });
    }

    private static generateMfaChallengeToken(user: { id: string; email: string; role: string }) {
        return jwt.sign({ userId: user.id, email: user.email, role: user.role, stage: 'mfa' }, config.JWT_SECRET, { expiresIn: '10m' });
    }

    static verifyMfaChallengeToken(token: string) {
        try {
            const payload = jwt.verify(token, config.JWT_SECRET) as AuthPayload & { stage?: string };
            if (payload.stage !== 'mfa') throw new UnauthorizedError('Invalid MFA session');
            return payload;
        } catch {
            throw new UnauthorizedError('Invalid MFA session');
        }
    }

    private static async generateRefreshToken(userId: string): Promise<string> {
        const token = crypto.randomBytes(64).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await prisma.refreshToken.create({
            data: { token, userId, expiresAt },
        });

        return token;
    }

    static async seedOwner() {
        const existing = await prisma.user.findFirst({ where: { role: 'OWNER' } });
        if (existing) {
            console.log('✅ Owner already exists, skipping seed');
            return;
        }

        const hashed = await bcrypt.hash(config.OWNER_PASSWORD, 12);
        await prisma.user.create({
            data: {
                email: config.OWNER_EMAIL,
                name: config.OWNER_NAME,
                password: hashed,
                role: 'OWNER',
                active: true,
            },
        });
        console.log(`✅ Owner account created: ${config.OWNER_EMAIL}`);
    }
}
