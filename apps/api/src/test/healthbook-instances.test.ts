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

describe('healthbook page instances', () => {
    it('partitions people and protects custom detail access', async () => {
        const token = await ownerToken('healthbook-instance@example.com');
        const owner = await prisma.user.findUniqueOrThrow({ where: { email: 'healthbook-instance@example.com' } });
        const first = await prisma.pageInstance.create({ data: { name: 'Family Health', slug: 'family-health', moduleType: 'HEALTHBOOK', group: 'family', createdById: owner.id } });
        const second = await prisma.pageInstance.create({ data: { name: 'Private Health', slug: 'private-health', moduleType: 'HEALTHBOOK', group: 'family', createdById: owner.id } });
        const created = await request(app).post('/api/healthbook').set('Authorization', `Bearer ${token}`).send({ name: 'Alice', instanceId: first.id });
        expect(created.status).toBe(201);
        expect((await request(app).get(`/api/healthbook?instanceId=${first.id}`).set('Authorization', `Bearer ${token}`)).body.data).toHaveLength(1);
        expect((await request(app).get(`/api/healthbook?instanceId=${second.id}`).set('Authorization', `Bearer ${token}`)).body.data).toHaveLength(0);
        expect((await request(app).get(`/api/healthbook/${created.body.data.id}?instanceId=${second.id}`).set('Authorization', `Bearer ${token}`)).status).toBe(404);
    });
});
