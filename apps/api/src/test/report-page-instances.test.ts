import { describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/database';
import { config } from '../config/env';

describe('report page instances', () => {
    it('keeps report defaults built-in-only and filters custom pages by instance', async () => {
        const user = await prisma.user.create({
            data: {
                email: 'reports-instance@example.com',
                name: 'Reports Owner',
                password: await bcrypt.hash('Secret123!', 12),
                role: 'OWNER',
                active: true,
            },
        });
        const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, config.JWT_SECRET, { expiresIn: '1h' });
        const page = await prisma.pageInstance.create({
            data: { name: 'Custom Projects', slug: 'custom-projects', moduleType: 'PROJECT', group: 'personal', createdById: user.id },
        });
        const project = await prisma.project.create({
            data: { name: 'Custom board', ownerId: user.id, instanceId: page.id },
        });
        await prisma.projectTask.create({
            data: { title: 'Custom report task', projectId: project.id, createdById: user.id },
        });

        const headers = { Authorization: `Bearer ${token}` };
        const builtIn = await request(app).get('/api/reports/raw-records?module=project').set(headers);
        const custom = await request(app).get(`/api/reports/raw-records?module=project&instanceId=${page.id}`).set(headers);
        const wrongTemplate = await request(app).get(`/api/reports/raw-records?module=tasks&instanceId=${page.id}`).set(headers);

        expect(builtIn.status).toBe(200);
        expect(builtIn.body.data).toEqual([]);
        expect(custom.status).toBe(200);
        expect(custom.body.data).toEqual([expect.objectContaining({ title: 'Custom report task' })]);
        expect(wrongTemplate.status).toBe(400);
    });
});
