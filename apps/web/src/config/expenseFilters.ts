import { format } from 'date-fns';

export const DEFAULT_PAY_CATEGORY = 'Food';
export const EXPENSE_PAY_CATEGORIES = ['AI', 'Ca Keo', 'Food', 'Gift', 'Healthcare', 'House', 'Insurance', 'Maintenance', 'Education', 'Entertainment', 'Family Support', 'Shopping', 'Transportation', 'Utilities', 'Other'];
export const EXPENSE_RECEIVE_CATEGORIES = ['Salary', 'Sell', 'Top-up'];
export const EXPENSE_ALL_CATEGORIES = [...new Set([...EXPENSE_PAY_CATEGORIES, ...EXPENSE_RECEIVE_CATEGORIES])];

export const EXPENSE_TYPE_OPTIONS = [
    { value: 'PAY', label: 'Pay' },
    { value: 'RECEIVE', label: 'Receive' },
] as const;

export const EXPENSE_SCOPE_OPTIONS = [
    { value: 'PERSONAL', label: 'Personal' },
    { value: 'FAMILY', label: 'Family' },
    { value: 'KEO', label: 'Ca Keo' },
    { value: 'PROJECT', label: 'Project' },
] as const;

export const EXPENSE_TIME_PRESET_OPTIONS = [
    { value: 'THIS_MONTH', label: 'This Month' },
    { value: 'LAST_MONTH', label: 'Last Month' },
    { value: 'THIS_QUARTER', label: 'This Quarter' },
    { value: 'LAST_QUARTER', label: 'Last Quarter' },
    { value: 'THIS_YEAR', label: 'This Year' },
    { value: 'LAST_YEAR', label: 'Last Year' },
    { value: 'ALL', label: 'All Time' },
    { value: 'CUSTOM', label: 'Custom' },
] as const;

export type ExpenseTimePreset = typeof EXPENSE_TIME_PRESET_OPTIONS[number]['value'];

export type SharedExpenseFilters = {
    type: string;
    scope: string;
    category: string;
    timePreset: ExpenseTimePreset;
    dateFrom: string;
    dateTo: string;
};

export const DEFAULT_EXPENSE_FILTERS: SharedExpenseFilters = {
    type: '',
    scope: '',
    category: '',
    timePreset: 'THIS_MONTH',
    dateFrom: '',
    dateTo: '',
};

export function getExpenseDateRangeFromPreset(preset: ExpenseTimePreset) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    if (preset === 'ALL' || preset === 'CUSTOM') {
        return {
            dateFrom: '',
            dateTo: '',
        };
    }
    if (preset === 'THIS_MONTH') {
        return {
            dateFrom: format(new Date(currentYear, currentMonth, 1), 'yyyy-MM-dd'),
            dateTo: format(new Date(currentYear, currentMonth + 1, 0), 'yyyy-MM-dd'),
        };
    }
    if (preset === 'LAST_MONTH') {
        return {
            dateFrom: format(new Date(currentYear, currentMonth - 1, 1), 'yyyy-MM-dd'),
            dateTo: format(new Date(currentYear, currentMonth, 0), 'yyyy-MM-dd'),
        };
    }
    const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
    if (preset === 'THIS_QUARTER') {
        return {
            dateFrom: format(new Date(currentYear, quarterStartMonth, 1), 'yyyy-MM-dd'),
            dateTo: format(new Date(currentYear, quarterStartMonth + 3, 0), 'yyyy-MM-dd'),
        };
    }
    if (preset === 'THIS_YEAR') {
        return {
            dateFrom: format(new Date(currentYear, 0, 1), 'yyyy-MM-dd'),
            dateTo: format(new Date(currentYear, 11, 31), 'yyyy-MM-dd'),
        };
    }
    if (preset === 'LAST_YEAR') {
        return {
            dateFrom: format(new Date(currentYear - 1, 0, 1), 'yyyy-MM-dd'),
            dateTo: format(new Date(currentYear - 1, 11, 31), 'yyyy-MM-dd'),
        };
    }
    const lastQuarterEndMonth = quarterStartMonth - 1;
    const lastQuarterYear = lastQuarterEndMonth < 0 ? currentYear - 1 : currentYear;
    const normalizedEndMonth = (lastQuarterEndMonth + 12) % 12;
    const lastQuarterStartMonth = normalizedEndMonth - 2;
    return {
        dateFrom: format(new Date(lastQuarterYear, lastQuarterStartMonth, 1), 'yyyy-MM-dd'),
        dateTo: format(new Date(lastQuarterYear, normalizedEndMonth + 1, 0), 'yyyy-MM-dd'),
    };
}
