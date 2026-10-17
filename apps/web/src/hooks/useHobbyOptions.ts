import { useQuery } from '@tanstack/react-query';
import {
    hobbyOptions,
    type BuiltInCategoryKey,
    type HobbyField,
    type HobbyOptions,
    type HobbyUsage,
} from '../api/hobbyOptions';

const EMPTY_OPTIONS: HobbyOptions = { category: [], condition: [], spec: [], tag: [], color: [] };
const EMPTY_USAGE: HobbyUsage = { category: {}, condition: {}, spec: {}, tag: {}, color: {} };

export function useHobbyOptions(): { options: HobbyOptions; usage: HobbyUsage; isLoading: boolean } {
    const query = useQuery({
        queryKey: ['hobby-options'],
        queryFn: hobbyOptions.list,
        staleTime: 60_000,
    });
    return {
        options: query.data?.options ?? EMPTY_OPTIONS,
        usage: query.data?.usage ?? EMPTY_USAGE,
        isLoading: query.isLoading,
    };
}

export function labelsOf(options: HobbyOptions, field: HobbyField): string[] {
    return options[field].map(({ label }) => label);
}

export function colorOf(options: HobbyOptions, field: HobbyField, label: string): string | undefined {
    return options[field].find((option) => option.label === label)?.color;
}

export function builtInKeyOf(options: HobbyOptions, label: string | null | undefined): BuiltInCategoryKey | undefined {
    if (!label) return undefined;
    return options.category.find((option) => option.label === label)?.builtInKey;
}
