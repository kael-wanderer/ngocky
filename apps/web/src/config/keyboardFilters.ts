export const KEYBOARD_FILTER_CATEGORIES = ['Keycap', 'Kit', 'Shipping', 'Accessories', 'Other'] as const;
export const KEYBOARD_FILTER_TAGS = ['Board 1', 'Board 2', 'Board 3', 'Board 4', 'Board 5', 'Board 6', 'Board 7', 'Board 8', 'Board 9', 'Board 10', 'Board 11', 'Board 12', 'Board 13', 'Board 14', 'Board 15', 'Board 16', 'Board 17', 'Stock'] as const;
export const KEYBOARD_FILTER_COLORS = ['Blue', 'PC', 'Purple', 'Red', 'Gray', 'Green', 'Black', 'Silver', 'Copper', 'Brown', 'Rose Gold', 'Orange', 'Beige', 'Colorful'] as const;
export const KEYBOARD_FILTER_PRICE_RANGES = [
    { value: 'UNDER_5M', label: '< 5M' },
    { value: 'BETWEEN_5M_10M', label: '5M to 10M' },
    { value: 'BETWEEN_10M_20M', label: '10M to 20M' },
    { value: 'BETWEEN_20M_30M', label: '20M to 30M' },
    { value: 'OVER_30M', label: 'Over 30M' },
] as const;

export type KeyboardPriceRange = (typeof KEYBOARD_FILTER_PRICE_RANGES)[number]['value'];

export type SharedKeyboardFilters = {
    search: string;
    categories: string[];
    tags: string[];
    colors: string[];
    priceRanges: KeyboardPriceRange[];
};

export const DEFAULT_KEYBOARD_FILTERS: SharedKeyboardFilters = {
    search: '',
    categories: [],
    tags: [],
    colors: [],
    priceRanges: [],
};

export function matchesKeyboardPriceRange(price: number | null, range: string) {
    if (!range) return true;
    if (price == null) return false;

    if (range === 'UNDER_5M') return price < 5_000_000;
    if (range === 'BETWEEN_5M_10M') return price >= 5_000_000 && price <= 10_000_000;
    if (range === 'BETWEEN_10M_20M') return price > 10_000_000 && price <= 20_000_000;
    if (range === 'BETWEEN_20M_30M') return price > 20_000_000 && price <= 30_000_000;
    if (range === 'OVER_30M') return price > 30_000_000;
    return true;
}

export function matchesKeyboardFilters(
    item: { name?: string | null; category?: string | null; tag?: string | null; color?: string | null; price?: number | null },
    filters: SharedKeyboardFilters,
) {
    if (filters.search && !(item.name || '').toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.categories.length > 0 && (!item.category || !filters.categories.includes(item.category))) return false;
    if (filters.tags.length > 0 && (!item.tag || !filters.tags.includes(item.tag))) return false;
    if (filters.colors.length > 0 && (!item.color || !filters.colors.includes(item.color))) return false;
    if (filters.priceRanges.length > 0 && !filters.priceRanges.some((range) => matchesKeyboardPriceRange(item.price ?? null, range))) return false;
    return true;
}
