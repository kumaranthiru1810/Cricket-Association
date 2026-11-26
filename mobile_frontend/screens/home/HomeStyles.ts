/**
 * screens/home/HomeStyles.ts
 * Complete StyleSheet extracted from Home.tsx for modularity and performance.
 */

import { StyleSheet, Platform } from 'react-native';

// ─── STYLESHEET ───────────────────────────────────────────────────────────────
export const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#f6f2e9',
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  mainScroll: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    ...(Platform.OS === 'web' ? ({ overflowX: 'hidden' } as any) : {}),
  },
  mainScrollContent: {
    paddingBottom: 0, // No extra space below footer
    width: '100%',
    maxWidth: '100%',
    ...(Platform.OS === 'web' ? ({ overflowX: 'hidden' } as any) : {}),
  },
  container: {
    width: '100%',
    maxWidth: 1320, // Bootstrap 5 container-xxl max-width
    alignSelf: 'center',
    paddingHorizontal: 16,
    overflow: 'hidden',
  },

  // Atmospheric Background with Deep Soft Blur
  bgStadiumImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.16,
    transform: [{ scale: 1.12 }],
    ...(Platform.OS === 'web'
      ? ({
          filter: 'blur(18px)',
          WebkitFilter: 'blur(18px)',
        } as any)
      : {})
  },
  bgTopGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 380
  },
  bgWatermarkContainer: {
    position: 'absolute',
    top: '48%',
    left: '50%',
    transform: [{ translateX: -260 }, { translateY: -260 }],
    width: 520,
    height: 520,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.38
  },
  bgWatermarkImage: {
    width: '100%',
    height: '100%'
  },

  // Header / Navbar
  header: {
    backgroundColor: '#040a1b',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.25)',
    zIndex: 100,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(12px)' } : {})
  },
  headerInner: {
    width: '100%',
    paddingHorizontal: Platform.OS === 'web' ? 32 : 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  brandLogo: {
    width: 48,
    height: 48,
    marginRight: 10
  },
  brandTextBlock: {
    justifyContent: 'center'
  },
  brandTitleMain: {
    color: '#f5c43d',
    fontSize: 14.5,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  brandTitleSub: {
    color: '#c0d1eb',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4
  },
  brandBadgeRow: {
    marginTop: 2
  },
  brandAffiliation: {
    color: '#fed966',
    fontSize: 9.5,
    fontWeight: '600'
  },
  desktopNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14
  },
  navHomePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.42)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6.5
  },
  navHomePillText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '800'
  },
  navLinkDropdown: {
    paddingVertical: 6,
    paddingHorizontal: 8
  },
  navDropdownText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '600'
  },
  navLink: {
    paddingVertical: 6,
    paddingHorizontal: 8
  },
  navLinkActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#f5c43d'
  },
  navLinkText: {
    color: '#e6edf8',
    fontSize: 13.5,
    fontWeight: '600'
  },
  navLinkTextActive: {
    color: '#f5c43d',
    fontSize: 13.5,
    fontWeight: '700'
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  headerLoginBtn: {
    backgroundColor: '#f5c43d',
    paddingHorizontal: 18,
    paddingVertical: 7.5,
    borderRadius: 6
  },
  headerLoginBtnText: {
    color: '#081225',
    fontSize: 13,
    fontWeight: '900'
  },
  headerUserPill: {
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
    borderColor: '#d4af37',
    borderWidth: 1.2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  headerUserNameText: {
    color: '#f5c43d',
    fontSize: 12.5,
    fontWeight: '800',
    maxWidth: 140
  },
  headerUserRoleBadge: {
    backgroundColor: '#d4af37',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  headerUserRoleBadgeText: {
    color: '#081225',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.3
  },
  headerLogoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  headerLogoutBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700'
  },
  mobileUserCard: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderColor: 'rgba(212, 175, 55, 0.35)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10
  },
  mobileUserCardGreeting: {
    color: '#ffffff',
    fontSize: 13.5,
    marginBottom: 4
  },
  mobileUserCardRole: {
    color: '#94a3b8',
    fontSize: 11.5,
    fontWeight: '600',
    marginBottom: 10
  },
  mobileUserActionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  mobilePortalBtn: {
    backgroundColor: '#d4af37',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    flex: 1,
    alignItems: 'center'
  },
  mobilePortalBtnText: {
    color: '#081225',
    fontSize: 12,
    fontWeight: '800'
  },
  mobileLogoutBtn: {
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  mobileLogoutBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700'
  },
  hamburgerBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)'
  },
  hamburgerIcon: {
    color: '#f5c43d',
    fontSize: 18,
    fontWeight: '900'
  },
  mobileNavDrawer: {
    backgroundColor: '#07132c',
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  mobileNavItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)'
  },
  mobileNavText: {
    color: '#e6edf8',
    fontSize: 14,
    fontWeight: '600'
  },

  // Live Ticker Bar
  liveTickerBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(184, 134, 11, 0.25)',
    paddingVertical: 2,
    zIndex: 90,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  liveTickerInner: {
    width: '100%',
    maxWidth: 1540,
    alignSelf: 'center',
    paddingHorizontal: Platform.OS === 'web' ? 32 : 16,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  liveTickerBadge: {
    backgroundColor: '#881337',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  liveTickerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f87171',
    marginRight: 5
  },
  liveTickerBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  liveTickerScrollView: {
    flex: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
  liveTickerScrollContent: {
    alignItems: 'center',
    paddingRight: 16
  },
  liveTickerText: {
    color: '#1e293b',
    fontSize: 12,
    fontWeight: '500'
  },
  tickerMatchHighlight: {
    fontWeight: '700',
    color: '#0f172a'
  },
  tickerPrefix: {
    fontWeight: '800',
    color: '#854d0e'
  },
  tickerStarPrefix: {
    fontWeight: '800',
    color: '#b45309'
  },
  tickerLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginLeft: 16
  },
  tickerLinkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 4
  },
  tickerLinkText: {
    color: '#334155',
    fontSize: 11.5,
    fontWeight: '600'
  },

  // Prestigious Athletic Light Hero Section
  oasoHeroSection: {
    position: 'relative',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    paddingVertical: Platform.OS === 'web' ? 56 : 40,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  heroDecoRing1: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 600,
    height: 600,
    borderRadius: 300,
    backgroundColor: 'rgba(217, 119, 6, 0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(217, 119, 6, 0.08)',
  },
  heroDecoRing2: {
    position: 'absolute',
    bottom: -150,
    left: -100,
    width: 500,
    height: 500,
    borderRadius: 250,
    backgroundColor: 'rgba(10, 37, 64, 0.03)',
    borderWidth: 1.5,
    borderColor: 'rgba(10, 37, 64, 0.06)',
  },
  oasoHeroContainer: {
    zIndex: 2,
  },
  oasoHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  oasoHeroRowMobile: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  oasoHeroContentCol: {
    flex: 1.25,
    maxWidth: Platform.OS === 'web' ? 760 : '100%',
    paddingRight: Platform.OS === 'web' ? 24 : 0,
    alignItems: 'flex-start',
  },
  oasoHeroContentColMobile: {
    alignItems: 'center',
    paddingRight: 0,
    maxWidth: '100%',
  },
  oasoOverlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1.2,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 16,
    gap: 6,
  },
  oasoPulseGoldDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#d97706',
  },
  oasoOverlineText: {
    color: '#92400e',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  oasoAffiliatedBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  oasoAffiliatedBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#b45309',
    letterSpacing: 0.5,
  },
  oasoHeroTitle: {
    color: '#0a2540',
    fontSize: Platform.OS === 'web' ? 62 : 38,
    fontWeight: '900',
    letterSpacing: 1.2,
    lineHeight: Platform.OS === 'web' ? 66 : 42,
    textTransform: 'uppercase',
    marginBottom: 12,
    textAlign: 'left',
  },
  oasoHeroTitleMobile: {
    fontSize: 32,
    lineHeight: 36,
    textAlign: 'center',
  },
  oasoHeroTagline: {
    color: '#b45309',
    fontSize: Platform.OS === 'web' ? 13.5 : 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  oasoHeroSubtitle: {
    color: '#475569',
    fontSize: 14.5,
    lineHeight: 23,
    fontWeight: '400',
    marginBottom: 18,
    maxWidth: 620,
    textAlign: 'left',
  },
  oasoHeroSubtitleMobile: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
  },
  oasoHighlightsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 22,
  },
  oasoHighlightChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  oasoHighlightEmoji: {
    fontSize: 12,
    marginRight: 6,
  },
  oasoHighlightText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  oasoBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a2540',
    borderColor: '#f59e0b',
    borderWidth: 1.5,
    paddingHorizontal: 22,
    height: 48,
    borderRadius: 8,
    shadowColor: '#0a2540',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  oasoBtnPrimaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  oasoBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#0a2540',
    borderWidth: 1.5,
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  oasoBtnSecondaryText: {
    color: '#0a2540',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  oasoBtnTertiary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1.2,
    paddingHorizontal: 18,
    height: 48,
    borderRadius: 8,
  },
  oasoBtnTertiaryText: {
    color: '#92400e',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  oasoHeroCrestCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 12,
  },
  oasoHeroCrestColMobile: {
    width: '100%',
    maxWidth: '100%',
    marginTop: 24,
    paddingVertical: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  oasoCrestAuraRing: {
    position: 'absolute',
    width: 440,
    height: 440,
    borderRadius: 220,
    backgroundColor: 'rgba(217, 119, 6, 0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(217, 119, 6, 0.15)',
  },
  oasoCrestAuraRingInner: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(10, 37, 64, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(10, 37, 64, 0.08)',
  },
  oasoCrestImage: {
    width: '100%',
    maxWidth: 460,
    height: 460,
    maxHeight: 460,
    ...(Platform.OS === 'web' ? ({ filter: 'drop-shadow(0 14px 28px rgba(10, 37, 64, 0.12))' } as any) : {}),
  },
  oasoCrestFloatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: -20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  oasoCrestFloatingText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
  },
  stealthCrestWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  stealthBallHotspot: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: 'transparent',
    zIndex: 99,
    elevation: 20,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer', outlineStyle: 'none' as any, WebkitTapHighlightColor: 'transparent' } as any) : {}),
  },

  // Hero Section (Prestigious Athletic Federation Atmosphere)
  heroSection: {
    position: 'relative',
    paddingTop: Platform.OS === 'web' ? 48 : 36,
    paddingBottom: Platform.OS === 'web' ? 52 : 44,
    minHeight: Platform.OS === 'web' ? 540 : undefined,
    justifyContent: 'center',
    overflow: 'hidden'
  },
  heroWatermarkContainer: {
    position: 'absolute',
    top: 24,
    bottom: 24,
    right: 36,
    width: 470,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.95
  },
  heroWatermarkImage: {
    width: '100%',
    height: '100%'
  },
  emblemRingOuter: {
    position: 'absolute',
    width: '96%',
    height: '96%',
    borderRadius: 300,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.45)',
    borderStyle: 'dashed'
  },
  emblemRingInner: {
    position: 'absolute',
    width: '80%',
    height: '80%',
    borderRadius: 300,
    borderWidth: 1.2,
    borderColor: 'rgba(212, 175, 55, 0.3)'
  },
  heroContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 860 : '100%',
    paddingLeft: Platform.OS === 'web' ? 32 : 16,
    paddingRight: 20,
    zIndex: 2
  },
  heroPretitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    alignSelf: 'flex-start'
  },
  heroBadgeDistrict: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
    borderColor: '#b4820a',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14
  },
  heroBadgeDistrictText: {
    color: '#78350f',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4
  },
  heroBadgeCouncil: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.12)',
    borderColor: 'rgba(15, 23, 42, 0.25)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14
  },
  heroBadgeCouncilText: {
    color: '#0f172a',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4
  },
  heroBadgeHeritage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(217, 119, 6, 0.18)',
    borderColor: 'rgba(217, 119, 6, 0.35)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14
  },
  heroBadgeHeritageText: {
    color: '#92400e',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4
  },
  heroHeadingLine1: {
    color: '#07132c',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 2,
    textAlign: 'left',
    alignSelf: 'flex-start'
  },
  heroHeadingLine2: {
    color: '#f5c43d',
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 10,
    textAlign: 'left',
    alignSelf: 'flex-start',
    textShadowColor: 'rgba(180, 130, 20, 0.35)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3
  },

  // Motto Badge
  ribbonWrapper: {
    position: 'relative',
    marginTop: 4,
    marginBottom: 16,
    alignSelf: 'flex-start'
  },
  ribbonBody: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6',
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 7,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  ribbonTailLeft: {
    display: 'none'
  },
  ribbonTailRight: {
    display: 'none'
  },
  ribbonStar: {
    color: '#b45309',
    fontSize: 12,
    marginHorizontal: 4
  },
  ribbonText: {
    color: '#0e184e',
    fontSize: 13,
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: 0.2,
    marginHorizontal: 4
  },

  heroDescription: {
    color: '#1a2a48',
    fontSize: 14.5,
    lineHeight: 22,
    maxWidth: 680,
    marginBottom: 24,
    fontWeight: '500',
    textAlign: 'left',
    alignSelf: 'flex-start'
  },

  // 3 Hero Action Buttons
  heroButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 34,
    alignSelf: 'flex-start'
  },
  heroBtnNavy: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0e184e', // Deep Navy (TNCA / CFVD official) - NO BLUE!
    borderColor: '#0e184e',
    borderWidth: 1,
    paddingHorizontal: 20,
    height: 46,
    borderRadius: 6,
    shadowColor: '#0e184e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    elevation: 3
  },
  heroRedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dc3545', // Danger
    marginRight: 8
  },
  heroBtnNavyText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700'
  },
  heroBtnGold: {
    backgroundColor: '#ffc107', // Warning
    borderColor: '#ffc107',
    borderWidth: 1,
    paddingHorizontal: 20,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6
  },
  heroBtnGoldText: {
    color: '#212529',
    fontSize: 14,
    fontWeight: '700'
  },
  heroBtnWhite: {
    backgroundColor: '#ffffff',
    borderColor: '#0e184e', // Deep Navy border - NO BLUE!
    borderWidth: 1.5,
    paddingHorizontal: 20,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    elevation: 1
  },
  heroBtnWhiteText: {
    color: '#0e184e', // Deep Navy text - NO BLUE!
    fontSize: 14,
    fontWeight: '700'
  },

  // Legacy Hero Fallbacks
  goldPill: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderColor: '#d4af37',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  goldPillText: {
    color: '#f5c43d',
    fontSize: 10.5,
    fontWeight: '800'
  },
  cfvdTagLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  cfvdTagLightText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '700'
  },
  heritagePill: {
    backgroundColor: 'rgba(158, 24, 43, 0.2)',
    borderColor: 'rgba(200, 30, 55, 0.5)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  heritagePillText: {
    color: '#fed966',
    fontSize: 10.5,
    fontWeight: '800'
  },
  heroTitlePrefix: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 0.5
  },
  heroTitleMain: {
    color: '#f5c43d',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 2
  },
  mottoRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
    borderColor: '#d4af37',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 14,
    marginBottom: 16
  },
  mottoRibbonStar: {
    color: '#fed966',
    fontSize: 12,
    marginHorizontal: 6
  },
  mottoRibbonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: 0.3
  },
  heroCtaGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 30
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    borderColor: '#d97706',
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    elevation: 3
  },
  liveDotPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    marginRight: 8
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  },
  btnOutlineGold: {
    backgroundColor: '#ffffff',
    borderColor: '#f59e0b',
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8
  },
  btnOutlineGoldText: {
    color: '#b45309',
    fontSize: 14,
    fontWeight: '800'
  },
  btnGlass: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderColor: '#fde68a',
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8
  },
  btnGlassText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700'
  },

  // Metrics Bar
  metricsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    width: '100%',
    maxWidth: 780,
    alignSelf: 'flex-start',
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3
  },
  metricItem: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  metricVal: {
    color: '#b45309',
    fontSize: 22,
    fontWeight: '900'
  },
  metricLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2
  },
  metricDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#fde68a'
  },

  // Quick Strip
  quickStrip: {
    paddingVertical: 16,
    backgroundColor: '#fffbeb',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#fde68a'
  },
  quickStripGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  quickCard: {
    flex: 1,
    minWidth: 240,
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  quickCardHighlight: {
    borderColor: '#f59e0b',
    backgroundColor: '#fffdf5'
  },
  quickIcon: {
    fontSize: 22,
    marginRight: 10
  },
  quickDetails: {
    flex: 1
  },
  quickTitle: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800'
  },
  quickDesc: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2
  },
  quickArrow: {
    color: '#d97706',
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 6
  },

  // Section Generic
  section: {
    paddingVertical: 36,
    ...(Platform.OS === 'web' ? ({ scrollMarginTop: 95 } as any) : {})
  },
  sectionHead: {
    alignItems: 'center',
    marginBottom: 26
  },
  sectionTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  sectionTagBadgeText: {
    color: '#0e184e', // Deep Navy - NO BLUE!
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.4
  },
  sectionSubtitle: {
    color: '#475569',
    fontSize: 13.5,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 760,
    lineHeight: 20
  },

  // Operations Hub
  opTabsScroll: {
    marginBottom: 16
  },
  opTabBtn: {
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
    marginRight: 8
  },
  opTabBtnActive: {
    backgroundColor: '#0e184e', // Deep Navy - NO BLUE!
    borderColor: '#0e184e'
  },
  opTabBtnText: {
    color: '#334155',
    fontSize: 12.5,
    fontWeight: '600'
  },
  opTabBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  cardBox: {
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6', // Bootstrap 5 border
    borderWidth: 1,
    borderRadius: 6,        // Bootstrap 5 card radius
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  cardBoxHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16
  },
  cardBoxTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4
  },
  cardBoxSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2
  },
  cardBoxActionRow: {
    flexDirection: 'row',
    gap: 8
  },
  btnGoldSm: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    elevation: 2
  },
  btnGoldSmText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800'
  },
  btnPrimarySm: {
    backgroundColor: '#f59e0b',
    borderColor: '#d97706',
    borderWidth: 1.5,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    elevation: 2
  },
  btnPrimarySmText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '800'
  },
  subTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16
  },
  subTabBtn: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  subTabBtnActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b'
  },
  subTabBtnText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700'
  },
  subTabBtnTextActive: {
    color: '#b45309'
  },
  subSectionTitle: {
    color: '#b45309',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
    marginTop: 6
  },

  // Grids
  grid2Col: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  grid3Col: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },

  // College Card
  collegeCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1
  },
  collegeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  collegeName: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800'
  },
  collegeTaluk: {
    color: '#d97706',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1
  },
  collegeMeta: {
    color: '#475569',
    fontSize: 11.5,
    marginVertical: 1.5
  },
  collegeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  collegeTeamsBadge: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    borderWidth: 1,
    color: '#b45309',
    fontSize: 10.5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '700'
  },
  verifiedText: {
    color: '#15803d',
    fontSize: 11.5,
    fontWeight: '800'
  },

  // Forms
  formContainer: {
    marginTop: 16,
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6', // Bootstrap 5 border
    borderWidth: 1,
    borderRadius: 6,
    padding: 16
  },
  formHeaderTitle: {
    color: '#212529',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12
  },
  formField: {
    marginBottom: 12
  },
  formLabel: {
    color: '#495057',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4
  },
  formInput: {
    backgroundColor: '#ffffff',
    borderColor: '#ced4da', // Bootstrap 5 form-control border
    borderWidth: 1,
    borderRadius: 4,        // Bootstrap 5 0.25rem
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#212529',
    fontSize: 13
  },
  btnGold: {
    backgroundColor: '#0e184e', // Deep Navy - NO BLUE!
    borderColor: '#0e184e',
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 6
  },
  btnGoldText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },

  // Approval Box
  approvalBox: {
    backgroundColor: '#fffdf5',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16
  },
  approvalHeading: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800'
  },
  approvalDesc: {
    color: '#475569',
    fontSize: 12,
    marginTop: 4
  },

  // Institutions & Teams
  instCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  instName: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800'
  },
  instType: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2
  },
  statusPillActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
    borderWidth: 1,
    color: '#15803d',
    fontSize: 10.5,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  teamMgmtCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  teamMgmtName: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800'
  },
  teamMgmtSub: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 1
  },
  teamMgmtDivision: {
    color: '#d97706',
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 2
  },

  // Tournaments Step 1
  formatCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10
  },
  formatCard: {
    flex: 1,
    minWidth: 130,
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  formatCardActive: {
    borderColor: '#f59e0b',
    backgroundColor: '#fef3c7'
  },
  formatCardTitle: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
    textAlign: 'center'
  },
  formatCardDesc: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center'
  },

  // Live Scoring
  scoringOversBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#fffdf5',
    borderColor: '#fde68a',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 14
  },
  scoringOversLabel: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '800'
  },
  oversPillBtn: {
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14
  },
  oversPillBtnActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#d97706'
  },
  oversPillBtnText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700'
  },
  oversPillBtnTextActive: {
    color: '#ffffff',
    fontWeight: '900'
  },
  activeOversNotice: {
    color: '#15803d',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 'auto'
  },
  tossBox: {
    backgroundColor: '#fffdf5',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16
  },
  tossBoxTitle: {
    color: '#b45309',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8
  },
  tossControlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 6
  },
  smallChoiceBtn: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4
  },
  smallChoiceBtnActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b'
  },
  smallChoiceBtnText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700'
  },
  tossResultCard: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#fef3c7',
    borderRadius: 6
  },
  tossResultText: {
    color: '#92400e',
    fontSize: 11.5,
    fontWeight: '800'
  },
  rosterCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  rosterTeamTitle: {
    color: '#b45309',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6
  },
  rosterPlayerText: {
    color: '#475569',
    fontSize: 11.5,
    lineHeight: 18
  },

  // Match Centre Filter Tabs (Bootstrap 5 Nav Pills)
  filterTabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
    justifyContent: 'center'
  },
  filterTabBtn: {
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6', // Bootstrap 5 border
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,        // Bootstrap 5 btn radius
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  filterTabBtnActive: {
    backgroundColor: '#0e184e', // Deep Navy - NO BLUE!
    borderColor: '#0e184e',
    shadowColor: '#0e184e',
    shadowOpacity: 0.25
  },
  filterTabBtnText: {
    color: '#334155',
    fontSize: 12.5,
    fontWeight: '600'
  },
  filterTabBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },

  // Match Cards (Bootstrap 5 Card Architecture)
  matchCard: {
    flex: 1,
    minWidth: 290,
    maxWidth: 620,
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6',
    borderWidth: 1,
    borderTopWidth: 4,
    borderTopColor: '#6c757d',
    borderRadius: 6,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    justifyContent: 'space-between',
    marginBottom: 8
  },
  matchCardLive: {
    borderTopColor: '#dc3545', // Danger
    borderColor: '#f1aeb5',
    shadowColor: '#dc3545',
    shadowOpacity: 0.12
  },
  matchCardUpcoming: {
    borderTopColor: '#0e184e', // Deep Navy - NO BLUE!
    borderColor: '#cbd5e1',
    shadowColor: '#0e184e',
    shadowOpacity: 0.1
  },
  matchCardResult: {
    borderTopColor: '#198754', // Bootstrap 5 success
    borderColor: '#a3cfbb',
    shadowColor: '#198754',
    shadowOpacity: 0.1
  },
  matchCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6'
  },
  liveIndicatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8d7da', // Bootstrap 5 danger-subtle
    borderColor: '#f1aeb5',
    borderWidth: 1,
    borderRadius: 50,           // Bootstrap 5 rounded-pill
    paddingHorizontal: 9,
    paddingVertical: 3.5
  },
  pulseRedDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ef4444',
    marginRight: 5
  },
  liveIndicatorText: {
    color: '#dc2626',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  upcomingIndicatorPill: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3.5
  },
  upcomingIndicatorText: {
    color: '#1d4ed8',
    fontSize: 10.5,
    fontWeight: '800'
  },
  resultIndicatorPill: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3.5
  },
  resultIndicatorText: {
    color: '#059669',
    fontSize: 10.5,
    fontWeight: '800'
  },
  matchTournament: {
    color: '#0f172a',
    fontSize: 12.5,
    fontWeight: '800',
    flex: 1,
    textAlign: 'left'
  },
  formatBadgeT20: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  formatBadgeT20Text: {
    color: '#b45309',
    fontSize: 10,
    fontWeight: '800'
  },
  formatBadgeMulti: {
    backgroundColor: '#f3e8ff',
    borderColor: '#e9d5ff',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  formatBadgeMultiText: {
    color: '#7e22ce',
    fontSize: 10,
    fontWeight: '800'
  },
  formatBadgeOneDay: {
    backgroundColor: '#dbeafe',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  formatBadgeOneDayText: {
    color: '#1d4ed8',
    fontSize: 10,
    fontWeight: '800'
  },
  formatBadgeText: {
    color: '#334155',
    fontSize: 10,
    fontWeight: '800'
  },

  cardHeaderLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1
  },
  cardHeaderRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  topRightRainPill: {
    backgroundColor: '#e0f2fe',
    borderColor: '#38bdf8',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2
  },
  topRightRainPillText: {
    color: '#0284c7',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  topRightBreakPill: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  topRightBreakPillText: {
    color: '#b45309',
    fontSize: 10,
    fontWeight: '900'
  },
  matchTeamsSingleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginVertical: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1
  },
  teamColLeft: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    minWidth: 110
  },
  teamColRight: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 110
  },
  teamCrestNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    maxWidth: '100%'
  },
  teamNameTextSingleRow: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
    flexShrink: 1
  },
  teamScoreSingleRow: {
    fontSize: 16.5,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.3
  },
  teamYetToBatSingleRow: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    fontStyle: 'italic'
  },
  iplVsCenterBox: {
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iplVsCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderColor: '#d97706',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 3
  },
  iplVsCircleText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#fbbf24',
    fontStyle: 'italic',
    letterSpacing: 1.2
  },
  cardLogisticsBottomBar: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
    marginBottom: 10
  },
  logisticsChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 5,
    flexWrap: 'wrap'
  },
  logisticsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  logisticsEmoji: {
    fontSize: 12
  },
  logisticsValueText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700'
  },
  logisticsVenueChip: {
    cursor: Platform.OS === 'web' ? ('pointer' as any) : undefined,
  },
  venueTextLink: {
    color: '#0284c7',
    textDecorationLine: 'underline',
    fontWeight: '700'
  },
  venueMapIcon: {
    color: '#0284c7',
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 1
  },
  logisticsOfficialsBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  logisticsOfficialsCleanText: {
    color: '#64748b',
    fontSize: 10.5,
    fontWeight: '600'
  },

  // Logistics Box: Spaced out, clean white/slate card
  logisticsBox: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12
  },
  logisticsMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4
  },
  logisticsMetaItem: {
    color: '#334155',
    fontSize: 11.5,
    fontWeight: '700'
  },
  logisticsDot: {
    color: '#94a3b8',
    fontSize: 12
  },
  logisticsVenueText: {
    color: '#475569',
    fontSize: 11.5,
    fontWeight: '600',
    marginBottom: 4
  },
  logisticsOfficialsText: {
    color: '#64748b',
    fontSize: 10.5,
    lineHeight: 15
  },
  logisticsItem: {
    color: '#475569',
    fontSize: 10.5,
    lineHeight: 16
  },

  // Teams Box
  matchTeamsBox: {
    marginBottom: 10,
    gap: 4
  },
  iplVsDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    position: 'relative'
  },
  iplVsLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#cbd5e1'
  },
  iplVsBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 11,
    paddingVertical: 2.5,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#d97706',
    marginHorizontal: 8,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 3
  },
  iplVsText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#fbbf24',
    letterSpacing: 1.5,
    fontStyle: 'italic'
  },
  liveBreakIndicatorPill: {
    backgroundColor: '#d97706',
    borderColor: '#b45309'
  },
  cardBreakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 6,
    marginBottom: 2
  },
  cardBreakEmoji: {
    fontSize: 13,
    marginRight: 6
  },
  cardBreakText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
    flexShrink: 1
  },
  cardBreakSubText: {
    fontSize: 10,
    color: '#78350f',
    marginTop: 1
  },
  cardRainBanner: {
    backgroundColor: '#e0f2fe',
    borderColor: '#7dd3fc',
    borderWidth: 1.5
  },
  cardRainText: {
    color: '#0369a1',
    fontWeight: '800'
  },
  liveRainIndicatorPill: {
    backgroundColor: '#0284c7'
  },
  scorecardSummaryBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginTop: 8
  },
  scorecardSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  scorecardSummaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569'
  },
  scorecardSummaryVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155'
  },
  scorecardTableSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f2452',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  scorecardFowWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  scorecardFowChip: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  scorecardFowScore: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309'
  },
  scorecardFowBatter: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 1
  },
  openFullScorecardCta: {
    backgroundColor: '#005960',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 12
  },
  openFullScorecardCtaText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800'
  },
  homeOversBar: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between'
  },
  homeOversLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 2
  },
  homeOversValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a'
  },
  homeSuspendedBanner: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    marginTop: 8
  },
  homeSuspendedText: {
    color: '#9f1239',
    fontSize: 10.5,
    fontWeight: '700'
  },
  homeActiveBowlerPill: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  homeActiveBowlerPillText: {
    color: '#15803d',
    fontSize: 10,
    fontWeight: '800'
  },
  homeBowlingBadge: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1
  },
  homeBowlingBadgeText: {
    color: '#15803d',
    fontSize: 9,
    fontWeight: '800'
  },
  homeSuspendedPill: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginTop: 2
  },
  homeSuspendedPillText: {
    color: '#b91c1c',
    fontSize: 9,
    fontWeight: '800'
  },
  homeSubPill: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginTop: 2
  },
  homeSubPillText: {
    color: '#b45309',
    fontSize: 9,
    fontWeight: '700'
  },
  homeQuotaPill: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginTop: 2
  },
  homeQuotaPillText: {
    color: '#b45309',
    fontSize: 9,
    fontWeight: '800'
  },
  matchTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  battingNowRow: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd'
  },
  winnerRow: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0'
  },
  teamMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8
  },
  teamMiniCrest: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2
  },
  teamMiniCrestText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900'
  },
  teamNameText: {
    color: '#0f172a',
    fontSize: 13.5,
    fontWeight: '700',
    flexShrink: 1
  },
  battingIcon: {
    fontSize: 14,
    marginLeft: 6
  },
  winnerTrophyIcon: {
    fontSize: 15,
    marginLeft: 6
  },
  teamScores: {
    alignItems: 'flex-end',
    flexShrink: 0
  },
  runsText: {
    color: '#0f172a',
    fontSize: 15.5,
    fontWeight: '900'
  },
  oversText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600'
  },
  yetToBatText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },

  // Status Note Banners
  statusNoteLiveBox: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12
  },
  statusNoteLiveText: {
    color: '#be123c',
    fontSize: 12,
    fontWeight: '800'
  },
  statusNoteUpcomingBox: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12
  },
  statusNoteUpcomingText: {
    color: '#0369a1',
    fontSize: 12,
    fontWeight: '700'
  },
  statusNoteResultBox: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12
  },
  statusNoteResultText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '800'
  },
  matchStatusNote: {
    color: '#475569',
    fontSize: 11,
    marginBottom: 10,
    fontStyle: 'italic'
  },
  matchStatusNoteGold: {
    color: '#b45309',
    fontSize: 11,
    marginBottom: 10,
    fontWeight: '700'
  },

  // Action Buttons
  btnActionPrimary: {
    backgroundColor: '#f59e0b',
    borderColor: '#d97706',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2
  },
  btnActionPrimaryText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.2
  },
  btnActionSecondary: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnActionSecondaryText: {
    color: '#1e293b',
    fontSize: 12.5,
    fontWeight: '800'
  },
  btnActionSuccess: {
    backgroundColor: '#065f46',
    borderColor: '#047857',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#065f46',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2
  },
  btnActionSuccessText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.2
  },
  btnOutlineGoldBlock: {
    backgroundColor: '#ffffff',
    borderColor: '#f59e0b',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center'
  },
  btnOutlineGoldBlockText: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '800'
  },

  // Official Match Centre Button (Deep Navy - NO BLUE!)
  tncaMatchCentreCardBtn: {
    backgroundColor: '#0e184e', // Deep Navy
    borderColor: '#0e184e',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#0e184e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  tncaMatchCentreCardBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  // TNCA Media Sub-Nav Row (Image 1 Style: [ News ] [ Photos ] ── See More >)
  tncaMediaSubNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 6,
  },
  tncaMediaPillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tncaPillYellowActive: {
    backgroundColor: '#f5c43d',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 7,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  tncaPillYellowText: {
    color: '#0e184e',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  tncaPillWhiteInactive: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 7,
  },
  tncaPillWhiteText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '800',
  },
  tncaSeeMoreLink: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  tncaSeeMoreText: {
    color: '#0e184e',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  tncaMediaGoldDivider: {
    width: '100%',
    height: 2,
    backgroundColor: '#f5c43d',
    marginBottom: 16,
    borderRadius: 1,
  },

  // Tournaments Section (Bootstrap 5 Cards & Badges)
  tournamentCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6', // Bootstrap 5 border
    borderWidth: 1,
    borderTopWidth: 4,
    borderTopColor: '#0e184e', // Deep Navy - NO BLUE!
    borderRadius: 6,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  tBadgeWrap: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8
  },
  badgeGoldPill: {
    backgroundColor: '#fff3cd', // Bootstrap 5 warning subtle
    borderColor: '#ffe69c',
    borderWidth: 1,
    color: '#664d03',
    fontSize: 10.5,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 50 // rounded-pill
  },
  badgeBluePill: {
    backgroundColor: '#cfe2ff', // Bootstrap 5 primary subtle
    borderColor: '#9ec5fe',
    borderWidth: 1,
    color: '#0a58ca',
    fontSize: 10.5,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 50
  },
  badgeRedPill: {
    backgroundColor: '#f8d7da', // Bootstrap 5 danger subtle
    borderColor: '#f1aeb5',
    borderWidth: 1,
    color: '#842029',
    fontSize: 10.5,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 50
  },
  badgeGreenPill: {
    backgroundColor: '#d1e7dd', // Bootstrap 5 success subtle
    borderColor: '#a3cfbb',
    borderWidth: 1,
    color: '#0f5132',
    fontSize: 10.5,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 50
  },
  tourneyIcon: {
    fontSize: 28,
    marginBottom: 4
  },
  tourneyTitle: {
    color: '#0f172a',
    fontSize: 16.5,
    fontWeight: '800'
  },
  tourneySub: {
    color: '#d97706',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6
  },
  tourneyDesc: {
    color: '#475569',
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 10
  },
  tourneySpecs: {
    marginBottom: 12,
    backgroundColor: '#fffdf5',
    borderColor: '#fef3c7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8
  },
  tourneySpecItem: {
    color: '#334155',
    fontSize: 11.5,
    fontWeight: '600',
    marginVertical: 1.5
  },
  tourneyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginTop: 'auto',
    paddingTop: 10
  },
  btnOutlineGoldSm: {
    backgroundColor: '#ffffff',
    borderColor: '#f59e0b',
    borderWidth: 1.5,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnOutlineGoldSmText: {
    color: '#b45309',
    fontSize: 11.5,
    fontWeight: '800'
  },

  // Points & Performance Tables (Bootstrap 5 Tables)
  subTabsScroll: {
    marginBottom: 12
  },
  switchTabBtn: {
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6', // Bootstrap 5 border
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 4,        // Bootstrap 5 0.25rem
    marginRight: 8
  },
  switchTabBtnActive: {
    backgroundColor: '#0e184e', // Deep Navy - NO BLUE!
    borderColor: '#0e184e'
  },
  switchTabBtnText: {
    color: '#495057',           // Bootstrap 5 gray-700
    fontSize: 12,
    fontWeight: '600'
  },
  switchTabBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  tableBox: {
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6',     // Bootstrap 5 table border
    borderWidth: 1,
    borderRadius: 6,
    padding: 0,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#dee2e6',
    backgroundColor: '#f8f9fa'   // Bootstrap 5 table header background
  },
  tableTh: {
    color: '#495057',            // Bootstrap 5 gray-700
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    paddingHorizontal: 4
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
    backgroundColor: '#ffffff'
  },
  tableRowQualified: {
    backgroundColor: '#f8f9fa'   // Bootstrap 5 table hover
  },
  tableTd: {
    color: '#212529',            // Bootstrap 5 bodyColor
    fontSize: 11.5,
    paddingHorizontal: 4
  },
  pointsTeamName: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800'
  },
  pointsTeamSub: {
    color: '#d97706',
    fontSize: 9.5
  },
  playerSubRole: {
    color: '#d97706',
    fontSize: 9.5
  },
  rankBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  rankBadgeGold: {
    backgroundColor: '#f59e0b'
  },
  rankBadgeSilver: {
    backgroundColor: '#94a3b8'
  },
  rankBadgeBronze: {
    backgroundColor: '#d97706'
  },
  rankBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900'
  },
  formPill: {
    width: 20,
    height: 18,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center'
  },
  formPillW: {
    backgroundColor: '#15803d'
  },
  formPillL: {
    backgroundColor: '#dc2626'
  },
  formPillNR: {
    backgroundColor: '#d97706'
  },
  formPillText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900'
  },

  // Performance Records (Bootstrap 5 Tabs)
  perfTabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12
  },
  perfTabBtn: {
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6', // Bootstrap 5 border
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 4         // Bootstrap 5 0.25rem
  },
  perfTabBtnActive: {
    backgroundColor: '#0e184e', // Deep Navy - NO BLUE!
    borderColor: '#0e184e'
  },
  perfTabBtnText: {
    color: '#495057',           // Bootstrap 5 gray-700
    fontSize: 12,
    fontWeight: '600'
  },
  perfTabBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },

  // Ratings Leaderboard Sub-Filters
  ratingSubFilterBtn: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6
  },
  ratingSubFilterBtnActive: {
    backgroundColor: '#0e184e',
    borderColor: '#d4af37',
    borderWidth: 1.5
  },
  ratingSubFilterText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700'
  },
  ratingSubFilterTextActive: {
    color: '#fde047',
    fontWeight: '800'
  },
  ratingFormatBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },
  ratingFormatBtnActive: {
    backgroundColor: '#1e3a8a',
    borderColor: '#3b82f6'
  },
  ratingFormatText: {
    color: '#475569',
    fontSize: 10.5,
    fontWeight: '600'
  },
  ratingFormatTextActive: {
    color: '#ffffff',
    fontWeight: '800'
  },

  // District Players
  playerSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 10 : 8,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  playerSearchInput: {
    flex: 1,
    color: '#0f172a',
    fontSize: 13.5,
    paddingHorizontal: 8,
    outlineStyle: 'none' as any
  },
  playerPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  playerPillBtnActive: {
    backgroundColor: '#0e184e', // Deep Navy - NO BLUE!
    borderColor: '#0e184e'
  },
  playerPillBtnText: {
    color: '#495057',
    fontSize: 12,
    fontWeight: '600'
  },
  playerPillBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  specialRecordCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderTopWidth: 3,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 14
  },
  recordBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 12
  },
  recordBadgeLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  recordOfficialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  recordOfficialCheck: {
    color: '#15803d',
    fontSize: 10.5,
    fontWeight: '700'
  },
  recordProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  recordAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2
  },
  recordAvatarText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  recordPlayerName: {
    color: '#0e184e',
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.2
  },
  recordTeamText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2
  },
  recordRoleBadgePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    marginTop: 4
  },
  recordRoleBadgeText: {
    color: '#475569',
    fontSize: 10.5,
    fontWeight: '700'
  },
  recordRoleBadge: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2
  },
  recordTagPill: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  recordTagPillText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '800'
  },
  recordPerfBox: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12
  },
  recordPerfMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  recordPerfScore: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.3
  },
  recordPerfBalls: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748b',
    marginLeft: 4
  },
  recordSubMetricPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4
  },
  recordSubMetricText: {
    fontSize: 11,
    fontWeight: '800'
  },
  recordPerfMain: {
    fontSize: 15,
    fontWeight: '900',
    flex: 1,
    marginRight: 6
  },
  recordPerfSub: {
    color: '#64748b',
    fontSize: 11.5,
    fontWeight: '700'
  },
  recordMatchVsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2
  },
  recordMatchVs: {
    color: '#475569',
    fontSize: 11.5,
    fontWeight: '500',
    flex: 1
  },
  recordCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopColor: '#f1f5f9',
    borderTopWidth: 1
  },
  recordCardFooterText: {
    color: '#0e184e',
    fontSize: 11.5,
    fontWeight: '700'
  },
  recordCardFooterArrow: {
    fontSize: 12,
    fontWeight: '800'
  },
  playerCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderTopWidth: 4,
    borderTopColor: '#f59e0b',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3
  },
  playerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  playerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center'
  },
  playerAvatarText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900'
  },
  playerIdTag: {
    color: '#64748b',
    fontSize: 10.5,
    fontWeight: '700'
  },
  playerVerifiedTag: {
    color: '#15803d',
    fontSize: 10.5,
    fontWeight: '700'
  },
  playerName: {
    color: '#0f172a',
    fontSize: 14.5,
    fontWeight: '800'
  },
  playerCategoryBadge: {
    color: '#b45309',
    fontSize: 10.5,
    fontWeight: '700'
  },
  playerCardMeta: {
    marginBottom: 8
  },
  playerMetaText: {
    color: '#475569',
    fontSize: 11.5,
    marginVertical: 1.5
  },
  playerStatsSnippet: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fffdf5',
    borderColor: '#fef3c7',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    marginBottom: 8
  },
  pssCol: {
    alignItems: 'center'
  },
  pssVal: {
    color: '#b45309',
    fontSize: 13,
    fontWeight: '900'
  },
  pssLabel: {
    color: '#64748b',
    fontSize: 9.5
  },
  playerBioSnippet: {
    color: '#475569',
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 10
  },

  // About Section
  aboutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24
  },
  aboutTextCol: {
    flex: 1.4,
    minWidth: 300
  },
  aboutLead: {
    color: '#0f172a',
    fontSize: 14.5,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 8
  },
  aboutBody: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16
  },
  valuesList: {
    gap: 10
  },
  valueItem: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  valueTitle: {
    color: '#b45309',
    fontSize: 13,
    fontWeight: '800'
  },
  valueDesc: {
    color: '#475569',
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 2
  },
  aboutCrestCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3
  },
  aboutCrestImg: {
    width: 110,
    height: 110,
    marginBottom: 12
  },
  aboutCrestTitle: {
    color: '#0f172a',
    fontSize: 12.5,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5
  },
  aboutCrestMotto: {
    color: '#b45309',
    fontSize: 11.5,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 4
  },
  aboutCrestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 6
  },
  aboutCrestBadgeText: {
    color: '#92400e',
    fontSize: 10,
    fontWeight: '800'
  },
  officeBearersBox: {
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2
  },
  bearersHeading: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
    marginBottom: 14
  },
  bearersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    width: '100%'
  },
  bearerCard: {
    flex: 1,
    minWidth: 170,
    backgroundColor: '#fffdf5',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center'
  },
  bearerCardHighlight: {
    borderColor: '#f59e0b',
    backgroundColor: '#fef3c7'
  },
  bearerName: {
    color: '#0f172a',
    fontSize: 12.5,
    fontWeight: '800',
    textAlign: 'center'
  },
  bearerRole: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2
  },
  bearerTenure: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 1,
    textAlign: 'center'
  },

  // Grounds & Facilities (Bootstrap 5 Cards)
  groundCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6', // Bootstrap 5 border
    borderWidth: 1,
    borderTopWidth: 4,
    borderTopColor: '#0e184e', // Deep Navy - NO BLUE!
    borderRadius: 6,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  groundImg: {
    width: '100%',
    height: 150
  },
  groundBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#15803d', // Cricket Emerald Turf Green - NO BLUE!
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  groundBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900'
  },
  groundInfo: {
    padding: 12
  },
  groundTitle: {
    color: '#0f172a',
    fontSize: 14.5,
    fontWeight: '800'
  },
  groundLoc: {
    color: '#d97706',
    fontSize: 11,
    fontWeight: '700',
    marginVertical: 3
  },
  groundDesc: {
    color: '#475569',
    fontSize: 11.5,
    lineHeight: 17,
    marginBottom: 8
  },
  groundFacilitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  facilityPill: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 4
  },

  // Academy
  academyBanner: {
    borderRadius: 14,
    borderColor: '#fde68a',
    borderWidth: 1.5,
    backgroundColor: '#ffffff',
    padding: 20,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3
  },
  academyTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4
  },
  academyDesc: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 16
  },
  academyFeaturesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14
  },
  afItem: {
    flex: 1,
    minWidth: 240,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffdf5',
    borderColor: '#fef3c7',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8
  },
  afTitle: {
    color: '#b45309',
    fontSize: 12.5,
    fontWeight: '800'
  },
  afDesc: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 1
  },

  // News
  newsCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderTopWidth: 4,
    borderTopColor: '#f59e0b',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3
  },
  newsImg: {
    width: '100%',
    height: 140
  },
  newsBody: {
    padding: 12
  },
  newsDate: {
    color: '#64748b',
    fontSize: 10
  },
  newsCatBadge: {
    color: '#d97706',
    fontSize: 10.5,
    fontWeight: '700',
    marginVertical: 2
  },
  newsTitle: {
    color: '#0f172a',
    fontSize: 13.5,
    fontWeight: '800',
    lineHeight: 18,
    marginBottom: 6
  },
  newsExcerpt: {
    color: '#475569',
    fontSize: 11.5,
    lineHeight: 17,
    marginBottom: 10
  },

  // Gallery
  galleryItem: {
    flex: 1,
    minWidth: 260,
    height: 180,
    borderRadius: 10,
    overflow: 'hidden',
    borderColor: '#fde68a',
    borderWidth: 1
  },
  galleryImg: {
    width: '100%',
    height: '100%'
  },
  galleryOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderTopWidth: 1,
    borderTopColor: '#fde68a',
    padding: 8,
    alignItems: 'center'
  },
  galleryOverlayText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800'
  },

  // Contact (Bootstrap 5 Cards)
  contactInfoCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6', // Bootstrap 5 border
    borderWidth: 1,
    borderRadius: 6,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  contactFormCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#ffffff',
    borderColor: '#dee2e6', // Bootstrap 5 border
    borderWidth: 1,
    borderRadius: 6,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  contactCardTitle: {
    color: '#0e184e',       // Deep Navy - NO BLUE!
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12
  },
  contactLine: {
    color: '#334155',
    fontSize: 12.5,
    lineHeight: 20,
    marginBottom: 8
  },

  // Footer
  footer: {
    backgroundColor: '#01040d',
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.3)',
    paddingTop: 40,
    paddingBottom: 28
  },
  footerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
    marginBottom: 28
  },
  footerColBrand: {
    flex: 1.5,
    minWidth: 280
  },
  footerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  footerLogo: {
    width: 52,
    height: 52
  },
  footerBrandTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  footerMotto: {
    color: '#f5c43d',
    fontSize: 13.5,
    fontStyle: 'italic',
    marginTop: 2
  },
  footerDesc: {
    color: '#9bb0cf',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 14
  },
  footerAffilBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center'
  },
  footerAffilText: {
    color: '#fed966',
    fontSize: 12.5,
    fontWeight: '700'
  },
  footerCol: {
    flex: 1,
    minWidth: 160
  },
  footerColHeading: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.3)',
    paddingBottom: 6
  },
  footerLink: {
    color: '#9bb0cf',
    fontSize: 14.5,
    marginVertical: 5,
    fontWeight: '500'
  },
  footerBottom: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 20,
    alignItems: 'center'
  },
  copyrightText: {
    color: '#62799c',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8
  },
  legalLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  legalLink: {
    color: '#9bb0cf',
    fontSize: 13,
    fontWeight: '500'
  },
  legalDot: {
    color: '#62799c',
    fontSize: 13
  },

  // Modals Generic
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 18, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  scorecardModalBox: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 20,
    width: '95%',
    maxWidth: 720,
    maxHeight: '90%',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8
  },
  playerModalBox: {
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1.5,
    borderTopWidth: 4,
    borderTopColor: '#f59e0b',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 580,
    maxHeight: '90%',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8
  },
  newsModalBox: {
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1.5,
    borderTopWidth: 4,
    borderTopColor: '#f59e0b',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 540,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14
  },
  modalCloseCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 2
  },
  modalSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2
  },
  modalCloseBtn: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '800'
  },
  badgeGoldText: {
    color: '#b45309',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6
  },
  badgeBlueText: {
    color: '#1d4ed8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6
  },
  badgeRedText: {
    color: '#dc2626',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6
  },

  // Scorecard Modal Internal
  scorecardTossBanner: {
    backgroundColor: '#fefce8',
    borderColor: '#fef08a',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14
  },
  scorecardTossText: {
    color: '#854d0e',
    fontSize: 12,
    fontWeight: '700'
  },
  inningsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  inningsTitle: {
    color: '#0f172a',
    fontSize: 13.5,
    fontWeight: '800'
  },
  inningsScoreBadge: {
    backgroundColor: '#f59e0b',
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  tableScrollWrapper: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 4
  },
  scoreTable: {
    backgroundColor: '#ffffff',
    minWidth: 470
  },
  scoreTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 8
  },
  scoreTh: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '800'
  },
  scoreTableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
    alignItems: 'center'
  },
  scoreTableRowAlt: {
    backgroundColor: '#f8fafc'
  },
  scoreTd: {
    color: '#1e293b',
    fontSize: 11.5
  },

  // Player Profile Modal Internal
  playerModalBioBox: {
    backgroundColor: '#fffdf5',
    borderColor: '#fef3c7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12
  },
  playerModalBio: {
    color: '#334155',
    fontSize: 12,
    lineHeight: 18
  },
  playerModalStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fffdf5',
    borderColor: '#fef3c7',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    marginBottom: 12
  },
  pmsItem: {
    alignItems: 'center'
  },
  pmsVal: {
    color: '#b45309',
    fontSize: 16,
    fontWeight: '900'
  },
  pmsLabel: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2
  },
  playerModalMetaBox: {
    backgroundColor: '#fffdf5',
    borderColor: '#fef3c7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16
  },

  // Lightbox
  lightboxBox: {
    maxWidth: 700,
    width: '95%',
    alignItems: 'center'
  },
  lightboxCloseBtn: {
    alignSelf: 'flex-end',
    padding: 8
  },
  lightboxImg: {
    width: '100%',
    height: 380,
    borderRadius: 8
  },
  lightboxCaption: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center'
  },

  // News Modal Internal
  newsModalContent: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16
  },

  // Mobile Standings & Leaderboard Cards (Zero Horizontal Scroll on Mobile)
  mobileStandingsBox: {
    width: '100%',
    gap: 8,
    marginBottom: 12
  },
  mobileStandingsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  mobileStandingsCardQualified: {
    borderColor: '#fef08a',
    backgroundColor: '#fffdfa'
  },
  mobileStandingsCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%'
  },
  mobilePtsBadge: {
    backgroundColor: '#0e184e',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 42
  },
  mobilePtsBadgeNum: {
    color: '#f5c43d',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 15
  },
  mobilePtsBadgeLabel: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  mobileRunsBadge: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 46
  },
  mobileRunsBadgeNum: {
    color: '#b45309',
    fontSize: 12.5,
    fontWeight: '900',
    lineHeight: 14
  },
  mobileRunsBadgeLabel: {
    color: '#92400e',
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 0.4
  },
  mobileStandingsCardDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 8,
    width: '100%'
  },
  mobileStandingsCardStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%'
  },
  mobileStandingsStatItem: {
    alignItems: 'center',
    flex: 1
  },
  mobileStatLabel: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 2
  },
  mobileStatVal: {
    color: '#1e293b',
    fontSize: 11.5,
    fontWeight: '700'
  },
  mobileStandingsFormCol: {
    flex: 1.5,
    alignItems: 'flex-end'
  },
  formPillSm: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    alignItems: 'center',
    justifyContent: 'center'
  },
  formPillTextSm: {
    color: '#ffffff',
    fontSize: 8.5,
    fontWeight: '900'
  },
  mobilePerfContainer: {
    width: '100%',
    gap: 8,
    marginBottom: 12
  },
  mobilePerfCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  mobilePerfCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%'
  },
  subTabsContainer: {
    width: '100%',
    marginBottom: 12
  }
});
