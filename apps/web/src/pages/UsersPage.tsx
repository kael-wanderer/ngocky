import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { useAuthStore } from '../stores/auth';
import { Users, Plus, X, Shield, UserCheck, UserX, KeyRound, Trash2 } from 'lucide-react';

export default function UsersPage() {
    const { user: currentUser } = useAuthStore();
    const qc = useQueryClient();
    const [showCreate, setShowCreate] = useState(false);
    const [showResetPassword, setShowResetPassword] = useState(false);
    const [resetTarget, setResetTarget] = useState<any>(null);
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'USER' });
    const [resetPassword, setResetPassword] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['users'],
        queryFn: async () => (await api.get('/users?limit=100')).data,
    });

    const createMut = useMutation({
        mutationFn: (body: any) => api.post('/users', body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['users'] });
            setShowCreate(false);
            setForm({ name: '', email: '', password: '', role: 'USER' });
        },
    });

    const toggleMut = useMutation({
        mutationFn: (id: string) => api.patch(`/users/${id}/toggle-active`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    });

    const resetMut = useMutation({
        mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) => api.patch(`/users/${id}/reset-password`, { newPassword }),
        onSuccess: () => {
            setShowResetPassword(false);
            setResetTarget(null);
            setResetPassword('');
        },
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => api.delete(`/users/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    });

    const roleColors: Record<string, string> = { OWNER: '#7c3aed', ADMIN: '#4f46e5', USER: '#059669' };
    const users = useMemo(() => data?.data || [], [data]);

    function canDelete(target: any) {
        if (!currentUser) return false;
        if (target.id === currentUser.id) return false;
        if (currentUser.role === 'OWNER') return true;
        if (currentUser.role === 'ADMIN') return target.role === 'USER';
        return false;
    }

    function canResetPassword(target: any) {
        if (!currentUser) return false;
        if (currentUser.role === 'OWNER') return true;
        if (currentUser.role === 'ADMIN') return target.role !== 'OWNER';
        return false;
    }

    function openResetPassword(user: any) {
        setResetTarget(user);
        setResetPassword('');
        setShowResetPassword(true);
    }

    function handleDelete(user: any) {
        if (!canDelete(user)) return;
        if (window.confirm(`Delete account for ${user.name}?`)) deleteMut.mutate(user.id);
    }

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Users className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>User Management</h2>
                </div>
                <button className="btn-primary" onClick={() => setShowCreate(true)}>
                    <Plus className="w-4 h-4" /> Add User
                </button>
            </div>

            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}>
                    <div className="card modal-panel p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Create User</h3>
                            <button onClick={() => setShowCreate(false)}><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} className="space-y-4">
                            <div><label className="label">Name</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                            <div><label className="label">Email</label><input type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                            <div><label className="label">Password</label><input type="password" className="input" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
                            <div>
                                <label className="label">Role</label>
                                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                                    <option value="USER">User</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                            <button type="submit" className="btn-primary w-full" disabled={createMut.isPending}>Create User</button>
                        </form>
                    </div>
                </div>
            )}

            {showResetPassword && resetTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowResetPassword(false); }}>
                    <div className="card modal-panel p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Reset Password</h3>
                            <button onClick={() => setShowResetPassword(false)}><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); resetMut.mutate({ id: resetTarget.id, newPassword: resetPassword }); }} className="space-y-4">
                            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Set a temporary password for {resetTarget.name}.</p>
                            <div>
                                <label className="label">Temporary password</label>
                                <input type="password" minLength={8} className="input" required value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
                            </div>
                            <button type="submit" className="btn-primary w-full" disabled={resetMut.isPending}>Set Password</button>
                        </form>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="card h-16 animate-pulse bg-gray-100" />)}</div>
            ) : (
                <div className="card overflow-hidden">
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                {users.map((u: any) => (
                                    <tr key={u.id}>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium" style={{ backgroundColor: roleColors[u.role] }}>
                                                    {u.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-medium" style={{ color: 'var(--color-text)' }}>{u.name}</span>
                                            </div>
                                        </td>
                                        <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{u.email}</td>
                                        <td>
                                            <span className="badge" style={{ backgroundColor: `${roleColors[u.role]}20`, color: roleColors[u.role] }}>
                                                <Shield className="w-3 h-3 mr-1" />{u.role}
                                            </span>
                                        </td>
                                        <td><span className={u.active ? 'badge-success' : 'badge-danger'}>{u.active ? 'Active' : 'Inactive'}</span></td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                {u.role !== 'OWNER' && (
                                                    <button onClick={() => toggleMut.mutate(u.id)} className="btn-ghost text-xs py-1 px-2" title={u.active ? 'Deactivate' : 'Activate'}>
                                                        {u.active ? <UserX className="w-4 h-4 text-red-500" /> : <UserCheck className="w-4 h-4 text-green-500" />}
                                                    </button>
                                                )}
                                                {canResetPassword(u) && (
                                                    <button onClick={() => openResetPassword(u)} className="btn-ghost text-xs py-1 px-2" title="Reset password">
                                                        <KeyRound className="w-4 h-4 text-amber-600" />
                                                    </button>
                                                )}
                                                {canDelete(u) && (
                                                    <button onClick={() => handleDelete(u)} className="btn-ghost text-xs py-1 px-2" title="Delete user">
                                                        <Trash2 className="w-4 h-4 text-red-500" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
