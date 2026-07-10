import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('setup wizard', () => {
    it('reports needsSetup=true on empty DB', async () => {
        const res = await request(app).get('/api/setup/status');

        expect(res.status).toBe(200);
        expect(res.body.needsSetup).toBe(true);
    });

    it('creates owner and app settings, then locks', async () => {
        const res = await request(app).post('/api/setup').send({
            appName: 'FamilyHub',
            enabledGroups: ['personal', 'family'],
            owner: { email: 'boss@example.com', password: 'Secret123!', name: 'Boss' },
        });

        expect(res.status).toBe(201);

        const status = await request(app).get('/api/setup/status');
        expect(status.body.needsSetup).toBe(false);

        const again = await request(app).post('/api/setup').send({
            appName: 'Hijack',
            enabledGroups: [],
            owner: { email: 'evil@example.com', password: 'Secret123!', name: 'Evil' },
        });
        expect(again.status).toBe(403);

        const login = await request(app).post('/api/auth/login').send({
            email: 'boss@example.com',
            password: 'Secret123!',
        });
        expect(login.status).toBe(200);
    });
});
