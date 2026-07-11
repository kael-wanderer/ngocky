import { describe, expect, it } from 'vitest';
import {
    DEFAULT_MOBILE_NAV_ITEMS,
    getFeatureFlags,
    getMobileNavItems,
    isFeatureRouteEnabled,
    isRouteAccessible,
    isPageTemplateEnabled,
} from '../config/features';
import { INSTANCE_TEMPLATE_REGISTRY } from '../config/pageTemplates';

describe('feature flags', () => {
    it('defaults all flags on', () => {
        expect(getFeatureFlags(null).featureGoals).toBe(true);
    });

    it('source overrides default', () => {
        expect(getFeatureFlags({ featureGoals: false }).featureGoals).toBe(false);
    });

    it('unknown route is always enabled', () => {
        expect(isFeatureRouteEnabled('/settings', { featureGoals: false })).toBe(true);
    });

    it('disabled feature blocks its route', () => {
        expect(isFeatureRouteEnabled('/goals', { featureGoals: false })).toBe(false);
    });

    it('mobile nav falls back to defaults when list invalid', () => {
        expect(getMobileNavItems({ mobileNavItems: ['/goals'] })).toEqual([...DEFAULT_MOBILE_NAV_ITEMS]);
    });

    it('route in mobile nav stays accessible even when feature off', () => {
        expect(isRouteAccessible('/goals', { featureGoals: false, mobileNavItems: ['/', '/goals', '/tasks', '/settings'] })).toBe(true);
    });

    it('disabled app group blocks route regardless of user flags', () => {
        expect(isRouteAccessible('/keyboard', { featureKeyboard: true }, ['personal'])).toBe(false);
    });

    it('enabled app group keeps existing user flag behavior', () => {
        expect(isRouteAccessible('/keyboard', { featureKeyboard: true }, ['personal', 'hobby'])).toBe(true);
    });

    it.each([
        ['TASK', 'featureTasks'], ['PROJECT', 'featureProjects'], ['EXPENSE', 'featureExpenses'], ['GOAL', 'featureGoals'],
    ])('maps the available %s template to its component and user flag', (moduleType, featureFlag) => {
        expect(INSTANCE_TEMPLATE_REGISTRY[moduleType as keyof typeof INSTANCE_TEMPLATE_REGISTRY]).toBeDefined();
        expect(isPageTemplateEnabled(moduleType, { [featureFlag]: false })).toBe(false);
    });
});
