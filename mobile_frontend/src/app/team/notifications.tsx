import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import TeamDashboardScreen from '../../screens/team/TeamDashboardScreen';

export default function TeamNotificationsRoute() {
  const params = useLocalSearchParams();
  return <TeamDashboardScreen onExit={() => router.replace('/')} initialParams={{ ...params, tab: 'notifications', initialTab: 'notifications' }} />;
}

