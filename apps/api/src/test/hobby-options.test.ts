import { describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app';
import { prisma } from '../config/database';
import { HobbyOptionsService } from '../services/hobbyOptions';

async function createOwner(email = `hobby-options-${crypto.randomUUID()}@example.com`) {
    return prisma.user.create({
        data: { email, name: 'Owner', password: 'not-used', role: 'OWNER', active: true },
    });
}

describe('hobby options fill', () => {
    it('fills defaults in order', async () => {
        const options = await HobbyOptionsService.get();

        expect(options.category.map(({ label }) => label)).toEqual(['Keycap', 'Kit', 'Shipping', 'Accessories', 'Other']);
        expect(options.category.map(({ builtInKey }) => builtInKey)).toEqual(['KEYCAP', 'KIT', 'SHIPPING', 'ACCESSORIES', 'OTHER']);
        expect(Object.fromEntries(options.category.map(({ label, color }) => [label, color]))).toEqual({
            Keycap: '#16a34a', Kit: '#2563eb', Shipping: '#ea580c', Accessories: '#6b7280', Other: '#6b7280',
        });
        expect(options.spec.map(({ label }) => label)).toEqual([
            'Base', 'Novel', 'Space', 'Accent', 'Hiragana', 'Icon Mode', 'Alpha', 'Mod', 'Fix Kit', 'Solder',
            'Hotswap', 'Plate Alu', 'Plate PC', 'Plate PEI', 'Plate CF', 'Plate PP', 'Deskmat',
        ]);
        expect(options.tag.map(({ label }) => label)).toEqual([
            'Board 1', 'Board 2', 'Board 3', 'Board 4', 'Board 5', 'Board 6', 'Board 7', 'Board 8', 'Board 9',
            'Board 10', 'Board 11', 'Board 12', 'Board 13', 'Board 14', 'Board 15', 'Board 16', 'Board 17', 'Stock',
        ]);
        expect(Object.fromEntries(options.color.map(({ label, color }) => [label, color]))).toEqual({
            Blue: '#2563eb', PC: '#6b7280', Purple: '#7c3aed', Red: '#dc2626', Gray: '#6b7280', Green: '#16a34a',
            Black: '#111827', Silver: '#94a3b8', Copper: '#b45309', Brown: '#92400e', 'Rose Gold': '#c2410c',
            Orange: '#ea580c', Beige: '#a16207', Colorful: '#db2777',
        });
        expect(options.condition.map(({ label }) => label)).toEqual(['BNIB', 'Used']);
    });

    it('appends discovered values', async () => {
        const owner = await createOwner();
        await prisma.keyboard.create({
            data: { name: 'Discovered', ownerId: owner.id, tag: 'Board 99', color: 'Teal', spec: ['Weird'] },
        });
        await prisma.fundTransaction.create({
            data: {
                date: new Date('2026-01-01T00:00:00.000Z'), description: 'Discovered', amount: 1,
                type: 'BUY', scope: 'MECHANICAL_KEYBOARD', category: 'Other', condition: 'Mint', userId: owner.id,
            },
        });

        const options = await HobbyOptionsService.get();

        expect(options.tag.at(-1)?.label).toBe('Board 99');
        expect(options.color.at(-1)).toMatchObject({ label: 'Teal', color: '#6b7280' });
        expect(options.spec.at(-1)?.label).toBe('Weird');
        expect(options.condition.at(-1)?.label).toBe('Mint');
    });

    it('normalizes case variants and spec aliases', async () => {
        const owner = await createOwner();
        const keyboard = await prisma.keyboard.create({
            data: { name: 'Normalize', ownerId: owner.id, category: 'kit', spec: ['icon mod', 'BASE'] },
        });

        const options = await HobbyOptionsService.get();
        const normalized = await prisma.keyboard.findUniqueOrThrow({ where: { id: keyboard.id } });

        expect(normalized.category).toBe('Kit');
        expect(normalized.spec).toEqual(['Icon Mode', 'Base']);
        expect(options.category.map(({ label }) => label)).not.toContain('kit');
    });

    it('is idempotent', async () => {
        const first = await HobbyOptionsService.get();
        const saved = await prisma.appSetting.findUniqueOrThrow({ where: { id: 1 } });
        const second = await HobbyOptionsService.get();
        const savedAgain = await prisma.appSetting.findUniqueOrThrow({ where: { id: 1 } });

        expect(second).toEqual(first);
        expect(savedAgain.hobbyOptions).toEqual(saved.hobbyOptions);
        expect(savedAgain.updatedAt).toEqual(saved.updatedAt);
    });

    it('concurrent first get() calls return the same ids', async () => {
        const [a, b] = await Promise.all([HobbyOptionsService.get(), HobbyOptionsService.get()]);
        expect(b.category.map((o) => o.id)).toEqual(a.category.map((o) => o.id));
        expect(b.tag.map((o) => o.id)).toEqual(a.tag.map((o) => o.id));
    });

    it('resolves labels and legacy category keys', async () => {
        const options = await HobbyOptionsService.get();

        expect(HobbyOptionsService.resolveLabel(options, 'category', 'KEYCAP')).toBe('Keycap');
        expect(HobbyOptionsService.resolveLabel(options, 'category', ' kit ')).toBe('Kit');
        expect(HobbyOptionsService.resolveLabel(options, 'condition', 'USED')).toBe('Used');
        expect(HobbyOptionsService.resolveLabel(options, 'tag', 'nope')).toBeNull();

        const renamed = options.category.map((option) => option.builtInKey === 'KEYCAP' ? { ...option, label: 'Keycaps' } : option);
        await prisma.appSetting.update({ where: { id: 1 }, data: { hobbyOptions: { ...options, category: renamed } } });
        const renamedOptions = await HobbyOptionsService.get();
        expect(HobbyOptionsService.resolveLabel(renamedOptions, 'category', 'KEYCAP')).toBe('Keycaps');
    });
});

const HOBBY_OPTIONS_URL = '/api/app-settings/hobby-options';

async function apiToken(role: 'OWNER' | 'USER' = 'OWNER') {
    const email = `hobby-api-${crypto.randomUUID()}@example.com`;
    const password = 'Secret123!';
    await prisma.user.create({
        data: { email, name: role, password: await bcrypt.hash(password, 12), role, active: true },
    });
    const response = await request(app).post('/api/auth/login').send({ email, password });
    return response.body.data.accessToken as string;
}

async function getApiOptions(token: string) {
    const response = await request(app).get(HOBBY_OPTIONS_URL).set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    return response.body.options as Awaited<ReturnType<typeof HobbyOptionsService.get>>;
}

describe('hobby options api', () => {
    it('GET returns options and usage counts', async () => {
        const token = await apiToken();
        const owner = await prisma.user.findFirstOrThrow({ where: { role: 'OWNER' } });
        await prisma.keyboard.createMany({
            data: [
                { name: 'Stock A', ownerId: owner.id, tag: 'Stock' },
                { name: 'Stock B', ownerId: owner.id, tag: 'Stock' },
            ],
        });

        const response = await request(app).get(HOBBY_OPTIONS_URL).set('Authorization', `Bearer ${token}`);
        const stock = response.body.options.tag.find((option: { label: string }) => option.label === 'Stock');
        expect(response.status).toBe(200);
        expect(response.body.usage.tag[stock.id]).toBe(2);
    });

    it('GET requires auth', async () => {
        expect((await request(app).get(HOBBY_OPTIONS_URL)).status).toBe(401);
    });

    it('USER cannot mutate', async () => {
        const token = await apiToken('USER');
        const options = await getApiOptions(token);
        const tag = options.tag[0];

        expect((await request(app).post(`${HOBBY_OPTIONS_URL}/spec`).set('Authorization', `Bearer ${token}`).send({ label: 'Film' })).status).toBe(403);
        expect((await request(app).patch(`${HOBBY_OPTIONS_URL}/tag/${tag.id}`).set('Authorization', `Bearer ${token}`).send({ label: 'Renamed' })).status).toBe(403);
        expect((await request(app).put(`${HOBBY_OPTIONS_URL}/tag/order`).set('Authorization', `Bearer ${token}`).send({ ids: options.tag.map(({ id }) => id) })).status).toBe(403);
        expect((await request(app).delete(`${HOBBY_OPTIONS_URL}/tag/${tag.id}`).set('Authorization', `Bearer ${token}`).send({ mode: 'clear' })).status).toBe(403);
    });

    it('adds options and validates labels, colors, and fields', async () => {
        const token = await apiToken();
        const before = await getApiOptions(token);
        const added = await request(app).post(`${HOBBY_OPTIONS_URL}/spec`).set('Authorization', `Bearer ${token}`).send({ label: 'Switch Film' });
        expect(added.status).toBe(201);
        expect((await getApiOptions(token)).spec.at(-1)?.label).toBe('Switch Film');
        expect((await request(app).post(`${HOBBY_OPTIONS_URL}/spec`).set('Authorization', `Bearer ${token}`).send({ label: ' base ' })).status).toBe(400);
        expect((await request(app).post(`${HOBBY_OPTIONS_URL}/tag`).set('Authorization', `Bearer ${token}`).send({ label: 'x'.repeat(61) })).status).toBe(400);
        expect((await request(app).post(`${HOBBY_OPTIONS_URL}/tag`).set('Authorization', `Bearer ${token}`).send({ label: 'T', color: '#fff' })).status).toBe(400);
        expect((await request(app).post(`${HOBBY_OPTIONS_URL}/tag`).set('Authorization', `Bearer ${token}`).send({ label: 'T', color: '#abcdef' })).status).toBe(400);
        const category = await request(app).post(`${HOBBY_OPTIONS_URL}/category`).set('Authorization', `Bearer ${token}`).send({ label: 'Switch', color: '#7c3aed' });
        expect(category.status).toBe(201);
        expect(category.body.color).toBe('#7c3aed');
        expect((await request(app).post(`${HOBBY_OPTIONS_URL}/bogus`).set('Authorization', `Bearer ${token}`).send({ label: 'Nope' })).status).toBe(400);
        expect((await request(app).post(`${HOBBY_OPTIONS_URL}/spec`).set('Authorization', `Bearer ${token}`).send({ label: 'Novel', extra: true })).status).toBe(400);
        expect(before.spec.at(-1)?.label).not.toBe('Switch Film');
    });

    it('rename cascades and preserves built-in keys', async () => {
        const token = await apiToken();
        const options = await getApiOptions(token);
        const owner = await prisma.user.findFirstOrThrow({ where: { role: 'OWNER' } });
        const keyboard = await prisma.keyboard.create({
            data: { name: 'Rename', ownerId: owner.id, category: 'Kit', spec: ['Base', 'Icon Mode'], description: 'Used' },
        });
        const fund = await prisma.fundTransaction.create({
            data: {
                date: new Date(), description: 'Rename', amount: 1, type: 'BUY', scope: 'MECHANICAL_KEYBOARD',
                category: 'Kit', condition: 'Used', userId: owner.id,
            },
        });
        const iconMode = options.spec.find(({ label }) => label === 'Icon Mode')!;
        const kit = options.category.find(({ label }) => label === 'Kit')!;
        const used = options.condition.find(({ label }) => label === 'Used')!;

        expect((await request(app).patch(`${HOBBY_OPTIONS_URL}/spec/${iconMode.id}`).set('Authorization', `Bearer ${token}`).send({ label: 'Icon Mod' })).status).toBe(200);
        expect((await request(app).patch(`${HOBBY_OPTIONS_URL}/category/${kit.id}`).set('Authorization', `Bearer ${token}`).send({ label: 'Kits' })).status).toBe(200);
        expect((await request(app).patch(`${HOBBY_OPTIONS_URL}/condition/${used.id}`).set('Authorization', `Bearer ${token}`).send({ label: 'Mint' })).status).toBe(200);

        const updatedKeyboard = await prisma.keyboard.findUniqueOrThrow({ where: { id: keyboard.id } });
        const updatedFund = await prisma.fundTransaction.findUniqueOrThrow({ where: { id: fund.id } });
        expect(updatedKeyboard.spec).toEqual(['Base', 'Icon Mod']);
        expect(updatedKeyboard.category).toBe('Kits');
        expect(updatedKeyboard.description).toBe('Mint');
        expect(updatedFund.category).toBe('Kits');
        expect(updatedFund.condition).toBe('Mint');
        expect((await getApiOptions(token)).category.find(({ id }) => id === kit.id)?.builtInKey).toBe('KIT');
    });

    it('rejects duplicate renames but allows changing an option label case', async () => {
        const token = await apiToken();
        const options = await getApiOptions(token);
        const owner = await prisma.user.findFirstOrThrow({ where: { role: 'OWNER' } });
        const boardOne = options.tag.find(({ label }) => label === 'Board 1')!;
        const boardTwo = options.tag.find(({ label }) => label === 'Board 2')!;
        const keyboard = await prisma.keyboard.create({ data: { name: 'Duplicate', ownerId: owner.id, tag: 'Board 1' } });

        expect((await request(app).patch(`${HOBBY_OPTIONS_URL}/tag/${boardOne.id}`).set('Authorization', `Bearer ${token}`).send({ label: ' board 2 ' })).status).toBe(400);
        expect((await prisma.keyboard.findUniqueOrThrow({ where: { id: keyboard.id } })).tag).toBe('Board 1');
        const kit = options.category.find(({ label }) => label === 'Kit')!;
        const caseChange = await request(app).patch(`${HOBBY_OPTIONS_URL}/category/${kit.id}`).set('Authorization', `Bearer ${token}`).send({ label: 'KIT' });
        expect(caseChange.status).toBe(200);
        expect(caseChange.body).toMatchObject({ id: kit.id, label: 'KIT', builtInKey: 'KIT' });
        expect(boardTwo.label).toBe('Board 2');
    });

    it('reorders only exact permutations', async () => {
        const token = await apiToken();
        const options = await getApiOptions(token);
        const reversedIds = options.tag.map(({ id }) => id).reverse();
        const reordered = await request(app).put(`${HOBBY_OPTIONS_URL}/tag/order`).set('Authorization', `Bearer ${token}`).send({ ids: reversedIds });
        expect(reordered.status).toBe(200);
        expect(reordered.body.map(({ id }: { id: string }) => id)).toEqual(reversedIds);
        expect((await request(app).put(`${HOBBY_OPTIONS_URL}/tag/order`).set('Authorization', `Bearer ${token}`).send({ ids: reversedIds.slice(1) })).status).toBe(400);
        expect((await request(app).put(`${HOBBY_OPTIONS_URL}/tag/order`).set('Authorization', `Bearer ${token}`).send({ ids: [...reversedIds.slice(1), reversedIds[1]] })).status).toBe(400);
    });

    it('moves in-use options and rejects invalid move targets without changing records', async () => {
        const token = await apiToken();
        const options = await getApiOptions(token);
        const owner = await prisma.user.findFirstOrThrow({ where: { role: 'OWNER' } });
        const boardThree = options.tag.find(({ label }) => label === 'Board 3')!;
        const stock = options.tag.find(({ label }) => label === 'Stock')!;
        const keyboardRows = await prisma.keyboard.createMany({
            data: [
                { name: 'Move A', ownerId: owner.id, tag: 'Board 3' },
                { name: 'Move B', ownerId: owner.id, tag: 'Board 3' },
            ],
        });
        expect(keyboardRows.count).toBe(2);

        expect((await request(app).delete(`${HOBBY_OPTIONS_URL}/tag/${boardThree.id}`).set('Authorization', `Bearer ${token}`).send({ mode: 'move', targetId: boardThree.id })).status).toBe(400);
        expect((await request(app).delete(`${HOBBY_OPTIONS_URL}/tag/${boardThree.id}`).set('Authorization', `Bearer ${token}`).send({ mode: 'move', targetId: 'unknown' })).status).toBe(400);
        expect(await prisma.keyboard.count({ where: { tag: 'Board 3' } })).toBe(2);
        expect((await request(app).delete(`${HOBBY_OPTIONS_URL}/tag/${boardThree.id}`).set('Authorization', `Bearer ${token}`).send({ mode: 'move', targetId: stock.id })).status).toBe(204);
        expect(await prisma.keyboard.count({ where: { tag: 'Stock' } })).toBe(2);
        expect((await getApiOptions(token)).tag.some(({ id }) => id === boardThree.id)).toBe(false);
    });

    it('dedupes spec values when moving an option', async () => {
        const token = await apiToken();
        const options = await getApiOptions(token);
        const owner = await prisma.user.findFirstOrThrow({ where: { role: 'OWNER' } });
        const keyboard = await prisma.keyboard.create({ data: { name: 'Spec move', ownerId: owner.id, spec: ['Base', 'Novel'] } });
        const base = options.spec.find(({ label }) => label === 'Base')!;
        const novel = options.spec.find(({ label }) => label === 'Novel')!;

        expect((await request(app).delete(`${HOBBY_OPTIONS_URL}/spec/${novel.id}`).set('Authorization', `Bearer ${token}`).send({ mode: 'move', targetId: base.id })).status).toBe(204);
        expect(await prisma.keyboard.findUniqueOrThrow({ where: { id: keyboard.id } }).then(({ spec }) => spec)).toEqual(['Base']);
    });

    it('clears tag, spec, and color values', async () => {
        const token = await apiToken();
        const options = await getApiOptions(token);
        const owner = await prisma.user.findFirstOrThrow({ where: { role: 'OWNER' } });
        const keyboard = await prisma.keyboard.create({ data: { name: 'Clear', ownerId: owner.id, tag: 'Stock', color: 'Blue', spec: ['Base'] } });

        for (const [field, label] of [['tag', 'Stock'], ['spec', 'Base'], ['color', 'Blue']] as const) {
            const option = options[field].find(({ label: itemLabel }) => itemLabel === label)!;
            expect((await request(app).delete(`${HOBBY_OPTIONS_URL}/${field}/${option.id}`).set('Authorization', `Bearer ${token}`).send({ mode: 'clear' })).status).toBe(204);
        }
        const cleared = await prisma.keyboard.findUniqueOrThrow({ where: { id: keyboard.id } });
        expect(cleared.tag).toBeNull();
        expect(cleared.color).toBeNull();
        expect(cleared.spec).toEqual([]);
    });

    it('guards built-in and move-only deletes, and returns not found for unknown ids', async () => {
        const token = await apiToken();
        const options = await getApiOptions(token);
        const owner = await prisma.user.findFirstOrThrow({ where: { role: 'OWNER' } });
        const kit = options.category.find(({ label }) => label === 'Kit')!;
        const used = options.condition.find(({ label }) => label === 'Used')!;
        const switchOption = (await request(app).post(`${HOBBY_OPTIONS_URL}/category`).set('Authorization', `Bearer ${token}`).send({ label: 'Switch' })).body;
        await prisma.keyboard.create({ data: { name: 'Switch used', ownerId: owner.id, category: 'Switch', description: 'Used' } });

        expect((await request(app).delete(`${HOBBY_OPTIONS_URL}/category/${kit.id}`).set('Authorization', `Bearer ${token}`).send({ mode: 'clear' })).status).toBe(403);
        expect((await request(app).delete(`${HOBBY_OPTIONS_URL}/category/${switchOption.id}`).set('Authorization', `Bearer ${token}`).send({ mode: 'clear' })).status).toBe(400);
        expect((await request(app).delete(`${HOBBY_OPTIONS_URL}/condition/${used.id}`).set('Authorization', `Bearer ${token}`).send({ mode: 'clear' })).status).toBe(400);
        expect((await request(app).delete(`${HOBBY_OPTIONS_URL}/tag/unknown`).set('Authorization', `Bearer ${token}`).send({ mode: 'clear' })).status).toBe(404);
        expect((await request(app).delete(`${HOBBY_OPTIONS_URL}/category/${switchOption.id}`).set('Authorization', `Bearer ${token}`).send({ mode: 'move', targetId: 'unknown' })).status).toBe(400);

        const unused = (await request(app).post(`${HOBBY_OPTIONS_URL}/category`).set('Authorization', `Bearer ${token}`).send({ label: 'Unused' })).body;
        expect((await request(app).delete(`${HOBBY_OPTIONS_URL}/category/${unused.id}`).set('Authorization', `Bearer ${token}`).send({ mode: 'clear' })).status).toBe(204);
    });
});
