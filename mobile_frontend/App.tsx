import React, { useEffect } from 'react';
import { StyleSheet, StatusBar, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AppNavigator, { useAppNavigation, AppScreenName, checkScreenAccess } from './src/navigation/AppNavigator';
import { getCurrentUser } from './src/services/api';
import HomeScreen from './screens/Home';
import LoginScreen from './src/screens/auth/LoginScreen';
import RegistrationScreen from './src/screens/auth/RegistrationScreen';
import ScorerNavigator from './src/navigation/ScorerNavigator';
import PlayerDashboardScreen from './src/screens/player/PlayerDashboardScreen';
import TeamDashboardScreen from './src/screens/team/TeamDashboardScreen';
import AdminDashboardScreen from './src/screens/admin/AdminDashboardScreen';
import AdminLoginPage from './src/admin/pages/AdminLoginPage';
import UmpireDashboardScreen from './src/screens/umpire/UmpireDashboardScreen';
import ScorecardScreen from './src/screens/scorer/ScorecardScreen';
import './src/utils/sweetalert';

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
          event.data.type === 'OPEN_PLAYER_DASHBOARD' ||
          event.data.type === 'OPEN_PLAYER_MODULE' ||
          event.data.route === '/player'
        ) {
          navigate('Player', event.data.params);
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
      <AdminLoginPage
        onLoginSuccess={() => navigate('Admin')}
        onBackToHome={() => navigate('Home')}
      />
    );
  }

  if (currentScreen === 'Login') {
    return <LoginScreen onExit={() => navigate('Home')} />;
  }

  if (currentScreen === 'Registration') {
    return <RegistrationScreen onExit={() => navigate('Home')} />;
  }

  if (currentScreen === 'Scorecard') {
    return <ScorecardScreen onExit={() => navigate('Home')} initialMatchId={params?.matchId} />;
  }

  const currentUser = getCurrentUser();

  if (currentScreen === 'Scorer') {
    const access = checkScreenAccess('Scorer', currentUser);
    if (!access.allowed) {
      return <LoginScreen onExit={() => navigate('Home')} />;
    }
    return <ScorerNavigator onExit={(target?: any) => navigate(target || 'Home')} initialParams={params} />;
  }

  if (currentScreen === 'Umpire') {
    const access = checkScreenAccess('Umpire', currentUser);
    if (!access.allowed) {
      return <LoginScreen />;
    }
    return <UmpireDashboardScreen onExit={() => navigate('Home')} initialParams={params} />;
  }

  if (currentScreen === 'Player') {
    const access = checkScreenAccess('Player', currentUser);
    if (!access.allowed) {
      return <LoginScreen />;
    }
    return <PlayerDashboardScreen onExit={() => navigate('Home')} initialParams={params} />;
  }

  if (currentScreen === 'Team' || currentScreen === 'Coach') {
    const access = checkScreenAccess('Team', currentUser);
    if (!access.allowed) {
      return <LoginScreen />;
    }
    return <TeamDashboardScreen onExit={() => navigate('Home')} initialParams={params} />;
  }

  if (currentScreen === 'Admin') {
    const access = checkScreenAccess('Admin', currentUser);
    if (!access.allowed) {
      return (
        <AdminLoginPage
          onLoginSuccess={() => navigate('Admin')}
          onBackToHome={() => navigate('Home')}
        />
      );
    }
    return <AdminDashboardScreen onExit={() => navigate('AdminLogin')} initialParams={params} />;
  }

  // Home Screen rendered as pure React Native component (no iframe, no bundled.html)
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#020612" />
      <HomeScreen />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <AppNavigator>
        <MainAppShell />
      </AppNavigator>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020612'
  }
});

