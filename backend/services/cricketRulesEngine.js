/**
 * services/cricketRulesEngine.js
 * Comprehensive Shared Cricket Rules Engine
 * 
 * Compliant with MCC Laws of Cricket (2022 Code) & ICC Standard Playing Conditions.
 * Pure JavaScript functions for backend validation, scoring calculations, and test assertions.
 */

const MATCH_FORMAT_RULES = {
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

function oversToBalls(overs, balls = 0) {
  return Math.floor(overs) * 6 + (balls || 0);
}

function ballsToOvers(totalBalls) {
  const overs = Math.floor(totalBalls / 6);
  const balls = totalBalls % 6;
  return { overs, balls, formatted: `${overs}.${balls}` };
}

function incrementOvers(currentOvers, currentBalls, isLegalDelivery) {
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

function decrementOvers(currentOvers, currentBalls, wasLegalDelivery) {
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

function calculateCRR(totalRuns, overs, balls) {
  const totalBalls = oversToBalls(overs, balls);
  if (totalBalls === 0) return 0.0;
  return parseFloat(((totalRuns / totalBalls) * 6).toFixed(2));
}

function calculateRRR(target, currentRuns, totalOversLimit, currentOvers, currentBalls) {
  const runsNeeded = target - currentRuns;
  if (runsNeeded <= 0) return 0.0;

  const totalMatchBalls = totalOversLimit * 6;
  const ballsBowled = oversToBalls(currentOvers, currentBalls);
  const remainingBalls = Math.max(0, totalMatchBalls - ballsBowled);

  if (remainingBalls === 0) return null;
  return parseFloat(((runsNeeded / remainingBalls) * 6).toFixed(2));
}

function isBowlerWicket(wicketType) {
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

function isDeliveryLegal(extraType) {
  return extraType !== 'WIDE' && extraType !== 'NO_BALL';
}

function calculateBowlerRunsConceded(runsBatter, runsExtras, extraType) {
  if (extraType === 'WIDE') return runsExtras;
  if (extraType === 'NO_BALL') return runsBatter + runsExtras;
  if (extraType === 'BYE' || extraType === 'LEG_BYE' || extraType === 'PENALTY') return 0;
  return runsBatter;
}

function calculateNextStrike({
  currentStrikerId,
  currentNonStrikerId,
  runsScoredOffDelivery,
  isOverComplete,
  wicket,
  dismissedPlayerId,
  newBatterId
}) {
  let activeStriker = currentStrikerId;
  let activeNonStriker = currentNonStrikerId;

  if (wicket && newBatterId) {
    if (dismissedPlayerId === currentStrikerId) {
      activeStriker = newBatterId;
      activeNonStriker = currentNonStrikerId;
    } else {
      activeNonStriker = newBatterId;
      activeStriker = currentStrikerId;
    }
  } else {
    const isOddRuns = Math.abs(runsScoredOffDelivery) % 2 === 1;
    if (isOddRuns) {
      const temp = activeStriker;
      activeStriker = activeNonStriker;
      activeNonStriker = temp;
    }
  }

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

function canEnforceFollowOn(firstInningsLead, format, matchDurationDays = 5) {
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

function determineMatchResult({
  team1Name,
  team2Name,
  team1Runs,
  team2Runs,
  team2Wickets,
  isSecondInningsComplete,
  maxWickets = 10
}) {
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

module.exports = {
  MATCH_FORMAT_RULES,
  oversToBalls,
  ballsToOvers,
  incrementOvers,
  decrementOvers,
  calculateCRR,
  calculateRRR,
  isBowlerWicket,
  isDeliveryLegal,
  calculateBowlerRunsConceded,
  calculateNextStrike,
  canEnforceFollowOn,
  determineMatchResult
};
