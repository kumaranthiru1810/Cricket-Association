import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import TeamDashboardScreen from '../../screens/team/TeamDashboardScreen';

export default function TeamMatchesRoute() {
  const params = useLocalSearchParams();
  return <TeamDashboardScreen onExit={() => router.replace('/')} initialParams={{ ...params, tab: 'matches', initialTab: 'matches' }} />;
}

