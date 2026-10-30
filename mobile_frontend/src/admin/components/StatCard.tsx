/**
 * src/admin/components/StatCard.tsx
 * Metric KPI Card for Cricket Association Professional Admin Panel.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface Props {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  subtitle?: string;
  trend?: string;
  trendPositive?: boolean;
  accentColor?: string;
  onPress?: () => void;
}

export const StatCard: React.FC<Props> = ({
  title,
  value,
  icon,
  subtitle,
  trend,
  trendPositive = true,
  accentColor = '#0f2452',
  onPress
}) => {
  const CardContainer: any = onPress ? TouchableOpacity : View;

  return (
    <CardContainer
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
    >
      <View style={styles.topRow}>
        <View style={styles.textBlock}>
          <Text style={styles.title}>{title}</Text>
          <Text style={[styles.value, { color: accentColor }]}>{value}</Text>
        </View>
        <View style={[styles.iconWrapper, { backgroundColor: `${accentColor}12` }]}>
          {icon}
        </View>
      </View>

      <View style={styles.bottomRow}>
        {trend && (
          <View
            style={[
              styles.trendBadge,
              { backgroundColor: trendPositive ? '#ecfdf5' : '#fef2f2' }
            ]}
          >
            <Text
              style={[
                styles.trendText,
                { color: trendPositive ? '#059669' : '#dc2626' }
              ]}
            >
              {trend}
            </Text>
          </View>
        )}
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
    </CardContainer>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    flex: 1,
    minWidth: 200,
    justifyContent: 'space-between'
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  textBlock: {
    flex: 1
  },
  title: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2
  },
  trendBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4
  },
  trendText: {
    fontSize: 11,
    fontWeight: '700'
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8'
  }
});

export default StatCard;
