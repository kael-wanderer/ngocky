/**
 * Normalize inbound message text before intent parsing.
 */

export interface NormalizedMessage {
    /** Original text as received (trimmed) */
    raw: string;
    /** Whitespace-collapsed version for matching */
    normalized: string;
}

export function normalizeMessage(text: string): NormalizedMessage {
    const raw = text.trim();
    const normalized = raw.replace(/\s+/g, ' ');
    return { raw, normalized };
}
