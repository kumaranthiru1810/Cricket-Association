import React, { useEffect, Suspense, lazy } from 'react';
import { StyleSheet, Platform, View, ActivityIndicator, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator, { useAppNavigation, AppScreenName, checkScreenAccess } from './src/navigation/AppNavigator';
import { getCurrentUser } from './src/services/api';
import HomeScreen from './screens/Home';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import './src/utils/sweetalert';

// ─── LAZY LOADED PORTALS & SCREENS (DYNAMIC CODE SPLITTING) ──────────────────
// Public visitors download ONLY HomeScreen. Admin, Scorer, Umpire, Team, and Player
// bundles are fetched on demand when navigated.
const LoginScreen = lazy(() => import('./src/screens/auth/LoginScreen'));
const RegistrationScreen = lazy(() => import('./src/screens/auth/RegistrationScreen'));
const ScorerNavigator = lazy(() => import('./src/navigation/ScorerNavigator'));
const PlayerDashboardScreen = lazy(() => import('./src/screens/player/PlayerDashboardScreen'));
const TeamDashboardScreen = lazy(() => import('./src/screens/team/TeamDashboardScreen'));
const AdminDashboardScreen = lazy(() => import('./src/screens/admin/AdminDashboardScreen'));
const AdminLoginPage = lazy(() => import('./src/admin/pages/AdminLoginPage'));
const UmpireDashboardScreen = lazy(() => import('./src/screens/umpire/UmpireDashboardScreen'));
const ScorecardScreen = lazy(() => import('./src/screens/scorer/ScorecardScreen'));
const TeamPublicProfileScreen = lazy(() => import('./src/screens/team/TeamPublicProfileScreen'));
const PlayerPublicProfileScreen = lazy(() => import('./src/screens/player/PlayerPublicProfileScreen'));

const PortalLoadingFallback = () => (
  <View style={styles.fallbackContainer}>
    <ActivityIndicator size="large" color="#eab308" />
    <Text style={styles.fallbackText}>Loading Portal...</Text>
  </View>
);

function MainAppShell() {
  const { currentScreen, navigate, goBack, params } = useAppNavigation();

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleMessage = (event: MessageEvent) => {
        if (!event.data) return;

        if (
          event.data.type === 'OPEN_ADMIN_LOGIN' ||
          event.data.route === '/admin/login' ||
          event.data.route === '/admin-login'
        ) {
          navigate('AdminLogin');
        } else if (event.data.type === 'OPEN_SCORECARD' || event.data.route?.includes('scorecard')) {
          navigate('Scorecard', event.data.params);
        } else if (event.data.type === 'OPEN_SCORER_MODULE' || event.data.route === '/scorer') {
          navigate('Scorer');
        } else if (
          event.data.type === 'OPEN_UMPIRE_DASHBOARD' ||
          event.data.type === 'OPEN_UMPIRE_MODULE' ||
          event.data.route === '/umpire'
        ) {
          navigate('Umpire', event.data.params);
        } else if (
          event.data.type === 'OPEN_PLAYER_DETAIL' ||
          event.data.type === 'OPEN_PLAYER_PROFILE' ||
          event.data.route?.includes('player-detail') ||
          event.data.route?.includes('player-profile')
        ) {
          navigate('PlayerDetail', event.data.params);
        } else if (
          event.data.type === 'OPEN_PLAYER_DASHBOARD' ||
          event.data.type === 'OPEN_PLAYER_MODULE' ||
          event.data.route === '/player'
        ) {
          navigate('Player', event.data.params);
        } else if (
          event.data.type === 'OPEN_TEAM_DETAIL' ||
          event.data.type === 'OPEN_TEAM_PROFILE' ||
          event.data.route?.includes('team-detail') ||
          event.data.route?.includes('team-profile')
        ) {
          navigate('TeamDetail', event.data.params);
        } else if (
          event.data.type === 'OPEN_COACH_DASHBOARD' ||
          event.data.type === 'OPEN_TEAM_DASHBOARD' ||
          event.data.type === 'OPEN_TEAM_MODULE' ||
          event.data.route === '/team' ||
          event.data.route === '/coach'
        ) {
          navigate('Team', event.data.params);
        } else if (
          event.data.type === 'OPEN_ADMIN_DASHBOARD' ||
          event.data.type === 'OPEN_ADMIN_MODULE' ||
          event.data.route === '/admin'
        ) {
          navigate('Admin', event.data.params);
        } else if (
          event.data.type === 'OPEN_LOGIN_SCREEN' ||
          event.data.route === '/login' ||
          (event.data.route &&
            event.data.route.includes('login') &&
            !event.data.route.includes('admin') &&
            !event.data.route.includes('scorer') &&
            !event.data.route.includes('team'))
        ) {
          navigate('Login', event.data.initialRole ? { initialRole: event.data.initialRole } : undefined);
        } else if (
          event.data.type === 'OPEN_REGISTRATION_SCREEN' ||
          event.data.route === '/player-registration' ||
          event.data.route === '/register'
        ) {
          const role = event.data.initialRole || (event.data.route === '/player-registration' ? 'PLAYER' : undefined);
          navigate('Registration', role ? { initialRole: role } : undefined);
        } else if (
          event.data.type === 'OPEN_HOME_SCREEN' ||
          event.data.type === 'GO_HOME' ||
          event.data.route === '/' ||
          event.data.route === '/home' ||
          event.data.route === ''
        ) {
          navigate('Home');
        } else if (event.data.type === 'GO_BACK' || event.data.type === 'NAVIGATE_BACK') {
          goBack();
        }

        // Handle navigation messages to update the top-level browser URL
        if (event.data && event.data.type === 'NAVIGATE' && event.data.route) {
          try {
            const route: string = event.data.route;
            if (route === '/' || route === '/home' || route === '') {
              navigate('Home');
            } else if (route === '/admin/login' || route === '/admin-login') {
              navigate('AdminLogin');
            } else if (route === '/scorer' || route === '/scorer-login') {
              navigate('Scorer');
            } else if (route === '/umpire') {
              navigate('Umpire');
            } else if (route === '/player') {
              navigate('Player');
            } else if (route === '/team' || route === '/coach') {
              navigate('Team');
            } else if (route === '/admin') {
              navigate('Admin');
            } else {
              const [path, queryString] = route.split('?');
              const fullUrl = window.location.origin + path + (queryString ? '?' + queryString : '');
              window.history.pushState({ appScreen: route }, '', fullUrl);
            }
          } catch (e) {}
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, [navigate, goBack]);

  if (currentScreen === 'AdminLogin') {
    return (
      <Suspense fallback={<PortalLoadingFallback />}>
        <AdminLoginPage
          onLoginSuccess={() => navigate('Admin')}
          onBackToHome={() => navigate('Home')}
        />
      </Suspense>
    );
  }

  if (currentScreen === 'Login') {
    return (
      <Suspense fallback={<PortalLoadingFallback />}>
        <LoginScreen onExit={() => navigate('Home')} />
      </Suspense>
    );
  }

  if (currentScreen === 'Registration') {
    return (
      <Suspense fallback={<PortalLoadingFallback />}>
        <RegistrationScreen onExit={() => navigate('Home')} />
      </Suspense>
    );
  }

  if (currentScreen === 'Scorecard') {
    return (
      <Suspense fallback={<PortalLoadingFallback />}>
        <ScorecardScreen onExit={() => navigate('Home')} initialMatchId={params?.matchId} initialParams={params} />
      </Suspense>
    );
  }

  if (currentScreen === 'TeamDetail') {
    return (
      <Suspense fallback={<PortalLoadingFallback />}>
        <TeamPublicProfileScreen
          onExit={() => navigate('Home')}
          initialTeamId={params?.teamId || params?.id}
          initialTeamName={params?.teamName || params?.name}
        />
      </Suspense>
    );
  }

  if (currentScreen === 'PlayerDetail') {
    return (
      <Suspense fallback={<PortalLoadingFallback />}>
        <PlayerPublicProfileScreen
          onExit={() => navigate('Home')}
          initialPlayerId={params?.playerId || params?.id}
          initialPlayerName={params?.playerName || params?.name}
        />
      </Suspense>
    );
  }

  const currentUser = getCurrentUser();

  if (currentScreen === 'Scorer') {
    const access = checkScreenAccess('Scorer', currentUser);
    if (!access.allowed) {
      navigate('Home');
      return null;
    }
    return (
      <Suspense fallback={<PortalLoadingFallback />}>
        <ScorerNavigator onExit={(target?: any) => navigate(target || 'Home')} initialParams={params} />
      </Suspense>
    );
  }

  if (currentScreen === 'Umpire') {
    const access = checkScreenAccess('Umpire', currentUser);
    if (!access.allowed) {
      navigate('Home');
      return null;
    }
    return (
      <Suspense fallback={<PortalLoadingFallback />}>
        <UmpireDashboardScreen onExit={() => navigate('Home')} initialParams={params} />
      </Suspense>
    );
  }

  if (currentScreen === 'Player') {
    const access = checkScreenAccess('Player', currentUser);
    if (!access.allowed) {
      navigate('Home');
      return null;
    }
    return (
      <Suspense fallback={<PortalLoadingFallback />}>
        <PlayerDashboardScreen onExit={() => navigate('Home')} initialParams={params} />
      </Suspense>
    );
  }

  if (currentScreen === 'Team' || currentScreen === 'Coach') {
    const access = checkScreenAccess('Team', currentUser);
    if (!access.allowed) {
      navigate('Home');
      return null;
    }
    return (
      <Suspense fallback={<PortalLoadingFallback />}>
        <TeamDashboardScreen onExit={() => navigate('Home')} initialParams={params} />
      </Suspense>
    );
  }

  if (currentScreen === 'Admin') {
    const access = checkScreenAccess('Admin', currentUser);
    if (!access.allowed) {
      return (
        <Suspense fallback={<PortalLoadingFallback />}>
          <AdminLoginPage
            onLoginSuccess={() => navigate('Admin')}
            onBackToHome={() => navigate('Home')}
          />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={<PortalLoadingFallback />}>
        <AdminDashboardScreen onExit={() => navigate('AdminLogin')} initialParams={params} />
      </Suspense>
    );
  }

  // Home Screen rendered as pure React Native component (no iframe, no bundled.html)
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <HomeScreen />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider style={{ flex: 1, width: '100%', minHeight: '100%' }}>
      <ErrorBoundary fallbackTitle="Cricket Federation Portal">
        <AppNavigator>
          <MainAppShell />
        </AppNavigator>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020612'
  },
  fallbackContainer: {
    flex: 1,
    backgroundColor: '#020612',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100dvh' as any,
    gap: 12
  },
  fallbackText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600'
  }
});

