import React, { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { getCurrentUser } from '../../services/api';
import { getStoredAdminUser } from '../../admin/services/adminApi';
import { AdminLoginPage } from '../../admin/pages/AdminLoginPage';

interface AdminGuardProps {
  children: (onExit: () => void) => React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const checkIsAdmin = () => {
    const user = getStoredAdminUser() || getCurrentUser();
    return !!user && (user.role || '').toUpperCase() === 'ADMIN';
  };

  const [isAdmin, setIsAdmin] = useState<boolean>(checkIsAdmin);

  useEffect(() => {
    setIsAdmin(checkIsAdmin());
  }, []);

  if (!isAdmin) {
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

