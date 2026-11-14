import React from 'react';
import { router } from 'expo-router';
import LoginScreen from '../screens/auth/LoginScreen';

export default function LoginRoute() {
  return <LoginScreen onExit={() => router.replace('/')} />;
}

