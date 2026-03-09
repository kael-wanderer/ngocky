import React, { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { useAuthStore } from '../stores/auth';
import { Settings as SettingsIcon, User, Bell, Palette, Shield, Camera } from 'lucide-react';

function resizeImageToBase64(file: File, maxSize = 128): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = url;
    });
}

export default function SettingsPage() {
    const { user, setUser } = useAuthStore();
    const qc = useQueryClient();
    const [tab, setTab] = useState('profile');
    const [msg, setMsg] = useState('');
    const [mfaEnableCode, setMfaEnableCode] = useState('');
    const [mfaDisableCode, setMfaDisableCode] = useState('');

    const { data: profile } = useQuery({
        queryKey: ['profile'],
        queryFn: async () => (await api.get('/settings/profile')).data.data,
    });

    const { data: mfaState } = useQuery({
        queryKey: ['mfa'],
        queryFn: async () => (await api.get('/settings/mfa')).data.data,
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

    const setupMfa = useMutation({
        mutationFn: () => api.post('/settings/mfa/setup'),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['mfa'] });
            setMsg('Scan the QR code, then enter the 6-digit code to finish enabling MFA.');
            setTimeout(() => setMsg(''), 4000);
        },
        onError: (e: any) => setMsg(e.response?.data?.message || 'Failed to start MFA setup'),
    });

    const enableMfa = useMutation({
        mutationFn: (code: string) => api.post('/settings/mfa/enable', { code }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['mfa'] });
            qc.invalidateQueries({ queryKey: ['profile'] });
            setUser({ ...(user as any), mfaEnabled: true });
            setMfaEnableCode('');
            setMsg('MFA enabled.');
            setTimeout(() => setMsg(''), 3000);
        },
        onError: (e: any) => setMsg(e.response?.data?.message || 'Failed to enable MFA'),
    });

    const disableMfa = useMutation({
        mutationFn: (code: string) => api.post('/settings/mfa/disable', { code }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['mfa'] });
            qc.invalidateQueries({ queryKey: ['profile'] });
            setUser({ ...(user as any), mfaEnabled: false });
            setMfaDisableCode('');
            setMsg('MFA disabled.');
            setTimeout(() => setMsg(''), 3000);
        },
        onError: (e: any) => setMsg(e.response?.data?.message || 'Failed to disable MFA'),
    });

    const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
    const avatarInputRef = useRef<HTMLInputElement>(null);

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const dataUrl = await resizeImageToBase64(file, 256);
            updateProfile.mutate({ avatarUrl: dataUrl });
        } catch {
            setMsg('Failed to process image');
        }
        e.target.value = '';
    };

    const TIMEZONES = [
        { value: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh (GMT+7)' },
        { value: 'Asia/Bangkok', label: 'Bangkok (GMT+7)' },
        { value: 'Asia/Singapore', label: 'Singapore (GMT+8)' },
        { value: 'Asia/Shanghai', label: 'Shanghai (GMT+8)' },
        { value: 'Asia/Tokyo', label: 'Tokyo (GMT+9)' },
        { value: 'Asia/Seoul', label: 'Seoul (GMT+9)' },
        { value: 'Asia/Kolkata', label: 'Kolkata (GMT+5:30)' },
        { value: 'Asia/Dubai', label: 'Dubai (GMT+4)' },
        { value: 'Europe/London', label: 'London (GMT+0)' },
        { value: 'Europe/Paris', label: 'Paris (GMT+1)' },
        { value: 'America/New_York', label: 'New York (GMT-5)' },
        { value: 'America/Chicago', label: 'Chicago (GMT-6)' },
        { value: 'America/Los_Angeles', label: 'Los Angeles (GMT-8)' },
        { value: 'UTC', label: 'UTC (GMT+0)' },
    ];

    const tabs = [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'theme', label: 'Theme', icon: Palette },
        { id: 'security', label: 'Security', icon: Shield },
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

                            {/* Avatar */}
                            <div className="flex items-center gap-4">
                                <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                                    {profile.avatarUrl ? (
                                        <img src={profile.avatarUrl} alt={profile.name} className="w-20 h-20 rounded-full object-cover border-2" style={{ borderColor: 'var(--color-border)' }} />
                                    ) : (
                                        <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold" style={{ background: 'linear-gradient(135deg, var(--color-primary), #7c3aed)' }}>
                                            {profile.name?.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Camera className="w-6 h-6 text-white" />
                                    </div>
                                </div>
                                <div>
                                    <button className="btn-primary text-sm py-1.5 px-3" onClick={() => avatarInputRef.current?.click()}>
                                        <Camera className="w-4 h-4" /> Upload Photo
                                    </button>
                                    {profile.avatarUrl && (
                                        <button className="ml-2 text-sm text-red-500 hover:text-red-600" onClick={() => updateProfile.mutate({ avatarUrl: null })}>
                                            Remove
                                        </button>
                                    )}
                                    <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-secondary)' }}>JPG, PNG or GIF. Max display 256×256px.</p>
                                </div>
                                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                            </div>

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
                                <div>
                                    <label className="label">Timezone</label>
                                    <select
                                        className="input"
                                        value={profile.timezone || 'Asia/Ho_Chi_Minh'}
                                        onChange={(e) => updateProfile.mutate({ timezone: e.target.value })}
                                    >
                                        {TIMEZONES.map((tz) => (
                                            <option key={tz.value} value={tz.value}>{tz.label}</option>
                                        ))}
                                    </select>
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
                                <label className="label">Notification Channel</label>
                                <select className="input max-w-xs" value={profile.notificationChannel}
                                    onChange={(e) => updateProfile.mutate({ notificationChannel: e.target.value })}
                                >
                                    <option value="EMAIL">Email</option>
                                    <option value="TELEGRAM">Telegram</option>
                                    <option value="BOTH">Both</option>
                                </select>
                            </div>
                            <div>
                                <label className="label">Email</label>
                                <input className="input max-w-sm" defaultValue={profile.notificationEmail || ''}
                                    onBlur={(e) => updateProfile.mutate({ notificationEmail: e.target.value || null })}
                                />
                            </div>
                            <div>
                                <label className="label">Telegram ID</label>
                                <input className="input max-w-sm" defaultValue={profile.telegramChatId || ''}
                                    onBlur={(e) => updateProfile.mutate({ telegramChatId: e.target.value || null })}
                                />
                            </div>
                        </div>
                    )}

                    {/* Security */}
                    {tab === 'security' && profile && (
                        <div className="space-y-5">
                            <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>Security</h3>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="rounded"
                                    checked={!!profile.mfaEnabled || !!mfaState?.pending}
                                    onChange={(e) => {
                                        if (e.target.checked) setupMfa.mutate();
                                    }}
                                />
                                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Enable MFA</span>
                            </label>

                            {!profile.mfaEnabled && mfaState?.pending && (
                                <div className="space-y-4 rounded-xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
                                    <div>
                                        <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Scan this QR code with your authenticator app</p>
                                        <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                            Google Authenticator, 1Password, Microsoft Authenticator, or similar apps will work.
                                        </p>
                                    </div>
                                    <img src={mfaState.qrCodeUrl} alt="MFA QR code" className="w-48 h-48 rounded-lg border bg-white p-2" style={{ borderColor: 'var(--color-border)' }} />
                                    <div>
                                        <label className="label">Manual setup key</label>
                                        <div className="input font-mono text-sm break-all">{mfaState.manualKey}</div>
                                    </div>
                                    <form onSubmit={(e) => {
                                        e.preventDefault();
                                        enableMfa.mutate(mfaEnableCode);
                                    }} className="space-y-3 max-w-sm">
                                        <div>
                                            <label className="label">Verification code</label>
                                            <input
                                                className="input tracking-[0.35em] text-center"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                maxLength={6}
                                                value={mfaEnableCode}
                                                onChange={(e) => setMfaEnableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                required
                                            />
                                        </div>
                                        <button type="submit" className="btn-primary" disabled={enableMfa.isPending || mfaEnableCode.length !== 6}>
                                            {enableMfa.isPending ? 'Verifying...' : 'Verify and Enable'}
                                        </button>
                                    </form>
                                </div>
                            )}

                            {profile.mfaEnabled && (
                                <div className="space-y-4 rounded-xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
                                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                        MFA is currently enabled. To turn it off, enter a valid 6-digit code from your authenticator app.
                                    </p>
                                    <form onSubmit={(e) => {
                                        e.preventDefault();
                                        disableMfa.mutate(mfaDisableCode);
                                    }} className="space-y-3 max-w-sm">
                                        <div>
                                            <label className="label">Verification code</label>
                                            <input
                                                className="input tracking-[0.35em] text-center"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                maxLength={6}
                                                value={mfaDisableCode}
                                                onChange={(e) => setMfaDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                required
                                            />
                                        </div>
                                        <button type="submit" className="btn-danger" disabled={disableMfa.isPending || mfaDisableCode.length !== 6}>
                                            {disableMfa.isPending ? 'Disabling...' : 'Disable MFA'}
                                        </button>
                                    </form>
                                </div>
                            )}

                            <div className="border-t pt-5" style={{ borderColor: 'var(--color-border)' }}>
                                <h4 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Change Password</h4>
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
                            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                Theme changes apply immediately. No logout is required.
                            </p>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
