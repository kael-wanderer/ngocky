import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { GraduationCap, Plus, X, BookOpen, Clock, CheckCircle2, Trash2 } from 'lucide-react';

export default function LearningPage() {
    const qc = useQueryClient();
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ title: '', subject: '', description: '', target: '', progress: 0, deadline: '', status: 'PLANNING', notificationEnabled: true });

    const { data: items, isLoading } = useQuery({
        queryKey: ['learning'],
        queryFn: async () => (await api.get('/learning')).data.data,
    });

    const createMut = useMutation({
        mutationFn: (body: any) => api.post('/learning', body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['learning'] }); setShowCreate(false); },
    });

    const updateMut = useMutation({
        mutationFn: ({ id, body }: { id: string, body: any }) => api.patch(`/learning/${id}`, body),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['learning'] }),
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => api.delete(`/learning/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['learning'] }),
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PLANNING': return 'bg-blue-100 text-blue-700';
            case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-700';
            case 'COMPLETED': return 'bg-emerald-100 text-emerald-700';
            case 'DROPPED': return 'bg-gray-100 text-gray-500';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <GraduationCap className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Learning Management</h2>
                </div>
                <button className="btn-primary" onClick={() => setShowCreate(true)}>
                    <Plus className="w-4 h-4" /> Add Item
                </button>
            </div>

            {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[...Array(3)].map((_, i) => <div key={i} className="card h-40 animate-pulse bg-gray-50" />)}
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {(items || []).map((item: any) => (
                        <div key={item.id} className="card p-5 group flex flex-col h-full">
                            <div className="flex items-start justify-between mb-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusColor(item.status)}`}>
                                    {item.status.replace('_', ' ')}
                                </span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded text-gray-400"
                                        onClick={() => { if (confirm('Delete this item?')) deleteMut.mutate(item.id); }}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            <h3 className="font-semibold text-sm line-clamp-1" style={{ color: 'var(--color-text)' }}>{item.title}</h3>
                            <p className="text-[10px] font-bold mt-1" style={{ color: 'var(--color-primary)' }}>{item.subject}</p>

                            <p className="text-xs mt-2 line-clamp-2 flex-grow" style={{ color: 'var(--color-text-secondary)' }}>
                                {item.description || "No description provided."}
                            </p>

                            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="flex items-center justify-between text-[11px] mb-1.5 font-medium">
                                    <span style={{ color: 'var(--color-text-secondary)' }}>Progress</span>
                                    <span style={{ color: 'var(--color-text)' }}>{item.progress}%</span>
                                </div>
                                <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-4">
                                    <div
                                        className="h-full rounded-full transition-all duration-500 bg-primary"
                                        style={{ width: `${item.progress}%`, backgroundColor: 'var(--color-primary)' }}
                                    />
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                                        <Clock className="w-3 h-3" />
                                        {item.deadline ? new Date(item.deadline).toLocaleDateString() : 'No deadline'}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {item.status !== 'COMPLETED' && (
                                            <button
                                                className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-md transition-colors"
                                                onClick={() => updateMut.mutate({ id: item.id, body: { status: 'COMPLETED', progress: 100 } })}
                                                title="Mark as Completed"
                                            >
                                                <CheckCircle2 className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            className="p-1.5 hover:bg-gray-100 text-gray-600 rounded-md transition-colors"
                                            onClick={() => {
                                                const newProgress = Math.min(100, item.progress + 10);
                                                updateMut.mutate({ id: item.id, body: { progress: newProgress, status: newProgress === 100 ? 'COMPLETED' : 'IN_PROGRESS' } });
                                            }}
                                            title="Increase Progress"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {items?.length === 0 && (
                        <div className="col-span-full py-20 card border-dashed border-2 flex flex-col items-center">
                            <BookOpen className="w-12 h-12 mb-4 opacity-10" />
                            <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text-secondary)' }}>No learning items yet</h3>
                            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Start tracking your learning goals and courses.</p>
                            <button className="btn-primary mt-6" onClick={() => setShowCreate(true)}>
                                <Plus className="w-4 h-4" /> Add Item
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCreate(false)}>
                    <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Add Learning Item</h3>
                            <button onClick={() => setShowCreate(false)}><X className="w-5 h-5" /></button>
                        </div>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                createMut.mutate({
                                    ...form,
                                    deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
                                    progress: parseInt(form.progress.toString())
                                });
                            }}
                            className="space-y-4"
                        >
                            <div>
                                <label className="label">Title <span className="text-red-500">*</span></label>
                                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Course name or Topic" required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Subject <span className="text-red-500">*</span></label>
                                    <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Cooking, AI" required />
                                </div>
                                <div>
                                    <label className="label">Status <span className="text-red-500">*</span></label>
                                    <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                        <option value="PLANNING">Planning</option>
                                        <option value="IN_PROGRESS">In Progress</option>
                                        <option value="COMPLETED">Completed</option>
                                        <option value="DROPPED">Dropped</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Deadline</label>
                                    <input type="date" className="input" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                                </div>
                                <div>
                                    <label className="label">Initial Progress %</label>
                                    <input type="number" className="input" min={0} max={100} value={form.progress} onChange={(e) => setForm({ ...form, progress: parseInt(e.target.value) })} />
                                </div>
                                <div className="col-span-2">
                                    <label className="label">Description / Resources</label>
                                    <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Links, books, or notes..." />
                                </div>
                                <div className="col-span-2">
                                    <label className="label">Target</label>
                                    <input className="input" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} placeholder="e.g. Finish all modules, Practical project" />
                                </div>
                            </div>
                            <button type="submit" className="btn-primary w-full" disabled={createMut.isPending}>
                                {createMut.isPending ? 'Saving...' : 'Save Learning Item'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
