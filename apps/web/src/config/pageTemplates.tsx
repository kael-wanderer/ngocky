import { lazy, type ComponentType } from 'react';
import type { PageInstanceDto, PageModuleType } from '../api/pages';

export type InstanceTemplateProps = { instanceId: string; pageTitle: string };

const Tasks = lazy(() => import('../pages/goals').then(({ default: Page }) => ({
    default: ({ instanceId, pageTitle }: InstanceTemplateProps) => <Page forcedTab="TASKS" instanceId={instanceId} pageTitle={pageTitle} />,
})));
const Goals = lazy(() => import('../pages/goals').then(({ default: Page }) => ({
    default: ({ instanceId, pageTitle }: InstanceTemplateProps) => <Page forcedTab="GOALS" instanceId={instanceId} pageTitle={pageTitle} />,
})));
const Projects = lazy(() => import('../pages/projects')) as ComponentType<InstanceTemplateProps>;
const Expenses = lazy(() => import('../pages/ExpensesPage')) as ComponentType<InstanceTemplateProps>;
const Ideas = lazy(() => import('../pages/IdeasPage')) as ComponentType<InstanceTemplateProps>;
const Learning = lazy(() => import('../pages/LearningPage')) as ComponentType<InstanceTemplateProps>;

export const INSTANCE_TEMPLATE_REGISTRY: Partial<Record<PageModuleType, ComponentType<InstanceTemplateProps>>> = {
    TASK: Tasks,
    PROJECT: Projects,
    EXPENSE: Expenses,
    GOAL: Goals,
    IDEA: Ideas,
    LEARNING: Learning,
};

export function getInstanceTemplate(page: PageInstanceDto) {
    return INSTANCE_TEMPLATE_REGISTRY[page.moduleType];
}
