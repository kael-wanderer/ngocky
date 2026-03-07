import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { Target, Plus, X, Check, TrendingUp, Trash2, AlertCircle } from 'lucide-react';

export default function GoalsPage() {
    const qc = useQueryClient();
    const [showCreate, setShowCreate] = useState(false);
    const [checkInGoalId, setCheckInGoalId] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [dateError, setDateError] = useState('');
    const [quantity, setQuantity] = useState(1);

    const { data, isLoading } = useQuery({
        queryKey: ['goals'],
        queryFn: async () => (await api.get('/goals?limit=50')).data.data,
    });

    const createMut = useMutation({
        mutationFn: (body: any) => api.post('/goals', body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['goals'] });
            setShowCreate(false);
            setForm({ title: '', description: '', periodType: 'WEEKLY', targetCount: 3, unit: 'times', trackingType: 'BY_FREQUENCY' });
        },
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => api.delete(`/goals/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
    });

    const checkInMut = useMutation({
        mutationFn: (body: any) => api.post('/checkins', body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['goals'] });
            setCheckInGoalId(null);
            setNote('');
            setDate(new Date().toISOString().split('T')[0]);
            setQuantity(1);
            setDateError('');
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.message || 'Check-in failed';
            alert(msg);
        }
    });

    const [form, setForm] = useState({
        title: '',
        description: '',
        periodType: 'WEEKLY',
        targetCount: 3,
        unit: 'times',
        trackingType: 'BY_FREQUENCY'
    });

    const selectedGoal = (data || []).find((g: any) => g.id === checkInGoalId);

    // Date range helpers
    const today = new Date().toISOString().split('T')[0];
    const fortyFiveDaysAgo = new Date();
    fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
    const minDate = fortyFiveDaysAgo.toISOString().split('T')[0];

    const handleDateChange = (val: string) => {
        setDate(val);
        if (!val) { setDateError(''); return; }
        if (val > today) {
            setDateError('⚠️ Future dates are not allowed. Please select today or an earlier date.');
        } else if (val < minDate) {
            setDateError(`⚠️ Date too far in the past. Only the last 45 days are allowed (from ${minDate} to ${today}).`);
        } else {
            setDateError('');
        }
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to delete this goal? All check-ins will also be deleted.')) {
            deleteMut.mutate(id);
        }
    };

    const handleCheckInSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (dateError) {
            alert(dateError);
            return;
        }
        if (date < minDate || date > today) {
            alert(`Check-in date must be between ${minDate} and ${today}.`);
            return;
        }
        // Append current time so the ISO string is correct
        const localDate = new Date(`${date}T12:00:00`);
        checkInMut.mutate({
            goalId: checkInGoalId,
            quantity,
            note: note || undefined,
            date: localDate.toISOString(),
        });
    };

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Target className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Goals</h2>
                </div>
                <button className="btn-primary" onClick={() => setShowCreate(true)}>
                    <Plus className="w-4 h-4" /> New Goal
                </button>
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCreate(false)}>
                    <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Create Goal</h3>
                            <button onClick={() => setShowCreate(false)}><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} className="space-y-4">
                            <div>
                                <label className="label">Title <span className="text-red-500">*</span></label>
                                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Go to gym" />
                            </div>
                            <div>
                                <label className="label">Description</label>
                                <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                            </div>

                            <div>
                                <label className="label">Tracking Type <span className="text-red-500">*</span></label>
                                <select className="input" value={form.trackingType} onChange={(e) => setForm({ ...form, trackingType: e.target.value, unit: e.target.value === 'BY_FREQUENCY' ? 'times' : form.unit })}>
                                    <option value="BY_FREQUENCY">By Times — e.g. go to gym 3×/week (each check-in = +1)</option>
                                    <option value="BY_QUANTITY">By Amount — e.g. run 50 km/month (sums your input)</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">
                                        {form.trackingType === 'BY_FREQUENCY' ? 'Target (times)' : 'Target amount'} <span className="text-red-500">*</span>
                                    </label>
                                    <input type="number" className="input" min={1} value={form.targetCount} onChange={(e) => setForm({ ...form, targetCount: parseInt(e.target.value) })} />
                                </div>
                                <div>
                                    <label className="label">Unit <span className="text-red-500">*</span></label>
                                    <input className="input" value={form.unit}
                                        onChange={(e) => setForm({ ...form, unit: e.target.value })}
                                        placeholder={form.trackingType === 'BY_FREQUENCY' ? 'times' : 'km, mins, pages…'}
                                        required />
                                </div>
                            </div>

                            <div>
                                <label className="label">Period <span className="text-red-500">*</span></label>
                                <select className="input" value={form.periodType} onChange={(e) => setForm({ ...form, periodType: e.target.value })}>
                                    <option value="WEEKLY">Weekly (resets every Monday)</option>
                                    <option value="MONTHLY">Monthly (resets on 1st)</option>
                                </select>
                            </div>

                            <button type="submit" className="btn-primary w-full" disabled={createMut.isPending}>
                                {createMut.isPending ? 'Creating...' : 'Create Goal'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Check-in Modal */}
            {checkInGoalId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCheckInGoalId(null)}>
                    <div className="card p-6 w-full max-w-sm animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Quick Check-in</h3>
                            <button onClick={() => setCheckInGoalId(null)}><X className="w-5 h-5" /></button>
                        </div>
                        {selectedGoal && (
                            <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                                Goal: <strong>{selectedGoal.title}</strong> — {selectedGoal.trackingType === 'BY_FREQUENCY'
                                    ? 'Each check-in counts as +1 (frequency-based)'
                                    : `Input is summed (quantity-based, unit: ${selectedGoal.unit})`}
                            </p>
                        )}
                        <form onSubmit={handleCheckInSubmit} className="space-y-4">
                            <div>
                                <label className="label">Date <span className="text-red-500">*</span></label>
                                <input
                                    type="date"
                                    className={`input ${dateError ? 'border-red-400' : ''}`}
                                    min={minDate}
                                    max={today}
                                    value={date}
                                    onChange={(e) => handleDateChange(e.target.value)}
                                    required
                                />
                                {dateError && (
                                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3 flex-shrink-0" /> {dateError}
                                    </p>
                                )}
                                <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                    Allowed: {minDate} → {today}
                                </p>
                            </div>

                            {selectedGoal?.trackingType === 'BY_QUANTITY' && (
                                <div>
                                    <label className="label">Amount ({selectedGoal?.unit || 'units'}) <span className="text-red-500">*</span></label>
                                    <input type="number" min={1} className="input" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value))} required />
                                </div>
                            )}

                            {selectedGoal?.trackingType === 'BY_FREQUENCY' && (
                                <div className="p-3 rounded-lg bg-indigo-50 text-indigo-700 text-xs flex items-start gap-2">
                                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    <span>This is a <strong>frequency-based</strong> goal. Each check-in automatically adds <strong>+1</strong> to your progress, regardless of the amount you enter.</span>
                                </div>
                            )}

                            <div>
                                <label className="label">Note (optional)</label>
                                <input className="input" placeholder="What did you do?" value={note} onChange={(e) => setNote(e.target.value)} />
                            </div>
                            <button type="submit" className="btn-primary w-full" disabled={checkInMut.isPending || !!dateError}>
                                <Check className="w-4 h-4" /> {checkInMut.isPending ? 'Recording...' : 'Record Check-in'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Goals List */}
            {isLoading ? (
                <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="card p-5 h-32 animate-pulse bg-gray-100" />)}</div>
            ) : (data || []).length === 0 ? (
                <div className="card p-12 flex flex-col items-center border-dashed border-2">
                    <Target className="w-12 h-12 mb-4 opacity-10" />
                    <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text-secondary)' }}>No goals yet</h3>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Create your first goal to start tracking.</p>
                    <button className="btn-primary mt-6" onClick={() => setShowCreate(true)}>
                        <Plus className="w-4 h-4" /> New Goal
                    </button>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {(data || []).map((goal: any) => {
                        const progressPct = goal.targetCount > 0 ? (goal.currentCount / goal.targetCount) * 100 : 0;
                        const progressBarPct = Math.min(100, progressPct); // bar caps at 100
                        const overachieved = progressPct > 100;
                        const completed = goal.currentCount >= goal.targetCount;
                        return (
                            <div key={goal.id} className="card p-5 animate-slide-up hover:shadow-lg transition-shadow">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1 min-w-0 pr-2">
                                        <h4 className="font-semibold" style={{ color: 'var(--color-text)' }}>{goal.title}</h4>
                                        {goal.description && (
                                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{goal.description}</p>
                                        )}
                                        <p className="text-[10px] mt-1 font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                            {goal.trackingType === 'BY_FREQUENCY' ? '📌 Frequency' : '📊 Quantity'} · {goal.periodType === 'WEEKLY' ? 'Resets Monday' : 'Resets 1st of month'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <span className={`badge ${goal.periodType === 'WEEKLY' ? 'badge-primary' : 'badge-warning'}`}>
                                            {goal.periodType}
                                        </span>
                                        <button onClick={() => handleDelete(goal.id)} className="p-1 hover:text-red-500 transition-colors" title="Delete goal">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-700 ease-out"
                                            style={{
                                                width: `${progressBarPct}%`,
                                                background: overachieved
                                                    ? 'linear-gradient(90deg, #059669, #34d399)'
                                                    : completed
                                                        ? 'linear-gradient(90deg, #059669, #10b981)'
                                                        : 'linear-gradient(90deg, #4f46e5, #7c3aed)',
                                            }}
                                        />
                                    </div>
                                    <span className="text-sm font-bold whitespace-nowrap" style={{ color: overachieved ? '#059669' : completed ? '#059669' : 'var(--color-primary)' }}>
                                        {goal.currentCount}/{goal.targetCount} {goal.unit}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <button
                                            className="btn-primary text-xs py-1.5 px-3"
                                            onClick={() => { setCheckInGoalId(goal.id); setDate(new Date().toISOString().split('T')[0]); setQuantity(1); setDateError(''); }}
                                            disabled={!goal.active}
                                        >
                                            <Check className="w-3 h-3" /> Check-in
                                        </button>
                                        <span className="text-xs font-bold" style={{ color: progressPct >= 100 ? '#059669' : 'var(--color-text-secondary)' }}>
                                            {Math.round(progressPct)}%
                                        </span>
                                    </div>
                                    {completed && (
                                        <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                                            <TrendingUp className="w-3 h-3" />
                                            {overachieved ? `Overachieved! 🎉` : 'Goal reached! ✅'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
