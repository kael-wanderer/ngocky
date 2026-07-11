import { useEffect, useMemo, useState } from 'react';
import { AppWindow, Camera, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { useAppSettings, useUpdateAppSettings, type ModuleGroupId } from '../../api/appSettings';
import { getPageDeletePreview, useCreatePage, useDeletePage, usePages, usePageTemplates, useResetTemplateOverride, useUpdateBuiltInPage, useUpdatePage, useUpdateTemplateOverride, type PageInstanceDto, type PageModuleType, type PageTemplateDto } from '../../api/pages';
import PageManagementTable from '../../components/PageManagementTable';

function resizeLogo(file: File, maxSize = 256): Promise<string> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const url = URL.createObjectURL(file);
        image.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));
            canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png'));
        };
        image.onerror = reject;
        image.src = url;
    });
}

export default function ApplicationManagementPage() {
    const user = useAuthStore((state) => state.user);
    const isOwner = user?.role === 'OWNER';
    const { data: appSettings } = useAppSettings();
    const { data: templates = [] } = usePageTemplates();
    const { data: pages = [] } = usePages();
    const updateSettings = useUpdateAppSettings();
    const createPage = useCreatePage();
    const updatePage = useUpdatePage();
    const updateBuiltInPage = useUpdateBuiltInPage();
    const deletePage = useDeletePage();
    const updateTemplateOverride = useUpdateTemplateOverride();
    const resetTemplateOverride = useResetTemplateOverride();
    const [appName, setAppName] = useState('NgốcKý');
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [enabledGroups, setEnabledGroups] = useState<ModuleGroupId[]>(['personal', 'family', 'hobby']);
    const [templateType, setTemplateType] = useState<PageModuleType>('TASK');
    const [moduleGroup, setModuleGroup] = useState<ModuleGroupId>('personal');
    const [pageName, setPageName] = useState('');
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [message, setMessage] = useState('');

    const groupTemplates = useMemo(() => templates.filter((item) => item.group === moduleGroup), [moduleGroup, templates]);
    const availableTemplates = useMemo(() => groupTemplates.filter((item) => item.available), [groupTemplates]);
    const selectedTemplate = availableTemplates.find((item) => item.moduleType === templateType) ?? availableTemplates[0];

    useEffect(() => {
        if (!appSettings) return;
        setAppName(appSettings.appName);
        setLogoUrl(appSettings.logoUrl);
        setEnabledGroups(appSettings.enabledGroups);
    }, [appSettings]);

    useEffect(() => {
        if (selectedTemplate && selectedTemplate.moduleType !== templateType) setTemplateType(selectedTemplate.moduleType);
    }, [selectedTemplate, templateType]);

    useEffect(() => {
        Promise.all(pages.map(async (page) => [page.id, (await getPageDeletePreview(page.id)).itemCount] as const))
            .then((entries) => setCounts(Object.fromEntries(entries)))
            .catch(() => setCounts({}));
    }, [pages]);

    const rename = async (page: PageInstanceDto, name: string) => {
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

    const renameBuiltIn = async (template: PageTemplateDto, name: string) => {
        await updateBuiltInPage.mutateAsync({ moduleType: template.moduleType, body: { name } });
        setMessage('Built-in page renamed.');
    };

    const toggleBuiltIn = async (template: PageTemplateDto) => {
        if (template.visible && !window.confirm(`Remove ${template.name} from the application? Existing data will be preserved.`)) return;
        await updateBuiltInPage.mutateAsync({ moduleType: template.moduleType, body: { visible: !template.visible } });
        setMessage(template.visible ? 'Page removed. Existing data was preserved.' : 'Page restored.');
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

            {isOwner && <section className="space-y-4 border-b pb-6" style={{ borderColor: 'var(--color-border)' }}>
                <div><h3 className="font-semibold">Application logo</h3><p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Upload a square PNG, JPG, GIF, or WebP image for the top-left sidebar logo.</p></div>
                <div className="flex items-center gap-4">
                    <img src={logoUrl || '/ladybug-logo.svg'} alt="Application logo preview" className="w-16 h-16 object-contain border rounded-lg p-1" style={{ borderColor: 'var(--color-border)' }} />
                    <label className="btn-secondary inline-flex items-center gap-2 cursor-pointer"><Camera className="w-4 h-4" />Upload<input className="sr-only" type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const nextLogo = await resizeLogo(file); setLogoUrl(nextLogo); await updateSettings.mutateAsync({ logoUrl: nextLogo }); setMessage('Application logo updated.'); } catch { setMessage('Could not process that image.'); } event.target.value = ''; }} /></label>
                    {logoUrl && <button type="button" className="btn-ghost inline-flex items-center gap-2 text-red-600" onClick={async () => { setLogoUrl(null); await updateSettings.mutateAsync({ logoUrl: null }); setMessage('Default logo restored.'); }}><Trash2 className="w-4 h-4" />Remove</button>}
                </div>
            </section>}

            <section className="space-y-4">
                <div><h3 className="font-semibold">Pages</h3><p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Rename or remove built-in pages, and create new pages from templates within a module.</p></div>
                <form className="grid gap-3 sm:grid-cols-[minmax(150px,1fr)_minmax(180px,1fr)_minmax(220px,2fr)_auto]" onSubmit={async (event) => { event.preventDefault(); if (!selectedTemplate || !pageName.trim()) return; await createPage.mutateAsync({ name: pageName.trim(), moduleType: selectedTemplate.moduleType, group: moduleGroup }); setPageName(''); setMessage('Page created.'); }}>
                    <div><label className="label" htmlFor="page-module">Module</label><select id="page-module" className="input capitalize" value={moduleGroup} onChange={(event) => setModuleGroup(event.target.value as ModuleGroupId)}><option value="personal">Personal</option><option value="family">Family</option><option value="hobby">Hobby</option></select></div>
                    <div><label className="label" htmlFor="page-template">Template</label><select id="page-template" className="input" value={selectedTemplate?.moduleType ?? ''} disabled={groupTemplates.length === 0} onChange={(event) => setTemplateType(event.target.value as PageModuleType)}>{groupTemplates.length === 0 && <option value="">No templates available yet</option>}{groupTemplates.map((template) => <option key={template.moduleType} value={template.moduleType} disabled={!template.available}>{template.label}{!template.available && ' (Coming soon)'}</option>)}</select></div>
                    <div><label className="label" htmlFor="page-name">Page name</label><input id="page-name" className="input" placeholder="Page name" value={pageName} onChange={(event) => setPageName(event.target.value)} /></div>
                    <button className="btn-primary inline-flex items-center gap-2 self-end" disabled={!selectedTemplate || !pageName.trim() || createPage.isPending}><Plus className="w-4 h-4" />Create</button>
                </form>
                <PageManagementTable templates={templates} pages={pages} counts={counts} onRename={rename} onDelete={remove} onRenameBuiltIn={renameBuiltIn} onToggleBuiltIn={toggleBuiltIn} />
            </section>

            {isOwner && <section className="space-y-4 border-t pt-6" style={{ borderColor: 'var(--color-border)' }}>
                <div><h3 className="font-semibold">Template management</h3><p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Rename a template's display label or move it to a different module for this installation.</p></div>
                <TemplateOverrideTable
                    templates={templates}
                    onSave={async (template, changes) => { await updateTemplateOverride.mutateAsync({ moduleType: template.moduleType, body: changes }); setMessage(`${template.label} updated.`); }}
                    onReset={async (template) => { await resetTemplateOverride.mutateAsync(template.moduleType); setMessage(`${template.label} reset to default.`); }}
                />
            </section>}
        </div>
    );
}

function TemplateOverrideTable({ templates, onSave, onReset }: {
    templates: PageTemplateDto[];
    onSave: (template: PageTemplateDto, changes: { label?: string; group?: ModuleGroupId }) => void;
    onReset: (template: PageTemplateDto) => void;
}) {
    const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});

    return (
        <div className="overflow-x-auto border rounded-lg" style={{ borderColor: 'var(--color-border)' }}>
            <table className="w-full text-sm">
                <thead style={{ backgroundColor: 'var(--color-bg)' }}><tr className="text-left">
                    <th className="p-3">Template label</th><th className="p-3">Module</th><th className="p-3 w-24">Actions</th>
                </tr></thead>
                <tbody>
                    {templates.map((template) => {
                        const draft = labelDrafts[template.moduleType] ?? template.label;
                        return (
                            <tr key={template.moduleType} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                                <td className="p-3">
                                    <input
                                        className="input py-1"
                                        value={draft}
                                        onChange={(event) => setLabelDrafts((current) => ({ ...current, [template.moduleType]: event.target.value }))}
                                        onBlur={() => { const trimmed = draft.trim(); if (trimmed && trimmed !== template.label) onSave(template, { label: trimmed }); }}
                                        onKeyDown={(event) => { if (event.key === 'Enter') (event.target as HTMLInputElement).blur(); }}
                                    />
                                </td>
                                <td className="p-3 capitalize">
                                    <select className="input capitalize" value={template.group} onChange={(event) => onSave(template, { group: event.target.value as ModuleGroupId })}>
                                        <option value="personal">Personal</option><option value="family">Family</option><option value="hobby">Hobby</option>
                                    </select>
                                </td>
                                <td className="p-3"><button type="button" title="Reset to default" className="p-2 rounded hover:bg-gray-50" onClick={() => onReset(template)}><RotateCcw className="w-4 h-4" /></button></td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
