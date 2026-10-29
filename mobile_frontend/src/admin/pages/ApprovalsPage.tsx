/**
 * src/admin/pages/ApprovalsPage.tsx
 * Approvals Management Page for Cricket Association Professional Admin Panel.
 * Centralized approval queue for official Scorers, Clubs, and Player registrations.
 * Features 1-click Approve/Reject, reason prompt, and real database status updates.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput } from 'react-native';
import PageHeader from '../components/PageHeader';
import DataTable, { ColumnDef } from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { ApprovalsIcon, CheckIcon, CloseIcon, EyeIcon } from '../components/Icons';
import { adminApi } from '../services/adminApi';
import { useAdminLayout } from '../components/AdminLayout';

export const ApprovalsPage: React.FC = () => {
  const { showToast } = useAdminLayout();
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'SCORER' | 'TEAM' | 'UMPIRE' | 'PLAYER'>('ALL');

  // View Modal
  const [activeItem, setActiveItem] = useState<any | null>(null);

  // Approve / Reject Dialog
  const [dialogState, setDialogState] = useState<{
    visible: boolean;
    item: any;
    action: 'approve' | 'reject';
    reason: string;
  }>({
    visible: false,
    item: null,
    action: 'approve',
    reason: ''
  });

  const loadApprovals = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getApprovals();
      if (res && res.success) {
        setApprovals(res.approvals || []);
      }
    } catch (e: any) {
      showToast(`Failed to load approvals: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  const handleOpenActionDialog = (item: any, action: 'approve' | 'reject') => {
    setDialogState({
      visible: true,
      item,
      action,
      reason: ''
    });
  };

  const handleConfirmAction = async () => {
    const { item, action, reason } = dialogState;
    if (!item) return;

    try {
      await adminApi.handleApproval(item.type, item.id, action, reason);
      showToast(
        `${item.applicantName || 'Applicant'} successfully ${action === 'approve' ? 'approved' : 'rejected'}.`,
        'success'
      );
      setDialogState({ visible: false, item: null, action: 'approve', reason: '' });
      loadApprovals();
    } catch (e: any) {
      showToast(`Action failed: ${e.message}`, 'error');
    }
  };

  const filteredItems = approvals.filter((item) => {
    if (activeTab === 'ALL') return true;
    return (item.type || '').toUpperCase() === activeTab;
  });

  const columns: ColumnDef<any>[] = [
    {
      header: 'Applicant',
      accessor: (item) => (
        <View style={styles.applicantCell}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {(item.applicantName || 'A').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.applicantName}>{item.applicantName}</Text>
            <Text style={styles.applicantMeta}>
              {item.contact || 'No email provided'} • {item.phone || '-'}
            </Text>
          </View>
        </View>
      )
    },
    {
      header: 'Application Type',
      accessor: (item) => {
        const typeNorm = (item.type || '').toUpperCase();
        const isScorer = typeNorm === 'SCORER';
        const isTeam = typeNorm === 'TEAM';
        const isUmpire = typeNorm === 'UMPIRE';
        return (
          <span
            style={{
              display: 'inline-block',
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.04em',
              backgroundColor: isScorer
                ? '#EFF6FF'
                : isTeam
                ? '#FDF2F8'
                : isUmpire
                ? '#FEF3C7'
                : '#F0FDF4',
              color: isScorer
                ? '#1D4ED8'
                : isTeam
                ? '#BE185D'
                : isUmpire
                ? '#B45309'
                : '#15803D'
            }}
          >
            {isScorer
              ? 'OFFICIAL SCORER'
              : isTeam
              ? 'CLUB / TEAM'
              : isUmpire
              ? 'OFFICIAL UMPIRE'
              : 'PLAYER REGISTRATION'}
          </span>
        );
      }
    },
    {
      header: 'Affiliation / Club',
      accessor: (item) => (
        <Text style={styles.associationText}>
          {item.association || 'District Cricket Association'}
        </Text>
      )
    },
    {
      header: 'Submitted Date',
      accessor: (item) => (
        <Text style={styles.dateText}>
          {item.date ? new Date(item.date).toLocaleDateString() : 'Recent'}
        </Text>
      )
    },
    {
      header: 'Status',
      accessor: (item) => <StatusBadge status={item.status || 'PENDING'} />
    },
    {
      header: 'Actions',
      accessor: (item) => (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setActiveItem(item)}
            accessibilityLabel="View Details"
          >
            <EyeIcon size={14} color="#475569" />
          </TouchableOpacity>

          {(item.status === 'PENDING' || !item.status) && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, styles.approveBtn]}
                onPress={() => handleOpenActionDialog(item, 'approve')}
                accessibilityLabel="Approve"
              >
                <CheckIcon size={14} color="#059669" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => handleOpenActionDialog(item, 'reject')}
                accessibilityLabel="Reject"
              >
                <CloseIcon size={14} color="#DC2626" />
              </TouchableOpacity>
            </>
          )}
        </View>
      )
    }
  ];

  return (
    <View style={styles.container}>
      <PageHeader
        title="Approvals Management"
        subtitle="Review, approve, or reject incoming applications for official scorers, clubs, and registered players."
        breadcrumbs={[
          { label: 'Admin', link: '/admin/dashboard' },
          { label: 'Approvals' }
        ]}
      />

      {/* Tabs Toolbar */}
      <View style={styles.toolbarCard}>
        <View style={styles.tabsRow}>
          {[
            { id: 'ALL', label: 'All Applications' },
            { id: 'SCORER', label: 'Official Scorers' },
            { id: 'TEAM', label: 'Clubs / Teams' },
            { id: 'UMPIRE', label: 'Umpires' },
            { id: 'PLAYER', label: 'Players' }
          ].map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[
                styles.tabBtn,
                activeTab === t.id && styles.tabBtnActive
              ]}
              onPress={() => setActiveTab(t.id as any)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === t.id && styles.tabTextActive
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Approvals Data Table */}
      <DataTable
        columns={columns}
        data={filteredItems}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        searchable
        searchPlaceholder="Search by applicant name, contact, or club..."
        filterKey={(item) => `${item.applicantName} ${item.contact} ${item.association}`}
        pageSize={10}
        loading={loading}
        emptyTitle="No pending approvals"
        emptyDescription="All incoming affiliation applications have been processed."
      />

      {/* View Applicant Modal */}
      {activeItem && (
        <Modal transparent animationType="fade" visible>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <ApprovalsIcon size={20} color="#0A2540" />
                  <Text style={styles.modalTitle}>Application Details</Text>
                </View>
                <TouchableOpacity onPress={() => setActiveItem(null)}>
                  <CloseIcon size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.headerInfo}>
                  <View style={styles.applicantAvatarBig}>
                    <Text style={styles.avatarBigText}>
                      {(activeItem.applicantName || 'A').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.applicantBigTitle}>{activeItem.applicantName}</Text>
                    <Text style={styles.applicantBigSub}>
                      {activeItem.type} Application
                    </Text>
                  </View>
                </View>

                <View style={styles.detailGrid}>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailBoxLabel}>Email Contact</Text>
                    <Text style={styles.detailBoxValue}>{activeItem.contact || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailBoxLabel}>Phone Number</Text>
                    <Text style={styles.detailBoxValue}>{activeItem.phone || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailBoxLabel}>Club / Body</Text>
                    <Text style={styles.detailBoxValue}>{activeItem.association || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailBoxLabel}>Application Status</Text>
                    <View style={{ marginTop: 4 }}>
                      <StatusBadge status={activeItem.status || 'PENDING'} />
                    </View>
                  </View>
                  {(activeItem.qualification || activeItem.certificationLevel) && (
                    <View style={styles.detailBox}>
                      <Text style={styles.detailBoxLabel}>Certification / Level</Text>
                      <Text style={styles.detailBoxValue}>{activeItem.qualification || activeItem.certificationLevel}</Text>
                    </View>
                  )}
                </View>

                {activeItem.rejectionReason && (
                  <View style={styles.reasonNotice}>
                    <Text style={styles.reasonNoticeTitle}>Rejection Reason:</Text>
                    <Text style={styles.reasonNoticeText}>{activeItem.rejectionReason}</Text>
                  </View>
                )}
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setActiveItem(null)}
                >
                  <Text style={styles.cancelBtnText}>Close</Text>
                </TouchableOpacity>

                {activeItem.status === 'PENDING' && (
                  <>
                    <TouchableOpacity
                      style={[styles.footerActionBtn, styles.rejectFooterBtn]}
                      onPress={() => {
                        setActiveItem(null);
                        handleOpenActionDialog(activeItem, 'reject');
                      }}
                    >
                      <Text style={styles.rejectFooterText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.footerActionBtn, styles.approveFooterBtn]}
                      onPress={() => {
                        setActiveItem(null);
                        handleOpenActionDialog(activeItem, 'approve');
                      }}
                    >
                      <Text style={styles.approveFooterText}>Approve</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Confirmation Dialog with Reason Field for Reject */}
      {dialogState.visible && (
        <Modal transparent animationType="fade" visible>
          <View style={styles.modalOverlay}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>
                {dialogState.action === 'approve'
                  ? 'Confirm Approval'
                  : 'Confirm Rejection'}
              </Text>
              <Text style={styles.confirmMsg}>
                Are you sure you want to{' '}
                <Text style={{ fontWeight: '700' }}>{dialogState.action}</Text> the
                application for{' '}
                <Text style={{ fontWeight: '700' }}>
                  {dialogState.item?.applicantName}
                </Text>
                ?
              </Text>

              {dialogState.action === 'reject' && (
                <View style={{ marginTop: 14 }}>
                  <Text style={styles.fieldLabel}>
                    Reason for rejection (optional):
                  </Text>
                  <TextInput
                    style={styles.reasonInput}
                    value={dialogState.reason}
                    onChangeText={(t) =>
                      setDialogState({ ...dialogState, reason: t })
                    }
                    placeholder="e.g. Incomplete credentials or missing district documents"
                    placeholderTextColor="#94A3B8"
                    multiline
                  />
                </View>
              )}

              <View style={styles.confirmActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() =>
                    setDialogState({
                      visible: false,
                      item: null,
                      action: 'approve',
                      reason: ''
                    })
                  }
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.confirmExecuteBtn,
                    dialogState.action === 'reject'
                      ? styles.confirmRejectBtn
                      : styles.confirmApproveBtn
                  ]}
                  onPress={handleConfirmAction}
                >
                  <Text style={styles.confirmExecuteText}>
                    {dialogState.action === 'approve'
                      ? 'Confirm Approve'
                      : 'Confirm Reject'}
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
    flexWrap: 'wrap',
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
  applicantCell: {
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
  applicantName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A'
  },
  applicantMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  associationText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500'
  },
  dateText: {
    fontSize: 12,
    color: '#64748B'
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
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
  approveBtn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0'
  },
  rejectBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA'
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
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 16
  },
  applicantAvatarBig: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0A2540',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarBigText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  applicantBigTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A'
  },
  applicantBigSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12
  } as any,
  detailBox: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  detailBoxLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  detailBoxValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 3
  },
  reasonNotice: {
    marginTop: 16,
    padding: 12,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  reasonNoticeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626'
  },
  reasonNoticeText: {
    fontSize: 12,
    color: '#991B1B',
    marginTop: 4
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
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
  footerActionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6
  },
  rejectFooterBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  rejectFooterText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 13
  },
  approveFooterBtn: {
    backgroundColor: '#0A2540'
  },
  approveFooterText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13
  },
  confirmCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A2540'
  },
  confirmMsg: {
    fontSize: 13,
    color: '#475569',
    marginTop: 8,
    lineHeight: 20
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6
  },
  reasonInput: {
    height: 60,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    padding: 10,
    fontSize: 12,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    textAlignVertical: 'top'
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20
  },
  confirmExecuteBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 6
  },
  confirmApproveBtn: {
    backgroundColor: '#0A2540'
  },
  confirmRejectBtn: {
    backgroundColor: '#DC2626'
  },
  confirmExecuteText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});

export default ApprovalsPage;
