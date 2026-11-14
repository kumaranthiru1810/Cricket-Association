import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import PlayerDashboardScreen from '../../screens/player/PlayerDashboardScreen';

export default function PlayerDynamicSubRoute() {
  const params = useLocalSearchParams();
  const tab = typeof params.tab === 'string' ? params.tab : 'overview';

  return (
    <PlayerDashboardScreen
      onExit={() => router.replace('/')}
      initialParams={{ ...params, tab, initialTab: tab }}
    />
  );
}

