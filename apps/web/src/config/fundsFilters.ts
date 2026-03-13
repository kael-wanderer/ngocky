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

export type SharedFundsFilters = {
    type: string;
    scope: string;
    category: string;
    condition: string;
    dateFrom: string;
    dateTo: string;
};

export const DEFAULT_FUNDS_FILTERS: SharedFundsFilters = {
    type: '',
    scope: '',
    category: '',
    condition: '',
    dateFrom: '',
    dateTo: '',
};
