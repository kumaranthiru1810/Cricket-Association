import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ErrorBoundary from '../components/common/ErrorBoundary';
import '../utils/sweetalert';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <StatusBar barStyle="light-content" backgroundColor="#020612" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            contentStyle: { backgroundColor: '#020612' }
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="admin-login" />
          <Stack.Screen name="admin/index" />
          <Stack.Screen name="team/index" />
          <Stack.Screen name="player/index" />
          <Stack.Screen name="umpire/index" />
          <Stack.Screen name="scorer/index" />
          <Stack.Screen name="scorecard/index" />
        </Stack>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

