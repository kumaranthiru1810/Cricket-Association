/**
 * src/admin/components/AdminLayout.tsx
 * Professional Master Layout for Cricket Association Admin Panel.
 */

import React, { useState, createContext, useContext } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import AdminSidebar, { AdminRouteKey } from './AdminSidebar';
import AdminTopbar from './AdminTopbar';

interface ToastOptions {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

interface AdminLayoutContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  pendingApprovalsCount: number;
  setPendingApprovalsCount: (count: number) => void;
  liveMatchesCount: number;
  setLiveMatchesCount: (count: number) => void;
}

const AdminLayoutContext = createContext<AdminLayoutContextType>({
  showToast: () => {},
  pendingApprovalsCount: 0,
  setPendingApprovalsCount: () => {},
  liveMatchesCount: 0,
  setLiveMatchesCount: () => {}
});

export const useAdminLayout = () => useContext(AdminLayoutContext);

interface Props {
  currentRoute?: AdminRouteKey;
  currentPath?: string;
  onNavigate: (route: string) => void;
  onExitToPublic?: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<Props> = ({
  currentRoute,
  currentPath,
  onNavigate,
  onExitToPublic,
  children
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(2);
  const [liveMatchesCount, setLiveMatchesCount] = useState(1);

  const computedRoute: AdminRouteKey = currentRoute || (
    currentPath
      ? (currentPath.replace(/^\/admin\/?/, '').split('/')[0] || 'dashboard') as AdminRouteKey
      : 'dashboard'
  );

  const handleNav = (target: string) => {
    if (target.startsWith('/admin')) {
      onNavigate(target);
    } else {
      onNavigate(`/admin/${target}`);
    }
  };

  const handleExit = onExitToPublic || (() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = '/';
    }
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  return (
    <AdminLayoutContext.Provider
      value={{
        showToast,
        pendingApprovalsCount,
        setPendingApprovalsCount,
        liveMatchesCount,
        setLiveMatchesCount
      }}
    >
      <View style={styles.layoutRoot}>
        {/* Sidebar */}
        <AdminSidebar
          currentRoute={computedRoute}
          onNavigate={(key) => handleNav(key)}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
          isMobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          onExitToPublic={handleExit}
          pendingApprovalsCount={pendingApprovalsCount}
          liveMatchesCount={liveMatchesCount}
        />

        {/* Right Main Column */}
        <View style={styles.mainColumn}>
          {/* Topbar */}
          <AdminTopbar
            currentRoute={computedRoute}
            onNavigate={(key) => handleNav(key)}
            onToggleSidebar={() => {
              if (Dimensions.get('window').width < 768) {
                setMobileOpen(true);
              } else {
                setCollapsed(!collapsed);
              }
            }}
            onExitToPublic={handleExit}
            notificationsCount={pendingApprovalsCount + liveMatchesCount}
          />

          {/* Toast Notification Banner */}
          {toast && (
            <View
              style={[
                styles.toastBanner,
                toast.type === 'success' && styles.toastSuccess,
                toast.type === 'error' && styles.toastError,
                toast.type === 'warning' && styles.toastWarning,
                toast.type === 'info' && styles.toastInfo
              ]}
            >
              <View
                style={[
                  styles.toastDot,
                  toast.type === 'success' && { backgroundColor: '#10b981' },
                  toast.type === 'error' && { backgroundColor: '#ef4444' },
                  toast.type === 'warning' && { backgroundColor: '#f59e0b' },
                  toast.type === 'info' && { backgroundColor: '#3b82f6' }
                ]}
              />
              <View style={styles.toastContent}>
                <Text style={styles.toastMessageText}>
                  {toast.message}
                </Text>
              </View>
            </View>
          )}

          {/* Scrollable Page Content */}
          <View style={styles.contentArea}>
            <View style={styles.contentContainer}>{children}</View>
          </View>
        </View>
      </View>
    </AdminLayoutContext.Provider>
  );
};

const styles = StyleSheet.create({
  layoutRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    width: '100%',
    height: '100%',
    overflow: 'hidden'
  },
  mainColumn: {
    flex: 1,
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden'
  },
  contentArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
    overflow: (Platform.OS === 'web' ? 'auto' : 'scroll') as any
  },
  contentContainer: {
    padding: Platform.OS === 'web' && Dimensions.get('window').width < 768 ? 14 : 24,
    maxWidth: 1400,
    width: '100%',
    alignSelf: 'center'
  },
  toastBanner: {
    marginHorizontal: 24,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 20
  },
  toastSuccess: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0'
  },
  toastError: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca'
  },
  toastWarning: {
    backgroundColor: '#fefce8',
    borderColor: '#fde68a'
  },
  toastInfo: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe'
  },
  toastDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  toastContent: {
    flex: 1
  },
  toastMessageText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a'
  }
});

export default AdminLayout;
