import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { useAuthStore } from '../stores/auth';
import {
    FolderKanban, Home, Calendar, DollarSign,
    AlertTriangle, Target, TrendingUp, CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';

export default function DashboardPage() {
    const { user } = useAuthStore();
    const { data, isLoading } = useQuery({
        queryKey: ['dashboard'],
        queryFn: async () => (await api.get('/dashboard')).data.data,
    });

    if (isLoading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="card p-5 h-24 bg-gray-100" />
                    ))}
                </div>
            </div>
        );
    }

    const s = data?.summary || {};

    const cards = [
        { label: 'Tasks This Week', value: s.tasksThisWeek, icon: FolderKanban, color: '#4f46e5', bg: '#eef2ff' },
        { label: 'Housework Due', value: s.houseworkThisWeek, icon: Home, color: '#059669', bg: '#ecfdf5' },
        { label: 'Upcoming Events', value: s.upcomingEventsCount, icon: Calendar, color: '#7c3aed', bg: '#f5f3ff' },
        { label: 'Overdue Items', value: (s.overdueTasks || 0) + (s.overdueHousework || 0), icon: AlertTriangle, color: '#dc2626', bg: '#fef2f2' },
    ];

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            {/* Greeting */}
            <div>
                <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
                    Welcome back, {user?.name?.split(' ')[0]} 👋
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                    {format(new Date(), 'EEEE, MMMM d, yyyy')}
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {cards.map((c) => (
                    <div key={c.label} className="card p-5 animate-slide-up">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>{c.label}</p>
                                <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value ?? 0}</p>
                            </div>
                            <div className="p-2 rounded-lg" style={{ backgroundColor: c.bg }}>
                                <c.icon className="w-5 h-5" style={{ color: c.color }} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Active Goals */}
                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Target className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                        <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Active Goals</h3>
                    </div>
                    <div className="space-y-3">
                        {(data?.goals || []).length === 0 && (
                            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No active goals</p>
                        )}
                        {(data?.goals || []).map((g: any) => (
                            <div key={g.id} className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{g.title}</p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${Math.min(100, (g.currentCount / g.targetCount) * 100)}%`,
                                                    background: g.currentCount >= g.targetCount
                                                        ? 'linear-gradient(90deg, #059669, #10b981)'
                                                        : 'linear-gradient(90deg, var(--color-primary), #7c3aed)',
                                                }}
                                            />
                                        </div>
                                        <span className="text-xs font-medium whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                                            {g.currentCount}/{g.targetCount}
                                        </span>
                                    </div>
                                </div>
                                {g.currentCount >= g.targetCount && (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Upcoming Events */}
                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Calendar className="w-5 h-5" style={{ color: '#7c3aed' }} />
                        <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Upcoming Events</h3>
                    </div>
                    <div className="space-y-3">
                        {(data?.upcomingEvents || []).length === 0 && (
                            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No upcoming events</p>
                        )}
                        {(data?.upcomingEvents || []).map((e: any) => (
                            <div key={e.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                                <div className="w-1 h-10 rounded-full" style={{ backgroundColor: e.color || 'var(--color-primary)' }} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{e.title}</p>
                                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                        {format(new Date(e.startDate), 'EEE, MMM d · h:mm a')}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Expenses */}
                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <DollarSign className="w-5 h-5" style={{ color: '#d97706' }} />
                        <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Recent Expenses</h3>
                    </div>
                    <div className="space-y-3">
                        {(data?.recentExpenses || []).length === 0 && (
                            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No expenses yet</p>
                        )}
                        {(data?.recentExpenses || []).map((e: any) => (
                            <div key={e.id} className="flex items-center justify-between py-1">
                                <div>
                                    <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{e.description}</p>
                                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                        {e.user?.name} · {format(new Date(e.date), 'MMM d')}
                                    </p>
                                </div>
                                <span className="text-sm font-semibold" style={{ color: 'var(--color-danger)' }}>
                                    ${e.amount.toFixed(2)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Pinned Tasks */}
                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <FolderKanban className="w-5 h-5" style={{ color: '#4f46e5' }} />
                        <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Pinned Tasks</h3>
                    </div>
                    <div className="space-y-3">
                        {(data?.pinnedTasks || []).length === 0 && (
                            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No pinned tasks</p>
                        )}
                        {(data?.pinnedTasks || []).map((p: any) => (
                            <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{p.title}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`badge ${p.status === 'DONE' ? 'badge-success' : p.status === 'IN_PROGRESS' ? 'badge-primary' : 'badge-warning'}`}>
                                            {p.status.replace('_', ' ')}
                                        </span>
                                        {p.assignee && (
                                            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{p.assignee.name}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
