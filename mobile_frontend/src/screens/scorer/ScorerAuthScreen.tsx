import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { useScorerNavigation } from '../../navigation/ScorerNavigationContext';
import SharedFooter from '../../components/scorer/SharedFooter';
import { ScorerApi } from '../../services/api';

export default function ScorerAuthScreen() {
  const { navigate, onExit, params } = useScorerNavigation();
  const [isLoginMode, setIsLoginMode] = useState(
    params?.initialMode !== 'register' && params?.mode !== 'register'
  );
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [association, setAssociation] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  
  // Status feedback states
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error' | null>(null);

  const handleSendOTP = async () => {
    setStatusMessage(null);
    setStatusType(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setStatusMessage('Please enter your email address to receive an OTP.');
      setStatusType('error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setStatusMessage('Please enter a valid email address.');
      setStatusType('error');
      return;
    }

    setIsSendingOtp(true);
    setStatusMessage(`Sending OTP to ${cleanEmail}...`);
    setStatusType('info');

    try {
      const res = await ScorerApi.requestOtp(cleanEmail, 'SCORER');
      setOtpSent(true);
      const code = String(res?.otp || res?.devOtp || '');
      if (code) {
        setOtp(code);
        setStatusMessage(`✓ OTP Dispatched: ${code} (Auto-filled in field below)`);
      } else {
        setStatusMessage(`OTP verification code sent to ${cleanEmail}. Please check your email inbox (and spam folder).`);
      }
      setStatusType('success');
    } catch (err: any) {
      const rawMsg = err.message || '';
      let displayError = 'Unable to send OTP. Server error.';

      if (rawMsg.toLowerCase().includes('pending')) {
        displayError = '⏳ Your registration is PENDING admin approval. You can only log in once an administrator approves your account.';
      } else if (rawMsg.toLowerCase().includes('rejected') || rawMsg.toLowerCase().includes('cancelled')) {
        displayError = '❌ Your registration was REJECTED / CANCELLED by the administrator.';
      } else if (rawMsg.toLowerCase().includes('not registered') || rawMsg.toLowerCase().includes('not found')) {
        displayError = 'Email not registered. Please create an account below.';
      } else if (rawMsg.toLowerCase().includes('rate limit') || rawMsg.toLowerCase().includes('too many') || rawMsg.toLowerCase().includes('wait')) {
        displayError = rawMsg;
      } else if (err.message) {
        displayError = err.message;
      }

      setStatusMessage(displayError);
      setStatusType('error');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleLogin = async () => {
    setStatusMessage(null);
    setStatusType(null);

    if (!email.trim()) {
      setStatusMessage('Please enter your email address.');
      setStatusType('error');
      return;
    }

    if (!otp.trim()) {
      setStatusMessage('Please enter the OTP sent to your email.');
      setStatusType('error');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Verifying credentials...');
    setStatusType('info');

    try {
      const res = await ScorerApi.verifyOtp(email.trim(), otp.trim());
      setStatusMessage('Login successful! Redirecting...');
      setStatusType('success');

      // Role-based redirection
      const userRole = (res.user?.role || 'SCORER').toUpperCase();
      setTimeout(() => {
        if (userRole === 'ADMIN') {
          if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
            window.location.reload();
          } else {
            navigate('Dashboard', { role: 'ADMIN', user: res.user });
          }
        } else if (userRole === 'SCORER') {
          navigate('Dashboard', { user: res.user });
        } else if (userRole === 'PLAYER') {
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.location.href = '/player';
          } else {
            navigate('Dashboard', { user: res.user });
          }
        } else {
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.location.href = '/home';
          } else {
            navigate('Dashboard', { user: res.user });
          }
        }
      }, 500);
    } catch (err: any) {
      const rawMsg = err.message || '';
      let displayError = 'Login failed. Network/server error.';

      if (rawMsg.toLowerCase().includes('pending')) {
        displayError = '⏳ Your registration is PENDING admin approval. You can only log in once an administrator approves your account.';
      } else if (rawMsg.toLowerCase().includes('rejected') || rawMsg.toLowerCase().includes('cancelled')) {
        displayError = '❌ Your registration was REJECTED / CANCELLED by the administrator.';
      } else if (rawMsg.toLowerCase().includes('expired')) {
        displayError = 'OTP expired. Please request a new OTP.';
      } else if (rawMsg.toLowerCase().includes('invalid otp') || rawMsg.toLowerCase().includes('incorrect')) {
        displayError = 'Invalid OTP. Please check and try again.';
      } else if (rawMsg.toLowerCase().includes('not registered') || rawMsg.toLowerCase().includes('not found')) {
        displayError = 'Email not registered. Please register an account.';
      } else if (err.message) {
        displayError = err.message;
      }

      setStatusMessage(displayError);
      setStatusType('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    setStatusMessage(null);
    setStatusType(null);

    if (!name.trim() || !email.trim()) {
      setStatusMessage('Please fill all required fields.');
      setStatusType('error');
      return;
    }

    setIsLoading(true);
    try {
      const res = await ScorerApi.register({
        name: name.trim(),
        email: email.trim(),
        mobile: phone.trim(),
        password,
        role: 'SCORER'
      });

      setStatusMessage('✓ Registration submitted! Status: PENDING admin approval. You can log in once an administrator approves your account.');
      setStatusType('info');
    } catch (err: any) {
      setStatusMessage(err.message || 'Registration failed.');
      setStatusType('error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onExit('Home')} style={styles.backBtn}>
          <Text style={styles.backText}>← Exit to Main</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.cardContainer}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../../assets/logo_transparent.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.mainTitle}>CRICKET FEDERATION OF</Text>
            <Text style={styles.mainSubtitle}>VIRUDHUNAGAR DISTRICT</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>
              {isLoginMode ? 'Scorer Portal Login' : 'Register New Scorer'}
            </Text>
            <Text style={styles.subtitle}>
              {isLoginMode
                ? (otpSent ? 'Enter the verification code sent to your email' : 'Enter your registered email to receive an OTP')
                : 'Create an account to become an authorized scorer'}
            </Text>

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

            {!isLoginMode && (
              <>
                <Text style={styles.label}>Full Name *</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your Name"
                  placeholderTextColor="#9bb0cf"
                  autoCapitalize="words"
                />
              </>
            )}

            {isLoginMode ? (
              <>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Email Address *</Text>
                  {otpSent && (
                    <TouchableOpacity
                      onPress={() => {
                        setOtpSent(false);
                        setStatusMessage(null);
                        setStatusType(null);
                      }}
                    >
                      <Text style={styles.editEmailText}>Change Email</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TextInput
                  style={[styles.input, otpSent && styles.inputDisabled]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="e.g. scorer@cfvd.org or athilingam3336@gmail.com"
                  keyboardType="email-address"
                  placeholderTextColor="#9bb0cf"
                  autoCapitalize="none"
                  editable={!otpSent}
                />

                {!otpSent ? (
                  <>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={handleSendOTP}
                      disabled={isSendingOtp}
                    >
                      {isSendingOtp ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={styles.actionText}>Send OTP</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.secondaryLinkBtn}
                      onPress={() => setOtpSent(true)}
                    >
                      <Text style={styles.secondaryLinkText}>
                        Already have an OTP? Enter code directly →
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={styles.label}>Enter OTP *</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={styles.passwordInput}
                        value={otp}
                        onChangeText={setOtp}
                        secureTextEntry={!showPassword}
                        placeholder="Enter OTP code"
                        placeholderTextColor="#9bb0cf"
                        keyboardType="number-pad"
                        autoFocus
                      />
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                        <Text style={styles.toggleText}>{showPassword ? '👁️' : '🙈'}</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.otpHelperRow}>
                      <TouchableOpacity
                        style={styles.resendBtn}
                        onPress={handleSendOTP}
                        disabled={isSendingOtp || isLoading}
                      >
                        <Text style={styles.resendText}>
                          {isSendingOtp ? 'Sending...' : 'Resend OTP?'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          setOtpSent(false);
                          setStatusMessage(null);
                          setStatusType(null);
                        }}
                      >
                        <Text style={styles.changeEmailLink}>Back to Email</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={handleLogin}
                      disabled={isLoading || isSendingOtp}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={styles.actionText}>Verify & Login</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </>
            ) : (
              <>
                <Text style={styles.label}>Email Address *</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="e.g. scorer@cfvd.org"
                  keyboardType="email-address"
                  placeholderTextColor="#9bb0cf"
                  autoCapitalize="none"
                />

                <Text style={styles.label}>Mobile Number *</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Enter mobile number"
                  keyboardType="phone-pad"
                  placeholderTextColor="#9bb0cf"
                />

                <Text style={styles.label}>Cricket Association / District *</Text>
                <TextInput
                  style={styles.input}
                  value={association}
                  onChangeText={setAssociation}
                  placeholder="e.g. Virudhunagar District"
                  placeholderTextColor="#9bb0cf"
                />

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={handleRegister}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.actionText}>Register as Scorer</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              onPress={() => {
                setIsLoginMode(!isLoginMode);
                setOtpSent(false);
                setStatusMessage(null);
                setStatusType(null);
              }}
              style={styles.linkBtn}
            >
              <Text style={styles.linkText}>
                {isLoginMode ? "Don't have an account? Register" : "Already have an account? Login"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        {isLoginMode && <SharedFooter />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', width: '100%' },
  header: { padding: 16, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 },
  backBtn: { alignSelf: 'flex-start', padding: 8, paddingLeft: 0 },
  backText: { color: '#eab308', fontSize: 18, fontWeight: 'bold' },
  logoContainer: { alignItems: 'center', marginBottom: 24, marginTop: 10 },
  logo: { width: 80, height: 80, marginBottom: 10 },
  mainTitle: { color: '#1e293b', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
  mainSubtitle: { color: '#b45309', fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  scroll: { flexGrow: 1, width: '100%' },
  cardContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, paddingBottom: 40, width: '100%' },
  card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 24, borderWidth: 1, borderColor: '#e2e8f0', width: '100%', maxWidth: 450, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  title: { color: '#1e293b', fontSize: 22, fontWeight: 'bold', marginBottom: 4, textAlign: 'center' },
  subtitle: { color: '#64748b', fontSize: 13, marginBottom: 20, textAlign: 'center' },
  statusBanner: { padding: 12, borderRadius: 6, marginBottom: 16, borderWidth: 1 },
  statusError: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  statusSuccess: { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  statusInfo: { backgroundColor: '#eff6ff', borderColor: '#93c5fd' },
  statusText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  statusTextError: { color: '#b91c1c' },
  statusTextSuccess: { color: '#15803d' },
  statusTextInfo: { color: '#1d4ed8' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: '#334155', fontSize: 13, marginBottom: 6, fontWeight: '700' },
  editEmailText: { color: '#b45309', fontSize: 12, fontWeight: '700', textDecorationLine: 'underline', marginBottom: 6 },
  input: { backgroundColor: '#f8fafc', color: '#1e293b', borderWidth: 1, borderColor: '#cbd5e1', padding: 14, borderRadius: 6, marginBottom: 16, fontSize: 15 },
  inputDisabled: { backgroundColor: '#f1f5f9', color: '#64748b' },
  passwordContainer: { flexDirection: 'row', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, marginBottom: 16, alignItems: 'center', paddingRight: 10 },
  passwordInput: { flex: 1, color: '#1e293b', padding: 14, fontSize: 15 },
  toggleText: { color: '#0f172a', fontSize: 16 },
  otpHelperRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  resendBtn: { paddingVertical: 4 },
  resendText: { color: '#b45309', fontSize: 13, fontWeight: '600' },
  changeEmailLink: { color: '#64748b', fontSize: 13, textDecorationLine: 'underline' },
  secondaryLinkBtn: { marginTop: 14, alignItems: 'center', padding: 6 },
  secondaryLinkText: { color: '#64748b', fontSize: 13, fontWeight: '500' },
  actionBtn: { backgroundColor: '#eab308', padding: 16, borderRadius: 6, alignItems: 'center', marginTop: 4, shadowColor: '#eab308', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  actionText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 },
  btnDisabled: { opacity: 0.6 },
  linkBtn: { marginTop: 24, alignItems: 'center' },
  linkText: { color: '#b45309', textDecorationLine: 'underline', fontSize: 14, fontWeight: '500' }
});
