import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/database';
import bcrypt from 'bcryptjs';

describe('Housework API', () => {
    let accessToken: string;
    let userId: string;

    beforeEach(async () => {
        const password = 'password123';
        const hashed = await bcrypt.hash(password, 12);
        const user = await prisma.user.create({
            data: {
                email: 'housework-test@example.com',
                name: 'Housework Tester',
                password: hashed,
                role: 'USER',
                active: true,
            },
        });
        userId = user.id;

        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'housework-test@example.com',
                password
            });

        if (loginRes.status !== 200) {
            console.error('Login failed in housework.test.ts:', loginRes.body);
        }
        expect(loginRes.status).toBe(200);
        accessToken = loginRes.body.data.accessToken;
    });

    it('should create a recurring housework item', async () => {
        const itemData = {
            title: 'Weekly Vacuuming',
            frequencyType: 'WEEKLY',
            nextDueDate: new Date().toISOString()
        };

        const res = await request(app)
            .post('/api/housework')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(itemData);

        expect(res.status).toBe(201);
        expect(res.body.data.title).toBe(itemData.title);
        expect(res.body.data.frequencyType).toBe('WEEKLY');
    });

    it('should advance nextDueDate when completing a recurring item', async () => {
        // Create a recurring item first
        const createRes = await request(app)
            .post('/api/housework')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                title: 'Recurring Test',
                frequencyType: 'WEEKLY',
                nextDueDate: new Date().toISOString()
            });

        const item = createRes.body.data;
        const originalDueDate = new Date(item.nextDueDate);

        const completeRes = await request(app)
            .post(`/api/housework/${item.id}/complete`)
            .set('Authorization', `Bearer ${accessToken}`);

        expect(completeRes.status).toBe(200);

        const newDueDate = new Date(completeRes.body.data.nextDueDate);
        expect(newDueDate.getTime()).toBeGreaterThan(originalDueDate.getTime());
    });

    it('should deactivate a one-time housework item upon completion', async () => {
        const itemData = {
            title: 'Fix leaked pipe',
            frequencyType: 'ONE_TIME',
            nextDueDate: new Date().toISOString()
        };

        const createRes = await request(app)
            .post('/api/housework')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(itemData);

        const itemId = createRes.body.data.id;

        const completeRes = await request(app)
            .post(`/api/housework/${itemId}/complete`)
            .set('Authorization', `Bearer ${accessToken}`);

        expect(completeRes.status).toBe(200);
        expect(completeRes.body.data.active).toBe(false);
    });
});
