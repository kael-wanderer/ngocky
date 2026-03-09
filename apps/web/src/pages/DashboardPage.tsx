import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useNavigate } from 'react-router-dom';
import {
    FolderKanban, Home, Calendar, DollarSign,
    AlertTriangle, Target, CheckCircle2, Pin, Package, ChevronDown,
    Lightbulb, Trophy, Microwave, GraduationCap, GripVertical,
} from 'lucide-react';
import { format } from 'date-fns';
import {
    DndContext, closestCenter, DragEndEvent,
    PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
    SortableContext, useSortable, arrayMove, rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const CATEGORY_OPTIONS = ['goal', 'task', 'project', 'housework', 'calendar', 'expense', 'assets', 'learning', 'idea'] as const;
type Category = typeof CATEGORY_OPTIONS[number];
const categoryLabels: Record<Category, string> = {
    goal: 'Goal', task: 'Task', project: 'Project', housework: 'Housework', calendar: 'Calendar',
    expense: 'Expense', assets: 'Assets', learning: 'Learning', idea: 'Ideas',
};

const TIME_OPTIONS = [
    { value: 'TODAY', label: 'Today' },
    { value: 'THIS_WEEK', label: 'This week' },
    { value: 'NEXT_WEEK', label: 'Next week' },
    { value: 'THIS_MONTH', label: 'This month' },
    { value: 'NEXT_MONTH', label: 'Next month' },
] as const;
type TimeRange = typeof TIME_OPTIONS[number]['value'];

type StatusFilter = 'ALL' | 'PENDING' | 'COMPLETED' | 'OVERDUE';
const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
    { value: 'ALL', label: 'All' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'OVERDUE', label: 'Overdue' },
];

// Section ordering
type SectionId = 'goal' | 'calendar' | 'project' | 'task' | 'housework' | 'pinned' | 'expense' | 'assets' | 'learning' | 'idea';
const DEFAULT_SECTION_ORDER: SectionId[] = ['goal', 'calendar', 'project', 'task', 'housework', 'pinned', 'expense', 'assets', 'learning', 'idea'];
const SECTION_STORAGE_KEY = 'dashboard_section_order';

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

// Sortable section wrapper
function SortableSection({ id, children }: { id: string; children: React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, position: 'relative' }}
        >
            <button
                className="absolute top-3 right-3 z-10 p-1 rounded cursor-grab active:cursor-grabbing hover:bg-gray-100 transition-colors"
                {...attributes} {...listeners}
                title="Drag to reorder"
                type="button"
            >
                <GripVertical className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
            </button>
            {children}
        </div>
    );
}

export default function DashboardPage() {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [timeRange, setTimeRange] = useState<TimeRange>('THIS_WEEK');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
    const [categories, setCategories] = useState<Category[]>([...CATEGORY_OPTIONS]);
    const [sectionOrder, setSectionOrder] = useState<SectionId[]>(() => {
        try {
            const saved = localStorage.getItem(SECTION_STORAGE_KEY);
            if (saved) {
                const parsed: SectionId[] = JSON.parse(saved);
                // Merge: add new sections not in saved order
                const merged = [...parsed, ...DEFAULT_SECTION_ORDER.filter(s => !parsed.includes(s))];
                return merged;
            }
        } catch { /* ignore */ }
        return DEFAULT_SECTION_ORDER;
    });

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setSectionOrder(prev => {
                const oldIdx = prev.indexOf(active.id as SectionId);
                const newIdx = prev.indexOf(over.id as SectionId);
                const next = arrayMove(prev, oldIdx, newIdx);
                localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(next));
                return next;
            });
        }
    }

    const { data, isLoading } = useQuery({
        queryKey: ['dashboard', timeRange, statusFilter],
        queryFn: async () => (await api.get(`/dashboard?timeRange=${timeRange}&status=${statusFilter}`)).data.data,
    });

    const s = data?.summary || {};
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const cards = [
        { label: 'Tasks This Week', value: s.tasksThisWeek, icon: FolderKanban, color: '#4f46e5', bg: '#eef2ff', to: '/goals?tab=tasks' },
        { label: 'Housework Due', value: s.houseworkThisWeek, icon: Home, color: '#059669', bg: '#ecfdf5', to: '/housework' },
        { label: 'Upcoming Events', value: s.upcomingEventsCount, icon: Calendar, color: '#7c3aed', bg: '#f5f3ff', to: '/calendar' },
        { label: 'Overdue Items', value: s.overdueItemsTotal || 0, icon: AlertTriangle, color: '#dc2626', bg: '#fef2f2', to: '/' },
    ];

    const sectionVisible = (category: Category) => categories.includes(category);
    const toggleCategory = (c: Category) => {
        setCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
    };

    const showPinnedItems = useMemo(() => {
        return categories.some(c => c === 'goal' || c === 'task' || c === 'project' || c === 'housework' || c === 'calendar' || c === 'assets' || c === 'learning' || c === 'idea');
    }, [categories]);

    const overdueByCategory = (type: string): Category => {
        if (type === 'PROJECT') return 'project';
        if (type === 'TASK') return 'task';
        if (type === 'HOUSEWORK') return 'housework';
        return 'project';
    };
    const filteredOverdueItems = (data?.overdueItems || []).filter((item: any) => categories.includes(overdueByCategory(item.type)));

    // Map section IDs to renderable elements
    function renderSection(id: SectionId): React.ReactNode {
        switch (id) {
            case 'goal':
                if (!sectionVisible('goal')) return null;
                return (
                    <div className="card p-5 h-full">
                        <div className="flex items-center gap-2 mb-4 pr-7">
                            <Trophy className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Goal</h3>
                        </div>
                        <div className="space-y-3">
                            {(data?.goals || []).length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No active goals</p>
                            )}
                            {(data?.goals || []).map((g: any) => {
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
                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Events</h3>
                        </div>
                        <div className="space-y-3">
                            {(data?.upcomingEvents || []).length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No events in selected time</p>
                            )}
                            {(data?.upcomingEvents || []).map((e: any) => (
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
                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Project</h3>
                        </div>
                        <div className="space-y-3">
                            {(data?.dueProjects || []).length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No project deadlines in selected time</p>
                            )}
                            {(data?.dueProjects || []).map((p: any) => (
                                <button key={p.id} className="w-full flex items-center justify-between py-1 gap-3 text-left hover:bg-gray-50 rounded px-1" onClick={() => navigate(`/projects?boardId=${p.id}`)}>
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
                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Task</h3>
                        </div>
                        <div className="space-y-3">
                            {(data?.dueTasks || []).length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No tasks with deadline in selected time</p>
                            )}
                            {(data?.dueTasks || []).map((t: any) => (
                                <button key={t.id} className="w-full flex items-center justify-between py-1 gap-3 text-left hover:bg-gray-50 rounded px-1" onClick={() => t.taskKind === 'STANDALONE' ? navigate('/goals?tab=tasks') : navigate(`/projects?boardId=${t.projectId}&taskId=${t.id}`)}>
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
                            {(data?.dueHousework || []).length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No housework due in selected time</p>
                            )}
                            {(data?.dueHousework || []).map((h: any) => (
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

            case 'pinned':
                if (!showPinnedItems) return null;
                return (
                    <div className="card p-5 h-full">
                        <div className="flex items-center gap-2 mb-4 pr-7">
                            <Pin className="w-5 h-5" style={{ color: '#dc2626' }} />
                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Pinned Items</h3>
                        </div>
                        <div className="space-y-3">
                            {(data?.pinnedItems || []).length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No pinned items</p>
                            )}
                            {(data?.pinnedItems || []).map((p: any) => (
                                <button key={`${p.type}-${p.id}`} className="w-full flex items-center justify-between py-1 gap-3 text-left hover:bg-gray-50 rounded px-1"
                                    onClick={() => {
                                        if (p.type === 'GOAL') navigate(`/goals?editId=${p.id}`);
                                        else if (p.type === 'TASK') navigate(`/projects?boardId=${p.projectId || ''}&taskId=${p.id}`);
                                        else if (p.type === 'PROJECT') navigate(`/projects?boardId=${p.id}`);
                                        else if (p.type === 'HOUSEWORK') navigate(`/housework?editId=${p.id}`);
                                        else if (p.type === 'CALENDAR') navigate(`/calendar?eventId=${p.id}`);
                                        else if (p.type === 'ASSET') navigate(`/assets?assetId=${p.assetId || ''}`);
                                        else if (p.type === 'LEARNING') navigate('/learning');
                                        else if (p.type === 'IDEA') navigate('/ideas');
                                        else if (p.type === 'TASK') navigate('/goals?tab=tasks');
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
                );

            case 'expense':
                if (!sectionVisible('expense')) return null;
                return (
                    <div className="card p-5 h-full">
                        <div className="flex items-center gap-2 mb-4 pr-7">
                            <DollarSign className="w-5 h-5" style={{ color: '#d97706' }} />
                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Expense</h3>
                        </div>
                        <div className="space-y-3">
                            {(data?.expenses || []).length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No expenses in selected time</p>
                            )}
                            {(data?.expenses || []).map((e: any) => (
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
                            {(data?.dueAssets || []).length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No asset records in selected time</p>
                            )}
                            {(data?.dueAssets || []).map((a: any) => (
                                <button key={a.id} className="w-full flex items-center justify-between py-1 gap-3 text-left hover:bg-gray-50 rounded px-1" onClick={() => navigate(`/assets?assetId=${a.assetId}`)}>
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
                            {(data?.dueLearning || []).length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No learning records in selected time</p>
                            )}
                            {(data?.dueLearning || []).map((l: any) => (
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
                            {(data?.recentIdeas || []).length === 0 && (
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No ideas yet</p>
                            )}
                            {(data?.recentIdeas || []).map((idea: any) => (
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

            default:
                return null;
        }
    }

    // Only include sections that have visible content
    const visibleSections = sectionOrder.filter(id => {
        if (id === 'pinned') return showPinnedItems;
        if (id === 'task') return sectionVisible('project');
        const cat = id as Category;
        return CATEGORY_OPTIONS.includes(cat) ? sectionVisible(cat) : true;
    });

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

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="label">Time</label>
                        <select className="input" value={timeRange} onChange={(e) => setTimeRange(e.target.value as TimeRange)}>
                            {TIME_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="label">Status</label>
                        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
                            {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="label">Category</label>
                        <details className="relative">
                            <summary className="input list-none cursor-pointer flex items-center justify-between">
                                <span className="text-sm" style={{ color: 'var(--color-text)' }}>
                                    {categories.length === CATEGORY_OPTIONS.length ? 'All categories' : categories.length === 0 ? 'No category selected' : `${categories.length} selected`}
                                </span>
                                <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                            </summary>
                            <div className="absolute z-20 mt-2 w-full card p-2 max-h-64 overflow-auto" style={{ border: '1px solid var(--color-border)' }}>
                                {CATEGORY_OPTIONS.map(c => (
                                    <label key={c} className="flex items-center gap-2 px-2 py-2 rounded hover:bg-gray-50 cursor-pointer text-sm">
                                        <input type="checkbox" checked={categories.includes(c)} onChange={() => toggleCategory(c)} />
                                        <span style={{ color: 'var(--color-text)' }}>{categoryLabels[c]}</span>
                                    </label>
                                ))}
                            </div>
                        </details>
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

            {/* Overdue */}
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
                                if (o.type === 'PROJECT') navigate('/projects');
                                else if (o.type === 'TASK') navigate('/goals?tab=tasks');
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

            {/* Draggable sections */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={visibleSections} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {visibleSections.map(id => {
                            const content = renderSection(id);
                            if (!content) return null;
                            return (
                                <SortableSection key={id} id={id}>
                                    {content}
                                </SortableSection>
                            );
                        })}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    );
}
