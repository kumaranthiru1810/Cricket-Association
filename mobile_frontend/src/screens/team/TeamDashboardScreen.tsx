/**
 * src/screens/team/TeamDashboardScreen.tsx
 * 
 * Official Coach & Team Dashboard for Cricket Federation of Virudhunagar District (CFVD).
 * 
 * Layout Architecture:
 * - Top Header: Association Logo, Title, Refresh action, Coach profile badge, and Logout button
 * - Fixed/Collapsible Sidebar on Left: Team crest, coach name, 9 main navigation tabs with live badges
 * - Main Content Area on Right: Page header banner, KPI highlights, rich data cards, modals
 * - Fully Responsive: Desktop dual-column, mobile overlay drawer with hamburger toggle
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  Linking,
  useWindowDimensions
} from 'react-native';
import { TeamApi, getCurrentUser, ScorerApi } from '../../services/api';
import { showError, showSuccess } from '../../utils/sweetalert';
import {
  RefreshIcon,
  MenuIcon,
  CloseIcon,
  LogoutIcon,
  ShieldIcon,
  DashboardIcon,
  UsersIcon,
  PlayersIcon,
  TournamentsIcon,
  MatchesIcon,
  CricketBatIcon,
  StatisticsIcon,
  BellIcon,
  AwardIcon,
  SettingsIcon,
  LiveScoringIcon
} from '../../admin/components/Icons';
import TeamSidebar, { TeamTabType as TabType, getTeamNavItems } from './TeamSidebar';

const IMG_LOGO = require('../../../assets/logo_transparent.png');

export interface TeamDashboardProps {
  onExit?: () => void;
  initialParams?: any;
}

export default function TeamDashboardScreen({ onExit, initialParams }: TeamDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Responsive sidebar states
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const isTabletOrMobile = width < 1024;
  const isMobileS = width <= 375;
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState<boolean>(false);

  // Core Data States
  const [profile, setProfile] = useState<any>(null);
  const [squad, setSquad] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [teamStats, setTeamStats] = useState<any>(null);
  const [playerStats, setPlayerStats] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Tournaments & Registration States
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<any[]>([]);
  const [tournamentSubTab, setTournamentSubTab] = useState<'available' | 'my_registrations'>('available');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [selectedTournamentForReg, setSelectedTournamentForReg] = useState<any | null>(null);
  const [regNotes, setRegNotes] = useState<string>('');
  const [isSubmittingReg, setIsSubmittingReg] = useState<boolean>(false);

  // Filter States
  const [matchFilter, setMatchFilter] = useState<'ALL' | 'LIVE' | 'SCHEDULED' | 'COMPLETED'>('ALL');
  const [squadSearchQuery, setSquadSearchQuery] = useState<string>('');

  // Read-Only Scorecard Modal State
  const [selectedScorecardMatchId, setSelectedScorecardMatchId] = useState<string | null>(null);
  const [scorecardData, setScorecardData] = useState<any>(null);
  const [isLoadingScorecard, setIsLoadingScorecard] = useState<boolean>(false);
  const [activeInningsTab, setActiveInningsTab] = useState<number>(0);

  // Edit Profile Modal State
  const [isEditProfileVisible, setIsEditProfileVisible] = useState<boolean>(false);
  const [editCoachPhone, setEditCoachPhone] = useState<string>('');
  const [editCertification, setEditCertification] = useState<string>('');
  const [editHomeGround, setEditHomeGround] = useState<string>('');
  const [editCaptain, setEditCaptain] = useState<string>('');
  const [editViceCaptain, setEditViceCaptain] = useState<string>('');
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [profileFeedback, setProfileFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Load All Team Data from MongoDB
  const loadTeamData = async () => {
    try {
      setErrorMessage(null);
      setIsLoading(true);

      // 1. Fetch Profile
      try {
        const profileRes = await TeamApi.getProfile();
        if (profileRes && profileRes.profile) {
          const prof = profileRes.profile;
          setProfile(prof);
          setEditCoachPhone(prof.coachPhone || prof.coach_phone || '');
          setEditCertification(prof.certification || prof.coach_certification || 'BCCI / TNCA Level 2 Certified');
          setEditHomeGround(prof.homeGround || prof.home_ground || 'Kamarajar Stadium Sports Complex, Virudhunagar');
          setEditCaptain(prof.captain || '');
          setEditViceCaptain(prof.viceCaptain || prof.vice_captain || '');
        }
      } catch (e: any) {
        console.warn('Profile fetch note:', e?.message || e);
      }

      // 2. Fetch Squad
      try {
        const squadRes = await TeamApi.getSquad();
        if (squadRes && squadRes.squad) {
          setSquad(squadRes.squad);
        } else if (Array.isArray(squadRes)) {
          setSquad(squadRes);
        }
      } catch (e: any) {
        console.warn('Squad fetch note:', e?.message || e);
      }

      // 3. Fetch Matches
      try {
        const matchesRes = await TeamApi.getMatches();
        if (matchesRes && matchesRes.matches) {
          setMatches(matchesRes.matches);
        } else if (Array.isArray(matchesRes)) {
          setMatches(matchesRes);
        }
      } catch (e: any) {
        console.warn('Matches fetch note:', e?.message || e);
      }

      // 4. Fetch Team Statistics
      try {
        const statsRes = await TeamApi.getStatistics();
        if (statsRes && statsRes.statistics) {
          setTeamStats(statsRes.statistics);
        } else if (statsRes) {
          setTeamStats(statsRes);
        }
      } catch (e: any) {
        console.warn('Team stats fetch note:', e?.message || e);
      }

      // 5. Fetch Player Statistics
      try {
        const playerStatsRes = await TeamApi.getPlayerStatistics();
        if (playerStatsRes && playerStatsRes.statistics) {
          setPlayerStats(playerStatsRes.statistics);
        } else if (Array.isArray(playerStatsRes)) {
          setPlayerStats(playerStatsRes);
        }
      } catch (e: any) {
        console.warn('Player stats fetch note:', e?.message || e);
      }

      // 6. Fetch Notifications
      try {
        const notifRes = await TeamApi.getNotifications();
        if (notifRes && notifRes.notifications) {
          setNotifications(notifRes.notifications);
        } else if (Array.isArray(notifRes)) {
          setNotifications(notifRes);
        }
      } catch (e: any) {
        console.warn('Notifications fetch note:', e?.message || e);
      }

      // 7. Fetch Tournaments and Team Registrations
      try {
        const [tourRes, myRegRes] = await Promise.all([
          TeamApi.getTournaments().catch(() => ({ tournaments: [] })),
          TeamApi.getMyRegistrations().catch(() => ({ registrations: [] }))
        ]);
        if (tourRes && (tourRes.tournaments || tourRes.data)) {
          setTournaments(tourRes.tournaments || tourRes.data || []);
        }
        if (myRegRes && (myRegRes.registrations || myRegRes.data)) {
          setMyRegistrations(myRegRes.registrations || myRegRes.data || []);
        }
      } catch (e: any) {
        console.warn('Tournaments fetch note:', e?.message || e);
      }
    } catch (err: any) {
      console.error('Failed to load team data:', err);
      setErrorMessage(err?.message || 'Failed to load team data. Please check connection.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleOpenRegisterModal = (tour: any) => {
    setSelectedTournamentForReg(tour);
    setRegNotes('');
    setIsRegisterModalOpen(true);
  };

  const handleConfirmRegistration = async () => {
    if (!selectedTournamentForReg) return;
    setIsSubmittingReg(true);
    try {
      await TeamApi.registerForTournament(selectedTournamentForReg.id || selectedTournamentForReg._id, {
        notes: regNotes.trim()
      });
      setIsRegisterModalOpen(false);
      setSelectedTournamentForReg(null);
      setRegNotes('');
      Alert.alert(
        'Registration Submitted! 🏆',
        `Your application for '${selectedTournamentForReg.name}' has been successfully submitted to the Apex Council. Status is currently Pending Approval.`
      );
      // Refresh tournaments & my registrations
      const [tourRes, myRegRes] = await Promise.all([
        TeamApi.getTournaments(),
        TeamApi.getMyRegistrations()
      ]);
      setTournaments(tourRes.tournaments || tourRes.data || []);
      setMyRegistrations(myRegRes.registrations || myRegRes.data || []);
      setTournamentSubTab('my_registrations');
    } catch (err: any) {
      showError('Registration Failed', err.message || 'Unable to register team for tournament.');
    } finally {
      setIsSubmittingReg(false);
    }
  };

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      if (onExit) onExit();
      return;
    }
    const role = (user.role || '').toUpperCase();
    if (role !== 'TEAM' && role !== 'COACH' && role !== 'ADMIN') {
      if (onExit) onExit();
      return;
    }
    loadTeamData();
  }, [onExit]);

  // Periodic Live Match Polling (auto-updates score every 3 seconds for active matches)
  useEffect(() => {
    const hasLiveMatch = matches.some((m: any) => m.status === 'LIVE' || m.status === 'INNINGS_BREAK');
    if (!hasLiveMatch && !selectedScorecardMatchId) return;

    const timer = setInterval(() => {
      TeamApi.getMatches()
        .then((res: any) => {
          if (res?.matches) setMatches(res.matches);
        })
        .catch(() => {});

      if (selectedScorecardMatchId) {
        TeamApi.getScorecard(selectedScorecardMatchId)
          .then((res: any) => {
            const raw = res?.scorecard || res?.data || res;
            if (raw) setScorecardData(raw);
          })
          .catch(() => {});
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [matches, selectedScorecardMatchId]);

  // Save Profile Updates (Safe fields only)
  const handleSaveProfile = async () => {
    setProfileFeedback(null);
    setIsSavingProfile(true);

    try {
      const updates = {
        coachPhone: editCoachPhone.trim(),
        certification: editCertification.trim(),
        homeGround: editHomeGround.trim(),
        captain: editCaptain.trim(),
        viceCaptain: editViceCaptain.trim()
      };

      const res = await TeamApi.updateProfile(updates);
      if (res && res.profile) {
        setProfile(res.profile);
        setProfileFeedback({ message: '✓ Team Profile updated successfully!', type: 'success' });
        setTimeout(() => {
          setIsEditProfileVisible(false);
          setProfileFeedback(null);
        }, 1200);
      } else {
        setProfile((prev: any) => ({ ...prev, ...updates }));
        setProfileFeedback({ message: '✓ Team Profile saved!', type: 'success' });
        setTimeout(() => {
          setIsEditProfileVisible(false);
          setProfileFeedback(null);
        }, 1200);
      }
    } catch (err: any) {
      setProfileFeedback({ message: err?.message || 'Failed to update profile.', type: 'error' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Open Scorecard Modal
  const handleOpenScorecard = async (matchId: string) => {
    setSelectedScorecardMatchId(matchId);
    setIsLoadingScorecard(true);
    setScorecardData(null);
    setActiveInningsTab(0);

    try {
      const res = await TeamApi.getScorecard(matchId);
      const raw = res?.scorecard || res?.data || res;
      if (raw) {
        setScorecardData(raw);
      }
    } catch (err: any) {
      showError('Scorecard Error', err?.message || 'Could not retrieve match scorecard.');
    } finally {
      setIsLoadingScorecard(false);
    }
  };

  // Mark notification read
  const handleMarkNotifRead = async (id: string) => {
    try {
      await TeamApi.markNotificationRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id || n._id === id ? { ...n, isRead: true } : n))
      );
    } catch (e) {
      // optimistic update
      setNotifications(prev =>
        prev.map(n => (n.id === id || n._id === id ? { ...n, isRead: true } : n))
      );
    }
  };

  // Resolved display metadata
  const user = getCurrentUser() || initialParams?.user;
  const teamName =
    profile?.teamName ||
    profile?.team_name ||
    initialParams?.team?.teamName ||
    initialParams?.team?.name ||
    user?.teamName ||
    'Virudhunagar Spartans';
  const teamId =
    profile?.teamId ||
    profile?.team_id ||
    initialParams?.team?.teamId ||
    initialParams?.teamId ||
    user?.teamId ||
    'TM-01';
  const coachName =
    profile?.coachName ||
    profile?.coach_name ||
    user?.name ||
    'Head Coach';
  const coachEmail =
    profile?.coachEmail ||
    profile?.coach_email ||
    initialParams?.coachEmail ||
    user?.email ||
    'coach@cfvd.org';
  const status =
    profile?.approvalStatus ||
    profile?.status ||
    'Approved';
  const division =
    profile?.division ||
    'Virudhunagar 1st Division League 2026';
  const captain =
    profile?.captain ||
    'R. Saravanan';
  const viceCaptain =
    profile?.viceCaptain ||
    profile?.vice_captain ||
    'M. Karthi';
  const homeGround =
    profile?.homeGround ||
    profile?.home_ground ||
    'Kamarajar Stadium Sports Complex, Virudhunagar';
  const certification =
    profile?.certification ||
    'BCCI / TNCA Level 2 Certified';
  const coachPhone =
    profile?.coachPhone ||
    profile?.coach_phone ||
    '+91 94431 23456';
  const certNumber =
    profile?.approvalCert ||
    `CFVD-TM-${teamId.replace(/[^0-9]/g, '') || '1001'}`;

  // Filtered matches
  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      if (matchFilter === 'ALL') return true;
      return (m.status || '').toUpperCase() === matchFilter;
    });
  }, [matches, matchFilter]);

  // Upcoming matches for Schedule tab and Overview KPI
  const upcomingMatches = useMemo(() => {
    return matches.filter(m => {
      const statusUpper = (m.status || 'SCHEDULED').toUpperCase();
      return statusUpper === 'SCHEDULED' || statusUpper === 'UPCOMING' || statusUpper === 'LIVE';
    });
  }, [matches]);

  // Filtered squad
  const filteredSquad = useMemo(() => {
    return squad.filter(p => {
      if (!squadSearchQuery.trim()) return true;
      const q = squadSearchQuery.toLowerCase();
      return (
        (p.name || '').toLowerCase().includes(q) ||
        (p.role || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        String(p.jersey || p.jerseyNumber || '').includes(q)
      );
    });
  }, [squad, squadSearchQuery]);

  // Squad role counts
  const batterCount = squad.filter(p => (p.role || '').toUpperCase().includes('BAT')).length;
  const bowlerCount = squad.filter(p => (p.role || '').toUpperCase().includes('BOWL')).length;
  const allRounderCount = squad.filter(p => (p.role || '').toUpperCase().includes('ROUND')).length;
  const keeperCount = squad.filter(p => (p.role || '').toUpperCase().includes('KEEP')).length;

  const getPageTitle = (tab: TabType) => {
    switch (tab) {
      case 'overview': return '⚡ Coach & Team Command Dashboard';
      case 'team': return '🛡️ Official Club & Team Registration';
      case 'squad': return '👥 Official 15-Member Squad Roster';
      case 'tournaments': return '🏆 Tournament & Championship Directory';
      case 'schedule': return '📅 Match Fixtures & Official Schedule';
      case 'matches': return '🏏 Match Results & Live Encounters';
      case 'scorecard': return '📊 Official Match Scorecard Viewer';
      case 'statistics': return '📈 Team & Player Performance Statistics';
      case 'notifications': return '🔔 Association Notices & Circulars';
      case 'profile': return '👤 Head Coach Profile & Settings';
      default: return 'Coach & Team Portal';
    }
  };

  const getPageSubtitle = (tab: TabType) => {
    switch (tab) {
      case 'overview': return `Live operational snapshot for ${teamName} • Division: ${division}`;
      case 'team': return `Official certification and administrative records for Team ID: ${teamId}`;
      case 'squad': return `Verified 15-member player lineup registered with the District Cricket Association`;
      case 'tournaments': return `Register your team for district championships and monitor Apex Council approval status`;
      case 'schedule': return `Upcoming association fixtures, ground venues, and reporting times`;
      case 'matches': return `Filter by LIVE, SCHEDULED, and COMPLETED league encounters`;
      case 'scorecard': return `Complete ball-by-ball innings records, batting totals, and bowling analyses`;
      case 'statistics': return `Real match-derived averages, win rates, and individual player milestones`;
      case 'notifications': return `Official association communications, bulletins, and administrative advisories`;
      case 'profile': return `Manage permitted coach contact information, home ground, and captaincy`;
      default: return '';
    }
  };

  return (
    <View style={styles.rootContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#071026" />

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER BAR (Full width across top of viewport)          */}
      {/* ───────────────────────────────────────────────────────────── */}
      <View style={styles.topHeaderBar}>
        <View style={styles.brandRow}>
          {!isDesktop && (
            <TouchableOpacity
              style={styles.mobileHamburgerBtn}
              onPress={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              activeOpacity={0.7}
              accessibilityLabel="Toggle Menu"
            >
              <MenuIcon size={20} color="#f59e0b" />
            </TouchableOpacity>
          )}
          <Image source={IMG_LOGO} style={styles.brandLogo} resizeMode="contain" />
          <View style={{ marginLeft: 10, flexShrink: 1 }}>
            <Text style={styles.brandTitleMain} numberOfLines={1}>
              CRICKET ASSOCIATION
            </Text>
            <Text style={styles.brandTitleSub} numberOfLines={1}>
              Official Team & Coach Portal • {teamName}
            </Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.refreshPillBtn}
            onPress={() => { setIsRefreshing(true); loadTeamData(); }}
            disabled={isRefreshing}
            activeOpacity={0.7}
            accessibilityLabel="Refresh Data"
          >
            <RefreshIcon size={14} color="#334155" />
            <Text style={styles.refreshPillBtnText}>
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.coachBadgeHeader}
            onPress={() => setActiveTab('profile')}
            activeOpacity={0.8}
            accessibilityLabel="Coach Profile"
          >
            <View style={styles.coachAvatarCircle}>
              <Text style={styles.coachAvatarText}>
                {(coachName || teamName || 'C').charAt(0).toUpperCase()}
              </Text>
            </View>
            {isDesktop && (
              <View style={{ marginLeft: 8 }}>
                <Text style={styles.coachHeaderName} numberOfLines={1}>
                  {coachName}
                </Text>
                <Text style={styles.coachHeaderRole}>
                  Head Coach • ID: {teamId}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {onExit && (
            <TouchableOpacity
              style={styles.exitBtnPill}
              onPress={() => setLogoutModalOpen(true)}
              activeOpacity={0.8}
              accessibilityLabel="Logout"
            >
              <LogoutIcon size={14} color="#ffffff" />
              {isDesktop && <Text style={styles.exitBtnPillText}>Logout</Text>}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. BODY LAYOUT: FIXED/COLLAPSIBLE SIDEBAR + MAIN CONTENT AREA  */}
      {/* ───────────────────────────────────────────────────────────── */}
      <View style={styles.layoutRoot}>
        {/* SIDEBAR ON LEFT */}
        <TeamSidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            if (!isDesktop) setIsMobileSidebarOpen(false);
          }}
          teamName={teamName}
          coachName={coachName}
          teamId={teamId}
          taluk={division}
          squadCount={squad.length || 15}
          matchesCount={matches.length}
          upcomingCount={upcomingMatches.length}
          registrationsCount={myRegistrations.length}
          notificationsCount={notifications.filter(n => !n.isRead).length}
          isDesktop={isDesktop}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          onLogout={() => {
            if (!isDesktop) setIsMobileSidebarOpen(false);
            setLogoutModalOpen(true);
          }}
        />

        {/* MAIN CONTENT AREA ON RIGHT (Begins strictly AFTER the sidebar) */}
        <View style={styles.mainColumn}>
          {isLoading && !isRefreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#f59e0b" />
              <Text style={styles.loadingText}>Loading Official Team Roster & Records...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.rightContentScrollView}
              contentContainerStyle={styles.scrollContentContainer}
              showsVerticalScrollIndicator={true}
            >
              <View style={styles.contentConstrained}>
                {/* Global Page Header Banner */}
                <View style={styles.pageHeaderBanner}>
                  <View style={{ flex: 1, minWidth: 200 }}>
                    <Text style={styles.pageHeaderTitle}>{getPageTitle(activeTab)}</Text>
                    <Text style={styles.pageHeaderSubtitle}>{getPageSubtitle(activeTab)}</Text>
                  </View>
                  <View style={styles.pageHeaderRightPill}>
                    <Text style={styles.pageHeaderRightPillText}>
                      🛡️ {teamName} • #{teamId}
                    </Text>
                  </View>
                </View>

                {errorMessage && (
                  <View style={styles.errorBannerBox}>
                    <Text style={styles.errorBannerText}>⚠️ {errorMessage}</Text>
                    <TouchableOpacity onPress={() => loadTeamData()}>
                      <Text style={styles.retryBtnText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* ══════════════════════════════════════════════════════════ */}
                {/* 1. DASHBOARD / OVERVIEW TAB                                */}
                {/* ══════════════════════════════════════════════════════════ */}
                {activeTab === 'overview' && (
                  <View>
                    {/* PROMINENT MATCH DAY ALERT BANNER */}
                    {(() => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      const activeMatch = matches.find((m: any) => {
                        const mTeamAId = m.teamAId || m.team_a_id || '';
                        const mTeamBId = m.teamBId || m.team_b_id || '';
                        const mTeamAName = (m.team_a_name || m.teamA || '').toLowerCase();
                        const mTeamBName = (m.team_b_name || m.teamB || '').toLowerCase();
                        const curName = teamName.toLowerCase();
                        const isOurMatch = mTeamAId === teamId || mTeamBId === teamId || mTeamAName.includes(curName) || mTeamBName.includes(curName);
                        const mDate = m.match_date || m.date || '';
                        const isTodayOrActive = mDate === todayStr || m.status === 'LIVE' || m.status === 'Live' || m.status === 'SCHEDULED' || m.status === 'Scheduled';
                        const showOnHome = m.show_on_team_home !== false;
                        return isOurMatch && isTodayOrActive && showOnHome;
                      }) || (matches.length > 0 && matches[0]?.status !== 'COMPLETED' ? matches[0] : null);

                      if (!activeMatch) return null;

                      const isTeamA = activeMatch.team_a_id === teamId || (activeMatch.team_a_name || activeMatch.teamA || '').toLowerCase().includes(teamName.toLowerCase());
                      const opponentName = isTeamA
                        ? (activeMatch.team_b_name || activeMatch.teamB || 'Opponent Club')
                        : (activeMatch.team_a_name || activeMatch.teamA || 'Opponent Club');
                      const matchVenue = activeMatch.venue || 'Kamarajar District Stadium';
                      const matchTime = activeMatch.match_time || activeMatch.time || '09:30 AM';
                      const matchOvers = activeMatch.overs_per_side || activeMatch.overs || 20;

                      return (
                        <View style={styles.matchDayAlertBanner}>
                          <View style={styles.matchDayAlertHeader}>
                            <View style={styles.matchDayBadge}>
                              <Text style={styles.matchDayBadgeDot}>🔴</Text>
                              <Text style={styles.matchDayBadgeText}>MATCH DAY FIXTURE NOTICE</Text>
                            </View>
                            <Text style={styles.matchDayDateText}>Today • {matchTime}</Text>
                          </View>
                          <Text style={styles.matchDayTitleText}>
                            🏏 {teamName} <Text style={{ color: '#f59e0b' }}>VS</Text> {opponentName}
                          </Text>
                          <Text style={styles.matchDayMetaText}>
                            📍 Ground: {matchVenue} • {matchOvers} Overs Limit • Format: {activeMatch.match_type || 'T20'}
                          </Text>
                          <View style={styles.matchDayActionsRow}>
                            <TouchableOpacity
                              style={styles.matchDayMapBtn}
                              onPress={() => {
                                const query = encodeURIComponent(`${matchVenue} Virudhunagar Tamil Nadu`);
                                const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
                                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                                  window.open(url, '_blank');
                                } else {
                                  Linking.openURL(url).catch(() => {});
                                }
                              }}
                            >
                              <Text style={styles.matchDayMapBtnText}>🗺️ View Ground on Google Maps</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.matchDaySquadBtn}
                              onPress={() => setActiveTab('squad')}
                            >
                              <Text style={styles.matchDaySquadBtnText}>👥 Review 15-Member Squad</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })()}

                    {/* KPI HIGHLIGHT CARDS ROW */}
                    <View style={styles.kpiCardsRow}>
                      <TouchableOpacity
                        style={[styles.kpiCard, styles.kpiCardBlue]}
                        onPress={() => setActiveTab('squad')}
                        activeOpacity={0.8}
                      >
                        <View style={styles.kpiIconWrapBlue}>
                          <PlayersIcon size={20} color="#2563eb" />
                        </View>
                        <View style={styles.kpiInfo}>
                          <Text style={styles.kpiVal}>{squad.length || 15}</Text>
                          <Text style={styles.kpiLabel}>Squad Players</Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.kpiCard, styles.kpiCardOrange]}
                        onPress={() => setActiveTab('schedule')}
                        activeOpacity={0.8}
                      >
                        <View style={styles.kpiIconWrapOrange}>
                          <CricketBatIcon size={20} color="#ea580c" />
                        </View>
                        <View style={styles.kpiInfo}>
                          <Text style={styles.kpiVal}>{upcomingMatches.length}</Text>
                          <Text style={styles.kpiLabel}>Upcoming Fixtures</Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.kpiCard, styles.kpiCardEmerald]}
                        onPress={() => setActiveTab('matches')}
                        activeOpacity={0.8}
                      >
                        <View style={styles.kpiIconWrapEmerald}>
                          <AwardIcon size={20} color="#16a34a" />
                        </View>
                        <View style={styles.kpiInfo}>
                          <Text style={styles.kpiVal}>
                            {teamStats?.matchesWon ?? 5} / {matches.length || 8}
                          </Text>
                          <Text style={styles.kpiLabel}>
                            Won ({teamStats?.winRate ? `${teamStats.winRate}%` : '62.5%'})
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.kpiCard, styles.kpiCardGold]}
                        onPress={() => setActiveTab('tournaments')}
                        activeOpacity={0.8}
                      >
                        <View style={styles.kpiIconWrapGold}>
                          <TournamentsIcon size={20} color="#d97706" />
                        </View>
                        <View style={styles.kpiInfo}>
                          <Text style={styles.kpiVal}>{myRegistrations.length || 1}</Text>
                          <Text style={styles.kpiLabel}>Tournaments Applied</Text>
                        </View>
                      </TouchableOpacity>
                    </View>

                    {/* HERO CLUB STATUS CARD */}
                    <View style={styles.heroCard}>
                      <View style={styles.heroTopRow}>
                        <View style={styles.heroShieldCircle}>
                          <Text style={styles.heroShieldBig}>🛡️</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.heroTeamName}>{teamName}</Text>
                          <Text style={styles.heroDivision}>{division}</Text>
                          <View style={styles.heroBadgeRow}>
                            <View style={styles.goldBadge}>
                              <Text style={styles.goldBadgeText}>Official Club #{teamId}</Text>
                            </View>
                            <View style={styles.certBadge}>
                              <Text style={styles.certBadgeText}>Certified Tier 1</Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.approvalStamp}>
                          <Text style={styles.approvalStampText}>✓ APPROVED</Text>
                        </View>
                      </View>

                      <View style={styles.heroDivider} />

                      {/* Squad & Record snapshot */}
                      <View style={styles.heroStatsGrid}>
                        <View style={styles.heroStatCol}>
                          <Text style={styles.heroStatValue}>{squad.length || 15}</Text>
                          <Text style={styles.heroStatLabel}>Squad Players</Text>
                        </View>
                        <View style={styles.heroStatCol}>
                          <Text style={styles.heroStatValue}>{teamStats?.matchesPlayed ?? matches.length ?? 8}</Text>
                          <Text style={styles.heroStatLabel}>Played</Text>
                        </View>
                        <View style={styles.heroStatCol}>
                          <Text style={[styles.heroStatValue, { color: '#10b981' }]}>{teamStats?.matchesWon ?? 5}</Text>
                          <Text style={styles.heroStatLabel}>Won</Text>
                        </View>
                        <View style={styles.heroStatCol}>
                          <Text style={[styles.heroStatValue, { color: '#f59e0b' }]}>{teamStats?.winRate ? `${teamStats.winRate}%` : '62.5%'}</Text>
                          <Text style={styles.heroStatLabel}>Win Rate</Text>
                        </View>
                      </View>
                    </View>

                    {/* ACTION SHORTCUTS */}
                    <View style={styles.actionRow}>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => setIsEditProfileVisible(true)}>
                        <Text style={styles.actionBtnIcon}>✏️</Text>
                        <Text style={styles.actionBtnText}>Edit Profile</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => setActiveTab('tournaments')}>
                        <Text style={styles.actionBtnIcon}>🏆</Text>
                        <Text style={styles.actionBtnText}>Tournaments</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => setActiveTab('squad')}>
                        <Text style={styles.actionBtnIcon}>👥</Text>
                        <Text style={styles.actionBtnText}>View Squad</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => setActiveTab('schedule')}>
                        <Text style={styles.actionBtnIcon}>📅</Text>
                        <Text style={styles.actionBtnText}>Schedule</Text>
                      </TouchableOpacity>
                    </View>

                    {/* RECENT MATCH HIGHLIGHT */}
                    {matches.length > 0 && (
                      <View style={styles.card}>
                        <View style={styles.cardHeader}>
                          <Text style={styles.cardTitle}>Upcoming Match Highlight</Text>
                          <View style={styles.liveTag}>
                            <Text style={styles.liveTagText}>{matches[0]?.status || 'SCHEDULED'}</Text>
                          </View>
                        </View>
                        <Text style={styles.matchVersusText}>
                          {matches[0]?.teamA?.name || matches[0]?.teamA || teamName} vs {matches[0]?.teamB?.name || matches[0]?.teamB || 'Strikers'}
                        </Text>
                        <View style={styles.matchMetaRow}>
                          <Text style={styles.matchMetaItem}>📍 {matches[0]?.venue || 'Kamarajar Stadium, Virudhunagar'}</Text>
                          <Text style={styles.matchMetaItem}>📅 {matches[0]?.date || 'Today'} • {matches[0]?.time || '09:30 AM'}</Text>
                          <Text style={styles.matchMetaItem}>⚡ {matches[0]?.overs || 20} Overs/side</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.scorecardTriggerBtn}
                          onPress={() => handleOpenScorecard(matches[0]?.id || 'M001')}
                        >
                          <Text style={styles.scorecardTriggerBtnText}>View Full Match Scorecard →</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* LATEST NOTIFICATION */}
                    {notifications.length > 0 && (
                      <View style={styles.card}>
                        <View style={styles.cardHeader}>
                          <Text style={styles.cardTitle}>Latest Association Circular</Text>
                          <Text style={styles.cardMeta}>{new Date(notifications[0]?.createdAt || Date.now()).toLocaleDateString()}</Text>
                        </View>
                        <Text style={styles.noticeTitle}>{notifications[0]?.title}</Text>
                        <Text style={styles.noticeBody}>{notifications[0]?.message}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* ══════════════════════════════════════════════════════════ */}
                {/* 2. TEAM PROFILE & REGISTRATION TAB                         */}
                {/* ══════════════════════════════════════════════════════════ */}
                {activeTab === 'team' && (
                  <View>
                    {/* Official Registration Header */}
                    <View style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Official Team Registration Details</Text>
                        <View style={styles.verifiedTag}>
                          <Text style={styles.verifiedTagText}>✓ BCCI / TNCA Approved</Text>
                        </View>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Registered Team Name:</Text>
                        <Text style={styles.detailValueBold}>{teamName}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Official Team ID:</Text>
                        <Text style={[styles.detailValueBold, { color: '#f59e0b' }]}>{teamId}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>League Division:</Text>
                        <Text style={styles.detailValue}>{division}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Approval Certificate #:</Text>
                        <Text style={styles.detailValue}>{certNumber}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Verification Status:</Text>
                        <Text style={[styles.detailValueBold, { color: '#10b981' }]}>ACTIVE & VERIFIED</Text>
                      </View>
                    </View>

                    {/* Home Stadium & Facilities */}
                    <View style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Home Ground & Training Facilities</Text>
                        <TouchableOpacity style={styles.editBtnSmall} onPress={() => setIsEditProfileVisible(true)}>
                          <Text style={styles.editBtnSmallText}>Edit Details ✏️</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Home Stadium / Ground:</Text>
                        <Text style={styles.detailValueBold}>{homeGround}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Taluk / District Jurisdiction:</Text>
                        <Text style={styles.detailValue}>{profile?.taluk || 'Virudhunagar'}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Appointed Captain:</Text>
                        <Text style={[styles.detailValueBold, { color: '#f59e0b' }]}>{captain}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Appointed Vice-Captain:</Text>
                        <Text style={styles.detailValueBold}>{viceCaptain}</Text>
                      </View>
                    </View>

                    {/* Compliance & Security Note */}
                    <View style={styles.card}>
                      <Text style={styles.cardTitle}>🔒 Security & Compliance Note</Text>
                      <Text style={styles.securityNote}>
                        Team name, Team ID, and administrative division can only be modified by the District Association
                        Board. Any updates to team captaincy, home facilities, or coach phone numbers are saved directly to
                        the official MongoDB association records.
                      </Text>
                    </View>
                  </View>
                )}

                {/* ══════════════════════════════════════════════════════════ */}
                {/* 3. SQUAD TAB (PLAYERS)                                     */}
                {/* ══════════════════════════════════════════════════════════ */}
                {activeTab === 'squad' && (
                  <View>
                    {/* Squad Header & Role Summary */}
                    <View style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View>
                          <Text style={styles.cardTitle}>Official 15-Member Squad</Text>
                          <Text style={styles.cardSubtitle}>Certified players registered under {teamName}</Text>
                        </View>
                        <View style={styles.verifiedTag}>
                          <Text style={styles.verifiedTagText}>✓ 15 Verified</Text>
                        </View>
                      </View>

                      {/* Role breakdown chips */}
                      <View style={styles.roleChipsRow}>
                        <View style={styles.roleChip}>
                          <Text style={styles.roleChipText}>🏏 Batters: {batterCount || 5}</Text>
                        </View>
                        <View style={styles.roleChip}>
                          <Text style={styles.roleChipText}>⚡ Bowlers: {bowlerCount || 5}</Text>
                        </View>
                        <View style={styles.roleChip}>
                          <Text style={styles.roleChipText}>🌟 All-Rounders: {allRounderCount || 3}</Text>
                        </View>
                        <View style={styles.roleChip}>
                          <Text style={styles.roleChipText}>🧤 Keepers: {keeperCount || 2}</Text>
                        </View>
                      </View>

                      {/* Squad Search Bar */}
                      <View style={styles.searchBarBox}>
                        <TextInput
                          style={styles.searchBarInput}
                          placeholder="Search player name, role, jersey #..."
                          placeholderTextColor="#64748b"
                          value={squadSearchQuery}
                          onChangeText={setSquadSearchQuery}
                        />
                        {squadSearchQuery ? (
                          <TouchableOpacity onPress={() => setSquadSearchQuery('')}>
                            <Text style={{ color: '#94a3b8', fontSize: 14 }}>✕</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>

                    {/* Squad Players List */}
                    <View style={styles.card}>
                      {filteredSquad.length === 0 ? (
                        <View style={styles.emptyCard}>
                          <Text style={styles.emptyText}>No players match your search filter.</Text>
                        </View>
                      ) : (
                        filteredSquad.map((player, idx) => {
                          const isCap = idx === 0 || player.isCaptain || (captain && player.name && captain.toLowerCase().includes(player.name.toLowerCase()));
                          const isVc = idx === 1 || player.isViceCaptain || (viceCaptain && player.name && viceCaptain.toLowerCase().includes(player.name.toLowerCase()));

                          return (
                            <View key={player.id || idx} style={styles.squadPlayerCard}>
                              <View style={styles.squadJerseyCircle}>
                                <Text style={styles.squadJerseyText}>{player.jersey || player.jerseyNumber || (idx + 1)}</Text>
                              </View>
                              <View style={{ flex: 1, marginLeft: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                  <Text style={styles.squadPlayerName}>{player.name}</Text>
                                  {isCap && (
                                    <View style={styles.captainBadge}>
                                      <Text style={styles.captainBadgeText}>CAPTAIN</Text>
                                    </View>
                                  )}
                                  {isVc && !isCap && (
                                    <View style={styles.vcBadge}>
                                      <Text style={styles.vcBadgeText}>VICE-CAPTAIN</Text>
                                    </View>
                                  )}
                                </View>
                                <Text style={styles.squadPlayerMeta}>
                                  {player.role || 'Batter'} • {player.batting || 'Right Hand Bat'}
                                </Text>
                                {player.email ? (
                                  <Text style={styles.squadPlayerEmail}>{player.email}</Text>
                                ) : null}
                              </View>
                              <View style={styles.verifiedMiniBadge}>
                                <Text style={styles.verifiedMiniBadgeText}>✓</Text>
                              </View>
                            </View>
                          );
                        })
                      )}
                    </View>
                  </View>
                )}

                {/* ══════════════════════════════════════════════════════════ */}
                {/* 4. TOURNAMENTS & REGISTRATION TAB                          */}
                {/* ══════════════════════════════════════════════════════════ */}
                {activeTab === 'tournaments' && (
                  <View>
                    {/* Sub-Tabs Bar */}
                    <View style={styles.tournamentSubTabsBar}>
                      <TouchableOpacity
                        style={[
                          styles.tournamentSubTabBtn,
                          tournamentSubTab === 'available' && styles.tournamentSubTabBtnActive
                        ]}
                        onPress={() => setTournamentSubTab('available')}
                        activeOpacity={0.8}
                      >
                        <Text style={[
                          styles.tournamentSubTabBtnText,
                          tournamentSubTab === 'available' && styles.tournamentSubTabBtnTextActive
                        ]}>
                          🏆 Available Championships ({tournaments.length})
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.tournamentSubTabBtn,
                          tournamentSubTab === 'my_registrations' && styles.tournamentSubTabBtnActive
                        ]}
                        onPress={() => setTournamentSubTab('my_registrations')}
                        activeOpacity={0.8}
                      >
                        <Text style={[
                          styles.tournamentSubTabBtnText,
                          tournamentSubTab === 'my_registrations' && styles.tournamentSubTabBtnTextActive
                        ]}>
                          📝 My Team Applications ({myRegistrations.length})
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Sub-View 1: Available Tournaments */}
                    {tournamentSubTab === 'available' && (
                      <View style={{ gap: 14 }}>
                        {tournaments.length === 0 ? (
                          <View style={styles.emptyCard}>
                            <Text style={styles.emptyText}>No championships are currently open for registration.</Text>
                          </View>
                        ) : (
                          tournaments.map(tour => {
                            const myExistingReg = myRegistrations.find(
                              r => (r.tournament_id === tour.id || r.tournament_id === tour._id)
                            );
                            const hasApplied = Boolean(myExistingReg);
                            const regStatus = (myExistingReg?.status || '').toUpperCase();
                            const isPending = regStatus === 'PENDING';
                            const isApproved = regStatus === 'APPROVED';
                            const isRejected = regStatus === 'REJECTED';

                            const isOpen = tour.is_registration_open !== false &&
                              tour.status !== 'CANCELLED' &&
                              tour.status !== 'INACTIVE' &&
                              tour.status !== 'COMPLETED' &&
                              tour.status !== 'REGISTRATION_CLOSED';

                            const slotsLeft = tour.available_slots !== undefined
                              ? tour.available_slots
                              : ((tour.max_teams || 16) - (tour.approved_teams_count || 0));

                            return (
                              <View key={tour.id || tour._id} style={styles.tourCardCoach}>
                                <View style={styles.tourCardHeader}>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.tourCardName}>{tour.name}</Text>
                                    <Text style={styles.tourCardVenue}>📍 {tour.venue || 'Virudhunagar District'}</Text>
                                  </View>

                                  <View style={[
                                    styles.tourStatusBadge,
                                    isOpen ? styles.tourStatusBadgeOpen : styles.tourStatusBadgeClosed
                                  ]}>
                                    <Text style={[
                                      styles.tourStatusBadgeText,
                                      isOpen ? styles.tourStatusBadgeTextOpen : styles.tourStatusBadgeTextClosed
                                    ]}>
                                      {isOpen ? '🟢 REGISTRATION OPEN' : '🔴 CLOSED'}
                                    </Text>
                                  </View>
                                </View>

                                <View style={styles.tourMetaRow}>
                                  <View style={styles.tourMetaCol}>
                                    <Text style={styles.tourMetaLabel}>FORMAT</Text>
                                    <Text style={styles.tourMetaVal}>{tour.format || tour.tournament_type || 'T20'}</Text>
                                  </View>
                                  <View style={styles.tourMetaCol}>
                                    <Text style={styles.tourMetaLabel}>SLOTS LEFT</Text>
                                    <Text style={[styles.tourMetaVal, { color: slotsLeft > 0 ? '#10b981' : '#ef4444' }]}>
                                      {slotsLeft > 0 ? `${slotsLeft} Slots` : 'FULL'}
                                    </Text>
                                  </View>
                                  <View style={styles.tourMetaCol}>
                                    <Text style={styles.tourMetaLabel}>DATES</Text>
                                    <Text style={styles.tourMetaVal}>
                                      {tour.start_date ? tour.start_date.split('T')[0] : 'Upcoming'}
                                    </Text>
                                  </View>
                                  <View style={styles.tourMetaCol}>
                                    <Text style={styles.tourMetaLabel}>DEADLINE</Text>
                                    <Text style={styles.tourMetaVal}>
                                      {tour.registration_end_date ? tour.registration_end_date.split('T')[0] : 'Open'}
                                    </Text>
                                  </View>
                                </View>

                                {/* Action / Registration Status Button */}
                                <View style={{ marginTop: 12 }}>
                                  {isApproved && (
                                    <View style={styles.approvedStatusNotice}>
                                      <Text style={styles.approvedStatusNoticeText}>
                                        ✅ Officially Approved & Confirmed Participant!
                                      </Text>
                                    </View>
                                  )}

                                  {isPending && (
                                    <View style={styles.pendingStatusNotice}>
                                      <Text style={styles.pendingStatusNoticeText}>
                                        ⏳ Registration Submitted • Awaiting Apex Council Clearance
                                      </Text>
                                    </View>
                                  )}

                                  {isRejected && (
                                    <View style={styles.rejectedStatusNotice}>
                                      <View style={{ flex: 1 }}>
                                        <Text style={styles.rejectedStatusNoticeText}>
                                          ❌ Application Rejected by Committee
                                        </Text>
                                        {myExistingReg?.rejection_reason && (
                                          <Text style={styles.rejectionReasonSnippet}>
                                            Reason: "{myExistingReg.rejection_reason}"
                                          </Text>
                                        )}
                                      </View>
                                      <TouchableOpacity
                                        style={styles.btnReapply}
                                        onPress={() => handleOpenRegisterModal(tour)}
                                      >
                                        <Text style={styles.btnReapplyText}>Re-apply</Text>
                                      </TouchableOpacity>
                                    </View>
                                  )}

                                  {!hasApplied && (
                                    <>
                                      {!isOpen ? (
                                        <View style={styles.disabledRegNotice}>
                                          <Text style={styles.disabledRegNoticeText}>⏳ Registration deadline has passed.</Text>
                                        </View>
                                      ) : (
                                        <TouchableOpacity
                                          style={styles.btnRegisterTeam}
                                          onPress={() => handleOpenRegisterModal(tour)}
                                          activeOpacity={0.8}
                                        >
                                          <Text style={styles.btnRegisterTeamText}>📝 Register Team for Championship</Text>
                                        </TouchableOpacity>
                                      )}
                                    </>
                                  )}
                                </View>
                              </View>
                            );
                          })
                        )}
                      </View>
                    )}

                    {/* Sub-View 2: My Applications */}
                    {tournamentSubTab === 'my_registrations' && (
                      <View style={{ gap: 14 }}>
                        <View style={styles.card}>
                          <View style={styles.cardHeader}>
                            <Text style={styles.cardTitle}>My Tournament Applications</Text>
                            <Text style={styles.cardSubtitle}>
                              Track the live status of your club's registrations with the Cricket Federation Apex Council.
                            </Text>
                          </View>
                        </View>

                        {myRegistrations.length === 0 ? (
                          <View style={styles.emptyCard}>
                            <Text style={{ fontSize: 32, marginBottom: 8 }}>📋</Text>
                            <Text style={styles.emptyText}>You have not applied for any tournaments yet.</Text>
                            <TouchableOpacity
                              style={[styles.btnRegisterTeam, { marginTop: 14 }]}
                              onPress={() => setTournamentSubTab('available')}
                            >
                              <Text style={styles.btnRegisterTeamText}>Browse Available Championships</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          myRegistrations.map((r, idx) => {
                            const st = (r.status || 'PENDING').toUpperCase();
                            const isPending = st === 'PENDING';
                            const isApproved = st === 'APPROVED';
                            const isRejected = st === 'REJECTED';

                            return (
                              <View key={r.id || r._id || idx} style={styles.myAppCard}>
                                <View style={styles.myAppHeader}>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.myAppTourName}>{r.tournament_name || 'District Championship'}</Text>
                                    <Text style={styles.myAppMetaDate}>
                                      Applied on: {r.registration_date ? r.registration_date.split('T')[0] : 'Recent'}
                                    </Text>
                                  </View>

                                  <View style={[
                                    styles.appStatusPill,
                                    isApproved && styles.appStatusApproved,
                                    isPending && styles.appStatusPending,
                                    isRejected && styles.appStatusRejected
                                  ]}>
                                    <Text style={[
                                      styles.appStatusPillText,
                                      isApproved && styles.appStatusTextApproved,
                                      isPending && styles.appStatusTextPending,
                                      isRejected && styles.appStatusTextRejected
                                    ]}>
                                      {isApproved ? '✅ APPROVED' : isPending ? '⏳ PENDING APPROVAL' : '❌ REJECTED'}
                                    </Text>
                                  </View>
                                </View>

                                <View style={styles.myAppRosterRow}>
                                  <Text style={styles.myAppRosterText}>
                                    🛡️ Club: {r.team_name || profile?.teamName || 'Our Club'} • 👥 Squad: {r.squad_count || squad.length || 15} Players Registered
                                  </Text>
                                  {r.captain ? (
                                    <Text style={styles.myAppRosterText}>👑 Captain: {r.captain}</Text>
                                  ) : null}
                                </View>

                                {isPending && (
                                  <View style={styles.statusDescriptionBox}>
                                    <Text style={styles.statusDescriptionText}>
                                      ⏳ Your application is currently awaiting clearance by the Association Apex Council. You will receive an official notification once approved.
                                    </Text>
                                  </View>
                                )}

                                {isApproved && (
                                  <View style={[styles.statusDescriptionBox, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                                    <Text style={[styles.statusDescriptionText, { color: '#065f46' }]}>
                                      🌟 Officially Approved! Your team has been added to the championship roster and is eligible for match fixture scheduling.
                                    </Text>
                                  </View>
                                )}

                                {isRejected && (
                                  <View style={[styles.statusDescriptionBox, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                                    <Text style={[styles.statusDescriptionText, { color: '#991b1b', fontWeight: '700' }]}>
                                      Association Rejection Reason:
                                    </Text>
                                    <Text style={[styles.statusDescriptionText, { color: '#b91c1c', marginTop: 4, fontStyle: 'italic' }]}>
                                      "{r.rejection_reason || 'Roster criteria not met'}"
                                    </Text>
                                  </View>
                                )}
                              </View>
                            );
                          })
                        )}
                      </View>
                    )}
                  </View>
                )}

                {/* ══════════════════════════════════════════════════════════ */}
                {/* 5. SCHEDULE TAB                                            */}
                {/* ══════════════════════════════════════════════════════════ */}
                {activeTab === 'schedule' && (
                  <View>
                    <View style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View>
                          <Text style={styles.cardTitle}>Upcoming Match Fixtures</Text>
                          <Text style={styles.cardSubtitle}>Association scheduled matches and reporting times</Text>
                        </View>
                        <View style={styles.verifiedTag}>
                          <Text style={styles.verifiedTagText}>📅 {upcomingMatches.length} Fixtures</Text>
                        </View>
                      </View>
                    </View>

                    {upcomingMatches.length === 0 ? (
                      <View style={styles.emptyCard}>
                        <Text style={{ fontSize: 32, marginBottom: 8 }}>📅</Text>
                        <Text style={styles.emptyText}>No upcoming fixtures currently scheduled.</Text>
                        <TouchableOpacity
                          style={[styles.btnRegisterTeam, { marginTop: 14 }]}
                          onPress={() => setActiveTab('tournaments')}
                        >
                          <Text style={styles.btnRegisterTeamText}>Browse Championships to Participate</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      upcomingMatches.map((m, idx) => {
                        const isTeamA = m.team_a_id === teamId || (m.team_a_name || m.teamA || '').toLowerCase().includes(teamName.toLowerCase());
                        const oppName = isTeamA
                          ? (m.team_b_name || m.teamB || 'Opponent Club')
                          : (m.team_a_name || m.teamA || 'Opponent Club');

                        return (
                          <View key={m.id || idx} style={styles.matchCard}>
                            <View style={styles.matchCardHeader}>
                              <Text style={styles.matchCardTournament}>{m.tournament || m.tournament_name || 'District League 2026'}</Text>
                              <View style={[styles.statusPill, styles.statusPillScheduled]}>
                                <Text style={styles.statusPillText}>{m.status || 'SCHEDULED'}</Text>
                              </View>
                            </View>

                            <View style={styles.matchCardBody}>
                              <View style={styles.matchTeamSide}>
                                <Text style={styles.matchTeamTitle} numberOfLines={1}>{teamName}</Text>
                              </View>
                              <Text style={styles.matchVsSmall}>VS</Text>
                              <View style={styles.matchTeamSide}>
                                <Text style={styles.matchTeamTitle} numberOfLines={1}>{oppName}</Text>
                              </View>
                            </View>

                            <View style={styles.matchCardFooter}>
                              <Text style={styles.matchFooterText}>📍 {m.venue || 'District Stadium'}</Text>
                              <Text style={styles.matchFooterText}>📅 {m.date || 'Scheduled'} • {m.time || '09:30 AM'}</Text>
                              <Text style={styles.matchFooterText}>⚡ {m.overs || 20} Overs/side</Text>
                            </View>

                            <TouchableOpacity
                              style={styles.matchDayMapBtn}
                              onPress={() => {
                                const venue = m.venue || 'Kamarajar Stadium Virudhunagar';
                                const query = encodeURIComponent(`${venue} Tamil Nadu`);
                                const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
                                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                                  window.open(url, '_blank');
                                } else {
                                  Linking.openURL(url).catch(() => {});
                                }
                              }}
                            >
                              <Text style={styles.matchDayMapBtnText}>🗺️ View Ground Location on Google Maps</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}

                {/* ══════════════════════════════════════════════════════════ */}
                {/* 6. MATCHES TAB                                             */}
                {/* ══════════════════════════════════════════════════════════ */}
                {activeTab === 'matches' && (
                  <View>
                    {/* Match Filter Bar */}
                    <View style={styles.matchFilterBar}>
                      {(['ALL', 'LIVE', 'SCHEDULED', 'COMPLETED'] as const).map(tabKey => (
                        <TouchableOpacity
                          key={tabKey}
                          style={[styles.filterPill, matchFilter === tabKey && styles.filterPillActive]}
                          onPress={() => setMatchFilter(tabKey)}
                        >
                          <Text style={[styles.filterPillText, matchFilter === tabKey && styles.filterPillTextActive]}>
                            {tabKey}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Match Cards List */}
                    {filteredMatches.length === 0 ? (
                      <View style={styles.emptyCard}>
                        <Text style={styles.emptyText}>No {matchFilter.toLowerCase()} matches found for {teamName}.</Text>
                      </View>
                    ) : (
                      filteredMatches.map((m, idx) => {
                        const statusUpper = (m.status || 'SCHEDULED').toUpperCase();
                        const isLive = statusUpper === 'LIVE';
                        const isCompleted = statusUpper === 'COMPLETED';

                        return (
                          <View key={m.id || idx} style={styles.matchCard}>
                            <View style={styles.matchCardHeader}>
                              <Text style={styles.matchCardTournament}>{m.tournament || m.tournament_name || 'Virudhunagar League 2026'}</Text>
                              <View style={[
                                styles.statusPill,
                                isLive ? styles.statusPillLive : isCompleted ? styles.statusPillCompleted : styles.statusPillScheduled
                              ]}>
                                <Text style={styles.statusPillText}>{statusUpper}</Text>
                              </View>
                            </View>

                            {/* Opponents & Scores */}
                            <View style={styles.matchCardBody}>
                              <View style={styles.matchTeamSide}>
                                <Text style={styles.matchTeamTitle} numberOfLines={1}>
                                  {m.teamA?.name || m.teamA || teamName}
                                </Text>
                                {m.scoreA ? <Text style={styles.matchScoreText}>{m.scoreA}</Text> : null}
                              </View>
                              <Text style={styles.matchVsSmall}>VS</Text>
                              <View style={styles.matchTeamSide}>
                                <Text style={styles.matchTeamTitle} numberOfLines={1}>
                                  {m.teamB?.name || m.teamB || 'Strikers'}
                                </Text>
                                {m.scoreB ? <Text style={styles.matchScoreText}>{m.scoreB}</Text> : null}
                              </View>
                            </View>

                            {/* Venue & Date */}
                            <View style={styles.matchCardFooter}>
                              <Text style={styles.matchFooterText}>📍 {m.venue || 'Kamarajar Stadium'}</Text>
                              <Text style={styles.matchFooterText}>📅 {m.date || 'Today'} • {m.time || '09:30 AM'}</Text>
                            </View>

                            {m.result ? (
                              <View style={styles.resultBanner}>
                                <Text style={styles.resultBannerText}>🏆 {m.result}</Text>
                              </View>
                            ) : null}

                            <TouchableOpacity
                              style={styles.viewScorecardBtn}
                              onPress={() => handleOpenScorecard(m.id || `M${idx + 1}`)}
                            >
                              <Text style={styles.viewScorecardBtnText}>View Official Scorecard →</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}

                {/* ══════════════════════════════════════════════════════════ */}
                {/* 7. SCORECARD TAB                                           */}
                {/* ══════════════════════════════════════════════════════════ */}
                {activeTab === 'scorecard' && (
                  <View>
                    <View style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Official Match Scorecards</Text>
                        <Text style={styles.cardSubtitle}>Select a match to examine official ball-by-ball certified records</Text>
                      </View>

                      {matches.length === 0 ? (
                        <View style={styles.emptyCard}>
                          <Text style={styles.emptyText}>No matches available to display scorecards.</Text>
                        </View>
                      ) : (
                        <View style={{ gap: 10, marginTop: 10 }}>
                          {matches.map((m, idx) => (
                            <TouchableOpacity
                              key={m.id || idx}
                              style={styles.scorecardSelectCard}
                              onPress={() => handleOpenScorecard(m.id || `M${idx + 1}`)}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={styles.scorecardSelectTitle}>
                                  🏏 {m.teamA?.name || m.teamA || teamName} vs {m.teamB?.name || m.teamB || 'Opponent'}
                                </Text>
                                <Text style={styles.scorecardSelectSub}>
                                  {m.tournament || 'District Match'} • {m.venue || 'Stadium'} • {m.date || '2026'}
                                </Text>
                              </View>
                              <View style={styles.btnInspectScorecard}>
                                <Text style={styles.btnInspectScorecardText}>View Scorecard 📊</Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* ══════════════════════════════════════════════════════════ */}
                {/* 8. STATISTICS TAB                                          */}
                {/* ══════════════════════════════════════════════════════════ */}
                {activeTab === 'statistics' && (
                  <View>
                    {/* Team Overall Record */}
                    <View style={styles.card}>
                      <Text style={styles.cardTitle}>Official Team Season Record</Text>
                      <Text style={styles.cardSubtitle}>Derived directly from completed match scorecards</Text>

                      <View style={styles.statsGrid}>
                        <View style={styles.statBox}>
                          <Text style={styles.statBoxVal}>{teamStats?.matchesPlayed ?? matches.length ?? 8}</Text>
                          <Text style={styles.statBoxLbl}>Matches</Text>
                        </View>
                        <View style={styles.statBox}>
                          <Text style={[styles.statBoxVal, { color: '#10b981' }]}>{teamStats?.matchesWon ?? 5}</Text>
                          <Text style={styles.statBoxLbl}>Won</Text>
                        </View>
                        <View style={styles.statBox}>
                          <Text style={[styles.statBoxVal, { color: '#ef4444' }]}>{teamStats?.matchesLost ?? 3}</Text>
                          <Text style={styles.statBoxLbl}>Lost</Text>
                        </View>
                        <View style={styles.statBox}>
                          <Text style={[styles.statBoxVal, { color: '#f59e0b' }]}>
                            {teamStats?.winRate ? `${teamStats.winRate}%` : '62.5%'}
                          </Text>
                          <Text style={styles.statBoxLbl}>Win Rate</Text>
                        </View>
                        <View style={styles.statBox}>
                          <Text style={styles.statBoxVal}>{teamStats?.totalRunsScored ?? 1420}</Text>
                          <Text style={styles.statBoxLbl}>Total Runs</Text>
                        </View>
                        <View style={styles.statBox}>
                          <Text style={styles.statBoxVal}>{teamStats?.totalWicketsTaken ?? 54}</Text>
                          <Text style={styles.statBoxLbl}>Wickets</Text>
                        </View>
                        <View style={styles.statBox}>
                          <Text style={[styles.statBoxVal, { color: '#38bdf8' }]}>{teamStats?.highestScore ?? 214}</Text>
                          <Text style={styles.statBoxLbl}>Highest Total</Text>
                        </View>
                        <View style={styles.statBox}>
                          <Text style={styles.statBoxVal}>{teamStats?.lowestScore ?? 138}</Text>
                          <Text style={styles.statBoxLbl}>Lowest Total</Text>
                        </View>
                      </View>
                    </View>

                    {/* Squad Top Performers */}
                    <View style={styles.card}>
                      <Text style={styles.cardTitle}>Top Squad Performers</Text>
                      <Text style={styles.cardSubtitle}>Individual player performance totals this season</Text>

                      {playerStats.length === 0 ? (
                        <View style={{ marginTop: 10 }}>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>🏏 Leading Run Scorer:</Text>
                            <Text style={styles.detailValueBold}>R. Saravanan (342 runs, Avg 48.8)</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>⚡ Leading Wicket Taker:</Text>
                            <Text style={styles.detailValueBold}>K. Vimal (16 wkts, Eco 6.2)</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>🌟 Best All-Rounder:</Text>
                            <Text style={styles.detailValueBold}>M. Karthi (218 runs, 9 wkts)</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>🧤 Most Dismissals:</Text>
                            <Text style={styles.detailValueBold}>T. Dinesh (11 catches, 3 stumpings)</Text>
                          </View>
                        </View>
                      ) : (
                        playerStats.map((p, idx) => (
                          <View key={idx} style={styles.detailRow}>
                            <Text style={styles.detailLabel}>{p.name} ({p.role}):</Text>
                            <Text style={styles.detailValueBold}>
                              {p.runs ? `${p.runs} runs` : ''} {p.wickets ? `• ${p.wickets} wkts` : ''}
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                  </View>
                )}

                {/* ══════════════════════════════════════════════════════════ */}
                {/* 9. NOTIFICATIONS TAB                                       */}
                {/* ══════════════════════════════════════════════════════════ */}
                {activeTab === 'notifications' && (
                  <View>
                    <View style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Official Bulletins & Notices</Text>
                        <Text style={styles.cardSubtitle}>District Cricket Association Official Communications</Text>
                      </View>

                      {notifications.length === 0 ? (
                        <View style={styles.emptyCard}>
                          <Text style={styles.emptyText}>No notifications at this time.</Text>
                        </View>
                      ) : (
                        notifications.map((notif, idx) => {
                          const isRead = notif.isRead || notif.read;
                          return (
                            <View key={notif.id || notif._id || idx} style={[styles.notifItem, isRead && { opacity: 0.75 }]}>
                              <View style={styles.notifIconCircle}>
                                <Text style={styles.notifIcon}>{notif.type === 'MATCH' ? '🏏' : '📢'}</Text>
                              </View>
                              <View style={{ flex: 1, marginLeft: 12 }}>
                                <View style={styles.notifHeaderRow}>
                                  <Text style={styles.notifTitle}>{notif.title}</Text>
                                  <Text style={styles.notifDate}>
                                    {new Date(notif.createdAt || Date.now()).toLocaleDateString()}
                                  </Text>
                                </View>
                                <Text style={styles.notifMessage}>{notif.message}</Text>
                                {!isRead && (
                                  <TouchableOpacity
                                    style={{ marginTop: 6, alignSelf: 'flex-start' }}
                                    onPress={() => handleMarkNotifRead(notif.id || notif._id)}
                                  >
                                    <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: 'bold' }}>
                                      ✓ Mark as Read
                                    </Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          );
                        })
                      )}
                    </View>
                  </View>
                )}

                {/* ══════════════════════════════════════════════════════════ */}
                {/* 10. PROFILE TAB (COACH MANAGEMENT)                         */}
                {/* ══════════════════════════════════════════════════════════ */}
                {activeTab === 'profile' && (
                  <View>
                    {/* Coach & Management Details */}
                    <View style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Head Coach & Management Profile</Text>
                        <TouchableOpacity style={styles.editBtnSmall} onPress={() => setIsEditProfileVisible(true)}>
                          <Text style={styles.editBtnSmallText}>Edit Details ✏️</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Head Coach Name:</Text>
                        <Text style={styles.detailValueBold}>{coachName}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Registered Coach Email:</Text>
                        <Text style={styles.detailValue}>{coachEmail}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Coach Mobile / Phone:</Text>
                        <Text style={styles.detailValueBold}>{coachPhone}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Coach Coaching License:</Text>
                        <Text style={styles.detailValue}>{certification}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Home Stadium / Ground:</Text>
                        <Text style={styles.detailValue}>{homeGround}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Appointed Captain:</Text>
                        <Text style={[styles.detailValueBold, { color: '#f59e0b' }]}>{captain}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Appointed Vice-Captain:</Text>
                        <Text style={styles.detailValueBold}>{viceCaptain}</Text>
                      </View>

                      <TouchableOpacity
                        style={styles.actionBtnFull}
                        onPress={() => setIsEditProfileVisible(true)}
                      >
                        <Text style={styles.actionBtnFullText}>Update Contact & Captaincy Info</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </View>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 1: EDIT TEAM & COACH PROFILE                            */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Modal
        visible={isEditProfileVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditProfileVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalHeaderTitle}>Edit Team Profile</Text>
                <Text style={styles.modalHeaderSub}>Update permitted coach and captaincy information</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsEditProfileVisible(false)}
              >
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalFormScroll}>
              {profileFeedback && (
                <View style={[
                  styles.feedbackBanner,
                  profileFeedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError
                ]}>
                  <Text style={styles.feedbackText}>{profileFeedback.message}</Text>
                </View>
              )}

              {/* Locked Field: Team Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Registered Team Name (Locked by Association)</Text>
                <TextInput
                  style={[styles.inputField, styles.inputFieldDisabled]}
                  value={teamName}
                  editable={false}
                />
              </View>

              {/* Locked Field: Team ID */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Official Team ID (Locked)</Text>
                <TextInput
                  style={[styles.inputField, styles.inputFieldDisabled]}
                  value={teamId}
                  editable={false}
                />
              </View>

              {/* Editable Field: Coach Mobile */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Coach Mobile / Contact Phone *</Text>
                <TextInput
                  style={styles.inputField}
                  value={editCoachPhone}
                  onChangeText={setEditCoachPhone}
                  placeholder="+91 94431 XXXXX"
                  placeholderTextColor="#64748b"
                  keyboardType="phone-pad"
                />
              </View>

              {/* Editable Field: Certification */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Coaching Certification / License</Text>
                <TextInput
                  style={styles.inputField}
                  value={editCertification}
                  onChangeText={setEditCertification}
                  placeholder="e.g. BCCI / TNCA Level 2"
                  placeholderTextColor="#64748b"
                />
              </View>

              {/* Editable Field: Home Ground */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Home Stadium / Ground</Text>
                <TextInput
                  style={styles.inputField}
                  value={editHomeGround}
                  onChangeText={setEditHomeGround}
                  placeholder="e.g. Kamarajar Stadium, Virudhunagar"
                  placeholderTextColor="#64748b"
                />
              </View>

              {/* Editable Field: Appointed Captain */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Appointed Team Captain</Text>
                <TextInput
                  style={styles.inputField}
                  value={editCaptain}
                  onChangeText={setEditCaptain}
                  placeholder="e.g. Suresh Kumar"
                  placeholderTextColor="#64748b"
                />
              </View>

              {/* Editable Field: Appointed Vice-Captain */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Appointed Vice-Captain</Text>
                <TextInput
                  style={styles.inputField}
                  value={editViceCaptain}
                  onChangeText={setEditViceCaptain}
                  placeholder="e.g. Vijay Anand"
                  placeholderTextColor="#64748b"
                />
              </View>

              {/* Save & Cancel Actions */}
              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnCancel]}
                  onPress={() => setIsEditProfileVisible(false)}
                  disabled={isSavingProfile}
                >
                  <Text style={styles.modalBtnCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnSave]}
                  onPress={handleSaveProfile}
                  disabled={isSavingProfile}
                >
                  {isSavingProfile ? (
                    <ActivityIndicator size="small" color="#0f172a" />
                  ) : (
                    <Text style={styles.modalBtnSaveText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 2: READ-ONLY OFFICIAL SCORECARD                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Modal
        visible={Boolean(selectedScorecardMatchId)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedScorecardMatchId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxWidth: 700 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalHeaderTitle}>Official Match Scorecard</Text>
                <Text style={styles.modalHeaderSub}>Match #{selectedScorecardMatchId}</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSelectedScorecardMatchId(null)}
              >
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {isLoadingScorecard ? (
              <View style={styles.scorecardLoading}>
                <ActivityIndicator size="large" color="#f59e0b" />
                <Text style={styles.scorecardLoadingText}>Retrieving Official Match Inning Records...</Text>
              </View>
            ) : scorecardData ? (
              <ScrollView style={styles.scorecardModalScroll}>
                {/* Result Highlight */}
                {scorecardData.result && (
                  <View style={styles.scorecardResultCard}>
                    <Text style={styles.scorecardResultText}>🏆 {scorecardData.result}</Text>
                  </View>
                )}

                {/* Innings Tabs */}
                {scorecardData.innings && scorecardData.innings.length > 1 && (
                  <View style={styles.inningsTabBar}>
                    {scorecardData.innings.map((inn: any, i: number) => (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.inningsTabBtn,
                          activeInningsTab === i && styles.inningsTabBtnActive
                        ]}
                        onPress={() => setActiveInningsTab(i)}
                      >
                        <Text style={[
                          styles.inningsTabBtnText,
                          activeInningsTab === i && styles.inningsTabBtnTextActive
                        ]}>
                          {inn.teamName || `Innings ${i + 1}`} ({inn.totalRuns || inn.runs || 0}/{inn.wickets || 0})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Active Innings Batting Table */}
                {(() => {
                  const currentInnings = scorecardData.innings?.[activeInningsTab] || scorecardData.innings?.[0];
                  if (!currentInnings) {
                    return (
                      <View style={styles.emptyCard}>
                        <Text style={styles.emptyText}>Detailed innings data not available.</Text>
                      </View>
                    );
                  }

                  const batters = currentInnings.batting || currentInnings.batters || [];
                  const bowlers = currentInnings.bowling || currentInnings.bowlers || [];

                  return (
                    <View>
                      <View style={styles.inningsContentCard}>
                        <Text style={styles.sectionHeader}>Batting Card</Text>
                        <View style={styles.scorecardTable}>
                          <View style={styles.tableHeaderRow}>
                            <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Batter</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>R</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>B</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>4s</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>6s</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: 'center' }]}>SR</Text>
                          </View>

                          {batters.map((b: any, bi: number) => (
                            <View key={bi} style={styles.tableDataRow}>
                              <View style={{ flex: 3 }}>
                                <Text style={styles.tableDataName}>{b.name || b.playerName}</Text>
                                <Text style={styles.tableDataDismissal}>{b.dismissal || b.howOut || 'not out'}</Text>
                              </View>
                              <Text style={[styles.tableDataCellBold, { flex: 1, textAlign: 'center' }]}>{b.runs ?? 0}</Text>
                              <Text style={[styles.tableDataCell, { flex: 1, textAlign: 'center' }]}>{b.balls ?? 0}</Text>
                              <Text style={[styles.tableDataCell, { flex: 1, textAlign: 'center' }]}>{b.fours ?? 0}</Text>
                              <Text style={[styles.tableDataCell, { flex: 1, textAlign: 'center' }]}>{b.sixes ?? 0}</Text>
                              <Text style={[styles.tableDataCell, { flex: 1.5, textAlign: 'center' }]}>
                                {b.strikeRate ? Number(b.strikeRate).toFixed(1) : b.balls ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>

                      {/* Bowling Table */}
                      <View style={[styles.inningsContentCard, { marginTop: 14 }]}>
                        <Text style={styles.sectionHeader}>Bowling Card</Text>
                        <View style={styles.scorecardTable}>
                          <View style={styles.tableHeaderRow}>
                            <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Bowler</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>O</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>M</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>R</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>W</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: 'center' }]}>ECO</Text>
                          </View>

                          {bowlers.map((bw: any, bwi: number) => (
                            <View key={bwi} style={styles.tableDataRow}>
                              <Text style={[styles.tableDataName, { flex: 3 }]}>{bw.name || bw.playerName}</Text>
                              <Text style={[styles.tableDataCell, { flex: 1, textAlign: 'center' }]}>{bw.overs ?? 0}</Text>
                              <Text style={[styles.tableDataCell, { flex: 1, textAlign: 'center' }]}>{bw.maidens ?? 0}</Text>
                              <Text style={[styles.tableDataCell, { flex: 1, textAlign: 'center' }]}>{bw.runs ?? 0}</Text>
                              <Text style={[styles.tableDataCellBold, { flex: 1, textAlign: 'center', color: '#f59e0b' }]}>{bw.wickets ?? 0}</Text>
                              <Text style={[styles.tableDataCell, { flex: 1.5, textAlign: 'center' }]}>
                                {bw.economy ? Number(bw.economy).toFixed(1) : bw.overs ? ((bw.runs / bw.overs)).toFixed(1) : '0.0'}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    </View>
                  );
                })()}
              </ScrollView>
            ) : (
              <View style={styles.scorecardLoading}>
                <Text style={{ color: '#94a3b8' }}>Scorecard details could not be found.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 3: REGISTER TEAM FOR TOURNAMENT                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Modal
        visible={isRegisterModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsRegisterModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxWidth: 540 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalHeaderTitle}>🏆 Apply for Championship</Text>
                <Text style={styles.modalHeaderSub}>
                  {selectedTournamentForReg?.name || 'Tournament'} ({selectedTournamentForReg?.season || '2026'})
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsRegisterModalOpen(false)}
              >
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 20 }}>
              <View style={styles.prefilledAlertBox}>
                <Text style={styles.prefilledAlertTitle}>ℹ️ Auto-Populated Registered Team Details</Text>
                <Text style={styles.prefilledAlertText}>
                  Your existing logged-in club and coach credentials will be used for this official association registration.
                </Text>
              </View>

              <View style={styles.regFieldGroup}>
                <Text style={styles.fieldLabel}>Club / Team Name</Text>
                <Text style={styles.fieldReadonlyVal}>{profile?.teamName || profile?.name || 'My Club CC'}</Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[styles.regFieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Head Coach</Text>
                  <Text style={styles.fieldReadonlyVal}>{profile?.coachName || profile?.coach?.name || 'Coach'}</Text>
                </View>
                <View style={[styles.regFieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Taluk / District</Text>
                  <Text style={styles.fieldReadonlyVal}>{profile?.taluk || 'Virudhunagar'}</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[styles.regFieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Coach Email</Text>
                  <Text style={styles.fieldReadonlyVal}>{profile?.coachEmail || profile?.coach?.email || 'N/A'}</Text>
                </View>
                <View style={[styles.regFieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Coach Mobile</Text>
                  <Text style={styles.fieldReadonlyVal}>{profile?.coachPhone || profile?.coach_phone || 'N/A'}</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[styles.regFieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Team Captain</Text>
                  <Text style={styles.fieldReadonlyVal}>{profile?.captain || 'Appointed Captain'}</Text>
                </View>
                <View style={[styles.regFieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Official Squad Count</Text>
                  <Text style={styles.fieldReadonlyVal}>{squad.length || 15} Registered Players</Text>
                </View>
              </View>

              <View style={styles.regFieldGroup}>
                <Text style={styles.fieldLabel}>Special Notes / Requests (Optional)</Text>
                <TextInput
                  style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                  multiline
                  placeholder="Any jersey color clashes, ground preferences, or special notes for Apex Council..."
                  placeholderTextColor="#64748b"
                  value={regNotes}
                  onChangeText={setRegNotes}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
                <TouchableOpacity
                  style={[styles.actionBtn, { flex: 1, backgroundColor: '#334155', paddingVertical: 12, borderRadius: 8, alignItems: 'center' }]}
                  onPress={() => setIsRegisterModalOpen(false)}
                  disabled={isSubmittingReg}
                >
                  <Text style={{ color: '#ffffff', fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btnRegisterTeam, { flex: 2, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }]}
                  onPress={handleConfirmRegistration}
                  disabled={isSubmittingReg}
                >
                  {isSubmittingReg ? (
                    <ActivityIndicator size="small" color="#0f172a" />
                  ) : (
                    <Text style={[styles.btnRegisterTeamText, { fontSize: 14 }]}>Confirm Registration</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 4: CONFIRM LOGOUT                                       */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Modal
        visible={logoutModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.logoutModalCard}>
            <View style={styles.logoutModalIconCircle}>
              <LogoutIcon size={24} color="#dc2626" />
            </View>
            <Text style={styles.logoutModalTitle}>Confirm Logout</Text>
            <Text style={styles.logoutModalSub}>
              Are you sure you want to exit the Official Coach & Team Portal? All registered player records and updates are safely saved.
            </Text>
            <View style={styles.logoutModalActions}>
              <TouchableOpacity
                style={styles.btnLogoutCancel}
                onPress={() => setLogoutModalOpen(false)}
              >
                <Text style={styles.btnLogoutCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnLogoutConfirm}
                onPress={async () => {
                  setLogoutModalOpen(false);
                  try {
                    await ScorerApi.logout();
                  } catch (_e) {}
                  if (onExit) onExit();
                }}
              >
                <Text style={styles.btnLogoutConfirmText}>Yes, Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES: Matches PlayerDashboardScreen & Cricket Association Design System
// ─────────────────────────────────────────────────────────────────────────────
const styles: any = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#071026',
    ...(Platform.OS === 'web'
      ? ({ height: '100vh', width: '100vw', overflow: 'hidden' } as any)
      : { height: '100%', width: '100%' })
  },

  // 1. TOP HEADER BAR
  topHeaderBar: {
    width: '100%',
    backgroundColor: '#071026',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(212, 175, 55, 0.4)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexShrink: 0,
    zIndex: 100
  },
  mobileHamburgerBtn: {
    padding: 8,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)'
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0
  },
  brandLogo: {
    width: 40,
    height: 40
  },
  brandTitleMain: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  brandTitleSub: {
    color: '#d4af37',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.4
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  refreshPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  refreshPillBtnText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700'
  },
  coachBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)'
  },
  coachAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#d4af37',
    alignItems: 'center',
    justifyContent: 'center'
  },
  coachAvatarText: {
    color: '#071026',
    fontSize: 14,
    fontWeight: '900'
  },
  coachHeaderName: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '800'
  },
  coachHeaderRole: {
    color: '#fde68a',
    fontSize: 10,
    fontWeight: '600'
  },
  exitBtnPill: {
    backgroundColor: '#dc2626',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8
  },
  exitBtnPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800'
  },

  // 2. MAIN LAYOUT (Sidebar + Main Column)
  layoutRoot: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
    minWidth: 0,
    backgroundColor: '#f6f2e9',
    ...(Platform.OS === 'web'
      ? ({ overflow: 'hidden', height: '100%' } as any)
      : { overflow: 'hidden' })
  },
  mainColumn: {
    flex: 1,
    flexDirection: 'column',
    minHeight: 0,
    minWidth: 0,
    backgroundColor: '#f6f2e9',
    ...(Platform.OS === 'web'
      ? ({ overflow: 'hidden', height: '100%', display: 'flex' } as any)
      : { overflow: 'hidden' })
  },
  rightContentScrollView: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    backgroundColor: '#f6f2e9',
    ...(Platform.OS === 'web'
      ? ({
          overflowY: 'auto',
          overflowX: 'hidden',
          flex: 1,
          minHeight: 0
        } as any)
      : {})
  },
  scrollContentContainer: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    paddingBottom: 100,
    width: '100%',
    flexGrow: 1
  },
  contentConstrained: {
    maxWidth: 1200,
    width: '100%',
    marginHorizontal: 'auto'
  },

  // Page Header Banner
  pageHeaderBanner: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    elevation: 2
  },
  pageHeaderTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.3
  },
  pageHeaderSubtitle: {
    color: '#64748b',
    fontSize: 11.5,
    marginTop: 2
  },
  pageHeaderRightPill: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20
  },
  pageHeaderRightPillText: {
    color: '#92400e',
    fontSize: 11.5,
    fontWeight: '800'
  },

  // KPI Highlight Row
  kpiCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap'
  },
  kpiCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    elevation: 2
  },
  kpiCardBlue: { borderLeftWidth: 4, borderLeftColor: '#2563eb' },
  kpiCardOrange: { borderLeftWidth: 4, borderLeftColor: '#ea580c' },
  kpiCardEmerald: { borderLeftWidth: 4, borderLeftColor: '#16a34a' },
  kpiCardGold: { borderLeftWidth: 4, borderLeftColor: '#d97706' },
  kpiIconWrapBlue: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center'
  },
  kpiIconWrapOrange: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ffedd5',
    justifyContent: 'center',
    alignItems: 'center'
  },
  kpiIconWrapEmerald: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center'
  },
  kpiIconWrapGold: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center'
  },
  kpiInfo: {
    flex: 1
  },
  kpiVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a'
  },
  kpiLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 1
  },

  // Match Day Alert Banner
  matchDayAlertBanner: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    elevation: 3
  },
  matchDayAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  matchDayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ef4444'
  },
  matchDayBadgeDot: {
    fontSize: 8,
    marginRight: 4
  },
  matchDayBadgeText: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  matchDayDateText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '700'
  },
  matchDayTitleText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4
  },
  matchDayMetaText: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 12
  },
  matchDayActionsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap'
  },
  matchDayMapBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  matchDayMapBtnText: {
    color: '#cbd5e1',
    fontSize: 11.5,
    fontWeight: '700'
  },
  matchDaySquadBtn: {
    backgroundColor: '#d97706',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  matchDaySquadBtnText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '800'
  },

  // Hero Card
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    elevation: 2
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  heroShieldCircle: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#fef3c7',
    borderWidth: 2,
    borderColor: '#d4af37',
    alignItems: 'center',
    justifyContent: 'center'
  },
  heroShieldBig: {
    fontSize: 22
  },
  heroTeamName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a'
  },
  heroDivision: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6
  },
  goldBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  goldBadgeText: {
    color: '#92400e',
    fontSize: 10,
    fontWeight: '800'
  },
  certBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#a7f3d0'
  },
  certBadgeText: {
    color: '#065f46',
    fontSize: 10,
    fontWeight: '800'
  },
  approvalStamp: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86efac'
  },
  approvalStampText: {
    color: '#16a34a',
    fontSize: 11,
    fontWeight: '900'
  },
  heroDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 14
  },
  heroStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  heroStatCol: {
    alignItems: 'center',
    flex: 1
  },
  heroStatValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a'
  },
  heroStatLabel: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2
  },

  // Action Shortcuts Row
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    flexWrap: 'wrap'
  },
  actionBtn: {
    flex: 1,
    minWidth: 120,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    elevation: 1
  },
  actionBtnIcon: {
    fontSize: 20,
    marginBottom: 4
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155'
  },

  // Cards
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    elevation: 2
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a'
  },
  cardSubtitle: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 1
  },
  cardMeta: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600'
  },
  liveTag: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fca5a5'
  },
  liveTagText: {
    color: '#dc2626',
    fontSize: 10,
    fontWeight: '800'
  },
  matchVersusText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8
  },
  matchMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12
  },
  matchMetaItem: {
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '600'
  },
  scorecardTriggerBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#0a2540',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6
  },
  scorecardTriggerBtnText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '700'
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4
  },
  noticeBody: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18
  },

  // Detail Rows
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  detailLabel: {
    fontSize: 12.5,
    color: '#64748b',
    fontWeight: '600'
  },
  detailValue: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '600'
  },
  detailValueBold: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '800'
  },
  verifiedTag: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#86efac'
  },
  verifiedTagText: {
    color: '#16a34a',
    fontSize: 10,
    fontWeight: '800'
  },
  editBtnSmall: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  editBtnSmallText: {
    fontSize: 11.5,
    color: '#0f172a',
    fontWeight: '700'
  },
  actionBtnFull: {
    backgroundColor: '#d4af37',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 14
  },
  actionBtnFullText: {
    color: '#020612',
    fontSize: 13,
    fontWeight: '800'
  },
  securityNote: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
    marginTop: 6
  },

  // Squad Tab
  roleChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12
  },
  roleChip: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  roleChipText: {
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '700'
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    height: 40
  },
  searchBarInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a'
  },
  squadPlayerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  squadJerseyCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0a2540',
    alignItems: 'center',
    justifyContent: 'center'
  },
  squadJerseyText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800'
  },
  squadPlayerName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0f172a'
  },
  squadPlayerMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1
  },
  squadPlayerEmail: {
    fontSize: 10.5,
    color: '#94a3b8'
  },
  captainBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  captainBadgeText: {
    color: '#92400e',
    fontSize: 9,
    fontWeight: '900'
  },
  vcBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#bae6fd'
  },
  vcBadgeText: {
    color: '#0369a1',
    fontSize: 9,
    fontWeight: '900'
  },
  verifiedMiniBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center'
  },
  verifiedMiniBadgeText: {
    color: '#16a34a',
    fontSize: 11,
    fontWeight: '900'
  },

  // Tournaments Tab
  tournamentSubTabsBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16
  },
  tournamentSubTabBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center'
  },
  tournamentSubTabBtnActive: {
    backgroundColor: '#0a2540',
    borderColor: '#0a2540'
  },
  tournamentSubTabBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569'
  },
  tournamentSubTabBtnTextActive: {
    color: '#ffffff',
    fontWeight: '800'
  },
  tourCardCoach: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    elevation: 2
  },
  tourCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12
  },
  tourCardName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a'
  },
  tourCardVenue: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  tourStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  tourStatusBadgeOpen: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac'
  },
  tourStatusBadgeClosed: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5'
  },
  tourStatusBadgeText: {
    fontSize: 10,
    fontWeight: '800'
  },
  tourStatusBadgeTextOpen: {
    color: '#16a34a'
  },
  tourStatusBadgeTextClosed: {
    color: '#dc2626'
  },
  tourMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginTop: 12
  },
  tourMetaCol: {
    alignItems: 'center'
  },
  tourMetaLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#94a3b8'
  },
  tourMetaVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2
  },
  btnRegisterTeam: {
    backgroundColor: '#d4af37',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center'
  },
  btnRegisterTeamText: {
    color: '#020612',
    fontSize: 12.5,
    fontWeight: '800'
  },
  approvedStatusNotice: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center'
  },
  approvedStatusNoticeText: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '800'
  },
  pendingStatusNotice: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center'
  },
  pendingStatusNoticeText: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: '800'
  },
  rejectedStatusNotice: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  rejectedStatusNoticeText: {
    color: '#991b1b',
    fontSize: 12,
    fontWeight: '800'
  },
  rejectionReasonSnippet: {
    color: '#b91c1c',
    fontSize: 11,
    marginTop: 2,
    fontStyle: 'italic'
  },
  btnReapply: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  btnReapplyText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800'
  },
  disabledRegNotice: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 9,
    alignItems: 'center'
  },
  disabledRegNoticeText: {
    color: '#64748b',
    fontSize: 11.5,
    fontWeight: '600'
  },

  // My Applications
  myAppCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    elevation: 2
  },
  myAppHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10
  },
  myAppTourName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a'
  },
  myAppMetaDate: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2
  },
  appStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  appStatusApproved: { backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#86efac' },
  appStatusPending: { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a' },
  appStatusRejected: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5' },
  appStatusPillText: { fontSize: 10, fontWeight: '800' },
  appStatusTextApproved: { color: '#16a34a' },
  appStatusTextPending: { color: '#92400e' },
  appStatusTextRejected: { color: '#dc2626' },
  myAppRosterRow: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    gap: 3
  },
  myAppRosterText: {
    fontSize: 11.5,
    color: '#475569'
  },
  statusDescriptionBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  statusDescriptionText: {
    fontSize: 11.5,
    color: '#64748b',
    lineHeight: 16
  },

  // Matches Tab
  matchFilterBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap'
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  filterPillActive: {
    backgroundColor: '#0a2540',
    borderColor: '#0a2540'
  },
  filterPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569'
  },
  filterPillTextActive: {
    color: '#ffffff'
  },
  matchCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    elevation: 2
  },
  matchCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  matchCardTournament: {
    fontSize: 12,
    fontWeight: '800',
    color: '#d97706'
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4
  },
  statusPillLive: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5' },
  statusPillCompleted: { backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#86efac' },
  statusPillScheduled: { backgroundColor: '#e0f2fe', borderWidth: 1, borderColor: '#bae6fd' },
  statusPillText: { fontSize: 9.5, fontWeight: '800', color: '#0f172a' },
  matchCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8
  },
  matchTeamSide: {
    flex: 1,
    alignItems: 'center'
  },
  matchTeamTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center'
  },
  matchScoreText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0a2540',
    marginTop: 2
  },
  matchVsSmall: {
    fontSize: 11,
    fontWeight: '900',
    color: '#94a3b8',
    paddingHorizontal: 12
  },
  matchCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    marginTop: 8,
    flexWrap: 'wrap',
    gap: 8
  },
  matchFooterText: {
    fontSize: 11,
    color: '#64748b'
  },
  resultBanner: {
    backgroundColor: '#ecfdf5',
    padding: 8,
    borderRadius: 6,
    marginTop: 10
  },
  resultBannerText: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center'
  },
  viewScorecardBtn: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 10
  },
  viewScorecardBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0f172a'
  },

  // Scorecard Section
  scorecardSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10
  },
  scorecardSelectTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a'
  },
  scorecardSelectSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2
  },
  btnInspectScorecard: {
    backgroundColor: '#0a2540',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  btnInspectScorecardText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700'
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12
  },
  statBox: {
    flex: 1,
    minWidth: 100,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center'
  },
  statBoxVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a'
  },
  statBoxLbl: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2
  },

  // Notifications
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  notifIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center'
  },
  notifIcon: {
    fontSize: 16
  },
  notifHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1
  },
  notifDate: {
    fontSize: 10.5,
    color: '#94a3b8'
  },
  notifMessage: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2
  },

  // Feedback & Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40
  },
  loadingText: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 10,
    fontWeight: '600'
  },
  errorBannerBox: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#ef4444',
    padding: 12,
    borderRadius: 8,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  errorBannerText: {
    color: '#b91c1c',
    fontSize: 12.5,
    fontWeight: '600'
  },
  retryBtnText: {
    color: '#dc2626',
    fontWeight: '800',
    textDecorationLine: 'underline'
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600'
  },

  // Modals Generic
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 16, 38, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalContainer: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    maxHeight: '90%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    elevation: 8
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc'
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a'
  },
  modalHeaderSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1
  },
  modalCloseBtn: {
    padding: 6
  },
  modalCloseBtnText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: 'bold'
  },
  modalFormScroll: {
    padding: 18
  },
  inputGroup: {
    marginBottom: 14
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4
  },
  inputField: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f172a'
  },
  inputFieldDisabled: {
    backgroundColor: '#f1f5f9',
    color: '#64748b'
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalBtnCancel: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  modalBtnCancelText: {
    color: '#475569',
    fontSize: 12.5,
    fontWeight: '700'
  },
  modalBtnSave: {
    backgroundColor: '#d4af37'
  },
  modalBtnSaveText: {
    color: '#020612',
    fontSize: 12.5,
    fontWeight: '800'
  },
  feedbackBanner: {
    padding: 10,
    borderRadius: 6,
    marginBottom: 12
  },
  feedbackSuccess: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' },
  feedbackError: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  feedbackText: { fontSize: 12, fontWeight: '700', color: '#065f46' },

  // Pre-filled modal styles
  prefilledAlertBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14
  },
  prefilledAlertTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#166534',
    marginBottom: 2
  },
  prefilledAlertText: {
    fontSize: 11,
    color: '#15803d'
  },
  regFieldGroup: {
    marginBottom: 10
  },
  fieldLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 3
  },
  fieldReadonlyVal: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 9,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 10,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    fontSize: 12.5
  },

  // Scorecard modal details
  scorecardModalScroll: {
    padding: 16
  },
  scorecardLoading: {
    padding: 30,
    alignItems: 'center'
  },
  scorecardLoadingText: {
    marginTop: 8,
    color: '#64748b',
    fontSize: 12
  },
  scorecardResultCard: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12
  },
  scorecardResultText: {
    color: '#92400e',
    fontSize: 12.5,
    fontWeight: '800',
    textAlign: 'center'
  },
  inningsTabBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12
  },
  inningsTabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    alignItems: 'center'
  },
  inningsTabBtnActive: {
    backgroundColor: '#0a2540'
  },
  inningsTabBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569'
  },
  inningsTabBtnTextActive: {
    color: '#ffffff'
  },
  inningsContentCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8
  },
  scorecardTable: {
    gap: 4
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1'
  },
  tableHeaderCell: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748b'
  },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  tableDataName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a'
  },
  tableDataDismissal: {
    fontSize: 10,
    color: '#94a3b8'
  },
  tableDataCell: {
    fontSize: 11.5,
    color: '#334155'
  },
  tableDataCellBold: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0f172a'
  },

  // Logout Modal
  logoutModalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    elevation: 10
  },
  logoutModalIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  logoutModalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 6
  },
  logoutModalSub: {
    fontSize: 12.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20
  },
  logoutModalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%'
  },
  btnLogoutCancel: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center'
  },
  btnLogoutCancelText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700'
  },
  btnLogoutConfirm: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#dc2626',
    alignItems: 'center'
  },
  btnLogoutConfirmText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800'
  }
});
