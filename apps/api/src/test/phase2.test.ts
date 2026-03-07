import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/database';
import bcrypt from 'bcryptjs';

describe('Phase 2: Assets API', () => {
    let accessToken: string;

    beforeEach(async () => {
        const password = 'password123';
        const hashed = await bcrypt.hash(password, 12);
        await prisma.user.create({
            data: {
                email: 'phase2-test@example.com',
                name: 'Phase 2 Tester',
                password: hashed,
                role: 'USER',
                active: true,
            },
        });

        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'phase2-test@example.com',
                password
            });
        accessToken = loginRes.body.data.accessToken;
    });

    it('should create and list an asset', async () => {
        const assetData = {
            name: 'Tesla Model 3',
            brand: 'Tesla',
            model: '2024',
            type: 'Vehicle'
        };

        const createRes = await request(app)
            .post('/api/assets')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(assetData);

        expect(createRes.status).toBe(201);
        expect(createRes.body.data.name).toBe(assetData.name);

        const listRes = await request(app)
            .get('/api/assets')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(listRes.status).toBe(200);
        expect(listRes.body.data[0].name).toBe(assetData.name);
    });

    it('should manage maintenance records for an asset', async () => {
        // Create an asset first
        const assetRes = await request(app)
            .post('/api/assets')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                name: 'Maintenance Test Vehicle',
                type: 'Car',
                brand: 'Toyota',
                model: 'Camry'
            });
        const assetId = assetRes.body.data.id;

        const recordData = {
            assetId,
            serviceDate: new Date().toISOString(),
            serviceType: 'Oil Change',
            description: 'Routine maintenance',
            cost: 50.5
        };

        const createRes = await request(app)
            .post(`/api/assets/${assetId}/maintenance`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(recordData);

        expect(createRes.status).toBe(201);
        expect(createRes.body.data.serviceType).toBe(recordData.serviceType);

        const listRes = await request(app)
            .get(`/api/assets/${assetId}/maintenance`)
            .set('Authorization', `Bearer ${accessToken}`);

        expect(listRes.status).toBe(200);
        expect(listRes.body.data.length).toBe(1);
        expect(listRes.body.data[0].cost).toBe(50.5);
    });
});
