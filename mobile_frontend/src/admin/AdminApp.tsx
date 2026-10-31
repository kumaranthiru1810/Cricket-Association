/**
 * src/admin/AdminApp.tsx
 * Master Application Shell & Routing Coordinator for Cricket Association Professional Admin Panel.
 * Manages route transitions, browser URL sync, back/forward history, and admin authentication guards.
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import { AdminProtectedRoute } from './components/AdminProtectedRoute';
import { AdminLayout } from './components/AdminLayout';

// Sub Pages
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { PlayersPage } from './pages/PlayersPage';
import { TeamsPage } from './pages/TeamsPage';
import { TournamentsPage } from './pages/TournamentsPage';
import { MatchesPage } from './pages/MatchesPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { LiveScoringPage } from './pages/LiveScoringPage';
import { StatisticsPage } from './pages/StatisticsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ContentPage } from './pages/ContentPage';
import { SettingsPage } from './pages/SettingsPage';
import CricketLawsManagement from './components/CricketLawsManagement';
import CalculationSettingsManagement from './components/CalculationSettingsManagement';

export interface AdminAppProps {
  initialPath?: string;
  onExitAdmin?: () => void;
}

const getBrowserPath = (): string => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const p = window.location.pathname;
    if (p.startsWith('/admin')) {
      return p === '/admin' ? '/admin/dashboard' : p;
    }
  }
  return '/admin/dashboard';
};

const AdminRoutingShell: React.FC<{ onExitAdmin?: () => void }> = ({ onExitAdmin }) => {
  const [currentPath, setCurrentPath] = useState<string>(getBrowserPath());

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handlePopState = () => {
        const path = window.location.pathname;
        if (path.startsWith('/admin')) {
          setCurrentPath(path === '/admin' ? '/admin/dashboard' : path);
        }
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, []);

  const handleNavigate = (path: string) => {
    let target = path;
    if (target === '/admin') target = '/admin/dashboard';
    setCurrentPath(target);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.location.pathname !== target) {
        window.history.pushState({}, '', target);
      }
    }
  };

  // Render the matching page component
  const renderCurrentPage = () => {
    switch (currentPath) {
      case '/admin':
      case '/admin/dashboard':
        return <DashboardPage onNavigate={handleNavigate} />;
      case '/admin/users':
        return <UsersPage />;
      case '/admin/players':
        return <PlayersPage />;
      case '/admin/teams':
        return <TeamsPage />;
      case '/admin/tournaments':
        return <TournamentsPage />;
      case '/admin/matches':
        return <MatchesPage />;
      case '/admin/approvals':
        return <ApprovalsPage />;
      case '/admin/live-scoring':
        return <LiveScoringPage />;
      case '/admin/statistics':
        return <StatisticsPage />;
      case '/admin/notifications':
        return <NotificationsPage />;
      case '/admin/content':
        return <ContentPage />;
      case '/admin/laws':
        return <CricketLawsManagement />;
      case '/admin/calculations':
        return <CalculationSettingsManagement />;
      case '/admin/settings':
        return <SettingsPage />;
      default:
        return <DashboardPage onNavigate={handleNavigate} />;
    }
  };

  return (
    <AdminProtectedRoute
      onUnauthorized={() => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.location.href = '/admin/login';
        }
      }}
    >
      <AdminLayout currentPath={currentPath} onNavigate={handleNavigate}>
        {renderCurrentPage()}
      </AdminLayout>
    </AdminProtectedRoute>
  );
};

export const AdminApp: React.FC<AdminAppProps> = ({ onExitAdmin }) => {
  const auth = useAdminAuth();
  if (auth && auth.isContextProvided) {
    return <AdminRoutingShell onExitAdmin={onExitAdmin} />;
  }
  return (
    <AdminAuthProvider>
      <AdminRoutingShell onExitAdmin={onExitAdmin} />
    </AdminAuthProvider>
  );
};

export default AdminApp;
