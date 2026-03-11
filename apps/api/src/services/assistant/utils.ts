/**
 * Shared utilities for the assistant service layer.
 */

// ─── Telegram MarkdownV2 Escaping ─────────────────────────────────────────────

/**
 * Escape a plain-text string for use inside Telegram MarkdownV2 messages.
 * All special characters must be escaped with a preceding backslash.
 */
export function escapeMd(text: string): string {
    return String(text).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

/**
 * Format a number in VND with thousand separators.
 */
export function formatVND(amount: number): string {
    return amount.toLocaleString('vi-VN') + ' VND';
}

// ─── Timezone / Date Utilities ────────────────────────────────────────────────

/**
 * Get the UTC offset in milliseconds for a given timezone at a given UTC date.
 * Positive values mean the timezone is ahead of UTC (e.g. UTC+7 → +25200000).
 */
function getUTCOffsetMs(date: Date, tz: string): number {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });

    const parts = fmt.formatToParts(date);
    const get = (type: string) => {
        const v = parts.find(p => p.type === type)?.value;
        return v ? parseInt(v) : 0;
    };

    let h = get('hour');
    if (h === 24) h = 0; // midnight edge case

    const localAsUTC = Date.UTC(
        get('year'),
        get('month') - 1,
        get('day'),
        h,
        get('minute'),
        get('second'),
    );

    return localAsUTC - date.getTime();
}

/**
 * Convert a local date (YYYY-MM-DD) to UTC Date objects for the start and end
 * of that calendar day in the given IANA timezone.
 */
export function localDayToUTCRange(dateISO: string, tz: string): { start: Date; end: Date } {
    // Use noon UTC as a probe to avoid DST transitions at midnight
    const probe = new Date(`${dateISO}T12:00:00.000Z`);
    const offsetMs = getUTCOffsetMs(probe, tz);

    const midnight = new Date(`${dateISO}T00:00:00.000Z`);
    const start = new Date(midnight.getTime() - offsetMs);
    return { start, end: new Date(start.getTime() + 86_400_000 - 1) };
}

/**
 * Return today's date as YYYY-MM-DD in the given timezone.
 */
export function todayISO(tz: string): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: tz });
}

/**
 * Format a UTC Date as a human-readable date/time string in the given timezone.
 * Returns e.g. "Mar 11, 2026" or "Mar 11, 2026 09:00"
 */
export function formatLocalDateTime(date: Date, tz: string, includeTime = true): string {
    if (includeTime) {
        return date.toLocaleString('en-US', {
            timeZone: tz,
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    }
    return date.toLocaleDateString('en-US', {
        timeZone: tz,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

/**
 * Parse a YYYY-MM-DD or ISO datetime string into a Date, interpreted at
 * end-of-day (23:59:59) in the given timezone.  Returns null if the string
 * is empty / undefined.
 */
export function parseEndOfDay(dateStr: string | undefined | null, tz: string): Date | null {
    if (!dateStr) return null;
    const dateOnly = dateStr.slice(0, 10); // YYYY-MM-DD
    const { end } = localDayToUTCRange(dateOnly, tz);
    return end;
}

/**
 * Build a date range object for Prisma queries from two ISO date strings.
 */
export function buildDateRangeFilter(from: string, to: string, tz: string) {
    const { start } = localDayToUTCRange(from, tz);
    const { end } = localDayToUTCRange(to, tz);
    return { gte: start, lte: end };
}
