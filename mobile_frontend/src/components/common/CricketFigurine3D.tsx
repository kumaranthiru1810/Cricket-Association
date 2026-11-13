import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ImageSourcePropType,
  Platform,
  Animated,
  PanResponder,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';

interface CricketFigurine3DProps {
  imageSource: ImageSourcePropType;
  playerName: string;
  badgeText?: string;
  teamName?: string;
  milestoneTitle?: string;
  scoreText?: string;
  ballsText?: string;
  strikeRateText?: string;
  fours?: number;
  sixes?: number;
  height?: number;
  interactive?: boolean;
  onDismiss?: () => void;
}

export const CricketFigurine3D: React.FC<CricketFigurine3DProps> = ({
  imageSource,
  playerName,
  badgeText = '50 RUNS MILESTONE',
  teamName = '',
  milestoneTitle = 'HALF-CENTURY!',
  scoreText,
  ballsText,
  strikeRateText,
  fours,
  sixes,
  height = 340,
  interactive = true,
  onDismiss,
}) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 600;

  // 3D Drop-down and landing bounce animated values
  const dropAnim = useRef(new Animated.Value(-160)).current;
  const scaleAnim = useRef(new Animated.Value(1.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const shockwaveAnim = useRef(new Animated.Value(0)).current;
  const shadowScale = useRef(new Animated.Value(0.4)).current;

  // Interactive 3D tilt angles
  const [rotateX, setRotateX] = useState<number>(0);
  const [rotateY, setRotateY] = useState<number>(0);
  const [hasLanded, setHasLanded] = useState<boolean>(false);

  useEffect(() => {
    // 3D Drop animation sequence
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(dropAnim, {
        toValue: 0,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(shadowScale, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setHasLanded(true);
      // Trigger pedestal golden shockwave on landing
      Animated.sequence([
        Animated.timing(shockwaveAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, []);

  // Web interactive mouse hover tilt
  const handleMouseMove = (e: any) => {
    if (!interactive || Platform.OS !== 'web') return;
    try {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      const degX = -(y / (rect.height / 2)) * 14;
      const degY = (x / (rect.width / 2)) * 18;
      setRotateX(degX);
      setRotateY(degY);
    } catch (_err) {}
  };

  const handleMouseLeave = () => {
    if (Platform.OS === 'web') {
      setRotateX(0);
      setRotateY(0);
    }
  };

  // Mobile PanResponder for touch drag
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_evt, gestureState) => {
        if (!interactive) return;
        const degY = Math.max(-25, Math.min(25, gestureState.dx * 0.15));
        const degX = Math.max(-18, Math.min(18, -gestureState.dy * 0.15));
        setRotateX(degX);
        setRotateY(degY);
      },
      onPanResponderRelease: () => {
        setRotateX(0);
        setRotateY(0);
      },
    })
  ).current;

  return (
    <View
      style={[styles.container, { height }]}
      {...(Platform.OS !== 'web' ? panResponder.panHandlers : {})}
      // @ts-ignore
      onMouseMove={handleMouseMove}
      // @ts-ignore
      onMouseLeave={handleMouseLeave}
    >
      {/* 3D Atmosphere Spotlight Cone */}
      <View style={styles.spotlightCone} pointerEvents="none" />

      {/* 3D Scene Wrapper with Perspective */}
      <View
        style={[
          styles.scene3D,
          Platform.OS === 'web' && {
            // @ts-ignore
            perspective: '1000px',
            transformStyle: 'preserve-3d',
          },
        ]}
      >
        {/* Animated Drop-in Figurine Character */}
        <Animated.View
          style={[
            styles.figurineWrapper,
            {
              opacity: opacityAnim,
              transform: [
                { translateY: dropAnim },
                { scale: scaleAnim },
                { rotateX: `${rotateX}deg` },
                { rotateY: `${rotateY}deg` },
              ],
            },
          ]}
        >
          {/* Figurine Glow Aura & Silhouette */}
          <View style={styles.figurineGlowRing} pointerEvents="none" />

          {/* Real Cutout Image of Batter / Bowler / Champion */}
          <Image
            source={imageSource}
            style={[styles.figurineImage, isMobile && { width: 170, height: 190 }]}
            resizeMode="contain"
          />

          {/* 3D Specular Highlight Sheen over Figurine */}
          <View style={styles.statuetteSheen} pointerEvents="none" />
        </Animated.View>

        {/* 3D Pedestal Platform (Sketchfab Collectible Trophy Base) */}
        <View style={styles.pedestalStage}>
          {/* Expanding Shockwave Ring on Landing */}
          {hasLanded && (
            <Animated.View
              style={[
                styles.landingShockwave,
                {
                  opacity: shockwaveAnim.interpolate({
                    inputRange: [0, 0.8, 1],
                    outputRange: [0.9, 0.3, 0],
                  }),
                  transform: [
                    {
                      scale: shockwaveAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.6, 2.2],
                      }),
                    },
                  ],
                },
              ]}
              pointerEvents="none"
            />
          )}

          {/* Contact Shadow right under figurine feet */}
          <Animated.View
            style={[
              styles.contactShadow,
              {
                transform: [{ scale: shadowScale }],
              },
            ]}
            pointerEvents="none"
          />

          {/* Pedestal Top Tier (Elliptical Golden Turntable Surface) */}
          <View style={styles.pedestalTopPlate}>
            <View style={styles.pedestalInnerRing} />
          </View>

          {/* Pedestal Beveled 3D Cylinder Rim (Gold / Metallic Height) */}
          <View style={styles.pedestalRim}>
            {/* Engraved Metallic Brass Nameplate (Sketchfab Figurine Plaque) */}
            <View style={styles.engravedPlaque}>
              <View style={styles.plaqueScrewLeft} />
              <View style={styles.plaqueContent}>
                <Text style={styles.plaquePlayerName} numberOfLines={1}>
                  ★ {playerName.toUpperCase()} ★
                </Text>
                <Text style={styles.plaqueMilestoneSub} numberOfLines={1}>
                  {badgeText.toUpperCase()}
                </Text>
              </View>
              <View style={styles.plaqueScrewRight} />
            </View>
          </View>

          {/* Pedestal Bottom Base Stand */}
          <View style={styles.pedestalBottomRim} />
        </View>

        {/* 3D Interactive Rotate Hint Pill */}
        {interactive && (
          <View style={styles.dragHintPill}>
            <Text style={styles.dragHintText}>✨ Touch / Move to Rotate 3D Statuette</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
    marginVertical: 10,
  },
  spotlightCone: {
    position: 'absolute',
    top: -20,
    width: 220,
    height: 320,
    borderRadius: 110,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 8,
  },
  scene3D: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  figurineWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    position: 'relative',
  },
  figurineGlowRing: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 24,
  },
  figurineImage: {
    width: 190,
    height: 190,
    borderRadius: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
  },
  statuetteSheen: {
    position: 'absolute',
    top: 10,
    left: '25%',
    width: '50%',
    height: '60%',
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    transform: [{ rotate: '-25deg' }],
  },
  pedestalStage: {
    width: 270,
    alignItems: 'center',
    marginTop: -10,
    zIndex: 5,
    position: 'relative',
  },
  contactShadow: {
    position: 'absolute',
    top: -6,
    width: 180,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    zIndex: 2,
  },
  landingShockwave: {
    position: 'absolute',
    top: -6,
    width: 170,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: '#f59e0b',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    zIndex: 1,
  },
  pedestalTopPlate: {
    width: 246,
    height: 18,
    borderRadius: 123,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#fbbf24',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    zIndex: 3,
  },
  pedestalInnerRing: {
    width: 216,
    height: 10,
    borderRadius: 108,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.45)',
    backgroundColor: '#090d16',
  },
  pedestalRim: {
    width: 264,
    minHeight: 52,
    marginTop: -2,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    backgroundColor: '#0f172a',
    borderWidth: 2,
    borderColor: '#b45309',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    zIndex: 2,
  },
  engravedPlaque: {
    backgroundColor: '#78350f',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '95%',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  plaqueScrewLeft: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#fbbf24',
    borderWidth: 0.5,
    borderColor: '#78350f',
  },
  plaqueScrewRight: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#fbbf24',
    borderWidth: 0.5,
    borderColor: '#78350f',
  },
  plaqueContent: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 4,
  },
  plaquePlayerName: {
    color: '#fef08a',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  plaqueMilestoneSub: {
    color: '#fde047',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 2,
    textAlign: 'center',
  },
  pedestalBottomRim: {
    width: 276,
    height: 10,
    marginTop: 1,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    backgroundColor: '#030712',
    borderWidth: 1.5,
    borderColor: '#451a03',
    zIndex: 1,
  },
  dragHintPill: {
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  dragHintText: {
    color: '#fde047',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default CricketFigurine3D;

