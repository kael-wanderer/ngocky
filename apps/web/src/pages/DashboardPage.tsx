import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { useAuthStore } from '../stores/auth';
import {
    FolderKanban, Home, Calendar, DollarSign,
    AlertTriangle, Target, CheckCircle2, Pin, Package, ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';

const CATEGORY_OPTIONS = ['goal', 'project', 'housework', 'calendar', 'expense', 'assets'] as const;
type Category = typeof CATEGORY_OPTIONS[number];
const categoryLabels: Record<Category, string> = {
    goal: 'Goal',
    project: 'Project',
    housework: 'Housework',
    calendar: 'Calendar',
    expense: 'Expense',
    assets: 'Assets',
};

const TIME_OPTIONS = [
    { value: 'THIS_WEEK', label: 'This week' },
    { value: 'NEXT_WEEK', label: 'Next week' },
    { value: 'THIS_MONTH', label: 'This month' },
    { value: 'NEXT_MONTH', label: 'Next month' },
] as const;

type TimeRange = typeof TIME_OPTIONS[number]['value'];

const formatVND = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);

export default function DashboardPage() {
    const { user } = useAuthStore();
    const [timeRange, setTimeRange] = useState<TimeRange>('THIS_WEEK');
    const [categories, setCategories] = useState<Category[]>([...CATEGORY_OPTIONS]);

    const { data, isLoading } = useQuery({
        queryKey: ['dashboard', timeRange],
        queryFn: async () => (await api.get(`/dashboard?timeRange=${timeRange}`)).data.data,
    });

    const s = data?.summary || {};

    const cards = [
        { label: 'Tasks This Week', value: s.tasksThisWeek, icon: FolderKanban, color: '#4f46e5', bg: '#eef2ff' },
        { label: 'Housework Due', value: s.houseworkThisWeek, icon: Home, color: '#059669', bg: '#ecfdf5' },
        { label: 'Upcoming Events', value: s.upcomingEventsCount, icon: Calendar, color: '#7c3aed', bg: '#f5f3ff' },
        { label: 'Overdue Items', value: (s.overdueTasks || 0) + (s.overdueHousework || 0), icon: AlertTriangle, color: '#dc2626', bg: '#fef2f2' },
    ];

    const sectionVisible = (category: Category) => categories.includes(category);

    const showPinnedItems = useMemo(() => {
        return categories.some((c) => c === 'goal' || c === 'project' || c === 'housework');
    }, [categories]);

    const toggleCategory = (c: Category) => {
        setCategories((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
    };

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

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div>
                <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
                    Welcome back, {user?.name?.split(' ')[0]} 👋
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                    {format(new Date(), 'EEEE, MMMM d, yyyy')}
                </p>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="label">Time</label>
                        <select className="input" value={timeRange} onChange={(e) => setTimeRange(e.target.value as TimeRange)}>
                            {TIME_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="label">Category</label>
                        <details className="relative">
                            <summary className="input list-none cursor-pointer flex items-center justify-between">
                                <span className="text-sm" style={{ color: 'var(--color-text)' }}>
                                    {categories.length === CATEGORY_OPTIONS.length
                                        ? 'All categories'
                                        : categories.length === 0
                                            ? 'No category selected'
                                            : `${categories.length} selected`}
                                </span>
                                <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                            </summary>
                            <div className="absolute z-20 mt-2 w-full card p-2 max-h-64 overflow-auto" style={{ border: '1px solid var(--color-border)' }}>
                                {CATEGORY_OPTIONS.map((c) => (
                                    <label key={c} className="flex items-center gap-2 px-2 py-2 rounded hover:bg-gray-50 cursor-pointer text-sm">
                                        <input
                                            type="checkbox"
                                            checked={categories.includes(c)}
                                            onChange={() => toggleCategory(c)}
                                        />
                                        <span style={{ color: 'var(--color-text)' }}>{categoryLabels[c]}</span>
                                    </label>
                                ))}
                            </div>
                        </details>
                    </div>
                </div>
            </div>

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
                {sectionVisible('goal') && (
                    <div className="card p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Target className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Goal</h3>
                        </div>
                        <div className="space-y-3">
                            {(data?.goals || []).length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No goals in selected time</p>
                            )}
                            {(data?.goals || []).map((g: any) => {
                                const progressPct = g.targetCount > 0 ? (g.currentCount / g.targetCount) * 100 : 0;
                                return (
                                    <div key={g.id} className="flex items-center gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{g.title}</p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-500"
                                                        style={{
                                                            width: `${Math.min(100, progressPct)}%`,
                                                            background: g.currentCount >= g.targetCount
                                                                ? 'linear-gradient(90deg, #059669, #10b981)'
                                                                : 'linear-gradient(90deg, var(--color-primary), #7c3aed)',
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-xs font-medium whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                                                    {Math.round(progressPct)}%
                                                </span>
                                            </div>
                                        </div>
                                        {g.currentCount >= g.targetCount && (
                                            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {sectionVisible('calendar') && (
                    <div className="card p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Calendar className="w-5 h-5" style={{ color: '#7c3aed' }} />
                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Upcoming Event</h3>
                        </div>
                        <div className="space-y-3">
                            {(data?.upcomingEvents || []).length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No events in selected time</p>
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
                )}

                {sectionVisible('project') && (
                    <div className="card p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <FolderKanban className="w-5 h-5" style={{ color: '#d97706' }} />
                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Project</h3>
                        </div>
                        <div className="space-y-3">
                            {(data?.dueProjects || []).length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No project deadlines in selected time</p>
                            )}
                            {(data?.dueProjects || []).map((p: any) => (
                                <div key={p.id} className="flex items-center justify-between py-1 gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{p.name}</p>
                                        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                            {p.dueTaskCount} task{p.dueTaskCount > 1 ? 's' : ''} due
                                        </p>
                                    </div>
                                    {p.earliestDeadline && (
                                        <span className="text-xs font-semibold whitespace-nowrap" style={{ color: new Date(p.earliestDeadline) < new Date() ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                                            {format(new Date(p.earliestDeadline), 'MMM d')}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {sectionVisible('project') && (
                    <div className="card p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <FolderKanban className="w-5 h-5" style={{ color: '#4f46e5' }} />
                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Task</h3>
                        </div>
                        <div className="space-y-3">
                            {(data?.dueTasks || []).length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No tasks with deadline in selected time</p>
                            )}
                            {(data?.dueTasks || []).map((t: any) => (
                                <div key={t.id} className="flex items-center justify-between py-1 gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{t.title}</p>
                                        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                            {t.project?.name || 'Project'}{t.assignee?.name ? ` · ${t.assignee.name}` : ''}
                                        </p>
                                    </div>
                                    {t.deadline && (
                                        <span className="text-xs font-semibold whitespace-nowrap" style={{ color: new Date(t.deadline) < new Date() ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                                            {format(new Date(t.deadline), 'MMM d')}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {sectionVisible('housework') && (
                    <div className="card p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Home className="w-5 h-5" style={{ color: '#059669' }} />
                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Housework</h3>
                        </div>
                        <div className="space-y-3">
                            {(data?.dueHousework || []).length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No housework due in selected time</p>
                            )}
                            {(data?.dueHousework || []).map((h: any) => (
                                <div key={h.id} className="flex items-center justify-between py-1 gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{h.title}</p>
                                        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                            {h.assignee?.name || 'Unassigned'}
                                        </p>
                                    </div>
                                    {h.nextDueDate && (
                                        <span className="text-xs font-semibold whitespace-nowrap" style={{ color: new Date(h.nextDueDate) < new Date() ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                                            {format(new Date(h.nextDueDate), 'MMM d')}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {showPinnedItems && (
                    <div className="card p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Pin className="w-5 h-5" style={{ color: '#dc2626' }} />
                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Pinned Items</h3>
                        </div>
                        <div className="space-y-3">
                            {(data?.pinnedItems || []).length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No pinned items in selected time</p>
                            )}
                            {(data?.pinnedItems || []).map((p: any) => (
                                <div key={`${p.type}-${p.id}`} className="flex items-center justify-between py-1 gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{p.title}</p>
                                        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                            {p.type}{p.meta ? ` · ${p.meta}` : ''}
                                        </p>
                                    </div>
                                    {p.date && (
                                        <span className="text-xs font-semibold whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                                            {format(new Date(p.date), 'MMM d')}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {sectionVisible('expense') && (
                    <div className="card p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <DollarSign className="w-5 h-5" style={{ color: '#d97706' }} />
                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Expense</h3>
                        </div>
                        <div className="space-y-3">
                            {(data?.expenses || []).length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No expenses in selected time</p>
                            )}
                            {(data?.expenses || []).map((e: any) => (
                                <div key={e.id} className="flex items-center justify-between py-1 gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{e.description}</p>
                                        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                            {e.user?.name || 'User'} · {format(new Date(e.date), 'MMM d')}
                                        </p>
                                    </div>
                                    <span className="text-sm font-semibold whitespace-nowrap" style={{ color: 'var(--color-danger)' }}>
                                        {formatVND(e.amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {sectionVisible('assets') && (
                    <div className="card p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Package className="w-5 h-5" style={{ color: '#0ea5e9' }} />
                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Assets</h3>
                        </div>
                        <div className="space-y-3">
                            {(data?.dueAssets || []).length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No asset due dates in selected time</p>
                            )}
                            {(data?.dueAssets || []).map((a: any) => (
                                <div key={a.id} className="flex items-center justify-between py-1 gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{a.asset?.name || 'Asset'}</p>
                                        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                            {a.description || 'Maintenance'}{a.user?.name ? ` · ${a.user.name}` : ''}
                                        </p>
                                    </div>
                                    {a.nextRecommendedDate && (
                                        <span className="text-xs font-semibold whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                                            {format(new Date(a.nextRecommendedDate), 'MMM d')}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
