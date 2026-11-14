import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import RegistrationScreen from '../../screens/auth/RegistrationScreen';

export default function RegisterScorerRoute() {
  const params = useLocalSearchParams();
  return <RegistrationScreen onExit={() => router.replace('/')} {...params} {...({ initialRole: 'SCORER' } as any)} />;
}

