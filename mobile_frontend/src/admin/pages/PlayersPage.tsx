/**
 * src/admin/pages/PlayersPage.tsx
 * Players Management Page for Cricket Association Professional Admin Panel.
 * Supports filtering by district, team, role, status; searching; viewing player profile;
 * editing details; and adding new players.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput } from 'react-native';
import PageHeader from '../components/PageHeader';
import DataTable, { ColumnDef } from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { PlusIcon, EditIcon, EyeIcon, CloseIcon, CricketBatIcon } from '../components/Icons';
import { adminApi } from '../services/adminApi';
import { useAdminLayout } from '../components/AdminLayout';

export const PlayersPage: React.FC = () => {
  const { showToast } = useAdminLayout();
  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [teamFilter, setTeamFilter] = useState('ALL');

  // View / Edit / Add Modals
  const [activePlayer, setActivePlayer] = useState<any | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formTeamId, setFormTeamId] = useState('');
  const [formRole, setFormRole] = useState('BATTER');
  const [formJersey, setFormJersey] = useState('');
  const [formBattingStyle, setFormBattingStyle] = useState('RIGHT_HAND');
  const [formBowlingStyle, setFormBowlingStyle] = useState('RIGHT_ARM_MEDIUM');
  const [formStatus, setFormStatus] = useState('ACTIVE');

  const loadData = async () => {
    setLoading(true);
    try {
      const [pRes, tRes] = await Promise.all([
        adminApi.getPlayers({
          role: roleFilter !== 'ALL' ? roleFilter : undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          team: teamFilter !== 'ALL' ? teamFilter : undefined
        }),
        adminApi.getTeams()
      ]);

      if (pRes && pRes.success) {
        setPlayers(pRes.players || []);
      }
      if (tRes && tRes.success) {
        setTeams(tRes.teams || []);
      }
    } catch (e: any) {
      showToast(`Failed to load players: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [roleFilter, statusFilter, teamFilter]);

  const handleOpenView = (p: any) => {
    setActivePlayer(p);
    setIsEditMode(false);
    setIsAddMode(false);
  };

  const handleOpenEdit = (p: any) => {
    setActivePlayer(p);
    setFormName(p.name || '');
    setFormTeamId(p.teamId || '');
    setFormRole(p.role || 'BATTER');
    setFormJersey(p.jersey && p.jersey !== '-' ? String(p.jersey) : '');
    setFormBattingStyle(p.battingStyle || 'RIGHT_HAND');
    setFormBowlingStyle(p.bowlingStyle || 'RIGHT_ARM_MEDIUM');
    setFormStatus(p.status || 'ACTIVE');
    setIsEditMode(true);
    setIsAddMode(false);
  };

  const handleOpenAdd = () => {
    setActivePlayer(null);
    setFormName('');
    setFormTeamId(teams.length > 0 ? teams[0].id : '');
    setFormRole('BATTER');
    setFormJersey('');
    setFormBattingStyle('RIGHT_HAND');
    setFormBowlingStyle('RIGHT_ARM_MEDIUM');
    setFormStatus('ACTIVE');
    setIsAddMode(true);
    setIsEditMode(false);
  };

  const handleSaveForm = async () => {
    if (!formName.trim()) {
      showToast('Player name is required.', 'error');
      return;
    }

    try {
      if (isAddMode) {
        await adminApi.createPlayer({
          name: formName.trim(),
          teamId: formTeamId,
          role: formRole,
          jerseyNumber: formJersey ? parseInt(formJersey, 10) : null,
          battingStyle: formBattingStyle,
          bowlingStyle: formBowlingStyle
        });
        showToast('Player registered successfully.', 'success');
      } else if (isEditMode && activePlayer) {
        await adminApi.updatePlayer(activePlayer.id, {
          name: formName.trim(),
          teamId: formTeamId,
          role: formRole,
          jerseyNumber: formJersey ? parseInt(formJersey, 10) : null,
          battingStyle: formBattingStyle,
          bowlingStyle: formBowlingStyle,
          status: formStatus
        });
        showToast('Player details updated successfully.', 'success');
      }
      setIsAddMode(false);
      setIsEditMode(false);
      setActivePlayer(null);
      loadData();
    } catch (e: any) {
      showToast(`Save failed: ${e.message}`, 'error');
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      header: 'Player',
      accessor: (p) => (
        <View style={styles.playerCell}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {(p.name || 'P').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.playerName}>{p.name}</Text>
            <Text style={styles.playerMeta}>
              Jersey #{p.jersey || '-'} • {p.battingStyle ? p.battingStyle.replace('_', ' ') : 'RHB'}
            </Text>
          </View>
        </View>
      )
    },
    {
      header: 'Team / Club',
      accessor: (p) => (
        <View>
          <Text style={styles.teamName}>{p.teamName || 'Unassigned'}</Text>
          <Text style={styles.districtText}>Virudhunagar Dist.</Text>
        </View>
      )
    },
    {
      header: 'Discipline',
      accessor: (p) => (
        <span
          style={{
            display: 'inline-block',
            padding: '3px 8px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.04em',
            backgroundColor: '#EFF6FF',
            color: '#1D4ED8',
            border: '1px solid #BFDBFE'
          }}
        >
          {(p.role || 'BATTER').replace('_', ' ')}
        </span>
      )
    },
    {
      header: 'Status',
      accessor: (p) => <StatusBadge status={p.status || 'ACTIVE'} />
    },
    {
      header: 'Actions',
      accessor: (p) => (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleOpenView(p)}
            accessibilityLabel="View Details"
          >
            <EyeIcon size={15} color="#475569" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleOpenEdit(p)}
            accessibilityLabel="Edit Player"
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
        title="Players Registry"
        subtitle="Manage affiliated cricket players, team assignments, discipline, and statuses."
        breadcrumbs={[
          { label: 'Admin', link: '/admin/dashboard' },
          { label: 'Players' }
        ]}
        actions={
          <TouchableOpacity style={styles.addBtn} onPress={handleOpenAdd}>
            <PlusIcon size={16} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Add New Player</Text>
          </TouchableOpacity>
        }
      />

      {/* Filter Toolbar */}
      <View style={styles.toolbarCard}>
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Discipline:</Text>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              fontSize: 13,
              borderRadius: 6,
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              cursor: 'pointer',
              outlineStyle: 'none'
            }}
          >
            <option value="ALL">All Disciplines</option>
            <option value="BATTER">Batter</option>
            <option value="BOWLER">Bowler</option>
            <option value="ALL_ROUNDER">All-Rounder</option>
            <option value="WICKET_KEEPER">Wicket Keeper</option>
          </select>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Team:</Text>
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              fontSize: 13,
              borderRadius: 6,
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              cursor: 'pointer',
              outlineStyle: 'none',
              maxWidth: 220
            }}
          >
            <option value="ALL">All Teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Status:</Text>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              fontSize: 13,
              borderRadius: 6,
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              cursor: 'pointer',
              outlineStyle: 'none'
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </View>

        {(roleFilter !== 'ALL' || statusFilter !== 'ALL' || teamFilter !== 'ALL') && (
          <TouchableOpacity
            style={styles.resetFiltersBtn}
            onPress={() => {
              setRoleFilter('ALL');
              setStatusFilter('ALL');
              setTeamFilter('ALL');
            }}
          >
            <Text style={styles.resetFiltersText}>Reset Filters</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Players Data Table */}
      <DataTable
        columns={columns}
        data={players}
        keyExtractor={(p) => String(p.id)}
        searchable
        searchPlaceholder="Search player by name, team, or jersey..."
        filterKey={(p) => `${p.name} ${p.teamName} ${p.jersey} ${p.role}`}
        pageSize={12}
        loading={loading}
        emptyTitle="No players found"
        emptyDescription="No registered cricket players match your search criteria."
      />

      {/* View Player Details Modal */}
      {activePlayer && !isEditMode && !isAddMode && (
        <Modal transparent animationType="fade" visible>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <CricketBatIcon size={20} color="#0A2540" />
                  <Text style={styles.modalTitle}>Player Profile Details</Text>
                </View>
                <TouchableOpacity onPress={() => setActivePlayer(null)}>
                  <CloseIcon size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.profileHeaderSection}>
                  <View style={styles.profileAvatarBig}>
                    <Text style={styles.profileAvatarText}>
                      {(activePlayer.name || 'P').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.profileName}>{activePlayer.name}</Text>
                    <Text style={styles.profileTeam}>{activePlayer.teamName}</Text>
                    <View style={{ marginTop: 6 }}>
                      <StatusBadge status={activePlayer.status || 'ACTIVE'} />
                    </View>
                  </View>
                </View>

                <View style={styles.detailGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Discipline</Text>
                    <Text style={styles.detailValue}>{(activePlayer.role || 'BATTER').replace('_', ' ')}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Jersey Number</Text>
                    <Text style={styles.detailValue}>#{activePlayer.jersey || '-'}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Batting Style</Text>
                    <Text style={styles.detailValue}>{activePlayer.battingStyle || 'RIGHT_HAND'}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Bowling Style</Text>
                    <Text style={styles.detailValue}>{activePlayer.bowlingStyle || 'NONE'}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>District</Text>
                    <Text style={styles.detailValue}>Virudhunagar</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Affiliation</Text>
                    <Text style={styles.detailValue}>District Cricket Association</Text>
                  </View>
                </View>
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setActivePlayer(null)}
                >
                  <Text style={styles.cancelBtnText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={() => handleOpenEdit(activePlayer)}
                >
                  <Text style={styles.saveBtnText}>Edit Player</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Add / Edit Player Modal */}
      {(isAddMode || isEditMode) && (
        <Modal transparent animationType="fade" visible>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isAddMode ? 'Register New Player' : 'Edit Player Details'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setIsAddMode(false);
                    setIsEditMode(false);
                    setActivePlayer(null);
                  }}
                >
                  <CloseIcon size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Full Name *</Text>
                  <TextInput
                    style={styles.input}
                    value={formName}
                    onChangeText={setFormName}
                    placeholder="e.g. S. Ravichandran"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Assigned Team</Text>
                    <select
                      value={formTeamId}
                      onChange={(e) => setFormTeamId(e.target.value)}
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
                      <option value="">No Team (District Pool)</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Discipline</Text>
                    <select
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value)}
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
                      <option value="BATTER">Batter</option>
                      <option value="BOWLER">Bowler</option>
                      <option value="ALL_ROUNDER">All-Rounder</option>
                      <option value="WICKET_KEEPER">Wicket Keeper</option>
                    </select>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Jersey Number</Text>
                    <TextInput
                      style={styles.input}
                      value={formJersey}
                      onChangeText={setFormJersey}
                      placeholder="e.g. 18"
                      keyboardType="numeric"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
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
                      <option value="PENDING">Pending</option>
                      <option value="SUSPENDED">Suspended</option>
                    </select>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Batting Style</Text>
                    <select
                      value={formBattingStyle}
                      onChange={(e) => setFormBattingStyle(e.target.value)}
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
                      <option value="RIGHT_HAND">Right-Hand Bat</option>
                      <option value="LEFT_HAND">Left-Hand Bat</option>
                    </select>
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Bowling Style</Text>
                    <select
                      value={formBowlingStyle}
                      onChange={(e) => setFormBowlingStyle(e.target.value)}
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
                      <option value="NONE">None</option>
                      <option value="RIGHT_ARM_FAST">Right-Arm Fast</option>
                      <option value="RIGHT_ARM_MEDIUM">Right-Arm Medium</option>
                      <option value="RIGHT_ARM_SPIN">Right-Arm Spin (Off/Leg)</option>
                      <option value="LEFT_ARM_FAST">Left-Arm Fast</option>
                      <option value="LEFT_ARM_SPIN">Left-Arm Spin</option>
                    </select>
                  </View>
                </View>
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setIsAddMode(false);
                    setIsEditMode(false);
                    setActivePlayer(null);
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveForm}>
                  <Text style={styles.saveBtnText}>
                    {isAddMode ? 'Create Player' : 'Save Changes'}
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
  toolbarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B'
  },
  resetFiltersBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#F1F5F9'
  },
  resetFiltersText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600'
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
  playerCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0A2540',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  playerName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A'
  },
  playerMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  teamName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1E293B'
  },
  districtText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2
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
  profileHeaderSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 16
  },
  profileAvatarBig: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0A2540',
    justifyContent: 'center',
    alignItems: 'center'
  },
  profileAvatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A'
  },
  profileTeam: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 14
  } as any,
  detailItem: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  detailLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 4
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

export default PlayersPage;
