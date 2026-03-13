import React, { useEffect, useRef, useState } from 'react';

const PRESET_COLORS = [
    '#111827',
    '#ef4444',
    '#f97316',
    '#f59e0b',
    '#eab308',
    '#22c55e',
    '#14b8a6',
    '#3b82f6',
    '#6366f1',
    '#8b5cf6',
    '#ec4899',
    '#6b7280',
] as const;

function normalizeHexColor(value: string) {
    const next = value.trim().replace('#', '');
    if (/^[0-9a-fA-F]{6}$/.test(next)) return `#${next.toLowerCase()}`;
    return null;
}

export default function ColorPicker({
    value,
    onChange,
    label,
    storageKey,
    fallbackColor,
    onClear,
    clearLabel = 'Use global',
}: {
    value: string;
    onChange: (next: string) => void;
    label?: string;
    storageKey?: string;
    fallbackColor?: string;
    onClear?: () => void;
    clearLabel?: string;
}) {
    const current = normalizeHexColor(value) || normalizeHexColor(fallbackColor || '') || '#4f46e5';
    const [open, setOpen] = useState(false);
    const [recentColors, setRecentColors] = useState<string[]>([]);
    const wrapperRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!storageKey) return;
        try {
            const stored = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
            if (Array.isArray(stored)) {
                setRecentColors(stored.filter((entry): entry is string => typeof entry === 'string').slice(0, 5));
            }
        } catch {
            setRecentColors([]);
        }
    }, [storageKey]);

    useEffect(() => {
        if (!open) return;

        const handleOutsideClick = (event: MouseEvent) => {
            if (!wrapperRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [open]);

    const handleChange = (nextValue: string, shouldClose = false) => {
        const normalized = normalizeHexColor(nextValue);
        if (!normalized) return;
        onChange(normalized);
        if (storageKey) {
            const nextRecent = [normalized, ...recentColors.filter((entry) => entry !== normalized)].slice(0, 5);
            setRecentColors(nextRecent);
            window.localStorage.setItem(storageKey, JSON.stringify(nextRecent));
        }
        if (shouldClose) setOpen(false);
    };

    return (
        <div ref={wrapperRef} className="relative">
            <div className="flex items-center gap-3">
                {label && <label className="label mb-0">{label}</label>}
                <button
                    type="button"
                    className="h-9 w-9 rounded border border-gray-300 shadow-sm"
                    style={{ backgroundColor: current }}
                    onClick={() => setOpen((currentValue) => !currentValue)}
                    title={`Change color ${current}`}
                />
            </div>
            {recentColors.length > 0 && (
                <div className="mt-3 flex items-center gap-2">
                    {recentColors.slice(0, 5).map((color) => (
                        <button
                            key={color}
                            type="button"
                            className={`h-6 w-6 rounded-full border ${current === color ? 'border-slate-900' : 'border-gray-300'}`}
                            style={{ backgroundColor: color }}
                            onClick={() => handleChange(color)}
                            title={color}
                        />
                    ))}
                </div>
            )}
            {open && (
                <div className="absolute left-0 top-full z-30 mt-3 w-[260px] rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Basic Colors</p>
                    <div className="mt-3 grid grid-cols-4 gap-3">
                        {PRESET_COLORS.map((color) => (
                            <button
                                key={color}
                                type="button"
                                className={`h-9 w-9 rounded-lg border-2 transition-transform hover:scale-[1.03] ${current === color ? 'border-slate-900' : 'border-gray-200'}`}
                                style={{ backgroundColor: color }}
                                onClick={() => handleChange(color, true)}
                                title={color}
                            />
                        ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs text-gray-500">
                            <span>#</span>
                            <input
                                type="text"
                                className="w-24 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700"
                                value={current.slice(1)}
                                onChange={(e) => handleChange(e.target.value)}
                                placeholder="ec4899"
                            />
                        </label>
                        <div className="flex items-center gap-3">
                            {onClear && (
                                <button
                                    type="button"
                                    className="text-xs font-medium text-gray-500 hover:text-gray-800"
                                    onClick={() => {
                                        onClear();
                                        setOpen(false);
                                    }}
                                >
                                    {clearLabel}
                                </button>
                            )}
                            <button
                                type="button"
                                className="text-xs font-medium text-gray-500 hover:text-gray-800"
                                onClick={() => setOpen(false)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
