import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import RegistrationScreen from '../../screens/auth/RegistrationScreen';

export default function RegisterIndexRoute() {
  const params = useLocalSearchParams();
  return <RegistrationScreen onExit={() => router.replace('/')} {...params} />;
}

