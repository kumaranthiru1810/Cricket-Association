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
  StatusBar,
  ActivityIndicator,
  Alert,
  useWindowDimensions
} from 'react-native';
import { io } from 'socket.io-client';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppNavigation } from '../src/navigation/AppNavigator';
import { ScorerApi, PlayerApi, getCurrentUser, setCurrentUser, setAuthToken, logoutAndClearAllSessions, SOCKET_URL } from '../src/services/api';
import { MatchHighlightsBanner } from '../src/components/common/MatchHighlightsBanner';
import UmpireSignalOverlay, { UmpireSignalEvent, UmpireSignalsGalleryModal, UmpireSignalType } from '../src/components/common/UmpireSignalOverlay';
import Header from '../src/layouts/Header';
import BroadcastLiveBallAction from '../src/components/common/BroadcastLiveBallAction';

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

  useEffect(() => {
    // 1. Check local session cache
    const cached = getCurrentUser();
    if (cached) setSessionUser(cached);

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

  // Dynamic Responsive Breakpoints (Updates automatically on all devices & orientations)
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isMobile = windowWidth < 768;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;
  const isDesktop = windowWidth >= 1024;
  const isSmallMobile = windowWidth < 480;
  const isTinyMobile = windowWidth < 380;

  const containerResponsiveStyle = {
    paddingHorizontal: isTinyMobile ? 10 : (isSmallMobile ? 12 : (isMobile ? 16 : 32))
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
  const mainScrollRef = useRef<ScrollView>(null);
  const [sectionPositions, setSectionPositions] = useState<Record<string, number>>({});

  const scrollToSection = (secName: string) => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const targetId = secName === 'matchCentre' ? 'cfvd-section-match-centre' : (secName === 'pointsTable' ? 'cfvd-section-points-table' : secName);
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setMobileNavOpen(false);
        return;
      }
    }
    const y = sectionPositions[secName] || 0;
    mainScrollRef.current?.scrollTo({ y: Math.max(0, y - 20), animated: true });
    setMobileNavOpen(false);
  };

  // State: Mobile Nav Menu
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // State: Match Centre Filter
  const [matchFilter, setMatchFilter] = useState<'all' | 'live' | 'upcoming' | 'postponed' | 'results'>('all');

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
              return {
                ...m,
                scoreA: payload.scoreA !== undefined ? payload.scoreA : m.scoreA,
                scoreB: payload.scoreB !== undefined ? payload.scoreB : m.scoreB,
                currentInnings: payload.currentInnings || m.currentInnings,
                status: payload.status || m.status,
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

    // Silent background poll every 30 seconds for matches, 60s for portal
    const matchTimer = setInterval(() => {
      loadPublicMatches(false);
    }, 30000);

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
    '🪙 Virudhunagar Strikers won the toss and elected to BOWL FIRST (20.0 Overs).'
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
    Alert.alert('Success', `✓ ${newCol.name} successfully registered in Federation Admin Setup!`);
  };

  const handleRecordToss = () => {
    const text = `🪙 ${tossWinner} won the toss and elected to ${tossDecision.toUpperCase()} FIRST (${selectedOvers}.0 Overs).`;
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
      <StatusBar barStyle="light-content" backgroundColor="#040a1b" />

      {/* FIXED BRIGHT ATMOSPHERIC BACKGROUND */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image source={IMG_STADIUM} style={styles.bgStadiumImage} resizeMode="cover" />
        <LinearGradient
          colors={['rgba(246, 242, 233, 0.94)', 'rgba(252, 249, 244, 0.97)', '#f6f2e9']}
          style={StyleSheet.absoluteFill}
        />
        {/* Top Glow Bloom */}
        <LinearGradient
          colors={['rgba(254, 217, 102, 0.22)', 'rgba(212, 175, 55, 0.08)', 'transparent']}
          style={styles.bgTopGlow}
        />
        {/* Watermark Crest */}
        <View style={styles.bgWatermarkContainer}>
          <Image source={IMG_WATERMARK} style={styles.bgWatermarkImage} resizeMode="contain" />
        </View>
      </View>

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
            scrollToSection('matchCentre');
          } else if (category === 'results') {
            setMatchFilter('results');
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
                          {`🔴 LIVE: ${liveM.teamA} ${liveM.scoreA || ''} vs ${liveM.teamB}${liveM.scoreB && liveM.scoreB !== 'Yet to bat' ? ' ' + liveM.scoreB : ' (Yet to bat)'} — ${liveM.current_innings_number === 2 ? '2nd Innings in Progress' : '1st Innings in Progress'}`}
                        </Text>
                        {'   •   '}
                      </>
                    ) : null}
                    {compM.map((cm, i) => (
                      <React.Fragment key={cm.id || i}>
                        <Text style={styles.tickerPrefix}>🏁 {cm.teamA} vs {cm.teamB}:</Text>
                        <Text style={styles.tickerMatchHighlight}>{` ${cm.scoreA || ''} vs ${cm.scoreB || ''}`}</Text>
                        {` — ${cm.result || cm.result_summary || 'Match Concluded'}${i < compM.length - 1 ? '   •   ' : ''}`}
                      </React.Fragment>
                    ))}
                    {publicMatches.length === 0 && (
                      <Text style={styles.tickerPrefix}>🏆 Cricket Federation of Virudhunagar District • Official Match Centre</Text>
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
                <Text style={styles.tickerLinkText}>📜 League By-Laws</Text>
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
                <Text style={styles.tickerLinkText}>⚖️ Sports Integrity</Text>
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
        {/* ─── 1. HERO SECTION (LUMINOUS GOLDEN ATMOSPHERE) ──────────────── */}
        <View style={styles.heroSection}>
          {/* Luminous Light Gold/Cream Radiant Atmosphere */}
          <LinearGradient
            colors={['#bcc5cf', '#ccd6e0', '#fbedbe', '#fef3c7', '#fde047']}
            start={{ x: 0, y: 0.1 }}
            end={{ x: 1, y: 0.9 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Large Gold Watermark Crest positioned center-right */}
          <View
            style={[
              styles.heroWatermarkContainer,
              isMobile && {
                right: 'auto',
                left: '50%',
                top: '50%',
                width: Math.min(windowWidth * 0.88, 360),
                height: Math.min(windowWidth * 0.88, 360),
                transform: [
                  { translateX: -Math.min(windowWidth * 0.88, 360) / 2 },
                  { translateY: -Math.min(windowWidth * 0.88, 360) / 2 }
                ],
                opacity: 0.38
              }
            ]}
            pointerEvents="none"
          >
            {/* Outer and Inner Halo Rings */}
            <View style={styles.emblemRingOuter} />
            <View style={styles.emblemRingInner} />
            <Image
              source={IMG_LOGO}
              style={styles.heroWatermarkImage}
              resizeMode="contain"
            />
          </View>

          {/* Mobile Overlay Layer directly above the Logo Crest for high text contrast */}
          {isMobile && (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  zIndex: 1,
                  backgroundColor: 'rgba(254, 252, 246, 0.78)',
                  ...(Platform.OS === 'web'
                    ? ({
                        backdropFilter: 'blur(3px)',
                        WebkitBackdropFilter: 'blur(3px)',
                      } as any)
                    : {}),
                }
              ]}
              pointerEvents="none"
            >
              <LinearGradient
                colors={[
                  'rgba(241, 245, 249, 0.82)',
                  'rgba(254, 252, 246, 0.86)',
                  'rgba(254, 243, 199, 0.80)',
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
          )}

          <View
            style={[
              styles.container,
              styles.heroContainer,
              isMobile && {
                alignItems: 'center',
                alignSelf: 'center',
                paddingLeft: 16,
                paddingRight: 16,
                maxWidth: '100%',
              }
            ]}
          >
            {/* Pretitle badges row */}
            <View
              style={[
                styles.heroPretitleRow,
                isMobile && {
                  justifyContent: 'center',
                  alignSelf: 'center',
                  gap: 6,
                  marginBottom: 12,
                }
              ]}
            >
              <View style={[styles.heroBadgeDistrict, isMobile && { paddingHorizontal: 9, paddingVertical: 4 }]}>
                <Text style={[styles.heroBadgeDistrictText, isMobile && { fontSize: 10 }]}>🛡️ OFFICIAL DISTRICT BODY</Text>
              </View>
              <View style={[styles.heroBadgeCouncil, isMobile && { paddingHorizontal: 9, paddingVertical: 4 }]}>
                <Text style={[styles.heroBadgeCouncilText, isMobile && { fontSize: 10 }]}>⚫ CFVD GOVERNING COUNCIL</Text>
              </View>
              <View style={[styles.heroBadgeHeritage, isMobile && { paddingHorizontal: 9, paddingVertical: 4 }]}>
                <Text style={[styles.heroBadgeHeritageText, isMobile && { fontSize: 10 }]}>🛕 SRIVILLIPUTHUR HERITAGE</Text>
              </View>
            </View>

            {/* Main Title */}
            <Text
              style={[
                styles.heroHeadingLine1,
                isMobile && {
                  textAlign: 'center',
                  alignSelf: 'center',
                  fontSize: windowWidth < 380 ? 20 : 23,
                  letterSpacing: 0.5,
                  color: '#07132c',
                  marginBottom: 4,
                }
              ]}
            >
              CRICKET FEDERATION OF
            </Text>
            <Text
              style={[
                styles.heroHeadingLine2,
                isMobile && {
                  textAlign: 'center',
                  alignSelf: 'center',
                  fontSize: windowWidth < 380 ? 24 : (windowWidth < 440 ? 27 : 32),
                  letterSpacing: 0.8,
                  color: '#b45309',
                  textShadowColor: 'rgba(0, 0, 0, 0.12)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                  marginBottom: 12,
                }
              ]}
            >
              VIRUDHUNAGAR DISTRICT
            </Text>

            {/* 3D Folded Golden Motto Ribbon Banner */}
            <View
              style={[
                styles.ribbonWrapper,
                isMobile && {
                  alignSelf: 'center',
                  marginBottom: 16,
                }
              ]}
            >
              <View style={styles.ribbonTailLeft} />
              <LinearGradient
                colors={['#fff4c4', '#f5ce55', '#d4af37', '#996515']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.ribbonBody,
                  isMobile && {
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }
                ]}
              >
                <Text style={styles.ribbonStar}>★</Text>
                <Text
                  style={[
                    styles.ribbonText,
                    isMobile && {
                      fontSize: windowWidth < 380 ? 11.5 : 12.5,
                      marginHorizontal: 4,
                    }
                  ]}
                >
                  Enjoy the game and chase your dreams
                </Text>
                <Text style={styles.ribbonStar}>★</Text>
              </LinearGradient>
              <View style={styles.ribbonTailRight} />
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
                <Text style={styles.sectionTagBadgeText}>🏏 OFFICIAL MATCH CENTRE</Text>
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
                    { id: 'all', short: `All (${publicMatches.length})`, full: `All Matches (${publicMatches.length})` },
                    { id: 'live', short: `🔴 Live (${liveCount})`, full: `🔴 Live Matches (${liveCount})` },
                    { id: 'upcoming', short: `📅 Upcoming (${upcomingCount})`, full: `📅 Upcoming Fixtures (${upcomingCount})` },
                    { id: 'postponed', short: `⏸️ Postponed (${postponedCount})`, full: `⏸️ Postponed (${postponedCount})` },
                    { id: 'results', short: `🏁 Results (${resultsCount})`, full: `🏁 Recent Results (${resultsCount})` }
                  ].map(f => (
                    <TouchableOpacity
                      key={f.id}
                      style={[
                        styles.filterTabBtn,
                        matchFilter === f.id && styles.filterTabBtnActive,
                        isSmallMobile && { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 18 }
                      ]}
                      onPress={() => setMatchFilter(f.id as any)}
                    >
                      <Text
                        style={[
                          styles.filterTabBtnText,
                          matchFilter === f.id && styles.filterTabBtnTextActive,
                          isSmallMobile && { fontSize: 11 }
                        ]}
                      >
                        {isSmallMobile ? f.short : f.full}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })()}

            {/* Loading State: Only show spinner if matches haven't loaded yet */}
            {isLoadingMatches && publicMatches.length === 0 && (
              <View style={{ paddingVertical: 40, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color="#d4af37" />
                <Text style={{ marginTop: 12, fontSize: 14, fontWeight: '700', color: '#854d0e' }}>
                  Connecting to Official MongoDB Fixtures Database...
                </Text>
              </View>
            )}
            {/* Error State */}
            {!isLoadingMatches && matchesError && publicMatches.length === 0 && (
              <View
                style={{
                  backgroundColor: '#fef2f2',
                  borderWidth: 1,
                  borderColor: '#fca5a5',
                  borderRadius: 12,
                  padding: 24,
                  alignItems: 'center',
                  marginVertical: 12
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#b91c1c', marginBottom: 6 }}>
                  Unable to load match records
                </Text>
                <Text style={{ fontSize: 13, color: '#7f1d1d', textAlign: 'center', marginBottom: 14 }}>
                  {matchesError}
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: '#dc2626', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
                  onPress={() => loadPublicMatches(true)}
                >
                  <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13 }}>Retry Connection</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Empty State */}
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
                    <Text style={{ fontSize: 36, marginBottom: 8 }}>🏏</Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 4 }}>
                      No Matches Found
                    </Text>
                    <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center' }}>
                      There are currently no {matchFilter !== 'all' ? matchFilter : ''} matches recorded in the database.
                    </Text>
                  </View>
                );
              }
              return null;
            })()}

            {/* Matches Grid */}
            {publicMatches.length > 0 && (
              <View style={[styles.grid2Col, isMobile && { flexDirection: 'column' }]}>
                {publicMatches
                  .filter(m => {
                    const s = (m.status || '').toLowerCase();
                    const raw = (m.rawStatus || '').toUpperCase();
                    const isPostponed = s === 'postponed' || raw === 'POSTPONED' || !!m.isPostponed || !!m.postponement?.is_postponed;
                    if (matchFilter === 'live') return s === 'live' || raw === 'LIVE' || raw === 'INNINGS_BREAK';
                    if (matchFilter === 'upcoming') return !isPostponed && (s === 'upcoming' || raw === 'SCHEDULED');
                    if (matchFilter === 'postponed') return isPostponed;
                    if (matchFilter === 'results') return s === 'completed' || raw === 'COMPLETED' || s === 'cancelled' || raw === 'CANCELLED';
                    return true;
                  })
                  .map(m => {
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
                              <View style={[styles.upcomingIndicatorPill, isSmallMobile && { paddingHorizontal: 7, paddingVertical: 2.5 }]}>
                                <Text style={[styles.upcomingIndicatorText, isSmallMobile && { fontSize: 9.5 }]}>⏰ UPCOMING</Text>
                              </View>
                            ) : isPostponed ? (
                              <View style={[styles.upcomingIndicatorPill, { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }, isSmallMobile && { paddingHorizontal: 7, paddingVertical: 2.5 }]}>
                                <Text style={[styles.upcomingIndicatorText, { color: '#b45309' }, isSmallMobile && { fontSize: 9.5 }]}>⏸️ POSTPONED</Text>
                              </View>
                            ) : isCompleted ? (
                              <View style={[styles.resultIndicatorPill, isSmallMobile && { paddingHorizontal: 7, paddingVertical: 2.5 }]}>
                                <Text style={[styles.resultIndicatorText, isSmallMobile && { fontSize: 9.5 }]}>🏁 RESULT</Text>
                              </View>
                            ) : (
                              <View
                                style={[
                                  styles.upcomingIndicatorPill,
                                  { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' },
                                  isSmallMobile && { paddingHorizontal: 7, paddingVertical: 2.5 }
                                ]}
                              >
                                <Text style={[styles.upcomingIndicatorText, { color: '#64748b' }, isSmallMobile && { fontSize: 9.5 }]}>🚫 CANCELLED</Text>
                              </View>
                            )}
                            <Text style={[styles.matchTournament, isSmallMobile && { fontSize: 11.5 }]} numberOfLines={1}>
                              {m.tournament || m.tournament_name || 'District Match'}
                            </Text>
                          </View>

                          <View style={styles.cardHeaderRightGroup}>
                            {isRain ? (
                              <View style={[styles.topRightRainPill, isSmallMobile && { paddingHorizontal: 6, paddingVertical: 2 }]}>
                                <Text style={[styles.topRightRainPillText, isSmallMobile && { fontSize: 9 }]}>
                                  🌧️ RAIN DELAY{m.currentBreak?.duration ? ` (${m.currentBreak.duration}m)` : ''}
                                </Text>
                              </View>
                            ) : isBreak ? (
                              <View style={[styles.topRightBreakPill, isSmallMobile && { paddingHorizontal: 6, paddingVertical: 2 }]}>
                                <Text style={[styles.topRightBreakPillText, isSmallMobile && { fontSize: 9 }]}>
                                  ☕ {m.currentBreak?.type?.toUpperCase()}
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
                              <Text style={[styles.formatBadgeText, isSmallMobile && { fontSize: 9 }]}>{m.format || 'T20'}</Text>
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
                              <View
                                style={[
                                  styles.teamMiniCrest,
                                  { backgroundColor: getTeamBadgeColor(teamAShort, 0) },
                                  isSmallMobile && { width: 24, height: 24, borderRadius: 12 }
                                ]}
                              >
                                <Text style={[styles.teamMiniCrestText, isSmallMobile && { fontSize: 9 }]}>{teamAShort}</Text>
                              </View>
                              <Text style={[styles.teamNameTextSingleRow, isSmallMobile && { fontSize: 12 }]} numberOfLines={1}>
                                {m.teamA}
                              </Text>
                              {isLive && <Text style={[styles.battingIcon, isSmallMobile && { fontSize: 10 }]}>🏏</Text>}
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
                              <View
                                style={[
                                  styles.teamMiniCrest,
                                  { backgroundColor: getTeamBadgeColor(teamBShort, 1) },
                                  isSmallMobile && { width: 24, height: 24, borderRadius: 12 }
                                ]}
                              >
                                <Text style={[styles.teamMiniCrestText, isSmallMobile && { fontSize: 9 }]}>{teamBShort}</Text>
                              </View>
                            </View>
                            <Text style={[m.scoreB ? styles.teamScoreSingleRow : styles.teamYetToBatSingleRow, { textAlign: 'right' }, isSmallMobile && { fontSize: isTinyMobile ? 13 : 14.5 }]}>
                              {m.scoreB || (isUpcoming ? 'Upcoming' : 'Yet to bat')}
                            </Text>
                          </View>
                        </View>

                        {/* Broadcast Kinetic Delivery Action Telemetry for Live Matches */}
                        {isLive && (
                          <BroadcastLiveBallAction
                            triggerKey={`${m.id}-${m.scoreA || ''}-${m.scoreB || ''}`}
                            autoPlay={true}
                            lastEvent={{
                              runs: 4,
                              isBoundary: true,
                              batterName: m.teamA || 'Striker',
                              shotZone: 'Cover'
                            }}
                          />
                        )}

                        {/* 3. Status Note / Active Rain Delay Notice */}
                        {isPostponed ? (
                          <View style={[styles.cardBreakBanner, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }, isSmallMobile && { paddingVertical: 6, paddingHorizontal: 8 }]}>
                            <Text style={[styles.cardBreakText, { color: '#b45309' }, isSmallMobile && { fontSize: 10.5 }]} numberOfLines={1}>
                              ⏸️ POSTPONED{m.postponement?.reason ? ` • ${m.postponement.reason}` : (m.postponementReason ? ` • ${m.postponementReason}` : (m.result ? ` • ${m.result}` : ' • Fixture Rescheduling in Progress'))}
                            </Text>
                          </View>
                        ) : m.result ? (
                          <Text style={[styles.matchStatusNoteGold, isSmallMobile && { fontSize: 11 }]}>🏆 {m.result}</Text>
                        ) : isRain ? (
                          <View style={[styles.cardRainBanner, isSmallMobile && { paddingVertical: 6, paddingHorizontal: 8 }]}>
                            <Text style={[styles.cardRainText, isSmallMobile && { fontSize: 10.5 }]} numberOfLines={1}>
                              🌧️ MATCH DELAYED DUE TO RAIN • Covers on pitch{m.currentBreak.startTime && m.currentBreak.endTime ? ` (${m.currentBreak.startTime} - ${m.currentBreak.endTime})` : ''}
                            </Text>
                          </View>
                        ) : isBreak ? (
                          <View style={[styles.cardBreakBanner, isSmallMobile && { paddingVertical: 6, paddingHorizontal: 8 }]}>
                            <Text style={[styles.cardBreakText, isSmallMobile && { fontSize: 10.5 }]} numberOfLines={1}>
                              ☕ {m.currentBreak.type?.toUpperCase()} IN PROGRESS{m.currentBreak.duration ? ` (${m.currentBreak.duration} MINS)` : ''}{m.currentBreak.startTime && m.currentBreak.endTime ? ` • ${m.currentBreak.startTime} - ${m.currentBreak.endTime}` : ''}
                            </Text>
                          </View>
                        ) : isLive ? (
                          <Text style={[styles.matchStatusNoteGold, isSmallMobile && { fontSize: 11 }]}>
                            ⏰ Live Inning in Progress ({m.overs || 20} Overs)
                          </Text>
                        ) : isUpcoming ? (
                          <Text style={[styles.matchStatusNote, isSmallMobile && { fontSize: 11 }]}>
                            📅 Match Scheduled: {cleanDate} {cleanTime}
                          </Text>
                        ) : isCancelled ? (
                          <Text style={[styles.matchStatusNote, { color: '#ef4444' }, isSmallMobile && { fontSize: 11 }]}>
                            🚫 Match Cancelled: {m.result || 'Cancelled by Federation Admin'}
                          </Text>
                        ) : (
                          <Text style={[styles.matchStatusNote, isSmallMobile && { fontSize: 11 }]}>ℹ️ Status: {m.status}</Text>
                        )}

                        {/* 4. Bottom Logistics Box (Clean Alignment, Only Emojis, No Redundant English) */}
                        <View style={[styles.cardLogisticsBottomBar, isSmallMobile && { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 }]}>
                          <View style={[styles.logisticsChipRow, isSmallMobile && { gap: 6, marginBottom: 4 }]}>
                            <View style={styles.logisticsChip}>
                              <Text style={styles.logisticsEmoji}>📅</Text>
                              <Text style={[styles.logisticsValueText, isSmallMobile && { fontSize: 10 }]}>{cleanDate}</Text>
                            </View>
                            {cleanTime ? (
                              <View style={styles.logisticsChip}>
                                <Text style={styles.logisticsEmoji}>⏰</Text>
                                <Text style={[styles.logisticsValueText, isSmallMobile && { fontSize: 10 }]}>{cleanTime}</Text>
                              </View>
                            ) : null}
                            <View style={[styles.logisticsChip, { flex: 1, minWidth: isSmallMobile ? '100%' : 'auto' }]}>
                              <Text style={styles.logisticsEmoji}>📍</Text>
                              <Text style={[styles.logisticsValueText, isSmallMobile && { fontSize: 10 }]} numberOfLines={1}>{cleanVenue}</Text>
                            </View>
                          </View>
                          <View style={styles.logisticsOfficialsBottomRow}>
                            <Text style={styles.logisticsEmoji}>⚖️</Text>
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
                          <Text style={[styles.tncaMatchCentreCardBtnText, isSmallMobile && { fontSize: 11 }]}>
                            {isLive
                              ? '🔴 Match Centre (Live Scorecard) ▶'
                              : isCompleted
                                ? '📊 Match Centre (Review & Wagon Wheel) ▶'
                                : isUpcoming
                                  ? '📅 Match Centre (Fixture Details)'
                                  : 'ℹ️ Match Centre (Match Details)'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
              </View>
            )}
          </View>
        </View>

        {/* ─── 5. SANCTIONED TOURNAMENTS ─────────────────────────────────── */}
        <View
          style={styles.section}
          onLayout={e => {
            const layout = e.nativeEvent.layout;
            setSectionPositions(prev => ({ ...prev, tournaments: layout.y }));
          }}
        >
          <View style={[styles.container, containerResponsiveStyle]}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTagBadge}>
                <Text style={styles.sectionTagBadgeText}>🏆 LEAGUE STRUCTURE</Text>
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
                <Text style={styles.tourneyIcon}>🛡️</Text>
                <Text style={styles.tourneyTitle}>Virudhunagar First Division League</Text>
                <Text style={styles.tourneySub}>The G. Parthasarathy Rolling Trophy</Text>
                <Text style={styles.tourneyDesc}>
                  The flagship red-ball 3-day competition with 12 affiliated first-tier clubs competing for district
                  supremacy and state trials.
                </Text>
                <View style={styles.tourneySpecs}>
                  <Text style={styles.tourneySpecItem}>👥 12 Affiliated Clubs</Text>
                  <Text style={styles.tourneySpecItem}>📅 Oct 2026 - Jan 2027</Text>
                  <Text style={styles.tourneySpecItem}>🎖️ ₹2,50,000 Prize Purse</Text>
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
                <Text style={styles.tourneyIcon}>⚡</Text>
                <Text style={styles.tourneyTitle}>Kamarajar Memorial T20 Trophy</Text>
                <Text style={styles.tourneySub}>Virudhunagar District Premier T20 Cup</Text>
                <Text style={styles.tourneyDesc}>
                  Fast-paced night and day T20 cricket featuring taluk teams with colored clothing and white cricket balls.
                </Text>
                <View style={styles.tourneySpecs}>
                  <Text style={styles.tourneySpecItem}>👥 16 Taluk & Club Teams</Text>
                  <Text style={styles.tourneySpecItem}>📅 Feb 2027</Text>
                  <Text style={styles.tourneySpecItem}>📺 Live Streamed on YouTube</Text>
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
                <Text style={styles.tourneyIcon}>🎓</Text>
                <Text style={styles.tourneyTitle}>District Inter-College Championship</Text>
                <Text style={styles.tourneySub}>Autonomous & Engineering Colleges Shield</Text>
                <Text style={styles.tourneyDesc}>
                  The premier collegiate tournament featuring VHNSN, PSR, ANJAC, Rajus, Kalasalingam University, and
                  SFR College.
                </Text>
                <View style={styles.tourneySpecs}>
                  <Text style={styles.tourneySpecItem}>👥 10 District Colleges</Text>
                  <Text style={styles.tourneySpecItem}>📅 Nov 2026</Text>
                  <Text style={styles.tourneySpecItem}>🎖️ District Selection Gateway</Text>
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
                <Text style={styles.tourneyIcon}>🏫</Text>
                <Text style={styles.tourneyTitle}>Andal Temple Inter-School Cup</Text>
                <Text style={styles.tourneySub}>Srivilliputhur & District Schools Shield</Text>
                <Text style={styles.tourneyDesc}>
                  The premier grassroots nursery identifying teenage talent for the district and state age-group trials.
                </Text>
                <View style={styles.tourneySpecs}>
                  <Text style={styles.tourneySpecItem}>🏫 24 District Schools</Text>
                  <Text style={styles.tourneySpecItem}>📅 Annual Summer Edition</Text>
                  <Text style={styles.tourneySpecItem}>🎖️ District Academy Scholarships</Text>
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
                <Text style={styles.sectionTagBadgeText}>📊 LEAGUE STANDINGS</Text>
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
                  onPress={() => setPointsTableKey(t.id)}
                >
                  <Text style={[styles.switchTabBtnText, pointsTableKey === t.id && styles.switchTabBtnTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Standings Table */}
            {isMobile && (
              <Text style={{ fontSize: 11, color: '#b45309', fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
                👉 Swipe horizontally to view full table (P, W, L, NR, NRR, PTS, Form)
              </Text>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ width: '100%' }}>
              <View style={styles.tableBox}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableTh, { width: 50, textAlign: 'center' }]}>Stand</Text>
                  <Text style={[styles.tableTh, { width: 230 }]}>Team / Club / College</Text>
                  <Text style={[styles.tableTh, { width: 45, textAlign: 'center' }]}>P</Text>
                  <Text style={[styles.tableTh, { width: 45, textAlign: 'center' }]}>W</Text>
                  <Text style={[styles.tableTh, { width: 45, textAlign: 'center' }]}>L</Text>
                  <Text style={[styles.tableTh, { width: 45, textAlign: 'center', color: '#fed966' }]}>NR</Text>
                  <Text style={[styles.tableTh, { width: 60, textAlign: 'center' }]}>Bonus</Text>
                  <Text style={[styles.tableTh, { width: 75, textAlign: 'center' }]}>NRR</Text>
                  <Text style={[styles.tableTh, { width: 55, textAlign: 'center', color: '#f5c43d' }]}>PTS</Text>
                  <Text style={[styles.tableTh, { width: 130, textAlign: 'center' }]}>Recent Form</Text>
                </View>

                {((portalPointsTable.length > 0 ? portalPointsTable : (TABLE_DATA[pointsTableKey] || [])).map((row: any, idx: number) => {
                  const standNum = row.pos || row.stand || (idx + 1);
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
                      <View style={{ width: 230 }}>
                        <Text style={styles.pointsTeamName}>{teamTitle}</Text>
                        <Text style={styles.pointsTeamSub}>{teamSubtitle}</Text>
                      </View>
                      <Text style={[styles.tableTd, { width: 45, textAlign: 'center' }]}>{pPlayed}</Text>
                      <Text style={[styles.tableTd, { width: 45, textAlign: 'center', fontWeight: '700' }]}>{pWon}</Text>
                      <Text style={[styles.tableTd, { width: 45, textAlign: 'center' }]}>{pLost}</Text>
                      <Text style={[styles.tableTd, { width: 45, textAlign: 'center', color: '#fed966', fontWeight: '700' }]}>
                        {pNr}
                      </Text>
                      <Text style={[styles.tableTd, { width: 60, textAlign: 'center' }]}>{pBonus}</Text>
                      <Text style={[styles.tableTd, { width: 75, textAlign: 'center' }]}>{pNrr}</Text>
                      <Text style={[styles.tableTd, { width: 55, textAlign: 'center', color: '#f5c43d', fontWeight: '800' }]}>
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
                }))}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* ─── 7. PLAYER PERFORMANCE RECORDS ─────────────────────────────── */}
        <View
          style={styles.section}
          onLayout={e => {
            const layout = e.nativeEvent.layout;
            setSectionPositions(prev => ({ ...prev, stats: layout.y }));
          }}
        >
          <View style={[styles.container, containerResponsiveStyle]}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTagBadge}>
                <Text style={styles.sectionTagBadgeText}>📈 PERFORMANCE RECORDS</Text>
              </View>
              <Text style={[styles.sectionTitle, isSmallMobile && { fontSize: 20 }]}>Season 2026-27 Player Performance</Text>
              <Text style={styles.sectionSubtitle}>
                Batting (50s/100s, Role: Batter), Bowling (Runs, 3w/5w counts), and Fielding Stats across official competitions
              </Text>
            </View>

            {/* Performance Tabs */}
            <View style={[styles.perfTabsRow, isSmallMobile && { gap: 6, marginBottom: 14 }]}>
              {[
                { id: 'ratings', short: '⭐ Player Ratings', label: '⭐ Performance Ratings (0–10 ★)' },
                { id: 'batting', short: '🏏 Batting', label: '🏏 Batting Stats (Runs, 50/100s)' },
                { id: 'bowling', short: '🎯 Bowling', label: '🎯 Bowling Stats (Runs, 3w/5w)' },
                { id: 'fielding', short: '🧤 Fielding', label: '🧤 Fielding Stats (Catches, Stumpings)' }
              ].map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.perfTabBtn,
                    perfTab === t.id && styles.perfTabBtnActive,
                    isSmallMobile && { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 18 }
                  ]}
                  onPress={() => setPerfTab(t.id as any)}
                >
                  <Text style={[
                    styles.perfTabBtnText,
                    perfTab === t.id && styles.perfTabBtnTextActive,
                    isSmallMobile && { fontSize: 11 }
                  ]}>
                    {isSmallMobile ? t.short : t.label}
                  </Text>
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
                    { id: 'overall', label: '⭐ Overall' },
                    { id: 'batting', label: '🏏 Batting' },
                    { id: 'bowling', label: '🎯 Bowling' }
                  ].map(c => (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.ratingSubFilterBtn,
                        ratingCategory === c.id && styles.ratingSubFilterBtnActive
                      ]}
                      onPress={() => {
                        setRatingCategory(c.id as any);
                        loadRatingsLeaderboard(c.id as any, ratingFormat);
                      }}
                    >
                      <Text style={[
                        styles.ratingSubFilterText,
                        ratingCategory === c.id && styles.ratingSubFilterTextActive
                      ]}>
                        {c.label}
                      </Text>
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

            {/* Dynamic Performance Table */}
            {isMobile && (
              <Text style={{ fontSize: 11, color: '#b45309', fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
                👉 Swipe horizontally to view full performance records
              </Text>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ width: '100%' }}>
              <View style={styles.tableBox}>
                {perfTab === 'ratings' && (
                  <View>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.tableTh, { width: 50, textAlign: 'center' }]}>Rank</Text>
                      <Text style={[styles.tableTh, { width: 180 }]}>Player / Role</Text>
                      <Text style={[styles.tableTh, { width: 65, textAlign: 'center' }]}>Matches</Text>
                      <Text style={[styles.tableTh, { width: 140, textAlign: 'center', color: '#fde047' }]}>Rating (0-10 ★)</Text>
                      <Text style={[styles.tableTh, { width: 100, textAlign: 'center' }]}>Confidence</Text>
                      <Text style={[styles.tableTh, { width: 75, textAlign: 'center', color: '#fed966' }]}>Batting ★</Text>
                      <Text style={[styles.tableTh, { width: 75, textAlign: 'center', color: '#4ade80' }]}>Bowling ★</Text>
                      <Text style={[styles.tableTh, { width: 75, textAlign: 'center', color: '#a5b4fc' }]}>Fielding ★</Text>
                    </View>
                    {isLoadingLeaders ? (
                      <View style={{ padding: 24, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color="#f59e0b" />
                        <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 8 }}>Computing Player Ratings...</Text>
                      </View>
                    ) : (ratingLeaders.length > 0 ? ratingLeaders : []).map((p: any, idx: number) => {
                      const rank = idx + 1;
                      const rankBadge = rank === 1 ? '🥇 1' : rank === 2 ? '🥈 2' : rank === 3 ? '🥉 3' : `#${rank}`;
                      const score = ratingCategory === 'batting' ? p.battingRating : (ratingCategory === 'bowling' ? p.bowlingRating : p.overallRating);
                      return (
                        <View key={p.playerId || idx} style={styles.tableRow}>
                          <Text style={[styles.tableTd, { width: 50, textAlign: 'center', fontWeight: '800', color: rank <= 3 ? '#f59e0b' : '#94a3b8' }]}>
                            {rankBadge}
                          </Text>
                          <View style={{ width: 180 }}>
                            <Text style={styles.pointsTeamName}>{p.playerName}</Text>
                            <Text style={styles.playerSubRole}>{p.role || 'Player'}</Text>
                          </View>
                          <Text style={[styles.tableTd, { width: 65, textAlign: 'center' }]}>{p.matchesCount || 1}</Text>
                          <View style={{ width: 140, alignItems: 'center', justifyContent: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 158, 11, 0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#f59e0b' }}>
                              <Text style={{ color: '#fde047', fontWeight: '900', fontSize: 12 }}>
                                {score !== null && score !== undefined ? `${Number(score).toFixed(1)} ★` : '—'}
                              </Text>
                            </View>
                          </View>
                          <View style={{ width: 100, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{
                              fontSize: 9.5,
                              fontWeight: '800',
                              color: p.confidence === 'Established' ? '#4ade80' : (p.confidence === 'Developing' ? '#fbbf24' : '#38bdf8'),
                              backgroundColor: p.confidence === 'Established' ? 'rgba(74, 222, 128, 0.15)' : (p.confidence === 'Developing' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(56, 189, 248, 0.15)'),
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 4
                            }}>
                              {p.confidence || 'Provisional'}
                            </Text>
                          </View>
                          <Text style={[styles.tableTd, { width: 75, textAlign: 'center', color: '#fed966' }]}>
                            {p.battingRating !== null && p.battingRating !== undefined ? `${Number(p.battingRating).toFixed(1)} ★` : '—'}
                          </Text>
                          <Text style={[styles.tableTd, { width: 75, textAlign: 'center', color: '#4ade80' }]}>
                            {p.bowlingRating !== null && p.bowlingRating !== undefined ? `${Number(p.bowlingRating).toFixed(1)} ★` : '—'}
                          </Text>
                          <Text style={[styles.tableTd, { width: 75, textAlign: 'center', color: '#a5b4fc' }]}>
                            {p.fieldingRating !== null && p.fieldingRating !== undefined ? `${Number(p.fieldingRating).toFixed(1)} ★` : '—'}
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
                      <Text style={[styles.tableTh, { width: 45, textAlign: 'center', color: '#fed966' }]}>50s</Text>
                      <Text style={[styles.tableTh, { width: 45, textAlign: 'center', color: '#fed966' }]}>100s</Text>
                      <Text style={[styles.tableTh, { width: 65, textAlign: 'right', color: '#f5c43d' }]}>Runs</Text>
                    </View>
                    {((portalTopBatsmen.length > 0 ? portalTopBatsmen : PERF_DATA.batting).map((p: any, idx: number) => (
                      <View key={p.id || idx} style={styles.tableRow}>
                        <Text style={[styles.tableTd, { width: 50, textAlign: 'center', fontWeight: '700' }]}>
                          {p.stand || (idx + 1)}
                        </Text>
                        <View style={{ width: 170 }}>
                          <Text style={styles.pointsTeamName}>{p.name}</Text>
                          <Text style={styles.playerSubRole}>{p.role || 'Batter'}</Text>
                        </View>
                        <Text style={[styles.tableTd, { width: 170 }]}>{p.team || 'District Club'}</Text>
                        <Text style={[styles.tableTd, { width: 45, textAlign: 'center' }]}>{p.mat || 5}</Text>
                        <Text style={[styles.tableTd, { width: 45, textAlign: 'center' }]}>{p.inns || 5}</Text>
                        <Text style={[styles.tableTd, { width: 55, textAlign: 'center' }]}>{p.hs || (p.runs ? p.runs + '*' : '50*')}</Text>
                        <Text style={[styles.tableTd, { width: 55, textAlign: 'center' }]}>{p.average || p.avg || '35.0'}</Text>
                        <Text style={[styles.tableTd, { width: 55, textAlign: 'center' }]}>{p.strikeRate || p.sr || '135.0'}</Text>
                        <Text style={[styles.tableTd, { width: 45, textAlign: 'center', color: '#fed966' }]}>
                          {p.fifties ?? (p.runs >= 100 ? 1 : 0)}
                        </Text>
                        <Text style={[styles.tableTd, { width: 45, textAlign: 'center', color: '#fed966' }]}>
                          {p.hundreds ?? 0}
                        </Text>
                        <Text style={[styles.tableTd, { width: 65, textAlign: 'right', color: '#f5c43d', fontWeight: '800' }]}>
                          {p.runs || 0}
                        </Text>
                      </View>
                    )))}
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
                      <Text style={[styles.tableTh, { width: 50, textAlign: 'center', color: '#fed966' }]}>3w</Text>
                      <Text style={[styles.tableTh, { width: 50, textAlign: 'center', color: '#fed966' }]}>5w</Text>
                      <Text style={[styles.tableTh, { width: 65, textAlign: 'right', color: '#4ade80' }]}>Wkts</Text>
                    </View>
                    {((portalTopBowlers.length > 0 ? portalTopBowlers : PERF_DATA.bowling).map((p: any, idx: number) => (
                      <View key={p.id || idx} style={styles.tableRow}>
                        <Text style={[styles.tableTd, { width: 50, textAlign: 'center', fontWeight: '700' }]}>
                          {p.stand || (idx + 1)}
                        </Text>
                        <View style={{ width: 170 }}>
                          <Text style={styles.pointsTeamName}>{p.name}</Text>
                          <Text style={styles.playerSubRole}>{p.role || 'Bowler'}</Text>
                        </View>
                        <Text style={[styles.tableTd, { width: 170 }]}>{p.team || 'District Club'}</Text>
                        <Text style={[styles.tableTd, { width: 45, textAlign: 'center' }]}>{p.mat || 5}</Text>
                        <Text style={[styles.tableTd, { width: 45, textAlign: 'center' }]}>{p.inns || 5}</Text>
                        <Text style={[styles.tableTd, { width: 55, textAlign: 'center' }]}>{p.overs || '20.0'}</Text>
                        <Text style={[styles.tableTd, { width: 55, textAlign: 'center' }]}>{p.runs_conceded || p.runs || 120}</Text>
                        <Text style={[styles.tableTd, { width: 55, textAlign: 'center' }]}>{p.economy || p.econ || '6.50'}</Text>
                        <Text style={[styles.tableTd, { width: 50, textAlign: 'center', color: '#fed966' }]}>
                          {p.threeWkts ?? (p.wickets >= 3 ? 1 : 0)}
                        </Text>
                        <Text style={[styles.tableTd, { width: 50, textAlign: 'center', color: '#fed966' }]}>
                          {p.fiveWkts ?? (p.wickets >= 5 ? 1 : 0)}
                        </Text>
                        <Text style={[styles.tableTd, { width: 65, textAlign: 'right', color: '#4ade80', fontWeight: '800' }]}>
                          {p.wickets || 0}
                        </Text>
                      </View>
                    )))}
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
                      <Text style={[styles.tableTh, { width: 60, textAlign: 'center', color: '#fed966' }]}>Catches</Text>
                      <Text style={[styles.tableTh, { width: 70, textAlign: 'center', color: '#fed966' }]}>Stumpings</Text>
                      <Text style={[styles.tableTh, { width: 70, textAlign: 'center', color: '#fed966' }]}>Run Outs</Text>
                      <Text style={[styles.tableTh, { width: 70, textAlign: 'right', color: '#4ade80' }]}>Total</Text>
                    </View>
                    {((portalTopFielders.length > 0 ? portalTopFielders : PERF_DATA.fielding).map((p: any, idx: number) => (
                      <View key={p.id || idx} style={styles.tableRow}>
                        <Text style={[styles.tableTd, { width: 50, textAlign: 'center', fontWeight: '700' }]}>
                          {p.stand || (idx + 1)}
                        </Text>
                        <View style={{ width: 180 }}>
                          <Text style={styles.pointsTeamName}>{p.name}</Text>
                          <Text style={styles.playerSubRole}>{p.role || 'Fielder'}</Text>
                        </View>
                        <Text style={[styles.tableTd, { width: 180 }]}>{p.team || 'District Club'}</Text>
                        <Text style={[styles.tableTd, { width: 50, textAlign: 'center' }]}>{p.mat || 5}</Text>
                        <Text style={[styles.tableTd, { width: 50, textAlign: 'center' }]}>{p.inns || 5}</Text>
                        <Text style={[styles.tableTd, { width: 60, textAlign: 'center', color: '#fed966' }]}>
                          {p.catches || 0}
                        </Text>
                        <Text style={[styles.tableTd, { width: 70, textAlign: 'center', color: '#fed966' }]}>
                          {p.stumpings || 0}
                        </Text>
                        <Text style={[styles.tableTd, { width: 70, textAlign: 'center', color: '#fed966' }]}>
                          {p.runOuts || 0}
                        </Text>
                        <Text style={[styles.tableTd, { width: 70, textAlign: 'right', color: '#4ade80', fontWeight: '800' }]}>
                          {p.dismissals || (p.catches || 0) + (p.stumpings || 0)}
                        </Text>
                      </View>
                    )))}
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* ─── 8. DISTRICT SPECIAL MATCH RECORDS & MILESTONES ───────────── */}
        <View
          style={styles.section}
          onLayout={e => {
            const layout = e.nativeEvent.layout;
            setSectionPositions(prev => ({ ...prev, players: layout.y }));
          }}
        >
          <View style={[styles.container, containerResponsiveStyle]}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTagBadge}>
                <Text style={styles.sectionTagBadgeText}>🏆 OFFICIAL DISTRICT SPECIAL MATCH RECORDS</Text>
              </View>
              <Text style={[styles.sectionTitle, isSmallMobile && { fontSize: 20 }]}>District Match Record Breakers & Milestone Performers</Text>
              <Text style={styles.sectionSubtitle}>
                Elite match performances: Centuries (100s), Half-Centuries (50s), and Best Bowling Spells across Virudhunagar District League
              </Text>
            </View>

            {/* Search Bar */}
            <View style={styles.playerSearchBar}>
              <Text style={{ fontSize: 16 }}>🔍</Text>
              <TextInput
                style={styles.playerSearchInput}
                placeholder="Search milestone player by name, record (100, 50, 5W), team, or taluk..."
                placeholderTextColor="#62799c"
                value={playerSearchQuery}
                onChangeText={setPlayerSearchQuery}
              />
              {playerSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setPlayerSearchQuery('')}>
                  <Text style={{ color: '#fff', fontSize: 18, paddingHorizontal: 6 }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Category Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subTabsScroll}>
              {[
                { id: 'all', label: `⭐ All Special Records (${filteredPlayers.length})` },
                { id: 'century', label: '💯 100s (Centuries)' },
                { id: 'fifty', label: '🎖️ 50s (Half-Centuries)' },
                { id: 'bowler', label: '🎯 Best Bowling (3W+ / 5W)' },
                { id: 'womens', label: "♀️ Women's Milestones" }
              ].map(f => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.playerPillBtn, playerFilter === f.id && styles.playerPillBtnActive]}
                  onPress={() => setPlayerFilter(f.id)}
                >
                  <Text style={[styles.playerPillBtnText, playerFilter === f.id && styles.playerPillBtnTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Empty State */}
            {filteredPlayers.length === 0 && (
              <View style={{ padding: 24, alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#fde68a', marginVertical: 14 }}>
                <Text style={{ fontSize: 28, marginBottom: 8 }}>🏅</Text>
                <Text style={{ color: '#0f172a', fontWeight: '800', fontSize: 16 }}>No Special Milestone Records Found</Text>
                <Text style={{ color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 4, maxWidth: 500 }}>
                  Only verified 50s (Half-Centuries), 100s (Centuries), and 3W+ Bowling Hauls scored in official matches are recorded in this hall of fame.
                </Text>
              </View>
            )}

            {/* Players Grid */}
            <View style={[styles.grid2Col, isMobile && { flexDirection: 'column' }]}>
              {filteredPlayers.map(p => {
                const isCentury = p.milestoneType === 'century' || (p.stats?.hundreds && p.stats.hundreds > 0) || parseInt(p.stats?.hs || '0', 10) >= 100;
                const isBowlingHaul = p.milestoneType === 'bowling_haul' || (p.stats?.wkts && p.stats.wkts >= 3) || (p.stats?.best && (p.stats.best.startsWith('3/') || p.stats.best.startsWith('4/') || p.stats.best.startsWith('5/')));

                const badgeLabel = p.milestoneBadge || (isCentury ? '💯 CENTURY RECORD' : (isBowlingHaul ? ((p.stats?.wkts >= 5 || (p.stats?.best && p.stats.best.startsWith('5/'))) ? '🎯 5-WICKET MATCH HAUL' : '🔥 3+ WICKETS IN MATCH') : '🎖️ HALF-CENTURY RECORD'));
                const themeColor = isCentury ? '#b45309' : (isBowlingHaul ? '#7e22ce' : '#c2410c');
                const badgeBg = isCentury ? '#fef3c7' : (isBowlingHaul ? '#f3e8ff' : '#ffedd5');
                const badgeBorder = isCentury ? '#fde68a' : (isBowlingHaul ? '#e9d5ff' : '#fed7aa');
                const perfText = p.matchPerformance || (isBowlingHaul ? (p.stats?.best ? `${p.stats.best} Match Figures` : `${p.stats?.wkts} Wickets Spell`) : `${p.stats?.hs} Runs Knock`);

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
                      <Text style={[styles.recordBadgeLabel, { color: themeColor }]} numberOfLines={1}>
                        {badgeLabel}
                      </Text>
                      <View style={[styles.recordTagPill, { backgroundColor: themeColor }]}>
                        <Text style={styles.recordTagPillText}>
                          {isCentury ? '100+' : (isBowlingHaul ? 'HAUL' : '50+')}
                        </Text>
                      </View>
                    </View>

                    {/* Main Focus 1: Player Profile */}
                    <View style={styles.recordProfileRow}>
                      <LinearGradient
                        colors={p.avatarColor || (isCentury ? ['#b45309', '#f59e0b'] : (isBowlingHaul ? ['#581c87', '#9333ea'] : ['#1e3a8a', '#3b82f6']))}
                        style={styles.recordAvatar}
                      >
                        <Text style={styles.recordAvatarText}>
                          {p.name
                            .split(' ')
                            .map((w: string) => w[0])
                            .join('')
                            .slice(0, 2)}
                        </Text>
                      </LinearGradient>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={styles.recordPlayerName} numberOfLines={1}>{p.name}</Text>
                          <Text style={styles.recordOfficialCheck}>✓ Record</Text>
                        </View>
                        <Text style={styles.recordTeamText} numberOfLines={1}>
                          {p.team} • <Text style={{ color: '#64748b' }}>{p.taluk}</Text>
                        </Text>
                        <Text style={styles.recordRoleBadge}>
                          {p.roleLabel || p.playingRole || 'Player'}
                        </Text>
                      </View>
                    </View>

                    {/* Main Focus 2: What They Did (Milestone Performance) */}
                    <View style={[styles.recordPerfBox, { borderLeftColor: themeColor }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <Text style={[styles.recordPerfMain, { color: themeColor }]} numberOfLines={1}>
                          ⚡ {perfText}
                        </Text>
                        <Text style={styles.recordPerfSub}>
                          {isBowlingHaul ? `Econ: ${p.stats?.econ || '4.50'}` : `SR: ${p.stats?.sr || '140.0'}`}
                        </Text>
                      </View>
                      <Text style={styles.recordMatchVs} numberOfLines={1}>
                        🎯 {p.matchVs || `${p.team} • Virudhunagar League`}
                      </Text>
                    </View>

                    {/* Clean Action Footer */}
                    <View style={styles.recordCardFooter}>
                      <Text style={styles.recordCardFooterText}>Tap to view</Text>
                      <Text style={[styles.recordCardFooterArrow, { color: themeColor }]}>View Details ›</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* ─── 9. ABOUT CFVD HERITAGE ────────────────────────────────────── */}
        <View
          style={styles.section}
          onLayout={e => {
            const layout = e.nativeEvent.layout;
            setSectionPositions(prev => ({ ...prev, about: layout.y }));
          }}
        >
          <View style={[styles.container, containerResponsiveStyle]}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTagBadge}>
                <Text style={styles.sectionTagBadgeText}>🏛️ GOVERNING CRICKET BODY</Text>
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
                    <Text style={{ fontSize: 18, color: '#b45309', fontWeight: '900' }}>✓</Text>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.valueTitle}>Fair Play & Ethics</Text>
                      <Text style={styles.valueDesc}>
                        Strict implementation of Federation Code of Conduct and Anti-Corruption rules.
                      </Text>
                    </View>
                  </View>
                  <View style={styles.valueItem}>
                    <Text style={{ fontSize: 18, color: '#b45309', fontWeight: '900' }}>✓</Text>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.valueTitle}>Grassroots & Collegiate Scouting</Text>
                      <Text style={styles.valueDesc}>
                        Annual leagues identifying talent across 8 taluks, schools, and affiliated colleges.
                      </Text>
                    </View>
                  </View>
                  <View style={styles.valueItem}>
                    <Text style={{ fontSize: 18, color: '#b45309', fontWeight: '900' }}>✓</Text>
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
                  <Text style={styles.aboutCrestBadgeText}>★ Recognized District Cricket Governing Body</Text>
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
                  <Text style={styles.groundLoc}>📍 Collectorate Road, Virudhunagar</Text>
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
                  <Text style={styles.groundLoc}>📍 PSR College Sports Enclave, Sivakasi</Text>
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
                  <Text style={styles.groundLoc}>📍 PACM Campus, Rajapalayam</Text>
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
                  <Text style={{ fontSize: 24, marginRight: 10 }}>🎯</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.afTitle}>Certified Professional Coaches</Text>
                    <Text style={styles.afDesc}>Personalized batting & bowling biomechanics</Text>
                  </View>
                </View>
                <View style={styles.afItem}>
                  <Text style={{ fontSize: 24, marginRight: 10 }}>📹</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.afTitle}>High-Speed Video Analysis</Text>
                    <Text style={styles.afDesc}>Real-time technical corrections and tactical coaching</Text>
                  </View>
                </View>
                <View style={styles.afItem}>
                  <Text style={{ fontSize: 24, marginRight: 10 }}>🏋️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.afTitle}>Fitness & Physiotherapy</Text>
                    <Text style={styles.afDesc}>Yo-Yo test benchmarks and injury rehabilitation</Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* ─── 12. MEDIA & PRESS NOTICES (TNCA STYLE SUB-NAV) ─────────── */}
        <View
          nativeID="cfvd-section-news"
          {...({ id: 'cfvd-section-news' } as any)}
          style={styles.section}
        >
          <View style={[styles.container, containerResponsiveStyle]}>
            {/* TNCA Sub-Nav Bar: [ 📰 News ] [ 📷 Photos ] ──────── See More > */}
            <View style={styles.tncaMediaSubNavRow}>
              <View style={styles.tncaMediaPillGroup}>
                <TouchableOpacity style={styles.tncaPillYellowActive} activeOpacity={0.85}>
                  <Text style={styles.tncaPillYellowText}>📰 News</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.tncaPillWhiteInactive}
                  onPress={() => alert('Official CFVD Tournament Photo Gallery available in the portal.')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.tncaPillWhiteText}>📷 Photos</Text>
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
                <Text style={styles.sectionTagBadgeText}>📰 MEDIA & NOTICES</Text>
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
        </View>

        {/* ─── 13. VISUAL ARCHIVES GALLERY ───────────────────────────────── */}
        <View style={styles.section}>
          <View style={[styles.container, containerResponsiveStyle]}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTagBadge}>
                <Text style={styles.sectionTagBadgeText}>📸 VISUAL ARCHIVES</Text>
              </View>
              <Text style={[styles.sectionTitle, isSmallMobile && { fontSize: 20 }]}>Official Match Day Moments</Text>
            </View>

            <View style={styles.grid3Col}>
              <TouchableOpacity
                style={styles.galleryItem}
                onPress={() => setLightboxImage({ uri: IMG_STADIUM, caption: 'District Sports Complex Floodlit Final' })}
              >
                <Image source={IMG_STADIUM} style={styles.galleryImg} resizeMode="cover" />
                <View style={styles.galleryOverlay}>
                  <Text style={styles.galleryOverlayText}>🔍 Stadium Final</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.galleryItem}
                onPress={() => setLightboxImage({ uri: IMG_BATSMAN, caption: 'First Division League Cover Drive' })}
              >
                <Image source={IMG_BATSMAN} style={styles.galleryImg} resizeMode="cover" />
                <View style={styles.galleryOverlay}>
                  <Text style={styles.galleryOverlayText}>🔍 Classic Cover Drive</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.galleryItem}
                onPress={() => setLightboxImage({ uri: IMG_CHAMPIONS, caption: 'Championship Trophy Celebration' })}
              >
                <Image source={IMG_CHAMPIONS} style={styles.galleryImg} resizeMode="cover" />
                <View style={styles.galleryOverlay}>
                  <Text style={styles.galleryOverlayText}>🔍 Trophy Presentation</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ─── 14. CONTACT SECRETARIAT ───────────────────────────────────── */}
        <View style={styles.section}>
          <View style={[styles.container, containerResponsiveStyle]}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTagBadge}>
                <Text style={styles.sectionTagBadgeText}>📮 SECRETARIAT</Text>
              </View>
              <Text style={[styles.sectionTitle, isSmallMobile && { fontSize: 20 }]}>Get in Touch with CFVD</Text>
            </View>

            <View style={[styles.grid2Col, isMobile && { flexDirection: 'column' }]}>
              <View style={[styles.contactInfoCard, isMobile && { width: '100%', minWidth: '100%', maxWidth: '100%' }, isSmallMobile && { padding: 12 }]}>
                <Text style={styles.contactCardTitle}>Administrative Office</Text>
                <Text style={styles.contactLine}>
                  📍 District Sports Complex Stadium, Collectorate Road, Virudhunagar – 626002, Tamil Nadu
                </Text>
                <Text style={styles.contactLine}>📞 +91 94430 12345 / 04562 245678</Text>
                <Text style={styles.contactLine}>✉️ info@cfvd-cricket.org / secretary@cfvd-cricket.org</Text>
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
                  <Text style={styles.footerAffilText}>★ Recognized District Cricket Governing Body</Text>
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
                <Text style={styles.modalCloseBtn}>✕</Text>
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
                <Text style={styles.openFullScorecardCtaText}>
                  📊 View Full Interactive Wagon Wheel & Pro Scorecard ▶
                </Text>
              </TouchableOpacity>

              {/* Toss & Match Summary Banner */}
              <View style={styles.scorecardTossBanner}>
                <Text style={styles.scorecardTossText}>
                  {realScorecardData?.match?.result || activeScorecardMatchData?.result
                    ? `🏆 Result: ${realScorecardData?.match?.result || activeScorecardMatchData?.result}`
                    : realScorecardData?.match?.toss_winner_name
                      ? `🪙 Toss: ${realScorecardData.match.toss_winner_name} won the toss and elected to ${realScorecardData.match.toss_decision || 'bat'}`
                      : activeScorecardMatchData
                        ? `🪙 Scheduled Match: ${activeScorecardMatchData.teamA} vs ${activeScorecardMatchData.teamB} (${activeScorecardMatchData.format || 'T20'})`
                        : '🪙 Toss: Sivakasi Super Kings won the toss and elected to bat first (20.0 Overs).'}
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
                  { marginBottom: 14 }
                ]}>
                  <Text style={styles.cardBreakEmoji}>
                    {activeScorecardMatchData.currentBreak.type?.toLowerCase().includes('rain') ? '🌧️' : '☕'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[
                      styles.cardBreakText,
                      activeScorecardMatchData.currentBreak.type?.toLowerCase().includes('rain') && styles.cardRainText
                    ]}>
                      {activeScorecardMatchData.currentBreak.type?.toLowerCase().includes('rain')
                        ? '🌧️ MATCH DELAYED DUE TO RAIN'
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
                              🎳 {inn.currentBowler.name} (Active)
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Suspended Bowlers Warning */}
                      {Array.isArray(inn.suspendedBowlers) && inn.suspendedBowlers.length > 0 && (
                        <View style={styles.homeSuspendedBanner}>
                          <Text style={styles.homeSuspendedText}>
                            🛑 Umpire Suspension (2 No-Balls): {inn.suspendedBowlers.map((b: any) => b.name).join(', ')} is suspended from bowling
                          </Text>
                        </View>
                      )}

                      {/* Bowling Figures Table */}
                      {inn.bowlers && inn.bowlers.length > 0 && (
                        <View style={{ marginTop: 14 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <Text style={styles.scorecardTableSubtitle}>🎯 BOWLING FIGURES</Text>
                            {inn.currentBowler && (
                              <View style={styles.homeActiveBowlerPill}>
                                <Text style={styles.homeActiveBowlerPillText}>🎳 Active: {inn.currentBowler.name}</Text>
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
                                    badgeText = '🚫 Suspended (2 No-Balls)';
                                  } else if (subRecord) {
                                    if (subRecord.oldBowlerName === bw.name || subRecord.oldBowlerId === bw.playerId) {
                                      badgeText = subRecord.situation ? `🩹 Sub: ${subRecord.situation}` : '🩹 Mid-Over Substituted';
                                    } else if (subRecord.isMidOver) {
                                      badgeText = '⚡ Shared Over (Sub In)';
                                    }
                                  } else if (bw.overs && !bw.overs.endsWith('.0') && !isCurrent) {
                                    badgeText = `🩹 Mid-Over Sub (${bw.overs} ov)`;
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
                                            <Text style={styles.homeBowlingBadgeText}>🟢 Bowling</Text>
                                          </View>
                                        )}
                                      </View>
                                      {isSuspended ? (
                                        <View style={styles.homeSuspendedPill}>
                                          <Text style={styles.homeSuspendedPillText}>🚫 Suspended (2 No-Balls)</Text>
                                        </View>
                                      ) : (bw.isQuotaFull || parseFloat(bw.overs || '0') >= (bw.maxQuota || 4.0)) ? (
                                        <View style={styles.homeQuotaPill}>
                                          <Text style={styles.homeQuotaPillText}>🔋 Quota Full ({bw.overs}/{bw.maxQuota || 4}.0 Ov)</Text>
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
                          <Text style={styles.scorecardTableSubtitle}>⚡ FALL OF WICKETS</Text>
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
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.playerIdTag}>{selectedPlayerModal.id}</Text>
                        <Text style={styles.playerVerifiedTag}>✓ Official Record</Text>
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
                    <Text style={styles.modalCloseBtn}>✕</Text>
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
                    <Text style={{ color: '#b45309', fontWeight: '900', fontSize: 12.5, letterSpacing: 0.5 }}>
                      {selectedPlayerModal.milestoneBadge || '🏆 OFFICIAL DISTRICT MATCH RECORD'}
                    </Text>
                    <View style={{ backgroundColor: '#fef3c7', borderColor: '#fde68a', borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                      <Text style={{ color: '#92400e', fontSize: 10.5, fontWeight: '800' }}>
                        MILESTONE
                      </Text>
                    </View>
                  </View>

                  <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 18, marginBottom: 4 }}>
                    ⚡ {selectedPlayerModal.matchPerformance || `${selectedPlayerModal.stats?.hs || '0'} Runs Milestone`}
                  </Text>

                  {selectedPlayerModal.matchVs && (
                    <Text style={{ color: '#334155', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>
                      🎯 {selectedPlayerModal.matchVs}
                    </Text>
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
                      <Text style={{ fontSize: 12.5, color: '#15803d', fontWeight: '800', marginTop: 1 }}>
                        ★ Verified District Panel
                      </Text>
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
              <Text style={{ color: '#fff', fontSize: 20 }}>✕</Text>
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
                <Text style={styles.modalCloseBtn}>✕</Text>
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
    </View>
  );
}

// ─── STYLESHEET ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#020612'
  },
  mainScroll: {
    flex: 1
  },
  mainScrollContent: {
    paddingBottom: 60
  },
  container: {
    width: '100%',
    maxWidth: 1540,
    alignSelf: 'center',
    paddingHorizontal: 16
  },

  // Atmospheric Background
  bgStadiumImage: {
    ...StyleSheet.absoluteFill,
    opacity: 0.12,
    transform: [{ scale: 1.05 }]
  },
  bgTopGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 480
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
    paddingVertical: 2
  },
  tickerLinkText: {
    color: '#334155',
    fontSize: 11.5,
    fontWeight: '600'
  },

  // Hero Section (Luminous Light Gold Atmosphere)
  heroSection: {
    position: 'relative',
    paddingTop: 42,
    paddingBottom: 48,
    overflow: 'hidden'
  },
  heroWatermarkContainer: {
    position: 'absolute',
    top: '48%',
    right: 30,
    transform: [{ translateY: -270 }],
    width: 540,
    height: 540,
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

  // 3D Folded Golden Motto Ribbon Banner
  ribbonWrapper: {
    position: 'relative',
    marginTop: 4,
    marginBottom: 16,
    alignSelf: 'flex-start'
  },
  ribbonBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#996515',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    elevation: 3
  },
  ribbonTailLeft: {
    position: 'absolute',
    bottom: -6,
    left: 4,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderRightWidth: 8,
    borderTopColor: '#582404',
    borderRightColor: 'transparent'
  },
  ribbonTailRight: {
    position: 'absolute',
    bottom: -6,
    right: 4,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderLeftWidth: 8,
    borderTopColor: '#582404',
    borderLeftColor: 'transparent'
  },
  ribbonStar: {
    color: '#634305',
    fontSize: 12,
    marginHorizontal: 4
  },
  ribbonText: {
    color: '#050d22',
    fontSize: 13.5,
    fontWeight: '800',
    fontStyle: 'italic',
    letterSpacing: 0.3,
    marginHorizontal: 8
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
    backgroundColor: '#f59e0b',
    borderColor: '#d97706',
    borderWidth: 1.5,
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 8,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    elevation: 3
  },
  heroRedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginRight: 8
  },
  heroBtnNavyText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  },
  heroBtnGold: {
    backgroundColor: 'rgba(212, 175, 55, 0.32)',
    borderColor: '#b8860b',
    borderWidth: 1.5,
    paddingHorizontal: 20,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8
  },
  heroBtnGoldText: {
    color: '#5c3800',
    fontSize: 14,
    fontWeight: '800'
  },
  heroBtnWhite: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(184, 134, 11, 0.45)',
    borderWidth: 1.5,
    paddingHorizontal: 20,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    elevation: 2
  },
  heroBtnWhiteText: {
    color: '#07132c',
    fontSize: 14,
    fontWeight: '800'
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
    paddingVertical: 36
  },
  sectionHead: {
    alignItems: 'center',
    marginBottom: 26
  },
  sectionTagBadge: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 10,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2
  },
  sectionTagBadgeText: {
    color: '#92400e',
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 0.8
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
    borderColor: '#fde68a',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8
  },
  opTabBtnActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#d97706'
  },
  opTabBtnText: {
    color: '#475569',
    fontSize: 12.5,
    fontWeight: '700'
  },
  opTabBtnTextActive: {
    color: '#ffffff',
    fontWeight: '900'
  },
  cardBox: {
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
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
    backgroundColor: '#fffdf5',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14
  },
  formHeaderTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12
  },
  formField: {
    marginBottom: 10
  },
  formLabel: {
    color: '#334155',
    fontSize: 11.5,
    fontWeight: '700',
    marginBottom: 4
  },
  formInput: {
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#0f172a',
    fontSize: 13
  },
  btnGold: {
    backgroundColor: '#f59e0b',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 6
  },
  btnGoldText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800'
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

  // Match Centre Filter Tabs
  filterTabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
    justifyContent: 'center'
  },
  filterTabBtn: {
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 24,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  filterTabBtnActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#d97706',
    shadowColor: '#d97706',
    shadowOpacity: 0.25
  },
  filterTabBtnText: {
    color: '#475569',
    fontSize: 12.5,
    fontWeight: '700'
  },
  filterTabBtnTextActive: {
    color: '#ffffff',
    fontWeight: '900'
  },

  // Match Cards (Clean Crisp White Theme with Rich Color Accents)
  matchCard: {
    flex: 1,
    minWidth: 290,
    maxWidth: 620,
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderTopWidth: 4,
    borderTopColor: '#94a3b8',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    justifyContent: 'space-between',
    marginBottom: 8
  },
  matchCardLive: {
    borderTopColor: '#ef4444',
    borderColor: '#fca5a5',
    shadowColor: '#ef4444',
    shadowOpacity: 0.12
  },
  matchCardUpcoming: {
    borderTopColor: '#3b82f6',
    borderColor: '#bfdbfe',
    shadowColor: '#3b82f6',
    shadowOpacity: 0.1
  },
  matchCardResult: {
    borderTopColor: '#10b981',
    borderColor: '#a7f3d0',
    shadowColor: '#10b981',
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
    borderBottomColor: '#f1f5f9'
  },
  liveIndicatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    borderRadius: 20,
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

  // Official TNCA Match Centre Button (#0e184e Deep Navy)
  tncaMatchCentreCardBtn: {
    backgroundColor: '#0e184e',
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#0e184e',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  tncaMatchCentreCardBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // TNCA Media Sub-Nav Row (Image 1 Style: [ 📰 News ] [ 📷 Photos ] ── See More >)
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

  // Tournaments Section
  tournamentCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderTopWidth: 4,
    borderTopColor: '#f59e0b',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3
  },
  tBadgeWrap: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8
  },
  badgeGoldPill: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    borderWidth: 1,
    color: '#b45309',
    fontSize: 10.5,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 10
  },
  badgeBluePill: {
    backgroundColor: '#fef9c3',
    borderColor: '#fef08a',
    borderWidth: 1,
    color: '#854d0e',
    fontSize: 10.5,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 10
  },
  badgeRedPill: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    color: '#b91c1c',
    fontSize: 10.5,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 10
  },
  badgeGreenPill: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
    borderWidth: 1,
    color: '#15803d',
    fontSize: 10.5,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 10
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

  // Points & Performance Tables
  subTabsScroll: {
    marginBottom: 12
  },
  switchTabBtn: {
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8
  },
  switchTabBtnActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#d97706'
  },
  switchTabBtnText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700'
  },
  switchTabBtnTextActive: {
    color: '#ffffff',
    fontWeight: '900'
  },
  tableBox: {
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 14,
    padding: 8,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
    backgroundColor: '#fffdf5'
  },
  tableTh: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 4
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  tableRowQualified: {
    backgroundColor: '#fefce8'
  },
  tableTd: {
    color: '#0f172a',
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

  // Performance Records
  perfTabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12
  },
  perfTabBtn: {
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6
  },
  perfTabBtnActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#d97706'
  },
  perfTabBtnText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700'
  },
  perfTabBtnTextActive: {
    color: '#ffffff',
    fontWeight: '900'
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
    borderColor: '#fde68a',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  playerSearchInput: {
    flex: 1,
    color: '#0f172a',
    fontSize: 13,
    paddingHorizontal: 8
  },
  playerPillBtn: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8
  },
  playerPillBtnActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#d97706'
  },
  playerPillBtnText: {
    color: '#475569',
    fontSize: 11.5,
    fontWeight: '700'
  },
  playerPillBtnTextActive: {
    color: '#ffffff',
    fontWeight: '900'
  },
  specialRecordCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderTopWidth: 4,
    borderTopColor: '#f59e0b',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 14
  },
  recordBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12
  },
  recordBadgeLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
    flex: 1,
    marginRight: 6
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
  recordProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  recordAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2
  },
  recordAvatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900'
  },
  recordPlayerName: {
    color: '#0f172a',
    fontSize: 15.5,
    fontWeight: '800'
  },
  recordOfficialCheck: {
    color: '#15803d',
    fontSize: 11,
    fontWeight: '800'
  },
  recordTeamText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2
  },
  recordRoleBadge: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2
  },
  recordPerfBox: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12
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
  recordMatchVs: {
    color: '#475569',
    fontSize: 12,
    marginTop: 3,
    fontWeight: '500'
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
    color: '#64748b',
    fontSize: 11.5,
    fontWeight: '600'
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

  // Grounds & Facilities
  groundCard: {
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
  groundImg: {
    width: '100%',
    height: 150
  },
  groundBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#f59e0b',
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

  // Contact
  contactInfoCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3
  },
  contactFormCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3
  },
  contactCardTitle: {
    color: '#b45309',
    fontSize: 15,
    fontWeight: '800',
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
    paddingTop: 36,
    paddingBottom: 24
  },
  footerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    marginBottom: 24
  },
  footerColBrand: {
    flex: 1.5,
    minWidth: 260
  },
  footerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  footerLogo: {
    width: 44,
    height: 44
  },
  footerBrandTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800'
  },
  footerMotto: {
    color: '#f5c43d',
    fontSize: 11,
    fontStyle: 'italic'
  },
  footerDesc: {
    color: '#9bb0cf',
    fontSize: 11.5,
    lineHeight: 18,
    marginBottom: 10
  },
  footerAffilBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start'
  },
  footerAffilText: {
    color: '#fed966',
    fontSize: 10,
    fontWeight: '700'
  },
  footerCol: {
    flex: 1,
    minWidth: 150
  },
  footerColHeading: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.3)',
    paddingBottom: 4
  },
  footerLink: {
    color: '#9bb0cf',
    fontSize: 12,
    marginVertical: 4
  },
  footerBottom: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 16,
    alignItems: 'center'
  },
  copyrightText: {
    color: '#62799c',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 6
  },
  legalLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  legalLink: {
    color: '#9bb0cf',
    fontSize: 11
  },
  legalDot: {
    color: '#62799c',
    fontSize: 11
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
