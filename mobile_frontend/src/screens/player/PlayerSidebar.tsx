/**
 * src/screens/player/PlayerSidebar.tsx
 *
 * Dedicated Sidebar Navigation component for the Player Portal.
 * Supports:
 * - Desktop collapsible sidebar — WHITE background, golden active/hover accents
 * - Mobile drawer overlay with backdrop, header, and close action
 * - Player profile header (avatar initial, player name, role, jersey number, CFVD official badge)
 * - Navigation links with vector SVG icons & live badges (Squad, Matches, Notices)
 * - Logout button with red accent & confirmation trigger
 * - Desktop sidebar collapse/expand toggle
 */

import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  Platform
} from 'react-native';
import {
  DashboardIcon,
  PlayersIcon,
  UsersIcon,
  CricketBatIcon,
  StatisticsIcon,
  BellIcon,
  AwardIcon,
  LogoutIcon,
  CloseIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '../../admin/components/Icons';

export type PlayerTabType =
  | 'overview'
  | 'profile'
  | 'team'
  | 'matches'
  | 'statistics'
  | 'achievements'
  | 'notifications';

export type TabType = PlayerTabType;

export interface PlayerNavItem {
  key: PlayerTabType;
  label: string;
  icon: (color: string) => React.ReactNode;
  badge?: number;
  badgeType?: 'blue' | 'orange' | 'gold';
}

export interface PlayerSidebarProps {
  activeTab: PlayerTabType;
  onSelectTab: (tab: PlayerTabType) => void;
  playerName?: string;
  playerRole?: string;
  jerseyNumber?: string | number;
  squadCount?: number;
  matchesCount?: number;
  achievementsCount?: number;
  notificationsCount?: number;
  isDesktop?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onLogout?: () => void;
}

export const getPlayerNavItems = (badges?: {
  squadCount?: number;
  matchesCount?: number;
  achievementsCount?: number;
  notificationsCount?: number;
}): PlayerNavItem[] => [
  {
    key: 'overview',
    label: 'Overview',
    icon: (c) => <DashboardIcon size={18} color={c} />
  },
  {
    key: 'profile',
    label: 'My Profile',
    icon: (c) => <PlayersIcon size={18} color={c} />
  },
  {
    key: 'team',
    label: 'My Squad',
    icon: (c) => <UsersIcon size={18} color={c} />,
    badge: badges?.squadCount,
    badgeType: 'blue'
  },
  {
    key: 'matches',
    label: 'Matches',
    icon: (c) => <CricketBatIcon size={18} color={c} />,
    badge: badges?.matchesCount,
    badgeType: 'orange'
  },
  {
    key: 'statistics',
    label: 'Statistics',
    icon: (c) => <StatisticsIcon size={18} color={c} />
  },
  {
    key: 'achievements',
    label: 'Achievements',
    icon: (c) => <AwardIcon size={18} color={c} />,
    badge: badges?.achievementsCount,
    badgeType: 'gold'
  },
  {
    key: 'notifications',
    label: 'Notices',
    icon: (c) => <BellIcon size={18} color={c} />,
    badge: badges?.notificationsCount,
    badgeType: 'gold'
  }
];

export const PlayerSidebar: React.FC<PlayerSidebarProps> = ({
  activeTab,
  onSelectTab,
  playerName = 'Player',
  playerRole = 'Batter',
  jerseyNumber = '10',
  squadCount = 0,
  matchesCount = 0,
  achievementsCount = 0,
  notificationsCount = 0,
  isDesktop: propIsDesktop,
  isCollapsed = false,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
  onLogout
}) => {
  const { width } = useWindowDimensions();
  const isDesktop = propIsDesktop ?? width >= 768;

  // Inject hover CSS for web — golden hover on nav items
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    const styleId = 'player-sidebar-hover-css';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Player Sidebar — golden hover for nav items */
      .player-sidebar-nav-item:hover {
        background-color: rgba(212, 175, 55, 0.12) !important;
        border-color: rgba(212, 175, 55, 0.45) !important;
        transition: background-color 0.18s ease, border-color 0.18s ease;
      }
      .player-sidebar-nav-item {
        transition: background-color 0.18s ease, border-color 0.18s ease;
      }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  // Build nav items with dynamic badges
  const navItems = getPlayerNavItems({
    squadCount: squadCount || 15,
    matchesCount,
    achievementsCount,
    notificationsCount
  });

  const sidebarContent = (
    <View style={[styles.sidebarContainer, isCollapsed && styles.sidebarCollapsed]}>
      {/* Top Section */}
      <View style={styles.sidebarTopSection}>
        {/* 1. Player Profile Header Card */}
        <View style={[styles.sidebarPlayerCard, isCollapsed && styles.sidebarPlayerCardCollapsed]}>
          <View style={styles.playerAvatarCircle}>
            <Text style={styles.playerAvatarText}>
              {playerName ? playerName.charAt(0).toUpperCase() : 'P'}
            </Text>
          </View>
          {!isCollapsed && (
            <View style={styles.sidebarPlayerInfo}>
              <Text style={styles.sidebarPlayerName} numberOfLines={1}>
                {playerName}
              </Text>
              <Text style={styles.sidebarPlayerRole} numberOfLines={1}>
                {playerRole} - {jerseyNumber}
              </Text>
              {/* <View style={styles.playerDistrictBadge}>
                <Text style={styles.playerDistrictBadgeText}>CFVD OFFICIAL</Text>
              </View> */}
            </View>
          )}
        </View>

        {/* 2. Navigation Section Title */}
        {!isCollapsed && (
          <Text style={styles.sidebarSectionTitle}>NAVIGATION</Text>
        )}

        {/* 3. Navigation Items List (Fixed non-scrolling) */}
        <View style={styles.sidebarNavList}>
          {navItems.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.sidebarNavItem,
                  isActive && styles.sidebarNavItemActive,
                  isCollapsed && styles.sidebarNavItemCollapsed
                ]}
                onPress={() => {
                  onSelectTab(item.key);
                  if (!isDesktop && onCloseMobile) {
                    onCloseMobile();
                  }
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                {...(Platform.OS === 'web' && !isActive
                  ? ({ className: 'player-sidebar-nav-item' } as any)
                  : {})}
              >
                <View style={styles.sidebarNavLeftGroup}>
                  <View style={[styles.sidebarIconBox, isCollapsed && { marginRight: 0 }]}>
                    {item.icon(isActive ? '#ffffff' : '#475569')}
                  </View>
                  {!isCollapsed && (
                    <Text style={[styles.sidebarNavLabel, isActive && styles.sidebarNavLabelActive]}>
                      {item.label}
                    </Text>
                  )}
                </View>

                {!isCollapsed && item.badge !== undefined && (
                  <View
                    style={[
                      styles.tabBadgeBase,
                      item.badgeType === 'blue' && styles.tabBadgeBlue,
                      item.badgeType === 'orange' && styles.tabBadgeOrange,
                      item.badgeType === 'gold' && styles.tabBadgeGold,
                      isActive && styles.tabBadgeActive
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabBadgeTextBase,
                        item.badgeType === 'blue' && styles.tabBadgeBlueText,
                        item.badgeType === 'orange' && styles.tabBadgeOrangeText,
                        item.badgeType === 'gold' && styles.tabBadgeGoldText,
                        isActive && styles.tabBadgeActiveText
                      ]}
                    >
                      {item.badge}
                    </Text>
                  </View>
                )}

                {isCollapsed && item.badge !== undefined && item.badge > 0 && (
                  <View style={styles.collapsedBadgeDot} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 4. Sidebar Footer with Logout & Collapse Toggle */}
      <View style={[styles.sidebarFooter, isCollapsed && styles.sidebarFooterCollapsed]}>
        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.sidebarLogoutBtn, isCollapsed && styles.sidebarLogoutBtnCollapsed]}
          onPress={() => {
            if (!isDesktop && onCloseMobile) onCloseMobile();
            if (onLogout) onLogout();
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Logout"
        >
          <LogoutIcon size={16} color="#ef4444" style={!isCollapsed ? { marginRight: 8 } : undefined} />
          {!isCollapsed && (
            <Text style={styles.sidebarLogoutBtnText}>Logout</Text>
          )}
        </TouchableOpacity>

        {/* Collapse / Expand Toggle Button for Desktop */}
        {isDesktop && onToggleCollapse && (
          <TouchableOpacity
            style={styles.sidebarCollapseToggleBtn}
            onPress={onToggleCollapse}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {isCollapsed ? (
                <ChevronRightIcon size={14} color="#94a3b8" />
              ) : (
                <>
                  <ChevronLeftIcon size={14} color="#94a3b8" />
                  <Text style={styles.sidebarCollapseToggleText}>Collapse Sidebar</Text>
                </>
              )}
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // Mobile Drawer Overlay
  if (!isDesktop) {
    if (!isMobileOpen) return null;

    return (
      <View style={styles.mobileDrawerOverlay}>
        <TouchableOpacity
          style={styles.mobileDrawerBackdrop}
          activeOpacity={1}
          onPress={onCloseMobile}
        />
        <View style={styles.mobileDrawerContainer}>
          <View style={styles.mobileDrawerHeader}>
            <Text style={styles.mobileDrawerHeaderTitle}>Player Portal Menu</Text>
            <TouchableOpacity
              onPress={onCloseMobile}
              style={styles.mobileDrawerCloseBtn}
              accessibilityLabel="Close Menu"
            >
              <CloseIcon size={18} color="#e2e8f0" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, minHeight: 0 }}>
            {sidebarContent}
          </View>
        </View>
      </View>
    );
  }

  // Desktop Left Sidebar
  return sidebarContent;
};

const styles = StyleSheet.create({
  // 1. SIDEBAR CONTAINER — WHITE background, golden accents
  sidebarContainer: {
    width: 250,
    alignSelf: 'stretch',
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    flexDirection: 'column',
    justifyContent: 'space-between',
    zIndex: 40,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.08,
    elevation: 4,
    flexShrink: 0,
    minHeight: 0,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { height: '100%' as any, overflowY: 'hidden' as any } : {})
  },
  sidebarTopSection: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    overflow: 'hidden'
  },
  sidebarCollapsed: {
    width: 76
  },
  // Player profile card — light cream/gold tint
  sidebarPlayerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fffbeb',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.35)',
    gap: 12,
    flexShrink: 0
  },
  sidebarPlayerCardCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 14
  },
  playerAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 6, // Square shape with clean crisp borders
    backgroundColor: '#071026',
    borderWidth: 2,
    borderColor: '#d4af37',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    elevation: 2
  },
  playerAvatarText: {
    color: '#f59e0b',
    fontSize: 18,
    fontWeight: '900'
  },
  sidebarPlayerInfo: {
    flex: 1
  },
  sidebarPlayerName: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3
  },
  sidebarPlayerRole: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1
  },
  playerDistrictBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.5)'
  },
  playerDistrictBadgeText: {
    color: '#92400e',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  sidebarSectionTitle: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6
  },
  sidebarNavList: {
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  // Inactive nav item — white bg, subtle border
  sidebarNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 3,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})
  },
  // Active nav item — solid gold background
  sidebarNavItemActive: {
    backgroundColor: '#d4af37',
    borderColor: '#b8960c',
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    elevation: 4
  },
  sidebarNavItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
    paddingVertical: 12
  },
  sidebarNavLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  sidebarIconBox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  // Inactive label — dark slate
  sidebarNavLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155'
  },
  // Active label — white on gold
  sidebarNavLabelActive: {
    color: '#ffffff',
    fontWeight: '900'
  },
  tabBadgeBase: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6
  },
  tabBadgeTextBase: {
    fontSize: 10.5,
    fontWeight: '800'
  },
  tabBadgeBlue: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: '#3b82f6'
  },
  tabBadgeBlueText: {
    color: '#1d4ed8'
  },
  tabBadgeOrange: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    borderWidth: 1,
    borderColor: '#f97316'
  },
  tabBadgeOrangeText: {
    color: '#c2410c'
  },
  tabBadgeGold: {
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
    borderWidth: 1,
    borderColor: '#d4af37'
  },
  tabBadgeGoldText: {
    color: '#92400e'
  },
  // Badge on active (gold bg) item
  tabBadgeActive: {
    backgroundColor: 'rgba(7, 16, 38, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(7,16,38,0.3)'
  },
  tabBadgeActiveText: {
    color: '#ffffff'
  },
  collapsedBadgeDot: {
    position: 'absolute',
    top: 6,
    right: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d4af37'
  },

  // Sidebar Footer — very light grey
  sidebarFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    padding: 12,
    backgroundColor: '#f8fafc',
    gap: 8,
    flexShrink: 0
  },
  sidebarFooterCollapsed: {
    paddingHorizontal: 8,
    alignItems: 'center'
  },
  sidebarLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#fff5f5'
  },
  sidebarLogoutBtnCollapsed: {
    paddingHorizontal: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignSelf: 'center'
  },
  sidebarLogoutBtnText: {
    color: '#dc2626',
    fontSize: 12.5,
    fontWeight: '800'
  },
  sidebarCollapseToggleBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  sidebarCollapseToggleText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700'
  },

  // Mobile Drawer Specific Styles
  mobileDrawerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    flexDirection: 'row'
  },
  mobileDrawerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(7, 16, 38, 0.65)'
  },
  mobileDrawerContainer: {
    width: 270,
    maxWidth: '85%',
    height: '100%',
    backgroundColor: '#071026',
    flexDirection: 'column',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.2,
    elevation: 10,
    minHeight: 0,
    overflow: 'hidden'
  },
  mobileDrawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#071026',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.3)',
    flexShrink: 0
  },
  mobileDrawerHeaderTitle: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  mobileDrawerCloseBtn: {
    padding: 6
  }
});

export default PlayerSidebar;