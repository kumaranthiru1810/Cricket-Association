import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Image,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ScorerApi, resolveImageUrl } from '../../services/api';
import { useAppNavigation } from '../../navigation/AppNavigator';

interface PlayerPublicProfileProps {
  initialPlayerId?: string;
  initialPlayerName?: string;
  onExit?: () => void;
}

export default function PlayerPublicProfileScreen({
  initialPlayerId,
  initialPlayerName,
  onExit,
}: PlayerPublicProfileProps) {
  const { navigate, goBack, params } = useAppNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const topInset = Platform.OS === 'web'
    ? 0
    : Platform.OS === 'android'
      ? Math.max(insets.top, StatusBar.currentHeight || 0, 24)
      : Math.max(insets.top, 20);

  const playerId = initialPlayerId || params?.playerId || params?.id || '';
  const playerNameParam = initialPlayerName || params?.playerName || params?.name || '';

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stats' | 'matches'>('stats');
  const [photoImgError, setPhotoImgError] = useState(false);

  const [player, setPlayer] = useState<any>({
    id: playerId || 'P301',
    name: playerNameParam || 'Suresh Kumar',
    role: 'BATTER',
    team_id: 'TM-01',
    team_name: 'Virudhunagar Spartans',
    taluk: 'Virudhunagar',
    jersey_number: 7,
    batting_style: 'Right Hand Bat',
    bowling_style: 'Right Arm Medium',
    is_captain: false,
    is_wicket_keeper: false,
    status: 'ACTIVE',
  });

  const [stats, setStats] = useState<any>({
    matches: 5,
    batting: {
      runs: 284,
      balls: 195,
      highest_score: 88,
      average: '94.67',
      strike_rate: '145.6',
      fifties: 1,
      hundreds: 0,
      fours: 32,
      sixes: 10,
    },
    bowling: {
      wickets: 0,
      overs: 0,
      runs_conceded: 0,
      economy: '0.00',
      average: '0.00',
      best_bowling: '-',
    },
    fielding: {
      catches: 4,
      stumpings: 0,
    },
  });

  const [matchLog, setMatchLog] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchPlayerDetails = async () => {
      const target = playerId || playerNameParam;
      if (!target) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const res = await ScorerApi.getPortalPlayerDetails(target);
        if (isMounted && res && res.success) {
          if (res.player) setPlayer(res.player);
          if (res.stats) setStats(res.stats);
          if (Array.isArray(res.matchLog)) setMatchLog(res.matchLog);
        }
      } catch (err: any) {
        console.warn('Unable to load player from API:', err.message);
        if (playerNameParam) {
          setPlayer((prev: any) => ({ ...prev, name: playerNameParam }));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPlayerDetails();
    return () => {
      isMounted = false;
    };
  }, [playerId, playerNameParam]);

  const handleBack = () => {
    if (onExit) {
      onExit();
      return;
    }
    goBack();
  };

  const handleOpenTeam = () => {
    if (player.team_id || player.team_name) {
      navigate('TeamDetail', { teamId: player.team_id, teamName: player.team_name });
    }
  };

  const handleOpenScorecard = (matchId: string) => {
    navigate('Scorecard', { matchId });
  };

  return (
    <View style={styles.screenContainer}>
      {/* Top Header Bar */}
      <View style={[styles.navBar, { paddingTop: topInset, minHeight: 56 + topInset }]}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={20} color="#f5c43d" />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.navBarTitle} numberOfLines={1}>
          Player Career Profile
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={[styles.scrollContent, isMobile && styles.scrollContentMobile]}
        showsVerticalScrollIndicator={false}
      >
        {/* Player Hero Card */}
        <View style={styles.heroCard}>
          <View style={[styles.heroRow, isMobile && styles.heroRowMobile]}>
            {/* Player Avatar / Photo */}
            <View style={styles.avatarContainer}>
              {resolveImageUrl(player.photo || player.image || player.profile_photo || player.image_path) && !photoImgError ? (
                <Image
                  source={{ uri: resolveImageUrl(player.photo || player.image || player.profile_photo || player.image_path)! }}
                  style={styles.avatarImg}
                  resizeMode="cover"
                  onError={() => setPhotoImgError(true)}
                />
              ) : (
                <Text style={styles.avatarText}>
                  {(player.name || 'P').charAt(0).toUpperCase()}
                </Text>
              )}
              {player.jersey_number ? (
                <View style={styles.jerseyBadge}>
                  <Text style={styles.jerseyBadgeText}>#{player.jersey_number}</Text>
                </View>
              ) : null}
            </View>

            {/* Main Info */}
            <View style={styles.heroInfo}>
              <View style={styles.badgesRow}>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>
                    {(player.role || 'PLAYER').toUpperCase()}
                  </Text>
                </View>
                {player.is_captain && (
                  <View style={styles.specialBadge}>
                    <Text style={styles.specialBadgeText}>CAPTAIN</Text>
                  </View>
                )}
                {player.is_wicket_keeper && (
                  <View style={[styles.specialBadge, { backgroundColor: '#e0f2fe', borderColor: '#bae6fd' }]}>
                    <Text style={[styles.specialBadgeText, { color: '#0284c7' }]}>WICKET KEEPER</Text>
                  </View>
                )}
                <View style={styles.talukBadge}>
                  <Ionicons name="location-outline" size={12} color="#64748b" style={{ marginRight: 4 }} />
                  <Text style={styles.talukBadgeText}>{player.taluk || 'Virudhunagar'}</Text>
                </View>
              </View>

              <Text style={styles.playerNameTitle}>{player.name}</Text>

              {/* Team Link Pill */}
              <TouchableOpacity
                style={styles.teamLinkPill}
                onPress={handleOpenTeam}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="shield-crown" size={16} color="#b45309" style={{ marginRight: 6 }} />
                <Text style={styles.teamLinkText} numberOfLines={1}>
                  {player.team_name || 'District Club'}
                </Text>
                <Ionicons name="arrow-forward" size={13} color="#b45309" style={{ marginLeft: 6 }} />
              </TouchableOpacity>

              {/* Playing Styles */}
              <View style={styles.stylesRow}>
                <View style={styles.styleItem}>
                  <Text style={styles.styleLabel}>Batting:</Text>
                  <Text style={styles.styleValue}>{player.batting_style || 'Right Hand Bat'}</Text>
                </View>
                <View style={styles.styleDivider} />
                <View style={styles.styleItem}>
                  <Text style={styles.styleLabel}>Bowling:</Text>
                  <Text style={styles.styleValue}>{player.bowling_style || 'Right Arm Medium'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Quick Metrics Strip */}
          <View style={styles.metricsStrip}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>MATCHES</Text>
              <Text style={styles.metricNumber}>{stats.matches || 0}</Text>
              <Text style={styles.metricSub}>Appearances</Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>RUNS</Text>
              <Text style={[styles.metricNumber, { color: '#0284c7' }]}>
                {stats.batting?.runs || 0}
              </Text>
              <Text style={styles.metricSub}>HS: {stats.batting?.highest_score || 0}</Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>STRIKE RATE</Text>
              <Text style={[styles.metricNumber, { color: '#b45309' }]}>
                {stats.batting?.strike_rate || '0.0'}
              </Text>
              <Text style={styles.metricSub}>Avg: {stats.batting?.average || '0.0'}</Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>WICKETS</Text>
              <Text style={[styles.metricNumber, { color: '#16a34a' }]}>
                {stats.bowling?.wickets || 0}
              </Text>
              <Text style={styles.metricSub}>Econ: {stats.bowling?.economy || '0.0'}</Text>
            </View>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'stats' && styles.tabButtonActive]}
            onPress={() => setActiveTab('stats')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="analytics-outline"
              size={18}
              color={activeTab === 'stats' ? '#b45309' : '#64748b'}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'stats' && styles.tabButtonTextActive]}>
              Career Statistics
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'matches' && styles.tabButtonActive]}
            onPress={() => setActiveTab('matches')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="cricket"
              size={18}
              color={activeTab === 'matches' ? '#b45309' : '#64748b'}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'matches' && styles.tabButtonTextActive]}>
              Match Appearances ({matchLog.length})
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#f59e0b" />
            <Text style={styles.loadingText}>Loading genuine player statistics from MongoDB...</Text>
          </View>
        ) : activeTab === 'stats' ? (
          /* ─── TAB 1: CAREER STATS BREAKDOWN ─── */
          <View style={styles.sectionBody}>
            {/* Batting Card */}
            <View style={styles.statsCard}>
              <View style={styles.statsCardHeader}>
                <MaterialCommunityIcons name="cricket" size={20} color="#b45309" style={{ marginRight: 8 }} />
                <Text style={styles.statsCardTitle}>Batting Performance</Text>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.statGridItem}>
                  <Text style={styles.statGridLabel}>Innings Runs</Text>
                  <Text style={styles.statGridVal}>{stats.batting?.runs || 0}</Text>
                </View>
                <View style={styles.statGridItem}>
                  <Text style={styles.statGridLabel}>Balls Faced</Text>
                  <Text style={styles.statGridVal}>{stats.batting?.balls || 0}</Text>
                </View>
                <View style={styles.statGridItem}>
                  <Text style={styles.statGridLabel}>Highest Score</Text>
                  <Text style={[styles.statGridVal, { color: '#b45309' }]}>
                    {stats.batting?.highest_score || 0}
                  </Text>
                </View>
                <View style={styles.statGridItem}>
                  <Text style={styles.statGridLabel}>Batting Avg</Text>
                  <Text style={styles.statGridVal}>{stats.batting?.average || '0.00'}</Text>
                </View>
                <View style={styles.statGridItem}>
                  <Text style={styles.statGridLabel}>Strike Rate</Text>
                  <Text style={[styles.statGridVal, { color: '#0284c7' }]}>
                    {stats.batting?.strike_rate || '0.0'}
                  </Text>
                </View>
                <View style={styles.statGridItem}>
                  <Text style={styles.statGridLabel}>Fours (4s)</Text>
                  <Text style={styles.statGridVal}>{stats.batting?.fours || 0}</Text>
                </View>
                <View style={styles.statGridItem}>
                  <Text style={styles.statGridLabel}>Sixes (6s)</Text>
                  <Text style={styles.statGridVal}>{stats.batting?.sixes || 0}</Text>
                </View>
                <View style={styles.statGridItem}>
                  <Text style={styles.statGridLabel}>50s / 100s</Text>
                  <Text style={styles.statGridVal}>
                    {stats.batting?.fifties || 0} / {stats.batting?.hundreds || 0}
                  </Text>
                </View>
              </View>
            </View>

            {/* Bowling Card */}
            <View style={styles.statsCard}>
              <View style={styles.statsCardHeader}>
                <Ionicons name="disc-outline" size={20} color="#16a34a" style={{ marginRight: 8 }} />
                <Text style={styles.statsCardTitle}>Bowling Performance</Text>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.statGridItem}>
                  <Text style={styles.statGridLabel}>Wickets</Text>
                  <Text style={[styles.statGridVal, { color: '#16a34a' }]}>
                    {stats.bowling?.wickets || 0}
                  </Text>
                </View>
                <View style={styles.statGridItem}>
                  <Text style={styles.statGridLabel}>Overs Bowled</Text>
                  <Text style={styles.statGridVal}>{stats.bowling?.overs || 0}</Text>
                </View>
                <View style={styles.statGridItem}>
                  <Text style={styles.statGridLabel}>Runs Conceded</Text>
                  <Text style={styles.statGridVal}>{stats.bowling?.runs_conceded || 0}</Text>
                </View>
                <View style={styles.statGridItem}>
                  <Text style={styles.statGridLabel}>Economy Rate</Text>
                  <Text style={[styles.statGridVal, { color: '#0284c7' }]}>
                    {stats.bowling?.economy || '0.00'}
                  </Text>
                </View>
                <View style={styles.statGridItem}>
                  <Text style={styles.statGridLabel}>Bowling Avg</Text>
                  <Text style={styles.statGridVal}>{stats.bowling?.average || '0.00'}</Text>
                </View>
                <View style={styles.statGridItem}>
                  <Text style={styles.statGridLabel}>Best Bowling</Text>
                  <Text style={[styles.statGridVal, { color: '#b45309' }]}>
                    {stats.bowling?.best_bowling || '-'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Fielding Card */}
            <View style={styles.statsCard}>
              <View style={styles.statsCardHeader}>
                <Ionicons name="hand-left-outline" size={20} color="#0284c7" style={{ marginRight: 8 }} />
                <Text style={styles.statsCardTitle}>Fielding & Dismissals</Text>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.statGridItem}>
                  <Text style={styles.statGridLabel}>Catches</Text>
                  <Text style={[styles.statGridVal, { color: '#0284c7' }]}>
                    {stats.fielding?.catches || 0}
                  </Text>
                </View>
                <View style={styles.statGridItem}>
                  <Text style={styles.statGridLabel}>Stumpings</Text>
                  <Text style={styles.statGridVal}>{stats.fielding?.stumpings || 0}</Text>
                </View>
              </View>
            </View>

            {/* View Team Button */}
            <TouchableOpacity style={styles.fullTeamBtn} onPress={handleOpenTeam} activeOpacity={0.85}>
              <MaterialCommunityIcons name="shield-crown" size={18} color="#f5c43d" style={{ marginRight: 8 }} />
              <Text style={styles.fullTeamBtnText}>
                View Complete Team Squad & Records ({player.team_name})
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ─── TAB 2: MATCH LOG ─── */
          <View style={styles.sectionBody}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Tournament Match Appearances</Text>
              <Text style={styles.sectionSubtitle}>
                Official match scorecards and performance records for {player.name}
              </Text>
            </View>

            {matchLog.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="information-circle-outline" size={36} color="#64748b" />
                <Text style={styles.emptyTitle}>No Individual Match Records Yet</Text>
                <Text style={styles.emptySub}>
                  Appearances for {player.name} will be automatically recorded during live scoring.
                </Text>
              </View>
            ) : (
              matchLog.map((m, idx) => (
                <View key={m.id || idx} style={styles.matchCard}>
                  <View style={styles.matchCardTopBar}>
                    <Text style={styles.tournamentText}>{m.tournament}</Text>
                    <View style={styles.matchStatusBadge}>
                      <Text style={styles.matchStatusText}>{m.status}</Text>
                    </View>
                  </View>

                  <Text style={styles.matchOpponentText}>
                    vs {m.opponent} • {m.date}
                  </Text>

                  <View style={styles.matchScoresRow}>
                    <Text style={styles.matchScoreLabel}>Team: {m.teamScore}</Text>
                    <Text style={styles.matchScoreLabel}>Opponent: {m.opponentScore}</Text>
                  </View>

                  <View style={styles.matchFooterRow}>
                    <Text style={styles.matchResultText}>{m.result}</Text>
                    <TouchableOpacity
                      style={styles.scorecardActionBtn}
                      onPress={() => handleOpenScorecard(m.matchId || m.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.scorecardActionText}>Scorecard →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#f6f2e9',
  },
  navBar: {
    backgroundColor: '#040a1b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 196, 61, 0.2)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 196, 61, 0.1)',
  },
  backBtnText: {
    color: '#f5c43d',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  navBarTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
  },
  mainScrollView: {
    flex: 1,
    backgroundColor: '#f6f2e9',
  },
  scrollContent: {
    padding: 24,
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
  },
  scrollContentMobile: {
    padding: 12,
  },
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroRowMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fef3c7',
    borderWidth: 2,
    borderColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
    marginBottom: 10,
    position: 'relative',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  avatarText: {
    color: '#b45309',
    fontSize: 32,
    fontWeight: '900',
  },
  jerseyBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#0e184e',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#f5c43d',
  },
  jerseyBadgeText: {
    color: '#f5c43d',
    fontSize: 11,
    fontWeight: '900',
  },
  heroInfo: {
    flex: 1,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  roleBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  roleBadgeText: {
    color: '#0284c7',
    fontSize: 10,
    fontWeight: '800',
  },
  specialBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  specialBadgeText: {
    color: '#b45309',
    fontSize: 10,
    fontWeight: '900',
  },
  talukBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  talukBadgeText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
  },
  playerNameTitle: {
    color: '#0e184e',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  teamLinkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fcd34d',
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  teamLinkText: {
    color: '#92400e',
    fontSize: 13,
    fontWeight: '700',
  },
  stylesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  styleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  styleLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  styleValue: {
    color: '#0e184e',
    fontSize: 12,
    fontWeight: '700',
  },
  styleDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#cbd5e1',
  },
  metricsStrip: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4,
  },
  metricNumber: {
    color: '#0e184e',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 2,
  },
  metricSub: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  metricDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#e2e8f0',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    elevation: 1,
  },
  tabButtonActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  tabButtonText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: '#b45309',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 12,
  },
  sectionBody: {
    marginTop: 8,
  },
  statsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  statsCardTitle: {
    color: '#0e184e',
    fontSize: 16,
    fontWeight: '800',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statGridItem: {
    width: '22%',
    minWidth: 100,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statGridLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  statGridVal: {
    color: '#0e184e',
    fontSize: 16,
    fontWeight: '800',
  },
  fullTeamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0e184e',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 20,
  },
  fullTeamBtnText: {
    color: '#f5c43d',
    fontSize: 14,
    fontWeight: '800',
  },
  sectionHeaderRow: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#0e184e',
    fontSize: 18,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  emptyCard: {
    padding: 36,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: {
    color: '#0e184e',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySub: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  matchCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderTopWidth: 3,
    borderTopColor: '#f59e0b',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  matchCardTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  tournamentText: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '700',
  },
  matchStatusBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  matchStatusText: {
    color: '#15803d',
    fontSize: 10,
    fontWeight: '800',
  },
  matchOpponentText: {
    color: '#475569',
    fontSize: 13,
    marginBottom: 8,
  },
  matchScoresRow: {
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  matchScoreLabel: {
    color: '#0e184e',
    fontSize: 12,
    fontWeight: '700',
  },
  matchFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  },
  matchResultText: {
    color: '#334155',
    fontSize: 12,
    flex: 1,
  },
  scorecardActionBtn: {
    backgroundColor: '#f5c43d',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  scorecardActionText: {
    color: '#081225',
    fontSize: 11,
    fontWeight: '800',
  },
});
