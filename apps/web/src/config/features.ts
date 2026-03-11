export const FEATURE_FLAGS = {
    featureGoals: true,
    featureProjects: true,
    featureIdeas: true,
    featureLearning: true,
    featureExpenses: true,
    featureTasks: true,
    featureHousework: true,
    featureAssets: true,
    featureCalendar: true,
    featureKeyboard: true,
    featureFunds: true,
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;
export type FeatureFlags = Record<FeatureFlagKey, boolean>;

export type FeatureGroup = {
    id: 'personal' | 'family' | 'hobby';
    label: string;
    items: Array<{
        key: FeatureFlagKey;
        label: string;
        route: string;
    }>;
};

export const FEATURE_GROUPS: FeatureGroup[] = [
    {
        id: 'personal',
        label: 'Personal',
        items: [
            { key: 'featureTasks', label: 'Tasks', route: '/tasks' },
            { key: 'featureProjects', label: 'Projects', route: '/projects' },
            { key: 'featureExpenses', label: 'Expenses', route: '/expenses' },
            { key: 'featureGoals', label: 'Goals', route: '/goals' },
            { key: 'featureIdeas', label: 'Ideas', route: '/ideas' },
        ],
    },
    {
        id: 'family',
        label: 'Family',
        items: [
            { key: 'featureCalendar', label: 'Calendar', route: '/calendar' },
            { key: 'featureHousework', label: 'Housework', route: '/housework' },
            { key: 'featureAssets', label: 'Assets', route: '/assets' },
        ],
    },
    {
        id: 'hobby',
        label: 'Hobby',
        items: [
            { key: 'featureKeyboard', label: 'Keyboard', route: '/keyboard' },
            { key: 'featureFunds', label: 'Funds', route: '/funds' },
            { key: 'featureLearning', label: 'Learning', route: '/learning' },
        ],
    },
];

export const FEATURE_ROUTE_MAP = Object.fromEntries(
    FEATURE_GROUPS.flatMap((group) => group.items.map((item) => [item.route, item.key]))
) as Record<string, FeatureFlagKey>;

export function getFeatureFlags(source?: Partial<FeatureFlags> | null): FeatureFlags {
    return {
        ...FEATURE_FLAGS,
        ...(source || {}),
    };
}

export function isFeatureRouteEnabled(route: string, source?: Partial<FeatureFlags> | null) {
    const key = FEATURE_ROUTE_MAP[route];
    if (!key) return true;
    return getFeatureFlags(source)[key];
}
