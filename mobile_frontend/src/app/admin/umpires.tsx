import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import AdminDashboardScreen from '../../screens/admin/AdminDashboardScreen';
import AdminGuard from './AdminGuard';

export default function AdminUmpiresRoute() {
  const params = useLocalSearchParams();
  return (
    <AdminGuard>
      {(onExit) => <AdminDashboardScreen onExit={onExit} initialParams={{ ...params, tab: 'umpires', activeTab: 'umpires' }} />}
    </AdminGuard>
  );
}
