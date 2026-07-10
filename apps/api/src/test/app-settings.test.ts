import { describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app';
import { prisma } from '../config/database';

async function loginAsOwner() {
    const password = 'Secret123!';
    await prisma.user.create({
        data: {
            email: 'owner-settings@example.com',
            name: 'Owner',
            password: await bcrypt.hash(password, 12),
            role: 'OWNER',
            active: true,
        },
    });
    const login = await request(app).post('/api/auth/login').send({
        email: 'owner-settings@example.com',
        password,
    });
    return login.body.data.accessToken as string;
}

describe('app-settings', () => {
    it('GET is public and returns defaults', async () => {
        const res = await request(app).get('/api/app-settings');

        expect(res.status).toBe(200);
        expect(res.body.appName).toBe('NgốcKý');
        expect(res.body.enabledGroups).toContain('personal');
    });

    it('PUT requires OWNER', async () => {
        const res = await request(app).put('/api/app-settings').send({ appName: 'X' });

        expect(res.status).toBe(401);
    });

    it('PUT updates name and groups, personal cannot be disabled', async () => {
        const token = await loginAsOwner();
        const res = await request(app)
            .put('/api/app-settings')
            .set('Authorization', `Bearer ${token}`)
            .send({ appName: 'FamilyHub', enabledGroups: ['family'] });

        expect(res.status).toBe(200);
        expect(res.body.appName).toBe('FamilyHub');
        expect(res.body.enabledGroups).toEqual(expect.arrayContaining(['personal', 'family']));
        expect(res.body.enabledGroups).not.toContain('hobby');
    });
});

describe('openai key management', () => {
    async function ownerToken() {
        const bcrypt = (await import('bcryptjs')).default;
        const { prisma } = await import('../config/database');
        const request = (await import('supertest')).default;
        const app = (await import('../app')).default;
        await prisma.user.create({
            data: {
                email: 'key-owner@example.com',
                name: 'Key Owner',
                password: await bcrypt.hash('password123', 12),
                role: 'OWNER',
                active: true,
            },
        });
        const res = await request(app).post('/api/auth/login').send({ email: 'key-owner@example.com', password: 'password123' });
        return res.body.data.accessToken as string;
    }

    it('rejects unauthenticated access to key endpoints', async () => {
        const request = (await import('supertest')).default;
        const app = (await import('../app')).default;
        expect((await request(app).get('/api/app-settings/openai-key')).status).toBe(401);
        expect((await request(app).put('/api/app-settings/openai-key').send({ key: 'sk-test-1234567890abcdef' })).status).toBe(401);
    });

    it('sets, masks, and deletes the key without ever returning it', async () => {
        const request = (await import('supertest')).default;
        const app = (await import('../app')).default;
        const { prisma } = await import('../config/database');
        const { AppSettingsService } = await import('../services/appSettings');
        const { config } = await import('../config/env');
        (config as any).OPENAI_API_KEY = undefined; // isolate from host env fallback
        const token = await ownerToken();
        const auth = { Authorization: `Bearer ${token}` };
        const key = 'sk-test-secret-1234567890abcd';

        const setRes = await request(app).put('/api/app-settings/openai-key').set(auth).send({ key });
        expect(setRes.status).toBe(200);
        expect(setRes.body).toEqual({ configured: true, last4: 'abcd', source: 'db' });
        expect(JSON.stringify(setRes.body)).not.toContain(key);

        // stored encrypted, decryptable internally
        const row = await prisma.appSetting.findUnique({ where: { id: 1 } });
        expect(row.openaiKeyCiphertext).toBeTruthy();
        expect(row.openaiKeyCiphertext).not.toContain(key);
        expect(await AppSettingsService.getOpenaiKey()).toBe(key);

        // public settings endpoint must not leak key status
        const publicRes = await request(app).get('/api/app-settings');
        expect(JSON.stringify(publicRes.body)).not.toContain('abcd');
        expect(publicRes.body.openaiKey).toBeUndefined();

        const delRes = await request(app).delete('/api/app-settings/openai-key').set(auth);
        expect(delRes.status).toBe(200);
        expect(delRes.body.configured).toBe(false);
        expect(await AppSettingsService.getOpenaiKey()).toBeNull();
    });

    it('rejects too-short keys', async () => {
        const request = (await import('supertest')).default;
        const app = (await import('../app')).default;
        const token = await ownerToken();
        const res = await request(app).put('/api/app-settings/openai-key').set({ Authorization: `Bearer ${token}` }).send({ key: 'short' });
        expect(res.status).toBe(400);
    });
});
