import React from 'react';
import { View, ImageBackground, Image, StyleSheet, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  children: React.ReactNode;
}

export default function SharedBackground({ children }: Props) {
  // Try to use the exact CSS for web to ensure 100% pixel-perfect match, 
  // but fallback to a React Native representation for mobile.
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { backgroundColor: '#fdfbf7' }]}>
        <div className="cfvd-site-background" aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
          <div className="cfvd-bg-stadium" style={{ position: 'absolute', inset: 0, background: "url('/stadium.jpg') center 22% / cover no-repeat", filter: 'brightness(0.92) contrast(0.95) saturate(1.1)', opacity: 0.12, transform: 'scale(1.02)' }}></div>
          <div className="cfvd-bg-overlay" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 95% 70% at 50% 20%, rgba(246, 242, 233, 0.84) 0%, rgba(248, 244, 235, 0.96) 80%), linear-gradient(180deg, rgba(255, 255, 255, 0.85) 0%, rgba(246, 242, 233, 0.98) 100%)' }}></div>
          <div className="cfvd-bg-top-glow" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '540px', background: 'radial-gradient(ellipse 85% 75% at 50% -5%, rgba(255, 255, 255, 0.96) 0%, rgba(255, 248, 220, 0.82) 20%, rgba(254, 217, 102, 0.65) 42%, rgba(245, 196, 61, 0.38) 60%, rgba(212, 175, 55, 0.16) 78%, transparent 100%)', filter: 'blur(18px)', mixBlendMode: 'screen' }}></div>
          <div className="cfvd-bg-watermark" style={{ position: 'absolute', top: '52%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(50vw, 485px)', height: 'min(50vw, 485px)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6, filter: 'drop-shadow(0 0 55px rgba(184, 134, 11, 0.65))' }}>
            <img src="/watermark.png" className="cfvd-watermark-img" alt="Watermark" style={{ width: '100%', height: 'auto', opacity: 0.9 }} />
          </div>
        </div>
        <View style={styles.contentContainer}>
          {children}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#fdfbf7' }]}>
      {/* Stadium Background for Mobile */}
      <ImageBackground
        source={require('../../../public/stadium.jpg')}
        style={styles.absoluteFill}
        imageStyle={styles.stadiumImage}
      >
        {/* Full screen overlays */}
        <LinearGradient
          colors={['rgba(246, 242, 233, 0.84)', 'rgba(248, 244, 235, 0.96)']}
          style={styles.absoluteFill}
        />

        {/* Top Glow Canopy */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.96)', 'rgba(254, 217, 102, 0.4)', 'transparent']}
          style={styles.topGlow}
        />

        {/* Floating Watermark Logo */}
        <View style={styles.watermarkContainer}>
          <Image
            source={require('../../../public/watermark.png')}
            style={styles.watermarkImage}
            resizeMode="contain"
          />
        </View>

        {/* Content Layer */}
        <View style={styles.contentContainer}>
          {children}
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  stadiumImage: {
    opacity: 0.12,
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 400,
  },
  watermarkContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.45,
  },
  watermarkImage: {
    width: 400,
    height: 400,
    maxWidth: '80%',
  },
  contentContainer: {
    flex: 1,
    zIndex: 10,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  }
});
