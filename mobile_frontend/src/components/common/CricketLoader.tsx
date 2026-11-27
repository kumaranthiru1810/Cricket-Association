import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Platform,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';

const LOGO_ASSET = require('../../../assets/logo_transparent.png');

export interface CricketLoaderProps {
  /** Fill entire viewport / parent screen (default true) */
  fullScreen?: boolean;
  /** Optional custom subtitle override */
  subtitle?: string;
}

const WEB_STYLE_ID = 'cfvd-cricket-loader-keyframes';

const WEB_CSS = `
@keyframes cl-ball-travel {
  0% {
    left: -18px;
    opacity: 0;
  }
  8% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    left: calc(100% - 14px);
    opacity: 0.95;
  }
}

@keyframes cl-ball-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(720deg);
  }
}

@keyframes cl-trail-sweep {
  0% {
    width: 0%;
    opacity: 0.25;
  }
  85% {
    width: 100%;
    opacity: 1;
  }
  100% {
    width: 100%;
    opacity: 0.2;
  }
}

@keyframes cl-logo-aura {
  0%, 100% {
    transform: scale(0.96);
    opacity: 0.65;
  }
  50% {
    transform: scale(1.06);
    opacity: 1;
  }
}

@keyframes cl-orbit-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes cl-floodlight-pulse {
  0%, 100% {
    opacity: 0.55;
  }
  50% {
    opacity: 0.9;
  }
}

.cl-root-web {
  position: relative;
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: radial-gradient(circle at 50% 35%, #12316b 0%, #091c42 48%, #040c1f 100%);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding: 24px 16px;
  box-sizing: border-box;
}

.cl-root-web.cl-embedded {
  min-height: 360px;
  border-radius: 16px;
}

.cl-ribbon-tl {
  position: absolute;
  top: -40px;
  left: -60px;
  width: 280px;
  height: 18px;
  background: linear-gradient(90deg, #facc15, #f59e0b, transparent);
  transform: rotate(-32deg);
  opacity: 0.85;
  box-shadow: 0 0 24px rgba(250, 204, 21, 0.45);
  pointer-events: none;
}

.cl-ribbon-br {
  position: absolute;
  bottom: 24px;
  right: -60px;
  width: 280px;
  height: 18px;
  background: linear-gradient(90deg, transparent, #f59e0b, #facc15);
  transform: rotate(-32deg);
  opacity: 0.85;
  box-shadow: 0 0 24px rgba(250, 204, 21, 0.45);
  pointer-events: none;
}

.cl-floodlight-left {
  position: absolute;
  top: -30px;
  left: -40px;
  width: 320px;
  height: 360px;
  background: radial-gradient(ellipse at 20% 25%, rgba(186, 230, 253, 0.28) 0%, rgba(56, 189, 248, 0.08) 45%, transparent 72%);
  animation: cl-floodlight-pulse 4s ease-in-out infinite;
  pointer-events: none;
}

.cl-floodlight-right {
  position: absolute;
  top: -30px;
  right: -40px;
  width: 320px;
  height: 360px;
  background: radial-gradient(ellipse at 80% 25%, rgba(186, 230, 253, 0.28) 0%, rgba(56, 189, 248, 0.08) 45%, transparent 72%);
  animation: cl-floodlight-pulse 4s ease-in-out 2s infinite;
  pointer-events: none;
}

.cl-tower-dots {
  position: absolute;
  top: 22px;
  display: grid;
  grid-template-columns: repeat(4, 6px);
  gap: 5px;
  padding: 6px;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: 0 0 22px rgba(224, 242, 254, 0.55);
  pointer-events: none;
}

.cl-tower-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #f8fafc;
  box-shadow: 0 0 8px #e0f2fe, 0 0 14px #7dd3fc;
}

.cl-stadium-horizon {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 76px;
  background: linear-gradient(180deg, transparent 0%, rgba(6, 78, 59, 0.45) 60%, rgba(20, 83, 45, 0.85) 100%);
  border-top: 1px solid rgba(250, 204, 21, 0.14);
  pointer-events: none;
}

.cl-logo-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.cl-logo-aura {
  position: absolute;
  width: 128%;
  height: 128%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(250, 204, 21, 0.42) 0%, rgba(234, 179, 8, 0.16) 48%, transparent 72%);
  animation: cl-logo-aura 2.8s ease-in-out infinite;
  pointer-events: none;
}

.cl-orbit-ring {
  position: absolute;
  width: 114%;
  height: 114%;
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: rgba(250, 204, 21, 0.9);
  border-right-color: rgba(253, 224, 71, 0.45);
  box-shadow: 0 0 18px rgba(250, 204, 21, 0.35);
  animation: cl-orbit-spin 6s linear infinite;
  pointer-events: none;
}

.cl-orbit-ball {
  position: absolute;
  top: -7px;
  left: 50%;
  margin-left: -7px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #f87171, #dc2626 55%, #7f1d1d 100%);
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow: 0 0 12px rgba(250, 204, 21, 0.8);
}

.cl-logo-img {
  position: relative;
  z-index: 2;
  object-fit: contain;
  filter: drop-shadow(0 6px 22px rgba(250, 204, 21, 0.38));
}

.cl-track-wrap {
  position: relative;
  width: 100%;
  max-width: 380px;
  height: 36px;
  display: flex;
  align-items: center;
  margin-top: 18px;
  margin-bottom: 22px;
}

.cl-track-bar {
  position: relative;
  width: 100%;
  height: 12px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.85);
  border: 1.5px solid rgba(250, 204, 21, 0.55);
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6), 0 0 16px rgba(250, 204, 21, 0.2);
  overflow: hidden;
}

.cl-track-trail {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(217, 119, 6, 0.25) 0%, #f59e0b 55%, #fef08a 100%);
  box-shadow: 0 0 14px rgba(250, 204, 21, 0.85);
  animation: cl-trail-sweep 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

.cl-ball-runner {
  position: absolute;
  top: 50%;
  margin-top: -15px;
  width: 30px;
  height: 30px;
  animation: cl-ball-travel 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  z-index: 4;
  pointer-events: none;
}

.cl-ball-sphere {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, #fca5a5 0%, #ef4444 26%, #b91c1c 68%, #450a0a 100%);
  border: 1.5px solid rgba(254, 240, 138, 0.75);
  box-shadow: -8px 0 18px rgba(250, 204, 21, 0.85), 0 0 12px rgba(239, 68, 68, 0.75);
  position: relative;
  overflow: hidden;
  animation: cl-ball-spin 2.2s linear infinite;
}

.cl-ball-seam {
  position: absolute;
  top: -3px;
  bottom: -3px;
  left: 50%;
  width: 5px;
  margin-left: -2.5px;
  border-left: 1.5px dashed rgba(255, 255, 255, 0.9);
  border-right: 1.5px dashed rgba(255, 255, 255, 0.9);
  transform: rotate(24deg);
}
`;

export default function CricketLoader({ fullScreen = true, subtitle }: CricketLoaderProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 640;

  // Native animation refs (used on iOS / Android)
  const ballProgress = useRef(new Animated.Value(0)).current;
  const logoPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      if (!document.getElementById(WEB_STYLE_ID)) {
        const styleEl = document.createElement('style');
        styleEl.id = WEB_STYLE_ID;
        styleEl.textContent = WEB_CSS;
        document.head.appendChild(styleEl);
      }
      return;
    }

    const ballAnim = Animated.loop(
      Animated.timing(ballProgress, {
        toValue: 1,
        duration: 2200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      })
    );
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(logoPulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    ballAnim.start();
    pulseAnim.start();

    return () => {
      ballAnim.stop();
      pulseAnim.stop();
    };
  }, [ballProgress, logoPulse]);

  const logoSize = isMobile ? 132 : 168;

  if (Platform.OS === 'web') {
    const TowerDots = ({ side }: { side: 'left' | 'right' }) => (
      <div
        className="cl-tower-dots"
        style={side === 'left' ? { left: isMobile ? 14 : 36 } : { right: isMobile ? 14 : 36 }}
      >
        {Array.from({ length: 8 }).map((_, idx) => (
          <div key={idx} className="cl-tower-dot" />
        ))}
      </div>
    );

    return (
      <div className={`cl-root-web${fullScreen ? '' : ' cl-embedded'}`}>
        <div className="cl-ribbon-tl" />
        <div className="cl-ribbon-br" />
        <div className="cl-floodlight-left" />
        <div className="cl-floodlight-right" />
        <TowerDots side="left" />
        <TowerDots side="right" />
        <div className="cl-stadium-horizon" />

        {/* Centered Association Logo with Golden Halo & Orbit */}
        <div className="cl-logo-stage" style={{ width: logoSize, height: logoSize }}>
          <div className="cl-logo-aura" />
          <div className="cl-orbit-ring">
            <div className="cl-orbit-ball" />
          </div>
          <Image
            source={LOGO_ASSET}
            style={{ width: logoSize, height: logoSize }}
            resizeMode="contain"
          />
        </div>

        {/* Heading & Subtitle */}
        <div style={{ textAlign: 'center', zIndex: 3, maxWidth: 440 }}>
          <div
            style={{
              fontSize: isMobile ? 22 : 28,
              fontWeight: 900,
              fontStyle: 'italic',
              color: '#ffffff',
              letterSpacing: 0.3,
              textShadow: '0 2px 14px rgba(0,0,0,0.65)',
            }}
          >
            Getting the <span style={{ color: '#facc15' }}>Ground</span> Ready...
          </div>
          <div
            style={{
              fontSize: isMobile ? 13 : 15,
              fontStyle: 'italic',
              fontWeight: 600,
              color: '#cbd5e1',
              marginTop: 6,
            }}
          >
            {subtitle || 'Preparing your cricket experience'}
          </div>
        </div>

        {/* Golden Loading Bar with Rolling Red Cricket Ball */}
        <div className="cl-track-wrap">
          <div className="cl-track-bar">
            <div className="cl-track-trail" />
          </div>
          <div className="cl-ball-runner">
            <div className="cl-ball-sphere">
              <div className="cl-ball-seam" />
            </div>
          </div>
        </div>

        {/* Bottom Motto */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            zIndex: 3,
            marginTop: 4,
          }}
        >
          <div
            style={{
              width: isMobile ? 220 : 300,
              height: 1.5,
              background: 'linear-gradient(90deg, transparent, rgba(250, 204, 21, 0.85), transparent)',
            }}
          />
          <div
            style={{
              fontSize: isMobile ? 10 : 11.5,
              fontWeight: 800,
              color: '#facc15',
              letterSpacing: isMobile ? 2 : 3,
              textAlign: 'center',
              textShadow: '0 0 10px rgba(250, 204, 21, 0.35)',
            }}
          >
            PASSION • PERFORMANCE • SPORTSMANSHIP
          </div>
        </div>
      </div>
    );
  }

  // Native iOS / Android Animated Fallback
  const trackWidth = Math.min(340, width - 56);
  const ballTranslateX = ballProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-12, trackWidth - 18],
  });
  const ballRotate = ballProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '720deg'],
  });
  const trailWidth = ballProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, trackWidth],
  });
  const auraScale = logoPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1.07],
  });

  return (
    <View style={[styles.nativeRoot, !fullScreen && styles.nativeEmbedded]}>
      <View style={styles.nativeFloodlightLeft} />
      <View style={styles.nativeFloodlightRight} />

      <View style={[styles.nativeLogoStage, { width: logoSize + 24, height: logoSize + 24 }]}>
        <Animated.View
          style={[
            styles.nativeAura,
            { width: logoSize + 22, height: logoSize + 22, borderRadius: (logoSize + 22) / 2, transform: [{ scale: auraScale }] },
          ]}
        />
        <Image source={LOGO_ASSET} style={{ width: logoSize, height: logoSize }} resizeMode="contain" />
      </View>

      <Text style={[styles.nativeTitle, { fontSize: isMobile ? 22 : 27 }]}>
        Getting the <Text style={styles.nativeTitleGold}>Ground</Text> Ready...
      </Text>
      <Text style={styles.nativeSubtitle}>{subtitle || 'Preparing your cricket experience'}</Text>

      <View style={[styles.nativeTrackWrap, { width: trackWidth }]}>
        <View style={styles.nativeTrackBar}>
          <Animated.View style={[styles.nativeTrackTrail, { width: trailWidth }]} />
        </View>
        <Animated.View
          style={[
            styles.nativeBall,
            { transform: [{ translateX: ballTranslateX }, { rotate: ballRotate }] },
          ]}
        >
          <View style={styles.nativeBallSeam} />
        </Animated.View>
      </View>

      <View style={[styles.nativeDivider, { width: isMobile ? 210 : 280 }]} />
      <Text style={styles.nativeMotto}>PASSION • PERFORMANCE • SPORTSMANSHIP</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  nativeRoot: {
    flex: 1,
    width: '100%',
    backgroundColor: '#061533',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
    overflow: 'hidden',
  },
  nativeEmbedded: {
    minHeight: 340,
    borderRadius: 16,
  },
  nativeFloodlightLeft: {
    position: 'absolute',
    top: -40,
    left: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
  },
  nativeFloodlightRight: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
  },
  nativeLogoStage: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  nativeAura: {
    position: 'absolute',
    backgroundColor: 'rgba(250, 204, 21, 0.22)',
    borderWidth: 2,
    borderColor: 'rgba(250, 204, 21, 0.65)',
  },
  nativeTitle: {
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#ffffff',
    textAlign: 'center',
  },
  nativeTitleGold: {
    color: '#facc15',
  },
  nativeSubtitle: {
    fontSize: 13.5,
    fontStyle: 'italic',
    fontWeight: '600',
    color: '#cbd5e1',
    marginTop: 6,
    textAlign: 'center',
  },
  nativeTrackWrap: {
    height: 36,
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 20,
  },
  nativeTrackBar: {
    width: '100%',
    height: 12,
    borderRadius: 999,
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderColor: 'rgba(250, 204, 21, 0.6)',
    overflow: 'hidden',
  },
  nativeTrackTrail: {
    height: '100%',
    backgroundColor: '#facc15',
    borderRadius: 999,
  },
  nativeBall: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#dc2626',
    borderWidth: 1.5,
    borderColor: '#fef08a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nativeBallSeam: {
    width: 4,
    height: 24,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: '#ffffff',
    borderStyle: 'dashed',
  },
  nativeDivider: {
    height: 1,
    backgroundColor: 'rgba(250, 204, 21, 0.45)',
    marginBottom: 10,
  },
  nativeMotto: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#facc15',
    letterSpacing: 2,
    textAlign: 'center',
  },
});

