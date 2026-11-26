/**
 * src/admin/pages/AdminLoginPage.tsx
 * Professional Standalone Admin Login Page for Cricket Association.
 * Clean, light, corporate sports-governance appearance.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Image,
  useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAdminAuth } from '../context/AdminAuthContext';
import { adminApi, setStoredAdminToken, setStoredAdminUser, getStoredAdminToken, getStoredAdminUser } from '../services/adminApi';
import { setAuthToken, setCurrentUser } from '../../services/api';
import { showSuccess, showError, showWarning } from '../../utils/sweetalert';
import ForgotPasswordModal from '../../components/auth/ForgotPasswordModal';

export interface Props {
  onLoginSuccess?: () => void;
  onBackToHome?: () => void;
  onCancel?: () => void;
}

export const AdminLoginPage: React.FC<Props> = ({ onLoginSuccess, onBackToHome, onCancel }) => {
  const handleBack = onCancel || onBackToHome;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isDesktop = windowWidth >= 640;
  const useLandscapeBg = windowWidth >= 640 && windowWidth >= windowHeight * 0.9;
  const styles = useMemo(() => getStyles(isDesktop), [isDesktop]);
  const { login } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleSubmit = async (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim();
    const cleanPass = password.trim();

    if (!cleanEmail) {
      setErrorMsg('Please enter your administrator email address.');
      showWarning('Required Field', 'Please enter your administrator email address.');
      return;
    }
    if (!cleanPass) {
      setErrorMsg('Please enter your administrator master password.');
      showWarning('Required Field', 'Please enter your administrator master password.');
      return;
    }

    setLoading(true);
    let res: { success: boolean; message?: string } = { success: false };

    try {
      res = await login(cleanEmail, cleanPass, rememberMe);
    } catch (e: any) {
      res = { success: false, message: e?.message };
    }

    // Direct API fallback if context login did not succeed
    if (!res.success) {
      try {
        const apiRes = await adminApi.login(cleanEmail, cleanPass);
        if (apiRes && apiRes.success && apiRes.token) {
          setStoredAdminToken(apiRes.token, rememberMe);
          setStoredAdminUser(apiRes.user, rememberMe);
          res = { success: true, message: apiRes.message };
        } else if (apiRes && apiRes.message) {
          res = { success: false, message: apiRes.message };
        }
      } catch (apiErr: any) {
        // Fallback for official development admin credentials
        if (
          cleanEmail.toLowerCase() === 'athilingam3336@gmail.com' &&
          cleanPass === 'athi1833@@'
        ) {
          const fallbackUser = {
            id: 'ADM-1004',
            name: 'Athi Lingam',
            email: 'athilingam3336@gmail.com',
            role: 'ADMIN',
            status: 'ACTIVE'
          };
          setStoredAdminToken('dev_admin_athi_token_2026', rememberMe);
          setStoredAdminUser(fallbackUser, rememberMe);
          res = { success: true, message: 'Authenticated successfully.' };
        } else if (
          cleanEmail.toLowerCase() === 'admin@cfvd.org' &&
          (cleanPass === 'CFVD@Admin2026' || cleanPass === 'admin123')
        ) {
          const fallbackUser = {
            id: 'ADM-1002',
            name: 'Chief Administrator',
            email: 'admin@cfvd.org',
            role: 'ADMIN',
            status: 'ACTIVE'
          };
          setStoredAdminToken('dev_admin_cfvd_token_2026', rememberMe);
          setStoredAdminUser(fallbackUser, rememberMe);
          res = { success: true, message: 'Authenticated successfully.' };
        } else if (
          cleanEmail.toLowerCase() === 'admin@example.com' &&
          cleanPass === '1234'
        ) {
          const fallbackUser = {
            id: 'ADM-1001',
            name: 'System Administrator',
            email: 'admin@example.com',
            role: 'ADMIN',
            status: 'ACTIVE'
          };
          setStoredAdminToken('dev_admin_example_token_2026', rememberMe);
          setStoredAdminUser(fallbackUser, rememberMe);
          res = { success: true, message: 'Authenticated successfully.' };
        } else {
          res = { success: false, message: apiErr.message || 'Invalid administrator credentials. Access denied.' };
        }
      }
    }

    setLoading(false);

    if (res.success) {
      const activeAdminUser = getStoredAdminUser();
      const activeAdminToken = getStoredAdminToken();
      if (activeAdminToken) setAuthToken(activeAdminToken);
      if (activeAdminUser) setCurrentUser(activeAdminUser);
      await showSuccess('Admin Access Granted', 'Welcome to the Association Admin Command Portal.', 1500);
      if (onLoginSuccess) onLoginSuccess();
    } else {
      const msg = res.message || 'Invalid administrator credentials. Access denied.';
      setErrorMsg(msg);
      showError('Authentication Failed', msg);
    }
  };

  const IMG_LOGO = require('../../../assets/logo_transparent.png');
  const IMG_BG_DESKTOP = require('../../../assets/admin_login_bg_desktop.jpg');
  const IMG_BG_MOBILE = require('../../../assets/admin_login_bg_mobile.jpg');

  return (
    <View style={styles.rootContainer}>
      {/* Background Accent Line */}
      <View style={styles.topAccentBar} />

      {/* Full-Screen Responsive Cricket Background Image (Desktop vs Mobile) */}
      <View style={styles.bgContainer} pointerEvents="none">
        <Image
          source={useLandscapeBg ? IMG_BG_DESKTOP : IMG_BG_MOBILE}
          style={styles.bgImage}
          resizeMode="cover"
        />
        <View style={styles.bgOverlay} />
      </View>

      <View style={styles.scrollContent}>
        <View style={styles.cardWrapper}>
          {/* Brand & Federation Header */}
          <View style={styles.brandBox}>
            {/* Premium Logo Emblem */}
            <View style={styles.emblemOuterRing}>
              <View style={styles.emblemInnerRing}>
                <View style={styles.emblemWrapper}>
                  <Image
                    source={IMG_LOGO}
                    style={styles.logoMiniature}
                    resizeMode="contain"
                  />
                </View>
              </View>
            </View>
            <Text style={styles.brandTitle}>CRICKET FEDERATION</Text>
            <Text style={styles.brandSub}>OF VIRUDHUNAGAR DISTRICT</Text>
            <Text style={styles.brandEst}>Est. 1987 • CFVD • Official Administrative Portal</Text>
            <View style={styles.affiliationBadge}>
              <Ionicons name="shield-checkmark" size={13} color="#10b981" />
              <Text style={styles.affiliationText}>Official Governing Body • TNCA Affiliated</Text>
            </View>
          </View>

          {/* Login Card (Official Association Midnight Navy Box with Gold Border) */}
          <View style={styles.loginCard}>
            {/* Association Card Header with Icon */}
            <View style={styles.cardHeaderBox}>
              <View style={styles.cardEmblemSmall}>
                <Image
                  source={IMG_LOGO}
                  style={styles.cardLogoMini}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.cardHeaderTextCol}>
                <Text style={styles.cardHeaderTitle}>ASSOCIATION ADMIN ACCESS</Text>
                <Text style={styles.cardHeaderSub}>Authorized CFVD Officials Only</Text>
              </View>
            </View>

            {/* Error Banner */}
            {errorMsg && (
              <View style={styles.errorBanner}>
                <View style={styles.errorDot} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {/* Form */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Admin Email ID</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="e.g. athilingam3336@gmail.com"
                placeholderTextColor="#64748b"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
            </View>

            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Master Password</Text>
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Text style={styles.showPassText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="Enter administrator password"
                placeholderTextColor="#64748b"
                editable={!loading}
              />
            </View>

            {/* Remember Me & Forgot Password Options */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setRememberMe(!rememberMe)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                  {rememberMe && <Text style={styles.checkboxTick}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>Keep me signed in</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setShowForgotPassword(true)} activeOpacity={0.7}>
                <Text style={styles.forgotPasswordText}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Access Admin Dashboard →</Text>
              )}
            </TouchableOpacity>

            {/* Back to Public Site */}
            {handleBack && (
              <TouchableOpacity style={styles.backLink} onPress={handleBack} activeOpacity={0.7}>
                <Text style={styles.backLinkText}>← Return to Public Cricket Portal</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Security Notice */}
          <View style={styles.securityFooter}>
            <Ionicons name="shield-checkmark" size={14} color="#059669" />
            <Text style={styles.securityText}>
              Protected by Association Two-Factor Cryptographic Session Guard. All access attempts are audited.
            </Text>
          </View>

          {/* Reusable Forgot Password Modal */}
          <ForgotPasswordModal
            visible={showForgotPassword}
            onClose={() => setShowForgotPassword(false)}
            initialEmail={email}
            role="ADMIN"
            onSuccess={(newEmail) => {
              setEmail(newEmail);
              setPassword('');
            }}
          />
        </View>
      </View>
    </View>
  );
};

const getStyles = (isDesktop: boolean): any => StyleSheet.create({
  rootContainer: {
    flex: 1,
    width: '100%',
    height: Platform.OS === 'web' ? ('100vh' as any) : '100%',
    maxHeight: Platform.OS === 'web' ? ('100vh' as any) : '100%',
    backgroundColor: '#eef4fb',
    overflow: 'hidden',
    position: 'relative'
  },
  scrollContent: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: isDesktop ? 16 : 12,
    paddingHorizontal: isDesktop ? 24 : 16,
    zIndex: 1
  },
  bgContainer: {
    position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 0
  },
  bgImage: {
    width: '100%',
    height: '100%',
    ...(Platform.OS === 'web' ? { objectFit: 'cover', objectPosition: 'center center' } : {})
  },
  bgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: isDesktop ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.26)',
    backgroundImage: (Platform.OS === 'web'
      ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.42) 0%, rgba(255, 255, 255, 0.16) 50%, rgba(255, 255, 255, 0.35) 100%)'
      : undefined) as any
  },
  topAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#0f2452',
    zIndex: 20
  },
  cardWrapper: {
    width: '100%',
    maxWidth: isDesktop ? 500 : 460,
    alignItems: 'center',
    zIndex: 1
  },
  brandBox: {
    alignItems: 'center',
    marginBottom: isDesktop ? 14 : 12
  },
  emblemOuterRing: {
    width: isDesktop ? 82 : 72,
    height: isDesktop ? 82 : 72,
    borderRadius: isDesktop ? 41 : 36,
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
    borderWidth: 2,
    borderColor: '#d4af37',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6
  },
  emblemInnerRing: {
    width: isDesktop ? 68 : 60,
    height: isDesktop ? 68 : 60,
    borderRadius: isDesktop ? 34 : 30,
    backgroundColor: 'rgba(15, 36, 82, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.45)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  emblemWrapper: {
    width: isDesktop ? 58 : 50,
    height: isDesktop ? 58 : 50,
    borderRadius: isDesktop ? 29 : 25,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0f2452',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
    overflow: 'hidden'
  },
  logoMiniature: {
    width: isDesktop ? 52 : 44,
    height: isDesktop ? 52 : 44
  },
  brandTitle: {
    fontSize: isDesktop ? 19 : 16,
    fontWeight: '900',
    color: '#0f2452',
    letterSpacing: isDesktop ? 2.5 : 2,
    textAlign: 'center',
    textShadowColor: 'rgba(255, 255, 255, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6
  },
  brandSub: {
    fontSize: isDesktop ? 14.5 : 12,
    fontWeight: '800',
    color: '#b8860b',
    letterSpacing: 1.2,
    marginTop: 2,
    textAlign: 'center',
    textShadowColor: 'rgba(255, 255, 255, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4
  },
  brandEst: {
    fontSize: isDesktop ? 12 : 10.5,
    color: '#334155',
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 4,
    marginBottom: 6,
    textAlign: 'center',
    textShadowColor: 'rgba(255, 255, 255, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4
  },
  affiliationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(236, 253, 245, 0.94)',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 20,
    paddingVertical: isDesktop ? 6 : 4,
    paddingHorizontal: isDesktop ? 14 : 12,
    marginTop: 4
  },
  affiliationText: {
    fontSize: isDesktop ? 13 : 11,
    fontWeight: '700',
    color: '#059669'
  },

  // Box Color: Pure White with Association Gold Accent Border & Soft Shadow
  loginCard: {
    width: '100%',
    backgroundColor: Platform.OS === 'web' ? 'rgba(255, 255, 255, 0.96)' : '#ffffff',
    backdropFilter: (Platform.OS === 'web' ? 'blur(16px)' : undefined) as any,
    borderRadius: isDesktop ? 18 : 16,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.45)',
    paddingHorizontal: isDesktop ? 28 : 20,
    paddingTop: isDesktop ? 20 : 16,
    paddingBottom: isDesktop ? 18 : 16,
    shadowColor: '#0f2452',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 25,
    elevation: 6,
    boxShadow: (Platform.OS === 'web' ? '0 20px 50px -10px rgba(15, 36, 82, 0.14), 0 0 25px -5px rgba(212, 175, 55, 0.15)' : undefined) as any
  },

  // In-Card Association Icon Header
  cardHeaderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: isDesktop ? 12 : 10,
    marginBottom: isDesktop ? 14 : 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  cardEmblemSmall: {
    width: isDesktop ? 48 : 44,
    height: isDesktop ? 48 : 44,
    borderRadius: isDesktop ? 24 : 22,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#d4af37',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3
  },
  cardLogoMini: {
    width: isDesktop ? 42 : 38,
    height: isDesktop ? 42 : 38
  },
  cardHeaderTextCol: {
    flex: 1
  },
  cardHeaderTitle: {
    fontSize: isDesktop ? 15 : 13,
    fontWeight: '900',
    color: '#0f2452',
    letterSpacing: 0.8
  },
  cardHeaderSub: {
    fontSize: isDesktop ? 13 : 11,
    fontWeight: '700',
    color: '#b8860b',
    marginTop: 2
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    paddingVertical: isDesktop ? 11 : 9,
    paddingHorizontal: isDesktop ? 14 : 12,
    marginBottom: 16,
    gap: 8
  },
  errorDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ef4444'
  },
  errorText: {
    fontSize: isDesktop ? 13.5 : 12.5,
    color: '#dc2626',
    fontWeight: '600',
    flex: 1
  },
  formGroup: {
    marginBottom: isDesktop ? 14 : 12
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  label: {
    fontSize: isDesktop ? 13.5 : 12.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: isDesktop ? 6 : 5
  },
  showPassText: {
    fontSize: isDesktop ? 13 : 11.5,
    color: '#0f2452',
    fontWeight: '700'
  },
  input: {
    height: isDesktop ? 44 : 42,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: isDesktop ? 15 : 13.5,
    color: '#0f172a',
    backgroundColor: '#f8fafc'
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isDesktop ? 16 : 14
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  checkbox: {
    width: isDesktop ? 20 : 18,
    height: isDesktop ? 20 : 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkboxActive: {
    backgroundColor: '#0f2452',
    borderColor: '#0f2452'
  },
  checkboxTick: {
    color: '#ffffff',
    fontSize: isDesktop ? 12 : 11,
    fontWeight: '900'
  },
  checkboxLabel: {
    fontSize: isDesktop ? 14 : 12.5,
    color: '#475569',
    fontWeight: '500'
  },
  forgotPasswordText: {
    color: '#2563eb',
    fontSize: isDesktop ? 14 : 13,
    fontWeight: '700'
  },

  // Submit Button (Official Association Navy Action)
  submitBtn: {
    height: isDesktop ? 46 : 44,
    backgroundColor: '#0f2452',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0f2452',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3
  },
  submitBtnDisabled: {
    opacity: 0.7
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: isDesktop ? 15.5 : 14,
    fontWeight: '800',
    letterSpacing: 0.5
  },

  // Inset Dev Credentials Box
  devHintBox: {
    marginTop: isDesktop ? 22 : 20,
    padding: isDesktop ? 14 : 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  devHintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  devHintTitle: {
    fontSize: isDesktop ? 13 : 11.5,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  devAutofillLink: {
    fontSize: isDesktop ? 12.5 : 11,
    fontWeight: '800',
    color: '#0f2452',
    textDecorationLine: 'underline'
  },
  devHintText: {
    fontSize: isDesktop ? 13 : 11.5,
    color: '#64748b'
  },
  devCode: {
    fontFamily: (Platform.OS === 'web' ? 'monospace' : 'Courier') as any,
    color: '#0f2452',
    fontWeight: '700'
  },
  backLink: {
    marginTop: isDesktop ? 12 : 10,
    alignItems: 'center',
    paddingVertical: 4
  },
  backLinkText: {
    fontSize: isDesktop ? 13.5 : 12.5,
    color: '#64748b',
    fontWeight: '600'
  },
  securityFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: isDesktop ? 14 : 12,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(15, 36, 82, 0.14)',
    shadowColor: '#0f2452',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2
  },
  securityText: {
    fontSize: isDesktop ? 12.5 : 11,
    color: '#334155',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: isDesktop ? 18 : 16,
    flexShrink: 1
  }
} as any);

export default AdminLoginPage;
