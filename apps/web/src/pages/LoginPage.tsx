import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import api from '../api/client';
import { getApiBaseUrl } from '../api/client';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { useAppSettings } from '../api/appSettings';

export default function LoginPage() {
    const isDesktop = typeof window !== 'undefined' && Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
    const [savedEmail] = useState(() => typeof window !== 'undefined' ? window.localStorage?.getItem('ngocky_saved_email') || '' : '');
    const [email, setEmail] = useState(savedEmail);
    const [password, setPassword] = useState('');
    const [mfaCode, setMfaCode] = useState('');
    const [mfaToken, setMfaToken] = useState('');
    const [mfaUserEmail, setMfaUserEmail] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(Boolean(savedEmail));
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [serverUrl, setServerUrl] = useState(() => getApiBaseUrl());
    const [serverUrlError, setServerUrlError] = useState('');
    const { login } = useAuthStore();
    const navigate = useNavigate();
    const { data: appSettings } = useAppSettings();
    const appName = appSettings?.appName || 'NgốcKý';

    const saveRememberedEmail = (nextEmail: string) => {
        if (rememberMe) {
            window.localStorage?.setItem('ngocky_saved_email', nextEmail.trim());
        } else {
            window.localStorage?.removeItem('ngocky_saved_email');
        }
    };

    const [resetError, setResetError] = useState('');
    const switchMode = async () => {
        setResetError('');
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('clear_desktop_config');
            localStorage.removeItem('ngocky_token');
            localStorage.removeItem('ngocky_user');
            localStorage.removeItem('ngocky_api_url');
            const { relaunch } = await import('@tauri-apps/plugin-process');
            await relaunch();
        } catch (e: any) {
            setResetError(e?.message || String(e));
        }
    };

    const saveServerUrl = () => {
        const trimmed = serverUrl.trim();
        if (trimmed && !/^https?:\/\//i.test(trimmed)) {
            setServerUrlError('Server URL must start with http:// or https://.');
            return;
        }
        setServerUrlError('');
        if (trimmed) window.localStorage?.setItem('ngocky_api_url', trimmed);
        else window.localStorage?.removeItem('ngocky_api_url');
        window.location.reload();
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await api.post('/auth/login', { email, password });
            const { user, accessToken, mfaRequired, mfaToken: nextMfaToken } = res.data.data;
            if (mfaRequired) {
                setMfaToken(nextMfaToken);
                setMfaUserEmail(user.email);
                setMfaCode('');
                return;
            }
            saveRememberedEmail(user.email || email);
            login(user, accessToken);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    const handleMfaSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await api.post('/auth/verify-mfa', { mfaToken, code: mfaCode });
            const { user, accessToken } = res.data.data;
            saveRememberedEmail(user.email || mfaUserEmail || email);
            login(user, accessToken);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Invalid verification code');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-bg)' }}>
            {isDesktop && (
                <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
                    <button type="button" onClick={switchMode} className="btn-secondary text-sm">
                        Switch mode / reset
                    </button>
                    {resetError && <p className="text-xs text-red-600 max-w-xs text-right">{resetError}</p>}
                </div>
            )}
            <div className="w-full max-w-md animate-slide-up">
                {/* Logo */}
                <div className="text-center mb-8">
                    <img
                        src="/ladybug-logo.svg"
                        alt={`${appName} logo`}
                        className="w-16 h-16 mb-4 inline-block"
                    />
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{appName}</h1>
                    <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Family Productivity Hub</p>
                </div>

                {/* Form */}
                <div className="card p-8">
                    {!mfaToken ? (
                        <form onSubmit={handlePasswordSubmit} className="space-y-5">
                            {error && (
                                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm animate-fade-in">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label htmlFor="email" className="label">Email</label>
                                <input
                                    id="email"
                                    type="email"
                                    className="input"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="label">Password</label>
                                <div className="relative">
                                    <input
                                        id="password"
                                        type={showPw ? 'text' : 'password'}
                                        className="input pr-10"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPw(!showPw)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                />
                                Remember me
                            </label>

                            {isDesktop && (
                                <div className="border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
                                    <button
                                        type="button"
                                        className="text-sm font-semibold"
                                        style={{ color: 'var(--color-primary)' }}
                                        onClick={() => setAdvancedOpen((current) => !current)}
                                    >
                                        {advancedOpen ? 'Hide advanced settings' : 'Advanced / Server URL'}
                                    </button>
                                    {advancedOpen && (
                                        <div className="mt-3 space-y-2">
                                            <label htmlFor="server-url" className="label">Server URL</label>
                                            <input
                                                id="server-url"
                                                type="url"
                                                className="input"
                                                value={serverUrl}
                                                onChange={(e) => {
                                                    setServerUrl(e.target.value);
                                                    if (serverUrlError) setServerUrlError('');
                                                }}
                                                onBlur={saveServerUrl}
                                                placeholder="https://api.example.com"
                                            />
                                            {serverUrlError && <p className="text-sm text-red-600">{serverUrlError}</p>}
                                            <button type="button" className="btn-secondary text-sm" onClick={saveServerUrl}>Save server URL</button>
                                        </div>
                                    )}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="btn-primary w-full py-3"
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Signing in...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2"><LogIn className="w-4 h-4" /> Sign In</span>
                                )}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleMfaSubmit} className="space-y-5">
                            {error && (
                                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm animate-fade-in">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-1">
                                <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Verify MFA</h2>
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                    Enter the 6-digit code from your authenticator app for {mfaUserEmail || email}.
                                </p>
                            </div>

                            <div>
                                <label htmlFor="mfaCode" className="label">Verification Code</label>
                                <input
                                    id="mfaCode"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    className="input tracking-[0.35em] text-center"
                                    placeholder="123456"
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    required
                                    autoFocus
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || mfaCode.length !== 6}
                                className="btn-primary w-full py-3"
                            >
                                {loading ? 'Verifying...' : 'Verify Code'}
                            </button>

                            <button
                                type="button"
                                className="btn-ghost w-full"
                                onClick={() => {
                                    setMfaToken('');
                                    setMfaCode('');
                                    setError('');
                                }}
                            >
                                Back to password
                            </button>
                        </form>
                    )}
                </div>

                <p className="text-center mt-6 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    Private family app – No public registration
                </p>
            </div>
        </div>
    );
}
