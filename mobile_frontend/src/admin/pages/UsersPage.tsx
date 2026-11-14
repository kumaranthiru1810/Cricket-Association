/**
 * src/admin/pages/UsersPage.tsx
 * Users Management Page for Cricket Association Professional Admin Panel.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import PageHeader from '../components/PageHeader';
import DataTable, { ColumnDef } from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { EditIcon, CheckIcon, CloseIcon, EyeIcon, ShieldIcon, PlusIcon, RefreshIcon } from '../components/Icons';
import { adminApi } from '../services/adminApi';
import { useAdminLayout } from '../components/AdminLayout';

export const UsersPage: React.FC = () => {
  const { showToast } = useAdminLayout();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Edit / View Modal
  const [activeUser, setActiveUser] = useState<any | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editRole, setEditRole] = useState('USER');
  const [editStatus, setEditStatus] = useState('ACTIVE');

  // Add Administrator Modal State
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminMobile, setNewAdminMobile] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('Admin@2026!');
  const [newAdminRoleLevel, setNewAdminRoleLevel] = useState('Apex Super Administrator');
  const [isRequestingAuth, setIsRequestingAuth] = useState(false);

  // Dual-Admin Security Authorization Modal State (CloudCrackers Two-Admin Approval)
  const [showDualAuthModal, setShowDualAuthModal] = useState(false);
  const [authSessionId, setAuthSessionId] = useState('');
  const [authAction, setAuthAction] = useState<'CREATE_ADMIN' | 'PROMOTE_ADMIN'>('CREATE_ADMIN');
  const [authAdmin1Email, setAuthAdmin1Email] = useState('admin@cfvd.org');
  const [authAdmin2Email, setAuthAdmin2Email] = useState('athilingam3336@gmail.com');
  const [authAdmin1Otp, setAuthAdmin1Otp] = useState('');
  const [authAdmin2Otp, setAuthAdmin2Otp] = useState('');
  const [authDemoOtps, setAuthDemoOtps] = useState<{ admin1: string; admin2: string } | null>(null);
  const [authCountdown, setAuthCountdown] = useState(600);
  const [isVerifyingAuth, setIsVerifyingAuth] = useState(false);

  // Confirm Status Toggle
  const [confirmToggle, setConfirmToggle] = useState<{
    visible: boolean;
    user: any;
    targetStatus: string;
  }>({
    visible: false,
    user: null,
    targetStatus: ''
  });

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getUsers({
        role: roleFilter !== 'ALL' ? roleFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined
      });
      if (res && res.success) {
        setUsers(res.users || []);
      }
    } catch (e: any) {
      showToast(`Failed to load users: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [roleFilter, statusFilter]);

  // Dual-Admin Timer Effect (10 minutes countdown)
  useEffect(() => {
    let timer: any;
    if (showDualAuthModal && authCountdown > 0) {
      timer = setInterval(() => {
        setAuthCountdown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showDualAuthModal, authCountdown]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOpenView = (user: any) => {
    setActiveUser(user);
    setIsEditMode(false);
  };

  const handleOpenEdit = (user: any) => {
    setActiveUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditMobile(user.mobile || '');
    setEditRole(user.role);
    setEditStatus(user.status || 'ACTIVE');
    setIsEditMode(true);
  };

  // 1. Request Dual-Admin Authorization for adding new Admin
  const handleInitiateAddAdmin = async () => {
    if (!newAdminName.trim() || !newAdminEmail.trim()) {
      showToast('Administrator Name and Email are required.', 'error');
      return;
    }
    setIsRequestingAuth(true);
    try {
      const res = await adminApi.requestDualAdminOtp('CREATE_ADMIN', {
        name: newAdminName.trim(),
        email: newAdminEmail.trim().toLowerCase(),
        mobile: newAdminMobile.trim(),
        password: newAdminPassword,
        roleLevel: newAdminRoleLevel
      });

      if (res && res.success) {
        setAuthSessionId(res.authSessionId);
        setAuthAction('CREATE_ADMIN');
        setAuthAdmin1Email(res.admin1Email || 'admin@cfvd.org');
        setAuthAdmin2Email(res.admin2Email || 'athilingam3336@gmail.com');
        setAuthDemoOtps(res.demoOtps || null);
        setAuthAdmin1Otp('');
        setAuthAdmin2Otp('');
        setAuthCountdown(res.validitySeconds || 600);
        setShowAddAdminModal(false);
        setShowDualAuthModal(true);
        showToast('Dual-Admin security OTPs dispatched to Super Admins.', 'info');
      } else {
        showToast(res.message || 'Failed to request Dual-Admin OTP.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error initiating Dual-Admin Authorization.', 'error');
    } finally {
      setIsRequestingAuth(false);
    }
  };

  // 2. Resend Dual-Admin OTPs
  const handleResendDualAuthOtp = async () => {
    try {
      const res = await adminApi.requestDualAdminOtp(authAction, {
        name: newAdminName.trim(),
        email: newAdminEmail.trim().toLowerCase(),
        mobile: newAdminMobile.trim(),
        password: newAdminPassword,
        roleLevel: newAdminRoleLevel,
        userId: activeUser?.id
      });
      if (res && res.success) {
        setAuthSessionId(res.authSessionId);
        setAuthDemoOtps(res.demoOtps || null);
        setAuthCountdown(600);
        showToast('Fresh Dual-Admin OTPs dispatched via email.', 'success');
      }
    } catch (err: any) {
      showToast(`Resend failed: ${err.message}`, 'error');
    }
  };

  // 3. Verify Dual OTPs & Execute Action
  const handleVerifyDualAuth = async () => {
    if (!authAdmin1Otp.trim() || !authAdmin2Otp.trim()) {
      showToast('Both Admin 1 and Admin 2 OTPs are strictly required.', 'error');
      return;
    }
    setIsVerifyingAuth(true);
    try {
      const res = await adminApi.verifyDualAdminAuth(authSessionId, authAdmin1Otp.trim(), authAdmin2Otp.trim());
      if (res && res.success) {
        showToast(res.message || 'Dual-Admin Authorization Verified! Administrator Activated.', 'success');
        setShowDualAuthModal(false);
        setNewAdminName('');
        setNewAdminEmail('');
        setNewAdminMobile('');
        setActiveUser(null);
        loadUsers();
      } else {
        showToast(res.message || 'Dual-Admin verification failed.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Invalid OTPs. Dual-Admin Authorization rejected.', 'error');
    } finally {
      setIsVerifyingAuth(false);
    }
  };

  const handleAutoFillDemoOtps = () => {
    if (authDemoOtps) {
      setAuthAdmin1Otp(authDemoOtps.admin1);
      setAuthAdmin2Otp(authDemoOtps.admin2);
      showToast('Demo OTPs auto-filled for testing.', 'info');
    } else {
      setAuthAdmin1Otp('123456');
      setAuthAdmin2Otp('123456');
    }
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || !editEmail.trim()) {
      showToast('Name and Email are required.', 'error');
      return;
    }

    // High security check: Promoting a non-admin to ADMIN requires Dual-Admin Authorization!
    if (editRole === 'ADMIN' && activeUser.role !== 'ADMIN') {
      try {
        const res = await adminApi.requestDualAdminOtp('PROMOTE_ADMIN', {
          userId: activeUser.id,
          name: editName.trim(),
          email: editEmail.trim(),
          mobile: editMobile.trim()
        });
        if (res && res.success) {
          setAuthSessionId(res.authSessionId);
          setAuthAction('PROMOTE_ADMIN');
          setAuthAdmin1Email(res.admin1Email || 'admin@cfvd.org');
          setAuthAdmin2Email(res.admin2Email || 'athilingam3336@gmail.com');
          setAuthDemoOtps(res.demoOtps || null);
          setAuthAdmin1Otp('');
          setAuthAdmin2Otp('');
          setAuthCountdown(600);
          setActiveUser(null);
          setShowDualAuthModal(true);
          showToast('Promoting user to ADMIN requires Dual-Admin Authorization.', 'info');
          return;
        }
      } catch (err: any) {
        showToast(err.message || 'Dual-Admin authorization request failed.', 'error');
        return;
      }
    }

    try {
      await adminApi.updateUser(activeUser.id, {
        name: editName.trim(),
        email: editEmail.trim(),
        mobile: editMobile.trim(),
        role: editRole,
        status: editStatus
      });
      showToast('User record updated successfully.', 'success');
      setActiveUser(null);
      loadUsers();
    } catch (err: any) {
      showToast(`Update error: ${err.message}`, 'error');
    }
  };

  const handleConfirmStatusToggle = async () => {
    const { user, targetStatus } = confirmToggle;
    setConfirmToggle(prev => ({ ...prev, visible: false }));
    try {
      await adminApi.updateUserStatus(user.id, targetStatus);
      showToast(`User status set to ${targetStatus}.`, 'success');
      loadUsers();
    } catch (err: any) {
      showToast(`Status update failed: ${err.message}`, 'error');
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      width: 220,
      render: item => (
        <View>
          <Text style={styles.userNameText}>{item.name}</Text>
          <Text style={styles.userIdSub}>{item.id}</Text>
        </View>
      )
    },
    {
      key: 'email',
      header: 'Email / Contact',
      sortable: true,
      width: 240,
      render: item => (
        <View>
          <Text style={styles.userEmailText}>{item.email}</Text>
          {item.mobile && <Text style={styles.userMobileSub}>📱 {item.mobile}</Text>}
        </View>
      )
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      width: 140,
      render: item => (
        <View
          style={[
            styles.rolePill,
            item.role === 'ADMIN' && styles.roleAdmin,
            item.role === 'SCORER' && styles.roleScorer,
            item.role === 'PLAYER' && styles.rolePlayer
          ]}
        >
          <Text style={styles.rolePillText}>{item.role}</Text>
        </View>
      )
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      width: 130,
      render: item => <StatusBadge status={item.status || 'ACTIVE'} size="sm" />
    },
    {
      key: 'created_at',
      header: 'Registered Date',
      sortable: true,
      width: 150,
      render: item => (
        <Text style={styles.dateText}>
          {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'}
        </Text>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 160,
      render: item => (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleOpenView(item)}
            accessibilityLabel="View Details"
          >
            <EyeIcon size={14} color="#0f2452" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleOpenEdit(item)}
            accessibilityLabel="Edit User"
          >
            <EditIcon size={14} color="#2563eb" />
          </TouchableOpacity>
          {item.status === 'ACTIVE' ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDanger]}
              onPress={() =>
                setConfirmToggle({
                  visible: true,
                  user: item,
                  targetStatus: 'INACTIVE'
                })
              }
              accessibilityLabel="Deactivate Account"
            >
              <CloseIcon size={14} color="#dc2626" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSuccess]}
              onPress={() =>
                setConfirmToggle({
                  visible: true,
                  user: item,
                  targetStatus: 'ACTIVE'
                })
              }
              accessibilityLabel="Activate Account"
            >
              <CheckIcon size={14} color="#059669" />
            </TouchableOpacity>
          )}
        </View>
      )
    }
  ];

  return (
    <View style={styles.container}>
      <PageHeader
        title="Users Management"
        subtitle="View, filter, edit, and control account permissions for federation portal users."
        breadcrumbs={[{ label: 'Admin' }, { label: 'Users' }]}
        actions={
          <TouchableOpacity
            style={styles.addAdminBtn}
            onPress={() => setShowAddAdminModal(true)}
            activeOpacity={0.8}
          >
            <ShieldIcon size={16} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.addAdminBtnText}>+ Add New Administrator</Text>
          </TouchableOpacity>
        }
      />

      {/* Role Filter Tabs */}
      <View style={styles.filtersBar}>
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Role:</Text>
          {['ALL', 'ADMIN', 'SCORER', 'PLAYER', 'USER'].map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.filterChip, roleFilter === r && styles.filterChipActive]}
              onPress={() => setRoleFilter(r)}
            >
              <Text style={[styles.filterChipText, roleFilter === r && styles.filterChipTextActive]}>
                {r}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Status:</Text>
          {['ALL', 'ACTIVE', 'INACTIVE'].map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
              onPress={() => setStatusFilter(s)}
            >
              <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
                {s}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Users DataTable */}
      <DataTable
        data={users}
        columns={columns}
        keyExtractor={item => item.id}
        loading={loading}
        searchPlaceholder="Search by name, email, or mobile..."
        searchFields={['name', 'email', 'mobile', 'role']}
        emptyTitle="No users found"
        emptyDescription="No registered users match the specified search or filter criteria."
      />

      {/* View / Edit Modal */}
      {activeUser && (
        <Modal visible={Boolean(activeUser)} transparent animationType="fade" onRequestClose={() => setActiveUser(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalDialog}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isEditMode ? 'Edit User Record' : 'User Details'}
                </Text>
                <TouchableOpacity onPress={() => setActiveUser(null)}>
                  <CloseIcon size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              {isEditMode ? (
                <View style={styles.modalBody}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Full Name</Text>
                    <TextInput style={styles.fieldInput} value={editName} onChangeText={setEditName} />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Email Address</Text>
                    <TextInput style={styles.fieldInput} value={editEmail} onChangeText={setEditEmail} keyboardType="email-address" />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Mobile Number</Text>
                    <TextInput style={styles.fieldInput} value={editMobile} onChangeText={setEditMobile} keyboardType="phone-pad" />
                  </View>
                  <View style={styles.fieldRow}>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>Role</Text>
                      <View style={styles.roleSelectRow}>
                        {['ADMIN', 'SCORER', 'PLAYER', 'USER'].map(r => (
                          <TouchableOpacity
                            key={r}
                            style={[styles.roleSelectChip, editRole === r && styles.roleSelectChipActive]}
                            onPress={() => setEditRole(r)}
                          >
                            <Text style={[styles.roleSelectText, editRole === r && styles.roleSelectTextActive]}>{r}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Account Status</Text>
                    <View style={styles.roleSelectRow}>
                      {['ACTIVE', 'INACTIVE'].map(s => (
                        <TouchableOpacity
                          key={s}
                          style={[styles.roleSelectChip, editStatus === s && styles.roleSelectChipActive]}
                          onPress={() => setEditStatus(s)}
                        >
                          <Text style={[styles.roleSelectText, editStatus === s && styles.roleSelectTextActive]}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.modalBody}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>User ID:</Text>
                    <Text style={styles.infoVal}>{activeUser.id}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Name:</Text>
                    <Text style={styles.infoVal}>{activeUser.name}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Email:</Text>
                    <Text style={styles.infoVal}>{activeUser.email}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Mobile:</Text>
                    <Text style={styles.infoVal}>{activeUser.mobile || 'Not specified'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Role:</Text>
                    <Text style={styles.infoVal}>{activeUser.role}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Status:</Text>
                    <StatusBadge status={activeUser.status || 'ACTIVE'} size="sm" />
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Created Date:</Text>
                    <Text style={styles.infoVal}>
                      {activeUser.created_at ? new Date(activeUser.created_at).toLocaleString() : 'N/A'}
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.modalFooter}>
                {isEditMode ? (
                  <>
                    <TouchableOpacity style={styles.btnCancel} onPress={() => setIsEditMode(false)}>
                      <Text style={styles.btnCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnSave} onPress={handleSaveEdit}>
                      <Text style={styles.btnSaveText}>Save Changes</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity style={styles.btnCancel} onPress={() => setActiveUser(null)}>
                      <Text style={styles.btnCancelText}>Close</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnSave} onPress={() => handleOpenEdit(activeUser)}>
                      <Text style={styles.btnSaveText}>Edit User</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Status Toggle Confirmation */}
      <ConfirmDialog
        visible={confirmToggle.visible}
        title={confirmToggle.targetStatus === 'ACTIVE' ? 'Activate User' : 'Deactivate User'}
        message={`Are you sure you want to change status to "${confirmToggle.targetStatus}" for ${confirmToggle.user?.name}?`}
        variant={confirmToggle.targetStatus === 'ACTIVE' ? 'success' : 'danger'}
        confirmText={confirmToggle.targetStatus === 'ACTIVE' ? 'Activate' : 'Deactivate'}
        onConfirm={handleConfirmStatusToggle}
        onCancel={() => setConfirmToggle(prev => ({ ...prev, visible: false }))}
      />

      {/* 1. Add Administrator Modal */}
      {showAddAdminModal && (
        <Modal
          visible={showAddAdminModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAddAdminModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalDialog, { maxWidth: 520 }]}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ShieldIcon size={20} color="#0f2452" />
                  <View>
                    <Text style={styles.modalTitle}>Onboard Administrator</Text>
                    <Text style={{ fontSize: 11, color: '#64748b' }}>
                      Assign executive association management credentials
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setShowAddAdminModal(false)}>
                  <CloseIcon size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Administrator Full Name *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={newAdminName}
                    onChangeText={setNewAdminName}
                    placeholder="e.g. K. Senthil Kumar"
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Official Email Address *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={newAdminEmail}
                    onChangeText={setNewAdminEmail}
                    placeholder="e.g. senthil.admin@cfvd.org"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View style={styles.fieldRow}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Mobile Number (10 Digits)</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={newAdminMobile}
                      onChangeText={setNewAdminMobile}
                      placeholder="e.g. 9876543210"
                      keyboardType="phone-pad"
                      maxLength={10}
                      placeholderTextColor="#94a3b8"
                    />
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Temporary Password *</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={newAdminPassword}
                      onChangeText={setNewAdminPassword}
                      placeholder="Admin@2026!"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Clearance & Responsibility Level</Text>
                  <View style={styles.roleSelectRow}>
                    {[
                      'Apex Super Administrator',
                      'Match & Scoring Admin',
                      'Association Operations Admin'
                    ].map(lvl => (
                      <TouchableOpacity
                        key={lvl}
                        style={[
                          styles.roleSelectChip,
                          newAdminRoleLevel === lvl && styles.roleSelectChipActive
                        ]}
                        onPress={() => setNewAdminRoleLevel(lvl)}
                      >
                        <Text
                          style={[
                            styles.roleSelectText,
                            newAdminRoleLevel === lvl && styles.roleSelectTextActive
                          ]}
                        >
                          {lvl}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.securityNoticeCard}>
                  <Text style={styles.securityNoticeTitle}>🛡️ Two-Admin Approval Policy</Text>
                  <Text style={styles.securityNoticeText}>
                    Adding or promoting an administrator grants executive control over tournament fixtures, user data, and live scoring. This operation strictly requires simultaneous authorization from two Super Administrators via OTP.
                  </Text>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.btnCancel}
                  onPress={() => setShowAddAdminModal(false)}
                >
                  <Text style={styles.btnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnProceedDual, isRequestingAuth && { opacity: 0.7 }]}
                  onPress={handleInitiateAddAdmin}
                  disabled={isRequestingAuth}
                >
                  {isRequestingAuth ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <ShieldIcon size={15} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={styles.btnProceedDualText}>
                        Request Dual-Admin Authorization →
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* 2. Dual-Admin Authorization Modal (CloudCrackers Style) */}
      {showDualAuthModal && (
        <Modal
          visible={showDualAuthModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDualAuthModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalDialog, styles.dualAuthDialog]}>
              {/* Header */}
              <View style={styles.dualAuthHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={styles.dualAuthIconCircle}>
                    <ShieldIcon size={18} color="#b91c1c" />
                  </View>
                  <View>
                    <Text style={styles.dualAuthTitle}>Dual-Admin Authorization</Text>
                    <Text style={styles.dualAuthSubtitle}>
                      High Security Data Ops & Super-Admin Elevation Forge
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setShowDualAuthModal(false)}>
                  <CloseIcon size={18} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* Warning Alert Banner (matching uploaded image) */}
              <View style={styles.dualAuthAlertBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Text style={{ fontSize: 13 }}>⚠️</Text>
                  <Text style={styles.dualAuthAlertHeading}>
                    {authAction === 'CREATE_ADMIN'
                      ? 'SUPER-ADMIN PRIVILEGE ELEVATION'
                      : 'ROLE PROMOTION AUTHORIZATION'}
                  </Text>
                </View>
                <Text style={styles.dualAuthAlertDesc}>
                  {authAction === 'CREATE_ADMIN'
                    ? `This action will permanently create and activate Administrator "${newAdminName}" (${newAdminEmail}) with full access to association records, match arbitrator rules, and user management.`
                    : 'This action will elevate the selected user to full Administrator clearance with association management privileges.'}
                </Text>
              </View>

              {/* Timer Bar */}
              <View style={styles.dualAuthTimerRow}>
                <Text style={styles.dualAuthTimerText}>
                  ⏳ Valid for: <Text style={{ fontWeight: '800' }}>{formatCountdown(authCountdown)}</Text>
                </Text>
                <TouchableOpacity onPress={handleResendDualAuthOtp}>
                  <Text style={styles.dualAuthResendLink}>🔄 Resend OTPs</Text>
                </TouchableOpacity>
              </View>

              {/* Admin 1 OTP Section */}
              <View style={styles.otpCard}>
                <View style={styles.otpCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.adminBadgeCircle, { backgroundColor: '#ef4444' }]}>
                      <Text style={styles.adminBadgeNum}>1</Text>
                    </View>
                    <Text style={styles.otpLabel}>
                      Admin 1 OTP: <Text style={styles.otpEmailText}>{authAdmin1Email}</Text>
                    </Text>
                  </View>
                  {authDemoOtps?.admin1 && (
                    <TouchableOpacity
                      style={styles.demoFillChip}
                      onPress={() => setAuthAdmin1Otp(authDemoOtps.admin1)}
                    >
                      <Text style={styles.demoFillText}>⚡ Demo: {authDemoOtps.admin1}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  style={[styles.otpInput, authAdmin1Otp.length === 6 && styles.otpInputValid]}
                  value={authAdmin1Otp}
                  onChangeText={setAuthAdmin1Otp}
                  placeholder="Enter 6-digit OTP"
                  keyboardType="numeric"
                  maxLength={6}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              {/* Admin 2 OTP Section */}
              <View style={styles.otpCard}>
                <View style={styles.otpCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.adminBadgeCircle, { backgroundColor: '#2563eb' }]}>
                      <Text style={styles.adminBadgeNum}>2</Text>
                    </View>
                    <Text style={styles.otpLabel}>
                      Admin 2 OTP: <Text style={styles.otpEmailText}>{authAdmin2Email}</Text>
                    </Text>
                  </View>
                  {authDemoOtps?.admin2 && (
                    <TouchableOpacity
                      style={styles.demoFillChip}
                      onPress={() => setAuthAdmin2Otp(authDemoOtps.admin2)}
                    >
                      <Text style={styles.demoFillText}>⚡ Demo: {authDemoOtps.admin2}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  style={[styles.otpInput, authAdmin2Otp.length === 6 && styles.otpInputValid]}
                  value={authAdmin2Otp}
                  onChangeText={setAuthAdmin2Otp}
                  placeholder="Enter 6-digit OTP"
                  keyboardType="numeric"
                  maxLength={6}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              {/* Helper disclaimer */}
              <Text style={styles.dualAuthDisclaimer}>
                🔒 Both Super Admins (Admin 1 & Admin 2) must enter the correct 6-digit OTP. Otherwise, the elevation action is rejected.
              </Text>

              {/* Action Buttons */}
              <View style={styles.dualAuthActions}>
                <TouchableOpacity
                  style={styles.btnAutoFillBoth}
                  onPress={handleAutoFillDemoOtps}
                >
                  <Text style={styles.btnAutoFillBothText}>⚡ Auto-Fill Both Demo OTPs</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.btnVerifyDual,
                    (!authAdmin1Otp || !authAdmin2Otp || isVerifyingAuth) && { opacity: 0.7 }
                  ]}
                  onPress={handleVerifyDualAuth}
                  disabled={!authAdmin1Otp || !authAdmin2Otp || isVerifyingAuth}
                >
                  {isVerifyingAuth ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.btnVerifyDualText}>
                      ✓ Verify Dual OTPs & Authorize Administrator
                    </Text>
                  )}
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
  filtersBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 20,
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b'
  },
  filterChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  filterChipActive: {
    backgroundColor: '#0f2452',
    borderColor: '#0f2452'
  },
  filterChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569'
  },
  filterChipTextActive: {
    color: '#ffffff'
  },
  userNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a'
  },
  userIdSub: {
    fontSize: 11,
    color: '#94a3b8'
  },
  userEmailText: {
    fontSize: 12.5,
    color: '#334155'
  },
  userMobileSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2
  },
  rolePill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    alignSelf: 'flex-start'
  },
  roleAdmin: {
    backgroundColor: '#fef3c7'
  },
  roleScorer: {
    backgroundColor: '#e0e7ff'
  },
  rolePlayer: {
    backgroundColor: '#dcfce7'
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155'
  },
  dateText: {
    fontSize: 12,
    color: '#64748b'
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center'
  },
  actionBtnDanger: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2'
  },
  actionBtnSuccess: {
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalDialog: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a'
  },
  modalBody: {
    marginBottom: 20
  },
  fieldGroup: {
    marginBottom: 14
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6
  },
  fieldInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#f8fafc'
  },
  roleSelectRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap'
  },
  roleSelectChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc'
  },
  roleSelectChipActive: {
    backgroundColor: '#0f2452',
    borderColor: '#0f2452'
  },
  roleSelectText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569'
  },
  roleSelectTextActive: {
    color: '#ffffff'
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc'
  },
  infoKey: {
    width: 120,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748b'
  },
  infoVal: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600'
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10
  },
  btnCancel: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  btnCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569'
  },
  btnSave: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#0f2452'
  },
  btnSaveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff'
  },
  addAdminBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0f2452',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8
  },
  addAdminBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  securityNoticeCard: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
    marginTop: 8
  },
  securityNoticeTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#991b1b',
    marginBottom: 4
  },
  securityNoticeText: {
    fontSize: 11.5,
    color: '#7f1d1d',
    lineHeight: 16
  },
  btnProceedDual: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#b91c1c'
  },
  btnProceedDualText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  dualAuthDialog: {
    maxWidth: 560,
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    overflow: 'hidden'
  },
  dualAuthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  dualAuthIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center'
  },
  dualAuthTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a'
  },
  dualAuthSubtitle: {
    fontSize: 11,
    color: '#64748b'
  },
  dualAuthAlertBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 18,
    marginTop: 14
  },
  dualAuthAlertHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991b1b',
    marginBottom: 2
  },
  dualAuthAlertDesc: {
    fontSize: 11,
    color: '#7f1d1d',
    lineHeight: 15
  },
  dualAuthTimerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 18,
    marginTop: 12,
    marginBottom: 8
  },
  dualAuthTimerText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600'
  },
  dualAuthResendLink: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '700'
  },
  otpCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 18,
    marginBottom: 10
  },
  otpCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 6
  },
  adminBadgeCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  adminBadgeNum: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800'
  },
  otpLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155'
  },
  otpEmailText: {
    color: '#0f2452',
    fontWeight: '800'
  },
  demoFillChip: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  demoFillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8'
  },
  otpInput: {
    height: 42,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 4,
    color: '#0f172a',
    backgroundColor: '#ffffff'
  },
  otpInputValid: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4'
  },
  dualAuthDisclaimer: {
    fontSize: 11,
    color: '#64748b',
    marginHorizontal: 18,
    marginVertical: 6,
    lineHeight: 15
  },
  dualAuthActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    flexWrap: 'wrap'
  },
  btnAutoFillBoth: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8
  },
  btnAutoFillBothText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8'
  },
  btnVerifyDual: {
    backgroundColor: '#991b1b',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    flex: 1,
    minWidth: 220,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnVerifyDualText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '800'
  }
});

export default UsersPage;
