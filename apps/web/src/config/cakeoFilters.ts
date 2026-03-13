import { endOfDay, endOfWeek, startOfDay, startOfWeek } from 'date-fns';

export const CAKEO_DATE_FILTER_OPTIONS = [
    { value: 'ALL', label: 'All Dates' },
    { value: 'TODAY', label: 'Today' },
    { value: 'THIS_WEEK', label: 'This Week' },
    { value: 'NEXT_WEEK', label: 'Next Week' },
    { value: 'THIS_MONTH', label: 'This Month' },
    { value: 'NEXT_MONTH', label: 'Next Month' },
] as const;

export const CAKEO_TYPE_FILTER_OPTIONS = [
    { value: 'ALL', label: 'All Types' },
    { value: 'Task', label: 'Task' },
    { value: 'Event', label: 'Event' },
    { value: 'Schedule', label: 'Schedule' },
] as const;

export const CAKEO_CATEGORY_OPTIONS = ['School', 'Activity', 'Medical', 'Entertainment', 'Home', 'Other'] as const;

export const CAKEO_STATUS_FILTER_OPTIONS = [
    { value: 'ALL', label: 'All Statuses' },
    { value: 'TODO', label: 'Todo' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'DONE', label: 'Done' },
    { value: 'CANCELLED', label: 'Cancelled' },
] as const;

export type SharedCaKeoDateFilter = typeof CAKEO_DATE_FILTER_OPTIONS[number]['value'];
export type SharedCaKeoTypeFilter = typeof CAKEO_TYPE_FILTER_OPTIONS[number]['value'];
export type SharedCaKeoStatusFilter = typeof CAKEO_STATUS_FILTER_OPTIONS[number]['value'];

export const DEFAULT_CAKEO_FILTERS = {
    date: 'ALL' as SharedCaKeoDateFilter,
    type: 'ALL' as SharedCaKeoTypeFilter,
    status: 'ALL' as SharedCaKeoStatusFilter,
    assignerId: '',
    category: '',
};

export function getCaKeoDateRange(filter: SharedCaKeoDateFilter) {
    const now = new Date();
    const today = startOfDay(now);

    switch (filter) {
        case 'TODAY':
            return { start: today, end: endOfDay(today) };
        case 'THIS_WEEK': {
            const start = startOfWeek(today, { weekStartsOn: 1 });
            const end = endOfWeek(today, { weekStartsOn: 1 });
            return { start, end: endOfDay(end) };
        }
        case 'NEXT_WEEK': {
            const start = startOfWeek(today, { weekStartsOn: 1 });
            start.setDate(start.getDate() + 7);
            const end = endOfWeek(start, { weekStartsOn: 1 });
            return { start, end: endOfDay(end) };
        }
        case 'THIS_MONTH':
            return {
                start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
                end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
            };
        case 'NEXT_MONTH':
            return {
                start: new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0),
                end: new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999),
            };
        case 'ALL':
        default:
            return null;
    }
}
