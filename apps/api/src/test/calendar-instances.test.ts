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

describe('calendar page instances', () => {
    it('partitions event list and rejects cross-instance updates', async () => {
        const token = await ownerToken('calendar-instance@example.com');
        const owner = await prisma.user.findUniqueOrThrow({ where: { email: 'calendar-instance@example.com' } });
        const first = await prisma.pageInstance.create({ data: { name: 'Family Calendar', slug: 'family-calendar', moduleType: 'CALENDAR', group: 'family', createdById: owner.id } });
        const second = await prisma.pageInstance.create({ data: { name: 'Work Calendar', slug: 'work-calendar', moduleType: 'CALENDAR', group: 'family', createdById: owner.id } });
        const body = { title: 'Family event', startDate: '2026-07-11T09:00:00.000Z', instanceId: first.id };
        const created = await request(app).post('/api/calendar').set('Authorization', `Bearer ${token}`).send(body);
        expect(created.status).toBe(201);

        const firstList = await request(app).get(`/api/calendar?instanceId=${first.id}`).set('Authorization', `Bearer ${token}`);
        const secondList = await request(app).get(`/api/calendar?instanceId=${second.id}`).set('Authorization', `Bearer ${token}`);
        expect(firstList.body.data.map((item: any) => item.title)).toContain('Family event');
        expect(secondList.body.data).toHaveLength(0);

        const crossUpdate = await request(app).patch(`/api/calendar/${created.body.data.id}?instanceId=${second.id}`).set('Authorization', `Bearer ${token}`).send({ title: 'Wrong calendar' });
        expect(crossUpdate.status).toBe(404);
    });
});
