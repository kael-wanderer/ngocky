import crypto from 'crypto';
import { config } from '../config/env';

/** Constant-time check of an `X-Assistant-Api-Key` header value. */
export function isAssistantApiKey(candidate: unknown): boolean {
    if (typeof candidate !== 'string' || candidate.length === 0) return false;
    // Hash both sides so the comparison length never depends on the input.
    const a = crypto.createHash('sha256').update(candidate).digest();
    const b = crypto.createHash('sha256').update(config.ASSISTANT_API_KEY).digest();
    return crypto.timingSafeEqual(a, b);
}
