import { describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app';
import { prisma } from '../config/database';
import { HobbyOptionsService } from '../services/hobbyOptions';
import { resolveFundCreate } from '../services/assistant/resolvers/fundCreate';
import { resolveFundQuery } from '../services/assistant/resolvers/fundQuery';
import { resolveKeyboardCreate } from '../services/assistant/resolvers/keyboardCreate';

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

    it('list never fails on a stored spec missing from options', async () => {
        const token = await ownerToken();
        const owner = await prisma.user.findFirstOrThrow({ where: { role: 'OWNER' } });
        await HobbyOptionsService.get();
        await prisma.keyboard.create({
            data: { name: 'Legacy', spec: ['Base', 'Ghost Spec'], ownerId: owner.id },
        });

        const response = await request(app).get('/api/keyboards').set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.data.find((item: { name: string }) => item.name === 'Legacy').spec).toEqual(['Base', 'Ghost Spec']);
    });
});

describe('funds use hobby options', () => {
    async function fundOwner() {
        const email = `hobby-fund-${crypto.randomUUID()}@example.com`;
        const password = 'Secret123!';
        const owner = await prisma.user.create({
            data: { email, name: 'Owner', password: await bcrypt.hash(password, 12), role: 'OWNER', active: true },
        });
        const token = (await request(app).post('/api/auth/login').send({ email, password })).body.data.accessToken as string;
        return { owner, token };
    }

    const fundBody = (category: string, description = `Fund keyboard ${crypto.randomUUID()}`) => ({
        description,
        type: 'BUY',
        scope: 'MECHANICAL_KEYBOARD',
        category,
        condition: 'BNIB',
        removeKeyboardItem: false,
        date: '2026-07-11T00:00:00.000Z',
        amount: 100,
    });

    it('resolves fund options, filters categories, imports values, and auto-creates only for built-ins', async () => {
        const { owner, token } = await fundOwner();
        const kit = fundBody('Kit', 'Kit purchase');
        const kitResponse = await request(app).post('/api/funds').set('Authorization', `Bearer ${token}`).send(kit);
        expect(kitResponse.status).toBe(201);
        const keyboard = await prisma.keyboard.findFirstOrThrow({ where: { ownerId: owner.id, name: kit.description } });
        expect(keyboard.category).toBe('Kit');

        await HobbyOptionsService.add('category', { label: 'Switch' });
        const before = await prisma.keyboard.count({ where: { ownerId: owner.id } });
        const switchResponse = await request(app).post('/api/funds').set('Authorization', `Bearer ${token}`).send(fundBody('Switch', 'Switch purchase'));
        expect(switchResponse.status).toBe(201);
        expect(await prisma.keyboard.count({ where: { ownerId: owner.id } })).toBe(before);

        const unknown = await request(app).post('/api/funds').set('Authorization', `Bearer ${token}`).send(fundBody('Nope'));
        const used = await request(app).post('/api/funds').set('Authorization', `Bearer ${token}`).send({ ...fundBody('Kit', 'Used keyboard'), condition: 'used' });
        expect(unknown.status).toBe(400);
        expect(used.status).toBe(201);
        expect(used.body.data.condition).toBe('Used');

        await request(app).post('/api/funds').set('Authorization', `Bearer ${token}`).send(fundBody('Keycap', 'Keycap purchase'));

        const upper = await request(app).get('/api/funds?category=KEYCAP').set('Authorization', `Bearer ${token}`);
        const lower = await request(app).get('/api/funds?category=keycap').set('Authorization', `Bearer ${token}`);
        expect(upper.body.data.map((item: { category: string }) => item.category)).toContain('Keycap');
        expect(lower.body.data.map((item: { category: string }) => item.category)).toContain('Keycap');

        const imported = await request(app).post('/api/funds/import').set('Authorization', `Bearer ${token}`).send({
            items: [{ description: 'Gift', type: 'BUY', scope: 'MECHANICAL_KEYBOARD', category: 'Gift', condition: 'Mint', date: '2026-07-11T00:00:00.000Z', amount: 100 }],
        });
        expect(imported.status).toBe(201);
        const row = await prisma.fundTransaction.findFirstOrThrow({ where: { description: 'Gift' } });
        const options = await HobbyOptionsService.get();
        expect(row.category).toBe('Gift');
        expect(row.condition).toBe('Mint');
        expect(options.category.some(({ label }) => label === 'Gift')).toBe(true);
        expect(options.condition.some(({ label }) => label === 'Mint')).toBe(true);

        const keycap = options.category.find(({ builtInKey }) => builtInKey === 'KEYCAP')!;
        await HobbyOptionsService.update('category', keycap.id, { label: 'Keycaps' });
        const body = fundBody('KEYCAP');
        const response = await request(app).post('/api/funds').set('Authorization', `Bearer ${token}`).send(body);

        expect(response.status).toBe(201);
        expect(response.body.data.category).toBe('Keycaps');
        const renamedKeyboard = await prisma.keyboard.findFirstOrThrow({ where: { ownerId: owner.id, name: body.description } });
        expect(renamedKeyboard.category).toBe('Keycaps');
    });

    it('blank condition on SELL is stored as null', async () => {
        const { token } = await fundOwner();
        const response = await request(app).post('/api/funds').set('Authorization', `Bearer ${token}`).send({
            ...fundBody('Kit'),
            type: 'SELL',
            condition: '',
        });

        expect(response.status).toBe(201);
        expect(response.body.data.condition).toBeNull();
    });

    it('blank condition on BUY is rejected', async () => {
        const { token } = await fundOwner();
        const response = await request(app).post('/api/funds').set('Authorization', `Bearer ${token}`).send({
            ...fundBody('Kit'),
            condition: '',
        });

        expect(response.status).toBe(400);
    });

    it('import blanks fall back to the Other built-in after rename', async () => {
        const { token } = await fundOwner();
        const options = await HobbyOptionsService.get();
        const other = options.category.find(({ builtInKey }) => builtInKey === 'OTHER')!;
        await HobbyOptionsService.update('category', other.id, { label: 'Misc' });

        const response = await request(app).post('/api/funds/import').set('Authorization', `Bearer ${token}`).send({
            items: [{ description: 'Blank row', type: 'BUY', scope: 'MECHANICAL_KEYBOARD', category: '', condition: '', date: '2026-07-11T00:00:00.000Z', amount: 50 }],
        });

        expect(response.status).toBe(201);
        const row = await prisma.fundTransaction.findFirstOrThrow({ where: { description: 'Blank row' } });
        expect(row.category).toBe('Misc');
        expect(row.condition).toBeNull();
    });
});

describe('assistant uses hobby options', () => {
    async function assistantOwner() {
        return prisma.user.create({
            data: {
                email: `assistant-hobby-${crypto.randomUUID()}@example.com`,
                name: 'Assistant Owner',
                password: 'unused-test-password',
                active: true,
            },
        });
    }

    const context = (userId: string) => ({ userId, timezone: 'Asia/Ho_Chi_Minh', today: '2026-10-17' });
    const fundEntities = (category: string, description = 'Assistant fund') => ({
        description,
        amount: 100,
        type: 'BUY',
        scope: 'MECHANICAL_KEYBOARD',
        category,
        condition: 'used',
        date: '2026-10-17',
    });

    it('resolves labels and creates keyboard items only for built-in categories', async () => {
        const owner = await assistantOwner();
        const result = await resolveFundCreate(fundEntities('kit'), context(owner.id));

        expect(result.reply).toContain('Logged fund');
        const fund = await prisma.fundTransaction.findFirstOrThrow({ where: { userId: owner.id } });
        expect(fund.category).toBe('Kit');
        expect(fund.condition).toBe('Used');
        const keyboard = await prisma.keyboard.findFirstOrThrow({ where: { ownerId: owner.id } });
        expect(keyboard.category).toBe('Kit');

        await HobbyOptionsService.add('category', { label: 'Switch' });
        await resolveFundCreate(fundEntities('Switch', 'Switch fund'), context(owner.id));
        expect(await prisma.keyboard.count({ where: { ownerId: owner.id } })).toBe(1);
        expect(await prisma.fundTransaction.count({ where: { userId: owner.id } })).toBe(2);
    });

    it('lists current category labels when a fund category is invalid', async () => {
        const owner = await assistantOwner();
        await HobbyOptionsService.add('category', { label: 'Switch' });

        const result = await resolveFundCreate(fundEntities('nope'), context(owner.id));

        expect(result.reply).toContain('_Keycap_');
        expect(result.reply).toContain('_Switch_');
    });

    it('filters fund queries by resolved category label', async () => {
        const owner = await assistantOwner();
        const base = { date: new Date('2026-10-17T00:00:00.000Z'), amount: 100, type: 'BUY' as const, scope: 'MECHANICAL_KEYBOARD' as const, condition: 'Used', userId: owner.id };
        await prisma.fundTransaction.createMany({ data: [
            { ...base, description: 'Keycap row', category: 'Keycap' },
            { ...base, description: 'Kit row', category: 'Kit' },
        ] });

        const result = await resolveFundQuery({ category: 'keycap' }, context(owner.id));

        expect(result.reply).toContain('Keycap row');
        expect(result.reply).not.toContain('Kit row');
    });

    it('creates a keyboard with the resolved current category label', async () => {
        const owner = await assistantOwner();
        await resolveKeyboardCreate({ name: 'Assistant keyboard', category: 'keycap' }, context(owner.id));

        const keyboard = await prisma.keyboard.findFirstOrThrow({ where: { ownerId: owner.id } });
        expect(keyboard.category).toBe('Keycap');
    });
});
