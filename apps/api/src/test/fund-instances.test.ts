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

describe('fund page instances', () => {
    it('partitions transactions and imports', async () => {
        const token = await ownerToken('fund-instance@example.com');
        const owner = await prisma.user.findUniqueOrThrow({ where: { email: 'fund-instance@example.com' } });
        const first = await prisma.pageInstance.create({ data: { name: 'Funds A', slug: 'funds-a', moduleType: 'FUND', group: 'hobby', createdById: owner.id } });
        const second = await prisma.pageInstance.create({ data: { name: 'Funds B', slug: 'funds-b', moduleType: 'FUND', group: 'hobby', createdById: owner.id } });
        const body = { description: 'Keycaps', type: 'BUY', scope: 'MECHANICAL_KEYBOARD', category: 'KEYCAP', condition: 'BNIB', date: '2026-07-11T00:00:00.000Z', amount: 100, instanceId: first.id };
        expect((await request(app).post('/api/funds').set('Authorization', `Bearer ${token}`).send(body)).status).toBe(201);
        expect((await request(app).post(`/api/funds/import?instanceId=${second.id}`).set('Authorization', `Bearer ${token}`).send({ items: [{ ...body, description: 'Imported', amount: 200 }] })).status).toBe(201);
        const firstList = await request(app).get(`/api/funds?instanceId=${first.id}`).set('Authorization', `Bearer ${token}`);
        const secondList = await request(app).get(`/api/funds?instanceId=${second.id}`).set('Authorization', `Bearer ${token}`);
        expect(firstList.body.data.map((item: any) => item.description)).toContain('Keycaps');
        expect(firstList.body.data.map((item: any) => item.description)).not.toContain('Imported');
        expect(secondList.body.data.map((item: any) => item.description)).toContain('Imported');
    });
});
