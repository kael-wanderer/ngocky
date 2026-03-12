import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { getFeatureFlags, isFeatureRouteEnabled } from '../config/features';
import {
    LayoutDashboard, Trophy, FolderKanban, Home, Calendar,
    Wallet, BarChart3, Settings, Users, LogOut, Menu, X,
    ChevronRight, ChevronDown, Bell, Microwave, GraduationCap, Lightbulb, BellRing, ClipboardList, FileText, GripVertical, Coins, Keyboard, Baby
} from 'lucide-react';

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/reports', icon: BarChart3, label: 'Analytics' },
    { to: '/tasks', icon: ClipboardList, label: 'Tasks' },
    { to: '/projects', icon: FolderKanban, label: 'Projects' },
    { to: '/expenses', icon: Wallet, label: 'Expenses' },
    { to: '/goals', icon: Trophy, label: 'Goals' },
    { to: '/ideas', icon: Lightbulb, label: 'Ideas' },
    { to: '/calendar', icon: Calendar, label: 'Calendar' },
    { to: '/cakeo', icon: Baby, label: 'Ca Keo' },
    { to: '/housework', icon: Home, label: 'Housework' },
    { to: '/assets', icon: Microwave, label: 'Assets' },
    { to: '/keyboard', icon: Keyboard, label: 'Keyboard' },
    { to: '/funds', icon: Coins, label: 'Funds' },
    { to: '/learning', icon: GraduationCap, label: 'Learning' },
    { to: '/scheduled-reports', icon: FileText, label: 'Schedule Action' },
    { to: '/notifications', icon: BellRing, label: 'Notifications' },
    { to: '/settings', icon: Settings, label: 'User Settings' },
];

const adminItems = [
    { to: '/users', icon: Users, label: 'User Management' },
];

const navGroups = [
    { id: 'dashboard', label: 'Dashboard', items: ['/', '/reports'] },
    { id: 'personal', label: 'Personal', items: ['/tasks', '/projects', '/expenses', '/goals', '/ideas'] },
    { id: 'family', label: 'Family', items: ['/calendar', '/cakeo', '/housework', '/assets'] },
    { id: 'hobby', label: 'Hobby', items: ['/keyboard', '/funds', '/learning'] },
    { id: 'settings', label: 'Settings', items: ['/scheduled-reports', '/notifications', '/settings'] },
    { id: 'admin', label: 'Admin', items: ['/users'] },
] as const;

const DEFAULT_GROUP_STATE: Record<string, boolean> = {
    dashboard: true,
    personal: true,
    family: true,
    hobby: true,
    settings: true,
    admin: true,
};

const GROUP_STORAGE_KEY = 'ngocky-sidebar-groups';
const GROUP_ORDER_STORAGE_KEY = 'ngocky-sidebar-group-order';
const GROUP_ORDER_VERSION_KEY = 'ngocky-sidebar-group-order-version';
const GROUP_ORDER_VERSION = 2;
const CUSTOMIZABLE_GROUP_IDS = navGroups.filter((group) => group.id !== 'admin').map((group) => group.id);
const CUSTOMIZABLE_NAV_PATHS = navItems.map((item) => item.to);

function migrateLegacyGroupOrder(order: Record<string, string[]>) {
    const next: Record<string, string[]> = {};
    for (const [groupId, items] of Object.entries(order || {})) {
        next[groupId] = Array.isArray(items) ? [...items] : [];
    }

    const hobbyRoutes = ['/keyboard', '/funds', '/learning'];
    for (const groupId of Object.keys(next)) {
        next[groupId] = next[groupId].filter((to) => !hobbyRoutes.includes(to));
    }

    next.hobby = hobbyRoutes;
    return next;
}

function normalizeGroupOrder(order: Record<string, string[]>, includeAdmin: boolean) {
    const next: Record<string, string[]> = {};
    const unassigned = new Set<string>(CUSTOMIZABLE_NAV_PATHS);

    for (const group of navGroups) {
        if (group.id === 'admin') continue;

        const saved = order[group.id] || [];
        const filteredSaved = saved.filter((to) => unassigned.has(to));
        filteredSaved.forEach((to) => unassigned.delete(to));
        next[group.id] = filteredSaved;
    }

    for (const group of navGroups) {
        if (group.id === 'admin') continue;

        const defaultItems = group.items.filter((to) => unassigned.has(to));
        defaultItems.forEach((to) => unassigned.delete(to));
        next[group.id] = [...(next[group.id] || []), ...defaultItems];
    }

    if (unassigned.size > 0) {
        next.personal = [...(next.personal || []), ...Array.from(unassigned)];
    }

    if (includeAdmin) {
        next.admin = ['/users'];
    }

    return next;
}

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
    const [groupOrder, setGroupOrder] = useState<Record<string, string[]>>(() => {
        if (typeof window === 'undefined') return normalizeGroupOrder({}, false);
        try {
            const saved = window.localStorage.getItem(GROUP_ORDER_STORAGE_KEY);
            const savedVersion = Number(window.localStorage.getItem(GROUP_ORDER_VERSION_KEY) || '0');
            const parsed = saved ? JSON.parse(saved) : {};
            const migrated = savedVersion < GROUP_ORDER_VERSION ? migrateLegacyGroupOrder(parsed) : parsed;
            return normalizeGroupOrder(migrated, false);
        } catch {
            return normalizeGroupOrder({}, false);
        }
    });
    const [draggedItem, setDraggedItem] = useState<{ groupId: string; to: string } | null>(null);
    const [dragOverItem, setDragOverItem] = useState<{ groupId: string; to: string } | null>(null);
    const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);
    const [showNotificationMenu, setShowNotificationMenu] = useState(false);
    const [showAccountMenu, setShowAccountMenu] = useState(false);
    const notificationMenuRef = useRef<HTMLDivElement | null>(null);
    const accountMenuRef = useRef<HTMLDivElement | null>(null);

    const isAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';
    const featureFlags = getFeatureFlags(user);

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

    useEffect(() => {
        setGroupOrder((current) => normalizeGroupOrder(current, isAdmin));
    }, [isAdmin]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(GROUP_ORDER_STORAGE_KEY, JSON.stringify(groupOrder));
        window.localStorage.setItem(GROUP_ORDER_VERSION_KEY, String(GROUP_ORDER_VERSION));
    }, [groupOrder]);

    useEffect(() => {
        if (!showNotificationMenu) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (!notificationMenuRef.current?.contains(event.target as Node)) {
                setShowNotificationMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showNotificationMenu]);

    useEffect(() => {
        if (!showAccountMenu) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (!accountMenuRef.current?.contains(event.target as Node)) {
                setShowAccountMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showAccountMenu]);

    const toggleGroup = (groupId: string) => {
        setGroupOpen((current) => ({
            ...current,
            [groupId]: !current[groupId],
        }));
    };

    const resolveNavItem = (to: string) => [...navItems, ...adminItems].find((item) => item.to === to);
    const visibleGroups = navGroups.filter((group) => {
        if (group.id === 'admin') return isAdmin;
        if (group.id === 'personal' || group.id === 'family' || group.id === 'hobby') {
            return group.items.some((to) => isFeatureRouteEnabled(to, featureFlags));
        }
        return true;
    });
    const mobileItems = ['/', '/goals', '/tasks', '/calendar', '/settings']
        .filter((to) => isFeatureRouteEnabled(to, featureFlags))
        .map((to) => resolveNavItem(to))
        .filter(Boolean) as Array<(typeof navItems)[number]>;

    const moveItemWithinGroup = (groupId: string, fromTo: string, targetTo: string) => {
        if (fromTo === targetTo) return;

        setGroupOrder((current) => {
            const currentOrder = current[groupId] || [];
            const nextOrder = [...currentOrder];
            const fromIndex = nextOrder.indexOf(fromTo);
            const targetIndex = nextOrder.indexOf(targetTo);

            if (fromIndex === -1 || targetIndex === -1) return current;

            nextOrder.splice(fromIndex, 1);
            nextOrder.splice(targetIndex, 0, fromTo);

            return {
                ...current,
                [groupId]: nextOrder,
            };
        });
    };

    const moveItemToGroup = (fromGroupId: string, toGroupId: string, itemTo: string, targetTo?: string) => {
        if (fromGroupId === 'admin' || toGroupId === 'admin') return;

        setGroupOrder((current) => {
            const source = [...(current[fromGroupId] || [])];
            const destination = fromGroupId === toGroupId ? source : [...(current[toGroupId] || [])];
            const fromIndex = source.indexOf(itemTo);

            if (fromIndex === -1) return current;

            source.splice(fromIndex, 1);

            const nextDestination = fromGroupId === toGroupId ? source : destination.filter((to) => to !== itemTo);
            const targetIndex = targetTo ? nextDestination.indexOf(targetTo) : -1;

            if (targetIndex === -1) nextDestination.push(itemTo);
            else nextDestination.splice(targetIndex, 0, itemTo);

            return {
                ...current,
                [fromGroupId]: source,
                [toGroupId]: nextDestination,
            };
        });
    };

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
                        const orderedPaths = groupOrder[group.id] || group.items;
                        const items = orderedPaths
                            .filter((to) => isFeatureRouteEnabled(to, featureFlags))
                            .map((to) => resolveNavItem(to))
                            .filter(Boolean) as Array<(typeof navItems)[number]>;

                        if (items.length === 0) return null;

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
                            <div
                                key={group.id}
                                className={`space-y-1 rounded-xl transition-all ${dragOverGroup === group.id ? 'bg-slate-50' : ''}`}
                                onDragOver={(e) => {
                                    if (!draggedItem || group.id === 'admin') return;
                                    e.preventDefault();
                                    setDragOverGroup(group.id);
                                }}
                                onDragLeave={() => {
                                    if (dragOverGroup === group.id) setDragOverGroup(null);
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    if (!draggedItem || group.id === 'admin') return;
                                    moveItemToGroup(draggedItem.groupId, group.id, draggedItem.to);
                                    setDraggedItem(null);
                                    setDragOverItem(null);
                                    setDragOverGroup(null);
                                }}
                            >
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
                                            <div
                                                key={item.to}
                                                draggable
                                                onDragStart={() => setDraggedItem({ groupId: group.id, to: item.to })}
                                                onDragOver={(e) => {
                                                    if (!draggedItem || draggedItem.to === item.to || group.id === 'admin') return;
                                                    e.preventDefault();
                                                    setDragOverGroup(group.id);
                                                    setDragOverItem({ groupId: group.id, to: item.to });
                                                }}
                                                onDragLeave={() => {
                                                    if (dragOverItem?.groupId === group.id && dragOverItem.to === item.to) {
                                                        setDragOverItem(null);
                                                    }
                                                }}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    if (!draggedItem || group.id === 'admin') return;
                                                    if (draggedItem.groupId === group.id) moveItemWithinGroup(group.id, draggedItem.to, item.to);
                                                    else moveItemToGroup(draggedItem.groupId, group.id, draggedItem.to, item.to);
                                                    setDraggedItem(null);
                                                    setDragOverItem(null);
                                                    setDragOverGroup(null);
                                                }}
                                                onDragEnd={() => {
                                                    setDraggedItem(null);
                                                    setDragOverItem(null);
                                                    setDragOverGroup(null);
                                                }}
                                                className={`rounded-lg transition-all ${dragOverItem?.groupId === group.id && dragOverItem.to === item.to ? 'ring-2 ring-slate-300' : ''} ${draggedItem?.groupId === group.id && draggedItem.to === item.to ? 'opacity-60' : ''}`}
                                            >
                                                <NavLink
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
                                                    <GripVertical className="w-4 h-4 flex-shrink-0 opacity-50" />
                                                    <item.icon className="w-5 h-5 flex-shrink-0" />
                                                    <span>{item.label}</span>
                                                </NavLink>
                                            </div>
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
                        NgốcKý v1.1.0
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
                        <div className="relative" ref={notificationMenuRef}>
                            <button
                                className="btn-ghost p-2 rounded-lg relative"
                                title="Notifications"
                                onClick={() => setShowNotificationMenu((current) => !current)}
                            >
                                <Bell className="w-5 h-5" />
                            </button>
                            {showNotificationMenu && (
                                <div
                                    className="absolute right-0 mt-2 w-56 rounded-xl border shadow-lg py-2 z-40"
                                    style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                                >
                                    <button
                                        type="button"
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                                        style={{ color: 'var(--color-text)' }}
                                        onClick={() => {
                                            setShowNotificationMenu(false);
                                            navigate('/notifications');
                                        }}
                                    >
                                        Notification Setting
                                    </button>
                                    <button
                                        type="button"
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                                        style={{ color: 'var(--color-text)' }}
                                        onClick={() => {
                                            setShowNotificationMenu(false);
                                            navigate('/settings?tab=notifications');
                                        }}
                                    >
                                        Notification Channel
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="relative" ref={accountMenuRef}>
                            <button
                                type="button"
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                                onClick={() => setShowAccountMenu((current) => !current)}
                                title="Account"
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
                            </button>
                            {showAccountMenu && (
                                <div
                                    className="absolute right-0 mt-2 w-56 rounded-xl border shadow-lg py-2 z-40"
                                    style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                                >
                                    <button
                                        type="button"
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                                        style={{ color: 'var(--color-text)' }}
                                        onClick={() => {
                                            setShowAccountMenu(false);
                                            navigate('/settings?tab=profile');
                                        }}
                                    >
                                        Update profile
                                    </button>
                                    <button
                                        type="button"
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                                        style={{ color: 'var(--color-text)' }}
                                        onClick={() => {
                                            setShowAccountMenu(false);
                                            navigate('/settings?tab=theme');
                                        }}
                                    >
                                        Theme settings
                                    </button>
                                    <button
                                        type="button"
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                                        style={{ color: 'var(--color-text)' }}
                                        onClick={() => {
                                            setShowAccountMenu(false);
                                            navigate('/settings?tab=features');
                                        }}
                                    >
                                        Feature options
                                    </button>
                                    <button
                                        type="button"
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                                        style={{ color: 'var(--color-text)' }}
                                        onClick={() => {
                                            setShowAccountMenu(false);
                                            navigate('/settings?tab=security');
                                        }}
                                    >
                                        Password & MFA
                                    </button>
                                    <button
                                        type="button"
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 transition-colors"
                                        style={{ color: 'var(--color-danger)' }}
                                        onClick={() => {
                                            setShowAccountMenu(false);
                                            handleLogout();
                                        }}
                                    >
                                        Sign out
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                    <div className="max-w-[1600px] mx-auto animate-fade-in">
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
