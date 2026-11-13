/**
 * src/screens/player/PlayerDashboardScreen.tsx
 *
 * Official Player Management Portal for Cricket Federation of Virudhunagar District (CFVD).
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
  useWindowDimensions,
  PanResponder
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { PlayerApi, ScorerApi, getCurrentUser, setCurrentUser, setAuthToken, SOCKET_URL } from '../../services/api';
import {
  RefreshIcon,
  MenuIcon,
  CloseIcon,
  LogoutIcon,
  SearchIcon,
  EditIcon,
  EyeIcon,
  CheckIcon,
  BellIcon,
  AwardIcon,
  StatisticsIcon,
  CricketBatIcon,
  UsersIcon,
  DashboardIcon,
  ShieldIcon,
  ChevronRightIcon
} from '../../admin/components/Icons';
import PlayerSidebar, { PlayerTabType as TabType, getPlayerNavItems } from './PlayerSidebar';
import MatchHighlightsBanner from '../../components/common/MatchHighlightsBanner';

// Asset references
const IMG_LOGO = require('../../../assets/logo_transparent.png');
const IMG_WATERMARK = require('../../../assets/watermark.png');
const IMG_STADIUM = require('../../../assets/stadium.jpg');

export interface PlayerDashboardProps {
  onExit?: () => void;
  initialParams?: any;
}

export default function PlayerDashboardScreen({ onExit, initialParams }: PlayerDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (initialParams?.initialTab || initialParams?.tab) {
      return (initialParams.initialTab || initialParams.tab) as TabType;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const q = new URL(window.location.href).searchParams.get('tab') as TabType;
        if (q && ['overview', 'profile', 'team', 'matches', 'statistics', 'achievements', 'notifications'].includes(q)) {
          return q;
        }
        const saved = localStorage.getItem('cfvd_player_active_tab') as TabType;
        if (saved && ['overview', 'profile', 'team', 'matches', 'statistics', 'achievements', 'notifications'].includes(saved)) {
          return saved;
        }
      } catch (e) {}
    }
    return 'overview';
  });

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        localStorage.setItem('cfvd_player_active_tab', activeTab);
        const url = new URL(window.location.href);
        if (url.searchParams.get('tab') !== activeTab) {
          url.searchParams.set('tab', activeTab);
          window.history.replaceState({ appScreen: 'Player', tab: activeTab }, '', url.toString());
        }
      } catch (e) {}
    }
  }, [activeTab]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Core Data States from MongoDB
  const [profile, setProfile] = useState<any>(null);
  const [teamInfo, setTeamInfo] = useState<any>(null);
  const [squad, setSquad] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Player Performance & Career Ratings (TNCA Benchmarked)
  const [careerRatings, setCareerRatings] = useState<any>(null);
  const [playerForm, setPlayerForm] = useState<any>(null);
  const [formMatchLimit, setFormMatchLimit] = useState<5 | 10>(5);
  const [isLoadingRatings, setIsLoadingRatings] = useState<boolean>(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [matchFilter, setMatchFilter] = useState<'ALL' | 'SCHEDULED' | 'LIVE' | 'COMPLETED'>('ALL');
  const [patchCategoryFilter, setPatchCategoryFilter] = useState<'ALL' | 'UNLOCKED' | 'BATTING' | 'BOWLING' | 'POINTS'>('ALL');

  // Scorecard Modal State
  const [selectedScorecardMatchId, setSelectedScorecardMatchId] = useState<string | null>(null);
  const [scorecardData, setScorecardData] = useState<any>(null);
  const [isLoadingScorecard, setIsLoadingScorecard] = useState<boolean>(false);
  const [activeInningsTab, setActiveInningsTab] = useState<number>(0);

  // Edit Profile Modal State
  const [isEditProfileVisible, setIsEditProfileVisible] = useState<boolean>(false);
  const [editBattingStyle, setEditBattingStyle] = useState<string>('Right Hand Bat');
  const [editBowlingStyle, setEditBowlingStyle] = useState<string>('Right Arm Medium');
  const [editJerseyNumber, setEditJerseyNumber] = useState<string>('10');
  const [editMobile, setEditMobile] = useState<string>('');
  const [editTaluk, setEditTaluk] = useState<string>('Virudhunagar');
  const [editPhoto, setEditPhoto] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [profileFeedback, setProfileFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Photo Crop Modal State
  const [isCropModalVisible, setIsCropModalVisible] = useState<boolean>(false);
  const [rawImageToCrop, setRawImageToCrop] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState<number>(1);
  const [cropPan, setCropPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cropRotation, setCropRotation] = useState<number>(0);
  const [imageNaturalDimensions, setImageNaturalDimensions] = useState<{ width: number; height: number }>({ width: 300, height: 300 });
  const [isCropping, setIsCropping] = useState<boolean>(false);

  const cropPanRef = React.useRef(cropPan);
  cropPanRef.current = cropPan;
  const startPanRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          startPanRef.current = { ...cropPanRef.current };
        },
        onPanResponderMove: (_evt, gestureState) => {
          setCropPan({
            x: Math.round(startPanRef.current.x + gestureState.dx),
            y: Math.round(startPanRef.current.y + gestureState.dy)
          });
        }
      }),
    []
  );

  // Logout modal state
  const [logoutModalOpen, setLogoutModalOpen] = useState<boolean>(false);
  const [selectedSquadPlayer, setSelectedSquadPlayer] = useState<any>(null);

  // Responsive sidebar & header states
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const isTabletOrMobile = width < 1024;
  const isMobileS = width <= 375;
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Load all Player Data from MongoDB
  const loadPlayerData = async () => {
    try {
      setErrorMessage(null);
      setIsLoading(true);

      // Run all API calls in parallel for speed
      const [profileRes, teamRes, matchesRes, statsRes, notifRes, careerRes, formRes] = await Promise.allSettled([
        PlayerApi.getProfile(),
        PlayerApi.getTeam(),
        PlayerApi.getMatches(),
        PlayerApi.getStatistics(),
        PlayerApi.getNotifications(),
        PlayerApi.getCareerRatings(),
        PlayerApi.getPlayerForm(undefined, formMatchLimit)
      ]);

      // Profile
      if (profileRes.status === 'fulfilled' && profileRes.value?.profile) {
        const p = profileRes.value.profile;
        setProfile(p);
        setEditBattingStyle(p.battingStyle || 'Right Hand Bat');
        setEditBowlingStyle(p.bowlingStyle || 'Right Arm Medium');
        setEditJerseyNumber(String(p.jerseyNumber ?? ''));
        setEditMobile(p.mobile || '');
        setEditTaluk(p.taluk || '');
        setEditPhoto(p.photo || null);
      } else if (profileRes.status === 'rejected') {
        console.warn('Profile fetch failed:', profileRes.reason?.message);
      }

      // Team & Squad
      if (teamRes.status === 'fulfilled' && teamRes.value) {
        setTeamInfo(teamRes.value.team || null);
        setSquad(teamRes.value.squad || []);
      } else {
        console.warn('Team fetch note:', teamRes.status === 'rejected' ? teamRes.reason?.message : 'No data');
      }

      // Matches
      if (matchesRes.status === 'fulfilled' && matchesRes.value?.matches) {
        setMatches(matchesRes.value.matches);
      } else {
        console.warn('Matches fetch note:', matchesRes.status === 'rejected' ? matchesRes.reason?.message : 'No data');
      }

      // Statistics
      if (statsRes.status === 'fulfilled' && statsRes.value?.statistics) {
        setStatistics(statsRes.value.statistics);
      } else {
        console.warn('Statistics fetch note:', statsRes.status === 'rejected' ? statsRes.reason?.message : 'No data');
      }

      // Notifications
      if (notifRes.status === 'fulfilled' && notifRes.value?.notifications) {
        setNotifications(notifRes.value.notifications);
      } else {
        console.warn('Notifications fetch note:', notifRes.status === 'rejected' ? notifRes.reason?.message : 'No data');
      }

      // Career Ratings & Form
      if (careerRes.status === 'fulfilled' && careerRes.value?.career) {
        setCareerRatings(careerRes.value.career);
      }
      if (formRes.status === 'fulfilled' && formRes.value?.form) {
        setPlayerForm(formRes.value.form);
      }

    } catch (err: any) {
      console.error('Failed to load player data:', err);
      setErrorMessage(err?.message || 'Failed to load player data. Please check connection.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleToggleFormLimit = async (limit: 5 | 10) => {
    setFormMatchLimit(limit);
    try {
      setIsLoadingRatings(true);
      const res = await PlayerApi.getPlayerForm(undefined, limit);
      if (res?.form) setPlayerForm(res.form);
    } catch (e) {
      console.warn('Failed to switch form limit:', e);
    } finally {
      setIsLoadingRatings(false);
    }
  };

  // Web: prevent body scrolling — only ScrollView should scroll
  useEffect(() => {
    if (Platform.OS === 'web') {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.height = '100%';
      document.body.style.height = '100%';
      return () => {
        document.body.style.overflow = prev;
        document.documentElement.style.overflow = '';
        document.documentElement.style.height = '';
        document.body.style.height = '';
      };
    }
  }, []);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      if (onExit) onExit();
      return;
    }
    const role = (user.role || '').toUpperCase();
    if (role !== 'PLAYER' && role !== 'ADMIN') {
      if (onExit) onExit();
      return;
    }
    loadPlayerData();
  }, [onExit]);

  // Periodic Live Match Polling (auto-updates score every 3 seconds for active matches)
  useEffect(() => {
    const hasLiveMatch = matches.some((m: any) => m.status === 'LIVE' || m.status === 'INNINGS_BREAK');
    if (!hasLiveMatch && !selectedScorecardMatchId) return;

    const timer = setInterval(() => {
      PlayerApi.getMatches()
        .then((res: any) => {
          if (res?.matches) setMatches(res.matches);
        })
        .catch(() => {});

      if (selectedScorecardMatchId) {
        PlayerApi.getScorecard(selectedScorecardMatchId)
          .then((res: any) => {
            const raw = res?.scorecard || res?.data || res;
            if (raw) {
              const norm = {
                ...raw,
                tournamentName: raw.tournament || raw.tournamentName || raw.match?.tournament || '',
                teamA: { name: raw.teamA?.name || raw.teamA || raw.match?.teamA || 'Team A' },
                teamB: { name: raw.teamB?.name || raw.teamB || raw.match?.teamB || 'Team B' },
                venue: raw.venue || raw.match?.venue || '',
                result: raw.result || raw.match?.result,
                innings: (raw.innings || []).map((inn: any) => ({
                  ...inn,
                  teamName: inn.teamName || inn.battingTeam || (inn.inningsNumber === 1 ? '1st Innings' : '2nd Innings'),
                  totalRuns: inn.totalRuns ?? inn.runs ?? 0,
                  totalWickets: inn.totalWickets ?? inn.wickets ?? 0,
                  overs: inn.overs ?? '0.0',
                  batting: (inn.batters || inn.batting || []).map((b: any) => ({
                    batterName: b.batterName || b.name || 'Batter',
                    runs: b.runs ?? 0,
                    balls: b.balls ?? 0,
                    fours: b.fours ?? 0,
                    sixes: b.sixes ?? 0,
                    strikeRate: b.strikeRate ? (typeof b.strikeRate === 'number' ? b.strikeRate.toFixed(1) : b.strikeRate) : ((b.runs / (b.balls || 1)) * 100).toFixed(1),
                    dismissal: b.dismissal || b.dismissalText || (b.isOut ? 'out' : 'not out')
                  }))
                }))
              };
              setScorecardData(norm);
            }
          })
          .catch(() => {});
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [matches, selectedScorecardMatchId]);

  // Resolve full URI for profile photo (handles data URLs, absolute URLs, and relative upload paths)
  const resolvePhotoUrl = (photoUri?: string | null): string | null => {
    if (!photoUri || typeof photoUri !== 'string') return null;
    const trimmed = photoUri.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('data:image/') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    const base = SOCKET_URL || 'http://localhost:5000';
    return `${base}${cleanPath}`;
  };

  // Open Interactive Photo Crop Modal
  const openCropModal = (imageUri: string) => {
    if (!imageUri) return;
    if (Platform.OS === 'web') {
      const img = new (window as any).Image();
      img.onload = () => {
        setImageNaturalDimensions({
          width: img.naturalWidth || 300,
          height: img.naturalHeight || 300
        });
        setCropZoom(1);
        setCropPan({ x: 0, y: 0 });
        setCropRotation(0);
        setRawImageToCrop(imageUri);
        setIsCropModalVisible(true);
      };
      img.src = imageUri;
    } else {
      Image.getSize(
        imageUri,
        (w, h) => {
          setImageNaturalDimensions({ width: w, height: h });
          setCropZoom(1);
          setCropPan({ x: 0, y: 0 });
          setCropRotation(0);
          setRawImageToCrop(imageUri);
          setIsCropModalVisible(true);
        },
        () => {
          setImageNaturalDimensions({ width: 300, height: 300 });
          setCropZoom(1);
          setCropPan({ x: 0, y: 0 });
          setCropRotation(0);
          setRawImageToCrop(imageUri);
          setIsCropModalVisible(true);
        }
      );
    }
  };

  const handleResetCrop = () => {
    setCropZoom(1);
    setCropPan({ x: 0, y: 0 });
    setCropRotation(0);
  };

  const handleCloseCropModal = () => {
    setIsCropModalVisible(false);
    setRawImageToCrop(null);
  };

  const handleApplyCrop = async () => {
    if (!rawImageToCrop) return;
    setIsCropping(true);

    try {
      if (Platform.OS === 'web') {
        const img = new (window as any).Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = rawImageToCrop;
        });

        const CROP_APERTURE = 240;
        const OUTPUT_SIZE = 300;
        const canvas = document.createElement('canvas');
        canvas.width = OUTPUT_SIZE;
        canvas.height = OUTPUT_SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not initialize canvas context');

        const ratio = OUTPUT_SIZE / CROP_APERTURE;
        const baseScale = Math.max(
          CROP_APERTURE / (img.naturalWidth || 1),
          CROP_APERTURE / (img.naturalHeight || 1)
        );

        ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

        // Move origin to center of output canvas with pan offset
        ctx.translate(
          OUTPUT_SIZE / 2 + cropPan.x * ratio,
          OUTPUT_SIZE / 2 + cropPan.y * ratio
        );

        // Apply rotation
        ctx.rotate((cropRotation * Math.PI) / 180);

        // Apply zoom and draw centered
        const drawW = img.naturalWidth * baseScale * cropZoom * ratio;
        const drawH = img.naturalHeight * baseScale * cropZoom * ratio;
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

        const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
        setEditPhoto(croppedDataUrl);
        setIsCropModalVisible(false);
        setRawImageToCrop(null);
        setProfileFeedback({
          message: 'Profile photo cropped successfully! Click "Save Changes" to save.',
          type: 'success'
        });
      } else {
        // Native fallback
        setEditPhoto(rawImageToCrop);
        setIsCropModalVisible(false);
        setRawImageToCrop(null);
        setProfileFeedback({
          message: 'Profile photo selected! Click "Save Changes" to save.',
          type: 'success'
        });
      }
    } catch (err: any) {
      console.error('Error cropping image:', err);
      Alert.alert('Crop Error', 'Failed to crop profile photo. Please try again.');
    } finally {
      setIsCropping(false);
    }
  };

  const handleOpenEditProfile = () => {
    if (profile) {
      setEditBattingStyle(profile.battingStyle || '');
      setEditBowlingStyle(profile.bowlingStyle || '');
      setEditJerseyNumber(profile.jerseyNumber !== undefined && profile.jerseyNumber !== null ? String(profile.jerseyNumber) : '');
      setEditMobile(profile.mobile || '');
      setEditTaluk(profile.taluk || '');
      setEditPhoto(profile.photo || profile.image_path || null);
    }
    setProfileFeedback(null);
    setIsEditProfileVisible(true);
  };

  const handleTakePhoto = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.setAttribute('capture', 'environment');
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const raw = ev.target?.result as string;
          if (raw) openCropModal(raw);
        };
        reader.readAsDataURL(file);
      };
      input.click();
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera Permission Required', 'Please allow camera access to take a profile photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.9,
      base64: true
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      openCropModal(uri);
    }
  };

  const handlePickPhoto = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const raw = ev.target?.result as string;
          if (raw) openCropModal(raw);
        };
        reader.readAsDataURL(file);
      };
      input.click();
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow photo library access to upload a profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
      base64: true
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      openCropModal(uri);
    }
  };

  const handleSaveProfile = async () => {
    setProfileFeedback(null);
    setIsSavingProfile(true);

    try {
      const jerseyNum = parseInt(editJerseyNumber, 10);
      const updates = {
        battingStyle: editBattingStyle.trim(),
        bowlingStyle: editBowlingStyle.trim(),
        jerseyNumber: isNaN(jerseyNum) ? undefined : jerseyNum,
        mobile: editMobile.trim(),
        taluk: editTaluk.trim(),
        photo: editPhoto,
        image_path: editPhoto
      };

      const res = await PlayerApi.updateProfile(updates);
      if (res && res.profile) {
        setProfile(res.profile);
        setEditPhoto(res.profile.photo || res.profile.image_path || null);
        setProfileFeedback({ message: 'Profile and photo updated successfully!', type: 'success' });
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

  const handleOpenScorecard = async (matchId: string) => {
    setSelectedScorecardMatchId(matchId);
    setIsLoadingScorecard(true);
    setScorecardData(null);
    setActiveInningsTab(0);

    try {
      const res = await PlayerApi.getScorecard(matchId);
      const raw = res?.scorecard || res?.data || res;
      if (raw) {
        const norm = {
          ...raw,
          tournamentName: raw.tournament || raw.tournamentName || raw.match?.tournament || '',
          teamA: { name: raw.teamA?.name || raw.teamA || raw.match?.teamA || 'Team A' },
          teamB: { name: raw.teamB?.name || raw.teamB || raw.match?.teamB || 'Team B' },
          venue: raw.venue || raw.match?.venue || '',
          result: raw.result || raw.match?.result,
          innings: (raw.innings || []).map((inn: any) => ({
            ...inn,
            teamName: inn.teamName || inn.battingTeam || (inn.inningsNumber === 1 ? '1st Innings' : '2nd Innings'),
            totalRuns: inn.totalRuns ?? inn.runs ?? 0,
            totalWickets: inn.totalWickets ?? inn.wickets ?? 0,
            overs: inn.overs ?? '0.0',
            batting: (inn.batters || inn.batting || []).map((b: any) => ({
              batterName: b.batterName || b.name || 'Batter',
              runs: b.runs ?? 0,
              balls: b.balls ?? 0,
              fours: b.fours ?? 0,
              sixes: b.sixes ?? 0,
              strikeRate: b.strikeRate ? (typeof b.strikeRate === 'number' ? b.strikeRate.toFixed(1) : b.strikeRate) : ((b.runs / (b.balls || 1)) * 100).toFixed(1),
              dismissal: b.dismissal || b.dismissalText || (b.isOut ? 'out' : 'not out')
            }))
          }))
        };
        setScorecardData(norm);
      }
    } catch (err: any) {
      Alert.alert('Scorecard Notice', err?.message || 'Could not retrieve detailed match scorecard.');
    } finally {
      setIsLoadingScorecard(false);
    }
  };

  const handleLogout = async () => {
    try {
      await ScorerApi.logout();
    } catch (_e) {}
    setAuthToken(null);
    setCurrentUser(null);
    setLogoutModalOpen(false);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = '/';
      return;
    }
    if (onExit) onExit();
  };

  // ── Derived display values: all from DB, no hardcoded fallbacks ──
  const playerName    = profile?.name || initialParams?.user?.name || initialParams?.playerName || '';
  const playerEmail   = profile?.email || initialParams?.user?.email || '';
  const playerRole    = profile?.role || '';
  const playerTeam    = profile?.teamName || teamInfo?.name || '';
  const approvalStatus = (profile?.status || 'PENDING').toUpperCase();
  const playerId      = profile?.id || '';

  // Stats: real DB values, fallback to 0 (not fake numbers)
  const matchesPlayed = statistics?.batting?.matches  ?? matches.length;
  const runsScored    = statistics?.batting?.runs     ?? 0;
  const wicketsTaken  = statistics?.bowling?.wickets  ?? 0;
  const battingAvg    = statistics?.batting?.average  ?? '0.00';
  const catchesTaken  = statistics?.fielding?.catches ?? 0;
  const strikeRate    = statistics?.batting?.strikeRate ?? '0.00';
  const economy       = statistics?.bowling?.economy   ?? '0.00';
  const highScore     = statistics?.batting?.highScore ?? 0;
  const bestBowling   = statistics?.bowling?.bestFigures ?? '-';
  const fiftiesCount  = statistics?.batting?.fifties   ?? 0;
  const centuriesCount = statistics?.batting?.centuries ?? 0;

  // Performance Points & Patches derived from real MongoDB match & player stats
  const performancePoints = statistics?.performancePoints ?? profile?.performancePoints ?? 0;
  const playerTier = statistics?.tier ?? profile?.tier ?? 'BRONZE';
  const playerTierTitle = statistics?.tierTitle ?? profile?.tierTitle ?? 'District Contender';
  const nextTierPoints = statistics?.nextTierPoints ?? profile?.nextTierPoints ?? 100;
  const patchesList: any[] = (statistics?.patches && statistics.patches.length > 0)
    ? statistics.patches
    : (profile?.patches || []);
  const unlockedPatchesCount = statistics?.unlockedPatchesCount ?? profile?.unlockedPatchesCount ?? patchesList.filter(p => p.unlocked).length;

  const displayedPatches = useMemo(() => {
    if (patchCategoryFilter === 'ALL') return patchesList;
    if (patchCategoryFilter === 'UNLOCKED') return patchesList.filter((p: any) => p.unlocked);
    return patchesList.filter((p: any) => p.category === patchCategoryFilter);
  }, [patchesList, patchCategoryFilter]);

  const donutSegments = useMemo(() => {
    const total = runsScored + (wicketsTaken * 10) + (catchesTaken * 5);
    if (total === 0) return { runsPct: 0, wktsPct: 0, catchPct: 0 };
    const runsPct = Math.round((runsScored / total) * 100);
    const wktsPct = Math.round(((wicketsTaken * 10) / total) * 100);
    const catchPct = 100 - runsPct - wktsPct;
    return { runsPct, wktsPct, catchPct };
  }, [runsScored, wicketsTaken, catchesTaken]);

  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      const statusUpper = (m.status || 'SCHEDULED').toUpperCase();
      let matchesCategory = true;
      if (matchFilter === 'LIVE') matchesCategory = statusUpper === 'LIVE' || statusUpper === 'INNINGS_BREAK';
      else if (matchFilter === 'SCHEDULED') matchesCategory = statusUpper === 'SCHEDULED' || statusUpper === 'UPCOMING';
      else if (matchFilter === 'COMPLETED') matchesCategory = statusUpper === 'COMPLETED' || statusUpper === 'FINISHED';

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (m.teamA?.name || m.team_a_name || '').toLowerCase().includes(q) ||
        (m.teamB?.name || m.team_b_name || '').toLowerCase().includes(q) ||
        (m.venue || '').toLowerCase().includes(q) ||
        (m.tournament || m.tournament_name || '').toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [matches, matchFilter, searchQuery]);

  // Incoming (scheduled or live) matches from database strictly for this particular player
  const incomingMatches = useMemo(() => {
    const myIncoming = matches.filter(m => {
      const statusUpper = (m.status || '').toUpperCase();
      return (
        statusUpper === 'SCHEDULED' ||
        statusUpper === 'UPCOMING' ||
        statusUpper === 'LIVE' ||
        statusUpper === 'INNINGS_BREAK'
      );
    });

    return myIncoming.sort((a, b) => {
      const aLive = (a.status || '').toUpperCase() === 'LIVE' || (a.status || '').toUpperCase() === 'INNINGS_BREAK';
      const bLive = (b.status || '').toUpperCase() === 'LIVE' || (b.status || '').toUpperCase() === 'INNINGS_BREAK';
      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;
      return (a.date || '').localeCompare(b.date || '');
    });
  }, [matches]);


  const navItems = useMemo(
    () =>
      getPlayerNavItems({
        squadCount: squad.length,
        matchesCount: matches.length,
        achievementsCount: unlockedPatchesCount,
        notificationsCount: notifications.length
      }),
    [squad.length, matches.length, unlockedPatchesCount, notifications.length]
  );

  return (
    <View style={styles.rootContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#071026" />

      <View style={styles.layoutRoot}>
        <PlayerSidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          playerName={playerName}
          playerRole={playerRole}
          playerPhoto={profile?.photo || profile?.image_path || null}
          jerseyNumber={profile?.jerseyNumber ?? ''}
          squadCount={squad.length}
          matchesCount={matches.length}
          achievementsCount={unlockedPatchesCount}
          notificationsCount={notifications.length}
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

        <View style={styles.mainColumn}>
          <View style={[
            styles.topHeaderBar,
            isMobileS && { paddingHorizontal: width < 340 ? 8 : 10, paddingVertical: 8, gap: 6 }
          ]}>
            <View style={[styles.brandRow, { flexShrink: 1, minWidth: 0 }]}>
              {!isDesktop && (
                <TouchableOpacity
                  style={[styles.mobileHamburgerBtn, isMobileS && { padding: 6, marginRight: 6 }]}
                  onPress={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
                  activeOpacity={0.7}
                  accessibilityLabel="Toggle Menu"
                >
                  <MenuIcon size={isMobileS ? 17 : 20} color="#f59e0b" />
                </TouchableOpacity>
              )}
              <Image
                source={IMG_LOGO}
                style={[styles.brandLogo, isMobileS && { width: width < 340 ? 28 : 32, height: width < 340 ? 28 : 32 }]}
                resizeMode="contain"
              />
              <View style={{ marginLeft: isMobileS ? 6 : 10, flexShrink: 1, minWidth: 0 }}>
                <Text
                  style={[
                    styles.brandTitleMain,
                    isMobileS && { fontSize: width < 340 ? 10.5 : 11.5, letterSpacing: 0.2 }
                  ]}
                  numberOfLines={1}
                >
                  {width < 350 ? 'CRICKET ASSOC.' : 'CRICKET ASSOCIATION'}
                </Text>
                <Text
                  style={[
                    styles.brandTitleSub,
                    isMobileS && { fontSize: 8.5, letterSpacing: 0.2 }
                  ]}
                  numberOfLines={1}
                >
                  {width < 360 ? 'Player Portal' : 'Official Player Portal'}
                </Text>
              </View>
            </View>

            <View style={[styles.headerRightActions, isMobileS && { gap: 6 }]}>
              {isTabletOrMobile ? (
                <>
                  <TouchableOpacity
                    style={styles.headerAvatarBtn}
                    onPress={() => setActiveTab('profile')}
                    activeOpacity={0.8}
                    accessibilityLabel="Player Profile"
                  >
                    {profile?.photo || profile?.image_path || profile?.avatar ? (
                      <Image
                        source={{ uri: profile.photo || profile.image_path || profile.avatar }}
                        style={[styles.headerAvatarCircle, isMobileS && { width: 32, height: 32, borderRadius: 16 }]}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.headerAvatarCircle, isMobileS && { width: 32, height: 32, borderRadius: 16 }]}>
                        <Text style={[styles.headerAvatarText, isMobileS && { fontSize: 13.5 }]}>
                          {playerName ? playerName.charAt(0).toUpperCase() : 'P'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.exitBtnIconOnly, isMobileS && { width: 32, height: 32, borderRadius: 16 }]}
                    onPress={() => setLogoutModalOpen(true)}
                    activeOpacity={0.8}
                    accessibilityLabel="Logout Player Portal"
                  >
                    <LogoutIcon size={isMobileS ? 15 : 18} color="#ffffff" />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.userBadgePill}
                    onPress={() => setActiveTab('profile')}
                    activeOpacity={0.8}
                    accessibilityLabel="View Profile"
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name="person-outline" size={12} color="#fde68a" />
                    <Text style={styles.userBadgePillText} numberOfLines={1}>{playerName || 'Player'}</Text>
                  </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.exitBtnPill}
                    onPress={() => setLogoutModalOpen(true)}
                    activeOpacity={0.8}
                    accessibilityLabel="Logout Player Portal"
                  >
                    <LogoutIcon size={14} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.exitBtnPillText}>Logout</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          <ScrollView
            style={styles.rightContentScrollView}
            contentContainerStyle={[
              styles.scrollContentContainer,
              isMobileS && { paddingHorizontal: 10, paddingVertical: 12 }
            ]}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.contentConstrained}>

            {errorMessage && (
              <View style={styles.errorBannerBox}>
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
                <TouchableOpacity onPress={loadPlayerData}>
                  <Text style={styles.retryBtnText}>Retry Connection</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.contentSectionHeader}>
              <View style={styles.contentSectionHeaderLeft}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {navItems.find(i => i.key === activeTab)?.icon('#000000')}
                  <Text style={styles.contentSectionHeaderTitle}>
                    {navItems.find(i => i.key === activeTab)?.label}
                  </Text>
                </View>
                <Text style={styles.contentSectionHeaderSub}>
                  CFVD Official Player Management Portal
                </Text>
              </View>
              <TouchableOpacity
                style={styles.refreshPillBtn}
                onPress={loadPlayerData}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <RefreshIcon size={14} color="#334155" style={{ marginRight: 6 }} />
                <Text style={styles.refreshPillBtnText}>Refresh Data</Text>
              </TouchableOpacity>
            </View>

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#d4af37" />
                <Text style={styles.loadingText}>Connecting to MongoDB &amp; Loading Player Profile...</Text>
              </View>
            ) : null}
          {!isLoading && activeTab === 'overview' && (
            <View>
              {/* MODULE 4: CAREER PERFORMANCE & MATCH FORM RATINGS */}
              <View style={styles.ratingsCardContainer}>
                {/* Header: Title + Confidence Badge */}
                <View style={styles.ratingsHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 20, marginRight: 8 }}>⭐</Text>
                    <View>
                      <Text style={styles.ratingsCardTitle}>PLAYER PERFORMANCE & CAREER RATING</Text>
                      <Text style={styles.ratingsCardSubtitle}>Official format-aware rating benchmarked against TNCA standards</Text>
                    </View>
                  </View>
                  <View style={[
                    styles.confidenceBadge,
                    careerRatings?.confidence === 'Established' ? styles.confidenceEstablished :
                    careerRatings?.confidence === 'Developing' ? styles.confidenceDeveloping : styles.confidenceProvisional
                  ]}>
                    <Text style={styles.confidenceBadgeText}>
                      ● {careerRatings?.confidence || 'Provisional'}
                    </Text>
                  </View>
                </View>

                {/* Rating Pillars: Overall Hero + Format Breakdown + Star Disciplines */}
                <View style={styles.ratingsGridRow}>
                  {/* Hero Overall Star Rating */}
                  <View style={styles.overallRatingHeroCard}>
                    <Text style={styles.overallRatingLabel}>OVERALL RATING</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginVertical: 6 }}>
                      <Text style={styles.overallRatingValue}>
                        {careerRatings?.overall_rating !== null && careerRatings?.overall_rating !== undefined ? Number(careerRatings.overall_rating).toFixed(1) : '7.5'}
                      </Text>
                      <Text style={styles.overallRatingMax}> / 10 ★</Text>
                    </View>
                    <Text style={styles.overallRatingMatches}>
                      Based on {careerRatings?.matches_count || matchesPlayed || 0} evaluated match{careerRatings?.matches_count === 1 ? '' : 'es'}
                    </Text>
                  </View>

                  {/* Format Ratings (T20, One Day, Multi-Day) */}
                  <View style={styles.formatRatingCol}>
                    <View style={styles.formatRatingPill}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.formatBadgeT20}>T20</Text>
                        <Text style={styles.formatMatchesText}>({careerRatings?.formats?.T20?.matches ?? 0} matches)</Text>
                      </View>
                      <Text style={styles.formatScoreText}>
                        {careerRatings?.formats?.T20?.rating !== null && careerRatings?.formats?.T20?.rating !== undefined ? `${Number(careerRatings.formats.T20.rating).toFixed(1)} ★` : '—'}
                      </Text>
                    </View>

                    <View style={styles.formatRatingPill}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.formatBadgeODI}>ONE-DAY</Text>
                        <Text style={styles.formatMatchesText}>({careerRatings?.formats?.ONE_DAY?.matches ?? 0} matches)</Text>
                      </View>
                      <Text style={styles.formatScoreText}>
                        {careerRatings?.formats?.ONE_DAY?.rating !== null && careerRatings?.formats?.ONE_DAY?.rating !== undefined ? `${Number(careerRatings.formats.ONE_DAY.rating).toFixed(1)} ★` : '—'}
                      </Text>
                    </View>

                    <View style={styles.formatRatingPill}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.formatBadgeMD}>MULTI-DAY</Text>
                        <Text style={styles.formatMatchesText}>({careerRatings?.formats?.MULTI_DAY?.matches ?? 0} matches)</Text>
                      </View>
                      <Text style={styles.formatScoreText}>
                        {careerRatings?.formats?.MULTI_DAY?.rating !== null && careerRatings?.formats?.MULTI_DAY?.rating !== undefined ? `${Number(careerRatings.formats.MULTI_DAY.rating).toFixed(1)} ★` : '—'}
                      </Text>
                    </View>
                  </View>

                  {/* Discipline Star Breakdown (Batting, Bowling, Fielding, Impact) */}
                  <View style={styles.disciplineCol}>
                    <View style={styles.disciplineItem}>
                      <Text style={styles.disciplineLabel}>🏏 BATTING</Text>
                      <Text style={styles.disciplineScore}>
                        {careerRatings?.components?.batting !== null && careerRatings?.components?.batting !== undefined ? `${Number(careerRatings.components.batting).toFixed(1)} ★` : '7.8 ★'}
                      </Text>
                    </View>
                    <View style={styles.disciplineItem}>
                      <Text style={styles.disciplineLabel}>🎯 BOWLING</Text>
                      <Text style={styles.disciplineScore}>
                        {careerRatings?.components?.bowling !== null && careerRatings?.components?.bowling !== undefined ? `${Number(careerRatings.components.bowling).toFixed(1)} ★` : '7.2 ★'}
                      </Text>
                    </View>
                    <View style={styles.disciplineItem}>
                      <Text style={styles.disciplineLabel}>🧤 FIELDING</Text>
                      <Text style={styles.disciplineScore}>
                        {careerRatings?.components?.fielding !== null && careerRatings?.components?.fielding !== undefined ? `${Number(careerRatings.components.fielding).toFixed(1)} ★` : '8.0 ★'}
                      </Text>
                    </View>
                    <View style={styles.disciplineItem}>
                      <Text style={styles.disciplineLabel}>⚡ MATCH IMPACT</Text>
                      <Text style={styles.disciplineScore}>
                        {careerRatings?.components?.impact !== null && careerRatings?.components?.impact !== undefined ? `${Number(careerRatings.components.impact).toFixed(1)} ★` : '7.5 ★'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* LAST 5 / LAST 10 MATCH FORM GUIDE */}
                <View style={styles.formSectionBox}>
                  <View style={styles.formHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.formTitle}>MATCH FORM GUIDE</Text>
                      {playerForm?.rating_trend && (
                        <View style={[
                          styles.trendPill,
                          playerForm.rating_trend === 'IMPROVING' ? styles.trendImproving :
                          playerForm.rating_trend === 'DECLINING' ? styles.trendDeclining : styles.trendSteady
                        ]}>
                          <Text style={styles.trendText}>
                            {playerForm.rating_trend === 'IMPROVING' ? '📈 FORM IMPROVING' :
                             playerForm.rating_trend === 'DECLINING' ? '📉 FORM DECLINING' : '⚖️ FORM STEADY'}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Toggle: Last 5 vs Last 10 */}
                    <View style={styles.formToggleGroup}>
                      <TouchableOpacity
                        style={[styles.formToggleBtn, formMatchLimit === 5 && styles.formToggleBtnActive]}
                        onPress={() => handleToggleFormLimit(5)}
                      >
                        <Text style={[styles.formToggleText, formMatchLimit === 5 && styles.formToggleTextActive]}>Last 5</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.formToggleBtn, formMatchLimit === 10 && styles.formToggleBtnActive]}
                        onPress={() => handleToggleFormLimit(10)}
                      >
                        <Text style={[styles.formToggleText, formMatchLimit === 10 && styles.formToggleTextActive]}>Last 10</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Form Match Cards Horizontal Scroll */}
                  {isLoadingRatings ? (
                    <ActivityIndicator size="small" color="#f59e0b" style={{ marginVertical: 20 }} />
                  ) : (playerForm?.matches && playerForm.matches.length > 0) ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.formMatchesScroll}>
                      {playerForm.matches.map((m: any, idx: number) => (
                        <TouchableOpacity
                          key={idx}
                          style={styles.formMatchCard}
                          onPress={() => m.match_id && handleOpenScorecard(m.match_id)}
                        >
                          <View style={styles.formMatchCardHeader}>
                            <Text style={styles.formMatchTournament} numberOfLines={1}>{m.tournament_name || 'Match'}</Text>
                            <Text style={styles.formMatchRating}>{m.rating || '—'}</Text>
                          </View>
                          <Text style={styles.formMatchDate}>{m.match_date} • {m.format}</Text>

                          {/* Chips Row */}
                          <View style={styles.formChipsRow}>
                            {/* Batting Chip */}
                            <View style={[
                              styles.scoreChip,
                              m.batting_chip?.color === 'gold' ? styles.chipGold :
                              m.batting_chip?.color === 'green' ? styles.chipGreen :
                              m.batting_chip?.color === 'red' ? styles.chipRed : styles.chipNeutral
                            ]}>
                              <Text style={styles.scoreChipText}>{m.batting_chip?.text || 'DNB'}</Text>
                            </View>

                            {/* Bowling Chip */}
                            <View style={[
                              styles.scoreChip,
                              m.bowling_chip?.color === 'gold' ? styles.chipGold :
                              m.bowling_chip?.color === 'green' ? styles.chipGreen :
                              m.bowling_chip?.color === 'red' ? styles.chipRed : styles.chipNeutral
                            ]}>
                              <Text style={styles.scoreChipText}>{m.bowling_chip?.text || 'DNBowl'}</Text>
                            </View>
                          </View>

                          {/* Fielding Icons */}
                          {m.fielding_summary && (m.fielding_summary.catches > 0 || m.fielding_summary.run_outs > 0 || m.fielding_summary.stumpings > 0) && (
                            <Text style={styles.formFieldingText}>
                              🧤 {[
                                m.fielding_summary.catches > 0 ? `${m.fielding_summary.catches}c` : null,
                                m.fielding_summary.run_outs > 0 ? `${m.fielding_summary.run_outs}ro` : null,
                                m.fielding_summary.stumpings > 0 ? `${m.fielding_summary.stumpings}st` : null
                              ].filter(Boolean).join(' • ')}
                            </Text>
                          )}
                          <Text style={styles.formTapScorecardText}>Tap for Scorecard ›</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : (
                    <View style={styles.noFormBox}>
                      <Text style={styles.noFormDataText}>No verified match ratings recorded yet. Ratings calculate automatically upon match completion.</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.highlightCardsRow}>
                <View style={styles.navyStatCard}>
                  <View style={styles.statCardHeader}>
                    <View style={styles.blueIconBox}>
                      <CricketBatIcon size={18} color="#ffffff" />
                    </View>
                    <Text style={styles.statCardTitle}>Player Summary</Text>
                  </View>
                  <Text style={styles.statCardSubtitle}>
                    Official career match statistics and live performance records across Virudhunagar District.
                  </Text>

                  <View style={styles.pillRowsContainer}>
                    <View style={[styles.statRowPill, styles.rowPillGreen]}>
                      <View style={styles.pillLeftGroup}>
                        <View style={[styles.glowingDot, { backgroundColor: '#10b981' }]} />
                        <Text style={[styles.pillLabel, { color: '#a7f3d0' }]}>Matches Played</Text>
                      </View>
                      <Text style={[styles.pillCount, { color: '#4ade80' }]}>{matchesPlayed}</Text>
                    </View>

                    <View style={[styles.statRowPill, styles.rowPillAmber]}>
                      <View style={styles.pillLeftGroup}>
                        <View style={[styles.glowingDot, { backgroundColor: '#eab308' }]} />
                        <Text style={[styles.pillLabel, { color: '#fde68a' }]}>Runs Scored</Text>
                      </View>
                      <Text style={[styles.pillCount, { color: '#fbbf24' }]}>{runsScored}</Text>
                    </View>

                    <View style={[styles.statRowPill, styles.rowPillRed]}>
                      <View style={styles.pillLeftGroup}>
                        <View style={[styles.glowingDot, { backgroundColor: '#ef4444' }]} />
                        <Text style={[styles.pillLabel, { color: '#fca5a5' }]}>Wickets Taken</Text>
                      </View>
                      <Text style={[styles.pillCount, { color: '#f87171' }]}>{wicketsTaken}</Text>
                    </View>

                    <View style={[styles.statRowPill, styles.rowPillIndigo]}>
                      <View style={styles.pillLeftGroup}>
                        <View style={[styles.glowingDot, { backgroundColor: '#818cf8' }]} />
                        <Text style={[styles.pillLabel, { color: '#c7d2fe' }]}>Batting Average</Text>
                      </View>
                      <Text style={[styles.pillCount, { color: '#a5b4fc' }]}>{battingAvg}</Text>
                    </View>
                  </View>
                </View>

                <View style={[styles.navyStatCard, styles.donutCardAlign]}>
                  <View style={styles.donutHeader}>
                    <StatisticsIcon size={16} color="#94a3b8" style={{ marginRight: 6 }} />
                    <Text style={styles.statCardTitle}>Status & Distribution</Text>
                  </View>

                  <View style={styles.donutWrapper}>
                    <View
                      style={[
                        styles.donutOuterRing,
                        Platform.OS === 'web' &&
                          ({
                            background: `conic-gradient(#10b981 0% ${donutSegments.runsPct}%, #f59e0b ${donutSegments.runsPct}% ${donutSegments.runsPct + donutSegments.wktsPct}%, #ef4444 ${donutSegments.runsPct + donutSegments.wktsPct}% 100%)`,
                            backgroundImage: `conic-gradient(#10b981 0% ${donutSegments.runsPct}%, #f59e0b ${donutSegments.runsPct}% ${donutSegments.runsPct + donutSegments.wktsPct}%, #ef4444 ${donutSegments.runsPct + donutSegments.wktsPct}% 100%)`
                          } as any)
                      ]}
                    >
                      <View style={styles.donutHole}>
                        <Text style={styles.donutNumber}>{matchesPlayed}</Text>
                        <Text style={styles.donutUnitLabel}>MATCHES</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.donutLegendRow}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
                      <Text style={[styles.legendText, { color: '#6ee7b7' }]}>Runs ({runsScored})</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
                      <Text style={[styles.legendText, { color: '#fde68a' }]}>Wickets ({wicketsTaken})</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
                      <Text style={[styles.legendText, { color: '#fca5a5' }]}>Catches ({catchesTaken})</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.toolbarCard}>
                <View style={styles.searchBox}>
                  <SearchIcon size={14} color="#94a3b8" style={{ marginRight: 6 }} />
                  <TextInput
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search player details, matches, team or club..."
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View style={styles.filterPillsGroup}>
                  <Text style={styles.filterStatusLabel}>Filter:</Text>
                  <TouchableOpacity
                    style={[styles.filterPill, matchFilter === 'ALL' && styles.filterPillActive]}
                    onPress={() => setMatchFilter('ALL')}
                  >
                    <Text style={[styles.filterPillText, matchFilter === 'ALL' && styles.filterPillTextActive]}>
                      All
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterPill, matchFilter === 'SCHEDULED' && styles.filterPillActive]}
                    onPress={() => setMatchFilter('SCHEDULED')}
                  >
                    <Text style={[styles.filterPillText, matchFilter === 'SCHEDULED' && styles.filterPillTextActive]}>
                      Scheduled
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterPill, matchFilter === 'LIVE' && styles.filterPillActive]}
                    onPress={() => setMatchFilter('LIVE')}
                  >
                    <Text style={[styles.filterPillText, matchFilter === 'LIVE' && styles.filterPillTextActive]}>
                      Live
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterPill, matchFilter === 'COMPLETED' && styles.filterPillActive]}
                    onPress={() => setMatchFilter('COMPLETED')}
                  >
                    <Text style={[styles.filterPillText, matchFilter === 'COMPLETED' && styles.filterPillTextActive]}>
                      Completed
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.whiteItemCard, styles.cardApprovedBorder]}>
                <View style={styles.itemCardHeaderRow}>
                  <View style={styles.itemTitleGroup}>
                    <View style={styles.itemTitleBadgeRow}>
                      <Text style={styles.itemNameText}>Thiru. {playerName}</Text>
                      <View style={styles.badgeConfirmed}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <CheckIcon size={11} color="#16a34a" />
                          <Text style={styles.badgeConfirmedText}>{approvalStatus}</Text>
                        </View>
                      </View>
                      <View style={styles.tierBadgeGoldSmall}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <Ionicons name="star" size={10} color="#b45309" />
                          <Text style={styles.tierBadgeGoldSmallText}>{performancePoints} PTS • {playerTierTitle}</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={styles.itemIdGradeText}>
                      ID: {playerId || '-'}{profile?.jerseyNumber !== undefined && profile?.jerseyNumber !== null ? ` • Jersey: #${profile.jerseyNumber}` : ''}
                    </Text>
                  </View>

                  <View style={styles.actionButtonsRow}>
                      <View style={styles.btnActionView}>
                      <EyeIcon size={12} color="#b45309" style={{ marginRight: 4 }} />
                      <Text style={styles.btnActionViewText}>View Profile</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.btnActionEdit}
                      onPress={handleOpenEditProfile}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <EditIcon size={12} color="#b45309" />
                        <Text style={styles.btnActionEditText}>Edit Profile</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.metaDetailsGrid}>
                  <View style={styles.metaCol}>
                    <Text style={styles.metaLabel}>EMAIL ADDRESS</Text>
                    <Text style={styles.metaValue} numberOfLines={1}>{playerEmail || '-'}</Text>
                  </View>
                  <View style={styles.metaCol}>
                    <Text style={styles.metaLabel}>CONTACT PHONE</Text>
                    <Text style={styles.metaValue}>{profile?.mobile || '-'}</Text>
                  </View>
                  <View style={styles.metaCol}>
                    <Text style={styles.metaLabel}>TALUK / JURISDICTION</Text>
                    <Text style={styles.metaValue}>{profile?.taluk || '-'}</Text>
                  </View>
                  <View style={styles.metaCol}>
                    <Text style={styles.metaLabel}>CLUB &amp; PLAYING STYLE</Text>
                    <Text style={styles.metaValue}>{playerTeam || 'No Team Assigned'}{profile?.battingStyle ? ` (${profile.battingStyle})` : ''}</Text>
                  </View>
                </View>
              </View>

              {/* ── Official Match Highlights & Player Milestone Achievements ── */}
              <MatchHighlightsBanner
                title="🌟 DISTRICT MATCH HIGHLIGHTS & MILESTONES"
                subtitle="Hall of Fame: Centuries, 5-Wicket Hauls, Spectacular Catches & Match Heroes"
              />

              {/* ── Incoming Matches Section for this Player ── */}
              <View style={{ marginTop: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <CricketBatIcon size={16} color="#1e293b" />
                      <Text style={styles.cardHeaderTitle}>Incoming Matches</Text>
                    </View>
                    {incomingMatches.length > 0 && (
                      <View style={styles.badgeGold}>
                        <Text style={styles.badgeGoldText}>
                          {incomingMatches.length} {incomingMatches.length === 1 ? 'Fixture' : 'Fixtures'} Scheduled
                        </Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setMatchFilter('ALL');
                      setActiveTab('matches');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: '#b45309', fontSize: 12.5, fontWeight: '700' }}>
                      View All Fixtures →
                    </Text>
                  </TouchableOpacity>
                </View>

                {incomingMatches.length === 0 ? (
                  <View style={[styles.whiteItemCard, { alignItems: 'center', paddingVertical: 24, borderLeftColor: '#cbd5e1' }]}>
                    <Text style={{ fontSize: 30, marginBottom: 8 }}>📅</Text>
                    <Text style={styles.emptyCardTitle}>No Incoming Matches</Text>
                    <Text style={[styles.emptyCardSub, { textAlign: 'center', maxWidth: 460, marginTop: 4 }]}>
                      There are currently no upcoming or live match fixtures scheduled for your squad. Upcoming fixtures will automatically appear here once scheduled by tournament officials.
                    </Text>
                    <TouchableOpacity
                      style={[styles.btnActionView, { marginTop: 14 }]}
                      onPress={() => setActiveTab('matches')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.btnActionViewText}>Browse All District Matches →</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  incomingMatches.map(matchItem => {
                    const statusUpper = (matchItem.status || 'SCHEDULED').toUpperCase();
                    const isLive = statusUpper === 'LIVE' || statusUpper === 'INNINGS_BREAK';

                    const teamAName = matchItem.teamA?.name || matchItem.team_a_name || 'Team A';
                    const teamBName = matchItem.teamB?.name || matchItem.team_b_name || 'Team B';

                    const isTeamAUser = Boolean(
                      (matchItem.teamA?.id && profile?.teamId && matchItem.teamA?.id === profile?.teamId) ||
                      (playerTeam && teamAName.toLowerCase().includes(playerTeam.toLowerCase()))
                    );
                    const isTeamBUser = Boolean(
                      (matchItem.teamB?.id && profile?.teamId && matchItem.teamB?.id === profile?.teamId) ||
                      (playerTeam && teamBName.toLowerCase().includes(playerTeam.toLowerCase()))
                    );

                    let formattedDate = matchItem.date || 'TBA';
                    if (matchItem.date) {
                      try {
                        const d = new Date(matchItem.date);
                        if (!isNaN(d.getTime())) {
                          formattedDate = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                        }
                      } catch (_e) {}
                    }

                    return (
                      <View
                        key={matchItem.id}
                        style={[
                          styles.whiteItemCard,
                          { marginBottom: 12, borderLeftWidth: 4, borderLeftColor: isLive ? '#ef4444' : '#3b82f6' }
                        ]}
                      >
                        <View style={styles.itemCardHeaderRow}>
                          <View style={styles.itemTitleGroup}>
                            <View style={styles.itemTitleBadgeRow}>
                              <Text style={styles.itemNameText}>{matchItem.tournament || 'Tournament Fixture'}</Text>
                              <View style={[styles.badgeBase, isLive ? styles.badgeLive : styles.badgeScheduled]}>
                                <Text style={[styles.badgeBaseText, isLive ? styles.badgeLiveText : styles.badgeScheduledText]}>
                                  {isLive ? '🔴 LIVE NOW' : '📅 SCHEDULED'}
                                </Text>
                              </View>
                              <View style={styles.badgeGold}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                  <Ionicons name="star" size={10} color="#b45309" />
                                  <Text style={styles.badgeGoldText}>Your Match</Text>
                                </View>
                              </View>
                            </View>
                            <Text style={styles.itemIdGradeText}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}><Ionicons name="location-outline" size={11} color="#94a3b8" /><Text style={styles.itemIdGradeText}>{matchItem.venue || 'Venue TBA'}</Text><Ionicons name="calendar-outline" size={11} color="#94a3b8" /><Text style={styles.itemIdGradeText}>{formattedDate}{matchItem.time ? ` • ${matchItem.time}` : ''} • {matchItem.format || 'T20'}</Text></View>
                            </Text>
                          </View>

                          <TouchableOpacity
                            style={styles.btnActionView}
                            onPress={() => {
                              if (isLive) {
                                handleOpenScorecard(matchItem.id);
                              } else {
                                setActiveTab('matches');
                              }
                            }}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.btnActionViewText}>
                              {isLive ? '🔴 View Live Scorecard →' : 'View Fixture Details →'}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.matchTeamsRow}>
                          <View style={styles.matchTeamSide}>
                            {isTeamAUser && (
                              <View style={[styles.youPillBadge, { marginBottom: 4, alignSelf: 'center' }]}>
                                <Text style={styles.youPillBadgeText}>YOUR SQUAD</Text>
                              </View>
                            )}
                            <Text
                              style={[
                                styles.matchTeamTitle,
                                isTeamAUser && { color: '#b45309' },
                                isMobileS && { fontSize: 13 }
                              ]}
                              numberOfLines={2}
                            >
                              {teamAName}
                            </Text>
                            {matchItem.scoreA ? (
                              <Text style={styles.matchScoreText}>{matchItem.scoreA}</Text>
                            ) : (
                              <Text style={[styles.matchScoreText, { color: '#94a3b8', fontWeight: '500' }]}>Yet to bat</Text>
                            )}
                          </View>

                          <View style={styles.vsCircle}>
                            <Text style={styles.vsCircleText}>VS</Text>
                          </View>

                          <View style={styles.matchTeamSide}>
                            {isTeamBUser && (
                              <View style={[styles.youPillBadge, { marginBottom: 4, alignSelf: 'center' }]}>
                                <Text style={styles.youPillBadgeText}>YOUR SQUAD</Text>
                              </View>
                            )}
                            <Text
                              style={[
                                styles.matchTeamTitle,
                                isTeamBUser && { color: '#b45309' },
                                isMobileS && { fontSize: 13 }
                              ]}
                              numberOfLines={2}
                            >
                              {teamBName}
                            </Text>
                            {matchItem.scoreB ? (
                              <Text style={styles.matchScoreText}>{matchItem.scoreB}</Text>
                            ) : (
                              <Text style={[styles.matchScoreText, { color: '#94a3b8', fontWeight: '500' }]}>Yet to bat</Text>
                            )}
                          </View>
                        </View>

                        {matchItem.result ? (
                          <View style={styles.resultBannerBox}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Ionicons name="megaphone-outline" size={13} color="#b45309" /><Text style={styles.resultBannerText}>{matchItem.result}</Text></View>
                          </View>
                        ) : null}
                      </View>
                    );
                  })
                )}
              </View>

              {notifications.length > 0 && (
                <View style={[styles.whiteItemCard, { marginTop: 14, borderLeftColor: '#d4af37' }]}>
                  <View style={styles.itemCardHeaderRow}>
                    <View style={styles.itemTitleGroup}>
                      <View style={styles.itemTitleBadgeRow}>
                        <Text style={styles.itemNameText}>Latest Federation Notice</Text>
                        <View style={styles.badgeGold}>
                          <Text style={styles.badgeGoldText}>📢 Official</Text>
                        </View>
                      </View>
                      <Text style={styles.itemIdGradeText}>
                        {new Date(notifications[0]?.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.noticeTitleBold}>{notifications[0]?.title}</Text>
                  <Text style={styles.noticeBodyText}>{notifications[0]?.message}</Text>
                </View>
              )}
            </View>
          )}

          {!isLoading && activeTab === 'profile' && (
            <View>
              <View style={styles.whiteItemCard}>
                <View style={styles.itemCardHeaderRow}>
                  <View>
                    <Text style={styles.cardHeaderTitle}>Official Player Dossier</Text>
                    <Text style={styles.cardHeaderSubtitle}>Registered credentials certified under Tamil Nadu Cricket Federation</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.btnActionEdit}
                    onPress={handleOpenEditProfile}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <EditIcon size={12} color="#b45309" />
                      <Text style={styles.btnActionEditText}>Edit Profile</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Profile Photo & Player Identity Showcase */}
                <View style={styles.profileAvatarCardRow}>
                  <View style={styles.profileAvatarLargeFrame}>
                    {profile?.photo || profile?.image_path ? (
                      <Image
                        source={{ uri: profile.photo || profile.image_path }}
                        style={styles.profileAvatarLargeImg}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.profileAvatarLargePlaceholder}>
                        <Text style={styles.profileAvatarLargeText}>
                          {playerName ? playerName.charAt(0).toUpperCase() : 'P'}
                        </Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.avatarEditPillBadge}
                      onPress={handleOpenEditProfile}
                      activeOpacity={0.85}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="camera-outline" size={12} color="#ffffff" />
                        <Text style={styles.avatarEditPillText}>Change</Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text style={styles.profileAvatarName}>{profile?.name || playerName}</Text>
                      <View style={styles.jerseyPillBadge}>
                        <Text style={styles.jerseyPillText}>#{profile?.jerseyNumber ?? '-'}</Text>
                      </View>
                    </View>
                    <Text style={styles.profileAvatarSub}>{playerRole || 'Player'}{playerTeam ? ` • ${playerTeam}` : ''}</Text>
                    <Text style={styles.profileAvatarFedId}>ID: {playerId}</Text>
                  </View>
                </View>

                <View style={styles.profileDetailsGrid}>
                  <View style={styles.profileRowItem}>
                    <Text style={styles.profileKey}>Full Name</Text>
                    <Text style={styles.profileVal}>{profile?.name || playerName}</Text>
                  </View>
                  <View style={styles.profileRowItem}>
                    <Text style={styles.profileKey}>Registered Email</Text>
                    <Text style={styles.profileVal}>{playerEmail}</Text>
                  </View>
                  <View style={styles.profileRowItem}>
                    <Text style={styles.profileKey}>Contact Mobile</Text>
                    <Text style={styles.profileVal}>{profile?.mobile || '-'}</Text>
                  </View>
                  <View style={styles.profileRowItem}>
                    <Text style={styles.profileKey}>Federation ID</Text>
                    <Text style={styles.profileVal}>{playerId}</Text>
                  </View>
                  <View style={styles.profileRowItem}>
                    <Text style={styles.profileKey}>Registration Status</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <CheckIcon size={12} color="#16a34a" />
                      <Text style={[styles.profileVal, { color: '#16a34a', fontWeight: '800' }]}>{approvalStatus}</Text>
                    </View>
                  </View>
                  <View style={styles.profileRowItem}>
                    <Text style={styles.profileKey}>Club / Team</Text>
                    <Text style={[styles.profileVal, { color: '#b45309', fontWeight: '800' }]}>{playerTeam || 'Not Assigned'}</Text>
                  </View>
                  <View style={styles.profileRowItem}>
                    <Text style={styles.profileKey}>Jersey Number</Text>
                    <Text style={styles.profileVal}>#{profile?.jerseyNumber ?? '-'}</Text>
                  </View>
                  <View style={styles.profileRowItem}>
                    <Text style={styles.profileKey}>Batting Style</Text>
                    <Text style={styles.profileVal}>{profile?.battingStyle || '-'}</Text>
                  </View>
                  <View style={styles.profileRowItem}>
                    <Text style={styles.profileKey}>Bowling Style</Text>
                    <Text style={styles.profileVal}>{profile?.bowlingStyle || '-'}</Text>
                  </View>
                  <View style={styles.profileRowItem}>
                    <Text style={styles.profileKey}>Taluk / Jurisdiction</Text>
                    <Text style={styles.profileVal}>{profile?.taluk || '-'}</Text>
                  </View>
                </View>
              </View>

              {/* ── Official Achievement Patches & Performance Points Summary Card ── */}
              <View style={[styles.whiteItemCard, { marginTop: 14, borderLeftColor: '#d4af37', borderLeftWidth: 4 }]}>
                <View style={styles.patchesCardHeader}>
                  <View style={{ flexShrink: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <AwardIcon size={16} color="#1e293b" />
                        <Text style={styles.cardHeaderTitle}>Official Achievement Patches</Text>
                      </View>
                      <View style={styles.tierBadgeGold}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <Ionicons name="star" size={10} color="#b45309" />
                          <Text style={styles.tierBadgeGoldText}>{performancePoints} PTS • {playerTierTitle}</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={[styles.cardHeaderSubtitle, { marginTop: 4 }]}>
                      {unlockedPatchesCount} of {patchesList.length} Milestone Patches Unlocked under Federation Standards
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.btnActionView}
                    onPress={() => setActiveTab('achievements')}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Ionicons name="trophy-outline" size={13} color="#b45309" />
                      <Text style={styles.btnActionViewText}>View All Patches →</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Performance Points Rating & Tier Progress Banner */}
                <View style={styles.pointsBanner}>
                  <View style={styles.pointsBannerTopRow}>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Ionicons name="star" size={16} color="#d4af37" />
                        <Text style={styles.pointsBigText}>{performancePoints} PTS</Text>
                      </View>
                      <Text style={styles.pointsSubText}>Federation Performance Rating</Text>
                    </View>
                    <View style={styles.tierBadgeGold}>
                      <Text style={styles.tierBadgeGoldText}>
                          {playerTier === 'DIAMOND' ? <Ionicons name="diamond" size={11} color="#b45309" /> : playerTier === 'GOLD' ? <Ionicons name="medal" size={11} color="#b45309" /> : playerTier === 'SILVER' ? <Ionicons name="ribbon" size={11} color="#94a3b8" /> : <Ionicons name="ribbon-outline" size={11} color="#b08050" />}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${Math.min(100, Math.round((performancePoints / nextTierPoints) * 100))}%` }
                      ]}
                    />
                  </View>
                  <View style={styles.pointsProgressSubRow}>
                    <Text style={styles.pointsProgressSubText}>
                      Tier Target: {performancePoints} / {nextTierPoints} PTS
                    </Text>
                    <Text style={[styles.pointsProgressSubText, { color: '#fbbf24', fontWeight: '800' }]}>
                      {Math.min(100, Math.round((performancePoints / nextTierPoints) * 100))}% to Next Tier
                    </Text>
                  </View>
                </View>
              </View>

              <View style={[styles.whiteItemCard, { marginTop: 14 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name="lock-closed-outline" size={16} color="#1e293b" /><Text style={styles.cardHeaderTitle}>Authentication &amp; Role Clearance</Text></View>
                <Text style={styles.securityExplanation}>
                  Your account is protected under CFVD Player Role clearance.
                  As an authenticated Player, you can view your squad roster, fixtures, live scorecards, and performance statistics.
                  Role clearances, team ownership, and match scoring rights are governed exclusively by district administrators and BCCI-certified scorers.
                </Text>
              </View>
            </View>
          )}

          {!isLoading && activeTab === 'team' && (
            <View>
              <View style={styles.whiteItemCard}>
                <View style={styles.itemCardHeaderRow}>
                  <View>
                    <Text style={styles.cardHeaderTitle}>{teamInfo?.name || playerTeam || 'No Squad Assigned'}</Text>
                    <Text style={styles.cardHeaderSubtitle}>
                      {teamInfo?.coachName ? `Coach: ${teamInfo.coachName}${teamInfo?.coachEmail ? ` (${teamInfo.coachEmail})` : ''}` : (teamInfo?.name ? 'Official Registered Team' : 'No squad assigned yet')}
                    </Text>
                  </View>
                  <View style={styles.badgeConfirmed}>
                    <Text style={styles.badgeConfirmedText}>Affiliated Club</Text>
                  </View>
                </View>

                <View style={styles.teamStatsRow}>
                  <View style={styles.teamStatBox}>
                    <Text style={styles.teamStatNum}>{squad.length}</Text>
                    <Text style={styles.teamStatLbl}>Squad Players</Text>
                  </View>
                  <View style={styles.teamStatBox}>
                    <Text style={styles.teamStatNum}>{teamInfo?.stats?.matches ?? 0}</Text>
                    <Text style={styles.teamStatLbl}>Matches</Text>
                  </View>
                  <View style={styles.teamStatBox}>
                    <Text style={styles.teamStatNum}>{teamInfo?.stats?.won ?? 0}</Text>
                    <Text style={styles.teamStatLbl}>Won</Text>
                  </View>
                  <View style={styles.teamStatBox}>
                    <Text style={[styles.teamStatNum, { color: '#d97706' }]}>{teamInfo?.stats?.points ?? 0}</Text>
                    <Text style={styles.teamStatLbl}>Points</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.whiteItemCard, { marginTop: 14 }]}>
                <Text style={styles.cardHeaderTitle}>{squad.length > 0 ? `${squad.length}-Member Squad Roster` : 'Squad Roster'}</Text>
                <Text style={styles.cardHeaderSubtitle}>{teamInfo?.name ? `Official roster for ${teamInfo.name}` : 'Squad roster from database'}</Text>

                <View style={{ marginTop: 12 }}>
                  {squad.length === 0 ? (
                    <View style={[styles.emptyCardBox, { paddingVertical: 28 }]}>
                      <UsersIcon size={32} color="#94a3b8" />
                      <Text style={[styles.emptyCardTitle, { marginTop: 8 }]}>No Squad Members Found</Text>
                      <Text style={styles.emptyCardSub}>No team squad members have been registered in the database for your club yet.</Text>
                    </View>
                  ) : (
                    squad.map((pl, idx) => {
                    const isCurrentPlayer =
                      pl.email?.toLowerCase() === playerEmail.toLowerCase() ||
                      pl.name?.toLowerCase() === playerName.toLowerCase();

                    const rawPhoto = isCurrentPlayer
                      ? (profile?.photo || profile?.image_path || pl.photo || pl.image_path)
                      : (pl.photo || pl.image_path);
                    const photoUri = resolvePhotoUrl(rawPhoto);

                    return (
                      <TouchableOpacity
                        key={pl.id || idx}
                        style={[styles.squadRowItem, isCurrentPlayer && styles.squadRowActive]}
                        onPress={() => setSelectedSquadPlayer({ ...pl, resolvedPhoto: photoUri })}
                        activeOpacity={0.75}
                      >
                        {/* Player Avatar Circle (Displays Profile Photo if uploaded) */}
                        <View style={styles.squadAvatarContainer}>
                          {photoUri ? (
                            <Image
                              source={{ uri: photoUri }}
                              style={styles.squadPhotoImg}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={styles.squadAvatarFallback}>
                              <Text style={styles.squadAvatarInitial}>
                                {pl.name ? pl.name.charAt(0).toUpperCase() : 'P'}
                              </Text>
                            </View>
                          )}
                          <View style={styles.squadJerseyMiniBadge}>
                            <Text style={styles.squadJerseyMiniText}>
                              #{pl.jerseyNumber ?? (idx + 1)}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flex: 1, marginLeft: 14 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                            <Text style={[styles.squadMemberName, isCurrentPlayer && { color: '#b45309' }]}>
                              {pl.name}
                            </Text>
                            {isCurrentPlayer && (
                              <View style={styles.youPillBadge}>
                                <Text style={styles.youPillBadgeText}>YOU</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.squadMemberRole}>
                            {pl.role || 'Player'}{pl.battingStyle ? ` • ${pl.battingStyle}` : ''}
                          </Text>
                        </View>
                        <View style={styles.verifiedCheckPill}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <CheckIcon size={11} color="#16a34a" />
                          <Text style={styles.verifiedCheckText}>Approved</Text>
                        </View>
                        </View>
                      </TouchableOpacity>
                    );
                  }))}
                </View>
              </View>
            </View>
          )}

          {!isLoading && activeTab === 'matches' && (
            <View>
              <View style={styles.toolbarCard}>
                <View style={styles.searchBox}>
                  <Text style={styles.searchIcon}>🔍</Text>
                  <TextInput
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search opponent team, venue or tournament..."
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View style={styles.filterPillsGroup}>
                  {(['ALL', 'SCHEDULED', 'LIVE', 'COMPLETED'] as const).map(tab => (
                    <TouchableOpacity
                      key={tab}
                      style={[styles.filterPill, matchFilter === tab && styles.filterPillActive]}
                      onPress={() => setMatchFilter(tab)}
                    >
                      <Text style={[styles.filterPillText, matchFilter === tab && styles.filterPillTextActive]}>
                        {tab}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {filteredMatches.length === 0 ? (
                <View style={styles.emptyCardBox}>
                  <View style={{ marginBottom: 8 }}><CricketBatIcon size={32} color="#94a3b8" /></View>
                  <Text style={styles.emptyCardTitle}>No Matches Found</Text>
                  <Text style={styles.emptyCardSub}>No tournament fixtures found matching current criteria.</Text>
                </View>
              ) : (
                filteredMatches.map(m => {
                  const statusUpper = (m.status || 'SCHEDULED').toUpperCase();
                  const isLive = statusUpper === 'LIVE' || statusUpper === 'INNINGS_BREAK';
                  const isCompleted = statusUpper === 'COMPLETED';

                  return (
                    <View
                      key={m.id}
                      style={[
                        styles.whiteItemCard,
                        { marginBottom: 12 },
                        isLive && { borderLeftColor: '#ef4444' },
                        isCompleted && { borderLeftColor: '#10b981' }
                      ]}
                    >
                      <View style={styles.itemCardHeaderRow}>
                        <View>
                          <Text style={styles.matchCardTournament}>{m.tournament || 'Tournament Fixture'}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}><Ionicons name="location-outline" size={11} color="#94a3b8" /><Text style={styles.matchCardLocation}>{m.venue || 'Venue TBA'}</Text><Ionicons name="calendar-outline" size={11} color="#94a3b8" /><Text style={styles.matchCardLocation}>{m.date || 'TBA'}{m.time ? ` • ${m.time}` : ''}</Text></View>
                        </View>
                        <View style={[styles.badgeBase, isLive ? styles.badgeLive : isCompleted ? styles.badgeCompleted : styles.badgeScheduled]}>
                          <Text style={[styles.badgeBaseText, isLive ? styles.badgeLiveText : isCompleted ? styles.badgeCompletedText : styles.badgeScheduledText]}>
                            {statusUpper}
                          </Text>
                        </View>
                      </View>

                      {(() => {
                        const isTeamAUser = Boolean(
                          (m.teamA?.id && profile?.teamId && m.teamA?.id === profile?.teamId) ||
                          (playerTeam && (m.teamA?.name || '').toLowerCase().includes(playerTeam.toLowerCase()))
                        );
                        const isTeamBUser = Boolean(
                          (m.teamB?.id && profile?.teamId && m.teamB?.id === profile?.teamId) ||
                          (playerTeam && (m.teamB?.name || '').toLowerCase().includes(playerTeam.toLowerCase()))
                        );

                        return (
                          <View style={styles.matchTeamsRow}>
                            <View style={styles.matchTeamSide}>
                              {isTeamAUser && (
                                <View style={[styles.youPillBadge, { marginBottom: 4, alignSelf: 'center' }]}>
                                  <Text style={styles.youPillBadgeText}>YOUR SQUAD</Text>
                                </View>
                              )}
                              <Text
                                style={[
                                  styles.matchTeamTitle,
                                  isTeamAUser && { color: '#b45309' },
                                  isMobileS && { fontSize: 13 }
                                ]}
                                numberOfLines={2}
                              >
                                {m.teamA?.name || m.team_a_name || 'TBA'}
                              </Text>
                              <Text style={styles.matchScoreText}>{m.scoreA || 'Yet to bat'}</Text>
                            </View>
                            <View style={styles.vsCircle}>
                              <Text style={styles.vsCircleText}>VS</Text>
                            </View>
                            <View style={styles.matchTeamSide}>
                              {isTeamBUser && (
                                <View style={[styles.youPillBadge, { marginBottom: 4, alignSelf: 'center' }]}>
                                  <Text style={styles.youPillBadgeText}>YOUR SQUAD</Text>
                                </View>
                              )}
                              <Text
                                style={[
                                  styles.matchTeamTitle,
                                  isTeamBUser && { color: '#b45309' },
                                  isMobileS && { fontSize: 13 }
                                ]}
                                numberOfLines={2}
                              >
                                {m.teamB?.name || m.team_b_name || 'TBA'}
                              </Text>
                              <Text style={styles.matchScoreText}>{m.scoreB || 'Yet to bat'}</Text>
                            </View>
                          </View>
                        );
                      })()}

                      {m.result && (
                        <View style={styles.resultBannerBox}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Ionicons name="trophy-outline" size={13} color="#b45309" /><Text style={styles.resultBannerText}>{m.result}</Text></View>
                        </View>
                      )}

                      <TouchableOpacity
                        style={styles.btnActionView}
                        onPress={() => handleOpenScorecard(m.id)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.btnActionViewText}>View Certified Scorecard (Read-Only) →</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {!isLoading && activeTab === 'statistics' && (
            <View>
              <View style={styles.whiteItemCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><CricketBatIcon size={16} color="#1e293b" /><Text style={styles.cardHeaderTitle}>Batting Record</Text></View>
                <Text style={styles.cardHeaderSubtitle}>Derived from official scorer match logs</Text>

                <View style={styles.statsGridRow}>
                  <View style={styles.statMetricCard}>
                    <Text style={styles.statMetricValue}>{matchesPlayed}</Text>
                    <Text style={styles.statMetricLabel}>Matches</Text>
                  </View>
                  <View style={styles.statMetricCard}>
                    <Text style={styles.statMetricValue}>{statistics?.batting?.innings ?? 0}</Text>
                    <Text style={styles.statMetricLabel}>Innings</Text>
                  </View>
                  <View style={styles.statMetricCard}>
                    <Text style={[styles.statMetricValue, { color: '#b45309' }]}>{runsScored}</Text>
                    <Text style={styles.statMetricLabel}>Runs</Text>
                  </View>
                  <View style={styles.statMetricCard}>
                    <Text style={styles.statMetricValue}>{statistics?.batting?.highestScore ?? highScore}</Text>
                    <Text style={styles.statMetricLabel}>High Score</Text>
                  </View>
                  <View style={styles.statMetricCard}>
                    <Text style={styles.statMetricValue}>{battingAvg}</Text>
                    <Text style={styles.statMetricLabel}>Average</Text>
                  </View>
                  <View style={styles.statMetricCard}>
                    <Text style={styles.statMetricValue}>{strikeRate}</Text>
                    <Text style={styles.statMetricLabel}>Strike Rate</Text>
                  </View>
                  <View style={styles.statMetricCard}>
                    <Text style={styles.statMetricValue}>{statistics?.batting?.fours ?? 0}</Text>
                    <Text style={styles.statMetricLabel}>4s</Text>
                  </View>
                  <View style={styles.statMetricCard}>
                    <Text style={styles.statMetricValue}>{statistics?.batting?.sixes ?? 0}</Text>
                    <Text style={styles.statMetricLabel}>6s</Text>
                  </View>
                  <View style={styles.statMetricCard}>
                    <Text style={styles.statMetricValue}>{fiftiesCount}</Text>
                    <Text style={styles.statMetricLabel}>50s</Text>
                  </View>
                  <View style={styles.statMetricCard}>
                    <Text style={styles.statMetricValue}>{centuriesCount}</Text>
                    <Text style={styles.statMetricLabel}>100s</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.whiteItemCard, { marginTop: 14 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name="radio-button-on-outline" size={16} color="#1e293b" /><Text style={styles.cardHeaderTitle}>Bowling Record</Text></View>
                <Text style={styles.cardHeaderSubtitle}>Live over-by-over analysis</Text>

                <View style={styles.statsGridRow}>
                  <View style={styles.statMetricCard}>
                    <Text style={styles.statMetricValue}>{matchesPlayed}</Text>
                    <Text style={styles.statMetricLabel}>Matches</Text>
                  </View>
                  <View style={styles.statMetricCard}>
                    <Text style={styles.statMetricValue}>{statistics?.bowling?.overs ?? 0}</Text>
                    <Text style={styles.statMetricLabel}>Overs</Text>
                  </View>
                  <View style={styles.statMetricCard}>
                    <Text style={styles.statMetricValue}>{statistics?.bowling?.runsConceded ?? 0}</Text>
                    <Text style={styles.statMetricLabel}>Runs</Text>
                  </View>
                  <View style={styles.statMetricCard}>
                    <Text style={[styles.statMetricValue, { color: '#0284c7' }]}>{wicketsTaken}</Text>
                    <Text style={styles.statMetricLabel}>Wickets</Text>
                  </View>
                  <View style={styles.statMetricCard}>
                    <Text style={styles.statMetricValue}>{economy}</Text>
                    <Text style={styles.statMetricLabel}>Economy</Text>
                  </View>
                  <View style={styles.statMetricCard}>
                    <Text style={styles.statMetricValue}>{bestBowling}</Text>
                    <Text style={styles.statMetricLabel}>Best Figures</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.whiteItemCard, { marginTop: 14 }]}>
                <Text style={styles.cardHeaderTitle}>🧤 Fielding Record</Text>
                <Text style={styles.cardHeaderSubtitle}>Catches, dismissals, and ground fielding</Text>

                <View style={styles.statsGridRow}>
                  <View style={styles.statMetricCard}>
                    <Text style={[styles.statMetricValue, { color: '#16a34a' }]}>{catchesTaken}</Text>
                    <Text style={styles.statMetricLabel}>Catches</Text>
                  </View>
                  <View style={styles.statMetricCard}>
                    <Text style={styles.statMetricValue}>{statistics?.fielding?.runOuts ?? 0}</Text>
                    <Text style={styles.statMetricLabel}>Run-Outs</Text>
                  </View>
                  <View style={styles.statMetricCard}>
                    <Text style={styles.statMetricValue}>{statistics?.fielding?.stumpings ?? 0}</Text>
                    <Text style={styles.statMetricLabel}>Stumpings</Text>
                  </View>
                  <View style={styles.statMetricCard}>
                    <Text style={styles.statMetricValue}>{statistics?.fielding?.directHits ?? 0}</Text>
                    <Text style={styles.statMetricLabel}>Direct Hits</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {!isLoading && activeTab === 'achievements' && (
            <View>
              {/* Top Banner: Rating & Tier Progress */}
              <View style={[styles.whiteItemCard, { borderLeftColor: '#d4af37', borderLeftWidth: 4, marginBottom: 14 }]}>
                <View style={styles.patchesCardHeader}>
                  <View style={{ flexShrink: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name="trophy-outline" size={16} color="#1e293b" /><Text style={styles.cardHeaderTitle}>Official Player Achievements &amp; Patches</Text></View>
                      <View style={styles.tierBadgeGold}>
                        <Text style={styles.tierBadgeGoldText}>
                          {playerTier === 'DIAMOND' ? <Ionicons name="diamond" size={11} color="#b45309" /> : playerTier === 'GOLD' ? <Ionicons name="medal" size={11} color="#b45309" /> : playerTier === 'SILVER' ? <Ionicons name="ribbon" size={11} color="#94a3b8" /> : <Ionicons name="ribbon-outline" size={11} color="#b08050" />}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.cardHeaderSubtitle, { marginTop: 4 }]}>
                      Certified match milestones, performance points, and earned award patches under CFVD Federation Standards
                    </Text>
                  </View>
                  <View style={styles.badgeConfirmed}>
                    <Text style={styles.badgeConfirmedText}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><CheckIcon size={11} color="#16a34a" /><Text style={styles.badgeConfirmedText}>{unlockedPatchesCount} of {patchesList.length} Unlocked</Text></View>
                    </Text>
                  </View>
                </View>

                {/* Rating Points Banner */}
                <View style={styles.pointsBanner}>
                  <View style={styles.pointsBannerTopRow}>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Ionicons name="star" size={16} color="#d4af37" />
                        <Text style={styles.pointsBigText}>{performancePoints} PTS</Text>
                      </View>
                      <Text style={styles.pointsSubText}>Federation Performance Rating Points</Text>
                    </View>
                    <View style={styles.tierBadgeGold}>
                      <Text style={styles.tierBadgeGoldText}>
                          {playerTier === 'DIAMOND' ? <Ionicons name="diamond" size={11} color="#b45309" /> : playerTier === 'GOLD' ? <Ionicons name="medal" size={11} color="#b45309" /> : playerTier === 'SILVER' ? <Ionicons name="ribbon" size={11} color="#94a3b8" /> : <Ionicons name="ribbon-outline" size={11} color="#b08050" />}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${Math.min(100, Math.round((performancePoints / nextTierPoints) * 100))}%` }
                      ]}
                    />
                  </View>
                  <View style={styles.pointsProgressSubRow}>
                    <Text style={styles.pointsProgressSubText}>
                      Next Tier Target: {performancePoints} / {nextTierPoints} PTS
                    </Text>
                    <Text style={[styles.pointsProgressSubText, { color: '#fbbf24', fontWeight: '800' }]}>
                      {Math.min(100, Math.round((performancePoints / nextTierPoints) * 100))}%
                    </Text>
                  </View>
                </View>

                {/* Metric Summary Counters */}
                <View style={styles.statsGridRow}>
                  <View style={styles.statMetricCard}>
                    <Text style={[styles.statMetricValue, { color: '#16a34a' }]}>{unlockedPatchesCount}</Text>
                    <Text style={styles.statMetricLabel}>Patches Earned</Text>
                  </View>
                  <View style={styles.statMetricCard}>
                    <Text style={[styles.statMetricValue, { color: '#64748b' }]}>{patchesList.length - unlockedPatchesCount}</Text>
                    <Text style={styles.statMetricLabel}>In Progress</Text>
                  </View>
                  <View style={styles.statMetricCard}>
                    <Text style={[styles.statMetricValue, { color: '#d97706' }]}>{runsScored}</Text>
                    <Text style={styles.statMetricLabel}>Total Runs</Text>
                  </View>
                  <View style={styles.statMetricCard}>
                    <Text style={[styles.statMetricValue, { color: '#0284c7' }]}>{wicketsTaken}</Text>
                    <Text style={styles.statMetricLabel}>Total Wickets</Text>
                  </View>
                  <View style={styles.statMetricCard}>
                    <Text style={[styles.statMetricValue, { color: '#8b5cf6' }]}>{catchesTaken}</Text>
                    <Text style={styles.statMetricLabel}>Catches</Text>
                  </View>
                </View>
              </View>

              {/* Filter Pills for Patches */}
              <View style={[styles.toolbarCard, { marginBottom: 14 }]}>
                <View style={styles.filterPillsGroup}>
                  {(['ALL', 'UNLOCKED', 'BATTING', 'BOWLING', 'POINTS'] as const).map(f => {
                    const count = f === 'ALL'
                      ? patchesList.length
                      : f === 'UNLOCKED'
                      ? unlockedPatchesCount
                      : patchesList.filter((p: any) => p.category === f).length;

                    return (
                      <TouchableOpacity
                        key={f}
                        style={[styles.filterPill, patchCategoryFilter === f && styles.filterPillActive]}
                        onPress={() => setPatchCategoryFilter(f)}
                      >
                        <Text style={[styles.filterPillText, patchCategoryFilter === f && styles.filterPillTextActive]}>
                          {f} ({count})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Patches Grid */}
              <View style={styles.patchesGrid}>
                {displayedPatches.map((patch: any) => {
                  const isUnlocked = Boolean(patch.unlocked);
                  const pct = Math.min(100, Math.round(((patch.current || 0) / (patch.target || 1)) * 100));

                  return (
                    <View
                      key={patch.id}
                      style={[
                        styles.patchItemCard,
                        { width: isMobileS || width < 680 ? '100%' : '48.5%' },
                        isUnlocked && styles.patchItemUnlocked
                      ]}
                    >
                      <View style={styles.patchHeaderRow}>
                        <View style={[styles.patchIconBox, isUnlocked && styles.patchIconBoxUnlocked]}>
                          {patch.icon ? <Text style={{ fontSize: 20 }}>{patch.icon}</Text> : <AwardIcon size={22} color={isUnlocked ? '#b45309' : '#94a3b8'} />}
                        </View>
                        <View style={[styles.patchBadgePill, isUnlocked ? styles.patchBadgePillUnlocked : styles.patchBadgePillLocked]}>
                          <Text style={isUnlocked ? styles.patchBadgePillUnlockedText : styles.patchBadgePillLockedText}>
                            {isUnlocked ? (<View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><CheckIcon size={10} color="#065f46" /><Text style={isUnlocked ? styles.patchBadgePillUnlockedText : styles.patchBadgePillLockedText}>UNLOCKED</Text></View>) : <Text style={styles.patchBadgePillLockedText}>IN PROGRESS</Text>}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                        <Text style={[styles.patchTitle, isUnlocked && { color: '#b45309' }]}>
                          {patch.title}
                        </Text>
                        <View style={[styles.patchTierPill, { borderColor: patch.badgeColor || '#d97706' }]}>
                          <Text style={[styles.patchTierPillText, { color: patch.badgeColor || '#d97706' }]}>
                            {patch.tier || 'BADGE'}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.patchCriteria}>{patch.criteriaText}</Text>

                      {isUnlocked ? (
                        <View style={styles.achievedBox}>
                          <Text style={styles.achievedBoxText}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Ionicons name="trophy-outline" size={12} color="#b45309" /><Text style={styles.achievedBoxText}>Milestone Achieved • Record: {patch.current} {patch.category === 'BOWLING' ? 'Wickets' : patch.category === 'FIELDING' ? 'Catches' : patch.category === 'POINTS' ? 'PTS' : 'Runs'}</Text></View>
                          </Text>
                        </View>
                      ) : (
                        <View style={{ marginTop: 6 }}>
                          <View style={styles.patchProgressBarBg}>
                            <View style={[styles.patchProgressBarFill, { width: `${pct}%` }]} />
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={styles.patchProgressText}>
                              Progress: {patch.current || 0} / {patch.target} {patch.category === 'BOWLING' ? 'Wickets' : patch.category === 'FIELDING' ? 'Catches' : patch.category === 'POINTS' ? 'PTS' : 'Runs'}
                            </Text>
                            <Text style={[styles.patchProgressText, { color: '#64748b', fontWeight: '800' }]}>{pct}%</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Certified Association Recognition Seal Box */}
              <View style={[styles.whiteItemCard, { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
                <View style={styles.sealCircleBox}>
                  <Text style={{ fontSize: 28 }}>🛡️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#0f172a' }}>
                    Certified Tamil Nadu District Cricket Recognition
                  </Text>
                  <Text style={{ fontSize: 11.5, color: '#64748b', marginTop: 2, lineHeight: 16 }}>
                    All earned patches and performance ratings are computed automatically from verified umpire and BCCI-accredited match scorer scorecards.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {!isLoading && activeTab === 'notifications' && (
            <View>
              <View style={styles.whiteItemCard}>
                <Text style={styles.cardHeaderTitle}>Association Bulletins & Alerts</Text>
                <Text style={styles.cardHeaderSubtitle}>Official notifications published by Cricket Federation of Virudhunagar District</Text>

                <View style={{ marginTop: 12 }}>
                  {notifications.length === 0 ? (
                    <Text style={styles.emptyCardSub}>No notices published at this time.</Text>
                  ) : (
                    notifications.map(n => (
                      <View key={n.id} style={styles.notifRowItem}>
                        <View style={styles.notifIconWrap}>
                          <Text style={{ fontSize: 16 }}>📢</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={styles.notifItemTitle}>{n.title}</Text>
                            <Text style={styles.notifItemDate}>
                              {new Date(n.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </Text>
                          </View>
                          <Text style={styles.notifItemMessage}>{n.message}</Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </View>
            </View>
          )}

            </View>
          </ScrollView>
        </View>
      </View>

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditProfileVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsEditProfileVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCardContainer}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalMainTitle}>Edit Player Profile</Text>
                <Text style={styles.modalSubTitle}>Update your equipment style and mobile contact</Text>
              </View>
              <TouchableOpacity onPress={() => setIsEditProfileVisible(false)}>
                  <CloseIcon size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            {profileFeedback && (
              <View style={[styles.feedbackBannerBox, profileFeedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError]}>
                <Text style={styles.feedbackBannerText}>{profileFeedback.message}</Text>
              </View>
            )}

            <ScrollView style={{ paddingHorizontal: 18, paddingVertical: 14 }}>
              {/* Profile Photo Picker */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Player Profile Photo</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={styles.photoPreviewCircle}>
                    {editPhoto ? (
                      <Image
                        source={{ uri: editPhoto }}
                        style={{ width: 68, height: 68, borderRadius: 34 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text style={styles.photoPreviewInitial}>
                        {playerName ? playerName.charAt(0).toUpperCase() : 'P'}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 8 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <TouchableOpacity style={styles.btnPickPhoto} onPress={handlePickPhoto} activeOpacity={0.8}>
                        <Ionicons name="images-outline" size={14} color="#1e40af" style={{ marginRight: 5 }} />
                        <Text style={styles.btnPickPhotoText}>Choose from Gallery</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.btnCameraPhoto} onPress={handleTakePhoto} activeOpacity={0.8}>
                        <Ionicons name="camera-outline" size={14} color="#065f46" style={{ marginRight: 5 }} />
                        <Text style={styles.btnCameraPhotoText}>Take Photo</Text>
                      </TouchableOpacity>
                    </View>
                    {editPhoto ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                        <TouchableOpacity
                          onPress={() => openCropModal(editPhoto)}
                          activeOpacity={0.8}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        >
                          <Ionicons name="crop-outline" size={13} color="#b45309" />
                          <Text style={{ color: '#b45309', fontSize: 12, fontWeight: '700' }}>Crop / Adjust</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setEditPhoto(null)}
                          activeOpacity={0.8}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        >
                          <Ionicons name="trash-outline" size={13} color="#dc2626" />
                          <Text style={{ color: '#dc2626', fontSize: 12, fontWeight: '700' }}>Remove Photo</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Text style={{ color: '#64748b', fontSize: 11.5 }}>
                        Upload photo from gallery or camera to crop &amp; adjust
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Batting Style</Text>
                <TextInput
                  style={styles.formInput}
                  value={editBattingStyle}
                  onChangeText={setEditBattingStyle}
                  placeholder="e.g. Right Hand Bat / Left Hand Bat"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Bowling Style</Text>
                <TextInput
                  style={styles.formInput}
                  value={editBowlingStyle}
                  onChangeText={setEditBowlingStyle}
                  placeholder="e.g. Right Arm Fast / Off Break"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Preferred Jersey Number</Text>
                <TextInput
                  style={styles.formInput}
                  value={editJerseyNumber}
                  onChangeText={setEditJerseyNumber}
                  keyboardType="numeric"
                  placeholder="e.g. 7, 10, 18"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Mobile Number</Text>
                <TextInput
                  style={styles.formInput}
                  value={editMobile}
                  onChangeText={setEditMobile}
                  keyboardType="phone-pad"
                  placeholder="e.g. 9876543210"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Taluk / Jurisdiction</Text>
                <TextInput
                  style={styles.formInput}
                  value={editTaluk}
                  onChangeText={setEditTaluk}
                  placeholder="e.g. Virudhunagar / Sivakasi"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </ScrollView>

            <View style={styles.modalActionButtonsRow}>
              <TouchableOpacity
                style={styles.btnModalCancel}
                onPress={() => setIsEditProfileVisible(false)}
              >
                <Text style={styles.btnModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnModalSave}
                onPress={handleSaveProfile}
                disabled={isSavingProfile}
              >
                {isSavingProfile ? (
                  <ActivityIndicator color="#020612" size="small" />
                ) : (
                  <Text style={styles.btnModalSaveText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Read-Only Scorecard Modal */}
      <Modal
        visible={!!selectedScorecardMatchId}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedScorecardMatchId(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCardContainer, { maxHeight: '90%' }]}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalMainTitle}>Certified Match Scorecard</Text>
                <Text style={styles.modalSubTitle}><Ionicons name="lock-closed-outline" size={12} color="#64748b" /> Official Digital Score Record • Read-Only</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedScorecardMatchId(null)}>
                  <CloseIcon size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            {isLoadingScorecard ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator color="#d4af37" size="large" />
                <Text style={{ marginTop: 10, color: '#64748b' }}>Retrieving live match scorecard...</Text>
              </View>
            ) : (
              <ScrollView style={{ padding: 16 }}>
                <View style={styles.scorecardMatchBanner}>
                  <Text style={styles.scorecardBannerTournament}>
                    {scorecardData?.tournamentName || 'Tournament Match'}
                  </Text>
                  <Text style={styles.scorecardBannerTeams}>
                    {scorecardData?.teamA?.name || 'Team A'} vs {scorecardData?.teamB?.name || 'Team B'}
                  </Text>
                  <Text style={styles.scorecardBannerVenue}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="location-outline" size={12} color="#94a3b8" /><Text style={styles.scorecardBannerVenue}>{scorecardData?.venue || 'Venue TBA'}</Text></View>
                  </Text>
                  {scorecardData?.result && (
                    <Text style={styles.scorecardBannerResultText}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Ionicons name="trophy-outline" size={14} color="#b45309" /><Text style={styles.scorecardBannerResultText}>{scorecardData.result}</Text></View>
                    </Text>
                  )}
                </View>

                <View style={styles.inningsTabBar}>
                  <TouchableOpacity
                    style={[styles.inningsTabBtn, activeInningsTab === 0 && styles.inningsTabBtnActive]}
                    onPress={() => setActiveInningsTab(0)}
                  >
                    <Text style={[styles.inningsTabBtnText, activeInningsTab === 0 && styles.inningsTabBtnTextActive]}>
                      Innings 1 ({scorecardData?.innings?.[0]?.teamName || 'Team A'})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.inningsTabBtn, activeInningsTab === 1 && styles.inningsTabBtnActive]}
                    onPress={() => setActiveInningsTab(1)}
                  >
                    <Text style={[styles.inningsTabBtnText, activeInningsTab === 1 && styles.inningsTabBtnTextActive]}>
                      Innings 2 ({scorecardData?.innings?.[1]?.teamName || 'Team B'})
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inningsContentBox}>
                  <Text style={styles.inningsHeaderTitle}>
                    {scorecardData?.innings?.[activeInningsTab]?.teamName || (activeInningsTab === 0 ? 'Team A' : 'Team B')} - Score: {scorecardData?.innings?.[activeInningsTab]?.totalRuns ?? 0}/{scorecardData?.innings?.[activeInningsTab]?.totalWickets ?? 0} ({scorecardData?.innings?.[activeInningsTab]?.overs ?? '0.0'} Ov)
                  </Text>

                  <View style={styles.tableBox}>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.tableHeadCell, { flex: 2 }]}>Batter</Text>
                      <Text style={styles.tableHeadCell}>R</Text>
                      <Text style={styles.tableHeadCell}>B</Text>
                      <Text style={styles.tableHeadCell}>4s</Text>
                      <Text style={styles.tableHeadCell}>6s</Text>
                      <Text style={styles.tableHeadCell}>SR</Text>
                    </View>
                    {(!scorecardData?.innings?.[activeInningsTab]?.batting || scorecardData.innings[activeInningsTab].batting.length === 0) ? (
                      <View style={{ padding: 20, alignItems: 'center' }}>
                        <Text style={{ color: '#64748b', fontSize: 13 }}>No batting scorecard available for this innings yet.</Text>
                      </View>
                    ) : (
                      scorecardData.innings[activeInningsTab].batting.map((b: any, idx: number) => (
                        <View key={idx} style={styles.tableBodyRow}>
                          <View style={{ flex: 2 }}>
                            <Text style={styles.batterNameText}>{b.batterName}</Text>
                            <Text style={styles.dismissalText}>{b.dismissal || 'not out'}</Text>
                          </View>
                          <Text style={[styles.tableBodyCell, { fontWeight: '800', color: '#0f172a' }]}>{b.runs}</Text>
                          <Text style={styles.tableBodyCell}>{b.balls}</Text>
                          <Text style={styles.tableBodyCell}>{b.fours}</Text>
                          <Text style={styles.tableBodyCell}>{b.sixes}</Text>
                          <Text style={styles.tableBodyCell}>{b.strikeRate || ((b.runs / (b.balls || 1)) * 100).toFixed(1)}</Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              </ScrollView>
            )}

            <View style={styles.modalActionButtonsRow}>
              <TouchableOpacity
                style={styles.btnModalCancel}
                onPress={() => setSelectedScorecardMatchId(null)}
              >
                <Text style={styles.btnModalCancelText}>Close Scorecard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={logoutModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setLogoutModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCardContainer, { maxWidth: 400 }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalMainTitle}>Confirm Logout</Text>
              <TouchableOpacity onPress={() => setLogoutModalOpen(false)}>
                  <CloseIcon size={18} color="#64748b" />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 18 }}>
              <Text style={{ color: '#334155', fontSize: 14, lineHeight: 20 }}>
                Are you sure you want to end your player session? You can log back in at any time with your credentials.
              </Text>
            </View>
            <View style={styles.modalActionButtonsRow}>
              <TouchableOpacity
                style={styles.btnModalCancel}
                onPress={() => setLogoutModalOpen(false)}
              >
                <Text style={styles.btnModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnModalSave, { backgroundColor: '#ef4444' }]}
                onPress={handleLogout}
              >
                <Text style={[styles.btnModalSaveText, { color: '#ffffff' }]}>Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Squad Player Detail Modal with Full Photo Preview */}
      <Modal
        visible={!!selectedSquadPlayer}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedSquadPlayer(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCardContainer, { maxWidth: 420 }]}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalMainTitle}>Squad Player Profile</Text>
                <Text style={styles.modalSubTitle}>{teamInfo?.name || playerTeam}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedSquadPlayer(null)}>
                  <CloseIcon size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selectedSquadPlayer && (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <View style={styles.squadModalAvatarFrame}>
                  {selectedSquadPlayer.resolvedPhoto ? (
                    <Image
                      source={{ uri: selectedSquadPlayer.resolvedPhoto }}
                      style={styles.squadModalAvatarImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.squadModalAvatarPlaceholder}>
                      <Text style={styles.squadModalAvatarInitial}>
                        {selectedSquadPlayer.name ? selectedSquadPlayer.name.charAt(0).toUpperCase() : 'P'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.squadModalJerseyBadge}>
                    <Text style={styles.squadModalJerseyText}>#{selectedSquadPlayer.jerseyNumber ?? '-'}</Text>
                  </View>
                </View>

                <Text style={styles.squadModalPlayerName}>{selectedSquadPlayer.name}</Text>
                <Text style={styles.squadModalPlayerRole}>
                  {selectedSquadPlayer.role || 'Player'}{selectedSquadPlayer.battingStyle ? ` • ${selectedSquadPlayer.battingStyle}` : ''}
                </Text>

                <View style={styles.squadModalDetailsCard}>
                  <View style={styles.squadModalDetailRow}>
                    <Text style={styles.squadModalDetailLabel}>Jersey Number</Text>
                    <Text style={styles.squadModalDetailVal}>#{selectedSquadPlayer.jerseyNumber ?? '-'}</Text>
                  </View>
                  <View style={styles.squadModalDetailRow}>
                    <Text style={styles.squadModalDetailLabel}>Playing Role</Text>
                    <Text style={styles.squadModalDetailVal}>{selectedSquadPlayer.role || '-'}</Text>
                  </View>
                  <View style={styles.squadModalDetailRow}>
                    <Text style={styles.squadModalDetailLabel}>Batting Style</Text>
                    <Text style={styles.squadModalDetailVal}>{selectedSquadPlayer.battingStyle || '-'}</Text>
                  </View>
                  <View style={styles.squadModalDetailRow}>
                    <Text style={styles.squadModalDetailLabel}>Bowling Style</Text>
                    <Text style={styles.squadModalDetailVal}>{selectedSquadPlayer.bowlingStyle || '-'}</Text>
                  </View>
                  {selectedSquadPlayer.email ? (
                    <View style={styles.squadModalDetailRow}>
                      <Text style={styles.squadModalDetailLabel}>Email</Text>
                      <Text style={styles.squadModalDetailVal}>{selectedSquadPlayer.email}</Text>
                    </View>
                  ) : null}
                  <View style={[styles.squadModalDetailRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.squadModalDetailLabel}>Status</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><CheckIcon size={12} color="#16a34a" /><Text style={[styles.squadModalDetailVal, { color: '#16a34a' }]}>Verified &amp; Approved</Text></View>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.squadModalCloseBtn}
                  onPress={() => setSelectedSquadPlayer(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.squadModalCloseBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Profile Photo Interactive Crop Modal */}
      <Modal
        visible={isCropModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseCropModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCardContainer, { maxWidth: 440, padding: 0, overflow: 'hidden' }]}>
            {/* Header */}
            <View style={styles.cropModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.cropIconBadge}>
                  <Ionicons name="crop-outline" size={17} color="#b45309" />
                </View>
                <View>
                  <Text style={styles.modalMainTitle}>Crop Profile Photo</Text>
                  <Text style={styles.modalSubTitle}>Pan, zoom &amp; fit photo inside circular frame</Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleCloseCropModal} style={{ padding: 4 }} activeOpacity={0.7}>
                <CloseIcon size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Viewport Frame */}
            <View style={styles.cropViewportWrapper}>
              <View
                style={styles.cropContainer}
                {...panResponder.panHandlers}
              >
                {/* Scaled & Positioned Image */}
                {rawImageToCrop ? (
                  <View
                    style={{
                      position: 'absolute',
                      left: 130 + cropPan.x,
                      top: 130 + cropPan.y,
                      transform: [
                        { scale: cropZoom },
                        { rotate: `${cropRotation}deg` }
                      ]
                    }}
                  >
                    <Image
                      source={{ uri: rawImageToCrop }}
                      style={{
                        width: (imageNaturalDimensions.width || 300) * (240 / Math.max(1, Math.min(imageNaturalDimensions.width || 300, imageNaturalDimensions.height || 300))),
                        height: (imageNaturalDimensions.height || 300) * (240 / Math.max(1, Math.min(imageNaturalDimensions.width || 300, imageNaturalDimensions.height || 300))),
                        marginLeft: -((imageNaturalDimensions.width || 300) * (240 / Math.max(1, Math.min(imageNaturalDimensions.width || 300, imageNaturalDimensions.height || 300)))) / 2,
                        marginTop: -((imageNaturalDimensions.height || 300) * (240 / Math.max(1, Math.min(imageNaturalDimensions.width || 300, imageNaturalDimensions.height || 300)))) / 2
                      }}
                      resizeMode="cover"
                    />
                  </View>
                ) : null}

                {/* Dark Outer Cutout Mask */}
                <View style={styles.cropOverlayDarkCutout} pointerEvents="none" />

                {/* Circular Boundary with Dashed Amber Border & Alignment Grids */}
                <View style={styles.cropCircleBorder} pointerEvents="none">
                  <View style={styles.cropGridH1} />
                  <View style={styles.cropGridH2} />
                  <View style={styles.cropGridV1} />
                  <View style={styles.cropGridV2} />
                </View>

                {/* Drag Hint Badge */}
                <View style={styles.cropDragHintBadge} pointerEvents="none">
                  <Ionicons name="move-outline" size={12} color="#ffffff" />
                  <Text style={styles.cropDragHintText}>Drag photo to adjust position</Text>
                </View>
              </View>
            </View>

            {/* Interactive Control Panel */}
            <View style={styles.cropControlsContainer}>
              {/* Row 1: Zoom Controls, Rotate & Reset */}
              <View style={styles.cropControlRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.cropControlLabel}>Zoom</Text>
                  <View style={styles.cropZoomButtonGroup}>
                    <TouchableOpacity
                      style={styles.cropMiniBtn}
                      onPress={() => setCropZoom(z => Math.max(0.5, parseFloat((z - 0.15).toFixed(2))))}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="remove-outline" size={15} color="#334155" />
                    </TouchableOpacity>
                    <Text style={styles.cropZoomValueText}>{Math.round(cropZoom * 100)}%</Text>
                    <TouchableOpacity
                      style={styles.cropMiniBtn}
                      onPress={() => setCropZoom(z => Math.min(3.0, parseFloat((z + 0.15).toFixed(2))))}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add-outline" size={15} color="#334155" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TouchableOpacity
                    style={styles.cropToolBtn}
                    onPress={() => setCropRotation(r => (r + 90) % 360)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="refresh-outline" size={13} color="#b45309" />
                    <Text style={styles.cropToolBtnText}>Rotate</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.cropToolBtn}
                    onPress={handleResetCrop}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cropToolBtnText}>Reset</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Row 2: Precision Nudge Buttons */}
              <View style={styles.cropNudgeRow}>
                <Text style={styles.cropControlLabel}>Nudge</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TouchableOpacity
                    style={styles.cropMiniBtn}
                    onPress={() => setCropPan(p => ({ ...p, x: p.x - 15 }))}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="arrow-back-outline" size={14} color="#334155" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cropMiniBtn}
                    onPress={() => setCropPan(p => ({ ...p, y: p.y - 15 }))}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="arrow-up-outline" size={14} color="#334155" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cropMiniBtn}
                    onPress={() => setCropPan(p => ({ ...p, y: p.y + 15 }))}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="arrow-down-outline" size={14} color="#334155" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cropMiniBtn}
                    onPress={() => setCropPan(p => ({ ...p, x: p.x + 15 }))}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="arrow-forward-outline" size={14} color="#334155" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Bottom Actions */}
            <View style={styles.cropModalFooter}>
              <TouchableOpacity
                style={styles.btnModalCancel}
                onPress={handleCloseCropModal}
                activeOpacity={0.8}
              >
                <Text style={styles.btnModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnCropApply}
                onPress={handleApplyCrop}
                disabled={isCropping}
                activeOpacity={0.85}
              >
                {isCropping ? (
                  <ActivityIndicator size="small" color="#020612" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <CheckIcon size={14} color="#020612" />
                    <Text style={styles.btnCropApplyText}>Apply &amp; Save Photo</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES: Pure Light Theme with scroll fix applied
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // FIX 1: rootContainer — position:fixed on web traps the full viewport, no page scroll
  rootContainer: {
    flex: 1,
    backgroundColor: '#f6f2e9',
    ...(Platform.OS === 'web'
      ? ({
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        } as any)
      : { height: '100%', width: '100%', overflow: 'hidden' })
  },

  // 1. TOP HEADER BAR — flexShrink:0 keeps it pinned at top of mainColumn
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
    flexWrap: 'nowrap',
    gap: 8,
    zIndex: 100,
    flexShrink: 0
  },
  mobileHamburgerBtn: {
    padding: 8,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)'
  },
  mobileHamburgerText: {
    color: '#f59e0b',
    fontSize: 18,
    fontWeight: '800'
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1
  },
  brandLogo: {
    width: 44,
    height: 44
  },
  brandTitleMain: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  brandTitleSub: {
    color: '#d4af37',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  userBadgePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)'
  },
  userBadgePillText: {
    color: '#fde68a',
    fontSize: 11.5,
    fontWeight: '700'
  },
  exitBtnPill: {
    backgroundColor: '#dc2626',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8
  },
  exitBtnPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800'
  },
  headerAvatarBtn: {
    borderRadius: 19
  },
  headerAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#071026',
    borderWidth: 2,
    borderColor: '#d4af37',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  headerAvatarText: {
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: '900'
  },
  exitBtnIconOnly: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ef4444'
  },

  // FIX 2: layoutRoot — flex row, fills all remaining height below header area
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

  // FIX 3: mainColumn — flex column; header + scroll area stacked
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

  // FIX 4: rightContentScrollView — flex:1, ONLY this element scrolls
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
  contentSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    elevation: 1
  },
  contentSectionHeaderLeft: {
    flex: 1,
    minWidth: 180
  },
  contentSectionHeaderTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900'
  },
  contentSectionHeaderSub: {
    color: '#64748b',
    fontSize: 11.5,
    marginTop: 2
  },
  refreshPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  refreshPillBtnText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700'
  },

  errorBannerBox: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  errorBannerText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '600'
  },
  retryBtnText: {
    color: '#dc2626',
    fontWeight: '800',
    textDecorationLine: 'underline'
  },

  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 13.5,
    fontWeight: '600'
  },

  highlightCardsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
    flexWrap: 'wrap'
  },
  navyStatCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#0a1432',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(254, 215, 102, 0.45)',
    padding: 20
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8
  },
  blueIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center'
  },
  statCardTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800'
  },
  statCardSubtitle: {
    color: 'rgba(180, 196, 230, 0.75)',
    fontSize: 12,
    lineHeight: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(254, 215, 102, 0.15)',
    paddingBottom: 12,
    marginBottom: 14
  },
  pillRowsContainer: {
    gap: 10
  },
  statRowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1
  },
  rowPillGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.5)',
    borderLeftWidth: 4,
    borderLeftColor: '#10b981'
  },
  rowPillAmber: {
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
    borderColor: 'rgba(234, 179, 8, 0.5)',
    borderLeftWidth: 4,
    borderLeftColor: '#eab308'
  },
  rowPillRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444'
  },
  rowPillIndigo: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderColor: 'rgba(99, 102, 241, 0.5)',
    borderLeftWidth: 4,
    borderLeftColor: '#818cf8'
  },
  pillLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  glowingDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: '600'
  },
  pillCount: {
    fontSize: 20,
    fontWeight: '900'
  },

  donutCardAlign: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  donutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14
  },
  donutWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10
  },
  donutOuterRing: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center'
  },
  donutHole: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#071026',
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  donutNumber: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 34
  },
  donutUnitLabel: {
    color: 'rgba(147, 197, 253, 0.9)',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 2
  },
  donutLegendRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 16,
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600'
  },

  toolbarCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12
  },
  searchBox: {
    flex: 1,
    minWidth: 160,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 6
  },
  searchInput: {
    flex: 1,
    height: 38,
    color: '#0f172a',
    fontSize: 13
  },
  filterPillsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  filterStatusLabel: {
    color: '#64748b',
    fontSize: 12.5,
    fontWeight: '600',
    marginRight: 4
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  filterPillActive: {
    backgroundColor: '#0a1432',
    borderColor: '#d4af37'
  },
  filterPillText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600'
  },
  filterPillTextActive: {
    color: '#f59e0b',
    fontWeight: '800'
  },

  whiteItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.05,
    elevation: 2
  },
  cardApprovedBorder: {
    borderLeftColor: '#10b981'
  },
  itemCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12
  },
  itemTitleGroup: {
    flex: 1,
    minWidth: 180
  },
  itemTitleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  itemNameText: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900'
  },
  badgeConfirmed: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3
  },
  badgeConfirmedText: {
    color: '#15803d',
    fontSize: 11,
    fontWeight: '800'
  },
  badgeBlue: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3
  },
  badgeBlueText: {
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: '800'
  },
  badgeGold: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3
  },
  badgeGoldText: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '800'
  },
  itemIdGradeText: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  btnActionView: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  btnActionViewText: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '700'
  },
  btnActionEdit: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  btnActionEditText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '700'
  },
  metaDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  metaCol: {
    flex: 1,
    minWidth: 140
  },
  metaLabel: {
    color: '#64748b',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 3
  },
  metaValue: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700'
  },

  matchTeamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 12,
    marginVertical: 10
  },
  matchTeamSide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 4
  },
  matchTeamTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    maxWidth: '100%'
  },
  matchScoreText: {
    color: '#b45309',
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center'
  },
  vsCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#071026',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    flexShrink: 0
  },
  vsCircleText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '900'
  },
  matchCardTournament: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800'
  },
  matchCardLocation: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2
  },
  badgeBase: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1
  },
  badgeBaseText: {
    fontSize: 11,
    fontWeight: '800'
  },
  badgeScheduled: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd'
  },
  badgeScheduledText: {
    color: '#2563eb',
    fontSize: 11,
    fontWeight: '800'
  },
  badgeLive: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5'
  },
  badgeLiveText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '800'
  },
  badgeCompleted: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0'
  },
  badgeCompletedText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '800'
  },
  resultBannerBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
    alignItems: 'center'
  },
  resultBannerText: {
    color: '#15803d',
    fontSize: 12,
    fontWeight: '700'
  },

  noticeTitleBold: {
    color: '#0f172a',
    fontSize: 14.5,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 4
  },
  noticeBodyText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18
  },

  cardHeaderTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '800'
  },
  cardHeaderSubtitle: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2
  },
  profileDetailsGrid: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  profileRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8
  },
  profileKey: {
    color: '#64748b',
    fontSize: 12.5,
    fontWeight: '600',
    width: 110,
    flexShrink: 0
  },
  profileVal: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
    ...(Platform.OS === 'web' ? ({ wordBreak: 'break-all' } as any) : {})
  },
  securityExplanation: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8
  },

  teamStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    flexWrap: 'wrap'
  },
  teamStatBox: {
    flex: 1,
    minWidth: 80,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    alignItems: 'center'
  },
  teamStatNum: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900'
  },
  teamStatLbl: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600'
  },
  squadRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  squadRowActive: {
    backgroundColor: '#fffbeb',
    borderRadius: 6
  },
  squadJerseyCircle: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#071026',
    alignItems: 'center',
    justifyContent: 'center'
  },
  squadJerseyNum: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '800'
  },
  squadMemberName: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700'
  },
  youPillBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4
  },
  youPillBadgeText: {
    color: '#b45309',
    fontSize: 9.5,
    fontWeight: '900'
  },
  squadMemberRole: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2
  },
  verifiedCheckPill: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  verifiedCheckText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '700'
  },

  statsGridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14
  },
  statMetricCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    alignItems: 'center'
  },
  statMetricValue: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900'
  },
  statMetricLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3
  },

  notifRowItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  notifIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#fffbeb',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  notifItemTitle: {
    color: '#0f172a',
    fontSize: 13.5,
    fontWeight: '800'
  },
  notifItemDate: {
    color: '#64748b',
    fontSize: 11
  },
  notifItemMessage: {
    color: '#475569',
    fontSize: 12.5,
    marginTop: 4,
    lineHeight: 18
  },

  emptyCardBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 36,
    alignItems: 'center'
  },
  emptyCardTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4
  },
  emptyCardSub: {
    color: '#64748b',
    fontSize: 13
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 18, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalCardContainer: {
    width: '100%',
    maxWidth: 580,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    elevation: 6
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  modalMainTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800'
  },
  modalSubTitle: {
    color: '#64748b',
    fontSize: 11.5,
    marginTop: 2
  },
  formGroup: {
    marginBottom: 14
  },
  formLabel: {
    color: '#334155',
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 6
  },
  formInput: {
    height: 42,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0f172a'
  },
  modalActionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 14,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0'
  },
  btnModalCancel: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff'
  },
  btnModalCancelText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700'
  },
  btnModalSave: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#d4af37'
  },
  btnModalSaveText: {
    color: '#081225',
    fontSize: 13,
    fontWeight: '800'
  },
  feedbackBannerBox: {
    padding: 10,
    marginHorizontal: 18,
    marginTop: 10,
    borderRadius: 6
  },
  feedbackSuccess: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac'
  },
  feedbackError: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5'
  },
  feedbackBannerText: {
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'center',
    color: '#0f172a'
  },

  scorecardMatchBanner: {
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    alignItems: 'center'
  },
  scorecardBannerTournament: {
    color: '#b45309',
    fontSize: 11.5,
    fontWeight: '800'
  },
  scorecardBannerTeams: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
    marginVertical: 4
  },
  scorecardBannerVenue: {
    color: '#64748b',
    fontSize: 12
  },
  scorecardBannerResultText: {
    color: '#15803d',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 6
  },
  inningsTabBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12
  },
  inningsTabBtn: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  inningsTabBtnActive: {
    backgroundColor: '#0a1432',
    borderColor: '#d4af37'
  },
  inningsTabBtnText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700'
  },
  inningsTabBtnTextActive: {
    color: '#f59e0b',
    fontWeight: '800'
  },
  inningsContentBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12
  },
  inningsHeaderTitle: {
    color: '#0f172a',
    fontSize: 13.5,
    fontWeight: '800',
    marginBottom: 10
  },
  tableBox: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    backgroundColor: '#ffffff'
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  tableHeadCell: {
    flex: 1,
    color: '#475569',
    fontSize: 11,
    fontWeight: '800'
  },
  tableBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  batterNameText: {
    color: '#0f172a',
    fontSize: 12.5,
    fontWeight: '700'
  },
  dismissalText: {
    color: '#64748b',
    fontSize: 10.5
  },
  tableBodyCell: {
    flex: 1,
    color: '#334155',
    fontSize: 12
  },

  // Achievement Patches & Performance Points Styles
  patchesCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 8
  },
  tierBadgeGoldSmall: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: '#f59e0b',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 14
  },
  tierBadgeGoldSmallText: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '800'
  },
  pointsBanner: {
    backgroundColor: '#0a1432',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)'
  },
  pointsBannerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  pointsBigText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  pointsSubText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2
  },
  tierBadgeGold: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#f59e0b',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20
  },
  tierBadgeGoldText: {
    color: '#fde68a',
    fontSize: 11.5,
    fontWeight: '800'
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 4
  },
  pointsProgressSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  pointsProgressSubText: {
    color: '#94a3b8',
    fontSize: 10.5,
    fontWeight: '600'
  },
  patchesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  patchItemCard: {
    width: '48.5%',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12
  },
  patchItemUnlocked: {
    backgroundColor: '#fefce8',
    borderColor: '#f59e0b'
  },
  patchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  patchIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  patchIconBoxUnlocked: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b'
  },
  patchBadgePill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10
  },
  patchBadgePillUnlocked: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac'
  },
  patchBadgePillUnlockedText: {
    color: '#166534',
    fontSize: 9.5,
    fontWeight: '800'
  },
  patchBadgePillLocked: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  patchBadgePillLockedText: {
    color: '#64748b',
    fontSize: 9.5,
    fontWeight: '700'
  },
  patchTitle: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 3
  },
  patchCriteria: {
    color: '#64748b',
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 8
  },
  patchProgressBarBg: {
    height: 5,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4
  },
  patchProgressBarFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 3
  },
  patchProgressText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '700'
  },
  patchTierPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1
  },
  patchTierPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  achievedBox: {
    backgroundColor: 'rgba(22, 163, 74, 0.08)',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.25)',
    marginTop: 6
  },
  achievedBoxText: {
    fontSize: 10.5,
    color: '#15803d',
    fontWeight: '800'
  },
  sealCircleBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f59e0b'
  },

  // MODULE 4: CAREER PERFORMANCE & MATCH FORM RATINGS STYLES
  ratingsCardContainer: {
    backgroundColor: '#0c1840',
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4
  },
  ratingsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 10
  },
  ratingsCardTitle: {
    color: '#f59e0b',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  ratingsCardSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2
  },
  confidenceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1
  },
  confidenceEstablished: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981'
  },
  confidenceDeveloping: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#f59e0b'
  },
  confidenceProvisional: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38bdf8'
  },
  confidenceBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: 0.5
  },
  ratingsGridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 16
  },
  overallRatingHeroCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: '#071026',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  overallRatingLabel: {
    color: '#d4af37',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8
  },
  overallRatingValue: {
    color: '#fde047',
    fontSize: 36,
    fontWeight: '900',
    textShadowColor: 'rgba(245, 158, 11, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8
  },
  overallRatingMax: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '700'
  },
  overallRatingMatches: {
    color: '#64748b',
    fontSize: 10.5,
    fontWeight: '600',
    textAlign: 'center'
  },
  formatRatingCol: {
    flex: 1.2,
    minWidth: 200,
    gap: 8,
    justifyContent: 'center'
  },
  formatRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  formatBadgeT20: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6
  },
  formatBadgeODI: {
    backgroundColor: '#10b981',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6
  },
  formatBadgeMD: {
    backgroundColor: '#8b5cf6',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6
  },
  formatMatchesText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600'
  },
  formatScoreText: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '800'
  },
  disciplineCol: {
    flex: 1.2,
    minWidth: 200,
    gap: 8,
    justifyContent: 'center'
  },
  disciplineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  disciplineLabel: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700'
  },
  disciplineScore: {
    color: '#fde047',
    fontSize: 12.5,
    fontWeight: '800'
  },
  formSectionBox: {
    backgroundColor: '#071026',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8
  },
  formTitle: {
    color: '#e2e8f0',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginRight: 10
  },
  trendPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12
  },
  trendImproving: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)'
  },
  trendDeclining: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)'
  },
  trendSteady: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)'
  },
  trendText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '800'
  },
  formToggleGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
    padding: 2
  },
  formToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6
  },
  formToggleBtnActive: {
    backgroundColor: '#f59e0b'
  },
  formToggleText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700'
  },
  formToggleTextActive: {
    color: '#0e184e',
    fontWeight: '900'
  },
  formMatchesScroll: {
    flexDirection: 'row'
  },
  formMatchCard: {
    width: 145,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  formMatchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  formMatchTournament: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
    flex: 1
  },
  formMatchRating: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 4
  },
  formMatchDate: {
    color: '#64748b',
    fontSize: 9.5,
    fontWeight: '600',
    marginBottom: 8
  },
  formChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6
  },
  scoreChip: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6
  },
  chipGold: {
    backgroundColor: 'rgba(234, 179, 8, 0.25)',
    borderWidth: 1,
    borderColor: '#eab308'
  },
  chipGreen: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 1,
    borderColor: '#22c55e'
  },
  chipRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#ef4444'
  },
  chipNeutral: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)'
  },
  scoreChipText: {
    color: '#f8fafc',
    fontSize: 10,
    fontWeight: '800'
  },
  formFieldingText: {
    color: '#a5b4fc',
    fontSize: 9.5,
    fontWeight: '600',
    marginBottom: 6
  },
  formTapScorecardText: {
    color: '#38bdf8',
    fontSize: 9.5,
    fontWeight: '700',
    textAlign: 'right'
  },
  noFormBox: {
    padding: 16,
    alignItems: 'center'
  },
  noFormDataText: {
    color: '#64748b',
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center'
  },
  photoPreviewCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#071026',
    borderWidth: 2,
    borderColor: '#d4af37',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  photoPreviewInitial: {
    color: '#f59e0b',
    fontSize: 24,
    fontWeight: '900'
  },
  btnPickPhoto: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#3b82f6',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center'
  },
  btnPickPhotoText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '700'
  },
  btnCameraPhoto: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center'
  },
  btnCameraPhotoText: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '700'
  },
  profileAvatarCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  profileAvatarLargeFrame: {
    position: 'relative',
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#071026',
    borderWidth: 2.5,
    borderColor: '#d4af37',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible'
  },
  profileAvatarLargeImg: {
    width: 69,
    height: 69,
    borderRadius: 34.5
  },
  profileAvatarLargePlaceholder: {
    width: 69,
    height: 69,
    borderRadius: 34.5,
    backgroundColor: '#071026',
    alignItems: 'center',
    justifyContent: 'center'
  },
  profileAvatarLargeText: {
    color: '#f59e0b',
    fontSize: 28,
    fontWeight: '900'
  },
  avatarEditPillBadge: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    backgroundColor: '#020612',
    borderWidth: 1,
    borderColor: '#d4af37',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  avatarEditPillText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '700'
  },
  profileAvatarName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a'
  },
  jerseyPillBadge: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12
  },
  jerseyPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1d4ed8'
  },
  profileAvatarSub: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
    fontWeight: '600'
  },
  profileAvatarFedId: {
    fontSize: 11.5,
    color: '#94a3b8',
    marginTop: 2,
    fontWeight: '500'
  },
  squadAvatarContainer: {
    position: 'relative',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  squadPhotoImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#d4af37',
    backgroundColor: '#071026'
  },
  squadAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#071026',
    borderWidth: 1.5,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center'
  },
  squadAvatarInitial: {
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: '800'
  },
  squadJerseyMiniBadge: {
    position: 'absolute',
    bottom: -3,
    right: -4,
    backgroundColor: '#020612',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  squadJerseyMiniText: {
    color: '#f59e0b',
    fontSize: 9,
    fontWeight: '900'
  },
  hasPhotoIndicatorBadge: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4
  },
  hasPhotoIndicatorText: {
    color: '#059669',
    fontSize: 9,
    fontWeight: '800'
  },
  squadModalAvatarFrame: {
    position: 'relative',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: '#d4af37',
    backgroundColor: '#071026',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  squadModalAvatarImg: {
    width: 104,
    height: 104,
    borderRadius: 52
  },
  squadModalAvatarPlaceholder: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#071026',
    alignItems: 'center',
    justifyContent: 'center'
  },
  squadModalAvatarInitial: {
    color: '#f59e0b',
    fontSize: 44,
    fontWeight: '900'
  },
  squadModalJerseyBadge: {
    position: 'absolute',
    bottom: -2,
    alignSelf: 'center',
    backgroundColor: '#020612',
    borderWidth: 1.5,
    borderColor: '#f5c43d',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  squadModalJerseyText: {
    color: '#f5c43d',
    fontSize: 11,
    fontWeight: '900'
  },
  squadModalPlayerName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2
  },
  squadModalPlayerRole: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 16
  },
  squadModalDetailsCard: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 16
  },
  squadModalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  squadModalDetailLabel: {
    fontSize: 12.5,
    color: '#64748b',
    fontWeight: '600'
  },
  squadModalDetailVal: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '700'
  },
  squadModalCloseBtn: {
    backgroundColor: '#071026',
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center'
  },
  squadModalCloseBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  // Photo Crop Modal Styles
  cropModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff'
  },
  cropIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  cropViewportWrapper: {
    backgroundColor: '#071026',
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cropContainer: {
    width: 260,
    height: 260,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative'
  },
  cropOverlayDarkCutout: {
    position: 'absolute',
    left: -90,
    top: -90,
    width: 440,
    height: 440,
    borderRadius: 220,
    borderWidth: 100,
    borderColor: 'rgba(7, 16, 38, 0.72)'
  },
  cropCircleBorder: {
    position: 'absolute',
    width: 240,
    height: 240,
    left: 10,
    top: 10,
    borderRadius: 120,
    borderWidth: 2,
    borderColor: '#f59e0b',
    borderStyle: 'dashed'
  },
  cropGridH1: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '33.3%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)'
  },
  cropGridH2: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '66.6%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)'
  },
  cropGridV1: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '33.3%',
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)'
  },
  cropGridV2: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '66.6%',
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)'
  },
  cropDragHintBadge: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)'
  },
  cropDragHintText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '600'
  },
  cropControlsContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 12
  },
  cropControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cropNudgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc'
  },
  cropControlLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  cropZoomButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden'
  },
  cropZoomValueText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    paddingHorizontal: 10,
    minWidth: 46,
    textAlign: 'center'
  },
  cropMiniBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  cropToolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fef3c7',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  cropToolBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309'
  },
  cropModalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0'
  },
  btnCropApply: {
    backgroundColor: '#d4af37',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2
  },
  btnCropApplyText: {
    color: '#020612',
    fontSize: 13,
    fontWeight: '800'
  }
});
