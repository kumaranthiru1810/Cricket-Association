import React from 'react';
import { router } from 'expo-router';
import { SuperAdminLoginPage } from '../admin/pages/SuperAdminLoginPage';
import { AdminAuthProvider } from '../admin/context/AdminAuthContext';

export default function SuperAdminRoute() {
  return (
    <AdminAuthProvider>
      <SuperAdminLoginPage
        onBackToHome={() => router.replace('/')}
        onGoToAdminLogin={() => router.replace('/admin-login')}
        onLoginSuccess={() => router.replace('/super-admin')}
      />
    </AdminAuthProvider>
  );
}
