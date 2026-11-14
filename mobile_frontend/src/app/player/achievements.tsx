import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import PlayerDashboardScreen from '../../screens/player/PlayerDashboardScreen';

export default function PlayerAchievementsRoute() {
  const params = useLocalSearchParams();
  return <PlayerDashboardScreen onExit={() => router.replace('/')} initialParams={{ ...params, tab: 'achievements', initialTab: 'achievements' }} />;
}

