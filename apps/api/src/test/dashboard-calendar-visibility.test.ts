import { describe, it, expect } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app';
import { prisma } from '../config/database';

describe('Dashboard calendar visibility', () => {
    it('shows this-week events shared through participants', async () => {
        const password = 'password123';
        const hashed = await bcrypt.hash(password, 12);

        const viewer = await prisma.user.create({
            data: {
                email: 'viewer@example.com',
                name: 'Viewer',
                password: hashed,
                role: 'USER',
                active: true,
            },
        });

        const owner = await prisma.user.create({
            data: {
                email: 'owner@example.com',
                name: 'Owner',
                password: hashed,
                role: 'USER',
                active: true,
            },
        });

        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: viewer.email,
                password,
            });

        const accessToken = loginRes.body.data.accessToken;
        const now = new Date();
        const eventStart = new Date(now);
        eventStart.setDate(now.getDate() + 1);
        eventStart.setHours(22, 0, 0, 0);

        const eventEnd = new Date(eventStart);
        eventEnd.setMinutes(30);

        const event = await prisma.calendarEvent.create({
            data: {
                title: 'Participant-visible meeting',
                startDate: eventStart,
                endDate: eventEnd,
                isShared: false,
                createdById: owner.id,
                participants: {
                    create: [{ userId: viewer.id }],
                },
            },
        });

        const dashboardRes = await request(app)
            .get('/api/dashboard?timeRange=THIS_WEEK&status=PENDING')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(dashboardRes.status).toBe(200);
        expect(dashboardRes.body.data.upcomingEvents.some((item: any) => item.id === event.id)).toBe(true);

        const calendarRes = await request(app)
            .get(`/api/calendar?startFrom=${eventStart.toISOString()}&startTo=${eventEnd.toISOString()}&limit=50`)
            .set('Authorization', `Bearer ${accessToken}`);

        expect(calendarRes.status).toBe(200);
        expect(calendarRes.body.data.some((item: any) => item.id === event.id)).toBe(true);
    });
});
