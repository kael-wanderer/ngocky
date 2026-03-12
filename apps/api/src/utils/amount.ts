export function parseCompactAmountInput(value: unknown): number | null {
    if (value == null || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;

    const normalized = String(value).trim().replace(/,/g, '').toUpperCase();
    if (!normalized) return null;

    const match = normalized.match(/^(\d+(?:\.\d+)?)([KMB])?$/);
    if (!match) {
        const direct = Number(normalized);
        return Number.isFinite(direct) ? direct : null;
    }

    const base = Number(match[1]);
    const multiplierMap: Record<string, number> = {
        K: 1_000,
        M: 1_000_000,
        B: 1_000_000_000,
    };
    const multiplier = match[2] ? multiplierMap[match[2]] : 1;
    const result = Math.round(base * multiplier);
    return Number.isFinite(result) ? result : null;
}
