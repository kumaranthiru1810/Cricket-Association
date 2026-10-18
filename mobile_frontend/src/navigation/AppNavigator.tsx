import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform, Alert } from 'react-native';
import { getCurrentUser, getAuthToken } from '../services/api';

export type AppScreenName =
  | 'Home'
  | 'Login'
  | 'AdminLogin'
  | 'Registration'
  | 'Scorer'
  | 'Umpire'
  | 'Admin'
  | 'Player'
  | 'Coach'
  | 'Team'
  | 'Content';

export interface ScreenAccessResult {
  allowed: boolean;
  reason?: 'UNAUTHENTICATED' | 'ROLE_MISMATCH';
  message?: string;
  loginRole?: 'PLAYER' | 'TEAM' | 'SCORER' | 'ADMIN' | 'UMPIRE';
  portalName?: string;
}

export function getUserDashboardScreen(user: any): AppScreenName {
  if (!user) return 'Home';
  const role = (user.role || '').toUpperCase();
  if (role === 'ADMIN') return 'Admin';
  if (role === 'SCORER') return 'Scorer';
  if (role === 'UMPIRE') return 'Umpire';
  if (role === 'PLAYER') return 'Player';
  if (role === 'COACH' || role === 'TEAM') return 'Team';
  return 'Home';
}

export function checkScreenAccess(
  screenName: AppScreenName,
  user: any
): ScreenAccessResult {
  const normScreen: AppScreenName = screenName === 'Coach' ? 'Team' : screenName;

  const protectionMap: Record<
    string,
    { roles: string[]; portalName: string; loginRole: 'PLAYER' | 'TEAM' | 'SCORER' | 'ADMIN' | 'UMPIRE' }
  > = {
    Player: {
      roles: ['PLAYER', 'ADMIN'],
      portalName: 'Player Portal',
      loginRole: 'PLAYER'
    },
    Scorer: {
      roles: ['SCORER', 'ADMIN'],
      portalName: 'Official Match Console',
      loginRole: 'SCORER'
    },
    Umpire: {
      roles: ['UMPIRE', 'ADMIN'],
      portalName: 'Official Umpire Console',
      loginRole: 'UMPIRE'
    },
    Team: {
      roles: ['TEAM', 'COACH', 'ADMIN'],
      portalName: 'Team & Coach Portal',
      loginRole: 'TEAM'
    },
    Admin: {
      roles: ['ADMIN'],
      portalName: 'Administrator Portal',
      loginRole: 'ADMIN'
    },
    Content: {
      roles: ['CONTENT', 'ADMIN'],
      portalName: 'Content Staff Portal',
      loginRole: 'ADMIN'
    }
  };

  const rule = protectionMap[normScreen];
  if (!rule) {
    // Public screen ('Home', 'Login', 'AdminLogin', 'Registration')
    return { allowed: true };
  }

  // 1. Check if authenticated
  if (!user || !user.role) {
    return {
      allowed: false,
      reason: 'UNAUTHENTICATED',
      portalName: rule.portalName,
      loginRole: rule.loginRole,
      message: `Please log in first to access the ${rule.portalName}.`
    };
  }

  // 2. Check role authorization
  const userRole = (user.role || '').toUpperCase();
  const isAllowed = rule.roles.includes(userRole);

  if (!isAllowed) {
    const roleLabel =
      userRole === 'COACH' ? 'Team Coach' : userRole === 'PLAYER' ? 'Player' : userRole;
    return {
      allowed: false,
      reason: 'ROLE_MISMATCH',
      portalName: rule.portalName,
      loginRole: rule.loginRole,
      message: `Access Denied: Your account is registered as "${roleLabel}". You do not have permission to access the ${rule.portalName}.`
    };
  }

  return { allowed: true };
}

function showAccessAlert(message: string, title: string = 'Access Restricted') {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(message);
  } else {
    Alert.alert(title, message);
  }
}

interface AppNavigationContextType {
  currentScreen: AppScreenName;
  navigate: (screen: AppScreenName, params?: any) => void;
  params: any;
  goBack: () => void;
}

const AppNavigationContext = createContext<AppNavigationContextType>({
  currentScreen: 'Home',
  navigate: () => {},
  params: null,
  goBack: () => {}
});

export const useAppNavigation = () => useContext(AppNavigationContext);

interface AppNavigatorProps {
  children?: React.ReactNode;
  initialScreen?: AppScreenName;
  renderScreenContent?: (
    currentScreen: AppScreenName,
    navigate: (screen: AppScreenName, params?: any) => void,
    params: any
  ) => React.ReactNode;
}

export default function AppNavigator({
  children,
  initialScreen = 'Home',
  renderScreenContent
}: AppNavigatorProps) {
  // Resolve initial screen from URL on Web while enforcing authentication & role protection
  const resolveInitialRoute = (): { screen: AppScreenName; initialParams?: any } => {
    let requested: AppScreenName = initialScreen;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const p = (window.location.pathname + window.location.search + window.location.hash).toLowerCase();
      if (p.includes('admin/login') || p.includes('admin-login')) requested = 'AdminLogin';
      else if (p.includes('umpire')) requested = 'Umpire';
      else if (p.includes('scorer')) requested = 'Scorer';
      else if (p.includes('player')) requested = 'Player';
      else if (p.includes('team') || p.includes('coach')) requested = 'Team';
      else if (p.includes('admin')) requested = 'Admin';
      else if (p.includes('login')) requested = 'Login';
      else if (p.includes('register')) requested = 'Registration';
    }

    const user = getCurrentUser();
    const access = checkScreenAccess(requested, user);

    if (!access.allowed) {
      if (access.reason === 'UNAUTHENTICATED') {
        const isTargetAdmin = requested === 'Admin';
        const targetLoginScreen: AppScreenName = isTargetAdmin ? 'AdminLogin' : 'Login';
        const targetLoginRoute = isTargetAdmin ? '/admin/login' : '/login';

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          try {
            window.history.replaceState({ appScreen: targetLoginScreen }, '', targetLoginRoute);
          } catch (e) {}
        }
        showAccessAlert(access.message || 'Please log in first to access this page.');
        return {
          screen: targetLoginScreen,
          initialParams: { initialRole: access.loginRole, attemptedScreen: requested }
        };
      } else {
        const fallback = getUserDashboardScreen(user);
        const fallbackRoute =
          fallback === 'Player' ? '/player' :
          fallback === 'Team' ? '/team' :
          fallback === 'Scorer' ? '/scorer' :
          fallback === 'Umpire' ? '/umpire' :
          fallback === 'Admin' ? '/admin' : '/';

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          try {
            window.history.replaceState({ appScreen: fallback }, '', fallbackRoute);
          } catch (e) {}
        }
        showAccessAlert(access.message || 'You do not have permission to access this page.');
        return { screen: fallback };
      }
    }

    return { screen: requested };
  };

  const [initialResolved] = useState(resolveInitialRoute);
  const [screenHistory, setScreenHistory] = useState<AppScreenName[]>([initialResolved.screen]);
  const [params, setParams] = useState<any>(initialResolved.initialParams || null);

  const currentScreen = screenHistory[screenHistory.length - 1] || 'Home';

  const updateBrowserUrl = (targetScreen: AppScreenName) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        let route = '/';
        if (targetScreen === 'AdminLogin') route = '/admin/login';
        else if (targetScreen === 'Login') route = '/login';
        else if (targetScreen === 'Registration') route = '/register';
        else if (targetScreen === 'Scorer') route = '/scorer';
        else if (targetScreen === 'Umpire') route = '/umpire';
        else if (targetScreen === 'Admin') route = '/admin';
        else if (targetScreen === 'Player') route = '/player';
        else if (targetScreen === 'Team' || targetScreen === 'Coach') route = '/team';
        else if (targetScreen === 'Content') route = '/admin';
        else if (targetScreen === 'Home') route = '/';

        if (window.location.pathname !== route) {
          window.history.pushState({ appScreen: targetScreen }, '', route);
        }
      } catch (e) {}
    }
  };

  const navigate = useCallback((screen: AppScreenName, screenParams?: any) => {
    const targetScreen: AppScreenName = screen === 'Coach' ? 'Team' : screen;
    const user = getCurrentUser();
    const access = checkScreenAccess(targetScreen, user);

    if (!access.allowed) {
      showAccessAlert(access.message || 'Access Denied.');

      if (access.reason === 'UNAUTHENTICATED') {
        const isTargetAdmin = targetScreen === 'Admin';
        const targetLoginScreen: AppScreenName = isTargetAdmin ? 'AdminLogin' : 'Login';
        // Redirect to Login (or AdminLogin if accessing Admin)
        setParams({ initialRole: access.loginRole, attemptedScreen: targetScreen, ...screenParams });
        setScreenHistory((prev) => [...prev.filter((s) => s !== targetLoginScreen), targetLoginScreen]);
        updateBrowserUrl(targetLoginScreen);
        return;
      } else {
        // Role mismatch: do not allow entering forbidden screen!
        const userPortal = getUserDashboardScreen(user);
        updateBrowserUrl(userPortal);
        if (currentScreen !== userPortal && userPortal !== 'Home') {
          setParams(null);
          setScreenHistory((prev) => [...prev.filter((s) => s !== userPortal), userPortal]);
        }
        return;
      }
    }

    setParams(screenParams || null);

    if (targetScreen === 'Home') {
      setScreenHistory(['Home']);
    } else {
      setScreenHistory((prev) => [...prev.filter((s) => s !== targetScreen), targetScreen]);
    }

    updateBrowserUrl(targetScreen);
  }, [currentScreen]);

  const goBack = useCallback(() => {
    setScreenHistory((prev) => {
      const next: AppScreenName[] = prev.length <= 1 ? ['Home'] : prev.slice(0, prev.length - 1);
      const targetScreen: AppScreenName = next[next.length - 1] || 'Home';
      updateBrowserUrl(targetScreen);
      return next;
    });
  }, []);

  // Sync browser back/forward buttons on Web with authentication guards
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handlePopState = (e: PopStateEvent) => {
        let requested: AppScreenName = 'Home';
        if (e.state && e.state.appScreen) {
          requested = e.state.appScreen;
        } else {
          const path = window.location.pathname.toLowerCase();
          if (path.includes('admin/login') || path.includes('admin-login')) requested = 'AdminLogin';
          else if (path.includes('admin')) requested = 'Admin';
          else if (path.includes('umpire')) requested = 'Umpire';
          else if (path.includes('scorer')) requested = 'Scorer';
          else if (path.includes('player')) requested = 'Player';
          else if (path.includes('team') || path.includes('coach')) requested = 'Team';
          else if (path.includes('login')) requested = 'Login';
          else if (path.includes('register')) requested = 'Registration';
          else requested = 'Home';
        }

        const user = getCurrentUser();
        const access = checkScreenAccess(requested, user);

        if (!access.allowed) {
          showAccessAlert(access.message || 'Access Denied.');
          if (access.reason === 'UNAUTHENTICATED') {
            const isTargetAdmin = requested === 'Admin';
            const targetLoginScreen: AppScreenName = isTargetAdmin ? 'AdminLogin' : 'Login';
            setParams({ initialRole: access.loginRole, attemptedScreen: requested });
            setScreenHistory([targetLoginScreen]);
            updateBrowserUrl(targetLoginScreen);
          } else {
            const fallback = getUserDashboardScreen(user);
            setScreenHistory([fallback]);
            updateBrowserUrl(fallback);
          }
          return;
        }

        setScreenHistory((prev) => [...prev, requested]);
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, []);

  return (
    <AppNavigationContext.Provider value={{ currentScreen, navigate, params, goBack }}>
      <View style={styles.container}>
        {renderScreenContent ? renderScreenContent(currentScreen, navigate, params) : children}
      </View>
    </AppNavigationContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#020612'
  }
});
