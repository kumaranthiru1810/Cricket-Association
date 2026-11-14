import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { VPLEvent } from '../../utils/vplEventMapper';
import { vplSound, type VPLSoundRole, type VPLSoundState } from '../../utils/vplSoundEngine';

// ── Theme ──────────────────────────────────────────────────────────────
const C = {
  green900: '#06281E',
  green700: '#0A3D2A',
  gold: '#D4A72C',
  maroon: '#5E1020',
  ivory: '#FFF6DC',
  amber: '#F2A81D',
  white: '#FFFFFF',
  dimGray: 'rgba(0,0,0,0.6)',
} as const;

// Kolam border: repeating diamond+dot pattern drawn as a thin View strip
function KolamBorder({ horizontal = true }: { horizontal?: boolean }) {
  const count = 12;
  return (
    <View style={[styles.kolamStrip, horizontal ? styles.kolamH : styles.kolamV]}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.kolamCell}>
          <View style={styles.kolamDiamond} />
          <View style={styles.kolamDot} />
        </View>
      ))}
    </View>
  );
}

// ── Tier styles ────────────────────────────────────────────────────────
function getTierStyle(tier: VPLEvent['tier']): {
  container: StyleProp<ViewStyle>;
  titleSize: number;
  position: 'bottom' | 'center';
} {
  switch (tier) {
    case 1:
      return { container: styles.tier1, titleSize: 13, position: 'bottom' };
    case 2:
      return { container: styles.tier2, titleSize: 20, position: 'center' };
    case 3:
      return { container: styles.tier3, titleSize: 26, position: 'center' };
    case 4:
      return { container: styles.tier4, titleSize: 22, position: 'center' };
    case 5:
      return { container: styles.tier5, titleSize: 24, position: 'center' };
    case 'extra':
      return { container: styles.tierExtra, titleSize: 18, position: 'center' };
    default:
      return { container: styles.tier1, titleSize: 13, position: 'bottom' };
  }
}

// ── Ball flight animation (SIX) ────────────────────────────────────────
function BallFlight() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [anim]);
  const left = anim.interpolate({ inputRange: [0, 1], outputRange: ['5%', '90%'] });
  const bottom = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [8, 60, 8] });
  return (
    <Animated.View style={[styles.ball, { left, bottom, pointerEvents: 'none' as const }]}>
      <Text style={{ fontSize: 18 }}>🏏</Text>
    </Animated.View>
  );
}

// ── Main Banner ────────────────────────────────────────────────────────
interface VPLEventBannerProps {
  role: VPLSoundRole;
  events: VPLEvent[] | null;
  skipInitial?: boolean;
  onImpact?: (event: VPLEvent) => void;
  topOffset?: number;
  bottomOffset?: number;
  style?: StyleProp<ViewStyle>;
}

export function VPLEventBanner({
  role,
  events,
  skipInitial = false,
  onImpact,
  topOffset = 0,
  bottomOffset = 80,
  style,
}: VPLEventBannerProps) {
  const [queue, setQueue] = useState<VPLEvent[]>([]);
  const [current, setCurrent] = useState<VPLEvent | null>(null);
  const seenIds = useRef(new Set<string>());
  const isFirst = useRef(true);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Configure sound engine
  useEffect(() => {
    vplSound.configure(role);
  }, [role]);

  // Ingest new events into queue
  useEffect(() => {
    if (!events || events.length === 0) return;
    if (isFirst.current && skipInitial) {
      isFirst.current = false;
      return;
    }
    isFirst.current = false;
    setQueue(prev => {
      const newEvents = events.filter(e => !seenIds.current.has(e.id));
      newEvents.forEach(e => seenIds.current.add(e.id));
      if (newEvents.length === 0) return prev;
      const hasImportant = newEvents.some(e => e.tier !== 1);
      const filtered = hasImportant
        ? [...prev.filter(e => e.tier !== 1), ...newEvents]
        : [...prev, ...newEvents];
      return filtered;
    });
  }, [events, skipInitial]);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => setCurrent(null));
  }, [slideAnim]);

  // Show next from queue
  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setCurrent(next);
    if (next.sound) vplSound.play(next.sound);
    if (next.shake && role === 'public') {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(shakeAnim, { toValue: 5, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    }
    Animated.spring(slideAnim, {
      toValue: 1,
      tension: 80,
      friction: 8,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    onImpact?.(next);
    timerRef.current = setTimeout(() => dismiss(), next.durationMs);
  }, [current, queue, role, dismiss, slideAnim, shakeAnim, onImpact]);

  if (!current) return null;
  const { container: tierContainer, titleSize, position } = getTierStyle(current.tier);
  const isBottom = position === 'bottom';

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isBottom ? 50 : -80, 0],
  });

  return (
    <Animated.View
      style={[
        styles.wrapper,
        isBottom ? { bottom: bottomOffset } : { top: topOffset + 60 },
        { transform: [{ translateY }, { translateX: shakeAnim }], opacity: slideAnim, pointerEvents: 'box-none' as const },
        style,
      ]}
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.bannerInner, tierContainer]}>
        <KolamBorder horizontal />
        <View style={styles.bannerBody}>
          {/* Left: title + detail */}
          <View style={styles.bannerLeft}>
            <Text style={[styles.titleText, { fontSize: titleSize }]}>
              {current.titleEn}
            </Text>
            {current.titleTa && current.tier !== 1 && (
              <Text style={styles.tamilText}>{current.titleTa}</Text>
            )}
            {current.detail && (
              <Text style={styles.detailText}>{current.detail}</Text>
            )}
          </View>
          {/* Right: batter/stats */}
          {current.primary && (
            <View style={styles.bannerRight}>
              <Text style={styles.primaryText} numberOfLines={1}>{current.primary}</Text>
              {current.secondary && (
                <Text style={styles.secondaryText}>{current.secondary}</Text>
              )}
            </View>
          )}
          {/* Dismiss */}
          <Pressable onPress={dismiss} style={styles.dismissBtn} accessibilityLabel="Dismiss">
            <Text style={styles.dismissText}>✕</Text>
          </Pressable>
        </View>
        {current.kind === 'six' && <BallFlight />}
        <KolamBorder horizontal />
      </View>
    </Animated.View>
  );
}

// ── Sound Controls ────────────────────────────────────────────────────
export function useVPLSound() {
  const state = useSyncExternalStore(vplSound.subscribe, vplSound.getState, vplSound.getState);
  const toggle = useCallback(() => {
    vplSound.setMuted(!vplSound.getState().muted);
  }, []);
  const setVolume = useCallback((v: number) => {
    vplSound.setVolume(v);
  }, []);
  const unlock = useCallback((play: boolean) => {
    vplSound.unlock(play);
  }, []);

  return {
    state,
    toggle,
    setVolume,
    unlock,
  };
}

interface VPLSoundControlsProps {
  role: VPLSoundRole;
  style?: StyleProp<ViewStyle>;
}

export function VPLSoundControls({ role, style }: VPLSoundControlsProps) {
  useEffect(() => {
    vplSound.configure(role);
  }, [role]);

  const { state, toggle, unlock } = useVPLSound();

  if (!state.supported) return null;

  if (!state.unlocked && role === 'public') {
    return (
      <Pressable onPress={() => unlock(true)} style={[styles.unlockPrompt, style]}>
        <Text style={styles.unlockText}>🔇 Tap to enable sound</Text>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={toggle} style={[styles.muteBtn, style]} accessibilityLabel={state.muted ? 'Unmute' : 'Mute'}>
      <Text style={styles.muteText}>{state.muted ? '🔇' : '🔊'}</Text>
    </Pressable>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
  },
  bannerInner: {
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  bannerBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  bannerLeft: { flex: 1 },
  bannerRight: { alignItems: 'flex-end', maxWidth: 110 },
  tier1: { backgroundColor: 'rgba(6,40,30,0.88)' },
  tier2: { backgroundColor: C.green900, borderWidth: 1.5, borderColor: C.gold },
  tier3: { backgroundColor: C.green900, borderWidth: 2, borderColor: C.gold },
  tier4: { backgroundColor: C.maroon, borderWidth: 2, borderColor: '#FF4444' },
  tier5: { backgroundColor: C.green700, borderWidth: 2, borderColor: C.gold },
  tierExtra: { backgroundColor: '#7A4800', borderWidth: 1.5, borderColor: C.amber },
  titleText: { color: C.gold, fontWeight: '800', letterSpacing: 1.2 },
  tamilText: { color: C.ivory, fontSize: 12, marginTop: 1, opacity: 0.9 },
  detailText: { color: C.ivory, fontSize: 11, marginTop: 3, opacity: 0.8 },
  primaryText: { color: C.white, fontWeight: '700', fontSize: 13 },
  secondaryText: { color: C.gold, fontSize: 12, marginTop: 2 },
  kolamStrip: { backgroundColor: 'transparent', overflow: 'hidden' },
  kolamH: { flexDirection: 'row', height: 6 },
  kolamV: { flexDirection: 'column', width: 6 },
  kolamCell: { flexDirection: 'row', alignItems: 'center', marginRight: 2 },
  kolamDiamond: { width: 5, height: 5, backgroundColor: C.gold, transform: [{ rotate: '45deg' }], opacity: 0.7 },
  kolamDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.ivory, marginLeft: 2, opacity: 0.5 },
  ball: { position: 'absolute', zIndex: 10 },
  dismissBtn: { padding: 6, marginLeft: 4 },
  dismissText: { color: C.ivory, opacity: 0.7, fontSize: 14 },
  muteBtn: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20, padding: 8 },
  muteText: { fontSize: 16 },
  unlockPrompt: { backgroundColor: C.maroon, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'center' },
  unlockText: { color: C.white, fontSize: 13 },
});

