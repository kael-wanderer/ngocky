import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { config } from '../config/env';

const { mockParseIntent } = vi.hoisted(() => ({
    mockParseIntent: vi.fn(),
}));

vi.mock('../services/assistant/intentParser', async () => {
    const actual = await vi.importActual<typeof import('../services/assistant/intentParser')>(
        '../services/assistant/intentParser',
    );

    return {
        ...actual,
        parseIntent: mockParseIntent,
    };
});

import app from '../app';

describe('Assistant Phase 7', () => {
    const assistantHeaders = {
        'X-Assistant-Api-Key': config.ASSISTANT_API_KEY,
    };

    beforeEach(() => {
        mockParseIntent.mockReset();
    });

    it('stores a pending action for ambiguous task updates and resolves the follow-up selection', async () => {
        const password = await bcrypt.hash('password123', 12);
        const user = await prisma.user.create({
            data: {
                email: 'assistant-phase7-1@example.com',
                name: 'Assistant Tester',
                password,
                active: true,
                timezone: 'Asia/Ho_Chi_Minh',
            },
        });

        await prisma.telegramLink.create({
            data: {
                userId: user.id,
                telegramChatId: 'chat-phase7-1',
                telegramUserId: 'tg-user-1',
                telegramUsername: 'phase7_user',
                verifiedAt: new Date(),
            },
        });

        const firstTask = await prisma.task.create({
            data: {
                userId: user.id,
                title: 'Pay electricity bill March',
                status: 'PLANNED',
                priority: 'MEDIUM',
            },
        });

        const secondTask = await prisma.task.create({
            data: {
                userId: user.id,
                title: 'Pay electricity bill April',
                status: 'PLANNED',
                priority: 'MEDIUM',
            },
        });

        mockParseIntent.mockResolvedValue({
            intent: 'update_task_status',
            confidence: 0.95,
            entities: {
                taskTitle: 'Pay electricity bill',
                status: 'done',
            },
        });

        const promptRes = await request(app)
            .post('/api/assistant/telegram/message')
            .set(assistantHeaders)
            .send({
                chatId: 'chat-phase7-1',
                telegramUserId: 'tg-user-1',
                telegramUsername: 'phase7_user',
                messageId: 'msg-1',
                text: 'mark electricity done',
            });

        expect(promptRes.status).toBe(200);
        expect(promptRes.body.requiresConfirmation).toBe(true);
        expect(promptRes.body.reply).toContain('Reply with a number');

        const pending = await prisma.assistantPendingAction.findMany({
            where: { userId: user.id },
        });
        expect(pending).toHaveLength(1);

        const confirmRes = await request(app)
            .post('/api/assistant/telegram/message')
            .set(assistantHeaders)
            .send({
                chatId: 'chat-phase7-1',
                telegramUserId: 'tg-user-1',
                telegramUsername: 'phase7_user',
                messageId: 'msg-2',
                text: '2',
            });

        expect(confirmRes.status).toBe(200);
        expect(confirmRes.body.reply).toContain('Marked done');
        expect(confirmRes.body.requiresConfirmation).toBe(false);

        const refreshedFirstTask = await prisma.task.findUnique({ where: { id: firstTask.id } });
        const refreshedSecondTask = await prisma.task.findUnique({ where: { id: secondTask.id } });
        expect(refreshedFirstTask?.status).toBe('PLANNED');
        expect(refreshedSecondTask?.status).toBe('DONE');
    });

    it('creates a low-confidence confirmation prompt and executes after user confirmation', async () => {
        const password = await bcrypt.hash('password123', 12);
        const user = await prisma.user.create({
            data: {
                email: 'assistant-phase7-2@example.com',
                name: 'Assistant Tester 2',
                password,
                active: true,
                timezone: 'Asia/Ho_Chi_Minh',
            },
        });

        await prisma.telegramLink.create({
            data: {
                userId: user.id,
                telegramChatId: 'chat-phase7-2',
                telegramUserId: 'tg-user-2',
                telegramUsername: 'phase7_user_2',
                verifiedAt: new Date(),
            },
        });

        mockParseIntent.mockResolvedValue({
            intent: 'create_task',
            confidence: 0.4,
            entities: {
                title: 'Buy milk tonight',
            },
        });

        const promptRes = await request(app)
            .post('/api/assistant/telegram/message')
            .set(assistantHeaders)
            .send({
                chatId: 'chat-phase7-2',
                telegramUserId: 'tg-user-2',
                telegramUsername: 'phase7_user_2',
                messageId: 'msg-3',
                text: 'buy milk tonight',
            });

        expect(promptRes.status).toBe(200);
        expect(promptRes.body.requiresConfirmation).toBe(true);
        expect(promptRes.body.reply).toContain('1\\. Confirm');

        const confirmRes = await request(app)
            .post('/api/assistant/telegram/message')
            .set(assistantHeaders)
            .send({
                chatId: 'chat-phase7-2',
                telegramUserId: 'tg-user-2',
                telegramUsername: 'phase7_user_2',
                messageId: 'msg-4',
                text: '1',
            });

        expect(confirmRes.status).toBe(200);
        expect(confirmRes.body.requiresConfirmation).toBe(false);
        expect(confirmRes.body.reply).toContain('Created task');

        const createdTask = await prisma.task.findFirst({
            where: { userId: user.id, title: 'Buy milk tonight' },
        });
        expect(createdTask).not.toBeNull();
    });
});
