import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Baby, Plus, X, ChevronLeft, ChevronRight, Pencil, Trash2,
    Filter, List, Calendar as CalIcon, LayoutGrid, Palette,
} from 'lucide-react';
import {
    format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
    isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek,
} from 'date-fns';
import api from '../api/client';
import NotificationFields, { buildNotificationPayload, emptyNotification, loadNotificationState } from '../components/NotificationFields';

// ─── Constants ──────────────────────────────────────

const CATEGORIES = ['School', 'Activity', 'Medical', 'Entertainment', 'Home', 'Other'];
const STATUSES = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'];
const TYPES = ['Task', 'Event', 'Schedule'];

const STATUS_LABEL: Record<string, string> = {
    TODO: 'Todo',
    IN_PROGRESS: 'In Progress',
    DONE: 'Done',
    CANCELLED: 'Cancelled',
};

const STATUS_COLOR: Record<string, string> = {
    TODO: '#6366f1',
    IN_PROGRESS: '#f59e0b',
    DONE: '#22c55e',
    CANCELLED: '#94a3b8',
};

const STATUS_BG: Record<string, string> = {
    TODO: '#eef2ff',
    IN_PROGRESS: '#fef3c7',
    DONE: '#dcfce7',
    CANCELLED: '#f1f5f9',
};

const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
    const h = Math.floor(i / 4);
    const m = (i % 4) * 15;
    const period = h < 12 ? 'am' : 'pm';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return { value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, label: `${h12}:${String(m).padStart(2, '0')}${period}` };
});

const UNASSIGNED_COLOR = '#94a3b8';
const USER_COLORS_KEY = 'cakeo_user_colors';

function loadUserColors(): Record<string, string> {
    try { return JSON.parse(localStorage.getItem(USER_COLORS_KEY) || '{}'); } catch { return {}; }
}
function saveUserColors(colors: Record<string, string>) {
    localStorage.setItem(USER_COLORS_KEY, JSON.stringify(colors));
}

type CaKeoView = 'calendar' | 'list' | 'kanban';

const emptyForm = () => ({
    title: '',
    description: '',
    type: 'Task',
    category: '',
    status: 'TODO',
    assignerId: '',
    startDate: '',
    startTime: '09:00',
    endDate: '',
    endTime: '10:00',
    allDay: false,
    color: '#6366f1',
    showOnCalendar: true,
    isShared: true,
    ...emptyNotification,
});

// ─── Main Page ───────────────────────────────────────

export default function CaKeoPage() {
    const qc = useQueryClient();
    const [view, setView] = useState<CaKeoView>('calendar');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [form, setForm] = useState(emptyForm());
    const [formError, setFormError] = useState('');
    const [filters, setFilters] = useState({ status: '', assignerId: '', category: '' });
    const [calTypeFilter, setCalTypeFilter] = useState<string[]>(TYPES);
    const [userColors, setUserColors] = useState<Record<string, string>>(loadUserColors);
    const [showColorConfig, setShowColorConfig] = useState(false);

    // Queries
    const { data: usersData } = useQuery({
        queryKey: ['cakeo-users'],
        queryFn: async () => (await api.get('/cakeos/users')).data.data,
    });
    // Users already excludes OWNER role (filtered in backend)
    const users: any[] = usersData || [];

    const { data: itemsData, isLoading } = useQuery({
        queryKey: ['cakeos', filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters.status) params.set('status', filters.status);
            if (filters.assignerId) params.set('assignerId', filters.assignerId);
            if (filters.category) params.set('category', filters.category);
            return (await api.get(`/cakeos?${params}`)).data.data;
        },
    });
    const items: any[] = itemsData || [];

    // Mutations
    const createMut = useMutation({
        mutationFn: (body: any) => api.post('/cakeos', body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['cakeos'] }); closeModal(); },
        onError: (err: any) => window.alert(err?.response?.data?.message || 'Failed to create'),
    });
    const updateMut = useMutation({
        mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/cakeos/${id}`, body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['cakeos'] }); closeModal(); },
        onError: (err: any) => window.alert(err?.response?.data?.message || 'Failed to update'),
    });
    const deleteMut = useMutation({
        mutationFn: (id: string) => api.delete(`/cakeos/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['cakeos'] }),
    });

    // Calendar helpers
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: calStart, end: calEnd });
    const today = new Date();

    // Calendar items with type filter applied
    const calendarItems = useMemo(
        () => items.filter((item: any) => calTypeFilter.includes(item.type || 'Task')),
        [items, calTypeFilter],
    );

    const getItemsForDay = (day: Date) =>
        calendarItems.filter((item: any) => item.startDate && isSameDay(new Date(item.startDate), day));
    const selectedItems = selectedDate ? getItemsForDay(selectedDate) : [];

    // Kanban groups
    const kanbanGroups = useMemo(() =>
        STATUSES.map((status) => ({
            status,
            items: items.filter((item: any) => item.status === status),
        })),
        [items],
    );

    // Stats for list view (per assignee user, OWNER already excluded from users list)
    const stats = useMemo(() => {
        const result: Record<string, { pending: number; done: number }> = {};
        users.forEach((u: any) => { result[u.id] = { pending: 0, done: 0 }; });
        items.forEach((item: any) => {
            if (!item.assignerId || !result[item.assignerId]) return;
            if (item.status === 'DONE') result[item.assignerId].done += 1;
            else if (item.status !== 'CANCELLED') result[item.assignerId].pending += 1;
        });
        return result;
    }, [items, users]);

    // User color helpers
    function getAssigneeColor(assignerId: string | null | undefined): string {
        if (!assignerId) return UNASSIGNED_COLOR;
        return userColors[assignerId] || UNASSIGNED_COLOR;
    }

    function updateUserColor(userId: string, color: string) {
        const next = { ...userColors, [userId]: color };
        setUserColors(next);
        saveUserColors(next);
    }

    // Modal helpers
    function openCreate(date?: Date) {
        setEditingItem(null);
        setFormError('');
        const base = date || selectedDate || new Date();
        setForm({ ...emptyForm(), startDate: format(base, 'yyyy-MM-dd'), endDate: format(base, 'yyyy-MM-dd') });
        setShowModal(true);
    }

    function openEdit(item: any) {
        setEditingItem(item);
        setFormError('');
        setForm({
            title: item.title || '',
            description: item.description || '',
            type: item.type || 'Task',
            category: item.category || '',
            status: item.status || 'TODO',
            assignerId: item.assignerId || '',
            startDate: item.startDate ? format(new Date(item.startDate), 'yyyy-MM-dd') : '',
            startTime: item.startDate ? format(new Date(item.startDate), 'HH:mm') : '09:00',
            endDate: item.endDate ? format(new Date(item.endDate), 'yyyy-MM-dd') : '',
            endTime: item.endDate ? format(new Date(item.endDate), 'HH:mm') : '10:00',
            allDay: !!item.allDay,
            color: item.color || '#6366f1',
            showOnCalendar: item.showOnCalendar !== false,
            isShared: item.isShared !== false,
            ...loadNotificationState(item),
        });
        setShowModal(true);
    }

    function closeModal() {
        setShowModal(false);
        setEditingItem(null);
        setForm(emptyForm());
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setFormError('');
        const startAt = form.startDate ? new Date(`${form.startDate}T${form.startTime}`) : null;
        const endAt = form.endDate ? new Date(`${form.endDate}T${form.endTime || form.startTime}`) : null;
        if (startAt && endAt && endAt <= startAt) {
            setFormError('End time must be after start time.');
            return;
        }
        const body = {
            ...form,
            startDate: startAt?.toISOString() || null,
            endDate: endAt?.toISOString() || null,
            assignerId: form.assignerId || null,
            category: form.category || null,
            ...buildNotificationPayload(form),
        };
        if (editingItem) updateMut.mutate({ id: editingItem.id, body });
        else createMut.mutate(body);
    }

    function handleDelete(id: string) {
        if (window.confirm('Delete this item?')) deleteMut.mutate(id);
    }

    function toggleCalType(type: string) {
        setCalTypeFilter((prev) =>
            prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
        );
    }

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <Baby className="w-6 h-6" style={{ color: '#ec4899' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Ca Keo</h2>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                        <button onClick={() => setView('calendar')} className={`px-3 py-2 text-sm flex items-center gap-1.5 ${view === 'calendar' ? 'bg-gray-100' : ''}`} title="Calendar"><CalIcon className="w-4 h-4" /></button>
                        <button onClick={() => setView('list')} className={`px-3 py-2 text-sm flex items-center gap-1.5 ${view === 'list' ? 'bg-gray-100' : ''}`} title="List"><List className="w-4 h-4" /></button>
                        <button onClick={() => setView('kanban')} className={`px-3 py-2 text-sm flex items-center gap-1.5 ${view === 'kanban' ? 'bg-gray-100' : ''}`} title="Kanban"><LayoutGrid className="w-4 h-4" /></button>
                    </div>
                    <button className="btn-primary" onClick={() => openCreate()}>
                        <Plus className="w-4 h-4" /> New
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                        <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Filters</span>
                    </div>
                    <button
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition-colors"
                        style={{ borderColor: 'var(--color-border)', color: showColorConfig ? '#ec4899' : 'var(--color-text-secondary)' }}
                        onClick={() => setShowColorConfig(!showColorConfig)}
                    >
                        <Palette className="w-3.5 h-3.5" /> User Colors
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <select className="input text-sm" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                        <option value="">All Statuses</option>
                        {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                    <select className="input text-sm" value={filters.assignerId} onChange={(e) => setFilters({ ...filters, assignerId: e.target.value })}>
                        <option value="">All Assignees</option>
                        {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    <select className="input text-sm" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
                        <option value="">All Categories</option>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                {/* User Color Config */}
                {showColorConfig && users.length > 0 && (
                    <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                        <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Assignee Colors</p>
                        <div className="flex flex-wrap gap-4">
                            {users.map((u: any) => (
                                <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input
                                        type="color"
                                        className="w-7 h-7 rounded cursor-pointer border-0 p-0.5"
                                        value={userColors[u.id] || UNASSIGNED_COLOR}
                                        onChange={(e) => updateUserColor(u.id, e.target.value)}
                                    />
                                    <span style={{ color: 'var(--color-text)' }}>{u.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
                    <div className="card p-6 w-full max-w-lg animate-slide-up overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">{editingItem ? 'Edit' : 'New'}</h3>
                            <button onClick={closeModal}><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="label">Title <span className="text-red-500">*</span></label>
                                <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="label">Type</label>
                                    <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                                        {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Category</label>
                                    <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                                        <option value="">None</option>
                                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Status</label>
                                    <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                        {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="label">Assign To</label>
                                <select className="input" value={form.assignerId} onChange={(e) => setForm({ ...form, assignerId: e.target.value })}>
                                    <option value="">Unassigned</option>
                                    {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="label">Start Date</label>
                                    <label className="relative block cursor-pointer">
                                        <span className="input block text-sm">{form.startDate ? format(new Date(`${form.startDate}T00:00`), 'MMM dd, yyyy') : 'Select date'}</span>
                                        <input type="date" className="absolute inset-0 opacity-0 w-full cursor-pointer" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                                    </label>
                                </div>
                                <div>
                                    <label className="label">Start Time</label>
                                    <select className="input" value={form.startTime} disabled={!form.startDate || form.allDay} onChange={(e) => setForm({ ...form, startTime: e.target.value })}>
                                        {TIME_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">End Date</label>
                                    <label className="relative block cursor-pointer">
                                        <span className="input block text-sm">{form.endDate ? format(new Date(`${form.endDate}T00:00`), 'MMM dd, yyyy') : 'None'}</span>
                                        <input type="date" className="absolute inset-0 opacity-0 w-full cursor-pointer" min={form.startDate || undefined} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                                    </label>
                                </div>
                                <div>
                                    <label className="label">End Time</label>
                                    <select className="input" value={form.endTime} disabled={!form.endDate || form.allDay} onChange={(e) => setForm({ ...form, endTime: e.target.value })}>
                                        {TIME_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="label">Description</label>
                                <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Color</label>
                                    <input type="color" className="input h-10 p-1" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                                </div>
                                <div className="space-y-2 pt-5">
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" checked={form.allDay} onChange={(e) => setForm({ ...form, allDay: e.target.checked })} className="rounded" /> All day
                                    </label>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" checked={form.showOnCalendar} onChange={(e) => setForm({ ...form, showOnCalendar: e.target.checked })} className="rounded" /> Show on main Calendar
                                    </label>
                                </div>
                            </div>
                            {formError && <p className="text-sm text-red-500">{formError}</p>}
                            <NotificationFields form={form} setForm={setForm} />
                            <div className="flex items-center justify-between gap-3 pt-2">
                                <div>
                                    {editingItem && (
                                        <button type="button" className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white"
                                            onClick={() => { if (window.confirm('Delete?')) { deleteMut.mutate(editingItem.id); closeModal(); } }}>
                                            Delete
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-2 ml-auto">
                                    <button type="button" className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50" onClick={closeModal}>Cancel</button>
                                    <button type="submit" className="btn-primary" disabled={createMut.isPending || updateMut.isPending}>
                                        {editingItem ? 'Save' : 'Create'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CALENDAR VIEW */}
            {view === 'calendar' && (
                <>
                    {/* Type filter chips */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Type:</span>
                        {TYPES.map((type) => {
                            const active = calTypeFilter.includes(type);
                            return (
                                <button
                                    key={type}
                                    onClick={() => toggleCalType(type)}
                                    className="text-xs px-3 py-1 rounded-full border transition-colors font-medium"
                                    style={{
                                        backgroundColor: active ? '#ec4899' : 'transparent',
                                        color: active ? '#fff' : 'var(--color-text-secondary)',
                                        borderColor: active ? '#ec4899' : 'var(--color-border)',
                                    }}
                                >
                                    {type}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center justify-between">
                        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="btn-ghost p-2"><ChevronLeft className="w-5 h-5" /></button>
                        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{format(currentDate, 'MMMM yyyy')}</h3>
                        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="btn-ghost p-2"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 card p-4">
                            <div className="grid grid-cols-7 gap-px mb-2">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                                    <div key={d} className="text-center text-xs font-semibold py-2" style={{ color: 'var(--color-text-secondary)' }}>{d}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-px">
                                {days.map((day) => {
                                    const dayItems = getItemsForDay(day);
                                    const isToday = isSameDay(day, today);
                                    const inMonth = isSameMonth(day, currentDate);
                                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                                    return (
                                        <button
                                            key={day.toISOString()}
                                            onClick={() => setSelectedDate(day)}
                                            className={`aspect-square p-1 rounded-lg text-sm transition-all relative ${isSelected ? 'ring-2 ring-offset-1' : 'hover:bg-gray-50'}`}
                                            style={{ color: inMonth ? 'var(--color-text)' : 'var(--color-text-secondary)', opacity: inMonth ? 1 : 0.4, ...(isSelected ? { '--tw-ring-color': '#ec4899' } as any : {}) }}
                                        >
                                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${isToday ? 'text-white' : ''}`}
                                                style={isToday ? { backgroundColor: '#ec4899' } : {}}>
                                                {format(day, 'd')}
                                            </span>
                                            {dayItems.length > 0 && (
                                                <div className="flex justify-center gap-0.5 mt-0.5">
                                                    {dayItems.slice(0, 3).map((item: any, i: number) => (
                                                        <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getAssigneeColor(item.assignerId) }} />
                                                    ))}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="card p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold" style={{ color: 'var(--color-text)' }}>
                                    {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Select a day'}
                                </h4>
                                {selectedDate && (
                                    <button className="btn-ghost p-1" title="Add for this day" onClick={() => openCreate(selectedDate)}>
                                        <Plus className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            {selectedDate && selectedItems.length === 0 && <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Nothing here</p>}
                            <div className="space-y-2">
                                {selectedItems.map((item: any) => (
                                    <CaKeoCard key={item.id} item={item} assigneeColor={getAssigneeColor(item.assignerId)} onEdit={openEdit} onDelete={handleDelete} />
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* LIST VIEW */}
            {view === 'list' && (
                <div className="space-y-4">
                    {/* Per-assignee stats */}
                    {users.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {users.map((u: any) => (
                                <React.Fragment key={u.id}>
                                    <div className="card p-4">
                                        <div className="text-xs font-medium mb-1 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getAssigneeColor(u.id) }} />
                                            <span style={{ color: 'var(--color-text-secondary)' }}>{u.name} — Pending</span>
                                        </div>
                                        <div className="text-2xl font-bold" style={{ color: '#f59e0b' }}>{stats[u.id]?.pending ?? 0}</div>
                                    </div>
                                    <div className="card p-4">
                                        <div className="text-xs font-medium mb-1 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getAssigneeColor(u.id) }} />
                                            <span style={{ color: 'var(--color-text-secondary)' }}>{u.name} — Done</span>
                                        </div>
                                        <div className="text-2xl font-bold" style={{ color: '#22c55e' }}>{stats[u.id]?.done ?? 0}</div>
                                    </div>
                                </React.Fragment>
                            ))}
                        </div>
                    )}
                    {isLoading ? (
                        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="card h-14 animate-pulse bg-gray-100" />)}</div>
                    ) : (
                        <div className="card overflow-hidden">
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Title</th>
                                            <th>Type</th>
                                            <th>Category</th>
                                            <th>Status</th>
                                            <th>Assignee</th>
                                            <th>Date</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.length === 0 && (
                                            <tr><td colSpan={7} className="text-center py-8 text-sm" style={{ color: 'var(--color-text-secondary)' }}>No items found</td></tr>
                                        )}
                                        {items.map((item: any) => (
                                            <tr key={item.id} className="group hover:bg-gray-50 cursor-pointer" onDoubleClick={() => openEdit(item)}>
                                                <td>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-5 rounded-sm flex-shrink-0" style={{ backgroundColor: getAssigneeColor(item.assignerId) }} />
                                                        <span className="font-medium" style={{ color: 'var(--color-text)' }}>{item.title}</span>
                                                    </div>
                                                    {item.description && <p className="text-xs mt-0.5 truncate max-w-xs pl-3.5" style={{ color: 'var(--color-text-secondary)' }}>{item.description}</p>}
                                                </td>
                                                <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{item.type || 'Task'}</td>
                                                <td>{item.category ? <span className="badge badge-secondary">{item.category}</span> : '—'}</td>
                                                <td>
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                                                        style={{ color: STATUS_COLOR[item.status], backgroundColor: STATUS_BG[item.status] }}>
                                                        {STATUS_LABEL[item.status] || item.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    {item.assigner ? (
                                                        <span className="inline-flex items-center gap-1.5 text-sm">
                                                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getAssigneeColor(item.assignerId) }} />
                                                            <span style={{ color: getAssigneeColor(item.assignerId) }}>{item.assigner.name}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-sm" style={{ color: UNASSIGNED_COLOR }}>Unassigned</span>
                                                    )}
                                                </td>
                                                <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                                    {item.startDate ? format(new Date(item.startDate), 'MMM d, yyyy') : '—'}
                                                </td>
                                                <td>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button type="button" className="p-1 rounded hover:bg-indigo-50" onClick={(e) => { e.stopPropagation(); openEdit(item); }} title="Edit"><Pencil className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} /></button>
                                                        <button type="button" className="p-1 rounded hover:bg-red-50" onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} title="Delete"><Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--color-danger)' }} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* KANBAN VIEW */}
            {view === 'kanban' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {kanbanGroups.map(({ status, items: colItems }) => (
                        <div key={status} className="card p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[status] }} />
                                    <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{STATUS_LABEL[status]}</span>
                                    <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: STATUS_BG[status], color: STATUS_COLOR[status] }}>{colItems.length}</span>
                                </div>
                                <button className="btn-ghost p-1" title={`Add ${STATUS_LABEL[status]}`} onClick={() => { openCreate(); setForm((f) => ({ ...f, status })); }}>
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <div className="space-y-2">
                                {colItems.map((item: any) => (
                                    <CaKeoCard key={item.id} item={item} assigneeColor={getAssigneeColor(item.assignerId)} onEdit={openEdit} onDelete={handleDelete} compact />
                                ))}
                                {colItems.length === 0 && (
                                    <p className="text-xs text-center py-4" style={{ color: 'var(--color-text-secondary)' }}>Empty</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── CaKeo Card ─────────────────────────────────────

function CaKeoCard({ item, assigneeColor, onEdit, onDelete, compact = false }: {
    item: any;
    assigneeColor: string;
    onEdit: (item: any) => void;
    onDelete: (id: string) => void;
    compact?: boolean;
}) {
    return (
        <div
            className="p-3 rounded-lg border-l-4 cursor-pointer hover:shadow-sm transition-shadow"
            style={{ borderColor: assigneeColor, backgroundColor: 'var(--color-bg)' }}
            onDoubleClick={() => onEdit(item)}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{item.title}</p>
                    {!compact && item.description && (
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-secondary)' }}>{item.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {item.type && item.type !== 'Task' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-50 font-medium text-pink-600">{item.type}</span>
                        )}
                        {item.category && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 font-medium" style={{ color: 'var(--color-text-secondary)' }}>{item.category}</span>
                        )}
                        {item.assigner?.name ? (
                            <span className="text-[10px] font-medium" style={{ color: assigneeColor }}>{item.assigner.name}</span>
                        ) : (
                            <span className="text-[10px]" style={{ color: UNASSIGNED_COLOR }}>Unassigned</span>
                        )}
                        {!compact && item.startDate && (
                            <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                                {item.allDay ? format(new Date(item.startDate), 'MMM d') : format(new Date(item.startDate), 'MMM d, h:mm a')}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button type="button" className="p-1 rounded hover:bg-indigo-50" onClick={(e) => { e.stopPropagation(); onEdit(item); }}><Pencil className="w-3 h-3" style={{ color: 'var(--color-primary)' }} /></button>
                    <button type="button" className="p-1 rounded hover:bg-red-50" onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}><Trash2 className="w-3 h-3" style={{ color: 'var(--color-danger)' }} /></button>
                </div>
            </div>
        </div>
    );
}
