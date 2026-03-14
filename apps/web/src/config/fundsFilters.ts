import { endOfDay } from 'date-fns';

export const FUNDS_TYPE_OPTIONS = [
    { value: 'BUY', label: 'Buy' },
    { value: 'SELL', label: 'Sell' },
    { value: 'TOP_UP', label: 'Top-up' },
] as const;

export const FUNDS_SCOPE_OPTIONS = [
    { value: 'MECHANICAL_KEYBOARD', label: 'Mechanical keyboard' },
    { value: 'PLAY_STATION', label: 'Play Station' },
] as const;

export const FUNDS_CATEGORY_OPTIONS = [
    { value: 'KEYCAP', label: 'Keycap' },
    { value: 'KIT', label: 'Kit' },
    { value: 'SHIPPING', label: 'Shipping' },
    { value: 'ACCESSORIES', label: 'Accessories' },
    { value: 'OTHER', label: 'Other' },
] as const;

export const FUNDS_CONDITION_OPTIONS = [
    { value: 'BNIB', label: 'BNIB' },
    { value: 'USED', label: 'Used' },
] as const;

export type SharedFundsTimeFilter = 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_QUARTER' | 'LAST_QUARTER' | 'THIS_YEAR' | 'LAST_YEAR' | 'ALL' | 'CUSTOM';

export const FUNDS_TIME_FILTER_OPTIONS: Array<{ value: SharedFundsTimeFilter; label: string }> = [
    { value: 'ALL', label: 'All Time' },
    { value: 'THIS_MONTH', label: 'This Month' },
    { value: 'LAST_MONTH', label: 'Last Month' },
    { value: 'THIS_QUARTER', label: 'This Quarter' },
    { value: 'LAST_QUARTER', label: 'Last Quarter' },
    { value: 'THIS_YEAR', label: 'This Year' },
    { value: 'LAST_YEAR', label: 'Last Year' },
    { value: 'CUSTOM', label: 'Custom' },
];

export type SharedFundsFilters = {
    type: string;
    scope: string;
    category: string;
    condition: string;
    time: SharedFundsTimeFilter;
    dateFrom: string;
    dateTo: string;
};

export const DEFAULT_FUNDS_FILTERS: SharedFundsFilters = {
    type: '',
    scope: '',
    category: '',
    condition: '',
    time: 'ALL',
    dateFrom: '',
    dateTo: '',
};

export function getFundsDateRange(filter: SharedFundsTimeFilter) {
    const now = new Date();

    switch (filter) {
        case 'THIS_MONTH':
            return {
                start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
                end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
            };
        case 'LAST_MONTH':
            return {
                start: new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0),
                end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
            };
        case 'THIS_QUARTER': {
            const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
            return {
                start: new Date(now.getFullYear(), quarterStartMonth, 1, 0, 0, 0, 0),
                end: endOfDay(new Date(now.getFullYear(), quarterStartMonth + 3, 0)),
            };
        }
        case 'LAST_QUARTER': {
            const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
            return {
                start: new Date(now.getFullYear(), quarterStartMonth - 3, 1, 0, 0, 0, 0),
                end: endOfDay(new Date(now.getFullYear(), quarterStartMonth, 0)),
            };
        }
        case 'THIS_YEAR':
            return {
                start: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0),
                end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
            };
        case 'LAST_YEAR':
            return {
                start: new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0),
                end: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999),
            };
        case 'ALL':
        case 'CUSTOM':
        default:
            return null;
    }
}
