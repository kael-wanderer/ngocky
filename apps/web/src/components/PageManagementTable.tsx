import { useState } from 'react';
import { Pencil, RotateCcw, Trash2 } from 'lucide-react';
import type { PageInstanceDto, PageTemplateDto } from '../api/pages';

type Props = {
    templates: PageTemplateDto[];
    pages: PageInstanceDto[];
    counts?: Record<string, number>;
    onRename: (page: PageInstanceDto, name: string) => void;
    onDelete: (page: PageInstanceDto) => void;
    onRenameBuiltIn: (template: PageTemplateDto, name: string) => void;
    onToggleBuiltIn: (template: PageTemplateDto) => void;
};

function InlineRename({ value, onSave, onCancel }: { value: string; onSave: (name: string) => void; onCancel: () => void }) {
    const [draft, setDraft] = useState(value);
    return (
        <input
            autoFocus
            className="input py-1"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={onCancel}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    const trimmed = draft.trim();
                    if (trimmed && trimmed !== value) onSave(trimmed);
                    else onCancel();
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    onCancel();
                }
            }}
        />
    );
}

export default function PageManagementTable({ templates, pages, counts = {}, onRename, onDelete, onRenameBuiltIn, onToggleBuiltIn }: Props) {
    const [editingKey, setEditingKey] = useState<string | null>(null);

    return (
        <div className="overflow-x-auto border rounded-lg" style={{ borderColor: 'var(--color-border)' }}>
            <table className="w-full text-sm">
                <thead style={{ backgroundColor: 'var(--color-bg)' }}><tr className="text-left">
                    <th className="p-3">Page</th><th className="p-3">Group</th><th className="p-3">Template</th><th className="p-3">Status</th><th className="p-3 w-24">Actions</th>
                </tr></thead>
                <tbody>
                    {templates.map((template) => {
                        const key = `built-in-${template.moduleType}`;
                        return (
                            <tr key={key} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                                <td className="p-3 font-medium">
                                    {editingKey === key
                                        ? <InlineRename value={template.name} onSave={(name) => { onRenameBuiltIn(template, name); setEditingKey(null); }} onCancel={() => setEditingKey(null)} />
                                        : template.name}
                                </td>
                                <td className="p-3 capitalize">{template.group}</td><td className="p-3">{template.label}</td><td className="p-3">Built-in · {template.visible ? 'Visible' : 'Removed'}</td>
                                <td className="p-3"><div className="flex gap-1">
                                    <button type="button" title="Rename page" className="p-2 rounded hover:bg-gray-50" onClick={() => setEditingKey(key)}><Pencil className="w-4 h-4" /></button>
                                    <button type="button" title={template.visible ? 'Delete page' : 'Restore page'} className={`p-2 rounded ${template.visible ? 'text-red-600 hover:bg-red-50' : 'text-emerald-700 hover:bg-emerald-50'}`} onClick={() => onToggleBuiltIn(template)}>{template.visible ? <Trash2 className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}</button>
                                </div></td>
                            </tr>
                        );
                    })}
                    {pages.map((page) => {
                        const key = `page-${page.id}`;
                        return (
                            <tr key={key} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                                <td className="p-3 font-medium">
                                    {editingKey === key
                                        ? <InlineRename value={page.name} onSave={(name) => { onRename(page, name); setEditingKey(null); }} onCancel={() => setEditingKey(null)} />
                                        : page.name}
                                </td>
                                <td className="p-3 capitalize">{page.group}</td><td className="p-3">{templates.find((item) => item.moduleType === page.moduleType)?.label ?? page.moduleType}</td><td className="p-3">Custom · {counts[page.id] ?? 0} items</td>
                                <td className="p-3"><div className="flex gap-1">
                                    <button type="button" title="Rename page" className="p-2 rounded hover:bg-gray-50" onClick={() => setEditingKey(key)}><Pencil className="w-4 h-4" /></button>
                                    <button type="button" title="Delete page" className="p-2 rounded text-red-600 hover:bg-red-50" onClick={() => onDelete(page)}><Trash2 className="w-4 h-4" /></button>
                                </div></td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
