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

  // Toss state
  const [tossWinner, setTossWinner] = useState<string>('');
  const [tossDecision, setTossDecision] = useState<'BAT' | 'BOWL'>('BAT');
  const [matchOvers, setMatchOvers] = useState<string>('20');

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
        if (res.data.overs) {
          setMatchOvers(String(res.data.overs));
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
      }
    } catch (err: any) {
      console.warn('Failed to load match setup:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Attendance Actions
  const toggleAttendanceA = (pid: string) => {
    setAttendanceA(prev => ({ ...prev, [pid]: !prev[pid] }));
  };

  const toggleAttendanceB = (pid: string) => {
    setAttendanceB(prev => ({ ...prev, [pid]: !prev[pid] }));
  };

  const selectAllA = () => {
    const next: Record<string, boolean> = {};
    (setupData?.teamAPlayers || []).forEach((p: any) => { next[p.id] = true; });
    setAttendanceA(next);
  };

  const select11A = () => {
    const next: Record<string, boolean> = {};
    (setupData?.teamAPlayers || []).forEach((p: any, idx: number) => { next[p.id] = idx < 11; });
    setAttendanceA(next);
  };

  const clearA = () => {
    setAttendanceA({});
  };

  const selectAllB = () => {
    const next: Record<string, boolean> = {};
    (setupData?.teamBPlayers || []).forEach((p: any) => { next[p.id] = true; });
    setAttendanceB(next);
  };

  const select11B = () => {
    const next: Record<string, boolean> = {};
    (setupData?.teamBPlayers || []).forEach((p: any, idx: number) => { next[p.id] = idx < 11; });
    setAttendanceB(next);
  };

  const clearB = () => {
    setAttendanceB({});
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

    // Association Rule 15: At least 9 players must be present at the start of the match
    const presentA = (setupData?.teamAPlayers || []).filter((p: any) => attendanceA[p.id]);
    const presentB = (setupData?.teamBPlayers || []).filter((p: any) => attendanceB[p.id]);

    if (presentA.length < 9) {
      showWarning(
        'Rule 15: Minimum 9 Players Required',
        `Rule 15: A minimum of 9 players must be present at the start of each innings.\n\n${teamA.name} has only ${presentA.length} players marked present. Please mark attendance for at least 9 players before starting.`
      );
      return;
    }

    if (presentB.length < 9) {
      showWarning(
        'Rule 15: Minimum 9 Players Required',
        `Rule 15: A minimum of 9 players must be present at the start of each innings.\n\n${teamB.name} has only ${presentB.length} players marked present. Please mark attendance for at least 9 players before starting.`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        tossWinner,
        tossDecision,
        overs: parsedOvers,
        totalOvers: parsedOvers,
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
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#eab308" />
        <Text style={styles.loadingText}>Loading Match Information &amp; Squads...</Text>
      </View>
    );
  }

  const teamA = setupData?.teamA || { id: 'T001', name: 'Team A' };
  const teamB = setupData?.teamB || { id: 'T002', name: 'Team B' };
  const teamAPlayers = setupData?.teamAPlayers || [];
  const teamBPlayers = setupData?.teamBPlayers || [];

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
          
          {/* TWO-COLUMN GRID ON DESKTOP, STACKED ON MOBILE */}
          <View style={styles.mainGrid}>
            
            {/* LEFT COLUMN: Match Details, Toss Configuration, Officials, Start Button */}
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
                </View>
              </View>

              {/* CARD 2: TOSS CONFIGURATION */}
              <View style={[styles.card, styles.tossCard]}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardHeader}>Toss Configuration</Text>
                  <Text style={styles.stepBadge}>Step 1</Text>
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

                {/* OVERS PER SIDE CONFIGURATION (DEFAULT: 20 OVERS, EDITABLE BY SCORER) */}
                <View style={[styles.tossBlock, { marginTop: 4 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <Text style={styles.fieldLabel}>MATCH OVERS PER SIDE (DEFAULT: 20):</Text>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#0d9488' }}>
                      Format: {parseInt(matchOvers || '20', 10) <= 20 ? 'T20' : parseInt(matchOvers || '20', 10) <= 50 ? 'One Day' : 'Custom'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput
                      style={styles.oversInputBox}
                      value={matchOvers}
                      onChangeText={(val) => setMatchOvers(val.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      maxLength={3}
                      placeholder="20"
                      placeholderTextColor="#94a3b8"
                    />
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#334155' }}>Overs</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginLeft: 'auto' }}>
                      {[10, 15, 20].map((quickOv) => (
                        <TouchableOpacity
                          key={quickOv}
                          onPress={() => setMatchOvers(String(quickOv))}
                          style={[
                            styles.quickOverChip,
                            matchOvers === String(quickOv) && styles.quickOverChipActive
                          ]}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.quickOverChipText,
                            matchOvers === String(quickOv) && styles.quickOverChipTextActive
                          ]}>
                            {quickOv} Ov
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <Text style={{ fontSize: 10.5, color: '#64748b', marginTop: 4 }}>
                    Change 20 to 15, 10 or custom overs before starting. Match will begin with this overs limit.
                  </Text>
                </View>

                {tossWinnerName ? (
                  <View style={styles.tossSummary}>
                    <Text style={styles.tossSummaryText}>
                      🏆 <Text style={{ fontWeight: '700' }}>{tossWinnerName}</Text> won the toss and elected to <Text style={{ fontWeight: '700', textTransform: 'uppercase' }}>{tossDecision}</Text> first.
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* CARD 3: MATCH OFFICIALS */}
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

            {/* RIGHT COLUMN: Squads & Registered Roster with Interactive Attendance */}
            <View style={styles.rightCol}>
              <View style={[styles.card, styles.squadsCard]}>
                
                {/* Header */}
                <View style={styles.cardHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardHeader}>Match Squad Attendance &amp; Playing Squad</Text>
                    <Text style={styles.sectionHelp}>
                      Scorer Attendance Checklist • Tap players to mark Present (Min 9 players per team)
                    </Text>
                  </View>
                  <View style={styles.xiMainBadge}>
                    <Text style={styles.xiMainBadgeText}>
                      {teamAPlayers.filter((p: any) => attendanceA[p.id]).length} Present vs {teamBPlayers.filter((p: any) => attendanceB[p.id]).length} Present
                    </Text>
                  </View>
                </View>

                {/* ASSOCIATION RULE 15 ATTENDANCE BANNER */}
                <View style={styles.rule15Banner}>
                  <Text style={styles.rule15Icon}>📜</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rule15Title}>
                      Association Rule 15 • Match Attendance Requirement
                    </Text>
                    <Text style={styles.rule15Tamil}>
                      "Rule 15: A minimum of 9 players must be present at the start of each innings."
                    </Text>
                    <Text style={styles.rule15Sub}>
                      Official Scorer: Mark checkboxes for each attending player. At least 9 players must be marked Present per team before starting the match.
                    </Text>
                  </View>
                </View>

                {/* Mobile Tab Switcher */}
                {!isDesktop && (
                  <View style={styles.mobileTabsRow}>
                    <TouchableOpacity
                      style={[styles.mobileTabBtn, mobileSquadTab === 'TEAM_A' && styles.mobileTabBtnActive]}
                      onPress={() => setMobileSquadTab('TEAM_A')}
                    >
                      <Text style={[styles.mobileTabText, mobileSquadTab === 'TEAM_A' && styles.mobileTabTextActive]} numberOfLines={1}>
                        {teamA.name} ({teamAPlayers.filter((p: any) => attendanceA[p.id]).length}/{teamAPlayers.length})
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.mobileTabBtn, mobileSquadTab === 'TEAM_B' && styles.mobileTabBtnActive]}
                      onPress={() => setMobileSquadTab('TEAM_B')}
                    >
                      <Text style={[styles.mobileTabText, mobileSquadTab === 'TEAM_B' && styles.mobileTabTextActive]} numberOfLines={1}>
                        {teamB.name} ({teamBPlayers.filter((p: any) => attendanceB[p.id]).length}/{teamBPlayers.length})
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
                            {teamAPlayers.filter((p: any) => attendanceA[p.id]).length >= 9
                              ? `✅ ${teamAPlayers.filter((p: any) => attendanceA[p.id]).length} Present (Min 9 Met)`
                              : `⚠️ Only ${teamAPlayers.filter((p: any) => attendanceA[p.id]).length} Present (Rule 15: Need 9)`}
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
                      </View>
                    </View>
                  )}

                  {/* Team B Roster */}
                  {(isDesktop || mobileSquadTab === 'TEAM_B') && (
                    <View style={styles.squadColumn}>
                      <View style={[styles.teamColHeader, styles.teamColHeaderB]}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.teamColTitle} numberOfLines={1}>{teamB.name}</Text>
                          <Text style={styles.teamColSub}>
                            {teamBPlayers.filter((p: any) => attendanceB[p.id]).length >= 9
                              ? `✅ ${teamBPlayers.filter((p: any) => attendanceB[p.id]).length} Present (Min 9 Met)`
                              : `⚠️ Only ${teamBPlayers.filter((p: any) => attendanceB[p.id]).length} Present (Rule 15: Need 9)`}
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
                      </View>
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
