import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ScorerApi, resolveImageUrl } from '../../services/api';
import { useAppNavigation } from '../../navigation/AppNavigator';

interface TeamPublicProfileProps {
  initialTeamId?: string;
  initialTeamName?: string;
  onExit?: () => void;
}

export default function TeamPublicProfileScreen({
  initialTeamId,
  initialTeamName,
  onExit,
}: TeamPublicProfileProps) {
  const { navigate, goBack, params } = useAppNavigation();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const teamId = initialTeamId || params?.teamId || params?.id || '';
  const teamNameParam = initialTeamName || params?.teamName || params?.name || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'matches' | 'squad'>('matches');
  const [crestImgError, setCrestImgError] = useState(false);

  const [team, setTeam] = useState<any>({
    id: teamId || '',
    name: teamNameParam || 'Loading Team...',
    short_name: '',
    city: 'Virudhunagar',
    taluk: 'Virudhunagar',
    coach_name: '',
    status: 'APPROVED',
  });

  const [stats, setStats] = useState<any>({
    played: 0,
    won: 0,
    lost: 0,
    tied: 0,
    points: 0,
    winPercentage: 0,
    runRate: '0.00',
    nrr: '+0.000',
    totalRunsScored: 0,
    totalRunsConceded: 0,
  });

  const [squad, setSquad] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchTeamDetails = async () => {
      const searchTarget = teamId || teamNameParam;
      if (!searchTarget) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const res = await ScorerApi.getPortalTeamDetails(searchTarget);
        if (isMounted && res && res.success) {
          if (res.team) setTeam(res.team);
          if (res.stats) setStats(res.stats);
          if (Array.isArray(res.squad)) setSquad(res.squad);
          if (Array.isArray(res.matches)) setMatches(res.matches);
        }
      } catch (err: any) {
        console.warn('Unable to load team profile from backend API:', err.message);
        if (teamNameParam) {
          setTeam((prev: any) => ({ ...prev, name: teamNameParam }));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTeamDetails();
    return () => {
      isMounted = false;
    };
  }, [teamId, teamNameParam]);

  const handleBack = () => {
    if (onExit) {
      onExit();
      return;
    }
    goBack();
  };

  const handleOpenScorecard = (matchId: string) => {
    navigate('Scorecard', { matchId });
  };

  return (
    <View style={styles.screenContainer}>
      {/* Top Header Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={20} color="#f5c43d" />
          <Text style={styles.backBtnText}>Back to Portal</Text>
        </TouchableOpacity>
        <Text style={styles.navBarTitle} numberOfLines={1}>
          Team Performance Profile
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={[styles.scrollContent, isMobile && styles.scrollContentMobile]}
        showsVerticalScrollIndicator={false}
      >
        {/* Team Hero Card */}
        <View style={styles.heroCard}>
          <View style={[styles.heroRow, isMobile && styles.heroRowMobile]}>
            {/* Team Crest / Logo */}
            <View style={styles.crestContainer}>
              {resolveImageUrl(team.logo || team.photo || team.image || team.image_path) && !crestImgError ? (
                <Image
                  source={{ uri: resolveImageUrl(team.logo || team.photo || team.image || team.image_path)! }}
                  style={styles.crestImg}
                  resizeMode="cover"
                  onError={() => setCrestImgError(true)}
                />
              ) : (
                <MaterialCommunityIcons name="shield-crown" size={48} color="#f59e0b" />
              )}
            </View>

            {/* Team Main Info */}
            <View style={styles.heroInfo}>
              <View style={styles.badgesRow}>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>CFVD AFFILIATED CLUB</Text>
                </View>
                <View style={styles.talukBadge}>
                  <Ionicons name="location-outline" size={12} color="#475569" style={{ marginRight: 4 }} />
                  <Text style={styles.talukBadgeText}>{team.taluk || team.city || 'Virudhunagar'}</Text>
                </View>
              </View>

              <Text style={styles.teamNameTitle}>{team.name}</Text>

              <View style={styles.coachRow}>
                <Ionicons name="person-outline" size={14} color="#d97706" style={{ marginRight: 6 }} />
                <Text style={styles.coachLabel}>
                  Head Coach / Manager:{' '}
                  <Text style={styles.coachValue}>{team.coach_name || 'Staff Coach'}</Text>
                </Text>
              </View>
            </View>
          </View>

          {/* Key Statistics Strip */}
          <View style={styles.statsStrip}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>MATCHES</Text>
              <Text style={styles.statNumber}>{stats.played || 0}</Text>
              <Text style={styles.statSubText}>
                {stats.won || 0}W • {stats.lost || 0}L
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statBox}>
              <Text style={styles.statLabel}>RUN RATE</Text>
              <Text style={[styles.statNumber, { color: '#0284c7' }]}>
                {stats.runRate || '7.80'}
              </Text>
              <Text style={styles.statSubText}>Runs / Over</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statBox}>
              <Text style={styles.statLabel}>NET RUN RATE</Text>
              <Text
                style={[
                  styles.statNumber,
                  { color: String(stats.nrr || '').startsWith('+') ? '#16a34a' : '#dc2626' },
                ]}
              >
                {stats.nrr || '+0.000'}
              </Text>
              <Text style={styles.statSubText}>Tournament NRR</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statBox}>
              <Text style={styles.statLabel}>POINTS</Text>
              <Text style={[styles.statNumber, { color: '#d97706' }]}>{stats.points || 0}</Text>
              <Text style={styles.statSubText}>{stats.winPercentage || 0}% Win Rate</Text>
            </View>
          </View>
        </View>

        {/* Tab Navigation (Matches / Scorecards vs Squad) */}
        <View style={styles.tabsContainer}>
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
              Match Scorecards ({matches.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'squad' && styles.tabButtonActive]}
            onPress={() => setActiveTab('squad')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="people-outline"
              size={18}
              color={activeTab === 'squad' ? '#b45309' : '#64748b'}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'squad' && styles.tabButtonTextActive]}>
              Team Members & Squad ({squad.length})
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#d97706" />
            <Text style={styles.loadingText}>Loading team performance data & scorecards...</Text>
          </View>
        ) : activeTab === 'matches' ? (
          /* ─── TAB 1: MATCH SCORECARDS ─── */
          <View style={styles.sectionBody}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Official Match History & Scorecards</Text>
              <Text style={styles.sectionSubtitle}>
                Detailed innings, overs, results, and verified scorecards
              </Text>
            </View>

            {matches.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="information-circle-outline" size={36} color="#64748b" />
                <Text style={styles.emptyTitle}>No Matches Scheduled Yet</Text>
                <Text style={styles.emptySub}>
                  Upcoming fixtures for {team.name} will be displayed here once sanctioned.
                </Text>
              </View>
            ) : (
              matches.map((m, idx) => (
                <View key={m.id || idx} style={styles.matchCard}>
                  {/* Top Match Bar */}
                  <View style={styles.matchCardTopBar}>
                    <View style={styles.tournamentTag}>
                      <Ionicons name="trophy" size={13} color="#d97706" style={{ marginRight: 5 }} />
                      <Text style={styles.tournamentTagText}>{m.tournament}</Text>
                    </View>
                    <View
                      style={[
                        styles.matchStatusBadge,
                        m.status === 'LIVE'
                          ? styles.statusLive
                          : m.status === 'COMPLETED'
                          ? styles.statusCompleted
                          : styles.statusScheduled,
                      ]}
                    >
                      <Text style={styles.matchStatusText}>{m.status}</Text>
                    </View>
                  </View>

                  {/* Match Date and Venue */}
                  <View style={styles.matchVenueRow}>
                    <Ionicons name="calendar-outline" size={13} color="#64748b" style={{ marginRight: 5 }} />
                    <Text style={styles.matchVenueText}>
                      {m.date} • {m.venue}
                    </Text>
                  </View>

                  {/* Innings Scores Comparison */}
                  <View style={styles.scoreComparisonRow}>
                    {/* This Team */}
                    <View style={styles.scoreTeamCol}>
                      <Text style={[styles.scoreTeamName, { color: '#0e184e' }]} numberOfLines={1}>
                        {team.name}
                      </Text>
                      <Text style={styles.scoreValueText}>{m.teamScore || 'Yet to bat'}</Text>
                    </View>

                    <Text style={styles.scoreVsText}>VS</Text>

                    {/* Opponent */}
                    <View style={[styles.scoreTeamCol, { alignItems: 'flex-end' }]}>
                      <Text style={styles.scoreTeamName} numberOfLines={1}>
                        {m.opponentName}
                      </Text>
                      <Text style={styles.scoreValueText}>{m.opponentScore || 'Yet to bat'}</Text>
                    </View>
                  </View>

                  {/* Result Banner & Scorecard Action */}
                  <View style={styles.matchFooterRow}>
                    <View style={styles.resultContainer}>
                      <Ionicons
                        name={m.isWinner ? 'checkmark-circle' : 'information-circle'}
                        size={15}
                        color={m.isWinner ? '#16a34a' : '#475569'}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.resultText,
                          m.isWinner && { color: '#16a34a', fontWeight: '700' },
                        ]}
                        numberOfLines={1}
                      >
                        {m.result}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.viewScorecardBtn}
                      onPress={() => handleOpenScorecard(m.matchId || m.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.viewScorecardBtnText}>View Scorecard</Text>
                      <Ionicons name="arrow-forward" size={14} color="#081225" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : (
          /* ─── TAB 2: TEAM SQUAD & MEMBERS ─── */
          <View style={styles.sectionBody}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Registered Squad Roster</Text>
              <Text style={styles.sectionSubtitle}>
                Click any player to view their dedicated career statistics and records
              </Text>
            </View>

            <View style={styles.squadGrid}>
              {squad.map((player, idx) => {
                const playerPhotoUri = resolveImageUrl(player.photo || player.image || player.profile_photo || player.image_path);
                return (
                  <TouchableOpacity
                    key={player.id || idx}
                    style={[styles.playerCard, isMobile && styles.playerCardMobile]}
                    onPress={() => navigate('PlayerDetail', { playerId: player.id, playerName: player.name })}
                    activeOpacity={0.8}
                  >
                    <View style={styles.playerAvatar}>
                      {playerPhotoUri ? (
                        <Image
                          source={{ uri: playerPhotoUri }}
                          style={styles.playerAvatarImg}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={styles.playerAvatarText}>
                          {(player.name || 'P').charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>

                  <View style={styles.playerInfo}>
                    <View style={styles.playerNameRow}>
                      <Text style={styles.playerNameText} numberOfLines={1}>
                        {player.name}
                      </Text>
                      {player.is_captain && (
                        <View style={styles.captainBadge}>
                          <Text style={styles.captainBadgeText}>C</Text>
                        </View>
                      )}
                      {player.is_wicket_keeper && (
                        <View style={styles.keeperBadge}>
                          <Text style={styles.keeperBadgeText}>WK</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.playerRoleText}>{player.role || 'Player'}</Text>

                    <View style={styles.playerMetaRow}>
                      <Text style={styles.playerMetaText}>
                        {player.batting_style || 'Right Hand Bat'}
                      </Text>
                      {player.bowling_style && player.bowling_style !== 'None' && (
                        <>
                          <Text style={styles.playerMetaDot}>•</Text>
                          <Text style={styles.playerMetaText}>{player.bowling_style}</Text>
                        </>
                      )}
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {player.jerseyNumber ? (
                      <View style={styles.jerseyBox}>
                        <Text style={styles.jerseyNumberText}>#{player.jerseyNumber}</Text>
                      </View>
                    ) : null}
                    <Ionicons name="chevron-forward" size={14} color="#d97706" />
                  </View>
                </TouchableOpacity>
              );
            })}
            </View>
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
    height: 60,
    backgroundColor: '#040a1b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.25)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 196, 61, 0.12)',
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
    letterSpacing: 0.5,
  },
  mainScrollView: {
    flex: 1,
    backgroundColor: '#f6f2e9',
  },
  scrollContent: {
    padding: 24,
    maxWidth: 1200,
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
  crestContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fef3c7',
    borderWidth: 2,
    borderColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 18,
    marginBottom: 10,
    overflow: 'hidden',
  },
  crestImg: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
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
  statusBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  statusBadgeText: {
    color: '#16a34a',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
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
  teamNameTitle: {
    color: '#0e184e',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  coachRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coachLabel: {
    color: '#64748b',
    fontSize: 13,
  },
  coachValue: {
    color: '#0e184e',
    fontWeight: '700',
  },
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statNumber: {
    color: '#0e184e',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 2,
  },
  statSubText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  statDivider: {
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
    paddingHorizontal: 16,
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
    marginBottom: 8,
  },
  tournamentTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tournamentTagText: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '700',
  },
  matchStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusLive: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  statusCompleted: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  statusScheduled: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: '#0284c7',
  },
  matchStatusText: {
    color: '#0f172a',
    fontSize: 10,
    fontWeight: '800',
  },
  matchVenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  matchVenueText: {
    color: '#64748b',
    fontSize: 12,
  },
  scoreComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 12,
  },
  scoreTeamCol: {
    flex: 1,
  },
  scoreTeamName: {
    color: '#0e184e',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  scoreValueText: {
    color: '#0e184e',
    fontSize: 16,
    fontWeight: '900',
  },
  scoreVsText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '800',
    marginHorizontal: 12,
  },
  matchFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  resultContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  resultText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  viewScorecardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5c43d',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  viewScorecardBtnText: {
    color: '#081225',
    fontSize: 12,
    fontWeight: '800',
  },
  squadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48.5%',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  playerCardMobile: {
    width: '100%',
  },
  playerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#f59e0b',
    overflow: 'hidden',
  },
  playerAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 21,
  },
  playerAvatarText: {
    color: '#b45309',
    fontSize: 16,
    fontWeight: '800',
  },
  playerInfo: {
    flex: 1,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerNameText: {
    color: '#0e184e',
    fontSize: 14,
    fontWeight: '800',
  },
  captainBadge: {
    backgroundColor: '#f59e0b',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  captainBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  keeperBadge: {
    backgroundColor: '#0284c7',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  keeperBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  playerRoleText: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  playerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  playerMetaText: {
    color: '#64748b',
    fontSize: 11,
  },
  playerMetaDot: {
    color: '#94a3b8',
    fontSize: 11,
    marginHorizontal: 4,
  },
  jerseyBox: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#fef3c7',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  jerseyNumberText: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '800',
  },
});
