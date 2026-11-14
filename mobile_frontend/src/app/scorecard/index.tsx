import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import ScorecardScreen from '../../screens/scorer/ScorecardScreen';

export default function ScorecardRoute() {
  const params = useLocalSearchParams();
  return <ScorecardScreen onExit={() => router.replace('/')} initialParams={params} />;
}

