import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { BarChart3, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#4f46e5', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#db2777', '#84cc16'];
const formatVND = (amount: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(amount) + ' VND';
const expenseCategories = ['Food', 'Utilities', 'Healthcare', 'Shopping', 'Transport', 'Home Maintenance', 'Education', 'AI', 'Entertainment', 'Other', 'Salary', 'Top-up', 'Sell'];
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

type ReportTimeRange = 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM';

export default function ReportsPage() {
    const [activeTab, setActiveTab] = useState('tasks');
    const [reportTimeRange, setReportTimeRange] = useState<ReportTimeRange>('MONTH');
    const [expenseFilters, setExpenseFilters] = useState({ type: '', scope: '', category: '', dateFrom: '', dateTo: '' });

    const expenseQuery = useMemo(() => {
        const params = new URLSearchParams();
        params.set('groupBy', 'category');
        if (reportTimeRange !== 'CUSTOM') params.set('timeRange', reportTimeRange);
        if (expenseFilters.type) params.set('type', expenseFilters.type);
        if (expenseFilters.scope) params.set('scope', expenseFilters.scope);
        if (expenseFilters.category) params.set('category', expenseFilters.category);
        if (reportTimeRange === 'CUSTOM' && expenseFilters.dateFrom) params.set('dateFrom', new Date(`${expenseFilters.dateFrom}T00:00:00`).toISOString());
        if (reportTimeRange === 'CUSTOM' && expenseFilters.dateTo) params.set('dateTo', new Date(`${expenseFilters.dateTo}T23:59:59.999`).toISOString());
        return params.toString();
    }, [reportTimeRange, expenseFilters]);

    const expenseTrendQuery = useMemo(() => {
        const params = new URLSearchParams(expenseQuery);
        params.set('groupBy', 'monthly');
        return params.toString();
    }, [expenseQuery]);

    const { data: tasksByStatus } = useQuery({
        queryKey: ['reports', 'tasks-by-status'],
        queryFn: async () => (await api.get('/reports/tasks-by-status')).data.data,
    });

    const { data: goalCompletion } = useQuery({
        queryKey: ['reports', 'goal-completion'],
        queryFn: async () => (await api.get('/reports/goal-completion')).data.data,
    });

    const { data: houseworkStatus } = useQuery({
        queryKey: ['reports', 'housework-status'],
        queryFn: async () => (await api.get('/reports/housework-status')).data.data,
    });

    const { data: expenseSummary } = useQuery({
        queryKey: ['reports', 'expense-summary', expenseQuery],
        queryFn: async () => (await api.get(`/reports/expense-summary?${expenseQuery}`)).data.data,
    });

    const { data: expenseTrend } = useQuery({
        queryKey: ['reports', 'expense-trend', expenseTrendQuery],
        queryFn: async () => (await api.get(`/reports/expense-summary?${expenseTrendQuery}`)).data.data,
    });

    const { data: learningStatus } = useQuery({
        queryKey: ['reports', 'learning-status'],
        queryFn: async () => (await api.get('/reports/learning-status')).data.data,
    });

    const { data: learningTopics } = useQuery({
        queryKey: ['reports', 'learning-topics'],
        queryFn: async () => (await api.get('/reports/learning-topics')).data.data,
    });

    const { data: ideaStatus } = useQuery({
        queryKey: ['reports', 'idea-status'],
        queryFn: async () => (await api.get('/reports/ideas-status')).data.data,
    });

    const { data: ideaTopics } = useQuery({
        queryKey: ['reports', 'idea-topics'],
        queryFn: async () => (await api.get('/reports/idea-topics')).data.data,
    });

    const tabs = [
        { id: 'tasks', label: 'Tasks' },
        { id: 'goals', label: 'Goals' },
        { id: 'housework', label: 'Housework' },
        { id: 'expenses', label: 'Expenses' },
        { id: 'learning', label: 'Learning' },
        { id: 'ideas', label: 'Ideas' },
    ];

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex items-center gap-2">
                <BarChart3 className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Analytics</h2>
            </div>

            <div className="card p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Expense Filters</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <select className="input text-sm" value={reportTimeRange} onChange={(e) => setReportTimeRange(e.target.value as ReportTimeRange)}>
                        <option value="TODAY">Today</option>
                        <option value="WEEK">Week</option>
                        <option value="MONTH">Month</option>
                        <option value="CUSTOM">Custom</option>
                    </select>
                    <select className="input text-sm" value={expenseFilters.type} onChange={(e) => setExpenseFilters({ ...expenseFilters, type: e.target.value })}>
                        <option value="">All Types</option>
                        {typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <select className="input text-sm" value={expenseFilters.scope} onChange={(e) => setExpenseFilters({ ...expenseFilters, scope: e.target.value })}>
                        <option value="">All Scopes</option>
                        {scopeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <select className="input text-sm" value={expenseFilters.category} onChange={(e) => setExpenseFilters({ ...expenseFilters, category: e.target.value })}>
                        <option value="">All Categories</option>
                        {expenseCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                </div>
                {reportTimeRange === 'CUSTOM' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input type="date" className="input text-sm" value={expenseFilters.dateFrom} onChange={(e) => setExpenseFilters({ ...expenseFilters, dateFrom: e.target.value })} />
                        <input type="date" className="input text-sm" value={expenseFilters.dateTo} min={expenseFilters.dateFrom || undefined} onChange={(e) => setExpenseFilters({ ...expenseFilters, dateTo: e.target.value })} />
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

            {activeTab === 'tasks' && (
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="card p-5">
                        <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Tasks by Status</h3>
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
                        <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Status Distribution</h3>
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
