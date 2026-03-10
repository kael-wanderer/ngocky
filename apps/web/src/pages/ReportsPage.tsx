import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { BarChart3, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#4f46e5', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#db2777', '#84cc16'];
const formatVND = (amount: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(amount) + ' VND';
const expenseCategories = ['AI', 'Ca Keo', 'Food', 'Gift', 'Healthcare', 'House', 'Insurance', 'Maintenance', 'Education', 'Entertainment', 'Family Support', 'Salary', 'Sell', 'Shopping', 'Top-up', 'Transportation', 'Utilities', 'Other'];
const scopeOptions = [
    { value: 'PERSONAL', label: 'Personal' },
    { value: 'FAMILY', label: 'Family' },
    { value: 'KEO', label: 'Keo' },
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

type ReportTimeRange = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM';

export default function ReportsPage() {
    const [activeTab, setActiveTab] = useState('tasks');
    const [reportTimeRange, setReportTimeRange] = useState<ReportTimeRange>('ALL');
    const [filters, setFilters] = useState({ type: '', scope: '', category: '', dateFrom: '', dateTo: '' });

    useEffect(() => {
        setFilters((current) => ({ ...current, type: '', scope: '', category: '' }));
    }, [activeTab]);

    const baseQuery = useMemo(() => {
        const params = new URLSearchParams();
        params.set('groupBy', 'category');
        if (!['ALL', 'CUSTOM'].includes(reportTimeRange)) params.set('timeRange', reportTimeRange);
        if (filters.type) params.set('type', filters.type);
        if (filters.scope) params.set('scope', filters.scope);
        if (filters.category) params.set('category', filters.category);
        if (reportTimeRange === 'CUSTOM' && filters.dateFrom) params.set('dateFrom', new Date(`${filters.dateFrom}T00:00:00`).toISOString());
        if (reportTimeRange === 'CUSTOM' && filters.dateTo) params.set('dateTo', new Date(`${filters.dateTo}T23:59:59.999`).toISOString());
        return params.toString();
    }, [reportTimeRange, filters]);

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

    const tabs = [
        { id: 'project', label: 'Project' },
        { id: 'tasks', label: 'Tasks' },
        { id: 'goals', label: 'Goals' },
        { id: 'calendar', label: 'Calendar' },
        { id: 'housework', label: 'Housework' },
        { id: 'expenses', label: 'Expenses' },
        { id: 'assets', label: 'Appliances & Devices' },
        { id: 'learning', label: 'Learning' },
        { id: 'ideas', label: 'Ideas' },
    ];

    const typeFilterOptions =
        activeTab === 'project' ? projectItemTypeOptions
            : activeTab === 'tasks' ? taskTypeOptions
                : activeTab === 'expenses' ? typeOptions
                    : [];
    const showTypeSelect = ['project', 'tasks', 'expenses'].includes(activeTab);
    const showTypeInput = activeTab === 'assets';
    const showScopeSelect = activeTab === 'expenses';
    const showCategorySelect = activeTab === 'expenses';
    const showCategoryInput = ['project', 'calendar', 'ideas'].includes(activeTab);
    const filterGridCols = 1 + (showTypeSelect || showTypeInput ? 1 : 0) + (showScopeSelect ? 1 : 0) + (showCategorySelect || showCategoryInput ? 1 : 0);
    const filterGridClass = filterGridCols >= 4
        ? 'grid-cols-1 md:grid-cols-4'
        : filterGridCols === 3
            ? 'grid-cols-1 md:grid-cols-3'
            : filterGridCols === 2
                ? 'grid-cols-1 md:grid-cols-2'
                : 'grid-cols-1';

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex items-center gap-2">
                <BarChart3 className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Analytics</h2>
            </div>

            <div className="card p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Analytics Filters · Time Scope</span>
                </div>
                <div className={`grid ${filterGridClass} gap-3`}>
                    <select className="input text-sm" value={reportTimeRange} onChange={(e) => setReportTimeRange(e.target.value as ReportTimeRange)}>
                        <option value="ALL">All Time</option>
                        <option value="TODAY">Today</option>
                        <option value="WEEK">Week</option>
                        <option value="MONTH">Month</option>
                        <option value="CUSTOM">Custom</option>
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
                        <input type="text" className="input text-sm" placeholder={`Filter by ${activeTab === 'calendar' ? 'calendar' : activeTab} category`} value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} />
                    )}
                </div>
                {reportTimeRange === 'CUSTOM' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input type="date" className="input text-sm" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
                        <input type="date" className="input text-sm" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
                    </div>
                )}
            </div>

            <div className="flex gap-1 p-1 rounded-lg flex-wrap" style={{ backgroundColor: 'var(--color-bg)' }}>
                {tabs.map((tab) => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`py-2 px-4 rounded-md text-sm font-medium transition-all ${activeTab === tab.id ? 'shadow-sm' : ''}`} style={{ backgroundColor: activeTab === tab.id ? 'var(--color-surface)' : 'transparent', color: activeTab === tab.id ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'project' && (
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="card p-5">
                        <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Project Items by Status</h3>
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
                        <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Project Items by Type</h3>
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

            {activeTab === 'tasks' && (
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

            {activeTab === 'calendar' && calendarOverview && (
                <div className="space-y-6">
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
                </div>
            )}

            {activeTab === 'goals' && (
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

            {activeTab === 'housework' && houseworkStatus && (
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

            {activeTab === 'expenses' && (
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

            {activeTab === 'assets' && assetOverview && (
                <div className="space-y-6">
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
                </div>
            )}

            {activeTab === 'learning' && (
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

            {activeTab === 'ideas' && (
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
        </div>
    );
}
