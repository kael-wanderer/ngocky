import { describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app';
import { prisma } from '../config/database';

async function tokenFor(role: 'OWNER' | 'ADMIN' | 'USER', email: string) {
    const password = 'Secret123!';
    await prisma.user.create({
        data: {
            email,
            name: role,
            password: await bcrypt.hash(password, 12),
            role,
            active: true,
        },
    });
    const login = await request(app).post('/api/auth/login').send({ email, password });
    return login.body.data.accessToken as string;
}

function authed(token: string) {
    return {
        get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
        post: (url: string) => request(app).post(url).set('Authorization', `Bearer ${token}`),
        put: (url: string) => request(app).put(url).set('Authorization', `Bearer ${token}`),
        patch: (url: string) => request(app).patch(url).set('Authorization', `Bearer ${token}`),
        delete: (url: string) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
    };
}

describe('page instances', () => {
    it('ADMIN creates a page, slug generated', async () => {
        const ownerToken = await tokenFor('OWNER', 'owner-page@example.com');
        const res = await authed(ownerToken).post('/api/pages').send({
            name: 'Work Tasks',
            moduleType: 'TASK',
            group: 'personal',
        });

        expect(res.status).toBe(201);
        expect(res.body.slug).toBe('work-tasks');
    });

    it('USER cannot create a page', async () => {
        const userToken = await tokenFor('USER', 'user-page@example.com');
        const res = await authed(userToken).post('/api/pages').send({
            name: 'X',
            moduleType: 'TASK',
            group: 'personal',
        });

        expect(res.status).toBe(403);
    });

    it('tasks are partitioned by instanceId', async () => {
        const ownerToken = await tokenFor('OWNER', 'owner-partition@example.com');
        const page = (await authed(ownerToken).post('/api/pages').send({
            name: 'Work',
            moduleType: 'TASK',
            group: 'personal',
        })).body;

        await authed(ownerToken).post('/api/tasks').send({ title: 'default task' });
        await authed(ownerToken).post('/api/tasks').send({ title: 'work task', instanceId: page.id });

        const defaults = (await authed(ownerToken).get('/api/tasks')).body.data;
        const work = (await authed(ownerToken).get(`/api/tasks?instanceId=${page.id}`)).body.data;

        expect(defaults.map((task: any) => task.title)).toContain('default task');
        expect(defaults.map((task: any) => task.title)).not.toContain('work task');
        expect(work.map((task: any) => task.title)).toEqual(['work task']);
    });

    it('rejects unknown instanceId on create', async () => {
        const ownerToken = await tokenFor('OWNER', 'owner-invalid@example.com');
        const res = await authed(ownerToken).post('/api/tasks').send({
            title: 'x',
            instanceId: 'nope',
        });

        expect(res.status).toBe(400);
    });

    it('returns the complete canonical template catalog to authenticated users', async () => {
        const ownerToken = await tokenFor('OWNER', 'owner-catalog@example.com');
        const userToken = await tokenFor('USER', 'user-catalog@example.com');
        const catalog = await authed(ownerToken).get('/api/pages/templates');

        expect(catalog.status).toBe(200);
        expect(catalog.body).toHaveLength(13);
        expect(catalog.body.find((item: any) => item.moduleType === 'IDEA')).toMatchObject({ group: 'personal', available: false });
        expect((await authed(userToken).get('/api/pages/templates')).status).toBe(200);

        expect((await authed(userToken).put('/api/pages/templates/TASK').send({ name: 'My Tasks' })).status).toBe(403);
        const renamed = await authed(ownerToken).put('/api/pages/templates/TASK').send({ name: 'My Tasks', visible: false });
        expect(renamed.status).toBe(200);
        expect(renamed.body).toMatchObject({ name: 'My Tasks', visible: false });
        const updatedCatalog = await authed(userToken).get('/api/pages/templates');
        expect(updatedCatalog.body.find((item: any) => item.moduleType === 'TASK')).toMatchObject({ name: 'My Tasks', visible: false });
    });

    it('enforces template groups and unavailable templates', async () => {
        const ownerToken = await tokenFor('OWNER', 'owner-contract@example.com');
        const wrongGroup = await authed(ownerToken).post('/api/pages').send({ name: 'Wrong', moduleType: 'TASK', group: 'family' });
        const unavailable = await authed(ownerToken).post('/api/pages').send({ name: 'Ideas', moduleType: 'IDEA', group: 'personal' });

        expect(wrongGroup.status).toBe(400);
        expect(unavailable.status).toBe(400);
    });

    it('preserves the slug on rename and previews typed root counts', async () => {
        const ownerToken = await tokenFor('OWNER', 'owner-preview@example.com');
        const page = (await authed(ownerToken).post('/api/pages').send({ name: 'Original', moduleType: 'TASK', group: 'personal' })).body;
        await authed(ownerToken).post('/api/tasks').send({ title: 'one', instanceId: page.id });

        const renamed = await authed(ownerToken).put(`/api/pages/${page.id}`).send({ name: 'Renamed' });
        const preview = await authed(ownerToken).get(`/api/pages/${page.id}/delete-preview`);
        expect(renamed.body).toMatchObject({ name: 'Renamed', slug: 'original' });
        expect(preview.body).toMatchObject({ itemCount: 1, rootLabel: 'tasks' });
    });

    it('keeps built-in roots in the null partition and cascades instance roots', async () => {
        const ownerToken = await tokenFor('OWNER', 'owner-cascade@example.com');
        const owner = await prisma.user.findUniqueOrThrow({ where: { email: 'owner-cascade@example.com' } });
        const builtIn = await prisma.ideaTopic.create({ data: { title: 'Built in', userId: owner.id } });
        const page = await prisma.pageInstance.create({ data: { name: 'Topics', slug: 'topics', moduleType: 'IDEA', group: 'personal', createdById: owner.id } });
        await prisma.ideaTopic.create({ data: { title: 'Custom', userId: owner.id, instanceId: page.id } });

        expect(builtIn.instanceId).toBeNull();
        await authed(ownerToken).delete(`/api/pages/${page.id}`);
        expect(await prisma.ideaTopic.count({ where: { instanceId: page.id } })).toBe(0);
        expect(await prisma.ideaTopic.findUnique({ where: { id: builtIn.id } })).not.toBeNull();
    });

    it('reassigns pages and preserves their records when the creator is deleted', async () => {
        const ownerToken = await tokenFor('OWNER', 'owner-transfer@example.com');
        await prisma.user.create({ data: { email: 'creator-transfer@example.com', name: 'Creator', password: await bcrypt.hash('Secret123!', 12), role: 'USER' } });
        const creator = await prisma.user.findUniqueOrThrow({ where: { email: 'creator-transfer@example.com' } });
        const owner = await prisma.user.findUniqueOrThrow({ where: { email: 'owner-transfer@example.com' } });
        const page = await prisma.pageInstance.create({ data: { name: 'Preserved', slug: 'preserved', moduleType: 'TASK', group: 'personal', createdById: creator.id } });
        await prisma.task.create({ data: { title: 'Keep me', userId: creator.id, instanceId: page.id } });

        expect((await authed(ownerToken).delete(`/api/users/${creator.id}`)).status).toBe(200);
        expect(await prisma.pageInstance.findUnique({ where: { id: page.id } })).toMatchObject({ createdById: owner.id });
        expect(await prisma.task.count({ where: { instanceId: page.id } })).toBe(1);
    });
});
