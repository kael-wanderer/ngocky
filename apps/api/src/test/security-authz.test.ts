import { describe, it, expect } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app';
import { prisma } from '../config/database';
import { config } from '../config/env';
import { generateTotpSecret } from '../utils/mfa';

const PASSWORD = 'password123';

async function createUser(email: string, extra: Record<string, unknown> = {}) {
    return prisma.user.create({
        data: { email, name: email, password: await bcrypt.hash(PASSWORD, 4), role: 'USER', active: true, ...extra } as any,
    });
}

async function login(email: string) {
    const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    return res.body.data;
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('authorization hardening', () => {
    it('does not let a user change their own role', async () => {
        const user = await createUser('self-promote@example.com');
        const { accessToken } = await login(user.email);

        const res = await request(app)
            .patch(`/api/users/${user.id}`)
            .set(bearer(accessToken))
            .send({ role: 'ADMIN', name: 'Renamed' });

        expect(res.status).toBe(200);
        const after = await prisma.user.findUnique({ where: { id: user.id } });
        expect(after?.role).toBe('USER');
        expect(after?.name).toBe('Renamed');
    });

    it('does not let a user update another user', async () => {
        const user = await createUser('user-a@example.com');
        const other = await createUser('user-b@example.com');
        const { accessToken } = await login(user.email);

        const res = await request(app)
            .patch(`/api/users/${other.id}`)
            .set(bearer(accessToken))
            .send({ name: 'Hijacked' });

        expect(res.status).toBe(403);
    });

    it('rejects an MFA challenge token used as an access token', async () => {
        const user = await createUser('mfa@example.com', { mfaEnabled: true, mfaSecret: generateTotpSecret() });
        const data = await login(user.email);
        expect(data.mfaRequired).toBe(true);
        expect(data.accessToken).toBeUndefined();

        const res = await request(app).get('/api/auth/me').set(bearer(data.mfaToken));
        expect(res.status).toBe(401);
    });

    it('blocks check-ins on, and deletion of check-ins from, another user\'s private goal', async () => {
        const owner = await createUser('goal-owner@example.com');
        const intruder = await createUser('goal-intruder@example.com');
        const ownerToken = (await login(owner.email)).accessToken;
        const intruderToken = (await login(intruder.email)).accessToken;

        const goalRes = await request(app)
            .post('/api/goals')
            .set(bearer(ownerToken))
            .send({ title: 'Private goal', periodType: 'WEEKLY', targetCount: 3 });
        expect(goalRes.status).toBe(201);
        const goalId = goalRes.body.data.id;

        const denied = await request(app).post('/api/checkins').set(bearer(intruderToken)).send({ goalId });
        expect(denied.status).toBe(404);

        const own = await request(app).post('/api/checkins').set(bearer(ownerToken)).send({ goalId });
        expect(own.status).toBe(201);
        const checkInId = own.body.data.checkIn.id;

        const deniedDelete = await request(app).delete(`/api/checkins/${checkInId}`).set(bearer(intruderToken));
        expect(deniedDelete.status).toBe(404);
        expect(await prisma.goalCheckIn.count({ where: { id: checkInId } })).toBe(1);
        expect((await prisma.goal.findUnique({ where: { id: goalId } }))?.currentCount).toBe(1);
    });

    it('scopes budget updates and deletes to the owner and validates the body', async () => {
        const owner = await createUser('budget-owner@example.com');
        const intruder = await createUser('budget-intruder@example.com');
        const ownerToken = (await login(owner.email)).accessToken;
        const intruderToken = (await login(intruder.email)).accessToken;

        const created = await request(app)
            .post('/api/settings/budgets')
            .set(bearer(ownerToken))
            .send({ category: 'Food', amount: 1000000 });
        expect(created.status).toBe(200);
        const id = created.body.data.id;

        const reassign = await request(app)
            .patch(`/api/settings/budgets/${id}`)
            .set(bearer(ownerToken))
            .send({ userId: intruder.id });
        expect(reassign.status).toBe(400);

        const patch = await request(app).patch(`/api/settings/budgets/${id}`).set(bearer(intruderToken)).send({ amount: 1 });
        expect(patch.status).toBe(404);

        const del = await request(app).delete(`/api/settings/budgets/${id}`).set(bearer(intruderToken));
        expect(del.status).toBe(404);

        const budget = await prisma.budgetSetting.findUnique({ where: { id } });
        expect(budget?.amount).toBe(1000000);
        expect(budget?.userId).toBe(owner.id);
    });

    it('does not let a user add health logs to another user\'s private person', async () => {
        const owner = await createUser('health-owner@example.com');
        const intruder = await createUser('health-intruder@example.com');
        const intruderToken = (await login(intruder.email)).accessToken;
        const person = await prisma.healthPerson.create({ data: { name: 'Private person', userId: owner.id } as any });

        const res = await request(app)
            .post(`/api/healthbook/${person.id}/logs`)
            .set(bearer(intruderToken))
            .send({ date: new Date().toISOString(), description: 'x' });

        expect(res.status).toBe(404);
        expect(await prisma.healthLog.count({ where: { personId: person.id } })).toBe(0);
    });

    it('rejects wrong or missing assistant API keys', async () => {
        const wrong = await request(app).get('/api/service/due-reports').set('X-Assistant-Api-Key', 'dev-assistant-key-change-me');
        expect(wrong.status).toBe(401);

        const missing = await request(app).get('/api/service/due-reports');
        expect(missing.status).toBe(401);

        const ok = await request(app).get('/api/service/due-reports').set('X-Assistant-Api-Key', config.ASSISTANT_API_KEY);
        expect(ok.status).toBe(200);
    });
});
