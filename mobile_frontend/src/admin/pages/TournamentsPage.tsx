/**
 * src/admin/pages/TournamentsPage.tsx
 * Tournaments Management Page for Cricket Association Professional Admin Panel.
 * Supports viewing district tournaments, creating new leagues, updating dates/status,
 * and checking participation formats.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput } from 'react-native';
import PageHeader from '../components/PageHeader';
import DataTable, { ColumnDef } from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import { TournamentsIcon, PlusIcon, EditIcon, EyeIcon, CloseIcon } from '../components/Icons';
import { adminApi } from '../services/adminApi';
import { useAdminLayout } from '../components/AdminLayout';

export const TournamentsPage: React.FC = () => {
  const { showToast } = useAdminLayout();
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
    setIsAddMode(true);
    setIsEditMode(false);
  };

  const handleOpenEdit = (t: any) => {
    setActiveTournament(t);
    setFormName(t.name || '');
    setFormShortName(t.short_name || '');
    setFormSeason(t.season || '2026');
    setFormFormat(t.format || 'T20');
    setFormOvers(String(t.overs || 20));
    setFormStartDate(t.start_date ? t.start_date.split('T')[0] : '');
    setFormEndDate(t.end_date ? t.end_date.split('T')[0] : '');
    setFormStatus(t.status || 'ACTIVE');
    setIsEditMode(true);
    setIsAddMode(false);
  };

  const handleSaveTournament = async () => {
    if (!formName.trim()) {
      showToast('Tournament name is required.', 'error');
      return;
    }

    try {
      if (isAddMode) {
        await adminApi.createTournament({
          name: formName.trim(),
          shortName: formShortName.trim(),
          season: formSeason,
          format: formFormat,
          overs: parseInt(formOvers, 10) || 20,
          startDate: formStartDate,
          endDate: formEndDate
        });
        showToast('Tournament created successfully.', 'success');
      } else if (isEditMode && activeTournament) {
        await adminApi.updateTournament(activeTournament.id, {
          name: formName.trim(),
          shortName: formShortName.trim(),
          season: formSeason,
          format: formFormat,
          overs: parseInt(formOvers, 10) || 20,
          startDate: formStartDate,
          endDate: formEndDate,
          status: formStatus
        });
        showToast('Tournament updated successfully.', 'success');
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

              <View style={styles.modalBody}>
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

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
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
                    <Text style={styles.fieldLabel}>Season</Text>
                    <TextInput
                      style={styles.input}
                      value={formSeason}
                      onChangeText={setFormSeason}
                      placeholder="2026"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
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
                        outlineStyle: 'none'
                      }}
                    >
                      <option value="T20">T20 (20 Overs)</option>
                      <option value="ODI">One Day (50 Overs)</option>
                      <option value="T10">T10 (10 Overs)</option>
                      <option value="MULTI_DAY">Multi-Day League</option>
                    </select>
                  </View>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
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

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
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
                        outlineStyle: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </View>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
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
                        outlineStyle: 'none',
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
                        outlineStyle: 'none'
                      }}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="UPCOMING">Upcoming</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </View>
                )}
              </View>

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
