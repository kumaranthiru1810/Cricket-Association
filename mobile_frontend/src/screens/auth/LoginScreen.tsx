import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  Platform,
  Modal,
  useWindowDimensions
} from 'react-native';
import { useAppNavigation } from '../../navigation/AppNavigator';
import { ScorerApi, setAuthToken, setCurrentUser } from '../../services/api';
import { showSuccess, showError, showWarning } from '../../utils/sweetalert';
import { validateEmail, validatePassword } from '../../utils/validation';
import ForgotPasswordModal from '../../components/auth/ForgotPasswordModal';
import FindTeamModal from '../../components/auth/FindTeamModal';

export type UserRole = 'PLAYER' | 'TEAM' | 'SCORER' | 'UMPIRE';

export const LOGIN_ROLES: { key: UserRole; label: string; icon: string; desc: string }[] = [
  { key: 'PLAYER', label: 'Player', icon: '🏏', desc: 'District player profile & team credentials' },
  { key: 'TEAM', label: 'Team & Coach', icon: '🛡️', desc: 'Club & institution management portal' },
  { key: 'SCORER', label: 'Scorer', icon: '📋', desc: 'Official match scorer accreditation' },
  { key: 'UMPIRE', label: 'Umpire', icon: '⚖️', desc: 'Official association umpire panel' }
];

interface LoginScreenProps {
  onExit?: () => void;
}

export default function LoginScreen({ onExit }: LoginScreenProps = {}) {
  const { navigate, goBack, params } = useAppNavigation();

  const [activeRole, setActiveRole] = useState<UserRole>((params?.initialRole as UserRole) || 'PLAYER');

  // Input States
  const [emailOrUser, setEmailOrUser] = useState('');
  const [teamName, setTeamName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showFindTeamModal, setShowFindTeamModal] = useState(false);

  // Loading & Feedback States
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error' | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});

  // Modal Dropdown State (matching RegistrationScreen)
  const [pickerState, setPickerState] = useState<{
    visible: boolean;
    title: string;
    options: string[];
    selectedValue: string;
    onSelect: (val: string) => void;
  } | null>(null);

  const activeRoleObj = LOGIN_ROLES.find((r) => r.key === activeRole) || LOGIN_ROLES[0];

  const resetFormState = (newRole: UserRole) => {
    setActiveRole(newRole);
    setStatusMessage(null);
    setStatusType(null);
    setFieldErrors({});
    setEmailOrUser('');
    setTeamName('');
    setPassword('');
  };

  // Quick fill helper for demo/testing
  const handleDemoFill = () => {
    setFieldErrors({});
    if (activeRole === 'PLAYER') {
      setTeamName('Strikers Cricket Club');
      setEmailOrUser('saravanan.r@strikerscc.org');
    } else if (activeRole === 'TEAM') {
      setEmailOrUser('kannan.coach@strikerscc.org');
      setPassword('Coach@2026#');
    } else if (activeRole === 'SCORER') {
      setEmailOrUser('ramesh@gmail.com');
      setPassword('Scorer@2026#');
    } else if (activeRole === 'UMPIRE') {
      setEmailOrUser('sundaram.umpire@cfvd.org');
      setPassword('Umpire@2026#');
    }
  };

  // Password Login Handler
  const handleLogin = async () => {
    setStatusMessage(null);
    setStatusType(null);
    setFieldErrors({});

    const input = emailOrUser.trim();
    const pass = password.trim();

    const newErrors: { identifier?: string; password?: string; teamName?: string } = {};

    // PLAYER login: team name + email (no password)
    if (activeRole === 'PLAYER') {
      if (!teamName.trim()) {
        newErrors.teamName = 'Please enter your team name.';
      }
      const emailResult = validateEmail(input);
      if (!emailResult.isValid) {
        newErrors.identifier = emailResult.error;
      }
      if (Object.keys(newErrors).length > 0) {
        setFieldErrors(newErrors);
        showWarning('Validation Error', newErrors.teamName || newErrors.identifier || 'Please fill all fields.');
        return;
      }

      setIsLoading(true);
      setStatusMessage('Verifying player credentials...');
      setStatusType('info');
      try {
        const res = await ScorerApi.loginWithPassword(input, '', 'PLAYER', teamName.trim());
        if (res?.token) {
          setAuthToken(res.token, 'PLAYER');
          if (res.user) setCurrentUser(res.user);
        }
        setStatusMessage(res?.message || 'Login successful!');
        setStatusType('success');
        await showSuccess('Login Successful!', res?.message || 'Welcome to Player Portal!', 1500);
        setIsLoading(false);
        navigate('Player', { user: res?.user, playerName: input });
      } catch (err: any) {
        setIsLoading(false);
        const rawMsg = err?.message || 'Login failed. Please check your team name and email.';
        const isPending = err?.pendingApproval || rawMsg.toLowerCase().includes('pending');
        if (isPending) {
          setStatusMessage(rawMsg);
          setStatusType('error');
          showError('Pending Admin Approval', rawMsg);
        } else {
          setFieldErrors({ identifier: rawMsg });
          showError('Authentication Failed', rawMsg);
        }
      }
      return;
    }

    // 1. Email validation: Must contain '@', '.', and valid email structure
    const emailResult = validateEmail(input);
    if (!emailResult.isValid) {
      newErrors.identifier = emailResult.error;
    }

    // 2. Password validation: 1 uppercase, 2 special characters, min 8 characters
    const passwordResult = validatePassword(pass);
    if (!passwordResult.isValid) {
      newErrors.password = passwordResult.error;
    }

    // If validation fails, show error messages and DO NOT SUBMIT
    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      const firstErrorMessage = newErrors.identifier || newErrors.password || 'Please correct the highlighted validation errors.';
      showWarning('Validation Error', firstErrorMessage);
      return;
    }

    setIsLoading(true);
    setStatusMessage('Authenticating credentials...');
    setStatusType('info');

    try {
      const res = await ScorerApi.loginWithPassword(input, pass, activeRole);

      if (res?.token) {
        setAuthToken(res.token, activeRole);
        if (res.user) setCurrentUser(res.user);
      }

      setStatusMessage(res?.message || 'Login successful! Redirecting...');
      setStatusType('success');

      await showSuccess(
        'Login Successful!',
        res?.message || `Welcome to ${activeRole.charAt(0) + activeRole.slice(1).toLowerCase()} Portal!`,
        1500
      );

      setIsLoading(false);
      if (activeRole === 'TEAM') {
        navigate('Team', { user: res?.user, teamName: res?.user?.teamName || input });
      } else if (activeRole === 'SCORER') {
        navigate('Scorer', { user: res?.user });
      } else if (activeRole === 'UMPIRE') {
        navigate('Umpire', { user: res?.user });
      }
    } catch (err: any) {
      setIsLoading(false);
      const rawMsg = err?.message || 'Login failed. Please check your credentials.';
      const lower = rawMsg.toLowerCase();
      const isPending = err?.pendingApproval || lower.includes('pending') || lower.includes('approval');
      if (isPending) {
        setStatusMessage(rawMsg);
        setStatusType('error');
        showError('Pending Admin Approval', rawMsg);
      } else if (lower.includes('user') || lower.includes('not found') || lower.includes('account') || lower.includes('email') || lower.includes('team')) {
        setFieldErrors({ identifier: rawMsg });
        showError('Authentication Failed', rawMsg);
      } else {
        setFieldErrors({ password: rawMsg });
        showError('Authentication Failed', rawMsg);
      }
    }
  };

  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 640;
  const styles = useMemo(() => getStyles(isDesktop), [isDesktop]);

  return (
    <View style={[styles.container, Platform.OS === 'web' && isDesktop && ({ minHeight: '100vh', width: '100%' } as any)]}>
      {/* Sleek Minimal Corner Exit Action */}
      <TouchableOpacity
        onPress={() => (onExit ? onExit() : navigate('Home'))}
        style={styles.cornerExitBtn}
        activeOpacity={0.8}
      >
        <Text style={styles.cornerExitText}>← Exit to Main</Text>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={[styles.scroll, isDesktop && { flexGrow: 1, justifyContent: 'center' }]}
        scrollEnabled={true}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.cardContainer}>

          {/* Federation Logo & Title */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../../../assets/logo_transparent.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.mainTitle}>CRICKET FEDERATION OF</Text>
            <Text style={styles.mainSubtitle}>VIRUDHUNAGAR DISTRICT</Text>
          </View>

          {/* Login Card */}
          <View style={styles.card}>
            {/* Header: Title + Role Dropdown Box (replacing separate tabs, matching Registration) */}
            <View style={styles.cardTopRow}>
              <View style={styles.cardTitleBlock}>
                <Text style={styles.title}>Login Here</Text>
                {/* <Text style={styles.subtitle}>
                  Login Here with your registered account credentials and password
                </Text> */}
              </View>

              <View style={styles.headerRightActions}>
                {/* <TouchableOpacity
                  style={styles.demoFillBtn}
                  activeOpacity={0.8}
                  onPress={handleDemoFill}
                >
                  <Text style={styles.demoFillBtnText}>⚡ Demo Fill</Text>
                </TouchableOpacity> */}

                {/* Dropdown Box for Selecting Role (matching Registration) */}
                <View style={styles.roleDropdownWrapper}>
                  <Text style={styles.roleDropdownLabel}>Login Category *</Text>
                  <TouchableOpacity
                    style={styles.roleDropdownBtn}
                    activeOpacity={0.7}
                    onPress={() =>
                      setPickerState({
                        visible: true,
                        title: 'Select Login Category',
                        options: LOGIN_ROLES.map((r) => `${r.icon} ${r.label}`),
                        selectedValue: `${activeRoleObj.icon} ${activeRoleObj.label}`,
                        onSelect: (selectedStr) => {
                          const match = LOGIN_ROLES.find(
                            (r) => `${r.icon} ${r.label}` === selectedStr
                          );
                          if (match) resetFormState(match.key);
                        }
                      })
                    }
                  >
                    <View style={styles.roleDropdownSelected}>
                      <Text style={styles.roleDropdownSelectedIcon}>{activeRoleObj.icon}</Text>
                      <Text style={styles.roleDropdownSelectedText} numberOfLines={1}>
                        {activeRoleObj.label}
                      </Text>
                    </View>
                    <Text style={styles.roleDropdownChevron}>▾</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Status Banner - show for all types including error for pending approval */}
            {statusMessage && (
              <View
                style={[
                  styles.statusBanner,
                  statusType === 'error' && styles.statusError,
                  statusType === 'success' && styles.statusSuccess,
                  statusType === 'info' && styles.statusInfo
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    statusType === 'error' && styles.statusTextError,
                    statusType === 'success' && styles.statusTextSuccess,
                    statusType === 'info' && styles.statusTextInfo
                  ]}
                >
                  {statusMessage}
                </Text>
              </View>
            )}

            {/* Section Header Box with Gold Border */}
            <View style={styles.sectionHeaderBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.sectionHeaderText}>
                  {activeRole === 'PLAYER' && '🏏 PLAYER PORTAL ACCESS'}
                  {activeRole === 'TEAM' && '🛡️ TEAM & COACH MANAGEMENT ACCESS'}
                  {activeRole === 'SCORER' && '📋 OFFICIAL SCORER LOGIN'}
                  {activeRole === 'UMPIRE' && '⚖️ OFFICIAL UMPIRE LOGIN'}
                </Text>
              </View>
            </View>

            {/* Team Name Field - PLAYER only */}
            {activeRole === 'PLAYER' && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: isDesktop ? 6 : 4 }}>
                  <Text style={[styles.label, { marginBottom: 0 }]}>Team Name *</Text>
                  <TouchableOpacity
                    onPress={() => setShowFindTeamModal(true)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={{ color: '#d97706', fontSize: isDesktop ? 13 : 11.5, fontWeight: '700' }}>
                      🔍 Find your team
                    </Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[
                    styles.input,
                    (fieldErrors as any).teamName && styles.inputError,
                    (fieldErrors as any).teamName && { marginBottom: 4 }
                  ]}
                  value={teamName}
                  onChangeText={(text) => {
                    setTeamName(text);
                    if ((fieldErrors as any).teamName) {
                      setFieldErrors((prev) => ({ ...prev, teamName: undefined }));
                    }
                  }}
                  placeholder="e.g. Strikers Cricket Club"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="words"
                />
                {(fieldErrors as any).teamName ? (
                  <Text style={styles.fieldErrorText}>{(fieldErrors as any).teamName}</Text>
                ) : null}
              </>
            )}

            {/* Identifier Field */}
            <Text style={styles.label}>
              {activeRole === 'PLAYER' && 'Registered Player Email *'}
              {activeRole === 'TEAM' && 'Registered Coach Email or Club Name *'}
              {activeRole === 'SCORER' && 'Official Scorer Email Address *'}
              {activeRole === 'UMPIRE' && 'Official Umpire Email Address *'}
            </Text>
            <TextInput
              style={[
                styles.input,
                fieldErrors.identifier && styles.inputError,
                fieldErrors.identifier && { marginBottom: 4 }
              ]}
              value={emailOrUser}
              onChangeText={(text) => {
                setEmailOrUser(text);
                if (fieldErrors.identifier) {
                  setFieldErrors((prev) => ({ ...prev, identifier: undefined }));
                }
              }}
              placeholder={
                activeRole === 'PLAYER'
                  ? 'e.g. saravanan.r@strikerscc.org'
                  : activeRole === 'TEAM'
                    ? 'e.g. kannan.coach@strikerscc.org'
                    : activeRole === 'SCORER'
                      ? 'e.g. ramesh@gmail.com'
                      : 'e.g. sundaram.umpire@cfvd.org'
              }
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {fieldErrors.identifier ? (
              <Text style={styles.fieldErrorText}>{fieldErrors.identifier}</Text>
            ) : null}


            {/* Password Field - Hidden for PLAYER role */}
            {activeRole !== 'PLAYER' && (
              <>
                {/* Password Field Header with Inline Forgot Password Link */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: isDesktop ? 8 : 6 }}>
                  <Text style={[styles.label, { marginBottom: 0 }]}>Account Password *</Text>
                  <TouchableOpacity onPress={() => setShowForgotPassword(true)} activeOpacity={0.7}>
                    <Text style={{ color: '#d97706', fontSize: isDesktop ? 14.5 : 13, fontWeight: '700' }}>Forgot Password?</Text>
                  </TouchableOpacity>
                </View>

                <View
                  style={[
                    styles.passwordContainer,
                    fieldErrors.password && styles.inputError,
                    fieldErrors.password && { marginBottom: 4 }
                  ]}
                >
                  <TextInput
                    style={styles.passwordInput}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    secureTextEntry={!showPassword}
                    placeholder="Enter your password"
                    placeholderTextColor="#94a3b8"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Text style={styles.toggleText}>{showPassword ? '👁️' : '🔒'}</Text>
                  </TouchableOpacity>
                </View>
                {fieldErrors.password ? (
                  <Text style={styles.fieldErrorText}>{fieldErrors.password}</Text>
                ) : null}
              </>
            )}

            {/* Action Button */}
            <TouchableOpacity
              style={[styles.actionBtn, isLoading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.actionText}>
                  {activeRole === 'PLAYER' && 'Login Here (Player Portal)'}
                  {activeRole === 'TEAM' && 'Login Here (Coach / Manager)'}
                  {activeRole === 'SCORER' && 'Login Here (Scorer Panel)'}
                  {activeRole === 'UMPIRE' && 'Login Here (Umpire Panel)'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Register Prompt Link Row */}
            <View style={styles.registerPromptRow}>
              <Text style={styles.promptNormalText}>Don't have an account? </Text>
              <TouchableOpacity
                onPress={() => navigate('Registration', { initialRole: activeRole })}
                activeOpacity={0.7}
              >
                <Text style={styles.registerLinkText}>Register Here</Text>
              </TouchableOpacity>
              {/*<Text style={styles.promptDividerText}> • </Text>*/}
              <TouchableOpacity
                onPress={() => setShowForgotPassword(true)}
                activeOpacity={0.7}
              >
                {/*<Text style={styles.forgotPasswordPromptText}>Forgot Password?</Text>*/}
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </ScrollView>

      {/* Reusable Forgot Password Modal */}
      <ForgotPasswordModal
        visible={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        initialEmail={emailOrUser}
        role={activeRole}
        onNavigateToRegister={(targetRole) => {
          navigate('Registration', { initialRole: targetRole || activeRole });
        }}
        onSuccess={(resetEmail) => {
          setEmailOrUser(resetEmail);
          setPassword('');
        }}
      />

      {/* Find Player Team Modal */}
      <FindTeamModal
        visible={showFindTeamModal}
        onClose={() => setShowFindTeamModal(false)}
        initialEmail={emailOrUser}
      />

      {/* Global Reusable Dropdown Modal (matching RegistrationScreen) */}
      {pickerState && (
        <Modal
          visible={pickerState.visible}
          transparent
          animationType="fade"
          onRequestClose={() => setPickerState(null)}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setPickerState(null)}
          >
            <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{pickerState.title}</Text>
                <TouchableOpacity onPress={() => setPickerState(null)} style={styles.modalCloseBtn}>
                  <Text style={styles.modalCloseBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                {pickerState.options.map((opt) => {
                  const isSelected = opt === pickerState.selectedValue;
                  const matchedRole = LOGIN_ROLES.find(
                    (r) => `${r.icon} ${r.label}` === opt
                  );
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                      onPress={() => {
                        pickerState.onSelect(opt);
                        setPickerState(null);
                      }}
                    >
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                          {opt}
                        </Text>
                        {matchedRole?.desc ? (
                          <Text style={[styles.modalItemDesc, isSelected && styles.modalItemDescSelected]}>
                            {matchedRole.desc}
                          </Text>
                        ) : null}
                      </View>
                      {isSelected && <Text style={styles.modalCheckmark}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const getStyles = (isDesktop: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', width: '100%', position: 'relative' },
  cornerExitBtn: {
    position: 'absolute',
    top: isDesktop ? 20 : 14,
    left: isDesktop ? 24 : 18,
    zIndex: 99,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: isDesktop ? 8 : 6,
    paddingHorizontal: isDesktop ? 16 : 12,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#eab308',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5
  },
  cornerExitText: {
    color: '#eab308',
    fontSize: isDesktop ? 14 : 12.5,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  scroll: { flexGrow: 1, width: '100%' },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: isDesktop ? 24 : 16,
    paddingVertical: isDesktop ? 24 : 12,
    width: '100%'
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: isDesktop ? 16 : 10,
    marginTop: isDesktop ? 8 : 4
  },
  logo: {
    width: isDesktop ? 76 : 56,
    height: isDesktop ? 76 : 56,
    marginBottom: isDesktop ? 8 : 4
  },
  mainTitle: {
    color: '#1e293b',
    fontSize: isDesktop ? 16 : 13,
    fontWeight: '800',
    letterSpacing: isDesktop ? 1.5 : 1
  },
  mainSubtitle: {
    color: '#b45309',
    fontSize: isDesktop ? 22 : 17,
    fontWeight: '900',
    letterSpacing: isDesktop ? 1.5 : 1
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: isDesktop ? 16 : 12,
    paddingHorizontal: isDesktop ? 34 : 20,
    paddingVertical: isDesktop ? 28 : 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: '100%',
    maxWidth: isDesktop ? 600 : 540,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4
  },
  cardTopRow: {
    flexDirection: isDesktop ? 'row' : 'column',
    justifyContent: 'space-between',
    alignItems: isDesktop ? 'center' : 'stretch',
    marginBottom: isDesktop ? 14 : 10,
    gap: isDesktop ? 12 : 8
  },
  cardTitleBlock: {
    flex: isDesktop ? 1 : undefined,
    minWidth: isDesktop ? 200 : undefined
  },
  title: {
    color: '#1e293b',
    fontSize: isDesktop ? 24 : 19,
    fontWeight: 'bold',
    marginBottom: isDesktop ? 4 : 2,
    textAlign: isDesktop ? 'left' : 'left'
  },
  subtitle: {
    color: '#64748b',
    fontSize: isDesktop ? 13.5 : 11.5,
    marginBottom: 0,
    textAlign: isDesktop ? 'left' : 'left',
    lineHeight: isDesktop ? 19 : 15
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: isDesktop ? 'flex-end' : 'space-between',
    gap: isDesktop ? 10 : 8,
    flexWrap: 'wrap'
  },
  demoFillBtn: {
    backgroundColor: '#fef08a',
    borderColor: '#eab308',
    borderWidth: 1.5,
    paddingHorizontal: isDesktop ? 12 : 10,
    height: isDesktop ? 40 : 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  demoFillBtnText: {
    color: '#854d0e',
    fontSize: isDesktop ? 13 : 11.5,
    fontWeight: '700'
  },
  roleDropdownWrapper: {
    minWidth: isDesktop ? 200 : 160,
    flex: isDesktop ? undefined : 1
  },
  roleDropdownLabel: {
    color: '#475569',
    fontSize: isDesktop ? 12 : 10.5,
    fontWeight: '700',
    marginBottom: 3
  },
  roleDropdownBtn: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: isDesktop ? 12 : 10,
    height: isDesktop ? 40 : 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  roleDropdownSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1
  },
  roleDropdownSelectedIcon: {
    fontSize: isDesktop ? 16 : 14
  },
  roleDropdownSelectedText: {
    color: '#0f172a',
    fontSize: isDesktop ? 14 : 12,
    fontWeight: '700'
  },
  roleDropdownChevron: {
    color: '#b45309',
    fontSize: isDesktop ? 15 : 13,
    fontWeight: 'bold',
    marginLeft: 6
  },

  statusBanner: {
    padding: isDesktop ? 12 : 8,
    borderRadius: isDesktop ? 8 : 6,
    marginBottom: isDesktop ? 14 : 10,
    borderWidth: 1
  },
  statusError: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  statusSuccess: { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  statusInfo: { backgroundColor: '#eff6ff', borderColor: '#93c5fd' },
  statusText: {
    fontSize: isDesktop ? 14 : 12,
    fontWeight: '600',
    textAlign: 'center'
  },
  statusTextError: { color: '#b91c1c' },
  statusTextSuccess: { color: '#15803d' },
  statusTextInfo: { color: '#1d4ed8' },

  sectionHeaderBox: {
    backgroundColor: '#f1f5f9',
    paddingVertical: isDesktop ? 10 : 6,
    paddingHorizontal: isDesktop ? 14 : 10,
    borderRadius: isDesktop ? 8 : 6,
    marginBottom: isDesktop ? 14 : 10,
    marginTop: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#eab308'
  },
  sectionHeaderText: {
    color: '#0f172a',
    fontSize: isDesktop ? 14 : 12,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  // Modal Dropdown Styles (matching RegistrationScreen)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    width: '100%',
    maxWidth: isDesktop ? 440 : 380,
    maxHeight: '80%',
    padding: isDesktop ? 20 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 8
  },
  modalTitle: {
    fontSize: isDesktop ? 16 : 14,
    fontWeight: '800',
    color: '#0f172a'
  },
  modalCloseBtn: {
    padding: 6
  },
  modalCloseBtnText: {
    fontSize: isDesktop ? 16 : 14,
    color: '#64748b',
    fontWeight: 'bold'
  },
  modalList: {
    maxHeight: 320
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: isDesktop ? 12 : 9,
    paddingHorizontal: isDesktop ? 12 : 10,
    borderRadius: 8,
    marginVertical: 2
  },
  modalItemSelected: {
    backgroundColor: '#fef3c7'
  },
  modalItemText: {
    fontSize: isDesktop ? 14.5 : 13,
    color: '#334155',
    fontWeight: '600'
  },
  modalItemTextSelected: {
    color: '#92400e',
    fontWeight: '800'
  },
  modalItemDesc: {
    fontSize: isDesktop ? 12 : 11,
    color: '#64748b',
    marginTop: 2
  },
  modalItemDescSelected: {
    color: '#b45309'
  },
  modalCheckmark: {
    fontSize: isDesktop ? 15 : 13,
    color: '#b45309',
    fontWeight: '900'
  },

  label: {
    color: '#334155',
    fontSize: isDesktop ? 14.5 : 12,
    marginBottom: isDesktop ? 6 : 4,
    fontWeight: '700'
  },
  input: {
    backgroundColor: '#f8fafc',
    color: '#1e293b',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    height: isDesktop ? 48 : 42,
    paddingHorizontal: isDesktop ? 14 : 12,
    borderRadius: isDesktop ? 8 : 6,
    marginBottom: isDesktop ? 14 : 10,
    fontSize: isDesktop ? 15.5 : 13.5
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2'
  },
  fieldErrorText: {
    color: '#dc2626',
    fontSize: isDesktop ? 13 : 12,
    fontWeight: '600',
    marginTop: -2,
    marginBottom: isDesktop ? 14 : 12,
    marginLeft: 2
  },
  passwordContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: isDesktop ? 8 : 6,
    height: isDesktop ? 48 : 42,
    marginBottom: isDesktop ? 14 : 10,
    alignItems: 'center',
    paddingRight: 12
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    color: '#1e293b',
    paddingHorizontal: isDesktop ? 14 : 12,
    fontSize: isDesktop ? 15.5 : 13.5
  },
  toggleText: {
    fontSize: isDesktop ? 18 : 15
  },

  actionBtn: {
    backgroundColor: '#eab308',
    height: isDesktop ? 50 : 44,
    borderRadius: isDesktop ? 8 : 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: isDesktop ? 10 : 6,
    shadowColor: '#eab308',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3
  },
  actionText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: isDesktop ? 15.5 : 13.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  btnDisabled: {
    opacity: 0.6
  },

  registerPromptRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: isDesktop ? 18 : 14,
    paddingTop: isDesktop ? 14 : 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  promptNormalText: {
    color: '#64748b',
    fontSize: isDesktop ? 15 : 13,
    fontWeight: '400'
  },
  registerLinkText: {
    color: '#b45309',
    fontSize: isDesktop ? 15 : 13,
    fontWeight: '700',
    textDecorationLine: 'underline'
  },
  forgotPasswordCenteredRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 4
  },
  forgotPasswordTouchable: {
    paddingVertical: 6,
    paddingHorizontal: 12
  },
  forgotPasswordMainText: {
    color: '#b45309',
    fontSize: isDesktop ? 15 : 13.5,
    fontWeight: '700',
    letterSpacing: 0.2
  },
  promptDividerText: {
    color: '#94a3b8',
    fontSize: isDesktop ? 15 : 14,
    fontWeight: 'bold',
    marginHorizontal: 4
  },
  forgotPasswordPromptText: {
    color: '#2563eb',
    fontSize: isDesktop ? 15 : 14,
    fontWeight: '700',
    textDecorationLine: 'underline'
  }
});
