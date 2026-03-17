import React, { useEffect, useMemo, useState } from 'react';
import { useLocalStorage } from '../utils/useLocalStorage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { Home, Plus, X, CheckCircle2, AlertTriangle, Pencil, Trash2, Pin, LayoutGrid, List, Copy, Filter, ArrowUp, ArrowDown, Bell, ChevronDown, ChevronUp } from 'lucide-react';
import { addMonths, addWeeks, endOfMonth, endOfWeek, format, isWithinInterval, startOfMonth, startOfToday, startOfWeek } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import NotificationFields, { buildNotificationPayload, emptyNotification, loadNotificationState } from '../components/NotificationFields';
import { useAuthStore } from '../stores/auth';
import { getSharedOwnerName } from '../utils/sharedOwnership';
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

const freqLabels: Record<string, string> = {
    ONE_TIME: 'One time',
    DAILY: 'Daily',
    WEEKLY: 'Weekly',
    MONTHLY: 'Monthly',
    QUARTERLY: 'Quarterly',
    HALF_YEARLY: 'Half yearly',
    YEARLY: 'Yearly',
};

const weekdayLabels: Record<string, string> = {
    '1': 'Monday',
    '2': 'Tuesday',
    '3': 'Wednesday',
    '4': 'Thursday',
    '5': 'Friday',
    '6': 'Saturday',
    '7': 'Sunday',
};

const frequencyOptions = [...HOUSEWORK_FREQUENCY_OPTIONS];

const emptyForm = {
    title: '',
    description: '',
    isShared: false,
    status: 'PLANNED',
    frequencyType: 'WEEKLY',
    nextDueDate: '',
    showOnCalendar: false,
    pinToDashboard: false,
    ...emptyNotification,
    dayOfWeek: '1',
    dayOfMonth: '1',
    monthOfPeriod: '1',
    monthOfYear: '1',
};

type HouseworkFormState = typeof emptyForm;
type HouseworkDueDateFilter = SharedHouseworkDueDateFilter;
type HouseworkStatusFilter = SharedHouseworkStatusFilter;
type HouseworkFrequencyFilter = SharedHouseworkFrequencyFilter;
type HouseworkSortKey = 'title' | 'description' | 'frequencyType' | 'status' | 'nextDueDate' | 'notification' | 'showOnCalendar';
type HouseworkGridSort = 'TITLE_ASC' | 'TITLE_DESC' | 'DUE_ASC' | 'DUE_DESC';
type HouseworkListSortOption = 'TITLE_ASC' | 'TITLE_DESC' | 'DESCRIPTION_ASC' | 'DESCRIPTION_DESC' | 'FREQUENCY_ASC' | 'FREQUENCY_DESC' | 'STATUS_ASC' | 'STATUS_DESC' | 'DUE_ASC' | 'DUE_DESC' | 'NOTIFICATION_ASC' | 'NOTIFICATION_DESC' | 'OPTIONS_ASC' | 'OPTIONS_DESC';

function getNormalizedFormByFrequency(form: HouseworkFormState, frequencyType: string): HouseworkFormState {
    const nextForm = { ...form, frequencyType };

    if (frequencyType === 'WEEKLY') {
        return { ...nextForm, dayOfWeek: nextForm.dayOfWeek || '1', dayOfMonth: '1', monthOfPeriod: '1', monthOfYear: '1' };
    }
    if (frequencyType === 'MONTHLY') {
        return { ...nextForm, dayOfWeek: '1', dayOfMonth: nextForm.dayOfMonth || '1', monthOfPeriod: '1', monthOfYear: '1' };
    }
    if (frequencyType === 'QUARTERLY' || frequencyType === 'HALF_YEARLY') {
        return { ...nextForm, dayOfWeek: '1', dayOfMonth: nextForm.dayOfMonth || '1', monthOfPeriod: nextForm.monthOfPeriod || '1', monthOfYear: '1' };
    }
    if (frequencyType === 'YEARLY') {
        return { ...nextForm, dayOfWeek: '1', dayOfMonth: nextForm.dayOfMonth || '1', monthOfPeriod: '1', monthOfYear: nextForm.monthOfYear || '1' };
    }

    return { ...nextForm, dayOfWeek: '1', dayOfMonth: '1', monthOfPeriod: '1', monthOfYear: '1' };
}

function buildRecurrenceLabel(item: any): string | null {
    if (item.frequencyType === 'WEEKLY' && item.dayOfWeek) return `Every ${weekdayLabels[String(item.dayOfWeek)]}`;
    if (item.frequencyType === 'MONTHLY' && item.dayOfMonth) return `Every month on day ${item.dayOfMonth}`;
    if (item.frequencyType === 'QUARTERLY' && item.monthOfPeriod && item.dayOfMonth) return `Every quarter: month ${item.monthOfPeriod}, day ${item.dayOfMonth}`;
    if (item.frequencyType === 'HALF_YEARLY' && item.monthOfPeriod && item.dayOfMonth) return `Every half-year: month ${item.monthOfPeriod}, day ${item.dayOfMonth}`;
    if (item.frequencyType === 'YEARLY' && item.monthOfYear && item.dayOfMonth) return `Every year: month ${item.monthOfYear}, day ${item.dayOfMonth}`;
    return null;
}

function getStatusLabel(status: string) {
    return status === 'PLANNED' ? 'Plan' : status.replace('_', ' ');
}

function getStatusTone(status: string) {
    if (status === 'DONE') return 'bg-emerald-50 text-emerald-700';
    if (status === 'IN_PROGRESS') return 'bg-amber-50 text-amber-700';
    return 'bg-slate-100 text-slate-700';
}

function getDueBadge(item: any) {
    if (!item.nextDueDate) return { label: 'No due date', tone: 'bg-slate-100 text-slate-700' };

    const dueDate = new Date(item.nextDueDate);
    const today = startOfToday();
    const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

    if (dueDay < today && item.status !== 'DONE') {
        return { label: `Overdue · ${format(dueDate, 'MMM d, yyyy')}`, tone: 'bg-red-50 text-red-700' };
    }

    if (dueDay.getTime() === today.getTime()) {
        return { label: `Today · ${format(dueDate, 'MMM d')}`, tone: 'bg-amber-50 text-amber-700' };
    }

    return { label: format(dueDate, 'MMM d, yyyy'), tone: 'bg-emerald-50 text-emerald-700' };
}

function formatNotification(item: any): string | null {
    if (!item.notificationEnabled) return null;
    if (item.reminderOffsetUnit === 'ON_DATE' && item.notificationDate) {
        return format(new Date(item.notificationDate), 'MMM dd, yyyy HH:mm');
    }
    if (item.reminderOffsetUnit === 'HOURS') return `${item.reminderOffsetValue} hour${item.reminderOffsetValue !== 1 ? 's' : ''} before`;
    if (item.reminderOffsetUnit === 'DAYS') return `${item.reminderOffsetValue} day${item.reminderOffsetValue !== 1 ? 's' : ''} before`;
    return null;
}

function formatNotificationBadges(item: any): string[] {
    if (!item.notificationEnabled) return [];
    const time = item.notificationTime || '';
    if (item.reminderOffsetUnit === 'ON_DATE' && item.notificationDate) {
        return [format(new Date(item.notificationDate), 'MMM dd, yyyy'), ...(time ? [time] : [])];
    }
    if (item.reminderOffsetUnit === 'HOURS') {
        const label = `${item.reminderOffsetValue} hour${item.reminderOffsetValue !== 1 ? 's' : ''} before`;
        return [label, ...(time ? [time] : [])];
    }
    if (item.reminderOffsetUnit === 'DAYS') {
        const label = `${item.reminderOffsetValue} day${item.reminderOffsetValue !== 1 ? 's' : ''} before`;
        return [label, ...(time ? [time] : [])];
    }
    return [];
}

function RecurrenceRuleFields({ form, setForm }: { form: HouseworkFormState; setForm: React.Dispatch<React.SetStateAction<HouseworkFormState>> }) {
    if (form.frequencyType === 'WEEKLY') {
        return (
            <div>
                <label className="label">Day of Week <span className="text-red-500">*</span></label>
                <select className="input" value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}>
                    {Object.entries(weekdayLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
            </div>
        );
    }

    if (form.frequencyType === 'MONTHLY') {
        return (
            <div>
                <label className="label">Day of Month <span className="text-red-500">*</span></label>
                <select className="input" value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={String(d)}>{d}</option>)}
                </select>
            </div>
        );
    }

    if (form.frequencyType === 'QUARTERLY') {
        return (
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="label">Month of Quarter <span className="text-red-500">*</span></label>
                    <select className="input" value={form.monthOfPeriod} onChange={(e) => setForm({ ...form, monthOfPeriod: e.target.value })}>
                        {[1, 2, 3].map((m) => <option key={m} value={String(m)}>{m}</option>)}
                    </select>
                </div>
                <div>
                    <label className="label">Day of Month <span className="text-red-500">*</span></label>
                    <select className="input" value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })}>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={String(d)}>{d}</option>)}
                    </select>
                </div>
            </div>
        );
    }

    if (form.frequencyType === 'HALF_YEARLY') {
        return (
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="label">Month of Half-Year <span className="text-red-500">*</span></label>
                    <select className="input" value={form.monthOfPeriod} onChange={(e) => setForm({ ...form, monthOfPeriod: e.target.value })}>
                        {[1, 2, 3, 4, 5, 6].map((m) => <option key={m} value={String(m)}>{m}</option>)}
                    </select>
                </div>
                <div>
                    <label className="label">Day of Month <span className="text-red-500">*</span></label>
                    <select className="input" value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })}>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={String(d)}>{d}</option>)}
                    </select>
                </div>
            </div>
        );
    }

    if (form.frequencyType === 'YEARLY') {
        return (
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="label">Month of Year <span className="text-red-500">*</span></label>
                    <select className="input" value={form.monthOfYear} onChange={(e) => setForm({ ...form, monthOfYear: e.target.value })}>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={String(m)}>{m}</option>)}
                    </select>
                </div>
                <div>
                    <label className="label">Day of Month <span className="text-red-500">*</span></label>
                    <select className="input" value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })}>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={String(d)}>{d}</option>)}
                    </select>
                </div>
            </div>
        );
    }

    return null;
}

function HouseworkForm({
    form,
    setForm,
    onSubmit,
    onCancel,
    onDelete,
    loading,
    submitLabel,
}: {
    form: HouseworkFormState;
    setForm: React.Dispatch<React.SetStateAction<HouseworkFormState>>;
    onSubmit: () => void;
    onCancel: () => void;
    onDelete?: () => void;
    loading: boolean;
    submitLabel: string;
}) {
    const [optionsOpen, setOptionsOpen] = useState(false);

    return (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4">
            <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">Title <span className="text-red-500">*</span></label>
                    <button type="button" onClick={() => setForm({ ...form, pinToDashboard: !form.pinToDashboard })}
                        className={`p-1.5 rounded-lg border transition-colors ${form.pinToDashboard ? 'text-amber-500 border-amber-300 bg-amber-50' : 'border-gray-200 text-gray-400 hover:text-gray-600'}`}
                        title="Pin to dashboard">
                        <Pin className="w-3.5 h-3.5" />
                    </button>
                </div>
                <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                    <label className="label">Frequency <span className="text-red-500">*</span></label>
                    <select className="input" value={form.frequencyType} onChange={(e) => setForm((prev) => getNormalizedFormByFrequency(prev, e.target.value))}>
                        {frequencyOptions.map((k) => <option key={k} value={k}>{freqLabels[k]}</option>)}
                    </select>
                </div>
                <div>
                    <label className="label">Status</label>
                    <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                        <option value="PLANNED">Plan</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="DONE">Done</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                    <label className="label">Next Due</label>
                    <input
                        type="date"
                        className="input"
                        value={form.nextDueDate}
                        onChange={(e) => setForm({ ...form, nextDueDate: e.target.value, showOnCalendar: e.target.value ? form.showOnCalendar : false })}
                    />
                </div>
            </div>

            <RecurrenceRuleFields form={form} setForm={setForm} />

            {/* Options */}
            <div className="rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                <button type="button" onClick={() => setOptionsOpen(o => !o)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium"
                    style={{ color: 'var(--color-text)' }}>
                    <span>Options</span>
                    {optionsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {optionsOpen && (
                    <div className="border-t px-3 pb-3 pt-2 space-y-2" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-start gap-2 p-3 rounded-lg border cursor-pointer" style={{ borderColor: form.showOnCalendar ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: form.showOnCalendar ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : 'transparent', opacity: !form.nextDueDate ? 0.5 : 1 }}>
                            <input type="checkbox" id="houseworkShowOnCalendar" checked={form.showOnCalendar} disabled={!form.nextDueDate} onChange={(e) => setForm({ ...form, showOnCalendar: e.target.checked })} className="rounded mt-0.5" />
                            <label htmlFor="houseworkShowOnCalendar" className="cursor-pointer flex-1">
                                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Add to Calendar</span>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{form.nextDueDate ? 'Creates a calendar event on the next due date' : 'Requires a due date'}</p>
                            </label>
                        </div>
                        <div className="flex items-start gap-2 p-3 rounded-lg border cursor-pointer" style={{ borderColor: form.isShared ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: form.isShared ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : 'transparent' }} onClick={() => setForm({ ...form, isShared: !form.isShared })}>
                            <input type="checkbox" checked={form.isShared} onChange={(e) => setForm({ ...form, isShared: e.target.checked })} onClick={(e) => e.stopPropagation()} className="mt-0.5" />
                            <div><p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Share with all users</p><p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Makes this item visible to all family members</p></div>
                        </div>
                        <NotificationFields form={form} setForm={setForm} />
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
                <div>
                    {onDelete && (
                        <button type="button" className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white" onClick={onDelete}>
                            Delete
                        </button>
                    )}
                </div>
                <div className="flex gap-2 ml-auto">
                    <button type="button" className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50" onClick={onCancel}>
                        Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={loading}>{submitLabel}</button>
                </div>
            </div>
        </form>
    );
}

export default function HouseworkPage() {
    const qc = useQueryClient();
    const { user } = useAuthStore();
    const [searchParams, setSearchParams] = useSearchParams();
    const [showCreate, setShowCreate] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [form, setForm] = useState<HouseworkFormState>({ ...emptyForm });
    const [viewMode, setViewMode] = useLocalStorage<'grid' | 'list'>('ngocky:housework:viewMode', 'grid');
    const [filters, setFilters] = useLocalStorage<{
        dueDate: HouseworkDueDateFilter;
        frequency: HouseworkFrequencyFilter;
        status: HouseworkStatusFilter;
    }>('ngocky:housework:filters', { ...DEFAULT_HOUSEWORK_FILTERS });
    const [sortBy, setSortBy] = useLocalStorage<HouseworkSortKey>('ngocky:housework:sortBy', 'nextDueDate');
    const [sortOrder, setSortOrder] = useLocalStorage<'asc' | 'desc'>('ngocky:housework:sortOrder', 'asc');
    const [gridSort, setGridSort] = useState<HouseworkGridSort>('DUE_ASC');
    const [hwSearch, setHwSearch] = useState('');
    const editIdParam = searchParams.get('editId');

    const { data, isLoading } = useQuery({
        queryKey: ['housework'],
        queryFn: async () => (await api.get('/housework?limit=200')).data.data,
    });

    const createMut = useMutation({
        mutationFn: (body: any) => api.post('/housework', body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['housework'] });
            qc.invalidateQueries({ queryKey: ['calendar'] });
            qc.invalidateQueries({ queryKey: ['housework-calendar'] });
            setShowCreate(false);
            setForm({ ...emptyForm });
        },
    });

    const updateMut = useMutation({
        mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/housework/${id}`, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['housework'] });
            qc.invalidateQueries({ queryKey: ['calendar'] });
            qc.invalidateQueries({ queryKey: ['housework-calendar'] });
            setEditingItem(null);
            setForm({ ...emptyForm });
        },
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => api.delete(`/housework/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['housework'] });
            qc.invalidateQueries({ queryKey: ['calendar'] });
            qc.invalidateQueries({ queryKey: ['housework-calendar'] });
        },
    });

    const completeMut = useMutation({
        mutationFn: (id: string) => api.post(`/housework/${id}/complete`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['housework'] });
            qc.invalidateQueries({ queryKey: ['calendar'] });
            qc.invalidateQueries({ queryKey: ['housework-calendar'] });
        },
    });

    const buildBody = () => {
        const body: any = {
            title: form.title,
            description: form.description,
            isShared: form.isShared,
            status: form.status,
            frequencyType: form.frequencyType,
            pinToDashboard: form.pinToDashboard,
            showOnCalendar: form.nextDueDate ? form.showOnCalendar : false,
            ...buildNotificationPayload(form),
        };

        if (form.nextDueDate) body.nextDueDate = new Date(form.nextDueDate).toISOString();

        if (form.frequencyType === 'WEEKLY') body.dayOfWeek = Number(form.dayOfWeek);
        if (form.frequencyType === 'MONTHLY') body.dayOfMonth = Number(form.dayOfMonth);
        if (form.frequencyType === 'QUARTERLY' || form.frequencyType === 'HALF_YEARLY') {
            body.monthOfPeriod = Number(form.monthOfPeriod);
            body.dayOfMonth = Number(form.dayOfMonth);
        }
        if (form.frequencyType === 'YEARLY') {
            body.monthOfYear = Number(form.monthOfYear);
            body.dayOfMonth = Number(form.dayOfMonth);
        }

        return body;
    };

    const openCreate = () => {
        setEditingItem(null);
        setForm({ ...emptyForm });
        setShowCreate(true);
    };

    const duplicateItem = (item: any) => {
        setEditingItem(null);
        setForm(getNormalizedFormByFrequency({
            title: `${item.title} (copy)`,
            description: item.description || '',
            isShared: !!item.isShared,
            status: 'PLANNED',
            frequencyType: item.frequencyType || 'WEEKLY',
            nextDueDate: item.nextDueDate ? format(new Date(item.nextDueDate), 'yyyy-MM-dd') : '',
            showOnCalendar: !!item.showOnCalendar,
            pinToDashboard: !!item.pinToDashboard,
            ...loadNotificationState(item),
            dayOfWeek: String(item.dayOfWeek || '1'),
            dayOfMonth: String(item.dayOfMonth || '1'),
            monthOfPeriod: String(item.monthOfPeriod || '1'),
            monthOfYear: String(item.monthOfYear || '1'),
        }, item.frequencyType || 'WEEKLY'));
        setShowCreate(true);
    };

    const openEdit = (item: any) => {
        setShowCreate(false);
        setEditingItem(item);
        setForm(getNormalizedFormByFrequency({
            title: item.title || '',
            description: item.description || '',
            isShared: !!item.isShared,
            status: item.status === 'ARCHIVED' ? 'PLANNED' : item.status || 'PLANNED',
            frequencyType: item.frequencyType || 'WEEKLY',
            nextDueDate: item.nextDueDate ? format(new Date(item.nextDueDate), 'yyyy-MM-dd') : '',
            showOnCalendar: !!item.showOnCalendar,
            pinToDashboard: !!item.pinToDashboard,
            ...loadNotificationState(item),
            dayOfWeek: String(item.dayOfWeek || '1'),
            dayOfMonth: String(item.dayOfMonth || '1'),
            monthOfPeriod: String(item.monthOfPeriod || '1'),
            monthOfYear: String(item.monthOfYear || '1'),
        }, item.frequencyType || 'WEEKLY'));
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Delete this housework item?')) deleteMut.mutate(id);
    };

    useEffect(() => {
        if (!editIdParam || !(data || []).length) return;
        const item = (data || []).find((x: any) => x.id === editIdParam);
        if (item) openEdit(item);
    }, [editIdParam, data]);

    useEffect(() => {
        if (!editingItem && !showCreate && editIdParam) {
            setSearchParams({});
        }
    }, [editingItem, showCreate, editIdParam, setSearchParams]);

    const items = data || [];
    const today = startOfToday();
    const endThisWeek = endOfWeek(today, { weekStartsOn: 1 });
    const nextWeekStart = addWeeks(startOfWeek(today, { weekStartsOn: 1 }), 1);
    const nextWeekEnd = endOfWeek(nextWeekStart, { weekStartsOn: 1 });
    const thisMonthStart = startOfMonth(today);
    const thisMonthEnd = endOfMonth(today);
    const nextMonthStart = addMonths(thisMonthStart, 1);
    const nextMonthEnd = endOfMonth(nextMonthStart);

    const filteredItems = useMemo(() => {
        const q = hwSearch.toLowerCase();
        return items.filter((item: any) => {
            if (q && !item.title?.toLowerCase().includes(q) && !item.description?.toLowerCase().includes(q)) return false;
            if (filters.frequency !== 'ALL' && item.frequencyType !== filters.frequency) return false;
            const status = item.status === 'ARCHIVED' ? 'PLANNED' : item.status || 'PLANNED';
            if (filters.status !== 'ALL' && status !== filters.status) return false;

            const dueRange = getHouseworkDueDateRange(filters.dueDate);
            if (!dueRange) return true;
            if (!item.nextDueDate) return false;

            const dueDate = new Date(item.nextDueDate);
            return isWithinInterval(dueDate, dueRange);
        });
    }, [items, filters, hwSearch]);

    const sortedItems = useMemo(() => {
        return [...filteredItems].sort((a, b) => {
            const getValue = (item: any, key: HouseworkSortKey) => {
                switch (key) {
                    case 'title':
                        return item.title || '';
                    case 'description':
                        return item.description || '';
                    case 'frequencyType':
                        return item.frequencyType || '';
                    case 'status':
                        return item.status || '';
                    case 'nextDueDate':
                        return item.nextDueDate ? new Date(item.nextDueDate).getTime() : Number.MAX_SAFE_INTEGER;
                    case 'notification':
                        return formatNotification(item) || '';
                    case 'showOnCalendar':
                        return item.showOnCalendar ? 1 : 0;
                    default:
                        return '';
                }
            };

            const left = getValue(a, sortBy);
            const right = getValue(b, sortBy);
            const result = typeof left === 'number' && typeof right === 'number'
                ? left - right
                : String(left).localeCompare(String(right), undefined, { sensitivity: 'base' });

            return sortOrder === 'asc' ? result : -result;
        });
    }, [filteredItems, sortBy, sortOrder]);

    const gridSortedItems = useMemo(() => {
        return [...filteredItems].sort((a, b) => {
            if (gridSort === 'TITLE_ASC' || gridSort === 'TITLE_DESC') {
                const result = (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
                return gridSort === 'TITLE_ASC' ? result : -result;
            }

            const left = a.nextDueDate ? new Date(a.nextDueDate).getTime() : Number.MAX_SAFE_INTEGER;
            const right = b.nextDueDate ? new Date(b.nextDueDate).getTime() : Number.MAX_SAFE_INTEGER;
            const result = left - right;
            return gridSort === 'DUE_ASC' ? result : -result;
        });
    }, [filteredItems, gridSort]);

    const toggleSort = (column: HouseworkSortKey) => {
        if (sortBy === column) {
            setSortOrder((current) => current === 'asc' ? 'desc' : 'asc');
            return;
        }
        setSortBy(column);
        setSortOrder(column === 'nextDueDate' ? 'asc' : 'desc');
    };

    const renderSortIcon = (column: HouseworkSortKey) => {
        if (sortBy !== column) return <ArrowUp className="w-3.5 h-3.5 opacity-30" />;
        return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />;
    };

    const getHouseworkListSortValue = (): HouseworkListSortOption => {
        if (sortBy === 'title') return sortOrder === 'asc' ? 'TITLE_ASC' : 'TITLE_DESC';
        if (sortBy === 'description') return sortOrder === 'asc' ? 'DESCRIPTION_ASC' : 'DESCRIPTION_DESC';
        if (sortBy === 'frequencyType') return sortOrder === 'asc' ? 'FREQUENCY_ASC' : 'FREQUENCY_DESC';
        if (sortBy === 'status') return sortOrder === 'asc' ? 'STATUS_ASC' : 'STATUS_DESC';
        if (sortBy === 'notification') return sortOrder === 'asc' ? 'NOTIFICATION_ASC' : 'NOTIFICATION_DESC';
        if (sortBy === 'showOnCalendar') return sortOrder === 'asc' ? 'OPTIONS_ASC' : 'OPTIONS_DESC';
        return sortOrder === 'asc' ? 'DUE_ASC' : 'DUE_DESC';
    };

    const handleHouseworkListSortChange = (value: HouseworkListSortOption) => {
        switch (value) {
            case 'TITLE_ASC':
                setSortBy('title');
                setSortOrder('asc');
                break;
            case 'TITLE_DESC':
                setSortBy('title');
                setSortOrder('desc');
                break;
            case 'DESCRIPTION_ASC':
                setSortBy('description');
                setSortOrder('asc');
                break;
            case 'DESCRIPTION_DESC':
                setSortBy('description');
                setSortOrder('desc');
                break;
            case 'FREQUENCY_ASC':
                setSortBy('frequencyType');
                setSortOrder('asc');
                break;
            case 'FREQUENCY_DESC':
                setSortBy('frequencyType');
                setSortOrder('desc');
                break;
            case 'STATUS_ASC':
                setSortBy('status');
                setSortOrder('asc');
                break;
            case 'STATUS_DESC':
                setSortBy('status');
                setSortOrder('desc');
                break;
            case 'NOTIFICATION_ASC':
                setSortBy('notification');
                setSortOrder('asc');
                break;
            case 'NOTIFICATION_DESC':
                setSortBy('notification');
                setSortOrder('desc');
                break;
            case 'OPTIONS_ASC':
                setSortBy('showOnCalendar');
                setSortOrder('asc');
                break;
            case 'OPTIONS_DESC':
                setSortBy('showOnCalendar');
                setSortOrder('desc');
                break;
            case 'DUE_DESC':
                setSortBy('nextDueDate');
                setSortOrder('desc');
                break;
            case 'DUE_ASC':
            default:
                setSortBy('nextDueDate');
                setSortOrder('asc');
                break;
        }
    };

    const renderActions = (item: any, canManage: boolean) => (
        <div className="flex items-center gap-1">
            {canManage && (
                <>
                    <button
                        onClick={(e) => { e.stopPropagation(); updateMut.mutate({ id: item.id, body: { pinToDashboard: !item.pinToDashboard } }); }}
                        className={`p-1 transition-colors ${item.pinToDashboard ? 'text-amber-500 hover:text-amber-600' : 'text-gray-300 hover:text-amber-400'}`}
                        title="Pin item"
                    >
                        <Pin className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); duplicateItem(item); }} className="p-1 text-blue-500 hover:text-blue-600 transition-colors" title="Duplicate">
                        <Copy className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); openEdit(item); }} className="p-1 text-gray-400 hover:text-gray-600 transition-colors" title="Edit item">
                        <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="p-1 text-red-500 hover:text-red-600 transition-colors" title="Delete item">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </>
            )}
        </div>
    );

    const renderGridItem = (item: any) => {
        const dueBadge = getDueBadge(item);
        const recurrenceLabel = buildRecurrenceLabel(item);
        const sharedOwnerName = getSharedOwnerName(item, user?.id);
        const canManage = !sharedOwnerName;
        const notification = formatNotification(item);
        const notifBadges = formatNotificationBadges(item);

        return (
            <div
                key={item.id}
                className={`card p-5 transition-all group hover:shadow-lg animate-slide-up ${canManage ? 'cursor-pointer' : ''}`}
                onClick={() => { if (canManage) openEdit(item); }}
            >
                <div className="flex justify-between items-start gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-lg truncate" style={{ color: 'var(--color-text)' }}>{item.title}</h3>
                            {item.nextDueDate && new Date(item.nextDueDate) < today && item.status !== 'DONE' && <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                        </div>
                        {notifBadges.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap mt-1">
                                <Bell className={`w-3 h-3 flex-shrink-0 ${item.notificationEnabled ? 'text-red-500' : 'text-gray-300'}`} />
                                {notifBadges.map((b, i) => (
                                    <span key={i} className="text-xs px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium whitespace-nowrap">{b}</span>
                                ))}
                            </div>
                        )}
                        {sharedOwnerName && <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>Owner: {sharedOwnerName}</p>}
                    </div>
                    {renderActions(item, canManage)}
                </div>

                <p className="text-sm line-clamp-2 mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                    {item.description || 'No description provided.'}
                </p>

                <div className="flex items-center gap-2 flex-wrap mb-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getStatusTone(item.status || 'PLANNED')}`}>{getStatusLabel(item.status || 'PLANNED')}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{freqLabels[item.frequencyType]}</span>
                    {recurrenceLabel && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{recurrenceLabel}</span>}
                    {item.isShared && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Shared</span>}
                    {item.pinToDashboard && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Pinned</span>}
                    {item.showOnCalendar && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700">Housework</span>}
                    {!item.active && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Disabled</span>}
                </div>

                <div className="flex items-center gap-2 flex-wrap mb-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${dueBadge.tone}`}>{dueBadge.label}</span>
                    {notification && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">
                            Notify {notification}
                        </span>
                    )}
                    {item.lastCompletedDate && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                            Completed {format(new Date(item.lastCompletedDate), 'MMM d')}
                        </span>
                    )}
                </div>

                <div className="flex items-center justify-end pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                    {canManage && item.status !== 'DONE' && item.active !== false && (
                        <button
                            onClick={(e) => { e.stopPropagation(); completeMut.mutate(item.id); }}
                            disabled={completeMut.isPending}
                            className="btn-primary text-xs flex-shrink-0"
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Done
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const renderListItem = (item: any) => {
        const dueBadge = getDueBadge(item);
        const notification = formatNotification(item);
        const notifBadges = formatNotificationBadges(item);
        const sharedOwnerName = getSharedOwnerName(item, user?.id);
        const canManage = !sharedOwnerName;

        return (
            <tr
                key={item.id}
                className={`${canManage ? 'cursor-pointer hover:bg-slate-50' : ''} transition-colors`}
                onClick={() => { if (canManage) openEdit(item); }}
            >
                <td className="py-3 px-4">
                    <div className="min-w-[180px]">
                        <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{item.title}</p>
                        {notifBadges.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap mt-1">
                                <Bell className={`w-3 h-3 flex-shrink-0 ${item.notificationEnabled ? 'text-red-500' : 'text-gray-300'}`} />
                                {notifBadges.map((b, i) => (
                                    <span key={i} className="text-xs px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium whitespace-nowrap">{b}</span>
                                ))}
                            </div>
                        )}
                        {sharedOwnerName && <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>Owner: {sharedOwnerName}</p>}
                    </div>
                </td>
                <td className="py-3 px-4 max-w-[240px]">
                    <p className="text-sm line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>{item.description || 'No description'}</p>
                </td>
                <td className="py-3 px-4">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{freqLabels[item.frequencyType]}</span>
                </td>
                <td className="py-3 px-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getStatusTone(item.status || 'PLANNED')}`}>{getStatusLabel(item.status || 'PLANNED')}</span>
                </td>
                <td className="py-3 px-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${dueBadge.tone}`}>{dueBadge.label}</span>
                </td>
                <td className="py-3 px-4">
                    {notification ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">Notify {notification}</span>
                    ) : (
                        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>None</span>
                    )}
                </td>
                <td className="py-3 px-4">
                    <div className="flex items-center gap-1 flex-wrap">
                        {item.pinToDashboard && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">Pinned</span>}
                        {item.showOnCalendar && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 font-semibold">Housework</span>}
                        {item.isShared && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">Shared</span>}
                    </div>
                </td>
                <td className="py-3 px-4">
                    <div className="flex items-center gap-1 justify-end">
                        {canManage && item.status !== 'DONE' && item.active !== false && (
                            <button
                                onClick={(e) => { e.stopPropagation(); completeMut.mutate(item.id); }}
                                className="p-1 text-xs font-medium px-2 rounded text-green-600 bg-green-50 hover:bg-green-100"
                            >
                                Done
                            </button>
                        )}
                        <div onClick={(e) => e.stopPropagation()}>
                            {renderActions(item, canManage)}
                        </div>
                    </div>
                </td>
            </tr>
        );
    };

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <Home className="w-6 h-6" style={{ color: '#059669' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Housework</h2>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-lg border p-1 gap-1" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                        <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`} title="Grid view"><LayoutGrid className="w-4 h-4" /></button>
                        <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`} title="List view"><List className="w-4 h-4" /></button>
                    </div>
                    <button className="btn-primary whitespace-nowrap" onClick={openCreate}>
                        <Plus className="w-4 h-4" /> New Item
                    </button>
                </div>
            </div>

            <div className="card p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <Filter className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Filters</h3>
                </div>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                    <input
                        type="text"
                        className="input"
                        placeholder="Search items…"
                        value={hwSearch}
                        onChange={(e) => setHwSearch(e.target.value)}
                    />
                    <select className="input" value={filters.dueDate} onChange={(e) => setFilters((prev) => ({ ...prev, dueDate: e.target.value as HouseworkDueDateFilter }))}>
                        {HOUSEWORK_DUE_DATE_FILTER_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                    <select className="input" value={filters.frequency} onChange={(e) => setFilters((prev) => ({ ...prev, frequency: e.target.value as HouseworkFrequencyFilter }))}>
                        <option value="ALL">All Frequencies</option>
                        {frequencyOptions.map((k) => <option key={k} value={k}>{freqLabels[k]}</option>)}
                    </select>
                    <select className="input" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as HouseworkStatusFilter }))}>
                        {HOUSEWORK_STATUS_FILTER_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {(showCreate || editingItem) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) { setShowCreate(false); setEditingItem(null); } }}>
                    <div className="card p-6 w-full max-w-xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">{editingItem ? 'Edit Housework' : 'New Housework'}</h3>
                            <button onClick={() => { setShowCreate(false); setEditingItem(null); }}><X className="w-5 h-5" /></button>
                        </div>
                        <HouseworkForm
                            form={form}
                            setForm={setForm}
                            onSubmit={() => {
                                if (editingItem) updateMut.mutate({ id: editingItem.id, body: buildBody() });
                                else createMut.mutate(buildBody());
                            }}
                            onCancel={() => { setShowCreate(false); setEditingItem(null); }}
                            onDelete={editingItem ? () => {
                                if (window.confirm('Delete this housework item?')) {
                                    deleteMut.mutate(editingItem.id);
                                    setEditingItem(null);
                                }
                            } : undefined}
                            loading={createMut.isPending || updateMut.isPending}
                            submitLabel={editingItem ? 'Save' : 'Create'}
                        />
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="card p-5 h-20 animate-pulse bg-gray-100" />)}</div>
            ) : sortedItems.length === 0 ? (
                <div className="card p-8 text-center">
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No housework items match the current filters.</p>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {gridSortedItems.map((item: any) => renderGridItem(item))}
                </div>
            ) : (
                <div className="table-container">
                    <table className="w-full">
                        <thead>
                            <tr>
                                <th><button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleSort('title')}>Title {renderSortIcon('title')}</button></th>
                                <th><button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleSort('description')}>Description {renderSortIcon('description')}</button></th>
                                <th><button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleSort('frequencyType')}>Frequency {renderSortIcon('frequencyType')}</button></th>
                                <th><button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleSort('status')}>Status {renderSortIcon('status')}</button></th>
                                <th><button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleSort('nextDueDate')}>Due Date {renderSortIcon('nextDueDate')}</button></th>
                                <th><button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleSort('notification')}>Notification {renderSortIcon('notification')}</button></th>
                                <th><button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleSort('showOnCalendar')}>Options {renderSortIcon('showOnCalendar')}</button></th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedItems.map((item: any) => renderListItem(item))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
