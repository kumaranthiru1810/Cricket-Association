import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  useWindowDimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect, Line, Circle, Path, G, Text as SvgText } from 'react-native-svg';

export type CricketRuleType =
  | 'FREE_HIT'
  | 'CONSECUTIVE_WIDES'
  | 'OVER_QUOTA'
  | 'POWERPLAY'
  | 'RUN_OUT_CROSS'
  | 'PENALTY_RUNS'
  | 'SHORT_RUN'
  | 'MANKAD'
  | 'TIMED_OUT';

export interface CricketRulesModalProps {
  visible: boolean;
  activeRule: CricketRuleType | null;
  ruleContext?: {
    bowlerName?: string;
    strikerName?: string;
    nonStrikerName?: string;
    count?: number;
    oversBowled?: number;
    maxQuota?: number;
    overNumber?: number;
    totalRuns?: number;
    remarks?: string;
  };
  onClose: () => void;
  onApplyRule?: (ruleType: CricketRuleType, payload?: any) => void;
  onSkip?: () => void;
}

export default function CricketRulesModal({
  visible,
  activeRule,
  ruleContext = {},
  onClose,
  onApplyRule,
  onSkip
}: CricketRulesModalProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [selectedTab, setSelectedTab] = useState<CricketRuleType>(activeRule || 'FREE_HIT');

  // Run Out Interactive State
  const [brokenEnd, setBrokenEnd] = useState<'STRIKER' | 'NON_STRIKER'>('STRIKER');
  const [didBattersCross, setDidBattersCross] = useState<boolean>(false);

  // Timed Out Countdown State
  const [timedOutSeconds, setTimedOutSeconds] = useState<number>(90);

  useEffect(() => {
    if (activeRule) {
      setSelectedTab(activeRule);
    }
  }, [activeRule]);

  useEffect(() => {
    if (visible && selectedTab === 'TIMED_OUT') {
      setTimedOutSeconds(90);
      const timer = setInterval(() => {
        setTimedOutSeconds(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [visible, selectedTab]);

  if (!visible) return null;

  const tabs: { id: CricketRuleType; label: string; icon: string }[] = [
    { id: 'FREE_HIT', label: 'Free Hit', icon: '⚡' },
    { id: 'CONSECUTIVE_WIDES', label: 'Wide Lines', icon: '📏' },
    { id: 'OVER_QUOTA', label: 'Over Quota', icon: '🔋' },
    { id: 'POWERPLAY', label: 'Powerplay', icon: '⭕' },
    { id: 'RUN_OUT_CROSS', label: 'Run Out Cross', icon: '🏃' },
    { id: 'PENALTY_RUNS', label: '+5 Penalty', icon: '🪖' },
    { id: 'SHORT_RUN', label: 'Short Run', icon: '🦶' },
    { id: 'MANKAD', label: 'Mankad', icon: '⚡' },
    { id: 'TIMED_OUT', label: 'Timed Out', icon: '⏱️' }
  ];

  // Calculated who is out on Run Out crossing
  const calculateRunOutVictim = () => {
    const striker = ruleContext.strikerName || 'Striker';
    const nonStriker = ruleContext.nonStrikerName || 'Non-Striker';
    if (brokenEnd === 'STRIKER') {
      return didBattersCross ? nonStriker : striker;
    } else {
      return didBattersCross ? striker : nonStriker;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.modalCard, isMobile && { width: '95%', maxHeight: '92%' }]}>
          {/* HEADER */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.headerIconBadge}>
                <Text style={{ fontSize: 18 }}>⚖️</Text>
              </View>
              <View>
                <Text style={styles.headerTitle}>Smart Cricket Rule & Umpire Assistant</Text>
                <Text style={styles.headerSubtitle}>Official MCC Laws & T20 Visual Regulations Guide</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* HORIZONTAL RULE TABS */}
          <View style={styles.tabsWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
              {tabs.map(t => {
                const isSelected = selectedTab === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.tabPill, isSelected && styles.tabPillActive]}
                    onPress={() => setSelectedTab(t.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.tabIcon}>{t.icon}</Text>
                    <Text style={[styles.tabLabel, isSelected && styles.tabLabelActive]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* MAIN DIAGRAM CONTAINER */}
          <ScrollView contentContainerStyle={styles.bodyScroll} showsVerticalScrollIndicator={false}>
            {/* ─── 1. FREE HIT DIAGRAM ───────────────────────────────────── */}
            {selectedTab === 'FREE_HIT' && (
              <View style={styles.ruleContainer}>
                {/* Banner */}
                <View style={[styles.ruleBanner, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                  <Text style={[styles.ruleBannerText, { color: '#b45309' }]}>
                    ⚡ FREE HIT AWARDED (MCC Law 21.19 / ICC T20 Regulations)
                  </Text>
                </View>

                {/* Vector Diagram: Pitch with Free Hit Shield */}
                <View style={styles.diagramBox}>
                  <Svg width={isMobile ? 310 : 460} height={140} viewBox="0 0 460 140">
                    {/* Pitch Turf */}
                    <Rect x="20" y="20" width="420" height="100" rx="8" fill="#15803d" />
                    {/* Pitch Strip */}
                    <Rect x="50" y="32" width="360" height="76" rx="4" fill="#e2d2b5" />
                    {/* Bowling Crease (Left) */}
                    <Line x1="100" y1="32" x2="100" y2="108" stroke="#ffffff" strokeWidth="3" />
                    {/* Popping Crease (Right) */}
                    <Line x1="360" y1="32" x2="360" y2="108" stroke="#ffffff" strokeWidth="4" />
                    {/* Stumps (Right) */}
                    <Rect x="375" y="60" width="4" height="20" fill="#92400e" />
                    <Rect x="382" y="60" width="4" height="20" fill="#92400e" />
                    <Rect x="389" y="60" width="4" height="20" fill="#92400e" />

                    {/* Glowing Free Hit Trajectory */}
                    <Path
                      d="M 100 70 Q 230 40 360 70"
                      stroke="#f59e0b"
                      strokeWidth="4"
                      strokeDasharray="6,4"
                      fill="none"
                    />
                    <Circle cx="360" cy="70" r="7" fill="#dc2626" />
                  </Svg>

                  <View style={styles.diagramOverlayLabel}>
                    <Text style={styles.diagramOverlayText}>⚡ FREE HIT NEXT BALL • BATTER IMMUNITY</Text>
                  </View>
                </View>

                {/* Dismissal Immunity Grid */}
                <Text style={styles.sectionSubHeading}>DISMISSAL IMMUNITY BREAKDOWN:</Text>
                <View style={styles.grid2Col}>
                  <View style={styles.immunityCardSafe}>
                    <Text style={styles.immunityIcon}>🛡️</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.immunityTitleSafe}>PROHIBITED (NOT OUT)</Text>
                      <Text style={styles.immunityDesc}>❌ Bowled • ❌ Caught • ❌ LBW • ❌ Stumped • ❌ Hit Wicket</Text>
                    </View>
                  </View>
                  <View style={styles.immunityCardOut}>
                    <Text style={styles.immunityIcon}>🏃</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.immunityTitleOut}>ALLOWED (CAN BE DISMISSED)</Text>
                      <Text style={styles.immunityDesc}>✅ Run Out • ✅ Obstructing the Field • ✅ Hitting Ball Twice</Text>
                    </View>
                  </View>
                </View>

                {/* Key Regulations Pill */}
                <View style={styles.keyRegulationsBox}>
                  <Text style={styles.keyRegItem}>
                    🔄 <Text style={{ fontWeight: '800' }}>Continuous Rule: </Text>If the Free Hit delivery is a Wide or No-Ball, the Free Hit status carries forward to the following ball!
                  </Text>
                  <Text style={styles.keyRegItem}>
                    🛡️ <Text style={{ fontWeight: '800' }}>Field Freeze: </Text>Fielding positions cannot be changed unless there is a change of strike between batters.
                  </Text>
                </View>
              </View>
            )}

            {/* ─── 2. CONSECUTIVE WIDES / TRAMLINES DIAGRAM ──────────────── */}
            {selectedTab === 'CONSECUTIVE_WIDES' && (
              <View style={styles.ruleContainer}>
                <View style={[styles.ruleBanner, { backgroundColor: '#e0f2fe', borderColor: '#bae6fd' }]}>
                  <Text style={[styles.ruleBannerText, { color: '#0369a1' }]}>
                    📏 WIDE TRAMLINES & NEGATIVE LINE WARNING (MCC Law 22)
                  </Text>
                </View>

                {/* Vector Diagram: Pitch Tramlines */}
                <View style={styles.diagramBox}>
                  <Svg width={isMobile ? 310 : 460} height={160} viewBox="0 0 460 160">
                    {/* Grass */}
                    <Rect x="20" y="10" width="420" height="140" rx="8" fill="#15803d" />
                    {/* Pitch Strip */}
                    <Rect x="50" y="30" width="360" height="100" fill="#fef3c7" />
                    {/* Stumps Middle */}
                    <Line x1="380" y1="30" x2="380" y2="130" stroke="#ffffff" strokeWidth="3" />
                    <Circle cx="380" cy="80" r="5" fill="#78350f" />
                    {/* Off-Side Tramline (88.9 cm) */}
                    <Line x1="380" y1="45" x2="100" y2="45" stroke="#3b82f6" strokeWidth="2.5" strokeDasharray="5,4" />
                    {/* Leg-Side Tramline */}
                    <Line x1="380" y1="115" x2="100" y2="115" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="5,4" />
                    {/* Legal Channel Indicator */}
                    <Rect x="150" y="47" width="160" height="66" fill="rgba(34, 197, 94, 0.22)" rx="4" />

                    {/* Labels */}
                    <SvgText x="160" y="40" fill="#1d4ed8" fontSize="10" fontWeight="bold">Off Tramline (Wide Zone ➔)</SvgText>
                    <SvgText x="160" y="128" fill="#b91c1c" fontSize="10" fontWeight="bold">Leg Tramline (Automatic Wide ➔)</SvgText>
                  </Svg>
                  <View style={styles.diagramOverlayLabel}>
                    <Text style={styles.diagramOverlayText}>LEGAL CHANNEL (GREEN) vs ILLEGAL WIDE CORRIDOR</Text>
                  </View>
                </View>

                {/* Explanation */}
                <View style={styles.keyRegulationsBox}>
                  <Text style={styles.keyRegItem}>
                    ⚠️ <Text style={{ fontWeight: '800' }}>Leg-Side Rule: </Text>In modern white-ball and T20 cricket, any delivery passing down the leg side without making contact with the batter's bat or pad is an automatic WIDE.
                  </Text>
                  <Text style={styles.keyRegItem}>
                    ⚖️ <Text style={{ fontWeight: '800' }}>Negative Bowling: </Text>Bowlers persistently bowling wide outside off or down leg to prevent scoring are subject to umpire warnings under MCC Law 22.4.
                  </Text>
                </View>
              </View>
            )}

            {/* ─── 3. OVER QUOTA DIAGRAM ─────────────────────────────────── */}
            {selectedTab === 'OVER_QUOTA' && (
              <View style={styles.ruleContainer}>
                <View style={[styles.ruleBanner, { backgroundColor: '#fee2e2', borderColor: '#fecaca' }]}>
                  <Text style={[styles.ruleBannerText, { color: '#b91c1c' }]}>
                    🔋 MAXIMUM BOWLER OVER LIMIT (ICC T20 Law 13.9.1)
                  </Text>
                </View>

                {/* Visual Battery / Fuel Quota Gauge */}
                <View style={styles.quotaVisualBox}>
                  <Text style={styles.quotaHeaderLabel}>
                    {ruleContext.bowlerName || 'Active Bowler'} Over Limit Status:
                  </Text>
                  <View style={styles.quotaMeterTrack}>
                    <LinearGradient colors={['#ef4444', '#dc2626']} style={[styles.quotaMeterFill, { width: '100%' }]} />
                  </View>
                  <View style={styles.quotaMetaRow}>
                    <Text style={styles.quotaMetaVal}>4.0 / 4.0 Overs Bowled</Text>
                    <Text style={[styles.quotaMetaStatus, { color: '#dc2626' }]}>🚫 100% QUOTA EXHAUSTED</Text>
                  </View>
                </View>

                {/* Quota Formula Box */}
                <View style={styles.keyRegulationsBox}>
                  <Text style={styles.keyRegItem}>
                    📌 <Text style={{ fontWeight: '800' }}>The 20% Formula: </Text>In uninterrupted matches of 20 overs per side, no bowler may bowl more than 4 overs (20% of total match overs).
                  </Text>
                  <Text style={styles.keyRegItem}>
                    🌧️ <Text style={{ fontWeight: '800' }}>Rain-Reduced Inning: </Text>In delayed or interrupted matches, the maximum quota per bowler is Total Overs ÷ 5 (e.g., in a 15-over match, max quota is 3 overs per bowler).
                  </Text>
                  <Text style={styles.keyRegItem}>
                    🛑 <Text style={{ fontWeight: '800' }}>Scorer Action: </Text>This bowler cannot bowl any further overs in this innings. Please assign the next over to an eligible squad bowler.
                  </Text>
                </View>
              </View>
            )}

            {/* ─── 4. POWERPLAY 30-YARD CIRCLE DIAGRAM ───────────────────── */}
            {selectedTab === 'POWERPLAY' && (
              <View style={styles.ruleContainer}>
                <View style={[styles.ruleBanner, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                  <Text style={[styles.ruleBannerText, { color: '#047857' }]}>
                    ⭕ 30-YARD CIRCLE FIELDING RESTRICTIONS (ICC T20 Law 28.7)
                  </Text>
                </View>

                {/* Vector Diagram: 30-Yard Oval Ground */}
                <View style={styles.diagramBox}>
                  <Svg width={isMobile ? 310 : 460} height={170} viewBox="0 0 460 170">
                    {/* Stadium Grass */}
                    <Rect x="20" y="10" width="420" height="150" rx="75" fill="#166534" />
                    {/* Boundary Rope */}
                    <Rect x="24" y="14" width="412" height="142" rx="71" stroke="#fef08a" strokeWidth="2.5" fill="none" />
                    {/* 30-Yard Circle (Dashed Oval) */}
                    <Rect x="110" y="32" width="240" height="106" rx="53" stroke="#ffffff" strokeWidth="3" strokeDasharray="8,6" fill="rgba(255,255,255,0.12)" />
                    {/* Pitch */}
                    <Rect x="205" y="65" width="50" height="40" fill="#fef3c7" rx="3" />

                    {/* Plotted Fielders: 2 in Outfield, 9 inside */}
                    <Circle cx="60" cy="50" r="6" fill="#f59e0b" />
                    <Circle cx="390" cy="120" r="6" fill="#f59e0b" />
                    <Circle cx="160" cy="50" r="5" fill="#38bdf8" />
                    <Circle cx="290" cy="50" r="5" fill="#38bdf8" />
                    <Circle cx="170" cy="115" r="5" fill="#38bdf8" />
                    <Circle cx="300" cy="115" r="5" fill="#38bdf8" />
                    <Circle cx="130" cy="85" r="5" fill="#38bdf8" />
                    <Circle cx="330" cy="85" r="5" fill="#38bdf8" />
                  </Svg>
                  <View style={styles.diagramOverlayLabel}>
                    <Text style={styles.diagramOverlayText}>OVERS 1-6: MAX 2 FIELDERS OUTSIDE 30-YARD RING</Text>
                  </View>
                </View>

                {/* Two Phases Comparison */}
                <View style={styles.grid2Col}>
                  <View style={[styles.immunityCardSafe, { borderColor: '#86efac', backgroundColor: '#f0fdf4' }]}>
                    <Text style={{ fontSize: 16 }}>⚡</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.immunityTitleSafe, { color: '#166534' }]}>MANDATORY POWERPLAY (OV 1-6)</Text>
                      <Text style={styles.immunityDesc}>Max 2 Fielders allowed outside 30-yard ring. 9 Fielders inside circle!</Text>
                    </View>
                  </View>
                  <View style={[styles.immunityCardOut, { borderColor: '#bae6fd', backgroundColor: '#f0f9ff' }]}>
                    <Text style={{ fontSize: 16 }}>🛡️</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.immunityTitleOut, { color: '#0369a1' }]}>NON-POWERPLAY (OV 7-20)</Text>
                      <Text style={styles.immunityDesc}>Up to 5 Fielders allowed outside 30-yard ring. Maximum outfield boundary protection.</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* ─── 5. RUN OUT CROSSING RULE ──────────────────────────────── */}
            {selectedTab === 'RUN_OUT_CROSS' && (
              <View style={styles.ruleContainer}>
                <View style={[styles.ruleBanner, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
                  <Text style={[styles.ruleBannerText, { color: '#c2410c' }]}>
                    🏃 RUN OUT & BATTERS CROSSING RULE (MCC Law 38 & 19)
                  </Text>
                </View>

                {/* Interactive End & Crossing Selector */}
                <View style={styles.interactiveBox}>
                  <Text style={styles.interactiveLabel}>1. Which wicket was put down / broken?</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 6, marginBottom: 14 }}>
                    <TouchableOpacity
                      style={[styles.choiceBtn, brokenEnd === 'STRIKER' && styles.choiceBtnActive]}
                      onPress={() => setBrokenEnd('STRIKER')}
                    >
                      <Text style={[styles.choiceBtnText, brokenEnd === 'STRIKER' && styles.choiceBtnTextActive]}>
                        🎯 Striker End (Wicketkeeper)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.choiceBtn, brokenEnd === 'NON_STRIKER' && styles.choiceBtnActive]}
                      onPress={() => setBrokenEnd('NON_STRIKER')}
                    >
                      <Text style={[styles.choiceBtnText, brokenEnd === 'NON_STRIKER' && styles.choiceBtnTextActive]}>
                        🎳 Non-Striker End (Bowler)
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.interactiveLabel}>2. Did the two running batters cross each other?</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 6, marginBottom: 14 }}>
                    <TouchableOpacity
                      style={[styles.choiceBtn, !didBattersCross && styles.choiceBtnActive]}
                      onPress={() => setDidBattersCross(false)}
                    >
                      <Text style={[styles.choiceBtnText, !didBattersCross && styles.choiceBtnTextActive]}>
                        ❌ No - Did NOT Cross
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.choiceBtn, didBattersCross && styles.choiceBtnActive]}
                      onPress={() => setDidBattersCross(true)}
                    >
                      <Text style={[styles.choiceBtnText, didBattersCross && styles.choiceBtnTextActive]}>
                        ✅ Yes - Crossed in Middle
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Calculated Result Display */}
                  <View style={styles.decisionResultBox}>
                    <Text style={styles.decisionResultTitle}>⚖️ UMPIRE DETERMINATION:</Text>
                    <Text style={styles.decisionResultName}>
                      🔴 OUT: <Text style={{ fontWeight: '900', color: '#dc2626' }}>{calculateRunOutVictim()}</Text>
                    </Text>
                    <Text style={styles.decisionResultDesc}>
                      Based on MCC Law 38.3: The batter whose ground is put down without making their ground is OUT.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* ─── 6. +5 PENALTY RUNS (HELMET HIT) ───────────────────────── */}
            {selectedTab === 'PENALTY_RUNS' && (
              <View style={styles.ruleContainer}>
                <View style={[styles.ruleBanner, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                  <Text style={[styles.ruleBannerText, { color: '#dc2626' }]}>
                    🪖 +5 PENALTY RUNS - HELMET CONTACT (MCC Law 28.3)
                  </Text>
                </View>

                {/* Visual Helmet Contact Diagram */}
                <View style={styles.diagramBox}>
                  <Svg width={isMobile ? 310 : 460} height={150} viewBox="0 0 460 150">
                    <Rect x="20" y="10" width="420" height="130" rx="8" fill="#15803d" />
                    {/* Wicketkeeper Position */}
                    <Circle cx="120" cy="75" r="16" fill="#1e3a8a" />
                    {/* Helmet Resting on Turf */}
                    <Path d="M 220 95 C 220 65, 270 65, 270 95 Z" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
                    <Rect x="215" y="93" width="60" height="6" fill="#0369a1" rx="2" />
                    {/* Cricket Ball Contact */}
                    <Circle cx="260" cy="72" r="10" fill="#dc2626" stroke="#ffffff" strokeWidth="2" />
                    {/* Sparks / Contact Lines */}
                    <Line x1="265" y1="60" x2="275" y2="50" stroke="#f59e0b" strokeWidth="3" />
                    <Line x1="275" y1="72" x2="285" y2="72" stroke="#f59e0b" strokeWidth="3" />
                    <Line x1="265" y1="82" x2="278" y2="88" stroke="#f59e0b" strokeWidth="3" />
                  </Svg>
                  <View style={styles.diagramOverlayLabel}>
                    <Text style={styles.diagramOverlayText}>BALL CONTACTS GROUNDED HELMET ➔ DEAD BALL + 5 RUNS</Text>
                  </View>
                </View>

                <View style={styles.keyRegulationsBox}>
                  <Text style={styles.keyRegItem}>
                    🛑 <Text style={{ fontWeight: '800' }}>Immediate Dead Ball: </Text>As soon as the ball touches an object or helmet placed on the ground by the fielding side, the ball is DEAD instantly.
                  </Text>
                  <Text style={styles.keyRegItem}>
                    ➕ <Text style={{ fontWeight: '800' }}>+5 Penalty Runs: </Text>5 penalty runs are credited to the batting team as EXTRAS.
                  </Text>
                  <Text style={styles.keyRegItem}>
                    🏃 <Text style={{ fontWeight: '800' }}>Completed Runs Counted: </Text>Any runs completed by the batters before the helmet contact are also scored!
                  </Text>
                </View>
              </View>
            )}

            {/* ─── 7. SHORT RUN CREASE CHECK ─────────────────────────────── */}
            {selectedTab === 'SHORT_RUN' && (
              <View style={styles.ruleContainer}>
                <View style={[styles.ruleBanner, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                  <Text style={[styles.ruleBannerText, { color: '#d97706' }]}>
                    🦶 SHORT RUN CREASE VIOLATION (MCC Law 18.3 & 18.4)
                  </Text>
                </View>

                <View style={styles.diagramBox}>
                  <Svg width={isMobile ? 310 : 460} height={140} viewBox="0 0 460 140">
                    <Rect x="20" y="10" width="420" height="120" rx="8" fill="#15803d" />
                    <Rect x="40" y="25" width="380" height="90" fill="#e2d2b5" />
                    {/* White Popping Crease */}
                    <Line x1="280" y1="25" x2="280" y2="115" stroke="#ffffff" strokeWidth="5" />
                    {/* Turning Shoe Short of Crease */}
                    <Path d="M 230 65 L 265 65 L 265 80 L 230 80 Z" fill="#b91c1c" />
                    {/* Gap measurement */}
                    <Line x1="267" y1="72" x2="278" y2="72" stroke="#ef4444" strokeWidth="3" />
                    <Circle cx="267" cy="72" r="3" fill="#ef4444" />
                    <Circle cx="278" cy="72" r="3" fill="#ef4444" />
                  </Svg>
                  <View style={styles.diagramOverlayLabel}>
                    <Text style={styles.diagramOverlayText}>BATTER TURNS WITHOUT GROUNDING BAT BEHIND LINE ➔ -1 RUN</Text>
                  </View>
                </View>

                <View style={styles.keyRegulationsBox}>
                  <Text style={styles.keyRegItem}>
                    ❌ <Text style={{ fontWeight: '800' }}>Umpire Call: </Text>When a batter fails to touch their bat or body grounded behind the popping crease when turning, the umpire signals a "Short Run".
                  </Text>
                  <Text style={styles.keyRegItem}>
                    ⚖️ <Text style={{ fontWeight: '800' }}>Consequence: </Text>1 run is deducted from the total scored runs for that delivery.
                  </Text>
                </View>
              </View>
            )}

            {/* ─── 8. MANKAD NON-STRIKER RUN OUT ─────────────────────────── */}
            {selectedTab === 'MANKAD' && (
              <View style={styles.ruleContainer}>
                <View style={[styles.ruleBanner, { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' }]}>
                  <Text style={[styles.ruleBannerText, { color: '#6d28d9' }]}>
                    ⚡ NON-STRIKER RUN OUT / MANKAD (MCC Law 38.3)
                  </Text>
                </View>

                <View style={styles.diagramBox}>
                  <Svg width={isMobile ? 310 : 460} height={140} viewBox="0 0 460 140">
                    <Rect x="20" y="10" width="420" height="120" rx="8" fill="#15803d" />
                    <Rect x="40" y="25" width="380" height="90" fill="#e2d2b5" />
                    {/* Bowling Crease */}
                    <Line x1="180" y1="25" x2="180" y2="115" stroke="#ffffff" strokeWidth="4" />
                    {/* Non-Striker Stumps */}
                    <Circle cx="180" cy="70" r="5" fill="#78350f" />
                    {/* Non-Striker stepping out prematurely */}
                    <Circle cx="225" cy="70" r="10" fill="#dc2626" />
                    <Line x1="185" y1="70" x2="215" y2="70" stroke="#dc2626" strokeWidth="2" strokeDasharray="3,3" />
                  </Svg>
                  <View style={styles.diagramOverlayLabel}>
                    <Text style={styles.diagramOverlayText}>NON-STRIKER STEPS OUT BEFORE RELEASE ➔ LEGAL RUN OUT</Text>
                  </View>
                </View>

                <View style={styles.keyRegulationsBox}>
                  <Text style={styles.keyRegItem}>
                    ✅ <Text style={{ fontWeight: '800' }}>Official Reclassification: </Text>MCC officially moved this dismissal out of "Unfair Play" into "Law 38 - Run Out". It is a completely legitimate cricket dismissal.
                  </Text>
                  <Text style={styles.keyRegItem}>
                    📌 <Text style={{ fontWeight: '800' }}>Bowler Rights: </Text>A bowler is entitled to run out the non-striker at any point before they enter their expected delivery release point.
                  </Text>
                </View>
              </View>
            )}

            {/* ─── 9. TIMED OUT RULE ─────────────────────────────────────── */}
            {selectedTab === 'TIMED_OUT' && (
              <View style={styles.ruleContainer}>
                <View style={[styles.ruleBanner, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                  <Text style={[styles.ruleBannerText, { color: '#b91c1c' }]}>
                    ⏱️ TIMED OUT COUNTDOWN (MCC Law 40)
                  </Text>
                </View>

                {/* Circular Countdown Display */}
                <View style={styles.timedOutTimerBox}>
                  <View style={[styles.countdownCircle, timedOutSeconds < 30 && { borderColor: '#ef4444' }]}>
                    <Text style={[styles.countdownNumber, timedOutSeconds < 30 && { color: '#ef4444' }]}>
                      {timedOutSeconds}s
                    </Text>
                    <Text style={styles.countdownSub}>Remaining</Text>
                  </View>
                  <Text style={styles.timedOutStatusText}>
                    {timedOutSeconds === 0
                      ? '🛑 TIME EXPIRED: Umpire may award Timed Out upon fielding appeal!'
                      : 'Incoming batter must be ready to receive delivery within 90 seconds in T20.'}
                  </Text>
                </View>

                <View style={styles.keyRegulationsBox}>
                  <Text style={styles.keyRegItem}>
                    ⏱️ <Text style={{ fontWeight: '800' }}>T20 Speed Limit: </Text>Incoming batter has 90 seconds (120s in multi-day) to cross the boundary and take guard.
                  </Text>
                  <Text style={styles.keyRegItem}>
                    ⚖️ <Text style={{ fontWeight: '800' }}>Appeal Required: </Text>The fielding side must appeal to the umpire for the Timed Out dismissal to be awarded.
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* FOOTER ACTIONS */}
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.dismissBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.dismissBtnText}>Close Guide</Text>
            </TouchableOpacity>

            {onApplyRule && (
              <TouchableOpacity
                style={styles.applyBtn}
                onPress={() => {
                  onApplyRule(selectedTab, {
                    brokenEnd,
                    didBattersCross,
                    runOutVictim: calculateRunOutVictim()
                  });
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.applyBtnText}>
                  {selectedTab === 'FREE_HIT'
                    ? '⚡ Set Free Hit for Next Ball'
                    : selectedTab === 'RUN_OUT_CROSS'
                    ? `Confirm Out: ${calculateRunOutVictim()}`
                    : selectedTab === 'PENALTY_RUNS'
                    ? 'Award +5 Penalty Runs'
                    : selectedTab === 'SHORT_RUN'
                    ? 'Deduct 1 Short Run'
                    : 'Acknowledge & Continue'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalCard: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '88%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    display: 'flex',
    flexDirection: 'column'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff'
  },
  headerIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  headerTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900'
  },
  headerSubtitle: {
    color: '#64748b',
    fontSize: 11.5,
    marginTop: 1
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeBtnText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '800'
  },

  // Tabs
  tabsWrapper: {
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 8
  },
  tabsScroll: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row'
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  tabPillActive: {
    backgroundColor: '#005960',
    borderColor: '#005960'
  },
  tabIcon: {
    fontSize: 13
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155'
  },
  tabLabelActive: {
    color: '#ffffff'
  },

  // Content
  bodyScroll: {
    padding: 20
  },
  ruleContainer: {
    width: '100%'
  },
  ruleBanner: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
    alignItems: 'center'
  },
  ruleBannerText: {
    fontSize: 12.5,
    fontWeight: '900',
    textAlign: 'center'
  },
  diagramBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 14,
    overflow: 'hidden'
  },
  diagramOverlayLabel: {
    marginTop: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  diagramOverlayText: {
    color: '#0f172a',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5
  },

  sectionSubHeading: {
    color: '#475569',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8
  },
  grid2Col: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14
  },
  immunityCardSafe: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10
  },
  immunityCardOut: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10
  },
  immunityIcon: {
    fontSize: 20,
    marginTop: 2
  },
  immunityTitleSafe: {
    color: '#b45309',
    fontSize: 11.5,
    fontWeight: '900',
    marginBottom: 2
  },
  immunityTitleOut: {
    color: '#b91c1c',
    fontSize: 11.5,
    fontWeight: '900',
    marginBottom: 2
  },
  immunityDesc: {
    color: '#334155',
    fontSize: 11,
    lineHeight: 15
  },

  keyRegulationsBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    gap: 8
  },
  keyRegItem: {
    color: '#334155',
    fontSize: 12,
    lineHeight: 17
  },

  // Quota Box
  quotaVisualBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14
  },
  quotaHeaderLabel: {
    color: '#7f1d1d',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8
  },
  quotaMeterTrack: {
    height: 18,
    backgroundColor: '#ffffff',
    borderRadius: 9,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#fca5a5'
  },
  quotaMeterFill: {
    height: '100%',
    borderRadius: 9
  },
  quotaMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8
  },
  quotaMetaVal: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800'
  },
  quotaMetaStatus: {
    fontSize: 12,
    fontWeight: '900'
  },

  // Interactive Box
  interactiveBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14
  },
  interactiveLabel: {
    color: '#0f172a',
    fontSize: 12.5,
    fontWeight: '800'
  },
  choiceBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center'
  },
  choiceBtnActive: {
    backgroundColor: '#005960',
    borderColor: '#005960'
  },
  choiceBtnText: {
    color: '#334155',
    fontSize: 11.5,
    fontWeight: '700',
    textAlign: 'center'
  },
  choiceBtnTextActive: {
    color: '#ffffff',
    fontWeight: '900'
  },
  decisionResultBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626'
  },
  decisionResultTitle: {
    color: '#64748b',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  decisionResultName: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2
  },
  decisionResultDesc: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 4
  },

  // Timed out Box
  timedOutTimerBox: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 20,
    marginBottom: 14
  },
  countdownCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 4,
    borderColor: '#005960',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff'
  },
  countdownNumber: {
    color: '#005960',
    fontSize: 26,
    fontWeight: '900'
  },
  countdownSub: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700'
  },
  timedOutStatusText: {
    color: '#0f172a',
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 380
  },

  // Footer
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#ffffff',
    gap: 12
  },
  dismissBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  dismissBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700'
  },
  applyBtn: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#005960',
    alignItems: 'center',
    shadowColor: '#005960',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2
  },
  applyBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900'
  }
});
