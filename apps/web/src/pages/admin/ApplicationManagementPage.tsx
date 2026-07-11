import { useEffect, useMemo, useState } from 'react';
import { AppWindow, Plus } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { useAppSettings, useUpdateAppSettings, type ModuleGroupId } from '../../api/appSettings';
import { getPageDeletePreview, useCreatePage, useDeletePage, usePages, usePageTemplates, useUpdatePage, type PageInstanceDto, type PageModuleType } from '../../api/pages';
import PageManagementTable from '../../components/PageManagementTable';

export default function ApplicationManagementPage() {
    const user = useAuthStore((state) => state.user);
    const isOwner = user?.role === 'OWNER';
    const { data: appSettings } = useAppSettings();
    const { data: templates = [] } = usePageTemplates();
    const { data: pages = [] } = usePages();
    const updateSettings = useUpdateAppSettings();
    const createPage = useCreatePage();
    const updatePage = useUpdatePage();
    const deletePage = useDeletePage();
    const [appName, setAppName] = useState('NgốcKý');
    const [enabledGroups, setEnabledGroups] = useState<ModuleGroupId[]>(['personal', 'family', 'hobby']);
    const [templateType, setTemplateType] = useState<PageModuleType>('TASK');
    const [pageName, setPageName] = useState('');
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [message, setMessage] = useState('');

    const availableTemplates = useMemo(() => templates.filter((item) => item.available), [templates]);
    const selectedTemplate = templates.find((item) => item.moduleType === templateType);

    useEffect(() => {
        if (!appSettings) return;
        setAppName(appSettings.appName);
        setEnabledGroups(appSettings.enabledGroups);
    }, [appSettings]);

    useEffect(() => {
        Promise.all(pages.map(async (page) => [page.id, (await getPageDeletePreview(page.id)).itemCount] as const))
            .then((entries) => setCounts(Object.fromEntries(entries)))
            .catch(() => setCounts({}));
    }, [pages]);

    const rename = async (page: PageInstanceDto) => {
        const name = window.prompt('New page name', page.name)?.trim();
        if (!name || name === page.name) return;
        await updatePage.mutateAsync({ id: page.id, body: { name } });
        setMessage('Page renamed. Its URL remains unchanged.');
    };

    const remove = async (page: PageInstanceDto) => {
        const preview = await getPageDeletePreview(page.id);
        const confirmation = window.prompt(`Deleting ${page.name} will also delete ${preview.itemCount} ${preview.rootLabel}. Type the page name to continue.`);
        if (confirmation !== page.name) return;
        await deletePage.mutateAsync(page.id);
        setMessage('Page deleted.');
    };

    return (
        <div className="space-y-6 pb-20 lg:pb-0 max-w-6xl">
            <div className="flex items-center gap-3"><AppWindow className="w-6 h-6" style={{ color: 'var(--color-primary)' }} /><div><h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Application Management</h2><p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Manage application availability and custom pages.</p></div></div>
            {message && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{message}</div>}

            {isOwner && <section className="space-y-4 border-b pb-6" style={{ borderColor: 'var(--color-border)' }}>
                <h3 className="font-semibold">Application identity</h3>
                <div className="grid gap-4 md:grid-cols-[minmax(240px,420px)_1fr]"><div><label className="label" htmlFor="application-name">App name</label><input id="application-name" className="input" value={appName} onChange={(event) => setAppName(event.target.value)} /></div>
                    <div><span className="label">Enabled groups</span><div className="flex flex-wrap gap-4 pt-2">{(['personal', 'family', 'hobby'] as ModuleGroupId[]).map((group) => <label key={group} className="flex items-center gap-2 capitalize"><input type="checkbox" checked={enabledGroups.includes(group)} disabled={group === 'personal'} onChange={(event) => setEnabledGroups((current) => event.target.checked ? [...new Set([...current, group])] : current.filter((item) => item !== group))} />{group}</label>)}</div></div></div>
                <button className="btn-primary" disabled={updateSettings.isPending} onClick={async () => { await updateSettings.mutateAsync({ appName, enabledGroups }); setMessage('Application settings saved.'); }}>Save</button>
            </section>}

            <section className="space-y-4">
                <div><h3 className="font-semibold">Pages</h3><p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Built-in pages are fixed. Custom pages use the selected template and its assigned group.</p></div>
                <form className="grid gap-3 sm:grid-cols-[minmax(180px,1fr)_minmax(220px,2fr)_auto]" onSubmit={async (event) => { event.preventDefault(); if (!selectedTemplate || !pageName.trim()) return; await createPage.mutateAsync({ name: pageName.trim(), moduleType: selectedTemplate.moduleType, group: selectedTemplate.group }); setPageName(''); setMessage('Page created.'); }}>
                    <select aria-label="Page template" className="input" value={templateType} onChange={(event) => setTemplateType(event.target.value as PageModuleType)}>{availableTemplates.map((template) => <option key={template.moduleType} value={template.moduleType}>{template.label} · {template.group}</option>)}</select>
                    <input aria-label="Page name" className="input" placeholder="Page name" value={pageName} onChange={(event) => setPageName(event.target.value)} />
                    <button className="btn-primary inline-flex items-center gap-2" disabled={!pageName.trim() || createPage.isPending}><Plus className="w-4 h-4" />Create</button>
                </form>
                <PageManagementTable templates={templates} pages={pages} counts={counts} onRename={rename} onDelete={remove} />
            </section>
        </div>
    );
}
