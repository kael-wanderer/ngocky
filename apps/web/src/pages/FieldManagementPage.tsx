import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GripVertical, Lock, Pencil, Plus, Search, SlidersHorizontal, Trash2, X, Check } from 'lucide-react';
import {
    hobbyOptions,
    type HobbyDeletePayload,
    type HobbyField,
    type HobbyOption,
    type HobbyOptionPayload,
} from '../api/hobbyOptions';
import ColorPicker from '../components/ColorPicker';
import { useHobbyOptions } from '../hooks/useHobbyOptions';

const FIELD_ORDER: HobbyField[] = ['category', 'spec', 'color', 'tag', 'condition'];
const FIELD_LABELS: Record<HobbyField, string> = {
    category: 'Category',
    spec: 'Spec',
    color: 'Color',
    tag: 'Tag',
    condition: 'Condition',
};
const ADD_PLACEHOLDERS: Record<HobbyField, string> = {
    category: 'New category…',
    spec: 'New spec…',
    color: 'New color…',
    tag: 'New tag…',
    condition: 'New condition…',
};
const COLOR_FIELDS: HobbyField[] = ['category', 'color'];

type EditDraft = { field: HobbyField; option: HobbyOption; label: string; color: string };
type Confirmation =
    | { kind: 'rename'; draft: EditDraft }
    | { kind: 'delete'; field: HobbyField; option: HobbyOption; usage: number };
type MutationAction =
    | { kind: 'add'; field: HobbyField; body: HobbyOptionPayload }
    | { kind: 'update'; field: HobbyField; id: string; body: Partial<HobbyOptionPayload> }
    | { kind: 'reorder'; field: HobbyField; ids: string[] }
    | { kind: 'remove'; field: HobbyField; id: string; body: HobbyDeletePayload };

function usageOf(usage: ReturnType<typeof useHobbyOptions>['usage'], field: HobbyField, option: HobbyOption) {
    return usage[field][option.id] ?? 0;
}

function errorMessage(error: unknown) {
    return (error as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (error instanceof Error ? error.message : 'Unable to save hobby options');
}

export default function FieldManagementPage() {
    const { options, usage, isLoading } = useHobbyOptions();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<Partial<Record<HobbyField, boolean>>>({});
    const [edit, setEdit] = useState<EditDraft | null>(null);
    const [addLabels, setAddLabels] = useState<Record<HobbyField, string>>({ category: '', spec: '', color: '', tag: '', condition: '' });
    const [addColors, setAddColors] = useState<Record<HobbyField, string>>({ category: '#6b7280', spec: '#6b7280', color: '#6b7280', tag: '#6b7280', condition: '#6b7280' });
    const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
    const [deleteMode, setDeleteMode] = useState<'move' | 'clear'>('move');
    const [targetId, setTargetId] = useState('');
    const [dragged, setDragged] = useState<{ field: HobbyField; id: string } | null>(null);
    const [errorField, setErrorField] = useState<HobbyField | null>(null);

    const mutation = useMutation({
        mutationFn: async (action: MutationAction) => {
            switch (action.kind) {
                case 'add': return hobbyOptions.add(action.field, action.body);
                case 'update': return hobbyOptions.update(action.field, action.id, action.body);
                case 'reorder': return hobbyOptions.reorder(action.field, action.ids);
                case 'remove': return hobbyOptions.remove(action.field, action.id, action.body);
            }
        },
        onMutate: (action) => setErrorField(action.field),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['hobby-options'] }),
                queryClient.invalidateQueries({ queryKey: ['keyboards'] }),
                queryClient.invalidateQueries({ queryKey: ['funds'] }),
            ]);
            setEdit(null);
            setConfirmation(null);
            setErrorField(null);
        },
    });

    const totalValues = useMemo(() => FIELD_ORDER.reduce((sum, field) => sum + options[field].length, 0), [options]);
    const normalizedSearch = search.trim().toLowerCase();
    const visibleOptions = (field: HobbyField) => options[field].filter((option) => !normalizedSearch || option.label.toLowerCase().includes(normalizedSearch));
    const startEdit = (field: HobbyField, option: HobbyOption) => {
        setConfirmation(null);
        setEdit({ field, option, label: option.label, color: option.color || '#6b7280' });
    };
    const saveEdit = (draft: EditDraft) => {
        const body: Partial<HobbyOptionPayload> = {};
        if (draft.label.trim() !== draft.option.label) body.label = draft.label.trim();
        if (COLOR_FIELDS.includes(draft.field) && draft.color !== (draft.option.color || '#6b7280')) body.color = draft.color;
        if (body.label && usageOf(usage, draft.field, draft.option) > 0) {
            setConfirmation({ kind: 'rename', draft });
            return;
        }
        if (Object.keys(body).length) mutation.mutate({ kind: 'update', field: draft.field, id: draft.option.id, body });
        else setEdit(null);
    };
    const deleteOption = (field: HobbyField, option: HobbyOption) => {
        const count = usageOf(usage, field, option);
        if (count > 0) {
            setDeleteMode('move');
            setTargetId(options[field].find((item) => item.id !== option.id)?.id || '');
            setConfirmation({ kind: 'delete', field, option, usage: count });
            return;
        }
        mutation.mutate({ kind: 'remove', field, id: option.id, body: { mode: 'clear' } });
    };
    const handleDrop = (field: HobbyField, target: string) => {
        if (!dragged || dragged.field !== field || dragged.id === target || mutation.isPending) return;
        const ordered = [...options[field]];
        const sourceIndex = ordered.findIndex(({ id }) => id === dragged.id);
        const targetIndex = ordered.findIndex(({ id }) => id === target);
        if (sourceIndex < 0 || targetIndex < 0) return;
        const [moved] = ordered.splice(sourceIndex, 1);
        ordered.splice(targetIndex, 0, moved);
        setDragged(null);
        mutation.mutate({ kind: 'reorder', field, ids: ordered.map(({ id }) => id) });
    };
    const applyConfirmation = () => {
        if (!confirmation) return;
        if (confirmation.kind === 'rename') {
            const { draft } = confirmation;
            const body: Partial<HobbyOptionPayload> = { label: draft.label.trim() };
            if (COLOR_FIELDS.includes(draft.field)) body.color = draft.color;
            mutation.mutate({ kind: 'update', field: draft.field, id: draft.option.id, body });
            return;
        }
        const body: HobbyDeletePayload = deleteMode === 'move' ? { mode: 'move', targetId } : { mode: 'clear' };
        mutation.mutate({ kind: 'remove', field: confirmation.field, id: confirmation.option.id, body });
    };

    return (
        <div className="p-4 md:p-6 space-y-4" style={{ color: 'var(--color-text)' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
                        <SlidersHorizontal className="h-6 w-6" /> Field Management
                    </h1>
                    <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {FIELD_ORDER.length} fields · {totalValues} values · shared across Hobby
                    </p>
                </div>
                <label className="relative w-full sm:w-56">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search value…" className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-gray-700 dark:bg-gray-900" />
                </label>
            </div>

            {isLoading ? <p style={{ color: 'var(--color-text-secondary)' }}>Loading hobby options…</p> : (
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(290px,1fr))]">
                    {FIELD_ORDER.map((field) => {
                        const matched = visibleOptions(field);
                        const shown = expanded[field] ? matched : matched.slice(0, 6);
                        const isColor = COLOR_FIELDS.includes(field);
                        return (
                            <section key={field} className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                                <header className="flex items-start justify-between gap-2 border-b border-gray-200 px-3.5 py-3 dark:border-gray-700">
                                    <div>
                                        <h2 className="font-semibold">{FIELD_LABELS[field]} <span className="font-normal" style={{ color: 'var(--color-text-secondary)' }}>· {options[field].length}</span></h2>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {(field === 'category' || field === 'condition' ? ['Keyboard', 'Funds'] : ['Keyboard']).map((usedBy) => (
                                                <span key={usedBy} className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700 dark:bg-blue-950 dark:text-blue-300">{usedBy}</span>
                                            ))}
                                        </div>
                                    </div>
                                    {field === 'spec' && <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>order = sort order</span>}
                                </header>

                                <div>
                                    {shown.map((option) => {
                                        const count = usageOf(usage, field, option);
                                        const builtIn = field === 'category' && !!option.builtInKey;
                                        const isEditing = edit?.field === field && edit.option.id === option.id;
                                        return (
                                            <div key={option.id} className={`grid grid-cols-[16px_minmax(0,1fr)_auto_52px] items-center gap-2 px-3.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 ${isEditing ? 'bg-blue-50 dark:bg-blue-950/50' : ''}`} draggable={!mutation.isPending && !isEditing} onDragStart={() => setDragged({ field, id: option.id })} onDragOver={(event) => event.preventDefault()} onDrop={() => handleDrop(field, option.id)}>
                                                <GripVertical className={`h-4 w-4 ${mutation.isPending ? 'cursor-not-allowed opacity-40' : 'cursor-grab'}`} style={{ color: 'var(--color-text-secondary)' }} />
                                                {isEditing && edit ? (
                                                    <div className="flex min-w-0 items-center gap-1.5">
                                                        {isColor && <fieldset disabled={mutation.isPending} className="contents"><ColorPicker value={edit.color} onChange={(color) => setEdit((current) => current ? { ...current, color } : current)} storageKey="hobby-field-colors" /></fieldset>}
                                                        <input autoFocus value={edit.label} disabled={mutation.isPending} onChange={(event) => setEdit({ ...edit, label: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') saveEdit(edit); if (event.key === 'Escape') setEdit(null); }} className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-sm disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800" />
                                                    </div>
                                                ) : (
                                                    <span className={field === 'spec' ? 'min-w-0' : 'min-w-0 truncate'} style={isColor ? { color: option.color || '#6b7280', fontWeight: 600 } : undefined}>
                                                        {isColor && <span className="mr-1.5 inline-block h-3 w-3 rounded-sm align-[-1px]" style={{ backgroundColor: option.color || '#6b7280' }} />}
                                                        {field === 'spec' ? <span className="inline-block rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300">{option.label}</span> : option.label}
                                                    </span>
                                                )}
                                                <span className="min-w-6 text-right text-xs" style={{ color: 'var(--color-text-secondary)' }}>{count}</span>
                                                <span className="flex items-center justify-end gap-1">
                                                    {isEditing && edit ? (
                                                        <>
                                                            <button type="button" disabled={mutation.isPending} onClick={() => saveEdit(edit)} title="Save" className="rounded p-1 text-blue-600 disabled:opacity-40"><Check className="h-4 w-4" /></button>
                                                            <button type="button" disabled={mutation.isPending} onClick={() => setEdit(null)} title="Cancel" className="rounded p-1 disabled:opacity-40" style={{ color: 'var(--color-text-secondary)' }}><X className="h-4 w-4" /></button>
                                                        </>
                                                    ) : builtIn ? (
                                                        <>
                                                            <button type="button" disabled={mutation.isPending} onClick={() => startEdit(field, option)} title="Edit built-in category" className="rounded p-1 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-800"><Pencil className="h-3.5 w-3.5" /></button>
                                                            <span title="Built-in: can rename/recolor, not delete" className="p-1" style={{ color: 'var(--color-text-secondary)' }}><Lock className="h-3.5 w-3.5" /></span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button type="button" disabled={mutation.isPending} onClick={() => startEdit(field, option)} title="Edit" className="rounded p-1 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-800"><Pencil className="h-3.5 w-3.5" /></button>
                                                            <button type="button" disabled={mutation.isPending} onClick={() => deleteOption(field, option)} title="Delete" className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-950"><Trash2 className="h-3.5 w-3.5" /></button>
                                                        </>
                                                    )}
                                                </span>
                                            </div>
                                        );
                                    })}
                                    {matched.length > 6 && (
                                        <button type="button" onClick={() => setExpanded((current) => ({ ...current, [field]: !current[field] }))} className="px-3.5 py-1 text-xs text-blue-600">
                                            {expanded[field] ? 'Show less' : `Show all ${matched.length} ▾`}
                                        </button>
                                    )}
                                </div>

                                {field === 'category' && <p className="px-3.5 pb-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>🔒 Built-in: drives auto-create, summary cards, price colors.</p>}
                                {errorField === field && mutation.isError && <p role="alert" className="px-3.5 pb-2 text-sm text-red-600">{errorMessage(mutation.error)}</p>}
                                <form className="flex items-center gap-1.5 border-t border-gray-200 px-3.5 py-2.5 dark:border-gray-700" onSubmit={(event) => {
                                    event.preventDefault();
                                    const label = addLabels[field].trim();
                                    if (!label || mutation.isPending) return;
                                    mutation.mutate({ kind: 'add', field, body: { label, ...(isColor ? { color: addColors[field] } : {}) } });
                                    setAddLabels((current) => ({ ...current, [field]: '' }));
                                }}>
                                    {isColor && <fieldset disabled={mutation.isPending} className="contents"><ColorPicker value={addColors[field]} onChange={(color) => setAddColors((current) => ({ ...current, [field]: color }))} storageKey="hobby-field-colors" /></fieldset>}
                                    <input value={addLabels[field]} onChange={(event) => setAddLabels((current) => ({ ...current, [field]: event.target.value }))} disabled={mutation.isPending} placeholder={ADD_PLACEHOLDERS[field]} className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900" />
                                    <button type="submit" disabled={mutation.isPending || !addLabels[field].trim()} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> Add</button>
                                </form>
                            </section>
                        );
                    })}
                </div>
            )}

            {confirmation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900">
                        {confirmation.kind === 'rename' ? (
                            <>
                                <h2 className="text-lg font-bold">Rename value?</h2>
                                <p className="mt-2">{FIELD_LABELS[confirmation.draft.field]} “{confirmation.draft.option.label}” → <strong>“{confirmation.draft.label.trim()}”</strong></p>
                                <p className="mt-3 rounded-lg bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                                    {confirmation.draft.field === 'category' || confirmation.draft.field === 'condition'
                                        ? `${usageOf(usage, confirmation.draft.field, confirmation.draft.option)} records across keyboards and funds use this ${confirmation.draft.field}. They will be updated too.`
                                        : `${usageOf(usage, confirmation.draft.field, confirmation.draft.option)} keyboards use this ${confirmation.draft.field}. They will be updated too.`}
                                </p>
                            </>
                        ) : (
                            <>
                                <h2 className="text-lg font-bold">Delete {FIELD_LABELS[confirmation.field].toLowerCase()} “{confirmation.option.label}”?</h2>
                                <p className="mt-3 rounded-lg bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                                    {confirmation.usage} {confirmation.field === 'category' || confirmation.field === 'condition' ? 'records across keyboards and funds' : 'keyboards'} use this value.
                                </p>
                                <label className="mt-3 flex items-center gap-2 text-sm">
                                    <input type="radio" checked={deleteMode === 'move'} onChange={() => setDeleteMode('move')} disabled={mutation.isPending} />
                                    Move them to
                                    <select value={targetId} onChange={(event) => setTargetId(event.target.value)} disabled={mutation.isPending || deleteMode !== 'move'} className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-800">
                                        {options[confirmation.field].filter(({ id }) => id !== confirmation.option.id).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                                    </select>
                                </label>
                                {!((confirmation.field === 'category') || (confirmation.field === 'condition')) && (
                                    <label className="mt-2 flex items-center gap-2 text-sm"><input type="radio" checked={deleteMode === 'clear'} onChange={() => setDeleteMode('clear')} disabled={mutation.isPending} /> Clear {confirmation.field} on those keyboards</label>
                                )}
                            </>
                        )}
                        {mutation.isError && <p role="alert" className="mt-3 text-sm text-red-600">{errorMessage(mutation.error)}</p>}
                        <div className="mt-5 flex justify-end gap-2">
                            <button type="button" disabled={mutation.isPending} onClick={() => setConfirmation(null)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-50 dark:border-gray-700">Cancel</button>
                            <button type="button" disabled={mutation.isPending || (confirmation.kind === 'delete' && deleteMode === 'move' && !targetId)} onClick={applyConfirmation} className={`rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50 ${confirmation.kind === 'delete' ? 'bg-red-600' : 'bg-blue-600'}`}>
                                {confirmation.kind === 'delete' ? 'Delete' : 'Rename'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
