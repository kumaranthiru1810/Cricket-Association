import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  useWindowDimensions,
  Modal
} from 'react-native';

const IMG_CENTURY = require('../../../assets/century_batsman.jpg');
const IMG_FIFTY = require('../../../assets/milestone_batsman.png');
const IMG_BOWLER = require('../../../assets/best_bowler.png');
const IMG_MOTM = require('../../../assets/man_of_the_match.png');
const IMG_CATCH = require('../../../assets/catch_milestone.jpg');
const IMG_RUN_OUT = require('../../../assets/run_out_milestone.png');
const IMG_CHAMPIONS = require('../../../assets/cricket_champions.png');

export interface HighlightItem {
  id: string;
  type: 'CENTURY' | 'FIFTY' | 'FIFER' | 'MOTM' | 'VICTORY' | 'CATCH' | 'RUN_OUT' | 'PARTNERSHIP';
  categoryTitle: string;
  badge: string;
  playerName: string;
  teamName: string;
  stats: string;
  description: string;
  imageKey: 'CENTURY' | 'FIFTY' | 'BOWLER' | 'MOTM' | 'CATCH' | 'RUN_OUT' | 'VICTORY';
}

interface MatchHighlightsBannerProps {
  highlights?: HighlightItem[];
  title?: string;
  subtitle?: string;
  variant?: 'full' | 'compact';
  onPressItem?: (item: HighlightItem) => void;
}

const DEFAULT_HIGHLIGHTS: HighlightItem[] = [
  {
    id: 'hl-1',
    type: 'CENTURY',
    categoryTitle: '👑 CENTURY ALERT',
    badge: '100 RUNS',
    playerName: 'N. Jagadeesan',
    teamName: 'Virudhunagar Spartans',
    stats: '100* (58b • 11x4, 4x6 • SR: 172.4)',
    description: 'Player scored 100 runs – sensational batting milestone on the championship stage!',
    imageKey: 'CENTURY'
  },
  {
    id: 'hl-2',
    type: 'FIFER',
    categoryTitle: '🔥 FIVE-WICKET HAUL',
    badge: '5 WICKETS',
    playerName: 'S. Sandeep Warrier',
    teamName: 'Rajapalayam Royals',
    stats: '5/18 (3.4 Ov • ER: 4.90)',
    description: 'A bowler takes five wickets in an innings – devastating swing and seam bowling spell.',
    imageKey: 'BOWLER'
  },
  {
    id: 'hl-3',
    type: 'MOTM',
    categoryTitle: '🏆 PLAYER OF THE MATCH',
    badge: 'MAN OF THE MATCH',
    playerName: 'K. Murugan',
    teamName: 'Virudhunagar Spartans',
    stats: '86 Runs (48b) & 2 Catches',
    description: 'Match-winning all-round performance and official tournament honors award.',
    imageKey: 'MOTM'
  },
  {
    id: 'hl-4',
    type: 'VICTORY',
    categoryTitle: '🚀 TEAM VICTORY',
    badge: 'MATCH RESULT',
    playerName: 'Virudhunagar Spartans',
    teamName: 'District Championship 2026',
    stats: 'Won by 24 Runs (184/5 vs 160/9)',
    description: 'Official match results, tournament standings points and team championship glory.',
    imageKey: 'VICTORY'
  },
  {
    id: 'hl-5',
    type: 'FIFTY',
    categoryTitle: '⭐ HALF-CENTURY ALERT',
    badge: '50 RUNS',
    playerName: 'S. Saravanan',
    teamName: 'Sivakasi Strikers',
    stats: '54* (32b • 6x4, 2x6 • SR: 168.7)',
    description: 'Crucial anchoring half-century milestone under intense match pressure.',
    imageKey: 'FIFTY'
  },
  {
    id: 'hl-6',
    type: 'CATCH',
    categoryTitle: '🦅 SPECTACULAR CATCH',
    badge: 'TOP CATCH',
    playerName: 'M. Siddharth',
    teamName: 'Rajapalayam Royals',
    stats: '3 Catches in the Match',
    description: 'Remarkable diving agility near the boundary rope to dismiss dangerous batters.',
    imageKey: 'CATCH'
  },
  {
    id: 'hl-7',
    type: 'RUN_OUT',
    categoryTitle: '🎯 DIRECT HIT RUN OUT',
    badge: 'RUN OUT',
    playerName: 'R. Sanjay',
    teamName: 'Virudhunagar Spartans',
    stats: 'Bullseye Throw (One Stump)',
    description: 'Razor-sharp direct throw from deep cover finding the batter short of the crease.',
    imageKey: 'RUN_OUT'
  }
];

export const MatchHighlightsBanner: React.FC<MatchHighlightsBannerProps> = ({
  highlights,
  title = '⚡ AUTOMATIC MATCH HIGHLIGHTS & MILESTONES',
  subtitle = 'Instant verified highlights: Centuries, Fifers, Player of the Match & Record Performances',
  variant = 'full',
  onPressItem
}) => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const isMobile = width < 600;

  const [selectedHighlight, setSelectedHighlight] = useState<HighlightItem | null>(null);

  // If no highlights are provided or list is empty, never render fake/dummy cards!
  if (!highlights || highlights.length === 0) {
    return null;
  }

  const getImageSource = (key: string) => {
    switch (key) {
      case 'CENTURY':
        return IMG_CENTURY;
      case 'FIFTY':
        return IMG_FIFTY;
      case 'BOWLER':
        return IMG_BOWLER;
      case 'MOTM':
        return IMG_MOTM;
      case 'CATCH':
        return IMG_CATCH;
      case 'RUN_OUT':
        return IMG_RUN_OUT;
      case 'VICTORY':
      default:
        return IMG_CHAMPIONS;
    }
  };

  const getAccentColor = (type: string) => {
    switch (type) {
      case 'CENTURY':
        return { bg: '#fffbeb', border: '#f59e0b', tag: '#b45309', badgeBg: '#fef3c7' };
      case 'FIFER':
        return { bg: '#fef2f2', border: '#ef4444', tag: '#b91c1c', badgeBg: '#fee2e2' };
      case 'MOTM':
        return { bg: '#fefce8', border: '#eab308', tag: '#854d0e', badgeBg: '#fef08a' };
      case 'VICTORY':
        return { bg: '#f0fdf4', border: '#22c55e', tag: '#15803d', badgeBg: '#dcfce7' };
      case 'FIFTY':
        return { bg: '#eff6ff', border: '#3b82f6', tag: '#1d4ed8', badgeBg: '#dbeafe' };
      case 'CATCH':
        return { bg: '#f5f3ff', border: '#8b5cf6', tag: '#6d28d9', badgeBg: '#ede9fe' };
      case 'RUN_OUT':
        return { bg: '#fff1f2', border: '#f43f5e', tag: '#be123c', badgeBg: '#ffe4e6' };
      default:
        return { bg: '#f8fafc', border: '#64748b', tag: '#334155', badgeBg: '#e2e8f0' };
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.tagPill}>
            <Text style={styles.tagPillText}>🏆 BROADCAST HIGHLIGHT ENGINE</Text>
          </View>
          <Text style={[styles.mainTitle, isMobile && { fontSize: 16 }]}>{title}</Text>
          <Text style={styles.subTitle}>{subtitle}</Text>
        </View>
      </View>

      {/* Horizontal Scroll of Highlight Cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollList}
      >
        {highlights.map((hl) => {
          const colors = getAccentColor(hl.type);
          return (
            <TouchableOpacity
              key={hl.id}
              style={[
                styles.highlightCard,
                { backgroundColor: colors.bg, borderColor: colors.border },
                isMobile && { width: 280 }
              ]}
              onPress={() => {
                if (onPressItem) {
                  onPressItem(hl);
                } else {
                  setSelectedHighlight(hl);
                }
              }}
              activeOpacity={0.85}
            >
              {/* Card Top: Category and Badge */}
              <View style={styles.cardTopRow}>
                <Text style={[styles.categoryTitle, { color: colors.tag }]}>
                  {hl.categoryTitle}
                </Text>
                <View style={[styles.badgePill, { backgroundColor: colors.badgeBg, borderColor: colors.border }]}>
                  <Text style={[styles.badgePillText, { color: colors.tag }]}>{hl.badge}</Text>
                </View>
              </View>

              {/* Graphic Image Thumbnail */}
              <View style={[styles.imageContainer, { borderColor: colors.border }]}>
                <Image
                  source={getImageSource(hl.imageKey)}
                  style={styles.cardImage}
                  resizeMode={hl.imageKey === 'MOTM' || hl.imageKey === 'BOWLER' || hl.imageKey === 'CENTURY' ? 'contain' : 'cover'}
                />
              </View>

              {/* Player & Stats */}
              <View style={styles.contentCol}>
                <Text style={styles.playerName} numberOfLines={1}>
                  {hl.playerName}
                </Text>
                <Text style={styles.teamName} numberOfLines={1}>
                  {hl.teamName}
                </Text>

                {/* Stats Pill */}
                <View style={styles.statsBox}>
                  <Text style={[styles.statsText, { color: colors.tag }]} numberOfLines={1}>
                    {hl.stats}
                  </Text>
                </View>

                <Text style={styles.descriptionText} numberOfLines={2}>
                  {hl.description}
                </Text>
              </View>

              {/* Bottom View Details Link */}
              <View style={styles.cardFooter}>
                <Text style={[styles.viewDetailsText, { color: colors.tag }]}>Tap to View Details ▶</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Detail Modal when tapped */}
      <Modal
        visible={Boolean(selectedHighlight)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedHighlight(null)}
      >
        <View style={styles.modalOverlay}>
          {selectedHighlight && (
            <View style={styles.modalCard}>
              <View style={styles.modalHeaderRibbon}>
                <Text style={styles.modalHeaderRibbonText}>{selectedHighlight.categoryTitle}</Text>
              </View>

              <View style={styles.modalImageWrapper}>
                <Image
                  source={getImageSource(selectedHighlight.imageKey)}
                  style={styles.modalHeroImage}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.modalBody}>
                <Text style={styles.modalPlayerName}>{selectedHighlight.playerName}</Text>
                <Text style={styles.modalTeamName}>{selectedHighlight.teamName}</Text>

                <View style={styles.modalStatsPill}>
                  <Text style={styles.modalStatsText}>{selectedHighlight.stats}</Text>
                </View>

                <Text style={styles.modalDescText}>{selectedHighlight.description}</Text>

                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setSelectedHighlight(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalCloseBtnText}>✕ Close Highlight</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 14,
    width: '100%'
  },
  headerRow: {
    marginBottom: 12,
    paddingHorizontal: 4
  },
  tagPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 4
  },
  tagPillText: {
    color: '#b45309',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  mainTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.3
  },
  subTitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500'
  },
  scrollList: {
    paddingVertical: 6,
    gap: 12
  },
  highlightCard: {
    width: 310,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
    justifyContent: 'space-between'
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1
  },
  badgePillText: {
    fontSize: 9,
    fontWeight: '900'
  },
  imageContainer: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  cardImage: {
    width: '100%',
    height: '100%'
  },
  contentCol: {
    flex: 1
  },
  playerName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a'
  },
  teamName: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 1
  },
  statsBox: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  statsText: {
    fontSize: 11,
    fontWeight: '800'
  },
  descriptionText: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 15,
    fontWeight: '500'
  },
  cardFooter: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)'
  },
  viewDetailsText: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right'
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16
  },
  modalCard: {
    width: '92%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#f59e0b',
    alignItems: 'center'
  },
  modalHeaderRibbon: {
    width: '100%',
    backgroundColor: '#f59e0b',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalHeaderRibbonText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 1
  },
  modalImageWrapper: {
    width: '100%',
    height: 180,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalHeroImage: {
    width: '90%',
    height: '90%'
  },
  modalBody: {
    padding: 16,
    alignItems: 'center',
    width: '100%'
  },
  modalPlayerName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a'
  },
  modalTeamName: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
    marginTop: 2
  },
  modalStatsPill: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginVertical: 10
  },
  modalStatsText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#b45309'
  },
  modalDescText: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16
  },
  modalCloseBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24
  },
  modalCloseBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800'
  }
});

export default MatchHighlightsBanner;

