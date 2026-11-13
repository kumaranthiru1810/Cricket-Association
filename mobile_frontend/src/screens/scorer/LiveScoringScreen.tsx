
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  useWindowDimensions,
  Modal,
  Platform,
  TextInput,
  ActivityIndicator,
  Image
} from 'react-native';
import { useScorerNavigation } from '../../navigation/ScorerNavigationContext';

const milestoneBatsmanImage = require('../../../assets/milestone_batsman.png');
const centuryBatsmanImage = require('../../../assets/century_batsman.jpg');
import SharedFooter from '../../components/scorer/SharedFooter';
import { ScorerApi, getCurrentUser } from '../../services/api';
import { ClockPickerModal, calculateDurationMinutes } from '../../components/common/ClockPickerModal';
import CricketRulesModal, { CricketRuleType } from '../../components/scorer/CricketRulesModal';
import CricketConfetti from '../../components/common/CricketConfetti';
import CricketFigurine3D from '../../components/common/CricketFigurine3D';
import InteractiveWagonWheelModal, { ShotDirectionResult } from '../../components/analytics/InteractiveWagonWheelModal';
import UmpireSignalOverlay, { UmpireSignalEvent, UmpireSignalsGalleryModal, UmpireSignalType } from '../../components/common/UmpireSignalOverlay';
import FieldingEventOverlay, { FieldingEventData, FieldingEventType } from '../../components/common/FieldingEventOverlay';
import BroadcastLiveBallAction from '../../components/common/BroadcastLiveBallAction';
import CalculationSettingsManagement from '../../admin/components/CalculationSettingsManagement';

const IMG_LOGO = require('../../../assets/logo_transparent.png');
const IMG_CHAMPIONS = require('../../../assets/cricket_champions.png');
const IMG_END_INNINGS = require('../../../assets/cricket_end_innings.png');
const IMG_MAN_OF_THE_MATCH = require('../../../assets/man_of_the_match.png');
const catchMilestoneImage = require('../../../assets/catch_milestone.jpg');
const bestBowlerImage = require('../../../assets/best_bowler.png');
const runOutMilestoneImage = require('../../../assets/run_out_milestone.png');
const keeperDismissalImage = require('../../../assets/keeper_dismissal.png');
const overthrowImage = require('../../../assets/overthrow.jpg');
const doubleCenturyImage = require('../../../assets/double_century_200.jpg');
const team50Image = require('../../../assets/team_50.jpg');
const team100Image = require('../../../assets/team_100.jpg');

const STANDARD_BREAK_OPTIONS = [
  { label: 'Tea break', icon: '☕', sub: 'Afternoon tea interval' },
  { label: 'Lunch', icon: '🍽️', sub: 'Lunch interval' },
  { label: 'Drinks', icon: '🥤', sub: 'Drinks break' },
  { label: 'Rain break', icon: '🌧️', sub: 'Weather interruption' },
  { label: 'Bad light', icon: '⛅', sub: 'Low visibility interruption' },
  { label: 'Innings break', icon: '🏏', sub: 'Change of innings' },
  { label: 'Player Injury', icon: '🩹', sub: 'Physio / medical attention' },
  { label: 'Ground Inspection', icon: '🌱', sub: 'Umpires inspection' },
  { label: 'Sight Screen Delay', icon: '🛑', sub: 'Sight screen adjustment' },
  { label: 'Ball Lost / Damage', icon: '⚾', sub: 'Ball replacement' },
  { label: 'Other / Custom Break', icon: '✏️', sub: 'Type custom break reason below' }
];

const STANDARD_PENALTY_REASONS = [
  'Ball hit helmet in field of play (5 Penalty Runs)',
  'Player entering without permission touches ball in play',
  'Fielding the ball wilfully fielding it otherwise',
  "Changing ball's condition unlawfully",
  "Batter's attempt to distract striker / bowler",
  'Deliberate distraction or obstruction of batsman',
  'Time wasting by fielding side',
  'Fielder damaging the pitch',
  'Batter damaging the pitch (Deliberate)',
  'Unfair play / Unsportsmanlike conduct',
  'Dissent towards umpire decision'
];

const STANDARD_SESSION_OPTIONS = [
  { label: 'Morning Session', icon: '🌅', sub: 'Session 1' },
  { label: 'Lunch', icon: '🍽️', sub: 'Lunch interval' },
  { label: 'Afternoon Session', icon: '☀️', sub: 'Session 2' },
  { label: 'Tea', icon: '☕', sub: 'Tea interval' },
  { label: 'Evening Session', icon: '🌇', sub: 'Session 3' },
  { label: 'End of Day', icon: '🌙', sub: 'Stumps' },
  { label: 'Extended Session', icon: '⏱️', sub: 'Overs recovery' },
  { label: 'Rain Delayed Session', icon: '🌧️', sub: 'Weather revised session' },
  { label: 'Other / Custom Session', icon: '✏️', sub: 'Type custom session below' }
];

const BALL_TYPE_OPTIONS = [
  'Good Length',
  'Yorker',
  'Bouncer',
  'Slow Bouncer',
  'In-Swinger',
  'Out-Swinger',
  'Off Cutter',
  'Leg Cutter',
  'Slower Ball',
  'Full Toss',
  'Short Pitch'
];

const SHOT_TYPE_OPTIONS = [
  'Defensive',
  'Forward Defence',
  'Backfoot Defence',
  'Cover Drive',
  'Straight Drive',
  'On Drive',
  'Square Cut',
  'Late Cut',
  'Pull',
  'Hook',
  'Sweep',
  'Reverse Sweep',
  'Flick',
  'Glance',
  'Upper Cut',
  'Lofted Shot',
  'Left Alone',
  'No Shot'
];

export default function LiveScoringScreen() {
  const { navigate, params, onExit } = useScorerNavigation();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const matchId = params?.matchId ||
    (Platform.OS === 'web' && typeof window !== 'undefined'
      ? (new URL(window.location.href).searchParams.get('matchId') || localStorage.getItem('cfvd_last_scorer_match_id'))
      : null) ||
    'M002';
  const styles = getStyles(isDesktop);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        localStorage.setItem('cfvd_last_scorer_screen', 'LiveScoring');
        if (matchId) {
          localStorage.setItem('cfvd_last_scorer_match_id', matchId);
          const currentUrl = new URL(window.location.href);
          if (currentUrl.searchParams.get('scorerScreen') !== 'LiveScoring' || currentUrl.searchParams.get('matchId') !== matchId) {
            currentUrl.searchParams.set('scorerScreen', 'LiveScoring');
            currentUrl.searchParams.set('matchId', matchId);
            window.history.replaceState({ appScreen: 'Scorer', scorerScreen: 'LiveScoring', matchId }, '', currentUrl.toString());
          }
        }
      } catch (e) { }
    }
  }, [matchId]);

  const currentUser = getCurrentUser();
  const [profileUser, setProfileUser] = useState<any>(currentUser);

  useEffect(() => {
    ScorerApi.getMe()
      .then((res: any) => {
        const u = res?.user || res?.data;
        if (u) {
          setProfileUser(u);
        }
      })
      .catch(() => { });
  }, []);

  const activeUser = profileUser || currentUser;
  const scorerEmail = activeUser?.email || 'palaniselvi2004@gmail.com';
  const scorerName = (
    activeUser?.name ||
    activeUser?.full_name ||
    (activeUser?.email ? activeUser.email.split('@')[0] : '') ||
    'S. Ramesh'
  ).trim();

  const scorerCertLevel = (
    activeUser?.certificationLevel ||
    activeUser?.scorer_details?.certification_level ||
    activeUser?.scorer_details?.certificationLevel ||
    'District Certified'
  ).trim();

  const scorerInitials = scorerName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() || '')
    .join('') || 'SC';

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Loading States (Only initial load shows full-screen spinner; background refreshes are seamless)
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Real Persistent Match & Innings State from MongoDB
  const [matchInfo, setMatchInfo] = useState<any>(null);
  const [runs, setRuns] = useState<number>(0);
  const [wickets, setWickets] = useState<number>(0);
  const [balls, setBalls] = useState<number>(0);
  const [matchStatus, setMatchStatus] = useState<string>('LIVE');
  const [isInningsBreak, setIsInningsBreak] = useState<boolean>(false);
  const [isMatchEnded, setIsMatchEnded] = useState<boolean>(false);
  const [confettiActive, setConfettiActive] = useState<boolean>(true);
  const [targetRuns, setTargetRuns] = useState<number | null>(null);
  const [allInningsList, setAllInningsList] = useState<any[]>([]);

  const playVictoryFanfare = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        const notes = [
          { freq: 261.63, start: 0, dur: 0.15 }, // C4
          { freq: 329.63, start: 0.15, dur: 0.15 }, // E4
          { freq: 392.00, start: 0.30, dur: 0.18 }, // G4
          { freq: 523.25, start: 0.48, dur: 0.55 }, // C5 High
        ];
        notes.forEach(({ freq, start, dur }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
          gain.gain.setValueAtTime(0.001, ctx.currentTime + start);
          gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + start + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + dur);
        });
      } catch (_e) { }
    }
  };

  // Striker, Non-Striker & Bowler
  const [striker, setStriker] = useState<any>(null);
  const [nonStriker, setNonStriker] = useState<any>(null);
  const [bowler, setBowler] = useState<any>(null);

  // Over Status & Next Bowler Modal
  const [isOverComplete, setIsOverComplete] = useState<boolean>(false);
  const [previousBowlerId, setPreviousBowlerId] = useState<string | null>(null);
  const [bowlingSquad, setBowlingSquad] = useState<any[]>([]);
  const [showBowlerModal, setShowBowlerModal] = useState<boolean>(false);
  const [selectedNextBowlerId, setSelectedNextBowlerId] = useState<string>('');
  const [isSubmittingBowler, setIsSubmittingBowler] = useState<boolean>(false);
  const [bowlerErrorMessage, setBowlerErrorMessage] = useState<string | null>(null);

  // Delivery Submission State
  const [isSubmittingDelivery, setIsSubmittingDelivery] = useState<boolean>(false);
  const [isUndoing, setIsUndoing] = useState<boolean>(false);
  const [isStartingNextInnings, setIsStartingNextInnings] = useState<boolean>(false);

  // Comprehensive Wicket & Dismissal State
  const [showWicketModal, setShowWicketModal] = useState<boolean>(false);
  const [wicketStep, setWicketStep] = useState<1 | 2>(1);
  const [battingSquad, setBattingSquad] = useState<any[]>([]);
  const [dismissedBatters, setDismissedBatters] = useState<string[]>([]);
  const [selectedNextBatterId, setSelectedNextBatterId] = useState<string>('');
  const [isBatterDropdownOpen, setIsBatterDropdownOpen] = useState<boolean>(false);
  const [batterSearchQuery, setBatterSearchQuery] = useState<string>('');
  const [customBatterName, setCustomBatterName] = useState<string>('');
  const [wicketType, setWicketType] = useState<string>('BOWLED');
  const [dismissedTarget, setDismissedTarget] = useState<'striker' | 'nonStriker'>('striker');
  const [selectedFielderId, setSelectedFielderId] = useState<string>('');
  const [customFielderName, setCustomFielderName] = useState<string>('');
  const [isFielderDropdownOpen, setIsFielderDropdownOpen] = useState<boolean>(false);
  const [fielderSearchQuery, setFielderSearchQuery] = useState<string>('');
  const [runsOnWicket, setRunsOnWicket] = useState<number>(0);
  const [lastDismissal, setLastDismissal] = useState<any>(null);

  // Custom Runs & Extra Runs Input Modal State
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);
  const [customRunsInput, setCustomRunsInput] = useState<string>('5');
  const [customCategory, setCustomCategory] = useState<string>('normal');
  const [customRunsReason, setCustomRunsReason] = useState<string>('');

  // End Innings Modal
  const [showEndModal, setShowEndModal] = useState<boolean>(false);

  // Smart Cricket Rule & Umpire Assistant Modal
  const [showCricketRulesModal, setShowCricketRulesModal] = useState<boolean>(false);
  const [activeCricketRule, setActiveCricketRule] = useState<CricketRuleType | null>('FREE_HIT');
  const [cricketRuleContext, setCricketRuleContext] = useState<any>({});
  const [isFreeHitActive, setIsFreeHitActive] = useState<boolean>(false);
  const [consecutiveWidesCount, setConsecutiveWidesCount] = useState<number>(0);

  // --- SCORER SIDE OPTIONS & DOCUMENT WORKFLOW STATES ---
  // Live Clock for Slide Menu
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');

  // Wi-Fi / Connectivity Status (New Feature from Manual)
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Scorer Side Options Drawer
  const [showSideDrawer, setShowSideDrawer] = useState<boolean>(false);

  // 1. Breaks Modal State
  const [showBreaksModal, setShowBreaksModal] = useState<boolean>(false);
  const [currentBreak, setCurrentBreak] = useState<any>(null);
  const [breaksList, setBreaksList] = useState<any[]>([]);
  const [breakType, setBreakType] = useState<string>('Tea break');
  const [isBreakTypeDropdownOpen, setIsBreakTypeDropdownOpen] = useState<boolean>(false);
  const [customBreakTypeInput, setCustomBreakTypeInput] = useState<string>('');
  const [breakStartTime, setBreakStartTime] = useState<string>('11:35 am');
  const [breakEndTime, setBreakEndTime] = useState<string>('11:40 am');
  const [breakDuration, setBreakDuration] = useState<string>('5');
  const [isDurationAutoCalculated, setIsDurationAutoCalculated] = useState<boolean>(true);
  const [excludeBatsmanTime, setExcludeBatsmanTime] = useState<boolean>(false);
  const [isSubmittingBreak, setIsSubmittingBreak] = useState<boolean>(false);
  const [showResumeConfirmModal, setShowResumeConfirmModal] = useState<boolean>(false);

  // Resume play from active break
  const handleResumePlay = async () => {
    try {
      await ScorerApi.endBreak(matchId);
      setCurrentBreak(null);
      await loadLiveState(false);
      const msg = 'Play resumed successfully.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Play Resumed', msg);
    } catch (err: any) {
      const msg = err.message || 'Failed to resume play.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    }
  };

  // Clock Picker Modal State
  const [clockPickerVisible, setClockPickerVisible] = useState<boolean>(false);
  const [clockPickerTarget, setClockPickerTarget] = useState<'BREAK_START' | 'BREAK_END' | 'SESSION_START' | 'SESSION_END'>('BREAK_START');

  // Open Breaks modal with current time and default duration
  const handleOpenBreaksModal = () => {
    const now = new Date();
    let h = now.getHours();
    const m = now.getMinutes();
    const p = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    const startFormatted = `${h}:${String(m).padStart(2, '0')} ${p}`;

    const endTotal = ((h % 12 + (p === 'pm' ? 12 : 0)) * 60 + m + 15) % 1440;
    let endH = Math.floor(endTotal / 60);
    const endM = endTotal % 60;
    const endP = endH >= 12 ? 'pm' : 'am';
    endH = endH % 12 || 12;
    const endFormatted = `${endH}:${String(endM).padStart(2, '0')} ${endP}`;

    setBreakStartTime(startFormatted);
    setBreakEndTime(endFormatted);
    setBreakDuration('15');
    setIsDurationAutoCalculated(true);
    setShowBreaksModal(true);
  };

  const handleBreakStartTimeChange = (val: string) => {
    setBreakStartTime(val);
    const mins = calculateDurationMinutes(val, breakEndTime);
    if (mins !== null) {
      setBreakDuration(String(mins));
      setIsDurationAutoCalculated(true);
    }
  };

  const handleBreakEndTimeChange = (val: string) => {
    setBreakEndTime(val);
    const mins = calculateDurationMinutes(breakStartTime, val);
    if (mins !== null) {
      setBreakDuration(String(mins));
      setIsDurationAutoCalculated(true);
    }
  };

  const handleClockPickerSelect = (formattedTime: string) => {
    if (clockPickerTarget === 'BREAK_START') {
      setBreakStartTime(formattedTime);
      const mins = calculateDurationMinutes(formattedTime, breakEndTime);
      if (mins !== null) {
        setBreakDuration(String(mins));
        setIsDurationAutoCalculated(true);
      }
    } else if (clockPickerTarget === 'BREAK_END') {
      setBreakEndTime(formattedTime);
      const mins = calculateDurationMinutes(breakStartTime, formattedTime);
      if (mins !== null) {
        setBreakDuration(String(mins));
        setIsDurationAutoCalculated(true);
      }
    } else if (clockPickerTarget === 'SESSION_START') {
      setSessionStartTime(formattedTime);
    } else if (clockPickerTarget === 'SESSION_END') {
      setSessionEndTime(formattedTime);
    }
    setClockPickerVisible(false);
  };

  // 2. Sessions Modal State
  const [showSessionsModal, setShowSessionsModal] = useState<boolean>(false);
  const [sessionsList, setSessionsList] = useState<any[]>([]);
  const [sessionDayNo, setSessionDayNo] = useState<string>('1');
  const [sessionType, setSessionType] = useState<string>('Lunch');
  const [isSessionTypeDropdownOpen, setIsSessionTypeDropdownOpen] = useState<boolean>(false);
  const [customSessionTypeInput, setCustomSessionTypeInput] = useState<string>('');
  const [sessionStartInnings, setSessionStartInnings] = useState<string>('1');
  const [sessionEndInnings, setSessionEndInnings] = useState<string>('1');
  const [sessionStartOver, setSessionStartOver] = useState<string>('0.0');
  const [sessionEndOver, setSessionEndOver] = useState<string>('25.0');
  const [sessionStartTime, setSessionStartTime] = useState<string>('09:30 am');
  const [sessionEndTime, setSessionEndTime] = useState<string>('12:30 pm');
  const [sessionDuration, setSessionDuration] = useState<string>('180');
  const [isSubmittingSession, setIsSubmittingSession] = useState<boolean>(false);

  // 3. End Day Modal State
  const [showEndDayModal, setShowEndDayModal] = useState<boolean>(false);
  const [endDayNo, setEndDayNo] = useState<string>('1');
  const [endDayStartInnings, setEndDayStartInnings] = useState<string>('1');
  const [endDayEndInnings, setEndDayEndInnings] = useState<string>('1');
  const [endDayOvers, setEndDayOvers] = useState<string>('90.0');
  const [endDayStartTime, setEndDayStartTime] = useState<string>('09:30 am');
  const [endDayEndTime, setEndDayEndTime] = useState<string>('05:30 pm');
  const [endDayDuration, setEndDayDuration] = useState<string>('480');
  const [endDayComments, setEndDayComments] = useState<string>('Day 1 Stumps');
  const [isSubmittingEndDay, setIsSubmittingEndDay] = useState<boolean>(false);

  // 4. Declare Innings Modal State
  const [showDeclareModal, setShowDeclareModal] = useState<boolean>(false);
  const [isSubmittingDeclare, setIsSubmittingDeclare] = useState<boolean>(false);

  // 5. Match Events Menu & Sub-modals
  const [showMatchEventsModal, setShowMatchEventsModal] = useState<boolean>(false);

  // 5a. Match Start / End Time
  const [showMatchTimesModal, setShowMatchTimesModal] = useState<boolean>(false);
  const [matchStartDate, setMatchStartDate] = useState<string>('2026-10-06');
  const [matchStartTimeInput, setMatchStartTimeInput] = useState<string>('09:30 AM');
  const [matchEndTimeInput, setMatchEndTimeInput] = useState<string>('01:00 PM');
  const [isSubmittingMatchTimes, setIsSubmittingMatchTimes] = useState<boolean>(false);

  // 5b. Penalty Points
  const [showPenaltyModal, setShowPenaltyModal] = useState<boolean>(false);
  const [penaltyType, setPenaltyType] = useState<string>('Batting Penalty');
  const [penaltyReason, setPenaltyReason] = useState<string>("Ball hit helmet in field of play (5 Penalty Runs)");
  const [penaltyPointsInput, setPenaltyPointsInput] = useState<string>('5');
  const [isSubmittingPenalty, setIsSubmittingPenalty] = useState<boolean>(false);
  const [penaltyTargetTeam, setPenaltyTargetTeam] = useState<'A' | 'B'>('A');
  const [customPenaltyReason, setCustomPenaltyReason] = useState<string>('');
  const [isPenaltyReasonDropdownOpen, setIsPenaltyReasonDropdownOpen] = useState<boolean>(false);

  // 5c. Other Wickets
  const [showOtherWicketModal, setShowOtherWicketModal] = useState<boolean>(false);
  const [otherWicketType, setOtherWicketType] = useState<string>('RETIRED_HURT');
  const [otherWicketPlayerId, setOtherWicketPlayerId] = useState<string>('');
  const [otherWicketComments, setOtherWicketComments] = useState<string>('Retired hurt due to injury');
  const [otherWicketReplacementId, setOtherWicketReplacementId] = useState<string>('');
  const [isSubmittingOtherWicket, setIsSubmittingOtherWicket] = useState<boolean>(false);

  // 5d. Change Ball
  const [showChangeBallModal, setShowChangeBallModal] = useState<boolean>(false);
  const [ballTypeChoice, setBallTypeChoice] = useState<string>('New Ball');
  const [ballChangeOver, setBallChangeOver] = useState<string>('10.0');
  const [ballChangeComments, setBallChangeComments] = useState<string>('Ball lost out of ground');
  const [isSubmittingBallChange, setIsSubmittingBallChange] = useState<boolean>(false);

  // 6. Change Team Modal State (Before 1st ball)
  const [showChangeTeamModal, setShowChangeTeamModal] = useState<boolean>(false);
  const [changeTeamBattingTeamId, setChangeTeamBattingTeamId] = useState<string>('');
  const [changeTeamStrikerId, setChangeTeamStrikerId] = useState<string>('');
  const [changeTeamNonStrikerId, setChangeTeamNonStrikerId] = useState<string>('');
  const [changeTeamBowlerId, setChangeTeamBowlerId] = useState<string>('');
  const [isSubmittingChangeTeam, setIsSubmittingChangeTeam] = useState<boolean>(false);

  // --- PRIMARY ENGINE FUNCTIONALITY STATES (from manual) ---
  const [isBallInProgress, setIsBallInProgress] = useState<boolean>(false);
  const [bowlingMode, setBowlingMode] = useState<'OVER_THE_WICKET' | 'AROUND_THE_WICKET'>('OVER_THE_WICKET');

  // Ball Type & Shot Type
  const [selectedBallType, setSelectedBallType] = useState<string>('Good Length');
  const [isBallTypeDropdownOpen, setIsBallTypeDropdownOpen] = useState<boolean>(false);
  const [showBallTypeModal, setShowBallTypeModal] = useState<boolean>(false);
  const [selectedShotType, setSelectedShotType] = useState<string>('Defensive');
  const [isShotTypeDropdownOpen, setIsShotTypeDropdownOpen] = useState<boolean>(false);
  const [showShotTypeModal, setShowShotTypeModal] = useState<boolean>(false);

  // Auxiliary Features
  const [isMarkedForEdit, setIsMarkedForEdit] = useState<boolean>(false);
  const [showRemarksModal, setShowRemarksModal] = useState<boolean>(false);
  const [deliveryRemarks, setDeliveryRemarks] = useState<string>('');
  const [showPitchMapModal, setShowPitchMapModal] = useState<boolean>(false);
  const [selectedPitchLength, setSelectedPitchLength] = useState<string>('Good Length');

  // Keypad Popups
  const [showMoreRunsModal, setShowMoreRunsModal] = useState<boolean>(false);
  const [showOverThrowModal, setShowOverThrowModal] = useState<boolean>(false);
  const [customOverthrowInput, setCustomOverthrowInput] = useState<string>('');
  const [showExtrasModal, setShowExtrasModal] = useState<boolean>(false);
  const [showFieldingModal, setShowFieldingModal] = useState<boolean>(false);
  const [selectedFieldingAction, setSelectedFieldingAction] = useState<string>('Clean Collect');
  const [showWagonWheelModal, setShowWagonWheelModal] = useState<boolean>(false);
  const [selectedWagonSector, setSelectedWagonSector] = useState<string>('Cover');
  const [pendingBoundaryRun, setPendingBoundaryRun] = useState<number | null>(null);

  // 7. Umpire Assessment Modal State
  const [showUmpireModal, setShowUmpireModal] = useState<boolean>(false);
  const [umpire1Name, setUmpire1Name] = useState<string>('K. Sundar');
  const [umpire1Rating, setUmpire1Rating] = useState<string>('8');
  const [umpire2Name, setUmpire2Name] = useState<string>('M. Karthik');
  const [umpire2Rating, setUmpire2Rating] = useState<string>('8');
  const [pitchReportInput, setPitchReportInput] = useState<string>('Good sporting track with true bounce');
  const [umpireCommentsInput, setUmpireCommentsInput] = useState<string>('Fair match without disputes');
  const [isSubmittingUmpire, setIsSubmittingUmpire] = useState<boolean>(false);

  // 8. Edit Mode Flag & Retroactive Direct Ball Edit
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [recentDeliveries, setRecentDeliveries] = useState<any[]>([]);
  const [editingDelivery, setEditingDelivery] = useState<any | null>(null);
  const [showEditDeliveryModal, setShowEditDeliveryModal] = useState<boolean>(false);
  const [editRunsInput, setEditRunsInput] = useState<number>(0);
  const [editExtraType, setEditExtraType] = useState<'NONE' | 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE'>('NONE');
  const [editWicket, setEditWicket] = useState<boolean>(false);
  const [editWicketType, setEditWicketType] = useState<string>('BOWLED');
  const [isSubmittingEditDelivery, setIsSubmittingEditDelivery] = useState<boolean>(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);

  // 9. Revised Overs & Revised Target Modal State
  const [showRevisedOversModal, setShowRevisedOversModal] = useState<boolean>(false);
  const [revisedOversInput, setRevisedOversInput] = useState<string>('20');
  const [revisedTargetInput, setRevisedTargetInput] = useState<string>('');
  const [revisedCommentsInput, setRevisedCommentsInput] = useState<string>('');
  const [isSubmittingRevised, setIsSubmittingRevised] = useState<boolean>(false);

  // 10. Playing XI Edit Modal State
  const [showPlayingXIModal, setShowPlayingXIModal] = useState<boolean>(false);
  const [playingXIStep, setPlayingXIStep] = useState<1 | 2 | 3>(1);
  const [playingXITeam, setPlayingXITeam] = useState<'A' | 'B'>('A');
  const [selectedPlayingXI, setSelectedPlayingXI] = useState<string[]>([]);
  const [isSubmittingPlayingXI, setIsSubmittingPlayingXI] = useState<boolean>(false);

  // 11. End Match & Super Over Modal State
  const [showEndMatchModal, setShowEndMatchModal] = useState<boolean>(false);
  const [endMatchResult, setEndMatchResult] = useState<'WIN' | 'TIE'>('WIN');
  const [winnerTeamId, setWinnerTeamId] = useState<string>('');
  const [isSuperOverSelected, setIsSuperOverSelected] = useState<boolean>(false);
  const [superOverBattingTeam, setSuperOverBattingTeam] = useState<string>('');
  const [playerOfMatchInput, setPlayerOfMatchInput] = useState<string>('');
  const [isSubmittingEndMatch, setIsSubmittingEndMatch] = useState<boolean>(false);

  // 12. Exit Screen Modal State
  const [showExitModal, setShowExitModal] = useState<boolean>(false);

  // 13. Cricket Milestones Celebration State (50s, 100s, 5-Wickets, Catches, Run Outs, Keeper Outs, MOTM)
  interface MilestoneCelebration {
    type: 'BATTER_50' | 'BATTER_100' | 'BATTER_150' | 'BATTER_200' | 'BOWLER_3W' | 'BOWLER_5W' | 'HAT_TRICK' | 'TOP_CATCHES' | 'RUN_OUT' | 'KEEPER_OUT' | 'MAN_OF_THE_MATCH' | 'TEAM_50' | 'TEAM_100' | 'TEAM_150' | 'TEAM_200';
    title: string;
    badge: string;
    subtitle: string;
    playerName: string;
    teamName: string;
    scoreText: string;
    ballsText: string;
    strikeRateText?: string;
    fours?: number;
    sixes?: number;
    imageKey?: 'BATSMAN_SHOT' | 'BATSMAN_CENTURY' | 'BOWLER' | 'CATCH' | 'RUN_OUT' | 'KEEPER' | 'MOTM';
  }
  const [activeMilestone, setActiveMilestone] = useState<MilestoneCelebration | null>(null);
  const [showMilestoneModal, setShowMilestoneModal] = useState<boolean>(false);
  const shownMilestonesRef = useRef<Set<string>>(new Set());
  const shownRulesRef = useRef<Set<string>>(new Set());

  // Broadcast Umpire Signal Overlay & Hand Signals Gallery State
  const [activeUmpireSignal, setActiveUmpireSignal] = useState<UmpireSignalEvent | null>(null);
  const [showUmpireGallery, setShowUmpireGallery] = useState<boolean>(false);

  // Broadcast Fielding Event Animation Overlay State
  const [activeFieldingEvent, setActiveFieldingEvent] = useState<FieldingEventData | null>(null);

  // DLS & VJD Live Chasing Predictor Modal State
  const [showDlsModal, setShowDlsModal] = useState<boolean>(false);
  const [dlsModalMinimized, setDlsModalMinimized] = useState<boolean>(false);
  const [dlsModalMaximized, setDlsModalMaximized] = useState<boolean>(false);

  // Manual Batter Change & Strike Swap Modal State
  const [showChangeBatterModal, setShowChangeBatterModal] = useState<boolean>(false);
  const [changeBatterTarget, setChangeBatterTarget] = useState<'striker' | 'nonStriker'>('striker');
  const [selectedChangeBatterId, setSelectedChangeBatterId] = useState<string>('');
  const [customChangeBatterName, setCustomChangeBatterName] = useState<string>('');
  const [isChangeBatterDropdownOpen, setIsChangeBatterDropdownOpen] = useState<boolean>(false);
  const [changeBatterSearch, setChangeBatterSearch] = useState<string>('');
  const [isUpdatingBatter, setIsUpdatingBatter] = useState<boolean>(false);

  // Manual Bowler Change & Substitution Modal State
  const [showChangeBowlerModal, setShowChangeBowlerModal] = useState<boolean>(false);
  const [selectedChangeBowlerId, setSelectedChangeBowlerId] = useState<string>('');
  const [customChangeBowlerName, setCustomChangeBowlerName] = useState<string>('');
  const [isChangeBowlerDropdownOpen, setIsChangeBowlerDropdownOpen] = useState<boolean>(false);
  const [changeBowlerSearch, setChangeBowlerSearch] = useState<string>('');
  const [isUpdatingBowler, setIsUpdatingBowler] = useState<boolean>(false);
  const [changeBowlerReason, setChangeBowlerReason] = useState<'INJURY' | 'TACTICAL' | 'NO_BALL_SUSPENSION'>('TACTICAL');
  const [isSuspendingCurrentBowler, setIsSuspendingCurrentBowler] = useState<boolean>(false);
  const [bowlerSituation, setBowlerSituation] = useState<string>('Bowler Injured');
  const [isSituationDropdownOpen, setIsSituationDropdownOpen] = useState<boolean>(false);
  const BOWLER_SITUATIONS = [
    { id: 'INJURY', label: '🤕 Bowler Injured', text: 'Bowler Injured' },
    { id: 'CRAMPS', label: '⚠️ Cramps / Fatigue', text: 'Cramps / Fatigue' },
    { id: 'SUSPENDED', label: '🚫 Umpire Suspended (2 Dangerous No-Balls)', text: 'Umpire Suspended (2 No-Balls)' },
    { id: 'MEDICAL', label: '🚑 Medical Treatment Required', text: 'Medical Treatment' },
    { id: 'TACTICAL', label: '🔄 Captain / Tactical Call', text: 'Tactical Change' },
    { id: 'ROTATION', label: '⏱️ Bowling Rotation / Rest', text: 'Bowling Rotation' },
    { id: 'CUSTOM', label: '✏️ Other Reason (Type Below)', text: '' }
  ];

  // 2 No-Balls Dangerous Bowling Alert (MCC Law 41.7)
  const [noBallAlert, setNoBallAlert] = useState<{ bowlerId: string; bowlerName: string; count: number } | null>(null);
  const [dismissedNoBallBowlers, setDismissedNoBallBowlers] = useState<string[]>([]);

  // AI Commentary & Fielding
  const [selectedFieldPosition, setSelectedFieldPosition] = useState<string>('Cover');
  const [aiCommentary, setAiCommentary] = useState<string>('');

  const fieldingPositions = [
    'Point',
    'Cover',
    'Mid-Off',
    'Mid-On',
    'Midwicket',
    'Slips',
    'Third Man',
    'Fine Leg'
  ];

  const getOvers = (b: number) => {
    const ov = Math.floor(b / 6);
    const extraBalls = b % 6;
    return `${ov}.${extraBalls}`;
  };

  useEffect(() => {
    loadLiveState(true);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      (window as any).__OPEN_MODAL__ = (modalName: string, param?: string) => {
        if (modalName === 'wicket') {
          setShowWicketModal(true);
        } else if (modalName === 'bowler') {
          setChangeBowlerReason('TACTICAL');
          setShowChangeBowlerModal(true);
        } else if (modalName === 'injury') {
          setChangeBowlerReason('INJURY');
          setBowlerSituation('Bowler Injured');
          setIsSituationDropdownOpen(true);
          setShowChangeBowlerModal(true);
        } else if (modalName === 'overthrow') {
          setShowOverThrowModal(true);
        } else if (modalName === 'extras') {
          setShowExtrasModal(true);
        } else if (modalName === 'umpire') {
          setShowUmpireModal(true);
        } else if (modalName === 'edit') {
          setIsEditMode(true);
        } else if (modalName === 'rules') {
          if (param) setActiveCricketRule(param as any);
          setShowCricketRulesModal(true);
        } else if (modalName === 'milestone') {
          (window as any).__TRIGGER_MILESTONE__(param || '50');
        } else if (modalName === 'closeAll') {
          setShowWicketModal(false);
          setShowChangeBowlerModal(false);
          setShowOverThrowModal(false);
          setShowExtrasModal(false);
          setShowUmpireModal(false);
          setShowCricketRulesModal(false);
          setShowMilestoneModal(false);
        }
      };

      (window as any).__TRIGGER_MILESTONE__ = (type: string = '50') => {
        if (type === '200') {
          triggerMilestone({
            type: 'BATTER_200',
            title: 'DOUBLE CENTURY (200*)!',
            badge: '💎 200 RUNS DOUBLE TON 💎',
            subtitle: 'Colossal achievement! An immortal double hundred etched in history.',
            playerName: striker?.name || 'N. Jagadeesan',
            teamName: matchInfo?.battingTeam || 'Virudhunagar Spartans',
            scoreText: '202*',
            ballsText: '112 Balls',
            strikeRateText: '180.4',
            fours: 22,
            sixes: 8
          });
        } else if (type === '100') {
          triggerMilestone({
            type: 'BATTER_100',
            title: 'MAGNIFICENT CENTURY!',
            badge: '👑 100 RUNS CENTURY 👑',
            subtitle: 'Outstanding masterclass ton! Raises the bat to a standing ovation.',
            playerName: striker?.name || 'N. Jagadeesan',
            teamName: matchInfo?.battingTeam || 'Virudhunagar Spartans',
            scoreText: '100*',
            ballsText: '58 Balls',
            strikeRateText: '172.4',
            fours: 11,
            sixes: 4
          });
        } else if (type === '150') {
          triggerMilestone({
            type: 'BATTER_150',
            title: 'COLOSSAL 150* RUNS!',
            badge: '🔥 150 RUNS MILESTONE 🔥',
            subtitle: 'Unbelievable power-hitting and determination!',
            playerName: striker?.name || 'N. Jagadeesan',
            teamName: matchInfo?.battingTeam || 'Virudhunagar Spartans',
            scoreText: '150*',
            ballsText: '84 Balls',
            strikeRateText: '178.6',
            fours: 16,
            sixes: 6
          });
        } else if (type === '5w' || type === 'bowler') {
          triggerMilestone({
            type: 'BOWLER_5W',
            imageKey: 'BOWLER',
            title: 'FIVE-WICKET HAUL (FIFER)!',
            badge: '🔥 5-WICKET HAUL 🔥',
            subtitle: 'Spectacular bowling spell! Dismantles the batting lineup.',
            playerName: bowler?.name || 'S. Sandeep Warrier',
            teamName: matchInfo?.bowlingTeam || 'Rajapalayam Royals',
            scoreText: '5/18',
            ballsText: '3.4 Overs',
            strikeRateText: 'ER: 4.9'
          });
        } else if (type === 'catch') {
          triggerMilestone({
            type: 'TOP_CATCHES',
            imageKey: 'CATCH',
            title: 'OUTSTANDING CATCH!',
            badge: '🦅 SPECTACULAR CATCH 🦅',
            subtitle: 'Sensational athleticism! Full-length diving catch near the boundary.',
            playerName: 'M. Siddharth',
            teamName: matchInfo?.bowlingTeam || 'Rajapalayam Royals',
            scoreText: 'WICKET',
            ballsText: 'Super Catch'
          });
        } else if (type === 'runout') {
          triggerMilestone({
            type: 'RUN_OUT',
            imageKey: 'RUN_OUT',
            title: 'DIRECT HIT RUN OUT!',
            badge: '🎯 SPECTACULAR RUN OUT 🎯',
            subtitle: 'Incredible direct-hit throw! Batter caught short of the crease.',
            playerName: 'R. Sanjay',
            teamName: 'Direct Hit Dismissal',
            scoreText: 'RUN OUT',
            ballsText: 'Bullseye Throw'
          });
        } else if (type === 'keeper') {
          triggerMilestone({
            type: 'KEEPER_OUT',
            imageKey: 'KEEPER',
            title: 'LIGHTNING STUMPING!',
            badge: '🧤 WICKETKEEPER STUMPING 🧤',
            subtitle: 'Flawless glovework! Feet out of the crease, bails dislodged in 0.12 seconds.',
            playerName: 'Dinesh Karthik',
            teamName: matchInfo?.bowlingTeam || 'Rajapalayam Royals',
            scoreText: 'STUMPED',
            ballsText: 'Lightning Gloves'
          });
        } else if (type === 'motm') {
          triggerMilestone({
            type: 'MAN_OF_THE_MATCH',
            imageKey: 'MOTM',
            title: 'MAN OF THE MATCH!',
            badge: '🏆 OFFICIAL PLAYER OF THE MATCH 🏆',
            subtitle: 'Spectacular match-winning all-round performance on the big stage!',
            playerName: matchInfo?.playerOfTheMatch || 'N. Jagadeesan',
            teamName: matchInfo?.battingTeam || 'Virudhunagar Spartans',
            scoreText: '86* (48b)',
            ballsText: 'Match Winner',
            strikeRateText: 'SR: 179.2',
            fours: 8,
            sixes: 4
          });
        } else {
          triggerMilestone({
            type: 'BATTER_50',
            title: 'HALF-CENTURY!',
            badge: '⭐ 50 RUNS MILESTONE ⭐',
            subtitle: 'Splendid half-century under pressure! A crucial innings for the team.',
            playerName: striker?.name || 'N. Jagadeesan',
            teamName: matchInfo?.battingTeam || 'Virudhunagar Spartans',
            scoreText: '52*',
            ballsText: '31 Balls',
            strikeRateText: '167.7',
            fours: 6,
            sixes: 3
          });
        }
      };
    }

    // Socket.IO real-time score updates
    const socket = ScorerApi.connectSocket(matchId, (payload) => {
      if (payload && payload.score) {
        const parts = payload.score.split('/');
        if (parts.length === 2) {
          setRuns(parseInt(parts[0], 10) || 0);
          setWickets(parseInt(parts[1], 10) || 0);
        }
      }
      if (payload && payload.isOverComplete !== undefined) {
        setIsOverComplete(payload.isOverComplete);
        if (payload.isOverComplete && matchStatus === 'LIVE') {
          setShowBowlerModal(true);
        }
      }
      if (payload?.action === 'BREAK_ENDED' || payload?.currentBreak === null) {
        setCurrentBreak(null);
      } else if (payload?.action === 'BREAK_ADDED' && payload?.currentBreak) {
        setCurrentBreak(payload.currentBreak);
      }
      if (payload?.noBallWarning && !dismissedNoBallBowlers.includes(payload.noBallWarning.bowlerId)) {
        setNoBallAlert({
          bowlerId: payload.noBallWarning.bowlerId,
          bowlerName: payload.noBallWarning.bowlerName || bowler?.name || 'Current Bowler',
          count: payload.noBallWarning.noBallCount || 2
        });
      }
    });

    return () => {
      ScorerApi.disconnectSocket();
    };
  }, [matchId]);

  // Real-time Network Connectivity Listener (Wi-Fi symbol green/red)
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.navigator !== 'undefined') {
      setIsOnline(window.navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  // Live Digital Clock for Slide Menu
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const getWinnerInfo = () => {
    const summary = (matchInfo.resultSummary || '').trim();
    let winnerName = '';
    let winMargin = '';

    if (summary.includes(' won by ')) {
      const parts = summary.split(' won by ');
      winnerName = parts[0].trim();
      winMargin = `Won by ${parts[1].trim()}`;
    } else if (summary.includes(' won the match')) {
      const parts = summary.split(' won the match');
      winnerName = parts[0].trim();
      winMargin = 'Won the match';
    } else if (summary.toLowerCase().includes('won')) {
      winnerName = summary;
      winMargin = 'Match Champions';
    } else if (summary) {
      winnerName = summary;
      winMargin = 'Match Concluded';
    } else {
      winnerName = matchInfo.teamA || 'Match Completed';
      winMargin = 'All Innings Finished';
    }

    return { winnerName, winMargin, fullSummary: summary || `${winnerName} ${winMargin}` };
  };

  const triggerMilestone = (m: MilestoneCelebration) => {
    setActiveMilestone(m);
    setShowMilestoneModal(true);
  };

  const checkMilestones = (d: any, isInitial: boolean) => {
    if (!d) return;

    const innId = d.innings?.id || 'inn1';
    const tRuns = d.innings?.totalRuns ?? 0;
    const sRuns = d.striker?.runs;
    const sId = d.striker?.id || d.striker?.name || 's1';
    const nsRuns = d.nonStriker?.runs;
    const nsId = d.nonStriker?.id || d.nonStriker?.name || 'ns1';
    const bWkts = d.bowler?.wickets;
    const bId = d.bowler?.id || d.bowler?.name || 'b1';

    // ── STEP 1: DYNAMIC BIDIRECTIONAL PRUNING (Handles Undo Ball & Retroactive Edits) ──
    // If scores dropped below milestone thresholds (via Undo or Edit), delete those milestone keys
    // so that when the team or batter reaches the milestone again, the 3D celebration triggers reliably!
    if (tRuns < 50) {
      shownMilestonesRef.current.delete(`team_50_${innId}`);
      shownMilestonesRef.current.delete(`team_100_${innId}`);
      shownMilestonesRef.current.delete(`team_150_${innId}`);
      shownMilestonesRef.current.delete(`team_200_${innId}`);
    } else if (tRuns < 100) {
      shownMilestonesRef.current.delete(`team_100_${innId}`);
      shownMilestonesRef.current.delete(`team_150_${innId}`);
      shownMilestonesRef.current.delete(`team_200_${innId}`);
    } else if (tRuns < 150) {
      shownMilestonesRef.current.delete(`team_150_${innId}`);
      shownMilestonesRef.current.delete(`team_200_${innId}`);
    } else if (tRuns < 200) {
      shownMilestonesRef.current.delete(`team_200_${innId}`);
    }

    if (sRuns !== undefined) {
      if (sRuns < 50) {
        shownMilestonesRef.current.delete(`50_${sId}_${innId}`);
        shownMilestonesRef.current.delete(`100_${sId}_${innId}`);
        shownMilestonesRef.current.delete(`150_${sId}_${innId}`);
        shownMilestonesRef.current.delete(`200_${sId}_${innId}`);
      } else if (sRuns < 100) {
        shownMilestonesRef.current.delete(`100_${sId}_${innId}`);
        shownMilestonesRef.current.delete(`150_${sId}_${innId}`);
        shownMilestonesRef.current.delete(`200_${sId}_${innId}`);
      } else if (sRuns < 150) {
        shownMilestonesRef.current.delete(`150_${sId}_${innId}`);
        shownMilestonesRef.current.delete(`200_${sId}_${innId}`);
      } else if (sRuns < 200) {
        shownMilestonesRef.current.delete(`200_${sId}_${innId}`);
      }
    }

    if (nsRuns !== undefined) {
      if (nsRuns < 50) {
        shownMilestonesRef.current.delete(`50_${nsId}_${innId}`);
        shownMilestonesRef.current.delete(`100_${nsId}_${innId}`);
        shownMilestonesRef.current.delete(`150_${nsId}_${innId}`);
      } else if (nsRuns < 100) {
        shownMilestonesRef.current.delete(`100_${nsId}_${innId}`);
        shownMilestonesRef.current.delete(`150_${nsId}_${innId}`);
      } else if (nsRuns < 150) {
        shownMilestonesRef.current.delete(`150_${nsId}_${innId}`);
      }
    }

    if (bWkts !== undefined) {
      if (bWkts < 3) {
        shownMilestonesRef.current.delete(`3w_${bId}_${innId}`);
        shownMilestonesRef.current.delete(`5w_${bId}_${innId}`);
      } else if (bWkts < 5) {
        shownMilestonesRef.current.delete(`5w_${bId}_${innId}`);
      }
    }

    // On initial page mount, we only seed the passed milestones so an existing match does not suddenly pop up on initial refresh
    if (isInitial) {
      if (tRuns >= 50) shownMilestonesRef.current.add(`team_50_${innId}`);
      if (tRuns >= 100) shownMilestonesRef.current.add(`team_100_${innId}`);
      if (tRuns >= 150) shownMilestonesRef.current.add(`team_150_${innId}`);
      if (tRuns >= 200) shownMilestonesRef.current.add(`team_200_${innId}`);
      if (sRuns !== undefined) {
        if (sRuns >= 50) shownMilestonesRef.current.add(`50_${sId}_${innId}`);
        if (sRuns >= 100) shownMilestonesRef.current.add(`100_${sId}_${innId}`);
        if (sRuns >= 150) shownMilestonesRef.current.add(`150_${sId}_${innId}`);
        if (sRuns >= 200) shownMilestonesRef.current.add(`200_${sId}_${innId}`);
      }
      if (nsRuns !== undefined) {
        if (nsRuns >= 50) shownMilestonesRef.current.add(`50_${nsId}_${innId}`);
        if (nsRuns >= 100) shownMilestonesRef.current.add(`100_${nsId}_${innId}`);
      }
      if (bWkts !== undefined) {
        if (bWkts >= 3) shownMilestonesRef.current.add(`3w_${bId}_${innId}`);
        if (bWkts >= 5) shownMilestonesRef.current.add(`5w_${bId}_${innId}`);
      }
      return;
    }

    // 1. Striker Milestone (50, 100, 150, 200)
    if (d.striker && d.striker.runs !== undefined) {
      const sRuns = d.striker.runs;
      const sBalls = d.striker.balls || 0;
      const sName = d.striker.name || 'Batter';
      const sId = d.striker.id || sName;
      const team = d.innings?.battingTeam || matchInfo?.battingTeam || 'Batting Team';
      const sr = sBalls > 0 ? ((sRuns / sBalls) * 100).toFixed(1) : '0.0';

      if (sRuns >= 50 && sRuns < 100) {
        const k50 = `50_${sId}_${innId}`;
        if (!shownMilestonesRef.current.has(k50)) {
          shownMilestonesRef.current.add(k50);
          triggerMilestone({
            type: 'BATTER_50',
            title: 'HALF-CENTURY!',
            badge: '⭐ 50 RUNS MILESTONE ⭐',
            subtitle: 'Splendid half-century under pressure! A crucial innings for the team.',
            playerName: sName,
            teamName: team,
            scoreText: `${sRuns}*`,
            ballsText: `${sBalls} Balls`,
            strikeRateText: sr,
            fours: d.striker.fours || 0,
            sixes: d.striker.sixes || 0
          });
          return;
        }
      } else if (sRuns >= 100 && sRuns < 150) {
        const k100 = `100_${sId}_${innId}`;
        if (!shownMilestonesRef.current.has(k100)) {
          shownMilestonesRef.current.add(k100);
          triggerMilestone({
            type: 'BATTER_100',
            title: 'MAGNIFICENT CENTURY!',
            badge: '👑 100 RUNS CENTURY 👑',
            subtitle: 'Outstanding masterclass ton! Raises the bat to a standing ovation.',
            playerName: sName,
            teamName: team,
            scoreText: `${sRuns}*`,
            ballsText: `${sBalls} Balls`,
            strikeRateText: sr,
            fours: d.striker.fours || 0,
            sixes: d.striker.sixes || 0
          });
          return;
        }
      } else if (sRuns >= 150 && sRuns < 200) {
        const k150 = `150_${sId}_${innId}`;
        if (!shownMilestonesRef.current.has(k150)) {
          shownMilestonesRef.current.add(k150);
          triggerMilestone({
            type: 'BATTER_150',
            title: 'COLOSSAL 150* RUNS!',
            badge: '🔥 150 RUNS MILESTONE 🔥',
            subtitle: 'Unbelievable power-hitting and determination!',
            playerName: sName,
            teamName: team,
            scoreText: `${sRuns}*`,
            ballsText: `${sBalls} Balls`,
            strikeRateText: sr,
            fours: d.striker.fours || 0,
            sixes: d.striker.sixes || 0
          });
          return;
        }
      } else if (sRuns >= 200) {
        const k200 = `200_${sId}_${innId}`;
        if (!shownMilestonesRef.current.has(k200)) {
          shownMilestonesRef.current.add(k200);
          triggerMilestone({
            type: 'BATTER_200',
            title: 'HISTORIC DOUBLE TON (200*)!',
            badge: '💎 200 RUNS DOUBLE CENTURY 💎',
            subtitle: 'A historic monumental innings for the ages!',
            playerName: sName,
            teamName: team,
            scoreText: `${sRuns}*`,
            ballsText: `${sBalls} Balls`,
            strikeRateText: sr,
            fours: d.striker.fours || 0,
            sixes: d.striker.sixes || 0
          });
          return;
        }
      }
    }

    // 2. Non-Striker Milestone
    if (d.nonStriker && d.nonStriker.runs !== undefined) {
      const nsRuns = d.nonStriker.runs;
      const nsBalls = d.nonStriker.balls || 0;
      const nsName = d.nonStriker.name || 'Batter';
      const nsId = d.nonStriker.id || nsName;
      const team = d.innings?.battingTeam || matchInfo?.battingTeam || 'Batting Team';
      const sr = nsBalls > 0 ? ((nsRuns / nsBalls) * 100).toFixed(1) : '0.0';

      if (nsRuns >= 50 && nsRuns < 100) {
        const k50 = `50_${nsId}_${innId}`;
        if (!shownMilestonesRef.current.has(k50)) {
          shownMilestonesRef.current.add(k50);
          triggerMilestone({
            type: 'BATTER_50',
            title: 'HALF-CENTURY!',
            badge: '⭐ 50 RUNS MILESTONE ⭐',
            subtitle: 'Splendid half-century under pressure!',
            playerName: nsName,
            teamName: team,
            scoreText: `${nsRuns}*`,
            ballsText: `${nsBalls} Balls`,
            strikeRateText: sr,
            fours: d.nonStriker.fours || 0,
            sixes: d.nonStriker.sixes || 0
          });
          return;
        }
      } else if (nsRuns >= 100 && nsRuns < 150) {
        const k100 = `100_${nsId}_${innId}`;
        if (!shownMilestonesRef.current.has(k100)) {
          shownMilestonesRef.current.add(k100);
          triggerMilestone({
            type: 'BATTER_100',
            title: 'MAGNIFICENT CENTURY!',
            badge: '👑 100 RUNS CENTURY 👑',
            subtitle: 'Sensational ton! Raises the bat to great acclaim.',
            playerName: nsName,
            teamName: team,
            scoreText: `${nsRuns}*`,
            ballsText: `${nsBalls} Balls`,
            strikeRateText: sr,
            fours: d.nonStriker.fours || 0,
            sixes: d.nonStriker.sixes || 0
          });
          return;
        }
      }
    }

    // 3. Bowler Milestones (3 Wickets, 5 Wickets / Fifer)
    if (d.bowler && d.bowler.wickets !== undefined) {
      const bWkts = d.bowler.wickets;
      const bName = d.bowler.name || 'Bowler';
      const bId = d.bowler.id || bName;
      const bOvers = d.bowler.overs || '0.0';
      const bRuns = d.bowler.runs || 0;
      const bowlingTeam = d.innings?.bowlingTeam || matchInfo?.bowlingTeam || 'Bowling Team';

      if (bWkts >= 5) {
        const k5w = `5w_${bId}_${innId}`;
        if (!shownMilestonesRef.current.has(k5w)) {
          shownMilestonesRef.current.add(k5w);
          triggerMilestone({
            type: 'BOWLER_5W',
            imageKey: 'BOWLER',
            title: 'FIVE-WICKET HAUL (FIFER)!',
            badge: '🔥 5-WICKET HAUL 🔥',
            subtitle: 'Spectacular bowling spell! Dismantles the batting lineup.',
            playerName: bName,
            teamName: bowlingTeam,
            scoreText: `${bWkts}/${bRuns}`,
            ballsText: `${bOvers} Overs`,
            strikeRateText: `ER: ${d.bowler.economy || '0.0'}`
          });
          return;
        }
      } else if (bWkts === 3) {
        const k3w = `3w_${bId}_${innId}`;
        if (!shownMilestonesRef.current.has(k3w)) {
          shownMilestonesRef.current.add(k3w);
          triggerMilestone({
            type: 'BOWLER_3W',
            imageKey: 'BOWLER',
            title: 'THREE WICKETS HAUL!',
            badge: '🎯 3 WICKETS HAUL 🎯',
            subtitle: 'Crucial bowling breakthroughs that turned the game!',
            playerName: bName,
            teamName: bowlingTeam,
            scoreText: `${bWkts}/${bRuns}`,
            ballsText: `${bOvers} Overs`,
            strikeRateText: `ER: ${d.bowler.economy || '0.0'}`
          });
          return;
        }
      }
    }

    // 4. Team Milestones (50, 100, 150, 200 Team Runs)
    if (d.innings && d.innings.totalRuns !== undefined) {
      const tRuns = d.innings.totalRuns;
      const team = d.innings.battingTeam || matchInfo?.battingTeam || 'Batting Team';
      const teamOvers = d.innings.overs || '0.0';

      const thresholds = [
        { run: 200, badge: '🚀 TEAM 200 RUNS UP! 🚀', title: 'TEAM 200 UP!' },
        { run: 150, badge: '⚡ TEAM 150 RUNS UP! ⚡', title: 'TEAM 150 UP!' },
        { run: 100, badge: '💯 TEAM 100 RUNS UP! 💯', title: 'TEAM 100 UP!' },
        { run: 50, badge: '🏏 TEAM 50 RUNS UP! 🏏', title: 'TEAM 50 UP!' }
      ];

      for (const th of thresholds) {
        if (tRuns >= th.run) {
          const kt = `team_${th.run}_${innId}`;
          if (!shownMilestonesRef.current.has(kt)) {
            shownMilestonesRef.current.add(kt);
            triggerMilestone({
              type: ('TEAM_' + th.run) as any,
              title: th.title,
              badge: th.badge,
              subtitle: `Sensational collective batting! ${team} crosses the ${th.run}-run mark.`,
              playerName: team,
              teamName: `Overs: ${teamOvers} | Score: ${tRuns}/${d.innings.wickets || 0}`,
              scoreText: `${tRuns}/${d.innings.wickets || 0}`,
              ballsText: `${teamOvers} Ov`,
              strikeRateText: `CRR: ${d.innings.runRate || '0.0'}`
            });
            break;
          }
        }
      }
    }
  };

  const loadLiveState = async (isInitial = false) => {
    try {
      if (isInitial) {
        setIsInitialLoading(true);
      }
      setApiError(null);
      const res = await ScorerApi.getLiveState(matchId);
      if (!res || !res.data) {
        throw new Error('Failed to retrieve live match state from MongoDB.');
      }

      const d = res.data;
      const curMatchStatus = d.match?.status || 'LIVE';
      setMatchStatus(curMatchStatus);

      const curBreak = d.match?.currentBreak || null;
      setCurrentBreak(curBreak);

      const isBreak = curMatchStatus === 'INNINGS_BREAK';
      const targetVal = d.match?.revisedTarget || d.innings?.target || d.match?.targetRuns || 0;
      const isTargetReached = (d.innings?.inningsNumber === 2 && targetVal > 0 && (d.innings?.runs || 0) >= targetVal);
      const hasWinSummary = Boolean(d.match?.resultSummary && !d.match?.resultSummary.toLowerCase().includes('delayed') && (d.match?.resultSummary.toLowerCase().includes('won') || d.match?.resultSummary.toLowerCase().includes('tied')));
      const isCompleted = curMatchStatus === 'COMPLETED' || isTargetReached || hasWinSummary;
      setIsInningsBreak(isBreak);
      setIsMatchEnded(Boolean(isCompleted));

      if (d.match) {
        const teamAName = d.match.teamA || d.innings?.battingTeam || 'Team A';
        const teamBName = d.match.teamB || d.innings?.bowlingTeam || 'Team B';
        setMatchInfo({
          id: d.match.id,
          teamA: teamAName,
          teamB: teamBName,
          battingTeam: d.innings?.battingTeam || teamAName,
          bowlingTeam: d.innings?.bowlingTeam || teamBName,
          teamAId: d.match.teamAId,
          teamBId: d.match.teamBId,
          overs: d.match.revisedOvers || d.match.overs || 20,
          originalOvers: d.match.originalOvers || d.match.overs || 20,
          revisedOvers: d.match.revisedOvers || null,
          revisedTarget: d.match.revisedTarget || null,
          revisedComments: d.match.revisedComments || '',
          isSuperOver: Boolean(d.match.isSuperOver),
          tournament: d.match.tournament || 'Virudhunagar Premier League 2026',
          venue: d.match.venue || 'Kamarajar District Stadium',
          status: curMatchStatus,
          resultSummary: d.match.resultSummary || d.match.result,
          targetRuns: d.match.revisedTarget || d.innings?.target || d.match.targetRuns,
          currentInningsNumber: d.innings?.inningsNumber || 1,
          teamAPlayingXI: d.match.teamAPlayingXI || [],
          teamBPlayingXI: d.match.teamBPlayingXI || []
        });

        if (d.match.revisedOvers) {
          setRevisedOversInput(String(d.match.revisedOvers));
        } else if (d.match.overs) {
          setRevisedOversInput(String(d.match.overs));
        }
        if (d.match.revisedTarget) {
          setRevisedTargetInput(String(d.match.revisedTarget));
        }
        if (d.match.teamAId && !winnerTeamId) {
          setWinnerTeamId(d.match.teamAId);
        }
        if (d.match.teamAId && !superOverBattingTeam) {
          setSuperOverBattingTeam(d.match.teamAId);
        }
        if (d.match.umpire1_name || d.match.umpire1) {
          setUmpire1Name(d.match.umpire1_name || d.match.umpire1);
        }
        if (d.match.umpire2_name || d.match.umpire2) {
          setUmpire2Name(d.match.umpire2_name || d.match.umpire2);
        }
      }

      if (d.innings) {
        setRuns(d.innings.totalRuns ?? 0);
        setWickets(d.innings.wickets ?? 0);
        setBalls(d.innings.ballsTotal ?? 0);
        setTargetRuns(d.innings.target ?? null);
        setIsFreeHitActive(Boolean(d.innings.isFreeHit || d.innings.is_free_hit));

        const overDone = !!d.innings.isOverComplete;
        setIsOverComplete(overDone);
        setPreviousBowlerId(d.innings.previousBowlerId || null);

        // DO NOT show Next Bowler popup if innings or match has ended (Requirement 2)
        if (overDone && curMatchStatus === 'LIVE' && !isBreak && !isCompleted && !d.innings.is_completed) {
          setShowBowlerModal(true);
        } else {
          setShowBowlerModal(false);
        }
      }

      if (d.allInnings && Array.isArray(d.allInnings)) {
        setAllInningsList(d.allInnings);
      }

      if (d.striker) {
        setStriker({
          id: d.striker.id,
          name: d.striker.name,
          runs: d.striker.runs || 0,
          balls: d.striker.balls || 0,
          fours: d.striker.fours || 0,
          sixes: d.striker.sixes || 0
        });
      } else {
        setStriker(null);
      }

      if (d.nonStriker) {
        setNonStriker({
          id: d.nonStriker.id,
          name: d.nonStriker.name,
          runs: d.nonStriker.runs || 0,
          balls: d.nonStriker.balls || 0,
          fours: d.nonStriker.fours || 0,
          sixes: d.nonStriker.sixes || 0
        });
      } else {
        setNonStriker(null);
      }

      if (d.bowler) {
        setBowler({
          id: d.bowler.id,
          name: d.bowler.name,
          overs: d.bowler.overs || 0,
          runs: d.bowler.runs || 0,
          wickets: d.bowler.wickets || 0,
          maidens: d.bowler.maidens || 0,
          economy: d.bowler.economy || 0
        });
      } else {
        setBowler(null);
      }

      if (d.battingSquad && Array.isArray(d.battingSquad)) {
        setBattingSquad(d.battingSquad);
      }

      if (d.bowlingSquad && Array.isArray(d.bowlingSquad)) {
        setBowlingSquad(d.bowlingSquad);
        const prevId = d.innings?.previousBowlerId;
        const eligible = d.bowlingSquad.filter((b: any) => b.id !== prevId && !b.isPreviousBowler);
        if (eligible.length > 0) {
          setSelectedNextBowlerId((prev) => (prev ? prev : eligible[0].id));
        }
      }

      if (d.lastDelivery && d.lastDelivery.commentary) {
        setAiCommentary(d.lastDelivery.commentary);
      }
      if (d.lastDismissal) {
        setLastDismissal(d.lastDismissal);
      }
      if (d.recentDeliveries && Array.isArray(d.recentDeliveries)) {
        setRecentDeliveries(d.recentDeliveries);
      }
      if (ScorerApi.getOfflineQueueCount) {
        setOfflineQueueCount(ScorerApi.getOfflineQueueCount());
      }
      // Automatic Milestone Celebration Popup (50s, 100s, 5-Wickets, etc.)
      checkMilestones(d, isInitial);
    } catch (err: any) {
      console.error('loadLiveState error:', err);
      setApiError(err.message || 'Unable to connect to live scoring database.');
    } finally {
      if (isInitial) {
        setIsInitialLoading(false);
      }
    }
  };

  const handleScore = async (run: number, type: 'normal' | 'wide' | 'noball' | 'bye' | 'legbye', customOpts: any = {}) => {
    if (isOverComplete || showBowlerModal) {
      const msg = 'Over is complete! Please select the next bowler before scoring.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Over Complete', msg);
      setShowBowlerModal(true);
      return;
    }

    if (matchStatus !== 'LIVE' || isInningsBreak || isMatchEnded) {
      const msg = `Match is not currently LIVE (${matchStatus}). Live scoring is paused.`;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Match State', msg);
      return;
    }

    // Auto-prompt Wagon Wheel for boundaries (4s and 6s) if sector not already passed
    if ((run === 4 || run === 6) && type === 'normal' && !customOpts.wagonSector) {
      setPendingBoundaryRun(run);
      setShowWagonWheelModal(true);
      return;
    }

    if (isSubmittingDelivery) return;

    setIsSubmittingDelivery(true);

    const extraTypeMap: Record<string, string> = {
      normal: 'NONE',
      wide: 'WIDE',
      noball: 'NO_BALL',
      bye: 'BYE',
      legbye: 'LEG_BYE'
    };

    let runsBatter = 0;
    let runsExtras = 0;

    if (type === 'normal') {
      runsBatter = run;
      runsExtras = 0;
    } else if (type === 'wide') {
      runsBatter = 0;
      runsExtras = 1 + run;
    } else if (type === 'noball') {
      if (customOpts.isByeOrLegBye) {
        runsBatter = 0;
        runsExtras = 1 + run;
      } else {
        runsBatter = run;
        runsExtras = 1;
      }
    } else if (type === 'bye') {
      runsBatter = 0;
      runsExtras = run > 0 ? run : 1;
    } else if (type === 'legbye') {
      runsBatter = 0;
      runsExtras = run > 0 ? run : 1;
    }

    const finalFieldingPos =
      customOpts.wagonSector && customOpts.wagonSector !== 'Unspecified'
        ? customOpts.wagonSector
        : customOpts.wagonSector === 'Unspecified'
          ? undefined
          : (selectedWagonSector || selectedFieldPosition);

    const payload = {
      strikerId: striker?.id,
      nonStrikerId: nonStriker?.id,
      bowlerId: bowler?.id,
      runsBatter,
      runsExtras,
      extraType: extraTypeMap[type] || 'NONE',
      wicket: false,
      fieldingPosition: finalFieldingPos,
      shotType: selectedShotType,
      ballType: selectedBallType,
      bowlingMode,
      isMarkedForEdit,
      shotAngle: customOpts.shotAngle ?? undefined,
      shotDistance: customOpts.shotDistance ?? undefined,
      shotZone: customOpts.shotZone ?? finalFieldingPos ?? undefined,
      shotX: customOpts.shotX ?? undefined,
      shotY: customOpts.shotY ?? undefined,
      fielderId: selectedFielderId || undefined,
      fieldingAction: selectedFieldingAction || undefined,
      remarks: customOpts.remarks || deliveryRemarks || undefined
    };

    try {
      const res = await ScorerApi.recordDelivery(matchId, payload);
      if (!res || !res.success) {
        throw new Error(res?.message || 'Failed to record delivery.');
      }

      setIsBallInProgress(false);
      if (res.commentary) {
        setAiCommentary(res.commentary);
      }
      if (currentBreak) {
        setCurrentBreak(null);
      }

      // Seamless background update without full page refresh
      await loadLiveState(false);

      // Smart Rules Analysis: Free Hit status (Rule modal triggers ONCE per match)
      if (res.isFreeHit || res.data?.isFreeHit || type === 'noball') {
        setIsFreeHitActive(true);
        if (type === 'noball') {
          const ruleKey = `${matchId}_FREE_HIT`;
          if (!shownRulesRef.current.has(ruleKey)) {
            shownRulesRef.current.add(ruleKey);
            setActiveCricketRule('FREE_HIT');
            setCricketRuleContext({
              bowlerName: bowler?.name || 'Bowler',
              strikerName: striker?.name || 'Striker',
              nonStrikerName: nonStriker?.name || 'Non-Striker'
            });
            setShowCricketRulesModal(true);
          }
        }
      } else if (isFreeHitActive && type === 'normal') {
        setIsFreeHitActive(false);
      }

      // ─── Broadcast Umpire Signal Trigger (Official Hand Signals & Broadcast HUD) ───
      if (type === 'wide') {
        const isConsecutive = (consecutiveWidesCount + 1 >= 2);
        setActiveUmpireSignal({
          type: isConsecutive ? 'CONSECUTIVE_WIDES' : 'WIDE',
          batterName: striker?.name,
          bowlerName: bowler?.name,
          overText: `Over ${getOvers(balls)}`,
          extraDetails: isConsecutive
            ? `Consecutive wide balls bowled by ${bowler?.name || 'Bowler'} • Standing umpire caution issued`
            : '+1 Extra run added to team total • Ball must be re-bowled (MCC Law 22)'
        });
      } else if (type === 'noball') {
        setActiveUmpireSignal({
          type: 'NO_BALL',
          batterName: striker?.name,
          bowlerName: bowler?.name,
          overText: `Over ${getOvers(balls)}`,
          extraDetails: '+1 Penalty run • Mandatory Free Hit awarded for next delivery (MCC Law 21)'
        });
      } else if ((type as string) === 'deadball') {
        setActiveUmpireSignal({
          type: 'DEAD_BALL',
          batterName: striker?.name,
          bowlerName: bowler?.name,
          overText: `Over ${getOvers(balls)}`,
          extraDetails: 'Ball is dead • Delivery cancelled, ball does not count toward over (MCC Law 20)'
        });
      } else if (type === 'legbye') {
        setActiveUmpireSignal({
          type: 'LEG_BYE',
          batterName: striker?.name,
          bowlerName: bowler?.name,
          runs: runs,
          overText: `Over ${getOvers(balls)}`,
          extraDetails: `${runs} Leg Bye run(s) credited to extras • Signal to official scorer (MCC Law 23)`
        });
      } else if (type === 'bye') {
        setActiveUmpireSignal({
          type: 'BYE',
          batterName: striker?.name,
          bowlerName: bowler?.name,
          runs: runs,
          overText: `Over ${getOvers(balls)}`,
          extraDetails: `${runs} Bye run(s) credited to extras • Signal to official scorer (MCC Law 23)`
        });
      } else if (type === 'normal' && runs === 4) {
        setActiveUmpireSignal({
          type: 'FOUR',
          batterName: striker?.name,
          bowlerName: bowler?.name,
          runs: 4,
          overText: `Over ${getOvers(balls)}`,
          extraDetails: `${striker?.name || 'Batter'} hits boundary four along the ground (MCC Law 19)`
        });
      } else if (type === 'normal' && runs === 6) {
        setActiveUmpireSignal({
          type: 'SIX',
          batterName: striker?.name,
          bowlerName: bowler?.name,
          runs: 6,
          overText: `Over ${getOvers(balls)}`,
          extraDetails: `${striker?.name || 'Batter'} smashes massive six over the boundary rope (MCC Law 19)`
        });
      }

      // Smart Rules Analysis: Consecutive Wides (Triggers rule modal only ONCE per match)
      if (type === 'wide') {
        const nextWides = consecutiveWidesCount + 1;
        setConsecutiveWidesCount(nextWides);
        if (nextWides >= 2) {
          const ruleKey = `${matchId}_CONSECUTIVE_WIDES`;
          if (!shownRulesRef.current.has(ruleKey)) {
            shownRulesRef.current.add(ruleKey);
            setActiveCricketRule('CONSECUTIVE_WIDES');
            setCricketRuleContext({
              bowlerName: bowler?.name || 'Bowler',
              count: nextWides,
              overNumber: Math.floor(balls / 6) + 1
            });
            setShowCricketRulesModal(true);
          }
        }
      } else if (type === 'normal') {
        setConsecutiveWidesCount(0);
      }

      const cwWarn = res?.consecutiveWidesWarning || res?.data?.consecutiveWidesWarning;
      if (cwWarn) {
        const ruleKey = `${matchId}_CONSECUTIVE_WIDES`;
        if (!shownRulesRef.current.has(ruleKey)) {
          shownRulesRef.current.add(ruleKey);
          setActiveCricketRule('CONSECUTIVE_WIDES');
          setCricketRuleContext({
            bowlerName: cwWarn.bowlerName || bowler?.name || 'Bowler',
            count: cwWarn.count || 2,
            overNumber: cwWarn.overNumber
          });
          setShowCricketRulesModal(true);
        }
      }

      // Smart Rules Analysis: Bowler Quota (Triggers rule modal only ONCE per match per bowler)
      const bqWarn = res?.bowlerQuotaWarning || res?.data?.bowlerQuotaWarning;
      if (bqWarn) {
        const ruleKey = `${matchId}_OVER_QUOTA_${bqWarn.bowlerId || ''}`;
        if (!shownRulesRef.current.has(ruleKey)) {
          shownRulesRef.current.add(ruleKey);
          setActiveCricketRule('OVER_QUOTA');
          setCricketRuleContext({
            bowlerName: bqWarn.bowlerName || bowler?.name || 'Bowler',
            oversBowled: bqWarn.overs,
            maxQuota: bqWarn.maxQuota
          });
          setShowCricketRulesModal(true);
        }
      }

      // Check for 2 No-Balls dangerous bowling warning (MCC Law 41.7)
      const nbWarn = res?.noBallWarning || res?.data?.noBallWarning;
      const currentBowlerNoBalls = (bowler?.no_balls || bowler?.noBalls || 0) + (type === 'noball' ? 1 : 0);
      const isSecondNoBall = (nbWarn && (nbWarn.noBallCount >= 2 || nbWarn.beamerCount >= 2)) || (type === 'noball' && currentBowlerNoBalls >= 2);
      const targetBowlerId = nbWarn?.bowlerId || bowler?.id || 'B1';

      if (isSecondNoBall && !dismissedNoBallBowlers.includes(targetBowlerId)) {
        setNoBallAlert({
          bowlerId: targetBowlerId,
          bowlerName: nbWarn?.bowlerName || bowler?.name || 'Current Bowler',
          count: nbWarn?.noBallCount || currentBowlerNoBalls || 2
        });
      }

      // Trigger automatic Next Bowler popup after 6 legal deliveries (only if match is still LIVE)
      if (res.isOverComplete || res.data?.isOverComplete) {
        if (res.matchStatus === 'LIVE' && !res.data?.isMatchCompleted) {
          setShowBowlerModal(true);
        }
      }
    } catch (err: any) {
      console.error('recordDelivery error:', err);
      const msg = err.message || 'Error recording delivery. Score was not changed.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsSubmittingDelivery(false);
    }
  };

  const handleWagonWheelConfirm = async (result: ShotDirectionResult) => {
    setSelectedWagonSector(result.zone);
    setShowWagonWheelModal(false);
    if (pendingBoundaryRun !== null) {
      const r = pendingBoundaryRun;
      setPendingBoundaryRun(null);
      await handleScore(r, 'normal', {
        wagonSector: result.zone,
        shotZone: result.zone,
        shotAngle: result.angle,
        shotDistance: result.distance,
        shotX: result.x,
        shotY: result.y
      });
    }
  };

  const handleWagonWheelSelect = async (sector: string) => {
    setSelectedWagonSector(sector);
    setShowWagonWheelModal(false);
    if (pendingBoundaryRun !== null) {
      const r = pendingBoundaryRun;
      setPendingBoundaryRun(null);
      await handleScore(r, 'normal', { wagonSector: sector });
    }
  };

  const handleWagonWheelSkip = async () => {
    setShowWagonWheelModal(false);
    if (pendingBoundaryRun !== null) {
      const r = pendingBoundaryRun;
      setPendingBoundaryRun(null);
      await handleScore(r, 'normal', { wagonSector: 'Unspecified' });
    }
  };

  const handleMoreRunsSelect = async (r: number) => {
    setShowMoreRunsModal(false);
    await handleScore(r, 'normal');
  };

  const handleOverThrowSelect = async (r: number) => {
    setShowOverThrowModal(false);
    setCustomOverthrowInput('');

    // Trigger instant broadcast animation with Overthrow illustration
    setActiveFieldingEvent({
      type: 'OVERTHROW',
      fielderName: bowler?.name || 'Fielding Side',
      teamName: matchInfo?.bowlingTeam || 'Bowling Team',
      title: `OVERTHROW: +${r} EXTRA RUNS! ⚡`,
      badge: `+${r} RUNS CONCEDED`,
      stats: `MCC Law 19.8 • ${r} Extra Run${r > 1 ? 's' : ''}`,
      details: `Stray throw missed stumps and keeper, allowing batters to complete ${r} overthrow run${r > 1 ? 's' : ''}!`,
      durationMs: 3500
    });

    await handleScore(r, 'normal', { remarks: `Overthrow: ${r} runs` });
  };

  const handleExtrasSelect = async (extraTypeKey: string) => {
    setShowExtrasModal(false);
    if (extraTypeKey === 'WIDE') {
      await handleScore(0, 'wide');
    } else if (extraTypeKey === 'NO_BALL') {
      await handleScore(0, 'noball', { remarks: 'Front-foot crease overstep' });
    } else if (extraTypeKey === 'NO_BALL_BEAMER') {
      await handleScore(0, 'noball', { noBallReason: 'BEAMER', isDangerousDelivery: true, remarks: 'Dangerous waist-high full toss (Law 41.7)' });
    } else if (extraTypeKey === 'NO_BALL_BOUNCER') {
      await handleScore(0, 'noball', { noBallReason: 'BOUNCER', remarks: 'Bouncer limit exceeded (Law 41.6)' });
    } else if (extraTypeKey === 'DEAD_BALL') {
      const msg = 'Dead Ball declared by Umpire (MCC Law 20). This delivery does not count and will be re-bowled.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Dead Ball (Law 20)', msg);
    } else if (extraTypeKey === 'BYE') {
      await handleScore(1, 'bye');
    } else if (extraTypeKey === 'LEG_BYE') {
      await handleScore(1, 'legbye');
    } else if (extraTypeKey === 'NO_BALL_BYE') {
      await handleScore(1, 'noball', { isByeOrLegBye: true, remarks: 'No Ball + 1 Bye (Law 21.18)' });
    } else if (extraTypeKey === 'NO_BALL_LEG_BYE') {
      await handleScore(1, 'noball', { isByeOrLegBye: true, remarks: 'No Ball + 1 Leg Bye (Law 21.18)' });
    } else if (extraTypeKey === 'NO_BALL_RUNS') {
      setCustomCategory('noball_bat');
      setCustomRunsInput('1');
      setShowCustomModal(true);
    } else if (extraTypeKey === 'PENALTY') {
      setShowPenaltyModal(true);
    }
  };

  const handleFieldingActionSelect = async (action: string) => {
    setSelectedFieldingAction(action);
    setShowFieldingModal(false);
    const fielderObj = bowlingSquad.find(f => f.id === selectedFielderId);
    const fielderName = fielderObj ? fielderObj.name : 'Active Fielder';

    // Map to FieldingEventType for instant broadcast animation
    let fType: FieldingEventType = 'CLEAN_COLLECT';
    if (action.includes('Direct Hit')) fType = 'DIRECT_HIT';
    else if (action.includes('Boundary Save') || action.includes('Slide')) fType = 'BOUNDARY_SAVE';
    else if (action.includes('Pick and Throw')) fType = 'PICK_AND_THROW';
    else if (action.includes('Relay Throw')) fType = 'RELAY_THROW';
    else if (action.includes('Dropped Catch') || action.includes('Misfield')) fType = 'MISFIELD';
    else if (action.includes('Overthrow')) fType = 'OVERTHROW';

    setActiveFieldingEvent({
      type: fType,
      fielderName: fielderName,
      teamName: matchInfo?.bowlingTeam || 'Fielding Team',
      details: `${fielderName} executed ${action} • Logged for match scorecard`
    });
  };

  const handleWicketClick = () => {
    if (isOverComplete || showBowlerModal) {
      const msg = 'Over is complete! Please select next bowler first.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Over Complete', msg);
      setShowBowlerModal(true);
      return;
    }
    if (wickets >= 10 || isMatchEnded || isInningsBreak) {
      const msg = 'Innings Completed! All 10 wickets are down.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Innings End', msg);
      return;
    }

    // Special Cricket Rule: Free Hit Immunity check (MCC Law 21.19)
    if (isFreeHitActive) {
      const msg = '⚡ FREE HIT ACTIVE! Batter CANNOT be dismissed Bowled, Caught, LBW, or Stumped (MCC Law 21.19). Only RUN OUT is allowed.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Free Hit Immunity', msg);
      setWicketType('RUN_OUT');
    } else {
      setWicketType('BOWLED');
    }

    // Initialize rich wicket state
    setWicketStep(1);
    setDismissedTarget('striker');
    setSelectedFielderId('');
    setCustomFielderName('');
    setIsFielderDropdownOpen(false);
    setIsBatterDropdownOpen(false);
    setFielderSearchQuery('');
    setRunsOnWicket(0);
    setBatterSearchQuery('');
    setCustomBatterName('');
    setSelectedNextBatterId(''); // Mandatory: do not pre-select, must be chosen by scorer

    setShowWicketModal(true);
  };

  const confirmNextBatter = async () => {
    if (wickets >= 10 || isInningsBreak || isMatchEnded) {
      setShowWicketModal(false);
      return;
    }
    if (isSubmittingDelivery) return;

    const outBatter = dismissedTarget === 'striker' ? striker : nonStriker;
    const isRetiredHurt = wicketType === 'RETIRED_HURT';
    const isTenthWicket = !isRetiredHurt && wickets + 1 >= 10;

    let nextBatterId = selectedNextBatterId;
    let nextBatterName = customBatterName.trim();

    if (!isTenthWicket) {
      if (nextBatterName) {
        if (!nextBatterId) {
          nextBatterId = `PLY-MANUAL-${Date.now()}`;
        }
      } else if (nextBatterId) {
        const found = battingSquad.find((p) => p.id === nextBatterId);
        if (found) nextBatterName = found.name;
      }

      if (!nextBatterId && !nextBatterName) {
        const msg = 'Please select or enter the incoming batsman.';
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Required', msg);
        return;
      }
    }

    // Resolve fielder name if applicable
    let resolvedFielderName = customFielderName.trim();
    if (!resolvedFielderName && selectedFielderId) {
      const f = bowlingSquad.find(p => p.id === selectedFielderId);
      if (f) resolvedFielderName = f.name;
    }

    if (['CAUGHT', 'CAUGHT_BEHIND', 'RUN_OUT', 'STUMPED'].includes(wicketType)) {
      if (!resolvedFielderName && !selectedFielderId) {
        const msg = `Please select or enter the fielder who made the ${wicketType === 'RUN_OUT' ? 'run out' : wicketType.toLowerCase().replace(/_/g, ' ')}.`;
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Fielder Required', msg);
        return;
      }
    }

    setIsSubmittingDelivery(true);
    setShowWicketModal(false);

    if (outBatter?.id && !isRetiredHurt) {
      setDismissedBatters((prev) => [...prev, outBatter.id]);
    }

    const payload = {
      strikerId: striker?.id,
      nonStrikerId: nonStriker?.id,
      bowlerId: bowler?.id,
      runsBatter: runsOnWicket,
      runsExtras: 0,
      extraType: 'NONE',
      wicket: !isRetiredHurt,
      wicketType: wicketType,
      dismissedPlayerId: outBatter?.id,
      replacementBatterId: isTenthWicket ? null : nextBatterId,
      replacementBatterName: isTenthWicket ? null : nextBatterName,
      fielderId: selectedFielderId || null,
      fielderName: resolvedFielderName || null,
      fieldingPosition: selectedFieldPosition
    };

    try {
      const res = await ScorerApi.recordDelivery(matchId, payload);
      if (res && res.commentary) {
        setAiCommentary(res.commentary);
      }
      setCustomBatterName('');
      await loadLiveState(false);

      // Trigger Official Broadcast Umpire Signal (OUT - Index Finger Raised)
      setActiveUmpireSignal({
        type: 'OUT',
        title: `OUT! (${wicketType.replace('_', ' ')})`,
        batterName: outBatter?.name || 'Batter',
        bowlerName: bowler?.name || 'Bowler',
        dismissalType: wicketType.replace('_', ' '),
        overText: `Over ${getOvers(balls + 1)}`,
        extraDetails: `Appeal upheld by standing umpire: ${outBatter?.name || 'Batter'} dismissed ${wicketType.replace('_', ' ')} (MCC Law 31)`
      });

      // Trigger Dismissal Celebrations (Run Out, Keeper Stumped/Caught Behind, Diving Catch)
      if (wicketType === 'RUN_OUT') {
        triggerMilestone({
          type: 'RUN_OUT',
          imageKey: 'RUN_OUT',
          title: 'DIRECT HIT RUN OUT!',
          badge: '🎯 SPECTACULAR RUN OUT 🎯',
          subtitle: `Incredible direct-hit throw by ${resolvedFielderName || 'Fielder'}! ${outBatter?.name || 'Batter'} is caught short of the crease.`,
          playerName: resolvedFielderName || 'Fielder',
          teamName: `${outBatter?.name || 'Batter'} dismissed`,
          scoreText: 'RUN OUT',
          ballsText: `Ov ${getOvers(balls + 1)}`
        });
      } else if (wicketType === 'STUMPED') {
        triggerMilestone({
          type: 'KEEPER_OUT',
          imageKey: 'KEEPER',
          title: 'LIGHTNING STUMPING!',
          badge: '🧤 WICKETKEEPER STUMPING 🧤',
          subtitle: `Flawless glovework by ${resolvedFielderName || 'Wicketkeeper'}! Feet out of the crease, bails dislodged in a flash.`,
          playerName: resolvedFielderName || 'Wicketkeeper',
          teamName: `${outBatter?.name || 'Batter'} st ${resolvedFielderName || 'Keeper'} b ${bowler?.name || 'Bowler'}`,
          scoreText: 'STUMPED',
          ballsText: `Ov ${getOvers(balls + 1)}`
        });
      } else if (wicketType === 'CAUGHT_BEHIND') {
        triggerMilestone({
          type: 'KEEPER_OUT',
          imageKey: 'KEEPER',
          title: 'CAUGHT BEHIND!',
          badge: '🧤 WICKETKEEPER CATCH 🧤',
          subtitle: `Snicked to the keeper! Superb reflex catch taken by ${resolvedFielderName || 'Wicketkeeper'}.`,
          playerName: resolvedFielderName || 'Wicketkeeper',
          teamName: `${outBatter?.name || 'Batter'} c ${resolvedFielderName || 'Keeper'} b ${bowler?.name || 'Bowler'}`,
          scoreText: 'CAUGHT BEHIND',
          ballsText: `Ov ${getOvers(balls + 1)}`
        });
      } else if (wicketType === 'CAUGHT') {
        triggerMilestone({
          type: 'TOP_CATCHES',
          imageKey: 'CATCH',
          title: 'OUTSTANDING CATCH!',
          badge: '🦅 SPECTACULAR CATCH 🦅',
          subtitle: `Sensational athleticism! Full-length diving catch by ${resolvedFielderName || 'Fielder'} under pressure.`,
          playerName: resolvedFielderName || 'Fielder',
          teamName: `${outBatter?.name || 'Batter'} c ${resolvedFielderName || 'Fielder'} b ${bowler?.name || 'Bowler'}`,
          scoreText: 'WICKET',
          ballsText: `Ov ${getOvers(balls + 1)}`
        });
      }

      if (res.isOverComplete || res.data?.isOverComplete) {
        if (res.matchStatus === 'LIVE' && !res.data?.isMatchCompleted) {
          setShowBowlerModal(true);
        }
      }
    } catch (err: any) {
      console.error('Wicket delivery error:', err);
      const msg = err.message || 'Error recording wicket. Score was not changed.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsSubmittingDelivery(false);
    }
  };

  // Custom Runs & Extras Submission Handler
  const handleCustomRunsSubmit = async () => {
    const runNum = parseInt(customRunsInput, 10);
    if (isNaN(runNum) || runNum < 0) {
      const msg = 'Please enter a valid non-negative number of runs.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Invalid Runs', msg);
      return;
    }

    const reasonText = customRunsReason.trim();
    setShowCustomModal(false);

    if (customCategory === 'normal') {
      await handleCustomDeliveryDirect({
        runsBatter: runNum,
        runsExtras: 0,
        extraType: 'NONE',
        reason: reasonText
      });
    } else if (customCategory === 'wide') {
      await handleCustomDeliveryDirect({
        runsBatter: 0,
        runsExtras: runNum,
        extraType: 'WIDE',
        reason: reasonText
      });
    } else if (customCategory === 'noball' || customCategory === 'noball_bat') {
      await handleCustomDeliveryDirect({
        runsBatter: runNum,
        runsExtras: 1,
        extraType: 'NO_BALL',
        reason: reasonText || 'No Ball + Runs (Off Bat)'
      });
    } else if (customCategory === 'noball_extra') {
      await handleCustomDeliveryDirect({
        runsBatter: 0,
        runsExtras: runNum,
        extraType: 'NO_BALL',
        reason: reasonText
      });
    } else if (customCategory === 'bye') {
      await handleCustomDeliveryDirect({
        runsBatter: 0,
        runsExtras: runNum,
        extraType: 'BYE',
        reason: reasonText
      });
    } else if (customCategory === 'legbye') {
      await handleCustomDeliveryDirect({
        runsBatter: 0,
        runsExtras: runNum,
        extraType: 'LEG_BYE',
        reason: reasonText
      });
    } else if (customCategory === 'penalty') {
      await handleCustomDeliveryDirect({
        runsBatter: 0,
        runsExtras: runNum,
        extraType: 'BYE',
        reason: reasonText || 'Penalty Runs'
      });
    }
    setCustomRunsReason('');
  };

  const handleCustomDeliveryDirect = async ({
    runsBatter,
    runsExtras,
    extraType,
    reason
  }: {
    runsBatter: number;
    runsExtras: number;
    extraType: string;
    reason?: string;
  }) => {
    if (isOverComplete || showBowlerModal) {
      setShowBowlerModal(true);
      return;
    }
    if (matchStatus !== 'LIVE' || isInningsBreak || isMatchEnded) return;
    if (isSubmittingDelivery) return;

    setIsSubmittingDelivery(true);

    const payload = {
      strikerId: striker?.id,
      nonStrikerId: nonStriker?.id,
      bowlerId: bowler?.id,
      runsBatter,
      runsExtras,
      extraType,
      wicket: false,
      fieldingPosition: selectedFieldPosition,
      reason
    };

    try {
      const res = await ScorerApi.recordDelivery(matchId, payload);
      if (res && res.commentary) {
        setAiCommentary(res.commentary);
      }
      await loadLiveState(false);
      if (res.isOverComplete || res.data?.isOverComplete) {
        if (res.matchStatus === 'LIVE' && !res.data?.isMatchCompleted) {
          setShowBowlerModal(true);
        }
      }
    } catch (err: any) {
      console.error('Custom delivery error:', err);
      const msg = err.message || 'Error recording custom delivery.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsSubmittingDelivery(false);
    }
  };

  const confirmNextBowler = async () => {
    if (!selectedNextBowlerId || isSubmittingBowler) return;

    // Guard: Do not allow bowler change if match is not live
    if (matchStatus !== 'LIVE') {
      setBowlerErrorMessage(`Match is not LIVE (current status: ${matchStatus}). Cannot change bowler.`);
      return;
    }

    setIsSubmittingBowler(true);
    setBowlerErrorMessage(null);

    try {
      const res = await ScorerApi.endOver(matchId, selectedNextBowlerId);
      if (!res || !res.success) {
        throw new Error(res?.message || 'Failed to appoint next bowler.');
      }

      // Optimistically update bowler to avoid visual lag
      const selectedB = bowlingSquad.find((b) => b.id === selectedNextBowlerId);
      if (selectedB) {
        setBowler((prev: any) => ({
          ...prev,
          id: selectedB.id,
          name: selectedB.name,
          overs: selectedB.overs || 0,
          runs: selectedB.runs || 0,
          wickets: selectedB.wickets || 0,
          economy: selectedB.economy || 0
        }));
      }

      setIsOverComplete(false);
      setShowBowlerModal(false);

      // Seamless background update without full page refresh
      await loadLiveState(false);
    } catch (err: any) {
      console.error('confirmNextBowler error:', err);
      setBowlerErrorMessage(err.message || 'Server rejected bowler selection.');
    } finally {
      setIsSubmittingBowler(false);
    }
  };

  const undoLastBall = async () => {
    if (isUndoing) return;
    setIsUndoing(true);
    try {
      const res = await ScorerApi.undoDelivery(matchId);
      await loadLiveState(false);
    } catch (err: any) {
      console.error('undoDelivery error:', err);
      const msg = err.message || 'Failed to undo last ball.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Undo Failed', msg);
    } finally {
      setIsUndoing(false);
    }
  };

  const handleStartNextInnings = async () => {
    if (isStartingNextInnings) return;
    setIsStartingNextInnings(true);
    try {
      // Transition from INNINGS_BREAK to LIVE for second innings
      await ScorerApi.startNextInnings(matchId);
      await loadLiveState(false);
    } catch (err: any) {
      const msg = err.message || 'Failed to start 2nd innings.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsStartingNextInnings(false);
    }
  };

  const handleSwapStrike = async () => {
    if (matchStatus !== 'LIVE' || isInningsBreak || isMatchEnded) return;
    try {
      await ScorerApi.swapStrike(matchId);
      await loadLiveState(false);
    } catch (err: any) {
      const msg = err.message || 'Failed to swap strike.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    }
  };

  const handleOpenChangeBatter = (target: 'striker' | 'nonStriker') => {
    setChangeBatterTarget(target);
    setSelectedChangeBatterId('');
    setCustomChangeBatterName('');
    setIsChangeBatterDropdownOpen(false);
    setChangeBatterSearch('');
    setShowChangeBatterModal(true);
  };

  const handleSubmitChangeBatter = async () => {
    if (isUpdatingBatter) return;
    let batterId = selectedChangeBatterId;
    let batterName = customChangeBatterName.trim();

    if (!batterId && !batterName) {
      const msg = 'Please select a player or enter a name.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Required', msg);
      return;
    }

    if (!batterName && batterId) {
      const f = battingSquad.find(p => p.id === batterId);
      if (f) batterName = f.name;
    }

    setIsUpdatingBatter(true);
    try {
      await ScorerApi.changeBatter(matchId, {
        target: changeBatterTarget,
        newBatterId: batterId,
        newBatterName: batterName
      });
      setShowChangeBatterModal(false);
      await loadLiveState(false);
    } catch (err: any) {
      const msg = err.message || 'Failed to change batter.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsUpdatingBatter(false);
    }
  };

  const handleOpenChangeBowler = () => {
    setSelectedChangeBowlerId('');
    setCustomChangeBowlerName('');
    setIsChangeBowlerDropdownOpen(false);
    setChangeBowlerSearch('');
    const isMid = balls % 6 > 0;
    setChangeBowlerReason(isMid ? 'INJURY' : 'TACTICAL');
    setBowlerSituation(isMid ? 'Bowler Injured' : 'Tactical Change');
    setIsSituationDropdownOpen(false);
    setIsSuspendingCurrentBowler(false);
    setShowChangeBowlerModal(true);
  };

  const handleOpenInjuryBowlerChange = () => {
    setSelectedChangeBowlerId('');
    setCustomChangeBowlerName('');
    setIsChangeBowlerDropdownOpen(false);
    setChangeBowlerSearch('');
    setChangeBowlerReason('INJURY');
    setBowlerSituation('Bowler Injured');
    setIsSituationDropdownOpen(false);
    setIsSuspendingCurrentBowler(false);
    setShowChangeBowlerModal(true);
  };

  const handleSubmitChangeBowler = async () => {
    if (isUpdatingBowler) return;
    let bwlId = selectedChangeBowlerId;
    let bwlName = customChangeBowlerName.trim();

    if (!bwlId && !bwlName) {
      const msg = 'Please select a bowler from the squad or enter a bowler name.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Selection Required', msg);
      return;
    }

    if (!bwlName && bwlId) {
      const f = bowlingSquad.find(p => p.id === bwlId);
      if (f) bwlName = f.name;
    }

    setIsUpdatingBowler(true);
    try {
      const res = await ScorerApi.changeBowler(matchId, {
        newBowlerId: bwlId,
        newBowlerName: bwlName,
        reason: changeBowlerReason,
        situation: bowlerSituation.trim() || changeBowlerReason,
        suspendCurrentBowler: isSuspendingCurrentBowler
      });
      if (res && res.bowler) {
        setBowler(res.bowler);
      } else if (bwlName) {
        setBowler((prev: any) => ({ ...prev, name: bwlName, id: bwlId || prev?.id }));
      }
      setShowChangeBowlerModal(false);
      await loadLiveState(false);
      const ballsInCurrentOver = balls % 6;
      const sitTag = bowlerSituation.trim() ? ` [${bowlerSituation.trim()}]` : '';
      const succMsg = ballsInCurrentOver > 0
        ? `Bowler substituted! ${bwlName || 'New bowler'} will bowl the remaining ${6 - ballsInCurrentOver} ball(s)${sitTag}.`
        : (res?.message || `Bowler updated to ${bwlName || 'new bowler'}${sitTag}.`);
      Platform.OS === 'web' ? window.alert(succMsg) : Alert.alert('Bowler Changed', succMsg);
    } catch (err: any) {
      const msg = err.message || 'Failed to change bowler.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsUpdatingBowler(false);
    }
  };

  const handleSelectFieldPosition = async (pos: string) => {
    setSelectedFieldPosition(pos);
    try {
      const res = await ScorerApi.getFieldingCommentary(matchId, {
        fieldingPosition: pos
      });
      if (res && res.commentary) {
        setAiCommentary(res.commentary);
      }
    } catch (e: any) {
      setAiCommentary(`Fielder stationed at ${pos} is covering the scoring zone.`);
    }
  };

  const confirmEndInnings = async () => {
    setShowEndModal(true);
  };

  const handleEndInningsSubmit = async () => {
    setShowEndModal(false);
    try {
      await ScorerApi.endInnings(matchId);
      await loadLiveState(false);
    } catch (err: any) {
      console.warn('End innings API note:', err.message);
    }
    navigate('Scorecard', { matchId });
  };

  // --- REVISED OVERS & TARGET HANDLER ---
  const handleRevisedOversSubmit = async () => {
    const oversNum = parseInt(revisedOversInput, 10);
    const targetNum = revisedTargetInput.trim() ? parseInt(revisedTargetInput, 10) : undefined;
    if (isNaN(oversNum) || oversNum <= 0) {
      const msg = 'Please enter a valid number of overs.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Invalid Overs', msg);
      return;
    }

    setIsSubmittingRevised(true);
    try {
      await ScorerApi.setRevisedOvers(matchId, {
        totalOvers: oversNum,
        revisedTarget: targetNum,
        comments: revisedCommentsInput.trim()
      });
      setShowRevisedOversModal(false);
      await loadLiveState(false);
      const okMsg = 'Revised overs and match details updated successfully!';
      Platform.OS === 'web' ? window.alert(okMsg) : Alert.alert('Success', okMsg);
    } catch (err: any) {
      const msg = err.message || 'Failed to update revised overs.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsSubmittingRevised(false);
    }
  };

  // --- PLAYING XI EDIT WORKFLOW HANDLERS ---
  const openPlayingXIModal = () => {
    setPlayingXIStep(1);
    setPlayingXITeam('A');
    const existing = (matchInfo?.teamAPlayingXI && matchInfo.teamAPlayingXI.length > 0)
      ? matchInfo.teamAPlayingXI
      : battingSquad.map((p: any) => p.id);
    setSelectedPlayingXI(existing.slice(0, 11));
    setShowPlayingXIModal(true);
  };

  const handlePlayingXITeamProceed = () => {
    const isTeamA = playingXITeam === 'A';
    const targetSquad = isTeamA ? battingSquad : bowlingSquad;
    const existingXI = isTeamA
      ? (matchInfo?.teamAPlayingXI?.length ? matchInfo.teamAPlayingXI : targetSquad.map(p => p.id))
      : (matchInfo?.teamBPlayingXI?.length ? matchInfo.teamBPlayingXI : targetSquad.map(p => p.id));
    setSelectedPlayingXI(existingXI.slice(0, 11));
    setPlayingXIStep(2);
  };

  const handlePlayingXIToggle = (playerId: string, isLocked: boolean) => {
    if (isLocked) {
      const lockMsg = 'This player has already batted or bowled in this match and cannot be replaced.';
      Platform.OS === 'web' ? window.alert(lockMsg) : Alert.alert('Player Locked', lockMsg);
      return;
    }
    if (selectedPlayingXI.includes(playerId)) {
      setSelectedPlayingXI(prev => prev.filter(id => id !== playerId));
    } else {
      if (selectedPlayingXI.length >= 11) {
        const fullMsg = 'Maximum 11 players can be selected in Playing XI.';
        Platform.OS === 'web' ? window.alert(fullMsg) : Alert.alert('Limit Reached', fullMsg);
        return;
      }
      setSelectedPlayingXI(prev => [...prev, playerId]);
    }
  };

  const handlePlayingXISubmit = async () => {
    if (selectedPlayingXI.length !== 11) {
      const countMsg = `Please select exactly 11 players (currently selected: ${selectedPlayingXI.length}).`;
      Platform.OS === 'web' ? window.alert(countMsg) : Alert.alert('Selection Incomplete', countMsg);
      return;
    }
    setIsSubmittingPlayingXI(true);
    try {
      const targetTeamId = playingXITeam === 'A' ? matchInfo?.teamAId : matchInfo?.teamBId;
      await ScorerApi.editPlayingXI(matchId, {
        teamId: targetTeamId,
        playingXI: selectedPlayingXI
      });
      setShowPlayingXIModal(false);
      await loadLiveState(false);
      const succMsg = 'Playing XI updated successfully!';
      Platform.OS === 'web' ? window.alert(succMsg) : Alert.alert('Success', succMsg);
    } catch (err: any) {
      const msg = err.message || 'Failed to update Playing XI.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsSubmittingPlayingXI(false);
    }
  };

  // --- END MATCH & SUPER OVER HANDLERS ---
  const handleStartSuperOver = async () => {
    setIsSubmittingEndMatch(true);
    try {
      const battingId = superOverBattingTeam || matchInfo?.teamAId;
      const bowlingId = battingId === matchInfo?.teamAId ? matchInfo?.teamBId : matchInfo?.teamAId;
      await ScorerApi.startSuperOver(matchId, {
        battingTeamId: battingId,
        bowlingTeamId: bowlingId
      });
      setShowEndMatchModal(false);
      await loadLiveState(false);
      const soMsg = 'T20 Super Over initiated! 1 Over per side.';
      Platform.OS === 'web' ? window.alert(soMsg) : Alert.alert('Super Over Started', soMsg);
    } catch (err: any) {
      const msg = err.message || 'Failed to start Super Over.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsSubmittingEndMatch(false);
    }
  };

  const handleEndMatchSubmit = async () => {
    if (endMatchResult === 'TIE' && isSuperOverSelected) {
      return handleStartSuperOver();
    }
    setIsSubmittingEndMatch(true);
    try {
      let summary = '';
      if (endMatchResult === 'WIN') {
        const wTeamName = winnerTeamId === matchInfo?.teamAId ? matchInfo?.teamA : matchInfo?.teamB;
        summary = `${wTeamName} won the match`;
      } else {
        summary = 'Match Tied';
      }
      await ScorerApi.endMatch(matchId, {
        resultText: summary,
        playerOfMatch: playerOfMatchInput.trim()
      });
      setShowEndMatchModal(false);
      await loadLiveState(false);
      navigate('Scorecard', { matchId });
    } catch (err: any) {
      const msg = err.message || 'Failed to end match.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsSubmittingEndMatch(false);
    }
  };

  // --- 1. BREAKS HANDLER ---
  const handleAddBreakSubmit = async () => {
    setIsSubmittingBreak(true);
    try {
      const finalBreakType = customBreakTypeInput.trim() || breakType || 'Tea break';
      const breakPayload = {
        type: finalBreakType,
        startTime: breakStartTime || new Date().toLocaleTimeString(),
        endTime: breakEndTime || '',
        duration: breakDuration || '5',
        comments: finalBreakType,
        excludeBatsmanTime
      };
      await ScorerApi.addBreak(matchId, breakPayload);
      setCurrentBreak(breakPayload);
      setShowBreaksModal(false);
      await loadLiveState(false);
      const msg = `Break (${finalBreakType}) recorded successfully.`;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Success', msg);
    } catch (err: any) {
      const msg = err.message || 'Failed to save break.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsSubmittingBreak(false);
    }
  };

  // --- 2. SESSIONS HANDLER ---
  const handleAddSessionSubmit = async () => {
    setIsSubmittingSession(true);
    try {
      const finalSessionType = customSessionTypeInput.trim() || sessionType || 'Lunch';
      await ScorerApi.addSession(matchId, {
        dayNo: parseInt(sessionDayNo, 10) || 1,
        type: finalSessionType,
        startInningsNo: parseInt(sessionStartInnings, 10) || 1,
        endInningsNo: parseInt(sessionEndInnings, 10) || 1,
        startOver: sessionStartOver,
        endOver: sessionEndOver,
        startTime: sessionStartTime,
        endTime: sessionEndTime,
        duration: sessionDuration
      });
      setShowSessionsModal(false);
      await loadLiveState(false);
      const msg = `Session (${finalSessionType}) recorded successfully.`;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Success', msg);
    } catch (err: any) {
      const msg = err.message || 'Failed to save session.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsSubmittingSession(false);
    }
  };

  // --- 3. END DAY HANDLER ---
  const handleAddEndDaySubmit = async () => {
    setIsSubmittingEndDay(true);
    try {
      await ScorerApi.addEndDay(matchId, {
        dayNo: parseInt(endDayNo, 10) || 1,
        startInningsNo: parseInt(endDayStartInnings, 10) || 1,
        endInningsNo: parseInt(endDayEndInnings, 10) || 1,
        startOver: '0.0',
        endOver: endDayOvers,
        startTime: endDayStartTime,
        endTime: endDayEndTime,
        duration: endDayDuration,
        comments: endDayComments
      });
      setShowEndDayModal(false);
      await loadLiveState(false);
      const msg = 'Day concluded and saved successfully.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Success', msg);
    } catch (err: any) {
      const msg = err.message || 'Failed to end day.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsSubmittingEndDay(false);
    }
  };

  // --- 4. DECLARE INNINGS HANDLER ---
  const handleDeclareInningsSubmit = async () => {
    setIsSubmittingDeclare(true);
    try {
      await ScorerApi.declareInnings(matchId);
      setShowDeclareModal(false);
      await loadLiveState(false);
      const msg = 'Innings declared successfully.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Declared', msg);
    } catch (err: any) {
      const msg = err.message || 'Failed to declare innings.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsSubmittingDeclare(false);
    }
  };

  // --- 5. MATCH TIMES HANDLER ---
  const handleUpdateMatchTimesSubmit = async () => {
    setIsSubmittingMatchTimes(true);
    try {
      await ScorerApi.updateMatchTimes(matchId, {
        date: matchStartDate,
        startTime: matchStartTimeInput,
        endTime: matchEndTimeInput
      });
      setShowMatchTimesModal(false);
      await loadLiveState(false);
      const msg = 'Match start and end times updated successfully.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Success', msg);
    } catch (err: any) {
      const msg = err.message || 'Failed to update match times.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsSubmittingMatchTimes(false);
    }
  };

  // --- 6. PENALTY POINTS HANDLER ---
  const handleAddPenaltySubmit = async () => {
    setIsSubmittingPenalty(true);
    try {
      const pts = parseInt(penaltyPointsInput, 10) || 5;
      const targetTeamName = penaltyTargetTeam === 'B'
        ? (matchInfo?.teamB || 'Team B')
        : (matchInfo?.teamA || 'Team A');
      const targetTeamId = penaltyTargetTeam === 'B'
        ? matchInfo?.teamBId
        : matchInfo?.teamAId;

      const finalReason = customPenaltyReason.trim()
        ? customPenaltyReason.trim()
        : penaltyReason;

      await ScorerApi.addPenalty(matchId, {
        points: pts,
        type: penaltyType,
        reason: finalReason,
        targetTeamName,
        targetTeamId
      });
      setShowPenaltyModal(false);
      setCustomPenaltyReason('');
      setIsPenaltyReasonDropdownOpen(false);
      await loadLiveState(false);
      const msg = `${pts} Penalty points awarded against ${targetTeamName}.\n\nOfficial notice has been delivered to ${targetTeamName}'s Team Inbox & Dashboard.`;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Penalty Awarded', msg);
    } catch (err: any) {
      const msg = err.message || 'Failed to award penalty.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsSubmittingPenalty(false);
    }
  };

  // --- 7. OTHER WICKETS HANDLER ---
  const handleRecordOtherWicketSubmit = async () => {
    if (!otherWicketPlayerId) {
      const msg = 'Please select the player for other wicket.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Player Required', msg);
      return;
    }
    setIsSubmittingOtherWicket(true);
    try {
      await ScorerApi.recordOtherWicket(matchId, {
        playerId: otherWicketPlayerId,
        wicketType: otherWicketType,
        comments: otherWicketComments,
        replacementBatterId: otherWicketReplacementId
      });
      setShowOtherWicketModal(false);
      await loadLiveState(false);
      const msg = `${otherWicketType.replace(/_/g, ' ')} recorded successfully.`;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Success', msg);
    } catch (err: any) {
      const msg = err.message || 'Failed to record other wicket.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsSubmittingOtherWicket(false);
    }
  };

  // --- 8. CHANGE BALL HANDLER ---
  const handleRecordBallChangeSubmit = async () => {
    setIsSubmittingBallChange(true);
    try {
      await ScorerApi.recordBallChange(matchId, {
        ballType: ballTypeChoice,
        over: ballChangeOver,
        time: new Date().toLocaleTimeString(),
        comments: ballChangeComments
      });
      setShowChangeBallModal(false);
      await loadLiveState(false);
      const msg = `Ball change to ${ballTypeChoice} recorded successfully.`;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Success', msg);
    } catch (err: any) {
      const msg = err.message || 'Failed to record ball change.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsSubmittingBallChange(false);
    }
  };

  // --- 9. UMPIRE ASSESSMENT HANDLER ---
  const handleSaveUmpireAssessmentSubmit = async () => {
    setIsSubmittingUmpire(true);
    try {
      await ScorerApi.saveUmpireAssessment(matchId, {
        umpire1: umpire1Name,
        rating1: parseInt(umpire1Rating, 10) || 8,
        umpire2: umpire2Name,
        rating2: parseInt(umpire2Rating, 10) || 8,
        pitchReport: pitchReportInput,
        comments: umpireCommentsInput
      });
      setShowUmpireModal(false);
      await loadLiveState(false);
      const msg = 'Umpire assessment saved successfully.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Success', msg);
    } catch (err: any) {
      const msg = err.message || 'Failed to save umpire assessment.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsSubmittingUmpire(false);
    }
  };

  // --- 9b. CHANGE TEAM SUBMIT (Before First Ball) ---
  const handleChangeTeamSubmit = async () => {
    if (balls > 0) {
      const msg = 'Change team is applicable only before the first ball of the match is started in the Scoring App.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Not Allowed', msg);
      return;
    }
    const bTeamId = changeTeamBattingTeamId || matchInfo.battingTeamId || matchInfo.teamAId;
    if (!changeTeamStrikerId || !changeTeamNonStrikerId || !changeTeamBowlerId) {
      const msg = 'Please choose Striker, Non-Striker, and Bowler to proceed.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Required Fields', msg);
      return;
    }
    if (changeTeamStrikerId === changeTeamNonStrikerId) {
      const msg = 'Striker and Non-Striker cannot be the same player.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Invalid Selection', msg);
      return;
    }

    setIsSubmittingChangeTeam(true);
    try {
      await ScorerApi.changeTeamBeforeStart(matchId, {
        battingTeamId: bTeamId,
        strikerId: changeTeamStrikerId,
        nonStrikerId: changeTeamNonStrikerId,
        bowlerId: changeTeamBowlerId
      });
      setShowChangeTeamModal(false);
      await loadLiveState(false);
      const msg = 'Teams and opening batsmen & bowler updated successfully!';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Success', msg);
    } catch (err: any) {
      const msg = err.message || 'Failed to change team.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsSubmittingChangeTeam(false);
    }
  };

  // --- 10. UNDO LAST DELIVERY HANDLER (Edit Mode) ---
  const [isUndoingDelivery, setIsUndoingDelivery] = useState(false);
  const handleUndoLastDelivery = async () => {
    setIsUndoingDelivery(true);
    try {
      setShowMilestoneModal(false);
      setActiveMilestone(null);
      await ScorerApi.undoDelivery(matchId);
      await loadLiveState(false);
      const msg = 'Last delivery successfully reversed and match state restored.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Undo Successful', msg);
    } catch (err: any) {
      const msg = err.message || 'Failed to undo last delivery.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsUndoingDelivery(false);
    }
  };

  // --- RETROACTIVE DIRECT DELIVERY EDIT HANDLERS (Edit Mode) ---
  const handleOpenEditDelivery = (del: any) => {
    setEditingDelivery(del);
    setEditRunsInput(typeof del.runsBatter === 'number' ? del.runsBatter : (typeof del.runs === 'number' ? del.runs : 0));
    setEditExtraType(del.extraType || (del.extra ? del.extra : 'NONE'));
    setEditWicket(Boolean(del.wicket));
    setEditWicketType(del.wicketType || 'BOWLED');
    setShowEditDeliveryModal(true);
  };

  const handleSaveDeliveryEdit = async () => {
    if (!editingDelivery) return;
    setIsSubmittingEditDelivery(true);
    try {
      const extraRuns = (editExtraType === 'WIDE' || editExtraType === 'NO_BALL') ? 1 : 0;
      const payload = {
        runsBatter: editRunsInput,
        runsExtras: extraRuns,
        extraType: editExtraType,
        wicket: editWicket,
        wicketType: editWicket ? editWicketType : null
      };
      await ScorerApi.editDelivery(matchId, editingDelivery.id, payload);
      setShowEditDeliveryModal(false);
      setEditingDelivery(null);
      await loadLiveState(false);
      const msg = `Delivery ${editingDelivery.ball} corrected successfully! Scores and figures updated.`;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Ball Corrected', msg);
    } catch (err: any) {
      const msg = err.message || 'Failed to update delivery.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsSubmittingEditDelivery(false);
    }
  };

  const handleSyncOfflineQueue = async () => {
    try {
      const res = await ScorerApi.syncOfflineDeliveries();
      if (ScorerApi.getOfflineQueueCount) {
        setOfflineQueueCount(ScorerApi.getOfflineQueueCount());
      }
      await loadLiveState(false);
      const msg = `Synced ${res.synced} deliveries from offline queue! Remaining: ${res.remaining}`;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Offline Sync', msg);
    } catch (err: any) {
      const msg = err.message || 'Error syncing offline deliveries.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Sync Error', msg);
    }
  };

  // Initial Full Screen Loading (Only on first load)
  if (isInitialLoading) {
    return (
      <View style={[styles.container, styles.centerBox]}>
        <ActivityIndicator size="large" color="#b45309" />
        <Text style={styles.loadingTitle}>Connecting to MongoDB Live Scorecard...</Text>
        <Text style={styles.loadingSubtitle}>
          Fetching authentic match rosters, playing XI figures, and delivery records
        </Text>
      </View>
    );
  }

  // Error Screen with Retry
  if (apiError || !matchInfo) {
    return (
      <View style={[styles.container, styles.centerBox]}>
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>⚠️ Live Scoring Connection Failed</Text>
          <Text style={styles.errorMessage}>{apiError || 'Match record not found in MongoDB database.'}</Text>
          <View style={styles.errorBtnRow}>
            <TouchableOpacity style={styles.retryBtn} onPress={() => loadLiveState(true)}>
              <Text style={styles.retryBtnText}>Retry Connection</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backDashboardBtn} onPress={() => navigate('Dashboard')}>
              <Text style={styles.backDashboardBtnText}>Back to Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Unique, deduplicated available incoming batters (plain computation, no hook call after early returns)
  const seenBatterNames = new Set<string>();
  const seenBatterIds = new Set<string>();
  const strikerName = (striker?.name || '').trim().toLowerCase();
  const nonStrikerName = (nonStriker?.name || '').trim().toLowerCase();

  const rawAvailableList: any[] = [];
  (battingSquad || []).forEach((p) => {
    if (!p || !p.name) return;
    const cleanName = p.name.trim().toLowerCase();
    // Exclude current striker and non-striker
    if (p.id === striker?.id || p.id === nonStriker?.id) return;
    if (cleanName === strikerName || cleanName === nonStrikerName) return;
    // Exclude already dismissed batters
    if (dismissedBatters.includes(p.id) || dismissedBatters.includes(cleanName)) return;
    // Deduplicate: each player appears exactly once
    if (seenBatterNames.has(cleanName) || seenBatterIds.has(p.id)) return;
    seenBatterNames.add(cleanName);
    seenBatterIds.add(p.id);
    rawAvailableList.push(p);
  });

  const availableSquad = batterSearchQuery.trim()
    ? rawAvailableList.filter((p) => {
      const q = batterSearchQuery.trim().toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.role && p.role.toLowerCase().includes(q));
    })
    : rawAvailableList;

  const selectedBatterObj = rawAvailableList.find((p) => p.id === selectedNextBatterId);

  const changeBatterAvailableSquad = changeBatterSearch.trim()
    ? rawAvailableList.filter((p) => {
      const q = changeBatterSearch.trim().toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.role && p.role.toLowerCase().includes(q));
    })
    : rawAvailableList;

  const selectedChangeBatterObj = rawAvailableList.find((p) => p.id === selectedChangeBatterId);

  const filteredChangeBowlerSquad = changeBowlerSearch.trim()
    ? (bowlingSquad || []).filter((p) => {
      const q = changeBowlerSearch.trim().toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.role && p.role.toLowerCase().includes(q));
    })
    : (bowlingSquad || []);

  const selectedChangeBowlerObj = (bowlingSquad || []).find((p) => p.id === selectedChangeBowlerId);

  // Unique, deduplicated fielding squad (for fielder dropdown)
  const seenFielderNames = new Set<string>();
  const seenFielderIds = new Set<string>();
  const rawFielderList: any[] = [];
  (bowlingSquad || []).forEach((f) => {
    if (!f || !f.name) return;
    const cleanName = f.name.trim().toLowerCase();
    if (seenFielderNames.has(cleanName) || seenFielderIds.has(f.id)) return;
    seenFielderNames.add(cleanName);
    seenFielderIds.add(f.id);
    rawFielderList.push(f);
  });

  const filteredFielders = fielderSearchQuery.trim()
    ? rawFielderList.filter((f) => {
      const q = fielderSearchQuery.trim().toLowerCase();
      return f.name.toLowerCase().includes(q) || (f.role && f.role.toLowerCase().includes(q));
    })
    : rawFielderList;

  const selectedFielderObj = rawFielderList.find((f) => f.id === selectedFielderId);

  return (
    <View style={styles.container}>
      {/* 1. SCORER SLIDE MENU DRAWER (Exact 11 Items from Manual) */}
      <Modal
        visible={showSideDrawer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSideDrawer(false)}
      >
        <View style={styles.drawerOverlay}>
          <TouchableOpacity
            style={styles.drawerBackdrop}
            activeOpacity={1}
            onPress={() => setShowSideDrawer(false)}
          />
          <View style={styles.drawerContainer}>
            <View style={styles.drawerHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={styles.sidebarAvatar}>
                  <Text style={styles.sidebarAvatarText}>{scorerInitials}</Text>
                </View>
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={styles.drawerTitle} numberOfLines={1}>{scorerName}</Text>
                  <Text style={styles.drawerSubtitle} numberOfLines={1}>OFFICIAL SCORER</Text>
                  <View style={[styles.sidebarOfficialPill, { marginTop: 2 }]}>
                    <Text style={styles.sidebarOfficialPillText} numberOfLines={1}>{scorerCertLevel.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={styles.drawerCloseBtn}
                onPress={() => setShowSideDrawer(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.drawerCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.drawerMenuScroll} showsVerticalScrollIndicator={false}>
              {/* 0. Return to Matches Dashboard */}
              <TouchableOpacity
                style={[styles.drawerMenuItem, { backgroundColor: '#ecfdf5', borderColor: '#10b981' }]}
                onPress={() => {
                  setShowSideDrawer(false);
                  navigate('Dashboard');
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.drawerMenuIconBox, { backgroundColor: '#059669', borderColor: '#047857' }]}>
                  <Text style={[styles.drawerMenuIconText, { color: '#ffffff' }]}>🏠</Text>
                </View>
                <View style={styles.drawerMenuTextBox}>
                  <Text style={[styles.drawerMenuLabel, { color: '#047857', fontWeight: 'bold' }]}>
                    All Matches (Dashboard)
                  </Text>
                  <Text style={styles.drawerMenuDesc}>Return to Scorer Match Portal</Text>
                </View>
                <Text style={[styles.drawerMenuChevron, { color: '#059669' }]}>›</Text>
              </TouchableOpacity>

              {/* 0a. Live Scoring (Active) */}
              <TouchableOpacity
                style={[styles.drawerMenuItem, { backgroundColor: '#fef3c7', borderColor: '#d97706' }]}
                onPress={() => setShowSideDrawer(false)}
                activeOpacity={0.7}
              >
                <View style={[styles.drawerMenuIconBox, { backgroundColor: '#d97706', borderColor: '#b45309' }]}>
                  <Text style={[styles.drawerMenuIconText, { color: '#ffffff' }]}>📊</Text>
                </View>
                <View style={styles.drawerMenuTextBox}>
                  <Text style={[styles.drawerMenuLabel, { color: '#b45309', fontWeight: 'bold' }]}>Live Scoring (Active)</Text>
                  <Text style={styles.drawerMenuDesc}>Current match scoring view</Text>
                </View>
                <View style={styles.sidebarBadgeYellow}>
                  <Text style={styles.sidebarBadgeYellowText}>LIVE</Text>
                </View>
              </TouchableOpacity>

              {/* 0b. View Scorecard */}
              <TouchableOpacity
                style={styles.drawerMenuItem}
                onPress={() => {
                  setShowSideDrawer(false);
                  navigate('Scorecard', { matchId });
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.drawerMenuIconBox, { backgroundColor: '#dbeafe', borderColor: '#93c5fd' }]}>
                  <Text style={styles.drawerMenuIconText}>📋</Text>
                </View>
                <View style={styles.drawerMenuTextBox}>
                  <Text style={styles.drawerMenuLabel}>Match Scorecard</Text>
                  <Text style={styles.drawerMenuDesc}>Complete batting & bowling stats</Text>
                </View>
                <Text style={styles.drawerMenuChevron}>›</Text>
              </TouchableOpacity>

              {/* 0c. 3D Milestone Showcase */}
              <TouchableOpacity
                style={styles.drawerMenuItem}
                onPress={() => {
                  setShowSideDrawer(false);
                  navigate('MilestoneGallery');
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.drawerMenuIconBox, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                  <Text style={styles.drawerMenuIconText}>🏆</Text>
                </View>
                <View style={styles.drawerMenuTextBox}>
                  <Text style={[styles.drawerMenuLabel, { color: '#b45309' }]}>3D Milestones Showcase</Text>
                  <Text style={styles.drawerMenuDesc}>Inspect all 11 cricket milestone statuettes</Text>
                </View>
                <Text style={styles.drawerMenuChevron}>›</Text>
              </TouchableOpacity>

              {/* 1. Breaks */}
              <TouchableOpacity
                style={styles.drawerMenuItem}
                onPress={() => { setShowSideDrawer(false); handleOpenBreaksModal(); }}
                activeOpacity={0.7}
              >
                <View style={[styles.drawerMenuIconBox, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                  <Text style={styles.drawerMenuIconText}>☕</Text>
                </View>
                <View style={styles.drawerMenuTextBox}>
                  <Text style={styles.drawerMenuLabel}>Breaks</Text>
                  <Text style={styles.drawerMenuDesc}>Tea / Lunch / Drinks Interval</Text>
                </View>
                <Text style={styles.drawerMenuChevron}>›</Text>
              </TouchableOpacity>

              {/* 2. Sessions */}
              <TouchableOpacity
                style={styles.drawerMenuItem}
                onPress={() => { setShowSideDrawer(false); setShowSessionsModal(true); }}
                activeOpacity={0.7}
              >
                <View style={[styles.drawerMenuIconBox, { backgroundColor: '#e0f2fe', borderColor: '#bae6fd' }]}>
                  <Text style={styles.drawerMenuIconText}>⏱️</Text>
                </View>
                <View style={styles.drawerMenuTextBox}>
                  <Text style={styles.drawerMenuLabel}>Sessions</Text>
                  <Text style={styles.drawerMenuDesc}>Morning / Afternoon Session</Text>
                </View>
                <Text style={styles.drawerMenuChevron}>›</Text>
              </TouchableOpacity>

              {/* 3. End Day */}
              <TouchableOpacity
                style={styles.drawerMenuItem}
                onPress={() => { setShowSideDrawer(false); setShowEndDayModal(true); }}
                activeOpacity={0.7}
              >
                <View style={[styles.drawerMenuIconBox, { backgroundColor: '#ffedd5', borderColor: '#fed7aa' }]}>
                  <Text style={styles.drawerMenuIconText}>🌅</Text>
                </View>
                <View style={styles.drawerMenuTextBox}>
                  <Text style={styles.drawerMenuLabel}>End Day</Text>
                  <Text style={styles.drawerMenuDesc}>Stumps / Close of Play</Text>
                </View>
                <Text style={styles.drawerMenuChevron}>›</Text>
              </TouchableOpacity>

              {/* 4. End Innings */}
              <TouchableOpacity
                style={styles.drawerMenuItem}
                onPress={() => { setShowSideDrawer(false); setShowEndModal(true); }}
                activeOpacity={0.7}
              >
                <View style={[styles.drawerMenuIconBox, { backgroundColor: '#fee2e2', borderColor: '#fecaca' }]}>
                  <Text style={styles.drawerMenuIconText}>🏏</Text>
                </View>
                <View style={styles.drawerMenuTextBox}>
                  <Text style={styles.drawerMenuLabel}>End Innings</Text>
                  <Text style={styles.drawerMenuDesc}>All Out / Innings Complete</Text>
                </View>
                <Text style={styles.drawerMenuChevron}>›</Text>
              </TouchableOpacity>

              {/* 5. End Match */}
              <TouchableOpacity
                style={styles.drawerMenuItem}
                onPress={() => { setShowSideDrawer(false); setShowEndMatchModal(true); }}
                activeOpacity={0.7}
              >
                <View style={[styles.drawerMenuIconBox, { backgroundColor: '#fef08a', borderColor: '#fde047' }]}>
                  <Text style={styles.drawerMenuIconText}>🏆</Text>
                </View>
                <View style={styles.drawerMenuTextBox}>
                  <Text style={styles.drawerMenuLabel}>End Match</Text>
                  <Text style={styles.drawerMenuDesc}>Match Result / Conclusion</Text>
                </View>
                <Text style={styles.drawerMenuChevron}>›</Text>
              </TouchableOpacity>

              {/* 6. Declare Innings */}
              <TouchableOpacity
                style={styles.drawerMenuItem}
                onPress={() => { setShowSideDrawer(false); setShowDeclareModal(true); }}
                activeOpacity={0.7}
              >
                <View style={[styles.drawerMenuIconBox, { backgroundColor: '#f3e8ff', borderColor: '#e9d5ff' }]}>
                  <Text style={styles.drawerMenuIconText}>📢</Text>
                </View>
                <View style={styles.drawerMenuTextBox}>
                  <Text style={styles.drawerMenuLabel}>Declare Innings</Text>
                  <Text style={styles.drawerMenuDesc}>Declare Batting Innings</Text>
                </View>
                <Text style={styles.drawerMenuChevron}>›</Text>
              </TouchableOpacity>

              {/* 7. Match Events */}
              <TouchableOpacity
                style={[styles.drawerMenuItem, { borderColor: '#d97706', backgroundColor: '#fffbeb' }]}
                onPress={() => { setShowSideDrawer(false); setShowMatchEventsModal(true); }}
                activeOpacity={0.7}
              >
                <View style={[styles.drawerMenuIconBox, { backgroundColor: '#fef3c7', borderColor: '#fcd34d' }]}>
                  <Text style={styles.drawerMenuIconText}>⚡</Text>
                </View>
                <View style={styles.drawerMenuTextBox}>
                  <Text style={[styles.drawerMenuLabel, { color: '#b45309' }]}>Match Events</Text>
                  <Text style={styles.drawerMenuDesc}>Penalties & Event Stops</Text>
                </View>
                <Text style={[styles.drawerMenuChevron, { color: '#b45309' }]}>›</Text>
              </TouchableOpacity>

              {/* 8. Change Team */}
              <TouchableOpacity
                style={styles.drawerMenuItem}
                onPress={() => {
                  setShowSideDrawer(false);
                  setChangeTeamBattingTeamId(matchInfo.battingTeamId || matchInfo.teamAId);
                  setChangeTeamStrikerId(striker?.id || '');
                  setChangeTeamNonStrikerId(nonStriker?.id || '');
                  setChangeTeamBowlerId(bowler?.id || '');
                  setShowChangeTeamModal(true);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.drawerMenuIconBox, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                  <Text style={styles.drawerMenuIconText}>🔄</Text>
                </View>
                <View style={styles.drawerMenuTextBox}>
                  <Text style={styles.drawerMenuLabel}>Change Team</Text>
                  <Text style={styles.drawerMenuDesc}>Swap Batting & Bowling Teams</Text>
                </View>
                <Text style={styles.drawerMenuChevron}>›</Text>
              </TouchableOpacity>

              {/* 9. Umpire Assesment */}
              <TouchableOpacity
                style={styles.drawerMenuItem}
                onPress={() => { setShowSideDrawer(false); setShowUmpireModal(true); }}
                activeOpacity={0.7}
              >
                <View style={[styles.drawerMenuIconBox, { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' }]}>
                  <Text style={styles.drawerMenuIconText}>⚖️</Text>
                </View>
                <View style={styles.drawerMenuTextBox}>
                  <Text style={styles.drawerMenuLabel}>Umpire Assesment</Text>
                  <Text style={styles.drawerMenuDesc}>Umpire Review & Decision</Text>
                </View>
                <Text style={styles.drawerMenuChevron}>›</Text>
              </TouchableOpacity>

              {/* 10. Edit Mode */}
              <TouchableOpacity
                style={[
                  styles.drawerMenuItem,
                  isEditMode && { backgroundColor: '#fef3c7', borderColor: '#d97706' }
                ]}
                onPress={() => {
                  const nextMode = !isEditMode;
                  setIsEditMode(nextMode);
                  setShowSideDrawer(false);
                  const msg = nextMode ? 'Edit Mode Activated: Delivery undo & ball edits enabled.' : 'Edit Mode Deactivated.';
                  Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Edit Mode', msg);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.drawerMenuIconBox, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
                  <Text style={styles.drawerMenuIconText}>✏️</Text>
                </View>
                <View style={styles.drawerMenuTextBox}>
                  <Text style={[styles.drawerMenuLabel, isEditMode && { color: '#b45309' }]}>
                    {isEditMode ? '✓ Edit Mode (Active)' : 'Edit Mode'}
                  </Text>
                  <Text style={styles.drawerMenuDesc}>Undo & Correct Deliveries</Text>
                </View>
                <Text style={styles.drawerMenuChevron}>›</Text>
              </TouchableOpacity>

              {/* 11. Exit Screen */}
              <TouchableOpacity
                style={[styles.drawerMenuItem, styles.drawerExitMenuItem]}
                onPress={() => {
                  setShowSideDrawer(false);
                  setShowExitModal(true);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.drawerMenuIconBox, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
                  <Text style={styles.drawerMenuIconText}>🚪</Text>
                </View>
                <View style={styles.drawerMenuTextBox}>
                  <Text style={[styles.drawerMenuLabel, { color: '#dc2626' }]}>Exit Screen</Text>
                  <Text style={[styles.drawerMenuDesc, { color: '#ef4444' }]}>Close Scorer Console</Text>
                </View>
                <Text style={[styles.drawerMenuChevron, { color: '#dc2626' }]}>›</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Live Digital Clock at bottom of Slide Menu (Matches Screenshot) */}
            <View style={styles.drawerClockBox}>
              <Text style={styles.drawerClockText}>{currentTimeStr || '11:34:00 am'}</Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* RESUME PLAY CONFIRMATION MODAL */}
      <Modal
        visible={showResumeConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResumeConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 440, padding: 20 }]}>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <View style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: currentBreak?.type?.toLowerCase().includes('rain') ? '#e0f2fe' : '#dcfce7',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 8
              }}>
                <Text style={{ fontSize: 28 }}>
                  {currentBreak?.type?.toLowerCase().includes('rain') ? '🌤️' : '▶️'}
                </Text>
              </View>
              <Text style={{ fontSize: 18, fontWeight: '900', color: '#0f172a', textAlign: 'center' }}>
                {currentBreak?.type?.toLowerCase().includes('rain') ? 'Rain Stopped & Restart Match?' : 'Resume Match Play?'}
              </Text>
              <Text style={{ fontSize: 12.5, color: '#64748b', textAlign: 'center', marginTop: 4, lineHeight: 18 }}>
                {currentBreak?.type?.toLowerCase().includes('rain')
                  ? 'Have ground covers been removed and umpires called players back onto the field to resume play?'
                  : `Are both teams and officials ready to conclude the ${currentBreak?.type || 'break'} and resume live scoring?`}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 11,
                  borderRadius: 8,
                  backgroundColor: '#f1f5f9',
                  alignItems: 'center'
                }}
                onPress={() => setShowResumeConfirmModal(false)}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569' }}>
                  {currentBreak?.type?.toLowerCase().includes('rain') ? 'Still Raining / Wait' : 'Stay on Break'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 11,
                  borderRadius: 8,
                  backgroundColor: '#16a34a',
                  alignItems: 'center'
                }}
                onPress={async () => {
                  setShowResumeConfirmModal(false);
                  await handleResumePlay();
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#ffffff' }}>
                  ▶ Restart Match Now
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 2. BREAKS MODAL (Matches Manual Image 3) */}
      <Modal
        visible={showBreaksModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowBreaksModal(false);
          setIsBreakTypeDropdownOpen(false);
        }}
      >
        <ScrollView
          contentContainerStyle={styles.modalScrollOverlay}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          <View style={[styles.modalContent, { maxWidth: 460 }]}>
            <View style={styles.revisedModalHeader}>
              <Text style={styles.revisedModalTitle}>BREAKS</Text>
              <TouchableOpacity
                style={styles.redCloseBtn}
                onPress={() => {
                  setShowBreaksModal(false);
                  setIsBreakTypeDropdownOpen(false);
                }}
              >
                <Text style={styles.redCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.revisedModalInfo}>
              Update the break start & end time and appropriate comments as per match event. Duration for the break will be displayed based on start and end time.
            </Text>

            <View style={{ marginTop: 10, zIndex: 10 }}>
              <Text style={styles.fieldSubLabel}>BREAK TYPE / EVENT:</Text>

              {/* Dropdown Trigger */}
              <TouchableOpacity
                style={[
                  styles.fielderDropdownTrigger,
                  isBreakTypeDropdownOpen && styles.fielderDropdownTriggerOpen,
                  { borderColor: '#005960', backgroundColor: '#f0fdf4' }
                ]}
                onPress={() => setIsBreakTypeDropdownOpen(!isBreakTypeDropdownOpen)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Text style={{ fontSize: 16, marginRight: 8 }}>
                    {STANDARD_BREAK_OPTIONS.find((o) => o.label === breakType)?.icon || '☕'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fielderDropdownTriggerText, { color: '#005960', fontWeight: 'bold' }]}>
                      {breakType || 'Select Break Type'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.fielderDropdownArrow, { color: '#005960' }]}>
                  {isBreakTypeDropdownOpen ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>

              {/* Dropdown Menu List */}
              {isBreakTypeDropdownOpen && (
                <View style={[styles.fielderDropdownMenu, { borderColor: '#005960', maxHeight: 210, zIndex: 20 }]}>
                  <ScrollView style={{ maxHeight: 190 }} nestedScrollEnabled showsVerticalScrollIndicator={true}>
                    {STANDARD_BREAK_OPTIONS.map((opt) => {
                      const isSelected = breakType === opt.label && !customBreakTypeInput.trim();
                      return (
                        <TouchableOpacity
                          key={opt.label}
                          style={[
                            styles.fielderDropdownItem,
                            isSelected && { backgroundColor: '#e6f4f1' },
                            { paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' }
                          ]}
                          onPress={() => {
                            setBreakType(opt.label);
                            if (opt.label === 'Other / Custom Break') {
                              // keep custom input
                            } else {
                              setCustomBreakTypeInput('');
                            }
                            setIsBreakTypeDropdownOpen(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Text style={{ fontSize: 16, marginRight: 8 }}>{opt.icon}</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, fontWeight: isSelected ? 'bold' : '600', color: isSelected ? '#005960' : '#1e293b' }}>
                                {opt.label}
                              </Text>
                              <Text style={{ fontSize: 10, color: '#64748b' }}>{opt.sub}</Text>
                            </View>
                          </View>
                          {isSelected && <Text style={{ color: '#005960', fontWeight: 'bold', fontSize: 14 }}>✓</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Custom Break Name Type Input (athula illathya option na type pananum) */}
              <View style={{ marginTop: 10 }}>
                <Text style={[styles.fieldSubLabel, { color: '#b45309' }]}>
                  OR TYPE CUSTOM BREAK:
                </Text>
                <TextInput
                  style={[
                    styles.customNameInput,
                    customBreakTypeInput.trim().length > 0 && { borderColor: '#005960', backgroundColor: '#f0fdf4' }
                  ]}
                  placeholder="Type custom break reason (e.g. Sightscreen adjustment, Crowd delay...)"
                  placeholderTextColor="#94a3b8"
                  value={customBreakTypeInput}
                  onChangeText={(val) => {
                    setCustomBreakTypeInput(val);
                    if (val.trim()) {
                      setBreakType(val);
                    }
                  }}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldSubLabel}>STARTS AT:</Text>
                <View style={styles.timeInputContainer}>
                  <TextInput
                    style={[styles.customNameInput, { paddingRight: 74 }]}
                    placeholder="e.g. 11:35 am"
                    placeholderTextColor="#94a3b8"
                    value={breakStartTime}
                    onChangeText={handleBreakStartTimeChange}
                  />
                  <TouchableOpacity
                    style={styles.fieldClockBtn}
                    onPress={() => {
                      setClockPickerTarget('BREAK_START');
                      setClockPickerVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 13 }}>🕒</Text>
                    <Text style={styles.fieldClockBtnText}>Clock</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldSubLabel}>ENDS AT:</Text>
                <View style={styles.timeInputContainer}>
                  <TextInput
                    style={[styles.customNameInput, { paddingRight: 74 }]}
                    placeholder="e.g. 11:40 am"
                    placeholderTextColor="#94a3b8"
                    value={breakEndTime}
                    onChangeText={handleBreakEndTimeChange}
                  />
                  <TouchableOpacity
                    style={styles.fieldClockBtn}
                    onPress={() => {
                      setClockPickerTarget('BREAK_END');
                      setClockPickerVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 13 }}>🕒</Text>
                    <Text style={styles.fieldClockBtnText}>Clock</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <Text style={styles.fieldSubLabel}>DURATION (IN MINS):</Text>
                {isDurationAutoCalculated && Boolean(breakDuration) ? (
                  <View style={styles.autoCalcBadge}>
                    <Text style={styles.autoCalcBadgeText}>⚡ AUTO-CALCULATED ({breakDuration} MINS)</Text>
                  </View>
                ) : null}
              </View>
              <TextInput
                style={styles.customNameInput}
                keyboardType="numeric"
                placeholder="e.g. 5"
                placeholderTextColor="#94a3b8"
                value={breakDuration}
                onChangeText={(val) => {
                  setBreakDuration(val);
                  setIsDurationAutoCalculated(false);
                }}
              />
            </View>

            <View style={{ marginTop: 10, marginBottom: 14 }}>
              <Text style={styles.fieldSubLabel}>EXCLUDE BREAK TIME IN BATSMEN MINUTES?</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <TouchableOpacity
                  style={[styles.superOverChoiceBtn, excludeBatsmanTime && styles.superOverChoiceBtnActive]}
                  onPress={() => setExcludeBatsmanTime(true)}
                >
                  <Text style={[styles.superOverChoiceText, excludeBatsmanTime && styles.superOverChoiceTextActive]}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.superOverChoiceBtn, !excludeBatsmanTime && styles.superOverChoiceBtnActive]}
                  onPress={() => setExcludeBatsmanTime(false)}
                >
                  <Text style={[styles.superOverChoiceText, !excludeBatsmanTime && styles.superOverChoiceTextActive]}>No</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowBreaksModal(false);
                  setIsBreakTypeDropdownOpen(false);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#d97706' }]}
                disabled={isSubmittingBreak}
                onPress={handleAddBreakSubmit}
              >
                {isSubmittingBreak ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalConfirmText}>DONE</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </Modal>

      {/* 3. SESSIONS MODAL (Matches Manual Image 2) */}
      <Modal
        visible={showSessionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowSessionsModal(false);
          setIsSessionTypeDropdownOpen(false);
        }}
      >
        <ScrollView
          contentContainerStyle={styles.modalScrollOverlay}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          <View style={[styles.modalContent, { maxWidth: 460 }]}>
            <View style={styles.revisedModalHeader}>
              <Text style={styles.revisedModalTitle}>END SESSION / SESSIONS</Text>
              <TouchableOpacity
                style={styles.redCloseBtn}
                onPress={() => {
                  setShowSessionsModal(false);
                  setIsSessionTypeDropdownOpen(false);
                }}
              >
                <Text style={styles.redCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.revisedModalInfo}>
              Session type to be added as Lunch, Tea, or End of Day respectively. Fill respective list items.
            </Text>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldSubLabel}>DAY NO:</Text>
                <TextInput
                  style={styles.customNameInput}
                  keyboardType="numeric"
                  value={sessionDayNo}
                  onChangeText={setSessionDayNo}
                />
              </View>
            </View>

            {/* Session Type Dropdown & Custom Input */}
            <View style={{ marginTop: 10, zIndex: 10 }}>
              <Text style={styles.fieldSubLabel}>SESSION TYPE:</Text>

              {/* Dropdown Trigger */}
              <TouchableOpacity
                style={[
                  styles.fielderDropdownTrigger,
                  isSessionTypeDropdownOpen && styles.fielderDropdownTriggerOpen,
                  { borderColor: '#005960', backgroundColor: '#f0fdf4' }
                ]}
                onPress={() => setIsSessionTypeDropdownOpen(!isSessionTypeDropdownOpen)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Text style={{ fontSize: 16, marginRight: 8 }}>
                    {STANDARD_SESSION_OPTIONS.find((o) => o.label === sessionType)?.icon || '⏱️'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fielderDropdownTriggerText, { color: '#005960', fontWeight: 'bold' }]}>
                      {sessionType || 'Select Session Type'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.fielderDropdownArrow, { color: '#005960' }]}>
                  {isSessionTypeDropdownOpen ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>

              {/* Dropdown Menu List */}
              {isSessionTypeDropdownOpen && (
                <View style={[styles.fielderDropdownMenu, { borderColor: '#005960', maxHeight: 210, zIndex: 20 }]}>
                  <ScrollView style={{ maxHeight: 190 }} nestedScrollEnabled showsVerticalScrollIndicator={true}>
                    {STANDARD_SESSION_OPTIONS.map((opt) => {
                      const isSelected = sessionType === opt.label && !customSessionTypeInput.trim();
                      return (
                        <TouchableOpacity
                          key={opt.label}
                          style={[
                            styles.fielderDropdownItem,
                            isSelected && { backgroundColor: '#e6f4f1' },
                            { paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' }
                          ]}
                          onPress={() => {
                            setSessionType(opt.label);
                            if (opt.label === 'Other / Custom Session') {
                              // keep custom input
                            } else {
                              setCustomSessionTypeInput('');
                            }
                            setIsSessionTypeDropdownOpen(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Text style={{ fontSize: 16, marginRight: 8 }}>{opt.icon}</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, fontWeight: isSelected ? 'bold' : '600', color: isSelected ? '#005960' : '#1e293b' }}>
                                {opt.label}
                              </Text>
                              <Text style={{ fontSize: 10, color: '#64748b' }}>{opt.sub}</Text>
                            </View>
                          </View>
                          {isSelected && <Text style={{ color: '#005960', fontWeight: 'bold', fontSize: 14 }}>✓</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Custom Session Type Input (athula illathatha type panura mari) */}
              <View style={{ marginTop: 10 }}>
                <Text style={[styles.fieldSubLabel, { color: '#b45309' }]}>
                  OR TYPE CUSTOM SESSION:
                </Text>
                <TextInput
                  style={[
                    styles.customNameInput,
                    customSessionTypeInput.trim().length > 0 && { borderColor: '#005960', backgroundColor: '#f0fdf4' }
                  ]}
                  placeholder="Type custom session name (e.g. Morning extended session, Rain session...)"
                  placeholderTextColor="#94a3b8"
                  value={customSessionTypeInput}
                  onChangeText={(val) => {
                    setCustomSessionTypeInput(val);
                    if (val.trim()) {
                      setSessionType(val);
                    }
                  }}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldSubLabel}>START OVER:</Text>
                <TextInput
                  style={styles.customNameInput}
                  value={sessionStartOver}
                  onChangeText={setSessionStartOver}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldSubLabel}>END OVER:</Text>
                <TextInput
                  style={styles.customNameInput}
                  value={sessionEndOver}
                  onChangeText={setSessionEndOver}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldSubLabel}>STARTS AT:</Text>
                <View style={styles.timeInputContainer}>
                  <TextInput
                    style={[styles.customNameInput, { paddingRight: 74 }]}
                    value={sessionStartTime}
                    onChangeText={setSessionStartTime}
                  />
                  <TouchableOpacity
                    style={styles.fieldClockBtn}
                    onPress={() => {
                      setClockPickerTarget('SESSION_START');
                      setClockPickerVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 13 }}>🕒</Text>
                    <Text style={styles.fieldClockBtnText}>Clock</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldSubLabel}>ENDS AT:</Text>
                <View style={styles.timeInputContainer}>
                  <TextInput
                    style={[styles.customNameInput, { paddingRight: 74 }]}
                    value={sessionEndTime}
                    onChangeText={setSessionEndTime}
                  />
                  <TouchableOpacity
                    style={styles.fieldClockBtn}
                    onPress={() => {
                      setClockPickerTarget('SESSION_END');
                      setClockPickerVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 13 }}>🕒</Text>
                    <Text style={styles.fieldClockBtnText}>Clock</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowSessionsModal(false);
                  setIsSessionTypeDropdownOpen(false);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#d97706' }]}
                disabled={isSubmittingSession}
                onPress={handleAddSessionSubmit}
              >
                {isSubmittingSession ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalConfirmText}>DONE</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </Modal>

      {/* CLOCK PICKER MODAL (For Breaks & Sessions) */}
      <ClockPickerModal
        visible={clockPickerVisible}
        title={
          clockPickerTarget === 'BREAK_START'
            ? 'Select Break Start Time'
            : clockPickerTarget === 'BREAK_END'
              ? 'Select Break End Time'
              : clockPickerTarget === 'SESSION_START'
                ? 'Select Session Start Time'
                : 'Select Session End Time'
        }
        initialTime={
          clockPickerTarget === 'BREAK_START'
            ? breakStartTime
            : clockPickerTarget === 'BREAK_END'
              ? breakEndTime
              : clockPickerTarget === 'SESSION_START'
                ? sessionStartTime
                : sessionEndTime
        }
        referenceStartTime={clockPickerTarget === 'BREAK_END' ? breakStartTime : undefined}
        onClose={() => setClockPickerVisible(false)}
        onSelectTime={handleClockPickerSelect}
      />

      {/* 4. END DAY MODAL (Matches Manual Image 2) */}
      <Modal
        visible={showEndDayModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEndDayModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 460 }]}>
            <View style={styles.revisedModalHeader}>
              <Text style={styles.revisedModalTitle}>END DAY</Text>
              <TouchableOpacity style={styles.redCloseBtn} onPress={() => setShowEndDayModal(false)}>
                <Text style={styles.redCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.revisedModalInfo}>
              To end a Day, fill the respective list items (Day, overs, times, and comments) then submit to save.
            </Text>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldSubLabel}>DAY NO:</Text>
                <TextInput
                  style={styles.customNameInput}
                  keyboardType="numeric"
                  value={endDayNo}
                  onChangeText={setEndDayNo}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldSubLabel}>DAY END OVERS:</Text>
                <TextInput
                  style={styles.customNameInput}
                  value={endDayOvers}
                  onChangeText={setEndDayOvers}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldSubLabel}>DAY START TIME:</Text>
                <TextInput
                  style={styles.customNameInput}
                  value={endDayStartTime}
                  onChangeText={setEndDayStartTime}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldSubLabel}>DAY END TIME:</Text>
                <TextInput
                  style={styles.customNameInput}
                  value={endDayEndTime}
                  onChangeText={setEndDayEndTime}
                />
              </View>
            </View>

            <View style={{ marginTop: 8, marginBottom: 14 }}>
              <Text style={styles.fieldSubLabel}>COMMENTS:</Text>
              <TextInput
                style={styles.customNameInput}
                value={endDayComments}
                onChangeText={setEndDayComments}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowEndDayModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#d97706' }]}
                disabled={isSubmittingEndDay}
                onPress={handleAddEndDaySubmit}
              >
                {isSubmittingEndDay ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalConfirmText}>DONE</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 5. DECLARE INNINGS MODAL (Matches Manual Image 4) */}
      <Modal
        visible={showDeclareModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeclareModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 380 }]}>
            <View style={styles.revisedModalHeader}>
              <Text style={styles.revisedModalTitle}>Alert</Text>
              <TouchableOpacity style={styles.redCloseBtn} onPress={() => setShowDeclareModal(false)}>
                <Text style={styles.redCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalMessage, { marginVertical: 16 }]}>
              Are you sure to declare this innings?
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowDeclareModal(false)}>
                <Text style={styles.modalCancelText}>NO</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#0284c7' }]}
                disabled={isSubmittingDeclare}
                onPress={handleDeclareInningsSubmit}
              >
                {isSubmittingDeclare ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalConfirmText}>YES</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 6. MATCH EVENTS MENU MODAL (Matches Manual Image 4 & 5) */}
      <Modal
        visible={showMatchEventsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMatchEventsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 440 }]}>
            <View style={styles.revisedModalHeader}>
              <Text style={styles.revisedModalTitle}>MATCH EVENTS</Text>
              <TouchableOpacity style={styles.redCloseBtn} onPress={() => setShowMatchEventsModal(false)}>
                <Text style={styles.redCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.revisedModalInfo}>
              This Match Events option contains all match-level controls as per cricket rules.
            </Text>

            <View style={{ marginTop: 12 }}>
              {[
                { label: 'Match Start / End Time', icon: '⏱️', action: () => { setShowMatchEventsModal(false); setShowMatchTimesModal(true); } },
                { label: 'Penalty Points (5 Points)', icon: '⚠️', action: () => { setShowMatchEventsModal(false); setShowPenaltyModal(true); } },
                { label: 'Other Wickets (Retired Hurt/Out, Timed Out)', icon: '🏏', action: () => { setShowMatchEventsModal(false); setShowOtherWicketModal(true); } },
                { label: 'Change Ball (New / Old Ball)', icon: '⚾', action: () => { setShowMatchEventsModal(false); setShowChangeBallModal(true); } },
                { label: 'Playing XI Edit', icon: '👥', action: () => { setShowMatchEventsModal(false); openPlayingXIModal(); } },
                { label: 'Revised Overs & Target (Rain / DLS)', icon: '🌧️', action: () => { setShowMatchEventsModal(false); setShowRevisedOversModal(true); } }
              ].map((ev, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.drawerMenuItem}
                  onPress={ev.action}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 16, marginRight: 10 }}>{ev.icon}</Text>
                  <Text style={[styles.drawerMenuLabel, { flex: 1 }]}>{ev.label}</Text>
                  <Text style={styles.drawerMenuChevron}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* 7. MATCH START / END TIME MODAL (Matches Manual Image 5) */}
      <Modal
        visible={showMatchTimesModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMatchTimesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 420 }]}>
            <View style={styles.revisedModalHeader}>
              <Text style={styles.revisedModalTitle}>MATCH START / END TIME</Text>
              <TouchableOpacity style={styles.redCloseBtn} onPress={() => setShowMatchTimesModal(false)}>
                <Text style={styles.redCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.revisedModalInfo}>
              Click match start/end time to update the exact match times and click submit to save.
            </Text>

            <View style={{ marginTop: 12 }}>
              <Text style={styles.fieldSubLabel}>DATE:</Text>
              <TextInput
                style={styles.customNameInput}
                value={matchStartDate}
                onChangeText={setMatchStartDate}
              />
            </View>

            <View style={{ marginTop: 10 }}>
              <Text style={styles.fieldSubLabel}>START TIME:</Text>
              <TextInput
                style={styles.customNameInput}
                value={matchStartTimeInput}
                onChangeText={setMatchStartTimeInput}
              />
            </View>

            <View style={{ marginTop: 10, marginBottom: 16 }}>
              <Text style={styles.fieldSubLabel}>END TIME:</Text>
              <TextInput
                style={styles.customNameInput}
                placeholder="e.g. 01:00 PM"
                placeholderTextColor="#94a3b8"
                value={matchEndTimeInput}
                onChangeText={setMatchEndTimeInput}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowMatchTimesModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#d97706' }]}
                disabled={isSubmittingMatchTimes}
                onPress={handleUpdateMatchTimesSubmit}
              >
                {isSubmittingMatchTimes ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalConfirmText}>SUBMIT</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 8. PENALTY POINTS MODAL (Enhanced with Team Selector, Dropdown & Inbox Dispatch) */}
      <Modal
        visible={showPenaltyModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowPenaltyModal(false);
          setIsPenaltyReasonDropdownOpen(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 500 }]}>
            <View style={styles.revisedModalHeader}>
              <View>
                <Text style={styles.revisedModalTitle}>PENALTY POINTS</Text>
                <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Official Match Referee & Scorer Penalty Decision
                </Text>
              </View>
              <TouchableOpacity
                style={styles.redCloseBtn}
                onPress={() => {
                  setShowPenaltyModal(false);
                  setIsPenaltyReasonDropdownOpen(false);
                }}
              >
                <Text style={styles.redCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* 1. SELECT TARGET TEAM (Batting or Bowling) */}
            {(() => {
              const isSecondInnings = matchInfo?.currentInningsNumber === 2;
              const teamARole = isSecondInnings ? 'Bowling' : 'Batting';
              const teamBRole = isSecondInnings ? 'Batting' : 'Bowling';
              const teamAName = matchInfo?.teamA || 'Team A';
              const teamBName = matchInfo?.teamB || 'Team B';
              const selectedTeamDisplayName = penaltyTargetTeam === 'B' ? teamBName : teamAName;

              return (
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.fieldSubLabel}>CHOOSE TEAM INCURRING PENALTY:</Text>
                  <View style={styles.penaltyTeamRow}>
                    <TouchableOpacity
                      style={[
                        styles.penaltyTeamCard,
                        penaltyTargetTeam === 'A' && styles.penaltyTeamCardActive
                      ]}
                      onPress={() => {
                        setPenaltyTargetTeam('A');
                        setPenaltyType(teamARole === 'Batting' ? 'Batting Penalty' : 'Bowling Penalty');
                      }}
                      activeOpacity={0.75}
                    >
                      <Text style={[
                        styles.penaltyTeamRoleBadge,
                        penaltyTargetTeam === 'A' && styles.penaltyTeamRoleBadgeActive
                      ]}>
                        {teamARole.toUpperCase()} TEAM
                      </Text>
                      <Text
                        style={[
                          styles.penaltyTeamName,
                          penaltyTargetTeam === 'A' && styles.penaltyTeamNameActive
                        ]}
                        numberOfLines={1}
                      >
                        {teamAName}
                      </Text>
                      {penaltyTargetTeam === 'A' && (
                        <View style={{ marginTop: 4, backgroundColor: '#d97706', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 }}>
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>SELECTED ✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.penaltyTeamCard,
                        penaltyTargetTeam === 'B' && styles.penaltyTeamCardActive
                      ]}
                      onPress={() => {
                        setPenaltyTargetTeam('B');
                        setPenaltyType(teamBRole === 'Batting' ? 'Batting Penalty' : 'Bowling Penalty');
                      }}
                      activeOpacity={0.75}
                    >
                      <Text style={[
                        styles.penaltyTeamRoleBadge,
                        penaltyTargetTeam === 'B' && styles.penaltyTeamRoleBadgeActive
                      ]}>
                        {teamBRole.toUpperCase()} TEAM
                      </Text>
                      <Text
                        style={[
                          styles.penaltyTeamName,
                          penaltyTargetTeam === 'B' && styles.penaltyTeamNameActive
                        ]}
                        numberOfLines={1}
                      >
                        {teamBName}
                      </Text>
                      {penaltyTargetTeam === 'B' && (
                        <View style={{ marginTop: 4, backgroundColor: '#d97706', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 }}>
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>SELECTED ✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* 2. POINTS & PENALTY CATEGORY */}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldSubLabel}>POINTS:</Text>
                      <TextInput
                        style={[styles.customNameInput, { fontWeight: 'bold', fontSize: 16 }]}
                        keyboardType="numeric"
                        value={penaltyPointsInput}
                        onChangeText={setPenaltyPointsInput}
                      />
                    </View>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.fieldSubLabel}>PENALTY CATEGORY:</Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {['Batting Penalty', 'Bowling Penalty'].map((pt) => (
                          <TouchableOpacity
                            key={pt}
                            style={[styles.quickReasonChip, penaltyType === pt && styles.quickReasonChipActive]}
                            onPress={() => setPenaltyType(pt)}
                          >
                            <Text style={[styles.quickReasonChipText, penaltyType === pt && styles.quickReasonChipTextActive]}>{pt}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>

                  {/* 3. TYPE CUSTOM REASON (FIRST OPTION FOR UNLISTED REASONS) */}
                  <View style={{ marginTop: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.fieldSubLabel}>✍️ TYPE CUSTOM REASON (IF NOT IN DROPDOWN):</Text>
                      {customPenaltyReason.trim().length > 0 && (
                        <TouchableOpacity onPress={() => setCustomPenaltyReason('')}>
                          <Text style={{ fontSize: 11, color: '#ef4444', fontWeight: 'bold' }}>Clear</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <TextInput
                      style={[
                        styles.customNameInput,
                        {
                          marginTop: 4,
                          fontSize: 13,
                          borderColor: customPenaltyReason.trim() ? '#d97706' : '#cbd5e1',
                          backgroundColor: customPenaltyReason.trim() ? '#fffbeb' : '#ffffff'
                        }
                      ]}
                      placeholder="Type custom penalty reason here..."
                      placeholderTextColor="#94a3b8"
                      value={customPenaltyReason}
                      onChangeText={(text) => {
                        setCustomPenaltyReason(text);
                        if (text.trim() && isPenaltyReasonDropdownOpen) {
                          setIsPenaltyReasonDropdownOpen(false);
                        }
                      }}
                    />
                    {customPenaltyReason.trim().length > 0 && (
                      <Text style={{ fontSize: 10, color: '#d97706', fontWeight: '700', marginTop: 2 }}>
                        * Custom reason will be applied and delivered to team inbox.
                      </Text>
                    )}
                  </View>

                  {/* 4. CHOOSE FROM DROPDOWN */}
                  <View style={{ marginTop: 10, position: 'relative', zIndex: 50 }}>
                    <Text style={styles.fieldSubLabel}>OR CHOOSE PENALTY TYPE / REASON (DROPDOWN):</Text>
                    <TouchableOpacity
                      style={[
                        styles.penaltyDropdownTrigger,
                        isPenaltyReasonDropdownOpen && styles.penaltyDropdownTriggerActive
                      ]}
                      onPress={() => setIsPenaltyReasonDropdownOpen(!isPenaltyReasonDropdownOpen)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.penaltyDropdownText} numberOfLines={1}>
                        {customPenaltyReason.trim() ? `[Custom]: ${customPenaltyReason}` : penaltyReason}
                      </Text>
                      <Text style={styles.penaltyDropdownArrow}>
                        {isPenaltyReasonDropdownOpen ? '▲' : '▼'}
                      </Text>
                    </TouchableOpacity>

                    {isPenaltyReasonDropdownOpen && (
                      <View style={styles.penaltyDropdownMenu}>
                        <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled showsVerticalScrollIndicator={true}>
                          {STANDARD_PENALTY_REASONS.map((reasonText) => {
                            const isSelected = !customPenaltyReason.trim() && penaltyReason === reasonText;
                            return (
                              <TouchableOpacity
                                key={reasonText}
                                style={[
                                  styles.penaltyDropdownItem,
                                  isSelected && styles.penaltyDropdownItemActive
                                ]}
                                onPress={() => {
                                  setPenaltyReason(reasonText);
                                  setCustomPenaltyReason('');
                                  setIsPenaltyReasonDropdownOpen(false);
                                }}
                                activeOpacity={0.7}
                              >
                                <Text style={[
                                  styles.penaltyDropdownItemText,
                                  isSelected && styles.penaltyDropdownItemTextActive
                                ]}>
                                  {reasonText}
                                </Text>
                                {isSelected && <Text style={{ color: '#d97706', fontWeight: 'bold' }}>✓</Text>}
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  {/* 5. TEAM INBOX DELIVERY NOTICE */}
                  <View style={styles.penaltyInboxNoticeBox}>
                    <Text style={styles.penaltyInboxNoticeTitle}>
                      📬 Team Inbox & Login Dispatch:
                    </Text>
                    <Text style={styles.penaltyInboxNoticeText}>
                      This official penalty notice will be automatically routed to <Text style={{ fontWeight: 'bold' }}>{selectedTeamDisplayName}</Text>'s Team Login Inbox & Dashboard notices.
                    </Text>
                  </View>

                  {/* Actions */}
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={styles.modalCancelBtn}
                      onPress={() => {
                        setShowPenaltyModal(false);
                        setIsPenaltyReasonDropdownOpen(false);
                      }}
                    >
                      <Text style={styles.modalCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalConfirmBtn, { backgroundColor: '#d97706' }]}
                      disabled={isSubmittingPenalty}
                      onPress={handleAddPenaltySubmit}
                    >
                      {isSubmittingPenalty ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.modalConfirmText}>SUBMIT & DISPATCH ✉️</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* 9. OTHER WICKETS MODAL (Matches Manual Image 5) */}
      <Modal
        visible={showOtherWicketModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOtherWicketModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 460 }]}>
            <View style={styles.revisedModalHeader}>
              <Text style={styles.revisedModalTitle}>OTHER WICKETS</Text>
              <TouchableOpacity style={styles.redCloseBtn} onPress={() => setShowOtherWicketModal(false)}>
                <Text style={styles.redCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.revisedModalInfo}>
              Click other wicket and choose wicket type, player name, give comment and submit to save.
            </Text>

            <View style={{ marginTop: 10 }}>
              <Text style={styles.fieldSubLabel}>OTHER WICKET TYPE:</Text>
              <View style={styles.categoryGrid}>
                {['Absent Hurt', 'Timed Out', 'Mankading', 'Retired out', 'Retired Hurt'].map((ow) => {
                  const val = ow.toUpperCase().replace(/ /g, '_');
                  return (
                    <TouchableOpacity
                      key={ow}
                      style={[styles.quickReasonChip, otherWicketType === val && styles.quickReasonChipActive, { marginBottom: 4 }]}
                      onPress={() => setOtherWicketType(val)}
                    >
                      <Text style={[styles.quickReasonChipText, otherWicketType === val && styles.quickReasonChipTextActive]}>{ow}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={{ marginTop: 10 }}>
              <Text style={styles.fieldSubLabel}>SELECT BATTER:</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {striker && (
                  <TouchableOpacity
                    style={[styles.choiceChip, otherWicketPlayerId === striker.id && styles.choiceChipActive]}
                    onPress={() => setOtherWicketPlayerId(striker.id)}
                  >
                    <Text style={[styles.choiceChipText, otherWicketPlayerId === striker.id && styles.choiceChipTextActive]}>
                      Striker: {striker.name}
                    </Text>
                  </TouchableOpacity>
                )}
                {nonStriker && (
                  <TouchableOpacity
                    style={[styles.choiceChip, otherWicketPlayerId === nonStriker.id && styles.choiceChipActive]}
                    onPress={() => setOtherWicketPlayerId(nonStriker.id)}
                  >
                    <Text style={[styles.choiceChipText, otherWicketPlayerId === nonStriker.id && styles.choiceChipTextActive]}>
                      Non-Striker: {nonStriker.name}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={{ marginTop: 10, marginBottom: 16 }}>
              <Text style={styles.fieldSubLabel}>COMMENTS / NOTE:</Text>
              <TextInput
                style={styles.customNameInput}
                value={otherWicketComments}
                onChangeText={setOtherWicketComments}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowOtherWicketModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#d97706' }]}
                disabled={isSubmittingOtherWicket}
                onPress={handleRecordOtherWicketSubmit}
              >
                {isSubmittingOtherWicket ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalConfirmText}>SUBMIT</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 10. CHANGE BALL MODAL (Matches Manual Image 5) */}
      <Modal
        visible={showChangeBallModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowChangeBallModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 420 }]}>
            <View style={styles.revisedModalHeader}>
              <Text style={styles.revisedModalTitle}>BALL CHANGES</Text>
              <TouchableOpacity style={styles.redCloseBtn} onPress={() => setShowChangeBallModal(false)}>
                <Text style={styles.redCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.revisedModalInfo}>
              Click on Change Ball option and update the relevant information accordingly and click submit to save details.
            </Text>

            <View style={{ marginTop: 12 }}>
              <Text style={styles.fieldSubLabel}>BALL TYPE:</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                {['New Ball', 'Old Ball', 'Semi-New Ball'].map((bt) => (
                  <TouchableOpacity
                    key={bt}
                    style={[styles.choiceChip, ballTypeChoice === bt && styles.choiceChipActive]}
                    onPress={() => setBallTypeChoice(bt)}
                  >
                    <Text style={[styles.choiceChipText, ballTypeChoice === bt && styles.choiceChipTextActive]}>{bt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ marginTop: 10 }}>
              <Text style={styles.fieldSubLabel}>AT OVER:</Text>
              <TextInput
                style={styles.customNameInput}
                value={ballChangeOver}
                onChangeText={setBallChangeOver}
              />
            </View>

            <View style={{ marginTop: 10, marginBottom: 16 }}>
              <Text style={styles.fieldSubLabel}>COMMENTS / REASON:</Text>
              <TextInput
                style={styles.customNameInput}
                value={ballChangeComments}
                onChangeText={setBallChangeComments}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowChangeBallModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#d97706' }]}
                disabled={isSubmittingBallChange}
                onPress={handleRecordBallChangeSubmit}
              >
                {isSubmittingBallChange ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalConfirmText}>DONE</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 11. CHANGE TEAM MODAL (Matches Manual Image 1 Slide 1 & 2) */}
      <Modal
        visible={showChangeTeamModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowChangeTeamModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 500, maxHeight: '90%' }]}>
            <View style={styles.revisedModalHeader}>
              <Text style={styles.revisedModalTitle}>CHANGE TEAM</Text>
              <TouchableOpacity style={styles.redCloseBtn} onPress={() => setShowChangeTeamModal(false)}>
                <Text style={styles.redCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.revisedModalInfo}>
              "Change Team" : If the user made any mistake in the toss section, they can revert their selection by using change team option.
              {'\n\n'}Note: This is applicable only before the first ball of the match is started in the Scoring App.
            </Text>

            {balls > 0 ? (
              <View style={[styles.errorAlertBox, { marginTop: 14 }]}>
                <Text style={styles.errorAlertText}>
                  ⚠️ First ball of the match has already been bowled ({getOvers(balls)} ov). Teams and opening players cannot be altered once scoring has commenced.
                </Text>
                <TouchableOpacity
                  style={[styles.modalConfirmBtn, { backgroundColor: '#64748b', marginTop: 14, width: '100%' }]}
                  onPress={() => setShowChangeTeamModal(false)}
                >
                  <Text style={[styles.modalConfirmText, { textAlign: 'center' }]}>Close</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView style={{ marginTop: 10, maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {/* 1. Choose Batting Team */}
                <Text style={styles.fieldSubLabel}>SELECT BATTING TEAM:</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 12 }}>
                  <TouchableOpacity
                    style={[
                      styles.choiceChip,
                      (!changeTeamBattingTeamId || changeTeamBattingTeamId === matchInfo.teamAId) && styles.choiceChipActive
                    ]}
                    onPress={() => {
                      setChangeTeamBattingTeamId(matchInfo.teamAId);
                      const tAPlayers = matchInfo.teamAPlayers || battingSquad || [];
                      const tBPlayers = matchInfo.teamBPlayers || bowlingSquad || [];
                      if (tAPlayers[0]) setChangeTeamStrikerId(tAPlayers[0].id);
                      if (tAPlayers[1]) setChangeTeamNonStrikerId(tAPlayers[1].id);
                      if (tBPlayers[0]) setChangeTeamBowlerId(tBPlayers[0].id);
                    }}
                  >
                    <Text style={[
                      styles.choiceChipText,
                      (!changeTeamBattingTeamId || changeTeamBattingTeamId === matchInfo.teamAId) && styles.choiceChipTextActive
                    ]}>
                      {matchInfo.teamA} (Team A)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.choiceChip,
                      changeTeamBattingTeamId === matchInfo.teamBId && styles.choiceChipActive
                    ]}
                    onPress={() => {
                      setChangeTeamBattingTeamId(matchInfo.teamBId);
                      const tAPlayers = matchInfo.teamAPlayers || battingSquad || [];
                      const tBPlayers = matchInfo.teamBPlayers || bowlingSquad || [];
                      if (tBPlayers[0]) setChangeTeamStrikerId(tBPlayers[0].id);
                      if (tBPlayers[1]) setChangeTeamNonStrikerId(tBPlayers[1].id);
                      if (tAPlayers[0]) setChangeTeamBowlerId(tAPlayers[0].id);
                    }}
                  >
                    <Text style={[
                      styles.choiceChipText,
                      changeTeamBattingTeamId === matchInfo.teamBId && styles.choiceChipTextActive
                    ]}>
                      {matchInfo.teamB} (Team B)
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 2. Choose Striker */}
                {(() => {
                  const isTeamA = !changeTeamBattingTeamId || changeTeamBattingTeamId === matchInfo.teamAId;
                  const batList = isTeamA ? (matchInfo.teamAPlayers || battingSquad || []) : (matchInfo.teamBPlayers || bowlingSquad || []);
                  const bowlList = isTeamA ? (matchInfo.teamBPlayers || bowlingSquad || []) : (matchInfo.teamAPlayers || battingSquad || []);

                  return (
                    <View>
                      <Text style={styles.fieldSubLabel}>OPENING STRIKER (*):</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, marginTop: 4 }}>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {batList.map((p: any) => (
                            <TouchableOpacity
                              key={`striker-${p.id}`}
                              style={[
                                styles.quickReasonChip,
                                changeTeamStrikerId === p.id && styles.quickReasonChipActive
                              ]}
                              onPress={() => setChangeTeamStrikerId(p.id)}
                            >
                              <Text style={[
                                styles.quickReasonChipText,
                                changeTeamStrikerId === p.id && styles.quickReasonChipTextActive
                              ]}>
                                * {p.name}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>

                      <Text style={styles.fieldSubLabel}>OPENING NON-STRIKER:</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, marginTop: 4 }}>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {batList
                            .filter((p: any) => p.id !== changeTeamStrikerId)
                            .map((p: any) => (
                              <TouchableOpacity
                                key={`nonstriker-${p.id}`}
                                style={[
                                  styles.quickReasonChip,
                                  changeTeamNonStrikerId === p.id && styles.quickReasonChipActive
                                ]}
                                onPress={() => setChangeTeamNonStrikerId(p.id)}
                              >
                                <Text style={[
                                  styles.quickReasonChipText,
                                  changeTeamNonStrikerId === p.id && styles.quickReasonChipTextActive
                                ]}>
                                  {p.name}
                                </Text>
                              </TouchableOpacity>
                            ))}
                        </View>
                      </ScrollView>

                      <Text style={styles.fieldSubLabel}>OPENING BOWLER (OPPOSING TEAM):</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14, marginTop: 4 }}>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {bowlList.map((p: any) => (
                            <TouchableOpacity
                              key={`bowler-${p.id}`}
                              style={[
                                styles.quickReasonChip,
                                changeTeamBowlerId === p.id && { backgroundColor: '#1e3a8a', borderColor: '#3b82f6' }
                              ]}
                              onPress={() => setChangeTeamBowlerId(p.id)}
                            >
                              <Text style={[
                                styles.quickReasonChipText,
                                changeTeamBowlerId === p.id && { color: '#93c5fd', fontWeight: 'bold' }
                              ]}>
                                🎯 {p.name}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  );
                })()}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setShowChangeTeamModal(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalConfirmBtn, { backgroundColor: '#d97706' }]}
                    disabled={isSubmittingChangeTeam}
                    onPress={handleChangeTeamSubmit}
                  >
                    {isSubmittingChangeTeam ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.modalConfirmText}>SUBMIT</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* 12. UMPIRE ASSESSMENT MODAL */}
      <Modal
        visible={showUmpireModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUmpireModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 460 }]}>
            <View style={styles.revisedModalHeader}>
              <Text style={styles.revisedModalTitle}>UMPIRE ASSESSMENT</Text>
              <TouchableOpacity style={styles.redCloseBtn} onPress={() => setShowUmpireModal(false)}>
                <Text style={styles.redCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.revisedModalInfo}>
              Scorer match report: Rate officiating umpires and record pitch assessment.
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <View style={{ flex: 2 }}>
                <Text style={styles.fieldSubLabel}>UMPIRE 1 NAME:</Text>
                <TextInput
                  style={styles.customNameInput}
                  value={umpire1Name}
                  onChangeText={setUmpire1Name}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldSubLabel}>RATING (1-10):</Text>
                <TextInput
                  style={styles.customNameInput}
                  keyboardType="numeric"
                  value={umpire1Rating}
                  onChangeText={setUmpire1Rating}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <View style={{ flex: 2 }}>
                <Text style={styles.fieldSubLabel}>UMPIRE 2 NAME:</Text>
                <TextInput
                  style={styles.customNameInput}
                  value={umpire2Name}
                  onChangeText={setUmpire2Name}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldSubLabel}>RATING (1-10):</Text>
                <TextInput
                  style={styles.customNameInput}
                  keyboardType="numeric"
                  value={umpire2Rating}
                  onChangeText={setUmpire2Rating}
                />
              </View>
            </View>

            <View style={{ marginTop: 8 }}>
              <Text style={styles.fieldSubLabel}>PITCH REPORT:</Text>
              <TextInput
                style={styles.customNameInput}
                value={pitchReportInput}
                onChangeText={setPitchReportInput}
              />
            </View>

            <View style={{ marginTop: 8, marginBottom: 16 }}>
              <Text style={styles.fieldSubLabel}>ADDITIONAL COMMENTS:</Text>
              <TextInput
                style={styles.customNameInput}
                value={umpireCommentsInput}
                onChangeText={setUmpireCommentsInput}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowUmpireModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#d97706' }]}
                disabled={isSubmittingUmpire}
                onPress={handleSaveUmpireAssessmentSubmit}
              >
                {isSubmittingUmpire ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalConfirmText}>SUBMIT</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* REVISED OVERS & TARGET MODAL */}
      <Modal
        visible={showRevisedOversModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRevisedOversModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 460 }]}>
            <View style={styles.revisedModalHeader}>
              <Text style={styles.revisedModalTitle}>
                {matchInfo.currentInningsNumber === 2 ? 'REVISED TARGET & OVERS' : 'REVISED OVERS'}
              </Text>
              <TouchableOpacity
                style={styles.redCloseBtn}
                onPress={() => setShowRevisedOversModal(false)}
              >
                <Text style={styles.redCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.revisedModalInfo}>
              Click revised overs and fill the fields accordingly and click submit to save the details.
              {matchInfo.currentInningsNumber === 2 ? (
                '\n\n"Revised Target" Option will be available during second innings only. User can update the same many times and same will be replicated in both scoring engine and report brief scores accordingly.'
              ) : ''}
            </Text>

            <View style={{ marginTop: 12 }}>
              <Text style={styles.fieldSubLabel}>NUMBER OF OVERS:</Text>
              <TextInput
                style={styles.customNameInput}
                keyboardType="numeric"
                placeholder="e.g. 15"
                placeholderTextColor="#94a3b8"
                value={revisedOversInput}
                onChangeText={setRevisedOversInput}
              />
            </View>

            {matchInfo.currentInningsNumber === 2 && (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.fieldSubLabel}>REVISED TARGET (RUNS):</Text>
                <TextInput
                  style={styles.customNameInput}
                  keyboardType="numeric"
                  placeholder="e.g. 120"
                  placeholderTextColor="#94a3b8"
                  value={revisedTargetInput}
                  onChangeText={setRevisedTargetInput}
                />
              </View>
            )}

            <View style={{ marginTop: 10, marginBottom: 16 }}>
              <Text style={styles.fieldSubLabel}>COMMENTS / REASON:</Text>
              <TextInput
                style={[styles.customNameInput, { height: 60, textAlignVertical: 'top' }]}
                multiline
                placeholder="e.g. Rain interruption reduced match to 15 overs (DLS target)"
                placeholderTextColor="#94a3b8"
                value={revisedCommentsInput}
                onChangeText={setRevisedCommentsInput}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowRevisedOversModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#d97706' }]}
                disabled={isSubmittingRevised}
                onPress={handleRevisedOversSubmit}
              >
                {isSubmittingRevised ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>SAVE</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 3. PLAYING XI EDIT MODAL (Step 1, Step 2, Step 3) */}
      <Modal
        visible={showPlayingXIModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPlayingXIModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 520, maxHeight: '90%' }]}>
            {/* Step 1: Select Team */}
            {playingXIStep === 1 && (
              <View>
                <View style={styles.revisedModalHeader}>
                  <Text style={styles.revisedModalTitle}>PLAYING XI EDIT</Text>
                  <TouchableOpacity
                    style={styles.redCloseBtn}
                    onPress={() => setShowPlayingXIModal(false)}
                  >
                    <Text style={styles.redCloseBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.revisedModalInfo}>
                  Select team to edit playing XI. Note: This option is applicable only for players who have not batted/bowled a single delivery.
                </Text>

                <View style={{ marginTop: 16, marginBottom: 20 }}>
                  <Text style={styles.fieldSubLabel}>SELECT TEAM:</Text>
                  <TouchableOpacity
                    style={[
                      styles.teamSelectCard,
                      playingXITeam === 'A' && styles.teamSelectCardActive
                    ]}
                    onPress={() => setPlayingXITeam('A')}
                  >
                    <Text style={[styles.teamSelectCardText, playingXITeam === 'A' && styles.teamSelectCardTextActive]}>
                      {matchInfo.teamA}
                    </Text>
                    {playingXITeam === 'A' && <Text style={styles.teamSelectCheck}>✓</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.teamSelectCard,
                      playingXITeam === 'B' && styles.teamSelectCardActive,
                      { marginTop: 8 }
                    ]}
                    onPress={() => setPlayingXITeam('B')}
                  >
                    <Text style={[styles.teamSelectCardText, playingXITeam === 'B' && styles.teamSelectCardTextActive]}>
                      {matchInfo.teamB}
                    </Text>
                    {playingXITeam === 'B' && <Text style={styles.teamSelectCheck}>✓</Text>}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.modalConfirmBtn, { backgroundColor: '#d97706', width: '100%' }]}
                  onPress={handlePlayingXITeamProceed}
                >
                  <Text style={[styles.modalConfirmText, { textAlign: 'center' }]}>PROCEED</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Step 2: Squad Selection with Checkboxes */}
            {playingXIStep === 2 && (
              <View style={{ flex: 1 }}>
                <View style={styles.revisedModalHeader}>
                  <View>
                    <Text style={styles.revisedModalTitle}>SELECT PLAYERS</Text>
                    <Text style={styles.drawerSubtitle}>{playingXITeam === 'A' ? matchInfo.teamA : matchInfo.teamB}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.redCloseBtn}
                    onPress={() => setPlayingXIStep(1)}
                  >
                    <Text style={styles.redCloseBtnText}>←</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.revisedModalInfo, { fontSize: 11 }]}>
                  🔒 Players who have already batted or bowled cannot be replaced. Uncheck available player to replace with bench member.
                </Text>

                <ScrollView style={{ maxHeight: 320, marginTop: 10 }}>
                  {(playingXITeam === 'A' ? battingSquad : bowlingSquad).map((p: any) => {
                    const isSelected = selectedPlayingXI.includes(p.id);
                    // Check if player is locked (striker, nonStriker, dismissed, or bowler with overs)
                    const isBatted = p.id === striker?.id || p.id === nonStriker?.id || dismissedBatters.includes(p.id);
                    const isBowled = bowler?.id === p.id || (p.overs && parseFloat(p.overs) > 0);
                    const isLocked = isBatted || isBowled;

                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[
                          styles.playerCheckRow,
                          isSelected && styles.playerCheckRowSelected,
                          isLocked && styles.playerCheckRowLocked
                        ]}
                        onPress={() => handlePlayingXIToggle(p.id, isLocked)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.checkboxBox, isSelected && styles.checkboxBoxChecked]}>
                          {isSelected && <Text style={styles.checkboxTick}>✓</Text>}
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[styles.playerNameText, isSelected && styles.playerNameTextSelected]}>
                            {p.name}
                          </Text>
                          <Text style={styles.playerRoleSub}>{p.role || 'BATTER'} {p.jersey_number ? `• #${p.jersey_number}` : ''}</Text>
                        </View>
                        {isLocked && (
                          <View style={styles.lockedBadge}>
                            <Text style={styles.lockedBadgeText}>🔒 In Play</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={styles.squadBottomBar}>
                  <View style={[styles.playerCountBadge, selectedPlayingXI.length === 11 ? styles.countBadgeGreen : styles.countBadgeRed]}>
                    <Text style={styles.playerCountText}>{selectedPlayingXI.length} Players Selected</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={styles.modalCancelBtn}
                      onPress={() => setPlayingXIStep(1)}
                    >
                      <Text style={styles.modalCancelText}>✕</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalConfirmBtn, { backgroundColor: '#0284c7' }]}
                      disabled={selectedPlayingXI.length !== 11}
                      onPress={() => setPlayingXIStep(3)}
                    >
                      <Text style={styles.modalConfirmText}>Next: Order ✓</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Step 3: Players Order Screen */}
            {playingXIStep === 3 && (
              <View style={{ flex: 1 }}>
                <View style={styles.revisedModalHeader}>
                  <View>
                    <Text style={styles.revisedModalTitle}>PLAYERS ORDER</Text>
                    <Text style={styles.drawerSubtitle}>{playingXITeam === 'A' ? matchInfo.teamA : matchInfo.teamB}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.redCloseBtn}
                    onPress={() => setPlayingXIStep(2)}
                  >
                    <Text style={styles.redCloseBtnText}>←</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.revisedModalInfo, { fontSize: 11 }]}>
                  Review playing XI batting lineup. Click tick symbol to save the changes.
                </Text>

                <ScrollView style={{ maxHeight: 320, marginTop: 10 }}>
                  {selectedPlayingXI.map((pid, idx) => {
                    const allPlayers = [...battingSquad, ...bowlingSquad];
                    const pObj = allPlayers.find(p => p.id === pid) || { name: pid, role: 'BATTER' };
                    const isKeeper = pObj.role === 'WICKET_KEEPER' || idx === 1;
                    const isCaptain = idx === 3;

                    return (
                      <View key={pid} style={styles.orderPlayerRow}>
                        <Text style={styles.orderNumber}>{idx + 1}</Text>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.orderPlayerName}>{pObj.name}</Text>
                          <Text style={styles.playerRoleSub}>{pObj.role || 'BATTER'}</Text>
                        </View>
                        {isCaptain && (
                          <View style={[styles.roleBadge, { backgroundColor: '#fef3c7', borderColor: '#fcd34d' }]}>
                            <Text style={[styles.roleBadgeText, { color: '#b45309' }]}>CAPTAIN</Text>
                          </View>
                        )}
                        {isKeeper && (
                          <View style={[styles.roleBadge, { backgroundColor: '#e0f2fe', borderColor: '#7dd3fc', marginLeft: 4 }]}>
                            <Text style={[styles.roleBadgeText, { color: '#0369a1' }]}>WICKET KEEPER</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>

                <View style={[styles.modalActions, { marginTop: 14 }]}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setPlayingXIStep(2)}
                  >
                    <Text style={styles.modalCancelText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalConfirmBtn, { backgroundColor: '#0284c7' }]}
                    disabled={isSubmittingPlayingXI}
                    onPress={handlePlayingXISubmit}
                  >
                    {isSubmittingPlayingXI ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.modalConfirmText}>Save Playing XI ✓</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* 4. END MATCH & SUPER OVER MODAL */}
      <Modal
        visible={showEndMatchModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEndMatchModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 460 }]}>
            <View style={styles.revisedModalHeader}>
              <Text style={styles.revisedModalTitle}>END MATCH</Text>
              <TouchableOpacity
                style={styles.redCloseBtn}
                onPress={() => setShowEndMatchModal(false)}
              >
                <Text style={styles.redCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.revisedModalInfo}>
              Declare match result or conduct T20 Super Over if scores are tied.
            </Text>

            <View style={{ marginTop: 12 }}>
              <Text style={styles.fieldSubLabel}>RESULT:</Text>
              <View style={styles.categoryGrid}>
                {[
                  { key: 'WIN', label: 'Match Won', desc: 'Select winning team' },
                  { key: 'TIE', label: 'Match Tied', desc: 'Tie / Super Over option' }
                ].map((res) => (
                  <TouchableOpacity
                    key={res.key}
                    style={[styles.categoryOption, endMatchResult === res.key && styles.categoryOptionActive]}
                    onPress={() => setEndMatchResult(res.key as any)}
                  >
                    <Text style={[styles.categoryOptionText, endMatchResult === res.key && styles.categoryOptionTextActive]}>
                      {res.label}
                    </Text>
                    <Text style={styles.categoryOptionDesc}>{res.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {endMatchResult === 'WIN' && (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.fieldSubLabel}>WINNER TEAM:</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={[
                      styles.choiceChip,
                      winnerTeamId === matchInfo.teamAId && styles.choiceChipActive
                    ]}
                    onPress={() => setWinnerTeamId(matchInfo.teamAId)}
                  >
                    <Text style={[styles.choiceChipText, winnerTeamId === matchInfo.teamAId && styles.choiceChipTextActive]}>
                      {matchInfo.teamA}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.choiceChip,
                      winnerTeamId === matchInfo.teamBId && styles.choiceChipActive
                    ]}
                    onPress={() => setWinnerTeamId(matchInfo.teamBId)}
                  >
                    <Text style={[styles.choiceChipText, winnerTeamId === matchInfo.teamBId && styles.choiceChipTextActive]}>
                      {matchInfo.teamB}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* T20 SUPER OVER SECTION (From Manual) */}
            {endMatchResult === 'TIE' && (
              <View style={styles.superOverCard}>
                <Text style={styles.superOverCardTitle}>⚡ T20 MATCH – SUPER OVER</Text>
                <Text style={styles.superOverCardSub}>
                  In T20 format Super over can be done. Give Result as tie — if super over click yes and select batting team and continue.
                </Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 12 }}>
                  <Text style={styles.fieldSubLabel}>Super over:</Text>
                  <TouchableOpacity
                    style={[styles.superOverChoiceBtn, isSuperOverSelected && styles.superOverChoiceBtnActive]}
                    onPress={() => setIsSuperOverSelected(true)}
                  >
                    <Text style={[styles.superOverChoiceText, isSuperOverSelected && styles.superOverChoiceTextActive]}>Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.superOverChoiceBtn, !isSuperOverSelected && styles.superOverChoiceBtnActive]}
                    onPress={() => setIsSuperOverSelected(false)}
                  >
                    <Text style={[styles.superOverChoiceText, !isSuperOverSelected && styles.superOverChoiceTextActive]}>No</Text>
                  </TouchableOpacity>
                </View>

                {isSuperOverSelected && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.fieldSubLabel}>SELECT BATTING TEAM (SUPER OVER):</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      <TouchableOpacity
                        style={[
                          styles.choiceChip,
                          superOverBattingTeam === matchInfo.teamAId && styles.choiceChipActive
                        ]}
                        onPress={() => setSuperOverBattingTeam(matchInfo.teamAId)}
                      >
                        <Text style={[styles.choiceChipText, superOverBattingTeam === matchInfo.teamAId && styles.choiceChipTextActive]}>
                          {matchInfo.teamA}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.choiceChip,
                          superOverBattingTeam === matchInfo.teamBId && styles.choiceChipActive
                        ]}
                        onPress={() => setSuperOverBattingTeam(matchInfo.teamBId)}
                      >
                        <Text style={[styles.choiceChipText, superOverBattingTeam === matchInfo.teamBId && styles.choiceChipTextActive]}>
                          {matchInfo.teamB}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            <View style={{ marginTop: 10, marginBottom: 16 }}>
              <Text style={styles.fieldSubLabel}>PLAYER OF THE MATCH (OPTIONAL):</Text>
              <TextInput
                style={styles.customNameInput}
                placeholder="e.g. Suresh Kumar"
                placeholderTextColor="#94a3b8"
                value={playerOfMatchInput}
                onChangeText={setPlayerOfMatchInput}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowEndMatchModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  { backgroundColor: isSuperOverSelected && endMatchResult === 'TIE' ? '#059669' : '#dc2626' }
                ]}
                disabled={isSubmittingEndMatch}
                onPress={handleEndMatchSubmit}
              >
                {isSubmittingEndMatch ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>
                    {isSuperOverSelected && endMatchResult === 'TIE' ? 'Start Super Over ▶' : 'End Match'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 5. EXIT SCREEN CONFIRMATION MODAL */}
      <Modal
        visible={showExitModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 420 }]}>
            <View style={styles.revisedModalHeader}>
              <Text style={styles.revisedModalTitle}>EXIT SCREEN</Text>
              <TouchableOpacity
                style={styles.redCloseBtn}
                onPress={() => setShowExitModal(false)}
              >
                <Text style={styles.redCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.revisedModalInfo, { marginVertical: 14 }]}>
              Click "Exit Screen" menu to exit from the scoring engine and give yes to exit. All recorded scores and deliveries are safely preserved in the database.
            </Text>

            <View style={[styles.modalActions, { flexWrap: 'wrap', gap: 8 }]}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowExitModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#1e3a8a' }]}
                onPress={() => {
                  setShowExitModal(false);
                  navigate('Dashboard');
                }}
              >
                <Text style={styles.modalConfirmText}>📋 Match List</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#dc2626' }]}
                onPress={() => {
                  setShowExitModal(false);
                  if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    try {
                      localStorage.setItem('cfvd_last_app_screen', 'Home');
                      localStorage.removeItem('cfvd_last_scorer_match_id');
                      localStorage.removeItem('cfvd_last_scorer_screen');
                      window.location.href = '/';
                      return;
                    } catch (_e) { }
                  }
                  if (typeof onExit === 'function') {
                    onExit('Home');
                  } else {
                    navigate('Dashboard');
                  }
                }}
              >
                <Text style={styles.modalConfirmText}>🌐 Exit to Website</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 6. END INNINGS MODAL */}
      {(() => {
        const currentBattingTeam = (matchInfo?.currentInningsNumber === 2)
          ? (matchInfo?.teamB || 'Team B')
          : (matchInfo?.battingTeam || matchInfo?.teamA || 'Team A');

        const currentBowlingTeam = (matchInfo?.currentInningsNumber === 2)
          ? (matchInfo?.teamA || 'Team A')
          : (matchInfo?.bowlingTeam || matchInfo?.teamB || 'Team B');

        const targetToChase = (runs || 0) + 1;
        const currentRunRate = balls > 0 ? (runs / (balls / 6)).toFixed(2) : '0.00';
        const totalMatchOvers = matchInfo?.revisedOvers || matchInfo?.overs || 20;
        const requiredRunRate = totalMatchOvers > 0 ? (targetToChase / totalMatchOvers).toFixed(2) : '0.00';

        return (
          <Modal visible={showEndModal} transparent animationType="fade" onRequestClose={() => setShowEndModal(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.endInningsModalCard}>
                {/* Header with Title & Close button */}
                <View style={styles.endInningsHeader}>
                  <View>
                    <View style={styles.endInningsBadge}>
                      <Text style={styles.endInningsBadgeText}>CFVD OFFICIAL MATCH SCORING</Text>
                    </View>
                    <Text style={styles.endInningsTitle}>End Innings</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.endInningsCloseBtn}
                    onPress={() => setShowEndModal(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.endInningsCloseBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Centered Cricket Artwork Image Banner */}
                <View style={styles.endInningsArtworkContainer}>
                  <Image
                    source={IMG_END_INNINGS}
                    style={styles.endInningsImage}
                    resizeMode="contain"
                  />
                  <View style={styles.endInningsInningsTag}>
                    <Text style={styles.endInningsInningsTagText}>
                      {matchInfo?.currentInningsNumber === 2 ? '2ND INNINGS CONCLUSION' : '1ST INNINGS CONCLUSION'}
                    </Text>
                  </View>
                </View>

                {/* Team and Concluded Innings Score Details */}
                <View style={styles.endInningsTeamCard}>
                  <View style={styles.endInningsTeamRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.endInningsTeamRole}>BATTING TEAM</Text>
                      <Text style={styles.endInningsTeamName} numberOfLines={1}>
                        {currentBattingTeam}
                      </Text>
                    </View>
                    <View style={styles.endInningsScoreBadge}>
                      <Text style={styles.endInningsScoreNumber}>{runs}/{wickets}</Text>
                      <Text style={styles.endInningsOversText}>({getOvers(balls)} Ov)</Text>
                    </View>
                  </View>

                  {/* Run Rate & Opponent Details */}
                  <View style={styles.endInningsStatsGrid}>
                    <View style={styles.endInningsStatCol}>
                      <Text style={styles.endInningsStatLabel}>Run Rate</Text>
                      <Text style={styles.endInningsStatValue}>{currentRunRate} RPO</Text>
                    </View>
                    <View style={styles.endInningsStatDivider} />
                    <View style={styles.endInningsStatCol}>
                      <Text style={styles.endInningsStatLabel}>Bowling / Opponent</Text>
                      <Text style={styles.endInningsStatValue} numberOfLines={1}>{currentBowlingTeam}</Text>
                    </View>
                    {matchInfo?.currentInningsNumber !== 2 && (
                      <>
                        <View style={styles.endInningsStatDivider} />
                        <View style={styles.endInningsStatCol}>
                          <Text style={styles.endInningsStatLabel}>Target for Chase</Text>
                          <Text style={[styles.endInningsStatValue, { color: '#b45309', fontWeight: 'bold' }]}>
                            {targetToChase} Runs ({requiredRunRate} RRR)
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>

                {/* Confirmation Box */}
                <View style={styles.endInningsConfirmBox}>
                  <Text style={styles.endInningsConfirmQuestion}>Are you sure you want to end this innings?</Text>
                  <Text style={styles.endInningsConfirmSub}>
                    This will conclude current innings and transition to Innings Break / Scorecard.
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.endInningsActionsRow}>
                  <TouchableOpacity
                    style={styles.endInningsCancelBtn}
                    onPress={() => setShowEndModal(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.endInningsCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.endInningsConfirmSubmitBtn}
                    onPress={handleEndInningsSubmit}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.endInningsConfirmSubmitText}>End Innings ✓</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        );
      })()}


      {/* 15. MORE RUNS MODAL (Image 2 Slide 3) */}
      <Modal
        visible={showMoreRunsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMoreRunsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 360 }]}>
            <View style={styles.revisedModalHeader}>
              <Text style={styles.revisedModalTitle}>MORE RUNS</Text>
              <TouchableOpacity style={styles.redCloseBtn} onPress={() => setShowMoreRunsModal(false)}>
                <Text style={styles.redCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.revisedModalInfo}>
              Select higher run value to award off the delivery:
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14, justifyContent: 'center' }}>
              {[5, 7, 8, 9, 10, 11].map((r) => (
                <TouchableOpacity
                  key={`more-${r}`}
                  style={[styles.scoreBtn, styles.scoreBtnNormal, { width: 90, height: 60, margin: 4 }]}
                  onPress={() => handleMoreRunsSelect(r)}
                >
                  <Text style={[styles.scoreBtnText, styles.scoreBtnTextNormal]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* 16. OVER THROW RUNS MODAL (1 to 5 buttons + Custom Input for 6+) */}
      <Modal
        visible={showOverThrowModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowOverThrowModal(false);
          setCustomOverthrowInput('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 440, width: '92%', borderRadius: 16, borderWidth: 1.5, borderColor: '#f59e0b', padding: 18 }]}>
            <View style={styles.revisedModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.revisedModalTitle}>OVER THROW RUNS</Text>
                <Text style={[styles.revisedModalInfo, { marginTop: 2 }]}>
                  Select extra runs completed or conceded on fielding overthrow:
                </Text>
              </View>
              <TouchableOpacity
                style={styles.redCloseBtn}
                onPress={() => {
                  setShowOverThrowModal(false);
                  setCustomOverthrowInput('');
                }}
              >
                <Text style={styles.redCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Overthrow Broadcast Illustration Card */}
            <View style={{
              marginTop: 10,
              marginBottom: 12,
              borderRadius: 12,
              overflow: 'hidden',
              backgroundColor: '#fffbeb',
              borderWidth: 1.5,
              borderColor: '#fde68a',
              shadowColor: '#d97706',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.15,
              shadowRadius: 6,
              elevation: 3
            }}>
              <Image
                source={overthrowImage}
                style={{
                  width: '100%',
                  height: 145,
                  resizeMode: 'cover'
                }}
              />
              <View style={{
                position: 'absolute',
                top: 8,
                left: 8,
                backgroundColor: 'rgba(217, 119, 6, 0.92)',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6
              }}>
                <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }}>
                  ⚡ MCC LAW 19.8 • OVERTHROW
                </Text>
              </View>
              <View style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.78)',
                paddingVertical: 5,
                paddingHorizontal: 10
              }}>
                <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '700', textAlign: 'center' }}>
                  🏃 Batters sprinting extra runs on missed throw to stumps / keeper
                </Text>
              </View>
            </View>

            {/* Quick 1 to 5 Buttons */}
            <Text style={{ fontSize: 11, fontWeight: '800', color: '#854d0e', textTransform: 'uppercase', marginBottom: 6 }}>
              QUICK OVERTHROW RUNS:
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
              {[1, 2, 3, 4, 5].map((r) => (
                <TouchableOpacity
                  key={`ot-${r}`}
                  style={[
                    styles.scoreBtn,
                    {
                      backgroundColor: '#fef3c7',
                      borderColor: '#f59e0b',
                      borderWidth: 1.5,
                      flex: 1,
                      height: 50,
                      marginHorizontal: 2,
                      borderRadius: 10,
                      shadowColor: '#d97706',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.15,
                      shadowRadius: 3,
                      elevation: 2
                    }
                  ]}
                  onPress={() => handleOverThrowSelect(r)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.scoreBtnText, { color: '#b45309', fontSize: 17, fontWeight: '900' }]}>+{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Input Box for 6 or more runs */}
            <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
                Or Type Custom Overthrow Runs (6+ or more):
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <TextInput
                  style={{
                    flex: 1,
                    height: 48,
                    fontSize: 16,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    backgroundColor: '#ffffff',
                    borderColor: customOverthrowInput ? '#d97706' : '#cbd5e1',
                    borderWidth: 1.5,
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    color: '#0f172a'
                  }}
                  value={customOverthrowInput}
                  onChangeText={(val) => setCustomOverthrowInput(val.replace(/\D/g, ''))}
                  placeholder="Enter runs (e.g. 6)"
                  keyboardType="number-pad"
                  placeholderTextColor="#94a3b8"
                  maxLength={2}
                />
                <TouchableOpacity
                  style={{
                    backgroundColor: customOverthrowInput.trim() ? '#d97706' : '#cbd5e1',
                    paddingHorizontal: 18,
                    height: 48,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: 8
                  }}
                  disabled={!customOverthrowInput.trim()}
                  onPress={() => {
                    const parsed = parseInt(customOverthrowInput.trim(), 10);
                    if (!isNaN(parsed) && parsed > 0) {
                      handleOverThrowSelect(parsed);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13 }}>
                    Add Runs ↵
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* 17. EXTRAS MODAL (Image 2 Slide 5) */}
      <Modal
        visible={showExtrasModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExtrasModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 480, width: '92%', maxHeight: '86%', padding: 18, display: 'flex', flexDirection: 'column' }]}>
            <View style={styles.revisedModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.revisedModalTitle}>EXTRAS & PENALTY SCORING</Text>
                <Text style={styles.revisedModalInfo}>
                  Select extra delivery category to record:
                </Text>
              </View>
              <TouchableOpacity style={styles.redCloseBtn} onPress={() => setShowExtrasModal(false)}>
                <Text style={styles.redCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ maxHeight: isDesktop ? 460 : 380, marginTop: 10 }}
              contentContainerStyle={{ gap: 8, paddingBottom: 12, paddingHorizontal: 2 }}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {[
                { key: 'WIDE', label: 'Wide (WD)', desc: '+1 run to batting team, extra delivery re-bowled', icon: '↔️' },
                { key: 'NO_BALL', label: 'No Ball (Crease / Overstep)', desc: '+1 penalty run + Free Hit on next delivery', icon: '🦶' },
                { key: 'NO_BALL_BEAMER', label: 'No Ball (Dangerous Beamer)', desc: 'Waist-high full toss (Law 41.7 Warning/Suspension)', icon: '⚡' },
                { key: 'NO_BALL_BOUNCER', label: 'No Ball (Bouncer Exceeded)', desc: '2nd bouncer in over above shoulder (Law 41.6)', icon: '🎯' },
                { key: 'DEAD_BALL', label: 'Dead Ball (Cancel & Re-bowl)', desc: 'Umpire stops play (Law 20); ball does not count', icon: '🛑' },
                { key: 'BYE', label: 'Bye (B)', desc: 'Runs taken without bat contact (0 bowler runs)', icon: '🏃' },
                { key: 'LEG_BYE', label: 'Leg Bye (LB)', desc: 'Runs taken off batter pads / body (0 bowler runs)', icon: '🦵' },
                { key: 'NO_BALL_BYE', label: 'No Ball + Bye', desc: '1 NB penalty + 1 Bye extra (2 team runs, Free Hit)', icon: '⚡' },
                { key: 'NO_BALL_LEG_BYE', label: 'No Ball + Leg Bye', desc: '1 NB penalty + 1 Leg Bye extra (2 team runs, Free Hit)', icon: '⚡' },
                { key: 'NO_BALL_RUNS', label: 'No Ball + Runs (Off Bat)', desc: '1 NB penalty + batter runs off bat (Free Hit)', icon: '🏏' },
                { key: 'PENALTY', label: 'Penalty Points (5 Runs)', desc: 'Award 5 penalty runs to batting or fielding side (Law 41/42)', icon: '⚖️' }
              ].map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={styles.extraModalItem}
                  onPress={() => handleExtrasSelect(item.key)}
                  activeOpacity={0.7}
                >
                  <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.extraModalItemTitle}>{item.label}</Text>
                    <Text style={styles.extraModalItemSub}>{item.desc}</Text>
                  </View>
                  <Text style={styles.drawerMenuChevron}>›</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 18. FIELDING TYPE MODAL (Image 2 Slide 1) */}
      <Modal
        visible={showFieldingModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFieldingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 460 }]}>
            <View style={styles.revisedModalHeader}>
              <Text style={styles.revisedModalTitle}>FIELDING TYPE</Text>
              <TouchableOpacity style={styles.redCloseBtn} onPress={() => setShowFieldingModal(false)}>
                <Text style={styles.redCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldSubLabel}>SELECT ACTIVE FIELDER:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, marginTop: 4 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {bowlingSquad.map((f) => (
                  <TouchableOpacity
                    key={`fld-${f.id}`}
                    style={[styles.quickReasonChip, selectedFielderId === f.id && styles.quickReasonChipActive]}
                    onPress={() => setSelectedFielderId(f.id)}
                  >
                    <Text style={[styles.quickReasonChipText, selectedFielderId === f.id && styles.quickReasonChipTextActive]}>
                      🧤 {f.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.fieldSubLabel}>FIELDING ACTION:</Text>
            <View style={{ marginTop: 6, gap: 6 }}>
              {[
                'Clean Collect',
                'Pick and Throw',
                'Relay Throw',
                'Direct Hit',
                'Boundary Save (4 Runs Saved)',
                'Slide and Miss',
                'Misfield',
                'Dropped Catch',
                'Overthrow Conceded'
              ].map((action) => (
                <TouchableOpacity
                  key={action}
                  style={[
                    styles.extraModalItem,
                    selectedFieldingAction === action && { backgroundColor: '#1e3a8a', borderColor: '#3b82f6' }
                  ]}
                  onPress={() => handleFieldingActionSelect(action)}
                >
                  <Text style={[
                    styles.extraModalItemTitle,
                    selectedFieldingAction === action && { color: '#93c5fd', fontWeight: 'bold' }
                  ]}>
                    {action}
                  </Text>
                  <Text style={[styles.drawerMenuChevron, selectedFieldingAction === action && { color: '#93c5fd' }]}>✓</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* 19. ADVANCED INTERACTIVE 3D WAGON WHEEL MODAL */}
      <InteractiveWagonWheelModal
        visible={showWagonWheelModal}
        runs={pendingBoundaryRun || 4}
        batterName={striker?.name || 'Striker'}
        initialBattingHand={striker?.battingHand || (striker?.batting_hand?.toUpperCase().includes('LEFT') ? 'LEFT' : 'RIGHT')}
        onConfirm={handleWagonWheelConfirm}
        onSkip={handleWagonWheelSkip}
        onClose={handleWagonWheelSkip}
      />

      {/* 20. OFFICIAL UMPIRE SIGNAL BROADCAST OVERLAY */}
      <UmpireSignalOverlay
        event={activeUmpireSignal}
        onDismiss={() => setActiveUmpireSignal(null)}
      />

      {/* 21. UMPIRE SIGNALS GALLERY MODAL */}
      <UmpireSignalsGalleryModal
        visible={showUmpireGallery}
        onClose={() => setShowUmpireGallery(false)}
        onSelectSignal={(sigType) => {
          setActiveUmpireSignal({
            type: sigType,
            batterName: striker?.name || 'K. Balaji',
            bowlerName: bowler?.name || 'Vijay',
            overText: `Over ${getOvers(balls)}`
          });
        }}
      />

      {/* 22. BROADCAST FIELDING EVENT ANIMATION OVERLAY */}
      <FieldingEventOverlay
        event={activeFieldingEvent}
        onDismiss={() => setActiveFieldingEvent(null)}
      />

      {/* 20. PITCH MAP MODAL */}
      <Modal
        visible={showPitchMapModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPitchMapModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 440 }]}>
            <View style={styles.revisedModalHeader}>
              <Text style={styles.revisedModalTitle}>PITCH MAP</Text>
              <TouchableOpacity style={styles.redCloseBtn} onPress={() => setShowPitchMapModal(false)}>
                <Text style={styles.redCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.revisedModalInfo}>
              Delivery length pitching zone:
            </Text>
            <View style={{ marginTop: 12, gap: 8 }}>
              {[
                { name: 'Yorker', desc: 'At the base of stumps' },
                { name: 'Full Length', desc: 'Drivable slot (2-4m)' },
                { name: 'Good Length', desc: 'Indecisive zone (4-6m)' },
                { name: 'Back of Length', desc: 'Chest height (6-8m)' },
                { name: 'Short Pitch', desc: 'Shoulder/head high bouncer (8m+)' }
              ].map((pZone) => (
                <TouchableOpacity
                  key={pZone.name}
                  style={[
                    styles.extraModalItem,
                    selectedPitchLength === pZone.name && { backgroundColor: '#1e3a8a', borderColor: '#3b82f6' }
                  ]}
                  onPress={() => {
                    setSelectedPitchLength(pZone.name);
                    setShowPitchMapModal(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.extraModalItemTitle, selectedPitchLength === pZone.name && { color: '#93c5fd' }]}>
                      {pZone.name}
                    </Text>
                    <Text style={styles.extraModalItemSub}>{pZone.desc}</Text>
                  </View>
                  {selectedPitchLength === pZone.name && <Text style={{ color: '#93c5fd', fontWeight: 'bold' }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* 21. REMARKS MODAL */}
      <Modal
        visible={showRemarksModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRemarksModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 420 }]}>
            <View style={styles.revisedModalHeader}>
              <Text style={styles.revisedModalTitle}>BALL REMARKS</Text>
              <TouchableOpacity style={styles.redCloseBtn} onPress={() => setShowRemarksModal(false)}>
                <Text style={styles.redCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.revisedModalInfo}>
              Add custom commentary or ball notes:
            </Text>
            <TextInput
              style={[styles.customNameInput, { height: 70, textAlignVertical: 'top', marginTop: 12 }]}
              multiline
              placeholder="e.g. Edged through slips, great diving effort at backward point..."
              placeholderTextColor="#94a3b8"
              value={deliveryRemarks}
              onChangeText={setDeliveryRemarks}
            />
            <View style={[styles.modalActions, { marginTop: 14 }]}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowRemarksModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#0284c7' }]}
                onPress={() => setShowRemarksModal(false)}
              >
                <Text style={styles.modalConfirmText}>Save Remarks</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          1. TOP MINIMAL FEDERATION HEADER (Matches Image 1 & 2)
          ───────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {/* Mobile hamburger menu (hidden on desktop, matches Image 2) */}
          {!isDesktop && (
            <TouchableOpacity
              onPress={() => setShowSideDrawer(true)}
              style={styles.hamburgerBtn}
              accessibilityLabel="Open Navigation Menu"
              activeOpacity={0.7}
            >
              <Text style={styles.hamburgerIcon}>☰</Text>
            </TouchableOpacity>
          )}

          {/* Quick Back to Matches Dashboard Button */}
          <TouchableOpacity
            onPress={() => navigate('Dashboard')}
            style={styles.headerMatchesBtn}
            accessibilityLabel="Back to Matches Dashboard"
            activeOpacity={0.8}
          >
            <Text style={styles.headerMatchesBtnText}>← Matches</Text>
          </TouchableOpacity>

          <Image source={IMG_LOGO} style={styles.headerLogo} resizeMode="contain" />
          <View style={{ marginLeft: 8, flex: 1, minWidth: 0 }}>
            <Text style={styles.headerTitleMain} numberOfLines={1}>
              {isDesktop ? 'CRICKET FEDERATION OF VIRUDHUNAGAR DISTRICT' : 'CRICKET ASSOCIATION'}
            </Text>
            {isDesktop && (
              <Text style={styles.headerTitleSub} numberOfLines={1}>
                {matchInfo ? `${matchInfo.teamA} vs ${matchInfo.teamB} • Official Scorer Portal` : 'Official Scorer Portal • Career & Match Operations'}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.headerRight}>
          {/* User Email Pill: Shown on desktop only (hidden on mobile to prevent overlapping) */}
          {isDesktop && (
            <View style={styles.userBadgePill}>
              <Text style={styles.userBadgePillText} numberOfLines={1}>
                👤 {scorerEmail}
              </Text>
            </View>
          )}

          {/* Wi-Fi Indicator (Desktop only) */}
          {isDesktop && (
            <View style={[styles.wifiBadge, isOnline ? styles.wifiBadgeOnline : styles.wifiBadgeOffline]}>
              <Text style={styles.wifiIcon}>📶</Text>
              <View style={[styles.wifiDot, isOnline ? styles.wifiDotGreen : styles.wifiDotRed]} />
              <Text style={[styles.wifiText, isOnline ? styles.wifiTextGreen : styles.wifiTextRed]}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
          )}

          {/* Offline Sync Queue Pill (When network was dropped or deliveries are queued) */}
          {offlineQueueCount > 0 && (
            <TouchableOpacity
              style={styles.offlineQueuePill}
              onPress={handleSyncOfflineQueue}
              activeOpacity={0.8}
            >
              <Text style={styles.offlineQueuePillText}>🔄 {offlineQueueCount} Queued • Sync</Text>
            </TouchableOpacity>
          )}

          {/* Exit Scorer Button Pill (Red) */}
          <TouchableOpacity
            style={styles.headerExitBtn}
            onPress={() => setShowExitModal(true)}
            activeOpacity={0.8}
            accessibilityLabel="Exit Scorer Portal"
          >
            <Text style={styles.headerExitBtnText}>{isDesktop ? '← Exit Scorer' : 'Exit'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─────────────────────────────────────────────────────────────
          2. APP BODY ROW (Desktop Sidebar + Main Scoring Screen)
          ───────────────────────────────────────────────────────────── */}
      <View style={styles.appBodyRow}>
        {/* Desktop Left Persistent Navigation Sidebar (Matches Image 1) */}
        {isDesktop && (
          <View style={[styles.desktopSidebar, isSidebarCollapsed && styles.desktopSidebarCollapsed]}>
            {/* Scorer Profile Card Box */}
            <View style={[styles.sidebarProfileBox, isSidebarCollapsed && { paddingHorizontal: 4, alignItems: 'center' }]}>
              <View style={styles.sidebarAvatar}>
                <Text style={styles.sidebarAvatarText}>{scorerInitials}</Text>
              </View>
              {!isSidebarCollapsed && (
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={styles.sidebarName} numberOfLines={1}>{scorerName}</Text>
                  <Text style={styles.sidebarRole}>OFFICIAL SCORER</Text>
                  <View style={styles.sidebarOfficialPill}>
                    <Text style={styles.sidebarOfficialPillText} numberOfLines={1}>{scorerCertLevel.toUpperCase()}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Navigation Header Title */}
            {!isSidebarCollapsed && (
              <Text style={styles.sidebarNavSectionTitle}>NAVIGATION</Text>
            )}

            {/* Navigation Items List */}
            <ScrollView style={styles.sidebarNavScroll} showsVerticalScrollIndicator={false}>
              {/* 0. All Matches (Dashboard) */}
              <TouchableOpacity
                style={[
                  styles.sidebarNavItem,
                  isSidebarCollapsed && styles.sidebarNavItemCollapsed,
                  { backgroundColor: '#ecfdf5', borderColor: '#10b981', marginBottom: 6 }
                ]}
                onPress={() => navigate('Dashboard')}
                activeOpacity={0.7}
              >
                <Text style={styles.sidebarNavIcon}>🏠</Text>
                {!isSidebarCollapsed && (
                  <Text style={[styles.sidebarNavText, { color: '#047857', fontWeight: 'bold' }]}>
                    All Matches
                  </Text>
                )}
              </TouchableOpacity>

              {/* 1. Live Scoring (Active Tab - Gold Yellow Background, Image 1 Style) */}
              <TouchableOpacity
                style={[styles.sidebarNavItem, styles.sidebarNavItemActive, isSidebarCollapsed && styles.sidebarNavItemCollapsed]}
                activeOpacity={0.8}
              >
                <Text style={styles.sidebarNavIcon}>📊</Text>
                {!isSidebarCollapsed && (
                  <Text style={styles.sidebarNavTextActive}>Live Scoring</Text>
                )}
              </TouchableOpacity>

              {/* 2. Match Scorecard */}
              <TouchableOpacity
                style={[styles.sidebarNavItem, isSidebarCollapsed && styles.sidebarNavItemCollapsed]}
                onPress={() => navigate('Scorecard', { matchId })}
                activeOpacity={0.7}
              >
                <Text style={styles.sidebarNavIcon}>📋</Text>
                {!isSidebarCollapsed && (
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.sidebarNavText}>Scorecard</Text>
                    <View style={styles.sidebarBadgeBlue}>
                      <Text style={styles.sidebarBadgeBlueText}>LIVE</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>

              {/* 3. 3D Milestones Showcase */}
              <TouchableOpacity
                style={[styles.sidebarNavItem, isSidebarCollapsed && styles.sidebarNavItemCollapsed]}
                onPress={() => navigate('MilestoneGallery')}
                activeOpacity={0.7}
              >
                <Text style={styles.sidebarNavIcon}>🏆</Text>
                {!isSidebarCollapsed && (
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.sidebarNavText}>3D Milestones</Text>
                    <View style={[styles.sidebarBadgeBlue, { backgroundColor: '#f59e0b' }]}>
                      <Text style={styles.sidebarBadgeBlueText}>NEW</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>

              {/* 4. Breaks */}
              <TouchableOpacity
                style={[styles.sidebarNavItem, isSidebarCollapsed && styles.sidebarNavItemCollapsed]}
                onPress={() => handleOpenBreaksModal()}
                activeOpacity={0.7}
              >
                <Text style={styles.sidebarNavIcon}>☕</Text>
                {!isSidebarCollapsed && (
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.sidebarNavText}>Breaks</Text>
                    {breaksList.length > 0 && (
                      <View style={styles.sidebarBadgeOrange}>
                        <Text style={styles.sidebarBadgeOrangeText}>{breaksList.length}</Text>
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>

              {/* 5. Sessions */}
              <TouchableOpacity
                style={[styles.sidebarNavItem, isSidebarCollapsed && styles.sidebarNavItemCollapsed]}
                onPress={() => setShowSessionsModal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.sidebarNavIcon}>⏱️</Text>
                {!isSidebarCollapsed && (
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.sidebarNavText}>Sessions</Text>
                    {sessionsList.length > 0 && (
                      <View style={styles.sidebarBadgeBlue}>
                        <Text style={styles.sidebarBadgeBlueText}>{sessionsList.length}</Text>
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>

              {/* 6. End Day */}
              <TouchableOpacity
                style={[styles.sidebarNavItem, isSidebarCollapsed && styles.sidebarNavItemCollapsed]}
                onPress={() => setShowEndDayModal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.sidebarNavIcon}>🌙</Text>
                {!isSidebarCollapsed && <Text style={styles.sidebarNavText}>End Day</Text>}
              </TouchableOpacity>

              {/* 7. End Innings */}
              <TouchableOpacity
                style={[styles.sidebarNavItem, isSidebarCollapsed && styles.sidebarNavItemCollapsed]}
                onPress={() => setShowEndModal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.sidebarNavIcon}>🏁</Text>
                {!isSidebarCollapsed && <Text style={styles.sidebarNavText}>End Innings</Text>}
              </TouchableOpacity>

              {/* 8. Match Events */}
              <TouchableOpacity
                style={[styles.sidebarNavItem, isSidebarCollapsed && styles.sidebarNavItemCollapsed]}
                onPress={() => setShowMatchEventsModal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.sidebarNavIcon}>⚡</Text>
                {!isSidebarCollapsed && <Text style={styles.sidebarNavText}>Match Events</Text>}
              </TouchableOpacity>

              {/* 9. Change Team */}
              <TouchableOpacity
                style={[styles.sidebarNavItem, isSidebarCollapsed && styles.sidebarNavItemCollapsed]}
                onPress={() => {
                  setChangeTeamBattingTeamId(matchInfo.battingTeamId || matchInfo.teamAId);
                  setChangeTeamStrikerId(striker?.id || '');
                  setChangeTeamNonStrikerId(nonStriker?.id || '');
                  setChangeTeamBowlerId(bowler?.id || '');
                  setShowChangeTeamModal(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.sidebarNavIcon}>🔄</Text>
                {!isSidebarCollapsed && <Text style={styles.sidebarNavText}>Change Team</Text>}
              </TouchableOpacity>

              {/* 10. Umpire Assessment */}
              <TouchableOpacity
                style={[styles.sidebarNavItem, isSidebarCollapsed && styles.sidebarNavItemCollapsed]}
                onPress={() => setShowUmpireModal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.sidebarNavIcon}>⚖️</Text>
                {!isSidebarCollapsed && <Text style={styles.sidebarNavText}>Umpire Assessment</Text>}
              </TouchableOpacity>

              {/* 11. DLS & VJD Rain Target Engine */}
              <TouchableOpacity
                style={[
                  styles.sidebarNavItem,
                  showDlsModal && styles.sidebarNavItemEditActive,
                  isSidebarCollapsed && styles.sidebarNavItemCollapsed
                ]}
                onPress={() => setShowDlsModal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.sidebarNavIcon}>🧮</Text>
                {!isSidebarCollapsed && (
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.sidebarNavText}>DLS / VJD Methods</Text>
                    <View style={[styles.sidebarBadgeBlue, { backgroundColor: '#0e7490' }]}>
                      <Text style={styles.sidebarBadgeBlueText}>RAIN</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>

              {/* 11. Edit Mode */}
              <TouchableOpacity
                style={[
                  styles.sidebarNavItem,
                  isEditMode && styles.sidebarNavItemEditActive,
                  isSidebarCollapsed && styles.sidebarNavItemCollapsed
                ]}
                onPress={() => {
                  const nextMode = !isEditMode;
                  setIsEditMode(nextMode);
                  const msg = nextMode ? 'Edit Mode Activated: Delivery undo & ball edits enabled.' : 'Edit Mode Deactivated.';
                  Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Edit Mode', msg);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.sidebarNavIcon}>✏️</Text>
                {!isSidebarCollapsed && (
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[styles.sidebarNavText, isEditMode && { color: '#b45309', fontWeight: 'bold' }]}>
                      {isEditMode ? 'Edit Mode (ON)' : 'Edit Mode'}
                    </Text>
                    {isEditMode && (
                      <View style={styles.sidebarBadgeYellow}>
                        <Text style={styles.sidebarBadgeYellowText}>ON</Text>
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            </ScrollView>

            {/* Sidebar Bottom Actions (Matches Image 1) */}
            <View style={styles.sidebarBottomArea}>
              <TouchableOpacity
                style={[styles.sidebarLogoutBtn, isSidebarCollapsed && { paddingHorizontal: 6, justifyContent: 'center' }]}
                onPress={() => setShowExitModal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.sidebarLogoutIcon}>↪</Text>
                {!isSidebarCollapsed && (
                  <Text style={styles.sidebarLogoutText}>Exit Scorer</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sidebarCollapseBtn}
                onPress={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                activeOpacity={0.7}
              >
                <Text style={styles.sidebarCollapseText}>
                  {isSidebarCollapsed ? '> Expand' : '< Collapse Sidebar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Main Content Area (Wide, Yellow/Gold Stadium Theme) */}
        <ScrollView
          style={styles.mainContentScroll}
          contentContainerStyle={styles.scroll}
          scrollEnabled={isDesktop}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.mainLayout}>
            {/* Active Break Banner (Tea / Lunch / Drinks / Rain Break) */}
            {currentBreak && !isInningsBreak && !isMatchEnded && (() => {
              const isRain = currentBreak.type?.toLowerCase().includes('rain') || currentBreak.comments?.toLowerCase().includes('rain');
              return (
                <View style={[
                  styles.activeBreakBanner,
                  isRain && styles.activeRainBanner
                ]}>
                  <View style={[
                    styles.activeBreakIconBox,
                    isRain && { backgroundColor: '#e0f2fe', borderColor: '#7dd3fc' }
                  ]}>
                    <Text style={styles.activeBreakEmoji}>
                      {isRain
                        ? '🌧️'
                        : currentBreak.type?.toLowerCase().includes('tea')
                          ? '☕'
                          : currentBreak.type?.toLowerCase().includes('lunch')
                            ? '🍽️'
                            : currentBreak.type?.toLowerCase().includes('drinks')
                              ? '🥤'
                              : '⏸️'}
                    </Text>
                  </View>
                  <View style={{ flex: 1, paddingHorizontal: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[
                        styles.activeBreakTitle,
                        isRain && { color: '#0369a1' }
                      ]}>
                        {isRain ? '🌧️ MATCH DELAYED DUE TO RAIN' : `${currentBreak.type?.toUpperCase()} IN PROGRESS`}
                      </Text>
                      <View style={[
                        styles.activeBreakLiveTag,
                        isRain && { backgroundColor: '#0284c7' }
                      ]}>
                        <Text style={styles.activeBreakLiveTagText}>
                          {isRain ? 'RAIN DELAY' : 'ON BREAK'}
                        </Text>
                      </View>
                    </View>
                    <Text style={[
                      styles.activeBreakDetails,
                      isRain && { color: '#075985' }
                    ]}>
                      {currentBreak.duration ? `Duration: ${currentBreak.duration} mins` : ''}
                      {currentBreak.startTime && currentBreak.endTime ? ` • ${currentBreak.startTime} - ${currentBreak.endTime}` : ''}
                      {isRain ? ' • Covers on the ground' : (currentBreak.comments && currentBreak.comments !== currentBreak.type ? ` (${currentBreak.comments})` : '')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.resumePlayBtn,
                      isRain && { backgroundColor: '#0284c7', borderColor: '#0369a1' }
                    ]}
                    onPress={() => setShowResumeConfirmModal(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.resumePlayBtnText}>
                      {isRain ? '▶ Rain Stopped (Resume)' : '▶ Resume Play'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })()}

            {/* Innings Break Banner */}
            {isInningsBreak && (() => {
              const currentBattingTeam = (matchInfo?.currentInningsNumber === 2)
                ? (matchInfo?.teamB || 'Team B')
                : (matchInfo?.battingTeam || matchInfo?.teamA || 'Team A');
              const currentBowlingTeam = (matchInfo?.currentInningsNumber === 2)
                ? (matchInfo?.teamA || 'Team A')
                : (matchInfo?.bowlingTeam || matchInfo?.teamB || 'Team B');
              const targetToChase = (runs || 0) + 1;

              return (
                <View style={styles.inningsBreakBanner}>
                  <View style={styles.inningsBreakImgWrapper}>
                    <Image
                      source={IMG_END_INNINGS}
                      style={styles.inningsBreakThumbnail}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={{ flex: 1, paddingHorizontal: 4 }}>
                    <Text style={styles.inningsBreakTitle}>⏸️ INNINGS BREAK IN PROGRESS</Text>
                    <Text style={styles.inningsBreakTeam}>
                      {currentBattingTeam}: {runs}/{wickets} ({getOvers(balls)} overs)
                    </Text>
                    <Text style={styles.inningsBreakSub}>
                      {targetRuns || targetToChase ? `Target for ${currentBowlingTeam}: ${targetRuns || targetToChase} runs.` : 'First innings has concluded.'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.startInningsBtn}
                    disabled={isStartingNextInnings}
                    onPress={handleStartNextInnings}
                  >
                    {isStartingNextInnings ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={styles.startInningsBtnText}>Start 2nd Innings ▶</Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })()}

            {/* Match Completed Champions Celebration Card */}
            {isMatchEnded && (() => {
              const { winnerName, winMargin, fullSummary } = getWinnerInfo();
              return (
                <View style={[styles.championsCelebrationCard, { position: 'relative' }]}>
                  {/* Dynamic Falling Confetti / Colour Papers */}
                  <CricketConfetti active={confettiActive} count={85} />

                  {/* Top Status Header with Fireworks Fanfare */}
                  <View style={styles.championTopHeader}>
                    <Text style={{ fontSize: 16 }}>🎆</Text>
                    <View style={styles.championPulsingDot} />
                    <Text style={styles.championTopHeaderText}>
                      👑 OFFICIAL MATCH CONCLUDED • MATCH CHAMPIONS 👑
                    </Text>
                    <View style={styles.championPulsingDot} />
                    <Text style={{ fontSize: 16 }}>🎇</Text>
                  </View>

                  {/* Main Card Content */}
                  <View style={styles.championCardBody}>
                    {/* The 3D Cricket Champions Collectible Figurine Statuette (Sketchfab 3D Style) */}
                    <View style={styles.championArtworkWrapper}>
                      <CricketFigurine3D
                        imageSource={IMG_CHAMPIONS}
                        playerName={winnerName || 'CHAMPIONS'}
                        badgeText={winMargin || 'MATCH CHAMPIONS'}
                        milestoneTitle="MATCH WINNER"
                        height={200}
                      />
                    </View>

                    {/* The Crown ('Kiritam') & Winner Details */}
                    <View style={styles.championDetailsCol}>
                      {/* Glowing Crown Badge */}
                      <View style={styles.crownContainer}>
                        <Text style={styles.crownGlow}>✨</Text>
                        <View style={styles.crownCircle}>
                          <Text style={styles.crownEmoji}>👑</Text>
                        </View>
                        <Text style={styles.crownGlow}>✨</Text>
                      </View>

                      <Text style={styles.championKiritamLabel}>OFFICIAL MATCH CHAMPION</Text>

                      {/* Team Won Name */}
                      <Text style={styles.championTeamName} numberOfLines={2}>
                        {winnerName}
                      </Text>

                      {/* Win Margin Badge */}
                      <View style={styles.winMarginChip}>
                        <Text style={styles.winMarginTrophy}>🏆</Text>
                        <Text style={styles.winMarginText}>{winMargin}</Text>
                      </View>

                      {/* Full Result Summary */}
                      <Text style={styles.championFullSummary}>
                        "{fullSummary}"
                      </Text>

                      {/* Tournament & Venue Details */}
                      <View style={styles.championTournamentRow}>
                        <Text style={styles.championTournamentText}>
                          🏏 {matchInfo.tournament || 'Virudhunagar District Cricket'} • {matchInfo.venue || 'CFVD Ground'}
                        </Text>
                      </View>

                      {/* OFFICIAL MAN OF THE MATCH PRESENTATION PODIUM */}
                      <View style={styles.motmPresentationCard}>
                        <View style={styles.motmRibbonHeader}>
                          <Text style={styles.motmRibbonText}>🏆 OFFICIAL PLAYER OF THE MATCH 🏆</Text>
                        </View>
                        <View style={styles.motmCardContentRow}>
                          <View style={styles.motmImageCircle}>
                            <Image
                              source={IMG_MAN_OF_THE_MATCH}
                              style={styles.motmImage}
                              resizeMode="contain"
                            />
                          </View>
                          <View style={styles.motmInfoCol}>
                            <Text style={styles.motmPlayerTitle}>
                              {matchInfo?.playerOfTheMatch || playerOfMatchInput || 'N. Jagadeesan'}
                            </Text>
                            <Text style={styles.motmTeamSubtitle}>
                              {winnerName || matchInfo?.teamA} • Match Winning Performance
                            </Text>
                            <View style={styles.motmPillBadge}>
                              <Text style={styles.motmPillBadgeText}>⭐ MAN OF THE MATCH AWARD</Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      {/* Action buttons */}
                      <View style={styles.championActionsRow}>
                        {/* Blast Confetti / Colour Papers Button */}
                        <TouchableOpacity
                          style={styles.blastConfettiBtn}
                          onPress={() => {
                            setConfettiActive(false);
                            setTimeout(() => {
                              setConfettiActive(true);
                              playVictoryFanfare();
                            }, 50);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.blastConfettiBtnText}>🎉 Blast Confetti (Colour Papers) 🎉</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.viewScorecardBtn}
                          onPress={() => navigate('Scorecard', { matchId, returnTo: 'LiveScoring', status: 'COMPLETED' })}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.viewScorecardBtnText}>📊 View Official Scorecard ▶</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.viewScorecardBtn, { backgroundColor: '#059669', shadowColor: '#059669' }]}
                          onPress={() => navigate('Dashboard')}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.viewScorecardBtnText}>🏠 Back to Scorer Dashboard</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })()}

            {/* Over Complete Banner (Only if LIVE and not in Innings Break) */}
            {isOverComplete && matchStatus === 'LIVE' && !isInningsBreak && !isMatchEnded && (
              <View style={styles.overCompleteBanner}>
                <Text style={styles.overCompleteText}>
                  ⚠️ Over Complete! Six legal deliveries bowled. Please appoint the next bowler.
                </Text>
                <TouchableOpacity style={styles.openBowlerBtn} onPress={() => setShowBowlerModal(true)}>
                  <Text style={styles.openBowlerBtnText}>Select Bowler</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* EDIT MODE STICKY BANNER */}
            {isEditMode && (
              <View style={styles.editModeBanner}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.editModeBannerTitle}>✏️ EDIT MODE ACTIVE</Text>
                  <Text style={styles.editModeBannerSub}>
                    Scorer correction mode is ON. Tap 'Undo Ball' or tap any past ball below in "Recent Deliveries" to retroactively edit runs, extras, or wickets!
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.editModeUndoBtn}
                  onPress={handleUndoLastDelivery}
                  disabled={isUndoingDelivery}
                >
                  {isUndoingDelivery ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.editModeUndoBtnText}>↺ Undo Ball</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.editModeExitBtn}
                  onPress={() => setIsEditMode(false)}
                >
                  <Text style={styles.editModeExitBtnText}>Exit Edit</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* TOP SECTION: SCOREBOARD & PLAYERS */}
            <View style={styles.topSection}>
              <View style={styles.scoreBoardCard}>
                {/* Previous Innings Overview Banner (Preserves & Displays Innings 1 score e.g. Virudhunagar Spartans 34/10) */}
                {allInningsList && allInningsList.length > 1 && (
                  <View style={styles.previousInningsBanner}>
                    <Text style={styles.previousInningsText}>
                      1st Inn: <Text style={styles.previousInningsBold}>{allInningsList[0].battingTeam} {allInningsList[0].score}</Text>
                    </Text>
                  </View>
                )}
                <Text style={styles.battingTeam}>
                  {(matchInfo?.battingTeam || matchInfo?.teamA || 'BATTING TEAM').toUpperCase()}
                  {allInningsList && allInningsList.length > 1 ? ' (2ND INNINGS)' : ' (1ST INNINGS)'}
                </Text>
                <View style={styles.scoreRow}>
                  <Text style={styles.scoreText}>{runs}/{wickets}</Text>
                  <Text style={styles.oversText}>({getOvers(balls)})</Text>
                </View>
                <Text style={styles.rrText}>
                  CRR: {balls > 0 ? ((runs / balls) * 6).toFixed(2) : '0.00'}
                  {targetRuns ? ` | Target: ${targetRuns} (Need ${Math.max(0, targetRuns - runs)} runs)` : ''}
                </Text>
                {lastDismissal ? (
                  <View style={styles.lastWicketChip}>
                    <Text style={styles.lastWicketTag}>⚡ LAST WICKET (Ov {lastDismissal.ball}):</Text>
                    <Text style={styles.lastWicketText} numberOfLines={1}>
                      {lastDismissal.batterName} ({lastDismissal.dismissalText || lastDismissal.dismissalType})
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.playersContainer}>
                <View style={styles.playerCard}>
                  <View style={styles.battersCardHeader}>
                    <Text style={styles.playerRole}>BATTERS</Text>
                    <TouchableOpacity
                      style={styles.swapStrikeBtn}
                      onPress={handleSwapStrike}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.swapStrikeBtnText}>⇄ Swap Strike</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Striker Row - Tappable to change player */}
                  <TouchableOpacity
                    style={[styles.playerRow, styles.playerRowTappable]}
                    onPress={() => handleOpenChangeBatter('striker')}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.playerName, styles.striker]} numberOfLines={1}>
                        * {striker ? striker.name : 'Striker TBA'}
                      </Text>
                      <View style={styles.changeBatterBadge}>
                        <Text style={styles.changeBatterBadgeText}>Change ✎</Text>
                      </View>
                    </View>
                    <Text style={styles.playerStats}>
                      {striker ? `${striker.runs} (${striker.balls})` : '0 (0)'}
                    </Text>
                  </TouchableOpacity>

                  {/* Non-Striker Row - Tappable to change player */}
                  <TouchableOpacity
                    style={[styles.playerRow, styles.playerRowTappable]}
                    onPress={() => handleOpenChangeBatter('nonStriker')}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.playerName} numberOfLines={1}>
                        {nonStriker ? nonStriker.name : 'Non-Striker TBA'}
                      </Text>
                      <View style={styles.changeBatterBadge}>
                        <Text style={styles.changeBatterBadgeText}>Change ✎</Text>
                      </View>
                    </View>
                    <Text style={styles.playerStats}>
                      {nonStriker ? `${nonStriker.runs} (${nonStriker.balls})` : '0 (0)'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.playerCard}>
                  <View style={styles.battersCardHeader}>
                    <Text style={styles.playerRole}>CURRENT BOWLER</Text>
                    <TouchableOpacity
                      style={styles.injurySubPill}
                      onPress={handleOpenInjuryBowlerChange}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.injurySubPillText}>🩹 Injury Sub</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.playerRow, styles.playerRowTappable]}
                    onPress={handleOpenChangeBowler}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <Text style={styles.playerName} numberOfLines={1}>
                        🎳 {bowler ? bowler.name : 'Bowler TBA'}
                      </Text>
                      <View style={styles.changeBatterBadge}>
                        <Text style={styles.changeBatterBadgeText}>Change ✎</Text>
                      </View>
                    </View>
                    <Text style={styles.playerStats}>
                      {bowler
                        ? `${bowler.overs} ov | ${bowler.runs}/${bowler.wickets} | ER: ${bowler.economy}`
                        : '0.0 ov | 0/0 | ER: 0'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Broadcast Live Kinetic Ball Action Telemetry */}
            {(() => {
              const latest = recentDeliveries && recentDeliveries[0];
              const rBatter = latest
                ? (typeof latest.runs === 'number'
                    ? latest.runs
                    : typeof latest.runsBatter === 'number'
                      ? latest.runsBatter
                      : typeof latest.runs_batter === 'number'
                        ? latest.runs_batter
                        : 0)
                : 0;
              const rExtras = latest
                ? (typeof latest.runsExtras === 'number'
                    ? latest.runsExtras
                    : typeof latest.runs_extras === 'number'
                      ? latest.runs_extras
                      : 0)
                : 0;
              const rTotal = latest
                ? (typeof latest.total_runs === 'number'
                    ? latest.total_runs
                    : typeof latest.totalRuns === 'number'
                      ? latest.totalRuns
                      : (rBatter + rExtras))
                : 0;

              const delRuns = pendingBoundaryRun !== null ? pendingBoundaryRun : (latest ? rTotal : 1);
              const isFour = pendingBoundaryRun === 4 || rBatter === 4 || latest?.boundary_type === 'FOUR' || latest?.boundaryType === 'FOUR';
              const isSix = pendingBoundaryRun === 6 || rBatter === 6 || latest?.boundary_type === 'SIX' || latest?.boundaryType === 'SIX';
              const isWkt = Boolean(latest?.wicket);
              const rawExtra = latest?.extraType || latest?.extra_type || latest?.extra;
              const extraType = (rawExtra && rawExtra !== 'NONE') ? rawExtra : (latest?.is_wide ? 'wide' : (latest?.is_no_ball ? 'no_ball' : undefined));

              return (
                <BroadcastLiveBallAction
                  triggerKey={latest ? `${latest.id || recentDeliveries.length}-${delRuns}-${latest.ball || latest.ballNumber || ''}-${runs}-${wickets}` : `${recentDeliveries.length}-${runs}-${wickets}`}
                  autoPlay={true}
                  lastEvent={{
                    runs: delRuns,
                    isBoundary: isFour,
                    isSix: isSix,
                    isWicket: isWkt,
                    isExtra: Boolean(extraType),
                    extraType: extraType,
                    batterName: striker?.name || 'Striker',
                    bowlerName: bowler?.name || 'Bowler',
                    shotZone: latest?.shot_zone || latest?.shotZone || selectedWagonSector || 'Cover'
                  }}
                />
              );
            })()}

            {/* THIS OVER & RECENT DELIVERIES INTERACTIVE STRIP (CricHeroes Retroactive Ball Correction) */}
            <View style={[styles.recentDeliveriesCard, isEditMode && styles.recentDeliveriesCardEditMode]}>
              <View style={styles.recentDeliveriesHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={styles.recentDeliveriesTitle}>
                    {isEditMode ? '✏️ EDIT BALLS (CLICK ANY BALL TO MODIFY)' : '⚡ THIS OVER / RECENT DELIVERIES'}
                  </Text>
                  {isEditMode ? (
                    <View style={styles.editModeTagPill}>
                      <Text style={styles.editModeTagPillText}>DIRECT RETROACTIVE EDIT ON</Text>
                    </View>
                  ) : (
                    <Text style={styles.recentDeliveriesSub}>
                      {recentDeliveries && recentDeliveries.length > 0 ? `(${recentDeliveries.length} balls recorded)` : ''}
                    </Text>
                  )}
                </View>
                {isEditMode && (
                  <Text style={styles.editModeTapHint}>
                    Tap any ball chip below to directly fix runs, extras or wickets without undoing subsequent balls.
                  </Text>
                )}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentDeliveriesScroll}>
                {recentDeliveries && recentDeliveries.length > 0 ? (
                  recentDeliveries.map((del, idx) => {
                    const isWicket = Boolean(del.wicket);
                    const isFour = del.runs === 4 && !del.extra;
                    const isSix = del.runs === 6 && !del.extra;
                    const isExtra = Boolean(del.extra);
                    const isDot = del.runs === 0 && !isExtra && !isWicket;

                    return (
                      <TouchableOpacity
                        key={`del-${del.id || idx}`}
                        style={[
                          styles.ballChip,
                          isWicket && styles.ballChipWicket,
                          isFour && styles.ballChipFour,
                          isSix && styles.ballChipSix,
                          isExtra && styles.ballChipExtra,
                          isDot && styles.ballChipDot,
                          isEditMode && styles.ballChipEditMode
                        ]}
                        onPress={() => {
                          if (isEditMode) {
                            handleOpenEditDelivery(del);
                          } else {
                            // Check if delivery matches an official umpire signal
                            const dt = (del.text || '').toUpperCase();
                            let sigType: UmpireSignalType | null = null;
                            if (isWicket || (dt.includes('W') && !dt.includes('WD'))) sigType = 'OUT';
                            else if (dt.includes('WD')) sigType = 'WIDE';
                            else if (dt.includes('NB')) sigType = 'NO_BALL';
                            else if (dt.includes('DEAD')) sigType = 'DEAD_BALL';
                            else if (dt.includes('LB')) sigType = 'LEG_BYE';
                            else if (dt.includes('B') && !dt.includes('NB')) sigType = 'BYE';
                            else if (isSix || dt === '6') sigType = 'SIX';
                            else if (isFour || dt === '4') sigType = 'FOUR';

                            if (sigType) {
                              setActiveUmpireSignal({
                                type: sigType,
                                batterName: del.strikerName || striker?.name,
                                bowlerName: del.bowlerName || bowler?.name,
                                runs: del.runs,
                                overText: `Ball ${del.ball}`,
                                extraDetails: del.commentary || `Delivery ${del.ball}: ${del.text} • Click 'Edit Mode' to alter historical ball`
                              });
                            } else {
                              const info = `Ball ${del.ball}: ${del.text} • ${del.commentary || 'Recorded delivery'}\n\nTip: Activate 'Edit Mode' in the sidebar or top banner to modify past deliveries directly.`;
                              Platform.OS === 'web' ? window.alert(info) : Alert.alert('Delivery Details', info);
                            }
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        {isEditMode && <Text style={styles.ballChipPencil}>✏️</Text>}
                        <Text
                          style={[
                            styles.ballChipText,
                            isWicket && styles.ballChipTextWicket,
                            isFour && styles.ballChipTextFour,
                            isSix && styles.ballChipTextSix,
                            isExtra && styles.ballChipTextExtra,
                            isDot && styles.ballChipTextDot
                          ]}
                        >
                          {del.text}
                        </Text>
                        <Text style={styles.ballChipOverText}>{del.ball}</Text>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={styles.emptyRecentBallsBox}>
                    <Text style={styles.emptyRecentBallsText}>No deliveries recorded in this innings yet</Text>
                  </View>
                )}
              </ScrollView>
            </View>

            {/* BOTTOM SECTION: SCORING ENGINE CONTROLS & KEYPAD (Matches Manual Image 1 Slide 3 & 4 and Image 2) */}
            <View style={styles.controlsSection}>
              <View style={styles.controlPanel}>
                {/* 1. Primary Action Row: START BALL / END BALL & START OVER / END OVER */}
                <View style={styles.primaryEngineActionBar}>
                  <TouchableOpacity
                    style={[
                      styles.enginePrimaryBtn,
                      isBallInProgress ? styles.engineEndBallBtn : styles.engineStartBallBtn,
                      (matchStatus !== 'LIVE' || isInningsBreak || isMatchEnded) && styles.btnDisabled
                    ]}
                    disabled={matchStatus !== 'LIVE' || isInningsBreak || isMatchEnded}
                    onPress={() => setIsBallInProgress(!isBallInProgress)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.enginePrimaryBtnText}>
                      {isBallInProgress ? '● END BALL' : 'START BALL ▶'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.enginePrimaryBtn,
                      styles.engineOverBtn,
                      (matchStatus !== 'LIVE' || isInningsBreak || isMatchEnded) && styles.btnDisabled
                    ]}
                    disabled={matchStatus !== 'LIVE' || isInningsBreak || isMatchEnded}
                    onPress={() => {
                      if (isOverComplete || (balls % 6 === 0 && balls > 0)) {
                        setShowBowlerModal(true);
                      } else {
                        const msg = `Current Over: ${getOvers(balls)} (${balls % 6} legal deliveries bowled). Confirm end over?`;
                        Platform.OS === 'web'
                          ? (window.confirm(msg) && setShowBowlerModal(true))
                          : Alert.alert('End Over', msg, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'End Over Now', onPress: () => setShowBowlerModal(true) }
                          ]);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.enginePrimaryBtnText}>
                      {isOverComplete ? 'START OVER' : `END OVER (${getOvers(balls)})`}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* SMART RULES QUICK BAR & FREE HIT LIVE BANNER */}
                {isFreeHitActive && (
                  <View style={styles.freeHitLiveBanner}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Text style={{ fontSize: 18 }}>⚡</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.freeHitLiveTitle}>FREE HIT IN PROGRESS!</Text>
                        <Text style={styles.freeHitLiveSub}>Immunity: Bowled, Caught, LBW, Stumped • RUN OUT ONLY</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.freeHitRulesBtn}
                      onPress={() => {
                        setActiveCricketRule('FREE_HIT');
                        setCricketRuleContext({
                          bowlerName: bowler?.name || 'Bowler',
                          strikerName: striker?.name || 'Striker',
                          nonStrikerName: nonStriker?.name || 'Non-Striker'
                        });
                        setShowCricketRulesModal(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.freeHitRulesBtnText}>⚖️ View Rule</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Cricket Rules, Umpire Signals & DLS/VJD Quick Navigation Buttons */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: isDesktop ? 'nowrap' : 'wrap' }}>
                  <TouchableOpacity
                    style={[styles.smartRulesNavBtn, { flex: isDesktop ? 1 : undefined, minWidth: isDesktop ? 0 : '48%', marginBottom: 0 }]}
                    onPress={() => {
                      setActiveCricketRule('FREE_HIT');
                      setShowCricketRulesModal(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.smartRulesNavBtnText} numberOfLines={1}>⚖️ Smart Cricket Rules</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.smartRulesNavBtn, { flex: isDesktop ? 1 : undefined, minWidth: isDesktop ? 0 : '48%', marginBottom: 0, backgroundColor: '#0284c7', borderColor: '#0ea5e9' }]}
                    onPress={() => setShowUmpireGallery(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.smartRulesNavBtnText, { color: '#ffffff' }]} numberOfLines={1}>🏁 Umpire Hand Signals</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.smartRulesNavBtn, { flex: isDesktop ? 1 : undefined, minWidth: isDesktop ? 0 : '100%', marginBottom: 0, backgroundColor: '#0e7490', borderColor: '#0891b2' }]}
                    onPress={() => setShowDlsModal(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.smartRulesNavBtnText, { color: '#ffffff' }]} numberOfLines={1}>🧮 DLS & VJD Methods</Text>
                  </TouchableOpacity>
                </View>

                {/* Main Scoring Keypad Grid */}
                <View style={styles.engineKeypadContainer}>
                  {/* Row 1: 0, 1, 2 */}
                  <View style={styles.engineKeypadRow}>
                    {[0, 1, 2].map((run) => {
                      const isDisabled =
                        isOverComplete ||
                        showBowlerModal ||
                        isSubmittingDelivery ||
                        matchStatus !== 'LIVE' ||
                        isInningsBreak ||
                        isMatchEnded;

                      return (
                        <TouchableOpacity
                          key={`key-${run}`}
                          disabled={isDisabled}
                          style={[
                            styles.engineKeypadBtn,
                            run === 0 ? styles.scoreBtnDot : styles.scoreBtnNormal,
                            isDisabled && styles.btnDisabled
                          ]}
                          onPress={() => handleScore(run, 'normal')}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.engineKeypadText,
                              run === 0 ? styles.scoreBtnTextDot : styles.scoreBtnTextNormal
                            ]}
                          >
                            {run}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Row 2: 3, 4, 6 */}
                  <View style={styles.engineKeypadRow}>
                    {[3, 4, 6].map((run) => {
                      const isDisabled =
                        isOverComplete ||
                        showBowlerModal ||
                        isSubmittingDelivery ||
                        matchStatus !== 'LIVE' ||
                        isInningsBreak ||
                        isMatchEnded;

                      let bStyle = styles.scoreBtnNormal;
                      let tStyle: any = [styles.engineKeypadText, styles.scoreBtnTextNormal];
                      if (run === 4) {
                        bStyle = styles.scoreBtnFour;
                        tStyle = [styles.engineKeypadText, styles.scoreBtnTextBoundary];
                      }
                      if (run === 6) {
                        bStyle = styles.scoreBtnSix;
                        tStyle = [styles.engineKeypadText, styles.scoreBtnTextSix];
                      }

                      return (
                        <TouchableOpacity
                          key={`key-${run}`}
                          disabled={isDisabled}
                          style={[styles.engineKeypadBtn, bStyle, isDisabled && styles.btnDisabled]}
                          onPress={() => handleScore(run, 'normal')}
                          activeOpacity={0.7}
                        >
                          <Text style={tStyle}>{run}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Row 3: MORE RUNS, OVER THROW, EXTRAS */}
                  <View style={styles.engineKeypadRow}>
                    <TouchableOpacity
                      style={[styles.engineKeypadBtn, styles.engineAuxKeypadBtn]}
                      onPress={() => setShowMoreRunsModal(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.engineAuxKeypadText}>MORE RUNS</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.engineKeypadBtn, styles.engineAuxKeypadBtn]}
                      onPress={() => setShowOverThrowModal(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.engineAuxKeypadText}>OVER THROW</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.engineKeypadBtn, styles.engineAuxKeypadBtn, { backgroundColor: '#005960', borderColor: '#0d9488' }]}
                      onPress={() => setShowExtrasModal(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.engineAuxKeypadText, { color: '#fef08a' }]}>EXTRAS</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Row 4: WICKET & FIELDING */}
                  <View style={styles.engineKeypadRow}>
                    <TouchableOpacity
                      disabled={
                        isOverComplete ||
                        showBowlerModal ||
                        isSubmittingDelivery ||
                        matchStatus !== 'LIVE' ||
                        isInningsBreak ||
                        isMatchEnded
                      }
                      style={[
                        styles.engineKeypadBtn,
                        styles.wicketBtn,
                        { flex: 2 },
                        (isOverComplete || isSubmittingDelivery || matchStatus !== 'LIVE' || isInningsBreak || isMatchEnded) && styles.btnDisabled
                      ]}
                      onPress={handleWicketClick}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.engineKeypadText, styles.wicketBtnText]}>🛑 WICKET</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.engineKeypadBtn, { flex: 1, backgroundColor: '#005960', borderColor: '#0d9488' }]}
                      onPress={() => setShowFieldingModal(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.engineAuxKeypadText, { color: '#fef3c7' }]}>FIELDING</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Bottom Actions Bar */}
              <View style={styles.actionPanel}>
                {isMatchEnded ? (
                  <>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#059669', borderColor: '#047857', flex: 1 }]}
                      onPress={() => navigate('Dashboard')}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.actionBtnText, { color: '#ffffff', fontWeight: 'bold' }]}>
                        🏠 Back to Scorer Dashboard
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.scorecardBtn, { flex: 1 }]}
                      onPress={() => navigate('Scorecard', { matchId, returnTo: 'LiveScoring', status: 'COMPLETED' })}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.scorecardBtnText}>📊 View Full Scorecard</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.undoBtn]}
                      onPress={handleUndoLastDelivery}
                      disabled={isUndoingDelivery || balls === 0 || matchStatus !== 'LIVE'}
                    >
                      {isUndoingDelivery ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text
                          style={[
                            styles.actionBtnText,
                            { color: balls === 0 || matchStatus !== 'LIVE' ? '#94a3b8' : '#FFF' }
                          ]}
                        >
                          ↺ Undo Last Ball
                        </Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.scorecardBtn]}
                      onPress={() => navigate('Scorecard', { matchId, returnTo: 'LiveScoring', status: matchStatus })}
                    >
                      <Text style={styles.scorecardBtnText}>View Full Scorecard</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.endBtn]}
                      disabled={isInningsBreak || isMatchEnded}
                      onPress={confirmEndInnings}
                    >
                      <Text style={styles.endBtnText}>End Innings</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </View>

          {isDesktop && <SharedFooter />}
        </ScrollView>
      </View>

      {/* AUTOMATIC NEXT BOWLER POPUP MODAL (Only when match is LIVE) */}
      <Modal
        visible={showBowlerModal && matchStatus === 'LIVE' && !isInningsBreak && !isMatchEnded}
        transparent
        animationType="fade"
        onRequestClose={() => { }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 500 }]}>
            <View style={styles.bowlerModalHeader}>
              <View style={styles.bowlerBadgeTag}>
                <Text style={styles.bowlerBadgeTagText}>OVER COMPLETED (6 LEGAL DELIVERIES)</Text>
              </View>
              <Text style={styles.bowlerModalTitle}>Select Next Bowler</Text>
              <Text style={styles.bowlerModalSub}>
                Appoint the bowler for the next over from the bowling team's Playing XI.
              </Text>
            </View>

            {previousBowlerId && (
              <View style={styles.prevBowlerBanner}>
                <Text style={styles.prevBowlerBannerLabel}>PREVIOUS OVER BOWLER</Text>
                <Text style={styles.prevBowlerBannerName}>
                  {bowlingSquad.find((b) => b.id === previousBowlerId)?.name || bowler?.name || 'Previous Bowler'}
                </Text>
                <Text style={styles.prevBowlerBannerNote}>
                  Rule: Bowler who bowled the previous over is ineligible for consecutive overs.
                </Text>
              </View>
            )}

            {bowlerErrorMessage && (
              <View style={styles.errorAlertBox}>
                <Text style={styles.errorAlertText}>⚠️ {bowlerErrorMessage}</Text>
              </View>
            )}

            <Text style={styles.selectLabel}>CHOOSE FROM BOWLING TEAM PLAYING XI:</Text>
            <ScrollView style={{ maxHeight: 220, marginBottom: 14 }}>
              {bowlingSquad.map((player) => {
                const isPrev = player.id === previousBowlerId || player.isPreviousBowler;
                const isSelected = selectedNextBowlerId === player.id;
                return (
                  <TouchableOpacity
                    key={player.id}
                    disabled={isPrev || isSubmittingBowler}
                    style={[
                      styles.bowlerOption,
                      isSelected && styles.bowlerOptionSelected,
                      isPrev && styles.bowlerOptionDisabled
                    ]}
                    onPress={() => {
                      if (!isPrev) {
                        setSelectedNextBowlerId(player.id);
                        setBowlerErrorMessage(null);
                      }
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View
                          style={[
                            styles.radioDot,
                            isSelected && styles.radioDotSelected,
                            isPrev && styles.radioDotDisabled
                          ]}
                        />
                        <Text
                          style={[
                            styles.bowlerOptionName,
                            isPrev && styles.bowlerOptionNameDisabled
                          ]}
                        >
                          {player.name}
                        </Text>
                        <Text style={styles.bowlerRoleBadge}>{player.role || 'BOWLER'}</Text>
                      </View>
                      <View style={styles.bowlerStatsRow}>
                        <Text style={styles.bowlerStatsText}>
                          {player.overs > 0 || player.runs > 0 || player.wickets > 0
                            ? `${player.overs} ov | ${player.runs} runs | ${player.wickets} wkts | Econ: ${player.economy}`
                            : 'Yet to bowl in this innings'}
                        </Text>
                      </View>
                    </View>
                    {isPrev && (
                      <View style={styles.ineligibleBadge}>
                        <Text style={styles.ineligibleBadgeText}>Bowled Prev Over</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  (!selectedNextBowlerId || isSubmittingBowler) && styles.btnDisabled
                ]}
                disabled={!selectedNextBowlerId || isSubmittingBowler}
                onPress={confirmNextBowler}
              >
                {isSubmittingBowler ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm Next Bowler & Resume</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CUSTOM RUNS & EXTRAS MODAL */}
      <Modal
        visible={showCustomModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCustomModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 500, width: '92%', maxHeight: '88%', padding: 16, display: 'flex', flexDirection: 'column' }]}>
            {/* Modal Header */}
            <View style={[styles.wicketModalHeader, { marginBottom: 8 }]}>
              <View style={styles.modalTopHeaderRow}>
                <Text style={styles.wicketModalTitle}>⚡ Custom Runs & Extras</Text>
                <TouchableOpacity
                  style={styles.redCloseBtn}
                  onPress={() => setShowCustomModal(false)}
                  activeOpacity={0.7}
                  accessibilityLabel="Close Custom Runs Modal"
                >
                  <Text style={styles.redCloseBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.wicketModalSub, { fontSize: 11, marginTop: 2 }]}>
                Record any number of runs (e.g. 5 runs, overthrows, penalties, or custom extras).
              </Text>
            </View>

            {/* Scrollable Form Body */}
            <ScrollView
              showsVerticalScrollIndicator={true}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 10 }}
            >
              <Text style={styles.selectLabel}>QUICK RUNS OR ENTER NUMBER:</Text>
              <View style={[styles.customRunChipsRow, { marginBottom: 6 }]}>
                {['1', '2', '3', '4', '5', '6', '7'].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.customRunChip, customRunsInput === r && styles.customRunChipActive]}
                    onPress={() => setCustomRunsInput(r)}
                  >
                    <Text style={[styles.customRunChipText, customRunsInput === r && styles.customRunChipTextActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ marginTop: 4, marginBottom: 8 }}>
                <Text style={styles.fieldSubLabel}>NUMBER OF RUNS:</Text>
                <TextInput
                  style={[styles.customNameInput, { height: 38, paddingVertical: 6 }]}
                  keyboardType="numeric"
                  placeholder="e.g. 5"
                  placeholderTextColor="#94a3b8"
                  value={customRunsInput}
                  onChangeText={(val) => setCustomRunsInput(val)}
                />
              </View>

              <Text style={styles.selectLabel}>DELIVERY CATEGORY:</Text>
              <View style={[styles.categoryGrid, { gap: 6, marginBottom: 8 }]}>
                {[
                  { key: 'normal', label: 'Off Bat (Normal)', desc: 'Bat & Team' },
                  { key: 'wide', label: 'Wide + Runs', desc: 'Conceded Extra' },
                  { key: 'noball_bat', label: 'No Ball + Bat', desc: '1 Extra + Bat' },
                  { key: 'noball_extra', label: 'No Ball + Bye', desc: 'Total Extras' },
                  { key: 'bye', label: 'Byes', desc: 'Legal Extra' },
                  { key: 'legbye', label: 'Leg Byes', desc: 'Legal Extra' },
                  { key: 'penalty', label: 'Penalty Runs', desc: 'Team Total' }
                ].map((cat) => (
                  <TouchableOpacity
                    key={cat.key}
                    style={[
                      styles.categoryOption,
                      { paddingVertical: 6, paddingHorizontal: 8 },
                      customCategory === cat.key && styles.categoryOptionActive
                    ]}
                    onPress={() => setCustomCategory(cat.key)}
                  >
                    <Text style={[styles.categoryOptionText, { fontSize: 11.5 }, customCategory === cat.key && styles.categoryOptionTextActive]}>
                      {cat.label}
                    </Text>
                    <Text style={[styles.categoryOptionDesc, { fontSize: 9.5 }]}>{cat.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* REASON / RUN NOTE (WHY GIVING RUNS?) */}
              <View style={{ marginTop: 2, marginBottom: 8 }}>
                <Text style={styles.selectLabel}>REASON / RUN NOTE (WHY GIVING RUNS?):</Text>
                <TextInput
                  style={[styles.customNameInput, { height: 38, paddingVertical: 6 }, customRunsReason.trim() ? styles.customNameInputActive : null]}
                  placeholder="✍️ Type reason: e.g. Overthrow, Helmet penalty, Misfield, Short run..."
                  placeholderTextColor="#94a3b8"
                  value={customRunsReason}
                  onChangeText={(val) => setCustomRunsReason(val)}
                />
                {/* Quick suggestion chips */}
                <View style={[styles.quickReasonsRow, { marginTop: 4, gap: 4 }]}>
                  {['Overthrow', 'Helmet Hit (5 Penalty)', 'Misfield', 'Short Run', 'Boundary Overthrow', 'Obstruction'].map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={[
                        styles.quickReasonChip,
                        { paddingHorizontal: 7, paddingVertical: 3 },
                        customRunsReason === tag && styles.quickReasonChipActive
                      ]}
                      onPress={() => setCustomRunsReason(customRunsReason === tag ? '' : tag)}
                    >
                      <Text
                        style={[
                          styles.quickReasonChipText,
                          { fontSize: 10 },
                          customRunsReason === tag && styles.quickReasonChipTextActive
                        ]}
                      >
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={[styles.previewBox, { padding: 8, marginTop: 4 }]}>
                <Text style={[styles.previewBoxLabel, { fontSize: 9.5 }]}>RECORDING PREVIEW:</Text>
                <Text style={[styles.previewBoxText, { fontSize: 12 }]}>
                  {customRunsInput || '0'} Runs &bull; {customCategory.toUpperCase()} vs {bowler?.name || 'Bowler'}
                  {customRunsReason.trim() ? ` • [${customRunsReason.trim()}]` : ''}
                </Text>
              </View>
            </ScrollView>

            {/* Modal Actions - Fixed at Bottom */}
            <View style={[styles.modalActions, { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' }]}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowCustomModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleCustomRunsSubmit}
              >
                <Text style={styles.modalConfirmText}>Record Delivery</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CHANGE / SUBSTITUTE BATTER MODAL */}
      <Modal
        visible={showChangeBatterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowChangeBatterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 500, maxHeight: '90%' }]}>
            <View style={styles.wicketModalHeader}>
              <View style={styles.modalTopHeaderRow}>
                <View style={[styles.wicketBadgeTag, { backgroundColor: '#fef3c7', borderColor: '#fcd34d' }]}>
                  <Text style={[styles.wicketBadgeTagText, { color: '#b45309' }]}>
                    CHANGE {changeBatterTarget === 'striker' ? 'STRIKER' : 'NON-STRIKER'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.redCloseBtn}
                  onPress={() => setShowChangeBatterModal(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.redCloseBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.wicketModalTitle}>🏏 Change Batter at Crease</Text>
              <Text style={styles.wicketModalSub}>
                Assign or replace the {changeBatterTarget === 'striker' ? 'striker' : 'non-striker'} from {matchInfo?.teamA || 'the batting squad'}.
              </Text>
            </View>

            {/* Target Batter Toggle */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <TouchableOpacity
                style={[styles.outBatterBtn, changeBatterTarget === 'striker' && styles.outBatterBtnActive]}
                onPress={() => setChangeBatterTarget('striker')}
              >
                <Text style={[styles.outBatterRole, changeBatterTarget === 'striker' && styles.outBatterRoleActive]}>
                  STRIKER
                </Text>
                <Text style={[styles.outBatterName, changeBatterTarget === 'striker' && styles.outBatterNameActive]} numberOfLines={1}>
                  * {striker?.name || 'Striker'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.outBatterBtn, changeBatterTarget === 'nonStriker' && styles.outBatterBtnActive]}
                onPress={() => setChangeBatterTarget('nonStriker')}
              >
                <Text style={[styles.outBatterRole, changeBatterTarget === 'nonStriker' && styles.outBatterRoleActive]}>
                  NON-STRIKER
                </Text>
                <Text style={[styles.outBatterName, changeBatterTarget === 'nonStriker' && styles.outBatterNameActive]} numberOfLines={1}>
                  {nonStriker?.name || 'Non-Striker'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Dropdown trigger */}
            <Text style={styles.selectLabel}>CHOOSE FROM SATTUR SPARTANS SQUAD:</Text>
            <TouchableOpacity
              style={[
                styles.fielderDropdownTrigger,
                isChangeBatterDropdownOpen && styles.fielderDropdownTriggerOpen,
                (selectedChangeBatterObj || customChangeBatterName.trim()) && styles.fielderDropdownTriggerCustom
              ]}
              onPress={() => setIsChangeBatterDropdownOpen(!isChangeBatterDropdownOpen)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Text style={styles.fielderDropdownIcon}>🏏</Text>
                <Text
                  style={[
                    styles.fielderDropdownTriggerText,
                    (selectedChangeBatterObj || customChangeBatterName.trim()) && styles.fielderDropdownTriggerTextSelected
                  ]}
                  numberOfLines={1}
                >
                  {customChangeBatterName.trim()
                    ? `Substitute: ${customChangeBatterName.trim()}`
                    : selectedChangeBatterObj
                      ? `${selectedChangeBatterObj.name} (${selectedChangeBatterObj.role || 'BATTER'})`
                      : '-- Select Squad Player --'}
                </Text>
              </View>
              <Text style={styles.fielderDropdownArrow}>{isChangeBatterDropdownOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {/* Dropdown menu */}
            {isChangeBatterDropdownOpen && (
              <View style={styles.fielderDropdownMenu}>
                <View style={styles.dropdownSearchWrapper}>
                  <Text style={styles.dropdownSearchIcon}>🔍</Text>
                  <TextInput
                    style={styles.dropdownSearchInput}
                    placeholder="Search player name..."
                    placeholderTextColor="#94a3b8"
                    value={changeBatterSearch}
                    onChangeText={(txt) => setChangeBatterSearch(txt)}
                    autoCapitalize="none"
                  />
                  {changeBatterSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setChangeBatterSearch('')} style={styles.searchClearBtn}>
                      <Text style={styles.searchClearBtnText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView
                  nestedScrollEnabled={true}
                  style={styles.fielderDropdownScroll}
                  showsVerticalScrollIndicator={true}
                  keyboardShouldPersistTaps="handled"
                >
                  {changeBatterAvailableSquad.length === 0 ? (
                    <View style={styles.dropdownEmptyBox}>
                      <Text style={styles.dropdownEmptyText}>No remaining squad players found</Text>
                    </View>
                  ) : (
                    changeBatterAvailableSquad.map((player) => {
                      const isSelected = selectedChangeBatterId === player.id && !customChangeBatterName.trim();
                      return (
                        <TouchableOpacity
                          key={player.id}
                          style={[styles.fielderDropdownItem, isSelected && styles.fielderDropdownItemSelected]}
                          onPress={() => {
                            setSelectedChangeBatterId(player.id);
                            setCustomChangeBatterName('');
                            setIsChangeBatterDropdownOpen(false);
                            setChangeBatterSearch('');
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <View style={[styles.radioDot, isSelected && styles.radioDotSelected]} />
                            <Text
                              style={[styles.fielderDropdownItemName, isSelected && styles.fielderDropdownItemNameSelected]}
                              numberOfLines={1}
                            >
                              {player.name}
                            </Text>
                          </View>
                          <Text style={styles.fielderDropdownItemRole}>{player.role || 'BATTER'}</Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            )}

            {/* Manual entry */}
            <View style={{ marginTop: 10, marginBottom: 12 }}>
              <Text style={styles.fieldSubLabel}>OR ENTER MANUAL / SUBSTITUTE BATTER NAME:</Text>
              <TextInput
                style={[styles.customNameInput, customChangeBatterName.trim() ? styles.customNameInputActive : null]}
                placeholder="✍️ Enter batsman name manually..."
                placeholderTextColor="#94a3b8"
                value={customChangeBatterName}
                onChangeText={(txt) => {
                  setCustomChangeBatterName(txt);
                  if (txt.trim()) {
                    setSelectedChangeBatterId('');
                    setIsChangeBatterDropdownOpen(false);
                  }
                }}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowChangeBatterModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  (!selectedChangeBatterId && !customChangeBatterName.trim()) && styles.btnDisabled
                ]}
                disabled={!selectedChangeBatterId && !customChangeBatterName.trim()}
                onPress={handleSubmitChangeBatter}
              >
                <Text style={styles.modalConfirmText}>Set as Active Batter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CHANGE / SUBSTITUTE BOWLER MODAL */}
      <Modal
        visible={showChangeBowlerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowChangeBowlerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 500, maxHeight: '90%' }]}>
            <View style={styles.wicketModalHeader}>
              <View style={styles.modalTopHeaderRow}>
                <View style={[styles.wicketBadgeTag, { backgroundColor: '#fef3c7', borderColor: '#fcd34d' }]}>
                  <Text style={[styles.wicketBadgeTagText, { color: '#b45309' }]}>
                    CHANGE CURRENT BOWLER
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.redCloseBtn}
                  onPress={() => setShowChangeBowlerModal(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.redCloseBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.wicketModalTitle}>🎳 Change Active Bowler</Text>
              <Text style={styles.wicketModalSub}>
                Assign or substitute the bowler bowling from {matchInfo?.teamB || 'the bowling squad'}.
              </Text>
            </View>

            {/* Current Bowler Card */}
            {bowler && (
              <View style={styles.prevBowlerBanner}>
                <Text style={styles.prevBowlerBannerLabel}>ACTIVE BOWLER AT CREASE</Text>
                <Text style={styles.prevBowlerBannerName}>{bowler.name}</Text>
                <Text style={styles.prevBowlerBannerNote}>
                  {bowler.overs} ov | {bowler.runs} runs | {bowler.wickets} wkts | ER: {bowler.economy}
                </Text>
              </View>
            )}

            {/* Mid-Over Clean Badge - Clean English notification */}
            {balls % 6 > 0 && (
              <View style={styles.midOverCleanBadge}>
                <Text style={styles.midOverCleanBadgeIcon}>⚡</Text>
                <Text style={styles.midOverCleanBadgeText}>
                  Balls Remaining: <Text style={{ fontWeight: '800', color: '#b45309' }}>{6 - (balls % 6)} Balls Remaining</Text> ({balls % 6} ball(s) bowled in this over)
                </Text>
              </View>
            )}

            {/* Substitution Situation / Reason Selector (Dropdown + Custom Typing) */}
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.selectLabel}>BOWLER SITUATION / REASON:</Text>
              <TouchableOpacity
                style={[
                  styles.situationDropdownTrigger,
                  isSituationDropdownOpen && styles.situationDropdownTriggerOpen
                ]}
                onPress={() => {
                  setIsSituationDropdownOpen(!isSituationDropdownOpen);
                  setIsChangeBowlerDropdownOpen(false);
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                  <Text style={{ fontSize: 13, marginRight: 6 }}>📋</Text>
                  <Text style={styles.situationDropdownTriggerText} numberOfLines={1}>
                    {bowlerSituation || 'Select Situation / Reason...'}
                  </Text>
                </View>
                <Text style={styles.fielderDropdownArrow}>{isSituationDropdownOpen ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {isSituationDropdownOpen && (
                <View style={styles.situationDropdownMenu}>
                  {BOWLER_SITUATIONS.map(sit => {
                    const isSelected = bowlerSituation === sit.text && sit.text !== '';
                    return (
                      <TouchableOpacity
                        key={sit.id}
                        style={[
                          styles.situationDropdownItem,
                          isSelected && styles.situationDropdownItemSelected
                        ]}
                        onPress={() => {
                          if (sit.text) {
                            setBowlerSituation(sit.text);
                          } else {
                            setBowlerSituation('');
                          }
                          setIsSituationDropdownOpen(false);

                          if (sit.id === 'SUSPENDED') {
                            setChangeBowlerReason('NO_BALL_SUSPENSION');
                            setIsSuspendingCurrentBowler(true);
                          } else if (sit.id === 'INJURY' || sit.id === 'CRAMPS' || sit.id === 'MEDICAL') {
                            setChangeBowlerReason('INJURY');
                            setIsSuspendingCurrentBowler(false);
                          } else {
                            setChangeBowlerReason('TACTICAL');
                            setIsSuspendingCurrentBowler(false);
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.situationDropdownItemText,
                          isSelected && styles.situationDropdownItemTextSelected
                        ]}>
                          {sit.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Editable / Custom Situation Input */}
              <View style={{ marginTop: 6 }}>
                <TextInput
                  style={styles.situationCustomInput}
                  placeholder="Or type custom reason here..."
                  placeholderTextColor="#94a3b8"
                  value={bowlerSituation}
                  onChangeText={(txt) => {
                    setBowlerSituation(txt);
                    const lower = txt.toLowerCase();
                    if (lower.includes('no-ball') || lower.includes('beamer') || lower.includes('suspend')) {
                      setChangeBowlerReason('NO_BALL_SUSPENSION');
                      setIsSuspendingCurrentBowler(true);
                    } else if (lower.includes('injur') || lower.includes('cramp') || lower.includes('blood') || lower.includes('medic')) {
                      setChangeBowlerReason('INJURY');
                      setIsSuspendingCurrentBowler(false);
                    } else {
                      setChangeBowlerReason('TACTICAL');
                      setIsSuspendingCurrentBowler(false);
                    }
                  }}
                />
              </View>
            </View>

            {/* Dropdown trigger */}
            <Text style={styles.selectLabel}>CHOOSE FROM BOWLING SQUAD:</Text>
            <TouchableOpacity
              style={[
                styles.fielderDropdownTrigger,
                isChangeBowlerDropdownOpen && styles.fielderDropdownTriggerOpen,
                (selectedChangeBowlerObj || customChangeBowlerName.trim()) && styles.fielderDropdownTriggerCustom
              ]}
              onPress={() => {
                setIsChangeBowlerDropdownOpen(!isChangeBowlerDropdownOpen);
                setIsSituationDropdownOpen(false);
              }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Text style={styles.fielderDropdownIcon}>🎳</Text>
                <Text
                  style={[
                    styles.fielderDropdownTriggerText,
                    (selectedChangeBowlerObj || customChangeBowlerName.trim()) && styles.fielderDropdownTriggerTextSelected
                  ]}
                  numberOfLines={1}
                >
                  {customChangeBowlerName.trim()
                    ? `Substitute: ${customChangeBowlerName.trim()}`
                    : selectedChangeBowlerObj
                      ? `${selectedChangeBowlerObj.name} (${selectedChangeBowlerObj.role || 'BOWLER'})`
                      : '-- Select Bowler from Squad --'}
                </Text>
              </View>
              <Text style={styles.fielderDropdownArrow}>{isChangeBowlerDropdownOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {/* Dropdown menu */}
            {isChangeBowlerDropdownOpen && (
              <View style={styles.fielderDropdownMenu}>
                <View style={styles.dropdownSearchWrapper}>
                  <Text style={styles.dropdownSearchIcon}>🔍</Text>
                  <TextInput
                    style={styles.dropdownSearchInput}
                    placeholder="Search bowler name..."
                    placeholderTextColor="#94a3b8"
                    value={changeBowlerSearch}
                    onChangeText={(txt) => setChangeBowlerSearch(txt)}
                    autoCapitalize="none"
                  />
                  {changeBowlerSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setChangeBowlerSearch('')} style={styles.searchClearBtn}>
                      <Text style={styles.searchClearBtnText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView
                  nestedScrollEnabled={true}
                  style={styles.fielderDropdownScroll}
                  showsVerticalScrollIndicator={true}
                  keyboardShouldPersistTaps="handled"
                >
                  {filteredChangeBowlerSquad.length === 0 ? (
                    <View style={styles.dropdownEmptyBox}>
                      <Text style={styles.dropdownEmptyText}>No bowling squad players found</Text>
                    </View>
                  ) : (
                    filteredChangeBowlerSquad.map((player: any) => {
                      const isSelected = selectedChangeBowlerId === player.id && !customChangeBowlerName.trim();
                      const isCurrent = player.id === bowler?.id;
                      return (
                        <TouchableOpacity
                          key={player.id}
                          style={[
                            styles.fielderDropdownItem,
                            isSelected && styles.fielderDropdownItemSelected,
                            isCurrent && { backgroundColor: '#f1f5f9' }
                          ]}
                          onPress={() => {
                            setSelectedChangeBowlerId(player.id);
                            setCustomChangeBowlerName('');
                            setIsChangeBowlerDropdownOpen(false);
                            setChangeBowlerSearch('');
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <View style={[styles.radioDot, isSelected && styles.radioDotSelected]} />
                            <Text
                              style={[styles.fielderDropdownItemName, isSelected && styles.fielderDropdownItemNameSelected]}
                              numberOfLines={1}
                            >
                              {player.name} {isCurrent ? '(Current)' : ''}
                            </Text>
                          </View>
                          <Text style={styles.fielderDropdownItemRole}>
                            {player.overs > 0 ? `${player.overs} ov • ${player.wickets}w` : player.role || 'BOWLER'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            )}

            {/* Manual entry */}
            <View style={{ marginTop: 10, marginBottom: 12 }}>
              <Text style={styles.fieldSubLabel}>OR ENTER MANUAL / SUBSTITUTE BOWLER NAME:</Text>
              <TextInput
                style={[styles.customNameInput, customChangeBowlerName.trim() ? styles.customNameInputActive : null]}
                placeholder="✍️ Enter bowler name manually..."
                placeholderTextColor="#94a3b8"
                value={customChangeBowlerName}
                onChangeText={(txt) => {
                  setCustomChangeBowlerName(txt);
                  if (txt.trim()) {
                    setSelectedChangeBowlerId('');
                    setIsChangeBowlerDropdownOpen(false);
                  }
                }}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowChangeBowlerModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  { backgroundColor: '#005960' },
                  (!selectedChangeBowlerId && !customChangeBowlerName.trim()) && styles.btnDisabled
                ]}
                disabled={(!selectedChangeBowlerId && !customChangeBowlerName.trim()) || isUpdatingBowler}
                onPress={handleSubmitChangeBowler}
              >
                {isUpdatingBowler ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Set as Active Bowler</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 2 NO-BALLS DANGEROUS BOWLING ALERT MODAL (MCC LAW 41.7) */}
      <Modal
        visible={noBallAlert !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setNoBallAlert(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 440 }]}>
            <View style={styles.wicketModalHeader}>
              <View style={styles.modalTopHeaderRow}>
                <View style={[styles.wicketBadgeTag, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
                  <Text style={[styles.wicketBadgeTagText, { color: '#b91c1c' }]}>
                    ⚠️ 2 NO-BALLS DANGEROUS BOWLING ALERT
                  </Text>
                </View>
              </View>
              <Text style={[styles.wicketModalTitle, { color: '#991b1b', marginTop: 6 }]}>
                MCC Law 41.7 Violation
              </Text>
              <Text style={[styles.wicketModalSub, { color: '#475569', marginTop: 4 }]}>
                Bowler <Text style={{ fontWeight: 'bold', color: '#0f172a' }}>{noBallAlert?.bowlerName}</Text> has bowled 2 No-Balls in this innings. Under cricket rules, the umpire directs the captain to take the bowler off immediately.
              </Text>
            </View>

            <View style={{ backgroundColor: '#fff1f2', borderRadius: 8, padding: 12, marginVertical: 14, borderWidth: 1, borderColor: '#fecdd3' }}>
              <Text style={{ fontSize: 12, color: '#9f1239', fontWeight: '700' }}>
                ⚖️ Umpire Directive:
              </Text>
              <Text style={{ fontSize: 11.5, color: '#be123c', marginTop: 2, lineHeight: 16 }}>
                Under Law 41.7, the bowler should be suspended from bowling for the remainder of the innings. Another bowler must complete this over.
              </Text>
            </View>

            <View style={{ flexDirection: 'column', gap: 10 }}>
              {/* Option 1: Suspend & Replace Bowler */}
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#dc2626', width: '100%', height: 44 }]}
                onPress={() => {
                  setNoBallAlert(null);
                  setSelectedChangeBowlerId('');
                  setCustomChangeBowlerName('');
                  setIsChangeBowlerDropdownOpen(false);
                  setChangeBowlerSearch('');
                  setChangeBowlerReason('NO_BALL_SUSPENSION');
                  setBowlerSituation('Umpire Suspended (2 No-Balls)');
                  setIsSituationDropdownOpen(false);
                  setIsSuspendingCurrentBowler(true);
                  setShowChangeBowlerModal(true);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.modalConfirmText}>🛑 Suspend & Replace Bowler</Text>
              </TouchableOpacity>

              {/* Option 2: Allow Bowler to Continue (Skip Warning) */}
              <TouchableOpacity
                style={[styles.modalCancelBtn, { width: '100%', height: 40, backgroundColor: '#f1f5f9', borderColor: '#cbd5e1', borderWidth: 1 }]}
                onPress={() => {
                  if (noBallAlert?.bowlerId) {
                    setDismissedNoBallBowlers(prev => [...prev, noBallAlert.bowlerId]);
                  }
                  setNoBallAlert(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalCancelText, { color: '#334155', fontWeight: '700' }]}>
                  ▶️ Allow Bowler to Continue (Skip Warning)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showWicketModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWicketModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 540, maxHeight: '92%' }]}>
            <ScrollView showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled">
              {wicketStep === 1 ? (
                /* STEP 1: DISMISSAL METHOD & WHO GOT OUT */
                <View>
                  <View style={styles.wicketModalHeader}>
                    <View style={styles.modalTopHeaderRow}>
                      <View style={styles.wicketBadgeTag}>
                        <Text style={styles.wicketBadgeTagText}>WICKET FALLEN • STEP 1 OF 2</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.redCloseBtn}
                        onPress={() => setShowWicketModal(false)}
                        activeOpacity={0.7}
                        accessibilityLabel="Close Wicket Modal"
                      >
                        <Text style={styles.redCloseBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.wicketModalTitle}>🏏 How did the Wicket Fall?</Text>
                    <Text style={styles.wicketModalSub}>
                      Select who got out and tap the dismissal method to proceed to details.
                    </Text>
                  </View>

                  {/* 1. OUT BATSMAN SELECTION (Striker vs Non-Striker) */}
                  <Text style={styles.selectLabel}>1. WHO GOT OUT?</Text>
                  <View style={styles.outBatterToggleRow}>
                    <TouchableOpacity
                      style={[styles.outBatterBtn, dismissedTarget === 'striker' && styles.outBatterBtnActive]}
                      onPress={() => setDismissedTarget('striker')}
                    >
                      <Text style={[styles.outBatterRole, dismissedTarget === 'striker' && styles.outBatterRoleActive]}>
                        STRIKER
                      </Text>
                      <Text style={[styles.outBatterName, dismissedTarget === 'striker' && styles.outBatterNameActive]} numberOfLines={1}>
                        * {striker ? striker.name : 'Striker'}
                      </Text>
                      <Text style={styles.outBatterStats}>
                        {striker ? `${striker.runs} (${striker.balls})` : '0 (0)'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.outBatterBtn, dismissedTarget === 'nonStriker' && styles.outBatterBtnActive]}
                      onPress={() => setDismissedTarget('nonStriker')}
                    >
                      <Text style={[styles.outBatterRole, dismissedTarget === 'nonStriker' && styles.outBatterRoleActive]}>
                        NON-STRIKER
                      </Text>
                      <Text style={[styles.outBatterName, dismissedTarget === 'nonStriker' && styles.outBatterNameActive]} numberOfLines={1}>
                        {nonStriker ? nonStriker.name : 'Non-Striker'}
                      </Text>
                      <Text style={styles.outBatterStats}>
                        {nonStriker ? `${nonStriker.runs} (${nonStriker.balls})` : '0 (0)'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* 2. DISMISSAL TYPE (HOW OUT) */}
                  <Text style={styles.selectLabel}>2. HOW OUT? (TAP TO SELECT METHOD):</Text>
                  {isFreeHitActive && (
                    <View style={styles.freeHitModalNotice}>
                      <Text style={styles.freeHitModalNoticeText}>
                        ⚡ FREE HIT IN PROGRESS: Batter is immune to Bowled, Caught, LBW & Stumped. Only RUN OUT can dismiss the batter!
                      </Text>
                    </View>
                  )}
                  <View style={styles.dismissalGrid}>
                    {[
                      { key: 'BOWLED', label: 'Bowled', desc: 'b Bowler' },
                      { key: 'CAUGHT', label: 'Caught', desc: 'c Fielder b Bowler' },
                      { key: 'CAUGHT_BEHIND', label: 'Caught Behind', desc: 'c †Keeper b Bowler' },
                      { key: 'CAUGHT_AND_BOWLED', label: 'Caught & Bowled', desc: 'c & b Bowler' },
                      { key: 'LBW', label: 'LBW', desc: 'lbw b Bowler' },
                      { key: 'RUN_OUT', label: 'Run Out', desc: 'run out (Fielder)' },
                      { key: 'STUMPED', label: 'Stumped', desc: 'st †Keeper b Bowler' },
                      { key: 'HIT_WICKET', label: 'Hit Wicket', desc: 'hit wicket b Bowler' },
                      { key: 'RETIRED_HURT', label: 'Retired Hurt', desc: 'temporarily injured (not out)' },
                      { key: 'RETIRED_OUT', label: 'Retired Out', desc: 'batter retired out' },
                      { key: 'OBSTRUCTING_FIELD', label: 'Obstructing Field', desc: 'wilful interference (Law 37)' },
                      { key: 'HIT_BALL_TWICE', label: 'Hit Ball Twice', desc: 'hit ball twice (Law 34)' },
                      { key: 'TIMED_OUT', label: 'Timed Out', desc: 'exceeded time limit (Law 40)' }
                    ].map((item) => {
                      const isImmuneOnFreeHit = isFreeHitActive && !['RUN_OUT', 'RETIRED_OUT', 'RETIRED_HURT', 'OBSTRUCTING_FIELD', 'HIT_BALL_TWICE'].includes(item.key);
                      return (
                        <TouchableOpacity
                          key={item.key}
                          disabled={isImmuneOnFreeHit}
                          style={[
                            styles.dismissalChip,
                            wicketType === item.key && styles.dismissalChipActive,
                            isImmuneOnFreeHit && { opacity: 0.35, backgroundColor: '#f1f5f9' },
                            item.key === 'RETIRED_HURT' && { borderColor: '#3b82f6' }
                          ]}
                          onPress={() => {
                            if (isImmuneOnFreeHit) {
                              const msg = 'Batter is immune on Free Hit (MCC Law 21.19). Only Run Out / Obstruction is allowed.';
                              Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Free Hit Immunity', msg);
                              return;
                            }
                            setWicketType(item.key);
                            setWicketStep(2);
                          }}
                        >
                          <Text style={[styles.dismissalChipText, wicketType === item.key && styles.dismissalChipTextActive, item.key === 'RETIRED_HURT' && { color: '#1d4ed8' }]}>
                            {item.label}
                          </Text>
                          <Text style={[styles.dismissalChipSub, wicketType === item.key && styles.dismissalChipSubActive]}>
                            {isImmuneOnFreeHit ? '❌ Immune on Free Hit' : item.desc}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Run Out Crossing Visual Helper Button */}
                  <TouchableOpacity
                    style={styles.runOutHelperBtn}
                    onPress={() => {
                      setActiveCricketRule('RUN_OUT_CROSS');
                      setCricketRuleContext({
                        strikerName: striker?.name || 'Striker',
                        nonStrikerName: nonStriker?.name || 'Non-Striker'
                      });
                      setShowCricketRulesModal(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.runOutHelperBtnText}>🏃 Open Run Out Crossing Visual Helper Diagram</Text>
                  </TouchableOpacity>

                  <View style={[styles.modalActions, { marginTop: 14 }]}>
                    <TouchableOpacity
                      style={styles.modalCancelBtn}
                      onPress={() => setShowWicketModal(false)}
                    >
                      <Text style={styles.modalCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalConfirmBtn, { backgroundColor: '#dc2626' }]}
                      onPress={() => setWicketStep(2)}
                    >
                      <Text style={styles.modalConfirmText}>Next: Details ➔</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                /* STEP 2: FIELDER (IF OUT-BY) & INCOMING BATTER (MANDATORY) */
                <View>
                  <View style={styles.wicketModalHeader}>
                    <View style={styles.modalTopHeaderRow}>
                      <View style={styles.wicketBadgeTag}>
                        <Text style={styles.wicketBadgeTagText}>WICKET FALLEN • STEP 2 OF 2</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.redCloseBtn}
                        onPress={() => setShowWicketModal(false)}
                        activeOpacity={0.7}
                        accessibilityLabel="Close Wicket Modal"
                      >
                        <Text style={styles.redCloseBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.wicketModalTitle}>🏏 Fielder & Incoming Batter</Text>
                    <Text style={styles.wicketModalSub}>
                      {['CAUGHT', 'CAUGHT_BEHIND', 'RUN_OUT', 'STUMPED'].includes(wicketType)
                        ? 'Select the fielder involved and assign the next batter.'
                        : 'Assign the incoming batter to resume play.'}
                    </Text>
                  </View>

                  {/* DISMISSAL SUMMARY WITH CHANGE BUTTON */}
                  <View style={styles.dismissalSummaryCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dismissalSummaryLabel}>DISMISSED BATTER & METHOD</Text>
                      <Text style={styles.dismissalSummaryText}>
                        {(dismissedTarget === 'striker' ? striker?.name : nonStriker?.name) || 'Batter'}{' '}
                        <Text style={{ color: '#dc2626' }}>({wicketType.replace(/_/g, ' ')})</Text>
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.changeDismissalBtn}
                      onPress={() => setWicketStep(1)}
                    >
                      <Text style={styles.changeDismissalBtnText}>← Change</Text>
                    </TouchableOpacity>
                  </View>

                  {/* WICKETKEEPER DISMISSAL VISUAL CARD (Caught Behind / Stumped) */}
                  {(wicketType === 'STUMPED' || wicketType === 'CAUGHT_BEHIND') && (
                    <View style={styles.keeperDismissalCard}>
                      <View style={styles.keeperImageContainer}>
                        <Image
                          source={keeperDismissalImage}
                          style={styles.keeperArtwork}
                          resizeMode="contain"
                        />
                      </View>
                      <View style={styles.keeperTextCol}>
                        <View style={styles.keeperTagBadge}>
                          <Text style={styles.keeperTagBadgeText}>🧤 WICKETKEEPER DISMISSAL</Text>
                        </View>
                        <Text style={styles.keeperDismissalTitle}>
                          {wicketType === 'STUMPED' ? 'Stumped (st Keeper b Bowler)' : 'Caught Behind (c Keeper b Bowler)'}
                        </Text>
                        <Text style={styles.keeperDismissalExplanation}>
                          {wicketType === 'STUMPED'
                            ? 'பேட்டர் க்ரீஸை விட்டு வெளியே வந்ததும் கீப்பர் ஸ்டம்பைத் தட்டி அவுட் செய்தார்.'
                            : 'பேட்டர் எட்ஜ் செய்த பந்தை விக்கெட் கீப்பர் கேட்ச் பிடித்தார்.'}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* RUN OUT DISMISSAL VISUAL CARD */}
                  {wicketType === 'RUN_OUT' && (
                    <View style={styles.runOutDismissalCard}>
                      <View style={styles.runOutImageContainer}>
                        <Image
                          source={runOutMilestoneImage}
                          style={styles.runOutArtwork}
                          resizeMode="contain"
                        />
                      </View>
                      <View style={styles.runOutTextCol}>
                        <View style={[styles.keeperTagBadge, { backgroundColor: '#fee2e2', borderColor: '#ef4444' }]}>
                          <Text style={[styles.keeperTagBadgeText, { color: '#dc2626' }]}>🎯 DIRECT HIT RUN OUT</Text>
                        </View>
                        <Text style={styles.runOutDismissalTitle}>Run Out (Fielder Direct Hit / Throw)</Text>
                        <Text style={styles.runOutDismissalExplanation}>
                          பேட்டர் க்ரீஸுக்குள் வருவதற்கு முன் பீல்டர் வீசிய பந்து ஸ்டம்பைத் தகர்த்தது.
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* 3. FIELDER SELECTION - ONLY SHOWN FOR CAUGHT, CAUGHT_BEHIND, RUN_OUT, STUMPED */}
                  {['CAUGHT', 'CAUGHT_BEHIND', 'RUN_OUT', 'STUMPED'].includes(wicketType) && (
                    <View style={{ marginTop: 4, marginBottom: 14 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={styles.selectLabel}>
                          SELECT FIELDER (OUT BY) FROM {(matchInfo?.teamB || 'BOWLING TEAM').toUpperCase()}:
                        </Text>
                        <View style={styles.requiredBadge}>
                          <Text style={styles.requiredBadgeText}>REQUIRED</Text>
                        </View>
                      </View>

                      {/* FIELDER DROPDOWN TRIGGER */}
                      <TouchableOpacity
                        style={[
                          styles.fielderDropdownTrigger,
                          isFielderDropdownOpen && styles.fielderDropdownTriggerOpen,
                          (selectedFielderObj || customFielderName.trim()) && styles.fielderDropdownTriggerCustom
                        ]}
                        onPress={() => setIsFielderDropdownOpen(!isFielderDropdownOpen)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <Text style={styles.fielderDropdownIcon}>🧤</Text>
                          <Text
                            style={[
                              styles.fielderDropdownTriggerText,
                              (selectedFielderObj || customFielderName.trim()) && styles.fielderDropdownTriggerTextSelected
                            ]}
                            numberOfLines={1}
                          >
                            {customFielderName.trim()
                              ? `Substitute: ${customFielderName.trim()}`
                              : selectedFielderObj
                                ? `${selectedFielderObj.name} (${selectedFielderObj.role || 'FIELD'})`
                                : '-- Choose Fielder from Dropdown --'}
                          </Text>
                        </View>
                        <Text style={styles.fielderDropdownArrow}>{isFielderDropdownOpen ? '▲' : '▼'}</Text>
                      </TouchableOpacity>

                      {/* EXPANDABLE DROPDOWN MENU */}
                      {isFielderDropdownOpen && (
                        <View style={styles.fielderDropdownMenu}>
                          <View style={styles.dropdownSearchWrapper}>
                            <Text style={styles.dropdownSearchIcon}>🔍</Text>
                            <TextInput
                              style={styles.dropdownSearchInput}
                              placeholder="Search fielder by name..."
                              placeholderTextColor="#94a3b8"
                              value={fielderSearchQuery}
                              onChangeText={(txt) => setFielderSearchQuery(txt)}
                              autoCapitalize="none"
                            />
                            {fielderSearchQuery.length > 0 && (
                              <TouchableOpacity
                                onPress={() => setFielderSearchQuery('')}
                                style={styles.searchClearBtn}
                              >
                                <Text style={styles.searchClearBtnText}>✕</Text>
                              </TouchableOpacity>
                            )}
                          </View>

                          <ScrollView
                            nestedScrollEnabled={true}
                            style={styles.fielderDropdownScroll}
                            showsVerticalScrollIndicator={true}
                            keyboardShouldPersistTaps="handled"
                          >
                            {filteredFielders.length === 0 ? (
                              <View style={styles.dropdownEmptyBox}>
                                <Text style={styles.dropdownEmptyText}>
                                  No fielders found matching "{fielderSearchQuery}"
                                </Text>
                              </View>
                            ) : (
                              filteredFielders.map((f) => {
                                const isFielderSelected = selectedFielderId === f.id && !customFielderName.trim();
                                return (
                                  <TouchableOpacity
                                    key={f.id}
                                    style={[styles.fielderDropdownItem, isFielderSelected && styles.fielderDropdownItemSelected]}
                                    onPress={() => {
                                      setSelectedFielderId(f.id);
                                      setCustomFielderName('');
                                      setIsFielderDropdownOpen(false);
                                      setFielderSearchQuery('');
                                    }}
                                  >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                      <View style={[styles.radioDot, isFielderSelected && styles.radioDotSelected]} />
                                      <Text
                                        style={[styles.fielderDropdownItemName, isFielderSelected && styles.fielderDropdownItemNameSelected]}
                                        numberOfLines={1}
                                      >
                                        {f.name}
                                      </Text>
                                    </View>
                                    <Text style={styles.fielderDropdownItemRole}>{f.role || 'FIELD'}</Text>
                                  </TouchableOpacity>
                                );
                              })
                            )}
                          </ScrollView>
                        </View>
                      )}

                      {/* MANUAL SUBSTITUTE FIELDER INPUT */}
                      <View style={{ marginTop: 8 }}>
                        <TextInput
                          style={[
                            styles.customNameInput,
                            customFielderName.trim() ? styles.customNameInputActive : null
                          ]}
                          placeholder="✍️ Or enter substitute fielder name manually..."
                          placeholderTextColor="#94a3b8"
                          value={customFielderName}
                          onChangeText={(txt) => {
                            setCustomFielderName(txt);
                            if (txt.trim()) {
                              setSelectedFielderId('');
                            }
                          }}
                        />
                        {customFielderName.trim() ? (
                          <Text style={styles.manualConfirmedHint}>
                            ✓ Using substitute fielder: <Text style={{ fontWeight: 'bold' }}>{customFielderName.trim()}</Text>
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  )}

                  {/* 4. RUNS ON WICKET BALL (For Run Out) */}
                  {wicketType === 'RUN_OUT' && (
                    <View style={{ marginTop: 4, marginBottom: 12 }}>
                      <Text style={styles.selectLabel}>RUNS COMPLETED BEFORE RUN OUT:</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {[0, 1, 2, 3].map((r) => (
                          <TouchableOpacity
                            key={r}
                            style={[styles.customRunChip, runsOnWicket === r && styles.customRunChipActive]}
                            onPress={() => setRunsOnWicket(r)}
                          >
                            <Text style={[styles.customRunChipText, runsOnWicket === r && styles.customRunChipTextActive]}>
                              {r} Run{r !== 1 ? 's' : ''}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* 5. INCOMING BATTER SELECTION (MUST SELECT) */}
                  <View style={{ marginTop: 4, marginBottom: 12 }}>
                    {wickets + 1 >= 10 ? (
                      <View style={styles.allOutBanner}>
                        <Text style={styles.allOutBannerText}>
                          ⚠️ 10th Wicket: All Out! Innings will be completed automatically.
                        </Text>
                      </View>
                    ) : (
                      <>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <Text style={styles.selectLabel}>
                            SELECT INCOMING BATTER FROM {(matchInfo?.teamA || 'BATTING TEAM').toUpperCase()}:
                          </Text>
                          <View style={[styles.requiredBadge, { backgroundColor: (!selectedNextBatterId && !customBatterName.trim()) ? '#fee2e2' : '#dcfce7', borderColor: (!selectedNextBatterId && !customBatterName.trim()) ? '#fca5a5' : '#86efac' }]}>
                            <Text style={[styles.requiredBadgeText, { color: (!selectedNextBatterId && !customBatterName.trim()) ? '#dc2626' : '#16a34a' }]}>
                              {(!selectedNextBatterId && !customBatterName.trim()) ? '* MUST SELECT' : '✓ SELECTED'}
                            </Text>
                          </View>
                        </View>

                        {/* INCOMING BATTER DROPDOWN TRIGGER */}
                        <TouchableOpacity
                          style={[
                            styles.fielderDropdownTrigger,
                            isBatterDropdownOpen && styles.fielderDropdownTriggerOpen,
                            (selectedBatterObj || customBatterName.trim()) ? styles.fielderDropdownTriggerCustom : styles.fielderDropdownTriggerRequired
                          ]}
                          onPress={() => setIsBatterDropdownOpen(!isBatterDropdownOpen)}
                          activeOpacity={0.7}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Text style={styles.fielderDropdownIcon}>🏏</Text>
                            <Text
                              style={[
                                styles.fielderDropdownTriggerText,
                                (selectedBatterObj || customBatterName.trim())
                                  ? styles.fielderDropdownTriggerTextSelected
                                  : styles.fielderDropdownTriggerTextPlaceholder
                              ]}
                              numberOfLines={1}
                            >
                              {customBatterName.trim()
                                ? `Substitute: ${customBatterName.trim()}`
                                : selectedBatterObj
                                  ? `${selectedBatterObj.name} (${selectedBatterObj.role || 'BATTER'})`
                                  : '-- Choose Incoming Batter from Dropdown (Must Select) * --'}
                            </Text>
                          </View>
                          <Text style={styles.fielderDropdownArrow}>{isBatterDropdownOpen ? '▲' : '▼'}</Text>
                        </TouchableOpacity>

                        {/* EXPANDABLE DROPDOWN MENU */}
                        {isBatterDropdownOpen && (
                          <View style={styles.fielderDropdownMenu}>
                            <View style={styles.dropdownSearchWrapper}>
                              <Text style={styles.dropdownSearchIcon}>🔍</Text>
                              <TextInput
                                style={styles.dropdownSearchInput}
                                placeholder="Search player name or role..."
                                placeholderTextColor="#94a3b8"
                                value={batterSearchQuery}
                                onChangeText={(txt) => setBatterSearchQuery(txt)}
                                autoCapitalize="none"
                              />
                              {batterSearchQuery.length > 0 && (
                                <TouchableOpacity
                                  onPress={() => setBatterSearchQuery('')}
                                  style={styles.searchClearBtn}
                                >
                                  <Text style={styles.searchClearBtnText}>✕</Text>
                                </TouchableOpacity>
                              )}
                            </View>

                            <ScrollView
                              nestedScrollEnabled={true}
                              style={styles.fielderDropdownScroll}
                              showsVerticalScrollIndicator={true}
                              keyboardShouldPersistTaps="handled"
                            >
                              {availableSquad.length === 0 ? (
                                <View style={styles.dropdownEmptyBox}>
                                  <Text style={styles.dropdownEmptyText}>
                                    {batterSearchQuery.trim()
                                      ? `No squad players found matching "${batterSearchQuery}"`
                                      : 'No remaining squad players in MongoDB. Enter batsman name below.'}
                                  </Text>
                                </View>
                              ) : (
                                availableSquad.map((player) => {
                                  const isSelected = selectedNextBatterId === player.id && !customBatterName.trim();
                                  return (
                                    <TouchableOpacity
                                      key={player.id}
                                      style={[styles.fielderDropdownItem, isSelected && styles.fielderDropdownItemSelected]}
                                      onPress={() => {
                                        setSelectedNextBatterId(player.id);
                                        setCustomBatterName('');
                                        setIsBatterDropdownOpen(false);
                                        setBatterSearchQuery('');
                                      }}
                                    >
                                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                        <View style={[styles.radioDot, isSelected && styles.radioDotSelected]} />
                                        <Text
                                          style={[styles.fielderDropdownItemName, isSelected && styles.fielderDropdownItemNameSelected]}
                                          numberOfLines={1}
                                        >
                                          {player.name}
                                        </Text>
                                      </View>
                                      <Text style={styles.fielderDropdownItemRole}>{player.role || 'BATTER'}</Text>
                                    </TouchableOpacity>
                                  );
                                })
                              )}
                            </ScrollView>
                          </View>
                        )}

                        {/* MANUAL BATTER ENTRY */}
                        <View style={{ marginTop: 8 }}>
                          <TextInput
                            style={[
                              styles.customNameInput,
                              customBatterName.trim() ? styles.customNameInputActive : null
                            ]}
                            placeholder="✍️ Or enter batsman name manually (e.g. Guest / Substitute)..."
                            placeholderTextColor="#94a3b8"
                            value={customBatterName}
                            onChangeText={(txt) => {
                              setCustomBatterName(txt);
                              if (txt.trim()) {
                                setSelectedNextBatterId('');
                                setIsBatterDropdownOpen(false);
                              }
                            }}
                          />
                          {customBatterName.trim() ? (
                            <Text style={styles.manualConfirmedHint}>
                              ✓ Using manual batsman: <Text style={{ fontWeight: 'bold' }}>{customBatterName.trim()}</Text>
                            </Text>
                          ) : null}
                        </View>
                      </>
                    )}
                  </View>

                  {/* 6. DISMISSAL PREVIEW BOX */}
                  <View style={styles.previewBox}>
                    <Text style={styles.previewBoxLabel}>SCORECARD DISMISSAL PREVIEW:</Text>
                    <Text style={styles.previewBoxText}>
                      {dismissedTarget === 'striker' ? striker?.name || 'Striker' : nonStriker?.name || 'Non-Striker'}{' '}
                      {wicketType === 'BOWLED' && `b ${bowler?.name || 'Bowler'}`}
                      {wicketType === 'CAUGHT' && `c ${customFielderName.trim() || bowlingSquad.find(f => f.id === selectedFielderId)?.name || 'Fielder'} b ${bowler?.name || 'Bowler'}`}
                      {wicketType === 'CAUGHT_BEHIND' && `c †${customFielderName.trim() || bowlingSquad.find(f => f.id === selectedFielderId)?.name || 'Keeper'} b ${bowler?.name || 'Bowler'}`}
                      {wicketType === 'CAUGHT_AND_BOWLED' && `c & b ${bowler?.name || 'Bowler'}`}
                      {wicketType === 'LBW' && `lbw b ${bowler?.name || 'Bowler'}`}
                      {wicketType === 'RUN_OUT' && `run out (${customFielderName.trim() || bowlingSquad.find(f => f.id === selectedFielderId)?.name || 'Fielder'})`}
                      {wicketType === 'STUMPED' && `st †${customFielderName.trim() || bowlingSquad.find(f => f.id === selectedFielderId)?.name || 'Keeper'} b ${bowler?.name || 'Bowler'}`}
                      {wicketType === 'HIT_WICKET' && `hit wicket b ${bowler?.name || 'Bowler'}`}
                      {wicketType === 'RETIRED_HURT' && 'retired hurt (not out)'}
                      {wicketType === 'RETIRED_OUT' && 'retired out'}
                      {wicketType === 'OBSTRUCTING_FIELD' && 'obstructing the field'}
                      {wicketType === 'HIT_BALL_TWICE' && 'hit the ball twice'}
                      {wicketType === 'TIMED_OUT' && 'timed out'}
                    </Text>
                    {wickets + 1 < 10 && (
                      <Text style={styles.previewNextBatterText}>
                        Incoming Batter:{' '}
                        <Text style={{ fontWeight: 'bold', color: (customBatterName.trim() || selectedBatterObj?.name) ? '#b45309' : '#dc2626' }}>
                          {customBatterName.trim() || selectedBatterObj?.name || '⚠️ Not selected (Required)'}
                        </Text>
                      </Text>
                    )}
                  </View>

                  {/* ACTIONS */}
                  <View style={[styles.modalActions, { marginTop: 14 }]}>
                    <TouchableOpacity
                      style={styles.modalCancelBtn}
                      onPress={() => setWicketStep(1)}
                    >
                      <Text style={styles.modalCancelText}>← Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.modalConfirmBtn,
                        { backgroundColor: wicketType === 'RETIRED_HURT' ? '#2563eb' : '#dc2626' },
                        (wickets + 1 < 10 && !selectedNextBatterId && !customBatterName.trim()) && styles.btnDisabled
                      ]}
                      disabled={wickets + 1 < 10 && !selectedNextBatterId && !customBatterName.trim()}
                      onPress={confirmNextBatter}
                    >
                      <Text style={styles.modalConfirmText}>
                        {wicketType === 'RETIRED_HURT' ? 'Confirm Retired Hurt (Not Out)' : 'Confirm & Record Wicket'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* RETROACTIVE DELIVERY CORRECTION MODAL (Edit Mode Direct Ball Edit) */}
      <Modal
        visible={showEditDeliveryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditDeliveryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editDeliveryModalContainer}>
            <View style={styles.editDeliveryModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.editDeliveryModalTitle}>✏️ Direct Ball Correction</Text>
                <Text style={styles.editDeliveryModalSub}>
                  Modify runs, extras, or wicket retroactively
                </Text>
              </View>
              <TouchableOpacity
                style={styles.redCloseBtn}
                onPress={() => setShowEditDeliveryModal(false)}
              >
                <Text style={styles.redCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {editingDelivery && (
              <ScrollView style={styles.editDeliveryModalBody}>
                <View style={styles.editDeliveryInfoBox}>
                  <Text style={styles.editDeliveryInfoText}>
                    Ball: <Text style={{ fontWeight: 'bold', color: '#b45309' }}>{editingDelivery.ball}</Text> • Current Recorded: <Text style={{ fontWeight: 'bold' }}>{editingDelivery.text}</Text>
                  </Text>
                  {editingDelivery.commentary ? (
                    <Text style={styles.editDeliveryCommentaryText}>{editingDelivery.commentary}</Text>
                  ) : null}
                </View>

                {/* RUNS PICKER */}
                <Text style={styles.editSectionLabel}>Runs Scored by Batter:</Text>
                <View style={styles.editRunsRow}>
                  {[0, 1, 2, 3, 4, 5, 6].map((r) => (
                    <TouchableOpacity
                      key={`edit-run-${r}`}
                      style={[
                        styles.editRunChip,
                        editRunsInput === r && styles.editRunChipActive
                      ]}
                      onPress={() => setEditRunsInput(r)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.editRunChipText,
                          editRunsInput === r && styles.editRunChipTextActive
                        ]}
                      >
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* EXTRAS PICKER */}
                <Text style={styles.editSectionLabel}>Extras Classification:</Text>
                <View style={styles.editExtrasRow}>
                  {[
                    { id: 'NONE', label: 'None (Legal Ball)' },
                    { id: 'WIDE', label: 'Wide (+1)' },
                    { id: 'NO_BALL', label: 'No Ball (+1)' },
                    { id: 'BYE', label: 'Bye' },
                    { id: 'LEG_BYE', label: 'Leg Bye' }
                  ].map((ext) => (
                    <TouchableOpacity
                      key={`edit-extra-${ext.id}`}
                      style={[
                        styles.editExtraChip,
                        editExtraType === ext.id && styles.editExtraChipActive
                      ]}
                      onPress={() => setEditExtraType(ext.id as any)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.editExtraChipText,
                          editExtraType === ext.id && styles.editExtraChipTextActive
                        ]}
                      >
                        {ext.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* WICKET TOGGLE */}
                <Text style={styles.editSectionLabel}>Wicket / Dismissal Status:</Text>
                <View style={styles.editWicketToggleRow}>
                  <TouchableOpacity
                    style={[styles.editWicketToggleBtn, !editWicket && styles.editWicketToggleBtnActive]}
                    onPress={() => setEditWicket(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.editWicketToggleBtnText, !editWicket && styles.editWicketToggleBtnTextActive]}>
                      ✓ Not Out (No Wicket)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.editWicketToggleBtn, editWicket && styles.editWicketToggleBtnWicketActive]}
                    onPress={() => setEditWicket(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.editWicketToggleBtnText, editWicket && styles.editWicketToggleBtnTextWicketActive]}>
                      ⚡ Wicket Fallen
                    </Text>
                  </TouchableOpacity>
                </View>

                {editWicket && (
                  <View style={styles.editWicketTypeGrid}>
                    {['BOWLED', 'CAUGHT', 'LBW', 'RUN_OUT', 'STUMPED', 'HIT_WICKET'].map((wt) => (
                      <TouchableOpacity
                        key={`wt-${wt}`}
                        style={[
                          styles.editWicketTypeChip,
                          editWicketType === wt && styles.editWicketTypeChipActive
                        ]}
                        onPress={() => setEditWicketType(wt)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.editWicketTypeChipText,
                            editWicketType === wt && styles.editWicketTypeChipTextActive
                          ]}
                        >
                          {wt.replace('_', ' ')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* ACTIONS */}
                <View style={styles.editDeliveryActionRow}>
                  <TouchableOpacity
                    style={styles.editDeliveryCancelBtn}
                    onPress={() => setShowEditDeliveryModal(false)}
                    disabled={isSubmittingEditDelivery}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.editDeliveryCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editDeliverySaveBtn}
                    onPress={handleSaveDeliveryEdit}
                    disabled={isSubmittingEditDelivery}
                    activeOpacity={0.8}
                  >
                    {isSubmittingEditDelivery ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.editDeliverySaveBtnText}>💾 Save Ball Correction</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* CRICKET MILESTONE CELEBRATION MODAL (50s, 100s, 5-Wickets, Hat-Tricks) */}
      <Modal
        visible={showMilestoneModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMilestoneModal(false)}
      >
        <View style={styles.milestoneModalOverlay}>
          {/* Falling 3D Confetti Ribbons / Colour Papers */}
          <CricketConfetti active={showMilestoneModal} count={60} />

          <View style={styles.milestoneCard}>
            {/* Top Ribbon */}
            <View style={styles.milestoneRibbon}>
              <Text style={styles.milestoneRibbonText}>{activeMilestone?.badge || '🏆 MILESTONE REACHED 🏆'}</Text>
            </View>

            {/* 3D FIGURINE & METALLIC PEDESTAL (Drop-Down 3D Slam & Interactive Tilt) */}
            <CricketFigurine3D
              imageSource={
                activeMilestone?.imageKey === 'MOTM' || activeMilestone?.type === 'MAN_OF_THE_MATCH'
                  ? IMG_MAN_OF_THE_MATCH
                  : activeMilestone?.imageKey === 'BOWLER' || activeMilestone?.type === 'BOWLER_3W' || activeMilestone?.type === 'BOWLER_5W'
                    ? bestBowlerImage
                    : activeMilestone?.imageKey === 'CATCH' || activeMilestone?.type === 'TOP_CATCHES'
                      ? catchMilestoneImage
                      : activeMilestone?.imageKey === 'RUN_OUT' || activeMilestone?.type === 'RUN_OUT'
                        ? runOutMilestoneImage
                        : activeMilestone?.imageKey === 'KEEPER' || activeMilestone?.type === 'KEEPER_OUT'
                          ? keeperDismissalImage
                          : activeMilestone?.type === 'BATTER_200'
                            ? doubleCenturyImage
                            : activeMilestone?.type === 'TEAM_50'
                              ? team50Image
                              : activeMilestone?.type === 'TEAM_100' || activeMilestone?.type === 'TEAM_200'
                                ? team100Image
                                : activeMilestone?.type === 'BATTER_100'
                                  ? centuryBatsmanImage
                                  : milestoneBatsmanImage
              }
              playerName={activeMilestone?.playerName || 'CHAMPION'}
              badgeText={activeMilestone?.badge || activeMilestone?.title || '50 RUNS'}
              teamName={activeMilestone?.teamName}
              milestoneTitle={activeMilestone?.title}
              scoreText={activeMilestone?.scoreText}
              ballsText={activeMilestone?.ballsText}
              strikeRateText={activeMilestone?.strikeRateText}
              fours={activeMilestone?.fours}
              sixes={activeMilestone?.sixes}
            />

            {/* Details Box */}
            <View style={styles.milestoneContentBox}>
              <Text style={styles.milestoneTitleText}>{activeMilestone?.title || 'HALF-CENTURY!'}</Text>
              <Text style={styles.milestonePlayerName}>{activeMilestone?.playerName?.toUpperCase()}</Text>
              <Text style={styles.milestoneTeamName}>{activeMilestone?.teamName?.toUpperCase()}</Text>

              {/* Stat Pillars */}
              <View style={styles.milestoneStatsBox}>
                <View style={styles.milestoneStatItem}>
                  <Text style={styles.milestoneStatValue}>{activeMilestone?.scoreText}</Text>
                  <Text style={styles.milestoneStatLabel}>SCORE</Text>
                </View>
                <View style={styles.milestoneStatDivider} />
                <View style={styles.milestoneStatItem}>
                  <Text style={styles.milestoneStatValue}>{activeMilestone?.ballsText}</Text>
                  <Text style={styles.milestoneStatLabel}>BALLS</Text>
                </View>
                {activeMilestone?.strikeRateText ? (
                  <>
                    <View style={styles.milestoneStatDivider} />
                    <View style={styles.milestoneStatItem}>
                      <Text style={styles.milestoneStatValue}>{activeMilestone?.strikeRateText}</Text>
                      <Text style={styles.milestoneStatLabel}>STRIKE RATE</Text>
                    </View>
                  </>
                ) : null}
              </View>

              {/* Boundary Pill (Fours & Sixes) */}
              {(activeMilestone?.fours !== undefined || activeMilestone?.sixes !== undefined) && (
                <View style={styles.milestoneBoundariesRow}>
                  <View style={styles.milestoneBoundaryTag}>
                    <Text style={styles.milestoneBoundaryTagText}>🏏 {activeMilestone?.fours || 0} Fours (4s)</Text>
                  </View>
                  <View style={[styles.milestoneBoundaryTag, styles.milestoneSixTag]}>
                    <Text style={styles.milestoneBoundaryTagText}>🚀 {activeMilestone?.sixes || 0} Sixes (6s)</Text>
                  </View>
                </View>
              )}

              <Text style={styles.milestoneSubtitle}>{activeMilestone?.subtitle}</Text>
            </View>

            {/* Action Button */}
            <TouchableOpacity
              style={styles.milestoneDismissBtn}
              onPress={() => setShowMilestoneModal(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.milestoneDismissBtnText}>CONTINUE LIVE SCORING ▶</Text>
            </TouchableOpacity>

            {/* Close Cross */}
            <TouchableOpacity
              style={styles.milestoneCloseCross}
              onPress={() => setShowMilestoneModal(false)}
            >
              <Text style={styles.milestoneCloseCrossText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Smart Cricket Rule & Umpire Assistant Modal */}
      <CricketRulesModal
        visible={showCricketRulesModal}
        activeRule={activeCricketRule}
        matchId={matchId}
        ruleContext={{
          ...cricketRuleContext,
          bowlerId: bowler?.id,
          bowlerName: bowler?.name,
          strikerName: striker?.name,
          nonStrikerName: nonStriker?.name,
          oversBowled: bowler ? `${bowler.overs}` : '0.0',
          maxQuota: 4,
          overNumber: Math.floor(balls / 6) + 1,
          totalRuns: runs,
          wickets: wickets,
          currentFormat: matchInfo?.overs ? `T20 (${matchInfo.overs}.0 Overs)` : 'T20 (20.0 Overs)'
        }}
        onClose={() => setShowCricketRulesModal(false)}
        onApplyRule={async (ruleType, payload) => {
          if (ruleType === 'RUN_OUT' || ruleType === 'RUN_OUT_CROSS') {
            if (payload?.victim) {
              setDismissedTarget(payload.victim === 'NON_STRIKER' ? 'nonStriker' : 'striker');
            }
          }
          await loadLiveState(false);
          setShowCricketRulesModal(false);
        }}
      />

      {/* DLS & VJD Rain Target Engine & Predictor Modal */}
      <Modal
        visible={showDlsModal && !dlsModalMinimized}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowDlsModal(false);
          setDlsModalMinimized(false);
          setDlsModalMaximized(false);
        }}
      >
        <View style={styles.dlsModalOverlay}>
          <View style={[
            styles.dlsModalCard,
            isDesktop ? styles.dlsModalCardDesktop : styles.dlsModalCardMobile,
            dlsModalMaximized && styles.dlsModalCardMaximized
          ]}>
            <View style={styles.dlsModalTopBar}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={styles.dlsModalHeaderIconBox}>
                  <Text style={{ fontSize: 20 }}>🧮</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dlsModalTitle}>DLS & VJD Rain Target Engine</Text>
                  <Text style={styles.dlsModalSub} numberOfLines={1}>
                    Live Match Arbitrator • Duckworth-Lewis-Stern & V. Jayadevan Methods
                  </Text>
                </View>
              </View>

              {/* Window Controls: Minimize (-), Maximize (🗖), and Red Close (✕) */}
              <View style={styles.dlsWindowControlsRow}>
                {/* Minimize Button: Yellow Circle */}
                <TouchableOpacity
                  style={[styles.dlsWindowBtn, styles.dlsMinimizeBtn]}
                  onPress={() => setDlsModalMinimized(true)}
                  activeOpacity={0.7}
                  accessibilityLabel="Minimize DLS Engine"
                >
                  <Text style={styles.dlsMinimizeText}>—</Text>
                </TouchableOpacity>

                {/* Maximize / Restore Button: Blue Circle */}
                <TouchableOpacity
                  style={[styles.dlsWindowBtn, styles.dlsMaximizeBtn]}
                  onPress={() => setDlsModalMaximized(prev => !prev)}
                  activeOpacity={0.7}
                  accessibilityLabel="Maximize / Restore DLS Engine"
                >
                  <Text style={styles.dlsMaximizeText}>{dlsModalMaximized ? '🗗' : '🗖'}</Text>
                </TouchableOpacity>

                {/* Close Button: Red Circle */}
                <TouchableOpacity
                  style={[styles.dlsWindowBtn, styles.dlsCloseBtn]}
                  onPress={() => {
                    setShowDlsModal(false);
                    setDlsModalMinimized(false);
                    setDlsModalMaximized(false);
                  }}
                  activeOpacity={0.7}
                  accessibilityLabel="Close DLS Engine"
                >
                  <Text style={styles.dlsCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              style={{ flex: 1, width: '100%' }}
              contentContainerStyle={{ padding: isDesktop ? 18 : 10, paddingBottom: 40, flexGrow: 1 }}
              showsVerticalScrollIndicator={true}
            >
              <CalculationSettingsManagement
                initialTeam1Score={String(matchInfo?.target ? matchInfo.target - 1 : (matchInfo?.currentInningsNumber === 2 ? 178 : runs || 178))}
                initialTeam1Overs={String(matchInfo?.overs || 20)}
                initialTeam2TargetOvers={String(matchInfo?.revisedOvers || matchInfo?.overs || 20)}
                initialCurrentOvers={`${Math.floor(balls / 6)}.${balls % 6}`}
                initialCurrentWickets={wickets || 0}
                initialCurrentScore={String(runs || 0)}
                isModal={true}
                onClose={() => {
                  setShowDlsModal(false);
                  setDlsModalMinimized(false);
                  setDlsModalMaximized(false);
                }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Minimized Floating Dock Widget for DLS */}
      {showDlsModal && dlsModalMinimized && (
        <View style={styles.dlsMinimizedDock}>
          <TouchableOpacity
            style={styles.dlsMinimizedTouchArea}
            onPress={() => setDlsModalMinimized(false)}
            activeOpacity={0.85}
          >
            <View style={styles.dlsMinimizedPulseDot} />
            <Text style={styles.dlsMinimizedTitle}>🧮 DLS Target Arbitrator</Text>
            <View style={styles.dlsMinimizedBadge}>
              <Text style={styles.dlsMinimizedBadgeText}>Active</Text>
            </View>
            <Text style={styles.dlsMinimizedRestoreText}>🗖 Restore</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dlsMinimizedCloseBtn}
            onPress={() => {
              setShowDlsModal(false);
              setDlsModalMinimized(false);
              setDlsModalMaximized(false);
            }}
          >
            <Text style={styles.dlsMinimizedCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const getStyles = (isDesktop: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    centerBox: {
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24
    },
    loadingTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#1e293b',
      marginTop: 16
    },
    loadingSubtitle: {
      fontSize: 13,
      color: '#64748b',
      marginTop: 6,
      textAlign: 'center'
    },
    errorCard: {
      backgroundColor: '#ffffff',
      borderRadius: 8,
      padding: 24,
      borderWidth: 1,
      borderColor: '#fca5a5',
      maxWidth: 460,
      width: '100%',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3
    },
    errorTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#b91c1c',
      marginBottom: 8
    },
    errorMessage: {
      fontSize: 13,
      color: '#475569',
      textAlign: 'center',
      marginBottom: 20
    },
    errorBtnRow: {
      flexDirection: 'row',
      gap: 12
    },
    retryBtn: {
      backgroundColor: '#b45309',
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 6
    },
    retryBtnText: {
      color: '#ffffff',
      fontWeight: 'bold',
      fontSize: 13
    },
    backDashboardBtn: {
      backgroundColor: '#f1f5f9',
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#cbd5e1'
    },
    backDashboardBtnText: {
      color: '#334155',
      fontWeight: 'bold',
      fontSize: 13
    },

    header: {
      paddingVertical: isDesktop ? 10 : 6,
      paddingHorizontal: isDesktop ? 20 : 8,
      backgroundColor: '#071026',
      borderBottomWidth: 2,
      borderBottomColor: '#d97706',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
      minHeight: isDesktop ? 54 : 42
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      minWidth: 0,
      marginRight: 6
    },
    headerLogo: {
      width: isDesktop ? 36 : 26,
      height: isDesktop ? 36 : 26
    },
    headerTitleMain: {
      color: '#ffffff',
      fontSize: isDesktop ? 13 : 11,
      fontWeight: '800',
      letterSpacing: 0.5
    },
    headerTitleSub: {
      color: '#fef3c7',
      fontSize: 10,
      marginTop: 1,
      fontWeight: '600'
    },
    hamburgerBtn: {
      padding: isDesktop ? 6 : 4,
      marginRight: 6,
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
      borderRadius: 6
    },
    hamburgerIcon: {
      color: '#f59e0b',
      fontSize: isDesktop ? 18 : 16,
      fontWeight: 'bold'
    },
    headerMatchesBtn: {
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      paddingHorizontal: isDesktop ? 10 : 8,
      paddingVertical: isDesktop ? 6 : 4,
      borderRadius: 6,
      marginRight: 6,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.25)'
    },
    headerMatchesBtnText: {
      color: '#fef3c7',
      fontSize: isDesktop ? 12 : 11,
      fontWeight: '700'
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6
    },
    userBadgePill: {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
      maxWidth: isDesktop ? 260 : 130
    },
    userBadgePillText: {
      color: '#e2e8f0',
      fontSize: 11,
      fontWeight: '600'
    },
    headerExitBtn: {
      backgroundColor: '#dc2626',
      paddingHorizontal: isDesktop ? 12 : 8,
      paddingVertical: isDesktop ? 6 : 3,
      borderRadius: 20,
      marginLeft: 4
    },
    headerExitBtnText: {
      color: '#ffffff',
      fontSize: isDesktop ? 11 : 10,
      fontWeight: '700'
    },
    backBtn: {
      marginRight: 16,
      padding: 8,
      backgroundColor: '#f1f5f9',
      borderRadius: 4,
      borderWidth: 1,
      borderColor: '#e2e8f0'
    },
    backText: { color: '#334155', fontWeight: 'bold', fontSize: 12 },
    title: { color: '#1e293b', fontSize: 16, fontWeight: 'bold' },
    subtitle: { color: '#64748b', fontSize: 12, marginTop: 2 },
    liveBadge: {
      backgroundColor: '#fef2f2',
      borderColor: '#fca5a5',
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 4
    },
    liveBadgeText: {
      color: '#ef4444',
      fontWeight: 'bold',
      fontSize: 11,
      letterSpacing: 1
    },
    breakBadge: {
      backgroundColor: '#fef3c7',
      borderColor: '#fde68a'
    },
    breakBadgeText: {
      color: '#b45309'
    },
    completedBadge: {
      backgroundColor: '#f0fdf4',
      borderColor: '#86efac'
    },
    completedBadgeText: {
      color: '#16a34a'
    },

    // ─────────────────────────────────────────────────────────────
    // APP BODY ROW & DESKTOP SIDEBAR (Image 1 Style)
    // ─────────────────────────────────────────────────────────────
    appBodyRow: {
      flex: 1,
      flexDirection: 'row',
      width: '100%',
      backgroundColor: '#f8f6f0'
    },
    desktopSidebar: {
      width: 230,
      backgroundColor: '#ffffff',
      borderRightWidth: 1.5,
      borderRightColor: '#fde68a',
      paddingVertical: 14,
      paddingHorizontal: 10,
      justifyContent: 'space-between'
    },
    desktopSidebarCollapsed: {
      width: 68,
      paddingHorizontal: 6
    },
    sidebarProfileBox: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
      borderRadius: 10,
      backgroundColor: '#fefce8',
      borderWidth: 1,
      borderColor: '#fef08a',
      marginBottom: 14
    },
    sidebarAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#071026',
      borderWidth: 2,
      borderColor: '#f59e0b',
      alignItems: 'center',
      justifyContent: 'center'
    },
    sidebarAvatarText: {
      color: '#f59e0b',
      fontSize: 15,
      fontWeight: '900'
    },
    sidebarName: {
      color: '#0f172a',
      fontSize: 13,
      fontWeight: '800'
    },
    sidebarRole: {
      color: '#64748b',
      fontSize: 10,
      fontWeight: '600'
    },
    sidebarOfficialPill: {
      backgroundColor: '#fef3c7',
      borderWidth: 1,
      borderColor: '#f59e0b',
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
      marginTop: 3,
      alignSelf: 'flex-start'
    },
    sidebarOfficialPillText: {
      color: '#b45309',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.5
    },
    sidebarNavSectionTitle: {
      fontSize: 10,
      fontWeight: '800',
      color: '#94a3b8',
      letterSpacing: 1.2,
      paddingHorizontal: 8,
      marginBottom: 8
    },
    sidebarNavScroll: {
      flex: 1
    },
    sidebarNavItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 9,
      paddingHorizontal: 10,
      borderRadius: 8,
      marginBottom: 3,
      backgroundColor: 'transparent'
    },
    sidebarNavItemActive: {
      backgroundColor: '#d97706',
      shadowColor: '#d97706',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 2
    },
    sidebarNavItemCollapsed: {
      justifyContent: 'center',
      paddingHorizontal: 4
    },
    sidebarNavItemEditActive: {
      backgroundColor: '#fef3c7',
      borderWidth: 1,
      borderColor: '#d97706'
    },
    sidebarNavIcon: {
      fontSize: 15,
      marginRight: 10
    },
    sidebarNavText: {
      color: '#334155',
      fontSize: 12,
      fontWeight: '600'
    },
    sidebarNavTextActive: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '800'
    },
    sidebarBadgeBlue: {
      backgroundColor: '#dbeafe',
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 2
    },
    sidebarBadgeBlueText: {
      color: '#1d4ed8',
      fontSize: 9,
      fontWeight: '800'
    },
    sidebarBadgeOrange: {
      backgroundColor: '#ffedd5',
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 2
    },
    sidebarBadgeOrangeText: {
      color: '#c2410c',
      fontSize: 9,
      fontWeight: '800'
    },
    sidebarBadgeYellow: {
      backgroundColor: '#fef08a',
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 2
    },
    sidebarBadgeYellowText: {
      color: '#854d0e',
      fontSize: 9,
      fontWeight: '800'
    },
    sidebarBottomArea: {
      borderTopWidth: 1,
      borderTopColor: '#f1f5f9',
      paddingTop: 10,
      gap: 6
    },
    sidebarLogoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#fca5a5',
      backgroundColor: '#fff5f5'
    },
    sidebarLogoutIcon: {
      color: '#dc2626',
      fontSize: 13,
      marginRight: 6,
      fontWeight: 'bold'
    },
    sidebarLogoutText: {
      color: '#dc2626',
      fontSize: 11,
      fontWeight: '700'
    },
    sidebarCollapseBtn: {
      alignItems: 'center',
      paddingVertical: 6
    },
    sidebarCollapseText: {
      color: '#94a3b8',
      fontSize: 10,
      fontWeight: '600'
    },

    // Main Content Area
    mainContentScroll: {
      flex: 1,
      width: '100%',
      backgroundColor: '#f8f6f0'
    },
    scroll: { flexGrow: 1 },
    mainLayout: {
      flex: 1,
      width: '100%',
      padding: isDesktop ? 22 : 6,
      justifyContent: 'space-between'
    },

    inningsBreakBanner: {
      backgroundColor: '#fffbeb',
      borderWidth: 1,
      borderColor: '#fde68a',
      borderRadius: 8,
      padding: 16,
      marginBottom: 16,
      flexDirection: isDesktop ? 'row' : 'column',
      alignItems: isDesktop ? 'center' : 'stretch',
      justifyContent: 'space-between',
      gap: 12
    },
    inningsBreakTitle: {
      color: '#92400e',
      fontWeight: 'bold',
      fontSize: 14,
      marginBottom: 4
    },
    inningsBreakSub: {
      color: '#78350f',
      fontSize: 12,
      lineHeight: 16
    },
    startInningsBtn: {
      backgroundColor: '#b45309',
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center'
    },
    startInningsBtnText: {
      color: '#ffffff',
      fontWeight: 'bold',
      fontSize: 13
    },

    championsCelebrationCard: {
      backgroundColor: '#0a192f',
      borderRadius: 16,
      borderWidth: 2,
      borderColor: '#f59e0b',
      overflow: 'hidden',
      marginBottom: 20,
      shadowColor: '#f59e0b',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 8
    },
    championTopHeader: {
      backgroundColor: '#172554',
      paddingVertical: 10,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(245, 158, 11, 0.3)'
    },
    championPulsingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#f59e0b'
    },
    championTopHeaderText: {
      color: '#fef08a',
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1.2,
      textTransform: 'uppercase'
    },
    championCardBody: {
      flexDirection: isDesktop ? 'row' : 'column',
      padding: isDesktop ? 22 : 16,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20
    },
    championArtworkWrapper: {
      width: isDesktop ? 280 : '100%',
      minHeight: 220,
      borderRadius: 16,
      overflow: 'visible',
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: 'rgba(245, 158, 11, 0.4)'
    },
    championImage: {
      width: '100%',
      height: '100%'
    },
    championDetailsCol: {
      flex: 1,
      width: '100%',
      minWidth: isDesktop ? 280 : undefined,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8
    },
    crownContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 4
    },
    crownGlow: {
      fontSize: 18,
      color: '#fbbf24'
    },
    crownCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: 'rgba(245, 158, 11, 0.2)',
      borderWidth: 2,
      borderColor: '#fbbf24',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#fbbf24',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 10,
      elevation: 6
    },
    crownEmoji: {
      fontSize: 28
    },
    championKiritamLabel: {
      color: '#93c5fd',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginTop: 6,
      marginBottom: 4
    },
    championTeamName: {
      color: '#ffffff',
      fontSize: isDesktop ? 26 : 22,
      fontWeight: '900',
      textAlign: 'center',
      letterSpacing: 0.5,
      textShadowColor: 'rgba(245, 158, 11, 0.6)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 10,
      marginBottom: 8
    },
    winMarginChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#065f46',
      borderWidth: 1.5,
      borderColor: '#34d399',
      paddingVertical: 6,
      paddingHorizontal: 16,
      borderRadius: 20,
      gap: 6,
      marginBottom: 10,
      shadowColor: '#059669',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 3
    },
    winMarginTrophy: {
      fontSize: 15
    },
    winMarginText: {
      color: '#ecfdf5',
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.3
    },
    championFullSummary: {
      color: '#cbd5e1',
      fontSize: 13,
      fontStyle: 'italic',
      textAlign: 'center',
      marginBottom: 8
    },
    championTournamentRow: {
      marginBottom: 12
    },
    championTournamentText: {
      color: '#94a3b8',
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center'
    },
    championActionsRow: {
      flexDirection: 'row',
      gap: 10,
      flexWrap: 'wrap',
      justifyContent: 'center'
    },
    viewScorecardBtn: {
      backgroundColor: '#d97706',
      paddingVertical: 9,
      paddingHorizontal: 20,
      borderRadius: 8,
      shadowColor: '#d97706',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 3
    },
    viewScorecardBtnText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '800'
    },
    blastConfettiBtn: {
      backgroundColor: '#7c3aed',
      paddingVertical: 9,
      paddingHorizontal: 16,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1.5,
      borderColor: '#a78bfa',
      shadowColor: '#8b5cf6',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 3
    },
    blastConfettiBtnText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '800'
    },

    matchEndedBanner: {
      backgroundColor: '#f0fdf4',
      borderWidth: 1,
      borderColor: '#86efac',
      borderRadius: 8,
      padding: 16,
      marginBottom: 16,
      alignItems: 'center'
    },
    matchEndedTitle: {
      color: '#166534',
      fontWeight: 'bold',
      fontSize: 14,
      marginBottom: 4
    },
    matchEndedSub: {
      color: '#15803d',
      fontSize: 13,
      fontWeight: '600'
    },

    overCompleteBanner: {
      backgroundColor: '#fef3c7',
      borderWidth: 1,
      borderColor: '#fde68a',
      borderRadius: 6,
      padding: 12,
      marginBottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    overCompleteText: {
      color: '#92400e',
      fontWeight: 'bold',
      fontSize: 13,
      flex: 1,
      marginRight: 12
    },
    openBowlerBtn: {
      backgroundColor: '#d97706',
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 4
    },
    openBowlerBtnText: {
      color: '#ffffff',
      fontWeight: 'bold',
      fontSize: 12
    },

    // TOP SECTION
    topSection: {
      flexDirection: isDesktop ? 'row' : 'column',
      gap: isDesktop ? 16 : 4,
      marginBottom: isDesktop ? 16 : 4
    },
    previousInningsBanner: {
      backgroundColor: '#fef3c7',
      borderColor: '#fde68a',
      borderWidth: 1,
      borderRadius: 6,
      paddingVertical: 2,
      paddingHorizontal: 6,
      marginBottom: isDesktop ? 8 : 2,
      alignSelf: 'center'
    },
    previousInningsText: {
      fontSize: isDesktop ? 12 : 10.5,
      color: '#92400e',
      fontWeight: '600'
    },
    previousInningsBold: {
      fontWeight: 'bold',
      color: '#b45309'
    },
    scoreBoardCard: {
      flex: isDesktop ? 1 : undefined,
      backgroundColor: '#ffffff',
      padding: isDesktop ? 20 : 6,
      borderRadius: isDesktop ? 12 : 8,
      borderWidth: 1.5,
      borderColor: '#fde68a',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#d97706',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 5,
      elevation: 2
    },
    battingTeam: {
      color: '#005960',
      fontSize: isDesktop ? 13 : 10.5,
      fontWeight: 'bold',
      marginBottom: isDesktop ? 6 : 2,
      textTransform: 'uppercase'
    },
    scoreRow: { flexDirection: 'row', alignItems: 'baseline' },
    scoreText: { color: '#0f172a', fontSize: isDesktop ? 48 : 26, fontWeight: 'bold' },
    oversText: {
      color: '#64748b',
      fontSize: isDesktop ? 20 : 15,
      marginLeft: 6,
      fontWeight: '600'
    },
    rrText: { color: '#475569', fontSize: isDesktop ? 13 : 10, marginTop: isDesktop ? 6 : 1, fontWeight: '600' },

    playersContainer: {
      flex: isDesktop ? 1.5 : undefined,
      gap: isDesktop ? 16 : 4,
      justifyContent: 'space-between'
    },
    playerCard: {
      backgroundColor: '#ffffff',
      padding: isDesktop ? 16 : 6,
      borderRadius: isDesktop ? 12 : 8,
      borderWidth: 1.5,
      borderColor: '#fde68a',
      flex: isDesktop ? 1 : undefined,
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2
    },
    playerRole: {
      color: '#64748b',
      fontSize: isDesktop ? 11 : 9.5,
      fontWeight: 'bold',
      marginBottom: isDesktop ? 10 : 2,
      letterSpacing: 1
    },
    playerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: isDesktop ? 6 : 2
    },
    playerName: { color: '#1e293b', fontSize: isDesktop ? 14 : 11.5, fontWeight: '600' },
    striker: { fontWeight: 'bold', color: '#b45309' },
    playerStats: { color: '#1e293b', fontSize: isDesktop ? 14 : 11.5, fontWeight: 'bold' },
    changeBowlerHeaderBtn: {
      backgroundColor: '#e6f4f1',
      borderWidth: 1,
      borderColor: '#005960',
      borderRadius: 14,
      paddingHorizontal: 8,
      paddingVertical: 2
    },
    changeBowlerHeaderBtnText: {
      color: '#005960',
      fontSize: 9.5,
      fontWeight: '800'
    },
    injurySubPill: {
      backgroundColor: '#fef2f2',
      borderWidth: 1,
      borderColor: '#fca5a5',
      borderRadius: 12,
      paddingHorizontal: 7,
      paddingVertical: 2
    },
    injurySubPillText: {
      color: '#b91c1c',
      fontSize: 9.5,
      fontWeight: '800'
    },
    midOverCleanBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fef3c7',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 7,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: '#fde68a'
    },
    midOverCleanBadgeIcon: {
      fontSize: 14,
      marginRight: 6
    },
    midOverCleanBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#92400e'
    },
    situationDropdownTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#cbd5e1',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 9
    },
    situationDropdownTriggerOpen: {
      borderColor: '#005960',
      backgroundColor: '#f0fdfa'
    },
    situationDropdownTriggerText: {
      fontSize: 12.5,
      fontWeight: '600',
      color: '#1e293b'
    },
    situationDropdownMenu: {
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      borderRadius: 8,
      marginTop: 4,
      marginBottom: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.1,
      shadowRadius: 5,
      elevation: 4,
      zIndex: 100
    },
    situationDropdownItem: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderBottomColor: '#f1f5f9'
    },
    situationDropdownItemSelected: {
      backgroundColor: '#f0fdfa'
    },
    situationDropdownItemText: {
      fontSize: 12,
      color: '#334155',
      fontWeight: '500'
    },
    situationDropdownItemTextSelected: {
      color: '#005960',
      fontWeight: '700'
    },
    situationCustomInput: {
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#cbd5e1',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 12,
      color: '#0f172a'
    },

    // AI COMMENTARY CARD
    commentaryCard: {
      backgroundColor: 'rgba(254, 243, 199, 0.75)',
      borderWidth: 1,
      borderColor: '#fde68a',
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2
    },
    commentaryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4
    },
    commentaryTag: {
      fontSize: 10,
      fontWeight: '800',
      color: '#b45309',
      letterSpacing: 0.5
    },
    commentaryPosition: {
      fontSize: 11,
      fontWeight: '700',
      color: '#92400e',
      backgroundColor: '#fef3c7',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4
    },
    commentaryText: {
      fontSize: 13,
      color: '#78350f',
      fontWeight: '500',
      lineHeight: 18
    },

    // BOTTOM SECTION
    controlsSection: {
      flex: 1,
      backgroundColor: '#ffffff',
      borderRadius: isDesktop ? 12 : 8,
      padding: isDesktop ? 20 : 6,
      borderWidth: 1.5,
      borderColor: '#fde68a',
      justifyContent: 'space-between',
      shadowColor: '#d97706',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 3,
      width: '100%',
      maxWidth: '100%',
      alignSelf: 'center'
    },
    controlPanel: { flex: 1, justifyContent: 'center' },
    sectionTitle: {
      color: '#64748b',
      fontSize: 11,
      fontWeight: 'bold',
      marginBottom: 10,
      letterSpacing: 1
    },
    controlsGrid: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
      flexWrap: 'wrap'
    },

    scoreBtn: {
      flex: 1,
      minWidth: 44,
      height: 52,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5
    },
    scoreBtnNormal: {
      backgroundColor: '#ffffff',
      borderColor: '#cbd5e1',
      borderWidth: 1.5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2
    },
    scoreBtnDot: {
      backgroundColor: '#f8fafc',
      borderColor: '#94a3b8',
      borderWidth: 1.5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2
    },
    scoreBtnFour: {
      backgroundColor: '#fef3c7',
      borderColor: '#f59e0b',
      borderWidth: 2,
      shadowColor: '#d4af37',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
      elevation: 3
    },
    scoreBtnSix: {
      backgroundColor: '#fff7ed',
      borderColor: '#ea580c',
      borderWidth: 2,
      shadowColor: '#ea580c',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
      elevation: 3
    },
    wicketBtn: {
      backgroundColor: '#dc2626',
      borderColor: '#b91c1c',
      borderWidth: 1.5,
      shadowColor: '#dc2626',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 3
    },

    scoreBtnText: { fontSize: 20, fontWeight: '900' },
    scoreBtnTextNormal: { color: '#0f172a', fontWeight: '900', fontSize: 22 },
    scoreBtnTextDot: { color: '#475569', fontWeight: '900', fontSize: 22 },
    scoreBtnTextBoundary: { color: '#b45309', fontWeight: '900', fontSize: 22 },
    scoreBtnTextSix: { color: '#c2410c', fontWeight: '900', fontSize: 22 },
    wicketBtnText: { color: '#ffffff', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },

    extrasGrid: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
      flexWrap: 'wrap'
    },
    extraBtn: {
      flex: 1,
      minWidth: 70,
      height: 40,
      borderRadius: 6,
      backgroundColor: '#f1f5f9',
      borderWidth: 1,
      borderColor: '#cbd5e1',
      alignItems: 'center',
      justifyContent: 'center'
    },
    extraBtnText: { fontSize: 13, fontWeight: '600', color: '#334155' },

    fieldingChipsScroll: { gap: 8, paddingBottom: 16 },
    fieldingChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: '#f1f5f9',
      borderWidth: 1,
      borderColor: '#cbd5e1'
    },
    fieldingChipActive: {
      backgroundColor: '#fef3c7',
      borderColor: '#f59e0b'
    },
    fieldingChipText: { fontSize: 12, color: '#475569', fontWeight: '500' },
    fieldingChipTextActive: { color: '#92400e', fontWeight: 'bold' },

    actionPanel: {
      flexDirection: 'row',
      gap: isDesktop ? 10 : 5,
      marginTop: isDesktop ? 10 : 4,
      flexWrap: isDesktop ? 'wrap' : 'nowrap'
    },
    actionBtn: {
      flex: 1,
      minWidth: isDesktop ? 120 : 0,
      height: isDesktop ? 44 : 32,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center'
    },
    undoBtn: { backgroundColor: '#475569' },
    actionBtnText: { fontSize: isDesktop ? 13 : 10.5, fontWeight: 'bold' },
    scorecardBtn: {
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#cbd5e1'
    },
    scorecardBtnText: { fontSize: 13, fontWeight: 'bold', color: '#334155' },
    endBtn: { backgroundColor: '#dc2626' },
    endBtnText: { fontSize: 13, fontWeight: 'bold', color: '#ffffff' },

    btnDisabled: { opacity: 0.45 },

    // MODAL COMMON
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16
    },
    modalScrollOverlay: {
      flexGrow: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 32,
      paddingHorizontal: 16
    },
    modalContent: {
      backgroundColor: '#ffffff',
      borderRadius: 8,
      padding: 24,
      width: '100%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 6
    },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    modalMessage: { fontSize: 14, color: '#64748b', marginTop: 8 },
    modalStatsBox: {
      backgroundColor: '#f8fafc',
      padding: 12,
      borderRadius: 6,
      marginVertical: 16,
      borderWidth: 1,
      borderColor: '#e2e8f0'
    },
    modalStatsText: { fontSize: 14, fontWeight: '600', color: '#334155' },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      marginTop: 8
    },
    modalCancelBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#cbd5e1'
    },
    modalCancelText: { color: '#64748b', fontWeight: 'bold', fontSize: 13 },
    modalConfirmBtn: {
      backgroundColor: '#b45309',
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center'
    },
    modalConfirmText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },

    // END INNINGS MODAL STYLES (CENTERED ARTWORK + TEAM INFO)
    endInningsModalCard: {
      backgroundColor: '#ffffff',
      borderRadius: 16,
      padding: isDesktop ? 24 : 18,
      width: '100%',
      maxWidth: 520,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 12,
      borderWidth: 1,
      borderColor: '#e2e8f0'
    },
    endInningsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12
    },
    endInningsBadge: {
      alignSelf: 'flex-start',
      backgroundColor: '#fef3c7',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      marginBottom: 4,
      borderWidth: 1,
      borderColor: '#fde68a'
    },
    endInningsBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#92400e',
      letterSpacing: 0.5
    },
    endInningsTitle: {
      fontSize: isDesktop ? 20 : 18,
      fontWeight: '800',
      color: '#0f172a'
    },
    endInningsCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#f1f5f9',
      alignItems: 'center',
      justifyContent: 'center'
    },
    endInningsCloseBtnText: {
      fontSize: 15,
      fontWeight: 'bold',
      color: '#64748b'
    },
    endInningsArtworkContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0a192f',
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 16,
      position: 'relative',
      borderWidth: 1.5,
      borderColor: '#f59e0b40',
      shadowColor: '#f59e0b',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8
    },
    endInningsImage: {
      width: '100%',
      height: isDesktop ? 160 : 130,
      maxWidth: 380
    },
    endInningsInningsTag: {
      position: 'absolute',
      bottom: 8,
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: '#f59e0b80'
    },
    endInningsInningsTagText: {
      color: '#fbbf24',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8
    },
    endInningsTeamCard: {
      backgroundColor: '#f8fafc',
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      marginBottom: 14
    },
    endInningsTeamRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: '#e2e8f0'
    },
    endInningsTeamRole: {
      fontSize: 11,
      fontWeight: '700',
      color: '#64748b',
      letterSpacing: 0.6
    },
    endInningsTeamName: {
      fontSize: isDesktop ? 18 : 16,
      fontWeight: '800',
      color: '#0f172a',
      marginTop: 2
    },
    endInningsScoreBadge: {
      alignItems: 'flex-end'
    },
    endInningsScoreNumber: {
      fontSize: isDesktop ? 26 : 22,
      fontWeight: '900',
      color: '#b45309'
    },
    endInningsOversText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#64748b'
    },
    endInningsStatsGrid: {
      flexDirection: isDesktop ? 'row' : 'column',
      alignItems: isDesktop ? 'center' : 'flex-start',
      justifyContent: 'space-between',
      paddingTop: 10,
      gap: 8
    },
    endInningsStatCol: {
      flex: 1
    },
    endInningsStatDivider: {
      width: isDesktop ? 1 : '100%',
      height: isDesktop ? 30 : 1,
      backgroundColor: '#e2e8f0'
    },
    endInningsStatLabel: {
      fontSize: 11,
      color: '#64748b',
      fontWeight: '600'
    },
    endInningsStatValue: {
      fontSize: 13,
      fontWeight: '700',
      color: '#1e293b',
      marginTop: 2
    },
    endInningsConfirmBox: {
      backgroundColor: '#fef2f2',
      borderRadius: 8,
      padding: 12,
      borderLeftWidth: 4,
      borderLeftColor: '#ef4444',
      marginBottom: 16
    },
    endInningsConfirmQuestion: {
      fontSize: 14,
      fontWeight: '700',
      color: '#991b1b'
    },
    endInningsConfirmSub: {
      fontSize: 12,
      color: '#b91c1c',
      marginTop: 2
    },
    endInningsActionsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 12
    },
    endInningsCancelBtn: {
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: '#cbd5e1',
      backgroundColor: '#ffffff'
    },
    endInningsCancelText: {
      color: '#475569',
      fontWeight: '700',
      fontSize: 14
    },
    endInningsConfirmSubmitBtn: {
      backgroundColor: '#b45309',
      paddingVertical: 11,
      paddingHorizontal: 22,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#b45309',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4
    },
    endInningsConfirmSubmitText: {
      color: '#ffffff',
      fontWeight: '800',
      fontSize: 14
    },
    inningsBreakImgWrapper: {
      width: 80,
      height: 56,
      borderRadius: 8,
      backgroundColor: '#0a192f',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#f59e0b50'
    },
    inningsBreakThumbnail: {
      width: '95%',
      height: '95%'
    },
    inningsBreakTeam: {
      fontSize: 15,
      fontWeight: '800',
      color: '#92400e',
      marginTop: 2
    },

    // PENALTY MODAL ENHANCED STYLES
    penaltyTeamRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 6,
      marginBottom: 10
    },
    penaltyTeamCard: {
      flex: 1,
      padding: 10,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: '#e2e8f0',
      backgroundColor: '#f8fafc',
      alignItems: 'center'
    },
    penaltyTeamCardActive: {
      borderColor: '#d97706',
      backgroundColor: '#fffbeb'
    },
    penaltyTeamRoleBadge: {
      fontSize: 10,
      fontWeight: '800',
      color: '#64748b',
      textTransform: 'uppercase',
      letterSpacing: 0.5
    },
    penaltyTeamRoleBadgeActive: {
      color: '#b45309'
    },
    penaltyTeamName: {
      fontSize: 13,
      fontWeight: '800',
      color: '#1e293b',
      marginTop: 2,
      textAlign: 'center'
    },
    penaltyTeamNameActive: {
      color: '#92400e'
    },
    penaltyDropdownTrigger: {
      backgroundColor: '#f8fafc',
      borderWidth: 1.5,
      borderColor: '#cbd5e1',
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4
    },
    penaltyDropdownTriggerActive: {
      borderColor: '#d97706',
      backgroundColor: '#fffbeb'
    },
    penaltyDropdownText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#1e293b',
      flex: 1,
      marginRight: 8
    },
    penaltyDropdownArrow: {
      fontSize: 12,
      color: '#b45309',
      fontWeight: 'bold'
    },
    penaltyDropdownMenu: {
      backgroundColor: '#ffffff',
      borderWidth: 1.5,
      borderColor: '#d97706',
      borderRadius: 8,
      marginTop: 6,
      maxHeight: 180,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5
    },
    penaltyDropdownItem: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#f1f5f9',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    penaltyDropdownItemActive: {
      backgroundColor: '#fef3c7'
    },
    penaltyDropdownItemText: {
      fontSize: 12,
      color: '#334155',
      flex: 1
    },
    penaltyDropdownItemTextActive: {
      fontWeight: 'bold',
      color: '#92400e'
    },
    penaltyInboxNoticeBox: {
      backgroundColor: '#eff6ff',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#bfdbfe',
      padding: 10,
      marginTop: 12,
      marginBottom: 6
    },
    penaltyInboxNoticeTitle: {
      fontSize: 11,
      fontWeight: '800',
      color: '#1e40af',
      marginBottom: 2
    },
    penaltyInboxNoticeText: {
      fontSize: 11,
      color: '#1d4ed8',
      lineHeight: 16
    },

    // BOWLER MODAL STYLES
    bowlerModalHeader: { marginBottom: 14 },
    bowlerBadgeTag: {
      alignSelf: 'flex-start',
      backgroundColor: '#fef3c7',
      borderColor: '#f59e0b',
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      marginBottom: 6
    },
    bowlerBadgeTagText: {
      color: '#b45309',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5
    },
    bowlerModalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    bowlerModalSub: { fontSize: 12, color: '#64748b', marginTop: 4 },
    prevBowlerBanner: {
      backgroundColor: '#f1f5f9',
      borderRadius: 6,
      padding: 10,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: '#e2e8f0'
    },
    prevBowlerBannerLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: '#64748b',
      letterSpacing: 0.5
    },
    prevBowlerBannerName: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#0f172a',
      marginTop: 2
    },
    prevBowlerBannerNote: {
      fontSize: 11,
      color: '#dc2626',
      marginTop: 2,
      fontWeight: '500'
    },
    errorAlertBox: {
      backgroundColor: '#fef2f2',
      borderWidth: 1,
      borderColor: '#fca5a5',
      borderRadius: 6,
      padding: 8,
      marginBottom: 10
    },
    errorAlertText: { color: '#b91c1c', fontSize: 12, fontWeight: '600' },
    selectLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: '#64748b',
      letterSpacing: 0.5,
      marginBottom: 8
    },
    bowlerOption: {
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      borderRadius: 6,
      padding: 10,
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    bowlerOptionSelected: {
      borderColor: '#b45309',
      backgroundColor: '#fffbeb'
    },
    bowlerOptionDisabled: {
      backgroundColor: '#f1f5f9',
      borderColor: '#e2e8f0',
      opacity: 0.55
    },
    radioDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: '#94a3b8',
      marginRight: 6
    },
    radioDotSelected: {
      borderColor: '#b45309',
      backgroundColor: '#b45309'
    },
    radioDotDisabled: {
      borderColor: '#cbd5e1',
      backgroundColor: '#e2e8f0'
    },
    bowlerOptionName: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
    bowlerOptionNameDisabled: { color: '#94a3b8' },
    bowlerRoleBadge: {
      fontSize: 10,
      fontWeight: '700',
      color: '#64748b',
      backgroundColor: '#e2e8f0',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 3
    },
    bowlerStatsRow: { marginTop: 3, marginLeft: 20 },
    bowlerStatsText: { fontSize: 11, color: '#64748b' },
    ineligibleBadge: {
      backgroundColor: '#fee2e2',
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: '#fca5a5'
    },
    ineligibleBadgeText: { fontSize: 10, fontWeight: '700', color: '#dc2626' },

    // WICKET MODAL
    wicketModalHeader: { marginBottom: 12 },
    wicketModalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    wicketModalSub: { fontSize: 12, color: '#64748b', marginTop: 4 },
    dismissedBanner: {
      backgroundColor: '#fef2f2',
      padding: 10,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#fca5a5',
      marginBottom: 12
    },
    dismissedLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: '#991b1b',
      letterSpacing: 0.5
    },
    dismissedValue: {
      fontSize: 13,
      fontWeight: 'bold',
      color: '#7f1d1d',
      marginTop: 2
    },
    batterOption: {
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      borderRadius: 6,
      padding: 10,
      marginBottom: 6,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    batterOptionSelected: {
      borderColor: '#b45309',
      backgroundColor: '#fffbeb'
    },
    batterOptionName: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
    batterOptionNameSelected: { color: '#b45309', fontWeight: 'bold' },
    batterOptionRole: { fontSize: 11, color: '#64748b' },
    customNameInput: {
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#cbd5e1',
      borderRadius: 6,
      padding: 10,
      fontSize: 13,
      color: '#1e293b'
    },
    customNameInputActive: {
      borderColor: '#b45309',
      backgroundColor: '#fffbeb'
    },
    searchBarWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#f1f5f9',
      borderWidth: 1,
      borderColor: '#cbd5e1',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 7,
      marginBottom: 8
    },
    searchBarIcon: {
      fontSize: 13,
      marginRight: 6
    },
    searchBarInput: {
      flex: 1,
      fontSize: 13,
      color: '#1e293b',
      padding: 0
    },
    searchClearBtn: {
      paddingHorizontal: 6,
      paddingVertical: 2
    },
    searchClearBtnText: {
      fontSize: 12,
      color: '#64748b',
      fontWeight: 'bold'
    },
    squadScrollView: {
      maxHeight: 180,
      marginBottom: 6
    },
    emptySquadBox: {
      backgroundColor: '#f8fafc',
      padding: 14,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      marginBottom: 8,
      alignItems: 'center'
    },
    emptySquadText: {
      fontSize: 12,
      color: '#64748b',
      textAlign: 'center',
      lineHeight: 18
    },
    manualEntryWrapper: {
      marginTop: 4,
      marginBottom: 6
    },
    manualDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 8
    },
    manualDividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: '#e2e8f0'
    },
    manualDividerText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#94a3b8',
      marginHorizontal: 8,
      letterSpacing: 0.5
    },
    manualConfirmedHint: {
      fontSize: 11,
      color: '#b45309',
      marginTop: 4,
      marginLeft: 2
    },
    previewNextBatterText: {
      fontSize: 12,
      color: '#475569',
      marginTop: 4,
      borderTopWidth: 1,
      borderTopColor: '#e2e8f0',
      paddingTop: 4
    },
    // Enhanced Scorer Page Styles
    sectionTitleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10
    },
    customRunsBadgeBtn: {
      backgroundColor: '#fef3c7',
      borderColor: '#f59e0b',
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6
    },
    customRunsBadgeText: {
      color: '#b45309',
      fontSize: 11,
      fontWeight: 'bold'
    },
    scoreBtnFive: {
      backgroundColor: '#fef3c7',
      borderColor: '#fcd34d'
    },
    scoreBtnTextFive: {
      color: '#b45309'
    },
    lastWicketChip: {
      backgroundColor: '#fee2e2',
      borderWidth: 1,
      borderColor: '#fca5a5',
      borderRadius: 6,
      padding: 6,
      marginTop: 8
    },
    lastWicketTag: {
      fontSize: 9,
      fontWeight: '800',
      color: '#b91c1c',
      letterSpacing: 0.5
    },
    lastWicketText: {
      fontSize: 11,
      fontWeight: 'bold',
      color: '#991b1b',
      marginTop: 2
    },
    customRunChipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 8
    },
    customRunChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 6,
      backgroundColor: '#f1f5f9',
      borderWidth: 1,
      borderColor: '#cbd5e1'
    },
    customRunChipActive: {
      backgroundColor: '#b45309',
      borderColor: '#92400e'
    },
    customRunChipText: {
      fontSize: 13,
      fontWeight: 'bold',
      color: '#334155'
    },
    customRunChipTextActive: {
      color: '#ffffff'
    },
    fieldSubLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: '#64748b',
      marginBottom: 4
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 10
    },
    categoryOption: {
      width: '48%',
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      borderRadius: 6,
      padding: 8
    },
    categoryOptionActive: {
      backgroundColor: '#fffbeb',
      borderColor: '#b45309'
    },
    categoryOptionText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#1e293b'
    },
    categoryOptionTextActive: {
      color: '#b45309'
    },
    categoryOptionDesc: {
      fontSize: 10,
      color: '#64748b',
      marginTop: 2
    },
    previewBox: {
      backgroundColor: '#f8fafc',
      borderRadius: 6,
      padding: 10,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      marginVertical: 8
    },
    previewBoxLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: '#64748b',
      letterSpacing: 0.5
    },
    previewBoxText: {
      fontSize: 13,
      fontWeight: 'bold',
      color: '#0f172a',
      marginTop: 2
    },
    modalTopHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8
    },
    redCloseBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: '#fee2e2',
      borderWidth: 1.5,
      borderColor: '#ef4444',
      alignItems: 'center',
      justifyContent: 'center'
    },
    redCloseBtnText: {
      fontSize: 15,
      fontWeight: 'bold',
      color: '#dc2626',
      lineHeight: 18,
      textAlign: 'center'
    },
    wicketBadgeTag: {
      alignSelf: 'flex-start',
      backgroundColor: '#fee2e2',
      borderWidth: 1,
      borderColor: '#fca5a5',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4
    },
    wicketBadgeTagText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#dc2626',
      letterSpacing: 0.5
    },
    outBatterToggleRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12
    },
    outBatterBtn: {
      flex: 1,
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      borderRadius: 8,
      padding: 10
    },
    outBatterBtnActive: {
      backgroundColor: '#fee2e2',
      borderColor: '#dc2626'
    },
    outBatterRole: {
      fontSize: 10,
      fontWeight: '800',
      color: '#64748b',
      letterSpacing: 0.5
    },
    outBatterRoleActive: {
      color: '#dc2626'
    },
    outBatterName: {
      fontSize: 13,
      fontWeight: 'bold',
      color: '#1e293b',
      marginTop: 2
    },
    outBatterNameActive: {
      color: '#7f1d1d'
    },
    outBatterStats: {
      fontSize: 11,
      color: '#64748b',
      marginTop: 2
    },
    dismissalGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 12
    },
    dismissalChip: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 6,
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      minWidth: '31%'
    },
    dismissalChipActive: {
      backgroundColor: '#fee2e2',
      borderColor: '#dc2626'
    },
    dismissalChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#1e293b'
    },
    dismissalChipTextActive: {
      color: '#dc2626'
    },
    dismissalChipSub: {
      fontSize: 9,
      color: '#64748b',
      marginTop: 2
    },
    dismissalChipSubActive: {
      color: '#991b1b'
    },
    fielderDropdownTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#f8fafc',
      borderWidth: 1.5,
      borderColor: '#cbd5e1',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10
    },
    fielderDropdownTriggerOpen: {
      borderColor: '#b45309',
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0
    },
    fielderDropdownTriggerCustom: {
      backgroundColor: '#fffbeb',
      borderColor: '#b45309'
    },
    fielderDropdownIcon: {
      fontSize: 15,
      marginRight: 8
    },
    fielderDropdownTriggerText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#64748b',
      flex: 1
    },
    fielderDropdownTriggerTextSelected: {
      color: '#1e293b',
      fontWeight: 'bold'
    },
    fielderDropdownArrow: {
      fontSize: 12,
      color: '#64748b',
      fontWeight: 'bold',
      marginLeft: 8
    },
    fielderDropdownMenu: {
      backgroundColor: '#ffffff',
      borderWidth: 1.5,
      borderTopWidth: 0,
      borderColor: '#b45309',
      borderBottomLeftRadius: 8,
      borderBottomRightRadius: 8,
      padding: 8
    },
    dropdownSearchWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#f1f5f9',
      borderWidth: 1,
      borderColor: '#cbd5e1',
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 5,
      marginBottom: 6
    },
    dropdownSearchIcon: {
      fontSize: 12,
      marginRight: 6
    },
    dropdownSearchInput: {
      flex: 1,
      fontSize: 12,
      color: '#1e293b',
      padding: 0
    },
    fielderDropdownScroll: {
      maxHeight: 160
    },
    fielderDropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 6,
      marginBottom: 4,
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#e2e8f0'
    },
    fielderDropdownItemSelected: {
      backgroundColor: '#fffbeb',
      borderColor: '#b45309'
    },
    fielderDropdownItemName: {
      fontSize: 13,
      fontWeight: '600',
      color: '#1e293b'
    },
    fielderDropdownItemNameSelected: {
      fontWeight: 'bold',
      color: '#b45309'
    },
    fielderDropdownItemRole: {
      fontSize: 10,
      fontWeight: '700',
      color: '#64748b',
      backgroundColor: '#e2e8f0',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4
    },
    dropdownEmptyBox: {
      padding: 12,
      alignItems: 'center'
    },
    dropdownEmptyText: {
      fontSize: 12,
      color: '#94a3b8',
      textAlign: 'center'
    },
    allOutBanner: {
      backgroundColor: '#fef2f2',
      padding: 10,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#fca5a5'
    },
    allOutBannerText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: '#b91c1c'
    },
    dismissalSummaryCard: {
      backgroundColor: '#f8fafc',
      borderWidth: 1.5,
      borderColor: '#e2e8f0',
      borderRadius: 8,
      padding: 12,
      marginBottom: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    dismissalSummaryLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: '#64748b',
      letterSpacing: 0.5
    },
    dismissalSummaryText: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#0f172a',
      marginTop: 2
    },
    changeDismissalBtn: {
      backgroundColor: '#fee2e2',
      borderWidth: 1,
      borderColor: '#fca5a5',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6
    },
    changeDismissalBtnText: {
      fontSize: 11,
      fontWeight: 'bold',
      color: '#dc2626'
    },
    requiredBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: '#fca5a5',
      backgroundColor: '#fee2e2'
    },
    requiredBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#dc2626',
      letterSpacing: 0.5
    },
    fielderDropdownTriggerRequired: {
      borderColor: '#f87171',
      backgroundColor: '#fffaf0'
    },
    fielderDropdownTriggerTextPlaceholder: {
      color: '#dc2626',
      fontWeight: '600'
    },
    battersCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6
    },
    swapStrikeBtn: {
      backgroundColor: '#f1f5f9',
      borderColor: '#cbd5e1',
      borderWidth: 1,
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 2
    },
    swapStrikeBtnText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#475569'
    },
    playerRowTappable: {
      paddingVertical: 6,
      paddingHorizontal: 6,
      borderRadius: 6,
      backgroundColor: '#f8fafc',
      marginVertical: 2,
      borderWidth: 1,
      borderColor: '#f1f5f9'
    },
    changeBatterBadge: {
      backgroundColor: '#fef3c7',
      borderColor: '#fde68a',
      borderWidth: 1,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 1
    },
    changeBatterBadgeText: {
      fontSize: 9,
      fontWeight: 'bold',
      color: '#b45309'
    },
    quickReasonsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 6
    },
    quickReasonChip: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 14,
      backgroundColor: '#f1f5f9',
      borderWidth: 1,
      borderColor: '#cbd5e1'
    },
    quickReasonChipActive: {
      backgroundColor: '#fef3c7',
      borderColor: '#f59e0b'
    },
    quickReasonChipText: {
      fontSize: 11,
      color: '#475569',
      fontWeight: '500'
    },
    quickReasonChipTextActive: {
      color: '#92400e',
      fontWeight: 'bold'
    },
    // --- SCORER SIDE OPTIONS DRAWER STYLES ---
    optionsMenuBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#0f172a',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#334155',
      marginRight: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.15,
      shadowRadius: 2,
      elevation: 2
    },
    optionsMenuIcon: {
      fontSize: 16,
      color: '#fbbf24',
      marginRight: 6,
      fontWeight: 'bold'
    },
    optionsMenuText: {
      fontSize: 12,
      fontWeight: '800',
      color: '#f8fafc',
      letterSpacing: 0.8
    },
    drawerOverlay: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: 'rgba(0,0,0,0.65)'
    },
    drawerBackdrop: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0
    },
    drawerContainer: {
      width: 330,
      maxWidth: '88%',
      height: '100%',
      backgroundColor: '#ffffff',
      borderRightWidth: 2,
      borderRightColor: '#fde68a',
      paddingTop: Platform.OS === 'ios' ? 44 : 16,
      paddingHorizontal: 14,
      paddingBottom: 20,
      shadowColor: '#d4af37',
      shadowOffset: { width: 4, height: 0 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 12
    },
    drawerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 12,
      backgroundColor: '#fffbeb',
      borderWidth: 1.5,
      borderColor: '#fde68a',
      borderRadius: 10,
      marginBottom: 12
    },
    drawerTitle: {
      fontSize: 15,
      fontWeight: '900',
      color: '#92400e',
      letterSpacing: 0.5
    },
    drawerSubtitle: {
      fontSize: 11.5,
      color: '#b45309',
      marginTop: 2,
      fontWeight: '700'
    },
    drawerCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#fef3c7',
      borderWidth: 1,
      borderColor: '#fde68a',
      alignItems: 'center',
      justifyContent: 'center'
    },
    drawerCloseText: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#92400e'
    },
    drawerMenuScroll: {
      flex: 1
    },
    drawerMenuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#ffffff',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      marginBottom: 9,
      borderWidth: 1.5,
      borderColor: '#fde68a',
      shadowColor: '#d4af37',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2
    },
    drawerExitMenuItem: {
      backgroundColor: '#fef2f2',
      borderColor: '#fca5a5',
      marginTop: 6
    },
    drawerMenuIconBox: {
      width: 42,
      height: 42,
      borderRadius: 10,
      backgroundColor: '#fffbeb',
      borderWidth: 1,
      borderColor: '#fde68a',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12
    },
    drawerMenuIconText: {
      fontSize: 22
    },
    drawerMenuTextBox: {
      flex: 1
    },
    drawerMenuLabel: {
      fontSize: 13.5,
      fontWeight: '800',
      color: '#0f172a'
    },
    drawerMenuDesc: {
      fontSize: 10.5,
      color: '#64748b',
      marginTop: 2,
      fontWeight: '500'
    },
    drawerMenuChevron: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#d97706',
      marginLeft: 6
    },

    // --- WI-FI CONNECTIVITY BADGE (Header) ---
    wifiBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 20,
      borderWidth: 1,
      marginRight: 8
    },
    wifiBadgeOnline: {
      backgroundColor: '#f0fdf4',
      borderColor: '#86efac'
    },
    wifiBadgeOffline: {
      backgroundColor: '#fef2f2',
      borderColor: '#fca5a5'
    },
    wifiIcon: {
      fontSize: 13,
      marginRight: 4
    },
    wifiDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      marginRight: 5
    },
    wifiDotGreen: {
      backgroundColor: '#22c55e'
    },
    wifiDotRed: {
      backgroundColor: '#ef4444'
    },
    wifiText: {
      fontSize: 11,
      fontWeight: '700'
    },
    wifiTextGreen: {
      color: '#16a34a'
    },
    wifiTextRed: {
      color: '#dc2626'
    },

    // --- REVISED OVERS & TARGET MODAL STYLES ---
    revisedModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: '#e2e8f0',
      marginBottom: 8
    },
    revisedModalTitle: {
      fontSize: 15,
      fontWeight: '900',
      color: '#0f172a',
      letterSpacing: 0.5
    },
    revisedModalInfo: {
      fontSize: 12,
      color: '#475569',
      lineHeight: 17,
      backgroundColor: '#f8fafc',
      padding: 8,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      marginTop: 4
    },

    // --- PLAYING XI EDIT MODAL STYLES ---
    teamSelectCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: '#f8fafc',
      borderWidth: 1.5,
      borderColor: '#cbd5e1'
    },
    teamSelectCardActive: {
      backgroundColor: '#fffbeb',
      borderColor: '#d97706'
    },
    teamSelectCardText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#334155'
    },
    teamSelectCardTextActive: {
      color: '#b45309',
      fontWeight: '800'
    },
    teamSelectCheck: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#d97706'
    },
    playerCheckRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 6,
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      marginBottom: 6
    },
    playerCheckRowSelected: {
      backgroundColor: '#f0f9ff',
      borderColor: '#38bdf8'
    },
    playerCheckRowLocked: {
      backgroundColor: '#f1f5f9',
      borderColor: '#cbd5e1',
      opacity: 0.85
    },
    checkboxBox: {
      width: 22,
      height: 22,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: '#94a3b8',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#fff'
    },
    checkboxBoxChecked: {
      backgroundColor: '#0284c7',
      borderColor: '#0284c7'
    },
    checkboxTick: {
      fontSize: 13,
      fontWeight: '900',
      color: '#fff'
    },
    playerNameText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#1e293b'
    },
    playerNameTextSelected: {
      fontWeight: 'bold',
      color: '#0369a1'
    },
    playerRoleSub: {
      fontSize: 10,
      color: '#64748b'
    },
    lockedBadge: {
      backgroundColor: '#fee2e2',
      borderColor: '#fca5a5',
      borderWidth: 1,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4
    },
    lockedBadgeText: {
      fontSize: 9,
      fontWeight: 'bold',
      color: '#dc2626'
    },
    squadBottomBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: '#e2e8f0'
    },
    playerCountBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
      borderWidth: 1
    },
    countBadgeGreen: {
      backgroundColor: '#dcfce7',
      borderColor: '#86efac'
    },
    countBadgeRed: {
      backgroundColor: '#fee2e2',
      borderColor: '#fca5a5'
    },
    playerCountText: {
      fontSize: 11,
      fontWeight: 'bold',
      color: '#0f172a'
    },
    orderPlayerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 7,
      paddingHorizontal: 8,
      borderRadius: 6,
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      marginBottom: 5
    },
    orderNumber: {
      fontSize: 13,
      fontWeight: '900',
      color: '#64748b',
      width: 24,
      textAlign: 'center'
    },
    orderPlayerName: {
      fontSize: 13,
      fontWeight: '700',
      color: '#0f172a'
    },
    roleBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      borderWidth: 1
    },
    roleBadgeText: {
      fontSize: 9,
      fontWeight: '800'
    },

    // --- T20 SUPER OVER CARD STYLES ---
    superOverCard: {
      backgroundColor: '#fffbeb',
      borderWidth: 1.5,
      borderColor: '#fcd34d',
      borderRadius: 8,
      padding: 12,
      marginTop: 10
    },
    superOverCardTitle: {
      fontSize: 12,
      fontWeight: '900',
      color: '#b45309',
      letterSpacing: 0.5
    },
    superOverCardSub: {
      fontSize: 11,
      color: '#92400e',
      lineHeight: 15,
      marginTop: 4
    },
    superOverChoiceBtn: {
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: '#f1f5f9',
      borderWidth: 1,
      borderColor: '#cbd5e1'
    },
    superOverChoiceBtnActive: {
      backgroundColor: '#d97706',
      borderColor: '#b45309'
    },
    superOverChoiceText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#334155'
    },
    superOverChoiceTextActive: {
      color: '#fff',
      fontWeight: 'bold'
    },
    choiceChip: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 6,
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#cbd5e1',
      alignItems: 'center'
    },
    choiceChipActive: {
      backgroundColor: '#0284c7',
      borderColor: '#0369a1'
    },
    choiceChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#334155'
    },
    choiceChipTextActive: {
      color: '#fff',
      fontWeight: 'bold'
    },

    // --- DRAWER DIGITAL CLOCK STYLES (Screenshot Match) ---
    drawerClockBox: {
      backgroundColor: '#1e293b',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#334155',
      marginTop: 12
    },
    drawerClockText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#f8fafc',
      letterSpacing: 1.5
    },

    // --- EDIT MODE STICKY BANNER STYLES ---
    editModeBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#78350f',
      borderWidth: 1.5,
      borderColor: '#f59e0b',
      borderRadius: 8,
      padding: 12,
      marginBottom: 12
    },
    editModeBannerTitle: {
      fontSize: 13,
      fontWeight: '900',
      color: '#fef3c7',
      letterSpacing: 0.5
    },
    editModeBannerSub: {
      fontSize: 11,
      color: '#fde68a',
      marginTop: 2
    },
    editModeUndoBtn: {
      backgroundColor: '#d97706',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 6,
      marginRight: 8
    },
    editModeUndoBtnText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 12
    },
    editModeExitBtn: {
      backgroundColor: '#451a03',
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#f59e0b'
    },
    editModeExitBtnText: {
      color: '#fef3c7',
      fontWeight: '700',
      fontSize: 11
    },

    // --- PRIMARY ENGINE ACTION BAR & CONTROLS ---
    primaryEngineActionBar: {
      flexDirection: 'row',
      gap: isDesktop ? 10 : 5,
      marginBottom: isDesktop ? 10 : 3
    },
    enginePrimaryBtn: {
      flex: 1,
      paddingVertical: isDesktop ? 12 : 6,
      borderRadius: isDesktop ? 8 : 6,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3.84,
      elevation: 4
    },
    engineStartBallBtn: {
      backgroundColor: '#005960',
      borderColor: '#0d9488'
    },
    engineEndBallBtn: {
      backgroundColor: '#047857',
      borderColor: '#10b981'
    },
    engineOverBtn: {
      backgroundColor: '#0f2928',
      borderColor: '#d97706'
    },
    enginePrimaryBtnText: {
      color: '#fff',
      fontSize: isDesktop ? 13 : 11,
      fontWeight: '900',
      letterSpacing: 0.8
    },

    // Mode & Shot Row
    engineModeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10
    },
    engineModeBox: {
      flex: 1.6,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#ffffff',
      paddingVertical: 4,
      paddingHorizontal: 6,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: '#cbd5e1',
      gap: 4
    },
    engineBarLabel: {
      fontSize: 10,
      fontWeight: '900',
      color: '#475569',
      marginRight: 2
    },
    engineModeToggleBtn: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: 6,
      alignItems: 'center',
      backgroundColor: '#f1f5f9'
    },
    engineModeToggleBtnActive: {
      backgroundColor: '#005960'
    },
    engineModeToggleText: {
      fontSize: 9,
      fontWeight: '800',
      color: '#64748b'
    },
    engineModeToggleTextActive: {
      color: '#fff'
    },
    engineShotBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#ffffff',
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: '#cbd5e1',
      justifyContent: 'space-between'
    },
    engineShotValue: {
      fontSize: 10,
      fontWeight: 'bold',
      color: '#b45309'
    },

    // Ball Type & Shot Type Row
    engineTypeRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10
    },
    engineTypeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#ffffff',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: '#cbd5e1'
    },
    engineTypeBtnLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: '#64748b'
    },
    engineTypeBtnVal: {
      fontSize: 11,
      fontWeight: 'bold',
      color: '#005960'
    },
    engineTypeBtnActive: {
      borderColor: '#0284c7',
      backgroundColor: '#f0f9ff'
    },
    engineShotBoxActive: {
      borderColor: '#0284c7',
      backgroundColor: '#f0f9ff'
    },
    engineDropdownMenu: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      marginTop: 4,
      backgroundColor: '#ffffff',
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: '#0284c7',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius: 10,
      elevation: 25,
      zIndex: 9999,
      overflow: 'hidden'
    },
    engineDropdownHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#0f172a',
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#334155'
    },
    engineDropdownHeaderText: {
      color: '#f8fafc',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8
    },
    engineDropdownCloseText: {
      color: '#94a3b8',
      fontSize: 13,
      fontWeight: 'bold',
      paddingHorizontal: 4
    },
    engineDropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#f1f5f9'
    },
    engineDropdownItemActive: {
      backgroundColor: '#f0f9ff'
    },
    engineDropdownItemText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#334155'
    },
    engineDropdownItemTextActive: {
      color: '#0284c7',
      fontWeight: '800'
    },
    engineDropdownCheck: {
      fontSize: 13,
      fontWeight: '800',
      color: '#0284c7'
    },

    // Auxiliary Action Row
    engineAuxRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 12
    },
    engineAuxBtn: {
      flex: 1,
      minWidth: '22%',
      paddingVertical: 7,
      paddingHorizontal: 4,
      borderRadius: 8,
      backgroundColor: '#ffffff',
      borderWidth: 1.5,
      borderColor: '#cbd5e1',
      alignItems: 'center',
      justifyContent: 'center'
    },
    engineAuxBtnActive: {
      backgroundColor: '#fef3c7',
      borderColor: '#d97706'
    },
    engineAuxBtnText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#0f172a'
    },
    engineAuxBtnTextActive: {
      color: '#92400e'
    },

    // Engine Keypad Grid
    engineKeypadContainer: {
      gap: isDesktop ? 8 : 4,
      marginTop: isDesktop ? 4 : 2
    },
    engineKeypadRow: {
      flexDirection: 'row',
      gap: isDesktop ? 8 : 4
    },
    engineKeypadBtn: {
      flex: 1,
      height: isDesktop ? 54 : 36,
      borderRadius: isDesktop ? 10 : 6,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffffff',
      borderWidth: 1.5,
      borderColor: '#cbd5e1',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2
    },
    engineKeypadText: {
      fontSize: isDesktop ? 22 : 18,
      fontWeight: '900',
      color: '#0f172a'
    },
    engineAuxKeypadBtn: {
      backgroundColor: '#005960',
      borderColor: '#0d9488',
      height: isDesktop ? 54 : 32
    },
    engineAuxKeypadText: {
      fontSize: isDesktop ? 12 : 10,
      fontWeight: '800',
      color: '#ffffff',
      textAlign: 'center'
    },

    // Extra Modal List Item
    extraModalItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 6,
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#e2e8f0'
    },
    extraModalItemTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: '#0f172a'
    },
    extraModalItemSub: {
      fontSize: 10,
      color: '#64748b',
      marginTop: 2
    },

    // Wagon Wheel Graphic Styles
    wagonWheelContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 14
    },
    wagonGroundCircle: {
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: '#15803d',
      borderWidth: 3,
      borderColor: '#86efac',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 6
    },
    wagonInnerCircle: {
      position: 'absolute',
      width: 110,
      height: 110,
      borderRadius: 55,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.65)',
      borderStyle: 'dashed'
    },
    wagonPitchBox: {
      width: 22,
      height: 48,
      backgroundColor: '#b45309',
      borderRadius: 3,
      borderWidth: 1,
      borderColor: '#fde68a',
      alignItems: 'center',
      justifyContent: 'center'
    },
    wagonSectorChip: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 16,
      backgroundColor: '#f1f5f9',
      borderWidth: 1,
      borderColor: '#cbd5e1'
    },
    wagonSectorChipActive: {
      backgroundColor: '#059669',
      borderColor: '#10b981'
    },
    wagonSectorChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#334155'
    },
    wagonSectorChipTextActive: {
      color: '#fff',
      fontWeight: 'bold'
    },
    boundaryBadgePill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12
    },
    boundaryBadgeFour: {
      backgroundColor: '#0284c7'
    },
    boundaryBadgeSix: {
      backgroundColor: '#7c3aed'
    },
    boundaryBadgePillText: {
      fontSize: 10,
      fontWeight: '900',
      color: '#ffffff',
      letterSpacing: 0.5
    },
    wagonSelectedBadge: {
      position: 'absolute',
      top: 24,
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#38bdf8'
    },
    wagonSelectedBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      color: '#38bdf8'
    },
    wagonSkipBtn: {
      backgroundColor: '#475569',
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
      width: '100%'
    },
    wagonSkipBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#f8fafc'
    },
    timeInputContainer: {
      position: 'relative',
      justifyContent: 'center'
    },
    fieldClockBtn: {
      position: 'absolute',
      right: 5,
      top: 5,
      bottom: 5,
      backgroundColor: '#fef3c7',
      borderColor: '#fde68a',
      borderWidth: 1,
      borderRadius: 6,
      paddingHorizontal: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4
    },
    fieldClockBtnText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#b45309'
    },
    autoCalcBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#dcfce7',
      borderColor: '#bbf7d0',
      borderWidth: 1,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4
    },
    autoCalcBadgeText: {
      fontSize: 10,
      color: '#15803d',
      fontWeight: '800'
    },
    activeBreakBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fffbeb',
      borderColor: '#f59e0b',
      borderWidth: 1.5,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      shadowColor: '#d97706',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 3
    },
    activeRainBanner: {
      backgroundColor: '#f0f9ff',
      borderColor: '#38bdf8',
      shadowColor: '#0284c7'
    },
    activeBreakIconBox: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#fef3c7',
      borderWidth: 1,
      borderColor: '#fde68a',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8
    },
    activeBreakEmoji: {
      fontSize: 22
    },
    activeBreakTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: '#92400e'
    },
    activeBreakLiveTag: {
      backgroundColor: '#dc2626',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 4
    },
    activeBreakLiveTagText: {
      fontSize: 9,
      fontWeight: '900',
      color: '#ffffff',
      letterSpacing: 0.5
    },
    activeBreakDetails: {
      fontSize: 12,
      color: '#78350f',
      marginTop: 2,
      fontWeight: '600'
    },
    resumePlayBtn: {
      backgroundColor: '#16a34a',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#15803d'
    },
    resumePlayBtnText: {
      fontSize: 12,
      fontWeight: '800',
      color: '#ffffff'
    },
    // Smart Rules & Free Hit Styles
    freeHitLiveBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#fef2f2',
      borderWidth: 1.5,
      borderColor: '#ef4444',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginVertical: 4
    },
    freeHitLiveTitle: {
      fontSize: 13,
      fontWeight: '900',
      color: '#b91c1c'
    },
    freeHitLiveSub: {
      fontSize: 11,
      fontWeight: '600',
      color: '#991b1b',
      marginTop: 1
    },
    freeHitRulesBtn: {
      backgroundColor: '#dc2626',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6
    },
    freeHitRulesBtnText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#ffffff'
    },
    smartRulesNavBtn: {
      backgroundColor: '#ecfdf5',
      borderWidth: 1,
      borderColor: '#10b981',
      borderRadius: 8,
      paddingVertical: 7,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 4
    },
    smartRulesNavBtnText: {
      fontSize: 12,
      fontWeight: '800',
      color: '#065f46'
    },
    freeHitModalNotice: {
      backgroundColor: '#fef2f2',
      borderWidth: 1.5,
      borderColor: '#f87171',
      borderRadius: 8,
      padding: 10,
      marginBottom: 10
    },
    freeHitModalNoticeText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#b91c1c',
      lineHeight: 16
    },
    runOutHelperBtn: {
      backgroundColor: '#eff6ff',
      borderWidth: 1.5,
      borderColor: '#3b82f6',
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      marginBottom: 4
    },
    runOutHelperBtnText: {
      fontSize: 12,
      fontWeight: '800',
      color: '#1d4ed8'
    },
    quotaFullBadge: {
      backgroundColor: '#fef3c7',
      borderColor: '#f59e0b',
      borderWidth: 1,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2
    },
    quotaFullBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#b45309'
    },

    // Offline Queue Header Pill
    offlineQueuePill: {
      backgroundColor: '#fef3c7',
      borderColor: '#d97706',
      borderWidth: 1.5,
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingVertical: 5,
      marginRight: 6
    },
    offlineQueuePillText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#b45309'
    },

    // Recent Deliveries Strip & Edit Mode Styling
    recentDeliveriesCard: {
      backgroundColor: '#ffffff',
      borderRadius: 12,
      padding: 12,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2
    },
    recentDeliveriesCardEditMode: {
      borderColor: '#d97706',
      borderWidth: 2,
      backgroundColor: '#fffdf5'
    },
    recentDeliveriesHeader: {
      marginBottom: 8
    },
    recentDeliveriesTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: '#1e293b',
      letterSpacing: 0.5,
      textTransform: 'uppercase'
    },
    recentDeliveriesSub: {
      fontSize: 11,
      color: '#64748b',
      fontWeight: '600'
    },
    editModeTagPill: {
      backgroundColor: '#fef3c7',
      borderColor: '#d97706',
      borderWidth: 1,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2
    },
    editModeTagPillText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#b45309'
    },
    editModeTapHint: {
      fontSize: 11,
      fontWeight: '600',
      color: '#b45309',
      marginTop: 3
    },
    recentDeliveriesScroll: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 4
    },
    ballChip: {
      width: 44,
      height: 48,
      borderRadius: 8,
      backgroundColor: '#f1f5f9',
      borderWidth: 1.5,
      borderColor: '#cbd5e1',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative'
    },
    ballChipDot: {
      backgroundColor: '#f8fafc',
      borderColor: '#cbd5e1'
    },
    ballChipFour: {
      backgroundColor: '#ecfdf5',
      borderColor: '#10b981'
    },
    ballChipSix: {
      backgroundColor: '#eff6ff',
      borderColor: '#3b82f6'
    },
    ballChipWicket: {
      backgroundColor: '#fef2f2',
      borderColor: '#ef4444'
    },
    ballChipExtra: {
      backgroundColor: '#fffbeb',
      borderColor: '#f59e0b'
    },
    ballChipEditMode: {
      borderColor: '#d97706',
      borderWidth: 2,
      backgroundColor: '#fef9c3',
      transform: [{ scale: 1.04 }]
    },
    ballChipPencil: {
      position: 'absolute',
      top: 1,
      right: 2,
      fontSize: 9
    },
    ballChipText: {
      fontSize: 14,
      fontWeight: '800',
      color: '#334155'
    },
    ballChipTextDot: {
      color: '#64748b'
    },
    ballChipTextFour: {
      color: '#047857'
    },
    ballChipTextSix: {
      color: '#1d4ed8'
    },
    ballChipTextWicket: {
      color: '#b91c1c'
    },
    ballChipTextExtra: {
      color: '#b45309'
    },
    ballChipOverText: {
      fontSize: 9,
      color: '#94a3b8',
      fontWeight: '700',
      marginTop: 1
    },
    emptyRecentBallsBox: {
      paddingVertical: 10,
      paddingHorizontal: 8
    },
    emptyRecentBallsText: {
      fontSize: 12,
      color: '#94a3b8',
      fontStyle: 'italic'
    },

    // Direct Delivery Edit Modal Styles
    editDeliveryModalContainer: {
      width: '92%',
      maxWidth: 520,
      backgroundColor: '#ffffff',
      borderRadius: 16,
      overflow: 'hidden',
      maxHeight: '90%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 8
    },
    editDeliveryModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#fffbeb',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1.5,
      borderBottomColor: '#fed7aa'
    },
    editDeliveryModalTitle: {
      fontSize: 16,
      fontWeight: '900',
      color: '#b45309'
    },
    editDeliveryModalSub: {
      fontSize: 11,
      color: '#78350f',
      fontWeight: '600',
      marginTop: 2
    },
    editDeliveryModalBody: {
      padding: 16
    },
    editDeliveryInfoBox: {
      backgroundColor: '#f8fafc',
      borderRadius: 8,
      padding: 10,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      marginBottom: 14
    },
    editDeliveryInfoText: {
      fontSize: 13,
      color: '#334155'
    },
    editDeliveryCommentaryText: {
      fontSize: 11,
      color: '#64748b',
      fontStyle: 'italic',
      marginTop: 4
    },
    editSectionLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: '#475569',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
      marginTop: 8,
      marginBottom: 6
    },
    editRunsRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
      marginBottom: 10
    },
    editRunChip: {
      width: 44,
      height: 44,
      borderRadius: 8,
      backgroundColor: '#f1f5f9',
      borderWidth: 1.5,
      borderColor: '#cbd5e1',
      alignItems: 'center',
      justifyContent: 'center'
    },
    editRunChipActive: {
      backgroundColor: '#d97706',
      borderColor: '#b45309'
    },
    editRunChipText: {
      fontSize: 16,
      fontWeight: '800',
      color: '#334155'
    },
    editRunChipTextActive: {
      color: '#ffffff'
    },
    editExtrasRow: {
      flexDirection: 'row',
      gap: 6,
      flexWrap: 'wrap',
      marginBottom: 10
    },
    editExtraChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: '#f8fafc',
      borderWidth: 1.5,
      borderColor: '#cbd5e1'
    },
    editExtraChipActive: {
      backgroundColor: '#f59e0b',
      borderColor: '#d97706'
    },
    editExtraChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#475569'
    },
    editExtraChipTextActive: {
      color: '#ffffff',
      fontWeight: '800'
    },
    editWicketToggleRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 10
    },
    editWicketToggleBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: '#f1f5f9',
      borderWidth: 1.5,
      borderColor: '#cbd5e1',
      alignItems: 'center',
      justifyContent: 'center'
    },
    editWicketToggleBtnActive: {
      backgroundColor: '#ecfdf5',
      borderColor: '#10b981'
    },
    editWicketToggleBtnWicketActive: {
      backgroundColor: '#fef2f2',
      borderColor: '#ef4444'
    },
    editWicketToggleBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#64748b'
    },
    editWicketToggleBtnTextActive: {
      color: '#065f46',
      fontWeight: '800'
    },
    editWicketToggleBtnTextWicketActive: {
      color: '#b91c1c',
      fontWeight: '800'
    },
    editWicketTypeGrid: {
      flexDirection: 'row',
      gap: 6,
      flexWrap: 'wrap',
      marginBottom: 12,
      backgroundColor: '#fff5f5',
      padding: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#fca5a5'
    },
    editWicketTypeChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: '#f87171'
    },
    editWicketTypeChipActive: {
      backgroundColor: '#dc2626',
      borderColor: '#b91c1c'
    },
    editWicketTypeChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#b91c1c'
    },
    editWicketTypeChipTextActive: {
      color: '#ffffff',
      fontWeight: '800'
    },
    editDeliveryActionRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: '#e2e8f0'
    },
    editDeliveryCancelBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: '#f1f5f9',
      alignItems: 'center',
      justifyContent: 'center'
    },
    editDeliveryCancelBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#64748b'
    },
    editDeliverySaveBtn: {
      flex: 2,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: '#16a34a',
      alignItems: 'center',
      justifyContent: 'center'
    },
    editDeliverySaveBtnText: {
      fontSize: 13,
      fontWeight: '800',
      color: '#ffffff'
    },

    // Cricket Milestone Celebration Styles
    milestoneModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.88)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16
    },
    milestoneCard: {
      width: '92%',
      maxWidth: 460,
      backgroundColor: '#ffffff',
      borderRadius: 24,
      borderWidth: 2.5,
      borderColor: '#b8860b',
      overflow: 'hidden',
      alignItems: 'center',
      paddingBottom: 22,
      position: 'relative',
      shadowColor: '#b8860b',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius: 16,
      elevation: 8
    },
    milestoneRibbon: {
      width: '100%',
      backgroundColor: '#fffbeb',
      borderBottomWidth: 2,
      borderBottomColor: '#f59e0b',
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center'
    },
    milestoneRibbonText: {
      color: '#b45309',
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1.2,
      textTransform: 'uppercase'
    },
    milestoneImageContainer: {
      width: 250,
      height: 180,
      marginTop: 10,
      alignItems: 'center',
      justifyContent: 'center'
    },
    milestoneHeroImage: {
      width: '100%',
      height: '100%'
    },
    milestoneContentBox: {
      width: '100%',
      paddingHorizontal: 20,
      alignItems: 'center'
    },
    milestoneTitleText: {
      fontSize: 22,
      fontWeight: '900',
      color: '#b45309',
      letterSpacing: 0.8,
      marginTop: 4,
      textAlign: 'center'
    },
    milestonePlayerName: {
      fontSize: 20,
      fontWeight: '900',
      color: '#0f172a',
      letterSpacing: 0.5,
      marginTop: 4,
      textAlign: 'center'
    },
    milestoneTeamName: {
      fontSize: 12,
      fontWeight: '700',
      color: '#64748b',
      letterSpacing: 0.5,
      marginTop: 2,
      textAlign: 'center'
    },
    milestoneStatsBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#fffbeb',
      borderWidth: 1.5,
      borderColor: '#fde68a',
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginTop: 14,
      width: '100%'
    },
    milestoneStatItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center'
    },
    milestoneStatValue: {
      fontSize: 20,
      fontWeight: '900',
      color: '#0f172a'
    },
    milestoneStatLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: '#854d0e',
      marginTop: 2,
      letterSpacing: 0.5
    },
    milestoneStatDivider: {
      width: 1,
      height: 28,
      backgroundColor: '#fde68a',
      marginHorizontal: 8
    },
    milestoneBoundariesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 12
    },
    milestoneBoundaryTag: {
      backgroundColor: '#f0fdf4',
      borderColor: '#22c55e',
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 5
    },
    milestoneSixTag: {
      backgroundColor: '#fff1f2',
      borderColor: '#f43f5e'
    },
    milestoneBoundaryTagText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#15803d'
    },
    milestoneSubtitle: {
      fontSize: 12,
      color: '#475569',
      textAlign: 'center',
      marginTop: 12,
      fontStyle: 'italic',
      lineHeight: 17
    },
    milestoneDismissBtn: {
      backgroundColor: '#16a34a',
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 28,
      marginTop: 16,
      shadowColor: '#16a34a',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 4
    },
    milestoneDismissBtnText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0.5
    },
    milestoneCloseCross: {
      position: 'absolute',
      top: 6,
      right: 10,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      alignItems: 'center',
      justifyContent: 'center'
    },
    milestoneCloseCrossText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '900'
    },

    // MOTM Presentation Card Styles (End of Match)
    motmPresentationCard: {
      width: '100%',
      backgroundColor: '#0f172a',
      borderRadius: 16,
      borderWidth: 2,
      borderColor: '#f59e0b',
      overflow: 'hidden',
      marginTop: 14,
      marginBottom: 14,
      shadowColor: '#f59e0b',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 6
    },
    motmRibbonHeader: {
      backgroundColor: '#f59e0b',
      paddingVertical: 6,
      alignItems: 'center',
      justifyContent: 'center'
    },
    motmRibbonText: {
      color: '#0f172a',
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase'
    },
    motmCardContentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      gap: 12
    },
    motmImageCircle: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: '#ffffff',
      borderWidth: 2,
      borderColor: '#f59e0b',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    },
    motmImage: {
      width: '85%',
      height: '85%'
    },
    motmInfoCol: {
      flex: 1
    },
    motmPlayerTitle: {
      fontSize: 18,
      fontWeight: '900',
      color: '#fde047',
      letterSpacing: 0.5
    },
    motmTeamSubtitle: {
      fontSize: 11,
      color: '#cbd5e1',
      fontWeight: '600',
      marginTop: 2
    },
    motmPillBadge: {
      alignSelf: 'flex-start',
      backgroundColor: '#b45309',
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginTop: 6
    },
    motmPillBadgeText: {
      color: '#ffffff',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.5
    },

    // Wicketkeeper Dismissal Card Styles (Wicket Modal Step 2)
    keeperDismissalCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#f0fdf4',
      borderWidth: 1.5,
      borderColor: '#22c55e',
      borderRadius: 12,
      padding: 10,
      marginBottom: 12,
      gap: 10
    },
    keeperImageContainer: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: '#ffffff',
      borderWidth: 1.5,
      borderColor: '#16a34a',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    },
    keeperArtwork: {
      width: '85%',
      height: '85%'
    },
    keeperTextCol: {
      flex: 1
    },
    keeperTagBadge: {
      alignSelf: 'flex-start',
      backgroundColor: '#dcfce7',
      borderWidth: 1,
      borderColor: '#86efac',
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginBottom: 3
    },
    keeperTagBadgeText: {
      fontSize: 9,
      fontWeight: '900',
      color: '#15803d'
    },
    keeperDismissalTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: '#14532d'
    },
    keeperDismissalExplanation: {
      fontSize: 11,
      color: '#166534',
      marginTop: 2,
      fontWeight: '500'
    },

    // Run Out Dismissal Card Styles
    runOutDismissalCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fff1f2',
      borderWidth: 1.5,
      borderColor: '#f43f5e',
      borderRadius: 12,
      padding: 10,
      marginBottom: 12,
      gap: 10
    },
    runOutImageContainer: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: '#ffffff',
      borderWidth: 1.5,
      borderColor: '#e11d48',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    },
    runOutArtwork: {
      width: '85%',
      height: '85%'
    },
    runOutTextCol: {
      flex: 1
    },
    runOutDismissalTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: '#9f1239'
    },
    runOutDismissalExplanation: {
      fontSize: 11,
      color: '#881337',
      marginTop: 2,
      fontWeight: '500'
    },

    // Background color highlights for milestone modal
    milestoneKeeperBg: {
      backgroundColor: '#064e3b',
      borderRadius: 16,
      padding: 8
    },
    milestoneBowlerBg: {
      backgroundColor: '#78350f',
      borderRadius: 16,
      padding: 8
    },

    // DLS & VJD Responsive Modal Styles
    dlsModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: Platform.OS === 'web' ? (isDesktop ? 24 : 10) : 8
    },
    dlsModalCard: {
      backgroundColor: '#f8fafc',
      borderRadius: 16,
      width: '100%',
      maxHeight: isDesktop ? '90%' : '96%',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.4,
      shadowRadius: 18,
      elevation: 24,
      borderWidth: 1,
      borderColor: '#334155'
    },
    dlsModalCardDesktop: {
      maxWidth: 1140,
      height: '88%'
    },
    dlsModalCardMobile: {
      maxWidth: '100%',
      height: '96%'
    },
    dlsModalCardMaximized: {
      maxWidth: '98%',
      width: '98%',
      height: '96%',
      maxHeight: '96%'
    },
    dlsModalTopBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: '#0f172a',
      borderBottomWidth: 1,
      borderBottomColor: '#1e293b'
    },
    dlsModalHeaderIconBox: {
      width: 34,
      height: 34,
      borderRadius: 8,
      backgroundColor: '#1e293b',
      justifyContent: 'center',
      alignItems: 'center'
    },
    dlsModalTitle: {
      color: '#38bdf8',
      fontSize: isDesktop ? 16 : 14,
      fontWeight: '800'
    },
    dlsModalSub: {
      color: '#94a3b8',
      fontSize: isDesktop ? 11 : 10
    },
    dlsWindowControlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginLeft: 10
    },
    dlsWindowBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center'
    },
    dlsMinimizeBtn: {
      backgroundColor: '#eab308'
    },
    dlsMinimizeText: {
      color: '#0f172a',
      fontWeight: '900',
      fontSize: 13,
      lineHeight: 14
    },
    dlsMaximizeBtn: {
      backgroundColor: '#3b82f6'
    },
    dlsMaximizeText: {
      color: '#ffffff',
      fontWeight: '800',
      fontSize: 12
    },
    dlsCloseBtn: {
      backgroundColor: '#ef4444'
    },
    dlsCloseText: {
      color: '#ffffff',
      fontWeight: '900',
      fontSize: 13
    },
    dlsMinimizedDock: {
      position: 'absolute',
      bottom: 20,
      right: 20,
      backgroundColor: '#0f172a',
      borderRadius: 24,
      paddingVertical: 8,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 20,
      zIndex: 99999,
      borderWidth: 1.5,
      borderColor: '#38bdf8'
    },
    dlsMinimizedTouchArea: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8
    },
    dlsMinimizedPulseDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#10b981'
    },
    dlsMinimizedTitle: {
      color: '#f8fafc',
      fontWeight: '800',
      fontSize: 12
    },
    dlsMinimizedBadge: {
      backgroundColor: '#0369a1',
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 1
    },
    dlsMinimizedBadgeText: {
      color: '#e0f2fe',
      fontWeight: '700',
      fontSize: 10
    },
    dlsMinimizedRestoreText: {
      color: '#38bdf8',
      fontWeight: '700',
      fontSize: 11
    },
    dlsMinimizedCloseBtn: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: '#ef4444',
      justifyContent: 'center',
      alignItems: 'center'
    },
    dlsMinimizedCloseText: {
      color: '#ffffff',
      fontWeight: '900',
      fontSize: 10
    },
    dlsModalCloseBtn: {
      backgroundColor: '#ef4444',
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 8
    },
    dlsModalCloseText: {
      color: '#ffffff',
      fontWeight: '800',
      fontSize: 12
    }
  });
