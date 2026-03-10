import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app';
import { prisma } from '../config/database';

describe('Service due notifications', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('sends alert rules once per scheduled day regardless of cooldownHours', async () => {
        const password = 'password123';
        const hashed = await bcrypt.hash(password, 12);

        await prisma.user.create({
            data: {
                email: 'service-test@example.com',
                name: 'Service Tester',
                password: hashed,
                role: 'OWNER',
                active: true,
            },
        });

        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'service-test@example.com',
                password,
            });

        const accessToken = loginRes.body.data.accessToken as string;
        const userId = loginRes.body.data.user.id as string;

        await prisma.task.create({
            data: {
                title: 'Overdue task',
                userId,
                dueDate: new Date('2026-03-09T00:00:00.000Z'),
            },
        });

        await prisma.alertRule.create({
            data: {
                name: 'Daily overdue tasks',
                userId,
                moduleType: 'TASK',
                frequency: 'DAILY',
                time: '08:00',
                conditionType: 'OVERDUE',
                cooldownHours: 48,
                active: true,
            },
        });

        vi.useFakeTimers();

        vi.setSystemTime(new Date('2026-03-10T01:05:00.000Z'));
        const firstRun = await request(app)
            .get('/api/service/due-notifications')
            .set('Authorization', `Bearer ${accessToken}`);
        expect(firstRun.status).toBe(200);
        expect(firstRun.body.data).toHaveLength(1);

        const secondRunSameDay = await request(app)
            .get('/api/service/due-notifications')
            .set('Authorization', `Bearer ${accessToken}`);
        expect(secondRunSameDay.status).toBe(200);
        expect(secondRunSameDay.body.data).toHaveLength(0);

        vi.setSystemTime(new Date('2026-03-11T01:05:00.000Z'));
        const nextDayRun = await request(app)
            .get('/api/service/due-notifications')
            .set('Authorization', `Bearer ${accessToken}`);
        expect(nextDayRun.status).toBe(200);
        expect(nextDayRun.body.data).toHaveLength(1);
    });
});
