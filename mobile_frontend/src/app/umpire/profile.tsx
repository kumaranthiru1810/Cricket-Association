import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import UmpireDashboardScreen from '../../screens/umpire/UmpireDashboardScreen';

export default function UmpireProfileRoute() {
  const params = useLocalSearchParams();
  return <UmpireDashboardScreen onExit={() => router.replace('/')} initialParams={{ ...params, tab: 'profile', initialTab: 'profile' }} />;
}

