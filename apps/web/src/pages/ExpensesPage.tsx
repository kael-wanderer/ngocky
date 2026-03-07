import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { DollarSign, Plus, X, Filter } from 'lucide-react';
import { format } from 'date-fns';

const categories = ['Food', 'Utilities', 'Health', 'Shopping', 'Transport', 'Entertainment', 'Education', 'Other'];
const formatVND = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);

export default function ExpensesPage() {
    const qc = useQueryClient();
    const [showCreate, setShowCreate] = useState(false);
    const [filters, setFilters] = useState({ category: '', scope: '', dateFrom: '', dateTo: '' });
    const [form, setForm] = useState({ description: '', amount: '', category: 'Food', scope: 'PERSONAL', date: format(new Date(), 'yyyy-MM-dd'), note: '' });

    const queryParams = new URLSearchParams();
    queryParams.set('limit', '50');
    if (filters.category) queryParams.set('category', filters.category);
    if (filters.scope) queryParams.set('scope', filters.scope);
    if (filters.dateFrom) queryParams.set('dateFrom', new Date(filters.dateFrom).toISOString());
    if (filters.dateTo) queryParams.set('dateTo', new Date(filters.dateTo).toISOString());

    const { data, isLoading } = useQuery({
        queryKey: ['expenses', filters],
        queryFn: async () => (await api.get(`/expenses?${queryParams}`)).data,
    });

    const createMut = useMutation({
        mutationFn: (body: any) => api.post('/expenses', body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); setShowCreate(false); },
    });

    const expenses = data?.data || [];
    const total = expenses.reduce((s: number, e: any) => s + e.amount, 0);

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <DollarSign className="w-6 h-6" style={{ color: '#d97706' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Expenses</h2>
                </div>
                <button className="btn-primary" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> Add Expense</button>
            </div>

            {/* Filters */}
            <div className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Filter className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Filters</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <select className="input text-sm" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
                        <option value="">All Categories</option>
                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select className="input text-sm" value={filters.scope} onChange={(e) => setFilters({ ...filters, scope: e.target.value })}>
                        <option value="">All Scopes</option>
                        <option value="PERSONAL">Personal</option>
                        <option value="FAMILY">Family</option>
                    </select>
                    <input type="date" className="input text-sm" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} placeholder="From" />
                    <input type="date" className="input text-sm" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} placeholder="To" />
                </div>
            </div>

            {/* Total */}
            <div className="card p-4 flex items-center justify-between">
                <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>Total ({expenses.length} items)</span>
                <span className="text-xl font-bold" style={{ color: 'var(--color-danger)' }}>{formatVND(total)}</span>
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCreate(false)}>
                    <div className="card p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Add Expense</h3>
                            <button onClick={() => setShowCreate(false)}><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            createMut.mutate({ ...form, amount: parseFloat(form.amount), date: new Date(form.date).toISOString() });
                        }} className="space-y-4">
                            <div><label className="label">Description <span className="text-red-500">*</span></label><input className="input" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="label">Amount (VND) <span className="text-red-500">*</span></label><input type="number" step="1000" min="0" className="input" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                                <div><label className="label">Date <span className="text-red-500">*</span></label><input type="date" className="input" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Category <span className="text-red-500">*</span></label>
                                    <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                                        {categories.map((c) => <option key={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Scope <span className="text-red-500">*</span></label>
                                    <select className="input" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
                                        <option value="PERSONAL">Personal</option>
                                        <option value="FAMILY">Family</option>
                                    </select>
                                </div>
                            </div>
                            <div><label className="label">Note</label><input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
                            <button type="submit" className="btn-primary w-full" disabled={createMut.isPending}>Add Expense</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Expense List */}
            {isLoading ? (
                <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="card h-16 animate-pulse bg-gray-100" />)}</div>
            ) : (
                <div className="card overflow-hidden">
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr><th>Date</th><th>Description</th><th>Category</th><th>Scope</th><th>User</th><th className="text-right">Amount</th></tr>
                            </thead>
                            <tbody>
                                {expenses.map((e: any) => (
                                    <tr key={e.id}>
                                        <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{format(new Date(e.date), 'MMM d')}</td>
                                        <td className="font-medium" style={{ color: 'var(--color-text)' }}>{e.description}</td>
                                        <td><span className="badge-primary">{e.category || '-'}</span></td>
                                        <td><span className={`badge ${e.scope === 'FAMILY' ? 'badge-success' : 'badge-warning'}`}>{e.scope}</span></td>
                                        <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{e.user?.name}</td>
                                        <td className="text-right font-semibold" style={{ color: 'var(--color-danger)' }}>{formatVND(e.amount)}</td>
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
