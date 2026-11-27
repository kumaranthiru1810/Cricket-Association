import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import AdminDashboardScreen from '../../screens/admin/AdminDashboardScreen';
import AdminGuard from '../admin/AdminGuard';

export default function SuperAdminDashboardRoute() {
  const params = useLocalSearchParams();

  return (
    <AdminGuard requireSuperAdmin={true}>
      {(onExit) => <AdminDashboardScreen onExit={onExit} initialParams={params} isSuperAdminMode={true} />}
    </AdminGuard>
  );
}
