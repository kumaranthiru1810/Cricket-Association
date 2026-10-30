/**
 * src/admin/components/AdminTopbar.tsx
 * Top Navigation Bar for Cricket Association Professional Admin Panel.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, Platform } from 'react-native';
import { MenuIcon, SearchIcon, BellIcon, ChevronDownIcon, LogoutIcon, SettingsIcon, UsersIcon, ExternalLinkIcon } from './Icons';
import { useAdminAuth } from '../context/AdminAuthContext';
import { AdminRouteKey } from './AdminSidebar';

interface Props {
  currentRoute: AdminRouteKey;
  onNavigate: (route: AdminRouteKey) => void;
  onToggleSidebar: () => void;
  onExitToPublic: () => void;
  onSearchGlobal?: (query: string) => void;
  notificationsCount?: number;
}

export const AdminTopbar: React.FC<Props> = ({
  currentRoute,
  onNavigate,
  onToggleSidebar,
  onExitToPublic,
  onSearchGlobal,
  notificationsCount = 3
}) => {
  const { adminUser, logout } = useAdminAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');

  const routeTitleMap: Record<AdminRouteKey, string> = {
    dashboard: 'Association Overview & Dashboard',
    users: 'System Users Management',
    players: 'Cricket Players Directory',
    teams: 'Affiliated Teams & Clubs',
    tournaments: 'Tournaments & Leagues',
    matches: 'Match Schedule & Scorecards',
    approvals: 'Approvals & Verification Queue',
    'live-scoring': 'Live Match Scoring Monitor',
    statistics: 'Federation Analytics & Statistics',
    notifications: 'Notifications & Announcements',
    content: 'Website Content Management',
    settings: 'Association Settings & Preferences'
  };

  const sampleNotifications = [
    { id: '1', title: 'New Scorer Registration', sub: 'K. Murugan submitted accreditation credentials.', time: '10m ago' },
    { id: '2', title: 'Team Approval Pending', sub: 'Sattur Spartans completed squad roster.', time: '1h ago' },
    { id: '3', title: 'Match Scheduled', sub: 'VPL 2026 Match #2 scheduled at Kamarajar Stadium.', time: '3h ago' }
  ];

  return (
    <View style={styles.topbar}>
      {/* Left Area: Toggle & Title */}
      <View style={styles.leftArea}>
        <TouchableOpacity
          style={styles.menuToggleBtn}
          onPress={onToggleSidebar}
          activeOpacity={0.7}
          accessibilityLabel="Toggle Navigation"
        >
          <MenuIcon size={20} color="#334155" />
        </TouchableOpacity>

        <View style={styles.titleWrapper}>
          <Text style={styles.pageTitle}>{routeTitleMap[currentRoute] || 'Admin Panel'}</Text>
          <Text style={styles.pageBreadcrumb}>Cricket Association &gt; {currentRoute.toUpperCase()}</Text>
        </View>
      </View>

      {/* Right Area: Search, Public Site, Notifications, Profile */}
      <View style={styles.rightArea}>
        {/* Quick Search */}
        <View style={styles.searchBox}>
          <SearchIcon size={15} color="#94a3b8" style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Quick search..."
            placeholderTextColor="#94a3b8"
            value={searchVal}
            onChangeText={t => {
              setSearchVal(t);
              if (onSearchGlobal) onSearchGlobal(t);
            }}
          />
        </View>

        {/* Public Website Button */}
        <TouchableOpacity
          style={styles.publicBtn}
          onPress={onExitToPublic}
          activeOpacity={0.75}
          accessibilityLabel="View Public Cricket Website"
        >
          <ExternalLinkIcon size={14} color="#b8860b" />
          <Text style={styles.publicBtnText}>Public Site</Text>
        </TouchableOpacity>

        {/* Notifications Icon with Popover */}
        <View style={{ position: 'relative' }}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setNotifOpen(!notifOpen)}
            activeOpacity={0.7}
            accessibilityLabel="Notifications"
          >
            <BellIcon size={18} color="#475569" />
            {notificationsCount > 0 && (
              <View style={styles.badgePulse}>
                <Text style={styles.badgePulseText}>{notificationsCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {notifOpen && (
            <View style={styles.notifDropdown}>
              <View style={styles.dropdownHeader}>
                <Text style={styles.dropdownTitle}>Notifications</Text>
                <TouchableOpacity onPress={() => { setNotifOpen(false); onNavigate('notifications'); }}>
                  <Text style={styles.dropdownAction}>View All</Text>
                </TouchableOpacity>
              </View>
              {sampleNotifications.map(n => (
                <TouchableOpacity
                  key={n.id}
                  style={styles.notifItem}
                  onPress={() => { setNotifOpen(false); onNavigate('notifications'); }}
                >
                  <Text style={styles.notifItemTitle}>{n.title}</Text>
                  <Text style={styles.notifItemSub}>{n.sub}</Text>
                  <Text style={styles.notifItemTime}>{n.time}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Admin Profile Dropdown */}
        <View style={{ position: 'relative' }}>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => setProfileOpen(!profileOpen)}
            activeOpacity={0.75}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(adminUser?.name || 'A')[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileMeta}>
              <Text style={styles.profileName} numberOfLines={1}>
                {adminUser?.name || 'Admin'}
              </Text>
              <Text style={styles.profileRole}>Administrator</Text>
            </View>
            <ChevronDownIcon size={14} color="#64748b" />
          </TouchableOpacity>

          {profileOpen && (
            <View style={styles.profileDropdown}>
              <View style={styles.dropdownUserBanner}>
                <Text style={styles.dropdownUserName}>{adminUser?.name || 'System Administrator'}</Text>
                <Text style={styles.dropdownUserEmail}>{adminUser?.email || 'admin@cfvd.org'}</Text>
              </View>

              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  setProfileOpen(false);
                  onNavigate('users');
                }}
              >
                <UsersIcon size={16} color="#475569" />
                <Text style={styles.dropdownItemText}>Manage Users</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  setProfileOpen(false);
                  onNavigate('settings');
                }}
              >
                <SettingsIcon size={16} color="#475569" />
                <Text style={styles.dropdownItemText}>Association Settings</Text>
              </TouchableOpacity>

              <View style={styles.dropdownDivider} />

              <TouchableOpacity
                style={[styles.dropdownItem, { paddingVertical: 10 }]}
                onPress={() => {
                  setProfileOpen(false);
                  if (confirm('Sign out of the administrator panel?')) {
                    logout();
                  }
                }}
              >
                <LogoutIcon size={16} color="#ef4444" />
                <Text style={[styles.dropdownItemText, { color: '#ef4444', fontWeight: '700' }]}>
                  Sign Out
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  topbar: {
    height: 64,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 30
  },
  leftArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1
  },
  menuToggleBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  titleWrapper: {
    justifyContent: 'center'
  },
  pageTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a'
  },
  pageBreadcrumb: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600'
  },
  rightArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
    width: 180
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: '#0f172a',
    padding: 0
  },
  publicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fdfbf7',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
    justifyContent: 'center'
  },
  publicBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b8860b'
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },
  badgePulse: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    width: 17,
    height: 17,
    borderRadius: 8.5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff'
  },
  badgePulseText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '800'
  },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc'
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0f2452',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800'
  },
  profileMeta: {
    justifyContent: 'center'
  },
  profileName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
    maxWidth: 90
  },
  profileRole: {
    fontSize: 10,
    color: '#64748b'
  },
  profileDropdown: {
    position: 'absolute',
    top: 46,
    right: 0,
    width: 210,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 8,
    zIndex: 50,
    overflow: 'hidden'
  },
  dropdownUserBanner: {
    padding: 12,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  dropdownUserName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a'
  },
  dropdownUserEmail: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 12
  },
  dropdownItemText: {
    fontSize: 12.5,
    color: '#334155',
    fontWeight: '600'
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#f1f5f9'
  },
  notifDropdown: {
    position: 'absolute',
    top: 46,
    right: -20,
    width: 290,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 8,
    zIndex: 50,
    overflow: 'hidden'
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#f8fafc'
  },
  dropdownTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a'
  },
  dropdownAction: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0f2452'
  },
  notifItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc'
  },
  notifItemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b'
  },
  notifItemSub: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 15
  },
  notifItemTime: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4
  }
});

export default AdminTopbar;
