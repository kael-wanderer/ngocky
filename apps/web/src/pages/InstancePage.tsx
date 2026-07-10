import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAppSettings } from '../api/appSettings';
import { usePages, type PageInstanceDto } from '../api/pages';
import { getEnabledGroups } from '../config/features';
import GoalsPage from './goals';
import ProjectsPage from './projects';
import ExpensesPage from './ExpensesPage';

export default function InstancePage() {
    const { slug } = useParams();
    const { data: pages, isLoading } = usePages();
    const { data: appSettings } = useAppSettings();

    if (isLoading) return null;
    const page = pages?.find((item) => item.slug === slug);
    if (!page) return <Navigate to="/" replace />;

    const enabledGroups = getEnabledGroups(appSettings?.enabledGroups);
    if (!enabledGroups.includes(page.group)) return <Navigate to="/" replace />;

    const renderPage = (item: PageInstanceDto) => {
        if (item.moduleType === 'TASK') return <GoalsPage forcedTab="TASKS" instanceId={item.id} pageTitle={item.name} />;
        if (item.moduleType === 'PROJECT') return <ProjectsPage instanceId={item.id} pageTitle={item.name} />;
        if (item.moduleType === 'EXPENSE') return <ExpensesPage instanceId={item.id} pageTitle={item.name} />;
        return <GoalsPage forcedTab="GOALS" instanceId={item.id} pageTitle={item.name} />;
    };

    return renderPage(page);
}
