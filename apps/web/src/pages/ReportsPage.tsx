import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#4f46e5', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#db2777', '#84cc16'];
const formatVND = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);

export default function ReportsPage() {
    const [activeTab, setActiveTab] = useState('tasks');

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
        queryKey: ['reports', 'expense-summary'],
        queryFn: async () => (await api.get('/reports/expense-summary?groupBy=category')).data.data,
    });

    const { data: expenseTrend } = useQuery({
        queryKey: ['reports', 'expense-trend'],
        queryFn: async () => (await api.get('/reports/expense-summary?groupBy=monthly')).data.data,
    });

    const tabs = [
        { id: 'tasks', label: 'Tasks' },
        { id: 'goals', label: 'Goals' },
        { id: 'housework', label: 'Housework' },
        { id: 'expenses', label: 'Expenses' },
    ];

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex items-center gap-2">
                <BarChart3 className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Reports</h2>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${activeTab === tab.id ? 'shadow-sm' : ''
                            }`}
                        style={{
                            backgroundColor: activeTab === tab.id ? 'var(--color-surface)' : 'transparent',
                            color: activeTab === tab.id ? 'var(--color-text)' : 'var(--color-text-secondary)',
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tasks Report */}
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

            {/* Goals Report */}
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

            {/* Housework Report */}
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

            {/* Expenses Report */}
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
        </div>
    );
}
