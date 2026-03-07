import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { useAuthStore } from '../stores/auth';
import { Settings as SettingsIcon, User, Bell, Palette, Lock } from 'lucide-react';

export default function SettingsPage() {
    const { user, setUser } = useAuthStore();
    const qc = useQueryClient();
    const [tab, setTab] = useState('profile');
    const [msg, setMsg] = useState('');

    const { data: profile } = useQuery({
        queryKey: ['profile'],
        queryFn: async () => (await api.get('/settings/profile')).data.data,
    });

    const updateProfile = useMutation({
        mutationFn: (body: any) => api.patch('/settings/profile', body),
        onSuccess: (res) => {
            setUser(res.data.data);
            qc.invalidateQueries({ queryKey: ['profile'] });
            setMsg('Saved!');
            setTimeout(() => setMsg(''), 2000);
        },
    });

    const changePw = useMutation({
        mutationFn: (body: any) => api.post('/auth/change-password', body),
        onSuccess: () => { setMsg('Password changed!'); setTimeout(() => setMsg(''), 2000); },
        onError: (e: any) => { setMsg(e.response?.data?.message || 'Failed'); },
    });

    const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });

    const tabs = [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'theme', label: 'Theme', icon: Palette },
        { id: 'password', label: 'Password', icon: Lock },
    ];

    const themes = [
        { id: 'BLUE_PURPLE', name: 'Blue Purple', colors: ['#4f46e5', '#7c3aed', '#eef2ff'] },
        { id: 'GREY_BLACK', name: 'Dark Mode', colors: ['#1f2937', '#374151', '#111827'] },
        { id: 'RED_ACCENT', name: 'Red Accent', colors: ['#dc2626', '#ef4444', '#fef2f2'] },
    ];

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex items-center gap-2">
                <SettingsIcon className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Settings</h2>
            </div>

            {msg && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm animate-fade-in">{msg}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar */}
                <div className="card p-2 lg:p-3 space-y-1">
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'shadow-sm' : ''
                                }`}
                            style={{
                                backgroundColor: tab === t.id ? 'var(--color-primary-light)' : 'transparent',
                                color: tab === t.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                            }}
                        >
                            <t.icon className="w-4 h-4" />
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="lg:col-span-3 card p-6">
                    {/* Profile */}
                    {tab === 'profile' && profile && (
                        <div className="space-y-5">
                            <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>Profile</h3>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="label">Name</label>
                                    <input className="input" defaultValue={profile.name}
                                        onBlur={(e) => e.target.value !== profile.name && updateProfile.mutate({ name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="label">Email</label>
                                    <input className="input" value={profile.email} disabled />
                                </div>
                                <div>
                                    <label className="label">Role</label>
                                    <input className="input" value={profile.role} disabled />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Notifications */}
                    {tab === 'notifications' && profile && (
                        <div className="space-y-5">
                            <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>Notification Preferences</h3>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="rounded" checked={profile.notificationEnabled}
                                    onChange={(e) => updateProfile.mutate({ notificationEnabled: e.target.checked })}
                                />
                                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Enable notifications</span>
                            </label>
                            <div>
                                <label className="label">Channel</label>
                                <select className="input max-w-xs" value={profile.notificationChannel}
                                    onChange={(e) => updateProfile.mutate({ notificationChannel: e.target.value })}
                                >
                                    <option value="EMAIL">Email</option>
                                    <option value="TELEGRAM">Telegram</option>
                                    <option value="BOTH">Both</option>
                                </select>
                            </div>
                            {(profile.notificationChannel === 'EMAIL' || profile.notificationChannel === 'BOTH') && (
                                <div>
                                    <label className="label">Notification Email</label>
                                    <input className="input max-w-sm" defaultValue={profile.notificationEmail || ''}
                                        onBlur={(e) => updateProfile.mutate({ notificationEmail: e.target.value || null })}
                                    />
                                </div>
                            )}
                            {(profile.notificationChannel === 'TELEGRAM' || profile.notificationChannel === 'BOTH') && (
                                <div>
                                    <label className="label">Telegram Chat ID</label>
                                    <input className="input max-w-sm" defaultValue={profile.telegramChatId || ''}
                                        onBlur={(e) => updateProfile.mutate({ telegramChatId: e.target.value || null })}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Theme */}
                    {tab === 'theme' && (
                        <div className="space-y-5">
                            <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>Theme</h3>
                            <div className="grid gap-4 md:grid-cols-3">
                                {themes.map((theme) => (
                                    <button
                                        key={theme.id}
                                        onClick={() => updateProfile.mutate({ theme: theme.id })}
                                        className={`card p-4 text-left transition-all ${profile?.theme === theme.id ? 'ring-2 shadow-md' : ''
                                            }`}
                                        style={profile?.theme === theme.id ? { '--tw-ring-color': 'var(--color-primary)' } as any : {}}
                                    >
                                        <div className="flex gap-1.5 mb-3">
                                            {theme.colors.map((c, i) => (
                                                <div key={i} className="w-8 h-8 rounded-lg" style={{ backgroundColor: c }} />
                                            ))}
                                        </div>
                                        <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{theme.name}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Password */}
                    {tab === 'password' && (
                        <div className="space-y-5">
                            <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>Change Password</h3>
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                if (pwForm.newPassword !== pwForm.confirm) { setMsg('Passwords do not match'); return; }
                                changePw.mutate({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
                                setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
                            }} className="space-y-4 max-w-sm">
                                <div>
                                    <label className="label">Current Password <span className="text-red-500">*</span></label>
                                    <input type="password" className="input" required value={pwForm.currentPassword}
                                        onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} />
                                </div>
                                <div>
                                    <label className="label">New Password <span className="text-red-500">*</span></label>
                                    <input type="password" className="input" required minLength={8} value={pwForm.newPassword}
                                        onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} />
                                </div>
                                <div>
                                    <label className="label">Confirm New Password <span className="text-red-500">*</span></label>
                                    <input type="password" className="input" required value={pwForm.confirm}
                                        onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} />
                                </div>
                                <button type="submit" className="btn-primary" disabled={changePw.isPending}>Change Password</button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
