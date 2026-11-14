import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import AdminDashboardScreen from '../../screens/admin/AdminDashboardScreen';
import AdminGuard from './AdminGuard';

export default function AdminTournamentsRoute() {
  const params = useLocalSearchParams();
  return (
    <AdminGuard>
      {(onExit) => <AdminDashboardScreen onExit={onExit} initialParams={{ ...params, tab: 'tournaments', activeTab: 'tournaments' }} />}
    </AdminGuard>
  );
}
