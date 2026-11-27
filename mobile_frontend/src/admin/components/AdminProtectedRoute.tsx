/**
 * src/admin/components/AdminProtectedRoute.tsx
 * Route Guard enforcing Admin-Only access.
 */

import React from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import AdminLoginPage from '../pages/AdminLoginPage';
import CricketLoader from '../../components/common/CricketLoader';

interface Props {
  children: React.ReactNode;
  onExitToPublic?: () => void;
  onUnauthorized?: () => void;
}

export const AdminProtectedRoute: React.FC<Props> = ({ children, onExitToPublic, onUnauthorized }) => {
  const { isAuthenticated, isLoading, adminUser } = useAdminAuth();

  if (isLoading) {
    return <CricketLoader />;
  }

  if (!isAuthenticated || !adminUser || adminUser.role !== 'ADMIN') {
    if (onUnauthorized) {
      onUnauthorized();
      return null;
    }
    return <AdminLoginPage onLoginSuccess={() => {}} onBackToHome={onExitToPublic} />;
  }

  return <>{children}</>;
};

export default AdminProtectedRoute;
