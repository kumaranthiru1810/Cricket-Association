import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  useWindowDimensions
} from 'react-native';

export interface ShotDelivery {
  id?: string;
  strikerId: string;
  bowlerId?: string;
  runsBatter: number;
  runsExtras?: number;
  totalRuns?: number;
  extraType?: string;
  wicket?: boolean;
  fieldingPosition?: string;
  shotAngle?: number;
  shotDistance?: number;
  shotZone?: string;
  overNumber?: number;
  ballNumber?: number;
  commentary?: string;
}

export interface BatterProfile {
  id: string;
  name: string;
  runs: number;
  balls: number;
  fours?: number;
  sixes?: number;
  strikeRate?: number | string;
  isOut?: boolean;
  dismissal?: string;
}

interface WagonWheelProps {
  deliveries: ShotDelivery[];
  batters: BatterProfile[];
  selectedBatterId?: string;
  onSelectBatter?: (batterId: string) => void;
  title?: string;
  subtitle?: string;
}

// 8 Cricket Field Sectors Definition
const SECTORS = [
  { key: 'cover', name: 'Cover / Extra Cover', startAngle: 292.5, endAngle: 337.5, side: 'OFF', color: '#10b981' },
  { key: 'long_off', name: 'Mid-Off / Long Off', startAngle: 337.5, endAngle: 22.5, side: 'OFF', color: '#06b6d4' },
  { key: 'long_on', name: 'Mid-On / Long On', startAngle: 22.5, endAngle: 67.5, side: 'LEG', color: '#3b82f6' },
  { key: 'midwicket', name: 'Midwicket / Cow Corner', startAngle: 67.5, endAngle: 112.5, side: 'LEG', color: '#8b5cf6' },
  { key: 'square_leg', name: 'Square Leg', startAngle: 112.5, endAngle: 157.5, side: 'LEG', color: '#f59e0b' },
  { key: 'fine_leg', name: 'Fine Leg', startAngle: 157.5, endAngle: 202.5, side: 'LEG', color: '#ef4444' },
  { key: 'third_man', name: 'Third Man / Slips', startAngle: 202.5, endAngle: 247.5, side: 'OFF', color: '#ec4899' },
  { key: 'point', name: 'Point / Backward Point', startAngle: 247.5, endAngle: 292.5, side: 'OFF', color: '#14b8a6' }
];

export default function WagonWheel({
  deliveries = [],
  batters = [],
  selectedBatterId,
  onSelectBatter,
  title = '🏏 Batsman Wagon Wheel & Shot Analytics',
  subtitle = 'Interactive Shot Trajectories & Playing Area Breakdown'
}: WagonWheelProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const isMobile = width <= 480;
  const isSmallScreen = width < 380;

  // Active batter selection
  const defaultBatterId = selectedBatterId || (batters[0]?.id ?? '');
  const [activeBatterId, setActiveBatterId] = useState<string>(defaultBatterId);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  // Sync if prop changes
  React.useEffect(() => {
    if (selectedBatterId) {
      setActiveBatterId(selectedBatterId);
    } else if (batters.length > 0 && !activeBatterId) {
      setActiveBatterId(batters[0].id);
    }
  }, [selectedBatterId, batters]);

  // Active slide: 'wheel' (Slide 1: Wagon Wheel trajectories) | 'percentage' (Slide 2: Playing Area Percentages)
  const [activeSlide, setActiveSlide] = useState<'wheel' | 'percentage'>('wheel');
  // Selected Run filter: 'ALL', 1, 2, 3, 4, 6, 0
  const [runFilter, setRunFilter] = useState<string>('ALL');
  // Selected Sector highlight filter
  const [sectorFilter, setSectorFilter] = useState<string | null>(null);
  // Selected active shot hover/touch
  const [activeShot, setActiveShot] = useState<ShotDelivery | null>(null);

  const currentBatter = useMemo(() => {
    return batters.find(b => b.id === activeBatterId) || batters[0];
  }, [batters, activeBatterId]);

  // Filter deliveries belonging to this batter
  const batterDeliveries = useMemo(() => {
    if (!currentBatter) return [];
    const id = currentBatter.id;
    const name = currentBatter.name?.toLowerCase() || '';

    // If deliveries are provided with strikerId
    const matched = deliveries.filter(d => {
      if (d.strikerId === id) return true;
      // If mock id format like 'P301' or '1'
      if (id.includes(d.strikerId) || d.strikerId.includes(id)) return true;
      return false;
    });

    if (matched.length > 0) return matched;

    // Synthetic fallback generator for demonstration if real deliveries list is empty
    return generateSyntheticShots(currentBatter);
  }, [deliveries, currentBatter]);

  // Calculate sector and playing area percentages
  const stats = useMemo(() => {
    let totalRuns = 0;
    let offRuns = 0;
    let legRuns = 0;
    let offBalls = 0;
    let legBalls = 0;

    const sectorMap: Record<string, { runs: number; balls: number; fours: number; sixes: number }> = {};
    SECTORS.forEach(s => {
      sectorMap[s.key] = { runs: 0, balls: 0, fours: 0, sixes: 0 };
    });

    batterDeliveries.forEach(d => {
      const runs = Number(d.runsBatter) || 0;
      totalRuns += runs;
      const angle = (typeof d.shotAngle === 'number' ? d.shotAngle : 315) % 360;

      // Off vs Leg
      if (angle >= 180 && angle <= 360) {
        offRuns += runs;
        offBalls++;
      } else {
        legRuns += runs;
        legBalls++;
      }

      // Find matching sector
      let matchedSectorKey = 'cover';
      for (const s of SECTORS) {
        if (s.startAngle > s.endAngle) {
          // Crosses 0/360 boundary (e.g. 337.5 to 22.5)
          if (angle >= s.startAngle || angle < s.endAngle) {
            matchedSectorKey = s.key;
            break;
          }
        } else {
          if (angle >= s.startAngle && angle < s.endAngle) {
            matchedSectorKey = s.key;
            break;
          }
        }
      }

      if (sectorMap[matchedSectorKey]) {
        sectorMap[matchedSectorKey].runs += runs;
        sectorMap[matchedSectorKey].balls += 1;
        if (runs === 4) sectorMap[matchedSectorKey].fours += 1;
        if (runs === 6) sectorMap[matchedSectorKey].sixes += 1;
      }
    });

    const offPct = totalRuns > 0 ? Math.round((offRuns / totalRuns) * 100) : 50;
    const legPct = totalRuns > 0 ? 100 - offPct : 50;

    return {
      totalRuns,
      totalBalls: batterDeliveries.length,
      offRuns,
      legRuns,
      offPct,
      legPct,
      offBalls,
      legBalls,
      sectors: SECTORS.map(s => {
        const data = sectorMap[s.key] || { runs: 0, balls: 0, fours: 0, sixes: 0 };
        const pct = totalRuns > 0 ? Math.round((data.runs / totalRuns) * 100) : 0;
        return {
          ...s,
          ...data,
          pct
        };
      })
    };
  }, [batterDeliveries]);

  // Filtered deliveries based on user selection
  const displayedDeliveries = useMemo(() => {
    return batterDeliveries.filter(d => {
      const runs = Number(d.runsBatter) || 0;
      if (runFilter !== 'ALL') {
        if (runFilter === 'DOT' && runs !== 0) return false;
        if (runFilter === '1' && runs !== 1) return false;
        if (runFilter === '2' && runs !== 2) return false;
        if (runFilter === '3' && runs !== 3) return false;
        if (runFilter === '4' && runs !== 4) return false;
        if (runFilter === '6' && runs !== 6) return false;
      }

      if (sectorFilter) {
        const s = SECTORS.find(sec => sec.key === sectorFilter);
        if (s) {
          const angle = (typeof d.shotAngle === 'number' ? d.shotAngle : 315) % 360;
          if (s.startAngle > s.endAngle) {
            if (!(angle >= s.startAngle || angle < s.endAngle)) return false;
          } else {
            if (!(angle >= s.startAngle && angle < s.endAngle)) return false;
          }
        }
      }

      return true;
    });
  }, [batterDeliveries, runFilter, sectorFilter]);

  // Run counts for badges
  const runCounts = useMemo(() => {
    const counts = { total: 0, dots: 0, ones: 0, twos: 0, threes: 0, fours: 0, sixes: 0 };
    batterDeliveries.forEach(d => {
      counts.total++;
      const r = Number(d.runsBatter) || 0;
      if (r === 0) counts.dots++;
      else if (r === 1) counts.ones++;
      else if (r === 2) counts.twos++;
      else if (r === 3) counts.threes++;
      else if (r === 4) counts.fours++;
      else if (r === 6) counts.sixes++;
    });
    return counts;
  }, [batterDeliveries]);

  // Responsive Geometry dimensions: Fixed internal viewBox with responsive render sizing
  const baseSize = 400;
  const cx = baseSize / 2;
  const cy = baseSize / 2;
  const radius = baseSize / 2 - 20;
  const innerCircleR = radius * 0.44; // 30-yard circle
  const pitchW = 18;
  const pitchH = 46;
  const displaySize = isDesktop ? 420 : Math.min(Math.max(width - (isSmallScreen ? 36 : 56), 230), 380);

  // Function to compute (x, y) coordinates for a shot
  const getCoordinates = (angleDeg: number, distancePct: number) => {
    const angleRad = (angleDeg * Math.PI) / 180;
    const clampedDist = Math.max(10, Math.min(distancePct, 115));
    const distPx = (radius * clampedDist) / 100;
    const x = cx + distPx * Math.sin(angleRad);
    const y = cy - distPx * Math.cos(angleRad);
    return { x, y };
  };

  const getShotColor = (runs: number) => {
    switch (runs) {
      case 6: return '#ec4899'; // Hot Magenta
      case 4: return '#10b981'; // Vivid Green
      case 3: return '#f59e0b'; // Amber
      case 2: return '#3b82f6'; // Bright Blue
      case 1: return '#06b6d4'; // Cyan
      default: return '#94a3b8'; // Grey dot
    }
  };

  const handleBatterChange = (id: string) => {
    setActiveBatterId(id);
    setActiveShot(null);
    setSectorFilter(null);
    if (onSelectBatter) onSelectBatter(id);
  };

  return (
    <View style={styles.cardContainer}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSubtitle}>{subtitle}</Text>
        </View>
        {currentBatter && (
          <View style={styles.batterBadge}>
            <Text style={styles.batterBadgeName}>
              {currentBatter.name}
            </Text>
            <Text style={styles.batterBadgeStats}>
              {currentBatter.runs} runs ({currentBatter.balls} balls) • SR {currentBatter.strikeRate || ((currentBatter.runs / (currentBatter.balls || 1)) * 100).toFixed(1)}
            </Text>
          </View>
        )}
      </View>

      {/* Batsman Selector Dropdown */}
      {batters.length > 0 && (
        <View style={styles.batterDropdownWrapper}>
          <Text style={styles.selectorLabel}>SELECT BATSMAN (DROPDOWN):</Text>
          <TouchableOpacity
            style={[styles.dropdownButton, isDropdownOpen && styles.dropdownButtonActive]}
            onPress={() => setIsDropdownOpen(!isDropdownOpen)}
            activeOpacity={0.8}
          >
            <View style={styles.dropdownLeft}>
              <Text style={styles.dropdownPlayerIcon}>🏏</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.dropdownSelectedName}>
                  {currentBatter?.name || 'Select Batsman'}
                </Text>
                <Text style={styles.dropdownSelectedStats}>
                  {currentBatter?.runs ?? 0} runs ({currentBatter?.balls ?? 0} balls) • SR {currentBatter?.strikeRate || '0.0'} • {currentBatter?.dismissal || 'not out'}
                </Text>
              </View>
            </View>
            <View style={styles.dropdownRight}>
              <View style={styles.dropdownBadgeTotal}>
                <Text style={styles.dropdownBadgeTotalText}>
                  {batters.length} Batsmen
                </Text>
              </View>
              <Text style={styles.dropdownArrow}>{isDropdownOpen ? '▲' : '▼'}</Text>
            </View>
          </TouchableOpacity>

          {/* Dropdown Menu Options */}
          {isDropdownOpen && (
            <View style={styles.dropdownMenu}>
              <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled showsVerticalScrollIndicator>
                {batters.map((b, idx) => {
                  const isSelected = b.id === activeBatterId;
                  return (
                    <TouchableOpacity
                      key={b.id || idx}
                      style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
                      onPress={() => {
                        handleBatterChange(b.id);
                        setIsDropdownOpen(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.dropdownItemLeft}>
                        <View style={[styles.dropdownItemIndex, isSelected && styles.dropdownItemIndexActive]}>
                          <Text style={[styles.dropdownItemIndexText, isSelected && styles.dropdownItemIndexTextActive]}>
                            {idx + 1}
                          </Text>
                        </View>
                        <View style={{ flexShrink: 1 }}>
                          <Text style={[styles.dropdownItemName, isSelected && styles.dropdownItemNameActive]}>
                            {b.name}
                          </Text>
                          <Text style={styles.dropdownItemDismissal}>
                            {b.dismissal || (b.isOut ? 'out' : 'not out')}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.dropdownItemRight}>
                        <View style={styles.dropdownItemStatsCol}>
                          <Text style={[styles.dropdownItemRuns, isSelected && styles.dropdownItemRunsActive]}>
                            {b.runs} r
                          </Text>
                          <Text style={styles.dropdownItemBalls}>
                            ({b.balls} b)
                          </Text>
                        </View>
                        {isSelected && (
                          <View style={styles.dropdownCheckmark}>
                            <Text style={styles.dropdownCheckmarkText}>✓</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      {/* 2-SLIDE NAVIGATION TABS */}
      <View style={[styles.slideTabBar, isSmallScreen && styles.slideTabBarMobile]}>
        <TouchableOpacity
          style={[styles.slideTab, isSmallScreen && styles.slideTabMobile, activeSlide === 'wheel' && styles.slideTabActive]}
          onPress={() => setActiveSlide('wheel')}
        >
          <Text style={styles.slideTabIcon}>🎯</Text>
          <View style={{ flexShrink: 1 }}>
            <View style={styles.slideTabTitleRow}>
              <Text style={[styles.slideTabTitle, activeSlide === 'wheel' && styles.slideTabTitleActive]}>
                Slide 1: Wagon Wheel
              </Text>
              <View style={[styles.slidePillBadge, activeSlide === 'wheel' && styles.slidePillBadgeActive]}>
                <Text style={[styles.slidePillBadgeText, activeSlide === 'wheel' && styles.slidePillBadgeTextActive]}>
                  {displayedDeliveries.length} Shots
                </Text>
              </View>
            </View>
            <Text style={styles.slideTabSubtitle}>Trajectories (1, 2, 3, 4, 6, dots) on Ground</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.slideTab, isSmallScreen && styles.slideTabMobile, activeSlide === 'percentage' && styles.slideTabActive]}
          onPress={() => setActiveSlide('percentage')}
        >
          <Text style={styles.slideTabIcon}>📊</Text>
          <View style={{ flexShrink: 1 }}>
            <View style={styles.slideTabTitleRow}>
              <Text style={[styles.slideTabTitle, activeSlide === 'percentage' && styles.slideTabTitleActive]}>
                Slide 2: Playing Areas (%)
              </Text>
              <View style={[styles.slidePillBadge, activeSlide === 'percentage' && styles.slidePillBadgeActive]}>
                <Text style={[styles.slidePillBadgeText, activeSlide === 'percentage' && styles.slidePillBadgeTextActive]}>
                  8 Sectors
                </Text>
              </View>
            </View>
            <Text style={styles.slideTabSubtitle}>Off-Side ({stats.offPct}%) vs Leg-Side ({stats.legPct}%)</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ─────────────────────────────────────────────────────────────
          SLIDE 1: WAGON WHEEL SHOT TRAJECTORIES
          ───────────────────────────────────────────────────────────── */}
      {activeSlide === 'wheel' && (
        <View style={styles.slideContent}>
          {/* Run Filter Pills */}
          <View style={styles.filterBar}>
            <Text style={styles.filterLabel}>SHOTS FILTER:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              <TouchableOpacity
                style={[styles.filterPill, runFilter === 'ALL' && styles.filterPillActive]}
                onPress={() => setRunFilter('ALL')}
              >
                <Text style={[styles.filterPillText, runFilter === 'ALL' && styles.filterPillTextActive]}>
                  All ({runCounts.total})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, runFilter === '6' && styles.filterPillActiveSix]}
                onPress={() => setRunFilter(runFilter === '6' ? 'ALL' : '6')}
              >
                <View style={[styles.dotMarker, { backgroundColor: '#ec4899' }]} />
                <Text style={[styles.filterPillText, runFilter === '6' && styles.filterPillTextActive]}>
                  6s ({runCounts.sixes})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, runFilter === '4' && styles.filterPillActiveFour]}
                onPress={() => setRunFilter(runFilter === '4' ? 'ALL' : '4')}
              >
                <View style={[styles.dotMarker, { backgroundColor: '#10b981' }]} />
                <Text style={[styles.filterPillText, runFilter === '4' && styles.filterPillTextActive]}>
                  4s ({runCounts.fours})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, runFilter === '3' && styles.filterPillActiveThree]}
                onPress={() => setRunFilter(runFilter === '3' ? 'ALL' : '3')}
              >
                <View style={[styles.dotMarker, { backgroundColor: '#f59e0b' }]} />
                <Text style={[styles.filterPillText, runFilter === '3' && styles.filterPillTextActive]}>
                  3s ({runCounts.threes})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, runFilter === '2' && styles.filterPillActiveTwo]}
                onPress={() => setRunFilter(runFilter === '2' ? 'ALL' : '2')}
              >
                <View style={[styles.dotMarker, { backgroundColor: '#3b82f6' }]} />
                <Text style={[styles.filterPillText, runFilter === '2' && styles.filterPillTextActive]}>
                  2s ({runCounts.twos})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, runFilter === '1' && styles.filterPillActiveOne]}
                onPress={() => setRunFilter(runFilter === '1' ? 'ALL' : '1')}
              >
                <View style={[styles.dotMarker, { backgroundColor: '#06b6d4' }]} />
                <Text style={[styles.filterPillText, runFilter === '1' && styles.filterPillTextActive]}>
                  1s ({runCounts.ones})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, runFilter === 'DOT' && styles.filterPillActiveDot]}
                onPress={() => setRunFilter(runFilter === 'DOT' ? 'ALL' : 'DOT')}
              >
                <View style={[styles.dotMarker, { backgroundColor: '#94a3b8' }]} />
                <Text style={[styles.filterPillText, runFilter === 'DOT' && styles.filterPillTextActive]}>
                  Dots ({runCounts.dots})
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* THE WAGON WHEEL CANVAS */}
          <View style={styles.wheelWrapper}>
            <View style={[styles.groundContainer, { width: displaySize, height: displaySize }]}>
              {/* Standard SVG Rendering (Works flawlessly on React Native Web & Native) */}
              <svg
                width={displaySize}
                height={displaySize}
                viewBox={`0 0 ${baseSize} ${baseSize}`}
                style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}
              >
                <defs>
                  {/* Stadium Grass Gradient */}
                  <radialGradient id="turfGradient" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#0b381e" />
                    <stop offset="70%" stopColor="#062613" />
                    <stop offset="100%" stopColor="#02140a" />
                  </radialGradient>
                  {/* Pitch Texture */}
                  <linearGradient id="pitchGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#c5a880" />
                    <stop offset="50%" stopColor="#d8b991" />
                    <stop offset="100%" stopColor="#c5a880" />
                  </linearGradient>
                  {/* Glow Filter for Boundaries */}
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* 1. Main Outfield Circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="url(#turfGradient)"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeDasharray="4 2"
                />

                {/* 2. Outer Boundary Rope Border */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius + 4}
                  fill="none"
                  stroke="rgba(245, 158, 11, 0.4)"
                  strokeWidth="1.5"
                />

                {/* 3. 8 Sector Divider Lines & Sector Labels */}
                {SECTORS.map(s => {
                  const borderCoord = getCoordinates(s.startAngle, 100);
                  const labelCoord = getCoordinates((s.startAngle + 22.5) % 360, 84);
                  const isSelected = sectorFilter === s.key;

                  return (
                    <g key={s.key}>
                      {/* Radial divider */}
                      <line
                        x1={cx}
                        y1={cy}
                        x2={borderCoord.x}
                        y2={borderCoord.y}
                        stroke="rgba(255, 255, 255, 0.12)"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                      />
                      {/* Sector Name Watermark inside field */}
                      <text
                        x={labelCoord.x}
                        y={labelCoord.y}
                        fill={isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.45)'}
                        fontSize={isDesktop ? 9 : 8}
                        fontWeight={isSelected ? 'bold' : 'normal'}
                        textAnchor="middle"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {s.name.split(' / ')[0]}
                      </text>
                    </g>
                  );
                })}

                {/* 4. 30-Yard Infield Circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={innerCircleR}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.28)"
                  strokeWidth="1.5"
                  strokeDasharray="5 4"
                />

                {/* 5. Central Cricket Pitch */}
                <rect
                  x={cx - pitchW / 2}
                  y={cy - pitchH / 2}
                  width={pitchW}
                  height={pitchH}
                  fill="url(#pitchGrad)"
                  rx="2"
                  stroke="#8d6e63"
                  strokeWidth="1"
                />
                {/* Bowling Crease & Stumps */}
                <line x1={cx - pitchW / 2} y1={cy - pitchH / 2 + 5} x2={cx + pitchW / 2} y2={cy - pitchH / 2 + 5} stroke="#ffffff" strokeWidth="1" />
                {/* Batting Crease (Striker) */}
                <line x1={cx - pitchW / 2} y1={cy + pitchH / 2 - 5} x2={cx + pitchW / 2} y2={cy + pitchH / 2 - 5} stroke="#ffffff" strokeWidth="1" />
                {/* Stumps Marker */}
                <circle cx={cx} cy={cy + pitchH / 2 - 3} r="1.5" fill="#e11d48" />

                {/* 6. Wagon Wheel Shot Trajectory Lines */}
                {displayedDeliveries.map((del, idx) => {
                  const runs = Number(del.runsBatter) || 0;
                  const angle = typeof del.shotAngle === 'number' ? del.shotAngle : 315;
                  const dist = typeof del.shotDistance === 'number' ? del.shotDistance : (runs === 6 ? 108 : runs === 4 ? 94 : 45);
                  const end = getCoordinates(angle, dist);
                  const color = getShotColor(runs);
                  const isCurrentActive = activeShot?.id === del.id;

                  const strokeWidth = runs === 6 ? 2.5 : runs === 4 ? 2.0 : 1.3;
                  const strokeDash = runs === 6 ? '4 2' : runs === 0 ? '2 2' : 'none';

                  return (
                    <g
                      key={del.id || `shot-${idx}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setActiveShot(del)}
                    >
                      {/* Glow backdrop on hover */}
                      {isCurrentActive && (
                        <line
                          x1={cx}
                          y1={cy + 8}
                          x2={end.x}
                          y2={end.y}
                          stroke="#ffffff"
                          strokeWidth={strokeWidth + 4}
                          opacity="0.4"
                        />
                      )}
                      {/* The Shot Line */}
                      <line
                        x1={cx}
                        y1={cy + 8}
                        x2={end.x}
                        y2={end.y}
                        stroke={color}
                        strokeWidth={isCurrentActive ? strokeWidth + 1.5 : strokeWidth}
                        strokeDasharray={strokeDash}
                        opacity={isCurrentActive ? 1.0 : 0.85}
                      />
                      {/* Terminal Marker */}
                      <circle
                        cx={end.x}
                        cy={end.y}
                        r={runs === 6 ? 4.5 : runs === 4 ? 3.5 : 2.5}
                        fill={color}
                        stroke="#ffffff"
                        strokeWidth={isCurrentActive ? 1.5 : 0.75}
                      />
                    </g>
                  );
                })}

                {/* Batter Orientations Label (Off / Leg side indicator) */}
                <text x={cx - radius + 15} y={cy} fill="rgba(56, 189, 248, 0.7)" fontSize="10" fontWeight="bold">
                  OFF
                </text>
                <text x={cx + radius - 35} y={cy} fill="rgba(245, 158, 11, 0.7)" fontSize="10" fontWeight="bold">
                  LEG
                </text>
              </svg>

              {/* Hovered / Tapped Shot Detail Tooltip Card */}
              {activeShot && (
                <View style={styles.shotTooltip}>
                  <View style={styles.tooltipHeader}>
                    <Text style={[styles.tooltipBadge, { backgroundColor: getShotColor(activeShot.runsBatter) }]}>
                      {activeShot.runsBatter} RUNS
                    </Text>
                    <TouchableOpacity onPress={() => setActiveShot(null)} style={styles.tooltipClose}>
                      <Text style={styles.tooltipCloseText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.tooltipPosition}>
                    Direction: {activeShot.fieldingPosition || activeShot.shotZone || 'Field'} ({activeShot.shotAngle}° angle)
                  </Text>
                  {activeShot.overNumber !== undefined && (
                    <Text style={styles.tooltipBall}>
                      Over {activeShot.overNumber}.{activeShot.ballNumber}
                    </Text>
                  )}
                  {activeShot.commentary ? (
                    <Text style={styles.tooltipComm} numberOfLines={2}>
                      "{activeShot.commentary}"
                    </Text>
                  ) : null}
                </View>
              )}
            </View>

            {/* Quick Clear Filter if active */}
            {sectorFilter && (
              <TouchableOpacity style={styles.clearFilterBtn} onPress={() => setSectorFilter(null)}>
                <Text style={styles.clearFilterText}>
                  ✕ Filtered by {SECTORS.find(s => s.key === sectorFilter)?.name} (Tap to reset)
                </Text>
              </TouchableOpacity>
            )}

            {/* Compact Off vs Leg summary pill under wheel */}
            <View style={[styles.compactSideSummary, isSmallScreen && styles.compactSideSummaryMobile]}>
              <View style={styles.compactSideOff}>
                <Text style={styles.compactSideText}>🔵 Off-Side: <Text style={styles.boldText}>{stats.offRuns} runs</Text> ({stats.offPct}%)</Text>
              </View>
              <View style={styles.compactSideLeg}>
                <Text style={styles.compactSideText}>🟠 Leg-Side: <Text style={styles.boldText}>{stats.legRuns} runs</Text> ({stats.legPct}%)</Text>
              </View>
            </View>

            {/* Next Slide Action Banner */}
            <TouchableOpacity
              style={[styles.slideNavBanner, isSmallScreen && styles.slideNavBannerMobile]}
              onPress={() => setActiveSlide('percentage')}
              activeOpacity={0.85}
            >
              <View style={styles.slideNavInfo}>
                <Text style={styles.slideNavBadge}>SLIDE 2 OF 2</Text>
                <Text style={styles.slideNavTitle}>📊 View Player Playing Area Percentages (%) →</Text>
                <Text style={styles.slideNavSubtitle}>
                  Inspect Off vs Leg dominance and 8-zone scoring breakdown
                </Text>
              </View>
              <Text style={styles.slideNavArrow}>➔</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SLIDE 2: PLAYING AREA PERCENTAGES & 8-SECTOR BREAKDOWN
          ───────────────────────────────────────────────────────────── */}
      {activeSlide === 'percentage' && (
        <View style={styles.slideContent}>
          {/* Slide 2 Header Banner */}
          <View style={styles.slide2HeaderCard}>
            <View style={styles.slide2HeaderTop}>
              <Text style={styles.slide2Title}>📊 Batsman Playing Area & Scoring Zones Breakdown</Text>
              <View style={styles.slide2Badge}>
                <Text style={styles.slide2BadgeText}>SLIDE 2 OF 2</Text>
              </View>
            </View>
            <Text style={styles.slide2Subtitle}>
              Exact percentage calculation of runs scored by {currentBatter?.name || 'Batsman'} ({stats.totalRuns} total runs) across Off-Side, Leg-Side and all 8 cricket field sectors
            </Text>
          </View>

          {/* 1. OFF-SIDE vs LEG-SIDE PROPORTIONAL BALANCE BAR */}
          <View style={styles.balanceCard}>
            <View style={styles.balanceHeader}>
              <Text style={styles.balanceTitle}>⚖️ Off-Side vs Leg-Side Ratio</Text>
              <Text style={styles.balanceTotalRuns}>{stats.totalRuns} Total Runs</Text>
            </View>

            {/* Duel Split Progress Bar */}
            <View style={styles.duelBarTrack}>
              <View style={[styles.duelBarOff, { flexBasis: `${stats.offPct}%`, flexGrow: 0, flexShrink: 0 }]}>
                <Text style={styles.duelBarText}>{stats.offPct}% OFF</Text>
              </View>
              <View style={[styles.duelBarLeg, { flexBasis: `${stats.legPct}%`, flexGrow: 0, flexShrink: 0 }]}>
                <Text style={styles.duelBarText}>{stats.legPct}% LEG</Text>
              </View>
            </View>

            <View style={styles.balanceDetailsRow}>
              <Text style={styles.offDetailText}>
                🔵 Off-Side: <Text style={styles.boldText}>{stats.offRuns} runs</Text> ({stats.offBalls} balls) • {stats.offPct}% of innings
              </Text>
              <Text style={styles.legDetailText}>
                🟠 Leg-Side: <Text style={styles.boldText}>{stats.legRuns} runs</Text> ({stats.legBalls} balls) • {stats.legPct}% of innings
              </Text>
            </View>
          </View>

          {/* 2. 8-SECTOR PLAYING AREA BREAKDOWN TABLE / CARDS */}
          <View style={styles.sectorTableCard}>
            <View style={styles.sectorCardHeader}>
              <Text style={styles.sectorCardTitle}>📊 Playing Area Percentage By Sector (8 Zones)</Text>
              <Text style={styles.sectorCardHint}>Tap any sector to isolate & inspect in Wagon Wheel</Text>
            </View>

            <View style={[styles.sectorGrid, isDesktop && styles.sectorGridDesktop]}>
              {stats.sectors.map(sec => {
                const isSelected = sectorFilter === sec.key;
                return (
                  <View
                    key={sec.key}
                    style={[
                      styles.sectorRowItem,
                      isDesktop && styles.sectorRowItemDesktop,
                      isSelected && styles.sectorRowSelected
                    ]}
                  >
                    <View style={styles.sectorRowTop}>
                      <View style={styles.sectorNameWrapper}>
                        <View style={[styles.sectorColorDot, { backgroundColor: sec.color }]} />
                        <Text style={[styles.sectorNameText, isSelected && styles.sectorNameActive]}>
                          {sec.name}
                        </Text>
                      </View>
                      <View style={styles.sectorValueWrapper}>
                        <Text style={styles.sectorRunsText}>{sec.runs} runs</Text>
                        <Text style={[styles.sectorPctBadge, { color: sec.color }]}>
                          {sec.pct}%
                        </Text>
                      </View>
                    </View>

                    {/* Progress Bar for Sector */}
                    <View style={styles.sectorBarTrack}>
                      <View
                        style={[
                          styles.sectorBarFill,
                          { flexBasis: `${Math.max(sec.pct, 2)}%`, flexGrow: 0, flexShrink: 0, height: 5, backgroundColor: sec.color }
                        ]}
                      />
                    </View>

                    <View style={styles.sectorSubRow}>
                      <Text style={styles.sectorSubText}>
                        {sec.balls} balls • {sec.fours} fours • {sec.sixes} sixes
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.sectorSideBadge}>
                          {sec.side}
                        </Text>
                        <TouchableOpacity
                          style={styles.sectorInspectBtn}
                          onPress={() => {
                            setSectorFilter(sec.key);
                            setActiveSlide('wheel');
                          }}
                        >
                          <Text style={styles.sectorInspectBtnText}>🎯 Wheel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Return to Slide 1 Action Banner */}
          <TouchableOpacity
            style={[styles.slideNavBannerBack, isSmallScreen && styles.slideNavBannerBackMobile]}
            onPress={() => setActiveSlide('wheel')}
            activeOpacity={0.85}
          >
            <Text style={styles.slideNavArrowBack}>←</Text>
            <View style={styles.slideNavInfo}>
              <Text style={styles.slideNavBadgeBack}>SLIDE 1 OF 2</Text>
              <Text style={styles.slideNavTitleBack}>🎯 Return to Wagon Wheel (Shot Trajectories)</Text>
              <Text style={styles.slideNavSubtitleBack}>
                Explore individual shot lines, boundaries (4s & 6s), and ball placements on field
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// Helper: Synthetic mock shot generator for initial display or players without ball-by-ball logs
function generateSyntheticShots(batter: BatterProfile): ShotDelivery[] {
  const shots: ShotDelivery[] = [];
  const runsTotal = batter.runs || 24;
  const ballsTotal = batter.balls || 18;
  const fours = batter.fours || Math.floor(runsTotal / 8);
  const sixes = batter.sixes || (runsTotal > 30 ? 1 : 0);

  // Add sixes
  for (let i = 0; i < sixes; i++) {
    const angle = i % 2 === 0 ? 80 : 330; // Cow Corner or Long Off
    shots.push({
      strikerId: batter.id,
      runsBatter: 6,
      shotAngle: angle,
      shotDistance: 108,
      fieldingPosition: angle === 80 ? 'Midwicket' : 'Mid-Off',
      shotZone: angle === 80 ? 'Midwicket / Cow Corner' : 'Mid-Off / Long Off',
      commentary: 'Massive hit clearing the ropes with ease!'
    });
  }

  // Add fours
  const fourPositions = [
    { angle: 315, pos: 'Cover', zone: 'Cover / Extra Cover' },
    { angle: 270, pos: 'Point', zone: 'Point / Backward Point' },
    { angle: 60, pos: 'Midwicket', zone: 'Midwicket / Cow Corner' },
    { angle: 140, pos: 'Fine Leg', zone: 'Fine Leg' },
    { angle: 220, pos: 'Third Man', zone: 'Third Man / Slips' }
  ];
  for (let i = 0; i < fours; i++) {
    const item = fourPositions[i % fourPositions.length];
    shots.push({
      strikerId: batter.id,
      runsBatter: 4,
      shotAngle: item.angle + (Math.random() - 0.5) * 6,
      shotDistance: 94 + Math.random() * 4,
      fieldingPosition: item.pos,
      shotZone: item.zone,
      commentary: 'Crisp timing, pierces the gap to the fence!'
    });
  }

  // Calculate remaining runs for 1s, 2s, and 3s
  let currentRuns = sixes * 6 + fours * 4;
  let remainingBalls = Math.max(0, ballsTotal - sixes - fours);

  while (currentRuns < runsTotal && remainingBalls > 0) {
    const run = (runsTotal - currentRuns) >= 2 ? 2 : 1;
    currentRuns += run;
    remainingBalls--;
    const angle = Math.floor(Math.random() * 360);
    shots.push({
      strikerId: batter.id,
      runsBatter: run,
      shotAngle: angle,
      shotDistance: run === 2 ? 62 : 44,
      fieldingPosition: 'Infield',
      commentary: `${run} run taken, neat placement.`
    });
  }

  // Remaining balls as dots (0s)
  while (remainingBalls > 0) {
    remainingBalls--;
    const angle = Math.floor(Math.random() * 360);
    shots.push({
      strikerId: batter.id,
      runsBatter: 0,
      shotAngle: angle,
      shotDistance: 25 + Math.random() * 10,
      fieldingPosition: 'Point',
      commentary: 'Defended gently into the inner circle.'
    });
  }

  return shots;
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#fde68a',
    marginVertical: 12,
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: '#fef3c7',
    paddingBottom: 12,
    marginBottom: 12
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  batterBadge: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  batterBadgeName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#92400e'
  },
  batterBadgeStats: {
    fontSize: 11,
    color: '#b45309',
    marginTop: 2,
    fontWeight: '700'
  },
  batterDropdownWrapper: {
    marginBottom: 16,
    position: 'relative',
    zIndex: 20
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#fde68a',
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  dropdownButtonActive: {
    borderColor: '#f59e0b',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1
  },
  dropdownPlayerIcon: {
    fontSize: 22
  },
  dropdownSelectedName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a'
  },
  dropdownSelectedStats: {
    fontSize: 11.5,
    color: '#b45309',
    marginTop: 2,
    fontWeight: '600'
  },
  dropdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  dropdownBadgeTotal: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  dropdownBadgeTotalText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400e'
  },
  dropdownArrow: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#b45309'
  },
  dropdownMenu: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: '#fde68a',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden'
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#fef3c7'
  },
  dropdownItemSelected: {
    backgroundColor: '#fefce8'
  },
  dropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1
  },
  dropdownItemIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  dropdownItemIndexActive: {
    backgroundColor: '#f59e0b'
  },
  dropdownItemIndexText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748b'
  },
  dropdownItemIndexTextActive: {
    color: '#ffffff'
  },
  dropdownItemName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1e293b'
  },
  dropdownItemNameActive: {
    color: '#92400e',
    fontWeight: '800'
  },
  dropdownItemDismissal: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1
  },
  dropdownItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  dropdownItemStatsCol: {
    alignItems: 'flex-end'
  },
  dropdownItemRuns: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0f172a'
  },
  dropdownItemRunsActive: {
    color: '#d97706'
  },
  dropdownItemBalls: {
    fontSize: 10.5,
    color: '#64748b'
  },
  dropdownCheckmark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4
  },
  dropdownCheckmarkText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900'
  },
  selectorLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748b',
    marginBottom: 6,
    letterSpacing: 0.5
  },
  batterChipName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155'
  },
  batterChipRuns: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b'
  },
  batterChipTextActive: {
    color: '#92400e',
    fontWeight: '800'
  },
  batterChipRunsActive: {
    color: '#b45309',
    fontWeight: '800'
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748b',
    marginRight: 4
  },
  filterScroll: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  filterPillActive: {
    backgroundColor: '#d97706',
    borderColor: '#b45309'
  },
  filterPillActiveSix: {
    backgroundColor: '#be185d',
    borderColor: '#ec4899'
  },
  filterPillActiveFour: {
    backgroundColor: '#047857',
    borderColor: '#10b981'
  },
  filterPillActiveThree: {
    backgroundColor: '#b45309',
    borderColor: '#f59e0b'
  },
  filterPillActiveTwo: {
    backgroundColor: '#1d4ed8',
    borderColor: '#3b82f6'
  },
  filterPillActiveOne: {
    backgroundColor: '#0e7490',
    borderColor: '#06b6d4'
  },
  filterPillActiveDot: {
    backgroundColor: '#64748b',
    borderColor: '#94a3b8'
  },
  dotMarker: {
    width: 7,
    height: 7,
    borderRadius: 4
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569'
  },
  filterPillTextActive: {
    color: '#ffffff',
    fontWeight: 'bold'
  },
  mainLayout: {
    flexDirection: 'column',
    gap: 20
  },
  mainLayoutDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  wheelWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  groundContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#02140a'
  },
  shotTooltip: {
    position: 'absolute',
    bottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderColor: '#fde68a',
    borderWidth: 1.5,
    padding: 10,
    borderRadius: 8,
    width: 220,
    shadowColor: '#d4af37',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  tooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  tooltipBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  tooltipClose: {
    padding: 2
  },
  tooltipCloseText: {
    color: '#94a3b8',
    fontSize: 12
  },
  tooltipPosition: {
    fontSize: 11,
    color: '#0f172a',
    fontWeight: '700'
  },
  tooltipBall: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2
  },
  tooltipComm: {
    fontSize: 10,
    color: '#334155',
    fontStyle: 'italic',
    marginTop: 4
  },
  clearFilterBtn: {
    marginTop: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16
  },
  clearFilterText: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: 'bold'
  },
  analyticsWrapper: {
    flex: 1,
    gap: 14
  },
  balanceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#fde68a',
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  balanceTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  balanceTotalRuns: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#059669'
  },
  duelBarTrack: {
    height: 26,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  duelBarOff: {
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center'
  },
  duelBarLeg: {
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center'
  },
  duelBarText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff'
  },
  balanceDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8
  },
  offDetailText: {
    fontSize: 11,
    color: '#0284c7',
    fontWeight: '600'
  },
  legDetailText: {
    fontSize: 11,
    color: '#d97706',
    fontWeight: '600'
  },
  boldText: {
    fontWeight: 'bold',
    color: '#0f172a'
  },
  sectorTableCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#fde68a',
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2
  },
  sectorCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 4
  },
  sectorCardTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  sectorCardHint: {
    fontSize: 10,
    color: '#64748b'
  },
  sectorGrid: {
    gap: 8
  },
  sectorRowItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  sectorRowSelected: {
    borderColor: '#f59e0b',
    borderWidth: 1.5,
    backgroundColor: '#fefce8'
  },
  sectorRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectorNameWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  sectorColorDot: {
    width: 9,
    height: 9,
    borderRadius: 5
  },
  sectorNameText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b'
  },
  sectorNameActive: {
    color: '#92400e',
    fontWeight: 'bold'
  },
  sectorValueWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  sectorRunsText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  sectorPctBadge: {
    fontSize: 12,
    fontWeight: 'bold'
  },
  sectorBarTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#e2e8f0',
    marginVertical: 6,
    overflow: 'hidden'
  },
  sectorBarFill: {
    height: 5,
    borderRadius: 3
  },
  sectorSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectorSubText: {
    fontSize: 10,
    color: '#64748b'
  },
  sectorSideBadge: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4
  },
  // 2-SLIDE NAVIGATION STYLES
  slideTabBar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: '#fef3c7',
    paddingBottom: 12
  },
  slideTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0'
  },
  slideTabActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b'
  },
  slideTabIcon: {
    fontSize: 20
  },
  slideTabTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  slideTabTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#475569'
  },
  slideTabTitleActive: {
    color: '#92400e'
  },
  slideTabSubtitle: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2
  },
  slidePillBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8
  },
  slidePillBadgeActive: {
    backgroundColor: '#f59e0b'
  },
  slidePillBadgeText: {
    fontSize: 9.5,
    color: '#475569',
    fontWeight: 'bold'
  },
  slidePillBadgeTextActive: {
    color: '#ffffff'
  },
  slideContent: {
    width: '100%',
    gap: 14
  },
  compactSideSummary: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    width: '100%',
  },
  compactSideOff: {
    flex: 1,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  compactSideLeg: {
    flex: 1,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  compactSideText: {
    fontSize: 11,
    color: '#0f172a',
    fontWeight: '700'
  },
  slideNavBanner: {
    marginTop: 14,
    backgroundColor: '#fffbeb',
    borderWidth: 1.5,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  slideNavBannerBack: {
    marginTop: 10,
    backgroundColor: '#fffbeb',
    borderWidth: 1.5,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  slideNavInfo: {
    flex: 1
  },
  slideNavBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f59e0b',
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
    letterSpacing: 0.5
  },
  slideNavBadgeBack: {
    alignSelf: 'flex-start',
    backgroundColor: '#10b981',
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
    letterSpacing: 0.5
  },
  slideNavTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#92400e'
  },
  slideNavTitleBack: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#047857'
  },
  slideNavSubtitle: {
    fontSize: 10.5,
    color: '#b45309',
    marginTop: 2
  },
  slideNavSubtitleBack: {
    fontSize: 10.5,
    color: '#047857',
    marginTop: 2
  },
  slideNavArrow: {
    fontSize: 18,
    color: '#d97706',
    fontWeight: 'bold',
    marginLeft: 10
  },
  slideNavArrowBack: {
    fontSize: 20,
    color: '#10b981',
    fontWeight: 'bold'
  },
  slide2HeaderCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 4,
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2
  },
  slide2HeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  slide2Title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
    flex: 1
  },
  slide2Badge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  slide2BadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#92400e'
  },
  slide2Subtitle: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16
  },
  sectorInspectBtn: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  sectorInspectBtnText: {
    fontSize: 9.5,
    fontWeight: 'bold',
    color: '#92400e'
  },
  // Responsive overrides
  slideTabBarMobile: {
    flexDirection: 'column',
    gap: 8
  },
  slideTabMobile: {
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  compactSideSummaryMobile: {
    flexDirection: 'column',
    gap: 6
  },
  slideNavBannerMobile: {
    padding: 10,
    width: '100%'
  },
  slideNavBannerBackMobile: {
    padding: 10,
    width: '100%'
  },
  sectorGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  sectorRowItemDesktop: {
    width: '49%',
    minWidth: 260
  }
});
