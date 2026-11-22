/**
 * src/admin/pages/UsersPage.tsx
 * 
 * Users & Dynamic Administrator Management Page for Cricket Association Admin Panel.
 * Implements strict Nodemailer Email OTP verification for Super Administrator (admin@cfvd.org).
 * 
 * Invariants:
 * 1. Single Permanent Super Admin: admin@cfvd.org (Apex Authority).
 * 2. Dynamic Administrators: created, approved, activated, suspended, or removed via Super Admin OTP.
 * 3. Responsive for Android, iPhone, tablet, and desktop viewports.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import PageHeader from '../components/PageHeader';
import DataTable, { ColumnDef } from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { EditIcon, CheckIcon, CloseIcon, EyeIcon, ShieldIcon } from '../components/Icons';
import { adminApi } from '../services/adminApi';
import { useAdminLayout } from '../components/AdminLayout';

const PERMANENT_SUPER_ADMIN = 'admin@cfvd.org';

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
  const [newAdminRoleLevel, setNewAdminRoleLevel] = useState('Match & Scoring Administrator');
  const [isRequestingAuth, setIsRequestingAuth] = useState(false);

  // Super Admin Nodemailer OTP Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpSessionId, setOtpSessionId] = useState('');
  const [otpAction, setOtpAction] = useState('CREATE_ADMIN');
  const [otpActionTitle, setOtpActionTitle] = useState('Onboard New Administrator');
  const [otpActionDesc, setOtpActionDesc] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [otpCountdown, setOtpCountdown] = useState(600); // 10 minutes
  const [resendCooldown, setResendCooldown] = useState(60); // 60s cooldown
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  // Status toggle confirmation
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

  // 10-Minute Countdown Timer Effect
  useEffect(() => {
    let timer: any;
    if (showOtpModal && otpCountdown > 0) {
      timer = setInterval(() => {
        setOtpCountdown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showOtpModal, otpCountdown]);

  // 60-Second Resend Cooldown Effect
  useEffect(() => {
    let cooldownTimer: any;
    if (showOtpModal && resendCooldown > 0) {
      cooldownTimer = setInterval(() => {
        setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(cooldownTimer);
  }, [showOtpModal, resendCooldown]);

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

  // 1. Initiate Add New Administrator (Triggers Nodemailer OTP to admin@cfvd.org)
  const handleInitiateAddAdmin = async () => {
    if (!newAdminName.trim() || !newAdminEmail.trim()) {
      showToast('Administrator Name and Email are required.', 'error');
      return;
    }
    setIsRequestingAuth(true);
    try {
      const res = await adminApi.createAdminAccount({
        name: newAdminName.trim(),
        email: newAdminEmail.trim().toLowerCase(),
        mobile: newAdminMobile.trim(),
        password: newAdminPassword,
        roleLevel: newAdminRoleLevel
      });

      if (res && res.success) {
        setOtpSessionId(res.sessionId);
        setOtpAction('CREATE_ADMIN');
        setOtpActionTitle(res.actionTitle || 'Onboard New Administrator');
        setOtpActionDesc(`Create and activate administrator "${newAdminName}" (${newAdminEmail})`);
        setDemoOtp(res.demoOtp || null);
        setOtpInput('');
        setOtpCountdown(res.validitySeconds || 600);
        setResendCooldown(60);
        setShowAddAdminModal(false);
        setShowOtpModal(true);
        showToast('Nodemailer verification code dispatched to admin@cfvd.org', 'info');
      } else {
        showToast(res.message || 'Failed to dispatch Super Admin OTP.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error requesting Super Admin authorization.', 'error');
    } finally {
      setIsRequestingAuth(false);
    }
  };

  // 2. Approve Pending Dynamic Administrator
  const handleInitiateApproveAdmin = async (user: any) => {
    try {
      const res = await adminApi.approveAdmin({
        targetId: user.id,
        targetEmail: user.email,
        targetName: user.name
      });
      if (res && res.success) {
        setOtpSessionId(res.sessionId);
        setOtpAction('APPROVE_ADMIN');
        setOtpActionTitle(res.actionTitle || 'Approve Pending Administrator');
        setOtpActionDesc(`Authorize and activate account for ${user.name} (${user.email})`);
        setDemoOtp(res.demoOtp || null);
        setOtpInput('');
        setOtpCountdown(600);
        setResendCooldown(60);
        setShowOtpModal(true);
        showToast(`Verification code sent to ${PERMANENT_SUPER_ADMIN}`, 'info');
      }
    } catch (err: any) {
      showToast(err.message || 'Approval initiation failed.', 'error');
    }
  };

  // 3. Reject Pending Administrator
  const handleInitiateRejectAdmin = async (user: any) => {
    try {
      const res = await adminApi.rejectAdmin({
        targetId: user.id,
        targetEmail: user.email,
        targetName: user.name
      });
      if (res && res.success) {
        setOtpSessionId(res.sessionId);
        setOtpAction('REJECT_ADMIN');
        setOtpActionTitle(res.actionTitle || 'Reject Pending Administrator');
        setOtpActionDesc(`Reject administrative application for ${user.name}`);
        setDemoOtp(res.demoOtp || null);
        setOtpInput('');
        setOtpCountdown(600);
        setResendCooldown(60);
        setShowOtpModal(true);
        showToast(`Verification code sent to ${PERMANENT_SUPER_ADMIN}`, 'info');
      }
    } catch (err: any) {
      showToast(err.message || 'Rejection initiation failed.', 'error');
    }
  };

  // 4. Suspend / Activate / Remove Dynamic Administrator via Super Admin OTP
  const handleInitiateAdminStatusAction = async (user: any, action: 'ACTIVATE_ADMIN' | 'SUSPEND_ADMIN' | 'REMOVE_ADMIN') => {
    if ((user.email || '').toLowerCase().trim() === PERMANENT_SUPER_ADMIN) {
      showToast('Permanent Super Administrator account cannot be suspended or removed.', 'error');
      return;
    }
    try {
      const res = await adminApi.sendSuperAdminOtp(action, {}, user.id, user.email);
      if (res && res.success) {
        setOtpSessionId(res.sessionId);
        setOtpAction(action);
        setOtpActionTitle(res.actionTitle || action.replace(/_/g, ' '));
        setOtpActionDesc(`Target: ${user.name} (${user.email})`);
        setDemoOtp(res.demoOtp || null);
        setOtpInput('');
        setOtpCountdown(600);
        setResendCooldown(60);
        setShowOtpModal(true);
        showToast(`Verification code sent to ${PERMANENT_SUPER_ADMIN}`, 'info');
      }
    } catch (err: any) {
      showToast(err.message || 'Action initiation failed.', 'error');
    }
  };

  // 5. Resend Super Admin OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) {
      showToast(`Please wait ${resendCooldown}s before requesting a new code.`, 'info');
      return;
    }
    try {
      const res = await adminApi.resendSuperAdminOtp(otpSessionId);
      if (res && res.success) {
        setDemoOtp(res.demoOtp || null);
        setOtpCountdown(600);
        setResendCooldown(60);
        showToast(`Fresh verification code sent to ${PERMANENT_SUPER_ADMIN}`, 'success');
      }
    } catch (err: any) {
      showToast(`Resend failed: ${err.message}`, 'error');
    }
  };

  // 6. Verify Super Admin OTP & Execute Operation
  const handleVerifyOtp = async () => {
    if (otpInput.trim().length !== 6) {
      showToast('Please enter the complete 6-digit verification code.', 'error');
      return;
    }
    setIsVerifyingOtp(true);
    try {
      const res = await adminApi.verifySuperAdminOtp(otpSessionId, otpInput.trim());
      if (res && res.success) {
        showToast(res.message || 'Verification successful! Action executed.', 'success');
        setShowOtpModal(false);
        setOtpInput('');
        setNewAdminName('');
        setNewAdminEmail('');
        setNewAdminMobile('');
        setActiveUser(null);
        await loadUsers();
      } else {
        showToast(res.message || 'Verification failed.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Invalid verification code. Authorization rejected.', 'error');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Edit user submission handler
  const handleSaveEdit = async () => {
    if (!editName.trim() || !editEmail.trim()) {
      showToast('Name and Email are required.', 'error');
      return;
    }

    // Role Promotion check: Promoting to ADMIN requires Super Admin OTP
    if (editRole === 'ADMIN' && activeUser.role !== 'ADMIN') {
      try {
        const res = await adminApi.sendSuperAdminOtp(
          'CHANGE_ROLE',
          { newRole: 'ADMIN' },
          activeUser.id,
          activeUser.email
        );
        if (res && res.success) {
          setOtpSessionId(res.sessionId);
          setOtpAction('CHANGE_ROLE');
          setOtpActionTitle('Promote User to Administrator');
          setOtpActionDesc(`Promoting ${activeUser.name} to ADMIN privileges`);
          setDemoOtp(res.demoOtp || null);
          setOtpInput('');
          setOtpCountdown(600);
          setResendCooldown(60);
          setActiveUser(null);
          setShowOtpModal(true);
          showToast(`Super Admin verification required. Code sent to ${PERMANENT_SUPER_ADMIN}`, 'info');
          return;
        }
      } catch (err: any) {
        showToast(err.message || 'Elevation authorization failed.', 'error');
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
      header: 'Name & Authority',
      sortable: true,
      width: 230,
      render: item => {
        const isSuperAdmin = (item.email || '').toLowerCase().trim() === PERMANENT_SUPER_ADMIN;
        return (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={styles.userNameText}>{item.name}</Text>
              {isSuperAdmin && (
                <View style={styles.superAdminCrownBadge}>
                  <Text style={styles.superAdminCrownText}>👑 Super Admin</Text>
                </View>
              )}
            </View>
            <Text style={styles.userIdSub}>{item.id}</Text>
          </View>
        );
      }
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
      header: 'Clearance Tier',
      sortable: true,
      width: 170,
      render: item => {
        const isSuperAdmin = (item.email || '').toLowerCase().trim() === PERMANENT_SUPER_ADMIN;
        const isDynamicAdmin = item.role === 'ADMIN' && !isSuperAdmin;
        return (
          <View>
            <View
              style={[
                styles.rolePill,
                item.role === 'ADMIN' && (isSuperAdmin ? styles.roleSuperAdmin : styles.roleAdmin),
                item.role === 'SCORER' && styles.roleScorer,
                item.role === 'PLAYER' && styles.rolePlayer
              ]}
            >
              <Text style={styles.rolePillText}>
                {isSuperAdmin ? 'SUPER ADMIN' : (isDynamicAdmin ? 'DYNAMIC ADMIN' : item.role)}
              </Text>
            </View>
            {isDynamicAdmin && (
              <Text style={{ fontSize: 10, color: '#64748b', marginTop: 3, fontWeight: '600' }}>
                {item.admin_level || 'Dynamic Admin'}
              </Text>
            )}
          </View>
        );
      }
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      width: 140,
      render: item => {
        if (item.status === 'PENDING') {
          return (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>⏳ PENDING APPROVAL</Text>
            </View>
          );
        }
        return <StatusBadge status={item.status || 'ACTIVE'} size="sm" />;
      }
    },
    {
      key: 'created_at',
      header: 'Registered Date',
      sortable: true,
      width: 140,
      render: item => (
        <Text style={styles.dateText}>
          {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'}
        </Text>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 180,
      render: item => {
        const isSuperAdmin = (item.email || '').toLowerCase().trim() === PERMANENT_SUPER_ADMIN;
        if (isSuperAdmin) {
          return (
            <View style={styles.permanentSuperAdminTag}>
              <ShieldIcon size={12} color="#0f2452" />
              <Text style={styles.permanentSuperAdminTagText}>Permanent Super Admin</Text>
            </View>
          );
        }

        const isPendingAdmin = item.role === 'ADMIN' && item.status === 'PENDING';

        if (isPendingAdmin) {
          return (
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.btnApproveCompact}
                onPress={() => handleInitiateApproveAdmin(item)}
              >
                <Text style={styles.btnApproveCompactText}>✓ Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnRejectCompact}
                onPress={() => handleInitiateRejectAdmin(item)}
              >
                <Text style={styles.btnRejectCompactText}>✕ Reject</Text>
              </TouchableOpacity>
            </View>
          );
        }

        const isDynamicAdmin = item.role === 'ADMIN';

        return (
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
                onPress={() => {
                  if (isDynamicAdmin) {
                    handleInitiateAdminStatusAction(item, 'SUSPEND_ADMIN');
                  } else {
                    setConfirmToggle({
                      visible: true,
                      user: item,
                      targetStatus: 'INACTIVE'
                    });
                  }
                }}
                accessibilityLabel="Suspend Account"
              >
                <CloseIcon size={14} color="#dc2626" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSuccess]}
                onPress={() => {
                  if (isDynamicAdmin) {
                    handleInitiateAdminStatusAction(item, 'ACTIVATE_ADMIN');
                  } else {
                    setConfirmToggle({
                      visible: true,
                      user: item,
                      targetStatus: 'ACTIVE'
                    });
                  }
                }}
                accessibilityLabel="Activate Account"
              >
                <CheckIcon size={14} color="#059669" />
              </TouchableOpacity>
            )}

            {isDynamicAdmin && (
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: '#fca5a5', backgroundColor: '#fef2f2' }]}
                onPress={() => handleInitiateAdminStatusAction(item, 'REMOVE_ADMIN')}
                accessibilityLabel="Remove Administrator"
              >
                <Text style={{ fontSize: 11 }}>🗑️</Text>
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
        title="Users & Dynamic Administrator Management"
        subtitle="Manage federation accounts. Super Administrator (admin@cfvd.org) exercises cryptographic OTP approval over all dynamic admins."
        breadcrumbs={[{ label: 'Admin' }, { label: 'Users & Admins' }]}
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

      {/* Role Filter Bar */}
      <View style={styles.filtersBar}>
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Role Filter:</Text>
          {['ALL', 'ADMIN', 'SCORER', 'PLAYER', 'USER'].map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.filterChip, roleFilter === r && styles.filterChipActive]}
              onPress={() => setRoleFilter(r)}
            >
              <Text style={[styles.filterChipText, roleFilter === r && styles.filterChipTextActive]}>
                {r === 'ADMIN' ? 'ADMINISTRATORS' : r}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Status:</Text>
          {['ALL', 'ACTIVE', 'PENDING', 'SUSPENDED'].map(s => (
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
        searchFields={['name', 'email', 'mobile', 'role', 'admin_level']}
        emptyTitle="No accounts found"
        emptyDescription="No registered users or administrators match the specified search or filter criteria."
      />

      {/* View / Edit Modal */}
      {activeUser && (
        <Modal visible={Boolean(activeUser)} transparent animationType="fade" onRequestClose={() => setActiveUser(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalDialog}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isEditMode ? 'Edit User Record' : 'User Account Details'}
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
                      {['ACTIVE', 'INACTIVE', 'SUSPENDED'].map(s => (
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
                    <Text style={styles.infoKey}>Role & Tier:</Text>
                    <Text style={styles.infoVal}>
                      {activeUser.email === PERMANENT_SUPER_ADMIN ? 'Permanent Super Administrator' : activeUser.role}
                    </Text>
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
                    <Text style={styles.modalTitle}>Onboard Dynamic Administrator</Text>
                    <Text style={{ fontSize: 11, color: '#64748b' }}>
                      Assign association management credentials under Super Admin oversight
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
                      'Match & Scoring Administrator',
                      'Operations Administrator',
                      'Financial & Registrar Administrator'
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
                  <Text style={styles.securityNoticeTitle}>🛡️ Super Administrator Oversight Policy</Text>
                  <Text style={styles.securityNoticeText}>
                    New administrators have dynamic privileges and strictly require Nodemailer 6-digit OTP verification from the permanent Super Administrator (<Text style={{ fontWeight: '800', color: '#991b1b' }}>admin@cfvd.org</Text>). Upon approval, an activation link is automatically emailed to the new administrator.
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
                  style={[styles.btnProceedSuperAdmin, isRequestingAuth && { opacity: 0.7 }]}
                  onPress={handleInitiateAddAdmin}
                  disabled={isRequestingAuth}
                >
                  {isRequestingAuth ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <ShieldIcon size={15} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={styles.btnProceedSuperAdminText}>
                        Request Super Admin OTP →
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* 2. Super Administrator Nodemailer Security OTP Verification Modal */}
      {showOtpModal && (
        <Modal
          visible={showOtpModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowOtpModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalDialog, styles.superAdminOtpDialog]}>
              {/* Header */}
              <View style={styles.superAdminOtpHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={styles.superAdminOtpIconCircle}>
                    <ShieldIcon size={18} color="#0f2452" />
                  </View>
                  <View>
                    <Text style={styles.superAdminOtpTitle}>Super Administrator Security Verification</Text>
                    <Text style={styles.superAdminOtpSubtitle}>
                      Nodemailer SMTP Verification to {PERMANENT_SUPER_ADMIN}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setShowOtpModal(false)}>
                  <CloseIcon size={18} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* Action Banner */}
              <View style={styles.superAdminActionBanner}>
                <Text style={styles.superAdminActionTitle}>
                  🔒 {otpActionTitle || 'Administrative Operation'}
                </Text>
                {otpActionDesc ? (
                  <Text style={styles.superAdminActionDesc}>{otpActionDesc}</Text>
                ) : null}
              </View>

              {/* Timer & Resend Row */}
              <View style={styles.otpTimerRow}>
                <Text style={styles.otpTimerText}>
                  ⏳ Code valid for: <Text style={{ fontWeight: '800' }}>{formatCountdown(otpCountdown)}</Text>
                </Text>
                <TouchableOpacity
                  onPress={handleResendOtp}
                  disabled={resendCooldown > 0}
                >
                  <Text style={[styles.otpResendText, resendCooldown > 0 && { color: '#94a3b8' }]}>
                    {resendCooldown > 0 ? `⏳ Resend OTP (${resendCooldown}s)` : '🔄 Resend OTP'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Single Super Admin OTP Input Card */}
              <View style={styles.superAdminOtpCard}>
                <View style={styles.superAdminOtpCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 13 }}>👑</Text>
                    <Text style={styles.superAdminOtpLabel}>
                      Enter 6-Digit OTP sent to <Text style={{ fontWeight: '800', color: '#0f2452' }}>{PERMANENT_SUPER_ADMIN}</Text>:
                    </Text>
                  </View>
                  {demoOtp && (
                    <TouchableOpacity
                      style={styles.demoFillChip}
                      onPress={() => setOtpInput(demoOtp)}
                    >
                      <Text style={styles.demoFillText}>⚡ Demo OTP: {demoOtp}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  style={[styles.otpLargeInput, otpInput.length === 6 && styles.otpLargeInputValid]}
                  value={otpInput}
                  onChangeText={setOtpInput}
                  placeholder="Enter 6-digit code"
                  keyboardType="numeric"
                  maxLength={6}
                  placeholderTextColor="#94a3b8"
                  autoFocus
                />
              </View>

              {/* Security Policy Reminder */}
              <Text style={styles.securityPolicyNote}>
                🛡️ Single-use cryptographically secure OTP. All newly created or modified administrators remain under dynamic management of the permanent Super Administrator.
              </Text>

              {/* Modal Actions */}
              <View style={styles.superAdminOtpFooter}>
                <TouchableOpacity
                  style={styles.btnCancel}
                  onPress={() => setShowOtpModal(false)}
                >
                  <Text style={styles.btnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.btnVerifySuperAdmin,
                    (otpInput.length !== 6 || isVerifyingOtp) && { opacity: 0.6 }
                  ]}
                  onPress={handleVerifyOtp}
                  disabled={otpInput.length !== 6 || isVerifyingOtp}
                >
                  {isVerifyingOtp ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.btnVerifySuperAdminText}>
                      ✓ Verify OTP & Authorize Action
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
    fontSize: 11,
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
  superAdminCrownBadge: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 1
  },
  superAdminCrownText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400e'
  },
  userIdSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2
  },
  userEmailText: {
    fontSize: 12.5,
    color: '#334155',
    fontWeight: '600'
  },
  userMobileSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2
  },
  rolePill: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f1f5f9'
  },
  roleSuperAdmin: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b'
  },
  roleAdmin: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe'
  },
  roleScorer: {
    backgroundColor: '#fef3c7'
  },
  rolePlayer: {
    backgroundColor: '#ecfdf5'
  },
  rolePillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0f2452'
  },
  pendingBadge: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 7,
    alignSelf: 'flex-start'
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#b45309'
  },
  permanentSuperAdminTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  permanentSuperAdminTagText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1e3a8a'
  },
  btnApproveCompact: {
    backgroundColor: '#059669',
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  btnApproveCompactText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800'
  },
  btnRejectCompact: {
    backgroundColor: '#dc2626',
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  btnRejectCompactText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800'
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
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff'
  },
  actionBtnDanger: {
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2'
  },
  actionBtnSuccess: {
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16
  },
  modalDialog: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a'
  },
  modalBody: {
    padding: 20,
    maxHeight: 520
  },
  fieldGroup: {
    marginBottom: 14
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3
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
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
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
    fontSize: 12,
    fontWeight: '800',
    color: '#991b1b',
    marginBottom: 4
  },
  securityNoticeText: {
    fontSize: 11,
    color: '#7f1d1d',
    lineHeight: 15
  },
  btnProceedSuperAdmin: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#0f2452'
  },
  btnProceedSuperAdminText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  // Super Admin OTP Modal Styles
  superAdminOtpDialog: {
    maxWidth: 520,
    borderRadius: 16
  },
  superAdminOtpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff'
  },
  superAdminOtpIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center'
  },
  superAdminOtpTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a'
  },
  superAdminOtpSubtitle: {
    fontSize: 11,
    color: '#64748b'
  },
  superAdminActionBanner: {
    backgroundColor: '#f8fafc',
    borderLeftWidth: 4,
    borderLeftColor: '#0f2452',
    padding: 12,
    marginHorizontal: 20,
    marginTop: 14,
    borderRadius: 6
  },
  superAdminActionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f2452'
  },
  superAdminActionDesc: {
    fontSize: 11.5,
    color: '#475569',
    marginTop: 3
  },
  otpTimerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 6
  },
  otpTimerText: {
    fontSize: 12,
    color: '#d97706',
    fontWeight: '700'
  },
  otpResendText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '700'
  },
  superAdminOtpCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 20,
    marginVertical: 10
  },
  superAdminOtpCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 6
  },
  superAdminOtpLabel: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600'
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
  otpLargeInput: {
    height: 48,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 6,
    color: '#0f2452',
    backgroundColor: '#f8fafc',
    textAlign: 'center'
  },
  otpLargeInputValid: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4'
  },
  securityPolicyNote: {
    fontSize: 11,
    color: '#64748b',
    marginHorizontal: 20,
    marginBottom: 10,
    lineHeight: 15
  },
  superAdminOtpFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  btnVerifySuperAdmin: {
    backgroundColor: '#0f2452',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 180
  },
  btnVerifySuperAdminText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800'
  }
});

export default UsersPage;
