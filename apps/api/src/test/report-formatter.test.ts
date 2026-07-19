import { describe, expect, it } from 'vitest';
import { formatReport, summaryLine } from '../services/reportFormatter';

const taskReport = {
    reportType: 'TODAY_TASKS',
    sections: [],
    page: { name: 'Personal' },
    tasks: [{ title: 'Pay bill', priority: 'HIGH', dueDate: '2026-07-19T02:00:00.000Z', status: 'IN_PROGRESS' }],
    project: [{ title: 'Ship v2', project: 'NgocKy', deadline: '2026-07-19T10:00:00.000Z', status: 'IN_PROGRESS', priority: 'MEDIUM', type: 'FEATURE' }],
    calendar: [{ title: 'Dentist', startDate: '2026-07-19T08:00:00.000Z', location: 'Q1', allDay: false }],
    expenses: [{ description: 'Coffee', amount: 45000, type: 'PAY', category: 'FOOD', date: '2026-07-19T01:00:00.000Z' }],
    goals: [], housework: [], cakeo: [], assets: [], healthbook: [], keyboard: [], funds: [], learning: [], ideas: [],
};

const weeklySummary = {
    reportType: 'WEEKLY_SUMMARY',
    sections: ['tasks', 'expenses'],
    page: { name: 'Personal' },
    period: { start: '2026-07-13T17:00:00.000Z', end: '2026-07-20T16:59:59.999Z' },
    tasks: { done: [{ title: 'Old chore', dueDate: null }], inProgress: [], total: 1 },
    project: { done: [], inProgress: [], total: 0 },
    expenses: { totalPaid: 500000, totalReceived: 0, net: -500000, count: 3, items: [] },
    goals: [], housework: [], calendar: [], assets: [], learning: [], ideas: [], cakeo: [], healthbook: [], keyboard: [], funds: [],
};

describe('formatReport', () => {
    it('formats a task report with item titles and VND amounts', () => {
        const text = formatReport('Daily digest', taskReport);
        expect(text).toContain('Daily digest');
        expect(text).toContain('Pay bill');
        expect(text).toContain('Ship v2');
        expect(text).toContain('Dentist');
        expect(text).toContain('45.000');
    });

    it('respects the sections filter on summaries', () => {
        const text = formatReport('Weekly', weeklySummary);
        expect(text).toContain('Old chore');
        expect(text).toContain('500.000');
        expect(text).not.toContain('Projects');
    });

    it('truncates below the Telegram limit', () => {
        const huge = {
            ...taskReport,
            tasks: Array.from({ length: 500 }, (_, i) => ({
                title: `Task number ${i} with a fairly long title`,
                priority: 'LOW',
                dueDate: null,
                status: 'TODO',
            })),
        };
        expect(formatReport('Big', huge).length).toBeLessThanOrEqual(4000);
    });
});

describe('summaryLine', () => {
    it('counts non-empty sections', () => {
        expect(summaryLine(taskReport)).toContain('1 task');
    });
});
