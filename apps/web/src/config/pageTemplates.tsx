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
const Calendar = lazy(() => import('../pages/CalendarPage')) as ComponentType<InstanceTemplateProps>;
const CaKeo = lazy(() => import('../pages/CaKeoPage')) as ComponentType<InstanceTemplateProps>;
const Housework = lazy(() => import('../pages/HouseworkPage')) as ComponentType<InstanceTemplateProps>;
const Assets = lazy(() => import('../pages/AssetsPage')) as ComponentType<InstanceTemplateProps>;
const Healthbook = lazy(() => import('../pages/healthbook')) as ComponentType<InstanceTemplateProps>;
const Keyboard = lazy(() => import('../pages/KeyboardPage')) as ComponentType<InstanceTemplateProps>;
const Food = lazy(() => import('../pages/FoodPage')) as ComponentType<InstanceTemplateProps>;
const Funds = lazy(() => import('../pages/FundsPage')) as ComponentType<InstanceTemplateProps>;

export const INSTANCE_TEMPLATE_REGISTRY: Partial<Record<PageModuleType, ComponentType<InstanceTemplateProps>>> = {
    TASK: Tasks,
    PROJECT: Projects,
    EXPENSE: Expenses,
    GOAL: Goals,
    IDEA: Ideas,
    LEARNING: Learning,
    CALENDAR: Calendar,
    CAKEO: CaKeo,
    HOUSEWORK: Housework,
    ASSET: Assets,
    HEALTHBOOK: Healthbook,
    KEYBOARD: Keyboard,
    FOODPLACE: Food,
    FUND: Funds,
};

export function getInstanceTemplate(page: PageInstanceDto) {
    return INSTANCE_TEMPLATE_REGISTRY[page.moduleType];
}
