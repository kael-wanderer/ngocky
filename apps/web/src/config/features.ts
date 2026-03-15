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
    featureCaKeo: true,
    featureHealthbook: true,
} as const;

export const MOBILE_NAV_OPTIONS = [
    { to: '/', label: 'Dashboard' },
    { to: '/reports', label: 'Report' },
    { to: '/tasks', label: 'Tasks' },
    { to: '/projects', label: 'Projects' },
    { to: '/expenses', label: 'Expenses' },
    { to: '/goals', label: 'Goals' },
    { to: '/ideas', label: 'Ideas' },
    { to: '/calendar', label: 'Calendar' },
    { to: '/cakeo', label: 'Ca Keo' },
    { to: '/housework', label: 'Housework' },
    { to: '/assets', label: 'Assets' },
    { to: '/healthbook', label: 'Healthbook' },
    { to: '/keyboard', label: 'Keyboard' },
    { to: '/funds', label: 'Funds' },
    { to: '/learning', label: 'Learning' },
    { to: '/settings', label: 'User Settings' },
] as const;

export const DEFAULT_MOBILE_NAV_ITEMS = ['/', '/goals', '/tasks', '/calendar', '/settings'] as const;

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
            { key: 'featureCaKeo', label: 'Ca Keo', route: '/cakeo' },
            { key: 'featureHousework', label: 'Housework', route: '/housework' },
            { key: 'featureAssets', label: 'Assets', route: '/assets' },
            { key: 'featureHealthbook', label: 'Healthbook', route: '/healthbook' },
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

export function getMobileNavItems(source?: (Partial<FeatureFlags> & { mobileNavItems?: string[] | null }) | null) {
    const allowed = new Set<string>(MOBILE_NAV_OPTIONS.map((item) => item.to));
    const raw = Array.isArray(source?.mobileNavItems) ? source.mobileNavItems : [];
    const unique = raw.filter((route, index) => allowed.has(route) && raw.indexOf(route) === index);
    if (unique.length >= 3 && unique.length <= 6) return unique;
    return [...DEFAULT_MOBILE_NAV_ITEMS];
}

export function isRouteAccessible(route: string, source?: (Partial<FeatureFlags> & { mobileNavItems?: string[] | null }) | null) {
    if (isFeatureRouteEnabled(route, source)) return true;
    return getMobileNavItems(source).includes(route);
}
