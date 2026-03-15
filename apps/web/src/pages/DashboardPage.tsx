import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useNavigate } from 'react-router-dom';
import {
    FolderKanban, Home, Calendar, Wallet,
    AlertTriangle, Target, CheckCircle2, Pin, Package, ChevronDown,
    Lightbulb, Trophy, Microwave, GraduationCap,
    Filter, Keyboard, HeartPulse, TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';

// Order: Personal → Family → Hobby
const CATEGORY_OPTIONS = ['goal', 'task', 'project', 'idea', 'healthbook', 'housework', 'calendar', 'expense', 'assets', 'keyboard', 'funds', 'learning'] as const;
type Category = typeof CATEGORY_OPTIONS[number];
const categoryLabels: Record<Category, string> = {
    goal: 'Goals', task: 'Tasks', project: 'Projects', learning: 'Learning', idea: 'Ideas', healthbook: 'Healthbook',
    housework: 'Housework', calendar: 'Calendar', expense: 'Expenses', assets: 'Assets',
    keyboard: 'Keyboard', funds: 'Funds',
};
const CATEGORY_GROUPS: Array<{ label: string; items: Category[] }> = [
    { label: 'Personal', items: ['goal', 'task', 'project', 'idea', 'healthbook'] },
    { label: 'Family', items: ['housework', 'calendar', 'expense', 'assets'] },
    { label: 'Hobby', items: ['keyboard', 'funds', 'learning'] },
];

const TIME_OPTIONS = [
    { value: 'TODAY', label: 'Today' },
    { value: 'THIS_WEEK', label: 'This week' },
    { value: 'NEXT_WEEK', label: 'Next week' },
    { value: 'THIS_MONTH', label: 'This month' },
    { value: 'NEXT_MONTH', label: 'Next month' },
] as const;
type TimeRange = typeof TIME_OPTIONS[number]['value'];

const taskCardLabels: Record<TimeRange, string> = {
    TODAY: 'Tasks Today',
    THIS_WEEK: 'Tasks This Week',
    NEXT_WEEK: 'Tasks Next Week',
    THIS_MONTH: 'Tasks This Month',
    NEXT_MONTH: 'Tasks Next Month',
};

type StatusFilter = 'ALL' | 'PENDING' | 'COMPLETED' | 'OVERDUE';
const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
    { value: 'ALL', label: 'All' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'OVERDUE', label: 'Overdue' },
];

type SectionId = Category;

const formatVND = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
const statusBadge = (label: string, tone: 'normal' | 'success' | 'warning' | 'danger' = 'normal') => {
    const colors = {
        normal: { color: '#475569', bg: '#f1f5f9' },
        success: { color: '#047857', bg: '#d1fae5' },
        warning: { color: '#92400e', bg: '#fef3c7' },
        danger: { color: '#b91c1c', bg: '#fee2e2' },
    }[tone];
    return (
        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ color: colors.color, backgroundColor: colors.bg }}>
            {label}
        </span>
    );
};

const getHouseworkStatus = (nextDueDate?: string | null) => {
    if (!nextDueDate) return { label: 'Unscheduled', color: '#6b7280', bg: '#f3f4f6' };
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const due = new Date(nextDueDate);
    if (due < todayStart) return { label: 'Overdue', color: '#b91c1c', bg: '#fee2e2' };
    if (due < tomorrowStart) return { label: 'Due today', color: '#92400e', bg: '#fef3c7' };
    return { label: 'Upcoming', color: '#065f46', bg: '#d1fae5' };
};


export default function DashboardPage() {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [timeRange, setTimeRange] = useState<TimeRange>('THIS_WEEK');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
    const [categories, setCategories] = useState<Category[]>([...CATEGORY_OPTIONS]);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [dashSearch, setDashSearch] = useState('');
    const [categoryOpen, setCategoryOpen] = useState(false);
    const categoryRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
                setCategoryOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const { data, isLoading } = useQuery({
        queryKey: ['dashboard', timeRange, statusFilter],
        queryFn: async () => (await api.get(`/dashboard?timeRange=${timeRange}&status=${statusFilter}`)).data.data,
        refetchInterval: autoRefresh ? 60000 : false,
        refetchIntervalInBackground: true,
    });

    const s = data?.summary || {};
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const cards = [
        { label: taskCardLabels[timeRange], value: s.tasksInRange ?? 0, icon: FolderKanban, color: '#4f46e5', bg: '#eef2ff', to: '/tasks' },
        { label: 'Housework Due', value: s.houseworkThisWeek, icon: Home, color: '#059669', bg: '#ecfdf5', to: '/housework' },
        { label: 'Upcoming Events', value: s.upcomingEventsCount, icon: Calendar, color: '#7c3aed', bg: '#f5f3ff', to: '/calendar' },
        { label: 'Overdue Items', value: s.overdueItemsTotal || 0, icon: AlertTriangle, color: '#dc2626', bg: '#fef2f2', to: '/' },
    ];

    const sectionVisible = (category: Category) => categories.includes(category);
    const toggleCategory = (c: Category) => {
        setCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
    };
    const checkAllGroup = (items: Category[]) => {
        setCategories(prev => [...prev, ...items.filter(c => !prev.includes(c))]);
    };
    const uncheckAllGroup = (items: Category[]) => {
        setCategories(prev => prev.filter(c => !items.includes(c)));
    };

    const searchLower = dashSearch.trim().toLowerCase();
    const applySearch = (items: any[], ...fields: string[]) =>
        !searchLower ? items : items.filter((item: any) => fields.some(f => item[f]?.toLowerCase?.().includes(searchLower)));

    const overdueByCategory = (type: string): Category => {
        if (type === 'PROJECT') return 'project';
        if (type === 'TASK') return 'task';
        if (type === 'HOUSEWORK') return 'housework';
        return 'project';
    };
    const filteredOverdueItems = (data?.overdueItems || []).filter((item: any) => categories.includes(overdueByCategory(item.type)));
    const dueTasks = data?.dueTasks || [];

    function openProjectTask(projectId?: string | null, taskId?: string | null) {
        if (projectId && taskId) {
            navigate(`/projects?boardId=${projectId}&taskId=${taskId}`);
            return;
        }
        if (projectId) {
            navigate(`/projects?boardId=${projectId}`);
            return;
        }
        navigate('/projects');
    }

    function openStandaloneTask(taskId?: string | null) {
        navigate(taskId ? `/tasks?editId=${taskId}` : '/tasks');
    }

    function resolveProjectId(taskId?: string | null, projectId?: string | null) {
        if (projectId) return projectId;
        if (!taskId) return null;

        const dueMatch = (data?.dueTasks || []).find((entry: any) => entry.id === taskId);
        if (dueMatch?.projectId) return dueMatch.projectId;

        const overdueMatch = (data?.overdueItems || []).find((entry: any) => entry.id === taskId);
        if (overdueMatch?.projectId) return overdueMatch.projectId;

        const pinnedMatch = (data?.pinnedItems || []).find((entry: any) => entry.id === taskId);
        if (pinnedMatch?.projectId) return pinnedMatch.projectId;

        return null;
    }

    function openTaskTarget(taskId?: string | null, projectId?: string | null) {
        const resolvedProjectId = resolveProjectId(taskId, projectId);
        if (resolvedProjectId) {
            openProjectTask(resolvedProjectId, taskId);
            return;
        }
        openStandaloneTask(taskId);
    }

    function openOverdueProjectItem(taskId?: string | null, projectId?: string | null) {
        if (projectId) {
            openProjectTask(projectId, taskId);
            return;
        }
        const matchedTask = dueTasks.find((entry: any) => entry.id === taskId);
        openTaskTarget(taskId, matchedTask?.projectId || null);
    }

    // Map section IDs to renderable elements
    function renderSection(id: SectionId): React.ReactNode {
        switch (id) {
            case 'goal':
                if (!sectionVisible('goal')) return null;
                return (
                    <div className="card p-5 h-full">
                        <div className="flex items-center gap-2 mb-4 pr-7">
                            <Trophy className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Goals</h3>
                        </div>
                        <div className="space-y-3">
                            {applySearch(data?.goals || [], 'title', 'description').length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No active goals</p>
                            )}
                            {applySearch(data?.goals || [], 'title', 'description').map((g: any) => {
                                const progressPct = g.targetCount > 0 ? (g.currentCount / g.targetCount) * 100 : 0;
                                return (
                                    <button key={g.id} className="w-full flex items-center gap-3 text-left hover:bg-gray-50 rounded p-1" onClick={() => navigate(`/goals?editId=${g.id}`)}>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{g.title}</p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                                                    <div className="h-full rounded-full transition-all duration-500" style={{
                                                        width: `${Math.min(100, progressPct)}%`,
                                                        background: g.currentCount >= g.targetCount
                                                            ? 'linear-gradient(90deg, #059669, #10b981)'
                                                            : 'linear-gradient(90deg, var(--color-primary), #7c3aed)',
                                                    }} />
                                                </div>
                                                <span className="text-xs font-medium whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                                                    {g.currentCount}/{g.targetCount} · {Math.round(progressPct)}%
                                                </span>
                                            </div>
                                        </div>
                                        {g.currentCount >= g.targetCount && <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );

            case 'calendar':
                if (!sectionVisible('calendar')) return null;
                return (
                    <div className="card p-5 h-full">
                        <div className="flex items-center gap-2 mb-4 pr-7">
                            <Calendar className="w-5 h-5" style={{ color: '#7c3aed' }} />
                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Calendar</h3>
                        </div>
                        <div className="space-y-3">
                            {applySearch(data?.upcomingEvents || [], 'title').length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No events in selected time</p>
                            )}
                            {applySearch(data?.upcomingEvents || [], 'title').map((e: any) => (
                                <button key={e.id} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors text-left" onClick={() => navigate(`/calendar?eventId=${e.id}`)}>
                                    <div className="w-1 h-10 rounded-full" style={{ backgroundColor: e.color || 'var(--color-primary)' }} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{e.title}</p>
                                        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                            {format(new Date(e.startDate), 'EEE, MMM d · h:mm a')}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                );

            case 'project':
                if (!sectionVisible('project')) return null;
                return (
                    <div className="card p-5 h-full">
                        <div className="flex items-center gap-2 mb-4 pr-7">
                            <FolderKanban className="w-5 h-5" style={{ color: '#d97706' }} />
                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Projects</h3>
                        </div>
                        <div className="space-y-3">
                            {applySearch(data?.dueProjects || [], 'name').length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No project deadlines in selected time</p>
                            )}
                            {applySearch(data?.dueProjects || [], 'name').map((p: any) => (
                                <button key={p.id} className="w-full flex items-center justify-between py-1 gap-3 text-left hover:bg-gray-50 rounded px-1" onClick={() => openProjectTask(p.id, p.sampleTaskId)}>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{p.name}</p>
                                        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                            {p.sampleTaskTitle || `${p.dueTaskCount} task${p.dueTaskCount > 1 ? 's' : ''}`}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {p.sampleTaskStatus && statusBadge(p.sampleTaskStatus, p.sampleTaskStatus === 'DONE' ? 'success' : 'normal')}
                                        {p.earliestDeadline && (
                                            <span className="text-xs font-semibold whitespace-nowrap" style={{ color: new Date(p.earliestDeadline) < todayStart ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                                                {format(new Date(p.earliestDeadline), 'MMM d')}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                );

            case 'task':
                if (!sectionVisible('task')) return null;
                return (
                    <div className="card p-5 h-full">
                        <div className="flex items-center gap-2 mb-4 pr-7">
                            <FolderKanban className="w-5 h-5" style={{ color: '#4f46e5' }} />
                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Tasks</h3>
                        </div>
                        <div className="space-y-3">
                            {applySearch(data?.dueTasks || [], 'title').length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No tasks with deadline in selected time</p>
                            )}
                            {applySearch(data?.dueTasks || [], 'title').map((t: any) => (
                                <button key={t.id} className="w-full flex items-center justify-between py-1 gap-3 text-left hover:bg-gray-50 rounded px-1" onClick={() => openTaskTarget(t.id, t.projectId)}>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{t.title}</p>
                                        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                            {t.taskKind === 'STANDALONE'
                                                ? `Personal task${t.user?.name ? ` · ${t.user.name}` : ''}`
                                                : `${t.project?.name || 'Project'}${t.assignee?.name ? ` · ${t.assignee.name}` : ''}`}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {statusBadge(t.status, t.status === 'DONE' ? 'success' : ((t.deadline || t.dueDate) && new Date(t.deadline || t.dueDate) < todayStart) ? 'danger' : 'normal')}
                                        {(t.deadline || t.dueDate) && (
                                            <span className="text-xs font-semibold whitespace-nowrap" style={{ color: new Date(t.deadline || t.dueDate) < todayStart ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                                                {format(new Date(t.deadline || t.dueDate), 'MMM d')}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                );

            case 'housework':
                if (!sectionVisible('housework')) return null;
                return (
                    <div className="card p-5 h-full">
                        <div className="flex items-center gap-2 mb-4 pr-7">
                            <Home className="w-5 h-5" style={{ color: '#059669' }} />
                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Housework</h3>
                        </div>
                        <div className="space-y-3">
                            {applySearch(data?.dueHousework || [], 'title').length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No housework due in selected time</p>
                            )}
                            {applySearch(data?.dueHousework || [], 'title').map((h: any) => (
                                <button key={h.id} className="w-full flex items-center justify-between py-1 gap-3 text-left hover:bg-gray-50 rounded px-1" onClick={() => navigate(`/housework?editId=${h.id}`)}>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{h.title}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{h.assignee?.name || 'Unassigned'}</p>
                                            {h.lastCompletedDate
                                                ? statusBadge('Completed', 'success')
                                                : <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ color: getHouseworkStatus(h.nextDueDate).color, backgroundColor: getHouseworkStatus(h.nextDueDate).bg }}>{getHouseworkStatus(h.nextDueDate).label}</span>
                                            }
                                        </div>
                                    </div>
                                    {h.nextDueDate && (
                                        <span className="text-xs font-semibold whitespace-nowrap" style={{ color: new Date(h.nextDueDate) < todayStart ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                                            {format(new Date(h.nextDueDate), 'MMM d')}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                );

            case 'expense':
                if (!sectionVisible('expense')) return null;
                return (
                    <div className="card p-5 h-full">
                        <div className="flex items-center gap-2 mb-4 pr-7">
                            <Wallet className="w-5 h-5" style={{ color: '#d97706' }} />
                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Expenses</h3>
                        </div>
                        <div className="space-y-3">
                            {applySearch(data?.expenses || [], 'description').length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No expenses in selected time</p>
                            )}
                            {applySearch(data?.expenses || [], 'description').map((e: any) => (
                                <button key={e.id} className="w-full flex items-center justify-between py-1 gap-3 text-left hover:bg-gray-50 rounded px-1" onClick={() => navigate('/expenses')}>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{e.description}</p>
                                        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{e.user?.name || 'User'} · {format(new Date(e.date), 'MMM d')}</p>
                                    </div>
                                    <span className="text-sm font-semibold whitespace-nowrap" style={{ color: 'var(--color-danger)' }}>{formatVND(e.amount)}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                );

            case 'assets':
                if (!sectionVisible('assets')) return null;
                return (
                    <div className="card p-5 h-full">
                        <div className="flex items-center gap-2 mb-4 pr-7">
                            <Microwave className="w-5 h-5" style={{ color: '#0ea5e9' }} />
                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Assets</h3>
                        </div>
                        <div className="space-y-3">
                            {applySearch(data?.dueAssets || [], 'description').length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No asset records in selected time</p>
                            )}
                            {applySearch(data?.dueAssets || [], 'description').map((a: any) => (
                                <button key={a.id} className="w-full flex items-center justify-between py-1 gap-3 text-left hover:bg-gray-50 rounded px-1" onClick={() => navigate(a.assetId ? `/assets/${a.assetId}` : '/assets')}>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{a.asset?.name || 'Asset'}</p>
                                        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{a.description || 'Maintenance'}{a.user?.name ? ` · ${a.user.name}` : ''}</p>
                                    </div>
                                    {a.serviceDate && <span className="text-xs font-semibold whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>{format(new Date(a.serviceDate), 'MMM d')}</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                );

            case 'learning':
                if (!sectionVisible('learning')) return null;
                return (
                    <div className="card p-5 h-full">
                        <div className="flex items-center gap-2 mb-4 pr-7">
                            <GraduationCap className="w-5 h-5" style={{ color: '#0f766e' }} />
                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Learning</h3>
                        </div>
                        <div className="space-y-3">
                            {applySearch(data?.dueLearning || [], 'title').length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No learning records in selected time</p>
                            )}
                            {applySearch(data?.dueLearning || [], 'title').map((l: any) => (
                                <button key={l.id} className="w-full flex items-center justify-between py-1 gap-3 text-left hover:bg-gray-50 rounded px-1" onClick={() => navigate('/learning')}>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{l.title}</p>
                                        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{l.topic?.title || 'Learning topic'}{l.user?.name ? ` · ${l.user.name}` : ''}</p>
                                    </div>
                                    {l.createdAt && <span className="text-xs font-semibold whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>{format(new Date(l.createdAt), 'MMM d')}</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                );

            case 'idea':
                if (!sectionVisible('idea')) return null;
                return (
                    <div className="card p-5 h-full">
                        <div className="flex items-center gap-2 mb-4 pr-7">
                            <Lightbulb className="w-5 h-5" style={{ color: '#f59e0b' }} />
                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Ideas</h3>
                        </div>
                        <div className="space-y-2">
                            {applySearch(data?.recentIdeas || [], 'title').length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No ideas yet</p>
                            )}
                            {applySearch(data?.recentIdeas || [], 'title').map((idea: any) => (
                                <button key={idea.id} className="w-full flex items-start justify-between py-1.5 gap-3 text-left hover:bg-gray-50 rounded px-1" onClick={() => navigate('/ideas')}>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{idea.title}</p>
                                        {idea.topic && <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{idea.topic.title}</p>}
                                    </div>
                                    <span className="text-xs whitespace-nowrap mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{format(new Date(idea.createdAt), 'MMM d')}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                );

            case 'keyboard':
                if (!sectionVisible('keyboard')) return null;
                return (
                    <div className="card p-5 h-full">
                        <div className="flex items-center gap-2 mb-4 pr-7">
                            <Keyboard className="w-5 h-5" style={{ color: '#6366f1' }} />
                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Keyboard</h3>
                        </div>
                        <button onClick={() => navigate('/keyboard')} className="w-full flex items-center justify-between py-2 px-1 text-sm text-left rounded hover:bg-gray-50 transition-colors" style={{ color: 'var(--color-text-secondary)' }}>
                            <span>View keyboard collection</span>
                            <span style={{ color: 'var(--color-primary)' }}>→</span>
                        </button>
                    </div>
                );

            case 'funds':
                if (!sectionVisible('funds')) return null;
                return (
                    <div className="card p-5 h-full">
                        <div className="flex items-center gap-2 mb-4 pr-7">
                            <TrendingUp className="w-5 h-5" style={{ color: '#10b981' }} />
                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Funds</h3>
                        </div>
                        <button onClick={() => navigate('/funds')} className="w-full flex items-center justify-between py-2 px-1 text-sm text-left rounded hover:bg-gray-50 transition-colors" style={{ color: 'var(--color-text-secondary)' }}>
                            <span>View fund transactions</span>
                            <span style={{ color: 'var(--color-primary)' }}>→</span>
                        </button>
                    </div>
                );

            case 'healthbook':
                if (!sectionVisible('healthbook')) return null;
                return (
                    <div className="card p-5 h-full">
                        <div className="flex items-center gap-2 mb-4 pr-7">
                            <HeartPulse className="w-5 h-5" style={{ color: '#ec4899' }} />
                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Healthbook</h3>
                        </div>
                        <button onClick={() => navigate('/healthbook')} className="w-full flex items-center justify-between py-2 px-1 text-sm text-left rounded hover:bg-gray-50 transition-colors" style={{ color: 'var(--color-text-secondary)' }}>
                            <span>View health records</span>
                            <span style={{ color: 'var(--color-primary)' }}>→</span>
                        </button>
                    </div>
                );

            default:
                return null;
        }
    }

    // Sections appear in click order (categories array order)
    const visibleSections = categories.filter(c => sectionVisible(c));

    if (isLoading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <div key={i} className="card p-5 h-24 bg-gray-100" />)}
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

                <div className="mt-4 rounded-xl border p-3" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                    <div className="flex items-center gap-2 mb-3">
                        <Filter className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                        <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Filters</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex-1 min-w-[180px]">
                            <input
                                value={dashSearch}
                                onChange={e => setDashSearch(e.target.value)}
                                placeholder="Search items…"
                                className="w-full text-sm border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
                            />
                        </div>
                        <div className="min-w-[130px]">
                            <select className="input" value={timeRange} onChange={(e) => setTimeRange(e.target.value as TimeRange)} onMouseDown={() => setCategoryOpen(false)}>
                                {TIME_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                        <div className="min-w-[140px] relative" ref={categoryRef}>
                            <button
                                type="button"
                                className="input w-full flex items-center justify-between"
                                onClick={() => setCategoryOpen(o => !o)}
                            >
                                <span className="text-sm" style={{ color: 'var(--color-text)' }}>
                                    {categories.length === CATEGORY_OPTIONS.length ? 'All categories' : categories.length === 0 ? 'None' : `${categories.length} selected`}
                                </span>
                                <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                            </button>
                            {categoryOpen && (
                                <div className="absolute z-20 mt-2 w-56 card p-2 max-h-80 overflow-auto" style={{ border: '1px solid var(--color-border)' }}>
                                    {CATEGORY_GROUPS.map(group => (
                                        <div key={group.label}>
                                            <div className="flex items-center justify-between px-2 pt-2 pb-1">
                                                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{group.label}</p>
                                                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                                    <button type="button" onClick={() => checkAllGroup(group.items)} className="hover:text-blue-500 transition-colors">All</button>
                                                    <span>·</span>
                                                    <button type="button" onClick={() => uncheckAllGroup(group.items)} className="hover:text-red-500 transition-colors">None</button>
                                                </div>
                                            </div>
                                            {group.items.map(c => (
                                                <label key={c} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm">
                                                    <input type="checkbox" checked={categories.includes(c)} onChange={() => toggleCategory(c)} />
                                                    <span style={{ color: 'var(--color-text)' }}>{categoryLabels[c]}</span>
                                                </label>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap shrink-0" style={{ color: 'var(--color-text)' }}>
                            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
                            Auto-refresh (60s)
                        </label>
                    </div>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {cards.map(c => (
                    <button key={c.label} className="card p-5 animate-slide-up text-left hover:shadow-md transition-shadow"
                        onClick={() => c.to === '/' ? setStatusFilter('OVERDUE') : navigate(c.to)}>
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>{c.label}</p>
                                <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value ?? 0}</p>
                            </div>
                            <div className="p-2 rounded-lg" style={{ backgroundColor: c.bg }}>
                                <c.icon className="w-5 h-5" style={{ color: c.color }} />
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {/* Overdue + Pin Items side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card p-5 border border-red-200 bg-red-50/40">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        <h3 className="font-semibold text-red-700">Overdue</h3>
                    </div>
                    <div className="space-y-3">
                        {filteredOverdueItems.length === 0 && (
                            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No overdue items for selected categories.</p>
                        )}
                        {filteredOverdueItems.map((o: any) => (
                            <button key={`${o.type}-${o.id}`} className="w-full flex items-center justify-between py-1 gap-3 text-left hover:bg-red-50 rounded px-1"
                                onClick={() => {
                                    if (o.type === 'PROJECT') openOverdueProjectItem(o.id, o.projectId);
                                    else if (o.type === 'TASK') openTaskTarget(o.id, o.projectId);
                                    else if (o.type === 'HOUSEWORK') navigate(`/housework?editId=${o.id}`);
                                    else if (o.type === 'CALENDAR') navigate(`/calendar?eventId=${o.id}`);
                                    else if (o.type === 'ASSET') navigate('/assets');
                                    else if (o.type === 'LEARNING') navigate('/learning');
                                }}>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{o.title}</p>
                                    <p className="text-xs text-red-700">{o.type}{o.meta ? ` · ${o.meta}` : ''}</p>
                                </div>
                                {o.date && <span className="text-xs font-semibold whitespace-nowrap text-red-700">{format(new Date(o.date), 'MMM d')}</span>}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Pin className="w-5 h-5" style={{ color: '#dc2626' }} />
                        <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Pin Items</h3>
                    </div>
                    <div className="space-y-3">
                        {(data?.pinnedItems || []).length === 0 && (
                            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No pinned items</p>
                        )}
                        {(data?.pinnedItems || []).map((p: any) => (
                            <button key={`${p.type}-${p.id}`} className="w-full flex items-center justify-between py-1 gap-3 text-left hover:bg-gray-50 rounded px-1"
                                onClick={() => {
                                    if (p.type === 'GOAL') navigate(`/goals?editId=${p.id}`);
                                    else if (p.type === 'TASK') openTaskTarget(p.id, p.projectId);
                                    else if (p.type === 'PROJECT') navigate(`/projects?boardId=${p.id}`);
                                    else if (p.type === 'HOUSEWORK') navigate(`/housework?editId=${p.id}`);
                                    else if (p.type === 'CALENDAR') navigate(`/calendar?eventId=${p.id}`);
                                    else if (p.type === 'ASSET') navigate(p.assetId ? `/assets/${p.assetId}` : '/assets');
                                    else if (p.type === 'LEARNING') navigate('/learning');
                                    else if (p.type === 'IDEA') navigate('/ideas');
                                }}>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{p.title}</p>
                                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{p.type}{p.meta ? ` · ${p.meta}` : ''}</p>
                                </div>
                                {p.date && <span className="text-xs font-semibold whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>{format(new Date(p.date), 'MMM d')}</span>}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {visibleSections.map(id => {
                    const content = renderSection(id);
                    if (!content) return null;
                    return <div key={id}>{content}</div>;
                })}
            </div>
        </div>
    );
}
