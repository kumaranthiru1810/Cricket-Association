import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import AdminDashboardScreen from '../../screens/admin/AdminDashboardScreen';
import AdminGuard from './AdminGuard';

export default function AdminScorersRoute() {
  const params = useLocalSearchParams();
  return (
    <AdminGuard>
      {(onExit) => <AdminDashboardScreen onExit={onExit} initialParams={{ ...params, tab: 'scorers', activeTab: 'scorers' }} />}
    </AdminGuard>
  );
}
