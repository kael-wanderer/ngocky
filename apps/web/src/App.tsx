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
import ReportsPage from './pages/ReportsPage';
import AssetsPage from './pages/AssetsPage';
import LearningPage from './pages/LearningPage';
import IdeasPage from './pages/IdeasPage';
import AlertsPage from './pages/AlertsPage';
import SettingsPage from './pages/SettingsPage';
import UsersPage from './pages/UsersPage';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
    },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuthStore();
    return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
    const { user } = useAuthStore();
    if (!user || (user.role !== 'OWNER' && user.role !== 'ADMIN')) {
        return <Navigate to="/" replace />;
    }
    return <>{children}</>;
}

export default function App() {
    const { initialize, isAuthenticated } = useAuthStore();

    useEffect(() => {
        initialize();
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
                    <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                        <Route index element={<DashboardPage />} />
                        <Route path="goals" element={<GoalsPage forcedTab="GOALS" />} />
                        <Route path="tasks" element={<GoalsPage forcedTab="TASKS" />} />
                        <Route path="projects" element={<ProjectsPage />} />
                        <Route path="housework" element={<HouseworkPage />} />
                        <Route path="calendar" element={<CalendarPage />} />
                        <Route path="expenses" element={<ExpensesPage />} />
                        <Route path="reports" element={<ReportsPage />} />
                        <Route path="assets" element={<AssetsPage />} />
                        <Route path="learning" element={<LearningPage />} />
                        <Route path="ideas" element={<IdeasPage />} />
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
