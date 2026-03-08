import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, DollarSign, Filter, Pencil, Plus, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import api from '../api/client';
import { useAuthStore } from '../stores/auth';

const payCategories = ['Food', 'Utilities', 'Healthcare', 'Shopping', 'Transport', 'Home Maintenance', 'Education', 'AI', 'Entertainment', 'Other'];
const receiveCategories = ['Salary', 'Top-up', 'Sell'];
const allCategories = [...payCategories, ...receiveCategories];
const typeOptions = [
    { value: 'PAY', label: 'Pay' },
    { value: 'RECEIVE', label: 'Receive' },
];
const scopeOptions = [
    { value: 'PERSONAL', label: 'Personal' },
    { value: 'FAMILY', label: 'Family' },
    { value: 'KEO', label: 'Keo' },
    { value: 'PROJECT', label: 'Project' },
];
const columns = [
    { key: 'date', label: 'Date' },
    { key: 'user', label: 'User' },
    { key: 'type', label: 'Type' },
    { key: 'scope', label: 'Scope' },
    { key: 'category', label: 'Category' },
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount' },
] as const;

const formatAmount = (amount: number) => `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)} VND`;

const parseAmountInput = (value: string) => {
    const normalized = value.trim().replace(/,/g, '').toUpperCase();
    if (!normalized) return NaN;

    const match = normalized.match(/^(\d+(?:\.\d+)?)([KMB])?$/);
    if (!match) return NaN;

    const base = Number(match[1]);
    const multiplierMap: Record<string, number> = { K: 1_000, M: 1_000_000, B: 1_000_000_000 };
    const multiplier = match[2] ? multiplierMap[match[2]] : 1;
    return Math.round(base * multiplier);
};

const emptyForm = () => ({
    description: '',
    amount: '',
    type: 'PAY',
    isShared: false,
    category: 'Food',
    scope: 'PERSONAL',
    date: format(new Date(), 'yyyy-MM-dd'),
    note: '',
});

type SortKey = typeof columns[number]['key'];
type SortOrder = 'asc' | 'desc';

export default function ExpensesPage() {
    const qc = useQueryClient();
    const { user } = useAuthStore();
    const [showModal, setShowModal] = useState(false);
    const [editingExpense, setEditingExpense] = useState<any>(null);
    const [filters, setFilters] = useState({ type: '', scope: '', category: '', dateFrom: '', dateTo: '' });
    const [form, setForm] = useState(emptyForm());
    const [sortBy, setSortBy] = useState<SortKey>('date');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const categoryOptions = form.type === 'RECEIVE' ? receiveCategories : payCategories;

    const queryParams = new URLSearchParams();
    queryParams.set('limit', '100');
    if (filters.type) queryParams.set('type', filters.type);
    if (filters.scope) queryParams.set('scope', filters.scope);
    if (filters.category) queryParams.set('category', filters.category);
    if (filters.dateFrom) queryParams.set('dateFrom', new Date(`${filters.dateFrom}T00:00:00`).toISOString());
    if (filters.dateTo) queryParams.set('dateTo', new Date(`${filters.dateTo}T23:59:59.999`).toISOString());

    const { data, isLoading } = useQuery({
        queryKey: ['expenses', filters],
        queryFn: async () => (await api.get(`/expenses?${queryParams}`)).data,
    });

    const createMut = useMutation({
        mutationFn: (body: any) => api.post('/expenses', body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['expenses'] });
            closeModal();
        },
    });

    const updateMut = useMutation({
        mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/expenses/${id}`, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['expenses'] });
            closeModal();
        },
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => api.delete(`/expenses/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
    });

    const expenses = data?.data || [];
    const sortedExpenses = useMemo(() => {
        const getValue = (expense: any, key: SortKey) => {
            switch (key) {
                case 'date': return new Date(expense.date).getTime();
                case 'user': return expense.user?.name?.toLowerCase() || '';
                case 'type': return expense.type || '';
                case 'scope': return expense.scope || '';
                case 'category': return expense.category || '';
                case 'description': return expense.description || '';
                case 'amount': return expense.amount || 0;
                default: return '';
            }
        };

        return [...expenses].sort((a, b) => {
            const left = getValue(a, sortBy);
            const right = getValue(b, sortBy);
            const result = typeof left === 'number' && typeof right === 'number'
                ? left - right
                : String(left).localeCompare(String(right));
            return sortOrder === 'asc' ? result : -result;
        });
    }, [expenses, sortBy, sortOrder]);

    const summary = useMemo(() => {
        const income = expenses.filter((item: any) => item.type === 'RECEIVE').reduce((sum: number, item: any) => sum + item.amount, 0);
        const payment = expenses.filter((item: any) => item.type === 'PAY').reduce((sum: number, item: any) => sum + item.amount, 0);
        return {
            income,
            payment,
            remaining: income - payment,
        };
    }, [expenses]);

    const parsedAmount = parseAmountInput(form.amount);
    const amountPreview = Number.isNaN(parsedAmount) ? '' : formatAmount(parsedAmount);

    function toggleSort(column: SortKey) {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
            return;
        }
        setSortBy(column);
        setSortOrder(column === 'amount' ? 'desc' : 'asc');
    }

    function openCreate() {
        setEditingExpense(null);
        setForm(emptyForm());
        setShowModal(true);
    }

    function openEdit(expense: any) {
        setEditingExpense(expense);
        setForm({
            description: expense.description || '',
            amount: String(Math.round(expense.amount)),
            type: expense.type || 'PAY',
            isShared: !!expense.isShared,
            category: expense.category || ((expense.type || 'PAY') === 'RECEIVE' ? 'Salary' : 'Food'),
            scope: expense.scope || 'PERSONAL',
            date: format(new Date(expense.date), 'yyyy-MM-dd'),
            note: expense.note || '',
        });
        setShowModal(true);
    }

    function closeModal() {
        setShowModal(false);
        setEditingExpense(null);
        setForm(emptyForm());
    }

    function handleTypeChange(nextType: string) {
        setForm((current) => ({
            ...current,
            type: nextType,
            category: nextType === 'RECEIVE' ? receiveCategories[0] : payCategories[0],
        }));
    }

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const amount = parseAmountInput(form.amount);
        if (Number.isNaN(amount) || amount <= 0) {
            window.alert('Amount must be a valid positive number. Example: 82000000 or 82M');
            return;
        }

        const payload = {
            ...form,
            amount,
            date: new Date(`${form.date}T00:00:00`).toISOString(),
        };

        if (editingExpense) {
            updateMut.mutate({ id: editingExpense.id, body: payload });
            return;
        }

        createMut.mutate(payload);
    }

    function handleDelete(id: string) {
        if (window.confirm('Delete this expense item?')) deleteMut.mutate(id);
    }

    function renderSortIcon(column: SortKey) {
        if (sortBy !== column) return <ArrowUp className="w-3.5 h-3.5 opacity-30" />;
        return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />;
    }

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <DollarSign className="w-6 h-6" style={{ color: '#d97706' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Expenses</h2>
                </div>
                <button className="btn-primary" onClick={openCreate}>
                    <Plus className="w-4 h-4" /> Add Expense
                </button>
            </div>

            <div className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Filter className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Filters</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <select className="input text-sm" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
                        <option value="">All Types</option>
                        {typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <select className="input text-sm" value={filters.scope} onChange={(e) => setFilters({ ...filters, scope: e.target.value })}>
                        <option value="">All Scopes</option>
                        {scopeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <select className="input text-sm" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
                        <option value="">All Categories</option>
                        {allCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                    <input type="date" className="input text-sm" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
                    <input type="date" className="input text-sm" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card p-4">
                    <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Total income</div>
                    <div className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>{formatAmount(summary.income)}</div>
                </div>
                <div className="card p-4">
                    <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Total payment</div>
                    <div className="text-2xl font-bold" style={{ color: 'var(--color-danger)' }}>{formatAmount(summary.payment)}</div>
                </div>
                <div className="card p-4">
                    <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Remaining fund ({expenses.length} items)</div>
                    <div className="text-2xl font-bold" style={{ color: summary.remaining < 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                        {formatAmount(summary.remaining)}
                    </div>
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeModal}>
                    <div className="card p-6 w-full max-w-lg animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">{editingExpense ? 'Edit Expense' : 'Add Expense'}</h3>
                            <button onClick={closeModal}><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="label">Description <span className="text-red-500">*</span></label>
                                <input className="input" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="label">Type <span className="text-red-500">*</span></label>
                                    <select className="input" value={form.type} onChange={(e) => handleTypeChange(e.target.value)}>
                                        {typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Scope <span className="text-red-500">*</span></label>
                                    <select className="input" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
                                        {scopeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Date <span className="text-red-500">*</span></label>
                                    <input type="date" className="input" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Category <span className="text-red-500">*</span></label>
                                    <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                                        {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Amount <span className="text-red-500">*</span></label>
                                    <input
                                        className="input"
                                        required
                                        placeholder="Example: 82000000 or 82M"
                                        value={form.amount}
                                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                    />
                                    {form.amount && (
                                        <div className="mt-1 text-xs" style={{ color: Number.isNaN(parsedAmount) ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                                            {Number.isNaN(parsedAmount) ? 'Invalid amount format' : amountPreview}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="label">Note</label>
                                <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={form.isShared}
                                    onChange={(e) => setForm({ ...form, isShared: e.target.checked })}
                                />
                                Share with all users
                            </label>
                            <button type="submit" className="btn-primary w-full" disabled={createMut.isPending || updateMut.isPending}>
                                {editingExpense ? 'Save Changes' : 'Add Expense'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="card h-16 animate-pulse bg-gray-100" />)}</div>
            ) : (
                <div className="card overflow-hidden">
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    {columns.map((column) => (
                                        <th key={column.key} className={column.key === 'amount' ? 'text-right' : ''}>
                                            <button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleSort(column.key)}>
                                                {column.label}
                                                {renderSortIcon(column.key)}
                                            </button>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedExpenses.map((expense: any) => {
                                    const isReceive = expense.type === 'RECEIVE';
                                    const canEdit = expense.userId === user?.id;
                                    return (
                                        <tr key={expense.id}>
                                            <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{format(new Date(expense.date), 'MMM d, yyyy')}</td>
                                            <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{expense.user?.name || '-'}</td>
                                            <td>
                                                <span className={`badge ${isReceive ? 'badge-success' : 'badge-danger'}`}>
                                                    {isReceive ? 'Receive' : 'Pay'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="badge badge-warning">{scopeOptions.find((option) => option.value === expense.scope)?.label || expense.scope}</span>
                                            </td>
                                            <td><span className="badge-primary">{expense.category || '-'}</span></td>
                                            <td>
                                                <div className="font-medium" style={{ color: 'var(--color-text)' }}>{expense.description}</div>
                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    {expense.isShared && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">Shared</span>
                                                    )}
                                                    {expense.note && (
                                                        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{expense.note}</span>
                                                    )}
                                                </div>
                                                {canEdit && (
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <button type="button" className="inline-flex items-center gap-1 text-sm hover:opacity-80" style={{ color: 'var(--color-text-secondary)' }} onClick={() => openEdit(expense)}>
                                                            <Pencil className="w-3.5 h-3.5" /> Edit
                                                        </button>
                                                        <button type="button" className="inline-flex items-center gap-1 text-sm hover:opacity-80" style={{ color: 'var(--color-danger)' }} onClick={() => handleDelete(expense.id)}>
                                                            <Trash2 className="w-3.5 h-3.5" /> Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="text-right font-semibold" style={{ color: isReceive ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                                {formatAmount(expense.amount)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
