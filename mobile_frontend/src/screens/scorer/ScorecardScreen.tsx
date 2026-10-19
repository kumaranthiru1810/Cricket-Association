import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, useWindowDimensions, Platform, Image } from 'react-native';

import { useScorerNavigation } from '../../navigation/ScorerNavigationContext';
import SharedFooter from '../../components/scorer/SharedFooter';
import { ScorerApi } from '../../services/api';
import WagonWheel from '../../components/analytics/WagonWheel';
import ErrorBoundary from '../../components/common/ErrorBoundary';

const IMG_CHAMPIONS = require('../../../assets/cricket_champions.png');

interface ScorecardScreenProps {
  onExit?: () => void;
  initialMatchId?: string;
  initialParams?: any;
}

export default function ScorecardScreen({ onExit, initialMatchId, initialParams }: ScorecardScreenProps = {}) {
  const scorerNav = useScorerNavigation();
  const matchId = initialMatchId || initialParams?.matchId || scorerNav.params?.matchId || 'M001';

  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const insetsTop = Platform.OS === 'android' ? 36 : Platform.OS === 'ios' ? 44 : 0;

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [scorecardData, setScorecardData] = useState<any>(null);
  const [activeInningsTab, setActiveInningsTab] = useState<number>(0);
  const [selectedWagonBatterId, setSelectedWagonBatterId] = useState<string>('');

  const handleBack = () => {
    if (onExit) {
      onExit();
    } else if (scorerNav?.navigate) {
      scorerNav.navigate('Dashboard');
    }
  };

  useEffect(() => {
    loadScorecard();
  }, [matchId]);

  const loadScorecard = async () => {
    try {
      setIsLoading(true);
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
      setIsLoading(false);
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

    const runRate = totalBalls > 0 ? ((totalRuns / totalBalls) * 6).toFixed(2) : '0.00';

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

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#eab308" />
        <Text style={{ marginTop: 12, color: '#64748b', fontWeight: '600' }}>Loading Scorecard from Database...</Text>
      </View>
    );
  }

  if (!scorecardData || !scorecardData.match) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 8 }}>Scorecard Not Found</Text>
        <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 20 }}>
          Unable to find scorecard records in the database for Match ID: {matchId}
        </Text>
        <TouchableOpacity style={styles.actionBtn} onPress={loadScorecard}>
          <Text style={styles.actionBtnText}>Retry Loading</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { marginTop: 12, backgroundColor: '#f1f5f9' }]} onPress={handleBack}>
          <Text style={[styles.actionBtnText, { color: '#475569' }]}>Back to Previous</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. RESPONSIVE HEADER WITH SAFE AREA INSETS */}
      <View style={[styles.header, { paddingTop: ((styles.header as any)?.paddingTop || 16) + insetsTop }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.8}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.badgeLive}>
            <Text style={styles.badgeLiveText}>
              {match.status || 'Match Scorecard'}
            </Text>
          </View>
        </View>
        <Text style={styles.title}>Match Scorecard & Statistics</Text>
        <Text style={styles.subtitle}>
          {match.tournament || 'Virudhunagar District Championship 2026'} • {match.venue || 'Kamarajar Stadium'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.contentWrapper}>
          {/* Match Result / Status Card */}
          {match.result && (() => {
            const summary = (match.result || '').trim();
            const isCompleted =
              match.status === 'Completed' ||
              match.status === 'COMPLETED' ||
              summary.includes(' won by ') ||
              summary.includes(' won the match') ||
              (summary.toLowerCase().includes('won') && !summary.toLowerCase().includes('toss'));

            if (!isCompleted) {
              return (
                <View style={[styles.championsCelebrationCard, { borderColor: '#3b82f6', backgroundColor: '#0b192c', marginBottom: 16 }]}>
                  <View style={[styles.championTopHeader, { backgroundColor: '#1e3a8a', borderBottomColor: 'rgba(59, 130, 246, 0.4)' }]}>
                    <View style={[styles.championPulsingDot, { backgroundColor: '#38bdf8' }]} />
                    <Text style={[styles.championTopHeaderText, { color: '#93c5fd' }]}>
                      ⚡ LIVE OFFICIAL MATCH SCORECARD ⚡
                    </Text>
                    <View style={[styles.championPulsingDot, { backgroundColor: '#38bdf8' }]} />
                  </View>
                  <View style={{ padding: 16, alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: '#ffffff', textAlign: 'center', marginBottom: 6 }}>
                      {match.teamA} vs {match.teamB}
                    </Text>
                    <View style={[styles.winMarginChip, { backgroundColor: '#1e3a8a', borderColor: '#60a5fa' }]}>
                      <Text style={styles.winMarginText}>Status: {summary || match.status || 'Match in progress'}</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                      🏏 {match.tournament || 'Virudhunagar District Cricket'} • {match.venue || 'CFVD Ground'}
                    </Text>
                  </View>
                </View>
              );
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
                      source={IMG_CHAMPIONS}
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
              <Text style={styles.heroBattingTeam}>{currentInnings.battingTeam}</Text>
              <Text style={styles.heroVersus}>vs {currentInnings.bowlingTeam || (match.teamA === currentInnings.battingTeam ? match.teamB : match.teamA)}</Text>
            </View>
            <View style={styles.heroRight}>
              <Text style={styles.heroScoreText}>{currentInnings.score}</Text>
              {inningsStats && (
                <Text style={styles.heroRunRateText}>Run Rate: {inningsStats.runRate} RPO</Text>
              )}
            </View>
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

          {/* ─────────────────────────────────────────────────────────────
              BATTING SCORECARD TABLE
              ───────────────────────────────────────────────────────────── */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>🏏 Batting Scorecard</Text>
            <Text style={styles.sectionHeaderSub}>Innings of {currentInnings.battingTeam}</Text>
          </View>

          <View style={styles.tableWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: '100%' }}>
              <View style={styles.tableInner}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.cell, styles.colName, styles.tableHeaderText]}>Batter</Text>
                  <Text style={[styles.cell, styles.colNum, styles.tableHeaderText]}>R</Text>
                  <Text style={[styles.cell, styles.colNum, styles.tableHeaderText]}>B</Text>
                  <Text style={[styles.cell, styles.colNum, styles.tableHeaderText]}>4s</Text>
                  <Text style={[styles.cell, styles.colNum, styles.tableHeaderText]}>6s</Text>
                  <Text style={[styles.cell, styles.colNum, styles.tableHeaderText]}>SR</Text>
                  <Text style={[styles.cell, styles.colAction, styles.tableHeaderText]}>Analytics</Text>
                </View>

                {(currentInnings.batters || []).map((b: any, bIdx: number) => (
                  <View key={b.id || bIdx} style={[styles.tableRow, bIdx % 2 === 1 && styles.tableRowAlt]}>
                    <View style={styles.colName}>
                      <Text style={styles.playerName}>{b.name}</Text>
                      <Text style={styles.dismissal}>{b.dismissal || (b.isOut ? 'out' : 'not out')}</Text>
                    </View>
                    <Text style={[styles.cell, styles.colNum, styles.runsText]}>{b.runs}</Text>
                    <Text style={[styles.cell, styles.colNum]}>{b.balls}</Text>
                    <Text style={[styles.cell, styles.colNum]}>{b.fours}</Text>
                    <Text style={[styles.cell, styles.colNum]}>{b.sixes}</Text>
                    <Text style={[styles.cell, styles.colNum, styles.srText]}>
                      {typeof b.strikeRate === 'number' ? b.strikeRate.toFixed(1) : b.strikeRate}
                    </Text>
                    <View style={styles.colAction}>
                      <TouchableOpacity
                        style={[
                          styles.wagonWheelBtn,
                          selectedWagonBatterId === b.id && styles.wagonWheelBtnActive
                        ]}
                        onPress={() => setSelectedWagonBatterId(b.id)}
                      >
                        <Text style={[
                          styles.wagonWheelBtnText,
                          selectedWagonBatterId === b.id && styles.wagonWheelBtnTextActive
                        ]}>
                          🎯 Wheel
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                {/* Extras Row */}
                <View style={styles.extrasRow}>
                  <Text style={styles.extrasText}>
                    Extras: {currentInnings.extras?.total || 0} ({currentInnings.extras?.breakdown || 'wides & no-balls'})
                  </Text>
                </View>
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
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>🎯 Bowling Figures</Text>
            <Text style={styles.sectionHeaderSub}>Attack by {currentInnings.bowlingTeam || 'Opponent'}</Text>
          </View>

          <View style={styles.tableWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: '100%' }}>
              <View style={styles.tableInner}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.cell, styles.colName, styles.tableHeaderText]}>Bowler</Text>
                  <Text style={[styles.cell, styles.colNum, styles.tableHeaderText]}>O</Text>
                  <Text style={[styles.cell, styles.colNum, styles.tableHeaderText]}>M</Text>
                  <Text style={[styles.cell, styles.colNum, styles.tableHeaderText]}>R</Text>
                  <Text style={[styles.cell, styles.colNum, styles.tableHeaderText]}>W</Text>
                  <Text style={[styles.cell, styles.colNum, styles.tableHeaderText]}>ECON</Text>
                </View>

                {(currentInnings.bowlers || []).map((bw: any, bwIdx: number) => (
                  <View key={bw.id || bwIdx} style={[styles.tableRow, bwIdx % 2 === 1 && styles.tableRowAlt]}>
                    <Text style={[styles.cell, styles.colName, styles.playerName]}>{bw.name}</Text>
                    <Text style={[styles.cell, styles.colNum]}>{bw.overs}</Text>
                    <Text style={[styles.cell, styles.colNum]}>{bw.maidens || 0}</Text>
                    <Text style={[styles.cell, styles.colNum]}>{bw.runs}</Text>
                    <Text style={[styles.cell, styles.colNum, styles.wicketsText]}>{bw.wickets}</Text>
                    <Text style={[styles.cell, styles.colNum, styles.econText]}>
                      {typeof bw.economy === 'number' ? bw.economy.toFixed(2) : bw.economy}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* FALL OF WICKETS */}
          {Array.isArray(currentInnings.fallOfWickets) && currentInnings.fallOfWickets.length > 0 && (
            <View style={styles.fowCard}>
              <Text style={styles.fowTitle}>Fall of Wickets</Text>
              <View style={styles.fowRow}>
                {currentInnings.fallOfWickets.map((f: any, idx: number) => {
                  let w = f?.wicket;
                  let s = f?.score;
                  let b = f?.batter;
                  let o = f?.over;

                  if (typeof f === 'string') {
                    // Match pattern "1-24 (Vijay Anand, 3.2 ov)" or "24/1 (Vijay Anand, 3.2 ov)"
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
                    } else {
                      return (
                        <View key={idx} style={styles.fowPill}>
                          <Text style={styles.fowPillScore}>{f}</Text>
                        </View>
                      );
                    }
                  }

                  return (
                    <View key={idx} style={styles.fowPill}>
                      <Text style={styles.fowPillScore}>{s || '0'}/{w || (idx + 1)}</Text>
                      <Text style={styles.fowPillSub}>({b || 'Batter'}, {o || '0.0'} ov)</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ACTION BUTTONS */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => (scorerNav?.navigate ? scorerNav.navigate('LiveScoring', { matchId }) : handleBack())}
          >
            <Text style={styles.actionBtnText}>
              {match.status === 'Live' || match.status === 'LIVE'
                ? '⚡ Back to Live Scoring Console'
                : '← Back to Match Portal'}
            </Text>
          </TouchableOpacity>
        </View>

        <SharedFooter />
      </ScrollView>
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

  // Scorecard Tables Styling
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  sectionHeaderTitle: { color: '#1e293b', fontSize: 15, fontWeight: '800' },
  sectionHeaderSub: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  tableWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    elevation: 1
  },
  tableInner: { minWidth: 480 },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center'
  },
  tableRowAlt: { backgroundColor: '#fafaf9' },
  tableHeader: {
    backgroundColor: '#fef3c7',
    borderBottomColor: '#fde68a',
    paddingVertical: 8
  },
  tableHeaderText: { color: '#92400e', fontWeight: '800' },
  cell: { color: '#334155', fontSize: 12.5, fontWeight: '600' },
  colName: { flex: 4, minWidth: 160 },
  colNum: { flex: 1.2, textAlign: 'center', minWidth: 36 },
  colAction: { flex: 2, alignItems: 'center', justifyContent: 'center', minWidth: 90 },
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
  playerName: { color: '#0f172a', fontWeight: 'bold', fontSize: 13.5 },
  dismissal: { color: '#b45309', fontSize: 11, fontStyle: 'italic', marginTop: 1 },
  runsText: { color: '#0f172a', fontWeight: '900', fontSize: 13.5 },
  srText: { color: '#2563eb', fontWeight: '700' },
  wicketsText: { color: '#15803d', fontWeight: '900', fontSize: 13.5 },
  econText: { color: '#475569', fontWeight: '700' },
  extrasRow: { padding: 10, backgroundColor: '#fffbeb', borderTopWidth: 1, borderTopColor: '#fef3c7' },
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
  actionBtnText: { color: '#0a1432', fontWeight: '900', fontSize: 14 }
});

