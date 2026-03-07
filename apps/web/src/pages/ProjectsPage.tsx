import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { FolderKanban, Plus, X, LayoutGrid, List } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_COLS = ['PLANNED', 'IN_PROGRESS', 'DONE', 'ARCHIVED'] as const;
const statusLabels: Record<string, string> = { PLANNED: 'Planned', IN_PROGRESS: 'In Progress', DONE: 'Done', ARCHIVED: 'Archived' };
const statusColors: Record<string, string> = { PLANNED: '#64748b', IN_PROGRESS: '#4f46e5', DONE: '#059669', ARCHIVED: '#94a3b8' };
const priorityColors: Record<string, string> = { LOW: '#94a3b8', MEDIUM: '#3b82f6', HIGH: '#f59e0b', URGENT: '#ef4444' };

export default function ProjectsPage() {
    const qc = useQueryClient();
    const [view, setView] = useState<'kanban' | 'list'>('kanban');
    const [showCreate, setShowCreate] = useState(false);
    const [editingProject, setEditingProject] = useState<any>(null);
    const [form, setForm] = useState({ title: '', description: '', category: '', priority: 'MEDIUM', status: 'PLANNED', deadline: '' });

    const { data, isLoading } = useQuery({
        queryKey: ['projects'],
        queryFn: async () => (await api.get('/projects?limit=100')).data.data,
    });

    const createMut = useMutation({
        mutationFn: (body: any) => api.post('/projects', body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setShowCreate(false); setForm({ title: '', description: '', category: '', priority: 'MEDIUM', status: 'PLANNED', deadline: '' }); },
    });

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => api.patch(`/projects/${id}`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['projects'] });
            setEditingProject(null);
        },
    });

    const projects = data || [];

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <FolderKanban className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Projects</h2>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                        <button onClick={() => setView('kanban')} className={`p-2 ${view === 'kanban' ? 'bg-gray-100' : ''}`}><LayoutGrid className="w-4 h-4" /></button>
                        <button onClick={() => setView('list')} className={`p-2 ${view === 'list' ? 'bg-gray-100' : ''}`}><List className="w-4 h-4" /></button>
                    </div>
                    <button className="btn-primary" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> New Project</button>
                </div>
            </div>

            {/* Create / Edit Modal */}
            {(showCreate || editingProject) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { setShowCreate(false); setEditingProject(null); }}>
                    <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">{editingProject ? 'Edit Project' : 'Create Project'}</h3>
                            <button onClick={() => { setShowCreate(false); setEditingProject(null); }}><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const body: any = { ...form };
                            if (body.deadline) body.deadline = new Date(body.deadline).toISOString();
                            else delete body.deadline;

                            if (editingProject) {
                                updateMut.mutate({ id: editingProject.id, data: body });
                            } else {
                                createMut.mutate(body);
                            }
                        }} className="space-y-4">
                            <div><label className="label">Title</label><input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                            <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="label">Category</label><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
                                <div>
                                    <label className="label">Priority</label>
                                    <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                                        <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Status</label>
                                    <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                        <option value="PLANNED">Planned</option><option value="IN_PROGRESS">In Progress</option><option value="DONE">Done</option><option value="ARCHIVED">Archived</option>
                                    </select>
                                </div>
                                <div><label className="label">Deadline</label><input type="date" className="input" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
                            </div>
                            <button type="submit" className="btn-primary w-full" disabled={createMut.isPending || updateMut.isPending}>
                                {createMut.isPending || updateMut.isPending ? 'Saving...' : (editingProject ? 'Save Changes' : 'Create Project')}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="animate-pulse space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="card h-20" />)}</div>
            ) : view === 'kanban' ? (
                /* Kanban View */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {STATUS_COLS.map((status) => (
                        <div key={status} className="space-y-3">
                            <div className="flex items-center gap-2 px-1">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: statusColors[status] }} />
                                <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{statusLabels[status]}</h4>
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100" style={{ color: 'var(--color-text-secondary)' }}>
                                    {projects.filter((p: any) => p.status === status).length}
                                </span>
                            </div>
                            <div className="space-y-2 min-h-[100px] p-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
                                {projects.filter((p: any) => p.status === status).map((p: any) => (
                                    <div
                                        key={p.id}
                                        className="card p-3 cursor-pointer hover:shadow-md transition-shadow block"
                                        onClick={() => {
                                            setEditingProject(p);
                                            setForm({
                                                title: p.title || '',
                                                description: p.description || '',
                                                category: p.category || '',
                                                priority: p.priority || 'MEDIUM',
                                                status: p.status || 'PLANNED',
                                                deadline: p.deadline ? new Date(p.deadline).toISOString().split('T')[0] : ''
                                            });
                                        }}
                                    >
                                        <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>{p.title}</p>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="badge" style={{ backgroundColor: `${priorityColors[p.priority]}20`, color: priorityColors[p.priority] }}>
                                                {p.priority}
                                            </span>
                                            {p.category && <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>{p.category}</span>}
                                            {p.deadline && (
                                                <span className="text-[10px]" style={{ color: new Date(p.deadline) < new Date() ? '#dc2626' : 'var(--color-text-secondary)' }}>
                                                    📅 {format(new Date(p.deadline), 'MMM d')}
                                                </span>
                                            )}
                                        </div>
                                        {p.assignee && <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>👤 {p.assignee.name}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* List View */
                <div className="card overflow-hidden">
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Title</th><th>Status</th><th>Priority</th><th>Category</th><th>Assignee</th><th>Deadline</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projects.map((p: any) => (
                                    <tr
                                        key={p.id}
                                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                                        onClick={() => {
                                            setEditingProject(p);
                                            setForm({
                                                title: p.title || '',
                                                description: p.description || '',
                                                category: p.category || '',
                                                priority: p.priority || 'MEDIUM',
                                                status: p.status || 'PLANNED',
                                                deadline: p.deadline ? new Date(p.deadline).toISOString().split('T')[0] : ''
                                            });
                                        }}
                                    >
                                        <td className="font-medium" style={{ color: 'var(--color-text)' }}>{p.title}</td>
                                        <td><span className="badge" style={{ backgroundColor: `${statusColors[p.status]}20`, color: statusColors[p.status] }}>{statusLabels[p.status]}</span></td>
                                        <td><span className="badge" style={{ backgroundColor: `${priorityColors[p.priority]}20`, color: priorityColors[p.priority] }}>{p.priority}</span></td>
                                        <td style={{ color: 'var(--color-text-secondary)' }}>{p.category || '-'}</td>
                                        <td style={{ color: 'var(--color-text-secondary)' }}>{p.assignee?.name || '-'}</td>
                                        <td style={{ color: p.deadline && new Date(p.deadline) < new Date() ? '#dc2626' : 'var(--color-text-secondary)' }}>
                                            {p.deadline ? format(new Date(p.deadline), 'MMM d, yyyy') : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
