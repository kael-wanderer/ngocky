import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { useAuthStore } from '../stores/auth';
import { Settings as SettingsIcon, User, Bell, Palette, Shield, Camera, Bot, Copy, Check, ExternalLink, Unlink, LayoutGrid, Smartphone, ChevronUp, ChevronDown } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { DEFAULT_MOBILE_NAV_ITEMS, FEATURE_GROUPS, FEATURE_FLAGS, MOBILE_NAV_OPTIONS, getMobileNavItems, type FeatureFlags, type FeatureFlagKey } from '../config/features';
import ColorPicker from '../components/ColorPicker';

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
    const [searchParams, setSearchParams] = useSearchParams();
    const [tab, setTab] = useState(() => searchParams.get('tab') || 'profile');
    const [msg, setMsg] = useState('');
    const [linkCode, setLinkCode] = useState<{ code: string; expiresAt: string } | null>(null);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [copied, setCopied] = useState(false);
    const [mfaEnableCode, setMfaEnableCode] = useState('');
    const [mfaDisableCode, setMfaDisableCode] = useState('');
    const [profileForm, setProfileForm] = useState({ name: '', email: '', timezone: 'Asia/Ho_Chi_Minh' });
    const [featureForm, setFeatureForm] = useState<FeatureFlags>(FEATURE_FLAGS);
    const [notificationForm, setNotificationForm] = useState({
        notificationEnabled: true,
        notificationChannel: 'EMAIL',
        notificationEmail: '',
        telegramChatId: '',
    });
    const [cakeoColor, setCakeoColor] = useState('#94a3b8');
    const [calendarColor, setCalendarColor] = useState('#94a3b8');
    const [phoneViewForm, setPhoneViewForm] = useState<string[]>([...DEFAULT_MOBILE_NAV_ITEMS]);
    const mfaDisableInputRef = useRef<HTMLInputElement>(null);

    const { data: assistantLink, refetch: refetchLink } = useQuery({
        queryKey: ['assistant-link-status'],
        queryFn: async () => (await api.get('/assistant/link-status')).data,
    });

    const generateCode = useMutation({
        mutationFn: async () => (await api.post('/assistant/link-code')).data,
        onSuccess: (data) => {
            setLinkCode({ code: data.code, expiresAt: data.expiresAt });
            setSecondsLeft(15 * 60);
        },
        onError: (e: any) => setMsg(e.response?.data?.message || 'Failed to generate code'),
    });

    const revokeLink = useMutation({
        mutationFn: () => api.delete('/assistant/telegram/link'),
        onSuccess: () => {
            setLinkCode(null);
            refetchLink();
            setMsg('Telegram disconnected.');
            setTimeout(() => setMsg(''), 3000);
        },
        onError: (e: any) => setMsg(e.response?.data?.message || 'Failed to disconnect'),
    });

    useEffect(() => {
        if (secondsLeft <= 0) return;
        const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
        return () => clearTimeout(t);
    }, [secondsLeft]);

    const handleCopy = () => {
        if (!linkCode) return;
        navigator.clipboard.writeText(`/link ${linkCode.code}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const { data: profile } = useQuery({
        queryKey: ['profile'],
        queryFn: async () => (await api.get('/settings/profile')).data.data,
    });

    const { data: mfaState } = useQuery({
        queryKey: ['mfa'],
        queryFn: async () => (await api.get('/settings/mfa')).data.data,
    });

    const { data: cakeoColorSettings, refetch: refetchCakeoColors } = useQuery({
        queryKey: ['settings', 'color-settings', 'cakeo'],
        queryFn: async () => (await api.get('/settings/color-settings/cakeo')).data.data,
    });

    const { data: calendarColorSettings, refetch: refetchCalendarColors } = useQuery({
        queryKey: ['settings', 'color-settings', 'calendar'],
        queryFn: async () => (await api.get('/settings/color-settings/calendar')).data.data,
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

    const saveCakeoColors = useMutation({
        mutationFn: (color: string) => api.put('/settings/color-settings/cakeo', { color }),
        onSuccess: async () => {
            await Promise.all([
                qc.invalidateQueries({ queryKey: ['settings', 'color-settings', 'cakeo'] }),
                qc.invalidateQueries({ queryKey: ['cakeos'] }),
            ]);
            setMsg('Ca Keo colors saved.');
            setTimeout(() => setMsg(''), 2500);
        },
        onError: (e: any) => setMsg(e.response?.data?.message || 'Failed to save Ca Keo colors'),
    });

    const resetCakeoColors = useMutation({
        mutationFn: () => api.post('/settings/color-settings/cakeo/reset'),
        onSuccess: async () => {
            await Promise.all([
                refetchCakeoColors(),
                qc.invalidateQueries({ queryKey: ['cakeos'] }),
            ]);
            setMsg('Ca Keo colors reset to default.');
            setTimeout(() => setMsg(''), 2500);
        },
        onError: (e: any) => setMsg(e.response?.data?.message || 'Failed to reset Ca Keo colors'),
    });

    const saveCalendarColor = useMutation({
        mutationFn: (color: string) => api.put('/settings/color-settings/calendar', { color }),
        onSuccess: async () => {
            await Promise.all([
                qc.invalidateQueries({ queryKey: ['settings', 'color-settings', 'calendar'] }),
                qc.invalidateQueries({ queryKey: ['calendar'] }),
            ]);
            setMsg('Calendar color saved.');
            setTimeout(() => setMsg(''), 2500);
        },
        onError: (e: any) => setMsg(e.response?.data?.message || 'Failed to save Calendar color'),
    });

    const resetCalendarColor = useMutation({
        mutationFn: () => api.post('/settings/color-settings/calendar/reset'),
        onSuccess: async () => {
            await Promise.all([
                refetchCalendarColors(),
                qc.invalidateQueries({ queryKey: ['calendar'] }),
            ]);
            setMsg('Calendar color reset to default.');
            setTimeout(() => setMsg(''), 2500);
        },
        onError: (e: any) => setMsg(e.response?.data?.message || 'Failed to reset Calendar color'),
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

    React.useEffect(() => {
        if (!profile) return;
        setProfileForm({
            name: profile.name || '',
            email: profile.email || '',
            timezone: profile.timezone || 'Asia/Ho_Chi_Minh',
        });
        setNotificationForm({
            notificationEnabled: !!profile.notificationEnabled,
            notificationChannel: profile.notificationChannel || 'EMAIL',
            notificationEmail: profile.notificationEmail || '',
            telegramChatId: profile.telegramChatId || '',
        });
        setFeatureForm({
            featureGoals: profile.featureGoals ?? true,
            featureProjects: profile.featureProjects ?? true,
            featureIdeas: profile.featureIdeas ?? true,
            featureLearning: profile.featureLearning ?? true,
            featureExpenses: profile.featureExpenses ?? true,
            featureTasks: profile.featureTasks ?? true,
            featureHousework: profile.featureHousework ?? true,
            featureAssets: profile.featureAssets ?? true,
            featureCalendar: profile.featureCalendar ?? true,
            featureKeyboard: profile.featureKeyboard ?? true,
            featureFunds: profile.featureFunds ?? true,
            featureCaKeo: profile.featureCaKeo ?? true,
            featureHealthbook: profile.featureHealthbook ?? true,
        });
        setPhoneViewForm(getMobileNavItems(profile));
    }, [profile]);

    useEffect(() => {
        if (!cakeoColorSettings?.currentUserEntry?.color) return;
        setCakeoColor(cakeoColorSettings.currentUserEntry.color);
    }, [cakeoColorSettings]);

    useEffect(() => {
        if (!calendarColorSettings?.currentUserEntry?.color) return;
        setCalendarColor(calendarColorSettings.currentUserEntry.color);
    }, [calendarColorSettings]);

    const handleTabClick = (id: string) => {
        setTab(id);
        setSearchParams({ tab: id }, { replace: true });
    };

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
        { id: 'features', label: 'Desktop Features', icon: LayoutGrid },
        { id: 'phone-view', label: 'Phone View', icon: Smartphone },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'colors', label: 'Color Settings', icon: Palette },
        { id: 'theme', label: 'Theme', icon: Palette },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'assistant', label: 'Assistant', icon: Bot },
    ];

    const handleFeatureToggle = (key: FeatureFlagKey, checked: boolean) => {
        setFeatureForm((current) => ({
            ...current,
            [key]: checked,
        }));
    };

    const themes = [
        { id: 'BLUE_PURPLE', name: 'Blue Purple', colors: ['#4f46e5', '#7c3aed', '#eef2ff'] },
        { id: 'GREY_BLACK', name: 'Dark Mode', colors: ['#1f2937', '#374151', '#111827'] },
        { id: 'RED_ACCENT', name: 'Red Accent', colors: ['#dc2626', '#ef4444', '#fef2f2'] },
        { id: 'DARK', name: 'Dark', colors: ['#0b1220', '#60a5fa', '#131c2e'] },
        { id: 'MODERN_GREEN', name: 'Modern Green', colors: ['#1f9d68', '#34d399', '#ddf6ea'] },
        { id: 'MULTI_COLOR_BLOCK', name: 'Simple E-Ink', colors: ['#4f5b66', '#d8d1c2', '#f4f1e8'] },
        { id: 'PAPER_MINT', name: 'Paper Mint', colors: ['#4c8b6f', '#d7e4db', '#f3f7f2'] },
        { id: 'AMBER_LEDGER', name: 'Amber Ledger', colors: ['#c17c2f', '#eadfcd', '#fbf6ec'] },
        { id: 'OCEAN_INK', name: 'Ocean Ink', colors: ['#2ea7a0', '#294055', '#0f1722'] },
    ];

    const cakeoUsedColors = useMemo(
        () => new Set<string>((cakeoColorSettings?.usedColors || []).map((value: string) => value.toLowerCase())),
        [cakeoColorSettings],
    );
    const calendarUsedColors = useMemo(
        () => new Set<string>((calendarColorSettings?.usedColors || []).map((value: string) => value.toLowerCase())),
        [calendarColorSettings],
    );

    const handleOwnColorChange = (
        nextColor: string,
        setColor: React.Dispatch<React.SetStateAction<string>>,
        usedColors: Set<string>,
        moduleLabel: string,
    ) => {
        const normalizedColor = nextColor.toLowerCase();
        if (usedColors.has(normalizedColor)) {
            setMsg(`${moduleLabel} color must be unique. Please choose a different color.`);
            setTimeout(() => setMsg(''), 3000);
            return;
        }
        setColor(normalizedColor);
    };

    const selectedPhoneView = useMemo(
        () => MOBILE_NAV_OPTIONS.filter((item) => phoneViewForm.includes(item.to)),
        [phoneViewForm],
    );

    const handleTogglePhoneView = (route: string) => {
        setPhoneViewForm((current) => {
            if (current.includes(route)) {
                return current.filter((item) => item !== route);
            }
            if (current.length >= 6) {
                setMsg('Phone View can show at most 6 modules.');
                setTimeout(() => setMsg(''), 2500);
                return current;
            }
            return [...current, route];
        });
    };

    const movePhoneViewItem = (route: string, direction: 'up' | 'down') => {
        setPhoneViewForm((current) => {
            const index = current.indexOf(route);
            if (index === -1) return current;
            const nextIndex = direction === 'up' ? index - 1 : index + 1;
            if (nextIndex < 0 || nextIndex >= current.length) return current;
            const next = [...current];
            [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
            return next;
        });
    };

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
            <div className="flex items-center gap-2">
                <SettingsIcon className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>User Settings</h2>
            </div>

            {msg && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm animate-fade-in">{msg}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar */}
                <div className="card p-2 lg:p-3 space-y-1">
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => handleTabClick(t.id)}
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
                                    <input
                                        className="input"
                                        value={profileForm.name}
                                        onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="label">Email</label>
                                    <input
                                        className="input"
                                        type="email"
                                        value={profileForm.email}
                                        onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="label">Role</label>
                                    <input className="input" value={profile.role} disabled />
                                </div>
                                <div>
                                    <label className="label">Timezone</label>
                                    <select
                                        className="input"
                                        value={profileForm.timezone}
                                        onChange={(e) => setProfileForm({ ...profileForm, timezone: e.target.value })}
                                    >
                                        {TIMEZONES.map((tz) => (
                                            <option key={tz.value} value={tz.value}>{tz.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <button
                                    className="btn-primary"
                                    onClick={() => updateProfile.mutate(profileForm)}
                                    disabled={updateProfile.isPending}
                                >
                                    {updateProfile.isPending ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Notifications */}
                    {tab === 'features' && profile && (
                        <div className="space-y-5">
                            <div>
                                <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>Desktop Features</h3>
                                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                    Control which modules appear in desktop navigation. Phone bottom navigation is configured separately in Phone View.
                                </p>
                            </div>

                            <div className="space-y-4">
                                {FEATURE_GROUPS.map((group) => (
                                    <div key={group.id} className="rounded-xl border p-4 space-y-4" style={{ borderColor: 'var(--color-border)' }}>
                                        <div>
                                            <h4 className="font-semibold" style={{ color: 'var(--color-text)' }}>{group.label}</h4>
                                            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                                {group.id === 'personal' ? 'Planning and self-management pages.' : group.id === 'family' ? 'Shared home and family pages.' : 'Hobby and collection finance pages.'}
                                            </p>
                                        </div>
                                        <div className="grid gap-3 md:grid-cols-2">
                                            {group.items.map((item) => (
                                                <label key={item.key} className="flex items-center justify-between gap-4 rounded-lg border px-3 py-3 cursor-pointer" style={{ borderColor: 'var(--color-border)' }}>
                                                    <div>
                                                        <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{item.label}</div>
                                                        <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{item.route}</div>
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        className="rounded"
                                                        checked={featureForm[item.key]}
                                                        onChange={(e) => handleFeatureToggle(item.key, e.target.checked)}
                                                    />
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div>
                                <button
                                    className="btn-primary"
                                    onClick={() => updateProfile.mutate(featureForm)}
                                    disabled={updateProfile.isPending}
                                >
                                    {updateProfile.isPending ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Notifications */}
                    {tab === 'notifications' && profile && (
                        <div className="space-y-5">
                            <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>Notification Preferences</h3>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="rounded" checked={notificationForm.notificationEnabled}
                                    onChange={(e) => setNotificationForm({ ...notificationForm, notificationEnabled: e.target.checked })}
                                />
                                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Enable notifications</span>
                            </label>
                            <div>
                                <label className="label">Notification Channel</label>
                                <select className="input max-w-xs" value={notificationForm.notificationChannel}
                                    onChange={(e) => setNotificationForm({ ...notificationForm, notificationChannel: e.target.value })}
                                >
                                    <option value="EMAIL">Email</option>
                                    <option value="TELEGRAM">Telegram</option>
                                    <option value="BOTH">Both</option>
                                </select>
                            </div>
                            <div>
                                <label className="label">Email</label>
                                <input className="input max-w-sm" value={notificationForm.notificationEmail}
                                    onChange={(e) => setNotificationForm({ ...notificationForm, notificationEmail: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="label">Telegram ID</label>
                                <input className="input max-w-sm" value={notificationForm.telegramChatId}
                                    onChange={(e) => setNotificationForm({ ...notificationForm, telegramChatId: e.target.value })}
                                />
                            </div>
                            <div>
                                <button
                                    className="btn-primary"
                                    onClick={() => updateProfile.mutate({
                                        notificationEnabled: notificationForm.notificationEnabled,
                                        notificationChannel: notificationForm.notificationChannel,
                                        notificationEmail: notificationForm.notificationEmail || null,
                                        telegramChatId: notificationForm.telegramChatId || null,
                                    })}
                                    disabled={updateProfile.isPending}
                                >
                                    {updateProfile.isPending ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    )}

                    {tab === 'phone-view' && profile && (
                        <div className="space-y-5">
                            <div>
                                <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>Phone View</h3>
                                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                    Pick 3 to 6 modules for the bottom navigation on phone view. Order here is the order shown on mobile.
                                </p>
                            </div>

                            <div className="rounded-xl border p-4 space-y-4" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div>
                                        <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Selected modules</div>
                                        <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{phoneViewForm.length} selected, minimum 3, maximum 6</div>
                                    </div>
                                    <button
                                        className="btn-secondary"
                                        onClick={() => setPhoneViewForm([...DEFAULT_MOBILE_NAV_ITEMS])}
                                        disabled={updateProfile.isPending}
                                    >
                                        Reset Default
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {selectedPhoneView.map((item, index) => (
                                        <div key={item.to} className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
                                            <div>
                                                <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{index + 1}. {item.label}</div>
                                                <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{item.to}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button type="button" className="btn-ghost p-2" onClick={() => movePhoneViewItem(item.to, 'up')} disabled={index === 0}>
                                                    <ChevronUp className="w-4 h-4" />
                                                </button>
                                                <button type="button" className="btn-ghost p-2" onClick={() => movePhoneViewItem(item.to, 'down')} disabled={index === selectedPhoneView.length - 1}>
                                                    <ChevronDown className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div>
                                    <div className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>All modules</div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        {MOBILE_NAV_OPTIONS.map((item) => {
                                            const active = phoneViewForm.includes(item.to);
                                            return (
                                                <button
                                                    key={item.to}
                                                    type="button"
                                                    onClick={() => handleTogglePhoneView(item.to)}
                                                    className="rounded-lg border px-4 py-3 text-left transition-all"
                                                    style={{
                                                        borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
                                                        backgroundColor: active ? 'var(--color-primary-light)' : 'transparent',
                                                    }}
                                                >
                                                    <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{item.label}</div>
                                                    <div className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>{item.to}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <button
                                        className="btn-primary"
                                        onClick={() => updateProfile.mutate({ mobileNavItems: phoneViewForm })}
                                        disabled={updateProfile.isPending || phoneViewForm.length < 3 || phoneViewForm.length > 6}
                                    >
                                        {updateProfile.isPending ? 'Saving...' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === 'colors' && (
                        <div className="space-y-5">
                            <div>
                                <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>Color Settings</h3>
                                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                    Set your own shared module colors here. Unassigned Ca Keo items always stay grey.
                                </p>
                            </div>

                            <div className="rounded-xl border p-4 space-y-4" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div>
                                        <h4 className="font-semibold" style={{ color: 'var(--color-text)' }}>Ca Keo</h4>
                                        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                            Pick the color for your own Ca Keo assignments. Your color must stay unique in this module.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Unassigned</div>
                                            <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                                Fixed shared color for items without an assignee
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="w-3 h-3 rounded-full border" style={{ backgroundColor: '#94a3b8', borderColor: 'var(--color-border)' }} />
                                            <div className="opacity-60 pointer-events-none">
                                                <ColorPicker value="#94a3b8" onChange={() => {}} storageKey="settings-cakeo-recent-colors" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{user?.name || 'Current user'}</div>
                                            <div className="text-xs truncate" style={{ color: cakeoUsedColors.has(cakeoColor.toLowerCase()) ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                                                {cakeoUsedColors.has(cakeoColor.toLowerCase()) ? 'Duplicate color detected' : user?.email}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="w-3 h-3 rounded-full border" style={{ backgroundColor: cakeoColor, borderColor: 'var(--color-border)' }} />
                                            <ColorPicker
                                                value={cakeoColor}
                                                onChange={(color) => handleOwnColorChange(color, setCakeoColor, cakeoUsedColors, 'Ca Keo')}
                                                storageKey="settings-cakeo-recent-colors"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 flex-wrap">
                                    <button
                                        className="btn-primary"
                                        onClick={() => saveCakeoColors.mutate(cakeoColor)}
                                        disabled={saveCakeoColors.isPending || resetCakeoColors.isPending}
                                    >
                                        {saveCakeoColors.isPending ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                        className="btn-secondary"
                                        onClick={() => resetCakeoColors.mutate()}
                                        disabled={saveCakeoColors.isPending || resetCakeoColors.isPending}
                                    >
                                        {resetCakeoColors.isPending ? 'Resetting...' : 'Reset to Default'}
                                    </button>
                                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                        Default: `Unassigned` grey, `cong.buithanh@gmail.com` blue, `kist.t1108@gmail.com` green.
                                    </span>
                                </div>
                            </div>

                            <div className="rounded-xl border p-4 space-y-4" style={{ borderColor: 'var(--color-border)' }}>
                                <div>
                                    <h4 className="font-semibold" style={{ color: 'var(--color-text)' }}>Calendar</h4>
                                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                        Pick the color for your own Calendar items. Your color must stay unique in this module.
                                    </p>
                                </div>

                                <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{user?.name || 'Current user'}</div>
                                        <div className="text-xs truncate" style={{ color: calendarUsedColors.has(calendarColor.toLowerCase()) ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                                            {calendarUsedColors.has(calendarColor.toLowerCase()) ? 'Duplicate color detected' : user?.email}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="w-3 h-3 rounded-full border" style={{ backgroundColor: calendarColor, borderColor: 'var(--color-border)' }} />
                                        <ColorPicker
                                            value={calendarColor}
                                            onChange={(color) => handleOwnColorChange(color, setCalendarColor, calendarUsedColors, 'Calendar')}
                                            storageKey="settings-calendar-recent-colors"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 flex-wrap">
                                    <button
                                        className="btn-primary"
                                        onClick={() => saveCalendarColor.mutate(calendarColor)}
                                        disabled={saveCalendarColor.isPending || resetCalendarColor.isPending}
                                    >
                                        {saveCalendarColor.isPending ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                        className="btn-secondary"
                                        onClick={() => resetCalendarColor.mutate()}
                                        disabled={saveCalendarColor.isPending || resetCalendarColor.isPending}
                                    >
                                        {resetCalendarColor.isPending ? 'Resetting...' : 'Reset to Default'}
                                    </button>
                                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                        Default: `cong.buithanh@gmail.com` blue, `kist.t1108@gmail.com` green.
                                    </span>
                                </div>
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
                                        if (e.target.checked) {
                                            setupMfa.mutate();
                                            return;
                                        }
                                        if (profile.mfaEnabled) {
                                            setMsg('Enter your 6-digit authenticator code below to disable MFA.');
                                            setTimeout(() => setMsg(''), 4000);
                                            setTimeout(() => mfaDisableInputRef.current?.focus(), 0);
                                        }
                                    }}
                                />
                                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Enable MFA</span>
                            </label>
                            {profile.mfaEnabled && (
                                <p className="text-xs -mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                                    Unchecking requires verification below before MFA is actually disabled.
                                </p>
                            )}

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
                                                ref={mfaDisableInputRef}
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

                    {/* Assistant */}
                    {tab === 'assistant' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>Telegram Assistant</h3>
                                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                    Connect your Telegram account to manage tasks, log expenses, and query your calendar via chat.
                                </p>
                            </div>

                            {/* Linked state */}
                            {assistantLink?.linked && (
                                <div className="rounded-xl border p-5 space-y-4" style={{ borderColor: 'var(--color-border)' }}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
                                            <Bot className="w-5 h-5 text-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                                                Connected
                                                {assistantLink.link?.telegramUsername && (
                                                    <span className="ml-1.5 font-normal" style={{ color: 'var(--color-text-secondary)' }}>
                                                        @{assistantLink.link.telegramUsername}
                                                    </span>
                                                )}
                                            </p>
                                            {assistantLink.link?.verifiedAt && (
                                                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                                    Linked {new Date(assistantLink.link.verifiedAt).toLocaleDateString()}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <a
                                            href="https://t.me/ngocky_notification_bot"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="btn-secondary text-sm flex items-center gap-1.5"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" /> Open Bot
                                        </a>
                                        <button
                                            className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 transition-colors"
                                            onClick={() => revokeLink.mutate()}
                                            disabled={revokeLink.isPending}
                                        >
                                            <Unlink className="w-3.5 h-3.5" />
                                            {revokeLink.isPending ? 'Disconnecting...' : 'Disconnect'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Unlinked state */}
                            {!assistantLink?.linked && (
                                <div className="rounded-xl border p-5 space-y-5" style={{ borderColor: 'var(--color-border)' }}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-light)' }}>
                                            <Bot className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                                        </div>
                                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                            Not connected. Generate a link code to connect.
                                        </p>
                                    </div>

                                    {/* Code display */}
                                    {linkCode && secondsLeft > 0 ? (
                                        <div className="space-y-3">
                                            <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: 'var(--color-primary-light)' }}>
                                                <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                                    Send this command to{' '}
                                                    <a href="https://t.me/ngocky_notification_bot" target="_blank" rel="noreferrer" className="underline font-semibold" style={{ color: 'var(--color-primary)' }}>
                                                        @ngocky_notification_bot
                                                    </a>
                                                </p>
                                                <div className="flex items-center gap-3">
                                                    <code className="flex-1 font-mono text-lg font-bold tracking-widest text-center py-2 rounded-lg" style={{ color: 'var(--color-primary)', backgroundColor: 'var(--color-bg)' }}>
                                                        /link {linkCode.code}
                                                    </code>
                                                    <button
                                                        onClick={handleCopy}
                                                        className="p-2 rounded-lg transition-colors"
                                                        style={{ backgroundColor: 'var(--color-bg)' }}
                                                        title="Copy command"
                                                    >
                                                        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />}
                                                    </button>
                                                </div>
                                                <p className="text-xs text-center" style={{ color: 'var(--color-text-secondary)' }}>
                                                    Expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                                                </p>
                                            </div>
                                            <button
                                                className="text-sm underline"
                                                style={{ color: 'var(--color-primary)' }}
                                                onClick={() => generateCode.mutate()}
                                            >
                                                Generate new code
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            className="btn-primary"
                                            onClick={() => generateCode.mutate()}
                                            disabled={generateCode.isPending}
                                        >
                                            {generateCode.isPending ? 'Generating...' : 'Generate Link Code'}
                                        </button>
                                    )}

                                    <div className="text-xs space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
                                        <p className="font-medium" style={{ color: 'var(--color-text)' }}>How to connect:</p>
                                        <ol className="list-decimal list-inside space-y-1">
                                            <li>Click <strong>Generate Link Code</strong> above</li>
                                            <li>Open <a href="https://t.me/ngocky_notification_bot" target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--color-primary)' }}>@ngocky_notification_bot</a> on Telegram</li>
                                            <li>Send the <code className="font-mono">/link CODE</code> command shown above</li>
                                            <li>Refresh this page to see your connected status</li>
                                        </ol>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
