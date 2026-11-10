import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  useWindowDimensions,
  Image
} from 'react-native';
import { useScorerNavigation } from '../../navigation/ScorerNavigationContext';
import CricketConfetti from '../../components/common/CricketConfetti';
import CricketFigurine3D from '../../components/common/CricketFigurine3D';

const milestoneBatsmanImage = require('../../../assets/milestone_batsman.png');
const centuryBatsmanImage = require('../../../assets/century_batsman.jpg');
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
    accentColor: '#38bdf8'
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
    accentColor: '#fbbf24'
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
    image: centuryBatsmanImage,
    accentColor: '#ec4899'
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
    image: milestoneBatsmanImage,
    accentColor: '#38bdf8'
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
    image: centuryBatsmanImage,
    accentColor: '#fbbf24'
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
    accentColor: '#06b6d4'
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
    accentColor: '#ef4444'
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
    accentColor: '#8b5cf6'
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
    accentColor: '#f97316'
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
    accentColor: '#f59e0b'
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
    accentColor: '#eab308'
  }
];

export default function MilestoneGalleryScreen() {
  const { navigate } = useScorerNavigation();
  const { width } = useWindowDimensions();
  const isMobile = width < 600;

  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [showLiveModal, setShowLiveModal] = useState<boolean>(false);

  const selected = ALL_MILESTONES[selectedIndex];

  const handleNext = () => {
    setSelectedIndex((prev) => (prev + 1) % ALL_MILESTONES.length);
  };

  const handlePrev = () => {
    setSelectedIndex((prev) => (prev - 1 + ALL_MILESTONES.length) % ALL_MILESTONES.length);
  };

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
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
              Live visual verification for all 11 cricket milestones with zero text overlap
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

      {/* Milestone Selection Tabs */}
      <View style={styles.tabScrollWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
          {ALL_MILESTONES.map((m, idx) => {
            const isTabActive = idx === selectedIndex;
            return (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.tabChip,
                  isTabActive && [styles.tabChipActive, { borderColor: m.accentColor }]
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

        {/* The Exact Milestone Card Container */}
        <View style={[styles.milestoneCard, { maxWidth: isMobile ? 380 : 440 }]}>
          {/* Top Gold Ribbon */}
          <View style={[styles.milestoneRibbon, { backgroundColor: selected.accentColor }]}>
            <Text style={styles.milestoneRibbonText}>{selected.badge}</Text>
          </View>

          {/* 3D Figurine Statuette with Drop-down and Interactive Tilt */}
          <View style={styles.figurineContainer}>
            <CricketFigurine3D
              imageSource={selected.image}
              playerName={selected.playerName}
              badgeText={selected.badge}
              teamName={selected.teamName}
              milestoneTitle={selected.title}
              scoreText={selected.scoreText}
              ballsText={selected.ballsText}
              strikeRateText={selected.strikeRateText}
              fours={selected.fours}
              sixes={selected.sixes}
              height={320}
              interactive={true}
            />
          </View>

          {/* Details Box */}
          <View style={styles.detailsBox}>
            <Text style={styles.detailTitle}>{selected.title}</Text>
            <Text style={styles.detailPlayerName}>{selected.playerName.toUpperCase()}</Text>
            <Text style={styles.detailTeamName}>{selected.teamName.toUpperCase()}</Text>

            {/* Stat Pillars */}
            <View style={styles.statsBox}>
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{selected.scoreText}</Text>
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

            {/* Boundaries (if available) */}
            {(selected.fours !== undefined || selected.sixes !== undefined) && (
              <View style={styles.boundaryTagsRow}>
                <View style={styles.boundaryTag}>
                  <Text style={styles.boundaryTagText}>🏏 {selected.fours || 0} Fours (4s)</Text>
                </View>
                <View style={[styles.boundaryTag, styles.sixTag]}>
                  <Text style={styles.boundaryTagText}>🚀 {selected.sixes || 0} Sixes (6s)</Text>
                </View>
              </View>
            )}

            <Text style={styles.subtitle}>{selected.subtitle}</Text>
          </View>

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
            <Text style={styles.checkText}>Plaque Text: Line 1 (★ {selected.playerName.toUpperCase()} ★) is 100% visible with zero overlap.</Text>
          </View>
          <View style={styles.checklistRow}>
            <Text style={styles.checkIcon}>✓</Text>
            <Text style={styles.checkText}>Plaque Subtitle: Line 2 ({selected.badge}) is crystal-clear in metallic gold.</Text>
          </View>
          <View style={styles.checklistRow}>
            <Text style={styles.checkIcon}>✓</Text>
            <Text style={styles.checkText}>Statuette: Cutout character is centered and drop-lands onto golden turntable.</Text>
          </View>
          <View style={styles.checklistRow}>
            <Text style={styles.checkIcon}>✓</Text>
            <Text style={styles.checkText}>3D Interaction: Hover or drag statuette to rotate in 3D perspective.</Text>
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
            <View style={[styles.milestoneRibbon, { backgroundColor: selected.accentColor }]}>
              <Text style={styles.milestoneRibbonText}>{selected.badge}</Text>
            </View>

            <View style={styles.figurineContainer}>
              <CricketFigurine3D
                imageSource={selected.image}
                playerName={selected.playerName}
                badgeText={selected.badge}
                teamName={selected.teamName}
                milestoneTitle={selected.title}
                scoreText={selected.scoreText}
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
                  <Text style={styles.statVal}>{selected.scoreText}</Text>
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
                    <Text style={styles.boundaryTagText}>🚀 {selected.sixes || 0} Sixes (6s)</Text>
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
    backgroundColor: '#090d16'
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: '#1e293b'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  backBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  backBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38bdf8'
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1
  },
  testModalBtn: {
    backgroundColor: '#d97706',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8
  },
  testModalBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5
  },
  tabScrollWrapper: {
    backgroundColor: '#0a0f1d',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  tabScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6
  },
  tabChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#334155'
  },
  tabChipActive: {
    backgroundColor: '#0f172a'
  },
  tabChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8'
  },
  tabChipTextActive: {
    color: '#ffffff',
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
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  stepBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38bdf8'
  },
  stepIndicator: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6
  },
  stepIndicatorText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#f59e0b',
    letterSpacing: 0.5
  },
  milestoneCard: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#f59e0b',
    overflow: 'hidden',
    alignItems: 'center',
    paddingBottom: 20,
    position: 'relative',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12
  },
  milestoneRibbon: {
    width: '100%',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4
  },
  milestoneRibbonText: {
    color: '#0f172a',
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
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 2
  },
  detailTitle: {
    color: '#fbbf24',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  detailPlayerName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: 0.5
  },
  detailTeamName: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1
  },
  statsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: '#090d16',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  statItem: {
    alignItems: 'center',
    flex: 1
  },
  statVal: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '900'
  },
  statLbl: {
    color: '#64748b',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 2
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#1e293b'
  },
  boundaryTagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8
  },
  boundaryTag: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38bdf8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12
  },
  sixTag: {
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
    borderColor: '#ec4899'
  },
  boundaryTagText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800'
  },
  subtitle: {
    color: '#cbd5e1',
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8
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
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14,
    marginTop: 16
  },
  checklistTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#10b981',
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
    color: '#10b981',
    fontWeight: '900'
  },
  checkText: {
    fontSize: 11,
    color: '#cbd5e1',
    flex: 1,
    lineHeight: 15
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.92)',
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

