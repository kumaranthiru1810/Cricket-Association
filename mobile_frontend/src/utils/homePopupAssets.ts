export interface HomePopupConfig {
  enabled: boolean;
  presetKey: string;
  badgeText: string;
  imageKey: string;
  customImageUrl: string;
  title: string;
  message: string;
  highlightText: string;
  buttonText: string;
  buttonDestination: string;
}

export const DEFAULT_HOME_POPUP_CONFIG: HomePopupConfig = {
  enabled: false,
  presetKey: 'match_notice',
  badgeText: 'OFFICIAL MATCH NOTICE',
  imageKey: 'stadium',
  customImageUrl: '',
  title: 'Virudhunagar Premier League 2026 — Match Day Notice!',
  message: 'Official district league fixtures are live. Check match timings, venue allocations, and live scorecards on the portal.',
  highlightText: 'Teams must report 45 minutes before toss with verified squad IDs.',
  buttonText: 'View Match Schedules →',
  buttonDestination: 'matches'
};

export const HOME_POPUP_IMAGES: Array<{ key: string; label: string; source: any }> = [
  { key: 'stadium', label: 'Stadium & Match Day', source: require('../../assets/stadium.jpg') },
  { key: 'champions', label: 'Championship Trophy', source: require('../../assets/cricket_champions.png') },
  { key: 'rules', label: 'Official Rules & Awards', source: require('../../assets/cricket_match_result_trophy.png') },
  { key: 'custom', label: 'Custom Image URL', source: null }
];

export const HOME_POPUP_PRESETS: Array<{
  key: string;
  label: string;
  subtitle: string;
  icon: string;
  values: Omit<HomePopupConfig, 'enabled'>;
}> = [
  {
    key: 'match_notice',
    label: 'Match Day & Fixtures',
    subtitle: 'Live & upcoming match alert',
    icon: '🏏',
    values: {
      presetKey: 'match_notice',
      badgeText: 'OFFICIAL MATCH NOTICE',
      imageKey: 'stadium',
      customImageUrl: '',
      title: 'Virudhunagar Premier League 2026 — Match Day Notice!',
      message: 'Official district league fixtures are live. Check match timings, venue allocations, and live scorecards on the portal.',
      highlightText: 'Teams must report 45 minutes before toss with verified squad IDs.',
      buttonText: 'View Match Schedules →',
      buttonDestination: 'matches'
    }
  },
  {
    key: 'rules_guidelines',
    label: 'Rules & Regulations',
    subtitle: 'Official CFVD & ICC laws',
    icon: '⚖️',
    values: {
      presetKey: 'rules_guidelines',
      badgeText: 'OFFICIAL RULES & CODE',
      imageKey: 'rules',
      customImageUrl: '',
      title: 'Official CFVD Tournament Rules & Code of Conduct',
      message: 'All players, coaches, and match officials must adhere to the 2026 District Championship Playing Conditions, Powerplay, and DLS guidelines.',
      highlightText: 'Strict adherence to uniform, bowling quota, and fair-play rules is mandatory.',
      buttonText: 'Read Official Rules →',
      buttonDestination: 'rules'
    }
  },
  {
    key: 'team_registration',
    label: 'Team & Player Reg',
    subtitle: 'Championship entry open',
    icon: '🏆',
    values: {
      presetKey: 'team_registration',
      badgeText: 'REGISTRATION OPEN',
      imageKey: 'champions',
      customImageUrl: '',
      title: 'District Championship 2026 — Team & Player Registration!',
      message: 'Affiliated clubs and taluk teams can now register their 15-member squads and apply for upcoming official tournaments.',
      highlightText: 'Submit verified Aadhaar & player details before the registration deadline.',
      buttonText: 'Register Team / Player →',
      buttonDestination: 'register'
    }
  }
];

export const HOME_POPUP_DESTINATIONS = [
  { key: 'matches', label: 'Live & Upcoming Matches' },
  { key: 'rules', label: 'Official Rules & Laws' },
  { key: 'tournaments', label: 'Tournaments & Standings' },
  { key: 'register', label: 'Team / Player Registration' }
];

export function resolveHomePopupImageSource(imageKey: string, customImageUrl?: string): any {
  if (imageKey === 'custom' && customImageUrl && customImageUrl.trim()) {
    return { uri: customImageUrl.trim() };
  }
  const found = HOME_POPUP_IMAGES.find(img => img.key === imageKey);
  return found?.source || HOME_POPUP_IMAGES[0].source;
}

