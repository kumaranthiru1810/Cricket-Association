import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import AdminDashboardScreen from '../../screens/admin/AdminDashboardScreen';
import AdminGuard from './AdminGuard';

export default function AdminRoute() {
  const params = useLocalSearchParams();

  return (
    <AdminGuard>
      {(onExit) => <AdminDashboardScreen onExit={onExit} initialParams={params} />}
    </AdminGuard>
  );
}
