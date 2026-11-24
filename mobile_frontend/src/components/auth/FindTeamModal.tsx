import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  KeyboardAvoidingView
} from 'react-native';
import { ScorerApi } from '../../services/api';
import { showSuccess, showError, showWarning } from '../../utils/sweetalert';
import { validateEmail } from '../../utils/validation';

export interface FindTeamModalProps {
  visible: boolean;
  onClose: () => void;
  initialEmail?: string;
}

export default function FindTeamModal({
  visible,
  onClose,
  initialEmail = ''
}: FindTeamModalProps) {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 640;

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sentSuccess, setSentSuccess] = useState(false);

  useEffect(() => {
    if (visible) {
      setEmail(initialEmail || '');
      setErrorMessage(null);
      setSentSuccess(false);
    }
  }, [visible, initialEmail]);

  const handleSendTeam = async () => {
    setErrorMessage(null);
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      const err = 'Please enter your registered player email address.';
      setErrorMessage(err);
      showWarning('Email Required', err);
      return;
    }

    const emailCheck = validateEmail(cleanEmail);
    if (!emailCheck.isValid) {
      const err = emailCheck.error || 'Please enter a valid email address.';
      setErrorMessage(err);
      showWarning('Invalid Email', err);
      return;
    }

    setIsLoading(true);
    try {
      const res: any = await ScorerApi.findPlayerTeam(cleanEmail);

      setSentSuccess(true);

      showSuccess(
        'Team Sent to Email!',
        res?.message || `Your team name has been dispatched to ${cleanEmail}.`
      );
    } catch (err: any) {
      const rawMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Unable to find team for this email. Please verify and try again.';
      setErrorMessage(rawMsg);
      showError('Team Not Found', rawMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDone = () => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View
          style={[
            styles.modalCard,
            isDesktop ? styles.modalCardDesktop : styles.modalCardMobile
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.iconCircle}>
                <Text style={styles.iconText}>🔍</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.modalTitle}>Find Your Team</Text>
                <Text style={styles.modalSubtitle}>
                  Step 1 • Enter registered player email
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Error Banner */}
          {errorMessage && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerIcon}>⚠️</Text>
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          )}

          {!sentSuccess ? (
            /* STEP 1: Enter email and send */
            <View style={styles.body}>
              <Text style={styles.instructionText}>
                Forgot which team you are registered with? Enter your registered
                player email address below. We will find your team affiliation and
                send your team name directly to your email.
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Registered Player Email *</Text>
                <TextInput
                  style={[styles.input, errorMessage && styles.inputError]}
                  value={email}
                  onChangeText={(val) => {
                    setEmail(val);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="e.g. saravanan.r@strikerscc.org"
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  onSubmitEditing={handleSendTeam}
                  returnKeyType="send"
                />
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  disabled={isLoading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, isLoading && styles.btnDisabled]}
                  onPress={handleSendTeam}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <View style={styles.btnLoadingRow}>
                      <ActivityIndicator size="small" color="#ffffff" />
                      <Text style={[styles.submitBtnText, { marginLeft: 8 }]}>
                        Searching...
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.submitBtnText}>✉️ Send Team</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Success confirmation screen */
            <View style={styles.successBody}>
              <View style={styles.successIconBadge}>
                <Text style={styles.successIconText}>✉️</Text>
              </View>
              <Text style={styles.successTitle}>Team Details Sent to Email!</Text>
              <Text style={styles.successDesc}>
                We have sent your registered team name to{' '}
                <Text style={styles.emailHighlight}>{email.trim()}</Text>.
                {'\n\n'}Please check your email inbox to view your team name, and use it to log in.
              </Text>

              <TouchableOpacity
                style={styles.continueBtn}
                onPress={handleDone}
                activeOpacity={0.8}
              >
                <Text style={styles.continueBtnText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    padding: 16
  },
  backdrop: {
    ...StyleSheet.absoluteFill
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    width: '100%',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12
  },
  modalCardDesktop: {
    maxWidth: 480
  },
  modalCardMobile: {
    maxWidth: '100%'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff'
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde047',
    justifyContent: 'center',
    alignItems: 'center'
  },
  iconText: {
    fontSize: 20
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  modalSubtitle: {
    color: '#d97706',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2
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
    color: '#64748b',
    fontSize: 16,
    fontWeight: 'bold'
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 22,
    marginTop: 16,
    borderRadius: 8
  },
  errorBannerIcon: {
    fontSize: 16,
    marginRight: 8
  },
  errorBannerText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18
  },
  body: {
    padding: 22
  },
  instructionText: {
    color: '#475569',
    fontSize: 13.5,
    lineHeight: 20,
    marginBottom: 20
  },
  fieldGroup: {
    marginBottom: 22
  },
  fieldLabel: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.2
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#0f172a',
    fontSize: 14.5
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fff5f5'
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc'
  },
  cancelBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600'
  },
  submitBtn: {
    backgroundColor: '#d97706',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4
  },
  btnDisabled: {
    opacity: 0.65
  },
  btnLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  successBody: {
    padding: 24,
    alignItems: 'center'
  },
  successIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 2,
    borderColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  successIconText: {
    fontSize: 30
  },
  successTitle: {
    color: '#0f172a',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 8
  },
  successDesc: {
    color: '#475569',
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20
  },
  emailHighlight: {
    color: '#d97706',
    fontWeight: '700'
  },
  teamResultBox: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center'
  },
  teamResultLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10
  },
  teamPill: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginVertical: 4
  },
  teamPillText: {
    color: '#92400e',
    fontSize: 16,
    fontWeight: '800'
  },
  continueBtn: {
    width: '100%',
    backgroundColor: '#d97706',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center'
  },
  continueBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3
  }
});
