import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1, 'Password is required'),
});

export const verifyMfaSchema = z.object({
    mfaToken: z.string().min(1),
    code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const refreshTokenSchema = z.object({
    refreshToken: z.string().min(1),
});
