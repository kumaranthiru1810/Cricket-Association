import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, useWindowDimensions, Platform, ActivityIndicator, Modal } from 'react-native';
import { useScorerNavigation } from '../../navigation/ScorerNavigationContext';
import MatchCard from '../../components/scorer/MatchCard';
import CricketLoader from '../../components/common/CricketLoader';
import SharedFooter from '../../components/scorer/SharedFooter';
import { ScorerApi, getCurrentUser, logoutAndClearAllSessions } from '../../services/api';
import { showInfo, showConfirm } from '../../utils/sweetalert';
import { getTodayKolkata, calculateOfficialMatchTimings } from '../../utils/dateTimeValidation';

export default function ScorerDashboardScreen() {
  const { navigate, onExit, params } = useScorerNavigation();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const styles = getStyles(isDesktop);

  const [matches, setMatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [profile, setProfile] = useState<any>(params?.user || getCurrentUser() || { name: 'Official Scorer', id: 'SCORER', association: 'Virudhunagar District' });
  const [timingAckMatch, setTimingAckMatch] = useState<any>(null);
  const [showTimingAckModal, setShowTimingAckModal] = useState<boolean>(false);
  const [rule15Config, setRule15Config] = useState<{ enabled: boolean; minPlayers: number; ruleText: string }>({
    enabled: true,
    minPlayers: 9,
    ruleText: ''
  });
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
      } catch (_e) { }
    }
    return null;
  });

  useEffect(() => {
    loadDashboardData();
    ScorerApi.getRule15Config()
      .then((res: any) => {
        if (res?.success && res.config) {
          setRule15Config({
            enabled: res.config.enabled !== false,
            minPlayers: typeof res.config.minPlayers === 'number' ? res.config.minPlayers : 9,
            ruleText: typeof res.config.ruleText === 'string' ? res.config.ruleText : ''
          });
        }
      })
      .catch(() => { });
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    let loadedMatches: any[] = [];
    let dashboardApiSucceeded = false;

    const currentUser = getCurrentUser();
    const roleUpper = String(params?.user?.role || currentUser?.role || '').toUpperCase();
    const canCallScorerDashboard = roleUpper === 'SCORER' || roleUpper === 'ADMIN' || roleUpper === 'SUPER_ADMIN';

    // 1. Try authenticated Scorer Dashboard API only when authorized as SCORER/ADMIN
    if (canCallScorerDashboard) {
      try {
        const res = await ScorerApi.getDashboard();
        if (res && res.data && Array.isArray(res.data.matches)) {
          loadedMatches = res.data.matches;
          dashboardApiSucceeded = true;
        }
      } catch (_e) {
        // Auth or network error
      }
    }

    // 2. Only fall back to public matches if the authenticated dashboard API failed
    if (!dashboardApiSucceeded) {
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

    // Strictly filter: Scorer sees ONLY matches assigned to them by Admin
    const myId = (params?.user?.id || currentUser?.id || currentUser?.scorerId || '').toString().trim().toLowerCase();
    const myEmail = (params?.user?.email || currentUser?.email || '').toString().trim().toLowerCase();
    const myName = (params?.user?.name || currentUser?.name || '').toString().trim().toLowerCase();

    const isMatchAssignedToMe = (m: any) => {
      const mScorerId = (m.assigned_scorer_id || m.scorer_id || m.scorerId || m.assignedScorerId || '').toString().trim().toLowerCase();
      const mScorerEmail = (m.scorer_email || m.scorerEmail || m.assigned_scorer_email || '').toString().trim().toLowerCase();
      const mScorerName = (m.assigned_scorer_name || m.assigned_scorer || m.scorer_name || m.scorerName || '').toString().trim().toLowerCase();
      if (!myId && !myEmail && !myName) return false;
      return Boolean(
        (myId && mScorerId && mScorerId === myId) ||
        (myEmail && mScorerEmail && mScorerEmail === myEmail) ||
        (myName && mScorerName && mScorerName === myName) ||
        (myName && mScorerId && mScorerId === myName)
      );
    };

    // If authenticated API succeeded, backend already filtered by scorerId/linkedOfficialIds/name;
    // when falling back to public matches (or for extra client safety), filter strictly
    let assignedMatches = dashboardApiSucceeded
      ? loadedMatches
      : loadedMatches.filter(isMatchAssignedToMe);

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

    // Mandatory Match Timings Protocol Check (ONLY on Match Day & ONLY for matches assigned to this scorer)
    try {
      const todayStr = getTodayKolkata();
      const matchToAcknowledge = assignedMatches.find((m: any) => {
        const mDate = (m.match_date || (typeof m.date === 'string' ? m.date.split(' ')[0] : '') || '').split('T')[0].trim();
        const status = (m.status || m.rawStatus || '').toUpperCase();
        return (
          mDate === todayStr &&
          status !== 'COMPLETED' &&
          status !== 'CANCELLED' &&
          status !== 'ABANDONED' &&
          status !== 'POSTPONED'
        );
      });

      if (matchToAcknowledge) {
        const matchId = matchToAcknowledge.id || matchToAcknowledge._id;
        const ackKey = `cfvd_scorer_ack_${matchId}_${todayStr}`;
        const alreadyAcked = (typeof window !== 'undefined' && window.localStorage?.getItem(ackKey) === 'true') || matchToAcknowledge.scorer_acknowledged;
        if (!alreadyAcked) {
          setTimingAckMatch(matchToAcknowledge);
          setShowTimingAckModal(true);
        }
      }
    } catch (_ackErr) { }

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
    } catch (_e) { }
  };

  const handleAcknowledgeTimings = async () => {
    if (!timingAckMatch) return;
    const todayStr = getTodayKolkata();
    const matchId = timingAckMatch.id || timingAckMatch._id;
    const ackKey = `cfvd_scorer_ack_${matchId}_${todayStr}`;

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(ackKey, 'true');
      }
      await ScorerApi.acknowledgeProtocol(matchId, {
        scorer_id: profile?.id || profile?.scorerId || 'SCR-101',
        scorer_name: profile?.name || 'Official Scorer'
      });
    } catch (_err) {
      // Non-blocking fallback
    }

    setMatches(prev => prev.map(m => (m.id === matchId ? { ...m, scorer_acknowledged: true } : m)));
    setShowTimingAckModal(false);
    setTimingAckMatch(null);
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

  const isPostponedMatch = (m: any) => {
    const s = (m.status || '').toLowerCase();
    const r = (m.rawStatus || '').toUpperCase();
    return s === 'postponed' || r === 'POSTPONED' || !!m.postponement?.is_postponed || !!m.isPostponed;
  };

  const todayKolkata = getTodayKolkata();
  const isMatchDatePassed = (m: any) => {
    const rawD = String(m.match_date || m.date || '').trim();
    const isoDate = rawD.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    return Boolean(isoDate && isoDate < todayKolkata);
  };

  const isFinishedMatch = (m: any) => {
    if (isPostponedMatch(m)) return false;
    const s = (m.status || '').toLowerCase();
    const r = (m.rawStatus || '').toUpperCase();
    if (s === 'completed' || r === 'COMPLETED' || s === 'cancelled' || r === 'CANCELLED' || s === 'abandoned' || r === 'ABANDONED') {
      return false;
    }
    if (s === 'finished' || r === 'FINISHED') return true;
    const isActiveOrScheduled =
      s === 'upcoming' || s === 'scheduled' || r === 'SCHEDULED' ||
      s === 'live' || s === 'innings_break' || r === 'LIVE' || r === 'INNINGS_BREAK';
    return isActiveOrScheduled && isMatchDatePassed(m);
  };

  // Categorized matches sorted by Date & Time:
  // 1. Live matches: currently active, sorted by most recent
  const liveMatches = matches
    .filter(m => {
      if (isPostponedMatch(m) || isFinishedMatch(m)) return false;
      const s = (m.status || '').toLowerCase();
      const r = (m.rawStatus || '').toUpperCase();
      return s === 'live' || s === 'innings_break' || r === 'LIVE' || r === 'INNINGS_BREAK';
    })
    .sort((a, b) => parseMatchTimestamp(b) - parseMatchTimestamp(a));

  // 2. Upcoming matches: sorted ascending by date and time (nearest upcoming match first!)
  const upcomingMatches = matches
    .filter(m => {
      if (isPostponedMatch(m) || isFinishedMatch(m)) return false;
      const s = (m.status || '').toLowerCase();
      const r = (m.rawStatus || '').toUpperCase();
      return s === 'upcoming' || s === 'scheduled' || r === 'SCHEDULED';
    })
    .sort((a, b) => parseMatchTimestamp(a) - parseMatchTimestamp(b));

  // 3. Completed / Finished matches: sorted descending by date and time (most recently finished match first!)
  const completedMatches = matches
    .filter(m => {
      if (isPostponedMatch(m)) return false;
      const s = (m.status || '').toLowerCase();
      const r = (m.rawStatus || '').toUpperCase();
      return s === 'completed' || r === 'COMPLETED' || isFinishedMatch(m);
    })
    .sort((a, b) => parseMatchTimestamp(b) - parseMatchTimestamp(a));

  // 4. Postponed matches:
  const postponedMatches = matches
    .filter(isPostponedMatch)
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

  const renderPostponedMatchCard = (match: any) => (
    <View key={match.id} style={styles.postponedCard}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Text style={{ fontWeight: '700', fontSize: 16, color: '#1e293b' }}>
          {match.teamA?.name || match.team_a_name || match.teamA || 'Team A'} <Text style={{ color: '#d97706' }}>vs</Text> {match.teamB?.name || match.team_b_name || match.teamB || 'Team B'}
        </Text>
        <View style={{ backgroundColor: '#fef3c7', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 4, borderColor: '#f59e0b', borderWidth: 1 }}>
          <Text style={{ color: '#b45309', fontWeight: '700', fontSize: 11 }}>⏸️ POSTPONED</Text>
        </View>
      </View>

      <Text style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
        🏆 {match.tournamentName || match.tournament || 'Tournament'} • 📍 {match.venue || 'District Stadium'}
      </Text>

      <View style={{ backgroundColor: '#fffbeb', padding: 12, borderRadius: 6, marginTop: 10, borderColor: '#fde68a', borderWidth: 1 }}>
        <Text style={{ color: '#92400e', fontWeight: '700', fontSize: 13 }}>
          Reason: {match.postponement?.reason || match.postponementReason || 'Reason not recorded'}
        </Text>
        <Text style={{ color: '#78350f', fontSize: 12, marginTop: 3 }}>
          Original Schedule: 📅 {match.postponement?.original_date || match.originalDate || match.date || match.match_date} • ⏰ {match.postponement?.original_time || match.originalTime || match.time || match.match_time || '09:30 AM'}
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
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <View style={styles.livePulseDot} />
                  <Text style={styles.liveBannerOverline}>MATCH CURRENTLY IN PROGRESS</Text>
                </View>
                <Text style={styles.liveBannerTitle} numberOfLines={2}>
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
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.upcomingBannerOverline}>⚡ NEXT SCHEDULED FIXTURE</Text>
                <Text style={styles.upcomingBannerTitle} numberOfLines={2}>
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={styles.tabsRow}
          >
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
          </ScrollView>

          {isLoading ? (
            <CricketLoader fullScreen={false} />
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

              {postponedMatches.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.subSectionHeader}>⏸️ POSTPONED MATCHES ({postponedMatches.length})</Text>
                  {postponedMatches.map(match => renderPostponedMatchCard(match))}
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
                postponedMatches.map(match => renderPostponedMatchCard(match))
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

      {/* MANDATORY SCORER TIMING PROTOCOL ACKNOWLEDGEMENT POPUP */}
      <Modal
        visible={showTimingAckModal && Boolean(timingAckMatch)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => { }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.ackModalContainer}>
            {/* Modal Federation Header */}
            <View style={styles.ackModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.ackModalIconBadge}>
                  <Text style={{ fontSize: 24 }}>🏏</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ackModalTitleTamil}>
                    Official Match Protocols & Timings Schedule
                  </Text>
                  <Text style={styles.ackModalSubtitle}>
                    Official Match Protocol & Timings • Scorer Verification
                  </Text>
                </View>
              </View>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Fixture Overview Box */}
              {timingAckMatch && (
                <View style={styles.ackFixtureCard}>
                  <Text style={styles.ackTournamentText}>
                    🏆 {timingAckMatch.tournament_name || timingAckMatch.tournament || 'Virudhunagar Premier League 2026'}
                  </Text>
                  <View style={styles.ackTeamsRow}>
                    <Text style={styles.ackTeamName}>
                      {typeof timingAckMatch.teamA === 'string' ? timingAckMatch.teamA : (timingAckMatch.teamA?.name || timingAckMatch.team_a_name || 'Team A')}
                    </Text>
                    <View style={styles.ackVsBadge}>
                      <Text style={styles.ackVsBadgeText}>VS</Text>
                    </View>
                    <Text style={styles.ackTeamName}>
                      {typeof timingAckMatch.teamB === 'string' ? timingAckMatch.teamB : (timingAckMatch.teamB?.name || timingAckMatch.team_b_name || 'Team B')}
                    </Text>
                  </View>
                  <View style={styles.ackMetaRow}>
                    <Text style={styles.ackMetaText}>
                      📅 {timingAckMatch.match_date || timingAckMatch.date}
                    </Text>
                    <Text style={styles.ackMetaText}>
                      📍 {timingAckMatch.venue || 'Kamarajar District Stadium'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Highlighted Timings Grid */}
              {(() => {
                const timings = calculateOfficialMatchTimings(
                  timingAckMatch?.match_time || timingAckMatch?.time || '08:30 AM'
                );
                return (
                  <View style={styles.ackTimingsGrid}>
                    {/* Toss Window Box */}
                    <View style={styles.ackTimingItem}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={styles.ackTimingLabelTamil}>🪙 Toss Window</Text>
                        <Text style={styles.ackTimingTag}>Toss Window</Text>
                      </View>
                      <Text style={styles.ackTimingValue}>
                        {timingAckMatch?.toss_time_window || timings.tossWindow}
                      </Text>
                      <Text style={styles.ackTimingHint}>15 - 30 minutes before first ball</Text>
                    </View>

                    {/* First Ball Delivery Box */}
                    <View style={[styles.ackTimingItem, { borderColor: '#f59e0b', backgroundColor: '#fffbeb' }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={[styles.ackTimingLabelTamil, { color: '#b45309' }]}>🏏 First Ball Time</Text>
                        <Text style={[styles.ackTimingTag, { backgroundColor: '#fef3c7', color: '#b45309' }]}>First Ball</Text>
                      </View>
                      <Text style={[styles.ackTimingValue, { color: '#92400e' }]}>
                        {timingAckMatch?.first_ball_time || timingAckMatch?.match_time || timings.firstBallTime}
                      </Text>
                      <Text style={[styles.ackTimingHint, { color: '#b45309' }]}>Mandatory delivery deadline</Text>
                    </View>

                    {/* Scorer Reporting Time */}
                    <View style={[styles.ackTimingItem, { borderColor: '#3b82f6', backgroundColor: '#eff6ff' }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={[styles.ackTimingLabelTamil, { color: '#1d4ed8' }]}>⏰ Scorer Reporting Time</Text>
                        <Text style={[styles.ackTimingTag, { backgroundColor: '#dbeafe', color: '#1d4ed8' }]}>Reporting</Text>
                      </View>
                      <Text style={[styles.ackTimingValue, { color: '#1e40af' }]}>
                        {timingAckMatch?.scorer_reporting_time || timings.reportingTime}
                      </Text>
                      <Text style={[styles.ackTimingHint, { color: '#2563eb' }]}>Scorer booth arrival & roster check</Text>
                    </View>
                  </View>
                );
              })()}

              {/* Official Association Rules Card */}
              <View style={styles.ackRulesBox}>
                <Text style={styles.ackRulesHeader}>📜 Official Association Rules & Standard Timings:</Text>
                <View style={{ marginTop: 6, gap: 5 }}>
                  <Text style={styles.ackRuleLine}>• <Text style={{ fontWeight: '700' }}>Toss Window:</Text> 08:00 AM to 08:15 AM (Morning) & 01:00 PM to 01:15 PM (Afternoon)</Text>
                  <Text style={styles.ackRuleLine}>• <Text style={{ fontWeight: '700' }}>First Ball:</Text> Must be delivered at 08:30 AM (Morning) & 01:30 PM (Afternoon)</Text>
                  <Text style={styles.ackRuleLine}>• <Text style={{ fontWeight: '700' }}>Rule 15:</Text> {rule15Config.ruleText.trim() || (rule15Config.enabled ? `A minimum of ${rule15Config.minPlayers} players must be present at the start of each innings.` : 'Minimum player attendance check is currently waived by Admin.')}</Text>
                </View>
              </View>

              {/* Scorer Consent Box */}
              <View style={styles.ackConsentBox}>
                <Text style={styles.ackConsentText}>
                  🛡️ I acknowledge the scheduled match timings and toss protocols, and agree to officiate promptly in accordance with Association rules.
                </Text>
              </View>
            </ScrollView>

            {/* Mandatory Action Button */}
            <TouchableOpacity
              style={styles.ackSubmitBtn}
              onPress={handleAcknowledgeTimings}
              activeOpacity={0.85}
            >
              <Text style={styles.ackSubmitBtnText}>
                ✓ Acknowledge & Enter Scorer Portal
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (isDesktop: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', width: '100%', maxWidth: '100%', overflow: 'hidden' },

  // HEADER
  header: {
    paddingVertical: isDesktop ? 12 : 10,
    paddingHorizontal: isDesktop ? 24 : 14,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    flexDirection: isDesktop ? 'row' : 'column',
    justifyContent: 'space-between',
    alignItems: isDesktop ? 'center' : 'stretch',
    rowGap: 8,
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2,
    width: '100%',
    maxWidth: '100%'
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: isDesktop ? 1 : undefined, minWidth: 0 },
  logo: { width: 32, height: 32, marginRight: 10, flexShrink: 0 },
  title: { color: '#1e293b', fontSize: isDesktop ? 16 : 15, fontWeight: 'bold', letterSpacing: 0.4 },
  subtitle: { color: '#b45309', fontSize: isDesktop ? 11 : 10.5, marginTop: 1, fontWeight: '600' },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: isDesktop ? 'flex-end' : 'space-between',
    gap: isDesktop ? 12 : 8,
    flexShrink: 0,
    paddingTop: isDesktop ? 0 : 8,
    borderTopWidth: isDesktop ? 0 : 1,
    borderTopColor: '#f1f5f9',
    width: isDesktop ? 'auto' : '100%'
  },
  scorerInfo: { alignItems: isDesktop ? 'flex-end' : 'flex-start', flex: isDesktop ? undefined : 1, minWidth: 0 },
  scorerName: { color: '#1e293b', fontSize: isDesktop ? 13 : 12, fontWeight: '700' },
  scorerId: { color: '#64748b', fontSize: isDesktop ? 11 : 10 },

  logoutBtn: { backgroundColor: '#fef2f2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#fca5a5', flexShrink: 0 },
  logoutText: { color: '#dc2626', fontWeight: 'bold', fontSize: 11.5 },

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
  tabsScroll: {
    width: '100%',
    marginBottom: 16,
    flexGrow: 0
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2
  },
  tabButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center'
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
  },

  // MANDATORY ACKNOWLEDGEMENT MODAL
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  ackModalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 580,
    padding: isDesktop ? 22 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 2,
    borderColor: '#d97706'
  },
  ackModalHeader: {
    paddingBottom: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: '#f1f5f9',
    marginBottom: 14
  },
  ackModalIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fffbeb',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#f59e0b'
  },
  ackModalTitleTamil: {
    fontSize: isDesktop ? 15.5 : 14,
    fontWeight: '900',
    color: '#0f172a'
  },
  ackModalSubtitle: {
    fontSize: 11,
    color: '#b45309',
    fontWeight: '700',
    marginTop: 2
  },
  ackFixtureCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12
  },
  ackTournamentText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  ackTeamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginVertical: 4
  },
  ackTeamName: {
    fontSize: isDesktop ? 16 : 14.5,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
    flex: 1
  },
  ackVsBadge: {
    backgroundColor: '#d97706',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  ackVsBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ffffff'
  },
  ackMetaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexWrap: 'wrap'
  },
  ackMetaText: {
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '700'
  },
  ackTimingsGrid: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: 12
  },
  ackTimingItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    padding: 10
  },
  ackTimingLabelTamil: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1e293b'
  },
  ackTimingTag: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#475569',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4
  },
  ackTimingValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2
  },
  ackTimingHint: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 2
  },
  ackRulesBox: {
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#fcd34d',
    padding: 12,
    marginBottom: 12
  },
  ackRulesHeader: {
    fontSize: 12,
    fontWeight: '900',
    color: '#92400e'
  },
  ackRuleLine: {
    fontSize: 11.5,
    lineHeight: 17,
    color: '#78350f'
  },
  ackConsentBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 10,
    marginBottom: 12
  },
  ackConsentText: {
    fontSize: 11,
    lineHeight: 16,
    color: '#166534',
    fontWeight: '600'
  },
  ackSubmitBtn: {
    backgroundColor: '#15803d',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#15803d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4
  },
  ackSubmitBtnText: {
    color: '#ffffff',
    fontSize: isDesktop ? 14 : 12.5,
    fontWeight: '900',
    textAlign: 'center'
  }
});
