/**
 * mobile_frontend/src/layouts/Header.tsx
 *
 * Reusable Header / Navbar Layout Component for CFVD.
 * Supports desktop navigation bar, brand block, user auth pill/login,
 * and responsive mobile drawer navigation.
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Platform,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppNavigation } from '../navigation/AppNavigator';
import { ScorerApi, getCurrentUser, setCurrentUser, setAuthToken, logoutAndClearAllSessions } from '../services/api';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import GlobalSearchModal from '../components/common/GlobalSearchModal';

const IMG_LOGO = require('../../assets/logo_transparent.png');

export interface HeaderProps {
  sessionUser?: any;
  onLogout?: () => void;
  onNavigateToUserPortal?: () => void;
  scrollToSection?: (secName: string) => void;
  onSelectCategory?: (category: any) => void;
  onScrollToTop?: () => void;
  isMobile?: boolean;
  mobileNavOpen?: boolean;
  setMobileNavOpen?: (open: boolean) => void;
  activeNav?: string;
  onSelectNav?: (navId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  sessionUser: propSessionUser,
  onLogout: propOnLogout,
  onNavigateToUserPortal: propOnNavigateToUserPortal,
  scrollToSection: propScrollToSection,
  onSelectCategory: _propOnSelectCategory,
  onScrollToTop: propOnScrollToTop,
  isMobile: propIsMobile,
  mobileNavOpen: propMobileNavOpen,
  setMobileNavOpen: propSetMobileNavOpen,
  activeNav: propActiveNav,
  onSelectNav: propOnSelectNav,
}) => {
  const { navigate } = useAppNavigation();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web'
    ? 0
    : Platform.OS === 'android'
      ? Math.max(insets.top, StatusBar.currentHeight || 0, 24)
      : Math.max(insets.top, 20);

  // Active Nav State (Underline style)
  const [internalActiveNav, setInternalActiveNav] = useState<string>('home');
  const activeNav = propActiveNav !== undefined ? propActiveNav : internalActiveNav;
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);

  // Inject Left-to-Right Hover Underline CSS for Web
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const styleId = 'cfvd-nav-underline-hover-css';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .cfvd-nav-link {
        position: relative !important;
        cursor: pointer !important;
        overflow: visible !important;
      }
      .cfvd-nav-underline {
        position: absolute !important;
        bottom: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 3px !important;
        background-color: #f5c43d !important;
        border-radius: 2px 2px 0 0 !important;
        transform: scaleX(0) !important;
        transform-origin: left !important;
        transition: transform 0.28s cubic-bezier(0.25, 1, 0.5, 1) !important;
        pointer-events: none !important;
      }
      .cfvd-nav-link:hover .cfvd-nav-underline,
      .cfvd-nav-link.cfvd-nav-active .cfvd-nav-underline {
        transform: scaleX(1) !important;
      }
      .cfvd-nav-link:hover .cfvd-nav-text,
      .cfvd-nav-link.cfvd-nav-active .cfvd-nav-text {
        color: #ffffff !important;
        transition: color 0.18s ease !important;
      }
      .cfvd-nav-link:hover .cfvd-nav-icon,
      .cfvd-nav-link.cfvd-nav-active .cfvd-nav-icon {
        color: #f5c43d !important;
        transition: color 0.18s ease !important;
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Search Modal state
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  const handleNavClick = (navId: string, action: () => void) => {
    setInternalActiveNav(navId);
    if (propOnSelectNav) propOnSelectNav(navId);
    action();
  };

  // Screen Width for responsive layout if not provided via props
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);
  const isMobile = propIsMobile !== undefined ? propIsMobile : windowWidth < 768;
  const isSmallMobile = windowWidth < 400;

  useEffect(() => {
    if (propIsMobile !== undefined) return;
    const sub = Dimensions.addEventListener('change', ({ window }: { window: any }) => {
      setWindowWidth(window.width);
    });
    return () => sub?.remove();
  }, [propIsMobile]);

  // Internal Session state fallback if not provided
  const [internalUser, setInternalUser] = useState<any>(() => getCurrentUser());
  const user = propSessionUser !== undefined ? propSessionUser : internalUser;

  // Internal Mobile Nav state fallback if not provided
  const [internalNavOpen, setInternalNavOpen] = useState(false);
  const isNavOpen = propMobileNavOpen !== undefined ? propMobileNavOpen : internalNavOpen;
  const setIsNavOpen = propSetMobileNavOpen || setInternalNavOpen;

  const handleScrollToTop = () => {
    if (propOnScrollToTop) {
      propOnScrollToTop();
    }
    setIsNavOpen(false);
  };

  const handleScrollToSection = (secName: string) => {
    if (propScrollToSection) {
      propScrollToSection(secName);
    } else {
      navigate('Home');
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        setTimeout(() => {
          const idMap: Record<string, string> = {
            matchCentre: 'cfvd-section-match-centre',
            pointsTable: 'cfvd-section-points-table',
            standings: 'cfvd-section-points-table',
            tournaments: 'cfvd-section-tournaments',
            stats: 'cfvd-section-stats',
            playerRatings: 'cfvd-section-stats',
            players: 'cfvd-section-players',
            about: 'cfvd-section-about',
            grounds: 'cfvd-section-grounds',
            news: 'cfvd-section-news',
            contact: 'cfvd-section-contact',
          };
          const targetId = idMap[secName] || secName;
          const el = document.getElementById(targetId);
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 350);
      }
    }
    setIsNavOpen(false);
  };

  const handleLogout = async () => {
    try {
      await logoutAndClearAllSessions();
    } catch (_e) { }
    setAuthToken(null);
    setCurrentUser(null);
    setInternalUser(null);
    if (propOnLogout) {
      try { propOnLogout(); } catch (_e) {}
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = '/';
      return;
    }
    navigate('Home');
  };

  const handleNavigateToUserPortal = () => {
    if (propOnNavigateToUserPortal) {
      propOnNavigateToUserPortal();
      return;
    }
    if (!user) return;
    const role = (user.role || '').toUpperCase();
    if (role === 'ADMIN') {
      navigate('Admin', { user });
    } else if (role === 'SCORER') {
      navigate('Scorer', { user });
    } else if (role === 'UMPIRE') {
      navigate('Umpire', { user });
    } else if (role === 'PLAYER') {
      navigate('Player', { user, playerName: user.name });
    } else if (role === 'COACH' || role === 'TEAM') {
      navigate('Team', { user, teamName: user.teamName });
    } else {
      navigate('Login');
    }
  };

  return (
    <View style={[styles.header, { paddingTop: topInset }]}>
      <View style={[styles.headerInner, isMobile && styles.headerInnerMobile]}>
        {/* Brand Block */}
        <TouchableOpacity
          style={[styles.brandBlock, isMobile && styles.brandBlockMobile]}
          onPress={handleScrollToTop}
          activeOpacity={0.8}
        >
          <Image
            source={IMG_LOGO}
            style={[styles.brandLogo, isMobile && styles.brandLogoMobile]}
            resizeMode="contain"
          />
          <View style={[styles.brandTextBlock, isMobile && styles.brandTextBlockMobile]}>
            <Text
              style={[styles.brandTitleMain, isMobile && styles.brandTitleMainMobile]}
              numberOfLines={1}
            >
              {isSmallMobile ? 'CRICKET ASSOC.' : 'CRICKET ASSOCIATION'}
            </Text>
            {!isSmallMobile && (
              <Text style={[styles.brandTitleSub, isMobile && styles.brandTitleSubMobile]} numberOfLines={1}>
                OF VIRUDHUNAGAR DISTRICT
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Desktop Navigation Links with Clean Left-to-Right Hover Underline */}
        {!isMobile && (
          <View style={styles.desktopNav}>
            {/* Home Link */}
            <TouchableOpacity
              style={[
                styles.navUnderlineItem,
                activeNav === 'home' && styles.navUnderlineItemActive,
              ]}
              onPress={() => handleNavClick('home', handleScrollToTop)}
              onMouseEnter={() => setHoveredNav('home')}
              onMouseLeave={() => setHoveredNav(null)}
              activeOpacity={0.8}
              {...({ className: `cfvd-nav-link ${activeNav === 'home' ? 'cfvd-nav-active' : ''}` } as any)}
            >
              <Ionicons
                name="home"
                size={14}
                color={activeNav === 'home' || hoveredNav === 'home' ? '#f5c43d' : '#cbd5e1'}
                style={{ marginRight: 5 }}
                {...({ className: 'cfvd-nav-icon' } as any)}
              />
              <Text
                style={[
                  styles.navUnderlineText,
                  (activeNav === 'home' || hoveredNav === 'home') && styles.navUnderlineTextActive,
                ]}
                {...({ className: 'cfvd-nav-text' } as any)}
              >
                Home
              </Text>
              <View
                style={[
                  styles.navUnderlineBar,
                  (activeNav === 'home' || hoveredNav === 'home') && styles.navUnderlineBarActive,
                ]}
                {...({ className: 'cfvd-nav-underline' } as any)}
              />
            </TouchableOpacity>

            {/* Match Centre Link */}
            <TouchableOpacity
              style={[
                styles.navUnderlineItem,
                activeNav === 'matchCentre' && styles.navUnderlineItemActive,
              ]}
              onPress={() => handleNavClick('matchCentre', () => handleScrollToSection('matchCentre'))}
              onMouseEnter={() => setHoveredNav('matchCentre')}
              onMouseLeave={() => setHoveredNav(null)}
              activeOpacity={0.8}
              {...({ className: `cfvd-nav-link ${activeNav === 'matchCentre' ? 'cfvd-nav-active' : ''}` } as any)}
            >
              <MaterialCommunityIcons
                name="cricket"
                size={15}
                color={activeNav === 'matchCentre' || hoveredNav === 'matchCentre' ? '#f5c43d' : '#cbd5e1'}
                style={{ marginRight: 5 }}
                {...({ className: 'cfvd-nav-icon' } as any)}
              />
              <Text
                style={[
                  styles.navUnderlineText,
                  (activeNav === 'matchCentre' || hoveredNav === 'matchCentre') && styles.navUnderlineTextActive,
                ]}
                {...({ className: 'cfvd-nav-text' } as any)}
              >
                Match Centre
              </Text>
              <View
                style={[
                  styles.navUnderlineBar,
                  (activeNav === 'matchCentre' || hoveredNav === 'matchCentre') && styles.navUnderlineBarActive,
                ]}
                {...({ className: 'cfvd-nav-underline' } as any)}
              />
            </TouchableOpacity>

            {/* Tournaments Link */}
            <TouchableOpacity
              style={[
                styles.navUnderlineItem,
                activeNav === 'tournaments' && styles.navUnderlineItemActive,
              ]}
              onPress={() => handleNavClick('tournaments', () => handleScrollToSection('tournaments'))}
              onMouseEnter={() => setHoveredNav('tournaments')}
              onMouseLeave={() => setHoveredNav(null)}
              activeOpacity={0.8}
              {...({ className: `cfvd-nav-link ${activeNav === 'tournaments' ? 'cfvd-nav-active' : ''}` } as any)}
            >
              <Ionicons
                name="ribbon-outline"
                size={14}
                color={activeNav === 'tournaments' || hoveredNav === 'tournaments' ? '#f5c43d' : '#cbd5e1'}
                style={{ marginRight: 5 }}
                {...({ className: 'cfvd-nav-icon' } as any)}
              />
              <Text
                style={[
                  styles.navUnderlineText,
                  (activeNav === 'tournaments' || hoveredNav === 'tournaments') && styles.navUnderlineTextActive,
                ]}
                {...({ className: 'cfvd-nav-text' } as any)}
              >
                Tournaments
              </Text>
              <View
                style={[
                  styles.navUnderlineBar,
                  (activeNav === 'tournaments' || hoveredNav === 'tournaments') && styles.navUnderlineBarActive,
                ]}
                {...({ className: 'cfvd-nav-underline' } as any)}
              />
            </TouchableOpacity>

            {/* Standings Link */}
            <TouchableOpacity
              style={[
                styles.navUnderlineItem,
                activeNav === 'pointsTable' && styles.navUnderlineItemActive,
              ]}
              onPress={() => handleNavClick('pointsTable', () => handleScrollToSection('pointsTable'))}
              onMouseEnter={() => setHoveredNav('pointsTable')}
              onMouseLeave={() => setHoveredNav(null)}
              activeOpacity={0.8}
              {...({ className: `cfvd-nav-link ${activeNav === 'pointsTable' ? 'cfvd-nav-active' : ''}` } as any)}
            >
              <Ionicons
                name="trophy-outline"
                size={14}
                color={activeNav === 'pointsTable' || hoveredNav === 'pointsTable' ? '#f5c43d' : '#cbd5e1'}
                style={{ marginRight: 5 }}
                {...({ className: 'cfvd-nav-icon' } as any)}
              />
              <Text
                style={[
                  styles.navUnderlineText,
                  (activeNav === 'pointsTable' || hoveredNav === 'pointsTable') && styles.navUnderlineTextActive,
                ]}
                {...({ className: 'cfvd-nav-text' } as any)}
              >
                Standings
              </Text>
              <View
                style={[
                  styles.navUnderlineBar,
                  (activeNav === 'pointsTable' || hoveredNav === 'pointsTable') && styles.navUnderlineBarActive,
                ]}
                {...({ className: 'cfvd-nav-underline' } as any)}
              />
            </TouchableOpacity>

            {/* Player Ratings Link */}
            {/* <TouchableOpacity
              style={[
                styles.navUnderlineItem,
                activeNav === 'stats' && styles.navUnderlineItemActive,
              ]}
              onPress={() => handleNavClick('stats', () => handleScrollToSection('stats'))}
              onMouseEnter={() => setHoveredNav('stats')}
              onMouseLeave={() => setHoveredNav(null)}
              activeOpacity={0.8}
              {...({ className: `cfvd-nav-link ${activeNav === 'stats' ? 'cfvd-nav-active' : ''}` } as any)}
            >
              <Ionicons
                name="star-outline"
                size={14}
                color={activeNav === 'stats' || hoveredNav === 'stats' ? '#f5c43d' : '#cbd5e1'}
                style={{ marginRight: 5 }}
                {...({ className: 'cfvd-nav-icon' } as any)}
              />
              <Text
                style={[
                  styles.navUnderlineText,
                  (activeNav === 'stats' || hoveredNav === 'stats') && styles.navUnderlineTextActive,
                ]}
                {...({ className: 'cfvd-nav-text' } as any)}
              >
                Player Ratings
              </Text>
              <View
                style={[
                  styles.navUnderlineBar,
                  (activeNav === 'stats' || hoveredNav === 'stats') && styles.navUnderlineBarActive,
                ]}
                {...({ className: 'cfvd-nav-underline' } as any)}
              />
            </TouchableOpacity> */}

            {/* Grounds Link */}
            {/* <TouchableOpacity
              style={[
                styles.navUnderlineItem,
                activeNav === 'grounds' && styles.navUnderlineItemActive,
              ]}
              onPress={() => handleNavClick('grounds', () => handleScrollToSection('grounds'))}
              onMouseEnter={() => setHoveredNav('grounds')}
              onMouseLeave={() => setHoveredNav(null)}
              activeOpacity={0.8}
              {...({ className: `cfvd-nav-link ${activeNav === 'grounds' ? 'cfvd-nav-active' : ''}` } as any)}
            >
              <Ionicons
                name="location-outline"
                size={14}
                color={activeNav === 'grounds' || hoveredNav === 'grounds' ? '#f5c43d' : '#cbd5e1'}
                style={{ marginRight: 5 }}
                {...({ className: 'cfvd-nav-icon' } as any)}
              />
              <Text
                style={[
                  styles.navUnderlineText,
                  (activeNav === 'grounds' || hoveredNav === 'grounds') && styles.navUnderlineTextActive,
                ]}
                {...({ className: 'cfvd-nav-text' } as any)}
              >
                Grounds
              </Text>
              <View
                style={[
                  styles.navUnderlineBar,
                  (activeNav === 'grounds' || hoveredNav === 'grounds') && styles.navUnderlineBarActive,
                ]}
                {...({ className: 'cfvd-nav-underline' } as any)}
              />
            </TouchableOpacity> */}

            {/* About Link */}
            {/* <TouchableOpacity
              style={[
                styles.navUnderlineItem,
                activeNav === 'about' && styles.navUnderlineItemActive,
              ]}
              onPress={() => handleNavClick('about', () => handleScrollToSection('about'))}
              onMouseEnter={() => setHoveredNav('about')}
              onMouseLeave={() => setHoveredNav(null)}
              activeOpacity={0.8}
              {...({ className: `cfvd-nav-link ${activeNav === 'about' ? 'cfvd-nav-active' : ''}` } as any)}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={14}
                color={activeNav === 'about' || hoveredNav === 'about' ? '#f5c43d' : '#cbd5e1'}
                style={{ marginRight: 5 }}
                {...({ className: 'cfvd-nav-icon' } as any)}
              />
              <Text
                style={[
                  styles.navUnderlineText,
                  (activeNav === 'about' || hoveredNav === 'about') && styles.navUnderlineTextActive,
                ]}
                {...({ className: 'cfvd-nav-text' } as any)}
              >
                About
              </Text>
              <View
                style={[
                  styles.navUnderlineBar,
                  (activeNav === 'about' || hoveredNav === 'about') && styles.navUnderlineBarActive,
                ]}
                {...({ className: 'cfvd-nav-underline' } as any)}
              />
            </TouchableOpacity> */}

            {/* Register Link */}
            <TouchableOpacity
              style={[
                styles.navUnderlineItem,
                activeNav === 'register' && styles.navUnderlineItemActive,
              ]}
              onPress={() => handleNavClick('register', () => navigate('Registration'))}
              onMouseEnter={() => setHoveredNav('register')}
              onMouseLeave={() => setHoveredNav(null)}
              activeOpacity={0.8}
              {...({ className: `cfvd-nav-link ${activeNav === 'register' ? 'cfvd-nav-active' : ''}` } as any)}
            >
              <Ionicons
                name="document-text-outline"
                size={14}
                color={activeNav === 'register' || hoveredNav === 'register' ? '#f5c43d' : '#cbd5e1'}
                style={{ marginRight: 5 }}
                {...({ className: 'cfvd-nav-icon' } as any)}
              />
              <Text
                style={[
                  styles.navUnderlineText,
                  (activeNav === 'register' || hoveredNav === 'register') && styles.navUnderlineTextActive,
                ]}
                {...({ className: 'cfvd-nav-text' } as any)}
              >
                Register
              </Text>
              <View
                style={[
                  styles.navUnderlineBar,
                  (activeNav === 'register' || hoveredNav === 'register') && styles.navUnderlineBarActive,
                ]}
                {...({ className: 'cfvd-nav-underline' } as any)}
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Header Action Buttons */}
        <View style={[styles.headerActions, isMobile && styles.headerActionsMobile]}>
          {/* Global Search Icon Button */}
          <TouchableOpacity
            style={[styles.headerSearchBtn, isMobile && styles.headerSearchBtnMobile]}
            onPress={() => setSearchModalOpen(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Search teams and players"
          >
            <Ionicons name="search" size={isMobile ? 18 : 15} color="#f5c43d" />
            {!isMobile && <Text style={styles.headerSearchBtnText}>Search</Text>}
          </TouchableOpacity>

          {user ? (
            <>
              {/* On mobile show only icon, on desktop show full pill */}
              <TouchableOpacity
                style={[styles.headerUserPill, isMobile && styles.headerUserPillMobile]}
                onPress={handleNavigateToUserPortal}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Go to user portal"
              >
                <Ionicons name="person-circle-outline" size={isMobile ? 20 : 16} color="#f5c43d" />
                {!isMobile && (
                  <>
                    <Text style={styles.headerUserNameText} numberOfLines={1}>
                      {user.name || user.email || 'User'}
                    </Text>
                    <View style={styles.headerUserRoleBadge}>
                      <Text style={styles.headerUserRoleBadgeText}>
                        {(user.role || 'USER').toUpperCase()}
                      </Text>
                    </View>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.headerLogoutBtn, isMobile && styles.headerLogoutBtnMobile]}
                onPress={handleLogout}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Logout"
              >
                <Ionicons name="log-out-outline" size={isMobile ? 18 : 13} color="#ef4444" />
                {!isMobile && (
                  <Text style={[styles.headerLogoutBtnText, { marginLeft: 4 }]}>Logout</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.headerLoginBtn, isMobile && styles.headerLoginBtnMobile]}
              onPress={() => navigate('Login')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Login to portal"
            >
              <Ionicons name="log-in-outline" size={15} color="#081225" style={isMobile ? {} : { marginRight: 5 }} />
              {!isSmallMobile && (
                <Text style={[styles.headerLoginBtnText, isMobile && { fontSize: 12, marginLeft: 4 }]}>Login</Text>
              )}
            </TouchableOpacity>
          )}

          {isMobile && (
            <TouchableOpacity
              style={styles.hamburgerBtn}
              onPress={() => setIsNavOpen(!isNavOpen)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={isNavOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              <Ionicons name={isNavOpen ? 'close' : 'menu'} size={22} color="#f5c43d" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Mobile Navigation Dropdown Drawer */}
      {isMobile && isNavOpen && (
        <View style={styles.mobileNavDrawer}>
          {user ? (
            <View style={styles.mobileUserCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Ionicons name="person-circle" size={16} color="#f5c43d" style={{ marginRight: 6 }} />
                <Text style={styles.mobileUserCardGreeting}>
                  Logged In: <Text style={{ color: '#f5c43d', fontWeight: 'bold' }}>{user.name || user.email}</Text>
                </Text>
              </View>
              <Text style={styles.mobileUserCardRole}>
                Role: {(user.role || 'USER').toUpperCase()}
              </Text>
              <View style={styles.mobileUserActionsRow}>
                <TouchableOpacity
                  style={styles.mobilePortalBtn}
                  onPress={() => {
                    setIsNavOpen(false);
                    handleNavigateToUserPortal();
                  }}
                >
                  <Ionicons name="speedometer-outline" size={13} color="#081225" style={{ marginRight: 5 }} />
                  <Text style={styles.mobilePortalBtnText}>Open Dashboard →</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mobileLogoutBtn}
                  onPress={() => {
                    setIsNavOpen(false);
                    handleLogout();
                  }}
                >
                  <Ionicons name="log-out-outline" size={13} color="#ef4444" style={{ marginRight: 4 }} />
                  <Text style={styles.mobileLogoutBtnText}>Logout</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.mobileNavItem, { backgroundColor: 'rgba(245, 196, 61, 0.12)', borderRadius: 6, paddingHorizontal: 10, marginBottom: 6 }]}
              onPress={() => {
                setIsNavOpen(false);
                navigate('Login');
              }}
            >
              <Ionicons name="log-in-outline" size={18} color="#f5c43d" style={{ marginRight: 10 }} />
              <Text style={[styles.mobileNavText, { color: '#f5c43d', fontWeight: '800' }]}>
                Login to Portal
              </Text>
            </TouchableOpacity>
          )}
          {/* Search Shortcut in Mobile Drawer */}
          <TouchableOpacity
            style={[styles.mobileNavItem, { backgroundColor: 'rgba(245, 196, 61, 0.1)', borderRadius: 6, paddingHorizontal: 10, marginBottom: 6 }]}
            onPress={() => {
              setIsNavOpen(false);
              setSearchModalOpen(true);
            }}
          >
            <Ionicons name="search" size={18} color="#f5c43d" style={{ marginRight: 10 }} />
            <Text style={[styles.mobileNavText, { color: '#f5c43d', fontWeight: '800' }]}>
              Search Teams & Players
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mobileNavItem}
            onPress={handleScrollToTop}
          >
            <Ionicons name="home-outline" size={18} color="#f5c43d" style={{ marginRight: 10 }} />
            <Text style={styles.mobileNavText}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mobileNavItem} onPress={() => handleScrollToSection('matchCentre')}>
            <MaterialCommunityIcons name="cricket" size={19} color="#f5c43d" style={{ marginRight: 10 }} />
            <Text style={styles.mobileNavText}>Match Centre & Live Scores</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mobileNavItem} onPress={() => handleScrollToSection('tournaments')}>
            <Ionicons name="ribbon-outline" size={18} color="#f5c43d" style={{ marginRight: 10 }} />
            <Text style={styles.mobileNavText}>Tournaments & Championships</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mobileNavItem} onPress={() => handleScrollToSection('pointsTable')}>
            <Ionicons name="trophy-outline" size={18} color="#f5c43d" style={{ marginRight: 10 }} />
            <Text style={styles.mobileNavText}>Standings & Points Table</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mobileNavItem} onPress={() => handleScrollToSection('stats')}>
            <Ionicons name="analytics-outline" size={18} color="#f5c43d" style={{ marginRight: 10 }} />
            <Text style={styles.mobileNavText}>Player Performance Stats</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mobileNavItem} onPress={() => handleScrollToSection('players')}>
            <Ionicons name="people-outline" size={18} color="#f5c43d" style={{ marginRight: 10 }} />
            <Text style={styles.mobileNavText}>District Talent Directory</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mobileNavItem} onPress={() => handleScrollToSection('grounds')}>
            <Ionicons name="location-outline" size={18} color="#f5c43d" style={{ marginRight: 10 }} />
            <Text style={styles.mobileNavText}>Grounds & Facilities</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mobileNavItem} onPress={() => handleScrollToSection('about')}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#f5c43d" style={{ marginRight: 10 }} />
            <Text style={styles.mobileNavText}>About CFVD Heritage</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mobileNavItem} onPress={() => handleScrollToSection('contact')}>
            <Ionicons name="mail-outline" size={18} color="#f5c43d" style={{ marginRight: 10 }} />
            <Text style={styles.mobileNavText}>Contact & Secretariat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mobileNavItem, { borderBottomWidth: 0, marginTop: 6 }]}
            onPress={() => {
              setIsNavOpen(false);
              navigate('Registration');
            }}
          >
            <Ionicons name="document-text-outline" size={18} color="#f5c43d" style={{ marginRight: 10 }} />
            <Text style={[styles.mobileNavText, { color: '#f5c43d', fontWeight: '700' }]}>
              Player / Team Registration
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Global Search Modal for Teams & Players */}
      <GlobalSearchModal
        visible={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onSelectTeam={(team) => {
          navigate('TeamDetail', { teamId: team.id, teamName: team.name });
        }}
        onSelectPlayer={(player) => {
          navigate('PlayerDetail', { playerId: player.id, playerName: player.name });
        }}
      />
    </View>
  );
};

export default Header;

const styles = StyleSheet.create({
  // Header / Navbar
  header: {
    backgroundColor: '#040a1b',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.25)',
    zIndex: 100,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(12px)' } as any) : {})
  },
  headerInner: {
    width: '100%',
    maxWidth: 1540,
    alignSelf: 'center',
    paddingHorizontal: Platform.OS === 'web' ? 32 : 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerInnerMobile: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  brandBlockMobile: {
    flexShrink: 1,
    flex: 1,
    minWidth: 0,
  },
  brandLogo: {
    width: 48,
    height: 48,
    marginRight: 10
  },
  brandLogoMobile: {
    width: 36,
    height: 36,
    marginRight: 7,
  },
  brandTextBlock: {
    justifyContent: 'center',
  },
  brandTextBlockMobile: {
    flexShrink: 1,
    minWidth: 0,
  },
  brandTitleMain: {
    color: '#f5c43d',
    fontSize: 14.5,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  brandTitleMainMobile: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
  brandTitleSub: {
    color: '#c0d1eb',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4
  },
  brandTitleSubMobile: {
    fontSize: 8,
    letterSpacing: 0.1,
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
    justifyContent: 'center',
    flex: 1,
    gap: 2,
    marginHorizontal: 8,
    height: '100%',
  },
  navUnderlineItem: {
    height: 48,
    paddingHorizontal: 10,
    marginHorizontal: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  navUnderlineItemActive: {},
  navUnderlineBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#f5c43d',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    transform: [{ scaleX: 0 }],
    ...(Platform.OS === 'web' ? ({
      transformOrigin: 'left',
      transition: 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1)',
    } as any) : {}),
  },
  navUnderlineBarActive: {
    transform: [{ scaleX: 1 }],
  },
  navUnderlineText: {
    color: '#cbd5e1',
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  navUnderlineTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  navHomePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.42)',
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  navHomePillText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '800'
  },
  navLinkDropdown: {
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  navDropdownText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '600'
  },
  navLink: {
    height: 36,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center'
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
    gap: 10,
    flexShrink: 0,
  },
  headerActionsMobile: {
    gap: 6,
  },
  headerSearchBtn: {
    backgroundColor: 'rgba(245, 196, 61, 0.12)',
    borderColor: 'rgba(245, 196, 61, 0.35)',
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  headerSearchBtnMobile: {
    paddingHorizontal: 8,
    minHeight: 44,
    minWidth: 44,
    borderRadius: 6,
    gap: 0,
  },
  headerSearchBtnText: {
    color: '#f5c43d',
    fontSize: 13,
    fontWeight: '700',
  },
  headerLoginBtn: {
    backgroundColor: '#f5c43d',
    paddingHorizontal: 16,
    minHeight: 44,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerLoginBtnMobile: {
    paddingHorizontal: 10,
    minHeight: 44,
    minWidth: 44,
    borderRadius: 6,
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
    minHeight: 44,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  headerUserPillMobile: {
    paddingHorizontal: 8,
    minHeight: 44,
    minWidth: 44,
    borderRadius: 22,
    gap: 0,
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
    minHeight: 44,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerLogoutBtnMobile: {
    paddingHorizontal: 7,
    minHeight: 44,
    minWidth: 44,
    borderRadius: 22,
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
    minHeight: 44,
    minWidth: 44,
    borderRadius: 6,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingVertical: 10,
    zIndex: 9999,
  },
  mobileNavItem: {
    minHeight: 44,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    flexDirection: 'row',
    alignItems: 'center'
  },
  mobileNavText: {
    color: '#e6edf8',
    fontSize: 14,
    fontWeight: '600'
  }
});
