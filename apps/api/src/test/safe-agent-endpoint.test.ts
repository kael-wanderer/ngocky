import { describe, expect, it, vi } from 'vitest';
import { createServer } from 'http';
import { createSafeAgentFetch, isPrivateAgentAddress, validateAgentEndpoint } from '../utils/safeAgentEndpoint';

const publicLookup = vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]);

describe('safe agent endpoint', () => {
    it.each([
        '127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254',
        '::1', 'fd00::1', 'fe80::1', 'ff02::1',
    ])('recognizes private or special address %s', (address) => {
        expect(isPrivateAgentAddress(address)).toBe(true);
    });

    it('rejects unsafe protocols, credentials, localhost, private DNS, and HTTP by default', async () => {
        await expect(validateAgentEndpoint('file:///etc/passwd')).rejects.toThrow('protocol');
        await expect(validateAgentEndpoint('https://user:pass@example.com', { lookup: publicLookup })).rejects.toThrow('credentials');
        await expect(validateAgentEndpoint('https://localhost/v1')).rejects.toThrow('Private');
        await expect(validateAgentEndpoint('https://internal.example/v1', {
            lookup: async () => [{ address: '10.0.0.5', family: 4 }],
        })).rejects.toThrow('Private');
        await expect(validateAgentEndpoint('http://example.com/v1', { lookup: publicLookup })).rejects.toThrow('HTTPS');
    });

    it('accepts public HTTPS and explicit private HTTP endpoints', async () => {
        await expect(validateAgentEndpoint('https://example.com/v1', { lookup: publicLookup })).resolves.toMatchObject({ url: expect.any(URL) });
        await expect(validateAgentEndpoint('http://192.168.1.10:11434/v1', { allowPrivate: true })).resolves.toMatchObject({ url: expect.any(URL) });
        await expect(validateAgentEndpoint('http://localhost:11434/v1', {
            allowPrivate: true,
            lookup: async () => [{ address: '127.0.0.1', family: 4 }],
        })).resolves.toMatchObject({ url: expect.any(URL) });
    });

    it('revalidates redirect targets and rejects private redirects', async () => {
        const fetchImpl = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/secret' } }));
        const safeFetch = createSafeAgentFetch({ lookup: publicLookup, fetchImpl: fetchImpl as typeof fetch });
        await expect(safeFetch('https://example.com/v1')).rejects.toThrow();
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('rejects oversized declared responses', async () => {
        const fetchImpl = vi.fn(async () => new Response('{}', { headers: { 'content-length': String(3 * 1024 * 1024) } }));
        const safeFetch = createSafeAgentFetch({ lookup: publicLookup, fetchImpl: fetchImpl as typeof fetch });
        await expect(safeFetch('https://example.com/v1')).rejects.toThrow('too large');
    });

    it('pins and completes an allowed private connection', async () => {
        const server = createServer((_req, res) => {
            res.setHeader('content-type', 'application/json');
            res.end('{"ok":true}');
        });
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        try {
            const address = server.address();
            if (!address || typeof address === 'string') throw new Error('Test server did not bind');
            const response = await createSafeAgentFetch({
                allowPrivate: true,
                lookup: async () => [{ address: '127.0.0.1', family: 4 }],
            })(`http://localhost:${address.port}/v1`);
            expect(await response.json()).toEqual({ ok: true });
        } finally {
            await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        }
    });
});
