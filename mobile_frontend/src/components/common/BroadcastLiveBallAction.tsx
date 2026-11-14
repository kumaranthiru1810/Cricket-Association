import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
  Platform
} from 'react-native';
import { cricketSound } from '../../utils/cricketSoundFx';

export interface BallActionEvent {
  runs: number;
  isBoundary?: boolean;
  isSix?: boolean;
  isWicket?: boolean;
  isExtra?: boolean;
  extraType?: string;
  batterName?: string;
  bowlerName?: string;
  shotZone?: string;
}

interface Props {
  lastEvent?: BallActionEvent | null;
  triggerKey?: string | number;
  autoPlay?: boolean;
}

export default function BroadcastLiveBallAction({
  lastEvent,
  triggerKey,
  autoPlay = true
}: Props) {
  const [visible, setVisible] = useState<boolean>(false);
  const [activeEvent, setActiveEvent] = useState<BallActionEvent>({
    runs: 1,
    isBoundary: false,
    batterName: 'Striker',
    shotZone: 'Cover'
  });

  // Kinetic Animation Values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-16)).current;
  const batRotateAnim = useRef(new Animated.Value(0)).current;
  const ballTravelAnim = useRef(new Animated.Value(0)).current;
  const pulseScaleAnim = useRef(new Animated.Value(0.9)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const triggerBroadcastAction = (evt?: BallActionEvent) => {
    const e = evt || lastEvent || {
      runs: 1,
      isBoundary: false,
      batterName: 'Striker',
      shotZone: 'Cover'
    };
    setActiveEvent(e);
    setVisible(true);

    // Procedural 100% Royalty-Free Web Audio Sound Effects
    try {
      if (e.isWicket) {
        cricketSound.playWicket();
      } else if (e.isSix || e.runs === 6) {
        cricketSound.playSix();
      } else if (e.isBoundary || e.runs === 4) {
        cricketSound.playFour();
      } else if (e.isExtra || e.extraType) {
        cricketSound.playExtraAlert();
      } else if (e.runs > 0) {
        cricketSound.playRunning();
      } else {
        cricketSound.playDotBall();
      }
    } catch (_soundErr) {}

    // Reset animations
    fadeAnim.setValue(0);
    slideAnim.setValue(-16);
    batRotateAnim.setValue(0);
    ballTravelAnim.setValue(0);
    pulseScaleAnim.setValue(0.92);
    glowAnim.setValue(0);

    const useNative = Platform.OS !== 'web';

    // Sequence 1: Ingress & Impact Shockwave
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 240,
        useNativeDriver: useNative,
        easing: Easing.out(Easing.cubic)
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: useNative,
        easing: Easing.out(Easing.back(1.5))
      }),
      Animated.spring(pulseScaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: useNative
      }),
      Animated.timing(batRotateAnim, {
        toValue: 1,
        duration: 420,
        useNativeDriver: useNative,
        easing: Easing.bezier(0.2, 0.9, 0.3, 1)
      }),
      Animated.timing(ballTravelAnim, {
        toValue: 1,
        duration: 750,
        useNativeDriver: useNative,
        easing: Easing.out(Easing.quad)
      }),
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: useNative
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 450,
          useNativeDriver: useNative
        })
      ])
    ]).start();

    // Auto-dismiss after broadcast telemetry display (3.8s)
    const timeout = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: useNative,
        easing: Easing.in(Easing.ease)
      }).start(() => {
        setVisible(false);
      });
    }, 3800);

    return () => clearTimeout(timeout);
  };

  useEffect(() => {
    if (triggerKey !== undefined && autoPlay) {
      triggerBroadcastAction(lastEvent || undefined);
    }
  }, [triggerKey]);

  if (!visible) {
    return (
      <View style={styles.miniTriggerBar}>
        <TouchableOpacity
          style={styles.miniTriggerBtn}
          onPress={() => triggerBroadcastAction(lastEvent || undefined)}
          activeOpacity={0.8}
        >
          <Text style={styles.miniTriggerIcon}>⚡</Text>
          <Text style={styles.miniTriggerText}>Broadcast Kinetic Telemetry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Bat swing rotation interpolation (-25deg to +45deg forward stroke)
  const batRotation = batRotateAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: ['-30deg', '15deg', '38deg']
  });

  // Ball trajectory travel interpolation across HUD arc
  const ballTranslateX = ballTravelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 140]
  });
  const ballTranslateY = ballTravelAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -22, -6]
  });
  const ballScale = ballTravelAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.8, 1.4, 1.1]
  });

  const isSix = Boolean(activeEvent.isSix || activeEvent.runs === 6);
  const isFour = Boolean(activeEvent.isBoundary || activeEvent.runs === 4);
  const isWkt = Boolean(activeEvent.isWicket);
  const runsCount = typeof activeEvent.runs === 'number' ? activeEvent.runs : 0;
  const isExtra = Boolean(activeEvent.isExtra || activeEvent.extraType);
  const ext = (activeEvent.extraType || '').toLowerCase();
  const isWide = ext.includes('wide') || ext === 'wd';
  const isNoBall = ext.includes('no_ball') || ext.includes('noball') || ext === 'nb';
  const isDot = !isWkt && !isExtra && runsCount === 0;

  let badgeColor = '#2563eb';
  let badgeText = `+${runsCount} RUNS`;
  let headline = `🏏 +${runsCount} RUN${runsCount !== 1 ? 'S' : ''} • CRISP RUNNING BETWEEN CREASES`;
  let subline = 'Smart strike rotation keeping the scoreboard continuously ticking.';

  if (isWkt) {
    badgeColor = '#dc2626';
    badgeText = '🔴 OUT';
    headline = `🔴 WICKET! • ${activeEvent.batterName ? activeEvent.batterName + ' DISMISSED' : 'TIMBER SHATTERED'}`;
    subline = 'Critical breakthrough captured under official Federation rules!';
  } else if (isSix) {
    badgeColor = '#7c3aed';
    badgeText = '★ SIX';
    headline = '🚀 MAXIMUM 6 • HUGE LOFTED STROKE';
    subline = 'High trajectory missile sailing effortlessly over the deep boundary ropes!';
  } else if (isFour) {
    badgeColor = '#059669';
    badgeText = '⚡ FOUR';
    headline = '⚡ BOUNDARY 4 • CRACKING WILLOW STROKE';
    subline = 'Exquisite timing pierced through the infield fielders with pinpoint precision.';
  } else if (isNoBall) {
    badgeColor = '#ea580c';
    badgeText = '⚠️ NO BALL';
    headline = '⚠️ NO BALL • FREE HIT NEXT DELIVERY';
    subline = 'Penalty run awarded to batting team; Free Hit active next ball!';
  } else if (isWide) {
    badgeColor = '#d97706';
    badgeText = '↔️ WIDE';
    headline = '↔️ WIDE BALL • +1 EXTRA RUN';
    subline = 'Delivery strayed past the tramlines; re-bowled with penalty extra.';
  } else if (isExtra) {
    badgeColor = '#0284c7';
    badgeText = '🏃 EXTRA';
    headline = `🏃 +${runsCount} EXTRA • RUNS WITHOUT BAT CONTACT`;
    subline = 'Batters scampered through as the delivery passed the stumps.';
  } else if (runsCount === 1) {
    badgeColor = '#2563eb';
    badgeText = '+1 RUN';
    headline = '🏏 +1 RUN • CRISP RUNNING BETWEEN CREASES';
    subline = 'Quick single taken with sharp strike rotation keeping scoreboard moving.';
  } else if (runsCount === 2) {
    badgeColor = '#0284c7';
    badgeText = '+2 RUNS';
    headline = '🏃‍♂️ +2 RUNS • AGGRESSIVE RUNNING';
    subline = 'Sharp calling and quick sprint turning a single into two solid runs.';
  } else if (runsCount === 3) {
    badgeColor = '#0d9488';
    badgeText = '+3 RUNS';
    headline = '⚡ +3 RUNS • COMMITTED THREE';
    subline = 'Terrific placement into deep outfield and exceptional speed between wickets.';
  } else if (isDot) {
    badgeColor = '#64748b';
    badgeText = '⚪ DOT BALL';
    headline = '🛡️ DOT BALL • PRESSURE BUILDS';
    subline = 'Disciplined bowling channel giving away no runs on this delivery.';
  }

  return (
    <Animated.View
      style={[
        styles.hudContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }, { scale: pulseScaleAnim }]
        }
      ]}
    >
      {/* Laser Top Glow Header Bar */}
      <View style={[styles.laserEdgeBar, { backgroundColor: badgeColor }]} />

      <View style={styles.hudBody}>
        {/* Left Side: Broadcast Kinetic Willow & Trajectory Chamber */}
        <View style={styles.telemetryArtBox}>
          {/* Pitch Turf Arc Background */}
          <View style={styles.pitchTurfArc}>
            {/* Impact Spark Pulse Ring */}
            <Animated.View
              style={[
                styles.shockwaveRing,
                {
                  borderColor: badgeColor,
                  opacity: glowAnim,
                  transform: [{ scale: pulseScaleAnim }]
                }
              ]}
            />

            {/* Kinetic Willow Bat (Handcrafted vector design) */}
            <Animated.View
              style={[
                styles.batPivotContainer,
                { transform: [{ rotate: batRotation }] }
              ]}
            >
              {/* Bat Handle (Grip wrap) */}
              <View style={styles.batHandle} />
              {/* Bat Shoulder & Willow Blade */}
              <View style={[styles.batBlade, { backgroundColor: isSix ? '#f59e0b' : '#d97706' }]}>
                {/* Sweet-Spot Spine */}
                <View style={styles.batSpineLine} />
              </View>
            </Animated.View>

            {/* Leather Cricket Ball on Trajectory Arc */}
            <Animated.View
              style={[
                styles.kineticBallBox,
                {
                  transform: [
                    { translateX: ballTranslateX },
                    { translateY: ballTranslateY },
                    { scale: ballScale }
                  ]
                }
              ]}
            >
              {/* Deep Red Crimson Leather Ball */}
              <View style={[styles.cricketLeatherBall, isSix && styles.cricketSixBall]}>
                {/* Seam line */}
                <View style={styles.ballSeam} />
              </View>
              {/* Golden Motion Arc Particle Tail */}
              <View style={[styles.ballParticleTail, { backgroundColor: badgeColor }]} />
            </Animated.View>
          </View>
        </View>

        {/* Right Side: Professional TV Broadcast Score Ticker */}
        <View style={styles.telemetryInfoCol}>
          <View style={styles.badgeRow}>
            <View style={[styles.pillBadge, { backgroundColor: badgeColor }]}>
              <Text style={styles.pillBadgeText}>
                {badgeText}
              </Text>
            </View>
            <Text style={styles.speedTelemetryText}>VELOCITY: 138.4 KM/H</Text>
          </View>

          <Text style={styles.headlineText} numberOfLines={1}>
            {headline}
          </Text>

          <Text style={styles.sublineText} numberOfLines={2}>
            {subline}
          </Text>
        </View>

        {/* Close Button */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => setVisible(false)}
          activeOpacity={0.7}
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  miniTriggerBar: {
    marginVertical: 4,
    alignItems: 'center'
  },
  miniTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20
  },
  miniTriggerIcon: {
    fontSize: 11
  },
  miniTriggerText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#b45309',
    letterSpacing: 0.4
  },
  hudContainer: {
    backgroundColor: '#090d1a', // TV Broadcast Deep Titanium
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#b8860b', // Official Gold Border
    marginVertical: 8,
    overflow: 'hidden',
    shadowColor: '#b8860b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6
  },
  laserEdgeBar: {
    height: 3,
    width: '100%'
  },
  hudBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12
  },
  telemetryArtBox: {
    width: 90,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pitchTurfArc: {
    width: 86,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#0d1527',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center'
  },
  shockwaveRing: {
    position: 'absolute',
    left: 12,
    top: 22,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2
  },
  batPivotContainer: {
    position: 'absolute',
    left: 16,
    bottom: 8,
    width: 14,
    height: 38,
    alignItems: 'center'
  },
  batHandle: {
    width: 3.5,
    height: 12,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    borderWidth: 0.5,
    borderColor: '#94a3b8'
  },
  batBlade: {
    width: 8,
    height: 24,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: '#78350f'
  },
  batSpineLine: {
    width: 1.5,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.3)'
  },
  kineticBallBox: {
    position: 'absolute',
    left: 20,
    top: 24,
    flexDirection: 'row',
    alignItems: 'center'
  },
  cricketLeatherBall: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#dc2626',
    borderWidth: 1,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4
  },
  cricketSixBall: {
    backgroundColor: '#f59e0b',
    borderColor: '#fef08a'
  },
  ballSeam: {
    width: 1,
    height: 10,
    backgroundColor: '#ffffff'
  },
  ballParticleTail: {
    width: 14,
    height: 2,
    borderRadius: 1,
    opacity: 0.6,
    marginLeft: 2
  },
  telemetryInfoCol: {
    flex: 1
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3
  },
  pillBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4
  },
  pillBadgeText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  speedTelemetryText: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  headlineText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3
  },
  sublineText: {
    color: '#cbd5e1',
    fontSize: 10,
    marginTop: 2,
    lineHeight: 14
  },
  closeBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800'
  }
});
