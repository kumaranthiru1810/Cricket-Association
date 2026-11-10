/**
 * PitchMap.tsx
 * Professional Top-Down 22-Yard Cricket Pitch Map Visualization
 * 
 * Compliant with broadcast analytics standards:
 * Visualizes length zones (Yorker, Full, Good Length, Short, Bouncer)
 * Visualizes line zones (Outside Off, In-Line Stumps, Down Leg)
 * Interactive delivery filtering and zone distribution percentages
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Rect, Line, Circle, Text as SvgText, G } from 'react-native-svg';

export interface PitchDelivery {
  id?: string;
  ballNumber?: string;
  length: 'YORKER' | 'FULL' | 'GOOD_LENGTH' | 'SHORT_OF_LENGTH' | 'BOUNCER';
  line: 'OUTSIDE_OFF' | 'STUMPS' | 'DOWN_LEG';
  runs: number;
  wicket?: boolean;
  extraType?: string;
  bowlerName?: string;
  batterName?: string;
  // Normalized coordinates on pitch (0-100 scale: x from -50 (off) to +50 (leg), y from 0 (batter crease) to 100 (bowler crease))
  x?: number;
  y?: number;
}

interface PitchMapProps {
  deliveries?: PitchDelivery[];
  bowlerName?: string;
  title?: string;
}

export const PitchMap: React.FC<PitchMapProps> = ({
  deliveries = [],
  bowlerName = 'Current Bowler',
  title = 'Bowler Pitch Map & Line/Length Analytics'
}) => {
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'DOTS' | 'BOUNDARIES' | 'WICKETS'>('ALL');
  const [selectedDelivery, setSelectedDelivery] = useState<PitchDelivery | null>(null);

  // Generate mock realistic deliveries if none passed
  const displayDeliveries: PitchDelivery[] = deliveries.length > 0 ? deliveries : [
    { id: 'p1', ballNumber: '0.1', length: 'GOOD_LENGTH', line: 'OUTSIDE_OFF', runs: 0, x: -18, y: 35 },
    { id: 'p2', ballNumber: '0.2', length: 'GOOD_LENGTH', line: 'STUMPS', runs: 0, x: 0, y: 38 },
    { id: 'p3', ballNumber: '0.3', length: 'FULL', line: 'OUTSIDE_OFF', runs: 4, x: -22, y: 22 },
    { id: 'p4', ballNumber: '0.4', length: 'YORKER', line: 'STUMPS', runs: 0, wicket: true, x: 2, y: 12 },
    { id: 'p5', ballNumber: '0.5', length: 'SHORT_OF_LENGTH', line: 'DOWN_LEG', runs: 1, x: 24, y: 55 },
    { id: 'p6', ballNumber: '0.6', length: 'GOOD_LENGTH', line: 'OUTSIDE_OFF', runs: 0, x: -15, y: 40 },
    { id: 'p7', ballNumber: '1.1', length: 'BOUNCER', line: 'OUTSIDE_OFF', runs: 0, x: -12, y: 72 },
    { id: 'p8', ballNumber: '1.2', length: 'FULL', line: 'STUMPS', runs: 6, x: -4, y: 18 },
    { id: 'p9', ballNumber: '1.3', length: 'GOOD_LENGTH', line: 'STUMPS', runs: 0, wicket: true, x: 1, y: 36 },
    { id: 'p10', ballNumber: '1.4', length: 'SHORT_OF_LENGTH', line: 'OUTSIDE_OFF', runs: 2, x: -20, y: 52 },
    { id: 'p11', ballNumber: '1.5', length: 'YORKER', line: 'OUTSIDE_OFF', runs: 1, x: -14, y: 10 },
    { id: 'p12', ballNumber: '1.6', length: 'GOOD_LENGTH', line: 'STUMPS', runs: 0, x: -2, y: 42 }
  ];

  const filteredDeliveries = displayDeliveries.filter(d => {
    if (selectedFilter === 'DOTS') return d.runs === 0 && !d.wicket;
    if (selectedFilter === 'BOUNDARIES') return d.runs >= 4;
    if (selectedFilter === 'WICKETS') return Boolean(d.wicket);
    return true;
  });

  // Calculate length zone percentages
  const total = displayDeliveries.length || 1;
  const yorkerCount = displayDeliveries.filter(d => d.length === 'YORKER').length;
  const fullCount = displayDeliveries.filter(d => d.length === 'FULL').length;
  const goodCount = displayDeliveries.filter(d => d.length === 'GOOD_LENGTH').length;
  const shortLengthCount = displayDeliveries.filter(d => d.length === 'SHORT_OF_LENGTH').length;
  const bouncerCount = displayDeliveries.filter(d => d.length === 'BOUNCER').length;

  const yorkerPct = Math.round((yorkerCount / total) * 100);
  const fullPct = Math.round((fullCount / total) * 100);
  const goodPct = Math.round((goodCount / total) * 100);
  const shortPct = Math.round(((shortLengthCount + bouncerCount) / total) * 100);

  // SVG dimensions
  const svgWidth = 320;
  const svgHeight = 440;
  const pitchLeft = 60;
  const pitchTop = 50;
  const pitchWidth = 200;
  const pitchHeight = 340;

  // Coordinate helper: converts normalized x (-50 to +50) and y (0 at striker to 100 at bowler) to SVG px
  const toSvgX = (nx: number) => pitchLeft + (pitchWidth / 2) + (nx * (pitchWidth / 100));
  const toSvgY = (ny: number) => pitchTop + (ny * (pitchHeight / 100));

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subTitle}>Pitch Trajectory & Release Zones • {bowlerName}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>22 YARDS</Text>
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, selectedFilter === 'ALL' && styles.filterChipActive]}
          onPress={() => setSelectedFilter('ALL')}
        >
          <Text style={[styles.filterChipText, selectedFilter === 'ALL' && styles.filterChipTextActive]}>
            All ({displayDeliveries.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, selectedFilter === 'DOTS' && styles.filterChipActive]}
          onPress={() => setSelectedFilter('DOTS')}
        >
          <Text style={[styles.filterChipText, selectedFilter === 'DOTS' && styles.filterChipTextActive]}>
            Dots ({displayDeliveries.filter(d => d.runs === 0 && !d.wicket).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, selectedFilter === 'BOUNDARIES' && styles.filterChipActive]}
          onPress={() => setSelectedFilter('BOUNDARIES')}
        >
          <Text style={[styles.filterChipText, selectedFilter === 'BOUNDARIES' && styles.filterChipTextActive]}>
            4s & 6s ({displayDeliveries.filter(d => d.runs >= 4).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, selectedFilter === 'WICKETS' && styles.filterChipActive]}
          onPress={() => setSelectedFilter('WICKETS')}
        >
          <Text style={[styles.filterChipText, selectedFilter === 'WICKETS' && styles.filterChipTextActive]}>
            Wickets ({displayDeliveries.filter(d => d.wicket).length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Pitch SVG Showcase */}
      <View style={styles.svgWrapper}>
        <Svg width={svgWidth} height={svgHeight}>
          {/* Outfield Grass Background */}
          <Rect x={0} y={0} width={svgWidth} height={svgHeight} fill="#14532d" rx={12} />
          <Rect x={8} y={8} width={svgWidth - 16} height={svgHeight - 16} fill="#166534" rx={10} />

          {/* 22-Yard Turf Pitch Strip */}
          <Rect
            x={pitchLeft}
            y={pitchTop}
            width={pitchWidth}
            height={pitchHeight}
            fill="#d4a373"
            stroke="#fef08a"
            strokeWidth={1.5}
            rx={4}
          />

          {/* Pitch Length Zones Horizontal Bands */}
          {/* Yorker Zone: 0% to 15% */}
          <Rect x={pitchLeft} y={pitchTop} width={pitchWidth} height={pitchHeight * 0.15} fill="rgba(239, 68, 68, 0.18)" />
          <Line x1={pitchLeft} y1={pitchTop + pitchHeight * 0.15} x2={pitchLeft + pitchWidth} y2={pitchTop + pitchHeight * 0.15} stroke="rgba(255,255,255,0.4)" strokeDasharray="3,3" />

          {/* Full Zone: 15% to 30% */}
          <Rect x={pitchLeft} y={pitchTop + pitchHeight * 0.15} width={pitchWidth} height={pitchHeight * 0.15} fill="rgba(249, 115, 22, 0.18)" />
          <Line x1={pitchLeft} y1={pitchTop + pitchHeight * 0.30} x2={pitchLeft + pitchWidth} y2={pitchTop + pitchHeight * 0.30} stroke="rgba(255,255,255,0.4)" strokeDasharray="3,3" />

          {/* Good Length Zone: 30% to 50% */}
          <Rect x={pitchLeft} y={pitchTop + pitchHeight * 0.30} width={pitchWidth} height={pitchHeight * 0.20} fill="rgba(16, 185, 129, 0.24)" />
          <Line x1={pitchLeft} y1={pitchTop + pitchHeight * 0.50} x2={pitchLeft + pitchWidth} y2={pitchTop + pitchHeight * 0.50} stroke="rgba(255,255,255,0.4)" strokeDasharray="3,3" />

          {/* Short of Length Zone: 50% to 70% */}
          <Rect x={pitchLeft} y={pitchTop + pitchHeight * 0.50} width={pitchWidth} height={pitchHeight * 0.20} fill="rgba(59, 130, 246, 0.18)" />
          <Line x1={pitchLeft} y1={pitchTop + pitchHeight * 0.70} x2={pitchLeft + pitchWidth} y2={pitchTop + pitchHeight * 0.70} stroke="rgba(255,255,255,0.4)" strokeDasharray="3,3" />

          {/* Short / Bouncer Zone: 70% to 100% */}
          <Rect x={pitchLeft} y={pitchTop + pitchHeight * 0.70} width={pitchWidth} height={pitchHeight * 0.30} fill="rgba(139, 92, 246, 0.18)" />

          {/* Pitch Creases & Markings */}
          {/* Striker Popping Crease */}
          <Line x1={pitchLeft - 12} y1={pitchTop + 24} x2={pitchLeft + pitchWidth + 12} y2={pitchTop + 24} stroke="#ffffff" strokeWidth={2} />
          {/* Striker Bowling Crease */}
          <Line x1={pitchLeft} y1={pitchTop + 8} x2={pitchLeft + pitchWidth} y2={pitchTop + 8} stroke="rgba(255,255,255,0.7)" strokeWidth={1.5} />

          {/* Stumps - Striker's End */}
          <Circle cx={pitchLeft + pitchWidth / 2 - 6} cy={pitchTop + 8} r={3} fill="#fbbf24" stroke="#78350f" strokeWidth={0.8} />
          <Circle cx={pitchLeft + pitchWidth / 2} cy={pitchTop + 8} r={3} fill="#fbbf24" stroke="#78350f" strokeWidth={0.8} />
          <Circle cx={pitchLeft + pitchWidth / 2 + 6} cy={pitchTop + 8} r={3} fill="#fbbf24" stroke="#78350f" strokeWidth={0.8} />
          {/* Bails */}
          <Line x1={pitchLeft + pitchWidth / 2 - 8} y1={pitchTop + 7} x2={pitchLeft + pitchWidth / 2 + 8} y2={pitchTop + 7} stroke="#451a03" strokeWidth={1.5} />

          {/* Bowler End Crease & Stumps */}
          <Line x1={pitchLeft - 12} y1={pitchTop + pitchHeight - 24} x2={pitchLeft + pitchWidth + 12} y2={pitchTop + pitchHeight - 24} stroke="#ffffff" strokeWidth={2} />
          <Line x1={pitchLeft} y1={pitchTop + pitchHeight - 8} x2={pitchLeft + pitchWidth} y2={pitchTop + pitchHeight - 8} stroke="rgba(255,255,255,0.7)" strokeWidth={1.5} />
          <Circle cx={pitchLeft + pitchWidth / 2 - 6} cy={pitchTop + pitchHeight - 8} r={3} fill="#fbbf24" stroke="#78350f" strokeWidth={0.8} />
          <Circle cx={pitchLeft + pitchWidth / 2} cy={pitchTop + pitchHeight - 8} r={3} fill="#fbbf24" stroke="#78350f" strokeWidth={0.8} />
          <Circle cx={pitchLeft + pitchWidth / 2 + 6} cy={pitchTop + pitchHeight - 8} r={3} fill="#fbbf24" stroke="#78350f" strokeWidth={0.8} />

          {/* Zone Text Labels (Left Margins) */}
          <SvgText x={8} y={pitchTop + pitchHeight * 0.08} fill="#fca5a5" fontSize="8" fontWeight="bold">YORKER</SvgText>
          <SvgText x={8} y={pitchTop + pitchHeight * 0.23} fill="#fdba74" fontSize="8" fontWeight="bold">FULL</SvgText>
          <SvgText x={8} y={pitchTop + pitchHeight * 0.40} fill="#86efac" fontSize="8" fontWeight="bold">GOOD</SvgText>
          <SvgText x={8} y={pitchTop + pitchHeight * 0.60} fill="#93c5fd" fontSize="8" fontWeight="bold">SHORT</SvgText>
          <SvgText x={8} y={pitchTop + pitchHeight * 0.85} fill="#d8b4fe" fontSize="8" fontWeight="bold">BOUNCER</SvgText>

          {/* End Labels */}
          <SvgText x={pitchLeft + pitchWidth / 2} y={pitchTop - 8} fill="#ffffff" fontSize="9" fontWeight="900" textAnchor="middle">
            BATTER END (STRIKER)
          </SvgText>
          <SvgText x={pitchLeft + pitchWidth / 2} y={pitchTop + pitchHeight + 18} fill="#ffffff" fontSize="9" fontWeight="900" textAnchor="middle">
            BOWLER END (RELEASE)
          </SvgText>

          {/* Delivery Landing Balls */}
          {filteredDeliveries.map((del, idx) => {
            const cx = toSvgX(del.x ?? 0);
            const cy = toSvgY(del.y ?? 40);

            let ballFill = '#ffffff';
            let strokeColor = '#0f172a';
            let radius = 6;

            if (del.wicket) {
              ballFill = '#dc2626';
              strokeColor = '#fef08a';
              radius = 8;
            } else if (del.runs >= 6) {
              ballFill = '#9333ea';
              strokeColor = '#ffffff';
              radius = 7.5;
            } else if (del.runs === 4) {
              ballFill = '#16a34a';
              strokeColor = '#ffffff';
              radius = 7;
            } else if (del.runs > 0) {
              ballFill = '#eab308';
              strokeColor = '#451a03';
            }

            const isSelected = selectedDelivery?.id === del.id;

            return (
              <G key={del.id || `ball-${idx}`}>
                {isSelected && (
                  <Circle cx={cx} cy={cy} r={radius + 4} fill="none" stroke="#38bdf8" strokeWidth={2.5} />
                )}
                {del.wicket && (
                  <Circle cx={cx} cy={cy} r={radius + 2} fill="rgba(239, 68, 68, 0.45)" />
                )}
                <Circle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill={ballFill}
                  stroke={strokeColor}
                  strokeWidth={1.5}
                />
                <SvgText
                  x={cx}
                  y={cy + 3}
                  fill={del.wicket || del.runs >= 4 ? '#ffffff' : '#0f172a'}
                  fontSize="7"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {del.wicket ? 'W' : del.runs}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>

      {/* Length Zone Distribution Cards */}
      <View style={styles.statsCard}>
        <Text style={styles.statsCardTitle}>🎯 Length Distribution Percentage</Text>
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { borderColor: '#10b981', backgroundColor: '#ecfdf5' }]}>
            <Text style={[styles.statPct, { color: '#059669' }]}>{goodPct}%</Text>
            <Text style={styles.statLabel}>Good Length</Text>
            <Text style={styles.statSub}>{goodCount} balls</Text>
          </View>
          <View style={[styles.statBox, { borderColor: '#f97316', backgroundColor: '#fff7ed' }]}>
            <Text style={[styles.statPct, { color: '#ea580c' }]}>{fullPct}%</Text>
            <Text style={styles.statLabel}>Full / Slot</Text>
            <Text style={styles.statSub}>{fullCount} balls</Text>
          </View>
          <View style={[styles.statBox, { borderColor: '#ef4444', backgroundColor: '#fef2f2' }]}>
            <Text style={[styles.statPct, { color: '#dc2626' }]}>{yorkerPct}%</Text>
            <Text style={styles.statLabel}>Yorker</Text>
            <Text style={styles.statSub}>{yorkerCount} balls</Text>
          </View>
          <View style={[styles.statBox, { borderColor: '#3b82f6', backgroundColor: '#eff6ff' }]}>
            <Text style={[styles.statPct, { color: '#2563eb' }]}>{shortPct}%</Text>
            <Text style={styles.statLabel}>Short / Bounce</Text>
            <Text style={styles.statSub}>{shortLengthCount + bouncerCount} balls</Text>
          </View>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#ffffff', borderColor: '#475569' }]} />
          <Text style={styles.legendText}>Dot Ball (0)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#eab308' }]} />
          <Text style={styles.legendText}>1-3 Runs</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#16a34a' }]} />
          <Text style={styles.legendText}>Four (4)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#9333ea' }]} />
          <Text style={styles.legendText}>Six (6)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#dc2626' }]} />
          <Text style={styles.legendText}>Wicket (W)</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#fde047',
    padding: 16,
    marginVertical: 12,
    shadowColor: '#b45309',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#fef08a',
    paddingBottom: 10
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
    color: '#92400e',
    letterSpacing: 0.3
  },
  subTitle: {
    fontSize: 11,
    color: '#a16207',
    fontWeight: '600',
    marginTop: 2
  },
  badge: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#92400e'
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    flexWrap: 'wrap'
  },
  filterChip: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8
  },
  filterChipActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b'
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b'
  },
  filterChipTextActive: {
    color: '#b45309'
  },
  svgWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8
  },
  statsCard: {
    marginTop: 14,
    backgroundColor: '#fafaf9',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f5f5f4'
  },
  statsCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 8
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6
  },
  statBox: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center'
  },
  statPct: {
    fontSize: 14,
    fontWeight: '900'
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#334155',
    marginTop: 2
  },
  statSub: {
    fontSize: 9,
    color: '#64748b'
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
    flexWrap: 'wrap'
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  legendText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569'
  }
});

export default PitchMap;
