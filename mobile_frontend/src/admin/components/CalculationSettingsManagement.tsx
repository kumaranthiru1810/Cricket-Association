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
  Platform
} from 'react-native';

// Standard 20-over & 50-over resource curve approximation tables
const DLS_RESOURCE_50 = [
  100.0, 93.4, 85.1, 74.9, 62.7, 49.0, 34.9, 22.0, 11.9, 4.7
];

export const CalculationSettingsManagement: React.FC = () => {
  // Method selection
  const [selectedMethod, setSelectedMethod] = useState<'DLS' | 'VJD'>('DLS');
  const [selectedTournament, setSelectedTournament] = useState<string>('CFVD Premier League T20');

  // Simulator Inputs
  const [team1Score, setTeam1Score] = useState<string>('178');
  const [team1Overs, setTeam1Overs] = useState<string>('20');
  const [team2TargetOvers, setTeam2TargetOvers] = useState<string>('16'); // Interrupted overs
  const [currentOvers, setCurrentOvers] = useState<string>('9.4');
  const [currentWickets, setCurrentWickets] = useState<number>(3);
  const [currentScore, setCurrentScore] = useState<string>('84');

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

  return (
    <View style={styles.container}>
      {/* ── HEADER BANNER ────────────────────────────────────────── */}
      <View style={styles.headerCard}>
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
            <Text style={styles.headerTitle}>Live Chasing Score Predictor & Target Engine</Text>
            <Text style={styles.headerSubtitle}>
              Configure association rain-rule calculation methodology (DLS vs VJD) and simulate live chasing
              targets, par scores, required run-rate pressure, and dynamic win probabilities.
            </Text>
          </View>
        </View>

        {/* METHOD SELECTOR CARDS */}
        <View style={styles.methodCardsRow}>
          {/* DLS Card */}
          <TouchableOpacity
            style={[styles.methodCard, selectedMethod === 'DLS' && styles.methodCardActiveDLS]}
            onPress={() => setSelectedMethod('DLS')}
            activeOpacity={0.85}
          >
            <View style={styles.methodHeader}>
              <View style={[styles.methodRadio, selectedMethod === 'DLS' && styles.methodRadioActiveDLS]}>
                {selectedMethod === 'DLS' && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.methodName}>Duckworth-Lewis-Stern (DLS)</Text>
              <View style={styles.methodBadge}>
                <Text style={styles.methodBadgeText}>Standard Method</Text>
              </View>
            </View>
            <Text style={styles.methodDesc}>
              International ICC gold standard based on 2-factor resource percentages (overs remaining & wickets in hand).
              Accurately scales targets for rain-curtailed limited-overs games.
            </Text>
          </TouchableOpacity>

          {/* VJD Card */}
          <TouchableOpacity
            style={[styles.methodCard, selectedMethod === 'VJD' && styles.methodCardActiveVJD]}
            onPress={() => setSelectedMethod('VJD')}
            activeOpacity={0.85}
          >
            <View style={styles.methodHeader}>
              <View style={[styles.methodRadio, selectedMethod === 'VJD' && styles.methodRadioActiveVJD]}>
                {selectedMethod === 'VJD' && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.methodName}>V. Jayadevan (VJD) Method</Text>
              <View style={[styles.methodBadge, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                <Text style={[styles.methodBadgeText, { color: '#b45309' }]}>Domestic Method</Text>
              </View>
            </View>
            <Text style={styles.methodDesc}>
              BCCI alternative target calculation method dividing innings into normal, accelerating, and slog phases.
              Applies parabolic power curves to adjust rain targets.
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── LIVE SIMULATOR / CALCULATOR ──────────────────────────── */}
      <View style={styles.simulatorGrid}>
        {/* Left Column: Match Parameters Input */}
        <View style={styles.inputsCard}>
          <Text style={styles.sectionHeading}>🎯 Match Scenario Controls</Text>
          <Text style={styles.sectionSubheading}>Input 1st innings score & 2nd innings live match conditions</Text>

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
        <View style={styles.resultsCard}>
          <View style={styles.resultsHeader}>
            <Text style={styles.sectionHeading}>📊 Target & Par Score Arbitrament</Text>
            <View style={styles.methodActiveBadge}>
              <Text style={styles.methodActiveBadgeText}>Active: {selectedMethod}</Text>
            </View>
          </View>

          {/* Big Target & Par Score Box */}
          <View style={styles.scoreHeroBox}>
            <View style={styles.scoreHeroItem}>
              <Text style={styles.scoreHeroLabel}>Revised Target</Text>
              <Text style={styles.scoreHeroValue}>{calculationResults.targetRuns}</Text>
              <Text style={styles.scoreHeroSub}>Runs from {team2TargetOvers} Overs</Text>
            </View>

            <View style={styles.heroDivider} />

            <View style={styles.scoreHeroItem}>
              <Text style={styles.scoreHeroLabel}>Current DLS Par Score</Text>
              <Text style={[styles.scoreHeroValue, { color: calculationResults.isAhead ? '#059669' : '#dc2626' }]}>
                {calculationResults.parScore}
              </Text>
              <Text style={styles.scoreHeroSub}>
                {calculationResults.isAhead
                  ? `▲ Ahead by ${calculationResults.diffFromPar} runs`
                  : `▼ Behind by ${Math.abs(calculationResults.diffFromPar)} runs`}
              </Text>
            </View>
          </View>

          {/* Pressure Metrics */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Required Run Rate (RRR)</Text>
              <Text style={styles.metricValue}>{calculationResults.rrr}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Current Run Rate (CRR)</Text>
              <Text style={styles.metricValue}>{calculationResults.crr}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Runs Needed</Text>
              <Text style={styles.metricValue}>{calculationResults.runsNeeded}</Text>
            </View>
            <View style={styles.metricItem}>
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
    gap: 16,
    marginTop: 20,
    flexWrap: 'wrap'
  },
  methodCard: {
    flex: 1,
    minWidth: 300,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 18,
    borderWidth: 2,
    borderColor: '#e2e8f0'
  },
  methodCardActiveDLS: {
    borderColor: '#0891b2',
    backgroundColor: '#f0fdfa'
  },
  methodCardActiveVJD: {
    borderColor: '#d97706',
    backgroundColor: '#fffbeb'
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8
  },
  methodRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94a3b8',
    justifyContent: 'center',
    alignItems: 'center'
  },
  methodRadioActiveDLS: {
    borderColor: '#0891b2'
  },
  methodRadioActiveVJD: {
    borderColor: '#d97706'
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0891b2'
  },
  methodName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1
  },
  methodBadge: {
    backgroundColor: '#ecfeff',
    borderWidth: 1,
    borderColor: '#a5f3fc',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  methodBadgeText: {
    fontSize: 11,
    color: '#0e7490',
    fontWeight: '700'
  },
  methodDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18
  },

  simulatorGrid: {
    flexDirection: 'row',
    gap: 20,
    flexWrap: 'wrap'
  },
  inputsCard: {
    flex: 1.1,
    minWidth: 320,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 16
  },
  resultsCard: {
    flex: 1.3,
    minWidth: 340,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 18
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a'
  },
  sectionSubheading: {
    fontSize: 13,
    color: '#64748b'
  },
  inputGroup: {
    gap: 6
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155'
  },
  twoColInput: {
    flexDirection: 'row',
    gap: 12
  },
  miniLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 4
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a'
  },
  wicketsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 4
  },
  wicketPill: {
    width: 32,
    height: 32,
    borderRadius: 8,
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
    fontSize: 13,
    fontWeight: '700',
    color: '#334155'
  },
  wicketPillTextActive: {
    color: '#ffffff'
  },
  presetsRow: {
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8
  },
  presetHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b'
  },
  presetBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  presetBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155'
  },

  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  methodActiveBadge: {
    backgroundColor: '#0891b2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6
  },
  methodActiveBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800'
  },
  scoreHeroBox: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  scoreHeroItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scoreHeroLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  scoreHeroValue: {
    fontSize: 42,
    fontWeight: '900',
    color: '#0f172a',
    marginVertical: 4
  },
  scoreHeroSub: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569'
  },
  heroDivider: {
    width: 1,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 14
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
