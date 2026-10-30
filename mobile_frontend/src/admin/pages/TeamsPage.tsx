/**
 * src/admin/pages/TeamsPage.tsx
 * Teams & Clubs Management Page for Cricket Association Professional Admin Panel.
 * Supports viewing affiliated clubs, coach info, full 15-player squad rosters,
 * status changes (ACTIVE, PENDING, REJECTED), and search.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import PageHeader from '../components/PageHeader';
import DataTable, { ColumnDef } from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { TeamsIcon, EyeIcon, EditIcon, CloseIcon, CricketBatIcon, UsersIcon } from '../components/Icons';
import { adminApi } from '../services/adminApi';
import { useAdminLayout } from '../components/AdminLayout';

export const TeamsPage: React.FC = () => {
  const { showToast } = useAdminLayout();
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // View Squad / Team Detail Modal
  const [activeTeamDetail, setActiveTeamDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Status Action Dialog
  const [statusDialog, setStatusDialog] = useState<{
    visible: boolean;
    team: any;
    targetStatus: string;
  }>({
    visible: false,
    team: null,
    targetStatus: ''
  });

  const loadTeams = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getTeams({
        status: statusFilter !== 'ALL' ? statusFilter : undefined
      });
      if (res && res.success) {
        setTeams(res.teams || []);
      }
    } catch (e: any) {
      showToast(`Failed to load teams: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
  }, [statusFilter]);

  const handleOpenDetail = async (t: any) => {
    setLoadingDetail(true);
    setActiveTeamDetail(t);
    try {
      const res = await adminApi.getTeamById(t.id);
      if (res && res.success) {
        setActiveTeamDetail(res.team);
      }
    } catch (e: any) {
      showToast(`Could not fetch team roster: ${e.message}`, 'error');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleTriggerStatusChange = (team: any, targetStatus: string) => {
    setStatusDialog({
      visible: true,
      team,
      targetStatus
    });
  };

  const handleConfirmStatusChange = async () => {
    if (!statusDialog.team || !statusDialog.targetStatus) return;
    try {
      await adminApi.updateTeamStatus(statusDialog.team.id, statusDialog.targetStatus);
      showToast(`Team status updated to ${statusDialog.targetStatus}.`, 'success');
      setStatusDialog({ visible: false, team: null, targetStatus: '' });
      loadTeams();
      if (activeTeamDetail && activeTeamDetail.id === statusDialog.team.id) {
        setActiveTeamDetail({ ...activeTeamDetail, status: statusDialog.targetStatus });
      }
    } catch (e: any) {
      showToast(`Status update failed: ${e.message}`, 'error');
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      header: 'Team / Club',
      accessor: (t) => (
        <View style={styles.teamCell}>
          <View style={styles.teamBadge}>
            <Text style={styles.teamBadgeText}>
              {(t.shortName || (t.name ? t.name.slice(0, 3) : 'CC')).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.teamName}>{t.name}</Text>
            <Text style={styles.teamSub}>
              {t.city || 'Virudhunagar'} • Reg #{t.teamId || t.id}
            </Text>
          </View>
        </View>
      )
    },
    {
      header: 'Coach / Manager',
      accessor: (t) => (
        <View>
          <Text style={styles.coachName}>{t.coachName || 'Staff Coach'}</Text>
          <Text style={styles.coachEmail}>{t.coachEmail || 'team@cfvd.org'}</Text>
        </View>
      )
    },
    {
      header: 'Squad Size',
      accessor: (t) => (
        <View style={styles.squadBadge}>
          <UsersIcon size={14} color="#0A2540" />
          <Text style={styles.squadText}>{t.playerCount || 15} Players</Text>
        </View>
      )
    },
    {
      header: 'Affiliation Status',
      accessor: (t) => <StatusBadge status={t.status || 'ACTIVE'} />
    },
    {
      header: 'Actions',
      accessor: (t) => (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleOpenDetail(t)}
            accessibilityLabel="View Squad Roster"
          >
            <EyeIcon size={15} color="#475569" />
          </TouchableOpacity>
          {t.status === 'PENDING' ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => handleTriggerStatusChange(t, 'ACTIVE')}
              accessibilityLabel="Approve Team"
            >
              <Text style={styles.approveBtnText}>Approve</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() =>
                handleTriggerStatusChange(
                  t,
                  t.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
                )
              }
              accessibilityLabel="Toggle Status"
            >
              <EditIcon size={14} color="#0284C7" />
            </TouchableOpacity>
          )}
        </View>
      )
    }
  ];

  return (
    <View style={styles.container}>
      <PageHeader
        title="Teams & Clubs"
        subtitle="Manage participating cricket clubs, affiliated rosters, coach contacts, and official approvals."
        breadcrumbs={[
          { label: 'Admin', link: '/admin/dashboard' },
          { label: 'Teams & Clubs' }
        ]}
      />

      {/* Filter Toolbar */}
      <View style={styles.toolbarCard}>
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
            <option value="ACTIVE">Active Affiliated</option>
            <option value="PENDING">Pending Approval</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </View>

        {statusFilter !== 'ALL' && (
          <TouchableOpacity
            style={styles.resetFiltersBtn}
            onPress={() => setStatusFilter('ALL')}
          >
            <Text style={styles.resetFiltersText}>Reset Filter</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Teams Data Table */}
      <DataTable
        columns={columns}
        data={teams}
        keyExtractor={(t) => String(t.id)}
        searchable
        searchPlaceholder="Search team by name, short code, city, or coach..."
        filterKey={(t) => `${t.name} ${t.shortName} ${t.city} ${t.coachName}`}
        pageSize={10}
        loading={loading}
        emptyTitle="No clubs found"
        emptyDescription="No registered cricket clubs match your filter."
      />

      {/* View Squad Roster Modal */}
      {activeTeamDetail && (
        <Modal transparent animationType="fade" visible>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <TeamsIcon size={20} color="#0A2540" />
                  <Text style={styles.modalTitle}>{activeTeamDetail.name}</Text>
                </View>
                <TouchableOpacity onPress={() => setActiveTeamDetail(null)}>
                  <CloseIcon size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                {/* Team Info Strip */}
                <View style={styles.teamInfoBanner}>
                  <View>
                    <Text style={styles.bannerLabel}>City / Base</Text>
                    <Text style={styles.bannerValue}>
                      {activeTeamDetail.city || 'Virudhunagar'}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.bannerLabel}>Coach / Manager</Text>
                    <Text style={styles.bannerValue}>
                      {activeTeamDetail.coachName || 'Staff Coach'}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.bannerLabel}>Official Status</Text>
                    <View style={{ marginTop: 2 }}>
                      <StatusBadge status={activeTeamDetail.status || 'ACTIVE'} />
                    </View>
                  </View>
                </View>

                <View style={{ marginTop: 16 }}>
                  <Text style={styles.squadTitle}>
                    Affiliated Squad Roster ({(activeTeamDetail.squad || []).length} Players)
                  </Text>
                  {loadingDetail ? (
                    <Text style={styles.loadingSquadText}>Loading player squad...</Text>
                  ) : (activeTeamDetail.squad || []).length === 0 ? (
                    <View style={styles.emptySquad}>
                      <Text style={styles.emptySquadText}>
                        No players assigned directly yet.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.squadList}>
                      {(activeTeamDetail.squad || []).map((player: any, idx: number) => (
                        <View key={player.id || idx} style={styles.squadItem}>
                          <View style={styles.squadNumber}>
                            <Text style={styles.squadNumberText}>
                              {player.jersey ? `#${player.jersey}` : `${idx + 1}`}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.squadPlayerName}>{player.name}</Text>
                            <Text style={styles.squadPlayerRole}>
                              {(player.role || 'ALL_ROUNDER').replace('_', ' ')}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setActiveTeamDetail(null)}
                >
                  <Text style={styles.cancelBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Confirm Status Change Dialog */}
      <ConfirmDialog
        visible={statusDialog.visible}
        title="Confirm Status Change"
        message={`Are you sure you want to mark "${statusDialog.team?.name}" as ${statusDialog.targetStatus}?`}
        confirmLabel="Confirm"
        variant={statusDialog.targetStatus === 'SUSPENDED' ? 'danger' : 'primary'}
        onConfirm={handleConfirmStatusChange}
        onCancel={() => setStatusDialog({ visible: false, team: null, targetStatus: '' })}
      />
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
  teamCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  teamBadge: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center'
  },
  teamBadgeText: {
    color: '#0A2540',
    fontSize: 13,
    fontWeight: '800'
  },
  teamName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A'
  },
  teamSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  coachName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B'
  },
  coachEmail: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  squadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignSelf: 'flex-start'
  },
  squadText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0A2540'
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  actionBtn: {
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  approveBtn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0'
  },
  approveBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669'
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
    maxWidth: 620,
    maxHeight: '85%',
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
    padding: 20,
    overflow: 'scroll'
  } as any,
  teamInfoBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  bannerLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  bannerValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 3
  },
  squadTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A2540',
    marginBottom: 10
  },
  loadingSquadText: {
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic',
    padding: 12
  },
  emptySquad: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 6
  },
  emptySquadText: {
    fontSize: 13,
    color: '#64748B'
  },
  squadList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8
  } as any,
  squadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF'
  },
  squadNumber: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#0A2540',
    justifyContent: 'center',
    alignItems: 'center'
  },
  squadNumberText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700'
  },
  squadPlayerName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A'
  },
  squadPlayerRole: {
    fontSize: 10,
    color: '#64748B',
    textTransform: 'uppercase'
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
  }
});

export default TeamsPage;
