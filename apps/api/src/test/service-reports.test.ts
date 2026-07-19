import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/database';
import { config } from '../config/env';

const serviceHeaders = { 'X-Assistant-Api-Key': config.ASSISTANT_API_KEY };

function vnNowTime(): string {
    const vn = new Date(Date.now() + 7 * 60 * 60 * 1000);
    return `${String(vn.getUTCHours()).padStart(2, '0')}:${String(vn.getUTCMinutes()).padStart(2, '0')}`;
}

describe('due-reports claim', () => {
    it('returns a due report once, then suppresses within the guard window', async () => {
        const owner = await prisma.user.create({
            data: { email: `rep-${Date.now()}@test.local`, name: 'Rep', password: 'x', role: 'OWNER', active: true },
        });
        const report = await prisma.scheduledReport.create({
            data: { name: 'Daily digest', reportType: 'TODAY_TASKS', frequency: 'DAILY', time: vnNowTime(), userId: owner.id },
        });

        const first = await request(app).get('/api/service/due-reports').set(serviceHeaders);
        expect(first.status).toBe(200);
        expect(first.body.data.map((r: any) => r.id)).toContain(report.id);

        const marked = await prisma.scheduledReport.findUnique({ where: { id: report.id } });
        expect(marked!.lastSentAt).not.toBeNull();

        const second = await request(app).get('/api/service/due-reports').set(serviceHeaders);
        expect(second.body.data.map((r: any) => r.id)).not.toContain(report.id);
    });
});
