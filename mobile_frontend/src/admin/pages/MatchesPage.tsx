/**
 * src/admin/pages/MatchesPage.tsx
 * Matches Management Page for Cricket Association Professional Admin Panel.
 * Supports scheduling fixtures between registered clubs, filtering status
 * (Scheduled, Live, Completed), and recording official match outcomes.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput } from 'react-native';
import PageHeader from '../components/PageHeader';
import DataTable, { ColumnDef } from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import { MatchesIcon, PlusIcon, EditIcon, EyeIcon, CloseIcon } from '../components/Icons';
import { adminApi } from '../services/adminApi';
import { useAdminLayout } from '../components/AdminLayout';

export const MatchesPage: React.FC = () => {
  const { showToast } = useAdminLayout();
  const [matches, setMatches] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
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

  // Edit / Result Modal
  const [activeMatch, setActiveMatch] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState('SCHEDULED');
  const [editResult, setEditResult] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [mRes, tRes, tourRes] = await Promise.all([
        adminApi.getMatches(),
        adminApi.getTeams(),
        adminApi.getTournaments()
      ]);

      if (mRes && mRes.success) {
        setMatches(mRes.matches || []);
      }
      if (tRes && tRes.success) {
        setTeams(tRes.teams || []);
      }
      if (tourRes && tourRes.success) {
        setTournaments(tourRes.tournaments || []);
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

  const handleOpenSchedule = () => {
    const defaultTeamA = teams.length > 0 ? teams[0].id : '';
    const defaultTeamB = teams.length > 1 ? teams[1].id : defaultTeamA;
    setFormTournamentId(tournaments.length > 0 ? tournaments[0].id : 'TOUR-2026');
    setFormTeamA(defaultTeamA);
    setFormTeamB(defaultTeamB);
    setFormVenue('Kamarajar District Stadium, Virudhunagar');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormTime('09:30 AM');
    setFormOvers('20');
    setIsScheduleMode(true);
  };

  const handleOpenEdit = (m: any) => {
    setActiveMatch(m);
    setEditStatus(m.status || 'SCHEDULED');
    setEditResult(m.result || '');
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

  const handleSaveEdit = async () => {
    if (!activeMatch) return;
    try {
      await adminApi.updateMatch(activeMatch.id, {
        status: editStatus,
        resultText: editResult
      });
      showToast('Match updated successfully.', 'success');
      setActiveMatch(null);
      loadData();
    } catch (e: any) {
      showToast(`Update error: ${e.message}`, 'error');
    }
  };

  const filteredMatches = matches.filter((m) => {
    if (statusFilter === 'ALL') return true;
    return (m.status || '').toUpperCase() === statusFilter.toUpperCase();
  });

  const columns: ColumnDef<any>[] = [
    {
      header: 'Fixture',
      accessor: (m) => (
        <View style={styles.fixtureCell}>
          <View style={styles.teamsRow}>
            <Text style={styles.teamBold}>{m.teamAName || 'Team A'}</Text>
            <Text style={styles.vsBadge}>vs</Text>
            <Text style={styles.teamBold}>{m.teamBName || 'Team B'}</Text>
          </View>
          <Text style={styles.tournamentMeta}>
            {m.tournamentName || 'League Match'} • {m.overs || 20} Overs
          </Text>
        </View>
      )
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
        </View>
      )
    },
    {
      header: 'Actions',
      accessor: (m) => (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleOpenEdit(m)}
            accessibilityLabel="Update Score/Status"
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
          {['ALL', 'LIVE', 'SCHEDULED', 'COMPLETED'].map((tab) => (
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
                  <Text style={styles.fieldLabel}>Tournament</Text>
                  <select
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
                      outlineStyle: 'none'
                    }}
                  >
                    {tournaments.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.format})
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
                        outlineStyle: 'none'
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
                        outlineStyle: 'none'
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
                  <Text style={styles.fieldLabel}>Match Ground / Venue</Text>
                  <TextInput
                    style={styles.input}
                    value={formVenue}
                    onChangeText={setFormVenue}
                    placeholder="e.g. Kamarajar Stadium, Virudhunagar"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Date</Text>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        fontSize: 13,
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        color: '#1E293B',
                        width: '100%',
                        outlineStyle: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Start Time</Text>
                    <TextInput
                      style={styles.input}
                      value={formTime}
                      onChangeText={setFormTime}
                      placeholder="e.g. 09:30 AM"
                      placeholderTextColor="#94A3B8"
                    />
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
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSchedule}>
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
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Update Match Details</Text>
                <TouchableOpacity onPress={() => setActiveMatch(null)}>
                  <CloseIcon size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.fixtureSummary}>
                  <Text style={styles.fixtureSummaryTitle}>
                    {activeMatch.teamAName} vs {activeMatch.teamBName}
                  </Text>
                  <Text style={styles.fixtureSummarySub}>{activeMatch.venue}</Text>
                </View>

                <View style={styles.fieldGroup}>
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
                      outlineStyle: 'none'
                    }}
                  >
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="LIVE">Live</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="ABANDONED">Abandoned</option>
                  </select>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Official Result / Note</Text>
                  <TextInput
                    style={styles.input}
                    value={editResult}
                    onChangeText={setEditResult}
                    placeholder="e.g. Aruppukottai won by 24 runs"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setActiveMatch(null)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit}>
                  <Text style={styles.saveBtnText}>Update Fixture</Text>
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
  }
});

export default MatchesPage;
