/**
 * src/admin/components/AdminSidebar.tsx
 * Left Sidebar Navigation for Cricket Association Professional Admin Panel.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import {
  DashboardIcon,
  UsersIcon,
  PlayersIcon,
  TeamsIcon,
  TournamentsIcon,
  MatchesIcon,
  ApprovalsIcon,
  LiveScoringIcon,
  StatisticsIcon,
  NotificationsIcon,
  ContentIcon,
  SettingsIcon,
  LogoutIcon,
  ExternalLinkIcon,
  CloseIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LawsIcon,
  CalculatorIcon
} from './Icons';
import { useAdminAuth } from '../context/AdminAuthContext';

export type AdminRouteKey =
  | 'dashboard'
  | 'users'
  | 'players'
  | 'teams'
  | 'tournaments'
  | 'matches'
  | 'approvals'
  | 'live-scoring'
  | 'statistics'
  | 'notifications'
  | 'content'
  | 'laws'
  | 'calculations'
  | 'settings';

interface NavItem {
  key: AdminRouteKey;
  label: string;
  icon: (color: string) => React.ReactNode;
  badge?: number | string;
  isLive?: boolean;
}

interface Props {
  currentRoute: AdminRouteKey;
  onNavigate: (route: AdminRouteKey) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onExitToPublic: () => void;
  pendingApprovalsCount?: number;
  liveMatchesCount?: number;
}

export const AdminSidebar: React.FC<Props> = ({
  currentRoute,
  onNavigate,
  collapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  onExitToPublic,
  pendingApprovalsCount = 0,
  liveMatchesCount = 0
}) => {
  const { adminUser, logout } = useAdminAuth();

  const navItems: NavItem[] = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      icon: c => <DashboardIcon size={18} color={c} />
    },
    {
      key: 'users',
      label: 'Users',
      icon: c => <UsersIcon size={18} color={c} />
    },
    {
      key: 'players',
      label: 'Players',
      icon: c => <PlayersIcon size={18} color={c} />
    },
    {
      key: 'teams',
      label: 'Teams / Clubs',
      icon: c => <TeamsIcon size={18} color={c} />
    },
    {
      key: 'tournaments',
      label: 'Tournaments',
      icon: c => <TournamentsIcon size={18} color={c} />
    },
    {
      key: 'matches',
      label: 'Matches',
      icon: c => <MatchesIcon size={18} color={c} />
    },
    {
      key: 'approvals',
      label: 'Approvals',
      icon: c => <ApprovalsIcon size={18} color={c} />,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined
    },
    {
      key: 'live-scoring',
      label: 'Live Scoring',
      icon: c => <LiveScoringIcon size={18} color={c} />,
      isLive: liveMatchesCount > 0
    },
    {
      key: 'statistics',
      label: 'Statistics',
      icon: c => <StatisticsIcon size={18} color={c} />
    },
    {
      key: 'notifications',
      label: 'Notifications',
      icon: c => <NotificationsIcon size={18} color={c} />
    },
    {
      key: 'content',
      label: 'Content Management',
      icon: c => <ContentIcon size={18} color={c} />
    },
    {
      key: 'laws',
      label: 'Cricket Laws (42)',
      icon: c => <LawsIcon size={18} color={c} />,
      badge: 42
    },
    {
      key: 'calculations',
      label: 'DLS & VJD Predictor',
      icon: c => <CalculatorIcon size={18} color={c} />,
      badge: 'Live'
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: c => <SettingsIcon size={18} color={c} />
    }
  ];

  const sidebarContent = (
    <View style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}>
      {/* Brand Header */}
      <View style={styles.brandHeader}>
        <View style={styles.brandRow}>
          <View style={styles.brandLogo}>
            <Text style={styles.brandLogoText}>🏏</Text>
          </View>
          {!collapsed && (
            <View style={styles.brandInfo}>
              <Text style={styles.brandTitle} numberOfLines={1}>
                CRICKET FEDERATION
              </Text>
              <Text style={styles.brandSub}>Virudhunagar District</Text>
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>ADMIN PANEL</Text>
              </View>
            </View>
          )}
        </View>

        {/* Mobile Close Button */}
        {isMobileOpen && (
          <TouchableOpacity onPress={onCloseMobile} style={styles.mobileCloseBtn}>
            <CloseIcon size={20} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Navigation Links List */}
      <ScrollView
        style={styles.navScrollView}
        contentContainerStyle={styles.navContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionLabel, collapsed && styles.sectionLabelCollapsed]}>
          {collapsed ? 'MENU' : 'MANAGEMENT'}
        </Text>

        {navItems.map(item => {
          const isActive = currentRoute === item.key;
          const activeColor = '#0f2452';
          const iconColor = isActive ? '#0f2452' : '#64748b';

          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.navItem,
                isActive && styles.navItemActive,
                collapsed && styles.navItemCollapsed
              ]}
              onPress={() => {
                onNavigate(item.key);
                if (isMobileOpen) onCloseMobile();
              }}
              activeOpacity={0.7}
              accessibilityLabel={collapsed ? item.label : undefined}
            >
              <View style={[styles.iconBox, isActive && styles.iconBoxActive]}>
                {item.icon(iconColor)}
              </View>

              {!collapsed && (
                <Text style={[styles.navLabel, isActive && styles.navLabelActive]} numberOfLines={1}>
                  {item.label}
                </Text>
              )}

              {!collapsed && item.badge !== undefined && (
                <View style={styles.itemBadge}>
                  <Text style={styles.itemBadgeText}>{item.badge}</Text>
                </View>
              )}

              {!collapsed && item.isLive && (
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Public Website Link */}
        <TouchableOpacity
          style={[styles.publicSiteLink, collapsed && styles.publicSiteLinkCollapsed]}
          onPress={onExitToPublic}
          activeOpacity={0.7}
        >
          <ExternalLinkIcon size={16} color="#d4af37" />
          {!collapsed && <Text style={styles.publicSiteText}>View Public Website</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* Footer Profile & Logout */}
      <View style={styles.sidebarFooter}>
        <View style={styles.adminUserCard}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {(adminUser?.name || 'A')[0].toUpperCase()}
            </Text>
          </View>
          {!collapsed && (
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {adminUser?.name || 'Administrator'}
              </Text>
              <Text style={styles.userEmail} numberOfLines={1}>
                {adminUser?.email || 'admin@cfvd.org'}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.logoutBtn, collapsed && styles.logoutBtnCollapsed]}
          onPress={() => {
            if (confirm('Are you sure you want to sign out of the Admin Console?')) {
              logout();
            }
          }}
          activeOpacity={0.8}
          accessibilityLabel={collapsed ? 'Sign Out' : undefined}
        >
          <LogoutIcon size={16} color="#ef4444" />
          {!collapsed && <Text style={styles.logoutText}>Sign Out</Text>}
        </TouchableOpacity>

        {/* Desktop Collapse Toggle */}
        {Platform.OS === 'web' && !isMobileOpen && (
          <TouchableOpacity
            style={styles.collapseToggle}
            onPress={onToggleCollapse}
            activeOpacity={0.7}
            accessibilityLabel={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? (
              <ChevronRightIcon size={16} color="#64748b" />
            ) : (
              <View style={styles.collapseToggleRow}>
                <ChevronLeftIcon size={16} color="#64748b" />
                <Text style={styles.collapseToggleText}>Collapse Menu</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // Mobile Drawer Overlay
  if (isMobileOpen) {
    return (
      <View style={styles.mobileOverlay}>
        <TouchableOpacity
          style={styles.mobileBackdrop}
          activeOpacity={1}
          onPress={onCloseMobile}
        />
        <View style={styles.mobileDrawerContainer}>{sidebarContent}</View>
      </View>
    );
  }

  return sidebarContent;
};

const styles = StyleSheet.create({
  sidebar: {
    width: 260,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    flexDirection: 'column',
    height: '100%',
    zIndex: 40
  },
  sidebarCollapsed: {
    width: 72
  },
  brandHeader: {
    height: 72,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  brandLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#0f2452',
    justifyContent: 'center',
    alignItems: 'center'
  },
  brandLogoText: {
    fontSize: 20
  },
  brandInfo: {
    justifyContent: 'center'
  },
  brandTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f2452',
    letterSpacing: 0.5
  },
  brandSub: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600'
  },
  adminBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginTop: 2,
    alignSelf: 'flex-start'
  },
  adminBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#b8860b',
    letterSpacing: 0.5
  },
  mobileCloseBtn: {
    padding: 6
  },
  navScrollView: {
    flex: 1
  },
  navContent: {
    paddingVertical: 12,
    paddingHorizontal: 10
  },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 1,
    paddingHorizontal: 12,
    marginBottom: 8,
    marginTop: 4
  },
  sectionLabelCollapsed: {
    textAlign: 'center',
    fontSize: 9,
    paddingHorizontal: 0
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 3
  },
  navItemActive: {
    backgroundColor: '#f1f5f9'
  },
  navItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0
  },
  iconBox: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  iconBoxActive: {},
  navLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    flex: 1
  },
  navLabelActive: {
    color: '#0f2452',
    fontWeight: '800'
  },
  itemBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1
  },
  itemBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800'
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    gap: 4
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#e11d48'
  },
  liveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#e11d48'
  },
  publicSiteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#fdfbf7',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    gap: 10
  },
  publicSiteLinkCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0
  },
  publicSiteText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b8860b'
  },
  sidebarFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    padding: 12,
    backgroundColor: '#fafbfc'
  },
  adminUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0f2452',
    justifyContent: 'center',
    alignItems: 'center'
  },
  userAvatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  },
  userInfo: {
    flex: 1
  },
  userName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1e293b'
  },
  userEmail: {
    fontSize: 11,
    color: '#64748b'
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#fff1f2',
    gap: 8,
    marginBottom: 6
  },
  logoutBtnCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ef4444'
  },
  collapseToggle: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center'
  },
  collapseToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  collapseToggleText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600'
  },
  mobileOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    flexDirection: 'row'
  },
  mobileBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)'
  },
  mobileDrawerContainer: {
    width: 270,
    height: '100%',
    zIndex: 101
  }
});

export default AdminSidebar;
