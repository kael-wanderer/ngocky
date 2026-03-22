import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalStorage } from '../utils/useLocalStorage';
import api from '../api/client';
import { FolderKanban, Plus, X, LayoutGrid, List, ArrowLeft, Trash2, Pencil, RefreshCw, Copy, Pin, Filter, ArrowUp, ArrowDown, ChevronsUpDown, Bell, ChevronDown, ChevronUp } from 'lucide-react';
import NotificationFields, { buildNotificationPayload, emptyNotification, loadNotificationState } from '../components/NotificationFields';
import RichTextEditor from '../components/RichTextEditor';
import { format, startOfToday } from 'date-fns';
import { parseCompactAmountInput } from '../utils/amount';
import { useAuthStore } from '../stores/auth';
import { useSearchParams } from 'react-router-dom';
import { getSharedOwnerName } from '../utils/sharedOwnership';
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

function getTaskDeadlineBadge(task: any) {
    if (!task.deadline) return { label: 'No deadline', tone: 'neutral' as const };
    const d = new Date(task.deadline);
    const today = startOfToday();
    const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (dDay < today && task.status !== 'DONE') return { label: `Overdue · ${format(d, 'MMM d, yyyy')}`, tone: 'danger' as const };
    if (dDay.getTime() === today.getTime()) return { label: `Today · ${format(d, 'MMM d')}`, tone: 'warning' as const };
    return { label: format(d, 'MMM d, yyyy'), tone: 'neutral' as const };
}

function formatProjectTaskNotification(item: any): string[] {
    if (!item.notificationEnabled) return [];
    const time = item.notificationTime || '';
    if (item.reminderOffsetUnit === 'ON_DATE' && item.notificationDate) {
        const d = new Date(item.notificationDate);
        return [format(d, 'MMM dd, yyyy'), ...(time ? [time] : [])];
    }
    if (item.reminderOffsetUnit === 'HOURS') {
        const label = `${item.reminderOffsetValue} hour${item.reminderOffsetValue !== 1 ? 's' : ''} before`;
        return [label, ...(time ? [time] : [])];
    }
    if (item.reminderOffsetUnit === 'DAYS') {
        const label = `${item.reminderOffsetValue} day${item.reminderOffsetValue !== 1 ? 's' : ''} before`;
        return [label, ...(time ? [time] : [])];
    }
    return [];
}

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
    cost: '',
    showOnCalendar: false,
    createExpenseAutomatically: false,
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
        cost: task.cost ? String(task.cost) : '',
        showOnCalendar: !!task.showOnCalendar,
        createExpenseAutomatically: !!task.createExpenseAutomatically,
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
            {task.description && (
                <div
                    className="rich-text text-xs mt-2 leading-5 overflow-hidden"
                    style={{ color: 'var(--color-text-secondary)' }}
                    dangerouslySetInnerHTML={{ __html: task.description }}
                />
            )}
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
    const [boardListView, setBoardListView] = useLocalStorage<'grid' | 'list'>('ngocky:projects:boardListView', 'grid');
    const [boardListSortKey, setBoardListSortKey] = useLocalStorage<string>('ngocky:projects:boardListSortKey', '');
    const [boardListSortDir, setBoardListSortDir] = useLocalStorage<'asc' | 'desc'>('ngocky:projects:boardListSortDir', 'asc');
    const [view, setView] = useLocalStorage<'kanban' | 'list'>('ngocky:projects:view', 'kanban');
    const [taskListSortKey, setTaskListSortKey] = useLocalStorage<string>('ngocky:projects:taskListSortKey', '');
    const [taskListSortDir, setTaskListSortDir] = useLocalStorage<'asc' | 'desc'>('ngocky:projects:taskListSortDir', 'asc');
    const [showCreateBoard, setShowCreateBoard] = useState(false);
    const [editingBoard, setEditingBoard] = useState<any>(null);
    const [showCreateTask, setShowCreateTask] = useState(false);
    const [editingTask, setEditingTask] = useState<any>(null);
    const [optimisticTasks, setOptimisticTasks] = useState<any[] | null>(null);
    const [openingBoardId, setOpeningBoardId] = useState<string | null>(null);

    const [boardSearch, setBoardSearch] = useState('');
    const [boardDateFilter, setBoardDateFilter] = useLocalStorage<'ALL' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR'>('ngocky:projects:boardDateFilter', 'ALL');
    const [boardTypeFilter, setBoardTypeFilter] = useLocalStorage<'ALL' | 'PERSONAL' | 'WORK' | 'FOR_FUN' | 'STUDY'>('ngocky:projects:boardTypeFilter', 'ALL');
    const [boardStatusFilter, setBoardStatusFilter] = useLocalStorage<'ALL' | 'PLAN' | 'WORKING' | 'COMPLETED'>('ngocky:projects:boardStatusFilter', 'ALL');
    const [taskSearch, setTaskSearch] = useState('');
    const [taskTypeFilter, setTaskTypeFilter] = useLocalStorage<'ALL' | 'TASK' | 'BUG' | 'FEATURE' | 'STORY' | 'EPIC'>('ngocky:projects:taskTypeFilter', 'ALL');
    const [taskPriorityFilter, setTaskPriorityFilter] = useLocalStorage<'ALL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('ngocky:projects:taskPriorityFilter', 'ALL');
    const [taskStatusFilter, setTaskStatusFilter] = useLocalStorage<'ALL' | 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'ARCHIVED'>('ngocky:projects:taskStatusFilter', 'ALL');
    const [hideDone, setHideDone] = useLocalStorage('ngocky:projects:hideDone', false);
    const [hideArchived, setHideArchived] = useLocalStorage('ngocky:projects:hideArchived', true);
    const [boardForm, setBoardForm] = useState({ name: '', description: '', type: 'PERSONAL', boardStatus: 'PLAN', isShared: false, pinToDashboard: false });
    const [taskForm, setTaskForm] = useState({ ...emptyTaskForm });
    const [taskOptionsOpen, setTaskOptionsOpen] = useState(false);
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


    const visibleBoards = useMemo(() => {
        const q = boardSearch.trim().toLowerCase();
        const now = new Date();
        return (boards || []).filter((b: any) => {
            if (boardStatusFilter !== 'ALL' && b.boardStatus !== boardStatusFilter) return false;
            if (boardTypeFilter !== 'ALL' && b.type !== boardTypeFilter) return false;
            if (boardDateFilter !== 'ALL') {
                const d = new Date(b.createdAt);
                if (boardDateFilter === 'THIS_WEEK') {
                    const start = new Date(now); start.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1)); start.setHours(0,0,0,0);
                    if (d < start) return false;
                } else if (boardDateFilter === 'THIS_MONTH') {
                    if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return false;
                } else if (boardDateFilter === 'LAST_MONTH') {
                    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    if (d.getFullYear() !== lm.getFullYear() || d.getMonth() !== lm.getMonth()) return false;
                } else if (boardDateFilter === 'THIS_YEAR') {
                    if (d.getFullYear() !== now.getFullYear()) return false;
                }
            }
            if (q) {
                const hay = [b.name, b.description, b.type, b.boardStatus].filter(Boolean).join(' ').toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        }).sort((a: any, b: any) => {
            if (!boardListSortKey) return 0;
            let valA: any, valB: any;
            if (boardListSortKey === 'name') { valA = a.name || ''; valB = b.name || ''; }
            else if (boardListSortKey === 'description') { valA = a.description || ''; valB = b.description || ''; }
            else if (boardListSortKey === 'tasks') { valA = a._count?.tasks || 0; valB = b._count?.tasks || 0; }
            else if (boardListSortKey === 'type') { valA = a.type || ''; valB = b.type || ''; }
            else if (boardListSortKey === 'updated') { valA = new Date(a.updatedAt).getTime(); valB = new Date(b.updatedAt).getTime(); }
            else if (boardListSortKey === 'status') { valA = a.boardStatus || ''; valB = b.boardStatus || ''; }
            const cmp = typeof valA === 'number' ? valA - valB : String(valA).localeCompare(String(valB));
            return boardListSortDir === 'asc' ? cmp : -cmp;
        });
    }, [boards, boardSearch, boardDateFilter, boardTypeFilter, boardStatusFilter, boardListSortKey, boardListSortDir]);

    const refreshBoard = () => {
        if (!selectedBoardId) return;
        qc.invalidateQueries({ queryKey: ['project_board', selectedBoardId] });
        qc.invalidateQueries({ queryKey: ['project_boards'] });
    };

    const closeTaskModal = () => {
        setShowCreateTask(false);
        setEditingTask(null);
        setTaskForm({ ...emptyTaskForm });
        setTaskOptionsOpen(false);
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
            cost: task.cost ? String(task.cost) : '',
            showOnCalendar: !!task.showOnCalendar,
            createExpenseAutomatically: !!task.createExpenseAutomatically,
            ...loadNotificationState(task),
        } as typeof emptyTaskForm);
        setShowCreateTask(true);
    };

    useEffect(() => {
        if (!taskIdParam || !activeBoard?.tasks?.length) return;
        const task = activeBoard.tasks.find((t: any) => t.id === taskIdParam);
        if (!task) return;
        setEditingTask(task);
        setTaskForm(buildTaskForm(task) as typeof emptyTaskForm);
    }, [taskIdParam, activeBoard]);

    useEffect(() => {
        setOptimisticTasks(null);
    }, [selectedBoardId, activeBoard?.updatedAt]);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

    const tasks = optimisticTasks || activeBoard?.tasks || [];
    const activeBoardSharedOwnerName = getSharedOwnerName(activeBoard, user?.id);

    const filteredTasks = useMemo(() => {
        const q = taskSearch.trim().toLowerCase();
        return tasks.filter((t: any) => {
            if (taskTypeFilter !== 'ALL' && t.type !== taskTypeFilter) return false;
            if (taskPriorityFilter !== 'ALL' && t.priority !== taskPriorityFilter) return false;
            if (taskStatusFilter !== 'ALL' && t.status !== taskStatusFilter) return false;
            if (hideDone && t.status === 'DONE') return false;
            if (hideArchived && t.status === 'ARCHIVED') return false;
            if (q) {
                const hay = [t.title, t.description, t.category, t.type, t.status, t.priority].filter(Boolean).join(' ').toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }, [tasks, taskSearch, taskTypeFilter, taskPriorityFilter, taskStatusFilter, hideDone, hideArchived]);

    const openTaskEditor = (task: any) => {
        setEditingTask(task);
        setTaskForm(buildTaskForm(task) as typeof emptyTaskForm);
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
                        <div className="flex items-center rounded-lg border p-1 gap-1" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                            <button onClick={() => setBoardListView('grid')} className={`p-1.5 rounded-md transition-colors ${boardListView === 'grid' ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid className="w-4 h-4" /></button>
                            <button onClick={() => setBoardListView('list')} className={`p-1.5 rounded-md transition-colors ${boardListView === 'list' ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}><List className="w-4 h-4" /></button>
                        </div>
                        <button className="btn-primary whitespace-nowrap" onClick={() => { setBoardForm({ name: '', description: '', type: 'PERSONAL', boardStatus: 'PLAN', isShared: false, pinToDashboard: false }); setShowCreateBoard(true); }}><Plus className="w-4 h-4" /> New Board</button>
                    </div>
                </div>

                <div className="card p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Filter className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                        <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Filters</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        <input className="input text-sm" placeholder="Search projects..." value={boardSearch} onChange={(e) => setBoardSearch(e.target.value)} />
                        <select className="input text-sm" value={boardDateFilter} onChange={(e) => setBoardDateFilter(e.target.value as any)}>
                            <option value="ALL">All Time</option>
                            <option value="THIS_WEEK">This Week</option>
                            <option value="THIS_MONTH">This Month</option>
                            <option value="LAST_MONTH">Last Month</option>
                            <option value="THIS_YEAR">This Year</option>
                        </select>
                        <select className="input text-sm" value={boardTypeFilter} onChange={(e) => setBoardTypeFilter(e.target.value as any)}>
                            <option value="ALL">All Types</option>
                            <option value="PERSONAL">Personal</option>
                            <option value="WORK">Work</option>
                            <option value="FOR_FUN">For Fun</option>
                            <option value="STUDY">Study</option>
                        </select>
                        <select className="input text-sm" value={boardStatusFilter} onChange={(e) => setBoardStatusFilter(e.target.value as any)}>
                            <option value="ALL">All Statuses</option>
                            <option value="PLAN">Plan</option>
                            <option value="WORKING">Working</option>
                            <option value="COMPLETED">Completed</option>
                        </select>
                    </div>
                </div>

                {boardsLoading ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[...Array(3)].map((_, i) => <div key={i} className="card h-32 animate-pulse bg-gray-100" />)}
                    </div>
                ) : (
                    <>{boardListView === 'grid' ? (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {visibleBoards?.map((b: any) => {
                                const sharedOwnerName = getSharedOwnerName(b, user?.id);
                                return (
                                    <div
                                        key={b.id}
                                        className="card p-5 transition-all group hover:shadow-lg cursor-pointer"
                                        onMouseEnter={() => { qc.prefetchQuery({ queryKey: ['project_board', b.id], queryFn: async () => (await api.get(`/projects/${b.id}`)).data.data }); }}
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
                                                    {b.hasOverdueTasks && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700">Overdue{b.overdueTaskCount ? ` (${b.overdueTaskCount})` : ''}</span>}
                                                    {b.isShared && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Shared</span>}
                                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{String(b.type || 'PERSONAL').replace('_', ' ')}</span>
                                                    {b.boardStatus && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${boardStatusColors[b.boardStatus]}20`, color: boardStatusColors[b.boardStatus] }}>{boardStatusLabels[b.boardStatus]}</span>}
                                                    {b.pinToDashboard && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Pinned</span>}
                                                </div>
                                                <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>Updated {format(new Date(b.updatedAt), 'MMM d')}</span>
                                            </div>
                                            {sharedOwnerName && <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>Owner: {sharedOwnerName}</p>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="card overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                                        {([
                                            { key: 'name', label: 'Name' },
                                            { key: 'description', label: 'Description' },
                                            { key: 'tasks', label: 'Tasks' },
                                            { key: 'type', label: 'Type' },
                                            { key: 'updated', label: 'Updated' },
                                            { key: 'status', label: 'Status' },
                                        ] as const).map(({ key, label }) => {
                                            const active = boardListSortKey === key;
                                            return (
                                                <th key={key} className="px-4 py-2.5 font-semibold text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                                    <button type="button" className="inline-flex items-center gap-1 hover:opacity-70 transition-opacity" style={{ color: active ? 'var(--color-primary)' : undefined }}
                                                        onClick={() => { if (boardListSortKey === key) setBoardListSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setBoardListSortKey(key); setBoardListSortDir('asc'); } }}>
                                                        {label}
                                                        {active ? boardListSortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" /> : <ChevronsUpDown className="w-3 h-3 opacity-30" />}
                                                    </button>
                                                </th>
                                            );
                                        })}
                                        <th className="px-4 py-2.5 font-semibold text-xs text-right" style={{ color: 'var(--color-text-secondary)' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleBoards?.map((b: any) => {
                                        const sharedOwnerName = getSharedOwnerName(b, user?.id);
                                        return (
                                            <tr key={b.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors group cursor-pointer" style={{ borderColor: 'var(--color-border)' }}
                                                onMouseEnter={() => { qc.prefetchQuery({ queryKey: ['project_board', b.id], queryFn: async () => (await api.get(`/projects/${b.id}`)).data.data }); }}
                                                onClick={() => openBoard(b.id)}>
                                                <td className="px-4 py-2.5">
                                                    <span className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{b.name}</span>
                                                    {sharedOwnerName && <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>Owner: {sharedOwnerName}</p>}
                                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                        {b.isShared && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Shared</span>}
                                                        {b.pinToDashboard && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">Pinned</span>}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5 max-w-[200px]">
                                                    <span className="text-xs truncate block" style={{ color: 'var(--color-text-secondary)' }}>{b.description || '—'}</span>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{b._count?.tasks || 0}</span>
                                                        {b.hasOverdueTasks && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-700">Overdue</span>}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{String(b.type || 'PERSONAL').replace('_', ' ')}</span>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{format(new Date(b.updatedAt), 'MMM d, yyyy')}</span>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    {b.boardStatus && <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: `${boardStatusColors[b.boardStatus]}20`, color: boardStatusColors[b.boardStatus] }}>{boardStatusLabels[b.boardStatus]}</span>}
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <div className="flex items-center gap-1 justify-end">
                                                        <button onClick={(e) => { e.stopPropagation(); updateBoardMut.mutate({ id: b.id, data: { pinToDashboard: !b.pinToDashboard } }); }} className={`p-1 ${b.pinToDashboard ? 'text-amber-500' : 'text-gray-300 hover:text-amber-500'}`} title="Pin"><Pin className="w-3.5 h-3.5" /></button>
                                                        <button onClick={(e) => { e.stopPropagation(); setBoardForm({ name: b.name || '', description: b.description || '', type: b.type || 'PERSONAL', boardStatus: b.boardStatus || 'PLAN', isShared: !!b.isShared, pinToDashboard: !!b.pinToDashboard }); setEditingBoard(b); }} className="p-1 text-gray-400 hover:text-gray-600" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                                        {b.ownerId === user?.id && <button onClick={(e) => { e.stopPropagation(); handleDeleteBoard(b.id, b.name); }} className="p-1 text-red-500 hover:text-red-600" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}</>
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
                                <div className="flex items-start gap-2 p-3 rounded-lg border cursor-pointer" style={{ borderColor: boardForm.isShared ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: boardForm.isShared ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : 'transparent' }} onClick={() => setBoardForm({ ...boardForm, isShared: !boardForm.isShared })}>
                                    <input type="checkbox" checked={boardForm.isShared} onChange={(e) => setBoardForm({ ...boardForm, isShared: e.target.checked })} onClick={(e) => e.stopPropagation()} className="mt-0.5" />
                                    <div><p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Share with all users</p><p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Makes this project board visible to all family members</p></div>
                                </div>
                                <div className="flex items-start gap-2 p-3 rounded-lg border cursor-pointer" style={{ borderColor: boardForm.pinToDashboard ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: boardForm.pinToDashboard ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : 'transparent' }} onClick={() => setBoardForm({ ...boardForm, pinToDashboard: !boardForm.pinToDashboard })}>
                                    <input type="checkbox" checked={boardForm.pinToDashboard} onChange={(e) => setBoardForm({ ...boardForm, pinToDashboard: e.target.checked })} onClick={(e) => e.stopPropagation()} className="mt-0.5" />
                                    <div><p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Pin to dashboard</p><p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Displays this board in the Dashboard pin area</p></div>
                                </div>
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
                                <div className="flex items-start gap-2 p-3 rounded-lg border cursor-pointer" style={{ borderColor: boardForm.isShared ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: boardForm.isShared ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : 'transparent' }} onClick={() => setBoardForm({ ...boardForm, isShared: !boardForm.isShared })}>
                                    <input type="checkbox" checked={boardForm.isShared} onChange={(e) => setBoardForm({ ...boardForm, isShared: e.target.checked })} onClick={(e) => e.stopPropagation()} className="mt-0.5" />
                                    <div><p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Share with all users</p><p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Makes this project board visible to all family members</p></div>
                                </div>
                                <div className="flex items-start gap-2 p-3 rounded-lg border cursor-pointer" style={{ borderColor: boardForm.pinToDashboard ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: boardForm.pinToDashboard ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : 'transparent' }} onClick={() => setBoardForm({ ...boardForm, pinToDashboard: !boardForm.pinToDashboard })}>
                                    <input type="checkbox" checked={boardForm.pinToDashboard} onChange={(e) => setBoardForm({ ...boardForm, pinToDashboard: e.target.checked })} onClick={(e) => e.stopPropagation()} className="mt-0.5" />
                                    <div><p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Pin to dashboard</p><p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Displays this board in the Dashboard pin area</p></div>
                                </div>
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
                    <div className="card p-6 w-full max-w-[50rem] animate-slide-up" onClick={(e) => e.stopPropagation()}>
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
                            <div className="flex items-start gap-2 p-3 rounded-lg border cursor-pointer" style={{ borderColor: boardForm.isShared ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: boardForm.isShared ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : 'transparent' }} onClick={() => setBoardForm({ ...boardForm, isShared: !boardForm.isShared })}>
                                <input type="checkbox" checked={boardForm.isShared} onChange={(e) => setBoardForm({ ...boardForm, isShared: e.target.checked })} onClick={(e) => e.stopPropagation()} className="mt-0.5" />
                                <div><p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Share with all users</p><p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Makes this project board visible to all family members</p></div>
                            </div>
                            <div className="flex items-start gap-2 p-3 rounded-lg border cursor-pointer" style={{ borderColor: boardForm.pinToDashboard ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: boardForm.pinToDashboard ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : 'transparent' }} onClick={() => setBoardForm({ ...boardForm, pinToDashboard: !boardForm.pinToDashboard })}>
                                <input type="checkbox" checked={boardForm.pinToDashboard} onChange={(e) => setBoardForm({ ...boardForm, pinToDashboard: e.target.checked })} onClick={(e) => e.stopPropagation()} className="mt-0.5" />
                                <div><p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Pin to dashboard</p><p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Displays this board in the Dashboard pin area</p></div>
                            </div>
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
                    <div className="card p-6 w-full max-w-[55rem] animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">{editingTask ? 'Edit Project Tasks' : 'New Project Task'}</h3>
                            <button onClick={closeTaskModal}><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const body: any = {
                                ...taskForm,
                                projectId: selectedBoardId,
                                cost: taskForm.cost ? parseCompactAmountInput(taskForm.cost) : null,
                                ...buildNotificationPayload(taskForm),
                            };
                            if (body.deadline) body.deadline = new Date(body.deadline).toISOString();
                            else delete body.deadline;

                            if (editingTask) {
                                updateTaskMut.mutate({ id: editingTask.id, data: body });
                            } else {
                                createTaskMut.mutate(body);
                            }
                        }} className="space-y-4">
                            {/* Title + Pin icon */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="label mb-0">Title <span className="text-red-500">*</span></label>
                                    <button
                                        type="button"
                                        title={taskForm.pinToDashboard ? 'Unpin from dashboard' : 'Pin to dashboard'}
                                        onClick={() => setTaskForm({ ...taskForm, pinToDashboard: !taskForm.pinToDashboard })}
                                        className={`p-1.5 rounded-lg border transition-colors ${taskForm.pinToDashboard ? 'text-amber-500 border-amber-300 bg-amber-50' : 'border-gray-200 hover:border-amber-300 hover:text-amber-400'}`}
                                        style={taskForm.pinToDashboard ? {} : { color: 'var(--color-text-secondary)' }}
                                    >
                                        <Pin className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <input className="input" required value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
                            </div>
                            <div>
                                <label className="label">Description</label>
                                <RichTextEditor
                                    value={taskForm.description}
                                    onChange={(html) => setTaskForm({ ...taskForm, description: html })}
                                />
                            </div>
                            {/* Cost */}
                            <div>
                                <label className="label">
                                    Cost{taskForm.createExpenseAutomatically && <span className="text-red-500"> *</span>}
                                </label>
                                <input
                                    className="input"
                                    value={taskForm.cost}
                                    onChange={(e) => setTaskForm({ ...taskForm, cost: e.target.value })}
                                    placeholder="e.g. 600k or 2M"
                                    required={taskForm.createExpenseAutomatically}
                                />
                            </div>
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
                            {/* Options (collapsible) */}
                            <div className="rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                                <button
                                    type="button"
                                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium"
                                    style={{ color: 'var(--color-text)' }}
                                    onClick={() => setTaskOptionsOpen((o) => !o)}
                                >
                                    <span>Options</span>
                                    {taskOptionsOpen ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />}
                                </button>
                                {taskOptionsOpen && (
                                    <div className="border-t px-3 pb-3 pt-2 space-y-2" style={{ borderColor: 'var(--color-border)' }}>
                                        <div className="flex items-start gap-2 p-3 rounded-lg border" style={{ borderColor: taskForm.showOnCalendar ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: taskForm.showOnCalendar ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : 'transparent', opacity: !taskForm.deadline ? 0.5 : 1 }}>
                                            <input type="checkbox" id="ptShowOnCalendar" checked={taskForm.showOnCalendar} disabled={!taskForm.deadline} onChange={(e) => setTaskForm({ ...taskForm, showOnCalendar: e.target.checked })} className="rounded mt-0.5" />
                                            <div>
                                                <label htmlFor="ptShowOnCalendar" className="text-sm font-medium cursor-pointer" style={{ color: 'var(--color-text)' }}>Add to Calendar</label>
                                                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{taskForm.deadline ? 'Creates a calendar event on the deadline' : 'Requires a deadline'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2 p-3 rounded-lg border" style={{ borderColor: taskForm.createExpenseAutomatically ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: taskForm.createExpenseAutomatically ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : 'transparent' }}>
                                            <input type="checkbox" id="ptCreateExpense" checked={taskForm.createExpenseAutomatically} onChange={(e) => setTaskForm({ ...taskForm, createExpenseAutomatically: e.target.checked })} className="rounded mt-0.5" />
                                            <div>
                                                <label htmlFor="ptCreateExpense" className="text-sm font-medium cursor-pointer" style={{ color: 'var(--color-text)' }}>Add expense</label>
                                                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>Automatically creates an expense entry when the task is marked Done</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2 p-3 rounded-lg border cursor-pointer" style={{ borderColor: taskForm.isShared ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: taskForm.isShared ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : 'transparent' }} onClick={() => setTaskForm({ ...taskForm, isShared: !taskForm.isShared })}>
                                            <input type="checkbox" checked={taskForm.isShared} onChange={(e) => setTaskForm({ ...taskForm, isShared: e.target.checked })} onClick={(e) => e.stopPropagation()} className="mt-0.5" />
                                            <div><p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Share with all users</p><p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Makes this task visible to all family members</p></div>
                                        </div>
                                        <NotificationFields form={taskForm} setForm={setTaskForm} />
                                    </div>
                                )}
                            </div>
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
            ) : (<>
                {/* ── Filter bar ── */}
                <div className="card p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Filter className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                        <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Filters</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <input className="input text-sm flex-1 min-w-[160px]" placeholder="Search tasks..." value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} />
                        <select className="input text-sm w-36" value={taskTypeFilter} onChange={(e) => setTaskTypeFilter(e.target.value as any)}>
                            <option value="ALL">All Types</option>
                            <option value="TASK">Task</option>
                            <option value="BUG">Bug</option>
                            <option value="FEATURE">Feature</option>
                            <option value="STORY">Story</option>
                            <option value="EPIC">Epic</option>
                        </select>
                        <select className="input text-sm w-36" value={taskPriorityFilter} onChange={(e) => setTaskPriorityFilter(e.target.value as any)}>
                            <option value="ALL">All Priorities</option>
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                            <option value="URGENT">Urgent</option>
                        </select>
                        {view === 'list' && (
                            <select className="input text-sm w-36" value={taskStatusFilter} onChange={(e) => setTaskStatusFilter(e.target.value as any)}>
                                <option value="ALL">All Statuses</option>
                                <option value="PLANNED">Planned</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="DONE">Done</option>
                                <option value="ARCHIVED">Archived</option>
                            </select>
                        )}
                        <button
                            type="button"
                            onClick={() => setHideDone(h => !h)}
                            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${hideDone ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                        >
                            <span className={`w-2 h-2 rounded-full ${hideDone ? 'bg-indigo-500' : 'bg-gray-300'}`} />
                            Hide Done
                        </button>
                        <button
                            type="button"
                            onClick={() => setHideArchived(h => !h)}
                            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${hideArchived ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                        >
                            <span className={`w-2 h-2 rounded-full ${hideArchived ? 'bg-indigo-500' : 'bg-gray-300'}`} />
                            Hide Archived
                        </button>
                    </div>
                </div>

                {view === 'kanban' ? (
                <DndContext sensors={sensors} onDragEnd={handleKanbanDragEnd}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {STATUS_COLS.filter(status => !(hideDone && status === 'DONE') && !(hideArchived && status === 'ARCHIVED')).map((status) => (
                            <KanbanColumn key={status} status={status} count={filteredTasks.filter((t: any) => t.status === status).length}>
                                {filteredTasks.filter((t: any) => t.status === status).map((t: any) => (
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
                                {filteredTasks.filter((t: any) => t.status === status).length === 0 && (
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
                                <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                                    {(['title', 'type', 'status', 'priority', 'category', 'deadline'] as const).map((col) => {
                                        const label = col === 'deadline' ? 'Deadline' : col.charAt(0).toUpperCase() + col.slice(1);
                                        const active = taskListSortKey === col;
                                        return (
                                            <th key={col} className="px-4 py-2.5 font-semibold text-xs" style={{ color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center gap-1 hover:opacity-70 transition-opacity"
                                                    onClick={() => {
                                                        if (taskListSortKey === col) setTaskListSortDir(d => d === 'asc' ? 'desc' : 'asc');
                                                        else { setTaskListSortKey(col); setTaskListSortDir('asc'); }
                                                    }}
                                                >
                                                    {label}
                                                    {active
                                                        ? taskListSortDir === 'asc'
                                                            ? <ArrowUp className="w-3 h-3" />
                                                            : <ArrowDown className="w-3 h-3" />
                                                        : <ChevronsUpDown className="w-3 h-3 opacity-30" />
                                                    }
                                                </button>
                                            </th>
                                        );
                                    })}
                                    <th className="px-4 py-2.5 font-semibold text-xs text-right" style={{ color: 'var(--color-text-secondary)' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...filteredTasks].sort((a: any, b: any) => {
                                    if (!taskListSortKey) return 0;
                                    const valA = taskListSortKey === 'deadline' ? (a.deadline ? new Date(a.deadline).getTime() : Infinity) : (a[taskListSortKey] || '');
                                    const valB = taskListSortKey === 'deadline' ? (b.deadline ? new Date(b.deadline).getTime() : Infinity) : (b[taskListSortKey] || '');
                                    const cmp = typeof valA === 'number' ? valA - valB : String(valA).localeCompare(String(valB));
                                    return taskListSortDir === 'asc' ? cmp : -cmp;
                                }).map((t: any) => (
                                    <tr key={t.id} className="border-b last:border-0 cursor-pointer hover:bg-gray-50 transition-colors group" style={{ borderColor: 'var(--color-border)' }} onClick={() => openTaskEditor(t)}>
                                        <td className="px-4 py-2.5">
                                            <span className={`font-medium text-sm ${t.status === 'DONE' || t.status === 'ARCHIVED' ? 'line-through opacity-50' : ''}`} style={{ color: 'var(--color-text)' }}>{t.title}</span>
                                            {t.description && (
                                                <div className="rich-text text-xs mt-1 leading-5" style={{ color: 'var(--color-text-secondary)' }} dangerouslySetInnerHTML={{ __html: t.description }} />
                                            )}
                                            {(() => {
                                                const notifBadges = formatProjectTaskNotification(t);
                                                return (
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                        <Bell className={`w-3 h-3 flex-shrink-0 ${t.notificationEnabled ? 'text-red-500' : 'text-gray-300'}`} />
                                                        {notifBadges.map((badge, i) => (
                                                            <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded bg-purple-50 text-purple-600">{badge}</span>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-4 py-2.5"><span className="badge" style={{ backgroundColor: `${taskTypeColors[t.type || 'TASK']}20`, color: taskTypeColors[t.type || 'TASK'] }}>{taskTypeLabels[t.type || 'TASK']}</span></td>
                                        <td className="px-4 py-2.5"><span className="badge" style={{ backgroundColor: `${statusColors[t.status]}20`, color: statusColors[t.status] }}>{statusLabels[t.status]}</span></td>
                                        <td className="px-4 py-2.5"><span className="badge" style={{ backgroundColor: `${priorityColors[t.priority]}20`, color: priorityColors[t.priority] }}>{t.priority}</span></td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{t.category || '-'}</span>
                                                {t.isShared && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">Shared</span>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5" style={{ color: t.deadline && new Date(t.deadline) < todayStart ? '#dc2626' : 'var(--color-text-secondary)' }}>
                                            <span className="text-xs">{t.deadline ? format(new Date(t.deadline), 'MMM d, yyyy') : '-'}</span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-1 justify-end">
                                                {t.status !== 'DONE' && t.status !== 'ARCHIVED' ? (
                                                    <button onClick={(e) => { e.stopPropagation(); updateTaskMut.mutate({ id: t.id, data: { status: 'DONE' } }); }} className="p-1 text-xs font-medium px-2 rounded text-green-600 bg-green-50 hover:bg-green-100" title="Mark done">Done</button>
                                                ) : (
                                                    <button onClick={(e) => { e.stopPropagation(); updateTaskMut.mutate({ id: t.id, data: { status: 'PLANNED' } }); }} className="p-1 text-xs font-medium px-2 rounded text-orange-600 bg-orange-50 hover:bg-orange-100" title="Reopen">Reopen</button>
                                                )}
                                                <button onClick={(e) => { e.stopPropagation(); updateTaskMut.mutate({ id: t.id, data: { pinToDashboard: !t.pinToDashboard } }); }} className={`p-1 ${t.pinToDashboard ? 'text-amber-500 hover:text-amber-600' : 'text-gray-300 hover:text-amber-400'}`} title="Pin"><Pin className="w-3.5 h-3.5" /></button>
                                                <button onClick={(e) => { e.stopPropagation(); openTaskEditor(t); }} className="p-1 text-gray-400 hover:text-gray-600" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                                <button onClick={(e) => { e.stopPropagation(); duplicateTask(t); }} className="p-1 text-blue-500 hover:text-blue-600" title="Duplicate"><Copy className="w-3.5 h-3.5" /></button>
                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(t.id); }} className="p-1 text-red-500 hover:text-red-600" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                )}
            </>)}
        </div>
    );
}
