import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import app from '../app';
import { prisma } from '../config/database';
import { tick, tickReports, recentNotifications } from '../services/scheduler';

async function makeOwner() {
    return prisma.user.create({
        data: { email: `sched-${Date.now()}@test.local`, name: 'Sched', password: 'x', role: 'OWNER', active: true },
    });
}

describe('scheduler tick', () => {
    let server: Server;
    let base: string;

    beforeAll(async () => {
        server = app.listen(0);
        const address = server.address() as { port: number };
        base = `http://127.0.0.1:${address.port}/api`;
    });
    afterAll(() => server.close());

    it('fires a due notification once, marks it sent, exposes it to the user', async () => {
        const owner = await makeOwner();
        const task = await prisma.task.create({
            data: {
                title: 'Scheduler smoke',
                userId: owner.id,
                dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
                notificationEnabled: true,
                reminderOffsetUnit: 'HOURS',
                reminderOffsetValue: 4,
                notificationDate: new Date(Date.now() - 60 * 60 * 1000),
                notificationTime: '09:00',
            },
        });

        await tick(180, base);
        const fired = recentNotifications(owner.id).filter((n) => n.id === task.id);
        expect(fired.length).toBe(1);

        const marked = await prisma.task.findUnique({ where: { id: task.id } });
        expect(marked!.lastNotificationSentAt).not.toBeNull();

        await tick(180, base); // cooldown (default 24h) suppresses refire
        expect(recentNotifications(owner.id).filter((n) => n.id === task.id).length).toBe(1);
    });

    it('fires a due report once with OS + telegram routing state', async () => {
        const owner = await makeOwner();
        const vnNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
        const time = `${String(vnNow.getUTCHours()).padStart(2, '0')}:${String(vnNow.getUTCMinutes()).padStart(2, '0')}`;
        const report = await prisma.scheduledReport.create({
            data: { name: 'Daily digest', reportType: 'TODAY_TASKS', frequency: 'DAILY', time, userId: owner.id },
        });

        await tickReports(base);
        const fired = recentNotifications(owner.id).filter((n) => n.id === report.id);
        expect(fired.length).toBe(1);
        expect(fired[0].sourceType).toBe('REPORT');
        expect(fired[0].title).toContain('Daily digest');

        await tickReports(base);
        expect(recentNotifications(owner.id).filter((n) => n.id === report.id).length).toBe(1);
    });
});
