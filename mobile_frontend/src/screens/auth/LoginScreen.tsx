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
  Platform
} from 'react-native';
import { useAppNavigation } from '../../navigation/AppNavigator';
import SharedBackground from '../../components/scorer/SharedBackground';
import { ScorerApi, setAuthToken, setCurrentUser } from '../../services/api';

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
      setPassword('1234');
    } else if (activeRole === 'TEAM') {
      setEmailOrUser('kannan.coach@strikerscc.org');
      setPassword('1234');
    } else if (activeRole === 'SCORER') {
      setEmailOrUser('ramesh@gmail.com');
      setPassword('1234');
    } else if (activeRole === 'UMPIRE') {
      setEmailOrUser('sundaram.umpire@cfvd.org');
      setPassword('1234');
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

    if (!input) {
      newErrors.identifier =
        activeRole === 'TEAM'
          ? 'Please enter your Coach Email or Team Name.'
          : activeRole === 'SCORER'
          ? 'Please enter your Scorer Email.'
          : activeRole === 'UMPIRE'
          ? 'Please enter your Umpire Email.'
          : 'Please enter your Player Email or Name.';
    }

    if (!pass) {
      newErrors.password = 'Please enter your account password.';
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
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

      setTimeout(() => {
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
      }, 500);

    } catch (err: any) {
      setIsLoading(false);
      const rawMsg = err?.message || 'Login failed. Please check your credentials.';
      const lower = rawMsg.toLowerCase();
      if (lower.includes('user') || lower.includes('not found') || lower.includes('account') || lower.includes('email')) {
        setFieldErrors({ identifier: rawMsg });
      } else {
        setFieldErrors({ password: rawMsg });
      }
    }
  };

  return (
    <SharedBackground>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => (onExit ? onExit() : navigate('Home'))} style={styles.backBtn}>
            <Text style={styles.backText}>← Exit to Main</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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

              {/* Password Field with Show/Hide Toggle */}
              <Text style={styles.label}>Account Password *</Text>
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

              {/* Register Prompt */}
              <View style={styles.registerPromptRow}>
                <Text style={styles.promptNormalText}>Don't have an account? </Text>
                <TouchableOpacity
                  onPress={() => navigate('Registration', { initialRole: activeRole })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.registerLinkText}>Register Here</Text>
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </ScrollView>
      </View>
    </SharedBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', width: '100%' },
  header: {
    padding: 16,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4
  },
  backBtn: { alignSelf: 'flex-start', padding: 8, paddingLeft: 0 },
  backText: { color: '#eab308', fontSize: 16, fontWeight: 'bold' },
  scroll: { flexGrow: 1, width: '100%' },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 40,
    width: '100%'
  },
  logoContainer: { alignItems: 'center', marginBottom: 20, marginTop: 10 },
  logo: { width: 75, height: 75, marginBottom: 8 },
  mainTitle: { color: '#1e293b', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  mainSubtitle: { color: '#b45309', fontSize: 21, fontWeight: '900', letterSpacing: 1 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: '100%',
    maxWidth: 580,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5
  },
  title: { color: '#1e293b', fontSize: 22, fontWeight: 'bold', marginBottom: 4, textAlign: 'center' },
  subtitle: { color: '#64748b', fontSize: 13, marginBottom: 20, textAlign: 'center', lineHeight: 18 },

  statusBanner: { padding: 12, borderRadius: 6, marginBottom: 16, borderWidth: 1 },
  statusError: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  statusSuccess: { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  statusInfo: { backgroundColor: '#eff6ff', borderColor: '#93c5fd' },
  statusText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  statusTextError: { color: '#b91c1c' },
  statusTextSuccess: { color: '#15803d' },
  statusTextInfo: { color: '#1d4ed8' },

  sectionHeaderBox: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 16,
    marginTop: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#eab308'
  },
  sectionHeaderText: {
    color: '#0f172a',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  demoFillLink: {
    color: '#0284c7',
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },

  roleTabsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    justifyContent: 'center'
  },
  roleTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  roleTabActive: {
    backgroundColor: '#1e293b',
    borderColor: '#1e293b'
  },
  roleTabText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569'
  },
  roleTabTextActive: {
    color: '#ffffff',
    fontWeight: '800'
  },

  label: { color: '#334155', fontSize: 13, marginBottom: 6, fontWeight: '700' },
  input: {
    backgroundColor: '#f8fafc',
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
    fontSize: 14.5
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
    marginBottom: 16,
    alignItems: 'center',
    paddingRight: 12
  },
  passwordInput: {
    flex: 1,
    color: '#1e293b',
    padding: 12,
    fontSize: 14.5
  },
  toggleText: {
    fontSize: 16
  },

  actionBtn: {
    backgroundColor: '#eab308',
    padding: 16,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#eab308',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3
  },
  actionText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 14.5,
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
    marginTop: 22,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  promptNormalText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '400'
  },
  registerLinkText: {
    color: '#b45309',
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline'
  }
});
