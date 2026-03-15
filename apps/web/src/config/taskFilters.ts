import { endOfDay, startOfDay } from 'date-fns';

export type SharedTaskDueDateFilter = 'ALL' | 'TODAY' | 'THIS_WEEK' | 'NEXT_WEEK' | 'THIS_MONTH' | 'NEXT_MONTH';
export type SharedTaskTypeFilter = 'ALL' | 'TASK' | 'PAYMENT';
export type SharedTaskPriorityFilter = 'ALL' | 'LOW' | 'MEDIUM' | 'HIGH';
export type SharedTaskStatusFilter = 'ALL' | 'PLANNED' | 'IN_PROGRESS' | 'DONE';

export type SharedTaskFilters = {
    dueDate: SharedTaskDueDateFilter;
    type: SharedTaskTypeFilter;
    priority: SharedTaskPriorityFilter;
    status: SharedTaskStatusFilter;
};

export const DEFAULT_TASK_FILTERS: SharedTaskFilters = {
    dueDate: 'THIS_MONTH',
    type: 'ALL',
    priority: 'ALL',
    status: 'ALL',
};

export const TASK_DUE_DATE_FILTER_OPTIONS: Array<{ value: SharedTaskDueDateFilter; label: string }> = [
    { value: 'ALL', label: 'All Due Dates' },
    { value: 'TODAY', label: 'Today' },
    { value: 'THIS_WEEK', label: 'This Week' },
    { value: 'NEXT_WEEK', label: 'Next Week' },
    { value: 'THIS_MONTH', label: 'This Month' },
    { value: 'NEXT_MONTH', label: 'Next Month' },
];

export const TASK_TYPE_FILTER_OPTIONS: Array<{ value: SharedTaskTypeFilter; label: string }> = [
    { value: 'ALL', label: 'All Types' },
    { value: 'PAYMENT', label: 'Payment' },
    { value: 'TASK', label: 'Task' },
];

export const TASK_PRIORITY_FILTER_OPTIONS: Array<{ value: SharedTaskPriorityFilter; label: string }> = [
    { value: 'ALL', label: 'All Priorities' },
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
];

export const TASK_STATUS_FILTER_OPTIONS: Array<{ value: SharedTaskStatusFilter; label: string }> = [
    { value: 'ALL', label: 'All Statuses' },
    { value: 'PLANNED', label: 'Plan' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'DONE', label: 'Done' },
];

export function getTaskDueDateRange(filter: SharedTaskDueDateFilter) {
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
