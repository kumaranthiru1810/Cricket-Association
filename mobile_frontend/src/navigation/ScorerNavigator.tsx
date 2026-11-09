import React, { useState, useEffect } from 'react';
import { StyleSheet, SafeAreaView, Platform, Alert } from 'react-native';
import { getCurrentUser } from '../services/api';

import ScorerAuthScreen from '../screens/scorer/ScorerAuthScreen';
import ScorerDashboardScreen from '../screens/scorer/ScorerDashboardScreen';
import MatchSetupScreen from '../screens/scorer/MatchSetupScreen';
import LiveScoringScreen from '../screens/scorer/LiveScoringScreen';
import ScorecardScreen from '../screens/scorer/ScorecardScreen';
import SharedBackground from '../components/scorer/SharedBackground';
import {
  ScreenName,
  ScorerNavigationContext,
  useScorerNavigation,
  ScorerNavigationContextType
} from './ScorerNavigationContext';

import ErrorBoundary from '../components/common/ErrorBoundary';

export { ScreenName, ScorerNavigationContext, useScorerNavigation, ScorerNavigationContextType };

interface Props {
  onExit: (targetScreen?: any) => void;
  initialParams?: any;
}

export default function ScorerNavigator({ onExit, initialParams }: Props) {
  const resolveInitialRoute = (): { screen: ScreenName; initialParams?: any } => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        const qScreen = url.searchParams.get('scorerScreen');
        const qMatchId = url.searchParams.get('matchId');
        if (qScreen && ['Dashboard', 'MatchSetup', 'LiveScoring', 'Scorecard'].includes(qScreen)) {
          const finalMatchId = qMatchId || initialParams?.matchId;
          return { screen: qScreen as ScreenName, initialParams: { ...(initialParams || {}), ...(finalMatchId ? { matchId: finalMatchId } : {}) } };
        }

        // Check localStorage persistence across browser refresh
        const savedScreen = localStorage.getItem('cfvd_last_scorer_screen');
        const savedMatchId = localStorage.getItem('cfvd_last_scorer_match_id');
        if (savedScreen && ['Dashboard', 'MatchSetup', 'LiveScoring', 'Scorecard'].includes(savedScreen)) {
          const finalMatchId = qMatchId || savedMatchId || initialParams?.matchId;
          return {
            screen: savedScreen as ScreenName,
            initialParams: { ...(initialParams || {}), ...(finalMatchId ? { matchId: finalMatchId } : {}) }
          };
        }
      } catch (_e) {}
    }
    return { screen: initialParams?.initialScreen || 'Dashboard', initialParams };
  };

  const initialRoute = resolveInitialRoute();
  const [currentScreen, setCurrentScreen] = useState<ScreenName>(initialRoute.screen);
  const [params, setParams] = useState<any>(initialRoute.initialParams || null);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        localStorage.setItem('cfvd_last_scorer_screen', currentScreen);
        const mId = params?.matchId || (currentScreen !== 'Dashboard' ? localStorage.getItem('cfvd_last_scorer_match_id') : null);
        if (mId && currentScreen !== 'Dashboard') {
          localStorage.setItem('cfvd_last_scorer_match_id', mId);
        } else if (currentScreen === 'Dashboard') {
          localStorage.removeItem('cfvd_last_scorer_match_id');
        }
        const search = `?scorerScreen=${currentScreen}${mId && currentScreen !== 'Dashboard' ? `&matchId=${mId}` : ''}`;
        const newUrl = window.location.origin + '/scorer' + search;
        if (window.location.pathname + window.location.search !== '/scorer' + search) {
          window.history.replaceState({ appScreen: 'Scorer', scorerScreen: currentScreen, matchId: mId }, '', newUrl);
        }
      } catch (e) {}
    }
  }, [currentScreen, params]);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      if (onExit) onExit('Home');
      return;
    }
    const role = (user.role || '').toUpperCase();
    if (role !== 'SCORER' && role !== 'ADMIN' && role !== 'UMPIRE') {
      if (onExit) onExit('Home');
      return;
    }
  }, [onExit]);

  const navigate = (screen: ScreenName, screenParams?: any) => {
    setCurrentScreen(screen);
    const combinedParams = { ...(params || {}), ...(screenParams || {}) };
    setParams(combinedParams);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        localStorage.setItem('cfvd_last_scorer_screen', screen);
        if (combinedParams?.matchId && screen !== 'Dashboard') {
          localStorage.setItem('cfvd_last_scorer_match_id', combinedParams.matchId);
        } else if (screen === 'Dashboard') {
          localStorage.removeItem('cfvd_last_scorer_match_id');
        }

        const mId = screen !== 'Dashboard' ? (combinedParams?.matchId || localStorage.getItem('cfvd_last_scorer_match_id')) : null;
        const search = `?scorerScreen=${screen}${mId ? `&matchId=${mId}` : ''}`;
        const newUrl = window.location.origin + '/scorer' + search;
        window.history.replaceState({ appScreen: 'Scorer', scorerScreen: screen, matchId: mId }, '', newUrl);
      } catch (e) {}
    }
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'Auth': return <ScorerAuthScreen />;
      case 'Dashboard': return <ScorerDashboardScreen />;
      case 'MatchSetup': return <MatchSetupScreen />;
      case 'LiveScoring': return <LiveScoringScreen />;
      case 'Scorecard':
        return (
          <ScorecardScreen
            initialMatchId={params?.matchId}
            initialParams={params}
            onExit={() => {
              if (params?.returnTo === 'LiveScoring' && params?.matchId && params?.status !== 'COMPLETED' && params?.status !== 'Completed') {
                navigate('LiveScoring', { matchId: params.matchId });
              } else {
                navigate('Dashboard');
              }
            }}
          />
        );
      default: return <ScorerAuthScreen />;
    }
  };

  return (
    <ScorerNavigationContext.Provider value={{ currentScreen, navigate, params, onExit }}>
      <SharedBackground>
        <SafeAreaView style={styles.container}>
          <ErrorBoundary
            fallbackTitle="Scorer Console Error"
            onReset={() => navigate('Dashboard')}
          >
            {renderScreen()}
          </ErrorBoundary>
        </SafeAreaView>
      </SharedBackground>
    </ScorerNavigationContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent'
  }
});
