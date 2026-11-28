/**
 * src/admin/pages/UsersPage.tsx
 * 
 * Users & Dynamic Administrator Management Page for Cricket Association Admin Panel.
 * Implements strict Nodemailer Email OTP verification for Super Administrator (Apex Authority).
 * 
 * Invariants:
 * 1. Single Permanent Super Admin: Super Administrator (Apex Authority).
 * 2. Dynamic Administrators: created, approved, activated, suspended, or removed via Super Admin OTP.
 * 3. Responsive for Android, iPhone, tablet, and desktop viewports.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ActivityIndicator, ScrollView, Image, useWindowDimensions, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import PageHeader from '../components/PageHeader';
import DataTable, { ColumnDef } from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { EditIcon, CheckIcon, CloseIcon, EyeIcon, ShieldIcon } from '../components/Icons';
import { adminApi } from '../services/adminApi';
import { resolveImageUrl } from '../../services/api';
import { useAdminLayout } from '../components/AdminLayout';
import DualAdminSecurityModal from '../../components/admin/DualAdminSecurityModal';
import RegistrationScreen from '../../screens/auth/RegistrationScreen';

const PERMANENT_SUPER_ADMIN = 'Super Administrator';

export const UsersPage: React.FC = () => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isSmall = width < 480;
  const { showToast } = useAdminLayout();
  const [showDualSecurityModal, setShowDualSecurityModal] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [photoVerifyOnly, setPhotoVerifyOnly] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  // Edit / View Modal
  const [activeUser, setActiveUser] = useState<any | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editAadhaar, setEditAadhaar] = useState('');
  const [editRole, setEditRole] = useState('USER');
  const [editStatus, setEditStatus] = useState('ACTIVE');
  // Extended Registration Fields for Edit Mode
  const [editClub, setEditClub] = useState('');
  const [editFatherName, setEditFatherName] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editPlaceOfBirth, setEditPlaceOfBirth] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editTaluk, setEditTaluk] = useState('Virudhunagar');
  const [editCategory, setEditCategory] = useState('Senior Men');
  const [editPlayingRole, setEditPlayingRole] = useState('Batsman');
  const [editOccupationType, setEditOccupationType] = useState('STUDYING');
  const [editWorkingInst, setEditWorkingInst] = useState('');
  const [editStudyingInst, setEditStudyingInst] = useState('');
  const [editStudyLevel, setEditStudyLevel] = useState('COLLEGE');
  const [editBranchYearSec, setEditBranchYearSec] = useState('');
  const [editClassSection, setEditClassSection] = useState('');
  const [editBatterHand, setEditBatterHand] = useState('RH');
  const [editBatterPos, setEditBatterPos] = useState('TOP_ORDER');
  const [editBowlerHand, setEditBowlerHand] = useState('RH');
  const [editBowlerType, setEditBowlerType] = useState('MEDIUM');
  const [editIsKeeper, setEditIsKeeper] = useState(false);
  const [editDeclPlace, setEditDeclPlace] = useState('Virudhunagar');
  const [editDeclDate, setEditDeclDate] = useState('');
  const [editScorerCert, setEditScorerCert] = useState('');
  const [editUmpireQual, setEditUmpireQual] = useState('');
  const [editUmpireCertNo, setEditUmpireCertNo] = useState('');
  const [editUmpireExp, setEditUmpireExp] = useState('');
  const [editUmpireSpec, setEditUmpireSpec] = useState('');
  const [editUmpirePrevOrg, setEditUmpirePrevOrg] = useState('');
  const [editUmpireDistrict, setEditUmpireDistrict] = useState('');
  const [editUmpireState, setEditUmpireState] = useState('');

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
    user: any | null;
    targetStatus: string;
  }>({ visible: false, user: null, targetStatus: 'ACTIVE' });

  // Permanent User Deletion confirmation
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<{
    visible: boolean;
    user: any | null;
  }>({ visible: false, user: null });

  // Add User / Team Modal State (renders exact RegistrationScreen in adminMode)
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);

  // Admin Photo Verification Reason & Loading
  const [photoRejectReason, setPhotoRejectReason] = useState('');
  const [verifyingPhoto, setVerifyingPhoto] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getUsers({
        role: roleFilter !== 'ALL' ? roleFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined
      });
      if (res && res.success) {
        const nonAdminUsers = (res.users || []).filter(
          (u: any) => !['ADMIN', 'SUPER_ADMIN', 'COACH', 'SCORER'].includes((u.role || '').toUpperCase())
        );
        setUsers(nonAdminUsers);
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
    const pd = user.player_details || {};
    const sd = user.scorer_details || {};
    const ud = user.umpire_details || {};
    setActiveUser(user);
    setEditName(user.name || '');
    setEditEmail(user.email || '');
    setEditMobile(user.mobile || pd.phone || pd.mobile || '');
    setEditAadhaar(user.aadhaar || pd.aadhaar || pd.aadhaar_number || '');
    setEditRole(user.role || 'USER');
    setEditStatus(user.status || 'ACTIVE');
    setEditClub(pd.club_choice || '');
    setEditFatherName(pd.father_name || '');
    setEditDob(pd.date_of_birth || '');
    setEditAge(pd.age ? String(pd.age) : '');
    setEditPlaceOfBirth(pd.place_of_birth || '');
    setEditAddress(pd.address || '');
    setEditTaluk(pd.taluk || sd.taluk || ud.taluk || 'Virudhunagar');
    setEditCategory(pd.category || 'Senior Men');
    setEditPlayingRole(pd.role || pd.playing_role || 'Batsman');
    setEditOccupationType(pd.occupation_type || (pd.working_institution ? 'WORKING' : 'STUDYING'));
    setEditWorkingInst(pd.working_institution || '');
    setEditStudyingInst(pd.studying_institution || '');
    setEditStudyLevel(pd.study_level || (pd.class_section ? 'SCHOOL' : 'COLLEGE'));
    setEditBranchYearSec(pd.branch_year_sec || '');
    setEditClassSection(pd.class_section || '');
    setEditBatterHand(pd.batter_hand || 'RH');
    setEditBatterPos(pd.batter_position || 'TOP_ORDER');
    setEditBowlerHand(pd.bowler_hand || '');
    setEditBowlerType(pd.bowler_type || '');
    setEditIsKeeper(Boolean(pd.is_wicket_keeper));
    setEditDeclPlace(pd.declaration_place || pd.taluk || 'Virudhunagar');
    setEditDeclDate(pd.declaration_date || '');
    setEditScorerCert(sd.certification_level || '');
    setEditUmpireQual(ud.qualification || ud.certification_level || '');
    setEditUmpireCertNo(ud.certification_number || '');
    setEditUmpireExp(ud.experience || '');
    setEditUmpireSpec(ud.specialization || '');
    setEditUmpirePrevOrg(ud.previous_organization || '');
    setEditUmpireDistrict(ud.district || '');
    setEditUmpireState(ud.state || 'Tamil Nadu');
    setIsEditMode(true);
  };

  // 1. Initiate Add New Administrator (Triggers Nodemailer OTP to Super Administrator)
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
        showToast('Nodemailer verification code dispatched to Super Administrator', 'info');
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
        aadhaar: editAadhaar.trim(),
        role: editRole,
        status: editStatus,
        ...(String(editRole).toUpperCase() === 'PLAYER' ? {
          player_details: {
            club_choice: editClub.trim(),
            father_name: editFatherName.trim(),
            date_of_birth: editDob.trim(),
            age: editAge.trim(),
            place_of_birth: editPlaceOfBirth.trim(),
            address: editAddress.trim(),
            taluk: editTaluk,
            category: editCategory,
            role: editPlayingRole,
            playing_role: editPlayingRole,
            occupation_type: editOccupationType,
            working_institution: editOccupationType === 'WORKING' ? editWorkingInst.trim() : '',
            studying_institution: editOccupationType === 'STUDYING' ? editStudyingInst.trim() : '',
            study_level: editOccupationType === 'STUDYING' ? editStudyLevel : '',
            branch_year_sec: editOccupationType === 'STUDYING' && editStudyLevel === 'COLLEGE' ? editBranchYearSec.trim() : '',
            class_section: editOccupationType === 'STUDYING' && editStudyLevel === 'SCHOOL' ? editClassSection.trim() : '',
            batter_hand: editBatterHand,
            batter_position: editBatterPos,
            bowler_hand: editBowlerHand,
            bowler_type: editBowlerType,
            is_wicket_keeper: editIsKeeper,
            declaration_place: editDeclPlace.trim(),
            declaration_date: editDeclDate.trim()
          }
        } : {}),
        ...(String(editRole).toUpperCase() === 'SCORER' ? {
          scorer_details: {
            certification_level: editScorerCert.trim(),
            taluk: editTaluk
          }
        } : {}),
        ...(String(editRole).toUpperCase() === 'UMPIRE' ? {
          umpire_details: {
            qualification: editUmpireQual.trim(),
            certification_level: editUmpireQual.trim(),
            certification_number: editUmpireCertNo.trim(),
            experience: editUmpireExp.trim(),
            specialization: editUmpireSpec.trim(),
            previous_organization: editUmpirePrevOrg.trim(),
            district: editUmpireDistrict.trim() || editTaluk,
            taluk: editUmpireDistrict.trim() || editTaluk,
            state: editUmpireState.trim()
          }
        } : {})
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

  const handleConfirmDeleteUser = async () => {
    const user = confirmDeleteUser.user;
    setConfirmDeleteUser({ visible: false, user: null });
    if (!user) return;
    try {
      await adminApi.deleteUser(user.id);
      showToast(`${user.name} permanently deleted. They must register again to access the portal.`, 'success');
      loadUsers();
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, 'error');
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
                <View style={[styles.superAdminCrownBadge, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                  <MaterialCommunityIcons name="crown" size={12} color="#b45309" />
                  <Text style={styles.superAdminCrownText}>Super Admin</Text>
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
          {item.mobile && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Ionicons name="call-outline" size={11} color="#64748b" />
              <Text style={styles.userMobileSub}>{item.mobile}</Text>
            </View>
          )}
          {item.aadhaar && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Ionicons name="card-outline" size={11} color="#991b1b" />
              <Text style={{ color: '#991b1b', fontSize: 10, fontWeight: '700' }}>UIDAI: {item.aadhaar}</Text>
            </View>
          )}
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
            <View style={[styles.pendingBadge, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
              <Ionicons name="hourglass-outline" size={11} color="#b45309" />
              <Text style={styles.pendingBadgeText}>PENDING APPROVAL</Text>
            </View>
          );
        }
        const pvs = String(item.photo_verification_status || item.player_details?.photo_verification_status || '').toUpperCase();
        return (
          <View style={{ gap: 4, alignItems: 'flex-start' }}>
            <StatusBadge status={item.status || 'ACTIVE'} size="sm" />
            {String(item.role || '').toUpperCase() === 'PLAYER' && (pvs === 'PENDING_REVIEW' || pvs === 'REJECTED') && (
              <View style={{ backgroundColor: pvs === 'REJECTED' ? '#fef2f2' : '#fffbeb', borderWidth: 1, borderColor: pvs === 'REJECTED' ? '#fca5a5' : '#fcd34d', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 9.5, fontWeight: '800', color: pvs === 'REJECTED' ? '#dc2626' : '#b45309' }}>
                  {pvs === 'REJECTED' ? '✕ PHOTO REJECTED' : '📸 FOR VERIFY'}
                </Text>
              </View>
            )}
          </View>
        );
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
                style={[styles.btnApproveCompact, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                onPress={() => handleInitiateApproveAdmin(item)}
              >
                <Ionicons name="checkmark" size={12} color="#ffffff" />
                <Text style={styles.btnApproveCompactText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnRejectCompact, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                onPress={() => handleInitiateRejectAdmin(item)}
              >
                <Ionicons name="close" size={12} color="#ffffff" />
                <Text style={styles.btnRejectCompactText}>Reject</Text>
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

            {isDynamicAdmin ? (
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: '#fca5a5', backgroundColor: '#fef2f2' }]}
                onPress={() => handleInitiateAdminStatusAction(item, 'REMOVE_ADMIN')}
                accessibilityLabel="Remove Administrator"
              >
                <Ionicons name="trash-outline" size={13} color="#dc2626" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: '#fca5a5', backgroundColor: '#fef2f2' }]}
                onPress={() => setConfirmDeleteUser({ visible: true, user: item })}
                accessibilityLabel="Delete User Permanently"
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
      {/* Top Right Professional Action Buttons (Highlighted header text removed per request) */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 14 }}>
        <View style={[styles.headerActionsWrap, isMobile && { width: '100%', gap: 8 }]}>
          <TouchableOpacity
            style={[
              styles.addAdminBtn,
              { backgroundColor: '#059669' },
              isMobile && { flex: 1, minWidth: 130, justifyContent: 'center', paddingHorizontal: 10 }
            ]}
            onPress={() => setShowAddUserModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.addAdminBtnText} numberOfLines={1}>+ Add User</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.addAdminBtn,
              { backgroundColor: '#0284c7' },
              isMobile && { flex: 1, minWidth: 130, justifyContent: 'center', paddingHorizontal: 10 }
            ]}
            onPress={() => setShowAddTeamModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.addAdminBtnText} numberOfLines={1}>+ Add Team</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.addAdminBtn,
              { backgroundColor: '#b91c1c' },
              isMobile && { flex: 1, minWidth: 140, justifyContent: 'center', paddingHorizontal: 10 }
            ]}
            onPress={() => setShowDualSecurityModal(true)}
            activeOpacity={0.8}
          >
            <ShieldIcon size={15} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.addAdminBtnText} numberOfLines={1}>🛡️ Dual-Admin Security</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.addAdminBtn,
              isMobile && { flex: 1, minWidth: 140, justifyContent: 'center', paddingHorizontal: 10 }
            ]}
            onPress={() => setShowAddAdminModal(true)}
            activeOpacity={0.8}
          >
            <ShieldIcon size={15} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.addAdminBtnText} numberOfLines={1}>+ Add Administrator</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Role & Status Filter Dropdowns */}
      <View style={[styles.filtersBar, { zIndex: 50, position: 'relative' }]}>
        <View style={styles.filterDropdownsRow}>
          {/* Role Filter Dropdown */}
          <View style={[styles.filterDropdownCol, roleDropdownOpen && { zIndex: 100 }]}>
            <Text style={styles.filterLabel}>Role Filter:</Text>
            <View style={{ position: 'relative', flex: 1 }}>
              <TouchableOpacity
                style={[styles.dropdownTrigger, roleDropdownOpen && styles.dropdownTriggerActive]}
                onPress={() => {
                  setRoleDropdownOpen(prev => !prev);
                  setStatusDropdownOpen(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.dropdownTriggerText} numberOfLines={1}>
                  {roleFilter === 'ADMIN' ? 'ADMINISTRATORS' : roleFilter}
                </Text>
                <Text style={styles.dropdownCaret}>{roleDropdownOpen ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {roleDropdownOpen && (
                <View style={styles.dropdownMenu}>
                  {['ALL', 'ADMIN', 'PLAYER', 'USER'].map(r => {
                    const label = r === 'ADMIN' ? 'ADMINISTRATORS' : r;
                    const isSelected = roleFilter === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[styles.dropdownMenuItem, isSelected && styles.dropdownMenuItemActive]}
                        onPress={() => {
                          setRoleFilter(r);
                          setRoleDropdownOpen(false);
                        }}
                      >
                        <Text style={[styles.dropdownMenuItemText, isSelected && styles.dropdownMenuItemTextActive]}>
                          {label}
                        </Text>
                        {isSelected && <Text style={styles.dropdownCheck}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>

          {/* Status Filter Dropdown */}
          <View style={[styles.filterDropdownCol, statusDropdownOpen && { zIndex: 100 }]}>
            <Text style={styles.filterLabel}>Status:</Text>
            <View style={{ position: 'relative', flex: 1 }}>
              <TouchableOpacity
                style={[styles.dropdownTrigger, statusDropdownOpen && styles.dropdownTriggerActive]}
                onPress={() => {
                  setStatusDropdownOpen(prev => !prev);
                  setRoleDropdownOpen(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.dropdownTriggerText} numberOfLines={1}>
                  {statusFilter}
                </Text>
                <Text style={styles.dropdownCaret}>{statusDropdownOpen ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {statusDropdownOpen && (
                <View style={styles.dropdownMenu}>
                  {['ALL', 'ACTIVE', 'PENDING', 'SUSPENDED'].map(s => {
                    const isSelected = statusFilter === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[styles.dropdownMenuItem, isSelected && styles.dropdownMenuItemActive]}
                        onPress={() => {
                          setStatusFilter(s);
                          setStatusDropdownOpen(false);
                        }}
                      >
                        <Text style={[styles.dropdownMenuItemText, isSelected && styles.dropdownMenuItemTextActive]}>
                          {s}
                        </Text>
                        {isSelected && <Text style={styles.dropdownCheck}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>

          {/* For Photo Verification Queue Toggle */}
          <View style={{ justifyContent: 'flex-end' }}>
            {(() => {
              const forVerifyCount = users.filter(u => {
                const pvs = String(u.photo_verification_status || u.player_details?.photo_verification_status || '').toUpperCase();
                return String(u.role || '').toUpperCase() === 'PLAYER' && (pvs === 'PENDING_REVIEW' || pvs === 'REJECTED');
              }).length;
              return (
                <TouchableOpacity
                  onPress={() => setPhotoVerifyOnly(prev => !prev)}
                  style={{
                    backgroundColor: photoVerifyOnly ? '#b45309' : '#fffbeb',
                    borderWidth: 1.5,
                    borderColor: '#f59e0b',
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Text style={{ fontSize: 12.5, fontWeight: '800', color: photoVerifyOnly ? '#ffffff' : '#92400e' }}>
                    📸 For Verify ({forVerifyCount})
                  </Text>
                </TouchableOpacity>
              );
            })()}
          </View>
        </View>
      </View>

      {/* Users DataTable */}
      <DataTable
        data={photoVerifyOnly ? users.filter(u => {
          const pvs = String(u.photo_verification_status || u.player_details?.photo_verification_status || '').toUpperCase();
          return String(u.role || '').toUpperCase() === 'PLAYER' && (pvs === 'PENDING_REVIEW' || pvs === 'REJECTED');
        }) : users}
        columns={columns}
        keyExtractor={item => item.id}
        loading={loading}
        searchPlaceholder="Search by name, Player ID, email, or mobile..."
        searchFields={['id', 'player_id', 'playerId', 'name', 'email', 'mobile', 'role', 'admin_level']}
        emptyTitle="No accounts found"
        emptyDescription="No registered users or administrators match the specified search or filter criteria."
      />

      {/* View / Edit Modal */}
      {activeUser && (
        <Modal visible={Boolean(activeUser)} transparent animationType="fade" onRequestClose={() => setActiveUser(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalDialog, (isEditMode || String(activeUser.role || '').toUpperCase() === 'PLAYER') && { maxWidth: 820, width: '96%', maxHeight: '94%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isEditMode ? 'Edit User Record' : (String(activeUser.role || '').toUpperCase() === 'PLAYER' ? "Player's Registration Form (Official Document)" : 'User Account Details')}
                </Text>
                <TouchableOpacity onPress={() => setActiveUser(null)}>
                  <CloseIcon size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              {isEditMode ? (
                <ScrollView style={{ maxHeight: 580 }} contentContainerStyle={styles.modalBody}>
                  <View style={styles.fieldRow}>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>Full Name</Text>
                      <TextInput style={styles.fieldInput} value={editName} onChangeText={setEditName} />
                    </View>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>Email Address</Text>
                      <TextInput style={styles.fieldInput} value={editEmail} onChangeText={setEditEmail} keyboardType="email-address" autoCapitalize="none" />
                    </View>
                  </View>
                  <View style={styles.fieldRow}>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>Mobile Number</Text>
                      <TextInput style={styles.fieldInput} value={editMobile} onChangeText={setEditMobile} keyboardType="phone-pad" maxLength={10} />
                    </View>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>Aadhaar (UIDAI 12 Digits)</Text>
                      <TextInput style={styles.fieldInput} value={editAadhaar} onChangeText={setEditAadhaar} keyboardType="number-pad" maxLength={14} />
                    </View>
                  </View>
                  <View style={styles.fieldRow}>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>Role</Text>
                      <View style={styles.roleSelectRow}>
                        {['PLAYER', 'TEAM', 'SCORER', 'UMPIRE', 'ADMIN', 'USER'].map(r => (
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
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>Account Status</Text>
                      <View style={styles.roleSelectRow}>
                        {['ACTIVE', 'PENDING', 'INACTIVE', 'SUSPENDED'].map(s => (
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

                  {String(editRole).toUpperCase() === 'PLAYER' && (
                    <>
                      <View style={{ borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10, marginTop: 4 }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#0f2452', marginBottom: 8 }}>
                          Official CFVD Player Registration Details
                        </Text>
                      </View>
                      <View style={styles.fieldRow}>
                        <View style={[styles.fieldGroup, { flex: 1.3 }]}>
                          <Text style={styles.fieldLabel}>Club / School / College / Academy</Text>
                          <TextInput style={styles.fieldInput} value={editClub} onChangeText={setEditClub} />
                        </View>
                        <View style={[styles.fieldGroup, { flex: 1 }]}>
                          <Text style={styles.fieldLabel}>Father&apos;s Name</Text>
                          <TextInput style={styles.fieldInput} value={editFatherName} onChangeText={setEditFatherName} />
                        </View>
                      </View>
                      <View style={styles.fieldRow}>
                        <View style={[styles.fieldGroup, { flex: 1 }]}>
                          <Text style={styles.fieldLabel}>Date of Birth</Text>
                          <TextInput style={styles.fieldInput} value={editDob} onChangeText={setEditDob} placeholder="DD/MM/YYYY" />
                        </View>
                        <View style={[styles.fieldGroup, { flex: 0.6 }]}>
                          <Text style={styles.fieldLabel}>Age</Text>
                          <TextInput style={styles.fieldInput} value={editAge} onChangeText={setEditAge} keyboardType="number-pad" />
                        </View>
                        <View style={[styles.fieldGroup, { flex: 1 }]}>
                          <Text style={styles.fieldLabel}>Place of Birth</Text>
                          <TextInput style={styles.fieldInput} value={editPlaceOfBirth} onChangeText={setEditPlaceOfBirth} />
                        </View>
                      </View>
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Address for Communication</Text>
                        <TextInput style={[styles.fieldInput, { minHeight: 54 }]} multiline value={editAddress} onChangeText={setEditAddress} />
                      </View>
                      <View style={styles.fieldRow}>
                        <View style={[styles.fieldGroup, { flex: 1 }]}>
                          <Text style={styles.fieldLabel}>Taluk Jurisdiction</Text>
                          <TextInput style={styles.fieldInput} value={editTaluk} onChangeText={setEditTaluk} />
                        </View>
                        <View style={[styles.fieldGroup, { flex: 1 }]}>
                          <Text style={styles.fieldLabel}>Age Category</Text>
                          <TextInput style={styles.fieldInput} value={editCategory} onChangeText={setEditCategory} />
                        </View>
                        <View style={[styles.fieldGroup, { flex: 1 }]}>
                          <Text style={styles.fieldLabel}>Playing Role</Text>
                          <TextInput style={styles.fieldInput} value={editPlayingRole} onChangeText={setEditPlayingRole} />
                        </View>
                      </View>
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Occupation Status</Text>
                        <View style={styles.roleSelectRow}>
                          {['STUDYING', 'WORKING', 'NONE'].map(occ => (
                            <TouchableOpacity key={occ} style={[styles.roleSelectChip, editOccupationType === occ && styles.roleSelectChipActive]} onPress={() => setEditOccupationType(occ)}>
                              <Text style={[styles.roleSelectText, editOccupationType === occ && styles.roleSelectTextActive]}>{occ}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                      {editOccupationType === 'WORKING' && (
                        <View style={styles.fieldGroup}>
                          <Text style={styles.fieldLabel}>Working Institution / Bank / Govt Office</Text>
                          <TextInput style={styles.fieldInput} value={editWorkingInst} onChangeText={setEditWorkingInst} />
                        </View>
                      )}
                      {editOccupationType === 'STUDYING' && (
                        <View style={{ gap: 8 }}>
                          <View style={styles.roleSelectRow}>
                            {['COLLEGE', 'SCHOOL'].map(lvl => (
                              <TouchableOpacity key={lvl} style={[styles.roleSelectChip, editStudyLevel === lvl && styles.roleSelectChipActive]} onPress={() => setEditStudyLevel(lvl)}>
                                <Text style={[styles.roleSelectText, editStudyLevel === lvl && styles.roleSelectTextActive]}>{lvl}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          <View style={styles.fieldRow}>
                            <View style={[styles.fieldGroup, { flex: 1.2 }]}>
                              <Text style={styles.fieldLabel}>School / College Name</Text>
                              <TextInput style={styles.fieldInput} value={editStudyingInst} onChangeText={setEditStudyingInst} />
                            </View>
                            <View style={[styles.fieldGroup, { flex: 1 }]}>
                              <Text style={styles.fieldLabel}>{editStudyLevel === 'COLLEGE' ? 'Branch & Year & Sec' : 'Class & Section'}</Text>
                              <TextInput
                                style={styles.fieldInput}
                                value={editStudyLevel === 'COLLEGE' ? editBranchYearSec : editClassSection}
                                onChangeText={editStudyLevel === 'COLLEGE' ? setEditBranchYearSec : setEditClassSection}
                              />
                            </View>
                          </View>
                        </View>
                      )}
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Proficiency (Batter / Bowler / Wicket Keeper)</Text>
                        <View style={styles.roleSelectRow}>
                          {['RH', 'LH'].map(h => (
                            <TouchableOpacity key={h} style={[styles.roleSelectChip, editBatterHand === h && styles.roleSelectChipActive]} onPress={() => setEditBatterHand(h)}>
                              <Text style={[styles.roleSelectText, editBatterHand === h && styles.roleSelectTextActive]}>Batter: {h}</Text>
                            </TouchableOpacity>
                          ))}
                          {['OPEN', 'TOP_ORDER', 'MIDDLE_ORDER'].map(pos => (
                            <TouchableOpacity key={pos} style={[styles.roleSelectChip, editBatterPos === pos && styles.roleSelectChipActive]} onPress={() => setEditBatterPos(pos)}>
                              <Text style={[styles.roleSelectText, editBatterPos === pos && styles.roleSelectTextActive]}>{pos.replace('_', ' ')}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <View style={[styles.roleSelectRow, { marginTop: 6 }]}>
                          {['RH', 'LH', ''].map(bh => (
                            <TouchableOpacity key={bh || 'NONE'} style={[styles.roleSelectChip, editBowlerHand === bh && styles.roleSelectChipActive]} onPress={() => setEditBowlerHand(bh)}>
                              <Text style={[styles.roleSelectText, editBowlerHand === bh && styles.roleSelectTextActive]}>Bowler: {bh || 'None'}</Text>
                            </TouchableOpacity>
                          ))}
                          {['MEDIUM', 'OFF_SPIN', 'LEG_SPINNER', 'ORTHODOX', 'CHINAMAN'].map(bt => (
                            <TouchableOpacity key={bt} style={[styles.roleSelectChip, editBowlerType === bt && styles.roleSelectChipActive]} onPress={() => setEditBowlerType(bt)}>
                              <Text style={[styles.roleSelectText, editBowlerType === bt && styles.roleSelectTextActive]}>{bt.replace('_', ' ')}</Text>
                            </TouchableOpacity>
                          ))}
                          <TouchableOpacity style={[styles.roleSelectChip, editIsKeeper && styles.roleSelectChipActive]} onPress={() => setEditIsKeeper(!editIsKeeper)}>
                            <Text style={[styles.roleSelectText, editIsKeeper && styles.roleSelectTextActive]}>Keeper: {editIsKeeper ? 'YES' : 'NO'}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={styles.fieldRow}>
                        <View style={[styles.fieldGroup, { flex: 1 }]}>
                          <Text style={styles.fieldLabel}>Declaration Place</Text>
                          <TextInput style={styles.fieldInput} value={editDeclPlace} onChangeText={setEditDeclPlace} />
                        </View>
                        <View style={[styles.fieldGroup, { flex: 1 }]}>
                          <Text style={styles.fieldLabel}>Declaration Date</Text>
                          <TextInput style={styles.fieldInput} value={editDeclDate} onChangeText={setEditDeclDate} />
                        </View>
                      </View>
                    </>
                  )}

                  {String(editRole).toUpperCase() === 'SCORER' && (
                    <View style={styles.fieldRow}>
                      <View style={[styles.fieldGroup, { flex: 1 }]}>
                        <Text style={styles.fieldLabel}>Certification Level</Text>
                        <TextInput style={styles.fieldInput} value={editScorerCert} onChangeText={setEditScorerCert} />
                      </View>
                      <View style={[styles.fieldGroup, { flex: 1 }]}>
                        <Text style={styles.fieldLabel}>Taluk Jurisdiction</Text>
                        <TextInput style={styles.fieldInput} value={editTaluk} onChangeText={setEditTaluk} />
                      </View>
                    </View>
                  )}

                  {String(editRole).toUpperCase() === 'UMPIRE' && (
                    <>
                      <View style={styles.fieldRow}>
                        <View style={[styles.fieldGroup, { flex: 1 }]}>
                          <Text style={styles.fieldLabel}>Qualification / Panel</Text>
                          <TextInput style={styles.fieldInput} value={editUmpireQual} onChangeText={setEditUmpireQual} />
                        </View>
                        <View style={[styles.fieldGroup, { flex: 1 }]}>
                          <Text style={styles.fieldLabel}>Certification Number</Text>
                          <TextInput style={styles.fieldInput} value={editUmpireCertNo} onChangeText={setEditUmpireCertNo} />
                        </View>
                      </View>
                      <View style={styles.fieldRow}>
                        <View style={[styles.fieldGroup, { flex: 1 }]}>
                          <Text style={styles.fieldLabel}>Experience</Text>
                          <TextInput style={styles.fieldInput} value={editUmpireExp} onChangeText={setEditUmpireExp} />
                        </View>
                        <View style={[styles.fieldGroup, { flex: 1 }]}>
                          <Text style={styles.fieldLabel}>Specialization</Text>
                          <TextInput style={styles.fieldInput} value={editUmpireSpec} onChangeText={setEditUmpireSpec} />
                        </View>
                      </View>
                      <View style={styles.fieldRow}>
                        <View style={[styles.fieldGroup, { flex: 1 }]}>
                          <Text style={styles.fieldLabel}>Previous Organization</Text>
                          <TextInput style={styles.fieldInput} value={editUmpirePrevOrg} onChangeText={setEditUmpirePrevOrg} />
                        </View>
                        <View style={[styles.fieldGroup, { flex: 1 }]}>
                          <Text style={styles.fieldLabel}>District / Taluk</Text>
                          <TextInput style={styles.fieldInput} value={editUmpireDistrict} onChangeText={setEditUmpireDistrict} />
                        </View>
                        <View style={[styles.fieldGroup, { flex: 1 }]}>
                          <Text style={styles.fieldLabel}>State</Text>
                          <TextInput style={styles.fieldInput} value={editUmpireState} onChangeText={setEditUmpireState} />
                        </View>
                      </View>
                    </>
                  )}
                </ScrollView>
              ) : String(activeUser.role || '').toUpperCase() === 'PLAYER' ? (
                <ScrollView style={{ maxHeight: 580 }} contentContainerStyle={{ padding: 14 }}>
                  {(() => {
                    const pd = activeUser.player_details || {};
                    const photoUri = activeUser.photo || activeUser.image_path || pd.photo || pd.image_path || '';
                    const tick = (cond: boolean) => (cond ? '☑' : '☐');
                    const batterHand = String(pd.batter_hand || (String(pd.batting_style || '').toLowerCase().includes('left') ? 'LH' : 'RH')).toUpperCase();
                    const batterPos = String(pd.batter_position || '').toUpperCase();
                    const bowlerHand = String(pd.bowler_hand || (String(pd.bowling_arm || '').toLowerCase().includes('left') ? 'LH' : (String(pd.bowling_arm || '').toLowerCase().includes('right') ? 'RH' : ''))).toUpperCase();
                    const bowlerType = String(pd.bowler_type || pd.bowling_style || '').toUpperCase();
                    const isKeeper = Boolean(pd.is_wicket_keeper || String(pd.role || '').toLowerCase().includes('keeper'));
                    return (
                      <View style={{ backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#0f172a', padding: 12, borderRadius: 4 }}>
                        {/* Header */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1.5, borderBottomColor: '#0f172a', paddingBottom: 8, marginBottom: 8 }}>
                          <Image source={require('../../../assets/logo_transparent.png')} style={{ width: 52, height: 52 }} resizeMode="contain" />
                          <View style={{ flex: 1, alignItems: 'center' }}>
                            <Text style={{ fontSize: 13.5, fontWeight: '900', color: '#0f172a', textAlign: 'center' }}>
                              CRICKET FEDERATION OF VIRUDHUNAGAR DISTRICT
                            </Text>
                            <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#334155', textAlign: 'center' }}>
                              (Registered under Tamilnadu Societies Act 1975)
                            </Text>
                            <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#0f172a', textAlign: 'center' }}>
                              Reg. No: SRG/VIRUDHUNAGAR/84/2026
                            </Text>
                          </View>
                        </View>

                        <Text style={{ fontSize: 12.5, fontWeight: '900', color: '#0f172a', textAlign: 'center', marginBottom: 8, textDecorationLine: 'underline' }}>
                          PLAYER&apos;S REGISTRATION FORM ({activeUser.id})
                        </Text>

                        {/* Grid Rows */}
                        <View style={{ borderWidth: 1, borderColor: '#0f172a' }}>
                          {/* Club / School / College / Academy */}
                          <View style={{ flexDirection: isMobile ? 'column' : 'row', borderBottomWidth: 1, borderBottomColor: '#0f172a' }}>
                            <View style={{ flex: 1, padding: 6, borderRightWidth: isMobile ? 0 : 1, borderRightColor: '#0f172a', backgroundColor: '#f8fafc' }}>
                              <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#0f172a' }}>NAME OF CLUB / SCHOOL / COLLEGE / ACADEMY:</Text>
                            </View>
                            <View style={{ flex: 1.4, padding: 6 }}>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#0f172a' }}>{pd.club_choice || 'Not specified'}</Text>
                            </View>
                          </View>

                          {/* Name, Father's Name & Photo */}
                          <View style={{ flexDirection: isMobile ? 'column' : 'row', borderBottomWidth: 1, borderBottomColor: '#0f172a' }}>
                            <View style={{ flex: 2.2, borderRightWidth: isMobile ? 0 : 1, borderRightColor: '#0f172a' }}>
                              <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#0f172a' }}>
                                <View style={{ flex: 1, padding: 6, borderRightWidth: 1, borderRightColor: '#0f172a' }}>
                                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#475569' }}>NAME OF THE PLAYER</Text>
                                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#0f172a', marginTop: 2 }}>{activeUser.name}</Text>
                                </View>
                                <View style={{ flex: 1, padding: 6 }}>
                                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#475569' }}>FATHER&apos;S NAME</Text>
                                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#0f172a', marginTop: 2 }}>{pd.father_name || 'Not specified'}</Text>
                                </View>
                              </View>
                              <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#0f172a' }}>
                                <View style={{ flex: 1, padding: 6, borderRightWidth: 1, borderRightColor: '#0f172a' }}>
                                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#475569' }}>DATE OF BIRTH</Text>
                                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#0f172a', marginTop: 2 }}>{pd.date_of_birth || '—'}</Text>
                                </View>
                                <View style={{ flex: 0.6, padding: 6, borderRightWidth: 1, borderRightColor: '#0f172a' }}>
                                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#475569' }}>AGE</Text>
                                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#0f172a', marginTop: 2 }}>{pd.age || '—'}</Text>
                                </View>
                                <View style={{ flex: 1.2, padding: 6 }}>
                                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#475569' }}>AADHAR NUMBER</Text>
                                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#991b1b', marginTop: 2 }}>{activeUser.aadhaar || pd.aadhaar || 'Not specified'}</Text>
                                </View>
                              </View>
                              <View style={{ padding: 6 }}>
                                <Text style={{ fontSize: 9, fontWeight: '800', color: '#475569' }}>
                                  ADDRESS FOR COMMUNICATION <Text style={{ fontSize: 8, fontWeight: '600' }}>(ADDRESS PROOF REQUIRED AADHAR CARD (OR) PASSPORT COPY MUST BE ATTACHED)</Text>
                                </Text>
                                <Text style={{ fontSize: 11, color: '#0f172a', marginTop: 2 }}>{pd.address || 'Not specified'}</Text>
                              </View>
                            </View>
                            {/* Passport Photo Box */}
                            <View style={{ flex: 0.8, padding: 8, alignItems: 'center', justifyContent: 'center', minHeight: 110 }}>
                              {photoUri ? (
                                <Image source={{ uri: photoUri }} style={{ width: 82, height: 98, borderWidth: 1, borderColor: '#0f172a' }} resizeMode="cover" />
                              ) : (
                                <View style={{ width: 82, height: 98, borderWidth: 1, borderStyle: 'dashed', borderColor: '#64748b', alignItems: 'center', justifyContent: 'center', padding: 4 }}>
                                  <Text style={{ fontSize: 8.5, textAlign: 'center', color: '#64748b', fontWeight: '700' }}>AFFIX PASSPORT SIZE PHOTO</Text>
                                </View>
                              )}
                            </View>
                          </View>

                          {/* Working / Place of Birth / Contact */}
                          <View style={{ flexDirection: isMobile ? 'column' : 'row', borderBottomWidth: 1, borderBottomColor: '#0f172a' }}>
                            <View style={{ flex: 1.2, padding: 6, borderRightWidth: isMobile ? 0 : 1, borderRightColor: '#0f172a' }}>
                              <Text style={{ fontSize: 8.5, fontWeight: '800', color: '#475569' }}>
                                IF WORKING NAME OF THE INSTITUTION/BANK/ANY GOVT OFFICES <Text style={{ fontSize: 7.5, fontWeight: '600' }}>(TO BE SUBMITTED APPOINTMENT ORDER BY THE HEAD OF THE INSTITUTION / GAZETTED OFFICER IS REQUIRED)</Text>
                              </Text>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#0f172a', marginTop: 2 }}>{pd.working_institution || '—'}</Text>
                            </View>
                            <View style={{ flex: 1, padding: 6, borderRightWidth: isMobile ? 0 : 1, borderRightColor: '#0f172a' }}>
                              <Text style={{ fontSize: 8.5, fontWeight: '800', color: '#475569' }}>
                                PLACE OF BIRTH <Text style={{ fontSize: 7.5, fontWeight: '600' }}>(BIRTH CERTIFICATE TO BE ATTACHED)</Text>
                              </Text>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#0f172a', marginTop: 2 }}>{pd.place_of_birth || '—'}</Text>
                            </View>
                            <View style={{ flex: 1, padding: 6 }}>
                              <Text style={{ fontSize: 9, fontWeight: '800', color: '#475569' }}>CONTACT NUMBER</Text>
                              <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#0f2452', marginTop: 2 }}>{activeUser.mobile || pd.phone || 'Not specified'}</Text>
                            </View>
                          </View>

                          {/* Studying / College & School Split / Email */}
                          <View style={{ flexDirection: isMobile ? 'column' : 'row', borderBottomWidth: 1, borderBottomColor: '#0f172a' }}>
                            <View style={{ flex: 1.2, padding: 6, borderRightWidth: isMobile ? 0 : 1, borderRightColor: '#0f172a' }}>
                              <Text style={{ fontSize: 8.5, fontWeight: '800', color: '#475569' }}>
                                IF STUDYING NAME OF THE SCHOOL/COLLEGE <Text style={{ fontSize: 7.5, fontWeight: '600' }}>(TO BE ATTESTED BY THE HEAD OF THE INSTITUTION OF BONAFIDE CERTIFICATE IS REQUIRED)</Text>
                              </Text>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#0f172a', marginTop: 2 }}>{pd.studying_institution || '—'}</Text>
                            </View>
                            <View style={{ flex: 1, flexDirection: 'row', borderRightWidth: isMobile ? 0 : 1, borderRightColor: '#0f172a' }}>
                              <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: '#0f172a' }}>
                                <Text style={{ fontSize: 8.5, fontWeight: '900', color: '#0f172a', textAlign: 'center', borderBottomWidth: 1, borderBottomColor: '#0f172a', paddingVertical: 3, backgroundColor: '#f8fafc' }}>COLLEGE</Text>
                                <Text style={{ fontSize: 7.5, fontWeight: '800', color: '#475569', textAlign: 'center', borderBottomWidth: 1, borderBottomColor: '#0f172a', paddingVertical: 2 }}>BRANCH & YEAR & SEC</Text>
                                <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#0f172a', padding: 5, textAlign: 'center' }}>{pd.branch_year_sec || '—'}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 8.5, fontWeight: '900', color: '#0f172a', textAlign: 'center', borderBottomWidth: 1, borderBottomColor: '#0f172a', paddingVertical: 3, backgroundColor: '#f8fafc' }}>SCHOOL</Text>
                                <Text style={{ fontSize: 7.5, fontWeight: '800', color: '#475569', textAlign: 'center', borderBottomWidth: 1, borderBottomColor: '#0f172a', paddingVertical: 2 }}>CLASS & SECTION</Text>
                                <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#0f172a', padding: 5, textAlign: 'center' }}>{pd.class_section || '—'}</Text>
                              </View>
                            </View>
                            <View style={{ flex: 1, padding: 6 }}>
                              <Text style={{ fontSize: 9, fontWeight: '800', color: '#475569' }}>E-MAIL ID</Text>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#0369a1', marginTop: 2 }}>{activeUser.email}</Text>
                            </View>
                          </View>

                          {/* Proficiency */}
                          <View style={{ flexDirection: isMobile ? 'column' : 'row' }}>
                            <View style={{ flex: 0.9, padding: 6, borderRightWidth: isMobile ? 0 : 1, borderRightColor: '#0f172a', justifyContent: 'center' }}>
                              <Text style={{ fontSize: 10, fontWeight: '800', color: '#0f172a' }}>PROFICIENCY</Text>
                              <Text style={{ fontSize: 9, color: '#64748b' }}>({pd.role || 'Player'} • {pd.category || 'Senior'})</Text>
                            </View>
                            <View style={{ flex: 1.5, padding: 6, borderRightWidth: isMobile ? 0 : 1, borderRightColor: '#0f172a', gap: 4 }}>
                              <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#0f172a' }}>
                                BATTER: {tick(batterHand === 'RH')} RH  {tick(batterHand === 'LH')} LH
                              </Text>
                              <Text style={{ fontSize: 10, color: '#334155' }}>
                                {tick(batterPos === 'OPEN')} OPEN  {tick(batterPos === 'TOP_ORDER')} TOP ORDER  {tick(batterPos === 'MIDDLE_ORDER')} MIDDLE ORDER
                              </Text>
                              <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#0f172a', marginTop: 2 }}>
                                BOWLER: {tick(bowlerHand === 'RH')} RH  {tick(bowlerHand === 'LH')} LH
                              </Text>
                              <Text style={{ fontSize: 10, color: '#334155' }}>
                                {tick(bowlerType.includes('MEDIUM') || bowlerType.includes('FAST'))} MEDIUM  {tick(bowlerType.includes('OFF'))} OFF SPIN  {tick(bowlerType.includes('LEG'))} LEG SPINNER  {tick(bowlerType.includes('ORTHODOX'))} ORTHODOX  {tick(bowlerType.includes('CHINAMAN'))} CHINAMAN
                              </Text>
                            </View>
                            <View style={{ flex: 0.7, padding: 6, justifyContent: 'center', alignItems: 'center' }}>
                              <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#0f172a', textAlign: 'center' }}>WICKET KEEPER</Text>
                              <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#0f172a', marginTop: 4 }}>
                                {tick(isKeeper)} YES   {tick(!isKeeper)} NO
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Declaration */}
                        <View style={{ marginTop: 10, gap: 4 }}>
                          <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#0f172a' }}>DECLARATION:</Text>
                          <Text style={{ fontSize: 9.5, color: '#334155', lineHeight: 14 }}>
                            THIS IS TO DECLARE THAT Mr/Ms/Mrs. <Text style={{ fontWeight: '800', textDecorationLine: 'underline' }}>{activeUser.name}</Text> IS A BONA FIDE RESIDENT WITHIN THE REVENUE DISTRICT OF VIRUDHUNAGAR. AND THAT THE PARTICULARS FURNISHED ABOVE ARE TRUE TO THE BEST OF MY KNOWLEDGE.
                          </Text>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#0f172a' }}>
                              PLACE: {pd.declaration_place || pd.taluk || 'Virudhunagar'}   •   DATE: {pd.declaration_date || (activeUser.created_at ? new Date(activeUser.created_at).toLocaleDateString('en-GB') : '—')}
                            </Text>
                            <Text style={{ fontSize: 10, fontWeight: '900', color: '#166534' }}>
                              VERIFIED BY CFVD ({activeUser.status || 'ACTIVE'})
                            </Text>
                          </View>
                        </View>

                        {/* Admin Passport Photo Verification Panel */}
                        <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#cbd5e1', gap: 8 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#0f2452' }}>
                              📸 Passport Photo Verification Status:{' '}
                              <Text style={{
                                color:
                                  (activeUser.photo_verification_status || pd.photo_verification_status) === 'VERIFIED'
                                    ? '#16a34a'
                                    : (activeUser.photo_verification_status || pd.photo_verification_status) === 'REJECTED'
                                      ? '#dc2626'
                                      : '#d97706'
                              }}>
                                {activeUser.photo_verification_status || pd.photo_verification_status || 'NONE'}
                              </Text>
                            </Text>
                          </View>
                          {(activeUser.photo_verification_reason || pd.photo_verification_reason) ? (
                            <Text style={{ fontSize: 10.5, color: '#475569' }}>
                              {activeUser.photo_verification_reason || pd.photo_verification_reason}
                            </Text>
                          ) : null}
                          {Boolean(photoUri) && (
                            <View style={{ gap: 8 }}>
                              <TextInput
                                style={styles.fieldInput}
                                value={photoRejectReason}
                                onChangeText={setPhotoRejectReason}
                                placeholder="Required rejection reason (e.g. Blurry face / Group photo)"
                                placeholderTextColor="#94a3b8"
                              />
                              <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity
                                  disabled={verifyingPhoto}
                                  onPress={async () => {
                                    setVerifyingPhoto(true);
                                    try {
                                      const res = await adminApi.verifyPlayerPhoto(activeUser.id, 'VERIFIED', 'Approved by Administrator.');
                                      setActiveUser((prev: any) => prev ? {
                                        ...prev,
                                        photo_verification_status: 'VERIFIED',
                                        photo_verification_reason: res.photo_verification_reason,
                                        photo_verification_history: res.photo_verification_history || prev.photo_verification_history
                                      } : null);
                                      showToast('Player passport photo approved.', 'success');
                                      loadUsers();
                                    } catch (err: any) {
                                      showToast(err.message || 'Failed to approve photo', 'error');
                                    } finally {
                                      setVerifyingPhoto(false);
                                    }
                                  }}
                                  style={{ flex: 1, backgroundColor: '#16a34a', paddingVertical: 8, borderRadius: 6, alignItems: 'center' }}
                                >
                                  <Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '800' }}>✓ Approve Photo</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  disabled={verifyingPhoto}
                                  onPress={async () => {
                                    const reason = photoRejectReason.trim();
                                    if (!reason) {
                                      showToast('Please enter a rejection reason before rejecting the photo.', 'error');
                                      return;
                                    }
                                    setVerifyingPhoto(true);
                                    try {
                                      const res = await adminApi.verifyPlayerPhoto(activeUser.id, 'REJECTED', reason);
                                      setActiveUser((prev: any) => prev ? {
                                        ...prev,
                                        photo_verification_status: 'REJECTED',
                                        photo_verification_reason: res.photo_verification_reason,
                                        photo_verification_history: res.photo_verification_history || prev.photo_verification_history
                                      } : null);
                                      setPhotoRejectReason('');
                                      showToast('Player passport photo rejected.', 'info');
                                      loadUsers();
                                    } catch (err: any) {
                                      showToast(err.message || 'Failed to reject photo', 'error');
                                    } finally {
                                      setVerifyingPhoto(false);
                                    }
                                  }}
                                  style={{ flex: 1, backgroundColor: '#dc2626', paddingVertical: 8, borderRadius: 6, alignItems: 'center' }}
                                >
                                  <Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '800' }}>✕ Reject Photo</Text>
                                </TouchableOpacity>
                              </View>
                              {Array.isArray(activeUser.photo_verification_history) && activeUser.photo_verification_history.length > 0 && (
                                <View style={{ marginTop: 6, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, padding: 8, gap: 4 }}>
                                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#334155' }}>Verification History</Text>
                                  {activeUser.photo_verification_history.slice(-4).reverse().map((h: any, hIdx: number) => (
                                    <Text key={hIdx} style={{ fontSize: 10.5, color: '#475569' }}>
                                      • [{h.status}] {h.reason} ({h.actor_role || 'SYSTEM'})
                                    </Text>
                                  ))}
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })()}
                </ScrollView>
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
                    <Text style={styles.infoKey}>Aadhaar (UIDAI):</Text>
                    <Text style={[styles.infoVal, activeUser.aadhaar && { color: '#991b1b', fontWeight: '700' }]}>
                      {activeUser.aadhaar ? `🆔 ${activeUser.aadhaar}` : 'Not specified'}
                    </Text>
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
                    {Platform.OS === 'web' && String(activeUser.role || '').toUpperCase() === 'PLAYER' && (
                      <TouchableOpacity
                        style={[styles.btnCancel, { borderColor: '#0f2452', backgroundColor: '#f8fafc' }]}
                        onPress={() => {
                          if (typeof window === 'undefined') return;
                          const pd = activeUser.player_details || {};
                          const rawPhoto = activeUser.photo || activeUser.image_path || pd.photo || pd.image_path || '';
                          const photoUrl = resolveImageUrl(rawPhoto) || '';
                          const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                          const tick = (c: boolean) => (c ? '☑' : '☐');
                          const bHand = String(pd.batter_hand || (String(pd.batting_style || '').toLowerCase().includes('left') ? 'LH' : 'RH')).toUpperCase();
                          const bPos = String(pd.batter_position || '').toUpperCase();
                          const bwHand = String(pd.bowler_hand || (String(pd.bowling_arm || '').toLowerCase().includes('left') ? 'LH' : (String(pd.bowling_arm || '').toLowerCase().includes('right') ? 'RH' : ''))).toUpperCase();
                          const bwType = String(pd.bowler_type || pd.bowling_style || '').toUpperCase();
                          const isWk = Boolean(pd.is_wicket_keeper || String(pd.role || '').toLowerCase().includes('keeper'));
                          const printWin = window.open('', '_blank', 'width=900,height=950');
                          if (!printWin) {
                            if (typeof window.print === 'function') window.print();
                            return;
                          }
                          printWin.document.write(`<!DOCTYPE html><html><head><title>CFVD Player Registration - ${esc(activeUser.name)}</title>
<style>
  body { font-family: Arial, sans-serif; color: #0f172a; margin: 20px; }
  .sheet { border: 2px solid #0f172a; padding: 14px; max-width: 780px; margin: 0 auto; }
  .hdr { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 8px; }
  .hdr h2 { margin: 0; font-size: 16px; }
  .hdr p { margin: 2px 0; font-size: 11px; font-weight: bold; }
  .title { text-align: center; font-weight: 900; text-decoration: underline; margin: 8px 0 10px; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  td, th { border: 1px solid #0f172a; padding: 6px; vertical-align: top; }
  .lbl { font-size: 9px; font-weight: 800; color: #334155; display: block; margin-bottom: 3px; }
  .photo-box { width: 115px; text-align: center; vertical-align: middle; }
  .photo-box img { width: 100px; height: 128px; object-fit: cover; border: 1px solid #0f172a; display: block; margin: 0 auto; }
  .decl { margin-top: 12px; font-size: 10.5px; line-height: 1.5; }
  @media print { body { margin: 8mm; } }
</style></head><body>
  <div class="sheet">
    <div class="hdr">
      <h2>CRICKET FEDERATION OF VIRUDHUNAGAR DISTRICT</h2>
      <p>(Registered under Tamilnadu Societies Act 1975)</p>
      <p>Reg. No: SRG/VIRUDHUNAGAR/84/2026</p>
    </div>
    <div class="title">PLAYER'S REGISTRATION FORM (${esc(activeUser.id)})</div>
    <table>
      <tr>
        <td colspan="2"><span class="lbl">NAME OF CLUB / SCHOOL / COLLEGE / ACADEMY:</span><strong>${esc(pd.club_choice || 'Not specified')}</strong></td>
        <td rowspan="4" class="photo-box">
          ${photoUrl ? `<img src="${esc(photoUrl)}" alt="Passport Photo" />` : '<div style="width:100px;height:128px;border:1px dashed #64748b;display:flex;align-items:center;justify-content:center;font-size:10px;margin:0 auto;">AFFIX PASSPORT SIZE PHOTO</div>'}
        </td>
      </tr>
      <tr>
        <td><span class="lbl">NAME OF THE PLAYER</span><strong>${esc(activeUser.name)}</strong></td>
        <td><span class="lbl">FATHER'S NAME</span><strong>${esc(pd.father_name || 'Not specified')}</strong></td>
      </tr>
      <tr>
        <td><span class="lbl">DATE OF BIRTH &amp; AGE</span><strong>${esc(pd.date_of_birth || '—')} (${esc(pd.age || '—')} yrs)</strong></td>
        <td><span class="lbl">AADHAR NUMBER</span><strong style="color:#991b1b">${esc(activeUser.aadhaar || pd.aadhaar || 'Not specified')}</strong></td>
      </tr>
      <tr>
        <td colspan="2"><span class="lbl">ADDRESS FOR COMMUNICATION (AADHAR / PASSPORT COPY PROOF)</span>${esc(pd.address || 'Not specified')}</td>
      </tr>
      <tr>
        <td><span class="lbl">IF WORKING (INSTITUTION / BANK / GOVT OFFICES)</span>${esc(pd.working_institution || '—')}</td>
        <td><span class="lbl">PLACE OF BIRTH</span>${esc(pd.place_of_birth || '—')}</td>
        <td><span class="lbl">CONTACT NUMBER</span><strong>${esc(activeUser.mobile || pd.phone || 'Not specified')}</strong></td>
      </tr>
      <tr>
        <td><span class="lbl">IF STUDYING (NAME OF SCHOOL / COLLEGE)</span>${esc(pd.studying_institution || '—')}</td>
        <td><span class="lbl">COLLEGE (BRANCH &amp; YEAR &amp; SEC) / SCHOOL (CLASS &amp; SEC)</span>${esc(pd.branch_year_sec || pd.class_section || '—')}</td>
        <td><span class="lbl">E-MAIL ID</span>${esc(activeUser.email)}</td>
      </tr>
      <tr>
        <td><span class="lbl">PROFICIENCY</span>${esc(pd.role || 'Player')} • ${esc(pd.category || 'Senior')}</td>
        <td>
          <div><strong>BATTER:</strong> ${tick(bHand === 'RH')} RH ${tick(bHand === 'LH')} LH | ${tick(bPos === 'OPEN')} OPEN ${tick(bPos === 'TOP_ORDER')} TOP ORDER ${tick(bPos === 'MIDDLE_ORDER')} MIDDLE ORDER</div>
          <div style="margin-top:4px;"><strong>BOWLER:</strong> ${tick(bwHand === 'RH')} RH ${tick(bwHand === 'LH')} LH | ${tick(bwType.includes('MEDIUM') || bwType.includes('FAST'))} MEDIUM ${tick(bwType.includes('OFF'))} OFF SPIN ${tick(bwType.includes('LEG'))} LEG SPINNER ${tick(bwType.includes('ORTHODOX'))} ORTHODOX ${tick(bwType.includes('CHINAMAN'))} CHINAMAN</div>
        </td>
        <td><span class="lbl">WICKET KEEPER</span>${tick(isWk)} YES &nbsp; ${tick(!isWk)} NO</td>
      </tr>
    </table>
    <div class="decl">
      <strong>DECLARATION:</strong> THIS IS TO DECLARE THAT Mr/Ms/Mrs. <u><strong>${esc(activeUser.name)}</strong></u> IS A BONA FIDE RESIDENT WITHIN THE REVENUE DISTRICT OF VIRUDHUNAGAR. AND THAT THE PARTICULARS FURNISHED ABOVE ARE TRUE TO THE BEST OF MY KNOWLEDGE.
      <div style="display:flex;justify-content:space-between;margin-top:16px;font-weight:bold;">
        <span>PLACE: ${esc(pd.declaration_place || pd.taluk || 'Virudhunagar')} &nbsp;•&nbsp; DATE: ${esc(pd.declaration_date || '—')}</span>
        <span>VERIFIED BY CFVD (${esc(activeUser.status || 'ACTIVE')})</span>
      </div>
    </div>
  </div>
  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 350); };
  </script>
</body></html>`);
                          printWin.document.close();
                        }}
                      >
                        <Text style={[styles.btnCancelText, { color: '#0f2452' }]}>🖨️ Print Form</Text>
                      </TouchableOpacity>
                    )}
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, marginRight: 8 }}>
                  <ShieldIcon size={20} color="#0f2452" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.modalTitle, isMobile && { fontSize: 13.5 }]} numberOfLines={1}>Onboard Dynamic Administrator</Text>
                    <Text style={{ fontSize: 10, color: '#64748b' }} numberOfLines={1}>
                      Assign credentials under Super Admin oversight
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
                    placeholder="e.g. senthil.Super Administrator"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View style={[styles.fieldRow, isMobile && { flexDirection: 'column', gap: 12 }]}>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Ionicons name="shield-checkmark" size={15} color="#991b1b" />
                    <Text style={[styles.securityNoticeTitle, { marginBottom: 0 }]}>Super Administrator Oversight Policy</Text>
                  </View>
                  <Text style={styles.securityNoticeText}>
                    New administrators have dynamic privileges and strictly require Nodemailer 6-digit OTP verification from the permanent Super Administrator (<Text style={{ fontWeight: '800', color: '#991b1b' }}>Super Administrator</Text>). Upon approval, an activation link is automatically emailed to the new administrator.
                  </Text>
                </View>
              </ScrollView>

              <View style={[styles.modalFooter, isMobile && { flexDirection: 'column-reverse', gap: 8, paddingHorizontal: 12 }]}>
                <TouchableOpacity
                  style={[styles.btnCancel, isMobile && { width: '100%', paddingVertical: 10 }]}
                  onPress={() => setShowAddAdminModal(false)}
                >
                  <Text style={styles.btnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnProceedSuperAdmin, isRequestingAuth && { opacity: 0.7 }, isMobile && { width: '100%', paddingVertical: 11 }]}
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, marginRight: 8 }}>
                  <View style={styles.superAdminOtpIconCircle}>
                    <ShieldIcon size={18} color="#0f2452" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.superAdminOtpTitle, isMobile && { fontSize: 13 }]} numberOfLines={1}>Super Administrator Verification</Text>
                    <Text style={{ fontSize: 10, color: '#64748b' }} numberOfLines={1}>
                      Nodemailer SMTP to {PERMANENT_SUPER_ADMIN}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setShowOtpModal(false)}>
                  <CloseIcon size={18} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* Action Banner */}
              <View style={styles.superAdminActionBanner}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="lock-closed" size={15} color="#0f2452" />
                  <Text style={styles.superAdminActionTitle}>
                    {otpActionTitle || 'Administrative Operation'}
                  </Text>
                </View>
                {otpActionDesc ? (
                  <Text style={styles.superAdminActionDesc}>{otpActionDesc}</Text>
                ) : null}
              </View>

              {/* Timer & Resend Row */}
              <View style={styles.otpTimerRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="hourglass-outline" size={13} color="#475569" />
                  <Text style={styles.otpTimerText}>
                    Code valid for: <Text style={{ fontWeight: '800' }}>{formatCountdown(otpCountdown)}</Text>
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleResendOtp}
                  disabled={resendCooldown > 0}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Ionicons name={resendCooldown > 0 ? 'hourglass-outline' : 'sync'} size={13} color={resendCooldown > 0 ? '#94a3b8' : '#1d4ed8'} />
                  <Text style={[styles.otpResendText, resendCooldown > 0 && { color: '#94a3b8' }]}>
                    {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend OTP'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Single Super Admin OTP Input Card */}
              <View style={styles.superAdminOtpCard}>
                <View style={styles.superAdminOtpCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name="crown" size={14} color="#d97706" />
                    <Text style={styles.superAdminOtpLabel}>
                      Enter 6-Digit OTP sent to <Text style={{ fontWeight: '800', color: '#0f2452' }}>{PERMANENT_SUPER_ADMIN}</Text>:
                    </Text>
                  </View>
                  {demoOtp && (
                    <TouchableOpacity
                      style={[styles.demoFillChip, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                      onPress={() => setOtpInput(demoOtp)}
                    >
                      <Ionicons name="flash" size={12} color="#b45309" />
                      <Text style={styles.demoFillText}>Demo OTP: {demoOtp}</Text>
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
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 12 }}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#64748b" style={{ marginTop: 2 }} />
                <Text style={[styles.securityPolicyNote, { flex: 1, marginBottom: 0 }]}>
                  Single-use cryptographically secure OTP. All newly created or modified administrators remain under dynamic management of the permanent Super Administrator.
                </Text>
              </View>

              {/* Modal Actions */}
              <View style={[styles.superAdminOtpFooter, isMobile && { flexDirection: 'column-reverse', gap: 8, paddingHorizontal: 12 }]}>
                <TouchableOpacity
                  style={[styles.btnCancel, isMobile && { width: '100%', paddingVertical: 10 }]}
                  onPress={() => setShowOtpModal(false)}
                >
                  <Text style={styles.btnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.btnVerifySuperAdmin,
                    (otpInput.length !== 6 || isVerifyingOtp) && { opacity: 0.6 },
                    isMobile && { width: '100%', minWidth: 0, paddingVertical: 11 },
                    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }
                  ]}
                  onPress={handleVerifyOtp}
                  disabled={otpInput.length !== 6 || isVerifyingOtp}
                >
                  {isVerifyingOtp ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={15} color="#ffffff" />
                      <Text style={styles.btnVerifySuperAdminText}>
                        Verify OTP & Authorize Action
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* High-Security Dual-Admin Approval & Revocation Modal */}
      <DualAdminSecurityModal
        visible={showDualSecurityModal}
        onClose={() => setShowDualSecurityModal(false)}
        onSuccess={() => {
          loadUsers();
          showToast('Dual-admin operation completed successfully.', 'success');
        }}
      />

      {/* Official Registration Modal (Exact Website Player / Team / Scorer / Umpire Form & Validations) */}
      {(showAddUserModal || showAddTeamModal) && (
        <Modal
          visible={showAddUserModal || showAddTeamModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowAddUserModal(false);
            setShowAddTeamModal(false);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalDialog, { maxWidth: 980, width: '96%', height: '92%', overflow: 'hidden' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {showAddTeamModal ? '+ Register Cricket Team (Official Form)' : '+ Register Federation Member (Player / Team / Scorer / Umpire)'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowAddUserModal(false);
                    setShowAddTeamModal(false);
                  }}
                >
                  <CloseIcon size={20} color="#64748b" />
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <RegistrationScreen
                  adminMode
                  initialRole={showAddTeamModal ? 'TEAM' : 'PLAYER'}
                  onExit={() => {
                    setShowAddUserModal(false);
                    setShowAddTeamModal(false);
                  }}
                  onAdminSuccess={() => {
                    setShowAddUserModal(false);
                    setShowAddTeamModal(false);
                    loadUsers();
                  }}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Permanent User Delete Confirmation */}
      <ConfirmDialog
        visible={confirmDeleteUser.visible}
        title="Permanently Delete User"
        message={`Are you sure you want to permanently delete ${confirmDeleteUser.user?.name || 'this user'} (${confirmDeleteUser.user?.email || ''})? They will have to register again to access the portal.`}
        confirmText="Delete Permanently"
        variant="danger"
        onConfirm={handleConfirmDeleteUser}
        onCancel={() => setConfirmDeleteUser({ visible: false, user: null })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  headerActionsWrap: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  filtersBar: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    gap: 12
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  filterDropdownsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 14
  },
  filterDropdownCol: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    position: 'relative'
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 38
  },
  dropdownTriggerActive: {
    borderColor: '#0f2452',
    backgroundColor: '#ffffff'
  },
  dropdownTriggerText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    marginRight: 8
  },
  dropdownCaret: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '800'
  },
  dropdownMenu: {
    position: 'absolute',
    top: 42,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 999,
    overflow: 'hidden'
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  dropdownMenuItemActive: {
    backgroundColor: '#eff6ff'
  },
  dropdownMenuItemText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155'
  },
  dropdownMenuItemTextActive: {
    fontWeight: '800',
    color: '#0f2452'
  },
  dropdownCheck: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f2452'
  },
  filterChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 8
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    minWidth: 70
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
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    width: '100%',
    height: '100%'
  },
  modalDialog: {
    width: '94%',
    maxWidth: 500,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    maxHeight: '92%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    alignSelf: 'center',
    marginHorizontal: 'auto'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
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
    padding: 16,
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
    height: 42,
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
    fontWeight: '600',
    flex: 1
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    flexWrap: 'wrap'
  },
  btnCancel: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569'
  },
  btnSave: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#0f2452',
    alignItems: 'center',
    justifyContent: 'center'
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
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8
  },
  addAdminBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
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
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 16,
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
