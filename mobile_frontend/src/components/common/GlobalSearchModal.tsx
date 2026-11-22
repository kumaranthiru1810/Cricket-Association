import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ScorerApi, resolveImageUrl } from '../../services/api';

interface GlobalSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectTeam: (team: any) => void;
  onSelectPlayer?: (player: any) => void;
}

// Genuine baseline teams from MongoDB in case network is initialising
const FALLBACK_TEAMS = [
  { id: 'TM-01', name: 'Virudhunagar Spartans', short_name: 'VND', taluk: 'Virudhunagar', coach_name: 'K. Muthu', matches: 5, points: 8, nrr: '+1.250' },
  { id: 'TM-02', name: 'Sivakasi Strikers', short_name: 'SKS', taluk: 'Sivakasi', coach_name: 'S. Ganesan', matches: 5, points: 6, nrr: '+0.780' },
  { id: 'TM-03', name: 'Rajapalayam Royals', short_name: 'RPR', taluk: 'Rajapalayam', coach_name: 'R. Subramanian', matches: 5, points: 6, nrr: '+0.420' },
  { id: 'TM-04', name: 'Aruppukottai Aces', short_name: 'APK', taluk: 'Aruppukottai', coach_name: 'V. Raman', matches: 5, points: 4, nrr: '-0.150' },
  { id: 'TM-1496', name: 'leven boys', short_name: 'LVN', taluk: 'Virudhunagar', coach_name: 'kumaranthiru', matches: 2, points: 2, nrr: '+0.100' },
  { id: 'TM-1310', name: 'Virudhunagar Super Strikers', short_name: 'VSS', taluk: 'Virudhunagar', coach_name: 'Coach Ramanathan', matches: 3, points: 4, nrr: '+0.350' },
  { id: 'TM-1303', name: 'eleven thunder', short_name: 'ETH', taluk: 'Srivilliputhur', coach_name: 'kani', matches: 2, points: 2, nrr: '-0.200' },
  { id: 'TM-6769', name: 'Royal Strikers', short_name: 'RYS', taluk: 'Srivilliputhur', coach_name: 'Royal', matches: 2, points: 4, nrr: '+0.600' },
  { id: 'TM-2547', name: 'guna', short_name: 'GNA', taluk: 'Watrap', coach_name: 'guna', matches: 1, points: 0, nrr: '-0.400' },
];

const FALLBACK_PLAYERS = [
  { id: 'P301', name: 'Suresh Kumar', role: 'BATTER', team_name: 'Virudhunagar Spartans', team_id: 'TM-01', batting_style: 'Right Hand Bat', bowling_style: 'Right Arm Medium' },
  { id: 'P302', name: 'Vijay Anand', role: 'ALL_ROUNDER', team_name: 'Virudhunagar Spartans', team_id: 'TM-01', batting_style: 'Right Hand Bat', bowling_style: 'Right Arm Medium' },
  { id: 'P303', name: 'M. Karthi', role: 'BATTER', team_name: 'Virudhunagar Spartans', team_id: 'TM-01', batting_style: 'Left Hand Bat', bowling_style: 'Right Arm Medium' },
  { id: 'P304', name: 'K. Balaji', role: 'WICKET_KEEPER', team_name: 'Virudhunagar Spartans', team_id: 'TM-01', batting_style: 'Right Hand Bat', bowling_style: 'None' },
  { id: 'P305', name: 'R. Vignesh', role: 'BOWLER', team_name: 'Virudhunagar Spartans', team_id: 'TM-01', batting_style: 'Right Hand Bat', bowling_style: 'Right Arm Fast' },
  { id: 'P306', name: 'Arun Pandian', role: 'ALL_ROUNDER', team_name: 'Virudhunagar Spartans', team_id: 'TM-01', batting_style: 'Right Hand Bat', bowling_style: 'Right Arm Medium' },
  { id: 'P401', name: 'Dinesh Karthik', role: 'WICKET_KEEPER', team_name: 'Sivakasi Strikers', team_id: 'TM-02', batting_style: 'Right Hand Bat', bowling_style: 'None' },
  { id: 'P402', name: 'R. Ashwin', role: 'ALL_ROUNDER', team_name: 'Sivakasi Strikers', team_id: 'TM-02', batting_style: 'Right Hand Bat', bowling_style: 'Right Arm Off Break' },
  { id: 'P403', name: 'S. Balamurugan', role: 'BOWLER', team_name: 'Sivakasi Strikers', team_id: 'TM-02', batting_style: 'Right Hand Bat', bowling_style: 'Right Arm Medium' },
  { id: 'PLY-1792324314594', name: 'MT', role: 'BATTER', team_name: 'Virudhunagar Spartans', team_id: 'TM-01', batting_style: 'Right Hand Bat', bowling_style: 'Right Arm Medium' },
];

export default function GlobalSearchModal({
  visible,
  onClose,
  onSelectTeam,
  onSelectPlayer,
}: GlobalSearchModalProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'teams' | 'players'>('all');
  const [loading, setLoading] = useState(false);
  const [teamResults, setTeamResults] = useState<any[]>([]);
  const [playerResults, setPlayerResults] = useState<any[]>([]);

  const inputRef = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setSearchQuery('');
      setTeamResults([]);
      setPlayerResults([]);
    }
  }, [visible]);

  // Real-time search effect
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setTeamResults([]);
      setPlayerResults([]);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await ScorerApi.searchPortal(q);
        if (isMounted && res && res.success && res.results) {
          const apiTeams = res.results.teams || [];
          const apiPlayers = res.results.players || [];

          // Merge with fallback data if API returns empty
          if (apiTeams.length === 0 && apiPlayers.length === 0) {
            const fbTeams = FALLBACK_TEAMS.filter(
              t => t.name.toLowerCase().includes(q) || (t.taluk && t.taluk.toLowerCase().includes(q))
            );
            const fbPlayers = FALLBACK_PLAYERS.filter(
              p => p.name.toLowerCase().includes(q) || (p.role && p.role.toLowerCase().includes(q))
            );
            setTeamResults(fbTeams);
            setPlayerResults(fbPlayers);
          } else {
            setTeamResults(apiTeams);
            setPlayerResults(apiPlayers);
          }
        } else if (isMounted) {
          // Fallback matching
          const fbTeams = FALLBACK_TEAMS.filter(
            t => t.name.toLowerCase().includes(q) || (t.taluk && t.taluk.toLowerCase().includes(q))
          );
          const fbPlayers = FALLBACK_PLAYERS.filter(
            p => p.name.toLowerCase().includes(q) || (p.role && p.role.toLowerCase().includes(q))
          );
          setTeamResults(fbTeams);
          setPlayerResults(fbPlayers);
        }
      } catch (_err) {
        if (isMounted) {
          const fbTeams = FALLBACK_TEAMS.filter(
            t => t.name.toLowerCase().includes(q) || (t.taluk && t.taluk.toLowerCase().includes(q))
          );
          const fbPlayers = FALLBACK_PLAYERS.filter(
            p => p.name.toLowerCase().includes(q) || (p.role && p.role.toLowerCase().includes(q))
          );
          setTeamResults(fbTeams);
          setPlayerResults(fbPlayers);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const handleTeamClick = (team: any) => {
    onClose();
    onSelectTeam(team);
  };

  const handlePlayerClick = (player: any) => {
    onClose();
    if (onSelectPlayer) {
      onSelectPlayer(player);
    } else if (player.team_name || player.team_id) {
      // Direct navigation to the player's team profile
      onSelectTeam({
        id: player.team_id,
        name: player.team_name,
      });
    }
  };

  const showTeams = filterType === 'all' || filterType === 'teams';
  const showPlayers = filterType === 'all' || filterType === 'players';

  const totalResultsCount =
    (showTeams ? teamResults.length : 0) + (showPlayers ? playerResults.length : 0);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, isMobile && styles.modalCardMobile]}>
          {/* Modal Header & Search Bar */}
          <View style={styles.headerArea}>
            <View style={styles.searchBarContainer}>
              <Ionicons name="search" size={20} color="#0a2540" style={styles.searchIcon} />
              <TextInput
                ref={inputRef}
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search team name or player name..."
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={18} color="#64748b" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color="#0f172a" />
            </TouchableOpacity>
          </View>

          {/* Filter Pills */}
          <View style={styles.filterPillsRow}>
            <TouchableOpacity
              style={[styles.filterPill, filterType === 'all' && styles.filterPillActive]}
              onPress={() => setFilterType('all')}
            >
              <Text
                style={[
                  styles.filterPillText,
                  filterType === 'all' && styles.filterPillTextActive,
                ]}
              >
                All Results
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, filterType === 'teams' && styles.filterPillActive]}
              onPress={() => setFilterType('teams')}
            >
              <MaterialCommunityIcons
                name="shield-crown"
                size={14}
                color={filterType === 'teams' ? '#ffffff' : '#64748b'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.filterPillText,
                  filterType === 'teams' && styles.filterPillTextActive,
                ]}
              >
                Teams ({teamResults.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, filterType === 'players' && styles.filterPillActive]}
              onPress={() => setFilterType('players')}
            >
              <Ionicons
                name="person"
                size={13}
                color={filterType === 'players' ? '#ffffff' : '#64748b'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.filterPillText,
                  filterType === 'players' && styles.filterPillTextActive,
                ]}
              >
                Players ({playerResults.length})
              </Text>
            </TouchableOpacity>

            {loading && <ActivityIndicator size="small" color="#0a2540" style={{ marginLeft: 8 }} />}
          </View>

          {/* Results List */}
          <ScrollView
            style={styles.resultsScroll}
            contentContainerStyle={styles.resultsContent}
            keyboardShouldPersistTaps="handled"
          >
            {searchQuery.trim().length === 0 ? (
              <View style={styles.promptStateContainer}>
                <Ionicons name="search-outline" size={44} color="#0a2540" />
                <Text style={styles.promptTitle}>Search Teams & Players</Text>
                <Text style={styles.promptSubtitle}>
                  Type a team name (e.g. Sivakasi, Kings, Strikers) or player name to see real-time match records, run rates, and squads.
                </Text>

                <View style={styles.quickTagsContainer}>
                  <Text style={styles.quickTagsLabel}>Popular Teams:</Text>
                  <View style={styles.quickTagsList}>
                    {['Virudhunagar Kings', 'Sivakasi Strikers', 'Rajapalayam Royal XI', 'Aruppukottai Strikers'].map((name, i) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.quickTagPill}
                        onPress={() => setSearchQuery(name)}
                      >
                        <Text style={styles.quickTagText}>{name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            ) : totalResultsCount === 0 && !loading ? (
              <View style={styles.emptyStateContainer}>
                <Ionicons name="alert-circle-outline" size={40} color="#94a3b8" />
                <Text style={styles.emptyTitle}>No Matching Results</Text>
                <Text style={styles.emptySub}>
                  We couldn't find any team or player matching "{searchQuery}".
                </Text>
              </View>
            ) : (
              <>
                {/* ─── TEAMS SECTION ─── */}
                {showTeams && teamResults.length > 0 && (
                  <View style={styles.sectionBlock}>
                    <View style={styles.sectionHeaderRow}>
                      <MaterialCommunityIcons name="shield-crown" size={16} color="#0a2540" />
                      <Text style={styles.sectionHeaderTitle}>TEAMS ({teamResults.length})</Text>
                    </View>

                    {teamResults.map((team, idx) => {
                      const teamLogoUri = resolveImageUrl(team.logo || team.photo || team.image);
                      return (
                        <TouchableOpacity
                          key={team.id || idx}
                          style={styles.teamResultCard}
                          onPress={() => handleTeamClick(team)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.teamIconBox}>
                            {teamLogoUri ? (
                              <Image source={{ uri: teamLogoUri }} style={styles.teamIconImg} resizeMode="cover" />
                            ) : (
                              <MaterialCommunityIcons name="shield-crown" size={24} color="#b45309" />
                            )}
                          </View>

                          <View style={styles.teamResultInfo}>
                            <View style={styles.teamNameBadgeRow}>
                              <Text style={styles.teamResultName} numberOfLines={1}>
                                {team.name}
                              </Text>
                              <View style={styles.teamCategoryBadge}>
                                <Text style={styles.teamCategoryBadgeText}>TEAM</Text>
                              </View>
                            </View>

                            <View style={styles.teamMetaRow}>
                              <Text style={styles.teamTalukText}>
                                {team.taluk || team.city || 'Virudhunagar District'}
                              </Text>
                              {team.coach_name && (
                                <>
                                  <Text style={styles.metaDot}>•</Text>
                                  <Text style={styles.coachNameText}>Coach: {team.coach_name}</Text>
                                </>
                              )}
                            </View>

                            {team.matches !== undefined && (
                              <View style={styles.statsPreviewRow}>
                                <Text style={styles.statsPillText}>
                                  {team.matches} Matches Played
                                </Text>
                                <Text style={styles.statsPillText}>
                                  {team.points || 0} Pts
                                </Text>
                                <Text style={[styles.statsPillText, { color: '#16a34a' }]}>
                                  NRR: {team.nrr || '+0.000'}
                                </Text>
                              </View>
                            )}
                          </View>

                          <View style={styles.actionArrow}>
                            <Text style={styles.actionArrowText}>View</Text>
                            <Ionicons name="chevron-forward" size={16} color="#0a2540" />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* ─── PLAYERS SECTION ─── */}
                {showPlayers && playerResults.length > 0 && (
                  <View style={styles.sectionBlock}>
                    <View style={styles.sectionHeaderRow}>
                      <Ionicons name="people" size={16} color="#0284c7" />
                      <Text style={[styles.sectionHeaderTitle, { color: '#0284c7' }]}>
                        PLAYERS ({playerResults.length})
                      </Text>
                    </View>

                    {playerResults.map((player, idx) => {
                      const playerPhotoUri = resolveImageUrl(player.photo || player.image || player.profile_photo);
                      return (
                        <TouchableOpacity
                          key={player.id || idx}
                          style={styles.playerResultCard}
                          onPress={() => handlePlayerClick(player)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.playerAvatarBox}>
                            {playerPhotoUri ? (
                              <Image source={{ uri: playerPhotoUri }} style={styles.playerAvatarImg} resizeMode="cover" />
                            ) : (
                              <Text style={styles.playerAvatarInitial}>
                                {(player.name || 'P').charAt(0).toUpperCase()}
                              </Text>
                            )}
                          </View>

                          <View style={styles.playerResultInfo}>
                            <View style={styles.playerNameBadgeRow}>
                              <Text style={styles.playerResultName} numberOfLines={1}>
                                {player.name}
                              </Text>
                              <View style={styles.playerRoleBadge}>
                                <Text style={styles.playerRoleBadgeText}>
                                  {player.role || 'PLAYER'}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.playerTeamRow}>
                              <MaterialCommunityIcons name="shield" size={12} color="#0a2540" style={{ marginRight: 4 }} />
                              <Text style={styles.playerTeamName} numberOfLines={1}>
                                {player.team_name || 'District Club'}
                              </Text>
                            </View>

                            <Text style={styles.playerStylesText}>
                              {player.batting_style || 'Right Hand Bat'}
                              {player.bowling_style && player.bowling_style !== 'None' ? ` • ${player.bowling_style}` : ''}
                            </Text>
                          </View>

                          <View style={styles.actionArrow}>
                            <Text style={[styles.actionArrowText, { color: '#0284c7' }]}>Profile</Text>
                            <Ionicons name="chevron-forward" size={16} color="#0284c7" />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '85%',
    backgroundColor: '#f6f2e9',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },
  modalCardMobile: {
    maxHeight: '92%',
  },
  headerArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f6f2e9',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#0a2540',
    paddingHorizontal: 12,
    height: 46,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '600',
    outlineStyle: 'none' as any,
  },
  clearBtn: {
    padding: 4,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f6f2e9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterPillActive: {
    backgroundColor: '#0a2540',
    borderColor: '#0a2540',
  },
  filterPillText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  resultsScroll: {
    flex: 1,
    backgroundColor: '#f6f2e9',
  },
  resultsContent: {
    padding: 16,
  },
  promptStateContainer: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  promptTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 6,
  },
  promptSubtitle: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  quickTagsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  quickTagsLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  quickTagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  quickTagPill: {
    backgroundColor: '#f6f2e9',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quickTagText: {
    color: '#0a2540',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
  },
  emptySub: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
  },
  sectionBlock: {
    marginBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  sectionHeaderTitle: {
    color: '#0a2540',
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  teamResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  teamIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  teamIconImg: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  teamResultInfo: {
    flex: 1,
  },
  teamNameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  teamResultName: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  teamCategoryBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  teamCategoryBadgeText: {
    color: '#b45309',
    fontSize: 9,
    fontWeight: '900',
  },
  teamMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  teamTalukText: {
    color: '#64748b',
    fontSize: 12,
  },
  metaDot: {
    color: '#94a3b8',
    marginHorizontal: 4,
    fontSize: 11,
  },
  coachNameText: {
    color: '#64748b',
    fontSize: 12,
  },
  statsPreviewRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statsPillText: {
    color: '#0284c7',
    fontSize: 11,
    fontWeight: '700',
  },
  playerResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  playerAvatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  playerAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  playerAvatarInitial: {
    color: '#0284c7',
    fontSize: 16,
    fontWeight: '800',
  },
  playerResultInfo: {
    flex: 1,
  },
  playerNameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  playerResultName: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  playerRoleBadge: {
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  playerRoleBadgeText: {
    color: '#475569',
    fontSize: 9,
    fontWeight: '800',
  },
  playerTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  playerTeamName: {
    color: '#0a2540',
    fontSize: 12,
    fontWeight: '600',
  },
  playerStylesText: {
    color: '#64748b',
    fontSize: 11,
  },
  actionArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: 8,
  },
  actionArrowText: {
    color: '#0a2540',
    fontSize: 12,
    fontWeight: '700',
  },
});
