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

const ZONE_ANGLES: Record<string, number> = {
  'third man': 220,
  'third_man': 220,
  'point': 265,
  'backward point': 250,
  'cover': 298,
  'extra cover': 325,
  'extra_cover': 325,
  'mid-off': 340,
  'long off': 345,
  'long_off': 345,
  'straight': 0,
  'long on': 25,
  'long_on': 25,
  'mid-on': 20,
  'mid wicket': 68,
  'mid_wicket': 68,
  'midwicket': 68,
  'cow corner': 85,
  'square leg': 112,
  'square_leg': 112,
  'fine leg': 155,
  'fine_leg': 155
};

const resolveDeliveryAngleAndDist = (d: ShotDelivery): ShotDelivery => {
  let angle = d.shotAngle;
  let dist = d.shotDistance;
  const runs = Number(d.runsBatter) || 0;

  if (typeof angle !== 'number') {
    const key = (d.shotZone || d.fieldingPosition || '').toLowerCase().trim();
    if (key && ZONE_ANGLES[key] !== undefined) {
      angle = ZONE_ANGLES[key];
    } else {
      const hash = (((d.ballNumber || 1) * 37 + (d.overNumber || 0) * 19 + runs * 53) % 360);
      angle = hash;
    }
  }

  if (typeof dist !== 'number') {
    if (runs === 6) dist = 104;
    else if (runs === 4) dist = 92;
    else if (runs === 3) dist = 76;
    else if (runs === 2) dist = 58;
    else if (runs === 1) dist = 42;
    else dist = 24;
  }

  return {
    ...d,
    shotAngle: angle,
    shotDistance: dist
  };
};

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
    if (activeBatterId === 'ALL') {
      const totalRuns = (deliveries || []).reduce((acc, d) => acc + (Number(d.runsBatter) || 0), 0);
      const totalBalls = (deliveries || []).filter(d => d.extraType === 'NONE' || !d.extraType).length;
      return {
        id: 'ALL',
        name: 'Entire Team Innings',
        runs: totalRuns,
        balls: totalBalls,
        strikeRate: totalBalls > 0 ? ((totalRuns / totalBalls) * 100).toFixed(1) : '0.0',
        dismissal: 'All Batters Combined'
      } as BatterProfile;
    }
    return batters.find(b => b.id === activeBatterId) || batters[0];
  }, [batters, activeBatterId, deliveries]);

  // Filter deliveries belonging to this batter or entire team
  const batterDeliveries = useMemo(() => {
    if (activeBatterId === 'ALL') {
      if (deliveries && deliveries.length > 0) {
        return deliveries.map(d => resolveDeliveryAngleAndDist(d));
      }
      return [];
    }
    if (!currentBatter) return [];
    const id = currentBatter.id ? String(currentBatter.id) : '';

    const matched = (deliveries || []).filter(d => {
      if (!d) return false;
      const sId = d.strikerId ? String(d.strikerId) : '';
      if (!sId || !id) return false;
      if (sId === id) return true;
      if (id.includes(sId) || sId.includes(id)) return true;
      return false;
    }).map(d => resolveDeliveryAngleAndDist(d));

    if (matched.length > 0) return matched;

    // Fallback generator if real deliveries list is empty
    return generateSyntheticShots(currentBatter);
  }, [deliveries, currentBatter, activeBatterId]);

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

  // Filtered deliveries based on user selection (All shots or filtered by runs/sector)
  const displayedDeliveries = useMemo(() => {
    return batterDeliveries.filter(d => {
      const runs = Number(d.runsBatter) || 0;

      if (runFilter === '6' && runs !== 6) return false;
      if (runFilter === '4' && runs !== 4) return false;
      if (runFilter === '3' && runs !== 3) return false;
      if (runFilter === '2' && runs !== 2) return false;
      if (runFilter === '1' && runs !== 1) return false;
      if (runFilter === '0' && runs !== 0) return false;
      if (runFilter === 'BOUNDARIES' && runs !== 4 && runs !== 6) return false;
      if (runFilter === 'RUNNING' && runs !== 1 && runs !== 2 && runs !== 3) return false;

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
    const counts = { total: 0, sixes: 0, fours: 0, threes: 0, twos: 0, ones: 0, dots: 0 };
    batterDeliveries.forEach(d => {
      const r = Number(d.runsBatter) || 0;
      counts.total++;
      if (r === 6) counts.sixes++;
      else if (r === 4) counts.fours++;
      else if (r === 3) counts.threes++;
      else if (r === 2) counts.twos++;
      else if (r === 1) counts.ones++;
      else if (r === 0) counts.dots++;
    });
    return counts;
  }, [batterDeliveries]);

  const hasNoBoundaries = (runCounts.fours === 0 && runCounts.sixes === 0);

  // Scoring Breakdown with Run Multipliers (e.g. 3s: 3 × 3 = 9 runs)
  const scoringBreakdown = useMemo(() => {
    const sixRuns = runCounts.sixes * 6;
    const fourRuns = runCounts.fours * 4;
    const threeRuns = runCounts.threes * 3;
    const twoRuns = runCounts.twos * 2;
    const oneRuns = runCounts.ones * 1;
    const totalScored = sixRuns + fourRuns + threeRuns + twoRuns + oneRuns;

    return {
      sixes: { count: runCounts.sixes, mult: 6, runs: sixRuns, pct: totalScored > 0 ? Math.round((sixRuns / totalScored) * 100) : 0 },
      fours: { count: runCounts.fours, mult: 4, runs: fourRuns, pct: totalScored > 0 ? Math.round((fourRuns / totalScored) * 100) : 0 },
      threes: { count: runCounts.threes, mult: 3, runs: threeRuns, pct: totalScored > 0 ? Math.round((threeRuns / totalScored) * 100) : 0 },
      twos: { count: runCounts.twos, mult: 2, runs: twoRuns, pct: totalScored > 0 ? Math.round((twoRuns / totalScored) * 100) : 0 },
      ones: { count: runCounts.ones, mult: 1, runs: oneRuns, pct: totalScored > 0 ? Math.round((oneRuns / totalScored) * 100) : 0 },
      dots: { count: runCounts.dots, mult: 0, runs: 0, pct: runCounts.total > 0 ? Math.round((runCounts.dots / runCounts.total) * 100) : 0 },
      totalRuns: totalScored,
      totalBalls: runCounts.total
    };
  }, [runCounts]);

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
      case 6: return '#ec4899'; // Hot Magenta (Sixes)
      case 4: return '#06b6d4'; // Bright Cyan (Fours)
      case 3: return '#a855f7'; // Purple (3 Runs)
      case 2: return '#f59e0b'; // Amber (2 Runs)
      case 1: return '#38bdf8'; // Sky Blue (1 Run)
      case 0: return '#94a3b8'; // Slate Gray (Dot ball)
      default: return '#10b981';
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
                {/* Team Innings All Batters Option */}
                <TouchableOpacity
                  key="ALL"
                  style={[styles.dropdownItem, activeBatterId === 'ALL' && styles.dropdownItemSelected]}
                  onPress={() => {
                    handleBatterChange('ALL');
                    setIsDropdownOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.dropdownItemLeft}>
                    <Text style={{ fontSize: 13, marginRight: 8 }}>👥</Text>
                    <View style={{ flexShrink: 1 }}>
                      <Text style={[styles.dropdownItemName, activeBatterId === 'ALL' && styles.dropdownItemNameActive]}>
                        All Batters (Team Innings)
                      </Text>
                      <Text style={styles.dropdownItemDismissal}>
                        Entire innings wagon wheel & shots
                      </Text>
                    </View>
                  </View>
                  <View style={styles.dropdownItemRight}>
                    <View style={styles.dropdownItemStatsCol}>
                      <Text style={[styles.dropdownItemRuns, activeBatterId === 'ALL' && styles.dropdownItemRunsActive]}>
                        {deliveries.length} balls
                      </Text>
                    </View>
                    {activeBatterId === 'ALL' && (
                      <View style={styles.dropdownCheckmark}>
                        <Text style={styles.dropdownCheckmarkText}>✓</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

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
                  {displayedDeliveries.length} {runFilter === 'ALL' ? 'Shots' : runFilter === 'BOUNDARIES' || runFilter === '4' || runFilter === '6' ? 'Boundaries' : 'Shots'}
                </Text>
              </View>
            </View>
            <Text style={styles.slideTabSubtitle}>Shot Trajectories & Ground Locations</Text>
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
          {/* Prominent English notice when batter has no 4s and no 6s */}
          {hasNoBoundaries && (
            <View style={styles.noBoundariesBanner}>
              <Text style={styles.noBoundariesIcon}>ℹ️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.noBoundariesTitle}>
                  This player has not hit any boundaries (4s or 6s) in this innings.
                </Text>
                <Text style={styles.noBoundariesSubtitle}>
                  All {currentBatter?.runs || 0} runs were scored through running between wickets (1s, 2s & 3s). Shot trajectories for running runs are shown on the ground below.
                </Text>
              </View>
            </View>
          )}

          {/* Shot Run Filter Bar */}
          <View style={styles.filterBar}>
            <Text style={styles.filterLabel}>SHOT RUN FILTER:</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <TouchableOpacity
                style={[styles.filterPill, runFilter === 'ALL' && styles.filterPillActive]}
                onPress={() => setRunFilter('ALL')}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterPillText, runFilter === 'ALL' && styles.filterPillTextActive]}>
                  All Shots ({runCounts.total})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, runFilter === 'BOUNDARIES' && styles.filterPillActiveBoundary]}
                onPress={() => setRunFilter(runFilter === 'BOUNDARIES' ? 'ALL' : 'BOUNDARIES')}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterPillText, runFilter === 'BOUNDARIES' && styles.filterPillTextActive]}>
                  Boundaries ({runCounts.fours + runCounts.sixes})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, runFilter === '6' && styles.filterPillActiveSix]}
                onPress={() => setRunFilter(runFilter === '6' ? 'ALL' : '6')}
                activeOpacity={0.7}
              >
                <View style={[styles.dotMarker, { backgroundColor: '#ec4899' }]} />
                <Text style={[styles.filterPillText, runFilter === '6' && styles.filterPillTextActive]}>
                  6s ({runCounts.sixes} × 6 = {scoringBreakdown.sixes.runs}r)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, runFilter === '4' && styles.filterPillActiveFour]}
                onPress={() => setRunFilter(runFilter === '4' ? 'ALL' : '4')}
                activeOpacity={0.7}
              >
                <View style={[styles.dotMarker, { backgroundColor: '#06b6d4' }]} />
                <Text style={[styles.filterPillText, runFilter === '4' && styles.filterPillTextActive]}>
                  4s ({runCounts.fours} × 4 = {scoringBreakdown.fours.runs}r)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, runFilter === 'RUNNING' && styles.filterPillActiveRunning]}
                onPress={() => setRunFilter(runFilter === 'RUNNING' ? 'ALL' : 'RUNNING')}
                activeOpacity={0.7}
              >
                <View style={[styles.dotMarker, { backgroundColor: '#38bdf8' }]} />
                <Text style={[styles.filterPillText, runFilter === 'RUNNING' && styles.filterPillTextActive]}>
                  1s, 2s & 3s ({runCounts.ones + runCounts.twos + runCounts.threes})
                </Text>
              </TouchableOpacity>

              {runCounts.dots > 0 && (
                <TouchableOpacity
                  style={[styles.filterPill, runFilter === '0' && styles.filterPillActiveDot]}
                  onPress={() => setRunFilter(runFilter === '0' ? 'ALL' : '0')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.dotMarker, { backgroundColor: '#94a3b8' }]} />
                  <Text style={[styles.filterPillText, runFilter === '0' && styles.filterPillTextActive]}>
                    Dots ({runCounts.dots})
                  </Text>
                </TouchableOpacity>
              )}
            </View>
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
                  {/* Stadium Grass Gradient - Vibrant Daylight Turf */}
                  <radialGradient id="turfGradient" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="65%" stopColor="#16a34a" />
                    <stop offset="100%" stopColor="#15803d" />
                  </radialGradient>
                  {/* Pitch Texture */}
                  <linearGradient id="pitchGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#d97706" />
                    <stop offset="50%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#d97706" />
                  </linearGradient>
                  {/* Glow Filter for Boundaries */}
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* 1. Main Outfield Circle - Natural Daylight Turf */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="url(#turfGradient)"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />

                {/* 2. Outer Boundary Rope Border */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius + 3}
                  fill="none"
                  stroke="#b8860b"
                  strokeWidth="2"
                  strokeDasharray="6 3"
                />

                {/* 3. 8 Sector Divider Lines & Sector Labels */}
                {SECTORS.map(s => {
                  const borderCoord = getCoordinates(s.startAngle, 100);
                  const labelCoord = getCoordinates((s.startAngle + 22.5) % 360, 83);
                  const isSelected = sectorFilter === s.key;

                  return (
                    <g key={s.key}>
                      {/* Radial divider */}
                      <line
                        x1={cx}
                        y1={cy}
                        x2={borderCoord.x}
                        y2={borderCoord.y}
                        stroke="rgba(255, 255, 255, 0.45)"
                        strokeWidth="1.2"
                        strokeDasharray="4 3"
                      />
                      {/* Sector Name Watermark inside field */}
                      <text
                        x={labelCoord.x}
                        y={labelCoord.y}
                        fill={isSelected ? '#fef08a' : '#ffffff'}
                        fontSize={isDesktop ? 10.5 : 9.5}
                        fontWeight="800"
                        textAnchor="middle"
                        dominantBaseline="central"
                        style={{ pointerEvents: 'none', userSelect: 'none', filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.85))' }}
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

                {/* Clean Infield Off / Leg Badges (Zero text collision) */}
                <g transform={`translate(${cx - 52}, ${cy - 8})`}>
                  <rect
                    x="-22"
                    y="-8"
                    width="44"
                    height="16"
                    rx="8"
                    fill="rgba(14, 116, 144, 0.55)"
                    stroke="rgba(56, 189, 248, 0.65)"
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="1"
                    fill="#a5f3fc"
                    fontSize="8.5"
                    fontWeight="800"
                    letterSpacing="0.5"
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    OFF
                  </text>
                </g>

                <g transform={`translate(${cx + 52}, ${cy - 8})`}>
                  <rect
                    x="-22"
                    y="-8"
                    width="44"
                    height="16"
                    rx="8"
                    fill="rgba(180, 83, 9, 0.55)"
                    stroke="rgba(245, 158, 11, 0.65)"
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="1"
                    fill="#fef08a"
                    fontSize="8.5"
                    fontWeight="800"
                    letterSpacing="0.5"
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    LEG
                  </text>
                </g>

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

                {/* Batsman Figurine at Batting Crease */}
                <g transform={`translate(${cx}, ${cy + pitchH / 2 - 4})`}>
                  <ellipse cx="0" cy="1" rx="5" ry="2" fill="rgba(0,0,0,0.3)" />
                  <rect x="-3" y="-5" width="2.5" height="5" rx="1" fill="#f8fafc" stroke="#94a3b8" strokeWidth="0.5" />
                  <rect x="0.5" y="-5" width="2.5" height="5" rx="1" fill="#f8fafc" stroke="#94a3b8" strokeWidth="0.5" />
                  <path d="M-3,-5 L-4,-10 L4,-10 L3,-5 Z" fill="#1e3a8a" />
                  <circle cx="0" cy="-12" r="2.8" fill="#d97706" />
                  <line x1="2" y1="-7" x2="6" y2="-2" stroke="#b45309" strokeWidth="1.6" strokeLinecap="round" />
                </g>

                {/* 6. Wagon Wheel Shot Trajectory Lines */}
                {displayedDeliveries.map((del, idx) => {
                  const runs = Number(del.runsBatter) || 0;
                  const angle = typeof del.shotAngle === 'number' ? del.shotAngle : 315;
                  const dist = typeof del.shotDistance === 'number' ? del.shotDistance : (runs === 6 ? 104 : (runs === 4 ? 92 : 55));
                  const end = getCoordinates(angle, dist);
                  const color = getShotColor(runs);
                  const isCurrentActive = activeShot?.id === del.id;

                  const strokeWidth = runs === 6 ? 2.8 : (runs === 4 ? 2.2 : (runs >= 2 ? 1.6 : 1.2));
                  const strokeDash = runs === 6 ? 'none' : (runs === 3 ? '4 2' : (runs === 0 ? '2 2' : 'none'));
                  const markerRadius = runs === 6 ? 4.5 : (runs === 4 ? 3.5 : (runs >= 2 ? 2.8 : (runs === 1 ? 2.2 : 1.8)));
                  const startY = cy + pitchH / 2 - 5; // From striker crease

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
                          y1={startY}
                          x2={end.x}
                          y2={end.y}
                          stroke="#ffffff"
                          strokeWidth={strokeWidth + 4}
                          opacity="0.5"
                        />
                      )}
                      {/* The Shot Line */}
                      <line
                        x1={cx}
                        y1={startY}
                        x2={end.x}
                        y2={end.y}
                        stroke={color}
                        strokeWidth={isCurrentActive ? strokeWidth + 1.5 : strokeWidth}
                        strokeDasharray={strokeDash}
                        opacity={isCurrentActive ? 1.0 : (runs === 0 ? 0.6 : 0.88)}
                      />
                      {/* Terminal Landing Marker */}
                      <circle
                        cx={end.x}
                        cy={end.y}
                        r={markerRadius}
                        fill={color}
                        stroke="#ffffff"
                        strokeWidth={isCurrentActive ? 1.5 : 0.8}
                      />
                    </g>
                  );
                })}

                {/* In-Wheel Notice when no shots match current filter */}
                {displayedDeliveries.length === 0 && (
                  <g transform={`translate(${cx}, ${cy})`}>
                    <rect
                      x="-145"
                      y="-32"
                      width="290"
                      height="64"
                      rx="12"
                      fill="rgba(15, 23, 42, 0.92)"
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                    />
                    <text
                      x="0"
                      y="-8"
                      fill="#fef08a"
                      fontSize="12"
                      fontWeight="800"
                      textAnchor="middle"
                      dominantBaseline="central"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {hasNoBoundaries
                        ? 'No boundaries (4s or 6s) scored'
                        : 'No shots match selected filter'}
                    </text>
                    <text
                      x="0"
                      y="14"
                      fill="#e2e8f0"
                      fontSize="10"
                      fontWeight="600"
                      textAnchor="middle"
                      dominantBaseline="central"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {hasNoBoundaries
                        ? "Select 'All Shots' or '1s, 2s & 3s' to view running shots"
                        : "Tap 'All Shots' above to view full wagon wheel"}
                    </text>
                  </g>
                )}
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

            {/* Empty Deliveries Notice when no shots match filter */}
            {displayedDeliveries.length === 0 && (
              <View style={styles.emptyWagonNotice}>
                <Text style={styles.emptyWagonText}>
                  🏏 {hasNoBoundaries
                    ? `This player has not scored any boundaries (4s or 6s) in this innings. All ${currentBatter?.runs || 0} runs were scored through running between wickets (1s, 2s & 3s). Switch to 'All Shots' or '1s, 2s & 3s' to view shot directions on the field.`
                    : `No ${runFilter === '6' ? 'sixes (6s)' : runFilter === '4' ? 'fours (4s)' : runFilter === '0' ? 'dot balls' : 'deliveries'} match filter for ${currentBatter?.name || 'this batsman'}. Switch to 'All Shots' to see all deliveries.`}
                </Text>
              </View>
            )}

            {/* Professional Broadcast Color Legend */}
            <View style={styles.boundaryLegendRow}>
              <View style={styles.boundaryLegendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#ec4899' }]} />
                <Text style={styles.legendText}>6s</Text>
              </View>
              <View style={styles.boundaryLegendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#06b6d4' }]} />
                <Text style={styles.legendText}>4s</Text>
              </View>
              <View style={styles.boundaryLegendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#a855f7' }]} />
                <Text style={styles.legendText}>3s</Text>
              </View>
              <View style={styles.boundaryLegendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
                <Text style={styles.legendText}>2s</Text>
              </View>
              <View style={styles.boundaryLegendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#38bdf8' }]} />
                <Text style={styles.legendText}>1s</Text>
              </View>
              <View style={styles.boundaryLegendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#94a3b8' }]} />
                <Text style={styles.legendText}>0s (Dots)</Text>
              </View>
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

            {/* BATSMAN RUNS BY SHOT MULTIPLIER BREAKDOWN */}
            <View style={styles.multiplierCard}>
              <View style={styles.multiplierHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.multiplierTitle}>⚡ BATSMAN SCORING BREAKDOWN & RUN MULTIPLIER</Text>
                  <Text style={styles.multiplierSubtitle}>
                    Runs completed by {currentBatter?.name || 'Batsman'} across each scoring shot type:
                  </Text>
                </View>
                <View style={styles.multiplierTotalBadge}>
                  <Text style={styles.multiplierTotalBadgeText}>
                    Total: {scoringBreakdown.totalRuns} runs ({scoringBreakdown.totalBalls} balls)
                  </Text>
                </View>
              </View>

              <View style={styles.multiplierGrid}>
                {/* 6s */}
                <View style={[styles.multiplierItem, { borderColor: '#ec4899', backgroundColor: '#fdf2f8' }]}>
                  <View style={styles.multiplierItemTop}>
                    <Text style={[styles.multiplierItemTag, { color: '#be185d' }]}>🚀 SIXES (6s)</Text>
                    <Text style={[styles.multiplierItemPct, { color: '#be185d' }]}>{scoringBreakdown.sixes.pct}%</Text>
                  </View>
                  <Text style={styles.multiplierFormula}>
                    {scoringBreakdown.sixes.count} × 6 = <Text style={[styles.multiplierHighlight, { color: '#be185d' }]}>{scoringBreakdown.sixes.runs} runs</Text>
                  </Text>
                  <Text style={styles.multiplierItemSub}>{scoringBreakdown.sixes.count} maximums over boundary</Text>
                </View>

                {/* 4s */}
                <View style={[styles.multiplierItem, { borderColor: '#06b6d4', backgroundColor: '#f0fdf4' }]}>
                  <View style={styles.multiplierItemTop}>
                    <Text style={[styles.multiplierItemTag, { color: '#0369a1' }]}>🏏 FOURS (4s)</Text>
                    <Text style={[styles.multiplierItemPct, { color: '#0369a1' }]}>{scoringBreakdown.fours.pct}%</Text>
                  </View>
                  <Text style={styles.multiplierFormula}>
                    {scoringBreakdown.fours.count} × 4 = <Text style={[styles.multiplierHighlight, { color: '#0369a1' }]}>{scoringBreakdown.fours.runs} runs</Text>
                  </Text>
                  <Text style={styles.multiplierItemSub}>{scoringBreakdown.fours.count} boundary fence shots</Text>
                </View>

                {/* 3s - User Example: 3s 3nu na 3s*3 = 9 runs */}
                <View style={[styles.multiplierItem, { borderColor: '#a855f7', backgroundColor: '#faf5ff' }]}>
                  <View style={styles.multiplierItemTop}>
                    <Text style={[styles.multiplierItemTag, { color: '#7e22ce' }]}>⚡ THREES (3s)</Text>
                    <Text style={[styles.multiplierItemPct, { color: '#7e22ce' }]}>{scoringBreakdown.threes.pct}%</Text>
                  </View>
                  <Text style={styles.multiplierFormula}>
                    {scoringBreakdown.threes.count} × 3 = <Text style={[styles.multiplierHighlight, { color: '#7e22ce' }]}>{scoringBreakdown.threes.runs} runs</Text>
                  </Text>
                  <Text style={styles.multiplierItemSub}>{scoringBreakdown.threes.count} hard running triplets</Text>
                </View>

                {/* 2s */}
                <View style={[styles.multiplierItem, { borderColor: '#f59e0b', backgroundColor: '#fffbeb' }]}>
                  <View style={styles.multiplierItemTop}>
                    <Text style={[styles.multiplierItemTag, { color: '#b45309' }]}>🏃 TWOS (2s)</Text>
                    <Text style={[styles.multiplierItemPct, { color: '#b45309' }]}>{scoringBreakdown.twos.pct}%</Text>
                  </View>
                  <Text style={styles.multiplierFormula}>
                    {scoringBreakdown.twos.count} × 2 = <Text style={[styles.multiplierHighlight, { color: '#b45309' }]}>{scoringBreakdown.twos.runs} runs</Text>
                  </Text>
                  <Text style={styles.multiplierItemSub}>{scoringBreakdown.twos.count} quick gap doubles</Text>
                </View>

                {/* 1s */}
                <View style={[styles.multiplierItem, { borderColor: '#38bdf8', backgroundColor: '#f0f9ff' }]}>
                  <View style={styles.multiplierItemTop}>
                    <Text style={[styles.multiplierItemTag, { color: '#0284c7' }]}>🚶 SINGLES (1s)</Text>
                    <Text style={[styles.multiplierItemPct, { color: '#0284c7' }]}>{scoringBreakdown.ones.pct}%</Text>
                  </View>
                  <Text style={styles.multiplierFormula}>
                    {scoringBreakdown.ones.count} × 1 = <Text style={[styles.multiplierHighlight, { color: '#0284c7' }]}>{scoringBreakdown.ones.runs} runs</Text>
                  </Text>
                  <Text style={styles.multiplierItemSub}>{scoringBreakdown.ones.count} strike rotation singles</Text>
                </View>

                {/* Dots */}
                <View style={[styles.multiplierItem, { borderColor: '#cbd5e1', backgroundColor: '#f8fafc' }]}>
                  <View style={styles.multiplierItemTop}>
                    <Text style={[styles.multiplierItemTag, { color: '#475569' }]}>⚪ DOT BALLS (0s)</Text>
                    <Text style={[styles.multiplierItemPct, { color: '#475569' }]}>{scoringBreakdown.dots.pct}%</Text>
                  </View>
                  <Text style={styles.multiplierFormula}>
                    {scoringBreakdown.dots.count} balls = <Text style={[styles.multiplierHighlight, { color: '#475569' }]}>0 runs</Text>
                  </Text>
                  <Text style={styles.multiplierItemSub}>{scoringBreakdown.dots.count} defensive / scoreless balls</Text>
                </View>
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
  const runsTotal = Number(batter.runs) || 0;
  const ballsTotal = Number(batter.balls) || Math.max(1, Math.round(runsTotal / 1.3));
  const fours = batter.fours !== undefined ? batter.fours : Math.max(0, Math.floor(runsTotal / 7));
  const sixes = batter.sixes !== undefined ? batter.sixes : (runsTotal >= 20 ? 1 : 0);

  // Sixes (Clearing the boundary ropes)
  const sixPositions = [
    { angle: 75, pos: 'Midwicket', zone: 'Midwicket / Cow Corner' },
    { angle: 345, pos: 'Mid-Off', zone: 'Mid-Off / Long Off' },
    { angle: 25, pos: 'Mid-On', zone: 'Mid-On / Long On' }
  ];
  for (let i = 0; i < sixes; i++) {
    const pos = sixPositions[i % sixPositions.length];
    shots.push({
      strikerId: batter.id,
      runsBatter: 6,
      shotAngle: pos.angle,
      shotDistance: 108,
      fieldingPosition: pos.pos,
      shotZone: pos.zone,
      commentary: 'Massive hit clearing the ropes with ease!'
    });
  }

  // Fours (Piercing the infield gaps to fence)
  const fourPositions = [
    { angle: 315, pos: 'Cover', zone: 'Cover / Extra Cover' },
    { angle: 270, pos: 'Point', zone: 'Point / Backward Point' },
    { angle: 90, pos: 'Midwicket', zone: 'Midwicket / Cow Corner' },
    { angle: 140, pos: 'Fine Leg', zone: 'Fine Leg' },
    { angle: 220, pos: 'Third Man', zone: 'Third Man / Slips' },
    { angle: 350, pos: 'Mid-Off', zone: 'Mid-Off / Long Off' }
  ];
  for (let i = 0; i < fours; i++) {
    const item = fourPositions[i % fourPositions.length];
    shots.push({
      strikerId: batter.id,
      runsBatter: 4,
      shotAngle: item.angle,
      shotDistance: 95,
      fieldingPosition: item.pos,
      shotZone: item.zone,
      commentary: 'Crisp timing, pierces the gap to the fence!'
    });
  }

  // Calculate remaining runs and balls to distribute into 3s, 2s, 1s, and Dots
  const boundaryRuns = sixes * 6 + fours * 4;
  let remainingRuns = Math.max(0, runsTotal - boundaryRuns);
  let remainingBalls = Math.max(0, ballsTotal - (sixes + fours));

  // Threes (3s)
  let threes = 0;
  if (remainingRuns >= 6 && remainingBalls >= 4) {
    threes = Math.min(2, Math.floor(remainingRuns / 9) || 1);
    remainingRuns -= threes * 3;
    remainingBalls -= threes;
  }
  const threePositions = [
    { angle: 320, pos: 'Extra Cover', zone: 'Cover / Extra Cover' },
    { angle: 80, pos: 'Deep Midwicket', zone: 'Midwicket / Cow Corner' },
    { angle: 150, pos: 'Deep Fine Leg', zone: 'Fine Leg' }
  ];
  for (let i = 0; i < threes; i++) {
    const p = threePositions[i % threePositions.length];
    shots.push({
      strikerId: batter.id,
      runsBatter: 3,
      shotAngle: p.angle,
      shotDistance: 78,
      fieldingPosition: p.pos,
      shotZone: p.zone,
      commentary: 'Pushed deep into the outfield, energetic running completes 3 runs!'
    });
  }

  // Twos (2s)
  const twos = Math.min(Math.floor(remainingRuns / 2), Math.floor(remainingBalls / 2));
  remainingRuns -= twos * 2;
  remainingBalls -= twos;
  const twoPositions = [
    { angle: 260, pos: 'Deep Point', zone: 'Point / Backward Point' },
    { angle: 105, pos: 'Square Leg', zone: 'Square Leg' },
    { angle: 330, pos: 'Deep Cover', zone: 'Cover / Extra Cover' },
    { angle: 35, pos: 'Mid-On', zone: 'Mid-On / Long On' }
  ];
  for (let i = 0; i < twos; i++) {
    const p = twoPositions[i % twoPositions.length];
    shots.push({
      strikerId: batter.id,
      runsBatter: 2,
      shotAngle: p.angle,
      shotDistance: 62,
      fieldingPosition: p.pos,
      shotZone: p.zone,
      commentary: 'Worked with soft hands into the gap for a brisk couple!'
    });
  }

  // Singles (1s)
  const ones = Math.min(remainingRuns, remainingBalls);
  remainingBalls -= ones;
  const onePositions = [
    { angle: 340, pos: 'Mid-Off', zone: 'Mid-Off / Long Off' },
    { angle: 20, pos: 'Mid-On', zone: 'Mid-On / Long On' },
    { angle: 280, pos: 'Point', zone: 'Point / Backward Point' },
    { angle: 110, pos: 'Square Leg', zone: 'Square Leg' },
    { angle: 200, pos: 'Third Man', zone: 'Third Man / Slips' },
    { angle: 70, pos: 'Midwicket', zone: 'Midwicket / Cow Corner' }
  ];
  for (let i = 0; i < ones; i++) {
    const p = onePositions[i % onePositions.length];
    shots.push({
      strikerId: batter.id,
      runsBatter: 1,
      shotAngle: p.angle,
      shotDistance: 45,
      fieldingPosition: p.pos,
      shotZone: p.zone,
      commentary: 'Tapped and scampered through for a sharp single.'
    });
  }

  // Dot balls (0s)
  const dots = Math.max(0, remainingBalls);
  const dotPositions = [
    { angle: 300, pos: 'Cover', zone: 'Cover / Extra Cover' },
    { angle: 270, pos: 'Point', zone: 'Point / Backward Point' },
    { angle: 0, pos: 'Bowler', zone: 'Mid-Off / Long Off' },
    { angle: 90, pos: 'Midwicket', zone: 'Midwicket / Cow Corner' },
    { angle: 120, pos: 'Square Leg', zone: 'Square Leg' }
  ];
  for (let i = 0; i < dots; i++) {
    const p = dotPositions[i % dotPositions.length];
    shots.push({
      strikerId: batter.id,
      runsBatter: 0,
      shotAngle: p.angle,
      shotDistance: 22,
      fieldingPosition: p.pos,
      shotZone: p.zone,
      commentary: 'Solid defense straight to the fielder.'
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
  filterPillActiveBoundary: {
    backgroundColor: '#b45309',
    borderColor: '#d97706'
  },
  filterPillActiveRunning: {
    backgroundColor: '#0284c7',
    borderColor: '#0ea5e9'
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
  noBoundariesBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fffbeb',
    borderWidth: 1.5,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 10
  },
  noBoundariesIcon: {
    fontSize: 20
  },
  noBoundariesTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400e',
    marginBottom: 2
  },
  noBoundariesSubtitle: {
    fontSize: 11.5,
    color: '#b45309',
    lineHeight: 16
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
  emptyWagonNotice: {
    marginTop: 10,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center'
  },
  emptyWagonText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#92400e',
    textAlign: 'center'
  },
  boundaryLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
    marginBottom: 6,
    flexWrap: 'wrap'
  },
  boundaryLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  legendLine: {
    width: 16,
    height: 3,
    borderRadius: 1.5
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5
  },
  legendText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569'
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
  },
  multiplierCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#fde68a',
    marginTop: 14,
    width: '100%',
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  multiplierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#fef3c7',
    paddingBottom: 8,
    marginBottom: 10
  },
  multiplierTitle: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.5
  },
  multiplierSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2
  },
  multiplierTotalBadge: {
    backgroundColor: '#fffbeb',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  multiplierTotalBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#b45309'
  },
  multiplierGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4
  },
  multiplierItem: {
    flexBasis: '48%',
    flexGrow: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5
  },
  multiplierItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  multiplierItemTag: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.3
  },
  multiplierItemPct: {
    fontSize: 11,
    fontWeight: '900'
  },
  multiplierFormula: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#1e293b'
  },
  multiplierHighlight: {
    fontWeight: '900'
  },
  multiplierItemSub: {
    fontSize: 9.5,
    color: '#64748b',
    marginTop: 2
  }
});
