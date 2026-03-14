import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { ArrowDown, ArrowUp, Filter, Keyboard, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import PaginationControls from '../components/PaginationControls';
import { parseCompactAmountInput } from '../utils/amount';
import MultiSelectFilter from '../components/MultiSelectFilter';
import {
    DEFAULT_KEYBOARD_FILTERS,
    KEYBOARD_FILTER_CATEGORIES,
    KEYBOARD_FILTER_COLORS,
    KEYBOARD_FILTER_PRICE_RANGES,
    KEYBOARD_FILTER_TAGS,
    matchesKeyboardFilters,
} from '../config/keyboardFilters';

// ─── Constants ───────────────────────────────────────

const CATEGORIES = [...KEYBOARD_FILTER_CATEGORIES];
const TAGS = [...KEYBOARD_FILTER_TAGS];
const COLORS = [...KEYBOARD_FILTER_COLORS];
const SPECS = ['Base', 'Space', 'Plate Alu', 'Solder', 'Novel', 'Alpha', 'Icon mod', 'Hiragana', 'Hotswap', 'Deskmat', 'Fix kit'];
const EXTRAS = ['Hotswap', 'Solder', 'Plate Alu', 'Plate CF', 'Plate PC', 'Plate PP', 'Rama'];
const STABS = ['V2.0', 'V2.1', 'V2.2'];
const SWITCH_ALPHAS = ['VB 3 pin', 'VB 5 pin'];
const SWITCH_MODS = ['VB 3 pin', 'VB 5 pin', 'HB', 'Cherry Black'];
const CONDITIONS = ['BNIB', 'Used'];
const PRICE_RANGES = [...KEYBOARD_FILTER_PRICE_RANGES];
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
const CATEGORY_TEXT_MAP: Record<string, string> = {
    Kit: '#2563eb',
    Keycap: '#16a34a',
    Shipping: '#ea580c',
    Accessories: '#6b7280',
    Other: '#6b7280',
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

type SortKey = 'name' | 'category' | 'tag' | 'color' | 'spec' | 'extras' | 'condition' | 'price' | 'note' | 'stab' | 'switchAlpha' | 'switchMod' | 'assembler';
type SortOrder = 'asc' | 'desc';
type FilterDropdownKey = 'categories' | 'tags' | 'colors' | 'priceRanges' | null;

// ─── Helpers ─────────────────────────────────────────

const formatVND = (n: number) => `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)} VND`;

const parseAmountInput = parseCompactAmountInput;

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
    const kitOnlyFields = isKitCategory(f.category)
        ? {
            stab: f.stab || null,
            switchAlpha: f.switchAlpha || null,
            switchMod: f.switchMod || null,
            assembler: f.assembler || null,
        }
        : {
            stab: null,
            switchAlpha: null,
            switchMod: null,
            assembler: null,
        };

    return {
        name: f.name,
        price: f.price !== '' ? parseAmountInput(f.price) : null,
        category: f.category || null,
        tag: f.tag || null,
        color: f.color || null,
        spec: f.spec,
        extras: f.extras,
        description: f.description || null,
        note: f.note || null,
        ...kitOnlyFields,
        isShared: f.isShared,
    };
}

function toggleArr(arr: string[], val: string): string[] {
    return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
}

function isKitCategory(category: string) {
    return category === 'Kit';
}

function Chip({ label, onRemove }: { label: string; onRemove?: () => void }) {
    return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200">
            {label}
            {onRemove && <button type="button" onClick={onRemove} className="ml-0.5 hover:text-red-500"><X className="w-2.5 h-2.5" /></button>}
        </span>
    );
}

function KeyboardCategoryBadge({ category }: { category: string }) {
    return (
        <span className="px-1.5 py-0.5 rounded text-xs font-semibold" style={{ color: CATEGORY_TEXT_MAP[category] || '#374151', backgroundColor: `${CATEGORY_TEXT_MAP[category] || '#d1d5db'}20` }}>
            {category}
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
    const [filters, setFilters] = useState({ ...DEFAULT_KEYBOARD_FILTERS });
    const [sortBy, setSortBy] = useState<SortKey>('name');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<KeyboardItem | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm());
    const [openFilter, setOpenFilter] = useState<FilterDropdownKey>(null);

    // Import
    const [showImport, setShowImport] = useState(false);

    function setExclusiveFilter<K extends 'categories' | 'tags' | 'colors' | 'priceRanges'>(
        key: K,
        values: typeof filters[K],
    ) {
        setFilters((current) => ({
            ...current,
            categories: key === 'categories' ? [...values as string[]] : [],
            tags: key === 'tags' ? [...values as string[]] : [],
            colors: key === 'colors' ? [...values as string[]] : [],
            priceRanges: key === 'priceRanges' ? [...values as typeof current.priceRanges] : [],
        }));
        setOpenFilter(null);
    }

    const { data } = useQuery({
        queryKey: ['keyboards'],
        queryFn: async () => (await api.get('/keyboards?page=1&limit=1000')).data,
    });
    const items: KeyboardItem[] = data?.data || [];

    useEffect(() => {
        setPage(1);
    }, [filters, sortBy, sortOrder, pageSize]);

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
        if (form.price && Number.isNaN(parseAmountInput(form.price))) {
            alert('Price must be a valid number. Example: 7800000 or 7.8M');
            return;
        }
        const body = formToBody(form);
        if (editing) updateMut.mutate({ id: editing.id, body });
        else createMut.mutate(body);
    }

    // Filtering
    const filtered = items.filter((item) => matchesKeyboardFilters(item, filters));

    const sortedItems = useMemo(() => {
        const getValue = (item: KeyboardItem, key: SortKey) => {
            switch (key) {
                case 'name': return item.name || '';
                case 'category': return item.category || '';
                case 'tag': return item.tag || '';
                case 'color': return item.color || '';
                case 'spec': return item.spec?.join(', ') || '';
                case 'extras': return item.extras?.join(', ') || '';
                case 'condition': return item.description || '';
                case 'price': return item.price ?? 0;
                case 'note': return item.note || '';
                case 'stab': return item.stab || '';
                case 'switchAlpha': return item.switchAlpha || '';
                case 'switchMod': return item.switchMod || '';
                case 'assembler': return item.assembler || '';
                default: return '';
            }
        };

        return [...filtered].sort((left, right) => {
            const leftValue = getValue(left, sortBy);
            const rightValue = getValue(right, sortBy);
            const result = typeof leftValue === 'number' && typeof rightValue === 'number'
                ? leftValue - rightValue
                : String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: 'base' });
            return sortOrder === 'asc' ? result : -result;
        });
    }, [filtered, sortBy, sortOrder]);

    const summary = useMemo(() => {
        const values = {
            kit: 0,
            keycap: 0,
            accessories: 0,
            total: 0,
        };

        for (const item of sortedItems) {
            const price = item.price ?? 0;
            values.total += price;
            if (item.category === 'Kit') values.kit += price;
            if (item.category === 'Keycap') values.keycap += price;
            if (item.category === 'Accessories') values.accessories += price;
        }

        return values;
    }, [sortedItems]);

    const totalItems = sortedItems.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const paginatedItems = sortedItems.slice((page - 1) * pageSize, page * pageSize);
    const totalPrice = summary.total;
    const activeFilterCount = [filters.categories, filters.tags, filters.colors, filters.priceRanges].filter((values) => values.length > 0).length;

    function toggleSort(column: SortKey) {
        if (sortBy === column) {
            setSortOrder((current) => current === 'asc' ? 'desc' : 'asc');
            return;
        }
        setSortBy(column);
        setSortOrder(column === 'price' ? 'desc' : 'asc');
    }

    function renderSortIcon(column: SortKey) {
        if (sortBy !== column) return <ArrowUp className="w-3.5 h-3.5 opacity-30" />;
        return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />;
    }

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
                <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-[220px] flex-[1.4]">
                        <input
                            value={filters.search}
                            onChange={e => setFilters((current) => ({ ...current, search: e.target.value }))}
                            placeholder="Search by name…"
                            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                    </div>
                    {activeFilterCount > 0 && (
                        <button onClick={() => setFilters((current) => ({ ...current, categories: [], tags: [], colors: [], priceRanges: [] }))} className="shrink-0 text-xs text-gray-400 hover:text-red-500">
                            Clear
                        </button>
                    )}
                    <MultiSelectFilter
                        className="min-w-[150px] flex-1"
                        label="Category"
                        allLabel="All categories"
                        options={CATEGORIES.map((value) => ({ value, label: value }))}
                        selected={filters.categories}
                        open={openFilter === 'categories'}
                        onOpenChange={(open) => setOpenFilter(open ? 'categories' : null)}
                        onChange={(values) => setExclusiveFilter('categories', values)}
                    />
                    <MultiSelectFilter
                        className="min-w-[150px] flex-1"
                        label="Tag"
                        allLabel="All tags"
                        options={TAGS.map((value) => ({ value, label: value }))}
                        selected={filters.tags}
                        open={openFilter === 'tags'}
                        onOpenChange={(open) => setOpenFilter(open ? 'tags' : null)}
                        onChange={(values) => setExclusiveFilter('tags', values)}
                    />
                    <MultiSelectFilter
                        className="min-w-[150px] flex-1"
                        label="Color"
                        allLabel="All colors"
                        options={COLORS.map((value) => ({ value, label: value }))}
                        selected={filters.colors}
                        open={openFilter === 'colors'}
                        onOpenChange={(open) => setOpenFilter(open ? 'colors' : null)}
                        onChange={(values) => setExclusiveFilter('colors', values)}
                    />
                    <MultiSelectFilter
                        className="min-w-[170px] flex-1"
                        label="Price"
                        allLabel="All prices"
                        options={PRICE_RANGES.map((range) => ({ value: range.value, label: range.label }))}
                        selected={filters.priceRanges}
                        open={openFilter === 'priceRanges'}
                        onOpenChange={(open) => setOpenFilter(open ? 'priceRanges' : null)}
                        onChange={(values) => setExclusiveFilter('priceRanges', values as typeof filters.priceRanges)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                    <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Kit</div>
                    <div className="text-2xl font-bold" style={{ color: '#2563eb' }}>{formatVND(summary.kit)}</div>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                    <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Keycap</div>
                    <div className="text-2xl font-bold" style={{ color: '#ea580c' }}>{formatVND(summary.keycap)}</div>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                    <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Accessories</div>
                    <div className="text-2xl font-bold" style={{ color: '#6b7280' }}>{formatVND(summary.accessories)}</div>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                    <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Total ({sortedItems.length} items)</div>
                    <div className="text-2xl font-bold" style={{ color: '#16a34a' }}>{formatVND(summary.total)}</div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                            <tr>
                                <th className="text-left px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap min-w-[160px]">
                                    <button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleSort('name')}>
                                        Name
                                        {renderSortIcon('name')}
                                    </button>
                                </th>
                                <th className="text-left px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap w-24">
                                    <button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleSort('category')}>
                                        Category
                                        {renderSortIcon('category')}
                                    </button>
                                </th>
                                <th className="text-left px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap w-24">
                                    <button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleSort('tag')}>
                                        Tag
                                        {renderSortIcon('tag')}
                                    </button>
                                </th>
                                <th className="text-left px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap w-20">
                                    <button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleSort('color')}>
                                        Color
                                        {renderSortIcon('color')}
                                    </button>
                                </th>
                                <th className="text-left px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap min-w-[140px]">
                                    <button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleSort('spec')}>
                                        Spec
                                        {renderSortIcon('spec')}
                                    </button>
                                </th>
                                <th className="text-left px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap min-w-[120px]">
                                    <button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleSort('extras')}>
                                        Extras
                                        {renderSortIcon('extras')}
                                    </button>
                                </th>
                                <th className="text-left px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap min-w-[120px]">
                                    <button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleSort('condition')}>
                                        Condition
                                        {renderSortIcon('condition')}
                                    </button>
                                </th>
                                <th className="text-right px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap w-28">
                                    <button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleSort('price')}>
                                        Price
                                        {renderSortIcon('price')}
                                    </button>
                                </th>
                                <th className="text-left px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap min-w-[120px]">
                                    <button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleSort('note')}>
                                        Note
                                        {renderSortIcon('note')}
                                    </button>
                                </th>
                                <th className="text-left px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap w-20">
                                    <button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleSort('stab')}>
                                        Stab
                                        {renderSortIcon('stab')}
                                    </button>
                                </th>
                                <th className="text-left px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap w-28">
                                    <button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleSort('switchAlpha')}>
                                        Switch Alpha
                                        {renderSortIcon('switchAlpha')}
                                    </button>
                                </th>
                                <th className="text-left px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap w-28">
                                    <button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleSort('switchMod')}>
                                        Switch Mod
                                        {renderSortIcon('switchMod')}
                                    </button>
                                </th>
                                <th className="text-left px-3 py-2.5 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap w-24">
                                    <button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => toggleSort('assembler')}>
                                        Assembler
                                        {renderSortIcon('assembler')}
                                    </button>
                                </th>
                                <th className="w-16" />
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedItems.length === 0 && (
                                <tr>
                                    <td colSpan={14} className="text-center py-12 text-gray-400">No keyboards found</td>
                                </tr>
                            )}
                            {paginatedItems.map((item, index) => (
                                <tr
                                    key={item.id}
                                    onDoubleClick={() => openEdit(item)}
                                    className={`group border-t border-gray-200 dark:border-gray-800 cursor-pointer ${index % 2 === 0 ? 'bg-[#ecfdf5] dark:bg-[#202225]' : 'bg-white dark:bg-gray-900'} hover:bg-[#d1fae5] dark:hover:bg-[#2a2d31]'}`}
                                >
                                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{item.name}</td>
                                    <td className="px-3 py-2">
                                        {item.category ? <KeyboardCategoryBadge category={item.category} /> : <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>}
                                    </td>
                                    <td className="px-3 py-2 text-xs">
                                        {item.tag ? <span style={{ color: item.color ? (COLOR_TEXT_MAP[item.color] || 'var(--color-text-secondary)') : 'var(--color-text-secondary)' }}>{item.tag}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>}
                                    </td>
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
                                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs max-w-[120px] truncate" title={item.description ?? ''}>{item.description || <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                                        {item.price != null ? formatVND(item.price) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                                    </td>
                                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs max-w-[120px] truncate" title={item.note ?? ''}>{item.note || <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">{isKitCategory(item.category || '') ? (item.stab || <span className="text-gray-300 dark:text-gray-600">—</span>) : <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">{isKitCategory(item.category || '') ? (item.switchAlpha || <span className="text-gray-300 dark:text-gray-600">—</span>) : <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">{isKitCategory(item.category || '') ? (item.switchMod || <span className="text-gray-300 dark:text-gray-600">—</span>) : <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">{isKitCategory(item.category || '') ? (item.assembler || <span className="text-gray-300 dark:text-gray-600">—</span>) : <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
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
                <PaginationControls
                    page={page}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalItems={totalItems}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                />
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <KeyboardModal
                    form={form}
                    setForm={setForm}
                    editing={!!editing}
                    onSave={submitForm}
                    onClose={closeModal}
                    onDelete={editing ? () => {
                        if (confirm('Delete this keyboard?')) {
                            deleteMut.mutate(editing.id);
                            closeModal();
                        }
                    } : undefined}
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

function KeyboardModal({ form, setForm, editing, onSave, onClose, onDelete, saving }: {
    form: FormState;
    setForm: React.Dispatch<React.SetStateAction<FormState>>;
    editing: boolean;
    onSave: () => void;
    onClose: () => void;
    onDelete?: () => void;
    saving: boolean;
}) {
    const set = (k: keyof FormState, v: any) => setForm(p => ({ ...p, [k]: v }));
    const isKit = isKitCategory(form.category);

    function setCategory(value: string) {
        setForm((current) => ({
            ...current,
            category: value,
            stab: isKitCategory(value) ? current.stab : '',
            switchAlpha: isKitCategory(value) ? current.switchAlpha : '',
            switchMod: isKitCategory(value) ? current.switchMod : '',
            assembler: isKitCategory(value) ? current.assembler : '',
        }));
    }

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
                            <input value={form.price} onChange={e => set('price', e.target.value)} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm" placeholder="e.g. 7800000, 600k, or 7.8M" />
                        </div>

                        {/* Category */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                            <select value={form.category} onChange={e => setCategory(e.target.value)} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm">
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
                            <select value={form.description} onChange={e => set('description', e.target.value)} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm">
                                <option value="">—</option>
                                {CONDITIONS.map(condition => <option key={condition} value={condition}>{condition}</option>)}
                            </select>
                        </div>

                        {/* Note */}
                        <div className="col-span-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Note</label>
                            <input value={form.note} onChange={e => set('note', e.target.value)} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm" />
                        </div>

                        {/* Stab */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Stab</label>
                            <select disabled={!isKit} value={form.stab} onChange={e => set('stab', e.target.value)} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                                <option value="">—</option>
                                {STABS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        {/* Switch Alpha */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Switch Alpha</label>
                            <select disabled={!isKit} value={form.switchAlpha} onChange={e => set('switchAlpha', e.target.value)} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                                <option value="">—</option>
                                {SWITCH_ALPHAS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        {/* Switch Mod */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Switch Mod</label>
                            <select disabled={!isKit} value={form.switchMod} onChange={e => set('switchMod', e.target.value)} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                                <option value="">—</option>
                                {SWITCH_MODS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        {/* Assembler */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Assembler</label>
                            <input disabled={!isKit} value={form.assembler} onChange={e => set('assembler', e.target.value)} className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed" placeholder="e.g. Hieu" />
                        </div>

                        {/* Shared */}
                        <div className="col-span-2">
                            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                                <input type="checkbox" checked={form.isShared} onChange={e => set('isShared', e.target.checked)} />
                                Shared with family
                            </label>
                        </div>
                    </div>

                    <div className="mt-6 flex items-center justify-between gap-3">
                        <div>
                            {editing && onDelete && (
                                <button onClick={onDelete} className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white">
                                    Delete
                                </button>
                            )}
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
                            <button onClick={onSave} disabled={!form.name || saving} className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
                            {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
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
            if (target === 'price') { item.price = val ? parseAmountInput(String(val)) || null : null; return; }
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
