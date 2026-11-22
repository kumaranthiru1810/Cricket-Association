import React from 'react';
import { router } from 'expo-router';
import { AdminLoginPage } from '../../admin/pages/AdminLoginPage';
import { AdminAuthProvider } from '../../admin/context/AdminAuthContext';

export default function AdminLoginSubRoute() {
  return (
    <AdminAuthProvider>
      <AdminLoginPage
        onBackToHome={() => router.replace('/')}
        onLoginSuccess={() => router.replace('/admin')}
      />
    </AdminAuthProvider>
  );
}

