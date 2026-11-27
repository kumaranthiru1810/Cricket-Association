import React, { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { getCurrentUser } from '../../services/api';
import { getStoredAdminUser } from '../../admin/services/adminApi';
import { AdminLoginPage } from '../../admin/pages/AdminLoginPage';
import { SuperAdminLoginPage } from '../../admin/pages/SuperAdminLoginPage';

interface AdminGuardProps {
  children: (onExit: () => void) => React.ReactNode;
  requireSuperAdmin?: boolean;
}

export default function AdminGuard({ children, requireSuperAdmin = false }: AdminGuardProps) {
  const checkIsAdmin = () => {
    const user = getStoredAdminUser() || getCurrentUser();
    if (!user) return false;
    const role = (user.role || '').toUpperCase();
    if (requireSuperAdmin) {
      return Boolean(user.is_super_admin || role === 'SUPER_ADMIN');
    }
    return role === 'ADMIN' || role === 'SUPER_ADMIN';
  };

  const [isAdmin, setIsAdmin] = useState<boolean>(checkIsAdmin);

  useEffect(() => {
    setIsAdmin(checkIsAdmin());
  }, [requireSuperAdmin]);

  if (!isAdmin) {
    if (requireSuperAdmin) {
      return (
        <SuperAdminLoginPage
          onBackToHome={() => router.replace('/')}
          onGoToAdminLogin={() => router.replace('/admin-login')}
          onLoginSuccess={() => {
            setIsAdmin(true);
          }}
        />
      );
    }
    return (
      <AdminLoginPage
        onBackToHome={() => router.replace('/')}
        onLoginSuccess={() => {
          setIsAdmin(true);
        }}
      />
    );
  }

  return <>{children(() => setIsAdmin(false))}</>;
}

