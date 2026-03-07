import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { Target, Plus, X, Check, TrendingUp } from 'lucide-react';

export default function GoalsPage() {
    const qc = useQueryClient();
    const [showCreate, setShowCreate] = useState(false);
    const [checkInGoalId, setCheckInGoalId] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [quantity, setQuantity] = useState(1);

    const { data, isLoading } = useQuery({
        queryKey: ['goals'],
        queryFn: async () => (await api.get('/goals?limit=50')).data.data,
    });

    const createMut = useMutation({
        mutationFn: (body: any) => api.post('/goals', body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); setShowCreate(false); },
    });

    const checkInMut = useMutation({
        mutationFn: (body: any) => api.post('/checkins', body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['goals'] });
            setCheckInGoalId(null);
            setNote('');
            setDate(new Date().toISOString().split('T')[0]);
            setQuantity(1);
        },
    });

    const [form, setForm] = useState({ title: '', description: '', periodType: 'WEEKLY', targetCount: 3 });

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
                                <label className="label">Title</label>
                                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                            </div>
                            <div>
                                <label className="label">Description</label>
                                <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Period</label>
                                    <select className="input" value={form.periodType} onChange={(e) => setForm({ ...form, periodType: e.target.value })}>
                                        <option value="WEEKLY">Weekly</option>
                                        <option value="MONTHLY">Monthly</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Target Count</label>
                                    <input type="number" className="input" min={1} value={form.targetCount} onChange={(e) => setForm({ ...form, targetCount: parseInt(e.target.value) })} />
                                </div>
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
                        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Quick Check-in</h3>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            checkInMut.mutate({
                                goalId: checkInGoalId,
                                quantity,
                                note,
                                date: new Date(date).toISOString()
                            });
                        }} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Date</label>
                                    <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
                                </div>
                                <div>
                                    <label className="label">Mins (minute)</label>
                                    <input type="number" min={1} className="input" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value))} required />
                                </div>
                            </div>
                            <div>
                                <label className="label">Note (optional)</label>
                                <input className="input" placeholder="What did you do?" value={note} onChange={(e) => setNote(e.target.value)} />
                            </div>
                            <button type="submit" className="btn-primary w-full" disabled={checkInMut.isPending}>
                                <Check className="w-4 h-4" /> {checkInMut.isPending ? 'Recording...' : 'Record Check-in'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Goals List */}
            {isLoading ? (
                <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="card p-5 h-24 animate-pulse bg-gray-100" />)}</div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {(data || []).map((goal: any) => {
                        const pct = Math.min(100, goal.targetCount > 0 ? (goal.currentCount / goal.targetCount) * 100 : 0);
                        const completed = goal.currentCount >= goal.targetCount;
                        return (
                            <div key={goal.id} className="card p-5 animate-slide-up">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h4 className="font-semibold" style={{ color: 'var(--color-text)' }}>{goal.title}</h4>
                                        {goal.description && (
                                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{goal.description}</p>
                                        )}
                                    </div>
                                    <span className={`badge ${goal.periodType === 'WEEKLY' ? 'badge-primary' : 'badge-warning'}`}>
                                        {goal.periodType}
                                    </span>
                                </div>

                                <div className="flex items-center gap-3 mb-3">
                                    <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-700 ease-out"
                                            style={{
                                                width: `${pct}%`,
                                                background: completed
                                                    ? 'linear-gradient(90deg, #059669, #10b981)'
                                                    : 'linear-gradient(90deg, #4f46e5, #7c3aed)',
                                            }}
                                        />
                                    </div>
                                    <span className="text-sm font-bold whitespace-nowrap" style={{ color: completed ? '#059669' : 'var(--color-primary)' }}>
                                        {goal.currentCount}/{goal.targetCount}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        className="btn-primary text-xs py-1.5 px-3"
                                        onClick={() => setCheckInGoalId(goal.id)}
                                        disabled={!goal.active}
                                    >
                                        <Check className="w-3 h-3" /> Check-in
                                    </button>
                                    {completed && (
                                        <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                                            <TrendingUp className="w-3 h-3" /> Goal reached!
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
