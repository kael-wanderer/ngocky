import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { FolderKanban, Plus, X, LayoutGrid, List, ArrowLeft, Trash2, Pencil, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '../stores/auth';
import { useSearchParams } from 'react-router-dom';

const STATUS_COLS = ['PLANNED', 'IN_PROGRESS', 'DONE', 'ARCHIVED'] as const;
const statusLabels: Record<string, string> = { PLANNED: 'Planned', IN_PROGRESS: 'In Progress', DONE: 'Done', ARCHIVED: 'Archived' };
const statusColors: Record<string, string> = { PLANNED: '#64748b', IN_PROGRESS: '#4f46e5', DONE: '#059669', ARCHIVED: '#94a3b8' };
const priorityColors: Record<string, string> = { LOW: '#94a3b8', MEDIUM: '#3b82f6', HIGH: '#f59e0b', URGENT: '#ef4444' };

export default function ProjectsPage() {
    const qc = useQueryClient();
    const { user } = useAuthStore();
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
    const [view, setView] = useState<'kanban' | 'list'>('kanban');
    const [showCreateBoard, setShowCreateBoard] = useState(false);
    const [editingBoard, setEditingBoard] = useState<any>(null);
    const [showCreateTask, setShowCreateTask] = useState(false);
    const [editingTask, setEditingTask] = useState<any>(null);
    const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

    const [boardForm, setBoardForm] = useState({ name: '', description: '', isShared: false });
    const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'MEDIUM', status: 'PLANNED', deadline: '', category: '', isShared: false });
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const boardIdParam = searchParams.get('boardId');
    const taskIdParam = searchParams.get('taskId');

    // Queries
    const { data: boards, isLoading: boardsLoading } = useQuery({
        queryKey: ['project_boards'],
        queryFn: async () => (await api.get('/projects')).data.data,
    });

    const { data: activeBoard, isLoading: activeBoardLoading } = useQuery({
        queryKey: ['project_board', selectedBoardId],
        queryFn: async () => (await api.get(`/projects/${selectedBoardId}`)).data.data,
        enabled: !!selectedBoardId,
    });

    // Mutations
    const createBoardMut = useMutation({
        mutationFn: (body: any) => api.post('/projects', body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['project_boards'] }); setShowCreateBoard(false); setBoardForm({ name: '', description: '', isShared: false }); },
    });

    const deleteBoardMut = useMutation({
        mutationFn: (id: string) => api.delete(`/projects/${id}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['project_boards'] }); setSelectedBoardId(null); },
    });

    const updateBoardMut = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/projects/${id}`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['project_boards'] });
            qc.invalidateQueries({ queryKey: ['project_board', selectedBoardId] });
            setEditingBoard(null);
        },
    });

    const createTaskMut = useMutation({
        mutationFn: (body: any) => api.post('/projects/tasks', body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['project_board', selectedBoardId] });
            qc.invalidateQueries({ queryKey: ['project_boards'] });
            setShowCreateTask(false);
            setTaskForm({ title: '', description: '', priority: 'MEDIUM', status: 'PLANNED', deadline: '', category: '', isShared: false });
        },
    });

    const updateTaskMut = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => api.patch(`/projects/tasks/${id}`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['project_board', selectedBoardId] });
            qc.invalidateQueries({ queryKey: ['project_boards'] });
            setEditingTask(null);
        },
    });

    const deleteTaskMut = useMutation({
        mutationFn: (id: string) => api.delete(`/projects/tasks/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['project_board', selectedBoardId] });
            qc.invalidateQueries({ queryKey: ['project_boards'] });
        },
    });

    const moveTaskMut = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) =>
            api.patch(`/projects/tasks/${id}/reorder`, { status, kanbanOrder: 0 }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['project_board', selectedBoardId] });
            qc.invalidateQueries({ queryKey: ['project_boards'] });
        },
    });

    const handleDeleteTask = (id: string) => {
        if (window.confirm('Delete this task?')) deleteTaskMut.mutate(id);
    };

    const handleDeleteBoard = (id: string, name: string) => {
        if (window.confirm(`Delete project "${name}" and all its tasks?`)) deleteBoardMut.mutate(id);
    };

    const openEditBoard = () => {
        if (!activeBoard) return;
        setBoardForm({ name: activeBoard.name || '', description: activeBoard.description || '', isShared: !!activeBoard.isShared });
        setEditingBoard(activeBoard);
    };

    const refreshBoard = () => {
        if (!selectedBoardId) return;
        qc.invalidateQueries({ queryKey: ['project_board', selectedBoardId] });
        qc.invalidateQueries({ queryKey: ['project_boards'] });
    };

    const handleDropStatus = (status: string) => {
        if (!draggingTaskId) return;
        const dragged = tasks.find((t: any) => t.id === draggingTaskId);
        if (!dragged || dragged.status === status) {
            setDraggingTaskId(null);
            return;
        }
        moveTaskMut.mutate({ id: draggingTaskId, status });
        setDraggingTaskId(null);
    };

    useEffect(() => {
        if (boardIdParam && boardIdParam !== selectedBoardId) {
            setSelectedBoardId(boardIdParam);
        }
    }, [boardIdParam, selectedBoardId]);

    useEffect(() => {
        if (!taskIdParam || !activeBoard?.tasks?.length) return;
        const task = activeBoard.tasks.find((t: any) => t.id === taskIdParam);
        if (!task) return;
        setEditingTask(task);
        setTaskForm({
            title: task.title || '',
            description: task.description || '',
            category: task.category || '',
            priority: task.priority || 'MEDIUM',
            status: task.status || 'PLANNED',
            deadline: task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '',
            isShared: !!task.isShared,
        });
    }, [taskIdParam, activeBoard]);

    if (!selectedBoardId) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FolderKanban className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                        <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Project Boards</h2>
                    </div>
                    <button className="btn-primary" onClick={() => { setBoardForm({ name: '', description: '', isShared: false }); setShowCreateBoard(true); }}><Plus className="w-4 h-4" /> New Board</button>
                </div>

                {boardsLoading ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[...Array(3)].map((_, i) => <div key={i} className="card h-32 animate-pulse bg-gray-100" />)}
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {boards?.map((b: any) => (
                            <div key={b.id} className="card p-5 hover:shadow-lg transition-all group cursor-pointer" onClick={() => setSelectedBoardId(b.id)}>
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>{b.name}</h3>
                                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setBoardForm({ name: b.name || '', description: b.description || '', isShared: !!b.isShared });
                                                setEditingBoard(b);
                                            }}
                                            className="p-1 hover:text-indigo-500"
                                            title="Edit board"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        {b.ownerId === user?.id && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteBoard(b.id, b.name); }}
                                                className="p-1 hover:text-red-500"
                                                title="Delete board"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <p className="text-sm line-clamp-2 mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                                    {b.description || 'No description provided.'}
                                </p>
                                <div className="flex items-center justify-between mt-auto pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                                            {b._count?.tasks || 0} tasks
                                        </span>
                                        {b.isShared && (
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                                                Shared
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                                        Updated {format(new Date(b.updatedAt), 'MMM d')}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {showCreateBoard && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowCreateBoard(false); }}>
                        <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">Create Project Board</h3>
                                <button onClick={() => setShowCreateBoard(false)}><X className="w-5 h-5" /></button>
                            </div>
                            <form onSubmit={(e) => { e.preventDefault(); createBoardMut.mutate(boardForm); }} className="space-y-4">
                                <div>
                                    <label className="label">Board Name <span className="text-red-500">*</span></label>
                                    <input className="input" required value={boardForm.name} onChange={(e) => setBoardForm({ ...boardForm, name: e.target.value })} placeholder="e.g. My Startup" />
                                </div>
                                <div>
                                    <label className="label">Description</label>
                                    <textarea className="input" rows={3} value={boardForm.description} onChange={(e) => setBoardForm({ ...boardForm, description: e.target.value })} placeholder="What is this project about?" />
                                </div>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={boardForm.isShared}
                                        onChange={(e) => setBoardForm({ ...boardForm, isShared: e.target.checked })}
                                    />
                                    Share with all family users
                                </label>
                                <button type="submit" className="btn-primary w-full" disabled={createBoardMut.isPending}>
                                    {createBoardMut.isPending ? 'Creating...' : 'Create Board'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

            </div>
        );
    }

    // --- Task View ---
    const tasks = activeBoard?.tasks || [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                    <button onClick={() => { setSelectedBoardId(null); setSearchParams({}); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{activeBoard?.name}</h2>
                        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Project Management</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                        <button onClick={() => setView('kanban')} className={`p-2 ${view === 'kanban' ? 'bg-gray-100' : ''}`}><LayoutGrid className="w-4 h-4" /></button>
                        <button onClick={() => setView('list')} className={`p-2 ${view === 'list' ? 'bg-gray-100' : ''}`}><List className="w-4 h-4" /></button>
                    </div>
                    <button className="p-2 rounded-lg border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }} onClick={openEditBoard} title="Edit board">
                        <Pencil className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded-lg border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--color-border)' }} onClick={refreshBoard} title="Refresh board">
                        <RefreshCw className={`w-4 h-4 ${activeBoardLoading || moveTaskMut.isPending ? 'animate-spin' : ''}`} />
                    </button>
                    <button className="btn-primary" onClick={() => { setEditingTask(null); setTaskForm({ title: '', description: '', priority: 'MEDIUM', status: 'PLANNED', deadline: '', category: '', isShared: false }); setShowCreateTask(true); }}><Plus className="w-4 h-4" /> New Task</button>
                </div>
            </div>

            {/* Edit Board Modal */}
            {editingBoard && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditingBoard(null); }}>
                    <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Edit Project Board</h3>
                            <button onClick={() => setEditingBoard(null)}><X className="w-5 h-5" /></button>
                        </div>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                updateBoardMut.mutate({ id: editingBoard.id, data: boardForm });
                            }}
                            className="space-y-4"
                        >
                            <div>
                                <label className="label">Board Name <span className="text-red-500">*</span></label>
                                <input className="input" required value={boardForm.name} onChange={(e) => setBoardForm({ ...boardForm, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="label">Description</label>
                                <textarea className="input" rows={3} value={boardForm.description} onChange={(e) => setBoardForm({ ...boardForm, description: e.target.value })} />
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={boardForm.isShared}
                                    onChange={(e) => setBoardForm({ ...boardForm, isShared: e.target.checked })}
                                />
                                Share with all family users
                            </label>
                            <button type="submit" className="btn-primary w-full" disabled={updateBoardMut.isPending}>
                                {updateBoardMut.isPending ? 'Saving...' : 'Save Board'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Task Modal */}
            {(showCreateTask || editingTask) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) { setShowCreateTask(false); setEditingTask(null); setTaskForm({ title: '', description: '', priority: 'MEDIUM', status: 'PLANNED', deadline: '', category: '', isShared: false }); } }}>
                    <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">{editingTask ? 'Edit Task' : 'Create Task'}</h3>
                            <button onClick={() => { setShowCreateTask(false); setEditingTask(null); setTaskForm({ title: '', description: '', priority: 'MEDIUM', status: 'PLANNED', deadline: '', category: '', isShared: false }); }}><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const body: any = { ...taskForm, projectId: selectedBoardId };
                            if (body.deadline) body.deadline = new Date(body.deadline).toISOString();
                            else delete body.deadline;

                            if (editingTask) {
                                updateTaskMut.mutate({ id: editingTask.id, data: body });
                            } else {
                                createTaskMut.mutate(body);
                            }
                        }} className="space-y-4">
                            <div><label className="label">Title <span className="text-red-500">*</span></label><input className="input" required value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} /></div>
                            <div><label className="label">Description</label><textarea className="input" rows={2} value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="label">Category</label><input className="input" value={taskForm.category} onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value })} placeholder="e.g. Design" /></div>
                                <div>
                                    <label className="label">Priority <span className="text-red-500">*</span></label>
                                    <select className="input" value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
                                        <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Status <span className="text-red-500">*</span></label>
                                    <select className="input" value={taskForm.status} onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}>
                                        <option value="PLANNED">Planned</option><option value="IN_PROGRESS">In Progress</option><option value="DONE">Done</option><option value="ARCHIVED">Archived</option>
                                    </select>
                                </div>
                                <div><label className="label">Deadline</label><input type="date" className="input" value={taskForm.deadline} onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })} /></div>
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={taskForm.isShared}
                                    onChange={(e) => setTaskForm({ ...taskForm, isShared: e.target.checked })}
                                />
                                Share with all users
                            </label>
                            <button type="submit" className="btn-primary w-full" disabled={createTaskMut.isPending || updateTaskMut.isPending}>
                                {createTaskMut.isPending || updateTaskMut.isPending ? 'Saving...' : (editingTask ? 'Save Changes' : 'Create Task')}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {activeBoardLoading ? (
                <div className="animate-pulse space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="card h-20" />)}</div>
            ) : view === 'kanban' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {STATUS_COLS.map((status) => (
                        <div key={status} className="space-y-3">
                            <div className="flex items-center gap-2 px-1">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: statusColors[status] }} />
                                <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{statusLabels[status]}</h4>
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-200" style={{ color: 'var(--color-text-secondary)' }}>
                                    {tasks.filter((t: any) => t.status === status).length}
                                </span>
                            </div>
                            <div
                                className="space-y-2 min-h-[200px] p-2 rounded-xl bg-gray-50/50 border border-dashed"
                                style={{ borderColor: 'var(--color-border)' }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => handleDropStatus(status)}
                            >
                                {tasks.filter((t: any) => t.status === status).map((t: any) => (
                                    <div
                                        key={t.id}
                                        className="card p-3 cursor-pointer hover:shadow-md transition-shadow relative group"
                                        draggable
                                        onDragStart={() => setDraggingTaskId(t.id)}
                                        onClick={() => {
                                            setEditingTask(t);
                                        setTaskForm({
                                            title: t.title || '',
                                            description: t.description || '',
                                            category: t.category || '',
                                            priority: t.priority || 'MEDIUM',
                                            status: t.status || 'PLANNED',
                                            deadline: t.deadline ? new Date(t.deadline).toISOString().split('T')[0] : '',
                                            isShared: !!t.isShared,
                                        });
                                    }}
                                    >
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteTask(t.id); }}
                                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                        <p className="text-sm font-medium pr-5" style={{ color: 'var(--color-text)' }}>{t.title}</p>
                                        <div className="flex items-center gap-2 flex-wrap mt-2">
                                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${priorityColors[t.priority]}20`, color: priorityColors[t.priority] }}>
                                                {t.priority}
                                            </span>
                                            {t.category && <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>{t.category}</span>}
                                            {t.isShared && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                                                    Shared
                                                </span>
                                            )}
                                            {t.deadline && (
                                                <span className="text-[10px]" style={{ color: new Date(t.deadline) < todayStart ? '#dc2626' : 'var(--color-text-secondary)' }}>
                                                    📅 {format(new Date(t.deadline), 'MMM d')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {tasks.filter((t: any) => t.status === status).length === 0 && (
                                    <p className="text-[10px] text-center italic py-4" style={{ color: 'var(--color-text-secondary)' }}>No tasks here</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="card overflow-hidden">
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Title</th><th>Status</th><th>Priority</th><th>Category</th><th>Deadline</th><th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tasks.map((t: any) => (
                                    <tr key={t.id} className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => {
                                        setEditingTask(t);
                                        setTaskForm({
                                            title: t.title || '',
                                            description: t.description || '',
                                            category: t.category || '',
                                            priority: t.priority || 'MEDIUM',
                                            status: t.status || 'PLANNED',
                                            deadline: t.deadline ? new Date(t.deadline).toISOString().split('T')[0] : '',
                                            isShared: !!t.isShared,
                                        });
                                    }}>
                                        <td className="font-medium">{t.title}</td>
                                        <td><span className="badge" style={{ backgroundColor: `${statusColors[t.status]}20`, color: statusColors[t.status] }}>{statusLabels[t.status]}</span></td>
                                        <td><span className="badge" style={{ backgroundColor: `${priorityColors[t.priority]}20`, color: priorityColors[t.priority] }}>{t.priority}</span></td>
                                        <td>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span>{t.category || '-'}</span>
                                                {t.isShared && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">Shared</span>}
                                            </div>
                                        </td>
                                        <td style={{ color: t.deadline && new Date(t.deadline) < todayStart ? '#dc2626' : undefined }}>
                                            {t.deadline ? format(new Date(t.deadline), 'MMM d, yyyy') : '-'}
                                        </td>
                                        <td>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(t.id); }} className="p-1 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
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
