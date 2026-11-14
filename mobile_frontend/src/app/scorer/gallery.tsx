import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import ScorerNavigator from '../../navigation/ScorerNavigator';

export default function ScorerGalleryRoute() {
  const params = useLocalSearchParams();
  return <ScorerNavigator onExit={() => router.replace('/')} initialParams={{ ...params, initialScreen: 'MilestoneGallery' }} />;
}

