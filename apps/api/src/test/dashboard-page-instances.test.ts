import { describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/database';
import { config } from '../config/env';

describe('dashboard page instances', () => {
    it('returns custom page origin metadata for pinned records', async () => {
        const user = await prisma.user.create({
            data: {
                email: 'dashboard-instance@example.com',
                name: 'Dashboard Owner',
                password: await bcrypt.hash('Secret123!', 12),
                role: 'OWNER',
                active: true,
            },
        });
        const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, config.JWT_SECRET, { expiresIn: '1h' });
        const page = await prisma.pageInstance.create({
            data: { name: 'Custom Goals', slug: 'custom-goals', moduleType: 'GOAL', group: 'personal', createdById: user.id },
        });
        const goal = await prisma.goal.create({
            data: {
                title: 'Custom pinned goal',
                userId: user.id,
                instanceId: page.id,
                periodType: 'WEEKLY',
                targetCount: 1,
                currentPeriodStart: new Date(),
                pinToDashboard: true,
            },
        });

        const response = await request(app)
            .get('/api/dashboard?timeRange=THIS_WEEK&status=PENDING')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.data.pinnedItems).toContainEqual(expect.objectContaining({
            id: goal.id,
            type: 'GOAL',
            page: { id: page.id, name: page.name, slug: page.slug },
        }));
    });
});
