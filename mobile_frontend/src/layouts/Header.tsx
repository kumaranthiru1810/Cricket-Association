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
  onScrollToTop?: () => void;
  isMobile?: boolean;
  mobileNavOpen?: boolean;
  setMobileNavOpen?: (open: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  sessionUser: propSessionUser,
  onLogout: propOnLogout,
  onNavigateToUserPortal: propOnNavigateToUserPortal,
  scrollToSection: propScrollToSection,
  onScrollToTop: propOnScrollToTop,
  isMobile: propIsMobile,
  mobileNavOpen: propMobileNavOpen,
  setMobileNavOpen: propSetMobileNavOpen,
}) => {
  const { navigate } = useAppNavigation();

  // Screen Width for responsive layout if not provided via props
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);
  const isMobile = propIsMobile !== undefined ? propIsMobile : windowWidth < 768;
  const isSmallMobile = windowWidth < 400;

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

  const handleScrollToTop = () => {
    if (propOnScrollToTop) {
      propOnScrollToTop();
    }
    setIsNavOpen(false);
  };

  const handleScrollToSection = (secName: string) => {
    if (propScrollToSection) {
      propScrollToSection(secName);
    }
    setIsNavOpen(false);
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
    <View style={styles.header}>
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

        {/* Desktop Navigation Links */}
        {!isMobile && (
          <View style={styles.desktopNav}>
            {/* Active Home Pill */}
            <TouchableOpacity
              style={styles.navHomePill}
              onPress={handleScrollToTop}
              activeOpacity={0.8}
            >
              <Ionicons name="home" size={14} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.navHomePillText}>Home</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navLinkDropdown}
              onPress={() => handleScrollToSection('matchCentre')}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="cricket" size={16} color="#f5c43d" style={{ marginRight: 6 }} />
              <Text style={styles.navDropdownText}>Match Centre</Text>
              {/* <Ionicons name="chevron-down" size={12} color="#c0d1eb" style={{ marginLeft: 4 }} /> */}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navLinkDropdown}
              onPress={() => handleScrollToSection('pointsTable')}
              activeOpacity={0.7}
            >
              <Ionicons name="trophy-outline" size={15} color="#f5c43d" style={{ marginRight: 6 }} />
              <Text style={styles.navDropdownText}>Standings</Text>
              {/* <Ionicons name="chevron-down" size={12} color="#c0d1eb" style={{ marginLeft: 4 }} /> */}
            </TouchableOpacity>
          </View>
        )}

        {/* Header Action Buttons */}
        <View style={[styles.headerActions, isMobile && styles.headerActionsMobile]}>
          {user ? (
            <>
              {/* On mobile show only icon, on desktop show full pill */}
              <TouchableOpacity
                style={[styles.headerUserPill, isMobile && styles.headerUserPillMobile]}
                onPress={handleNavigateToUserPortal}
                activeOpacity={0.85}
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
            >
              <Ionicons name={isNavOpen ? 'close' : 'menu'} size={20} color="#f5c43d" />
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

          <TouchableOpacity style={styles.mobileNavItem} onPress={() => handleScrollToSection('about')}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#f5c43d" style={{ marginRight: 10 }} />
            <Text style={styles.mobileNavText}>About CFVD Heritage</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mobileNavItem} onPress={() => handleScrollToSection('grounds')}>
            <Ionicons name="location-outline" size={18} color="#f5c43d" style={{ marginRight: 10 }} />
            <Text style={styles.mobileNavText}>Grounds & Facilities</Text>
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
    gap: 12,
    marginHorizontal: 16
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
  headerLoginBtn: {
    backgroundColor: '#f5c43d',
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerLoginBtnMobile: {
    paddingHorizontal: 10,
    height: 32,
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
    height: 36,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  headerUserPillMobile: {
    paddingHorizontal: 8,
    height: 32,
    borderRadius: 20,
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
    height: 36,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerLogoutBtnMobile: {
    paddingHorizontal: 7,
    height: 32,
    borderRadius: 20,
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
