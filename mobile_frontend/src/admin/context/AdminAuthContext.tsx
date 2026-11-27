/**
 * src/admin/context/AdminAuthContext.tsx
 * Authentication Context for Cricket Association Professional Admin Panel.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  adminApi,
  getStoredAdminToken,
  setStoredAdminToken,
  getStoredAdminUser,
  setStoredAdminUser
} from '../services/adminApi';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: string;
}

interface AdminAuthContextType {
  adminUser: AdminUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string, remember?: boolean) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  isContextProvided: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType>({
  adminUser: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  login: async () => ({ success: false, message: 'AdminAuthProvider not mounted.' }),
  logout: () => {},
  refreshProfile: async () => {},
  isContextProvided: false
});

export const useAdminAuth = () => useContext(AdminAuthContext);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(getStoredAdminToken());
  const [adminUser, setAdminUser] = useState<AdminUser | null>(getStoredAdminUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize and verify stored session
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = getStoredAdminToken();
      const storedUser = getStoredAdminUser();

      if (storedToken && storedUser) {
        setToken(storedToken);
        setAdminUser(storedUser);
        try {
          const res = await adminApi.getMe();
          if (res && res.user) {
            setAdminUser(res.user);
            setStoredAdminUser(res.user, true);
          }
        } catch (e) {
          // Token still valid locally in fallback/dev mode
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, pass: string, remember = true) => {
    setIsLoading(true);
    try {
      const res = await adminApi.login(email, pass);
      if (res && res.success && res.token) {
        setToken(res.token);
        setAdminUser(res.user);
        setStoredAdminToken(res.token, remember);
        setStoredAdminUser(res.user, remember);
        setIsLoading(false);
        return { success: true, message: res.message };
      } else {
        setIsLoading(false);
        return { success: false, message: res?.message || 'Authentication failed.' };
      }
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, message: err.message || 'Unable to authenticate administrator.' };
    }
  };

  const logout = () => {
    setToken(null);
    setAdminUser(null);
    setStoredAdminToken(null);
    setStoredAdminUser(null);
  };

  const refreshProfile = async () => {
    try {
      const res = await adminApi.getMe();
      if (res && res.user) {
        setAdminUser(res.user);
        setStoredAdminUser(res.user, true);
      }
    } catch (e) {}
  };

  const isAuthenticated = Boolean(token && adminUser && adminUser.role === 'ADMIN');

  return (
    <AdminAuthContext.Provider
      value={{
        adminUser,
        token,
        isAuthenticated,
        isLoading,
        login,
        logout,
        refreshProfile,
        isContextProvided: true
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};
