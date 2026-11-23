import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
  KeyboardAvoidingView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScorerApi } from '../../services/api';
import { showSuccess, showError, showWarning } from '../../utils/sweetalert';
import { validateEmail } from '../../utils/validation';
import EmailDomainSuggestions from '../common/EmailDomainSuggestions';

export interface ForgotPasswordModalProps {
  visible: boolean;
  onClose: () => void;
  initialEmail?: string;
  role?: string;
  onSuccess?: (email: string, newPassword?: string) => void;
  onNavigateToRegister?: (role?: string) => void;
}

type ResetStep = 1 | 2 | 3;

export default function ForgotPasswordModal({
  visible,
  onClose,
  initialEmail = '',
  role = 'USER',
  onSuccess,
  onNavigateToRegister
}: ForgotPasswordModalProps) {
  const [currentStep, setCurrentStep] = useState<ResetStep>(1);

  // Form Fields
  const [email, setEmail] = useState('');
  const [otpBoxes, setOtpBoxes] = useState<string[]>(['', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 4 OTP Box Refs & Focus State
  const boxRef0 = useRef<any>(null);
  const boxRef1 = useRef<any>(null);
  const boxRef2 = useRef<any>(null);
  const boxRef3 = useRef<any>(null);
  const boxRefs = [boxRef0, boxRef1, boxRef2, boxRef3];
  const [focusedBoxIndex, setFocusedBoxIndex] = useState<number | null>(null);

  // UI States
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setEmail(initialEmail || '');
      setOtpBoxes(['', '', '', '']);
      setNewPassword('');
      setConfirmPassword('');
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setNewPasswordError(null);
      setConfirmPasswordError(null);
      setCurrentStep(1);
      setErrorMessage(null);
    }
  }, [visible, initialEmail]);

  // Auto-focus first box when navigating to Step 2
  useEffect(() => {
    if (currentStep === 2) {
      const timer = setTimeout(() => {
        boxRefs[0].current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  // STEP 1: Request 4-digit OTP
  const handleRequestOtp = async () => {
    setErrorMessage(null);
    const cleanEmail = email.trim();

    const emailCheck = validateEmail(cleanEmail);
    if (!emailCheck.isValid) {
      const err = emailCheck.error || 'Please enter a valid email address.';
      setErrorMessage(err);
      showWarning('Invalid Email', err);
      return;
    }

    setIsLoading(true);
    try {
      const res = await ScorerApi.requestForgotPasswordOtp(cleanEmail, role);

      // SweetAlert at end of Step 1
      await showSuccess(
        'OTP Sent Successfully!',
        res?.message || `A 4-digit verification code has been dispatched to ${cleanEmail}. Please check your inbox.`,
        2600
      );

      setOtpBoxes(['', '', '', '']);
      setCurrentStep(2);
    } catch (err: any) {
      const isNotRegistered =
        err?.status === 404 ||
        err?.notRegistered ||
        err?.data?.notRegistered ||
        (err?.message && (err.message.includes("can't join") || err.message.toLowerCase().includes('register')));

      if (isNotRegistered) {
        const notRegMsg = "You can't join this association! Please register first.";
        setErrorMessage(notRegMsg);
        await showWarning(
          'Registration Required',
          notRegMsg
        );
        onClose();
        if (onNavigateToRegister) {
          onNavigateToRegister(role);
        }
      } else {
        const msg = err?.message || 'Failed to send verification code. Please check email address.';
        setErrorMessage(msg);
        showError('Account Lookup Failed', msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // OTP 4-Box Handlers
  const handleBoxChange = (val: string, index: number) => {
    if (errorMessage) setErrorMessage(null);
    const cleaned = val.replace(/[^0-9]/g, '');

    // Check if user pasted multiple digits (e.g. "1234")
    if (cleaned.length > 1) {
      const newBoxes = [...otpBoxes];
      for (let i = 0; i < 4; i++) {
        newBoxes[i] = cleaned[i] || '';
      }
      setOtpBoxes(newBoxes);
      const nextIndex = Math.min(cleaned.length, 3);
      boxRefs[nextIndex].current?.focus();
      return;
    }

    const newBoxes = [...otpBoxes];
    newBoxes[index] = cleaned;
    setOtpBoxes(newBoxes);

    // Auto-advance to next box
    if (cleaned && index < 3) {
      boxRefs[index + 1].current?.focus();
    }
  };

  const handleBoxKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (!otpBoxes[index] && index > 0) {
        const newBoxes = [...otpBoxes];
        newBoxes[index - 1] = '';
        setOtpBoxes(newBoxes);
        boxRefs[index - 1].current?.focus();
      }
    }
  };

  // STEP 2: Verify 4-digit OTP
  const handleVerifyOtp = async () => {
    setErrorMessage(null);
    const combinedOtp = otpBoxes.join('').trim();

    if (!combinedOtp) {
      setErrorMessage('Please enter the 4-digit OTP code.');
      showWarning('OTP Required', 'Please enter the 4-digit verification code sent to your email.');
      return;
    }

    if (combinedOtp.length < 4) {
      setErrorMessage('Please enter all 4 digits of the OTP code.');
      showWarning('Incomplete OTP', 'The verification code must be 4 digits.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await ScorerApi.verifyForgotPasswordOtp(email.trim(), combinedOtp);

      // SweetAlert at end of Step 2
      await showSuccess(
        'OTP Verified Successfully!',
        res?.message || 'Verification complete. Please enter your new password below.',
        2000
      );

      setCurrentStep(3);
    } catch (err: any) {
      const msg = err?.message || 'Invalid or expired 4-digit OTP code.';
      setErrorMessage(msg);
      showError('Verification Failed', msg);
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 3: Reset and Encrypt Password
  const handleResetPassword = async () => {
    setErrorMessage(null);
    setNewPasswordError(null);
    setConfirmPasswordError(null);
    const pass = newPassword.trim();
    const conf = confirmPassword.trim();
    const combinedOtp = otpBoxes.join('').trim();

    if (!pass) {
      const err = 'Please enter a new password.';
      setNewPasswordError(err);
      setErrorMessage(err);
      showWarning('Password Required', err);
      return;
    }

    if (pass.length < 4) {
      const err = 'Password must be at least 4 characters long.';
      setNewPasswordError(err);
      setErrorMessage(err);
      showWarning('Password Requirements', err);
      return;
    }

    if (!conf) {
      const err = 'Please confirm your new password.';
      setConfirmPasswordError(err);
      setErrorMessage(err);
      showWarning('Confirm Password', err);
      return;
    }

    if (pass !== conf) {
      const err = 'New password and confirm password do not match.';
      setConfirmPasswordError(err);
      setErrorMessage(err);
      showWarning('Passwords Do Not Match', err);
      return;
    }

    setIsLoading(true);
    try {
      const res = await ScorerApi.resetPassword(email.trim(), combinedOtp, pass, conf);

      // SweetAlert at end of Step 3
      await showSuccess(
        'Password Reset Successful!',
        res?.message || 'Your new password has been saved. You can now log in.',
        2500
      );

      if (onSuccess) {
        onSuccess(email.trim(), pass);
      }
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Failed to update password. Please try again.';
      setErrorMessage(msg);
      showError('Reset Failed', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Reset Account Password</Text>
              <Text style={styles.modalSubtitle}>
                {currentStep === 1 && 'Step 1 of 3: Enter your registered email'}
                {currentStep === 2 && 'Step 2 of 3: Enter 4-digit verification code'}
                {currentStep === 3 && 'Step 3 of 3: Create your new secure password'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Stepper Progress Bar */}
          <View style={styles.stepperContainer}>
            <View style={[styles.stepItem, currentStep >= 1 && styles.stepItemActive]}>
              <View style={[styles.stepCircle, currentStep >= 1 && styles.stepCircleActive]}>
                <Text style={[styles.stepNumber, currentStep >= 1 && styles.stepNumberActive]}>1</Text>
              </View>
              <Text style={[styles.stepLabel, currentStep >= 1 && styles.stepLabelActive]}>Email</Text>
            </View>

            <View style={[styles.stepLine, currentStep >= 2 && styles.stepLineActive]} />

            <View style={[styles.stepItem, currentStep >= 2 && styles.stepItemActive]}>
              <View style={[styles.stepCircle, currentStep >= 2 && styles.stepCircleActive]}>
                <Text style={[styles.stepNumber, currentStep >= 2 && styles.stepNumberActive]}>2</Text>
              </View>
              <Text style={[styles.stepLabel, currentStep >= 2 && styles.stepLabelActive]}>4-Digit OTP</Text>
            </View>

            <View style={[styles.stepLine, currentStep >= 3 && styles.stepLineActive]} />

            <View style={[styles.stepItem, currentStep >= 3 && styles.stepItemActive]}>
              <View style={[styles.stepCircle, currentStep >= 3 && styles.stepCircleActive]}>
                <Text style={[styles.stepNumber, currentStep >= 3 && styles.stepNumberActive]}>3</Text>
              </View>
              <Text style={[styles.stepLabel, currentStep >= 3 && styles.stepLabelActive]}>New Password</Text>
            </View>
          </View>

          {/* Error Banner */}
          {errorMessage && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            {/* STEP 1: EMAIL */}
            {currentStep === 1 && (
              <View style={styles.stepContent}>
                <Text style={styles.inputLabel}>REGISTERED EMAIL ADDRESS</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your registered email ID"
                  placeholderTextColor="#94a3b8"
                  value={email}
                  onChangeText={(val) => {
                    setEmail(val);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <EmailDomainSuggestions
                  value={email}
                  onSelectDomain={(completed) => {
                    setEmail(completed);
                    if (errorMessage) setErrorMessage(null);
                  }}
                />
                <Text style={styles.inputHint}>
                  A 4-digit One-Time Password (OTP) will be sent to this email via the Association mail server.
                </Text>

                <TouchableOpacity
                  style={[styles.primaryBtn, isLoading && styles.btnDisabled]}
                  onPress={handleRequestOtp}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#020612" />
                  ) : (
                    <Text style={styles.primaryBtnText}>SEND 4-DIGIT OTP →</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 2: 4 INDIVIDUAL OTP BOXES */}
            {currentStep === 2 && (
              <View style={styles.stepContent}>
                <View style={styles.infoBox}>
                  <Text style={styles.infoBoxText}>
                    ✉️ Code sent to: <Text style={styles.boldText}>{email}</Text>
                  </Text>
                </View>

                <Text style={styles.inputLabel}>ENTER 4-DIGIT VERIFICATION CODE</Text>

                {/* 4 Separate OTP Boxes */}
                <View style={styles.otpBoxesRow}>
                  {otpBoxes.map((digit, idx) => (
                    <TextInput
                      key={idx}
                      ref={boxRefs[idx]}
                      style={[
                        styles.otpBox,
                        focusedBoxIndex === idx && styles.otpBoxFocused,
                        digit ? styles.otpBoxFilled : null
                      ]}
                      value={digit}
                      onChangeText={(val) => handleBoxChange(val, idx)}
                      onKeyPress={(e) => handleBoxKeyPress(e, idx)}
                      onFocus={() => setFocusedBoxIndex(idx)}
                      onBlur={() => setFocusedBoxIndex(null)}
                      keyboardType="number-pad"
                      maxLength={idx === 0 ? 4 : 1}
                      selectTextOnFocus
                      textAlign="center"
                    />
                  ))}
                </View>

                <Text style={styles.inputHint}>
                  Enter the 4-digit number received in your inbox. (Dev fallback: 1234)
                </Text>

                <TouchableOpacity
                  style={[styles.primaryBtn, isLoading && styles.btnDisabled]}
                  onPress={handleVerifyOtp}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#020612" />
                  ) : (
                    <Text style={styles.primaryBtnText}>VERIFY 4-DIGIT OTP →</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.secondaryActionsRow}>
                  <TouchableOpacity
                    onPress={() => setCurrentStep(1)}
                    disabled={isLoading}
                    style={styles.textLinkBtn}
                  >
                    <Text style={styles.textLink}>← Change Email</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleRequestOtp}
                    disabled={isLoading}
                    style={styles.textLinkBtn}
                  >
                    <Text style={styles.textLink}>Resend OTP</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* STEP 3: NEW PASSWORD FORM */}
            {currentStep === 3 && (
              <View style={styles.stepContent}>
                <View style={styles.infoBoxSuccess}>
                  <Text style={styles.infoBoxSuccessText}>
                    ✓ Identity confirmed for: <Text style={styles.boldText}>{email}</Text>
                  </Text>
                </View>

                {/* NEW PASSWORD SECTION */}
                <Text style={styles.inputLabel}>NEW PASSWORD</Text>
                <View style={[styles.passwordWrapper, newPasswordError ? styles.inputError : null]}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Enter new password (min 4 characters)"
                    placeholderTextColor="#94a3b8"
                    value={newPassword}
                    onChangeText={(val) => {
                      setNewPassword(val);
                      if (errorMessage) setErrorMessage(null);
                      if (newPasswordError) setNewPasswordError(null);
                      if (confirmPassword) {
                        setConfirmPasswordError(val === confirmPassword ? null : 'Passwords do not match.');
                      }
                    }}
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    style={styles.eyeBtn}
                    activeOpacity={0.7}
                    accessibilityLabel={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons
                      name={showNewPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color={showNewPassword ? '#b45309' : '#64748b'}
                    />
                  </TouchableOpacity>
                </View>
                {newPasswordError ? (
                  <Text style={styles.fieldErrorText}>⚠️ {newPasswordError}</Text>
                ) : null}

                <Text style={[styles.inputLabel, { marginTop: 10 }]}>CONFIRM NEW PASSWORD</Text>
                <View style={[styles.passwordWrapper, confirmPasswordError ? styles.inputError : null]}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Confirm new password"
                    placeholderTextColor="#94a3b8"
                    value={confirmPassword}
                    onChangeText={(val) => {
                      setConfirmPassword(val);
                      if (errorMessage) setErrorMessage(null);
                      if (confirmPasswordError) setConfirmPasswordError(null);
                    }}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeBtn}
                    activeOpacity={0.7}
                    accessibilityLabel={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color={showConfirmPassword ? '#b45309' : '#64748b'}
                    />
                  </TouchableOpacity>
                </View>
                {confirmPasswordError ? (
                  <Text style={styles.fieldErrorText}>⚠️ {confirmPasswordError}</Text>
                ) : null}

                <Text style={styles.inputHint}>
                  Password must be at least 4 characters long.
                </Text>

                <TouchableOpacity
                  style={[styles.primaryBtn, isLoading && styles.btnDisabled]}
                  onPress={handleResetPassword}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#020612" />
                  ) : (
                    <Text style={styles.primaryBtnText}>RESET PASSWORD & LOG IN →</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setCurrentStep(2)}
                  disabled={isLoading}
                  style={[styles.textLinkBtn, { marginTop: 12 }]}
                >
                  <Text style={styles.textLink}>← Back to OTP</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 32,
    elevation: 20,
    overflow: 'hidden'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.3
  },
  modalSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 4
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  closeBtnText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: 'bold'
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  stepItem: {
    alignItems: 'center'
  },
  stepItemActive: {},
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  stepCircleActive: {
    backgroundColor: '#eab308'
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b'
  },
  stepNumberActive: {
    color: '#020612'
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 3
  },
  stepLabelActive: {
    color: '#0f172a',
    fontWeight: '700'
  },
  stepLine: {
    width: 44,
    height: 2,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 8,
    marginTop: -14
  },
  stepLineActive: {
    backgroundColor: '#eab308'
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    marginHorizontal: 22,
    marginTop: 16,
    padding: 10,
    borderRadius: 8
  },
  errorIcon: {
    fontSize: 14,
    marginRight: 8
  },
  errorText: {
    fontSize: 12,
    color: '#b91c1c',
    fontWeight: '600',
    flex: 1
  },
  modalBody: {
    paddingHorizontal: 22,
    paddingVertical: 18
  },
  stepContent: {
    paddingBottom: 8
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: 0.5,
    marginBottom: 8
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    outlineStyle: 'none' as any
  },
  // 4 OTP Boxes
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginVertical: 12
  },
  otpBox: {
    width: 58,
    height: 60,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    outlineStyle: 'none' as any
  },
  otpBoxFocused: {
    borderColor: '#eab308',
    backgroundColor: '#fffbeb',
    shadowColor: '#ca8a04',
    shadowOpacity: 0.25,
    shadowRadius: 6
  },
  otpBoxFilled: {
    borderColor: '#ca8a04',
    backgroundColor: '#ffffff'
  },
  inputHint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
    marginBottom: 18,
    lineHeight: 18
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16
  },
  infoBoxText: {
    fontSize: 13,
    color: '#1e40af'
  },
  infoBoxSuccess: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16
  },
  infoBoxSuccessText: {
    fontSize: 13,
    color: '#166534'
  },
  boldText: {
    fontWeight: '700'
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    marginBottom: 14,
    paddingRight: 6
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    outlineStyle: 'none' as any
  },
  eyeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  primaryBtn: {
    backgroundColor: '#eab308',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ca8a04',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4
  },
  btnDisabled: {
    opacity: 0.7
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#020612',
    letterSpacing: 0.6
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14
  },
  textLinkBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4
  },
  textLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb'
  },
  criteriaBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    marginBottom: 16
  },
  criteriaHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  criteriaTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155'
  },
  criteriaBadgeMet: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#86efac'
  },
  criteriaBadgeMetText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#15803d'
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  pillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  pillItemMet: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac'
  },
  pillItemError: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5'
  },
  pillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748b'
  },
  pillTextMet: {
    color: '#15803d'
  },
  pillTextError: {
    color: '#dc2626'
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fff5f5'
  },
  fieldErrorText: {
    color: '#ef4444',
    fontSize: 11,
    marginTop: 4,
    marginBottom: 4,
    fontWeight: '600'
  },

  // Old / Current Password Card
  oldPasswordCard: {
    backgroundColor: '#fffbeb',
    borderWidth: 1.5,
    borderColor: '#fde047',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16
  },
  oldPasswordHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  oldPasswordHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  oldPasswordIcon: {
    fontSize: 16
  },
  oldPasswordTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#92400e',
    letterSpacing: 0.5
  },
  oldPasswordBadge: {
    backgroundColor: '#fef08a',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#f59e0b'
  },
  oldPasswordBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#b45309'
  },
  oldPasswordHint: {
    fontSize: 11.5,
    color: '#78350f',
    marginBottom: 10,
    lineHeight: 16
  },
  oldPasswordBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12
  },
  oldPasswordValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 1
  },
  oldPasswordActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  oldPasswordIconBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#fef3c7'
  },
  oldPasswordCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#fef3c7'
  },
  copyBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#b45309'
  },
  keepPasswordBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ca8a04',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2
  },
  keepPasswordBtnText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#020612',
    letterSpacing: 0.4
  },

  // Divider
  orDividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0'
  },
  orBadge: {
    paddingHorizontal: 10
  },
  orText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6
  }
});
