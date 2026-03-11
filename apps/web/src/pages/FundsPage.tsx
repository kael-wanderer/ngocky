import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Coins, Filter, Pencil, Plus, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import api from '../api/client';

const typeOptions = [
    { value: 'BUY', label: 'Buy' },
    { value: 'SELL', label: 'Sell' },
    { value: 'TOP_UP', label: 'Top-up' },
];

const scopeOptions = [
    { value: 'MECHANICAL_KEYBOARD', label: 'Mechanical keyboard' },
    { value: 'PLAY_STATION', label: 'Play Station' },
];

const categoryOptions = [
    { value: 'KEYCAP', label: 'Keycap' },
    { value: 'KIT', label: 'Kit' },
    { value: 'SHIPPING', label: 'Shipping' },
    { value: 'ACCESSORIES', label: 'Accessories' },
];

const columns = [
    { key: 'date', label: 'Date' },
    { key: 'type', label: 'Type' },
    { key: 'scope', label: 'Scope' },
    { key: 'category', label: 'Category' },
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount' },
] as const;

type SortKey = typeof columns[number]['key'];
type SortOrder = 'asc' | 'desc';

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
    type: 'BUY',
    scope: 'MECHANICAL_KEYBOARD',
    category: 'KEYCAP',
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
});

export default function FundsPage() {
    const qc = useQueryClient();
    const [showModal, setShowModal] = useState(false);
    const [editingFund, setEditingFund] = useState<any>(null);
    const [filters, setFilters] = useState({ type: '', scope: '', category: '', dateFrom: '', dateTo: '' });
    const [form, setForm] = useState(emptyForm());
    const [sortBy, setSortBy] = useState<SortKey>('date');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    const queryParams = new URLSearchParams();
    queryParams.set('limit', '100');
    if (filters.type) queryParams.set('type', filters.type);
    if (filters.scope) queryParams.set('scope', filters.scope);
    if (filters.category) queryParams.set('category', filters.category);
    if (filters.dateFrom) queryParams.set('dateFrom', new Date(`${filters.dateFrom}T00:00:00`).toISOString());
    if (filters.dateTo) queryParams.set('dateTo', new Date(`${filters.dateTo}T23:59:59.999`).toISOString());

    const { data, isLoading } = useQuery({
        queryKey: ['funds', filters],
        queryFn: async () => (await api.get(`/funds?${queryParams}`)).data,
    });

    const createMut = useMutation({
        mutationFn: (body: any) => api.post('/funds', body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['funds'] });
            closeModal();
        },
    });

    const updateMut = useMutation({
        mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/funds/${id}`, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['funds'] });
            closeModal();
        },
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => api.delete(`/funds/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['funds'] }),
    });

    const funds = data?.data || [];

    const sortedFunds = useMemo(() => {
        const getValue = (fund: any, key: SortKey) => {
            switch (key) {
                case 'date': return new Date(fund.date).getTime();
                case 'type': return fund.type || '';
                case 'scope': return fund.scope || '';
                case 'category': return fund.category || '';
                case 'description': return fund.description || '';
                case 'amount': return fund.amount || 0;
                default: return '';
            }
        };

        return [...funds].sort((a, b) => {
            const left = getValue(a, sortBy);
            const right = getValue(b, sortBy);
            const result = typeof left === 'number' && typeof right === 'number'
                ? left - right
                : String(left).localeCompare(String(right));
            return sortOrder === 'asc' ? result : -result;
        });
    }, [funds, sortBy, sortOrder]);

    const summary = useMemo(() => {
        const buy = funds.filter((item: any) => item.type === 'BUY').reduce((sum: number, item: any) => sum + item.amount, 0);
        const sell = funds.filter((item: any) => item.type === 'SELL').reduce((sum: number, item: any) => sum + item.amount, 0);
        const topUp = funds.filter((item: any) => item.type === 'TOP_UP').reduce((sum: number, item: any) => sum + item.amount, 0);
        return { buy, sell, topUp, net: sell + topUp - buy };
    }, [funds]);

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

    function renderSortIcon(column: SortKey) {
        if (sortBy !== column) return <ArrowUp className="w-3.5 h-3.5 opacity-30" />;
        return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />;
    }

    function openCreate() {
        setEditingFund(null);
        setForm(emptyForm());
        setShowModal(true);
    }

    function openEdit(fund: any) {
        setEditingFund(fund);
        setForm({
            description: fund.description || '',
            type: fund.type || 'BUY',
            scope: fund.scope || 'MECHANICAL_KEYBOARD',
            category: fund.category || 'KEYCAP',
            date: format(new Date(fund.date), 'yyyy-MM-dd'),
            amount: String(Math.round(fund.amount)),
        });
        setShowModal(true);
    }

    function closeModal() {
        setShowModal(false);
        setEditingFund(null);
        setForm(emptyForm());
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

        if (editingFund) {
            updateMut.mutate({ id: editingFund.id, body: payload });
            return;
        }

        createMut.mutate(payload);
    }

    function handleDelete(id: string) {
        if (window.confirm('Delete this fund transaction?')) deleteMut.mutate(id);
    }

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <Coins className="w-6 h-6" style={{ color: '#0f766e' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Funds</h2>
                </div>
                <button className="btn-primary" onClick={openCreate}>
                    <Plus className="w-4 h-4" /> Add Transaction
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
                        {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <input type="date" className="input text-sm" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
                    <input type="date" className="input text-sm" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
                    <div className="card p-6 w-full max-w-lg animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">{editingFund ? 'Edit Transaction' : 'Add Transaction'}</h3>
                            <button onClick={closeModal}><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="label">Description <span className="text-red-500">*</span></label>
                                <input className="input" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Type <span className="text-red-500">*</span></label>
                                    <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
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
                                    <label className="label">Category <span className="text-red-500">*</span></label>
                                    <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                                        {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Date <span className="text-red-500">*</span></label>
                                    <input type="date" className="input" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="label">Amount <span className="text-red-500">*</span></label>
                                <input className="input" required placeholder="Example: 82000000 or 82M" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                                {form.amount && (
                                    <div className="mt-1 text-xs" style={{ color: Number.isNaN(parsedAmount) ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                                        {Number.isNaN(parsedAmount) ? 'Invalid amount format' : amountPreview}
                                    </div>
                                )}
                            </div>
                            <button type="submit" className="btn-primary w-full" disabled={createMut.isPending || updateMut.isPending}>
                                {editingFund ? 'Save Changes' : 'Add Transaction'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="card h-16 animate-pulse bg-gray-100" />)}</div>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="card p-4">
                            <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Buy</div>
                            <div className="text-2xl font-bold" style={{ color: 'var(--color-danger)' }}>{formatAmount(summary.buy)}</div>
                        </div>
                        <div className="card p-4">
                            <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Sell</div>
                            <div className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>{formatAmount(summary.sell)}</div>
                        </div>
                        <div className="card p-4">
                            <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Top-up</div>
                            <div className="text-2xl font-bold" style={{ color: '#2563eb' }}>{formatAmount(summary.topUp)}</div>
                        </div>
                        <div className="card p-4">
                            <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Net ({funds.length} items)</div>
                            <div className="text-2xl font-bold" style={{ color: summary.net < 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{formatAmount(summary.net)}</div>
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
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedFunds.map((fund: any) => {
                                        const tone = fund.type === 'BUY' ? 'var(--color-danger)' : fund.type === 'SELL' ? 'var(--color-success)' : '#2563eb';
                                        return (
                                            <tr key={fund.id}>
                                                <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{format(new Date(fund.date), 'MMM d, yyyy')}</td>
                                                <td><span className="badge badge-primary">{typeOptions.find((option) => option.value === fund.type)?.label || fund.type}</span></td>
                                                <td><span className="badge badge-warning">{scopeOptions.find((option) => option.value === fund.scope)?.label || fund.scope}</span></td>
                                                <td><span className="badge-success">{categoryOptions.find((option) => option.value === fund.category)?.label || fund.category}</span></td>
                                                <td>
                                                    <div className="font-medium" style={{ color: 'var(--color-text)' }}>{fund.description}</div>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <button type="button" className="inline-flex items-center gap-1 text-sm hover:opacity-80" style={{ color: 'var(--color-text-secondary)' }} onClick={() => openEdit(fund)}>
                                                            <Pencil className="w-3.5 h-3.5" /> Edit
                                                        </button>
                                                        <button type="button" className="inline-flex items-center gap-1 text-sm hover:opacity-80" style={{ color: 'var(--color-danger)' }} onClick={() => handleDelete(fund.id)}>
                                                            <Trash2 className="w-3.5 h-3.5" /> Delete
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="text-right font-semibold" style={{ color: tone }}>{formatAmount(fund.amount)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
