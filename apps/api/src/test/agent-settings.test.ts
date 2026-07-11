import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { config } from '../config/env';
import { AgentSettingsService } from '../services/agentSettings';
import { encryptSecret } from '../utils/secrets';

const providerAdapter = vi.hoisted(() => ({
    listModels: vi.fn(async () => [{ id: 'test-model' }]),
    testConnection: vi.fn(async () => ({ success: true, provider: 'OPENAI', model: 'test-model', latencyMs: 1 })),
}));

vi.mock('../services/assistant/providers/factory', () => ({
    createProviderAdapter: vi.fn(async () => providerAdapter),
    getActiveProviderAdapter: vi.fn(async () => null),
}));

import app from '../app';

async function tokenFor(role: 'OWNER' | 'ADMIN' | 'USER', email: string) {
    const password = 'password123';
    await prisma.user.create({ data: { email, name: role, password: await bcrypt.hash(password, 12), role, active: true } });
    const login = await request(app).post('/api/auth/login').send({ email, password });
    return login.body.data.accessToken as string;
}

describe('AgentSettingsService', () => {
    it('migrates the legacy encrypted OpenAI key without exposing it', async () => {
        const key = 'sk-legacy-secret-123456';
        await prisma.appSetting.create({
            data: { id: 1, openaiKeyCiphertext: encryptSecret(key), openaiKeyLast4: '3456' },
        });

        const result = await AgentSettingsService.get();
        const openai = result.providers.find((item) => item.provider === 'OPENAI');
        const stored = await prisma.agentProviderConfig.findUnique({ where: { provider: 'OPENAI' } });

        expect(openai).toMatchObject({ configured: true, keyLast4: '3456', keySource: 'db' });
        expect(JSON.stringify(result)).not.toContain(key);
        expect(stored?.keyCiphertext).toBeTruthy();
        expect((await AgentSettingsService.getActiveConfig())?.apiKey).toBe(key);
    });

    it('retains provider credentials when switching active provider', async () => {
        await AgentSettingsService.update({
            activeProvider: 'OPENAI', model: 'gpt-test', effort: 'low', apiKey: 'sk-openai-123456',
        });
        await AgentSettingsService.update({
            activeProvider: 'ANTHROPIC', model: 'claude-test', effort: 'high', apiKey: 'sk-ant-123456',
        });

        const result = await AgentSettingsService.get();
        expect(result.activeProvider).toBe('ANTHROPIC');
        expect(result.providers.find((item) => item.provider === 'OPENAI')).toMatchObject({ configured: true, keyLast4: '3456' });
        expect(result.providers.find((item) => item.provider === 'ANTHROPIC')).toMatchObject({ configured: true, keyLast4: '3456' });
    });

    it('preserves an existing key when settings are updated without apiKey', async () => {
        await AgentSettingsService.update({
            activeProvider: 'OPENAI', model: 'first-model', effort: 'auto', apiKey: 'sk-preserved-123456',
        });
        await AgentSettingsService.update({ activeProvider: 'OPENAI', model: 'second-model', effort: 'medium' });

        expect(await AgentSettingsService.getActiveConfig()).toMatchObject({ apiKey: 'sk-preserved-123456', model: 'second-model' });
    });

    it('uses the legacy OpenAI environment fallback only for OpenAI', async () => {
        const previous = config.OPENAI_API_KEY;
        (config as any).OPENAI_API_KEY = 'sk-env-12345678';
        try {
            const result = await AgentSettingsService.get();
            expect(result.providers.find((item) => item.provider === 'OPENAI')).toMatchObject({ configured: true, keySource: 'env', keyLast4: '5678' });
            expect(result.providers.find((item) => item.provider === 'ANTHROPIC')).toMatchObject({ configured: false, keySource: null });
        } finally {
            (config as any).OPENAI_API_KEY = previous;
        }
    });
});

describe('agent settings routes', () => {
    beforeEach(() => {
        providerAdapter.listModels.mockReset().mockResolvedValue([{ id: 'test-model' }]);
        providerAdapter.testConnection.mockReset().mockResolvedValue({ success: true, provider: 'OPENAI', model: 'test-model', latencyMs: 1 });
    });

    it('allows only OWNER access', async () => {
        expect((await request(app).get('/api/agent-settings')).status).toBe(401);
        const admin = await tokenFor('ADMIN', 'agent-admin@example.com');
        expect((await request(app).get('/api/agent-settings').set('Authorization', `Bearer ${admin}`)).status).toBe(403);
    });

    it('updates settings without returning the key', async () => {
        const owner = await tokenFor('OWNER', 'agent-owner@example.com');
        const key = 'sk-route-secret-123456';
        const response = await request(app).put('/api/agent-settings')
            .set('Authorization', `Bearer ${owner}`)
            .send({ activeProvider: 'OPENAI', model: 'gpt-test', effort: 'medium', apiKey: key });
        expect(response.status).toBe(200);
        expect(response.body.activeProvider).toBe('OPENAI');
        expect(JSON.stringify(response.body)).not.toContain(key);
        expect(response.body.providers.find((item: any) => item.provider === 'OPENAI')).toMatchObject({ keyLast4: '3456', keySource: 'db' });
    });

    it('discovers models, tests connections, and clears provider keys', async () => {
        const owner = await tokenFor('OWNER', 'agent-tools@example.com');
        const auth = { Authorization: `Bearer ${owner}` };
        await AgentSettingsService.update({ activeProvider: 'OPENAI', model: 'gpt-test', effort: 'auto', apiKey: 'sk-tools-12345678' });
        const body = { activeProvider: 'OPENAI', model: 'gpt-test', effort: 'auto', useSavedKey: true };

        const models = await request(app).post('/api/agent-settings/models').set(auth).send(body);
        expect(models.status).toBe(200);
        expect(models.body.models).toEqual([{ id: 'test-model' }]);

        const test = await request(app).post('/api/agent-settings/test').set(auth).send(body);
        expect(test.status).toBe(200);
        expect(test.body.success).toBe(true);

        const cleared = await request(app).delete('/api/agent-settings/OPENAI/key').set(auth);
        expect(cleared.status).toBe(200);
        expect(cleared.body.providers.find((item: any) => item.provider === 'OPENAI').configured).toBe(false);
    });

    it('rejects unsafe custom endpoints before persistence', async () => {
        const owner = await tokenFor('OWNER', 'agent-ssrf@example.com');
        const response = await request(app).put('/api/agent-settings')
            .set('Authorization', `Bearer ${owner}`)
            .send({ activeProvider: 'OPENAI_COMPATIBLE', baseUrl: 'https://127.0.0.1/v1', model: 'local', effort: 'auto' });
        expect(response.status).toBe(400);
        expect(await prisma.agentProviderConfig.findUnique({ where: { provider: 'OPENAI_COMPATIBLE' } })).toBeNull();
    });

    it('sanitizes model discovery errors', async () => {
        providerAdapter.listModels.mockRejectedValueOnce({ status: 401, message: 'upstream secret response' });
        const owner = await tokenFor('OWNER', 'agent-errors@example.com');
        await AgentSettingsService.update({ activeProvider: 'OPENAI', model: 'gpt-test', effort: 'auto', apiKey: 'sk-errors-123456' });
        const response = await request(app).post('/api/agent-settings/models')
            .set('Authorization', `Bearer ${owner}`)
            .send({ activeProvider: 'OPENAI', model: 'gpt-test', effort: 'auto', useSavedKey: true });
        expect(response.status).toBe(502);
        expect(response.body.message).toBe('Authentication failed');
        expect(JSON.stringify(response.body)).not.toContain('upstream secret');
    });
});
