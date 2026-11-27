/**
 * src/app/+not-found.tsx
 *
 * Custom 404 / Unmatched Route screen for Expo Router.
 * Renders whenever the user navigates to a path that has no matching route.
 *
 * Design: matches the app's dark cricket-association brand (#020612 background,
 * #0d6efd primary accent, white text) instead of the default "Unmatched Route"
 * black screen.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Dimensions,
} from 'react-native';
import { router, usePathname } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_W } = Dimensions.get('window');

/** Navigate back if history exists, otherwise go home. */
function handleGoBack() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}

/** Go to the app home screen. */
function handleGoHome() {
  router.replace('/');
}

export default function NotFoundScreen() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      {/* Cricket ball icon stack — visual metaphor for "no match found" */}
      <View style={styles.iconWrapper}>
        <View style={styles.iconShadow} />
        <MaterialCommunityIcons
          name="cricket"
          size={80}
          color="#1a3a6b"
          style={styles.iconBack}
        />
        <MaterialCommunityIcons
          name="cricket"
          size={96}
          color="#0d6efd"
          style={styles.iconFront}
        />
        <View style={styles.badgeWrapper}>
          <Text style={styles.badgeText}>404</Text>
        </View>
      </View>

      {/* Headline */}
      <Text style={styles.heading}>Page Not Found</Text>

      {/* Sub-message */}
      <Text style={styles.subText}>
        Looks like this route is out of the crease!
      </Text>

      {/* Show the unmatched path */}
      <View style={styles.pathBox}>
        <MaterialCommunityIcons name="link-variant-off" size={14} color="#6c757d" />
        <Text style={styles.pathText} numberOfLines={2}>
          {pathname}
        </Text>
      </View>

      {/* Action buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.btn, styles.btnOutline]}
          onPress={handleGoBack}
          activeOpacity={0.75}
        >
          <MaterialCommunityIcons name="arrow-left" size={16} color="#0d6efd" />
          <Text style={[styles.btnText, styles.btnTextOutline]}>Go Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary]}
          onPress={handleGoHome}
          activeOpacity={0.75}
        >
          <MaterialCommunityIcons name="home" size={16} color="#ffffff" />
          <Text style={[styles.btnText, styles.btnTextPrimary]}>Home</Text>
        </TouchableOpacity>
      </View>

      {/* Footer brand line */}
      <Text style={styles.brand}>
        Cricket Association · Virudhunagar
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f2e9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },

  /* ── Icon area ─────────────────────────────────────────────── */
  iconWrapper: {
    position: 'relative',
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  iconShadow: {
    position: 'absolute',
    bottom: 0,
    width: 100,
    height: 20,
    borderRadius: 50,
    backgroundColor: 'rgba(13, 110, 253, 0.15)',
  },
  iconBack: {
    position: 'absolute',
    top: 20,
    left: 10,
    opacity: 0.5,
    transform: [{ rotate: '-15deg' }],
  },
  iconFront: {
    position: 'absolute',
  },
  badgeWrapper: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#dc3545',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },

  /* ── Text ───────────────────────────────────────────────────── */
  heading: {
    fontSize: Platform.select({ web: 36, default: 28 }),
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  subText: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
    maxWidth: 300,
  },

  /* ── Path pill ──────────────────────────────────────────────── */
  pathBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e8e3d9',
    borderWidth: 1,
    borderColor: '#d4ccbe',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 36,
    maxWidth: Math.min(SCREEN_W - 56, 400),
  },
  pathText: {
    fontSize: 12.5,
    color: '#64748b',
    fontFamily: Platform.select({ web: 'monospace', default: undefined }),
    flexShrink: 1,
  },

  /* ── Buttons ────────────────────────────────────────────────── */
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 48,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  btnPrimary: {
    backgroundColor: '#0d6efd',
    borderColor: '#0d6efd',
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderColor: '#0d6efd',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  btnTextPrimary: {
    color: '#ffffff',
  },
  btnTextOutline: {
    color: '#0d6efd',
  },

  /* ── Brand footer ───────────────────────────────────────────── */
  brand: {
    fontSize: 11,
    color: '#94877a',
    textAlign: 'center',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
