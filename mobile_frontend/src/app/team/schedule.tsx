import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import TeamDashboardScreen from '../../screens/team/TeamDashboardScreen';

export default function TeamScheduleRoute() {
  const params = useLocalSearchParams();
  return <TeamDashboardScreen onExit={() => router.replace('/')} initialParams={{ ...params, tab: 'schedule', initialTab: 'schedule' }} />;
}

