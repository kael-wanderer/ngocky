import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { FolderKanban, Plus, X, LayoutGrid, List, ArrowLeft, Trash2, Pencil, RefreshCw, Copy, Pin } from 'lucide-react';
import NotificationFields, { buildNotificationPayload, emptyNotification, loadNotificationState } from '../components/NotificationFields';
import { format } from 'date-fns';
import { useAuthStore } from '../stores/auth';
import { useSearchParams } from 'react-router-dom';

const STATUS_COLS = ['PLANNED', 'IN_PROGRESS', 'DONE', 'ARCHIVED'] as const;
const statusLabels: Record<string, string> = { PLANNED: 'Planned', IN_PROGRESS: 'In Progress', DONE: 'Done', ARCHIVED: 'Archived' };
const statusColors: Record<string, string> = { PLANNED: '#64748b', IN_PROGRESS: '#4f46e5', DONE: '#059669', ARCHIVED: '#94a3b8' };
const boardStatusLabels: Record<string, string> = { PLAN: 'Plan', WORKING: 'Working', COMPLETED: 'Completed' };
const boardStatusColors: Record<string, string> = { PLAN: '#64748b', WORKING: '#4f46e5', COMPLETED: '#059669' };
const priorityColors: Record<string, string> = { LOW: '#94a3b8', MEDIUM: '#3b82f6', HIGH: '#f59e0b', URGENT: '#ef4444' };
const emptyTaskForm = {
    title: '',
    description: '',
    priority: 'MEDIUM',
    status: 'PLANNED',
    deadline: '',
    category: '',
    isShared: false,
    pinToDashboard: false,
    ...emptyNotification,
};

export default function ProjectsPage() {
    const qc = useQueryClient();
    const { user } = useAuthStore();
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
    const [boardListView, setBoardListView] = useState<'grid' | 'list'>('grid');
    const [view, setView] = useState<'kanban' | 'list'>('kanban');
    const [showCreateBoard, setShowCreateBoard] = useState(false);
    const [editingBoard, setEditingBoard] = useState<any>(null);
    const [showCreateTask, setShowCreateTask] = useState(false);
    const [editingTask, setEditingTask] = useState<any>(null);
    const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

    const [boardStatusFilter, setBoardStatusFilter] = useState<'ALL' | 'PLAN' | 'WORKING' | 'COMPLETED'>('ALL');
    const [boardForm, setBoardForm] = useState({ name: '', description: '', type: 'PERSONAL', boardStatus: 'PLAN', isShared: false, pinToDashboard: false });
    const [draggingBoardId, setDraggingBoardId] = useState<string | null>(null);
    const [dragOverBoardId, setDragOverBoardId] = useState<string | null>(null);
    const [taskForm, setTaskForm] = useState({ ...emptyTaskForm });
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
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['project_boards'] }); setShowCreateBoard(false); setBoardForm({ name: '', description: '', type: 'PERSONAL', boardStatus: 'PLAN', isShared: false, pinToDashboard: false }); },
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
            setTaskForm({ ...emptyTaskForm });
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
        setBoardForm({ name: activeBoard.name || '', description: activeBoard.description || '', type: activeBoard.type || 'PERSONAL', boardStatus: activeBoard.boardStatus || 'PLAN', isShared: !!activeBoard.isShared, pinToDashboard: !!activeBoard.pinToDashboard });
        setEditingBoard(activeBoard);
    };

    const reorderBoardsMut = useMutation({
        mutationFn: (ids: string[]) => api.post('/projects/reorder', { ids }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['project_boards'] }),
    });

    const visibleBoards = boardStatusFilter === 'ALL' ? boards : boards?.filter((b: any) => b.boardStatus === boardStatusFilter);

    const handleBoardDrop = (targetId: string) => {
        if (!draggingBoardId || draggingBoardId === targetId) { setDraggingBoardId(null); setDragOverBoardId(null); return; }
        const ids = (visibleBoards || []).map((b: any) => b.id);
        const from = ids.indexOf(draggingBoardId);
        const to = ids.indexOf(targetId);
        const reordered = [...ids];
        reordered.splice(from, 1);
        reordered.splice(to, 0, draggingBoardId);
        reorderBoardsMut.mutate(reordered);
        setDraggingBoardId(null);
        setDragOverBoardId(null);
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

    const duplicateTask = (task: any) => {
        setEditingTask(null);
        setTaskForm({
            title: `${task.title} (Copy)`,
            description: task.description || '',
            category: task.category || '',
            priority: task.priority || 'MEDIUM',
            status: task.status || 'PLANNED',
            deadline: task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '',
            isShared: !!task.isShared,
            pinToDashboard: !!task.pinToDashboard,
            ...loadNotificationState(task),
        });
        setShowCreateTask(true);
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
            pinToDashboard: !!task.pinToDashboard,
            ...loadNotificationState(task),
        });
    }, [taskIdParam, activeBoard]);

    if (!selectedBoardId) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <FolderKanban className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                        <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Project Boards</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <select className="input" value={boardStatusFilter} onChange={(e) => setBoardStatusFilter(e.target.value as any)}>
                            <option value="ALL">All</option>
                            <option value="PLAN">Plan</option>
                            <option value="WORKING">Working</option>
                            <option value="COMPLETED">Completed</option>
                        </select>
                        <div className="flex items-center rounded-lg border p-1 gap-1" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                            <button onClick={() => setBoardListView('grid')} className={`p-1.5 rounded-md transition-colors ${boardListView === 'grid' ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid className="w-4 h-4" /></button>
                            <button onClick={() => setBoardListView('list')} className={`p-1.5 rounded-md transition-colors ${boardListView === 'list' ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}><List className="w-4 h-4" /></button>
                        </div>
                        <button className="btn-primary whitespace-nowrap" onClick={() => { setBoardForm({ name: '', description: '', type: 'PERSONAL', boardStatus: 'PLAN', isShared: false, pinToDashboard: false }); setShowCreateBoard(true); }}><Plus className="w-4 h-4" /> New Board</button>
                    </div>
                </div>

                {boardsLoading ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[...Array(3)].map((_, i) => <div key={i} className="card h-32 animate-pulse bg-gray-100" />)}
                    </div>
                ) : (
                    <div className={boardListView === 'grid' ? 'grid md:grid-cols-2 lg:grid-cols-3 gap-4' : 'card divide-y overflow-hidden'}>
                        {visibleBoards?.map((b: any) => (
                            boardListView === 'grid' ? (
                                /* ── Grid card ── */
                                <div
                                    key={b.id}
                                    className={`card p-5 transition-all group cursor-grab active:cursor-grabbing ${dragOverBoardId === b.id ? 'ring-2 shadow-lg' : 'hover:shadow-lg'}`}
                                    style={dragOverBoardId === b.id ? { '--tw-ring-color': 'var(--color-primary)' } as any : {}}
                                    draggable
                                    onDragStart={() => setDraggingBoardId(b.id)}
                                    onDragOver={(e) => { e.preventDefault(); setDragOverBoardId(b.id); }}
                                    onDragLeave={() => setDragOverBoardId(null)}
                                    onDrop={() => handleBoardDrop(b.id)}
                                    onDragEnd={() => { setDraggingBoardId(null); setDragOverBoardId(null); }}
                                    onClick={() => setSelectedBoardId(b.id)}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>{b.name}</h3>
                                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
                                            <button onClick={(e) => { e.stopPropagation(); updateBoardMut.mutate({ id: b.id, data: { pinToDashboard: !b.pinToDashboard } }); }} className={`p-1 ${b.pinToDashboard ? 'text-amber-500' : 'hover:text-amber-500'}`} title="Pin board"><Pin className="w-4 h-4" /></button>
                                            <button onClick={(e) => { e.stopPropagation(); setBoardForm({ name: b.name || '', description: b.description || '', type: b.type || 'PERSONAL', boardStatus: b.boardStatus || 'PLAN', isShared: !!b.isShared, pinToDashboard: !!b.pinToDashboard }); setEditingBoard(b); }} className="p-1 hover:text-indigo-500" title="Edit board"><Pencil className="w-4 h-4" /></button>
                                            {b.ownerId === user?.id && <button onClick={(e) => { e.stopPropagation(); handleDeleteBoard(b.id, b.name); }} className="p-1 hover:text-red-500" title="Delete board"><Trash2 className="w-4 h-4" /></button>}
                                        </div>
                                    </div>
                                    <p className="text-sm line-clamp-2 mb-4" style={{ color: 'var(--color-text-secondary)' }}>{b.description || 'No description provided.'}</p>
                                    <div className="flex items-center justify-between mt-auto pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{b._count?.tasks || 0} tasks</span>
                                            {b.isShared && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Shared</span>}
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{String(b.type || 'PERSONAL').replace('_', ' ')}</span>
                                            {b.boardStatus && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${boardStatusColors[b.boardStatus]}20`, color: boardStatusColors[b.boardStatus] }}>{boardStatusLabels[b.boardStatus]}</span>}
                                            {b.pinToDashboard && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Pinned</span>}
                                        </div>
                                        <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>Updated {format(new Date(b.updatedAt), 'MMM d')}</span>
                                    </div>
                                </div>
                            ) : (
                                /* ── List row ── */
                                <div key={b.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors group cursor-pointer" onClick={() => setSelectedBoardId(b.id)}>
                                    {/* Col 1: name */}
                                    <div className="w-44 flex-shrink-0">
                                        <h3 className="font-bold text-sm truncate" style={{ color: 'var(--color-text)' }}>{b.name}</h3>
                                    </div>
                                    {/* Col 2: description */}
                                    <div className="w-64 flex-shrink-0">
                                        <p className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>{b.description || '—'}</p>
                                    </div>
                                    {/* Col 3: task count + shared + type + pinned + updated */}
                                    <div className="flex-1 flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{b._count?.tasks || 0} tasks</span>
                                        {b.isShared && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Shared</span>}
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{String(b.type || 'PERSONAL').replace('_', ' ')}</span>
                                        {b.pinToDashboard && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Pinned</span>}
                                        <span className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>Updated {format(new Date(b.updatedAt), 'MMM d')}</span>
                                    </div>
                                    {/* Col 4: status badge + hover actions */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {b.boardStatus && <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: `${boardStatusColors[b.boardStatus]}20`, color: boardStatusColors[b.boardStatus] }}>{boardStatusLabels[b.boardStatus]}</span>}
                                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
                                            <button onClick={(e) => { e.stopPropagation(); updateBoardMut.mutate({ id: b.id, data: { pinToDashboard: !b.pinToDashboard } }); }} className={`p-1 ${b.pinToDashboard ? 'text-amber-500' : 'hover:text-amber-500'}`} title="Pin"><Pin className="w-3.5 h-3.5" /></button>
                                            <button onClick={(e) => { e.stopPropagation(); setBoardForm({ name: b.name || '', description: b.description || '', type: b.type || 'PERSONAL', boardStatus: b.boardStatus || 'PLAN', isShared: !!b.isShared, pinToDashboard: !!b.pinToDashboard }); setEditingBoard(b); }} className="p-1 hover:text-indigo-500" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                            {b.ownerId === user?.id && <button onClick={(e) => { e.stopPropagation(); handleDeleteBoard(b.id, b.name); }} className="p-1 hover:text-red-500" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>}
                                        </div>
                                    </div>
                                </div>
                            )
                        ))}
                    </div>
                )}

                {editingBoard && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditingBoard(null); }}>
                        <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">Edit Project Board</h3>
                                <button onClick={() => setEditingBoard(null)}><X className="w-5 h-5" /></button>
                            </div>
                            <form onSubmit={(e) => { e.preventDefault(); updateBoardMut.mutate({ id: editingBoard.id, data: boardForm }); }} className="space-y-4">
                                <div>
                                    <label className="label">Board Name <span className="text-red-500">*</span></label>
                                    <input className="input" required value={boardForm.name} onChange={(e) => setBoardForm({ ...boardForm, name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="label">Description</label>
                                    <textarea className="input" rows={3} value={boardForm.description} onChange={(e) => setBoardForm({ ...boardForm, description: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Project Type</label>
                                        <select className="input" value={boardForm.type} onChange={(e) => setBoardForm({ ...boardForm, type: e.target.value })}>
                                            <option value="PERSONAL">Personal</option>
                                            <option value="WORK">Work</option>
                                            <option value="FOR_FUN">For Fun</option>
                                            <option value="STUDY">Study</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label">Status</label>
                                        <select className="input" value={boardForm.boardStatus} onChange={(e) => setBoardForm({ ...boardForm, boardStatus: e.target.value })}>
                                            <option value="PLAN">Plan</option>
                                            <option value="WORKING">Working</option>
                                            <option value="COMPLETED">Completed</option>
                                        </select>
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={boardForm.isShared} onChange={(e) => setBoardForm({ ...boardForm, isShared: e.target.checked })} />
                                    Share with all family users
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={boardForm.pinToDashboard} onChange={(e) => setBoardForm({ ...boardForm, pinToDashboard: e.target.checked })} />
                                    Pin to dashboard
                                </label>
                                <button type="submit" className="btn-primary w-full" disabled={updateBoardMut.isPending}>
                                    {updateBoardMut.isPending ? 'Saving...' : 'Save Board'}
                                </button>
                            </form>
                        </div>
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
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Project Type</label>
                                        <select className="input" value={boardForm.type} onChange={(e) => setBoardForm({ ...boardForm, type: e.target.value })}>
                                            <option value="PERSONAL">Personal</option>
                                            <option value="WORK">Work</option>
                                            <option value="FOR_FUN">For Fun</option>
                                            <option value="STUDY">Study</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label">Status</label>
                                        <select className="input" value={boardForm.boardStatus} onChange={(e) => setBoardForm({ ...boardForm, boardStatus: e.target.value })}>
                                            <option value="PLAN">Plan</option>
                                            <option value="WORKING">Working</option>
                                            <option value="COMPLETED">Completed</option>
                                        </select>
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={boardForm.isShared} onChange={(e) => setBoardForm({ ...boardForm, isShared: e.target.checked })} />
                                    Share with all family users
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={boardForm.pinToDashboard} onChange={(e) => setBoardForm({ ...boardForm, pinToDashboard: e.target.checked })} />
                                    Pin to dashboard
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
                    <button className="btn-primary" onClick={() => { setEditingTask(null); setTaskForm({ ...emptyTaskForm }); setShowCreateTask(true); }}><Plus className="w-4 h-4" /> New Task</button>
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
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Project Type</label>
                                    <select className="input" value={boardForm.type} onChange={(e) => setBoardForm({ ...boardForm, type: e.target.value })}>
                                        <option value="PERSONAL">Personal</option>
                                        <option value="WORK">Work</option>
                                        <option value="FOR_FUN">For Fun</option>
                                        <option value="STUDY">Study</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Status</label>
                                    <select className="input" value={boardForm.boardStatus} onChange={(e) => setBoardForm({ ...boardForm, boardStatus: e.target.value })}>
                                        <option value="PLAN">Plan</option>
                                        <option value="WORKING">Working</option>
                                        <option value="COMPLETED">Completed</option>
                                    </select>
                                </div>
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={boardForm.isShared} onChange={(e) => setBoardForm({ ...boardForm, isShared: e.target.checked })} />
                                Share with all family users
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={boardForm.pinToDashboard} onChange={(e) => setBoardForm({ ...boardForm, pinToDashboard: e.target.checked })} />
                                Pin to dashboard
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) { setShowCreateTask(false); setEditingTask(null); setTaskForm({ ...emptyTaskForm }); } }}>
                    <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">{editingTask ? 'Edit Task' : 'Create Task'}</h3>
                            <button onClick={() => { setShowCreateTask(false); setEditingTask(null); setTaskForm({ ...emptyTaskForm }); }}><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const body: any = { ...taskForm, projectId: selectedBoardId, ...buildNotificationPayload(taskForm) };
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
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={taskForm.pinToDashboard}
                                    onChange={(e) => setTaskForm({ ...taskForm, pinToDashboard: e.target.checked })}
                                />
                                Pin to dashboard
                            </label>
                            <NotificationFields form={taskForm} setForm={setTaskForm} />
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
                                            pinToDashboard: !!t.pinToDashboard,
                                            ...loadNotificationState(t),
                                        });
                                    }}
                                    >
                                        <div className="absolute top-2 right-8 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
                                            <button onClick={(e) => { e.stopPropagation(); updateTaskMut.mutate({ id: t.id, data: { pinToDashboard: !t.pinToDashboard } }); }} className={`p-1 ${t.pinToDashboard ? 'text-amber-500' : 'hover:text-amber-500'}`}><Pin className="w-3.5 h-3.5" /></button>
                                            <button onClick={(e) => { e.stopPropagation(); duplicateTask(t); }} className="p-1 hover:text-sky-500 transition-all"><Copy className="w-3.5 h-3.5" /></button>
                                        </div>
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
                                            {t.pinToDashboard && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">
                                                    Pinned
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
                                            pinToDashboard: !!t.pinToDashboard,
                                            ...loadNotificationState(t),
                                        });
                                    }}>
                                        <td className="font-medium">{t.title}</td>
                                        <td><span className="badge" style={{ backgroundColor: `${statusColors[t.status]}20`, color: statusColors[t.status] }}>{statusLabels[t.status]}</span></td>
                                        <td><span className="badge" style={{ backgroundColor: `${priorityColors[t.priority]}20`, color: priorityColors[t.priority] }}>{t.priority}</span></td>
                                        <td>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span>{t.category || '-'}</span>
                                                {t.isShared && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">Shared</span>}
                                                {t.pinToDashboard && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">Pinned</span>}
                                            </div>
                                        </td>
                                        <td style={{ color: t.deadline && new Date(t.deadline) < todayStart ? '#dc2626' : undefined }}>
                                            {t.deadline ? format(new Date(t.deadline), 'MMM d, yyyy') : '-'}
                                        </td>
                                        <td>
                                            <button onClick={(e) => { e.stopPropagation(); duplicateTask(t); }} className="p-1 hover:text-sky-500"><Copy className="w-4 h-4" /></button>
                                            <button onClick={(e) => { e.stopPropagation(); updateTaskMut.mutate({ id: t.id, data: { pinToDashboard: !t.pinToDashboard } }); }} className={`p-1 ${t.pinToDashboard ? 'text-amber-500' : 'hover:text-amber-500'}`}><Pin className="w-4 h-4" /></button>
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
