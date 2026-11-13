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
  competitionVariation?: string | null;
  actionPayload?: {
    actionType: string;
    points?: number;
    penaltyAwardedTo?: 'BATTING' | 'FIELDING';
    warningLevel?: 'FIRST_WARNING' | 'SUSPENSION';
    description?: string;
  };
}

export interface CompetitionRuleOverride {
  law?: string;
  summary?: string;
  decisionProcess?: string[];
  runsExtras?: string;
  legalBall?: string;
  dismissalConsequences?: string;
  variationNotice: string;
  listTag?: string;
}

export interface CompetitionFormatConfig {
  name: string;
  authority: string;
  formatTitle: string;
  bouncerLimit: string;
  bouncersAllowedPerOver: number | 'SUBJECTIVE';
  freeHitActive: boolean;
  bowlerMaxQuota: string;
  timedOutSeconds: number;
  badge: string;
  description: string;
  rulesModifications: Record<string, CompetitionRuleOverride>;
}

export const COMPETITION_CONFIGS: Record<CompetitionFormat, CompetitionFormatConfig> = {
  ICC_T20: {
    name: 'ICC T20 International',
    authority: 'International Cricket Council (ICC Men\'s T20I Playing Conditions)',
    formatTitle: 'ICC T20 International (20.0 Ov)',
    bouncerLimit: '1 Bouncer / Over',
    bouncersAllowedPerOver: 1,
    freeHitActive: true,
    bowlerMaxQuota: '4.0 Ov (20% Max)',
    timedOutSeconds: 90,
    badge: 'ICC Men\'s T20I Regulations Active',
    description: '1 short-pitched bouncer per over (2nd is No Ball + Free Hit). Max 4.0 overs per bowler. Mandatory Free Hit on all No Balls. Strict 90s incoming batter timer.',
    rulesModifications: {
      BOUNCER_LIMIT: {
        law: 'ICC T20 Clause 41.6.1.1',
        summary: 'Maximum of ONE short-pitched delivery above shoulder level allowed per over. A second bouncer in the same over is called No Ball + Free Hit + Umpire Warning.',
        decisionProcess: [
          '1. Umpire signals 1 bouncer used for the over (one hand tapping shoulder).',
          '2. If bowler delivers second bouncer in same over: Call & signal No Ball immediately.',
          '3. Award +1 No Ball penalty run to batting team and signal Free Hit for next delivery.',
          '4. Standing umpire issues official first caution to the bowler.'
        ],
        variationNotice: 'ICC T20 Clause 41.6: Exactly 1 bouncer permitted per over. 2nd bouncer is a No Ball + Free Hit.',
        listTag: '1 Bouncer'
      },
      FREE_HIT: {
        law: 'ICC T20 Clause 21.19',
        summary: 'Mandatory Free Hit awarded to batting side for ALL forms of No Ball (front-foot overstep, waist-high full toss, bouncer limit exceed, fielding restriction breach).',
        variationNotice: 'ICC Clause 21.19: Mandatory Free Hit on all No Balls with dismissal immunity.',
        listTag: 'Mandatory FH'
      },
      BOWLER_OVER_LIMIT: {
        law: 'ICC T20 Clause 13.8.1',
        summary: 'In an uninterrupted 20-over match, no bowler may bowl more than 4 overs (20% of total innings overs).',
        variationNotice: 'ICC T20 Quota: Maximum 4.0 overs per bowler (20% innings limit).',
        listTag: 'Max 4 Ov'
      },
      TIMED_OUT: {
        law: 'ICC T20 Clause 31.1.1',
        summary: 'Incoming batter must be in position to take guard or for non-striker to be ready within 90 seconds of the fall of previous wicket.',
        variationNotice: 'ICC T20 Clock: Strict 90 seconds timer for incoming batter.',
        listTag: '90s Limit'
      },
      SLOW_OVER_RATE: {
        law: 'ICC T20 Clause 12.8 & Clause 41',
        summary: 'In-match penalty: If final over not commenced by cut-off time, one additional fielder must be brought inside the 30-yard circle (max 4 outside instead of 5).',
        variationNotice: 'ICC In-Match Penalty: Additional fielder brought inside 30-yard circle + stop clock rules.',
        listTag: 'Stop Clock'
      }
    }
  },
  BCCI_DOMESTIC: {
    name: 'BCCI Domestic (SMAT)',
    authority: 'Board of Control for Cricket in India (Syed Mushtaq Ali Trophy)',
    formatTitle: 'BCCI SMAT Domestic (20.0 Ov)',
    bouncerLimit: '2 Bouncers / Over',
    bouncersAllowedPerOver: 2,
    freeHitActive: true,
    bowlerMaxQuota: '4.0 Ov (SMAT)',
    timedOutSeconds: 90,
    badge: 'BCCI SMAT Regulations: 2 Bouncers Per Over Allowed',
    description: 'BCCI Clause 41.6 allows TWO short-pitched bouncers per over (3rd is No Ball + Free Hit). Impact Player substitutions permitted. Mandatory Free Hit on No Balls.',
    rulesModifications: {
      BOUNCER_LIMIT: {
        law: 'BCCI Domestic (SMAT) Clause 41.6',
        summary: 'BCCI Syed Mushtaq Ali Trophy permits TWO short-pitched deliveries per over! Bowlers can deliver 2 bouncers before incurring a penalty. A third bouncer is called No Ball + Free Hit.',
        decisionProcess: [
          '1. Umpire signals 1 bouncer used after first short-pitched ball above shoulder (one hand on shoulder).',
          '2. Umpire signals 2 bouncers used after second short-pitched ball (two fingers on shoulder).',
          '3. If bowler delivers a third bouncer in same over: Call & signal No Ball immediately.',
          '4. Award +1 No Ball penalty run, signal Free Hit for next delivery, and caution bowler.'
        ],
        variationNotice: '⚡ BCCI SMAT SPECIAL: 2 bouncers per over are legally permitted! Only 3rd bouncer is a No Ball + Free Hit.',
        listTag: '⚡ 2 Bouncers'
      },
      FREE_HIT: {
        law: 'BCCI Domestic Clause 21.19',
        summary: 'Mandatory Free Hit on all No Balls. Batter cannot be dismissed except run out, hit the ball twice, or obstructing the field.',
        variationNotice: 'BCCI Rule: Free Hit active for all No Balls.',
        listTag: 'Free Hit'
      },
      BOWLER_OVER_LIMIT: {
        law: 'BCCI Domestic Clause 13.8',
        summary: 'Maximum 4.0 overs per bowler. If an Impact Player is introduced to bowl, they may bowl up to 4 overs provided they have not already bowled.',
        variationNotice: 'BCCI Rule: Max 4 overs per bowler; Impact Player quota provisions apply.',
        listTag: 'Impact Quota'
      },
      TIMED_OUT: {
        law: 'BCCI Domestic Clause 31.1',
        summary: 'Incoming batter has 90 seconds to take guard at the crease.',
        variationNotice: 'BCCI T20 Clock: 90 seconds limit for incoming batter.',
        listTag: '90s Limit'
      },
      DLS_METHOD: {
        law: 'BCCI VJD / DLS Playing Conditions',
        summary: 'BCCI matches may employ the VJD (V. Jayadevan) System or DLS for target recalculation during rain interruptions.',
        variationNotice: 'BCCI Rain Rule: VJD Method or DLS standard adopted by BCCI match operations.',
        listTag: 'VJD / DLS'
      }
    }
  },
  MCC_TRADITIONAL: {
    name: 'MCC 42 Laws',
    authority: 'Marylebone Cricket Club (MCC Laws of Cricket - 2017 Code 4th Edition 2026)',
    formatTitle: 'MCC 42 Laws (Multi-Day / Unlimited Ov)',
    bouncerLimit: 'Law 41.6 Discretion',
    bouncersAllowedPerOver: 'SUBJECTIVE',
    freeHitActive: false,
    bowlerMaxQuota: 'Unlimited (Law 13)',
    timedOutSeconds: 180,
    badge: 'Pure MCC 42 Laws Code (No Limited-Overs Modifications)',
    description: 'Pure Marylebone Cricket Club Code: Unlimited overs per bowler (Law 13). NO Free Hit (Law 21). Bouncer aggression judged subjectively by umpire under Law 41.6. 180s timed out.',
    rulesModifications: {
      BOUNCER_LIMIT: {
        law: 'MCC Law 41.6 (Dangerous & Unfair Bowling)',
        summary: 'In pure MCC Laws, there is NO fixed mechanical limit of 1 or 2 bouncers. Bowling of short-pitched deliveries is governed by umpire subjective judgment of safety, intimidation, and repeat aggression.',
        decisionProcess: [
          '1. Standing umpire assesses whether repetition of short-pitched deliveries is dangerous and unfair based on relative skill of striker.',
          '2. If judged dangerous: Umpire calls & signals Dead Ball or No Ball.',
          '3. Umpire cautions bowler and informs bowling captain.',
          '4. Second offense: Final warning. Third offense: Suspend bowler from bowling for remainder of innings.'
        ],
        runsExtras: '+1 No Ball run (NO Free Hit awarded in pure MCC Laws)',
        variationNotice: '🏛️ MCC PURE CODE: No mechanical bouncer limit. Governed entirely by standing umpire discretion under Law 41.6. No Free Hit.',
        listTag: '🏛️ Law 41.6'
      },
      FREE_HIT: {
        law: 'MCC Law 21 (No Ball - Pure Code)',
        summary: '⚠️ FREE HIT DOES NOT EXIST in the MCC 42 Laws! Free Hit is strictly an ICC / Board limited-overs tournament playing condition. Under pure MCC Law 21, a No Ball incurs a 1-run penalty and must be re-bowled, with normal dismissal laws applying next ball.',
        runsExtras: '+1 penalty run only (Delivery must be re-bowled)',
        decisionProcess: [
          '1. Umpire calls & signals No Ball for front-foot or illegal delivery.',
          '2. Award +1 extra run to the batting team.',
          '3. Delivery does NOT count as a legal ball and must be re-bowled.',
          '4. Standard dismissal rules apply on the next ball (NO Free Hit).'
        ],
        dismissalConsequences: 'Standard dismissals apply on subsequent delivery. Free Hit does not exist in MCC Code.',
        variationNotice: '🚫 PURE MCC LAWS NOTICE: Law 21 does NOT contain Free Hits. Free Hit is a limited-overs tournament condition only.',
        listTag: '🚫 No Free Hit'
      },
      BOWLER_OVER_LIMIT: {
        law: 'MCC Law 13 (The Over)',
        summary: 'Under MCC Law 13, there is NO limit to how many overs a bowler may bowl in an innings. The only restriction is Law 13.7: a bowler shall not bowl two consecutive overs, or parts thereof, in the same innings.',
        decisionProcess: [
          '1. Bowler may bowl as many overs as captain assigns throughout innings.',
          '2. Check Law 13.7: Bowler must not bowl two consecutive overs from either end.',
          '3. Umpire ensures bowler changes ends after an over completes.'
        ],
        runsExtras: '0 runs',
        variationNotice: '🏛️ MCC PURE CODE: Unlimited overs per bowler. Law 13.7 strictly prohibits consecutive overs only.',
        listTag: '🏛️ Unlimited'
      },
      TIMED_OUT: {
        law: 'MCC Law 31.1 (Timed Out)',
        summary: 'Incoming batter is allowed 3 minutes (180 seconds) from dismissal of previous wicket to step onto the field and be ready to receive ball.',
        decisionProcess: [
          '1. Previous wicket falls or batter retires.',
          '2. Official 3-minute (180s) timer starts.',
          '3. If incoming batter fails to take crease ready to receive ball within 3 minutes: Bowler team appeals.',
          '4. Umpire upholds appeal: Batter dismissed Timed Out.'
        ],
        variationNotice: 'MCC Law 31.1: 3 minutes (180 seconds) allowed for incoming batter in multi-day cricket.',
        listTag: '180s Clock'
      },
      POWERPLAY_RESTRICTIONS: {
        law: 'MCC Law 28 (The Fielder)',
        summary: 'MCC Law 28 does NOT define a 30-yard fielding circle or powerplays. Only Law 28.4 applies: at the instant of delivery, there shall not be more than 2 fielders on the leg side behind the popping crease.',
        decisionProcess: [
          '1. Umpire checks field placement at instant of bowler delivery stride.',
          '2. Verify no more than 2 fielders behind popping crease on leg side (Law 28.4).',
          '3. If breached: Call & signal No Ball immediately.'
        ],
        variationNotice: '🏛️ MCC PURE CODE: No 30-yard circle or powerplays exist in pure Law 28. Only leg-side 2-fielder limit behind crease.',
        listTag: '🏛️ Law 28.4'
      },
      SUPER_OVER: {
        law: 'MCC Law 16 (The Result)',
        summary: 'Under MCC Law 16, a match where scores are equal upon completion of play is officially declared a TIE. Super Overs are tournament playing conditions not part of the fundamental 42 Laws.',
        variationNotice: '🏛️ MCC PURE CODE: Result is recorded as a Tie or Draw under Law 16.',
        listTag: '🏛️ Law 16 Tie'
      },
      DLS_METHOD: {
        law: 'MCC Law 16.1 & 16.2',
        summary: 'Pure MCC laws do not include algorithmic target adjustments like DLS. Rain interruptions are governed by agreed playing hours and intervals.',
        variationNotice: '🏛️ MCC PURE CODE: Law 16 provides for agreed match duration without algorithmic target recalculation.',
        listTag: '🏛️ Law 16'
      }
    }
  },
  TNCA_LEAGUE: {
    name: 'TNCA League Conditions',
    authority: 'Tamil Nadu Cricket Association (TNCA League Bylaws & Division Rules)',
    formatTitle: 'TNCA League Division (20.0 Ov)',
    bouncerLimit: '1 Bouncer / Over',
    bouncersAllowedPerOver: 1,
    freeHitActive: true,
    bowlerMaxQuota: '4.0 Ov (Division Limit)',
    timedOutSeconds: 120,
    badge: 'TNCA League Regulations Active (Strict Conduct Codes)',
    description: 'TNCA Sanctioned League Rules: 1 short-pitched bouncer per over. Max 4.0 overs per bowler. Mandatory Free Hit. 120s incoming batter limit. Disciplinary violations reported to TNCA Honorary Secretary.',
    rulesModifications: {
      BOUNCER_LIMIT: {
        law: 'TNCA League Clause 41.6',
        summary: 'In TNCA Sanctioned League matches, maximum of ONE short-pitched delivery above shoulder allowed per over. Second bouncer called No Ball + Free Hit + formal umpire caution.',
        decisionProcess: [
          '1. Umpire signals 1 bouncer used for the over (one hand on shoulder).',
          '2. If second bouncer delivered in same over: Call & signal No Ball.',
          '3. Award +1 No Ball penalty run and activate Free Hit for next delivery.',
          '4. Umpires log incident in TNCA Match Operations report.'
        ],
        variationNotice: 'TNCA League Rule: Exactly 1 bouncer permitted per over. 2nd is No Ball + Free Hit.',
        listTag: 'TNCA 1 Bouncer'
      },
      FREE_HIT: {
        law: 'TNCA League Playing Condition 21.19',
        summary: 'Mandatory Free Hit on all No Balls in TNCA limited-overs league matches. Batter immune from Bowled, Caught, LBW, Stumped, Hit Wicket.',
        variationNotice: 'TNCA League: Free Hit active for all No Balls.',
        listTag: 'Free Hit'
      },
      BOWLER_OVER_LIMIT: {
        law: 'TNCA League Bylaw 13.8',
        summary: 'In 20-over league matches, no bowler may bowl more than 4 overs (in 50-over league matches, quota is 10 overs).',
        variationNotice: 'TNCA Division Limit: 4.0 overs per bowler in 20-over matches (10.0 in 50-over league).',
        listTag: 'TNCA 4 Ov'
      },
      TIMED_OUT: {
        law: 'TNCA League Clause 31.1',
        summary: 'Incoming batter must be ready to take guard within 120 seconds (2 minutes) of previous wicket falling.',
        decisionProcess: [
          '1. Previous batter dismissed.',
          '2. 120-second (2 min) stopwatch countdown begins.',
          '3. Incoming batter must step onto the pitch and be ready within 120 seconds.',
          '4. If batter exceeds 120s without umpire permission: Umpire upholds appeal for Timed Out.'
        ],
        variationNotice: 'TNCA League Clock: 120 seconds (2 minutes) incoming batter time limit.',
        listTag: '120s Clock'
      },
      PLAYER_MISCONDUCT: {
        law: 'TNCA Code of Conduct Level 1-4',
        summary: 'In addition to MCC Law 42 penalty runs, all Level 1-4 breaches must be formally reported on official TNCA disciplinary scoresheets for review by TNCA Disciplinary Committee.',
        variationNotice: 'TNCA Conduct Rule: Incident report submitted directly to TNCA Disciplinary Board.',
        listTag: 'TNCA Conduct'
      }
    }
  }
};

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

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      (window as any).__SELECT_RULE__ = (ruleId: string) => {
        setSelectedRuleId(ruleId);
      };
    }
  }, []);

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
      const initialSeconds = COMPETITION_CONFIGS[competitionFormat].timedOutSeconds;
      setTimedOutSeconds(initialSeconds);
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
    const baseRule = ALL_RULES_CATALOG.find(r => r.id === selectedRuleId) || ALL_RULES_CATALOG[0];
    const compConfig = COMPETITION_CONFIGS[competitionFormat];
    const mod = compConfig.rulesModifications?.[baseRule.id];
    if (!mod) {
      return {
        ...baseRule,
        competitionVariation: null
      };
    }
    return {
      ...baseRule,
      law: mod.law || baseRule.law,
      summary: mod.summary || baseRule.summary,
      decisionProcess: mod.decisionProcess || baseRule.decisionProcess,
      runsExtras: mod.runsExtras || baseRule.runsExtras,
      legalBall: mod.legalBall || baseRule.legalBall,
      dismissalConsequences: mod.dismissalConsequences || baseRule.dismissalConsequences,
      competitionVariation: mod.variationNotice
    };
  }, [selectedRuleId, competitionFormat]);

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

            {/* ACTIVE COMPETITION REGULATIONS SUMMARY BANNER */}
            <View style={styles.competitionSummaryBar}>
              <View style={styles.competitionBadgeTag}>
                <Text style={styles.competitionBadgeTagText}>
                  {COMPETITION_CONFIGS[competitionFormat].badge}
                </Text>
              </View>
              <Text style={styles.competitionSummaryText}>
                {COMPETITION_CONFIGS[competitionFormat].description}
              </Text>
            </View>

            {/* REAL-TIME MATCH CONTEXT STRIP */}
            <View style={styles.liveMatchContextStrip}>
              <View style={styles.contextItem}>
                <Text style={styles.contextLabel}>FORMAT:</Text>
                <Text style={styles.contextValue}>
                  {COMPETITION_CONFIGS[competitionFormat].formatTitle}
                </Text>
              </View>
              {ruleContext.bowlerName && (
                <View style={styles.contextItem}>
                  <Text style={styles.contextLabel}>BOWLER:</Text>
                  <Text style={styles.contextValue}>
                    {ruleContext.bowlerName} ({ruleContext.oversBowled || '0.0'}
                    {competitionFormat === 'MCC_TRADITIONAL'
                      ? ' Ov • Unlimited'
                      : `/${COMPETITION_CONFIGS[competitionFormat].bowlerMaxQuota}`}
                    )
                  </Text>
                </View>
              )}
              <View style={styles.contextItem}>
                <Text style={styles.contextLabel}>BOUNCER LIMIT:</Text>
                <Text
                  style={[
                    styles.contextValue,
                    {
                      color:
                        competitionFormat === 'BCCI_DOMESTIC'
                          ? '#d97706'
                          : competitionFormat === 'MCC_TRADITIONAL'
                          ? '#7c3aed'
                          : '#0284c7'
                    }
                  ]}
                >
                  {COMPETITION_CONFIGS[competitionFormat].bouncerLimit}
                </Text>
              </View>
              <View style={styles.contextItem}>
                <Text style={styles.contextLabel}>FREE HIT:</Text>
                <Text
                  style={[
                    styles.contextValue,
                    {
                      color: !COMPETITION_CONFIGS[competitionFormat].freeHitActive
                        ? '#dc2626'
                        : ruleContext.count
                        ? '#dc2626'
                        : '#16a34a'
                    }
                  ]}
                >
                  {!COMPETITION_CONFIGS[competitionFormat].freeHitActive
                    ? '🚫 Inactive (Not in MCC Code)'
                    : ruleContext.count
                    ? '⚡ Active'
                    : 'Normal (Active on NB)'}
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
                      const compMod = COMPETITION_CONFIGS[competitionFormat]?.rulesModifications?.[rule.id];
                      return (
                        <TouchableOpacity
                          key={rule.id}
                          style={[styles.ruleListItem, isSelected && styles.ruleListItemActive]}
                          onPress={() => setSelectedRuleId(rule.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={{ fontSize: 16 }}>{rule.icon}</Text>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                              <Text style={[styles.ruleListItemName, isSelected && styles.ruleListItemNameActive]} numberOfLines={1}>
                                {rule.name}
                              </Text>
                              {compMod?.listTag && (
                                <View style={styles.compModTag}>
                                  <Text style={styles.compModTagText}>{compMod.listTag}</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.ruleListItemLaw} numberOfLines={1}>
                              {compMod?.law ? compMod.law.split('/')[0] : rule.law.split('/')[0]}
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

                      {/* UMPIRE REQUIREMENT PILL & ACTIVE COMPETITION BADGE */}
                      <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
                        <View style={styles.activeCompBadge}>
                          <Text style={styles.activeCompBadgeText}>
                            🏆 {COMPETITION_CONFIGS[competitionFormat].name}
                          </Text>
                        </View>
                      </View>

                      {/* COMPETITION VARIATION NOTICE BANNER (if modified) */}
                      {selectedRule.competitionVariation && (
                        <View style={styles.compVariationBanner}>
                          <Text style={styles.compVariationIcon}>⚡</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.compVariationTitle}>
                              {COMPETITION_CONFIGS[competitionFormat].name.toUpperCase()} RULE ADAPTATION:
                            </Text>
                            <Text style={styles.compVariationDesc}>{selectedRule.competitionVariation}</Text>
                          </View>
                        </View>
                      )}

                      <Text style={styles.detailSummary}>{selectedRule.summary}</Text>
                    </View>

                    {/* VISUAL CRICKET FIELD DIAGRAM (Positioned immediately after heading & summary) */}
                    <View style={styles.diagramWrapper}>
                      <Text style={styles.diagramHeaderTitle}>🎨 OFFICIAL VISUAL DECISION DIAGRAM</Text>
                      {renderRuleDiagram(selectedRule.diagramType, isMobile, {
                        brokenEnd,
                        setBrokenEnd,
                        didBattersCross,
                        setDidBattersCross,
                        calculateRunOutVictim,
                        timedOutSeconds,
                        competitionFormat,
                        ruleContext
                      })}
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
  const { brokenEnd, setBrokenEnd, didBattersCross, setDidBattersCross, calculateRunOutVictim, timedOutSeconds, competitionFormat, ruleContext } = state;

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

    case 'BOUNCER': {
      const isBcci = competitionFormat === 'BCCI_DOMESTIC';
      const isMcc = competitionFormat === 'MCC_TRADITIONAL';
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill={isBcci ? '#14532d' : isMcc ? '#312e81' : '#15803d'} />
            <Rect x="40" y="20" width="380" height="100" fill="#e2d2b5" />
            {/* Batter */}
            <Circle cx="370" cy="40" r="10" fill="#0284c7" />
            <Line x1="370" y1="50" x2="370" y2="90" stroke="#0284c7" strokeWidth="5" />
            {/* Shoulder and Head lines */}
            <Line x1="100" y1="52" x2="400" y2="52" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4,4" />
            <Line x1="100" y1="35" x2="400" y2="35" stroke="#ef4444" strokeWidth="2" strokeDasharray="4,4" />
            <SvgText x="110" y="48" fill="#d97706" fontSize="10" fontWeight="bold">
              {isBcci
                ? 'Shoulder Height (BCCI SMAT: Max 2 Bouncers/Over)'
                : isMcc
                ? 'Shoulder Height (MCC: Law 41.6 Umpire Discretion)'
                : 'Shoulder Height (Max 1 Bouncer/Over)'}
            </SvgText>
            <SvgText x="110" y="30" fill="#dc2626" fontSize="10" fontWeight="bold">Head Height (Above Head = Wide)</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>
            {isBcci
              ? 'BCCI SMAT SPECIAL: 2 BOUNCERS LEGAL PER OVER • 3RD BOUNCER = NO BALL + FREE HIT'
              : isMcc
              ? 'MCC LAW 41.6: NO MECHANICAL LIMIT • GOVERNED BY UMPIRE DANGER ASSESSMENT'
              : 'T20 RULE: 1ST BOUNCER LEGAL • 2ND BOUNCER = NO BALL + FREE HIT'}
          </Text>
        </View>
      );
    }

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

    case 'POWERPLAY': {
      const isMccPowerplay = competitionFormat === 'MCC_TRADITIONAL';
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            {/* Outer Ground */}
            <Rect x="10" y="10" width="440" height="120" rx="12" fill="#15803d" />
            {/* 30-Yard Inner Oval */}
            <Circle cx="230" cy="70" r="50" fill="#16a34a" stroke="#ffffff" strokeWidth="2.5" strokeDasharray={isMccPowerplay ? '3,3' : '5,4'} />
            {/* Pitch */}
            <Rect x="215" y="45" width="30" height="50" fill="#e2d2b5" rx="3" />
            {isMccPowerplay ? (
              <>
                <SvgText x="90" y="32" fill="#fef08a" fontSize={11} fontWeight="bold">
                  MCC LAW 28: NO 30-YARD POWERPLAY CIRCLE
                </SvgText>
                <SvgText x="50" y="115" fill="#ffffff" fontSize={10} fontWeight="bold">
                  Pure Law 28.4: Max 2 fielders behind popping crease on leg side at release
                </SvgText>
              </>
            ) : (
              <>
                <SvgText x="175" y="65" fill="#ffffff" fontSize={10} fontWeight="bold">30y Oval</SvgText>
                <SvgText x="35" y="35" fill="#fef08a" fontSize={11} fontWeight="bold">Overs 1–6 (P1): Max 2 Outside</SvgText>
                <SvgText x="35" y="115" fill="#fef08a" fontSize={11} fontWeight="bold">Overs 7–20: Max 5 Outside</SvgText>
              </>
            )}
          </Svg>
          <Text style={styles.diagramCaption}>
            {isMccPowerplay
              ? 'MCC CODE LAW 28: POWERPLAY IS A LIMITED-OVERS PLAYING CONDITION, NOT IN PURE LAWS'
              : 'VIOLATION AT RELEASE = NO BALL + FREE HIT'}
          </Text>
        </View>
      );
    }

    case 'TIMED_OUT': {
      const isMcc = competitionFormat === 'MCC_TRADITIONAL';
      const isTnca = competitionFormat === 'TNCA_LEAGUE';
      const label = isMcc
        ? 'OFFICIAL 180-SECOND (3-MIN) COUNTDOWN (MCC LAW 31.1)'
        : isTnca
        ? 'OFFICIAL 120-SECOND (2-MIN) COUNTDOWN (TNCA LEAGUE)'
        : 'OFFICIAL 90-SECOND COUNTDOWN (ICC & BCCI T20 CLAUSE 31.1)';
      return (
        <View style={styles.diagramBox}>
          <View style={styles.stopwatchBox}>
            <Text style={styles.stopwatchTime}>{timedOutSeconds}s</Text>
            <Text style={styles.stopwatchLabel}>{label}</Text>
          </View>
          <Text style={styles.diagramCaption}>LAW 31: INCOMING BATTER MUST BE AT CREASE READY FOR DELIVERY BEFORE 0s</Text>
        </View>
      );
    }

    case 'DANGEROUS':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#15803d" />
            <Rect x="40" y="25" width="380" height="90" fill="#e2d2b5" />
            <Circle cx="80" cy="70" r="12" fill="#0369a1" />
            <Line x1="80" y1="82" x2="80" y2="105" stroke="#0369a1" strokeWidth="4" />
            <Path d="M 95 65 Q 240 30 365 55" fill="none" stroke="#dc2626" strokeWidth="3.5" strokeDasharray="5,3" />
            <Circle cx="365" cy="55" r="7" fill="#dc2626" />
            <Circle cx="385" cy="50" r="10" fill="#f59e0b" />
            <Line x1="385" y1="60" x2="385" y2="100" stroke="#f59e0b" strokeWidth="4" />
            <Rect x="145" y="32" width="80" height="26" rx="4" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5" />
            <SvgText x="151" y="49" fill="#854d0e" fontSize="9.5" fontWeight="bold">1st: Warning</SvgText>
            <Rect x="235" y="32" width="90" height="26" rx="4" fill="#fee2e2" stroke="#dc2626" strokeWidth="1.5" />
            <SvgText x="241" y="49" fill="#991b1b" fontSize="9.5" fontWeight="bold">2nd: Suspension</SvgText>
            <SvgText x="120" y="105" fill="#7f1d1d" fontSize="10" fontWeight="bold">Repeated High Full Toss or Dangerous Short Balls</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>LAW 41.6 / 41.7: 1ST OFFENSE = OFFICIAL WARNING • 2ND OFFENSE = BOWLER SUSPENDED FOR INNINGS</Text>
        </View>
      );

    case 'ACTION':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#0f172a" />
            <Circle cx="230" cy="90" r="60" fill="none" stroke="#334155" strokeWidth="2" strokeDasharray="4,4" />
            <Circle cx="230" cy="90" r="8" fill="#38bdf8" />
            <Path d="M 230 90 L 230 30" stroke="#22c55e" strokeWidth="4" />
            <Path d="M 230 90 L 245 32" stroke="#22c55e" strokeWidth="3" strokeDasharray="3,3" />
            <Path d="M 230 90 L 285 45" stroke="#ef4444" strokeWidth="4" />
            <SvgText x="110" y="35" fill="#22c55e" fontSize="11" fontWeight="bold">✓ ≤ 15° Legal Extension</SvgText>
            <SvgText x="290" y="45" fill="#ef4444" fontSize="11" fontWeight="bold">✕ &gt; 15° Throw (Chucking)</SvgText>
            <SvgText x="120" y="118" fill="#94a3b8" fontSize="10">Umpire calls No Ball + reports bowler action to match referee</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>MCC LAW 21.2 & ICC REGULATION: ELBOW EXTENSION MUST NOT EXCEED 15 DEGREES AT RELEASE</Text>
        </View>
      );

    case 'QUOTA': {
      const isMccQuota = competitionFormat === 'MCC_TRADITIONAL';
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill={isMccQuota ? '#1e1b4b' : '#0f2452'} />
            <SvgText x={isMccQuota ? 60 : 130} y="32" fill="#fef08a" fontSize={11} fontWeight="bold">
              {isMccQuota
                ? 'MCC LAW 13: UNLIMITED BOWLER OVERS (NO QUOTA IN PURE CODE)'
                : 'BOWLER QUOTA METER (20-OVER T20: MAX 4.0 OVERS)'}
            </SvgText>
            {isMccQuota ? (
              <G>
                <Rect x="60" y="44" width="340" height="42" rx="6" fill="#312e81" />
                <SvgText x="85" y="66" fill="#ffffff" fontSize={11} fontWeight="bold">
                  ✓ Unlimited overs allowed per bowler in multi-day matches
                </SvgText>
                <SvgText x="90" y="80" fill="#c7d2fe" fontSize={9.5}>
                  Law 13.7 restriction: Bowler cannot bowl consecutive overs from either end
                </SvgText>
              </G>
            ) : (
              [1, 2, 3, 4].map((ov, idx) => (
                <G key={idx}>
                  <Rect x={65 + idx * 85} y="44" width="75" height="42" rx="6" fill={idx < 3 ? '#22c55e' : '#ef4444'} />
                  <SvgText x={80 + idx * 85} y="64" fill="#ffffff" fontSize="11" fontWeight="bold">Over {ov}</SvgText>
                  <SvgText x={75 + idx * 85} y="78" fill="#ffffff" fontSize="8.5">{idx < 3 ? 'Completed' : 'MAX QUOTA'}</SvgText>
                </G>
              ))
            )}
            <Rect x="60" y="98" width="340" height="22" rx="4" fill={isMccQuota ? 'rgba(99, 102, 241, 0.25)' : 'rgba(239, 68, 68, 0.25)'} stroke={isMccQuota ? '#818cf8' : '#ef4444'} strokeWidth={1} />
            <SvgText x={isMccQuota ? 75 : 95} y="113" fill={isMccQuota ? '#e0e7ff' : '#fca5a5'} fontSize={10} fontWeight="bold">
              {isMccQuota
                ? 'ℹ️ MCC 42 Laws enforce consecutive overs rule (Law 13.7) only'
                : '⚠️ Over limit reached: Bowler cannot bowl again in this innings'}
            </SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>
            {isMccQuota
              ? 'MCC LAW 13: BOWLER MAY BOWL WITHOUT QUOTA RESTRICTIONS (ONLY CONSECUTIVE RESTRICTED)'
              : 'ICC T20 CLAUSE 13.8: NO BOWLER MAY BOWL MORE THAN 20% OF TOTAL SCHEDULED INNINGS OVERS'}
          </Text>
        </View>
      );
    }

    case 'HIT_WICKET':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#15803d" />
            <Rect x="40" y="25" width="380" height="90" fill="#e2d2b5" />
            <Line x1="160" y1="45" x2="160" y2="105" stroke="#78350f" strokeWidth="6" />
            <Line x1="172" y1="45" x2="172" y2="105" stroke="#78350f" strokeWidth="6" />
            <Line x1="184" y1="45" x2="184" y2="105" stroke="#78350f" strokeWidth="6" />
            <Line x1="150" y1="35" x2="165" y2="28" stroke="#dc2626" strokeWidth="3" />
            <Line x1="178" y1="30" x2="195" y2="38" stroke="#dc2626" strokeWidth="3" />
            <Circle cx="240" cy="50" r="10" fill="#0284c7" />
            <Line x1="240" y1="60" x2="240" y2="95" stroke="#0284c7" strokeWidth="4" />
            <Line x1="230" y1="75" x2="175" y2="50" stroke="#d97706" strokeWidth="4" />
            <Circle cx="175" cy="50" r="6" fill="#ef4444" />
            <SvgText x="210" y="32" fill="#b91c1c" fontSize="11" fontWeight="bold">Bails Dislodged by Bat / Body in Motion</SvgText>
            <SvgText x="210" y="112" fill="#0f172a" fontSize="10">Applies while preparing, playing shot, or setting off for first run</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>MCC LAW 29: BATTER IS OUT IF THEIR BAT, PERSON OR GEAR BREAKS THE WICKET DURING DELIVERY STROKE</Text>
        </View>
      );

    case 'HIT_TWICE':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#15803d" />
            <Rect x="40" y="25" width="380" height="90" fill="#e2d2b5" />
            <Circle cx="170" cy="65" r="12" fill="#22c55e" />
            <SvgText x="166" y="70" fill="#ffffff" fontSize="11" fontWeight="bold">1</SvgText>
            <SvgText x="125" y="90" fill="#166534" fontSize="10" fontWeight="bold">1st Strike (Legal)</SvgText>
            <Path d="M 185 65 Q 255 35 310 65" fill="none" stroke="#ef4444" strokeWidth="3" strokeDasharray="4,3" />
            <Circle cx="310" cy="65" r="12" fill="#ef4444" />
            <SvgText x="306" y="70" fill="#ffffff" fontSize="11" fontWeight="bold">2</SvgText>
            <SvgText x="265" y="90" fill="#b91c1c" fontSize="10" fontWeight="bold">2nd Strike (OUT!)</SvgText>
            <SvgText x="90" y="35" fill="#0f172a" fontSize="10.5" fontWeight="bold">✕ Illegal 2nd Hit to Score Runs • Only Legal to Defend Stumps</SvgText>
            <SvgText x="110" y="112" fill="#64748b" fontSize="9.5">Ball becomes Dead immediately upon intentional 2nd strike</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>MCC LAW 34: BATTER CANNOT HIT BALL TWICE EXCEPT STRICTLY TO DEFEND THEIR STUMPS WITHOUT RUNNING</Text>
        </View>
      );

    case 'OBSTRUCTING':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#15803d" />
            <Rect x="40" y="25" width="380" height="90" fill="#e2d2b5" />
            <Line x1="120" y1="25" x2="120" y2="115" stroke="#ffffff" strokeWidth="3" />
            <Line x1="360" y1="25" x2="360" y2="115" stroke="#ffffff" strokeWidth="3" />
            <Circle cx="70" cy="70" r="10" fill="#0369a1" />
            <Line x1="85" y1="70" x2="220" y2="70" stroke="#f59e0b" strokeWidth="3" strokeDasharray="4,4" />
            <Circle cx="240" cy="70" r="12" fill="#ef4444" />
            <Line x1="240" y1="50" x2="240" y2="90" stroke="#ef4444" strokeWidth="4" />
            <SvgText x="160" y="45" fill="#b91c1c" fontSize="11" fontWeight="bold">🛑 Willful Obstruction of Throw (OUT!)</SvgText>
            <SvgText x="160" y="105" fill="#0f172a" fontSize="10">Batter deviated path to prevent throw from hitting stumps</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>MCC LAW 37: EITHER BATTER IS OUT IF THEY WILLFULLY OBSTRUCT OR DISTRACT THE FIELDING SIDE</Text>
        </View>
      );

    case 'RETIRED_HURT':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#065f46" />
            <Circle cx="100" cy="70" r="28" fill="#10b981" />
            <SvgText x="88" y="77" fill="#ffffff" fontSize="22" fontWeight="bold">🩺</SvgText>
            <Rect x="150" y="32" width="270" height="32" rx="6" fill="#047857" />
            <SvgText x="160" y="52" fill="#fef08a" fontSize="10.5" fontWeight="bold">RETIRED HURT = NOT OUT (CAN RESUME INNINGS)</SvgText>
            <Rect x="150" y="70" width="270" height="42" rx="6" fill="rgba(255,255,255,0.15)" />
            <SvgText x="160" y="86" fill="#ffffff" fontSize="9.5">✓ Wickets count does NOT increment</SvgText>
            <SvgText x="160" y="102" fill="#ffffff" fontSize="9.5">✓ May return to bat at any fall of wicket</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>MCC LAW 25.4: RETIRED HURT DUE TO ILLNESS/INJURY IS NOT A DISMISSAL; BATTER MAY RESUME INNINGS</Text>
        </View>
      );

    case 'RETIRED_OUT':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#450a0a" />
            <Circle cx="100" cy="70" r="28" fill="#dc2626" />
            <SvgText x="88" y="78" fill="#ffffff" fontSize="22" fontWeight="bold">🚪</SvgText>
            <Rect x="150" y="32" width="270" height="32" rx="6" fill="#991b1b" />
            <SvgText x="165" y="52" fill="#ffffff" fontSize="11" fontWeight="bold">RETIRED OUT = OFFICIAL WICKET FALLEN</SvgText>
            <Rect x="150" y="70" width="270" height="42" rx="6" fill="rgba(255,255,255,0.15)" />
            <SvgText x="160" y="86" fill="#fca5a5" fontSize="9.5">✕ Team wickets tally increments (+1)</SvgText>
            <SvgText x="160" y="102" fill="#fca5a5" fontSize="9.5">✕ Batter CANNOT return to bat in this innings</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>MCC LAW 25.4.3: RETIRING WITHOUT UMPIRE CONSENT OR MEDICAL REASON COUNTS AS A DISMISSAL</Text>
        </View>
      );

    case 'STUMPING':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#15803d" />
            <Rect x="40" y="25" width="380" height="90" fill="#e2d2b5" />
            <Line x1="280" y1="25" x2="280" y2="115" stroke="#ffffff" strokeWidth="4" />
            <Line x1="360" y1="50" x2="360" y2="100" stroke="#78350f" strokeWidth="6" />
            <Circle cx="370" cy="65" r="10" fill="#f59e0b" />
            <Circle cx="240" cy="65" r="10" fill="#0284c7" />
            <Rect x="235" y="78" width="35" height="14" rx="4" fill="#ef4444" />
            <SvgText x="120" y="45" fill="#dc2626" fontSize="10.5" fontWeight="bold">Foot Outside Crease (No Part Grounded Behind)</SvgText>
            <SvgText x="295" y="40" fill="#78350f" fontSize="9.5" fontWeight="bold">Keeper Breaks Stumps</SvgText>
            <SvgText x="110" y="110" fill="#0f172a" fontSize="9.5">Valid on legal delivery or Wide (NOT valid on No Ball)</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>MCC LAW 39: BATTER IS STUMPED IF OUT OF CREASE WITHOUT ATTEMPTING A RUN & KEEPER BREAKS WICKET</Text>
        </View>
      );

    case 'BOUNDARY':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#15803d" />
            <Line x1="260" y1="10" x2="260" y2="130" stroke="#ffffff" strokeWidth="6" />
            <SvgText x="270" y="28" fill="#fef08a" fontSize="11" fontWeight="bold">BOUNDARY ROPE</SvgText>
            <Circle cx="190" cy="65" r="12" fill="#22c55e" />
            <SvgText x="150" y="90" fill="#ffffff" fontSize="10" fontWeight="bold">✓ Legal Catch</SvgText>
            <SvgText x="120" y="104" fill="#fef08a" fontSize="8.5">Last contact grounded inside rope</SvgText>
            <Circle cx="260" cy="65" r="12" fill="#ef4444" />
            <SvgText x="280" y="68" fill="#ef4444" fontSize="11" fontWeight="bold">✕ SIX RUNS</SvgText>
            <SvgText x="280" y="84" fill="#fca5a5" fontSize="8.5">Fielder touching rope with ball in hand</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>MCC LAW 19.5: FIELDER'S LAST GROUND CONTACT BEFORE TOUCHING BALL MUST BE ENTIRELY INSIDE ROPE</Text>
        </View>
      );

    case 'ILLEGAL_FIELD':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#1e293b" />
            <Circle cx="100" cy="70" r="28" fill="#dc2626" />
            <SvgText x="88" y="78" fill="#ffffff" fontSize="22">🧢</SvgText>
            <Rect x="150" y="30" width="270" height="32" rx="6" fill="#b91c1c" />
            <SvgText x="165" y="50" fill="#ffffff" fontSize="11" fontWeight="bold">FIELDING WITH DETACHED GEAR</SvgText>
            <Rect x="150" y="68" width="270" height="45" rx="6" fill="rgba(255,255,255,0.12)" />
            <SvgText x="160" y="84" fill="#fde047" fontSize="10" fontWeight="bold">PENALTY: +5 Runs Awarded to Batting Team</SvgText>
            <SvgText x="160" y="100" fill="#ffffff" fontSize="9">Using cap, hat, sweater or detached gear to field ball</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>MCC LAW 28.2: NO FIELDER SHALL INTENTIONALLY USE CLOTHING OR DETACHED EQUIPMENT TO FIELD BALL</Text>
        </View>
      );

    case 'HELMET':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#15803d" />
            <Rect x="70" y="45" width="65" height="50" rx="10" fill="#334155" stroke="#ffffff" strokeWidth="2" />
            <SvgText x="88" y="75" fill="#fef08a" fontSize="20">⛑️</SvgText>
            <Circle cx="140" cy="70" r="9" fill="#dc2626" />
            <Line x1="210" y1="70" x2="152" y2="70" stroke="#f59e0b" strokeWidth="3" strokeDasharray="4,3" />
            <Rect x="170" y="30" width="250" height="34" rx="6" fill="#991b1b" />
            <SvgText x="180" y="52" fill="#ffffff" fontSize="11" fontWeight="bold">BALL STRIKES GROUNDED HELMET</SvgText>
            <Rect x="170" y="70" width="250" height="42" rx="6" fill="#1e293b" />
            <SvgText x="180" y="86" fill="#fde047" fontSize="10" fontWeight="bold">1. +5 Penalty Runs Awarded to Batters</SvgText>
            <SvgText x="180" y="100" fill="#e2e8f0" fontSize="9.5">2. Ball becomes Dead immediately on impact</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>MCC LAW 28.3: IF BALL STRIKES GROUNDED HELMET, +5 PENALTY RUNS AWARDED & BALL BECOMES DEAD</Text>
        </View>
      );

    case 'FAKE_FIELD':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#0f172a" />
            <Circle cx="100" cy="70" r="26" fill="#b45309" />
            <SvgText x="88" y="77" fill="#ffffff" fontSize="22">🎭</SvgText>
            <Rect x="150" y="28" width="270" height="32" rx="6" fill="#78350f" />
            <SvgText x="165" y="48" fill="#fef08a" fontSize="11" fontWeight="bold">DECEPTIVE / FAKE FIELDING (LAW 41.5)</SvgText>
            <Rect x="150" y="66" width="270" height="50" rx="6" fill="#1e293b" />
            <SvgText x="160" y="82" fill="#ef4444" fontSize="10" fontWeight="bold">Feigning throw to prevent batters running</SvgText>
            <SvgText x="160" y="98" fill="#fde047" fontSize="10" fontWeight="bold">PENALTY: +5 Runs to Batting Team + Ball Dead</SvgText>
            <SvgText x="160" y="110" fill="#94a3b8" fontSize="8.5">Runs completed by batters also stand</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>MCC LAW 41.5: DELIBERATE ATTEMPT TO DECEIVE OR DISTRACT BATTER RESULTS IN 5 PENALTY RUNS</Text>
        </View>
      );

    case 'SUBSTITUTE':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#1e293b" />
            <Rect x="30" y="25" width="180" height="90" rx="6" fill="#065f46" />
            <SvgText x="45" y="48" fill="#a7f3d0" fontSize="11" fontWeight="bold">PERMITTED POWERS:</SvgText>
            <SvgText x="45" y="70" fill="#ffffff" fontSize="10">✓ Fielding anywhere on ground</SvgText>
            <SvgText x="45" y="88" fill="#ffffff" fontSize="10">✓ Taking legal catches</SvgText>
            <SvgText x="45" y="104" fill="#ffffff" fontSize="10">✓ Executing run outs</SvgText>
            <Rect x="230" y="25" width="200" height="90" rx="6" fill="#7f1d1d" />
            <SvgText x="245" y="48" fill="#fca5a5" fontSize="11" fontWeight="bold">RESTRICTED (NOT PERMITTED):</SvgText>
            <SvgText x="245" y="70" fill="#ffffff" fontSize="10">✕ CANNOT Bowl under any condition</SvgText>
            <SvgText x="245" y="88" fill="#ffffff" fontSize="10">✕ CANNOT Bat in innings</SvgText>
            <SvgText x="245" y="104" fill="#ffffff" fontSize="10">✕ CANNOT Act as on-field Captain</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>MCC LAW 24: SUBSTITUTES ARE STRICTLY PERMITTED TO FIELD ONLY; NO BOWLING, BATTING OR CAPTAINCY</Text>
        </View>
      );

    case 'KEEPER':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#15803d" />
            <Rect x="40" y="25" width="380" height="90" fill="#e2d2b5" />
            <Line x1="260" y1="25" x2="260" y2="115" stroke="#ffffff" strokeWidth="4" />
            <Line x1="265" y1="45" x2="265" y2="95" stroke="#78350f" strokeWidth="6" />
            <Rect x="280" y="55" width="40" height="25" rx="5" fill="#22c55e" />
            <SvgText x="285" y="71" fill="#ffffff" fontSize="9.5" fontWeight="bold">Legal Gloves</SvgText>
            <Rect x="215" y="55" width="45" height="25" rx="5" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
            <SvgText x="220" y="71" fill="#ffffff" fontSize="8.5" fontWeight="bold">Illegal Gloves</SvgText>
            <SvgText x="70" y="42" fill="#0f172a" fontSize="10.5" fontWeight="bold">Gloves in front before ball passes stumps = NO BALL!</SvgText>
            <SvgText x="70" y="105" fill="#1e3a8a" fontSize="9.5">Keeper must remain wholly behind stumps at striker's end</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>MCC LAW 27: WICKETKEEPER MUST REMAIN WHOLLY BEHIND STUMPS UNTIL BALL TOUCHES BAT OR PASSES WICKET</Text>
        </View>
      );

    case 'DEAD_BALL':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#0f2452" />
            <Circle cx="100" cy="70" r="28" fill="#3b82f6" />
            <SvgText x="88" y="78" fill="#ffffff" fontSize="22">🛑</SvgText>
            <Rect x="150" y="25" width="280" height="32" rx="6" fill="#1d4ed8" />
            <SvgText x="165" y="46" fill="#ffffff" fontSize="11" fontWeight="bold">UMPIRE CALLS & SIGNALS DEAD BALL</SvgText>
            <Rect x="150" y="65" width="280" height="52" rx="6" fill="rgba(255,255,255,0.12)" />
            <SvgText x="160" y="80" fill="#93c5fd" fontSize="9.5">• Delivery DOES NOT COUNT (Re-bowled)</SvgText>
            <SvgText x="160" y="94" fill="#93c5fd" fontSize="9.5">• No runs scored, no batter can be dismissed</SvgText>
            <SvgText x="160" y="108" fill="#fef08a" fontSize="9.5">• Ball trapped in gear / bowler aborts run-up</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>MCC LAW 20: DELIVERY BECOMES DEAD WHEN UMPIRE CALLS IT; NO RUNS ACCRUE AND BALL IS RE-BOWLED</Text>
        </View>
      );

    case 'PENALTY_RUNS':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#1e293b" />
            <Rect x="30" y="25" width="185" height="90" rx="8" fill="#065f46" />
            <SvgText x="40" y="48" fill="#a7f3d0" fontSize="10.5" fontWeight="bold">AWARD TO BATTING (+5)</SvgText>
            <SvgText x="40" y="68" fill="#ffffff" fontSize="9">• Ball hitting ground helmet</SvgText>
            <SvgText x="40" y="84" fill="#ffffff" fontSize="9">• Illegal fielding with cap</SvgText>
            <SvgText x="40" y="100" fill="#ffffff" fontSize="9">• Fake fielding / unfair play</SvgText>
            <Rect x="230" y="25" width="195" height="90" rx="8" fill="#7f1d1d" />
            <SvgText x="240" y="48" fill="#fca5a5" fontSize="10.5" fontWeight="bold">AWARD TO FIELDING (+5)</SvgText>
            <SvgText x="240" y="68" fill="#ffffff" fontSize="9">• Running on pitch danger zone</SvgText>
            <SvgText x="240" y="84" fill="#ffffff" fontSize="9">• Time wasting by batting side</SvgText>
            <SvgText x="240" y="100" fill="#ffffff" fontSize="9">• Ball tampering / misconduct</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>MCC LAW 41 & 42: UMPIRE SIGNALS PENALTY RUNS BY TAPPING SHOULDER; 5 RUNS CREDITED TO TEAM EXTRAS</Text>
        </View>
      );

    case 'TAMPERING':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#0f172a" />
            <Circle cx="90" cy="70" r="28" fill="#dc2626" />
            <SvgText x="78" y="78" fill="#ffffff" fontSize="22">🏏</SvgText>
            <Rect x="140" y="25" width="290" height="32" rx="6" fill="#991b1b" />
            <SvgText x="155" y="46" fill="#ffffff" fontSize="11" fontWeight="bold">BALL TAMPERING (UNFAIR CONDITIONING)</SvgText>
            <Rect x="140" y="65" width="290" height="52" rx="6" fill="#1e293b" />
            <SvgText x="150" y="80" fill="#ef4444" fontSize="9.5">• 1. Ball replaced immediately by Umpires</SvgText>
            <SvgText x="150" y="94" fill="#fde047" fontSize="9.5">• 2. +5 Penalty Runs awarded to opposition</SvgText>
            <SvgText x="150" y="108" fill="#94a3b8" fontSize="9.5">• 3. Disciplinary report filed to Match Referee</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>MCC LAW 41.3: ARTIFICIALLY ALTERING CONDITION OF BALL RESULTS IN 5 PENALTY RUNS & BALL REPLACEMENT</Text>
        </View>
      );

    case 'TIME_WASTING':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#1e293b" />
            <Circle cx="90" cy="70" r="28" fill="#d97706" />
            <SvgText x="78" y="78" fill="#ffffff" fontSize="22">⏱️</SvgText>
            <Rect x="140" y="25" width="290" height="30" rx="6" fill="#b45309" />
            <SvgText x="155" y="45" fill="#ffffff" fontSize="11" fontWeight="bold">DELIBERATE TIME WASTING (LAW 41.9 / 41.10)</SvgText>
            <Rect x="140" y="62" width="290" height="55" rx="6" fill="rgba(255,255,255,0.12)" />
            <SvgText x="150" y="78" fill="#fef08a" fontSize="10" fontWeight="bold">Stage 1: Official First & Final Warning to Captain</SvgText>
            <SvgText x="150" y="94" fill="#ef4444" fontSize="10" fontWeight="bold">Stage 2: +5 Penalty Runs awarded to opposition</SvgText>
            <SvgText x="150" y="108" fill="#94a3b8" fontSize="8.5">If bowler repeats: suspended from bowling for innings</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>MCC LAW 41.9 & 41.10: WASTING TIME IS UNFAIR; UMPIRES ISSUE FIRST WARNING FOLLOWED BY 5 PENALTY RUNS</Text>
        </View>
      );

    case 'MISCONDUCT':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#0f172a" />
            <G>
              <Rect x="30" y="30" width="90" height="80" rx="6" fill="#854d0e" />
              <SvgText x="38" y="50" fill="#fef08a" fontSize="10" fontWeight="bold">LEVEL 1</SvgText>
              <SvgText x="38" y="68" fill="#ffffff" fontSize="8">Dissent /</SvgText>
              <SvgText x="38" y="82" fill="#ffffff" fontSize="8">Language</SvgText>
              <SvgText x="38" y="100" fill="#fde047" fontSize="8" fontWeight="bold">Warning</SvgText>
            </G>
            <G>
              <Rect x="130" y="30" width="90" height="80" rx="6" fill="#b91c1c" />
              <SvgText x="138" y="50" fill="#fee2e2" fontSize="10" fontWeight="bold">LEVEL 2</SvgText>
              <SvgText x="138" y="68" fill="#ffffff" fontSize="8">Serious Obscene</SvgText>
              <SvgText x="138" y="82" fill="#ffffff" fontSize="8">Aggression</SvgText>
              <SvgText x="138" y="100" fill="#fca5a5" fontSize="8" fontWeight="bold">+5 Penalty</SvgText>
            </G>
            <G>
              <Rect x="230" y="30" width="90" height="80" rx="6" fill="#991b1b" />
              <SvgText x="238" y="50" fill="#fca5a5" fontSize="10" fontWeight="bold">LEVEL 3</SvgText>
              <SvgText x="238" y="68" fill="#ffffff" fontSize="8">Intimidation /</SvgText>
              <SvgText x="238" y="82" fill="#ffffff" fontSize="8">Threat</SvgText>
              <SvgText x="238" y="100" fill="#ef4444" fontSize="8" fontWeight="bold">Suspended</SvgText>
            </G>
            <G>
              <Rect x="330" y="30" width="90" height="80" rx="6" fill="#450a0a" />
              <SvgText x="338" y="50" fill="#f87171" fontSize="10" fontWeight="bold">LEVEL 4</SvgText>
              <SvgText x="338" y="68" fill="#ffffff" fontSize="8">Physical</SvgText>
              <SvgText x="338" y="82" fill="#ffffff" fontSize="8">Violence</SvgText>
              <SvgText x="338" y="100" fill="#dc2626" fontSize="8" fontWeight="bold">Ejected</SvgText>
            </G>
          </Svg>
          <Text style={styles.diagramCaption}>MCC LAW 42: PROGRESSIVE 4-TIER DISCIPLINARY SANCTIONS FROM OFFICIAL WARNING TO MATCH REMOVAL</Text>
        </View>
      );

    case 'PITCH_DAMAGE':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#15803d" />
            <Rect x="40" y="25" width="380" height="90" fill="#e2d2b5" />
            <Line x1="120" y1="25" x2="120" y2="115" stroke="#ffffff" strokeWidth="4" />
            <Line x1="340" y1="25" x2="340" y2="115" stroke="#ffffff" strokeWidth="4" />
            <Rect x="160" y="55" width="140" height="30" fill="rgba(220, 38, 38, 0.3)" stroke="#dc2626" strokeWidth="2" strokeDasharray="4,3" />
            <SvgText x="175" y="74" fill="#991b1b" fontSize="10" fontWeight="bold">PROTECTED DANGER ZONE</SvgText>
            <SvgText x="60" y="42" fill="#0f172a" fontSize="10" fontWeight="bold">✕ No running down center of pitch</SvgText>
            <SvgText x="60" y="105" fill="#b45309" fontSize="9">1st: Warning • 2nd: Final Warning • 3rd: +5 Penalty Runs / Suspension</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>MCC LAW 41.14 & 41.15: RUNNING ON PROTECTED AREA OF PITCH IS UNFAIR; SUBJECT TO WARNING AND PENALTIES</Text>
        </View>
      );

    case 'FREE_HIT': {
      const isMccFreeHit = competitionFormat === 'MCC_TRADITIONAL';
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill={isMccFreeHit ? '#7f1d1d' : '#064e3b'} />
            <Circle cx="80" cy="70" r="28" fill={isMccFreeHit ? '#b91c1c' : '#059669'} />
            <SvgText x="68" y="78" fill="#ffffff" fontSize={22}>{isMccFreeHit ? '🚫' : '⚡'}</SvgText>
            <Rect x="130" y="25" width="300" height="34" rx="6" fill={isMccFreeHit ? '#991b1b' : '#047857'} />
            <SvgText x={isMccFreeHit ? 140 : 150} y="47" fill="#fef08a" fontSize={11} fontWeight="bold">
              {isMccFreeHit ? '🚫 NO FREE HIT IN MCC 42 LAWS (LAW 21)' : '⚡ FREE HIT ACTIVE ON NEXT DELIVERY'}
            </SvgText>
            <Rect x="130" y="66" width="300" height="52" rx="6" fill="#0f172a" />
            <SvgText x="140" y="84" fill={isMccFreeHit ? '#fca5a5' : '#a7f3d0'} fontSize={9.5}>
              {isMccFreeHit
                ? 'Pure MCC Law 21: +1 No Ball penalty run & re-bowl. Normal dismissals apply.'
                : '✓ Batter IMMUNE to: Bowled, Caught, LBW, Stumped, Hit Wicket'}
            </SvgText>
            <SvgText x="140" y="104" fill="#fef08a" fontSize={9.5}>
              {isMccFreeHit
                ? 'Free Hit is strictly an ICC / Board Limited-Overs Playing Condition.'
                : '✓ ONLY Run Out, Hit Ball Twice, Obstructing Field dismissals apply.'}
            </SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>
            {isMccFreeHit
              ? 'MCC CODE LAW 21: FREE HIT IS NOT PART OF TRADITIONAL CRICKET LAWS'
              : 'ICC & BCCI REGULATION: MANDATORY FREE HIT FOLLOWING ALL NO-BALL DELIVERIES'}
          </Text>
        </View>
      );
    }

    case 'OVER_COMPLETION':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#0f172a" />
            <SvgText x="110" y="32" fill="#38bdf8" fontSize="11" fontWeight="bold">OVER COMPLETION SEQUENCE (6 VALID DELIVERIES)</SvgText>
            {[1, 2, 3, 4, 5, 6].map((b, idx) => (
              <G key={idx}>
                <Circle cx={65 + idx * 56} cy="65" r="20" fill="#0284c7" />
                <SvgText x={61 + idx * 56} y="72" fill="#ffffff" fontSize="13" fontWeight="bold">{b}</SvgText>
              </G>
            ))}
            <Rect x="40" y="98" width="380" height="22" rx="4" fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b" strokeWidth="1" />
            <SvgText x="50" y="113" fill="#fef08a" fontSize="9.5">Wides & No-Balls DO NOT count toward the 6 legal balls and must be re-bowled</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>MCC LAW 17: AN OVER CONSISTS OF 6 VALID DELIVERIES; UMPIRE CALLS OVER AND TEAMS ROTATE ENDS</Text>
        </View>
      );

    case 'SLOW_OVER':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#1e293b" />
            <Circle cx="80" cy="70" r="28" fill="#dc2626" />
            <SvgText x="68" y="78" fill="#ffffff" fontSize="22">⏳</SvgText>
            <Rect x="130" y="25" width="300" height="34" rx="6" fill="#991b1b" />
            <SvgText x="145" y="47" fill="#ffffff" fontSize="11" fontWeight="bold">SLOW OVER RATE PENALTY (IN-MATCH)</SvgText>
            <Rect x="130" y="66" width="300" height="52" rx="6" fill="#0f172a" />
            <SvgText x="140" y="82" fill="#fca5a5" fontSize="10" fontWeight="bold">Match cut-off exceeded at scheduled end time:</SvgText>
            <SvgText x="140" y="96" fill="#fde047" fontSize="9.5">• 1 fewer fielder permitted outside 30-yard circle</SvgText>
            <SvgText x="140" y="110" fill="#ffffff" fontSize="8.5">• Max 4 fielders outside circle instead of 5 for remaining overs</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>ICC T20 CLAUSE 12.8: IN-MATCH PENALTY REQUIRES ONE EXTRA FIELDER INSIDE CIRCLE FOR ALL INCOMPLETE OVERS</Text>
        </View>
      );

    case 'SUPER_OVER':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#0f2452" />
            <Circle cx="80" cy="70" r="28" fill="#d97706" />
            <SvgText x="68" y="78" fill="#ffffff" fontSize="22">🏆</SvgText>
            <Rect x="130" y="25" width="300" height="32" rx="6" fill="#b45309" />
            <SvgText x="150" y="46" fill="#fef08a" fontSize="11" fontWeight="bold">SUPER OVER TIE-BREAKER PROCEDURE</SvgText>
            <Rect x="130" y="64" width="300" height="54" rx="6" fill="rgba(255,255,255,0.12)" />
            <SvgText x="140" y="80" fill="#ffffff" fontSize="9.5">• 1 Over (6 Legal Deliveries) per side</SvgText>
            <SvgText x="140" y="94" fill="#ffffff" fontSize="9.5">• Max 2 Wickets (Innings concludes upon 2nd wicket)</SvgText>
            <SvgText x="140" y="108" fill="#a7f3d0" fontSize="9.5">• Team batting second in main match bats first in Super Over</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>ICC APPENDIX F: MATCH TIED ➔ 1-OVER ELIMINATOR DECIDES WINNER; BOUNDARY COUNT NO LONGER APPLIES</Text>
        </View>
      );

    case 'DLS':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#0369a1" />
            <Circle cx="80" cy="70" r="28" fill="#0284c7" />
            <SvgText x="68" y="78" fill="#ffffff" fontSize="22">🌧️</SvgText>
            <Rect x="130" y="25" width="300" height="32" rx="6" fill="#075985" />
            <SvgText x="145" y="46" fill="#fef08a" fontSize="11" fontWeight="bold">DUCKWORTH-LEWIS-STERN (DLS) METHOD</SvgText>
            <Rect x="130" y="64" width="300" height="54" rx="6" fill="#082f49" />
            <SvgText x="140" y="80" fill="#bae6fd" fontSize="9.5">Target adjusted according to Resources Lost (Overs & Wickets)</SvgText>
            <SvgText x="140" y="94" fill="#fde047" fontSize="9.5">Par Score = Team 1 Runs × (Team 2 Res / Team 1 Res)</SvgText>
            <SvgText x="140" y="108" fill="#ffffff" fontSize="8.5">Minimum 5 overs required in T20 to constitute official match</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>ICC PLAYING CONDITIONS: DLS TARGET REVISION GOVERNED BY OFFICIAL RESOURCE PERCENTAGE TABLES</Text>
        </View>
      );

    case 'BREAK':
      return (
        <View style={styles.diagramBox}>
          <Svg width={isMobile ? 300 : 460} height={140} viewBox="0 0 460 140">
            <Rect x="10" y="10" width="440" height="120" rx="8" fill="#78350f" />
            <Circle cx="80" cy="70" r="28" fill="#d97706" />
            <SvgText x="68" y="78" fill="#ffffff" fontSize="22">☕</SvgText>
            <Rect x="130" y="25" width="300" height="32" rx="6" fill="#b45309" />
            <SvgText x="155" y="46" fill="#fef08a" fontSize="11" fontWeight="bold">MATCH INTERVALS & BREAK TIMINGS</SvgText>
            <Rect x="130" y="64" width="300" height="54" rx="6" fill="#451a03" />
            <SvgText x="140" y="80" fill="#fde68a" fontSize="9.5">• T20 Innings Break: Exactly 15 Minutes</SvgText>
            <SvgText x="140" y="94" fill="#fde68a" fontSize="9.5">• Drinks Interval: 2.5 Minutes (Midpoint of Innings)</SvgText>
            <SvgText x="140" y="108" fill="#ffffff" fontSize="8.5">• Multi-day: Lunch (40 mins), Tea (20 mins)</SvgText>
          </Svg>
          <Text style={styles.diagramCaption}>MCC LAW 11: TIMED BREAKS REGULATED BY COMPETITION PLAYING CONDITIONS; TEAMS SWITCH BOWLING ENDS</Text>
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
  competitionSummaryBar: {
    marginTop: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  competitionBadgeTag: {
    backgroundColor: '#005960',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  competitionBadgeTagText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '800'
  },
  competitionSummaryText: {
    color: '#334155',
    fontSize: 10,
    fontWeight: '600',
    flex: 1
  },
  activeCompBadge: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  activeCompBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#1d4ed8'
  },
  compVariationBanner: {
    marginTop: 8,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 6,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8
  },
  compVariationIcon: {
    fontSize: 14
  },
  compVariationTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#92400e',
    letterSpacing: 0.3
  },
  compVariationDesc: {
    fontSize: 10.5,
    color: '#78350f',
    marginTop: 2,
    lineHeight: 14,
    fontWeight: '600'
  },
  compModTag: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3
  },
  compModTagText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#92400e'
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
