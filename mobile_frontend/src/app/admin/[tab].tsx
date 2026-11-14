import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import AdminDashboardScreen from '../../screens/admin/AdminDashboardScreen';
import AdminGuard from './AdminGuard';

export default function AdminDynamicSubRoute() {
  const params = useLocalSearchParams();
  const rawTab = typeof params.tab === 'string' ? params.tab : 'overview';
  const tab = rawTab.replace(/-/g, '_');

  return (
    <AdminGuard>
      {(onExit) => (
        <AdminDashboardScreen
          onExit={onExit}
          initialParams={{ ...params, tab, activeTab: tab }}
        />
      )}
    </AdminGuard>
  );
}
