import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/auth';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import GoalsPage from './pages/GoalsPage';
import ProjectsPage from './pages/ProjectsPage';
import HouseworkPage from './pages/HouseworkPage';
import CalendarPage from './pages/CalendarPage';
import ExpensesPage from './pages/ExpensesPage';
import FundsPage from './pages/FundsPage';
import ReportsPage from './pages/ReportsPage';
import AssetsPage from './pages/AssetsPage';
import LearningPage from './pages/LearningPage';
import IdeasPage from './pages/IdeasPage';
import KeyboardPage from './pages/KeyboardPage';
import CaKeoPage from './pages/CaKeoPage';
import AlertsPage from './pages/AlertsPage';
import SettingsPage from './pages/SettingsPage';
import UsersPage from './pages/UsersPage';
import { isRouteAccessible } from './config/features';

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

function FeatureRoute({ route, children }: { route: string; children: React.ReactNode }) {
    const { user } = useAuthStore();
    if (!isRouteAccessible(route, user)) {
        return <Navigate to="/" replace />;
    }
    return <>{children}</>;
}

export default function App() {
    const { initialize, refreshUser, isAuthenticated, isInitialized } = useAuthStore();

    useEffect(() => {
        initialize();
        refreshUser();
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={!isInitialized ? null : isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
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
                        <Route path="learning" element={<FeatureRoute route="/learning"><LearningPage /></FeatureRoute>} />
                        <Route path="ideas" element={<FeatureRoute route="/ideas"><IdeasPage /></FeatureRoute>} />
                        <Route path="keyboard" element={<FeatureRoute route="/keyboard"><KeyboardPage /></FeatureRoute>} />
                        <Route path="cakeo" element={<FeatureRoute route="/cakeo"><CaKeoPage /></FeatureRoute>} />
                        <Route path="notifications" element={<AlertsPage forcedTab="RULES" />} />
                        <Route path="scheduled-reports" element={<AlertsPage forcedTab="REPORTS" />} />
                        <Route path="alerts" element={<Navigate to="/notifications" replace />} />
                        <Route path="settings" element={<SettingsPage />} />
                        <Route path="users" element={<AdminRoute><UsersPage /></AdminRoute>} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </QueryClientProvider>
    );
}
