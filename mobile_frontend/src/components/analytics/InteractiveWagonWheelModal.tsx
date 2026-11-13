import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  ScrollView,
  useWindowDimensions
} from 'react-native';

export interface ShotDirectionResult {
  zone: string;
  side: 'OFF' | 'LEG' | 'STRAIGHT';
  angle: number;
  distance: number; // 0 to 100 (%)
  distanceMeters: number; // calculated meters (e.g. 15m to 85m)
  x: number;
  y: number;
  battingHand: 'RIGHT' | 'LEFT';
}

interface InteractiveWagonWheelModalProps {
  visible: boolean;
  runs: number;
  batterName?: string;
  initialBattingHand?: 'RIGHT' | 'LEFT';
  onConfirm: (result: ShotDirectionResult) => void;
  onSkip: () => void;
  onClose: () => void;
}

// 10 Cricket Field Direction Zones (Standard International Cricket Specification)
interface ZoneDef {
  id: string;
  name: string;
  shortName: string;
  side: 'OFF' | 'LEG' | 'STRAIGHT';
  standardAngleRHB: number; // Center angle in degrees (0 = Straight / 12 o'clock, clockwise)
  color: string;
}

const FIELD_ZONES: ZoneDef[] = [
  // OFF SIDE (Right Hand Batsman perspective)
  { id: 'third_man', name: 'Third Man', shortName: '3rd Man', side: 'OFF', standardAngleRHB: 220, color: '#ec4899' },
  { id: 'point', name: 'Point', shortName: 'Point', side: 'OFF', standardAngleRHB: 265, color: '#06b6d4' },
  { id: 'cover', name: 'Cover', shortName: 'Cover', side: 'OFF', standardAngleRHB: 298, color: '#10b981' },
  { id: 'extra_cover', name: 'Extra Cover', shortName: 'Ex Cover', side: 'OFF', standardAngleRHB: 325, color: '#3b82f6' },
  { id: 'long_off', name: 'Long Off', shortName: 'Long Off', side: 'OFF', standardAngleRHB: 345, color: '#8b5cf6' },

  // STRAIGHT
  { id: 'straight', name: 'Straight', shortName: 'Straight', side: 'STRAIGHT', standardAngleRHB: 0, color: '#eab308' },

  // LEG SIDE (Right Hand Batsman perspective)
  { id: 'long_on', name: 'Long On', shortName: 'Long On', side: 'LEG', standardAngleRHB: 25, color: '#f59e0b' },
  { id: 'mid_wicket', name: 'Mid Wicket', shortName: 'Mid Wkt', side: 'LEG', standardAngleRHB: 68, color: '#ef4444' },
  { id: 'square_leg', name: 'Square Leg', shortName: 'Sq Leg', side: 'LEG', standardAngleRHB: 112, color: '#f97316' },
  { id: 'fine_leg', name: 'Fine Leg', shortName: 'Fine Leg', side: 'LEG', standardAngleRHB: 155, color: '#a855f7' }
];

export const InteractiveWagonWheelModal: React.FC<InteractiveWagonWheelModalProps> = ({
  visible,
  runs,
  batterName = 'Batter',
  initialBattingHand = 'RIGHT',
  onConfirm,
  onSkip,
  onClose
}) => {
  const { width, height } = useWindowDimensions();
  const isMobile = width < 600;

  // Striker orientation (Right-hand or Left-hand)
  const [battingHand, setBattingHand] = useState<'RIGHT' | 'LEFT'>(initialBattingHand);

  useEffect(() => {
    if (initialBattingHand) {
      setBattingHand(initialBattingHand);
    }
  }, [initialBattingHand, visible]);

  // Dynamic responsive dimensions to guarantee modal fits viewport cleanly
  const maxWheelByHeight = Math.max(160, Math.min(230, Math.floor((height || 700) * 0.28)));
  const renderSize = isMobile ? Math.min(width - 56, maxWheelByHeight) : maxWheelByHeight;

  // Coordinate geometry for 380x380 SVG top-down field
  const size = 380;
  const cx = size / 2; // 190
  const cy = size / 2; // 190
  const groundRadius = 168; // Outer boundary rope
  const innerCircleRadius = 78; // 30-yard circle
  const pitchWidth = 14;
  const pitchHeight = 44;
  const pitchY = cy - pitchHeight / 2;
  const strikerX = cx;
  const strikerY = cy + 14; // Striker stands at bottom batting crease

  // Landing position state (initialized based on runs)
  const defaultAngle = runs >= 6 ? 325 : (runs === 4 ? 298 : 345);
  const defaultDist = runs >= 6 ? 96 : (runs === 4 ? 92 : 60);

  const getPosFromAngleDist = (angleDeg: number, distPct: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    const r = (distPct / 100) * groundRadius;
    return {
      x: strikerX + r * Math.sin(rad),
      y: strikerY - r * Math.cos(rad)
    };
  };

  const initialPos = getPosFromAngleDist(defaultAngle, defaultDist);
  const [landingX, setLandingX] = useState<number>(initialPos.x);
  const [landingY, setLandingY] = useState<number>(initialPos.y);
  const [selectedAngle, setSelectedAngle] = useState<number>(defaultAngle);
  const [selectedDistPct, setSelectedDistPct] = useState<number>(defaultDist);
  const [selectedZone, setSelectedZone] = useState<ZoneDef>(FIELD_ZONES[3]); // Extra Cover

  // Trajectory flight animation progress (0.0 to 1.0)
  const [animProgress, setAnimProgress] = useState<number>(1);
  const animRef = useRef<any>(null);

  // Trigger smooth ball flight animation
  const triggerBallAnimation = (targetX: number, targetY: number) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setAnimProgress(0);
    const startTime = Date.now();
    const duration = 520; // 520ms smooth trajectory flight

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Quad ease-out for realistic decelerating ball flight
      const ease = 1 - Math.pow(1 - progress, 2);
      setAnimProgress(ease);
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setAnimProgress(1);
      }
    };
    animRef.current = requestAnimationFrame(animate);
  };

  // Re-trigger animation when modal opens
  useEffect(() => {
    if (visible) {
      const defAngle = runs >= 6 ? 325 : (runs === 4 ? 298 : 345);
      const defDist = runs >= 6 ? 96 : (runs === 4 ? 92 : 60);
      let adjustedAngle = defAngle;
      if (battingHand === 'LEFT') {
        adjustedAngle = (360 - defAngle) % 360;
      }
      const pos = getPosFromAngleDist(adjustedAngle, defDist);
      setLandingX(pos.x);
      setLandingY(pos.y);
      resolveZoneFromCoords(pos.x, pos.y, battingHand);
      setTimeout(() => {
        triggerBallAnimation(pos.x, pos.y);
      }, 100);
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [visible, runs, battingHand]);

  // Compute angle, distance & closest field zone from landing (x,y)
  const resolveZoneFromCoords = (x: number, y: number, hand: 'RIGHT' | 'LEFT') => {
    const dx = x - strikerX;
    const dy = strikerY - y; // Screen Y goes down, so invert for standard cartesian
    let deg = (Math.atan2(dx, dy) * 180) / Math.PI;
    if (deg < 0) deg += 360;

    const dist = Math.sqrt(dx * dx + dy * dy);
    const distPct = Math.min(100, Math.round((dist / groundRadius) * 100));

    // For Left Hand Batsman, mirror angles relative to straight (0 deg)
    let effectiveAngle = deg;
    if (hand === 'LEFT') {
      effectiveAngle = (360 - deg) % 360;
    }

    // Find zone whose standardAngleRHB is closest to effectiveAngle
    let closest = FIELD_ZONES[0];
    let minDiff = 999;
    for (const z of FIELD_ZONES) {
      let diff = Math.abs(z.standardAngleRHB - effectiveAngle);
      if (diff > 180) diff = 360 - diff;
      if (diff < minDiff) {
        minDiff = diff;
        closest = z;
      }
    }

    setSelectedAngle(Math.round(deg));
    setSelectedDistPct(distPct);
    setSelectedZone(closest);

    return { deg, distPct, zone: closest };
  };

  // Handle click / tap on SVG ground
  const handleGroundPress = (event: any) => {
    const nativeEvent = event.nativeEvent;
    let localX = 0;
    let localY = 0;

    if (nativeEvent.locationX !== undefined && nativeEvent.locationY !== undefined) {
      localX = nativeEvent.locationX;
      localY = nativeEvent.locationY;
    } else if (nativeEvent.offsetX !== undefined && nativeEvent.offsetY !== undefined) {
      localX = nativeEvent.offsetX;
      localY = nativeEvent.offsetY;
    } else if (nativeEvent.clientX !== undefined && event.currentTarget?.getBoundingClientRect) {
      const rect = event.currentTarget.getBoundingClientRect();
      localX = nativeEvent.clientX - rect.left;
      localY = nativeEvent.clientY - rect.top;
    }

    const scale = size / (isMobile ? Math.min(width - 40, 340) : 340);
    const svgX = Math.round(localX * scale);
    const svgY = Math.round(localY * scale);

    const dx = svgX - strikerX;
    const dy = svgY - strikerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = groundRadius + 6;

    let finalX = svgX;
    let finalY = svgY;
    if (dist > maxRadius) {
      finalX = strikerX + (dx / dist) * maxRadius;
      finalY = strikerY + (dy / dist) * maxRadius;
    }

    setLandingX(finalX);
    setLandingY(finalY);
    resolveZoneFromCoords(finalX, finalY, battingHand);
    triggerBallAnimation(finalX, finalY);
  };

  // Handle clicking quick zone chips
  const handleZoneSelect = (zone: ZoneDef) => {
    let targetAngle = zone.standardAngleRHB;
    if (battingHand === 'LEFT') {
      targetAngle = (360 - zone.standardAngleRHB) % 360;
    }
    const dist = runs >= 6 ? 96 : (runs === 4 ? 92 : 62);
    const pos = getPosFromAngleDist(targetAngle, dist);

    setLandingX(pos.x);
    setLandingY(pos.y);
    setSelectedAngle(Math.round(targetAngle));
    setSelectedDistPct(dist);
    setSelectedZone(zone);
    triggerBallAnimation(pos.x, pos.y);
  };

  // Confirm and submit
  const handleConfirm = () => {
    const meters = Math.round(15 + (selectedDistPct / 100) * 65);
    onConfirm({
      zone: selectedZone.name,
      side: selectedZone.side,
      angle: selectedAngle,
      distance: selectedDistPct,
      distanceMeters: meters,
      x: landingX,
      y: landingY,
      battingHand
    });
  };

  const currentBallX = strikerX + (landingX - strikerX) * animProgress;
  const currentBallY = strikerY + (landingY - strikerY) * animProgress;
  const ballElevation = Math.sin(animProgress * Math.PI) * (runs === 6 ? 1.6 : 1.25);
  const ballScale = 1 + (ballElevation - 1) * 0.45;

  const offSideZones = useMemo(() => {
    return FIELD_ZONES.filter(z => z.side === 'OFF');
  }, []);

  const legSideZones = useMemo(() => {
    return FIELD_ZONES.filter(z => z.side === 'LEG' || z.side === 'STRAIGHT');
  }, []);

  const distanceMeters = Math.round(15 + (selectedDistPct / 100) * 65);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { maxWidth: isMobile ? 380 : 460 }]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
            bounces={false}
          >
          {/* Top Sunlight Header Bar */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.titleIcon}>🎯</Text>
                <Text style={styles.titleText}>WAGON WHEEL</Text>
                <View style={[
                  styles.runPill,
                  runs === 6 ? styles.runPillSix : (runs === 4 ? styles.runPillFour : styles.runPillOther)
                ]}>
                  <Text style={styles.runPillText}>
                    {runs === 6 ? '🚀 6 RUNS' : (runs === 4 ? '⚡ 4 RUNS' : `🏏 ${runs} RUNS`)}
                  </Text>
                </View>
              </View>
              <Text style={styles.subtitleText}>
                Select shot landing direction for <Text style={styles.batterNameHighlight}>{batterName}</Text>
              </Text>
            </View>

            {/* Close Button */}
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Batting Hand Toggle Bar (RHB vs LHB) in Daylight Gold & Yellow Theme */}
          <View style={styles.handToggleRow}>
            <Text style={styles.handToggleLabel}>STRIKER ORIENTATION:</Text>
            <View style={styles.handBtnGroup}>
              <TouchableOpacity
                style={[styles.handBtn, battingHand === 'RIGHT' && styles.handBtnActive]}
                onPress={() => setBattingHand('RIGHT')}
                activeOpacity={0.8}
              >
                <Text style={[styles.handBtnText, battingHand === 'RIGHT' && styles.handBtnTextActive]}>
                  🏏 RHB (Right Hand)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.handBtn, battingHand === 'LEFT' && styles.handBtnActive]}
                onPress={() => setBattingHand('LEFT')}
                activeOpacity={0.8}
              >
                <Text style={[styles.handBtnText, battingHand === 'LEFT' && styles.handBtnTextActive]}>
                  🏏 LHB (Left Hand)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Interactive Daylight SVG Cricket Ground */}
          <View style={styles.groundWrapper}>
            <TouchableOpacity
              activeOpacity={0.95}
              style={[styles.groundBox, { width: renderSize, height: renderSize }]}
              onPress={handleGroundPress}
            >
              <svg
                width={renderSize}
                height={renderSize}
                viewBox={`0 0 ${size} ${size}`}
                style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair', userSelect: 'none' }}
              >
                <defs>
                  {/* Natural Sunlight Outfield Turf Gradients (Bright, lush green for daytime play) */}
                  <radialGradient id="fieldGrassDay" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="55%" stopColor="#16a34a" />
                    <stop offset="88%" stopColor="#15803d" />
                    <stop offset="100%" stopColor="#166534" />
                  </radialGradient>

                  {/* Concentric Mower Stripes */}
                  <radialGradient id="lawnPatternDay" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(255, 255, 255, 0.08)" />
                    <stop offset="25%" stopColor="rgba(0, 0, 0, 0.06)" />
                    <stop offset="50%" stopColor="rgba(255, 255, 255, 0.08)" />
                    <stop offset="75%" stopColor="rgba(0, 0, 0, 0.06)" />
                    <stop offset="100%" stopColor="rgba(255, 255, 255, 0.08)" />
                  </radialGradient>

                  {/* Pitch Texture Gradient: Authentic Clay Strip */}
                  <linearGradient id="pitchTextureDay" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#d97706" />
                    <stop offset="35%" stopColor="#fef08a" />
                    <stop offset="65%" stopColor="#fde047" />
                    <stop offset="100%" stopColor="#b45309" />
                  </linearGradient>

                  {/* Trajectory Glow Filter */}
                  <filter id="trajGlowDay" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  {/* Ball 3D Shading */}
                  <radialGradient id="cricketBallDay" cx="35%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#ff4d4d" />
                    <stop offset="50%" stopColor="#dc2626" />
                    <stop offset="100%" stopColor="#7f1d1d" />
                  </radialGradient>

                  {/* Landing Ripple Glow */}
                  <radialGradient id="rippleGlowDay" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={runs === 6 ? '#f59e0b' : (runs === 4 ? '#0284c7' : '#10b981')} stopOpacity="0.8" />
                    <stop offset="60%" stopColor={runs === 6 ? '#f59e0b' : (runs === 4 ? '#0284c7' : '#10b981')} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={runs === 6 ? '#f59e0b' : (runs === 4 ? '#0284c7' : '#10b981')} stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* 1. Main Outfield Oval Circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={groundRadius}
                  fill="url(#fieldGrassDay)"
                  stroke="#b8860b"
                  strokeWidth="2.5"
                />

                {/* 2. Concentric Mowing Grass Rings Overlay */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={groundRadius}
                  fill="url(#lawnPatternDay)"
                  style={{ pointerEvents: 'none' }}
                />

                {/* Distance Circles (25m, 50m, 75m) */}
                <circle cx={cx} cy={cy} r={groundRadius * 0.35} fill="none" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx={cx} cy={cy} r={groundRadius * 0.70} fill="none" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="1" strokeDasharray="3 3" />

                {/* 3. 30-Yard Inner Field Circle (Crisp White Dashed Ring) */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={innerCircleRadius}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />

                {/* 4. White Boundary Rope with Clean Rim */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={groundRadius}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3"
                />

                {/* 5. 10 Zone Sector Divider Radial Rays & High-Contrast Zone Labels */}
                {FIELD_ZONES.map((zone) => {
                  let angle = zone.standardAngleRHB;
                  if (battingHand === 'LEFT') {
                    angle = (360 - zone.standardAngleRHB) % 360;
                  }
                  const rad = (angle * Math.PI) / 180;
                  const borderX = strikerX + groundRadius * Math.sin(rad);
                  const borderY = strikerY - groundRadius * Math.cos(rad);
                  const labelRadius = groundRadius * 0.84;
                  const labelX = strikerX + labelRadius * Math.sin(rad);
                  const labelY = strikerY - labelRadius * Math.cos(rad);
                  const isZoneActive = selectedZone.id === zone.id;

                  return (
                    <g key={zone.id}>
                      {/* Radial boundary ray */}
                      <line
                        x1={strikerX}
                        y1={strikerY}
                        x2={borderX}
                        y2={borderY}
                        stroke={isZoneActive ? '#fef08a' : 'rgba(255, 255, 255, 0.25)'}
                        strokeWidth={isZoneActive ? 2 : 1}
                        strokeDasharray={isZoneActive ? 'none' : '3 3'}
                      />
                      {/* Floating Zone Name Label (White with dark shadow for outdoor sun visibility) */}
                      <text
                        x={labelX}
                        y={labelY}
                        fill={isZoneActive ? '#fef08a' : '#ffffff'}
                        fontSize={isZoneActive ? 10.5 : 8.5}
                        fontWeight="900"
                        textAnchor="middle"
                        dominantBaseline="central"
                        filter="drop-shadow(0 1px 2px rgba(0,0,0,0.85))"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {zone.shortName}
                      </text>
                    </g>
                  );
                })}

                {/* 6. Realistic Cricket Pitch in the Center (Clay Strip with Popping Creases) */}
                <rect
                  x={cx - 8}
                  y={cy - 24}
                  width="16"
                  height="48"
                  rx="2"
                  fill="url(#pitchTextureDay)"
                  stroke="#78350f"
                  strokeWidth="1.2"
                />

                {/* Bowling Creases & Popping Creases */}
                {/* Non-Striker Crease (Top) */}
                <line x1={cx - 12} y1={cy - 17} x2={cx + 12} y2={cy - 17} stroke="#ffffff" strokeWidth="1.2" />
                {/* Non-Striker Stumps */}
                <line x1={cx - 3.5} y1={cy - 20} x2={cx + 3.5} y2={cy - 20} stroke="#fef08a" strokeWidth="2.5" strokeLinecap="round" />

                {/* Striker Crease (Bottom) */}
                <line x1={cx - 12} y1={cy + 17} x2={cx + 12} y2={cy + 17} stroke="#ffffff" strokeWidth="1.2" />
                {/* Striker Stumps */}
                <line x1={cx - 3.5} y1={cy + 20} x2={cx + 3.5} y2={cy + 20} stroke="#fef08a" strokeWidth="2.5" strokeLinecap="round" />

                {/* ─── 7. PROMINENT BATSMAN FIGURINE AT STRIKER'S CREASE ─── */}
                <g transform={`translate(${strikerX}, ${strikerY})`}>
                  {/* Shadow under batsman */}
                  <ellipse cx="0" cy="5" rx="9" ry="3.5" fill="rgba(0,0,0,0.3)" />

                  {/* Batting Pads on Legs */}
                  <rect x="-4.5" y="1" width="3.2" height="6" rx="1.5" fill="#ffffff" stroke="#94a3b8" strokeWidth="0.6" />
                  <rect x="1.3" y="1" width="3.2" height="6" rx="1.5" fill="#ffffff" stroke="#94a3b8" strokeWidth="0.6" />

                  {/* Body / Jersey (TNCA Royal Navy with Golden Trim) */}
                  <path
                    d="M -4.5 1 L -5 -6 L 5 -6 L 4.5 1 Z"
                    fill="#1e3a8a"
                    stroke="#f59e0b"
                    strokeWidth="0.8"
                  />

                  {/* Batting Helmet with Visor */}
                  <circle cx="0" cy="-9" r="4.2" fill="#0f172a" stroke="#f59e0b" strokeWidth="0.8" />
                  {/* Visor Grill pointing in batting stance */}
                  <path
                    d={battingHand === 'RIGHT' ? 'M 0 -8.5 L 3.5 -7' : 'M 0 -8.5 L -3.5 -7'}
                    stroke="#ffffff"
                    strokeWidth="1"
                    strokeLinecap="round"
                  />

                  {/* Cricket Bat in Batting Stance (Tilted toward slips/sweet-spot) */}
                  <line
                    x1={battingHand === 'RIGHT' ? '-2' : '2'}
                    y1="-3"
                    x2={battingHand === 'RIGHT' ? '-11' : '11'}
                    y2="6"
                    stroke="#b45309"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                  {/* Bat Willow Blade Highlight */}
                  <line
                    x1={battingHand === 'RIGHT' ? '-4' : '4'}
                    y1="-1"
                    x2={battingHand === 'RIGHT' ? '-10' : '10'}
                    y2="5"
                    stroke="#fef08a"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </g>

                {/* Floating Batsman Indicator Tag */}
                <g transform={`translate(${strikerX}, ${strikerY - 22})`}>
                  <rect x="-38" y="-7" width="76" height="14" rx="7" fill="#0f172a" stroke="#f59e0b" strokeWidth="1" />
                  <text
                    x="0"
                    y="0"
                    fill="#fef08a"
                    fontSize="7.5"
                    fontWeight="900"
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    🏏 {batterName.split(' ')[0]} ({battingHand})
                  </text>
                </g>

                {/* 8. Trajectory Line: Glowing Line from Striker to Target */}
                {/* Outer Glow Line */}
                <line
                  x1={strikerX}
                  y1={strikerY}
                  x2={currentBallX}
                  y2={currentBallY}
                  stroke={runs === 6 ? '#f59e0b' : (runs === 4 ? '#0284c7' : '#10b981')}
                  strokeWidth="5"
                  strokeOpacity="0.45"
                  strokeLinecap="round"
                  filter="url(#trajGlowDay)"
                />
                {/* Core Trajectory Line */}
                <line
                  x1={strikerX}
                  y1={strikerY}
                  x2={currentBallX}
                  y2={currentBallY}
                  stroke={runs === 6 ? '#fef08a' : (runs === 4 ? '#38bdf8' : '#6ee7b7')}
                  strokeWidth="2.8"
                  strokeLinecap="round"
                />

                {/* 9. Landing Marker: Pulsing Beacon & Target Pin */}
                {animProgress >= 0.85 && (
                  <g transform={`translate(${landingX}, ${landingY})`}>
                    {/* Animated Ripple Waves */}
                    <circle cx="0" cy="0" r="16" fill="url(#rippleGlowDay)" />
                    <circle cx="0" cy="0" r="10" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.75" />
                    {/* Center Landing Pin */}
                    <circle
                      cx="0"
                      cy="0"
                      r="5.5"
                      fill={runs === 6 ? '#f59e0b' : (runs === 4 ? '#0284c7' : '#10b981')}
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    {/* Run Number Inside Landing Pin */}
                    <text
                      x="0"
                      y="0.5"
                      fill="#ffffff"
                      fontSize="6.5"
                      fontWeight="900"
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {runs}
                    </text>
                  </g>
                )}

                {/* 10. Flying Cricket Ball */}
                {animProgress < 1 && (
                  <circle
                    cx={currentBallX}
                    cy={currentBallY}
                    r={4 * ballScale}
                    fill="url(#cricketBallDay)"
                    stroke="#ffffff"
                    strokeWidth="0.8"
                  />
                )}
              </svg>
            </TouchableOpacity>

            <Text style={styles.groundHint}>
              👆 Tap / Click anywhere on the daylight field to set shot landing location
            </Text>
          </View>

          {/* Selected Direction Preview Card (Sunlight High Contrast Theme) */}
          <View style={styles.previewCard}>
            <View style={styles.previewRow}>
              <View style={styles.previewZoneBadge}>
                <Text style={styles.previewZoneSideTag}>
                  {selectedZone.side === 'OFF' ? '🏏 OFF SIDE' : (selectedZone.side === 'LEG' ? '🏏 LEG SIDE' : '🎯 STRAIGHT')}
                </Text>
                <Text style={styles.previewZoneName}>{selectedZone.name}</Text>
              </View>

              <View style={styles.previewMetrics}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>ANGLE</Text>
                  <Text style={styles.metricVal}>{selectedAngle}°</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>DISTANCE</Text>
                  <Text style={styles.metricVal}>{distanceMeters}m ({selectedDistPct}%)</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.replayBtn}
                onPress={() => triggerBallAnimation(landingX, landingY)}
                activeOpacity={0.7}
              >
                <Text style={styles.replayBtnText}>🔄 Replay</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Selection Zone Chips (Daylight High-Contrast Themed) */}
          <View style={styles.quickChipsSection}>
            {/* Off Side */}
            <View style={styles.chipGroup}>
              <Text style={styles.chipGroupLabel}>OFF SIDE:</Text>
              <View style={styles.chipRow}>
                {offSideZones.map((z) => {
                  const isActive = selectedZone.id === z.id;
                  return (
                    <TouchableOpacity
                      key={z.id}
                      style={[styles.zoneChip, isActive && styles.zoneChipActiveOff]}
                      onPress={() => handleZoneSelect(z)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.zoneChipText, isActive && styles.zoneChipTextActive]}>
                        {z.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Leg Side & Straight */}
            <View style={[styles.chipGroup, { marginTop: 6 }]}>
              <Text style={[styles.chipGroupLabel, { color: '#b45309' }]}>LEG SIDE & STRAIGHT:</Text>
              <View style={styles.chipRow}>
                {legSideZones.map((z) => {
                  const isActive = selectedZone.id === z.id;
                  return (
                    <TouchableOpacity
                      key={z.id}
                      style={[styles.zoneChip, isActive && styles.zoneChipActiveLeg]}
                      onPress={() => handleZoneSelect(z)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.zoneChipText, isActive && styles.zoneChipTextActive]}>
                        {z.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Action Footer Buttons */}
          <View style={styles.footer}>
            {/* Confirm Direction Button */}
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={handleConfirm}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmBtnText}>
                ✅ Confirm {selectedZone.name} ({runs} Runs)
              </Text>
            </TouchableOpacity>

            {/* Skip Direction Option */}
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={onSkip}
              activeOpacity={0.7}
            >
              <Text style={styles.skipBtnText}>
                ⏭️ Skip Direction (Record {runs} Runs Directly)
              </Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8
  },
  modalCard: {
    width: '100%',
    maxHeight: '94%',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#b8860b', // CFVD TNCA Gold
    padding: 12,
    shadowColor: '#b8860b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  titleIcon: {
    fontSize: 18
  },
  titleText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.5
  },
  runPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12
  },
  runPillSix: {
    backgroundColor: '#d97706',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4
  },
  runPillFour: {
    backgroundColor: '#0284c7',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4
  },
  runPillOther: {
    backgroundColor: '#059669'
  },
  runPillText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5
  },
  subtitleText: {
    fontSize: 11.5,
    color: '#475569',
    marginTop: 2
  },
  batterNameHighlight: {
    color: '#0284c7',
    fontWeight: '800'
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  closeBtnText: {
    color: '#92400e',
    fontSize: 13,
    fontWeight: '900'
  },
  handToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 8
  },
  handToggleLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#854d0e',
    letterSpacing: 0.5
  },
  handBtnGroup: {
    flexDirection: 'row',
    gap: 4
  },
  handBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  handBtnActive: {
    backgroundColor: '#d97706',
    borderColor: '#b45309'
  },
  handBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569'
  },
  handBtnTextActive: {
    color: '#ffffff',
    fontWeight: '900'
  },
  groundWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4
  },
  groundBox: {
    borderRadius: 175,
    overflow: 'hidden',
    shadowColor: '#15803d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 2.5,
    borderColor: '#b8860b'
  },
  groundHint: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 5,
    textAlign: 'center'
  },
  previewCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  previewZoneBadge: {
    flex: 1
  },
  previewZoneSideTag: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0284c7',
    letterSpacing: 0.5
  },
  previewZoneName: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#0f172a'
  },
  previewMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  metricItem: {
    alignItems: 'center'
  },
  metricLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#854d0e'
  },
  metricVal: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0f172a'
  },
  metricDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#fde68a',
    marginHorizontal: 8
  },
  replayBtn: {
    marginLeft: 8,
    backgroundColor: '#0284c7',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6
  },
  replayBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff'
  },
  quickChipsSection: {
    marginTop: 8
  },
  chipGroup: {},
  chipGroupLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0369a1',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4
  },
  zoneChip: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  zoneChipActiveOff: {
    backgroundColor: '#0284c7',
    borderColor: '#0369a1'
  },
  zoneChipActiveLeg: {
    backgroundColor: '#d97706',
    borderColor: '#b45309'
  },
  zoneChipText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#334155'
  },
  zoneChipTextActive: {
    color: '#ffffff',
    fontWeight: '900'
  },
  footer: {
    marginTop: 10,
    gap: 4
  },
  confirmBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3
  },
  confirmBtnText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5
  },
  skipBtn: {
    paddingVertical: 5,
    alignItems: 'center'
  },
  skipBtnText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600'
  }
});

export default InteractiveWagonWheelModal;
