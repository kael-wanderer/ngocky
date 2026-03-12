export function parseCompactAmountInput(value: string): number {
    const normalized = value.trim().replace(/,/g, '').toUpperCase();
    if (!normalized) return NaN;

    const match = normalized.match(/^(\d+(?:\.\d+)?)([KMB])?$/);
    if (!match) return NaN;

    const base = Number(match[1]);
    const multiplierMap: Record<string, number> = {
        K: 1_000,
        M: 1_000_000,
        B: 1_000_000_000,
    };
    const multiplier = match[2] ? multiplierMap[match[2]] : 1;
    return Math.round(base * multiplier);
}
