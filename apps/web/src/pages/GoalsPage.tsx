import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import {
    Trophy, Plus, X, Check, Trash2, AlertCircle, Pencil, Copy, Pin,
    LayoutGrid, List, Bell, ClipboardList, CheckCircle2,
} from 'lucide-react';
import NotificationFields, { buildNotificationPayload, emptyNotification, loadNotificationState } from '../components/NotificationFields';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuthStore } from '../stores/auth';
import { getSharedOwnerName } from '../utils/sharedOwnership';

const unitOptions = [
    { value: 'times', label: 'Time' },
    { value: 'minutes', label: 'Minute' },
] as const;

const DEFAULT_EXPENSE_PAY_CATEGORY = 'Food';
const expensePayCategories = ['AI', 'Ca Keo', 'Food', 'Gift', 'Healthcare', 'House', 'Insurance', 'Maintenance', 'Education', 'Entertainment', 'Family Support', 'Shopping', 'Transportation', 'Utilities', 'Other'];
const expenseScopeOptions = [
    { value: 'PERSONAL', label: 'Personal' },
    { value: 'FAMILY', label: 'Family' },
    { value: 'KEO', label: 'Ca Keo' },
    { value: 'PROJECT', label: 'Project' },
] as const;

const goalEmptyForm = {
    title: '',
    description: '',
    isShared: false,
    pinToDashboard: false,
    periodType: 'WEEKLY',
    targetCount: 3,
    unit: 'times',
    trackingType: 'BY_FREQUENCY',
    ...emptyNotification,
};

const taskEmptyForm = {
    title: '',
    description: '',
    taskType: 'TASK',
    amount: '',
    expenseCategory: DEFAULT_EXPENSE_PAY_CATEGORY,
    scope: 'PERSONAL',
    isShared: false,
    pinToDashboard: false,
    dueDate: '',
    dueTime: '09:00',
    priority: 'MEDIUM',
    status: 'PLANNED',
    repeatFrequency: '',
    repeatEndType: '',
    repeatUntil: '',
    ...emptyNotification,
};

type GoalFormState = typeof goalEmptyForm;
type TaskFormState = typeof taskEmptyForm;

function formatNotification(item: any): string | null {
    if (!item.notificationEnabled) return null;
    if (item.reminderOffsetUnit === 'ON_DATE' && item.notificationDate) {
        return format(new Date(item.notificationDate), 'MMM dd, yyyy HH:mm');
    }
    if (item.reminderOffsetUnit === 'HOURS') return `${item.reminderOffsetValue} hour${item.reminderOffsetValue !== 1 ? 's' : ''} before`;
    if (item.reminderOffsetUnit === 'DAYS') return `${item.reminderOffsetValue} day${item.reminderOffsetValue !== 1 ? 's' : ''} before`;
    return null;
}

function formatTaskRepeat(task: any): string | null {
    if (!task.repeatFrequency) return null;
    const repeat = task.repeatFrequency.charAt(0) + task.repeatFrequency.slice(1).toLowerCase();
    if (task.repeatEndType === 'ON_DATE' && task.repeatUntil) {
        return `${repeat} until ${format(new Date(task.repeatUntil), 'MMM d, yyyy')}`;
    }
    return repeat;
}

function GoalForm({
    form,
    setForm,
    onSubmit,
    loading,
    isEdit,
}: {
    form: GoalFormState;
    setForm: React.Dispatch<React.SetStateAction<GoalFormState>>;
    onSubmit: (f: any) => void;
    loading: boolean;
    isEdit: boolean;
}) {
    return (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form, ...buildNotificationPayload(form) }); }} className="space-y-4">
            <div>
                <label className="label">Goal Title <span className="text-red-500">*</span></label>
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Go to gym" />
            </div>
            <div>
                <label className="label">Description</label>
                <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional notes about this goal" />
            </div>
            <div>
                <label className="label">How to track progress? <span className="text-red-500">*</span></label>
                <select className="input" value={form.trackingType} onChange={(e) => setForm({ ...form, trackingType: e.target.value })}>
                    <option value="BY_FREQUENCY">By times</option>
                    <option value="BY_QUANTITY">By amount</option>
                </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="label">Target <span className="text-red-500">*</span></label>
                    <select className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                        {unitOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="label">Unit <span className="text-red-500">*</span></label>
                    <input type="number" className="input" min={1} value={form.targetCount} onChange={(e) => setForm({ ...form, targetCount: parseInt(e.target.value, 10) || 1 })} required />
                </div>
            </div>
            <div>
                <label className="label">Reset Period <span className="text-red-500">*</span></label>
                <select className="input" value={form.periodType} onChange={(e) => setForm({ ...form, periodType: e.target.value })}>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                </select>
            </div>
            <div className="grid grid-cols-1 gap-2">
                <NotificationFields form={form} setForm={setForm} />
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.isShared} onChange={(e) => setForm({ ...form, isShared: e.target.checked })} />
                    Share with all users
                </label>
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.pinToDashboard} onChange={(e) => setForm({ ...form, pinToDashboard: e.target.checked })} />
                    Pin to dashboard
                </label>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Goal')}
            </button>
        </form>
    );
}

function TaskForm({
    form,
    setForm,
    onSubmit,
    loading,
    isEdit,
}: {
    form: TaskFormState;
    setForm: React.Dispatch<React.SetStateAction<TaskFormState>>;
    onSubmit: (f: any) => void;
    loading: boolean;
    isEdit: boolean;
}) {
    return (
        <form onSubmit={(e) => {
            e.preventDefault();
            const payload: any = {
                title: form.title,
                description: form.description,
                taskType: form.taskType,
                amount: form.taskType === 'PAYMENT' ? Number(form.amount) : null,
                expenseCategory: form.taskType === 'PAYMENT' ? form.expenseCategory : null,
                scope: form.taskType === 'PAYMENT' ? form.scope : 'PERSONAL',
                isShared: form.isShared,
                pinToDashboard: form.pinToDashboard,
                priority: form.priority,
                status: form.status,
                repeatFrequency: form.repeatFrequency || null,
                repeatEndType: form.repeatFrequency ? (form.repeatEndType || 'NEVER') : null,
                repeatUntil: form.repeatFrequency && form.repeatEndType === 'ON_DATE' && form.repeatUntil
                    ? new Date(`${form.repeatUntil}T23:59:59.999`).toISOString()
                    : null,
                ...buildNotificationPayload(form),
            };
            payload.dueDate = form.dueDate ? new Date(`${form.dueDate}T${form.dueTime || '09:00'}`).toISOString() : null;
            onSubmit(payload);
        }} className="space-y-4">
            <div>
                <label className="label">Task Title <span className="text-red-500">*</span></label>
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Pay electricity bill" />
            </div>
            <div>
                <label className="label">Description</label>
                <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional notes" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                    <label className="label">Type</label>
                    <select className="input" value={form.taskType} onChange={(e) => setForm({
                        ...form,
                        taskType: e.target.value,
                        amount: e.target.value === 'PAYMENT' ? form.amount : '',
                        expenseCategory: e.target.value === 'PAYMENT' ? form.expenseCategory : DEFAULT_EXPENSE_PAY_CATEGORY,
                        scope: e.target.value === 'PAYMENT' ? form.scope : 'PERSONAL',
                        status: e.target.value === 'PAYMENT' ? 'PLANNED' : form.status,
                    })}>
                        <option value="TASK">Task</option>
                        <option value="PAYMENT">Payment</option>
                    </select>
                </div>
                {form.taskType === 'PAYMENT' && (
                    <div>
                        <label className="label">Amount <span className="text-red-500">*</span></label>
                        <input type="number" min={1} step="0.01" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                    </div>
                )}
            </div>
            {form.taskType === 'PAYMENT' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                        <label className="label">Category <span className="text-red-500">*</span></label>
                        <select className="input" value={form.expenseCategory} onChange={(e) => setForm({ ...form, expenseCategory: e.target.value })} required>
                            {expensePayCategories.map((category) => (
                                <option key={category} value={category}>{category}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="label">Scope <span className="text-red-500">*</span></label>
                        <select className="input" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} required>
                            {expenseScopeOptions.map((scope) => (
                                <option key={scope.value} value={scope.value}>{scope.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="label">Due Date</label>
                    <input type="date" className="input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                </div>
                <div>
                    <label className="label">Due Time</label>
                    <input type="time" className="input" value={form.dueTime} disabled={!form.dueDate} onChange={(e) => setForm({ ...form, dueTime: e.target.value })} />
                </div>
            </div>
            <div className={`grid gap-4 ${form.taskType === 'PAYMENT' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                <div>
                    <label className="label">Priority</label>
                    <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                    </select>
                </div>
                {form.taskType !== 'PAYMENT' && (
                    <div>
                        <label className="label">Status</label>
                        <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                            <option value="PLANNED">Planned</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="DONE">Done</option>
                            <option value="ARCHIVED">Archived</option>
                        </select>
                    </div>
                )}
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="label">Repeat</label>
                    <select className="input" value={form.repeatFrequency} onChange={(e) => setForm({ ...form, repeatFrequency: e.target.value, repeatEndType: e.target.value ? (form.repeatEndType || 'NEVER') : '', repeatUntil: e.target.value ? form.repeatUntil : '' })}>
                        <option value="">Does not repeat</option>
                        <option value="DAILY">Daily</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                        <option value="QUARTERLY">Quarterly</option>
                    </select>
                </div>
                {form.repeatFrequency && (
                    <div>
                        <label className="label">End Repeat</label>
                        <select className="input" value={form.repeatEndType || 'NEVER'} onChange={(e) => setForm({ ...form, repeatEndType: e.target.value, repeatUntil: e.target.value === 'ON_DATE' ? form.repeatUntil : '' })}>
                            <option value="NEVER">Never</option>
                            <option value="ON_DATE">On date</option>
                        </select>
                    </div>
                )}
            </div>
            {form.repeatFrequency && form.repeatEndType === 'ON_DATE' && (
                <div>
                    <label className="label">Repeat Until</label>
                    <input type="date" min={form.dueDate || format(new Date(), 'yyyy-MM-dd')} className="input" value={form.repeatUntil} onChange={(e) => setForm({ ...form, repeatUntil: e.target.value })} />
                </div>
            )}
            <div className="space-y-2">
                <NotificationFields form={form} setForm={setForm} />
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.isShared} onChange={(e) => setForm({ ...form, isShared: e.target.checked })} />
                    Share with all users
                </label>
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.pinToDashboard} onChange={(e) => setForm({ ...form, pinToDashboard: e.target.checked })} />
                    Pin to dashboard
                </label>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Saving...' : (isEdit ? 'Save Task' : 'Create Task')}
            </button>
        </form>
    );
}

type GoalsPageProps = {
    forcedTab?: 'GOALS' | 'TASKS';
};

export default function GoalsPage({ forcedTab }: GoalsPageProps) {
    const qc = useQueryClient();
    const { user } = useAuthStore();
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<'GOALS' | 'TASKS'>(() => {
        if (forcedTab) return forcedTab;
        return (searchParams.get('tab') || '').toUpperCase() === 'TASKS' ? 'TASKS' : 'GOALS';
    });
    const [showCreate, setShowCreate] = useState(false);
    const [editGoal, setEditGoal] = useState<any>(null);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [editTask, setEditTask] = useState<any>(null);
    const [checkInGoalId, setCheckInGoalId] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [dateError, setDateError] = useState('');
    const [duration, setDuration] = useState<number | ''>('');
    const [quantity, setQuantity] = useState(1);
    const [periodFilter, setPeriodFilter] = useState<'ALL' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY'>('ALL');
    const [taskFilter, setTaskFilter] = useState<'ALL' | 'OPEN' | 'DONE' | 'OVERDUE'>('ALL');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [draggingGoalId, setDraggingGoalId] = useState<string | null>(null);
    const [dragOverGoalId, setDragOverGoalId] = useState<string | null>(null);
    const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
    const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
    const [goalForm, setGoalForm] = useState({ ...goalEmptyForm });
    const [taskForm, setTaskForm] = useState({ ...taskEmptyForm });
    const editIdParam = searchParams.get('editId');
    const checkInIdParam = searchParams.get('checkInId');
    const showTabSwitcher = !forcedTab;

    useEffect(() => {
        if (forcedTab && activeTab !== forcedTab) {
            setActiveTab(forcedTab);
        }
    }, [forcedTab, activeTab]);

    const { data: goalsData, isLoading: goalsLoading } = useQuery({
        queryKey: ['goals'],
        queryFn: async () => (await api.get('/goals?limit=50')).data.data,
    });

    const { data: tasksData, isLoading: tasksLoading } = useQuery({
        queryKey: ['tasks'],
        queryFn: async () => (await api.get('/tasks?limit=100')).data.data,
    });

    const createGoalMut = useMutation({
        mutationFn: (body: any) => api.post('/goals', body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['goals'] });
            setShowCreate(false);
            setGoalForm({ ...goalEmptyForm });
        },
    });

    const updateGoalMut = useMutation({
        mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/goals/${id}`, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['goals'] });
            setEditGoal(null);
        },
    });

    const deleteGoalMut = useMutation({
        mutationFn: (id: string) => api.delete(`/goals/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
    });

    const reorderMut = useMutation({
        mutationFn: (ids: string[]) => api.post('/goals/reorder', { ids }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
    });

    const resetMut = useMutation({
        mutationFn: (id: string) => api.post(`/goals/${id}/reset`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['goals'] });
            alert('Goal count recalculated from actual check-in history.');
        },
    });

    const checkInMut = useMutation({
        mutationFn: (body: any) => api.post('/checkins', body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['goals'] });
            setCheckInGoalId(null);
            setNote('');
            setDate(new Date().toISOString().split('T')[0]);
            setQuantity(1);
            setDuration('');
            setDateError('');
        },
        onError: (err: any) => {
            alert(err?.response?.data?.message || 'Check-in failed. Please try again.');
        },
    });

    const createTaskMut = useMutation({
        mutationFn: (body: any) => api.post('/tasks', body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['tasks'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            setShowTaskModal(false);
            setTaskForm({ ...taskEmptyForm });
        },
    });

    const updateTaskMut = useMutation({
        mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/tasks/${id}`, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['tasks'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            setEditTask(null);
        },
    });

    const completeTaskMut = useMutation({
        mutationFn: (id: string) => api.post(`/tasks/${id}/complete`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['tasks'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            qc.invalidateQueries({ queryKey: ['expenses'] });
        },
    });

    const deleteTaskMut = useMutation({
        mutationFn: (id: string) => api.delete(`/tasks/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['tasks'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
        },
    });

    const reorderTasksMut = useMutation({
        mutationFn: (ids: string[]) => api.post('/tasks/reorder', { ids }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
    });

    const goals = goalsData || [];
    const tasks = tasksData || [];
    const selectedGoal = goals.find((g: any) => g.id === checkInGoalId);

    const filteredGoals = useMemo(() => {
        if (periodFilter === 'ALL') return goals;
        return goals.filter((goal: any) => goal.periodType === periodFilter);
    }, [goals, periodFilter]);

    const filteredTasks = useMemo(() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (taskFilter === 'ALL') return tasks;
        if (taskFilter === 'OPEN') return tasks.filter((task: any) => !['DONE', 'ARCHIVED'].includes(task.status));
        if (taskFilter === 'DONE') return tasks.filter((task: any) => task.status === 'DONE');
        return tasks.filter((task: any) => task.dueDate && new Date(task.dueDate) < todayStart && !['DONE', 'ARCHIVED'].includes(task.status));
    }, [tasks, taskFilter]);

    const today = new Date().toISOString().split('T')[0];
    const minDateObj = new Date();
    minDateObj.setDate(minDateObj.getDate() - 45);
    const minDate = minDateObj.toISOString().split('T')[0];

    const handleGoalDrop = (targetId: string) => {
        if (!draggingGoalId || draggingGoalId === targetId) { setDraggingGoalId(null); setDragOverGoalId(null); return; }
        const ids = filteredGoals.map((g: any) => g.id);
        const from = ids.indexOf(draggingGoalId);
        const to = ids.indexOf(targetId);
        const reordered = [...ids];
        reordered.splice(from, 1);
        reordered.splice(to, 0, draggingGoalId);
        reorderMut.mutate(reordered);
        setDraggingGoalId(null);
        setDragOverGoalId(null);
    };

    const handleTaskDrop = (targetId: string) => {
        if (!draggingTaskId || draggingTaskId === targetId) {
            setDraggingTaskId(null);
            setDragOverTaskId(null);
            return;
        }

        const ids = tasks.map((task: any) => task.id);
        const from = ids.indexOf(draggingTaskId);
        const to = ids.indexOf(targetId);
        if (from === -1 || to === -1) {
            setDraggingTaskId(null);
            setDragOverTaskId(null);
            return;
        }

        const reordered = [...ids];
        reordered.splice(from, 1);
        reordered.splice(to, 0, draggingTaskId);
        reorderTasksMut.mutate(reordered);
        setDraggingTaskId(null);
        setDragOverTaskId(null);
    };

    const handleDateChange = (val: string) => {
        setDate(val);
        if (!val) { setDateError(''); return; }
        if (val > today) setDateError(`Future dates are not allowed. Latest allowed date: ${today}.`);
        else if (val < minDate) setDateError(`Too far in the past. Earliest allowed date: ${minDate} (last 45 days).`);
        else setDateError('');
    };

    const openEditGoal = (goal: any) => {
        setEditGoal(goal);
        setGoalForm({
            title: goal.title,
            description: goal.description || '',
            isShared: !!goal.isShared,
            pinToDashboard: !!goal.pinToDashboard,
            periodType: goal.periodType,
            targetCount: goal.targetCount,
            unit: goal.unit || 'times',
            trackingType: goal.trackingType || 'BY_FREQUENCY',
            ...loadNotificationState(goal),
        });
    };

    const openDuplicateGoal = (goal: any) => {
        setEditGoal(null);
        setGoalForm({
            title: `${goal.title} (Copy)`,
            description: goal.description || '',
            isShared: !!goal.isShared,
            pinToDashboard: !!goal.pinToDashboard,
            periodType: goal.periodType,
            targetCount: goal.targetCount,
            unit: goal.unit || 'times',
            trackingType: goal.trackingType || 'BY_FREQUENCY',
            ...loadNotificationState(goal),
        });
        setShowCreate(true);
    };

    const openCreateTask = () => {
        setEditTask(null);
        setTaskForm({ ...taskEmptyForm });
        setShowTaskModal(true);
    };

    const openEditTask = (task: any) => {
        setShowTaskModal(false);
        setEditTask(task);
        setTaskForm({
            title: task.title || '',
            description: task.description || '',
            taskType: task.taskType || 'TASK',
            amount: task.amount != null ? String(task.amount) : '',
            expenseCategory: task.expenseCategory || DEFAULT_EXPENSE_PAY_CATEGORY,
            scope: task.scope || 'PERSONAL',
            isShared: !!task.isShared,
            pinToDashboard: !!task.pinToDashboard,
            dueDate: task.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : '',
            dueTime: task.dueDate ? format(new Date(task.dueDate), 'HH:mm') : '09:00',
            priority: task.priority || 'MEDIUM',
            status: task.status || 'PLANNED',
            repeatFrequency: task.repeatFrequency || '',
            repeatEndType: task.repeatEndType || '',
            repeatUntil: task.repeatUntil ? format(new Date(task.repeatUntil), 'yyyy-MM-dd') : '',
            ...loadNotificationState(task),
        });
    };

    const openDuplicateTask = (task: any) => {
        setEditTask(null);
        setTaskForm({
            title: `${task.title} (Copy)`,
            description: task.description || '',
            taskType: task.taskType || 'TASK',
            amount: task.amount != null ? String(task.amount) : '',
            expenseCategory: task.expenseCategory || DEFAULT_EXPENSE_PAY_CATEGORY,
            scope: task.scope || 'PERSONAL',
            isShared: !!task.isShared,
            pinToDashboard: !!task.pinToDashboard,
            dueDate: task.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : '',
            dueTime: task.dueDate ? format(new Date(task.dueDate), 'HH:mm') : '09:00',
            priority: task.priority || 'MEDIUM',
            status: 'PLANNED',
            repeatFrequency: task.repeatFrequency || '',
            repeatEndType: task.repeatEndType || '',
            repeatUntil: task.repeatUntil ? format(new Date(task.repeatUntil), 'yyyy-MM-dd') : '',
            ...loadNotificationState(task),
        });
        setShowTaskModal(true);
    };

    const openCheckIn = (goalId: string) => {
        setCheckInGoalId(goalId);
        setDate(new Date().toISOString().split('T')[0]);
        setQuantity(1);
        setDuration('');
        setNote('');
        setDateError('');
    };

    const handleCheckInSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (dateError || date < minDate || date > today) {
            alert(dateError || `Date must be between ${minDate} and ${today}.`);
            return;
        }
        const payload: any = {
            goalId: checkInGoalId,
            quantity: selectedGoal?.trackingType === 'BY_QUANTITY' ? quantity : 1,
            date,
        };
        const noteText = [
            selectedGoal?.trackingType === 'BY_FREQUENCY' && duration ? `Duration: ${duration} mins` : '',
            note,
        ].filter(Boolean).join(' | ');
        if (noteText) payload.note = noteText;
        checkInMut.mutate(payload);
    };

    useEffect(() => {
        if (!goals.length) return;
        if (editIdParam && activeTab === 'GOALS') {
            const goal = goals.find((g: any) => g.id === editIdParam);
            if (goal) openEditGoal(goal);
        }
        if (checkInIdParam && activeTab === 'GOALS') {
            const goal = goals.find((g: any) => g.id === checkInIdParam);
            if (goal) openCheckIn(goal.id);
        }
    }, [goals, editIdParam, checkInIdParam, activeTab]);

    useEffect(() => {
        if (forcedTab) return;
        const next = new URLSearchParams(searchParams);
        next.set('tab', activeTab === 'TASKS' ? 'tasks' : 'goals');
        if (activeTab === 'TASKS') {
            next.delete('editId');
            next.delete('checkInId');
        }
        setSearchParams(next, { replace: true });
    }, [activeTab, forcedTab, searchParams, setSearchParams]);

    useEffect(() => {
        if (!editGoal && !checkInGoalId && !showCreate && (editIdParam || checkInIdParam) && activeTab === 'GOALS') {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete('editId');
                next.delete('checkInId');
                return next;
            }, { replace: true });
        }
    }, [editGoal, checkInGoalId, showCreate, editIdParam, checkInIdParam, setSearchParams, activeTab]);

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Trophy className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{activeTab === 'GOALS' ? 'Goals' : 'Tasks'}</h2>
                </div>
                {showTabSwitcher && (
                    <div className="flex bg-gray-100 p-1 rounded-lg self-start sm:self-auto">
                        <button className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'GOALS' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('GOALS')} style={activeTab === 'GOALS' ? { color: 'var(--color-primary)' } : {}}>Goals</button>
                        <button className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'TASKS' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('TASKS')} style={activeTab === 'TASKS' ? { color: 'var(--color-primary)' } : {}}>Tasks</button>
                    </div>
                )}
            </div>

            {activeTab === 'GOALS' ? (
                <>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-2">
                            <select className="input" value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value as any)}>
                                <option value="ALL">All</option>
                                <option value="WEEKLY">Weekly</option>
                                <option value="MONTHLY">Monthly</option>
                                <option value="QUARTERLY">Quarterly</option>
                            </select>
                            <div className="flex items-center rounded-lg border p-1 gap-1" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`} title="Grid view"><LayoutGrid className="w-4 h-4" /></button>
                                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`} title="List view"><List className="w-4 h-4" /></button>
                            </div>
                        </div>
                        <button className="btn-primary whitespace-nowrap" onClick={() => { setGoalForm({ ...goalEmptyForm }); setShowCreate(true); }}>
                            <Plus className="w-4 h-4" /> New Goal
                        </button>
                    </div>

                    {goalsLoading ? (
                        <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="card p-5 h-32 animate-pulse bg-gray-100" />)}</div>
                    ) : filteredGoals.length === 0 ? (
                        <div className="card p-12 flex flex-col items-center border-dashed border-2">
                            <Trophy className="w-12 h-12 mb-4 opacity-10" />
                            <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text-secondary)' }}>No goals yet</h3>
                            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Set your first goal and start building habits.</p>
                        </div>
                    ) : viewMode === 'grid' ? (
                        <div className="grid gap-4 md:grid-cols-2">
                            {filteredGoals.map((goal: any) => {
                                const sharedOwnerName = getSharedOwnerName(goal, user?.id);
                                const progressPct = goal.targetCount > 0 ? (goal.currentCount / goal.targetCount) * 100 : 0;
                                const barPct = Math.min(100, progressPct);
                                const completed = goal.currentCount >= goal.targetCount;
                                const overachieved = progressPct > 100;
                                return (
                                    <div
                                        key={goal.id}
                                        className={`card p-5 animate-slide-up transition-shadow cursor-grab active:cursor-grabbing ${dragOverGoalId === goal.id ? 'ring-2 shadow-lg' : 'hover:shadow-lg'}`}
                                        style={dragOverGoalId === goal.id ? { '--tw-ring-color': 'var(--color-primary)' } as any : {}}
                                        draggable
                                        onDragStart={() => setDraggingGoalId(goal.id)}
                                        onDragOver={(e) => { e.preventDefault(); setDragOverGoalId(goal.id); }}
                                        onDragLeave={() => setDragOverGoalId(null)}
                                        onDrop={() => handleGoalDrop(goal.id)}
                                        onDragEnd={() => { setDraggingGoalId(null); setDragOverGoalId(null); }}
                                    >
                                        <div className="flex items-start justify-between mb-2 gap-3">
                                            <div className="flex-1 min-w-0 pr-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="font-semibold" style={{ color: 'var(--color-text)' }}>{goal.title}</h4>
                                                    {goal.isShared && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">Shared</span>}
                                                    {goal.pinToDashboard && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">Pinned</span>}
                                                </div>
                                                {goal.description && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{goal.description}</p>}
                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100" style={{ color: 'var(--color-text-secondary)' }}>{goal.trackingType === 'BY_FREQUENCY' ? 'Count-based' : 'Amount-based'}</span>
                                                    <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>{goal.periodType}</span>
                                                </div>
                                                {sharedOwnerName && (
                                                    <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>Owner: {sharedOwnerName}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                <button onClick={() => updateGoalMut.mutate({ id: goal.id, body: { pinToDashboard: !goal.pinToDashboard } })} className={`p-1 transition-colors ${goal.pinToDashboard ? 'text-amber-500' : 'hover:text-amber-500'}`} title="Pin goal"><Pin className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => openEditGoal(goal)} className="p-1 hover:text-indigo-500 transition-colors" title="Edit goal"><Pencil className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => openDuplicateGoal(goal)} className="p-1 hover:text-sky-500 transition-colors" title="Duplicate goal"><Copy className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => { if (window.confirm('Recalculate count from actual check-in history?')) resetMut.mutate(goal.id); }} className="p-1 hover:text-blue-500 transition-colors" title="Fix/recalculate count" disabled={resetMut.isPending}><span className="text-xs leading-none">🔄</span></button>
                                                <button onClick={() => { if (window.confirm('Delete this goal and ALL its check-ins? This cannot be undone.')) deleteGoalMut.mutate(goal.id); }} className="p-1 hover:text-red-500 transition-colors" title="Delete goal"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                                                <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${barPct}%`, background: overachieved ? 'linear-gradient(90deg, #059669, #34d399)' : completed ? 'linear-gradient(90deg, #059669, #10b981)' : 'linear-gradient(90deg, #4f46e5, #7c3aed)' }} />
                                            </div>
                                            <span className="text-sm font-bold whitespace-nowrap" style={{ color: completed ? '#059669' : 'var(--color-primary)' }}>{Math.round(progressPct)}%</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{goal.currentCount}/{goal.targetCount} {goal.unit}</p>
                                            <div className="flex items-center gap-2">
                                                <button className="btn-primary text-xs py-1.5 px-3" onClick={() => openCheckIn(goal.id)} disabled={!goal.active}><Check className="w-3 h-3" /> Check-in</button>
                                                <span className="text-xs font-medium whitespace-nowrap" style={{ color: progressPct > 100 ? '#7c3aed' : progressPct === 100 ? '#059669' : progressPct >= 50 ? '#d97706' : '#dc2626' }}>
                                                    {progressPct > 100 ? 'Overachievement' : progressPct === 100 ? 'Done' : progressPct >= 50 ? 'Almost there' : 'Try hard'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="card divide-y">
                            {filteredGoals.map((goal: any) => {
                                const sharedOwnerName = getSharedOwnerName(goal, user?.id);
                                const progressPct = goal.targetCount > 0 ? (goal.currentCount / goal.targetCount) * 100 : 0;
                                const barPct = Math.min(100, progressPct);
                                const completed = goal.currentCount >= goal.targetCount;
                                const overachieved = progressPct > 100;
                                const notifText = formatNotification(goal);
                                return (
                                    <div key={goal.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors group">
                                        <div className="w-44 flex-shrink-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-medium text-sm truncate" style={{ color: 'var(--color-text)' }}>{goal.title}</span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 font-medium capitalize flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }}>{goal.periodType.charAt(0) + goal.periodType.slice(1).toLowerCase()}</span>
                                                {goal.isShared && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold flex-shrink-0">Shared</span>}
                                                {goal.pinToDashboard && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold flex-shrink-0">Pinned</span>}
                                            </div>
                                            {sharedOwnerName && <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>Owner: {sharedOwnerName}</p>}
                                        </div>
                                        <div className="w-56 flex-shrink-0">
                                            <p className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>{goal.description || '—'}</p>
                                        </div>
                                        <div className="w-48 flex-shrink-0 flex items-center gap-2">
                                            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                                <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${barPct}%`, background: overachieved ? 'linear-gradient(90deg, #059669, #34d399)' : completed ? 'linear-gradient(90deg, #059669, #10b981)' : 'linear-gradient(90deg, #4f46e5, #7c3aed)' }} />
                                            </div>
                                            <span className="text-xs whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>{goal.currentCount}/{goal.targetCount} {goal.unit}</span>
                                            <span className="text-xs font-semibold whitespace-nowrap" style={{ color: overachieved ? '#7c3aed' : completed ? '#059669' : 'var(--color-primary)' }}>{Math.round(progressPct)}%</span>
                                        </div>
                                        <div className="flex-1">
                                            {notifText && <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}><Bell className="w-3 h-3 flex-shrink-0" />{notifText}</span>}
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                            <button onClick={() => openCheckIn(goal.id)} disabled={!goal.active} className="p-1.5 rounded-md hover:bg-emerald-50 hover:text-emerald-600 transition-colors" title="Check-in"><Check className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => updateGoalMut.mutate({ id: goal.id, body: { pinToDashboard: !goal.pinToDashboard } })} className={`p-1.5 rounded-md transition-colors ${goal.pinToDashboard ? 'text-amber-500' : 'hover:text-amber-500'}`} title="Pin goal"><Pin className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => openEditGoal(goal)} className="p-1.5 rounded-md hover:text-indigo-500 transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => openDuplicateGoal(goal)} className="p-1.5 rounded-md hover:text-sky-500 transition-colors" title="Duplicate"><Copy className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => { if (window.confirm('Delete this goal and ALL its check-ins? This cannot be undone.')) deleteGoalMut.mutate(goal.id); }} className="p-1.5 rounded-md hover:text-red-500 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            ) : (
                <>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-2">
                            <select className="input" value={taskFilter} onChange={(e) => setTaskFilter(e.target.value as any)}>
                                <option value="ALL">All</option>
                                <option value="OPEN">Open</option>
                                <option value="DONE">Done</option>
                                <option value="OVERDUE">Overdue</option>
                            </select>
                        </div>
                        <button className="btn-primary whitespace-nowrap" onClick={openCreateTask}>
                            <Plus className="w-4 h-4" /> Add Task
                        </button>
                    </div>

                    {tasksLoading ? (
                        <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="card p-5 h-28 animate-pulse bg-gray-100" />)}</div>
                    ) : filteredTasks.length === 0 ? (
                        <div className="card p-12 flex flex-col items-center border-dashed border-2">
                            <ClipboardList className="w-12 h-12 mb-4 opacity-10" />
                            <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text-secondary)' }}>No tasks yet</h3>
                            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Create standalone tasks here without putting them into project boards.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {filteredTasks.map((task: any) => {
                                const sharedOwnerName = getSharedOwnerName(task, user?.id);
                                const canManage = !sharedOwnerName;
                                const notifText = formatNotification(task);
                                const repeatText = formatTaskRepeat(task);
                                const isDone = task.status === 'DONE';
                                const isArchived = task.status === 'ARCHIVED';
                                const dueDate = task.dueDate ? new Date(task.dueDate) : null;
                                const isOverdue = dueDate ? dueDate < new Date(new Date().setHours(0, 0, 0, 0)) && !isDone && !isArchived : false;
                                const canReorderTasks = taskFilter === 'ALL' && canManage;
                                return (
                                    <div
                                        key={task.id}
                                        className={`card p-5 animate-slide-up transition-shadow ${canReorderTasks ? 'cursor-grab active:cursor-grabbing' : ''} ${dragOverTaskId === task.id ? 'ring-2 shadow-lg' : 'hover:shadow-lg'}`}
                                        style={dragOverTaskId === task.id ? { '--tw-ring-color': 'var(--color-primary)' } as any : {}}
                                        draggable={canReorderTasks}
                                        onDragStart={() => canReorderTasks && setDraggingTaskId(task.id)}
                                        onDragOver={(e) => {
                                            if (!canReorderTasks || !draggingTaskId) return;
                                            e.preventDefault();
                                            setDragOverTaskId(task.id);
                                        }}
                                        onDragLeave={() => canReorderTasks && setDragOverTaskId(null)}
                                        onDrop={() => canReorderTasks && handleTaskDrop(task.id)}
                                        onDragEnd={() => {
                                            setDraggingTaskId(null);
                                            setDragOverTaskId(null);
                                        }}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="font-semibold" style={{ color: 'var(--color-text)' }}>{task.title}</h4>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${task.taskType === 'PAYMENT' ? 'bg-orange-50 text-orange-700' : 'bg-slate-100 text-slate-700'}`}>
                                                        {task.taskType === 'PAYMENT' ? 'Payment' : 'Task'}
                                                    </span>
                                                    {task.taskType !== 'PAYMENT' && (
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${task.status === 'DONE' ? 'bg-emerald-50 text-emerald-700' : task.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-700' : task.status === 'ARCHIVED' ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-700'}`}>{task.status.replace('_', ' ')}</span>
                                                    )}
                                                    {task.isShared && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">Shared</span>}
                                                    {task.pinToDashboard && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">Pinned</span>}
                                                </div>
                                                {task.description && <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>{task.description}</p>}
                                                {sharedOwnerName && <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>Owner: {sharedOwnerName}</p>}
                                            </div>
                                            {canManage && (
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    <button onClick={() => updateTaskMut.mutate({ id: task.id, body: { pinToDashboard: !task.pinToDashboard } })} className={`p-1 ${task.pinToDashboard ? 'text-amber-500' : 'hover:text-amber-500'}`} title="Pin task"><Pin className="w-3.5 h-3.5" /></button>
                                                    <button onClick={() => openEditTask(task)} className="p-1 hover:text-indigo-500" title="Edit task"><Pencil className="w-3.5 h-3.5" /></button>
                                                    <button onClick={() => openDuplicateTask(task)} className="p-1 hover:text-sky-500" title="Duplicate task"><Copy className="w-3.5 h-3.5" /></button>
                                                    <button onClick={() => { if (window.confirm('Delete this task?')) deleteTaskMut.mutate(task.id); }} className="p-1 hover:text-red-500" title="Delete task"><Trash2 className="w-3.5 h-3.5" /></button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-4 space-y-2">
                                            <div className="flex items-center justify-between text-xs">
                                                <span style={{ color: 'var(--color-text-secondary)' }}>Priority</span>
                                                <span className="font-semibold" style={{ color: task.priority === 'URGENT' ? '#dc2626' : task.priority === 'HIGH' ? '#d97706' : 'var(--color-text)' }}>{task.priority}</span>
                                            </div>
                                            {task.taskType === 'PAYMENT' && (
                                                <>
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span style={{ color: 'var(--color-text-secondary)' }}>Amount</span>
                                                        <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                                                            {task.amount != null ? Number(task.amount).toLocaleString('en-US') : '-'} VND
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span style={{ color: 'var(--color-text-secondary)' }}>Category</span>
                                                        <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{task.expenseCategory || '-'}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span style={{ color: 'var(--color-text-secondary)' }}>Scope</span>
                                                        <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                                                            {expenseScopeOptions.find((scope) => scope.value === task.scope)?.label || 'Personal'}
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                            <div className="flex items-center justify-between text-xs">
                                                <span style={{ color: 'var(--color-text-secondary)' }}>Due</span>
                                                <span className="font-semibold" style={{ color: isOverdue ? 'var(--color-danger)' : 'var(--color-text)' }}>
                                                    {dueDate ? format(dueDate, 'MMM d, yyyy · HH:mm') : 'No due date'}
                                                </span>
                                            </div>
                                            {repeatText && (
                                                <div className="flex items-center justify-between text-xs">
                                                    <span style={{ color: 'var(--color-text-secondary)' }}>Repeat</span>
                                                    <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{repeatText}</span>
                                                </div>
                                            )}
                                            {notifText && (
                                                <div className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                                                    <Bell className="w-3 h-3 flex-shrink-0" /> {notifText}
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
                                            <div className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                                                {task.user?.name || 'Task'}{task.completedAt ? ` · Completed ${format(new Date(task.completedAt), 'MMM d')}` : ''}
                                            </div>
                                            {!isDone && !isArchived && canManage ? (
                                                <button className="btn-primary text-xs py-1.5 px-3" onClick={() => completeTaskMut.mutate(task.id)} disabled={completeTaskMut.isPending}>
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark Done
                                                </button>
                                            ) : (
                                                <button className="btn-ghost text-xs py-1.5 px-3" onClick={() => updateTaskMut.mutate({ id: task.id, body: { status: 'PLANNED' } })}>
                                                    Reopen
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}>
                    <div className="card p-6 w-full max-w-md animate-slide-up overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Create New Goal</h3>
                            <button onClick={() => setShowCreate(false)}><X className="w-5 h-5" /></button>
                        </div>
                        <GoalForm form={goalForm} setForm={setGoalForm} onSubmit={(f) => createGoalMut.mutate(f)} loading={createGoalMut.isPending} isEdit={false} />
                    </div>
                </div>
            )}

            {editGoal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditGoal(null); }}>
                    <div className="card p-6 w-full max-w-md animate-slide-up overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Edit Goal</h3>
                            <button onClick={() => setEditGoal(null)}><X className="w-5 h-5" /></button>
                        </div>
                        <GoalForm form={goalForm} setForm={setGoalForm} onSubmit={(f) => updateGoalMut.mutate({ id: editGoal.id, body: f })} loading={updateGoalMut.isPending} isEdit />
                    </div>
                </div>
            )}

            {(showTaskModal || editTask) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) { setShowTaskModal(false); setEditTask(null); } }}>
                    <div className="card p-6 w-full max-w-md animate-slide-up overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{editTask ? 'Edit Task' : 'Add Task'}</h3>
                            <button onClick={() => { setShowTaskModal(false); setEditTask(null); }}><X className="w-5 h-5" /></button>
                        </div>
                        <TaskForm form={taskForm} setForm={setTaskForm} onSubmit={(payload) => {
                            if (editTask) updateTaskMut.mutate({ id: editTask.id, body: payload });
                            else createTaskMut.mutate(payload);
                        }} loading={createTaskMut.isPending || updateTaskMut.isPending} isEdit={!!editTask} />
                    </div>
                </div>
            )}

            {checkInGoalId && selectedGoal && (
                <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 p-4 pb-24 sm:items-center sm:pb-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setCheckInGoalId(null); }}>
                    <div className="card w-full max-w-sm animate-slide-up overflow-y-auto p-6 max-h-[calc(100dvh-2rem)]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Check-in</h3>
                            <button onClick={() => setCheckInGoalId(null)}><X className="w-5 h-5" /></button>
                        </div>
                        <p className="text-sm font-medium mb-4" style={{ color: 'var(--color-primary)' }}>{selectedGoal.title}</p>
                        <form onSubmit={handleCheckInSubmit} className="space-y-4">
                            <div>
                                <label className="label">Check-in Date <span className="text-red-500">*</span></label>
                                <input type="date" className={`input ${dateError ? 'border-red-400 ring-1 ring-red-300' : ''}`} min={minDate} max={today} value={date} onChange={(e) => handleDateChange(e.target.value)} required />
                                {dateError ? (
                                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3 flex-shrink-0" /> {dateError}</p>
                                ) : (
                                    <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>Allowed range: {minDate} → {today}</p>
                                )}
                            </div>
                            {selectedGoal.trackingType === 'BY_FREQUENCY' && (
                                <>
                                    <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100">
                                        <p className="text-xs text-indigo-700 font-semibold">This check-in will add <strong>+1</strong> to your count.</p>
                                        <p className="text-[10px] text-indigo-500 mt-0.5">Current: {selectedGoal.currentCount}/{selectedGoal.targetCount} {selectedGoal.unit}</p>
                                    </div>
                                    <div>
                                        <label className="label">Duration (mins) - optional</label>
                                        <input type="number" min={1} className="input" placeholder="e.g. 60" value={duration} onChange={(e) => setDuration(e.target.value ? parseInt(e.target.value, 10) : '')} />
                                    </div>
                                </>
                            )}
                            {selectedGoal.trackingType === 'BY_QUANTITY' && (
                                <div>
                                    <label className="label">Amount ({selectedGoal.unit}) <span className="text-red-500">*</span></label>
                                    <input type="number" min={1} className="input" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)} required />
                                </div>
                            )}
                            <div>
                                <label className="label">Note</label>
                                <input className="input" placeholder="How did it go?" value={note} onChange={(e) => setNote(e.target.value)} />
                            </div>
                            <button type="submit" className="btn-primary w-full" disabled={checkInMut.isPending || !!dateError}>
                                <Check className="w-4 h-4" />
                                {checkInMut.isPending ? 'Saving...' : 'Record Check-in'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
