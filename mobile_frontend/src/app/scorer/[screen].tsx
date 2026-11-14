import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import ScorerNavigator from '../../navigation/ScorerNavigator';

export default function ScorerDynamicScreenRoute() {
  const params = useLocalSearchParams();
  const screenParam = typeof params.screen === 'string' ? params.screen.toLowerCase() : 'dashboard';

  let initialScreen: 'Dashboard' | 'MatchSetup' | 'LiveScoring' | 'Scorecard' | 'MilestoneGallery' = 'Dashboard';
  if (screenParam === 'setup' || screenParam === 'matchsetup') initialScreen = 'MatchSetup';
  else if (screenParam === 'live' || screenParam === 'livescoring') initialScreen = 'LiveScoring';
  else if (screenParam === 'scorecard') initialScreen = 'Scorecard';
  else if (screenParam === 'gallery' || screenParam === 'milestonegallery') initialScreen = 'MilestoneGallery';

  return (
    <ScorerNavigator
      onExit={() => router.replace('/')}
      initialParams={{ ...params, initialScreen }}
    />
  );
}

