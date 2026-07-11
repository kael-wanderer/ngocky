import { describe, expect, it } from 'vitest';
import { prisma } from '../config/database';
import { resolveAssistantPage } from '../services/assistant/pageResolution';

describe('assistant page resolution', () => {
    it('resolves an exact page name and reports ambiguity instead of guessing', async () => {
        const user = await prisma.user.create({ data: { email: 'page-resolution@example.com', name: 'Owner', password: 'hash', role: 'OWNER' } });
        await prisma.pageInstance.create({ data: { name: 'Work Tasks', slug: 'work-tasks', moduleType: 'TASK', group: 'personal', createdById: user.id } });
        const exact = await resolveAssistantPage(user.id, 'work tasks', 'TASK');
        expect(exact.status).toBe('resolved');

        await prisma.pageInstance.create({ data: { name: 'Work Tasks', slug: 'work-tasks-2', moduleType: 'TASK', group: 'personal', createdById: user.id } });
        const ambiguous = await resolveAssistantPage(user.id, 'WORK TASKS', 'TASK');
        expect(ambiguous.status).toBe('ambiguous');
    });
});
