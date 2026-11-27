/**
 * src/admin/pages/SuperAdminLoginPage.tsx
 * Dedicated Standalone Super Administrator Login Page.
 * Restricted to Super Admin accounts via /api/auth/super-admin/login.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Image,
  ScrollView,
  useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminApi, setStoredAdminToken, setStoredAdminUser } from '../services/adminApi';
import { setAuthToken, setCurrentUser } from '../../services/api';
import { showSuccess, showError, showWarning } from '../../utils/sweetalert';
import ForgotPasswordModal from '../../components/auth/ForgotPasswordModal';

export interface SuperAdminLoginProps {
  onLoginSuccess?: () => void;
  onBackToHome?: () => void;
  onGoToAdminLogin?: () => void;
}

export const SuperAdminLoginPage: React.FC<SuperAdminLoginProps> = ({
  onLoginSuccess,
  onBackToHome,
  onGoToAdminLogin
}) => {
  const { width: windowWidth } = useWindowDimensions();
  const isMobile = windowWidth < 640;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const IMG_LOGO = require('../../../assets/logo_transparent.png');

  const handleSubmit = async (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim();
    const cleanPass = password.trim();

    if (!cleanEmail) {
      const msg = 'Please enter your Super Administrator email address.';
      setErrorMsg(msg);
      showWarning('Required Field', msg);
      return;
    }
    if (!cleanPass) {
      const msg = 'Please enter your Super Administrator master password.';
      setErrorMsg(msg);
      showWarning('Required Field', msg);
      return;
    }

    setLoading(true);
    try {
      const apiRes = await adminApi.superAdminLogin(cleanEmail, cleanPass);
      if (apiRes && apiRes.success && apiRes.token) {
        setStoredAdminToken(apiRes.token, rememberMe);
        setStoredAdminUser(apiRes.user, rememberMe);
        setAuthToken(apiRes.token);
        if (apiRes.user) setCurrentUser(apiRes.user);
        setLoading(false);
        await showSuccess('Super Admin Access Granted', 'Welcome to the Executive Super Admin Command Console.', 1500);
        if (onLoginSuccess) onLoginSuccess();
        return;
      }
      const failMsg = apiRes?.message || 'Invalid Super Admin credentials.';
      setErrorMsg(failMsg);
      showError('Super Admin Authentication Failed', failMsg);
    } catch (err: any) {
      const rawMsg = err?.message || '';
      const msg = rawMsg.includes('404')
        ? 'Super Admin login endpoint unavailable. Please restart the backend server.'
        : (rawMsg || 'Invalid Super Admin credentials or unauthorized account.');
      setErrorMsg(msg);
      showError('Super Admin Authentication Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.scrollContent, isMobile && { padding: 16 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.card, isMobile && { padding: 20 }]}>
        {/* Top Badge */}

        {/* Crest & Title */}
        <View style={styles.brandHeader}>
          <Image source={IMG_LOGO} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Super Admin</Text>
        </View>

        {errorMsg ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {/* Email Field */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Super Admin Email *</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color="#64748B" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />
          </View>
        </View>

        {/* Password Field */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Master Password *</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color="#64748B" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <TouchableOpacity onPress={() => setShowPassword(p => !p)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Options Row */}
        

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#020612" />
          ) : (
            <>
              <Ionicons name="key-outline" size={18} color="#020612" />
              <Text style={styles.submitBtnText}>Authenticate Super Admin</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {showForgotPassword && (
        <ForgotPasswordModal
          visible={showForgotPassword}
          onClose={() => setShowForgotPassword(false)}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F1F5F9'
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 28,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 16px 40px rgba(15, 23, 42, 0.08)' }
      : { elevation: 6 })
  } as any,
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18
  },
  superBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20
  },
  superBadgeText: {
    color: '#B45309',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8
  },
  backPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  backPillText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600'
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 22
  },
  logo: {
    width: 64,
    height: 64,
    marginBottom: 10
  },
  title: {
    color: '#0F172A',
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6
  },
  subtitle: {
    color: '#64748B',
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1
  },
  fieldGroup: {
    marginBottom: 16
  },
  label: {
    color: '#1E293B',
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 6
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12
  },
  inputIcon: {
    marginRight: 8
  },
  input: {
    flex: 1,
    color: '#0F172A',
    fontSize: 14,
    paddingVertical: 11
  },
  eyeBtn: {
    padding: 6
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxChecked: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B'
  },
  rememberText: {
    color: '#475569',
    fontSize: 12.5
  },
  forgotText: {
    color: '#B45309',
    fontSize: 12.5,
    fontWeight: '700'
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    paddingVertical: 13
  },
  submitBtnDisabled: {
    opacity: 0.7
  },
  submitBtnText: {
    color: '#020612',
    fontSize: 14.5,
    fontWeight: '800'
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0'
  },
  footerHint: {
    color: '#64748B',
    fontSize: 12.5
  },
  footerLink: {
    color: '#0284C7',
    fontSize: 12.5,
    fontWeight: '700'
  }
});

export default SuperAdminLoginPage;
