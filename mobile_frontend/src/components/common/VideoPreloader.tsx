import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  useWindowDimensions
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';

const LOCAL_PRELOADER_VIDEO = require('../../../assets/videos/preloader.mp4');

interface NativeVideoComponentProps {
  onProgress: (pct: number) => void;
  onEnded: () => void;
  contentFit?: 'contain' | 'cover';
}

function NativeVideoComponent({ onProgress, onEnded, contentFit = 'contain' }: NativeVideoComponentProps) {
  const player = useVideoPlayer(LOCAL_PRELOADER_VIDEO, (p) => {
    p.loop = false;
    p.muted = false;
    p.volume = 1.0;
    p.timeUpdateEventInterval = 0.1;
    p.play();
  });

  useEffect(() => {
    const timeSub = player.addListener('timeUpdate', (event) => {
      if (player.duration) {
        const pct = (event.currentTime / player.duration) * 100;
        onProgress(Math.min(100, pct));
        // Cinematic synchronization: reveal website at video climax
        if (event.currentTime >= Math.max(player.duration - 0.4, 0)) {
          onEnded();
        }
      }
    });

    const endSub = player.addListener('playToEnd', () => {
      onEnded();
    });

    const statusSub = (player as any).addListener?.('statusChange', (event: any) => {
      if (event?.status === 'error') {
        onEnded();
      }
    });

    return () => {
      timeSub.remove();
      endSub.remove();
      if (statusSub) statusSub.remove();
    };
  }, [player, onProgress, onEnded]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit={contentFit}
      nativeControls={false}
    />
  );
}

interface VideoPreloaderProps {
  onComplete?: () => void;
  autoPlay?: boolean;
}

export default function VideoPreloader({ onComplete }: VideoPreloaderProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isMobile = width < 768 || width < height;
  const isNarrow = width < 420;

  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const webVideoRef = useRef<HTMLVideoElement | null>(null);

  const handleDismiss = (immediate = false) => {
    if (isDismissed) return;
    setIsDismissed(true);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('cfvd_preloader_seen', 'true');
        if ((window as any).__dismissCfvdPreloader) {
          (window as any).__dismissCfvdPreloader(immediate);
        }
      } catch (_e) {}
    }

    if (immediate) {
      if (onComplete) onComplete();
      return;
    }

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(scaleAnim, {
        toValue: 1.14,
        duration: 800,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.sequence([
        Animated.timing(flashAnim, {
          toValue: 0.95,
          duration: 220,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(flashAnim, {
          toValue: 0,
          duration: 580,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    ]).start(() => {
      if (onComplete) onComplete();
    });
  };

  useEffect(() => {
    // Safety auto-dismiss fallback after 10.5 seconds
    const timer = setTimeout(() => {
      handleDismiss();
    }, 10500);

    // Try unmuted audio on web immediately, register gesture listeners if blocked
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      const activateSound = () => {
        if (webVideoRef.current) {
          webVideoRef.current.muted = false;
          webVideoRef.current.volume = 1.0;
          if (webVideoRef.current.paused) {
            webVideoRef.current.play().catch(() => {});
          }
        }
        setShowHint(false);
      };

      const events = ['click', 'touchstart', 'pointerdown', 'keydown'];
      events.forEach((evt) => {
        window.addEventListener(evt, activateSound, { capture: true, once: true });
      });

      if (webVideoRef.current) {
        webVideoRef.current.muted = false;
        webVideoRef.current.volume = 1.0;
        const playPromise = webVideoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            if (webVideoRef.current) {
              webVideoRef.current.muted = true;
              webVideoRef.current.play().catch(() => {});
              setShowHint(true);
            }
          });
        }
      }

      return () => {
        clearTimeout(timer);
        events.forEach((evt) => {
          window.removeEventListener(evt, activateSound, true);
        });
      };
    }

    return () => clearTimeout(timer);
  }, []);

  const handleTimeUpdate = (e: any) => {
    const video = e.target;
    if (video && video.duration) {
      const pct = (video.currentTime / video.duration) * 100;
      setProgress(Math.min(100, pct));
      // Exact synchronization: trigger website reveal at 6.9s when bails lock in with sound
      if (video.currentTime >= 6.9) {
        handleDismiss();
      }
    }
  };

  if (isDismissed) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <StatusBar style="light" />

      {/* Main Video Presentation - 100% Contained, Nothing Hidden */}
      <TouchableOpacity
        style={styles.videoWrapper}
        activeOpacity={1}
        onPress={() => handleDismiss()}
        // @ts-ignore
        onClick={() => handleDismiss()}
      >
        {Platform.OS === 'web' ? (
          <>
            <video
              autoPlay
              muted
              loop
              playsInline
              // @ts-ignore
              webkit-playsinline="true"
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center center',
                filter: 'blur(35px) brightness(0.4) saturate(1.4)',
                transform: 'scale(1.15)',
                pointerEvents: 'none',
                zIndex: 0,
              }}
              src="/preloader.mp4"
            />
            <video
              ref={webVideoRef}
              autoPlay
              muted
              playsInline
              // @ts-ignore
              webkit-playsinline="true"
              preload="auto"
              style={{
                width: '100%',
                height: '100%',
                maxWidth: '100vw',
                maxHeight: '100vh',
                objectFit: 'contain',
                objectPosition: 'center center',
                backgroundColor: 'transparent',
                zIndex: 1,
              }}
              src="/preloader.mp4"
              onEnded={() => handleDismiss()}
              onTimeUpdate={handleTimeUpdate}
            />
          </>
        ) : (
          <NativeVideoComponent
            onProgress={(pct) => setProgress(pct)}
            onEnded={() => handleDismiss()}
            contentFit="contain"
          />
        )}
      </TouchableOpacity>

      {/* Bottom Title & Synchronized Golden Progress Line */}
      <View style={[styles.bottomBar, isNarrow && { bottom: 10, left: 10, right: 10 }]}>
        <Text style={[styles.bottomSubtitle, isNarrow && { fontSize: 9, letterSpacing: 0.5 }]}>
          VIRUDHUNAGAR DISTRICT CRICKET ASSOCIATION • OFFICIAL PORTAL
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
        </View>
      </View>

      {/* Stadium Flash Overlay during dismiss transition */}
      <Animated.View
        style={[
          styles.flashOverlay,
          {
            opacity: flashAnim,
            pointerEvents: 'none' as any,
          },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#020612',
    zIndex: 999999,
    justifyContent: 'center',
    alignItems: 'center'
  },
  videoWrapper: {
    width: '100%',
    height: '100%',
    backgroundColor: '#020612',
    justifyContent: 'center',
    alignItems: 'center'
  },
  webView: {
    width: '100%',
    height: '100%',
    backgroundColor: '#020612'
  },
  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(251, 191, 36, 0.7)',
    zIndex: 9999999
  },
  bottomBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 36 : 18,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 10
  },
  bottomSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
    textAlign: 'center'
  },
  progressTrack: {
    width: '100%',
    maxWidth: 480,
    height: 3.5,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 3,
    overflow: 'hidden'
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 3
  }
});

