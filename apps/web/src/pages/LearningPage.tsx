import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { BookOpen, CheckCircle2, Clock, Copy, GraduationCap, Pencil, Pin, Plus, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import NotificationFields, { buildNotificationPayload, emptyNotification, loadNotificationState } from '../components/NotificationFields';

const emptyTopicForm = () => ({ title: '', description: '', isShared: false });
const emptyHistoryForm = () => ({
    title: '',
    description: '',
    target: '',
    progress: 0,
    deadline: '',
    status: 'PLANNED',
    ...emptyNotification,
});

const statusOptions = [
    { value: 'PLANNED', label: 'Planned' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'DONE', label: 'Done' },
    { value: 'ARCHIVED', label: 'Archived' },
];

const getStatusColor = (status: string) => {
    switch (status) {
        case 'PLANNED': return 'bg-blue-100 text-blue-700';
        case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-700';
        case 'DONE': return 'bg-emerald-100 text-emerald-700';
        case 'ARCHIVED': return 'bg-gray-100 text-gray-500';
        default: return 'bg-gray-100 text-gray-700';
    }
};

export default function LearningPage() {
    const qc = useQueryClient();
    const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
    const [showTopicModal, setShowTopicModal] = useState(false);
    const [editingTopic, setEditingTopic] = useState<any>(null);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [editingHistory, setEditingHistory] = useState<any>(null);
    const [topicForm, setTopicForm] = useState(emptyTopicForm());
    const [historyForm, setHistoryForm] = useState(emptyHistoryForm());

    const { data: topics, isLoading } = useQuery({
        queryKey: ['learning_topics'],
        queryFn: async () => (await api.get('/learning/topics')).data.data,
    });

    const createTopicMut = useMutation({
        mutationFn: (body: any) => api.post('/learning/topics', body),
        onSuccess: ({ data }) => {
            qc.invalidateQueries({ queryKey: ['learning_topics'] });
            setSelectedTopicId(data.data.id);
            closeTopicModal();
        },
    });

    const updateTopicMut = useMutation({
        mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/learning/topics/${id}`, body),
        onSuccess: ({ data }) => {
            qc.invalidateQueries({ queryKey: ['learning_topics'] });
            setSelectedTopicId(data.data.id);
            closeTopicModal();
        },
    });

    const deleteTopicMut = useMutation({
        mutationFn: (id: string) => api.delete(`/learning/topics/${id}`),
        onSuccess: (_, id) => {
            qc.invalidateQueries({ queryKey: ['learning_topics'] });
            if (selectedTopicId === id) setSelectedTopicId(null);
        },
    });

    const createHistoryMut = useMutation({
        mutationFn: (body: any) => api.post('/learning/histories', body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['learning_topics'] });
            closeHistoryModal();
        },
    });

    const updateHistoryMut = useMutation({
        mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/learning/histories/${id}`, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['learning_topics'] });
            closeHistoryModal();
        },
    });

    const deleteHistoryMut = useMutation({
        mutationFn: (id: string) => api.delete(`/learning/histories/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['learning_topics'] }),
    });
    const togglePinHistoryMut = useMutation({
        mutationFn: ({ id, pinToDashboard }: { id: string; pinToDashboard: boolean }) => api.patch(`/learning/histories/${id}`, { pinToDashboard }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['learning_topics'] }),
    });

    const topicList = topics || [];
    const activeTopic = topicList.find((topic: any) => topic.id === selectedTopicId) || topicList[0] || null;
    const histories = activeTopic?.histories || [];

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

    function openCreateHistory() {
        if (!activeTopic) return;
        setEditingHistory(null);
        setHistoryForm(emptyHistoryForm());
        setShowHistoryModal(true);
    }

    function openEditHistory(history: any) {
        setEditingHistory(history);
        setHistoryForm({
            title: history.title || '',
            description: history.description || '',
            target: history.target || '',
            progress: history.progress || 0,
            deadline: history.deadline ? format(new Date(history.deadline), 'yyyy-MM-dd') : '',
            status: history.status || 'PLANNED',
            ...loadNotificationState(history),
        });
        setShowHistoryModal(true);
    }

    function duplicateHistory(history: any) {
        setEditingHistory(null);
        setHistoryForm({
            title: `${history.title} Copy`,
            description: history.description || '',
            target: history.target || '',
            progress: history.progress || 0,
            deadline: history.deadline ? format(new Date(history.deadline), 'yyyy-MM-dd') : '',
            status: history.status || 'PLANNED',
            ...loadNotificationState(history),
        });
        setShowHistoryModal(true);
    }

    function closeHistoryModal() {
        setShowHistoryModal(false);
        setEditingHistory(null);
        setHistoryForm(emptyHistoryForm());
    }

    function handleTopicSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (editingTopic) {
            updateTopicMut.mutate({ id: editingTopic.id, body: topicForm });
            return;
        }
        createTopicMut.mutate(topicForm);
    }

    function handleHistorySubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!activeTopic) return;

        const body = {
            ...historyForm,
            topicId: activeTopic.id,
            progress: Number(historyForm.progress),
            deadline: historyForm.deadline ? new Date(`${historyForm.deadline}T00:00:00`).toISOString() : null,
            ...buildNotificationPayload(historyForm as any),
        };

        if (editingHistory) {
            updateHistoryMut.mutate({ id: editingHistory.id, body });
            return;
        }
        createHistoryMut.mutate(body);
    }

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <GraduationCap className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Learning Management</h2>
                </div>
                <button className="btn-primary" onClick={openCreateTopic}>
                    <Plus className="w-4 h-4" /> Add Topic
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Learning Topics</h3>
                    {isLoading ? (
                        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="card p-4 h-16 animate-pulse bg-gray-50" />)}</div>
                    ) : (
                        <div className="space-y-3">
                            {topicList.map((topic: any) => (
                                <div key={topic.id} className={`card p-4 cursor-pointer transition-all hover:shadow-md ${activeTopic?.id === topic.id ? 'ring-2 ring-primary border-transparent' : ''}`} onClick={() => setSelectedTopicId(topic.id)} style={activeTopic?.id === topic.id ? { borderColor: 'var(--color-primary)' } : {}}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{topic.title}</h4>
                                                {topic.isShared && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">Shared</span>}
                                            </div>
                                            <p className="text-[10px] uppercase font-bold mt-1" style={{ color: 'var(--color-text-secondary)' }}>{topic.histories?.length || 0} histories</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button className="p-1.5 rounded-md hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); duplicateTopic(topic); }}><Copy className="w-3.5 h-3.5" /></button>
                                            <button className="p-1.5 rounded-md hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); openEditTopic(topic); }}><Pencil className="w-3.5 h-3.5" /></button>
                                            <button className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete this topic and all histories?')) deleteTopicMut.mutate(topic.id); }}><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {topicList.length === 0 && (
                                <div className="text-center py-8 card border-dashed border-2">
                                    <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>No learning topics yet</p>
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
                                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>{activeTopic.description || 'No topic description yet.'}</p>
                                </div>
                                <button className="btn-primary py-1.5 px-3 text-xs" onClick={openCreateHistory}>
                                    <Plus className="w-3.5 h-3.5" /> Add History
                                </button>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}><BookOpen className="w-4 h-4" /> Topic Histories</h4>
                                {histories.length === 0 ? (
                                    <div className="text-center py-10 opacity-40"><p className="text-xs">No histories recorded for this topic.</p></div>
                                ) : (
                                    <div className="grid gap-4 md:grid-cols-2">
                                        {histories.map((history: any) => (
                                            <div key={history.id} className="card p-5 group flex flex-col h-full">
                                                <div className="flex items-start justify-between mb-2">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusColor(history.status)}`}>{history.status.replace('_', ' ')}</span>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button className={`p-1.5 rounded ${history.pinToDashboard ? 'text-amber-500' : 'hover:bg-amber-50 hover:text-amber-500 text-gray-400'}`} onClick={() => togglePinHistoryMut.mutate({ id: history.id, pinToDashboard: !history.pinToDashboard })}><Pin className="w-3.5 h-3.5" /></button>
                                                        <button className="p-1.5 hover:bg-gray-100 rounded text-gray-400" onClick={() => duplicateHistory(history)}><Copy className="w-3.5 h-3.5" /></button>
                                                        <button className="p-1.5 hover:bg-gray-100 rounded text-gray-400" onClick={() => openEditHistory(history)}><Pencil className="w-3.5 h-3.5" /></button>
                                                        <button className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded text-gray-400" onClick={() => { if (window.confirm('Delete this history?')) deleteHistoryMut.mutate(history.id); }}><Trash2 className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-sm line-clamp-1" style={{ color: 'var(--color-text)' }}>{history.title}</h3>
                                                    {history.pinToDashboard && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">Pinned</span>}
                                                </div>
                                                <p className="text-xs mt-2 line-clamp-2 flex-grow" style={{ color: 'var(--color-text-secondary)' }}>{history.description || 'No description provided.'}</p>

                                                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                                    <div className="flex items-center justify-between text-[11px] mb-1.5 font-medium">
                                                        <span style={{ color: 'var(--color-text-secondary)' }}>Progress</span>
                                                        <span style={{ color: 'var(--color-text)' }}>{history.progress}%</span>
                                                    </div>
                                                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-4">
                                                        <div className="h-full rounded-full transition-all duration-500 bg-primary" style={{ width: `${history.progress}%`, backgroundColor: 'var(--color-primary)' }} />
                                                    </div>

                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                                                            <Clock className="w-3 h-3" />
                                                            {history.deadline ? new Date(history.deadline).toLocaleDateString() : 'No deadline'}
                                                        </div>
                                                        {history.status !== 'DONE' && (
                                                            <button className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-md transition-colors" onClick={() => updateHistoryMut.mutate({ id: history.id, body: { status: 'DONE', progress: 100 } })} title="Mark as Done">
                                                                <CheckCircle2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center card p-12 text-center border-dashed border-2">
                            <BookOpen className="w-12 h-12 mb-4 opacity-10" />
                            <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text-secondary)' }}>Select a Topic</h3>
                            <p className="text-sm mt-1 max-w-[240px]" style={{ color: 'var(--color-text-secondary)' }}>Create a learning topic first, then add history entries under it.</p>
                        </div>
                    )}
                </div>
            </div>

            {showTopicModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) closeTopicModal(); }}>
                    <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{editingTopic ? 'Edit Topic' : 'Add Topic'}</h3>
                            <button onClick={closeTopicModal}><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleTopicSubmit} className="space-y-4">
                            <div>
                                <label className="label">Topic <span className="text-red-500">*</span></label>
                                <input className="input" value={topicForm.title} onChange={(e) => setTopicForm({ ...topicForm, title: e.target.value })} placeholder="e.g. DevOps" required />
                            </div>
                            <div>
                                <label className="label">Description</label>
                                <textarea className="input" rows={3} value={topicForm.description} onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })} />
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={topicForm.isShared} onChange={(e) => setTopicForm({ ...topicForm, isShared: e.target.checked })} />
                                Share with all users
                            </label>
                            <button type="submit" className="btn-primary w-full" disabled={createTopicMut.isPending || updateTopicMut.isPending}>{editingTopic ? 'Save Topic' : 'Create Topic'}</button>
                        </form>
                    </div>
                </div>
            )}

            {showHistoryModal && activeTopic && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) closeHistoryModal(); }}>
                    <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{editingHistory ? 'Edit History' : 'Add History'}</h3>
                            <button onClick={closeHistoryModal}><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleHistorySubmit} className="space-y-4">
                            <div>
                                <label className="label">Title <span className="text-red-500">*</span></label>
                                <input className="input" value={historyForm.title} onChange={(e) => setHistoryForm({ ...historyForm, title: e.target.value })} placeholder="e.g. Kubernetes course" required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Status <span className="text-red-500">*</span></label>
                                    <select className="input" value={historyForm.status} onChange={(e) => setHistoryForm({ ...historyForm, status: e.target.value })}>
                                        {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Progress</label>
                                    <input type="number" min={0} max={100} className="input" value={historyForm.progress} onChange={(e) => setHistoryForm({ ...historyForm, progress: Number(e.target.value) })} />
                                </div>
                                <div>
                                    <label className="label">Deadline</label>
                                    <input type="date" className="input" value={historyForm.deadline} onChange={(e) => setHistoryForm({ ...historyForm, deadline: e.target.value })} />
                                </div>
                                <div>
                                    <label className="label">Target</label>
                                    <input className="input" value={historyForm.target} onChange={(e) => setHistoryForm({ ...historyForm, target: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="label">Description</label>
                                <textarea className="input" rows={3} value={historyForm.description} onChange={(e) => setHistoryForm({ ...historyForm, description: e.target.value })} />
                            </div>
                            <NotificationFields form={historyForm as any} setForm={setHistoryForm as any} />
                            <button type="submit" className="btn-primary w-full" disabled={createHistoryMut.isPending || updateHistoryMut.isPending}>{editingHistory ? 'Save History' : 'Add History'}</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
