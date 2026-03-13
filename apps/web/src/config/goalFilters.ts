export type SharedGoalPeriodFilter = 'ALL' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';

export const DEFAULT_GOAL_PERIOD_FILTER: SharedGoalPeriodFilter = 'ALL';

export const GOAL_PERIOD_FILTER_OPTIONS: Array<{ value: SharedGoalPeriodFilter; label: string }> = [
    { value: 'ALL', label: 'All' },
    { value: 'WEEKLY', label: 'Weekly' },
    { value: 'MONTHLY', label: 'Monthly' },
    { value: 'QUARTERLY', label: 'Quarterly' },
];
