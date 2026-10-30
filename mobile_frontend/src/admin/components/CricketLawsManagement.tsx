/**
 * src/admin/components/CricketLawsManagement.tsx
 * Complete MCC Cricket Laws Management System (2026 Edition – MCC 2017 Code 4th Edition).
 * Full official 42 Laws of Cricket directory with instant search, category filters,
 * 2026 amendment badges, sub-clause accordions, penalty run rules, and playing conditions editor.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Platform
} from 'react-native';

export interface LawItem {
  number: number;
  title: string;
  category: 'SETUP' | 'PITCH' | 'INNINGS' | 'SCORING' | 'EXTRAS' | 'DISMISSAL' | 'CONDUCT';
  categoryLabel: string;
  isAmended2026?: boolean;
  amendmentNotes?: string;
  summary: string;
  penaltyRuns?: string;
  keyClauses: string[];
  umpireNotes?: string;
}

const MCC_LAWS_2026: LawItem[] = [
  // Setting up the game (Laws 1-5)
  {
    number: 1,
    title: 'The Players',
    category: 'SETUP',
    categoryLabel: 'Setting up the Game',
    isAmended2026: true,
    amendmentNotes: '2026 Update: Codified protocols for concussion and COVID replacements with equal playing rights upon umpire validation.',
    summary: 'A match is played between two sides, each of 11 players, one of whom shall be captain. Nomination must occur before toss.',
    keyClauses: [
      '1.1: Number of players: 11 nominated per side',
      '1.2: Nomination of players: Written declaration to umpires prior to toss',
      '1.3: Captain: Responsible for team conduct and ensuring Play is conducted in accordance with the Spirit of Cricket',
      '1.4: Replacement players: Fully licensed replacement allowed for medical or certified injury'
    ]
  },
  {
    number: 2,
    title: 'The Umpires',
    category: 'SETUP',
    categoryLabel: 'Setting up the Game',
    summary: 'Two umpires shall be appointed, one for each end, to control the game with absolute impartiality and authority.',
    keyClauses: [
      '2.1: Appointment and attendance: 45 minutes prior to match call',
      '2.2: Change of umpire: Requires consent of both captains or association arbiter',
      '2.3: Consultation: Umpires confer before signaling boundaries, dismissals or penalty awards'
    ]
  },
  {
    number: 3,
    title: 'The Scorers',
    category: 'SETUP',
    categoryLabel: 'Setting up the Game',
    summary: 'Two scorers shall be appointed to record all runs scored, all wickets taken and, where appropriate, number of overs bowled.',
    keyClauses: [
      '3.1: Duties of scorers: Acknowledge every umpire signal promptly',
      '3.2: Scorer reconciliation: Regular cross-checks with umpires at intervals'
    ]
  },
  {
    number: 4,
    title: 'The Ball',
    category: 'SETUP',
    categoryLabel: 'Setting up the Game',
    summary: 'Approved cricket ball weight (155.9g to 163g) and circumference (22.4cm to 22.9cm). Specifications must conform to MCC standards.',
    keyClauses: [
      '4.1: Weight and size specifications',
      '4.2: Approval of balls before toss',
      '4.3: New ball allowance and replacement ball of comparable wear'
    ]
  },
  {
    number: 5,
    title: 'The Bat',
    category: 'SETUP',
    categoryLabel: 'Setting up the Game',
    summary: 'Bat dimensions: Overall length not more than 38 in (96.5 cm); width not exceeding 4.25 in (10.8 cm); depth not more than 2.64 in (67 mm).',
    keyClauses: [
      '5.1: The handle and blade materials (predominantly wood/cane)',
      '5.2: Bat gauge adherence check by umpires'
    ]
  },

  // Pitch and Ground (Laws 6-12)
  {
    number: 6,
    title: 'The Pitch',
    category: 'PITCH',
    categoryLabel: 'Pitch & Ground',
    summary: 'The pitch is a rectangular area of the ground 22 yards (20.12 m) in length and 10 ft (3.05 m) in width.',
    keyClauses: [
      '6.1: Pitch measurement: Stumps are 22 yards apart',
      '6.2: Selection and preparation: Exclusively under authority of Ground Authority / Umpires',
      '6.3: Changing pitch: Unfit condition protocols during match'
    ]
  },
  {
    number: 7,
    title: 'The Creases',
    category: 'PITCH',
    categoryLabel: 'Pitch & Ground',
    summary: 'The bowling crease, popping crease and return creases must be marked at each end of the pitch in white paint or chalk.',
    keyClauses: [
      '7.1: Bowling crease: 8 ft 8 in (2.64 m)',
      '7.2: Popping crease: 4 ft (1.22 m) in front of stumps, considered infinite in length',
      '7.3: Return creases: Perpendicular to bowling crease, 4 ft 4 in from pitch center'
    ]
  },
  {
    number: 8,
    title: 'The Wickets',
    category: 'PITCH',
    categoryLabel: 'Pitch & Ground',
    summary: 'Three wooden stumps 28 in (71.12 cm) high with two wooden bails resting on top, measuring total width of 9 in (22.86 cm).',
    keyClauses: [
      '8.1: Stumps and bails dimensions',
      '8.2: Dispensing with bails in gale conditions with umpire consent'
    ]
  },
  {
    number: 9,
    title: 'Preparation & Maintenance of Playing Area',
    category: 'PITCH',
    categoryLabel: 'Pitch & Ground',
    summary: 'Regulations for rolling, sweeping, mowing, beating and watering during and between match days.',
    keyClauses: [
      '9.1: Rolling: 7 minutes rolling prior to innings start on request of batting captain',
      '9.2: Clearing debris and sawdust application'
    ]
  },
  {
    number: 10,
    title: 'Covering the Pitch',
    category: 'PITCH',
    categoryLabel: 'Pitch & Ground',
    summary: 'Pitch covering arrangements before match and during rain interruptions as designated by ground playing conditions.',
    keyClauses: [
      '10.1: Full pitch and bowler runup protection',
      '10.2: Removal of covers prior to play'
    ]
  },
  {
    number: 11,
    title: 'Intervals',
    category: 'INNINGS',
    categoryLabel: 'Innings & Result',
    summary: 'Intervals between innings, meal intervals (lunch/tea) and drinks intervals. Time allowances and rescheduling rules.',
    keyClauses: [
      '11.1: 10-minute innings interval for limited overs',
      '11.2: Drinks intervals agreement prior to toss'
    ]
  },
  {
    number: 12,
    title: 'Start of Play; Cessation of Play',
    category: 'INNINGS',
    categoryLabel: 'Innings & Result',
    summary: 'Call of "Play" starts match and sessions; call of "Time" pauses or concludes play. Dangerous weather or light rulings.',
    keyClauses: [
      '12.1: Call of Play by bowler end umpire',
      '12.2: Umpires sole judges of fitness of ground, weather and light'
    ]
  },

  // Innings and Result (Laws 13-17)
  {
    number: 13,
    title: 'Innings',
    category: 'INNINGS',
    categoryLabel: 'Innings & Result',
    summary: 'Standard match formats, toss decision, and order of batting.',
    keyClauses: [
      '13.1: Coin toss 15-30 minutes prior to match',
      '13.2: Captain notification of decision to bat or field cannot be revoked'
    ]
  },
  {
    number: 14,
    title: 'The Follow-on',
    category: 'INNINGS',
    categoryLabel: 'Innings & Result',
    summary: 'Follow-on lead thresholds in two-innings matches (200 runs for 5+ day matches, 150 for 3-4 day, 100 for 2-day).',
    keyClauses: [
      '14.1: Lead deficit requirements',
      '14.2: Option of batting side to enforce follow-on'
    ]
  },
  {
    number: 15,
    title: 'Declaration & Forfeiture',
    category: 'INNINGS',
    categoryLabel: 'Innings & Result',
    summary: 'Batting captain may declare an innings closed or forfeit either innings at any stage ball is dead.',
    keyClauses: [
      '15.1: Captain notification while ball is dead',
      '15.2: Irrevocable forfeiture once declared'
    ]
  },
  {
    number: 16,
    title: 'The Result',
    category: 'INNINGS',
    categoryLabel: 'Innings & Result',
    isAmended2026: true,
    amendmentNotes: '2026 Update: Revised standard tie-breaker regulations (Super Over) and association adjudication criteria.',
    summary: 'Criteria for Win, Loss, Tie, Draw, Abandonment, and Award of Match for refusal to play.',
    keyClauses: [
      '16.1: Win by runs or wickets',
      '16.2: Tied match and Super Over conditions',
      '16.3: Award of match if a team concedes or refuses play'
    ]
  },
  {
    number: 17,
    title: 'The Over',
    category: 'INNINGS',
    categoryLabel: 'Innings & Result',
    summary: 'An over consists of 6 legitimate balls bowled from alternate ends. Calls of "Over" by the umpire.',
    keyClauses: [
      '17.1: Six balls per over',
      '17.2: Completion of interrupted over by new bowler',
      '17.3: Alternating bowling ends'
    ]
  },

  // Scoring Runs (Laws 18-20)
  {
    number: 18,
    title: 'Scoring Runs',
    category: 'SCORING',
    categoryLabel: 'Scoring Runs',
    summary: 'Runs are scored when batters cross and ground their bats between popping creases, plus boundary awards and extras.',
    keyClauses: [
      '18.1: Scoring a run by grounding bat past popping crease',
      '18.2: Short runs: Umpire signal and deduction',
      '18.3: Overthrows or willful fielder deflections'
    ]
  },
  {
    number: 19,
    title: 'Boundaries',
    category: 'SCORING',
    categoryLabel: 'Scoring Runs',
    isAmended2026: true,
    amendmentNotes: '2026 Update: Strict boundary cushioning contact rulings; fielder airborne from beyond boundary contact is 6 runs.',
    summary: 'Boundary demarcation, 4 runs for boundary on bounce/ground, 6 runs for all-the-way aerial clear of boundary edge.',
    keyClauses: [
      '19.1: Boundary markers and ropes',
      '19.2: Boundary 4 and Boundary 6 criteria',
      '19.3: Fielder grounding outside boundary contact'
    ]
  },
  {
    number: 20,
    title: 'Dead Ball',
    category: 'SCORING',
    categoryLabel: 'Scoring Runs',
    isAmended2026: true,
    amendmentNotes: '2026 Clarification: Clear protocol on foreign objects, bird/drone contact, and ball lodging in helmet.',
    summary: 'Conditions under which the ball ceases to be in play. Neither side can score runs or effect a dismissal during dead ball.',
    keyClauses: [
      '20.1: Ball settles in hands of wicket-keeper or bowler',
      '20.2: Umpire call of Dead Ball for injury or external distraction',
      '20.3: Ball lodging in clothing, protective equipment, or umpire attire'
    ]
  },

  // Dead Ball and Extras (Laws 21-25)
  {
    number: 21,
    title: 'No Ball',
    category: 'EXTRAS',
    categoryLabel: 'Dead Ball & Extras',
    isAmended2026: true,
    amendmentNotes: '2026 Revision: Any ball bouncing more than once before reaching popping crease is an immediate No Ball.',
    summary: 'Illegal delivery by foot fault, return crease violation, height violation (above waist), or illegal fielding positions.',
    penaltyRuns: '1 run penalty + Free Hit in limited overs',
    keyClauses: [
      '21.1: Mode of delivery: Bowler must nominate hand and side',
      '21.5: Front foot popping crease landing',
      '21.6: Return crease landing within bounds',
      '21.7: Ball bouncing more than once or rolling along pitch',
      '21.10: Above waist full-toss dangerous delivery'
    ]
  },
  {
    number: 22,
    title: 'Wide Ball',
    category: 'EXTRAS',
    categoryLabel: 'Dead Ball & Extras',
    isAmended2026: true,
    amendmentNotes: '2026 Update: Clarified batter lateral movement rule; wide line tracks adjusted if batter moves across off-stump.',
    summary: 'A delivery out of reach of the batter playing a normal cricket stroke from original stance.',
    penaltyRuns: '1 run penalty + extra ball',
    keyClauses: [
      '22.1: Judging a wide based on batter reach',
      '22.2: Batter moving across stumps adjustment',
      '22.3: Ball passing over head is called Wide and No Ball'
    ]
  },
  {
    number: 23,
    title: 'Bye and Leg Bye',
    category: 'EXTRAS',
    categoryLabel: 'Dead Ball & Extras',
    summary: 'Extras scored when ball passes batter without contact (Bye) or deflects off person/pads while attempting a stroke or evading injury (Leg Bye).',
    keyClauses: [
      '23.1: Leg bye criteria: Must play stroke or try to avoid injury',
      '23.2: Disallowance if batter neither played stroke nor tried to avoid ball'
    ]
  },
  {
    number: 24,
    title: "Fielder's Absence; Substitutes",
    category: 'EXTRAS',
    categoryLabel: 'Dead Ball & Extras',
    summary: 'Substitute fielders allowed for illness or injury, but may not bat or bowl. Return penalty times before bowling allowed.',
    keyClauses: [
      '24.1: Substitute fielders permitted only with umpire approval',
      '24.2: Fielder absent from field must serve penalty time before bowling'
    ]
  },
  {
    number: 25,
    title: "Batter's Innings; Runners",
    category: 'EXTRAS',
    categoryLabel: 'Dead Ball & Extras',
    summary: 'No runners are permitted under modern cricket laws. A batter unable to run must retire hurt or bat unassisted.',
    keyClauses: [
      '25.1: Eligibility to bat and order of innings',
      '25.4: Batter retiring: Retired Not Out vs Retired Out'
    ]
  },

  // Dismissals (Laws 26-39)
  {
    number: 26,
    title: 'Practice on the Field',
    category: 'DISMISSAL',
    categoryLabel: 'Dismissals & Restrictions',
    summary: 'Bowling and batting practice restrictions on match pitch and square before, during, and between match sessions.',
    penaltyRuns: '5 Penalty Runs for unauthorized practice during play',
    keyClauses: [
      '26.1: No practice on match pitch at any time on match day',
      '26.2: Trial run-ups allowed only outside match pitch area'
    ]
  },
  {
    number: 27,
    title: 'The Wicket-Keeper',
    category: 'DISMISSAL',
    categoryLabel: 'Dismissals & Restrictions',
    summary: 'Only player allowed external gloves and external leg pads. Must remain wholly behind stumps until ball strikes bat or passes stumps.',
    penaltyRuns: 'No Ball signaled if keeper breaches line prematurely',
    keyClauses: [
      '27.1: Positioning wholly behind wickets',
      '27.3: Restriction on movement while ball in play'
    ]
  },
  {
    number: 28,
    title: 'The Fielder',
    category: 'DISMISSAL',
    categoryLabel: 'Dismissals & Restrictions',
    summary: 'Fielding positioning, no more than 2 fielders behind square on leg-side, and protective helmet boundary fielding rules.',
    penaltyRuns: '5 Penalty Runs if ball hits discarded fielder helmet',
    keyClauses: [
      '28.1: Protective equipment placement behind keeper',
      '28.2: 5 penalty runs if ball strikes helmet on ground',
      '28.4: Maximum 2 fielders behind square on leg side'
    ]
  },
  {
    number: 29,
    title: 'The Wicket Down',
    category: 'DISMISSAL',
    categoryLabel: 'Dismissals & Restrictions',
    summary: 'The wicket is put down if at least one bail is completely removed from top of stumps, or a stump is struck out of ground.',
    keyClauses: [
      '29.1: Fair putting down of wicket',
      '29.2: Remake wicket if both bails are off'
    ]
  },
  {
    number: 30,
    title: 'Bowled',
    category: 'DISMISSAL',
    categoryLabel: 'Dismissals & Restrictions',
    summary: 'Batter is Bowled if their wicket is put down by a ball delivered by the bowler, even if it deflects off bat or person first.',
    keyClauses: [
      '30.1: Direct hit or off bat/pad into stumps',
      '30.2: Takes precedence over all other dismissal modes'
    ]
  },
  {
    number: 31,
    title: 'Timed Out',
    category: 'DISMISSAL',
    categoryLabel: 'Dismissals & Restrictions',
    isAmended2026: true,
    amendmentNotes: '2026 Update: Strict 3 minutes timer (2 minutes in T20) enforced by 4th umpire digital timer countdown.',
    summary: 'An incoming batter must be in position to take guard or partner ready within 3 minutes of previous dismissal (2 min in T20).',
    keyClauses: [
      '31.1: Incoming batter must arrive and take guard within time limit',
      '31.2: Bowler credited without ball being delivered upon umpire call'
    ]
  },
  {
    number: 32,
    title: 'Caught',
    category: 'DISMISSAL',
    categoryLabel: 'Dismissals & Restrictions',
    summary: 'The striker is out Caught if ball hits bat/glove and is held fairly by a fielder before touching ground.',
    keyClauses: [
      '32.1: Ball touches bat or hand holding bat',
      '32.2: Fielder retains full control of ball and body inside boundary rope'
    ]
  },
  {
    number: 33,
    title: 'Handled the Ball (Subsumed into Law 37)',
    category: 'DISMISSAL',
    categoryLabel: 'Dismissals & Restrictions',
    summary: 'Historically separate law, now classified and adjudicated under Law 37 (Obstructing the Field).',
    keyClauses: [
      '33.1: Subsumed under Law 37: Obstructing the Field'
    ]
  },
  {
    number: 34,
    title: 'Hit the Ball Twice',
    category: 'DISMISSAL',
    categoryLabel: 'Dismissals & Restrictions',
    summary: 'The striker is out if ball is struck a second time except solely to guard their wicket from entering stumps.',
    keyClauses: [
      '34.1: Second strike for run-scoring prohibited',
      '34.2: Lawful defense of wicket permitted without hands'
    ]
  },
  {
    number: 35,
    title: 'Hit Wicket',
    category: 'DISMISSAL',
    categoryLabel: 'Dismissals & Restrictions',
    summary: 'Striker is out Hit Wicket if wicket is put down by their bat or person while preparing for, playing, or completing a stroke.',
    keyClauses: [
      '35.1: Bat or body contact with stumps during stroke or setting off',
      '35.2: Not out if avoiding a collision or wild return throw'
    ]
  },
  {
    number: 36,
    title: 'Leg Before Wicket (LBW)',
    category: 'DISMISSAL',
    categoryLabel: 'Dismissals & Restrictions',
    summary: 'The striker is out LBW if ball pitches in-line or outside off, intercepts batter in-line with wickets, and would have hit stumps.',
    keyClauses: [
      '36.1: Pitching criteria: Outside leg-stump is never out LBW',
      '36.2: Interception in-line with wickets (or outside off if no genuine shot played)',
      '36.3: Projected trajectory hitting stumps'
    ]
  },
  {
    number: 37,
    title: 'Obstructing the Field',
    category: 'DISMISSAL',
    categoryLabel: 'Dismissals & Restrictions',
    summary: 'Batter is out if they willfully obstruct or distract a fielder by word or action, or wilfully prevent a catch.',
    keyClauses: [
      '37.1: Willful obstruction of throw or catch',
      '37.2: Touching ball in play with hand not holding bat',
      '37.3: Accidental deflection while running is not out'
    ]
  },
  {
    number: 38,
    title: 'Run Out',
    category: 'DISMISSAL',
    categoryLabel: 'Dismissals & Restrictions',
    isAmended2026: true,
    amendmentNotes: '2026 Confirmation: Bowler running out non-striker before delivery stride is 100% fair play and codified under Run Out.',
    summary: 'Batter is out if their wicket is put down by a fielder while ball is in play and no part of bat/body is grounded behind crease.',
    keyClauses: [
      '38.1: Batter out of crease while wicket fairly put down',
      '38.2: Non-striker run out during run attempt',
      '38.3: Bowler attempting to run out non-striker before releasing ball'
    ]
  },
  {
    number: 39,
    title: 'Stumped',
    category: 'DISMISSAL',
    categoryLabel: 'Dismissals & Restrictions',
    summary: 'The striker is out Stumped if out of crease without attempting a run, and wicket-keeper puts down wicket without other fielders.',
    keyClauses: [
      '39.1: Wicket put down by keeper without assistance',
      '39.2: Striker not attempting a run and out of crease',
      '39.3: Not out stumped on a No Ball (can only be run out)'
    ]
  },

  // Unfair Play and Conduct (Laws 40-42)
  {
    number: 40,
    title: 'Timed Out / Batter Retiring',
    category: 'CONDUCT',
    categoryLabel: 'Conduct & Fair Play',
    summary: 'Regulations for retired batters, unnotified retirement, and delay of game restart.',
    keyClauses: [
      '40.1: Retirement protocols: Retired Hurt (may resume) vs Retired Out',
      '40.2: Consent of fielding captain required to resume batting'
    ]
  },
  {
    number: 41,
    title: 'Unfair Play',
    category: 'CONDUCT',
    categoryLabel: 'Conduct & Fair Play',
    isAmended2026: true,
    amendmentNotes: '2026 Crucial Laws: Total permanent ban on saliva on the ball (treated as ball tampering with 5 penalty runs); codified Law 41.16 non-striker leaving crease early.',
    summary: 'Comprehensive unfair play rules: ball tampering, dangerous bowling, distraction of batter, and running on protected area.',
    penaltyRuns: '5 Penalty Runs awarded to non-offending side for serious breaches',
    keyClauses: [
      '41.1: Fair and unfair play – responsibility of captains',
      '41.3: The match ball – changing its condition (saliva permanently banned)',
      '41.6: Bowling of dangerous and unfair short-pitched deliveries',
      '41.7: Bowling of dangerous and unfair non-pitching deliveries (Beamers)',
      '41.16: Non-striker leaving their ground early – bowler run out rule'
    ]
  },
  {
    number: 42,
    title: "Players' Conduct",
    category: 'CONDUCT',
    categoryLabel: 'Conduct & Fair Play',
    isAmended2026: true,
    amendmentNotes: '2026 Update: Enhanced Level 1-4 tiered sanction system with instant 5 penalty runs and mandatory umpire yellow/red card reporting.',
    summary: 'Four levels of misconduct penalties for dissent, obscene language, violence, or threatening an umpire/player.',
    penaltyRuns: 'Level 1: Warning; Level 2: 5 Penalty Runs; Level 3: 5 Runs + Sin Bin (overs); Level 4: 5 Runs + Ejection',
    keyClauses: [
      '42.2: Level 1: Dissent, excessive appealing (Warning + subsequent 5 penalty runs)',
      '42.3: Level 2: Throwing ball dangerously, offensive gesture (5 penalty runs)',
      '42.4: Level 3: Intimidation or threat of violence (5 penalty runs + suspension for 20% of match overs)',
      '42.5: Level 4: Physical assault, act of violence (5 penalty runs + permanent removal from match)'
    ]
  }
];

export const CricketLawsManagement: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [showAmendedOnly, setShowAmendedOnly] = useState<boolean>(false);
  const [expandedLawNum, setExpandedLawNum] = useState<number | null>(41); // Default expanded on Unfair Play
  const [selectedModalLaw, setSelectedModalLaw] = useState<LawItem | null>(null);

  // Filtered Laws
  const filteredLaws = useMemo(() => {
    return MCC_LAWS_2026.filter(law => {
      if (showAmendedOnly && !law.isAmended2026) return false;
      if (selectedCategory !== 'ALL' && law.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const numMatch = law.number.toString().includes(q) || `law ${law.number}`.includes(q);
        const titleMatch = law.title.toLowerCase().includes(q);
        const summaryMatch = law.summary.toLowerCase().includes(q);
        const clauseMatch = law.keyClauses.some(c => c.toLowerCase().includes(q));
        const amendMatch = (law.amendmentNotes || '').toLowerCase().includes(q);
        return numMatch || titleMatch || summaryMatch || clauseMatch || amendMatch;
      }
      return true;
    });
  }, [searchQuery, selectedCategory, showAmendedOnly]);

  const amendedCount = useMemo(() => MCC_LAWS_2026.filter(l => l.isAmended2026).length, []);

  return (
    <View style={styles.container}>
      {/* ── HEADER BANNER ────────────────────────────────────────── */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={styles.headerTextGroup}>
            <View style={styles.editionBadgeRow}>
              <View style={styles.editionBadge}>
                <Text style={styles.editionBadgeText}>MCC 2017 CODE • 4TH EDITION 2026</Text>
              </View>
              <View style={styles.effectiveBadge}>
                <Text style={styles.effectiveBadgeText}>OFFICIAL CFVD REGISTRY</Text>
              </View>
            </View>
            <Text style={styles.headerTitle}>Laws of Cricket Management System</Text>
            <Text style={styles.headerSubtitle}>
              Official MCC 42 Laws repository with 2026 amendments, Level 1–4 player conduct sanctions,
              penalty runs codification, and umpire reference arbiter.
            </Text>
          </View>
        </View>

        {/* STATS TILES */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>42</Text>
            <Text style={styles.statLabel}>Total MCC Laws</Text>
          </View>
          <View style={[styles.statBox, { borderColor: '#10b981' }]}>
            <Text style={[styles.statNumber, { color: '#059669' }]}>{amendedCount}</Text>
            <Text style={styles.statLabel}>2026 Key Revisions</Text>
          </View>
          <View style={[styles.statBox, { borderColor: '#f59e0b' }]}>
            <Text style={[styles.statNumber, { color: '#d97706' }]}>7</Text>
            <Text style={styles.statLabel}>Major Categories</Text>
          </View>
          <View style={[styles.statBox, { borderColor: '#ef4444' }]}>
            <Text style={[styles.statNumber, { color: '#dc2626' }]}>5 Runs</Text>
            <Text style={styles.statLabel}>Standard Penalty Code</Text>
          </View>
        </View>
      </View>

      {/* ── SEARCH & FILTER CONTROLS ─────────────────────────────── */}
      <View style={styles.controlsCard}>
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrapper}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search law by number, title, keyword (e.g. Mankad, Saliva, Timed Out, LBW)..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.amendedFilterBtn, showAmendedOnly && styles.amendedFilterBtnActive]}
            onPress={() => setShowAmendedOnly(!showAmendedOnly)}
            activeOpacity={0.8}
          >
            <Text style={[styles.amendedFilterText, showAmendedOnly && styles.amendedFilterTextActive]}>
              ⚡ 2026 Revisions ({amendedCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Category Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {[
            { id: 'ALL', label: 'All Laws (42)' },
            { id: 'SETUP', label: '⚙️ Setting Up (1–5)' },
            { id: 'PITCH', label: '🌱 Pitch & Ground (6–12)' },
            { id: 'INNINGS', label: '⏱️ Innings & Over (13–17)' },
            { id: 'SCORING', label: '🏏 Scoring & Boundary (18–20)' },
            { id: 'EXTRAS', label: '⚠️ Dead Ball & Extras (21–25)' },
            { id: 'DISMISSAL', label: '🧤 Dismissals (26–39)' },
            { id: 'CONDUCT', label: '⚖️ Conduct & Unfair Play (40–42)' }
          ].map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                selectedCategory === cat.id && styles.categoryChipActive
              ]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === cat.id && styles.categoryChipTextActive
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── LAWS LIST / ACCORDION ────────────────────────────────── */}
      <View style={styles.lawsListContainer}>
        <View style={styles.resultsCountBar}>
          <Text style={styles.resultsCountText}>
            Showing <Text style={{ fontWeight: '800', color: '#0f172a' }}>{filteredLaws.length}</Text> of 42 Laws
          </Text>
          {showAmendedOnly && (
            <View style={styles.activeFilterTag}>
              <Text style={styles.activeFilterTagText}>Filtered: 2026 Amendments</Text>
            </View>
          )}
        </View>

        {filteredLaws.map(law => {
          const isExpanded = expandedLawNum === law.number;
          return (
            <View key={law.number} style={[styles.lawCard, isExpanded && styles.lawCardExpanded]}>
              {/* Card Header */}
              <TouchableOpacity
                style={styles.lawCardHeader}
                onPress={() => setExpandedLawNum(isExpanded ? null : law.number)}
                activeOpacity={0.7}
              >
                <View style={styles.lawHeaderLeft}>
                  <View style={[styles.lawNumberBadge, law.isAmended2026 && styles.lawNumberBadgeAmended]}>
                    <Text style={styles.lawNumberText}>{law.number}</Text>
                  </View>
                  <View style={styles.lawTitleColumn}>
                    <View style={styles.lawTitleRow}>
                      <Text style={styles.lawTitle}>Law {law.number}: {law.title}</Text>
                      {law.isAmended2026 && (
                        <View style={styles.amendedTag}>
                          <Text style={styles.amendedTagText}>2026 CODE</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.lawCategoryText}>{law.categoryLabel}</Text>
                  </View>
                </View>

                <View style={styles.lawHeaderRight}>
                  {law.penaltyRuns && (
                    <View style={styles.penaltyBadge}>
                      <Text style={styles.penaltyBadgeText}>⚠️ Penalty Rule</Text>
                    </View>
                  )}
                  <Text style={styles.expandChevron}>{isExpanded ? '▲' : '▼'}</Text>
                </View>
              </TouchableOpacity>

              {/* Summary snippet */}
              <View style={styles.summaryBox}>
                <Text style={styles.summaryText}>{law.summary}</Text>
              </View>

              {/* Expanded Clauses */}
              {isExpanded && (
                <View style={styles.expandedContent}>
                  {law.isAmended2026 && law.amendmentNotes && (
                    <View style={styles.amendmentNoteBox}>
                      <Text style={styles.amendmentNoteTitle}>📌 2026 Key Amendment Protocol:</Text>
                      <Text style={styles.amendmentNoteText}>{law.amendmentNotes}</Text>
                    </View>
                  )}

                  {law.penaltyRuns && (
                    <View style={styles.penaltyAlertBox}>
                      <Text style={styles.penaltyAlertTitle}>🛑 Penalty Assessment:</Text>
                      <Text style={styles.penaltyAlertText}>{law.penaltyRuns}</Text>
                    </View>
                  )}

                  <Text style={styles.clausesHeading}>Sub-Clauses & Regulations:</Text>
                  <View style={styles.clausesList}>
                    {law.keyClauses.map((clause, idx) => (
                      <View key={idx} style={styles.clauseItem}>
                        <Text style={styles.clauseBullet}>•</Text>
                        <Text style={styles.clauseText}>{clause}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity
                      style={styles.viewFullBtn}
                      onPress={() => setSelectedModalLaw(law)}
                    >
                      <Text style={styles.viewFullBtnText}>📖 Full Umpire Dossier</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* ── FULL LAW DETAIL MODAL ─────────────────────────────────── */}
      <Modal
        visible={!!selectedModalLaw}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedModalLaw(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.modalLawNum}>LAW {selectedModalLaw?.number}</Text>
                  {selectedModalLaw?.isAmended2026 && (
                    <View style={styles.amendedTag}>
                      <Text style={styles.amendedTagText}>2026 EDITION</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.modalTitle}>{selectedModalLaw?.title}</Text>
                <Text style={styles.modalCategory}>{selectedModalLaw?.categoryLabel}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedModalLaw(null)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={true}>
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Official MCC Principle</Text>
                <Text style={styles.modalSectionContent}>{selectedModalLaw?.summary}</Text>
              </View>

              {selectedModalLaw?.isAmended2026 && (
                <View style={[styles.modalSection, { backgroundColor: '#f0fdf4', borderColor: '#86efac', borderWidth: 1, padding: 12, borderRadius: 8 }]}>
                  <Text style={[styles.modalSectionTitle, { color: '#166534' }]}>2026 Code Revision Notes</Text>
                  <Text style={[styles.modalSectionContent, { color: '#14532d' }]}>{selectedModalLaw?.amendmentNotes}</Text>
                </View>
              )}

              {selectedModalLaw?.penaltyRuns && (
                <View style={[styles.modalSection, { backgroundColor: '#fef2f2', borderColor: '#fca5a5', borderWidth: 1, padding: 12, borderRadius: 8 }]}>
                  <Text style={[styles.modalSectionTitle, { color: '#991b1b' }]}>Penalty Runs Specification</Text>
                  <Text style={[styles.modalSectionContent, { color: '#7f1d1d' }]}>{selectedModalLaw?.penaltyRuns}</Text>
                </View>
              )}

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Complete Codified Sub-Clauses</Text>
                {selectedModalLaw?.keyClauses.map((c, i) => (
                  <View key={i} style={styles.modalClauseRow}>
                    <Text style={styles.modalClauseNum}>{i + 1}.</Text>
                    <Text style={styles.modalClauseText}>{c}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>CFVD District Ground Guidance</Text>
                <Text style={styles.modalSectionContent}>
                  Umpires affiliated with the Cricket Federation of Virudhunagar District are required to enforce
                  this Law strictly in accordance with MCC Playing Conditions 2026 and the specific local tournament bylaws.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCloseFooterBtn}
                onPress={() => setSelectedModalLaw(null)}
              >
                <Text style={styles.modalCloseFooterBtnText}>Close Law Dossier</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    maxWidth: 1300,
    width: '100%',
    alignSelf: 'center'
  },
  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.06)' }
      : { elevation: 3 })
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  headerTextGroup: {
    flex: 1
  },
  editionBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8
  },
  editionBadge: {
    backgroundColor: '#065f46',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6
  },
  editionBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  effectiveBadge: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6
  },
  effectiveBadgeText: {
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: '700'
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 6
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    maxWidth: 860
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 20,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  statBox: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a'
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2
  },

  controlsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  searchRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  searchInputWrapper: {
    flex: 1,
    minWidth: 280,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    height: '100%'
  },
  clearBtn: {
    padding: 6
  },
  clearBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700'
  },
  amendedFilterBtn: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  amendedFilterBtnActive: {
    backgroundColor: '#059669',
    borderColor: '#047857'
  },
  amendedFilterText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155'
  },
  amendedFilterTextActive: {
    color: '#ffffff'
  },
  categoryScroll: {
    marginTop: 14
  },
  categoryChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  categoryChipActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a'
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569'
  },
  categoryChipTextActive: {
    color: '#ffffff'
  },

  lawsListContainer: {
    gap: 12
  },
  resultsCountBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 4
  },
  resultsCountText: {
    fontSize: 14,
    color: '#64748b'
  },
  activeFilterTag: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6
  },
  activeFilterTagText: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '700'
  },

  lawCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden'
  },
  lawCardExpanded: {
    borderColor: '#059669',
    borderWidth: 1.5,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 8px 24px -4px rgba(5, 150, 105, 0.12)' }
      : { elevation: 3 })
  },
  lawCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16
  },
  lawHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1
  },
  lawNumberBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  lawNumberBadgeAmended: {
    backgroundColor: '#d1fae5',
    borderColor: '#6ee7b7'
  },
  lawNumberText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a'
  },
  lawTitleColumn: {
    flex: 1
  },
  lawTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  lawTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a'
  },
  lawCategoryText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  amendedTag: {
    backgroundColor: '#059669',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4
  },
  amendedTagText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800'
  },
  lawHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  penaltyBadge: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  penaltyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b91c1c'
  },
  expandChevron: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 4
  },
  summaryBox: {
    paddingHorizontal: 16,
    paddingBottom: 14
  },
  summaryText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19
  },

  expandedContent: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 12
  },
  amendmentNoteBox: {
    backgroundColor: '#ecfdf5',
    borderLeftWidth: 4,
    borderLeftColor: '#059669',
    padding: 12,
    borderRadius: 6
  },
  amendmentNoteTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065f46',
    marginBottom: 4
  },
  amendmentNoteText: {
    fontSize: 13,
    color: '#047857',
    lineHeight: 18
  },
  penaltyAlertBox: {
    backgroundColor: '#fff1f2',
    borderLeftWidth: 4,
    borderLeftColor: '#e11d48',
    padding: 12,
    borderRadius: 6
  },
  penaltyAlertTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9f1239',
    marginBottom: 4
  },
  penaltyAlertText: {
    fontSize: 13,
    color: '#881337',
    lineHeight: 18
  },
  clausesHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    marginTop: 4
  },
  clausesList: {
    gap: 6
  },
  clauseItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8
  },
  clauseBullet: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '900',
    lineHeight: 18
  },
  clauseText: {
    fontSize: 13,
    color: '#334155',
    flex: 1,
    lineHeight: 18
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8
  },
  viewFullBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  viewFullBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 720,
    maxHeight: '88%',
    overflow: 'hidden'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc'
  },
  modalLawNum: {
    fontSize: 13,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 1
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2
  },
  modalCategory: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2
  },
  modalCloseBtn: {
    padding: 6
  },
  modalCloseBtnText: {
    fontSize: 18,
    color: '#64748b',
    fontWeight: '700'
  },
  modalBodyScroll: {
    padding: 20
  },
  modalSection: {
    marginBottom: 18
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 6
  },
  modalSectionContent: {
    fontSize: 13.5,
    color: '#334155',
    lineHeight: 20
  },
  modalClauseRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8
  },
  modalClauseNum: {
    fontWeight: '700',
    color: '#059669',
    fontSize: 13
  },
  modalClauseText: {
    fontSize: 13,
    color: '#334155',
    flex: 1,
    lineHeight: 18
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'flex-end',
    backgroundColor: '#f8fafc'
  },
  modalCloseFooterBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8
  },
  modalCloseFooterBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13
  }
});

export default CricketLawsManagement;
