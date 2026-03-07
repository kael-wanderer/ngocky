import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { Lightbulb, Plus, X, Trash2, Tag, Calendar } from 'lucide-react';

export default function IdeasPage() {
    const qc = useQueryClient();
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ title: '', content: '', category: '', status: 'DRAFT', tags: [] as string[] });
    const [tagInput, setTagInput] = useState('');

    const { data: ideas, isLoading } = useQuery({
        queryKey: ['ideas'],
        queryFn: async () => (await api.get('/ideas')).data.data,
    });

    const createMut = useMutation({
        mutationFn: (body: any) => api.post('/ideas', body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['ideas'] }); setShowCreate(false); setForm({ title: '', content: '', category: '', status: 'DRAFT', tags: [] }); },
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => api.delete(`/ideas/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['ideas'] }),
    });

    const addTag = () => {
        if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
            setForm({ ...form, tags: [...form.tags, tagInput.trim()] });
            setTagInput('');
        }
    };

    const removeTag = (tag: string) => {
        setForm({ ...form, tags: form.tags.filter(t => t !== tag) });
    };

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Lightbulb className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Idea Bank</h2>
                </div>
                <button className="btn-primary" onClick={() => setShowCreate(true)}>
                    <Plus className="w-4 h-4" /> New Idea
                </button>
            </div>

            {isLoading ? (
                <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
                    {[...Array(6)].map((_, i) => <div key={i} className="card h-32 animate-pulse bg-gray-50 break-inside-avoid" />)}
                </div>
            ) : (
                <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
                    {(ideas || []).map((idea: any) => (
                        <div key={idea.id} className="card p-5 group break-inside-avoid animate-fade-in hover:shadow-lg transition-all duration-300">
                            <div className="flex items-start justify-between mb-3">
                                {idea.category && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-50 text-purple-600">
                                        {idea.category}
                                    </span>
                                )}
                                <button
                                    className="p-1 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => { if (confirm('Delete idea?')) deleteMut.mutate(idea.id); }}
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <h3 className="font-semibold text-sm mb-2" style={{ color: 'var(--color-text)' }}>{idea.title}</h3>
                            <p className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                                {idea.content}
                            </p>

                            <div className="mt-4 flex flex-wrap gap-1.5">
                                {(idea.tags || []).map((tag: string) => (
                                    <span key={tag} className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 flex items-center gap-1">
                                        <Tag className="w-2 h-2" /> {tag}
                                    </span>
                                ))}
                            </div>

                            <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="text-[9px] font-semibold flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
                                    <Calendar className="w-2.5 h-2.5" /> {new Date(idea.createdAt).toLocaleDateString()}
                                </div>
                                {idea.status !== 'DRAFT' && (
                                    <span className="text-[9px] font-bold text-emerald-600 uppercase">{idea.status}</span>
                                )}
                            </div>
                        </div>
                    ))}
                    {ideas?.length === 0 && (
                        <div className="col-span-full py-20 card border-dashed border-2 flex flex-col items-center">
                            <Lightbulb className="w-12 h-12 mb-4 opacity-10" />
                            <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text-secondary)' }}>Your Idea Bank is empty</h3>
                            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Capture every spark of inspiration here.</p>
                            <button className="btn-primary mt-6" onClick={() => setShowCreate(true)}>
                                <Plus className="w-4 h-4" /> Quick Capture
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
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>New Idea</h3>
                            <button onClick={() => setShowCreate(false)}><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} className="space-y-4">
                            <div>
                                <label className="label">Title</label>
                                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What's the idea?" required />
                            </div>
                            <div>
                                <label className="label">Content</label>
                                <textarea className="input" rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Describe your idea in detail..." required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Category</label>
                                    <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Project, Home, Gift..." />
                                </div>
                                <div>
                                    <label className="label">Status</label>
                                    <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                        <option value="DRAFT">Draft</option>
                                        <option value="VALIDATED">Validated</option>
                                        <option value="REJECTED">Rejected</option>
                                        <option value="ARCHIVED">Archived</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="label">Tags</label>
                                <div className="flex gap-2">
                                    <input className="input flex-1" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Press Enter to add" />
                                    <button type="button" className="btn-ghost" onClick={addTag}>Add</button>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {form.tags.map(tag => (
                                        <span key={tag} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-red-50 hover:text-red-500 cursor-pointer transition-colors flex items-center gap-1" onClick={() => removeTag(tag)}>
                                            {tag} <X className="w-3 h-3" />
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <button type="submit" className="btn-primary w-full" disabled={createMut.isPending}>
                                {createMut.isPending ? 'Saving...' : 'Drop in Idea Bank'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
