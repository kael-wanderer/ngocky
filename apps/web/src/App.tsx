import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/auth';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import { BUILT_IN_ROUTE_TEMPLATE_MAP, isRouteAccessible } from './config/features';
import { useAppSettings, useSetupStatus } from './api/appSettings';
import { usePageTemplates } from './api/pages';
import DesktopGate from './components/DesktopGate';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const GoalsPage = lazy(() => import('./pages/goals'));
const ProjectsPage = lazy(() => import('./pages/projects'));
const HouseworkPage = lazy(() => import('./pages/HouseworkPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const FundsPage = lazy(() => import('./pages/FundsPage'));
const ReportsPage = lazy(() => import('./pages/reports'));
const AssetsPage = lazy(() => import('./pages/AssetsPage'));
const LearningPage = lazy(() => import('./pages/LearningPage'));
const IdeasPage = lazy(() => import('./pages/IdeasPage'));
const KeyboardPage = lazy(() => import('./pages/KeyboardPage'));
const FoodPage = lazy(() => import('./pages/FoodPage'));
const CaKeoPage = lazy(() => import('./pages/CaKeoPage'));
const HealthbookPage = lazy(() => import('./pages/healthbook'));
const AlertsPage = lazy(() => import('./pages/AlertsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const SetupPage = lazy(() => import('./pages/SetupPage'));
const InstancePage = lazy(() => import('./pages/InstancePage'));
const AgentSettingsPage = lazy(() => import('./pages/admin/AgentSettingsPage'));
const ApplicationManagementPage = lazy(() => import('./pages/admin/ApplicationManagementPage'));

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
    },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isInitialized } = useAuthStore();
    if (!isInitialized) return null;
    return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
    const { user } = useAuthStore();
    if (!user || (user.role !== 'OWNER' && user.role !== 'ADMIN')) {
        return <Navigate to="/" replace />;
    }
    return <>{children}</>;
}

function OwnerRoute({ children }: { children: React.ReactNode }) {
    const { user } = useAuthStore();
    return user?.role === 'OWNER' ? <>{children}</> : <Navigate to="/" replace />;
}

function FeatureRoute({ route, children }: { route: string; children: React.ReactNode }) {
    const { user } = useAuthStore();
    const { data: appSettings } = useAppSettings();
    const { data: pageTemplates } = usePageTemplates();
    const builtInTemplate = pageTemplates?.find((template) => template.moduleType === BUILT_IN_ROUTE_TEMPLATE_MAP[route]);
    if (builtInTemplate?.visible === false) return <Navigate to="/" replace />;
    if (!isRouteAccessible(route, user, appSettings?.enabledGroups)) {
        return <Navigate to="/" replace />;
    }
    return <>{children}</>;
}

function AppRoutes() {
    const { initialize, refreshUser, isAuthenticated, isInitialized } = useAuthStore();
    const { data: appSettings } = useAppSettings();
    const { data: setupStatus } = useSetupStatus(isInitialized && !isAuthenticated);

    useEffect(() => {
        initialize();
        refreshUser();
    }, []);

    useEffect(() => {
        document.title = appSettings?.appName || 'NgốcKý';
    }, [appSettings?.appName]);

    const loginElement = !isInitialized
        ? null
        : isAuthenticated
            ? <Navigate to="/" replace />
            : setupStatus?.needsSetup
                ? <SetupPage />
                : <LoginPage />;

    return (
        <BrowserRouter>
            <Suspense fallback={null}>
                <Routes>
                    <Route path="/login" element={loginElement} />
                    <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                        <Route index element={<DashboardPage />} />
                        <Route path="goals" element={<FeatureRoute route="/goals"><GoalsPage forcedTab="GOALS" /></FeatureRoute>} />
                        <Route path="tasks" element={<FeatureRoute route="/tasks"><GoalsPage forcedTab="TASKS" /></FeatureRoute>} />
                        <Route path="projects" element={<FeatureRoute route="/projects"><ProjectsPage /></FeatureRoute>} />
                        <Route path="housework" element={<FeatureRoute route="/housework"><HouseworkPage /></FeatureRoute>} />
                        <Route path="calendar" element={<FeatureRoute route="/calendar"><CalendarPage /></FeatureRoute>} />
                        <Route path="expenses" element={<FeatureRoute route="/expenses"><ExpensesPage /></FeatureRoute>} />
                        <Route path="funds" element={<FeatureRoute route="/funds"><FundsPage /></FeatureRoute>} />
                        <Route path="reports" element={<ReportsPage />} />
                        <Route path="assets" element={<FeatureRoute route="/assets"><AssetsPage /></FeatureRoute>} />
                        <Route path="assets/:assetId" element={<FeatureRoute route="/assets"><AssetsPage /></FeatureRoute>} />
                        <Route path="learning" element={<FeatureRoute route="/learning"><LearningPage /></FeatureRoute>} />
                        <Route path="ideas" element={<FeatureRoute route="/ideas"><IdeasPage /></FeatureRoute>} />
                        <Route path="keyboard" element={<FeatureRoute route="/keyboard"><KeyboardPage /></FeatureRoute>} />
                        <Route path="food" element={<FeatureRoute route="/food"><FoodPage /></FeatureRoute>} />
                        <Route path="cakeo" element={<FeatureRoute route="/cakeo"><CaKeoPage /></FeatureRoute>} />
                        <Route path="healthbook" element={<FeatureRoute route="/healthbook"><HealthbookPage /></FeatureRoute>} />
                        <Route path="healthbook/:personId" element={<FeatureRoute route="/healthbook"><HealthbookPage /></FeatureRoute>} />
                        <Route path="notifications" element={<AlertsPage forcedTab="RULES" />} />
                        <Route path="scheduled-reports" element={<AlertsPage forcedTab="REPORTS" />} />
                        <Route path="alerts" element={<Navigate to="/notifications" replace />} />
                        <Route path="settings" element={<SettingsPage />} />
                        <Route path="users" element={<AdminRoute><UsersPage /></AdminRoute>} />
                        <Route path="admin/agent" element={<OwnerRoute><AgentSettingsPage /></OwnerRoute>} />
                        <Route path="admin/application" element={<AdminRoute><ApplicationManagementPage /></AdminRoute>} />
                        <Route path="p/:slug" element={<InstancePage />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Suspense>
        </BrowserRouter>
    );
}

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <DesktopGate>
                <AppRoutes />
            </DesktopGate>
        </QueryClientProvider>
    );
}
