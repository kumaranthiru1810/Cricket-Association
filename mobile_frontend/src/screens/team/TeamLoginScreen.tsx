import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useScorerNavigation } from '../../navigation/ScorerNavigator';
import { API_URL } from '../../services/api';

const API_BASE = `${API_URL}/team`;

export default function TeamLoginScreen() {
  const { navigate } = useScorerNavigation();

  const [mode, setMode] = useState<'login' | 'register' | 'verify'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register fields
  const [teamName, setTeamName] = useState('');
  const [captainName, setCaptainName] = useState('');
  const [phone, setPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [districtId, setDistrictId] = useState('1');

  // Verify
  const [verifyToken, setVerifyToken] = useState('');

  const handleLogin = async () => {
    setError('');
    if (!email || !password) { setError('Email and password are required.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Login failed.');
      navigate('TeamDashboard' as any, { token: data.token, team: data.team });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError('');
    if (!teamName || !captainName || !phone || !regEmail || !regPassword) {
      setError('All fields are required.'); return;
    }
    if (regPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (regPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName, districtId: parseInt(districtId), captainName, phone,
          email: regEmail, password: regPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Registration failed.');
      setSuccessMsg('Registration successful! Check your email for the verification token.');
      if (data.verificationToken) {
        setVerifyToken(data.verificationToken); // pre-fill for demo
      }
      setMode('verify');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError('');
    if (!verifyToken) { setError('Verification token is required.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verifyToken }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Verification failed.');
      setSuccessMsg('✅ Email verified! Your account is now pending admin approval. You will be able to login once approved.');
      setTimeout(() => { setMode('login'); setSuccessMsg(''); }, 4000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const districts = [
    { id: '1', name: 'Virudhunagar' },
    { id: '2', name: 'Madurai' },
    { id: '3', name: 'Dindigul' },
    { id: '4', name: 'Sivakasi' },
    { id: '5', name: 'Rajapalayam' },
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeIcon}>🏏</Text>
          </View>
          <Text style={styles.title}>CFVD Cricket</Text>
          <Text style={styles.subtitle}>Team Portal</Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, mode === 'login' && styles.tabActive]}
            onPress={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
          >
            <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'register' && styles.tabActive]}
            onPress={() => { setMode('register'); setError(''); setSuccessMsg(''); }}
          >
            <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>Register</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'verify' && styles.tabActive]}
            onPress={() => { setMode('verify'); setError(''); setSuccessMsg(''); }}
          >
            <Text style={[styles.tabText, mode === 'verify' && styles.tabTextActive]}>Verify</Text>
          </TouchableOpacity>
        </View>

        {/* Messages */}
        {!!error && <View style={styles.errorBox}><Text style={styles.errorText}>⚠️ {error}</Text></View>}
        {!!successMsg && <View style={styles.successBox}><Text style={styles.successText}>{successMsg}</Text></View>}

        {/* LOGIN FORM */}
        {mode === 'login' && (
          <View style={styles.form}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="team@example.com"
              placeholderTextColor="#8a9bb0"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#8a9bb0"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>Login to Team Portal</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* REGISTER FORM */}
        {mode === 'register' && (
          <View style={styles.form}>
            <Text style={styles.label}>Team Name</Text>
            <TextInput style={styles.input} placeholder="e.g. Eagles XI" placeholderTextColor="#8a9bb0" value={teamName} onChangeText={setTeamName} />

            <Text style={styles.label}>Captain Name</Text>
            <TextInput style={styles.input} placeholder="Captain full name" placeholderTextColor="#8a9bb0" value={captainName} onChangeText={setCaptainName} />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput style={styles.input} placeholder="9876543210" placeholderTextColor="#8a9bb0" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />

            <Text style={styles.label}>District</Text>
            <View style={styles.districtRow}>
              {districts.map(d => (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.districtChip, districtId === d.id && styles.districtChipActive]}
                  onPress={() => setDistrictId(d.id)}
                >
                  <Text style={[styles.districtChipText, districtId === d.id && styles.districtChipTextActive]}>
                    {d.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Email Address</Text>
            <TextInput style={styles.input} placeholder="team@example.com" placeholderTextColor="#8a9bb0" keyboardType="email-address" autoCapitalize="none" value={regEmail} onChangeText={setRegEmail} />

            <Text style={styles.label}>Password</Text>
            <TextInput style={styles.input} placeholder="Min. 8 characters" placeholderTextColor="#8a9bb0" secureTextEntry value={regPassword} onChangeText={setRegPassword} />

            <Text style={styles.label}>Confirm Password</Text>
            <TextInput style={styles.input} placeholder="Repeat password" placeholderTextColor="#8a9bb0" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />

            <TouchableOpacity style={styles.primaryBtn} onPress={handleRegister} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>Register Team</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* VERIFY FORM */}
        {mode === 'verify' && (
          <View style={styles.form}>
            <Text style={styles.verifyInfo}>
              Enter the verification token sent to your registered email address.
            </Text>
            <Text style={styles.label}>Verification Token</Text>
            <TextInput
              style={[styles.input, styles.tokenInput]}
              placeholder="Paste your token here"
              placeholderTextColor="#8a9bb0"
              autoCapitalize="none"
              value={verifyToken}
              onChangeText={setVerifyToken}
              multiline
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleVerify} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>Verify Email</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.footer}>Cricket Federation Virudhunagar District · Secure Team Portal</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#070e1c',
    padding: 24,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 28,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1a2a4a',
    borderWidth: 2,
    borderColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#D4AF37',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  badgeIcon: { fontSize: 34 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#D4AF37',
    letterSpacing: 3,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#0f1c30',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#1e3050',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#D4AF37',
  },
  tabText: { color: '#8a9bb0', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#07100e', fontWeight: '800' },
  errorBox: {
    width: '100%',
    backgroundColor: '#2d0a0a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c0392b',
    padding: 12,
    marginBottom: 14,
  },
  errorText: { color: '#e74c3c', fontSize: 13, lineHeight: 20 },
  successBox: {
    width: '100%',
    backgroundColor: '#0a2d12',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#27ae60',
    padding: 12,
    marginBottom: 14,
  },
  successText: { color: '#2ecc71', fontSize: 13, lineHeight: 20 },
  form: { width: '100%' },
  label: {
    color: '#8a9bb0',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: '#0f1c30',
    borderWidth: 1,
    borderColor: '#1e3050',
    borderRadius: 10,
    color: '#FFFFFF',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tokenInput: { minHeight: 80, textAlignVertical: 'top' },
  primaryBtn: {
    backgroundColor: '#D4AF37',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#D4AF37',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryBtnText: { color: '#07100e', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  districtRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  districtChip: {
    borderWidth: 1,
    borderColor: '#1e3050',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#0f1c30',
  },
  districtChipActive: {
    backgroundColor: '#D4AF37',
    borderColor: '#D4AF37',
  },
  districtChipText: { color: '#8a9bb0', fontSize: 13, fontWeight: '600' },
  districtChipTextActive: { color: '#07100e', fontWeight: '800' },
  verifyInfo: {
    color: '#8a9bb0',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 10,
    marginTop: 8,
  },
  footer: {
    color: '#2a3d55',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 36,
    marginBottom: 16,
    letterSpacing: 0.5,
  },
});
