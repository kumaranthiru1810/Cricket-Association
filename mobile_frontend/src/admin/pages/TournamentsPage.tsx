/**
 * src/admin/pages/TournamentsPage.tsx
 * Tournaments Management Page for Cricket Association Professional Admin Panel.
 * Supports viewing district tournaments, creating new leagues, updating dates/status,
 * and checking participation formats.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, useWindowDimensions } from 'react-native';
import PageHeader from '../components/PageHeader';
import DataTable, { ColumnDef } from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import { TournamentsIcon, PlusIcon, EditIcon, EyeIcon, CloseIcon } from '../components/Icons';
import { adminApi } from '../services/adminApi';
import { useAdminLayout } from '../components/AdminLayout';

export const TournamentsPage: React.FC = () => {
  const { showToast } = useAdminLayout();
  const { width } = useWindowDimensions();
  const isMobile = width < 640;
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [activeTournament, setActiveTournament] = useState<any | null>(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formShortName, setFormShortName] = useState('');
  const [formSeason, setFormSeason] = useState('2026');
  const [formFormat, setFormFormat] = useState('T20');
  const [formOvers, setFormOvers] = useState('20');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formStatus, setFormStatus] = useState('ACTIVE');

  // Dynamic Tournament Playing Rules & Points (Rules 5, 8, 14, 17, 18)
  const [formPowerplayOvers, setFormPowerplayOvers] = useState('5');
  const [formMaxOutsidePP, setFormMaxOutsidePP] = useState('2');
  const [formMaxOutsidePostPP, setFormMaxOutsidePostPP] = useState('5');
  const [formMaxOnSide, setFormMaxOnSide] = useState('5');
  const [formMaxBehindCrease, setFormMaxBehindCrease] = useState('2');
  const [formFreeHitAllNoBalls, setFormFreeHitAllNoBalls] = useState(true);
  const [formDelayPenaltyEnabled, setFormDelayPenaltyEnabled] = useState(true);
  const [formDelayIntervalValue, setFormDelayIntervalValue] = useState('4');
  const [formDelayIntervalUnit, setFormDelayIntervalUnit] = useState<'MINUTES' | 'SECONDS'>('MINUTES');
  const [formDelayOversReduced, setFormDelayOversReduced] = useState('1');
  const [formTieHandling, setFormTieHandling] = useState<'SHARE_POINTS' | 'SUPER_OVER'>('SHARE_POINTS');
  const [formPointsWin, setFormPointsWin] = useState('4');
  const [formPointsLoss, setFormPointsLoss] = useState('0');
  const [formPointsTie, setFormPointsTie] = useState('2');
  const [formPointsBonusWin, setFormPointsBonusWin] = useState('1');
  const [formPointsBonusLoss, setFormPointsBonusLoss] = useState('-1');
  const [formPointsWalkoverWin, setFormPointsWalkoverWin] = useState('4');
  const [formPointsWalkoverLoss, setFormPointsWalkoverLoss] = useState('-1');

  // Dynamic Competition Format & Multi-Stage Structure
  const [formTournamentType, setFormTournamentType] = useState<'LEAGUE' | 'KNOCKOUT' | 'LEAGUE_KNOCKOUT' | 'GROUP_SUPER_LEAGUE'>('GROUP_SUPER_LEAGUE');
  const [formGroupCount, setFormGroupCount] = useState('5');
  const [formAllowExtraGroup, setFormAllowExtraGroup] = useState(true);
  const [formTeamsPerGroup, setFormTeamsPerGroup] = useState('8');
  const [formQualifiersPerGroup, setFormQualifiersPerGroup] = useState('2');
  const [formSuperLeagueEnabled, setFormSuperLeagueEnabled] = useState(true);
  const [formSuperLeagueGroups, setFormSuperLeagueGroups] = useState('4');
  const [formSuperLeagueQualifiers, setFormSuperLeagueQualifiers] = useState('1');
  const [formIncludeSemis, setFormIncludeSemis] = useState(true);
  const [formIncludeFinal, setFormIncludeFinal] = useState(true);

  const loadTournaments = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getTournaments();
      if (res && res.success) {
        setTournaments(res.tournaments || []);
      }
    } catch (e: any) {
      showToast(`Failed to load tournaments: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTournaments();
  }, []);

  const applyStandardRulePreset = () => {
    setFormPowerplayOvers('5');
    setFormMaxOutsidePP('2');
    setFormMaxOutsidePostPP('5');
    setFormMaxOnSide('5');
    setFormMaxBehindCrease('2');
    setFormFreeHitAllNoBalls(true);
    setFormDelayPenaltyEnabled(true);
    setFormDelayIntervalValue('4');
    setFormDelayIntervalUnit('MINUTES');
    setFormDelayOversReduced('1');
    setFormTieHandling('SHARE_POINTS');
    setFormPointsWin('4');
    setFormPointsLoss('0');
    setFormPointsTie('2');
    setFormPointsBonusWin('1');
    setFormPointsBonusLoss('-1');
    setFormPointsWalkoverWin('4');
    setFormPointsWalkoverLoss('-1');
    setFormTournamentType('GROUP_SUPER_LEAGUE');
    setFormGroupCount('5');
    setFormAllowExtraGroup(true);
    setFormTeamsPerGroup('8');
    setFormQualifiersPerGroup('2');
    setFormSuperLeagueEnabled(true);
    setFormSuperLeagueGroups('4');
    setFormSuperLeagueQualifiers('1');
    setFormIncludeSemis(true);
    setFormIncludeFinal(true);
  };

  const handleOpenAdd = () => {
    setActiveTournament(null);
    setFormName('');
    setFormShortName('');
    setFormSeason('2026');
    setFormFormat('T20');
    setFormOvers('20');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormEndDate('');
    setFormStatus('ACTIVE');
    applyStandardRulePreset();
    setIsAddMode(true);
    setIsEditMode(false);
  };

  const handleOpenEdit = (t: any) => {
    setActiveTournament(t);
    setFormName(t.name || '');
    setFormShortName(t.short_name || '');
    setFormSeason(t.season || '2026');
    setFormFormat(t.format || 'T20');
    setFormOvers(String(t.overs_per_match || t.overs || 20));
    setFormStartDate(t.start_date ? t.start_date.split('T')[0] : '');
    setFormEndDate(t.end_date ? t.end_date.split('T')[0] : '');
    setFormStatus(t.status || 'ACTIVE');

    const pr = t.playing_rules || {};
    setFormPowerplayOvers(String(pr.powerplay_overs ?? 5));
    setFormMaxOutsidePP(String(pr.max_outside_powerplay ?? 2));
    setFormMaxOutsidePostPP(String(pr.max_outside_post_powerplay ?? 5));
    setFormMaxOnSide(String(pr.max_on_side_fielders ?? 5));
    setFormMaxBehindCrease(String(pr.max_on_side_behind_crease ?? 2));
    setFormFreeHitAllNoBalls(pr.free_hit_on_all_noballs !== false);
    setFormDelayPenaltyEnabled(pr.delay_penalty_enabled !== false);
    setFormDelayIntervalValue(String(pr.delay_interval_value ?? 4));
    setFormDelayIntervalUnit(pr.delay_interval_unit === 'SECONDS' ? 'SECONDS' : 'MINUTES');
    setFormDelayOversReduced(String(pr.delay_overs_reduced_per_interval ?? 1));
    setFormTieHandling(pr.tie_handling === 'SUPER_OVER' ? 'SUPER_OVER' : 'SHARE_POINTS');
    setFormPointsWin(String(t.points_win ?? 4));
    setFormPointsLoss(String(t.points_loss ?? 0));
    setFormPointsTie(String(t.points_tie ?? 2));
    setFormPointsBonusWin(String(t.points_bonus_win ?? 1));
    setFormPointsBonusLoss(String(t.points_bonus_loss ?? -1));
    setFormPointsWalkoverWin(String(t.points_walkover_win ?? 4));
    setFormPointsWalkoverLoss(String(t.points_walkover_loss ?? -1));

    const fc = t.format_config || {};
    setFormTournamentType(t.tournament_type || 'LEAGUE');
    setFormGroupCount(String(fc.group_count ?? 5));
    setFormAllowExtraGroup(fc.allow_extra_group !== false);
    setFormTeamsPerGroup(String(fc.teams_per_group ?? 8));
    setFormQualifiersPerGroup(String(fc.qualifiers_per_group ?? 2));
    setFormSuperLeagueEnabled(fc.super_league_enabled !== false);
    setFormSuperLeagueGroups(String(fc.super_league_groups ?? 4));
    setFormSuperLeagueQualifiers(String(fc.super_league_qualifiers_per_group ?? 1));
    setFormIncludeSemis(fc.include_semifinals !== false);
    setFormIncludeFinal(fc.include_final !== false);

    setIsEditMode(true);
    setIsAddMode(false);
  };

  const handleSaveTournament = async () => {
    if (!formName.trim()) {
      showToast('Tournament name is required.', 'error');
      return;
    }
    if (!/^[a-zA-Z0-9_\s]+$/.test(formName.trim())) {
      showToast('Tournament Name can only contain letters, numbers, spaces, and underscores (_). Special characters are not allowed.', 'error');
      return;
    }

    const rulesPayload = {
      tournament_type: formTournamentType,
      overs_per_match: parseInt(formOvers, 10) || 20,
      max_teams: Math.max(2, (parseInt(formGroupCount, 10) || 5) * (parseInt(formTeamsPerGroup, 10) || 8) + (formAllowExtraGroup ? 8 : 0)),
      format_config: {
        round_robin_type: 'SINGLE',
        knockout_stages: [
          ...(formIncludeSemis ? ['Semi Final'] : []),
          ...(formIncludeFinal ? ['Final'] : [])
        ],
        qualifying_teams_count: formSuperLeagueEnabled
          ? (parseInt(formSuperLeagueGroups, 10) || 4) * (parseInt(formSuperLeagueQualifiers, 10) || 1)
          : (parseInt(formGroupCount, 10) || 5) * (parseInt(formQualifiersPerGroup, 10) || 2),
        qualification_rules: `${formGroupCount} Groups (${formTeamsPerGroup}/group) -> Top ${formQualifiersPerGroup}/group -> ${formSuperLeagueEnabled ? `${formSuperLeagueGroups} Super League Groups -> Top ${formSuperLeagueQualifiers}/group -> ` : ''}${formIncludeSemis ? 'Semi-Finals -> ' : ''}${formIncludeFinal ? 'Final' : ''}`,
        group_count: Math.max(1, parseInt(formGroupCount, 10) || 5),
        allow_extra_group: formAllowExtraGroup,
        teams_per_group: Math.max(2, parseInt(formTeamsPerGroup, 10) || 8),
        qualifiers_per_group: Math.max(1, parseInt(formQualifiersPerGroup, 10) || 2),
        super_league_enabled: formSuperLeagueEnabled,
        super_league_groups: Math.max(1, parseInt(formSuperLeagueGroups, 10) || 4),
        super_league_qualifiers_per_group: Math.max(1, parseInt(formSuperLeagueQualifiers, 10) || 1),
        include_semifinals: formIncludeSemis,
        include_final: formIncludeFinal
      },
      points_win: Number(formPointsWin) || 4,
      points_loss: Number(formPointsLoss) || 0,
      points_tie: Number(formPointsTie) || 2,
      points_no_result: Number(formPointsTie) || 2,
      points_bonus_win: Number(formPointsBonusWin) || 1,
      points_bonus_loss: Number(formPointsBonusLoss) ?? -1,
      points_walkover_win: Number(formPointsWalkoverWin) || 4,
      points_walkover_loss: Number(formPointsWalkoverLoss) ?? -1,
      playing_rules: {
        powerplay_overs: Math.max(0, parseInt(formPowerplayOvers, 10) || 5),
        max_outside_powerplay: Math.max(0, parseInt(formMaxOutsidePP, 10) || 2),
        max_outside_post_powerplay: Math.max(0, parseInt(formMaxOutsidePostPP, 10) || 5),
        max_on_side_fielders: Math.max(0, parseInt(formMaxOnSide, 10) || 5),
        max_on_side_behind_crease: Math.max(0, parseInt(formMaxBehindCrease, 10) || 2),
        free_hit_on_all_noballs: formFreeHitAllNoBalls,
        delay_penalty_enabled: formDelayPenaltyEnabled,
        delay_interval_value: Math.max(1, parseInt(formDelayIntervalValue, 10) || 4),
        delay_interval_unit: formDelayIntervalUnit,
        delay_overs_reduced_per_interval: Math.max(1, parseInt(formDelayOversReduced, 10) || 1),
        tie_handling: formTieHandling
      }
    };

    try {
      if (isAddMode) {
        await adminApi.createTournament({
          name: formName.trim(),
          shortName: formShortName.trim(),
          season: formSeason,
          format: formFormat,
          match_format: formFormat,
          overs: parseInt(formOvers, 10) || 20,
          start_date: formStartDate,
          end_date: formEndDate,
          startDate: formStartDate,
          endDate: formEndDate,
          ...rulesPayload
        });
        showToast('Tournament created with custom rules & points.', 'success');
      } else if (isEditMode && activeTournament) {
        await adminApi.updateTournament(activeTournament.id, {
          name: formName.trim(),
          shortName: formShortName.trim(),
          season: formSeason,
          format: formFormat,
          match_format: formFormat,
          overs: parseInt(formOvers, 10) || 20,
          start_date: formStartDate,
          end_date: formEndDate,
          startDate: formStartDate,
          endDate: formEndDate,
          status: formStatus,
          ...rulesPayload
        });
        showToast('Tournament updated with custom rules & points.', 'success');
      }
      setIsAddMode(false);
      setIsEditMode(false);
      setActiveTournament(null);
      loadTournaments();
    } catch (e: any) {
      showToast(`Save error: ${e.message}`, 'error');
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      header: 'Tournament Name',
      accessor: (t) => (
        <View style={styles.tournamentCell}>
          <View style={styles.trophyBadge}>
            <TournamentsIcon size={20} color="#0A2540" />
          </View>
          <View>
            <Text style={styles.tournamentName}>{t.name}</Text>
            <Text style={styles.tournamentSub}>
              {t.short_name ? `${t.short_name} • ` : ''}Season {t.season || '2026'}
            </Text>
          </View>
        </View>
      )
    },
    {
      header: 'Match Format',
      accessor: (t) => (
        <span
          style={{
            display: 'inline-block',
            padding: '3px 8px',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 700,
            backgroundColor: '#F1F5F9',
            color: '#334155'
          }}
        >
          {t.format || 'T20'} ({t.overs || 20} Overs)
        </span>
      )
    },
    {
      header: 'Schedule Window',
      accessor: (t) => (
        <Text style={styles.dateText}>
          {t.start_date ? new Date(t.start_date).toLocaleDateString() : 'TBD'}
          {t.end_date ? ` — ${new Date(t.end_date).toLocaleDateString()}` : ''}
        </Text>
      )
    },
    {
      header: 'Competition Status',
      accessor: (t) => <StatusBadge status={t.status || 'ACTIVE'} />
    },
    {
      header: 'Actions',
      accessor: (t) => (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleOpenEdit(t)}
            accessibilityLabel="Edit Details"
          >
            <EditIcon size={15} color="#0284C7" />
          </TouchableOpacity>
        </View>
      )
    }
  ];

  return (
    <View style={styles.container}>
      <PageHeader
        title="Tournaments & Leagues"
        subtitle="Manage official Cricket Association tournaments, schedules, formats, and active seasons."
        breadcrumbs={[
          { label: 'Admin', link: '/admin/dashboard' },
          { label: 'Tournaments' }
        ]}
        actions={
          <TouchableOpacity style={styles.addBtn} onPress={handleOpenAdd}>
            <PlusIcon size={16} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Create Tournament</Text>
          </TouchableOpacity>
        }
      />

      {/* Tournaments Data Table */}
      <DataTable
        columns={columns}
        data={tournaments}
        keyExtractor={(t) => String(t.id)}
        searchable
        searchPlaceholder="Search tournament by name or season..."
        filterKey={(t) => `${t.name} ${t.short_name} ${t.season} ${t.format}`}
        loading={loading}
        emptyTitle="No tournaments registered"
        emptyDescription="Create your first district tournament to start scheduling official matches."
      />

      {/* Add / Edit Tournament Modal */}
      {(isAddMode || isEditMode) && (
        <Modal transparent animationType="fade" visible>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isAddMode ? 'Create New Tournament' : 'Edit Tournament Details'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setIsAddMode(false);
                    setIsEditMode(false);
                    setActiveTournament(null);
                  }}
                >
                  <CloseIcon size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Tournament Name *</Text>
                  <TextInput
                    style={styles.input}
                    value={formName}
                    onChangeText={setFormName}
                    placeholder="e.g. Virudhunagar Premier League 2026"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                  <View style={[styles.fieldGroup, { flex: 1, minWidth: 160 }]}>
                    <Text style={styles.fieldLabel}>Short Name</Text>
                    <TextInput
                      style={styles.input}
                      value={formShortName}
                      onChangeText={setFormShortName}
                      placeholder="e.g. VPL 2026"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Season (Year)</Text>
                    <View style={{ position: 'relative', width: '100%', justifyContent: 'center' }}>
                      <TextInput
                        style={[styles.input, { paddingRight: 40 }]}
                        value={formSeason}
                        onChangeText={(val) => setFormSeason(val.replace(/[^0-9]/g, '').slice(0, 4))}
                        placeholder="e.g. 2026"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        maxLength={4}
                      />
                      <Text style={{ position: 'absolute', right: 10, fontSize: 16, pointerEvents: 'none' as any }}>📅</Text>
                    </View>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                  <View style={[styles.fieldGroup, { flex: 1, minWidth: 160 }]}>
                    <Text style={styles.fieldLabel}>Format</Text>
                    <select
                      value={formFormat}
                      onChange={(e) => {
                        setFormFormat(e.target.value);
                        if (e.target.value === 'T20') setFormOvers('20');
                        else if (e.target.value === 'ODI') setFormOvers('50');
                        else if (e.target.value === 'T10') setFormOvers('10');
                      }}
                      style={{
                        padding: '9px 12px',
                        fontSize: 13,
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        color: '#1E293B',
                        width: '100%',
                        outlineStyle: 'none' as any
                      }}
                    >
                      <option value="T20">T20 (20 Overs)</option>
                      <option value="ODI">One Day (50 Overs)</option>
                      <option value="T10">T10 (10 Overs)</option>
                      <option value="MULTI_DAY">Multi-Day League</option>
                    </select>
                  </View>
                  <View style={[styles.fieldGroup, { flex: 1, minWidth: 120 }]}>
                    <Text style={styles.fieldLabel}>Overs Per Innings</Text>
                    <TextInput
                      style={styles.input}
                      value={formOvers}
                      onChangeText={setFormOvers}
                      keyboardType="numeric"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                  <View style={[styles.fieldGroup, { flex: 1, minWidth: 160 }]}>
                    <Text style={styles.fieldLabel}>Start Date</Text>
                    <input
                      type="date"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        fontSize: 13,
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        color: '#1E293B',
                        width: '100%',
                        outlineStyle: 'none' as any,
                        boxSizing: 'border-box'
                      }}
                    />
                  </View>
                  <View style={[styles.fieldGroup, { flex: 1, minWidth: 160 }]}>
                    <Text style={styles.fieldLabel}>End Date</Text>
                    <input
                      type="date"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        fontSize: 13,
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        color: '#1E293B',
                        width: '100%',
                        outlineStyle: 'none' as any,
                        boxSizing: 'border-box'
                      }}
                    />
                  </View>
                </View>

                {isEditMode && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Status</Text>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                      style={{
                        padding: '9px 12px',
                        fontSize: 13,
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        color: '#1E293B',
                        width: '100%',
                        outlineStyle: 'none' as any
                      }}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="UPCOMING">Upcoming</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </View>
                )}

                {/* DYNAMIC MULTI-STAGE COMPETITION FORMAT */}
                <View style={{
                  marginTop: 8,
                  padding: 12,
                  borderRadius: 10,
                  backgroundColor: '#EFF6FF',
                  borderWidth: 1,
                  borderColor: '#BFDBFE',
                  gap: 10
                }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#1E3A8A' }}>
                    🏆 Competition Format & Multi-Stage Structure
                  </Text>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Tournament Structure</Text>
                    <select
                      value={formTournamentType}
                      onChange={(e) => setFormTournamentType(e.target.value as any)}
                      style={{
                        padding: '8px 10px',
                        fontSize: 13,
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        color: '#1E293B',
                        width: '100%'
                      }}
                    >
                      <option value="GROUP_SUPER_LEAGUE">Multi-Stage (Groups → Super League → Knockouts)</option>
                      <option value="LEAGUE_KNOCKOUT">League + Knockout</option>
                      <option value="LEAGUE">Single / Double League</option>
                      <option value="KNOCKOUT">Direct Knockout</option>
                    </select>
                  </View>

                  {(formTournamentType === 'GROUP_SUPER_LEAGUE' || formTournamentType === 'LEAGUE_KNOCKOUT') && (
                    <>
                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                        <View style={{ flex: 1, minWidth: 95 }}>
                          <Text style={styles.fieldLabel}>Stage 1 Groups</Text>
                          <TextInput style={styles.input} value={formGroupCount} onChangeText={setFormGroupCount} keyboardType="numeric" />
                        </View>
                        <View style={{ flex: 1, minWidth: 95 }}>
                          <Text style={styles.fieldLabel}>Teams / Group</Text>
                          <TextInput style={styles.input} value={formTeamsPerGroup} onChangeText={setFormTeamsPerGroup} keyboardType="numeric" />
                        </View>
                        <View style={{ flex: 1, minWidth: 105 }}>
                          <Text style={styles.fieldLabel}>Top Qualifiers / Grp</Text>
                          <TextInput style={styles.input} value={formQualifiersPerGroup} onChangeText={setFormQualifiersPerGroup} keyboardType="numeric" />
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                        <TouchableOpacity
                          onPress={() => setFormAllowExtraGroup(v => !v)}
                          style={{
                            flex: 1,
                            minWidth: 150,
                            paddingHorizontal: 10,
                            paddingVertical: 7,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: formAllowExtraGroup ? '#2563EB' : '#CBD5E1',
                            backgroundColor: formAllowExtraGroup ? '#DBEAFE' : '#FFFFFF'
                          }}
                        >
                          <Text style={{ fontSize: 11.5, fontWeight: '700', color: formAllowExtraGroup ? '#1E40AF' : '#475569' }}>
                            {formAllowExtraGroup ? '✅ Auto-add Extra Group (e.g. 6th Group)' : '⬜ Fixed Group Count'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setFormSuperLeagueEnabled(v => !v)}
                          style={{
                            flex: 1,
                            minWidth: 150,
                            paddingHorizontal: 10,
                            paddingVertical: 7,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: formSuperLeagueEnabled ? '#059669' : '#CBD5E1',
                            backgroundColor: formSuperLeagueEnabled ? '#D1FAE5' : '#FFFFFF'
                          }}
                        >
                          <Text style={{ fontSize: 11.5, fontWeight: '700', color: formSuperLeagueEnabled ? '#065F46' : '#475569' }}>
                            {formSuperLeagueEnabled ? '✅ Stage 2: Super League Enabled' : '⬜ Skip Super League'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {formSuperLeagueEnabled && (
                        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                          <View style={{ flex: 1, minWidth: 120 }}>
                            <Text style={styles.fieldLabel}>Super League Groups</Text>
                            <TextInput style={styles.input} value={formSuperLeagueGroups} onChangeText={setFormSuperLeagueGroups} keyboardType="numeric" />
                          </View>
                          <View style={{ flex: 1, minWidth: 120 }}>
                            <Text style={styles.fieldLabel}>Top Qualifiers / SL Grp</Text>
                            <TextInput style={styles.input} value={formSuperLeagueQualifiers} onChangeText={setFormSuperLeagueQualifiers} keyboardType="numeric" />
                          </View>
                        </View>
                      )}

                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                        <TouchableOpacity
                          onPress={() => setFormIncludeSemis(v => !v)}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: formIncludeSemis ? '#7C3AED' : '#CBD5E1',
                            backgroundColor: formIncludeSemis ? '#EDE9FE' : '#FFFFFF'
                          }}
                        >
                          <Text style={{ fontSize: 11.5, fontWeight: '700', color: formIncludeSemis ? '#5B21B6' : '#475569' }}>
                            {formIncludeSemis ? '✅ Semi-Finals' : '⬜ No Semi-Finals'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setFormIncludeFinal(v => !v)}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: formIncludeFinal ? '#7C3AED' : '#CBD5E1',
                            backgroundColor: formIncludeFinal ? '#EDE9FE' : '#FFFFFF'
                          }}
                        >
                          <Text style={{ fontSize: 11.5, fontWeight: '700', color: formIncludeFinal ? '#5B21B6' : '#475569' }}>
                            {formIncludeFinal ? '✅ Grand Final' : '⬜ No Final'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={{ fontSize: 11, color: '#1E40AF', fontWeight: '700' }}>
                        Flow: {formGroupCount} Groups × {formTeamsPerGroup} Teams → Top {formQualifiersPerGroup}/Group → {formSuperLeagueEnabled ? `${formSuperLeagueGroups} Super League Groups → Top ${formSuperLeagueQualifiers}/Group → ` : ''}{formIncludeSemis ? 'Semi-Finals → ' : ''}{formIncludeFinal ? 'Final' : ''}
                      </Text>
                    </>
                  )}
                </View>

                {/* DYNAMIC TOURNAMENT RULES & POINTS (Rules 5, 8, 14, 17, 18) */}
                <View style={{
                  marginTop: 8,
                  padding: 12,
                  borderRadius: 10,
                  backgroundColor: '#F8FAFC',
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  gap: 10
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>
                      📜 Tournament Playing Rules & Points
                    </Text>
                    <TouchableOpacity
                      onPress={applyStandardRulePreset}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 6,
                        backgroundColor: '#FEF3C7',
                        borderWidth: 1,
                        borderColor: '#F59E0B'
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#92400E' }}>⚡ Association Preset</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Rule 8: Powerplay & Fielding Restrictions */}
                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#334155' }}>
                    Rule 8 • Powerplay & Fielding Restrictions
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <View style={{ flex: 1, minWidth: 110 }}>
                      <Text style={styles.fieldLabel}>Powerplay Overs</Text>
                      <TextInput style={styles.input} value={formPowerplayOvers} onChangeText={setFormPowerplayOvers} keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1, minWidth: 110 }}>
                      <Text style={styles.fieldLabel}>Max Outside (PP)</Text>
                      <TextInput style={styles.input} value={formMaxOutsidePP} onChangeText={setFormMaxOutsidePP} keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1, minWidth: 110 }}>
                      <Text style={styles.fieldLabel}>Max Outside (Post-PP)</Text>
                      <TextInput style={styles.input} value={formMaxOutsidePostPP} onChangeText={setFormMaxOutsidePostPP} keyboardType="numeric" />
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <View style={{ flex: 1, minWidth: 130 }}>
                      <Text style={styles.fieldLabel}>Max Leg-Side (excl WK/Bwl)</Text>
                      <TextInput style={styles.input} value={formMaxOnSide} onChangeText={setFormMaxOnSide} keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1, minWidth: 130 }}>
                      <Text style={styles.fieldLabel}>Max Behind Popping Crease</Text>
                      <TextInput style={styles.input} value={formMaxBehindCrease} onChangeText={setFormMaxBehindCrease} keyboardType="numeric" />
                    </View>
                  </View>

                  {/* Rule 5: Delay Over Penalty */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#334155' }}>
                      Rule 5 • Post-Toss Delay Over Penalty
                    </Text>
                    <TouchableOpacity
                      onPress={() => setFormDelayPenaltyEnabled(p => !p)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: formDelayPenaltyEnabled ? '#DCFCE7' : '#E2E8F0'
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '800', color: formDelayPenaltyEnabled ? '#166534' : '#475569' }}>
                        {formDelayPenaltyEnabled ? 'ENABLED' : 'OFF'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {formDelayPenaltyEnabled && (
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      <View style={{ flex: 1, minWidth: 90 }}>
                        <Text style={styles.fieldLabel}>Every (Value)</Text>
                        <TextInput style={styles.input} value={formDelayIntervalValue} onChangeText={setFormDelayIntervalValue} keyboardType="numeric" />
                      </View>
                      <View style={{ flex: 1, minWidth: 100 }}>
                        <Text style={styles.fieldLabel}>Unit</Text>
                        <select
                          value={formDelayIntervalUnit}
                          onChange={(e) => setFormDelayIntervalUnit(e.target.value as 'MINUTES' | 'SECONDS')}
                          style={{
                            padding: '8px 10px',
                            fontSize: 13,
                            borderRadius: 6,
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#FFFFFF',
                            color: '#1E293B',
                            width: '100%'
                          }}
                        >
                          <option value="MINUTES">Minutes</option>
                          <option value="SECONDS">Seconds</option>
                        </select>
                      </View>
                      <View style={{ flex: 1, minWidth: 90 }}>
                        <Text style={styles.fieldLabel}>Reduce Overs</Text>
                        <TextInput style={styles.input} value={formDelayOversReduced} onChangeText={setFormDelayOversReduced} keyboardType="numeric" />
                      </View>
                    </View>
                  )}

                  {/* Rule 18: Free Hit + Rule 14: Tie Handling */}
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
                    <TouchableOpacity
                      onPress={() => setFormFreeHitAllNoBalls(p => !p)}
                      style={{
                        flex: 1,
                        minWidth: 160,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: formFreeHitAllNoBalls ? '#059669' : '#CBD5E1',
                        backgroundColor: formFreeHitAllNoBalls ? '#ECFDF5' : '#FFFFFF'
                      }}
                    >
                      <Text style={{ fontSize: 11.5, fontWeight: '700', color: formFreeHitAllNoBalls ? '#065F46' : '#475569' }}>
                        {formFreeHitAllNoBalls ? '✅ Rule 18: Free Hit on ALL No-Balls' : '⬜ Rule 18: Overstep No-Ball Only'}
                      </Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1, minWidth: 140 }}>
                      <select
                        value={formTieHandling}
                        onChange={(e) => setFormTieHandling(e.target.value as 'SHARE_POINTS' | 'SUPER_OVER')}
                        style={{
                          padding: '8px 10px',
                          fontSize: 12.5,
                          borderRadius: 8,
                          border: '1px solid #CBD5E1',
                          backgroundColor: '#FFFFFF',
                          color: '#1E293B',
                          width: '100%'
                        }}
                      >
                        <option value="SHARE_POINTS">Rule 14: Tie → Share Points</option>
                        <option value="SUPER_OVER">Rule 14: Tie → Super Over</option>
                      </select>
                    </View>
                  </View>

                  {/* Rule 17: Points System */}
                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#334155', marginTop: 4 }}>
                    Rule 17 • Points Table & Walkover Rules
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <View style={{ flex: 1, minWidth: 70 }}>
                      <Text style={styles.fieldLabel}>Win</Text>
                      <TextInput style={styles.input} value={formPointsWin} onChangeText={setFormPointsWin} keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1, minWidth: 70 }}>
                      <Text style={styles.fieldLabel}>Loss</Text>
                      <TextInput style={styles.input} value={formPointsLoss} onChangeText={setFormPointsLoss} keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1, minWidth: 70 }}>
                      <Text style={styles.fieldLabel}>Tie (Each)</Text>
                      <TextInput style={styles.input} value={formPointsTie} onChangeText={setFormPointsTie} keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1, minWidth: 80 }}>
                      <Text style={styles.fieldLabel}>Bonus (+)</Text>
                      <TextInput style={styles.input} value={formPointsBonusWin} onChangeText={setFormPointsBonusWin} keyboardType="numeric" />
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <View style={{ flex: 1, minWidth: 100 }}>
                      <Text style={styles.fieldLabel}>Loss Bonus Pen.</Text>
                      <TextInput style={styles.input} value={formPointsBonusLoss} onChangeText={setFormPointsBonusLoss} keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1, minWidth: 100 }}>
                      <Text style={styles.fieldLabel}>Walkover Win</Text>
                      <TextInput style={styles.input} value={formPointsWalkoverWin} onChangeText={setFormPointsWalkoverWin} keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1, minWidth: 100 }}>
                      <Text style={styles.fieldLabel}>Walkover Given</Text>
                      <TextInput style={styles.input} value={formPointsWalkoverLoss} onChangeText={setFormPointsWalkoverLoss} keyboardType="numeric" />
                    </View>
                  </View>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setIsAddMode(false);
                    setIsEditMode(false);
                    setActiveTournament(null);
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveTournament}>
                  <Text style={styles.saveBtnText}>
                    {isAddMode ? 'Create Tournament' : 'Save Changes'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0A2540',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 6
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600'
  },
  tournamentCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  trophyBadge: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center'
  },
  tournamentName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A'
  },
  tournamentSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  },
  dateText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500'
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    flexDirection: 'column'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#F8FAFC'
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A2540'
  },
  modalBody: {
    padding: 20,
    flexShrink: 1
  },
  fieldGroup: {
    marginBottom: 14
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6
  },
  input: {
    height: 38,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#FFFFFF'
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#F8FAFC'
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF'
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569'
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#0A2540'
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF'
  }
});

export default TournamentsPage;
