import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import ScorerNavigator from '../../navigation/ScorerNavigator';

export default function ScorerRoute() {
  const params = useLocalSearchParams();
  return <ScorerNavigator onExit={() => router.replace('/')} initialParams={params} />;
}

