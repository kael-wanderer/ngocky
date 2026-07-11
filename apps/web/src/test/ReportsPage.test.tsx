import { describe, expect, it } from 'vitest';
import { buildReportPageQuery } from '../pages/reports';

describe('reports page filter', () => {
    it('adds an instance only to the matching report template', () => {
        expect(buildReportPageQuery('dateFrom=2026-01-01', 'EXPENSE', { id: 'page-1', moduleType: 'EXPENSE' }))
            .toBe('dateFrom=2026-01-01&instanceId=page-1');
        expect(buildReportPageQuery('dateFrom=2026-01-01', 'GOAL', { id: 'page-1', moduleType: 'EXPENSE' }))
            .toBe('dateFrom=2026-01-01');
        expect(buildReportPageQuery('', 'GOAL', null)).toBe('');
    });
});
