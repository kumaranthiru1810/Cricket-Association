import React from 'react';
import { View, Text, StyleSheet, Image, Platform, useWindowDimensions, TouchableOpacity } from 'react-native';

const IMG_LOGO = require('../../../assets/logo_transparent.png');

interface Props {
  style?: any;
}

export default function SharedFooter({ style }: Props) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  return (
    <View style={[styles.footerContainer, style]}>
      <View style={[styles.innerRow, !isDesktop && styles.innerRowMobile]}>
        
        {/* Left: Brand info */}
        <View style={styles.brandRow}>
          <Image 
            source={IMG_LOGO} 
            style={styles.logo} 
            resizeMode="contain"
          />
          <View style={styles.brandTextWrap}>
            <View style={styles.brandTitleLine}>
              <Text style={styles.brandTitle}>Cricket Federation of Virudhunagar District</Text>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>TNCA Affiliated</Text>
              </View>
            </View>
            <Text style={styles.brandSubtitle}>Official Scorer & Match Operations Portal</Text>
          </View>
        </View>

        {/* Right / Center: Copyright & Legal */}
        <View style={[styles.metaRow, !isDesktop && styles.metaRowMobile]}>
          <Text style={styles.copyrightText}>
            © 2026 CFVD • All Rights Reserved
          </Text>
          <View style={styles.linksRow}>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.linkText}>Privacy</Text>
            </TouchableOpacity>
            <Text style={styles.bullet}>•</Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.linkText}>Terms</Text>
            </TouchableOpacity>
            <Text style={styles.bullet}>•</Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.linkText}>Match Rules</Text>
            </TouchableOpacity>
          </View>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footerContainer: {
    backgroundColor: '#040a1c',
    borderTopWidth: 1,
    borderTopColor: 'rgba(234, 179, 8, 0.35)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    width: '100%',
    zIndex: 10
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center'
  },
  innerRowMobile: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  logo: {
    width: 22,
    height: 22,
    borderRadius: 11
  },
  brandTextWrap: {
    flexDirection: 'column'
  },
  brandTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  brandTitle: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.2
  },
  statusPill: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)'
  },
  statusPillText: {
    color: '#facc15',
    fontSize: 9,
    fontWeight: '700'
  },
  brandSubtitle: {
    color: '#94a3b8',
    fontSize: 9.5,
    marginTop: 1
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  metaRowMobile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8
  },
  copyrightText: {
    color: '#64748b',
    fontSize: 10
  },
  linksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  linkText: {
    color: '#94a3b8',
    fontSize: 10,
    textDecorationLine: 'underline'
  },
  bullet: {
    color: '#475569',
    fontSize: 10
  }
});
