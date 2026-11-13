/**
 * src/admin/pages/DashboardPage.tsx
 * Professional Cricket Association Admin Dashboard with Real Database Feeds.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import {
  UsersIcon,
  PlayersIcon,
  TeamsIcon,
  TournamentsIcon,
  MatchesIcon,
  ApprovalsIcon,
  RefreshIcon,
  CheckIcon,
  CloseIcon,
  EyeIcon
} from '../components/Icons';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import { CardGridSkeleton, TableSkeleton } from '../components/LoadingSkeleton';
import { adminApi } from '../services/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useAdminLayout } from '../components/AdminLayout';
import { AdminRouteKey } from '../components/AdminSidebar';

interface Props {
  onNavigate: (route: AdminRouteKey) => void;
}

export const DashboardPage: React.FC<Props> = ({ onNavigate }) => {
  const { adminUser } = useAdminAuth();
  const { showToast, setPendingApprovalsCount, setLiveMatchesCount } = useAdminLayout();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({
    totalUsers: 7,
    totalPlayers: 26,
    totalTeams: 5,
    activeTournaments: 1,
    upcomingMatches: 1,
    liveMatches: 1,
    pendingApprovals: 2
  });

  const [recentRegistrations, setRecentRegistrations] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  // Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'scorer' | 'team' | 'player';
    id: string;
    action: 'approve' | 'reject';
    requireReason: boolean;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'scorer',
    id: '',
    action: 'approve',
    requireReason: false
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getDashboardStats();
      if (res && res.success) {
        if (res.stats) {
          setStats(res.stats);
          if (res.stats.pendingApprovals !== undefined) setPendingApprovalsCount(res.stats.pendingApprovals);
          if (res.stats.liveMatches !== undefined) setLiveMatchesCount(res.stats.liveMatches);
        }
        if (res.recentRegistrations) setRecentRegistrations(res.recentRegistrations);
        if (res.pendingApprovals) setPendingApprovals(res.pendingApprovals);
        if (res.upcomingMatches) setUpcomingMatches(res.upcomingMatches);
        if (res.recentActivities) setRecentActivities(res.recentActivities);
      }
    } catch (e: any) {
      console.warn('Dashboard load warning:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleActionClick = (item: any, action: 'approve' | 'reject') => {
    const isApprove = action === 'approve';
    setConfirmDialog({
      visible: true,
      title: `${isApprove ? 'Approve' : 'Reject'} ${item.type || 'Request'}`,
      message: `Are you sure you want to ${isApprove ? 'approve' : 'reject'} application from "${item.name}"?`,
      type: (item.type || '').toLowerCase().includes('scorer') ? 'scorer' : 'team',
      id: item.id,
      action,
      requireReason: !isApprove
    });
  };

  const handleExecuteApproval = async (reason?: string) => {
    const { type, id, action } = confirmDialog;
    setConfirmDialog(prev => ({ ...prev, visible: false }));

    try {
      await adminApi.handleApproval(type, id, action, reason);
      showToast(`Successfully ${action === 'approve' ? 'approved' : 'rejected'} ${type}.`, 'success');
      loadData();
    } catch (err: any) {
      showToast(`Action failed: ${err.message}`, 'error');
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <View style={styles.container}>
      {/* Top Banner Greeting */}
      <View style={[styles.greetingBanner, isMobile && { padding: 14, gap: 12 }]}>
        <View style={[styles.greetingTextCol, isMobile && { minWidth: '100%' }]}>
          <Text style={[styles.greetingTitle, isMobile && { fontSize: 18 }]}>
            {getGreeting()}, {adminUser?.name || 'Administrator'}
          </Text>
          <Text style={styles.greetingSub}>
            Here's what's happening with the Cricket Association of Virudhunagar District today.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.refreshBtn, isMobile && { width: '100%', justifyContent: 'center' }]}
          onPress={loadData}
          activeOpacity={0.7}
          disabled={loading}
        >
          <RefreshIcon size={14} color="#0f2452" />
          <Text style={styles.refreshBtnText}>Refresh Real Data</Text>
        </TouchableOpacity>
      </View>

      {/* 6 Statistics Cards (Step 6) */}
      {loading ? (
        <CardGridSkeleton count={6} />
      ) : (
        <View style={styles.statsGrid}>
          <StatCard
            title="Total Users"
            value={stats.totalUsers || 0}
            icon={<UsersIcon size={20} color="#0f2452" />}
            subtitle="Registered portal accounts"
            accentColor="#0f2452"
            onPress={() => onNavigate('users')}
          />
          <StatCard
            title="Total Players"
            value={stats.totalPlayers || 0}
            icon={<PlayersIcon size={20} color="#059669" />}
            subtitle="Verified squad & district players"
            accentColor="#059669"
            onPress={() => onNavigate('players')}
          />
          <StatCard
            title="Teams / Clubs"
            value={stats.totalTeams || 0}
            icon={<TeamsIcon size={20} color="#2563eb" />}
            subtitle="Affiliated cricket clubs"
            accentColor="#2563eb"
            onPress={() => onNavigate('teams')}
          />
          <StatCard
            title="Active Tournaments"
            value={stats.activeTournaments || 0}
            icon={<TournamentsIcon size={20} color="#d97706" />}
            subtitle="Official season leagues"
            accentColor="#d97706"
            onPress={() => onNavigate('tournaments')}
          />
          <StatCard
            title="Upcoming Matches"
            value={stats.upcomingMatches || 0}
            icon={<MatchesIcon size={20} color="#7c3aed" />}
            subtitle={stats.liveMatches > 0 ? `${stats.liveMatches} Match Currently Live` : 'Scheduled fixtures'}
            accentColor="#7c3aed"
            onPress={() => onNavigate('matches')}
          />
          <StatCard
            title="Pending Approvals"
            value={stats.pendingApprovals || 0}
            icon={<ApprovalsIcon size={20} color="#dc2626" />}
            subtitle="Scorer & Club applications"
            accentColor="#dc2626"
            onPress={() => onNavigate('approvals')}
          />
        </View>
      )}

      {/* Two Column Layout for Sections A & B */}
      <View style={styles.twoColRow}>
        {/* Section B: Pending Approvals (High Priority) */}
        <View style={styles.panelCard}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.panelTitle}>Pending Approvals</Text>
              <Text style={styles.panelSubtitle}>Accreditation & Club applications requiring verification</Text>
            </View>
            <TouchableOpacity onPress={() => onNavigate('approvals')}>
              <Text style={styles.panelViewAll}>Manage Queue →</Text>
            </TouchableOpacity>
          </View>

          {pendingApprovals.length === 0 ? (
            <EmptyState
              title="All Approvals Cleared"
              description="No pending requests currently waiting in the verification queue."
            />
          ) : (
            <View style={styles.approvalsList}>
              {pendingApprovals.slice(0, 4).map(item => (
                <View key={item.id} style={styles.approvalItem}>
                  <View style={styles.approvalInfo}>
                    <Text style={styles.approvalName}>{item.name}</Text>
                    <Text style={styles.approvalType}>
                      {item.type} • {item.association || item.email}
                    </Text>
                    <Text style={styles.approvalDate}>
                      Submitted: {new Date(item.date).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.approvalActions}>
                    <TouchableOpacity
                      style={styles.btnApprove}
                      onPress={() => handleActionClick(item, 'approve')}
                      accessibilityLabel="Approve Request"
                    >
                      <CheckIcon size={14} color="#059669" />
                      <Text style={styles.btnApproveText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnReject}
                      onPress={() => handleActionClick(item, 'reject')}
                      accessibilityLabel="Reject Request"
                    >
                      <CloseIcon size={14} color="#dc2626" />
                      <Text style={styles.btnRejectText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Section C: Upcoming & Live Matches */}
        <View style={styles.panelCard}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.panelTitle}>Upcoming & Live Matches</Text>
              <Text style={styles.panelSubtitle}>Official district fixtures & match centre</Text>
            </View>
            <TouchableOpacity onPress={() => onNavigate('matches')}>
              <Text style={styles.panelViewAll}>All Matches →</Text>
            </TouchableOpacity>
          </View>

          {upcomingMatches.length === 0 ? (
            <EmptyState title="No Matches Scheduled" description="No upcoming matches currently on the association roster." />
          ) : (
            <View style={styles.matchesList}>
              {upcomingMatches.slice(0, 3).map(m => (
                <View key={m.id} style={styles.matchItem}>
                  <View style={styles.matchTopRow}>
                    <Text style={styles.matchTournament}>{m.tournament}</Text>
                    <StatusBadge status={m.status} size="sm" />
                  </View>
                  <Text style={styles.matchTeams}>
                    {m.teamA} <Text style={{ color: '#94a3b8' }}>vs</Text> {m.teamB}
                  </Text>
                  <Text style={styles.matchVenue}>
                    📍 {m.venue} • {m.date} at {m.time}
                  </Text>
                  <View style={styles.matchFooter}>
                    <Text style={styles.matchResult}>{m.result}</Text>
                    <TouchableOpacity
                      style={styles.matchViewBtn}
                      onPress={() => (m.status === 'LIVE' ? onNavigate('live-scoring') : onNavigate('matches'))}
                    >
                      <EyeIcon size={13} color="#0f2452" />
                      <Text style={styles.matchViewText}>
                        {m.status === 'LIVE' ? 'Monitor Live' : 'Match Details'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Two Column Layout for Sections A & D */}
      <View style={styles.twoColRow}>
        {/* Section A: Recent Registrations Table */}
        <View style={styles.panelCard}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.panelTitle}>Recent Registrations</Text>
              <Text style={styles.panelSubtitle}>Newly registered portal accounts and participants</Text>
            </View>
            <TouchableOpacity onPress={() => onNavigate('users')}>
              <Text style={styles.panelViewAll}>View Users →</Text>
            </TouchableOpacity>
          </View>

          {recentRegistrations.length === 0 ? (
            <EmptyState title="No Users Registered" description="No recent registration records available." />
          ) : (
            <View style={styles.regTable}>
              <View style={styles.regTableHeader}>
                <Text style={[styles.regTh, { flex: 2 }]}>User</Text>
                <Text style={[styles.regTh, { flex: 1 }]}>Role</Text>
                <Text style={[styles.regTh, { flex: 1 }]}>Status</Text>
                <Text style={[styles.regTh, { flex: 1, textAlign: 'right' }]}>Date</Text>
              </View>
              {recentRegistrations.slice(0, 5).map(u => (
                <View key={u.id} style={styles.regTableRow}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.regName}>{u.name}</Text>
                    <Text style={styles.regEmail}>{u.email}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.regRoleBadge}>{u.role}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <StatusBadge status={u.status || 'ACTIVE'} size="sm" />
                  </View>
                  <Text style={[styles.regDate, { flex: 1, textAlign: 'right' }]}>
                    {new Date(u.date).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Section D: Recent System Activities */}
        <View style={styles.panelCard}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.panelTitle}>Recent System Activities</Text>
              <Text style={styles.panelSubtitle}>Audited operations and database events</Text>
            </View>
            <TouchableOpacity onPress={() => onNavigate('settings')}>
              <Text style={styles.panelViewAll}>Audit Logs →</Text>
            </TouchableOpacity>
          </View>

          {recentActivities.length === 0 ? (
            <EmptyState title="No Activities Logged" description="No database activities logged yet." />
          ) : (
            <View style={styles.activityList}>
              {recentActivities.map((act, idx) => (
                <View key={act.id || idx} style={styles.activityItem}>
                  <View style={styles.activityTimelineDot} />
                  <View style={styles.activityContent}>
                    <Text style={styles.activityDetails}>{act.details || act.action}</Text>
                    <Text style={styles.activityMeta}>
                      Initiated by: {act.user || 'System Admin'} •{' '}
                      {act.time ? new Date(act.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.action === 'approve' ? 'success' : 'danger'}
        confirmText={confirmDialog.action === 'approve' ? 'Approve' : 'Reject'}
        requireReason={confirmDialog.requireReason}
        reasonPlaceholder="Specify reason for rejection..."
        onConfirm={handleExecuteApproval}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, visible: false }))}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  greetingBanner: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16
  },
  greetingTextCol: {
    flex: 1,
    minWidth: 280
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3
  },
  greetingSub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 18
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  refreshBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0f2452'
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24
  },
  twoColRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    marginBottom: 24
  },
  panelCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a'
  },
  panelSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  panelViewAll: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f2452'
  },
  approvalsList: {
    gap: 12
  },
  approvalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    gap: 12,
    flexWrap: 'wrap'
  },
  approvalInfo: {
    flex: 1,
    minWidth: 180
  },
  approvalName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a'
  },
  approvalType: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2
  },
  approvalDate: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2
  },
  approvalActions: {
    flexDirection: 'row',
    gap: 8
  },
  btnApprove: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 10
  },
  btnApproveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669'
  },
  btnReject: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 10
  },
  btnRejectText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626'
  },
  matchesList: {
    gap: 12
  },
  matchItem: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12
  },
  matchTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  matchTournament: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b8860b',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  matchTeams: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a'
  },
  matchVenue: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 4
  },
  matchFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0'
  },
  matchResult: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600'
  },
  matchViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 5,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  matchViewText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0f2452'
  },
  regTable: {
    width: '100%'
  },
  regTableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  regTh: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  regTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc'
  },
  regName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a'
  },
  regEmail: {
    fontSize: 11,
    color: '#64748b'
  },
  regRoleBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    backgroundColor: '#f1f5f9',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: 'flex-start'
  },
  regDate: {
    fontSize: 11,
    color: '#94a3b8'
  },
  activityList: {
    paddingLeft: 8
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12
  },
  activityTimelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0f2452',
    marginTop: 5
  },
  activityContent: {
    flex: 1
  },
  activityDetails: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
    lineHeight: 18
  },
  activityMeta: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2
  }
});

export default DashboardPage;
