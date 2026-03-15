import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Wallet, Filter, FileSpreadsheet, FileText, Pencil, Plus, Trash2, Copy, X } from 'lucide-react';
import { format } from 'date-fns';
import api from '../api/client';
import { useAuthStore } from '../stores/auth';
import { getSharedOwnerName } from '../utils/sharedOwnership';
import PaginationControls from '../components/PaginationControls';
import { parseCompactAmountInput } from '../utils/amount';
import {
    DEFAULT_EXPENSE_FILTERS,
    DEFAULT_PAY_CATEGORY,
    EXPENSE_ALL_CATEGORIES,
    EXPENSE_PAY_CATEGORIES,
    EXPENSE_RECEIVE_CATEGORIES,
    EXPENSE_SCOPE_OPTIONS,
    EXPENSE_TIME_PRESET_OPTIONS,
    EXPENSE_TYPE_OPTIONS,
    getExpenseDateRangeFromPreset,
    type ExpenseTimePreset,
} from '../config/expenseFilters';

const payCategories = EXPENSE_PAY_CATEGORIES;
const receiveCategories = EXPENSE_RECEIVE_CATEGORIES;
const allCategories = EXPENSE_ALL_CATEGORIES;
const typeOptions = EXPENSE_TYPE_OPTIONS;
const scopeOptions = EXPENSE_SCOPE_OPTIONS;
const scopeColors: Record<string, { color: string; bg: string }> = {
    PERSONAL: { color: '#1d4ed8', bg: '#dbeafe' },
    FAMILY: { color: '#15803d', bg: '#dcfce7' },
    KEO: { color: '#b91c1c', bg: '#fee2e2' },
    PROJECT: { color: '#6d28d9', bg: '#ede9fe' },
};
function ScopeBadge({ scope }: { scope: string }) {
    const label = scopeOptions.find((o) => o.value === scope)?.label || scope;
    const colors = scopeColors[scope] || { color: '#374151', bg: '#f3f4f6' };
    return <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ color: colors.color, backgroundColor: colors.bg }}>{label}</span>;
}
const paymentOptions = [
    { value: 'CASH', label: 'Cash' },
    { value: 'BANK_TRANSFER', label: 'Bank transfer' },
    { value: 'CREDIT_CARD', label: 'Credit card' },
];
const timeOptions = EXPENSE_TIME_PRESET_OPTIONS;
const columns = [
    { key: 'date', label: 'Date' },
    { key: 'user', label: 'User' },
    { key: 'type', label: 'Type' },
    { key: 'scope', label: 'Scope' },
    { key: 'category', label: 'Category' },
    { key: 'payment', label: 'Payment' },
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount' },
] as const;

type SortKey = typeof columns[number]['key'];
type SortOrder = 'asc' | 'desc';
type TimePreset = ExpenseTimePreset;

const formatAmount = (amount: number) => `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)} VND`;
const escapeHtml = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const parseAmountInput = parseCompactAmountInput;

const emptyForm = () => ({
    description: '',
    amount: '',
    type: 'PAY',
    isShared: false,
    category: DEFAULT_PAY_CATEGORY,
    payment: 'CASH',
    scope: 'PERSONAL',
    date: format(new Date(), 'yyyy-MM-dd'),
    note: '',
});

export default function ExpensesPage() {
    const qc = useQueryClient();
    const { user } = useAuthStore();
    const exportContentRef = useRef<HTMLDivElement>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingExpense, setEditingExpense] = useState<any>(null);
    const [filters, setFilters] = useState({ ...DEFAULT_EXPENSE_FILTERS });
    const [form, setForm] = useState(emptyForm());
    const [sortBy, setSortBy] = useState<SortKey>('date');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [expenseSearch, setExpenseSearch] = useState('');

    const effectiveRange = filters.timePreset === 'CUSTOM'
        ? { dateFrom: filters.dateFrom, dateTo: filters.dateTo }
        : getExpenseDateRangeFromPreset(filters.timePreset);

    const queryParams = new URLSearchParams();
    queryParams.set('page', String(page));
    queryParams.set('limit', String(pageSize));
    if (filters.type) queryParams.set('type', filters.type);
    if (filters.scope) queryParams.set('scope', filters.scope);
    if (filters.category) queryParams.set('category', filters.category);
    if (effectiveRange.dateFrom) queryParams.set('dateFrom', new Date(`${effectiveRange.dateFrom}T00:00:00`).toISOString());
    if (effectiveRange.dateTo) queryParams.set('dateTo', new Date(`${effectiveRange.dateTo}T23:59:59.999`).toISOString());

    const { data, isLoading } = useQuery({
        queryKey: ['expenses', filters, effectiveRange, page, pageSize],
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
    const meta = data?.meta;
    const totalPages = meta?.totalPages || 1;
    const totalItems = meta?.total || expenses.length;
    const categoryOptions = form.type === 'RECEIVE' ? receiveCategories : payCategories;

    useEffect(() => {
        setPage(1);
    }, [filters, effectiveRange.dateFrom, effectiveRange.dateTo, pageSize]);

    const sortedExpenses = useMemo(() => {
        const getValue = (expense: any, key: SortKey) => {
            switch (key) {
                case 'date': return new Date(expense.date).getTime();
                case 'user': return expense.user?.name?.toLowerCase() || '';
                case 'type': return expense.type || '';
                case 'scope': return expense.scope || '';
                case 'category': return expense.category || '';
                case 'payment': return expense.payment || '';
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

    const displayedExpenses = useMemo(() => {
        if (!expenseSearch.trim()) return sortedExpenses;
        const q = expenseSearch.toLowerCase();
        return sortedExpenses.filter((e: any) =>
            [e.description, e.category, e.scope, e.note, e.user?.name, e.payment]
                .some((v) => v && String(v).toLowerCase().includes(q))
        );
    }, [sortedExpenses, expenseSearch]);

    const summary = useMemo(() => {
        const income = expenses.filter((item: any) => item.type === 'RECEIVE').reduce((sum: number, item: any) => sum + item.amount, 0);
        const payment = expenses.filter((item: any) => item.type === 'PAY').reduce((sum: number, item: any) => sum + item.amount, 0);
        return { income, payment, remaining: income - payment };
    }, [expenses]);

    const parsedAmount = parseAmountInput(form.amount);
    const amountPreview = Number.isNaN(parsedAmount) ? '' : formatAmount(parsedAmount);
    const timeRangeLabel = filters.timePreset === 'CUSTOM'
        ? `${filters.dateFrom || 'Start'} → ${filters.dateTo || 'End'}`
        : `${effectiveRange.dateFrom} → ${effectiveRange.dateTo}`;

    function handleExportExcel() {
        const rows = displayedExpenses.map((expense: any) => ({
            Date: format(new Date(expense.date), 'MMM d, yyyy'),
            User: expense.user?.name || '',
            Type: expense.type === 'RECEIVE' ? 'Receive' : 'Pay',
            Scope: scopeOptions.find((option) => option.value === expense.scope)?.label || expense.scope || '',
            Category: expense.category || '',
            Payment: paymentOptions.find((option) => option.value === expense.payment)?.label || expense.payment || '',
            Description: expense.description || '',
            Note: expense.note || '',
            Shared: expense.isShared ? 'Yes' : 'No',
            Amount: Math.round(expense.amount || 0),
        }));

        const html = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
                <head>
                    <meta charset="UTF-8" />
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h1 { margin: 0 0 12px; }
                        table { border-collapse: collapse; width: 100%; }
                        th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
                        th { background: #f3f4f6; }
                    </style>
                </head>
                <body>
                    <h1>Expenses Export</h1>
                    <p><strong>Time Range:</strong> ${escapeHtml(timeRangeLabel)}</p>
                    <table>
                        <thead>
                            <tr>${Object.keys(rows[0] || { Date: '', User: '', Type: '', Scope: '', Category: '', Description: '', Note: '', Shared: '', Amount: '' })
                                .map((key) => `<th>${escapeHtml(key)}</th>`).join('')}</tr>
                        </thead>
                        <tbody>
                            ${(rows.length ? rows : [{ Date: '', User: '', Type: '', Scope: '', Category: '', Description: 'No data for this filter.', Note: '', Shared: '', Amount: '' }])
                                .map((row) => `<tr>${Object.values(row).map((value) => `<td>${escapeHtml(String(value ?? ''))}</td>`).join('')}</tr>`).join('')}
                        </tbody>
                    </table>
                </body>
            </html>
        `;

        const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `expenses-${filters.timePreset.toLowerCase()}.xls`;
        link.click();
        URL.revokeObjectURL(url);
    }

    function handleExportPdf() {
        if (!exportContentRef.current) return;
        const printWindow = window.open('', '_blank', 'width=1280,height=900');
        if (!printWindow) return;

        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
            .map((node) => node.outerHTML)
            .join('\n');

        printWindow.document.open();
        printWindow.document.write(`
            <html>
                <head>
                    <title>Expenses Export</title>
                    ${styles}
                    <style>
                        body { font-family: Arial, sans-serif; padding: 24px; background: #ffffff; color: #111827; }
                        .print-header { margin-bottom: 24px; }
                        .print-header h1 { margin: 0 0 8px; font-size: 28px; }
                        .print-meta { font-size: 14px; color: #4b5563; display: grid; gap: 4px; }
                        .card { break-inside: avoid; page-break-inside: avoid; }
                        button { display: none !important; }
                    </style>
                </head>
                <body>
                    <div class="print-header">
                        <h1>Expenses</h1>
                        <div class="print-meta">
                            <div><strong>Time Range:</strong> ${escapeHtml(timeRangeLabel)}</div>
                        </div>
                    </div>
                    ${exportContentRef.current.innerHTML}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        window.setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 400);
    }

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
            category: expense.category || ((expense.type || 'PAY') === 'RECEIVE' ? receiveCategories[0] : DEFAULT_PAY_CATEGORY),
            payment: expense.payment || 'CASH',
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
            category: nextType === 'RECEIVE' ? receiveCategories[0] : DEFAULT_PAY_CATEGORY,
        }));
    }

    function handleTimePresetChange(nextPreset: TimePreset) {
        setFilters((current) => ({
            ...current,
            timePreset: nextPreset,
            dateFrom: nextPreset === 'CUSTOM' ? current.dateFrom : '',
            dateTo: nextPreset === 'CUSTOM' ? current.dateTo : '',
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

    function handleDuplicate(expense: any) {
        createMut.mutate({
            description: expense.description,
            amount: expense.amount,
            type: expense.type,
            isShared: expense.isShared,
            category: expense.category,
            payment: expense.payment,
            scope: expense.scope,
            date: format(new Date(expense.date), 'yyyy-MM-dd\'T\'00:00:00'),
            note: expense.note || '',
        });
    }

    function renderSortIcon(column: SortKey) {
        if (sortBy !== column) return <ArrowUp className="w-3.5 h-3.5 opacity-30" />;
        return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />;
    }

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <Wallet className="w-6 h-6" style={{ color: '#d97706' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Expenses</h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        className="px-4 py-2 rounded-md text-sm font-semibold transition-all inline-flex items-center gap-2"
                        style={{ backgroundColor: '#166534', color: '#fff' }}
                        onClick={handleExportExcel}
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Export Excel
                    </button>
                    <button
                        type="button"
                        className="px-4 py-2 rounded-md text-sm font-semibold transition-all inline-flex items-center gap-2"
                        style={{ backgroundColor: '#1d4ed8', color: '#fff' }}
                        onClick={handleExportPdf}
                    >
                        <FileText className="w-4 h-4" />
                        Export PDF
                    </button>
                    <button className="btn-primary" onClick={openCreate}>
                        <Plus className="w-4 h-4" /> Add Expense
                    </button>
                </div>
            </div>

            <div className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Filter className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Filters</span>
                </div>
                <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                        <input
                            type="text"
                            className="input text-sm md:col-span-2"
                            placeholder="Search expenses..."
                            value={expenseSearch}
                            onChange={(e) => setExpenseSearch(e.target.value)}
                        />
                        <select className="input text-sm" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value, category: filters.category && !((e.target.value || form.type) === 'RECEIVE' ? receiveCategories : payCategories).includes(filters.category) ? '' : filters.category })}>
                            <option value="">All Types</option>
                            {typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                        <select className="input text-sm" value={filters.scope} onChange={(e) => setFilters({ ...filters, scope: e.target.value })}>
                            <option value="">All Scopes</option>
                            {scopeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                        <select className="input text-sm" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
                            <option value="">All Categories</option>
                            {(filters.type === 'RECEIVE' ? receiveCategories : filters.type === 'PAY' ? payCategories : allCategories).map((category) => <option key={category} value={category}>{category}</option>)}
                        </select>
                        <select className="input text-sm" value={filters.timePreset} onChange={(e) => handleTimePresetChange(e.target.value as TimePreset)}>
                            {timeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                    </div>
                    {filters.timePreset === 'CUSTOM' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-sm">
                            <input
                                type="date"
                                className="input text-sm"
                                value={filters.dateFrom}
                                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                            />
                            <input
                                type="date"
                                className="input text-sm"
                                value={filters.dateTo}
                                min={filters.dateFrom || undefined}
                                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                            />
                        </div>
                    )}
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
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
                                    <label className="label">Payment <span className="text-red-500">*</span></label>
                                    <select className="input" value={form.payment} onChange={(e) => setForm({ ...form, payment: e.target.value })}>
                                        {paymentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Amount <span className="text-red-500">*</span></label>
                                    <input className="input" required placeholder="Example: 82000000, 600k, or 82M" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
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
                                <input type="checkbox" checked={form.isShared} onChange={(e) => setForm({ ...form, isShared: e.target.checked })} />
                                Share with all users
                            </label>
                            <div className="flex items-center justify-between gap-3 pt-2">
                                <div>
                                    {editingExpense && (
                                        <button
                                            type="button"
                                            className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white"
                                            onClick={() => {
                                                if (window.confirm('Delete this expense?')) {
                                                    deleteMut.mutate(editingExpense.id);
                                                    closeModal();
                                                }
                                            }}
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-2 ml-auto">
                                    <button type="button" className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50" onClick={closeModal}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn-primary" disabled={createMut.isPending || updateMut.isPending}>
                                        {editingExpense ? 'Save' : 'Add Expense'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="card h-16 animate-pulse bg-gray-100" />)}</div>
            ) : (
                <div ref={exportContentRef} className="space-y-6">
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
                                        <th className="text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedExpenses.map((expense: any, index: number) => {
                                        const isReceive = expense.type === 'RECEIVE';
                                        const canEdit = expense.userId === user?.id;
                                        const sharedOwnerName = getSharedOwnerName(expense, user?.id);
                                        return (
                                            <tr
                                                key={expense.id}
                                                onClick={() => canEdit && openEdit(expense)}
                                                className={`${canEdit ? 'cursor-pointer' : ''} ${index % 2 === 0 ? 'bg-[#ecfdf5]' : 'bg-white'} hover:bg-[#d1fae5] transition-colors`}
                                            >
                                                <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{format(new Date(expense.date), 'MMM d, yyyy')}</td>
                                                <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{expense.user?.name || '-'}</td>
                                                <td><span className={`badge ${isReceive ? 'badge-success' : 'badge-danger'}`}>{isReceive ? 'Receive' : 'Pay'}</span></td>
                                                <td>
                                                    <div className="flex items-center gap-1 flex-wrap">
                                                        <ScopeBadge scope={expense.scope} />
                                                        {expense.sourceModule && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-slate-100 text-slate-500">{expense.sourceModule}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td><span className="badge-primary">{expense.category || '-'}</span></td>
                                                <td><span className="badge-primary">{paymentOptions.find((option) => option.value === expense.payment)?.label || expense.payment || '-'}</span></td>
                                                <td>
                                                    <div className="font-medium" style={{ color: 'var(--color-text)' }}>{expense.description}</div>
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                        {expense.isShared && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">Shared</span>}
                                                        {sharedOwnerName && <span className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>Owner: {sharedOwnerName}</span>}
                                                        {expense.note && <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{expense.note}</span>}
                                                    </div>
                                                </td>
                                                <td className="text-right font-semibold" style={{ color: isReceive ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                                    {formatAmount(expense.amount)}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    {canEdit && (
                                                        <div className="flex items-center gap-1 justify-end">
                                                            <button type="button" onClick={(e) => { e.stopPropagation(); openEdit(expense); }} className="p-1 text-gray-400 hover:text-gray-600" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                                            <button type="button" onClick={(e) => { e.stopPropagation(); handleDuplicate(expense); }} className="p-1 text-blue-500 hover:text-blue-600" title="Duplicate"><Copy className="w-3.5 h-3.5" /></button>
                                                            <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(expense.id); }} className="p-1 text-red-500 hover:text-red-600" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <PaginationControls
                            page={page}
                            totalPages={totalPages}
                            pageSize={pageSize}
                            totalItems={totalItems}
                            onPageChange={setPage}
                            onPageSizeChange={setPageSize}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
