import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useCreatePage, type PageModuleType } from '../api/pages';
import type { ModuleGroupId } from '../api/appSettings';

type AddPageModalProps = {
    group: ModuleGroupId;
    onClose: () => void;
};

export default function AddPageModal({ group, onClose }: AddPageModalProps) {
    const createPage = useCreatePage();
    const [name, setName] = useState('');
    const [moduleType, setModuleType] = useState<PageModuleType>('TASK');
    const [error, setError] = useState('');

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        try {
            await createPage.mutateAsync({ name, moduleType, group });
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to create page');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <form onSubmit={handleSubmit} className="card w-full max-w-md p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Add Page</h2>
                    <button type="button" className="btn-ghost p-2" onClick={onClose}>
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

                <div>
                    <label className="label" htmlFor="pageName">Name</label>
                    <input id="pageName" className="input" value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} autoFocus />
                </div>

                <div>
                    <label className="label" htmlFor="moduleType">Template</label>
                    <select id="moduleType" className="input" value={moduleType} onChange={(event) => setModuleType(event.target.value as PageModuleType)}>
                        <option value="TASK">Task</option>
                        <option value="PROJECT">Project</option>
                        <option value="EXPENSE">Expense</option>
                        <option value="GOAL">Goal</option>
                    </select>
                </div>

                <div className="flex justify-end gap-2">
                    <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button type="submit" className="btn-primary" disabled={createPage.isPending}>
                        <Plus className="w-4 h-4" />
                        {createPage.isPending ? 'Creating...' : 'Create'}
                    </button>
                </div>
            </form>
        </div>
    );
}
