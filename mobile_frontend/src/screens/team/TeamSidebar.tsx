/**
 * src/screens/team/TeamSidebar.tsx
 *
 * Dedicated Sidebar Navigation component for the Coach & Team Portal.
 * Following the reference layout of PlayerSidebar and AdminDashboard:
 * - Desktop collapsible sidebar — WHITE background, golden active/hover accents, dark slate typography
 * - Mobile drawer overlay with dark backdrop, header, and close action
 * - Team crest & coach profile header (crest/initials, team name, coach name, Tier 1 official badge)
 * - Navigation links matching explicit dashboard specification:
 *   Dashboard, Team, Players, Tournaments, Schedule, Matches, Score, Notifications, Profile
 * - Vector SVG icons & live badges (Squad count, Upcoming fixtures, Tournaments, Unread notices)
 * - Logout button with red accent & confirmation trigger
 * - Desktop sidebar collapse/expand toggle
 */

import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  Platform
} from 'react-native';
import {
  DashboardIcon,
  UsersIcon,
  PlayersIcon,
  TournamentsIcon,
  MatchesIcon,
  CricketBatIcon,
  StatisticsIcon,
  BellIcon,
  LogoutIcon,
  CloseIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ShieldIcon,
  SettingsIcon,
  LiveScoringIcon
} from '../../admin/components/Icons';

export type TeamTabType =
  | 'overview'
  | 'team'
  | 'squad'
  | 'tournaments'
  | 'schedule'
  | 'matches'
  | 'scorecard'
  | 'statistics'
  | 'notifications'
  | 'profile';

export type TabType = TeamTabType;

export interface TeamNavItem {
  key: TeamTabType;
  label: string;
  icon: (color: string) => React.ReactNode;
  badge?: number;
  badgeType?: 'blue' | 'orange' | 'gold' | 'emerald';
}

export interface TeamSidebarProps {
  activeTab: TeamTabType;
  onSelectTab: (tab: TeamTabType) => void;
  teamName?: string;
  coachName?: string;
  teamId?: string;
  taluk?: string;
  squadCount?: number;
  matchesCount?: number;
  upcomingCount?: number;
  registrationsCount?: number;
  notificationsCount?: number;
  isDesktop?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onLogout?: () => void;
}

export const getTeamNavItems = (badges?: {
  squadCount?: number;
  matchesCount?: number;
  upcomingCount?: number;
  registrationsCount?: number;
  notificationsCount?: number;
}): TeamNavItem[] => [
  {
    key: 'overview',
    label: 'Dashboard',
    icon: (c) => <DashboardIcon size={18} color={c} />
  },
  {
    key: 'team',
    label: 'Team',
    icon: (c) => <UsersIcon size={18} color={c} />
  },
  {
    key: 'squad',
    label: 'Players',
    icon: (c) => <PlayersIcon size={18} color={c} />,
    badge: badges?.squadCount,
    badgeType: 'blue'
  },
  {
    key: 'tournaments',
    label: 'Tournaments',
    icon: (c) => <TournamentsIcon size={18} color={c} />,
    badge: badges?.registrationsCount,
    badgeType: 'gold'
  },
  {
    key: 'schedule',
    label: 'Schedule',
    icon: (c) => <CricketBatIcon size={18} color={c} />,
    badge: badges?.upcomingCount,
    badgeType: 'orange'
  },
  {
    key: 'matches',
    label: 'Matches',
    icon: (c) => <MatchesIcon size={18} color={c} />,
    badge: badges?.matchesCount,
    badgeType: 'orange'
  },
  {
    key: 'scorecard',
    label: 'Score',
    icon: (c) => <LiveScoringIcon size={18} color={c} />
  },
  {
    key: 'statistics',
    label: 'Statistics',
    icon: (c) => <StatisticsIcon size={18} color={c} />
  },
  {
    key: 'notifications',
    label: 'Notifications',
    icon: (c) => <BellIcon size={18} color={c} />,
    badge: badges?.notificationsCount,
    badgeType: 'gold'
  },
  {
    key: 'profile',
    label: 'Profile',
    icon: (c) => <SettingsIcon size={18} color={c} />
  }
];

export const TeamSidebar: React.FC<TeamSidebarProps> = ({
  activeTab,
  onSelectTab,
  teamName = 'Official Club CC',
  coachName = 'Head Coach',
  teamId = 'TM-101',
  taluk = 'Virudhunagar',
  squadCount = 15,
  matchesCount = 0,
  upcomingCount = 0,
  registrationsCount = 0,
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
    const styleId = 'team-sidebar-hover-css';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .team-sidebar-nav-item:hover {
        background-color: rgba(212, 175, 55, 0.12) !important;
        border-color: rgba(212, 175, 55, 0.45) !important;
        transition: background-color 0.18s ease, border-color 0.18s ease;
      }
      .team-sidebar-nav-item {
        transition: background-color 0.18s ease, border-color 0.18s ease;
      }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  // Build nav items with dynamic badges
  const navItems = getTeamNavItems({
    squadCount: squadCount || 15,
    matchesCount,
    upcomingCount,
    registrationsCount,
    notificationsCount
  });

  const sidebarContent = (
    <View style={[styles.sidebarContainer, isCollapsed && styles.sidebarCollapsed]}>
      {/* 1. Team Profile Header Card */}
      <View style={[styles.sidebarTeamCard, isCollapsed && styles.sidebarTeamCardCollapsed]}>
        <View style={styles.teamAvatarCircle}>
          <Text style={styles.teamAvatarText}>
            {teamName ? teamName.charAt(0).toUpperCase() : 'T'}
          </Text>
        </View>
        {!isCollapsed && (
          <View style={styles.sidebarTeamInfo}>
            <Text style={styles.sidebarTeamName} numberOfLines={1}>
              {teamName}
            </Text>
            <Text style={styles.sidebarCoachName} numberOfLines={1}>
              Coach: {coachName}
            </Text>
            <View style={styles.teamOfficialBadge}>
              <Text style={styles.teamOfficialBadgeText}>
                OFFICIAL CLUB #{teamId || '101'}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* 2. Navigation Section Title */}
      {!isCollapsed && (
        <Text style={styles.sidebarSectionTitle}>NAVIGATION</Text>
      )}

      {/* 3. Navigation Items Scrollable List */}
      <ScrollView
        style={styles.sidebarNavScroll}
        contentContainerStyle={styles.sidebarNavList}
        showsVerticalScrollIndicator={false}
      >
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
                ? ({ className: 'team-sidebar-nav-item' } as any)
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

              {!isCollapsed && item.badge !== undefined && item.badge > 0 && (
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
      </ScrollView>

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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ShieldIcon size={20} color="#f59e0b" />
              <Text style={styles.mobileDrawerHeaderTitle}>Coach Portal Menu</Text>
            </View>
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
  // 1. SIDEBAR CONTAINER — WHITE background, golden accents (Reference: PlayerSidebar)
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
    ...(Platform.OS === 'web' ? ({ height: '100%', overflowY: 'hidden' } as any) : {})
  },
  sidebarCollapsed: {
    width: 76
  },

  // Team profile header card — light cream/gold tint
  sidebarTeamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fffbeb',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.35)',
    gap: 12,
    flexShrink: 0
  },
  sidebarTeamCardCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 14
  },
  teamAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 8,
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
  teamAvatarText: {
    color: '#f59e0b',
    fontSize: 18,
    fontWeight: '900'
  },
  sidebarTeamInfo: {
    flex: 1,
    minWidth: 0
  },
  sidebarTeamName: {
    color: '#0f172a',
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.3
  },
  sidebarCoachName: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1
  },
  teamOfficialBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.5)'
  },
  teamOfficialBadgeText: {
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
    paddingTop: 14,
    paddingBottom: 6
  },

  sidebarNavScroll: {
    flex: 1,
    minHeight: 0
  },
  sidebarNavList: {
    paddingHorizontal: 10,
    paddingVertical: 4
  },

  // Inactive nav item
  sidebarNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9.5,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 2.5,
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
  sidebarNavLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155'
  },
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

  // Sidebar Footer
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
    backgroundColor: '#fff5f5',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})
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
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})
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

export default TeamSidebar;
