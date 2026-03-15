import { z } from 'zod';

export const createUserSchema = z.object({
    email: z.string().email(),
    name: z.string().min(1).max(100),
    password: z.string().min(8),
    role: z.enum(['ADMIN', 'USER']).default('USER'),
});

export const updateUserSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    role: z.enum(['ADMIN', 'USER']).optional(),
    notificationEnabled: z.boolean().optional(),
    notificationChannel: z.enum(['EMAIL', 'TELEGRAM', 'BOTH']).optional(),
    notificationEmail: z.string().email().nullable().optional(),
    telegramChatId: z.string().nullable().optional(),
    theme: z.enum([
        'BLUE_PURPLE',
        'GREY_BLACK',
        'RED_ACCENT',
        'DARK',
        'MODERN_GREEN',
        'MULTI_COLOR_BLOCK',
        'PAPER_MINT',
        'AMBER_LEDGER',
        'OCEAN_INK',
        'MIDNIGHT_PLUM',
        'SAKURA',
        'FOREST_NIGHT',
    ]).optional(),
});

export const resetPasswordSchema = z.object({
    newPassword: z.string().min(8),
});
