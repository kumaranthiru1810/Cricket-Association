import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import ScorecardScreen from '../../screens/scorer/ScorecardScreen';

export default function ScorecardMatchRoute() {
  const params = useLocalSearchParams();
  const matchId = typeof params.matchId === 'string' ? params.matchId : undefined;

  return (
    <ScorecardScreen
      onExit={() => router.replace('/')}
      initialParams={{ ...params, matchId }}
    />
  );
}

