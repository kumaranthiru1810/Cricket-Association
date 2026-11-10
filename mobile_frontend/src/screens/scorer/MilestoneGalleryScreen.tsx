import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  useWindowDimensions,
  Animated,
  Easing
} from 'react-native';
import { useScorerNavigation } from '../../navigation/ScorerNavigationContext';
import CricketConfetti from '../../components/common/CricketConfetti';
import CricketFigurine3D from '../../components/common/CricketFigurine3D';

// All 11 Milestone Unique Non-Repeating Assets
const milestoneBatsmanImage = require('../../../assets/milestone_batsman.png');
const centuryBatsmanImage = require('../../../assets/century_batsman.jpg');
const doubleCenturyImage = require('../../../assets/double_century_200.jpg');
const team50Image = require('../../../assets/team_50.jpg');
const team100Image = require('../../../assets/team_100.jpg');
const catchMilestoneImage = require('../../../assets/catch_milestone.jpg');
const bestBowlerImage = require('../../../assets/best_bowler.png');
const runOutMilestoneImage = require('../../../assets/run_out_milestone.png');
const keeperDismissalImage = require('../../../assets/keeper_dismissal.png');
const IMG_MAN_OF_THE_MATCH = require('../../../assets/man_of_the_match.png');
const IMG_CHAMPIONS = require('../../../assets/cricket_champions.png');

export interface MilestoneItem {
  id: string;
  category: 'BATTER' | 'TEAM' | 'DISMISSAL' | 'BOWLER' | 'AWARD';
  title: string;
  badge: string;
  subtitle: string;
  playerName: string;
  teamName: string;
  scoreText: string;
  ballsText: string;
  strikeRateText?: string;
  fours?: number;
  sixes?: number;
  image: any;
  accentColor: string;
}

const ALL_MILESTONES: MilestoneItem[] = [
  {
    id: 'batter-50',
    category: 'BATTER',
    title: 'HALF-CENTURY!',
    badge: '⭐ 50 RUNS MILESTONE ⭐',
    subtitle: 'Crucial anchoring half-century milestone under intense match pressure.',
    playerName: 'S. Saravanan',
    teamName: 'Sivakasi Strikers',
    scoreText: '54*',
    ballsText: '32 Balls',
    strikeRateText: '168.75',
    fours: 6,
    sixes: 2,
    image: milestoneBatsmanImage,
    accentColor: '#d97706'
  },
  {
    id: 'batter-100',
    category: 'BATTER',
    title: 'MAGNIFICENT CENTURY!',
    badge: '👑 100 RUNS CENTURY 👑',
    subtitle: 'Outstanding masterclass ton! Raises the bat to a standing ovation.',
    playerName: 'N. Jagadeesan',
    teamName: 'Rajapalayam Royals',
    scoreText: '104*',
    ballsText: '58 Balls',
    strikeRateText: '179.31',
    fours: 11,
    sixes: 5,
    image: centuryBatsmanImage,
    accentColor: '#b45309'
  },
  {
    id: 'batter-200',
    category: 'BATTER',
    title: 'HISTORIC DOUBLE TON (200*)!',
    badge: '💎 200 RUNS DOUBLE CENTURY 💎',
    subtitle: 'A historic monumental innings for the ages! Absolute cricketing mastery.',
    playerName: 'B. Indrajith',
    teamName: 'Virudhunagar Spartans',
    scoreText: '202*',
    ballsText: '112 Balls',
    strikeRateText: '180.36',
    fours: 22,
    sixes: 8,
    image: doubleCenturyImage,
    accentColor: '#b8860b'
  },
  {
    id: 'team-50',
    category: 'TEAM',
    title: 'TEAM 50 UP!',
    badge: '🏏 TEAM 50 RUNS UP! 🏏',
    subtitle: 'Sensational collective batting! Sivakasi Strikers crosses the 50-run mark.',
    playerName: 'Sivakasi Strikers',
    teamName: 'Overs: 2.1 | Score: 57/0',
    scoreText: '57/0',
    ballsText: '2.1 Ov',
    strikeRateText: 'CRR: 26.31',
    image: team50Image,
    accentColor: '#d97706'
  },
  {
    id: 'team-100',
    category: 'TEAM',
    title: 'TEAM 100 UP!',
    badge: '💯 TEAM 100 RUNS UP! 💯',
    subtitle: 'Sensational collective batting! Sivakasi Strikers crosses the 100-run mark in quick time.',
    playerName: 'Sivakasi Strikers',
    teamName: 'Overs: 4.1 | Score: 100/0',
    scoreText: '100/0',
    ballsText: '4.1 Ov',
    strikeRateText: 'CRR: 24.00',
    image: team100Image,
    accentColor: '#b45309'
  },
  {
    id: 'catch-milestone',
    category: 'DISMISSAL',
    title: 'SPECTACULAR CATCH!',
    badge: '🦅 SPECTACULAR CATCH 🦅',
    subtitle: 'Remarkable diving agility near the boundary rope to dismiss dangerous batter.',
    playerName: 'M. Siddharth',
    teamName: 'Rajapalayam Royals',
    scoreText: '3 Catches',
    ballsText: 'Top Fielder',
    strikeRateText: 'Deep Midwicket',
    image: catchMilestoneImage,
    accentColor: '#0284c7'
  },
  {
    id: 'runout-milestone',
    category: 'DISMISSAL',
    title: 'DIRECT HIT RUN OUT!',
    badge: '🎯 BULLSEYE DIRECT HIT 🎯',
    subtitle: 'Razor-sharp direct throw from deep cover finding the batter short of crease.',
    playerName: 'R. Sanjay',
    teamName: 'Virudhunagar Spartans',
    scoreText: 'Bullseye Hit',
    ballsText: '1 Stumps Hit',
    strikeRateText: 'Deep Cover',
    image: runOutMilestoneImage,
    accentColor: '#dc2626'
  },
  {
    id: 'keeper-milestone',
    category: 'DISMISSAL',
    title: 'WICKETKEEPER DISMISSAL!',
    badge: '🧤 LIGHTNING STUMPING 🧤',
    subtitle: 'Incredible hand-speed and razor-sharp reflexes whipping off the bails in 0.12 seconds.',
    playerName: 'N. Jagadeesan',
    teamName: 'Rajapalayam Royals',
    scoreText: 'Stumped (0.12s)',
    ballsText: 'Wicketkeeper',
    strikeRateText: 'Fast Glovework',
    image: keeperDismissalImage,
    accentColor: '#7c3aed'
  },
  {
    id: 'bowler-5w',
    category: 'BOWLER',
    title: 'FIVE-WICKET HAUL (FIFER)!',
    badge: '🔥 5-WICKET HAUL 🔥',
    subtitle: 'Masterful bowling exhibition with lethal yorkers and deceptive seam movement.',
    playerName: 'M. Poiyamozhi',
    teamName: 'Sivakasi Strikers',
    scoreText: '5/18',
    ballsText: '4.0 Overs',
    strikeRateText: 'ER: 4.50',
    image: bestBowlerImage,
    accentColor: '#ea580c'
  },
  {
    id: 'motm-milestone',
    category: 'AWARD',
    title: 'PLAYER OF THE MATCH!',
    badge: '⭐ MAN OF THE MATCH ⭐',
    subtitle: 'All-round match winning performance leading team to a memorable victory.',
    playerName: 'N. Jagadeesan',
    teamName: 'Rajapalayam Royals',
    scoreText: '104* (58b)',
    ballsText: 'Match Winner',
    strikeRateText: 'SR: 179.31',
    image: IMG_MAN_OF_THE_MATCH,
    accentColor: '#b45309'
  },
  {
    id: 'champions-trophy',
    category: 'AWARD',
    title: 'MATCH CHAMPIONS TROPHY!',
    badge: '🏆 OFFICIAL MATCH CHAMPION 🏆',
    subtitle: 'Crowned tournament champions with a commanding performance.',
    playerName: 'Rajapalayam Royals',
    teamName: 'Won by 10 wickets (Target 107 in 4.5 ov)',
    scoreText: 'CHAMPIONS',
    ballsText: '10 Wickets',
    strikeRateText: 'Virudhunagar PL',
    image: IMG_CHAMPIONS,
    accentColor: '#b8860b'
  }
];

export default function MilestoneGalleryScreen() {
  const { navigate } = useScorerNavigation();
  const { width } = useWindowDimensions();
  const isMobile = width < 600;

  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [showLiveModal, setShowLiveModal] = useState<boolean>(false);

  const selected = ALL_MILESTONES[selectedIndex];

  // Dynamic Runs Counting Animation from 0
  const [animatedScore, setAnimatedScore] = useState<string>('0');

  useEffect(() => {
    const raw = selected.scoreText;
    const match = raw.match(/^(\d+)(.*)$/);
    if (!match) {
      setAnimatedScore(raw);
      return;
    }

    const targetNum = parseInt(match[1], 10);
    const suffix = match[2];
    const duration = 900; // ms
    const startTime = performance.now();

    let animId: number;
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const curr = Math.round(targetNum * eased);
      setAnimatedScore(`${curr}${suffix}`);

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        setAnimatedScore(`${targetNum}${suffix}`);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [selectedIndex, selected.scoreText]);

  // Entrance Split Slide-in Animations: Left for Figurine, Right for Details
  const slideLeftAnim = useRef(new Animated.Value(-120)).current;
  const slideRightAnim = useRef(new Animated.Value(120)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    slideLeftAnim.setValue(-120);
    slideRightAnim.setValue(120);
    fadeAnim.setValue(0);

    Animated.parallel([
      Animated.spring(slideLeftAnim, {
        toValue: 0,
        friction: 6,
        tension: 48,
        useNativeDriver: true
      }),
      Animated.spring(slideRightAnim, {
        toValue: 0,
        friction: 6,
        tension: 48,
        useNativeDriver: true
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true
      })
    ]).start();
  }, [selectedIndex]);

  const handleNext = () => {
    setSelectedIndex((prev) => (prev + 1) % ALL_MILESTONES.length);
  };

  const handlePrev = () => {
    setSelectedIndex((prev) => (prev - 1 + ALL_MILESTONES.length) % ALL_MILESTONES.length);
  };

  return (
    <View style={styles.container}>
      {/* Top Header Bar - White & TNCA Gold Daylight Standard */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigate('LiveScoring')}
            activeOpacity={0.7}
          >
            <Text style={styles.backBtnText}>◀ Back to Live Scoring</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>🏆 3D MILESTONE & STATUETTE SHOWCASE</Text>
            <Text style={styles.headerSubtitle}>
              11 unique cricket milestones • Dynamic runs calculation & split slide animations
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.testModalBtn}
          onPress={() => setShowLiveModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.testModalBtnText}>🎉 Test Live Fullscreen Modal</Text>
        </TouchableOpacity>
      </View>

      {/* Milestone Selection Tabs (Daylight White & Gold) */}
      <View style={styles.tabScrollWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
          {ALL_MILESTONES.map((m, idx) => {
            const isTabActive = idx === selectedIndex;
            return (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.tabChip,
                  isTabActive && styles.tabChipActive
                ]}
                onPress={() => setSelectedIndex(idx)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabChipText, isTabActive && styles.tabChipTextActive]}>
                  {m.badge.split(' ')[0]} {m.title.split('!')[0]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Showcase Stage */}
      <ScrollView contentContainerStyle={styles.mainContent}>
        {/* Navigation Stepper Controls */}
        <View style={styles.stepperRow}>
          <TouchableOpacity style={styles.stepBtn} onPress={handlePrev} activeOpacity={0.7}>
            <Text style={styles.stepBtnText}>◀ Previous ({selectedIndex === 0 ? ALL_MILESTONES.length : selectedIndex})</Text>
          </TouchableOpacity>

          <View style={styles.stepIndicator}>
            <Text style={styles.stepIndicatorText}>
              MILESTONE {selectedIndex + 1} OF {ALL_MILESTONES.length}
            </Text>
          </View>

          <TouchableOpacity style={styles.stepBtn} onPress={handleNext} activeOpacity={0.7}>
            <Text style={styles.stepBtnText}>Next ({((selectedIndex + 1) % ALL_MILESTONES.length) + 1}) ▶</Text>
          </TouchableOpacity>
        </View>

        {/* The Exact Milestone Card Container - Daylight White & Gold Theme */}
        <View style={[styles.milestoneCard, { maxWidth: isMobile ? 380 : 440 }]}>
          {/* Top Gold Ribbon Banner */}
          <View style={[styles.milestoneRibbon, { backgroundColor: '#fffbeb', borderBottomColor: selected.accentColor }]}>
            <Text style={[styles.milestoneRibbonText, { color: selected.accentColor }]}>{selected.badge}</Text>
          </View>

          {/* LEFT SLIDE COMPONENT: 3D Figurine Statuette slides in from the left */}
          <Animated.View style={[
            styles.figurineContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateX: slideLeftAnim }]
            }
          ]}>
            <CricketFigurine3D
              imageSource={selected.image}
              playerName={selected.playerName}
              badgeText={selected.badge}
              teamName={selected.teamName}
              milestoneTitle={selected.title}
              scoreText={animatedScore}
              ballsText={selected.ballsText}
              strikeRateText={selected.strikeRateText}
              fours={selected.fours}
              sixes={selected.sixes}
              height={320}
              interactive={true}
            />
          </Animated.View>

          {/* RIGHT SLIDE COMPONENT: Details & Stats Box slides in from the right */}
          <Animated.View style={[
            styles.detailsBox,
            {
              opacity: fadeAnim,
              transform: [{ translateX: slideRightAnim }]
            }
          ]}>
            <Text style={styles.detailTitle}>{selected.title}</Text>
            <Text style={styles.detailPlayerName}>{selected.playerName.toUpperCase()}</Text>
            <Text style={styles.detailTeamName}>{selected.teamName.toUpperCase()}</Text>

            {/* Stat Pillars with Real-time Counting Score */}
            <View style={styles.statsBox}>
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{animatedScore}</Text>
                <Text style={styles.statLbl}>SCORE (0 ➔ {selected.scoreText})</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{selected.ballsText}</Text>
                <Text style={styles.statLbl}>BALLS / OVERS</Text>
              </View>
              {selected.strikeRateText ? (
                <>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statVal}>{selected.strikeRateText}</Text>
                    <Text style={styles.statLbl}>RATE / METRIC</Text>
                  </View>
                </>
              ) : null}
            </View>

            {/* Boundaries (if available) */}
            {(selected.fours !== undefined || selected.sixes !== undefined) && (
              <View style={styles.boundaryTagsRow}>
                <View style={styles.boundaryTag}>
                  <Text style={styles.boundaryTagText}>🏏 {selected.fours || 0} Fours (4s)</Text>
                </View>
                <View style={[styles.boundaryTag, styles.sixTag]}>
                  <Text style={[styles.boundaryTagText, { color: '#be123c' }]}>🚀 {selected.sixes || 0} Sixes (6s)</Text>
                </View>
              </View>
            )}

            <Text style={styles.subtitle}>{selected.subtitle}</Text>
          </Animated.View>

          {/* Action Button */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setShowLiveModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnText}>🎉 VIEW IN FULLSCREEN MODAL WITH CONFETTI ▶</Text>
          </TouchableOpacity>
        </View>

        {/* Verification Checklist */}
        <View style={styles.checklistCard}>
          <Text style={styles.checklistTitle}>✅ Visual Verification Checklist</Text>
          <View style={styles.checklistRow}>
            <Text style={styles.checkIcon}>✓</Text>
            <Text style={styles.checkText}>Unique Assets: No repeated images across all 11 cricket milestones.</Text>
          </View>
          <View style={styles.checklistRow}>
            <Text style={styles.checkIcon}>✓</Text>
            <Text style={styles.checkText}>Score Counter: Score animates dynamically starting from 0 up to final milestone.</Text>
          </View>
          <View style={styles.checklistRow}>
            <Text style={styles.checkIcon}>✓</Text>
            <Text style={styles.checkText}>Split Animation: Figurine slides from LEFT, Details panel slides from RIGHT.</Text>
          </View>
          <View style={styles.checklistRow}>
            <Text style={styles.checkIcon}>✓</Text>
            <Text style={styles.checkText}>Website Design: High-contrast daylight White & TNCA Yellow/Gold theme.</Text>
          </View>
        </View>
      </ScrollView>

      {/* Live Fullscreen Modal Simulation */}
      <Modal
        visible={showLiveModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLiveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <CricketConfetti active={showLiveModal} count={70} />

          <View style={[styles.milestoneCard, { maxWidth: isMobile ? 380 : 440 }]}>
            <View style={[styles.milestoneRibbon, { backgroundColor: '#fffbeb', borderBottomColor: selected.accentColor }]}>
              <Text style={[styles.milestoneRibbonText, { color: selected.accentColor }]}>{selected.badge}</Text>
            </View>

            <View style={styles.figurineContainer}>
              <CricketFigurine3D
                imageSource={selected.image}
                playerName={selected.playerName}
                badgeText={selected.badge}
                teamName={selected.teamName}
                milestoneTitle={selected.title}
                scoreText={animatedScore}
                ballsText={selected.ballsText}
                strikeRateText={selected.strikeRateText}
                fours={selected.fours}
                sixes={selected.sixes}
                height={320}
                interactive={true}
              />
            </View>

            <View style={styles.detailsBox}>
              <Text style={styles.detailTitle}>{selected.title}</Text>
              <Text style={styles.detailPlayerName}>{selected.playerName.toUpperCase()}</Text>
              <Text style={styles.detailTeamName}>{selected.teamName.toUpperCase()}</Text>

              <View style={styles.statsBox}>
                <View style={styles.statItem}>
                  <Text style={styles.statVal}>{animatedScore}</Text>
                  <Text style={styles.statLbl}>SCORE</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statVal}>{selected.ballsText}</Text>
                  <Text style={styles.statLbl}>BALLS / OVERS</Text>
                </View>
                {selected.strikeRateText ? (
                  <>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={styles.statVal}>{selected.strikeRateText}</Text>
                      <Text style={styles.statLbl}>RATE / METRIC</Text>
                    </View>
                  </>
                ) : null}
              </View>

              {(selected.fours !== undefined || selected.sixes !== undefined) && (
                <View style={styles.boundaryTagsRow}>
                  <View style={styles.boundaryTag}>
                    <Text style={styles.boundaryTagText}>🏏 {selected.fours || 0} Fours (4s)</Text>
                  </View>
                  <View style={[styles.boundaryTag, styles.sixTag]}>
                    <Text style={[styles.boundaryTagText, { color: '#be123c' }]}>🚀 {selected.sixes || 0} Sixes (6s)</Text>
                  </View>
                </View>
              )}

              <Text style={styles.subtitle}>{selected.subtitle}</Text>
            </View>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#10b981' }]}
              onPress={() => setShowLiveModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>CONTINUE LIVE SCORING ▶</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCloseX}
              onPress={() => setShowLiveModal(false)}
            >
              <Text style={styles.modalCloseXText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fcfbf7'
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#b8860b'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  backBtn: {
    backgroundColor: '#fffbeb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  backBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309'
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.5
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1
  },
  testModalBtn: {
    backgroundColor: '#d97706',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3
  },
  testModalBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5
  },
  tabScrollWrapper: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  tabScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6
  },
  tabChip: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#cbd5e1'
  },
  tabChipActive: {
    backgroundColor: '#fffbeb',
    borderColor: '#d97706'
  },
  tabChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b'
  },
  tabChipTextActive: {
    color: '#0f172a',
    fontWeight: '900'
  },
  mainContent: {
    alignItems: 'center',
    padding: 16,
    paddingBottom: 40
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 440,
    marginBottom: 12
  },
  stepBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  stepBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284c7'
  },
  stepIndicator: {
    backgroundColor: '#fffbeb',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  stepIndicatorText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#b45309',
    letterSpacing: 0.5
  },
  milestoneCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: '#b8860b',
    overflow: 'hidden',
    alignItems: 'center',
    paddingBottom: 20,
    position: 'relative',
    shadowColor: '#b8860b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 8
  },
  milestoneRibbon: {
    width: '100%',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2
  },
  milestoneRibbonText: {
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1.2
  },
  figurineContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4
  },
  detailsBox: {
    width: '92%',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#fde68a',
    marginTop: 2
  },
  detailTitle: {
    color: '#b45309',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  detailPlayerName: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: 0.5
  },
  detailTeamName: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1
  },
  statsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  statItem: {
    alignItems: 'center',
    flex: 1
  },
  statVal: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900'
  },
  statLbl: {
    color: '#854d0e',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 2
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#fde68a'
  },
  boundaryTagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8
  },
  boundaryTag: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#22c55e',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12
  },
  sixTag: {
    backgroundColor: '#fff1f2',
    borderColor: '#f43f5e'
  },
  boundaryTagText: {
    color: '#15803d',
    fontSize: 10,
    fontWeight: '800'
  },
  subtitle: {
    color: '#475569',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
    lineHeight: 16
  },
  actionBtn: {
    backgroundColor: '#d97706',
    width: '92%',
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4
  },
  actionBtnText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.5
  },
  checklistCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 14,
    marginTop: 16
  },
  checklistTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#15803d',
    letterSpacing: 0.5,
    marginBottom: 8
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6
  },
  checkIcon: {
    fontSize: 12,
    color: '#15803d',
    fontWeight: '900'
  },
  checkText: {
    fontSize: 11,
    color: '#334155',
    flex: 1,
    lineHeight: 15
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14
  },
  modalCloseX: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalCloseXText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900'
  }
});
