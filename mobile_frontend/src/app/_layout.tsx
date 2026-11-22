import React, { useState } from 'react';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ErrorBoundary from '../components/common/ErrorBoundary';
import VideoPreloader from '../components/common/VideoPreloader';
import '../utils/sweetalert';

export default function RootLayout() {
  const [showPreloader, setShowPreloader] = useState<boolean>(() => {
    if (Platform.OS === 'web') {
      // index.html executes the initial web preloader natively before JS bundle hydration
      return false;
    }
    return true;
  });

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: '#020612', width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
      <ErrorBoundary>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            contentStyle: { backgroundColor: '#020612', width: '100%', maxWidth: '100%', overflow: 'hidden' }
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
        {showPreloader && (
          <VideoPreloader onComplete={() => setShowPreloader(false)} />
        )}
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
