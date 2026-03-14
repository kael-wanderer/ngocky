import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { FolderKanban, Plus, X, LayoutGrid, List, ArrowLeft, Trash2, Pencil, RefreshCw, Copy, Pin } from 'lucide-react';
import NotificationFields, { buildNotificationPayload, emptyNotification, loadNotificationState } from '../components/NotificationFields';
import { format } from 'date-fns';
import { useAuthStore } from '../stores/auth';
import { useSearchParams } from 'react-router-dom';
import { getSharedOwnerName } from '../utils/sharedOwnership';
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

const STATUS_COLS = ['PLANNED', 'IN_PROGRESS', 'DONE', 'ARCHIVED'] as const;
const statusLabels: Record<string, string> = { PLANNED: 'Planned', IN_PROGRESS: 'In Progress', DONE: 'Done', ARCHIVED: 'Archived' };
const statusColors: Record<string, string> = { PLANNED: '#64748b', IN_PROGRESS: '#4f46e5', DONE: '#059669', ARCHIVED: '#94a3b8' };
const boardStatusLabels: Record<string, string> = { PLAN: 'Plan', WORKING: 'Working', COMPLETED: 'Completed' };
const boardStatusColors: Record<string, string> = { PLAN: '#64748b', WORKING: '#4f46e5', COMPLETED: '#059669' };
const priorityColors: Record<string, string> = { LOW: '#94a3b8', MEDIUM: '#3b82f6', HIGH: '#f59e0b', URGENT: '#ef4444' };
const taskTypeLabels: Record<string, string> = { TASK: 'Task', BUG: 'Bug', FEATURE: 'Feature', STORY: 'Story', EPIC: 'Epic' };
const taskTypeColors: Record<string, string> = { TASK: '#64748b', BUG: '#dc2626', FEATURE: '#2563eb', STORY: '#7c3aed', EPIC: '#d97706' };
const emptyTaskForm = {
    title: '',
    description: '',
    type: 'TASK',
    priority: 'MEDIUM',
    status: 'PLANNED',
    deadline: '',
    category: '',
    isShared: false,
    pinToDashboard: false,
    ...emptyNotification,
};

function resequenceTasks(items: any[]) {
    return items.map((task, index) => ({ ...task, kanbanOrder: index }));
}

function buildTaskForm(task: any) {
    return {
        title: task.title || '',
        description: task.description || '',
        type: task.type || 'TASK',
        category: task.category || '',
        priority: task.priority || 'MEDIUM',
        status: task.status || 'PLANNED',
        deadline: task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '',
        isShared: !!task.isShared,
        pinToDashboard: !!task.pinToDashboard,
        ...loadNotificationState(task),
    };
}

function KanbanColumn({ status, count, children }: { status: string; count: number; children: React.ReactNode }) {
    const { isOver, setNodeRef } = useDroppable({ id: `column:${status}` });

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: statusColors[status] }} />
                <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{statusLabels[status]}</h4>
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-200" style={{ color: 'var(--color-text-secondary)' }}>
                    {count}
                </span>
            </div>
            <div
                ref={setNodeRef}
                className="space-y-2 min-h-[200px] p-2 rounded-xl bg-gray-50/50 border border-dashed transition-colors"
                style={{
                    borderColor: isOver ? statusColors[status] : 'var(--color-border)',
                    backgroundColor: isOver ? `${statusColors[status]}12` : undefined,
                }}
            >
                {children}
            </div>
        </div>
    );
}

function DraggableTaskCard({ task, todayStart, userId, onOpen, onDuplicate, onTogglePin, onDelete }: {
    task: any;
    todayStart: Date;
    userId?: string;
    onOpen: (task: any) => void;
    onDuplicate: (task: any) => void;
    onTogglePin: (task: any) => void;
    onDelete: (id: string) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `task:${task.id}`,
        data: { taskId: task.id, status: task.status },
    });
    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="card p-3 cursor-pointer hover:shadow-md transition-shadow relative group touch-none"
            onClick={() => onOpen(task)}
            {...listeners}
            {...attributes}
        >
            <div className="absolute top-2 right-8 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
                <button onClick={(e) => { e.stopPropagation(); onTogglePin(task); }} className={`p-1 ${task.pinToDashboard ? 'text-amber-500' : 'hover:text-amber-500'}`}><Pin className="w-3.5 h-3.5" /></button>
                <button onClick={(e) => { e.stopPropagation(); onDuplicate(task); }} className="p-1 hover:text-sky-500 transition-all"><Copy className="w-3.5 h-3.5" /></button>
            </div>
            <button
                onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
            <p className="text-sm font-medium pr-5" style={{ color: 'var(--color-text)' }}>{task.title}</p>
            <div className="flex items-center gap-2 flex-wrap mt-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: `${taskTypeColors[task.type || 'TASK']}20`, color: taskTypeColors[task.type || 'TASK'] }}>
                    {taskTypeLabels[task.type || 'TASK']}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${priorityColors[task.priority]}20`, color: priorityColors[task.priority] }}>
                    {task.priority}
                </span>
                {task.category && <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>{task.category}</span>}
                {task.isShared && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                        Shared
                    </span>
                )}
                {task.pinToDashboard && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">
                        Pinned
                    </span>
                )}
                {task.deadline && (
                    <span className="text-[10px]" style={{ color: new Date(task.deadline) < todayStart ? '#dc2626' : 'var(--color-text-secondary)' }}>
                        📅 {format(new Date(task.deadline), 'MMM d')}
                    </span>
                )}
            </div>
            {getSharedOwnerName(task, userId) && <p className="text-[11px] mt-2" style={{ color: 'var(--color-text-secondary)' }}>Owner: {getSharedOwnerName(task, userId)}</p>}
        </div>
    );
}

export default function ProjectsPage() {
    const qc = useQueryClient();
    const { user } = useAuthStore();
    const [searchParams, setSearchParams] = useSearchParams();
    const boardIdParam = searchParams.get('boardId');
    const taskIdParam = searchParams.get('taskId');
    const selectedBoardId = boardIdParam;
    const [boardListView, setBoardListView] = useState<'grid' | 'list'>('grid');
    const [view, setView] = useState<'kanban' | 'list'>('kanban');
    const [showCreateBoard, setShowCreateBoard] = useState(false);
    const [editingBoard, setEditingBoard] = useState<any>(null);
    const [showCreateTask, setShowCreateTask] = useState(false);
    const [editingTask, setEditingTask] = useState<any>(null);
    const [optimisticTasks, setOptimisticTasks] = useState<any[] | null>(null);
    const [openingBoardId, setOpeningBoardId] = useState<string | null>(null);

    const [boardStatusFilter, setBoardStatusFilter] = useState<'ALL' | 'PLAN' | 'WORKING' | 'COMPLETED'>('ALL');
    const [boardSort, setBoardSort] = useState<'default' | 'name_asc' | 'updated_desc'>('default');
    const [boardForm, setBoardForm] = useState({ name: '', description: '', type: 'PERSONAL', boardStatus: 'PLAN', isShared: false, pinToDashboard: false });
    const [taskForm, setTaskForm] = useState({ ...emptyTaskForm });
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const openBoard = async (boardId: string, taskId?: string | null) => {
        setOpeningBoardId(boardId);
        try {
            await qc.ensureQueryData({
                queryKey: ['project_board', boardId],
                queryFn: async () => (await api.get(`/projects/${boardId}`)).data.data,
            });
        } finally {
            setOpeningBoardId(null);
        }
        const next = new URLSearchParams();
        next.set('boardId', boardId);
        if (taskId) next.set('taskId', taskId);
        setSearchParams(next);
    };

    // Queries
    const { data: boards, isLoading: boardsLoading } = useQuery({
        queryKey: ['project_boards'],
        queryFn: async () => (await api.get('/projects')).data.data,
    });

    const { data: activeBoard, isLoading: activeBoardLoading, isFetching: activeBoardFetching } = useQuery({
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
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['project_boards'] }); setSearchParams({}); },
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
            closeTaskModal();
        },
    });

    const updateTaskMut = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => api.patch(`/projects/tasks/${id}`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['project_board', selectedBoardId] });
            qc.invalidateQueries({ queryKey: ['project_boards'] });
            closeTaskModal();
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
        mutationFn: ({ id, status, kanbanOrder }: { id: string; status: string; kanbanOrder: number }) =>
            api.patch(`/projects/tasks/${id}/reorder`, { status, kanbanOrder }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['project_board', selectedBoardId] });
            qc.invalidateQueries({ queryKey: ['project_boards'] });
        },
        onError: () => {
            setOptimisticTasks(null);
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


    const visibleBoards = (() => {
        const filtered = boardStatusFilter === 'ALL' ? (boards || []) : (boards || []).filter((b: any) => b.boardStatus === boardStatusFilter);
        if (boardSort === 'name_asc') return [...filtered].sort((a: any, b: any) => a.name.localeCompare(b.name));
        if (boardSort === 'updated_desc') return [...filtered].sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
        return filtered;
    })();

    const refreshBoard = () => {
        if (!selectedBoardId) return;
        qc.invalidateQueries({ queryKey: ['project_board', selectedBoardId] });
        qc.invalidateQueries({ queryKey: ['project_boards'] });
    };

    const closeTaskModal = () => {
        setShowCreateTask(false);
        setEditingTask(null);
        setTaskForm({ ...emptyTaskForm });
        if (taskIdParam) {
            const next = new URLSearchParams(searchParams);
            next.delete('taskId');
            setSearchParams(next);
        }
    };

    const duplicateTask = (task: any) => {
        setEditingTask(null);
        setTaskForm({
            title: `${task.title} (Copy)`,
            description: task.description || '',
            type: task.type || 'TASK',
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
        if (!taskIdParam || !activeBoard?.tasks?.length) return;
        const task = activeBoard.tasks.find((t: any) => t.id === taskIdParam);
        if (!task) return;
        setEditingTask(task);
        setTaskForm(buildTaskForm(task));
    }, [taskIdParam, activeBoard]);

    useEffect(() => {
        setOptimisticTasks(null);
    }, [selectedBoardId, activeBoard?.updatedAt]);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

    const tasks = optimisticTasks || activeBoard?.tasks || [];
    const activeBoardSharedOwnerName = getSharedOwnerName(activeBoard, user?.id);

    const openTaskEditor = (task: any) => {
        setEditingTask(task);
        setTaskForm(buildTaskForm(task));
    };

    const handleKanbanDragEnd = (event: DragEndEvent) => {
        const activeId = String(event.active.id || '');
        const overId = event.over ? String(event.over.id || '') : '';
        if (!activeId.startsWith('task:') || !overId.startsWith('column:')) return;

        const taskId = activeId.replace('task:', '');
        const nextStatus = overId.replace('column:', '');
        const currentTask = tasks.find((task: any) => task.id === taskId);

        if (!currentTask || currentTask.status === nextStatus) return;

        const movedTask = { ...currentTask, status: nextStatus };
        const untouched = tasks.filter((task: any) => task.id !== taskId);
        const nextTasks = [
            ...resequenceTasks(untouched.filter((task: any) => task.status !== nextStatus)),
            ...resequenceTasks([...untouched.filter((task: any) => task.status === nextStatus), movedTask]),
        ];
        const normalizedTasks = STATUS_COLS.flatMap((status) => resequenceTasks(nextTasks.filter((task: any) => task.status === status)));

        setOptimisticTasks(normalizedTasks);
        moveTaskMut.mutate({
            id: taskId,
            status: nextStatus,
            kanbanOrder: normalizedTasks.filter((task: any) => task.status === nextStatus).findIndex((task: any) => task.id === taskId),
        });
    };

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
                        <select className="input" value={boardSort} onChange={(e) => setBoardSort(e.target.value as any)}>
                            <option value="default">Default order</option>
                            <option value="name_asc">Name A–Z</option>
                            <option value="updated_desc">Last updated</option>
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
                                (() => {
                                    const sharedOwnerName = getSharedOwnerName(b, user?.id);
                                    return (
                                        <div
                                            key={b.id}
                                            className="card p-5 transition-all group hover:shadow-lg cursor-pointer"
                                            onMouseEnter={() => {
                                                qc.prefetchQuery({
                                                    queryKey: ['project_board', b.id],
                                                    queryFn: async () => (await api.get(`/projects/${b.id}`)).data.data,
                                                });
                                            }}
                                            onClick={() => openBoard(b.id)}
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
                                            <div className="space-y-2 mt-auto pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{b._count?.tasks || 0} tasks</span>
                                                        {b.hasOverdueTasks && (
                                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700">
                                                                Overdue{b.overdueTaskCount ? ` (${b.overdueTaskCount})` : ''}
                                                            </span>
                                                        )}
                                                        {b.isShared && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Shared</span>}
                                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{String(b.type || 'PERSONAL').replace('_', ' ')}</span>
                                                        {b.boardStatus && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${boardStatusColors[b.boardStatus]}20`, color: boardStatusColors[b.boardStatus] }}>{boardStatusLabels[b.boardStatus]}</span>}
                                                        {b.pinToDashboard && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Pinned</span>}
                                                    </div>
                                                    <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>Updated {format(new Date(b.updatedAt), 'MMM d')}</span>
                                                </div>
                                                {sharedOwnerName && (
                                                    <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>Owner: {sharedOwnerName}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()
                            ) : (
                                /* ── List row ── */
                                (() => {
                                    const sharedOwnerName = getSharedOwnerName(b, user?.id);
                                    return (
                                        <div
                                            key={b.id}
                                            className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors group cursor-pointer"
                                            onMouseEnter={() => {
                                                qc.prefetchQuery({
                                                    queryKey: ['project_board', b.id],
                                                    queryFn: async () => (await api.get(`/projects/${b.id}`)).data.data,
                                                });
                                            }}
                                            onClick={() => openBoard(b.id)}
                                        >
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
                                        {b.hasOverdueTasks && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700">Overdue{b.overdueTaskCount ? ` (${b.overdueTaskCount})` : ''}</span>}
                                        {b.isShared && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Shared</span>}
                                        {sharedOwnerName && <span className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>Owner: {sharedOwnerName}</span>}
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
                                    );
                                })()
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
                                <div className="flex items-center justify-between gap-3 pt-2">
                                    <button
                                        type="button"
                                        className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white"
                                        onClick={() => {
                                            if (window.confirm(`Delete project "${editingBoard.name}" and all its tasks?`)) {
                                                deleteBoardMut.mutate(editingBoard.id);
                                                setEditingBoard(null);
                                            }
                                        }}
                                    >
                                        Delete
                                    </button>
                                    <div className="flex gap-2 ml-auto">
                                        <button type="button" className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50" onClick={() => setEditingBoard(null)}>
                                            Cancel
                                        </button>
                                        <button type="submit" className="btn-primary" disabled={updateBoardMut.isPending}>
                                            {updateBoardMut.isPending ? 'Saving...' : 'Save'}
                                        </button>
                                    </div>
                                </div>
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                    <button onClick={() => { setSearchParams({}); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{activeBoard?.name}</h2>
                        {activeBoardSharedOwnerName && <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>Owner: {activeBoardSharedOwnerName}</p>}
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
                        <RefreshCw className={`w-4 h-4 ${activeBoardLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button className="btn-primary" onClick={() => { setEditingTask(null); setTaskForm({ ...emptyTaskForm }); setShowCreateTask(true); }}><Plus className="w-4 h-4" /> New Project Task</button>
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
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                            <div className="flex items-center justify-between gap-3 pt-2">
                                <button
                                    type="button"
                                    className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white"
                                    onClick={() => {
                                        if (window.confirm(`Delete project "${editingBoard.name}" and all its tasks?`)) {
                                            deleteBoardMut.mutate(editingBoard.id);
                                            setEditingBoard(null);
                                        }
                                    }}
                                >
                                    Delete
                                </button>
                                <div className="flex gap-2 ml-auto">
                                    <button type="button" className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50" onClick={() => setEditingBoard(null)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn-primary" disabled={updateBoardMut.isPending}>
                                        {updateBoardMut.isPending ? 'Saving...' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Task Modal */}
            {(showCreateTask || editingTask) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) closeTaskModal(); }}>
                    <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">{editingTask ? 'Edit Project Tasks' : 'New Project Task'}</h3>
                            <button onClick={closeTaskModal}><X className="w-5 h-5" /></button>
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
                                <div>
                                    <label className="label">Type</label>
                                    <select className="input" value={taskForm.type} onChange={(e) => setTaskForm({ ...taskForm, type: e.target.value })}>
                                        {Object.entries(taskTypeLabels).map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>
                                </div>
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
                            <div className="flex items-center justify-between gap-3 pt-2">
                                <div>
                                    {editingTask && (
                                        <button
                                            type="button"
                                            className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white"
                                            onClick={() => {
                                                if (window.confirm('Delete this task?')) {
                                                    deleteTaskMut.mutate(editingTask.id);
                                                    closeTaskModal();
                                                }
                                            }}
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-2 ml-auto">
                                    <button
                                        type="button"
                                        className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
                                        onClick={closeTaskModal}
                                    >
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn-primary" disabled={createTaskMut.isPending || updateTaskMut.isPending}>
                                        {createTaskMut.isPending || updateTaskMut.isPending ? 'Saving...' : (editingTask ? 'Save' : 'Create Project Task')}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {(activeBoardLoading || activeBoardFetching || openingBoardId === selectedBoardId || !activeBoard) ? (
                <div className="animate-pulse space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="card h-20" />)}</div>
            ) : view === 'kanban' ? (
                <DndContext sensors={sensors} onDragEnd={handleKanbanDragEnd}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {STATUS_COLS.map((status) => (
                            <KanbanColumn key={status} status={status} count={tasks.filter((t: any) => t.status === status).length}>
                                {tasks.filter((t: any) => t.status === status).map((t: any) => (
                                    <DraggableTaskCard
                                        key={t.id}
                                        task={t}
                                        todayStart={todayStart}
                                        userId={user?.id}
                                        onOpen={openTaskEditor}
                                        onDuplicate={duplicateTask}
                                        onTogglePin={(task) => updateTaskMut.mutate({ id: task.id, data: { pinToDashboard: !task.pinToDashboard } })}
                                        onDelete={handleDeleteTask}
                                    />
                                ))}
                                {tasks.filter((t: any) => t.status === status).length === 0 && (
                                    <p className="text-[10px] text-center italic py-4" style={{ color: 'var(--color-text-secondary)' }}>Drop tasks here</p>
                                )}
                            </KanbanColumn>
                        ))}
                    </div>
                </DndContext>
            ) : (
                <div className="card overflow-hidden">
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Title</th><th>Type</th><th>Status</th><th>Priority</th><th>Category</th><th>Deadline</th><th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tasks.map((t: any) => (
                                    <tr key={t.id} className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => {
                                        openTaskEditor(t);
                                    }}>
                                        <td className="font-medium">{t.title}</td>
                                        <td><span className="badge" style={{ backgroundColor: `${taskTypeColors[t.type || 'TASK']}20`, color: taskTypeColors[t.type || 'TASK'] }}>{taskTypeLabels[t.type || 'TASK']}</span></td>
                                        <td><span className="badge" style={{ backgroundColor: `${statusColors[t.status]}20`, color: statusColors[t.status] }}>{statusLabels[t.status]}</span></td>
                                        <td><span className="badge" style={{ backgroundColor: `${priorityColors[t.priority]}20`, color: priorityColors[t.priority] }}>{t.priority}</span></td>
                                        <td>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span>{t.category || '-'}</span>
                                                {t.isShared && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">Shared</span>}
                                                {getSharedOwnerName(t, user?.id) && <span className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>Owner: {getSharedOwnerName(t, user?.id)}</span>}
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
