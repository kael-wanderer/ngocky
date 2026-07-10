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
