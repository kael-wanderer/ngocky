import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAppSettings } from '../api/appSettings';
import { usePages } from '../api/pages';
import { getEnabledGroups } from '../config/features';
import { getInstanceTemplate } from '../config/pageTemplates';

export default function InstancePage() {
    const { slug } = useParams();
    const { data: pages, isLoading } = usePages();
    const { data: appSettings } = useAppSettings();

    if (isLoading) return null;
    const page = pages?.find((item) => item.slug === slug);
    if (!page) return <Navigate to="/" replace />;

    const enabledGroups = getEnabledGroups(appSettings?.enabledGroups);
    if (!enabledGroups.includes(page.group)) return <Navigate to="/" replace />;

    const Template = getInstanceTemplate(page);
    if (!Template) return <div className="p-6" style={{ color: 'var(--color-text-secondary)' }}>This page template is not supported by this version.</div>;
    return <Template instanceId={page.id} pageTitle={page.name} />;
}
