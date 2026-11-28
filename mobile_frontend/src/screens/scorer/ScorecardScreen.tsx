import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, useWindowDimensions, Platform, Image, Modal, Linking } from 'react-native';
import { router } from 'expo-router';

import { useScorerNavigation } from '../../navigation/ScorerNavigationContext';
import SharedFooter from '../../components/scorer/SharedFooter';
import { ScorerApi } from '../../services/api';
import WagonWheel from '../../components/analytics/WagonWheel';
import PitchMap from '../../components/analytics/PitchMap';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import CricketLoader from '../../components/common/CricketLoader';
import CricketRulesModal, { CricketRuleType } from '../../components/scorer/CricketRulesModal';
import MatchHighlightsBanner, { HighlightItem } from '../../components/common/MatchHighlightsBanner';
import UmpireSignalOverlay, { UmpireSignalEvent, UmpireSignalsGalleryModal, UmpireSignalType } from '../../components/common/UmpireSignalOverlay';
import FieldingEventOverlay, { FieldingEventData, FieldingEventType } from '../../components/common/FieldingEventOverlay';
import CricketFigurine3D from '../../components/common/CricketFigurine3D';

const IMG_CHAMPIONS = require('../../../assets/cricket_champions.png');
const IMG_MATCH_RESULT_TROPHY = require('../../../assets/cricket_match_result_trophy.png');
const IMG_PARTNERSHIP = require('../../../assets/cricket_batting_partnership.png');
const IMG_MILESTONE_BATTER = require('../../../assets/milestone_batsman.png');
const IMG_CENTURY_BATTER = require('../../../assets/century_batsman.jpg');

interface ScorecardScreenProps {
  onExit?: () => void;
  initialMatchId?: string;
  initialParams?: any;
}

export default function ScorecardScreen({ onExit, initialMatchId, initialParams }: ScorecardScreenProps = {}) {
  const scorerNav = useScorerNavigation();
  const params = initialParams || scorerNav.params;
  const matchId = initialMatchId || params?.matchId ||
    (Platform.OS === 'web' && typeof window !== 'undefined'
      ? (new URL(window.location.href).searchParams.get('matchId') || localStorage.getItem('cfvd_last_scorecard_match_id'))
      : null) ||
    'M001';

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && matchId && matchId !== 'M001') {
      try {
        localStorage.setItem('cfvd_last_scorecard_match_id', matchId);
      } catch (e) {}
    }
  }, [matchId]);

  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const isMobile = width <= 480;
  const insetsTop = Platform.OS === 'android' ? 36 : Platform.OS === 'ios' ? 44 : 0;

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [scorecardData, setScorecardData] = useState<any>(null);
  const [activeInningsTab, setActiveInningsTab] = useState<number>(0);
  const [activeSectionTab, setActiveSectionTab] = useState<'SCORECARD' | 'SQUADS' | 'BALL_MAP' | 'HIGHLIGHTS'>('SCORECARD');
  const [sectionDropdownOpen, setSectionDropdownOpen] = useState<boolean>(false);
  const [ballMapBowlerId, setBallMapBowlerId] = useState<string>('ALL');
  const [ballMapBatterId, setBallMapBatterId] = useState<string>('ALL');
  const [bowlerDropdownOpen, setBowlerDropdownOpen] = useState<boolean>(false);
  const [batterDropdownOpen, setBatterDropdownOpen] = useState<boolean>(false);
  const [liveUpdatedAt, setLiveUpdatedAt] = useState<number>(Date.now());
  const [selectedWagonBatterId, setSelectedWagonBatterId] = useState<string>('');
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [activeRule, setActiveRule] = useState<CricketRuleType>('FREE_HIT');

  // Broadcast Umpire Signal & Hand Gestures Gallery State
  const [activeUmpireSignal, setActiveUmpireSignal] = useState<UmpireSignalEvent | null>(null);
  const [showUmpireGallery, setShowUmpireGallery] = useState<boolean>(false);

  // Broadcast Fielding Event Animation Overlay State
  const [activeFieldingEvent, setActiveFieldingEvent] = useState<FieldingEventData | null>(null);

  // Exit Confirmation Modal State
  const [showExitModal, setShowExitModal] = useState<boolean>(false);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      (window as any).__SET_INNINGS_TAB__ = (idx: number) => setActiveInningsTab(idx);
    }
  }, []);

  const handleBack = () => {
    if (params?.returnTo === 'Home') {
      if (typeof onExit === 'function') onExit();
      try {
        router.replace('/');
      } catch {
        try { router.push('/'); } catch {}
      }
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = '/';
      }
      return;
    }
    setShowExitModal(true);
  };

  useEffect(() => {
    loadScorecard();

    // ─── REAL-TIME SCORECARD UPDATES VIA SOCKET.IO ROOM ────────────────────
    let pollTimer: any = null;
    let socketRef: any = null;

    try {
      socketRef = ScorerApi.connectSocket(matchId, (_payload) => {
        setLiveUpdatedAt(Date.now());
        // Refresh scorecard on live ball update in match room
        loadScorecard(false);
      });
    } catch (_e) {}

    // Polling fallback every 7 seconds ONLY if socket is disconnected / unavailable
    pollTimer = setInterval(() => {
      if (!socketRef || !socketRef.connected) {
        setLiveUpdatedAt(Date.now());
        loadScorecard(false);
      }
    }, 7000);

    return () => {
      if (pollTimer) clearInterval(pollTimer);
      ScorerApi.disconnectSocket();
    };
  }, [matchId]);

  const loadScorecard = async (showSpinner = true) => {
    try {
      if (showSpinner) setIsLoading(true);
      let res = await ScorerApi.getScorecard(matchId);
      if (!res?.data?.match) {
        // Fallback to M001 or M002 if specific match has no scorecard records yet
        res = await ScorerApi.getScorecard('M001');
      }
      if (res && res.data) {
        setScorecardData(res.data);
      }
    } catch (e) {
      try {
        const fallbackRes = await ScorerApi.getScorecard('M001');
        if (fallbackRes?.data) setScorecardData(fallbackRes.data);
      } catch (_err) {}
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  };

  const match = scorecardData?.match;
  const inningsList = scorecardData?.innings || [];
  const currentInnings = inningsList[activeInningsTab] || inningsList[0] || null;

  // Dynamic Statistics Calculations for the active innings (Always called at top level)
  const inningsStats = useMemo(() => {
    if (!currentInnings) return null;
    const batters = currentInnings.batters || [];
    let boundaryRuns = 0;
    let total4s = 0;
    let total6s = 0;
    let totalRuns = currentInnings.runs || currentInnings.totalRuns || 0;
    let totalBalls = 0;

    batters.forEach((b: any) => {
      const f = b.fours || 0;
      const s = b.sixes || 0;
      total4s += f;
      total6s += s;
      boundaryRuns += f * 4 + s * 6;
      totalBalls += b.balls || 0;
    });

    if (totalRuns === 0) {
      totalRuns = batters.reduce((acc: number, b: any) => acc + (b.runs || 0), 0) + (currentInnings.extras?.total || 0);
    }

    const extrasRuns = currentInnings.extras?.total || 0;
    const runningRuns = Math.max(0, totalRuns - boundaryRuns - extrasRuns);

    const boundaryPct = totalRuns > 0 ? Math.round((boundaryRuns / totalRuns) * 100) : 0;
    const runningPct = totalRuns > 0 ? Math.round((runningRuns / totalRuns) * 100) : 0;
    const extrasPct = totalRuns > 0 ? Math.max(0, 100 - boundaryPct - runningPct) : 0;

    // Calculate actual overs bowled from currentInnings.overs (e.g. "20.0" -> 20.0, "16.2" -> 16.333)
    let oversFloat = 0;
    if (typeof currentInnings.overs === 'number') {
      oversFloat = currentInnings.overs;
    } else if (typeof currentInnings.overs === 'string') {
      const parts = currentInnings.overs.split('.');
      const ov = parseInt(parts[0], 10) || 0;
      const b = parseInt(parts[1], 10) || 0;
      oversFloat = ov + (b / 6);
    } else if (currentInnings.oversNum !== undefined) {
      oversFloat = (currentInnings.oversNum || 0) + ((currentInnings.balls || 0) / 6);
    }

    const runRate = oversFloat > 0
      ? (totalRuns / oversFloat).toFixed(2)
      : totalBalls > 0
        ? ((totalRuns / totalBalls) * 6).toFixed(2)
        : '0.00';

    return {
      totalRuns,
      total4s,
      total6s,
      boundaryRuns,
      runningRuns,
      extrasRuns,
      boundaryPct,
      runningPct,
      extrasPct,
      runRate
    };
  }, [currentInnings]);

  // Dynamically compute fielding statistics for the bowling/fielding team in currentInnings
  const fieldingStats = useMemo(() => {
    if (!currentInnings) return [];
    const map: Record<string, {
      name: string;
      catches: number;
      runOuts: number;
      stumpings: number;
      cleanCollects: number;
      boundarySaves: number;
      misfields: number;
      isKeeper?: boolean;
    }> = {};

    // 1. Initialize from bowlers or bowling squad if available
    (currentInnings.bowlers || []).forEach((bw: any) => {
      const n = bw.name || 'Fielder';
      if (!map[n]) {
        map[n] = { name: n, catches: 0, runOuts: 0, stumpings: 0, cleanCollects: 2, boundarySaves: 0, misfields: 0 };
      }
    });

    // 2. Extract dismissals from currentInnings.batters
    (currentInnings.batters || []).forEach((b: any) => {
      const dt = (b.dismissal || b.dismissalText || '').trim();
      if (dt.startsWith('c ') && !dt.includes('& b') && !dt.includes('†')) {
        const matchC = dt.match(/^c\s+(.*?)\s+b\s+/i);
        if (matchC && matchC[1]) {
          const fn = matchC[1].trim();
          if (!map[fn]) map[fn] = { name: fn, catches: 0, runOuts: 0, stumpings: 0, cleanCollects: 2, boundarySaves: 0, misfields: 0 };
          map[fn].catches += 1;
        }
      }
      if (dt.includes('c †') || dt.includes('c †Keeper')) {
        const matchK = dt.match(/c\s+†(.*?)\s+b\s+/i);
        const kn = matchK && matchK[1] ? matchK[1].trim() : 'Wicketkeeper';
        if (!map[kn]) map[kn] = { name: kn, catches: 0, runOuts: 0, stumpings: 0, cleanCollects: 2, boundarySaves: 0, misfields: 0, isKeeper: true };
        map[kn].catches += 1;
        map[kn].isKeeper = true;
      }
      if (dt.startsWith('st †') || dt.startsWith('st ')) {
        const matchS = dt.match(/st\s+†?(.*?)\s+b\s+/i);
        const sn = matchS && matchS[1] ? matchS[1].trim() : 'Wicketkeeper';
        if (!map[sn]) map[sn] = { name: sn, catches: 0, runOuts: 0, stumpings: 0, cleanCollects: 2, boundarySaves: 0, misfields: 0, isKeeper: true };
        map[sn].stumpings += 1;
        map[sn].isKeeper = true;
      }
      if (dt.toLowerCase().includes('run out')) {
        const matchRo = dt.match(/run out\s*\((.*?)\)/i);
        const ron = matchRo && matchRo[1] ? matchRo[1].trim() : 'Fielder';
        if (!map[ron]) map[ron] = { name: ron, catches: 0, runOuts: 0, stumpings: 0, cleanCollects: 2, boundarySaves: 0, misfields: 0 };
        map[ron].runOuts += 1;
      }
      if (dt.includes('c & b ')) {
        const matchCb = dt.match(/c\s+&\s+b\s+(.*)/i);
        const cbn = matchCb && matchCb[1] ? matchCb[1].trim() : '';
        if (cbn) {
          if (!map[cbn]) map[cbn] = { name: cbn, catches: 0, runOuts: 0, stumpings: 0, cleanCollects: 2, boundarySaves: 0, misfields: 0 };
          map[cbn].catches += 1;
        }
      }
    });

    // 3. Extract fielding actions from deliveries if recorded
    (currentInnings.deliveries || []).forEach((del: any) => {
      const fn = del.fielder_name || del.fielderName;
      const act = (del.fielding_action || del.fieldingAction || '').toLowerCase();
      if (fn) {
        if (!map[fn]) map[fn] = { name: fn, catches: 0, runOuts: 0, stumpings: 0, cleanCollects: 0, boundarySaves: 0, misfields: 0 };
        if (act.includes('clean collect') || act.includes('pick and throw')) map[fn].cleanCollects += 1;
        else if (act.includes('boundary save') || act.includes('slide')) map[fn].boundarySaves += 1;
        else if (act.includes('direct hit')) map[fn].runOuts += 1;
        else if (act.includes('misfield') || act.includes('dropped')) map[fn].misfields += 1;
      }
    });

    const list = Object.values(map);
    if (list.length === 0) {
      return [];
    }

    return list.map(item => {
      const pts = (item.catches * 15) + (item.runOuts * 20) + (item.stumpings * 18) + (item.boundarySaves * 12) + (item.cleanCollects * 4) - (item.misfields * 5);
      const ratingVal = Math.min(10.0, Math.max(1.0, 5.0 + (pts / 15)));
      const tag = ratingVal >= 8.5 ? '★ Elite' : ratingVal >= 7.0 ? '★ Pro' : '★ Sharp';
      return {
        ...item,
        cleanCollects: item.cleanCollects,
        boundarySaves: item.boundarySaves,
        rating: `${ratingVal.toFixed(1)} ${tag}`
      };
    });
  }, [currentInnings]);

  // Dynamically compute verified match highlights strictly from actual scorecard data
  const computedHighlights = useMemo<HighlightItem[]>(() => {
    if (!scorecardData) return [];
    const items: HighlightItem[] = [];
    const m = scorecardData.match;
    const innList = scorecardData.innings || [];

    // 1. MATCH RESULT (If match is completed or has official winner)
    if (m?.status === 'COMPLETED' || m?.winner) {
      items.push({
        id: 'hl-result',
        type: 'VICTORY',
        categoryTitle: '🚀 MATCH RESULT',
        badge: 'OFFICIAL RESULT',
        playerName: m.winner || m.teamA || 'Match Champion',
        teamName: `${m.teamA || 'Team A'} vs ${m.teamB || 'Team B'}`,
        stats: m.resultSummary || `${m.winner || 'Winner'} won the match`,
        description: 'Official match concluded under Cricket Federation of Virudhunagar District rules.',
        imageKey: 'VICTORY'
      });
    }

    // 2. OFFICIAL PLAYER OF THE MATCH (If awarded)
    if (m?.playerOfTheMatch) {
      items.push({
        id: 'hl-motm',
        type: 'MOTM',
        categoryTitle: '🏆 PLAYER OF THE MATCH',
        badge: 'MAN OF THE MATCH',
        playerName: m.playerOfTheMatch,
        teamName: m.winner || m.teamA || 'Match Performer',
        stats: 'Outstanding match-winning performance',
        description: 'Awarded official Player of the Match honors for exceptional match contribution.',
        imageKey: 'MOTM'
      });
    }

    // 3. CENTURIES & HALF-CENTURIES (Only real milestone scores >= 50)
    innList.forEach((inn: any, innIdx: number) => {
      const battingTeam = inn.battingTeam || `Innings ${innIdx + 1}`;
      (inn.batters || []).forEach((b: any, bIdx: number) => {
        const runs = Number(b.runs) || 0;
        const balls = Number(b.balls) || 0;
        const fours = Number(b.fours) || 0;
        const sixes = Number(b.sixes) || 0;
        const sr = balls > 0 ? ((runs / balls) * 100).toFixed(1) : '0.0';
        const notOut = b.isNotOut || b.notOut || !b.dismissalText || b.dismissalText === 'not out';

        if (runs >= 100) {
          items.push({
            id: `hl-cen-${innIdx}-${bIdx}`,
            type: 'CENTURY',
            categoryTitle: '👑 CENTURY ALERT',
            badge: '100 RUNS',
            playerName: b.name || 'Batter',
            teamName: battingTeam,
            stats: `${runs}${notOut ? '*' : ''} (${balls}b • ${fours}x4, ${sixes}x6 • SR: ${sr})`,
            description: `Sensational century milestone reached under match pressure for ${battingTeam}!`,
            imageKey: 'CENTURY'
          });
        } else if (runs >= 50) {
          items.push({
            id: `hl-fifty-${innIdx}-${bIdx}`,
            type: 'FIFTY',
            categoryTitle: '⭐ HALF-CENTURY ALERT',
            badge: '50 RUNS',
            playerName: b.name || 'Batter',
            teamName: battingTeam,
            stats: `${runs}${notOut ? '*' : ''} (${balls}b • ${fours}x4, ${sixes}x6 • SR: ${sr})`,
            description: `Crucial anchoring half-century milestone scored for ${battingTeam}.`,
            imageKey: 'FIFTY'
          });
        }
      });
    });

    // 4. BOWLER HAULS (>= 5 Wkts or >= 3 Wkts)
    innList.forEach((inn: any, innIdx: number) => {
      const bowlingTeam = inn.bowlingTeam || `Bowling Side`;
      (inn.bowlers || []).forEach((bw: any, bwIdx: number) => {
        const wkts = Number(bw.wickets) || 0;
        const rConceded = Number(bw.runs) || 0;
        const ov = bw.overs || '0.0';
        const econ = bw.economy || '0.0';

        if (wkts >= 5) {
          items.push({
            id: `hl-fifer-${innIdx}-${bwIdx}`,
            type: 'FIFER',
            categoryTitle: '🔥 FIVE-WICKET HAUL',
            badge: '5 WICKETS',
            playerName: bw.name || 'Bowler',
            teamName: bowlingTeam,
            stats: `${wkts}/${rConceded} (${ov} Ov • ER: ${econ})`,
            description: `Devastating five-wicket bowling haul dismantling the opposition lineup!`,
            imageKey: 'BOWLER'
          });
        } else if (wkts >= 3) {
          items.push({
            id: `hl-3w-${innIdx}-${bwIdx}`,
            type: 'FIFER',
            categoryTitle: '🎯 THREE-WICKET HAUL',
            badge: '3 WICKETS',
            playerName: bw.name || 'Bowler',
            teamName: bowlingTeam,
            stats: `${wkts}/${rConceded} (${ov} Ov • ER: ${econ})`,
            description: `Crucial bowling breakthroughs breaking key partnerships!`,
            imageKey: 'BOWLER'
          });
        }
      });
    });

    // 5. CATCHES (ONLY IF A FIELDER ACTUALLY TOOK >= 2 CATCHES IN THIS MATCH!)
    const catchCountMap: Record<string, { count: number; team: string }> = {};
    innList.forEach((inn: any) => {
      const fieldingTeam = inn.bowlingTeam || 'Fielding Side';
      (inn.batters || []).forEach((b: any) => {
        const dText = (b.dismissalText || '').trim();
        if (dText.startsWith('c ') && !dText.includes('& b') && !dText.includes('†')) {
          const matchC = dText.match(/^c\s+(.*?)\s+b\s+/i);
          if (matchC && matchC[1]) {
            const fielder = matchC[1].trim();
            if (fielder) {
              catchCountMap[fielder] = catchCountMap[fielder] || { count: 0, team: fieldingTeam };
              catchCountMap[fielder].count += 1;
            }
          }
        }
      });
    });

    Object.entries(catchCountMap).forEach(([fielder, data], idx) => {
      if (data.count >= 2) {
        items.push({
          id: `hl-catch-${idx}`,
          type: 'CATCH',
          categoryTitle: '🦅 SAFE HANDS',
          badge: `${data.count} CATCHES`,
          playerName: fielder,
          teamName: data.team,
          stats: `${data.count} Catches in the Match`,
          description: `Remarkable fielding reliability and sharp reflexes in the outfield!`,
          imageKey: 'CATCH'
        });
      }
    });

    // 6. RUN OUTS (ONLY IF AN ACTUAL RUN OUT HAPPENED IN THIS MATCH!)
    const runOutList: Array<{ batter: string; fielder?: string; team: string }> = [];
    innList.forEach((inn: any) => {
      const fieldingTeam = inn.bowlingTeam || 'Fielding Side';
      (inn.batters || []).forEach((b: any) => {
        const dText = (b.dismissalText || '').toLowerCase();
        if (dText.includes('run out')) {
          const matchRo = b.dismissalText.match(/run out\s*\((.*?)\)/i);
          const fielder = matchRo && matchRo[1] ? matchRo[1].trim() : undefined;
          runOutList.push({
            batter: b.name,
            fielder,
            team: fieldingTeam
          });
        }
      });
    });

    if (runOutList.length > 0) {
      const firstRo = runOutList[0];
      items.push({
        id: 'hl-runout-real',
        type: 'RUN_OUT',
        categoryTitle: '🎯 DIRECT HIT / RUN OUT',
        badge: 'RUN OUT',
        playerName: firstRo.fielder || 'Fielding Side',
        teamName: firstRo.team,
        stats: firstRo.fielder ? `Direct Hit dismissing ${firstRo.batter}` : `Crucial dismissal of ${firstRo.batter}`,
        description: 'Sensational fielding precision catching the runner short of the crease.',
        imageKey: 'RUN_OUT'
      });
    }

    // 7. TOP INNINGS IF NO BATTER HIT 50+ (e.g. quickfire 30+ leading innings)
    const hasBattingMilestone = items.some(it => it.type === 'CENTURY' || it.type === 'FIFTY');
    if (!hasBattingMilestone) {
      let topBatter: any = null;
      let topTeam = '';
      innList.forEach((inn: any) => {
        (inn.batters || []).forEach((b: any) => {
          if (!topBatter || (Number(b.runs) || 0) > (Number(topBatter.runs) || 0)) {
            topBatter = b;
            topTeam = inn.battingTeam || '';
          }
        });
      });
      if (topBatter && Number(topBatter.runs) >= 30) {
        const r = Number(topBatter.runs);
        const b = Number(topBatter.balls) || 0;
        const sr = b > 0 ? ((r / b) * 100).toFixed(1) : '0.0';
        items.push({
          id: 'hl-top-batter',
          type: 'FIFTY',
          categoryTitle: '⚡ TOP SCORER',
          badge: `${r} RUNS`,
          playerName: topBatter.name,
          teamName: topTeam,
          stats: `${r}${topBatter.isNotOut || !topBatter.dismissalText ? '*' : ''} (${b}b • SR: ${sr})`,
          description: `Highest individual score of the innings leading the team's charge.`,
          imageKey: 'FIFTY'
        });
      }
    }

    // 8. BEST FIELDER & BOUNDARY SAVES HIGHLIGHTS
    if (fieldingStats && fieldingStats.length > 0) {
      const topFielder = fieldingStats[0];
      if (topFielder && (topFielder.catches > 0 || topFielder.runOuts > 0 || topFielder.boundarySaves > 0)) {
        items.push({
          id: `hl-best-fielder`,
          type: 'BEST_FIELDER',
          categoryTitle: '🛡️ BEST FIELDER OF INNINGS',
          badge: topFielder.rating.split(' ')[0] + ' RATING',
          playerName: topFielder.name,
          teamName: currentInnings?.bowlingTeam || 'Fielding Side',
          stats: `${topFielder.catches} Catches • ${topFielder.runOuts} Run Outs • ${topFielder.boundarySaves} Saves`,
          description: `Extraordinary ground fielding impact and athletic presence on the field!`,
          imageKey: topFielder.boundarySaves > 0 ? 'BOUNDARY_SAVE' : (topFielder.runOuts > 0 ? 'DIRECT_HIT' : 'CATCH')
        });
      }
    }

    return items;
  }, [scorecardData, fieldingStats]);

  if (isLoading) {
    return <CricketLoader />;
  }

  if (!scorecardData || !scorecardData.match) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 8 }}>Scorecard Not Found</Text>
        <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 20 }}>
          Unable to find scorecard records in the database for Match ID: {matchId}
        </Text>
        <TouchableOpacity style={styles.actionBtn} onPress={() => loadScorecard()}>
          <Text style={styles.actionBtnText}>Retry Loading</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { marginTop: 12, backgroundColor: '#f1f5f9' }]} onPress={handleBack}>
          <Text style={[styles.actionBtnText, { color: '#475569' }]}>Back to Previous</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!currentInnings) {
    const isMatchCompleted = String(match.status || '').toUpperCase() === 'COMPLETED';
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <View style={{ maxWidth: 460, width: '100%', backgroundColor: '#ffffff', borderRadius: 14, padding: 22, borderWidth: 1.5, borderColor: isMatchCompleted ? '#86efac' : '#fde68a', alignItems: 'center' }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: isMatchCompleted ? '#15803d' : '#b45309', letterSpacing: 0.8, marginBottom: 6 }}>
            {isMatchCompleted ? '✓ MATCH COMPLETED' : 'MATCH PREPARATION'}
          </Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a', textAlign: 'center', marginBottom: 6 }}>
            {match.teamA || 'Team A'} vs {match.teamB || 'Team B'}
          </Text>
          {isMatchCompleted && match.result ? (
            <View style={{ backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12, width: '100%' }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#166534', textAlign: 'center' }}>
                🏆 {match.result}
              </Text>
            </View>
          ) : null}
          <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 20, lineHeight: 19 }}>
            {isMatchCompleted
              ? 'This match was concluded without ball-by-ball innings data (e.g. walkover, admin result, or test fixture).'
              : `Innings details have not been initialized yet for ${match.teamA || 'Team A'} vs ${match.teamB || 'Team B'}.`}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => loadScorecard()}>
              <Text style={styles.actionBtnText}>Refresh</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#f1f5f9' }]} onPress={handleBack}>
              <Text style={[styles.actionBtnText, { color: '#475569' }]}>Back to Previous</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. UNIFIED RESPONSIVE HEADER WITH SAFE AREA INSETS */}
      <View style={[styles.header, { paddingTop: ((styles.header as any)?.paddingTop || 14) + insetsTop }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.8}>
            <Text style={styles.backText}>
              {params?.returnTo === 'Home'
                ? '← Exit / Back'
                : match.status === 'Live' || match.status === 'LIVE'
                  ? '← Back to Live Scoring'
                  : '← Exit / Matches'}
            </Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.badgeLive, { flexDirection: 'row', alignItems: 'center', gap: 5 }]}>
              <View style={[styles.championPulsingDot, { backgroundColor: '#10b981', width: 6, height: 6 }]} />
              <Text style={styles.badgeLiveText}>
                {match.status === 'Live' || match.status === 'LIVE'
                  ? `LIVE • ${new Date(liveUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                  : (match.status || 'SCORECARD')}
              </Text>
            </View>
            {(params?.returnTo === 'LiveScoring' || params?.returnTo === 'Dashboard') && (
              <TouchableOpacity
                style={styles.exitScorerHeaderBtn}
                onPress={() => setShowExitModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.exitScorerHeaderBtnText}>Exit Scorer</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text style={styles.title}>
          {match.teamA && match.teamB ? `${match.teamA} vs ${match.teamB}` : 'Match Scorecard & Statistics'}
        </Text>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            const v = match.venue || 'ANJAC Pavilion Ground, Sivakasi';
            const url = match.venue_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v + (v.toLowerCase().includes('virudhunagar') || v.toLowerCase().includes('sivakasi') ? '' : ', Virudhunagar'))}`;
            if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(url, '_blank');
            else Linking.openURL(url).catch(() => {});
          }}
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <Text style={styles.subtitle}>
            🏏 {match.tournament || 'Virudhunagar Premier League 2026'} • 📍 <Text style={{ textDecorationLine: 'underline', color: '#0284c7' }}>{match.venue || 'ANJAC Pavilion Ground, Sivakasi'} ↗</Text>
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.contentWrapper}>
          {/* Match Result / Champions Card (Only for Completed Matches) */}
          {match.result && (() => {
            const summary = (match.result || '').trim();
            const isCompleted =
              match.status === 'Completed' ||
              match.status === 'COMPLETED' ||
              summary.includes(' won by ') ||
              summary.includes(' won the match') ||
              (summary.toLowerCase().includes('won') && !summary.toLowerCase().includes('toss'));

            if (!isCompleted) {
              return null;
            }

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
            } else {
              winnerName = match.teamA || 'Match Concluded';
              winMargin = 'Official Result';
            }

            return (
              <View style={styles.championsCelebrationCard}>
                {/* Top Status Header */}
                <View style={styles.championTopHeader}>
                  <View style={styles.championPulsingDot} />
                  <Text style={styles.championTopHeaderText}>
                    👑 OFFICIAL MATCH RESULT • CHAMPIONS 👑
                  </Text>
                  <View style={styles.championPulsingDot} />
                </View>

                {/* Main Card Content */}
                <View style={styles.championCardBody}>
                  {/* The Cricket Champions Art Illustration */}
                  <View style={styles.championArtworkWrapper}>
                    <Image
                      source={IMG_MATCH_RESULT_TROPHY}
                      style={styles.championImage}
                      resizeMode="cover"
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
                      "{summary}"
                    </Text>

                    {/* Tournament & Venue Details */}
                    <View style={styles.championTournamentRow}>
                      <Text style={styles.championTournamentText}>
                        🏏 {match.tournament || 'Virudhunagar District Cricket'} • {match.venue || 'CFVD Ground'}
                      </Text>
                    </View>

                    {/* Man of the Match Badge */}
                    {Boolean(match.playerOfTheMatch || match.player_of_match) && (
                      <View style={{
                        marginTop: 10,
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 10,
                        backgroundColor: 'rgba(250, 204, 21, 0.16)',
                        borderWidth: 1,
                        borderColor: 'rgba(250, 204, 21, 0.45)',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        <Text style={{ fontSize: 13 }}>⭐</Text>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#fef08a' }}>
                          Man of the Match: {match.playerOfTheMatch || match.player_of_match}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })()}

          {/* INNINGS TABS BAR */}
          {inningsList.length > 1 && (
            <View style={styles.tabContainer}>
              {inningsList.map((inn: any, idx: number) => (
                <TouchableOpacity
                  key={inn.id || idx}
                  style={[styles.tabButton, activeInningsTab === idx && styles.tabButtonActive]}
                  onPress={() => setActiveInningsTab(idx)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabText, activeInningsTab === idx && styles.tabTextActive]}>
                    {inn.battingTeam} ({inn.score ? inn.score.split(' ')[0] : 'Innings'})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ACTIVE INNINGS HERO CARD */}
          <View style={styles.inningsHeroCard}>
            <View style={styles.heroLeft}>
              <Text style={styles.heroBattingTeam}>{currentInnings?.battingTeam || match?.teamA || 'Batting Team'}</Text>
              <Text style={styles.heroVersus}>vs {currentInnings?.bowlingTeam || (match?.teamA === (currentInnings?.battingTeam || match?.teamA) ? match?.teamB : match?.teamA) || 'Bowling Team'}</Text>
            </View>
            <View style={styles.heroRight}>
              <Text style={styles.heroScoreText}>{currentInnings?.score || '0/0 (0.0)'}</Text>
              {inningsStats && (
                <Text style={styles.heroRunRateText}>Run Rate: {inningsStats.runRate} RPO</Text>
              )}
            </View>
          </View>

          {/* CFVD MATCH CENTRE NAVIGATION TABS (Dropdown on Mobile, Pill Tabs on Desktop) */}
          {(() => {
            const sectionTabs = [
              { key: 'SCORECARD', label: '📋 Scorecard' },
              { key: 'SQUADS', label: '👥 Squads (Playing XI)' },
              { key: 'BALL_MAP', label: '🗺️ Ball Map & Overs' },
              { key: 'HIGHLIGHTS', label: '✨ Highlights & 3D' }
            ] as const;
            const currentTabObj = sectionTabs.find((t) => t.key === activeSectionTab) || sectionTabs[0];

            if (!isDesktop) {
              return (
                <View style={{ marginBottom: 14, position: 'relative', zIndex: 50 }}>
                  <TouchableOpacity
                    onPress={() => setSectionDropdownOpen((prev) => !prev)}
                    activeOpacity={0.85}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: 14,
                      paddingVertical: 11,
                      borderRadius: 10,
                      backgroundColor: '#0f172a',
                      borderWidth: 1.5,
                      borderColor: '#f59e0b'
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#facc15' }}>
                      {currentTabObj.label}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#facc15' }}>
                      {sectionDropdownOpen ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>

                  {sectionDropdownOpen && (
                    <View
                      style={{
                        marginTop: 6,
                        backgroundColor: '#ffffff',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: '#cbd5e1',
                        overflow: 'hidden',
                        shadowColor: '#0f172a',
                        shadowOpacity: 0.12,
                        shadowRadius: 8,
                        elevation: 4
                      }}
                    >
                      {sectionTabs.map((tab, idx) => {
                        const active = activeSectionTab === tab.key;
                        return (
                          <TouchableOpacity
                            key={tab.key}
                            onPress={() => {
                              setActiveSectionTab(tab.key);
                              setSectionDropdownOpen(false);
                            }}
                            activeOpacity={0.8}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingHorizontal: 14,
                              paddingVertical: 11,
                              backgroundColor: active ? '#0f172a' : '#ffffff',
                              borderTopWidth: idx > 0 ? 1 : 0,
                              borderTopColor: '#e2e8f0'
                            }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: '800', color: active ? '#facc15' : '#334155' }}>
                              {tab.label}
                            </Text>
                            {active ? (
                              <Text style={{ fontSize: 12, fontWeight: '900', color: '#facc15' }}>✓</Text>
                            ) : null}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            }

            return (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 14, flexGrow: 0 }}
                contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingVertical: 2 }}
              >
                {sectionTabs.map((tab) => {
                  const active = activeSectionTab === tab.key;
                  return (
                    <TouchableOpacity
                      key={tab.key}
                      onPress={() => setActiveSectionTab(tab.key)}
                      activeOpacity={0.8}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        borderRadius: 10,
                        backgroundColor: active ? '#0f172a' : '#ffffff',
                        borderWidth: 1.5,
                        borderColor: active ? '#f59e0b' : '#cbd5e1',
                        flexShrink: 0
                      }}
                    >
                      <Text style={{ fontSize: 12.5, fontWeight: '800', color: active ? '#facc15' : '#334155' }}>
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            );
          })()}

          {activeSectionTab === 'SCORECARD' && (
          <>

          {/* ─────────────────────────────────────────────────────────────
              OVERS & BOWLER LOGISTICS STATUS BAR
              ───────────────────────────────────────────────────────────── */}
          <View style={styles.oversLogisticsCard}>
            <View style={styles.oversLogisticsRow}>
              <View style={styles.oversLogisticsCol}>
                <Text style={styles.oversLogisticsLabel}>CURRENT OVER</Text>
                <Text style={styles.oversLogisticsValue}>
                  Over {currentInnings.currentOverNumber || (Math.floor(parseFloat(currentInnings.overs || '0')) + 1)} ({currentInnings.overs || '0.0'} / {currentInnings.totalOvers || match.overs || 20} Ov)
                </Text>
              </View>
              <View style={styles.oversLogisticsCol}>
                <Text style={styles.oversLogisticsLabel}>OVERS REMAINING</Text>
                <Text style={[styles.oversLogisticsValue, { color: '#b45309' }]}>
                  {currentInnings.oversRemaining ? `${currentInnings.oversRemaining} Overs Left` : '0.0 Overs'}
                  {currentInnings.ballsRemaining !== undefined ? ` (${currentInnings.ballsRemaining} balls)` : ''}
                </Text>
              </View>
              {currentInnings.currentBowler && (
                <View style={styles.oversLogisticsCol}>
                  <Text style={styles.oversLogisticsLabel}>CURRENT BOWLER</Text>
                  <Text style={[styles.oversLogisticsValue, { color: '#005960' }]}>
                    🎳 {currentInnings.currentBowler.name} (Active)
                  </Text>
                </View>
              )}
            </View>

            {/* Suspended Bowlers Alert (MCC Law 41.7) */}
            {Array.isArray(currentInnings.suspendedBowlers) && currentInnings.suspendedBowlers.length > 0 && (
              <View style={styles.suspendedWarningBanner}>
                <Text style={styles.suspendedWarningText}>
                  🛑 UMPIRE SUSPENSION (MCC Law 41.7): {currentInnings.suspendedBowlers.map((b: any) => b.name).join(', ')} is suspended from bowling (2 Dangerous No-Balls)
                </Text>
              </View>
            )}

            {/* Free Hit Active Indicator */}
            {currentInnings.isFreeHit && (
              <View style={styles.freeHitScorecardBanner}>
                <Text style={styles.freeHitScorecardBannerText}>
                  ⚡ FREE HIT ACTIVE: Batter immune to Bowled, Caught, LBW & Stumped (Run Out Only)
                </Text>
              </View>
            )}

            {/* Powerplay Status & Rules Guide Link */}
            <View style={styles.rulesBarRow}>
              <View style={styles.powerplayBadge}>
                <Text style={styles.powerplayBadgeText}>
                  ⭕ Powerplay: Overs 1-6 (Max 2 fielders outside 30y ring)
                </Text>
              </View>
              <View style={{ flexDirection: 'column', gap: 8, width: '100%' }}>
                <TouchableOpacity
                  style={[styles.rulesGuideBtn, { width: '100%', alignItems: 'center', paddingVertical: 8 }]}
                  onPress={() => {
                    setActiveRule('FREE_HIT');
                    setShowRulesModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.rulesGuideBtnText, { textAlign: 'center' }]}>⚖️ View Cricket Rules Guide & Diagrams</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.rulesGuideBtn, { width: '100%', alignItems: 'center', paddingVertical: 8, backgroundColor: '#0284c7', borderColor: '#0ea5e9' }]}
                  onPress={() => setShowUmpireGallery(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.rulesGuideBtnText, { color: '#ffffff', textAlign: 'center' }]}>🏁 Umpire Hand Signals Guide & Animations</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Broadcast Highlights & Milestones Banner (Strictly dynamically calculated from real match performance) */}
          {computedHighlights && computedHighlights.length > 0 && (
            <MatchHighlightsBanner highlights={computedHighlights} />
          )}

          {/* ─────────────────────────────────────────────────────────────
              BATTING SCORECARD TABLE
              ───────────────────────────────────────────────────────────── */}
          <View style={[styles.sectionHeaderRow, !isDesktop && styles.sectionHeaderRowMobile]}>
            <Text style={styles.sectionHeaderTitle}>🏏 Batting Scorecard</Text>
            <Text style={styles.sectionHeaderSub}>Innings of {currentInnings?.battingTeam || 'Batting Team'}</Text>
          </View>

          <View style={styles.tableWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: '100%' }}>
              <View style={[styles.tableInner, { minWidth: isDesktop ? '100%' : (isMobile ? '100%' : 340) }]}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <View style={[styles.colName, styles.tableHeaderCell, { alignItems: 'flex-start' }]}>
                    <Text style={[styles.cell, styles.cellLeft, styles.tableHeaderText]}>Batter</Text>
                  </View>
                  <View style={[styles.colNum, styles.tableHeaderCell]}>
                    <Text style={[styles.cell, styles.tableHeaderText]}>R</Text>
                  </View>
                  <View style={[styles.colNum, styles.tableHeaderCell]}>
                    <Text style={[styles.cell, styles.tableHeaderText]}>B</Text>
                  </View>
                  <View style={[styles.colNum, styles.tableHeaderCell]}>
                    <Text style={[styles.cell, styles.tableHeaderText]}>4s</Text>
                  </View>
                  <View style={[styles.colNum, styles.tableHeaderCell]}>
                    <Text style={[styles.cell, styles.tableHeaderText]}>6s</Text>
                  </View>
                  <View style={[styles.colNumSr, styles.tableHeaderCell, !isDesktop && styles.tableCellLast]}>
                    <Text style={[styles.cell, styles.tableHeaderText]}>SR</Text>
                  </View>
                  {isDesktop && (
                    <View style={[styles.colAction, styles.tableHeaderCell, styles.tableCellLast]}>
                      <Text style={[styles.cell, styles.tableHeaderText]}>Analytics</Text>
                    </View>
                  )}
                </View>

                {(currentInnings.batters || []).map((b: any, bIdx: number) => {
                  const isSelected = selectedWagonBatterId === b.id;
                  return (
                    <TouchableOpacity
                      key={b.id || bIdx}
                      activeOpacity={0.7}
                      onPress={() => setSelectedWagonBatterId(b.id)}
                      style={[
                        styles.tableRow,
                        bIdx % 2 === 1 && styles.tableRowAlt,
                        isSelected && { backgroundColor: '#f0f9ff' }
                      ]}
                    >
                      <View style={[styles.colName, styles.tableCell]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          <Text style={[styles.playerName, isSelected && { color: '#0284c7' }]} numberOfLines={2}>
                            {b.name}
                          </Text>
                          {isSelected && <Text style={{ fontSize: 11 }}>🎯</Text>}
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            const isDismissed = b.isOut || (b.dismissal && !b.dismissal.toLowerCase().includes('not out'));
                            if (isDismissed) {
                              setActiveUmpireSignal({
                                type: 'OUT',
                                title: `BATTER OUT!`,
                                batterName: b.name,
                                runs: b.runs,
                                dismissalType: b.dismissal || 'Wicket Out',
                                extraDetails: `Official dismissal recorded: ${b.dismissal || 'Out'} (${b.runs} off ${b.balls}b) • MCC Law 31`
                              });
                            }
                          }}
                          activeOpacity={b.isOut ? 0.7 : 1}
                        >
                          <Text style={[styles.dismissal, b.isOut && { color: '#ef4444', fontWeight: 'bold' }]} numberOfLines={2}>
                            {b.dismissal || (b.isOut ? 'out' : 'not out')}{b.isOut ? ' ☝️' : ''}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <View style={[styles.colNum, styles.tableCell]}>
                        <Text style={[styles.cell, styles.runsText]}>{b.runs}</Text>
                      </View>
                      <View style={[styles.colNum, styles.tableCell]}>
                        <Text style={styles.cell}>{b.balls}</Text>
                      </View>
                      <View style={[styles.colNum, styles.tableCell]}>
                        <Text style={styles.cell}>{b.fours}</Text>
                      </View>
                      <View style={[styles.colNum, styles.tableCell]}>
                        <Text style={styles.cell}>{b.sixes}</Text>
                      </View>
                      <View style={[styles.colNumSr, styles.tableCell, !isDesktop && styles.tableCellLast]}>
                        <Text style={[styles.cell, styles.srText]}>
                          {typeof b.strikeRate === 'number' ? b.strikeRate.toFixed(1) : (b.strikeRate ?? '0.0')}
                        </Text>
                      </View>
                      {isDesktop && (
                        <View style={[styles.colAction, styles.tableCell, styles.tableCellLast]}>
                          <TouchableOpacity
                            style={[
                              styles.wagonWheelBtn,
                              isSelected && styles.wagonWheelBtnActive
                            ]}
                            onPress={() => setSelectedWagonBatterId(b.id)}
                          >
                            <Text style={[
                              styles.wagonWheelBtnText,
                              isSelected && styles.wagonWheelBtnTextActive
                            ]}>
                              🎯 Wheel
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}

                {/* Extras & Total Rows */}
                {(() => {
                  const ex = currentInnings.extras || {};
                  const b = Number(ex.bye ?? ex.byes ?? 0);
                  const lb = Number(ex.legBye ?? ex.leg_byes ?? 0);
                  const w = Number(ex.wide ?? ex.wides ?? 0);
                  const nb = Number(ex.noBall ?? ex.no_balls ?? 0);
                  const p = Number(ex.penalty ?? 0);
                  const exTotal = Number(ex.total ?? (b + lb + w + nb + p));

                  const ovParts = String(currentInnings.overs || '0.0').split('.');
                  const ovCompleted = parseInt(ovParts[0] || '0', 10) || 0;
                  const ovBalls = parseInt(ovParts[1] || '0', 10) || 0;
                  const totalBowledBalls = ovCompleted * 6 + ovBalls;
                  const computedRR = currentInnings.runRate || (
                    totalBowledBalls > 0
                      ? ((Number(currentInnings.totalRuns || 0)) / (totalBowledBalls / 6)).toFixed(2)
                      : '0.00'
                  );

                  return (
                    <>
                      <View style={[styles.extrasRow, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }]}>
                        <Text style={styles.extrasText}>Extras</Text>
                        <Text style={[styles.extrasText, { color: '#1e293b' }]}>
                          {exTotal} (b {b}, lb {lb}, w {w}, nb {nb}, p {p})
                        </Text>
                      </View>
                      <View style={[styles.extrasRow, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0' }]}>
                        <Text style={[styles.extrasText, { color: '#0f172a', fontWeight: '800' }]}>Total</Text>
                        <Text style={[styles.extrasText, { color: '#0f172a', fontWeight: '800' }]}>
                          {currentInnings.totalRuns || 0}-{currentInnings.wickets || 0} ({currentInnings.overs || '0.0'} Overs, RR: {computedRR})
                        </Text>
                      </View>
                    </>
                  );
                })()}
              </View>
            </ScrollView>
          </View>

          {/* ─────────────────────────────────────────────────────────────
              BATSMAN WAGON WHEEL & PLAYING AREA PERCENTAGE
              ───────────────────────────────────────────────────────────── */}
          {currentInnings && currentInnings.batters && currentInnings.batters.length > 0 && (
            <ErrorBoundary fallbackTitle="Batsman Analytics & Wagon Wheel">
              <WagonWheel
                deliveries={currentInnings.deliveries || []}
                batters={currentInnings.batters || []}
                selectedBatterId={selectedWagonBatterId || currentInnings.batters[0]?.id}
                onSelectBatter={(id) => setSelectedWagonBatterId(id)}
                title={`🏏 ${currentInnings.battingTeam || 'Team'} - Batsman Wagon Wheel`}
                subtitle="Interactive Shot Trajectories, 8-Sector Playing Area & Off/Leg Balance"
              />
            </ErrorBoundary>
          )}

          <View style={{ height: 16 }} />

          {/* ─────────────────────────────────────────────────────────────
              BOWLING SCORECARD TABLE
              ───────────────────────────────────────────────────────────── */}
          <View style={[styles.sectionHeaderRow, !isDesktop && styles.sectionHeaderRowMobile]}>
            <View>
              <Text style={styles.sectionHeaderTitle}>🎯 Bowling Figures</Text>
              <Text style={styles.sectionHeaderSub}>Attack by {currentInnings.bowlingTeam || 'Opponent'}</Text>
            </View>
            {currentInnings.currentBowler && (
              <View style={styles.liveBowlerHeaderBadge}>
                <Text style={styles.liveBowlerHeaderBadgeText}>
                  🎳 Active: {currentInnings.currentBowler.name}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.tableWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: '100%' }}>
              <View style={[styles.tableInner, { minWidth: isDesktop ? '100%' : (isMobile ? '100%' : 340) }]}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <View style={[styles.colName, styles.tableHeaderCell, { alignItems: 'flex-start' }]}>
                    <Text style={[styles.cell, styles.cellLeft, styles.tableHeaderText]}>Bowler</Text>
                  </View>
                  <View style={[styles.colNum, styles.tableHeaderCell]}>
                    <Text style={[styles.cell, styles.tableHeaderText]}>O</Text>
                  </View>
                  <View style={[styles.colNum, styles.tableHeaderCell]}>
                    <Text style={[styles.cell, styles.tableHeaderText]}>M</Text>
                  </View>
                  <View style={[styles.colNum, styles.tableHeaderCell]}>
                    <Text style={[styles.cell, styles.tableHeaderText]}>R</Text>
                  </View>
                  <View style={[styles.colNum, styles.tableHeaderCell]}>
                    <Text style={[styles.cell, styles.tableHeaderText]}>W</Text>
                  </View>
                  <View style={[styles.colNum, styles.tableHeaderCell]}>
                    <Text style={[styles.cell, styles.tableHeaderText]}>NB</Text>
                  </View>
                  <View style={[styles.colNum, styles.tableHeaderCell]}>
                    <Text style={[styles.cell, styles.tableHeaderText]}>WD</Text>
                  </View>
                  <View style={[styles.colNumEcon, styles.tableHeaderCell, styles.tableCellLast]}>
                    <Text style={[styles.cell, styles.tableHeaderText]}>ECO</Text>
                  </View>
                </View>

                {(currentInnings.bowlers || []).map((bw: any, bwIdx: number) => {
                  const isCurrent = !!(
                    bw.isCurrentBowler ||
                    (currentInnings.currentBowler && (bw.playerId === currentInnings.currentBowler.id || bw.name === currentInnings.currentBowler.name))
                  );
                  const isSuspended = !!(
                    bw.isSuspended ||
                    (currentInnings.suspendedBowlers || []).some((s: any) => s.id === bw.playerId || s.name === bw.name)
                  );

                  // Mid-over substitution detection
                  const subRecord = (currentInnings.substitutions || []).find((s: any) =>
                    s.oldBowlerId === bw.playerId || s.oldBowlerName === bw.name ||
                    s.newBowlerId === bw.playerId || s.newBowlerName === bw.name
                  );

                  const isQuotaFull = bw.isQuotaFull || parseFloat(bw.overs || '0') >= (bw.maxQuota || 4.0);

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
                        styles.tableRow,
                        bwIdx % 2 === 1 && styles.tableRowAlt,
                        isCurrent && { backgroundColor: '#f0fdfa' },
                        isSuspended && { backgroundColor: '#fff1f2' }
                      ]}
                    >
                      <View style={[styles.colName, styles.tableCell, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={[styles.playerName, isCurrent && { color: '#005960', fontWeight: '800' }]}>
                            {bw.name}
                          </Text>
                          {isCurrent && (
                            <View style={styles.bowlingBadge}>
                              <Text style={styles.bowlingBadgeText}>🟢 Bowling</Text>
                            </View>
                          )}
                        </View>
                        {isSuspended ? (
                          <View style={styles.suspendedPill}>
                            <Text style={styles.suspendedPillText}>🚫 Suspended (2 No-Balls)</Text>
                          </View>
                        ) : isQuotaFull ? (
                          <View style={styles.quotaPill}>
                            <Text style={styles.quotaPillText}>🔋 Quota Full ({bw.overs}/{bw.maxQuota || 4}.0 Ov)</Text>
                          </View>
                        ) : badgeText ? (
                          <View style={styles.subPill}>
                            <Text style={styles.subPillText}>{badgeText}</Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={[styles.colNum, styles.tableCell]}>
                        <Text style={[styles.cell, isCurrent && { fontWeight: '800', color: '#005960' }]}>
                          {bw.overs}
                        </Text>
                      </View>
                      <View style={[styles.colNum, styles.tableCell]}>
                        <Text style={styles.cell}>{bw.maidens || 0}</Text>
                      </View>
                      <View style={[styles.colNum, styles.tableCell]}>
                        <Text style={styles.cell}>{bw.runs}</Text>
                      </View>
                      <View style={[styles.colNum, styles.tableCell]}>
                        <Text style={[styles.cell, styles.wicketsText]}>{bw.wickets}</Text>
                      </View>
                      <View style={[styles.colNum, styles.tableCell]}>
                        <Text style={styles.cell}>{bw.noBalls ?? 0}</Text>
                      </View>
                      <View style={[styles.colNum, styles.tableCell]}>
                        <Text style={styles.cell}>{bw.wides ?? 0}</Text>
                      </View>
                      <View style={[styles.colNumEcon, styles.tableCell, styles.tableCellLast]}>
                        <Text style={[styles.cell, styles.econText]}>
                          {typeof bw.economy === 'number' ? bw.economy.toFixed(2) : (bw.economy ?? '0.00')}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>


          {/* FALL OF WICKETS */}
          {Array.isArray(currentInnings.fallOfWickets) && currentInnings.fallOfWickets.length > 0 && (
            <View style={[styles.tableWrapper, { marginTop: 14, marginBottom: 14 }]}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <View style={[styles.colName, styles.tableHeaderCell, { alignItems: 'flex-start' }]}>
                  <Text style={[styles.cell, styles.cellLeft, styles.tableHeaderText]}>Fall of Wickets</Text>
                </View>
                <View style={[styles.colNum, styles.tableHeaderCell, { flex: 1 }]}>
                  <Text style={[styles.cell, styles.tableHeaderText]}>Score</Text>
                </View>
                <View style={[styles.colNumEcon, styles.tableHeaderCell, styles.tableCellLast, { flex: 1 }]}>
                  <Text style={[styles.cell, styles.tableHeaderText]}>Over</Text>
                </View>
              </View>
              {currentInnings.fallOfWickets.map((f: any, idx: number) => {
                let w = f?.wicket;
                let s = f?.score;
                let b = f?.batter;
                let o = f?.over;

                if (typeof f === 'string') {
                  const m1 = f.match(/^(\d+)-(\d+)\s*\((.*?),\s*([\d.]+)\s*ov\)/i);
                  const m2 = f.match(/^(\d+)\/(\d+)\s*\((.*?),\s*([\d.]+)\s*ov\)/i);
                  if (m1) {
                    w = m1[1];
                    s = m1[2];
                    b = m1[3];
                    o = m1[4];
                  } else if (m2) {
                    s = m2[1];
                    w = m2[2];
                    b = m2[3];
                    o = m2[4];
                  }
                }

                return (
                  <View key={idx} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
                    <View style={[styles.colName, styles.tableCell, { alignItems: 'flex-start' }]}>
                      <Text style={styles.playerName}>{b || f || 'Batter'}</Text>
                    </View>
                    <View style={[styles.colNum, styles.tableCell, { flex: 1 }]}>
                      <Text style={[styles.cell, { fontWeight: '700', color: '#0f172a' }]}>
                        {s !== undefined ? `${s}-${w || idx + 1}` : '-'}
                      </Text>
                    </View>
                    <View style={[styles.colNumEcon, styles.tableCell, styles.tableCellLast, { flex: 1 }]}>
                      <Text style={styles.cell}>{o || '-'}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* ─────────────────────────────────────────────────────────────
              KEY BATTING PARTNERSHIPS
              ───────────────────────────────────────────────────────────── */}
          {Array.isArray(currentInnings.partnerships) && currentInnings.partnerships.length > 0 && (
            <View style={styles.fowCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <Image
                  source={IMG_PARTNERSHIP}
                  style={{ width: 72, height: 48, borderRadius: 8, borderWidth: 1.5, borderColor: '#f59e0b' }}
                  resizeMode="cover"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fowTitle}>🤝 Key Batting Partnerships</Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#b45309' }}>
                    {currentInnings?.battingTeam || 'Batting Team'} • Boundary & Strike Rotation Analysis
                  </Text>
                </View>
              </View>
              <View style={{ gap: 6 }}>
                {currentInnings.partnerships.map((p: any, idx: number) => {
                  const pRuns = p.runs || 0;
                  const pBalls = p.balls || 0;
                  const hasSplit = Boolean(p.batter1Name && p.batter2Name);
                  return (
                    <View
                      key={`part-${idx}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: '#fde68a',
                        backgroundColor: '#fffbeb',
                        gap: 8
                      }}
                    >
                      {hasSplit ? (
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                            <Text style={{ flex: 1.2, fontSize: 12, fontWeight: '800', color: '#0f172a' }} numberOfLines={1}>
                              {p.batter1Name} <Text style={{ color: '#475569', fontWeight: '600' }}>{p.batter1Runs ?? 0}({p.batter1Balls ?? 0})</Text>
                            </Text>
                            <Text style={{ fontSize: 12.5, fontWeight: '900', color: '#b45309', minWidth: 56, textAlign: 'center' }}>
                              {pRuns}({pBalls})
                            </Text>
                            <Text style={{ flex: 1.2, fontSize: 12, fontWeight: '800', color: '#0f172a', textAlign: 'right' }} numberOfLines={1}>
                              <Text style={{ color: '#475569', fontWeight: '600' }}>{p.batter2Runs ?? 0}({p.batter2Balls ?? 0})</Text> {p.batter2Name}
                            </Text>
                          </View>
                          {(() => {
                            const r1 = Number(p.batter1Runs || 0);
                            const r2 = Number(p.batter2Runs || 0);
                            const sumR = r1 + r2;
                            const pct1 = sumR > 0 ? Math.round((r1 / sumR) * 100) : 50;
                            const pct2 = 100 - pct1;
                            return (
                              <View style={{ flexDirection: 'row', height: 6, borderRadius: 4, overflow: 'hidden', backgroundColor: '#e2e8f0' }}>
                                <View style={{ flex: Math.max(5, pct1), backgroundColor: '#0f172a' }} />
                                <View style={{ width: 2, backgroundColor: '#ffffff' }} />
                                <View style={{ flex: Math.max(5, pct2), backgroundColor: '#d97706' }} />
                              </View>
                            );
                          })()}
                        </View>
                      ) : (
                        <>
                          <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: '#0284c7' }} numberOfLines={1}>
                            {p.batters || 'Pair'}
                          </Text>
                          <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#b45309' }}>
                            {pRuns}({pBalls})
                          </Text>
                        </>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ─────────────────────────────────────────────────────────────
              FIELDING SCORECARD & DISCIPLINE
              ───────────────────────────────────────────────────────────── */}
          <View style={[styles.sectionHeaderRow, !isDesktop && styles.sectionHeaderRowMobile]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={styles.sectionHeaderTitle}>🛡️ Fielding Performance & Impact</Text>
              <View style={{ backgroundColor: '#0284c7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 }}>
                <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '900' }}>FIELDING SIDE</Text>
              </View>
            </View>
            <Text style={styles.sectionHeaderSub}>Innings of {currentInnings.bowlingTeam || 'Opposition'}</Text>
          </View>

          <View style={styles.tableWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: '100%' }}>
              <View style={[styles.tableInner, { minWidth: isDesktop ? '100%' : (isMobile ? '100%' : 360) }]}>
                <View style={[styles.tableRow, styles.tableHeader, { backgroundColor: '#0f172a', borderBottomColor: '#334155' }]}>
                  <View style={[styles.colName, styles.tableHeaderCellDark, { alignItems: 'flex-start' }]}>
                    <Text style={[styles.cell, styles.cellLeft, styles.tableHeaderText, { color: '#38bdf8' }]}>Fielder</Text>
                  </View>
                  <View style={[styles.colFieldNum, styles.tableHeaderCellDark]}>
                    <Text style={[styles.cell, styles.tableHeaderText, { color: '#38bdf8' }]}>
                      {isDesktop ? 'Catches' : 'Ct'}
                    </Text>
                  </View>
                  <View style={[styles.colFieldNum, styles.tableHeaderCellDark]}>
                    <Text style={[styles.cell, styles.tableHeaderText, { color: '#38bdf8' }]}>
                      {isDesktop ? 'Run Outs' : 'RO'}
                    </Text>
                  </View>
                  <View style={[styles.colFieldNum, styles.tableHeaderCellDark]}>
                    <Text style={[styles.cell, styles.tableHeaderText, { color: '#38bdf8' }]}>
                      {isDesktop ? 'Collects' : 'Coll'}
                    </Text>
                  </View>
                  <View style={[styles.colFieldNum, styles.tableHeaderCellDark]}>
                    <Text style={[styles.cell, styles.tableHeaderText, { color: '#38bdf8' }]}>
                      {isDesktop ? 'Boundary Saves' : 'Saves'}
                    </Text>
                  </View>
                  <View style={[styles.colFieldRating, styles.tableHeaderCellDark, styles.tableCellLast]}>
                    <Text style={[styles.cell, styles.tableHeaderText, { color: '#38bdf8' }]}>
                      {isDesktop ? 'Fielding Rating' : 'Rating'}
                    </Text>
                  </View>
                </View>

                {fieldingStats.map((f: any, fIdx: number) => (
                  <View key={`fld-${f.name}-${fIdx}`} style={[styles.tableRow, fIdx % 2 === 1 && styles.tableRowAlt]}>
                    <View style={[styles.colName, styles.tableCell]}>
                      <Text style={styles.playerName}>{f.name}</Text>
                      <Text style={styles.dismissal}>
                        {f.isKeeper ? '🧤 Wicketkeeper' : (f.catches > 0 || f.runOuts > 0 ? '⭐ Key Outfielder' : '🛡️ Agile Fielder')}
                      </Text>
                    </View>
                    <View style={[styles.colFieldNum, styles.tableCell]}>
                      <Text style={[styles.cell, f.catches > 0 && { fontWeight: 'bold', color: '#db2777' }]}>
                        {f.catches}
                      </Text>
                    </View>
                    <View style={[styles.colFieldNum, styles.tableCell]}>
                      <Text style={[styles.cell, f.runOuts > 0 && { fontWeight: 'bold', color: '#e11d48' }]}>
                        {f.runOuts}
                      </Text>
                    </View>
                    <View style={[styles.colFieldNum, styles.tableCell]}>
                      <Text style={styles.cell}>{f.cleanCollects}</Text>
                    </View>
                    <View style={[styles.colFieldNum, styles.tableCell]}>
                      <Text style={[styles.cell, f.boundarySaves > 0 && { fontWeight: 'bold', color: '#059669' }]}>
                        {f.boundarySaves}
                      </Text>
                    </View>
                    <View style={[styles.colFieldRating, styles.tableCell, styles.tableCellLast]}>
                      <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#0284c7', textAlign: 'center' }}>
                        {f.rating}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* ─────────────────────────────────────────────────────────────
              DYNAMIC STATISTICAL VISUALIZATION: SCORING & BOUNDARY CHART
              ───────────────────────────────────────────────────────────── */}
          {inningsStats && (
            <View style={styles.statsCard}>
              <View style={styles.statsHeader}>
                <Text style={{ fontSize: 18, marginRight: 8 }}>📊</Text>
                <View>
                  <Text style={styles.statsCardTitle}>Innings Scoring Distribution & Boundaries</Text>
                  <Text style={styles.statsCardSubtitle}>Visual breakdown of runs scored from boundaries vs running</Text>
                </View>
              </View>

              {/* DONUT & HERO STAT METRICS ROW */}
              <View style={[styles.statsRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
                {/* Visual Donut / Radial Ring */}
                <View style={styles.chartCol}>
                  <View
                    style={[
                      styles.donutOuterRing,
                      Platform.OS === 'web'
                        ? ({
                            background: `conic-gradient(#10b981 0% ${inningsStats.boundaryPct}%, #3b82f6 ${inningsStats.boundaryPct}% ${inningsStats.boundaryPct + inningsStats.runningPct}%, #f59e0b ${inningsStats.boundaryPct + inningsStats.runningPct}% 100%)`,
                            backgroundImage: `conic-gradient(#10b981 0% ${inningsStats.boundaryPct}%, #3b82f6 ${inningsStats.boundaryPct}% ${inningsStats.boundaryPct + inningsStats.runningPct}%, #f59e0b ${inningsStats.boundaryPct + inningsStats.runningPct}% 100%)`
                          } as any)
                        : {
                            borderWidth: 10,
                            borderColor: '#10b981',
                            borderTopColor: '#10b981',
                            borderRightColor: '#3b82f6',
                            borderBottomColor: '#f59e0b',
                            borderLeftColor: '#10b981',
                            backgroundColor: '#0a1432'
                          }
                    ]}
                  >
                    <View style={styles.donutHole}>
                      <Text style={styles.donutNumber}>{inningsStats.boundaryPct}%</Text>
                      <Text style={styles.donutUnitLabel}>BOUNDARIES</Text>
                    </View>
                  </View>
                </View>

                {/* 3 Metric Pills */}
                <View style={styles.metricsCol}>
                  <View style={[styles.metricPill, { borderLeftColor: '#10b981' }]}>
                    <View>
                      <Text style={styles.metricLabel}>Boundary Runs (4s & 6s)</Text>
                      <Text style={styles.metricSub}>{inningsStats.total4s} fours • {inningsStats.total6s} sixes</Text>
                    </View>
                    <Text style={[styles.metricValue, { color: '#10b981' }]}>{inningsStats.boundaryRuns} r</Text>
                  </View>

                  <View style={[styles.metricPill, { borderLeftColor: '#3b82f6' }]}>
                    <View>
                      <Text style={styles.metricLabel}>Running Between Wickets</Text>
                      <Text style={styles.metricSub}>Singles, doubles & triples</Text>
                    </View>
                    <Text style={[styles.metricValue, { color: '#3b82f6' }]}>{inningsStats.runningRuns} r</Text>
                  </View>

                  <View style={[styles.metricPill, { borderLeftColor: '#f59e0b' }]}>
                    <View>
                      <Text style={styles.metricLabel}>Extras Conceded</Text>
                      <Text style={styles.metricSub}>{currentInnings.extras?.breakdown || 'Wides, no-balls & byes'}</Text>
                    </View>
                    <Text style={[styles.metricValue, { color: '#f59e0b' }]}>{inningsStats.extrasRuns} r</Text>
                  </View>
                </View>
              </View>

              {/* Dynamic Proportional Distribution Bar */}
              <View style={styles.distributionBarWrapper}>
                <View style={styles.distributionBarTrack}>
                  {inningsStats.boundaryPct > 0 && (
                    <View style={[styles.distributionBarSegment, { width: `${inningsStats.boundaryPct}%`, backgroundColor: '#10b981' }]} />
                  )}
                  {inningsStats.runningPct > 0 && (
                    <View style={[styles.distributionBarSegment, { width: `${inningsStats.runningPct}%`, backgroundColor: '#3b82f6' }]} />
                  )}
                  {inningsStats.extrasPct > 0 && (
                    <View style={[styles.distributionBarSegment, { width: `${inningsStats.extrasPct}%`, backgroundColor: '#f59e0b' }]} />
                  )}
                </View>
                <View style={styles.distributionPctRow}>
                  <Text style={[styles.distributionPctText, { color: '#10b981' }]}>
                    {inningsStats.boundaryPct}% Boundaries
                  </Text>
                  <Text style={[styles.distributionPctText, { color: '#3b82f6' }]}>
                    {inningsStats.runningPct}% Running
                  </Text>
                  <Text style={[styles.distributionPctText, { color: '#f59e0b' }]}>
                    {inningsStats.extrasPct}% Extras
                  </Text>
                </View>
              </View>
            </View>
          )}
          </>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 2: SQUADS (PLAYING XI - CFVD NAVY & GOLD DESIGN)
              ───────────────────────────────────────────────────────────── */}
          {activeSectionTab === 'SQUADS' && (() => {
            const sqA: any[] = scorecardData?.squads?.teamA || [];
            const sqB: any[] = scorecardData?.squads?.teamB || [];
            const getInitials = (name: string) => {
              const parts = String(name || 'P').trim().split(/\s+/);
              return parts.length >= 2
                ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
                : String(name || 'P').slice(0, 2).toUpperCase();
            };
            const renderSquadCol = (teamName: string, players: any[], accentColor: string) => (
              <View style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1.5, borderColor: '#fde68a', overflow: 'hidden' }}>
                <View style={{ backgroundColor: '#0f172a', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: accentColor }}>
                  <Text style={{ color: '#facc15', fontSize: 13.5, fontWeight: '900' }} numberOfLines={1}>
                    {teamName}
                  </Text>
                  <Text style={{ color: '#cbd5e1', fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                    Playing XI ({players.length} Players)
                  </Text>
                </View>
                {players.length === 0 ? (
                  <Text style={{ padding: 16, fontSize: 12.5, color: '#64748b', textAlign: 'center' }}>
                    Playing XI squad not published yet.
                  </Text>
                ) : (
                  players.map((pl: any, idx: number) => (
                    <View
                      key={pl.id || idx}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 12,
                        paddingVertical: 9,
                        borderBottomWidth: idx < players.length - 1 ? 1 : 0,
                        borderBottomColor: '#f1f5f9',
                        backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff',
                        gap: 10
                      }}
                    >
                      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: accentColor, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#ffffff', fontSize: 11.5, fontWeight: '900' }}>
                          {getInitials(pl.name)}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a' }} numberOfLines={1}>
                          {pl.name}{pl.isCaptain ? ' (C)' : ''}{pl.isKeeper ? ' (WK)' : ''}
                        </Text>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748b', marginTop: 1 }}>
                          {String(pl.role || 'PLAYER').replace(/_/g, ' ')}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            );

            return (
              <View style={{ gap: 12 }}>
                <View style={{ backgroundColor: '#0f172a', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1.5, borderColor: '#f59e0b' }}>
                  <Text style={{ color: '#facc15', fontSize: 14, fontWeight: '900', flex: 1 }} numberOfLines={1}>
                    🛡️ {match.teamA || 'Team A'}
                  </Text>
                  <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '800', marginHorizontal: 8 }}>VS</Text>
                  <Text style={{ color: '#facc15', fontSize: 14, fontWeight: '900', flex: 1, textAlign: 'right' }} numberOfLines={1}>
                    {match.teamB || 'Team B'} 🛡️
                  </Text>
                </View>
                <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 12 }}>
                  {renderSquadCol(match.teamA || 'Team A', sqA, '#0f172a')}
                  {renderSquadCol(match.teamB || 'Team B', sqB, '#b45309')}
                </View>
              </View>
            );
          })()}

          {/* ─────────────────────────────────────────────────────────────
              TAB 3: BALL MAP & OVERS GRID WITH FILTERS
              ───────────────────────────────────────────────────────────── */}
          {activeSectionTab === 'BALL_MAP' && (() => {
            const allDeliveries: any[] = currentInnings?.deliveries || [];
            const bowlersList: any[] = currentInnings?.bowlers || [];
            const battersList: any[] = currentInnings?.batters || [];

            const filteredDeliveries = allDeliveries.filter((d: any) => {
              if (ballMapBowlerId !== 'ALL' && d.bowlerId !== ballMapBowlerId) return false;
              if (ballMapBatterId !== 'ALL' && d.strikerId !== ballMapBatterId) return false;
              return true;
            });

            // Group by overNumber
            const oversMap: Record<number, any[]> = {};
            filteredDeliveries.forEach((d: any) => {
              const ov = Number(d.overNumber ?? 0);
              if (!oversMap[ov]) oversMap[ov] = [];
              oversMap[ov].push(d);
            });
            const overNumbers = Object.keys(oversMap).map(Number).sort((a, b) => a - b);

            return (
              <View style={{ gap: 12 }}>
                {/* Filters Card (Dropdowns for Bowlers & Batters) */}
                <View style={{ backgroundColor: '#ffffff', borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: '#fde68a', gap: 10, zIndex: 40 }}>
                  <Text style={{ fontSize: 14, fontWeight: '900', color: '#0f172a' }}>
                    🗺️ Ball-by-Ball Over Map &amp; Filters
                  </Text>

                  <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 10 }}>
                    {/* Bowler Dropdown */}
                    <View style={{ flex: 1, zIndex: bowlerDropdownOpen ? 50 : 20 }}>
                      <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#64748b', marginBottom: 5 }}>FILTER BY BOWLER:</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setBowlerDropdownOpen((prev) => !prev);
                          setBatterDropdownOpen(false);
                        }}
                        activeOpacity={0.8}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingHorizontal: 12,
                          paddingVertical: 9,
                          borderRadius: 8,
                          backgroundColor: ballMapBowlerId === 'ALL' ? '#f8fafc' : '#0f172a',
                          borderWidth: 1.2,
                          borderColor: ballMapBowlerId === 'ALL' ? '#cbd5e1' : '#f59e0b'
                        }}
                      >
                        <Text
                          style={{ fontSize: 12.5, fontWeight: '700', color: ballMapBowlerId === 'ALL' ? '#0f172a' : '#facc15', flex: 1 }}
                          numberOfLines={1}
                        >
                          {ballMapBowlerId === 'ALL'
                            ? 'All Bowlers'
                            : (bowlersList.find((bw: any) => (bw.playerId || bw.id) === ballMapBowlerId)?.name || 'Selected Bowler')}
                        </Text>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: ballMapBowlerId === 'ALL' ? '#64748b' : '#facc15', marginLeft: 6 }}>
                          {bowlerDropdownOpen ? '▲' : '▼'}
                        </Text>
                      </TouchableOpacity>

                      {bowlerDropdownOpen && (
                        <View style={{ marginTop: 4, backgroundColor: '#ffffff', borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', maxHeight: 210, overflow: 'hidden' }}>
                          <ScrollView nestedScrollEnabled style={{ maxHeight: 210 }}>
                            <TouchableOpacity
                              onPress={() => {
                                setBallMapBowlerId('ALL');
                                setBowlerDropdownOpen(false);
                              }}
                              style={{ paddingHorizontal: 12, paddingVertical: 9, backgroundColor: ballMapBowlerId === 'ALL' ? '#0f172a' : '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}
                            >
                              <Text style={{ fontSize: 12.5, fontWeight: '700', color: ballMapBowlerId === 'ALL' ? '#facc15' : '#334155' }}>
                                All Bowlers
                              </Text>
                            </TouchableOpacity>
                            {bowlersList.map((bw: any, i: number) => {
                              const pid = bw.playerId || bw.id;
                              const active = ballMapBowlerId === pid;
                              return (
                                <TouchableOpacity
                                  key={pid || i}
                                  onPress={() => {
                                    setBallMapBowlerId(pid);
                                    setBowlerDropdownOpen(false);
                                  }}
                                  style={{ paddingHorizontal: 12, paddingVertical: 9, backgroundColor: active ? '#0f172a' : '#ffffff', borderBottomWidth: i < bowlersList.length - 1 ? 1 : 0, borderBottomColor: '#f1f5f9' }}
                                >
                                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: active ? '#facc15' : '#334155' }} numberOfLines={1}>
                                    {bw.name}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        </View>
                      )}
                    </View>

                    {/* Batter Dropdown */}
                    <View style={{ flex: 1, zIndex: batterDropdownOpen ? 50 : 10 }}>
                      <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#64748b', marginBottom: 5 }}>FILTER BY BATTER:</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setBatterDropdownOpen((prev) => !prev);
                          setBowlerDropdownOpen(false);
                        }}
                        activeOpacity={0.8}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingHorizontal: 12,
                          paddingVertical: 9,
                          borderRadius: 8,
                          backgroundColor: ballMapBatterId === 'ALL' ? '#f8fafc' : '#0f172a',
                          borderWidth: 1.2,
                          borderColor: ballMapBatterId === 'ALL' ? '#cbd5e1' : '#f59e0b'
                        }}
                      >
                        <Text
                          style={{ fontSize: 12.5, fontWeight: '700', color: ballMapBatterId === 'ALL' ? '#0f172a' : '#facc15', flex: 1 }}
                          numberOfLines={1}
                        >
                          {ballMapBatterId === 'ALL'
                            ? 'All Batters'
                            : (battersList.find((bt: any) => (bt.playerId || bt.id) === ballMapBatterId)?.name || 'Selected Batter')}
                        </Text>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: ballMapBatterId === 'ALL' ? '#64748b' : '#facc15', marginLeft: 6 }}>
                          {batterDropdownOpen ? '▲' : '▼'}
                        </Text>
                      </TouchableOpacity>

                      {batterDropdownOpen && (
                        <View style={{ marginTop: 4, backgroundColor: '#ffffff', borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', maxHeight: 210, overflow: 'hidden' }}>
                          <ScrollView nestedScrollEnabled style={{ maxHeight: 210 }}>
                            <TouchableOpacity
                              onPress={() => {
                                setBallMapBatterId('ALL');
                                setBatterDropdownOpen(false);
                              }}
                              style={{ paddingHorizontal: 12, paddingVertical: 9, backgroundColor: ballMapBatterId === 'ALL' ? '#0f172a' : '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}
                            >
                              <Text style={{ fontSize: 12.5, fontWeight: '700', color: ballMapBatterId === 'ALL' ? '#facc15' : '#334155' }}>
                                All Batters
                              </Text>
                            </TouchableOpacity>
                            {battersList.map((bt: any, i: number) => {
                              const pid = bt.playerId || bt.id;
                              const active = ballMapBatterId === pid;
                              return (
                                <TouchableOpacity
                                  key={pid || i}
                                  onPress={() => {
                                    setBallMapBatterId(pid);
                                    setBatterDropdownOpen(false);
                                  }}
                                  style={{ paddingHorizontal: 12, paddingVertical: 9, backgroundColor: active ? '#0f172a' : '#ffffff', borderBottomWidth: i < battersList.length - 1 ? 1 : 0, borderBottomColor: '#f1f5f9' }}
                                >
                                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: active ? '#facc15' : '#334155' }} numberOfLines={1}>
                                    {bt.name}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Over-by-Over Ball Map Rows */}
                <View style={{ backgroundColor: '#ffffff', borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: '#fde68a', gap: 8 }}>
                  {overNumbers.length === 0 ? (
                    <Text style={{ padding: 18, textAlign: 'center', fontSize: 13, color: '#64748b' }}>
                      No deliveries match the selected filter.
                    </Text>
                  ) : (
                    overNumbers.map((ovNum) => {
                      const ballsInOv = oversMap[ovNum];
                      const ovRuns = ballsInOv.reduce((sum: number, d: any) => sum + Number(d.totalRuns || 0), 0);
                      return (
                        <View
                          key={`ov-map-${ovNum}`}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 8,
                            paddingHorizontal: 8,
                            borderRadius: 8,
                            backgroundColor: ovNum % 2 === 0 ? '#f8fafc' : '#ffffff',
                            borderWidth: 1,
                            borderColor: '#e2e8f0',
                            gap: 8
                          }}
                        >
                          <View style={{ width: 46, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#cbd5e1', paddingRight: 6 }}>
                            <Text style={{ fontSize: 11, fontWeight: '900', color: '#0f172a' }}>Ov {ovNum + 1}</Text>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#b45309' }}>{ovRuns}r</Text>
                          </View>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                            {ballsInOv.map((d: any, bIdx: number) => {
                              const isW = Boolean(d.wicket);
                              const ex = String(d.extraType || '').toUpperCase();
                              const isEx = Boolean(ex && ex !== 'NONE');
                              const rBat = Number(d.runsBatter || 0);
                              const tot = Number(d.totalRuns || 0);
                              const label = isW
                                ? 'W'
                                : isEx
                                  ? `${ex.startsWith('W') ? 'Wd' : ex.startsWith('N') ? 'Nb' : ex.startsWith('L') ? 'Lb' : 'B'}${tot > 1 ? tot : ''}`
                                  : rBat === 0 ? '•' : String(rBat);
                              const bg = isW ? '#dc2626' : rBat === 6 ? '#1d4ed8' : rBat === 4 ? '#059669' : isEx ? '#f59e0b' : rBat > 0 ? '#e0f2fe' : '#e2e8f0';
                              const fg = (isW || rBat === 6 || rBat === 4 || isEx) ? '#ffffff' : '#0f172a';
                              return (
                                <View
                                  key={d.id || bIdx}
                                  style={{
                                    minWidth: 30,
                                    height: 30,
                                    paddingHorizontal: 6,
                                    borderRadius: 6,
                                    backgroundColor: bg,
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  <Text style={{ fontSize: 11.5, fontWeight: '900', color: fg }}>{label}</Text>
                                </View>
                              );
                            })}
                          </ScrollView>
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            );
          })()}

          {/* ─────────────────────────────────────────────────────────────
              TAB 4: HIGHLIGHTS (3D MILESTONES & FIELDING HEROICS)
              ───────────────────────────────────────────────────────────── */}
          {activeSectionTab === 'HIGHLIGHTS' && (() => {
            const batters: any[] = currentInnings?.batters || [];
            const bowlers: any[] = currentInnings?.bowlers || [];
            const milestoneBatters = batters.filter((b: any) => Number(b.runs || 0) >= 50);
            const topBatter = [...batters].sort((a: any, b: any) => Number(b.runs || 0) - Number(a.runs || 0))[0];
            const milestoneBowlers = bowlers.filter((bw: any) => Number(bw.wickets || 0) >= 3);
            const topBowler = [...bowlers].sort((a: any, b: any) => Number(b.wickets || 0) - Number(a.wickets || 0))[0];
            const topFielders = [...(fieldingStats || [])].filter((f: any) => (f.catches > 0 || f.runOuts > 0 || f.boundarySaves > 0 || f.cleanCollects > 0)).slice(0, 6);

            return (
              <View style={{ gap: 14 }}>
                {/* Automatic Match Highlights & Milestones (Centuries, Fifers, Player of the Match & Record Performances) */}
                <View style={{ backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#f59e0b' }}>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: '#0f172a', marginBottom: 4 }}>
                    ⚡ AUTOMATIC MATCH HIGHLIGHTS &amp; MILESTONES
                  </Text>
                  <Text style={{ fontSize: 11.5, color: '#64748b', marginBottom: 12 }}>
                    Instant verified highlights: Centuries, Fifers, Player of the Match &amp; Record Performances
                  </Text>
                  {computedHighlights && computedHighlights.length > 0 ? (
                    <MatchHighlightsBanner highlights={computedHighlights} />
                  ) : (
                    <Text style={{ fontSize: 12.5, color: '#64748b', textAlign: 'center', paddingVertical: 12 }}>
                      Verified match highlights (Centuries, Fifers, Player of the Match &amp; Record Performances) will appear here as milestones are reached.
                    </Text>
                  )}
                </View>

                {/* 3D Batting Milestones */}
                <View style={{ backgroundColor: '#0f172a', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#f59e0b' }}>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: '#facc15', marginBottom: 4 }}>
                    🏆 3D Batting &amp; Bowling Milestones
                  </Text>
                  <Text style={{ fontSize: 11.5, color: '#cbd5e1', marginBottom: 12 }}>
                    Interactive 3D showcase of centuries, half-centuries, and match-turning spells
                  </Text>

                  {milestoneBatters.length > 0 ? (
                    <View style={{ gap: 12 }}>
                      {milestoneBatters.map((b: any, idx: number) => {
                        const is100 = Number(b.runs || 0) >= 100;
                        return (
                          <CricketFigurine3D
                            key={`3d-bat-${b.id || idx}`}
                            imageSource={is100 ? IMG_CENTURY_BATTER : IMG_MILESTONE_BATTER}
                            playerName={b.name}
                            teamName={currentInnings?.battingTeam || 'Batting Team'}
                            badgeText={is100 ? '👑 100 RUNS CENTURY' : '⭐ 50 RUNS MILESTONE'}
                            milestoneTitle={is100 ? 'MAGNIFICENT CENTURY!' : 'HALF-CENTURY!'}
                            scoreText={`${b.runs}${b.isOut ? '' : '*'}`}
                            ballsText={`${b.balls || 0} Balls`}
                            strikeRateText={String(b.strikeRate || '0.0')}
                            fours={b.fours || 0}
                            sixes={b.sixes || 0}
                            height={280}
                          />
                        );
                      })}
                    </View>
                  ) : topBatter ? (
                    <CricketFigurine3D
                      imageSource={IMG_MILESTONE_BATTER}
                      playerName={topBatter.name}
                      teamName={currentInnings?.battingTeam || 'Batting Team'}
                      badgeText="🏏 TOP SCORER OF INNINGS"
                      milestoneTitle="INNINGS LEADER"
                      scoreText={`${topBatter.runs || 0}${topBatter.isOut ? '' : '*'}`}
                      ballsText={`${topBatter.balls || 0} Balls`}
                      strikeRateText={String(topBatter.strikeRate || '0.0')}
                      fours={topBatter.fours || 0}
                      sixes={topBatter.sixes || 0}
                      height={260}
                    />
                  ) : null}

                  {/* Bowling Milestones */}
                  {(milestoneBowlers.length > 0 || topBowler) && (
                    <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                      {(milestoneBowlers.length > 0 ? milestoneBowlers : [topBowler]).filter(Boolean).map((bw: any, idx: number) => (
                        <View
                          key={`bw-hl-${bw.id || idx}`}
                          style={{ flex: 1, minWidth: 200, backgroundColor: '#1e293b', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#f59e0b' }}
                        >
                          <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#facc15' }}>
                            {Number(bw.wickets || 0) >= 5 ? '🔥 5-WICKET HAUL' : Number(bw.wickets || 0) >= 3 ? '🎯 3-WICKET HAUL' : '🎳 LEAD BOWLER'}
                          </Text>
                          <Text style={{ fontSize: 15, fontWeight: '900', color: '#ffffff', marginTop: 2 }}>{bw.name}</Text>
                          <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#38bdf8', marginTop: 4 }}>
                            {bw.wickets || 0}/{bw.runs || 0} ({bw.overs || '0.0'} Ov • Econ: {typeof bw.economy === 'number' ? bw.economy.toFixed(2) : (bw.economy ?? '0.00')})
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Fielding Highlights */}
                <View style={{ backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#fde68a' }}>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: '#0f172a', marginBottom: 4 }}>
                    🛡️ Best Fielding &amp; Match-Saving Highlights
                  </Text>
                  <Text style={{ fontSize: 11.5, color: '#64748b', marginBottom: 12 }}>
                    Catches, run-outs, stumpings, boundary saves, and clean collects
                  </Text>
                  {topFielders.length === 0 ? (
                    <Text style={{ fontSize: 12.5, color: '#64748b', textAlign: 'center', paddingVertical: 12 }}>
                      No fielding highlights recorded in this innings yet.
                    </Text>
                  ) : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                      {topFielders.map((f: any, idx: number) => (
                        <View
                          key={`fld-hl-${f.name}-${idx}`}
                          style={{
                            flex: 1,
                            minWidth: isDesktop ? 220 : '100%',
                            backgroundColor: '#fffbeb',
                            borderRadius: 10,
                            padding: 12,
                            borderWidth: 1.5,
                            borderColor: '#f59e0b'
                          }}
                        >
                          <Text style={{ fontSize: 13.5, fontWeight: '900', color: '#0f172a' }}>{f.name}</Text>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#b45309', marginTop: 2 }}>
                            {f.isKeeper ? '🧤 Wicketkeeper' : '⭐ Key Fielder'} • Rating: {f.rating}
                          </Text>
                          <Text style={{ fontSize: 11.5, color: '#334155', fontWeight: '600', marginTop: 6 }}>
                            Catches: {f.catches} • Run Outs: {f.runOuts} • Saves: {f.boundarySaves} • Collects: {f.cleanCollects}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            );
          })()}

          {/* ACTION BUTTONS */}
          <View style={{ gap: 10, marginTop: 16 }}>
            {(match.status === 'Live' || match.status === 'LIVE') && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => scorerNav?.navigate ? scorerNav.navigate('LiveScoring', { matchId }) : handleBack()}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnText}>
                  ⚡ Return to Live Scoring Console
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#059669', borderColor: '#047857' }]}
              onPress={handleBack}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>
                {params?.returnTo === 'Home' ? '🏠 Back to Association Home Portal' : '🏠 Back to Scorer Dashboard (Matches)'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <SharedFooter />
      </ScrollView>

      {/* Smart Cricket Rules & Umpire Assistant Modal */}
      <CricketRulesModal
        visible={showRulesModal}
        activeRule={activeRule}
        matchId={matchId}
        ruleContext={{
          currentFormat: match ? `${match.tournament} • ${match.overs || 20} Overs` : 'T20 Match',
          totalRuns: currentInnings?.totalRuns,
          wickets: currentInnings?.wickets
        }}
        onClose={() => setShowRulesModal(false)}
      />

      {/* Broadcast Umpire Signal Overlay */}
      <UmpireSignalOverlay
        event={activeUmpireSignal}
        onDismiss={() => setActiveUmpireSignal(null)}
      />

      {/* Umpire Hand Signals Showcase Gallery Modal */}
      <UmpireSignalsGalleryModal
        visible={showUmpireGallery}
        onClose={() => setShowUmpireGallery(false)}
        onSelectSignal={(sigType) => {
          setActiveUmpireSignal({
            type: sigType,
            overText: `Scorecard Preview • ${match?.tournament || 'Match'}`
          });
        }}
      />

      {/* Broadcast Fielding Event Animation Overlay */}
      <FieldingEventOverlay
        event={activeFieldingEvent}
        onDismiss={() => setActiveFieldingEvent(null)}
      />

      {/* EXIT SCREEN CONFIRMATION MODAL */}
      <Modal
        visible={showExitModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExitModal(false)}
      >
        <View style={styles.exitModalOverlay}>
          <View style={styles.exitModalCard}>
            <View style={styles.exitModalHeader}>
              <Text style={styles.exitModalTitle}>EXIT SCREEN</Text>
              <TouchableOpacity
                style={styles.exitRedCloseBtn}
                onPress={() => setShowExitModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.exitRedCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.exitModalBodyText}>
              Click "Exit Screen" menu to exit from the scoring engine and give yes to exit. All recorded scores and deliveries are safely preserved in the database.
            </Text>

            <View style={styles.exitModalActionsRow}>
              <TouchableOpacity
                style={styles.exitCancelBtn}
                onPress={() => setShowExitModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.exitCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              {(match.status === 'Live' || match.status === 'LIVE' || params?.returnTo === 'LiveScoring') && (
                <TouchableOpacity
                  style={[styles.exitActionBtn, { backgroundColor: '#d97706' }]}
                  onPress={() => {
                    setShowExitModal(false);
                    scorerNav?.navigate('LiveScoring', { matchId });
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.exitActionBtnText}>⚡ Live Scoring</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.exitActionBtn, { backgroundColor: '#1e3a8a' }]}
                onPress={() => {
                  setShowExitModal(false);
                  if (scorerNav?.navigate) {
                    scorerNav.navigate('Dashboard');
                  } else if (onExit) {
                    onExit();
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.exitActionBtnText}>📋 Match List</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.exitActionBtn, { backgroundColor: '#dc2626' }]}
                onPress={() => {
                  setShowExitModal(false);
                  if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    try {
                      localStorage.setItem('cfvd_last_app_screen', 'Home');
                      localStorage.removeItem('cfvd_last_scorer_match_id');
                      localStorage.removeItem('cfvd_last_scorer_screen');
                      window.location.href = '/';
                      return;
                    } catch (_e) {}
                  }
                  if (typeof onExit === 'function') {
                    onExit();
                  }
                  try {
                    router.replace('/');
                  } catch (_e) {
                    try { router.push('/'); } catch (_e2) {}
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.exitActionBtnText}>🌐 Exit to Website</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f2e9', width: '100%', minHeight: '100%' },
  header: {
    padding: 16,
    paddingTop: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 2,
    borderBottomColor: '#fde68a',
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#fde68a'
  },
  backText: { color: '#92400e', fontWeight: 'bold', fontSize: 13 },
  badgeLive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#10b981'
  },
  badgeLiveText: { color: '#047857', fontWeight: '800', fontSize: 11, textTransform: 'uppercase' },
  title: { color: '#0f172a', fontSize: 20, fontWeight: '900', letterSpacing: 0.3 },
  subtitle: { color: '#b45309', fontSize: 12.5, marginTop: 4, fontWeight: '700' },
  scroll: { flexGrow: 1 },
  contentWrapper: { padding: 16, paddingBottom: 50, maxWidth: 1100, width: '100%', alignSelf: 'center' },

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
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20
  },
  championArtworkWrapper: {
    width: 240,
    height: 195,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111e38',
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
    minWidth: 280,
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
    fontSize: 24,
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
    marginBottom: 4
  },
  championTournamentText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center'
  },

  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.5)',
    marginBottom: 18,
    justifyContent: 'center',
    gap: 8
  },
  resultEmoji: { fontSize: 18 },
  resultText: { color: '#047857', fontWeight: '800', fontSize: 14 },

  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#fde68a',
    gap: 6
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: 'transparent'
  },
  tabButtonActive: {
    backgroundColor: '#fef3c7',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    elevation: 2
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b'
  },
  tabTextActive: {
    color: '#92400e',
    fontWeight: '900'
  },

  inningsHeroCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 12,
    marginBottom: 18,
    borderWidth: 2,
    borderColor: '#fde68a',
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3
  },
  heroLeft: { flex: 1 },
  heroBattingTeam: { color: '#0f172a', fontSize: 18, fontWeight: '900' },
  heroVersus: { color: '#b45309', fontSize: 12, marginTop: 2, fontWeight: '700' },
  heroRight: { alignItems: 'flex-end' },
  heroScoreText: { color: '#d97706', fontSize: 22, fontWeight: '900' },
  heroRunRateText: { color: '#0284c7', fontSize: 11.5, marginTop: 2, fontWeight: '800' },

  // Dynamic Statistics Card Styling - Clean White & Warm Gold Theme
  statsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 2,
    borderColor: '#fde68a',
    marginBottom: 20,
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: '#fef3c7',
    paddingBottom: 10
  },
  statsCardTitle: { color: '#0f172a', fontSize: 15, fontWeight: '800' },
  statsCardSubtitle: { color: '#64748b', fontSize: 11.5, marginTop: 2 },
  statsRow: {
    alignItems: 'center',
    gap: 16,
    marginBottom: 14
  },
  chartCol: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6
  },
  donutOuterRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3
  },
  donutHole: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#fde68a',
    alignItems: 'center',
    justifyContent: 'center'
  },
  donutNumber: { color: '#0f172a', fontSize: 22, fontWeight: '900' },
  donutUnitLabel: { color: '#64748b', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  metricsCol: {
    flex: 1,
    width: '100%',
    gap: 8
  },
  metricPill: {
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#fef3c7'
  },
  metricLabel: { color: '#0f172a', fontSize: 12.5, fontWeight: '700' },
  metricSub: { color: '#64748b', fontSize: 10.5 },
  metricValue: { fontSize: 15, fontWeight: '900' },

  distributionBarWrapper: { width: '100%', marginTop: 8 },
  distributionBarTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#f1f5f9',
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  distributionBarSegment: { height: '100%' },
  distributionPctRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6
  },
  distributionPctText: { fontSize: 11, fontWeight: '700' },

  // Scorecard Tables Styling - SQL Grid Box Format
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 6
  },
  sectionHeaderRowMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4
  },
  sectionHeaderTitle: { color: '#1e293b', fontSize: 15, fontWeight: '800' },
  sectionHeaderSub: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  tableWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    overflow: 'hidden',
    marginBottom: 16,
    elevation: 2
  },
  tableInner: { width: '100%' },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    alignItems: 'stretch',
    width: '100%',
    backgroundColor: '#ffffff'
  },
  tableRowAlt: { backgroundColor: '#f8fafc' },
  tableHeader: {
    backgroundColor: '#fef3c7',
    borderBottomWidth: 2,
    borderBottomColor: '#cbd5e1',
    alignItems: 'stretch'
  },
  tableHeaderText: { color: '#92400e', fontWeight: '800', fontSize: 11.5 },
  cell: { color: '#334155', fontSize: 12.5, fontWeight: '600', textAlign: 'center' },
  cellLeft: { textAlign: 'left' },

  // SQL Table Grid Cell Border Box Styles
  tableCell: {
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 4,
    justifyContent: 'center'
  },
  tableCellLast: {
    borderRightWidth: 0
  },
  tableHeaderCell: {
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
    paddingVertical: 9,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center'
  },
  tableHeaderCellDark: {
    borderRightWidth: 1,
    borderRightColor: '#334155',
    paddingVertical: 9,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center'
  },

  colName: { flex: 1, minWidth: 110, paddingHorizontal: 8, justifyContent: 'center' },
  colNum: { width: 36, alignItems: 'center', justifyContent: 'center' },
  colNumSr: { width: 52, alignItems: 'center', justifyContent: 'center' },
  colNumEcon: { width: 56, alignItems: 'center', justifyContent: 'center' },
  colFieldNum: { width: 44, alignItems: 'center', justifyContent: 'center' },
  colFieldRating: { width: 76, alignItems: 'center', justifyContent: 'center' },
  colAction: { width: 80, alignItems: 'center', justifyContent: 'center' },
  wagonWheelBtn: {
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    borderWidth: 1,
    borderColor: '#0284c7',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6
  },
  wagonWheelBtnActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8'
  },
  wagonWheelBtnText: {
    color: '#0284c7',
    fontSize: 11,
    fontWeight: 'bold'
  },
  wagonWheelBtnTextActive: {
    color: '#ffffff'
  },
  playerName: { color: '#0f172a', fontWeight: 'bold', fontSize: 13 },
  dismissal: { color: '#b45309', fontSize: 11, fontStyle: 'italic', marginTop: 1 },
  runsText: { color: '#0f172a', fontWeight: '900', fontSize: 13.5 },
  srText: { color: '#2563eb', fontWeight: '700' },
  wicketsText: { color: '#15803d', fontWeight: '900', fontSize: 13.5 },
  econText: { color: '#475569', fontWeight: '700' },
  extrasRow: { padding: 10, backgroundColor: '#fffbeb', borderTopWidth: 1, borderTopColor: '#fde68a' },
  extrasText: { color: '#b45309', fontSize: 12, fontWeight: 'bold' },

  fowCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  fowTitle: { fontSize: 13, fontWeight: '800', color: '#1e293b', marginBottom: 8 },
  fowRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fowPill: {
    backgroundColor: '#f8fafc',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  fowPillScore: { color: '#ef4444', fontWeight: '800', fontSize: 12 },
  fowPillSub: { color: '#64748b', fontSize: 10.5 },

  actionBtn: {
    backgroundColor: '#d4af37',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 22,
    elevation: 3
  },
  actionBtnText: { color: '#0a1432', fontWeight: '900', fontSize: 14 },

  oversLogisticsCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  oversLogisticsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between'
  },
  oversLogisticsCol: {
    minWidth: 130,
    flex: 1
  },
  oversLogisticsLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 2
  },
  oversLogisticsValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a'
  },
  suspendedWarningBanner: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 6,
    padding: 8,
    marginTop: 10
  },
  suspendedWarningText: {
    color: '#9f1239',
    fontSize: 11,
    fontWeight: '700'
  },
  liveBowlerHeaderBadge: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  liveBowlerHeaderBadgeText: {
    color: '#15803d',
    fontSize: 10.5,
    fontWeight: '800'
  },
  bowlingBadge: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1.5
  },
  bowlingBadgeText: {
    color: '#15803d',
    fontSize: 9.5,
    fontWeight: '800'
  },
  suspendedPill: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    marginTop: 3
  },
  suspendedPillText: {
    color: '#b91c1c',
    fontSize: 9.5,
    fontWeight: '800'
  },
  subPill: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    marginTop: 3
  },
  subPillText: {
    color: '#b45309',
    fontSize: 9.5,
    fontWeight: '700'
  },
  // Rules & Quota styles
  freeHitScorecardBanner: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 8,
    marginTop: 8
  },
  freeHitScorecardBannerText: {
    color: '#b91c1c',
    fontSize: 11.5,
    fontWeight: '800'
  },
  rulesBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8
  },
  powerplayBadge: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  powerplayBadgeText: {
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: '700'
  },
  rulesGuideBtn: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  rulesGuideBtnText: {
    color: '#065f46',
    fontSize: 11,
    fontWeight: '800'
  },
  quotaPill: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    marginTop: 3
  },
  quotaPillText: {
    color: '#b45309',
    fontSize: 9.5,
    fontWeight: '800'
  },
  exitModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  exitModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 440,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8
  },
  exitModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  exitModalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.5
  },
  exitRedCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fca5a5'
  },
  exitRedCloseBtnText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '900'
  },
  exitModalBodyText: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
    marginVertical: 14
  },
  exitModalActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 4
  },
  exitCancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff'
  },
  exitCancelBtnText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700'
  },
  exitActionBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center'
  },
  exitActionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800'
  },
  exitScorerHeaderBtn: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#b91c1c'
  },
  exitScorerHeaderBtnText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '800'
  }
});

