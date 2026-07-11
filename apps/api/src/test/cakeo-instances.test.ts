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

describe('Ca Keo page instances', () => {
    it('partitions create/list and protects updates across instances', async () => {
        const token = await ownerToken('cakeo-instance@example.com');
        const owner = await prisma.user.findUniqueOrThrow({ where: { email: 'cakeo-instance@example.com' } });
        const first = await prisma.pageInstance.create({ data: { name: 'Child A', slug: 'child-a', moduleType: 'CAKEO', group: 'family', createdById: owner.id } });
        const second = await prisma.pageInstance.create({ data: { name: 'Child B', slug: 'child-b', moduleType: 'CAKEO', group: 'family', createdById: owner.id } });
        const created = await request(app).post('/api/cakeos').set('Authorization', `Bearer ${token}`).send({ title: 'Allowance', instanceId: first.id });
        expect(created.status).toBe(201);

        const firstList = await request(app).get(`/api/cakeos?instanceId=${first.id}`).set('Authorization', `Bearer ${token}`);
        const secondList = await request(app).get(`/api/cakeos?instanceId=${second.id}`).set('Authorization', `Bearer ${token}`);
        expect(firstList.body.data.map((item: any) => item.title)).toContain('Allowance');
        expect(secondList.body.data).toHaveLength(0);
        expect((await request(app).patch(`/api/cakeos/${created.body.data.id}?instanceId=${second.id}`).set('Authorization', `Bearer ${token}`).send({ title: 'Wrong' })).status).toBe(404);
    });
});
