import React, { createContext, useContext } from 'react';

export type ScreenName = 'Auth' | 'Dashboard' | 'MatchSetup' | 'LiveScoring' | 'Scorecard' | 'MilestoneGallery';

export interface ScorerNavigationContextType {
  currentScreen: ScreenName;
  navigate: (screen: ScreenName, params?: any) => void;
  onExit: (targetScreen?: string) => void;
}

export const ScorerNavigationContext = createContext<ScorerNavigationContextType>({
  currentScreen: 'Auth',
  navigate: () => {},
  params: null,
  onExit: () => {}
});

export const useScorerNavigation = () => useContext(ScorerNavigationContext);
