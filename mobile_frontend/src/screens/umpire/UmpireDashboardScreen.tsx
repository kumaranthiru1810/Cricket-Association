/**
 * src/screens/umpire/UmpireDashboardScreen.tsx
 * 
 * Official Umpire Dashboard & Match Supervision Console for Cricket Federation.
 * Styled with the elegant Bright Federation Theme matching the Scorer and Admin console design:
 * - Top Frosted White / Ivory Header with Gold Federation Branding, User Badge, and Red Exit Pill
 * - Atmospheric Stadium Background via SharedBackground (#fdfbf7 / #f6f2e9)
 * - Crisp White Sub-Navigation Tabs Bar with Amber Active Pill
 * - Highlight Metric Cards with Left-Accents (Sky, Emerald, Amber, Purple)
 * - Clean White Match Cards with Status Badges, Meta Details, and Action Buttons
 * - Live Match Supervision Console with Scoreboard, Striker/Bowler status, and Toss Banner
 * - High-Visibility Umpire Decision Pad (Wide, No Ball, Wicket, Dead Ball, Bye, Leg Bye, 4, 6, Appeal, DRS)
 * - Bright Theme Modals for Toss Confirmation, Decision Commentary, Profile Editing, and Result Certification
 * - Full MongoDB Backend Integration via UmpireApi
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  Dimensions,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SharedBackground from '../../components/scorer/SharedBackground';
import { UmpireApi, getCurrentUser } from '../../services/api';
import { showAlert as showSwal, showSuccess, showError } from '../../utils/sweetalert';

const IMG_LOGO = require('../../../assets/logo_transparent.png');

export interface UmpireDashboardProps {
  onExit?: () => void;
  initialParams?: any;
}

type TabType = 'overview' | 'matches' | 'currentMatch' | 'profile';
type MatchFilter = 'ALL' | 'TODAY' | 'LIVE' | 'UPCOMING' | 'COMPLETED';

export default function UmpireDashboardScreen({ onExit, initialParams }: UmpireDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialParams?.initialTab || 'overview');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Core Data States
  const [profile, setProfile] = useState<any>(null);
  const [matchesData, setMatchesData] = useState<{
    all: any[];
    today: any[];
    current: any | null;
    live: any[];
    upcoming: any[];
    completed: any[];
  }>({
    all: [],
    today: [],
    current: null,
    live: [],
    upcoming: [],
    completed: []
  });

  // Selected Active Match for Supervision
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(initialParams?.matchId || null);
  const [selectedMatchDetails, setSelectedMatchDetails] = useState<any | null>(null);
  const [isLoadingMatchDetails, setIsLoadingMatchDetails] = useState<boolean>(false);

  // Search & Filtering in Matches Tab
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('ALL');

  // Modals State
  const [isEditProfileVisible, setIsEditProfileVisible] = useState<boolean>(false);
  const [editPhone, setEditPhone] = useState<string>('');
  const [editTaluk, setEditTaluk] = useState<string>('');
  const [editExperience, setEditExperience] = useState<string>('12');
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

  // Toss Confirmation Modal
  const [isTossModalVisible, setIsTossModalVisible] = useState<boolean>(false);
  const [selectedTossWinner, setSelectedTossWinner] = useState<string>('');
  const [selectedTossDecision, setSelectedTossDecision] = useState<'BAT' | 'BOWL'>('BAT');
  const [isSubmittingToss, setIsSubmittingToss] = useState<boolean>(false);

  // Result Confirmation Modal
  const [isResultModalVisible, setIsResultModalVisible] = useState<boolean>(false);
  const [resultSummaryText, setResultSummaryText] = useState<string>('');
  const [resultNotesText, setResultNotesText] = useState<string>('');
  const [resultPlayerOfMatch, setResultPlayerOfMatch] = useState<string>('');
  const [isSubmittingResult, setIsSubmittingResult] = useState<boolean>(false);

  // Decision Input Modal
  const [isDecisionModalVisible, setIsDecisionModalVisible] = useState<boolean>(false);
  const [pendingDecisionType, setPendingDecisionType] = useState<string>('');
  const [decisionNotes, setDecisionNotes] = useState<string>('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState<boolean>(false);

  // Responsive Layout
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);
  const isDesktop = windowWidth >= 768;

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setWindowWidth(window.width);
    });
    return () => sub?.remove();
  }, []);

  // Show user friendly alert via SweetAlert
  const showAlert = (title: string, message: string, icon: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    showSwal(title, message, icon);
  };

  // Load all initial data from MongoDB
  const loadUmpireData = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      setErrorMessage(null);

      const [profileRes, matchesRes] = await Promise.all([
        UmpireApi.getProfile().catch(e => {
          console.warn('Profile load warning:', e.message);
          return null;
        }),
        UmpireApi.getMatches().catch(e => {
          console.warn('Matches load warning:', e.message);
          return null;
        })
      ]);

      if (profileRes && profileRes.data) {
        setProfile(profileRes.data);
        setEditPhone(profileRes.data.mobile || '');
        setEditTaluk(profileRes.data.taluk || 'Virudhunagar');
        setEditExperience(String(profileRes.data.experienceYears || 12));
      }

      if (matchesRes && matchesRes.data) {
        const d = matchesRes.data;
        setMatchesData({
          all: Array.isArray(d.all) ? d.all : [],
          today: Array.isArray(d.today) ? d.today : [],
          current: d.current || null,
          live: Array.isArray(d.live) ? d.live : [],
          upcoming: Array.isArray(d.upcoming) ? d.upcoming : [],
          completed: Array.isArray(d.completed) ? d.completed : []
        });

        // Auto-select match if not selected
        if (!selectedMatchId && d.current) {
          setSelectedMatchId(d.current.matchId || d.current.id);
        } else if (!selectedMatchId && d.all && d.all.length > 0) {
          setSelectedMatchId(d.all[0].matchId || d.all[0].id);
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to connect to Umpire backend. Please check network.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedMatchId]);

  useEffect(() => {
    loadUmpireData();
  }, [loadUmpireData]);

  // Load details for selected active match
  const loadMatchDetails = useCallback(async (mId: string) => {
    if (!mId) return;
    try {
      setIsLoadingMatchDetails(true);
      const res = await UmpireApi.getMatchById(mId);
      if (res && res.data) {
        setSelectedMatchDetails(res.data);
        if (res.data.resultSummary) {
          setResultSummaryText(res.data.resultSummary);
        }
        if (res.data.playerOfMatch) {
          setResultPlayerOfMatch(res.data.playerOfMatch);
        }
      }
    } catch (err: any) {
      console.warn('Match details load error:', err.message);
    } finally {
      setIsLoadingMatchDetails(false);
    }
  }, []);

  useEffect(() => {
    if (selectedMatchId) {
      loadMatchDetails(selectedMatchId);
    }
  }, [selectedMatchId, loadMatchDetails]);

  // Handle Match Selection
  const handleSelectMatch = (mId: string) => {
    setSelectedMatchId(mId);
    setActiveTab('currentMatch');
    loadMatchDetails(mId);
  };

  // Umpire Action: Start Match & Confirm Toss
  const handleConfirmTossAndStart = async () => {
    if (!selectedMatchId) return;
    if (!selectedTossWinner) {
      showAlert('Selection Required', 'Please select the toss winner team.');
      return;
    }

    try {
      setIsSubmittingToss(true);
      await UmpireApi.startMatch(selectedMatchId, {
        tossWinner: selectedTossWinner,
        tossDecision: selectedTossDecision
      });
      setIsTossModalVisible(false);
      setSuccessMessage('Match officially commenced with verified toss!');
      setTimeout(() => setSuccessMessage(null), 4000);
      loadMatchDetails(selectedMatchId);
      loadUmpireData(true);
    } catch (err: any) {
      showAlert('Error Starting Match', err.message || 'Failed to start match.');
    } finally {
      setIsSubmittingToss(false);
    }
  };

  // Umpire Action: Update Status (Pause, Resume, Innings Break)
  const handleUpdateStatus = async (newStatus: string, reasonPrompt = false) => {
    if (!selectedMatchId) return;
    try {
      setIsLoading(true);
      const reason = reasonPrompt ? 'Official Umpire stoppage' : undefined;
      await UmpireApi.updateMatchStatus(selectedMatchId, newStatus, reason);
      setSuccessMessage(`Match status transitioned to ${newStatus.toUpperCase()}`);
      setTimeout(() => setSuccessMessage(null), 3000);
      loadMatchDetails(selectedMatchId);
      loadUmpireData(true);
    } catch (err: any) {
      showAlert('Status Update Failed', err.message || 'Could not update status.');
    } finally {
      setIsLoading(false);
    }
  };

  // Umpire Action: Open Decision Pad / Record Decision
  const handleOpenDecisionModal = (decType: string) => {
    setPendingDecisionType(decType);
    setDecisionNotes('');
    setIsDecisionModalVisible(true);
  };

  const handleConfirmDecision = async () => {
    if (!selectedMatchId || !pendingDecisionType) return;
    try {
      setIsSubmittingDecision(true);
      await UmpireApi.recordDecision(selectedMatchId, {
        decisionType: pendingDecisionType,
        description: decisionNotes.trim() || `Official Umpire Decision: ${pendingDecisionType}`
      });
      setIsDecisionModalVisible(false);
      setSuccessMessage(`Umpire decision '${pendingDecisionType}' recorded and broadcasted!`);
      setTimeout(() => setSuccessMessage(null), 3500);
      loadMatchDetails(selectedMatchId);
    } catch (err: any) {
      showAlert('Decision Record Error', err.message || 'Failed to record decision.');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // Umpire Action: Confirm Match Result
  const handleConfirmResult = async () => {
    if (!selectedMatchId) return;
    if (!resultSummaryText.trim()) {
      showAlert('Result Required', 'Please enter or confirm the final result summary.');
      return;
    }

    try {
      setIsSubmittingResult(true);
      await UmpireApi.confirmResult(selectedMatchId, {
        resultSummary: resultSummaryText.trim(),
        notes: resultNotesText.trim() || 'Official match result certified by Panel Umpires.',
        playerOfMatch: resultPlayerOfMatch.trim() || undefined
      });
      setIsResultModalVisible(false);
      setSuccessMessage('Match result officially verified and certified!');
      setTimeout(() => setSuccessMessage(null), 4000);
      loadMatchDetails(selectedMatchId);
      loadUmpireData(true);
    } catch (err: any) {
      showAlert('Result Confirmation Error', err.message || 'Failed to confirm result.');
    } finally {
      setIsSubmittingResult(false);
    }
  };

  // Umpire Action: Save Profile
  const handleSaveProfile = async () => {
    try {
      setIsSavingProfile(true);
      const res = await UmpireApi.updateProfile({
        mobile: editPhone.trim(),
        taluk: editTaluk.trim(),
        experienceYears: Number(editExperience) || 12
      });
      if (res && res.data) {
        setProfile(res.data);
      }
      setIsEditProfileVisible(false);
      setSuccessMessage('Profile details updated successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      showAlert('Update Failed', err.message || 'Could not update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Filtered Matches List
  const filteredMatches = useMemo(() => {
    let list = matchesData.all || [];
    if (matchFilter === 'TODAY') list = matchesData.today || [];
    if (matchFilter === 'LIVE') list = matchesData.live || [];
    if (matchFilter === 'UPCOMING') list = matchesData.upcoming || [];
    if (matchFilter === 'COMPLETED') list = matchesData.completed || [];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(m =>
        (m.teamA?.name || '').toLowerCase().includes(q) ||
        (m.teamB?.name || '').toLowerCase().includes(q) ||
        (m.venue || '').toLowerCase().includes(q) ||
        (m.tournamentName || '').toLowerCase().includes(q) ||
        (m.matchId || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [matchesData, matchFilter, searchQuery]);

  return (
    <SharedBackground>
      <SafeAreaView style={styles.safeContainer} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor="#fdfbf7" />

        {/* BRIGHT FEDERATION HEADER */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image source={IMG_LOGO} style={styles.logo} resizeMode="contain" />
            <View>
              <Text style={styles.headerTitle}>CFVD UMPIRE CONSOLE</Text>
              <Text style={styles.headerSubtitle}>
                {profile ? `${profile.name} • ${profile.certificationLevel}` : 'Official District Panel Umpire'}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <View style={styles.umpireBadge}>
              <Text style={styles.umpireBadgeText}>⚖️ OFFICIAL</Text>
            </View>

            <TouchableOpacity
              style={styles.exitBtn}
              onPress={() => {
                if (onExit) onExit();
              }}
            >
              <Text style={styles.exitBtnText}>Exit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Success Notification Banner */}
        {successMessage && (
          <View style={styles.bannerSuccess}>
            <Text style={styles.bannerSuccessText}>✅ {successMessage}</Text>
          </View>
        )}

        {/* Error Notification Banner */}
        {errorMessage && (
          <View style={styles.bannerError}>
            <Text style={styles.bannerErrorText}>⚠️ {errorMessage}</Text>
            <TouchableOpacity onPress={() => loadUmpireData()} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Main Content Area */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#d97706" />
            <Text style={styles.loadingText}>Loading Official Umpire Records & Match Schedules...</Text>
          </View>
        ) : (
          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <View style={styles.tabContent}>
                {/* Bright Stats Row */}
                <View style={styles.statsRow}>
                  <View style={[styles.statCard, { borderLeftColor: '#0284c7' }]}>
                    <Text style={styles.statLabel}>Assigned Matches</Text>
                    <Text style={styles.statValue}>{profile?.stats?.assignedMatchesCount ?? matchesData.all.length}</Text>
                    <Text style={styles.statHint}>Official Appointments</Text>
                  </View>

                  <View style={[styles.statCard, { borderLeftColor: '#059669' }]}>
                    <Text style={styles.statLabel}>Active / Live</Text>
                    <Text style={[styles.statValue, { color: '#059669' }]}>
                      {profile?.stats?.activeMatchesCount ?? matchesData.live.length}
                    </Text>
                    <Text style={styles.statHint}>Live Supervision</Text>
                  </View>

                  <View style={[styles.statCard, { borderLeftColor: '#d97706' }]}>
                    <Text style={styles.statLabel}>Completed</Text>
                    <Text style={[styles.statValue, { color: '#d97706' }]}>
                      {profile?.stats?.completedMatchesCount ?? matchesData.completed.length}
                    </Text>
                    <Text style={styles.statHint}>Officially Certified</Text>
                  </View>

                  <View style={[styles.statCard, { borderLeftColor: '#7c3aed' }]}>
                    <Text style={styles.statLabel}>Experience</Text>
                    <Text style={[styles.statValue, { color: '#7c3aed' }]}>
                      {profile?.experienceYears || 12} Yrs
                    </Text>
                    <Text style={styles.statHint}>{profile?.taluk || 'Virudhunagar'}</Text>
                  </View>
                </View>

                {/* ACTIVE MATCH HIGHLIGHT CARD */}
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>🏏 ACTIVE SUPERVISED MATCH</Text>
                    {matchesData.current && (
                      <View style={styles.liveIndicator}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveText}>{matchesData.current.status}</Text>
                      </View>
                    )}
                  </View>

                  {matchesData.current ? (
                    <View style={styles.currentMatchBanner}>
                      <View style={styles.teamsHeader}>
                        <View style={styles.teamCol}>
                          <Text style={styles.teamNameLarge}>{matchesData.current.teamA?.name}</Text>
                          <Text style={styles.teamBadge}>{matchesData.current.teamA?.shortName}</Text>
                        </View>
                        <Text style={styles.vsText}>VS</Text>
                        <View style={styles.teamCol}>
                          <Text style={styles.teamNameLarge}>{matchesData.current.teamB?.name}</Text>
                          <Text style={styles.teamBadge}>{matchesData.current.teamB?.shortName}</Text>
                        </View>
                      </View>

                      <View style={styles.matchMetaRow}>
                        <Text style={styles.matchMetaText}>🏟️ {matchesData.current.venue}</Text>
                        <Text style={styles.matchMetaText}>⏰ {matchesData.current.time} • {matchesData.current.date}</Text>
                      </View>

                      <View style={styles.assignmentPill}>
                        <Text style={styles.assignmentPillText}>
                          ⚖️ Your Role: {matchesData.current.umpireAssignment || 'Lead Field Umpire'}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.superviseBtn}
                        onPress={() => handleSelectMatch(matchesData.current.matchId || matchesData.current.id)}
                      >
                        <Text style={styles.superviseBtnText}>⚡ Open Match Control Console →</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.emptyStateBox}>
                      <Text style={styles.emptyStateText}>No active live match in progress right now.</Text>
                      <Text style={styles.emptyStateSubtext}>
                        Select any scheduled fixture from the Matches tab to initiate toss confirmation and official supervision.
                      </Text>
                    </View>
                  )}
                </View>

                {/* TODAY'S ASSIGNED MATCHES */}
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>📅 TODAY'S ASSIGNED FIXTURES</Text>
                    <Text style={styles.sectionCountBadge}>{matchesData.today.length} Matches</Text>
                  </View>

                  {matchesData.today.length > 0 ? (
                    matchesData.today.map((m, idx) => (
                      <TouchableOpacity
                        key={m.matchId || m.id || idx}
                        style={styles.matchItemCard}
                        onPress={() => handleSelectMatch(m.matchId || m.id)}
                      >
                        <View style={styles.matchItemHeader}>
                          <Text style={styles.matchItemTournament}>{m.tournamentName}</Text>
                          <View style={[styles.statusBadge, getStatusBadgeStyle(m.status)]}>
                            <Text style={styles.statusBadgeText}>{m.status}</Text>
                          </View>
                        </View>

                        <Text style={styles.matchItemTeams}>
                          {m.teamA?.name} vs {m.teamB?.name}
                        </Text>

                        <View style={styles.matchItemFooter}>
                          <Text style={styles.matchItemVenue}>📍 {m.venue}</Text>
                          <Text style={styles.matchItemRole}>⚖️ {m.umpireAssignment}</Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text style={styles.emptyNotice}>No additional fixtures assigned for today.</Text>
                  )}
                </View>

                {/* UPCOMING MATCHES */}
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>🔜 UPCOMING APPOINTMENTS</Text>
                    <Text style={styles.sectionCountBadge}>{matchesData.upcoming.length} Scheduled</Text>
                  </View>

                  {matchesData.upcoming.length > 0 ? (
                    matchesData.upcoming.slice(0, 3).map((m, idx) => (
                      <View key={m.matchId || m.id || idx} style={styles.upcomingItem}>
                        <View style={styles.upcomingDateBox}>
                          <Text style={styles.upcomingDateText}>{m.date?.split('-')[2] || 'Day'}</Text>
                          <Text style={styles.upcomingMonthText}>{m.date?.split('-')[1] || 'Mo'}</Text>
                        </View>
                        <View style={styles.upcomingDetails}>
                          <Text style={styles.upcomingTeams}>{m.teamA?.name} vs {m.teamB?.name}</Text>
                          <Text style={styles.upcomingVenue}>{m.venue} • {m.time}</Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyNotice}>No upcoming future fixtures empanelled at this time.</Text>
                  )}
                </View>
              </View>
            )}

            {/* TAB 2: MATCHES LIST & FILTER */}
            {activeTab === 'matches' && (
              <View style={styles.tabContent}>
                {/* Search Bar */}
                <View style={styles.searchBarContainer}>
                  <TextInput
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search by team, venue, or tournament..."
                    placeholderTextColor="#94a3b8"
                  />
                  {searchQuery ? (
                    <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                      <Text style={styles.clearSearchText}>✕</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Filter Tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                  {(['ALL', 'TODAY', 'LIVE', 'UPCOMING', 'COMPLETED'] as MatchFilter[]).map(f => (
                    <TouchableOpacity
                      key={f}
                      style={[styles.filterPill, matchFilter === f && styles.filterPillActive]}
                      onPress={() => setMatchFilter(f)}
                    >
                      <Text style={[styles.filterPillText, matchFilter === f && styles.filterPillTextActive]}>
                        {f}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Match List */}
                {filteredMatches.length > 0 ? (
                  filteredMatches.map((m, idx) => (
                    <View key={m.matchId || m.id || idx} style={styles.matchCardDetailed}>
                      <View style={styles.matchCardTop}>
                        <View>
                          <Text style={styles.matchTournamentText}>{m.tournamentName}</Text>
                          <Text style={styles.matchIdText}>Match #{m.matchId || m.id}</Text>
                        </View>

                        <View style={[styles.statusBadge, getStatusBadgeStyle(m.status)]}>
                          <Text style={styles.statusBadgeText}>{m.status}</Text>
                        </View>
                      </View>

                      {/* Team Matchup */}
                      <View style={styles.matchupContainer}>
                        <View style={styles.teamBlock}>
                          <Text style={styles.teamTitle}>{m.teamA?.name}</Text>
                          <Text style={styles.teamCity}>{m.teamA?.city || 'Club A'}</Text>
                        </View>
                        <Text style={styles.versusPill}>VS</Text>
                        <View style={styles.teamBlock}>
                          <Text style={styles.teamTitle}>{m.teamB?.name}</Text>
                          <Text style={styles.teamCity}>{m.teamB?.city || 'Club B'}</Text>
                        </View>
                      </View>

                      {/* Fixture Details */}
                      <View style={styles.fixtureGrid}>
                        <Text style={styles.fixtureDetail}>📍 Venue: {m.venue}</Text>
                        <Text style={styles.fixtureDetail}>🗓️ Date: {m.date} at {m.time}</Text>
                        <Text style={styles.fixtureDetail}>⏱️ Format: {m.overs} Overs ({m.matchType || 'T20'})</Text>
                        <Text style={styles.fixtureDetail}>⚖️ Assigned: {m.umpireAssignment}</Text>
                      </View>

                      {/* Result or Live Status */}
                      {m.resultSummary ? (
                        <View style={styles.resultBanner}>
                          <Text style={styles.resultText}>🏆 {m.resultSummary}</Text>
                          {m.resultConfirmed && (
                            <Text style={styles.confirmedPill}>✓ Umpire Certified</Text>
                          )}
                        </View>
                      ) : null}

                      {/* Card Actions */}
                      <View style={styles.cardActionRow}>
                        <TouchableOpacity
                          style={styles.openConsoleBtn}
                          onPress={() => handleSelectMatch(m.matchId || m.id)}
                        >
                          <Text style={styles.openConsoleBtnText}>Open Supervisor Console →</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyStateBox}>
                    <Text style={styles.emptyStateText}>No assigned matches match the selected filter.</Text>
                  </View>
                )}
              </View>
            )}

            {/* TAB 3: CURRENT MATCH / UMPIRE CONTROL CONSOLE */}
            {activeTab === 'currentMatch' && (
              <View style={styles.tabContent}>
                {selectedMatchDetails ? (
                  <>
                    {/* Match Header Info */}
                    <View style={styles.matchConsoleHeaderCard}>
                      <View style={styles.consoleHeaderTop}>
                        <View>
                          <Text style={styles.consoleTournament}>{selectedMatchDetails.tournamentName}</Text>
                          <Text style={styles.consoleMatchId}>Match #{selectedMatchDetails.matchId}</Text>
                        </View>
                        <View style={[styles.statusBadge, getStatusBadgeStyle(selectedMatchDetails.status)]}>
                          <Text style={styles.statusBadgeText}>{selectedMatchDetails.status}</Text>
                        </View>
                      </View>

                      {/* Scoreboard Overview */}
                      <View style={styles.scoreboardBanner}>
                        <View style={styles.scoreboardTeam}>
                          <Text style={styles.scoreTeamName}>{selectedMatchDetails.teamA?.name}</Text>
                          <Text style={styles.scoreTeamCaptain}>Capt: {selectedMatchDetails.teamA?.captain || 'N/A'}</Text>
                        </View>

                        <View style={styles.scoreLiveBox}>
                          {selectedMatchDetails.currentInnings ? (
                            <>
                              <Text style={styles.scoreLiveNumbers}>
                                {selectedMatchDetails.currentInnings.totalRuns} / {selectedMatchDetails.currentInnings.wickets}
                              </Text>
                              <Text style={styles.scoreLiveOvers}>
                                ({selectedMatchDetails.currentInnings.overs}.{selectedMatchDetails.currentInnings.balls} / {selectedMatchDetails.oversPerSide} Ov)
                              </Text>
                              {selectedMatchDetails.currentInnings.target && (
                                <Text style={styles.scoreTargetText}>Target: {selectedMatchDetails.currentInnings.target}</Text>
                              )}
                            </>
                          ) : (
                            <Text style={styles.matchNotStartedText}>Toss / Match Not Started</Text>
                          )}
                        </View>

                        <View style={styles.scoreboardTeam}>
                          <Text style={styles.scoreTeamName}>{selectedMatchDetails.teamB?.name}</Text>
                          <Text style={styles.scoreTeamCaptain}>Capt: {selectedMatchDetails.teamB?.captain || 'N/A'}</Text>
                        </View>
                      </View>

                      {/* Toss Status */}
                      {selectedMatchDetails.tossWinnerId ? (
                        <View style={styles.tossInfoPill}>
                          <Text style={styles.tossInfoText}>
                            🪙 Toss: {selectedMatchDetails.tossWinnerName || selectedMatchDetails.tossWinnerId} elected to {selectedMatchDetails.tossDecision}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.tossPendingPill}>
                          <Text style={styles.tossPendingText}>🪙 Toss Pending Official Confirmation</Text>
                        </View>
                      )}

                      {/* Striker & Bowler Live Status */}
                      {selectedMatchDetails.currentInnings?.striker && (
                        <View style={styles.livePlayersStrip}>
                          <View style={styles.playerStripCol}>
                            <Text style={styles.playerStripLabel}>Batting (*Striker):</Text>
                            <Text style={styles.playerStripValue}>
                              {selectedMatchDetails.currentInnings.striker.name} ({selectedMatchDetails.currentInnings.striker.runs} off {selectedMatchDetails.currentInnings.striker.balls})
                            </Text>
                          </View>
                          {selectedMatchDetails.currentInnings?.bowler && (
                            <View style={styles.playerStripCol}>
                              <Text style={styles.playerStripLabel}>Bowler:</Text>
                              <Text style={styles.playerStripValue}>
                                {selectedMatchDetails.currentInnings.bowler.name} ({selectedMatchDetails.currentInnings.bowler.wickets}/{selectedMatchDetails.currentInnings.bowler.runs})
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>

                    {/* UMPIRE MATCH CONTROL ACTIONS */}
                    <View style={styles.controlSectionCard}>
                      <Text style={styles.controlSectionTitle}>⚡ UMPIRE MATCH SUPERVISION CONTROLS</Text>
                      <Text style={styles.controlSectionSub}>
                        Official Match Control for certified Federation Umpires
                      </Text>

                      <View style={styles.controlButtonsGrid}>
                        {/* 1. Start Match / Confirm Toss */}
                        <TouchableOpacity
                          style={[styles.ctrlBtn, { backgroundColor: '#059669' }]}
                          onPress={() => {
                            setSelectedTossWinner(selectedMatchDetails.teamA?.id || '');
                            setSelectedTossDecision('BAT');
                            setIsTossModalVisible(true);
                          }}
                        >
                          <Text style={styles.ctrlBtnIcon}>🪙</Text>
                          <Text style={styles.ctrlBtnText}>Confirm Toss & Start</Text>
                        </TouchableOpacity>

                        {/* 2. Pause / Resume */}
                        {selectedMatchDetails.status === 'PAUSED' ? (
                          <TouchableOpacity
                            style={[styles.ctrlBtn, { backgroundColor: '#0284c7' }]}
                            onPress={() => handleUpdateStatus('live')}
                          >
                            <Text style={styles.ctrlBtnIcon}>▶️</Text>
                            <Text style={styles.ctrlBtnText}>Resume Match</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={[styles.ctrlBtn, { backgroundColor: '#d97706' }]}
                            onPress={() => handleUpdateStatus('paused', true)}
                          >
                            <Text style={styles.ctrlBtnIcon}>⏸️</Text>
                            <Text style={styles.ctrlBtnText}>Pause Match</Text>
                          </TouchableOpacity>
                        )}

                        {/* 3. Innings Break / End Innings */}
                        <TouchableOpacity
                          style={[styles.ctrlBtn, { backgroundColor: '#4f46e5' }]}
                          onPress={() => handleUpdateStatus('innings_break')}
                        >
                          <Text style={styles.ctrlBtnIcon}>🔄</Text>
                          <Text style={styles.ctrlBtnText}>End Innings (Break)</Text>
                        </TouchableOpacity>

                        {/* 4. Conclude & Confirm Result */}
                        <TouchableOpacity
                          style={[styles.ctrlBtn, { backgroundColor: '#e11d48' }]}
                          onPress={() => {
                            setResultSummaryText(selectedMatchDetails.resultSummary || '');
                            setIsResultModalVisible(true);
                          }}
                        >
                          <Text style={styles.ctrlBtnIcon}>🏆</Text>
                          <Text style={styles.ctrlBtnText}>End Match & Certify</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* UMPIRE DECISION PAD */}
                    <View style={styles.decisionPadCard}>
                      <View style={styles.decisionPadHeader}>
                        <Text style={styles.decisionPadTitle}>⚖️ UMPIRE DECISION PAD</Text>
                        <Text style={styles.decisionPadHint}>Tap to record official signal</Text>
                      </View>

                      <View style={styles.decisionsGrid}>
                        <TouchableOpacity
                          style={[styles.decisionBtn, { backgroundColor: '#d97706' }]}
                          onPress={() => handleOpenDecisionModal('WIDE')}
                        >
                          <Text style={styles.decisionBtnIcon}>🚨</Text>
                          <Text style={styles.decisionBtnLabel}>Wide</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.decisionBtn, { backgroundColor: '#dc2626' }]}
                          onPress={() => handleOpenDecisionModal('NO_BALL')}
                        >
                          <Text style={styles.decisionBtnIcon}>🛑</Text>
                          <Text style={styles.decisionBtnLabel}>No Ball</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.decisionBtn, { backgroundColor: '#b91c1c' }]}
                          onPress={() => handleOpenDecisionModal('WICKET')}
                        >
                          <Text style={styles.decisionBtnIcon}>☝️</Text>
                          <Text style={styles.decisionBtnLabel}>Out / Wicket</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.decisionBtn, { backgroundColor: '#475569' }]}
                          onPress={() => handleOpenDecisionModal('DEAD_BALL')}
                        >
                          <Text style={styles.decisionBtnIcon}>⏸️</Text>
                          <Text style={styles.decisionBtnLabel}>Dead Ball</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.decisionBtn, { backgroundColor: '#0284c7' }]}
                          onPress={() => handleOpenDecisionModal('BYE')}
                        >
                          <Text style={styles.decisionBtnIcon}>👟</Text>
                          <Text style={styles.decisionBtnLabel}>Bye</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.decisionBtn, { backgroundColor: '#0369a1' }]}
                          onPress={() => handleOpenDecisionModal('LEG_BYE')}
                        >
                          <Text style={styles.decisionBtnIcon}>🦵</Text>
                          <Text style={styles.decisionBtnLabel}>Leg Bye</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.decisionBtn, { backgroundColor: '#059669' }]}
                          onPress={() => handleOpenDecisionModal('BOUNDARY_4')}
                        >
                          <Text style={styles.decisionBtnIcon}>4️⃣</Text>
                          <Text style={styles.decisionBtnLabel}>Four (4)</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.decisionBtn, { backgroundColor: '#7c3aed' }]}
                          onPress={() => handleOpenDecisionModal('BOUNDARY_6')}
                        >
                          <Text style={styles.decisionBtnIcon}>6️⃣</Text>
                          <Text style={styles.decisionBtnLabel}>Six (6)</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.decisionBtn, { backgroundColor: '#db2777' }]}
                          onPress={() => handleOpenDecisionModal('APPEAL')}
                        >
                          <Text style={styles.decisionBtnIcon}>🙋</Text>
                          <Text style={styles.decisionBtnLabel}>Appeal / Check</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.decisionBtn, { backgroundColor: '#4f46e5' }]}
                          onPress={() => handleOpenDecisionModal('DRS_REVIEW')}
                        >
                          <Text style={styles.decisionBtnIcon}>📺</Text>
                          <Text style={styles.decisionBtnLabel}>DRS / Review</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* RECENT DECISIONS LOG */}
                    <View style={styles.decisionsLogCard}>
                      <Text style={styles.decisionsLogTitle}>📜 RECENT RECORDED DECISIONS</Text>

                      {selectedMatchDetails.recentDecisions && selectedMatchDetails.recentDecisions.length > 0 ? (
                        selectedMatchDetails.recentDecisions.map((d: any, idx: number) => (
                          <View key={d.id || idx} style={styles.decisionLogRow}>
                            <View style={styles.decisionLogTypeBox}>
                              <Text style={styles.decisionLogTypeText}>{d.decisionType}</Text>
                            </View>
                            <View style={styles.decisionLogContent}>
                              <Text style={styles.decisionLogDesc}>{d.description}</Text>
                              <Text style={styles.decisionLogMeta}>
                                Over {d.over}.{d.ball} • Inning {d.inning} • {d.umpireName || 'Official'}
                              </Text>
                            </View>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.emptyNotice}>No decisions logged yet for this match.</Text>
                      )}
                    </View>
                  </>
                ) : (
                  <View style={styles.emptyStateBox}>
                    <Text style={styles.emptyStateText}>No match selected for supervision.</Text>
                    <Text style={styles.emptyStateSubtext}>Please select a match from the Matches tab.</Text>
                  </View>
                )}
              </View>
            )}

            {/* TAB 4: PROFILE */}
            {activeTab === 'profile' && (
              <View style={styles.tabContent}>
                <View style={styles.profileCard}>
                  <View style={styles.profileHeader}>
                    <View style={styles.avatarBox}>
                      <Text style={styles.avatarText}>
                        {profile?.name ? profile.name.charAt(0).toUpperCase() : 'U'}
                      </Text>
                    </View>

                    <View style={styles.profileNameBox}>
                      <Text style={styles.profileName}>{profile?.name || 'Thiru. K. Sundaram'}</Text>
                      <Text style={styles.profileRole}>{profile?.certificationLevel || 'Panel A - Senior Umpire'}</Text>
                      <View style={styles.statusPillActive}>
                        <Text style={styles.statusPillActiveText}>● {profile?.status || 'ACTIVE'}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Profile Data Rows */}
                  <View style={styles.profileDetailsList}>
                    <View style={styles.profileRow}>
                      <Text style={styles.profileRowLabel}>Official Umpire ID</Text>
                      <Text style={styles.profileRowValue}>{profile?.id || 'UMP-101'}</Text>
                    </View>

                    <View style={styles.profileRow}>
                      <Text style={styles.profileRowLabel}>Registered Email</Text>
                      <Text style={styles.profileRowValue}>{profile?.email}</Text>
                    </View>

                    <View style={styles.profileRow}>
                      <Text style={styles.profileRowLabel}>Contact Mobile</Text>
                      <Text style={styles.profileRowValue}>{profile?.mobile || 'Not set'}</Text>
                    </View>

                    <View style={styles.profileRow}>
                      <Text style={styles.profileRowLabel}>Taluk / District</Text>
                      <Text style={styles.profileRowValue}>{profile?.taluk || 'Virudhunagar'}</Text>
                    </View>

                    <View style={styles.profileRow}>
                      <Text style={styles.profileRowLabel}>Panel Certification</Text>
                      <Text style={styles.profileRowValue}>{profile?.certificationLevel || 'Senior Panel'}</Text>
                    </View>

                    <View style={styles.profileRow}>
                      <Text style={styles.profileRowLabel}>Years of Experience</Text>
                      <Text style={styles.profileRowValue}>{profile?.experienceYears || 12} Years</Text>
                    </View>

                    <View style={styles.profileRow}>
                      <Text style={styles.profileRowLabel}>Total Matches Empanelled</Text>
                      <Text style={styles.profileRowValue}>{profile?.matchesUmpired || 38}</Text>
                    </View>
                  </View>

                  {/* Edit Profile Button */}
                  <TouchableOpacity
                    style={styles.editProfileBtn}
                    onPress={() => setIsEditProfileVisible(true)}
                  >
                    <Text style={styles.editProfileBtnText}>✏️ Edit Profile Details</Text>
                  </TouchableOpacity>
                </View>

                {/* Federation Standing & By-Laws Card */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>⚖️ FEDERATION STANDING & BY-LAWS</Text>
                  <Text style={styles.bylawText}>
                    All decisions made by empanelled officials on the field are governed by the Cricket Federation
                    of Virudhunagar District (CFVD) Constitution & Playing Conditions. Umpires hold supreme authority
                    regarding match play, toss verification, stoppage due to weather or light, and official certification
                    of scorecards.
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        )}

        {/* BRIGHT FLOATING BOTTOM NAVIGATION BAR */}
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={[styles.navItem, activeTab === 'overview' && styles.navItemActive]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={styles.navIcon}>🏠</Text>
            <Text style={[styles.navText, activeTab === 'overview' && styles.navTextActive]}>Overview</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, activeTab === 'matches' && styles.navItemActive]}
            onPress={() => setActiveTab('matches')}
          >
            <Text style={styles.navIcon}>📅</Text>
            <Text style={[styles.navText, activeTab === 'matches' && styles.navTextActive]}>Matches</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, activeTab === 'currentMatch' && styles.navItemActive]}
            onPress={() => setActiveTab('currentMatch')}
          >
            <Text style={styles.navIcon}>⚖️</Text>
            <Text style={[styles.navText, activeTab === 'currentMatch' && styles.navTextActive]}>Current Match</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, activeTab === 'profile' && styles.navItemActive]}
            onPress={() => setActiveTab('profile')}
          >
            <Text style={styles.navIcon}>👤</Text>
            <Text style={[styles.navText, activeTab === 'profile' && styles.navTextActive]}>Profile</Text>
          </TouchableOpacity>
        </View>

        {/* TOSS CONFIRMATION MODAL */}
        <Modal visible={isTossModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>🪙 CONFIRM TOSS & START MATCH</Text>
              <Text style={styles.modalSubtitle}>Verify toss winner and batting/bowling decision</Text>

              {selectedMatchDetails && (
                <>
                  <Text style={styles.modalLabel}>Select Toss Winner:</Text>
                  <View style={styles.modalRadioGroup}>
                    <TouchableOpacity
                      style={[styles.modalRadioBtn, selectedTossWinner === selectedMatchDetails.teamA?.id && styles.modalRadioActive]}
                      onPress={() => setSelectedTossWinner(selectedMatchDetails.teamA?.id)}
                    >
                      <Text style={styles.modalRadioText}>{selectedMatchDetails.teamA?.name}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modalRadioBtn, selectedTossWinner === selectedMatchDetails.teamB?.id && styles.modalRadioActive]}
                      onPress={() => setSelectedTossWinner(selectedMatchDetails.teamB?.id)}
                    >
                      <Text style={styles.modalRadioText}>{selectedMatchDetails.teamB?.name}</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.modalLabel}>Elected To:</Text>
                  <View style={styles.modalRadioGroup}>
                    <TouchableOpacity
                      style={[styles.modalRadioBtn, selectedTossDecision === 'BAT' && styles.modalRadioActive]}
                      onPress={() => setSelectedTossDecision('BAT')}
                    >
                      <Text style={styles.modalRadioText}>🏏 Bat First</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modalRadioBtn, selectedTossDecision === 'BOWL' && styles.modalRadioActive]}
                      onPress={() => setSelectedTossDecision('BOWL')}
                    >
                      <Text style={styles.modalRadioText}>🎳 Bowl First</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={styles.modalCancelBtn}
                      onPress={() => setIsTossModalVisible(false)}
                    >
                      <Text style={styles.modalCancelText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.modalConfirmBtn}
                      onPress={handleConfirmTossAndStart}
                      disabled={isSubmittingToss}
                    >
                      {isSubmittingToss ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.modalConfirmText}>Confirm & Start Match</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* RECORD DECISION MODAL */}
        <Modal visible={isDecisionModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>⚖️ RECORD DECISION: {pendingDecisionType}</Text>
              <Text style={styles.modalSubtitle}>Enter notes or commentary for this umpire decision</Text>

              <TextInput
                style={styles.modalInput}
                value={decisionNotes}
                onChangeText={setDecisionNotes}
                placeholder="e.g. Plumb in front, LBW signaled or wide down leg side"
                placeholderTextColor="#94a3b8"
                multiline
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setIsDecisionModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={handleConfirmDecision}
                  disabled={isSubmittingDecision}
                >
                  {isSubmittingDecision ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalConfirmText}>Record Signal</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* CONFIRM RESULT MODAL */}
        <Modal visible={isResultModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>🏆 CERTIFY FINAL MATCH RESULT</Text>
              <Text style={styles.modalSubtitle}>Verify scorebook figures and certify match outcome</Text>

              <Text style={styles.modalLabel}>Result Summary *</Text>
              <TextInput
                style={styles.modalInput}
                value={resultSummaryText}
                onChangeText={setResultSummaryText}
                placeholder="e.g. Sivakasi Strikers won by 18 runs"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.modalLabel}>Player of Match (Optional)</Text>
              <TextInput
                style={styles.modalInput}
                value={resultPlayerOfMatch}
                onChangeText={setResultPlayerOfMatch}
                placeholder="e.g. Dinesh Karthik"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.modalLabel}>Official Umpire Sign-Off Notes</Text>
              <TextInput
                style={styles.modalInput}
                value={resultNotesText}
                onChangeText={setResultNotesText}
                placeholder="Scorecards, boundary count, and disciplinary compliance verified."
                placeholderTextColor="#94a3b8"
                multiline
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setIsResultModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalConfirmBtn, { backgroundColor: '#e11d48' }]}
                  onPress={handleConfirmResult}
                  disabled={isSubmittingResult}
                >
                  {isSubmittingResult ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalConfirmText}>Certify & Complete Match</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* EDIT PROFILE MODAL */}
        <Modal visible={isEditProfileVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>✏️ EDIT UMPIRE PROFILE</Text>
              <Text style={styles.modalSubtitle}>Update your phone number, taluk, and experience</Text>

              <Text style={styles.modalLabel}>Contact Mobile Number</Text>
              <TextInput
                style={styles.modalInput}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="+91 94431 12345"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
              />

              <Text style={styles.modalLabel}>District / Taluk</Text>
              <TextInput
                style={styles.modalInput}
                value={editTaluk}
                onChangeText={setEditTaluk}
                placeholder="Virudhunagar"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.modalLabel}>Years of Umpiring Experience</Text>
              <TextInput
                style={styles.modalInput}
                value={editExperience}
                onChangeText={setEditExperience}
                placeholder="12"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setIsEditProfileVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={handleSaveProfile}
                  disabled={isSavingProfile}
                >
                  {isSavingProfile ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalConfirmText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SharedBackground>
  );
}

function getStatusBadgeStyle(status: string) {
  const s = String(status || '').toUpperCase();
  if (s === 'LIVE') return { backgroundColor: '#059669' };
  if (s === 'SCHEDULED') return { backgroundColor: '#2563eb' };
  if (s === 'INNINGS_BREAK') return { backgroundColor: '#7c3aed' };
  if (s === 'PAUSED') return { backgroundColor: '#d97706' };
  if (s === 'COMPLETED') return { backgroundColor: '#475569' };
  return { backgroundColor: '#64748b' };
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  // HEADER
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  logo: {
    width: 36,
    height: 36
  },
  headerTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  headerSubtitle: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  umpireBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f59e0b'
  },
  umpireBadgeText: {
    color: '#92400e',
    fontSize: 11,
    fontWeight: '800'
  },
  exitBtn: {
    backgroundColor: '#fff1f2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecdd3'
  },
  exitBtnText: {
    color: '#e11d48',
    fontSize: 12,
    fontWeight: '800'
  },
  bannerSuccess: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#a7f3d0'
  },
  bannerSuccessText: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '600'
  },
  bannerError: {
    backgroundColor: '#fff1f2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#fecdd3'
  },
  bannerErrorText: {
    color: '#be123c',
    fontSize: 13,
    fontWeight: '600',
    flex: 1
  },
  retryBtn: {
    backgroundColor: '#e11d48',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  loadingText: {
    color: '#64748b',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500'
  },
  scrollArea: {
    flex: 1
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 90
  },
  tabContent: {
    gap: 16
  },
  // STATS ROW
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  statCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  statLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  statValue: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '800',
    marginVertical: 4
  },
  statHint: {
    color: '#94a3b8',
    fontSize: 11
  },
  // SECTION CARDS
  sectionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  sectionCountBadge: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '700'
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 6
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#059669'
  },
  liveText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '800'
  },
  currentMatchBanner: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  teamsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  teamCol: {
    alignItems: 'center',
    flex: 1
  },
  teamNameLarge: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center'
  },
  teamBadge: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2
  },
  vsText: {
    color: '#94a3b8',
    fontWeight: '800',
    fontSize: 12,
    paddingHorizontal: 8
  },
  matchMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8
  },
  matchMetaText: {
    color: '#64748b',
    fontSize: 11
  },
  assignmentPill: {
    backgroundColor: '#fef3c7',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: 'flex-start'
  },
  assignmentPillText: {
    color: '#92400e',
    fontSize: 11,
    fontWeight: '700'
  },
  superviseBtn: {
    backgroundColor: '#eab308',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4
  },
  superviseBtnText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 13
  },
  emptyStateBox: {
    padding: 16,
    alignItems: 'center'
  },
  emptyStateText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center'
  },
  emptyStateSubtext: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center'
  },
  emptyNotice: {
    color: '#94a3b8',
    fontSize: 12,
    fontStyle: 'italic'
  },
  matchItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  matchItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  matchItemTournament: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600'
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  statusBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800'
  },
  matchItemTeams: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    marginVertical: 4
  },
  matchItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4
  },
  matchItemVenue: {
    color: '#64748b',
    fontSize: 11
  },
  matchItemRole: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '600'
  },
  upcomingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12
  },
  upcomingDateBox: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  upcomingDateText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800'
  },
  upcomingMonthText: {
    color: '#b45309',
    fontSize: 10,
    fontWeight: '700'
  },
  upcomingDetails: {
    flex: 1
  },
  upcomingTeams: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700'
  },
  upcomingVenue: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2
  },
  // MATCHES TAB
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: '#0f172a',
    fontSize: 13
  },
  clearSearchBtn: {
    padding: 6
  },
  clearSearchText: {
    color: '#64748b',
    fontSize: 14
  },
  filterScroll: {
    flexDirection: 'row',
    marginVertical: 4
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  filterPillActive: {
    backgroundColor: '#eab308',
    borderColor: '#eab308'
  },
  filterPillText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700'
  },
  filterPillTextActive: {
    color: '#0f172a'
  },
  matchCardDetailed: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  matchCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  matchTournamentText: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '700'
  },
  matchIdText: {
    color: '#94a3b8',
    fontSize: 11
  },
  matchupContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  teamBlock: {
    flex: 1
  },
  teamTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700'
  },
  teamCity: {
    color: '#64748b',
    fontSize: 11
  },
  versusPill: {
    color: '#b45309',
    fontWeight: '800',
    fontSize: 11,
    paddingHorizontal: 8
  },
  fixtureGrid: {
    gap: 4
  },
  fixtureDetail: {
    color: '#64748b',
    fontSize: 11
  },
  resultBanner: {
    backgroundColor: '#ecfdf5',
    padding: 8,
    borderRadius: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0'
  },
  resultText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '700',
    flex: 1
  },
  confirmedPill: {
    color: '#b45309',
    fontSize: 10,
    fontWeight: '800'
  },
  cardActionRow: {
    marginTop: 4
  },
  openConsoleBtn: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  openConsoleBtnText: {
    color: '#0369a1',
    fontSize: 12,
    fontWeight: '700'
  },
  // CURRENT MATCH CONSOLE
  matchConsoleHeaderCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  consoleHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  consoleTournament: {
    color: '#b45309',
    fontSize: 14,
    fontWeight: '800'
  },
  consoleMatchId: {
    color: '#94a3b8',
    fontSize: 11
  },
  scoreboardBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  scoreboardTeam: {
    flex: 1,
    alignItems: 'center'
  },
  scoreTeamName: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center'
  },
  scoreTeamCaptain: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2
  },
  scoreLiveBox: {
    alignItems: 'center',
    paddingHorizontal: 10
  },
  scoreLiveNumbers: {
    color: '#059669',
    fontSize: 24,
    fontWeight: '800'
  },
  scoreLiveOvers: {
    color: '#64748b',
    fontSize: 12
  },
  scoreTargetText: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2
  },
  matchNotStartedText: {
    color: '#64748b',
    fontSize: 12,
    fontStyle: 'italic'
  },
  tossInfoPill: {
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  tossInfoText: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center'
  },
  tossPendingPill: {
    backgroundColor: '#fff1f2',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecdd3'
  },
  tossPendingText: {
    color: '#be123c',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center'
  },
  livePlayersStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    gap: 12
  },
  playerStripCol: {
    flex: 1
  },
  playerStripLabel: {
    color: '#64748b',
    fontSize: 10,
    textTransform: 'uppercase'
  },
  playerStripValue: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '700'
  },
  // CONTROL PANEL
  controlSectionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  controlSectionTitle: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  controlSectionSub: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 12
  },
  controlButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  ctrlBtn: {
    flex: 1,
    minWidth: '47%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    gap: 4
  },
  ctrlBtnIcon: {
    fontSize: 18
  },
  ctrlBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800'
  },
  // DECISION PAD
  decisionPadCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  decisionPadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  decisionPadTitle: {
    color: '#b45309',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  decisionPadHint: {
    color: '#64748b',
    fontSize: 11
  },
  decisionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  decisionBtn: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    gap: 4
  },
  decisionBtnIcon: {
    fontSize: 18
  },
  decisionBtnLabel: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700'
  },
  // DECISIONS LOG
  decisionsLogCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  decisionsLogTitle: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800'
  },
  decisionLogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 10
  },
  decisionLogTypeBox: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  decisionLogTypeText: {
    color: '#92400e',
    fontSize: 11,
    fontWeight: '800'
  },
  decisionLogContent: {
    flex: 1
  },
  decisionLogDesc: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '600'
  },
  decisionLogMeta: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2
  },
  // PROFILE TAB
  profileCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14
  },
  avatarBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#eab308'
  },
  avatarText: {
    color: '#92400e',
    fontSize: 26,
    fontWeight: '800'
  },
  profileNameBox: {
    flex: 1,
    gap: 2
  },
  profileName: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800'
  },
  profileRole: {
    color: '#64748b',
    fontSize: 12
  },
  statusPillActive: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4
  },
  statusPillActiveText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '700'
  },
  profileDetailsList: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
    gap: 10
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4
  },
  profileRowLabel: {
    color: '#64748b',
    fontSize: 12
  },
  profileRowValue: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '700'
  },
  editProfileBtn: {
    backgroundColor: '#f8fafc',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0284c7'
  },
  editProfileBtnText: {
    color: '#0369a1',
    fontSize: 13,
    fontWeight: '700'
  },
  bylawText: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 18
  },
  // BOTTOM NAVIGATION
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4
  },
  navItem: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  navItemActive: {
    backgroundColor: '#fef3c7'
  },
  navIcon: {
    fontSize: 18
  },
  navText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2
  },
  navTextActive: {
    color: '#92400e',
    fontWeight: '800'
  },
  // MODALS
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalBox: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8
  },
  modalTitle: {
    color: '#b45309',
    fontSize: 15,
    fontWeight: '800'
  },
  modalSubtitle: {
    color: '#64748b',
    fontSize: 12
  },
  modalLabel: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  modalRadioGroup: {
    flexDirection: 'row',
    gap: 10
  },
  modalRadioBtn: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  modalRadioActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#eab308'
  },
  modalRadioText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '700'
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f1f5f9'
  },
  modalCancelText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700'
  },
  modalConfirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#059669'
  },
  modalConfirmText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800'
  }
});
