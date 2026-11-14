import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import UmpireDashboardScreen from '../../screens/umpire/UmpireDashboardScreen';

export default function UmpireDynamicSubRoute() {
  const params = useLocalSearchParams();
  const tab = typeof params.tab === 'string' ? params.tab : 'overview';

  return (
    <UmpireDashboardScreen
      onExit={() => router.replace('/')}
      initialParams={{ ...params, tab, initialTab: tab }}
    />
  );
}

