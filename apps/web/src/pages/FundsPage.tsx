import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Coins, Filter, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { format } from 'date-fns';
import api from '../api/client';
import PaginationControls from '../components/PaginationControls';
import { parseCompactAmountInput } from '../utils/amount';
import { useAuthStore } from '../stores/auth';
import {
    DEFAULT_FUNDS_FILTERS,
    FUNDS_CATEGORY_OPTIONS,
    FUNDS_CONDITION_OPTIONS,
    FUNDS_SCOPE_OPTIONS,
    FUNDS_TYPE_OPTIONS,
} from '../config/fundsFilters';

const typeOptions = [...FUNDS_TYPE_OPTIONS];
const scopeOptions = [...FUNDS_SCOPE_OPTIONS];
const categoryOptions = [...FUNDS_CATEGORY_OPTIONS];
const conditionOptions = [...FUNDS_CONDITION_OPTIONS];

const columns = [
    { key: 'date', label: 'Date' },
    { key: 'type', label: 'Type' },
    { key: 'scope', label: 'Scope' },
    { key: 'category', label: 'Category' },
    { key: 'condition', label: 'Condition' },
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount' },
] as const;

type SortKey = typeof columns[number]['key'];
type SortOrder = 'asc' | 'desc';

const csvHeaderMap: Record<string, string> = {
    date: 'date',
    type: 'type',
    scope: 'scope',
    category: 'category',
    condition: 'condition',
    description: 'description',
    amount: 'amount',
};

const formatAmount = (amount: number) => `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)} VND`;

const parseAmountInput = parseCompactAmountInput;

const getTypeBadgeStyle = (type: string) => {
    if (type === 'SELL') {
        return {
            color: '#15803d',
            backgroundColor: '#dcfce7',
        };
    }
    if (type === 'TOP_UP') {
        return {
            color: '#2563eb',
            backgroundColor: '#dbeafe',
        };
    }
    return undefined;
};

const normalizeConditionForType = (type: string, condition: string | null | undefined) => {
    if (type !== 'BUY') {
        return '';
    }

    return condition || 'USED';
};

const parseCSV = (text: string): { headers: string[]; rows: string[][] } => {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (!lines.length) return { headers: [], rows: [] };

    const parseLine = (line: string): string[] => {
        const columns: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i += 1) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i += 1;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                columns.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        columns.push(current.trim());
        return columns;
    };

    return {
        headers: parseLine(lines[0]),
        rows: lines.slice(1).map(parseLine),
    };
};

const emptyForm = () => ({
    description: '',
    type: 'BUY',
    scope: 'MECHANICAL_KEYBOARD',
    category: 'KEYCAP',
    condition: 'USED',
    keyboardItemId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
});

export default function FundsPage() {
    const qc = useQueryClient();
    const { user } = useAuthStore();
    const [showModal, setShowModal] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [editingFund, setEditingFund] = useState<any>(null);
    const [filters, setFilters] = useState({ ...DEFAULT_FUNDS_FILTERS });
    const [form, setForm] = useState(emptyForm());
    const [sortBy, setSortBy] = useState<SortKey>('date');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    const queryParams = new URLSearchParams();
    queryParams.set('page', String(page));
    queryParams.set('limit', String(pageSize));
    if (filters.type) queryParams.set('type', filters.type);
    if (filters.scope) queryParams.set('scope', filters.scope);
    if (filters.category) queryParams.set('category', filters.category);
    if (filters.condition) queryParams.set('condition', filters.condition);
    if (filters.dateFrom) queryParams.set('dateFrom', new Date(`${filters.dateFrom}T00:00:00`).toISOString());
    if (filters.dateTo) queryParams.set('dateTo', new Date(`${filters.dateTo}T23:59:59.999`).toISOString());

    const { data, isLoading } = useQuery({
        queryKey: ['funds', filters, page, pageSize],
        queryFn: async () => (await api.get(`/funds?${queryParams}`)).data,
    });
    const { data: keyboardData } = useQuery({
        queryKey: ['keyboard-options'],
        queryFn: async () => (await api.get('/keyboards?page=1&limit=100')).data,
        enabled: showModal,
    });

    const createMut = useMutation({
        mutationFn: (body: any) => api.post('/funds', body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['funds'] });
            qc.invalidateQueries({ queryKey: ['keyboards'] });
            closeModal();
        },
        onError: (error: any) => {
            window.alert(error?.response?.data?.message || 'Failed to create transaction');
        },
    });

    const updateMut = useMutation({
        mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/funds/${id}`, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['funds'] });
            closeModal();
        },
        onError: (error: any) => {
            window.alert(error?.response?.data?.message || 'Failed to update transaction');
        },
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => api.delete(`/funds/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['funds'] }),
    });
    const importMut = useMutation({
        mutationFn: (items: any[]) => api.post('/funds/import', { items }),
        onSuccess: ({ data }) => {
            qc.invalidateQueries({ queryKey: ['funds'] });
            setShowImport(false);
            window.alert(`Imported ${data.data.created} transactions`);
        },
    });

    const funds = data?.data || [];
    const keyboardOptions = (keyboardData?.data || []).filter((item: any) => item.ownerId === user?.id);
    const meta = data?.meta;
    const totalPages = meta?.totalPages || 1;
    const totalItems = meta?.total || funds.length;

    useEffect(() => {
        setPage(1);
    }, [filters, pageSize]);

    const sortedFunds = useMemo(() => {
        const getValue = (fund: any, key: SortKey) => {
            switch (key) {
                case 'date': return new Date(fund.date).getTime();
                case 'type': return fund.type || '';
                case 'scope': return fund.scope || '';
                case 'category': return fund.category || '';
                case 'condition': return fund.condition || '';
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
            condition: normalizeConditionForType(fund.type || 'BUY', fund.condition),
            keyboardItemId: '',
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
        if (!editingFund && form.scope === 'MECHANICAL_KEYBOARD' && form.type === 'SELL' && !form.keyboardItemId) {
            window.alert('Please select the keyboard item you want to remove.');
            return;
        }

        const payload = {
            ...form,
            condition: form.type === 'BUY' ? (form.condition || null) : null,
            keyboardItemName: form.keyboardItemId
                ? keyboardOptions.find((item: any) => item.id === form.keyboardItemId)?.name || null
                : form.description,
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
                <div className="flex items-center gap-2">
                    <button className="btn-secondary" onClick={() => setShowImport(true)}>
                        <Upload className="w-4 h-4" /> Import CSV
                    </button>
                    <button className="btn-primary" onClick={openCreate}>
                        <Plus className="w-4 h-4" /> Add Transaction
                    </button>
                </div>
            </div>

            <div className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Filter className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Filters</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
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
                    <select className="input text-sm" value={filters.condition} onChange={(e) => setFilters({ ...filters, condition: e.target.value })}>
                        <option value="">All Conditions</option>
                        {conditionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
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
                                    <select
                                        className="input"
                                        value={form.type}
                                        onChange={(e) => setForm({
                                            ...form,
                                            type: e.target.value,
                                            condition: normalizeConditionForType(e.target.value, form.condition),
                                            keyboardItemId: e.target.value === 'SELL' ? form.keyboardItemId : '',
                                        })}
                                    >
                                        {typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Scope <span className="text-red-500">*</span></label>
                                    <select className="input" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value, keyboardItemId: e.target.value === 'MECHANICAL_KEYBOARD' ? form.keyboardItemId : '' })}>
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
                                    <label className="label">Condition {form.type === 'BUY' && <span className="text-red-500">*</span>}</label>
                                    <select
                                        className="input disabled:opacity-50 disabled:cursor-not-allowed"
                                        value={form.condition}
                                        disabled={form.type !== 'BUY'}
                                        onChange={(e) => setForm({ ...form, condition: e.target.value })}
                                    >
                                        {form.type === 'BUY' && <option value="">Select condition</option>}
                                        {conditionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                    </select>
                                </div>
                                {form.scope === 'MECHANICAL_KEYBOARD' && form.type === 'SELL' && (
                                    <div className="md:col-span-2">
                                        <label className="label">Keyboard Item <span className="text-red-500">*</span></label>
                                        <select className="input" value={form.keyboardItemId} onChange={(e) => setForm({ ...form, keyboardItemId: e.target.value })}>
                                            <option value="">Select keyboard item</option>
                                            {keyboardOptions.map((item: any) => (
                                                <option key={item.id} value={item.id}>{item.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div>
                                    <label className="label">Date <span className="text-red-500">*</span></label>
                                    <input type="date" className="input" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="label">Amount <span className="text-red-500">*</span></label>
                                <input className="input" required placeholder="Example: 82000000, 600k, or 82M" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                                {form.amount && (
                                    <div className="mt-1 text-xs" style={{ color: Number.isNaN(parsedAmount) ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                                        {Number.isNaN(parsedAmount) ? 'Invalid amount format' : amountPreview}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center justify-between gap-3 pt-2">
                                <div>
                                    {editingFund && (
                                        <button
                                            type="button"
                                            className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white"
                                            onClick={() => {
                                                if (window.confirm('Delete this fund transaction?')) {
                                                    deleteMut.mutate(editingFund.id);
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
                                        {editingFund ? 'Save' : 'Add Transaction'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showImport && (
                <FundImportModal
                    loading={importMut.isPending}
                    onClose={() => setShowImport(false)}
                    onImport={(items) => importMut.mutate(items)}
                />
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
                                    {sortedFunds.map((fund: any, index: number) => {
                                        const tone = fund.type === 'BUY' ? 'var(--color-danger)' : fund.type === 'SELL' ? 'var(--color-success)' : '#2563eb';
                                        return (
                                            <tr
                                                key={fund.id}
                                                onDoubleClick={() => openEdit(fund)}
                                                className={`cursor-pointer ${index % 2 === 0 ? 'bg-[#ecfdf5]' : 'bg-white'} hover:bg-[#d1fae5] transition-colors`}
                                            >
                                                <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{format(new Date(fund.date), 'MMM d, yyyy')}</td>
                                                <td>
                                                    <span className="badge badge-primary" style={getTypeBadgeStyle(fund.type)}>
                                                        {typeOptions.find((option) => option.value === fund.type)?.label || fund.type}
                                                    </span>
                                                </td>
                                                <td><span className="badge badge-warning">{scopeOptions.find((option) => option.value === fund.scope)?.label || fund.scope}</span></td>
                                                <td><span className="badge-success">{categoryOptions.find((option) => option.value === fund.category)?.label || fund.category}</span></td>
                                                <td><span className="badge badge-secondary">{fund.type === 'BUY' ? (conditionOptions.find((option) => option.value === fund.condition)?.label || fund.condition || '—') : '—'}</span></td>
                                                <td>
                                                    <div className="font-medium" style={{ color: 'var(--color-text)' }}>{fund.description}</div>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <button type="button" className="inline-flex items-center gap-1 text-sm hover:opacity-80" style={{ color: 'var(--color-text-secondary)' }} onClick={(e) => { e.stopPropagation(); openEdit(fund); }}>
                                                            <Pencil className="w-3.5 h-3.5" /> Edit
                                                        </button>
                                                        <button type="button" className="inline-flex items-center gap-1 text-sm hover:opacity-80" style={{ color: 'var(--color-danger)' }} onClick={(e) => { e.stopPropagation(); handleDelete(fund.id); }}>
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

function FundImportModal({
    onImport,
    onClose,
    loading,
}: {
    onImport: (items: any[]) => void;
    onClose: () => void;
    loading: boolean;
}) {
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvRows, setCsvRows] = useState<string[][]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});

    const fieldTargets = [
        { key: '', label: '— skip —' },
        { key: 'date', label: 'Date' },
        { key: 'type', label: 'Type' },
        { key: 'scope', label: 'Scope' },
        { key: 'category', label: 'Category' },
        { key: 'condition', label: 'Condition' },
        { key: 'description', label: 'Description' },
        { key: 'amount', label: 'Amount' },
    ];

    function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            const { headers, rows } = parseCSV(loadEvent.target?.result as string);
            setCsvHeaders(headers);
            setCsvRows(rows);

            const nextMapping: Record<string, string> = {};
            headers.forEach((header) => {
                const normalized = header.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
                nextMapping[header] = csvHeaderMap[normalized] ?? '';
            });
            setMapping(nextMapping);
        };
        reader.readAsText(file);
    }

    function buildItem(row: string[]) {
        const item: any = {
            date: '',
            type: 'BUY',
            scope: 'MECHANICAL_KEYBOARD',
            category: 'OTHER',
            condition: '',
            description: '',
            amount: '',
        };

        csvHeaders.forEach((header, index) => {
            const target = mapping[header];
            if (!target) return;
            item[target] = row[index] ?? '';
        });

        return item;
    }

    const preview = csvRows.slice(0, 3).map((row) => buildItem(row));

    function handleImport() {
        const items = csvRows.map((row) => {
            const item = buildItem(row);
            return {
                ...item,
                condition: normalizeConditionForType(String(item.type || 'BUY').toUpperCase().replace(/[\s-]+/g, '_'), item.condition),
            };
        }).filter((item) => item.description);
        onImport(items);
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <h2 className="text-lg font-bold mb-1 text-gray-900 dark:text-white">Import Funds from CSV</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Upload a CSV file, map each column, then import your fund transactions.</p>

                    {!csvHeaders.length ? (
                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-10 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                            <Upload className="w-8 h-8 text-gray-400 mb-2" />
                            <span className="text-sm text-gray-500">Click to select CSV file</span>
                            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
                        </label>
                    ) : (
                        <>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{csvRows.length} rows · Map columns:</p>
                            <div className="space-y-1.5 mb-4">
                                {csvHeaders.map((header) => (
                                    <div key={header} className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500 w-36 truncate flex-shrink-0" title={header}>{header}</span>
                                        <span className="text-gray-300 flex-shrink-0">→</span>
                                        <select
                                            value={mapping[header] ?? ''}
                                            onChange={(event) => setMapping((current) => ({ ...current, [header]: event.target.value }))}
                                            className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 bg-white dark:bg-gray-800"
                                        >
                                            {fieldTargets.map((target) => <option key={target.key} value={target.key}>{target.label}</option>)}
                                        </select>
                                    </div>
                                ))}
                            </div>

                            {preview.length > 0 && (
                                <div className="mb-4">
                                    <p className="text-xs font-medium text-gray-500 mb-1">Preview (first {preview.length} rows):</p>
                                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                                        <table className="text-xs w-full">
                                            <thead className="bg-gray-50 dark:bg-gray-800">
                                                <tr>
                                                    <th className="px-2 py-1 text-left font-medium text-gray-500">Date</th>
                                                    <th className="px-2 py-1 text-left font-medium text-gray-500">Type</th>
                                                    <th className="px-2 py-1 text-left font-medium text-gray-500">Scope</th>
                                                    <th className="px-2 py-1 text-left font-medium text-gray-500">Category</th>
                                                    <th className="px-2 py-1 text-left font-medium text-gray-500">Condition</th>
                                                    <th className="px-2 py-1 text-left font-medium text-gray-500">Description</th>
                                                    <th className="px-2 py-1 text-right font-medium text-gray-500">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {preview.map((item, index) => (
                                                    <tr key={index} className="border-t border-gray-100 dark:border-gray-800">
                                                        <td className="px-2 py-1 text-gray-600">{item.date || '—'}</td>
                                                        <td className="px-2 py-1 text-gray-600">{item.type || '—'}</td>
                                                        <td className="px-2 py-1 text-gray-600">{item.scope || '—'}</td>
                                                        <td className="px-2 py-1 text-gray-600">{item.category || '—'}</td>
                                                        <td className="px-2 py-1 text-gray-600">{item.condition || '—'}</td>
                                                        <td className="px-2 py-1 font-medium">{item.description || <span className="text-red-400">⚠ empty</span>}</td>
                                                        <td className="px-2 py-1 text-right text-gray-600">{item.amount || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    <div className="flex gap-2 justify-end mt-4">
                        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
                        {csvRows.length > 0 && (
                            <button onClick={handleImport} disabled={loading} className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
                                {loading ? 'Importing…' : `Import ${csvRows.length} rows`}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
