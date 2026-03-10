import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import {
    LayoutDashboard, Trophy, FolderKanban, Home, Calendar,
    Wallet, BarChart3, Settings, Users, LogOut, Menu, X,
    ChevronRight, ChevronDown, Bell, Microwave, GraduationCap, Lightbulb, BellRing, ClipboardList, FileText
} from 'lucide-react';

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/reports', icon: BarChart3, label: 'Analytics' },
    { to: '/goals', icon: Trophy, label: 'Goals' },
    { to: '/tasks', icon: ClipboardList, label: 'Tasks' },
    { to: '/projects', icon: FolderKanban, label: 'Projects' },
    { to: '/expenses', icon: Wallet, label: 'Expenses' },
    { to: '/learning', icon: GraduationCap, label: 'Learning' },
    { to: '/ideas', icon: Lightbulb, label: 'Ideas' },
    { to: '/housework', icon: Home, label: 'Housework' },
    { to: '/assets', icon: Microwave, label: 'Appliances & Devices' },
    { to: '/calendar', icon: Calendar, label: 'Calendar' },
    { to: '/scheduled-reports', icon: FileText, label: 'Reports' },
    { to: '/notifications', icon: BellRing, label: 'Notifications' },
    { to: '/settings', icon: Settings, label: 'User Settings' },
];

const adminItems = [
    { to: '/users', icon: Users, label: 'User Management' },
];

const navGroups = [
    { id: 'dashboard', label: 'Dashboard', items: ['/', '/reports'] },
    { id: 'personal', label: 'Personal', items: ['/goals', '/expenses', '/learning', '/ideas', '/tasks', '/projects'] },
    { id: 'family', label: 'Family', items: ['/housework', '/assets', '/calendar'] },
    { id: 'settings', label: 'Settings', items: ['/scheduled-reports', '/notifications', '/settings'] },
    { id: 'admin', label: 'Admin', items: ['/users'] },
] as const;

const DEFAULT_GROUP_STATE: Record<string, boolean> = {
    dashboard: true,
    personal: true,
    family: true,
    settings: true,
    admin: true,
};

const GROUP_STORAGE_KEY = 'ngocky-sidebar-groups';

export default function AppLayout() {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>(() => {
        if (typeof window === 'undefined') return DEFAULT_GROUP_STATE;
        try {
            const saved = window.localStorage.getItem(GROUP_STORAGE_KEY);
            return saved ? { ...DEFAULT_GROUP_STATE, ...JSON.parse(saved) } : DEFAULT_GROUP_STATE;
        } catch {
            return DEFAULT_GROUP_STATE;
        }
    });

    const isAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const pageTitle = (() => {
        const current = [...navItems, ...adminItems].find(
            (i) => i.to === location.pathname || (i.to !== '/' && location.pathname.startsWith(i.to))
        );
        return current?.label || 'NgốcKý';
    })();

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(groupOpen));
    }, [groupOpen]);

    const toggleGroup = (groupId: string) => {
        setGroupOpen((current) => ({
            ...current,
            [groupId]: !current[groupId],
        }));
    };

    const resolveNavItem = (to: string) => [...navItems, ...adminItems].find((item) => item.to === to);
    const visibleGroups = navGroups.filter((group) => group.id !== 'admin' || isAdmin);
    const mobileItems = ['/', '/goals', '/tasks', '/calendar', '/settings']
        .map((to) => resolveNavItem(to))
        .filter(Boolean) as Array<(typeof navItems)[number]>;

    return (
        <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
            {/* Sidebar */}
            <aside
                className={`fixed lg:relative z-30 h-full flex flex-col transition-all duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                    } ${collapsed ? 'w-[72px]' : 'w-[260px]'}`}
                style={{ backgroundColor: 'var(--color-surface)', borderRight: '1px solid var(--color-border)' }}
            >
                {/* Logo */}
                <div className="flex items-center gap-3 px-5 h-16 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <img src="/ladybug-logo.svg" alt="NgốcKý logo" className="w-8 h-8" />
                    {!collapsed && (
                        <span className="font-bold text-lg tracking-tight" style={{ color: 'var(--color-text)' }}>
                            NgốcKý
                        </span>
                    )}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="ml-auto hidden lg:flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100"
                    >
                        <ChevronRight className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} style={{ color: 'var(--color-text-secondary)' }} />
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                    {visibleGroups.map((group) => {
                        const items = group.items
                            .map((to) => resolveNavItem(to))
                            .filter(Boolean) as Array<(typeof navItems)[number]>;

                        if (collapsed) {
                            return (
                                <div key={group.id} className="space-y-1">
                                    {items.map((item) => (
                                        <NavLink
                                            key={item.to}
                                            to={item.to}
                                            end={item.to === '/'}
                                            onClick={() => setSidebarOpen(false)}
                                            className={({ isActive }) =>
                                                `flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${isActive
                                                    ? 'text-white shadow-sm'
                                                    : 'hover:bg-gray-50'
                                                }`
                                            }
                                            style={({ isActive }) =>
                                                isActive
                                                    ? { backgroundColor: 'var(--color-primary)' }
                                                    : { color: 'var(--color-text-secondary)' }
                                            }
                                            title={item.label}
                                        >
                                            <item.icon className="w-5 h-5 flex-shrink-0" />
                                        </NavLink>
                                    ))}
                                </div>
                            );
                        }

                        return (
                            <div key={group.id} className="space-y-1">
                                <button
                                    type="button"
                                    onClick={() => toggleGroup(group.id)}
                                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-gray-50 transition-colors"
                                    style={{ color: 'var(--color-text)' }}
                                >
                                    <span className="flex-1 text-left">{group.label}</span>
                                    {groupOpen[group.id] ? (
                                        <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                                    ) : (
                                        <ChevronRight className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                                    )}
                                </button>

                                {groupOpen[group.id] && (
                                    <div className="space-y-1 pl-2">
                                        {items.map((item) => (
                                            <NavLink
                                                key={item.to}
                                                to={item.to}
                                                end={item.to === '/'}
                                                onClick={() => setSidebarOpen(false)}
                                                className={({ isActive }) =>
                                                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${isActive
                                                        ? 'text-white shadow-sm'
                                                        : 'hover:bg-gray-50'
                                                    }`
                                                }
                                                style={({ isActive }) =>
                                                    isActive
                                                        ? { backgroundColor: 'var(--color-primary)' }
                                                        : { color: 'var(--color-text-secondary)' }
                                                }
                                            >
                                                <item.icon className="w-5 h-5 flex-shrink-0" />
                                                <span>{item.label}</span>
                                            </NavLink>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>

                {/* Footer */}
                {!collapsed && (
                    <div className="p-4 border-t text-[11px]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                        NgốcKý v1.0.0
                    </div>
                )}
            </aside>

            {/* Overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Main */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top bar */}
                <header
                    className="flex items-center gap-4 px-4 lg:px-6 h-16 border-b flex-shrink-0"
                    style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                >
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
                    >
                        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>

                    <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                        {pageTitle}
                    </h1>

                    <div className="ml-auto flex items-center gap-3">
                        <button className="btn-ghost p-2 rounded-lg relative">
                            <Bell className="w-5 h-5" />
                        </button>
                        <div
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={handleLogout}
                            title="Logout"
                        >
                            {user?.avatarUrl ? (
                                <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                                    style={{ background: 'linear-gradient(135deg, var(--color-primary), #7c3aed)' }}>
                                    {user?.name?.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <span className="hidden sm:block text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                                {user?.name}
                            </span>
                            <LogOut className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                        </div>
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                    <div className="max-w-7xl mx-auto animate-fade-in">
                        <Outlet />
                    </div>
                </main>
            </div>

            {/* Mobile bottom nav */}
            <nav className="fixed bottom-0 left-0 right-0 z-20 lg:hidden border-t flex"
                style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                {mobileItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        className={({ isActive }) =>
                            `flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${isActive ? '' : ''
                            }`
                        }
                        style={({ isActive }) => ({
                            color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                        })}
                    >
                        <item.icon className="w-5 h-5" />
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>
        </div>
    );
}
