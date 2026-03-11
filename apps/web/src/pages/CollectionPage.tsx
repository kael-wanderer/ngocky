import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { ChevronDown, ChevronRight, Filter, FolderOpen, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useAuthStore } from '../stores/auth';

// ─── Types ───────────────────────────────────────────

type FieldType = 'text' | 'number' | 'select' | 'multiselect' | 'url';

interface FieldDef {
    key: string;
    label: string;
    type: FieldType;
    options?: string[];
    width?: number;
}

interface Collection {
    id: string;
    name: string;
    description?: string;
    fieldSchema: FieldDef[];
    isShared: boolean;
    ownerId: string;
    _count?: { items: number };
}

interface CollectionItem {
    id: string;
    collectionId: string;
    name: string;
    price?: number | null;
    status?: string | null;
    imageUrl?: string | null;
    data: Record<string, any>;
    sortOrder: number;
}

interface CollectionView {
    id: string;
    name: string;
    filters: FilterCondition[];
    sort: { field?: string; dir?: 'asc' | 'desc' };
    groupBy?: string | null;
    visibleFields: string[];
}

interface FilterCondition {
    field: string;
    op: string;
    value: any;
}

// ─── Helpers ─────────────────────────────────────────

const formatVND = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

const FILTER_OPS: Record<FieldType, { op: string; label: string }[]> = {
    text: [{ op: 'contains', label: 'contains' }, { op: 'eq', label: 'equals' }],
    number: [{ op: 'eq', label: '=' }, { op: 'gte', label: '>=' }, { op: 'lte', label: '<=' }],
    select: [{ op: 'eq', label: 'is' }, { op: 'neq', label: 'is not' }],
    multiselect: [{ op: 'has', label: 'has' }, { op: 'in', label: 'any of' }],
    url: [{ op: 'contains', label: 'contains' }],
};

function emptyItem(): Partial<CollectionItem> {
    return { name: '', price: undefined, status: '', data: {} };
}

function renderCellValue(field: FieldDef, val: any): React.ReactNode {
    if (val == null || val === '') return <span className="text-gray-400 text-xs">—</span>;
    if (field.type === 'multiselect' && Array.isArray(val)) {
        return (
            <div className="flex flex-wrap gap-1">
                {(val as string[]).map(v => (
                    <span key={v} className="px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200">{v}</span>
                ))}
            </div>
        );
    }
    if (field.type === 'select') {
        return <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">{String(val)}</span>;
    }
    if (field.type === 'url') {
        return <a href={String(val)} target="_blank" rel="noreferrer" className="text-blue-500 underline text-xs truncate max-w-[120px]">{String(val)}</a>;
    }
    return <span className="text-sm">{String(val)}</span>;
}

// ─── Main Page ───────────────────────────────────────

export default function CollectionPage() {
    const qc = useQueryClient();
    const { user } = useAuthStore();

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [activeViewId, setActiveViewId] = useState<string | null>(null);
    const [showCollectionModal, setShowCollectionModal] = useState(false);
    const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
    const [showItemModal, setShowItemModal] = useState(false);
    const [editingItem, setEditingItem] = useState<CollectionItem | null>(null);
    const [itemForm, setItemForm] = useState<any>(emptyItem());
    const [showFilterBar, setShowFilterBar] = useState(false);
    const [activeFilters, setActiveFilters] = useState<FilterCondition[]>([]);
    const [showViewModal, setShowViewModal] = useState(false);
    const [editingView, setEditingView] = useState<CollectionView | null>(null);
    const [showSchemaEditor, setShowSchemaEditor] = useState(false);

    // Queries
    const { data: collections = [] } = useQuery<Collection[]>({
        queryKey: ['collections'],
        queryFn: async () => (await api.get('/collections')).data.data,
    });

    const selectedCollection = collections.find(c => c.id === selectedId) ?? null;
    const fieldSchema: FieldDef[] = selectedCollection?.fieldSchema ?? [];

    const { data: items = [] } = useQuery<CollectionItem[]>({
        queryKey: ['collection-items', selectedId, activeFilters],
        queryFn: async () => {
            const params = activeFilters.length ? `?filters=${encodeURIComponent(JSON.stringify(activeFilters))}` : '';
            return (await api.get(`/collections/${selectedId}/items${params}`)).data.data;
        },
        enabled: !!selectedId,
    });

    const { data: views = [] } = useQuery<CollectionView[]>({
        queryKey: ['collection-views', selectedId],
        queryFn: async () => (await api.get(`/collections/${selectedId}/views`)).data.data,
        enabled: !!selectedId,
    });

    const activeView = views.find(v => v.id === activeViewId) ?? null;

    // Visible columns: respect view's visibleFields if set
    const visibleFields: FieldDef[] = activeView?.visibleFields?.length
        ? fieldSchema.filter(f => activeView.visibleFields.includes(f.key))
        : fieldSchema;

    // Sort items
    const sortedItems = React.useMemo(() => {
        const sort = activeView?.sort;
        if (!sort?.field) return items;
        return [...items].sort((a, b) => {
            const av = sort.field === 'name' || sort.field === 'price' ? (a as any)[sort.field!] : a.data[sort.field!];
            const bv = sort.field === 'name' || sort.field === 'price' ? (b as any)[sort.field!] : b.data[sort.field!];
            if (av == null) return 1;
            if (bv == null) return -1;
            const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
            return sort.dir === 'desc' ? -cmp : cmp;
        });
    }, [items, activeView]);

    // Mutations — Collections
    const createCollMut = useMutation({
        mutationFn: (body: any) => api.post('/collections', body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['collections'] }); setShowCollectionModal(false); },
    });
    const updateCollMut = useMutation({
        mutationFn: ({ id, body }: any) => api.patch(`/collections/${id}`, body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['collections'] }); setShowCollectionModal(false); setShowSchemaEditor(false); },
    });
    const deleteCollMut = useMutation({
        mutationFn: (id: string) => api.delete(`/collections/${id}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['collections'] }); setSelectedId(null); },
    });

    // Mutations — Items
    const createItemMut = useMutation({
        mutationFn: (body: any) => api.post(`/collections/${selectedId}/items`, body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['collection-items', selectedId] }); closeItemModal(); },
    });
    const updateItemMut = useMutation({
        mutationFn: ({ id, body }: any) => api.patch(`/collections/${selectedId}/items/${id}`, body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['collection-items', selectedId] }); closeItemModal(); },
    });
    const deleteItemMut = useMutation({
        mutationFn: (id: string) => api.delete(`/collections/${selectedId}/items/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['collection-items', selectedId] }),
    });

    // Mutations — Views
    const createViewMut = useMutation({
        mutationFn: (body: any) => api.post(`/collections/${selectedId}/views`, body),
        onSuccess: ({ data }) => { qc.invalidateQueries({ queryKey: ['collection-views', selectedId] }); setActiveViewId(data.data.id); setShowViewModal(false); },
    });
    const updateViewMut = useMutation({
        mutationFn: ({ id, body }: any) => api.patch(`/collections/${selectedId}/views/${id}`, body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['collection-views', selectedId] }); setShowViewModal(false); },
    });
    const deleteViewMut = useMutation({
        mutationFn: (id: string) => api.delete(`/collections/${selectedId}/views/${id}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['collection-views', selectedId] }); setActiveViewId(null); },
    });

    function openNewItem() {
        setEditingItem(null);
        setItemForm({ name: '', price: '', status: '', data: {} });
        setShowItemModal(true);
    }
    function openEditItem(item: CollectionItem) {
        setEditingItem(item);
        setItemForm({ name: item.name, price: item.price ?? '', status: item.status ?? '', data: item.data ?? {} });
        setShowItemModal(true);
    }
    function closeItemModal() {
        setShowItemModal(false);
        setEditingItem(null);
    }
    function submitItem() {
        const body = {
            name: itemForm.name,
            price: itemForm.price !== '' ? Number(itemForm.price) : null,
            status: itemForm.status || null,
            data: itemForm.data,
        };
        if (editingItem) updateItemMut.mutate({ id: editingItem.id, body });
        else createItemMut.mutate(body);
    }

    function applyView(view: CollectionView | null) {
        setActiveViewId(view?.id ?? null);
        setActiveFilters(view?.filters ?? []);
    }

    function saveCurrentAsView(name: string) {
        createViewMut.mutate({ name, filters: activeFilters, sort: activeView?.sort ?? {}, visibleFields: activeView?.visibleFields ?? [] });
    }

    const totalValue = items.reduce((s, i) => s + (i.price ?? 0), 0);
    const isOwner = selectedCollection?.ownerId === user?.id;

    return (
        <div className="flex h-full overflow-hidden">
            {/* ── Left sidebar: collection list ── */}
            <div className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-gray-800/50">
                <div className="p-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
                    <span className="font-semibold text-sm text-gray-700 dark:text-gray-200">Collections</span>
                    <button onClick={() => { setEditingCollection(null); setShowCollectionModal(true); }} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
                        <Plus className="w-4 h-4 text-gray-500" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto py-1">
                    {collections.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-6 px-2">No collections yet</p>
                    )}
                    {collections.map(col => (
                        <button
                            key={col.id}
                            onClick={() => { setSelectedId(col.id); setActiveViewId(null); setActiveFilters([]); }}
                            className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 ${selectedId === col.id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                        >
                            <FolderOpen className="w-4 h-4 flex-shrink-0" />
                            <span className="flex-1 truncate">{col.name}</span>
                            <span className="text-xs text-gray-400">{col._count?.items ?? 0}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Main content ── */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {!selectedCollection ? (
                    <div className="flex-1 flex items-center justify-center text-gray-400">
                        <div className="text-center">
                            <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>Select a collection</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="px-4 pt-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">{selectedCollection.name}</h1>
                                    {selectedCollection.description && (
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{selectedCollection.description}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {isOwner && (
                                        <>
                                            <button onClick={() => setShowSchemaEditor(true)} className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                                                Edit Fields
                                            </button>
                                            <button onClick={() => { setEditingCollection(selectedCollection); setShowCollectionModal(true); }} className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                                                <Pencil className="w-3 h-3 inline mr-1" />Edit
                                            </button>
                                            <button onClick={() => { if (confirm('Delete this collection and all items?')) deleteCollMut.mutate(selectedCollection.id); }} className="text-xs px-2 py-1 rounded border border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600">
                                                <Trash2 className="w-3 h-3 inline mr-1" />Delete
                                            </button>
                                        </>
                                    )}
                                    <button onClick={openNewItem} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg">
                                        <Plus className="w-4 h-4" />Add Item
                                    </button>
                                </div>
                            </div>

                            {/* View tabs */}
                            <div className="flex items-center gap-1 overflow-x-auto">
                                <button
                                    onClick={() => applyView(null)}
                                    className={`px-3 py-1 text-sm rounded-t border-b-2 whitespace-nowrap ${!activeViewId ? 'border-blue-500 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                                >
                                    All items
                                </button>
                                {views.map(v => (
                                    <button
                                        key={v.id}
                                        onClick={() => applyView(v)}
                                        className={`px-3 py-1 text-sm rounded-t border-b-2 whitespace-nowrap ${activeViewId === v.id ? 'border-blue-500 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                                    >
                                        {v.name}
                                    </button>
                                ))}
                                <button onClick={() => { setEditingView(null); setShowViewModal(true); }} className="px-2 py-1 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 whitespace-nowrap">
                                    + View
                                </button>
                            </div>
                        </div>

                        {/* Toolbar */}
                        <div className="px-4 py-2 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
                            <button
                                onClick={() => setShowFilterBar(s => !s)}
                                className={`flex items-center gap-1 px-2 py-1 text-xs rounded border ${showFilterBar || activeFilters.length ? 'border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                            >
                                <Filter className="w-3.5 h-3.5" />
                                Filter {activeFilters.length > 0 && <span className="ml-0.5 font-bold">({activeFilters.length})</span>}
                            </button>
                            {activeFilters.length > 0 && (
                                <button onClick={() => setActiveFilters([])} className="text-xs text-gray-400 hover:text-red-500">
                                    Clear filters
                                </button>
                            )}
                            <div className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                                {sortedItems.length} items
                                {totalValue > 0 && <> · Total: <strong>{formatVND(totalValue)} ₫</strong></>}
                            </div>
                        </div>

                        {/* Filter bar */}
                        {showFilterBar && (
                            <FilterBar
                                fieldSchema={fieldSchema}
                                filters={activeFilters}
                                onChange={setActiveFilters}
                                onSaveAsView={() => {
                                    const name = prompt('View name?');
                                    if (name) saveCurrentAsView(name);
                                }}
                            />
                        )}

                        {/* Table */}
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-800">
                                    <tr>
                                        <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 w-48">Name</th>
                                        <th className="text-right px-3 py-2 font-medium text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 w-28">Price</th>
                                        {visibleFields.map(f => (
                                            <th key={f.key} className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap" style={{ minWidth: f.width ?? 100 }}>
                                                {f.label}
                                            </th>
                                        ))}
                                        <th className="w-16 border-b border-gray-200 dark:border-gray-700" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedItems.length === 0 && (
                                        <tr>
                                            <td colSpan={visibleFields.length + 3} className="text-center py-10 text-gray-400">
                                                No items found
                                            </td>
                                        </tr>
                                    )}
                                    {sortedItems.map(item => (
                                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                                            <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{item.name}</td>
                                            <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300 tabular-nums">
                                                {item.price != null ? `${formatVND(item.price)} ₫` : <span className="text-gray-300">—</span>}
                                            </td>
                                            {visibleFields.map(f => (
                                                <td key={f.key} className="px-3 py-2">{renderCellValue(f, item.data[f.key])}</td>
                                            ))}
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100">
                                                    <button onClick={() => openEditItem(item)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
                                                        <Pencil className="w-3.5 h-3.5 text-gray-400" />
                                                    </button>
                                                    <button onClick={() => { if (confirm('Delete item?')) deleteItemMut.mutate(item.id); }} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20">
                                                        <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* ── Modals ── */}
            {showCollectionModal && (
                <CollectionModal
                    initial={editingCollection}
                    onSave={body => {
                        if (editingCollection) updateCollMut.mutate({ id: editingCollection.id, body });
                        else createCollMut.mutate(body);
                    }}
                    onClose={() => setShowCollectionModal(false)}
                />
            )}

            {showItemModal && selectedCollection && (
                <ItemModal
                    fieldSchema={fieldSchema}
                    form={itemForm}
                    setForm={setItemForm}
                    editing={!!editingItem}
                    onSave={submitItem}
                    onClose={closeItemModal}
                />
            )}

            {showViewModal && selectedId && (
                <ViewModal
                    initial={editingView}
                    fieldSchema={fieldSchema}
                    currentFilters={activeFilters}
                    onSave={body => {
                        if (editingView) updateViewMut.mutate({ id: editingView.id, body });
                        else createViewMut.mutate(body);
                    }}
                    onDelete={editingView ? () => deleteViewMut.mutate(editingView.id) : undefined}
                    onClose={() => setShowViewModal(false)}
                />
            )}

            {showSchemaEditor && selectedCollection && isOwner && (
                <SchemaEditor
                    initial={fieldSchema}
                    onSave={fieldSchema => updateCollMut.mutate({ id: selectedCollection.id, body: { fieldSchema } })}
                    onClose={() => setShowSchemaEditor(false)}
                />
            )}
        </div>
    );
}

// ─── Filter Bar ───────────────────────────────────────

function FilterBar({ fieldSchema, filters, onChange, onSaveAsView }: {
    fieldSchema: FieldDef[];
    filters: FilterCondition[];
    onChange: (f: FilterCondition[]) => void;
    onSaveAsView: () => void;
}) {
    const allFields: FieldDef[] = [
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'price', label: 'Price', type: 'number' },
        ...fieldSchema,
    ];

    function addFilter() {
        const first = allFields[0];
        const defaultOp = FILTER_OPS[first.type]?.[0]?.op ?? 'contains';
        onChange([...filters, { field: first.key, op: defaultOp, value: '' }]);
    }

    function updateFilter(idx: number, patch: Partial<FilterCondition>) {
        const next = filters.map((f, i) => i === idx ? { ...f, ...patch } : f);
        onChange(next);
    }

    function removeFilter(idx: number) {
        onChange(filters.filter((_, i) => i !== idx));
    }

    return (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/30">
            <div className="flex flex-col gap-1.5">
                {filters.map((f, idx) => {
                    const fd = allFields.find(x => x.key === f.field) ?? allFields[0];
                    const ops = FILTER_OPS[fd.type] ?? FILTER_OPS.text;
                    return (
                        <div key={idx} className="flex items-center gap-2 flex-wrap">
                            <select
                                value={f.field}
                                onChange={e => updateFilter(idx, { field: e.target.value, op: FILTER_OPS[(allFields.find(x => x.key === e.target.value)?.type ?? 'text')]?.[0]?.op ?? 'contains', value: '' })}
                                className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 bg-white dark:bg-gray-800"
                            >
                                {allFields.map(af => <option key={af.key} value={af.key}>{af.label}</option>)}
                            </select>
                            <select
                                value={f.op}
                                onChange={e => updateFilter(idx, { op: e.target.value })}
                                className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 bg-white dark:bg-gray-800"
                            >
                                {ops.map(o => <option key={o.op} value={o.op}>{o.label}</option>)}
                            </select>
                            {fd.type === 'select' || fd.type === 'multiselect' ? (
                                <select
                                    value={f.value}
                                    onChange={e => updateFilter(idx, { value: e.target.value })}
                                    className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 bg-white dark:bg-gray-800"
                                >
                                    <option value="">—</option>
                                    {fd.options?.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            ) : (
                                <input
                                    value={f.value}
                                    onChange={e => updateFilter(idx, { value: e.target.value })}
                                    className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 bg-white dark:bg-gray-800 w-32"
                                    placeholder="value"
                                />
                            )}
                            <button onClick={() => removeFilter(idx)} className="text-gray-400 hover:text-red-500">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    );
                })}
                <div className="flex items-center gap-2 mt-0.5">
                    <button onClick={addFilter} className="text-xs text-blue-600 hover:underline">+ Add filter</button>
                    {filters.length > 0 && (
                        <button onClick={onSaveAsView} className="text-xs text-gray-500 hover:underline flex items-center gap-0.5">
                            <Save className="w-3 h-3" />Save as view
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Collection Modal ────────────────────────────────

function CollectionModal({ initial, onSave, onClose }: { initial: Collection | null; onSave: (b: any) => void; onClose: () => void }) {
    const [form, setForm] = useState({ name: initial?.name ?? '', description: initial?.description ?? '', isShared: initial?.isShared ?? false });
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md p-6">
                <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">{initial ? 'Edit Collection' : 'New Collection'}</h2>
                <div className="space-y-3">
                    <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Name <span className="text-red-500">*</span></label>
                        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm" />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                        <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm" />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input type="checkbox" checked={form.isShared} onChange={e => setForm(p => ({ ...p, isShared: e.target.checked }))} />
                        Shared with family
                    </label>
                </div>
                <div className="flex gap-2 justify-end mt-5">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
                    <button onClick={() => form.name && onSave(form)} disabled={!form.name} className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">Save</button>
                </div>
            </div>
        </div>
    );
}

// ─── Item Modal ───────────────────────────────────────

function ItemModal({ fieldSchema, form, setForm, editing, onSave, onClose }: {
    fieldSchema: FieldDef[];
    form: any;
    setForm: (f: any) => void;
    editing: boolean;
    onSave: () => void;
    onClose: () => void;
}) {
    function setData(key: string, val: any) {
        setForm((p: any) => ({ ...p, data: { ...p.data, [key]: val } }));
    }

    function toggleMultiselect(key: string, val: string) {
        const cur: string[] = form.data[key] ?? [];
        const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val];
        setData(key, next);
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">{editing ? 'Edit Item' : 'New Item'}</h2>
                    <div className="space-y-3">
                        {/* Fixed fields */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Name <span className="text-red-500">*</span></label>
                            <input value={form.name} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Price (VND)</label>
                            <input type="number" value={form.price} onChange={e => setForm((p: any) => ({ ...p, price: e.target.value }))} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm" placeholder="e.g. 7800000" />
                        </div>

                        {/* Dynamic fields */}
                        {fieldSchema.map(f => (
                            <div key={f.key}>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{f.label}</label>
                                {f.type === 'text' || f.type === 'url' ? (
                                    <input value={form.data[f.key] ?? ''} onChange={e => setData(f.key, e.target.value)} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm" />
                                ) : f.type === 'number' ? (
                                    <input type="number" value={form.data[f.key] ?? ''} onChange={e => setData(f.key, e.target.value ? Number(e.target.value) : '')} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm" />
                                ) : f.type === 'select' ? (
                                    <select value={form.data[f.key] ?? ''} onChange={e => setData(f.key, e.target.value)} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm">
                                        <option value="">—</option>
                                        {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                ) : f.type === 'multiselect' ? (
                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                        {f.options?.map(o => {
                                            const selected = (form.data[f.key] ?? []).includes(o);
                                            return (
                                                <button key={o} type="button" onClick={() => toggleMultiselect(f.key, o)}
                                                    className={`px-2 py-0.5 rounded text-xs border ${selected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                                                    {o}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : null}
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2 justify-end mt-6">
                        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
                        <button onClick={onSave} disabled={!form.name} className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">Save</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── View Modal ───────────────────────────────────────

function ViewModal({ initial, fieldSchema, currentFilters, onSave, onDelete, onClose }: {
    initial: CollectionView | null;
    fieldSchema: FieldDef[];
    currentFilters: FilterCondition[];
    onSave: (b: any) => void;
    onDelete?: () => void;
    onClose: () => void;
}) {
    const [name, setName] = useState(initial?.name ?? '');
    const [useCurrentFilters, setUseCurrentFilters] = useState(!initial);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-sm p-6">
                <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">{initial ? 'Edit View' : 'New View'}</h2>
                <div className="space-y-3">
                    <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Name <span className="text-red-500">*</span></label>
                        <input value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm" placeholder="e.g. Kits only" />
                    </div>
                    {!initial && currentFilters.length > 0 && (
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <input type="checkbox" checked={useCurrentFilters} onChange={e => setUseCurrentFilters(e.target.checked)} />
                            Save current {currentFilters.length} filter(s)
                        </label>
                    )}
                </div>
                <div className="flex gap-2 justify-between mt-5">
                    <div>
                        {onDelete && (
                            <button onClick={() => { onDelete(); onClose(); }} className="px-3 py-1.5 text-sm rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">Delete view</button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
                        <button onClick={() => name && onSave({ name, filters: useCurrentFilters ? currentFilters : (initial?.filters ?? []) })} disabled={!name} className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">Save</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Schema Editor ────────────────────────────────────

const FIELD_TYPES: { value: FieldType; label: string }[] = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'select', label: 'Select' },
    { value: 'multiselect', label: 'Multi-select' },
    { value: 'url', label: 'URL' },
];

function SchemaEditor({ initial, onSave, onClose }: { initial: FieldDef[]; onSave: (s: FieldDef[]) => void; onClose: () => void }) {
    const [fields, setFields] = useState<FieldDef[]>(initial.map(f => ({ ...f })));
    const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

    function addField() {
        setFields(p => [...p, { key: `field_${Date.now()}`, label: 'New Field', type: 'text' }]);
        setExpandedIdx(fields.length);
    }

    function updateField(idx: number, patch: Partial<FieldDef>) {
        setFields(p => p.map((f, i) => i === idx ? { ...f, ...patch } : f));
    }

    function removeField(idx: number) {
        setFields(p => p.filter((_, i) => i !== idx));
        setExpandedIdx(null);
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <h2 className="text-lg font-bold mb-1 text-gray-900 dark:text-white">Edit Fields</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Define custom columns for this collection. Changes apply immediately — no migration needed.</p>
                    <div className="space-y-2">
                        {fields.map((f, idx) => (
                            <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                <button
                                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                                    onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                                >
                                    <span className="font-medium text-gray-800 dark:text-gray-200">{f.label}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400">{f.type}</span>
                                        {expandedIdx === idx ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                                    </div>
                                </button>
                                {expandedIdx === idx && (
                                    <div className="px-3 pb-3 space-y-2 border-t border-gray-100 dark:border-gray-700 pt-2">
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <label className="text-xs text-gray-500">Label</label>
                                                <input value={f.label} onChange={e => updateField(idx, { label: e.target.value })} className="mt-0.5 w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800" />
                                            </div>
                                            <div className="w-32">
                                                <label className="text-xs text-gray-500">Type</label>
                                                <select value={f.type} onChange={e => updateField(idx, { type: e.target.value as FieldType })} className="mt-0.5 w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800">
                                                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        {(f.type === 'select' || f.type === 'multiselect') && (
                                            <div>
                                                <label className="text-xs text-gray-500">Options (comma-separated)</label>
                                                <input
                                                    value={(f.options ?? []).join(', ')}
                                                    onChange={e => updateField(idx, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                                    className="mt-0.5 w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800"
                                                    placeholder="Option A, Option B, Option C"
                                                />
                                            </div>
                                        )}
                                        <button onClick={() => removeField(idx)} className="text-xs text-red-500 hover:underline">Remove field</button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <button onClick={addField} className="mt-3 text-sm text-blue-600 hover:underline">+ Add field</button>
                    <div className="flex gap-2 justify-end mt-5">
                        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
                        <button onClick={() => onSave(fields)} className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white">Save Fields</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
