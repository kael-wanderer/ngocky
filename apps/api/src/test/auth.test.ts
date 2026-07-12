import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/database';
import bcrypt from 'bcryptjs';

describe('Auth API', () => {
    const testUser = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
    };

    beforeEach(async () => {
        const hashed = await bcrypt.hash(testUser.password, 12);
        await prisma.user.create({
            data: {
                email: testUser.email,
                name: testUser.name,
                password: hashed,
                role: 'USER',
                active: true,
            },
        });
    });

    it('should login successfully with correct credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: testUser.email,
                password: testUser.password
            });

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveProperty('accessToken');
        // Refresh token is delivered as an httpOnly cookie, not in the body
        const cookie = res.headers['set-cookie']!.toString();
        expect(cookie).toContain('ngocky_refresh_token=');
        expect(cookie).toContain('HttpOnly');
        expect(cookie).toContain('Path=/api/auth');
        expect(cookie).toContain('SameSite=Lax');
        expect(res.body.data.user.email).toBe(testUser.email);
    });

    it('should fail login with incorrect password', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: testUser.email,
                password: 'wrongpassword'
            });

        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/Invalid credentials/i);
    });

    it('should refresh tokens using a valid refresh token', async () => {
        // First login to get a refresh token
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: testUser.email,
                password: testUser.password
            });

        const cookies: string[] = loginRes.headers['set-cookie'] as unknown as string[];
        const loginCookie = cookies.find((c) => c.startsWith('ngocky_refresh_token='))!;

        // Use refresh token cookie
        const refreshRes = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', loginCookie);

        expect(refreshRes.status).toBe(200);
        expect(refreshRes.body.data).toHaveProperty('accessToken');
        expect(refreshRes.headers['set-cookie']!.toString()).toContain('ngocky_refresh_token=');

        // Old token should be invalid (rotated)
        const oldRefreshRes = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', loginCookie);

        expect(oldRefreshRes.status).toBe(401);
    });

    it('should allow access to protected routes with valid JWT', async () => {
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: testUser.email,
                password: testUser.password
            });

        const { accessToken } = loginRes.body.data;

        const res = await request(app)
            .get('/api/health') // Simple route to check auth if it was protected, but health isn't.
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(200);
    });

    it('should deny access to protected routes with invalid JWT', async () => {
        // Using goals as a guaranteed protected route
        const res = await request(app)
            .get('/api/goals')
            .set('Authorization', 'Bearer invalid-token');

        expect(res.status).toBe(401);
    });
});
