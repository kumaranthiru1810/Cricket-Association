import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions
} from 'react-native';
import { useScorerNavigation } from '../../navigation/ScorerNavigationContext';
import SharedFooter from '../../components/scorer/SharedFooter';
import CricketLoader from '../../components/common/CricketLoader';
import { ScorerApi } from '../../services/api';
import { showWarning, showError } from '../../utils/sweetalert';

export default function MatchSetupScreen() {
  const { navigate, params } = useScorerNavigation();
  const matchId = params?.matchId || 'M001';
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const styles = getStyles(isDesktop);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [setupData, setSetupData] = useState<any>(null);

  // Mobile squad tab (switch between Team A and Team B)
  const [mobileSquadTab, setMobileSquadTab] = useState<'TEAM_A' | 'TEAM_B'>('TEAM_A');

  // Attendance state (Player ID -> boolean)
  const [attendanceA, setAttendanceA] = useState<Record<string, boolean>>({});
  const [attendanceB, setAttendanceB] = useState<Record<string, boolean>>({});
  const [subAttendanceA, setSubAttendanceA] = useState<Record<string, boolean>>({});
  const [subAttendanceB, setSubAttendanceB] = useState<Record<string, boolean>>({});

  // Toss state
  const [tossWinner, setTossWinner] = useState<string>('');
  const [tossDecision, setTossDecision] = useState<'BAT' | 'BOWL'>('BAT');
  const [matchOvers, setMatchOvers] = useState<string>('20');

  // Rule 5: Post-Toss Delay Timer & Over-Reduction Penalty State (Persisted across logout/refresh)
  const [delayTimerRunning, setDelayTimerRunning] = useState<boolean>(false);
  const [delayTimerStartedAt, setDelayTimerStartedAt] = useState<string | null>(null);
  const [delayBaseElapsed, setDelayBaseElapsed] = useState<number>(0);
  const [delayElapsedSeconds, setDelayElapsedSeconds] = useState<number>(0);
  const [delayPenaltySkipped, setDelayPenaltySkipped] = useState<boolean>(false);
  const [delayPenaltyAppliedOvers, setDelayPenaltyAppliedOvers] = useState<number>(0);
  const [delayPenaltyApplied, setDelayPenaltyApplied] = useState<boolean>(false);
  const [delayPenaltyTeam, setDelayPenaltyTeam] = useState<'BATTING' | 'BOWLING' | 'BOTH'>('BOTH');
  const [teamAOvers, setTeamAOvers] = useState<number | null>(null);
  const [teamBOvers, setTeamBOvers] = useState<number | null>(null);
  const [teamACompleted, setTeamACompleted] = useState<boolean>(false);
  const [teamAStoppedElapsed, setTeamAStoppedElapsed] = useState<number | null>(null);
  const [teamBCompleted, setTeamBCompleted] = useState<boolean>(false);
  const [teamBStoppedElapsed, setTeamBStoppedElapsed] = useState<number | null>(null);
  const [setupStep, setSetupStep] = useState<1 | 2>(1);

  const persistDelayState = (next: {
    running?: boolean;
    startedAt?: string | null;
    elapsedSeconds?: number;
    skipped?: boolean;
    penaltyOvers?: number;
    penaltyTeam?: 'NONE' | 'BATTING' | 'BOWLING' | 'BOTH';
    penaltyApplied?: boolean;
    teamAOvers?: number | null;
    teamBOvers?: number | null;
    teamACompleted?: boolean;
    teamAStoppedElapsed?: number | null;
    teamBCompleted?: boolean;
    teamBStoppedElapsed?: number | null;
  }) => {
    const payload = {
      running: next.running !== undefined ? next.running : delayTimerRunning,
      startedAt: next.startedAt !== undefined ? next.startedAt : delayTimerStartedAt,
      elapsedSeconds: next.elapsedSeconds !== undefined ? next.elapsedSeconds : delayBaseElapsed,
      skipped: next.skipped !== undefined ? next.skipped : delayPenaltySkipped,
      penaltyOvers: next.penaltyOvers !== undefined ? next.penaltyOvers : delayPenaltyAppliedOvers,
      penaltyTeam: next.penaltyTeam !== undefined ? next.penaltyTeam : delayPenaltyTeam,
      penaltyApplied: next.penaltyApplied !== undefined ? next.penaltyApplied : delayPenaltyApplied,
      teamAOvers: next.teamAOvers !== undefined ? next.teamAOvers : teamAOvers,
      teamBOvers: next.teamBOvers !== undefined ? next.teamBOvers : teamBOvers,
      teamACompleted: next.teamACompleted !== undefined ? next.teamACompleted : teamACompleted,
      teamAStoppedElapsed: next.teamAStoppedElapsed !== undefined ? next.teamAStoppedElapsed : teamAStoppedElapsed,
      teamBCompleted: next.teamBCompleted !== undefined ? next.teamBCompleted : teamBCompleted,
      teamBStoppedElapsed: next.teamBStoppedElapsed !== undefined ? next.teamBStoppedElapsed : teamBStoppedElapsed
    };
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(`cfvd_delay_${matchId}`, JSON.stringify(payload));
      } catch (_e) {}
    }
    ScorerApi.saveDelayTimer(matchId, payload).catch(() => {});
  };

  useEffect(() => {
    if (!delayTimerRunning) return;
    const tick = () => {
      const sinceStart = delayTimerStartedAt
        ? Math.max(0, Math.floor((Date.now() - new Date(delayTimerStartedAt).getTime()) / 1000))
        : 0;
      setDelayElapsedSeconds(delayBaseElapsed + sinceStart);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [delayTimerRunning, delayTimerStartedAt, delayBaseElapsed]);

  useEffect(() => {
    loadSetupData();
  }, [matchId]);

  const loadSetupData = async () => {
    try {
      setIsLoading(true);
      const res = await ScorerApi.getMatchSetup(matchId);
      if (res && res.data) {
        setSetupData(res.data);
        setTossWinner(res.data.tossWinner || res.data.teamA?.id || '');
        if (res.data.tossDecision) {
          setTossDecision(res.data.tossDecision);
        }
        const adminFixedOvers = Number(res.data.overs || 20);
        setMatchOvers(String(adminFixedOvers));

        // Restore persisted Rule 5 Delay Timer & Penalty state (backend first, localStorage fallback)
        let dt = res.data.delayTimer;
        if ((!dt || (!dt.running && !dt.elapsedSeconds && !dt.penaltyApplied && !dt.skipped)) && typeof window !== 'undefined' && window.localStorage) {
          try {
            const cached = window.localStorage.getItem(`cfvd_delay_${matchId}`);
            if (cached) dt = JSON.parse(cached);
          } catch (_e) {}
        }
        if (dt) {
          const isRun = Boolean(dt.running);
          const sAt = dt.startedAt || null;
          const baseEl = Number(dt.elapsedSeconds || 0);
          const liveEl = isRun && sAt
            ? baseEl + Math.max(0, Math.floor((Date.now() - new Date(sAt).getTime()) / 1000))
            : baseEl;
          setDelayTimerRunning(isRun);
          setDelayTimerStartedAt(sAt);
          setDelayBaseElapsed(baseEl);
          setDelayElapsedSeconds(liveEl);
          setDelayPenaltySkipped(Boolean(dt.skipped));
          setDelayPenaltyAppliedOvers(Number(dt.penaltyOvers || 0));
          setDelayPenaltyApplied(Boolean(dt.penaltyApplied));
          if (dt.penaltyTeam && ['BATTING', 'BOWLING', 'BOTH'].includes(dt.penaltyTeam)) {
            setDelayPenaltyTeam(dt.penaltyTeam);
          }
          setTeamAOvers(dt.teamAOvers ?? null);
          setTeamBOvers(dt.teamBOvers ?? null);
          setTeamACompleted(Boolean(dt.teamACompleted));
          setTeamAStoppedElapsed(dt.teamAStoppedElapsed ?? null);
          setTeamBCompleted(Boolean(dt.teamBCompleted));
          setTeamBStoppedElapsed(dt.teamBStoppedElapsed ?? null);
          if (dt.penaltyApplied && dt.penaltyTeam === 'BOTH' && dt.teamAOvers) {
            setMatchOvers(String(dt.teamAOvers));
          }
        }

        // Initialize Attendance for Team A (Default: pre-selected 11 or pre-allocated Playing XI)
        const attA: Record<string, boolean> = {};
        const teamAPlayersList = res.data.teamAPlayers || [];
        const hasAllocatedA = teamAPlayersList.some((p: any) => p.is_playing_xi);
        teamAPlayersList.forEach((p: any, idx: number) => {
          attA[p.id] = hasAllocatedA ? Boolean(p.is_playing_xi) : idx < 11;
        });
        setAttendanceA(attA);

        // Initialize Attendance for Team B (Default: pre-selected 11 or pre-allocated Playing XI)
        const attB: Record<string, boolean> = {};
        const teamBPlayersList = res.data.teamBPlayers || [];
        const hasAllocatedB = teamBPlayersList.some((p: any) => p.is_playing_xi);
        teamBPlayersList.forEach((p: any, idx: number) => {
          attB[p.id] = hasAllocatedB ? Boolean(p.is_playing_xi) : idx < 11;
        });
        setAttendanceB(attB);

        // Initialize Substitute Attendance (all unselected by default)
        const subAttA: Record<string, boolean> = {};
        (res.data.teamASubstitutePlayers || []).forEach((p: any) => { subAttA[p.id] = false; });
        setSubAttendanceA(subAttA);

        const subAttB: Record<string, boolean> = {};
        (res.data.teamBSubstitutePlayers || []).forEach((p: any) => { subAttB[p.id] = false; });
        setSubAttendanceB(subAttB);
      }
    } catch (err: any) {
      console.warn('Failed to load match setup:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getMinRequiredPlayers = () => {
    const r15Enabled = setupData?.rule15?.enabled !== false;
    return r15Enabled ? (setupData?.rule15?.minPlayers ?? 9) : 1;
  };

  const computeTeamDelayStats = (elapsedSecs: number) => {
    const tr = setupData?.tournamentRules || {};
    const intervalVal = Number(tr.delay_interval_value || 4);
    const intervalUnit = ['HOURS', 'MINUTES', 'SECONDS'].includes(tr.delay_interval_unit)
      ? tr.delay_interval_unit
      : 'MINUTES';
    const intervalSec = intervalUnit === 'HOURS'
      ? intervalVal * 3600
      : (intervalUnit === 'SECONDS' ? intervalVal : intervalVal * 60);
    const reduceUnit = tr.delay_reduce_unit === 'BALLS' ? 'BALLS' : 'OVERS';
    const amountPerStep = Number(tr.delay_overs_reduced_per_interval || 1);
    const baseOvers = Number(setupData?.overs || 20);
    const intervalsElapsed = Math.floor(elapsedSecs / Math.max(1, intervalSec));
    const rawReduced = delayPenaltySkipped ? 0 : intervalsElapsed * amountPerStep;
    const ballsReduced = reduceUnit === 'BALLS' ? rawReduced : rawReduced * 6;
    const oversEquivalent = Math.floor(ballsReduced / 6);
    const remBalls = ballsReduced % 6;
    const totalRemainingBalls = Math.max(6, baseOvers * 6 - ballsReduced);
    const effectiveOversFloat = Math.max(1, Math.floor(totalRemainingBalls / 6));
    const effectiveOversDisplay = `${Math.floor(totalRemainingBalls / 6)}.${totalRemainingBalls % 6}`;
    return {
      intervalVal, intervalUnit, intervalSec, reduceUnit, amountPerStep, baseOvers,
      rawReduced, ballsReduced, oversEquivalent, remBalls, effectiveOversFloat, effectiveOversDisplay
    };
  };

  const formatTimerClock = (secs: number, unit?: string) => {
    const hrs = String(Math.floor(secs / 3600)).padStart(2, '0');
    const mins = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
    const secStr = String(secs % 60).padStart(2, '0');
    return unit === 'HOURS' ? `${hrs}:${mins}:${secStr}` : `${mins}:${secStr}`;
  };

  const handleCompleteTeamAttendance = (team: 'A' | 'B') => {
    const minReq = getMinRequiredPlayers();
    const players = team === 'A' ? (setupData?.teamAPlayers || []) : (setupData?.teamBPlayers || []);
    const subPlayers = team === 'A' ? (setupData?.teamASubstitutePlayers || []) : (setupData?.teamBSubstitutePlayers || []);
    const att = team === 'A' ? attendanceA : attendanceB;
    const subAtt = team === 'A' ? subAttendanceA : subAttendanceB;
    const presentMain = players.filter((p: any) => att[p.id]);
    const selectedSubs = subPlayers.filter((p: any) => subAtt[p.id]);
    const presentCount = presentMain.length + selectedSubs.length;
    const tName = team === 'A' ? (setupData?.teamA?.name || 'Team A') : (setupData?.teamB?.name || 'Team B');

    if (presentCount < minReq) {
      showWarning(
        `Rule 15: Minimum ${minReq} Players Required`,
        `${tName} has only ${presentCount} player(s) marked Present. At least ${minReq} players must be present to mark Attendance Completed.`
      );
      return;
    }

    const lockedElapsed = delayElapsedSeconds;
    const bothCompleted = team === 'A' ? teamBCompleted : teamACompleted;
    const stats = computeTeamDelayStats(lockedElapsed);

    const applyStop = () => {
      if (team === 'A') {
        setTeamACompleted(true);
        setTeamAStoppedElapsed(lockedElapsed);
        if (bothCompleted) {
          setDelayTimerRunning(false);
          setDelayTimerStartedAt(null);
          setDelayBaseElapsed(lockedElapsed);
        }
        persistDelayState({
          ...(bothCompleted ? { running: false, startedAt: null, elapsedSeconds: lockedElapsed } : {}),
          teamACompleted: true,
          teamAStoppedElapsed: lockedElapsed,
          ...(stats.ballsReduced > 0 ? { teamAOvers: stats.effectiveOversFloat } : {})
        });
      } else {
        setTeamBCompleted(true);
        setTeamBStoppedElapsed(lockedElapsed);
        if (bothCompleted) {
          setDelayTimerRunning(false);
          setDelayTimerStartedAt(null);
          setDelayBaseElapsed(lockedElapsed);
        }
        persistDelayState({
          ...(bothCompleted ? { running: false, startedAt: null, elapsedSeconds: lockedElapsed } : {}),
          teamBCompleted: true,
          teamBStoppedElapsed: lockedElapsed,
          ...(stats.ballsReduced > 0 ? { teamBOvers: stats.effectiveOversFloat } : {})
        });
      }
    };

    const confirmMsg = `Confirm Attendance Completed for ${tName} (${presentCount} Present)?\n\nThis will stop the delay timer for ${tName} at ${formatTimerClock(lockedElapsed, stats.intervalUnit)} (${stats.effectiveOversDisplay} Ov).`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(confirmMsg)) applyStop();
    } else {
      Alert.alert(
        'Confirm Attendance Completed',
        confirmMsg,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm Stop', onPress: applyStop }
        ]
      );
    }
  };

  const handleApplyTeamPenalty = (team: 'A' | 'B') => {
    const effElapsed = team === 'A'
      ? (teamACompleted && teamAStoppedElapsed !== null ? teamAStoppedElapsed : delayElapsedSeconds)
      : (teamBCompleted && teamBStoppedElapsed !== null ? teamBStoppedElapsed : delayElapsedSeconds);
    const stats = computeTeamDelayStats(effElapsed);
    const nextOv = stats.effectiveOversFloat;

    if (team === 'A') {
      setTeamAOvers(nextOv);
      setDelayPenaltyApplied(true);
      setDelayPenaltyAppliedOvers(Math.max(delayPenaltyAppliedOvers, stats.oversEquivalent));
      persistDelayState({
        teamAOvers: nextOv,
        penaltyApplied: true,
        penaltyOvers: Math.max(delayPenaltyAppliedOvers, stats.oversEquivalent)
      });
    } else {
      setTeamBOvers(nextOv);
      setDelayPenaltyApplied(true);
      setDelayPenaltyAppliedOvers(Math.max(delayPenaltyAppliedOvers, stats.oversEquivalent));
      persistDelayState({
        teamBOvers: nextOv,
        penaltyApplied: true,
        penaltyOvers: Math.max(delayPenaltyAppliedOvers, stats.oversEquivalent)
      });
    }
  };

  const handleResumeTeamTimer = (team: 'A' | 'B') => {
    if (team === 'A') {
      setTeamACompleted(false);
      setTeamAStoppedElapsed(null);
      persistDelayState({ teamACompleted: false, teamAStoppedElapsed: null });
    } else {
      setTeamBCompleted(false);
      setTeamBStoppedElapsed(null);
      persistDelayState({ teamBCompleted: false, teamBStoppedElapsed: null });
    }
  };

  const handleProceedToToss = () => {
    const minReq = getMinRequiredPlayers();
    const presentMainA = (setupData?.teamAPlayers || []).filter((p: any) => attendanceA[p.id]);
    const selectedSubsA = (setupData?.teamASubstitutePlayers || []).filter((p: any) => subAttendanceA[p.id]);
    const presentA = [...presentMainA, ...selectedSubsA];

    const presentMainB = (setupData?.teamBPlayers || []).filter((p: any) => attendanceB[p.id]);
    const selectedSubsB = (setupData?.teamBSubstitutePlayers || []).filter((p: any) => subAttendanceB[p.id]);
    const presentB = [...presentMainB, ...selectedSubsB];

    if (presentA.length < minReq) {
      showWarning(
        `Rule 15: Minimum ${minReq} Players Required`,
        `${setupData?.teamA?.name || 'Team A'} has only ${presentA.length} players marked present. Please mark at least ${minReq} players before proceeding to Toss.`
      );
      return;
    }

    if (presentB.length < minReq) {
      showWarning(
        `Rule 15: Minimum ${minReq} Players Required`,
        `${setupData?.teamB?.name || 'Team B'} has only ${presentB.length} players marked present. Please mark at least ${minReq} players before proceeding to Toss.`
      );
      return;
    }

    if (!teamACompleted) {
      showWarning(
        'Complete Team A Attendance First',
        `Please complete attendance for ${setupData?.teamA?.name || 'Team A'} before proceeding to Toss.`
      );
      return;
    }
    if (!teamBCompleted) {
      showWarning(
        'Complete Team B Attendance First',
        `Please complete attendance for ${setupData?.teamB?.name || 'Team B'} before proceeding to Toss.`
      );
      return;
    }

    const effElapsedA = teamACompleted && teamAStoppedElapsed !== null ? teamAStoppedElapsed : delayElapsedSeconds;
    const effElapsedB = teamBCompleted && teamBStoppedElapsed !== null ? teamBStoppedElapsed : delayElapsedSeconds;
    const statsA = computeTeamDelayStats(effElapsedA);
    const statsB = computeTeamDelayStats(effElapsedB);
    const baseOv = Number(setupData?.overs || 20);
    const nextA = delayPenaltySkipped ? baseOv : statsA.effectiveOversFloat;
    const nextB = delayPenaltySkipped ? baseOv : statsB.effectiveOversFloat;
    const maxPen = delayPenaltySkipped ? 0 : Math.max(statsA.oversEquivalent, statsB.oversEquivalent);

    setDelayTimerRunning(false);
    setDelayTimerStartedAt(null);
    setTeamAOvers(nextA);
    setTeamBOvers(nextB);
    setDelayPenaltyAppliedOvers(maxPen);
    setDelayPenaltyApplied(!delayPenaltySkipped && maxPen > 0);
    persistDelayState({
      running: false,
      startedAt: null,
      elapsedSeconds: delayElapsedSeconds,
      penaltyOvers: maxPen,
      penaltyApplied: !delayPenaltySkipped && maxPen > 0,
      teamAOvers: nextA,
      teamBOvers: nextB,
      teamACompleted: true,
      teamAStoppedElapsed: effElapsedA,
      teamBCompleted: true,
      teamBStoppedElapsed: effElapsedB
    });

    setSetupStep(2);
  };

  // Quick Attendance Actions
  const toggleAttendanceA = (pid: string) => {
    const mainPlayers = setupData?.teamAPlayers || [];
    const subPlayers = setupData?.teamASubstitutePlayers || [];
    setAttendanceA(prev => {
      const next = { ...prev, [pid]: !prev[pid] };
      const presentMainCount = mainPlayers.filter((p: any) => next[p.id]).length;
      const newAbsentCount = Math.max(0, mainPlayers.length - presentMainCount);
      setSubAttendanceA(prevSub => {
        const tickedSubs = subPlayers.filter((s: any) => prevSub[s.id]);
        if (tickedSubs.length <= newAbsentCount) return prevSub;
        const trimmed = { ...prevSub };
        for (let i = newAbsentCount; i < tickedSubs.length; i++) {
          trimmed[tickedSubs[i].id] = false;
        }
        return trimmed;
      });
      if (teamACompleted) {
        setTeamACompleted(false);
        setTeamAStoppedElapsed(null);
        persistDelayState({ teamACompleted: false, teamAStoppedElapsed: null });
      }
      return next;
    });
  };

  const toggleAttendanceB = (pid: string) => {
    const mainPlayers = setupData?.teamBPlayers || [];
    const subPlayers = setupData?.teamBSubstitutePlayers || [];
    setAttendanceB(prev => {
      const next = { ...prev, [pid]: !prev[pid] };
      const presentMainCount = mainPlayers.filter((p: any) => next[p.id]).length;
      const newAbsentCount = Math.max(0, mainPlayers.length - presentMainCount);
      setSubAttendanceB(prevSub => {
        const tickedSubs = subPlayers.filter((s: any) => prevSub[s.id]);
        if (tickedSubs.length <= newAbsentCount) return prevSub;
        const trimmed = { ...prevSub };
        for (let i = newAbsentCount; i < tickedSubs.length; i++) {
          trimmed[tickedSubs[i].id] = false;
        }
        return trimmed;
      });
      if (teamBCompleted) {
        setTeamBCompleted(false);
        setTeamBStoppedElapsed(null);
        persistDelayState({ teamBCompleted: false, teamBStoppedElapsed: null });
      }
      return next;
    });
  };

  const toggleSubAttendanceA = (pid: string) => {
    const mainPlayers = setupData?.teamAPlayers || [];
    const subPlayers = setupData?.teamASubstitutePlayers || [];
    const absentCount = mainPlayers.filter((p: any) => !attendanceA[p.id]).length;
    const isCurrentlyChecked = Boolean(subAttendanceA[pid]);
    if (!isCurrentlyChecked) {
      if (absentCount === 0) {
        showWarning('No Absent Player', 'All Playing XI players are marked Present. Mark an absent player first before ticking a substitute.');
        return;
      }
      const selectedSubCount = subPlayers.filter((s: any) => subAttendanceA[s.id]).length;
      if (selectedSubCount >= absentCount) {
        showWarning('Substitute Limit Reached', `Only ${absentCount} player(s) are marked Absent. You can tick at most ${absentCount} substitute(s).`);
        return;
      }
    }
    setSubAttendanceA(prev => ({ ...prev, [pid]: !prev[pid] }));
    if (teamACompleted) {
      setTeamACompleted(false);
      setTeamAStoppedElapsed(null);
      persistDelayState({ teamACompleted: false, teamAStoppedElapsed: null });
    }
  };

  const toggleSubAttendanceB = (pid: string) => {
    const mainPlayers = setupData?.teamBPlayers || [];
    const subPlayers = setupData?.teamBSubstitutePlayers || [];
    const absentCount = mainPlayers.filter((p: any) => !attendanceB[p.id]).length;
    const isCurrentlyChecked = Boolean(subAttendanceB[pid]);
    if (!isCurrentlyChecked) {
      if (absentCount === 0) {
        showWarning('No Absent Player', 'All Playing XI players are marked Present. Mark an absent player first before ticking a substitute.');
        return;
      }
      const selectedSubCount = subPlayers.filter((s: any) => subAttendanceB[s.id]).length;
      if (selectedSubCount >= absentCount) {
        showWarning('Substitute Limit Reached', `Only ${absentCount} player(s) are marked Absent. You can tick at most ${absentCount} substitute(s).`);
        return;
      }
    }
    setSubAttendanceB(prev => ({ ...prev, [pid]: !prev[pid] }));
    if (teamBCompleted) {
      setTeamBCompleted(false);
      setTeamBStoppedElapsed(null);
      persistDelayState({ teamBCompleted: false, teamBStoppedElapsed: null });
    }
  };

  const selectAllA = () => {
    const next: Record<string, boolean> = {};
    (setupData?.teamAPlayers || []).forEach((p: any) => { next[p.id] = true; });
    setAttendanceA(next);
    setSubAttendanceA({});
    if (teamACompleted) {
      setTeamACompleted(false);
      setTeamAStoppedElapsed(null);
      persistDelayState({ teamACompleted: false, teamAStoppedElapsed: null });
    }
  };

  const select11A = () => {
    const next: Record<string, boolean> = {};
    (setupData?.teamAPlayers || []).forEach((p: any, idx: number) => { next[p.id] = idx < 11; });
    setAttendanceA(next);
    setSubAttendanceA({});
    if (teamACompleted) {
      setTeamACompleted(false);
      setTeamAStoppedElapsed(null);
      persistDelayState({ teamACompleted: false, teamAStoppedElapsed: null });
    }
  };

  const clearA = () => {
    setAttendanceA({});
    setSubAttendanceA({});
    if (teamACompleted) {
      setTeamACompleted(false);
      setTeamAStoppedElapsed(null);
      persistDelayState({ teamACompleted: false, teamAStoppedElapsed: null });
    }
  };

  const selectAllB = () => {
    const next: Record<string, boolean> = {};
    (setupData?.teamBPlayers || []).forEach((p: any) => { next[p.id] = true; });
    setAttendanceB(next);
    setSubAttendanceB({});
    if (teamBCompleted) {
      setTeamBCompleted(false);
      setTeamBStoppedElapsed(null);
      persistDelayState({ teamBCompleted: false, teamBStoppedElapsed: null });
    }
  };

  const select11B = () => {
    const next: Record<string, boolean> = {};
    (setupData?.teamBPlayers || []).forEach((p: any, idx: number) => { next[p.id] = idx < 11; });
    setAttendanceB(next);
    setSubAttendanceB({});
    if (teamBCompleted) {
      setTeamBCompleted(false);
      setTeamBStoppedElapsed(null);
      persistDelayState({ teamBCompleted: false, teamBStoppedElapsed: null });
    }
  };

  const clearB = () => {
    setAttendanceB({});
    setSubAttendanceB({});
    if (teamBCompleted) {
      setTeamBCompleted(false);
      setTeamBStoppedElapsed(null);
      persistDelayState({ teamBCompleted: false, teamBStoppedElapsed: null });
    }
  };

  const handleStartMatch = async () => {
    if (!tossWinner) {
      showWarning('Toss Required', 'Please select the Toss Winner before starting the match.');
      return;
    }

    const parsedOvers = parseInt(matchOvers || '20', 10);
    if (isNaN(parsedOvers) || parsedOvers <= 0) {
      showWarning('Invalid Overs', 'Please enter a valid number of overs per side (e.g. 15 or 20).');
      return;
    }

    if (!teamACompleted || !teamBCompleted) {
      showWarning(
        'Both Teams Attendance Required',
        'Please complete attendance for both Team A and Team B before starting the match.'
      );
      return;
    }

    // Association Rule 15: Dynamic minimum players configured by Admin
    const rule15Enabled = setupData?.rule15?.enabled !== false;
    const minRequiredPlayers = rule15Enabled ? (setupData?.rule15?.minPlayers ?? 9) : 1;
    const presentMainA = (setupData?.teamAPlayers || []).filter((p: any) => attendanceA[p.id]);
    const selectedSubsA = (setupData?.teamASubstitutePlayers || []).filter((p: any) => subAttendanceA[p.id]);
    const presentA = [...presentMainA, ...selectedSubsA];

    const presentMainB = (setupData?.teamBPlayers || []).filter((p: any) => attendanceB[p.id]);
    const selectedSubsB = (setupData?.teamBSubstitutePlayers || []).filter((p: any) => subAttendanceB[p.id]);
    const presentB = [...presentMainB, ...selectedSubsB];

    if (presentA.length < minRequiredPlayers) {
      showWarning(
        `Rule 15: Minimum ${minRequiredPlayers} Players Required`,
        `Rule 15: A minimum of ${minRequiredPlayers} players must be present at the start of each innings.\n\n${teamA.name} has only ${presentA.length} players marked present. Please mark attendance for at least ${minRequiredPlayers} players before starting.`
      );
      return;
    }

    if (presentB.length < minRequiredPlayers) {
      showWarning(
        `Rule 15: Minimum ${minRequiredPlayers} Players Required`,
        `Rule 15: A minimum of ${minRequiredPlayers} players must be present at the start of each innings.\n\n${teamB.name} has only ${presentB.length} players marked present. Please mark attendance for at least ${minRequiredPlayers} players before starting.`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const effElapsedA = teamACompleted && teamAStoppedElapsed !== null ? teamAStoppedElapsed : delayElapsedSeconds;
      const effElapsedB = teamBCompleted && teamBStoppedElapsed !== null ? teamBStoppedElapsed : delayElapsedSeconds;
      const statsA = computeTeamDelayStats(effElapsedA);
      const statsB = computeTeamDelayStats(effElapsedB);
      const baseOv = Number(setupData?.overs || parsedOvers);
      const finalTeamAOvers = delayPenaltySkipped
        ? baseOv
        : (delayPenaltyApplied && teamAOvers !== null ? teamAOvers : statsA.effectiveOversFloat);
      const finalTeamBOvers = delayPenaltySkipped
        ? baseOv
        : (delayPenaltyApplied && teamBOvers !== null ? teamBOvers : statsB.effectiveOversFloat);
      const maxPenaltyOv = delayPenaltySkipped
        ? 0
        : Math.max(delayPenaltyAppliedOvers, statsA.oversEquivalent, statsB.oversEquivalent);
      const resolvedPenaltyTeam = delayPenaltySkipped || maxPenaltyOv === 0
        ? 'NONE'
        : (finalTeamAOvers < baseOv && finalTeamBOvers < baseOv ? 'BOTH' : delayPenaltyTeam);

      const payload = {
        tossWinner,
        tossDecision,
        overs: parsedOvers,
        totalOvers: parsedOvers,
        delayPenaltyOvers: maxPenaltyOv,
        delayPenaltySkipped,
        delayPenaltyTeam: resolvedPenaltyTeam,
        teamAOvers: finalTeamAOvers,
        teamBOvers: finalTeamBOvers,
        teamAPlayingXI: presentA.map((p: any) => p.id),
        teamBPlayingXI: presentB.map((p: any) => p.id),
        teamAAttendance: presentA.map((p: any) => p.id),
        teamBAttendance: presentB.map((p: any) => p.id)
      };

      const res = await ScorerApi.startMatch(matchId, payload);
      if (res && res.success) {
        navigate('LiveScoring', { matchId });
      }
    } catch (err: any) {
      showError('Start Error', err.message || 'Error starting match');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <CricketLoader />;
  }

  const teamA = setupData?.teamA || { id: 'T001', name: 'Team A' };
  const teamB = setupData?.teamB || { id: 'T002', name: 'Team B' };
  const teamAPlayers = setupData?.teamAPlayers || [];
  const teamBPlayers = setupData?.teamBPlayers || [];
  const teamASubstitutePlayers = setupData?.teamASubstitutePlayers || [];
  const teamBSubstitutePlayers = setupData?.teamBSubstitutePlayers || [];

  const renderSubstituteSection = (team: 'A' | 'B') => {
    const mainPlayers = team === 'A' ? teamAPlayers : teamBPlayers;
    const subPlayers = team === 'A' ? teamASubstitutePlayers : teamBSubstitutePlayers;
    const att = team === 'A' ? attendanceA : attendanceB;
    const subAtt = team === 'A' ? subAttendanceA : subAttendanceB;
    const toggleSub = team === 'A' ? toggleSubAttendanceA : toggleSubAttendanceB;

    if (!subPlayers || subPlayers.length === 0) return null;

    const absentCount = mainPlayers.filter((p: any) => !att[p.id]).length;
    const selectedSubCount = subPlayers.filter((p: any) => subAtt[p.id]).length;

    return (
      <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#cbd5e1', borderStyle: 'dashed' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#0f172a' }}>
            🔄 Substitutes ({selectedSubCount}/{absentCount} Used)
          </Text>
          <Text style={{ fontSize: 10.5, fontWeight: '700', color: absentCount > 0 ? '#b45309' : '#64748b' }}>
            {absentCount === 0
              ? 'No absent player'
              : selectedSubCount < Math.min(absentCount, subPlayers.length)
                ? `Tick ${Math.min(absentCount, subPlayers.length) - selectedSubCount} sub(s)`
                : 'Substitute(s) matched'}
          </Text>
        </View>
        {subPlayers.map((p: any, idx: number) => {
          const isSubSelected = Boolean(subAtt[p.id]);
          const isLocked = !isSubSelected && (absentCount === 0 || selectedSubCount >= absentCount);
          return (
            <TouchableOpacity
              key={p.id || `sub-${idx}`}
              style={[
                styles.playerItem,
                isSubSelected ? styles.playerItemPresent : { backgroundColor: '#f8fafc', borderRadius: 4, paddingHorizontal: 6, opacity: isLocked ? 0.55 : 0.95 }
              ]}
              onPress={() => toggleSub(p.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkboxBox, isSubSelected && styles.checkboxBoxChecked]}>
                <Text style={[styles.checkboxCheck, isSubSelected && styles.checkboxCheckChecked]}>
                  {isSubSelected ? '✓' : ''}
                </Text>
              </View>

              <View style={[styles.playerNumBadge, isSubSelected && styles.playerNumBadgePresent]}>
                <Text style={[styles.playerNumber, isSubSelected && styles.playerNumberPresent]}>
                  SUB
                </Text>
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.playerName} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={styles.playerRoleSub}>{p.role || 'Substitute'}</Text>
              </View>

              <View style={styles.playerBadgesRow}>
                <View style={[styles.statusPill, isSubSelected ? styles.statusPillPresent : { backgroundColor: '#e2e8f0' }]}>
                  <Text style={[styles.statusPillText, isSubSelected ? styles.statusPillTextPresent : { color: '#475569' }]}>
                    {isSubSelected ? 'SUB IN' : 'BENCH'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const oversNum = Number(setupData?.overs || 20);
  const matchFormat = oversNum <= 20 ? 'T20' : oversNum <= 50 ? 'One Day' : 'Multi-Day';
  const tossWinnerName = tossWinner === teamA.id ? teamA.name : (tossWinner === teamB.id ? teamB.name : '');

  // Render a player item row with Attendance Checkbox
  const renderPlayerRow = (p: any, idx: number, team: 'A' | 'B') => {
    const isWk = Boolean(p.is_wicket_keeper) || p.role === 'WICKET_KEEPER' || p.role === 'Wicket Keeper';
    const isCap = Boolean(p.is_captain) || (idx === 0 && p.is_captain === undefined);
    const isPresent = team === 'A' ? Boolean(attendanceA[p.id]) : Boolean(attendanceB[p.id]);
    const toggle = team === 'A' ? () => toggleAttendanceA(p.id) : () => toggleAttendanceB(p.id);

    return (
      <TouchableOpacity
        key={p.id || idx}
        style={[styles.playerItem, isPresent ? styles.playerItemPresent : styles.playerItemAbsent]}
        onPress={toggle}
        activeOpacity={0.7}
      >
        {/* Attendance Checkbox */}
        <View style={[styles.checkboxBox, isPresent && styles.checkboxBoxChecked]}>
          <Text style={[styles.checkboxCheck, isPresent && styles.checkboxCheckChecked]}>
            {isPresent ? '✓' : ''}
          </Text>
        </View>

        <View style={[styles.playerNumBadge, isPresent && styles.playerNumBadgePresent]}>
          <Text style={[styles.playerNumber, isPresent && styles.playerNumberPresent]}>
            #{p.jersey_number || idx + 1}
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.playerName, !isPresent && styles.playerNameAbsent]} numberOfLines={1}>
            {p.name}
          </Text>
          <Text style={styles.playerRoleSub}>{p.role || 'Batter'}</Text>
        </View>

        <View style={styles.playerBadgesRow}>
          {isCap && <View style={styles.cBadge}><Text style={styles.cBadgeText}>C</Text></View>}
          {isWk && <View style={styles.wkBadge}><Text style={styles.wkBadgeText}>WK</Text></View>}
          <View style={[styles.statusPill, isPresent ? styles.statusPillPresent : styles.statusPillAbsent]}>
            <Text style={[styles.statusPillText, isPresent ? styles.statusPillTextPresent : styles.statusPillTextAbsent]}>
              {isPresent ? 'Present' : 'Absent'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* COMPACT TOP HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigate('Dashboard')} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backText}>&larr; Exit to Dashboard</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Match Setup &amp; Playing XI</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.matchPill}>
            <Text style={styles.matchPillText} numberOfLines={1}>
              {setupData?.tournament || 'VPL 2026'} • <Text style={{ color: '#facc15' }}>{teamA.name}</Text> vs <Text style={{ color: '#facc15' }}>{teamB.name}</Text>
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{setupData?.status || 'SCHEDULED'}</Text>
          </View>
        </View>
      </View>

      {/* MAIN VIEWPORT - RESPONSIVE DESKTOP & MOBILE */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentWrapper}>
          {/* STEP WIZARD INDICATOR */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <TouchableOpacity
              onPress={() => setSetupStep(1)}
              style={{
                flex: 1,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 8,
                backgroundColor: setupStep === 1 ? '#0f172a' : '#e2e8f0',
                alignItems: 'center'
              }}
            >
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: setupStep === 1 ? '#facc15' : '#475569' }} numberOfLines={1}>
                1. Details, Timer &amp; Attendance
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (setupStep === 2) return;
                handleProceedToToss();
              }}
              style={{
                flex: 1,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 8,
                backgroundColor: setupStep === 2 ? '#0f172a' : '#e2e8f0',
                alignItems: 'center'
              }}
            >
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: setupStep === 2 ? '#facc15' : '#475569' }} numberOfLines={1}>
                2. Toss &amp; Start Match
              </Text>
            </TouchableOpacity>
          </View>

          {setupStep === 1 ? (
            <>
            {/* STEP 1: MATCH DETAILS, RULE 5 TIMER, AND TEAM ATTENDANCE */}
            <View style={styles.mainGrid}>
              <View style={styles.leftCol}>
              
              {/* CARD 1: MATCH DETAILS */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardHeader}>Match Details</Text>
                  <Text style={styles.cardBadge}>{matchFormat} Format</Text>
                </View>
                <View style={styles.detailsGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>TOURNAMENT</Text>
                    <Text style={styles.detailVal} numberOfLines={1}>{setupData?.tournament || 'District Championship'}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>VENUE</Text>
                    <Text style={styles.detailVal} numberOfLines={1}>{setupData?.venue || 'Kamarajar Stadium, Virudhunagar'}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>OVERS PER SIDE</Text>
                    <Text style={styles.detailVal}>{matchOvers || oversNum} Overs per side</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>MATCH STATUS</Text>
                    <Text style={[styles.detailVal, { color: '#eab308' }]}>{setupData?.status || 'SCHEDULED'}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>TOURNAMENT FORMAT</Text>
                    <Text style={styles.detailVal} numberOfLines={1}>
                      {setupData?.tournamentRules?.tournament_format_label || 'Single Round Robin'}
                    </Text>
                  </View>
                  {setupData?.tournamentRules?.match_stage ? (
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>STAGE</Text>
                      <Text style={styles.detailVal} numberOfLines={1}>
                        {String(setupData.tournamentRules.match_stage).replace(/_/g, ' ')}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>MAX OVERS / BOWLER</Text>
                    <Text style={styles.detailVal} numberOfLines={1}>
                      {setupData?.tournamentRules?.max_overs_per_bowler || Math.max(1, Math.ceil((Number(setupData?.overs || 20)) / 5))} Overs
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>CHAIN OVER</Text>
                    <Text style={[styles.detailVal, { color: setupData?.tournamentRules?.allow_chain_over ? '#16a34a' : '#64748b' }]} numberOfLines={1}>
                      {setupData?.tournamentRules?.allow_chain_over ? '✓ Allowed' : 'Not Allowed'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* CARD 2: RULE 5 - MATCH START & PER-TEAM DELAY TIMER (RIGHT BELOW MATCH DETAILS) */}
              {(() => {
                const tr = setupData?.tournamentRules || {};
                if (tr.delay_penalty_enabled === false) return null;
                const minReq = getMinRequiredPlayers();
                const presentCountA = teamAPlayers.filter((p: any) => attendanceA[p.id]).length;
                const presentCountB = teamBPlayers.filter((p: any) => attendanceB[p.id]).length;

                const effElapsedA = teamACompleted && teamAStoppedElapsed !== null ? teamAStoppedElapsed : delayElapsedSeconds;
                const effElapsedB = teamBCompleted && teamBStoppedElapsed !== null ? teamBStoppedElapsed : delayElapsedSeconds;
                const statsA = computeTeamDelayStats(effElapsedA);
                const statsB = computeTeamDelayStats(effElapsedB);
                const unitShort = statsA.intervalUnit === 'HOURS' ? 'hr' : (statsA.intervalUnit === 'SECONDS' ? 'sec' : 'min');
                const penaltyShort = statsA.reduceUnit === 'BALLS' ? 'Balls' : 'Ov';
                const secsToNext = statsA.intervalSec - (delayElapsedSeconds % Math.max(1, statsA.intervalSec));

                return (
                  <View style={[styles.card, { borderColor: delayPenaltySkipped ? '#cbd5e1' : '#f59e0b', borderWidth: 1.5, backgroundColor: delayPenaltySkipped ? '#f8fafc' : '#fffbeb' }]}>
                    <View style={styles.cardHeaderRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.cardHeader, { color: delayPenaltySkipped ? '#475569' : '#9a3412' }]}>
                          ⏱️ Match Start &amp; Delay Timer
                        </Text>
                        <Text style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>
                          -{statsA.amountPerStep} {penaltyShort} / {statsA.intervalVal} {unitShort} • Stop each team when {minReq}+ players arrive
                        </Text>
                      </View>
                      <View style={{ backgroundColor: '#0f172a', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                        <Text style={{ fontSize: 15, fontWeight: '900', color: '#facc15', fontVariant: ['tabular-nums'] }}>
                          {formatTimerClock(delayElapsedSeconds, statsA.intervalUnit)}
                        </Text>
                      </View>
                    </View>

                    <Text style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
                      {delayPenaltySkipped
                        ? 'Delay penalty skipped / waived by Scorer.'
                        : (teamACompleted && teamBCompleted)
                          ? '✅ Both teams attendance completed — Timer automatically stopped.'
                          : delayTimerRunning
                            ? `Timer running • Next -${statsA.amountPerStep} ${penaltyShort} in ${secsToNext}s (for teams still running)`
                            : 'Start timer sharp at match time. Stop each team individually once their attendance (9+ players) is completed.'}
                    </Text>

                    {/* Master Timer Controls */}
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                      {!delayPenaltySkipped && (
                        <>
                          <TouchableOpacity
                            onPress={() => {
                              if (delayTimerRunning) {
                                const nowElapsed = delayElapsedSeconds;
                                setDelayTimerRunning(false);
                                setDelayTimerStartedAt(null);
                                setDelayBaseElapsed(nowElapsed);
                                persistDelayState({ running: false, startedAt: null, elapsedSeconds: nowElapsed });
                              } else {
                                const nowIso = new Date().toISOString();
                                setDelayTimerRunning(true);
                                setDelayTimerStartedAt(nowIso);
                                persistDelayState({ running: true, startedAt: nowIso, elapsedSeconds: delayBaseElapsed });
                              }
                            }}
                            style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6, backgroundColor: delayTimerRunning ? '#dc2626' : '#0f766e' }}
                          >
                            <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#ffffff' }}>
                              {delayTimerRunning ? '⏸ Pause Timer' : '▶ Start Timer'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              setDelayTimerRunning(false);
                              setDelayTimerStartedAt(null);
                              setDelayBaseElapsed(0);
                              setDelayElapsedSeconds(0);
                              setDelayPenaltyAppliedOvers(0);
                              setDelayPenaltyApplied(false);
                              setTeamAOvers(null);
                              setTeamBOvers(null);
                              setTeamACompleted(false);
                              setTeamAStoppedElapsed(null);
                              setTeamBCompleted(false);
                              setTeamBStoppedElapsed(null);
                              setMatchOvers(String(statsA.baseOvers));
                              persistDelayState({
                                running: false, startedAt: null, elapsedSeconds: 0,
                                penaltyOvers: 0, penaltyApplied: false, teamAOvers: null, teamBOvers: null,
                                teamACompleted: false, teamAStoppedElapsed: null, teamBCompleted: false, teamBStoppedElapsed: null
                              });
                            }}
                            style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 6, backgroundColor: '#e2e8f0' }}
                          >
                            <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#334155' }}>Reset</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      <TouchableOpacity
                        onPress={() => {
                          if (delayPenaltySkipped) {
                            setDelayPenaltySkipped(false);
                            persistDelayState({ skipped: false });
                          } else {
                            setDelayTimerRunning(false);
                            setDelayTimerStartedAt(null);
                            setDelayBaseElapsed(delayElapsedSeconds);
                            setDelayPenaltySkipped(true);
                            setDelayPenaltyAppliedOvers(0);
                            setDelayPenaltyApplied(false);
                            setTeamAOvers(null);
                            setTeamBOvers(null);
                            setMatchOvers(String(statsA.baseOvers));
                            persistDelayState({
                              running: false, startedAt: null, elapsedSeconds: delayElapsedSeconds,
                              skipped: true, penaltyOvers: 0, penaltyApplied: false, teamAOvers: null, teamBOvers: null
                            });
                          }
                        }}
                        style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 6, borderWidth: 1, borderColor: '#94a3b8', backgroundColor: '#ffffff', marginLeft: 'auto' }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#334155' }}>
                          {delayPenaltySkipped ? '↺ Re-enable Penalty' : '⏭️ Skip Penalty'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Independent Per-Team Penalty & Stop Controls */}
                    {!delayPenaltySkipped && (
                      <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 8 }}>
                        {([
                          { key: 'A' as const, name: teamA.name, completed: teamACompleted, effElapsed: effElapsedA, stats: statsA, present: presentCountA, appliedOvers: teamAOvers },
                          { key: 'B' as const, name: teamB.name, completed: teamBCompleted, effElapsed: effElapsedB, stats: statsB, present: presentCountB, appliedOvers: teamBOvers }
                        ]).map((tm) => {
                          const canStop = tm.present >= minReq;
                          const isTeamApplied = delayPenaltyApplied && tm.appliedOvers === tm.stats.effectiveOversFloat && tm.stats.ballsReduced > 0;
                          return (
                            <View
                              key={tm.key}
                              style={{
                                flex: 1,
                                padding: 9,
                                borderRadius: 8,
                                backgroundColor: tm.completed ? '#f0fdf4' : '#ffffff',
                                borderWidth: 1.5,
                                borderColor: tm.completed ? '#16a34a' : (tm.stats.ballsReduced > 0 ? '#ef4444' : '#cbd5e1')
                              }}
                            >
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <Text style={{ fontSize: 12, fontWeight: '800', color: '#0f172a', flex: 1, minWidth: 0 }} numberOfLines={1}>
                                  {tm.name}
                                </Text>
                                <View style={{
                                  paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
                                  backgroundColor: tm.completed ? '#dcfce7' : (delayTimerRunning ? '#fef2f2' : '#f1f5f9')
                                }}>
                                  <Text style={{ fontSize: 9.5, fontWeight: '800', color: tm.completed ? '#15803d' : (delayTimerRunning ? '#dc2626' : '#475569') }}>
                                    {tm.completed ? '✅ STOPPED' : (delayTimerRunning ? '⏳ RUNNING' : '⏸ READY')}
                                  </Text>
                                </View>
                              </View>
                              <Text style={{ fontSize: 11, color: '#334155', fontWeight: '700' }}>
                                Time: {formatTimerClock(tm.effElapsed, tm.stats.intervalUnit)} • Overs: <Text style={{ color: tm.stats.ballsReduced > 0 ? '#dc2626' : '#0f766e', fontWeight: '900' }}>{tm.stats.effectiveOversDisplay} Ov</Text>
                                {tm.stats.ballsReduced > 0 ? ` (-${tm.stats.rawReduced} ${penaltyShort})` : ' (No Penalty)'}
                              </Text>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, gap: 6, flexWrap: 'wrap' }}>
                                <Text style={{ fontSize: 10, color: canStop ? '#15803d' : '#b45309', fontWeight: '700' }}>
                                  Att: {tm.present}/{minReq} {canStop ? '✓' : '(Need ' + (minReq - tm.present) + ')'}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                  {tm.stats.ballsReduced > 0 && (
                                    <TouchableOpacity
                                      onPress={() => handleApplyTeamPenalty(tm.key)}
                                      style={{
                                        paddingHorizontal: 8,
                                        paddingVertical: 4,
                                        borderRadius: 5,
                                        backgroundColor: isTeamApplied ? '#16a34a' : '#ea580c'
                                      }}
                                    >
                                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#ffffff' }}>
                                        {isTeamApplied
                                          ? `✓ Applied (${tm.stats.effectiveOversDisplay} Ov)`
                                          : `Apply (-${tm.stats.rawReduced} ${penaltyShort})`}
                                      </Text>
                                    </TouchableOpacity>
                                  )}
                                  {tm.completed ? (
                                    <TouchableOpacity
                                      onPress={() => handleResumeTeamTimer(tm.key)}
                                      style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, backgroundColor: '#e2e8f0' }}
                                    >
                                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#334155' }}>↺ Resume</Text>
                                    </TouchableOpacity>
                                  ) : (
                                    <TouchableOpacity
                                      onPress={() => handleCompleteTeamAttendance(tm.key)}
                                      style={{
                                        paddingHorizontal: 9,
                                        paddingVertical: 4,
                                        borderRadius: 5,
                                        backgroundColor: canStop ? '#16a34a' : '#f59e0b'
                                      }}
                                    >
                                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#ffffff' }}>
                                        ✓ Stop (Att. Done)
                                      </Text>
                                    </TouchableOpacity>
                                  )}
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })()}

            </View>

            {/* RIGHT COLUMN: Squads & Registered Roster with Interactive Attendance */}
            <View style={styles.rightCol}>
              <View style={[styles.card, styles.squadsCard]}>
                
                {/* Header */}
                <View style={styles.cardHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardHeader}>Match Squad Attendance &amp; Playing Squad</Text>
                    <Text style={styles.sectionHelp}>
                      {setupData?.rule15?.enabled === false
                        ? 'Scorer Attendance Checklist • Tap players to mark Present (Min 1 player per team)'
                        : `Scorer Attendance Checklist • Tap players to mark Present (Min ${setupData?.rule15?.minPlayers ?? 9} players per team)`}
                    </Text>
                  </View>
                  <View style={styles.xiMainBadge}>
                    <Text style={styles.xiMainBadgeText}>
                      {teamAPlayers.filter((p: any) => attendanceA[p.id]).length + teamASubstitutePlayers.filter((p: any) => subAttendanceA[p.id]).length} Present vs {teamBPlayers.filter((p: any) => attendanceB[p.id]).length + teamBSubstitutePlayers.filter((p: any) => subAttendanceB[p.id]).length} Present
                    </Text>
                  </View>
                </View>

                {/* ASSOCIATION RULE 15 ATTENDANCE BANNER */}
                {(() => {
                  const r15Enabled = setupData?.rule15?.enabled !== false;
                  const minReq = r15Enabled ? (setupData?.rule15?.minPlayers ?? 9) : 1;
                  const customText = setupData?.rule15?.ruleText?.trim();
                  const bannerQuote = customText
                    ? customText
                    : (r15Enabled
                      ? `Rule 15: A minimum of ${minReq} players must be present at the start of each innings.`
                      : 'Rule 15 minimum player check is currently waived by Admin.');
                  return (
                    <View style={styles.rule15Banner}>
                      <Text style={styles.rule15Icon}>📜</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rule15Title}>
                          Association Rule 15 • Match Attendance Requirement
                        </Text>
                        <Text style={styles.rule15Tamil}>
                          &quot;{bannerQuote}&quot;
                        </Text>
                        <Text style={styles.rule15Sub}>
                          {r15Enabled
                            ? `Official Scorer: Mark checkboxes for each attending player. At least ${minReq} players must be marked Present per team before starting the match.`
                            : 'Official Scorer: Mark checkboxes for attending players before starting the match.'}
                        </Text>
                      </View>
                    </View>
                  );
                })()}

                {/* Mobile Tab Switcher */}
                {!isDesktop && (
                  <View style={styles.mobileTabsRow}>
                    <TouchableOpacity
                      style={[styles.mobileTabBtn, mobileSquadTab === 'TEAM_A' && styles.mobileTabBtnActive]}
                      onPress={() => setMobileSquadTab('TEAM_A')}
                    >
                      <Text style={[styles.mobileTabText, mobileSquadTab === 'TEAM_A' && styles.mobileTabTextActive]} numberOfLines={1}>
                        {teamA.name} ({teamAPlayers.filter((p: any) => attendanceA[p.id]).length + teamASubstitutePlayers.filter((p: any) => subAttendanceA[p.id]).length}/{teamAPlayers.length})
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.mobileTabBtn, mobileSquadTab === 'TEAM_B' && styles.mobileTabBtnActive]}
                      onPress={() => setMobileSquadTab('TEAM_B')}
                    >
                      <Text style={[styles.mobileTabText, mobileSquadTab === 'TEAM_B' && styles.mobileTabTextActive]} numberOfLines={1}>
                        {teamB.name} ({teamBPlayers.filter((p: any) => attendanceB[p.id]).length + teamBSubstitutePlayers.filter((p: any) => subAttendanceB[p.id]).length}/{teamBPlayers.length})
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* SQUADS DISPLAY: Side-by-side on desktop, Tabbed on mobile */}
                <View style={styles.squadsDualRow}>
                  {/* Team A Roster */}
                  {(isDesktop || mobileSquadTab === 'TEAM_A') && (
                    <View style={styles.squadColumn}>
                      <View style={styles.teamColHeader}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.teamColTitle} numberOfLines={1}>{teamA.name}</Text>
                          <Text style={styles.teamColSub}>
                            {(() => {
                              const minReq = setupData?.rule15?.enabled === false ? 1 : (setupData?.rule15?.minPlayers ?? 9);
                              const countA = teamAPlayers.filter((p: any) => attendanceA[p.id]).length + teamASubstitutePlayers.filter((p: any) => subAttendanceA[p.id]).length;
                              return countA >= minReq
                                ? `✅ ${countA} Present (Min ${minReq} Met)`
                                : `⚠️ Only ${countA} Present (Rule 15: Need ${minReq})`;
                            })()}
                          </Text>
                        </View>
                        {/* Attendance Quick Action Buttons */}
                        <View style={styles.attToolbar}>
                          <TouchableOpacity onPress={select11A} style={styles.attToolbarBtn} activeOpacity={0.7}>
                            <Text style={styles.attToolbarBtnText}>Top 11</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={selectAllA} style={styles.attToolbarBtn} activeOpacity={0.7}>
                            <Text style={styles.attToolbarBtnText}>All ({teamAPlayers.length})</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={clearA} style={[styles.attToolbarBtn, styles.attToolbarBtnClear]} activeOpacity={0.7}>
                            <Text style={[styles.attToolbarBtnText, { color: '#ef4444' }]}>Clear</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={styles.playersScrollBox}>
                        {teamAPlayers.length > 0 ? (
                          teamAPlayers.map((p: any, idx: number) => renderPlayerRow(p, idx, 'A'))
                        ) : (
                          <Text style={{ padding: 12, color: '#64748b', fontSize: 12 }}>
                            No registered players found for {teamA.name}.
                          </Text>
                        )}
                        {renderSubstituteSection('A')}
                      </View>
                      {(() => {
                        const minReq = getMinRequiredPlayers();
                        const countA = teamAPlayers.filter((p: any) => attendanceA[p.id]).length + teamASubstitutePlayers.filter((p: any) => subAttendanceA[p.id]).length;
                        const canStop = countA >= minReq;
                        return (
                          <View style={{ padding: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: teamACompleted ? '#f0fdf4' : '#f8fafc', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            {teamACompleted ? (
                              <>
                                <Text style={{ fontSize: 11, fontWeight: '800', color: '#15803d', flex: 1 }}>
                                  ✅ Attendance Completed • Timer Stopped
                                </Text>
                                <TouchableOpacity onPress={() => handleResumeTeamTimer('A')} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, backgroundColor: '#e2e8f0' }}>
                                  <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#334155' }}>↺ Resume</Text>
                                </TouchableOpacity>
                              </>
                            ) : (
                              <TouchableOpacity
                                onPress={() => handleCompleteTeamAttendance('A')}
                                style={{
                                  flex: 1,
                                  paddingVertical: 8,
                                  paddingHorizontal: 10,
                                  borderRadius: 6,
                                  backgroundColor: canStop ? '#16a34a' : '#fef3c7',
                                  borderWidth: 1,
                                  borderColor: canStop ? '#15803d' : '#f59e0b',
                                  alignItems: 'center'
                                }}
                              >
                                <Text style={{ fontSize: 11, fontWeight: '800', color: canStop ? '#ffffff' : '#92400e' }}>
                                  {canStop
                                    ? `✓ Attendance Completed — Stop ${teamA.name} Timer`
                                    : `⚠️ Need ${minReq - countA} more Present to Stop Timer (${countA}/${minReq})`}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })()}
                    </View>
                  )}

                  {/* Team B Roster */}
                  {(isDesktop || mobileSquadTab === 'TEAM_B') && (
                    <View style={styles.squadColumn}>
                      <View style={[styles.teamColHeader, styles.teamColHeaderB]}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.teamColTitle} numberOfLines={1}>{teamB.name}</Text>
                          <Text style={styles.teamColSub}>
                            {(() => {
                              const minReq = setupData?.rule15?.enabled === false ? 1 : (setupData?.rule15?.minPlayers ?? 9);
                              const countB = teamBPlayers.filter((p: any) => attendanceB[p.id]).length + teamBSubstitutePlayers.filter((p: any) => subAttendanceB[p.id]).length;
                              return countB >= minReq
                                ? `✅ ${countB} Present (Min ${minReq} Met)`
                                : `⚠️ Only ${countB} Present (Rule 15: Need ${minReq})`;
                            })()}
                          </Text>
                        </View>
                        {/* Attendance Quick Action Buttons */}
                        <View style={styles.attToolbar}>
                          <TouchableOpacity onPress={select11B} style={styles.attToolbarBtn} activeOpacity={0.7}>
                            <Text style={styles.attToolbarBtnText}>Top 11</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={selectAllB} style={styles.attToolbarBtn} activeOpacity={0.7}>
                            <Text style={styles.attToolbarBtnText}>All ({teamBPlayers.length})</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={clearB} style={[styles.attToolbarBtn, styles.attToolbarBtnClear]} activeOpacity={0.7}>
                            <Text style={[styles.attToolbarBtnText, { color: '#ef4444' }]}>Clear</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={styles.playersScrollBox}>
                        {teamBPlayers.length > 0 ? (
                          teamBPlayers.map((p: any, idx: number) => renderPlayerRow(p, idx, 'B'))
                        ) : (
                          <Text style={{ padding: 12, color: '#64748b', fontSize: 12 }}>
                            No registered players found for {teamB.name}.
                          </Text>
                        )}
                        {renderSubstituteSection('B')}
                      </View>
                      {(() => {
                        const minReq = getMinRequiredPlayers();
                        const countB = teamBPlayers.filter((p: any) => attendanceB[p.id]).length + teamBSubstitutePlayers.filter((p: any) => subAttendanceB[p.id]).length;
                        const canStop = countB >= minReq;
                        return (
                          <View style={{ padding: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: teamBCompleted ? '#f0fdf4' : '#f8fafc', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            {teamBCompleted ? (
                              <>
                                <Text style={{ fontSize: 11, fontWeight: '800', color: '#15803d', flex: 1 }}>
                                  ✅ Attendance Completed • Timer Stopped
                                </Text>
                                <TouchableOpacity onPress={() => handleResumeTeamTimer('B')} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, backgroundColor: '#e2e8f0' }}>
                                  <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#334155' }}>↺ Resume</Text>
                                </TouchableOpacity>
                              </>
                            ) : (
                              <TouchableOpacity
                                onPress={() => handleCompleteTeamAttendance('B')}
                                style={{
                                  flex: 1,
                                  paddingVertical: 8,
                                  paddingHorizontal: 10,
                                  borderRadius: 6,
                                  backgroundColor: canStop ? '#16a34a' : '#fef3c7',
                                  borderWidth: 1,
                                  borderColor: canStop ? '#15803d' : '#f59e0b',
                                  alignItems: 'center'
                                }}
                              >
                                <Text style={{ fontSize: 11, fontWeight: '800', color: canStop ? '#ffffff' : '#92400e' }}>
                                  {canStop
                                    ? `✓ Attendance Completed — Stop ${teamB.name} Timer`
                                    : `⚠️ Need ${minReq - countB} more Present to Stop Timer (${countB}/${minReq})`}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })()}
                    </View>
                  )}
                </View>

                {/* Governance Notice */}
                <View style={{ marginTop: 12, padding: 10, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <Text style={{ fontSize: 11, color: '#64748b', lineHeight: 15 }}>
                    🛡️ <Text style={{ fontWeight: '700', color: '#1e293b' }}>Official Squad Notice:</Text> Squad rosters are derived directly from approved team registrations. To add, edit, or substitute squad players, team coaches/managers must modify them through the <Text style={{ fontWeight: '700', color: '#b45309' }}>Team &amp; Coach Login Portal</Text>.
                  </Text>
                </View>

              </View>
            </View>

          </View>

            {/* STEP 1 PROCEED BUTTON */}
            <View style={{ marginTop: 14 }}>
              <TouchableOpacity
                style={[
                  styles.startMatchBtn,
                  { backgroundColor: teamACompleted && teamBCompleted ? '#0f766e' : '#94a3b8' }
                ]}
                onPress={handleProceedToToss}
                activeOpacity={0.85}
              >
                <Text style={[styles.startMatchText, { color: '#ffffff' }]}>
                  {teamACompleted && teamBCompleted
                    ? '✓ APPLY ATTENDANCE & PROCEED TO TOSS →'
                    : `⚠️ COMPLETE BOTH TEAMS' ATTENDANCE FIRST (${teamACompleted ? '✓' : '○'} ${teamA.name} • ${teamBCompleted ? '✓' : '○'} ${teamB.name})`}
                </Text>
              </TouchableOpacity>
            </View>
            </>
          ) : (
            /* STEP 2: TOSS CONFIGURATION, OFFICIALS & START MATCH */
            <View style={{ maxWidth: 680, width: '100%', alignSelf: 'center', gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setSetupStep(1)}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: '#e2e8f0' }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#1e293b' }}>&larr; Back to Attendance &amp; Timer</Text>
                </TouchableOpacity>
                <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a' }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#92400e' }}>
                    Applied Overs: {teamA.name} ({teamAOvers ?? oversNum} Ov) • {teamB.name} ({teamBOvers ?? oversNum} Ov)
                  </Text>
                </View>
              </View>

              {/* CARD 3: TOSS CONFIGURATION */}
              <View style={[styles.card, styles.tossCard]}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardHeader}>Toss Configuration</Text>
                  <Text style={styles.stepBadge}>Step 2</Text>
                </View>
                <Text style={styles.sectionHelp}>Select the toss winner and their decision to initiate official scoring</Text>

                <View style={styles.tossBlock}>
                  <Text style={styles.fieldLabel}>TOSS WON BY:</Text>
                  <View style={styles.tossOptionsRow}>
                    <TouchableOpacity
                      style={[styles.tossBtn, tossWinner === teamA.id && styles.tossBtnActive]}
                      onPress={() => setTossWinner(teamA.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.tossBtnText, tossWinner === teamA.id && styles.tossBtnTextActive]} numberOfLines={1}>
                        {tossWinner === teamA.id ? '✔ ' : ''}{teamA.name}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.tossBtn, tossWinner === teamB.id && styles.tossBtnActive]}
                      onPress={() => setTossWinner(teamB.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.tossBtnText, tossWinner === teamB.id && styles.tossBtnTextActive]} numberOfLines={1}>
                        {tossWinner === teamB.id ? '✔ ' : ''}{teamB.name}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.tossBlock}>
                  <Text style={styles.fieldLabel}>ELECTED TO:</Text>
                  <View style={styles.tossOptionsRow}>
                    <TouchableOpacity
                      style={[styles.tossBtn, tossDecision === 'BAT' && styles.tossBtnActive]}
                      onPress={() => setTossDecision('BAT')}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.tossBtnText, tossDecision === 'BAT' && styles.tossBtnTextActive]}>
                        🏏 BAT FIRST
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.tossBtn, tossDecision === 'BOWL' && styles.tossBtnActive]}
                      onPress={() => setTossDecision('BOWL')}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.tossBtnText, tossDecision === 'BOWL' && styles.tossBtnTextActive]}>
                        ⚾ BOWL FIRST
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {tossWinnerName ? (
                  <View style={styles.tossSummary}>
                    <Text style={styles.tossSummaryText}>
                      🏆 <Text style={{ fontWeight: '700' }}>{tossWinnerName}</Text> won the toss and elected to <Text style={{ fontWeight: '700', textTransform: 'uppercase' }}>{tossDecision}</Text> first.
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* CARD 4: MATCH OFFICIALS */}
              <View style={styles.card}>
                <Text style={styles.cardHeader}>Match Officials</Text>
                <View style={styles.officialsGrid}>
                  <View style={styles.officialPill}>
                    <Text style={styles.officialRole}>Umpire 1 (Lead)</Text>
                    <Text style={styles.officialName} numberOfLines={1}>
                      {setupData?.umpire1_name || setupData?.umpire1Name || 'K. Sundaram (TNCA)'}
                    </Text>
                  </View>
                  <View style={styles.officialPill}>
                    <Text style={styles.officialRole}>Umpire 2 (Square Leg)</Text>
                    <Text style={styles.officialName} numberOfLines={1}>
                      {setupData?.umpire2_name || setupData?.umpire2Name || 'P. Velmurugan (TNCA)'}
                    </Text>
                  </View>
                  <View style={styles.officialPill}>
                    <Text style={styles.officialRole}>Official Scorer</Text>
                    <Text style={styles.officialName} numberOfLines={1}>
                      {setupData?.assigned_scorer_name || setupData?.scorer_name || 'S. Ramesh (SCR-101)'}
                    </Text>
                  </View>
                  <View style={styles.officialPill}>
                    <Text style={styles.officialRole}>Match Referee</Text>
                    <Text style={styles.officialName} numberOfLines={1}>R. Senthil Kumar</Text>
                  </View>
                </View>
              </View>

              {/* ACTION BUTTON */}
              <View style={styles.actionContainer}>
                <TouchableOpacity
                  style={[styles.startMatchBtn, isSubmitting && { opacity: 0.7 }]}
                  onPress={handleStartMatch}
                  disabled={isSubmitting}
                  activeOpacity={0.85}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#040a1c" />
                  ) : (
                    <Text style={styles.startMatchText}>🏏 START MATCH &amp; BEGIN SCORING &rarr;</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

        </View>

        {/* SLIM FOOTER INSIDE SCROLL - NEVER BLOCKS VIEW */}
        <SharedFooter style={{ marginTop: 12 }} />
      </ScrollView>
    </View>
  );
}

function getStyles(isDesktop: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent'
    },
    loadingText: {
      marginTop: 12,
      color: '#475569',
      fontSize: 13,
      fontWeight: '600'
    },
    header: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(226, 232, 240, 0.9)',
      backgroundColor: 'rgba(255, 255, 255, 0.92)',
      flexDirection: isDesktop ? 'row' : 'column',
      justifyContent: 'space-between',
      alignItems: isDesktop ? 'center' : 'flex-start',
      gap: 6
    },
    headerLeft: {
      flexDirection: 'column'
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap'
    },
    backBtn: {
      marginBottom: 2
    },
    backText: {
      color: '#b45309',
      fontSize: 12,
      fontWeight: '700'
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: '#0f172a',
      letterSpacing: -0.2
    },
    matchPill: {
      backgroundColor: '#040a1c',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 14,
      maxWidth: isDesktop ? 450 : '100%'
    },
    matchPillText: {
      color: '#e2e8f0',
      fontSize: 11,
      fontWeight: '600'
    },
    statusBadge: {
      backgroundColor: '#fef3c7',
      borderColor: '#fde68a',
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12
    },
    statusBadgeText: {
      color: '#b45309',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5
    },
    scroll: {
      flexGrow: 1,
      paddingBottom: 20
    },
    contentWrapper: {
      padding: isDesktop ? 14 : 10,
      maxWidth: 1240,
      width: '100%',
      alignSelf: 'center'
    },
    mainGrid: {
      flexDirection: isDesktop ? 'row' : 'column',
      gap: 12,
      alignItems: 'flex-start'
    },
    leftCol: {
      flex: isDesktop ? 1.05 : undefined,
      width: isDesktop ? '48%' : '100%',
      gap: 10
    },
    rightCol: {
      flex: isDesktop ? 1.15 : undefined,
      width: isDesktop ? '52%' : '100%'
    },
    card: {
      backgroundColor: 'rgba(255, 255, 255, 0.94)',
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: 'rgba(226, 232, 240, 0.95)',
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1
    },
    cardHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4
    },
    cardHeader: {
      fontSize: 14,
      fontWeight: '800',
      color: '#0f172a'
    },
    cardBadge: {
      fontSize: 10,
      fontWeight: '700',
      color: '#0284c7',
      backgroundColor: '#e0f2fe',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4
    },
    stepBadge: {
      fontSize: 10,
      fontWeight: '700',
      color: '#b45309',
      backgroundColor: '#fef3c7',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4
    },
    sectionHelp: {
      fontSize: 11,
      color: '#64748b',
      marginBottom: 8
    },
    detailsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6
    },
    detailItem: {
      width: '48%',
      backgroundColor: '#f8fafc',
      padding: 6,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#f1f5f9'
    },
    detailLabel: {
      fontSize: 9.5,
      color: '#64748b',
      fontWeight: '700',
      letterSpacing: 0.3
    },
    detailVal: {
      fontSize: 12,
      color: '#0f172a',
      fontWeight: '700',
      marginTop: 2
    },
    tossCard: {
      borderLeftWidth: 4,
      borderLeftColor: '#eab308'
    },
    tossBlock: {
      marginBottom: 10
    },
    fieldLabel: {
      fontSize: 10.5,
      fontWeight: '800',
      color: '#334155',
      marginBottom: 6,
      letterSpacing: 0.3
    },
    tossOptionsRow: {
      flexDirection: 'row',
      gap: 8
    },
    tossBtn: {
      flex: 1,
      paddingVertical: 9,
      paddingHorizontal: 10,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: '#cbd5e1',
      backgroundColor: '#ffffff',
      alignItems: 'center',
      justifyContent: 'center'
    },
    tossBtnActive: {
      borderColor: '#eab308',
      backgroundColor: '#fefce8',
      shadowColor: '#eab308',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2
    },
    tossBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#475569'
    },
    tossBtnTextActive: {
      color: '#854d0e',
      fontWeight: '800'
    },
    oversInputBox: {
      backgroundColor: '#ffffff',
      borderWidth: 1.5,
      borderColor: '#0d9488',
      borderRadius: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      fontSize: 15,
      fontWeight: '800',
      color: '#0f172a',
      width: 65,
      textAlign: 'center'
    },
    quickOverChip: {
      backgroundColor: '#f1f5f9',
      borderWidth: 1,
      borderColor: '#cbd5e1',
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 6
    },
    quickOverChipActive: {
      backgroundColor: '#005960',
      borderColor: '#0d9488'
    },
    quickOverChipText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: '#475569'
    },
    quickOverChipTextActive: {
      color: '#fef08a',
      fontWeight: '800'
    },
    tossSummary: {
      backgroundColor: '#f0fdf4',
      borderColor: '#86efac',
      borderWidth: 1,
      borderRadius: 6,
      padding: 8,
      marginTop: 2
    },
    tossSummaryText: {
      color: '#15803d',
      fontSize: 11.5
    },
    officialsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6
    },
    officialPill: {
      width: '48%',
      backgroundColor: '#f8fafc',
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#f1f5f9'
    },
    officialRole: {
      fontSize: 9.5,
      color: '#64748b',
      fontWeight: '600'
    },
    officialName: {
      fontSize: 11.5,
      color: '#1e293b',
      fontWeight: '700'
    },
    actionContainer: {
      marginTop: 2
    },
    startMatchBtn: {
      backgroundColor: '#eab308',
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#b45309',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 3
    },
    startMatchText: {
      color: '#040a1c',
      fontSize: 13.5,
      fontWeight: '900',
      letterSpacing: 0.4
    },
    squadsCard: {
      padding: 10
    },
    xiMainBadge: {
      backgroundColor: '#e0f2fe',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10
    },
    xiMainBadgeText: {
      color: '#0369a1',
      fontSize: 10,
      fontWeight: '700'
    },
    mobileTabsRow: {
      flexDirection: 'row',
      backgroundColor: '#f1f5f9',
      borderRadius: 6,
      padding: 2,
      marginBottom: 8
    },
    mobileTabBtn: {
      flex: 1,
      paddingVertical: 6,
      alignItems: 'center',
      borderRadius: 4
    },
    mobileTabBtnActive: {
      backgroundColor: '#ffffff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 1,
      elevation: 1
    },
    mobileTabText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#64748b'
    },
    mobileTabTextActive: {
      color: '#0f172a',
      fontWeight: '800'
    },
    squadsDualRow: {
      flexDirection: isDesktop ? 'row' : 'column',
      gap: 8
    },
    squadColumn: {
      flex: 1,
      backgroundColor: '#f8fafc',
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      overflow: 'hidden'
    },
    teamColHeader: {
      backgroundColor: '#040a1c',
      paddingHorizontal: 8,
      paddingVertical: 5,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    teamColHeaderB: {
      backgroundColor: '#0b193d'
    },
    teamColTitle: {
      color: '#ffffff',
      fontSize: 11.5,
      fontWeight: '800',
      flex: 1
    },
    teamColSub: {
      color: '#facc15',
      fontSize: 9.5,
      fontWeight: '700'
    },
    playersScrollBox: {
      paddingHorizontal: 6,
      paddingVertical: 4
    },
    playerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
      borderBottomWidth: 1,
      borderBottomColor: '#f1f5f9',
      gap: 6
    },
    playerNumBadge: {
      width: 22,
      height: 20,
      borderRadius: 3,
      backgroundColor: '#e2e8f0',
      alignItems: 'center',
      justifyContent: 'center'
    },
    playerNumber: {
      fontSize: 9.5,
      color: '#475569',
      fontWeight: '800'
    },
    playerName: {
      fontSize: 11.5,
      color: '#0f172a',
      fontWeight: '700',
      flex: 1
    },
    playerBadgesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4
    },
    cBadge: {
      backgroundColor: '#fef08a',
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 3
    },
    cBadgeText: {
      color: '#854d0e',
      fontSize: 9,
      fontWeight: '900'
    },
    wkBadge: {
      backgroundColor: '#bae6fd',
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 3
    },
    wkBadgeText: {
      color: '#0369a1',
      fontSize: 9,
      fontWeight: '900'
    },
    playerRole: {
      fontSize: 9.5,
      color: '#64748b',
      fontWeight: '600'
    },
    playerRoleSub: {
      fontSize: 9,
      color: '#64748b',
      fontWeight: '600'
    },
    rule15Banner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: '#fffbeb',
      borderWidth: 1,
      borderColor: '#fde68a',
      borderRadius: 8,
      padding: 10,
      marginVertical: 10
    },
    rule15Icon: {
      fontSize: 18,
      marginTop: 2
    },
    rule15Title: {
      fontSize: 11.5,
      fontWeight: '800',
      color: '#b45309'
    },
    rule15Tamil: {
      fontSize: 11,
      fontWeight: '700',
      color: '#1e293b',
      marginVertical: 2
    },
    rule15Sub: {
      fontSize: 10,
      color: '#78350f',
      lineHeight: 14
    },
    attToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4
    },
    attToolbarBtn: {
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      paddingHorizontal: 6,
      paddingVertical: 2.5,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.25)'
    },
    attToolbarBtnClear: {
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
      borderColor: 'rgba(239, 68, 68, 0.3)'
    },
    attToolbarBtnText: {
      color: '#ffffff',
      fontSize: 9,
      fontWeight: '800'
    },
    checkboxBox: {
      width: 18,
      height: 18,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: '#cbd5e1',
      backgroundColor: '#ffffff',
      alignItems: 'center',
      justifyContent: 'center'
    },
    checkboxBoxChecked: {
      borderColor: '#16a34a',
      backgroundColor: '#16a34a'
    },
    checkboxCheck: {
      fontSize: 11,
      color: 'transparent',
      fontWeight: '900'
    },
    checkboxCheckChecked: {
      color: '#ffffff'
    },
    playerItemPresent: {
      backgroundColor: '#f0fdf4',
      borderBottomColor: '#dcfce7',
      borderRadius: 4,
      paddingHorizontal: 6
    },
    playerItemAbsent: {
      opacity: 0.65,
      backgroundColor: '#f8fafc',
      borderRadius: 4,
      paddingHorizontal: 6
    },
    playerNumBadgePresent: {
      backgroundColor: '#bbf7d0'
    },
    playerNumberPresent: {
      color: '#15803d'
    },
    playerNameAbsent: {
      color: '#64748b',
      textDecorationLine: 'line-through'
    },
    statusPill: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4
    },
    statusPillPresent: {
      backgroundColor: '#dcfce7'
    },
    statusPillAbsent: {
      backgroundColor: '#fee2e2'
    },
    statusPillText: {
      fontSize: 8.5,
      fontWeight: '800'
    },
    statusPillTextPresent: {
      color: '#15803d'
    },
    statusPillTextAbsent: {
      color: '#b91c1c'
    }
  });
}
