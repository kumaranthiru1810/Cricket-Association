/**
 * mobile_frontend/screens/Home.tsx
 *
 * Pure React Native Home Screen for Cricket Federation of Virudhunagar District (CFVD).
 * Recreates the complete visual design, structure, colors, gradients, typography,
 * sections, cards, tables, and interactivity of bundled.html WITHOUT any <iframe> or WebView.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  Dimensions,
  Animated,
  ActivityIndicator,
  Alert,
  Linking,
  useWindowDimensions,
  ViewStyle,
  DimensionValue,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { io } from 'socket.io-client';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppNavigation } from '../src/navigation/AppNavigator';
import { ScorerApi, PlayerApi, getCurrentUser, setCurrentUser, setAuthToken, logoutAndClearAllSessions, SOCKET_URL, API_URL, resolveImageUrl } from '../src/services/api';
import { HomePopupConfig, resolveHomePopupImageSource } from '../src/utils/homePopupAssets';
import { getStoredAdminToken, getStoredAdminUser } from '../src/admin/services/adminApi';
import { MatchHighlightsBanner } from '../src/components/common/MatchHighlightsBanner';
import {
  bsColors,
  bsButtons,
  bsAlert,
} from '../src/styles/bootstrapTheme';
import UmpireSignalOverlay, { UmpireSignalEvent, UmpireSignalsGalleryModal } from '../src/components/common/UmpireSignalOverlay';
import Header from '../src/layouts/Header';
import BroadcastLiveBallAction from '../src/components/common/BroadcastLiveBallAction';
import { VPLEventBanner, VPLSoundControls } from '../src/components/common/VPLEventBanner';
import { mapBallToEvents, normalizeExtraType, normalizeDismissal } from '../src/utils/vplEventMapper';
import VideoPreloader from '../src/components/common/VideoPreloader';
import BootstrapPagination from '../src/components/common/BootstrapPagination';
import {
  Ionicons,
  MaterialCommunityIcons,
  FontAwesome5,
} from '@expo/vector-icons';

// ─── ASSET REFERENCES ──────────────────────────────────────────────────────────
const IMG_LOGO = require('../assets/logo_transparent.png');
const IMG_WATERMARK = require('../assets/watermark.png');
const IMG_STADIUM = require('../assets/stadium.jpg');
const IMG_BATSMAN = require('../assets/batsman.jpg');
const IMG_CHAMPIONS = require('../assets/champions.jpg');

// ─── DATA DEFINITIONS ─────────────────────────────────────────────────────────
import {
  TABLE_DATA,
  PERF_DATA,
  StandingsRow,
  DistrictPlayer,
  CollegeItem,
  INITIAL_COLLEGES,
  OFFICIALS_ROSTER,
} from './home/HomeStaticData';
import { styles } from './home/HomeStyles';

export default function HomeScreen() {
  const { navigate } = useAppNavigation();

  // Authentication Session State (JWT Bearer / Cookie)
  const [sessionUser, setSessionUser] = useState<any>(() => getCurrentUser());
  const [showIntroVideo, setShowIntroVideo] = useState<boolean>(false);

  useEffect(() => {
    // 1. Check local session cache
    const cached = getCurrentUser();
    if (cached) {
      setSessionUser(cached);

      // 2. Validate session with backend /api/auth/me (validates Bearer token or HttpOnly Cookie)
      ScorerApi.getMe()
        .then((res: any) => {
          if (res && res.success && res.user) {
            const portalRole = cached?.portalRole && cached.portalRole !== 'ADMIN'
              ? cached.portalRole
              : res.user.role;
            const mergedUser = {
              ...res.user,
              role: portalRole,
              ...(cached?.portalRole ? { portalRole: cached.portalRole } : {})
            };
            setCurrentUser(mergedUser);
            setSessionUser(mergedUser);
          }
        })
        .catch(() => {
          // Unauthenticated or expired session
        });
    }
  }, []);

  const handleLogout = async () => {
    try {
      await logoutAndClearAllSessions();
    } catch (_e) { }
    setAuthToken(null);
    setCurrentUser(null);
    setSessionUser(null);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  const handleNavigateToUserPortal = () => {
    if (!sessionUser) return;
    const role = (sessionUser.role || '').toUpperCase();
    if (role === 'ADMIN') {
      navigate('Admin', { user: sessionUser });
    } else if (role === 'SCORER') {
      navigate('Scorer', { user: sessionUser });
    } else if (role === 'UMPIRE') {
      navigate('Umpire', { user: sessionUser });
    } else if (role === 'PLAYER') {
      navigate('Player', { user: sessionUser, playerName: sessionUser.name });
    } else if (role === 'COACH' || role === 'TEAM') {
      navigate('Team', { user: sessionUser, teamName: sessionUser.teamName });
    } else {
      navigate('Login');
    }
  };

  // ─── ADMIN DEVELOPER EASTER EGG (STEALTH LOGO BALLS PATTERN) ────────────
  // Pattern: LEFT -> RIGHT -> LEFT -> RIGHT -> CENTER (Strictly 5 taps in order)
  const secretTapHistory = useRef<string[]>([]);
  const secretTimeoutRef = useRef<any>(null);
  const [emblemSequenceConfig, setEmblemSequenceConfig] = useState<{
    enabled: boolean;
    sequence: Array<'LEFT' | 'RIGHT' | 'CENTER'>;
  }>({
    enabled: true,
    sequence: ['LEFT', 'RIGHT', 'LEFT', 'RIGHT', 'CENTER']
  });

  useEffect(() => {
    let mounted = true;
    fetch(`${API_URL}/portal/emblem-sequence`)
      .then(r => r.json())
      .then(data => {
        if (mounted && data?.success && data.config) {
          setEmblemSequenceConfig({
            enabled: Boolean(data.config.enabled),
            sequence: Array.isArray(data.config.sequence) ? data.config.sequence : []
          });
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const handleSecretBallTap = (ball: 'LEFT' | 'RIGHT' | 'CENTER') => {
    if (!emblemSequenceConfig.enabled || emblemSequenceConfig.sequence.length === 0) {
      return;
    }

    if (secretTimeoutRef.current) {
      clearTimeout(secretTimeoutRef.current);
    }

    const EXPECTED_SEQUENCE = emblemSequenceConfig.sequence;
    const currentStep = secretTapHistory.current.length;
    const expected = EXPECTED_SEQUENCE[currentStep];

    if (ball === expected) {
      const nextHistory = [...secretTapHistory.current, ball];
      secretTapHistory.current = nextHistory;

      // When all taps in the configured sequence match perfectly:
      if (nextHistory.length === EXPECTED_SEQUENCE.length) {
        secretTapHistory.current = [];
        // Check if user has an active authenticated admin session on this device/mobile
        const existingToken = getStoredAdminToken();
        const existingAdminUser = getStoredAdminUser();
        const activeUser = getCurrentUser();
        const isAdmin =
          (existingAdminUser && (existingAdminUser.role || '').toUpperCase() === 'ADMIN') ||
          (activeUser && (activeUser.role || '').toUpperCase() === 'ADMIN');

        if (existingToken && isAdmin) {
          // Already logged in previously on this device
          try {
            router.push('/admin');
          } catch {
            navigate('Admin', { user: existingAdminUser || activeUser });
          }
        } else {
          // First time or not authenticated -> MUST go to Admin Login to enter credentials
          try {
            router.push('/admin-login');
          } catch {
            try {
              router.push('/admin/login');
            } catch {
              navigate('AdminLogin');
            }
          }
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            try {
              window.location.href = '/admin-login';
            } catch {}
          }
        }
        return;
      }

      // If user pauses or stops before reaching 5, reset sequence after 4.5s
      secretTimeoutRef.current = setTimeout(() => {
        secretTapHistory.current = [];
      }, 4500);
    } else {
      // Wrong tap or out of sequence -> reset immediately!
      secretTapHistory.current = [];
      // If the wrong tap happened to be 'LEFT', it starts a fresh attempt at step 1
      if (ball === 'LEFT') {
        secretTapHistory.current = ['LEFT'];
        secretTimeoutRef.current = setTimeout(() => {
          secretTapHistory.current = [];
        }, 4500);
      }
    }
  };

  // Dynamic Responsive Breakpoints (Updates automatically on all devices & orientations)
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isMobile = windowWidth < 768;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;
  const isDesktop = windowWidth >= 1024;
  const isSmallMobile = windowWidth < 480;
  const isTinyMobile = windowWidth < 380;

  // Bootstrap 5 Official Media Query Breakpoints (xs < 576, sm 576-767, md 768-991, lg 992-1199, xl 1200-1399, xxl >= 1400)
  const isXs = windowWidth < 576;
  const isSm = windowWidth >= 576 && windowWidth < 768;
  const isMd = windowWidth >= 768 && windowWidth < 992;
  const isLg = windowWidth >= 992 && windowWidth < 1200;
  const isXl = windowWidth >= 1200 && windowWidth < 1400;
  const isXxl = windowWidth >= 1400;

  // Bootstrap 5 Responsive Container Max-Width & Gutter Padding
  const containerResponsiveStyle: ViewStyle = {
    width: '100%',
    maxWidth: (isXxl ? 1320 : (isXl ? 1140 : (isLg ? 960 : (isMd ? 720 : '100%')))) as DimensionValue,
    alignSelf: 'center',
    paddingHorizontal: isXs ? 12 : (isSm ? 16 : 24)
  };

  // Animations
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: Platform.OS !== 'web' })
      ])
    ).start();
  }, [pulseAnim]);

  // Home Portal Dynamic Popup State
  const [homePopupConfig, setHomePopupConfig] = useState<HomePopupConfig | null>(null);
  const [showHomePopup, setShowHomePopup] = useState<boolean>(false);
  const [committeeConfig, setCommitteeConfig] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    fetch(`${API_URL}/portal/home-popup`)
      .then(r => r.json())
      .then(data => {
        if (mounted && data?.success && data.popup?.enabled) {
          setHomePopupConfig(data.popup);
          setShowHomePopup(true);
        }
      })
      .catch(() => {});

    fetch(`${API_URL}/portal/committee-members`)
      .then(r => r.json())
      .then(data => {
        if (mounted && data?.success && data.config?.enabled) {
          setCommitteeConfig(data.config);
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  // Section Scroll Reference
  const mainScrollRef = useRef<any>(null);
  const [sectionPositions, setSectionPositions] = useState<Record<string, number>>({});

  const scrollToSection = (secName: string) => {
    setMobileNavOpen(false);

    const posKeyMap: Record<string, string> = {
      standings: 'pointsTable',
      playerRatings: 'stats',
      clubs: 'about',
      rules: 'about',
      heritage: 'about',
      contactUs: 'contact',
      secretariat: 'contact',
    };
    const resolvedKey = posKeyMap[secName] || secName;

    // 1. First attempt: Use measured React Native layout position
    const recordedY = sectionPositions[resolvedKey] ?? sectionPositions[secName];
    if (typeof recordedY === 'number' && recordedY > 0) {
      try {
        mainScrollRef.current?.scrollTo({ y: Math.max(0, recordedY - 10), animated: true });
      } catch (_e) {}
    }

    // 2. On Web: ensure DOM scroll happens smoothly on the actual scrollable container
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const idMap: Record<string, string> = {
        matchCentre: 'cfvd-section-match-centre',
        pointsTable: 'cfvd-section-points-table',
        standings: 'cfvd-section-points-table',
        tournaments: 'cfvd-section-tournaments',
        stats: 'cfvd-section-stats',
        playerRatings: 'cfvd-section-stats',
        players: 'cfvd-section-players',
        about: 'cfvd-section-about',
        grounds: 'cfvd-section-grounds',
        news: 'cfvd-section-news',
        contact: 'cfvd-section-contact',
      };

      const targetId = idMap[secName] || idMap[resolvedKey] || secName;
      const el = document.getElementById(targetId);

      if (el) {
        // Native browser scrollIntoView respects scrollMarginTop
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (_err) {}

        // Find scrollable ancestor element (ScrollView in web)
        let scrollParent: HTMLElement | null = null;
        let curr: HTMLElement | null = el.parentElement;
        while (curr && curr !== document.body && curr !== document.documentElement) {
          const computed = window.getComputedStyle(curr);
          if (computed.overflowY === 'auto' || computed.overflowY === 'scroll') {
            scrollParent = curr;
            break;
          }
          curr = curr.parentElement;
        }

        const scrollNode =
          scrollParent ||
          (mainScrollRef.current as any)?.getScrollableNode?.() ||
          (mainScrollRef.current as any)?._nativeRef;

        if (scrollNode && typeof scrollNode.getBoundingClientRect === 'function' && scrollNode !== document.documentElement && scrollNode !== document.body) {
          const scrollRect = scrollNode.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          const computedTargetY = scrollNode.scrollTop + (elRect.top - scrollRect.top);
          scrollNode.scrollTo({ top: Math.max(0, computedTargetY - 15), behavior: 'smooth' });
          return;
        }

        // Window scroll fallback
        if (typeof window !== 'undefined' && document.documentElement.scrollHeight > window.innerHeight) {
          const winTargetY = window.scrollY + el.getBoundingClientRect().top - 95;
          window.scrollTo({ top: Math.max(0, winTargetY), behavior: 'smooth' });
        }
        return;
      }
    }

    // 3. Fallback for native mobile
    if (typeof recordedY === 'number') {
      mainScrollRef.current?.scrollTo({ y: Math.max(0, recordedY - 10), animated: true });
    }
  };

  // State: Mobile Nav Menu
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // State: Match Centre Filter & Pagination
  const [matchFilter, setMatchFilter] = useState<'all' | 'live' | 'upcoming' | 'postponed' | 'results'>('all');
  const [matchPage, setMatchPage] = useState<number>(1);
  const MATCHES_PER_PAGE = 6;

  // State: Tournaments Pagination
  const [tournamentPage, setTournamentPage] = useState<number>(1);
  const TOURNAMENTS_PER_PAGE = 4;

  // State: Standings Points Table Pagination & Search
  const [standingsPage, setStandingsPage] = useState<number>(1);
  const [standingsSearchQuery, setStandingsSearchQuery] = useState<string>('');
  const STANDINGS_PER_PAGE = 8;

  // State: Performance Records Pagination & Search (Reusable 8 items per page)
  const [perfRatingsPage, setPerfRatingsPage] = useState<number>(1);
  const [perfBattingPage, setPerfBattingPage] = useState<number>(1);
  const [perfBowlingPage, setPerfBowlingPage] = useState<number>(1);
  const [perfFieldingPage, setPerfFieldingPage] = useState<number>(1);
  const [perfSearchQuery, setPerfSearchQuery] = useState<string>('');
  const [activeDropdown, setActiveDropdown] = useState<{
    title: string;
    options: { id: string; label: string }[];
    selectedId: string;
    onSelect: (id: string) => void;
  } | null>(null);
  const PERF_PER_PAGE = 8;

  const renderSelectBox = (
    prefix: string,
    selectedId: string,
    options: { id: string; label: string }[],
    onSelect: (id: string) => void,
    minW = 160
  ) => {
    const activeOpt = options.find(o => o.id === selectedId) || options[0];
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setActiveDropdown({ title: prefix, options, selectedId, onSelect })}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#ffffff',
          borderColor: '#cbd5e1',
          borderWidth: 1,
          borderRadius: 8,
          height: 38,
          paddingHorizontal: 12,
          minWidth: isMobile ? '48%' : minW,
          flex: isMobile ? 1 : undefined,
          gap: 8,
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 2,
          elevation: 1
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', marginRight: 5 }}>
            {prefix}:
          </Text>
          <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#0e184e', flexShrink: 1 }} numberOfLines={1}>
            {activeOpt?.label || 'Select'}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={14} color="#475569" />
      </TouchableOpacity>
    );
  };

  // State: Player Milestone Hall of Fame Pagination (Reusable 8 items per page)
  const [milestonePage, setMilestonePage] = useState<number>(1);
  const MILESTONE_PER_PAGE = 8;

  // State: Committee Roles Pagination
  const [committeeRolePage, setCommitteeRolePage] = useState<number>(1);
  const COMMITTEE_ROLES_PER_PAGE = 6;

  // Dynamic Real Match State from MongoDB
  const [publicMatches, setPublicMatches] = useState<any[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState<boolean>(true);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const hasLoadedMatchesOnceRef = useRef<boolean>(false);
  const [activeScorecardMatchData, setActiveScorecardMatchData] = useState<any>(null);
  const [realScorecardData, setRealScorecardData] = useState<any>(null);
  const [isLoadingScorecard, setIsLoadingScorecard] = useState<boolean>(false);

  // Dynamic MongoDB Portal Data (Standings, Performance, Directory, Tournaments)
  const [portalTournaments, setPortalTournaments] = useState<any[]>([]);
  const [portalPointsTable, setPortalPointsTable] = useState<any[]>([]);
  const [tournamentPointsTable, setTournamentPointsTable] = useState<any[]>([]);
  const [isLoadingPointsTable, setIsLoadingPointsTable] = useState<boolean>(false);
  const [portalTopBatsmen, setPortalTopBatsmen] = useState<any[]>([]);
  const [portalTopBowlers, setPortalTopBowlers] = useState<any[]>([]);
  const [portalTopFielders, setPortalTopFielders] = useState<any[]>([]);
  const [portalAllPlayers, setPortalAllPlayers] = useState<any[]>([]);

  const loadTournamentStandings = async (tournamentId: string) => {
    if (!tournamentId) return;
    try {
      setIsLoadingPointsTable(true);
      const res = await ScorerApi.getTournamentPointsTable(tournamentId);
      const rows = res?.points_table || res?.data || [];
      if (Array.isArray(rows)) {
        setTournamentPointsTable(rows);
      } else {
        setTournamentPointsTable([]);
      }
    } catch (err: any) {
      console.warn('Failed to load tournament points table:', err.message);
      setTournamentPointsTable([]);
    } finally {
      setIsLoadingPointsTable(false);
    }
  };

  const loadPortalData = async () => {
    try {
      const res = await ScorerApi.getPortalHome();
      if (res && res.success && res.data) {
        let fetchedTournaments = Array.isArray(res.data.tournaments) ? res.data.tournaments : [];
        if (fetchedTournaments.length === 0) {
          try {
            const tRes = await ScorerApi.getTournaments();
            fetchedTournaments = tRes?.tournaments || tRes?.data || [];
          } catch (_e) {}
        }
        if (Array.isArray(fetchedTournaments) && fetchedTournaments.length > 0) {
          setPortalTournaments(fetchedTournaments);
          setPointsTableKey(prev => {
            const exists = fetchedTournaments.some((t: any) => t.id === prev);
            const targetId = exists ? prev : fetchedTournaments[0].id;
            loadTournamentStandings(targetId);
            return targetId;
          });
        }
        if (Array.isArray(res.data.pointsTable) && res.data.pointsTable.length > 0) {
          setPortalPointsTable(res.data.pointsTable);
        }
        if (Array.isArray(res.data.topBatsmen) && res.data.topBatsmen.length > 0) {
          setPortalTopBatsmen(res.data.topBatsmen);
        }
        if (Array.isArray(res.data.topBowlers) && res.data.topBowlers.length > 0) {
          setPortalTopBowlers(res.data.topBowlers);
        }
        if (Array.isArray(res.data.topFielders) && res.data.topFielders.length > 0) {
          setPortalTopFielders(res.data.topFielders);
        }
        if (Array.isArray(res.data.allPlayers)) {
          setPortalAllPlayers(res.data.allPlayers);
        }
      }
    } catch (err: any) {
      console.warn('Failed to load portal data from MongoDB:', err.message);
    }
  };

  const loadPublicMatches = async (isInitial = false) => {
    // Silent background refresh (AJAX style) - only show loading on very first initial load before data is cached
    if (isInitial && !hasLoadedMatchesOnceRef.current) {
      setIsLoadingMatches(true);
    }
    try {
      const res = await ScorerApi.getPublicMatches();
      const data = res?.data || res?.matches || (Array.isArray(res) ? res : []);
      if (Array.isArray(data)) {
        setPublicMatches(data);
        setMatchesError(null);
        hasLoadedMatchesOnceRef.current = true;
      }
    } catch (err: any) {
      console.warn('Failed to load public matches from API:', err.message);
      // Only set error message if we don't already have matches cached
      if (!hasLoadedMatchesOnceRef.current) {
        setMatchesError(err.message || 'Unable to connect to match database');
      }
    } finally {
      setIsLoadingMatches(false);
    }
  };

  // State: Ratings Leaderboard (Module 5)
  const [ratingCategory, setRatingCategory] = useState<'overall' | 'batting' | 'bowling'>('overall');
  const [ratingFormat, setRatingFormat] = useState<'ALL' | 'T20' | 'ONE_DAY' | 'MULTI_DAY'>('ALL');
  const [ratingLeaders, setRatingLeaders] = useState<any[]>([]);
  const [isLoadingLeaders, setIsLoadingLeaders] = useState<boolean>(false);

  const loadRatingsLeaderboard = async (category = ratingCategory, format = ratingFormat) => {
    try {
      setIsLoadingLeaders(true);
      const res = await PlayerApi.getRatingsLeaderboard({
        category,
        format,
        limit: 10
      });
      if (res && res.success && Array.isArray(res.leaders)) {
        setRatingLeaders(res.leaders);
      }
    } catch (e: any) {
      console.warn('Ratings leaderboard fetch error:', e.message);
    } finally {
      setIsLoadingLeaders(false);
    }
  };

  useEffect(() => {
    loadPublicMatches(true);
    loadPortalData();
    loadRatingsLeaderboard();

    // Real-time Socket.IO Live Score Synchronization (Zero-Flicker targeted updates)
    let socket: any = null;
    try {
      socket = io(SOCKET_URL, { timeout: 5000, reconnectionAttempts: 3 });
      socket.on('score:update', (payload: any) => {
        // Targeted in-place update without re-fetching entire portal
        if (payload?.matchId) {
          setPublicMatches(prev => prev.map(m => {
            if (m.id === payload.matchId) {
              const latestDelivery = payload.lastDelivery || payload.lastEvent || m.lastDelivery;
              return {
                ...m,
                scoreA: payload.scoreA !== undefined ? payload.scoreA : (payload.battingTeamId === m.teamAId ? payload.score : m.scoreA),
                scoreB: payload.scoreB !== undefined ? payload.scoreB : (payload.battingTeamId === m.teamBId ? payload.score : m.scoreB),
                lastDelivery: latestDelivery,
                lastEvent: latestDelivery,
                currentInnings: payload.currentInnings || m.currentInnings,
                status: payload.status || m.status,
                rawStatus: payload.status || m.rawStatus,
                statusText: payload.statusText || m.statusText,
                liveText: payload.liveText || m.liveText
              };
            }
            return m;
          }));
        } else {
          loadPublicMatches(false);
        }
      });
    } catch (e) {
      // Fallback to active interval
    }

    // Background match sync poll (Socket.IO already handles real-time live events)
    const matchTimer = setInterval(() => {
      loadPublicMatches(false);
    }, 20000);

    const portalTimer = setInterval(() => {
      loadPortalData();
    }, 60000);

    return () => {
      clearInterval(matchTimer);
      clearInterval(portalTimer);
      if (socket) socket.disconnect();
    };
  }, []);

  const handleOpenScorecard = (matchItem: any) => {
    if (!matchItem?.id) return;
    navigate('Scorecard', { matchId: matchItem.id, returnTo: 'Home' });
  };

  const handleOpenGoogleMaps = (venueMapsUrl?: string, venueName?: string) => {
    const v = (venueName || 'Kamarajar District Stadium, Virudhunagar').trim();
    let url = venueMapsUrl && venueMapsUrl.startsWith('http') ? venueMapsUrl : '';
    if (!url) {
      const query = encodeURIComponent(
        v.toLowerCase().includes('virudhunagar') || v.toLowerCase().includes('tamil nadu')
          ? v
          : `${v}, Virudhunagar, Tamil Nadu`
      );
      url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(url).catch((err) => {
        console.warn('Failed to open maps URL:', err);
        Alert.alert('Location Map', `Location: ${v}`);
      });
    }
  };

  const getTeamBadgeColor = (short: string, index: number) => {
    const palette = ['#1e3a8a', '#78350f', '#065f46', '#4c1d95', '#831843', '#0f766e', '#312e81', '#475569'];
    let hash = 0;
    const s = short || 'TEAM';
    for (let i = 0; i < s.length; i++) {
      hash = (hash << 5) - hash + s.charCodeAt(i);
    }
    return palette[Math.abs(hash + index) % palette.length];
  };

  // State: Points Table Filter
  const [pointsTableKey, setPointsTableKey] = useState<string>('div1');

  // State: Performance Stats Filter (default to ⭐ ratings)
  const [perfTab, setPerfTab] = useState<'ratings' | 'batting' | 'bowling' | 'fielding'>('ratings');

  // State: District Players
  const [playerFilter, setPlayerFilter] = useState<string>('all');
  const [playerSearchQuery, setPlayerSearchQuery] = useState<string>('');
  const [selectedPlayerModal, setSelectedPlayerModal] = useState<DistrictPlayer | null>(null);

  // State: Operations Hub
  const [activeOpTab, setActiveOpTab] = useState<string>('admin');
  const [adminSubTab, setAdminSubTab] = useState<'colleges' | 'approval'>('colleges');
  const [collegesList, setCollegesList] = useState<CollegeItem[]>(INITIAL_COLLEGES);

  // Add College Form State
  const [newColName, setNewColName] = useState('');
  const [newColTaluk, setNewColTaluk] = useState('Virudhunagar');
  const [newColHead, setNewColHead] = useState('');
  const [newColTeams, setNewColTeams] = useState('2');
  const [newColGround, setNewColGround] = useState('');

  // Live Scoring Playground State
  const [selectedOvers, setSelectedOvers] = useState<number>(20);
  const [customOvers, setCustomOvers] = useState<string>('20');
  const [tossWinner, setTossWinner] = useState('Virudhunagar Strikers');
  const [tossDecision, setTossDecision] = useState('bowl');
  const [tossAnnouncement, setTossAnnouncement] = useState(
    'Virudhunagar Strikers won the toss and elected to BOWL FIRST (20.0 Overs).'
  );

  // Modals State
  const [scorecardModalVisible, setScorecardModalVisible] = useState(false);
  const [activeScorecardMatch, setActiveScorecardMatch] = useState<string>('match-1');
  const [lightboxImage, setLightboxImage] = useState<{ uri: any; caption: string } | null>(null);
  const [activeNewsModal, setActiveNewsModal] = useState<{ title: string; date: string; content: string } | null>(null);

  // Official ICC & TNCA Umpire Signals Broadcast Overlay State
  const [activeUmpireSignal, setActiveUmpireSignal] = useState<UmpireSignalEvent | null>(null);
  const [showUmpireGallery, setShowUmpireGallery] = useState<boolean>(false);

  // Handlers
  const handleAddCollege = () => {
    if (!newColName.trim()) {
      Alert.alert('Validation Error', 'Please enter college name.');
      return;
    }
    const newCol: CollegeItem = {
      id: `col-${Date.now()}`,
      name: newColName,
      taluk: newColTaluk,
      teams: parseInt(newColTeams, 10) || 1,
      head: newColHead || 'Sports Incharge',
      ground: newColGround || 'Turf Pitch & Nets',
      phone: '+91 94430 00000'
    };
    setCollegesList([newCol, ...collegesList]);
    setNewColName('');
    setNewColHead('');
    setNewColGround('');
    Alert.alert('Success', `${newCol.name} successfully registered in Federation Admin Setup!`);
  };

  const handleRecordToss = () => {
    const text = `${tossWinner} won the toss and elected to ${tossDecision.toUpperCase()} FIRST (${selectedOvers}.0 Overs).`;
    setTossAnnouncement(text);
    Alert.alert('Toss Decision', `Toss Decision Recorded!\n\n${text}`);
  };

  // District Special Milestone Players loaded strictly from Database (MongoDB)
  const allDisplayPlayers = portalAllPlayers.filter(p => {
    // Strictly exclude any player with 0 runs and 0 wickets (e.g. unplayed roster entries)
    const runs = p.stats?.runs || 0;
    const wkts = p.stats?.wkts || 0;
    const hs = parseInt(p.stats?.hs || '0', 10);
    const hasMilestone =
      p.milestoneType ||
      hs >= 50 ||
      runs >= 50 ||
      wkts >= 3 ||
      (p.stats?.hundreds && p.stats.hundreds > 0) ||
      (p.stats?.fifties && p.stats.fifties > 0) ||
      (p.stats?.best && (p.stats.best.startsWith('3/') || p.stats.best.startsWith('4/') || p.stats.best.startsWith('5/')));
    return !!hasMilestone;
  });

  const filteredPlayers = allDisplayPlayers.filter(p => {
    const hs = parseInt(p.stats?.hs || '0', 10);
    const wkts = p.stats?.wkts || 0;
    const hundreds = p.stats?.hundreds || 0;
    const fifties = p.stats?.fifties || 0;

    let matchesCategory = true;
    if (playerFilter === 'century') {
      matchesCategory = p.milestoneType === 'century' || hundreds > 0 || hs >= 100;
    } else if (playerFilter === 'fifty') {
      matchesCategory = p.milestoneType === 'fifty' || (fifties > 0 && hundreds === 0) || (hs >= 50 && hs < 100);
    } else if (playerFilter === 'bowler') {
      matchesCategory =
        p.milestoneType === 'bowling_haul' ||
        wkts >= 3 ||
        (p.stats?.best && (p.stats.best.startsWith('3/') || p.stats.best.startsWith('4/') || p.stats.best.startsWith('5/')));
    } else if (playerFilter === 'womens') {
      matchesCategory = p.role === 'womens' || p.category === 'womens';
    }

    const q = playerSearchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.team && p.team.toLowerCase().includes(q)) ||
      (p.taluk && p.taluk.toLowerCase().includes(q)) ||
      (p.roleLabel && p.roleLabel.toLowerCase().includes(q)) ||
      (p.playingRole && p.playingRole.toLowerCase().includes(q)) ||
      (p.milestoneBadge && p.milestoneBadge.toLowerCase().includes(q)) ||
      (p.matchPerformance && p.matchPerformance.toLowerCase().includes(q)) ||
      (p.matchVs && p.matchVs.toLowerCase().includes(q));

    return matchesCategory && matchesSearch;
  });

  return (
    <View style={styles.rootContainer}>
      <StatusBar style="light" />

      {/* SOLID CLEAN PAGE BACKGROUND (NO BACKGROUND IMAGE) */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#f6f2e9', pointerEvents: 'none' as const }]} />

      {/* TOP HEADER / NAVBAR (Extracted Layout Component) */}
      <Header
        sessionUser={sessionUser}
        onLogout={handleLogout}
        onNavigateToUserPortal={handleNavigateToUserPortal}
        scrollToSection={scrollToSection}
        onSelectCategory={(category: any) => {
          if (category === 'tournaments') {
            scrollToSection('tournaments');
          } else if (category === 'fixtures') {
            setMatchFilter('upcoming');
            setMatchPage(1);
            scrollToSection('matchCentre');
          } else if (category === 'results') {
            setMatchFilter('results');
            setMatchPage(1);
            scrollToSection('matchCentre');
          } else if (category === 'pointsTable') {
            scrollToSection('pointsTable');
          } else if (category === 'stats') {
            scrollToSection('stats');
          } else if (category === 'rules') {
            scrollToSection('rules');
          } else if (category === 'clubs') {
            scrollToSection('clubs');
          } else if (category === 'grounds') {
            scrollToSection('grounds');
          } else if (category === 'news' || category === 'photos') {
            scrollToSection('news');
          }
        }}
        onScrollToTop={() => {
          if (Platform.OS === 'web' && typeof document !== 'undefined') {
            try {
              const scrollNode =
                (mainScrollRef.current as any)?.getScrollableNode?.() ||
                (mainScrollRef.current as any)?._nativeRef ||
                document.querySelector('div[class*="r-overflowY"]');
              if (scrollNode && typeof scrollNode.scrollTo === 'function') {
                scrollNode.scrollTo({ top: 0, behavior: 'smooth' });
              }
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } catch (_e) {}
          }
          mainScrollRef.current?.scrollTo({ y: 0, animated: true });
        }}
        isMobile={isMobile}
        mobileNavOpen={mobileNavOpen}
        setMobileNavOpen={setMobileNavOpen}
      />

      {/* ─── LIVE TICKER BAR (DIRECTLY BELOW NAVBAR) ────────────────────── */}
      <View style={styles.liveTickerBar}>
        <View style={styles.liveTickerInner}>
          {/* Crimson Live Ticker Badge */}
          <View style={styles.liveTickerBadge}>
            <View style={styles.liveTickerDot} />
            <Text style={styles.liveTickerBadgeText}>LIVE TICKER</Text>
          </View>

          {/* Marquee Updates Content */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.liveTickerScrollView}
            contentContainerStyle={styles.liveTickerScrollContent}
          >
            {(() => {
              const liveM = publicMatches.find(m => (m.status || '').toLowerCase() === 'live' || (m.rawStatus || '').toUpperCase() === 'LIVE');
              const compM = publicMatches.filter(m => (m.status || '').toLowerCase() === 'completed' || (m.rawStatus || '').toUpperCase() === 'COMPLETED');
              return (
                <TouchableOpacity
                  onPress={() => {
                    if (liveM) handleOpenScorecard(liveM);
                    else if (publicMatches[0]) handleOpenScorecard(publicMatches[0]);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.liveTickerText}>
                    {liveM ? (
                      <>
                        <Text style={styles.tickerMatchHighlight}>
                          {`LIVE: ${liveM.teamA} ${liveM.scoreA || ''} vs ${liveM.teamB}${liveM.scoreB && liveM.scoreB !== 'Yet to bat' ? ' ' + liveM.scoreB : ' (Yet to bat)'} — ${liveM.current_innings_number === 2 ? '2nd Innings in Progress' : '1st Innings in Progress'}`}
                        </Text>
                        {'   •   '}
                      </>
                    ) : null}
                    {compM.map((cm, i) => (
                      <React.Fragment key={cm.id || i}>
                        <Text style={styles.tickerPrefix}>{cm.teamA} vs {cm.teamB}:</Text>
                        <Text style={styles.tickerMatchHighlight}>{` ${cm.scoreA || ''} vs ${cm.scoreB || ''}`}</Text>
                        {` — ${cm.result || cm.result_summary || 'Match Concluded'}${i < compM.length - 1 ? '   •   ' : ''}`}
                      </React.Fragment>
                    ))}
                    {publicMatches.length === 0 && (
                      <Text style={styles.tickerPrefix}>Cricket Federation of Virudhunagar District • Official Match Centre</Text>
                    )}
                  </Text>
                </TouchableOpacity>
              );
            })()}
          </ScrollView>

          {/* Right Links */}
          {!isMobile && (
            <View style={styles.tickerLinksRow}>
              <TouchableOpacity
                style={styles.tickerLinkItem}
                onPress={() =>
                  setActiveNewsModal({
                    title: 'Official District League By-Laws & Code 2026',
                    date: 'Adopted: October 2025 • Governing Council',
                    content:
                      'The Cricket Federation of Virudhunagar District (CFVD) Constitution & League By-Laws govern all affiliated clubs, collegiate institutions, and sanctioned district tournaments. Key provisions include mandatory certified digital scoring, strict age-verification protocols, umpire panel match reports, and standardized disciplinary tribunals.'
                  })
                }
              >
                <Ionicons name="document-text-outline" size={13} color="#475569" style={{ marginRight: 5 }} />
                <Text style={styles.tickerLinkText}>League By-Laws</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.tickerLinkItem}
                onPress={() =>
                  setActiveNewsModal({
                    title: 'District Sports Integrity & Anti-Corruption Protocol',
                    date: 'CFVD Integrity Unit Notice',
                    content:
                      'Zero tolerance policy for match manipulation, unauthorized betting, or unsportsmanlike conduct across all Virudhunagar district league fixtures. Anonymous grievance reporting and whistleblower protection are guaranteed by the CFVD Integrity Commission.'
                  })
                }
              >
                <Ionicons name="shield-checkmark-outline" size={13} color="#475569" style={{ marginRight: 5 }} />
                <Text style={styles.tickerLinkText}>Sports Integrity</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* MAIN SCROLLABLE CONTENT */}
      <ScrollView
        ref={mainScrollRef}
        style={styles.mainScroll}
        contentContainerStyle={styles.mainScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── 1. PRESTIGIOUS ATHLETIC HERO SECTION ──────────────── */}
        <View style={styles.oasoHeroSection}>
          {/* Deep Athletic Light Gradient matching Clean Federation Theme */}
          <LinearGradient
            colors={[
              '#ffffff',
              '#fbf9f4',
              '#f6f2e9'
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Subtle Decorative Atmosphere Rings */}
          <View style={styles.heroDecoRing1} pointerEvents="none" />
          <View style={styles.heroDecoRing2} pointerEvents="none" />

          {/* Bootstrap Responsive Container */}
          <View style={[styles.container, containerResponsiveStyle, styles.oasoHeroContainer]}>
            <View style={[styles.oasoHeroRow, isMobile && styles.oasoHeroRowMobile]}>
              
              {/* Left Column: Bold Headline & Actions */}
              <View style={[styles.oasoHeroContentCol, isMobile && styles.oasoHeroContentColMobile]}>
                
                {/* Overline Badge */}
                <View style={[
                  styles.oasoOverlineBadge,
                  isMobile && { alignSelf: 'center', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 6, gap: 6 }
                ]}>
                  <View style={styles.oasoPulseGoldDot} />
                  <Text style={[
                    styles.oasoOverlineText,
                    isMobile && { textAlign: 'center', flexShrink: 1 },
                    isSmallMobile && { fontSize: 9.5 }
                  ]}>
                    CRICKET FEDERATION OF VIRUDHUNAGAR DISTRICT
                  </Text>
                  <View style={styles.oasoAffiliatedBadge}>
                    <Text style={[styles.oasoAffiliatedBadgeText, isSmallMobile && { fontSize: 8.5 }]}>OFFICIAL UNIT</Text>
                  </View>
                </View>

                {/* Big, Condensed Bold Headline matching OASO Typography */}
                <Text style={[
                  styles.oasoHeroTitle,
                  isMobile && styles.oasoHeroTitleMobile,
                  isSmallMobile && { fontSize: 32, lineHeight: 36 }
                ]}>
                  CHASING{'\n'}
                  <Text style={{ color: '#b45309' }}>CRICKET{'\n'}EXCELLENCE</Text>{'\n'}
                  TOGETHER
                </Text>

                {/* Punchy Tagline / Extra Headline Content */}
                <View style={[{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }, isMobile && { justifyContent: 'center' }]}>
                  <Ionicons name="flash" size={14} color="#d97706" style={{ marginRight: 6 }} />
                  <Text style={[styles.oasoHeroTagline, isMobile && { textAlign: 'center' }, { marginBottom: 0 }]}>
                    EMPOWERING TALENT • FOSTERING PASSION • UNITING CHAMPIONS
                  </Text>
                </View>

               <Text
              style={[
                styles.heroDescription,
                isMobile && {
                  textAlign: 'center',
                  alignSelf: 'center',
                  fontSize: 13,
                  lineHeight: 20,
                  color: '#1e293b',
                  marginBottom: 22,
                  paddingHorizontal: 4,
                }
              ]}
            >
              Governing, developing, and fostering grassroots, collegiate, and competitive cricket across
              Srivilliputhur, Sivakasi, Rajapalayam, Sattur, Aruppukottai, and Virudhunagar under the official
              authority of Cricket Federation of Virudhunagar District.
            </Text>

            {/* 3 Hero Action Buttons */}
            <View
              style={[
                styles.heroButtonsRow,
                isMobile && {
                  flexDirection: isSmallMobile ? 'column' : 'row',
                  justifyContent: 'center',
                  alignSelf: 'center',
                  gap: 10,
                  marginBottom: 24,
                  width: '100%',
                }
              ]}
            >
              {/* 1. Match Centre Live (Solid Navy with Gold Border) */}
              <TouchableOpacity
                style={[
                  styles.heroBtnNavy,
                  isMobile && {
                    flex: isSmallMobile ? undefined : 1,
                    width: isSmallMobile ? '100%' : undefined,
                    minWidth: isSmallMobile ? '100%' : 140,
                    maxWidth: isSmallMobile ? '100%' : 200,
                    justifyContent: 'center',
                  }
                ]}
                onPress={() => scrollToSection('matchCentre')}
                activeOpacity={0.85}
              >
                <Animated.View style={[styles.heroRedDot, { opacity: pulseAnim }]} />
                <Text style={styles.heroBtnNavyText} numberOfLines={1}>Match Centre Live</Text>
              </TouchableOpacity>

              {/* 3. Live Scorecard (Solid Crisp White) */}
              <TouchableOpacity
                style={[
                  styles.heroBtnWhite,
                  isMobile && {
                    flex: isSmallMobile ? undefined : 1,
                    width: isSmallMobile ? '100%' : undefined,
                    minWidth: isSmallMobile ? '100%' : 140,
                    maxWidth: isSmallMobile ? '100%' : 200,
                    justifyContent: 'center',
                  }
                ]}
                onPress={() => {
                  const targetMatch = publicMatches.find(m => (m.status || '').toLowerCase() === 'live') || publicMatches[0] || { id: 'M001' };
                  handleOpenScorecard(targetMatch);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.heroBtnWhiteText} numberOfLines={1}>📡 Live Scorecard</Text>
              </TouchableOpacity>

              {/* 4. Watch Intro Video (Professional Preloader Replay) */}
              <TouchableOpacity
                style={[
                  styles.heroBtnWhite,
                  { backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(245, 158, 11, 0.7)' },
                  isMobile && {
                    flex: isSmallMobile ? undefined : 1,
                    width: isSmallMobile ? '100%' : undefined,
                    minWidth: isSmallMobile ? '100%' : 140,
                    maxWidth: isSmallMobile ? '100%' : 200,
                    justifyContent: 'center',
                  }
                ]}
                onPress={() => setShowIntroVideo(true)}
                activeOpacity={0.85}
              >
                <Text style={[styles.heroBtnWhiteText, { color: '#fbbf24', fontWeight: '800' }]} numberOfLines={1}>🎬 Watch Intro</Text>
              </TouchableOpacity>
            </View>

              </View>

              {/* Right Column: CFVD Crest inside Container */}
              <View style={[styles.oasoHeroCrestCol, isMobile && styles.oasoHeroCrestColMobile]}>
                <View
                  style={[
                    styles.oasoCrestAuraRing,
                    isMobile && {
                      width: Math.min(windowWidth * 0.88, 340),
                      height: Math.min(windowWidth * 0.88, 340),
                      borderRadius: Math.min(windowWidth * 0.88, 340) / 2
                    }
                  ]}
                />
                <View
                  pointerEvents="none"
                  style={[
                    styles.oasoCrestAuraRing,
                    isMobile && {
                      width: Math.min(windowWidth * 0.88, 340),
                      height: Math.min(windowWidth * 0.88, 340),
                      borderRadius: Math.min(windowWidth * 0.88, 340) / 2
                    }
                  ]}
                />
                <View
                  pointerEvents="none"
                  style={[
                    styles.oasoCrestAuraRingInner,
                    isMobile && {
                      width: Math.min(windowWidth * 0.72, 260),
                      height: Math.min(windowWidth * 0.72, 260),
                      borderRadius: Math.min(windowWidth * 0.72, 260) / 2
                    }
                  ]}
                />
                
                {/* Crest Wrapper with Stealth Hotspots */}
                <View
                  style={[
                    styles.stealthCrestWrapper,
                    {
                      width: isMobile ? Math.min(windowWidth * 0.88, 360) : 460,
                      height: isMobile ? Math.min(windowWidth * 0.88, 360) : 460,
                    }
                  ]}
                >
                  <Image
                    source={IMG_LOGO}
                    style={[
                      styles.oasoCrestImage,
                      {
                        width: isMobile ? Math.min(windowWidth * 0.88, 360) : 460,
                        height: isMobile ? Math.min(windowWidth * 0.88, 360) : 460,
                      }
                    ]}
                    resizeMode="contain"
                  />

                  {/* Stealth Developer Mode Hotspot: Left Ball (9 o'clock position on crest) */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleSecretBallTap('LEFT')}
                    style={[styles.stealthBallHotspot, { left: '0%', top: '35%', width: '28%', height: '28%' }]}
                    accessibilityRole="button"
                    accessibilityLabel="Crest emblem left"
                  />

                  {/* Stealth Developer Mode Hotspot: Right Ball (3 o'clock position on crest) */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleSecretBallTap('RIGHT')}
                    style={[styles.stealthBallHotspot, { right: '0%', top: '35%', width: '28%', height: '28%' }]}
                    accessibilityRole="button"
                    accessibilityLabel="Crest emblem right"
                  />

                  {/* Stealth Developer Mode Hotspot: Center Ball (in flight near batsman swing) */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleSecretBallTap('CENTER')}
                    style={[styles.stealthBallHotspot, { left: '52%', top: '23%', width: '28%', height: '26%' }]}
                    accessibilityRole="button"
                    accessibilityLabel="Crest emblem center"
                  />
                </View>

                <View style={styles.oasoCrestFloatingBadge}>
                  <Ionicons name="shield-checkmark" size={13} color="#059669" style={{ marginRight: 5 }} />
                  <Text style={styles.oasoCrestFloatingText}>Official District Governing Body • CFVD</Text>
                </View>
              </View>

            </View>
            {/* Description */}
          </View>
        </View>

        {/* ─── 4. OFFICIAL MATCH CENTRE ───────────────────────────────────── */}
        <View
          nativeID="cfvd-section-match-centre"
          {...({ id: 'cfvd-section-match-centre' } as any)}
          style={styles.section}
          onLayout={e => {
            const layout = e.nativeEvent.layout;
            setSectionPositions(prev => ({ ...prev, matchCentre: layout.y }));
          }}
        >
          <View style={[styles.container, containerResponsiveStyle]}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTagBadge}>
                <MaterialCommunityIcons name="cricket" size={15} color="#0e184e" style={{ marginRight: 6 }} />
                <Text style={styles.sectionTagBadgeText}>OFFICIAL MATCH CENTRE</Text>
              </View>
              <Text style={[styles.sectionTitle, isSmallMobile && { fontSize: 20 }]}>Official Matches, Fixtures & Results</Text>
              <Text style={styles.sectionSubtitle}>
                Real-time coverage displaying complete logistics: Match Date, Time, Venues & Assigned Officials
              </Text>
            </View>

            {/* Broadcast Match Highlights & Milestones Showcase */}
            <MatchHighlightsBanner />

            {/* Filter Tabs */}
            {(() => {
              const liveCount = publicMatches.filter(m => {
                const s = (m.status || '').toLowerCase();
                const raw = (m.rawStatus || '').toUpperCase();
                return s === 'live' || raw === 'LIVE' || raw === 'INNINGS_BREAK';
              }).length;

              const upcomingCount = publicMatches.filter(m => {
                const s = (m.status || '').toLowerCase();
                const raw = (m.rawStatus || '').toUpperCase();
                const isPostponed = s === 'postponed' || raw === 'POSTPONED' || !!m.isPostponed || !!m.postponement?.is_postponed;
                return !isPostponed && (s === 'upcoming' || raw === 'SCHEDULED');
              }).length;

              const postponedCount = publicMatches.filter(m => {
                const s = (m.status || '').toLowerCase();
                const raw = (m.rawStatus || '').toUpperCase();
                return s === 'postponed' || raw === 'POSTPONED' || !!m.isPostponed || !!m.postponement?.is_postponed;
              }).length;

              const resultsCount = publicMatches.filter(m => {
                const s = (m.status || '').toLowerCase();
                const raw = (m.rawStatus || '').toUpperCase();
                return s === 'completed' || raw === 'COMPLETED' || s === 'cancelled' || raw === 'CANCELLED';
              }).length;

              return (
                <View style={[styles.filterTabsRow, isSmallMobile && { gap: 6, marginBottom: 14 }]}>
                  {[
                    { id: 'all', short: `All (${publicMatches.length})`, full: `All Matches (${publicMatches.length})`, icon: 'grid-outline' },
                    { id: 'live', short: `Live (${liveCount})`, full: `Live Matches (${liveCount})`, icon: 'ellipse', iconColor: '#ef4444' },
                    { id: 'upcoming', short: `Upcoming (${upcomingCount})`, full: `Upcoming Fixtures (${upcomingCount})`, icon: 'calendar-outline' },
                    { id: 'postponed', short: `Postponed (${postponedCount})`, full: `Postponed (${postponedCount})`, icon: 'pause-circle-outline' },
                    { id: 'results', short: `Results (${resultsCount})`, full: `Recent Results (${resultsCount})`, icon: 'flag-outline' }
                  ].map(f => (
                    <TouchableOpacity
                      key={f.id}
                      style={[
                        styles.filterTabBtn,
                        matchFilter === f.id && styles.filterTabBtnActive,
                        isSmallMobile && { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 18 }
                      ]}
                      onPress={() => {
                        setMatchFilter(f.id as any);
                        setMatchPage(1);
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {f.icon && (
                          <Ionicons
                            name={f.icon as any}
                            size={f.id === 'live' ? 8 : 12}
                            color={matchFilter === f.id ? '#ffffff' : (f.iconColor || '#64748b')}
                            style={{ marginRight: 5 }}
                          />
                        )}
                        <Text
                          style={[
                            styles.filterTabBtnText,
                            matchFilter === f.id && styles.filterTabBtnTextActive,
                            isSmallMobile && { fontSize: 11 }
                          ]}
                        >
                          {isSmallMobile ? f.short : f.full}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })()}

            {/* Loading State: Official Bootstrap Spinner */}
            {isLoadingMatches && publicMatches.length === 0 && (
              <View style={{ paddingVertical: 40, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color="#0e184e" />
                <Text style={{ marginTop: 12, color: bsColors.secondary, fontSize: 13, fontWeight: '600' }}>
                  Loading official fixtures & results...
                </Text>
              </View>
            )}
            {/* Error State: Bootstrap Alert Danger */}
            {!isLoadingMatches && matchesError && publicMatches.length === 0 && (
              <View
                style={[
                  bsAlert.alert,
                  bsAlert.alertDanger,
                  { flexDirection: 'column', alignItems: 'center', padding: 20 }
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Ionicons name="warning-outline" size={16} color={bsColors.danger} style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: bsColors.danger }}>
                    Unable to load match records
                  </Text>
                </View>
                <Text style={{ fontSize: 13, color: '#842029', textAlign: 'center', marginBottom: 14 }}>
                  {matchesError}
                </Text>
                <TouchableOpacity
                  style={[bsButtons.btn, bsButtons.btnOutlineDanger, bsButtons.btnSm, { flexDirection: 'row', alignItems: 'center' }]}
                  onPress={() => loadPublicMatches(true)}
                >
                  <Ionicons name="refresh" size={13} color={bsColors.danger} style={{ marginRight: 5 }} />
                  <Text style={[bsButtons.btnTextDanger, { fontSize: 12 }]}>Retry Connection</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Matches List Filtering and Reusable Pagination (8 matches per page) */}
            {!isLoadingMatches && !matchesError && (() => {
              const filteredList = publicMatches.filter(m => {
                const s = (m.status || '').toLowerCase();
                const raw = (m.rawStatus || '').toUpperCase();
                const isPostponed = s === 'postponed' || raw === 'POSTPONED' || !!m.isPostponed || !!m.postponement?.is_postponed;
                if (matchFilter === 'live') return !isPostponed && (s === 'live' || raw === 'LIVE' || raw === 'INNINGS_BREAK');
                if (matchFilter === 'upcoming') return !isPostponed && (s === 'upcoming' || raw === 'SCHEDULED');
                if (matchFilter === 'postponed') return isPostponed;
                if (matchFilter === 'results') return !isPostponed && (s === 'completed' || raw === 'COMPLETED' || s === 'cancelled' || raw === 'CANCELLED');
                return true;
              });

              if (filteredList.length === 0) {
                return (
                  <View
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      padding: 40,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginVertical: 12
                    }}
                  >
                    <MaterialCommunityIcons name="cricket" size={40} color="#94a3b8" style={{ marginBottom: 8 }} />
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 4 }}>
                      No Matches Found
                    </Text>
                    <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center' }}>
                      There are currently no {matchFilter !== 'all' ? matchFilter : ''} matches recorded in the database.
                    </Text>
                  </View>
                );
              }

              const totalMatchPages = Math.ceil(filteredList.length / MATCHES_PER_PAGE) || 1;
              const safeCurrentPage = Math.min(matchPage, totalMatchPages);
              const paginatedMatches = filteredList.slice(
                (safeCurrentPage - 1) * MATCHES_PER_PAGE,
                safeCurrentPage * MATCHES_PER_PAGE
              );

              return (
                <View>
                  <View style={[styles.grid2Col, isMobile && { flexDirection: 'column', flexWrap: 'nowrap' }]}>
                    {paginatedMatches.map(m => {
                    const s = (m.status || '').toLowerCase();
                    const raw = (m.rawStatus || '').toUpperCase();
                    const isPostponed = s === 'postponed' || raw === 'POSTPONED' || !!m.isPostponed || !!m.postponement?.is_postponed;
                    const isLive = !isPostponed && (s === 'live' || raw === 'LIVE' || raw === 'INNINGS_BREAK');
                    const isUpcoming = !isPostponed && (s === 'upcoming' || raw === 'SCHEDULED');
                    const isCompleted = !isPostponed && (s === 'completed' || raw === 'COMPLETED');
                    const isCancelled = !isPostponed && (s === 'cancelled' || raw === 'CANCELLED' || raw === 'ABANDONED');

                    const teamAShort = m.teamAShort || (m.teamA ? m.teamA.slice(0, 3).toUpperCase() : 'TMA');
                    const teamBShort = m.teamBShort || (m.teamB ? m.teamB.slice(0, 3).toUpperCase() : 'TMB');

                    const isRain = m.currentBreak && (m.currentBreak.type || '').toLowerCase().includes('rain');
                    const isBreak = !!m.currentBreak;

                    // Clean logistics without redundant labels
                    const rawDate = m.date || m.match_date || 'TBD';
                    const cleanDate = rawDate.replace(/\s+\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?/i, '').trim();
                    const cleanTime = m.match_time || (rawDate.match(/\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)/i) ? rawDate.match(/\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)/i)[0] : '');
                    const cleanVenue = (m.venue || 'District Sports Complex, Virudhunagar').replace(/^Venue:\s*/i, '').trim();
                    const cleanOfficials = m.assigned_scorer_id ? `${m.assigned_scorer_id} • Federation Umpires` : 'Assigned District Panel Officials';

                    return (
                      <View
                        key={m.id}
                        style={[
                          styles.matchCard,
                          isLive && styles.matchCardLive,
                          isUpcoming && styles.matchCardUpcoming,
                          isCompleted && styles.matchCardResult,
                          isPostponed && { borderColor: '#f59e0b', backgroundColor: '#fffdf5' },
                          !isMobile && { flex: 1 },
                          isMobile && { width: '100%', minWidth: '100%', maxWidth: '100%' },
                          isSmallMobile && { padding: 12, borderRadius: 14 }
                        ]}
                      >
                        {/* 1. Top Header Row: Live / Status & Tournament on Left, Rain Delay & Format on Right */}
                        <View style={styles.matchCardTop}>
                          <View style={styles.cardHeaderLeftGroup}>
                            {isLive ? (
                              <View style={[styles.liveIndicatorPill, isSmallMobile && { paddingHorizontal: 7, paddingVertical: 2.5 }]}>
                                <Animated.View style={[styles.pulseRedDot, { opacity: pulseAnim }]} />
                                <Text style={[styles.liveIndicatorText, isSmallMobile && { fontSize: 9.5 }]}>LIVE</Text>
                              </View>
                            ) : isUpcoming ? (
                              <View style={[styles.upcomingIndicatorPill, isSmallMobile && { paddingHorizontal: 7, paddingVertical: 2.5 }, { flexDirection: 'row', alignItems: 'center' }]}>
                                <Ionicons name="time-outline" size={11} color="#0284c7" style={{ marginRight: 3 }} />
                                <Text style={[styles.upcomingIndicatorText, isSmallMobile && { fontSize: 9.5 }]}>UPCOMING</Text>
                              </View>
                            ) : isPostponed ? (
                              <View style={[styles.upcomingIndicatorPill, { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }, isSmallMobile && { paddingHorizontal: 7, paddingVertical: 2.5 }, { flexDirection: 'row', alignItems: 'center' }]}>
                                <Ionicons name="pause-circle-outline" size={11} color="#b45309" style={{ marginRight: 3 }} />
                                <Text style={[styles.upcomingIndicatorText, { color: '#b45309' }, isSmallMobile && { fontSize: 9.5 }]}>POSTPONED</Text>
                              </View>
                            ) : isCompleted ? (
                              <View style={[styles.resultIndicatorPill, isSmallMobile && { paddingHorizontal: 7, paddingVertical: 2.5 }, { flexDirection: 'row', alignItems: 'center' }]}>
                                <Ionicons name="flag-outline" size={11} color="#059669" style={{ marginRight: 3 }} />
                                <Text style={[styles.resultIndicatorText, isSmallMobile && { fontSize: 9.5 }]}>RESULT</Text>
                              </View>
                            ) : (
                              <View
                                style={[
                                  styles.upcomingIndicatorPill,
                                  { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' },
                                  isSmallMobile && { paddingHorizontal: 7, paddingVertical: 2.5 },
                                  { flexDirection: 'row', alignItems: 'center' }
                                ]}
                              >
                                <Ionicons name="close-circle-outline" size={11} color="#64748b" style={{ marginRight: 3 }} />
                                <Text style={[styles.upcomingIndicatorText, { color: '#64748b' }, isSmallMobile && { fontSize: 9.5 }]}>CANCELLED</Text>
                              </View>
                            )}
                            <Text style={[styles.matchTournament, isSmallMobile && { fontSize: 11.5 }]} numberOfLines={1}>
                              {m.tournament || m.tournament_name || 'District Match'}
                            </Text>
                          </View>

                          <View style={styles.cardHeaderRightGroup}>
                            {isLive && <VPLSoundControls role="public" style={{ marginRight: 6 }} />}
                            {isRain ? (
                              <View style={[styles.topRightRainPill, isSmallMobile && { paddingHorizontal: 6, paddingVertical: 2 }, { flexDirection: 'row', alignItems: 'center' }]}>
                                <Ionicons name="rainy-outline" size={11} color="#0284c7" style={{ marginRight: 3 }} />
                                <Text style={[styles.topRightRainPillText, isSmallMobile && { fontSize: 9 }]}>
                                  RAIN DELAY{m.currentBreak?.duration ? ` (${m.currentBreak.duration}m)` : ''}
                                </Text>
                              </View>
                            ) : isBreak ? (
                              <View style={[styles.topRightBreakPill, isSmallMobile && { paddingHorizontal: 6, paddingVertical: 2 }, { flexDirection: 'row', alignItems: 'center' }]}>
                                <Ionicons name="cafe-outline" size={11} color="#d97706" style={{ marginRight: 3 }} />
                                <Text style={[styles.topRightBreakPillText, isSmallMobile && { fontSize: 9 }]}>
                                  {m.currentBreak?.type?.toUpperCase()}
                                </Text>
                              </View>
                            ) : null}

                            <View
                              style={[
                                m.format === '3-DAY'
                                  ? styles.formatBadgeMulti
                                  : m.format === 'ODI' || m.format === '50-OVERS'
                                    ? styles.formatBadgeOneDay
                                    : styles.formatBadgeT20,
                                isSmallMobile && { paddingHorizontal: 6, paddingVertical: 2 }
                              ]}
                            >
                              <Text style={[styles.formatBadgeText, isSmallMobile && { fontSize: 9 }]}>
                                {m.format || 'T20'}{m.revisedOvers || m.revised_overs ? ` (${m.revisedOvers || m.revised_overs} Ov)` : (m.overs ? ` (${m.overs} Ov)` : ' (20 Ov)')}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* 2. Teams & Scores in a Single Professional Row (Team 1 VS Team 2) */}
                        <View
                          style={[
                            styles.matchTeamsSingleRow,
                            isSmallMobile && { paddingHorizontal: 8, paddingVertical: 10, borderRadius: 12, marginVertical: 6 }
                          ]}
                        >
                          {/* Team A (Left) */}
                          <View style={[styles.teamColLeft, isSmallMobile && { minWidth: 0 }]}>
                            <View style={styles.teamCrestNameRow}>
                              {resolveImageUrl(m.teamALogo) ? (
                                <Image
                                  source={{ uri: resolveImageUrl(m.teamALogo)! }}
                                  style={[
                                    styles.teamMiniCrest,
                                    { resizeMode: 'cover', overflow: 'hidden' },
                                    isSmallMobile && { width: 24, height: 24, borderRadius: 12 }
                                  ]}
                                />
                              ) : (
                                <View
                                  style={[
                                    styles.teamMiniCrest,
                                    { backgroundColor: getTeamBadgeColor(teamAShort, 0) },
                                    isSmallMobile && { width: 24, height: 24, borderRadius: 12 }
                                  ]}
                                >
                                  <Text style={[styles.teamMiniCrestText, isSmallMobile && { fontSize: 9 }]}>{teamAShort}</Text>
                                </View>
                              )}
                              <Text style={[styles.teamNameTextSingleRow, isSmallMobile && { fontSize: 12 }]} numberOfLines={1}>
                                {m.teamA}
                              </Text>
                              {isLive && <MaterialCommunityIcons name="cricket" size={12} color="#f5c43d" style={{ marginLeft: 4 }} />}
                            </View>
                            <Text
                              style={[
                                m.scoreA && m.scoreA !== 'Yet to bat' ? styles.teamScoreSingleRow : styles.teamYetToBatSingleRow,
                                isSmallMobile && { fontSize: isTinyMobile ? 12.5 : 13.5 }
                              ]}
                              numberOfLines={1}
                            >
                              {m.scoreA || (isUpcoming ? 'Upcoming' : 'Yet to bat')}
                            </Text>
                          </View>

                          {/* Center VS Badge */}
                          <View style={[styles.iplVsCenterBox, isSmallMobile && { paddingHorizontal: 4 }]}>
                            <View style={[styles.iplVsCircle, isSmallMobile && { width: 26, height: 26, borderRadius: 13 }]}>
                              <Text style={[styles.iplVsCircleText, isSmallMobile && { fontSize: 8.5 }]}>VS</Text>
                            </View>
                          </View>

                          {/* Team B (Right) */}
                          <View style={[styles.teamColRight, isSmallMobile && { minWidth: 0 }]}>
                            <View style={[styles.teamCrestNameRow, { justifyContent: 'flex-end' }]}>
                              <Text style={[styles.teamNameTextSingleRow, { textAlign: 'right' }, isSmallMobile && { fontSize: 12 }]} numberOfLines={1}>
                                {m.teamB}
                              </Text>
                              {resolveImageUrl(m.teamBLogo) ? (
                                <Image
                                  source={{ uri: resolveImageUrl(m.teamBLogo)! }}
                                  style={[
                                    styles.teamMiniCrest,
                                    { resizeMode: 'cover', overflow: 'hidden' },
                                    isSmallMobile && { width: 24, height: 24, borderRadius: 12 }
                                  ]}
                                />
                              ) : (
                                <View
                                  style={[
                                    styles.teamMiniCrest,
                                    { backgroundColor: getTeamBadgeColor(teamBShort, 1) },
                                    isSmallMobile && { width: 24, height: 24, borderRadius: 12 }
                                  ]}
                                >
                                  <Text style={[styles.teamMiniCrestText, isSmallMobile && { fontSize: 9 }]}>{teamBShort}</Text>
                                </View>
                              )}
                            </View>
                            <Text
                              style={[
                                m.scoreB && m.scoreB !== 'Yet to bat' ? styles.teamScoreSingleRow : styles.teamYetToBatSingleRow,
                                { textAlign: 'right' },
                                isSmallMobile && { fontSize: isTinyMobile ? 12.5 : 13.5 }
                              ]}
                              numberOfLines={1}
                            >
                              {m.scoreB || (isUpcoming ? 'Upcoming' : 'Yet to bat')}
                            </Text>
                          </View>
                        </View>

                        {/* VPL Broadcast Live Ball Action Overlay */}
                        {isLive && (() => {
                          const lastDel = m.lastDelivery || m.lastEvent;
                          const rawExtra = normalizeExtraType(lastDel?.extraType || lastDel?.extra_type || lastDel?.extra);
                          const runsBat = typeof lastDel?.runsBatter === 'number'
                            ? lastDel.runsBatter
                            : typeof lastDel?.runs_batter === 'number'
                              ? lastDel.runs_batter
                              : (typeof lastDel?.runs === 'number' && !rawExtra ? lastDel.runs : 0);
                          const events = lastDel ? mapBallToEvents({
                            ballId: `${m.id}-${lastDel.ball || lastDel.over || ''}-${lastDel.timestamp || Date.now()}`,
                            runsOffBat: runsBat,
                            extraType: rawExtra,
                            extraRuns: typeof lastDel.extraRuns === 'number' ? lastDel.extraRuns : (typeof lastDel.runsExtras === 'number' ? lastDel.runsExtras : undefined),
                            isWicket: Boolean(lastDel.isWicket || lastDel.wicket),
                            dismissal: normalizeDismissal(lastDel.dismissal || lastDel.wicket?.type || lastDel.wicket_type),
                            dismissedName: lastDel.dismissedName || lastDel.wicket?.batter,
                            batterName: lastDel.batterName || m.teamA,
                            bowlerName: lastDel.bowlerName,
                          }) : null;

                          return (
                            <View style={{ position: 'relative', minHeight: 48, marginVertical: 4 }}>
                              <VPLEventBanner
                                role="public"
                                events={events}
                                bottomOffset={0}
                                style={{ position: 'relative', left: 0, right: 0, top: 0, bottom: 0 }}
                              />
                            </View>
                          );
                        })()}

                        {/* 3. Status Note / Active Rain Delay Notice */}
                        {isPostponed ? (
                          <View style={[styles.cardBreakBanner, { backgroundColor: '#fffbeb', borderColor: '#fde68a', flexDirection: 'row', alignItems: 'center' }, isSmallMobile && { paddingVertical: 6, paddingHorizontal: 8 }]}>
                            <Ionicons name="pause-circle-outline" size={13} color="#b45309" style={{ marginRight: 5 }} />
                            <Text style={[styles.cardBreakText, { color: '#b45309' }, isSmallMobile && { fontSize: 10.5 }]} numberOfLines={1}>
                              POSTPONED{m.postponement?.reason ? ` • ${m.postponement.reason}` : (m.postponementReason ? ` • ${m.postponementReason}` : (m.result ? ` • ${m.result}` : ' • Fixture Rescheduling in Progress'))}
                            </Text>
                          </View>
                        ) : m.result ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="trophy" size={12} color="#f5c43d" style={{ marginRight: 5 }} />
                            <Text style={[styles.matchStatusNoteGold, isSmallMobile && { fontSize: 11 }]}>{m.result}</Text>
                          </View>
                        ) : isRain ? (
                          <View style={[styles.cardRainBanner, { flexDirection: 'row', alignItems: 'center' }, isSmallMobile && { paddingVertical: 6, paddingHorizontal: 8 }]}>
                            <Ionicons name="rainy-outline" size={13} color="#0284c7" style={{ marginRight: 5 }} />
                            <Text style={[styles.cardRainText, isSmallMobile && { fontSize: 10.5 }]} numberOfLines={1}>
                              MATCH DELAYED DUE TO RAIN • Covers on pitch{m.currentBreak.startTime && m.currentBreak.endTime ? ` (${m.currentBreak.startTime} - ${m.currentBreak.endTime})` : ''}
                            </Text>
                          </View>
                        ) : isBreak ? (
                          <View style={[styles.cardBreakBanner, { flexDirection: 'row', alignItems: 'center' }, isSmallMobile && { paddingVertical: 6, paddingHorizontal: 8 }]}>
                            <Ionicons name="cafe-outline" size={13} color="#d97706" style={{ marginRight: 5 }} />
                            <Text style={[styles.cardBreakText, isSmallMobile && { fontSize: 10.5 }]} numberOfLines={1}>
                              {m.currentBreak.type?.toUpperCase()} IN PROGRESS{m.currentBreak.duration ? ` (${m.currentBreak.duration} MINS)` : ''}{m.currentBreak.startTime && m.currentBreak.endTime ? ` • ${m.currentBreak.startTime} - ${m.currentBreak.endTime}` : ''}
                            </Text>
                          </View>
                        ) : isLive ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="time-outline" size={12} color="#f5c43d" style={{ marginRight: 4 }} />
                            <Text style={[styles.matchStatusNoteGold, isSmallMobile && { fontSize: 11 }]}>
                              Live Inning in Progress ({m.overs || 20} Overs)
                            </Text>
                          </View>
                        ) : isUpcoming ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="calendar-outline" size={12} color="#475569" style={{ marginRight: 4 }} />
                            <Text style={[styles.matchStatusNote, isSmallMobile && { fontSize: 11 }]}>
                              Match Scheduled: {cleanDate} {cleanTime}
                            </Text>
                          </View>
                        ) : isCancelled ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="close-circle-outline" size={12} color="#ef4444" style={{ marginRight: 4 }} />
                            <Text style={[styles.matchStatusNote, { color: '#ef4444' }, isSmallMobile && { fontSize: 11 }]}>
                              Match Cancelled: {m.result || 'Cancelled by Federation Admin'}
                            </Text>
                          </View>
                        ) : (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="information-circle-outline" size={12} color="#475569" style={{ marginRight: 4 }} />
                            <Text style={[styles.matchStatusNote, isSmallMobile && { fontSize: 11 }]}>Status: {m.status}</Text>
                          </View>
                        )}

                        {/* 4. Bottom Logistics Box */}
                        <View style={[styles.cardLogisticsBottomBar, isSmallMobile && { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 }]}>
                          <View style={[styles.logisticsChipRow, isSmallMobile && { gap: 6, marginBottom: 4 }]}>
                            <View style={styles.logisticsChip}>
                              <Ionicons name="calendar-outline" size={13} color="#475569" style={{ marginRight: 4 }} />
                              <Text style={[styles.logisticsValueText, isSmallMobile && { fontSize: 10 }]}>{cleanDate}</Text>
                            </View>
                            {cleanTime ? (
                              <View style={styles.logisticsChip}>
                                <Ionicons name="time-outline" size={13} color="#475569" style={{ marginRight: 4 }} />
                                <Text style={[styles.logisticsValueText, isSmallMobile && { fontSize: 10 }]}>{cleanTime}</Text>
                              </View>
                            ) : null}

                            <View style={[styles.logisticsChip, { flex: 1, minWidth: isSmallMobile ? '100%' : 'auto' }]}>
                              <Ionicons name="location-outline" size={13} color="#475569" style={{ marginRight: 4 }} />
                              <Text style={[styles.logisticsValueText, isSmallMobile && { fontSize: 10 }]} numberOfLines={1}>{cleanVenue}</Text>
                            </View>
                          </View>
                          <View style={styles.logisticsOfficialsBottomRow}>
                            <Ionicons name="shield-checkmark-outline" size={13} color="#475569" style={{ marginRight: 5 }} />
                            <Text style={[styles.logisticsOfficialsCleanText, isSmallMobile && { fontSize: 9.5 }]} numberOfLines={1}>
                              {cleanOfficials}
                            </Text>
                          </View>
                        </View>

                        {/* 5. Action CTA (TNCA Match Centre Button) */}
                        <TouchableOpacity
                          style={[styles.tncaMatchCentreCardBtn, isSmallMobile && { paddingVertical: 8 }]}
                          onPress={() => handleOpenScorecard(m)}
                          activeOpacity={0.85}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                            {isLive ? (
                              <>
                                <Ionicons name="radio" size={13} color="#ffffff" style={{ marginRight: 6 }} />
                                <Text style={[styles.tncaMatchCentreCardBtnText, isSmallMobile && { fontSize: 11 }]}>
                                  Match Centre (Live Scorecard)
                                </Text>
                                <Ionicons name="chevron-forward" size={13} color="#ffffff" style={{ marginLeft: 4 }} />
                              </>
                            ) : isCompleted ? (
                              <>
                                <Ionicons name="bar-chart-outline" size={13} color="#ffffff" style={{ marginRight: 6 }} />
                                <Text style={[styles.tncaMatchCentreCardBtnText, isSmallMobile && { fontSize: 11 }]}>
                                  Match Centre (Review & Wagon Wheel)
                                </Text>
                                <Ionicons name="chevron-forward" size={13} color="#ffffff" style={{ marginLeft: 4 }} />
                              </>
                            ) : isUpcoming ? (
                              <>
                                <Ionicons name="calendar-outline" size={13} color="#ffffff" style={{ marginRight: 6 }} />
                                <Text style={[styles.tncaMatchCentreCardBtnText, isSmallMobile && { fontSize: 11 }]}>
                                  Match Centre (Fixture Details)
                                </Text>
                              </>
                            ) : (
                              <>
                                <Ionicons name="information-circle-outline" size={13} color="#ffffff" style={{ marginRight: 6 }} />
                                <Text style={[styles.tncaMatchCentreCardBtnText, isSmallMobile && { fontSize: 11 }]}>
                                  Match Centre (Match Details)
                                </Text>
                              </>
                            )}
                          </View>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>

                {/* Reusable Bootstrap Pagination (8 matches per page) */}
                <BootstrapPagination
                  currentPage={safeCurrentPage}
                  totalPages={totalMatchPages}
                  onPageChange={(newPage) => {
                    setMatchPage(newPage);
                    scrollToSection('matchCentre');
                  }}
                  totalItems={filteredList.length}
                  pageSize={MATCHES_PER_PAGE}
                  itemLabel="matches"
                />
              </View>
            );
          })()}
          </View>
        </View>

        {/* ─── 5. SANCTIONED TOURNAMENTS ─────────────────────────────────── */}
        <View
          nativeID="cfvd-section-tournaments"
          {...({ id: 'cfvd-section-tournaments' } as any)}
          style={styles.section}
          onLayout={e => {
            const layout = e.nativeEvent.layout;
            setSectionPositions(prev => ({ ...prev, tournaments: layout.y }));
          }}
        >
          <View style={[styles.container, containerResponsiveStyle]}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTagBadge}>
                <Ionicons name="trophy-outline" size={15} color="#0e184e" style={{ marginRight: 6 }} />
                <Text style={styles.sectionTagBadgeText}>LEAGUE STRUCTURE</Text>
              </View>
              <Text style={[styles.sectionTitle, isSmallMobile && { fontSize: 20 }]}>Official Sanctioned Tournaments</Text>
              <Text style={styles.sectionSubtitle}>
                Promoting multi-day red-ball traditional cricket and modern white-ball collegiate and district leagues
              </Text>
            </View>

            {(() => {
              const totalTournamentPages = Math.ceil(portalTournaments.length / TOURNAMENTS_PER_PAGE) || 1;
              const safeTournamentPage = Math.min(tournamentPage, totalTournamentPages);
              const paginatedTournaments = portalTournaments.slice(
                (safeTournamentPage - 1) * TOURNAMENTS_PER_PAGE,
                safeTournamentPage * TOURNAMENTS_PER_PAGE
              );

              return (
                <>
                  <View style={[styles.grid2Col, isMobile && { flexDirection: 'column', flexWrap: 'nowrap' }]}>
                    {portalTournaments.length === 0 ? (
                      <View style={{ width: '100%', padding: 28, alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
                        <Ionicons name="trophy-outline" size={30} color="#94a3b8" style={{ marginBottom: 8 }} />
                        <Text style={{ color: '#0f172a', fontWeight: '800', fontSize: 15 }}>No Official Tournaments Published Yet</Text>
                        <Text style={{ color: '#64748b', fontSize: 12.5, textAlign: 'center', marginTop: 4 }}>
                          Tournaments created by the association admin will appear here automatically.
                        </Text>
                      </View>
                    ) : (
                      paginatedTournaments.map((t: any, idx: number) => {
                        const teamsCount = Array.isArray(t.teams) && t.teams.length > 0 ? t.teams.length : (t.max_teams || 16);
                        const formatLabel = t.match_format || t.format || 'T20';
                        const dateRange = t.start_date && t.end_date
                          ? `${t.start_date} – ${t.end_date}`
                          : (t.start_date || `Season ${t.season || '2026-27'}`);
                        const statusLabel = (t.status || 'UPCOMING').replace(/_/g, ' ');
                        const isOpenForReg = t.status === 'REGISTRATION_OPEN';

                        return (
                          <View
                            key={t.id || idx}
                            style={[
                              styles.tournamentCard,
                              !isMobile && { flex: 1 },
                              isMobile && { width: '100%', minWidth: '100%', maxWidth: '100%' },
                              isSmallMobile && { padding: 12 }
                            ]}
                          >
                            <View style={[styles.tBadgeWrap, { flexWrap: 'wrap' }]}>
                              <Text style={styles.badgeGoldPill}>{t.category || 'District League'}</Text>
                              <Text style={styles.badgeBluePill}>{formatLabel}{t.overs_per_match ? ` • ${t.overs_per_match} Ov` : ''}</Text>
                              <Text style={t.status === 'ONGOING' || t.status === 'ACTIVE' ? styles.badgeGreenPill : styles.badgeRedPill}>
                                {statusLabel}
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
                              <Ionicons name="trophy-outline" size={24} color="#0e184e" style={{ marginRight: 8 }} />
                              <Text style={[styles.tourneyTitle, { flex: 1, marginBottom: 0 }]}>{t.name}</Text>
                            </View>
                            <Text style={styles.tourneySub}>
                              {t.short_name ? `${t.short_name} • ` : ''}{t.ball_type || 'Leather Ball'} ({t.gender || 'Men'})
                            </Text>
                            <Text style={styles.tourneyDesc} numberOfLines={3}>
                              {t.description || `Official ${formatLabel} competition sanctioned by the Cricket Association of Virudhunagar District.`}
                            </Text>
                            <View style={styles.tourneySpecs}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                <Ionicons name="people-outline" size={13} color="#475569" style={{ marginRight: 6 }} />
                                <Text style={styles.tourneySpecItem}>{teamsCount} Participating Teams</Text>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                <Ionicons name="calendar-outline" size={13} color="#475569" style={{ marginRight: 6 }} />
                                <Text style={styles.tourneySpecItem}>{dateRange}</Text>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="location-outline" size={13} color="#b45309" style={{ marginRight: 6 }} />
                                <Text style={styles.tourneySpecItem}>{t.venue || 'Kamarajar District Stadium'}</Text>
                              </View>
                            </View>
                            <View style={styles.tourneyFooter}>
                              <TouchableOpacity
                                style={styles.btnOutlineGoldSm}
                                onPress={() => {
                                  setPointsTableKey(t.id);
                                  setStandingsPage(1);
                                  loadTournamentStandings(t.id);
                                  scrollToSection('pointsTable');
                                }}
                              >
                                <Text style={styles.btnOutlineGoldSmText}>View Table</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.btnPrimarySm}
                                onPress={() => {
                                  if (isOpenForReg) {
                                    navigate('Registration');
                                  } else {
                                    scrollToSection('matchCentre');
                                  }
                                }}
                              >
                                <Text style={styles.btnPrimarySmText}>{isOpenForReg ? 'Register Team' : 'View Matches'}</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>

                  <BootstrapPagination
                    currentPage={safeTournamentPage}
                    totalPages={totalTournamentPages}
                    onPageChange={(p) => setTournamentPage(p)}
                    totalItems={portalTournaments.length}
                    pageSize={TOURNAMENTS_PER_PAGE}
                    itemLabel="tournaments"
                  />
                </>
              );
            })()}
          </View>
        </View>

        
        {/* ─── 6. POINTS TABLE / STANDINGS ───────────────────────────────── */}
        <View
          nativeID="cfvd-section-points-table"
          {...({ id: 'cfvd-section-points-table' } as any)}
          style={styles.section}
          onLayout={e => {
            const layout = e.nativeEvent.layout;
            setSectionPositions(prev => ({ ...prev, pointsTable: layout.y }));
          }}
        >
          <View style={[styles.container, containerResponsiveStyle]}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTagBadge}>
                <Ionicons name="podium-outline" size={15} color="#0e184e" style={{ marginRight: 6 }} />
                <Text style={styles.sectionTagBadgeText}>LEAGUE STANDINGS</Text>
              </View>
              <Text style={[styles.sectionTitle, isSmallMobile && { fontSize: 20 }]}>Official League Points Table 2026-27</Text>
              <Text style={styles.sectionSubtitle}>
                Updated in accordance with official District Federation League points calculation rules
              </Text>
            </View>

            {/* Dynamic Tournament Select Dropdown + Right-Side Search Bar */}
            {(() => {
              const dynamicTabs = portalTournaments.length > 0
                ? portalTournaments.map((t: any) => ({ id: t.id, label: t.short_name || t.name }))
                : [{ id: 'overall', label: 'Overall District Standings' }];

              return (
                <View style={{
                  flexDirection: isMobile ? 'column' : 'row',
                  justifyContent: 'space-between',
                  alignItems: isMobile ? 'stretch' : 'center',
                  gap: 12,
                  marginBottom: 16,
                  width: '100%'
                }}>
                  <View style={[
                    styles.playerSearchBar,
                    { marginBottom: 0, flex: isMobile ? undefined : 1, width: isMobile ? '100%' : undefined, minWidth: isMobile ? '100%' : 220, height: 38, paddingHorizontal: 10 }
                  ]}>
                    <Ionicons name="search" size={15} color="#64748b" style={{ marginRight: 6 }} />
                    <TextInput
                      style={[styles.playerSearchInput, { fontSize: 12.5, paddingVertical: 4 }]}
                      placeholder="Search team or club..."
                      placeholderTextColor="#62799c"
                      value={standingsSearchQuery}
                      onChangeText={(txt) => {
                        setStandingsSearchQuery(txt);
                        setStandingsPage(1);
                      }}
                    />
                    {standingsSearchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => { setStandingsSearchQuery(''); setStandingsPage(1); }}>
                        <Ionicons name="close-circle" size={16} color="#94a3b8" style={{ paddingLeft: 4 }} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                    {renderSelectBox(
                      'Tournament',
                      pointsTableKey,
                      dynamicTabs,
                      (id) => {
                        setPointsTableKey(id);
                        setStandingsPage(1);
                        if (id !== 'overall') {
                          loadTournamentStandings(id);
                        }
                      },
                      240
                    )}
                  </View>
                </View>
              );
            })()}

            {/* Standings Table with Reusable Pagination (8 teams per page) */}
            {(() => {
              const rawStandingsList = portalTournaments.length > 0
                ? (tournamentPointsTable.length > 0 ? tournamentPointsTable : portalPointsTable)
                : portalPointsTable;
              const sQuery = standingsSearchQuery.trim().toLowerCase();
              const fullStandingsList = sQuery
                ? rawStandingsList.filter((r: any) =>
                    (r.team_name || r.teamName || r.name || '').toLowerCase().includes(sQuery) ||
                    (r.shortName || r.short_name || '').toLowerCase().includes(sQuery) ||
                    (r.sub || '').toLowerCase().includes(sQuery)
                  )
                : rawStandingsList;
              const totalStandingsPages = Math.ceil(fullStandingsList.length / STANDINGS_PER_PAGE) || 1;
              const safeStandingsPage = Math.min(standingsPage, totalStandingsPages);
              const paginatedStandings = fullStandingsList.slice(
                (safeStandingsPage - 1) * STANDINGS_PER_PAGE,
                safeStandingsPage * STANDINGS_PER_PAGE
              );

              return (
                <View style={{ width: '100%' }}>
                  {isLoadingPointsTable ? (
                    <View style={{ padding: 28, alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', maxWidth: 820, width: '100%', alignSelf: 'center' }}>
                      <ActivityIndicator size="small" color="#d97706" />
                      <Text style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>Loading Tournament Standings...</Text>
                    </View>
                  ) : fullStandingsList.length === 0 ? (
                    <View style={{ padding: 28, alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', maxWidth: 820, width: '100%', alignSelf: 'center' }}>
                      <Ionicons name="podium-outline" size={28} color="#94a3b8" style={{ marginBottom: 8 }} />
                      <Text style={{ color: '#0f172a', fontWeight: '800', fontSize: 14 }}>No Standings Available Yet</Text>
                      <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                        Points table will update automatically once teams and matches are recorded in this tournament.
                      </Text>
                    </View>
                  ) : isMobile ? (
                    /* Mobile Responsive Standings View - 100% Screen Width, Zero Horizontal Scroll */
                    <View style={styles.mobileStandingsBox}>
                      {paginatedStandings.map((row: any, idx: number) => {
                        const globalIdx = (safeStandingsPage - 1) * STANDINGS_PER_PAGE + idx;
                        const standNum = row.position || row.pos || row.stand || (globalIdx + 1);
                        const isGold = standNum === 1;
                        const isSilver = standNum === 2;
                        const isBronze = standNum === 3;
                        const teamTitle = row.team_name || row.teamName || row.name || 'District Club';
                        const teamSubtitle = row.sub || (standNum <= 2 ? 'Qualified for Knockouts' : 'In Contention');
                        const pPlayed = row.played ?? row.p ?? 0;
                        const pWon = row.won ?? row.w ?? 0;
                        const pLost = row.lost ?? row.l ?? 0;
                        const pNr = row.no_result ?? row.nr ?? row.tied ?? 0;
                        const pNrr = row.nrr_formatted || (typeof row.nrr === 'number' ? (row.nrr > 0 ? `+${row.nrr.toFixed(3)}` : row.nrr.toFixed(3)) : (row.nrr ?? '+0.000'));
                        const pPts = row.points ?? row.pts ?? 0;
                        const pForm = Array.isArray(row.recent_form) ? row.recent_form : (Array.isArray(row.form) ? row.form : []);

                        return (
                          <View key={row.team_id || row.teamId || idx} style={[styles.mobileStandingsCard, standNum <= 3 && styles.mobileStandingsCardQualified]}>
                            <View style={styles.mobileStandingsCardTop}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
                                <View
                                  style={[
                                    styles.rankBadge,
                                    isGold
                                      ? styles.rankBadgeGold
                                      : isSilver
                                        ? styles.rankBadgeSilver
                                        : isBronze
                                          ? styles.rankBadgeBronze
                                          : null,
                                    { marginRight: 8, width: 24, height: 24, borderRadius: 12 }
                                  ]}
                                >
                                  <Text style={styles.rankBadgeText}>{standNum}</Text>
                                </View>
                                {resolveImageUrl(row.logo || row.photo || row.image_path) ? (
                                  <Image
                                    source={{ uri: resolveImageUrl(row.logo || row.photo || row.image_path)! }}
                                    style={{ width: 24, height: 24, borderRadius: 4, marginRight: 8, resizeMode: 'cover' }}
                                  />
                                ) : null}
                                <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                                  <Text style={styles.pointsTeamName} numberOfLines={1}>{teamTitle}</Text>
                                  <Text style={styles.pointsTeamSub} numberOfLines={1}>{teamSubtitle}</Text>
                                </View>
                              </View>
                              <View style={styles.mobilePtsBadge}>
                                <Text style={styles.mobilePtsBadgeNum}>{pPts}</Text>
                                <Text style={styles.mobilePtsBadgeLabel}>PTS</Text>
                              </View>
                            </View>

                            <View style={styles.mobileStandingsCardDivider} />

                            <View style={styles.mobileStandingsCardStatsRow}>
                              <View style={styles.mobileStandingsStatItem}>
                                <Text style={styles.mobileStatLabel}>P</Text>
                                <Text style={styles.mobileStatVal}>{pPlayed}</Text>
                              </View>
                              <View style={styles.mobileStandingsStatItem}>
                                <Text style={styles.mobileStatLabel}>W</Text>
                                <Text style={[styles.mobileStatVal, { color: '#16a34a', fontWeight: '800' }]}>{pWon}</Text>
                              </View>
                              <View style={styles.mobileStandingsStatItem}>
                                <Text style={styles.mobileStatLabel}>L</Text>
                                <Text style={[styles.mobileStatVal, { color: '#dc2626' }]}>{pLost}</Text>
                              </View>
                              <View style={styles.mobileStandingsStatItem}>
                                <Text style={styles.mobileStatLabel}>NR</Text>
                                <Text style={styles.mobileStatVal}>{pNr}</Text>
                              </View>
                              <View style={[styles.mobileStandingsStatItem, { flex: 1.3 }]}>
                                <Text style={styles.mobileStatLabel}>NRR</Text>
                                <Text style={[styles.mobileStatVal, { color: '#0284c7', fontWeight: '700' }]}>{pNrr}</Text>
                              </View>
                              <View style={styles.mobileStandingsFormCol}>
                                <Text style={[styles.mobileStatLabel, { textAlign: 'right', marginBottom: 2 }]}>FORM</Text>
                                <View style={{ flexDirection: 'row', gap: 3, justifyContent: 'flex-end' }}>
                                  {pForm.slice(0, 4).map((f: string, fi: number) => (
                                    <View
                                      key={fi}
                                      style={[
                                        styles.formPillSm,
                                        String(f).toLowerCase() === 'w'
                                          ? styles.formPillW
                                          : String(f).toLowerCase() === 'l'
                                            ? styles.formPillL
                                            : styles.formPillNR
                                      ]}
                                    >
                                      <Text style={styles.formPillTextSm}>{String(f).toUpperCase()}</Text>
                                    </View>
                                  ))}
                                </View>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    /* Desktop Wide Tabular View */
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: '100%' }} contentContainerStyle={{ flexGrow: 1, width: '100%' }}>
                      <View style={styles.tableBox}>
                        <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableTh, { width: 60, textAlign: 'center' }]}>Stand</Text>
                        <Text style={[styles.tableTh, { flex: 2.4, minWidth: 220 }]}>Team / Club / College</Text>
                        <Text style={[styles.tableTh, { flex: 0.5, minWidth: 45, textAlign: 'center' }]}>P</Text>
                        <Text style={[styles.tableTh, { flex: 0.5, minWidth: 45, textAlign: 'center' }]}>W</Text>
                        <Text style={[styles.tableTh, { flex: 0.5, minWidth: 45, textAlign: 'center' }]}>L</Text>
                        <Text style={[styles.tableTh, { flex: 0.5, minWidth: 45, textAlign: 'center' }]}>NR</Text>
                        <Text style={[styles.tableTh, { flex: 0.6, minWidth: 60, textAlign: 'center' }]}>Bonus</Text>
                        <Text style={[styles.tableTh, { flex: 0.8, minWidth: 75, textAlign: 'center' }]}>NRR</Text>
                        <Text style={[styles.tableTh, { flex: 0.6, minWidth: 55, textAlign: 'center', color: '#0e184e', fontWeight: '800' }]}>PTS</Text>
                        <Text style={[styles.tableTh, { flex: 1.2, minWidth: 130, textAlign: 'center' }]}>Recent Form</Text>
                      </View>

                      {paginatedStandings.map((row: any, idx: number) => {
                        const globalIdx = (safeStandingsPage - 1) * STANDINGS_PER_PAGE + idx;
                        const standNum = row.position || row.pos || row.stand || (globalIdx + 1);
                        const isGold = standNum === 1;
                        const isSilver = standNum === 2;
                        const isBronze = standNum === 3;
                        const teamTitle = row.team_name || row.teamName || row.name || 'District Club';
                        const teamSubtitle = row.sub || (standNum <= 2 ? 'Qualified for Knockouts' : 'In Contention');
                        const pPlayed = row.played ?? row.p ?? 0;
                        const pWon = row.won ?? row.w ?? 0;
                        const pLost = row.lost ?? row.l ?? 0;
                        const pNr = row.no_result ?? row.nr ?? row.tied ?? 0;
                        const pBonus = row.bonus ?? 0;
                        const pNrr = row.nrr_formatted || (typeof row.nrr === 'number' ? (row.nrr > 0 ? `+${row.nrr.toFixed(3)}` : row.nrr.toFixed(3)) : (row.nrr ?? '+0.000'));
                        const pPts = row.points ?? row.pts ?? 0;
                        const pForm = Array.isArray(row.recent_form) ? row.recent_form : (Array.isArray(row.form) ? row.form : []);

                        return (
                          <View
                            key={row.team_id || row.teamId || idx}
                            style={[
                              styles.tableRow,
                              idx % 2 === 1 && styles.tableRowAlt,
                              standNum <= 3 && styles.tableRowQualified
                            ]}
                          >
                            <View style={{ width: 60, alignItems: 'center' }}>
                              <View
                                style={[
                                  styles.rankBadge,
                                  isGold
                                    ? styles.rankBadgeGold
                                    : isSilver
                                      ? styles.rankBadgeSilver
                                      : isBronze
                                        ? styles.rankBadgeBronze
                                        : null
                                ]}
                              >
                                <Text style={styles.rankBadgeText}>{standNum}</Text>
                              </View>
                            </View>
                            <View style={{ flex: 2.4, minWidth: 220, flexDirection: 'row', alignItems: 'center' }}>
                              {resolveImageUrl(row.logo || row.photo || row.image_path) ? (
                                <Image
                                  source={{ uri: resolveImageUrl(row.logo || row.photo || row.image_path)! }}
                                  style={{ width: 24, height: 24, borderRadius: 4, marginRight: 8, resizeMode: 'cover' }}
                                />
                              ) : null}
                              <View style={{ flex: 1 }}>
                                <Text style={styles.pointsTeamName}>{teamTitle}</Text>
                                <Text style={styles.pointsTeamSub}>{teamSubtitle}</Text>
                              </View>
                            </View>
                            <Text style={[styles.tableTd, { flex: 0.5, minWidth: 45, textAlign: 'center' }]}>{pPlayed}</Text>
                            <Text style={[styles.tableTd, { flex: 0.5, minWidth: 45, textAlign: 'center', fontWeight: '700' }]}>{pWon}</Text>
                            <Text style={[styles.tableTd, { flex: 0.5, minWidth: 45, textAlign: 'center' }]}>{pLost}</Text>
                            <Text style={[styles.tableTd, { flex: 0.5, minWidth: 45, textAlign: 'center', color: '#1e293b' }]}>
                              {pNr}
                            </Text>
                            <Text style={[styles.tableTd, { flex: 0.6, minWidth: 60, textAlign: 'center' }]}>{pBonus}</Text>
                            <Text style={[styles.tableTd, { flex: 0.8, minWidth: 75, textAlign: 'center' }]}>{pNrr}</Text>
                            <Text style={[styles.tableTd, { flex: 0.6, minWidth: 55, textAlign: 'center', color: '#0e184e', fontWeight: '800' }]}>
                              {pPts}
                            </Text>
                            <View style={{ flex: 1.2, minWidth: 130, flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
                              {pForm.map((f: string, fi: number) => (
                                <View
                                  key={fi}
                                  style={[
                                    styles.formPill,
                                    String(f).toLowerCase() === 'w'
                                      ? styles.formPillW
                                      : String(f).toLowerCase() === 'l'
                                        ? styles.formPillL
                                        : styles.formPillNR
                                  ]}
                                >
                                  <Text style={styles.formPillText}>{String(f).toUpperCase()}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                )}

                  {/* Reusable Bootstrap Pagination Component */}
                  <BootstrapPagination
                    currentPage={safeStandingsPage}
                    totalPages={totalStandingsPages}
                    onPageChange={(p) => setStandingsPage(p)}
                    totalItems={fullStandingsList.length}
                    pageSize={STANDINGS_PER_PAGE}
                    itemLabel="teams"
                  />
                </View>
              );
            })()}
          </View>
        </View>

        {/* ─── 7. PLAYER PERFORMANCE RECORDS ─────────────────────────────── */}
        <View
          nativeID="cfvd-section-stats"
          {...({ id: 'cfvd-section-stats' } as any)}
          style={styles.section}
          onLayout={e => {
            const layout = e.nativeEvent.layout;
            setSectionPositions(prev => ({ ...prev, stats: layout.y }));
          }}
        >
          <View style={[styles.container, containerResponsiveStyle]}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTagBadge}>
                <Ionicons name="trending-up-outline" size={15} color="#0e184e" style={{ marginRight: 6 }} />
                <Text style={styles.sectionTagBadgeText}>PERFORMANCE RECORDS</Text>
              </View>
              <Text style={[styles.sectionTitle, isSmallMobile && { fontSize: 20 }]}>Season 2026-27 Player Performance</Text>
              <Text style={styles.sectionSubtitle}>
                Batting (50s/100s, Role: Batter), Bowling (Runs, 3w/5w counts), and Fielding Stats across official competitions
              </Text>
            </View>

            {/* Left Search Bar + Right Performance Select Dropdowns */}
            <View style={{
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'stretch' : 'center',
              gap: 12,
              marginBottom: 14,
              width: '100%'
            }}>
              <View style={[
                styles.playerSearchBar,
                { marginBottom: 0, flex: isMobile ? undefined : 1, width: isMobile ? '100%' : undefined, minWidth: isMobile ? '100%' : 220, height: 38, paddingHorizontal: 10 }
              ]}>
                <Ionicons name="search" size={15} color="#64748b" style={{ marginRight: 6 }} />
                <TextInput
                  style={[styles.playerSearchInput, { fontSize: 12.5, paddingVertical: 4 }]}
                  placeholder="Search player, role, or team..."
                  placeholderTextColor="#62799c"
                  value={perfSearchQuery}
                  onChangeText={(txt) => {
                    setPerfSearchQuery(txt);
                    setPerfRatingsPage(1);
                    setPerfBattingPage(1);
                    setPerfBowlingPage(1);
                    setPerfFieldingPage(1);
                  }}
                />
                {perfSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => {
                    setPerfSearchQuery('');
                    setPerfRatingsPage(1);
                    setPerfBattingPage(1);
                    setPerfBowlingPage(1);
                    setPerfFieldingPage(1);
                  }}>
                    <Ionicons name="close-circle" size={16} color="#94a3b8" style={{ paddingLeft: 4 }} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                {renderSelectBox(
                  'Stats',
                  perfTab,
                  [
                    { id: 'ratings', label: 'Performance Ratings (0–10)' },
                    { id: 'batting', label: 'Batting Stats (Runs, 50/100s)' },
                    { id: 'bowling', label: 'Bowling Stats (Runs, 3w/5w)' },
                    { id: 'fielding', label: 'Fielding Stats (Catches, Stumpings)' }
                  ],
                  (id) => {
                    setPerfTab(id as any);
                    setPerfRatingsPage(1);
                    setPerfBattingPage(1);
                    setPerfBowlingPage(1);
                    setPerfFieldingPage(1);
                  },
                  230
                )}

                {perfTab === 'ratings' && renderSelectBox(
                  'Category',
                  ratingCategory,
                  [
                    { id: 'overall', label: 'Overall' },
                    { id: 'batting', label: 'Batting' },
                    { id: 'bowling', label: 'Bowling' }
                  ],
                  (id) => {
                    setRatingCategory(id as any);
                    setPerfRatingsPage(1);
                    loadRatingsLeaderboard(id as any, ratingFormat);
                  },
                  150
                )}

                {perfTab === 'ratings' && renderSelectBox(
                  'Format',
                  ratingFormat,
                  [
                    { id: 'ALL', label: 'All Formats' },
                    { id: 'T20', label: 'T20' },
                    { id: 'ONE_DAY', label: 'One-Day' }
                  ],
                  (id) => {
                    setRatingFormat(id as any);
                    setPerfRatingsPage(1);
                    loadRatingsLeaderboard(ratingCategory, id as any);
                  },
                  155
                )}
              </View>
            </View>

            {/* Dynamic Performance Table with Reusable Pagination (8 items per page) */}
            {(() => {
              const pQuery = perfSearchQuery.trim().toLowerCase();
              const matchesPerfQuery = (item: any) => !pQuery ||
                (item.playerName || item.name || '').toLowerCase().includes(pQuery) ||
                (item.role || '').toLowerCase().includes(pQuery) ||
                (item.team || item.teamShort || '').toLowerCase().includes(pQuery);

              // 1. Ratings Pagination Data
              const fullRatingsList = (ratingLeaders.length > 0 ? ratingLeaders : []).filter(matchesPerfQuery);
              const totalRatingsPages = Math.ceil(fullRatingsList.length / PERF_PER_PAGE) || 1;
              const safeRatingsPage = Math.min(perfRatingsPage, totalRatingsPages);
              const paginatedRatings = fullRatingsList.slice(
                (safeRatingsPage - 1) * PERF_PER_PAGE,
                safeRatingsPage * PERF_PER_PAGE
              );

              // 2. Batting Pagination Data
              const fullBattingList = (portalTopBatsmen.length > 0 ? portalTopBatsmen : PERF_DATA.batting).filter(matchesPerfQuery);
              const totalBattingPages = Math.ceil(fullBattingList.length / PERF_PER_PAGE) || 1;
              const safeBattingPage = Math.min(perfBattingPage, totalBattingPages);
              const paginatedBatting = fullBattingList.slice(
                (safeBattingPage - 1) * PERF_PER_PAGE,
                safeBattingPage * PERF_PER_PAGE
              );

              // 3. Bowling Pagination Data
              const fullBowlingList = (portalTopBowlers.length > 0 ? portalTopBowlers : PERF_DATA.bowling).filter(matchesPerfQuery);
              const totalBowlingPages = Math.ceil(fullBowlingList.length / PERF_PER_PAGE) || 1;
              const safeBowlingPage = Math.min(perfBowlingPage, totalBowlingPages);
              const paginatedBowling = fullBowlingList.slice(
                (safeBowlingPage - 1) * PERF_PER_PAGE,
                safeBowlingPage * PERF_PER_PAGE
              );

              // 4. Fielding Pagination Data
              const fullFieldingList = (portalTopFielders.length > 0 ? portalTopFielders : PERF_DATA.fielding).filter(matchesPerfQuery);
              const totalFieldingPages = Math.ceil(fullFieldingList.length / PERF_PER_PAGE) || 1;
              const safeFieldingPage = Math.min(perfFieldingPage, totalFieldingPages);
              const paginatedFielding = fullFieldingList.slice(
                (safeFieldingPage - 1) * PERF_PER_PAGE,
                safeFieldingPage * PERF_PER_PAGE
              );

              return (
                <View style={{ width: '100%' }}>
                  {isMobile ? (
                    <View style={styles.mobilePerfContainer}>
                      {perfTab === 'ratings' && (
                        isLoadingLeaders ? (
                          <View style={{ padding: 24, alignItems: 'center' }}>
                            <ActivityIndicator size="small" color="#f59e0b" />
                            <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 8 }}>Computing Player Ratings...</Text>
                          </View>
                        ) : paginatedRatings.length === 0 ? (
                          <View style={{ padding: 24, alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' }}>
                            <Ionicons name="star-outline" size={24} color="#94a3b8" style={{ marginBottom: 6 }} />
                            <Text style={{ color: '#0f172a', fontWeight: '700', fontSize: 13 }}>No Player Ratings Recorded Yet</Text>
                            <Text style={{ color: '#64748b', fontSize: 11, textAlign: 'center', marginTop: 3 }}>
                              Ratings will appear automatically once matches and innings are scored.
                            </Text>
                          </View>
                        ) : paginatedRatings.map((p: any, idx: number) => {
                          const globalIdx = (safeRatingsPage - 1) * PERF_PER_PAGE + idx;
                          const rank = globalIdx + 1;
                          const score = ratingCategory === 'batting' ? p.battingRating : (ratingCategory === 'bowling' ? p.bowlingRating : p.overallRating);
                          return (
                            <View key={p.playerId || idx} style={[styles.mobilePerfCard, rank <= 3 && styles.mobileStandingsCardQualified]}>
                              <View style={styles.mobilePerfCardTop}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
                                  <View style={[styles.rankBadge, rank === 1 ? styles.rankBadgeGold : rank === 2 ? styles.rankBadgeSilver : rank === 3 ? styles.rankBadgeBronze : null, { marginRight: 8, width: 24, height: 24, borderRadius: 12 }]}>
                                    <Text style={styles.rankBadgeText}>{rank}</Text>
                                  </View>
                                  <View style={{ flex: 1, minWidth: 0, paddingRight: 6 }}>
                                    <Text style={styles.pointsTeamName} numberOfLines={1}>{p.playerName}</Text>
                                    <Text style={styles.playerSubRole} numberOfLines={1}>{p.role || 'Player'}</Text>
                                  </View>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#fde68a' }}>
                                  <Text style={{ color: '#0e184e', fontWeight: '900', fontSize: 13 }}>
                                    {score !== null && score !== undefined ? `${Number(score).toFixed(1)}` : '—'}
                                  </Text>
                                  <Ionicons name="star" size={11} color="#d97706" style={{ marginLeft: 3 }} />
                                </View>
                              </View>
                              <View style={styles.mobileStandingsCardDivider} />
                              <View style={styles.mobileStandingsCardStatsRow}>
                                <View style={styles.mobileStandingsStatItem}>
                                  <Text style={styles.mobileStatLabel}>MAT</Text>
                                  <Text style={styles.mobileStatVal}>{p.matchesCount || 1}</Text>
                                </View>
                                <View style={styles.mobileStandingsStatItem}>
                                  <Text style={styles.mobileStatLabel}>CONF</Text>
                                  <Text style={[styles.mobileStatVal, { fontSize: 10, color: p.confidence === 'Established' ? '#15803d' : '#b45309' }]}>
                                    {p.confidence || 'Prov'}
                                  </Text>
                                </View>
                                <View style={styles.mobileStandingsStatItem}>
                                  <Text style={styles.mobileStatLabel}>BAT</Text>
                                  <Text style={styles.mobileStatVal}>{p.battingRating !== null && p.battingRating !== undefined ? `${Number(p.battingRating).toFixed(1)}` : '—'}</Text>
                                </View>
                                <View style={styles.mobileStandingsStatItem}>
                                  <Text style={styles.mobileStatLabel}>BOWL</Text>
                                  <Text style={styles.mobileStatVal}>{p.bowlingRating !== null && p.bowlingRating !== undefined ? `${Number(p.bowlingRating).toFixed(1)}` : '—'}</Text>
                                </View>
                                <View style={styles.mobileStandingsStatItem}>
                                  <Text style={styles.mobileStatLabel}>FIELD</Text>
                                  <Text style={styles.mobileStatVal}>{p.fieldingRating !== null && p.fieldingRating !== undefined ? `${Number(p.fieldingRating).toFixed(1)}` : '—'}</Text>
                                </View>
                              </View>
                            </View>
                          );
                        })
                      )}

                      {perfTab === 'batting' && (
                        paginatedBatting.map((p: any, idx: number) => {
                          const globalIdx = (safeBattingPage - 1) * PERF_PER_PAGE + idx;
                          const rank = p.stand || (globalIdx + 1);
                          return (
                            <View key={p.id || idx} style={styles.mobilePerfCard}>
                              <View style={styles.mobilePerfCardTop}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
                                  <View style={[styles.rankBadge, rank === 1 ? styles.rankBadgeGold : rank === 2 ? styles.rankBadgeSilver : rank === 3 ? styles.rankBadgeBronze : null, { marginRight: 8, width: 24, height: 24, borderRadius: 12 }]}>
                                    <Text style={styles.rankBadgeText}>{rank}</Text>
                                  </View>
                                  {resolveImageUrl(p.photo || p.image || p.image_path) ? (
                                    <Image
                                      source={{ uri: resolveImageUrl(p.photo || p.image || p.image_path)! }}
                                      style={{ width: 24, height: 24, borderRadius: 12, marginRight: 8, resizeMode: 'cover' }}
                                    />
                                  ) : null}
                                  <View style={{ flex: 1, minWidth: 0, paddingRight: 6 }}>
                                    <Text style={styles.pointsTeamName} numberOfLines={1}>{p.name}</Text>
                                    <Text style={styles.pointsTeamSub} numberOfLines={1}>{p.team || 'District Club'}</Text>
                                  </View>
                                </View>
                                <View style={styles.mobileRunsBadge}>
                                  <Text style={styles.mobileRunsBadgeNum}>{p.runs || 0}</Text>
                                  <Text style={styles.mobileRunsBadgeLabel}>RUNS</Text>
                                </View>
                              </View>
                              <View style={styles.mobileStandingsCardDivider} />
                              <View style={styles.mobileStandingsCardStatsRow}>
                                <View style={styles.mobileStandingsStatItem}>
                                  <Text style={styles.mobileStatLabel}>M / INN</Text>
                                  <Text style={styles.mobileStatVal}>{p.mat || 5}/{p.inns || 5}</Text>
                                </View>
                                <View style={styles.mobileStandingsStatItem}>
                                  <Text style={styles.mobileStatLabel}>HS</Text>
                                  <Text style={[styles.mobileStatVal, { color: '#b45309', fontWeight: '800' }]}>{p.hs || (p.runs ? p.runs + '*' : '50*')}</Text>
                                </View>
                                <View style={styles.mobileStandingsStatItem}>
                                  <Text style={styles.mobileStatLabel}>AVG</Text>
                                  <Text style={styles.mobileStatVal}>{p.average || p.avg || '35.0'}</Text>
                                </View>
                                <View style={styles.mobileStandingsStatItem}>
                                  <Text style={styles.mobileStatLabel}>SR</Text>
                                  <Text style={styles.mobileStatVal}>{p.strikeRate || p.sr || '135.0'}</Text>
                                </View>
                                <View style={styles.mobileStandingsStatItem}>
                                  <Text style={styles.mobileStatLabel}>50/100</Text>
                                  <Text style={styles.mobileStatVal}>{p.fifties ?? (p.runs >= 100 ? 1 : 0)}/{p.hundreds ?? 0}</Text>
                                </View>
                              </View>
                            </View>
                          );
                        })
                      )}

                      {perfTab === 'bowling' && (
                        paginatedBowling.map((p: any, idx: number) => {
                          const globalIdx = (safeBowlingPage - 1) * PERF_PER_PAGE + idx;
                          const rank = p.stand || (globalIdx + 1);
                          return (
                            <View key={p.id || idx} style={styles.mobilePerfCard}>
                              <View style={styles.mobilePerfCardTop}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
                                  <View style={[styles.rankBadge, rank === 1 ? styles.rankBadgeGold : rank === 2 ? styles.rankBadgeSilver : rank === 3 ? styles.rankBadgeBronze : null, { marginRight: 8, width: 24, height: 24, borderRadius: 12 }]}>
                                    <Text style={styles.rankBadgeText}>{rank}</Text>
                                  </View>
                                  {resolveImageUrl(p.photo || p.image || p.image_path) ? (
                                    <Image
                                      source={{ uri: resolveImageUrl(p.photo || p.image || p.image_path)! }}
                                      style={{ width: 24, height: 24, borderRadius: 12, marginRight: 8, resizeMode: 'cover' }}
                                    />
                                  ) : null}
                                  <View style={{ flex: 1, minWidth: 0, paddingRight: 6 }}>
                                    <Text style={styles.pointsTeamName} numberOfLines={1}>{p.name}</Text>
                                    <Text style={styles.pointsTeamSub} numberOfLines={1}>{p.team || 'District Club'}</Text>
                                  </View>
                                </View>
                                <View style={[styles.mobileRunsBadge, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                                  <Text style={[styles.mobileRunsBadgeNum, { color: '#16a34a' }]}>{p.wickets || 0}</Text>
                                  <Text style={[styles.mobileRunsBadgeLabel, { color: '#15803d' }]}>WKTS</Text>
                                </View>
                              </View>
                              <View style={styles.mobileStandingsCardDivider} />
                              <View style={styles.mobileStandingsCardStatsRow}>
                                <View style={styles.mobileStandingsStatItem}>
                                  <Text style={styles.mobileStatLabel}>M / INN</Text>
                                  <Text style={styles.mobileStatVal}>{p.mat || 5}/{p.inns || 5}</Text>
                                </View>
                                <View style={styles.mobileStandingsStatItem}>
                                  <Text style={styles.mobileStatLabel}>OVERS</Text>
                                  <Text style={styles.mobileStatVal}>{p.overs || '20.0'}</Text>
                                </View>
                                <View style={styles.mobileStandingsStatItem}>
                                  <Text style={styles.mobileStatLabel}>RUNS</Text>
                                  <Text style={styles.mobileStatVal}>{p.runs_conceded || p.runs || 120}</Text>
                                </View>
                                <View style={styles.mobileStandingsStatItem}>
                                  <Text style={styles.mobileStatLabel}>ECON</Text>
                                  <Text style={[styles.mobileStatVal, { color: '#0369a1', fontWeight: '700' }]}>{p.economy || p.econ || '6.50'}</Text>
                                </View>
                                <View style={styles.mobileStandingsStatItem}>
                                  <Text style={styles.mobileStatLabel}>3W / 5W</Text>
                                  <Text style={styles.mobileStatVal}>{p.threeWkts ?? (p.wickets >= 3 ? 1 : 0)}/{p.fiveWkts ?? (p.wickets >= 5 ? 1 : 0)}</Text>
                                </View>
                              </View>
                            </View>
                          );
                        })
                      )}

                      {perfTab === 'fielding' && (
                        paginatedFielding.map((p: any, idx: number) => {
                          const globalIdx = (safeFieldingPage - 1) * PERF_PER_PAGE + idx;
                          const rank = p.stand || (globalIdx + 1);
                          return (
                            <View key={p.id || idx} style={styles.mobilePerfCard}>
                              <View style={styles.mobilePerfCardTop}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
                                  <View style={[styles.rankBadge, rank === 1 ? styles.rankBadgeGold : rank === 2 ? styles.rankBadgeSilver : rank === 3 ? styles.rankBadgeBronze : null, { marginRight: 8, width: 24, height: 24, borderRadius: 12 }]}>
                                    <Text style={styles.rankBadgeText}>{rank}</Text>
                                  </View>
                                  {resolveImageUrl(p.photo || p.image || p.image_path) ? (
                                    <Image
                                      source={{ uri: resolveImageUrl(p.photo || p.image || p.image_path)! }}
                                      style={{ width: 24, height: 24, borderRadius: 12, marginRight: 8, resizeMode: 'cover' }}
                                    />
                                  ) : null}
                                  <View style={{ flex: 1, minWidth: 0, paddingRight: 6 }}>
                                    <Text style={styles.pointsTeamName} numberOfLines={1}>{p.name}</Text>
                                    <Text style={styles.pointsTeamSub} numberOfLines={1}>{p.team || 'District Club'}</Text>
                                  </View>
                                </View>
                                <View style={[styles.mobileRunsBadge, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
                                  <Text style={[styles.mobileRunsBadgeNum, { color: '#7e22ce' }]}>{p.dismissals || (p.catches || 0) + (p.stumpings || 0) + (p.runOuts || 0)}</Text>
                                  <Text style={[styles.mobileRunsBadgeLabel, { color: '#6b21a8' }]}>TOTAL</Text>
                                </View>
                              </View>
                              <View style={styles.mobileStandingsCardDivider} />
                              <View style={styles.mobileStandingsCardStatsRow}>
                                <View style={styles.mobileStandingsStatItem}>
                                  <Text style={styles.mobileStatLabel}>M / INN</Text>
                                  <Text style={styles.mobileStatVal}>{p.mat || 5}/{p.inns || 5}</Text>
                                </View>
                                <View style={styles.mobileStandingsStatItem}>
                                  <Text style={styles.mobileStatLabel}>CATCHES</Text>
                                  <Text style={[styles.mobileStatVal, { color: '#0284c7' }]}>{p.catches || 0}</Text>
                                </View>
                                <View style={styles.mobileStandingsStatItem}>
                                  <Text style={styles.mobileStatLabel}>STUMPINGS</Text>
                                  <Text style={styles.mobileStatVal}>{p.stumpings || 0}</Text>
                                </View>
                                <View style={styles.mobileStandingsStatItem}>
                                  <Text style={styles.mobileStatLabel}>RUN OUTS</Text>
                                  <Text style={styles.mobileStatVal}>{p.runOuts || 0}</Text>
                                </View>
                              </View>
                            </View>
                          );
                        })
                      )}
                    </View>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: '100%' }} contentContainerStyle={{ flexGrow: 1, width: '100%' }}>
                    <View style={styles.tableBox}>
                      {perfTab === 'ratings' && (
                        <View style={{ width: '100%' }}>
                          <View style={styles.tableHeaderRow}>
                            <Text style={[styles.tableTh, { width: 60, textAlign: 'center' }]}>Rank</Text>
                            <Text style={[styles.tableTh, { flex: 2.2, minWidth: 180 }]}>Player / Role</Text>
                            <Text style={[styles.tableTh, { flex: 0.7, minWidth: 65, textAlign: 'center' }]}>Matches</Text>
                            <Text style={[styles.tableTh, { flex: 1.3, minWidth: 130, textAlign: 'center' }]}>Rating (0-10)</Text>
                            <Text style={[styles.tableTh, { flex: 1.1, minWidth: 100, textAlign: 'center' }]}>Confidence</Text>
                            <Text style={[styles.tableTh, { flex: 0.8, minWidth: 75, textAlign: 'center' }]}>Batting</Text>
                            <Text style={[styles.tableTh, { flex: 0.8, minWidth: 75, textAlign: 'center' }]}>Bowling</Text>
                            <Text style={[styles.tableTh, { flex: 0.8, minWidth: 75, textAlign: 'center' }]}>Fielding</Text>
                          </View>
                          {isLoadingLeaders ? (
                            <View style={{ padding: 24, alignItems: 'center' }}>
                              <ActivityIndicator size="small" color="#f59e0b" />
                              <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 8 }}>Computing Player Ratings...</Text>
                            </View>
                          ) : paginatedRatings.length === 0 ? (
                            <View style={{ padding: 28, alignItems: 'center' }}>
                              <Ionicons name="star-outline" size={26} color="#94a3b8" style={{ marginBottom: 6 }} />
                              <Text style={{ color: '#0f172a', fontWeight: '700', fontSize: 13 }}>No Player Ratings Recorded Yet</Text>
                              <Text style={{ color: '#64748b', fontSize: 11.5, marginTop: 3 }}>
                                Ratings will appear automatically once matches and player innings are scored in the database.
                              </Text>
                            </View>
                          ) : paginatedRatings.map((p: any, idx: number) => {
                            const globalIdx = (safeRatingsPage - 1) * PERF_PER_PAGE + idx;
                            const rank = globalIdx + 1;
                            const score = ratingCategory === 'batting' ? p.battingRating : (ratingCategory === 'bowling' ? p.bowlingRating : p.overallRating);
                            return (
                              <View
                                key={p.playerId || idx}
                                style={[
                                  styles.tableRow,
                                  idx % 2 === 1 && styles.tableRowAlt,
                                  rank <= 3 && styles.tableRowQualified
                                ]}
                              >
                                <View style={{ width: 60, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
                                  {rank === 1 ? (
                                    <FontAwesome5 name="medal" size={11} color="#eab308" style={{ marginRight: 3 }} />
                                  ) : rank === 2 ? (
                                    <FontAwesome5 name="medal" size={11} color="#94a3b8" style={{ marginRight: 3 }} />
                                  ) : rank === 3 ? (
                                    <FontAwesome5 name="medal" size={11} color="#d97706" style={{ marginRight: 3 }} />
                                  ) : null}
                                  <Text style={{ fontWeight: '800', color: rank <= 3 ? '#b45309' : '#64748b', fontSize: 12 }}>
                                    {rank <= 3 ? `${rank}` : `#${rank}`}
                                  </Text>
                                </View>
                                <View style={{ flex: 2.2, minWidth: 180 }}>
                                  <Text style={styles.pointsTeamName}>{p.playerName}</Text>
                                  <Text style={styles.playerSubRole}>{p.role || 'Player'}</Text>
                                </View>
                                <Text style={[styles.tableTd, { flex: 0.7, minWidth: 65, textAlign: 'center', color: '#1e293b' }]}>{p.matchesCount || 1}</Text>
                                <View style={{ flex: 1.3, minWidth: 130, alignItems: 'center', justifyContent: 'center' }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 9, paddingVertical: 3.5, borderRadius: 6, borderWidth: 1, borderColor: '#fde68a' }}>
                                    <Text style={{ color: '#0e184e', fontWeight: '900', fontSize: 13 }}>
                                      {score !== null && score !== undefined ? `${Number(score).toFixed(1)}` : '—'}
                                    </Text>
                                    {score !== null && score !== undefined && (
                                      <Ionicons name="star" size={11} color="#d97706" style={{ marginLeft: 4 }} />
                                    )}
                                  </View>
                                </View>
                                <View style={{ flex: 1.1, minWidth: 100, alignItems: 'center', justifyContent: 'center' }}>
                                  <Text style={{
                                    fontSize: 10,
                                    fontWeight: '700',
                                    color: p.confidence === 'Established' ? '#15803d' : (p.confidence === 'Developing' ? '#b45309' : '#0284c7'),
                                    backgroundColor: p.confidence === 'Established' ? '#dcfce7' : (p.confidence === 'Developing' ? '#fef3c7' : '#e0f2fe'),
                                    borderColor: p.confidence === 'Established' ? '#bbf7d0' : (p.confidence === 'Developing' ? '#fde68a' : '#bae6fd'),
                                    borderWidth: 1,
                                    paddingHorizontal: 8,
                                    paddingVertical: 2.5,
                                    borderRadius: 4
                                  }}>
                                    {p.confidence || 'Provisional'}
                                  </Text>
                                </View>
                                <Text style={[styles.tableTd, { flex: 0.8, minWidth: 75, textAlign: 'center', fontWeight: '700', color: '#1e293b' }]}>
                                  {p.battingRating !== null && p.battingRating !== undefined ? `${Number(p.battingRating).toFixed(1)}` : '—'}
                                </Text>
                                <Text style={[styles.tableTd, { flex: 0.8, minWidth: 75, textAlign: 'center', fontWeight: '700', color: '#1e293b' }]}>
                                  {p.bowlingRating !== null && p.bowlingRating !== undefined ? `${Number(p.bowlingRating).toFixed(1)}` : '—'}
                                </Text>
                                <Text style={[styles.tableTd, { flex: 0.8, minWidth: 75, textAlign: 'center', fontWeight: '700', color: '#1e293b' }]}>
                                  {p.fieldingRating !== null && p.fieldingRating !== undefined ? `${Number(p.fieldingRating).toFixed(1)}` : '—'}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      )}

                      {perfTab === 'batting' && (
                        <View style={{ width: '100%' }}>
                          <View style={styles.tableHeaderRow}>
                            <Text style={[styles.tableTh, { width: 55, textAlign: 'center' }]}>Stand</Text>
                            <Text style={[styles.tableTh, { flex: 1.8, minWidth: 170 }]}>Player / Role</Text>
                            <Text style={[styles.tableTh, { flex: 1.6, minWidth: 150 }]}>Team</Text>
                            <Text style={[styles.tableTh, { flex: 0.5, minWidth: 45, textAlign: 'center' }]}>Mat</Text>
                            <Text style={[styles.tableTh, { flex: 0.5, minWidth: 45, textAlign: 'center' }]}>Inns</Text>
                            <Text style={[styles.tableTh, { flex: 0.6, minWidth: 55, textAlign: 'center' }]}>HS</Text>
                            <Text style={[styles.tableTh, { flex: 0.6, minWidth: 55, textAlign: 'center' }]}>Avg</Text>
                            <Text style={[styles.tableTh, { flex: 0.6, minWidth: 55, textAlign: 'center' }]}>SR</Text>
                            <Text style={[styles.tableTh, { flex: 0.5, minWidth: 45, textAlign: 'center' }]}>50s</Text>
                            <Text style={[styles.tableTh, { flex: 0.5, minWidth: 45, textAlign: 'center' }]}>100s</Text>
                            <Text style={[styles.tableTh, { flex: 0.7, minWidth: 65, textAlign: 'right', color: '#0e184e', fontWeight: '800' }]}>Runs</Text>
                          </View>
                          {paginatedBatting.map((p: any, idx: number) => {
                            const globalIdx = (safeBattingPage - 1) * PERF_PER_PAGE + idx;
                            return (
                              <View
                                key={p.id || idx}
                                style={[
                                  styles.tableRow,
                                  idx % 2 === 1 && styles.tableRowAlt,
                                  globalIdx < 3 && styles.tableRowQualified
                                ]}
                              >
                                <Text style={[styles.tableTd, { width: 55, textAlign: 'center', fontWeight: '700' }]}>
                                  {p.stand || (globalIdx + 1)}
                                </Text>
                                <View style={{ flex: 1.8, minWidth: 170, flexDirection: 'row', alignItems: 'center' }}>
                                  {resolveImageUrl(p.photo || p.image || p.image_path) ? (
                                    <Image
                                      source={{ uri: resolveImageUrl(p.photo || p.image || p.image_path)! }}
                                      style={{ width: 24, height: 24, borderRadius: 12, marginRight: 8, resizeMode: 'cover' }}
                                    />
                                  ) : null}
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.pointsTeamName}>{p.name}</Text>
                                    <Text style={styles.playerSubRole}>{p.role || 'Batter'}</Text>
                                  </View>
                                </View>
                                <Text style={[styles.tableTd, { flex: 1.6, minWidth: 150 }]}>{p.team || 'District Club'}</Text>
                                <Text style={[styles.tableTd, { flex: 0.5, minWidth: 45, textAlign: 'center' }]}>{p.mat || 5}</Text>
                                <Text style={[styles.tableTd, { flex: 0.5, minWidth: 45, textAlign: 'center' }]}>{p.inns || 5}</Text>
                                <Text style={[styles.tableTd, { flex: 0.6, minWidth: 55, textAlign: 'center', fontWeight: '600' }]}>{p.hs || (p.runs ? p.runs + '*' : '50*')}</Text>
                                <Text style={[styles.tableTd, { flex: 0.6, minWidth: 55, textAlign: 'center' }]}>{p.average || p.avg || '35.0'}</Text>
                                <Text style={[styles.tableTd, { flex: 0.6, minWidth: 55, textAlign: 'center' }]}>{p.strikeRate || p.sr || '135.0'}</Text>
                                <Text style={[styles.tableTd, { flex: 0.5, minWidth: 45, textAlign: 'center', fontWeight: '600', color: '#1e293b' }]}>
                                  {p.fifties ?? (p.runs >= 100 ? 1 : 0)}
                                </Text>
                                <Text style={[styles.tableTd, { flex: 0.5, minWidth: 45, textAlign: 'center', fontWeight: '600', color: '#1e293b' }]}>
                                  {p.hundreds ?? 0}
                                </Text>
                                <Text style={[styles.tableTd, { flex: 0.7, minWidth: 65, textAlign: 'right', color: '#0e184e', fontWeight: '800' }]}>
                                  {p.runs || 0}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      )}

                      {perfTab === 'bowling' && (
                        <View style={{ width: '100%' }}>
                          <View style={styles.tableHeaderRow}>
                            <Text style={[styles.tableTh, { width: 55, textAlign: 'center' }]}>Stand</Text>
                            <Text style={[styles.tableTh, { flex: 1.8, minWidth: 170 }]}>Bowler / Style</Text>
                            <Text style={[styles.tableTh, { flex: 1.6, minWidth: 150 }]}>Team</Text>
                            <Text style={[styles.tableTh, { flex: 0.5, minWidth: 45, textAlign: 'center' }]}>Mat</Text>
                            <Text style={[styles.tableTh, { flex: 0.5, minWidth: 45, textAlign: 'center' }]}>Inns</Text>
                            <Text style={[styles.tableTh, { flex: 0.6, minWidth: 55, textAlign: 'center' }]}>Overs</Text>
                            <Text style={[styles.tableTh, { flex: 0.6, minWidth: 55, textAlign: 'center' }]}>Runs</Text>
                            <Text style={[styles.tableTh, { flex: 0.6, minWidth: 55, textAlign: 'center' }]}>Econ</Text>
                            <Text style={[styles.tableTh, { flex: 0.5, minWidth: 50, textAlign: 'center' }]}>3w</Text>
                            <Text style={[styles.tableTh, { flex: 0.5, minWidth: 50, textAlign: 'center' }]}>5w</Text>
                            <Text style={[styles.tableTh, { flex: 0.7, minWidth: 65, textAlign: 'right', color: '#0e184e', fontWeight: '800' }]}>Wkts</Text>
                          </View>
                          {paginatedBowling.map((p: any, idx: number) => {
                            const globalIdx = (safeBowlingPage - 1) * PERF_PER_PAGE + idx;
                            return (
                              <View
                                key={p.id || idx}
                                style={[
                                  styles.tableRow,
                                  idx % 2 === 1 && styles.tableRowAlt,
                                  globalIdx < 3 && styles.tableRowQualified
                                ]}
                              >
                                <Text style={[styles.tableTd, { width: 55, textAlign: 'center', fontWeight: '700' }]}>
                                  {p.stand || (globalIdx + 1)}
                                </Text>
                                <View style={{ flex: 1.8, minWidth: 170, flexDirection: 'row', alignItems: 'center' }}>
                                  {resolveImageUrl(p.photo || p.image || p.image_path) ? (
                                    <Image
                                      source={{ uri: resolveImageUrl(p.photo || p.image || p.image_path)! }}
                                      style={{ width: 24, height: 24, borderRadius: 12, marginRight: 8, resizeMode: 'cover' }}
                                    />
                                  ) : null}
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.pointsTeamName}>{p.name}</Text>
                                    <Text style={styles.playerSubRole}>{p.role || 'Bowler'}</Text>
                                  </View>
                                </View>
                                <Text style={[styles.tableTd, { flex: 1.6, minWidth: 150 }]}>{p.team || 'District Club'}</Text>
                                <Text style={[styles.tableTd, { flex: 0.5, minWidth: 45, textAlign: 'center' }]}>{p.mat || 5}</Text>
                                <Text style={[styles.tableTd, { flex: 0.5, minWidth: 45, textAlign: 'center' }]}>{p.inns || 5}</Text>
                                <Text style={[styles.tableTd, { flex: 0.6, minWidth: 55, textAlign: 'center' }]}>{p.overs || '20.0'}</Text>
                                <Text style={[styles.tableTd, { flex: 0.6, minWidth: 55, textAlign: 'center' }]}>{p.runs_conceded || p.runs || 120}</Text>
                                <Text style={[styles.tableTd, { flex: 0.6, minWidth: 55, textAlign: 'center' }]}>{p.economy || p.econ || '6.50'}</Text>
                                <Text style={[styles.tableTd, { flex: 0.5, minWidth: 50, textAlign: 'center', fontWeight: '600', color: '#1e293b' }]}>
                                  {p.threeWkts ?? (p.wickets >= 3 ? 1 : 0)}
                                </Text>
                                <Text style={[styles.tableTd, { flex: 0.5, minWidth: 50, textAlign: 'center', fontWeight: '600', color: '#1e293b' }]}>
                                  {p.fiveWkts ?? (p.wickets >= 5 ? 1 : 0)}
                                </Text>
                                <Text style={[styles.tableTd, { flex: 0.7, minWidth: 65, textAlign: 'right', color: '#0e184e', fontWeight: '800' }]}>
                                  {p.wickets || 0}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      )}

                      {perfTab === 'fielding' && (
                        <View style={{ width: '100%' }}>
                          <View style={styles.tableHeaderRow}>
                            <Text style={[styles.tableTh, { width: 55, textAlign: 'center' }]}>Stand</Text>
                            <Text style={[styles.tableTh, { flex: 1.8, minWidth: 180 }]}>Player / Role</Text>
                            <Text style={[styles.tableTh, { flex: 1.6, minWidth: 160 }]}>Team</Text>
                            <Text style={[styles.tableTh, { flex: 0.5, minWidth: 50, textAlign: 'center' }]}>Mat</Text>
                            <Text style={[styles.tableTh, { flex: 0.5, minWidth: 50, textAlign: 'center' }]}>Inns</Text>
                            <Text style={[styles.tableTh, { flex: 0.7, minWidth: 60, textAlign: 'center' }]}>Catches</Text>
                            <Text style={[styles.tableTh, { flex: 0.8, minWidth: 70, textAlign: 'center' }]}>Stumpings</Text>
                            <Text style={[styles.tableTh, { flex: 0.8, minWidth: 70, textAlign: 'center' }]}>Run Outs</Text>
                            <Text style={[styles.tableTh, { flex: 0.8, minWidth: 70, textAlign: 'right', color: '#0e184e', fontWeight: '800' }]}>Total</Text>
                          </View>
                          {paginatedFielding.map((p: any, idx: number) => {
                            const globalIdx = (safeFieldingPage - 1) * PERF_PER_PAGE + idx;
                            return (
                              <View
                                key={p.id || idx}
                                style={[
                                  styles.tableRow,
                                  idx % 2 === 1 && styles.tableRowAlt,
                                  globalIdx < 3 && styles.tableRowQualified
                                ]}
                              >
                                <Text style={[styles.tableTd, { width: 55, textAlign: 'center', fontWeight: '700' }]}>
                                  {p.stand || (globalIdx + 1)}
                                </Text>
                                <View style={{ flex: 1.8, minWidth: 180, flexDirection: 'row', alignItems: 'center' }}>
                                  {resolveImageUrl(p.photo || p.image || p.image_path) ? (
                                    <Image
                                      source={{ uri: resolveImageUrl(p.photo || p.image || p.image_path)! }}
                                      style={{ width: 24, height: 24, borderRadius: 12, marginRight: 8, resizeMode: 'cover' }}
                                    />
                                  ) : null}
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.pointsTeamName}>{p.name}</Text>
                                    <Text style={styles.playerSubRole}>{p.role || 'Fielder'}</Text>
                                  </View>
                                </View>
                                <Text style={[styles.tableTd, { flex: 1.6, minWidth: 160 }]}>{p.team || 'District Club'}</Text>
                                <Text style={[styles.tableTd, { flex: 0.5, minWidth: 50, textAlign: 'center' }]}>{p.mat || 5}</Text>
                                <Text style={[styles.tableTd, { flex: 0.5, minWidth: 50, textAlign: 'center' }]}>{p.inns || 5}</Text>
                                <Text style={[styles.tableTd, { flex: 0.7, minWidth: 60, textAlign: 'center', fontWeight: '600', color: '#1e293b' }]}>
                                  {p.catches || 0}
                                </Text>
                                <Text style={[styles.tableTd, { flex: 0.8, minWidth: 70, textAlign: 'center', fontWeight: '600', color: '#1e293b' }]}>
                                  {p.stumpings || 0}
                                </Text>
                                <Text style={[styles.tableTd, { flex: 0.8, minWidth: 70, textAlign: 'center', fontWeight: '600', color: '#1e293b' }]}>
                                  {p.runOuts || 0}
                                </Text>
                                <Text style={[styles.tableTd, { flex: 0.8, minWidth: 70, textAlign: 'right', color: '#0e184e', fontWeight: '800' }]}>
                                  {p.dismissals || (p.catches || 0) + (p.stumpings || 0)}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  </ScrollView>
                )}

                  {/* Reusable Bootstrap Pagination Component for Performance Lists */}
                  {perfTab === 'ratings' && (
                    <BootstrapPagination
                      currentPage={safeRatingsPage}
                      totalPages={totalRatingsPages}
                      onPageChange={(p) => setPerfRatingsPage(p)}
                      totalItems={fullRatingsList.length}
                      pageSize={PERF_PER_PAGE}
                      itemLabel="players"
                    />
                  )}
                  {perfTab === 'batting' && (
                    <BootstrapPagination
                      currentPage={safeBattingPage}
                      totalPages={totalBattingPages}
                      onPageChange={(p) => setPerfBattingPage(p)}
                      totalItems={fullBattingList.length}
                      pageSize={PERF_PER_PAGE}
                      itemLabel="batters"
                    />
                  )}
                  {perfTab === 'bowling' && (
                    <BootstrapPagination
                      currentPage={safeBowlingPage}
                      totalPages={totalBowlingPages}
                      onPageChange={(p) => setPerfBowlingPage(p)}
                      totalItems={fullBowlingList.length}
                      pageSize={PERF_PER_PAGE}
                      itemLabel="bowlers"
                    />
                  )}
                  {perfTab === 'fielding' && (
                    <BootstrapPagination
                      currentPage={safeFieldingPage}
                      totalPages={totalFieldingPages}
                      onPageChange={(p) => setPerfFieldingPage(p)}
                      totalItems={fullFieldingList.length}
                      pageSize={PERF_PER_PAGE}
                      itemLabel="fielders"
                    />
                  )}
                </View>
              );
            })()}
          </View>
        </View>

        {/* ─── 8. DISTRICT SPECIAL MATCH RECORDS & MILESTONES ───────────── */}
        <View
          nativeID="cfvd-section-players"
          {...({ id: 'cfvd-section-players' } as any)}
          style={styles.section}
          onLayout={e => {
            const layout = e.nativeEvent.layout;
            setSectionPositions(prev => ({ ...prev, players: layout.y }));
          }}
        >
          <View style={[styles.container, containerResponsiveStyle]}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTagBadge}>
                <Ionicons name="trophy-outline" size={15} color="#0e184e" style={{ marginRight: 6 }} />
                <Text style={styles.sectionTagBadgeText}>OFFICIAL DISTRICT SPECIAL MATCH RECORDS</Text>
              </View>
              <Text style={[styles.sectionTitle, isSmallMobile && { fontSize: 20 }]}>District Match Record Breakers & Milestone Performers</Text>
              <Text style={styles.sectionSubtitle}>
                Elite match performances: Centuries (100s), Half-Centuries (50s), and Best Bowling Spells across Virudhunagar District League
              </Text>
            </View>

            {/* Left Search Bar + Right Milestone Select Dropdown */}
            <View style={{
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'stretch' : 'center',
              gap: 12,
              marginBottom: 16,
              width: '100%'
            }}>
              <View style={[
                styles.playerSearchBar,
                { marginBottom: 0, flex: isMobile ? undefined : 1, width: isMobile ? '100%' : undefined, minWidth: isMobile ? '100%' : 220, height: 38, paddingHorizontal: 10 }
              ]}>
                <Ionicons name="search" size={15} color="#64748b" style={{ marginRight: 6 }} />
                <TextInput
                  style={[styles.playerSearchInput, { fontSize: 12.5, paddingVertical: 4 }]}
                  placeholder="Search player, record (100, 50, 5W), team..."
                  placeholderTextColor="#62799c"
                  value={playerSearchQuery}
                  onChangeText={(t) => {
                    setPlayerSearchQuery(t);
                    setMilestonePage(1);
                  }}
                />
                {playerSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => {
                    setPlayerSearchQuery('');
                    setMilestonePage(1);
                  }}>
                    <Ionicons name="close-circle" size={16} color="#94a3b8" style={{ paddingLeft: 4 }} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                {renderSelectBox(
                  'Records',
                  playerFilter,
                  [
                    { id: 'all', label: `All Records (${filteredPlayers.length})` },
                    { id: 'century', label: 'Centuries (100+)' },
                    { id: 'fifty', label: 'Half-Centuries (50+)' },
                    { id: 'bowler', label: 'Bowling Hauls (3W+ / 5W)' },
                    { id: 'womens', label: "Women's Milestones" }
                  ],
                  (id) => {
                    setPlayerFilter(id);
                    setMilestonePage(1);
                  },
                  220
                )}
              </View>
            </View>

            {/* Empty State */}
            {filteredPlayers.length === 0 && (
              <View style={{ padding: 24, alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#fde68a', marginVertical: 14 }}>
                <Ionicons name="ribbon-outline" size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
                <Text style={{ color: '#0f172a', fontWeight: '800', fontSize: 16 }}>No Special Milestone Records Found</Text>
                <Text style={{ color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 4, maxWidth: 500 }}>
                  Only verified 50s (Half-Centuries), 100s (Centuries), and 3W+ Bowling Hauls scored in official matches are recorded in this hall of fame.
                </Text>
              </View>
            )}

            {/* Players Grid with Reusable Pagination (8 records per page) */}
            {filteredPlayers.length > 0 && (() => {
              const totalMilestonePages = Math.ceil(filteredPlayers.length / MILESTONE_PER_PAGE) || 1;
              const safeMilestonePage = Math.min(milestonePage, totalMilestonePages);
              const paginatedMilestones = filteredPlayers.slice(
                (safeMilestonePage - 1) * MILESTONE_PER_PAGE,
                safeMilestonePage * MILESTONE_PER_PAGE
              );

              return (
                <View>
                  <View style={[styles.grid2Col, isMobile && { flexDirection: 'column', flexWrap: 'nowrap' }]}>
                    {paginatedMilestones.map(p => {
                      const isCentury = p.milestoneType === 'century' || (p.stats?.hundreds && p.stats.hundreds > 0) || parseInt(p.stats?.hs || '0', 10) >= 100;
                      const isFifty = !isCentury && (p.milestoneType === 'fifty' || (p.stats?.fifties && p.stats.fifties > 0) || parseInt(p.stats?.hs || '0', 10) >= 50);
                      const isBowlingHaul = !isCentury && !isFifty;

                      const themeColor = isCentury ? '#b45309' : (isFifty ? '#c2410c' : (isBowlingHaul ? '#7e22ce' : '#0e184e'));
                      const badgeBg = isCentury ? '#fef3c7' : (isFifty ? '#ffedd5' : (isBowlingHaul ? '#f3e8ff' : '#f1f5f9'));
                      const badgeBorder = isCentury ? '#fde68a' : (isFifty ? '#fed7aa' : (isBowlingHaul ? '#e9d5ff' : '#cbd5e1'));

                      const defaultLabel = isCentury ? '100 in a Match (Century)' : (isFifty ? '50 in a Match (Half-Century)' : ((p.stats?.wkts >= 5 || (p.stats?.best && p.stats.best.startsWith('5/'))) ? '5-Wicket Match Haul' : '3+ Wickets in Match'));
                      const rawLabel = p.milestoneBadge || defaultLabel;
                      const badgeLabel = rawLabel.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim() || defaultLabel;

                      // Extract score, balls/overs, and sub-metric cleanly
                      let mainStat = p.milestoneScore || '';
                      let ballsOrOvers = p.milestoneBalls || '';
                      let subMetric = p.milestoneSubText || '';

                      if (!mainStat) {
                        if (isCentury || isFifty) {
                          const hsRaw = String(p.stats?.hs || (p.matchPerformance ? p.matchPerformance.split(' ')[0] : (isCentury ? '100' : '50')));
                          mainStat = hsRaw.includes('*') ? hsRaw : `${hsRaw}*`;
                          const bMatch = p.matchPerformance?.match(/\((\d+b)\)/);
                          ballsOrOvers = bMatch ? bMatch[1] : (isCentury ? '72b' : '42b');
                          subMetric = isCentury ? '12x4, 5x6' : `SR: ${p.stats?.sr || '142.5'}`;
                        } else {
                          mainStat = p.stats?.best || (p.matchPerformance ? p.matchPerformance.split(' ')[0] : `${p.stats?.wkts || 5}/18`);
                          ballsOrOvers = '4.0 ov';
                          subMetric = `Econ: ${p.stats?.econ || '4.50'}`;
                        }
                      }

                      return (
                        <TouchableOpacity
                          key={p.id}
                          activeOpacity={0.88}
                          onPress={() => setSelectedPlayerModal(p)}
                          style={[
                            styles.specialRecordCard,
                            !isMobile && { flex: 1 },
                          isMobile && { width: '100%', minWidth: '100%', maxWidth: '100%' },
                            isSmallMobile && { padding: 12 },
                            { borderTopColor: themeColor }
                          ]}
                        >
                          {/* Top Milestone Banner */}
                          <View style={[styles.recordBadgeRow, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 6 }}>
                              <Ionicons
                                name={isCentury ? "ribbon-outline" : (isFifty ? "medal-outline" : "disc-outline")}
                                size={14}
                                color={themeColor}
                                style={{ marginRight: 6 }}
                              />
                              <Text style={[styles.recordBadgeLabel, { color: themeColor }]} numberOfLines={1}>
                                {badgeLabel}
                              </Text>
                            </View>
                            <View style={styles.recordOfficialBadge}>
                              <Ionicons name="checkmark-circle" size={11} color="#15803d" style={{ marginRight: 3 }} />
                              <Text style={styles.recordOfficialCheck}>Record</Text>
                            </View>
                          </View>

                          {/* Player Profile Row */}
                          <View style={styles.recordProfileRow}>
                            {resolveImageUrl(p.photo || p.image || p.image_path) ? (
                              <Image
                                source={{ uri: resolveImageUrl(p.photo || p.image || p.image_path)! }}
                                style={[styles.recordAvatar, { resizeMode: 'cover', overflow: 'hidden' }]}
                              />
                            ) : (
                              <LinearGradient
                                colors={isCentury ? ['#b45309', '#d97706'] : (isFifty ? ['#c2410c', '#ea580c'] : ['#581c87', '#7e22ce'])}
                                style={styles.recordAvatar}
                              >
                                <Text style={styles.recordAvatarText}>
                                  {p.name
                                    .split(' ')
                                    .filter(Boolean)
                                    .map((w: string) => w[0])
                                    .join('')
                                    .slice(0, 2)}
                                </Text>
                              </LinearGradient>
                            )}
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={styles.recordPlayerName} numberOfLines={1}>{p.name}</Text>
                              <Text style={styles.recordTeamText} numberOfLines={1}>
                                {p.team} • <Text style={{ color: '#64748b' }}>{p.taluk}</Text>
                              </Text>
                              <View style={styles.recordRoleBadgePill}>
                                <Text style={styles.recordRoleBadgeText}>
                                  {p.roleLabel || p.playingRole || 'Player'}
                                </Text>
                              </View>
                            </View>
                          </View>

                          {/* Milestone Performance Highlight Box */}
                          <View style={[styles.recordPerfBox, { borderLeftColor: themeColor }]}>
                            <View style={styles.recordPerfMainRow}>
                              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                                <Text style={[styles.recordPerfScore, { color: themeColor }]}>{mainStat}</Text>
                                {ballsOrOvers ? (
                                  <Text style={styles.recordPerfBalls}> ({ballsOrOvers})</Text>
                                ) : null}
                              </View>
                              {subMetric ? (
                                <View style={[styles.recordSubMetricPill, { backgroundColor: badgeBg }]}>
                                  <Text style={[styles.recordSubMetricText, { color: themeColor }]}>{subMetric}</Text>
                                </View>
                              ) : null}
                            </View>
                            <View style={styles.recordMatchVsRow}>
                              <Ionicons name="location-outline" size={12} color="#64748b" style={{ marginRight: 4 }} />
                              <Text style={styles.recordMatchVs} numberOfLines={1}>
                                {p.matchVs ? p.matchVs.replace(/^vs\s*/i, 'vs ') : `${p.team} • Virudhunagar League`}
                              </Text>
                            </View>
                          </View>

                          {/* Clean Action Footer */}
                          <View style={styles.recordCardFooter}>
                            <Text style={styles.recordCardFooterText}>Match Details & Scorecard</Text>
                            <Ionicons name="arrow-forward-circle" size={16} color={themeColor} />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Reusable Bootstrap Pagination Component */}
                  <BootstrapPagination
                    currentPage={safeMilestonePage}
                    totalPages={totalMilestonePages}
                    onPageChange={(p) => setMilestonePage(p)}
                    totalItems={filteredPlayers.length}
                    pageSize={MILESTONE_PER_PAGE}
                    itemLabel="records"
                  />
                </View>
              );
            })()}
          </View>
        </View>

        {/* ─── 9. ABOUT CFVD HERITAGE ────────────────────────────────────── */}
        <View
          nativeID="cfvd-section-about"
          {...({ id: 'cfvd-section-about' } as any)}
          style={styles.section}
          onLayout={e => {
            const layout = e.nativeEvent.layout;
            setSectionPositions(prev => ({ ...prev, about: layout.y }));
          }}
        >
          <View style={[styles.container, containerResponsiveStyle]}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTagBadge}>
                <Ionicons name="business-outline" size={15} color="#0e184e" style={{ marginRight: 6 }} />
                <Text style={styles.sectionTagBadgeText}>GOVERNING CRICKET BODY</Text>
              </View>
              <Text style={[styles.sectionTitle, isSmallMobile && { fontSize: 20 }]}>The Heritage of Cricket in Virudhunagar</Text>
            </View>

            <View style={[styles.aboutGrid, isMobile && { flexDirection: 'column' }]}>
              <View style={[styles.aboutTextCol, isMobile && { width: '100%', minWidth: '100%' }]}>
                <Text style={styles.aboutLead}>
                  The <Text style={{ color: '#b45309', fontWeight: '800' }}>Cricket Federation of Virudhunagar District (CFVD)</Text> is
                  the official recognized governing body for the sport of cricket within Virudhunagar revenue district.
                </Text>
                <Text style={styles.aboutBody}>
                  With roots deeply anchored in sportsmanship, collegiate competition, and youth development, our emblem features
                  the world-renowned temple gopuram of <Text style={{ fontStyle: 'italic', fontWeight: '700', color: '#b45309' }}>Srivilliputhur</Text> (the state emblem of Tamil Nadu),
                  reflecting the pride and resilience of our cricketers.
                </Text>

                <View style={styles.valuesList}>
                  <View style={styles.valueItem}>
                    <Ionicons name="checkmark-circle" size={18} color="#b45309" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.valueTitle}>Fair Play & Ethics</Text>
                      <Text style={styles.valueDesc}>
                        Strict implementation of Federation Code of Conduct and Anti-Corruption rules.
                      </Text>
                    </View>
                  </View>
                  <View style={styles.valueItem}>
                    <Ionicons name="checkmark-circle" size={18} color="#b45309" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.valueTitle}>Grassroots & Collegiate Scouting</Text>
                      <Text style={styles.valueDesc}>
                        Annual leagues identifying talent across 8 taluks, schools, and affiliated colleges.
                      </Text>
                    </View>
                  </View>
                  <View style={styles.valueItem}>
                    <Ionicons name="checkmark-circle" size={18} color="#b45309" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.valueTitle}>First-Class Standard Pitches</Text>
                      <Text style={styles.valueDesc}>
                        Professional red-soil turf wickets at District Sports Complex, Sivakasi, and Rajapalayam.
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Crest Card */}
              <View style={[styles.aboutCrestCard, isMobile && { width: '100%', minWidth: '100%' }]}>
                <Image source={IMG_LOGO} style={styles.aboutCrestImg} resizeMode="contain" />
                <Text style={styles.aboutCrestTitle}>CRICKET FEDERATION OF VIRUDHUNAGAR DISTRICT</Text>
                <Text style={styles.aboutCrestMotto}>"Enjoy the game and chase your dreams"</Text>
                <View style={styles.aboutCrestBadge}>
                  <Ionicons name="shield-checkmark" size={13} color="#b45309" style={{ marginRight: 4 }} />
                  <Text style={styles.aboutCrestBadgeText}>Recognized District Cricket Governing Body</Text>
                </View>
              </View>
            </View>


          </View>
        </View>


        {/* ─── 10. DISTRICT GROUNDS & FACILITIES ──────────────────────────── */}
        <View
          style={styles.section}
          onLayout={e => {
            const layout = e.nativeEvent.layout;
            setSectionPositions(prev => ({ ...prev, grounds: layout.y }));
          }}
        >
          <View style={[styles.container, containerResponsiveStyle]}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTagBadge}>
                <Text style={styles.sectionTagBadgeText}>🏟️ PLAYING VENUES</Text>
              </View>
              <Text style={[styles.sectionTitle, isSmallMobile && { fontSize: 20 }]}>District Cricket Facilities & Grounds</Text>
              <Text style={styles.sectionSubtitle}>
                First-class tournament grade turf wickets, indoor practice nets, and floodlit grounds adhering to professional match standards
              </Text>
            </View>

            <View style={[styles.grid3Col, isMobile && { flexDirection: 'column' }]}>
              <View style={[styles.groundCard, isMobile && { width: '100%', minWidth: '100%', maxWidth: '100%' }]}>
                <Image source={IMG_STADIUM} style={styles.groundImg} resizeMode="cover" />
                <View style={styles.groundBadge}>
                  <Text style={styles.groundBadgeText}>Headquarters</Text>
                </View>
                <View style={styles.groundInfo}>
                  <Text style={styles.groundTitle}>District Sports Complex Stadium</Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleOpenGoogleMaps('', 'District Sports Complex Stadium, Collectorate Road, Virudhunagar')}
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                  >
                    <Text style={[styles.groundLoc, { color: '#0284c7', textDecorationLine: 'underline' }]}>📍 Collectorate Road, Virudhunagar ↗</Text>
                  </TouchableOpacity>
                  <Text style={styles.groundDesc}>
                    Featuring 3 professional tournament-grade red-soil turf wickets, modern dressing rooms, electronic scoreboard, and 4 turf practice nets.
                  </Text>
                  <View style={styles.groundFacilitiesRow}>
                    <Text style={styles.facilityPill}>✓ Turf Pitch</Text>
                    <Text style={styles.facilityPill}>✓ Floodlights</Text>
                    <Text style={styles.facilityPill}>✓ Pavilion</Text>
                    <Text style={styles.facilityPill}>✓ 5,000 Seating</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.groundCard, isMobile && { width: '100%', minWidth: '100%', maxWidth: '100%' }]}>
                <Image source={IMG_BATSMAN} style={styles.groundImg} resizeMode="cover" />
                <View style={styles.groundBadge}>
                  <Text style={styles.groundBadgeText}>Match Venue</Text>
                </View>
                <View style={styles.groundInfo}>
                  <Text style={styles.groundTitle}>Sivakasi Turf Cricket Ground</Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleOpenGoogleMaps('', 'Sivakasi Turf Cricket Ground, PSR College Sports Enclave, Sivakasi')}
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                  >
                    <Text style={[styles.groundLoc, { color: '#0284c7', textDecorationLine: 'underline' }]}>📍 PSR College Sports Enclave, Sivakasi ↗</Text>
                  </TouchableOpacity>
                  <Text style={styles.groundDesc}>
                    Host to District First Division and Premier Invitational Qualifiers with natural green outfield and fast-paced pitch.
                  </Text>
                  <View style={styles.groundFacilitiesRow}>
                    <Text style={styles.facilityPill}>✓ Dual Turf Wickets</Text>
                    <Text style={styles.facilityPill}>✓ Practice Nets</Text>
                    <Text style={styles.facilityPill}>✓ Press Box</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.groundCard, isMobile && { width: '100%', minWidth: '100%', maxWidth: '100%' }]}>
                <Image source={IMG_CHAMPIONS} style={styles.groundImg} resizeMode="cover" />
                <View style={styles.groundBadge}>
                  <Text style={styles.groundBadgeText}>Academy Centre</Text>
                </View>
                <View style={styles.groundInfo}>
                  <Text style={styles.groundTitle}>Rajapalayam Cricket Academy Ground</Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleOpenGoogleMaps('', 'Rajapalayam Cricket Academy Ground, PACM Campus, Rajapalayam')}
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                  >
                    <Text style={[styles.groundLoc, { color: '#0284c7', textDecorationLine: 'underline' }]}>📍 PACM Campus, Rajapalayam ↗</Text>
                  </TouchableOpacity>
                  <Text style={styles.groundDesc}>
                    Center for the district high-performance coaching camp and junior age-group tournaments.
                  </Text>
                  <View style={styles.groundFacilitiesRow}>
                    <Text style={styles.facilityPill}>✓ Indoor AstroTurf</Text>
                    <Text style={styles.facilityPill}>✓ Video Analysis</Text>
                    <Text style={styles.facilityPill}>✓ Gym & Physio</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 11. DISTRICT CRICKET ACADEMY ──────────────────────────────── */}
        <View style={styles.section}>
          <View style={[styles.container, containerResponsiveStyle]}>
            <LinearGradient colors={['#fffdf5', '#fef3c7']} style={styles.academyBanner}>
              <Text style={styles.badgeGoldText}>CFVD HIGH PERFORMANCE</Text>
              <Text style={styles.academyTitle}>Virudhunagar District Cricket Academy</Text>
              <Text style={styles.academyDesc}>
                Guided by Certified Level 2 coaches, our academy offers year-round coaching, video analysis, physical
                conditioning, and match simulations to prepare cricketers for competitive trials.
              </Text>
              <View style={styles.academyFeaturesGrid}>
                <View style={styles.afItem}>
                  <Ionicons name="disc-outline" size={24} color="#0e184e" style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.afTitle}>Certified Professional Coaches</Text>
                    <Text style={styles.afDesc}>Personalized batting & bowling biomechanics</Text>
                  </View>
                </View>
                <View style={styles.afItem}>
                  <Ionicons name="videocam-outline" size={24} color="#0e184e" style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.afTitle}>High-Speed Video Analysis</Text>
                    <Text style={styles.afDesc}>Real-time technical corrections and tactical coaching</Text>
                  </View>
                </View>
                <View style={styles.afItem}>
                  <Ionicons name="barbell-outline" size={24} color="#0e184e" style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.afTitle}>Fitness & Physiotherapy</Text>
                    <Text style={styles.afDesc}>Yo-Yo test benchmarks and injury rehabilitation</Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* ─── 10. DISTRICT GROUNDS & FACILITIES ──────────────────────────── */}
        <View
          nativeID="cfvd-section-grounds"
          {...({ id: 'cfvd-section-grounds' } as any)}
          style={styles.section}
          onLayout={e => {
            const layout = e.nativeEvent.layout;
            setSectionPositions(prev => ({ ...prev, grounds: layout.y }));
          }}
        >
          <View style={[styles.container, containerResponsiveStyle]}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTagBadge}>
                <MaterialCommunityIcons name="stadium-variant" size={15} color="#0e184e" style={{ marginRight: 6 }} />
                <Text style={styles.sectionTagBadgeText}>PLAYING VENUES</Text>
              </View>
              <Text style={[styles.sectionTitle, isSmallMobile && { fontSize: 20 }]}>District Cricket Facilities & Grounds</Text>
              <Text style={styles.sectionSubtitle}>
                First-class tournament grade turf wickets, indoor practice nets, and floodlit grounds adhering to professional match standards
              </Text>
            </View>

            <View style={[styles.grid3Col, isMobile && { flexDirection: 'column' }]}>
              <View style={[styles.groundCard, isMobile && { width: '100%', minWidth: '100%', maxWidth: '100%' }]}>
                <Image source={IMG_STADIUM} style={styles.groundImg} resizeMode="cover" />
                <View style={styles.groundBadge}>
                  <Text style={styles.groundBadgeText}>Headquarters</Text>
                </View>
                <View style={styles.groundInfo}>
                  <Text style={styles.groundTitle}>District Sports Complex Stadium</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="location-outline" size={13} color="#475569" style={{ marginRight: 4 }} />
                    <Text style={styles.groundLoc}>Collectorate Road, Virudhunagar</Text>
                  </View>
                  <Text style={styles.groundDesc}>
                    Featuring 3 professional tournament-grade red-soil turf wickets, modern dressing rooms, electronic scoreboard, and 4 turf practice nets.
                  </Text>
                  <View style={styles.groundFacilitiesRow}>
                    <Text style={styles.facilityPill}>Turf Pitch</Text>
                    <Text style={styles.facilityPill}>Floodlights</Text>
                    <Text style={styles.facilityPill}>Pavilion</Text>
                    <Text style={styles.facilityPill}>5,000 Seating</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.groundCard, isMobile && { width: '100%', minWidth: '100%', maxWidth: '100%' }]}>
                <Image source={IMG_BATSMAN} style={styles.groundImg} resizeMode="cover" />
                <View style={styles.groundBadge}>
                  <Text style={styles.groundBadgeText}>Match Venue</Text>
                </View>
                <View style={styles.groundInfo}>
                  <Text style={styles.groundTitle}>Sivakasi Turf Cricket Ground</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="location-outline" size={13} color="#475569" style={{ marginRight: 4 }} />
                    <Text style={styles.groundLoc}>PSR College Sports Enclave, Sivakasi</Text>
                  </View>
                  <Text style={styles.groundDesc}>
                    Host to District First Division and Premier Invitational Qualifiers with natural green outfield and fast-paced pitch.
                  </Text>
                  <View style={styles.groundFacilitiesRow}>
                    <Text style={styles.facilityPill}>Dual Turf Wickets</Text>
                    <Text style={styles.facilityPill}>Practice Nets</Text>
                    <Text style={styles.facilityPill}>Press Box</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.groundCard, isMobile && { width: '100%', minWidth: '100%', maxWidth: '100%' }]}>
                <Image source={IMG_CHAMPIONS} style={styles.groundImg} resizeMode="cover" />
                <View style={styles.groundBadge}>
                  <Text style={styles.groundBadgeText}>Academy Centre</Text>
                </View>
                <View style={styles.groundInfo}>
                  <Text style={styles.groundTitle}>Rajapalayam Cricket Academy Ground</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="location-outline" size={13} color="#475569" style={{ marginRight: 4 }} />
                    <Text style={styles.groundLoc}>PACM Campus, Rajapalayam</Text>
                  </View>
                  <Text style={styles.groundDesc}>
                    Center for the district high-performance coaching camp and junior age-group tournaments.
                  </Text>
                  <View style={styles.groundFacilitiesRow}>
                    <Text style={styles.facilityPill}>Indoor AstroTurf</Text>
                    <Text style={styles.facilityPill}>Video Analysis</Text>
                    <Text style={styles.facilityPill}>Gym & Physio</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 12. MEDIA & PRESS NOTICES (TNCA STYLE SUB-NAV) ─────────── */}
        {/* <View
          nativeID="cfvd-section-news"
          {...({ id: 'cfvd-section-news' } as any)}
          style={styles.section}
        >
          <View style={[styles.container, containerResponsiveStyle]}>
            {/* TNCA Sub-Nav Bar: [ News ] [ Photos ] ──────── See More > 
            <View style={styles.tncaMediaSubNavRow}>
              <View style={styles.tncaMediaPillGroup}>
                <TouchableOpacity style={[styles.tncaPillYellowActive, { flexDirection: 'row', alignItems: 'center' }]} activeOpacity={0.85}>
                  <Ionicons name="newspaper-outline" size={13} color="#0e184e" style={{ marginRight: 5 }} />
                  <Text style={styles.tncaPillYellowText}>News</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tncaPillWhiteInactive, { flexDirection: 'row', alignItems: 'center' }]}
                  onPress={() => alert('Official CFVD Tournament Photo Gallery available in the portal.')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera-outline" size={13} color="#64748b" style={{ marginRight: 5 }} />
                  <Text style={styles.tncaPillWhiteText}>Photos</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.tncaSeeMoreLink}
                onPress={() => alert('Browsing all official circulars, media releases and news bulletins.')}
                activeOpacity={0.8}
              >
                <Text style={styles.tncaSeeMoreText}>See More ›</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.tncaMediaGoldDivider} />

            <View style={[styles.sectionHead, { marginTop: 16 }]}>
              <View style={styles.sectionTagBadge}>
                <Ionicons name="newspaper-outline" size={15} color="#0e184e" style={{ marginRight: 6 }} />
                <Text style={styles.sectionTagBadgeText}>MEDIA & NOTICES</Text>
              </View>
              <Text style={[styles.sectionTitle, isSmallMobile && { fontSize: 20 }]}>Federation Press Releases & Circulars</Text>
            </View>

            <View style={[styles.grid3Col, isMobile && { flexDirection: 'column' }]}>
              <View style={[styles.newsCard, isMobile && { width: '100%', minWidth: '100%', maxWidth: '100%' }]}>
                <Image source={IMG_BATSMAN} style={styles.newsImg} resizeMode="cover" />
                <View style={styles.newsBody}>
                  <Text style={styles.newsDate}>Oct 05, 2026</Text>
                  <Text style={styles.newsCatBadge}>Selection Trials</Text>
                  <Text style={styles.newsTitle}>Virudhunagar District Under-19 Team Selection Trials Announced</Text>
                  <Text style={styles.newsExcerpt}>
                    Players born on or after 01-09-2007 with valid digital birth certificates and CFVD player ID are eligible to attend.
                  </Text>
                  <TouchableOpacity
                    style={styles.btnOutlineGoldSm}
                    onPress={() =>
                      setActiveNewsModal({
                        title: 'Virudhunagar District Under-19 Team Selection Trials Announced',
                        date: 'Oct 05, 2026',
                        content:
                          'The Cricket Federation of Virudhunagar District announces the official selection trials for the District Under-19 boys team for the 2026-27 season. Trials will be conducted at District Sports Complex Stadium, Virudhunagar from 08:30 AM onwards. Eligible candidates must report in proper cricket whites with personal gear.'
                      })
                    }
                  >
                    <Text style={styles.btnOutlineGoldSmText}>Read Circular</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.newsCard, isMobile && { width: '100%', minWidth: '100%', maxWidth: '100%' }]}>
                <Image source={IMG_CHAMPIONS} style={styles.newsImg} resizeMode="cover" />
                <View style={styles.newsBody}>
                  <Text style={styles.newsDate}>Sep 24, 2026</Text>
                  <Text style={styles.newsCatBadge}>Tournament</Text>
                  <Text style={styles.newsTitle}>Virudhunagar Premier League 2026 Climax</Text>
                  <Text style={styles.newsExcerpt}>
                    Virudhunagar Strikers and Sivakasi Super Kings battle in a high-octane championship climax at District Sports Complex.
                  </Text>
                  <TouchableOpacity
                    style={styles.btnOutlineGoldSm}
                    onPress={() =>
                      setActiveNewsModal({
                        title: 'Virudhunagar Premier League 2026 Climax',
                        date: 'Sep 24, 2026',
                        content:
                          'A capacity crowd is anticipated as two powerhouse taluks clash in the grand finale of the Kamarajar Memorial T20 Trophy. Both finalists showcased commanding top-order firepower and disciplined death bowling.'
                      })
                    }
                  >
                    <Text style={styles.btnOutlineGoldSmText}>Match Report</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.newsCard, isMobile && { width: '100%', minWidth: '100%', maxWidth: '100%' }]}>
                <Image source={IMG_STADIUM} style={styles.newsImg} resizeMode="cover" />
                <View style={styles.newsBody}>
                  <Text style={styles.newsDate}>Sep 18, 2026</Text>
                  <Text style={styles.newsCatBadge}>Officials Clinic</Text>
                  <Text style={styles.newsTitle}>Certified Umpires & Scorers Examination & Clinic</Text>
                  <Text style={styles.newsExcerpt}>
                    A three-day comprehensive seminar covering MCC laws and digital live scoring systems for aspiring match officials.
                  </Text>
                  <TouchableOpacity
                    style={styles.btnOutlineGoldSm}
                    onPress={() =>
                      setActiveNewsModal({
                        title: 'Certified Umpires & Scorers Examination & Clinic',
                        date: 'Sep 18, 2026',
                        content:
                          'Registrations are open for the annual state-affiliated Umpires and Scorers Accreditation Seminar. Successful participants will be empanelled into District Panels A & B for the upcoming collegiate and first-division seasons.'
                      })
                    }
                  >
                    <Text style={styles.btnOutlineGoldSmText}>Details & Schedule</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </View> */}

        {/* ─── 13. VISUAL ARCHIVES GALLERY ───────────────────────────────── */}
        {/* <View style={styles.section}>
          <View style={[styles.container, containerResponsiveStyle]}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTagBadge}>
                <Ionicons name="images-outline" size={15} color="#0e184e" style={{ marginRight: 6 }} />
                <Text style={styles.sectionTagBadgeText}>VISUAL ARCHIVES</Text>
              </View>
              <Text style={[styles.sectionTitle, isSmallMobile && { fontSize: 20 }]}>Official Match Day Moments</Text>
            </View>

            <View style={styles.grid3Col}>
              <TouchableOpacity
                style={styles.galleryItem}
                onPress={() => setLightboxImage({ uri: IMG_STADIUM, caption: 'District Sports Complex Floodlit Final' })}
              >
                <Image source={IMG_STADIUM} style={styles.galleryImg} resizeMode="cover" />
                <View style={[styles.galleryOverlay, { flexDirection: 'row', alignItems: 'center' }]}>
                  <Ionicons name="search" size={13} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={styles.galleryOverlayText}>Stadium Final</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.galleryItem}
                onPress={() => setLightboxImage({ uri: IMG_BATSMAN, caption: 'First Division League Cover Drive' })}
              >
                <Image source={IMG_BATSMAN} style={styles.galleryImg} resizeMode="cover" />
                <View style={[styles.galleryOverlay, { flexDirection: 'row', alignItems: 'center' }]}>
                  <Ionicons name="search" size={13} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={styles.galleryOverlayText}>Classic Cover Drive</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.galleryItem}
                onPress={() => setLightboxImage({ uri: IMG_CHAMPIONS, caption: 'Championship Trophy Celebration' })}
              >
                <Image source={IMG_CHAMPIONS} style={styles.galleryImg} resizeMode="cover" />
                <View style={[styles.galleryOverlay, { flexDirection: 'row', alignItems: 'center' }]}>
                  <Ionicons name="search" size={13} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={styles.galleryOverlayText}>Trophy Presentation</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View> */}

        {/* ─── 14. CONTACT SECRETARIAT ───────────────────────────────────── */}
        <View
          nativeID="cfvd-section-contact"
          {...({ id: 'cfvd-section-contact' } as any)}
          style={styles.section}
          onLayout={e => {
            const layout = e.nativeEvent.layout;
            setSectionPositions(prev => ({ ...prev, contact: layout.y }));
          }}
        >
          <View style={[styles.container, containerResponsiveStyle]}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTagBadge}>
                <Ionicons name="mail-outline" size={15} color="#0e184e" style={{ marginRight: 6 }} />
                <Text style={styles.sectionTagBadgeText}>SECRETARIAT</Text>
              </View>
              <Text style={[styles.sectionTitle, isSmallMobile && { fontSize: 20 }]}>Get in Touch with CFVD</Text>
            </View>

            <View style={[styles.grid2Col, isMobile && { flexDirection: 'column', flexWrap: 'nowrap' }]}>
              <View style={[styles.contactInfoCard, !isMobile && { flex: 1 }, isMobile && { width: '100%', minWidth: '100%', maxWidth: '100%' }, isSmallMobile && { padding: 12 }]}>
                <Text style={styles.contactCardTitle}>Administrative Office</Text>

                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                  <Ionicons name="location-outline" size={14} color="#64748b" style={{ marginRight: 6, marginTop: 2 }} />
                  <Text style={[styles.contactLine, { flex: 1, marginBottom: 0 }]}>
                    District Sports Complex Stadium, Collectorate Road, Virudhunagar – 626002, Tamil Nadu
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Ionicons name="call-outline" size={14} color="#64748b" style={{ marginRight: 6 }} />
                  <Text style={[styles.contactLine, { marginBottom: 0 }]}>+91 94430 12345 / 04562 245678</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="mail-outline" size={14} color="#64748b" style={{ marginRight: 6 }} />
                  <Text style={[styles.contactLine, { flex: 1, marginBottom: 0 }]}>info@cfvd-cricket.org / secretary@cfvd-cricket.org</Text>
                </View>
              </View>

              <View style={[styles.contactFormCard, !isMobile && { flex: 1 }, isMobile && { width: '100%', minWidth: '100%', maxWidth: '100%' }, isSmallMobile && { padding: 12 }]}>
                <Text style={styles.contactCardTitle}>Send Communication</Text>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Full Name *</Text>
                  <TextInput style={styles.formInput} placeholder="Your full name" placeholderTextColor="#62799c" />
                </View>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Inquiry Topic *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Tournament entries / College affiliation / Player ID"
                    placeholderTextColor="#62799c"
                  />
                </View>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Message *</Text>
                  <TextInput
                    style={[styles.formInput, { height: 70 }]}
                    placeholder="How can the federation assist you?"
                    placeholderTextColor="#62799c"
                    multiline
                  />
                </View>
                <TouchableOpacity
                  style={styles.btnGold}
                  onPress={() => alert('Thank you! Your communication has been transmitted to the CFVD Secretariat.')}
                >
                  <Text style={styles.btnGoldText}>Transmit Inquiry</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 14B. TOURNAMENT COMMITTEE & OFFICE BEARERS ───────────────── */}
        {committeeConfig?.enabled && (
          <View style={{ backgroundColor: '#f8fafc', paddingVertical: 28, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
            <View style={[styles.container, containerResponsiveStyle]}>
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#b45309', letterSpacing: 1, textTransform: 'uppercase' }}>
                  Official District Administration
                </Text>
                <Text style={{ fontSize: isMobile ? 19 : 23, fontWeight: '900', color: '#0f172a', marginTop: 2 }}>
                  👥 {committeeConfig.sectionTitle || 'Tournament Committee & Office Bearers'}
                </Text>
              </View>

              <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 16, alignItems: 'stretch' }}>
                {/* Committee Roles Card */}
                <View style={{
                  flex: 1.2,
                  backgroundColor: '#ffffff',
                  borderRadius: 14,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  gap: 10
                }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#1e3a8a', marginBottom: 2 }}>
                    Tournament Coordinators & Officials
                  </Text>
                  {(() => {
                    const allRoles = committeeConfig.roles || [];
                    const totalRolePages = Math.ceil(allRoles.length / COMMITTEE_ROLES_PER_PAGE) || 1;
                    const safeRolePage = Math.min(committeeRolePage, totalRolePages);
                    const paginatedRoles = allRoles.slice(
                      (safeRolePage - 1) * COMMITTEE_ROLES_PER_PAGE,
                      safeRolePage * COMMITTEE_ROLES_PER_PAGE
                    );
                    return (
                      <>
                        {paginatedRoles.map((r: any, idx: number) => (
                          <View
                            key={`home-role-${idx}`}
                            style={{
                              paddingVertical: 8,
                              borderBottomWidth: idx < paginatedRoles.length - 1 ? 1 : 0,
                              borderBottomColor: '#f1f5f9'
                            }}
                          >
                            <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
                              {r.roleTitle}
                            </Text>
                            <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#0f172a', marginTop: 2 }}>
                              {r.members}
                            </Text>
                          </View>
                        ))}
                        <BootstrapPagination
                          currentPage={safeRolePage}
                          totalPages={totalRolePages}
                          onPageChange={(p) => setCommitteeRolePage(p)}
                          totalItems={allRoles.length}
                          pageSize={COMMITTEE_ROLES_PER_PAGE}
                          itemLabel="officials"
                        />
                      </>
                    );
                  })()}
                </View>

                {/* Ground In-Charges + Notice Card */}
                <View style={{
                  flex: 1,
                  backgroundColor: '#ffffff',
                  borderRadius: 14,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  justifyContent: 'space-between',
                  gap: 14
                }}>
                  <View>
                    <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#065f46', marginBottom: 10 }}>
                      🏟️ Ground In-Charges
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {(committeeConfig.groundInCharges || []).map((g: any, idx: number) => (
                        <View
                          key={`home-ground-${idx}`}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 7,
                            borderRadius: 10,
                            backgroundColor: '#f0fdf4',
                            borderWidth: 1,
                            borderColor: '#bbf7d0'
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '800', color: '#166534' }}>{g.groundName}</Text>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: '#0f172a' }}>{g.inCharge}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {(committeeConfig.teamNotice || committeeConfig.signatoryName) && (
                    <View style={{
                      padding: 12,
                      borderRadius: 10,
                      backgroundColor: '#fffbeb',
                      borderWidth: 1,
                      borderColor: '#fde68a',
                      gap: 8
                    }}>
                      {committeeConfig.teamNotice ? (
                        <Text style={{ fontSize: 12.5, color: '#78350f', lineHeight: 18 }}>
                          <Text style={{ fontWeight: '800' }}>Request to Teams: </Text>
                          {committeeConfig.teamNotice}
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#64748b' }}>
                          {committeeConfig.noticeDate ? `Date: ${committeeConfig.noticeDate}` : ''}
                        </Text>
                        {committeeConfig.signatoryName ? (
                          <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#0f172a' }}>
                            {committeeConfig.signatoryTitle || 'Secretary'}: {committeeConfig.signatoryName}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ─── 15. MAIN FOOTER ───────────────────────────────────────────── */}
        <View style={styles.footer}>
          <View style={[styles.container, containerResponsiveStyle]}>
            <View style={[styles.footerGrid, isMobile && { flexDirection: 'column', gap: 18 }]}>
              <View style={[styles.footerColBrand, isMobile && { width: '100%', minWidth: '100%' }]}>
                <View style={styles.footerBrandRow}>
                  <Image source={IMG_LOGO} style={styles.footerLogo} resizeMode="contain" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.footerBrandTitle}>Cricket Federation of Virudhunagar District</Text>
                    <Text style={styles.footerMotto}>"Enjoy the game and chase your dreams"</Text>
                  </View>
                </View>
                <Text style={styles.footerDesc}>
                  The recognized governing cricket administration for Virudhunagar district. Dedicated to preserving
                  the spirit of cricket, promoting collegiate competitions, and nurturing state and national champions.
                </Text>
                <View style={styles.footerAffilBadge}>
                  <Ionicons name="shield-checkmark" size={14} color="#b45309" style={{ marginRight: 5 }} />
                  <Text style={styles.footerAffilText}>Recognized District Cricket Governing Body</Text>
                </View>
              </View>

              <View style={styles.footerCol}>
                <Text style={styles.footerColHeading}>Match Centre</Text>
                <TouchableOpacity onPress={() => scrollToSection('matchCentre')}>
                  <Text style={styles.footerLink}>› Live Scores</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => scrollToSection('matchCentre')}>
                  <Text style={styles.footerLink}>› Season Fixtures</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => scrollToSection('matchCentre')}>
                  <Text style={styles.footerLink}>› Recent Results</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => scrollToSection('pointsTable')}>
                  <Text style={styles.footerLink}>› Standings & Points Table</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => scrollToSection('stats')}>
                  <Text style={styles.footerLink}>› Player Performance Records</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.footerCol}>
                <Text style={styles.footerColHeading}>Operations Hub</Text>
                <TouchableOpacity
                  onPress={() => {
                    setActiveOpTab('institutions');
                    navigate('Admin');
                  }}
                >
                  <Text style={styles.footerLink}>› Clubs, Schools & Colleges</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setActiveOpTab('teams');
                    navigate('Admin');
                  }}
                >
                  <Text style={styles.footerLink}>› Team Management</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setActiveOpTab('tournaments');
                    navigate('Admin');
                  }}
                >
                  <Text style={styles.footerLink}>› Format & Division Setup</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setActiveOpTab('officials-reg');
                    navigate('Admin');
                  }}
                >
                  <Text style={styles.footerLink}>› Register Officials</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.footerCol}>
                <Text style={styles.footerColHeading}>Integrity & Access</Text>
                <TouchableOpacity onPress={() => navigate('Registration')}>
                  <Text style={styles.footerLink}>› Player Registration</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigate('Registration', { initialRole: 'TEAM' })}>
                  <Text style={styles.footerLink}>› Team / Club Affiliation</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigate('Login', { initialRole: 'SCORER' })}>
                  <Text style={styles.footerLink}>› Match Scorer Portal</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.footerBottom}>
              <Text style={styles.copyrightText}>
                © 2026 Cricket Federation of Virudhunagar District. All Rights Reserved. Official District Cricket Body.
              </Text>
              <View style={styles.legalLinksRow}>
                <Text style={styles.legalLink}>Privacy Policy</Text>
                <Text style={styles.legalDot}>•</Text>
                <Text style={styles.legalLink}>Terms of Use</Text>
                <Text style={styles.legalDot}>•</Text>
                <Text style={styles.legalLink}>Constitution & Ethics</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ─── LIVE SCORECARD MODAL ────────────────────────────────────────── */}
      <Modal
        visible={scorecardModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setScorecardModalVisible(false)}
      >
        <View style={[styles.modalBackdrop, isSmallMobile && { padding: 8 }]}>
          <View style={[styles.scorecardModalBox, isMobile && { width: '98%', maxWidth: '100%', padding: isSmallMobile ? 12 : 16, maxHeight: '95%' }]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.badgeGoldText}>OFFICIAL MATCH SCORECARD</Text>
                <Text style={[styles.modalTitle, isSmallMobile && { fontSize: 16 }]} numberOfLines={2}>
                  {activeScorecardMatchData
                    ? `${activeScorecardMatchData.teamA} vs ${activeScorecardMatchData.teamB}`
                    : 'Virudhunagar Strikers vs Sivakasi Super Kings'}
                </Text>
                <Text style={[styles.modalSub, isSmallMobile && { fontSize: 11 }]}>
                  {activeScorecardMatchData
                    ? `${activeScorecardMatchData.tournament || 'CFVD'} • ${activeScorecardMatchData.venue}`
                    : 'Virudhunagar Premier League Final • DSC Ground'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseCircleBtn}
                onPress={() => setScorecardModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: isSmallMobile ? 420 : 520 }} showsVerticalScrollIndicator={false}>
              {/* Full Interactive Scorecard & Wagon Wheel CTA */}
              <TouchableOpacity
                style={styles.openFullScorecardCta}
                onPress={() => {
                  setScorecardModalVisible(false);
                  const targetMatch = realScorecardData?.match || activeScorecardMatchData || publicMatches[0] || { id: 'M001' };
                  handleOpenScorecard(targetMatch);
                }}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="bar-chart-outline" size={15} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.openFullScorecardCtaText}>
                    View Full Interactive Wagon Wheel & Pro Scorecard
                  </Text>
                  <Ionicons name="arrow-forward" size={13} color="#ffffff" style={{ marginLeft: 6 }} />
                </View>
              </TouchableOpacity>

              {/* Toss & Match Summary Banner */}
              <View style={styles.scorecardTossBanner}>
                <Text style={styles.scorecardTossText}>
                  {realScorecardData?.match?.result || activeScorecardMatchData?.result
                    ? `Result: ${realScorecardData?.match?.result || activeScorecardMatchData?.result}`
                    : realScorecardData?.match?.toss_winner_name
                      ? `Toss: ${realScorecardData.match.toss_winner_name} won the toss and elected to ${realScorecardData.match.toss_decision || 'bat'}`
                      : activeScorecardMatchData
                        ? `Scheduled Match: ${activeScorecardMatchData.teamA} vs ${activeScorecardMatchData.teamB} (${activeScorecardMatchData.format || 'T20'})`
                        : 'Toss: Sivakasi Super Kings won the toss and elected to bat first (20.0 Overs).'}
                </Text>
              </View>

              {isLoadingScorecard && (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#0f2452" />
                  <Text style={{ marginTop: 8, color: '#64748b', fontSize: 12 }}>Loading scorecard details...</Text>
                </View>
              )}

              {/* Active Break Banner in Scorecard */}
              {activeScorecardMatchData?.currentBreak && (
                <View style={[
                  styles.cardBreakBanner,
                  activeScorecardMatchData.currentBreak.type?.toLowerCase().includes('rain') && styles.cardRainBanner,
                  { marginBottom: 14, flexDirection: 'row', alignItems: 'center' }
                ]}>
                  <View style={{ marginRight: 8 }}>
                    {activeScorecardMatchData.currentBreak.type?.toLowerCase().includes('rain') ? (
                      <Ionicons name="rainy-outline" size={18} color="#0284c7" />
                    ) : (
                      <Ionicons name="cafe-outline" size={18} color="#d97706" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[
                      styles.cardBreakText,
                      activeScorecardMatchData.currentBreak.type?.toLowerCase().includes('rain') && styles.cardRainText
                    ]}>
                      {activeScorecardMatchData.currentBreak.type?.toLowerCase().includes('rain')
                        ? 'MATCH DELAYED DUE TO RAIN'
                        : `${activeScorecardMatchData.currentBreak.type?.toUpperCase()} IN PROGRESS`}
                      {activeScorecardMatchData.currentBreak.duration ? ` (${activeScorecardMatchData.currentBreak.duration} MINS)` : ''}
                    </Text>
                    <Text style={styles.cardBreakSubText}>
                      {activeScorecardMatchData.currentBreak.startTime && activeScorecardMatchData.currentBreak.endTime
                        ? `${activeScorecardMatchData.currentBreak.startTime} - ${activeScorecardMatchData.currentBreak.endTime}`
                        : ''}
                      {activeScorecardMatchData.currentBreak.comments ? ` • ${activeScorecardMatchData.currentBreak.comments}` : ''}
                    </Text>
                  </View>
                </View>
              )}

              {/* Real Inning if available in MongoDB */}
              {realScorecardData?.innings && realScorecardData.innings.length > 0 ? (
                realScorecardData.innings.map((inn: any, idx: number) => {
                  const runsVal = inn.totalRuns ?? inn.runs ?? 0;
                  const oversParts = (inn.overs || '0').toString().split('.');
                  const ovNum = parseInt(oversParts[0], 10) || 0;
                  const bNum = parseInt(oversParts[1], 10) || 0;
                  const oversFloat = ovNum + (bNum / 6);
                  const crrVal = oversFloat > 0 ? (runsVal / oversFloat).toFixed(2) : '0.00';

                  return (
                    <View key={inn.id || idx} style={{ marginBottom: 20 }}>
                      <View style={styles.inningsHeaderRow}>
                        <Text style={[styles.inningsTitle, idx > 0 && { marginTop: 14 }]}>
                          {inn.inningsNumber === 1 ? '1st Innings' : '2nd Innings'}: {inn.battingTeam}
                        </Text>
                        <Text style={styles.inningsScoreBadge}>
                          {inn.score || `${inn.totalRuns || 0}/${inn.wickets || 0} (${inn.overs || '0.0'} Ov)`}
                        </Text>
                      </View>

                      {/* Batters Table */}
                      {inn.batters && inn.batters.length > 0 ? (
                        <View>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScrollWrapper}>
                            <View style={styles.scoreTable}>
                              <View style={styles.scoreTableHeader}>
                                <Text style={[styles.scoreTh, { width: 140 }]}>Batter</Text>
                                <Text style={[styles.scoreTh, { width: 130 }]}>Dismissal</Text>
                                <Text style={[styles.scoreTh, { width: 40, textAlign: 'center' }]}>R</Text>
                                <Text style={[styles.scoreTh, { width: 40, textAlign: 'center' }]}>B</Text>
                                <Text style={[styles.scoreTh, { width: 35, textAlign: 'center' }]}>4s</Text>
                                <Text style={[styles.scoreTh, { width: 35, textAlign: 'center' }]}>6s</Text>
                                <Text style={[styles.scoreTh, { width: 55, textAlign: 'right' }]}>SR</Text>
                              </View>
                              {inn.batters.map((b: any, bIdx: number) => (
                                <View key={b.id || bIdx} style={[styles.scoreTableRow, bIdx % 2 === 1 && styles.scoreTableRowAlt]}>
                                  <Text style={[styles.scoreTd, { width: 140, fontWeight: '700', color: '#0f172a' }]}>{b.name}</Text>
                                  <Text style={[styles.scoreTd, { width: 130, color: '#64748b' }]}>{b.dismissalText || (b.isOut ? 'out' : 'not out')}</Text>
                                  <Text style={[styles.scoreTd, { width: 40, textAlign: 'center', fontWeight: '800', color: '#b45309' }]}>
                                    {b.runs}
                                  </Text>
                                  <Text style={[styles.scoreTd, { width: 40, textAlign: 'center', color: '#334155' }]}>{b.balls}</Text>
                                  <Text style={[styles.scoreTd, { width: 35, textAlign: 'center', color: '#334155' }]}>{b.fours || 0}</Text>
                                  <Text style={[styles.scoreTd, { width: 35, textAlign: 'center', color: '#334155' }]}>{b.sixes || 0}</Text>
                                  <Text style={[styles.scoreTd, { width: 55, textAlign: 'right', fontWeight: '600', color: '#0f172a' }]}>{b.strikeRate || '0.0'}</Text>
                                </View>
                              ))}
                            </View>
                          </ScrollView>

                          {/* Extras & Total Summary Bar */}
                          <View style={styles.scorecardSummaryBox}>
                            <View style={styles.scorecardSummaryRow}>
                              <Text style={styles.scorecardSummaryLabel}>Extras</Text>
                              <Text style={styles.scorecardSummaryVal}>
                                {inn.extras?.total || 0} ({inn.extras?.breakdown || 'wd 0, nb 0, b 0, lb 0'})
                              </Text>
                            </View>
                            <View style={[styles.scorecardSummaryRow, { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 6, marginTop: 4 }]}>
                              <Text style={[styles.scorecardSummaryLabel, { fontWeight: '900', color: '#0f172a' }]}>TOTAL</Text>
                              <Text style={[styles.scorecardSummaryVal, { fontWeight: '900', color: '#b45309', fontSize: 13 }]}>
                                {inn.totalRuns || inn.score}/{inn.wickets || 0} ({inn.overs || '0.0'} Ov, CRR: {crrVal})
                              </Text>
                            </View>
                          </View>
                        </View>
                      ) : (
                        <View style={{ padding: 12, backgroundColor: '#f8fafc', borderRadius: 6 }}>
                          <Text style={{ color: '#475569', fontSize: 12 }}>Score: {inn.score || 'Innings in preparation'}</Text>
                        </View>
                      )}

                      {/* Overs Status & Active Bowler Banner in Home Scorecard */}
                      <View style={styles.homeOversBar}>
                        <View style={{ flex: 1, minWidth: 110 }}>
                          <Text style={styles.homeOversLabel}>CURRENT OVER</Text>
                          <Text style={styles.homeOversValue}>
                            Over {inn.currentOverNumber || (Math.floor(parseFloat(inn.overs || '0')) + 1)} ({inn.overs || '0.0'} / {inn.totalOvers || 20} Ov)
                          </Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 110 }}>
                          <Text style={styles.homeOversLabel}>OVERS REMAINING</Text>
                          <Text style={[styles.homeOversValue, { color: '#b45309' }]}>
                            {inn.oversRemaining ? `${inn.oversRemaining} Ov Left` : '0.0 Ov'}
                            {inn.ballsRemaining !== undefined ? ` (${inn.ballsRemaining} balls)` : ''}
                          </Text>
                        </View>
                        {inn.currentBowler && (
                          <View style={{ flex: 1, minWidth: 110 }}>
                            <Text style={styles.homeOversLabel}>CURRENT BOWLER</Text>
                            <Text style={[styles.homeOversValue, { color: '#005960' }]}>
                              {inn.currentBowler.name} (Active)
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Suspended Bowlers Warning */}
                      {Array.isArray(inn.suspendedBowlers) && inn.suspendedBowlers.length > 0 && (
                        <View style={[styles.homeSuspendedBanner, { flexDirection: 'row', alignItems: 'center' }]}>
                          <Ionicons name="hand-left-outline" size={14} color="#dc2626" style={{ marginRight: 6 }} />
                          <Text style={[styles.homeSuspendedText, { flex: 1 }]}>
                            Umpire Suspension (2 No-Balls): {inn.suspendedBowlers.map((b: any) => b.name).join(', ')} is suspended from bowling
                          </Text>
                        </View>
                      )}

                      {/* Bowling Figures Table */}
                      {inn.bowlers && inn.bowlers.length > 0 && (
                        <View style={{ marginTop: 14 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name="disc-outline" size={14} color="#0e184e" style={{ marginRight: 5 }} />
                              <Text style={styles.scorecardTableSubtitle}>BOWLING FIGURES</Text>
                            </View>
                            {inn.currentBowler && (
                              <View style={styles.homeActiveBowlerPill}>
                                <Text style={styles.homeActiveBowlerPillText}>Active: {inn.currentBowler.name}</Text>
                              </View>
                            )}
                          </View>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScrollWrapper}>
                            <View style={styles.scoreTable}>
                              <View style={styles.scoreTableHeader}>
                                <Text style={[styles.scoreTh, { width: 170 }]}>Bowler</Text>
                                <Text style={[styles.scoreTh, { width: 45, textAlign: 'center' }]}>O</Text>
                                <Text style={[styles.scoreTh, { width: 40, textAlign: 'center' }]}>M</Text>
                                <Text style={[styles.scoreTh, { width: 45, textAlign: 'center' }]}>R</Text>
                                <Text style={[styles.scoreTh, { width: 45, textAlign: 'center' }]}>W</Text>
                                <Text style={[styles.scoreTh, { width: 60, textAlign: 'right' }]}>ECON</Text>
                              </View>
                              {inn.bowlers.map((bw: any, bwIdx: number) => {
                                const isCurrent = !!(
                                  bw.isCurrentBowler ||
                                  (inn.currentBowler && (bw.playerId === inn.currentBowler.id || bw.name === inn.currentBowler.name))
                                );
                                const isSuspended = !!(
                                  bw.isSuspended ||
                                  (inn.suspendedBowlers || []).some((s: any) => s.id === bw.playerId || s.name === bw.name)
                                );

                                const subRecord = (inn.substitutions || []).find((s: any) =>
                                  s.oldBowlerId === bw.playerId || s.oldBowlerName === bw.name ||
                                  s.newBowlerId === bw.playerId || s.newBowlerName === bw.name
                                );

                                let badgeText = bw.subNote || '';
                                if (!badgeText) {
                                  if (isSuspended) {
                                    badgeText = 'Suspended (2 No-Balls)';
                                  } else if (subRecord) {
                                    if (subRecord.oldBowlerName === bw.name || subRecord.oldBowlerId === bw.playerId) {
                                      badgeText = subRecord.situation ? `Sub: ${subRecord.situation}` : 'Mid-Over Substituted';
                                    } else if (subRecord.isMidOver) {
                                      badgeText = 'Shared Over (Sub In)';
                                    }
                                  } else if (bw.overs && !bw.overs.endsWith('.0') && !isCurrent) {
                                    badgeText = `Mid-Over Sub (${bw.overs} ov)`;
                                  }
                                }

                                return (
                                  <View
                                    key={bw.id || bwIdx}
                                    style={[
                                      styles.scoreTableRow,
                                      bwIdx % 2 === 1 && styles.scoreTableRowAlt,
                                      isCurrent && { backgroundColor: '#f0fdfa' },
                                      isSuspended && { backgroundColor: '#fff1f2' }
                                    ]}
                                  >
                                    <View style={{ width: 170, paddingRight: 6 }}>
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                                        <Text style={[styles.scoreTd, { fontWeight: '700', color: isCurrent ? '#005960' : '#0f172a' }]}>
                                          {bw.name}
                                        </Text>
                                        {isCurrent && (
                                          <View style={styles.homeBowlingBadge}>
                                            <Text style={styles.homeBowlingBadgeText}>Bowling</Text>
                                          </View>
                                        )}
                                      </View>
                                      {isSuspended ? (
                                        <View style={styles.homeSuspendedPill}>
                                          <Text style={styles.homeSuspendedPillText}>Suspended (2 No-Balls)</Text>
                                        </View>
                                      ) : (bw.isQuotaFull || parseFloat(bw.overs || '0') >= (bw.maxQuota || 4.0)) ? (
                                        <View style={styles.homeQuotaPill}>
                                          <Text style={styles.homeQuotaPillText}>Quota Full ({bw.overs}/{bw.maxQuota || 4}.0 Ov)</Text>
                                        </View>
                                      ) : badgeText ? (
                                        <View style={styles.homeSubPill}>
                                          <Text style={styles.homeSubPillText}>{badgeText}</Text>
                                        </View>
                                      ) : null}
                                    </View>
                                    <Text style={[styles.scoreTd, { width: 45, textAlign: 'center', color: isCurrent ? '#005960' : '#334155', fontWeight: isCurrent ? '800' : 'normal' }]}>
                                      {bw.overs}
                                    </Text>
                                    <Text style={[styles.scoreTd, { width: 40, textAlign: 'center', color: '#334155' }]}>{bw.maidens || 0}</Text>
                                    <Text style={[styles.scoreTd, { width: 45, textAlign: 'center', color: '#334155' }]}>{bw.runs}</Text>
                                    <Text style={[styles.scoreTd, { width: 45, textAlign: 'center', fontWeight: '800', color: '#dc2626' }]}>{bw.wickets}</Text>
                                    <Text style={[styles.scoreTd, { width: 60, textAlign: 'right', fontWeight: '600', color: '#0f172a' }]}>
                                      {typeof bw.economy === 'number' ? bw.economy.toFixed(2) : bw.economy}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          </ScrollView>
                        </View>
                      )}

                      {/* Fall of Wickets */}
                      {Array.isArray(inn.fallOfWickets) && inn.fallOfWickets.length > 0 && (
                        <View style={{ marginTop: 14 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                            <Ionicons name="flash-outline" size={14} color="#0e184e" style={{ marginRight: 5 }} />
                            <Text style={styles.scorecardTableSubtitle}>FALL OF WICKETS</Text>
                          </View>
                          <View style={styles.scorecardFowWrapper}>
                            {inn.fallOfWickets.map((f: any, fIdx: number) => (
                              <View key={fIdx} style={styles.scorecardFowChip}>
                                <Text style={styles.scorecardFowScore}>{f.score || '0'}/{f.wicket || (fIdx + 1)}</Text>
                                <Text style={styles.scorecardFowBatter}>({f.batter || 'Batter'}, {f.over || '0.0'} ov)</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })
              ) : (
                <>
                  {/* Innings 1: SSK */}
                  <View style={styles.inningsHeaderRow}>
                    <Text style={styles.inningsTitle}>
                      {activeScorecardMatchData
                        ? `1st Innings: ${activeScorecardMatchData.teamA}`
                        : '1st Innings: Sivakasi Super Kings'}
                    </Text>
                    <Text style={styles.inningsScoreBadge}>
                      {activeScorecardMatchData?.scoreA || '162/8 (20.0 Ov)'}
                    </Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScrollWrapper}>
                    <View style={styles.scoreTable}>
                      <View style={styles.scoreTableHeader}>
                        <Text style={[styles.scoreTh, { width: 140 }]}>Batter</Text>
                        <Text style={[styles.scoreTh, { width: 130 }]}>Dismissal</Text>
                        <Text style={[styles.scoreTh, { width: 40, textAlign: 'center' }]}>R</Text>
                        <Text style={[styles.scoreTh, { width: 40, textAlign: 'center' }]}>B</Text>
                        <Text style={[styles.scoreTh, { width: 35, textAlign: 'center' }]}>4s</Text>
                        <Text style={[styles.scoreTh, { width: 35, textAlign: 'center' }]}>6s</Text>
                        <Text style={[styles.scoreTh, { width: 55, textAlign: 'right' }]}>SR</Text>
                      </View>
                      {[
                        { name: 'M. Anandhan', dis: 'c Balaji b Praveen', r: 52, b: 38, f: 5, s: 2, sr: '136.8' },
                        { name: 'C. Rajesh', dis: 'b Manikandan', r: 18, b: 15, f: 2, s: 0, sr: '120.0' },
                        { name: 'S. Karthik Raja (C/WK)', dis: 'c Muthukumar b Praveen', r: 41, b: 28, f: 4, s: 1, sr: '146.4' },
                        { name: 'D. Aravind', dis: 'run out (Saravanan)', r: 14, b: 12, f: 1, s: 0, sr: '116.7' },
                        { name: 'M. Vignesh', dis: 'not out', r: 22, b: 15, f: 2, s: 1, sr: '146.7' }
                      ].map((row, i) => (
                        <View key={i} style={[styles.scoreTableRow, i % 2 === 1 && styles.scoreTableRowAlt]}>
                          <Text style={[styles.scoreTd, { width: 140, fontWeight: '700', color: '#0f172a' }]}>{row.name}</Text>
                          <Text style={[styles.scoreTd, { width: 130, color: '#64748b' }]}>{row.dis}</Text>
                          <Text style={[styles.scoreTd, { width: 40, textAlign: 'center', fontWeight: '800', color: '#b45309' }]}>
                            {row.r}
                          </Text>
                          <Text style={[styles.scoreTd, { width: 40, textAlign: 'center', color: '#334155' }]}>{row.b}</Text>
                          <Text style={[styles.scoreTd, { width: 35, textAlign: 'center', color: '#334155' }]}>{row.f}</Text>
                          <Text style={[styles.scoreTd, { width: 35, textAlign: 'center', color: '#334155' }]}>{row.s}</Text>
                          <Text style={[styles.scoreTd, { width: 55, textAlign: 'right', fontWeight: '600', color: '#0f172a' }]}>{row.sr}</Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>

                  {/* Innings 2: VS */}
                  <View style={[styles.inningsHeaderRow, { marginTop: 18 }]}>
                    <Text style={styles.inningsTitle}>
                      {activeScorecardMatchData
                        ? `2nd Innings: ${activeScorecardMatchData.teamB}`
                        : '2nd Innings: Virudhunagar Strikers'}
                    </Text>
                    <Text style={styles.inningsScoreBadge}>
                      {activeScorecardMatchData?.scoreB || '164/5 (18.2 Ov)'}
                    </Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScrollWrapper}>
                    <View style={styles.scoreTable}>
                      <View style={styles.scoreTableHeader}>
                        <Text style={[styles.scoreTh, { width: 140 }]}>Batter</Text>
                        <Text style={[styles.scoreTh, { width: 130 }]}>Dismissal</Text>
                        <Text style={[styles.scoreTh, { width: 40, textAlign: 'center' }]}>R</Text>
                        <Text style={[styles.scoreTh, { width: 40, textAlign: 'center' }]}>B</Text>
                        <Text style={[styles.scoreTh, { width: 35, textAlign: 'center' }]}>4s</Text>
                        <Text style={[styles.scoreTh, { width: 35, textAlign: 'center' }]}>6s</Text>
                        <Text style={[styles.scoreTh, { width: 55, textAlign: 'right' }]}>SR</Text>
                      </View>
                      {[
                        { name: 'R. Saravanan', dis: 'c Karthik b Vignesh', r: 68, b: 42, f: 7, s: 3, sr: '161.9' },
                        { name: 'P. Muthukumar', dis: 'b Aravind', r: 34, b: 26, f: 3, s: 1, sr: '130.8' },
                        { name: 'S. Balaji (WK)', dis: 'lbw b Vignesh', r: 12, b: 10, f: 1, s: 0, sr: '120.0' },
                        { name: 'T. Manikandan (C)', dis: 'not out', r: 28, b: 18, f: 3, s: 1, sr: '155.6' },
                        { name: 'K. Ganesan', dis: 'not out', r: 14, b: 8, f: 1, s: 1, sr: '175.0' }
                      ].map((row, i) => (
                        <View key={i} style={[styles.scoreTableRow, i % 2 === 1 && styles.scoreTableRowAlt]}>
                          <Text style={[styles.scoreTd, { width: 140, fontWeight: '700', color: '#0f172a' }]}>{row.name}</Text>
                          <Text style={[styles.scoreTd, { width: 130, color: '#64748b' }]}>{row.dis}</Text>
                          <Text style={[styles.scoreTd, { width: 40, textAlign: 'center', fontWeight: '800', color: '#b45309' }]}>
                            {row.r}
                          </Text>
                          <Text style={[styles.scoreTd, { width: 40, textAlign: 'center', color: '#334155' }]}>{row.b}</Text>
                          <Text style={[styles.scoreTd, { width: 35, textAlign: 'center', color: '#334155' }]}>{row.f}</Text>
                          <Text style={[styles.scoreTd, { width: 35, textAlign: 'center', color: '#334155' }]}>{row.s}</Text>
                          <Text style={[styles.scoreTd, { width: 55, textAlign: 'right', fontWeight: '600', color: '#0f172a' }]}>{row.sr}</Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}

            </ScrollView>

            <TouchableOpacity style={styles.btnActionPrimary} onPress={() => setScorecardModalVisible(false)}>
              <Text style={styles.btnActionPrimaryText}>Close Scorecard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── PLAYER PROFILE MODAL ────────────────────────────────────────── */}
      <Modal
        visible={!!selectedPlayerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPlayerModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.playerModalBox, isMobile && { width: '96%', maxHeight: '92%', padding: 16 }]}>
            {selectedPlayerModal && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
                {/* Header with Avatar & Close Button */}
                <View style={styles.modalHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
                    {resolveImageUrl(selectedPlayerModal.photo || (selectedPlayerModal as any).image || (selectedPlayerModal as any).image_path) ? (
                      <Image
                        source={{ uri: resolveImageUrl(selectedPlayerModal.photo || (selectedPlayerModal as any).image || (selectedPlayerModal as any).image_path)! }}
                        style={[styles.playerAvatar, { width: 50, height: 50, borderRadius: 25, resizeMode: 'cover', overflow: 'hidden' }]}
                      />
                    ) : (
                      <LinearGradient
                        colors={selectedPlayerModal.avatarColor || ['#1e3a8a', '#3b82f6']}
                        style={[styles.playerAvatar, { width: 50, height: 50, borderRadius: 25 }]}
                      >
                        <Text style={[styles.playerAvatarText, { fontSize: 18 }]}>
                          {selectedPlayerModal.name
                            .split(' ')
                            .map((w: string) => w[0])
                            .join('')
                            .slice(0, 2)}
                        </Text>
                      </LinearGradient>
                    )}
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.playerIdTag}>{selectedPlayerModal.id}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="checkmark-circle" size={11} color="#059669" style={{ marginRight: 3 }} />
                          <Text style={styles.playerVerifiedTag}>Official Record</Text>
                        </View>
                      </View>
                      <Text style={[styles.modalTitle, { fontSize: 17 }]}>{selectedPlayerModal.name}</Text>
                      <Text style={styles.modalSub}>
                        {selectedPlayerModal.categoryLabel || "Senior Men's Division"}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseCircleBtn}
                    onPress={() => setSelectedPlayerModal(null)}
                  >
                    <Ionicons name="close" size={20} color="#0f172a" />
                  </TouchableOpacity>
                </View>

                {/* Featured Milestone Highlight Card in Modal */}
                <View style={{
                  backgroundColor: '#fffdf5',
                  borderColor: '#fde68a',
                  borderWidth: 1.5,
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 14,
                  marginTop: 4
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="trophy" size={13} color="#b45309" style={{ marginRight: 5 }} />
                      <Text style={{ color: '#b45309', fontWeight: '900', fontSize: 12.5, letterSpacing: 0.5 }}>
                        {(selectedPlayerModal.milestoneBadge || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim() || 'OFFICIAL DISTRICT MATCH RECORD'}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: '#fef3c7', borderColor: '#fde68a', borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                      <Text style={{ color: '#92400e', fontSize: 10.5, fontWeight: '800' }}>
                        MILESTONE
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="flash" size={18} color="#b45309" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 18 }}>
                      {selectedPlayerModal.matchPerformance || `${selectedPlayerModal.stats?.hs || '0'} Runs Milestone`}
                    </Text>
                  </View>

                  {selectedPlayerModal.matchVs && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                      <Ionicons name="location-outline" size={13} color="#64748b" style={{ marginRight: 4 }} />
                      <Text style={{ color: '#334155', fontSize: 13, fontWeight: '600' }}>
                        {selectedPlayerModal.matchVs}
                      </Text>
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 4, paddingTop: 8, borderTopColor: '#fef3c7', borderTopWidth: 1 }}>
                    {selectedPlayerModal.stats?.sr && (
                      <Text style={{ color: '#475569', fontSize: 12 }}>
                        <Text style={{ fontWeight: '700', color: '#0f172a' }}>Strike Rate: </Text>
                        {selectedPlayerModal.stats.sr}
                      </Text>
                    )}
                    {selectedPlayerModal.stats?.econ && (
                      <Text style={{ color: '#475569', fontSize: 12 }}>
                        <Text style={{ fontWeight: '700', color: '#0f172a' }}>Economy: </Text>
                        {selectedPlayerModal.stats.econ}
                      </Text>
                    )}
                    {selectedPlayerModal.stats?.best && (
                      <Text style={{ color: '#475569', fontSize: 12 }}>
                        <Text style={{ fontWeight: '700', color: '#0f172a' }}>Best Spell: </Text>
                        {selectedPlayerModal.stats.best}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Player Affiliation & Profile Logistics */}
                <Text style={[styles.inningsTitle, { marginBottom: 8, fontSize: 13.5 }]}>Player & Affiliation Details</Text>
                <View style={[styles.playerModalMetaBox, { marginBottom: 14 }]}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    <View style={{ width: '48%', minWidth: 135 }}>
                      <Text style={{ fontSize: 10.5, color: '#64748b', fontWeight: '700' }}>TEAM</Text>
                      <Text style={{ fontSize: 13, color: '#0f172a', fontWeight: '800', marginTop: 1 }}>
                        {selectedPlayerModal.team}
                      </Text>
                    </View>
                    <View style={{ width: '48%', minWidth: 135 }}>
                      <Text style={{ fontSize: 10.5, color: '#64748b', fontWeight: '700' }}>TALUK CENTER</Text>
                      <Text style={{ fontSize: 13, color: '#0f172a', fontWeight: '800', marginTop: 1 }}>
                        {selectedPlayerModal.taluk} District Center
                      </Text>
                    </View>
                    <View style={{ width: '48%', minWidth: 135, marginTop: 4 }}>
                      <Text style={{ fontSize: 10.5, color: '#64748b', fontWeight: '700' }}>BATTING STYLE</Text>
                      <Text style={{ fontSize: 12.5, color: '#334155', fontWeight: '700', marginTop: 1 }}>
                        {selectedPlayerModal.battingStyle || 'Right Hand Bat'}
                      </Text>
                    </View>
                    <View style={{ width: '48%', minWidth: 135, marginTop: 4 }}>
                      <Text style={{ fontSize: 10.5, color: '#64748b', fontWeight: '700' }}>BOWLING STYLE</Text>
                      <Text style={{ fontSize: 12.5, color: '#334155', fontWeight: '700', marginTop: 1 }}>
                        {selectedPlayerModal.bowlingStyle || 'Right Arm Medium'}
                      </Text>
                    </View>
                    <View style={{ width: '48%', minWidth: 135, marginTop: 4 }}>
                      <Text style={{ fontSize: 10.5, color: '#64748b', fontWeight: '700' }}>PLAYING ROLE</Text>
                      <Text style={{ fontSize: 12.5, color: '#334155', fontWeight: '700', marginTop: 1 }}>
                        {selectedPlayerModal.roleLabel || selectedPlayerModal.playingRole || 'Player'}
                      </Text>
                    </View>
                    <View style={{ width: '48%', minWidth: 135, marginTop: 4 }}>
                      <Text style={{ fontSize: 10.5, color: '#64748b', fontWeight: '700' }}>REGISTRATION</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
                        <Ionicons name="checkmark-circle" size={12} color="#15803d" style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 12.5, color: '#15803d', fontWeight: '800' }}>
                          Verified District Panel
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Season & Career Statistics */}
                <Text style={[styles.inningsTitle, { marginBottom: 8, fontSize: 13.5 }]}>Career Statistics Overview</Text>
                <View style={[styles.playerModalStatsRow, { marginBottom: 14 }]}>
                  <View style={styles.pmsItem}>
                    <Text style={styles.pmsVal}>{selectedPlayerModal.stats?.mat || 0}</Text>
                    <Text style={styles.pmsLabel}>Matches</Text>
                  </View>
                  <View style={styles.pmsItem}>
                    <Text style={styles.pmsVal}>{selectedPlayerModal.stats?.runs || 0}</Text>
                    <Text style={styles.pmsLabel}>Runs</Text>
                  </View>
                  <View style={styles.pmsItem}>
                    <Text style={styles.pmsVal}>{selectedPlayerModal.stats?.hs || '-'}</Text>
                    <Text style={styles.pmsLabel}>HS</Text>
                  </View>
                  <View style={styles.pmsItem}>
                    <Text style={styles.pmsVal}>{selectedPlayerModal.stats?.avg || '-'}</Text>
                    <Text style={styles.pmsLabel}>Avg</Text>
                  </View>
                  <View style={styles.pmsItem}>
                    <Text style={styles.pmsVal}>{selectedPlayerModal.stats?.wkts || 0}</Text>
                    <Text style={styles.pmsLabel}>Wickets</Text>
                  </View>
                  <View style={styles.pmsItem}>
                    <Text style={styles.pmsVal}>{selectedPlayerModal.stats?.catches || 0}</Text>
                    <Text style={styles.pmsLabel}>Catches</Text>
                  </View>
                </View>

                {/* Player Biography */}
                {selectedPlayerModal.bio ? (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={[styles.inningsTitle, { marginBottom: 6, fontSize: 13.5 }]}>Performance Narrative</Text>
                    <View style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 10, padding: 12 }}>
                      <Text style={{ color: '#475569', fontSize: 12.5, lineHeight: 19 }}>
                        {selectedPlayerModal.bio}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* Close Profile Button */}
                <TouchableOpacity
                  style={[styles.btnGoldSm, { marginTop: 4, paddingVertical: 12 }]}
                  onPress={() => setSelectedPlayerModal(null)}
                >
                  <Text style={[styles.btnGoldSmText, { fontSize: 14 }]}>Close Record Details</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── LIGHTBOX IMAGE MODAL ────────────────────────────────────────── */}
      <Modal visible={!!lightboxImage} transparent animationType="fade" onRequestClose={() => setLightboxImage(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.lightboxBox}>
            <TouchableOpacity style={styles.lightboxCloseBtn} onPress={() => setLightboxImage(null)}>
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
            {lightboxImage && (
              <View style={{ alignItems: 'center' }}>
                <Image source={lightboxImage.uri} style={styles.lightboxImg} resizeMode="contain" />
                <Text style={styles.lightboxCaption}>{lightboxImage.caption}</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── NEWS CIRCULAR MODAL ─────────────────────────────────────────── */}
      <Modal visible={!!activeNewsModal} transparent animationType="fade" onRequestClose={() => setActiveNewsModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.newsModalBox}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.badgeGoldText}>OFFICIAL FEDERATION CIRCULAR</Text>
                <Text style={styles.modalTitle}>{activeNewsModal?.title}</Text>
                <Text style={styles.modalSub}>{activeNewsModal?.date}</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveNewsModal(null)}>
                <Ionicons name="close" size={20} color="#0f172a" />
              </TouchableOpacity>
            </View>
            <Text style={styles.newsModalContent}>{activeNewsModal?.content}</Text>
            <TouchableOpacity style={styles.btnGoldSm} onPress={() => setActiveNewsModal(null)}>
              <Text style={styles.btnGoldSmText}>Close Circular</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Official ICC & TNCA Broadcast Umpire Signal Overlay */}
      <UmpireSignalOverlay
        event={activeUmpireSignal}
        onDismiss={() => setActiveUmpireSignal(null)}
      />

      {/* Umpire Signals Showcase Gallery Modal */}
      <UmpireSignalsGalleryModal
        visible={showUmpireGallery}
        onClose={() => setShowUmpireGallery(false)}
        onSelectSignal={(sigType) => {
          setActiveUmpireSignal({
            type: sigType,
            overText: 'CFVD League Live Showcase • Kamarajar Stadium'
          });
        }}
      />

      {/* Full-Screen Video Preloader / Intro Player */}
      {showIntroVideo && (
        <VideoPreloader onComplete={() => setShowIntroVideo(false)} />
      )}

      {/* Dynamic Admin-Controlled Home Portal Popup */}
      {homePopupConfig && (
        <Modal
          visible={showHomePopup}
          transparent
          animationType="fade"
          onRequestClose={() => setShowHomePopup(false)}
        >
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(15, 23, 42, 0.72)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16
          }}>
            <View style={{
              width: '100%',
              maxWidth: 460,
              backgroundColor: '#ffffff',
              borderRadius: 18,
              overflow: 'hidden',
              borderWidth: 1.5,
              borderColor: '#fde68a',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.25,
              shadowRadius: 24,
              elevation: 14
            }}>
              <View style={{ position: 'relative' }}>
                <Image
                  source={resolveHomePopupImageSource(homePopupConfig.imageKey, homePopupConfig.customImageUrl)}
                  style={{ width: '100%', height: 160 }}
                  resizeMode="cover"
                />
                <View style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  backgroundColor: '#d97706',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 6
                }}>
                  <Text style={{ color: '#ffffff', fontSize: 10.5, fontWeight: '800' }}>
                    🏏 {homePopupConfig.badgeText || 'OFFICIAL CFVD NOTICE'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowHomePopup(false)}
                  activeOpacity={0.8}
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: 'rgba(15, 23, 42, 0.72)',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '800' }}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={{ padding: 18 }}>
                <Text style={{ fontSize: 17, fontWeight: '900', color: '#0f172a', lineHeight: 23 }}>
                  {homePopupConfig.title}
                </Text>
                {Boolean(homePopupConfig.message) && (
                  <Text style={{ fontSize: 13.5, color: '#475569', marginTop: 8, lineHeight: 20 }}>
                    {homePopupConfig.message}
                  </Text>
                )}
                {Boolean(homePopupConfig.highlightText) && (
                  <View style={{
                    backgroundColor: '#fffbeb',
                    borderWidth: 1,
                    borderColor: '#fde68a',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    marginTop: 12
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#92400e', lineHeight: 17 }}>
                      ⚖️ {homePopupConfig.highlightText}
                    </Text>
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setShowHomePopup(false);
                      const dest = homePopupConfig.buttonDestination;
                      if (dest === 'register') {
                        router.push('/register');
                      } else if (dest === 'rules') {
                        scrollToSection('rules');
                      } else if (dest === 'tournaments') {
                        scrollToSection('tournaments');
                      } else {
                        scrollToSection('matchCentre');
                      }
                    }}
                    activeOpacity={0.85}
                    style={{
                      flex: 1,
                      backgroundColor: '#d97706',
                      borderRadius: 10,
                      paddingVertical: 12,
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Text style={{ color: '#ffffff', fontSize: 13.5, fontWeight: '800' }}>
                      {homePopupConfig.buttonText || 'View Details →'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowHomePopup(false)}
                    activeOpacity={0.8}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: '#cbd5e1',
                      backgroundColor: '#f8fafc',
                      justifyContent: 'center'
                    }}
                  >
                    <Text style={{ color: '#475569', fontSize: 13, fontWeight: '700' }}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}
      {/* Reusable Select Options Dropdown Modal */}
      <Modal
        visible={!!activeDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveDropdown(null)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setActiveDropdown(null)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 360,
              backgroundColor: '#ffffff',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.2,
              shadowRadius: 20,
              elevation: 12
            }}
          >
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: '#f8fafc',
              borderBottomWidth: 1,
              borderBottomColor: '#e2e8f0'
            }}>
              <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#0e184e' }}>
                Select {activeDropdown?.title}
              </Text>
              <TouchableOpacity onPress={() => setActiveDropdown(null)}>
                <Ionicons name="close" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }}>
              {(activeDropdown?.options || []).map((opt) => {
                const isSelected = opt.id === activeDropdown?.selectedId;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => {
                      const cb = activeDropdown?.onSelect;
                      setActiveDropdown(null);
                      if (cb) cb(opt.id);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: '#f1f5f9',
                      backgroundColor: isSelected ? '#fffbeb' : '#ffffff'
                    }}
                  >
                    <Text style={{
                      fontSize: 13,
                      fontWeight: isSelected ? '800' : '600',
                      color: isSelected ? '#b45309' : '#1e293b',
                      flex: 1
                    }}>
                      {opt.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={17} color="#d97706" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
