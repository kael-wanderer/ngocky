import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { Target, Plus, X, Check, TrendingUp, Trash2, AlertCircle, Pencil, Copy, Pin } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

const unitOptions = [
    { value: 'times', label: 'Time' },
    { value: 'minutes', label: 'Minute' },
] as const;

const reminderUnitOptions = [
    { value: 'MINUTES', label: 'Mins' },
    { value: 'HOURS', label: 'Hour' },
    { value: 'DAYS', label: 'Days' },
] as const;

const emptyForm = {
    title: '',
    description: '',
    isShared: false,
    pinToDashboard: false,
    periodType: 'WEEKLY',
    targetCount: 3,
    unit: 'times',
    trackingType: 'BY_FREQUENCY',
    notificationEnabled: false,
    reminderOffsetUnit: 'DAYS',
    reminderOffsetValue: 1,
};

type GoalFormState = typeof emptyForm;

function GoalForm({
    form,
    setForm,
    onSubmit,
    loading,
    isEdit,
}: {
    form: GoalFormState;
    setForm: React.Dispatch<React.SetStateAction<GoalFormState>>;
    onSubmit: (f: GoalFormState) => void;
    loading: boolean;
    isEdit: boolean;
}) {
    return (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
            <div>
                <label className="label">Goal Title <span className="text-red-500">*</span></label>
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Go to gym" />
            </div>
            <div>
                <label className="label">Description</label>
                <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional notes about this goal" />
            </div>

            <div>
                <label className="label">How to track progress? <span className="text-red-500">*</span></label>
                <select className="input" value={form.trackingType} onChange={(e) => setForm({ ...form, trackingType: e.target.value })}>
                    <option value="BY_FREQUENCY">By times</option>
                    <option value="BY_QUANTITY">By amount</option>
                </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="label">Target <span className="text-red-500">*</span></label>
                    <select className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                        {unitOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="label">Unit <span className="text-red-500">*</span></label>
                    <input type="number" className="input" min={1} value={form.targetCount} onChange={(e) => setForm({ ...form, targetCount: parseInt(e.target.value) || 1 })} required />
                </div>
            </div>

            <div>
                <label className="label">Reset Period <span className="text-red-500">*</span></label>
                <select className="input" value={form.periodType} onChange={(e) => setForm({ ...form, periodType: e.target.value })}>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                </select>
            </div>

            <div className="grid grid-cols-1 gap-2">
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.notificationEnabled} onChange={(e) => setForm({ ...form, notificationEnabled: e.target.checked })} />
                    Reminder enabled
                </label>
                {form.notificationEnabled && (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Before deadline</label>
                            <select className="input" value={form.reminderOffsetUnit} onChange={(e) => setForm({ ...form, reminderOffsetUnit: e.target.value })}>
                                {reminderUnitOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">Unit</label>
                            <input type="number" min={1} className="input" value={form.reminderOffsetValue} onChange={(e) => setForm({ ...form, reminderOffsetValue: parseInt(e.target.value) || 1 })} />
                        </div>
                    </div>
                )}
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.isShared} onChange={(e) => setForm({ ...form, isShared: e.target.checked })} />
                    Share with all users
                </label>
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.pinToDashboard} onChange={(e) => setForm({ ...form, pinToDashboard: e.target.checked })} />
                    Pin to dashboard
                </label>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Goal')}
            </button>
        </form>
    );
}

export default function GoalsPage() {
    const qc = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();
    const [showCreate, setShowCreate] = useState(false);
    const [editGoal, setEditGoal] = useState<any>(null);
    const [checkInGoalId, setCheckInGoalId] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [dateError, setDateError] = useState('');
    const [duration, setDuration] = useState<number | ''>('');
    const [quantity, setQuantity] = useState(1);
    const [periodFilter, setPeriodFilter] = useState<'ALL' | 'WEEKLY' | 'MONTHLY'>('ALL');
    const [form, setForm] = useState({ ...emptyForm });
    const editIdParam = searchParams.get('editId');
    const checkInIdParam = searchParams.get('checkInId');

    const { data, isLoading } = useQuery({
        queryKey: ['goals'],
        queryFn: async () => (await api.get('/goals?limit=50')).data.data,
    });

    const createMut = useMutation({
        mutationFn: (body: any) => api.post('/goals', body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['goals'] });
            setShowCreate(false);
            setForm({ ...emptyForm });
        },
    });

    const updateMut = useMutation({
        mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/goals/${id}`, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['goals'] });
            setEditGoal(null);
        },
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => api.delete(`/goals/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
    });

    const resetMut = useMutation({
        mutationFn: (id: string) => api.post(`/goals/${id}/reset`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['goals'] });
            alert('Goal count recalculated from actual check-in history.');
        },
    });

    const checkInMut = useMutation({
        mutationFn: (body: any) => api.post('/checkins', body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['goals'] });
            setCheckInGoalId(null);
            setNote('');
            setDate(new Date().toISOString().split('T')[0]);
            setQuantity(1);
            setDuration('');
            setDateError('');
        },
        onError: (err: any) => {
            alert(err?.response?.data?.message || 'Check-in failed. Please try again.');
        },
    });

    const selectedGoal = (data || []).find((g: any) => g.id === checkInGoalId);
    const filteredGoals = useMemo(() => {
        const goals = data || [];
        if (periodFilter === 'ALL') return goals;
        return goals.filter((goal: any) => goal.periodType === periodFilter);
    }, [data, periodFilter]);

    const today = new Date().toISOString().split('T')[0];
    const minDateObj = new Date();
    minDateObj.setDate(minDateObj.getDate() - 45);
    const minDate = minDateObj.toISOString().split('T')[0];

    const handleDateChange = (val: string) => {
        setDate(val);
        if (!val) { setDateError(''); return; }
        if (val > today) {
            setDateError(`Future dates are not allowed. Latest allowed date: ${today}.`);
        } else if (val < minDate) {
            setDateError(`Too far in the past. Earliest allowed date: ${minDate} (last 45 days).`);
        } else {
            setDateError('');
        }
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Delete this goal and ALL its check-ins? This cannot be undone.')) {
            deleteMut.mutate(id);
        }
    };

    const openEdit = (goal: any) => {
        setEditGoal(goal);
        setForm({
            title: goal.title,
            description: goal.description || '',
            isShared: !!goal.isShared,
            pinToDashboard: !!goal.pinToDashboard,
            periodType: goal.periodType,
            targetCount: goal.targetCount,
            unit: goal.unit || 'times',
            trackingType: goal.trackingType || 'BY_FREQUENCY',
            notificationEnabled: !!goal.notificationEnabled,
            reminderOffsetUnit: goal.reminderOffsetUnit || 'DAYS',
            reminderOffsetValue: goal.reminderOffsetValue || 1,
        });
    };

    const openDuplicate = (goal: any) => {
        setEditGoal(null);
        setForm({
            title: `${goal.title} (Copy)`,
            description: goal.description || '',
            isShared: !!goal.isShared,
            pinToDashboard: !!goal.pinToDashboard,
            periodType: goal.periodType,
            targetCount: goal.targetCount,
            unit: goal.unit || 'times',
            trackingType: goal.trackingType || 'BY_FREQUENCY',
            notificationEnabled: !!goal.notificationEnabled,
            reminderOffsetUnit: goal.reminderOffsetUnit || 'DAYS',
            reminderOffsetValue: goal.reminderOffsetValue || 1,
        });
        setShowCreate(true);
    };

    const togglePin = (goal: any) => {
        updateMut.mutate({ id: goal.id, body: { pinToDashboard: !goal.pinToDashboard } });
    };

    const openCheckIn = (goalId: string) => {
        setCheckInGoalId(goalId);
        setDate(new Date().toISOString().split('T')[0]);
        setQuantity(1);
        setDuration('');
        setNote('');
        setDateError('');
    };

    const handleCheckInSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (dateError || date < minDate || date > today) {
            alert(dateError || `Date must be between ${minDate} and ${today}.`);
            return;
        }
        const localDate = new Date(`${date}T12:00:00`);
        const payload: any = {
            goalId: checkInGoalId,
            quantity: selectedGoal?.trackingType === 'BY_QUANTITY' ? quantity : 1,
            date: localDate.toISOString(),
        };
        const noteText = [
            selectedGoal?.trackingType === 'BY_FREQUENCY' && duration ? `Duration: ${duration} mins` : '',
            note,
        ].filter(Boolean).join(' | ');
        if (noteText) payload.note = noteText;

        checkInMut.mutate(payload);
    };

    useEffect(() => {
        if (!data?.length) return;
        if (editIdParam) {
            const goal = data.find((g: any) => g.id === editIdParam);
            if (goal) openEdit(goal);
        }
        if (checkInIdParam) {
            const goal = data.find((g: any) => g.id === checkInIdParam);
            if (goal) openCheckIn(goal.id);
        }
    }, [data, editIdParam, checkInIdParam]);

    useEffect(() => {
        if (!editGoal && !checkInGoalId && !showCreate && (editIdParam || checkInIdParam)) {
            setSearchParams({});
        }
    }, [editGoal, checkInGoalId, showCreate, editIdParam, checkInIdParam, setSearchParams]);

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <Target className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Goals</h2>
                </div>
                <div className="flex items-center gap-2">
                    <select className="input min-w-[160px]" value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value as any)}>
                        <option value="ALL">All reset periods</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                    </select>
                    <button className="btn-primary" onClick={() => { setForm({ ...emptyForm }); setShowCreate(true); }}>
                        <Plus className="w-4 h-4" /> New Goal
                    </button>
                </div>
            </div>

            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}>
                    <div className="card p-6 w-full max-w-md animate-slide-up overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Create New Goal</h3>
                            <button onClick={() => setShowCreate(false)}><X className="w-5 h-5" /></button>
                        </div>
                        <GoalForm form={form} setForm={setForm} onSubmit={(f) => createMut.mutate(f)} loading={createMut.isPending} isEdit={false} />
                    </div>
                </div>
            )}

            {editGoal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditGoal(null); }}>
                    <div className="card p-6 w-full max-w-md animate-slide-up overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Edit Goal</h3>
                            <button onClick={() => setEditGoal(null)}><X className="w-5 h-5" /></button>
                        </div>
                        <GoalForm form={form} setForm={setForm} onSubmit={(f) => updateMut.mutate({ id: editGoal.id, body: f })} loading={updateMut.isPending} isEdit />
                    </div>
                </div>
            )}

            {checkInGoalId && selectedGoal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setCheckInGoalId(null); }}>
                    <div className="card p-6 w-full max-w-sm animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Check-in</h3>
                            <button onClick={() => setCheckInGoalId(null)}><X className="w-5 h-5" /></button>
                        </div>
                        <p className="text-sm font-medium mb-4" style={{ color: 'var(--color-primary)' }}>{selectedGoal.title}</p>
                        <form onSubmit={handleCheckInSubmit} className="space-y-4">
                            <div>
                                <label className="label">Check-in Date <span className="text-red-500">*</span></label>
                                <input type="date" className={`input ${dateError ? 'border-red-400 ring-1 ring-red-300' : ''}`} min={minDate} max={today} value={date} onChange={(e) => handleDateChange(e.target.value)} required />
                                {dateError ? (
                                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3 flex-shrink-0" /> {dateError}</p>
                                ) : (
                                    <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>Allowed range: {minDate} → {today}</p>
                                )}
                            </div>

                            {selectedGoal.trackingType === 'BY_FREQUENCY' && (
                                <>
                                    <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100">
                                        <p className="text-xs text-indigo-700 font-semibold">This check-in will add <strong>+1</strong> to your count.</p>
                                        <p className="text-[10px] text-indigo-500 mt-0.5">Current: {selectedGoal.currentCount}/{selectedGoal.targetCount} {selectedGoal.unit}</p>
                                    </div>
                                    <div>
                                        <label className="label">Duration (mins) - optional</label>
                                        <input type="number" min={1} className="input" placeholder="e.g. 60" value={duration} onChange={(e) => setDuration(e.target.value ? parseInt(e.target.value) : '')} />
                                    </div>
                                </>
                            )}

                            {selectedGoal.trackingType === 'BY_QUANTITY' && (
                                <div>
                                    <label className="label">Amount ({selectedGoal.unit}) <span className="text-red-500">*</span></label>
                                    <input type="number" min={1} className="input" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} required />
                                </div>
                            )}

                            <div>
                                <label className="label">Note</label>
                                <input className="input" placeholder="How did it go?" value={note} onChange={(e) => setNote(e.target.value)} />
                            </div>

                            <button type="submit" className="btn-primary w-full" disabled={checkInMut.isPending || !!dateError}>
                                <Check className="w-4 h-4" />
                                {checkInMut.isPending ? 'Saving...' : 'Record Check-in'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="card p-5 h-32 animate-pulse bg-gray-100" />)}</div>
            ) : filteredGoals.length === 0 ? (
                <div className="card p-12 flex flex-col items-center border-dashed border-2">
                    <Target className="w-12 h-12 mb-4 opacity-10" />
                    <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text-secondary)' }}>No goals yet</h3>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Set your first goal and start building habits.</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {filteredGoals.map((goal: any) => {
                        const progressPct = goal.targetCount > 0 ? (goal.currentCount / goal.targetCount) * 100 : 0;
                        const barPct = Math.min(100, progressPct);
                        const completed = goal.currentCount >= goal.targetCount;
                        const overachieved = progressPct > 100;
                        return (
                            <div key={goal.id} className="card p-5 animate-slide-up hover:shadow-lg transition-shadow">
                                <div className="flex items-start justify-between mb-2 gap-3">
                                    <div className="flex-1 min-w-0 pr-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="font-semibold" style={{ color: 'var(--color-text)' }}>{goal.title}</h4>
                                            {goal.isShared && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">Shared</span>}
                                            {goal.pinToDashboard && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">Pinned</span>}
                                        </div>
                                        {goal.description && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{goal.description}</p>}
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100" style={{ color: 'var(--color-text-secondary)' }}>{goal.trackingType === 'BY_FREQUENCY' ? 'Count-based' : 'Amount-based'}</span>
                                            <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>{goal.periodType}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button onClick={() => togglePin(goal)} className={`p-1 transition-colors ${goal.pinToDashboard ? 'text-amber-500' : 'hover:text-amber-500'}`} title="Pin goal">
                                            <Pin className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => openEdit(goal)} className="p-1 hover:text-indigo-500 transition-colors" title="Edit goal"><Pencil className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => openDuplicate(goal)} className="p-1 hover:text-sky-500 transition-colors" title="Duplicate goal"><Copy className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => { if (window.confirm('Recalculate count from actual check-in history?')) resetMut.mutate(goal.id); }} className="p-1 hover:text-blue-500 transition-colors" title="Fix/recalculate count" disabled={resetMut.isPending}><span className="text-xs leading-none">🔄</span></button>
                                        <button onClick={() => handleDelete(goal.id)} className="p-1 hover:text-red-500 transition-colors" title="Delete goal"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 mb-3">
                                    <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${barPct}%`, background: overachieved ? 'linear-gradient(90deg, #059669, #34d399)' : completed ? 'linear-gradient(90deg, #059669, #10b981)' : 'linear-gradient(90deg, #4f46e5, #7c3aed)' }} />
                                    </div>
                                    <span className="text-sm font-bold whitespace-nowrap" style={{ color: completed ? '#059669' : 'var(--color-primary)' }}>{Math.round(progressPct)}%</span>
                                </div>

                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                        {goal.currentCount}/{goal.targetCount} {goal.unit}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <button className="btn-primary text-xs py-1.5 px-3" onClick={() => openCheckIn(goal.id)} disabled={!goal.active}><Check className="w-3 h-3" /> Check-in</button>
                                        {completed && <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Done</span>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
