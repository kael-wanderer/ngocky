import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { Home, Plus, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { format, isPast } from 'date-fns';

const freqLabels: Record<string, string> = {
    ONE_TIME: 'One time', WEEKLY: 'Weekly', MONTHLY: 'Monthly',
    QUARTERLY: 'Quarterly', HALF_YEARLY: 'Half yearly', YEARLY: 'Yearly', CUSTOM: 'Custom',
};

export default function HouseworkPage() {
    const qc = useQueryClient();
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ title: '', description: '', frequencyType: 'WEEKLY', nextDueDate: '' });

    const { data, isLoading } = useQuery({
        queryKey: ['housework'],
        queryFn: async () => (await api.get('/housework?limit=50')).data.data,
    });

    const createMut = useMutation({
        mutationFn: (body: any) => api.post('/housework', body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['housework'] }); setShowCreate(false); setForm({ title: '', description: '', frequencyType: 'WEEKLY', nextDueDate: '' }); },
    });

    const completeMut = useMutation({
        mutationFn: (id: string) => api.post(`/housework/${id}/complete`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['housework'] }),
    });

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Home className="w-6 h-6" style={{ color: '#059669' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Housework</h2>
                </div>
                <button className="btn-primary" onClick={() => setShowCreate(true)}>
                    <Plus className="w-4 h-4" /> New Item
                </button>
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCreate(false)}>
                    <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">New Housework</h3>
                            <button onClick={() => setShowCreate(false)}><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const body: any = { ...form };
                            if (body.nextDueDate) body.nextDueDate = new Date(body.nextDueDate).toISOString(); else delete body.nextDueDate;
                            createMut.mutate(body);
                        }} className="space-y-4">
                            <div><label className="label">Title</label><input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                            <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Frequency</label>
                                    <select className="input" value={form.frequencyType} onChange={(e) => setForm({ ...form, frequencyType: e.target.value })}>
                                        {Object.entries(freqLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Next Due</label>
                                    <input type="date" className="input" value={form.nextDueDate} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} />
                                </div>
                            </div>
                            <button type="submit" className="btn-primary w-full" disabled={createMut.isPending}>Create</button>
                        </form>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="card p-5 h-20 animate-pulse bg-gray-100" />)}</div>
            ) : (
                <div className="space-y-3">
                    {(data || []).map((item: any) => {
                        const overdue = item.nextDueDate && isPast(new Date(item.nextDueDate));
                        return (
                            <div key={item.id} className={`card p-4 flex items-center gap-4 animate-slide-up ${overdue ? 'border-red-200' : ''}`}>
                                <button
                                    onClick={() => completeMut.mutate(item.id)}
                                    disabled={completeMut.isPending}
                                    className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all hover:scale-105"
                                    style={{ borderColor: overdue ? '#dc2626' : '#059669' }}
                                >
                                    <CheckCircle2 className="w-5 h-5" style={{ color: overdue ? '#dc2626' : '#059669' }} />
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
                                        {item.assignee && (
                                            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>👤 {item.assignee.name}</span>
                                        )}
                                        {item.estimatedCost && (
                                            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>💰 ${item.estimatedCost}</span>
                                        )}
                                    </div>
                                </div>

                                {!item.active && <span className="badge bg-gray-100 text-gray-500">Inactive</span>}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
