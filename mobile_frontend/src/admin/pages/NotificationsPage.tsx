/**
 * src/admin/pages/NotificationsPage.tsx
 * Notifications & Announcements Management Page for Cricket Association Professional Admin Panel.
 * Supports dispatching broadcast alerts, official notices, and managing audit dispatches.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput } from 'react-native';
import PageHeader from '../components/PageHeader';
import DataTable, { ColumnDef } from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { NotificationsIcon, PlusIcon, TrashIcon, CheckIcon, CloseIcon } from '../components/Icons';
import { adminApi } from '../services/adminApi';
import { useAdminLayout } from '../components/AdminLayout';

export const NotificationsPage: React.FC = () => {
  const { showToast } = useAdminLayout();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Modal
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('ANNOUNCEMENT');
  const [targetAudience, setTargetAudience] = useState('ALL');

  // Delete Dialog
  const [deleteDialog, setDeleteDialog] = useState<{
    visible: boolean;
    item: any;
  }>({
    visible: false,
    item: null
  });

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getNotifications();
      if (res && res.success) {
        setNotifications(res.notifications || []);
      }
    } catch (e: any) {
      showToast(`Failed to load notifications: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleCreateNotification = async () => {
    if (!title.trim() || !message.trim()) {
      showToast('Title and message are required.', 'error');
      return;
    }

    try {
      await adminApi.createNotification({
        title: title.trim(),
        message: message.trim(),
        type,
        targetAudience
      });
      showToast('Notification published successfully.', 'success');
      setIsCreateMode(false);
      setTitle('');
      setMessage('');
      loadNotifications();
    } catch (e: any) {
      showToast(`Create error: ${e.message}`, 'error');
    }
  };

  const handleMarkRead = async (item: any) => {
    try {
      await adminApi.markNotificationRead(item.id);
      showToast('Notification marked as read.', 'success');
      loadNotifications();
    } catch (e: any) {
      showToast(`Update error: ${e.message}`, 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.item) return;
    try {
      await adminApi.deleteNotification(deleteDialog.item.id);
      showToast('Notification deleted.', 'success');
      setDeleteDialog({ visible: false, item: null });
      loadNotifications();
    } catch (e: any) {
      showToast(`Delete error: ${e.message}`, 'error');
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      header: 'Announcement / Title',
      accessor: (n) => (
        <View style={styles.titleCell}>
          <Text style={[styles.itemTitle, !n.is_read && styles.itemTitleUnread]}>
            {n.title}
          </Text>
          <Text style={styles.itemMessage} numberOfLines={2}>
            {n.message}
          </Text>
        </View>
      )
    },
    {
      header: 'Target Audience',
      accessor: (n) => (
        <span
          style={{
            display: 'inline-block',
            padding: '3px 8px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            backgroundColor: '#F1F5F9',
            color: '#334155'
          }}
        >
          {n.target_audience || 'ALL'}
        </span>
      )
    },
    {
      header: 'Dispatch Type',
      accessor: (n) => (
        <span
          style={{
            display: 'inline-block',
            padding: '3px 8px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            backgroundColor:
              n.type === 'ALERT'
                ? '#FEF2F2'
                : n.type === 'SYSTEM'
                ? '#EFF6FF'
                : '#ECFDF5',
            color:
              n.type === 'ALERT'
                ? '#DC2626'
                : n.type === 'SYSTEM'
                ? '#1D4ED8'
                : '#059669'
          }}
        >
          {n.type || 'NOTICE'}
        </span>
      )
    },
    {
      header: 'Date Published',
      accessor: (n) => (
        <Text style={styles.dateText}>
          {n.created_at ? new Date(n.created_at).toLocaleDateString() : 'Today'}
        </Text>
      )
    },
    {
      header: 'Actions',
      accessor: (n) => (
        <View style={styles.actionRow}>
          {!n.is_read && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleMarkRead(n)}
              accessibilityLabel="Mark as Read"
            >
              <CheckIcon size={14} color="#059669" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => setDeleteDialog({ visible: true, item: n })}
            accessibilityLabel="Delete Announcement"
          >
            <TrashIcon size={14} color="#DC2626" />
          </TouchableOpacity>
        </View>
      )
    }
  ];

  return (
    <View style={styles.container}>
      <PageHeader
        title="Broadcasts & Notifications"
        subtitle="Publish official announcements, tournament bulletins, and alerts to players, scorers, and members."
        breadcrumbs={[
          { label: 'Admin', link: '/admin/dashboard' },
          { label: 'Notifications' }
        ]}
        actions={
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setIsCreateMode(true)}
          >
            <PlusIcon size={16} color="#FFFFFF" />
            <Text style={styles.addBtnText}>New Announcement</Text>
          </TouchableOpacity>
        }
      />

      {/* Notifications Table */}
      <DataTable
        columns={columns}
        data={notifications}
        keyExtractor={(n) => String(n.id)}
        searchable
        searchPlaceholder="Search notifications by title or text..."
        filterKey={(n) => `${n.title} ${n.message} ${n.type}`}
        loading={loading}
        emptyTitle="No announcements published"
        emptyDescription="Broadcast your first notice to affiliated teams and players."
      />

      {/* Create Announcement Modal */}
      {isCreateMode && (
        <Modal transparent animationType="fade" visible>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Publish Official Announcement</Text>
                <TouchableOpacity onPress={() => setIsCreateMode(false)}>
                  <CloseIcon size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Announcement Title *</Text>
                  <TextInput
                    style={styles.input}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g. VPL 2026 Captains Meeting Notice"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Category Type</Text>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
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
                      <option value="ANNOUNCEMENT">Announcement</option>
                      <option value="ALERT">Important Alert</option>
                      <option value="SYSTEM">System Bulletin</option>
                    </select>
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Target Audience</Text>
                    <select
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
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
                      <option value="ALL">All Association Members</option>
                      <option value="SCORERS">Official Scorers Only</option>
                      <option value="PLAYERS">Players & Clubs Only</option>
                    </select>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Message Content *</Text>
                  <TextInput
                    style={styles.textarea}
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Provide details regarding the announcement..."
                    placeholderTextColor="#94A3B8"
                    multiline
                  />
                </View>
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setIsCreateMode(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleCreateNotification}
                >
                  <Text style={styles.saveBtnText}>Broadcast Notice</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        visible={deleteDialog.visible}
        title="Delete Announcement"
        message={`Are you sure you want to delete "${deleteDialog.item?.title}"?`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialog({ visible: false, item: null })}
      />
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
  titleCell: {
    maxWidth: 420
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B'
  },
  itemTitleUnread: {
    fontWeight: '800',
    color: '#0A2540'
  },
  itemMessage: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  },
  dateText: {
    fontSize: 12,
    color: '#64748B'
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
  deleteBtn: {
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
  textarea: {
    height: 90,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    padding: 12,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    textAlignVertical: 'top'
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

export default NotificationsPage;
