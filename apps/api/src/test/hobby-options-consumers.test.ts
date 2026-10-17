import { describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app';
import { prisma } from '../config/database';
import { HobbyOptionsService } from '../services/hobbyOptions';

async function ownerToken() {
    const email = `hobby-keyboard-${crypto.randomUUID()}@example.com`;
    const password = 'Secret123!';
    await prisma.user.create({
        data: { email, name: 'Owner', password: await bcrypt.hash(password, 12), role: 'OWNER', active: true },
    });
    return (await request(app).post('/api/auth/login').send({ email, password })).body.data.accessToken as string;
}

describe('keyboard uses hobby options', () => {
    it('resolves option labels when creating a keyboard', async () => {
        const token = await ownerToken();
        const response = await request(app).post('/api/keyboards').set('Authorization', `Bearer ${token}`).send({
            name: 'A', category: 'kit', tag: 'stock', spec: ['icon mode', 'base'],
        });

        expect(response.status).toBe(201);
        const row = await prisma.keyboard.findUniqueOrThrow({ where: { id: response.body.data.id } });
        expect(row.category).toBe('Kit');
        expect(row.tag).toBe('Stock');
        expect(row.spec).toEqual(['Base', 'Icon Mode']);
    });

    it('rejects unknown option labels and invalid create fields', async () => {
        const token = await ownerToken();
        const create = (body: object) => request(app).post('/api/keyboards').set('Authorization', `Bearer ${token}`).send(body);

        expect((await create({ name: 'Unknown tag', tag: 'Unknown' })).status).toBe(400);
        expect((await create({ name: '' })).status).toBe(400);
        expect((await create({ name: 'Bad price', price: 'abc' })).status).toBe(400);
    });

    it('adds unknown imported values to hobby options', async () => {
        const token = await ownerToken();
        const owner = await prisma.user.findFirstOrThrow({ where: { role: 'OWNER' } });
        const response = await request(app).post('/api/keyboards/import').set('Authorization', `Bearer ${token}`).send({
            items: [{ name: 'B', tag: 'Board 42', spec: ['Gasket'] }],
        });

        expect(response.status).toBe(201);
        const row = await prisma.keyboard.findFirstOrThrow({ where: { ownerId: owner.id, name: 'B' } });
        const options = await HobbyOptionsService.get();
        expect(options.tag.some(({ label }) => label === 'Board 42')).toBe(true);
        expect(options.spec.some(({ label }) => label === 'Gasket')).toBe(true);
        expect(row.tag).toBe('Board 42');
        expect(row.spec).toEqual(['Gasket']);
    });

    it('returns keyboard specs in the current option order', async () => {
        const token = await ownerToken();
        const options = await HobbyOptionsService.get();
        const reorderedIds = options.spec.map(({ id }) => id);
        const novelIndex = reorderedIds.indexOf(options.spec.find(({ label }) => label === 'Novel')!.id);
        const baseIndex = reorderedIds.indexOf(options.spec.find(({ label }) => label === 'Base')!.id);
        reorderedIds.splice(novelIndex, 1);
        reorderedIds.splice(baseIndex, 0, options.spec.find(({ label }) => label === 'Novel')!.id);
        await HobbyOptionsService.reorder('spec', reorderedIds);

        const owner = await prisma.user.findFirstOrThrow({ where: { role: 'OWNER' } });
        await prisma.keyboard.create({ data: { name: 'Sorted', ownerId: owner.id, spec: ['Base', 'Novel'] } });
        const response = await request(app).get('/api/keyboards').set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.data.find((item: { name: string }) => item.name === 'Sorted').spec).toEqual(['Novel', 'Base']);
    });
});
