import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import RegistrationScreen from '../../screens/auth/RegistrationScreen';

export default function RegisterPlayerRoute() {
  const params = useLocalSearchParams();
  return <RegistrationScreen onExit={() => router.replace('/')} {...params} {...({ initialRole: 'PLAYER' } as any)} />;
}

