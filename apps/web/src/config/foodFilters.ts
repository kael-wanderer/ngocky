export type FoodFilters = {
    search: string;
    tag: string;
    type: string;
    distance: string;
};

export const DEFAULT_FOOD_FILTERS: FoodFilters = {
    search: '',
    tag: '',
    type: '',
    distance: '',
};

export function matchesFoodFilters(item: { name?: string; tag?: string | null; type?: string | null; distance?: string | null }, filters: FoodFilters) {
    const search = filters.search.trim().toLowerCase();
    if (search && !String(item.name || '').toLowerCase().includes(search)) return false;
    if (filters.tag && item.tag !== filters.tag) return false;
    if (filters.type && item.type !== filters.type) return false;
    if (filters.distance && item.distance !== filters.distance) return false;
    return true;
}
