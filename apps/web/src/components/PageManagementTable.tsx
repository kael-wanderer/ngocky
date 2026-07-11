import { Pencil, RotateCcw, Trash2 } from 'lucide-react';
import type { PageInstanceDto, PageTemplateDto } from '../api/pages';

type Props = {
    templates: PageTemplateDto[];
    pages: PageInstanceDto[];
    counts?: Record<string, number>;
    onRename: (page: PageInstanceDto) => void;
    onDelete: (page: PageInstanceDto) => void;
    onRenameBuiltIn: (template: PageTemplateDto) => void;
    onToggleBuiltIn: (template: PageTemplateDto) => void;
};

export default function PageManagementTable({ templates, pages, counts = {}, onRename, onDelete, onRenameBuiltIn, onToggleBuiltIn }: Props) {
    return (
        <div className="overflow-x-auto border rounded-lg" style={{ borderColor: 'var(--color-border)' }}>
            <table className="w-full text-sm">
                <thead style={{ backgroundColor: 'var(--color-bg)' }}><tr className="text-left">
                    <th className="p-3">Page</th><th className="p-3">Group</th><th className="p-3">Template</th><th className="p-3">Status</th><th className="p-3 w-24">Actions</th>
                </tr></thead>
                <tbody>
                    {templates.map((template) => (
                        <tr key={`built-in-${template.moduleType}`} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                            <td className="p-3 font-medium">{template.name}</td><td className="p-3 capitalize">{template.group}</td><td className="p-3">{template.label}</td><td className="p-3">Built-in · {template.visible ? 'Visible' : 'Removed'}</td>
                            <td className="p-3"><div className="flex gap-1">
                                <button type="button" title="Rename page" className="p-2 rounded hover:bg-gray-50" onClick={() => onRenameBuiltIn(template)}><Pencil className="w-4 h-4" /></button>
                                <button type="button" title={template.visible ? 'Delete page' : 'Restore page'} className={`p-2 rounded ${template.visible ? 'text-red-600 hover:bg-red-50' : 'text-emerald-700 hover:bg-emerald-50'}`} onClick={() => onToggleBuiltIn(template)}>{template.visible ? <Trash2 className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}</button>
                            </div></td>
                        </tr>
                    ))}
                    {pages.map((page) => (
                        <tr key={page.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                            <td className="p-3 font-medium">{page.name}</td><td className="p-3 capitalize">{page.group}</td><td className="p-3">{templates.find((item) => item.moduleType === page.moduleType)?.label ?? page.moduleType}</td><td className="p-3">Custom · {counts[page.id] ?? 0} items</td>
                            <td className="p-3"><div className="flex gap-1">
                                <button type="button" title="Rename page" className="p-2 rounded hover:bg-gray-50" onClick={() => onRename(page)}><Pencil className="w-4 h-4" /></button>
                                <button type="button" title="Delete page" className="p-2 rounded text-red-600 hover:bg-red-50" onClick={() => onDelete(page)}><Trash2 className="w-4 h-4" /></button>
                            </div></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
