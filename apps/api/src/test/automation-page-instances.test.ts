import { describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/database';
import { config } from '../config/env';

async function auth() {
    const user = await prisma.user.create({
        data: { email: 'automation-page@example.com', name: 'Owner', password: await bcrypt.hash('Secret123!', 12), role: 'OWNER' },
    });
    return {
        user,
        token: jwt.sign({ userId: user.id, email: user.email, role: user.role }, config.JWT_SECRET, { expiresIn: '1h' }),
    };
}

describe('automation page instances', () => {
    it('stores scheduled report and alert page origins and rejects mismatched alert pages', async () => {
        const { user, token } = await auth();
        const page = await prisma.pageInstance.create({
            data: { name: 'Family Calendar', slug: 'family-calendar', moduleType: 'CALENDAR', group: 'family', createdById: user.id },
        });
        const headers = { Authorization: `Bearer ${token}` };

        const report = await request(app).post('/api/scheduled-reports').set(headers).send({
            name: 'Family report', reportType: 'WEEKLY_SUMMARY', frequency: 'WEEKLY', instanceId: page.id,
        });
        expect(report.status).toBe(201);
        expect(report.body.data.instanceId).toBe(page.id);

        const reports = await request(app).get('/api/scheduled-reports').set(headers);
        expect(reports.body.data[0].instance).toMatchObject({ id: page.id, slug: page.slug, moduleType: 'CALENDAR' });

        const alert = await request(app).post('/api/alerts').set(headers).send({
            name: 'Calendar due', moduleType: 'CALENDAR', conditionType: 'DUE_TODAY', instanceId: page.id,
        });
        expect(alert.status).toBe(201);

        const alerts = await request(app).get('/api/alerts').set(headers);
        expect(alerts.body.data[0].instance).toMatchObject({ id: page.id, slug: page.slug, moduleType: 'CALENDAR' });

        const mismatch = await request(app).post('/api/alerts').set(headers).send({
            name: 'Wrong page', moduleType: 'GOAL', conditionType: 'OVERDUE', instanceId: page.id,
        });
        expect(mismatch.status).toBe(400);
    });
});
