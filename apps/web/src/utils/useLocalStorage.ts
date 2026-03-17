import { useState } from 'react';

/**
 * useState that persists to localStorage. On mount, reads saved value and merges
 * with defaultValue (so new keys added to defaultValue are picked up automatically).
 */
export function useLocalStorage<T>(
    key: string,
    defaultValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
    const [state, setStateRaw] = useState<T>(() => {
        try {
            const saved = localStorage.getItem(key);
            if (saved === null) return defaultValue;
            const parsed = JSON.parse(saved);
            // Merge objects so new fields in defaultValue are included
            if (
                typeof defaultValue === 'object' &&
                defaultValue !== null &&
                !Array.isArray(defaultValue)
            ) {
                return { ...(defaultValue as object), ...(parsed as object) } as T;
            }
            return parsed as T;
        } catch {
            return defaultValue;
        }
    });

    const setState = (value: T | ((prev: T) => T)) => {
        setStateRaw((prev) => {
            const next = typeof value === 'function' ? (value as (p: T) => T)(prev) : value;
            try {
                localStorage.setItem(key, JSON.stringify(next));
            } catch {
                // Ignore storage errors (e.g. private mode quota)
            }
            return next;
        });
    };

    return [state, setState];
}
