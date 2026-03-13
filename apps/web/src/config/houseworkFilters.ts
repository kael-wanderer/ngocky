import { endOfDay, startOfDay } from 'date-fns';

export const HOUSEWORK_FREQUENCY_OPTIONS = ['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'] as const;

export type SharedHouseworkDueDateFilter = 'ALL' | 'TODAY' | 'THIS_WEEK' | 'NEXT_WEEK' | 'THIS_MONTH' | 'NEXT_MONTH';
export type SharedHouseworkStatusFilter = 'ALL' | 'PLANNED' | 'IN_PROGRESS' | 'DONE';
export type SharedHouseworkFrequencyFilter = 'ALL' | (typeof HOUSEWORK_FREQUENCY_OPTIONS)[number];

export type SharedHouseworkFilters = {
    dueDate: SharedHouseworkDueDateFilter;
    frequency: SharedHouseworkFrequencyFilter;
    status: SharedHouseworkStatusFilter;
};

export const DEFAULT_HOUSEWORK_FILTERS: SharedHouseworkFilters = {
    dueDate: 'ALL',
    frequency: 'ALL',
    status: 'ALL',
};

export const HOUSEWORK_DUE_DATE_FILTER_OPTIONS: Array<{ value: SharedHouseworkDueDateFilter; label: string }> = [
    { value: 'ALL', label: 'All Due Dates' },
    { value: 'TODAY', label: 'Today' },
    { value: 'THIS_WEEK', label: 'This Week' },
    { value: 'NEXT_WEEK', label: 'Next Week' },
    { value: 'THIS_MONTH', label: 'This Month' },
    { value: 'NEXT_MONTH', label: 'Next Month' },
];

export const HOUSEWORK_STATUS_FILTER_OPTIONS: Array<{ value: SharedHouseworkStatusFilter; label: string }> = [
    { value: 'ALL', label: 'All Statuses' },
    { value: 'PLANNED', label: 'Plan' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'DONE', label: 'Done' },
];

export function getHouseworkDueDateRange(filter: SharedHouseworkDueDateFilter) {
    const now = new Date();
    const today = startOfDay(now);

    switch (filter) {
        case 'TODAY':
            return { start: today, end: endOfDay(today) };
        case 'THIS_WEEK': {
            const start = new Date(today);
            start.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            return { start, end: endOfDay(end) };
        }
        case 'NEXT_WEEK': {
            const start = new Date(today);
            start.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1) + 7);
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
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
