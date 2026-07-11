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

describe('housework page instances', () => {
    it('partitions recurring work and protects completion across instances', async () => {
        const token = await ownerToken('housework-instance@example.com');
        const owner = await prisma.user.findUniqueOrThrow({ where: { email: 'housework-instance@example.com' } });
        const first = await prisma.pageInstance.create({ data: { name: 'Home A', slug: 'home-a', moduleType: 'HOUSEWORK', group: 'family', createdById: owner.id } });
        const second = await prisma.pageInstance.create({ data: { name: 'Home B', slug: 'home-b', moduleType: 'HOUSEWORK', group: 'family', createdById: owner.id } });
        const created = await request(app).post('/api/housework').set('Authorization', `Bearer ${token}`).send({ title: 'Clean room', instanceId: first.id });
        expect(created.status).toBe(201);
        expect((await request(app).get(`/api/housework?instanceId=${first.id}`).set('Authorization', `Bearer ${token}`)).body.data).toHaveLength(1);
        expect((await request(app).get(`/api/housework?instanceId=${second.id}`).set('Authorization', `Bearer ${token}`)).body.data).toHaveLength(0);
        expect((await request(app).post(`/api/housework/${created.body.data.id}/complete?instanceId=${second.id}`).set('Authorization', `Bearer ${token}`)).status).toBe(404);
    });
});
