import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getAdapter: vi.fn() }));
vi.mock('../services/assistant/providers/factory', () => ({ getActiveProviderAdapter: mocks.getAdapter }));

import { parseIntent } from '../services/assistant/intentParser';

describe('provider-backed intent parser', () => {
    beforeEach(() => mocks.getAdapter.mockReset());

    it('uses normalized provider output', async () => {
        mocks.getAdapter.mockResolvedValue({
            generateStructuredIntent: vi.fn(async () => '```json\n{"intent":"help","confidence":0.9,"entities":{}}\n```'),
        });
        expect(await parseIntent('hello', 'Asia/Ho_Chi_Minh')).toMatchObject({ intent: 'help', confidence: 0.9 });
    });

    it('falls back when provider initialization or output fails', async () => {
        mocks.getAdapter.mockRejectedValueOnce(new Error('provider unavailable'));
        expect((await parseIntent('help', 'Asia/Ho_Chi_Minh')).intent).toBe('help');

        mocks.getAdapter.mockResolvedValueOnce({ generateStructuredIntent: vi.fn(async () => 'not-json') });
        expect((await parseIntent('help', 'Asia/Ho_Chi_Minh')).intent).toBe('help');
    });
});
