import { useState } from 'react';
import { Columns3 } from 'lucide-react';
import { useLocalStorage } from '../utils/useLocalStorage';

export type ColumnDef = { key: string; label: string };

export function useHiddenColumns(storageKey: string) {
    const [hidden, setHidden] = useLocalStorage<string[]>(storageKey, []);
    return {
        hidden,
        toggle: (key: string) => setHidden((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]),
        isVisible: (key: string) => !hidden.includes(key),
    };
}

export default function ColumnToggle({ columns, hidden, onToggle }: { columns: ColumnDef[]; hidden: string[]; onToggle: (key: string) => void }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => setOpen((current) => !current)}><Columns3 className="h-4 w-4" />Columns</button>
            {open && <>
                <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                <div className="card absolute right-0 z-50 mt-1 w-52 p-2 shadow-lg">
                    {columns.map((column) => <label key={column.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm" style={{ color: 'var(--color-text)' }}>
                        <input type="checkbox" checked={!hidden.includes(column.key)} onChange={() => onToggle(column.key)} />{column.label}
                    </label>)}
                </div>
            </>}
        </div>
    );
}
