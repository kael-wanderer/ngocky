import { describe, expect, it } from 'vitest';
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
