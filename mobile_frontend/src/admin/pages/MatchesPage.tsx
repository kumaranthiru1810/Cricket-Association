/**
 * src/admin/pages/MatchesPage.tsx
 * Matches Management Page for Cricket Association Professional Admin Panel.
 * Supports scheduling fixtures between registered clubs, filtering status
 * (Scheduled, Live, Completed), and recording official match outcomes.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView } from 'react-native';
import PageHeader from '../components/PageHeader';
import DataTable, { ColumnDef } from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import { MatchesIcon, PlusIcon, EditIcon, EyeIcon, CloseIcon, TrashIcon } from '../components/Icons';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { adminApi } from '../services/adminApi';
import { useAdminLayout } from '../components/AdminLayout';
import {
  getTodayKolkata,
  getKolkataNow,
  getDefaultScheduleDateTime,
  parseTimeString,
  validateScheduleDateTime
} from '../../utils/dateTimeValidation';

export const MatchesPage: React.FC = () => {
  const { showToast } = useAdminLayout();
  const [matches, setMatches] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Schedule Match Modal
  const [isScheduleMode, setIsScheduleMode] = useState(false);
  const [formTournamentId, setFormTournamentId] = useState('TOUR-2026');
  const [formTeamA, setFormTeamA] = useState('');
  const [formTeamB, setFormTeamB] = useState('');
  const [formVenue, setFormVenue] = useState('Kamarajar District Stadium, Virudhunagar');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('09:30 AM');
  const [formOvers, setFormOvers] = useState('20');

  // Edit Fixture Modal State
  const [activeMatch, setActiveMatch] = useState<any | null>(null);
  const [editTournamentId, setEditTournamentId] = useState('');
  const [editTeamAId, setEditTeamAId] = useState('');
  const [editTeamBId, setEditTeamBId] = useState('');
  const [editVenue, setEditVenue] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('09:30 AM');
  const [editOvers, setEditOvers] = useState('20');
  const [editStatus, setEditStatus] = useState('SCHEDULED');
  const [editResult, setEditResult] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Delete Match State
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Postpone Match Modal
  const [postponeTarget, setPostponeTarget] = useState<any | null>(null);
  const [postponeReason, setPostponeReason] = useState('Inclement weather / ground condition unplayable');
  const [isSubmittingPostpone, setIsSubmittingPostpone] = useState(false);

  // Reschedule Match Modal
  const [rescheduleTarget, setRescheduleTarget] = useState<any | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('09:30 AM');
  const [rescheduleReason, setRescheduleReason] = useState('Rescheduled by admin');
  const [isSubmittingReschedule, setIsSubmittingReschedule] = useState(false);

  // Lineup & Squad Allocation Inspection Modal
  const [inspectionMatch, setInspectionMatch] = useState<any | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mRes, tRes, tourRes, vRes] = await Promise.all([
        adminApi.getMatches(),
        adminApi.getTeams(),
        adminApi.getTournaments(),
        adminApi.getVenues()
      ]);

      if (mRes && mRes.success) {
        setMatches(mRes.matches || []);
      }
      if (tRes && tRes.success) {
        setTeams(tRes.teams || []);
      }
      if (tourRes) {
        const list = Array.isArray(tourRes)
          ? tourRes
          : (Array.isArray(tourRes.tournaments)
            ? tourRes.tournaments
            : (Array.isArray(tourRes.data) ? tourRes.data : []));
        setTournaments(list.length > 0 ? list : [
          { id: 'T-2026-VPL', name: 'Virudhunagar Premier League 2026', format: 'T20' },
          { id: 'T-2026-U19', name: 'District Under-19 Championship', format: 'ODI' },
          { id: 'T-2026-SUPER8', name: 'Kamarajar Memorial Knockout Trophy 2026', format: 'T20' }
        ]);
      }
      if (vRes) {
        const vList = Array.isArray(vRes)
          ? vRes
          : (Array.isArray(vRes.venues) ? vRes.venues : (Array.isArray(vRes.data) ? vRes.data : []));
        if (vList.length > 0) {
          setVenues(vList);
        }
      }
    } catch (e: any) {
      showToast(`Failed to load matches: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const todayKolkata = getTodayKolkata();
  const dateTimeValidation = validateScheduleDateTime(formDate, formTime);
  const isScheduleValid = dateTimeValidation.isValid;

  const editDateTimeValidation = validateScheduleDateTime(editDate, editTime);
  const isEditScheduleValid = editStatus !== 'SCHEDULED' || editDateTimeValidation.isValid;

  const handleOpenSchedule = () => {
    const defaultTeamA = teams.length > 0 ? teams[0].id : '';
    const defaultTeamB = teams.length > 1 ? teams[1].id : defaultTeamA;
    const defaultSlot = getDefaultScheduleDateTime();
    const defaultVenue = venues.length > 0 ? (venues[0].name || venues[0]) : 'Kamarajar District Stadium, Virudhunagar';
    setFormTournamentId(tournaments.length > 0 ? tournaments[0].id : 'TOUR-2026');
    setFormTeamA(defaultTeamA);
    setFormTeamB(defaultTeamB);
    setFormVenue(defaultVenue);
    setFormDate(defaultSlot.date);
    setFormTime(defaultSlot.time);
    setFormOvers('20');
    setIsScheduleMode(true);
  };

  const handleSaveSchedule = async () => {
    if (!formTeamA || !formTeamB) {
      showToast('Please select both competing teams.', 'error');
      return;
    }
    if (formTeamA === formTeamB) {
      showToast('Team A and Team B cannot be the same club.', 'error');
      return;
    }

    const valResult = validateScheduleDateTime(formDate, formTime);
    if (!valResult.isValid) {
      showToast(valResult.error || 'Please provide a valid future match date and time.', 'error');
      return;
    }

    try {
      await adminApi.createMatch({
        tournamentId: formTournamentId,
        teamAId: formTeamA,
        teamBId: formTeamB,
        venueName: formVenue,
        date: formDate,
        time: formTime,
        overs: parseInt(formOvers, 10) || 20
      });
      showToast('Match scheduled successfully.', 'success');
      setIsScheduleMode(false);
      loadData();
    } catch (e: any) {
      showToast(`Schedule error: ${e.message}`, 'error');
    }
  };

  const handleOpenEdit = (m: any) => {
    setActiveMatch(m);
    setEditTournamentId(m.tournament_id || m.tournamentId || (tournaments.length > 0 ? tournaments[0].id : 'TOUR-2026'));
    setEditTeamAId(m.team_a_id || m.teamAId || (teams.length > 0 ? teams[0].id : ''));
    setEditTeamBId(m.team_b_id || m.teamBId || (teams.length > 1 ? teams[1].id : ''));
    setEditVenue(m.venue || (venues.length > 0 ? (venues[0].name || venues[0]) : 'Kamarajar District Stadium, Virudhunagar'));
    setEditDate(m.match_date || m.date || '');
    setEditTime(m.match_time || m.time || '09:30 AM');
    setEditOvers(String(m.overs_per_side || m.overs || 20));
    setEditStatus(m.status || 'SCHEDULED');
    setEditResult(m.result_summary || m.result || '');
  };

  const handleSaveEdit = async () => {
    if (!activeMatch) return;
    if (!editTeamAId || !editTeamBId) {
      showToast('Please select both competing teams.', 'error');
      return;
    }
    if (editTeamAId === editTeamBId) {
      showToast('Team A and Team B cannot be the same club.', 'error');
      return;
    }

    if (editStatus === 'SCHEDULED' && editDate && editTime) {
      const val = validateScheduleDateTime(editDate, editTime);
      if (!val.isValid) {
        showToast(val.error || 'Please provide a valid match date and time.', 'error');
        return;
      }
    }

    setIsSubmittingEdit(true);
    try {
      await adminApi.updateMatch(activeMatch.id, {
        tournament_id: editTournamentId,
        tournamentId: editTournamentId,
        team_a_id: editTeamAId,
        teamAId: editTeamAId,
        team_b_id: editTeamBId,
        teamBId: editTeamBId,
        venue: editVenue,
        venueName: editVenue,
        match_date: editDate,
        date: editDate,
        match_time: editTime,
        time: editTime,
        overs_per_side: parseInt(editOvers, 10) || 20,
        overs: parseInt(editOvers, 10) || 20,
        status: editStatus,
        resultText: editResult,
        result_summary: editResult
      });
      showToast('Match fixture updated successfully.', 'success');
      setActiveMatch(null);
      loadData();
    } catch (e: any) {
      showToast(`Update error: ${e.message}`, 'error');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await adminApi.deleteMatch(deleteTarget.id);
      showToast(`Match fixture successfully deleted.`, 'success');
      setDeleteTarget(null);
      if (activeMatch?.id === deleteTarget.id) setActiveMatch(null);
      loadData();
    } catch (e: any) {
      showToast(`Delete error: ${e.message || 'Failed to delete match'}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmPostpone = async () => {
    if (!postponeTarget) return;
    if (!postponeReason.trim()) {
      showToast('Please provide a reason for postponement.', 'error');
      return;
    }
    setIsSubmittingPostpone(true);
    try {
      await adminApi.postponeMatch(postponeTarget.id, postponeReason.trim());
      showToast('Match marked as POSTPONED successfully.', 'success');
      setPostponeTarget(null);
      loadData();
    } catch (e: any) {
      showToast(`Postpone error: ${e.message}`, 'error');
    } finally {
      setIsSubmittingPostpone(false);
    }
  };

  const handleConfirmReschedule = async () => {
    if (!rescheduleTarget) return;
    const valResult = validateScheduleDateTime(rescheduleDate, rescheduleTime);
    if (!valResult.isValid) {
      showToast(valResult.error || 'Please provide a valid future date and time.', 'error');
      return;
    }
    setIsSubmittingReschedule(true);
    try {
      await adminApi.rescheduleMatch(rescheduleTarget.id, rescheduleDate.trim(), rescheduleTime.trim(), rescheduleReason.trim());
      showToast('Match rescheduled successfully.', 'success');
      setRescheduleTarget(null);
      loadData();
    } catch (e: any) {
      showToast(`Reschedule error: ${e.message}`, 'error');
    } finally {
      setIsSubmittingReschedule(false);
    }
  };

  const filteredMatches = matches.filter((m) => {
    if (statusFilter === 'ALL') return true;
    return (m.status || '').toUpperCase() === statusFilter.toUpperCase();
  });

  const columns: ColumnDef<any>[] = [
    {
      header: 'Fixture',
      accessor: (m) => {
        const teamAName = m.teamAName || m.team_a_name || 'Team A';
        const teamBName = m.teamBName || m.team_b_name || 'Team B';
        const isScheduled = (m.status || '').toUpperCase() === 'SCHEDULED';
        const isTeamASubmitted = m.team_a_allocation_status === 'SUBMITTED';
        const isTeamBSubmitted = m.team_b_allocation_status === 'SUBMITTED';
        const isConfirmed = m.schedule_confirmation_status === 'CONFIRMED';

        return (
          <View style={styles.fixtureCell}>
            <View style={styles.teamsRow}>
              <Text style={styles.teamBold}>{teamAName}</Text>
              <Text style={styles.vsBadge}>vs</Text>
              <Text style={styles.teamBold}>{teamBName}</Text>
            </View>
            <Text style={styles.tournamentMeta}>
              {m.tournamentName || m.tournament_display_name || 'League Match'} • {m.overs || 20} Overs
            </Text>
            {isScheduled && !isConfirmed && (
              <View style={{ marginTop: 6, gap: 3, backgroundColor: '#F8FAFC', padding: 6, borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 10, color: '#334155', fontWeight: '600' }} numberOfLines={1}>
                    {teamAName}:
                  </Text>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: isTeamASubmitted ? '#15803D' : '#DC2626' }}>
                    {isTeamASubmitted ? '✅ 11 Selected' : '❌ Not Selected'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 10, color: '#334155', fontWeight: '600' }} numberOfLines={1}>
                    {teamBName}:
                  </Text>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: isTeamBSubmitted ? '#15803D' : '#DC2626' }}>
                    {isTeamBSubmitted ? '✅ 11 Selected' : '❌ Not Selected'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        );
      }
    },
    {
      header: 'Venue & Ground',
      accessor: (m) => (
        <View>
          <Text style={styles.venueText}>{m.venue || 'District Stadium'}</Text>
          <Text style={styles.groundSub}>Virudhunagar</Text>
        </View>
      )
    },
    {
      header: 'Date & Time',
      accessor: (m) => (
        <View>
          <Text style={styles.dateText}>
            {m.date ? new Date(m.date).toLocaleDateString() : 'TBD'}
          </Text>
          <Text style={styles.timeText}>{m.time || '10:00 AM'}</Text>
        </View>
      )
    },
    {
      header: 'Status / Outcome',
      accessor: (m) => (
        <View>
          <StatusBadge status={m.status || 'SCHEDULED'} />
          {m.result ? (
            <Text style={styles.resultText}>{m.result}</Text>
          ) : null}
          {(m.status === 'POSTPONED' || m.postponement?.reason) && (
            <Text style={{ fontSize: 11, color: '#B45309', marginTop: 2, fontStyle: 'italic' }} numberOfLines={2}>
              Reason: {m.postponement?.reason || 'Postponed'}
            </Text>
          )}
          {m.umpire_postponement_request?.status === 'PENDING' && (
            <View style={{ backgroundColor: '#FEF2F2', borderColor: '#F87171', borderWidth: 1, padding: 4, borderRadius: 4, marginTop: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#B91C1C' }}>⚠️ Umpire Request Pending</Text>
              <Text style={{ fontSize: 10, color: '#991B1B' }} numberOfLines={1}>
                {m.umpire_postponement_request.reason}
              </Text>
            </View>
          )}
          {((m.status || '').toUpperCase() === 'SCHEDULED') && (
            <View style={{ marginTop: 4 }}>
              {m.schedule_confirmation_status === 'CONFIRMED' ? (
                <View style={{ backgroundColor: '#DCFCE7', borderColor: '#86EFAC', borderWidth: 1, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-start' }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#166534' }}>✓ Schedule Confirmed</Text>
                  <Text style={{ fontSize: 9, color: '#15803D', marginTop: 1 }}>Released to Scorer</Text>
                </View>
              ) : (
                <View style={{
                  backgroundColor: (m.team_a_allocation_status === 'SUBMITTED' && m.team_b_allocation_status === 'SUBMITTED') ? '#ECFDF5' : '#FEF2F2',
                  borderColor: (m.team_a_allocation_status === 'SUBMITTED' && m.team_b_allocation_status === 'SUBMITTED') ? '#86EFAC' : '#FECACA',
                  borderWidth: 1,
                  paddingHorizontal: 6,
                  paddingVertical: 3,
                  borderRadius: 4,
                  alignSelf: 'flex-start'
                }}>
                  {(m.team_a_allocation_status === 'SUBMITTED' && m.team_b_allocation_status === 'SUBMITTED') ? (
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#059669' }}>
                      ✓ Both Teams Ready to Confirm
                    </Text>
                  ) : (
                    <View>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#DC2626' }}>
                        ⚠️ Pending Player Selection:
                      </Text>
                      {m.team_a_allocation_status !== 'SUBMITTED' && (
                        <Text style={{ fontSize: 9, fontWeight: '700', color: '#B91C1C' }}>
                          • {m.teamAName || m.team_a_name || 'Team A'} (Pending)
                        </Text>
                      )}
                      {m.team_b_allocation_status !== 'SUBMITTED' && (
                        <Text style={{ fontSize: 9, fontWeight: '700', color: '#B91C1C' }}>
                          • {m.teamBName || m.team_b_name || 'Team B'} (Pending)
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      )
    },
    {
      header: 'Actions',
      accessor: (m) => {
        const isScheduled = (m.status || '').toUpperCase() === 'SCHEDULED';
        const isPostponed = (m.status || '').toUpperCase() === 'POSTPONED';
        const isRequestPending = m.umpire_postponement_request?.status === 'PENDING';

        return (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleOpenEdit(m)}
              accessibilityLabel="Edit Match Details"
            >
              <EditIcon size={15} color="#0284C7" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}
              onPress={() => setDeleteTarget(m)}
              accessibilityLabel="Delete Match"
            >
              <TrashIcon size={14} color="#DC2626" />
            </TouchableOpacity>

            {isRequestPending && (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: '#16A34A', backgroundColor: '#DCFCE7', paddingHorizontal: 6 }]}
                  onPress={async () => {
                    try {
                      await adminApi.reviewPostponementRequest(m.id, 'APPROVE', 'Approved by Admin');
                      showToast('Postponement request approved and match postponed.', 'success');
                      loadData();
                    } catch (e: any) {
                      showToast(e.message, 'error');
                    }
                  }}
                  accessibilityLabel="Approve Umpire Postponement"
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#15803D' }}>✓ Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: '#DC2626', backgroundColor: '#FEE2E2', paddingHorizontal: 6 }]}
                  onPress={async () => {
                    try {
                      await adminApi.reviewPostponementRequest(m.id, 'REJECT', 'Rejected by Admin');
                      showToast('Postponement request rejected.', 'success');
                      loadData();
                    } catch (e: any) {
                      showToast(e.message, 'error');
                    }
                  }}
                  accessibilityLabel="Reject Umpire Postponement"
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#B91C1C' }}>✕ Reject</Text>
                </TouchableOpacity>
              </>
            )}

            {isScheduled && (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: '#6366F1', backgroundColor: '#EEF2FF', paddingHorizontal: 6 }]}
                  onPress={() => setInspectionMatch(m)}
                  accessibilityLabel="Inspect Lineups"
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#4F46E5' }}>👁️ Lineups</Text>
                </TouchableOpacity>

                {m.schedule_confirmation_status === 'CONFIRMED' ? (
                  <View style={[styles.actionBtn, { borderColor: '#86EFAC', backgroundColor: '#DCFCE7', paddingHorizontal: 6 }]}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#166534' }}>✓ Confirmed</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      {
                        borderColor: (m.team_a_allocation_status === 'SUBMITTED' && m.team_b_allocation_status === 'SUBMITTED') ? '#10B981' : '#CBD5E1',
                        backgroundColor: (m.team_a_allocation_status === 'SUBMITTED' && m.team_b_allocation_status === 'SUBMITTED') ? '#ECFDF5' : '#F8FAFC',
                        paddingHorizontal: 6
                      }
                    ]}
                    onPress={async () => {
                      const bothAllocated = m.team_a_allocation_status === 'SUBMITTED' && m.team_b_allocation_status === 'SUBMITTED';
                      if (!bothAllocated) {
                        const pendingTeams = [];
                        if (m.team_a_allocation_status !== 'SUBMITTED') pendingTeams.push(m.teamAName || m.team_a_name || 'Team A');
                        if (m.team_b_allocation_status !== 'SUBMITTED') pendingTeams.push(m.teamBName || m.team_b_name || 'Team B');
                        showToast(`Cannot confirm yet. Waiting for both teams to submit squad allocations (11 Playing + 2 Substitutes). Pending: ${pendingTeams.join(', ')}`, 'error');
                        return;
                      }

                      try {
                        await adminApi.confirmMatchSchedule(m.id);
                        showToast(`Schedule officially confirmed for ${m.teamAName || 'Team A'} vs ${m.teamBName || 'Team B'}!`, 'success');
                        loadData();
                      } catch (err: any) {
                        showToast(err.message || 'Failed to confirm match schedule', 'error');
                      }
                    }}
                    accessibilityLabel="Confirm Match Schedule"
                  >
                    <Text style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color: (m.team_a_allocation_status === 'SUBMITTED' && m.team_b_allocation_status === 'SUBMITTED') ? '#059669' : '#DC2626'
                    }}>
                      {(() => {
                        const isA = m.team_a_allocation_status === 'SUBMITTED';
                        const isB = m.team_b_allocation_status === 'SUBMITTED';
                        if (isA && isB) return '✓ Confirm Schedule';
                        if (!isA && !isB) return '⏳ Both Pending';
                        if (!isA) return `⏳ Pending: ${(m.teamAName || m.team_a_name || 'Team A').split(' ')[0]}`;
                        return `⏳ Pending: ${(m.teamBName || m.team_b_name || 'Team B').split(' ')[0]}`;
                      })()}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: '#F59E0B', backgroundColor: '#FEF3C7', paddingHorizontal: 6 }]}
                  onPress={() => {
                    setPostponeTarget(m);
                    setPostponeReason('Inclement weather / ground condition unplayable');
                  }}
                  accessibilityLabel="Postpone Match"
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#B45309' }}>⏸️ Postpone</Text>
                </TouchableOpacity>
              </>
            )}

            {isPostponed && (
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: '#0284C7', backgroundColor: '#E0F2FE', paddingHorizontal: 6 }]}
                onPress={() => {
                  setRescheduleTarget(m);
                  setRescheduleDate(m.date || '');
                  setRescheduleTime(m.time || '09:30 AM');
                  setRescheduleReason(m.postponement?.reason ? `Rescheduled after: ${m.postponement.reason}` : 'Rescheduled fixture');
                }}
                accessibilityLabel="Reschedule Match"
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#0369A1' }}>📅 Reschedule</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      }
    }
  ];

  return (
    <View style={styles.container}>
      <PageHeader
        title="Matches & Fixtures"
        subtitle="Schedule official tournament fixtures, manage venues, and update match statuses."
        breadcrumbs={[
          { label: 'Admin', link: '/admin/dashboard' },
          { label: 'Matches' }
        ]}
        actions={
          <TouchableOpacity style={styles.addBtn} onPress={handleOpenSchedule}>
            <PlusIcon size={16} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Schedule Fixture</Text>
          </TouchableOpacity>
        }
      />

      {/* Tabs Toolbar */}
      <View style={styles.toolbarCard}>
        <View style={styles.tabsRow}>
          {['ALL', 'LIVE', 'SCHEDULED', 'POSTPONED', 'COMPLETED'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabBtn,
                statusFilter === tab && styles.tabBtnActive
              ]}
              onPress={() => setStatusFilter(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  statusFilter === tab && styles.tabTextActive
                ]}
              >
                {tab === 'ALL'
                  ? 'All Matches'
                  : tab === 'LIVE'
                  ? '🔴 Live Now'
                  : tab === 'SCHEDULED'
                  ? 'Upcoming'
                  : tab === 'POSTPONED'
                  ? '⏸️ Postponed'
                  : 'Completed'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Matches Data Table */}
      <DataTable
        columns={columns}
        data={filteredMatches}
        keyExtractor={(m) => String(m.id)}
        searchable
        searchPlaceholder="Search by team name, venue, or tournament..."
        filterKey={(m) => `${m.teamAName} ${m.teamBName} ${m.venue} ${m.tournamentName}`}
        pageSize={10}
        loading={loading}
        emptyTitle="No matches found"
        emptyDescription="No scheduled or live cricket fixtures match this filter."
      />

      {/* Schedule Fixture Modal */}
      {isScheduleMode && (
        <Modal transparent animationType="fade" visible>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Schedule New Match Fixture</Text>
                <TouchableOpacity onPress={() => setIsScheduleMode(false)}>
                  <CloseIcon size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Select Tournament</Text>
                  <select
                    aria-label="Select Tournament"
                    value={formTournamentId}
                    onChange={(e) => setFormTournamentId(e.target.value)}
                    style={{
                      padding: '9px 12px',
                      fontSize: 13,
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      color: '#1E293B',
                      width: '100%',
                      outline: 'none'
                    }}
                  >
                    <option value="" disabled>Select Tournament</option>
                    {tournaments.map((t) => (
                      <option key={t.id || t.name} value={t.id || t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Team A (Home) *</Text>
                    <select
                      value={formTeamA}
                      onChange={(e) => setFormTeamA(e.target.value)}
                      style={{
                        padding: '9px 12px',
                        fontSize: 13,
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        color: '#1E293B',
                        width: '100%',
                        outline: 'none'
                      }}
                    >
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Team B (Away) *</Text>
                    <select
                      value={formTeamB}
                      onChange={(e) => setFormTeamB(e.target.value)}
                      style={{
                        padding: '9px 12px',
                        fontSize: 13,
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        color: '#1E293B',
                        width: '100%',
                        outline: 'none'
                      }}
                    >
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Select Ground</Text>
                  <select
                    aria-label="Select Ground"
                    value={formVenue}
                    onChange={(e) => setFormVenue(e.target.value)}
                    style={{
                      padding: '9px 12px',
                      fontSize: 13,
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      color: '#1E293B',
                      width: '100%',
                      outline: 'none'
                    }}
                  >
                    <option value="" disabled>Select Ground</option>
                    {venues.length > 0 ? (
                      venues.map((v: any) => {
                        const vName = typeof v === 'string' ? v : v.name;
                        return (
                          <option key={v.id || vName} value={vName}>
                            {vName}
                          </option>
                        );
                      })
                    ) : (
                      <>
                        <option value="Kamarajar District Stadium, Virudhunagar">Kamarajar District Stadium, Virudhunagar</option>
                        <option value="Sivakasi Cricket Ground">Sivakasi Cricket Ground (Sivakasi Bypass)</option>
                        <option value="Aruppukottai Sports Complex Ground">Aruppukottai Sports Complex Ground</option>
                        <option value="Rajapalayam Cricket Arena">Rajapalayam Cricket Arena</option>
                        <option value="Srivilliputhur Town Ground">Srivilliputhur Town Ground</option>
                      </>
                    )}
                  </select>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Date *</Text>
                    <input
                      type="text"
                      placeholder="e.g. 2026-11-09 or 09/11/2026"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        fontSize: 13,
                        borderRadius: 6,
                        border: dateTimeValidation.dateError ? '1.5px solid #EF4444' : '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        color: '#1E293B',
                        width: '100%',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    {dateTimeValidation.dateError ? (
                      <Text style={styles.validationErrorText}>⚠️ {dateTimeValidation.dateError}</Text>
                    ) : null}
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Start Time *</Text>
                    <TextInput
                      style={[styles.input, dateTimeValidation.timeError ? { borderColor: '#EF4444', borderWidth: 1.5 } : null]}
                      value={formTime}
                      onChangeText={setFormTime}
                      placeholder="e.g. 09:30 AM"
                      placeholderTextColor="#94A3B8"
                    />
                    {dateTimeValidation.timeError ? (
                      <Text style={styles.validationErrorText}>⚠️ {dateTimeValidation.timeError}</Text>
                    ) : null}
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Overs</Text>
                    <TextInput
                      style={styles.input}
                      value={formOvers}
                      onChangeText={setFormOvers}
                      keyboardType="numeric"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setIsScheduleMode(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, !isScheduleValid && styles.saveBtnDisabled]}
                  onPress={handleSaveSchedule}
                  disabled={!isScheduleValid}
                >
                  <Text style={styles.saveBtnText}>Save Fixture</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Edit Match / Score Modal */}
      {activeMatch && (
        <Modal transparent animationType="fade" visible>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxWidth: 640, width: '95%', maxHeight: '90%' }]}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Edit Match Fixture</Text>
                  <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    Match ID: {activeMatch.id}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setActiveMatch(null)}>
                  <CloseIcon size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView style={[styles.modalBody, { maxHeight: 500 }]}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Tournament</Text>
                  <select
                    value={editTournamentId}
                    onChange={(e) => setEditTournamentId(e.target.value)}
                    style={{
                      padding: '9px 12px',
                      fontSize: 13,
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      color: '#1E293B',
                      width: '100%',
                      outline: 'none'
                    }}
                  >
                    {tournaments.map((t) => (
                      <option key={t.id || t.name} value={t.id || t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Team A (Home) *</Text>
                    <select
                      value={editTeamAId}
                      onChange={(e) => setEditTeamAId(e.target.value)}
                      style={{
                        padding: '9px 12px',
                        fontSize: 13,
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        color: '#1E293B',
                        width: '100%',
                        outline: 'none'
                      }}
                    >
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Team B (Away) *</Text>
                    <select
                      value={editTeamBId}
                      onChange={(e) => setEditTeamBId(e.target.value)}
                      style={{
                        padding: '9px 12px',
                        fontSize: 13,
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        color: '#1E293B',
                        width: '100%',
                        outline: 'none'
                      }}
                    >
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Match Venue / Ground *</Text>
                  <select
                    value={editVenue}
                    onChange={(e) => setEditVenue(e.target.value)}
                    style={{
                      padding: '9px 12px',
                      fontSize: 13,
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      color: '#1E293B',
                      width: '100%',
                      outline: 'none'
                    }}
                  >
                    {venues.map((v) => {
                      const vName = v.name || v;
                      return (
                        <option key={vName} value={vName}>
                          {vName}
                        </option>
                      );
                    })}
                  </select>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Match Date (YYYY-MM-DD) *</Text>
                    <TextInput
                      style={[styles.input, editDateTimeValidation.dateError ? { borderColor: '#EF4444', borderWidth: 1.5 } : null]}
                      value={editDate}
                      onChangeText={setEditDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#94A3B8"
                    />
                    {editDateTimeValidation.dateError ? (
                      <Text style={styles.validationErrorText}>⚠️ {editDateTimeValidation.dateError}</Text>
                    ) : null}
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Start Time *</Text>
                    <TextInput
                      style={[styles.input, editDateTimeValidation.timeError ? { borderColor: '#EF4444', borderWidth: 1.5 } : null]}
                      value={editTime}
                      onChangeText={setEditTime}
                      placeholder="e.g. 09:30 AM"
                      placeholderTextColor="#94A3B8"
                    />
                    {editDateTimeValidation.timeError ? (
                      <Text style={styles.validationErrorText}>⚠️ {editDateTimeValidation.timeError}</Text>
                    ) : null}
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Overs</Text>
                    <TextInput
                      style={styles.input}
                      value={editOvers}
                      onChangeText={setEditOvers}
                      keyboardType="numeric"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Match Status</Text>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      style={{
                        padding: '9px 12px',
                        fontSize: 13,
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        color: '#1E293B',
                        width: '100%',
                        outline: 'none'
                      }}
                    >
                      <option value="SCHEDULED">Scheduled</option>
                      <option value="LIVE">Live</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="ABANDONED">Abandoned</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </View>

                  <View style={[styles.fieldGroup, { flex: 2 }]}>
                    <Text style={styles.fieldLabel}>Official Result / Note</Text>
                    <TextInput
                      style={styles.input}
                      value={editResult}
                      onChangeText={setEditResult}
                      placeholder="e.g. Virudhunagar Spartans won by 14 runs"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: '#FECACA', backgroundColor: '#FEF2F2', marginRight: 'auto' }]}
                  onPress={() => setDeleteTarget(activeMatch)}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#DC2626' }}>🗑️ Delete Match</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setActiveMatch(null)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, (!isEditScheduleValid || isSubmittingEdit) && styles.saveBtnDisabled]}
                  onPress={handleSaveEdit}
                  disabled={!isEditScheduleValid || isSubmittingEdit}
                >
                  <Text style={styles.saveBtnText}>
                    {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Postpone Match Modal */}
      {postponeTarget && (
        <Modal transparent animationType="fade" visible>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: '#B45309' }]}>⏸️ Postpone Match Fixture</Text>
                <TouchableOpacity onPress={() => setPostponeTarget(null)}>
                  <CloseIcon size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.fixtureSummary}>
                  <Text style={styles.fixtureSummaryTitle}>
                    {postponeTarget.teamAName} vs {postponeTarget.teamBName}
                  </Text>
                  <Text style={styles.fixtureSummarySub}>{postponeTarget.venue || 'District Stadium'}</Text>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Reason for Postponement *</Text>
                  <TextInput
                    style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
                    value={postponeReason}
                    onChangeText={setPostponeReason}
                    multiline
                    numberOfLines={3}
                    placeholder="e.g. Inclement weather, pitch flooded, emergency..."
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setPostponeTarget(null)}
                  disabled={isSubmittingPostpone}
                >
                  <Text style={styles.cancelBtnText}>Dismiss</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: '#D97706' }]}
                  onPress={handleConfirmPostpone}
                  disabled={isSubmittingPostpone}
                >
                  <Text style={styles.saveBtnText}>
                    {isSubmittingPostpone ? 'Postponing...' : 'Confirm Postponement'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Reschedule Match Modal */}
      {rescheduleTarget && (
        <Modal transparent animationType="fade" visible>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: '#0284C7' }]}>📅 Reschedule Postponed Match</Text>
                <TouchableOpacity onPress={() => setRescheduleTarget(null)}>
                  <CloseIcon size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.fixtureSummary}>
                  <Text style={styles.fixtureSummaryTitle}>
                    {rescheduleTarget.teamAName} vs {rescheduleTarget.teamBName}
                  </Text>
                  <Text style={styles.fixtureSummarySub}>{rescheduleTarget.venue || 'District Stadium'}</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>New Match Date (YYYY-MM-DD) *</Text>
                    <TextInput
                      style={styles.input}
                      value={rescheduleDate}
                      onChangeText={setRescheduleDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>New Match Time *</Text>
                    <TextInput
                      style={styles.input}
                      value={rescheduleTime}
                      onChangeText={setRescheduleTime}
                      placeholder="e.g. 09:30 AM"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Rescheduling Notes / Reason</Text>
                  <TextInput
                    style={styles.input}
                    value={rescheduleReason}
                    onChangeText={setRescheduleReason}
                    placeholder="e.g. Ground repaired, mutually agreed slot"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setRescheduleTarget(null)}
                  disabled={isSubmittingReschedule}
                >
                  <Text style={styles.cancelBtnText}>Dismiss</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: '#0284C7' }]}
                  onPress={handleConfirmReschedule}
                  disabled={isSubmittingReschedule}
                >
                  <Text style={styles.saveBtnText}>
                    {isSubmittingReschedule ? 'Rescheduling...' : 'Reschedule & Notify'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Squad Lineups Inspection Modal */}
      {inspectionMatch && (
        <Modal transparent animationType="fade" visible>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxWidth: 840, width: '95%', maxHeight: '90%' }]}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>📋 Official Squad Lineups & Allocations</Text>
                  <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    {inspectionMatch.tournament_display_name || inspectionMatch.tournament_name || 'Tournament'} • {inspectionMatch.match_date || inspectionMatch.date} at {inspectionMatch.match_time || inspectionMatch.time}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setInspectionMatch(null)} style={{ padding: 4 }}>
                  <Text style={{ fontSize: 20, color: '#64748B', fontWeight: 'bold' }}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={[styles.modalBody, { maxHeight: 520 }]}>
                {/* Status banner */}
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: inspectionMatch.schedule_confirmation_status === 'CONFIRMED' ? '#ECFDF5' : '#FEF3C7',
                  borderWidth: 1,
                  borderColor: inspectionMatch.schedule_confirmation_status === 'CONFIRMED' ? '#86EFAC' : '#FDE68A',
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 16
                }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{
                      fontWeight: '800',
                      fontSize: 13,
                      color: inspectionMatch.schedule_confirmation_status === 'CONFIRMED' ? '#166534' : '#92400E'
                    }}>
                      {inspectionMatch.schedule_confirmation_status === 'CONFIRMED'
                        ? '✅ Schedule Officially Confirmed — Visible to Scorers'
                        : '⏳ Pending Schedule Confirmation — Hidden from Scorers'}
                    </Text>
                    <Text style={{
                      fontSize: 12,
                      color: inspectionMatch.schedule_confirmation_status === 'CONFIRMED' ? '#15803D' : '#B45309',
                      marginTop: 2
                    }}>
                      {inspectionMatch.schedule_confirmation_status === 'CONFIRMED'
                        ? `Confirmed on ${inspectionMatch.schedule_confirmed_at ? new Date(inspectionMatch.schedule_confirmed_at).toLocaleDateString() : 'Official Record'}. Scorers have access to start toss and score.`
                        : 'Both teams must submit 11 Playing XI + substitutes before you can confirm schedule and release this fixture to Scorer.'}
                    </Text>
                  </View>
                </View>

                {/* Specific Pending Warning Alert */}
                {inspectionMatch.schedule_confirmation_status !== 'CONFIRMED' && (
                  (inspectionMatch.team_a_allocation_status !== 'SUBMITTED' || inspectionMatch.team_b_allocation_status !== 'SUBMITTED') && (
                    <View style={{
                      backgroundColor: '#FEF2F2',
                      borderColor: '#F87171',
                      borderWidth: 1,
                      padding: 12,
                      borderRadius: 8,
                      marginBottom: 16
                    }}>
                      <Text style={{ fontWeight: '800', fontSize: 13, color: '#B91C1C' }}>
                        ⚠️ Attention: Team Squad Allocation Pending
                      </Text>
                      <Text style={{ fontSize: 12, color: '#991B1B', marginTop: 3 }}>
                        The following team(s) have NOT yet submitted their 11 Playing XI players:
                      </Text>
                      <View style={{ marginTop: 6, gap: 4 }}>
                        {inspectionMatch.team_a_allocation_status !== 'SUBMITTED' && (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#DC2626' }}>
                              ❌ {inspectionMatch.team_a_name || inspectionMatch.teamAName || 'Team A'}
                            </Text>
                            <Text style={{ fontSize: 11, color: '#B91C1C', marginLeft: 6 }}>
                              — Coach hasn't selected players yet.
                            </Text>
                          </View>
                        )}
                        {inspectionMatch.team_b_allocation_status !== 'SUBMITTED' && (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#DC2626' }}>
                              ❌ {inspectionMatch.team_b_name || inspectionMatch.teamBName || 'Team B'}
                            </Text>
                            <Text style={{ fontSize: 11, color: '#B91C1C', marginLeft: 6 }}>
                              — Coach hasn't selected players yet.
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )
                )}

                {/* Two Teams Side-by-Side or Stacked */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                  {/* Team A */}
                  <View style={{ flex: 1, minWidth: 280, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', padding: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 8 }}>
                      <Text style={{ fontWeight: '800', fontSize: 14, color: '#0F172A' }}>
                        {inspectionMatch.team_a_name || inspectionMatch.teamAName || 'Team A'}
                      </Text>
                      <View style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 12,
                        backgroundColor: inspectionMatch.team_a_allocation_status === 'SUBMITTED' ? '#DCFCE7' : '#FEF3C7',
                        borderWidth: 1,
                        borderColor: inspectionMatch.team_a_allocation_status === 'SUBMITTED' ? '#86EFAC' : '#FDE68A'
                      }}>
                        <Text style={{
                          fontSize: 11,
                          fontWeight: '800',
                          color: inspectionMatch.team_a_allocation_status === 'SUBMITTED' ? '#166534' : '#B45309'
                        }}>
                          {inspectionMatch.team_a_allocation_status === 'SUBMITTED' ? '✓ SUBMITTED' : '⏳ PENDING'}
                        </Text>
                      </View>
                    </View>

                    {/* Playing XI */}
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#0369A1', marginBottom: 6 }}>
                      PLAYING XI ({(inspectionMatch.team_a_squad_details?.playingXI || []).length}/11)
                    </Text>
                    {(inspectionMatch.team_a_squad_details?.playingXI && inspectionMatch.team_a_squad_details.playingXI.length > 0) ? (
                      inspectionMatch.team_a_squad_details.playingXI.map((pl: any, idx: number) => (
                        <View key={`ta-xi-${pl.id || idx}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                          <Text style={{ width: 22, fontSize: 11, fontWeight: '700', color: '#64748B' }}>{pl.batting_order || idx + 1}.</Text>
                          <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: '#1E293B' }}>{pl.name}</Text>
                          {pl.is_captain && (
                            <View style={{ backgroundColor: '#FEF08A', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, marginRight: 4 }}>
                              <Text style={{ fontSize: 9, fontWeight: '900', color: '#854D0E' }}>C</Text>
                            </View>
                          )}
                          {pl.is_wicket_keeper && (
                            <View style={{ backgroundColor: '#BAE6FD', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, marginRight: 4 }}>
                              <Text style={{ fontSize: 9, fontWeight: '900', color: '#0369A1' }}>WK</Text>
                            </View>
                          )}
                          <Text style={{ fontSize: 10, color: '#64748B' }}>{pl.role}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic', marginVertical: 8 }}>
                        No allocation submitted by team coach yet.
                      </Text>
                    )}

                    {/* Substitutes */}
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748B', marginTop: 12, marginBottom: 6 }}>
                      SUBSTITUTES ({(inspectionMatch.team_a_squad_details?.substitutes || []).length})
                    </Text>
                    {(inspectionMatch.team_a_squad_details?.substitutes && inspectionMatch.team_a_squad_details.substitutes.length > 0) ? (
                      inspectionMatch.team_a_squad_details.substitutes.map((pl: any, idx: number) => (
                        <View key={`ta-sub-${pl.id || idx}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3 }}>
                          <Text style={{ width: 22, fontSize: 11, color: '#94A3B8' }}>•</Text>
                          <Text style={{ flex: 1, fontSize: 12, color: '#334155' }}>{pl.name}</Text>
                          <Text style={{ fontSize: 10, color: '#94A3B8' }}>{pl.role || 'Sub'}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic' }}>None selected</Text>
                    )}
                  </View>

                  {/* Team B */}
                  <View style={{ flex: 1, minWidth: 280, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', padding: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 8 }}>
                      <Text style={{ fontWeight: '800', fontSize: 14, color: '#0F172A' }}>
                        {inspectionMatch.team_b_name || inspectionMatch.teamBName || 'Team B'}
                      </Text>
                      <View style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 12,
                        backgroundColor: inspectionMatch.team_b_allocation_status === 'SUBMITTED' ? '#DCFCE7' : '#FEF3C7',
                        borderWidth: 1,
                        borderColor: inspectionMatch.team_b_allocation_status === 'SUBMITTED' ? '#86EFAC' : '#FDE68A'
                      }}>
                        <Text style={{
                          fontSize: 11,
                          fontWeight: '800',
                          color: inspectionMatch.team_b_allocation_status === 'SUBMITTED' ? '#166534' : '#B45309'
                        }}>
                          {inspectionMatch.team_b_allocation_status === 'SUBMITTED' ? '✓ SUBMITTED' : '⏳ PENDING'}
                        </Text>
                      </View>
                    </View>

                    {/* Playing XI */}
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#0369A1', marginBottom: 6 }}>
                      PLAYING XI ({(inspectionMatch.team_b_squad_details?.playingXI || []).length}/11)
                    </Text>
                    {(inspectionMatch.team_b_squad_details?.playingXI && inspectionMatch.team_b_squad_details.playingXI.length > 0) ? (
                      inspectionMatch.team_b_squad_details.playingXI.map((pl: any, idx: number) => (
                        <View key={`tb-xi-${pl.id || idx}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                          <Text style={{ width: 22, fontSize: 11, fontWeight: '700', color: '#64748B' }}>{pl.batting_order || idx + 1}.</Text>
                          <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: '#1E293B' }}>{pl.name}</Text>
                          {pl.is_captain && (
                            <View style={{ backgroundColor: '#FEF08A', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, marginRight: 4 }}>
                              <Text style={{ fontSize: 9, fontWeight: '900', color: '#854D0E' }}>C</Text>
                            </View>
                          )}
                          {pl.is_wicket_keeper && (
                            <View style={{ backgroundColor: '#BAE6FD', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, marginRight: 4 }}>
                              <Text style={{ fontSize: 9, fontWeight: '900', color: '#0369A1' }}>WK</Text>
                            </View>
                          )}
                          <Text style={{ fontSize: 10, color: '#64748B' }}>{pl.role}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic', marginVertical: 8 }}>
                        No allocation submitted by team coach yet.
                      </Text>
                    )}

                    {/* Substitutes */}
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748B', marginTop: 12, marginBottom: 6 }}>
                      SUBSTITUTES ({(inspectionMatch.team_b_squad_details?.substitutes || []).length})
                    </Text>
                    {(inspectionMatch.team_b_squad_details?.substitutes && inspectionMatch.team_b_squad_details.substitutes.length > 0) ? (
                      inspectionMatch.team_b_squad_details.substitutes.map((pl: any, idx: number) => (
                        <View key={`tb-sub-${pl.id || idx}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3 }}>
                          <Text style={{ width: 22, fontSize: 11, color: '#94A3B8' }}>•</Text>
                          <Text style={{ flex: 1, fontSize: 12, color: '#334155' }}>{pl.name}</Text>
                          <Text style={{ fontSize: 10, color: '#94A3B8' }}>{pl.role || 'Sub'}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic' }}>None selected</Text>
                    )}
                  </View>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setInspectionMatch(null)}
                >
                  <Text style={styles.cancelBtnText}>Close</Text>
                </TouchableOpacity>

                {inspectionMatch.schedule_confirmation_status !== 'CONFIRMED' && (
                  <TouchableOpacity
                    style={[
                      styles.saveBtn,
                      {
                        backgroundColor: (inspectionMatch.team_a_allocation_status === 'SUBMITTED' && inspectionMatch.team_b_allocation_status === 'SUBMITTED') ? '#10B981' : '#94A3B8'
                      }
                    ]}
                    disabled={inspectionMatch.team_a_allocation_status !== 'SUBMITTED' || inspectionMatch.team_b_allocation_status !== 'SUBMITTED'}
                    onPress={async () => {
                      try {
                        await adminApi.confirmMatchSchedule(inspectionMatch.id);
                        showToast('Schedule officially confirmed! Match is now unlocked and visible to official Scorers.', 'success');
                        setInspectionMatch(null);
                        loadData();
                      } catch (err: any) {
                        showToast(err.message || 'Failed to confirm match schedule', 'error');
                      }
                    }}
                  >
                    <Text style={styles.saveBtnText}>
                      ✓ Confirm Schedule & Release to Scorer
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Delete Match Confirmation Dialog */}
      {deleteTarget && (
        <ConfirmDialog
          visible={!!deleteTarget}
          title="Delete Match Fixture"
          message={`Are you sure you want to permanently delete match fixture "${deleteTarget.teamAName || deleteTarget.team_a_name || 'Team A'} vs ${deleteTarget.teamBName || deleteTarget.team_b_name || 'Team B'}" scheduled on ${deleteTarget.match_date || deleteTarget.date || 'TBD'}? All associated records and schedules will be permanently removed.`}
          confirmLabel={isDeleting ? 'Deleting...' : 'Delete Match'}
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  toolbarCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#F8FAFC'
  },
  tabBtnActive: {
    backgroundColor: '#0A2540'
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B'
  },
  tabTextActive: {
    color: '#FFFFFF'
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
  fixtureCell: {
    gap: 4
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  teamBold: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A'
  },
  vsBadge: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600'
  },
  tournamentMeta: {
    fontSize: 11,
    color: '#64748B'
  },
  venueText: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '500'
  },
  groundSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2
  },
  dateText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600'
  },
  timeText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  resultText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
    marginTop: 4
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
    maxWidth: 540,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden'
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
    padding: 20
  },
  fixtureSummary: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16
  },
  fixtureSummaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A2540'
  },
  fixtureSummarySub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
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
  },
  saveBtnDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.6
  },
  validationErrorText: {
    fontSize: 11,
    color: '#DC2626',
    marginTop: 4,
    fontWeight: '500'
  },
  validationBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 6,
    padding: 8,
    marginTop: 6
  },
  validationBannerText: {
    fontSize: 11.5,
    color: '#991B1B',
    fontWeight: '600'
  }
});

export default MatchesPage;
