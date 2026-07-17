import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Filter, MapPin, Pencil, Plus, Settings, Shuffle, Trash2, Upload, Utensils, X } from 'lucide-react';
import { useLocalStorage } from '../utils/useLocalStorage';
import { foods, type FoodOptions, type FoodPlace } from '../api/pages';
import { DEFAULT_FOOD_FILTERS, matchesFoodFilters, type FoodFilters } from '../config/foodFilters';
import { openExternal } from '../utils/externalLinks';
import PaginationControls from '../components/PaginationControls';

type FoodForm = {
    name: string;
    tag: string;
    type: string;
    distance: string;
    address: string;
    district: string;
    openHours: string;
    priceEst: string;
    rating: string;
    mapLink: string;
    note: string;
    isShared: boolean;
};

type SortKey = 'name' | 'tag' | 'type' | 'distance' | 'address' | 'district' | 'openHours' | 'priceEst' | 'rating' | 'note';
type OptionKey = keyof FoodOptions;

const EMPTY_OPTIONS: FoodOptions = { tags: [], types: [], distances: [] };

function emptyForm(): FoodForm {
    return { name: '', tag: '', type: '', distance: '', address: '', district: '', openHours: '', priceEst: '', rating: '', mapLink: '', note: '', isShared: false };
}

function formFromPlace(place: FoodPlace): FoodForm {
    return {
        name: place.name,
        tag: place.tag || '',
        type: place.type || '',
        distance: place.distance || '',
        address: place.address || '',
        district: place.district || '',
        openHours: place.openHours || '',
        priceEst: place.priceEst || '',
        rating: place.rating == null ? '' : String(place.rating),
        mapLink: place.mapLink || '',
        note: place.note || '',
        isShared: place.isShared,
    };
}

function formToBody(form: FoodForm) {
    return {
        name: form.name.trim(),
        tag: form.tag || null,
        type: form.type || null,
        distance: form.distance || null,
        address: form.address.trim() || null,
        district: form.district.trim() || null,
        openHours: form.openHours.trim() || null,
        priceEst: form.priceEst.trim() || null,
        rating: form.rating ? Number(form.rating) : null,
        mapLink: form.mapLink.trim() || null,
        note: form.note.trim() || null,
        isShared: form.isShared,
    };
}

function parseCsv(text: string) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const parseLine = (line: string) => line.split(',').map((value) => value.trim().replace(/^"|"$/g, ''));
    const headers = parseLine(lines[0]).map((header) => header.toLowerCase());
    return lines.slice(1).map((line) => {
        const values = parseLine(line);
        return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
    });
}

function sortValue(place: FoodPlace, key: SortKey) {
    if (key === 'rating') return place.rating ?? 0;
    return String(place[key] || '');
}

export default function FoodPage({ instanceId, pageTitle }: { instanceId?: string; pageTitle?: string }) {
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [filters, setFilters] = useLocalStorage<FoodFilters>('ngocky:food:filters', DEFAULT_FOOD_FILTERS);
    const [sortBy, setSortBy] = useLocalStorage<SortKey>('ngocky:food:sortBy', 'name');
    const [sortOrder, setSortOrder] = useLocalStorage<'asc' | 'desc'>('ngocky:food:sortOrder', 'asc');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useLocalStorage('ngocky:food:pageSize', 25);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<FoodPlace | null>(null);
    const [form, setForm] = useState<FoodForm>(emptyForm());
    const [showOptions, setShowOptions] = useState(false);
    const [draftOptions, setDraftOptions] = useState<FoodOptions>(EMPTY_OPTIONS);
    const [newOption, setNewOption] = useState<Record<OptionKey, string>>({ tags: '', types: '', distances: '' });
    const [pickedId, setPickedId] = useState<string | null>(null);

    const { data: foodResponse, isLoading } = useQuery({
        queryKey: ['foods', instanceId ?? null],
        queryFn: () => foods.list({ instanceId }),
    });
    const { data: optionResponse } = useQuery({
        queryKey: ['food-options'],
        queryFn: () => foods.getOptions(),
    });
    const items = (foodResponse?.data?.data || []) as FoodPlace[];
    const options = optionResponse?.data || EMPTY_OPTIONS;

    useEffect(() => setPage(1), [filters, sortBy, sortOrder, pageSize]);

    const updateOptionsMut = useMutation({
        mutationFn: (body: Partial<FoodOptions>) => foods.updateOptions(body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['food-options'] });
            queryClient.invalidateQueries({ queryKey: ['app-settings'] });
        },
    });
    const createMut = useMutation({
        mutationFn: (body: any) => foods.create({ ...body, instanceId }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['foods'] }); closeModal(); },
    });
    const updateMut = useMutation({
        mutationFn: ({ id, body }: { id: string; body: any }) => foods.update(id, body, instanceId),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['foods'] }); closeModal(); },
    });
    const deleteMut = useMutation({
        mutationFn: (id: string) => foods.remove(id, instanceId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['foods'] }),
    });
    const importMut = useMutation({
        mutationFn: (rows: any[]) => foods.import(rows, instanceId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['foods'] }),
    });

    const filtered = useMemo(() => items.filter((item) => matchesFoodFilters(item, filters)), [items, filters]);
    const sorted = useMemo(() => [...filtered].sort((left, right) => {
        const a = sortValue(left, sortBy);
        const b = sortValue(right, sortBy);
        const result = typeof a === 'number' && typeof b === 'number'
            ? a - b
            : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
        return sortOrder === 'asc' ? result : -result;
    }), [filtered, sortBy, sortOrder]);
    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const visibleItems = sorted.slice((page - 1) * pageSize, page * pageSize);
    const activeFilterCount = [filters.search, filters.tag, filters.type, filters.distance].filter(Boolean).length;

    function openNew() { setEditing(null); setForm(emptyForm()); setShowModal(true); }
    function openEdit(item: FoodPlace) { setEditing(item); setForm(formFromPlace(item)); setShowModal(true); }
    function closeModal() { setShowModal(false); setEditing(null); }

    async function ensureNewOptions(body: ReturnType<typeof formToBody>) {
        const next: Partial<FoodOptions> = {};
        (['tag', 'type', 'distance'] as const).forEach((field) => {
            const key = `${field}s` as OptionKey;
            const value = body[field];
            if (value && !options[key].includes(value)) next[key] = [...options[key], value];
        });
        if (Object.keys(next).length) await updateOptionsMut.mutateAsync(next);
    }

    async function submitForm() {
        if (!form.name.trim()) return;
        if (form.rating && (!/^\d$/.test(form.rating) || Number(form.rating) < 1 || Number(form.rating) > 5)) return;
        const body = formToBody(form);
        await ensureNewOptions(body);
        if (editing) updateMut.mutate({ id: editing.id, body });
        else createMut.mutate(body);
    }

    function toggleSort(column: SortKey) {
        if (sortBy === column) setSortOrder((current) => current === 'asc' ? 'desc' : 'asc');
        else { setSortBy(column); setSortOrder(column === 'rating' ? 'desc' : 'asc'); }
    }

    function renderSortIcon(column: SortKey) {
        if (sortBy !== column) return <ArrowUp className="h-3.5 w-3.5 opacity-30" />;
        return sortOrder === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
    }

    function pickForMe() {
        if (!filtered.length) return;
        setPickedId(filtered[Math.floor(Math.random() * filtered.length)].id);
    }

    function openOptionManager() {
        setDraftOptions({ tags: [...options.tags], types: [...options.types], distances: [...options.distances] });
        setShowOptions(true);
    }

    function addOption(key: OptionKey) {
        const value = newOption[key].trim();
        if (!value || draftOptions[key].includes(value)) return;
        setDraftOptions((current) => ({ ...current, [key]: [...current[key], value] }));
        setNewOption((current) => ({ ...current, [key]: '' }));
    }

    function saveOptions() {
        updateOptionsMut.mutate(draftOptions);
        setShowOptions(false);
    }

    async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        const rows = file.name.toLowerCase().endsWith('.json') ? JSON.parse(text) : parseCsv(text);
        importMut.mutate(Array.isArray(rows) ? rows : rows.items || []);
        event.target.value = '';
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold" style={{ color: 'var(--color-text)' }}><Utensils className="h-6 w-6" />{pageTitle || 'Food Menu'}</h1>
                    <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{filtered.length} place{filtered.length === 1 ? '' : 's'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <input ref={fileInputRef} type="file" accept=".csv,.json,application/json,text/csv" className="hidden" onChange={handleImport} />
                    <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4" />Import</button>
                    <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={openOptionManager}><Settings className="h-4 w-4" />Manage options</button>
                    <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={pickForMe}><Shuffle className="h-4 w-4" />Pick for me</button>
                    <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={openNew}><Plus className="h-4 w-4" />Add place</button>
                </div>
            </div>

            <div className="card space-y-3 p-4">
                <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-text)' }}><Filter className="h-4 w-4" />Filters{activeFilterCount > 0 && <button type="button" className="ml-auto text-xs text-red-500" onClick={() => setFilters(DEFAULT_FOOD_FILTERS)}>Clear</button>}</div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <input className="input text-sm" placeholder="Search by name" value={filters.search} onChange={(e) => setFilters((current) => ({ ...current, search: e.target.value }))} />
                    <select className="input text-sm" value={filters.tag} onChange={(e) => setFilters((current) => ({ ...current, tag: e.target.value }))}><option value="">All tags</option>{options.tags.map((value) => <option key={value}>{value}</option>)}</select>
                    <select className="input text-sm" value={filters.type} onChange={(e) => setFilters((current) => ({ ...current, type: e.target.value }))}><option value="">All types</option>{options.types.map((value) => <option key={value}>{value}</option>)}</select>
                    <select className="input text-sm" value={filters.distance} onChange={(e) => setFilters((current) => ({ ...current, distance: e.target.value }))}><option value="">All distances</option>{options.distances.map((value) => <option key={value}>{value}</option>)}</select>
                </div>
            </div>

            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                            {([['name', 'Name'], ['tag', 'Tag'], ['type', 'Type'], ['distance', 'Distance'], ['address', 'Address'], ['district', 'District'], ['openHours', 'Open hours'], ['priceEst', 'Price (estimated)'], ['rating', 'Rating'], ['note', 'Note']] as Array<[SortKey, string]>).map(([key, label]) => <th key={key} className="whitespace-nowrap px-3 py-3 text-left font-semibold" style={{ color: 'var(--color-text-secondary)' }}><button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort(key)}>{label}{renderSortIcon(key)}</button></th>)}
                            <th className="px-3 py-3 text-left font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Map</th><th className="px-3 py-3 text-left font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Actions</th>
                        </tr></thead>
                        <tbody>
                            {isLoading && <tr><td colSpan={12} className="py-10 text-center" style={{ color: 'var(--color-text-secondary)' }}>Loading food places...</td></tr>}
                            {!isLoading && visibleItems.length === 0 && <tr><td colSpan={12} className="py-10 text-center" style={{ color: 'var(--color-text-secondary)' }}>No food places found.</td></tr>}
                            {visibleItems.map((item) => <tr key={item.id} className={`border-t ${pickedId === item.id ? 'bg-amber-100 dark:bg-amber-900/30' : ''}`} style={{ borderColor: 'var(--color-border)' }}>
                                <td className="px-3 py-3 font-semibold" style={{ color: 'var(--color-text)' }}>{item.name}</td><td className="px-3 py-3" style={{ color: 'var(--color-text)' }}>{item.tag || '—'}</td><td className="px-3 py-3" style={{ color: 'var(--color-text)' }}>{item.type || '—'}</td><td className="px-3 py-3" style={{ color: 'var(--color-text)' }}>{item.distance || '—'}</td><td className="max-w-xs px-3 py-3" style={{ color: 'var(--color-text)' }}>{item.address || '—'}</td><td className="px-3 py-3" style={{ color: 'var(--color-text)' }}>{item.district || '—'}</td><td className="whitespace-nowrap px-3 py-3" style={{ color: 'var(--color-text)' }}>{item.openHours || '—'}</td><td className="whitespace-nowrap px-3 py-3" style={{ color: 'var(--color-text)' }}>{item.priceEst || '—'}</td><td className="px-3 py-3" style={{ color: 'var(--color-text)' }}>{item.rating ? '★'.repeat(item.rating) : '—'}</td><td className="max-w-xs px-3 py-3" style={{ color: 'var(--color-text-secondary)' }}>{item.note || '—'}</td>
                                <td className="px-3 py-3">{item.mapLink ? <button type="button" title="Open map" className="text-blue-600" onClick={() => void openExternal(item.mapLink!)}><MapPin className="h-4 w-4" /></button> : '—'}</td>
                                <td className="px-3 py-3"><div className="flex items-center gap-1"><button type="button" title="Edit" className="btn-ghost p-1" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></button><button type="button" title="Delete" className="btn-ghost p-1 text-red-600" onClick={() => deleteMut.mutate(item.id)}><Trash2 className="h-4 w-4" /></button></div></td>
                            </tr>)}
                        </tbody>
                    </table>
                </div>
                <div className="border-t p-3" style={{ borderColor: 'var(--color-border)' }}><PaginationControls page={page} totalPages={totalPages} pageSize={pageSize} totalItems={sorted.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} /></div>
            </div>

            {showModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>{editing ? 'Edit food place' : 'Add food place'}</h2><button type="button" onClick={closeModal}><X className="h-5 w-5" /></button></div><div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="label">Name<input className="input mt-1" value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} /></label>
                <label className="label">Tag<input className="input mt-1" list="food-tags" value={form.tag} onChange={(e) => setForm((current) => ({ ...current, tag: e.target.value }))} /><datalist id="food-tags">{options.tags.map((value) => <option key={value} value={value} />)}</datalist></label>
                <label className="label">Type<input className="input mt-1" list="food-types" value={form.type} onChange={(e) => setForm((current) => ({ ...current, type: e.target.value }))} /><datalist id="food-types">{options.types.map((value) => <option key={value} value={value} />)}</datalist></label>
                <label className="label">Distance<input className="input mt-1" list="food-distances" value={form.distance} onChange={(e) => setForm((current) => ({ ...current, distance: e.target.value }))} /><datalist id="food-distances">{options.distances.map((value) => <option key={value} value={value} />)}</datalist></label>
                <label className="label">Address<input className="input mt-1" value={form.address} onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))} /></label>
                <label className="label">District<input className="input mt-1" value={form.district} onChange={(e) => setForm((current) => ({ ...current, district: e.target.value }))} /></label>
                <label className="label">Open hours<input className="input mt-1" placeholder="e.g. 08:00–22:00" value={form.openHours} onChange={(e) => setForm((current) => ({ ...current, openHours: e.target.value }))} /></label>
                <label className="label">Price (estimated)<input className="input mt-1" placeholder="e.g. 50.000–100.000đ" value={form.priceEst} onChange={(e) => setForm((current) => ({ ...current, priceEst: e.target.value }))} /></label>
                <label className="label">Rating<select className="input mt-1" value={form.rating} onChange={(e) => setForm((current) => ({ ...current, rating: e.target.value }))}><option value="">Unrated</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label>
                <label className="label">Google Maps URL<input className="input mt-1" type="url" value={form.mapLink} onChange={(e) => setForm((current) => ({ ...current, mapLink: e.target.value }))} /></label>
                <label className="label md:col-span-2">Note<textarea className="input mt-1 min-h-24" value={form.note} onChange={(e) => setForm((current) => ({ ...current, note: e.target.value }))} /></label>
                <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={form.isShared} onChange={(e) => setForm((current) => ({ ...current, isShared: e.target.checked }))} />Shared with family</label>
            </div><div className="mt-6 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button><button type="button" className="btn-primary" disabled={createMut.isPending || updateMut.isPending} onClick={() => void submitForm()}>Save</button></div></div></div>}

            {showOptions && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Manage food options</h2><button type="button" onClick={() => setShowOptions(false)}><X className="h-5 w-5" /></button></div><div className="grid gap-5 md:grid-cols-3">{(['tags', 'types', 'distances'] as OptionKey[]).map((key) => <div key={key}><h3 className="mb-2 font-semibold capitalize" style={{ color: 'var(--color-text)' }}>{key}</h3><div className="mb-2 flex gap-2"><input className="input min-w-0 text-sm" placeholder="Add value" value={newOption[key]} onChange={(e) => setNewOption((current) => ({ ...current, [key]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption(key); } }} /><button type="button" className="btn-secondary p-2" onClick={() => addOption(key)}><Plus className="h-4 w-4" /></button></div><div className="space-y-1">{draftOptions[key].map((value) => <div key={value} className="flex items-center justify-between rounded border px-2 py-1 text-sm" style={{ borderColor: 'var(--color-border)' }}><span>{value}</span><button type="button" className="text-red-600" onClick={() => setDraftOptions((current) => ({ ...current, [key]: current[key].filter((item) => item !== value) }))}><X className="h-3.5 w-3.5" /></button></div>)}</div></div>)}</div><div className="mt-6 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setShowOptions(false)}>Cancel</button><button type="button" className="btn-primary" onClick={saveOptions}>Save options</button></div></div></div>}
        </div>
    );
}
