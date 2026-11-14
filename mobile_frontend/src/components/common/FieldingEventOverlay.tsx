import React, { useEffect, useRef } from 'react';
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
  Easing
} from 'react-native';

export type FieldingEventType =
  | 'BOUNDARY_SAVE'
  | 'DIRECT_HIT'
  | 'CLEAN_COLLECT'
  | 'PICK_AND_THROW'
  | 'RELAY_THROW'
  | 'CATCH'
  | 'STUMPING'
  | 'MISFIELD'
  | 'OVERTHROW';

export interface FieldingEventData {
  type: FieldingEventType;
  fielderName: string;
  teamName?: string;
  title?: string;
  badge?: string;
  stats?: string;
  details?: string;
  impactScore?: number;
  durationMs?: number;
}

interface FieldingEventOverlayProps {
  event: FieldingEventData | null;
  onDismiss: () => void;
}

interface FieldingConfig {
  title: string;
  badge: string;
  tagline: string;
  image: any;
  primaryColor: string;
  accentColor: string;
  glowColor: string;
  impactText: string;
  icon: string;
}

const FIELDING_CONFIGS: Record<FieldingEventType, FieldingConfig> = {
  BOUNDARY_SAVE: {
    title: 'SPECTACULAR BOUNDARY SAVE! ⚡',
    badge: '4 RUNS PREVENTED',
    tagline: 'Sensational boundary rope slide and athletic recovery',
    image: require('../../../assets/fielding_boundary_save.png'),
    primaryColor: '#10b981',
    accentColor: '#059669',
    glowColor: 'rgba(16, 185, 129, 0.45)',
    impactText: '+12 FIELDING IMPACT PTS • 4 RUNS SAVED',
    icon: '⚡'
  },
  DIRECT_HIT: {
    title: 'BULLSEYE DIRECT HIT! 🎯',
    badge: 'DIRECT HIT STUMPING',
    tagline: 'Razor-sharp throw from deep shattering the stumps',
    image: require('../../../assets/fielding_direct_hit.jpg'),
    primaryColor: '#f43f5e',
    accentColor: '#e11d48',
    glowColor: 'rgba(244, 63, 94, 0.45)',
    impactText: '+15 FIELDING IMPACT PTS • WICKET CHANCE',
    icon: '🎯'
  },
  CLEAN_COLLECT: {
    title: 'CLEAN COLLECT & THROW! 🧤',
    badge: 'RAPID PICK & THROW',
    tagline: 'Swooping low on the run with a fluid rapid return to keeper',
    image: require('../../../assets/fielding_clean_collect.jpg'),
    primaryColor: '#0284c7',
    accentColor: '#0369a1',
    glowColor: 'rgba(2, 132, 199, 0.45)',
    impactText: '+5 FIELDING IMPACT PTS • ZERO RUN CONCEDED',
    icon: '🧤'
  },
  PICK_AND_THROW: {
    title: 'SWIFT PICK & THROW! 🚀',
    badge: 'LIGHTNING RETURN',
    tagline: 'Quick release preventing the second run under pressure',
    image: require('../../../assets/fielding_clean_collect.jpg'),
    primaryColor: '#0ea5e9',
    accentColor: '#0284c7',
    glowColor: 'rgba(14, 165, 233, 0.45)',
    impactText: '+6 FIELDING IMPACT PTS • PRESSURE CREATED',
    icon: '🚀'
  },
  RELAY_THROW: {
    title: 'TEXTBOOK RELAY THROW! 🔄',
    badge: 'TEAMWORK ASSIST',
    tagline: 'Flawless boundary relay throw finding the bowler end',
    image: require('../../../assets/fielding_boundary_save.png'),
    primaryColor: '#8b5cf6',
    accentColor: '#7c3aed',
    glowColor: 'rgba(139, 92, 246, 0.45)',
    impactText: '+8 FIELDING IMPACT PTS • BOUNDARY CONTAINED',
    icon: '🔄'
  },
  CATCH: {
    title: 'OUTFIELD DIVING CATCH! 🦅',
    badge: 'SPECTACULAR CATCH',
    tagline: 'Airborne dive with secure two-handed boundary catch',
    image: require('../../../assets/catch_milestone.jpg'),
    primaryColor: '#ec4899',
    accentColor: '#db2777',
    glowColor: 'rgba(236, 72, 153, 0.45)',
    impactText: '+20 FIELDING IMPACT PTS • WICKET SECURED',
    icon: '🦅'
  },
  STUMPING: {
    title: 'LIGHTNING WICKETKEEPING! ⚡',
    badge: 'WHIPPED BAILS',
    tagline: 'Sub-second glovework dislodging bails behind the crease',
    image: require('../../../assets/keeper_dismissal.png'),
    primaryColor: '#a855f7',
    accentColor: '#9333ea',
    glowColor: 'rgba(168, 85, 247, 0.45)',
    impactText: '+18 IMPACT PTS • KEEPER DISMISSAL',
    icon: '🧤'
  },
  MISFIELD: {
    title: 'MISFIELD RECOVERY ⚠️',
    badge: 'FIELDING DRILL',
    tagline: 'Ball slipped through but quickly retrieved by backup fielder',
    image: require('../../../assets/fielding_clean_collect.jpg'),
    primaryColor: '#f59e0b',
    accentColor: '#d97706',
    glowColor: 'rgba(245, 158, 11, 0.45)',
    impactText: 'FIELDING ANALYSIS • AGILITY DRILL REQUIRED',
    icon: '⚠️'
  },
  OVERTHROW: {
    title: 'WILD OVERTHROW CONCEDED! ⚡',
    badge: 'OVERTHROW RUNS',
    tagline: 'Errant throw missed the stumps allowing batters extra stolen runs',
    image: require('../../../assets/overthrow.jpg'),
    primaryColor: '#f59e0b',
    accentColor: '#d97706',
    glowColor: 'rgba(245, 158, 11, 0.45)',
    impactText: 'MCC LAW 19.8 • EXTRA RUNS CONCEDED',
    icon: '⚡'
  }
};

export const FieldingEventOverlay: React.FC<FieldingEventOverlayProps> = ({ event, onDismiss }) => {
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

      const useNative = Platform.OS !== 'web';
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 70,
          useNativeDriver: useNative
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: useNative
        })
      ]).start();

      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: useNative
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: useNative
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

  const config = FIELDING_CONFIGS[currentEvent.type] || FIELDING_CONFIGS.CLEAN_COLLECT;

  const handleDismiss = () => {
    const useNative = Platform.OS !== 'web';
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 200,
        useNativeDriver: useNative
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: useNative
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
              <Text style={styles.headerTitle}>OFFICIAL FIELDING HIGHLIGHT</Text>
            </View>
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>{currentEvent.badge || config.badge}</Text>
            </View>
          </View>

          {/* Card Body */}
          <View style={styles.cardContent}>
            {/* Title */}
            <Text style={[styles.eventTitle, { color: config.primaryColor }]}>
              {currentEvent.title || config.title}
            </Text>

            {/* Fielder & Team */}
            <View style={styles.playerHighlightRow}>
              <Text style={styles.fielderNameText}>🧤 {currentEvent.fielderName}</Text>
              {currentEvent.teamName && (
                <Text style={styles.teamNameText}>({currentEvent.teamName})</Text>
              )}
            </View>

            {/* Graphic Image Showcase with Glowing Border */}
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

              <View style={[styles.imageFrame, { borderColor: config.primaryColor }]}>
                <Image
                  source={config.image}
                  style={styles.fieldingImage}
                  resizeMode="contain"
                />
              </View>
            </View>

            {/* Impact Metric Badge */}
            <View style={[styles.impactPill, { backgroundColor: config.glowColor, borderColor: config.primaryColor }]}>
              <Text style={styles.impactIcon}>{config.icon}</Text>
              <Text style={styles.impactScoreText}>{config.impactText}</Text>
            </View>

            {/* Description & Commentary */}
            <Text style={styles.taglineText}>
              {currentEvent.details || currentEvent.stats || config.tagline}
            </Text>

            {/* Progress Countdown Bar */}
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
            <TouchableOpacity
              style={[styles.dismissBtn, { backgroundColor: config.primaryColor }]}
              onPress={handleDismiss}
              activeOpacity={0.8}
            >
              <Text style={styles.dismissBtnText}>✓ CONTINUE MATCH SCOREBOARD</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </TouchableOpacity>
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
  eventTitle: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  playerHighlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16
  },
  fielderNameText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800'
  },
  teamNameText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600'
  },
  imageShowcaseWrapper: {
    position: 'relative',
    width: 170,
    height: 170,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14
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
  fieldingImage: {
    width: '92%',
    height: '92%'
  },
  impactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 10
  },
  impactIcon: {
    fontSize: 14
  },
  impactScoreText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  taglineText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 16,
    paddingHorizontal: 8
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
  }
});

export default FieldingEventOverlay;

