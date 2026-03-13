import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { useAuthStore } from '../stores/auth';
import { FEATURE_GROUPS, getFeatureFlags } from '../config/features';
import {
    DEFAULT_TASK_FILTERS,
    getTaskDueDateRange,
    TASK_DUE_DATE_FILTER_OPTIONS,
    TASK_PRIORITY_FILTER_OPTIONS,
    TASK_STATUS_FILTER_OPTIONS,
    TASK_TYPE_FILTER_OPTIONS,
    type SharedTaskDueDateFilter,
    type SharedTaskPriorityFilter,
    type SharedTaskStatusFilter,
    type SharedTaskTypeFilter,
} from '../config/taskFilters';
import { DEFAULT_GOAL_PERIOD_FILTER, GOAL_PERIOD_FILTER_OPTIONS, type SharedGoalPeriodFilter } from '../config/goalFilters';
import {
    DEFAULT_EXPENSE_FILTERS,
    EXPENSE_ALL_CATEGORIES,
    EXPENSE_PAY_CATEGORIES,
    EXPENSE_RECEIVE_CATEGORIES,
    EXPENSE_SCOPE_OPTIONS,
    EXPENSE_TIME_PRESET_OPTIONS,
    EXPENSE_TYPE_OPTIONS,
    getExpenseDateRangeFromPreset,
    type ExpenseTimePreset,
} from '../config/expenseFilters';
import {
    DEFAULT_HOUSEWORK_FILTERS,
    getHouseworkDueDateRange,
    HOUSEWORK_DUE_DATE_FILTER_OPTIONS,
    HOUSEWORK_FREQUENCY_OPTIONS,
    HOUSEWORK_STATUS_FILTER_OPTIONS,
    type SharedHouseworkDueDateFilter,
    type SharedHouseworkFrequencyFilter,
    type SharedHouseworkStatusFilter,
} from '../config/houseworkFilters';
import MultiSelectFilter from '../components/MultiSelectFilter';
import {
    DEFAULT_KEYBOARD_FILTERS,
    KEYBOARD_FILTER_CATEGORIES,
    KEYBOARD_FILTER_COLORS,
    KEYBOARD_FILTER_PRICE_RANGES,
    KEYBOARD_FILTER_TAGS,
    matchesKeyboardFilters,
} from '../config/keyboardFilters';
import {
    DEFAULT_FUNDS_FILTERS,
    FUNDS_CATEGORY_OPTIONS,
    FUNDS_CONDITION_OPTIONS,
    FUNDS_SCOPE_OPTIONS,
    FUNDS_TYPE_OPTIONS,
} from '../config/fundsFilters';
import { BarChart3, FileSpreadsheet, FileText, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#4f46e5', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#db2777', '#84cc16'];
const formatVND = (amount: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(amount) + ' VND';
const expenseCategories = ['AI', 'Ca Keo', 'Food', 'Gift', 'Healthcare', 'House', 'Insurance', 'Maintenance', 'Education', 'Entertainment', 'Family Support', 'Salary', 'Sell', 'Shopping', 'Top-up', 'Transportation', 'Utilities', 'Other'];
const scopeOptions = [
    { value: 'PERSONAL', label: 'Personal' },
    { value: 'FAMILY', label: 'Family' },
    { value: 'KEO', label: 'Ca Keo' },
    { value: 'PROJECT', label: 'Project' },
];
const typeOptions = [
    { value: 'PAY', label: 'Pay' },
    { value: 'RECEIVE', label: 'Receive' },
];
const projectItemTypeOptions = [
    { value: 'TASK', label: 'Task' },
    { value: 'BUG', label: 'Bug' },
    { value: 'FEATURE', label: 'Feature' },
    { value: 'STORY', label: 'Story' },
    { value: 'EPIC', label: 'Epic' },
];
const taskTypeOptions = [
    { value: 'TASK', label: 'Task' },
    { value: 'PAYMENT', label: 'Payment' },
];

type ReportTimeRange =
    | 'TODAY'
    | 'THIS_WEEK'
    | 'LAST_WEEK'
    | 'THIS_MONTH'
    | 'LAST_MONTH'
    | 'THIS_QUARTER'
    | 'LAST_QUARTER'
    | 'THIS_YEAR'
    | 'LAST_YEAR'
    | 'CUSTOM';

type AnalyticsViewType = 'CHARTS' | 'TABLES' | 'BOTH';
type AnalyticsSelectionMode = 'single' | 'multi';
type AnalyticsTaskDueDateFilter = SharedTaskDueDateFilter;
type AnalyticsTaskTypeFilter = SharedTaskTypeFilter;
type AnalyticsTaskPriorityFilter = SharedTaskPriorityFilter;
type AnalyticsTaskStatusFilter = SharedTaskStatusFilter;
type AnalyticsHouseworkDueDateFilter = SharedHouseworkDueDateFilter;
type AnalyticsHouseworkFrequencyFilter = SharedHouseworkFrequencyFilter;
type AnalyticsHouseworkStatusFilter = SharedHouseworkStatusFilter;

const ANALYTICS_ROUTE_TAB_MAP = {
    '/projects': { id: 'project', label: 'Projects' },
    '/tasks': { id: 'tasks', label: 'Tasks' },
    '/expenses': { id: 'expenses', label: 'Expenses' },
    '/goals': { id: 'goals', label: 'Goals' },
    '/ideas': { id: 'ideas', label: 'Ideas' },
    '/calendar': { id: 'calendar', label: 'Calendar' },
    '/cakeo': { id: 'cakeo', label: 'Ca Keo' },
    '/housework': { id: 'housework', label: 'Housework' },
    '/assets': { id: 'assets', label: 'Assets' },
    '/keyboard': { id: 'keyboard', label: 'Keyboard' },
    '/funds': { id: 'funds', label: 'Funds' },
    '/learning': { id: 'learning', label: 'Learning' },
} as const;

type AnalyticsTab = (typeof ANALYTICS_ROUTE_TAB_MAP)[keyof typeof ANALYTICS_ROUTE_TAB_MAP];
type AnalyticsTabId = AnalyticsTab['id'];

const reportTimeRangeOptions: Array<{ value: ReportTimeRange; label: string }> = [
    { value: 'TODAY', label: 'Today' },
    { value: 'THIS_WEEK', label: 'This Week' },
    { value: 'LAST_WEEK', label: 'Last Week' },
    { value: 'THIS_MONTH', label: 'This Month' },
    { value: 'LAST_MONTH', label: 'Last Month' },
    { value: 'THIS_QUARTER', label: 'This Quarter' },
    { value: 'LAST_QUARTER', label: 'Last Quarter' },
    { value: 'THIS_YEAR', label: 'This Year' },
    { value: 'LAST_YEAR', label: 'Last Year' },
    { value: 'CUSTOM', label: 'Custom' },
];

function startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function getQuarterStartMonth(month: number) {
    return Math.floor(month / 3) * 3;
}

function getRangeForPreset(preset: Exclude<ReportTimeRange, 'CUSTOM'>) {
    const now = new Date();
    const today = startOfDay(now);

    switch (preset) {
        case 'TODAY':
            return { start: today, end: endOfDay(today) };
        case 'THIS_WEEK': {
            const start = new Date(today);
            start.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            return { start, end: endOfDay(end) };
        }
        case 'LAST_WEEK': {
            const thisWeekStart = new Date(today);
            thisWeekStart.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
            const start = new Date(thisWeekStart);
            start.setDate(thisWeekStart.getDate() - 7);
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            return { start, end: endOfDay(end) };
        }
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
            const quarterStartMonth = getQuarterStartMonth(now.getMonth());
            return {
                start: new Date(now.getFullYear(), quarterStartMonth, 1, 0, 0, 0, 0),
                end: new Date(now.getFullYear(), quarterStartMonth + 3, 0, 23, 59, 59, 999),
            };
        }
        case 'LAST_QUARTER': {
            const currentQuarterStartMonth = getQuarterStartMonth(now.getMonth());
            const start = new Date(now.getFullYear(), currentQuarterStartMonth - 3, 1, 0, 0, 0, 0);
            return {
                start,
                end: new Date(start.getFullYear(), start.getMonth() + 3, 0, 23, 59, 59, 999),
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
    }
}

function formatTableValue(value: unknown) {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'number') return value.toLocaleString('en-US');
    return String(value);
}

function DataTableCard({
    title,
    columns,
    rows,
}: {
    title: string;
    columns: ReadonlyArray<{ key: string; label: string; render?: (value: any, row: Record<string, any>) => React.ReactNode }>;
    rows: ReadonlyArray<Record<string, any>>;
}) {
    return (
        <div className="card p-5 overflow-hidden">
            <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>{title}</h3>
            {rows.length ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                                {columns.map((column) => (
                                    <th key={column.key} className="text-left py-2 pr-4 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                                        {column.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, rowIndex) => (
                                <tr key={`${title}-${rowIndex}`} className="border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                                    {columns.map((column) => (
                                        <td key={column.key} className="py-2 pr-4 align-top" style={{ color: 'var(--color-text)' }}>
                                            {column.render ? column.render(row[column.key], row) : formatTableValue(row[column.key])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No data for this filter.</p>
            )}
        </div>
    );
}

function formatDisplayDate(value?: string | Date | null) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderExportCell(
    column: { key: string; label: string; render?: (value: any, row: Record<string, any>) => React.ReactNode },
    row: Record<string, any>,
) {
    const rendered = column.render ? column.render(row[column.key], row) : row[column.key];
    if (React.isValidElement(rendered)) return formatTableValue(row[column.key]);
    if (rendered === null || rendered === undefined || rendered === '') return '—';
    return String(rendered);
}

function sameTabIds(left: AnalyticsTabId[], right: AnalyticsTabId[]) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}

export default function ReportsPage() {
    const reportContentRef = useRef<HTMLDivElement>(null);
    const { user } = useAuthStore();
    const [selectionMode, setSelectionMode] = useState<AnalyticsSelectionMode>('single');
    const [singleSelectedTab, setSingleSelectedTab] = useState<AnalyticsTabId | 'all'>('calendar');
    const [multiSelectedTabs, setMultiSelectedTabs] = useState<AnalyticsTabId[]>(['calendar']);
    const [reportTimeRange, setReportTimeRange] = useState<ReportTimeRange>('THIS_WEEK');
    const [viewType, setViewType] = useState<AnalyticsViewType>('BOTH');
    const [filters, setFilters] = useState({ type: '', scope: '', category: '', dateFrom: '', dateTo: '' });
    const [goalPeriodFilter, setGoalPeriodFilter] = useState<SharedGoalPeriodFilter>(DEFAULT_GOAL_PERIOD_FILTER);
    const [taskFilters, setTaskFilters] = useState<{
        dueDate: AnalyticsTaskDueDateFilter;
        type: AnalyticsTaskTypeFilter;
        priority: AnalyticsTaskPriorityFilter;
        status: AnalyticsTaskStatusFilter;
    }>({ ...DEFAULT_TASK_FILTERS });
    const [expenseFilters, setExpenseFilters] = useState({ ...DEFAULT_EXPENSE_FILTERS });
    const [houseworkFilters, setHouseworkFilters] = useState<{
        dueDate: AnalyticsHouseworkDueDateFilter;
        frequency: AnalyticsHouseworkFrequencyFilter;
        status: AnalyticsHouseworkStatusFilter;
    }>({ ...DEFAULT_HOUSEWORK_FILTERS });
    const [keyboardFilters, setKeyboardFilters] = useState({ ...DEFAULT_KEYBOARD_FILTERS });
    const [fundsFilters, setFundsFilters] = useState({ ...DEFAULT_FUNDS_FILTERS });

    const selectedRange = useMemo(() => {
        if (reportTimeRange === 'CUSTOM') return null;
        return getRangeForPreset(reportTimeRange);
    }, [reportTimeRange]);
    const taskSelectedRange = useMemo(() => getTaskDueDateRange(taskFilters.dueDate), [taskFilters.dueDate]);
    const expenseSelectedRange = useMemo(
        () => expenseFilters.timePreset === 'CUSTOM'
            ? { dateFrom: expenseFilters.dateFrom, dateTo: expenseFilters.dateTo }
            : getExpenseDateRangeFromPreset(expenseFilters.timePreset as ExpenseTimePreset),
        [expenseFilters],
    );
    const houseworkSelectedRange = useMemo(
        () => getHouseworkDueDateRange(houseworkFilters.dueDate),
        [houseworkFilters.dueDate],
    );

    const baseQuery = useMemo(() => {
        const params = new URLSearchParams();
        params.set('groupBy', 'category');
        const isSingleTaskView = selectionMode === 'single' && singleSelectedTab === 'tasks';
        const isSingleGoalView = selectionMode === 'single' && singleSelectedTab === 'goals';
        const isSingleExpenseView = selectionMode === 'single' && singleSelectedTab === 'expenses';
        const isSingleHouseworkView = selectionMode === 'single' && singleSelectedTab === 'housework';
        if (isSingleTaskView) {
            if (taskFilters.type !== 'ALL') params.set('type', taskFilters.type);
            if (taskFilters.priority !== 'ALL') params.set('priority', taskFilters.priority);
            if (taskFilters.status !== 'ALL') params.set('status', taskFilters.status);
        } else if (isSingleGoalView) {
            if (goalPeriodFilter !== 'ALL') params.set('periodType', goalPeriodFilter);
        } else if (isSingleExpenseView) {
            if (expenseFilters.type) params.set('type', expenseFilters.type);
            if (expenseFilters.scope) params.set('scope', expenseFilters.scope);
            if (expenseFilters.category) params.set('category', expenseFilters.category);
        } else if (isSingleHouseworkView) {
            if (houseworkFilters.frequency !== 'ALL') params.set('frequency', houseworkFilters.frequency);
            if (houseworkFilters.status !== 'ALL') params.set('status', houseworkFilters.status);
        } else if (filters.type) params.set('type', filters.type);
        if (!isSingleExpenseView && filters.scope) params.set('scope', filters.scope);
        if (!isSingleExpenseView && filters.category) params.set('category', filters.category);
        if (isSingleTaskView) {
            if (taskSelectedRange) {
                params.set('dateFrom', taskSelectedRange.start.toISOString());
                params.set('dateTo', taskSelectedRange.end.toISOString());
            }
        } else if (isSingleExpenseView) {
            if (expenseSelectedRange.dateFrom) params.set('dateFrom', new Date(`${expenseSelectedRange.dateFrom}T00:00:00`).toISOString());
            if (expenseSelectedRange.dateTo) params.set('dateTo', new Date(`${expenseSelectedRange.dateTo}T23:59:59.999`).toISOString());
        } else if (isSingleHouseworkView) {
            if (houseworkSelectedRange) {
                params.set('dateFrom', houseworkSelectedRange.start.toISOString());
                params.set('dateTo', houseworkSelectedRange.end.toISOString());
            }
        } else if (selectedRange) {
            params.set('dateFrom', selectedRange.start.toISOString());
            params.set('dateTo', selectedRange.end.toISOString());
        }
        if (!isSingleTaskView && !isSingleExpenseView && !isSingleHouseworkView && reportTimeRange === 'CUSTOM' && filters.dateFrom) params.set('dateFrom', new Date(`${filters.dateFrom}T00:00:00`).toISOString());
        if (!isSingleTaskView && !isSingleExpenseView && !isSingleHouseworkView && reportTimeRange === 'CUSTOM' && filters.dateTo) params.set('dateTo', new Date(`${filters.dateTo}T23:59:59.999`).toISOString());
        return params.toString();
    }, [reportTimeRange, filters, selectedRange, selectionMode, singleSelectedTab, taskFilters, taskSelectedRange, goalPeriodFilter, expenseFilters, expenseSelectedRange, houseworkFilters, houseworkSelectedRange]);

    const expenseQuery = useMemo(() => {
        const params = new URLSearchParams(baseQuery);
        params.set('groupBy', 'category');
        return params.toString();
    }, [baseQuery]);

    const expenseTrendQuery = useMemo(() => {
        const params = new URLSearchParams(expenseQuery);
        params.set('groupBy', 'monthly');
        return params.toString();
    }, [expenseQuery]);

    const reportQuery = baseQuery ? `?${baseQuery}` : '';
    const fundsAnalyticsQuery = useMemo(() => {
        const source = selectionMode === 'single' && singleSelectedTab === 'funds'
            ? fundsFilters
            : DEFAULT_FUNDS_FILTERS;
        const params = new URLSearchParams();
        params.set('page', '1');
        params.set('limit', '1000');
        if (source.type) params.set('type', source.type);
        if (source.scope) params.set('scope', source.scope);
        if (source.category) params.set('category', source.category);
        if (source.condition) params.set('condition', source.condition);
        if (source.dateFrom) params.set('dateFrom', new Date(`${source.dateFrom}T00:00:00`).toISOString());
        if (source.dateTo) params.set('dateTo', new Date(`${source.dateTo}T23:59:59.999`).toISOString());
        return params.toString();
    }, [selectionMode, singleSelectedTab, fundsFilters]);

    const { data: tasksByStatus } = useQuery({
        queryKey: ['reports', 'tasks-by-status', baseQuery],
        queryFn: async () => (await api.get(`/reports/tasks-by-status${reportQuery}`)).data.data,
    });

    const { data: projectItemsByStatus } = useQuery({
        queryKey: ['reports', 'project-items-by-status', baseQuery],
        queryFn: async () => (await api.get(`/reports/project-items-by-status${reportQuery}`)).data.data,
    });

    const { data: projectItemsByType } = useQuery({
        queryKey: ['reports', 'project-items-by-type', baseQuery],
        queryFn: async () => (await api.get(`/reports/project-items-by-type${reportQuery}`)).data.data,
    });

    const { data: goalCompletion } = useQuery({
        queryKey: ['reports', 'goal-completion', baseQuery],
        queryFn: async () => (await api.get(`/reports/goal-completion${reportQuery}`)).data.data,
    });

    const { data: calendarOverview } = useQuery({
        queryKey: ['reports', 'calendar-overview', baseQuery],
        queryFn: async () => (await api.get(`/reports/calendar-overview${reportQuery}`)).data.data,
    });

    const { data: calendarByCategory } = useQuery({
        queryKey: ['reports', 'calendar-by-category', baseQuery],
        queryFn: async () => (await api.get(`/reports/calendar-by-category${reportQuery}`)).data.data,
    });

    const { data: houseworkStatus } = useQuery({
        queryKey: ['reports', 'housework-status', baseQuery],
        queryFn: async () => (await api.get(`/reports/housework-status${reportQuery}`)).data.data,
    });

    const { data: expenseSummary } = useQuery({
        queryKey: ['reports', 'expense-summary', expenseQuery],
        queryFn: async () => (await api.get(`/reports/expense-summary?${expenseQuery}`)).data.data,
    });

    const { data: expenseTrend } = useQuery({
        queryKey: ['reports', 'expense-trend', expenseTrendQuery],
        queryFn: async () => (await api.get(`/reports/expense-summary?${expenseTrendQuery}`)).data.data,
    });

    const { data: assetOverview } = useQuery({
        queryKey: ['reports', 'asset-overview', baseQuery],
        queryFn: async () => (await api.get(`/reports/asset-overview${reportQuery}`)).data.data,
    });

    const { data: assetsByType } = useQuery({
        queryKey: ['reports', 'assets-by-type', baseQuery],
        queryFn: async () => (await api.get(`/reports/assets-by-type${reportQuery}`)).data.data,
    });

    const { data: learningStatus } = useQuery({
        queryKey: ['reports', 'learning-status', baseQuery],
        queryFn: async () => (await api.get(`/reports/learning-status${reportQuery}`)).data.data,
    });

    const { data: learningTopics } = useQuery({
        queryKey: ['reports', 'learning-topics', baseQuery],
        queryFn: async () => (await api.get(`/reports/learning-topics${reportQuery}`)).data.data,
    });

    const { data: ideaStatus } = useQuery({
        queryKey: ['reports', 'idea-status', baseQuery],
        queryFn: async () => (await api.get(`/reports/ideas-status${reportQuery}`)).data.data,
    });

    const { data: ideaTopics } = useQuery({
        queryKey: ['reports', 'idea-topics', baseQuery],
        queryFn: async () => (await api.get(`/reports/idea-topics${reportQuery}`)).data.data,
    });
    const { data: rawProjectItems } = useQuery({
        queryKey: ['reports', 'raw-project', baseQuery],
        queryFn: async () => (await api.get(`/reports/raw-records?module=project&${baseQuery}`)).data.data,
    });
    const { data: rawTasks } = useQuery({
        queryKey: ['reports', 'raw-tasks', baseQuery],
        queryFn: async () => (await api.get(`/reports/raw-records?module=tasks&${baseQuery}`)).data.data,
    });
    const { data: rawGoals } = useQuery({
        queryKey: ['reports', 'raw-goals', baseQuery],
        queryFn: async () => (await api.get(`/reports/raw-records?module=goals&${baseQuery}`)).data.data,
    });
    const { data: rawCalendar } = useQuery({
        queryKey: ['reports', 'raw-calendar', baseQuery],
        queryFn: async () => (await api.get(`/reports/raw-records?module=calendar&${baseQuery}`)).data.data,
    });
    const { data: rawHousework } = useQuery({
        queryKey: ['reports', 'raw-housework', baseQuery],
        queryFn: async () => (await api.get(`/reports/raw-records?module=housework&${baseQuery}`)).data.data,
    });
    const { data: rawExpenses } = useQuery({
        queryKey: ['reports', 'raw-expenses', baseQuery],
        queryFn: async () => (await api.get(`/reports/raw-records?module=expenses&${baseQuery}`)).data.data,
    });
    const { data: rawAssets } = useQuery({
        queryKey: ['reports', 'raw-assets', baseQuery],
        queryFn: async () => (await api.get(`/reports/raw-records?module=assets&${baseQuery}`)).data.data,
    });
    const { data: rawLearning } = useQuery({
        queryKey: ['reports', 'raw-learning', baseQuery],
        queryFn: async () => (await api.get(`/reports/raw-records?module=learning&${baseQuery}`)).data.data,
    });
    const { data: rawIdeas } = useQuery({
        queryKey: ['reports', 'raw-ideas', baseQuery],
        queryFn: async () => (await api.get(`/reports/raw-records?module=ideas&${baseQuery}`)).data.data,
    });
    const { data: keyboardAnalyticsData } = useQuery({
        queryKey: ['reports', 'keyboard-analytics'],
        queryFn: async () => (await api.get('/keyboards?page=1&limit=1000')).data,
    });
    const { data: fundsAnalyticsData } = useQuery({
        queryKey: ['reports', 'funds-analytics', fundsAnalyticsQuery],
        queryFn: async () => (await api.get(`/funds?${fundsAnalyticsQuery}`)).data,
    });

    const ff = useMemo(() => getFeatureFlags(user), [user]);
    const tabs = useMemo<AnalyticsTab[]>(
        () => FEATURE_GROUPS
            .flatMap((group) => group.items)
            .filter((item) => ff[item.key])
            .map((item) => {
                const analyticsTab = ANALYTICS_ROUTE_TAB_MAP[item.route as keyof typeof ANALYTICS_ROUTE_TAB_MAP];
                return analyticsTab ? { ...analyticsTab } : null;
            })
            .filter((tab): tab is AnalyticsTab => tab !== null),
        [ff],
    );

    useEffect(() => {
        const availableIds = tabs.map((tab) => tab.id);
        const preferredDefault = availableIds.includes('calendar') ? 'calendar' : availableIds[0];

        setMultiSelectedTabs((current) => {
            const filtered = current.filter((id) => availableIds.includes(id));
            if (filtered.length > 0) {
                return sameTabIds(current, filtered) ? current : filtered;
            }
            const fallback = preferredDefault ? [preferredDefault] : [];
            return sameTabIds(current, fallback) ? current : fallback;
        });

        setSingleSelectedTab((current) => {
            if (current === 'all') return 'all';
            if (current && availableIds.includes(current)) return current;
            return preferredDefault || 'all';
        });
    }, [tabs]);

    const selectedTabs = useMemo<AnalyticsTabId[]>(
        () => (selectionMode === 'single'
            ? (singleSelectedTab === 'all' ? tabs.map((tab) => tab.id) : [singleSelectedTab])
            : multiSelectedTabs),
        [selectionMode, singleSelectedTab, tabs, multiSelectedTabs],
    );

    const selectedTabsKey = useMemo(() => selectedTabs.join('|'), [selectedTabs]);

    useEffect(() => {
        setFilters((current) => {
            if (!current.type && !current.scope && !current.category) return current;
            return { ...current, type: '', scope: '', category: '' };
        });
    }, [selectedTabsKey]);

    const primaryTab = selectedTabs[0] || (tabs.some((tab) => tab.id === 'calendar') ? 'calendar' : tabs[0]?.id || 'calendar');
    const hasMultipleTabsSelected = selectedTabs.length > 1;

    const typeFilterOptions =
        primaryTab === 'project' ? projectItemTypeOptions
            : primaryTab === 'tasks' ? taskTypeOptions
                : primaryTab === 'expenses' ? typeOptions
                    : [];
    const showTypeSelect = !hasMultipleTabsSelected && ['project', 'tasks', 'expenses'].includes(primaryTab);
    const showTypeInput = !hasMultipleTabsSelected && primaryTab === 'assets';
    const showScopeSelect = !hasMultipleTabsSelected && primaryTab === 'expenses';
    const showCategorySelect = !hasMultipleTabsSelected && primaryTab === 'expenses';
    const showCategoryInput = !hasMultipleTabsSelected && ['project', 'calendar', 'ideas'].includes(primaryTab);
    const isSingleTaskView = selectionMode === 'single' && singleSelectedTab === 'tasks';
    const isSingleGoalView = selectionMode === 'single' && singleSelectedTab === 'goals';
    const isSingleExpenseView = selectionMode === 'single' && singleSelectedTab === 'expenses';
    const isSingleHouseworkView = selectionMode === 'single' && singleSelectedTab === 'housework';
    const isSingleKeyboardView = selectionMode === 'single' && singleSelectedTab === 'keyboard';
    const isSingleFundsView = selectionMode === 'single' && singleSelectedTab === 'funds';
    const filterGridCols = 1 + (showTypeSelect || showTypeInput ? 1 : 0) + (showScopeSelect ? 1 : 0) + (showCategorySelect || showCategoryInput ? 1 : 0);
    const filterGridClass = filterGridCols >= 4
        ? 'grid-cols-1 md:grid-cols-4'
        : filterGridCols === 3
            ? 'grid-cols-1 md:grid-cols-3'
            : filterGridCols === 2
                ? 'grid-cols-1 md:grid-cols-2'
                : 'grid-cols-1';
    const showCharts = viewType === 'CHARTS' || viewType === 'BOTH';
    const showTables = viewType === 'TABLES' || viewType === 'BOTH';
    const selectedTimeRangeLabel = reportTimeRangeOptions.find((option) => option.value === reportTimeRange)?.label || reportTimeRange;
    const selectedDateRangeLabel = reportTimeRange === 'CUSTOM'
        ? `${filters.dateFrom || 'Start'} → ${filters.dateTo || 'End'}`
        : selectedRange
            ? `${formatDisplayDate(selectedRange.start)} → ${formatDisplayDate(selectedRange.end)}`
            : 'All Time';
    const keyboardItems = keyboardAnalyticsData?.data || [];
    const keyboardAnalyticsRows = useMemo(
        () => keyboardItems.filter((item: any) => matchesKeyboardFilters(item, isSingleKeyboardView ? keyboardFilters : DEFAULT_KEYBOARD_FILTERS)),
        [keyboardItems, keyboardFilters, isSingleKeyboardView],
    );
    const keyboardSummary = useMemo(() => {
        const totals = { kit: 0, keycap: 0, accessories: 0, total: 0 };
        keyboardAnalyticsRows.forEach((item: any) => {
            const price = item.price ?? 0;
            totals.total += price;
            if (item.category === 'Kit') totals.kit += price;
            if (item.category === 'Keycap') totals.keycap += price;
            if (item.category === 'Accessories') totals.accessories += price;
        });
        return totals;
    }, [keyboardAnalyticsRows]);
    const keyboardCategoryChart = useMemo(() => {
        const map = new Map<string, number>();
        keyboardAnalyticsRows.forEach((item: any) => {
            const key = item.category || 'Uncategorized';
            map.set(key, (map.get(key) || 0) + 1);
        });
        return Array.from(map.entries()).map(([category, count]) => ({ category, count }));
    }, [keyboardAnalyticsRows]);
    const fundsAnalyticsRows = fundsAnalyticsData?.data || [];
    const fundsSummary = useMemo(() => {
        const buy = fundsAnalyticsRows.filter((item: any) => item.type === 'BUY').reduce((sum: number, item: any) => sum + item.amount, 0);
        const sell = fundsAnalyticsRows.filter((item: any) => item.type === 'SELL').reduce((sum: number, item: any) => sum + item.amount, 0);
        const topUp = fundsAnalyticsRows.filter((item: any) => item.type === 'TOP_UP').reduce((sum: number, item: any) => sum + item.amount, 0);
        return { buy, sell, topUp, net: sell + topUp - buy };
    }, [fundsAnalyticsRows]);
    const fundsTypeChart = useMemo(() => {
        const map = new Map<string, number>();
        fundsAnalyticsRows.forEach((item: any) => {
            map.set(item.type, (map.get(item.type) || 0) + 1);
        });
        return Array.from(map.entries()).map(([type, count]) => ({ type, count }));
    }, [fundsAnalyticsRows]);

    const tableConfigs = {
        project: {
            title: 'Project Tasks',
            columns: [
                { key: 'title', label: 'Title' },
                { key: 'project', label: 'Project' },
                { key: 'type', label: 'Type' },
                { key: 'status', label: 'Status' },
                { key: 'priority', label: 'Priority' },
                { key: 'deadline', label: 'Deadline', render: (value: any) => formatDisplayDate(value) },
            ],
            rows: rawProjectItems || [],
        },
        tasks: {
            title: 'Tasks',
            columns: [
                { key: 'title', label: 'Title' },
                { key: 'taskType', label: 'Type' },
                { key: 'status', label: 'Status' },
                { key: 'priority', label: 'Priority' },
                { key: 'dueDate', label: 'Due Date', render: (value: any) => formatDisplayDate(value) },
                { key: 'expenseCategory', label: 'Category' },
            ],
            rows: rawTasks || [],
        },
        goals: {
            title: 'Goals',
            columns: [
                { key: 'title', label: 'Goal' },
                { key: 'periodType', label: 'Period' },
                { key: 'completionRate', label: 'Completion', render: (value: any) => `${value}%` },
                { key: 'currentCount', label: 'Current' },
                { key: 'targetCount', label: 'Target' },
                { key: 'periodEnd', label: 'Period End', render: (value: any) => formatDisplayDate(value) },
            ],
            rows: rawGoals || [],
        },
        calendar: {
            title: 'Calendar Events',
            columns: [
                { key: 'title', label: 'Title' },
                { key: 'category', label: 'Category' },
                { key: 'startDate', label: 'Start', render: (value: any) => formatDisplayDate(value) },
                { key: 'endDate', label: 'End', render: (value: any) => formatDisplayDate(value) },
                { key: 'location', label: 'Location' },
                { key: 'allDay', label: 'All Day', render: (value: any) => (value ? 'Yes' : 'No') },
            ],
            rows: rawCalendar || [],
        },
        housework: {
            title: 'Housework Items',
            columns: [
                { key: 'title', label: 'Title' },
                { key: 'frequencyType', label: 'Frequency' },
                { key: 'status', label: 'Status' },
                { key: 'assignee', label: 'Assignee' },
                { key: 'nextDueDate', label: 'Next Due', render: (value: any) => formatDisplayDate(value) },
                { key: 'lastCompletedDate', label: 'Last Completed', render: (value: any) => formatDisplayDate(value) },
                { key: 'active', label: 'Active', render: (value: any) => (value ? 'Yes' : 'No') },
            ],
            rows: rawHousework || [],
        },
        expenses: {
            title: 'Expenses',
            columns: [
                { key: 'date', label: 'Date', render: (value: any) => formatDisplayDate(value) },
                { key: 'description', label: 'Description' },
                { key: 'type', label: 'Type' },
                { key: 'scope', label: 'Scope' },
                { key: 'category', label: 'Category' },
                { key: 'amount', label: 'Amount', render: (value: any) => formatVND(Number(value || 0)) },
            ],
            rows: rawExpenses || [],
        },
        assets: {
            title: 'Assets',
            columns: [
                { key: 'name', label: 'Name' },
                { key: 'type', label: 'Type' },
                { key: 'brand', label: 'Brand' },
                { key: 'model', label: 'Model' },
                { key: 'purchaseDate', label: 'Purchase Date', render: (value: any) => formatDisplayDate(value) },
                { key: 'maintenanceCount', label: 'Maintenance Logs' },
            ],
            rows: rawAssets || [],
        },
        learning: {
            title: 'Learning Records',
            columns: [
                { key: 'title', label: 'Title' },
                { key: 'topic', label: 'Topic' },
                { key: 'status', label: 'Status' },
                { key: 'progress', label: 'Progress', render: (value: any) => `${value ?? 0}%` },
                { key: 'deadline', label: 'Deadline', render: (value: any) => formatDisplayDate(value) },
            ],
            rows: rawLearning || [],
        },
        keyboard: {
            title: 'Keyboard Items',
            columns: [
                { key: 'name', label: 'Name' },
                { key: 'category', label: 'Category' },
                { key: 'tag', label: 'Tag' },
                { key: 'color', label: 'Color' },
                { key: 'price', label: 'Price', render: (value: any) => value != null ? formatVND(Number(value || 0)) : '—' },
            ],
            rows: keyboardAnalyticsRows,
        },
        funds: {
            title: 'Fund Transactions',
            columns: [
                { key: 'date', label: 'Date', render: (value: any) => formatDisplayDate(value) },
                { key: 'type', label: 'Type' },
                { key: 'scope', label: 'Scope' },
                { key: 'category', label: 'Category' },
                { key: 'condition', label: 'Condition' },
                { key: 'description', label: 'Description' },
                { key: 'amount', label: 'Amount', render: (value: any) => formatVND(Number(value || 0)) },
            ],
            rows: fundsAnalyticsRows,
        },
        ideas: {
            title: 'Ideas',
            columns: [
                { key: 'title', label: 'Title' },
                { key: 'topic', label: 'Topic' },
                { key: 'category', label: 'Category' },
                { key: 'status', label: 'Status' },
                { key: 'createdAt', label: 'Created', render: (value: any) => formatDisplayDate(value) },
            ],
            rows: rawIdeas || [],
        },
    } as const;

    const chartExportConfigs = {
        project: [
            { title: 'Project Tasks by Status', columns: [{ key: 'status', label: 'Status' }, { key: 'count', label: 'Count' }], rows: projectItemsByStatus || [] },
            { title: 'Project Tasks by Type', columns: [{ key: 'type', label: 'Type' }, { key: 'count', label: 'Count' }], rows: projectItemsByType || [] },
        ],
        tasks: [
            { title: 'Tasks by Status', columns: [{ key: 'status', label: 'Status' }, { key: 'count', label: 'Count' }], rows: tasksByStatus || [] },
        ],
        goals: [
            { title: 'Goal Completion Rates', columns: [{ key: 'title', label: 'Goal' }, { key: 'completionRate', label: 'Completion' }, { key: 'currentCount', label: 'Current' }, { key: 'targetCount', label: 'Target' }], rows: goalCompletion || [] },
        ],
        calendar: [
            {
                title: 'Calendar Overview',
                columns: [{ key: 'label', label: 'Metric' }, { key: 'value', label: 'Value' }],
                rows: calendarOverview ? [
                    { label: 'Total Events', value: calendarOverview.total },
                    { label: 'Today', value: calendarOverview.today },
                    { label: 'Upcoming', value: calendarOverview.upcoming },
                    { label: 'All Day', value: calendarOverview.allDay },
                ] : [],
            },
            { title: 'Events by Category', columns: [{ key: 'category', label: 'Category' }, { key: 'count', label: 'Count' }], rows: calendarByCategory || [] },
        ],
        housework: [
            {
                title: 'Housework Summary',
                columns: [{ key: 'label', label: 'Metric' }, { key: 'value', label: 'Value' }],
                rows: houseworkStatus ? [
                    { label: 'Total Active', value: houseworkStatus.total },
                    { label: 'On Track', value: houseworkStatus.onTrack },
                    { label: 'Overdue', value: houseworkStatus.overdue },
                    { label: 'Completed', value: houseworkStatus.completed },
                ] : [],
            },
        ],
        expenses: [
            { title: 'Expenses by Category', columns: [{ key: 'category', label: 'Category' }, { key: 'count', label: 'Count' }, { key: 'total', label: 'Total', render: (value: any) => formatVND(Number(value || 0)) }], rows: expenseSummary || [] },
            { title: 'Expense Trend', columns: [{ key: 'month', label: 'Month' }, { key: 'total', label: 'Total', render: (value: any) => formatVND(Number(value || 0)) }], rows: expenseTrend || [] },
        ],
        assets: [
            {
                title: 'Asset Overview',
                columns: [{ key: 'label', label: 'Metric' }, { key: 'value', label: 'Value' }],
                rows: assetOverview ? [
                    { label: 'Total Assets', value: assetOverview.totalAssets },
                    { label: 'With Warranty', value: assetOverview.withWarranty },
                    { label: 'Upcoming Maintenance', value: assetOverview.upcomingMaintenance },
                    { label: 'Maintenance Cost', value: formatVND(Number(assetOverview.totalMaintenanceCost || 0)) },
                ] : [],
            },
            { title: 'Assets by Type', columns: [{ key: 'type', label: 'Type' }, { key: 'count', label: 'Count' }], rows: assetsByType || [] },
        ],
        learning: [
            { title: 'Learning by Status', columns: [{ key: 'status', label: 'Status' }, { key: 'count', label: 'Count' }], rows: learningStatus || [] },
            { title: 'Learning by Topic', columns: [{ key: 'topic', label: 'Topic' }, { key: 'count', label: 'Count' }], rows: learningTopics || [] },
        ],
        keyboard: [
            {
                title: 'Keyboard Summary',
                columns: [{ key: 'label', label: 'Metric' }, { key: 'value', label: 'Value' }],
                rows: [
                    { label: 'Kit', value: formatVND(keyboardSummary.kit) },
                    { label: 'Keycap', value: formatVND(keyboardSummary.keycap) },
                    { label: 'Accessories', value: formatVND(keyboardSummary.accessories) },
                    { label: 'Total', value: formatVND(keyboardSummary.total) },
                ],
            },
            { title: 'Keyboard by Category', columns: [{ key: 'category', label: 'Category' }, { key: 'count', label: 'Count' }], rows: keyboardCategoryChart },
        ],
        funds: [
            {
                title: 'Funds Summary',
                columns: [{ key: 'label', label: 'Metric' }, { key: 'value', label: 'Value' }],
                rows: [
                    { label: 'Buy', value: formatVND(fundsSummary.buy) },
                    { label: 'Sell', value: formatVND(fundsSummary.sell) },
                    { label: 'Top-up', value: formatVND(fundsSummary.topUp) },
                    { label: 'Net', value: formatVND(fundsSummary.net) },
                ],
            },
            { title: 'Funds by Type', columns: [{ key: 'type', label: 'Type' }, { key: 'count', label: 'Count' }], rows: fundsTypeChart },
        ],
        ideas: [
            { title: 'Ideas by Status', columns: [{ key: 'status', label: 'Status' }, { key: 'count', label: 'Count' }], rows: ideaStatus || [] },
            { title: 'Ideas by Topic', columns: [{ key: 'topic', label: 'Topic' }, { key: 'count', label: 'Count' }], rows: ideaTopics || [] },
        ],
    } as const;

    function buildExportSections() {
        const sections: Array<{
            moduleLabel: string;
            title: string;
            columns: ReadonlyArray<{ key: string; label: string; render?: (value: any, row: Record<string, any>) => React.ReactNode }>;
            rows: ReadonlyArray<Record<string, any>>;
        }> = [];

        selectedTabs.forEach((tabId) => {
            const moduleLabel = tabs.find((tab) => tab.id === tabId)?.label || tabId;
            if (showCharts) {
                (chartExportConfigs[tabId as keyof typeof chartExportConfigs] || []).forEach((section) => {
                    sections.push({ moduleLabel, ...section });
                });
            }
            if (showTables) {
                const section = tableConfigs[tabId as keyof typeof tableConfigs];
                if (section) {
                    sections.push({ moduleLabel, ...section });
                }
            }
        });

        return sections;
    }

    function handleExportExcel() {
        const sections = buildExportSections();
        const summaryRows = [
            ['Time Filter', selectedTimeRangeLabel],
            ['Date Range', selectedDateRangeLabel],
            ['View Type', viewType],
            ['Pages', selectedTabs.map((tabId) => tabs.find((tab) => tab.id === tabId)?.label || tabId).join(', ')],
        ];

        const summaryTable = `
            <table>
                ${summaryRows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}
            </table>
        `;

        const sectionsHtml = sections.map((section) => `
            <h2>${escapeHtml(section.moduleLabel)} · ${escapeHtml(section.title)}</h2>
            <table>
                <thead>
                    <tr>${section.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${(section.rows.length ? section.rows : [{}]).map((row) => (
                        section.rows.length
                            ? `<tr>${section.columns.map((column) => `<td>${escapeHtml(renderExportCell(column, row))}</td>`).join('')}</tr>`
                            : `<tr><td colspan="${section.columns.length}">No data for this filter.</td></tr>`
                    )).join('')}
                </tbody>
            </table>
        `).join('');

        const html = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
                <head>
                    <meta charset="UTF-8" />
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h1 { margin: 0 0 12px; }
                        h2 { margin: 24px 0 8px; }
                        table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
                        th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
                        th { background: #f3f4f6; }
                    </style>
                </head>
                <body>
                    <h1>NgocKy Analytics Export</h1>
                    ${summaryTable}
                    ${sectionsHtml}
                </body>
            </html>
        `;

        const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ngocky-analytics-${selectedTimeRangeLabel.toLowerCase().replace(/\s+/g, '-')}.xls`;
        link.click();
        URL.revokeObjectURL(url);
    }

    function handleExportPdf() {
        if (!reportContentRef.current) return;
        const printWindow = window.open('', '_blank', 'width=1280,height=900');
        if (!printWindow) return;

        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
            .map((node) => node.outerHTML)
            .join('\n');

        printWindow.document.open();
        printWindow.document.write(`
            <html>
                <head>
                    <title>NgocKy Analytics Export</title>
                    ${styles}
                    <style>
                        body { font-family: Arial, sans-serif; padding: 24px; background: #ffffff; color: #111827; }
                        .print-header { margin-bottom: 24px; }
                        .print-header h1 { margin: 0 0 8px; font-size: 28px; }
                        .print-meta { font-size: 14px; color: #4b5563; display: grid; gap: 4px; }
                        .card { break-inside: avoid; page-break-inside: avoid; }
                    </style>
                </head>
                <body>
                    <div class="print-header">
                        <h1>NgocKy Analytics Export</h1>
                        <div class="print-meta">
                            <div><strong>Time Filter:</strong> ${escapeHtml(selectedTimeRangeLabel)}</div>
                            <div><strong>Date Range:</strong> ${escapeHtml(selectedDateRangeLabel)}</div>
                            <div><strong>View Type:</strong> ${escapeHtml(viewType)}</div>
                            <div><strong>Pages:</strong> ${escapeHtml(selectedTabs.map((tabId) => tabs.find((tab) => tab.id === tabId)?.label || tabId).join(', '))}</div>
                        </div>
                    </div>
                    ${reportContentRef.current.innerHTML}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        window.setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 400);
    }

    function toggleTab(tabId: AnalyticsTabId) {
        if (selectionMode === 'single') {
            setSingleSelectedTab(tabId);
            return;
        }

        setMultiSelectedTabs((current) => {
            if (current.includes(tabId)) {
                return current.length === 1 ? current : current.filter((id) => id !== tabId);
            }
            return tabs.map((tab) => tab.id).filter((id) => id === tabId || current.includes(id));
        });
    }

    function selectAllTabs() {
        if (selectionMode === 'single') {
            setSingleSelectedTab('all');
            return;
        }
        setMultiSelectedTabs(tabs.map((t) => t.id));
    }

    function setMode(mode: AnalyticsSelectionMode) {
        setSelectionMode(mode);
        if (mode === 'single') {
            setSingleSelectedTab((current) => {
                if (current === 'all') return current;
                return current || multiSelectedTabs[0] || (tabs.some((tab) => tab.id === 'calendar') ? 'calendar' : tabs[0]?.id || 'all');
            });
        }
    }

    const isAllSelected = selectionMode === 'single'
        ? singleSelectedTab === 'all'
        : multiSelectedTabs.length === tabs.length && tabs.every((tab) => multiSelectedTabs.includes(tab.id));

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Analytics</h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        className="px-4 py-2 rounded-md text-sm font-semibold transition-all inline-flex items-center gap-2"
                        style={{ backgroundColor: '#166534', color: '#fff' }}
                        onClick={handleExportExcel}
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Export Excel
                    </button>
                    <button
                        type="button"
                        className="px-4 py-2 rounded-md text-sm font-semibold transition-all inline-flex items-center gap-2"
                        style={{ backgroundColor: '#1d4ed8', color: '#fff' }}
                        onClick={handleExportPdf}
                    >
                        <FileText className="w-4 h-4" />
                        Export PDF
                    </button>
                </div>
            </div>

            <div className="card p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>🔍 Analytics Configuration</span>
                </div>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    {isSingleTaskView ? (
                        <div className="grid grid-cols-1 gap-3 flex-1 md:grid-cols-4">
                            <select className="input text-sm" value={taskFilters.dueDate} onChange={(e) => setTaskFilters((current) => ({ ...current, dueDate: e.target.value as AnalyticsTaskDueDateFilter }))}>
                                {TASK_DUE_DATE_FILTER_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            <select className="input text-sm" value={taskFilters.type} onChange={(e) => setTaskFilters((current) => ({ ...current, type: e.target.value as AnalyticsTaskTypeFilter }))}>
                                {TASK_TYPE_FILTER_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            <select className="input text-sm" value={taskFilters.priority} onChange={(e) => setTaskFilters((current) => ({ ...current, priority: e.target.value as AnalyticsTaskPriorityFilter }))}>
                                {TASK_PRIORITY_FILTER_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            <select className="input text-sm" value={taskFilters.status} onChange={(e) => setTaskFilters((current) => ({ ...current, status: e.target.value as AnalyticsTaskStatusFilter }))}>
                                {TASK_STATUS_FILTER_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>
                    ) : isSingleGoalView ? (
                        <div className="grid grid-cols-1 gap-3 flex-1 md:grid-cols-1">
                            <select className="input text-sm" value={goalPeriodFilter} onChange={(e) => setGoalPeriodFilter(e.target.value as SharedGoalPeriodFilter)}>
                                {GOAL_PERIOD_FILTER_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>
                    ) : isSingleExpenseView ? (
                        <div className="grid grid-cols-1 gap-3 flex-1 md:grid-cols-4">
                            <select className="input text-sm" value={expenseFilters.timePreset} onChange={(e) => setExpenseFilters((current) => ({ ...current, timePreset: e.target.value as ExpenseTimePreset }))}>
                                {EXPENSE_TIME_PRESET_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            <select className="input text-sm" value={expenseFilters.type} onChange={(e) => setExpenseFilters((current) => {
                                const nextType = e.target.value;
                                const availableCategories = nextType === 'RECEIVE'
                                    ? EXPENSE_RECEIVE_CATEGORIES
                                    : nextType === 'PAY'
                                        ? EXPENSE_PAY_CATEGORIES
                                        : EXPENSE_ALL_CATEGORIES;
                                return {
                                    ...current,
                                    type: nextType,
                                    category: current.category && !availableCategories.includes(current.category) ? '' : current.category,
                                };
                            })}>
                                <option value="">All Types</option>
                                {EXPENSE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                            <select className="input text-sm" value={expenseFilters.scope} onChange={(e) => setExpenseFilters((current) => ({ ...current, scope: e.target.value }))}>
                                <option value="">All Scopes</option>
                                {EXPENSE_SCOPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                            <select className="input text-sm" value={expenseFilters.category} onChange={(e) => setExpenseFilters((current) => ({ ...current, category: e.target.value }))}>
                                <option value="">All Categories</option>
                                {(expenseFilters.type === 'RECEIVE' ? EXPENSE_RECEIVE_CATEGORIES : expenseFilters.type === 'PAY' ? EXPENSE_PAY_CATEGORIES : EXPENSE_ALL_CATEGORIES).map((category) => (
                                    <option key={category} value={category}>{category}</option>
                                ))}
                            </select>
                        </div>
                    ) : isSingleHouseworkView ? (
                        <div className="grid grid-cols-1 gap-3 flex-1 md:grid-cols-3">
                            <select className="input text-sm" value={houseworkFilters.dueDate} onChange={(e) => setHouseworkFilters((current) => ({ ...current, dueDate: e.target.value as AnalyticsHouseworkDueDateFilter }))}>
                                {HOUSEWORK_DUE_DATE_FILTER_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            <select className="input text-sm" value={houseworkFilters.frequency} onChange={(e) => setHouseworkFilters((current) => ({ ...current, frequency: e.target.value as AnalyticsHouseworkFrequencyFilter }))}>
                                <option value="ALL">All Frequencies</option>
                                {HOUSEWORK_FREQUENCY_OPTIONS.map((frequency) => (
                                    <option key={frequency} value={frequency}>{frequency.replaceAll('_', ' ')}</option>
                                ))}
                            </select>
                            <select className="input text-sm" value={houseworkFilters.status} onChange={(e) => setHouseworkFilters((current) => ({ ...current, status: e.target.value as AnalyticsHouseworkStatusFilter }))}>
                                {HOUSEWORK_STATUS_FILTER_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>
                    ) : isSingleKeyboardView ? (
                        <div className="flex flex-1 flex-wrap gap-3">
                            <div className="min-w-[220px] flex-[1.4]">
                                <input
                                    type="text"
                                    className="input text-sm"
                                    placeholder="Search by name..."
                                    value={keyboardFilters.search}
                                    onChange={(e) => setKeyboardFilters((current) => ({ ...current, search: e.target.value }))}
                                />
                            </div>
                            <MultiSelectFilter
                                className="min-w-[150px] flex-1"
                                label="Category"
                                allLabel="All categories"
                                options={KEYBOARD_FILTER_CATEGORIES.map((value) => ({ value, label: value }))}
                                selected={keyboardFilters.categories}
                                onChange={(values) => setKeyboardFilters((current) => ({ ...current, categories: values }))}
                            />
                            <MultiSelectFilter
                                className="min-w-[150px] flex-1"
                                label="Tag"
                                allLabel="All tags"
                                options={KEYBOARD_FILTER_TAGS.map((value) => ({ value, label: value }))}
                                selected={keyboardFilters.tags}
                                onChange={(values) => setKeyboardFilters((current) => ({ ...current, tags: values }))}
                            />
                            <MultiSelectFilter
                                className="min-w-[150px] flex-1"
                                label="Color"
                                allLabel="All colors"
                                options={KEYBOARD_FILTER_COLORS.map((value) => ({ value, label: value }))}
                                selected={keyboardFilters.colors}
                                onChange={(values) => setKeyboardFilters((current) => ({ ...current, colors: values }))}
                            />
                            <MultiSelectFilter
                                className="min-w-[170px] flex-1"
                                label="Price"
                                allLabel="All prices"
                                options={KEYBOARD_FILTER_PRICE_RANGES.map((range) => ({ value: range.value, label: range.label }))}
                                selected={keyboardFilters.priceRanges}
                                onChange={(values) => setKeyboardFilters((current) => ({ ...current, priceRanges: values as typeof current.priceRanges }))}
                            />
                        </div>
                    ) : isSingleFundsView ? (
                        <div className="grid grid-cols-1 gap-3 flex-1 md:grid-cols-6">
                            <select className="input text-sm" value={fundsFilters.type} onChange={(e) => setFundsFilters((current) => ({ ...current, type: e.target.value }))}>
                                <option value="">All Types</option>
                                {FUNDS_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                            <select className="input text-sm" value={fundsFilters.scope} onChange={(e) => setFundsFilters((current) => ({ ...current, scope: e.target.value }))}>
                                <option value="">All Scopes</option>
                                {FUNDS_SCOPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                            <select className="input text-sm" value={fundsFilters.category} onChange={(e) => setFundsFilters((current) => ({ ...current, category: e.target.value }))}>
                                <option value="">All Categories</option>
                                {FUNDS_CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                            <select className="input text-sm" value={fundsFilters.condition} onChange={(e) => setFundsFilters((current) => ({ ...current, condition: e.target.value }))}>
                                <option value="">All Conditions</option>
                                {FUNDS_CONDITION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                            <input type="date" className="input text-sm" value={fundsFilters.dateFrom} onChange={(e) => setFundsFilters((current) => ({ ...current, dateFrom: e.target.value }))} />
                            <input type="date" className="input text-sm" value={fundsFilters.dateTo} min={fundsFilters.dateFrom || undefined} onChange={(e) => setFundsFilters((current) => ({ ...current, dateTo: e.target.value }))} />
                        </div>
                    ) : (
                        <div className={`grid ${filterGridClass} gap-3 flex-1`}>
                            <select className="input text-sm" value={reportTimeRange} onChange={(e) => setReportTimeRange(e.target.value as ReportTimeRange)}>
                                {reportTimeRangeOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            {showTypeSelect && (
                                <select className="input text-sm" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
                                    <option value="">All Types</option>
                                    {typeFilterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                            )}
                            {showTypeInput && (
                                <input type="text" className="input text-sm" placeholder="Filter by asset type" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} />
                            )}
                            {showScopeSelect && (
                                <select className="input text-sm" value={filters.scope} onChange={(e) => setFilters({ ...filters, scope: e.target.value })}>
                                    <option value="">All Scopes</option>
                                    {scopeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                            )}
                            {showCategorySelect && (
                                <select className="input text-sm" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
                                    <option value="">All Categories</option>
                                    {expenseCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                                </select>
                            )}
                            {showCategoryInput && (
                                <input type="text" className="input text-sm" placeholder={`Filter by ${primaryTab === 'calendar' ? 'calendar' : primaryTab} category`} value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} />
                            )}
                        </div>
                    )}
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>View Type:</span>
                        <div className="flex gap-2 rounded-2xl p-1" style={{ backgroundColor: 'var(--color-bg)' }}>
                            {[
                                { value: 'CHARTS', label: '📈 Charts' },
                                { value: 'TABLES', label: '📋 Tables' },
                                { value: 'BOTH', label: '📊 Both' },
                            ].map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setViewType(option.value as AnalyticsViewType)}
                                    className={`px-4 py-2 rounded-2xl text-sm font-semibold transition-all ${viewType === option.value ? 'shadow-sm' : ''}`}
                                    style={{
                                        backgroundColor: viewType === option.value ? 'var(--color-primary)' : 'var(--color-surface)',
                                        color: viewType === option.value ? '#fff' : 'var(--color-text)',
                                    }}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                {isSingleExpenseView && expenseFilters.timePreset === 'CUSTOM' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input type="date" className="input text-sm" value={expenseFilters.dateFrom} onChange={(e) => setExpenseFilters((current) => ({ ...current, dateFrom: e.target.value }))} />
                        <input type="date" className="input text-sm" value={expenseFilters.dateTo} min={expenseFilters.dateFrom || undefined} onChange={(e) => setExpenseFilters((current) => ({ ...current, dateTo: e.target.value }))} />
                    </div>
                ) : reportTimeRange === 'CUSTOM' && !isSingleTaskView && !isSingleGoalView && !isSingleExpenseView && !isSingleHouseworkView && !isSingleKeyboardView && !isSingleFundsView && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input type="date" className="input text-sm" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
                        <input type="date" className="input text-sm" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
                    </div>
                )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-1 p-1 rounded-lg flex-wrap" style={{ backgroundColor: 'var(--color-bg)' }}>
                    {tabs.map((tab) => {
                        const selected = selectionMode === 'single'
                            ? singleSelectedTab === tab.id
                            : multiSelectedTabs.includes(tab.id);
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => toggleTab(tab.id)}
                                className={`py-2 px-4 rounded-md text-sm font-medium transition-all ${selected ? 'shadow-sm' : ''}`}
                                style={{
                                    backgroundColor: selected ? 'var(--color-surface)' : 'transparent',
                                    color: selected ? 'var(--color-text)' : 'var(--color-text-secondary)',
                                }}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                    <button
                        type="button"
                        onClick={selectAllTabs}
                        className={`py-2 px-4 rounded-md text-sm font-medium transition-all ${isAllSelected ? 'shadow-sm' : ''}`}
                        style={{
                            backgroundColor: isAllSelected ? 'var(--color-surface)' : 'transparent',
                            color: isAllSelected ? 'var(--color-text)' : 'var(--color-text-secondary)',
                        }}
                    >
                        All
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setMode('single')}
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${selectionMode === 'single' ? 'shadow-sm' : ''}`}
                        style={{
                            backgroundColor: selectionMode === 'single' ? 'var(--color-primary)' : 'var(--color-surface)',
                            color: selectionMode === 'single' ? '#fff' : 'var(--color-text)',
                        }}
                    >
                        Single Select
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('multi')}
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${selectionMode === 'multi' ? 'shadow-sm' : ''}`}
                        style={{
                            backgroundColor: selectionMode === 'multi' ? 'var(--color-primary)' : 'var(--color-surface)',
                            color: selectionMode === 'multi' ? '#fff' : 'var(--color-text)',
                        }}
                    >
                        Multi Select
                    </button>
                </div>
            </div>

            <div ref={reportContentRef} className="space-y-6">
            {selectedTabs.includes('project') && (
                <div className="space-y-6">
                    {showCharts && (
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="card p-5">
                                <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Project Tasks by Status</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={projectItemsByStatus || []}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                        <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip />
                                        <Bar dataKey="count" fill="#0f766e" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="card p-5">
                                <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Project Tasks by Type</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie data={projectItemsByType || []} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={100} label>
                                            {(projectItemsByType || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                    {showTables && (
                        <DataTableCard
                            title="Project Tasks"
                            columns={[
                                { key: 'title', label: 'Title' },
                                { key: 'project', label: 'Project' },
                                { key: 'type', label: 'Type' },
                                { key: 'status', label: 'Status' },
                                { key: 'priority', label: 'Priority' },
                                { key: 'deadline', label: 'Deadline', render: (value) => formatDisplayDate(value) },
                            ]}
                            rows={rawProjectItems || []}
                        />
                    )}
                </div>
            )}

            {selectedTabs.includes('tasks') && (
                <div className="space-y-6">
                    {showCharts && (
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="card p-5">
                                <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Task Navigator Items by Status</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={tasksByStatus || []}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                        <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip />
                                        <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="card p-5">
                                <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Task Status Distribution</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie data={tasksByStatus || []} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={100} label>
                                            {(tasksByStatus || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                    {showTables && (
                        <DataTableCard
                            title="Tasks"
                            columns={[
                                { key: 'title', label: 'Title' },
                                { key: 'taskType', label: 'Type' },
                                { key: 'status', label: 'Status' },
                                { key: 'priority', label: 'Priority' },
                                { key: 'dueDate', label: 'Due Date', render: (value) => formatDisplayDate(value) },
                                { key: 'expenseCategory', label: 'Category' },
                            ]}
                            rows={rawTasks || []}
                        />
                    )}
                </div>
            )}

            {selectedTabs.includes('calendar') && calendarOverview && (
                <div className="space-y-6">
                    {showCharts && (
                        <>
                            <div className="grid gap-4 md:grid-cols-4">
                                {[
                                    { label: 'Total Events', value: calendarOverview.total, color: '#4f46e5' },
                                    { label: 'Today', value: calendarOverview.today, color: '#059669' },
                                    { label: 'Upcoming', value: calendarOverview.upcoming, color: '#d97706' },
                                    { label: 'All Day', value: calendarOverview.allDay, color: '#7c3aed' },
                                ].map((item) => (
                                    <div key={item.label} className="card p-6 text-center">
                                        <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>{item.label}</p>
                                        <p className="text-4xl font-bold" style={{ color: item.color }}>{item.value}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="card p-5">
                                <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Events by Category</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie data={calendarByCategory || []} dataKey="count" nameKey="category" cx="50%" cy="50%" outerRadius={100} label>
                                            {(calendarByCategory || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </>
                    )}
                    {showTables && (
                        <DataTableCard
                            title="Calendar Events"
                            columns={[
                                { key: 'title', label: 'Title' },
                                { key: 'category', label: 'Category' },
                                { key: 'startDate', label: 'Start', render: (value) => formatDisplayDate(value) },
                                { key: 'endDate', label: 'End', render: (value) => formatDisplayDate(value) },
                                { key: 'location', label: 'Location' },
                                { key: 'allDay', label: 'All Day', render: (value) => (value ? 'Yes' : 'No') },
                            ]}
                            rows={rawCalendar || []}
                        />
                    )}
                </div>
            )}

            {selectedTabs.includes('goals') && (
                <div className="space-y-6">
                    {showCharts && (
                        <div className="card p-5">
                            <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Goal Completion Rates</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={goalCompletion || []} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                                    <YAxis dataKey="title" type="category" width={150} tick={{ fontSize: 12 }} />
                                    <Tooltip formatter={(v: any) => `${v}%`} />
                                    <Bar dataKey="completionRate" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                    {showTables && (
                        <DataTableCard
                            title="Goals"
                            columns={[
                                { key: 'title', label: 'Goal' },
                                { key: 'periodType', label: 'Period' },
                                { key: 'completionRate', label: 'Completion', render: (value) => `${value}%` },
                                { key: 'currentCount', label: 'Current' },
                                { key: 'targetCount', label: 'Target' },
                                { key: 'periodEnd', label: 'Period End', render: (value) => formatDisplayDate(value) },
                            ]}
                            rows={rawGoals || []}
                        />
                    )}
                </div>
            )}

            {selectedTabs.includes('housework') && houseworkStatus && (
                <div className="space-y-6">
                    {showCharts && (
                        <div className="grid gap-4 md:grid-cols-3">
                            {[
                                { label: 'Total Active', value: houseworkStatus.total, color: '#4f46e5' },
                                { label: 'On Track', value: houseworkStatus.onTrack, color: '#059669' },
                                { label: 'Overdue', value: houseworkStatus.overdue, color: '#dc2626' },
                            ].map((item) => (
                                <div key={item.label} className="card p-6 text-center">
                                    <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>{item.label}</p>
                                    <p className="text-4xl font-bold" style={{ color: item.color }}>{item.value}</p>
                                </div>
                            ))}
                        </div>
                    )}
                    {showTables && (
                        <DataTableCard
                            title="Housework Items"
                            columns={[
                                { key: 'title', label: 'Title' },
                                { key: 'frequencyType', label: 'Frequency' },
                                { key: 'assignee', label: 'Assignee' },
                                { key: 'nextDueDate', label: 'Next Due', render: (value) => formatDisplayDate(value) },
                                { key: 'lastCompletedDate', label: 'Last Completed', render: (value) => formatDisplayDate(value) },
                                { key: 'active', label: 'Active', render: (value) => (value ? 'Yes' : 'No') },
                            ]}
                            rows={rawHousework || []}
                        />
                    )}
                </div>
            )}

            {selectedTabs.includes('expenses') && (
                <div className="space-y-6">
                    {showCharts && (
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="card p-5">
                                <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>By Category</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie data={expenseSummary || []} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={100} label>
                                            {(expenseSummary || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={(v: any) => formatVND(Number(v))} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="card p-5">
                                <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Monthly Trend</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={expenseTrend || []}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip formatter={(v: any) => formatVND(Number(v))} />
                                        <Bar dataKey="total" fill="#d97706" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                    {showTables && (
                        <DataTableCard
                            title="Expenses"
                            columns={[
                                { key: 'date', label: 'Date', render: (value) => formatDisplayDate(value) },
                                { key: 'description', label: 'Description' },
                                { key: 'type', label: 'Type' },
                                { key: 'scope', label: 'Scope' },
                                { key: 'category', label: 'Category' },
                                { key: 'amount', label: 'Amount', render: (value) => formatVND(Number(value || 0)) },
                            ]}
                            rows={rawExpenses || []}
                        />
                    )}
                </div>
            )}

            {selectedTabs.includes('assets') && assetOverview && (
                <div className="space-y-6">
                    {showCharts && (
                        <>
                            <div className="grid gap-4 md:grid-cols-4">
                                {[
                                    { label: 'Total Assets', value: assetOverview.totalAssets, color: '#4f46e5' },
                                    { label: 'With Warranty', value: assetOverview.withWarranty, color: '#0891b2' },
                                    { label: 'Upcoming Maintenance', value: assetOverview.upcomingMaintenance, color: '#d97706' },
                                    { label: 'Maintenance Cost', value: formatVND(Number(assetOverview.totalMaintenanceCost || 0)), color: '#059669' },
                                ].map((item) => (
                                    <div key={item.label} className="card p-6 text-center">
                                        <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>{item.label}</p>
                                        <p className="text-2xl font-bold" style={{ color: item.color }}>{item.value}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="card p-5">
                                <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Assets by Type</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie data={assetsByType || []} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={100} label>
                                            {(assetsByType || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </>
                    )}
                    {showTables && (
                        <DataTableCard
                            title="Assets"
                            columns={[
                                { key: 'name', label: 'Name' },
                                { key: 'type', label: 'Type' },
                                { key: 'brand', label: 'Brand' },
                                { key: 'model', label: 'Model' },
                                { key: 'purchaseDate', label: 'Purchase Date', render: (value) => formatDisplayDate(value) },
                                { key: 'maintenanceCount', label: 'Maintenance Logs' },
                            ]}
                            rows={rawAssets || []}
                        />
                    )}
                </div>
            )}

            {selectedTabs.includes('learning') && (
                <div className="space-y-6">
                    {showCharts && (
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="card p-5">
                                <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Learning by Status</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={learningStatus || []}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                        <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip />
                                        <Bar dataKey="count" fill="#0891b2" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="card p-5">
                                <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Learning by Topic</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie data={learningTopics || []} dataKey="count" nameKey="topic" cx="50%" cy="50%" outerRadius={100} label>
                                            {(learningTopics || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                    {showTables && (
                        <DataTableCard
                            title="Learning Records"
                            columns={[
                                { key: 'title', label: 'Title' },
                                { key: 'topic', label: 'Topic' },
                                { key: 'status', label: 'Status' },
                                { key: 'progress', label: 'Progress', render: (value) => `${value ?? 0}%` },
                                { key: 'deadline', label: 'Deadline', render: (value) => formatDisplayDate(value) },
                            ]}
                            rows={rawLearning || []}
                        />
                    )}
                </div>
            )}

            {selectedTabs.includes('ideas') && (
                <div className="space-y-6">
                    {showCharts && (
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="card p-5">
                                <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Ideas by Status</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={ideaStatus || []}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                        <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip />
                                        <Bar dataKey="count" fill="#db2777" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="card p-5">
                                <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Ideas by Topic</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie data={ideaTopics || []} dataKey="count" nameKey="topic" cx="50%" cy="50%" outerRadius={100} label>
                                            {(ideaTopics || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                    {showTables && (
                        <DataTableCard
                            title="Ideas"
                            columns={[
                                { key: 'title', label: 'Title' },
                                { key: 'topic', label: 'Topic' },
                                { key: 'category', label: 'Category' },
                                { key: 'status', label: 'Status' },
                                { key: 'createdAt', label: 'Created', render: (value) => formatDisplayDate(value) },
                            ]}
                            rows={rawIdeas || []}
                        />
                    )}
                </div>
            )}
            {selectedTabs.includes('cakeo') && (
                <div className="card p-5">
                    <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Ca Keo Analytics</h3>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Ca Keo analytics content is not added yet.</p>
                </div>
            )}
            {selectedTabs.includes('keyboard') && (
                <div className="space-y-6">
                    {showCharts && (
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="grid grid-cols-2 gap-4 md:col-span-2">
                                <div className="card p-4"><div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Kit</div><div className="text-2xl font-bold" style={{ color: '#2563eb' }}>{formatVND(keyboardSummary.kit)}</div></div>
                                <div className="card p-4"><div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Keycap</div><div className="text-2xl font-bold" style={{ color: '#16a34a' }}>{formatVND(keyboardSummary.keycap)}</div></div>
                                <div className="card p-4"><div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Accessories</div><div className="text-2xl font-bold" style={{ color: '#6b7280' }}>{formatVND(keyboardSummary.accessories)}</div></div>
                                <div className="card p-4"><div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Total</div><div className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>{formatVND(keyboardSummary.total)}</div></div>
                            </div>
                            <div className="card p-5 md:col-span-2">
                                <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Keyboard by Category</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={keyboardCategoryChart}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                        <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip />
                                        <Bar dataKey="count" fill="#0f766e" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                    {showTables && (
                        <DataTableCard
                            title="Keyboard Items"
                            columns={tableConfigs.keyboard.columns}
                            rows={keyboardAnalyticsRows}
                        />
                    )}
                </div>
            )}
            {selectedTabs.includes('funds') && (
                <div className="space-y-6">
                    {showCharts && (
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="grid grid-cols-2 gap-4 md:col-span-2">
                                <div className="card p-4"><div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Buy</div><div className="text-2xl font-bold" style={{ color: 'var(--color-danger)' }}>{formatVND(fundsSummary.buy)}</div></div>
                                <div className="card p-4"><div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Sell</div><div className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>{formatVND(fundsSummary.sell)}</div></div>
                                <div className="card p-4"><div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Top-up</div><div className="text-2xl font-bold" style={{ color: '#2563eb' }}>{formatVND(fundsSummary.topUp)}</div></div>
                                <div className="card p-4"><div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Net</div><div className="text-2xl font-bold" style={{ color: fundsSummary.net < 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{formatVND(fundsSummary.net)}</div></div>
                            </div>
                            <div className="card p-5 md:col-span-2">
                                <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Funds by Type</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={fundsTypeChart}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                        <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip />
                                        <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                    {showTables && (
                        <DataTableCard
                            title="Fund Transactions"
                            columns={tableConfigs.funds.columns}
                            rows={fundsAnalyticsRows}
                        />
                    )}
                </div>
            )}
            </div>
        </div>
    );
}
