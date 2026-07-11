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

describe('keyboard page instances', () => {
    it('partitions create/list and import between instances', async () => {
        const token = await ownerToken('keyboard-instance@example.com');
        const owner = await prisma.user.findUniqueOrThrow({ where: { email: 'keyboard-instance@example.com' } });
        const first = await prisma.pageInstance.create({ data: { name: 'Keyboards A', slug: 'keyboards-a', moduleType: 'KEYBOARD', group: 'hobby', createdById: owner.id } });
        const second = await prisma.pageInstance.create({ data: { name: 'Keyboards B', slug: 'keyboards-b', moduleType: 'KEYBOARD', group: 'hobby', createdById: owner.id } });
        const created = await request(app).post('/api/keyboards').set('Authorization', `Bearer ${token}`).send({ name: 'Alice', instanceId: first.id });
        expect(created.status).toBe(201);
        const imported = await request(app).post(`/api/keyboards/import?instanceId=${second.id}`).set('Authorization', `Bearer ${token}`).send({ items: [{ name: 'Bob' }] });
        expect(imported.status).toBe(201);
        const firstList = await request(app).get(`/api/keyboards?instanceId=${first.id}`).set('Authorization', `Bearer ${token}`);
        const secondList = await request(app).get(`/api/keyboards?instanceId=${second.id}`).set('Authorization', `Bearer ${token}`);
        expect(firstList.body.data.map((item: any) => item.name)).toContain('Alice');
        expect(firstList.body.data.map((item: any) => item.name)).not.toContain('Bob');
        expect(secondList.body.data.map((item: any) => item.name)).toContain('Bob');
    });
});
