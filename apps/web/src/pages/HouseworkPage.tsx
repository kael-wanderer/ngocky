import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { Home, Plus, X, CheckCircle2, AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useSearchParams } from 'react-router-dom';

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

const frequencyOptions = ['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'];

type HouseworkFormState = {
    title: string;
    description: string;
    frequencyType: string;
    nextDueDate: string;
    dayOfWeek: string;
    dayOfMonth: string;
    monthOfPeriod: string;
    monthOfYear: string;
};

const emptyForm: HouseworkFormState = {
    title: '',
    description: '',
    frequencyType: 'WEEKLY',
    nextDueDate: '',
    dayOfWeek: '1',
    dayOfMonth: '1',
    monthOfPeriod: '1',
    monthOfYear: '1',
};

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
    loading,
    submitLabel,
}: {
    form: HouseworkFormState;
    setForm: React.Dispatch<React.SetStateAction<HouseworkFormState>>;
    onSubmit: () => void;
    loading: boolean;
    submitLabel: string;
}) {
    return (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4">
            <div><label className="label">Title <span className="text-red-500">*</span></label><input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="label">Frequency <span className="text-red-500">*</span></label>
                    <select className="input" value={form.frequencyType} onChange={(e) => setForm((prev) => getNormalizedFormByFrequency(prev, e.target.value))}>
                        {frequencyOptions.map((k) => <option key={k} value={k}>{freqLabels[k]}</option>)}
                    </select>
                </div>
                <div>
                    <label className="label">Next Due</label>
                    <input type="date" className="input" value={form.nextDueDate} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} />
                </div>
            </div>

            <RecurrenceRuleFields form={form} setForm={setForm} />

            <button type="submit" className="btn-primary w-full" disabled={loading}>{submitLabel}</button>
        </form>
    );
}

export default function HouseworkPage() {
    const qc = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();
    const [showCreate, setShowCreate] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [form, setForm] = useState({ ...emptyForm });
    const editIdParam = searchParams.get('editId');

    const { data, isLoading } = useQuery({
        queryKey: ['housework'],
        queryFn: async () => (await api.get('/housework?limit=50')).data.data,
    });

    const createMut = useMutation({
        mutationFn: (body: any) => api.post('/housework', body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['housework'] });
            setShowCreate(false);
            setForm({ ...emptyForm });
        },
    });

    const updateMut = useMutation({
        mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/housework/${id}`, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['housework'] });
            setEditingItem(null);
            setForm({ ...emptyForm });
        },
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => api.delete(`/housework/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['housework'] }),
    });

    const completeMut = useMutation({
        mutationFn: (id: string) => api.post(`/housework/${id}/complete`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['housework'] }),
    });

    const buildBody = () => {
        const body: any = {
            title: form.title,
            description: form.description,
            frequencyType: form.frequencyType,
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

    const openEdit = (item: any) => {
        setEditingItem(item);
        setForm(getNormalizedFormByFrequency({
            title: item.title || '',
            description: item.description || '',
            frequencyType: item.frequencyType || 'WEEKLY',
            nextDueDate: item.nextDueDate ? new Date(item.nextDueDate).toISOString().split('T')[0] : '',
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

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const getDueBucket = (nextDueDate?: string | null): 'overdue' | 'today' | 'upcoming' | 'unscheduled' => {
        if (!nextDueDate) return 'unscheduled';
        const due = new Date(nextDueDate);
        if (due < todayStart) return 'overdue';
        if (due < tomorrowStart) return 'today';
        return 'upcoming';
    };

    const allItems = data || [];
    const overdueItems = allItems.filter((item: any) => getDueBucket(item.nextDueDate) === 'overdue');
    const todayItems = allItems.filter((item: any) => getDueBucket(item.nextDueDate) === 'today');
    const upcomingItems = allItems.filter((item: any) => getDueBucket(item.nextDueDate) === 'upcoming');
    const unscheduledItems = allItems.filter((item: any) => getDueBucket(item.nextDueDate) === 'unscheduled');

    const renderItem = (item: any, tone: 'normal' | 'overdue' = 'normal') => {
        const overdue = tone === 'overdue';
        const recurrenceLabel = buildRecurrenceLabel(item);
        return (
            <div key={item.id} className={`card p-4 flex items-center gap-4 animate-slide-up ${overdue ? 'border-red-200' : ''}`}>
                <button
                    onClick={() => completeMut.mutate(item.id)}
                    disabled={completeMut.isPending}
                    className={`btn-primary flex-shrink-0 text-xs ${overdue ? 'bg-red-600 hover:bg-red-700' : ''}`}
                    title="Mark complete"
                >
                    <CheckCircle2 className="w-4 h-4" /> Mark Complete
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="font-medium truncate" style={{ color: 'var(--color-text)' }}>{item.title}</p>
                        {overdue && <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="badge-primary text-[10px]">{freqLabels[item.frequencyType]}</span>
                        {item.nextDueDate && (
                            <span className="text-xs" style={{ color: overdue ? '#dc2626' : 'var(--color-text-secondary)' }}>
                                Due: {format(new Date(item.nextDueDate), 'MMM d, yyyy')}
                            </span>
                        )}
                        {recurrenceLabel && (
                            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{recurrenceLabel}</span>
                        )}
                        {item.assignee && (
                            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>👤 {item.assignee.name}</span>
                        )}
                        {item.estimatedCost && (
                            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>💰 ${item.estimatedCost}</span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => openEdit(item)}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        title="Edit item"
                    >
                        <Pencil className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                        title="Delete item"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>

                {!item.active && <span className="badge bg-gray-100 text-gray-500">Inactive</span>}
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Home className="w-6 h-6" style={{ color: '#059669' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Housework</h2>
                </div>
                <button className="btn-primary" onClick={() => { setForm({ ...emptyForm }); setShowCreate(true); }}>
                    <Plus className="w-4 h-4" /> New Item
                </button>
            </div>

            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCreate(false)}>
                    <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">New Housework</h3>
                            <button onClick={() => setShowCreate(false)}><X className="w-5 h-5" /></button>
                        </div>
                        <HouseworkForm
                            form={form}
                            setForm={setForm}
                            onSubmit={() => createMut.mutate(buildBody())}
                            loading={createMut.isPending}
                            submitLabel="Create"
                        />
                    </div>
                </div>
            )}

            {editingItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditingItem(null)}>
                    <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Edit Housework</h3>
                            <button onClick={() => setEditingItem(null)}><X className="w-5 h-5" /></button>
                        </div>
                        <HouseworkForm
                            form={form}
                            setForm={setForm}
                            onSubmit={() => updateMut.mutate({ id: editingItem.id, body: buildBody() })}
                            loading={updateMut.isPending}
                            submitLabel="Save Changes"
                        />
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="card p-5 h-20 animate-pulse bg-gray-100" />)}</div>
            ) : (
                <div className="space-y-5">
                    <div>
                        <h3 className="text-sm font-semibold mb-2 text-red-600">Overdue ({overdueItems.length})</h3>
                        <div className="space-y-3">
                            {overdueItems.length === 0
                                ? <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No overdue housework</p>
                                : overdueItems.map((item: any) => renderItem(item, 'overdue'))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Due Today ({todayItems.length})</h3>
                        <div className="space-y-3">
                            {todayItems.length === 0
                                ? <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No housework due today</p>
                                : todayItems.map((item: any) => renderItem(item))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Upcoming ({upcomingItems.length})</h3>
                        <div className="space-y-3">
                            {upcomingItems.length === 0
                                ? <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No upcoming housework</p>
                                : upcomingItems.map((item: any) => renderItem(item))}
                        </div>
                    </div>

                    {unscheduledItems.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Unscheduled ({unscheduledItems.length})</h3>
                            <div className="space-y-3">
                                {unscheduledItems.map((item: any) => renderItem(item))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
