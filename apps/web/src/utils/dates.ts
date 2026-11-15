/**
 * `YYYY-MM-DD` for a date in the viewer's local timezone.
 * `toISOString()` is UTC, which is yesterday until 07:00 in Vietnam.
 */
export function toLocalDateInput(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
