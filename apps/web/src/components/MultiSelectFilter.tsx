import React, { useEffect, useRef } from 'react';

function toggleArr(arr: string[], val: string): string[] {
    return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

export default function MultiSelectFilter({
    label,
    allLabel,
    options,
    selected,
    onChange,
    className = '',
    open,
    onOpenChange,
}: {
    label: string;
    allLabel: string;
    options: { value: string; label: string }[];
    selected: string[];
    onChange: (values: string[]) => void;
    className?: string;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const summary = selected.length === 0
        ? allLabel
        : selected.length === 1
            ? options.find((option) => option.value === selected[0])?.label ?? selected[0]
            : `${selected.length} selected`;

    useEffect(() => {
        if (!open) return;

        function handlePointerDown(event: MouseEvent) {
            if (!rootRef.current?.contains(event.target as Node)) {
                onOpenChange?.(false);
            }
        }

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [open, onOpenChange]);

    return (
        <div ref={rootRef} className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => onOpenChange?.(!open)}
                className="w-full text-left cursor-pointer text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 whitespace-nowrap overflow-hidden text-ellipsis"
            >
                {summary}
            </button>
            {open && (
                <div className="absolute left-0 z-20 mt-2 w-full min-w-[180px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-2 max-h-64 overflow-y-auto">
                    <div className="mb-2 flex items-center justify-between px-1">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
                        {selected.length > 0 && (
                            <button
                                type="button"
                                onClick={() => onChange([])}
                                className="text-xs text-gray-400 hover:text-red-500"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    <div className="space-y-1">
                        {options.map((option) => (
                            <label key={option.value} className="flex items-center gap-2 rounded px-2 py-1 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selected.includes(option.value)}
                                    onChange={() => onChange(toggleArr(selected, option.value))}
                                    className="rounded"
                                />
                                <span>{option.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
