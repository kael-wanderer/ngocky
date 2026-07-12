import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const rawEnv = { ...process.env };
const nodeEnv = rawEnv.NODE_ENV || 'development';

function emptyToUndefined(value: unknown) {
    return value === '' ? undefined : value;
}

function devSecret(name: 'JWT_SECRET' | 'JWT_REFRESH_SECRET') {
    const existing = emptyToUndefined(rawEnv[name]);
    if (existing) return existing;
    if (nodeEnv === 'production') return existing;
    const generated = crypto.randomBytes(32).toString('hex');
    console.warn(`⚠️ ${name} is unset; generated an ephemeral development secret. Set ${name} for stable sessions.`);
    return generated;
}

const envSchema = z.object({
    APP_PORT: z.string().default('3001'),
    APP_VERSION: z.string().default('1.1.0'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: z.string(),
    JWT_SECRET: z.string().min(16),
    JWT_REFRESH_SECRET: z.string().min(16),
    JWT_EXPIRY: z.string().default('15m'),
    JWT_REFRESH_EXPIRY: z.string().default('7d'),
    OWNER_NAME: z.string().default('Owner'),
    OWNER_EMAIL: z.preprocess(emptyToUndefined, z.string().email().optional()),
    OWNER_PASSWORD: z.preprocess(emptyToUndefined, z.string().min(8).optional()),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    ASSISTANT_API_KEY: z.string().min(16).default('dev-assistant-key-change-me'),
    OPENAI_API_KEY: z.string().optional(),
    APP_ENCRYPTION_KEY: z.preprocess(emptyToUndefined, z.string().min(16).optional()),
    ALLOW_PRIVATE_AGENT_ENDPOINTS: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
});

const parsed = envSchema.safeParse({
    ...rawEnv,
    JWT_SECRET: devSecret('JWT_SECRET'),
    JWT_REFRESH_SECRET: devSecret('JWT_REFRESH_SECRET'),
});

if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const config = parsed.data;

export const corsOrigins = config.CORS_ORIGIN
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
