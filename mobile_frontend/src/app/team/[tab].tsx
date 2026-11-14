import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import TeamDashboardScreen from '../../screens/team/TeamDashboardScreen';

export default function TeamDynamicSubRoute() {
  const params = useLocalSearchParams();
  const tab = typeof params.tab === 'string' ? params.tab : 'overview';

  return (
    <TeamDashboardScreen
      onExit={() => router.replace('/')}
      initialParams={{ ...params, tab, initialTab: tab }}
    />
  );
}

