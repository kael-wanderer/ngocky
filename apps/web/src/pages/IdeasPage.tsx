import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { Calendar, Copy, LayoutGrid, Lightbulb, List, Pencil, Pin, Plus, Tag, Trash2, X } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { getSharedOwnerName } from '../utils/sharedOwnership';

const emptyTopicForm = () => ({ title: '', description: '', isShared: false });
const ideaFieldOptions = ['Project', 'Blog', 'App', 'Collection', 'Hobby', 'Creative', 'Other'] as const;
const emptyLogForm = () => ({ title: '', content: '', category: '', field: 'Other', status: 'OPEN', tags: [] as string[] });

export default function IdeasPage() {
    const qc = useQueryClient();
    const { user } = useAuthStore();
    const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
    const [showTopicModal, setShowTopicModal] = useState(false);
    const [editingTopic, setEditingTopic] = useState<any>(null);
    const [showLogModal, setShowLogModal] = useState(false);
    const [editingLog, setEditingLog] = useState<any>(null);
    const [topicForm, setTopicForm] = useState(emptyTopicForm());
    const [logForm, setLogForm] = useState(emptyLogForm());
    const [tagInput, setTagInput] = useState('');
    const [logListView, setLogListView] = useState<'grid' | 'list'>('grid');

    const { data: topics, isLoading } = useQuery({
        queryKey: ['idea_topics'],
        queryFn: async () => (await api.get('/ideas/topics')).data.data,
    });

    const createTopicMut = useMutation({
        mutationFn: (body: any) => api.post('/ideas/topics', body),
        onSuccess: ({ data }) => {
            qc.invalidateQueries({ queryKey: ['idea_topics'] });
            setSelectedTopicId(data.data.id);
            closeTopicModal();
        },
    });

    const updateTopicMut = useMutation({
        mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/ideas/topics/${id}`, body),
        onSuccess: ({ data }) => {
            qc.invalidateQueries({ queryKey: ['idea_topics'] });
            setSelectedTopicId(data.data.id);
            closeTopicModal();
        },
    });

    const deleteTopicMut = useMutation({
        mutationFn: (id: string) => api.delete(`/ideas/topics/${id}`),
        onSuccess: (_, id) => {
            qc.invalidateQueries({ queryKey: ['idea_topics'] });
            if (selectedTopicId === id) setSelectedTopicId(null);
        },
    });

    const createLogMut = useMutation({
        mutationFn: (body: any) => api.post('/ideas/logs', body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['idea_topics'] });
            closeLogModal();
        },
    });

    const updateLogMut = useMutation({
        mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/ideas/logs/${id}`, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['idea_topics'] });
            closeLogModal();
        },
    });

    const deleteLogMut = useMutation({
        mutationFn: (id: string) => api.delete(`/ideas/logs/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['idea_topics'] }),
    });
    const togglePinLogMut = useMutation({
        mutationFn: ({ id, pinToDashboard }: { id: string; pinToDashboard: boolean }) => api.patch(`/ideas/logs/${id}`, { pinToDashboard }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['idea_topics'] }),
    });

    const topicList = topics || [];
    const activeTopic = topicList.find((topic: any) => topic.id === selectedTopicId) || topicList[0] || null;
    const logs = activeTopic?.logs || [];

    function addTag() {
        if (tagInput.trim() && !logForm.tags.includes(tagInput.trim())) {
            setLogForm({ ...logForm, tags: [...logForm.tags, tagInput.trim()] });
            setTagInput('');
        }
    }

    function removeTag(tag: string) {
        setLogForm({ ...logForm, tags: logForm.tags.filter((item) => item !== tag) });
    }

    function openCreateTopic() {
        setEditingTopic(null);
        setTopicForm(emptyTopicForm());
        setShowTopicModal(true);
    }

    function openEditTopic(topic: any) {
        setEditingTopic(topic);
        setTopicForm({ title: topic.title || '', description: topic.description || '', isShared: !!topic.isShared });
        setShowTopicModal(true);
    }

    function duplicateTopic(topic: any) {
        setEditingTopic(null);
        setTopicForm({ title: `${topic.title} Copy`, description: topic.description || '', isShared: !!topic.isShared });
        setShowTopicModal(true);
    }

    function closeTopicModal() {
        setShowTopicModal(false);
        setEditingTopic(null);
        setTopicForm(emptyTopicForm());
    }

    function openCreateLog() {
        if (!activeTopic) return;
        setEditingLog(null);
        setLogForm(emptyLogForm());
        setTagInput('');
        setShowLogModal(true);
    }

    function openEditLog(log: any) {
        setEditingLog(log);
        setLogForm({
            title: log.title || '',
            content: log.content || '',
            category: log.category || '',
            field: log.field || 'Other',
            status: log.status || 'OPEN',
            tags: log.tags || [],
        });
        setTagInput('');
        setShowLogModal(true);
    }

    function duplicateLog(log: any) {
        setEditingLog(null);
        setLogForm({
            title: `${log.title} Copy`,
            content: log.content || '',
            category: log.category || '',
            field: log.field || 'Other',
            status: log.status || 'OPEN',
            tags: log.tags || [],
        });
        setTagInput('');
        setShowLogModal(true);
    }

    function closeLogModal() {
        setShowLogModal(false);
        setEditingLog(null);
        setLogForm(emptyLogForm());
        setTagInput('');
    }

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Lightbulb className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Idea Bank</h2>
                </div>
                <button className="btn-primary" onClick={openCreateTopic}>
                    <Plus className="w-4 h-4" /> New Idea Topic
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Idea Topics</h3>
                    </div>
                    {isLoading ? (
                        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="card p-4 h-16 animate-pulse bg-gray-50" />)}</div>
                    ) : (
                        <div className="space-y-3">
                            {topicList.map((topic: any) => (
                                (() => {
                                    const sharedOwnerName = getSharedOwnerName(topic, user?.id);
                                    const canManage = !sharedOwnerName;
                                    return (
                                        <div
                                            key={topic.id}
                                            className={`card p-4 cursor-pointer transition-all hover:shadow-md ${activeTopic?.id === topic.id ? 'ring-2 ring-primary border-transparent' : ''}`}
                                            onClick={() => setSelectedTopicId(topic.id)}
                                            onDoubleClick={() => canManage && openEditTopic(topic)}
                                            style={activeTopic?.id === topic.id ? { borderColor: 'var(--color-primary)' } : {}}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-2">
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h4 className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{topic.title}</h4>
                                                            {topic.isShared && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">Shared</span>}
                                                        </div>
                                                        {sharedOwnerName && <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>Owner: {sharedOwnerName}</p>}
                                                        <p className="text-[10px] uppercase font-bold mt-1" style={{ color: 'var(--color-text-secondary)' }}>{topic.logs?.length || 0} logs</p>
                                                    </div>
                                                </div>
                                                {canManage && (
                                                    <div className="flex items-center gap-1">
                                                        <button className="p-1.5 rounded-md hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); duplicateTopic(topic); }}><Copy className="w-3.5 h-3.5" /></button>
                                                        <button className="p-1.5 rounded-md hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); openEditTopic(topic); }}><Pencil className="w-3.5 h-3.5" /></button>
                                                        <button className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete this idea topic and all logs?')) deleteTopicMut.mutate(topic.id); }}><Trash2 className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()
                            ))}
                            {topicList.length === 0 && (
                                <div className="text-center py-8 card border-dashed border-2">
                                    <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>No idea topics yet</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="lg:col-span-2 space-y-6">
                    {activeTopic ? (
                        <div className="card p-6 space-y-6">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{activeTopic.title}</h3>
                                        {activeTopic.isShared && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">Shared</span>}
                                    </div>
                                    {getSharedOwnerName(activeTopic, user?.id) && <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>Owner: {getSharedOwnerName(activeTopic, user?.id)}</p>}
                                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>{activeTopic.description || 'No topic description yet.'}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <div className="flex items-center gap-1">
                                        <button
                                            className={`p-1.5 rounded-md transition-colors ${logListView === 'grid' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                                            onClick={() => setLogListView('grid')}
                                            title="Grid view"
                                        >
                                            <LayoutGrid className="w-3.5 h-3.5" style={{ color: 'var(--color-text-secondary)' }} />
                                        </button>
                                        <button
                                            className={`p-1.5 rounded-md transition-colors ${logListView === 'list' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                                            onClick={() => setLogListView('list')}
                                            title="List view"
                                        >
                                            <List className="w-3.5 h-3.5" style={{ color: 'var(--color-text-secondary)' }} />
                                        </button>
                                    </div>
                                    {!getSharedOwnerName(activeTopic, user?.id) && (
                                        <button className="btn-primary py-1.5 px-3 text-xs" onClick={openCreateLog}>
                                            <Plus className="w-3.5 h-3.5" /> Add Log
                                        </button>
                                    )}
                                </div>
                            </div>

                            {logListView === 'list' ? (
                                <div className="card divide-y" style={{ borderColor: 'var(--color-border)' }}>
                                    {logs.map((log: any) => {
                                        const sharedOwnerName = getSharedOwnerName(activeTopic, user?.id);
                                        const canManage = !sharedOwnerName;
                                        return (
                                            <div key={log.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors group" onDoubleClick={() => canManage && openEditLog(log)}>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{log.title}</span>
                                                        {log.category && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">{log.category}</span>}
                                                        {log.field && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">{log.field}</span>}
                                                        {log.pinToDashboard && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">Pinned</span>}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[9px] font-bold text-emerald-600 uppercase">{log.status}</span>
                                                        <span className="text-[9px]" style={{ color: 'var(--color-text-secondary)' }}>{new Date(log.createdAt).toLocaleDateString()}</span>
                                                        {(log.tags || []).length > 0 && (
                                                            <span className="text-[9px] flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
                                                                <Tag className="w-2 h-2" /> {log.tags.join(', ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {canManage && (
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                        <button className={`p-1 ${log.pinToDashboard ? 'text-amber-500' : 'hover:text-amber-500'}`} onClick={() => togglePinLogMut.mutate({ id: log.id, pinToDashboard: !log.pinToDashboard })}><Pin className="w-3.5 h-3.5" /></button>
                                                        <button className="p-1 hover:text-indigo-500" onClick={() => openEditLog(log)}><Pencil className="w-3.5 h-3.5" /></button>
                                                        <button className="p-1 hover:text-red-500" onClick={() => { if (window.confirm('Delete idea log?')) deleteLogMut.mutate(log.id); }}><Trash2 className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {logs.length === 0 && (
                                        <div className="text-center py-10">
                                            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No idea logs yet</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                            <div className="columns-1 md:columns-2 gap-4 space-y-4">
                                {logs.map((log: any) => {
                                    const sharedOwnerName = getSharedOwnerName(activeTopic, user?.id);
                                    const canManage = !sharedOwnerName;
                                    return (
                                    <div key={log.id} className="card p-5 group break-inside-avoid animate-fade-in hover:shadow-lg transition-all duration-300" onDoubleClick={() => canManage && openEditLog(log)}>
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {log.category && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-50 text-purple-600">{log.category}</span>}
                                                {log.field && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">{log.field}</span>}
                                            </div>
                                            {canManage && (
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button className={`p-1 ${log.pinToDashboard ? 'text-amber-500' : 'hover:text-amber-500'}`} onClick={() => togglePinLogMut.mutate({ id: log.id, pinToDashboard: !log.pinToDashboard })}><Pin className="w-3.5 h-3.5" /></button>
                                                    <button className="p-1 hover:text-indigo-500" onClick={() => duplicateLog(log)}><Copy className="w-3.5 h-3.5" /></button>
                                                    <button className="p-1 hover:text-indigo-500" onClick={() => openEditLog(log)}><Pencil className="w-3.5 h-3.5" /></button>
                                                    <button className="p-1 hover:text-red-500" onClick={() => { if (window.confirm('Delete idea log?')) deleteLogMut.mutate(log.id); }}><Trash2 className="w-3.5 h-3.5" /></button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{log.title}</h3>
                                            {activeTopic.isShared && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">Shared</span>}
                                            {log.pinToDashboard && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">Pinned</span>}
                                        </div>
                                        {sharedOwnerName && <p className="text-[11px] mb-2" style={{ color: 'var(--color-text-secondary)' }}>Owner: {sharedOwnerName}</p>}
                                        <p className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{log.content}</p>

                                        <div className="mt-4 flex flex-wrap gap-1.5">
                                            {(log.tags || []).map((tag: string) => (
                                                <span key={tag} className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 flex items-center gap-1"><Tag className="w-2 h-2" /> {tag}</span>
                                            ))}
                                        </div>

                                        <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
                                            <div className="text-[9px] font-semibold flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}><Calendar className="w-2.5 h-2.5" /> {new Date(log.createdAt).toLocaleDateString()}</div>
                                            <span className="text-[9px] font-bold text-emerald-600 uppercase">{log.status}</span>
                                        </div>
                                    </div>
                                )})}
                                {logs.length === 0 && (
                                    <div className="py-16 card border-dashed border-2 flex flex-col items-center">
                                        <Lightbulb className="w-10 h-10 mb-4 opacity-10" />
                                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>No idea logs yet</p>
                                    </div>
                                )}
                            </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center card p-12 text-center border-dashed border-2">
                            <Lightbulb className="w-12 h-12 mb-4 opacity-10" />
                            <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text-secondary)' }}>Create an Idea Topic</h3>
                            <p className="text-sm mt-1 max-w-[240px]" style={{ color: 'var(--color-text-secondary)' }}>Create a topic first, then add logs under it.</p>
                        </div>
                    )}
                </div>
            </div>

            {showTopicModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) closeTopicModal(); }}>
                    <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{editingTopic ? 'Edit Idea Topic' : 'New Idea Topic'}</h3>
                            <button onClick={closeTopicModal}><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (editingTopic) updateTopicMut.mutate({ id: editingTopic.id, body: topicForm });
                            else createTopicMut.mutate(topicForm);
                        }} className="space-y-4">
                            <div>
                                <label className="label">Topic <span className="text-red-500">*</span></label>
                                <input className="input" value={topicForm.title} onChange={(e) => setTopicForm({ ...topicForm, title: e.target.value })} required />
                            </div>
                            <div>
                                <label className="label">Description</label>
                                <textarea className="input" rows={3} value={topicForm.description} onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })} />
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={topicForm.isShared} onChange={(e) => setTopicForm({ ...topicForm, isShared: e.target.checked })} />
                                Share with all users
                            </label>
                            <div className="flex items-center justify-between gap-3 pt-2">
                                <div>
                                    {editingTopic && (
                                        <button
                                            type="button"
                                            className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white"
                                            onClick={() => {
                                                if (window.confirm('Delete this idea topic and all logs?')) {
                                                    deleteTopicMut.mutate(editingTopic.id);
                                                    closeTopicModal();
                                                }
                                            }}
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-2 ml-auto">
                                    <button type="button" className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50" onClick={closeTopicModal}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn-primary" disabled={createTopicMut.isPending || updateTopicMut.isPending}>{editingTopic ? 'Save' : 'Create Topic'}</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showLogModal && activeTopic && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) closeLogModal(); }}>
                    <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{editingLog ? 'Edit Idea Log' : 'Add Idea Log'}</h3>
                            <button onClick={closeLogModal}><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const payload = { ...logForm, topicId: activeTopic.id };
                            if (editingLog) updateLogMut.mutate({ id: editingLog.id, body: payload });
                            else createLogMut.mutate(payload);
                        }} className="space-y-4">
                            <div>
                                <label className="label">Title <span className="text-red-500">*</span></label>
                                <input className="input" value={logForm.title} onChange={(e) => setLogForm({ ...logForm, title: e.target.value })} required />
                            </div>
                            <div>
                                <label className="label">Content</label>
                                <textarea className="input" rows={4} value={logForm.content} onChange={(e) => setLogForm({ ...logForm, content: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <div>
                                    <label className="label">Category</label>
                                    <input className="input" value={logForm.category} onChange={(e) => setLogForm({ ...logForm, category: e.target.value })} />
                                </div>
                                <div>
                                    <label className="label">Field</label>
                                    <select className="input" value={logForm.field} onChange={(e) => setLogForm({ ...logForm, field: e.target.value })}>
                                        {ideaFieldOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Status</label>
                                    <select className="input" value={logForm.status} onChange={(e) => setLogForm({ ...logForm, status: e.target.value })}>
                                        <option value="OPEN">Open</option>
                                        <option value="REVIEWING">Reviewing</option>
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
                                    {logForm.tags.map((tag) => (
                                        <span key={tag} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-red-50 hover:text-red-500 cursor-pointer transition-colors flex items-center gap-1" onClick={() => removeTag(tag)}>{tag} <X className="w-3 h-3" /></span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-3 pt-2">
                                <div>
                                    {editingLog && (
                                        <button
                                            type="button"
                                            className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white"
                                            onClick={() => {
                                                if (window.confirm('Delete idea log?')) {
                                                    deleteLogMut.mutate(editingLog.id);
                                                    closeLogModal();
                                                }
                                            }}
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-2 ml-auto">
                                    <button type="button" className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50" onClick={closeLogModal}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn-primary" disabled={createLogMut.isPending || updateLogMut.isPending}>{editingLog ? 'Save' : 'Add Log'}</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
