/**
 * src/admin/pages/AdminsPage.tsx
 * Super Admin - Administrators Management Page
 * List all administrators, add new admins, and delete dynamic admins.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions
} from 'react-native';
import PageHeader from '../components/PageHeader';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PlusIcon, EditIcon, TrashIcon, SearchIcon, RefreshIcon, CloseIcon, ShieldIcon } from '../components/Icons';
import { Ionicons } from '@expo/vector-icons';
import { adminApi, getStoredAdminUser } from '../services/adminApi';
import { useAdminLayout } from '../components/AdminLayout';
import { showSuccess, showError } from '../../utils/sweetalert';

export const AdminsPage: React.FC = () => {
  const { showToast } = useAdminLayout();
  const adminUser = getStoredAdminUser();
  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    try { showToast(msg, type); } catch (_e) {}
    if (type === 'success') showSuccess('Success', msg);
    else showError('Error', msg);
  };
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Add / Edit Admin Modal
  const [addOpen, setAddOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<any | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formLevel, setFormLevel] = useState('District Administrator');
  const [formStatus, setFormStatus] = useState('ACTIVE');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Confirm
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAdmins = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAdministrators();
      if (res && res.success) {
        setAdmins(res.administrators || []);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to load administrators', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const filteredAdmins = admins.filter(a => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (a.name || '').toLowerCase().includes(q) ||
      (a.email || '').toLowerCase().includes(q) ||
      (a.admin_level || '').toLowerCase().includes(q)
    );
  });

  const handleOpenAdd = () => {
    setEditingAdmin(null);
    setFormName('');
    setFormEmail('');
    setFormMobile('');
    setFormPassword('');
    setFormLevel('District Administrator');
    setFormStatus('ACTIVE');
    setFormError(null);
    setAddOpen(true);
  };

  const handleOpenEdit = (admin: any) => {
    setEditingAdmin(admin);
    setFormName(admin.name || '');
    setFormEmail(admin.email || '');
    setFormMobile(admin.mobile || '');
    setFormPassword('');
    setFormLevel(admin.admin_level || 'District Administrator');
    setFormStatus(admin.status || 'ACTIVE');
    setFormError(null);
    setAddOpen(true);
  };

  const handleSaveAdmin = async () => {
    if (!formName.trim()) {
      setFormError('Administrator name is required.');
      return;
    }
    if (!formEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail.trim())) {
      setFormError('Valid email address is required.');
      return;
    }
    if (!editingAdmin && (!formPassword.trim() || formPassword.trim().length < 6)) {
      setFormError('Password must be at least 6 characters.');
      return;
    }
    if (editingAdmin && formPassword.trim().length > 0 && formPassword.trim().length < 6) {
      setFormError('New password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      if (editingAdmin) {
        const res = await adminApi.updateAdministrator(editingAdmin.id, {
          name: formName.trim(),
          email: formEmail.trim().toLowerCase(),
          mobile: formMobile.trim(),
          admin_level: formLevel.trim() || 'District Administrator',
          status: formStatus,
          ...(formPassword.trim() ? { password: formPassword.trim() } : {})
        });
        if (res?.success) {
          notify(res.message || 'Administrator updated successfully!', 'success');
          setAddOpen(false);
          setEditingAdmin(null);
          await loadAdmins();
        } else {
          setFormError(res?.message || 'Failed to update administrator.');
        }
      } else {
        const res = await adminApi.createAdministrator({
          name: formName.trim(),
          email: formEmail.trim().toLowerCase(),
          mobile: formMobile.trim(),
          password: formPassword.trim(),
          admin_level: formLevel.trim() || 'District Administrator'
        });
        if (res?.success) {
          notify(res.message || 'Administrator added successfully!', 'success');
          setAddOpen(false);
          await loadAdmins();
        } else {
          setFormError(res?.message || 'Failed to add administrator.');
        }
      }
    } catch (err: any) {
      setFormError(err?.message || (editingAdmin ? 'Failed to update administrator.' : 'Failed to add administrator.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await adminApi.deleteAdministrator(deleteTarget.id);
      if (res?.success) {
        notify(res.message || 'Administrator removed.', 'success');
        setDeleteTarget(null);
        await loadAdmins();
      } else {
        notify(res?.message || 'Failed to delete administrator.', 'error');
      }
    } catch (err: any) {
      notify(err?.message || 'Failed to delete administrator.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={[styles.container, isMobile && { padding: 12 }]}>
      <PageHeader
        title="Administrators"
        subtitle="Manage district administrators, add new admin accounts, and revoke access."
        breadcrumbs={[
          { label: 'Super Admin', link: '/admin/dashboard' },
          { label: 'Admins' }
        ]}
        actions={
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={styles.refreshBtn} onPress={loadAdmins}>
              <RefreshIcon size={15} color="#334155" />
              <Text style={styles.refreshBtnText}>Refresh</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={handleOpenAdd}>
              <PlusIcon size={15} color="#020612" />
              <Text style={styles.addBtnText}>Add Admin</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Search Bar */}
      <View style={styles.toolbar}>
        <View style={styles.searchWrap}>
          <SearchIcon size={16} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search admins by name, email, or role level..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <CloseIcon size={15} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{filteredAdmins.length} Admin(s)</Text>
        </View>
      </View>

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : filteredAdmins.length === 0 ? (
        <EmptyState
          title="No Administrators Found"
          description="No administrator accounts match your search. Click Add Admin to create one."
        />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12, paddingBottom: 32 }}>
          {filteredAdmins.map((item, idx) => {
            const isSuper = Boolean(item.is_super_admin || item.is_permanent_super_admin || item.role === 'SUPER_ADMIN');
            const isSelf = adminUser?.id && adminUser.id === item.id;
            return (
              <View key={item.id || idx} style={[styles.adminCard, isSuper && styles.adminCardSuper]}>
                <View style={styles.cardLeft}>
                  <View style={[styles.avatar, isSuper && styles.avatarSuper]}>
                    <Text style={[styles.avatarText, isSuper && { color: '#020612' }]}>
                      {(item.name || 'A')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <Text style={styles.adminName} numberOfLines={1}>{item.name || 'Administrator'}</Text>
                      <View style={[styles.roleBadge, isSuper ? styles.roleBadgeSuper : styles.roleBadgeStd]}>
                        <ShieldIcon size={11} color={isSuper ? '#B45309' : '#0369A1'} />
                        <Text style={[styles.roleBadgeText, isSuper ? { color: '#B45309' } : { color: '#0369A1' }]}>
                          {isSuper ? 'SUPER ADMIN' : (item.admin_level || 'ADMIN')}
                        </Text>
                      </View>
                      <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>{item.status || 'ACTIVE'}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      <Ionicons name="mail-outline" size={12} color="#64748B" />
                      <Text style={styles.adminMeta} numberOfLines={1}>{item.email}</Text>
                    </View>
                    {item.mobile ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                        <Ionicons name="call-outline" size={12} color="#64748B" />
                        <Text style={styles.adminMeta}>{item.mobile}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {!isSuper && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                      style={[styles.refreshBtn, { borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }]}
                      onPress={() => handleOpenEdit(item)}
                    >
                      <EditIcon size={15} color="#2563EB" />
                      <Text style={[styles.refreshBtnText, { color: '#2563EB' }]}>Edit</Text>
                    </TouchableOpacity>
                    {!isSelf && (
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => setDeleteTarget(item)}
                      >
                        <TrashIcon size={15} color="#DC2626" />
                        <Text style={styles.deleteBtnText}>Delete</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Add / Edit Admin Modal */}
      {addOpen && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setAddOpen(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, isMobile && { width: '94%' }]}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {editingAdmin ? <EditIcon size={17} color="#0F172A" /> : <PlusIcon size={17} color="#0F172A" />}
                  <Text style={styles.modalTitle}>
                    {editingAdmin ? 'Edit Administrator' : 'Add New Administrator'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setAddOpen(false)}>
                  <CloseIcon size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ padding: 20 }}>
                {formError ? (
                  <View style={[styles.formErrBox, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                    <Ionicons name="warning" size={14} color="#DC2626" />
                    <Text style={[styles.formErrText, { flex: 1 }]}>{formError}</Text>
                  </View>
                ) : null}

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Full Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. R. Karthik"
                    placeholderTextColor="#94A3B8"
                    value={formName}
                    onChangeText={setFormName}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Email Address *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. admin2@cfvd.org"
                    placeholderTextColor="#94A3B8"
                    value={formEmail}
                    onChangeText={setFormEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Mobile Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 9876543210"
                    placeholderTextColor="#94A3B8"
                    value={formMobile}
                    onChangeText={setFormMobile}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Role / Designation</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. District Administrator"
                    placeholderTextColor="#94A3B8"
                    value={formLevel}
                    onChangeText={setFormLevel}
                  />
                </View>

                {editingAdmin && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Account Status</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {['ACTIVE', 'INACTIVE'].map(st => (
                        <TouchableOpacity
                          key={st}
                          onPress={() => setFormStatus(st)}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: formStatus === st ? '#2563EB' : '#CBD5E1',
                            backgroundColor: formStatus === st ? '#EFF6FF' : '#F8FAFC'
                          }}
                        >
                          <Text style={{ fontSize: 12.5, fontWeight: '700', color: formStatus === st ? '#1D4ED8' : '#475569' }}>
                            {st}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    {editingAdmin ? 'New Password (Optional)' : 'Password *'}
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder={editingAdmin ? 'Leave blank to keep existing password' : 'Minimum 6 characters'}
                    placeholderTextColor="#94A3B8"
                    value={formPassword}
                    onChangeText={setFormPassword}
                    secureTextEntry
                  />
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddOpen(false)} disabled={submitting}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveAdmin} disabled={submitting}>
                  {submitting ? (
                    <ActivityIndicator size="small" color="#020612" />
                  ) : (
                    <Text style={styles.saveBtnText}>
                      {editingAdmin ? 'Save Changes' : 'Create Admin'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          visible={Boolean(deleteTarget)}
          title="Delete Administrator"
          message={`Are you sure you want to remove "${deleteTarget.name}" (${deleteTarget.email})? They will immediately lose admin access.`}
          confirmText={deleting ? 'Deleting...' : 'Delete Admin'}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#F8FAFC' },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  refreshBtnText: { fontSize: 12.5, fontWeight: '700', color: '#334155' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  addBtnText: { fontSize: 12.5, fontWeight: '800', color: '#020612' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap'
  },
  searchWrap: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  searchInput: { flex: 1, fontSize: 13.5, color: '#0F172A' },
  countPill: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20
  },
  countPillText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  adminCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16
  },
  adminCardSuper: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFDF7'
  },
  cardLeft: { flex: 1, minWidth: 220, flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarSuper: { backgroundColor: '#F59E0B' },
  avatarText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  adminName: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1
  },
  roleBadgeSuper: { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
  roleBadgeStd: { backgroundColor: '#E0F2FE', borderColor: '#BAE6FD' },
  roleBadgeText: { fontSize: 10.5, fontWeight: '800' },
  statusBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  statusText: { fontSize: 10, fontWeight: '800', color: '#166534' },
  adminMeta: { fontSize: 12.5, color: '#475569', marginTop: 3 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  deleteBtnText: { fontSize: 12, fontWeight: '700', color: '#DC2626' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  formErrBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14
  },
  formErrText: { color: '#B91C1C', fontSize: 12.5, fontWeight: '600' },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 12.5, fontWeight: '700', color: '#334155', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    color: '#0F172A',
    backgroundColor: '#F8FAFC'
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0'
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#F1F5F9'
  },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#F59E0B'
  },
  saveBtnText: { fontSize: 13, fontWeight: '800', color: '#020612' }
});

export default AdminsPage;
