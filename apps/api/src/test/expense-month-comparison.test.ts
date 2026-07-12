import { describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/database';
import { config } from '../config/env';

describe('expense month comparison', () => {
    it('aggregates current and previous month categories within a page instance', async () => {
        const user = await prisma.user.create({ data: { email: 'expense-comparison@example.com', name: 'Owner', password: await bcrypt.hash('Secret123!', 12), role: 'OWNER' } });
        const page = await prisma.pageInstance.create({ data: { name: 'Monthly Expenses', slug: 'monthly-expenses', moduleType: 'EXPENSE', group: 'personal', createdById: user.id } });
        const now = new Date();
        await prisma.expense.createMany({
            data: [
                { description: 'Current food', amount: 300, date: new Date(now.getFullYear(), now.getMonth(), 5), userId: user.id, instanceId: page.id, type: 'PAY', payment: 'CASH', scope: 'PERSONAL', category: 'Food' },
                { description: 'Previous food', amount: 200, date: new Date(now.getFullYear(), now.getMonth() - 1, 5), userId: user.id, instanceId: page.id, type: 'PAY', payment: 'CASH', scope: 'PERSONAL', category: 'Food' },
            ],
        });
        const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, config.JWT_SECRET, { expiresIn: '1h' });
        const response = await request(app).get(`/api/reports/expense-month-comparison?instanceId=${page.id}`).set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.data.currentMonth.total).toBe(300);
        expect(response.body.data.previousMonth.total).toBe(200);
        expect(response.body.data.categories).toContainEqual({ category: 'Food', current: 300, previous: 200, percentChange: 50 });
    });
});
