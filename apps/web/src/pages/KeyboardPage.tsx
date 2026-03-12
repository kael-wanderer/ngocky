import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { Filter, Keyboard, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';

// ─── Constants ───────────────────────────────────────

const CATEGORIES = ['Keycap', 'Kit', 'Shipping'];
const TAGS = ['Board 1', 'Board 2', 'Board 3', 'Board 4', 'Board 5', 'Board 6', 'Board 7', 'Board 8', 'Board 9', 'Board 10', 'Board 11', 'Board 12', 'Board 13', 'Board 14', 'Board 15', 'Board 16', 'Board 17', 'Stock'];
const COLORS = ['Blue', 'PC', 'Purple', 'Red', 'Gray', 'Green', 'Black', 'Silver', 'Copper', 'Brown', 'Rose Gold', 'Orange', 'Beige', 'Colorful'];
const SPECS = ['Base', 'Space', 'Plate Alu', 'Solder', 'Novel', 'Alpha', 'Icon mod', 'Hiragana', 'Hotswap', 'Deskmat', 'Fix kit'];
const EXTRAS = ['Hotswap', 'Solder', 'Plate Alu', 'Plate CF', 'Plate PC', 'Plate PP', 'Rama'];
const STABS = ['V2.0', 'V2.1', 'V2.2'];
const SWITCH_ALPHAS = ['VB 3 pin', 'VB 5 pin'];
const SWITCH_MODS = ['VB 3 pin', 'VB 5 pin', 'HB', 'Cherry Black'];
const COLOR_TEXT_MAP: Record<string, string> = {
    Blue: '#2563eb',
    PC: '#6b7280',
    Purple: '#7c3aed',
    Red: '#dc2626',
    Gray: '#6b7280',
    Green: '#16a34a',
    Black: '#111827',
    Silver: '#94a3b8',
    Copper: '#b45309',
    Brown: '#92400e',
    'Rose Gold': '#c2410c',
    Orange: '#ea580c',
    Beige: '#a16207',
    Colorful: '#db2777',
};

// ─── Types ───────────────────────────────────────────

interface KeyboardItem {
    id: string;
    name: string;
    price: number | null;
    category: string | null;
    tag: string | null;
    color: string | null;
    spec: string[];
    extras: string[];
    description: string | null;
    note: string | null;
    stab: string | null;
    switchAlpha: string | null;
    switchMod: string | null;
    assembler: string | null;
    isShared: boolean;
    ownerId: string;
    sortOrder: number;
}

type FormState = {
    name: string;
    price: string;
    category: string;
    tag: string;
    color: string;
    spec: string[];
    extras: string[];
    description: string;
    note: string;
    stab: string;
    switchAlpha: string;
    switchMod: string;
    assembler: string;
    isShared: boolean;
};

// ─── Helpers ─────────────────────────────────────────

const formatVND = (n: number) => `${new Intl.NumberFormat('vi-VN').format(n)} ₫`;

function emptyForm(): FormState {
    return { name: '', price: '', category: '', tag: '', color: '', spec: [], extras: [], description: '', note: '', stab: '', switchAlpha: '', switchMod: '', assembler: '', isShared: false };
}

function formFromItem(item: KeyboardItem): FormState {
    return {
        name: item.name,
        price: item.price != null ? String(item.price) : '',
        category: item.category ?? '',
        tag: item.tag ?? '',
        color: item.color ?? '',
        spec: item.spec ?? [],
        extras: item.extras ?? [],
        description: item.description ?? '',
        note: item.note ?? '',
        stab: item.stab ?? '',
        switchAlpha: item.switchAlpha ?? '',
        switchMod: item.switchMod ?? '',
        assembler: item.assembler ?? '',
        isShared: item.isShared,
    };
}

function formToBody(f: FormState) {
    return {
        name: f.name,
        price: f.price !== '' ? Number(f.price) : null,
        category: f.category || null,
        tag: f.tag || null,
        color: f.color || null,
        spec: f.spec,
        extras: f.extras,
        description: f.description || null,
        note: f.note || null,
        stab: f.stab || null,
        switchAlpha: f.switchAlpha || null,
        switchMod: f.switchMod || null,
        assembler: f.assembler || null,
        isShared: f.isShared,
    };
}

function toggleArr(arr: string[], val: string): string[] {
    return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
}

function Chip({ label, onRemove }: { label: string; onRemove?: () => void }) {
    return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200">
            {label}
            {onRemove && <button type="button" onClick={onRemove} className="ml-0.5 hover:text-red-500"><X className="w-2.5 h-2.5" /></button>}
        </span>
    );
}

// ─── CSV helpers ─────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
    const lines = text.trim().split(/\r?\n/);
    function parseLine(line: string): string[] {
        const cols: string[] = [];
        let cur = '';
        let inQuote = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
                else inQuote = !inQuote;
            } else if (ch === ',' && !inQuote) {
                cols.push(cur.trim()); cur = '';
            } else { cur += ch; }
        }
        cols.push(cur.trim());
        return cols;
    }
    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).filter(l => l.trim()).map(parseLine);
    return { headers, rows };
}

// Column header → field key mapping for CSV import
const CSV_HEADER_MAP: Record<string, string> = {
    name: 'name', price: 'price',
    category: 'category', tag: 'tag', color: 'color',
    spec: 'spec', extras: 'extras',
    description: 'description', note: 'note',
    stab: 'stab',
    'switch alpha': 'switchAlpha', switchalpha: 'switchAlpha', alpha: 'switchAlpha',
    'switch mod': 'switchMod', switchmod: 'switchMod', mod: 'switchMod',
    assembler: 'assembler',
};

// ─── Main Page ───────────────────────────────────────

export default function KeyboardPage() {
    const qc = useQueryClient();

    // Filters
    const [filterCategory, setFilterCategory] = useState('');
    const [filterTag, setFilterTag] = useState('');
    const [filterColor, setFilterColor] = useState('');
    const [filterSpec, setFilterSpec] = useState('');
    const [filterSearch, setFilterSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<KeyboardItem | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm());

    // Import
    const [showImport, setShowImport] = useState(false);

    const { data: items = [] } = useQuery<KeyboardItem[]>({
        queryKey: ['keyboards'],
        queryFn: async () => (await api.get('/keyboards')).data.data,
    });

    const createMut = useMutation({
        mutationFn: (body: any) => api.post('/keyboards', body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['keyboards'] }); closeModal(); },
    });
    const updateMut = useMutation({
        mutationFn: ({ id, body }: any) => api.patch(`/keyboards/${id}`, body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['keyboards'] }); closeModal(); },
    });
    const deleteMut = useMutation({
        mutationFn: (id: string) => api.delete(`/keyboards/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['keyboards'] }),
    });
    const importMut = useMutation({
        mutationFn: (importItems: any[]) => api.post('/keyboards/import', { items: importItems }),
        onSuccess: ({ data }) => {
            qc.invalidateQueries({ queryKey: ['keyboards'] });
            setShowImport(false);
            alert(`✅ Imported ${data.data.created} items`);
        },
    });

    function openNew() { setEditing(null); setForm(emptyForm()); setShowModal(true); }
    function openEdit(item: KeyboardItem) { setEditing(item); setForm(formFromItem(item)); setShowModal(true); }
    function closeModal() { setShowModal(false); setEditing(null); }
    function submitForm() {
        if (!form.name) return;
        const body = formToBody(form);
        if (editing) updateMut.mutate({ id: editing.id, body });
        else createMut.mutate(body);
    }

    // Filtering
    const filtered = items.filter(item => {
        if (filterSearch && !item.name.toLowerCase().includes(filterSearch.toLowerCase())) return false;
        if (filterCategory && item.category !== filterCategory) return false;
        if (filterTag && item.tag !== filterTag) return false;
        if (filterColor && item.color !== filterColor) return false;
        if (filterSpec && !item.spec.includes(filterSpec)) return false;
        return true;
    });

    const totalPrice = filtered.reduce((s, i) => s + (i.price ?? 0), 0);
    const activeFilterCount = [filterCategory, filterTag, filterColor, filterSpec].filter(Boolean).length;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Keyboard className="w-6 h-6" /> Keyboard
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {filtered.length} item{filtered.length !== 1 ? 's' : ''}
                        {totalPrice > 0 && <> · Total: <span className="font-semibold text-gray-700 dark:text-gray-200">{formatVND(totalPrice)}</span></>}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200">
                        <Upload className="w-4 h-4" />Import CSV
                    </button>
                    <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                        <Plus className="w-4 h-4" />Add Keyboard
                    </button>
                </div>
            </div>

            {/* Filter bar */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex-1 min-w-[160px]">
                        <input
                            value={filterSearch}
                            onChange={e => setFilterSearch(e.target.value)}
                            placeholder="Search by name…"
                            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(s => !s)}
                        className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border ${showFilters || activeFilterCount > 0 ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                    >
                        <Filter className="w-4 h-4" />
                        Filters{activeFilterCount > 0 && <span className="font-bold ml-0.5">({activeFilterCount})</span>}
                    </button>
                    {activeFilterCount > 0 && (
                        <button onClick={() => { setFilterCategory(''); setFilterTag(''); setFilterColor(''); setFilterSpec(''); }} className="text-xs text-gray-400 hover:text-red-500">
                            Clear
                        </button>
                    )}
                </div>
                {showFilters && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200">
                            <option value="">All categories</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={filterTag} onChange={e => setFilterTag(e.target.value)} className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200">
                            <option value="">All tags</option>
                            {TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <select value={filterColor} onChange={e => setFilterColor(e.target.value)} className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200">
                            <option value="">All colors</option>
                            {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={filterSpec} onChange={e => setFilterSpec(e.target.value)} className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200">
                            <option value="">All specs</option>
                            {SPECS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                            <tr>
                                <th className="text-left px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap min-w-[160px]">Name</th>
                                <th className="text-left px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap w-24">Category</th>
                                <th className="text-left px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap w-24">Tag</th>
                                <th className="text-left px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap w-20">Color</th>
                                <th className="text-left px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap min-w-[140px]">Spec</th>
                                <th className="text-left px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap min-w-[120px]">Extras</th>
                                <th className="text-right px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap w-28">Price</th>
                                <th className="text-left px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap min-w-[120px]">Condition</th>
                                <th className="text-left px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap min-w-[120px]">Note</th>
                                <th className="text-left px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap w-20">Stab</th>
                                <th className="text-left px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap w-28">Switch Alpha</th>
                                <th className="text-left px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap w-28">Switch Mod</th>
                                <th className="text-left px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap w-24">Assembler</th>
                                <th className="w-16" />
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={14} className="text-center py-12 text-gray-400">No keyboards found</td>
                                </tr>
                            )}
                            {filtered.map(item => (
                                <tr key={item.id} onDoubleClick={() => openEdit(item)} className="group border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{item.name}</td>
                                    <td className="px-3 py-2">
                                        {item.category ? <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">{item.category}</span> : <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>}
                                    </td>
                                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">{item.tag ?? <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                                    <td className="px-3 py-2">
                                        {item.color ? <span className="text-xs font-semibold" style={{ color: COLOR_TEXT_MAP[item.color] || 'var(--color-text)' }}>{item.color}</span> : <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>}
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex flex-wrap gap-0.5">
                                            {item.spec?.length ? item.spec.map(s => <Chip key={s} label={s} />) : <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex flex-wrap gap-0.5">
                                            {item.extras?.length ? item.extras.map(e => <span key={e} className="px-1.5 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">{e}</span>) : <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                                        {item.price != null ? formatVND(item.price) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                                    </td>
                                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs max-w-[120px] truncate" title={item.description ?? ''}>{item.description || <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs max-w-[120px] truncate" title={item.note ?? ''}>{item.note || <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">{item.stab || <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">{item.switchAlpha || <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">{item.switchMod || <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">{item.assembler || <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                            <button onClick={(e) => { e.stopPropagation(); openEdit(item); }} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
                                                <Pencil className="w-3.5 h-3.5 text-gray-400" />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this keyboard?')) deleteMut.mutate(item.id); }} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20">
                                                <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <KeyboardModal
                    form={form}
                    setForm={setForm}
                    editing={!!editing}
                    onSave={submitForm}
                    onClose={closeModal}
                    saving={createMut.isPending || updateMut.isPending}
                />
            )}

            {/* Import Modal */}
            {showImport && (
                <CsvImportModal
                    onImport={importItems => importMut.mutate(importItems)}
                    onClose={() => setShowImport(false)}
                    loading={importMut.isPending}
                />
            )}
        </div>
    );
}

// ─── Add / Edit Modal ────────────────────────────────

function KeyboardModal({ form, setForm, editing, onSave, onClose, saving }: {
    form: FormState;
    setForm: React.Dispatch<React.SetStateAction<FormState>>;
    editing: boolean;
    onSave: () => void;
    onClose: () => void;
    saving: boolean;
}) {
    const set = (k: keyof FormState, v: any) => setForm(p => ({ ...p, [k]: v }));

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <h2 className="text-lg font-bold mb-5 text-gray-900 dark:text-white">{editing ? 'Edit Keyboard' : 'New Keyboard'}</h2>
                    <div className="grid grid-cols-2 gap-4">
                        {/* Name */}
                        <div className="col-span-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Name <span className="text-red-500">*</span></label>
                            <input value={form.name} onChange={e => set('name', e.target.value)} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm" placeholder="e.g. Frog TKL" />
                        </div>

                        {/* Price */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Price (VND)</label>
                            <input type="number" value={form.price} onChange={e => set('price', e.target.value)} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm" placeholder="e.g. 7800000" />
                        </div>

                        {/* Category */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                            <select value={form.category} onChange={e => set('category', e.target.value)} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm">
                                <option value="">—</option>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        {/* Tag */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tag</label>
                            <select value={form.tag} onChange={e => set('tag', e.target.value)} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm">
                                <option value="">—</option>
                                {TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>

                        {/* Color */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Color</label>
                            <select value={form.color} onChange={e => set('color', e.target.value)} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm">
                                <option value="">—</option>
                                {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        {/* Spec */}
                        <div className="col-span-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Spec</label>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                                {SPECS.map(s => (
                                    <button key={s} type="button" onClick={() => set('spec', toggleArr(form.spec, s))}
                                        className={`px-2 py-0.5 rounded text-xs border transition-colors ${form.spec.includes(s) ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Extras */}
                        <div className="col-span-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Extras</label>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                                {EXTRAS.map(e => (
                                    <button key={e} type="button" onClick={() => set('extras', toggleArr(form.extras, e))}
                                        className={`px-2 py-0.5 rounded text-xs border transition-colors ${form.extras.includes(e) ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                                        {e}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Condition */}
                        <div className="col-span-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Condition</label>
                            <input value={form.description} onChange={e => set('description', e.target.value)} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm" placeholder="e.g. Used, BNIB, Built" />
                        </div>

                        {/* Note */}
                        <div className="col-span-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Note</label>
                            <input value={form.note} onChange={e => set('note', e.target.value)} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm" />
                        </div>

                        {/* Stab */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Stab</label>
                            <select value={form.stab} onChange={e => set('stab', e.target.value)} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm">
                                <option value="">—</option>
                                {STABS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        {/* Switch Alpha */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Switch Alpha</label>
                            <select value={form.switchAlpha} onChange={e => set('switchAlpha', e.target.value)} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm">
                                <option value="">—</option>
                                {SWITCH_ALPHAS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        {/* Switch Mod */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Switch Mod</label>
                            <select value={form.switchMod} onChange={e => set('switchMod', e.target.value)} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm">
                                <option value="">—</option>
                                {SWITCH_MODS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        {/* Assembler */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Assembler</label>
                            <input value={form.assembler} onChange={e => set('assembler', e.target.value)} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm" placeholder="e.g. Hieu" />
                        </div>

                        {/* Shared */}
                        <div className="col-span-2">
                            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                                <input type="checkbox" checked={form.isShared} onChange={e => set('isShared', e.target.checked)} />
                                Shared with family
                            </label>
                        </div>
                    </div>

                    <div className="flex gap-2 justify-end mt-6">
                        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
                        <button onClick={onSave} disabled={!form.name || saving} className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── CSV Import Modal ─────────────────────────────────

function CsvImportModal({ onImport, onClose, loading }: {
    onImport: (items: any[]) => void;
    onClose: () => void;
    loading: boolean;
}) {
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvRows, setCsvRows] = useState<string[][]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});

    const fieldTargets = [
        { key: '', label: '— skip —' },
        { key: 'name', label: 'Name' },
        { key: 'price', label: 'Price' },
        { key: 'category', label: 'Category' },
        { key: 'tag', label: 'Tag' },
        { key: 'color', label: 'Color' },
        { key: 'spec', label: 'Spec (multi)' },
        { key: 'extras', label: 'Extras (multi)' },
        { key: 'description', label: 'Condition' },
        { key: 'note', label: 'Note' },
        { key: 'stab', label: 'Stab' },
        { key: 'switchAlpha', label: 'Switch Alpha' },
        { key: 'switchMod', label: 'Switch Mod' },
        { key: 'assembler', label: 'Assembler' },
    ];

    function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const { headers, rows } = parseCSV(ev.target?.result as string);
            setCsvHeaders(headers);
            setCsvRows(rows);
            const m: Record<string, string> = {};
            headers.forEach(h => {
                const norm = h.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
                m[h] = CSV_HEADER_MAP[norm] ?? '';
            });
            setMapping(m);
        };
        reader.readAsText(file);
    }

    function buildItem(row: string[]) {
        const item: any = { name: '', price: null, spec: [], extras: [] };
        csvHeaders.forEach((h, i) => {
            const target = mapping[h];
            if (!target) return;
            const val = row[i] ?? '';
            if (target === 'price') { item.price = val ? Number(String(val).replace(/[^0-9.]/g, '')) || null : null; return; }
            if (target === 'spec' || target === 'extras') {
                item[target] = val ? val.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                return;
            }
            item[target] = val || null;
        });
        return item;
    }

    const preview = csvRows.slice(0, 3).map(r => buildItem(r));

    function handleImport() {
        const items = csvRows.map(r => buildItem(r)).filter(i => i.name);
        onImport(items);
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <h2 className="text-lg font-bold mb-1 text-gray-900 dark:text-white">Import from CSV</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Export from Notion → Upload here. Map each column header to a field.</p>

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
                                {csvHeaders.map(h => (
                                    <div key={h} className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500 w-36 truncate flex-shrink-0" title={h}>{h}</span>
                                        <span className="text-gray-300 flex-shrink-0">→</span>
                                        <select
                                            value={mapping[h] ?? ''}
                                            onChange={e => setMapping(p => ({ ...p, [h]: e.target.value }))}
                                            className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 bg-white dark:bg-gray-800"
                                        >
                                            {fieldTargets.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
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
                                                    <th className="px-2 py-1 text-left font-medium text-gray-500">Name</th>
                                                    <th className="px-2 py-1 text-left font-medium text-gray-500">Category</th>
                                                    <th className="px-2 py-1 text-left font-medium text-gray-500">Tag</th>
                                                    <th className="px-2 py-1 text-left font-medium text-gray-500">Spec</th>
                                                    <th className="px-2 py-1 text-right font-medium text-gray-500">Price</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {preview.map((item, i) => (
                                                    <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                                                        <td className="px-2 py-1 font-medium">{item.name || <span className="text-red-400">⚠ empty</span>}</td>
                                                        <td className="px-2 py-1 text-gray-600">{item.category ?? '—'}</td>
                                                        <td className="px-2 py-1 text-gray-600">{item.tag ?? '—'}</td>
                                                        <td className="px-2 py-1 text-gray-600">{Array.isArray(item.spec) ? item.spec.join(', ') : '—'}</td>
                                                        <td className="px-2 py-1 text-right text-gray-600">{item.price ?? '—'}</td>
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
