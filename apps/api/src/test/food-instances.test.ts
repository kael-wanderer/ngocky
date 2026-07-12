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

describe('food page instances', () => {
    it('partitions create/list and applies bot-ready filters', async () => {
        const token = await ownerToken('food-instance@example.com');
        const owner = await prisma.user.findUniqueOrThrow({ where: { email: 'food-instance@example.com' } });
        const first = await prisma.pageInstance.create({ data: { name: 'Dinner', slug: 'food-dinner', moduleType: 'FOODPLACE', group: 'family', createdById: owner.id } });
        const second = await prisma.pageInstance.create({ data: { name: 'Desserts', slug: 'food-desserts', moduleType: 'FOODPLACE', group: 'family', createdById: owner.id } });

        const created = await request(app).post('/api/foods').set('Authorization', `Bearer ${token}`).send({ name: 'Pho House', tag: 'Dinner', distance: 'Nearby', rating: 5, instanceId: first.id });
        expect(created.status).toBe(201);
        const imported = await request(app).post(`/api/foods/import?instanceId=${second.id}`).set('Authorization', `Bearer ${token}`).send({ items: [{ name: 'Sweet Cafe', tag: 'Dessert', distance: 'Far' }] });
        expect(imported.status).toBe(201);

        const firstList = await request(app).get(`/api/foods?instanceId=${first.id}&tag=Dinner&distance=Nearby`).set('Authorization', `Bearer ${token}`);
        const secondList = await request(app).get(`/api/foods?instanceId=${second.id}`).set('Authorization', `Bearer ${token}`);
        expect(firstList.body.data.map((item: any) => item.name)).toEqual(['Pho House']);
        expect(secondList.body.data.map((item: any) => item.name)).toEqual(['Sweet Cafe']);
    });

    it('reads and updates owner-managed option lists', async () => {
        const token = await ownerToken('food-options@example.com');
        const initial = await request(app).get('/api/app-settings/food-options');
        expect(initial.status).toBe(200);
        const updated = await request(app)
            .patch('/api/app-settings/food-options')
            .set('Authorization', `Bearer ${token}`)
            .send({ tags: ['Dinner', ' Dinner', 'Dessert'], types: ['Bún'], distances: ['Nearby'] });
        expect(updated.status).toBe(200);
        expect(updated.body.tags).toEqual(['Dinner', 'Dessert']);
        expect((await request(app).get('/api/app-settings')).body.foodOptions).toMatchObject({ types: ['Bún'] });
    });
});
