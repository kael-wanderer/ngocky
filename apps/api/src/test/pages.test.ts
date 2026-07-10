import { describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app';
import { prisma } from '../config/database';

async function tokenFor(role: 'OWNER' | 'USER', email: string) {
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
});
