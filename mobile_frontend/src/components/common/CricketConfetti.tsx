import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, Platform, Text } from 'react-native';

interface Particle {
  id: number;
  left: number; // 0 to 100 (%)
  size: number;
  color: string;
  shape: 'rect' | 'ribbon' | 'circle' | 'star';
  duration: number; // seconds
  delay: number; // seconds
  tilt: number;
}

const CONFETTI_COLORS = [
  '#f59e0b', // Gold / Amber
  '#ef4444', // Red
  '#3b82f6', // Electric Blue
  '#10b981', // Emerald Green
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#fbbf24', // Yellow Gold
  '#06b6d4', // Cyan
  '#ffffff', // White Sparkle
];

const SHAPES: Array<'rect' | 'ribbon' | 'circle' | 'star'> = ['rect', 'ribbon', 'circle', 'rect', 'star'];

export const CricketConfetti: React.FC<{ active?: boolean; count?: number }> = ({
  active = true,
  count = 60
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) {
      setParticles([]);
      return;
    }

    const generated: Particle[] = [];
    for (let i = 0; i < count; i++) {
      generated.push({
        id: i,
        left: Math.random() * 98,
        size: Math.floor(Math.random() * 8) + 8, // 8px to 16px
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
        duration: Math.random() * 2.5 + 2.5, // 2.5s to 5.0s
        delay: Math.random() * 3, // staggered start 0 to 3s
        tilt: Math.floor(Math.random() * 360),
      });
    }
    setParticles(generated);
  }, [active, count]);

  if (!active || particles.length === 0) return null;

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <style>{`
          @keyframes confettiFall {
            0% {
              transform: translateY(-20px) rotate(0deg) rotateX(0deg);
              opacity: 1;
            }
            50% {
              opacity: 0.95;
            }
            100% {
              transform: translateY(105vh) rotate(720deg) rotateX(360deg);
              opacity: 0.2;
            }
          }
          @keyframes confettiSway {
            0%, 100% { margin-left: 0px; }
            50% { margin-left: 35px; }
          }
          .confetti-particle {
            position: absolute;
            top: -20px;
            animation: confettiFall linear infinite;
            pointer-events: none;
            will-change: transform, opacity;
          }
        `}</style>
        {particles.map((p) => {
          const isRibbon = p.shape === 'ribbon';
          const isCircle = p.shape === 'circle';
          const isStar = p.shape === 'star';

          return (
            <div
              key={p.id}
              className="confetti-particle"
              style={{
                left: `${p.left}%`,
                width: isRibbon ? `${p.size * 0.4}px` : `${p.size}px`,
                height: isRibbon ? `${p.size * 2.2}px` : `${p.size}px`,
                backgroundColor: isStar ? 'transparent' : p.color,
                borderRadius: isCircle ? '50%' : isRibbon ? '2px' : '3px',
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
                boxShadow: `0 0 6px ${p.color}`,
                transform: `rotate(${p.tilt}deg)`,
                fontSize: isStar ? `${p.size * 1.2}px` : undefined,
                color: isStar ? p.color : undefined,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isStar ? '★' : ''}
            </div>
          );
        })}
      </View>
    );
  }

  // Native fallback
  return null;
};
export default CricketConfetti;

