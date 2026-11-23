import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, useWindowDimensions, Platform, ActivityIndicator } from 'react-native';
import { useScorerNavigation } from '../../navigation/ScorerNavigationContext';
import MatchCard from '../../components/scorer/MatchCard';
import SharedFooter from '../../components/scorer/SharedFooter';
import { ScorerApi, getCurrentUser, logoutAndClearAllSessions } from '../../services/api';
import { showInfo, showConfirm } from '../../utils/sweetalert';

export default function ScorerDashboardScreen() {
  const { navigate, onExit, params } = useScorerNavigation();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const styles = getStyles(isDesktop);

  const [matches, setMatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [profile, setProfile] = useState<any>(params?.user || getCurrentUser() || { name: 'Official Scorer', id: 'SCORER', association: 'Virudhunagar District' });
  const [selectedFilter, setSelectedFilter] = useState<string | null>(() => {
    if (typeof window !== 'undefined' && window.location) {
      try {
        const url = new URL(window.location.href);
        const f = url.searchParams.get('tab') || url.searchParams.get('filter');
        if (f) {
          const lower = f.toLowerCase();
          if (lower === 'upcoming') return 'Upcoming';
          if (lower === 'assigned') return 'Assigned';
          if (lower === 'completed') return 'Completed';
          if (lower === 'live') return 'Live';
        }
      } catch (_e) {}
    }
    return null;
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    let loadedMatches: any[] = [];

    // 1. Try authenticated Scorer Dashboard API
    try {
      const res = await ScorerApi.getDashboard();
      if (res && res.data && Array.isArray(res.data.matches)) {
        loadedMatches = res.data.matches;
      }
    } catch (_e) {
      // Auth or network error
    }

    // 2. If no matches returned or unauthenticated, fetch public matches from MongoDB
    if (loadedMatches.length === 0) {
      try {
        const pubRes = await ScorerApi.getPublicMatches();
        const pubData = pubRes?.data || pubRes?.matches || (Array.isArray(pubRes) ? pubRes : []);
        if (Array.isArray(pubData) && pubData.length > 0) {
          loadedMatches = pubData;
        }
      } catch (_err) {
        // Fallback keeps empty array
      }
    }

    // Filter: Scorer sees ONLY matches assigned to them (by scorer_id / assigned_scorer)
    // If no assignment data exists on any match (old/legacy data), show all as fallback
    const currentUser = getCurrentUser();
    const myId = (params?.user?.id || currentUser?.id || currentUser?.scorerId || '').toString().toLowerCase();
    const myEmail = (params?.user?.email || currentUser?.email || '').toString().toLowerCase();

    let assignedMatches = loadedMatches;
    if (loadedMatches.length > 0) {
      const hasAssignmentData = loadedMatches.some((m: any) => m.assigned_scorer_id || m.scorer_id || m.scorerId || m.assigned_scorer || m.assignedScorerId);
      if (hasAssignmentData && myId) {
        const filtered = loadedMatches.filter((m: any) => {
          const mScorerId = (m.assigned_scorer_id || m.scorer_id || m.scorerId || m.assignedScorerId || '').toString().toLowerCase();
          const mScorerEmail = (m.scorer_email || m.scorerEmail || m.assigned_scorer_email || '').toString().toLowerCase();
          const mScorerName = (m.assigned_scorer || m.scorerName || '').toString().toLowerCase();
          const myName = (params?.user?.name || currentUser?.name || '').toString().toLowerCase();
          return (
            (myId && (mScorerId === myId || mScorerId.includes(myId))) ||
            (myEmail && mScorerEmail === myEmail) ||
            (myName && mScorerName.includes(myName.split(' ')[0]))
          );
        });
        if (filtered.length > 0) {
          assignedMatches = filtered;
        }
      }
    }

    // Ensure only matches confirmed by Admin in match schedules are visible to scorers
    const allUpcoming = loadedMatches.filter((m: any) => {
      const s = (m.status || '').toUpperCase();
      const conf = m.schedule_confirmation_status || m.scheduleConfirmationStatus;
      return (s === 'UPCOMING' || s === 'SCHEDULED') && conf === 'CONFIRMED';
    });
    for (const upMatch of allUpcoming) {
      if (!assignedMatches.some((m: any) => m.id === upMatch.id)) {
        assignedMatches.push(upMatch);
      }
    }

    // Filter out any scheduled matches that are not yet confirmed by Admin
    assignedMatches = assignedMatches.filter((m: any) => {
      const s = (m.status || '').toUpperCase();
      if (s === 'SCHEDULED' || s === 'UPCOMING') {
        const conf = m.schedule_confirmation_status || m.scheduleConfirmationStatus;
        return conf === 'CONFIRMED';
      }
      return true;
    });

    setMatches(assignedMatches);
    setIsLoading(false);

    // Load profile
    try {
      const user = getCurrentUser();
      if (user) {
        setProfile(user);
      } else {
        const profRes = await ScorerApi.getProfile();
        if (profRes && profRes.data) {
          setProfile(profRes.data);
        }
      }
    } catch (_e) {}
  };

  const handleLogout = async () => {
    const confirmed = await showConfirm(
      'Log Out Official Scorer',
      'Are you sure you want to log out and return to the main CFVD website?',
      'Yes, Log Out',
      'Cancel'
    );
    if (confirmed) {
      await logoutAndClearAllSessions();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = '/';
        return;
      }
      onExit('Home');
    }
  };

  // Helper to parse date & time into a numeric timestamp for accurate sorting
  const parseMatchTimestamp = (m: any): number => {
    try {
      const datePart = (m.match_date || m.date || '').toString().trim().split(' ')[0]; // e.g. "2026-10-30"
      const timePart = (m.match_time || m.time || '09:30 AM').toString().trim();
      if (!datePart) return 0;

      let year = 2026, month = 10, day = 1;
      if (datePart.includes('-')) {
        const parts = datePart.split('-');
        year = parseInt(parts[0], 10) || 2026;
        month = parseInt(parts[1], 10) || 10;
        day = parseInt(parts[2], 10) || 1;
      } else if (datePart.includes('/')) {
        const parts = datePart.split('/');
        day = parseInt(parts[0], 10) || 1;
        month = parseInt(parts[1], 10) || 10;
        year = parseInt(parts[2], 10) || 2026;
      }

      let hours = 9, minutes = 30;
      const cleanTime = timePart.replace('.', ':');
      const timeMatch = cleanTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2], 10);
        const mod = (timeMatch[3] || '').toUpperCase();
        if (mod === 'PM' && hours < 12) hours += 12;
        if (mod === 'AM' && hours === 12) hours = 0;
      }

      return new Date(year, month - 1, day, hours, minutes).getTime();
    } catch {
      return 0;
    }
  };

  // Categorized matches sorted by Date & Time:
  // 1. Live matches: currently active, sorted by most recent
  const liveMatches = matches
    .filter(m => {
      const s = (m.status || '').toLowerCase();
      return s === 'live' || s === 'innings_break';
    })
    .sort((a, b) => parseMatchTimestamp(b) - parseMatchTimestamp(a));

  // 2. Upcoming matches: sorted ascending by date and time (nearest upcoming match first!)
  const upcomingMatches = matches
    .filter(m => {
      const s = (m.status || '').toLowerCase();
      return s === 'upcoming' || s === 'scheduled';
    })
    .sort((a, b) => parseMatchTimestamp(a) - parseMatchTimestamp(b));

  // 3. Completed matches: sorted descending by date and time (most recently finished match first!)
  const completedMatches = matches
    .filter(m => (m.status || '').toLowerCase() === 'completed')
    .sort((a, b) => parseMatchTimestamp(b) - parseMatchTimestamp(a));

  // 4. Postponed matches:
  const postponedMatches = matches
    .filter(m => {
      const s = (m.status || '').toLowerCase();
      return s === 'postponed' || !!m.postponement?.is_postponed || !!m.isPostponed;
    })
    .sort((a, b) => parseMatchTimestamp(b) - parseMatchTimestamp(a));

  const totalAssigned = matches.length;

  // Determine effective filter:
  // If user selected a filter, respect it.
  // Otherwise, default automatically:
  // 1. Live matches first (if any)
  // 2. Upcoming matches (if any)
  // 3. Otherwise, if no upcoming matches ("upcoming match illa na"), show Recent Matches ("recent match kaatuna poothum")!
  const effectiveFilter = selectedFilter || (
    liveMatches.length > 0 ? 'Live' : (upcomingMatches.length > 0 ? 'Upcoming' : 'Completed')
  );

  return (
    <View style={styles.container}>
      {/* PROFESSIONAL HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image source={require('../../../assets/logo_transparent.png')} style={styles.logo} resizeMode="contain" />
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <Text style={styles.title} numberOfLines={1}>Scorer Dashboard</Text>
            <Text style={styles.subtitle} numberOfLines={1}>Official Match Scoring Console</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.scorerInfo}>
            <Text style={styles.scorerName} numberOfLines={1}>{profile?.name || 'Official Scorer'}</Text>
            <Text style={styles.scorerId}>{profile?.id || 'SCORER'}</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.contentWrapper}>

        {/* QUICK LIVE / UPCOMING MATCH ACTION BANNER */}
        {liveMatches.length > 0 ? (
          <TouchableOpacity 
            style={styles.liveBanner}
            onPress={() => navigate('LiveScoring', { matchId: liveMatches[0].id })}
            activeOpacity={0.85}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <View style={styles.livePulseDot} />
                <Text style={styles.liveBannerOverline}>MATCH CURRENTLY IN PROGRESS</Text>
              </View>
              <Text style={styles.liveBannerTitle} numberOfLines={1}>
                {liveMatches[0].teamA?.name || liveMatches[0].teamA || 'Team A'} vs {liveMatches[0].teamB?.name || liveMatches[0].teamB || 'Team B'}
              </Text>
              <Text style={styles.liveBannerSub}>
                📍 {liveMatches[0].venue || 'District Stadium'} • Tap to resume live scoring console
              </Text>
            </View>
            <View style={styles.liveBannerBtn}>
              <Text style={styles.liveBannerBtnText}>CONTINUE SCORING ▶</Text>
            </View>
          </TouchableOpacity>
        ) : upcomingMatches.length > 0 ? (
          <TouchableOpacity 
            style={styles.upcomingBanner}
            onPress={() => navigate('MatchSetup', { matchId: upcomingMatches[0].id })}
            activeOpacity={0.85}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.upcomingBannerOverline}>⚡ NEXT SCHEDULED FIXTURE</Text>
              <Text style={styles.upcomingBannerTitle} numberOfLines={1}>
                {upcomingMatches[0].teamA?.name || upcomingMatches[0].teamA || 'Team A'} vs {upcomingMatches[0].teamB?.name || upcomingMatches[0].teamB || 'Team B'}
              </Text>
              <Text style={styles.upcomingBannerSub}>
                📅 {upcomingMatches[0].match_date || upcomingMatches[0].date} • ⏰ {upcomingMatches[0].match_time || upcomingMatches[0].time || '09:30 AM'}
              </Text>
            </View>
            <View style={styles.upcomingBannerBtn}>
              <Text style={styles.upcomingBannerBtnText}>START MATCH SETUP ▶</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* TABS ROW FOR MATCH FILTERING */}
        <View style={styles.tabsRow}>
          {liveMatches.length > 0 && (
            <TouchableOpacity 
              style={[styles.tabButton, effectiveFilter === 'Live' && styles.tabButtonLiveActive]}
              onPress={() => setSelectedFilter('Live')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabButtonText, effectiveFilter === 'Live' && styles.tabButtonTextActive]}>
                🔴 LIVE ({liveMatches.length})
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[styles.tabButton, effectiveFilter === 'Upcoming' && styles.tabButtonActive]}
            onPress={() => setSelectedFilter('Upcoming')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabButtonText, effectiveFilter === 'Upcoming' && styles.tabButtonTextActive]}>
              📅 UPCOMING ({upcomingMatches.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabButton, effectiveFilter === 'Completed' && styles.tabButtonActive]}
            onPress={() => setSelectedFilter('Completed')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabButtonText, effectiveFilter === 'Completed' && styles.tabButtonTextActive]}>
              📊 RECENT MATCHES ({completedMatches.length})
            </Text>
          </TouchableOpacity>

          {postponedMatches.length > 0 && (
            <TouchableOpacity 
              style={[styles.tabButton, effectiveFilter === 'Postponed' && styles.tabButtonActive]}
              onPress={() => setSelectedFilter('Postponed')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabButtonText, effectiveFilter === 'Postponed' && styles.tabButtonTextActive]}>
                ⏸️ POSTPONED ({postponedMatches.length})
              </Text>
            </TouchableOpacity>
          )}

          {totalAssigned > 0 && (
            <TouchableOpacity 
              style={[styles.tabButton, effectiveFilter === 'Assigned' && styles.tabButtonActive]}
              onPress={() => setSelectedFilter(selectedFilter === 'Assigned' ? null : 'Assigned')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabButtonText, effectiveFilter === 'Assigned' && styles.tabButtonTextActive]}>
                📋 ALL ({totalAssigned})
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {isLoading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#b45309" />
            <Text style={{ marginTop: 12, color: '#64748b', fontSize: 14, fontWeight: '600' }}>
              Loading Assigned Matches from Association Server...
            </Text>
          </View>
        ) : effectiveFilter === 'Assigned' ? (
          /* ALL ASSIGNED MATCHES */
          <View style={{ width: '100%' }}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderTitle}>📋 ALL ASSIGNED MATCHES ({totalAssigned})</Text>
            </View>

            {liveMatches.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.subSectionHeader}>🔴 LIVE MATCHES ({liveMatches.length})</Text>
                {liveMatches.map(match => (
                  <MatchCard key={match.id} match={match} variant="live" />
                ))}
              </View>
            )}

            {upcomingMatches.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.subSectionHeader}>🔵 UPCOMING MATCHES ({upcomingMatches.length})</Text>
                {upcomingMatches.map(match => (
                  <MatchCard key={match.id} match={match} variant="upcoming" />
                ))}
              </View>
            )}

            {completedMatches.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.subSectionHeader}>🟢 COMPLETED MATCHES ({completedMatches.length})</Text>
                {completedMatches.map(match => (
                  <MatchCard key={match.id} match={match} variant="completed" />
                ))}
              </View>
            )}

            {totalAssigned === 0 && (
              <Text style={styles.emptyText}>No matches assigned yet.</Text>
            )}
          </View>
        ) : effectiveFilter === 'Live' ? (
          /* LIVE MATCHES */
          <View style={{ width: '100%' }}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderTitle}>🔴 LIVE MATCHES IN PROGRESS ({liveMatches.length})</Text>
            </View>

            {liveMatches.length > 0 ? (
              liveMatches.map(match => (
                <MatchCard key={match.id} match={match} variant="live" />
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyCardText}>No live matches currently in progress.</Text>
              </View>
            )}
          </View>
        ) : effectiveFilter === 'Upcoming' ? (
          /* UPCOMING MATCHES ONLY - IF NONE, SHOW EMPTY NOTICE ONLY */
          <View style={{ width: '100%' }}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderTitle}>UPCOMING MATCHES ({upcomingMatches.length})</Text>
            </View>

            {upcomingMatches.length > 0 ? (
              upcomingMatches.map(match => (
                <MatchCard key={match.id} match={match} variant="upcoming" />
              ))
            ) : (
              <View style={styles.emptyNoticeCard}>
                <Text style={styles.emptyNoticeIcon}>📅</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.emptyNoticeTitle}>No Upcoming Matches Scheduled</Text>
                  <Text style={styles.emptyNoticeSub}>
                    There are currently no upcoming fixtures assigned.
                  </Text>
                </View>
              </View>
            )}
          </View>
        ) : effectiveFilter === 'Completed' ? (
          /* RECENT MATCHES & SCORECARDS */
          <View style={{ width: '100%' }}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderTitle}>RECENT MATCHES ({completedMatches.length})</Text>
            </View>

            {completedMatches.length > 0 ? (
              completedMatches.map(match => (
                <MatchCard key={match.id} match={match} variant="completed" />
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyCardText}>No recently completed matches found.</Text>
              </View>
            )}
          </View>
        ) : effectiveFilter === 'Postponed' ? (
          /* POSTPONED MATCHES */
          <View style={{ width: '100%' }}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderTitle}>⏸️ POSTPONED MATCHES ({postponedMatches.length})</Text>
            </View>

            {postponedMatches.length > 0 ? (
              postponedMatches.map(match => (
                <View key={match.id} style={styles.postponedCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <Text style={{ fontWeight: '700', fontSize: 16, color: '#1e293b' }}>
                      {match.teamA?.name || match.team_a_name || 'Team A'} <Text style={{ color: '#d97706' }}>vs</Text> {match.teamB?.name || match.team_b_name || 'Team B'}
                    </Text>
                    <View style={{ backgroundColor: '#fef3c7', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 4, borderColor: '#f59e0b', borderWidth: 1 }}>
                      <Text style={{ color: '#b45309', fontWeight: '700', fontSize: 11 }}>⏸️ POSTPONED</Text>
                    </View>
                  </View>

                  <Text style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
                    🏆 {match.tournamentName || 'Tournament'} • 📍 {match.venue || 'District Stadium'}
                  </Text>

                  <View style={{ backgroundColor: '#fffbeb', padding: 12, borderRadius: 6, marginTop: 10, borderColor: '#fde68a', borderWidth: 1 }}>
                    <Text style={{ color: '#92400e', fontWeight: '700', fontSize: 13 }}>
                      Reason: {match.postponement?.reason || match.postponementReason || 'Reason not recorded'}
                    </Text>
                    <Text style={{ color: '#78350f', fontSize: 12, marginTop: 3 }}>
                      Original Schedule: 📅 {match.postponement?.original_date || match.originalDate || match.date} • ⏰ {match.postponement?.original_time || match.originalTime || match.time || '09:30 AM'}
                    </Text>
                    {(match.postponement?.rescheduled_date || match.rescheduledDate) ? (
                      <Text style={{ color: '#15803d', fontWeight: '700', fontSize: 13, marginTop: 4 }}>
                        📅 Rescheduled Date: {match.postponement?.rescheduled_date || match.rescheduledDate} • ⏰ {match.postponement?.rescheduled_time || match.rescheduledTime || '09:30 AM'}
                      </Text>
                    ) : (
                      <Text style={{ color: '#b45309', fontStyle: 'italic', fontSize: 12, marginTop: 4 }}>
                        ⏳ Awaiting Admin Rescheduling
                      </Text>
                    )}

                    {/* Match Score & Over Situation at Postponement */}
                    <View style={{ marginTop: 8, padding: 10, backgroundColor: '#fef3c7', borderRadius: 6, borderLeftWidth: 4, borderLeftColor: '#d97706' }}>
                      <Text style={{ color: '#92400e', fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        📊 Match Situation at Postponement:
                      </Text>
                      <Text style={{ color: '#78350f', fontSize: 13, fontWeight: '700', marginTop: 3 }}>
                        {match.postponement?.postponed_score_display || match.postponedScoreDisplay || (
                          match.scoreA ? `${match.teamA?.name || match.teamA}: ${match.scoreA}${match.scoreB && match.scoreB !== 'Yet to bat' ? ` • ${match.teamB?.name || match.teamB}: ${match.scoreB}` : ''}` : 'Postponed before match start (0 overs bowled / Toss pending)'
                        )}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                    <TouchableOpacity
                      style={{
                        backgroundColor: '#d97706',
                        paddingVertical: 7,
                        paddingHorizontal: 14,
                        borderRadius: 6,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6
                      }}
                      onPress={() => navigate('LiveScoring', { matchId: match.id })}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 12 }}>
                        OPEN LIVE CONSOLE ▶
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyCardText}>No postponed matches.</Text>
              </View>
            )}
          </View>
        ) : null}
        </View>

        <SharedFooter />
      </ScrollView>
    </View>
  );
}

const getStyles = (isDesktop: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', width: '100%', maxWidth: '100%', overflow: 'hidden' },
  
  // HEADER
  header: {
    padding: 12,
    paddingHorizontal: isDesktop ? 24 : 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    rowGap: 8,
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2,
    width: '100%',
    maxWidth: '100%'
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: isDesktop ? 220 : 160 },
  logo: { width: 32, height: 32, marginRight: 8, flexShrink: 0 },
  title: { color: '#1e293b', fontSize: isDesktop ? 16 : 14, fontWeight: 'bold', letterSpacing: 0.5 },
  subtitle: { color: '#b45309', fontSize: isDesktop ? 11 : 10, marginTop: 1, fontWeight: '600' },
  
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: isDesktop ? 12 : 8, flexShrink: 0 },
  scorerInfo: { alignItems: 'flex-end' },
  scorerName: { color: '#1e293b', fontSize: isDesktop ? 13 : 11.5, fontWeight: '700' },
  scorerId: { color: '#64748b', fontSize: isDesktop ? 11 : 9.5 },
  
  logoutBtn: { backgroundColor: '#fef2f2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#fca5a5' },
  logoutText: { color: '#dc2626', fontWeight: 'bold', fontSize: 11 },
  
  // LAYOUT
  scroll: { flexGrow: 1, width: '100%', maxWidth: '100%' },
  contentWrapper: { 
    padding: isDesktop ? 24 : 12, 
    paddingBottom: 32,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center'
  },

  // QUICK BANNERS
  liveBanner: {
    flexDirection: isDesktop ? 'row' : 'column',
    alignItems: isDesktop ? 'center' : 'stretch',
    justifyContent: 'space-between',
    backgroundColor: '#fff1f2',
    borderWidth: 1.5,
    borderColor: '#f43f5e',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 10,
    width: '100%',
    maxWidth: '100%',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  livePulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e11d48' },
  liveBannerOverline: { color: '#e11d48', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  liveBannerTitle: { color: '#881337', fontSize: 16, fontWeight: '800', marginVertical: 2 },
  liveBannerSub: { color: '#9f1239', fontSize: 12 },
  liveBannerBtn: { backgroundColor: '#e11d48', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6, alignItems: 'center' },
  liveBannerBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },

  upcomingBanner: {
    flexDirection: isDesktop ? 'row' : 'column',
    alignItems: isDesktop ? 'center' : 'stretch',
    justifyContent: 'space-between',
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 10,
    width: '100%',
    maxWidth: '100%',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  upcomingBannerOverline: { color: '#2563eb', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  upcomingBannerTitle: { color: '#1e3a8a', fontSize: 16, fontWeight: '800', marginVertical: 2 },
  upcomingBannerSub: { color: '#1d4ed8', fontSize: 12 },
  upcomingBannerBtn: { backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6, alignItems: 'center' },
  upcomingBannerBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },

  // TABS ROW
  tabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
    width: '100%'
  },
  tabButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10
  },
  tabButtonActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a'
  },
  tabButtonLiveActive: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626'
  },
  tabButtonText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700'
  },
  tabButtonTextActive: {
    color: '#ffffff'
  },

  // SECTION HEADERS
  sectionHeaderRow: {
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 232, 240, 0.8)',
    paddingBottom: 8
  },
  sectionHeaderTitle: {
    color: '#1e293b',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5
  },
  subSectionHeader: {
    color: '#475569',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 6
  },
  section: {
    marginBottom: 20
  },

  // NOTICE CARDS
  emptyNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16
  },
  emptyNoticeIcon: { fontSize: 24 },
  emptyNoticeTitle: { color: '#334155', fontSize: 13, fontWeight: '700' },
  emptyNoticeSub: { color: '#64748b', fontSize: 11, marginTop: 2 },

  // EMPTY & POSTPONED
  emptyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  emptyCardText: { color: '#64748b', fontSize: 13, fontStyle: 'italic' },
  emptyText: { color: '#64748b', fontSize: 13, fontStyle: 'italic', paddingVertical: 12 },

  postponedCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderColor: '#fcd34d',
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3
  }
});
