import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/database';
import bcrypt from 'bcryptjs';

describe('Goals & Check-ins API', () => {
    let accessToken: string;
    let userId: string;

    beforeEach(async () => {
        const password = 'password123';
        const hashed = await bcrypt.hash(password, 12);
        const user = await prisma.user.create({
            data: {
                email: 'goals-test@example.com',
                name: 'Goals Tester',
                password: hashed,
                role: 'USER',
                active: true,
            },
        });
        userId = user.id;

        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'goals-test@example.com',
                password
            });

        if (loginRes.status !== 200) {
            console.error('Login failed in goals.test.ts:', loginRes.body);
        }
        expect(loginRes.status).toBe(200);
        accessToken = loginRes.body.data.accessToken;
    });

    it('should create a new goal', async () => {
        const goalData = {
            title: 'Test Goal',
            description: 'Test Description',
            periodType: 'WEEKLY',
            targetCount: 3
        };

        const res = await request(app)
            .post('/api/goals')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(goalData);

        expect(res.status).toBe(201);
        expect(res.body.data.title).toBe(goalData.title);
        expect(res.body.data.userId).toBe(userId);
        expect(res.body.data.currentCount).toBe(0);
    });

    it('should list user goals', async () => {
        // Create a goal first to ensure list is not empty
        await request(app)
            .post('/api/goals')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                title: 'List Test Goal',
                periodType: 'WEEKLY',
                targetCount: 5
            });

        const res = await request(app)
            .get('/api/goals')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should record a check-in and increment goal progress', async () => {
        // Create a goal first
        const createRes = await request(app)
            .post('/api/goals')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                title: 'Check-in Goal',
                periodType: 'WEEKLY',
                targetCount: 10
            });
        const goalId = createRes.body.data.id;

        const checkInRes = await request(app)
            .post('/api/checkins')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                goalId,
                quantity: 1,
                note: 'Worked on it!'
            });

        expect(checkInRes.status).toBe(201);
        expect(checkInRes.body.data.checkIn.goalId).toBe(goalId);
        expect(checkInRes.body.data.goal.currentCount).toBe(1);

        // Verify via goal GET
        const goalRes = await request(app)
            .get(`/api/goals/${goalId}`)
            .set('Authorization', `Bearer ${accessToken}`);

        expect(goalRes.body.data.currentCount).toBe(1);
    });

    it('should allow a same-day check-in even when the submitted timestamp is later than now', async () => {
        const createRes = await request(app)
            .post('/api/goals')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                title: 'Same-day Check-in Goal',
                periodType: 'WEEKLY',
                targetCount: 10
            });
        const goalId = createRes.body.data.id;

        const now = new Date();
        const sameDayFutureTimestamp = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            23,
            59,
            0,
            0
        )).toISOString();

        const checkInRes = await request(app)
            .post('/api/checkins')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                goalId,
                quantity: 1,
                date: sameDayFutureTimestamp,
            });

        expect(checkInRes.status).toBe(201);
        expect(checkInRes.body.data.checkIn.goalId).toBe(goalId);
    });

    it('should decrement progress when a check-in is deleted', async () => {
        // Create goal and check-in first
        const createRes = await request(app)
            .post('/api/goals')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                title: 'Delete Check-in Goal',
                periodType: 'WEEKLY',
                targetCount: 10
            });
        const goalId = createRes.body.data.id;

        const checkInRes = await request(app)
            .post('/api/checkins')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                goalId,
                quantity: 1,
                note: 'To be deleted'
            });

        const checkInId = checkInRes.body.data.checkIn.id;

        const deleteRes = await request(app)
            .delete(`/api/checkins/${checkInId}`)
            .set('Authorization', `Bearer ${accessToken}`);

        expect(deleteRes.status).toBe(200);

        // Verify progress decremented
        const goalRes = await request(app)
            .get(`/api/goals/${goalId}`)
            .set('Authorization', `Bearer ${accessToken}`);

        expect(goalRes.body.data.currentCount).toBe(0);
    });

    it('should aggregate goal check-in trends by weekday, hour, day, and goal', async () => {
        const createRes = await request(app)
            .post('/api/goals')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                title: 'Trend Goal',
                periodType: 'WEEKLY',
                targetCount: 10,
            });
        const goalId = createRes.body.data.id;

        const checkIns = [
            { date: '2026-03-09T01:00:00.000Z', quantity: 1 },
            { date: '2026-03-09T13:00:00.000Z', quantity: 2 },
            { date: '2026-03-10T01:30:00.000Z', quantity: 3 },
        ];

        for (const checkIn of checkIns) {
            const response = await request(app)
                .post('/api/checkins')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    goalId,
                    quantity: checkIn.quantity,
                    date: checkIn.date,
                });

            expect(response.status).toBe(201);
        }

        const trendRes = await request(app)
            .get('/api/reports/goal-trends')
            .query({
                dateFrom: '2026-03-09T00:00:00.000Z',
                dateTo: '2026-03-10T23:59:59.999Z',
            })
            .set('Authorization', `Bearer ${accessToken}`);

        expect(trendRes.status).toBe(200);
        expect(trendRes.body.data.summary.totalCheckIns).toBe(3);
        expect(trendRes.body.data.summary.totalQuantity).toBe(6);
        expect(trendRes.body.data.summary.activeDays).toBe(2);
        expect(trendRes.body.data.summary.topWeekday).toBe('Mon');
        expect(trendRes.body.data.summary.topHour).toBe('08:00');

        expect(trendRes.body.data.weekdayCounts.find((item: any) => item.weekday === 'Mon')).toMatchObject({
            weekday: 'Mon',
            count: 2,
            quantity: 3,
        });
        expect(trendRes.body.data.weekdayCounts.find((item: any) => item.weekday === 'Tue')).toMatchObject({
            weekday: 'Tue',
            count: 1,
            quantity: 3,
        });
        expect(trendRes.body.data.hourCounts.find((item: any) => item.hour === '08:00')).toMatchObject({
            hour: '08:00',
            count: 2,
            quantity: 4,
        });
        expect(trendRes.body.data.dailyTrend).toEqual([
            { date: '2026-03-09', count: 2, quantity: 3 },
            { date: '2026-03-10', count: 1, quantity: 3 },
        ]);
        expect(trendRes.body.data.topGoals[0]).toMatchObject({
            goalId,
            title: 'Trend Goal',
            count: 3,
            quantity: 6,
        });
    });
});
