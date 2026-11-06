import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  TextInput,
  Alert,
  useWindowDimensions
} from 'react-native';
import Svg, { Rect, Line, Circle, Path, G, Text as SvgText } from 'react-native-svg';
import { ScorerApi } from '../../services/api';

export type CricketRuleCategory = 'ALL' | 'BOWLING' | 'BATTING' | 'FIELDING' | 'UMPIRE' | 'MATCH';

export type CompetitionFormat = 'ICC_T20' | 'BCCI_DOMESTIC' | 'MCC_TRADITIONAL' | 'TNCA_LEAGUE';

export type CricketRuleType = string;

export interface CricketRuleDefinition {
  id: string;
  category: 'BOWLING' | 'BATTING' | 'FIELDING' | 'UMPIRE' | 'MATCH';
  name: string;
  law: string;
  icon: string;
  summary: string;
  whenApplies: string;
  decisionProcess: string[];
  runsExtras: string;
  legalBall: string;
  dismissalConsequences: string;
  umpireRequirement: 'AUTOMATIC_DETECTION' | 'UMPIRE_CONFIRMATION_REQUIRED';
  diagramType: string;
  actionPayload?: {
    actionType: string;
    points?: number;
    penaltyAwardedTo?: 'BATTING' | 'FIELDING';
    warningLevel?: 'FIRST_WARNING' | 'SUSPENSION';
    description?: string;
  };
}

export interface CricketRulesModalProps {
  visible: boolean;
  activeRule?: string | null;
  matchId?: string;
  ruleContext?: {
    bowlerName?: string;
    strikerName?: string;
    nonStrikerName?: string;
    bowlerId?: string;
    count?: number;
    oversBowled?: number | string;
    maxQuota?: number;
    overNumber?: number;
    totalRuns?: number;
    wickets?: number;
    currentFormat?: string;
    suspendedBowlers?: any[];
    remarks?: string;
  };
  onClose: () => void;
  onApplyRule?: (ruleType: string, payload?: any) => void;
  onSkip?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// 35 OFFICIAL MCC & ICC T20 CRICKET RULES DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
const ALL_RULES_CATALOG: CricketRuleDefinition[] = [
  // ─── 1. BOWLING RULES ─────────────────────────────────────────────────────────
  {
    id: 'FRONT_FOOT_NO_BALL',
    category: 'BOWLING',
    name: 'Front Foot No Ball',
    law: 'MCC Law 21.5 / ICC T20 Clause 21.5',
    icon: '🦶',
    summary: 'Bowler lands front foot with no part grounded behind popping crease.',
    whenApplies: 'Every delivery at instant of front foot landing.',
    decisionProcess: [
      '1. Umpire checks front foot landing behind popping crease.',
      '2. Part of foot must be grounded or airborne behind inner edge of line.',
      '3. If entirely over line: Call & signal No Ball immediately.',
      '4. Award +1 penalty run and activate Free Hit for next delivery.'
    ],
    runsExtras: '+1 No Ball run to batting team (+ runs scored off bat/extras)',
    legalBall: 'No (Delivery must be re-bowled)',
    dismissalConsequences: 'Batter immune to Bowled, Caught, LBW, Stumped, Hit Wicket. Run Out permitted.',
    umpireRequirement: 'AUTOMATIC_DETECTION',
    diagramType: 'FRONT_FOOT'
  },
  {
    id: 'HIGH_FULL_TOSS',
    category: 'BOWLING',
    name: 'High Full Toss (Beamer)',
    law: 'MCC Law 41.7 / ICC T20 Clause 41.7',
    icon: '⚡',
    summary: 'Any delivery passing above batter waist height without pitching.',
    whenApplies: 'When bowler delivers full pitch ball passing striker standing upright at crease.',
    decisionProcess: [
      '1. Umpire judges height relative to striker waist in normal stance.',
      '2. If above waist: Call No Ball & signal Free Hit.',
      '3. 1st Occurrence: Issue formal First & Final Warning to bowler.',
      '4. 2nd Occurrence by same bowler: Bowler is immediately SUSPENDED from bowling for match.'
    ],
    runsExtras: '+1 No Ball run + Free Hit',
    legalBall: 'No (Delivery must be re-bowled)',
    dismissalConsequences: 'No dismissal permitted except Run Out. Bowler subject to suspension history.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'BEAMER',
    actionPayload: {
      actionType: 'BEAMER_WARNING',
      warningLevel: 'FIRST_WARNING',
      description: 'Waist-height high full toss warning (MCC Law 41.7)'
    }
  },
  {
    id: 'DANGEROUS_BOWLING',
    category: 'BOWLING',
    name: 'Dangerous & Unfair Bowling',
    law: 'MCC Law 41.6 / 41.7',
    icon: '⚠️',
    summary: 'Deliberate or repetitive bowling directed to cause bodily injury.',
    whenApplies: 'Hostile short-pitched balls or beamers endangering striker physical safety.',
    decisionProcess: [
      '1. Umpire assesses bowler speed, trajectory, and skill level of striker.',
      '2. If deemed dangerous: Call No Ball / Dead Ball.',
      '3. Direct bowler captain to caution bowler; issue official warning.',
      '4. Repeat offense requires suspension of bowler and formal incident report.'
    ],
    runsExtras: '+1 No Ball extra + Free Hit (or 5 Penalty runs if deliberate)',
    legalBall: 'No',
    dismissalConsequences: 'Batter immune. Disciplinary points logged in match report.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'DANGEROUS'
  },
  {
    id: 'BOUNCER_LIMIT',
    category: 'BOWLING',
    name: 'Short-Pitched Bouncer Limit',
    law: 'MCC Law 41.6 / ICC T20 Clause 41.6',
    icon: '📏',
    summary: 'In T20 matches, maximum of ONE short-pitched ball above shoulder allowed per over.',
    whenApplies: 'Any ball bouncing and passing striker between shoulder and top of head.',
    decisionProcess: [
      '1. Umpire signals 1 bouncer used for the over (one hand over shoulder).',
      '2. If bowler delivers second bouncer in same over: Call & signal No Ball.',
      '3. If above head height: Call Wide Ball (or No Ball if dangerous).',
      '4. Free Hit applies to second bouncer No-Ball.'
    ],
    runsExtras: '+1 No Ball extra + Free Hit',
    legalBall: '1st is Legal; 2nd is Illegal (re-bowled)',
    dismissalConsequences: '1st bouncer normal dismissal; 2nd bouncer Free Hit immunity applies.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'BOUNCER'
  },
  {
    id: 'WIDE_BALL',
    category: 'BOWLING',
    name: 'Wide Ball & Tramlines',
    law: 'MCC Law 22 / ICC T20 Clause 22',
    icon: '📐',
    summary: 'Delivery out of batter reach passing outside off or leg tramlines.',
    whenApplies: 'Any ball that passes outside the reach of the striker playing normal stroke.',
    decisionProcess: [
      '1. Check Off-Side: Must pass within 88.9 cm off-stump tramline.',
      '2. Check Leg-Side: In T20, any ball passing down leg side without touching bat is automatically Wide.',
      '3. If batter moves across: Judge reach based on normal guard position.',
      '4. Call & signal Wide; award 1 extra run.'
    ],
    runsExtras: '+1 Wide run + any runs completed by batters',
    legalBall: 'No (Delivery must be re-bowled)',
    dismissalConsequences: 'Cannot be Bowled, Caught, LBW. Can be Run Out, Stumped, Hit Wicket.',
    umpireRequirement: 'AUTOMATIC_DETECTION',
    diagramType: 'TRAMLINES'
  },
  {
    id: 'ILLEGAL_BOWLING_ACTION',
    category: 'BOWLING',
    name: 'Illegal Bowling Action (Throwing)',
    law: 'MCC Law 21.2 / ICC Illegal Action Regulations',
    icon: '🦾',
    summary: 'Elbow extension exceeding 15 degrees from point of horizontal to release.',
    whenApplies: 'Suspected throw or jerk during arm rotation.',
    decisionProcess: [
      '1. Umpire observes straightening of bowling arm before release.',
      '2. If clearly thrown: Call No Ball.',
      '3. File formal Suspect Bowling Action Report post-match with video audit.',
      '4. Continuous jerking triggers match suspension by umpires.'
    ],
    runsExtras: '+1 No Ball run + Free Hit',
    legalBall: 'No (Re-bowled)',
    dismissalConsequences: 'No dismissal permitted except Run Out.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'ACTION'
  },
  {
    id: 'BOWLER_OVER_LIMIT',
    category: 'BOWLING',
    name: 'Bowler Over Limit (Quota)',
    law: 'ICC T20 Clause 13.8 / BCCI Playing Conditions',
    icon: '🔋',
    summary: 'In 20-over matches, no bowler may bowl more than 4 overs (20% of total).',
    whenApplies: 'When captain attempts to assign a 5th over to a bowler who has completed 4.0 overs.',
    decisionProcess: [
      '1. System tracks completed overs for every bowler in MongoDB innings.',
      '2. When bowler overs reach 4.0 (or match quota): Mark bowler Quota Full.',
      '3. Scorer & Umpire prevent assignment of further overs.',
      '4. In rain-reduced matches: Quota = Floor(Overs / 5).'
    ],
    runsExtras: '0 runs (Proactive assignment prevention)',
    legalBall: 'Not applicable',
    dismissalConsequences: 'Assignment blocked before delivery bowled.',
    umpireRequirement: 'AUTOMATIC_DETECTION',
    diagramType: 'QUOTA'
  },

  // ─── 2. BATTING RULES ─────────────────────────────────────────────────────────
  {
    id: 'HIT_WICKET',
    category: 'BATTING',
    name: 'Hit Wicket',
    law: 'MCC Law 35',
    icon: '🪵',
    summary: 'Striker dislodges own bails with bat or person during stroke or setting off for run.',
    whenApplies: 'From bowler run-up until striker has completed stroke or first run.',
    decisionProcess: [
      '1. Did bat, equipment, or body dislodge bail from stumps?',
      '2. Was striker in act of receiving delivery or setting off for first run?',
      '3. If yes: Batter is Out (Hit Wicket).',
      '4. Note: If hit occurs after ball is dead or avoiding fielder throw: Not Out.'
    ],
    runsExtras: '0 runs (Ball becomes dead immediately)',
    legalBall: 'Yes',
    dismissalConsequences: 'Out. Bowler is credited with the wicket.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'HIT_WICKET'
  },
  {
    id: 'HIT_BALL_TWICE',
    category: 'BATTING',
    name: 'Hit the Ball Twice',
    law: 'MCC Law 34',
    icon: '🏏',
    summary: 'Striker willfully strikes ball second time other than guarding wicket.',
    whenApplies: 'After ball has touched bat or person.',
    decisionProcess: [
      '1. Did striker strike ball second time with bat or person?',
      '2. Was the second strike solely to protect stumps from being hit?',
      '3. If second strike was to score runs: Batter is Out (Hit the ball twice).',
      '4. If defending stumps: Not Out, but no runs can be scored.'
    ],
    runsExtras: '0 runs (Runs made off second touch are cancelled)',
    legalBall: 'Yes',
    dismissalConsequences: 'Out. Bowler is NOT credited with the wicket.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'HIT_TWICE'
  },
  {
    id: 'OBSTRUCTING_FIELD',
    category: 'BATTING',
    name: 'Obstructing the Field',
    law: 'MCC Law 37',
    icon: '🛑',
    summary: 'Batter willfully obstructs or distracts fielding side by word or action.',
    whenApplies: 'During play, particularly while running between wickets or returning to crease.',
    decisionProcess: [
      '1. Did batter change running path deliberately to intercept throw?',
      '2. Was bat/hand used deliberately to deflect ball away from stumps?',
      '3. If deliberate obstruction: Batter is Out (Obstructing the field).',
      '4. If accidental collision while running regular line: Not Out.'
    ],
    runsExtras: '0 runs from time of obstruction',
    legalBall: 'Yes',
    dismissalConsequences: 'Out. Bowler is NOT credited with wicket.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'OBSTRUCTING'
  },
  {
    id: 'TIMED_OUT',
    category: 'BATTING',
    name: 'Timed Out',
    law: 'MCC Law 40 / ICC T20 Clause 40.1',
    icon: '⏱️',
    summary: 'Incoming batter must be ready to take guard within 90 seconds in T20 (2 mins in Tests).',
    whenApplies: 'Following a wicket or retirement of previous batter.',
    decisionProcess: [
      '1. Umpire starts timer upon fall of wicket or retirement.',
      '2. Incoming batter must cross boundary and take guard at crease within 90s.',
      '3. If time expires and fielding captain appeals: Batter is Out (Timed Out).',
      '4. Next incoming batter takes crease.'
    ],
    runsExtras: '0 runs',
    legalBall: 'No delivery bowled',
    dismissalConsequences: 'Out. Bowler is NOT credited with the wicket.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'TIMED_OUT'
  },
  {
    id: 'RETIRED_HURT',
    category: 'BATTING',
    name: 'Retired Hurt (Not Out)',
    law: 'MCC Law 25.4',
    icon: '🩹',
    summary: 'Batter leaves field due to illness, injury, or unavoidable cause.',
    whenApplies: 'Any time during innings with umpire consent.',
    decisionProcess: [
      '1. Batter notifies umpire of injury/illness.',
      '2. Umpire verifies bona fide medical need.',
      '3. Batter retires: Scorecard marks "Retired Hurt (Not Out)".',
      '4. CRITICAL: Wicket is NOT added to team total. Batter may resume innings later.'
    ],
    runsExtras: '0 runs',
    legalBall: 'Yes (if occurred during delivery)',
    dismissalConsequences: 'NOT OUT. Batter eligible to return at fall of any subsequent wicket.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'RETIRED_HURT',
    actionPayload: {
      actionType: 'RETIRED_HURT',
      description: 'Batter retired hurt (injury - not out)'
    }
  },
  {
    id: 'RETIRED_OUT',
    category: 'BATTING',
    name: 'Retired Out',
    law: 'MCC Law 25.4',
    icon: '🚪',
    summary: 'Batter leaves field without umpire permission or injury justification.',
    whenApplies: 'Tactical retirement during live innings.',
    decisionProcess: [
      '1. Batter leaves field without medical justification.',
      '2. Umpire records dismissal as "Retired Out".',
      '3. Team wicket total increases by 1.',
      '4. Batter CANNOT resume innings without consent of opposing captain.'
    ],
    runsExtras: '0 runs',
    legalBall: 'Yes',
    dismissalConsequences: 'Out. Counted as official dismissal. Bowler is NOT credited.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'RETIRED_OUT'
  },
  {
    id: 'LBW',
    category: 'BATTING',
    name: 'Leg Before Wicket (LBW)',
    law: 'MCC Law 36',
    icon: '🎯',
    summary: 'Ball hits batter pad/body in line with stumps without touching bat.',
    whenApplies: 'Delivery strikes striker person without bat contact.',
    decisionProcess: [
      '1. Check Pitching: Did ball pitch in-line with stumps or outside off-stump? (Outside leg = Not Out).',
      '2. Check Impact: Was impact in-line with stumps? (If outside off, only Out if no stroke offered).',
      '3. Check Wickets: Would ball have hit the stumps?',
      '4. Check Bat: Confirm ball did NOT touch bat/glove first. If all criteria pass: OUT.'
    ],
    runsExtras: '0 runs',
    legalBall: 'Yes',
    dismissalConsequences: 'Out. Bowler is credited with wicket.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'LBW'
  },
  {
    id: 'RUN_OUT',
    category: 'BATTING',
    name: 'Run Out & Mankad',
    law: 'MCC Law 38 / Law 38.3',
    icon: '🏃',
    summary: 'Bails dislodged by fielder throw/break while batter is out of ground.',
    whenApplies: 'While batters are running or non-striker leaves crease before release.',
    decisionProcess: [
      '1. Which end was broken? (Striker vs Non-Striker end).',
      '2. Did batters cross before stumps were broken?',
      '3. If Striker end broken & NOT crossed ➔ Striker is OUT.',
      '4. If Striker end broken & CROSSED ➔ Non-Striker is OUT.',
      '5. Mankad (Law 38.3): Legal dismissal if non-striker leaves crease before release point.'
    ],
    runsExtras: 'Runs completed before wicket are scored',
    legalBall: 'Yes',
    dismissalConsequences: 'Out. Bowler is NOT credited with wicket.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'RUN_OUT'
  },
  {
    id: 'STUMPING',
    category: 'BATTING',
    name: 'Stumped',
    law: 'MCC Law 39',
    icon: '🧤',
    summary: 'Wicketkeeper dislodges bails while striker is out of ground not attempting a run.',
    whenApplies: 'Striker misses ball and steps out of popping crease.',
    decisionProcess: [
      '1. Striker must have no part of foot/body grounded behind popping crease line.',
      '2. Striker was NOT attempting a run (if attempting run, it is Run Out).',
      '3. Keeper must gather ball legally and break stumps without other fielder help.',
      '4. Ball must NOT have been a No Ball (Stumping off Wide is legal).'
    ],
    runsExtras: '0 runs (or 1 Wide if delivery was wide)',
    legalBall: 'Yes (or Wide)',
    dismissalConsequences: 'Out. Bowler is credited with wicket.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'STUMPING'
  },

  // ─── 3. FIELDING RULES ────────────────────────────────────────────────────────
  {
    id: 'POWERPLAY_RESTRICTIONS',
    category: 'FIELDING',
    name: 'Powerplay Restrictions',
    law: 'ICC T20 Clause 28.7 / BCCI Regulations',
    icon: '⭕',
    summary: 'Overs 1-6 mandatory Powerplay: Maximum 2 fielders outside 30-yard oval.',
    whenApplies: 'Every ball during specified overs.',
    decisionProcess: [
      '1. Overs 1–6 (P1): Max 2 fielders permitted outside 30-yard circle.',
      '2. Overs 7–20: Maximum 5 fielders permitted outside 30-yard circle.',
      '3. Leg-side restriction: No more than 5 fielders on leg side at any time.',
      '4. If field breached at moment of delivery: Umpire calls No Ball + Free Hit.'
    ],
    runsExtras: '+1 No Ball extra + Free Hit on violation',
    legalBall: 'Illegal if violation occurs at release',
    dismissalConsequences: 'Free Hit protection applies on violation.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'POWERPLAY'
  },
  {
    id: 'BOUNDARY_CATCH',
    category: 'FIELDING',
    name: 'Boundary Catch & Grounding',
    law: 'MCC Law 19.4 / 19.5',
    icon: '🚩',
    summary: 'Fielder must have grounded first touch inside boundary and cannot contact rope while holding ball.',
    whenApplies: 'Aerial catches taken near boundary rope.',
    decisionProcess: [
      '1. Fielder first touch must be with feet/body grounded inside rope.',
      '2. Fielder may leap airborne outside rope provided last ground touch was inside.',
      '3. If fielder throws ball back inside before landing beyond boundary: Legal.',
      '4. If any part of fielder body contacts rope/ground outside while touching ball: Six runs awarded.'
    ],
    runsExtras: '6 Runs if grounded beyond rope; 0 runs if caught legal',
    legalBall: 'Yes',
    dismissalConsequences: 'Out (Caught) if legal; Six runs if boundary breached.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'BOUNDARY'
  },
  {
    id: 'ILLEGAL_FIELDING',
    category: 'FIELDING',
    name: 'Illegal Fielding (Detached Gear)',
    law: 'MCC Law 28.2',
    icon: '🧢',
    summary: 'Fielder uses cap, clothing, or detached glove to field the ball.',
    whenApplies: 'When fielder stops ball with any article not firmly attached to person.',
    decisionProcess: [
      '1. Fielder drops cap or glove to stop ball trajectory.',
      '2. Ball contacts detached article.',
      '3. Umpire signals Dead Ball and awards 5 Penalty runs to batting team.',
      '4. Deliver is re-bowled or scored based on stage of play.'
    ],
    runsExtras: '+5 Penalty runs to batting team',
    legalBall: 'No (Ball dead upon contact)',
    dismissalConsequences: 'No dismissal allowed.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'ILLEGAL_FIELD',
    actionPayload: {
      actionType: 'AWARD_PENALTY',
      points: 5,
      penaltyAwardedTo: 'BATTING',
      description: '5 Penalty runs awarded for illegal fielding (MCC Law 28.2)'
    }
  },
  {
    id: 'HELMET_CONTACT',
    category: 'FIELDING',
    name: 'Helmet Contact Penalty',
    law: 'MCC Law 28.3',
    icon: '🪖',
    summary: 'Ball in play strikes protective helmet placed on ground by fielding team.',
    whenApplies: 'When ball strikes ground helmet behind keeper or in field of play.',
    decisionProcess: [
      '1. Ball is in play and contacts stationary fielding helmet on ground.',
      '2. Umpire immediately calls and signals Dead Ball.',
      '3. Award 5 Penalty runs to batting team.',
      '4. Any runs completed by batters prior to contact are also added to total.'
    ],
    runsExtras: '+5 Penalty runs to batting team + completed runs',
    legalBall: 'Yes (counts if legal ball bowled)',
    dismissalConsequences: 'Batter cannot be dismissed by contact with helmet.',
    umpireRequirement: 'AUTOMATIC_DETECTION',
    diagramType: 'HELMET',
    actionPayload: {
      actionType: 'AWARD_PENALTY',
      points: 5,
      penaltyAwardedTo: 'BATTING',
      description: '5 Penalty runs for ball striking grounded helmet (MCC Law 28.3)'
    }
  },
  {
    id: 'FIELDER_OBSTRUCTION',
    category: 'FIELDING',
    name: 'Fielder Obstruction & Fake Fielding',
    law: 'MCC Law 41.4 / 41.5',
    icon: '🚫',
    summary: 'Fielder deliberately distracts or deceives striker through word or mock fielding action.',
    whenApplies: 'When fielder fakes throwing or sliding to pretend stopping ball.',
    decisionProcess: [
      '1. Did fielder pretend to slide/throw to deceive batters running?',
      '2. If deliberate deception: Call Dead Ball.',
      '3. Award 5 Penalty runs to batting team.',
      '4. Batters choose which end to face on the next delivery.'
    ],
    runsExtras: '+5 Penalty runs to batting team',
    legalBall: 'No',
    dismissalConsequences: 'No dismissal permitted.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'FAKE_FIELD',
    actionPayload: {
      actionType: 'AWARD_PENALTY',
      points: 5,
      penaltyAwardedTo: 'BATTING',
      description: '5 Penalty runs for fake fielding / deliberate distraction (MCC Law 41.5)'
    }
  },
  {
    id: 'SUBSTITUTE_FIELDER',
    category: 'FIELDING',
    name: 'Substitute Fielder Restrictions',
    law: 'MCC Law 24',
    icon: '🎽',
    summary: 'Substitute fielder cannot bat, bowl, or act as wicketkeeper.',
    whenApplies: 'When team utilizes player not in original Playing XI due to injury/illness.',
    decisionProcess: [
      '1. Substitute requires consent of opposing captain and umpires.',
      '2. Substitute may ONLY field (No batting, bowling, or keeping allowed).',
      '3. Original player absent for >8 mins must serve equal penalty time before bowling.'
    ],
    runsExtras: '0 runs',
    legalBall: 'Not applicable',
    dismissalConsequences: 'Catches taken by substitute are credited to bowler.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'SUBSTITUTE'
  },
  {
    id: 'KEEPER_RESTRICTIONS',
    category: 'FIELDING',
    name: 'Wicketkeeper Positioning Restrictions',
    law: 'MCC Law 27',
    icon: '🧤',
    summary: 'Keeper must remain wholly behind wicket until ball strikes bat or passes crease.',
    whenApplies: 'Every delivery from bowler delivery stride to ball arrival.',
    decisionProcess: [
      '1. Keeper must not encroach in front of stumps before ball passes.',
      '2. If keeper gloves cross stumps before ball: Call No Ball.',
      '3. Keeper must wear standard gloves without webbing webbing exceeding permitted dimensions.'
    ],
    runsExtras: '+1 No Ball extra + Free Hit',
    legalBall: 'No (Re-bowled)',
    dismissalConsequences: 'Stumping invalidated if encroachment occurred.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'KEEPER'
  },

  // ─── 4. UMPIRE RULES ──────────────────────────────────────────────────────────
  {
    id: 'DEAD_BALL',
    category: 'UMPIRE',
    name: 'Dead Ball',
    law: 'MCC Law 20',
    icon: '🛑',
    summary: 'Ball ceases to be in play; no runs can be scored, no batter can be dismissed.',
    whenApplies: 'When ball is trapped in clothing, hits wire/spidercam, bowler aborts run-up, or umpire intervenes.',
    decisionProcess: [
      '1. Umpire calls and signals "Dead Ball" (crossing wrists).',
      '2. Play ceases immediately; ball does not count as a ball faced.',
      '3. Any runs scored during dead ball period are cancelled.',
      '4. Delivery is re-bowled with original strike maintained.'
    ],
    runsExtras: '0 runs (delivery cancelled)',
    legalBall: 'No (Ball ceases and re-bowled)',
    dismissalConsequences: 'No dismissal can occur after ball is dead.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'DEAD_BALL'
  },
  {
    id: 'PENALTY_RUNS',
    category: 'UMPIRE',
    name: 'Penalty Runs (+5 Award)',
    law: 'MCC Law 41 / 42',
    icon: '🪖',
    summary: '5 runs awarded to batting or fielding team for serious unfair play or equipment violations.',
    whenApplies: 'Ball tampering, helmet hit, time wasting, player misconduct, or fake fielding.',
    decisionProcess: [
      '1. Identify violation (e.g. Helmet contact, Law 42 Misconduct, Ball Tampering).',
      '2. Umpire signals 5 Penalty Runs (touches opposite shoulder).',
      '3. Award 5 runs to offended team.',
      '4. Record incident in official match umpire disciplinary audit.'
    ],
    runsExtras: '+5 Penalty runs to batting or fielding side',
    legalBall: 'Does not count as a delivery if play stopped',
    dismissalConsequences: 'No dismissal.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'PENALTY_RUNS',
    actionPayload: {
      actionType: 'AWARD_PENALTY',
      points: 5,
      penaltyAwardedTo: 'BATTING',
      description: '5 Penalty runs awarded by Umpire under MCC Law 41/42'
    }
  },
  {
    id: 'BALL_TAMPERING',
    category: 'UMPIRE',
    name: 'Ball Tampering (Altering Condition)',
    law: 'MCC Law 41.3',
    icon: '⚾',
    summary: 'Unlawfully changing condition of ball using artificial substances, scratching, or picking seam.',
    whenApplies: 'Any time fielding team alters ball condition outside legal polishing with cloth.',
    decisionProcess: [
      '1. Umpires inspect ball condition immediately.',
      '2. If ball tampered: Award 5 Penalty runs to batting side.',
      '3. Change the ball immediately with comparable match ball.',
      '4. Issue first and final warning to bowler / captain; submit Disciplinary Code report.'
    ],
    runsExtras: '+5 Penalty runs to batting team',
    legalBall: 'Yes',
    dismissalConsequences: 'Formal player code of conduct penalty logged.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'TAMPERING',
    actionPayload: {
      actionType: 'AWARD_PENALTY',
      points: 5,
      penaltyAwardedTo: 'BATTING',
      description: '5 Penalty runs awarded for ball tampering (MCC Law 41.3)'
    }
  },
  {
    id: 'TIME_WASTING',
    category: 'UMPIRE',
    name: 'Time Wasting by Fielding or Batting Side',
    law: 'MCC Law 41.9 / 41.10',
    icon: '⏳',
    summary: 'Unnecessary delay in bowling, field placement, or batter taking guard.',
    whenApplies: 'Prolonged tactical delays exceeding standard match pace.',
    decisionProcess: [
      '1. Umpire calls Time and warns captain / batter.',
      '2. First Offense: Official First & Final Warning.',
      '3. Repeated Offense by Fielding Team: Award 5 Penalty runs to batting team.',
      '4. Repeated Offense by Batting Team: Award 5 Penalty runs to fielding team.'
    ],
    runsExtras: '+5 Penalty runs to opponent on repeat offense',
    legalBall: 'No',
    dismissalConsequences: 'Disciplinary sanction.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'TIME_WASTING'
  },
  {
    id: 'PLAYER_MISCONDUCT',
    category: 'UMPIRE',
    name: 'Player Misconduct (Disciplinary Levels)',
    law: 'MCC Law 42',
    icon: '⚖️',
    summary: 'Dissent, aggressive behavior, obscene language, or physical contact.',
    whenApplies: 'Player behavioral infractions during match.',
    decisionProcess: [
      '1. Level 1 (Warning / 5 Penalty runs for repeat): Dissent, aggressive appeals.',
      '2. Level 2 (5 Penalty runs): Throwing ball dangerously at player.',
      '3. Level 3 (5 Penalty runs + 3 Overs suspension): Intimidation of umpire.',
      '4. Level 4 (5 Penalty runs + Sent off for match): Physical assault or threat of violence.'
    ],
    runsExtras: '+5 Penalty runs for Level 2, 3, 4',
    legalBall: 'Not applicable',
    dismissalConsequences: 'Player suspended or removed from field of play.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'MISCONDUCT'
  },
  {
    id: 'UNFAIR_PLAY',
    category: 'UMPIRE',
    name: 'Unfair Play & Pitch Damage',
    law: 'MCC Law 41.12 / 41.14',
    icon: '🌱',
    summary: 'Fielder or batter deliberately running in protected danger area of pitch.',
    whenApplies: 'Running in the 5ft central protected strip of the cricket pitch.',
    decisionProcess: [
      '1. 1st Occurrence: Umpire informs captain / batter (First & Final Warning).',
      '2. 2nd Occurrence by Bowler: Bowler suspended from bowling for innings.',
      '3. 2nd Occurrence by Batter: 5 Penalty runs awarded to fielding team.'
    ],
    runsExtras: '+5 Penalty runs on repeat',
    legalBall: 'Yes',
    dismissalConsequences: 'Bowler suspension on repeat running in danger area.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'PITCH_DAMAGE'
  },

  // ─── 5. MATCH RULES ───────────────────────────────────────────────────────────
  {
    id: 'FREE_HIT',
    category: 'MATCH',
    name: 'Free Hit After No Ball',
    law: 'ICC T20 Clause 21.19 / BCCI PC',
    icon: '⚡',
    summary: 'Next delivery following any No Ball is a Free Hit with dismissal immunity.',
    whenApplies: 'The ball immediately following any No Ball.',
    decisionProcess: [
      '1. Umpire signals No Ball, then makes circular arm signal above head for Free Hit.',
      '2. Fielding positions CANNOT change unless there is a change of strike.',
      '3. Striker is immune to Bowled, Caught, LBW, Stumped, Hit Wicket.',
      '4. Only Run Out, Obstructing Field, and Hit Ball Twice can dismiss batter.',
      '5. If Free Hit delivery is a Wide or No Ball, Free Hit status carries forward!'
    ],
    runsExtras: 'Runs scored off bat/extras count normally',
    legalBall: 'Yes (unless bowled Wide or No Ball)',
    dismissalConsequences: 'Immunity applies. Only Run Out permitted.',
    umpireRequirement: 'AUTOMATIC_DETECTION',
    diagramType: 'FREE_HIT'
  },
  {
    id: 'OVER_COMPLETION',
    category: 'MATCH',
    name: 'Over Completion (6 Valid Balls)',
    law: 'MCC Law 17',
    icon: '🔄',
    summary: 'An over is complete when 6 legal deliveries have been bowled.',
    whenApplies: 'Continuously throughout each innings.',
    decisionProcess: [
      '1. Umpire counts legal deliveries (Wides and No-Balls do not count).',
      '2. Upon 6th legal ball: Call "Over".',
      '3. Bowler cannot bowl consecutive overs from either end.',
      '4. Umpire and scorer verify score before starting next over.'
    ],
    runsExtras: 'Standard ball scoring',
    legalBall: '6 legal balls required',
    dismissalConsequences: 'Normal dismissals.',
    umpireRequirement: 'AUTOMATIC_DETECTION',
    diagramType: 'OVER_COMPLETION'
  },
  {
    id: 'SLOW_OVER_RATE',
    category: 'MATCH',
    name: 'Slow Over Rate Penalty (85-Min Cut-off)',
    law: 'ICC T20 Clause 16 / BCCI Regulations',
    icon: '⏱️',
    summary: 'Fielding team must be in position to bowl 20th over within 85 minutes.',
    whenApplies: 'At scheduled cut-off time for innings completion.',
    decisionProcess: [
      '1. Innings allocation = 85 minutes for 20 overs (approx 4m 15s per over).',
      '2. If fielding side is behind time at start of final over:',
      '3. Penalty: ONE LESS fielder permitted outside 30-yard ring (only 4 outside instead of 5).',
      '4. Captain subject to ICC/BCCI match fee fine post-match.'
    ],
    runsExtras: 'Fielding restriction penalty applied during play',
    legalBall: 'Yes',
    dismissalConsequences: 'Normal dismissals.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'SLOW_OVER'
  },
  {
    id: 'SUPER_OVER',
    category: 'MATCH',
    name: 'Super Over Tie-Breaker',
    law: 'ICC T20 Clause 16.5',
    icon: '🏆',
    summary: 'Single over per side tie-breaker to determine match winner.',
    whenApplies: 'When scores are equal at the conclusion of both innings in a knockout match.',
    decisionProcess: [
      '1. Each team nominates 3 batters and 1 bowler.',
      '2. Team batting second in main match bats first in Super Over.',
      '3. Each team innings consists of 1 over (6 balls); 2 wickets maximum (all out on 2nd wicket).',
      '4. Team with highest runs in Super Over wins match.',
      '5. If Super Over is tied: Consecutive Super Overs bowled until winner emerges.'
    ],
    runsExtras: 'Regular scoring',
    legalBall: 'Yes',
    dismissalConsequences: 'All out upon 2 wickets.',
    umpireRequirement: 'AUTOMATIC_DETECTION',
    diagramType: 'SUPER_OVER'
  },
  {
    id: 'DLS_METHOD',
    category: 'MATCH',
    name: 'Duckworth-Lewis-Stern (DLS) Method',
    law: 'ICC Playing Conditions (Rain Rule)',
    icon: '🌧️',
    summary: 'Mathematically calculates revised target in rain-interrupted limited overs matches.',
    whenApplies: 'When weather interruptions reduce available overs in Team 1 or Team 2 innings.',
    decisionProcess: [
      '1. Minimum 5 overs per side required for valid T20 result.',
      '2. Calculates resources remaining using overs left and wickets lost.',
      '3. If Team 2 overs reduced: Target = Team 1 Runs * (Team 2 Resources / Team 1 Resources) + 1.',
      '4. Official DLS target is announced by match referee before play resumes.'
    ],
    runsExtras: 'Revised target score calculated',
    legalBall: 'Yes',
    dismissalConsequences: 'Normal dismissals.',
    umpireRequirement: 'UMPIRE_CONFIRMATION_REQUIRED',
    diagramType: 'DLS'
  },
  {
    id: 'INNINGS_BREAK',
    category: 'MATCH',
    name: 'Innings Break & Intervals',
    law: 'MCC Law 11 / ICC T20 Clause 11',
    icon: '☕',
    summary: '15-minute standard interval between 1st and 2nd innings in T20 cricket.',
    whenApplies: 'Upon completion of first innings (all out or overs completed).',
    decisionProcess: [
      '1. Umpire calls interval upon end of 1st innings.',
      '2. Countdown clock sets 15 minutes (or reduced interval in delayed matches).',
      '3. Umpires and fielding team take field at 13 minutes.',
      '4. Play resumes strictly at zero seconds; failure to resume penalized under Law 41.9.'
    ],
    runsExtras: 'Not applicable',
    legalBall: 'Interval',
    dismissalConsequences: 'None',
    umpireRequirement: 'AUTOMATIC_DETECTION',
    diagramType: 'BREAK'
  }
];

export default function CricketRulesModal({
  visible,
  activeRule,
  matchId,
  ruleContext = {},
  onClose,
  onApplyRule,
  onSkip
}: CricketRulesModalProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // Selected State
  const [selectedRuleId, setSelectedRuleId] = useState<string>(activeRule || 'FRONT_FOOT_NO_BALL');
  const [selectedCategory, setSelectedCategory] = useState<CricketRuleCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [competitionFormat, setCompetitionFormat] = useState<CompetitionFormat>('ICC_T20');

  // Confirmation Modal for Applying Decisions
  const [pendingActionRule, setPendingActionRule] = useState<CricketRuleDefinition | null>(null);
  const [isApplyingAction, setIsApplyingAction] = useState<boolean>(false);

  // Decision History Drawer State
  const [showHistoryView, setShowHistoryView] = useState<boolean>(false);
  const [decisionHistory, setDecisionHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // Interactive Run Out State
  const [brokenEnd, setBrokenEnd] = useState<'STRIKER' | 'NON_STRIKER'>('STRIKER');
  const [didBattersCross, setDidBattersCross] = useState<boolean>(false);

  // Interactive Timed Out State
  const [timedOutSeconds, setTimedOutSeconds] = useState<number>(90);

  useEffect(() => {
    if (activeRule) {
      const match = ALL_RULES_CATALOG.find(r => r.id === activeRule || r.id.toLowerCase() === activeRule.toLowerCase());
      if (match) {
        setSelectedRuleId(match.id);
      }
    }
  }, [activeRule]);

  useEffect(() => {
    if (visible && selectedRuleId === 'TIMED_OUT') {
      setTimedOutSeconds(competitionFormat === 'ICC_T20' ? 90 : 120);
      const timer = setInterval(() => {
        setTimedOutSeconds(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [visible, selectedRuleId, competitionFormat]);

  // Load Umpire Decision History
  useEffect(() => {
    if (visible && showHistoryView && matchId) {
      loadDecisionHistory();
    }
  }, [visible, showHistoryView, matchId]);

  const loadDecisionHistory = async () => {
    if (!matchId) return;
    try {
      setIsLoadingHistory(true);
      const res = await ScorerApi.getUmpireDecisions(matchId);
      if (res && res.decisions) {
        setDecisionHistory(res.decisions);
      }
    } catch (_err) {
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Filtered Rules Catalog
  const filteredRules = useMemo(() => {
    return ALL_RULES_CATALOG.filter(rule => {
      const matchesCategory = selectedCategory === 'ALL' || rule.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        rule.name.toLowerCase().includes(q) ||
        rule.law.toLowerCase().includes(q) ||
        rule.summary.toLowerCase().includes(q) ||
        rule.category.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const selectedRule = useMemo(() => {
    return ALL_RULES_CATALOG.find(r => r.id === selectedRuleId) || ALL_RULES_CATALOG[0];
  }, [selectedRuleId]);

  // Execute Umpire Decision
  const handleConfirmDecision = async () => {
    if (!pendingActionRule) return;
    setIsApplyingAction(true);
    try {
      const payload = {
        ruleName: pendingActionRule.name,
        lawReference: pendingActionRule.law,
        description: pendingActionRule.actionPayload?.description || pendingActionRule.summary,
        runsAwarded: pendingActionRule.actionPayload?.points || 0,
        warningLevel: pendingActionRule.actionPayload?.warningLevel || null,
        bowlerId: ruleContext.bowlerId,
        bowlerName: ruleContext.bowlerName,
        targetTeamName: pendingActionRule.actionPayload?.penaltyAwardedTo === 'BATTING' ? 'Batting Team' : 'Bowling Team'
      };

      if (matchId) {
        await ScorerApi.recordUmpireDecision(matchId, payload);
      }

      if (onApplyRule) {
        onApplyRule(pendingActionRule.id, payload);
      }

      const msg = `Umpire Decision Applied: ${pendingActionRule.name} (${pendingActionRule.law}) recorded successfully in official match records.`;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Decision Recorded', msg);
      setPendingActionRule(null);
    } catch (err: any) {
      const msg = err.message || 'Failed to apply decision to match record.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsApplyingAction(false);
    }
  };

  // Helper for Run Out victim
  const calculateRunOutVictim = () => {
    const striker = ruleContext.strikerName || 'Striker';
    const nonStriker = ruleContext.nonStrikerName || 'Non-Striker';
    if (brokenEnd === 'STRIKER') {
      return didBattersCross ? nonStriker : striker;
    } else {
      return didBattersCross ? striker : nonStriker;
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.modalCard, isMobile && { width: '96%', maxHeight: '94%' }]}>
          {/* HEADER */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={styles.headerIconBadge}>
                <Text style={{ fontSize: 20 }}>⚖️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>Cricket Umpire Decision-Support System</Text>
                <Text style={styles.headerSubtitle}>
                  MCC Laws of Cricket (4th Ed. 2026) • ICC & BCCI Professional Match Engine
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TouchableOpacity
                style={[styles.historyPillBtn, showHistoryView && styles.historyPillBtnActive]}
                onPress={() => setShowHistoryView(prev => !prev)}
                activeOpacity={0.7}
              >
                <Text style={[styles.historyPillBtnText, showHistoryView && styles.historyPillBtnTextActive]}>
                  {showHistoryView ? '📖 View Rules' : '📋 Decision Audit History'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* PLAYING CONDITIONS SELECTOR & LIVE MONITOR */}
          <View style={styles.monitorBar}>
            <View style={styles.competitionRow}>
              <Text style={styles.monitorLabel}>PLAYING CONDITIONS:</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { key: 'ICC_T20', label: 'ICC T20 International' },
                  { key: 'BCCI_DOMESTIC', label: 'BCCI Domestic (SMAT)' },
                  { key: 'MCC_TRADITIONAL', label: 'MCC 42 Laws' },
                  { key: 'TNCA_LEAGUE', label: 'TNCA League Conditions' }
                ].map(comp => (
                  <TouchableOpacity
                    key={comp.key}
                    style={[styles.compChip, competitionFormat === comp.key && styles.compChipActive]}
                    onPress={() => setCompetitionFormat(comp.key as CompetitionFormat)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.compChipText, competitionFormat === comp.key && styles.compChipTextActive]}>
                      {comp.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* REAL-TIME MATCH CONTEXT STRIP */}
            <View style={styles.liveMatchContextStrip}>
              <View style={styles.contextItem}>
                <Text style={styles.contextLabel}>FORMAT:</Text>
                <Text style={styles.contextValue}>{ruleContext.currentFormat || 'T20 (20.0 Overs)'}</Text>
              </View>
              {ruleContext.bowlerName && (
                <View style={styles.contextItem}>
                  <Text style={styles.contextLabel}>BOWLER:</Text>
                  <Text style={styles.contextValue}>
                    {ruleContext.bowlerName} ({ruleContext.oversBowled || '0.0'}/{ruleContext.maxQuota || 4} Ov)
                  </Text>
                </View>
              )}
              <View style={styles.contextItem}>
                <Text style={styles.contextLabel}>FREE HIT:</Text>
                <Text style={[styles.contextValue, { color: ruleContext.count ? '#dc2626' : '#16a34a' }]}>
                  {ruleContext.count ? '⚡ Active' : 'Normal'}
                </Text>
              </View>
              {Array.isArray(ruleContext.suspendedBowlers) && ruleContext.suspendedBowlers.length > 0 && (
                <View style={[styles.contextItem, { backgroundColor: '#fee2e2' }]}>
                  <Text style={[styles.contextLabel, { color: '#b91c1c' }]}>SUSPENDED:</Text>
                  <Text style={[styles.contextValue, { color: '#dc2626' }]}>
                    {ruleContext.suspendedBowlers.length} Bowler(s)
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* VIEW TOGGLE: DECISION HISTORY vs RULES CATALOG */}
          {showHistoryView ? (
            /* ─── DECISION AUDIT HISTORY VIEW ─── */
            <ScrollView contentContainerStyle={styles.historyContainer} showsVerticalScrollIndicator={false}>
              <View style={styles.historyHeaderRow}>
                <Text style={styles.historyTitle}>Official Umpire Decisions & Incident Audit Trail</Text>
                <TouchableOpacity onPress={loadDecisionHistory} style={styles.refreshBtn} activeOpacity={0.7}>
                  <Text style={styles.refreshBtnText}>🔄 Refresh Audit Log</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.historySub}>
                Chronological record of official warnings, suspensions, penalty runs, and rule interventions in MongoDB:
              </Text>

              {isLoadingHistory ? (
                <Text style={{ textAlign: 'center', marginVertical: 20, color: '#64748b' }}>
                  Loading official decision records from MongoDB...
                </Text>
              ) : decisionHistory.length === 0 ? (
                <View style={styles.emptyHistoryBox}>
                  <Text style={{ fontSize: 32 }}>📋</Text>
                  <Text style={styles.emptyHistoryTitle}>No Umpire Interventions Logged Yet</Text>
                  <Text style={styles.emptyHistorySub}>
                    Match is being played within normal sporting bounds. Any beamers, penalty runs, or suspensions will appear here automatically.
                  </Text>
                </View>
              ) : (
                decisionHistory.map((item, idx) => (
                  <View key={item.id || idx} style={styles.historyCard}>
                    <View style={styles.historyCardTop}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 16 }}>⚖️</Text>
                        <Text style={styles.historyDecisionType}>{item.decision_type || 'RULE_DECISION'}</Text>
                      </View>
                      <Text style={styles.historyTimestamp}>
                        Over {item.over || 0}.{item.ball || 0} • Inn {item.inning || 1}
                      </Text>
                    </View>
                    <Text style={styles.historyDesc}>{item.description}</Text>
                    <View style={styles.historyFooter}>
                      <Text style={styles.historyOfficial}>Logged by: {item.umpire_name || 'Match Umpire'}</Text>
                      <Text style={styles.historyId}>Ref ID: {item.id}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          ) : (
            /* ─── RULES DECISION SUPPORT CATALOG ─── */
            <View style={{ flex: 1, minHeight: 0 }}>
              {/* SEARCH & CATEGORY FILTER BAR */}
              <View style={styles.searchCategorySection}>
                <View style={styles.searchBox}>
                  <Text style={{ fontSize: 15 }}>🔍</Text>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by rule, Law number (e.g. Law 36, Beamer, LBW, Helmet)..."
                    placeholderTextColor="#94a3b8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery ? (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Text style={{ fontSize: 14, color: '#94a3b8' }}>✕</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* CATEGORY TABS */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                  {[
                    { key: 'ALL', label: `All Rules (${ALL_RULES_CATALOG.length})` },
                    { key: 'BOWLING', label: '1. Bowling (7)' },
                    { key: 'BATTING', label: '2. Batting (9)' },
                    { key: 'FIELDING', label: '3. Fielding (7)' },
                    { key: 'UMPIRE', label: '4. Umpire (6)' },
                    { key: 'MATCH', label: '5. Match (6)' }
                  ].map(cat => (
                    <TouchableOpacity
                      key={cat.key}
                      style={[styles.categoryTabPill, selectedCategory === cat.key && styles.categoryTabPillActive]}
                      onPress={() => setSelectedCategory(cat.key as CricketRuleCategory)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.categoryTabLabel, selectedCategory === cat.key && styles.categoryTabLabelActive]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* TWO COLUMN / MAIN LAYOUT */}
              <View style={styles.catalogMainRow}>
                {/* LEFT LIST: RULES SELECTOR */}
                <View style={[styles.rulesListPanel, isMobile && { width: '35%' }]}>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {filteredRules.map(rule => {
                      const isSelected = selectedRule.id === rule.id;
                      return (
                        <TouchableOpacity
                          key={rule.id}
                          style={[styles.ruleListItem, isSelected && styles.ruleListItemActive]}
                          onPress={() => setSelectedRuleId(rule.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={{ fontSize: 16 }}>{rule.icon}</Text>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={[styles.ruleListItemName, isSelected && styles.ruleListItemNameActive]} numberOfLines={1}>
                              {rule.name}
                            </Text>
                            <Text style={styles.ruleListItemLaw} numberOfLines={1}>
                              {rule.law.split('/')[0]}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* RIGHT PANEL: COMPREHENSIVE DECISION SUPPORT VIEW */}
                <View style={[styles.ruleDetailPanel, isMobile && { width: '65%' }]}>
                  <ScrollView contentContainerStyle={styles.detailScrollContent} showsVerticalScrollIndicator={false}>
                    {/* TITLE & OFFICIAL BADGES */}
                    <View style={styles.detailHeaderCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: 24 }}>{selectedRule.icon}</Text>
                        <Text style={styles.detailRuleTitle}>{selectedRule.name}</Text>
                        <View style={styles.lawRefBadge}>
                          <Text style={styles.lawRefBadgeText}>{selectedRule.law}</Text>
                        </View>
                      </View>

                      {/* UMPIRE REQUIREMENT PILL */}
                      <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View
                          style={[
                            styles.requirementBadge,
                            selectedRule.umpireRequirement === 'AUTOMATIC_DETECTION'
                              ? styles.badgeAuto
                              : styles.badgeUmpire
                          ]}
                        >
                          <Text style={styles.requirementBadgeText}>
                            {selectedRule.umpireRequirement === 'AUTOMATIC_DETECTION'
                              ? '⚡ AUTOMATIC SYSTEM DETECTION'
                              : '⚖️ UMPIRE CONFIRMATION REQUIRED'}
                          </Text>
                        </View>
                        <View style={styles.categoryBadge}>
                          <Text style={styles.categoryBadgeText}>{selectedRule.category}</Text>
                        </View>
                      </View>

                      <Text style={styles.detailSummary}>{selectedRule.summary}</Text>
                    </View>

                    {/* WHEN THE RULE APPLIES */}
                    <View style={styles.specBox}>
                      <Text style={styles.specBoxTitle}>📌 WHEN THIS RULE APPLIES:</Text>
                      <Text style={styles.specBoxText}>{selectedRule.whenApplies}</Text>
                    </View>

                    {/* STEP-BY-STEP DECISION SEQUENCE */}
                    <View style={styles.decisionSequenceCard}>
                      <Text style={styles.sequenceCardTitle}>📋 STEP-BY-STEP DECISION PROCESS:</Text>
                      {selectedRule.decisionProcess.map((step, sIdx) => (
                        <View key={sIdx} style={styles.sequenceStepRow}>
                          <Text style={styles.stepBulletText}>{step}</Text>
                        </View>
                      ))}
                    </View>

                    {/* VISUAL CRICKET FIELD DIAGRAM */}
                    <View style={styles.diagramWrapper}>
                      <Text style={styles.diagramHeaderTitle}>🎨 OFFICIAL VISUAL DECISION DIAGRAM</Text>
                      {renderRuleDiagram(selectedRule.diagramType, isMobile, {
                        brokenEnd,
                        setBrokenEnd,
                        didBattersCross,
                        setDidBattersCross,
                        calculateRunOutVictim,
                        timedOutSeconds,
                        ruleContext
                      })}
                    </View>

                    {/* SPECIFICATIONS GRID */}
                    <View style={styles.specsGrid}>
                      <View style={styles.specGridItem}>
                        <Text style={styles.specItemLabel}>RUNS & EXTRAS:</Text>
                        <Text style={styles.specItemValue}>{selectedRule.runsExtras}</Text>
                      </View>
                      <View style={styles.specGridItem}>
                        <Text style={styles.specItemLabel}>LEGAL DELIVERY:</Text>
                        <Text style={styles.specItemValue}>{selectedRule.legalBall}</Text>
                      </View>
                      <View style={[styles.specGridItem, { width: '100%' }]}>
                        <Text style={styles.specItemLabel}>DISMISSAL CONSEQUENCES:</Text>
                        <Text style={styles.specItemValue}>{selectedRule.dismissalConsequences}</Text>
                      </View>
                    </View>

                    {/* ACTION CONFIRMATION TRIGGER BUTTON */}
                    {selectedRule.actionPayload && (
                      <TouchableOpacity
                        style={styles.applyActionBtn}
                        onPress={() => setPendingActionRule(selectedRule)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.applyActionBtnText}>
                          ⚖️ Apply Umpire Decision: {selectedRule.name}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                </View>
              </View>
            </View>
          )}

          {/* CONFIRMATION DIALOG MODAL BEFORE APPLYING DECISION */}
          {pendingActionRule && (
            <Modal transparent visible={!!pendingActionRule} animationType="fade">
              <View style={styles.confirmBackdrop}>
                <View style={styles.confirmCard}>
                  <Text style={styles.confirmTitle}>Confirm Umpire Decision</Text>
                  <Text style={styles.confirmSub}>
                    You are applying an official umpire decision under {pendingActionRule.law}:
                  </Text>
                  <View style={styles.confirmDetailBox}>
                    <Text style={styles.confirmDetailItem}>
                      • <Text style={{ fontWeight: 'bold' }}>Decision:</Text> {pendingActionRule.name}
                    </Text>
                    {pendingActionRule.actionPayload?.points ? (
                      <Text style={styles.confirmDetailItem}>
                        • <Text style={{ fontWeight: 'bold' }}>Penalty Runs:</Text> +{pendingActionRule.actionPayload.points} Runs to {pendingActionRule.actionPayload.penaltyAwardedTo || 'Batting Team'}
                      </Text>
                    ) : null}
                    {pendingActionRule.actionPayload?.warningLevel ? (
                      <Text style={styles.confirmDetailItem}>
                        • <Text style={{ fontWeight: 'bold' }}>Disciplinary Level:</Text> {pendingActionRule.actionPayload.warningLevel} (Recorded in Match Audit)
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.confirmActionsRow}>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => setPendingActionRule(null)}
                      disabled={isApplyingAction}
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.confirmBtn}
                      onPress={handleConfirmDecision}
                      disabled={isApplyingAction}
                    >
                      <Text style={styles.confirmBtnText}>
                        {isApplyingAction ? 'Recording...' : '✓ Confirm & Apply Decision'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VISUAL SVG CRICKET FIELD DIAGRAM RENDERER
// ─────────────────────────────────────────────────────────────────────────────
function renderRuleDiagram(diagramType: string, isMobile: boolean, state: any) {
  const { brokenEnd, setBrokenEnd, didBattersCross, setDidBattersCross, calculateRunOutVictim, timedOutSeconds, ruleContext } = state;

  switch (diagramType) {
    case 'FRONT_FOOT':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#15803d" />
            <Rect x="40" y="20" width="380" height="100" fill="#e2d2b5" />
            {/* White Bowling Crease */}
            <Line x1="120" y1="20" x2="120" y2="120" stroke="#ffffff" strokeWidth="4" />
            {/* White Popping Crease */}
            <Line x1="320" y1="20" x2="320" y2="120" stroke="#ffffff" strokeWidth="5" />
            {/* Overstepping Foot */}
            <Rect x="300" y="55" width="55" height="25" rx="6" fill="#ef4444" />
            <Line x1="320" y1="50" x2="320" y2="85" stroke="#fef08a" strokeWidth="2.5" strokeDasharray="3,3" />
            <SvgText x="140" y="45" fill="#1e293b" fontSize="11" fontWeight="bold">Legal Landing Zone (Heel Behind)</SvgText>
            <SvgText x="325" y="105" fill="#b91c1c" fontSize="11" fontWeight="bold">NO BALL (Overstepped Line)</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>HEEL MUST BE GROUNDED OR AIRBORNE BEHIND INNER EDGE OF POPPING CREASE</Text>
        </View>
      );

    case 'BEAMER':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#15803d" />
            <Rect x="40" y="20" width="380" height="100" fill="#e2d2b5" />
            {/* Striker standing */}
            <Circle cx="370" cy="45" r="10" fill="#0284c7" />
            <Line x1="370" y1="55" x2="370" y2="95" stroke="#0284c7" strokeWidth="5" />
            <Line x1="370" y1="95" x2="360" y2="120" stroke="#0284c7" strokeWidth="4" />
            <Line x1="370" y1="95" x2="380" y2="120" stroke="#0284c7" strokeWidth="4" />
            {/* Waist height line */}
            <Line x1="100" y1="75" x2="400" y2="75" stroke="#ef4444" strokeWidth="2" strokeDasharray="4,4" />
            {/* Dangerous Trajectory */}
            <Path d="M 60 85 Q 220 50 365 60" fill="none" stroke="#dc2626" strokeWidth="4" />
            <Circle cx="365" cy="60" r="6" fill="#dc2626" />
            <SvgText x="180" y="45" fill="#b91c1c" fontSize="11" fontWeight="bold">Above Waist Height (Dangerous Beamer)</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>LAW 41.7: 1ST BEAMER = OFFICIAL WARNING • 2ND BEAMER = IMMEDIATE SUSPENSION</Text>
        </View>
      );

    case 'TRAMLINES':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#15803d" />
            <Rect x="50" y="25" width="360" height="90" fill="#e2d2b5" />
            {/* Stumps */}
            <Line x1="380" y1="60" x2="380" y2="80" stroke="#78350f" strokeWidth="6" />
            {/* Tramlines */}
            <Line x1="100" y1="45" x2="380" y2="45" stroke="#3b82f6" strokeWidth="2.5" strokeDasharray="5,4" />
            <Line x1="100" y1="95" x2="380" y2="95" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="5,4" />
            {/* Legal Green Corridor */}
            <Rect x="140" y="47" width="180" height="46" fill="rgba(34, 197, 94, 0.25)" rx="4" />
            <SvgText x="150" y="40" fill="#1d4ed8" fontSize="10" fontWeight="bold">Off Tramline (88.9 cm Wide Zone ➔)</SvgText>
            <SvgText x="150" y="112" fill="#b91c1c" fontSize="10" fontWeight="bold">Leg Tramline (Automatic Wide in T20 ➔)</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>BALL PASSING OUTSIDE TRAMLINES = WIDE + 1 EXTRA RUN + RE-BOWLED</Text>
        </View>
      );

    case 'BOUNCER':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#15803d" />
            <Rect x="40" y="20" width="380" height="100" fill="#e2d2b5" />
            {/* Batter */}
            <Circle cx="370" cy="40" r="10" fill="#0284c7" />
            <Line x1="370" y1="50" x2="370" y2="90" stroke="#0284c7" strokeWidth="5" />
            {/* Shoulder and Head lines */}
            <Line x1="100" y1="52" x2="400" y2="52" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4,4" />
            <Line x1="100" y1="35" x2="400" y2="35" stroke="#ef4444" strokeWidth="2" strokeDasharray="4,4" />
            <SvgText x="120" y="48" fill="#d97706" fontSize="10" fontWeight="bold">Shoulder Height (Max 1 Bouncer/Over)</SvgText>
            <SvgText x="120" y="30" fill="#dc2626" fontSize="10" fontWeight="bold">Head Height (Above Head = Wide)</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>T20 RULE: 1ST BOUNCER LEGAL • 2ND BOUNCER = NO BALL + FREE HIT</Text>
        </View>
      );

    case 'LBW':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#15803d" />
            <Rect x="50" y="20" width="360" height="100" fill="#e2d2b5" />
            {/* 3 Hawk-Eye Stages */}
            <Circle cx="120" cy="70" r="18" fill="#22c55e" />
            <SvgText x="114" y="74" fill="#ffffff" fontSize="12" fontWeight="bold">1</SvgText>
            <Circle cx="230" cy="70" r="18" fill="#22c55e" />
            <SvgText x="224" y="74" fill="#ffffff" fontSize="12" fontWeight="bold">2</SvgText>
            <Circle cx="340" cy="70" r="18" fill="#22c55e" />
            <SvgText x="334" y="74" fill="#ffffff" fontSize="12" fontWeight="bold">3</SvgText>
            <SvgText x="85" y="105" fill="#166534" fontSize="10" fontWeight="bold">1. Pitching (In-Line)</SvgText>
            <SvgText x="195" y="105" fill="#166534" fontSize="10" fontWeight="bold">2. Impact (In-Line)</SvgText>
            <SvgText x="305" y="105" fill="#166534" fontSize="10" fontWeight="bold">3. Hitting Wickets</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>LAW 36: ALL 3 CRITERIA MUST BE SATISFIED WITHOUT PRIOR BAT CONTACT</Text>
        </View>
      );

    case 'RUN_OUT':
      return (
        <View style={styles.diagramBox}>
          {/* Interactive Toggle Buttons */}
          <View style={styles.runOutControls}>
            <View style={{ flex: 1 }}>
              <Text style={styles.controlLabel}>WHICH END WAS BROKEN?</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                <TouchableOpacity
                  style={[styles.toggleBtn, brokenEnd === 'STRIKER' && styles.toggleBtnActive]}
                  onPress={() => setBrokenEnd('STRIKER')}
                >
                  <Text style={[styles.toggleBtnText, brokenEnd === 'STRIKER' && styles.toggleBtnTextActive]}>
                    Striker's End
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, brokenEnd === 'NON_STRIKER' && styles.toggleBtnActive]}
                  onPress={() => setBrokenEnd('NON_STRIKER')}
                >
                  <Text style={[styles.toggleBtnText, brokenEnd === 'NON_STRIKER' && styles.toggleBtnTextActive]}>
                    Bowler's End
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.controlLabel}>DID BATTERS CROSS?</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                <TouchableOpacity
                  style={[styles.toggleBtn, didBattersCross && styles.toggleBtnActive]}
                  onPress={() => setDidBattersCross(true)}
                >
                  <Text style={[styles.toggleBtnText, didBattersCross && styles.toggleBtnTextActive]}>
                    Yes (Crossed)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, !didBattersCross && styles.toggleBtnActive]}
                  onPress={() => setDidBattersCross(false)}
                >
                  <Text style={[styles.toggleBtnText, !didBattersCross && styles.toggleBtnTextActive]}>
                    No (Not Crossed)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Running Track Visual */}
          <Svg width={isMobile ? 300 : 460} height={120} viewBox="0 0 460 120">
            <Rect x="10" y="10" width="440" height="100" rx="8" fill="#15803d" />
            <Rect x="40" y="25" width="380" height="70" fill="#e2d2b5" />
            {/* Creases */}
            <Line x1="100" y1="25" x2="100" y2="95" stroke="#ffffff" strokeWidth="4" />
            <Line x1="360" y1="25" x2="360" y2="95" stroke="#ffffff" strokeWidth="4" />
            {/* Broken End Highlight */}
            {brokenEnd === 'STRIKER' ? (
              <Circle cx="360" cy="60" r="14" fill="#dc2626" />
            ) : (
              <Circle cx="100" cy="60" r="14" fill="#dc2626" />
            )}
            <SvgText x="50" y="55" fill="#0f172a" fontSize="10" fontWeight="bold">Bowler End</SvgText>
            <SvgText x="375" y="55" fill="#0f172a" fontSize="10" fontWeight="bold">Striker End</SvgText>
          </Svg>

          {/* Result Calculation Pill */}
          <View style={styles.runOutResultPill}>
            <Text style={styles.runOutResultPillText}>
              DECISION: <Text style={{ color: '#dc2626', fontWeight: '900' }}>{calculateRunOutVictim()}</Text> IS RUN OUT!
            </Text>
          </View>
        </View>
      );

    case 'POWERPLAY':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            {/* Outer Ground */}
            <Rect x="10" y="10" width="440" height="120" rx="12" fill="#15803d" />
            {/* 30-Yard Inner Oval */}
            <Circle cx="230" cy="70" r="50" fill="#16a34a" stroke="#ffffff" strokeWidth="2.5" strokeDasharray="5,4" />
            {/* Pitch */}
            <Rect x="215" y="45" width="30" height="50" fill="#e2d2b5" rx="3" />
            <SvgText x="175" y="65" fill="#ffffff" fontSize="10" fontWeight="bold">30y Oval</SvgText>
            <SvgText x="35" y="35" fill="#fef08a" fontSize="11" fontWeight="bold">Overs 1–6 (P1): Max 2 Outside</SvgText>
            <SvgText x="35" y="115" fill="#fef08a" fontSize="11" fontWeight="bold">Overs 7–20: Max 5 Outside</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>VIOLATION AT RELEASE = NO BALL + FREE HIT</Text>
        </View>
      );

    case 'TIMED_OUT':
      return (
        <View style={styles.diagramBox}>
          <View style={styles.stopwatchBox}>
            <Text style={styles.stopwatchTime}>{timedOutSeconds}s</Text>
            <Text style={styles.stopwatchLabel}>OFFICIAL 90-SECOND COUNTDOWN TO TAKE CREASE</Text>
          </View>
          <Text style={styles.diagramCaption}>LAW 40: INCOMING BATTER MUST BE AT CREASE READY FOR DELIVERY BEFORE 0s</Text>
        </View>
      );

    default:
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={100} viewBox="0 0 460 100">
            <Rect x="10" y="10" width="440" height="80" rx="8" fill="#1e293b" />
            <Circle cx="230" cy="50" r="22" fill="#005960" />
            <SvgText x="224" y="56" fill="#fef08a" fontSize="18" fontWeight="bold">⚖️</SvgText>
            <SvgText x="135" y="55" fill="#94a3b8" fontSize="11">OFFICIAL MCC 2017 CODE REGULATION</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>DECISION GOVERNED BY OFFICIAL LAWS OF CRICKET & COMPETITION CONDITIONS</Text>
        </View>
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12
  },
  modalCard: {
    width: '92%',
    maxWidth: 1040,
    maxHeight: '90%',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    display: 'flex',
    flexDirection: 'column'
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#005960',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#d97706'
  },
  headerIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(254, 240, 138, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fef08a'
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.3
  },
  headerSubtitle: {
    fontSize: 10.5,
    color: '#99f6e4',
    marginTop: 1
  },
  historyPillBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)'
  },
  historyPillBtnActive: {
    backgroundColor: '#fef08a',
    borderColor: '#d97706'
  },
  historyPillBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff'
  },
  historyPillBtnTextActive: {
    color: '#78350f'
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold'
  },
  // Playing conditions & Monitor
  monitorBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  competitionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  monitorLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5
  },
  compChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  compChipActive: {
    backgroundColor: '#005960',
    borderColor: '#005960'
  },
  compChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569'
  },
  compChipTextActive: {
    color: '#ffffff'
  },
  liveMatchContextStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
    backgroundColor: '#f8fafc',
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexWrap: 'wrap'
  },
  contextItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  contextLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748b'
  },
  contextValue: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0f172a'
  },
  // Search & Categories
  searchCategorySection: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
    gap: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
    padding: 0
  },
  categoryScroll: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8
  },
  categoryTabPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  categoryTabPillActive: {
    backgroundColor: '#005960',
    borderColor: '#005960'
  },
  categoryTabLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569'
  },
  categoryTabLabelActive: {
    color: '#fef08a'
  },
  // Main Catalog Layout
  catalogMainRow: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0
  },
  rulesListPanel: {
    width: '32%',
    maxWidth: 280,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    padding: 6
  },
  ruleListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  ruleListItemActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981'
  },
  ruleListItemName: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#1e293b'
  },
  ruleListItemNameActive: {
    color: '#065f46'
  },
  ruleListItemLaw: {
    fontSize: 9.5,
    color: '#64748b',
    marginTop: 1
  },
  // Rule Detail Panel
  ruleDetailPanel: {
    flex: 1,
    backgroundColor: '#f8fafc',
    minHeight: 0
  },
  detailScrollContent: {
    padding: 14
  },
  detailHeaderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10
  },
  detailRuleTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a'
  },
  lawRefBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  lawRefBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#92400e'
  },
  requirementBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  badgeAuto: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac'
  },
  badgeUmpire: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5'
  },
  requirementBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#0f172a'
  },
  categoryBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#bfdbfe'
  },
  categoryBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#1d4ed8'
  },
  detailSummary: {
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 18,
    marginTop: 8,
    fontWeight: '600'
  },
  specBox: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10
  },
  specBoxTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#475569',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  specBoxText: {
    fontSize: 12,
    color: '#0f172a',
    lineHeight: 16
  },
  decisionSequenceCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10
  },
  sequenceCardTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#166534',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  sequenceStepRow: {
    marginBottom: 4
  },
  stepBulletText: {
    fontSize: 11.5,
    color: '#14532d',
    lineHeight: 17,
    fontWeight: '600'
  },
  diagramWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
    alignItems: 'center'
  },
  diagramHeaderTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 8,
    alignSelf: 'flex-start'
  },
  diagramBox: {
    alignItems: 'center',
    width: '100%'
  },
  diagramCaption: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#475569',
    marginTop: 6,
    textAlign: 'center'
  },
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12
  },
  specGridItem: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  specItemLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 2
  },
  specItemValue: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0f172a'
  },
  applyActionBtn: {
    backgroundColor: '#005960',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#d97706',
    marginTop: 4
  },
  applyActionBtnText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.3
  },
  // Confirmation Modal
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  confirmCard: {
    width: '90%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8
  },
  confirmTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 4
  },
  confirmSub: {
    fontSize: 11.5,
    color: '#475569',
    lineHeight: 16,
    marginBottom: 10
  },
  confirmDetailBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14
  },
  confirmDetailItem: {
    fontSize: 11.5,
    color: '#1e293b',
    lineHeight: 18
  },
  confirmActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f1f5f9'
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569'
  },
  confirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#005960'
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff'
  },
  // History View
  historyContainer: {
    padding: 14
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a'
  },
  refreshBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#e2e8f0'
  },
  refreshBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155'
  },
  historySub: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 10
  },
  emptyHistoryBox: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 10
  },
  emptyHistoryTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#334155',
    marginTop: 8
  },
  emptyHistorySub: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16
  },
  historyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8
  },
  historyCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  historyDecisionType: {
    fontSize: 12,
    fontWeight: '800',
    color: '#005960'
  },
  historyTimestamp: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '700'
  },
  historyDesc: {
    fontSize: 11.5,
    color: '#1e293b',
    lineHeight: 16
  },
  historyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  historyOfficial: {
    fontSize: 9.5,
    color: '#64748b',
    fontWeight: '600'
  },
  historyId: {
    fontSize: 9,
    color: '#94a3b8'
  },
  // Specific Diagram Interactive Sub-styles
  runOutControls: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    width: '100%'
  },
  controlLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#475569'
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  toggleBtnActive: {
    backgroundColor: '#005960',
    borderColor: '#005960'
  },
  toggleBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155'
  },
  toggleBtnTextActive: {
    color: '#ffffff'
  },
  runOutResultPill: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 6
  },
  runOutResultPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#991b1b'
  },
  stopwatchBox: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    width: '100%'
  },
  stopwatchTime: {
    fontSize: 36,
    fontWeight: '900',
    color: '#ef4444',
    letterSpacing: 2
  },
  stopwatchLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    marginTop: 4
  }
});
