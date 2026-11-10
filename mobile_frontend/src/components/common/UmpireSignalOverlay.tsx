import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  Easing,
  ScrollView
} from 'react-native';

export type UmpireSignalType =
  | 'OUT'
  | 'WIDE'
  | 'NO_BALL'
  | 'DEAD_BALL'
  | 'LEG_BYE'
  | 'BYE'
  | 'FOUR'
  | 'SIX'
  | 'CONSECUTIVE_WIDES';

export interface UmpireSignalEvent {
  type: UmpireSignalType;
  title?: string;
  subtitle?: string;
  batterName?: string;
  bowlerName?: string;
  runs?: number;
  overText?: string;
  dismissalType?: string;
  extraDetails?: string;
  durationMs?: number; // default 3800ms
}

interface UmpireSignalOverlayProps {
  event: UmpireSignalEvent | null;
  onDismiss: () => void;
}

export interface SignalConfig {
  type: UmpireSignalType;
  title: string;
  badge: string;
  lawText: string;
  gestureDescription: string;
  image: any;
  primaryColor: string;
  accentColor: string;
  glowColor: string;
  bgGradient: string;
  soundCueText: string;
  iccIcon: string;
}

export const SIGNAL_CONFIGS: Record<UmpireSignalType, SignalConfig> = {
  OUT: {
    type: 'OUT',
    title: 'BATTER OUT!',
    badge: 'DECISION CONFIRMED',
    lawText: 'MCC Law 31 • Batter Dismissed',
    gestureDescription: 'Index finger raised vertically above head by standing umpire',
    image: require('../../../assets/umpire/umpire_out.png'),
    primaryColor: '#ef4444',
    accentColor: '#dc2626',
    glowColor: 'rgba(239, 68, 68, 0.45)',
    bgGradient: '#450a0a',
    soundCueText: '☝️ FINGER RAISED • APPEAL UPHELD',
    iccIcon: '☝️'
  },
  WIDE: {
    type: 'WIDE',
    title: 'WIDE BALL',
    badge: 'EXTRA + RE-BOWL',
    lawText: 'MCC Law 22 • Wide Ball (+1 Run)',
    gestureDescription: 'Both arms extended horizontally parallel to the cricket pitch',
    image: require('../../../assets/umpire/umpire_wide.png'),
    primaryColor: '#f97316',
    accentColor: '#ea580c',
    glowColor: 'rgba(249, 115, 22, 0.45)',
    bgGradient: '#431407',
    soundCueText: '↔️ ARMS OUTSTRETCHED • BALL OFF TRAMLINE',
    iccIcon: '↔️'
  },
  NO_BALL: {
    type: 'NO_BALL',
    title: 'NO BALL & FREE HIT',
    badge: '+1 PENALTY RUN',
    lawText: 'MCC Law 21 • Illegal Delivery + Mandatory Free Hit',
    gestureDescription: 'One arm extended horizontally toward off-side at shoulder height',
    image: require('../../../assets/umpire/umpire_noball.png'),
    primaryColor: '#a855f7',
    accentColor: '#9333ea',
    glowColor: 'rgba(168, 85, 247, 0.45)',
    bgGradient: '#3b0764',
    soundCueText: '👉 ARM EXTENDED • OVER-STEPPING / HEIGHT',
    iccIcon: '👉'
  },
  DEAD_BALL: {
    type: 'DEAD_BALL',
    title: 'DEAD BALL',
    badge: 'PLAY SUSPENDED',
    lawText: 'MCC Law 20 • Dead Ball (Delivery Cancelled)',
    gestureDescription: 'Hands and wrists crossed repeatedly in front of body at waist',
    image: require('../../../assets/umpire/umpire_deadball_hd.jpg'),
    primaryColor: '#64748b',
    accentColor: '#475569',
    glowColor: 'rgba(100, 116, 139, 0.45)',
    bgGradient: '#0f172a',
    soundCueText: '🛑 WRISTS CROSSED • BALL OUT OF PLAY',
    iccIcon: '🛑'
  },
  LEG_BYE: {
    type: 'LEG_BYE',
    title: 'LEG BYE',
    badge: 'PAD DEFLECTION',
    lawText: 'MCC Law 23 • Bye & Leg Bye (+Runs to Extras)',
    gestureDescription: 'Umpire touches raised knee with hand to signal leg-bye to scorer',
    image: require('../../../assets/umpire/umpire_legbye.jpg'),
    primaryColor: '#06b6d4',
    accentColor: '#0891b2',
    glowColor: 'rgba(6, 182, 212, 0.45)',
    bgGradient: '#083344',
    soundCueText: '🦵 KNEE TAPPED • LEG BYE TO EXTRAS',
    iccIcon: '🦵'
  },
  BYE: {
    type: 'BYE',
    title: 'BYE RUNS',
    badge: 'SCORER SIGNAL',
    lawText: 'MCC Law 23 • Bye (Beats Batter & Keeper)',
    gestureDescription: 'Open palm raised straight above the head with palm facing forward',
    image: require('../../../assets/umpire/umpire_bye.jpg'),
    primaryColor: '#3b82f6',
    accentColor: '#2563eb',
    glowColor: 'rgba(59, 130, 246, 0.45)',
    bgGradient: '#172554',
    soundCueText: '✋ PALM RAISED • BYE RECORDED',
    iccIcon: '✋'
  },
  FOUR: {
    type: 'FOUR',
    title: 'BOUNDARY FOUR! ⚡',
    badge: '4 RUNS SCORED',
    lawText: 'MCC Law 19 • Boundaries (Rope Reached Along Ground)',
    gestureDescription: 'Arm waved from side to side across the chest toward boundary',
    image: require('../../../assets/umpire/umpire_four.jpg'),
    primaryColor: '#10b981',
    accentColor: '#059669',
    glowColor: 'rgba(16, 185, 129, 0.45)',
    bgGradient: '#064e3b',
    soundCueText: '👋 ARM WAVED • CRACKING BOUNDARY 4',
    iccIcon: '4️⃣'
  },
  SIX: {
    type: 'SIX',
    title: 'MAXIMUM SIX! 💥',
    badge: '6 RUNS OVER ROPE',
    lawText: 'MCC Law 19 • Maximum Boundary In The Air',
    gestureDescription: 'Both arms raised straight up into the air with open hands',
    image: require('../../../assets/umpire/umpire_six.jpg'),
    primaryColor: '#f59e0b',
    accentColor: '#d97706',
    glowColor: 'rgba(245, 158, 11, 0.55)',
    bgGradient: '#451a03',
    soundCueText: '🙌 BOTH ARMS UP • MAXIMUM MAXIMUM 6!',
    iccIcon: '6️⃣'
  },
  CONSECUTIVE_WIDES: {
    type: 'CONSECUTIVE_WIDES',
    title: 'CONSECUTIVE WIDES ALERT',
    badge: 'DISCIPLINARY WATCH',
    lawText: 'MCC Law 22 / TNCA Rule • Radar Wide Warning',
    gestureDescription: 'Wide signal repeated with standing umpire caution to bowler',
    image: require('../../../assets/umpire/umpire_wide.png'),
    primaryColor: '#f43f5e',
    accentColor: '#e11d48',
    glowColor: 'rgba(244, 63, 94, 0.45)',
    bgGradient: '#4c0519',
    soundCueText: '⚠️ CONSECUTIVE WIDES • BOWLER CAUTION',
    iccIcon: '⚠️'
  }
};

export const UmpireSignalOverlay: React.FC<UmpireSignalOverlayProps> = ({ event, onDismiss }) => {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;

  const currentEvent = event;
  const duration = currentEvent?.durationMs || 3800;

  useEffect(() => {
    if (currentEvent) {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
      progressAnim.setValue(1);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 70,
          useNativeDriver: true
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true
        })
      ]).start();

      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          })
        ])
      );
      pulseLoop.start();

      Animated.timing(progressAnim, {
        toValue: 0,
        duration: duration,
        easing: Easing.linear,
        useNativeDriver: false
      }).start();

      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => {
        clearTimeout(timer);
        pulseLoop.stop();
      };
    }
  }, [currentEvent]);

  if (!currentEvent) {
    return null;
  }

  const config = SIGNAL_CONFIGS[currentEvent.type] || SIGNAL_CONFIGS.OUT;

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 200,
        useNativeDriver: true
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      })
    ]).start(() => {
      onDismiss();
    });
  };

  return (
    <Modal
      transparent
      visible={!!currentEvent}
      animationType="none"
      onRequestClose={handleDismiss}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleDismiss}
      >
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
              shadowColor: config.primaryColor,
              borderColor: config.primaryColor
            }
          ]}
        >
          {/* Top Broadcast Live Header */}
          <View style={[styles.headerBanner, { backgroundColor: config.accentColor }]}>
            <View style={styles.headerLeft}>
              <View style={styles.liveBeaconDot} />
              <Text style={styles.headerTitle}>OFFICIAL UMPIRE SIGNAL</Text>
            </View>
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>{config.badge}</Text>
            </View>
          </View>

          {/* Card Body */}
          <View style={styles.cardContent}>
            {/* Main Decision Title */}
            <Text style={[styles.decisionTitle, { color: config.primaryColor }]}>
              {currentEvent.title || config.title}
            </Text>

            {/* Law Reference */}
            <View style={styles.lawRow}>
              <Text style={styles.lawText}>{config.lawText}</Text>
            </View>

            {/* Umpire Graphic Showcase with Animated Glow Frame */}
            <View style={styles.imageShowcaseWrapper}>
              <Animated.View
                style={[
                  styles.glowRing,
                  {
                    borderColor: config.glowColor,
                    backgroundColor: config.glowColor,
                    transform: [{ scale: pulseAnim }]
                  }
                ]}
              />

              <View
                style={[
                  styles.imageFrame,
                  {
                    borderColor: config.primaryColor
                  }
                ]}
              >
                <Image
                  source={config.image}
                  style={styles.umpireImage}
                  resizeMode="contain"
                />
              </View>
            </View>

            {/* Gesture description pill */}
            <View style={[styles.gesturePill, { backgroundColor: config.glowColor }]}>
              <Text style={styles.soundCueText}>{config.soundCueText}</Text>
              <Text style={styles.gestureDescriptionText}>{config.gestureDescription}</Text>
            </View>

            {/* Match Event Context Details */}
            {(currentEvent.batterName || currentEvent.bowlerName || currentEvent.dismissalType || currentEvent.extraDetails) && (
              <View style={styles.matchContextBox}>
                {currentEvent.batterName && (
                  <View style={styles.contextRow}>
                    <Text style={styles.contextLabel}>BATTER:</Text>
                    <Text style={styles.contextValue}>{currentEvent.batterName}</Text>
                  </View>
                )}
                {currentEvent.bowlerName && (
                  <View style={styles.contextRow}>
                    <Text style={styles.contextLabel}>BOWLER:</Text>
                    <Text style={styles.contextValue}>{currentEvent.bowlerName}</Text>
                  </View>
                )}
                {currentEvent.dismissalType && (
                  <View style={styles.contextRow}>
                    <Text style={styles.contextLabel}>DISMISSAL:</Text>
                    <Text style={[styles.contextValue, { color: '#fca5a5' }]}>{currentEvent.dismissalType}</Text>
                  </View>
                )}
                {currentEvent.extraDetails && (
                  <Text style={styles.contextExtra}>{currentEvent.extraDetails}</Text>
                )}
              </View>
            )}

            {/* Countdown Progress Bar */}
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    backgroundColor: config.primaryColor,
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%']
                    })
                  }
                ]}
              />
            </View>

            {/* Action Bar */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.dismissBtn, { backgroundColor: config.primaryColor }]}
                onPress={handleDismiss}
                activeOpacity={0.8}
              >
                <Text style={styles.dismissBtnText}>✓ CONTINUE SCORING</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// UMPIRE SIGNALS GALLERY MODAL
// Lets scorers, umpires, and spectators preview and learn all 9 signals anytime
// ─────────────────────────────────────────────────────────────────────────────
interface UmpireSignalsGalleryModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectSignal: (signalType: UmpireSignalType) => void;
}

export const UmpireSignalsGalleryModal: React.FC<UmpireSignalsGalleryModalProps> = ({
  visible,
  onClose,
  onSelectSignal
}) => {
  const signalKeys = Object.keys(SIGNAL_CONFIGS) as UmpireSignalType[];

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.galleryBackdrop}>
        <View style={styles.galleryContainer}>
          {/* Header */}
          <View style={styles.galleryHeader}>
            <View>
              <Text style={styles.galleryTitle}>🏁 ICC & TNCA UMPIRE SIGNALS GUIDE</Text>
              <Text style={styles.gallerySub}>
                Official hand gestures, cricket laws & broadcast visual signals
              </Text>
            </View>
            <TouchableOpacity style={styles.galleryCloseBtn} onPress={onClose}>
              <Text style={styles.galleryCloseBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Grid of signals */}
          <ScrollView
            style={styles.galleryScrollView}
            contentContainerStyle={styles.galleryGrid}
            showsVerticalScrollIndicator={false}
          >
            {signalKeys.map((key) => {
              const cfg = SIGNAL_CONFIGS[key];
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.galleryCard,
                    { borderColor: cfg.primaryColor }
                  ]}
                  activeOpacity={0.75}
                  onPress={() => {
                    onClose();
                    setTimeout(() => {
                      onSelectSignal(key);
                    }, 150);
                  }}
                >
                  <View style={[styles.galleryCardHeader, { backgroundColor: cfg.accentColor }]}>
                    <Text style={styles.galleryCardBadge}>{cfg.badge}</Text>
                    <Text style={styles.galleryCardIcon}>{cfg.iccIcon}</Text>
                  </View>

                  <View style={styles.galleryThumbWrapper}>
                    <Image
                      source={cfg.image}
                      style={styles.galleryThumbImage}
                      resizeMode="contain"
                    />
                  </View>

                  <View style={styles.galleryCardBody}>
                    <Text style={[styles.galleryCardTitle, { color: cfg.primaryColor }]}>
                      {cfg.title}
                    </Text>
                    <Text style={styles.galleryCardLaw}>{cfg.lawText}</Text>
                    <Text style={styles.galleryCardDesc} numberOfLines={2}>
                      {cfg.gestureDescription}
                    </Text>

                    <View style={[styles.galleryPlayBtn, { backgroundColor: cfg.primaryColor }]}>
                      <Text style={styles.galleryPlayBtnText}>▶ Play Animation</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Footer */}
          <View style={styles.galleryFooter}>
            <Text style={styles.galleryFooterNote}>
              💡 Tap any signal above to preview the full live broadcast animation. Signals trigger automatically during match deliveries.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 25, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  container: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 20
  },
  headerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  liveBeaconDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#ffffff'
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  badgePill: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  badgePillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  cardContent: {
    padding: 20,
    alignItems: 'center'
  },
  decisionTitle: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  lawRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16
  },
  lawText: {
    color: '#cbd5e1',
    fontSize: 11.5,
    fontWeight: '700'
  },
  imageShowcaseWrapper: {
    position: 'relative',
    width: 170,
    height: 170,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  glowRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.35
  },
  imageFrame: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#ffffff',
    borderWidth: 3,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  umpireImage: {
    width: '92%',
    height: '92%'
  },
  gesturePill: {
    width: '100%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 12,
    alignItems: 'center'
  },
  soundCueText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
    textAlign: 'center'
  },
  gestureDescriptionText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 15
  },
  matchContextBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  contextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2
  },
  contextLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800'
  },
  contextValue: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '800'
  },
  contextExtra: {
    color: '#cbd5e1',
    fontSize: 10.5,
    fontStyle: 'italic',
    marginTop: 4,
    textAlign: 'center'
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 14
  },
  progressBar: {
    height: '100%',
    borderRadius: 2
  },
  actionsRow: {
    width: '100%'
  },
  dismissBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3
  },
  dismissBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8
  },

  // Gallery Styles
  galleryBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  galleryContainer: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '90%',
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#38bdf8',
    overflow: 'hidden',
    elevation: 24
  },
  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  galleryTitle: {
    color: '#38bdf8',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  gallerySub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2
  },
  galleryCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  galleryCloseBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  galleryScrollView: {
    flexGrow: 1
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 16,
    justifyContent: 'center'
  },
  galleryCard: {
    width: '47%',
    minWidth: 150,
    maxWidth: 200,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginBottom: 4
  },
  galleryCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  galleryCardBadge: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900'
  },
  galleryCardIcon: {
    fontSize: 12
  },
  galleryThumbWrapper: {
    width: '100%',
    height: 100,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  },
  galleryThumbImage: {
    width: '90%',
    height: '90%'
  },
  galleryCardBody: {
    padding: 10,
    alignItems: 'center'
  },
  galleryCardTitle: {
    fontSize: 12.5,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 2
  },
  galleryCardLaw: {
    color: '#94a3b8',
    fontSize: 9.5,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4
  },
  galleryCardDesc: {
    color: '#cbd5e1',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 13,
    marginBottom: 8
  },
  galleryPlayBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    width: '100%',
    alignItems: 'center'
  },
  galleryPlayBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800'
  },
  galleryFooter: {
    padding: 12,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155'
  },
  galleryFooterNote: {
    color: '#94a3b8',
    fontSize: 10.5,
    textAlign: 'center',
    lineHeight: 14
  }
});

export default UmpireSignalOverlay;
