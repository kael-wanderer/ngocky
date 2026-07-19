import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { useAppSettings, type ModuleGroupId } from '../api/appSettings';

// Mirrors apps/api/src/config/pageTemplates.ts PAGE_TEMPLATES (no shared package).
const PAGE_TEMPLATES: { type: string; label: string; group: ModuleGroupId }[] = [
    { type: 'TASK', label: 'Tasks', group: 'personal' },
    { type: 'PROJECT', label: 'Projects', group: 'personal' },
    { type: 'EXPENSE', label: 'Expenses', group: 'personal' },
    { type: 'GOAL', label: 'Goals', group: 'personal' },
    { type: 'IDEA', label: 'Ideas', group: 'personal' },
    { type: 'CALENDAR', label: 'Calendar', group: 'family' },
    { type: 'CAKEO', label: 'Ca Keo (Child)', group: 'family' },
    { type: 'HOUSEWORK', label: 'Housework', group: 'family' },
    { type: 'ASSET', label: 'Assets', group: 'family' },
    { type: 'HEALTHBOOK', label: 'Healthbook', group: 'family' },
    { type: 'FOODPLACE', label: 'Food Menu', group: 'family' },
    { type: 'KEYBOARD', label: 'Keyboard', group: 'hobby' },
    { type: 'FUND', label: 'Funds', group: 'hobby' },
    { type: 'LEARNING', label: 'Learning', group: 'hobby' },
];

export default function SetupPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { data: appSettings } = useAppSettings();
    const [appName, setAppName] = useState(appSettings?.appName ?? 'NgốcKý');
    const [groups, setGroups] = useState<ModuleGroupId[]>(['personal', 'family', 'hobby']);
    const [owner, setOwner] = useState({ name: '', email: '', password: '', confirm: '' });
    const [hiddenPages, setHiddenPages] = useState<string[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const toggleGroup = (group: ModuleGroupId, checked: boolean) => {
        if (group === 'personal') return;
        setGroups((current) => checked ? [...new Set([...current, group])] : current.filter((item) => item !== group));
    };

    const togglePage = (type: string, checked: boolean) => {
        setHiddenPages((current) => checked ? current.filter((t) => t !== type) : [...new Set([...current, type])]);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        if (owner.password !== owner.confirm) {
            setError('Passwords do not match');
            return;
        }
        setLoading(true);
        try {
            const enabledTypes = PAGE_TEMPLATES.filter((t) => groups.includes(t.group)).map((t) => t.type);
            await api.post('/setup', {
                appName,
                enabledGroups: groups,
                hiddenPages: hiddenPages.filter((t) => enabledTypes.includes(t)),
                owner: { name: owner.name, email: owner.email, password: owner.password },
            });
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['app-settings'] }),
                queryClient.invalidateQueries({ queryKey: ['setup-status'] }),
            ]);
            navigate('/login', { replace: true });
        } catch (err: any) {
            setError(err.response?.data?.message || err.response?.data?.error || 'Setup failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ backgroundColor: 'var(--color-bg)' }}>
            <form onSubmit={handleSubmit} className="w-full max-w-2xl card p-8 space-y-6">
                <div className="text-center">
                    <img src="/ladybug-logo.svg" alt={`${appName} logo`} className="w-16 h-16 mb-4 inline-block" />
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Set up {appName}</h1>
                </div>

                {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

                <section className="space-y-3">
                    <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Application</h2>
                    <div>
                        <label className="label" htmlFor="appName">App Name</label>
                        <input id="appName" className="input" value={appName} onChange={(event) => setAppName(event.target.value)} required maxLength={60} />
                    </div>
                </section>

                <section className="space-y-3">
                    <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Module Groups</h2>
                    {[
                        { id: 'personal' as ModuleGroupId, label: 'Personal', disabled: true },
                        { id: 'family' as ModuleGroupId, label: 'Family' },
                        { id: 'hobby' as ModuleGroupId, label: 'Hobby' },
                    ].map((group) => (
                        <div key={group.id} className="rounded-lg border px-4 py-3 space-y-2" style={{ borderColor: 'var(--color-border)' }}>
                            <label className="flex items-center justify-between">
                                <span className="font-medium" style={{ color: 'var(--color-text)' }}>{group.label}</span>
                                <input
                                    type="checkbox"
                                    checked={groups.includes(group.id)}
                                    disabled={group.disabled}
                                    onChange={(event) => toggleGroup(group.id, event.target.checked)}
                                />
                            </label>
                            {groups.includes(group.id) && (
                                <div className="grid gap-1 md:grid-cols-2 pl-1">
                                    {PAGE_TEMPLATES.filter((t) => t.group === group.id).map((t) => (
                                        <label key={t.type} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                            <input
                                                type="checkbox"
                                                checked={!hiddenPages.includes(t.type)}
                                                onChange={(event) => togglePage(t.type, event.target.checked)}
                                            />
                                            {t.label}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </section>

                <section className="space-y-3">
                    <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Owner Account</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="label" htmlFor="ownerName">Name</label>
                            <input id="ownerName" className="input" value={owner.name} onChange={(event) => setOwner({ ...owner, name: event.target.value })} required />
                        </div>
                        <div>
                            <label className="label" htmlFor="ownerEmail">Email</label>
                            <input id="ownerEmail" type="email" className="input" value={owner.email} onChange={(event) => setOwner({ ...owner, email: event.target.value })} required />
                        </div>
                        <div>
                            <label className="label" htmlFor="ownerPassword">Password</label>
                            <input id="ownerPassword" type="password" className="input" value={owner.password} onChange={(event) => setOwner({ ...owner, password: event.target.value })} required minLength={8} />
                        </div>
                        <div>
                            <label className="label" htmlFor="ownerConfirm">Confirm Password</label>
                            <input id="ownerConfirm" type="password" className="input" value={owner.confirm} onChange={(event) => setOwner({ ...owner, confirm: event.target.value })} required minLength={8} />
                        </div>
                    </div>
                </section>

                <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
                    {loading ? 'Setting up...' : 'Create Workspace'}
                </button>
            </form>
        </div>
    );
}
