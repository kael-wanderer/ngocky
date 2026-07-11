import dns from 'dns/promises';
import net from 'net';
import { Agent, fetch as undiciFetch } from 'undici';
import { config } from '../config/env';
import { ValidationError } from './errors';

type LookupAddress = { address: string; family: number };
export type AgentEndpointLookup = (hostname: string) => Promise<LookupAddress[]>;

const MAX_REDIRECTS = 3;
const MAX_CONTENT_LENGTH = 2 * 1024 * 1024;

function ipv4Number(address: string) {
    return address.split('.').reduce((value, part) => (value << 8) + Number(part), 0) >>> 0;
}

function ipv4InCidr(address: string, base: string, bits: number) {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (ipv4Number(address) & mask) === (ipv4Number(base) & mask);
}

export function isPrivateAgentAddress(address: string) {
    if (net.isIPv4(address)) {
        const ranges: Array<[string, number]> = [
            ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
            ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16],
            ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
        ];
        return ranges.some(([base, bits]) => ipv4InCidr(address, base, bits));
    }
    if (net.isIPv6(address)) {
        const normalized = address.toLowerCase();
        if (normalized === '::' || normalized === '::1') return true;
        if (/^(fc|fd|fe8|fe9|fea|feb|ff)/.test(normalized)) return true;
        if (normalized.startsWith('::ffff:')) return isPrivateAgentAddress(normalized.slice(7));
        return false;
    }
    return true;
}

const systemLookup: AgentEndpointLookup = async (hostname) => dns.lookup(hostname, { all: true });

export async function validateAgentEndpoint(rawUrl: string, options: { lookup?: AgentEndpointLookup; allowPrivate?: boolean } = {}) {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        throw new ValidationError('Invalid agent endpoint URL');
    }
    const allowPrivate = options.allowPrivate ?? config.ALLOW_PRIVATE_AGENT_ENDPOINTS;
    if (!['http:', 'https:'].includes(url.protocol)) throw new ValidationError('Unsupported agent endpoint protocol');
    if (url.protocol !== 'https:' && !allowPrivate) throw new ValidationError('Custom agent endpoint must use HTTPS');
    if (url.username || url.password) throw new ValidationError('Agent endpoint URL cannot contain credentials');
    if (url.hostname.toLowerCase() === 'localhost' && !allowPrivate) throw new ValidationError('Private agent endpoint is not allowed');

    const addresses = net.isIP(url.hostname)
        ? [{ address: url.hostname, family: net.isIP(url.hostname) }]
        : await (options.lookup ?? systemLookup)(url.hostname);
    if (addresses.length === 0) throw new ValidationError('Agent endpoint hostname did not resolve');
    if (!allowPrivate && addresses.some(({ address }) => isPrivateAgentAddress(address))) {
        throw new ValidationError('Private agent endpoint is not allowed');
    }
    return { url, addresses };
}

export function createSafeAgentFetch(options: { lookup?: AgentEndpointLookup; allowPrivate?: boolean; fetchImpl?: typeof fetch; timeoutMs?: number } = {}): typeof fetch {
    const fetchImpl = options.fetchImpl ?? fetch;
    return (async (input: URL | string | Request, init?: RequestInit) => {
        let current = typeof input === 'string' || input instanceof URL ? new URL(input.toString()) : new URL(input.url);
        for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
            const { addresses } = await validateAgentEndpoint(current.toString(), options);
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
            let response: Response;
            let dispatcher: Agent | null = null;
            try {
                if (options.fetchImpl) {
                    response = await fetchImpl(current, { ...init, redirect: 'manual', signal: controller.signal });
                } else {
                    const selected = addresses[0];
                    dispatcher = new Agent({
                        connect: {
                            lookup: (_hostname: string, lookupOptions: { all?: boolean }, callback: (...args: any[]) => void) => {
                                if (lookupOptions.all) callback(null, [selected]);
                                else callback(null, selected.address, selected.family);
                            },
                        },
                    });
                    response = await undiciFetch(current, { ...init as any, redirect: 'manual', signal: controller.signal, dispatcher }) as unknown as Response;
                }
            } catch (error) {
                await dispatcher?.close();
                throw error;
            } finally {
                clearTimeout(timeout);
            }
            if (Number(response.headers.get('content-length') || 0) > MAX_CONTENT_LENGTH) {
                await dispatcher?.close();
                throw new ValidationError('Agent endpoint response is too large');
            }
            const body = await response.arrayBuffer();
            await dispatcher?.close();
            if (body.byteLength > MAX_CONTENT_LENGTH) throw new ValidationError('Agent endpoint response is too large');
            const buffered = new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
            if (buffered.status < 300 || buffered.status >= 400) return buffered;
            const location = buffered.headers.get('location');
            if (!location) return buffered;
            if (redirect === MAX_REDIRECTS) throw new ValidationError('Too many agent endpoint redirects');
            current = new URL(location, current);
        }
        throw new ValidationError('Too many agent endpoint redirects');
    }) as typeof fetch;
}
