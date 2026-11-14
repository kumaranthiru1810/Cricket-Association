import React from 'react';
import { router } from 'expo-router';
import { AdminLoginPage } from '../admin/pages/AdminLoginPage';

export default function AdminLoginRoute() {
  return <AdminLoginPage onBackToHome={() => router.replace('/')} onLoginSuccess={() => router.replace('/admin')} />;
}
