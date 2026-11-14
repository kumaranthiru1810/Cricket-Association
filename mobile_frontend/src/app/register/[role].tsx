import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import RegistrationScreen from '../../screens/auth/RegistrationScreen';

export default function RegisterRoleSubRoute() {
  const params = useLocalSearchParams();
  const rawRole = typeof params.role === 'string' ? params.role.toUpperCase() : 'TEAM';
  const initialRole = rawRole === 'COACH' ? 'TEAM' : rawRole;

  return (
    <RegistrationScreen
      onExit={() => router.replace('/')}
      {...params}
      {...({ initialRole } as any)}
    />
  );
}

