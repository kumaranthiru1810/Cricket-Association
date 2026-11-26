/**
 * src/admin/components/TournamentAdvancedTabs.tsx
 * Modular Admin UI Tabs for:
 * 1. Group Management (Balanced / Random / Seeded / Manual, Move Teams, Confirm, Qualification Rules)
 * 2. Bracket Visualization (Single Elimination, Double Elimination WB/LB/GF/GF-Reset, IPL Playoffs, Reverse Result)
 * 3. What-If Simulator, Team Withdrawal & Player Eligibility Check
 * Preserves CFVD Yellow (#f59e0b) / Navy (#0f172a) / Cream (#fcf9f4) theme.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { adminApi } from '../services/adminApi';
import { showSuccess, showError } from '../../utils/sweetalert';

interface TournamentAdvancedTabsProps {
  tournament: any;
  activeTab: 'groups' | 'bracket' | 'simulator';
  onRefresh: () => void;
}

export const TournamentAdvancedTabs: React.FC<TournamentAdvancedTabsProps> = ({
  tournament,
  activeTab,
  onRefresh
}) => {
  const tid = tournament?.id;
  const teams = tournament?.participating_teams || [];
  const teamNameMap: Record<string, string> = {};
  teams.forEach((t: any) => {
    const id = t.id || t.team_id;
    if (id) teamNameMap[id] = t.name || t.team_name || id;
  });

  // ── Groups State ────────────────────────────────────────────────────────
  const [numGroups, setNumGroups] = useState(String((tournament?.groups || []).length || 2));
  const [allocMode, setAllocMode] = useState<'BALANCED' | 'RANDOM' | 'SEEDED' | 'MANUAL'>(
    tournament?.group_allocation_mode || 'BALANCED'
  );
  const [groups, setGroups] = useState<any[]>(tournament?.groups || []);
  const [groupsConfirmed, setGroupsConfirmed] = useState<boolean>(Boolean(tournament?.groups_confirmed));
  const [topN, setTopN] = useState(String(tournament?.format_config?.top_n_per_group || 2));
  const [bestThird, setBestThird] = useState(String(tournament?.format_config?.best_third_place_count || 0));
  const [busy, setBusy] = useState(false);

  // ── Bracket State ───────────────────────────────────────────────────────
  const [bracketData, setBracketData] = useState<any>(null);
  const [bracketLoading, setBracketLoading] = useState(false);

  // ── Simulator / Withdrawal / Eligibility State ──────────────────────────
  const [simSelections, setSimSelections] = useState<Record<string, string>>({});
  const [simResult, setSimResult] = useState<any>(null);
  const [wdTeamId, setWdTeamId] = useState<string>(teams[0]?.id || '');
  const [wdRule, setWdRule] = useState<'REMAINING_WALKOVER' | 'CANCEL_REMAINING'>('REMAINING_WALKOVER');
  const [wdReason, setWdReason] = useState('Unable to participate');
  const [eligTeamId, setEligTeamId] = useState<string>(teams[0]?.id || '');
  const [eligResult, setEligResult] = useState<any>(null);

  useEffect(() => {
    setGroups(tournament?.groups || []);
    setGroupsConfirmed(Boolean(tournament?.groups_confirmed));
  }, [tournament]);

  useEffect(() => {
    if (activeTab === 'bracket' && tid) {
      loadBracket();
    }
  }, [activeTab, tid]);

  const loadBracket = async () => {
    if (!tid) return;
    setBracketLoading(true);
    try {
      const res = await adminApi.getTournamentBracket(tid);
      if (res?.success) setBracketData(res);
    } catch (e: any) {
      showError(e.message || 'Failed to load bracket');
    } finally {
      setBracketLoading(false);
    }
  };

  // ── Group Handlers ──────────────────────────────────────────────────────
  const handleAllocateGroups = async () => {
    setBusy(true);
    try {
      const res = await adminApi.allocateTournamentGroups(tid, {
        numGroups: parseInt(numGroups, 10) || 2,
        mode: allocMode
      });
      if (res?.success) {
        setGroups(res.groups || []);
        setGroupsConfirmed(Boolean(res.groups_confirmed));
        showSuccess(`Allocated teams into ${res.groups?.length || 0} groups (${allocMode}).`);
        onRefresh();
      }
    } catch (e: any) {
      showError(e.message || 'Group allocation failed');
    } finally {
      setBusy(false);
    }
  };

  const handleMoveTeam = async (teamId: string, fromGroupId: string, toGroupId: string) => {
    if (!toGroupId || fromGroupId === toGroupId) return;
    setBusy(true);
    try {
      const res = await adminApi.moveTeamBetweenGroups(tid, { teamId, fromGroupId, toGroupId });
      if (res?.success) {
        setGroups(res.groups || []);
        setGroupsConfirmed(false);
        showSuccess(`Moved ${teamNameMap[teamId] || teamId}`);
        onRefresh();
      }
    } catch (e: any) {
      showError(e.message || 'Failed to move team');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmGroups = async () => {
    setBusy(true);
    try {
      const res = await adminApi.confirmTournamentGroups(tid);
      if (res?.success) {
        setGroupsConfirmed(true);
        showSuccess('Group allocation confirmed!');
        onRefresh();
      }
    } catch (e: any) {
      showError(e.message || 'Failed to confirm groups');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveQualification = async () => {
    setBusy(true);
    try {
      await adminApi.updateQualificationConfig(tid, {
        top_n_per_group: parseInt(topN, 10) || 2,
        best_third_place_count: parseInt(bestThird, 10) || 0
      });
      showSuccess('Qualification rules saved.');
      onRefresh();
    } catch (e: any) {
      showError(e.message || 'Failed to save qualification rules');
    } finally {
      setBusy(false);
    }
  };

  // ── Bracket Handlers ────────────────────────────────────────────────────
  const handleGenerateNextStage = async () => {
    setBusy(true);
    try {
      const res = await adminApi.generateNextStage(tid);
      if (res?.success) {
        showSuccess(`Generated next-stage fixtures (${res.fixtures?.length || 0} matches).`);
        await loadBracket();
        onRefresh();
      }
    } catch (e: any) {
      showError(e.message || 'Failed to generate next stage');
    } finally {
      setBusy(false);
    }
  };

  const handleReverseResult = async (matchId: string) => {
    setBusy(true);
    try {
      await adminApi.reverseMatchResult(matchId, { reopenMatch: true });
      showSuccess(`Match ${matchId} result reversed and reopened.`);
      await loadBracket();
      onRefresh();
    } catch (e: any) {
      showError(e.message || 'Cannot reverse result');
    } finally {
      setBusy(false);
    }
  };

  // ── Simulator / Withdrawal / Eligibility Handlers ───────────────────────
  const handleRunSimulation = async () => {
    setBusy(true);
    try {
      const payload = Object.entries(simSelections)
        .filter(([, winnerId]) => Boolean(winnerId))
        .map(([match_id, winner_id]) => ({ match_id, winner_id }));
      const res = await adminApi.simulateTournamentWhatIf(tid, payload);
      setSimResult(res);
    } catch (e: any) {
      showError(e.message || 'Simulation failed');
    } finally {
      setBusy(false);
    }
  };

  const handleWithdrawTeam = async () => {
    if (!wdTeamId) return;
    setBusy(true);
    try {
      const res = await adminApi.withdrawTournamentTeam(tid, { teamId: wdTeamId, rule: wdRule, reason: wdReason });
      showSuccess(`Team withdrawn (${res.affected_matches} scheduled matches updated).`);
      onRefresh();
    } catch (e: any) {
      showError(e.message || 'Withdrawal failed');
    } finally {
      setBusy(false);
    }
  };

  const handleCheckEligibility = async () => {
    if (!eligTeamId) return;
    setBusy(true);
    try {
      const res = await adminApi.checkPlayerEligibility(tid, { teamId: eligTeamId });
      setEligResult(res);
    } catch (e: any) {
      showError(e.message || 'Eligibility check failed');
    } finally {
      setBusy(false);
    }
  };

  const renderSlotCard = (slot: any, matchLookup: Record<string, any>) => {
    const m = matchLookup[slot.match_id];
    const teamA = slot.team_a_id ? (teamNameMap[slot.team_a_id] || m?.team_a_name || slot.team_a_id) : 'TBD';
    const teamB = slot.team_b_id ? (teamNameMap[slot.team_b_id] || m?.team_b_name || slot.team_b_id) : (slot.is_bye ? 'BYE' : 'TBD');
    const isCompleted = m?.status === 'COMPLETED' || Boolean(slot.winner_id);
    return (
      <View key={slot.slot_id} style={[s.slotCard, slot.is_bye && s.slotCardBye, isCompleted && s.slotCardDone]}>
        <View style={s.slotHeader}>
          <Text style={s.slotId}>{slot.slot_id}</Text>
          <Text style={s.slotStatus}>{slot.is_bye ? 'BYE' : (m?.status || (slot.conditional && !slot.active ? 'IF NEEDED' : 'PENDING'))}</Text>
        </View>
        <Text style={[s.slotTeam, slot.winner_id && slot.winner_id === slot.team_a_id && s.slotWinner]}>{teamA}</Text>
        <Text style={s.slotVs}>vs</Text>
        <Text style={[s.slotTeam, slot.winner_id && slot.winner_id === slot.team_b_id && s.slotWinner]}>{teamB}</Text>
        {m?.status === 'COMPLETED' && (
          <TouchableOpacity style={s.reverseBtn} onPress={() => handleReverseResult(m.id)}>
            <Text style={s.reverseBtnText}>↺ Reverse Result</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (activeTab === 'groups') {
    const assignedIds = new Set(groups.flatMap((g: any) => g.teams || []));
    const unassigned = teams.filter((t: any) => !assignedIds.has(t.id || t.team_id));

    return (
      <View style={{ gap: 16 }}>
        <View style={s.card}>
          <Text style={s.cardTitle}>🗂️ Group Allocation & Configuration</Text>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Number of Groups</Text>
              <TextInput style={s.input} value={numGroups} onChangeText={setNumGroups} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Allocation Mode</Text>
              <View style={s.pillRow}>
                {(['BALANCED', 'RANDOM', 'SEEDED', 'MANUAL'] as const).map(m => (
                  <TouchableOpacity key={m} style={[s.pill, allocMode === m && s.pillActive]} onPress={() => setAllocMode(m)}>
                    <Text style={[s.pillText, allocMode === m && s.pillTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
          <View style={s.btnRow}>
            <TouchableOpacity style={s.primaryBtn} onPress={handleAllocateGroups} disabled={busy}>
              <Text style={s.primaryBtnText}>{busy ? 'Working...' : '⚡ Allocate / Preview Groups'}</Text>
            </TouchableOpacity>
            {groups.length > 0 && !groupsConfirmed && (
              <TouchableOpacity style={s.confirmBtn} onPress={handleConfirmGroups} disabled={busy}>
                <Text style={s.confirmBtnText}>✓ Confirm Groups</Text>
              </TouchableOpacity>
            )}
            {groupsConfirmed && (
              <View style={s.confirmedBadge}><Text style={s.confirmedBadgeText}>✓ Groups Confirmed</Text></View>
            )}
          </View>
        </View>

        {unassigned.length > 0 && (
          <View style={s.warnBox}>
            <Text style={s.warnText}>Unassigned Teams ({unassigned.length}): {unassigned.map((u: any) => u.name || u.id).join(', ')}</Text>
          </View>
        )}

        <View style={s.groupsGrid}>
          {groups.map((g: any) => (
            <View key={g.id} style={s.groupCard}>
              <Text style={s.groupTitle}>{g.name} ({(g.teams || []).length} teams)</Text>
              {(g.teams || []).map((tidItem: string) => (
                <View key={tidItem} style={s.groupTeamRow}>
                  <Text style={s.groupTeamName}>{teamNameMap[tidItem] || tidItem}</Text>
                  {groups.length > 1 && (
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      {groups.filter((og: any) => og.id !== g.id).slice(0, 3).map((og: any) => (
                        <TouchableOpacity key={og.id} style={s.moveChip} onPress={() => handleMoveTeam(tidItem, g.id, og.id)}>
                          <Text style={s.moveChipText}>→ {og.name.replace('Group ', '')}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>🎯 Qualification Rules</Text>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Top N Teams Per Group</Text>
              <TextInput style={s.input} value={topN} onChangeText={setTopN} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Best 3rd-Place Qualifiers</Text>
              <TextInput style={s.input} value={bestThird} onChangeText={setBestThird} keyboardType="numeric" />
            </View>
          </View>
          <TouchableOpacity style={s.primaryBtn} onPress={handleSaveQualification} disabled={busy}>
            <Text style={s.primaryBtnText}>Save Qualification Rules</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (activeTab === 'bracket') {
    if (bracketLoading) return <ActivityIndicator size="large" color="#f59e0b" style={{ marginTop: 30 }} />;
    const b = bracketData?.bracket;
    const matchLookup: Record<string, any> = {};
    (bracketData?.matches || []).forEach((m: any) => { matchLookup[m.id] = m; });

    return (
      <View style={{ gap: 16 }}>
        {bracketData?.champion_team_id && (
          <View style={s.championBanner}>
            <Text style={s.championTitle}>🏆 TOURNAMENT CHAMPION: {bracketData.champion_team_name || bracketData.champion_team_id}</Text>
            {bracketData.runner_up_team_id && (
              <Text style={s.championSub}>🥈 Runner-Up: {bracketData.runner_up_team_name || bracketData.runner_up_team_id}</Text>
            )}
          </View>
        )}

        <View style={s.btnRow}>
          <TouchableOpacity style={s.primaryBtn} onPress={handleGenerateNextStage} disabled={busy}>
            <Text style={s.primaryBtnText}>🚀 Generate Knockout / Playoffs from Standings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.secondaryBtn} onPress={loadBracket}>
            <Text style={s.secondaryBtnText}>↻ Refresh Bracket</Text>
          </TouchableOpacity>
        </View>

        {!b ? (
          <View style={s.card}>
            <Text style={s.emptyText}>No elimination bracket generated yet. Generate matches for a Knockout, Double Elimination, or Group/League Playoff tournament.</Text>
          </View>
        ) : b.format === 'DOUBLE_ELIMINATION' ? (
          <View style={{ gap: 16 }}>
            <Text style={s.sectionHeader}>🏆 Winners Bracket</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={s.bracketRow}>
                {(b.winners_rounds || []).map((rd: any) => (
                  <View key={rd.round_number} style={s.roundCol}>
                    <Text style={s.roundTitle}>{rd.name}</Text>
                    {(rd.slots || []).map((slot: any) => renderSlotCard(slot, matchLookup))}
                  </View>
                ))}
              </View>
            </ScrollView>

            <Text style={s.sectionHeader}>⚔️ Losers Bracket</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={s.bracketRow}>
                {(b.losers_rounds || []).map((rd: any) => (
                  <View key={rd.round_number} style={s.roundCol}>
                    <Text style={s.roundTitle}>{rd.name}</Text>
                    {(rd.slots || []).map((slot: any) => renderSlotCard(slot, matchLookup))}
                  </View>
                ))}
              </View>
            </ScrollView>

            <Text style={s.sectionHeader}>👑 Grand Final & Reset</Text>
            <View style={s.bracketRow}>
              {b.grand_final && renderSlotCard(b.grand_final, matchLookup)}
              {b.grand_final_reset && renderSlotCard(b.grand_final_reset, matchLookup)}
            </View>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={s.bracketRow}>
              {(b.rounds || []).map((rd: any) => (
                <View key={rd.round_number} style={s.roundCol}>
                  <Text style={s.roundTitle}>{rd.name}</Text>
                  {(rd.slots || []).map((slot: any) => renderSlotCard(slot, matchLookup))}
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    );
  }

  // TAB: simulator (What-If + Withdrawal + Eligibility)
  const scheduledMatches = (tournament?.matches || []).filter((m: any) => m.status === 'SCHEDULED' || m.status === 'POSTPONED');
  return (
    <View style={{ gap: 16 }}>
      <View style={s.card}>
        <Text style={s.cardTitle}>🔮 What-If Standings Simulator (Read-Only)</Text>
        <Text style={s.subText}>Select hypothetical winners for remaining matches to project standings & qualification without modifying database records.</Text>
        {scheduledMatches.slice(0, 8).map((m: any) => (
          <View key={m.id} style={s.simRow}>
            <Text style={s.simMatchLabel}>{m.team_a_name || m.team_a_id} vs {m.team_b_name || m.team_b_id}</Text>
            <View style={s.pillRow}>
              <TouchableOpacity
                style={[s.pill, simSelections[m.id] === m.team_a_id && s.pillActive]}
                onPress={() => setSimSelections(prev => ({ ...prev, [m.id]: m.team_a_id }))}
              >
                <Text style={[s.pillText, simSelections[m.id] === m.team_a_id && s.pillTextActive]}>{m.team_a_name || m.team_a_id}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.pill, simSelections[m.id] === m.team_b_id && s.pillActive]}
                onPress={() => setSimSelections(prev => ({ ...prev, [m.id]: m.team_b_id }))}
              >
                <Text style={[s.pillText, simSelections[m.id] === m.team_b_id && s.pillTextActive]}>{m.team_b_name || m.team_b_id}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <TouchableOpacity style={s.primaryBtn} onPress={handleRunSimulation} disabled={busy}>
          <Text style={s.primaryBtnText}>Run What-If Simulation</Text>
        </TouchableOpacity>

        {simResult && (
          <View style={s.simResultsBox}>
            <Text style={s.simBadge}>SIMULATED STANDINGS (NOT SAVED TO DB)</Text>
            {(simResult.projected_standings || []).map((r: any) => (
              <View key={r.team_id} style={s.simTableRow}>
                <Text style={s.simPos}>#{r.position}</Text>
                <Text style={s.simTeam}>{r.team_name}</Text>
                <Text style={s.simPts}>{r.points} pts (NRR {r.nrr_formatted})</Text>
                <Text style={s.simStatus}>{r.qualification_status}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>🛡️ Player Eligibility Validation</Text>
        <View style={s.pillRow}>
          {teams.slice(0, 8).map((t: any) => {
            const id = t.id || t.team_id;
            return (
              <TouchableOpacity key={id} style={[s.pill, eligTeamId === id && s.pillActive]} onPress={() => setEligTeamId(id)}>
                <Text style={[s.pillText, eligTeamId === id && s.pillTextActive]}>{t.name || id}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity style={s.primaryBtn} onPress={handleCheckEligibility} disabled={busy}>
          <Text style={s.primaryBtnText}>Check Team Squad Eligibility</Text>
        </TouchableOpacity>
        {eligResult && (
          <View style={[s.warnBox, { backgroundColor: eligResult.eligible ? '#dcfce7' : '#fee2e2', borderColor: eligResult.eligible ? '#16a34a' : '#dc2626' }]}>
            <Text style={{ fontWeight: '700', color: '#0f172a' }}>
              {eligResult.eligible ? `✅ Eligible (${eligResult.checked_players_count} players verified)` : `❌ Ineligible: ${(eligResult.errors || []).join(' | ')}`}
            </Text>
          </View>
        )}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>⚠️ Team Withdrawal Handling</Text>
        <View style={s.pillRow}>
          {teams.slice(0, 8).map((t: any) => {
            const id = t.id || t.team_id;
            return (
              <TouchableOpacity key={id} style={[s.pill, wdTeamId === id && s.pillActive]} onPress={() => setWdTeamId(id)}>
                <Text style={[s.pillText, wdTeamId === id && s.pillTextActive]}>{t.name || id}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={s.pillRow}>
          <TouchableOpacity style={[s.pill, wdRule === 'REMAINING_WALKOVER' && s.pillActive]} onPress={() => setWdRule('REMAINING_WALKOVER')}>
            <Text style={[s.pillText, wdRule === 'REMAINING_WALKOVER' && s.pillTextActive]}>Award Walkover</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.pill, wdRule === 'CANCEL_REMAINING' && s.pillActive]} onPress={() => setWdRule('CANCEL_REMAINING')}>
            <Text style={[s.pillText, wdRule === 'CANCEL_REMAINING' && s.pillTextActive]}>Cancel Remaining</Text>
          </TouchableOpacity>
        </View>
        <TextInput style={s.input} value={wdReason} onChangeText={setWdReason} placeholder="Withdrawal reason..." />
        <TouchableOpacity style={[s.primaryBtn, { backgroundColor: '#dc2626' }]} onPress={handleWithdrawTeam} disabled={busy}>
          <Text style={[s.primaryBtnText, { color: '#fff' }]}>Process Team Withdrawal</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  subText: { fontSize: 12, color: '#64748b' },
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 13, backgroundColor: '#f8fafc', color: '#0f172a' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc' },
  pillActive: { backgroundColor: '#f59e0b', borderColor: '#d97706' },
  pillText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  pillTextActive: { color: '#0f172a' },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  primaryBtn: { backgroundColor: '#f59e0b', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, alignSelf: 'flex-start' },
  primaryBtnText: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  secondaryBtn: { backgroundColor: '#0f172a', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  secondaryBtnText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  confirmBtn: { backgroundColor: '#16a34a', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  confirmBtnText: { fontSize: 13, fontWeight: '800', color: '#ffffff' },
  confirmedBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  confirmedBadgeText: { fontSize: 12, fontWeight: '800', color: '#166534' },
  warnBox: { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#f59e0b', borderRadius: 8, padding: 10 },
  warnText: { fontSize: 12, fontWeight: '700', color: '#92400e' },
  groupsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  groupCard: { flex: 1, minWidth: 240, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fcd34d', borderRadius: 10, padding: 12, gap: 6 },
  groupTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  groupTeamRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#fde68a' },
  groupTeamName: { fontSize: 12, fontWeight: '600', color: '#1e293b' },
  moveChip: { backgroundColor: '#0f172a', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  moveChipText: { fontSize: 10, fontWeight: '700', color: '#facc15' },
  championBanner: { backgroundColor: '#0f172a', borderRadius: 12, padding: 16, borderWidth: 2, borderColor: '#f59e0b' },
  championTitle: { fontSize: 16, fontWeight: '900', color: '#facc15' },
  championSub: { fontSize: 13, fontWeight: '700', color: '#e2e8f0', marginTop: 4 },
  sectionHeader: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  bracketRow: { flexDirection: 'row', gap: 16, paddingBottom: 8 },
  roundCol: { width: 210, gap: 10 },
  roundTitle: { fontSize: 12, fontWeight: '800', color: '#475569', textTransform: 'uppercase' },
  slotCard: { backgroundColor: '#ffffff', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#cbd5e1', gap: 3 },
  slotCardBye: { backgroundColor: '#f8fafc', borderStyle: 'dashed' },
  slotCardDone: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  slotHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  slotId: { fontSize: 10, fontWeight: '800', color: '#64748b' },
  slotStatus: { fontSize: 10, fontWeight: '700', color: '#d97706' },
  slotTeam: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  slotWinner: { color: '#15803d', fontWeight: '900' },
  slotVs: { fontSize: 10, color: '#94a3b8' },
  reverseBtn: { marginTop: 4, backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-start' },
  reverseBtnText: { fontSize: 10, fontWeight: '700', color: '#b91c1c' },
  emptyText: { fontSize: 13, color: '#64748b' },
  simRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexWrap: 'wrap', gap: 8 },
  simMatchLabel: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  simResultsBox: { marginTop: 10, backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', gap: 6 },
  simBadge: { fontSize: 11, fontWeight: '900', color: '#b45309', marginBottom: 4 },
  simTableRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  simPos: { width: 30, fontSize: 12, fontWeight: '800', color: '#0f172a' },
  simTeam: { flex: 1, fontSize: 12, fontWeight: '700', color: '#0f172a' },
  simPts: { fontSize: 12, fontWeight: '600', color: '#334155', marginRight: 8 },
  simStatus: { fontSize: 10, fontWeight: '800', color: '#0369a1' }
});

export default TournamentAdvancedTabs;
