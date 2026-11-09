/**
 * mobile_frontend/src/layouts/Header.tsx
 *
 * Professional TNCA-Style Header & Navigation System for Cricket Federation of Virudhunagar District (CFVD).
 * Directly matches the official TNCA portal architecture (https://tnca.cricket/):
 * - Top Affiliation Bar: TNCA Affiliated & BCCI System badges, State Matches pill, and Golden Login/User Pill
 * - Deep Navy Navigation Bar (#0e184e) with Interactive Dropdown Menus:
 *     - HOME
 *     - MATCH CENTRE ⌵ (Tournaments, Fixtures, Results, Points Table, Stats)
 *     - CFVD / TNCA ⌵ (Office Bearers, Affiliated Clubs, District Grounds, Hall of Fame)
 *     - DOCUMENTATION ⌵ (League Rules 2025-26, By-Laws, Cricket Laws, Anti-Corruption)
 *     - TRANSPARENCY ⌵ (Certified Scorers, Umpire Panel, Circulars)
 *     - ACADEMY (District Coaching Hubs)
 *     - DISTRICTS (Taluk Directory)
 *     - MORE ⌵ (News & Media, Contact)
 * - Fully Responsive: Desktop hover/tap dropdown cards + Mobile accordion drawer navigation.
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
  ScrollView,
} from 'react-native';
import { useAppNavigation } from '../navigation/AppNavigator';
import { ScorerApi, getCurrentUser, setCurrentUser, setAuthToken } from '../services/api';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const IMG_LOGO = require('../../assets/logo_transparent.png');

export interface HeaderProps {
  sessionUser?: any;
  onLogout?: () => void;
  onNavigateToUserPortal?: () => void;
  scrollToSection?: (secName: string) => void;
  onSelectCategory?: (category: 'tournaments' | 'fixtures' | 'results' | 'pointsTable' | 'stats' | 'rules' | 'clubs' | 'grounds' | 'news' | 'photos' | 'officials') => void;
  onScrollToTop?: () => void;
  isMobile?: boolean;
  mobileNavOpen?: boolean;
  setMobileNavOpen?: (open: boolean) => void;
}

type DropdownKey = 'matchCentre' | 'association' | 'documentation' | 'transparency' | 'more' | null;

export const Header: React.FC<HeaderProps> = ({
  sessionUser: propSessionUser,
  onLogout: propOnLogout,
  onNavigateToUserPortal: propOnNavigateToUserPortal,
  scrollToSection: propScrollToSection,
  onSelectCategory: propOnSelectCategory,
  onScrollToTop: propOnScrollToTop,
  isMobile: propIsMobile,
  mobileNavOpen: propMobileNavOpen,
  setMobileNavOpen: propSetMobileNavOpen,
}) => {
  const { navigate } = useAppNavigation();

  // Screen Width for responsive layout if not provided via props
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);
  const isMobile = propIsMobile !== undefined ? propIsMobile : windowWidth < 1024;
  const isSmallMobile = windowWidth < 420;

  useEffect(() => {
    if (propIsMobile !== undefined) return;
    const sub = Dimensions.addEventListener('change', ({ window }) => {
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

  // Desktop active dropdown key
  const [activeDropdown, setActiveDropdown] = useState<DropdownKey>(null);

  // Mobile accordion state
  const [expandedMobileMenu, setExpandedMobileMenu] = useState<string | null>(null);

  const toggleMobileAccordion = (menuKey: string) => {
    setExpandedMobileMenu(prev => prev === menuKey ? null : menuKey);
  };

  const handleScrollToTop = () => {
    setActiveDropdown(null);
    if (propOnScrollToTop) {
      propOnScrollToTop();
    }
    setIsNavOpen(false);
  };

  const handleScrollToSection = (secName: string) => {
    setActiveDropdown(null);
    if (propScrollToSection) {
      propScrollToSection(secName);
    }
    setIsNavOpen(false);
  };

  const handleCategoryClick = (category: 'tournaments' | 'fixtures' | 'results' | 'pointsTable' | 'stats' | 'rules' | 'clubs' | 'grounds' | 'news' | 'photos' | 'officials') => {
    setActiveDropdown(null);
    setIsNavOpen(false);
    if (propOnSelectCategory) {
      propOnSelectCategory(category);
    } else {
      if (category === 'tournaments') handleScrollToSection('tournaments');
      else if (category === 'fixtures' || category === 'results') handleScrollToSection('matchCentre');
      else if (category === 'pointsTable') handleScrollToSection('pointsTable');
      else if (category === 'stats') handleScrollToSection('stats');
      else if (category === 'rules') handleScrollToSection('rules');
      else if (category === 'clubs') handleScrollToSection('clubs');
      else if (category === 'grounds') handleScrollToSection('grounds');
      else if (category === 'news' || category === 'photos') handleScrollToSection('news');
      else handleScrollToSection('matchCentre');
    }
  };

  const handleLogout = async () => {
    if (propOnLogout) {
      propOnLogout();
      return;
    }
    try {
      await ScorerApi.logout();
    } catch (_e) { }
    setAuthToken(null);
    setCurrentUser(null);
    setInternalUser(null);
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
    <View style={styles.headerContainer}>
      {/* ─────────────────────────────────────────────────────────────
          1. TOP AFFILIATION STRIP (TNCA BADGES & STATE ACTION PILL)
          ───────────────────────────────────────────────────────────── */}
      <View style={styles.topAffiliationBar}>
        <View style={styles.topAffiliationInner}>
          {/* Left: Angled White Tab Holding Association Crest */}
          <TouchableOpacity
            style={styles.logoTrapezoidTab}
            onPress={handleScrollToTop}
            activeOpacity={0.85}
          >
            <Image source={IMG_LOGO} style={styles.tabLogoImage} resizeMode="contain" />
            <View style={styles.tabLogoTextCol}>
              <Text style={styles.tabOrgTitle}>CRICKET FEDERATION</Text>
              <Text style={styles.tabOrgSub}>OF VIRUDHUNAGAR DISTRICT</Text>
            </View>
          </TouchableOpacity>

          {/* Affiliation Badges Row (TNPL & BCCI Style) */}
          {!isMobile && (
            <View style={styles.affiliationBadgesGroup}>
              <View style={styles.badgePillTNCA}>
                <Text style={styles.badgePillIcon}>🏏</Text>
                <Text style={styles.badgePillText}>TNCA AFFILIATED</Text>
              </View>
              <View style={styles.badgePillBCCI}>
                <Text style={styles.badgePillIcon}>⭐</Text>
                <Text style={styles.badgePillText}>BCCI DOMESTIC SYSTEM</Text>
              </View>
            </View>
          )}

          {/* Right: State Matches Action Pill + Auth Pill */}
          <View style={styles.topRightActions}>
            <TouchableOpacity
              style={styles.stateMatchesPillBtn}
              onPress={() => handleCategoryClick('fixtures')}
              activeOpacity={0.85}
            >
              <Text style={styles.stateMatchesPillIcon}>🏟️</Text>
              <Text style={styles.stateMatchesPillText}>
                {isSmallMobile ? 'MATCH CENTRE' : 'VIEW STATE & DISTRICT MATCHES'}
              </Text>
            </TouchableOpacity>

            {/* Auth Login / User Pill */}
            {user ? (
              <TouchableOpacity
                style={styles.topUserPill}
                onPress={handleNavigateToUserPortal}
                activeOpacity={0.85}
              >
                <Ionicons name="person-circle" size={16} color="#0c174c" />
                <Text style={styles.topUserPillName} numberOfLines={1}>
                  {user.name || user.email || 'Official'}
                </Text>
                <View style={styles.topUserRoleBadge}>
                  <Text style={styles.topUserRoleBadgeText}>{(user.role || 'USER').toUpperCase()}</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.topLoginBtn}
                onPress={() => navigate('Login')}
                activeOpacity={0.85}
              >
                <Ionicons name="log-in-outline" size={15} color="#0c174c" style={{ marginRight: 4 }} />
                <Text style={styles.topLoginBtnText}>Login</Text>
              </TouchableOpacity>
            )}

            {isMobile && (
              <TouchableOpacity
                style={styles.mobileHamburgerBtn}
                onPress={() => setIsNavOpen(!isNavOpen)}
                activeOpacity={0.7}
              >
                <Ionicons name={isNavOpen ? 'close' : 'menu'} size={22} color="#ffffff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* ─────────────────────────────────────────────────────────────
          2. MAIN TNCA DEEP NAVY NAVIGATION BAR (#0e184e)
          ───────────────────────────────────────────────────────────── */}
      {!isMobile && (
        <View style={styles.mainNavBar}>
          <View style={styles.mainNavInner}>
            {/* 1. HOME BUTTON */}
            <TouchableOpacity
              style={[styles.navItemBtn, styles.navItemBtnHome]}
              onPress={handleScrollToTop}
              activeOpacity={0.8}
            >
              <Ionicons name="home" size={14} color="#f5c43d" style={{ marginRight: 5 }} />
              <Text style={styles.navItemTextActive}>HOME</Text>
            </TouchableOpacity>

            {/* 2. MATCH CENTRE DROPDOWN (Exact Image 1 Dropdown) */}
            <View style={styles.dropdownAnchorContainer}>
              <TouchableOpacity
                style={[styles.navItemBtn, activeDropdown === 'matchCentre' && styles.navItemBtnOpen]}
                onPress={() => setActiveDropdown(prev => prev === 'matchCentre' ? null : 'matchCentre')}
                activeOpacity={0.8}
              >
                <Text style={styles.navItemText}>MATCH CENTRE</Text>
                <Ionicons
                  name={activeDropdown === 'matchCentre' ? 'chevron-up' : 'chevron-down'}
                  size={13}
                  color="#ffffff"
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>

              {activeDropdown === 'matchCentre' && (
                <View style={styles.dropdownMenuCard}>
                  <TouchableOpacity
                    style={styles.dropdownMenuItem}
                    onPress={() => handleCategoryClick('tournaments')}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.dropdownItemIcon}>🏆</Text>
                    <Text style={styles.dropdownItemText}>TOURNAMENTS</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.dropdownMenuItem}
                    onPress={() => handleCategoryClick('fixtures')}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.dropdownItemIcon}>📅</Text>
                    <Text style={styles.dropdownItemText}>FIXTURES</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.dropdownMenuItem}
                    onPress={() => handleCategoryClick('results')}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.dropdownItemIcon}>📊</Text>
                    <Text style={styles.dropdownItemText}>RESULTS</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.dropdownMenuItem}
                    onPress={() => handleCategoryClick('pointsTable')}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.dropdownItemIcon}>🏅</Text>
                    <Text style={styles.dropdownItemText}>POINTS TABLE</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dropdownMenuItem, { borderBottomWidth: 0 }]}
                    onPress={() => handleCategoryClick('stats')}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.dropdownItemIcon}>📈</Text>
                    <Text style={styles.dropdownItemText}>STATS & RECORDS</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* 3. TNCA / CFVD DROPDOWN */}
            <View style={styles.dropdownAnchorContainer}>
              <TouchableOpacity
                style={[styles.navItemBtn, activeDropdown === 'association' && styles.navItemBtnOpen]}
                onPress={() => setActiveDropdown(prev => prev === 'association' ? null : 'association')}
                activeOpacity={0.8}
              >
                <Text style={styles.navItemText}>CFVD / TNCA</Text>
                <Ionicons
                  name={activeDropdown === 'association' ? 'chevron-up' : 'chevron-down'}
                  size={13}
                  color="#ffffff"
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>

              {activeDropdown === 'association' && (
                <View style={styles.dropdownMenuCard}>
                  <TouchableOpacity
                    style={styles.dropdownMenuItem}
                    onPress={() => handleScrollToSection('governance')}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.dropdownItemIcon}>🏛️</Text>
                    <Text style={styles.dropdownItemText}>OFFICE BEARERS</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.dropdownMenuItem}
                    onPress={() => handleCategoryClick('clubs')}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.dropdownItemIcon}>🛡️</Text>
                    <Text style={styles.dropdownItemText}>AFFILIATED CLUBS</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.dropdownMenuItem}
                    onPress={() => handleCategoryClick('grounds')}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.dropdownItemIcon}>📍</Text>
                    <Text style={styles.dropdownItemText}>GROUNDS & VENUES</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dropdownMenuItem, { borderBottomWidth: 0 }]}
                    onPress={() => handleScrollToSection('about')}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.dropdownItemIcon}>⭐</Text>
                    <Text style={styles.dropdownItemText}>HALL OF FAME & HERITAGE</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* 4. DOCUMENTATION DROPDOWN */}
            <View style={styles.dropdownAnchorContainer}>
              <TouchableOpacity
                style={[styles.navItemBtn, activeDropdown === 'documentation' && styles.navItemBtnOpen]}
                onPress={() => setActiveDropdown(prev => prev === 'documentation' ? null : 'documentation')}
                activeOpacity={0.8}
              >
                <Text style={styles.navItemText}>DOCUMENTATION</Text>
                <Ionicons
                  name={activeDropdown === 'documentation' ? 'chevron-up' : 'chevron-down'}
                  size={13}
                  color="#ffffff"
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>

              {activeDropdown === 'documentation' && (
                <View style={styles.dropdownMenuCard}>
                  <TouchableOpacity
                    style={styles.dropdownMenuItem}
                    onPress={() => handleCategoryClick('rules')}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.dropdownItemIcon}>📜</Text>
                    <Text style={styles.dropdownItemText}>LEAGUE RULES 2025-26</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.dropdownMenuItem}
                    onPress={() => handleCategoryClick('rules')}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.dropdownItemIcon}>⚖️</Text>
                    <Text style={styles.dropdownItemText}>MCC LAWS OF CRICKET</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dropdownMenuItem, { borderBottomWidth: 0 }]}
                    onPress={() => navigate('Registration')}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.dropdownItemIcon}>📝</Text>
                    <Text style={styles.dropdownItemText}>ODMS PLAYER REGISTRATION</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* 5. TRANSPARENCY DROPDOWN */}
            <View style={styles.dropdownAnchorContainer}>
              <TouchableOpacity
                style={[styles.navItemBtn, activeDropdown === 'transparency' && styles.navItemBtnOpen]}
                onPress={() => setActiveDropdown(prev => prev === 'transparency' ? null : 'transparency')}
                activeOpacity={0.8}
              >
                <Text style={styles.navItemText}>TRANSPARENCY</Text>
                <Ionicons
                  name={activeDropdown === 'transparency' ? 'chevron-up' : 'chevron-down'}
                  size={13}
                  color="#ffffff"
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>

              {activeDropdown === 'transparency' && (
                <View style={styles.dropdownMenuCard}>
                  <TouchableOpacity
                    style={styles.dropdownMenuItem}
                    onPress={() => handleScrollToSection('officials')}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.dropdownItemIcon}>📋</Text>
                    <Text style={styles.dropdownItemText}>CERTIFIED SCORER ROSTER</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.dropdownMenuItem}
                    onPress={() => handleScrollToSection('officials')}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.dropdownItemIcon}>⚖️</Text>
                    <Text style={styles.dropdownItemText}>CERTIFIED UMPIRE PANEL</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dropdownMenuItem, { borderBottomWidth: 0 }]}
                    onPress={() => handleCategoryClick('news')}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.dropdownItemIcon}>📢</Text>
                    <Text style={styles.dropdownItemText}>CIRCULARS & NOTICES</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* 6. ACADEMY BUTTON */}
            <TouchableOpacity
              style={styles.navItemBtn}
              onPress={() => handleScrollToSection('about')}
              activeOpacity={0.8}
            >
              <Text style={styles.navItemText}>ACADEMY</Text>
            </TouchableOpacity>

            {/* 7. DISTRICTS BUTTON */}
            <TouchableOpacity
              style={styles.navItemBtn}
              onPress={() => handleCategoryClick('clubs')}
              activeOpacity={0.8}
            >
              <Text style={styles.navItemText}>DISTRICTS</Text>
            </TouchableOpacity>

            {/* 8. MORE DROPDOWN */}
            <View style={styles.dropdownAnchorContainer}>
              <TouchableOpacity
                style={[styles.navItemBtn, activeDropdown === 'more' && styles.navItemBtnOpen]}
                onPress={() => setActiveDropdown(prev => prev === 'more' ? null : 'more')}
                activeOpacity={0.8}
              >
                <Text style={styles.navItemText}>MORE</Text>
                <Ionicons
                  name={activeDropdown === 'more' ? 'chevron-up' : 'chevron-down'}
                  size={13}
                  color="#ffffff"
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>

              {activeDropdown === 'more' && (
                <View style={[styles.dropdownMenuCard, { right: 0, left: 'auto' }]}>
                  <TouchableOpacity
                    style={styles.dropdownMenuItem}
                    onPress={() => handleCategoryClick('news')}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.dropdownItemIcon}>📰</Text>
                    <Text style={styles.dropdownItemText}>NEWS & BULLETINS</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.dropdownMenuItem}
                    onPress={() => handleCategoryClick('photos')}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.dropdownItemIcon}>📷</Text>
                    <Text style={styles.dropdownItemText}>PHOTO GALLERY</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dropdownMenuItem, { borderBottomWidth: 0 }]}
                    onPress={() => handleScrollToSection('footer')}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.dropdownItemIcon}>📞</Text>
                    <Text style={styles.dropdownItemText}>CONTACT US</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. MOBILE RESPONSIVE ACCORDION DRAWER NAVIGATION
          ───────────────────────────────────────────────────────────── */}
      {isMobile && isNavOpen && (
        <ScrollView style={styles.mobileNavDrawer} showsVerticalScrollIndicator={false}>
          {user ? (
            <View style={styles.mobileUserCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Ionicons name="person-circle" size={18} color="#f5c43d" style={{ marginRight: 6 }} />
                <Text style={styles.mobileUserName}>{user.name || user.email}</Text>
              </View>
              <Text style={styles.mobileUserRole}>{user.role} • Certified Federation Account</Text>
              <TouchableOpacity style={styles.mobilePortalBtn} onPress={handleNavigateToUserPortal}>
                <Text style={styles.mobilePortalBtnText}>Open {user.role} Dashboard →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.mobileLoginBanner}
              onPress={() => {
                setIsNavOpen(false);
                navigate('Login');
              }}
            >
              <Ionicons name="log-in-outline" size={18} color="#0c174c" style={{ marginRight: 6 }} />
              <Text style={styles.mobileLoginBannerText}>Sign In to Official Account</Text>
            </TouchableOpacity>
          )}

          {/* Home */}
          <TouchableOpacity style={styles.mobileNavItem} onPress={handleScrollToTop}>
            <Ionicons name="home" size={18} color="#f5c43d" style={{ marginRight: 10 }} />
            <Text style={styles.mobileNavText}>HOME</Text>
          </TouchableOpacity>

          {/* Match Centre Accordion */}
          <TouchableOpacity
            style={styles.mobileAccordionHeader}
            onPress={() => toggleMobileAccordion('matchCentre')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="cricket" size={18} color="#f5c43d" style={{ marginRight: 10 }} />
              <Text style={styles.mobileNavText}>MATCH CENTRE</Text>
            </View>
            <Ionicons
              name={expandedMobileMenu === 'matchCentre' ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="#ffffff"
            />
          </TouchableOpacity>
          {expandedMobileMenu === 'matchCentre' && (
            <View style={styles.mobileAccordionBody}>
              <TouchableOpacity style={styles.mobileSubItem} onPress={() => handleCategoryClick('tournaments')}>
                <Text style={styles.mobileSubItemText}>🏆 Tournaments</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mobileSubItem} onPress={() => handleCategoryClick('fixtures')}>
                <Text style={styles.mobileSubItemText}>📅 Fixtures & Schedule</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mobileSubItem} onPress={() => handleCategoryClick('results')}>
                <Text style={styles.mobileSubItemText}>📊 Match Results</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mobileSubItem} onPress={() => handleCategoryClick('pointsTable')}>
                <Text style={styles.mobileSubItemText}>🏅 Points Table & NRR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mobileSubItem} onPress={() => handleCategoryClick('stats')}>
                <Text style={styles.mobileSubItemText}>📈 Stats & Leaderboards</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* CFVD / Association Accordion */}
          <TouchableOpacity
            style={styles.mobileAccordionHeader}
            onPress={() => toggleMobileAccordion('association')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="shield-checkmark" size={18} color="#f5c43d" style={{ marginRight: 10 }} />
              <Text style={styles.mobileNavText}>CFVD / TNCA</Text>
            </View>
            <Ionicons
              name={expandedMobileMenu === 'association' ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="#ffffff"
            />
          </TouchableOpacity>
          {expandedMobileMenu === 'association' && (
            <View style={styles.mobileAccordionBody}>
              <TouchableOpacity style={styles.mobileSubItem} onPress={() => handleScrollToSection('governance')}>
                <Text style={styles.mobileSubItemText}>🏛️ Office Bearers</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mobileSubItem} onPress={() => handleCategoryClick('clubs')}>
                <Text style={styles.mobileSubItemText}>🛡️ Affiliated Clubs</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mobileSubItem} onPress={() => handleCategoryClick('grounds')}>
                <Text style={styles.mobileSubItemText}>📍 District Grounds</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Documentation & Rules */}
          <TouchableOpacity
            style={styles.mobileAccordionHeader}
            onPress={() => toggleMobileAccordion('documentation')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="document-text" size={18} color="#f5c43d" style={{ marginRight: 10 }} />
              <Text style={styles.mobileNavText}>DOCUMENTATION</Text>
            </View>
            <Ionicons
              name={expandedMobileMenu === 'documentation' ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="#ffffff"
            />
          </TouchableOpacity>
          {expandedMobileMenu === 'documentation' && (
            <View style={styles.mobileAccordionBody}>
              <TouchableOpacity style={styles.mobileSubItem} onPress={() => handleCategoryClick('rules')}>
                <Text style={styles.mobileSubItemText}>📜 League Rules 2025-26</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mobileSubItem} onPress={() => handleCategoryClick('rules')}>
                <Text style={styles.mobileSubItemText}>⚖️ MCC Laws of Cricket</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Registration Action */}
          <TouchableOpacity
            style={styles.mobileRegisterBtn}
            onPress={() => {
              setIsNavOpen(false);
              navigate('Registration');
            }}
          >
            <Text style={styles.mobileRegisterBtnText}>📝 Player & Team Registration (ODMS)</Text>
          </TouchableOpacity>

          {user && (
            <TouchableOpacity style={styles.mobileLogoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={16} color="#ef4444" style={{ marginRight: 6 }} />
              <Text style={styles.mobileLogoutBtnText}>Logout from Account</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
};

export default Header;

const styles = StyleSheet.create({
  headerContainer: {
    width: '100%',
    zIndex: 999,
  },

  // 1. Top Affiliation Bar
  topAffiliationBar: {
    backgroundColor: '#070f2e',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  topAffiliationInner: {
    width: '100%',
    maxWidth: 1560,
    alignSelf: 'center',
    paddingHorizontal: Platform.OS === 'web' ? 24 : 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
  },

  // Left Angled Trapezoid Logo Tab (TNCA Style)
  logoTrapezoidTab: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
    marginRight: 14,
  },
  tabLogoImage: {
    width: 38,
    height: 38,
    marginRight: 10,
  },
  tabLogoTextCol: {
    justifyContent: 'center',
  },
  tabOrgTitle: {
    color: '#0e184e',
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  tabOrgSub: {
    color: '#0284c7',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Affiliation Badges
  affiliationBadgesGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgePillTNCA: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 24, 78, 0.8)',
    borderColor: '#38bdf8',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgePillBCCI: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 24, 78, 0.8)',
    borderColor: '#f5c43d',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgePillIcon: {
    fontSize: 11,
    marginRight: 5,
  },
  badgePillText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  // Top Right Actions
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stateMatchesPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 20,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  stateMatchesPillIcon: {
    fontSize: 12,
    marginRight: 6,
  },
  stateMatchesPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  topLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5c43d',
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 20,
  },
  topLoginBtnText: {
    color: '#0c174c',
    fontSize: 12,
    fontWeight: '900',
  },
  topUserPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fed7aa',
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 20,
    gap: 5,
  },
  topUserPillName: {
    color: '#0c174c',
    fontSize: 12,
    fontWeight: '800',
    maxWidth: 90,
  },
  topUserRoleBadge: {
    backgroundColor: '#0c174c',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  topUserRoleBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  mobileHamburgerBtn: {
    padding: 6,
    marginLeft: 4,
  },

  // 2. Main Deep Navy Navigation Bar (#0e184e)
  mainNavBar: {
    backgroundColor: '#0e184e',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 900,
  },
  mainNavInner: {
    width: '100%',
    maxWidth: 1560,
    alignSelf: 'center',
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
  },
  navItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 46,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  navItemBtnHome: {
    borderBottomColor: '#f5c43d',
  },
  navItemBtnOpen: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderBottomColor: '#38bdf8',
  },
  navItemText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  navItemTextActive: {
    color: '#f5c43d',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // Dropdown Floating Card (Exact Image 1 Style)
  dropdownAnchorContainer: {
    position: 'relative',
  },
  dropdownMenuCard: {
    position: 'absolute',
    top: 46,
    left: 0,
    minWidth: 200,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 8,
    zIndex: 9999,
    overflow: 'hidden',
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownItemIcon: {
    fontSize: 14,
    marginRight: 10,
  },
  dropdownItemText: {
    color: '#0e184e',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  // 3. Mobile Navigation Drawer
  mobileNavDrawer: {
    backgroundColor: '#0c174c',
    padding: 16,
    maxHeight: 520,
    borderBottomWidth: 2,
    borderBottomColor: '#f5c43d',
  },
  mobileUserCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  mobileUserName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  mobileUserRole: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 8,
  },
  mobilePortalBtn: {
    backgroundColor: '#f5c43d',
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: 'center',
  },
  mobilePortalBtnText: {
    color: '#0c174c',
    fontSize: 12,
    fontWeight: '900',
  },
  mobileLoginBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5c43d',
    borderRadius: 8,
    paddingVertical: 10,
    marginBottom: 14,
  },
  mobileLoginBannerText: {
    color: '#0c174c',
    fontSize: 13,
    fontWeight: '900',
  },
  mobileNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  mobileAccordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  mobileNavText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  mobileAccordionBody: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 6,
    paddingVertical: 4,
    marginBottom: 6,
  },
  mobileSubItem: {
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  mobileSubItemText: {
    color: '#cbd5e1',
    fontSize: 12.5,
    fontWeight: '700',
  },
  mobileRegisterBtn: {
    backgroundColor: '#0284c7',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginVertical: 14,
  },
  mobileRegisterBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  mobileLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  mobileLogoutBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '800',
  },
});
