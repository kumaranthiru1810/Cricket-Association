import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
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

export default function InteractiveWagonWheelModal({
  visible,
  runs,
  batterName = 'Batter',
  initialBattingHand = 'RIGHT',
  onConfirm,
  onSkip,
  onClose
}: InteractiveWagonWheelModalProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 500;

  // Batting orientation (RHB / LHB)
  const [battingHand, setBattingHand] = useState<'RIGHT' | 'LEFT'>(initialBattingHand);

  useEffect(() => {
    if (initialBattingHand) {
      setBattingHand(initialBattingHand);
    }
  }, [initialBattingHand, visible]);

  // Coordinate Geometry
  // SVG internal coordinate space: 400 x 400
  const size = 380;
  const cx = size / 2; // 190
  const cy = size / 2; // 190
  const groundRadius = 165; // Boundary rope radius
  const innerCircleRadius = 78; // 30-yard fielding circle
  const strikerX = cx; // 190
  const strikerY = cy + 18; // Striker stands at popping crease (lower half of pitch)
  const nonStrikerX = cx;
  const nonStrikerY = cy - 18;

  // Selected landing position state
  // Default to Cover for 4 or Midwicket for 6 on open
  const defaultZone = runs === 6 ? 'mid_wicket' : 'cover';
  const defaultAngle = battingHand === 'LEFT' ? 360 - 298 : 298;
  const defaultDistPct = runs === 6 ? 96 : (runs === 4 ? 92 : 60);

  const getPosFromAngleDist = (angleDeg: number, distPct: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    const px = (groundRadius * distPct) / 100;
    const targetX = strikerX + px * Math.sin(rad);
    const targetY = strikerY - px * Math.cos(rad);
    return { x: targetX, y: targetY };
  };

  const initialPos = getPosFromAngleDist(defaultAngle, defaultDistPct);
  const [landingX, setLandingX] = useState<number>(initialPos.x);
  const [landingY, setLandingY] = useState<number>(initialPos.y);
  const [selectedAngle, setSelectedAngle] = useState<number>(defaultAngle);
  const [selectedDistPct, setSelectedDistPct] = useState<number>(defaultDistPct);
  const [selectedZone, setSelectedZone] = useState<ZoneDef>(
    FIELD_ZONES.find(z => z.id === defaultZone) || FIELD_ZONES[2]
  );

  // Ball Flight Animation state
  // animProgress: 0 (at striker) -> 1 (at landing target)
  const [animProgress, setAnimProgress] = useState<number>(1);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const animRef = useRef<number | null>(null);

  // Trigger ball flight animation whenever target changes or on open
  const triggerBallAnimation = (targetX: number, targetY: number) => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
    }
    setIsAnimating(true);
    setAnimProgress(0);

    const startTime = performance.now();
    const duration = 650; // ms

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      // Ease out cubic for realistic ball deceleration at landing
      const ease = 1 - Math.pow(1 - t, 3);
      setAnimProgress(ease);

      if (t < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        setIsAnimating(false);
      }
    };

    animRef.current = requestAnimationFrame(step);
  };

  // On modal open, trigger animation
  useEffect(() => {
    if (visible) {
      const initP = getPosFromAngleDist(
        battingHand === 'LEFT' ? (runs === 6 ? 295 : 62) : (runs === 6 ? 68 : 298),
        runs >= 4 ? 94 : 65
      );
      setLandingX(initP.x);
      setLandingY(initP.y);
      resolveZoneFromCoords(initP.x, initP.y, battingHand);
      setTimeout(() => {
        triggerBallAnimation(initP.x, initP.y);
      }, 150);
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [visible, runs, battingHand]);

  // Resolve Zone from arbitrary (x, y) coordinates
  const resolveZoneFromCoords = (x: number, y: number, hand: 'RIGHT' | 'LEFT') => {
    const dx = x - strikerX;
    const dy = y - strikerY;
    let rad = Math.atan2(dx, -dy); // 0 at 12 o'clock, clockwise
    let deg = (rad * 180) / Math.PI;
    if (deg < 0) deg += 360;

    const rawDistance = Math.sqrt(dx * dx + dy * dy);
    const distPct = Math.min(100, Math.max(12, Math.round((rawDistance / groundRadius) * 100)));

    // For Left Hand Batsman, perspective angle mirrors horizontally
    let effectiveAngleForZone = deg;
    if (hand === 'LEFT') {
      effectiveAngleForZone = (360 - deg) % 360;
    }

    // Find closest zone based on angle definition
    let closest = FIELD_ZONES[0];
    let minDiff = 999;
    for (const z of FIELD_ZONES) {
      let diff = Math.abs(z.standardAngleRHB - effectiveAngleForZone);
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
    // Get click location relative to SVG viewBox
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

    // Scale from client render width to internal 380x380 SVG coordinates
    const scale = size / (isMobile ? Math.min(width - 40, 340) : 340);
    const svgX = Math.round(localX * scale);
    const svgY = Math.round(localY * scale);

    // Clamp to boundary circle
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
    // Boundary distance for 4s/6s, infield for smaller runs
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
    const meters = Math.round(15 + (selectedDistPct / 100) * 65); // 15m to 80m
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

  // Current animated ball coordinates
  const currentBallX = strikerX + (landingX - strikerX) * animProgress;
  const currentBallY = strikerY + (landingY - strikerY) * animProgress;
  // Parabolic elevation factor for 3D aerial flight look
  const ballElevation = Math.sin(animProgress * Math.PI) * (runs === 6 ? 1.6 : 1.25);
  const ballScale = 1 + (ballElevation - 1) * 0.45;

  // Ground render size
  const renderSize = isMobile ? Math.min(width - 40, 340) : 340;

  // Off Side Zones & Leg Side Zones according to batter hand
  const offSideZones = useMemo(() => {
    return FIELD_ZONES.filter(z => z.side === 'OFF');
  }, []);

  const legSideZones = useMemo(() => {
    return FIELD_ZONES.filter(z => z.side === 'LEG' || z.side === 'STRAIGHT');
  }, []);

  // Distance in estimated meters
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
          {/* Header Bar */}
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
                Select shot landing direction for <Text style={{ color: '#0284c7', fontWeight: '800' }}>{batterName}</Text>
              </Text>
            </View>

            {/* Close Button */}
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Batting Hand Toggle Bar (RHB vs LHB) */}
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

          {/* Interactive SVG Cricket Ground */}
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
                  {/* Radial Turf Lawn Gradients with Mowing Stripes */}
                  <radialGradient id="fieldGrass" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#14532d" />
                    <stop offset="65%" stopColor="#0f3d21" />
                    <stop offset="92%" stopColor="#0a2a16" />
                    <stop offset="100%" stopColor="#05170b" />
                  </radialGradient>

                  {/* Concentric Mower Stripes */}
                  <radialGradient id="lawnPattern" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(255, 255, 255, 0.05)" />
                    <stop offset="25%" stopColor="rgba(0, 0, 0, 0.06)" />
                    <stop offset="50%" stopColor="rgba(255, 255, 255, 0.05)" />
                    <stop offset="75%" stopColor="rgba(0, 0, 0, 0.06)" />
                    <stop offset="100%" stopColor="rgba(255, 255, 255, 0.05)" />
                  </radialGradient>

                  {/* Pitch Texture Gradient */}
                  <linearGradient id="pitchTexture" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#b4916c" />
                    <stop offset="50%" stopColor="#cfaf88" />
                    <stop offset="100%" stopColor="#b4916c" />
                  </linearGradient>

                  {/* Trajectory Glow Filter */}
                  <filter id="trajGlow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  {/* Ball 3D Shading */}
                  <radialGradient id="cricketBallGrad" cx="35%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#ff4d4d" />
                    <stop offset="45%" stopColor="#dc2626" />
                    <stop offset="90%" stopColor="#991b1b" />
                    <stop offset="100%" stopColor="#5b0b0b" />
                  </radialGradient>

                  {/* Landing Ripple Glow */}
                  <radialGradient id="rippleGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={runs === 6 ? '#ec4899' : (runs === 4 ? '#06b6d4' : '#f59e0b')} stopOpacity="0.8" />
                    <stop offset="60%" stopColor={runs === 6 ? '#ec4899' : (runs === 4 ? '#06b6d4' : '#f59e0b')} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={runs === 6 ? '#ec4899' : (runs === 4 ? '#06b6d4' : '#f59e0b')} stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* 1. Main Outfield Oval Circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={groundRadius}
                  fill="url(#fieldGrass)"
                  stroke="#15803d"
                  strokeWidth="2"
                />

                {/* 2. Concentric Mowing Grass Rings Overlay */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={groundRadius}
                  fill="url(#lawnPattern)"
                  style={{ pointerEvents: 'none' }}
                />

                {/* Concentric Distance Rings (25m, 50m, 75m) */}
                <circle cx={cx} cy={cy} r={groundRadius * 0.35} fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx={cx} cy={cy} r={groundRadius * 0.70} fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" strokeDasharray="3 3" />

                {/* 3. 30-Yard Inner Field Circle (White Dashed Circle with Disc Markers) */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={innerCircleRadius}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.45)"
                  strokeWidth="1.5"
                  strokeDasharray="6 4"
                />

                {/* 4. White Boundary Rope with Stadium Border Glow */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={groundRadius}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={groundRadius + 3}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.25)"
                  strokeWidth="1.2"
                />

                {/* 5. 10 Zone Sector Divider Radial Rays & Sector Watermarks */}
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
                      {/* Subtle ray line */}
                      <line
                        x1={strikerX}
                        y1={strikerY}
                        x2={borderX}
                        y2={borderY}
                        stroke={isZoneActive ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.12)'}
                        strokeWidth={isZoneActive ? 1.5 : 0.8}
                        strokeDasharray={isZoneActive ? 'none' : '3 3'}
                      />
                      {/* Floating Zone Name Label */}
                      <text
                        x={labelX}
                        y={labelY}
                        fill={isZoneActive ? '#38bdf8' : 'rgba(255, 255, 255, 0.6)'}
                        fontSize={isZoneActive ? 9.5 : 8}
                        fontWeight={isZoneActive ? '900' : '700'}
                        textAnchor="middle"
                        dominantBaseline="central"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {zone.shortName}
                      </text>
                    </g>
                  );
                })}

                {/* 6. Realistic Cricket Pitch in the Center */}
                {/* Pitch Clay Strip */}
                <rect
                  x={cx - 7}
                  y={cy - 22}
                  width="14"
                  height="44"
                  rx="1.5"
                  fill="url(#pitchTexture)"
                  stroke="#854d0e"
                  strokeWidth="1"
                />

                {/* Bowling Creases & Popping Creases */}
                {/* Non-Striker Crease (Top) */}
                <line x1={cx - 10} y1={cy - 16} x2={cx + 10} y2={cy - 16} stroke="#ffffff" strokeWidth="1" />
                {/* Non-Striker Stumps */}
                <line x1={cx - 3} y1={cy - 19} x2={cx + 3} y2={cy - 19} stroke="#fef08a" strokeWidth="2" strokeLinecap="round" />

                {/* Striker Crease (Bottom) */}
                <line x1={cx - 10} y1={cy + 16} x2={cx + 10} y2={cy + 16} stroke="#ffffff" strokeWidth="1" />
                {/* Striker Stumps */}
                <line x1={cx - 3} y1={cy + 19} x2={cx + 3} y2={cy + 19} stroke="#fef08a" strokeWidth="2" strokeLinecap="round" />

                {/* Striker Batsman Stance Icon / Bat Graphic */}
                <circle cx={strikerX} cy={strikerY} r="3.5" fill="#facc15" stroke="#000000" strokeWidth="0.8" />
                {/* Bat Direction indication */}
                <line
                  x1={strikerX}
                  y1={strikerY}
                  x2={battingHand === 'RIGHT' ? strikerX - 6 : strikerX + 6}
                  y2={strikerY + 4}
                  stroke="#e2e8f0"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* 7. Trajectory Line: Glowing Line from Striker to Target */}
                {/* Outer Glow Line */}
                <line
                  x1={strikerX}
                  y1={strikerY}
                  x2={currentBallX}
                  y2={currentBallY}
                  stroke={runs === 6 ? '#ec4899' : (runs === 4 ? '#06b6d4' : '#eab308')}
                  strokeWidth="5"
                  strokeOpacity="0.4"
                  strokeLinecap="round"
                  filter="url(#trajGlow)"
                />
                {/* Core Trajectory Line */}
                <line
                  x1={strikerX}
                  y1={strikerY}
                  x2={currentBallX}
                  y2={currentBallY}
                  stroke={runs === 6 ? '#f472b6' : (runs === 4 ? '#22d3ee' : '#fef08a')}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* 8. Final Landing Position Marker & Expanding Shockwave Ripple */}
                {!isAnimating && (
                  <g>
                    {/* Pulsating Ripple Disc */}
                    <circle
                      cx={landingX}
                      cy={landingY}
                      r="16"
                      fill="url(#rippleGlow)"
                    />
                    <circle
                      cx={landingX}
                      cy={landingY}
                      r="10"
                      fill="none"
                      stroke={runs === 6 ? '#f472b6' : '#22d3ee'}
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />
                    {/* Landing Bullseye Pin */}
                    <circle
                      cx={landingX}
                      cy={landingY}
                      r="4.5"
                      fill={runs === 6 ? '#ec4899' : '#06b6d4'}
                      stroke="#ffffff"
                      strokeWidth="1.8"
                    />
                  </g>
                )}

                {/* 9. Animated Cricket Ball traveling in 3D Flight Arc */}
                <g transform={`translate(${currentBallX}, ${currentBallY}) scale(${ballScale})`}>
                  {/* Ball Drop Shadow for 3D elevation illusion */}
                  <ellipse
                    cx="0"
                    cy={ballElevation * 4}
                    rx="4.5"
                    ry="2.2"
                    fill="rgba(0, 0, 0, 0.45)"
                  />
                  {/* Red Cricket Ball */}
                  <circle
                    cx="0"
                    cy="0"
                    r="4.5"
                    fill="url(#cricketBallGrad)"
                    stroke="#ffffff"
                    strokeWidth="0.8"
                  />
                  {/* White Ball Seam Line */}
                  <line
                    x1="-2.5"
                    y1="-2"
                    x2="2.5"
                    y2="2"
                    stroke="#ffffff"
                    strokeWidth="0.8"
                    strokeDasharray="1 1"
                  />
                </g>

                {/* Cardinal Compass Tags */}
                <text x={cx} y="14" fill="#fef08a" fontSize="8" fontWeight="800" textAnchor="middle">STRAIGHT</text>
                <text x={cx} y={size - 6} fill="#fef08a" fontSize="8" fontWeight="800" textAnchor="middle">FINE LEG / THIRD MAN</text>
              </svg>
            </TouchableOpacity>

            {/* Instruction Callout */}
            <Text style={styles.groundHint}>
              👆 Tap / Click anywhere on field to set landing location
            </Text>
          </View>

          {/* Real-time Direction & Distance Preview Banner */}
          <View style={styles.previewCard}>
            <View style={styles.previewRow}>
              <View style={styles.previewZoneBadge}>
                <Text style={styles.previewZoneEmoji}>
                  {selectedZone.side === 'OFF' ? '🏏 OFF' : (selectedZone.side === 'LEG' ? '🏏 LEG' : '🎯 STRAIGHT')}
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

          {/* Quick Selection Zone Chips */}
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
                      style={[styles.zoneChip, isActive && styles.zoneChipActive]}
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

            {/* Skip Direction Option (Preserves Existing Fast Workflow) */}
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 20, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#1e293b',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20
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
    gap: 8
  },
  titleIcon: {
    fontSize: 18
  },
  titleText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5
  },
  runPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12
  },
  runPillSix: {
    backgroundColor: '#ec4899',
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6
  },
  runPillFour: {
    backgroundColor: '#0284c7',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6
  },
  runPillOther: {
    backgroundColor: '#334155'
  },
  runPillText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5
  },
  subtitleText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '800'
  },
  handToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 10
  },
  handToggleLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
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
    backgroundColor: '#0f172a'
  },
  handBtnActive: {
    backgroundColor: '#0284c7'
  },
  handBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8'
  },
  handBtnTextActive: {
    color: '#ffffff',
    fontWeight: '800'
  },
  groundWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4
  },
  groundBox: {
    borderRadius: 175,
    overflow: 'hidden',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)'
  },
  groundHint: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center'
  },
  previewCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#334155'
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  previewZoneBadge: {
    flex: 1
  },
  previewZoneEmoji: {
    fontSize: 9,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 0.5
  },
  previewZoneName: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff'
  },
  previewMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
  metricItem: {
    alignItems: 'center'
  },
  metricLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748b'
  },
  metricVal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#f8fafc'
  },
  metricDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#334155',
    marginHorizontal: 8
  },
  replayBtn: {
    marginLeft: 8,
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6
  },
  replayBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#f8fafc'
  },
  quickChipsSection: {
    marginTop: 8
  },
  chipGroup: {},
  chipGroupLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0284c7',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4
  },
  zoneChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155'
  },
  zoneChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8'
  },
  zoneChipActiveLeg: {
    backgroundColor: '#d97706',
    borderColor: '#f59e0b'
  },
  zoneChipText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#94a3b8'
  },
  zoneChipTextActive: {
    color: '#ffffff',
    fontWeight: '900'
  },
  footer: {
    marginTop: 12,
    gap: 6
  },
  confirmBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5
  },
  skipBtn: {
    paddingVertical: 6,
    alignItems: 'center'
  },
  skipBtnText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600'
  }
});
