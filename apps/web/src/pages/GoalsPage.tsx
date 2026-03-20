import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalStorage } from '../utils/useLocalStorage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import {
    Trophy, Plus, X, Check, Trash2, AlertCircle, Pencil, Copy, Pin,
    LayoutGrid, List, Bell, ClipboardList, CheckCircle2, RefreshCcw, ArrowUp, ArrowDown, Filter, ChevronDown, ChevronUp,
} from 'lucide-react';
import NotificationFields, { buildNotificationPayload, emptyNotification, loadNotificationState } from '../components/NotificationFields';
import { useSearchParams } from 'react-router-dom';
import { addMonths, addWeeks, endOfMonth, endOfWeek, format, isWithinInterval, startOfMonth, startOfToday, startOfWeek } from 'date-fns';
import { useAuthStore } from '../stores/auth';
import { getSharedOwnerName } from '../utils/sharedOwnership';
import { parseCompactAmountInput } from '../utils/amount';
import {
    DEFAULT_TASK_FILTERS,
    getTaskDueDateRange,
    TASK_DUE_DATE_FILTER_OPTIONS,
    TASK_PRIORITY_FILTER_OPTIONS,
    TASK_STATUS_FILTER_OPTIONS,
    TASK_TYPE_FILTER_OPTIONS,
    type SharedTaskDueDateFilter,
    type SharedTaskPriorityFilter,
    type SharedTaskStatusFilter,
    type SharedTaskTypeFilter,
} from '../config/taskFilters';
import { DEFAULT_GOAL_PERIOD_FILTER, GOAL_PERIOD_FILTER_OPTIONS, type SharedGoalPeriodFilter } from '../config/goalFilters';
import { DEFAULT_PAY_CATEGORY, EXPENSE_PAY_CATEGORIES, EXPENSE_SCOPE_OPTIONS } from '../config/expenseFilters';

const unitOptions = [
    { value: 'times', label: 'Time' },
    { value: 'minutes', label: 'Minute' },
] as const;

const expensePayCategories = EXPENSE_PAY_CATEGORIES;
const expenseScopeOptions = EXPENSE_SCOPE_OPTIONS;

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
    expenseCategory: DEFAULT_PAY_CATEGORY,
    scope: 'PERSONAL',
    isShared: false,
    pinToDashboard: false,
    dueDate: '',
    dueTime: '09:00',
    showOnCalendar: false,
    createExpenseAutomatically: false,
    priority: 'MEDIUM',
    status: 'PLANNED',
    repeatFrequency: '',
    repeatEndType: '',
    repeatUntil: '',
    ...emptyNotification,
};

type GoalFormState = typeof goalEmptyForm;
type TaskFormState = typeof taskEmptyForm;
type TaskSortKey = 'title' | 'taskType' | 'status' | 'priority' | 'dueDate' | 'showOnCalendar';
type TaskGridSortOption = 'TITLE_ASC' | 'TITLE_DESC' | 'DUE_ASC' | 'DUE_DESC';
type TaskListSortOption = 'TITLE_ASC' | 'TITLE_DESC' | 'TYPE_ASC' | 'TYPE_DESC' | 'STATUS_ASC' | 'STATUS_DESC' | 'PRIORITY_ASC' | 'PRIORITY_DESC' | 'DUE_ASC' | 'DUE_DESC' | 'CALENDAR_ASC' | 'CALENDAR_DESC';
type TaskDueDateFilter = SharedTaskDueDateFilter;
type TaskTypeFilter = SharedTaskTypeFilter;
type TaskPriorityFilter = SharedTaskPriorityFilter;
type TaskStatusFilter = SharedTaskStatusFilter;

function getTaskDueBadge(task: any) {
    if (!task.dueDate) {
        return { label: 'No due date', tone: 'neutral' as const };
    }

    const dueDate = new Date(task.dueDate);
    const today = startOfToday();
    const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

    if (dueDay < today && task.status !== 'DONE') {
        return { label: `Overdue · ${format(dueDate, 'MMM d, yyyy · HH:mm')}`, tone: 'danger' as const };
    }

    if (dueDay.getTime() === today.getTime()) {
        return { label: `Today · ${format(dueDate, 'HH:mm')}`, tone: 'warning' as const };
    }

    return { label: format(dueDate, 'MMM d, yyyy · HH:mm'), tone: 'neutral' as const };
}

function getTaskStatusLabel(status: string) {
    return status === 'PLANNED' ? 'Plan' : status.replace('_', ' ');
}

function formatNotification(item: any): string | null {
    if (!item.notificationEnabled) return null;
    if (item.reminderOffsetUnit === 'ON_DATE' && item.notificationDate) {
        return format(new Date(item.notificationDate), 'MMM dd, yyyy HH:mm');
    }
    if (item.reminderOffsetUnit === 'HOURS') return `${item.reminderOffsetValue} hour${item.reminderOffsetValue !== 1 ? 's' : ''} before`;
    if (item.reminderOffsetUnit === 'DAYS') return `${item.reminderOffsetValue} day${item.reminderOffsetValue !== 1 ? 's' : ''} before`;
    return null;
}

function formatTaskNotificationBadges(task: any): string[] {
    if (!task.notificationEnabled) return [];
    const time = task.notificationTime || '';
    if (task.reminderOffsetUnit === 'ON_DATE' && task.notificationDate) {
        return [format(new Date(task.notificationDate), 'MMM dd, yyyy'), ...(time ? [time] : [])];
    }
    if (task.reminderOffsetUnit === 'HOURS') {
        const label = `${task.reminderOffsetValue} hour${task.reminderOffsetValue !== 1 ? 's' : ''} before`;
        return [label, ...(time ? [time] : [])];
    }
    if (task.reminderOffsetUnit === 'DAYS') {
        const label = `${task.reminderOffsetValue} day${task.reminderOffsetValue !== 1 ? 's' : ''} before`;
        return [label, ...(time ? [time] : [])];
    }
    return [];
}

function formatTaskRepeat(task: any): string | null {
    if (!task.repeatFrequency) return null;
    const labels: Record<string, string> = {
        DAILY: 'Daily', WEEKLY: 'Weekly', BI_WEEKLY: 'Bi-weekly', MONTHLY: 'Monthly', QUARTERLY: 'Quarterly',
    };
    const repeat = labels[task.repeatFrequency] ?? task.repeatFrequency;
    if (task.repeatEndType === 'ON_DATE' && task.repeatUntil) {
        return `${repeat} until ${format(new Date(task.repeatUntil), 'MMM d, yyyy')}`;
    }
    return repeat;
}

function GoalForm({
    form,
    setForm,
    onSubmit,
    onCancel,
    onDelete,
    loading,
    isEdit,
}: {
    form: GoalFormState;
    setForm: React.Dispatch<React.SetStateAction<GoalFormState>>;
    onSubmit: (f: any) => void;
    onCancel: () => void;
    onDelete?: () => void;
    loading: boolean;
    isEdit: boolean;
}) {
    const [optionsOpen, setOptionsOpen] = useState(false);
    return (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form, ...buildNotificationPayload(form) }); }} className="space-y-4">
            <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">Goal Title <span className="text-red-500">*</span></label>
                    <button
                        type="button"
                        title={form.pinToDashboard ? 'Unpin from dashboard' : 'Pin to dashboard'}
                        onClick={() => setForm({ ...form, pinToDashboard: !form.pinToDashboard })}
                        className={`p-1.5 rounded-lg border transition-colors ${form.pinToDashboard ? 'text-amber-500 border-amber-300 bg-amber-50' : 'border-gray-200 hover:border-amber-300 hover:text-amber-400'}`}
                        style={form.pinToDashboard ? {} : { color: 'var(--color-text-secondary)' }}
                    >
                        <Pin className="w-3.5 h-3.5" />
                    </button>
                </div>
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
            <div className="rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                <button
                    type="button"
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium"
                    style={{ color: 'var(--color-text)' }}
                    onClick={() => setOptionsOpen((o) => !o)}
                >
                    <span>Options</span>
                    {optionsOpen ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />}
                </button>
                {optionsOpen && (
                    <div className="border-t px-3 pb-3 pt-2 space-y-2" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-start gap-2 p-3 rounded-lg border cursor-pointer" style={{ borderColor: form.isShared ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: form.isShared ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : 'transparent' }} onClick={() => setForm({ ...form, isShared: !form.isShared })}>
                            <input type="checkbox" checked={form.isShared} onChange={(e) => setForm({ ...form, isShared: e.target.checked })} onClick={(e) => e.stopPropagation()} className="mt-0.5" />
                            <div><p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Share with all users</p><p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Makes this item visible to all family members</p></div>
                        </div>
                        <NotificationFields form={form} setForm={setForm} />
                    </div>
                )}
            </div>
            <div className="flex items-center justify-between gap-3 pt-2">
                <div>
                    {isEdit && onDelete && (
                        <button type="button" className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white" onClick={onDelete}>
                            Delete
                        </button>
                    )}
                </div>
                <div className="flex gap-2 ml-auto">
                    <button type="button" className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50" onClick={onCancel}>
                        Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Saving...' : (isEdit ? 'Save' : 'Create Goal')}
                    </button>
                </div>
            </div>
        </form>
    );
}

function TaskForm({
    form,
    setForm,
    onSubmit,
    onCancel,
    onDelete,
    loading,
    isEdit,
}: {
    form: TaskFormState;
    setForm: React.Dispatch<React.SetStateAction<TaskFormState>>;
    onSubmit: (f: any) => void;
    onCancel: () => void;
    onDelete?: () => void;
    loading: boolean;
    isEdit: boolean;
}) {
    const [optionsOpen, setOptionsOpen] = useState(false);
    return (
        <form onSubmit={(e) => {
            e.preventDefault();
            const payload: any = {
                title: form.title,
                description: form.description,
                taskType: form.taskType,
                amount: form.amount ? parseCompactAmountInput(form.amount) : null,
                expenseCategory: form.expenseCategory || null,
                scope: form.scope || 'PERSONAL',
                isShared: form.isShared,
                pinToDashboard: form.pinToDashboard,
                showOnCalendar: !!form.showOnCalendar && !!form.dueDate,
                createExpenseAutomatically: form.createExpenseAutomatically,
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
                <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">Task Title <span className="text-red-500">*</span></label>
                    <button
                        type="button"
                        title={form.pinToDashboard ? 'Unpin from dashboard' : 'Pin to dashboard'}
                        onClick={() => setForm({ ...form, pinToDashboard: !form.pinToDashboard })}
                        className={`p-1.5 rounded-lg border transition-colors ${form.pinToDashboard ? 'text-amber-500 border-amber-300 bg-amber-50' : 'border-gray-200 hover:border-amber-300 hover:text-amber-400'}`}
                        style={form.pinToDashboard ? {} : { color: 'var(--color-text-secondary)' }}
                    >
                        <Pin className="w-3.5 h-3.5" />
                    </button>
                </div>
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Pay electricity bill" />
            </div>
            <div>
                <label className="label">Description</label>
                <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional notes" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                    <label className="label">Type</label>
                    <select className="input" value={form.taskType} onChange={(e) => setForm({ ...form, taskType: e.target.value })}>
                        <option value="TASK">Task</option>
                        <option value="PAYMENT">Payment</option>
                    </select>
                </div>
                <div>
                    <label className="label">
                        {form.taskType === 'PAYMENT' ? <>Amount <span className="text-red-500">*</span></> : 'Cost'}
                    </label>
                    <input
                        className="input"
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                        placeholder="e.g. 600k or 2M"
                        required={form.taskType === 'PAYMENT'}
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                    <label className="label">Category{form.taskType === 'PAYMENT' && <span className="text-red-500"> *</span>}</label>
                    <select className="input" value={form.expenseCategory} onChange={(e) => setForm({ ...form, expenseCategory: e.target.value })} required={form.taskType === 'PAYMENT'}>
                        {expensePayCategories.map((category: string) => (
                            <option key={category} value={category}>{category}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="label">Scope{form.taskType === 'PAYMENT' && <span className="text-red-500"> *</span>}</label>
                    <select className="input" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} required={form.taskType === 'PAYMENT'}>
                        {expenseScopeOptions.map((scope: { value: string; label: string }) => (
                            <option key={scope.value} value={scope.value}>{scope.label}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="label">Due Date</label>
                    <input
                        type="date"
                        className="input"
                        value={form.dueDate}
                        onChange={(e) => setForm({ ...form, dueDate: e.target.value, showOnCalendar: e.target.value ? form.showOnCalendar : false })}
                    />
                </div>
                <div>
                    <label className="label">Due Time</label>
                    <input type="time" className="input" value={form.dueTime} disabled={!form.dueDate} onChange={(e) => setForm({ ...form, dueTime: e.target.value })} />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="label">Priority</label>
                    <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                    </select>
                </div>
                <div>
                    <label className="label">Status</label>
                    <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                        <option value="PLANNED">Plan</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="DONE">Done</option>
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="label">Repeat</label>
                    <select className="input" value={form.repeatFrequency} onChange={(e) => setForm({ ...form, repeatFrequency: e.target.value, repeatEndType: e.target.value ? (form.repeatEndType || 'NEVER') : '', repeatUntil: e.target.value ? form.repeatUntil : '' })}>
                        <option value="">Does not repeat</option>
                        <option value="DAILY">Daily</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="BI_WEEKLY">Bi-weekly (every 2 weeks)</option>
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
            <div className="rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                <button
                    type="button"
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium"
                    style={{ color: 'var(--color-text)' }}
                    onClick={() => setOptionsOpen((o) => !o)}
                >
                    <span>Options</span>
                    {optionsOpen ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />}
                </button>
                {optionsOpen && (
                    <div className="border-t px-3 pb-3 pt-2 space-y-2" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-start gap-2 p-3 rounded-lg border" style={{ borderColor: form.showOnCalendar ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: form.showOnCalendar ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : 'transparent', opacity: !form.dueDate ? 0.5 : 1 }}>
                            <input type="checkbox" id="taskShowOnCalendar" checked={form.showOnCalendar} disabled={!form.dueDate} onChange={(e) => setForm({ ...form, showOnCalendar: e.target.checked })} className="rounded mt-0.5" />
                            <div>
                                <label htmlFor="taskShowOnCalendar" className="text-sm font-medium cursor-pointer" style={{ color: 'var(--color-text)' }}>Add to Calendar</label>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{form.dueDate ? 'Creates a calendar event on the due date' : 'Requires a due date'}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2 p-3 rounded-lg border cursor-pointer" style={{ borderColor: form.isShared ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: form.isShared ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : 'transparent' }} onClick={() => setForm({ ...form, isShared: !form.isShared })}>
                            <input type="checkbox" checked={form.isShared} onChange={(e) => setForm({ ...form, isShared: e.target.checked })} onClick={(e) => e.stopPropagation()} className="mt-0.5" />
                            <div><p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Share with all users</p><p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Makes this item visible to all family members</p></div>
                        </div>
                        <div className="flex items-start gap-2 p-3 rounded-lg border" style={{ borderColor: form.createExpenseAutomatically ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: form.createExpenseAutomatically ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : 'transparent' }}>
                            <input type="checkbox" id="taskCreateExpense" checked={form.createExpenseAutomatically} onChange={(e) => setForm({ ...form, createExpenseAutomatically: e.target.checked })} className="rounded mt-0.5" />
                            <div>
                                <label htmlFor="taskCreateExpense" className="text-sm font-medium cursor-pointer" style={{ color: 'var(--color-text)' }}>Add expense</label>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>Automatically creates an expense entry when the task is completed</p>
                            </div>
                        </div>
                        <NotificationFields form={form} setForm={setForm} />
                    </div>
                )}
            </div>
            <div className="flex items-center justify-between gap-3 pt-2">
                <div>
                    {isEdit && onDelete && (
                        <button type="button" className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white" onClick={onDelete}>
                            Delete
                        </button>
                    )}
                </div>
                <div className="flex gap-2 ml-auto">
                    <button type="button" className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50" onClick={onCancel}>
                        Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Saving...' : (isEdit ? 'Save' : 'Create Task')}
                    </button>
                </div>
            </div>
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
    const [quantity, setQuantity] = useState<number | ''>('');
    const processedUrlParams = useRef({ editId: null as string | null, checkInId: null as string | null });
    const [periodFilter, setPeriodFilter] = useLocalStorage<SharedGoalPeriodFilter>('ngocky:goals:periodFilter', DEFAULT_GOAL_PERIOD_FILTER);
    const [goalSearch, setGoalSearch] = useState('');
    const [goalTrackingFilter, setGoalTrackingFilter] = useLocalStorage<'ALL' | 'BY_FREQUENCY' | 'BY_QUANTITY'>('ngocky:goals:trackingFilter', 'ALL');
    const [goalSortKey, setGoalSortKey] = useState<'title' | 'periodType' | 'trackingType' | 'progress'>('title');
    const [goalSortDir, setGoalSortDir] = useState<'asc' | 'desc'>('asc');
    const [taskFilters, setTaskFilters] = useLocalStorage<{
        dueDate: TaskDueDateFilter;
        type: TaskTypeFilter;
        priority: TaskPriorityFilter;
        status: TaskStatusFilter;
    }>('ngocky:tasks:filters', { ...DEFAULT_TASK_FILTERS });
    const [taskSearch, setTaskSearch] = useState('');
    const [viewMode, setViewMode] = useLocalStorage<'grid' | 'list'>('ngocky:goals:viewMode', 'grid');
    const [taskViewMode, setTaskViewMode] = useLocalStorage<'grid' | 'list'>('ngocky:tasks:viewMode', 'list');
    const [taskSortBy, setTaskSortBy] = useLocalStorage<TaskSortKey>('ngocky:tasks:sortBy', 'dueDate');
    const [taskSortOrder, setTaskSortOrder] = useLocalStorage<'asc' | 'desc'>('ngocky:tasks:sortOrder', 'asc');
    const [taskGridSort, setTaskGridSort] = useState<TaskGridSortOption>('DUE_ASC');
    const [showCompletedTasks, setShowCompletedTasks] = useLocalStorage<boolean>('ngocky:tasks:showCompleted', false);
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
            setQuantity('');
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
            setShowTaskModal(false);
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

    const goals = goalsData || [];
    const tasks = tasksData || [];
    const selectedGoal = goals.find((g: any) => g.id === checkInGoalId);

    const filteredGoals = useMemo(() => {
        const q = goalSearch.trim().toLowerCase();
        return goals.filter((goal: any) => {
            if (periodFilter !== 'ALL' && goal.periodType !== periodFilter) return false;
            if (goalTrackingFilter !== 'ALL' && goal.trackingType !== goalTrackingFilter) return false;
            if (q) {
                const haystack = [goal.title, goal.description].filter(Boolean).join(' ').toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            return true;
        });
    }, [goals, periodFilter, goalSearch, goalTrackingFilter]);

    const sortedGoals = useMemo(() => {
        return [...filteredGoals].sort((a, b) => {
            let left: any;
            let right: any;
            switch (goalSortKey) {
                case 'title': left = a.title?.toLowerCase() || ''; right = b.title?.toLowerCase() || ''; break;
                case 'periodType': left = a.periodType || ''; right = b.periodType || ''; break;
                case 'trackingType': left = a.trackingType || ''; right = b.trackingType || ''; break;
                case 'progress':
                    left = a.targetCount > 0 ? a.currentCount / a.targetCount : 0;
                    right = b.targetCount > 0 ? b.currentCount / b.targetCount : 0;
                    break;
                default: left = ''; right = '';
            }
            const result = typeof left === 'number' && typeof right === 'number'
                ? left - right
                : String(left).localeCompare(String(right));
            return goalSortDir === 'asc' ? result : -result;
        });
    }, [filteredGoals, goalSortKey, goalSortDir]);

    function toggleGoalSort(key: typeof goalSortKey) {
        if (goalSortKey === key) { setGoalSortDir(d => d === 'asc' ? 'desc' : 'asc'); return; }
        setGoalSortKey(key);
        setGoalSortDir('asc');
    }

    const filteredTasks = useMemo(() => {
        const q = taskSearch.trim().toLowerCase();
        return tasks.filter((task: any) => {
            if (!showCompletedTasks && (task.status === 'DONE' || task.status === 'ARCHIVED')) return false;
            if (taskFilters.type !== 'ALL' && task.taskType !== taskFilters.type) return false;
            if (taskFilters.priority !== 'ALL' && task.priority !== taskFilters.priority) return false;
            if (taskFilters.status !== 'ALL' && task.status !== taskFilters.status) return false;

            const dueRange = getTaskDueDateRange(taskFilters.dueDate);
            if (dueRange) {
                if (!task.dueDate) return false;
                if (!isWithinInterval(new Date(task.dueDate), dueRange)) return false;
            }

            if (q) {
                const haystack = [
                    task.title, task.description, task.taskType, task.status,
                    task.priority, task.expenseCategory, task.notes,
                    task.user?.name,
                ].filter(Boolean).join(' ').toLowerCase();
                if (!haystack.includes(q)) return false;
            }

            return true;
        });
    }, [tasks, taskFilters, taskSearch]);

    const sortedTasks = useMemo(() => {
        const getValue = (task: any, key: TaskSortKey) => {
            switch (key) {
                case 'title':
                    return task.title?.toLowerCase() || '';
                case 'taskType':
                    return task.taskType || '';
                case 'status':
                    return task.status || '';
                case 'priority': {
                    const priorityWeights: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, URGENT: 3 };
                    return priorityWeights[task.priority || 'MEDIUM'] ?? 1;
                }
                case 'dueDate':
                    return task.dueDate ? new Date(task.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
                case 'showOnCalendar':
                    return task.showOnCalendar ? 1 : 0;
                default:
                    return '';
            }
        };

        return [...filteredTasks].sort((a, b) => {
            const left = getValue(a, taskSortBy);
            const right = getValue(b, taskSortBy);
            const result = typeof left === 'number' && typeof right === 'number'
                ? left - right
                : String(left).localeCompare(String(right));
            return taskSortOrder === 'asc' ? result : -result;
        });
    }, [filteredTasks, taskSortBy, taskSortOrder]);

    const gridSortedTasks = useMemo(() => {
        return [...filteredTasks].sort((a, b) => {
            if (taskGridSort === 'TITLE_ASC' || taskGridSort === 'TITLE_DESC') {
                const result = (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
                return taskGridSort === 'TITLE_ASC' ? result : -result;
            }

            const left = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
            const right = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
            const result = left - right;
            return taskGridSort === 'DUE_ASC' ? result : -result;
        });
    }, [filteredTasks, taskGridSort]);

    const today = new Date().toISOString().split('T')[0];
    const minDateObj = new Date();
    minDateObj.setDate(minDateObj.getDate() - 45);
    const minDate = minDateObj.toISOString().split('T')[0];

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
            expenseCategory: task.expenseCategory || DEFAULT_PAY_CATEGORY,
            scope: task.scope || 'PERSONAL',
            isShared: !!task.isShared,
            pinToDashboard: !!task.pinToDashboard,
            dueDate: task.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : '',
            dueTime: task.dueDate ? format(new Date(task.dueDate), 'HH:mm') : '09:00',
            showOnCalendar: !!task.showOnCalendar,
            createExpenseAutomatically: task.createExpenseAutomatically !== false,
            priority: task.priority || 'MEDIUM',
            status: task.status === 'ARCHIVED' ? 'PLANNED' : task.status || 'PLANNED',
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
            expenseCategory: task.expenseCategory || DEFAULT_PAY_CATEGORY,
            scope: task.scope || 'PERSONAL',
            isShared: !!task.isShared,
            pinToDashboard: !!task.pinToDashboard,
            dueDate: task.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : '',
            dueTime: task.dueDate ? format(new Date(task.dueDate), 'HH:mm') : '09:00',
            showOnCalendar: !!task.showOnCalendar,
            createExpenseAutomatically: task.createExpenseAutomatically !== false,
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
        setQuantity('');
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
        if (selectedGoal?.trackingType === 'BY_QUANTITY' && (quantity === '' || Number(quantity) < 1)) {
            alert('Amount must be at least 1.');
            return;
        }
        const payload: any = {
            goalId: checkInGoalId,
            quantity: selectedGoal?.trackingType === 'BY_QUANTITY' ? Number(quantity) : 1,
            date,
        };
        const noteText = [
            selectedGoal?.trackingType === 'BY_FREQUENCY' && duration ? `Duration: ${duration} mins` : '',
            note,
        ].filter(Boolean).join(' | ');
        if (noteText) payload.note = noteText;
        checkInMut.mutate(payload);
    };

    function toggleTaskSort(column: TaskSortKey) {
        if (taskSortBy === column) {
            setTaskSortOrder(taskSortOrder === 'asc' ? 'desc' : 'asc');
            return;
        }

        setTaskSortBy(column);
        setTaskSortOrder(column === 'dueDate' ? 'asc' : 'desc');
    }

    function renderTaskSortIcon(column: TaskSortKey) {
        if (taskSortBy !== column) return <ArrowUp className="w-3.5 h-3.5 opacity-30" />;
        return taskSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />;
    }

    function getTaskListSortValue(): TaskListSortOption {
        if (taskSortBy === 'title') return taskSortOrder === 'asc' ? 'TITLE_ASC' : 'TITLE_DESC';
        if (taskSortBy === 'taskType') return taskSortOrder === 'asc' ? 'TYPE_ASC' : 'TYPE_DESC';
        if (taskSortBy === 'status') return taskSortOrder === 'asc' ? 'STATUS_ASC' : 'STATUS_DESC';
        if (taskSortBy === 'priority') return taskSortOrder === 'asc' ? 'PRIORITY_ASC' : 'PRIORITY_DESC';
        if (taskSortBy === 'showOnCalendar') return taskSortOrder === 'asc' ? 'CALENDAR_ASC' : 'CALENDAR_DESC';
        return taskSortOrder === 'asc' ? 'DUE_ASC' : 'DUE_DESC';
    }

    function handleTaskListSortChange(value: TaskListSortOption) {
        switch (value) {
            case 'TITLE_ASC':
                setTaskSortBy('title');
                setTaskSortOrder('asc');
                break;
            case 'TITLE_DESC':
                setTaskSortBy('title');
                setTaskSortOrder('desc');
                break;
            case 'TYPE_ASC':
                setTaskSortBy('taskType');
                setTaskSortOrder('asc');
                break;
            case 'TYPE_DESC':
                setTaskSortBy('taskType');
                setTaskSortOrder('desc');
                break;
            case 'STATUS_ASC':
                setTaskSortBy('status');
                setTaskSortOrder('asc');
                break;
            case 'STATUS_DESC':
                setTaskSortBy('status');
                setTaskSortOrder('desc');
                break;
            case 'PRIORITY_ASC':
                setTaskSortBy('priority');
                setTaskSortOrder('asc');
                break;
            case 'PRIORITY_DESC':
                setTaskSortBy('priority');
                setTaskSortOrder('desc');
                break;
            case 'CALENDAR_ASC':
                setTaskSortBy('showOnCalendar');
                setTaskSortOrder('asc');
                break;
            case 'CALENDAR_DESC':
                setTaskSortBy('showOnCalendar');
                setTaskSortOrder('desc');
                break;
            case 'DUE_DESC':
                setTaskSortBy('dueDate');
                setTaskSortOrder('desc');
                break;
            case 'DUE_ASC':
            default:
                setTaskSortBy('dueDate');
                setTaskSortOrder('asc');
                break;
        }
    }

    useEffect(() => {
        if (!goals.length) return;
        if (editIdParam && activeTab === 'GOALS' && processedUrlParams.current.editId !== editIdParam) {
            const goal = goals.find((g: any) => g.id === editIdParam);
            if (goal) { processedUrlParams.current.editId = editIdParam; openEditGoal(goal); }
        }
        if (checkInIdParam && activeTab === 'GOALS' && processedUrlParams.current.checkInId !== checkInIdParam) {
            const goal = goals.find((g: any) => g.id === checkInIdParam);
            if (goal) { processedUrlParams.current.checkInId = checkInIdParam; openCheckIn(goal.id); }
        }
    }, [goals, editIdParam, checkInIdParam, activeTab]);

    useEffect(() => {
        if (!editIdParam) processedUrlParams.current.editId = null;
        if (!checkInIdParam) processedUrlParams.current.checkInId = null;
    }, [editIdParam, checkInIdParam]);

    useEffect(() => {
        if (!tasks.length) return;
        if (editIdParam && activeTab === 'TASKS' && processedUrlParams.current.editId !== editIdParam) {
            const task = tasks.find((entry: any) => entry.id === editIdParam);
            if (task) { processedUrlParams.current.editId = editIdParam; openEditTask(task); }
        }
    }, [tasks, editIdParam, activeTab]);

    useEffect(() => {
        if (forcedTab) return;
        const requestedTab = (searchParams.get('tab') || '').toUpperCase();
        const nextTab = requestedTab === 'TASKS' ? 'TASKS' : requestedTab === 'GOALS' ? 'GOALS' : null;
        if (nextTab && nextTab !== activeTab) {
            setActiveTab(nextTab);
        }
    }, [forcedTab, searchParams, activeTab]);

    useEffect(() => {
        if (forcedTab) return;
        const next = new URLSearchParams(searchParams);
        next.set('tab', activeTab === 'TASKS' ? 'tasks' : 'goals');
        setSearchParams(next, { replace: true });
    }, [activeTab, forcedTab, searchParams, setSearchParams]);

    useEffect(() => {
        if (goalsLoading) return;
        if (!editGoal && !checkInGoalId && !showCreate && (editIdParam || checkInIdParam) && activeTab === 'GOALS') {
            const hasRequestedGoal = (editIdParam && goals.some((goal: any) => goal.id === editIdParam))
                || (checkInIdParam && goals.some((goal: any) => goal.id === checkInIdParam));
            if (hasRequestedGoal) return;
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete('editId');
                next.delete('checkInId');
                return next;
            }, { replace: true });
        }
    }, [editGoal, checkInGoalId, showCreate, editIdParam, checkInIdParam, setSearchParams, activeTab, goalsLoading, goals]);

    useEffect(() => {
        if (tasksLoading) return;
        if (!editTask && !showTaskModal && editIdParam && activeTab === 'TASKS') {
            const hasRequestedTask = tasks.some((task: any) => task.id === editIdParam);
            if (hasRequestedTask) return;
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete('editId');
                return next;
            }, { replace: true });
        }
    }, [editTask, showTaskModal, editIdParam, setSearchParams, activeTab, tasksLoading, tasks]);

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Trophy className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{activeTab === 'GOALS' ? 'Goals' : 'Tasks'}</h2>
                </div>
                <div className="flex items-center gap-3 flex-wrap self-start sm:self-auto sm:justify-end">
                    {activeTab === 'TASKS' && (
                        <>
                            <button
                                onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${showCompletedTasks ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'border-gray-200 text-gray-500 hover:text-gray-700'}`}
                            >
                                {showCompletedTasks ? 'Hide Completed' : 'Show Completed'}
                            </button>
                            <div className="flex items-center rounded-lg border p-1 gap-1" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                                <button onClick={() => setTaskViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${taskViewMode === 'grid' ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`} title="Grid view"><LayoutGrid className="w-4 h-4" /></button>
                                <button onClick={() => setTaskViewMode('list')} className={`p-1.5 rounded-md transition-colors ${taskViewMode === 'list' ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`} title="List view"><List className="w-4 h-4" /></button>
                            </div>
                            <button className="btn-primary whitespace-nowrap" onClick={openCreateTask}>
                                <Plus className="w-4 h-4" /> Add Task
                            </button>
                        </>
                    )}
                    {showTabSwitcher && (
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'GOALS' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('GOALS')} style={activeTab === 'GOALS' ? { color: 'var(--color-primary)' } : {}}>Goals</button>
                            <button className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'TASKS' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('TASKS')} style={activeTab === 'TASKS' ? { color: 'var(--color-primary)' } : {}}>Tasks</button>
                        </div>
                    )}
                </div>
            </div>

            {activeTab === 'GOALS' ? (
                <>
                    <div className="card p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Filters</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center rounded-lg border p-1 gap-1" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                                    <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`} title="Grid view"><LayoutGrid className="w-4 h-4" /></button>
                                    <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`} title="List view"><List className="w-4 h-4" /></button>
                                </div>
                                <button className="btn-primary whitespace-nowrap" onClick={() => { setGoalForm({ ...goalEmptyForm }); setShowCreate(true); }}>
                                    <Plus className="w-4 h-4" /> New Goal
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <input className="input text-sm" placeholder="Search goals..." value={goalSearch} onChange={(e) => setGoalSearch(e.target.value)} />
                            <select className="input text-sm" value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value as SharedGoalPeriodFilter)}>
                                {GOAL_PERIOD_FILTER_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            <select className="input text-sm" value={goalTrackingFilter} onChange={(e) => setGoalTrackingFilter(e.target.value as any)}>
                                <option value="ALL">All Tracking Types</option>
                                <option value="BY_FREQUENCY">Count-based</option>
                                <option value="BY_QUANTITY">Amount-based</option>
                            </select>
                        </div>
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
                            {sortedGoals.map((goal: any) => {
                                const sharedOwnerName = getSharedOwnerName(goal, user?.id);
                                const progressPct = goal.targetCount > 0 ? (goal.currentCount / goal.targetCount) * 100 : 0;
                                const barPct = Math.min(100, progressPct);
                                const completed = goal.currentCount >= goal.targetCount;
                                const overachieved = progressPct > 100;
                                return (
                                    <div
                                        key={goal.id}
                                        className="card p-5 animate-slide-up transition-shadow hover:shadow-lg"
                                        onClick={() => openEditGoal(goal)}
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
                                                    <button
                                                        type="button"
                                                        className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${goal.active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-200 text-gray-500'}`}
                                                        onClick={(e) => { e.stopPropagation(); updateGoalMut.mutate({ id: goal.id, body: { active: !goal.active } }); }}
                                                    >
                                                        {goal.active ? 'ENABLED' : 'DISABLED'}
                                                    </button>
                                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100" style={{ color: 'var(--color-text-secondary)' }}>{goal.trackingType === 'BY_FREQUENCY' ? 'Count-based' : 'Amount-based'}</span>
                                                    <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>{goal.periodType}</span>
                                                </div>
                                                {sharedOwnerName && (
                                                    <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>Owner: {sharedOwnerName}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                <button onClick={(e) => { e.stopPropagation(); updateGoalMut.mutate({ id: goal.id, body: { pinToDashboard: !goal.pinToDashboard } }); }} className={`p-1 transition-colors ${goal.pinToDashboard ? 'text-amber-500 hover:text-amber-600' : 'text-gray-300 hover:text-amber-400'}`} title="Pin goal"><Pin className="w-3.5 h-3.5" /></button>
                                                <button onClick={(e) => { e.stopPropagation(); openEditGoal(goal); }} className="p-1 text-gray-400 hover:text-gray-600 transition-colors" title="Edit goal"><Pencil className="w-3.5 h-3.5" /></button>
                                                <button onClick={(e) => { e.stopPropagation(); openDuplicateGoal(goal); }} className="p-1 text-blue-500 hover:text-blue-600 transition-colors" title="Duplicate goal"><Copy className="w-3.5 h-3.5" /></button>
                                                <button onClick={(e) => { e.stopPropagation(); if (window.confirm('Recalculate count from actual check-in history?')) resetMut.mutate(goal.id); }} className="p-1 hover:text-blue-500 transition-colors" title="Fix/recalculate count" disabled={resetMut.isPending}><span className="text-xs leading-none">🔄</span></button>
                                                <button onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete this goal and ALL its check-ins? This cannot be undone.')) deleteGoalMut.mutate(goal.id); }} className="p-1 text-red-500 hover:text-red-600 transition-colors" title="Delete goal"><Trash2 className="w-3.5 h-3.5" /></button>
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
                                                <button className="btn-primary text-xs py-1.5 px-3" onClick={(e) => { e.stopPropagation(); openCheckIn(goal.id); }} disabled={!goal.active}><Check className="w-3 h-3" /> Check-in</button>
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
                        <div className="card overflow-hidden">
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>
                                                <button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleGoalSort('title')}>
                                                    Title {goalSortKey === 'title' ? (goalSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />) : <ArrowUp className="w-3.5 h-3.5 opacity-30" />}
                                                </button>
                                            </th>
                                            <th>
                                                <button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleGoalSort('periodType')}>
                                                    Reset Period {goalSortKey === 'periodType' ? (goalSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />) : <ArrowUp className="w-3.5 h-3.5 opacity-30" />}
                                                </button>
                                            </th>
                                            <th>
                                                <button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleGoalSort('trackingType')}>
                                                    Track By {goalSortKey === 'trackingType' ? (goalSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />) : <ArrowUp className="w-3.5 h-3.5 opacity-30" />}
                                                </button>
                                            </th>
                                            <th>
                                                <button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleGoalSort('progress')}>
                                                    Progress {goalSortKey === 'progress' ? (goalSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />) : <ArrowUp className="w-3.5 h-3.5 opacity-30" />}
                                                </button>
                                            </th>
                                            <th>Alert</th>
                                            <th className="text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedGoals.map((goal: any) => {
                                            const sharedOwnerName = getSharedOwnerName(goal, user?.id);
                                            const progressPct = goal.targetCount > 0 ? (goal.currentCount / goal.targetCount) * 100 : 0;
                                            const barPct = Math.min(100, progressPct);
                                            const completed = goal.currentCount >= goal.targetCount;
                                            const overachieved = progressPct > 100;
                                            const notifText = formatNotification(goal);
                                            return (
                                                <tr key={goal.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openEditGoal(goal)}>
                                                    <td className="px-3 py-2.5">
                                                        <div className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{goal.title}</div>
                                                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                                                            <button
                                                                type="button"
                                                                className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${goal.active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-200 text-gray-500'}`}
                                                                onClick={(e) => { e.stopPropagation(); updateGoalMut.mutate({ id: goal.id, body: { active: !goal.active } }); }}
                                                            >
                                                                {goal.active ? 'ENABLED' : 'DISABLED'}
                                                            </button>
                                                            {goal.isShared && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">Shared</span>}
                                                            {sharedOwnerName && <span className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>Owner: {sharedOwnerName}</span>}
                                                        </div>
                                                        {goal.description && <p className="text-xs mt-0.5 truncate max-w-xs" style={{ color: 'var(--color-text-secondary)' }}>{goal.description}</p>}
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 font-medium capitalize" style={{ color: 'var(--color-text-secondary)' }}>
                                                            {goal.periodType.charAt(0) + goal.periodType.slice(1).toLowerCase()}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">
                                                            {goal.trackingType === 'BY_FREQUENCY' ? 'Count-based' : 'Amount-based'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex items-center gap-2 min-w-[160px]">
                                                            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                                                <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${barPct}%`, background: overachieved ? 'linear-gradient(90deg, #059669, #34d399)' : completed ? 'linear-gradient(90deg, #059669, #10b981)' : 'linear-gradient(90deg, #4f46e5, #7c3aed)' }} />
                                                            </div>
                                                            <span className="text-xs whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>{goal.currentCount}/{goal.targetCount} {goal.unit}</span>
                                                            <span className="text-xs font-semibold whitespace-nowrap" style={{ color: overachieved ? '#7c3aed' : completed ? '#059669' : 'var(--color-primary)' }}>{Math.round(progressPct)}%</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        {notifText ? (
                                                            <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                                                                <Bell className="w-3 h-3 text-red-500 flex-shrink-0" />{notifText}
                                                            </span>
                                                        ) : (
                                                            <Bell className="w-3 h-3 text-gray-300" />
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex items-center gap-1 justify-end">
                                                            <button onClick={(e) => { e.stopPropagation(); openCheckIn(goal.id); }} disabled={!goal.active} className="p-1 text-green-600 hover:text-green-700 disabled:opacity-30" title="Check-in"><Check className="w-3.5 h-3.5" /></button>
                                                            <button onClick={(e) => { e.stopPropagation(); updateGoalMut.mutate({ id: goal.id, body: { pinToDashboard: !goal.pinToDashboard } }); }} className={`p-1 ${goal.pinToDashboard ? 'text-amber-500 hover:text-amber-600' : 'text-gray-300 hover:text-amber-400'}`} title="Pin"><Pin className="w-3.5 h-3.5" /></button>
                                                            <button onClick={(e) => { e.stopPropagation(); openEditGoal(goal); }} className="p-1 text-gray-400 hover:text-gray-600" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                                            <button onClick={(e) => { e.stopPropagation(); openDuplicateGoal(goal); }} className="p-1 text-blue-500 hover:text-blue-600" title="Duplicate"><Copy className="w-3.5 h-3.5" /></button>
                                                            <button onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete this goal and ALL its check-ins? This cannot be undone.')) deleteGoalMut.mutate(goal.id); }} className="p-1 text-red-500 hover:text-red-600" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <>
                    <div className="card p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Filter className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                            <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Filters</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
                            <input className="input text-sm" placeholder="Search tasks..." value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} />
                            <select className="input text-sm min-w-[180px]" value={taskFilters.type} onChange={(e) => setTaskFilters((current) => ({ ...current, type: e.target.value as TaskTypeFilter }))}>
                                {TASK_TYPE_FILTER_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            <select className="input text-sm min-w-[180px]" value={taskFilters.status} onChange={(e) => setTaskFilters((current) => ({ ...current, status: e.target.value as TaskStatusFilter }))}>
                                {TASK_STATUS_FILTER_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            <select className="input text-sm min-w-[180px]" value={taskFilters.priority} onChange={(e) => setTaskFilters((current) => ({ ...current, priority: e.target.value as TaskPriorityFilter }))}>
                                {TASK_PRIORITY_FILTER_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            <select className="input text-sm min-w-[180px]" value={taskFilters.dueDate} onChange={(e) => setTaskFilters((current) => ({ ...current, dueDate: e.target.value as TaskDueDateFilter }))}>
                                {TASK_DUE_DATE_FILTER_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {tasksLoading ? (
                        <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="card p-5 h-28 animate-pulse bg-gray-100" />)}</div>
                    ) : sortedTasks.length === 0 ? (
                        <div className="card p-12 flex flex-col items-center border-dashed border-2">
                            <ClipboardList className="w-12 h-12 mb-4 opacity-10" />
                            <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text-secondary)' }}>No tasks yet</h3>
                            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Create standalone tasks here without putting them into project boards.</p>
                        </div>
                    ) : taskViewMode === 'list' ? (
                        <div className="card overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                                        <th className="px-4 py-2.5 font-semibold text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                            <button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleTaskSort('title')}>
                                                Title {renderTaskSortIcon('title')}
                                            </button>
                                        </th>
                                        <th className="px-3 py-2.5 font-semibold text-xs hidden sm:table-cell" style={{ color: 'var(--color-text-secondary)' }}>
                                            Description
                                        </th>
                                        <th className="px-3 py-2.5 font-semibold text-xs hidden sm:table-cell" style={{ color: 'var(--color-text-secondary)' }}>
                                            <button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleTaskSort('taskType')}>
                                                Type {renderTaskSortIcon('taskType')}
                                            </button>
                                        </th>
                                        <th className="px-3 py-2.5 font-semibold text-xs hidden sm:table-cell" style={{ color: 'var(--color-text-secondary)' }}>
                                            <button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleTaskSort('status')}>
                                                Status {renderTaskSortIcon('status')}
                                            </button>
                                        </th>
                                        <th className="px-3 py-2.5 font-semibold text-xs hidden md:table-cell" style={{ color: 'var(--color-text-secondary)' }}>
                                            <button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleTaskSort('priority')}>
                                                Priority {renderTaskSortIcon('priority')}
                                            </button>
                                        </th>
                                        <th className="px-3 py-2.5 font-semibold text-xs hidden lg:table-cell" style={{ color: 'var(--color-text-secondary)' }}>
                                            <button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleTaskSort('dueDate')}>
                                                Due Date {renderTaskSortIcon('dueDate')}
                                            </button>
                                        </th>
                                        <th className="px-3 py-2.5 font-semibold text-xs hidden xl:table-cell" style={{ color: 'var(--color-text-secondary)' }}>
                                            <button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleTaskSort('showOnCalendar')}>
                                                Calendar {renderTaskSortIcon('showOnCalendar')}
                                            </button>
                                        </th>
                                        <th className="px-3 py-2.5 font-semibold text-xs text-right" style={{ color: 'var(--color-text-secondary)' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedTasks.map((task: any) => {
                                        const sharedOwnerName = getSharedOwnerName(task, user?.id);
                                        const canManage = !sharedOwnerName;
                                        const isDone = task.status === 'DONE';
                                        const isArchived = task.status === 'ARCHIVED';
                                        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
                                        const isOverdue = dueDate ? dueDate < new Date(new Date().setHours(0, 0, 0, 0)) && !isDone && !isArchived : false;
                                        const dueBadge = getTaskDueBadge(task);
                                        const hasAutoExpense = task.taskType === 'PAYMENT' && task.createExpenseAutomatically;
                                        return (
                                            <tr key={task.id} className={`border-b last:border-0 hover:bg-gray-50 transition-colors group ${canManage ? 'cursor-pointer' : ''}`} style={{ borderColor: 'var(--color-border)' }} onClick={() => canManage && openEditTask(task)}>
                                                <td className="px-4 py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-medium ${isDone || isArchived ? 'line-through opacity-50' : ''}`} style={{ color: 'var(--color-text)' }}>{task.title}</span>
                                                    </div>
                                                    {sharedOwnerName && <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>Owner: {sharedOwnerName}</p>}
                                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${dueBadge.tone === 'danger' ? 'bg-red-50 text-red-600' : dueBadge.tone === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-600'}`}>
                                                            {dueBadge.label}
                                                        </span>
                                                        {task.notificationEnabled && (
                                                            <>
                                                                <Bell className="w-3 h-3 flex-shrink-0 text-red-500" />
                                                                {formatTaskNotificationBadges(task).map((badge, i) => (
                                                                    <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded bg-purple-50 text-purple-600">{badge}</span>
                                                                ))}
                                                            </>
                                                        )}
                                                        {hasAutoExpense && (
                                                            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                                                                Add Expense
                                                            </span>
                                                        )}
                                                        {task.showOnCalendar && (
                                                            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-cyan-50 text-cyan-700">
                                                                Task
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5 hidden sm:table-cell">
                                                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                                        {task.description || '—'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 hidden sm:table-cell">
                                                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                                        {task.taskType === 'PAYMENT' ? 'Payment' : 'Task'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 hidden sm:table-cell">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${isDone ? 'bg-emerald-50 text-emerald-700' : isArchived ? 'bg-gray-100 text-gray-600' : task.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                                                        {task.status === 'PLANNED' ? 'Plan' : task.status.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 hidden md:table-cell">
                                                    <span className="text-xs font-semibold" style={{ color: task.priority === 'HIGH' ? '#d97706' : 'var(--color-text-secondary)' }}>{task.priority}</span>
                                                </td>
                                                <td className="px-3 py-2.5 hidden lg:table-cell">
                                                    <span className="text-xs" style={{ color: isOverdue ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                                                        {dueDate ? format(dueDate, 'MMM d, yyyy') : '—'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 hidden xl:table-cell">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${task.showOnCalendar ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                                                        {task.showOnCalendar ? 'Shown' : 'Hidden'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    {canManage && (
                                                        <div className="flex items-center gap-1 justify-end">
                                                            {!isDone && !isArchived ? (
                                                                <button onClick={(e) => { e.stopPropagation(); completeTaskMut.mutate(task.id); }} className="p-1 text-xs font-medium px-2 rounded text-green-600 bg-green-50 hover:bg-green-100" title="Mark done">Done</button>
                                                            ) : (
                                                                <button onClick={(e) => { e.stopPropagation(); updateTaskMut.mutate({ id: task.id, body: { status: 'PLANNED' } }); }} className="p-1 text-xs font-medium px-2 rounded text-orange-600 bg-orange-50 hover:bg-orange-100" title="Reopen">Reopen</button>
                                                            )}
                                                            <button onClick={(e) => { e.stopPropagation(); updateTaskMut.mutate({ id: task.id, body: { pinToDashboard: !task.pinToDashboard } }); }} className={`p-1 ${task.pinToDashboard ? 'text-amber-500 hover:text-amber-600' : 'text-gray-300 hover:text-amber-400'}`} title="Pin"><Pin className="w-3.5 h-3.5" /></button>
                                                            <button onClick={(e) => { e.stopPropagation(); openEditTask(task); }} className="p-1 text-gray-400 hover:text-gray-600" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                                            <button onClick={(e) => { e.stopPropagation(); openDuplicateTask(task); }} className="p-1 text-blue-500 hover:text-blue-600" title="Duplicate"><Copy className="w-3.5 h-3.5" /></button>
                                                            <button onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete this task?')) deleteTaskMut.mutate(task.id); }} className="p-1 text-red-500 hover:text-red-600" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {gridSortedTasks.map((task: any) => {
                                const sharedOwnerName = getSharedOwnerName(task, user?.id);
                                const canManage = !sharedOwnerName;
                                const notifText = formatNotification(task);
                                const repeatText = formatTaskRepeat(task);
                                const isDone = task.status === 'DONE';
                                const isArchived = task.status === 'ARCHIVED';
                                const dueDate = task.dueDate ? new Date(task.dueDate) : null;
                                const isOverdue = dueDate ? dueDate < new Date(new Date().setHours(0, 0, 0, 0)) && !isDone && !isArchived : false;
                                const dueBadge = getTaskDueBadge(task);
                                const hasAutoExpense = task.taskType === 'PAYMENT' && task.createExpenseAutomatically;
                                return (
                                    <div
                                        key={task.id}
                                        className="card p-5 animate-slide-up transition-shadow hover:shadow-lg"
                                        onClick={() => canManage && openEditTask(task)}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="font-semibold" style={{ color: 'var(--color-text)' }}>{task.title}</h4>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${task.taskType === 'PAYMENT' ? 'bg-orange-50 text-orange-700' : 'bg-slate-100 text-slate-700'}`}>
                                                        {task.taskType === 'PAYMENT' ? 'Payment' : 'Task'}
                                                    </span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${task.status === 'DONE' ? 'bg-emerald-50 text-emerald-700' : task.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-700' : task.status === 'ARCHIVED' ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-700'}`}>
                                                        {task.status === 'PLANNED' ? 'Plan' : task.status.replace('_', ' ')}
                                                    </span>
                                                    {task.isShared && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">Shared</span>}
                                                    {task.pinToDashboard && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">Pinned</span>}
                                                </div>
                                                {task.description && <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>{task.description}</p>}
                                                {sharedOwnerName && <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>Owner: {sharedOwnerName}</p>}
                                                <div className="flex items-center gap-2 mt-3 flex-wrap">
                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded ${dueBadge.tone === 'danger' ? 'bg-red-50 text-red-600' : dueBadge.tone === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-600'}`}>
                                                        {dueBadge.label}
                                                    </span>
                                                    {task.notificationEnabled && (
                                                        <>
                                                            <Bell className="w-3 h-3 flex-shrink-0 text-red-500" />
                                                            {formatTaskNotificationBadges(task).map((badge, i) => (
                                                                <span key={i} className="text-[10px] font-medium px-2 py-1 rounded bg-purple-50 text-purple-600">{badge}</span>
                                                            ))}
                                                        </>
                                                    )}
                                                    {hasAutoExpense && (
                                                        <span className="text-[10px] font-medium px-2 py-1 rounded bg-emerald-50 text-emerald-600">
                                                            Add Expense
                                                        </span>
                                                    )}
                                                    {task.showOnCalendar && (
                                                        <span className="text-[10px] font-medium px-2 py-1 rounded bg-cyan-50 text-cyan-700">
                                                            Task
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {canManage && (
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    <button onClick={(e) => { e.stopPropagation(); updateTaskMut.mutate({ id: task.id, body: { pinToDashboard: !task.pinToDashboard } }); }} className={`p-1 ${task.pinToDashboard ? 'text-amber-500' : 'hover:text-amber-500'}`} title="Pin task"><Pin className="w-3.5 h-3.5" /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); openEditTask(task); }} className="p-1 hover:text-indigo-500" title="Edit task"><Pencil className="w-3.5 h-3.5" /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); openDuplicateTask(task); }} className="p-1 hover:text-sky-500" title="Duplicate task"><Copy className="w-3.5 h-3.5" /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete this task?')) deleteTaskMut.mutate(task.id); }} className="p-1 hover:text-red-500" title="Delete task"><Trash2 className="w-3.5 h-3.5" /></button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-4 space-y-2">
                                            <div className="flex items-center justify-between text-xs">
                                                <span style={{ color: 'var(--color-text-secondary)' }}>Status</span>
                                                <span className="font-semibold" style={{ color: task.status === 'DONE' ? '#059669' : task.status === 'IN_PROGRESS' ? '#d97706' : 'var(--color-text)' }}>
                                                    {task.status === 'PLANNED' ? 'Plan' : task.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <span style={{ color: 'var(--color-text-secondary)' }}>Priority</span>
                                                <span className="font-semibold" style={{ color: task.priority === 'HIGH' ? '#d97706' : 'var(--color-text)' }}>{task.priority}</span>
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
                                                            {expenseScopeOptions.find((scope: { value: string; label: string }) => scope.value === task.scope)?.label || 'Personal'}
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                            <div className="flex items-center justify-between text-xs">
                                                <span style={{ color: 'var(--color-text-secondary)' }}>Calendar</span>
                                                <span className="font-semibold" style={{ color: task.showOnCalendar ? '#4f46e5' : 'var(--color-text)' }}>
                                                    {task.showOnCalendar ? 'Shown' : 'Hidden'}
                                                </span>
                                            </div>
                                            {repeatText && (
                                                <div className="flex items-center justify-between text-xs">
                                                    <span style={{ color: 'var(--color-text-secondary)' }}>Repeat</span>
                                                    <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{repeatText}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
                                            <div className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                                                {task.user?.name || 'Task'}{task.completedAt ? ` · Completed ${format(new Date(task.completedAt), 'MMM d')}` : ''}
                                            </div>
                                            {!isDone && !isArchived && canManage ? (
                                                <button className="btn-primary text-xs py-1.5 px-3" onClick={(e) => { e.stopPropagation(); completeTaskMut.mutate(task.id); }} disabled={completeTaskMut.isPending}>
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark Done
                                                </button>
                                            ) : canManage ? (
                                                <button className="text-xs py-1.5 px-3 rounded-lg font-medium inline-flex items-center gap-1.5 transition-colors" style={{ background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' }} onClick={(e) => { e.stopPropagation(); updateTaskMut.mutate({ id: task.id, body: { status: 'PLANNED' } }); }}>
                                                    <RefreshCcw className="w-3.5 h-3.5" /> Reopen
                                                </button>
                                            ) : null}
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
                    <div className="card p-6 w-full max-w-xl animate-slide-up overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Create New Goal</h3>
                            <button onClick={() => setShowCreate(false)}><X className="w-5 h-5" /></button>
                        </div>
                        <GoalForm form={goalForm} setForm={setGoalForm} onSubmit={(f) => createGoalMut.mutate(f)} onCancel={() => setShowCreate(false)} loading={createGoalMut.isPending} isEdit={false} />
                    </div>
                </div>
            )}

            {editGoal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditGoal(null); }}>
                    <div className="card p-6 w-full max-w-xl animate-slide-up overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Edit Goal</h3>
                            <button onClick={() => setEditGoal(null)}><X className="w-5 h-5" /></button>
                        </div>
                        <GoalForm
                            form={goalForm}
                            setForm={setGoalForm}
                            onSubmit={(f) => updateGoalMut.mutate({ id: editGoal.id, body: f })}
                            onCancel={() => setEditGoal(null)}
                            onDelete={() => {
                                if (window.confirm('Delete this goal and ALL its check-ins? This cannot be undone.')) {
                                    deleteGoalMut.mutate(editGoal.id);
                                    setEditGoal(null);
                                }
                            }}
                            loading={updateGoalMut.isPending}
                            isEdit
                        />
                    </div>
                </div>
            )}

            {(showTaskModal || editTask) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) { setShowTaskModal(false); setEditTask(null); } }}>
                    <div className="card p-6 w-full max-w-xl animate-slide-up overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{editTask ? 'Edit Task' : 'Add Task'}</h3>
                            <button onClick={() => { setShowTaskModal(false); setEditTask(null); }}><X className="w-5 h-5" /></button>
                        </div>
                        <TaskForm
                            form={taskForm}
                            setForm={setTaskForm}
                            onSubmit={(payload) => {
                                if (editTask) updateTaskMut.mutate({ id: editTask.id, body: payload });
                                else createTaskMut.mutate(payload);
                            }}
                            onCancel={() => { setShowTaskModal(false); setEditTask(null); }}
                            onDelete={editTask ? () => {
                                if (window.confirm('Delete this task?')) {
                                    deleteTaskMut.mutate(editTask.id);
                                    setEditTask(null);
                                }
                            } : undefined}
                            loading={createTaskMut.isPending || updateTaskMut.isPending}
                            isEdit={!!editTask}
                        />
                    </div>
                </div>
            )}

            {checkInGoalId && selectedGoal && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 pb-24 sm:items-center sm:pb-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setCheckInGoalId(null); }}>
                    <div className="card w-full max-w-sm animate-slide-up overflow-y-auto p-6 max-h-[calc(100dvh-8rem)]" onClick={(e) => e.stopPropagation()}>
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
                                    <input type="number" min={1} className="input" value={quantity} onChange={(e) => setQuantity(e.target.value === '' ? '' : parseInt(e.target.value, 10))} required />
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
