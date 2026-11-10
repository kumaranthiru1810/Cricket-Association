/**
 * cricketRulesEngine.ts
 * CFVD Comprehensive Shared Cricket Rules Engine
 * 
 * Compliant with official MCC Laws of Cricket (2022 Code) & ICC Standard Playing Conditions.
 * Pure TypeScript functions with zero UI dependencies for cross-platform reliability.
 */

export type MatchFormat = 'T10' | 'T20' | 'ODI' | 'TEST' | 'MULTI_DAY' | 'SUPER_OVER';

export type ExtraType = 'NONE' | 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE' | 'PENALTY';

export type WicketType =
  | 'BOWLED'
  | 'CAUGHT'
  | 'CAUGHT_BEHIND'
  | 'CAUGHT_AND_BOWLED'
  | 'LBW'
  | 'RUN_OUT'
  | 'STUMPED'
  | 'HIT_WICKET'
  | 'OBSTRUCTING_THE_FIELD'
  | 'TIMED_OUT'
  | 'RETIRED_OUT'
  | 'RETIRED_HURT';

export interface FormatRules {
  format: MatchFormat;
  displayName: string;
  maxOversPerInnings: number | null; // null for unlimited (Test/Multi-Day)
  maxInningsPerTeam: number;
  maxOversPerBowler: number | null;
  ballsPerOver: number;
  powerplayPhases: Array<{ name: string; fromOver: number; toOver: number; maxOutsideCircle: number }>;
  enforceFollowOnLead: number | null; // e.g. 200 in 5-day Test, 150 in 3-4 day, null if limited overs
  allowDeclaration: boolean;
  freeHitOnNoBall: boolean;
  dlsApplicable: boolean;
  superOverOnTie: boolean;
}

export const MATCH_FORMAT_RULES: Record<MatchFormat, FormatRules> = {
  T10: {
    format: 'T10',
    displayName: 'T10 Cricket (10 Overs)',
    maxOversPerInnings: 10,
    maxInningsPerTeam: 1,
    maxOversPerBowler: 2,
    ballsPerOver: 6,
    powerplayPhases: [
      { name: 'Mandatory Powerplay', fromOver: 1, toOver: 2, maxOutsideCircle: 2 }
    ],
    enforceFollowOnLead: null,
    allowDeclaration: false,
    freeHitOnNoBall: true,
    dlsApplicable: true,
    superOverOnTie: true
  },
  T20: {
    format: 'T20',
    displayName: 'Twenty20 (20 Overs)',
    maxOversPerInnings: 20,
    maxInningsPerTeam: 1,
    maxOversPerBowler: 4,
    ballsPerOver: 6,
    powerplayPhases: [
      { name: 'Mandatory Powerplay (P1)', fromOver: 1, toOver: 6, maxOutsideCircle: 2 }
    ],
    enforceFollowOnLead: null,
    allowDeclaration: false,
    freeHitOnNoBall: true,
    dlsApplicable: true,
    superOverOnTie: true
  },
  ODI: {
    format: 'ODI',
    displayName: 'One Day International (50 Overs)',
    maxOversPerInnings: 50,
    maxInningsPerTeam: 1,
    maxOversPerBowler: 10,
    ballsPerOver: 6,
    powerplayPhases: [
      { name: 'Mandatory Powerplay (P1)', fromOver: 1, toOver: 10, maxOutsideCircle: 2 },
      { name: 'Bowling Powerplay (P2)', fromOver: 11, toOver: 40, maxOutsideCircle: 4 },
      { name: 'Batting/Final Powerplay (P3)', fromOver: 41, toOver: 50, maxOutsideCircle: 5 }
    ],
    enforceFollowOnLead: null,
    allowDeclaration: false,
    freeHitOnNoBall: true,
    dlsApplicable: true,
    superOverOnTie: true
  },
  TEST: {
    format: 'TEST',
    displayName: 'Test Match (5 Days)',
    maxOversPerInnings: null,
    maxInningsPerTeam: 2,
    maxOversPerBowler: null,
    ballsPerOver: 6,
    powerplayPhases: [],
    enforceFollowOnLead: 200,
    allowDeclaration: true,
    freeHitOnNoBall: false,
    dlsApplicable: false,
    superOverOnTie: false
  },
  MULTI_DAY: {
    format: 'MULTI_DAY',
    displayName: 'Multi-Day Match (2-4 Days)',
    maxOversPerInnings: null,
    maxInningsPerTeam: 2,
    maxOversPerBowler: null,
    ballsPerOver: 6,
    powerplayPhases: [],
    enforceFollowOnLead: 150,
    allowDeclaration: true,
    freeHitOnNoBall: false,
    dlsApplicable: false,
    superOverOnTie: false
  },
  SUPER_OVER: {
    format: 'SUPER_OVER',
    displayName: 'Super Over Eliminator',
    maxOversPerInnings: 1,
    maxInningsPerTeam: 1,
    maxOversPerBowler: 1,
    ballsPerOver: 6,
    powerplayPhases: [],
    enforceFollowOnLead: null,
    allowDeclaration: false,
    freeHitOnNoBall: true,
    dlsApplicable: false,
    superOverOnTie: true
  }
};

/**
 * Converts overs (e.g. 4.2) into total legal ball count (26)
 */
export function oversToBalls(overs: number, balls: number = 0): number {
  return Math.floor(overs) * 6 + balls;
}

/**
 * Converts legal ball count (26) into overs object ({ overs: 4, balls: 2, formatted: '4.2' })
 */
export function ballsToOvers(totalBalls: number): { overs: number; balls: number; formatted: string } {
  const overs = Math.floor(totalBalls / 6);
  const balls = totalBalls % 6;
  return { overs, balls, formatted: `${overs}.${balls}` };
}

/**
 * Increments legal delivery ball count, rolling over from .5 to next over .0
 */
export function incrementOvers(
  currentOvers: number,
  currentBalls: number,
  isLegalDelivery: boolean
): { overs: number; balls: number; formatted: string; isOverComplete: boolean } {
  if (!isLegalDelivery) {
    return {
      overs: currentOvers,
      balls: currentBalls,
      formatted: `${currentOvers}.${currentBalls}`,
      isOverComplete: false
    };
  }

  const nextBalls = currentBalls + 1;
  if (nextBalls >= 6) {
    const nextOvers = currentOvers + 1;
    return {
      overs: nextOvers,
      balls: 0,
      formatted: `${nextOvers}.0`,
      isOverComplete: true
    };
  }

  return {
    overs: currentOvers,
    balls: nextBalls,
    formatted: `${currentOvers}.${nextBalls}`,
    isOverComplete: false
  };
}

/**
 * Decrements legal delivery ball count for undo operations
 */
export function decrementOvers(
  currentOvers: number,
  currentBalls: number,
  wasLegalDelivery: boolean
): { overs: number; balls: number; formatted: string } {
  if (!wasLegalDelivery) {
    return { overs: currentOvers, balls: currentBalls, formatted: `${currentOvers}.${currentBalls}` };
  }

  if (currentBalls === 0) {
    const prevOvers = Math.max(0, currentOvers - 1);
    const prevBalls = 5;
    return { overs: prevOvers, balls: prevBalls, formatted: `${prevOvers}.${prevBalls}` };
  }

  const prevBalls = Math.max(0, currentBalls - 1);
  return { overs: currentOvers, balls: prevBalls, formatted: `${currentOvers}.${prevBalls}` };
}

/**
 * Calculate Current Run Rate (CRR)
 */
export function calculateCRR(totalRuns: number, overs: number, balls: number): number {
  const totalBalls = oversToBalls(overs, balls);
  if (totalBalls === 0) return 0.0;
  return parseFloat(((totalRuns / totalBalls) * 6).toFixed(2));
}

/**
 * Calculate Required Run Rate (RRR)
 */
export function calculateRRR(
  target: number,
  currentRuns: number,
  totalOversLimit: number,
  currentOvers: number,
  currentBalls: number
): number | null {
  const runsNeeded = target - currentRuns;
  if (runsNeeded <= 0) return 0.0;

  const totalMatchBalls = totalOversLimit * 6;
  const ballsBowled = oversToBalls(currentOvers, currentBalls);
  const remainingBalls = Math.max(0, totalMatchBalls - ballsBowled);

  if (remainingBalls === 0) return null; // Innings finished or impossible
  return parseFloat(((runsNeeded / remainingBalls) * 6).toFixed(2));
}

/**
 * Evaluates whether bowler is credited with the wicket
 */
export function isBowlerWicket(wicketType: WicketType): boolean {
  switch (wicketType) {
    case 'BOWLED':
    case 'CAUGHT':
    case 'CAUGHT_BEHIND':
    case 'CAUGHT_AND_BOWLED':
    case 'LBW':
    case 'STUMPED':
    case 'HIT_WICKET':
      return true;
    case 'RUN_OUT':
    case 'OBSTRUCTING_THE_FIELD':
    case 'TIMED_OUT':
    case 'RETIRED_OUT':
    case 'RETIRED_HURT':
    default:
      return false;
  }
}

/**
 * Evaluates whether delivery is a legal delivery (counts toward the 6-ball over)
 */
export function isDeliveryLegal(extraType: ExtraType): boolean {
  return extraType !== 'WIDE' && extraType !== 'NO_BALL';
}

/**
 * Evaluates whether bowler is charged runs conceded
 * Under cricket rules:
 * - Runs off bat are charged to bowler
 * - Wides are charged to bowler
 * - No-ball penalty runs (+ runs off bat) are charged to bowler
 * - Byes and Leg-byes are NOT charged to bowler
 * - Penalty runs (e.g. helmet strike) are NOT charged to bowler
 */
export function calculateBowlerRunsConceded(
  runsBatter: number,
  runsExtras: number,
  extraType: ExtraType
): number {
  if (extraType === 'WIDE') {
    return runsExtras;
  }
  if (extraType === 'NO_BALL') {
    return runsBatter + runsExtras;
  }
  if (extraType === 'BYE' || extraType === 'LEG_BYE' || extraType === 'PENALTY') {
    return 0; // Not charged to bowler
  }
  return runsBatter;
}

/**
 * Calculates Strike Rotation after a delivery according to MCC Law 18 & 2022 amendments
 */
export function calculateNextStrike(params: {
  currentStrikerId: string;
  currentNonStrikerId: string;
  runsScoredOffDelivery: number; // total runs physically run between wickets
  isOverComplete: boolean;
  wicket: boolean;
  dismissedPlayerId?: string;
  newBatterId?: string;
  battersCrossedBeforeCatch?: boolean;
}): { nextStrikerId: string; nextNonStrikerId: string } {
  const {
    currentStrikerId,
    currentNonStrikerId,
    runsScoredOffDelivery,
    isOverComplete,
    wicket,
    dismissedPlayerId,
    newBatterId
  } = params;

  let activeStriker = currentStrikerId;
  let activeNonStriker = currentNonStrikerId;

  // 1. Check Wicket scenario
  if (wicket && newBatterId) {
    // Under MCC 2022 Law 18.11: On any caught dismissal, the new batter ALWAYS takes strike
    // regardless of whether batters crossed before the catch was taken.
    if (dismissedPlayerId === currentStrikerId) {
      activeStriker = newBatterId;
      activeNonStriker = currentNonStrikerId;
    } else {
      activeNonStriker = newBatterId;
      activeStriker = currentStrikerId;
    }
  } else {
    // Normal play: odd runs rotate strike (1, 3, 5 runs run)
    const isOddRuns = Math.abs(runsScoredOffDelivery) % 2 === 1;
    if (isOddRuns) {
      const temp = activeStriker;
      activeStriker = activeNonStriker;
      activeNonStriker = temp;
    }
  }

  // 2. End of Over: Strike rotates automatically for the new over
  if (isOverComplete) {
    const temp = activeStriker;
    activeStriker = activeNonStriker;
    activeNonStriker = temp;
  }

  return {
    nextStrikerId: activeStriker,
    nextNonStrikerId: activeNonStriker
  };
}

/**
 * Evaluates Follow-On eligibility in Multi-Day / Test matches
 * MCC Law 14:
 * 5 days or more: lead >= 200
 * 3 or 4 days: lead >= 150
 * 2 days: lead >= 100
 * 1 day: lead >= 75
 */
export function canEnforceFollowOn(
  firstInningsLead: number,
  format: MatchFormat,
  matchDurationDays: number = 5
): { canEnforce: boolean; requiredLead: number; currentLead: number } {
  let requiredLead = 200;
  if (format === 'TEST' || format === 'MULTI_DAY') {
    if (matchDurationDays >= 5) requiredLead = 200;
    else if (matchDurationDays >= 3) requiredLead = 150;
    else if (matchDurationDays === 2) requiredLead = 100;
    else requiredLead = 75;
  } else {
    return { canEnforce: false, requiredLead: 0, currentLead: firstInningsLead };
  }

  return {
    canEnforce: firstInningsLead >= requiredLead,
    requiredLead,
    currentLead: firstInningsLead
  };
}

/**
 * Determine Match Result Summary text
 */
export function determineMatchResult(params: {
  team1Name: string;
  team2Name: string;
  team1Runs: number;
  team1Wickets: number;
  team2Runs: number;
  team2Wickets: number;
  target?: number;
  isSecondInningsComplete: boolean;
  maxWickets: number; // e.g. 10
  format: MatchFormat;
}): { resultText: string; winnerTeam: string | null; isTie: boolean } {
  const {
    team1Name,
    team2Name,
    team1Runs,
    team2Runs,
    team2Wickets,
    isSecondInningsComplete,
    maxWickets
  } = params;

  if (team2Runs > team1Runs) {
    const wicketsInHand = Math.max(0, maxWickets - team2Wickets);
    return {
      resultText: `${team2Name} won by ${wicketsInHand} wicket${wicketsInHand === 1 ? '' : 's'}`,
      winnerTeam: team2Name,
      isTie: false
    };
  }

  if (isSecondInningsComplete) {
    if (team1Runs > team2Runs) {
      const runMargin = team1Runs - team2Runs;
      return {
        resultText: `${team1Name} won by ${runMargin} run${runMargin === 1 ? '' : 's'}`,
        winnerTeam: team1Name,
        isTie: false
      };
    }
    if (team1Runs === team2Runs) {
      return {
        resultText: 'Match Tied! (Super Over Available)',
        winnerTeam: null,
        isTie: true
      };
    }
  }

  return {
    resultText: 'Match in progress',
    winnerTeam: null,
    isTie: false
  };
}
