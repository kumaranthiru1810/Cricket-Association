/**
 * src/admin/services/adminApi.ts
 * Dedicated API Service for Cricket Association Professional Admin Panel.
 * Connects to Express backend database endpoints.
 */

import { Platform } from 'react-native';
import { API_URL } from '../../services/api';
export { API_URL };

const ADMIN_TOKEN_KEY = 'cfvd_admin_token';
const ADMIN_USER_KEY = 'cfvd_admin_user';

export const getStoredAdminToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ADMIN_TOKEN_KEY) || sessionStorage.getItem(ADMIN_TOKEN_KEY);
};

export const setStoredAdminToken = (token: string | null, remember = true) => {
  if (typeof window === 'undefined') return;
  if (!token) {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } else if (remember) {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  } else {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  }
};

export const getStoredAdminUser = (): any | null => {
  if (typeof window === 'undefined') return null;
  const str = localStorage.getItem(ADMIN_USER_KEY) || sessionStorage.getItem(ADMIN_USER_KEY);
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
};

export const setStoredAdminUser = (user: any | null, remember = true) => {
  if (typeof window === 'undefined') return;
  if (!user) {
    localStorage.removeItem(ADMIN_USER_KEY);
    sessionStorage.removeItem(ADMIN_USER_KEY);
  } else {
    const str = JSON.stringify(user);
    if (remember) {
      localStorage.setItem(ADMIN_USER_KEY, str);
    } else {
      sessionStorage.setItem(ADMIN_USER_KEY, str);
    }
  }
};

async function adminRequest(endpoint: string, options: RequestInit = {}) {
  const token = getStoredAdminToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-role': 'ADMIN',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const url = `${API_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: { ...headers, ...(options.headers as any) }
    });

    let data: any = {};
    try {
      data = await res.json();
    } catch (parseErr) {
      data = {};
    }

    if (!res.ok) {
      const err: any = new Error(data.message || data.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (err: any) {
    console.warn(`[AdminApi] ${endpoint} error:`, err?.message || err);
    throw err;
  }
}

export const adminApi = {
  // 1. Auth
  login: async (email: string, password: string) => {
    return adminRequest('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  getMe: async () => {
    return adminRequest('/admin/me');
  },

  // 2. Dashboard Stats & Feeds
  getDashboardStats: async () => {
    return adminRequest('/admin/dashboard-stats');
  },

  // 3. Users Management
  getUsers: async (params?: { search?: string; role?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return adminRequest(`/admin/users${query ? '?' + query : ''}`);
  },

  updateUserStatus: async (id: string, status: string) => {
    return adminRequest(`/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  updateUser: async (id: string, data: any) => {
    return adminRequest(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteUser: async (id: string) => {
    return adminRequest(`/admin/users/${id}`, {
      method: 'DELETE'
    });
  },

  // 4. Players Management
  getPlayers: async (params?: { search?: string; team?: string; role?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return adminRequest(`/admin/players${query ? '?' + query : ''}`);
  },

  createPlayer: async (data: any) => {
    return adminRequest('/admin/players', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updatePlayer: async (id: string, data: any) => {
    return adminRequest(`/admin/players/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // 5. Teams Management
  getTeams: async (params?: { search?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return adminRequest(`/admin/teams-list${query ? '?' + query : ''}`);
  },

  getTeamById: async (id: string) => {
    return adminRequest(`/admin/teams-list/${id}`);
  },

  updateTeamStatus: async (id: string, status: string) => {
    return adminRequest(`/admin/teams-list/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  // 6. Tournaments Management
  getTournaments: async () => {
    return adminRequest('/admin/tournaments');
  },

  createTournament: async (data: any) => {
    return adminRequest('/admin/tournaments', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateTournament: async (id: string, data: any) => {
    return adminRequest(`/admin/tournaments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // 7. Matches Management
  getMatches: async () => {
    return adminRequest('/admin/matches');
  },

  createMatch: async (data: any) => {
    return adminRequest('/admin/matches', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateMatch: async (id: string, data: any) => {
    return adminRequest(`/admin/matches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  // 8. Approvals Pipeline
  getApprovals: async () => {
    return adminRequest('/admin/approvals');
  },

  handleApproval: async (type: string, id: string, action: 'approve' | 'reject', reason?: string) => {
    return adminRequest(`/admin/approvals/${type}/${id}`, {
      method: 'POST',
      body: JSON.stringify({ action, reason })
    });
  },

  // 9. Live Scoring
  getLiveScoring: async () => {
    return adminRequest('/admin/live-scoring');
  },

  // 10. Statistics
  getStatistics: async () => {
    return adminRequest('/admin/statistics');
  },

  // 11. Notifications
  getNotifications: async () => {
    return adminRequest('/admin/notifications');
  },

  createNotification: async (data: any) => {
    return adminRequest('/admin/notifications', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  markNotificationRead: async (id: string) => {
    return adminRequest(`/admin/notifications/${id}/read`, {
      method: 'PATCH'
    });
  },

  deleteNotification: async (id: string) => {
    return adminRequest(`/admin/notifications/${id}`, {
      method: 'DELETE'
    });
  },

  // 12. Content Management
  getContent: async () => {
    return adminRequest('/admin/content');
  },

  createContent: async (data: any) => {
    return adminRequest('/admin/content', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateContent: async (id: string, data: any) => {
    return adminRequest(`/admin/content/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteContent: async (id: string) => {
    return adminRequest(`/admin/content/${id}`, {
      method: 'DELETE'
    });
  },

  // 13. Settings
  getSettings: async () => {
    return adminRequest('/admin/settings');
  },

  updateSettings: async (data: any) => {
    return adminRequest('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
};
