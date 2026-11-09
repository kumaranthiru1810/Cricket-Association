/**
 * src/admin/components/StatusBadge.tsx
 * Professional Status Badge Pill for Cricket Association Admin Panel.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export type StatusType =
  | 'ACTIVE'
  | 'APPROVED'
  | 'PENDING'
  | 'REJECTED'
  | 'INACTIVE'
  | 'SCHEDULED'
  | 'LIVE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'POSTPONED'
  | string;

interface Props {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<Props> = ({ status, label, size = 'md' }) => {
  const normalized = (status || '').toUpperCase();
  const textLabel = label || status;

  let bg = '#f1f5f9';
  let text = '#475569';
  let border = '#cbd5e1';
  let isLive = false;

  if (normalized === 'ACTIVE' || normalized === 'APPROVED' || normalized === 'PUBLISHED') {
    bg = '#ecfdf5';
    text = '#059669';
    border = '#a7f3d0';
  } else if (normalized === 'PENDING' || normalized === 'WAITING') {
    bg = '#fefce8';
    text = '#d97706';
    border = '#fde68a';
  } else if (normalized === 'REJECTED' || normalized === 'INACTIVE' || normalized === 'CANCELLED') {
    bg = '#fef2f2';
    text = '#dc2626';
    border = '#fecaca';
  } else if (normalized === 'SCHEDULED' || normalized === 'UPCOMING') {
    bg = '#eff6ff';
    text = '#2563eb';
    border = '#bfdbfe';
  } else if (normalized === 'LIVE') {
    bg = '#fff1f2';
    text = '#e11d48';
    border = '#fecdd3';
    isLive = true;
  } else if (normalized === 'COMPLETED') {
    bg = '#f8fafc';
    text = '#334155';
    border = '#cbd5e1';
  } else if (normalized === 'POSTPONED') {
    bg = '#fffbeb';
    text = '#b45309';
    border = '#fde68a';
  }

  const isSmall = size === 'sm';
  const isLarge = size === 'lg';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bg, borderColor: border },
        isSmall && styles.badgeSm,
        isLarge && styles.badgeLg
      ]}
    >
      {isLive && <View style={styles.livePulseDot} />}
      <Text
        style={[
          styles.badgeText,
          { color: text },
          isSmall && styles.badgeTextSm,
          isLarge && styles.badgeTextLg
        ]}
      >
        {textLabel}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start'
  },
  badgeSm: {
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: 4
  },
  badgeLg: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  badgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.3
  },
  badgeTextSm: {
    fontSize: 10
  },
  badgeTextLg: {
    fontSize: 13
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e11d48',
    marginRight: 5
  }
});

export default StatusBadge;
