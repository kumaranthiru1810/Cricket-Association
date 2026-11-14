import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import UmpireDashboardScreen from '../../screens/umpire/UmpireDashboardScreen';

export default function UmpireRoute() {
  const params = useLocalSearchParams();
  return <UmpireDashboardScreen onExit={() => router.replace('/')} initialParams={params} />;
}

