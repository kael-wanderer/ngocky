import { describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app';
import { prisma } from '../config/database';

async function ownerToken(email: string) {
    const password = 'Secret123!';
    await prisma.user.create({ data: { email, name: 'Owner', password: await bcrypt.hash(password, 12), role: 'OWNER', active: true } });
    return (await request(app).post('/api/auth/login').send({ email, password })).body.data.accessToken as string;
}

describe('asset page instances', () => {
    it('partitions assets and protects cross-instance updates/deletes', async () => {
        const token = await ownerToken('asset-instance@example.com');
        const owner = await prisma.user.findUniqueOrThrow({ where: { email: 'asset-instance@example.com' } });
        const first = await prisma.pageInstance.create({ data: { name: 'Home Assets', slug: 'home-assets', moduleType: 'ASSET', group: 'family', createdById: owner.id } });
        const second = await prisma.pageInstance.create({ data: { name: 'Work Assets', slug: 'work-assets', moduleType: 'ASSET', group: 'family', createdById: owner.id } });
        const created = await request(app).post('/api/assets').set('Authorization', `Bearer ${token}`).send({ name: 'Laptop', instanceId: first.id });
        expect(created.status).toBe(201);
        expect((await request(app).get(`/api/assets?instanceId=${first.id}`).set('Authorization', `Bearer ${token}`)).body.data).toHaveLength(1);
        expect((await request(app).get(`/api/assets?instanceId=${second.id}`).set('Authorization', `Bearer ${token}`)).body.data).toHaveLength(0);
        expect((await request(app).patch(`/api/assets/${created.body.data.id}?instanceId=${second.id}`).set('Authorization', `Bearer ${token}`).send({ name: 'Wrong' })).status).toBe(404);
        expect((await request(app).delete(`/api/assets/${created.body.data.id}?instanceId=${second.id}`).set('Authorization', `Bearer ${token}`)).status).toBe(404);
    });
});
