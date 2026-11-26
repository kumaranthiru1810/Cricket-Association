import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert
} from 'react-native';
import { AdminSecurityApi, getCurrentUser } from '../../services/api';

export interface DualAdminSecurityModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialTab?: 'promote' | 'remove' | 'audit';
}

interface AdminItem {
  id: string;
  name: string;
  email: string;
  role: string;
  is_super_admin: boolean;
  is_current_user: boolean;
  created_at?: string;
}

export default function DualAdminSecurityModal({
  visible,
  onClose,
  onSuccess,
  initialTab = 'promote'
}: DualAdminSecurityModalProps) {
  const [activeTab, setActiveTab] = useState<'promote' | 'remove' | 'audit'>(initialTab);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Current logged in user
  const currentUser = getCurrentUser();
  const isSuperAdmin = Boolean(currentUser?.role === 'SUPER_ADMIN' || currentUser?.is_super_admin);

  // Active admins state
  const [activeAdmins, setActiveAdmins] = useState<AdminItem[]>([]);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [minRequired, setMinRequired] = useState<number>(3);

  // PROMOTE STATE
  const [promoteStep, setPromoteStep] = useState<1 | 2 | 3>(1);
  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidateName, setCandidateName] = useState('');
  const [candidateCheckStatus, setCandidateCheckStatus] = useState<'idle' | 'checking' | 'found' | 'not_found' | 'already_admin'>('idle');
  const [candidateCheckMessage, setCandidateCheckMessage] = useState('');

  // REMOVE STATE
  const [removeStep, setRemoveStep] = useState<1 | 2>(1);
  const [selectedAdminId, setSelectedAdminId] = useState<string>('');
  const [selectedAdmin, setSelectedAdmin] = useState<AdminItem | null>(null);

  // DUAL OTP STATE (Shared between Promote Step 2 and Remove Step 2)
  const [currentRequestId, setCurrentRequestId] = useState<string>('');
  const [approver1Info, setApprover1Info] = useState<{ id?: string; email: string; name?: string }>({ email: '' });
  const [approver2Info, setApprover2Info] = useState<{ id?: string; email: string; name?: string }>({ email: '' });
  const [otp1, setOtp1] = useState('');
  const [otp2, setOtp2] = useState('');
  const [candidateCode, setCandidateCode] = useState('');
  const [countdown, setCountdown] = useState<number>(600); // 10 minutes (600s)
  const timerRef = useRef<any>(null);

  // AUDIT LOGS STATE
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [securityRequests, setSecurityRequests] = useState<any[]>([]);

  // Reset modal state on open
  useEffect(() => {
    if (visible) {
      setActiveTab(initialTab);
      resetFlows();
      fetchInitialData();
    } else {
      stopCountdown();
    }
  }, [visible, initialTab]);

  const resetFlows = () => {
    setPromoteStep(1);
    setRemoveStep(1);
    setCandidateEmail('');
    setCandidateName('');
    setCandidateCheckStatus('idle');
    setCandidateCheckMessage('');
    setSelectedAdminId('');
    setSelectedAdmin(null);
    setCurrentRequestId('');
    setOtp1('');
    setOtp2('');
    setCandidateCode('');
    setErrorMessage('');
    setSuccessMessage('');
    stopCountdown();
  };

  const startCountdown = (initialSeconds: number = 600) => {
    stopCountdown();
    setCountdown(initialSeconds);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          stopCountdown();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopCountdown = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const fetchInitialData = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await AdminSecurityApi.getActiveAdmins();
      if (res && res.success) {
        setActiveAdmins(res.admins || []);
        setActiveCount(res.active_count || (res.admins ? res.admins.length : 0));
        setMinRequired(res.min_required || 3);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to fetch administrator records.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditData = async () => {
    setLoading(true);
    try {
      const [auditRes, reqRes] = await Promise.all([
        AdminSecurityApi.getSecurityAuditLogs().catch(() => ({ audit: [] })),
        AdminSecurityApi.getSecurityRequests().catch(() => ({ requests: [] }))
      ]);
      setAuditLogs(auditRes?.audit || []);
      setSecurityRequests(reqRes?.requests || []);
    } catch (_e) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'audit' && visible) {
      fetchAuditData();
    }
  }, [activeTab, visible]);

  // Handle Candidate Email Lookup
  const handleCheckCandidate = async (email: string) => {
    const trimmed = email.trim();
    setCandidateEmail(trimmed);
    if (!trimmed || !trimmed.includes('@') || trimmed.length < 5) {
      setCandidateCheckStatus('idle');
      setCandidateCheckMessage('');
      return;
    }

    setCandidateCheckStatus('checking');
    try {
      const res = await AdminSecurityApi.searchCandidate(trimmed);
      if (res && res.is_admin) {
        setCandidateCheckStatus('already_admin');
        setCandidateCheckMessage('Account already possesses Administrator privileges.');
      } else if (res && (res.exists || res.found)) {
        const candidateUser = res.candidate || res.user;
        setCandidateCheckStatus('found');
        setCandidateCheckMessage(`Found existing account: ${candidateUser?.name || trimmed} (${candidateUser?.role || 'USER'})`);
        if (!candidateName && candidateUser?.name) {
          setCandidateName(candidateUser.name);
        }
      } else {
        setCandidateCheckStatus('not_found');
        setCandidateCheckMessage('No registered account found. An invitation will be dispatched to register as Admin.');
      }
    } catch (_e) {
      setCandidateCheckStatus('idle');
    }
  };

  // Step 1: Submit Promote Request
  const handleInitiatePromote = async () => {
    setErrorMessage('');
    if (!candidateEmail || !candidateEmail.includes('@')) {
      setErrorMessage('Please enter a valid candidate Gmail address.');
      return;
    }
    if (candidateCheckStatus === 'already_admin') {
      setErrorMessage('This user already possesses Administrator privileges.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await AdminSecurityApi.requestPromote({
        email: candidateEmail.trim(),
        name: candidateName.trim() || undefined
      });

      if (!res.success) {
        throw new Error(res.message || 'Failed to create promotion request.');
      }

      setCurrentRequestId(res.requestId);
      setApprover1Info(res.approvers?.[0] || { email: 'Admin 1' });
      setApprover2Info(res.approvers?.[1] || { email: 'Admin 2' });
      setPromoteStep(2);
      setOtp1('');
      setOtp2('');
      startCountdown(res.expiresInSeconds || 600);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error initiating promotion request.');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Verify Dual OTPs for Promotion
  const handleVerifyDualPromote = async () => {
    setErrorMessage('');
    if (!otp1 || otp1.trim().length !== 6 || !otp2 || otp2.trim().length !== 6) {
      setErrorMessage('Please enter valid 6-digit authorization codes for both administrators.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await AdminSecurityApi.verifyDualOtp(
        currentRequestId,
        otp1.trim(),
        otp2.trim()
      );

      if (!res.success) {
        throw new Error(res.message || 'Dual OTP verification failed.');
      }

      // Move to Step 3: Verify & Grant
      setPromoteStep(3);
      stopCountdown();
      if (res.candidateVerified) {
        // If candidate auto-granted
        setSuccessMessage(res.message || 'Candidate promoted to Administrator successfully!');
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Invalid or expired authorization code.');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 3: Finalize Candidate Verification & Grant Role
  const handleFinalizeCandidateGrant = async () => {
    setErrorMessage('');
    if (!candidateCode || candidateCode.trim().length !== 6) {
      setErrorMessage('Please enter the 6-digit candidate verification code dispatched to their Gmail.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await AdminSecurityApi.verifyCandidateOtp(currentRequestId, candidateCode.trim());
      if (!res.success) {
        throw new Error(res.message || 'Candidate verification failed.');
      }

      setSuccessMessage(res.message || 'Administrator privileges successfully granted!');
      fetchInitialData();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Verification failed. Please re-check code.');
    } finally {
      setSubmitting(false);
    }
  };

  // Resend Dual Codes
  const handleResendCodes = async () => {
    if (!currentRequestId) return;
    setSubmitting(true);
    setErrorMessage('');
    try {
      const res = await AdminSecurityApi.resendDualOtp(currentRequestId);
      if (!res.success) {
        throw new Error(res.message || 'Failed to resend authorization codes.');
      }
      setOtp1('');
      setOtp2('');
      startCountdown(res.expiresInSeconds || 600);
      Alert.alert('Codes Resent', 'Fresh 6-digit authorization codes have been dispatched to both administrators.');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error resending authorization codes.');
    } finally {
      setSubmitting(false);
    }
  };

  // REMOVAL FLOW: Step 1 -> Step 2
  const handleInitiateRemoval = async () => {
    setErrorMessage('');
    if (!selectedAdminId) {
      setErrorMessage('Please select an administrator to remove.');
      return;
    }
    if (activeCount < minRequired) {
      setErrorMessage(`Removal blocked: At least ${minRequired} active administrators are required.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await AdminSecurityApi.requestRemove(selectedAdminId);
      if (!res.success) {
        throw new Error(res.message || 'Failed to initiate administrator removal.');
      }

      setCurrentRequestId(res.requestId);
      setApprover1Info(res.approvers?.[0] || { email: 'Admin 1' });
      setApprover2Info(res.approvers?.[1] || { email: 'Admin 2' });
      setRemoveStep(2);
      setOtp1('');
      setOtp2('');
      startCountdown(res.expiresInSeconds || 600);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error initiating removal request.');
    } finally {
      setSubmitting(false);
    }
  };

  // REMOVAL FLOW: Step 2 -> Verify & Revoke
  const handleVerifyDualRemoval = async () => {
    setErrorMessage('');
    if (!otp1 || otp1.trim().length !== 6 || !otp2 || otp2.trim().length !== 6) {
      setErrorMessage('Please enter valid 6-digit authorization codes for both administrators.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await AdminSecurityApi.verifyRemove(
        currentRequestId,
        otp1.trim(),
        otp2.trim()
      );

      if (!res.success) {
        throw new Error(res.message || 'Revocation verification failed.');
      }

      stopCountdown();
      setSuccessMessage(res.message || 'Administrator privileges successfully revoked.');
      fetchInitialData();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Invalid or expired authorization code.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          {/* HEADER TOP NAV TABS */}
          <View style={styles.navTabsWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navTabsScroll}>
              <TouchableOpacity
                style={[styles.navTabBtn, activeTab === 'promote' && styles.navTabBtnActive]}
                onPress={() => {
                  setActiveTab('promote');
                  resetFlows();
                }}
              >
                <Text style={[styles.navTabBtnText, activeTab === 'promote' && styles.navTabBtnTextActive]}>
                  + Promote Admin
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.navTabBtn, activeTab === 'remove' && styles.navTabBtnActive]}
                onPress={() => {
                  setActiveTab('remove');
                  resetFlows();
                }}
              >
                <Text style={[styles.navTabBtnText, activeTab === 'remove' && styles.navTabBtnTextActive]}>
                  - Remove Admin
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.navTabBtn, activeTab === 'audit' && styles.navTabBtnActive]}
                onPress={() => {
                  setActiveTab('audit');
                  resetFlows();
                }}
              >
                <Text style={[styles.navTabBtnText, activeTab === 'audit' && styles.navTabBtnTextActive]}>
                  🛡️ Security Audit
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close Security Modal">
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollBodyContent} keyboardShouldPersistTaps="handled">
            {/* ERROR / SUCCESS ALERTS */}
            {errorMessage ? (
              <View style={styles.errorAlertBox}>
                <Text style={styles.errorAlertText}>⚠️ {errorMessage}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={styles.successAlertBox}>
                <Text style={styles.successAlertText}>✅ {successMessage}</Text>
              </View>
            ) : null}

            {/* TAB 1: PROMOTE ADMIN */}
            {activeTab === 'promote' && (
              <View style={styles.tabContent}>
                {/* Title & Subtitle */}
                <View style={styles.titleSection}>
                  <View style={styles.titleIconBadge}>
                    <Text style={styles.titleIconText}>👤⁺</Text>
                  </View>
                  <View style={styles.titleTextContainer}>
                    <Text style={styles.modalTitle}>Promote / Add Administrator</Text>
                    <Text style={styles.modalSubtitle}>Dual-Admin Security Approval & Verification</Text>
                  </View>
                </View>

                {/* Step Indicators */}
                <View style={styles.stepBreadcrumbs}>
                  <View style={[styles.stepPill, promoteStep === 1 && styles.stepPillActive]}>
                    <Text style={[styles.stepPillText, promoteStep === 1 && styles.stepPillTextActive]}>
                      1. Candidate
                    </Text>
                  </View>
                  <View style={[styles.stepPill, promoteStep === 2 && styles.stepPillActive]}>
                    <Text style={[styles.stepPillText, promoteStep === 2 && styles.stepPillTextActive]}>
                      2. Dual Approval
                    </Text>
                  </View>
                  <View style={[styles.stepPill, promoteStep === 3 && styles.stepPillActive]}>
                    <Text style={[styles.stepPillText, promoteStep === 3 && styles.stepPillTextActive]}>
                      3. Verify & Grant
                    </Text>
                  </View>
                </View>

                {/* PROMOTE STEP 1: Candidate Entry */}
                {promoteStep === 1 && (
                  <View>
                    {/* High Security Access Delegation Warning */}
                    <View style={styles.redNoticeCard}>
                      <View style={styles.noticeIconCol}>
                        <Text style={styles.shieldIcon}>🛡️</Text>
                      </View>
                      <View style={styles.noticeTextCol}>
                        <Text style={styles.noticeTitle}>High Security Access Delegation</Text>
                        <Text style={styles.noticeDesc}>
                          Promoting an account to Administrator grants full access to association management, tournaments, finances, and official registers.
                        </Text>
                      </View>
                    </View>

                    {/* Candidate Email Input */}
                    <View style={styles.formGroup}>
                      <Text style={styles.fieldLabel}>Candidate Email Address *</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="e.g. partner@gmail.com"
                        placeholderTextColor="#94a3b8"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={candidateEmail}
                        onChangeText={handleCheckCandidate}
                        editable={!submitting}
                      />
                      {candidateCheckStatus === 'checking' && (
                        <Text style={styles.fieldHelper}>Checking account registry...</Text>
                      )}
                      {candidateCheckStatus === 'found' && (
                        <Text style={[styles.fieldHelper, { color: '#16a34a' }]}>✓ {candidateCheckMessage}</Text>
                      )}
                      {candidateCheckStatus === 'not_found' && (
                        <Text style={[styles.fieldHelper, { color: '#0284c7' }]}>ℹ {candidateCheckMessage}</Text>
                      )}
                      {candidateCheckStatus === 'already_admin' && (
                        <Text style={[styles.fieldHelper, { color: '#dc2626' }]}>⚠️ {candidateCheckMessage}</Text>
                      )}
                    </View>

                    {/* Candidate Full Name Input */}
                    <View style={styles.formGroup}>
                      <Text style={styles.fieldLabel}>Administrator Full Name (Optional)</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="e.g. Athi Partner"
                        placeholderTextColor="#94a3b8"
                        value={candidateName}
                        onChangeText={setCandidateName}
                        editable={!submitting}
                      />
                    </View>

                    {/* Authorization Requirement Info Box */}
                    <View style={styles.infoBoxCard}>
                      <Text style={styles.infoBoxIcon}>🛡️</Text>
                      <Text style={styles.infoBoxText}>
                        Authorization Required From Existing Admins ({Math.max(activeCount, 2)}):
                      </Text>
                    </View>

                    {/* Action Button */}
                    <TouchableOpacity
                      style={[
                        styles.primaryActionBtn,
                        (!candidateEmail || candidateCheckStatus === 'already_admin' || submitting) && styles.btnDisabled
                      ]}
                      onPress={handleInitiatePromote}
                      disabled={!candidateEmail || candidateCheckStatus === 'already_admin' || submitting}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={styles.primaryActionBtnText}>Proceed to Dual Approval →</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* PROMOTE STEP 2: Dual Approval Screen */}
                {promoteStep === 2 && (
                  <View>
                    {/* Red Badge Card: Step 1 of 2: Dual Admin Approval */}
                    <View style={styles.approvalHeaderCard}>
                      <Text style={styles.approvalHeaderTitle}>STEP 1 OF 2: DUAL ADMIN APPROVAL</Text>
                      <Text style={styles.approvalHeaderSubtitle}>
                        OTPs have been sent to both active administrators. Both codes must be verified to authorize promoting{' '}
                        <Text style={styles.boldEmail}>{candidateEmail}</Text>.
                      </Text>
                    </View>

                    {/* Countdown Timer & Resend Row */}
                    <View style={styles.timerResendRow}>
                      <View style={styles.timerBadge}>
                        <Text style={styles.timerBadgeText}>⏱ Valid for: {formatTimer(countdown)}</Text>
                      </View>
                      <TouchableOpacity onPress={handleResendCodes} disabled={submitting}>
                        <Text style={styles.resendTextBtn}>Resend Codes</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Approver 1 OTP */}
                    <View style={styles.approverOtpBlock}>
                      <View style={styles.approverTitleRow}>
                        <View style={styles.circleNumberBadge}>
                          <Text style={styles.circleNumberText}>1</Text>
                        </View>
                        <Text style={styles.approverLabelText}>
                          Admin 1 Code: <Text style={styles.boldApproverEmail}>{approver1Info.email}</Text>
                        </Text>
                      </View>
                      <TextInput
                        style={styles.otpLargeInput}
                        placeholder="Enter 6-digit OTP"
                        placeholderTextColor="#cbd5e1"
                        keyboardType="number-pad"
                        maxLength={6}
                        value={otp1}
                        onChangeText={setOtp1}
                        editable={!submitting}
                      />
                    </View>

                    {/* Approver 2 OTP */}
                    <View style={styles.approverOtpBlock}>
                      <View style={styles.approverTitleRow}>
                        <View style={styles.circleNumberBadge}>
                          <Text style={styles.circleNumberText}>2</Text>
                        </View>
                        <Text style={styles.approverLabelText}>
                          Admin 2 Code: <Text style={styles.boldApproverEmail}>{approver2Info.email}</Text>
                        </Text>
                      </View>
                      <TextInput
                        style={styles.otpLargeInput}
                        placeholder="Enter 6-digit OTP"
                        placeholderTextColor="#cbd5e1"
                        keyboardType="number-pad"
                        maxLength={6}
                        value={otp2}
                        onChangeText={setOtp2}
                        editable={!submitting}
                      />
                    </View>

                    {/* Security Footnote */}
                    <View style={styles.securityFootnoteRow}>
                      <Text style={styles.lockFootnoteIcon}>🔒</Text>
                      <Text style={styles.lockFootnoteText}>
                        If either OTP is incorrect or rejected, candidate promotion will NOT proceed.
                      </Text>
                    </View>

                    {/* Verify Dual Codes Action Button */}
                    <TouchableOpacity
                      style={[
                        styles.primaryActionBtn,
                        styles.confirmBtn,
                        (otp1.length !== 6 || otp2.length !== 6 || submitting) && styles.btnDisabled
                      ]}
                      onPress={handleVerifyDualPromote}
                      disabled={otp1.length !== 6 || otp2.length !== 6 || submitting}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={styles.primaryActionBtnText}>✓ Verify Dual Codes & Continue</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* PROMOTE STEP 3: Verify & Grant */}
                {promoteStep === 3 && (
                  <View style={styles.step3Container}>
                    <View style={styles.step3SuccessCard}>
                      <Text style={styles.step3SuccessIcon}>🎉</Text>
                      <Text style={styles.step3SuccessTitle}>Dual Administrator Authorization Verified!</Text>
                      <Text style={styles.step3SuccessDesc}>
                        Both administrators have approved promoting{' '}
                        <Text style={{ fontWeight: '800', color: '#0f172a' }}>{candidateEmail}</Text> to Administrator privileges.
                      </Text>
                    </View>

                    {!successMessage ? (
                      <View style={styles.candidateVerifyForm}>
                        <Text style={styles.fieldLabel}>Enter Candidate Verification Code *</Text>
                        <Text style={styles.fieldHelper}>
                          A 6-digit confirmation code was dispatched to {candidateEmail}. Enter it below to complete onboarding:
                        </Text>
                        <TextInput
                          style={[styles.otpLargeInput, { marginTop: 10 }]}
                          placeholder="Candidate 6-digit Code"
                          placeholderTextColor="#cbd5e1"
                          keyboardType="number-pad"
                          maxLength={6}
                          value={candidateCode}
                          onChangeText={setCandidateCode}
                          editable={!submitting}
                        />
                        <TouchableOpacity
                          style={[styles.primaryActionBtn, styles.grantBtn, (candidateCode.length !== 6 || submitting) && styles.btnDisabled]}
                          onPress={handleFinalizeCandidateGrant}
                          disabled={candidateCode.length !== 6 || submitting}
                        >
                          {submitting ? (
                            <ActivityIndicator color="#ffffff" />
                          ) : (
                            <Text style={styles.primaryActionBtnText}>✓ Finalize & Grant Administrator Access</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={[styles.primaryActionBtn, { marginTop: 20 }]} onPress={onClose}>
                        <Text style={styles.primaryActionBtnText}>Close & Refresh Dashboard</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* TAB 2: REMOVE / DEMOTE ADMIN */}
            {activeTab === 'remove' && (
              <View style={styles.tabContent}>
                {/* Title & Subtitle */}
                <View style={styles.titleSection}>
                  <View style={[styles.titleIconBadge, { backgroundColor: '#fee2e2' }]}>
                    <Text style={[styles.titleIconText, { color: '#dc2626' }]}>👤⁻</Text>
                  </View>
                  <View style={styles.titleTextContainer}>
                    <Text style={styles.modalTitle}>Remove / Demote Administrator</Text>
                    <Text style={styles.modalSubtitle}>Dual-Admin Security Authorization & Revocation</Text>
                  </View>
                </View>

                {/* Step Indicators */}
                <View style={styles.stepBreadcrumbs}>
                  <View style={[styles.stepPill, removeStep === 1 && styles.stepPillActive]}>
                    <Text style={[styles.stepPillText, removeStep === 1 && styles.stepPillTextActive]}>
                      1. Select Admin
                    </Text>
                  </View>
                  <View style={[styles.stepPill, removeStep === 2 && styles.stepPillActive]}>
                    <Text style={[styles.stepPillText, removeStep === 2 && styles.stepPillTextActive]}>
                      2. Dual Approval & Revoke
                    </Text>
                  </View>
                </View>

                {/* REMOVE STEP 1: Select Administrator */}
                {removeStep === 1 && (
                  <View>
                    {/* High Security Role Revocation Notice */}
                    <View style={styles.redNoticeCard}>
                      <View style={styles.noticeIconCol}>
                        <Text style={styles.shieldIcon}>🛡️</Text>
                      </View>
                      <View style={styles.noticeTextCol}>
                        <Text style={styles.noticeTitle}>High Security Role Revocation</Text>
                        <Text style={styles.noticeDesc}>
                          Revoking Administrator privileges will immediately revert the account to standard User status. Store admin privileges, orders, inventory, and analytics access will be revoked.
                        </Text>
                      </View>
                    </View>

                    {/* Removal Protection Active Card */}
                    <View style={styles.removalProtectionCard}>
                      <View style={styles.protectionIconRow}>
                        <Text style={styles.lockRedIcon}>🔒</Text>
                        <Text style={styles.protectionHeaderTitle}>Removal Protection Active</Text>
                      </View>
                      <Text style={styles.protectionDesc}>
                        At least {minRequired} active administrators are required in the system to remove an administrator. This ensures 2 other admins can authorize the revocation and at least 2 admins remain.
                      </Text>
                      <Text style={styles.protectionCountText}>
                        Current active administrators: {activeCount} / {minRequired} minimum
                      </Text>
                    </View>

                    {/* Administrator Selection List */}
                    <Text style={styles.selectAdminHeader}>
                      Select Administrator to Remove ({activeCount} Active):
                    </Text>

                    {loading ? (
                      <ActivityIndicator size="large" color="#1d4ed8" style={{ marginVertical: 20 }} />
                    ) : (
                      <View style={styles.adminCardsContainer}>
                        {activeAdmins.map((admin) => {
                          const isCurrent = admin.is_current_user || admin.email === currentUser?.email;
                          const isSuper = admin.is_super_admin || admin.role === 'SUPER_ADMIN';
                          const isSelected = selectedAdminId === admin.id;
                          const isDisabled = isCurrent || isSuper || activeCount < minRequired;

                          return (
                            <TouchableOpacity
                              key={admin.id || admin.email}
                              style={[
                                styles.adminSelectCard,
                                isSelected && styles.adminSelectCardSelected,
                                isDisabled && styles.adminSelectCardDisabled
                              ]}
                              onPress={() => {
                                if (!isDisabled) {
                                  setSelectedAdminId(admin.id);
                                  setSelectedAdmin(admin);
                                }
                              }}
                              disabled={isDisabled}
                            >
                              <View style={styles.radioCol}>
                                <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                                  {isSelected && <View style={styles.radioInnerCircle} />}
                                </View>
                              </View>

                              <View style={styles.adminCardAvatar}>
                                <Text style={styles.adminCardAvatarText}>🛡️</Text>
                              </View>

                              <View style={styles.adminCardInfo}>
                                <View style={styles.adminNameRow}>
                                  <Text style={styles.adminCardName}>{admin.name || 'Administrator'}</Text>
                                  {isCurrent && (
                                    <View style={styles.currentBadge}>
                                      <Text style={styles.currentBadgeText}>You (Current)</Text>
                                    </View>
                                  )}
                                  {isSuper && (
                                    <View style={styles.superBadge}>
                                      <Text style={styles.superBadgeText}>Super Admin</Text>
                                    </View>
                                  )}
                                </View>
                                <Text style={styles.adminCardEmail}>{admin.email}</Text>
                              </View>

                              {isSelected && (
                                <View style={styles.selectedCheckBadge}>
                                  <Text style={styles.selectedCheckText}>✓</Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {/* Proceed Button */}
                    <TouchableOpacity
                      style={[
                        styles.primaryActionBtn,
                        styles.revokeBtn,
                        (!selectedAdminId || activeCount < minRequired || submitting) && styles.btnDisabled
                      ]}
                      onPress={handleInitiateRemoval}
                      disabled={!selectedAdminId || activeCount < minRequired || submitting}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={styles.primaryActionBtnText}>
                          {activeCount < minRequired
                            ? `Cannot Remove (${activeCount}/${minRequired} Admins)`
                            : 'Proceed to Dual Approval & Revoke →'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* REMOVE STEP 2: Dual Approval & Revoke */}
                {removeStep === 2 && (
                  <View>
                    <View style={styles.approvalHeaderCard}>
                      <Text style={[styles.approvalHeaderTitle, { color: '#991b1b' }]}>
                        DUAL-ADMIN SECURITY REVOCATION APPROVAL
                      </Text>
                      <Text style={styles.approvalHeaderSubtitle}>
                        OTPs have been sent to two active administrators. Both codes must be verified to revoke admin access for{' '}
                        <Text style={styles.boldEmail}>{selectedAdmin?.email || selectedAdminId}</Text>.
                      </Text>
                    </View>

                    {/* Countdown & Resend */}
                    <View style={styles.timerResendRow}>
                      <View style={styles.timerBadge}>
                        <Text style={styles.timerBadgeText}>⏱ Valid for: {formatTimer(countdown)}</Text>
                      </View>
                      <TouchableOpacity onPress={handleResendCodes} disabled={submitting}>
                        <Text style={styles.resendTextBtn}>Resend Codes</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Approver 1 OTP */}
                    <View style={styles.approverOtpBlock}>
                      <View style={styles.approverTitleRow}>
                        <View style={[styles.circleNumberBadge, { backgroundColor: '#dc2626' }]}>
                          <Text style={styles.circleNumberText}>1</Text>
                        </View>
                        <Text style={styles.approverLabelText}>
                          Admin 1 Code: <Text style={styles.boldApproverEmail}>{approver1Info.email}</Text>
                        </Text>
                      </View>
                      <TextInput
                        style={styles.otpLargeInput}
                        placeholder="Enter 6-digit OTP"
                        placeholderTextColor="#cbd5e1"
                        keyboardType="number-pad"
                        maxLength={6}
                        value={otp1}
                        onChangeText={setOtp1}
                        editable={!submitting}
                      />
                    </View>

                    {/* Approver 2 OTP */}
                    <View style={styles.approverOtpBlock}>
                      <View style={styles.approverTitleRow}>
                        <View style={[styles.circleNumberBadge, { backgroundColor: '#dc2626' }]}>
                          <Text style={styles.circleNumberText}>2</Text>
                        </View>
                        <Text style={styles.approverLabelText}>
                          Admin 2 Code: <Text style={styles.boldApproverEmail}>{approver2Info.email}</Text>
                        </Text>
                      </View>
                      <TextInput
                        style={styles.otpLargeInput}
                        placeholder="Enter 6-digit OTP"
                        placeholderTextColor="#cbd5e1"
                        keyboardType="number-pad"
                        maxLength={6}
                        value={otp2}
                        onChangeText={setOtp2}
                        editable={!submitting}
                      />
                    </View>

                    <View style={styles.securityFootnoteRow}>
                      <Text style={styles.lockFootnoteIcon}>⚠️</Text>
                      <Text style={[styles.lockFootnoteText, { color: '#b91c1c' }]}>
                        Revoking will immediately invalidate existing JWT sessions and revert this account to USER.
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.primaryActionBtn,
                        styles.revokeBtn,
                        (otp1.length !== 6 || otp2.length !== 6 || submitting) && styles.btnDisabled
                      ]}
                      onPress={handleVerifyDualRemoval}
                      disabled={otp1.length !== 6 || otp2.length !== 6 || submitting}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={styles.primaryActionBtnText}>⚠️ Verify Both Codes & Revoke Administrator</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* TAB 3: SECURITY AUDIT LOG */}
            {activeTab === 'audit' && (
              <View style={styles.tabContent}>
                <View style={styles.titleSection}>
                  <View style={[styles.titleIconBadge, { backgroundColor: '#eff6ff' }]}>
                    <Text style={[styles.titleIconText, { color: '#1d4ed8' }]}>📜</Text>
                  </View>
                  <View style={styles.titleTextContainer}>
                    <Text style={styles.modalTitle}>Security Audit & Action History</Text>
                    <Text style={styles.modalSubtitle}>Immutable dual-admin authorization log trail</Text>
                  </View>
                </View>

                {loading ? (
                  <ActivityIndicator size="large" color="#1d4ed8" style={{ marginVertical: 30 }} />
                ) : auditLogs.length === 0 ? (
                  <View style={styles.emptyAuditBox}>
                    <Text style={styles.emptyAuditText}>No security audit records found.</Text>
                  </View>
                ) : (
                  <View style={styles.auditList}>
                    {auditLogs.map((log, idx) => (
                      <View key={log.id || idx} style={styles.auditCard}>
                        <View style={styles.auditCardHeader}>
                          <View style={styles.auditActionBadge}>
                            <Text style={styles.auditActionBadgeText}>{log.action}</Text>
                          </View>
                          <Text style={styles.auditTimeText}>
                            {new Date(log.timestamp).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short'
                            })}
                          </Text>
                        </View>
                        <Text style={styles.auditTargetText}>
                          Target Account: <Text style={{ fontWeight: '700' }}>{log.target_user || 'N/A'}</Text>
                        </Text>
                        <Text style={styles.auditDetailsText}>{log.details || log.result}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 18, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    width: '100%',
    height: '100%'
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 520,
    maxHeight: '94%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignSelf: 'center'
  },
  navTabsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 6
  },
  navTabsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 6
  },
  navTabBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9'
  },
  navTabBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  navTabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b'
  },
  navTabBtnTextActive: {
    color: '#0f172a',
    fontWeight: '800'
  },
  closeBtn: {
    marginLeft: 'auto',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569'
  },
  scrollBody: {
    flex: 1
  },
  scrollBodyContent: {
    padding: 20,
    paddingBottom: 32
  },
  errorAlertBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16
  },
  errorAlertText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '600'
  },
  successAlertBox: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16
  },
  successAlertText: {
    color: '#15803d',
    fontSize: 13,
    fontWeight: '700'
  },
  tabContent: {
    width: '100%'
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  titleIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  titleIconText: {
    fontSize: 20,
    color: '#b91c1c'
  },
  titleTextContainer: {
    flex: 1
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a'
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  stepBreadcrumbs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20
  },
  stepPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9'
  },
  stepPillActive: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5'
  },
  stepPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b'
  },
  stepPillTextActive: {
    color: '#b91c1c',
    fontWeight: '800'
  },
  redNoticeCard: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    marginBottom: 18
  },
  noticeIconCol: {
    marginRight: 10,
    paddingTop: 2
  },
  shieldIcon: {
    fontSize: 18
  },
  noticeTextCol: {
    flex: 1
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#9f1239',
    marginBottom: 4
  },
  noticeDesc: {
    fontSize: 12,
    color: '#881337',
    lineHeight: 17
  },
  formGroup: {
    marginBottom: 16
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#0f172a'
  },
  fieldHelper: {
    fontSize: 11.5,
    marginTop: 5,
    fontWeight: '500'
  },
  infoBoxCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20
  },
  infoBoxIcon: {
    fontSize: 16,
    marginRight: 8
  },
  infoBoxText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569'
  },
  primaryActionBtn: {
    backgroundColor: '#b91c1c',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#b91c1c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4
  },
  confirmBtn: {
    backgroundColor: '#b91c1c'
  },
  revokeBtn: {
    backgroundColor: '#b91c1c'
  },
  grantBtn: {
    backgroundColor: '#15803d',
    marginTop: 16
  },
  primaryActionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  },
  btnDisabled: {
    opacity: 0.5
  },
  approvalHeaderCard: {
    backgroundColor: '#fff1f2',
    borderLeftWidth: 4,
    borderLeftColor: '#b91c1c',
    padding: 14,
    borderRadius: 8,
    marginBottom: 16
  },
  approvalHeaderTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#b91c1c',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  approvalHeaderSubtitle: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18
  },
  boldEmail: {
    fontWeight: '800',
    color: '#0f172a'
  },
  timerResendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18
  },
  timerBadge: {
    backgroundColor: '#fee2e2',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16
  },
  timerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b91c1c'
  },
  resendTextBtn: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9f1239'
  },
  approverOtpBlock: {
    marginBottom: 18
  },
  approverTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  circleNumberBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#b91c1c',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8
  },
  circleNumberText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800'
  },
  approverLabelText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600'
  },
  boldApproverEmail: {
    fontWeight: '800',
    color: '#0f172a'
  },
  otpLargeInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: 3,
    textAlign: 'center',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined
  },
  securityFootnoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20
  },
  lockFootnoteIcon: {
    fontSize: 14,
    marginRight: 6
  },
  lockFootnoteText: {
    flex: 1,
    fontSize: 11.5,
    color: '#64748b',
    lineHeight: 16
  },
  step3Container: {
    alignItems: 'center'
  },
  step3SuccessCard: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    width: '100%',
    marginBottom: 16
  },
  step3SuccessIcon: {
    fontSize: 36,
    marginBottom: 8
  },
  step3SuccessTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#166534',
    marginBottom: 6,
    textAlign: 'center'
  },
  step3SuccessDesc: {
    fontSize: 12.5,
    color: '#15803d',
    textAlign: 'center',
    lineHeight: 18
  },
  candidateVerifyForm: {
    width: '100%'
  },
  removalProtectionCard: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18
  },
  protectionIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  lockRedIcon: {
    fontSize: 16,
    marginRight: 6
  },
  protectionHeaderTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#991b1b'
  },
  protectionDesc: {
    fontSize: 12,
    color: '#7f1d1d',
    lineHeight: 17,
    marginBottom: 8
  },
  protectionCountText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#991b1b'
  },
  selectAdminHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10
  },
  adminCardsContainer: {
    gap: 10,
    marginBottom: 20
  },
  adminSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12
  },
  adminSelectCardSelected: {
    borderColor: '#b91c1c',
    backgroundColor: '#fff1f2'
  },
  adminSelectCardDisabled: {
    opacity: 0.6
  },
  radioCol: {
    marginRight: 10
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94a3b8',
    justifyContent: 'center',
    alignItems: 'center'
  },
  radioCircleSelected: {
    borderColor: '#b91c1c'
  },
  radioInnerCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#b91c1c'
  },
  adminCardAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  adminCardAvatarText: {
    fontSize: 16
  },
  adminCardInfo: {
    flex: 1
  },
  adminNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  adminCardName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a'
  },
  currentBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1d4ed8'
  },
  superBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  superBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#b45309'
  },
  adminCardEmail: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  selectedCheckBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#b91c1c',
    justifyContent: 'center',
    alignItems: 'center'
  },
  selectedCheckText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900'
  },
  emptyAuditBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyAuditText: {
    color: '#94a3b8',
    fontSize: 14
  },
  auditList: {
    gap: 12
  },
  auditCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12
  },
  auditCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  auditActionBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  auditActionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1d4ed8'
  },
  auditTimeText: {
    fontSize: 11,
    color: '#64748b'
  },
  auditTargetText: {
    fontSize: 12,
    color: '#334155',
    marginBottom: 4
  },
  auditDetailsText: {
    fontSize: 12,
    color: '#64748b'
  }
});
