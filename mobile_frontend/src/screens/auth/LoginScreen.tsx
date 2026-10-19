import React, { useState } from 'react';
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
  useWindowDimensions
} from 'react-native';
import { useAppNavigation } from '../../navigation/AppNavigator';
import SharedBackground from '../../components/scorer/SharedBackground';
import { ScorerApi, setAuthToken, setCurrentUser } from '../../services/api';
import { showSuccess, showError, showWarning } from '../../utils/sweetalert';
import { validateEmail, validatePassword } from '../../utils/validation';
import ForgotPasswordModal from '../../components/auth/ForgotPasswordModal';

type UserRole = 'PLAYER' | 'TEAM' | 'SCORER' | 'UMPIRE';

interface LoginScreenProps {
  onExit?: () => void;
}

export default function LoginScreen({ onExit }: LoginScreenProps = {}) {
  const { navigate, goBack, params } = useAppNavigation();

  const [activeRole, setActiveRole] = useState<UserRole>((params?.initialRole as UserRole) || 'PLAYER');

  // Input States
  const [emailOrUser, setEmailOrUser] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Loading & Feedback States
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error' | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});

  const resetFormState = (newRole: UserRole) => {
    setActiveRole(newRole);
    setStatusMessage(null);
    setStatusType(null);
    setFieldErrors({});
    setEmailOrUser('');
    setPassword('');
  };

  // Quick fill helper for demo/testing
  const handleDemoFill = () => {
    setFieldErrors({});
    if (activeRole === 'PLAYER') {
      setEmailOrUser('saravanan.r@strikerscc.org');
      setPassword('Striker@2026#');
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

    const newErrors: { identifier?: string; password?: string } = {};

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
        setAuthToken(res.token);
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
      if (activeRole === 'PLAYER') {
        navigate('Player', { user: res?.user, playerName: input });
      } else if (activeRole === 'TEAM') {
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
      if (lower.includes('user') || lower.includes('not found') || lower.includes('account') || lower.includes('email')) {
        setFieldErrors({ identifier: rawMsg });
      } else {
        setFieldErrors({ password: rawMsg });
      }
      showError('Authentication Failed', rawMsg);
    }
  };

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isDesktop = windowWidth >= 640;

  return (
    <SharedBackground>
      <View style={[styles.container, Platform.OS === 'web' && isDesktop && ({ height: '100vh', maxHeight: '100vh', overflow: 'hidden' } as any)]}>
        {/* Sleek Minimal Corner Exit Action */}
        <TouchableOpacity
          onPress={() => (onExit ? onExit() : navigate('Home'))}
          style={styles.cornerExitBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.cornerExitText}>← Exit to Main</Text>
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={[styles.scroll, isDesktop && { flex: 1, justifyContent: 'center' }]}
          scrollEnabled={!isDesktop}
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
              <Text style={styles.title}>Login Here</Text>
              <Text style={styles.subtitle}>
                Login Here with your registered account credentials and password
              </Text>

              {/* Status Banner (Only for success and info, not error banner) */}
              {statusMessage && statusType !== 'error' && (
                <View
                  style={[
                    styles.statusBanner,
                    statusType === 'success' && styles.statusSuccess,
                    statusType === 'info' && styles.statusInfo
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      statusType === 'success' && styles.statusTextSuccess,
                      statusType === 'info' && styles.statusTextInfo
                    ]}
                  >
                    {statusMessage}
                  </Text>
                </View>
              )}

              {/* Role Selection Tabs */}
              <View style={styles.roleTabsContainer}>
                <TouchableOpacity
                  style={[styles.roleTab, activeRole === 'PLAYER' && styles.roleTabActive]}
                  onPress={() => resetFormState('PLAYER')}
                >
                  <Text style={[styles.roleTabText, activeRole === 'PLAYER' && styles.roleTabTextActive]}>
                    🏏 Player
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.roleTab, activeRole === 'TEAM' && styles.roleTabActive]}
                  onPress={() => resetFormState('TEAM')}
                >
                  <Text style={[styles.roleTabText, activeRole === 'TEAM' && styles.roleTabTextActive]}>
                    🛡️ Team & Coach
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.roleTab, activeRole === 'SCORER' && styles.roleTabActive]}
                  onPress={() => resetFormState('SCORER')}
                >
                  <Text style={[styles.roleTabText, activeRole === 'SCORER' && styles.roleTabTextActive]}>
                    📋 Scorer
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.roleTab, activeRole === 'UMPIRE' && styles.roleTabActive]}
                  onPress={() => resetFormState('UMPIRE')}
                >
                  <Text style={[styles.roleTabText, activeRole === 'UMPIRE' && styles.roleTabTextActive]}>
                    ⚖️ Umpire
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Section Header Box with Gold Border */}
              <View style={styles.sectionHeaderBox}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.sectionHeaderText}>
                    {activeRole === 'PLAYER' && '🏏 PLAYER PORTAL ACCESS'}
                    {activeRole === 'TEAM' && '🛡️ TEAM & COACH MANAGEMENT ACCESS'}
                    {activeRole === 'SCORER' && '📋 OFFICIAL SCORER LOGIN'}
                    {activeRole === 'UMPIRE' && '⚖️ OFFICIAL UMPIRE LOGIN'}
                  </Text>
                  <TouchableOpacity onPress={handleDemoFill}>
                    <Text style={styles.demoFillLink}>⚡ Demo Fill</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Identifier Field */}
              <Text style={styles.label}>
                {activeRole === 'PLAYER' && 'Registered Player Email or Full Name *'}
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
                    ? 'e.g. coach@strikerscc.org'
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

              {/* Password Field Header with Inline Forgot Password Link */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={[styles.label, { marginBottom: 0 }]}>Account Password *</Text>
                <TouchableOpacity onPress={() => setShowForgotPassword(true)} activeOpacity={0.7}>
                  <Text style={{ color: '#d97706', fontSize: 13, fontWeight: '700' }}>Forgot Password?</Text>
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

              {/* Register Prompt & Alternate Link Row */}
              <View style={styles.registerPromptRow}>
                <Text style={styles.promptNormalText}>Don't have an account? </Text>
                <TouchableOpacity
                  onPress={() => navigate('Registration', { initialRole: activeRole })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.registerLinkText}>Register Here</Text>
                </TouchableOpacity>
                <Text style={styles.promptDividerText}> • </Text>
                <TouchableOpacity
                  onPress={() => setShowForgotPassword(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.forgotPasswordPromptText}>Forgot Password?</Text>
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
      </View>
    </SharedBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', width: '100%', position: 'relative' },
  cornerExitBtn: {
    position: 'absolute',
    top: 14,
    left: 18,
    zIndex: 99,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
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
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  scroll: { flexGrow: 1, width: '100%' },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%'
  },
  logoContainer: { alignItems: 'center', marginBottom: 10, marginTop: 4 },
  logo: { width: 56, height: 56, marginBottom: 4 },
  mainTitle: { color: '#1e293b', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  mainSubtitle: { color: '#b45309', fontSize: 17, fontWeight: '900', letterSpacing: 1 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: '100%',
    maxWidth: 540,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4
  },
  title: { color: '#1e293b', fontSize: 20, fontWeight: 'bold', marginBottom: 2, textAlign: 'center' },
  subtitle: { color: '#64748b', fontSize: 12, marginBottom: 12, textAlign: 'center', lineHeight: 16 },

  statusBanner: { padding: 8, borderRadius: 6, marginBottom: 10, borderWidth: 1 },
  statusError: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  statusSuccess: { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  statusInfo: { backgroundColor: '#eff6ff', borderColor: '#93c5fd' },
  statusText: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  statusTextError: { color: '#b91c1c' },
  statusTextSuccess: { color: '#15803d' },
  statusTextInfo: { color: '#1d4ed8' },

  sectionHeaderBox: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 10,
    marginTop: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#eab308'
  },
  sectionHeaderText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  demoFillLink: {
    color: '#0284c7',
    fontSize: 11.5,
    fontWeight: 'bold',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4
  },

  roleTabsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
    justifyContent: 'center'
  },
  roleTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  roleTabActive: {
    backgroundColor: '#1e293b',
    borderColor: '#1e293b'
  },
  roleTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569'
  },
  roleTabTextActive: {
    color: '#ffffff',
    fontWeight: '800'
  },

  label: { color: '#334155', fontSize: 12, marginBottom: 4, fontWeight: '700' },
  input: {
    backgroundColor: '#f8fafc',
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 10,
    fontSize: 13.5
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2'
  },
  fieldErrorText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '600',
    marginTop: -2,
    marginBottom: 12,
    marginLeft: 2
  },
  passwordContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    marginBottom: 10,
    alignItems: 'center',
    paddingRight: 10
  },
  passwordInput: {
    flex: 1,
    color: '#1e293b',
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 13.5
  },
  toggleText: {
    fontSize: 15
  },

  actionBtn: {
    backgroundColor: '#eab308',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#eab308',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3
  },
  actionText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 13.5,
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
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  promptNormalText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '400'
  },
  registerLinkText: {
    color: '#b45309',
    fontSize: 13,
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
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.2
  },
  promptDividerText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: 'bold',
    marginHorizontal: 4
  },
  forgotPasswordPromptText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline'
  }
});
