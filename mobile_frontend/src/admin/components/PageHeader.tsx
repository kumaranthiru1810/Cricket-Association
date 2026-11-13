/**
 * src/admin/components/PageHeader.tsx
 * Standard Page Header for Cricket Association Admin Panel.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRightIcon } from './Icons';

export interface BreadcrumbItem {
  label: string;
  link?: string;
  onPress?: () => void;
}

interface Props {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<Props> = ({
  title,
  subtitle,
  breadcrumbs = [{ label: 'Admin' }, { label: title }],
  actions
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.titleArea}>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <View style={styles.breadcrumbRow}>
            {breadcrumbs.map((item, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <View key={idx} style={styles.breadcrumbItem}>
                  {idx > 0 && <ChevronRightIcon size={12} color="#94a3b8" style={{ marginHorizontal: 4 }} />}
                  {item.onPress && !isLast ? (
                    <TouchableOpacity onPress={item.onPress}>
                      <Text style={styles.breadcrumbLink}>{item.label}</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={[styles.breadcrumbText, isLast && styles.breadcrumbActive]}>
                      {item.label}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      {actions && <View style={styles.actionsArea}>{actions}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24
  },
  titleArea: {
    flex: 1,
    minWidth: 200
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  breadcrumbText: {
    fontSize: 12,
    color: '#64748b'
  },
  breadcrumbLink: {
    fontSize: 12,
    color: '#0f2452',
    fontWeight: '600'
  },
  breadcrumbActive: {
    color: '#0f172a',
    fontWeight: '600'
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.4
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 18
  },
  actionsArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  }
});

export default PageHeader;
