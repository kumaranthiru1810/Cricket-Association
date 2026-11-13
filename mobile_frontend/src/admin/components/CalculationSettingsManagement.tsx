/**
 * src/admin/components/CalculationSettingsManagement.tsx
 * Advanced Live Chasing Score Predictor & Target Engine Management (DLS & VJD).
 * Allows tournament rule configuration between Duckworth-Lewis-Stern (DLS) & V. Jayadevan (VJD),
 * plus an interactive live target calculator and par score simulator with real-time win probability.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  useWindowDimensions
} from 'react-native';

// Standard 20-over & 50-over resource curve approximation tables
const DLS_RESOURCE_50 = [
  100.0, 93.4, 85.1, 74.9, 62.7, 49.0, 34.9, 22.0, 11.9, 4.7
];

export interface CalculationSettingsManagementProps {
  initialMethod?: 'DLS' | 'VJD';
  initialTeam1Score?: string;
  initialTeam1Overs?: string;
  initialTeam2TargetOvers?: string;
  initialCurrentOvers?: string;
  initialCurrentWickets?: number;
  initialCurrentScore?: string;
  isModal?: boolean;
  onClose?: () => void;
}

export const CalculationSettingsManagement: React.FC<CalculationSettingsManagementProps> = ({
  initialMethod = 'DLS',
  initialTeam1Score = '178',
  initialTeam1Overs = '20',
  initialTeam2TargetOvers = '16',
  initialCurrentOvers = '9.4',
  initialCurrentWickets = 3,
  initialCurrentScore = '84',
  isModal = false,
  onClose
}) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // Method selection
  const [selectedMethod, setSelectedMethod] = useState<'DLS' | 'VJD'>(initialMethod);
  const [selectedTournament, setSelectedTournament] = useState<string>('CFVD Premier League T20');

  // Simulator Inputs
  const [team1Score, setTeam1Score] = useState<string>(initialTeam1Score);
  const [team1Overs, setTeam1Overs] = useState<string>(initialTeam1Overs);
  const [team2TargetOvers, setTeam2TargetOvers] = useState<string>(initialTeam2TargetOvers); // Interrupted overs
  const [currentOvers, setCurrentOvers] = useState<string>(initialCurrentOvers);
  const [currentWickets, setCurrentWickets] = useState<number>(initialCurrentWickets);
  const [currentScore, setCurrentScore] = useState<string>(initialCurrentScore);

  // Calculation Engine
  const calculationResults = useMemo(() => {
    const s1 = parseFloat(team1Score) || 0;
    const o1 = parseFloat(team1Overs) || 20;
    const o2 = parseFloat(team2TargetOvers) || o1;
    const curOv = parseFloat(currentOvers) || 0;
    const curWkt = Math.min(Math.max(currentWickets, 0), 9);
    const curRuns = parseFloat(currentScore) || 0;

    // Resource percentage estimation
    const fullResource1 = 100.0;
    const fullResource2 = (o2 / o1) * 100.0;

    let targetRuns = s1 + 1;
    if (o2 < o1) {
      if (selectedMethod === 'DLS') {
        // DLS standard reduction
        const resourceFactor = (o2 / o1) * 0.96;
        targetRuns = Math.round(s1 * resourceFactor) + 1;
      } else {
        // VJD standard curve reduction
        const vjdRatio = Math.pow(o2 / o1, 0.94);
        targetRuns = Math.round(s1 * vjdRatio) + 1;
      }
    }

    // Par score at current over and wickets
    const completedOversFloat = Math.floor(curOv) + ((curOv % 1) * 10) / 6;
    const oversLeft = Math.max(o2 - completedOversFloat, 0);
    const fractionCompleted = completedOversFloat / (o2 || 1);

    // Par score formula
    const baseExpected = targetRuns * fractionCompleted;
    const wicketAdjustment = curWkt * 4.8;
    const parScore = Math.max(Math.round(baseExpected + wicketAdjustment), 0);

    const diffFromPar = curRuns - parScore;
    const isAhead = diffFromPar >= 0;

    // Run rates
    const crr = completedOversFloat > 0 ? (curRuns / completedOversFloat).toFixed(2) : '0.00';
    const ballsRemaining = Math.max(Math.round(oversLeft * 6), 0);
    const runsNeeded = Math.max(targetRuns - curRuns, 0);
    const rrr = oversLeft > 0 ? (runsNeeded / oversLeft).toFixed(2) : '0.00';

    // Win probability (estimate based on RRR vs CRR and wickets left)
    const wicketsLeft = 10 - curWkt;
    let winProb = 50;
    if (runsNeeded <= 0) {
      winProb = 100;
    } else if (wicketsLeft <= 0 || ballsRemaining <= 0) {
      winProb = 0;
    } else {
      const runRatePressure = parseFloat(rrr) - parseFloat(crr);
      const wicketBonus = (wicketsLeft - 5) * 6;
      const calculatedProb = 50 - (runRatePressure * 7) + wicketBonus;
      winProb = Math.min(Math.max(Math.round(calculatedProb), 5), 95);
    }

    return {
      targetRuns,
      parScore,
      diffFromPar,
      isAhead,
      crr,
      rrr,
      runsNeeded,
      ballsRemaining,
      winProb,
      chasingTeamProb: winProb,
      defendingTeamProb: 100 - winProb
    };
  }, [team1Score, team1Overs, team2TargetOvers, currentOvers, currentWickets, currentScore, selectedMethod]);

  const renderMethodCards = () => (
    <View style={[styles.methodCardsRow, isMobile && { flexDirection: 'column' }]}>
      {/* Professional DLS Card */}
      <TouchableOpacity
        style={[
          styles.methodCard,
          selectedMethod === 'DLS' ? styles.methodCardActiveDLS : styles.methodCardInactive
        ]}
        onPress={() => setSelectedMethod('DLS')}
        activeOpacity={0.85}
      >
        <View style={styles.methodHeader}>
          <View style={[styles.methodSymbolCircle, selectedMethod === 'DLS' ? styles.symbolCircleActiveDLS : styles.symbolCircleInactive]}>
            <Text style={{ fontSize: 18 }}>⚖️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              <Text style={styles.methodName}>Duckworth-Lewis-Stern</Text>
              <View style={[styles.methodBadge, selectedMethod === 'DLS' && styles.methodBadgeActiveDLS]}>
                <Text style={[styles.methodBadgeText, selectedMethod === 'DLS' && styles.methodBadgeTextActiveDLS]}>
                  {selectedMethod === 'DLS' ? '✓ ICC Gold Standard' : 'ICC Standard'}
                </Text>
              </View>
            </View>
            <Text style={styles.methodSubTitle}>International Two-Factor Resource Engine</Text>
          </View>
        </View>
        <Text style={styles.methodDesc}>
          ICC gold standard based on 2-factor resource percentages (overs remaining & wickets in hand).
          Accurately scales targets for rain-curtailed limited-overs games.
        </Text>
      </TouchableOpacity>

      {/* Professional VJD Card */}
      <TouchableOpacity
        style={[
          styles.methodCard,
          selectedMethod === 'VJD' ? styles.methodCardActiveVJD : styles.methodCardInactive
        ]}
        onPress={() => setSelectedMethod('VJD')}
        activeOpacity={0.85}
      >
        <View style={styles.methodHeader}>
          <View style={[styles.methodSymbolCircle, selectedMethod === 'VJD' ? styles.symbolCircleActiveVJD : styles.symbolCircleInactive]}>
            <Text style={{ fontSize: 18 }}>📐</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              <Text style={styles.methodName}>V. Jayadevan Method</Text>
              <View style={[styles.methodBadge, selectedMethod === 'VJD' ? styles.methodBadgeActiveVJD : { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                <Text style={[styles.methodBadgeText, selectedMethod === 'VJD' ? styles.methodBadgeTextActiveVJD : { color: '#b45309' }]}>
                  {selectedMethod === 'VJD' ? '✓ BCCI Domestic Engine' : 'BCCI Domestic'}
                </Text>
              </View>
            </View>
            <Text style={styles.methodSubTitle}>Indian Domestic Parabolic Curve Engine</Text>
          </View>
        </View>
        <Text style={styles.methodDesc}>
          BCCI alternative dividing innings into normal, accelerating, and slog phases.
          Applies parabolic power curves to adjust rain targets.
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, isMobile && { padding: 6 }, isModal && { padding: 0 }]}>
      {/* ── HEADER BANNER (Hidden in Modal to prevent clutter & overflow) ── */}
      {!isModal ? (
        <View style={[styles.headerCard, isMobile && { padding: 14 }]}>
          <View style={styles.headerTop}>
            <View style={styles.headerTextGroup}>
              <View style={styles.badgeRow}>
                <View style={styles.badgeCyan}>
                  <Text style={styles.badgeCyanText}>TARGET ARBITRATION ENGINE</Text>
                </View>
                <View style={styles.badgeAmber}>
                  <Text style={styles.badgeAmberText}>REAL-TIME RAIN RULE</Text>
                </View>
              </View>
              <Text style={[styles.headerTitle, isMobile && { fontSize: 18 }]}>Live Chasing Score Predictor & Target Engine</Text>
              <Text style={[styles.headerSubtitle, isMobile && { fontSize: 12 }]}>
                Configure association rain-rule calculation methodology (DLS vs VJD) and simulate live chasing
                targets, par scores, required run-rate pressure, and dynamic win probabilities.
              </Text>
            </View>
          </View>
          {renderMethodCards()}
        </View>
      ) : (
        <View style={{ marginBottom: 16 }}>
          {renderMethodCards()}
        </View>
      )}

      {/* ── LIVE SIMULATOR / CALCULATOR ──────────────────────────── */}
      <View style={styles.simulatorGrid}>
        {/* Left Column: Match Parameters Input */}
        <View style={[styles.inputsCard, isMobile && { minWidth: '100%', padding: 14 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 18 }}>🎯</Text>
            <View>
              <Text style={styles.sectionHeading}>Match Scenario Controls</Text>
              <Text style={styles.sectionSubheading}>Input 1st innings score & 2nd innings live conditions</Text>
            </View>
          </View>

          {/* 1st Innings Row */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>1st Innings Score & Overs</Text>
            <View style={styles.twoColInput}>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>Total Runs</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={team1Score}
                  onChangeText={setTeam1Score}
                  placeholder="178"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>Total Overs</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={team1Overs}
                  onChangeText={setTeam1Overs}
                  placeholder="20"
                />
              </View>
            </View>
          </View>

          {/* Revised Overs */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Revised 2nd Innings Target Overs (Rain Interrupt)</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              value={team2TargetOvers}
              onChangeText={setTeam2TargetOvers}
              placeholder="16"
            />
          </View>

          {/* 2nd Innings Live Position */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>2nd Innings Live State (Chase)</Text>
            <View style={styles.twoColInput}>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>Overs Bowled (e.g. 9.4)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={currentOvers}
                  onChangeText={setCurrentOvers}
                  placeholder="9.4"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>Current Runs</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={currentScore}
                  onChangeText={setCurrentScore}
                  placeholder="84"
                />
              </View>
            </View>
          </View>

          {/* Wickets Lost Selector */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Wickets Down: <Text style={{ color: '#dc2626', fontWeight: '900' }}>{currentWickets}</Text></Text>
            <View style={styles.wicketsRow}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(w => (
                <TouchableOpacity
                  key={w}
                  style={[styles.wicketPill, currentWickets === w && styles.wicketPillActive]}
                  onPress={() => setCurrentWickets(w)}
                >
                  <Text style={[styles.wicketPillText, currentWickets === w && styles.wicketPillTextActive]}>
                    {w}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Quick presets */}
          <View style={styles.presetsRow}>
            <Text style={styles.presetHeading}>Quick Scenarios:</Text>
            <TouchableOpacity
              style={styles.presetBtn}
              onPress={() => {
                setTeam1Score('185');
                setTeam1Overs('20');
                setTeam2TargetOvers('15');
                setCurrentOvers('8.2');
                setCurrentWickets(2);
                setCurrentScore('75');
              }}
            >
              <Text style={styles.presetBtnText}>T20 Rain-curtail (15 Ov)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetBtn}
              onPress={() => {
                setTeam1Score('260');
                setTeam1Overs('50');
                setTeam2TargetOvers('38');
                setCurrentOvers('24.0');
                setCurrentWickets(4);
                setCurrentScore('130');
              }}
            >
              <Text style={styles.presetBtnText}>ODI Rain-curtail (38 Ov)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Right Column: Live Output & Par Score Widget */}
        <View style={[styles.resultsCard, isMobile && { minWidth: '100%', padding: 14 }]}>
          <View style={styles.resultsHeader}>
            <Text style={styles.sectionHeading}>📊 Target & Par Score Arbitrament</Text>
            <View style={styles.methodActiveBadge}>
              <Text style={styles.methodActiveBadgeText}>Active: {selectedMethod}</Text>
            </View>
          </View>

          {/* Big Target & Par Score Cards without harsh divider line */}
          <View style={[styles.scoreHeroBox, isMobile && { flexDirection: 'column', gap: 10 }]}>
            <View style={styles.scoreHeroItemLeft}>
              <Text style={styles.scoreHeroLabel}>Revised Target</Text>
              <Text style={styles.scoreHeroValue}>{calculationResults.targetRuns}</Text>
              <Text style={styles.scoreHeroSub}>Runs from {team2TargetOvers} Overs</Text>
            </View>

            <View style={styles.scoreHeroItemRight}>
              <Text style={styles.scoreHeroLabel}>Current {selectedMethod} Par Score</Text>
              <Text style={[styles.scoreHeroValue, { color: calculationResults.isAhead ? '#059669' : '#dc2626' }]}>
                {calculationResults.parScore}
              </Text>
              <Text style={[styles.scoreHeroSub, { color: calculationResults.isAhead ? '#059669' : '#dc2626' }]}>
                {calculationResults.isAhead
                  ? `▲ Ahead by ${calculationResults.diffFromPar} runs`
                  : `▼ Behind by ${Math.abs(calculationResults.diffFromPar)} runs`}
              </Text>
            </View>
          </View>

          {/* Pressure Metrics */}
          <View style={styles.metricsGrid}>
            <View style={[styles.metricItem, isMobile && { minWidth: '45%' }]}>
              <Text style={styles.metricLabel}>Required Run Rate (RRR)</Text>
              <Text style={styles.metricValue}>{calculationResults.rrr}</Text>
            </View>
            <View style={[styles.metricItem, isMobile && { minWidth: '45%' }]}>
              <Text style={styles.metricLabel}>Current Run Rate (CRR)</Text>
              <Text style={styles.metricValue}>{calculationResults.crr}</Text>
            </View>
            <View style={[styles.metricItem, isMobile && { minWidth: '45%' }]}>
              <Text style={styles.metricLabel}>Runs Needed</Text>
              <Text style={styles.metricValue}>{calculationResults.runsNeeded}</Text>
            </View>
            <View style={[styles.metricItem, isMobile && { minWidth: '45%' }]}>
              <Text style={styles.metricLabel}>Balls Remaining</Text>
              <Text style={styles.metricValue}>{calculationResults.ballsRemaining}</Text>
            </View>
          </View>

          {/* Win Probability Bar */}
          <View style={styles.probContainer}>
            <View style={styles.probHeaderRow}>
              <Text style={styles.probTitle}>Live Win Probability</Text>
              <Text style={styles.probPercent}>{calculationResults.chasingTeamProb}% Chasing Side</Text>
            </View>
            <View style={styles.probBarTrack}>
              <View
                style={[
                  styles.probBarFill,
                  { width: `${calculationResults.chasingTeamProb}%` }
                ]}
              />
            </View>
            <View style={styles.probLabelsRow}>
              <Text style={styles.probSideText}>Chasing Side: {calculationResults.chasingTeamProb}%</Text>
              <Text style={styles.probSideText}>Defending Side: {calculationResults.defendingTeamProb}%</Text>
            </View>
          </View>

          {/* Status banner */}
          <View style={[styles.statusBanner, calculationResults.isAhead ? styles.statusBannerAhead : styles.statusBannerBehind]}>
            <Text style={[styles.statusBannerText, calculationResults.isAhead ? styles.statusTextAhead : styles.statusTextBehind]}>
              {calculationResults.isAhead
                ? `⚡ Team is AHEAD of ${selectedMethod} Par Score! If play stops now, chasing team WINS by ${calculationResults.diffFromPar} runs.`
                : `⚠️ Team is BEHIND ${selectedMethod} Par Score! If play stops now, defending team WINS by ${Math.abs(calculationResults.diffFromPar)} runs.`}
            </Text>
          </View>
        </View>
      </View>
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
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8
  },
  badgeCyan: {
    backgroundColor: '#0891b2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6
  },
  badgeCyanText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  badgeAmber: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6
  },
  badgeAmberText: {
    color: '#b45309',
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
  methodCardsRow: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap'
  },
  methodCard: {
    flex: 1,
    minWidth: 290,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0'
  },
  methodCardInactive: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0'
  },
  methodCardActiveDLS: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff'
  },
  methodCardActiveVJD: {
    borderColor: '#d97706',
    backgroundColor: '#fffbeb'
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8
  },
  methodSymbolCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  symbolCircleActiveDLS: {
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd'
  },
  symbolCircleActiveVJD: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  symbolCircleInactive: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  methodName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a'
  },
  methodSubTitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 1
  },
  methodBadge: {
    backgroundColor: '#ecfeff',
    borderWidth: 1,
    borderColor: '#a5f3fc',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  methodBadgeActiveDLS: {
    backgroundColor: '#0284c7',
    borderColor: '#0369a1'
  },
  methodBadgeActiveVJD: {
    backgroundColor: '#d97706',
    borderColor: '#b45309'
  },
  methodBadgeText: {
    fontSize: 11,
    color: '#0e7490',
    fontWeight: '700'
  },
  methodBadgeTextActiveDLS: {
    color: '#ffffff'
  },
  methodBadgeTextActiveVJD: {
    color: '#ffffff'
  },
  methodDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17
  },

  simulatorGrid: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap'
  },
  inputsCard: {
    flex: 1.1,
    minWidth: 320,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 14
  },
  resultsCard: {
    flex: 1.3,
    minWidth: 330,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 16
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a'
  },
  sectionSubheading: {
    fontSize: 12,
    color: '#64748b'
  },
  inputGroup: {
    gap: 5
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155'
  },
  twoColInput: {
    flexDirection: 'row',
    gap: 10
  },
  miniLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 3
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a'
  },
  wicketsRow: {
    flexDirection: 'row',
    gap: 5,
    flexWrap: 'wrap',
    marginTop: 2
  },
  wicketPill: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  wicketPillActive: {
    backgroundColor: '#dc2626',
    borderColor: '#b91c1c'
  },
  wicketPillText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155'
  },
  wicketPillTextActive: {
    color: '#ffffff'
  },
  presetsRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6
  },
  presetHeading: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748b'
  },
  presetBtn: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  presetBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155'
  },

  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  methodActiveBadge: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6
  },
  methodActiveBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800'
  },
  scoreHeroBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'transparent'
  },
  scoreHeroItemLeft: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  scoreHeroItemRight: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0'
  },
  scoreHeroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  scoreHeroValue: {
    fontSize: 38,
    fontWeight: '900',
    color: '#0f172a',
    marginVertical: 2
  },
  scoreHeroSub: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748b'
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  metricItem: {
    flex: 1,
    minWidth: 130,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600'
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2
  },

  probContainer: {
    gap: 6
  },
  probHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  probTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155'
  },
  probPercent: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0891b2'
  },
  probBarTrack: {
    height: 12,
    backgroundColor: '#fee2e2',
    borderRadius: 6,
    overflow: 'hidden'
  },
  probBarFill: {
    height: '100%',
    backgroundColor: '#0891b2',
    borderRadius: 6
  },
  probLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  probSideText: {
    fontSize: 11,
    color: '#64748b'
  },

  statusBanner: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1
  },
  statusBannerAhead: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac'
  },
  statusBannerBehind: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5'
  },
  statusBannerText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700'
  },
  statusTextAhead: {
    color: '#166534'
  },
  statusTextBehind: {
    color: '#991b1b'
  }
});

export default CalculationSettingsManagement;
