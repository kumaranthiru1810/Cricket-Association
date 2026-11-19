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
import { StatusBar } from 'expo-status-bar';
import { io } from 'socket.io-client';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppNavigation } from '../src/navigation/AppNavigator';
import { ScorerApi, PlayerApi, getCurrentUser, setCurrentUser, setAuthToken, logoutAndClearAllSessions, SOCKET_URL, resolveImageUrl } from '../src/services/api';
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

// Points Tables Data
interface StandingsRow {
  stand: number;
  badge?: 'gold' | 'silver' | 'bronze' | '';
  name: string;
  sub?: string;
  p: number;
  w: number;
  l: number;
  nr: number;
  bonus: number;
  nrr: string;
  pts: number;
  form: Array<'w' | 'l' | 'nr'>;
  code: string;
}

const TABLE_DATA: Record<string, StandingsRow[]> = {
  div1: [
    { stand: 1, badge: 'gold', name: 'Virudhunagar Strikers CC', sub: 'Qualified for Knockouts', p: 7, w: 5, l: 1, nr: 1, bonus: 3, nrr: '+1.428', pts: 25, form: ['w', 'w', 'nr', 'l', 'w'], code: 'VS' },
    { stand: 2, badge: 'silver', name: 'Sivakasi Super Kings', sub: 'Qualified for Knockouts', p: 7, w: 5, l: 2, nr: 0, bonus: 2, nrr: '+0.892', pts: 22, form: ['w', 'l', 'w', 'w', 'w'], code: 'SSK' },
    { stand: 3, badge: 'bronze', name: 'Rajapalayam Cricket Club', sub: 'In Contention', p: 7, w: 4, l: 2, nr: 1, bonus: 2, nrr: '+0.510', pts: 19, form: ['w', 'w', 'nr', 'l', 'w'], code: 'RCC' },
    { stand: 4, badge: '', name: 'Srivilliputhur Warriors', sub: 'In Contention', p: 7, w: 4, l: 3, nr: 0, bonus: 1, nrr: '+0.215', pts: 17, form: ['l', 'w', 'w', 'l', 'w'], code: 'SW' },
    { stand: 5, badge: '', name: 'Aruppukottai Stars CC', sub: '', p: 7, w: 3, l: 3, nr: 1, bonus: 1, nrr: '-0.118', pts: 14, form: ['l', 'l', 'nr', 'w', 'l'], code: 'AKS' },
    { stand: 6, badge: '', name: 'Sattur Cricket XI', sub: '', p: 7, w: 2, l: 4, nr: 1, bonus: 0, nrr: '-0.640', pts: 9, form: ['l', 'w', 'nr', 'l', 'l'], code: 'SXI' },
    { stand: 7, badge: '', name: 'Thiruthangal CC', sub: '', p: 7, w: 1, l: 5, nr: 1, bonus: 0, nrr: '-1.204', pts: 5, form: ['l', 'nr', 'l', 'l', 'w'], code: 'TKC' }
  ],
  college: [
    { stand: 1, badge: 'gold', name: 'VHNSN College, Virudhunagar', sub: 'Champions Bracket', p: 5, w: 4, l: 0, nr: 1, bonus: 2, nrr: '+1.940', pts: 15, form: ['w', 'w', 'w', 'nr', 'w'], code: 'VHN' },
    { stand: 2, badge: 'silver', name: 'PSR Engineering College, Sivakasi', sub: 'Qualified', p: 5, w: 3, l: 1, nr: 1, bonus: 2, nrr: '+1.180', pts: 12, form: ['w', 'nr', 'l', 'w', 'w'], code: 'PSR' },
    { stand: 3, badge: 'bronze', name: 'Ayya Nadar Janaki Ammal College (ANJAC)', sub: '3rd Place', p: 5, w: 3, l: 2, nr: 0, bonus: 1, nrr: '+0.450', pts: 10, form: ['w', 'l', 'w', 'w', 'l'], code: 'ANJ' },
    { stand: 4, badge: '', name: 'Rajapalayam Rajus College', sub: 'In Contention', p: 5, w: 2, l: 2, nr: 1, bonus: 1, nrr: '-0.120', pts: 8, form: ['l', 'w', 'nr', 'l', 'w'], code: 'RRC' },
    { stand: 5, badge: '', name: 'Kalasalingam University, Krishnankoil', sub: '', p: 5, w: 1, l: 4, nr: 0, bonus: 0, nrr: '-0.850', pts: 3, form: ['l', 'l', 'l', 'w', 'l'], code: 'KLU' }
  ],
  t20: [
    { stand: 1, badge: 'gold', name: 'Srivilliputhur Warriors T20', sub: 'Finalist', p: 6, w: 5, l: 1, nr: 0, bonus: 2, nrr: '+2.140', pts: 12, form: ['w', 'w', 'w', 'l', 'w'], code: 'SW' },
    { stand: 2, badge: 'silver', name: 'Virudhunagar Strikers', sub: 'Finalist', p: 6, w: 5, l: 1, nr: 0, bonus: 2, nrr: '+1.860', pts: 12, form: ['w', 'w', 'l', 'w', 'w'], code: 'VS' },
    { stand: 3, badge: 'bronze', name: 'Sivakasi Super Kings', sub: 'Semi-Finalist', p: 6, w: 4, l: 2, nr: 0, bonus: 1, nrr: '+0.740', pts: 9, form: ['l', 'w', 'w', 'w', 'l'], code: 'SSK' },
    { stand: 4, badge: '', name: 'Rajapalayam CC', sub: 'Semi-Finalist', p: 6, w: 3, l: 3, nr: 0, bonus: 1, nrr: '-0.110', pts: 7, form: ['w', 'l', 'w', 'l', 'l'], code: 'RCC' }
  ],
  school: [
    { stand: 1, badge: 'gold', name: 'KVS Hr Sec School, Virudhunagar', sub: 'Champions', p: 4, w: 4, l: 0, nr: 0, bonus: 2, nrr: '+2.600', pts: 10, form: ['w', 'w', 'w', 'w'], code: 'KVS' },
    { stand: 2, badge: 'silver', name: 'PACM High School, Rajapalayam', sub: 'Runners-up', p: 4, w: 3, l: 1, nr: 0, bonus: 1, nrr: '+1.200', pts: 7, form: ['w', 'w', 'l', 'w'], code: 'PAC' },
    { stand: 3, badge: 'bronze', name: 'S.H.N. Girls HSS, Sivakasi', sub: '3rd Place', p: 4, w: 2, l: 2, nr: 0, bonus: 1, nrr: '+0.150', pts: 5, form: ['l', 'w', 'w', 'l'], code: 'SHN' }
  ]
};

// Player Performance Data
const PERF_DATA = {
  batting: [
    { stand: 1, name: 'R. Saravanan', role: 'Batter', team: 'Virudhunagar Strikers', mat: 8, inns: 8, runs: 445, hs: '112*', avg: '63.57', sr: '149.3', fifties: 3, hundreds: 1 },
    { stand: 2, name: 'S. Karthik Raja', role: 'Wicketkeeper Batter', team: 'Rajapalayam CC', mat: 7, inns: 7, runs: 375, hs: '104', avg: '53.57', sr: '133.9', fifties: 2, hundreds: 1 },
    { stand: 3, name: 'M. Anandhan', role: 'Top Order Batter', team: 'Sivakasi Super Kings', mat: 7, inns: 7, runs: 344, hs: '88', avg: '49.14', sr: '128.3', fifties: 3, hundreds: 0 },
    { stand: 4, name: 'P. Muthukumar', role: 'Middle Order Batter', team: 'Srivilliputhur Warriors', mat: 7, inns: 7, runs: 287, hs: '74*', avg: '47.83', sr: '138.6', fifties: 2, hundreds: 0 },
    { stand: 5, name: 'K. Ganesan', role: 'Batting All-Rounder', team: 'Aruppukottai Stars', mat: 6, inns: 6, runs: 260, hs: '68', avg: '43.33', sr: '142.8', fifties: 2, hundreds: 0 }
  ],
  bowling: [
    { stand: 1, name: 'K. Praveen Kumar', role: 'Right-Arm Off Spin', team: 'Virudhunagar CC', mat: 8, inns: 8, overs: '30.4', runs: 168, wkts: 21, econ: '5.47', threeWkts: 3, fiveWkts: 1 },
    { stand: 2, name: 'M. Vignesh', role: 'Left-Arm Fast Medium', team: 'Sivakasi Super Kings', mat: 8, inns: 8, overs: '31.2', runs: 194, wkts: 18, econ: '6.19', threeWkts: 2, fiveWkts: 1 },
    { stand: 3, name: 'D. Aravind', role: 'Right-Arm Leg Spin', team: 'Srivilliputhur Warriors', mat: 7, inns: 7, overs: '28.0', runs: 162, wkts: 16, econ: '5.78', threeWkts: 2, fiveWkts: 0 },
    { stand: 4, name: 'T. Manikandan', role: 'Right-Arm Medium Fast', team: 'Rajapalayam CC', mat: 7, inns: 7, overs: '27.0', runs: 171, wkts: 14, econ: '6.33', threeWkts: 1, fiveWkts: 0 },
    { stand: 5, name: 'S. Balamurugan', role: 'Slow Left-Arm Orthodox', team: 'Sattur XI', mat: 7, inns: 7, overs: '26.0', runs: 153, wkts: 13, econ: '5.88', threeWkts: 1, fiveWkts: 0 }
  ],
  fielding: [
    { stand: 1, name: 'S. Balaji', role: 'Wicketkeeper Batter', team: 'Virudhunagar Strikers', mat: 8, inns: 8, catches: 11, stumpings: 4, runOuts: 2, total: 17 },
    { stand: 2, name: 'S. Karthik Raja', role: 'Wicketkeeper Batter', team: 'Rajapalayam CC', mat: 7, inns: 7, catches: 9, stumpings: 3, runOuts: 1, total: 13 },
    { stand: 3, name: 'R. Saravanan', role: 'Batter (Slip/Cover)', team: 'Virudhunagar Strikers', mat: 8, inns: 8, catches: 8, stumpings: 0, runOuts: 3, total: 11 },
    { stand: 4, name: 'M. Anandhan', role: 'Outfielder', team: 'Sivakasi Super Kings', mat: 7, inns: 7, catches: 7, stumpings: 0, runOuts: 2, total: 9 },
    { stand: 5, name: 'P. Muthukumar', role: 'Point/Cover Specialist', team: 'Srivilliputhur Warriors', mat: 7, inns: 7, catches: 6, stumpings: 0, runOuts: 2, total: 8 }
  ]
};

// District Players Data
interface DistrictPlayer {
  id: string;
  name: string;
  role: 'batter' | 'bowler' | 'allrounder' | 'wicketkeeper' | 'womens';
  roleLabel: string;
  playingRole: string;
  battingStyle: string;
  bowlingStyle: string;
  team: string;
  teamShort?: string;
  taluk: string;
  category: string;
  categoryLabel: string;
  verified: boolean;
  photo?: string;
  image?: string;
  image_path?: string;
  avatarColor: [string, string];
  milestoneType?: 'century' | 'fifty' | 'bowling_haul';
  milestoneBadge?: string;
  matchPerformance?: string;
  matchVs?: string;
  stats: {
    mat: number;
    inns: number;
    runs: number;
    hs: string;
    avg: string;
    sr: string;
    fifties: number;
    hundreds: number;
    wkts: number;
    best?: string;
    econ?: string;
    catches: number;
    stumpings?: number;
  };
  bio: string;
}

// Affiliated Colleges Data
interface CollegeItem {
  id: string;
  name: string;
  taluk: string;
  teams: number;
  head: string;
  ground: string;
  phone: string;
}

const INITIAL_COLLEGES: CollegeItem[] = [
  { id: 'col-1', name: 'VHNSN College (Autonomous)', taluk: 'Virudhunagar', teams: 2, head: 'Dr. C. Chelladurai', ground: 'Turf + Nets', phone: '+91 94431 23450' },
  { id: 'col-2', name: 'Ayya Nadar Janaki Ammal College (ANJAC)', taluk: 'Sivakasi', teams: 2, head: 'Prof. R. Rajendran', ground: 'Pavilion Ground', phone: '+91 94432 34561' },
  { id: 'col-3', name: 'Rajapalayam Rajus College', taluk: 'Rajapalayam', teams: 2, head: 'Dr. M. Sridhar', ground: 'Turf Wicket', phone: '+91 94433 45672' },
  { id: 'col-4', name: 'PSR Engineering College', taluk: 'Sivakasi', teams: 2, head: 'Prof. V. Sivakumar', ground: 'Sports Enclave Turf', phone: '+91 94434 56783' },
  { id: 'col-5', name: 'Kalasalingam University', taluk: 'Srivilliputhur', teams: 2, head: 'Dr. S. Balamurugan', ground: 'Stadium Ground', phone: '+91 94435 67894' },
  { id: 'col-6', name: 'SFR College for Women', taluk: 'Sivakasi', teams: 1, head: 'Dr. K. Meenakshi', ground: 'Pavilion Field', phone: '+91 94436 78905' }
];

// Officials Roster
const OFFICIALS_ROSTER = [
  { name: 'Thiru. K. Sundaram', role: 'Umpire', grade: 'Panel A - Senior', taluk: 'Virudhunagar', matches: 38, status: 'Active' },
  { name: 'Thiru. M. Ramanathan', role: 'Umpire', grade: 'Senior Panel', taluk: 'Sivakasi', matches: 34, status: 'Active' },
  { name: 'Thiru. A. Gurunathan', role: 'Umpire', grade: 'Panel A', taluk: 'Rajapalayam', matches: 29, status: 'Active' },
  { name: 'Thiru. S. Shanmugam', role: 'Umpire', grade: 'Level 2', taluk: 'Aruppukottai', matches: 22, status: 'Active' },
  { name: 'Thiru. S. Ramesh', role: 'Digital Scorer', grade: 'Chief Scorer', taluk: 'Virudhunagar', matches: 45, status: 'Active' },
  { name: 'Thiru. K. Vijayakumar', role: 'Digital Scorer', grade: 'Certified Live Scorer', taluk: 'Sivakasi', matches: 31, status: 'Active' },
  { name: 'Thiru. P. Chandran', role: 'Match Referee', grade: 'Chief District Referee', taluk: 'Virudhunagar', matches: 50, status: 'Active' }
];

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
            setCurrentUser(res.user);
            setSessionUser(res.user);
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

  const handleSecretBallTap = (ball: 'LEFT' | 'RIGHT' | 'CENTER') => {
    if (secretTimeoutRef.current) {
      clearTimeout(secretTimeoutRef.current);
    }

    const EXPECTED_SEQUENCE = ['LEFT', 'RIGHT', 'LEFT', 'RIGHT', 'CENTER'];
    const currentStep = secretTapHistory.current.length;
    const expected = EXPECTED_SEQUENCE[currentStep];

    if (ball === expected) {
      const nextHistory = [...secretTapHistory.current, ball];
      secretTapHistory.current = nextHistory;

      // When all 5 taps match perfectly:
      if (nextHistory.length === 5) {
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
          navigate('Admin', { user: existingAdminUser || activeUser });
        } else {
          // First time or not authenticated -> MUST go to Admin Login to enter credentials
          navigate('AdminLogin');
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
    };
    const resolvedKey = posKeyMap[secName] || secName;

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
      };

      const targetId = idMap[secName] || idMap[resolvedKey] || secName;
      const el = document.getElementById(targetId);

      if (el) {
        // Scroll the ScrollView's DOM node directly using precise bounding geometry
        const scrollNode =
          (mainScrollRef.current as any)?.getScrollableNode?.() ||
          (mainScrollRef.current as any)?._nativeRef ||
          el.closest('[style*="overflow"]') ||
          document.querySelector('[data-class~="r-overflowY-1v1zgw7"]') ||
          document.querySelector('div[style*="overflow-y"]') ||
          document.documentElement;

        if (scrollNode && typeof scrollNode.getBoundingClientRect === 'function') {
          const scrollRect = scrollNode.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          const targetY = scrollNode.scrollTop + (elRect.top - scrollRect.top);
          scrollNode.scrollTo({ top: Math.max(0, targetY - 10), behavior: 'smooth' });
          return;
        }

        // Fallback: window scroll or standard scrollIntoView with scrollMarginTop
        if (typeof window !== 'undefined') {
          const winTargetY = window.scrollY + el.getBoundingClientRect().top - 95;
          window.scrollTo({ top: Math.max(0, winTargetY), behavior: 'smooth' });
        }
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (_err) {}
        return;
      }
    }

    const y = sectionPositions[resolvedKey] || sectionPositions[secName] || 0;
    mainScrollRef.current?.scrollTo({ y: Math.max(0, y - 10), animated: true });
  };

  // State: Mobile Nav Menu
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // State: Match Centre Filter & Pagination (Reusable 8 items per page)
  const [matchFilter, setMatchFilter] = useState<'all' | 'live' | 'upcoming' | 'postponed' | 'results'>('all');
  const [matchPage, setMatchPage] = useState<number>(1);
  const MATCHES_PER_PAGE = 8;

  // State: Standings Points Table Pagination (Reusable 8 items per page)
  const [standingsPage, setStandingsPage] = useState<number>(1);
  const STANDINGS_PER_PAGE = 8;

  // State: Performance Records Pagination (Reusable 8 items per page)
  const [perfRatingsPage, setPerfRatingsPage] = useState<number>(1);
  const [perfBattingPage, setPerfBattingPage] = useState<number>(1);
  const [perfBowlingPage, setPerfBowlingPage] = useState<number>(1);
  const [perfFieldingPage, setPerfFieldingPage] = useState<number>(1);
  const PERF_PER_PAGE = 8;

  // State: Player Milestone Hall of Fame Pagination (Reusable 8 items per page)
  const [milestonePage, setMilestonePage] = useState<number>(1);
  const MILESTONE_PER_PAGE = 8;

  // Dynamic Real Match State from MongoDB
  const [publicMatches, setPublicMatches] = useState<any[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState<boolean>(true);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const hasLoadedMatchesOnceRef = useRef<boolean>(false);
  const [activeScorecardMatchData, setActiveScorecardMatchData] = useState<any>(null);
  const [realScorecardData, setRealScorecardData] = useState<any>(null);
  const [isLoadingScorecard, setIsLoadingScorecard] = useState<boolean>(false);

  // Dynamic MongoDB Portal Data (Standings, Performance, Directory)
  const [portalPointsTable, setPortalPointsTable] = useState<any[]>([]);
  const [portalTopBatsmen, setPortalTopBatsmen] = useState<any[]>([]);
  const [portalTopBowlers, setPortalTopBowlers] = useState<any[]>([]);
  const [portalTopFielders, setPortalTopFielders] = useState<any[]>([]);
  const [portalAllPlayers, setPortalAllPlayers] = useState<any[]>([]);

  const loadPortalData = async () => {
    try {
      const res = await ScorerApi.getPortalHome();
      if (res && res.success && res.data) {
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

    // High-speed realtime background poll: every 3 seconds for rapid live match sync
    const matchTimer = setInterval(() => {
      loadPublicMatches(false);
    }, 3000);

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
        onScrollToTop={() => mainScrollRef.current?.scrollTo({ y: 0, animated: true })}
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
                <View style={[styles.oasoOverlineBadge, isMobile && { alignSelf: 'center' }]}>
                  <View style={styles.oasoPulseGoldDot} />
                  <Text style={styles.oasoOverlineText}>CRICKET FEDERATION OF VIRUDHUNAGAR DISTRICT</Text>
                  <View style={styles.oasoAffiliatedBadge}>
                    <Text style={styles.oasoAffiliatedBadgeText}>OFFICIAL UNIT</Text>
                  </View>
                </View>

                {/* Big, Condensed Bold Headline matching OASO Typography */}
                <Text style={[styles.oasoHeroTitle, isMobile && styles.oasoHeroTitleMobile]}>
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

                {/* Subtitle in soft slate */}
                <Text style={[styles.oasoHeroSubtitle, isMobile && styles.oasoHeroSubtitleMobile]}>
                  Governing, developing, and fostering grassroots, collegiate, and competitive cricket across Srivilliputhur, Sivakasi, Rajapalayam, Sattur, Aruppukottai, and Virudhunagar under the official authority of CFVD.
                </Text>

                {/* Highlight Chips Row */}
                <View style={[styles.oasoHighlightsRow, isMobile && { justifyContent: 'center' }]}>
                  <View style={styles.oasoHighlightChip}>
                    <Text style={styles.oasoHighlightEmoji}>🏆</Text>
                    <Text style={styles.oasoHighlightText}>District League 2026-27</Text>
                  </View>
                  <View style={styles.oasoHighlightChip}>
                    <Text style={styles.oasoHighlightEmoji}>⚡</Text>
                    <Text style={styles.oasoHighlightText}>Live Digital Scoring</Text>
                  </View>
                  <View style={styles.oasoHighlightChip}>
                    <Text style={styles.oasoHighlightEmoji}>🏏</Text>
                    <Text style={styles.oasoHighlightText}>12+ Sanctioned Clubs</Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View
                  style={[
                    styles.heroButtonsRow,
                    isMobile && {
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                      alignSelf: 'center',
                      gap: 8,
                      marginBottom: 20,
                      width: '100%',
                    }
                  ]}
                >
                  {/* 1. Match Centre Live */}
                  <TouchableOpacity
                    style={[
                      styles.oasoBtnPrimary,
                      isMobile && {
                        flex: isSmallMobile ? 0 : 1,
                        width: isSmallMobile ? '100%' : undefined,
                        minWidth: isSmallMobile ? '100%' : 130,
                        maxWidth: isSmallMobile ? '100%' : 200,
                        justifyContent: 'center',
                      }
                    ]}
                    onPress={() => scrollToSection('matchCentre')}
                    activeOpacity={0.85}
                  >
                    <Animated.View style={[styles.heroRedDot, { opacity: pulseAnim }]} />
                    <Text style={styles.oasoBtnPrimaryText}>Match Centre Live</Text>
                  </TouchableOpacity>

                  {/* 2. Live Scorecard */}
                  <TouchableOpacity
                    style={[
                      styles.oasoBtnSecondary,
                      isMobile && {
                        flex: isSmallMobile ? 0 : 1,
                        width: isSmallMobile ? '100%' : undefined,
                        minWidth: isSmallMobile ? '100%' : 130,
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
                    <Ionicons name="radio" size={15} color="#0a2540" style={{ marginRight: 6 }} />
                    <Text style={styles.oasoBtnSecondaryText}>Live Scorecard</Text>
                  </TouchableOpacity>

                  {/* 3. Standings & Points Table */}
                  <TouchableOpacity
                    style={[
                      styles.oasoBtnTertiary,
                      isMobile && {
                        flex: isSmallMobile ? 0 : 1,
                        width: isSmallMobile ? '100%' : undefined,
                        minWidth: isSmallMobile ? '100%' : 130,
                        maxWidth: isSmallMobile ? '100%' : 200,
                        justifyContent: 'center',
                      }
                    ]}
                    onPress={() => scrollToSection('pointsTable')}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="trophy-outline" size={15} color="#b45309" style={{ marginRight: 6 }} />
                    <Text style={styles.oasoBtnTertiaryText}>Points Table</Text>
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

                  {/* Stealth Developer Mode Hotspot: Left Ball */}
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => handleSecretBallTap('LEFT')}
                    style={[styles.stealthBallHotspot, { left: '4%', top: '32%', width: '22%', height: '22%' }]}
                    accessibilityRole="none"
                    accessible={false}
                  />

                  {/* Stealth Developer Mode Hotspot: Right Ball */}
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => handleSecretBallTap('RIGHT')}
                    style={[styles.stealthBallHotspot, { right: '4%', top: '31%', width: '22%', height: '22%' }]}
                    accessibilityRole="none"
                    accessible={false}
                  />

                  {/* Stealth Developer Mode Hotspot: Center Ball (near batsman swing) */}
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => handleSecretBallTap('CENTER')}
                    style={[styles.stealthBallHotspot, { left: '58%', top: '16%', width: '24%', height: '24%' }]}
                    accessibilityRole="none"
                    accessible={false}
                  />
                </View>

                <View style={styles.oasoCrestFloatingBadge}>
                  <Ionicons name="shield-checkmark" size={13} color="#059669" style={{ marginRight: 5 }} />
                  <Text style={styles.oasoCrestFloatingText}>Official District Governing Body • CFVD</Text>
                </View>
              </View>

            </View>
            {/* Description */}
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
                    flex: 1,
                    minWidth: 140,
                    maxWidth: 200,
                    justifyContent: 'center',
                  }
                ]}
                onPress={() => scrollToSection('matchCentre')}
                activeOpacity={0.85}
              >
                <Animated.View style={[styles.heroRedDot, { opacity: pulseAnim }]} />
                <Text style={styles.heroBtnNavyText}>Match Centre Live</Text>
              </TouchableOpacity>

              {/* 3. Live Scorecard (Solid Crisp White) */}
              <TouchableOpacity
                style={[
                  styles.heroBtnWhite,
                  isMobile && {
                    flex: 1,
                    minWidth: 140,
                    maxWidth: 200,
                    justifyContent: 'center',
                  }
                ]}
                onPress={() => {
                  const targetMatch = publicMatches.find(m => (m.status || '').toLowerCase() === 'live') || publicMatches[0] || { id: 'M001' };
                  handleOpenScorecard(targetMatch);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.heroBtnWhiteText}>📡 Live Scorecard</Text>
              </TouchableOpacity>

              {/* 4. Watch Intro Video (Professional Preloader Replay) */}
              <TouchableOpacity
                style={[
                  styles.heroBtnWhite,
                  { backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(245, 158, 11, 0.7)' },
                  isMobile && {
                    flex: 1,
                    minWidth: 140,
                    maxWidth: 200,
                    justifyContent: 'center',
                  }
                ]}
                onPress={() => setShowIntroVideo(true)}
                activeOpacity={0.85}
              >
                <Text style={[styles.heroBtnWhiteText, { color: '#fbbf24', fontWeight: '800' }]}>🎬 Watch Intro</Text>
              </TouchableOpacity>
            </View>
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
                if (matchFilter === 'live') return s === 'live' || raw === 'LIVE' || raw === 'INNINGS_BREAK';
                if (matchFilter === 'upcoming') return !isPostponed && (s === 'upcoming' || raw === 'SCHEDULED');
                if (matchFilter === 'postponed') return isPostponed;
                if (matchFilter === 'results') return s === 'completed' || raw === 'COMPLETED' || s === 'cancelled' || raw === 'CANCELLED';
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
                  <View style={[styles.grid2Col, isMobile && { flexDirection: 'column' }]}>
                    {paginatedMatches.map(m => {
                    const s = (m.status || '').toLowerCase();
                    const raw = (m.rawStatus || '').toUpperCase();
                    const isLive = s === 'live' || raw === 'LIVE' || raw === 'INNINGS_BREAK';
                    const isPostponed = s === 'postponed' || raw === 'POSTPONED' || !!m.isPostponed || !!m.postponement?.is_postponed;
                    const isUpcoming = !isPostponed && (s === 'upcoming' || raw === 'SCHEDULED');
                    const isCompleted = s === 'completed' || raw === 'COMPLETED';
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
                            <Text style={[m.scoreA ? styles.teamScoreSingleRow : styles.teamYetToBatSingleRow, isSmallMobile && { fontSize: isTinyMobile ? 13 : 14.5 }]}>
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
                            <Text style={[m.scoreB ? styles.teamScoreSingleRow : styles.teamYetToBatSingleRow, { textAlign: 'right' }, isSmallMobile && { fontSize: isTinyMobile ? 13 : 14.5 }]}>
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

            <View style={[styles.grid2Col, isMobile && { flexDirection: 'column' }]}>
              {/* Tourney 1 */}
              <View style={[styles.tournamentCard, isMobile && { width: '100%', minWidth: '100%', maxWidth: '100%' }, isSmallMobile && { padding: 12 }]}>
                <View style={styles.tBadgeWrap}>
                  <Text style={styles.badgeGoldPill}>Premier Division</Text>
                  <Text style={styles.badgeBluePill}>Multi-Day</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
                  <Ionicons name="shield-checkmark-outline" size={24} color="#0e184e" style={{ marginRight: 8 }} />
                  <Text style={[styles.tourneyTitle, { flex: 1, marginBottom: 0 }]}>Virudhunagar First Division League</Text>
                </View>
                <Text style={styles.tourneySub}>The G. Parthasarathy Rolling Trophy</Text>
                <Text style={styles.tourneyDesc}>
                  The flagship red-ball 3-day competition with 12 affiliated first-tier clubs competing for district
                  supremacy and state trials.
                </Text>
                <View style={styles.tourneySpecs}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="people-outline" size={13} color="#475569" style={{ marginRight: 6 }} />
                    <Text style={styles.tourneySpecItem}>12 Affiliated Clubs</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="calendar-outline" size={13} color="#475569" style={{ marginRight: 6 }} />
                    <Text style={styles.tourneySpecItem}>Oct 2026 - Jan 2027</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="ribbon-outline" size={13} color="#b45309" style={{ marginRight: 6 }} />
                    <Text style={styles.tourneySpecItem}>₹2,50,000 Prize Purse</Text>
                  </View>
                </View>
                <View style={styles.tourneyFooter}>
                  <TouchableOpacity
                    style={styles.btnOutlineGoldSm}
                    onPress={() => {
                      setPointsTableKey('div1');
                      scrollToSection('pointsTable');
                    }}
                  >
                    <Text style={styles.btnOutlineGoldSmText}>View Table</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnPrimarySm}
                    onPress={() => alert('Official 2026-27 Division 1 Fixtures downloaded!')}
                  >
                    <Text style={styles.btnPrimarySmText}>Fixtures PDF</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Tourney 2 */}
              <View style={[styles.tournamentCard, isMobile && { width: '100%', minWidth: '100%', maxWidth: '100%' }, isSmallMobile && { padding: 12 }]}>
                <View style={styles.tBadgeWrap}>
                  <Text style={styles.badgeRedPill}>White Ball</Text>
                  <Text style={styles.badgeGoldPill}>T20 Trophy</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
                  <Ionicons name="flash-outline" size={24} color="#0e184e" style={{ marginRight: 8 }} />
                  <Text style={[styles.tourneyTitle, { flex: 1, marginBottom: 0 }]}>Kamarajar Memorial T20 Trophy</Text>
                </View>
                <Text style={styles.tourneySub}>Virudhunagar District Premier T20 Cup</Text>
                <Text style={styles.tourneyDesc}>
                  Fast-paced night and day T20 cricket featuring taluk teams with colored clothing and white cricket balls.
                </Text>
                <View style={styles.tourneySpecs}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="people-outline" size={13} color="#475569" style={{ marginRight: 6 }} />
                    <Text style={styles.tourneySpecItem}>16 Taluk & Club Teams</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="calendar-outline" size={13} color="#475569" style={{ marginRight: 6 }} />
                    <Text style={styles.tourneySpecItem}>Feb 2027</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="logo-youtube" size={13} color="#dc2626" style={{ marginRight: 6 }} />
                    <Text style={styles.tourneySpecItem}>Live Streamed on YouTube</Text>
                  </View>
                </View>
                <View style={styles.tourneyFooter}>
                  <TouchableOpacity
                    style={styles.btnOutlineGoldSm}
                    onPress={() => {
                      setPointsTableKey('t20');
                      scrollToSection('pointsTable');
                    }}
                  >
                    <Text style={styles.btnOutlineGoldSmText}>Standings</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnPrimarySm}
                    onPress={() => {
                      const targetMatch = publicMatches.find(m => (m.status || '').toLowerCase() === 'completed') || publicMatches[0] || { id: 'M001' };
                      handleOpenScorecard(targetMatch);
                    }}
                  >
                    <Text style={styles.btnPrimarySmText}>Latest Final</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Tourney 3 */}
              <View style={[styles.tournamentCard, isMobile && { width: '100%', minWidth: '100%', maxWidth: '100%' }, isSmallMobile && { padding: 12 }]}>
                <View style={styles.tBadgeWrap}>
                  <Text style={styles.badgeBluePill}>Collegiate</Text>
                  <Text style={styles.badgeGoldPill}>Inter-College Cup</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
                  <Ionicons name="school-outline" size={24} color="#0e184e" style={{ marginRight: 8 }} />
                  <Text style={[styles.tourneyTitle, { flex: 1, marginBottom: 0 }]}>District Inter-College Championship</Text>
                </View>
                <Text style={styles.tourneySub}>Autonomous & Engineering Colleges Shield</Text>
                <Text style={styles.tourneyDesc}>
                  The premier collegiate tournament featuring VHNSN, PSR, ANJAC, Rajus, Kalasalingam University, and
                  SFR College.
                </Text>
                <View style={styles.tourneySpecs}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="people-outline" size={13} color="#475569" style={{ marginRight: 6 }} />
                    <Text style={styles.tourneySpecItem}>10 District Colleges</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="calendar-outline" size={13} color="#475569" style={{ marginRight: 6 }} />
                    <Text style={styles.tourneySpecItem}>Nov 2026</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="ribbon-outline" size={13} color="#b45309" style={{ marginRight: 6 }} />
                    <Text style={styles.tourneySpecItem}>District Selection Gateway</Text>
                  </View>
                </View>
                <View style={styles.tourneyFooter}>
                  <TouchableOpacity
                    style={styles.btnOutlineGoldSm}
                    onPress={() => {
                      setPointsTableKey('college');
                      scrollToSection('pointsTable');
                    }}
                  >
                    <Text style={styles.btnOutlineGoldSmText}>College Points</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnPrimarySm} onPress={() => navigate('Registration')}>
                    <Text style={styles.btnPrimarySmText}>College Entry</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Tourney 4 */}
              <View style={[styles.tournamentCard, isMobile && { width: '100%', minWidth: '100%', maxWidth: '100%' }, isSmallMobile && { padding: 12 }]}>
                <View style={styles.tBadgeWrap}>
                  <Text style={styles.badgeGreenPill}>Under-16 / U-19</Text>
                  <Text style={styles.badgeBluePill}>Junior Talent</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
                  <MaterialCommunityIcons name="town-hall" size={24} color="#0e184e" style={{ marginRight: 8 }} />
                  <Text style={[styles.tourneyTitle, { flex: 1, marginBottom: 0 }]}>Andal Temple Inter-School Cup</Text>
                </View>
                <Text style={styles.tourneySub}>Srivilliputhur & District Schools Shield</Text>
                <Text style={styles.tourneyDesc}>
                  The premier grassroots nursery identifying teenage talent for the district and state age-group trials.
                </Text>
                <View style={styles.tourneySpecs}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="business-outline" size={13} color="#475569" style={{ marginRight: 6 }} />
                    <Text style={styles.tourneySpecItem}>24 District Schools</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="calendar-outline" size={13} color="#475569" style={{ marginRight: 6 }} />
                    <Text style={styles.tourneySpecItem}>Annual Summer Edition</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="ribbon-outline" size={13} color="#b45309" style={{ marginRight: 6 }} />
                    <Text style={styles.tourneySpecItem}>District Academy Scholarships</Text>
                  </View>
                </View>
                <View style={styles.tourneyFooter}>
                  <TouchableOpacity
                    style={styles.btnOutlineGoldSm}
                    onPress={() => {
                      setPointsTableKey('school');
                      scrollToSection('pointsTable');
                    }}
                  >
                    <Text style={styles.btnOutlineGoldSmText}>School Points</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnPrimarySm} onPress={() => navigate('Registration')}>
                    <Text style={styles.btnPrimarySmText}>School Entry</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
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

            {/* Table Selection Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subTabsScroll}>
              {[
                { id: 'div1', label: 'First Division (3-Day)' },
                { id: 'college', label: 'Inter-College Trophy' },
                { id: 't20', label: 'Kamarajar T20 Cup' },
                { id: 'school', label: 'Inter-School Shield' }
              ].map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.switchTabBtn, pointsTableKey === t.id && styles.switchTabBtnActive]}
                  onPress={() => {
                    setPointsTableKey(t.id);
                    setStandingsPage(1);
                  }}
                >
                  <Text style={[styles.switchTabBtnText, pointsTableKey === t.id && styles.switchTabBtnTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Standings Table */}
            {isMobile && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <Ionicons name="swap-horizontal" size={14} color="#b45309" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 11, color: '#b45309', fontWeight: '700', textAlign: 'center' }}>
                  Swipe horizontally to view full table (P, W, L, NR, NRR, PTS, Form)
                </Text>
              </View>
            )}
            {/* Standings Table with Reusable Pagination (8 teams per page) */}
            {(() => {
              const fullStandingsList = portalPointsTable.length > 0 ? portalPointsTable : (TABLE_DATA[pointsTableKey] || []);
              const totalStandingsPages = Math.ceil(fullStandingsList.length / STANDINGS_PER_PAGE) || 1;
              const safeStandingsPage = Math.min(standingsPage, totalStandingsPages);
              const paginatedStandings = fullStandingsList.slice(
                (safeStandingsPage - 1) * STANDINGS_PER_PAGE,
                safeStandingsPage * STANDINGS_PER_PAGE
              );

              return (
                <View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ width: '100%' }}>
                    <View style={styles.tableBox}>
                      <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableTh, { width: 50, textAlign: 'center' }]}>Stand</Text>
                        <Text style={[styles.tableTh, { width: 230 }]}>Team / Club / College</Text>
                        <Text style={[styles.tableTh, { width: 45, textAlign: 'center' }]}>P</Text>
                        <Text style={[styles.tableTh, { width: 45, textAlign: 'center' }]}>W</Text>
                        <Text style={[styles.tableTh, { width: 45, textAlign: 'center' }]}>L</Text>
                        <Text style={[styles.tableTh, { width: 45, textAlign: 'center' }]}>NR</Text>
                        <Text style={[styles.tableTh, { width: 60, textAlign: 'center' }]}>Bonus</Text>
                        <Text style={[styles.tableTh, { width: 75, textAlign: 'center' }]}>NRR</Text>
                        <Text style={[styles.tableTh, { width: 55, textAlign: 'center', color: '#0e184e', fontWeight: '800' }]}>PTS</Text>
                        <Text style={[styles.tableTh, { width: 130, textAlign: 'center' }]}>Recent Form</Text>
                      </View>

                      {paginatedStandings.map((row: any, idx: number) => {
                        const globalIdx = (safeStandingsPage - 1) * STANDINGS_PER_PAGE + idx;
                        const standNum = row.pos || row.stand || (globalIdx + 1);
                        const isGold = standNum === 1;
                        const isSilver = standNum === 2;
                        const isBronze = standNum === 3;
                        const teamTitle = row.teamName || row.name || 'District Club';
                        const teamSubtitle = row.sub || (standNum <= 2 ? 'Qualified for Knockouts' : 'In Contention');
                        const pPlayed = row.played ?? row.p ?? 5;
                        const pWon = row.won ?? row.w ?? 0;
                        const pLost = row.lost ?? row.l ?? 0;
                        const pNr = row.nr ?? row.tied ?? 0;
                        const pBonus = row.bonus ?? 1;
                        const pNrr = row.nrr ?? '+0.000';
                        const pPts = row.points ?? row.pts ?? 0;
                        const pForm = Array.isArray(row.form) ? row.form : ['W', 'L', 'W', 'W'];

                        return (
                          <View key={row.teamId || idx} style={[styles.tableRow, standNum <= 3 && styles.tableRowQualified]}>
                            <View style={{ width: 50, alignItems: 'center' }}>
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
                            <View style={{ width: 230, flexDirection: 'row', alignItems: 'center' }}>
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
                            <Text style={[styles.tableTd, { width: 45, textAlign: 'center' }]}>{pPlayed}</Text>
                            <Text style={[styles.tableTd, { width: 45, textAlign: 'center', fontWeight: '700' }]}>{pWon}</Text>
                            <Text style={[styles.tableTd, { width: 45, textAlign: 'center' }]}>{pLost}</Text>
                            <Text style={[styles.tableTd, { width: 45, textAlign: 'center', color: '#1e293b' }]}>
                              {pNr}
                            </Text>
                            <Text style={[styles.tableTd, { width: 60, textAlign: 'center' }]}>{pBonus}</Text>
                            <Text style={[styles.tableTd, { width: 75, textAlign: 'center' }]}>{pNrr}</Text>
                            <Text style={[styles.tableTd, { width: 55, textAlign: 'center', color: '#0e184e', fontWeight: '800' }]}>
                              {pPts}
                            </Text>
                            <View style={{ width: 130, flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
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

            {/* Performance Tabs */}
            <View style={[styles.perfTabsRow, isSmallMobile && { gap: 6, marginBottom: 14 }]}>
              {[
                { id: 'ratings', short: 'Player Ratings', label: 'Performance Ratings (0–10)', icon: 'star', iconType: 'ionicons' },
                { id: 'batting', short: 'Batting', label: 'Batting Stats (Runs, 50/100s)', icon: 'cricket', iconType: 'mci' },
                { id: 'bowling', short: 'Bowling', label: 'Bowling Stats (Runs, 3w/5w)', icon: 'disc-outline', iconType: 'ionicons' },
                { id: 'fielding', short: 'Fielding', label: 'Fielding Stats (Catches, Stumpings)', icon: 'hand-back-right-outline', iconType: 'mci' }
              ].map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.perfTabBtn,
                    perfTab === t.id && styles.perfTabBtnActive,
                    isSmallMobile && { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 18 }
                  ]}
                  onPress={() => {
                    setPerfTab(t.id as any);
                    setPerfRatingsPage(1);
                    setPerfBattingPage(1);
                    setPerfBowlingPage(1);
                    setPerfFieldingPage(1);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {t.iconType === 'ionicons' ? (
                      <Ionicons
                        name={t.icon as any}
                        size={12}
                        color={perfTab === t.id ? '#ffffff' : '#64748b'}
                        style={{ marginRight: 5 }}
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name={t.icon as any}
                        size={13}
                        color={perfTab === t.id ? '#ffffff' : '#64748b'}
                        style={{ marginRight: 5 }}
                      />
                    )}
                    <Text style={[
                      styles.perfTabBtnText,
                      perfTab === t.id && styles.perfTabBtnTextActive,
                      isSmallMobile && { fontSize: 11 }
                    ]}>
                      {isSmallMobile ? t.short : t.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* If Ratings Tab selected, show Category and Format Filters */}
            {perfTab === 'ratings' && (
              <View style={{ marginBottom: 14, gap: 8 }}>
                {/* Category Selector */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <Text style={{ color: '#d4af37', fontSize: 11, fontWeight: '800', marginRight: 4 }}>CATEGORY:</Text>
                  {[
                    { id: 'overall', label: 'Overall', icon: 'star', iconType: 'ionicons' },
                    { id: 'batting', label: 'Batting', icon: 'cricket', iconType: 'mci' },
                    { id: 'bowling', label: 'Bowling', icon: 'disc-outline', iconType: 'ionicons' }
                  ].map(c => (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.ratingSubFilterBtn,
                        ratingCategory === c.id && styles.ratingSubFilterBtnActive
                      ]}
                      onPress={() => {
                        setRatingCategory(c.id as any);
                        setPerfRatingsPage(1);
                        loadRatingsLeaderboard(c.id as any, ratingFormat);
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {c.iconType === 'ionicons' ? (
                          <Ionicons
                            name={c.icon as any}
                            size={11}
                            color={ratingCategory === c.id ? '#ffffff' : '#94a3b8'}
                            style={{ marginRight: 4 }}
                          />
                        ) : (
                          <MaterialCommunityIcons
                            name={c.icon as any}
                            size={12}
                            color={ratingCategory === c.id ? '#ffffff' : '#94a3b8'}
                            style={{ marginRight: 4 }}
                          />
                        )}
                        <Text style={[
                          styles.ratingSubFilterText,
                          ratingCategory === c.id && styles.ratingSubFilterTextActive
                        ]}>
                          {c.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Format Selector */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '800', marginRight: 4 }}>FORMAT:</Text>
                  {[
                    { id: 'ALL', label: 'All Formats' },
                    { id: 'T20', label: 'T20' },
                    { id: 'ONE_DAY', label: 'One-Day' }
                  ].map(f => (
                    <TouchableOpacity
                      key={f.id}
                      style={[
                        styles.ratingFormatBtn,
                        ratingFormat === f.id && styles.ratingFormatBtnActive
                      ]}
                      onPress={() => {
                        setRatingFormat(f.id as any);
                        setPerfRatingsPage(1);
                        loadRatingsLeaderboard(ratingCategory, f.id as any);
                      }}
                    >
                      <Text style={[
                        styles.ratingFormatText,
                        ratingFormat === f.id && styles.ratingFormatTextActive
                      ]}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Dynamic Performance Table with Reusable Pagination (8 items per page) */}
            {(() => {
              // 1. Ratings Pagination Data
              const fullRatingsList = ratingLeaders.length > 0 ? ratingLeaders : [];
              const totalRatingsPages = Math.ceil(fullRatingsList.length / PERF_PER_PAGE) || 1;
              const safeRatingsPage = Math.min(perfRatingsPage, totalRatingsPages);
              const paginatedRatings = fullRatingsList.slice(
                (safeRatingsPage - 1) * PERF_PER_PAGE,
                safeRatingsPage * PERF_PER_PAGE
              );

              // 2. Batting Pagination Data
              const fullBattingList = portalTopBatsmen.length > 0 ? portalTopBatsmen : PERF_DATA.batting;
              const totalBattingPages = Math.ceil(fullBattingList.length / PERF_PER_PAGE) || 1;
              const safeBattingPage = Math.min(perfBattingPage, totalBattingPages);
              const paginatedBatting = fullBattingList.slice(
                (safeBattingPage - 1) * PERF_PER_PAGE,
                safeBattingPage * PERF_PER_PAGE
              );

              // 3. Bowling Pagination Data
              const fullBowlingList = portalTopBowlers.length > 0 ? portalTopBowlers : PERF_DATA.bowling;
              const totalBowlingPages = Math.ceil(fullBowlingList.length / PERF_PER_PAGE) || 1;
              const safeBowlingPage = Math.min(perfBowlingPage, totalBowlingPages);
              const paginatedBowling = fullBowlingList.slice(
                (safeBowlingPage - 1) * PERF_PER_PAGE,
                safeBowlingPage * PERF_PER_PAGE
              );

              // 4. Fielding Pagination Data
              const fullFieldingList = portalTopFielders.length > 0 ? portalTopFielders : PERF_DATA.fielding;
              const totalFieldingPages = Math.ceil(fullFieldingList.length / PERF_PER_PAGE) || 1;
              const safeFieldingPage = Math.min(perfFieldingPage, totalFieldingPages);
              const paginatedFielding = fullFieldingList.slice(
                (safeFieldingPage - 1) * PERF_PER_PAGE,
                safeFieldingPage * PERF_PER_PAGE
              );

              return (
                <View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ width: '100%' }}>
                    <View style={styles.tableBox}>
                      {perfTab === 'ratings' && (
                        <View>
                          <View style={styles.tableHeaderRow}>
                            <Text style={[styles.tableTh, { width: 50, textAlign: 'center' }]}>Rank</Text>
                            <Text style={[styles.tableTh, { width: 180 }]}>Player / Role</Text>
                            <Text style={[styles.tableTh, { width: 65, textAlign: 'center' }]}>Matches</Text>
                            <Text style={[styles.tableTh, { width: 140, textAlign: 'center' }]}>Rating (0-10)</Text>
                            <Text style={[styles.tableTh, { width: 100, textAlign: 'center' }]}>Confidence</Text>
                            <Text style={[styles.tableTh, { width: 75, textAlign: 'center' }]}>Batting</Text>
                            <Text style={[styles.tableTh, { width: 75, textAlign: 'center' }]}>Bowling</Text>
                            <Text style={[styles.tableTh, { width: 75, textAlign: 'center' }]}>Fielding</Text>
                          </View>
                          {isLoadingLeaders ? (
                            <View style={{ padding: 24, alignItems: 'center' }}>
                              <ActivityIndicator size="small" color="#f59e0b" />
                              <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 8 }}>Computing Player Ratings...</Text>
                            </View>
                          ) : paginatedRatings.map((p: any, idx: number) => {
                            const globalIdx = (safeRatingsPage - 1) * PERF_PER_PAGE + idx;
                            const rank = globalIdx + 1;
                            const score = ratingCategory === 'batting' ? p.battingRating : (ratingCategory === 'bowling' ? p.bowlingRating : p.overallRating);
                            return (
                              <View key={p.playerId || idx} style={styles.tableRow}>
                                <View style={{ width: 50, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
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
                                <View style={{ width: 180 }}>
                                  <Text style={styles.pointsTeamName}>{p.playerName}</Text>
                                  <Text style={styles.playerSubRole}>{p.role || 'Player'}</Text>
                                </View>
                                <Text style={[styles.tableTd, { width: 65, textAlign: 'center', color: '#1e293b' }]}>{p.matchesCount || 1}</Text>
                                <View style={{ width: 140, alignItems: 'center', justifyContent: 'center' }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 9, paddingVertical: 3.5, borderRadius: 6, borderWidth: 1, borderColor: '#fde68a' }}>
                                    <Text style={{ color: '#0e184e', fontWeight: '900', fontSize: 13 }}>
                                      {score !== null && score !== undefined ? `${Number(score).toFixed(1)}` : '—'}
                                    </Text>
                                    {score !== null && score !== undefined && (
                                      <Ionicons name="star" size={11} color="#d97706" style={{ marginLeft: 4 }} />
                                    )}
                                  </View>
                                </View>
                                <View style={{ width: 100, alignItems: 'center', justifyContent: 'center' }}>
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
                                <Text style={[styles.tableTd, { width: 75, textAlign: 'center', fontWeight: '700', color: '#1e293b' }]}>
                                  {p.battingRating !== null && p.battingRating !== undefined ? `${Number(p.battingRating).toFixed(1)}` : '—'}
                                </Text>
                                <Text style={[styles.tableTd, { width: 75, textAlign: 'center', fontWeight: '700', color: '#1e293b' }]}>
                                  {p.bowlingRating !== null && p.bowlingRating !== undefined ? `${Number(p.bowlingRating).toFixed(1)}` : '—'}
                                </Text>
                                <Text style={[styles.tableTd, { width: 75, textAlign: 'center', fontWeight: '700', color: '#1e293b' }]}>
                                  {p.fieldingRating !== null && p.fieldingRating !== undefined ? `${Number(p.fieldingRating).toFixed(1)}` : '—'}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      )}

                      {perfTab === 'batting' && (
                        <View>
                          <View style={styles.tableHeaderRow}>
                            <Text style={[styles.tableTh, { width: 50, textAlign: 'center' }]}>Stand</Text>
                            <Text style={[styles.tableTh, { width: 170 }]}>Player / Role</Text>
                            <Text style={[styles.tableTh, { width: 170 }]}>Team</Text>
                            <Text style={[styles.tableTh, { width: 45, textAlign: 'center' }]}>Mat</Text>
                            <Text style={[styles.tableTh, { width: 45, textAlign: 'center' }]}>Inns</Text>
                            <Text style={[styles.tableTh, { width: 55, textAlign: 'center' }]}>HS</Text>
                            <Text style={[styles.tableTh, { width: 55, textAlign: 'center' }]}>Avg</Text>
                            <Text style={[styles.tableTh, { width: 55, textAlign: 'center' }]}>SR</Text>
                            <Text style={[styles.tableTh, { width: 45, textAlign: 'center' }]}>50s</Text>
                            <Text style={[styles.tableTh, { width: 45, textAlign: 'center' }]}>100s</Text>
                            <Text style={[styles.tableTh, { width: 65, textAlign: 'right', color: '#0e184e', fontWeight: '800' }]}>Runs</Text>
                          </View>
                          {paginatedBatting.map((p: any, idx: number) => {
                            const globalIdx = (safeBattingPage - 1) * PERF_PER_PAGE + idx;
                            return (
                              <View key={p.id || idx} style={styles.tableRow}>
                                <Text style={[styles.tableTd, { width: 50, textAlign: 'center', fontWeight: '700' }]}>
                                  {p.stand || (globalIdx + 1)}
                                </Text>
                                <View style={{ width: 170, flexDirection: 'row', alignItems: 'center' }}>
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
                                <Text style={[styles.tableTd, { width: 170 }]}>{p.team || 'District Club'}</Text>
                                <Text style={[styles.tableTd, { width: 45, textAlign: 'center' }]}>{p.mat || 5}</Text>
                                <Text style={[styles.tableTd, { width: 45, textAlign: 'center' }]}>{p.inns || 5}</Text>
                                <Text style={[styles.tableTd, { width: 55, textAlign: 'center', fontWeight: '600' }]}>{p.hs || (p.runs ? p.runs + '*' : '50*')}</Text>
                                <Text style={[styles.tableTd, { width: 55, textAlign: 'center' }]}>{p.average || p.avg || '35.0'}</Text>
                                <Text style={[styles.tableTd, { width: 55, textAlign: 'center' }]}>{p.strikeRate || p.sr || '135.0'}</Text>
                                <Text style={[styles.tableTd, { width: 45, textAlign: 'center', fontWeight: '600', color: '#1e293b' }]}>
                                  {p.fifties ?? (p.runs >= 100 ? 1 : 0)}
                                </Text>
                                <Text style={[styles.tableTd, { width: 45, textAlign: 'center', fontWeight: '600', color: '#1e293b' }]}>
                                  {p.hundreds ?? 0}
                                </Text>
                                <Text style={[styles.tableTd, { width: 65, textAlign: 'right', color: '#0e184e', fontWeight: '800' }]}>
                                  {p.runs || 0}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      )}

                      {perfTab === 'bowling' && (
                        <View>
                          <View style={styles.tableHeaderRow}>
                            <Text style={[styles.tableTh, { width: 50, textAlign: 'center' }]}>Stand</Text>
                            <Text style={[styles.tableTh, { width: 170 }]}>Bowler / Style</Text>
                            <Text style={[styles.tableTh, { width: 170 }]}>Team</Text>
                            <Text style={[styles.tableTh, { width: 45, textAlign: 'center' }]}>Mat</Text>
                            <Text style={[styles.tableTh, { width: 45, textAlign: 'center' }]}>Inns</Text>
                            <Text style={[styles.tableTh, { width: 55, textAlign: 'center' }]}>Overs</Text>
                            <Text style={[styles.tableTh, { width: 55, textAlign: 'center' }]}>Runs</Text>
                            <Text style={[styles.tableTh, { width: 55, textAlign: 'center' }]}>Econ</Text>
                            <Text style={[styles.tableTh, { width: 50, textAlign: 'center' }]}>3w</Text>
                            <Text style={[styles.tableTh, { width: 50, textAlign: 'center' }]}>5w</Text>
                            <Text style={[styles.tableTh, { width: 65, textAlign: 'right', color: '#0e184e', fontWeight: '800' }]}>Wkts</Text>
                          </View>
                          {paginatedBowling.map((p: any, idx: number) => {
                            const globalIdx = (safeBowlingPage - 1) * PERF_PER_PAGE + idx;
                            return (
                              <View key={p.id || idx} style={styles.tableRow}>
                                <Text style={[styles.tableTd, { width: 50, textAlign: 'center', fontWeight: '700' }]}>
                                  {p.stand || (globalIdx + 1)}
                                </Text>
                                <View style={{ width: 170, flexDirection: 'row', alignItems: 'center' }}>
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
                                <Text style={[styles.tableTd, { width: 170 }]}>{p.team || 'District Club'}</Text>
                                <Text style={[styles.tableTd, { width: 45, textAlign: 'center' }]}>{p.mat || 5}</Text>
                                <Text style={[styles.tableTd, { width: 45, textAlign: 'center' }]}>{p.inns || 5}</Text>
                                <Text style={[styles.tableTd, { width: 55, textAlign: 'center' }]}>{p.overs || '20.0'}</Text>
                                <Text style={[styles.tableTd, { width: 55, textAlign: 'center' }]}>{p.runs_conceded || p.runs || 120}</Text>
                                <Text style={[styles.tableTd, { width: 55, textAlign: 'center' }]}>{p.economy || p.econ || '6.50'}</Text>
                                <Text style={[styles.tableTd, { width: 50, textAlign: 'center', fontWeight: '600', color: '#1e293b' }]}>
                                  {p.threeWkts ?? (p.wickets >= 3 ? 1 : 0)}
                                </Text>
                                <Text style={[styles.tableTd, { width: 50, textAlign: 'center', fontWeight: '600', color: '#1e293b' }]}>
                                  {p.fiveWkts ?? (p.wickets >= 5 ? 1 : 0)}
                                </Text>
                                <Text style={[styles.tableTd, { width: 65, textAlign: 'right', color: '#0e184e', fontWeight: '800' }]}>
                                  {p.wickets || 0}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      )}

                      {perfTab === 'fielding' && (
                        <View>
                          <View style={styles.tableHeaderRow}>
                            <Text style={[styles.tableTh, { width: 50, textAlign: 'center' }]}>Stand</Text>
                            <Text style={[styles.tableTh, { width: 180 }]}>Player / Role</Text>
                            <Text style={[styles.tableTh, { width: 180 }]}>Team</Text>
                            <Text style={[styles.tableTh, { width: 50, textAlign: 'center' }]}>Mat</Text>
                            <Text style={[styles.tableTh, { width: 50, textAlign: 'center' }]}>Inns</Text>
                            <Text style={[styles.tableTh, { width: 60, textAlign: 'center' }]}>Catches</Text>
                            <Text style={[styles.tableTh, { width: 70, textAlign: 'center' }]}>Stumpings</Text>
                            <Text style={[styles.tableTh, { width: 70, textAlign: 'center' }]}>Run Outs</Text>
                            <Text style={[styles.tableTh, { width: 70, textAlign: 'right', color: '#0e184e', fontWeight: '800' }]}>Total</Text>
                          </View>
                          {paginatedFielding.map((p: any, idx: number) => {
                            const globalIdx = (safeFieldingPage - 1) * PERF_PER_PAGE + idx;
                            return (
                              <View key={p.id || idx} style={styles.tableRow}>
                                <Text style={[styles.tableTd, { width: 50, textAlign: 'center', fontWeight: '700' }]}>
                                  {p.stand || (globalIdx + 1)}
                                </Text>
                                <View style={{ width: 180, flexDirection: 'row', alignItems: 'center' }}>
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
                                <Text style={[styles.tableTd, { width: 180 }]}>{p.team || 'District Club'}</Text>
                                <Text style={[styles.tableTd, { width: 50, textAlign: 'center' }]}>{p.mat || 5}</Text>
                                <Text style={[styles.tableTd, { width: 50, textAlign: 'center' }]}>{p.inns || 5}</Text>
                                <Text style={[styles.tableTd, { width: 60, textAlign: 'center', fontWeight: '600', color: '#1e293b' }]}>
                                  {p.catches || 0}
                                </Text>
                                <Text style={[styles.tableTd, { width: 70, textAlign: 'center', fontWeight: '600', color: '#1e293b' }]}>
                                  {p.stumpings || 0}
                                </Text>
                                <Text style={[styles.tableTd, { width: 70, textAlign: 'center', fontWeight: '600', color: '#1e293b' }]}>
                                  {p.runOuts || 0}
                                </Text>
                                <Text style={[styles.tableTd, { width: 70, textAlign: 'right', color: '#0e184e', fontWeight: '800' }]}>
                                  {p.dismissals || (p.catches || 0) + (p.stumpings || 0)}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  </ScrollView>

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

            {/* Search Bar */}
            <View style={styles.playerSearchBar}>
              <Ionicons name="search" size={16} color="#64748b" style={{ marginRight: 6 }} />
              <TextInput
                style={styles.playerSearchInput}
                placeholder="Search milestone player by name, record (100, 50, 5W), team, or taluk..."
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
                  <Ionicons name="close-circle" size={18} color="#94a3b8" style={{ paddingHorizontal: 4 }} />
                </TouchableOpacity>
              )}
            </View>

            {/* Category Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subTabsScroll}>
              {[
                { id: 'all', label: `All Records (${filteredPlayers.length})`, icon: 'trophy-outline', iconColor: '#b45309' },
                { id: 'century', label: 'Centuries (100+)', icon: 'ribbon-outline', iconColor: '#b45309' },
                { id: 'fifty', label: 'Half-Centuries (50+)', icon: 'medal-outline', iconColor: '#c2410c' },
                { id: 'bowler', label: 'Bowling Hauls (3W+ / 5W)', icon: 'disc-outline', iconColor: '#7e22ce' },
                { id: 'womens', label: "Women's Milestones", icon: 'female-outline', iconColor: '#db2777' }
              ].map(f => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.playerPillBtn, playerFilter === f.id && styles.playerPillBtnActive]}
                  onPress={() => {
                    setPlayerFilter(f.id);
                    setMilestonePage(1);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={f.icon as any}
                    size={13}
                    color={playerFilter === f.id ? '#ffffff' : f.iconColor}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.playerPillBtnText, playerFilter === f.id && styles.playerPillBtnTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

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
                  <View style={[styles.grid2Col, isMobile && { flexDirection: 'column' }]}>
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
        <View style={styles.section}>
          <View style={[styles.container, containerResponsiveStyle]}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTagBadge}>
                <Ionicons name="mail-outline" size={15} color="#0e184e" style={{ marginRight: 6 }} />
                <Text style={styles.sectionTagBadgeText}>SECRETARIAT</Text>
              </View>
              <Text style={[styles.sectionTitle, isSmallMobile && { fontSize: 20 }]}>Get in Touch with CFVD</Text>
            </View>

            <View style={[styles.grid2Col, isMobile && { flexDirection: 'column' }]}>
              <View style={[styles.contactInfoCard, isMobile && { width: '100%', minWidth: '100%', maxWidth: '100%' }, isSmallMobile && { padding: 12 }]}>
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
                  <Text style={[styles.contactLine, { marginBottom: 0 }]}>info@cfvd-cricket.org / secretary@cfvd-cricket.org</Text>
                </View>
              </View>

              <View style={[styles.contactFormCard, isMobile && { width: '100%', minWidth: '100%', maxWidth: '100%' }, isSmallMobile && { padding: 12 }]}>
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
                    setActiveOpTab('admin');
                    navigate('Admin');
                  }}
                >
                  <Text style={styles.footerLink}>› Admin Setup (Manage College)</Text>
                </TouchableOpacity>
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
                <TouchableOpacity onPress={() => navigate('Login', { initialRole: 'ADMIN' })}>
                  <Text style={styles.footerLink}>› Administrator Portal</Text>
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
    </View>
  );
}

// ─── STYLESHEET ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#f6f2e9'
  },
  mainScroll: {
    flex: 1
  },
  mainScrollContent: {
    paddingBottom: 0 // No extra space below footer
  },
  container: {
    width: '100%',
    maxWidth: 1320, // Bootstrap 5 container-xxl max-width
    alignSelf: 'center',
    paddingHorizontal: 16
  },

  // Atmospheric Background with Deep Soft Blur
  bgStadiumImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.16,
    transform: [{ scale: 1.12 }],
    ...(Platform.OS === 'web'
      ? ({
          filter: 'blur(18px)',
          WebkitFilter: 'blur(18px)',
        } as any)
      : {})
  },
  bgTopGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 380
  },
  bgWatermarkContainer: {
    position: 'absolute',
    top: '48%',
    left: '50%',
    transform: [{ translateX: -260 }, { translateY: -260 }],
    width: 520,
    height: 520,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.38
  },
  bgWatermarkImage: {
    width: '100%',
    height: '100%'
  },

  // Header / Navbar
  header: {
    backgroundColor: '#040a1b',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.25)',
    zIndex: 100,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(12px)' } : {})
  },
  headerInner: {
    width: '100%',
    paddingHorizontal: Platform.OS === 'web' ? 32 : 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  brandLogo: {
    width: 48,
    height: 48,
    marginRight: 10
  },
  brandTextBlock: {
    justifyContent: 'center'
  },
  brandTitleMain: {
    color: '#f5c43d',
    fontSize: 14.5,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  brandTitleSub: {
    color: '#c0d1eb',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4
  },
  brandBadgeRow: {
    marginTop: 2
  },
  brandAffiliation: {
    color: '#fed966',
    fontSize: 9.5,
    fontWeight: '600'
  },
  desktopNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14
  },
  navHomePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.42)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6.5
  },
  navHomePillText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '800'
  },
  navLinkDropdown: {
    paddingVertical: 6,
    paddingHorizontal: 8
  },
  navDropdownText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '600'
  },
  navLink: {
    paddingVertical: 6,
    paddingHorizontal: 8
  },
  navLinkActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#f5c43d'
  },
  navLinkText: {
    color: '#e6edf8',
    fontSize: 13.5,
    fontWeight: '600'
  },
  navLinkTextActive: {
    color: '#f5c43d',
    fontSize: 13.5,
    fontWeight: '700'
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  headerLoginBtn: {
    backgroundColor: '#f5c43d',
    paddingHorizontal: 18,
    paddingVertical: 7.5,
    borderRadius: 6
  },
  headerLoginBtnText: {
    color: '#081225',
    fontSize: 13,
    fontWeight: '900'
  },
  headerUserPill: {
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
    borderColor: '#d4af37',
    borderWidth: 1.2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  headerUserNameText: {
    color: '#f5c43d',
    fontSize: 12.5,
    fontWeight: '800',
    maxWidth: 140
  },
  headerUserRoleBadge: {
    backgroundColor: '#d4af37',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  headerUserRoleBadgeText: {
    color: '#081225',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.3
  },
  headerLogoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  headerLogoutBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700'
  },
  mobileUserCard: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderColor: 'rgba(212, 175, 55, 0.35)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10
  },
  mobileUserCardGreeting: {
    color: '#ffffff',
    fontSize: 13.5,
    marginBottom: 4
  },
  mobileUserCardRole: {
    color: '#94a3b8',
    fontSize: 11.5,
    fontWeight: '600',
    marginBottom: 10
  },
  mobileUserActionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  mobilePortalBtn: {
    backgroundColor: '#d4af37',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    flex: 1,
    alignItems: 'center'
  },
  mobilePortalBtnText: {
    color: '#081225',
    fontSize: 12,
    fontWeight: '800'
  },
  mobileLogoutBtn: {
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  mobileLogoutBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700'
  },
  hamburgerBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)'
  },
  hamburgerIcon: {
    color: '#f5c43d',
    fontSize: 18,
    fontWeight: '900'
  },
  mobileNavDrawer: {
    backgroundColor: '#07132c',
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  mobileNavItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)'
  },
  mobileNavText: {
    color: '#e6edf8',
    fontSize: 14,
    fontWeight: '600'
  },

  // Live Ticker Bar
  liveTickerBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(184, 134, 11, 0.25)',
    paddingVertical: 2,
    zIndex: 90
  },
  liveTickerInner: {
    width: '100%',
    maxWidth: 1540,
    alignSelf: 'center',
    paddingHorizontal: Platform.OS === 'web' ? 32 : 16,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  liveTickerBadge: {
    backgroundColor: '#881337',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12
  },
  liveTickerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f87171',
    marginRight: 5
  },
  liveTickerBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  liveTickerScrollView: {
    flex: 1
  },
  liveTickerScrollContent: {
    alignItems: 'center',
    paddingRight: 16
  },
  liveTickerText: {
    color: '#1e293b',
    fontSize: 12,
    fontWeight: '500'
  },
  tickerMatchHighlight: {
    fontWeight: '700',
    color: '#0f172a'
  },
  tickerPrefix: {
    fontWeight: '800',
    color: '#854d0e'
  },
  tickerStarPrefix: {
    fontWeight: '800',
    color: '#b45309'
  },
  tickerLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginLeft: 16
  },
  tickerLinkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 4
  },
  tickerLinkText: {
    color: '#334155',
    fontSize: 11.5,
    fontWeight: '600'
  },

  // Prestigious Athletic Light Hero Section
  oasoHeroSection: {
    position: 'relative',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    paddingVertical: Platform.OS === 'web' ? 56 : 40,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  heroDecoRing1: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 600,
    height: 600,
    borderRadius: 300,
    backgroundColor: 'rgba(217, 119, 6, 0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(217, 119, 6, 0.08)',
  },
  heroDecoRing2: {
    position: 'absolute',
    bottom: -150,
    left: -100,
    width: 500,
    height: 500,
    borderRadius: 250,
    backgroundColor: 'rgba(10, 37, 64, 0.03)',
    borderWidth: 1.5,
    borderColor: 'rgba(10, 37, 64, 0.06)',
  },
  oasoHeroContainer: {
    zIndex: 2,
  },
  oasoHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  oasoHeroRowMobile: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  oasoHeroContentCol: {
    flex: 1.25,
    maxWidth: Platform.OS === 'web' ? 760 : '100%',
    paddingRight: Platform.OS === 'web' ? 24 : 0,
    alignItems: 'flex-start',
  },
  oasoHeroContentColMobile: {
    alignItems: 'center',
    paddingRight: 0,
    maxWidth: '100%',
  },
  oasoOverlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1.2,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 16,
    gap: 6,
  },
  oasoPulseGoldDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#d97706',
  },
  oasoOverlineText: {
    color: '#92400e',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  oasoAffiliatedBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  oasoAffiliatedBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#b45309',
    letterSpacing: 0.5,
  },
  oasoHeroTitle: {
    color: '#0a2540',
    fontSize: Platform.OS === 'web' ? 62 : 38,
    fontWeight: '900',
    letterSpacing: 1.2,
    lineHeight: Platform.OS === 'web' ? 66 : 42,
    textTransform: 'uppercase',
    marginBottom: 12,
    textAlign: 'left',
  },
  oasoHeroTitleMobile: {
    fontSize: 32,
    lineHeight: 36,
    textAlign: 'center',
  },
  oasoHeroTagline: {
    color: '#b45309',
    fontSize: Platform.OS === 'web' ? 13.5 : 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  oasoHeroSubtitle: {
    color: '#475569',
    fontSize: 14.5,
    lineHeight: 23,
    fontWeight: '400',
    marginBottom: 18,
    maxWidth: 620,
    textAlign: 'left',
  },
  oasoHeroSubtitleMobile: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
  },
  oasoHighlightsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 22,
  },
  oasoHighlightChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  oasoHighlightEmoji: {
    fontSize: 12,
    marginRight: 6,
  },
  oasoHighlightText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  oasoBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a2540',
    borderColor: '#f59e0b',
    borderWidth: 1.5,
    paddingHorizontal: 22,
    height: 48,
    borderRadius: 8,
    shadowColor: '#0a2540',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  oasoBtnPrimaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  oasoBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#0a2540',
    borderWidth: 1.5,
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  oasoBtnSecondaryText: {
    color: '#0a2540',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  oasoBtnTertiary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1.2,
    paddingHorizontal: 18,
    height: 48,
    borderRadius: 8,
  },
  oasoBtnTertiaryText: {
    color: '#92400e',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  oasoHeroCrestCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 12,
  },
  oasoHeroCrestColMobile: {
    width: '100%',
    maxWidth: '100%',
    marginTop: 24,
    paddingVertical: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  oasoCrestAuraRing: {
    position: 'absolute',
    width: 440,
    height: 440,
    borderRadius: 220,
    backgroundColor: 'rgba(217, 119, 6, 0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(217, 119, 6, 0.15)',
  },
  oasoCrestAuraRingInner: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(10, 37, 64, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(10, 37, 64, 0.08)',
  },
  oasoCrestImage: {
    width: '100%',
    maxWidth: 460,
    height: 460,
    maxHeight: 460,
    ...(Platform.OS === 'web' ? ({ filter: 'drop-shadow(0 14px 28px rgba(10, 37, 64, 0.12))' } as any) : {}),
  },
  oasoCrestFloatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: -20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  oasoCrestFloatingText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
  },
  stealthCrestWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  stealthBallHotspot: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: 'transparent',
    zIndex: 50,
    ...(Platform.OS === 'web' ? ({ cursor: 'default', outline: 'none', WebkitTapHighlightColor: 'transparent' } as any) : {}),
  },

  // Hero Section (Prestigious Athletic Federation Atmosphere)
  heroSection: {
    position: 'relative',
    paddingTop: Platform.OS === 'web' ? 48 : 36,
    paddingBottom: Platform.OS === 'web' ? 52 : 44,
    minHeight: Platform.OS === 'web' ? 540 : undefined,
    justifyContent: 'center',
    overflow: 'hidden'
  },
  heroWatermarkContainer: {
    position: 'absolute',
    top: 24,
    bottom: 24,
    right: 36,
    width: 470,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.95
  },
  heroWatermarkImage: {
    width: '100%',
    height: '100%'
  },
  emblemRingOuter: {
    position: 'absolute',
    width: '96%',
    height: '96%',
    borderRadius: 300,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.45)',
    borderStyle: 'dashed'
  },
  emblemRingInner: {
    position: 'absolute',
    width: '80%',
    height: '80%',
    borderRadius: 300,
    borderWidth: 1.2,
    borderColor: 'rgba(212, 175, 55, 0.3)'
  },
  heroContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 860 : '100%',
    paddingLeft: Platform.OS === 'web' ? 32 : 16,
    paddingRight: 20,
    zIndex: 2
  },
  heroPretitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    alignSelf: 'flex-start'
  },
  heroBadgeDistrict: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
    borderColor: '#b4820a',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14
  },
  heroBadgeDistrictText: {
    color: '#78350f',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4
  },
  heroBadgeCouncil: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.12)',
    borderColor: 'rgba(15, 23, 42, 0.25)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14
  },
  heroBadgeCouncilText: {
    color: '#0f172a',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4
  },
  heroBadgeHeritage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(217, 119, 6, 0.18)',
    borderColor: 'rgba(217, 119, 6, 0.35)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14
  },
  heroBadgeHeritageText: {
    color: '#92400e',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4
  },
  heroHeadingLine1: {
    color: '#07132c',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 2,
    textAlign: 'left',
    alignSelf: 'flex-start'
  },
  heroHeadingLine2: {
    color: '#f5c43d',
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 10,
    textAlign: 'left',
    alignSelf: 'flex-start',
    textShadowColor: 'rgba(180, 130, 20, 0.35)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3
  },

  // Motto Badge
  ribbonWrapper: {
    position: 'relative',
    marginTop: 4,
    marginBottom: 16,
    alignSelf: 'flex-start'
  },
  ribbonBody: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6',
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 7,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  ribbonTailLeft: {
    display: 'none'
  },
  ribbonTailRight: {
    display: 'none'
  },
  ribbonStar: {
    color: '#b45309',
    fontSize: 12,
    marginHorizontal: 4
  },
  ribbonText: {
    color: '#0e184e',
    fontSize: 13,
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: 0.2,
    marginHorizontal: 4
  },

  heroDescription: {
    color: '#1a2a48',
    fontSize: 14.5,
    lineHeight: 22,
    maxWidth: 680,
    marginBottom: 24,
    fontWeight: '500',
    textAlign: 'left',
    alignSelf: 'flex-start'
  },

  // 3 Hero Action Buttons
  heroButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 34,
    alignSelf: 'flex-start'
  },
  heroBtnNavy: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0e184e', // Deep Navy (TNCA / CFVD official) - NO BLUE!
    borderColor: '#0e184e',
    borderWidth: 1,
    paddingHorizontal: 20,
    height: 46,
    borderRadius: 6,
    shadowColor: '#0e184e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    elevation: 3
  },
  heroRedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dc3545', // Danger
    marginRight: 8
  },
  heroBtnNavyText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700'
  },
  heroBtnGold: {
    backgroundColor: '#ffc107', // Warning
    borderColor: '#ffc107',
    borderWidth: 1,
    paddingHorizontal: 20,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6
  },
  heroBtnGoldText: {
    color: '#212529',
    fontSize: 14,
    fontWeight: '700'
  },
  heroBtnWhite: {
    backgroundColor: '#ffffff',
    borderColor: '#0e184e', // Deep Navy border - NO BLUE!
    borderWidth: 1.5,
    paddingHorizontal: 20,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    elevation: 1
  },
  heroBtnWhiteText: {
    color: '#0e184e', // Deep Navy text - NO BLUE!
    fontSize: 14,
    fontWeight: '700'
  },

  // Legacy Hero Fallbacks
  goldPill: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderColor: '#d4af37',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  goldPillText: {
    color: '#f5c43d',
    fontSize: 10.5,
    fontWeight: '800'
  },
  cfvdTagLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  cfvdTagLightText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '700'
  },
  heritagePill: {
    backgroundColor: 'rgba(158, 24, 43, 0.2)',
    borderColor: 'rgba(200, 30, 55, 0.5)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  heritagePillText: {
    color: '#fed966',
    fontSize: 10.5,
    fontWeight: '800'
  },
  heroTitlePrefix: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 0.5
  },
  heroTitleMain: {
    color: '#f5c43d',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 2
  },
  mottoRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
    borderColor: '#d4af37',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 14,
    marginBottom: 16
  },
  mottoRibbonStar: {
    color: '#fed966',
    fontSize: 12,
    marginHorizontal: 6
  },
  mottoRibbonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: 0.3
  },
  heroCtaGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 30
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    borderColor: '#d97706',
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    elevation: 3
  },
  liveDotPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    marginRight: 8
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  },
  btnOutlineGold: {
    backgroundColor: '#ffffff',
    borderColor: '#f59e0b',
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8
  },
  btnOutlineGoldText: {
    color: '#b45309',
    fontSize: 14,
    fontWeight: '800'
  },
  btnGlass: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderColor: '#fde68a',
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8
  },
  btnGlassText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700'
  },

  // Metrics Bar
  metricsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    width: '100%',
    maxWidth: 780,
    alignSelf: 'flex-start',
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3
  },
  metricItem: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  metricVal: {
    color: '#b45309',
    fontSize: 22,
    fontWeight: '900'
  },
  metricLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2
  },
  metricDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#fde68a'
  },

  // Quick Strip
  quickStrip: {
    paddingVertical: 16,
    backgroundColor: '#fffbeb',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#fde68a'
  },
  quickStripGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  quickCard: {
    flex: 1,
    minWidth: 240,
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  quickCardHighlight: {
    borderColor: '#f59e0b',
    backgroundColor: '#fffdf5'
  },
  quickIcon: {
    fontSize: 22,
    marginRight: 10
  },
  quickDetails: {
    flex: 1
  },
  quickTitle: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800'
  },
  quickDesc: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2
  },
  quickArrow: {
    color: '#d97706',
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 6
  },

  // Section Generic
  section: {
    paddingVertical: 36,
    ...(Platform.OS === 'web' ? ({ scrollMarginTop: 95 } as any) : {})
  },
  sectionHead: {
    alignItems: 'center',
    marginBottom: 26
  },
  sectionTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  sectionTagBadgeText: {
    color: '#0e184e', // Deep Navy - NO BLUE!
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.4
  },
  sectionSubtitle: {
    color: '#475569',
    fontSize: 13.5,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 760,
    lineHeight: 20
  },

  // Operations Hub
  opTabsScroll: {
    marginBottom: 16
  },
  opTabBtn: {
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
    marginRight: 8
  },
  opTabBtnActive: {
    backgroundColor: '#0e184e', // Deep Navy - NO BLUE!
    borderColor: '#0e184e'
  },
  opTabBtnText: {
    color: '#334155',
    fontSize: 12.5,
    fontWeight: '600'
  },
  opTabBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  cardBox: {
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6', // Bootstrap 5 border
    borderWidth: 1,
    borderRadius: 6,        // Bootstrap 5 card radius
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  cardBoxHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16
  },
  cardBoxTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4
  },
  cardBoxSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2
  },
  cardBoxActionRow: {
    flexDirection: 'row',
    gap: 8
  },
  btnGoldSm: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    elevation: 2
  },
  btnGoldSmText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800'
  },
  btnPrimarySm: {
    backgroundColor: '#f59e0b',
    borderColor: '#d97706',
    borderWidth: 1.5,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    elevation: 2
  },
  btnPrimarySmText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '800'
  },
  subTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16
  },
  subTabBtn: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  subTabBtnActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b'
  },
  subTabBtnText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700'
  },
  subTabBtnTextActive: {
    color: '#b45309'
  },
  subSectionTitle: {
    color: '#b45309',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
    marginTop: 6
  },

  // Grids
  grid2Col: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  grid3Col: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },

  // College Card
  collegeCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1
  },
  collegeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  collegeName: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800'
  },
  collegeTaluk: {
    color: '#d97706',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1
  },
  collegeMeta: {
    color: '#475569',
    fontSize: 11.5,
    marginVertical: 1.5
  },
  collegeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  collegeTeamsBadge: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    borderWidth: 1,
    color: '#b45309',
    fontSize: 10.5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '700'
  },
  verifiedText: {
    color: '#15803d',
    fontSize: 11.5,
    fontWeight: '800'
  },

  // Forms
  formContainer: {
    marginTop: 16,
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6', // Bootstrap 5 border
    borderWidth: 1,
    borderRadius: 6,
    padding: 16
  },
  formHeaderTitle: {
    color: '#212529',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12
  },
  formField: {
    marginBottom: 12
  },
  formLabel: {
    color: '#495057',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4
  },
  formInput: {
    backgroundColor: '#ffffff',
    borderColor: '#ced4da', // Bootstrap 5 form-control border
    borderWidth: 1,
    borderRadius: 4,        // Bootstrap 5 0.25rem
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#212529',
    fontSize: 13
  },
  btnGold: {
    backgroundColor: '#0e184e', // Deep Navy - NO BLUE!
    borderColor: '#0e184e',
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 6
  },
  btnGoldText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },

  // Approval Box
  approvalBox: {
    backgroundColor: '#fffdf5',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16
  },
  approvalHeading: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800'
  },
  approvalDesc: {
    color: '#475569',
    fontSize: 12,
    marginTop: 4
  },

  // Institutions & Teams
  instCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  instName: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800'
  },
  instType: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2
  },
  statusPillActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
    borderWidth: 1,
    color: '#15803d',
    fontSize: 10.5,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  teamMgmtCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  teamMgmtName: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800'
  },
  teamMgmtSub: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 1
  },
  teamMgmtDivision: {
    color: '#d97706',
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 2
  },

  // Tournaments Step 1
  formatCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10
  },
  formatCard: {
    flex: 1,
    minWidth: 130,
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  formatCardActive: {
    borderColor: '#f59e0b',
    backgroundColor: '#fef3c7'
  },
  formatCardTitle: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
    textAlign: 'center'
  },
  formatCardDesc: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center'
  },

  // Live Scoring
  scoringOversBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#fffdf5',
    borderColor: '#fde68a',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 14
  },
  scoringOversLabel: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '800'
  },
  oversPillBtn: {
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14
  },
  oversPillBtnActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#d97706'
  },
  oversPillBtnText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700'
  },
  oversPillBtnTextActive: {
    color: '#ffffff',
    fontWeight: '900'
  },
  activeOversNotice: {
    color: '#15803d',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 'auto'
  },
  tossBox: {
    backgroundColor: '#fffdf5',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16
  },
  tossBoxTitle: {
    color: '#b45309',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8
  },
  tossControlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 6
  },
  smallChoiceBtn: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4
  },
  smallChoiceBtnActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b'
  },
  smallChoiceBtnText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700'
  },
  tossResultCard: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#fef3c7',
    borderRadius: 6
  },
  tossResultText: {
    color: '#92400e',
    fontSize: 11.5,
    fontWeight: '800'
  },
  rosterCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  rosterTeamTitle: {
    color: '#b45309',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6
  },
  rosterPlayerText: {
    color: '#475569',
    fontSize: 11.5,
    lineHeight: 18
  },

  // Match Centre Filter Tabs (Bootstrap 5 Nav Pills)
  filterTabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
    justifyContent: 'center'
  },
  filterTabBtn: {
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6', // Bootstrap 5 border
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,        // Bootstrap 5 btn radius
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  filterTabBtnActive: {
    backgroundColor: '#0e184e', // Deep Navy - NO BLUE!
    borderColor: '#0e184e',
    shadowColor: '#0e184e',
    shadowOpacity: 0.25
  },
  filterTabBtnText: {
    color: '#334155',
    fontSize: 12.5,
    fontWeight: '600'
  },
  filterTabBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },

  // Match Cards (Bootstrap 5 Card Architecture)
  matchCard: {
    flex: 1,
    minWidth: 290,
    maxWidth: 620,
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6',
    borderWidth: 1,
    borderTopWidth: 4,
    borderTopColor: '#6c757d',
    borderRadius: 6,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    justifyContent: 'space-between',
    marginBottom: 8
  },
  matchCardLive: {
    borderTopColor: '#dc3545', // Danger
    borderColor: '#f1aeb5',
    shadowColor: '#dc3545',
    shadowOpacity: 0.12
  },
  matchCardUpcoming: {
    borderTopColor: '#0e184e', // Deep Navy - NO BLUE!
    borderColor: '#cbd5e1',
    shadowColor: '#0e184e',
    shadowOpacity: 0.1
  },
  matchCardResult: {
    borderTopColor: '#198754', // Bootstrap 5 success
    borderColor: '#a3cfbb',
    shadowColor: '#198754',
    shadowOpacity: 0.1
  },
  matchCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6'
  },
  liveIndicatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8d7da', // Bootstrap 5 danger-subtle
    borderColor: '#f1aeb5',
    borderWidth: 1,
    borderRadius: 50,           // Bootstrap 5 rounded-pill
    paddingHorizontal: 9,
    paddingVertical: 3.5
  },
  pulseRedDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ef4444',
    marginRight: 5
  },
  liveIndicatorText: {
    color: '#dc2626',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  upcomingIndicatorPill: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3.5
  },
  upcomingIndicatorText: {
    color: '#1d4ed8',
    fontSize: 10.5,
    fontWeight: '800'
  },
  resultIndicatorPill: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3.5
  },
  resultIndicatorText: {
    color: '#059669',
    fontSize: 10.5,
    fontWeight: '800'
  },
  matchTournament: {
    color: '#0f172a',
    fontSize: 12.5,
    fontWeight: '800',
    flex: 1,
    textAlign: 'left'
  },
  formatBadgeT20: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  formatBadgeT20Text: {
    color: '#b45309',
    fontSize: 10,
    fontWeight: '800'
  },
  formatBadgeMulti: {
    backgroundColor: '#f3e8ff',
    borderColor: '#e9d5ff',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  formatBadgeMultiText: {
    color: '#7e22ce',
    fontSize: 10,
    fontWeight: '800'
  },
  formatBadgeOneDay: {
    backgroundColor: '#dbeafe',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  formatBadgeOneDayText: {
    color: '#1d4ed8',
    fontSize: 10,
    fontWeight: '800'
  },
  formatBadgeText: {
    color: '#334155',
    fontSize: 10,
    fontWeight: '800'
  },

  cardHeaderLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1
  },
  cardHeaderRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  topRightRainPill: {
    backgroundColor: '#e0f2fe',
    borderColor: '#38bdf8',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2
  },
  topRightRainPillText: {
    color: '#0284c7',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  topRightBreakPill: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  topRightBreakPillText: {
    color: '#b45309',
    fontSize: 10,
    fontWeight: '900'
  },
  matchTeamsSingleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginVertical: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1
  },
  teamColLeft: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    minWidth: 110
  },
  teamColRight: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 110
  },
  teamCrestNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    maxWidth: '100%'
  },
  teamNameTextSingleRow: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
    flexShrink: 1
  },
  teamScoreSingleRow: {
    fontSize: 16.5,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.3
  },
  teamYetToBatSingleRow: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    fontStyle: 'italic'
  },
  iplVsCenterBox: {
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iplVsCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderColor: '#d97706',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 3
  },
  iplVsCircleText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#fbbf24',
    fontStyle: 'italic',
    letterSpacing: 1.2
  },
  cardLogisticsBottomBar: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
    marginBottom: 10
  },
  logisticsChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 5,
    flexWrap: 'wrap'
  },
  logisticsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  logisticsEmoji: {
    fontSize: 12
  },
  logisticsValueText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700'
  },
  logisticsVenueChip: {
    cursor: Platform.OS === 'web' ? ('pointer' as any) : undefined,
  },
  venueTextLink: {
    color: '#0284c7',
    textDecorationLine: 'underline',
    fontWeight: '700'
  },
  venueMapIcon: {
    color: '#0284c7',
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 1
  },
  logisticsOfficialsBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  logisticsOfficialsCleanText: {
    color: '#64748b',
    fontSize: 10.5,
    fontWeight: '600'
  },

  // Logistics Box: Spaced out, clean white/slate card
  logisticsBox: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12
  },
  logisticsMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4
  },
  logisticsMetaItem: {
    color: '#334155',
    fontSize: 11.5,
    fontWeight: '700'
  },
  logisticsDot: {
    color: '#94a3b8',
    fontSize: 12
  },
  logisticsVenueText: {
    color: '#475569',
    fontSize: 11.5,
    fontWeight: '600',
    marginBottom: 4
  },
  logisticsOfficialsText: {
    color: '#64748b',
    fontSize: 10.5,
    lineHeight: 15
  },
  logisticsItem: {
    color: '#475569',
    fontSize: 10.5,
    lineHeight: 16
  },

  // Teams Box
  matchTeamsBox: {
    marginBottom: 10,
    gap: 4
  },
  iplVsDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    position: 'relative'
  },
  iplVsLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#cbd5e1'
  },
  iplVsBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 11,
    paddingVertical: 2.5,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#d97706',
    marginHorizontal: 8,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 3
  },
  iplVsText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#fbbf24',
    letterSpacing: 1.5,
    fontStyle: 'italic'
  },
  liveBreakIndicatorPill: {
    backgroundColor: '#d97706',
    borderColor: '#b45309'
  },
  cardBreakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 6,
    marginBottom: 2
  },
  cardBreakEmoji: {
    fontSize: 13,
    marginRight: 6
  },
  cardBreakText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
    flexShrink: 1
  },
  cardBreakSubText: {
    fontSize: 10,
    color: '#78350f',
    marginTop: 1
  },
  cardRainBanner: {
    backgroundColor: '#e0f2fe',
    borderColor: '#7dd3fc',
    borderWidth: 1.5
  },
  cardRainText: {
    color: '#0369a1',
    fontWeight: '800'
  },
  liveRainIndicatorPill: {
    backgroundColor: '#0284c7'
  },
  scorecardSummaryBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginTop: 8
  },
  scorecardSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  scorecardSummaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569'
  },
  scorecardSummaryVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155'
  },
  scorecardTableSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f2452',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  scorecardFowWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  scorecardFowChip: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  scorecardFowScore: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309'
  },
  scorecardFowBatter: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 1
  },
  openFullScorecardCta: {
    backgroundColor: '#005960',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 12
  },
  openFullScorecardCtaText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800'
  },
  homeOversBar: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between'
  },
  homeOversLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 2
  },
  homeOversValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a'
  },
  homeSuspendedBanner: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    marginTop: 8
  },
  homeSuspendedText: {
    color: '#9f1239',
    fontSize: 10.5,
    fontWeight: '700'
  },
  homeActiveBowlerPill: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  homeActiveBowlerPillText: {
    color: '#15803d',
    fontSize: 10,
    fontWeight: '800'
  },
  homeBowlingBadge: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1
  },
  homeBowlingBadgeText: {
    color: '#15803d',
    fontSize: 9,
    fontWeight: '800'
  },
  homeSuspendedPill: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginTop: 2
  },
  homeSuspendedPillText: {
    color: '#b91c1c',
    fontSize: 9,
    fontWeight: '800'
  },
  homeSubPill: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginTop: 2
  },
  homeSubPillText: {
    color: '#b45309',
    fontSize: 9,
    fontWeight: '700'
  },
  homeQuotaPill: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginTop: 2
  },
  homeQuotaPillText: {
    color: '#b45309',
    fontSize: 9,
    fontWeight: '800'
  },
  matchTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  battingNowRow: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd'
  },
  winnerRow: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0'
  },
  teamMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8
  },
  teamMiniCrest: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2
  },
  teamMiniCrestText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900'
  },
  teamNameText: {
    color: '#0f172a',
    fontSize: 13.5,
    fontWeight: '700',
    flexShrink: 1
  },
  battingIcon: {
    fontSize: 14,
    marginLeft: 6
  },
  winnerTrophyIcon: {
    fontSize: 15,
    marginLeft: 6
  },
  teamScores: {
    alignItems: 'flex-end',
    flexShrink: 0
  },
  runsText: {
    color: '#0f172a',
    fontSize: 15.5,
    fontWeight: '900'
  },
  oversText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600'
  },
  yetToBatText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },

  // Status Note Banners
  statusNoteLiveBox: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12
  },
  statusNoteLiveText: {
    color: '#be123c',
    fontSize: 12,
    fontWeight: '800'
  },
  statusNoteUpcomingBox: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12
  },
  statusNoteUpcomingText: {
    color: '#0369a1',
    fontSize: 12,
    fontWeight: '700'
  },
  statusNoteResultBox: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12
  },
  statusNoteResultText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '800'
  },
  matchStatusNote: {
    color: '#475569',
    fontSize: 11,
    marginBottom: 10,
    fontStyle: 'italic'
  },
  matchStatusNoteGold: {
    color: '#b45309',
    fontSize: 11,
    marginBottom: 10,
    fontWeight: '700'
  },

  // Action Buttons
  btnActionPrimary: {
    backgroundColor: '#f59e0b',
    borderColor: '#d97706',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2
  },
  btnActionPrimaryText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.2
  },
  btnActionSecondary: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnActionSecondaryText: {
    color: '#1e293b',
    fontSize: 12.5,
    fontWeight: '800'
  },
  btnActionSuccess: {
    backgroundColor: '#065f46',
    borderColor: '#047857',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#065f46',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2
  },
  btnActionSuccessText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.2
  },
  btnOutlineGoldBlock: {
    backgroundColor: '#ffffff',
    borderColor: '#f59e0b',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center'
  },
  btnOutlineGoldBlockText: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '800'
  },

  // Official Match Centre Button (Deep Navy - NO BLUE!)
  tncaMatchCentreCardBtn: {
    backgroundColor: '#0e184e', // Deep Navy
    borderColor: '#0e184e',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#0e184e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  tncaMatchCentreCardBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  // TNCA Media Sub-Nav Row (Image 1 Style: [ News ] [ Photos ] ── See More >)
  tncaMediaSubNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 6,
  },
  tncaMediaPillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tncaPillYellowActive: {
    backgroundColor: '#f5c43d',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 7,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  tncaPillYellowText: {
    color: '#0e184e',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  tncaPillWhiteInactive: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 7,
  },
  tncaPillWhiteText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '800',
  },
  tncaSeeMoreLink: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  tncaSeeMoreText: {
    color: '#0e184e',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  tncaMediaGoldDivider: {
    width: '100%',
    height: 2,
    backgroundColor: '#f5c43d',
    marginBottom: 16,
    borderRadius: 1,
  },

  // Tournaments Section (Bootstrap 5 Cards & Badges)
  tournamentCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6', // Bootstrap 5 border
    borderWidth: 1,
    borderTopWidth: 4,
    borderTopColor: '#0e184e', // Deep Navy - NO BLUE!
    borderRadius: 6,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  tBadgeWrap: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8
  },
  badgeGoldPill: {
    backgroundColor: '#fff3cd', // Bootstrap 5 warning subtle
    borderColor: '#ffe69c',
    borderWidth: 1,
    color: '#664d03',
    fontSize: 10.5,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 50 // rounded-pill
  },
  badgeBluePill: {
    backgroundColor: '#cfe2ff', // Bootstrap 5 primary subtle
    borderColor: '#9ec5fe',
    borderWidth: 1,
    color: '#0a58ca',
    fontSize: 10.5,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 50
  },
  badgeRedPill: {
    backgroundColor: '#f8d7da', // Bootstrap 5 danger subtle
    borderColor: '#f1aeb5',
    borderWidth: 1,
    color: '#842029',
    fontSize: 10.5,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 50
  },
  badgeGreenPill: {
    backgroundColor: '#d1e7dd', // Bootstrap 5 success subtle
    borderColor: '#a3cfbb',
    borderWidth: 1,
    color: '#0f5132',
    fontSize: 10.5,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 50
  },
  tourneyIcon: {
    fontSize: 28,
    marginBottom: 4
  },
  tourneyTitle: {
    color: '#0f172a',
    fontSize: 16.5,
    fontWeight: '800'
  },
  tourneySub: {
    color: '#d97706',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6
  },
  tourneyDesc: {
    color: '#475569',
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 10
  },
  tourneySpecs: {
    marginBottom: 12,
    backgroundColor: '#fffdf5',
    borderColor: '#fef3c7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8
  },
  tourneySpecItem: {
    color: '#334155',
    fontSize: 11.5,
    fontWeight: '600',
    marginVertical: 1.5
  },
  tourneyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginTop: 'auto',
    paddingTop: 10
  },
  btnOutlineGoldSm: {
    backgroundColor: '#ffffff',
    borderColor: '#f59e0b',
    borderWidth: 1.5,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnOutlineGoldSmText: {
    color: '#b45309',
    fontSize: 11.5,
    fontWeight: '800'
  },

  // Points & Performance Tables (Bootstrap 5 Tables)
  subTabsScroll: {
    marginBottom: 12
  },
  switchTabBtn: {
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6', // Bootstrap 5 border
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 4,        // Bootstrap 5 0.25rem
    marginRight: 8
  },
  switchTabBtnActive: {
    backgroundColor: '#0e184e', // Deep Navy - NO BLUE!
    borderColor: '#0e184e'
  },
  switchTabBtnText: {
    color: '#495057',           // Bootstrap 5 gray-700
    fontSize: 12,
    fontWeight: '600'
  },
  switchTabBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  tableBox: {
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6',     // Bootstrap 5 table border
    borderWidth: 1,
    borderRadius: 6,
    padding: 0,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#dee2e6',
    backgroundColor: '#f8f9fa'   // Bootstrap 5 table header background
  },
  tableTh: {
    color: '#495057',            // Bootstrap 5 gray-700
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    paddingHorizontal: 4
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
    backgroundColor: '#ffffff'
  },
  tableRowQualified: {
    backgroundColor: '#f8f9fa'   // Bootstrap 5 table hover
  },
  tableTd: {
    color: '#212529',            // Bootstrap 5 bodyColor
    fontSize: 11.5,
    paddingHorizontal: 4
  },
  pointsTeamName: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800'
  },
  pointsTeamSub: {
    color: '#d97706',
    fontSize: 9.5
  },
  playerSubRole: {
    color: '#d97706',
    fontSize: 9.5
  },
  rankBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  rankBadgeGold: {
    backgroundColor: '#f59e0b'
  },
  rankBadgeSilver: {
    backgroundColor: '#94a3b8'
  },
  rankBadgeBronze: {
    backgroundColor: '#d97706'
  },
  rankBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900'
  },
  formPill: {
    width: 20,
    height: 18,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center'
  },
  formPillW: {
    backgroundColor: '#15803d'
  },
  formPillL: {
    backgroundColor: '#dc2626'
  },
  formPillNR: {
    backgroundColor: '#d97706'
  },
  formPillText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900'
  },

  // Performance Records (Bootstrap 5 Tabs)
  perfTabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12
  },
  perfTabBtn: {
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6', // Bootstrap 5 border
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 4         // Bootstrap 5 0.25rem
  },
  perfTabBtnActive: {
    backgroundColor: '#0e184e', // Deep Navy - NO BLUE!
    borderColor: '#0e184e'
  },
  perfTabBtnText: {
    color: '#495057',           // Bootstrap 5 gray-700
    fontSize: 12,
    fontWeight: '600'
  },
  perfTabBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },

  // Ratings Leaderboard Sub-Filters
  ratingSubFilterBtn: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6
  },
  ratingSubFilterBtnActive: {
    backgroundColor: '#0e184e',
    borderColor: '#d4af37',
    borderWidth: 1.5
  },
  ratingSubFilterText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700'
  },
  ratingSubFilterTextActive: {
    color: '#fde047',
    fontWeight: '800'
  },
  ratingFormatBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },
  ratingFormatBtnActive: {
    backgroundColor: '#1e3a8a',
    borderColor: '#3b82f6'
  },
  ratingFormatText: {
    color: '#475569',
    fontSize: 10.5,
    fontWeight: '600'
  },
  ratingFormatTextActive: {
    color: '#ffffff',
    fontWeight: '800'
  },

  // District Players
  playerSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 10 : 8,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  playerSearchInput: {
    flex: 1,
    color: '#0f172a',
    fontSize: 13.5,
    paddingHorizontal: 8,
    outlineStyle: 'none' as any
  },
  playerPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  playerPillBtnActive: {
    backgroundColor: '#0e184e', // Deep Navy - NO BLUE!
    borderColor: '#0e184e'
  },
  playerPillBtnText: {
    color: '#495057',
    fontSize: 12,
    fontWeight: '600'
  },
  playerPillBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  specialRecordCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderTopWidth: 3,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 14
  },
  recordBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 12
  },
  recordBadgeLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  recordOfficialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  recordOfficialCheck: {
    color: '#15803d',
    fontSize: 10.5,
    fontWeight: '700'
  },
  recordProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  recordAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2
  },
  recordAvatarText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  recordPlayerName: {
    color: '#0e184e',
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.2
  },
  recordTeamText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2
  },
  recordRoleBadgePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    marginTop: 4
  },
  recordRoleBadgeText: {
    color: '#475569',
    fontSize: 10.5,
    fontWeight: '700'
  },
  recordRoleBadge: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2
  },
  recordTagPill: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  recordTagPillText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '800'
  },
  recordPerfBox: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12
  },
  recordPerfMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  recordPerfScore: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.3
  },
  recordPerfBalls: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748b',
    marginLeft: 4
  },
  recordSubMetricPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4
  },
  recordSubMetricText: {
    fontSize: 11,
    fontWeight: '800'
  },
  recordPerfMain: {
    fontSize: 15,
    fontWeight: '900',
    flex: 1,
    marginRight: 6
  },
  recordPerfSub: {
    color: '#64748b',
    fontSize: 11.5,
    fontWeight: '700'
  },
  recordMatchVsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2
  },
  recordMatchVs: {
    color: '#475569',
    fontSize: 11.5,
    fontWeight: '500',
    flex: 1
  },
  recordCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopColor: '#f1f5f9',
    borderTopWidth: 1
  },
  recordCardFooterText: {
    color: '#0e184e',
    fontSize: 11.5,
    fontWeight: '700'
  },
  recordCardFooterArrow: {
    fontSize: 12,
    fontWeight: '800'
  },
  playerCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderTopWidth: 4,
    borderTopColor: '#f59e0b',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3
  },
  playerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  playerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center'
  },
  playerAvatarText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900'
  },
  playerIdTag: {
    color: '#64748b',
    fontSize: 10.5,
    fontWeight: '700'
  },
  playerVerifiedTag: {
    color: '#15803d',
    fontSize: 10.5,
    fontWeight: '700'
  },
  playerName: {
    color: '#0f172a',
    fontSize: 14.5,
    fontWeight: '800'
  },
  playerCategoryBadge: {
    color: '#b45309',
    fontSize: 10.5,
    fontWeight: '700'
  },
  playerCardMeta: {
    marginBottom: 8
  },
  playerMetaText: {
    color: '#475569',
    fontSize: 11.5,
    marginVertical: 1.5
  },
  playerStatsSnippet: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fffdf5',
    borderColor: '#fef3c7',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    marginBottom: 8
  },
  pssCol: {
    alignItems: 'center'
  },
  pssVal: {
    color: '#b45309',
    fontSize: 13,
    fontWeight: '900'
  },
  pssLabel: {
    color: '#64748b',
    fontSize: 9.5
  },
  playerBioSnippet: {
    color: '#475569',
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 10
  },

  // About Section
  aboutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24
  },
  aboutTextCol: {
    flex: 1.4,
    minWidth: 300
  },
  aboutLead: {
    color: '#0f172a',
    fontSize: 14.5,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 8
  },
  aboutBody: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16
  },
  valuesList: {
    gap: 10
  },
  valueItem: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  valueTitle: {
    color: '#b45309',
    fontSize: 13,
    fontWeight: '800'
  },
  valueDesc: {
    color: '#475569',
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 2
  },
  aboutCrestCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3
  },
  aboutCrestImg: {
    width: 110,
    height: 110,
    marginBottom: 12
  },
  aboutCrestTitle: {
    color: '#0f172a',
    fontSize: 12.5,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5
  },
  aboutCrestMotto: {
    color: '#b45309',
    fontSize: 11.5,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 4
  },
  aboutCrestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 6
  },
  aboutCrestBadgeText: {
    color: '#92400e',
    fontSize: 10,
    fontWeight: '800'
  },
  officeBearersBox: {
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2
  },
  bearersHeading: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
    marginBottom: 14
  },
  bearersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    width: '100%'
  },
  bearerCard: {
    flex: 1,
    minWidth: 170,
    backgroundColor: '#fffdf5',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center'
  },
  bearerCardHighlight: {
    borderColor: '#f59e0b',
    backgroundColor: '#fef3c7'
  },
  bearerName: {
    color: '#0f172a',
    fontSize: 12.5,
    fontWeight: '800',
    textAlign: 'center'
  },
  bearerRole: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2
  },
  bearerTenure: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 1,
    textAlign: 'center'
  },

  // Grounds & Facilities (Bootstrap 5 Cards)
  groundCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6', // Bootstrap 5 border
    borderWidth: 1,
    borderTopWidth: 4,
    borderTopColor: '#0e184e', // Deep Navy - NO BLUE!
    borderRadius: 6,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  groundImg: {
    width: '100%',
    height: 150
  },
  groundBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#15803d', // Cricket Emerald Turf Green - NO BLUE!
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  groundBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900'
  },
  groundInfo: {
    padding: 12
  },
  groundTitle: {
    color: '#0f172a',
    fontSize: 14.5,
    fontWeight: '800'
  },
  groundLoc: {
    color: '#d97706',
    fontSize: 11,
    fontWeight: '700',
    marginVertical: 3
  },
  groundDesc: {
    color: '#475569',
    fontSize: 11.5,
    lineHeight: 17,
    marginBottom: 8
  },
  groundFacilitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  facilityPill: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 4
  },

  // Academy
  academyBanner: {
    borderRadius: 14,
    borderColor: '#fde68a',
    borderWidth: 1.5,
    backgroundColor: '#ffffff',
    padding: 20,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3
  },
  academyTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4
  },
  academyDesc: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 16
  },
  academyFeaturesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14
  },
  afItem: {
    flex: 1,
    minWidth: 240,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffdf5',
    borderColor: '#fef3c7',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8
  },
  afTitle: {
    color: '#b45309',
    fontSize: 12.5,
    fontWeight: '800'
  },
  afDesc: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 1
  },

  // News
  newsCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderTopWidth: 4,
    borderTopColor: '#f59e0b',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3
  },
  newsImg: {
    width: '100%',
    height: 140
  },
  newsBody: {
    padding: 12
  },
  newsDate: {
    color: '#64748b',
    fontSize: 10
  },
  newsCatBadge: {
    color: '#d97706',
    fontSize: 10.5,
    fontWeight: '700',
    marginVertical: 2
  },
  newsTitle: {
    color: '#0f172a',
    fontSize: 13.5,
    fontWeight: '800',
    lineHeight: 18,
    marginBottom: 6
  },
  newsExcerpt: {
    color: '#475569',
    fontSize: 11.5,
    lineHeight: 17,
    marginBottom: 10
  },

  // Gallery
  galleryItem: {
    flex: 1,
    minWidth: 260,
    height: 180,
    borderRadius: 10,
    overflow: 'hidden',
    borderColor: '#fde68a',
    borderWidth: 1
  },
  galleryImg: {
    width: '100%',
    height: '100%'
  },
  galleryOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderTopWidth: 1,
    borderTopColor: '#fde68a',
    padding: 8,
    alignItems: 'center'
  },
  galleryOverlayText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800'
  },

  // Contact (Bootstrap 5 Cards)
  contactInfoCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6', // Bootstrap 5 border
    borderWidth: 1,
    borderRadius: 6,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  contactFormCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6', // Bootstrap 5 border
    borderWidth: 1,
    borderRadius: 6,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  contactCardTitle: {
    color: '#0e184e',       // Deep Navy - NO BLUE!
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12
  },
  contactLine: {
    color: '#334155',
    fontSize: 12.5,
    lineHeight: 20,
    marginBottom: 8
  },

  // Footer
  footer: {
    backgroundColor: '#01040d',
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.3)',
    paddingTop: 40,
    paddingBottom: 28
  },
  footerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
    marginBottom: 28
  },
  footerColBrand: {
    flex: 1.5,
    minWidth: 280
  },
  footerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  footerLogo: {
    width: 52,
    height: 52
  },
  footerBrandTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  footerMotto: {
    color: '#f5c43d',
    fontSize: 13.5,
    fontStyle: 'italic',
    marginTop: 2
  },
  footerDesc: {
    color: '#9bb0cf',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 14
  },
  footerAffilBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center'
  },
  footerAffilText: {
    color: '#fed966',
    fontSize: 12.5,
    fontWeight: '700'
  },
  footerCol: {
    flex: 1,
    minWidth: 160
  },
  footerColHeading: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.3)',
    paddingBottom: 6
  },
  footerLink: {
    color: '#9bb0cf',
    fontSize: 14.5,
    marginVertical: 5,
    fontWeight: '500'
  },
  footerBottom: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 20,
    alignItems: 'center'
  },
  copyrightText: {
    color: '#62799c',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8
  },
  legalLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  legalLink: {
    color: '#9bb0cf',
    fontSize: 13,
    fontWeight: '500'
  },
  legalDot: {
    color: '#62799c',
    fontSize: 13
  },

  // Modals Generic
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 18, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  scorecardModalBox: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 20,
    width: '95%',
    maxWidth: 720,
    maxHeight: '90%',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8
  },
  playerModalBox: {
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1.5,
    borderTopWidth: 4,
    borderTopColor: '#f59e0b',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 580,
    maxHeight: '90%',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8
  },
  newsModalBox: {
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1.5,
    borderTopWidth: 4,
    borderTopColor: '#f59e0b',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 540,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14
  },
  modalCloseCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 2
  },
  modalSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2
  },
  modalCloseBtn: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '800'
  },
  badgeGoldText: {
    color: '#b45309',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6
  },
  badgeBlueText: {
    color: '#1d4ed8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6
  },
  badgeRedText: {
    color: '#dc2626',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6
  },

  // Scorecard Modal Internal
  scorecardTossBanner: {
    backgroundColor: '#fefce8',
    borderColor: '#fef08a',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14
  },
  scorecardTossText: {
    color: '#854d0e',
    fontSize: 12,
    fontWeight: '700'
  },
  inningsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  inningsTitle: {
    color: '#0f172a',
    fontSize: 13.5,
    fontWeight: '800'
  },
  inningsScoreBadge: {
    backgroundColor: '#f59e0b',
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  tableScrollWrapper: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 4
  },
  scoreTable: {
    backgroundColor: '#ffffff',
    minWidth: 470
  },
  scoreTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 8
  },
  scoreTh: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '800'
  },
  scoreTableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
    alignItems: 'center'
  },
  scoreTableRowAlt: {
    backgroundColor: '#f8fafc'
  },
  scoreTd: {
    color: '#1e293b',
    fontSize: 11.5
  },

  // Player Profile Modal Internal
  playerModalBioBox: {
    backgroundColor: '#fffdf5',
    borderColor: '#fef3c7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12
  },
  playerModalBio: {
    color: '#334155',
    fontSize: 12,
    lineHeight: 18
  },
  playerModalStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fffdf5',
    borderColor: '#fef3c7',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    marginBottom: 12
  },
  pmsItem: {
    alignItems: 'center'
  },
  pmsVal: {
    color: '#b45309',
    fontSize: 16,
    fontWeight: '900'
  },
  pmsLabel: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2
  },
  playerModalMetaBox: {
    backgroundColor: '#fffdf5',
    borderColor: '#fef3c7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16
  },

  // Lightbox
  lightboxBox: {
    maxWidth: 700,
    width: '95%',
    alignItems: 'center'
  },
  lightboxCloseBtn: {
    alignSelf: 'flex-end',
    padding: 8
  },
  lightboxImg: {
    width: '100%',
    height: 380,
    borderRadius: 8
  },
  lightboxCaption: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center'
  },

  // News Modal Internal
  newsModalContent: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16
  }
});
