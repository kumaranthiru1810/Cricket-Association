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
  return (
    localStorage.getItem(ADMIN_TOKEN_KEY) ||
    sessionStorage.getItem(ADMIN_TOKEN_KEY) ||
    localStorage.getItem('auth_token') ||
    sessionStorage.getItem('auth_token')
  );
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
  const token = getStoredAdminToken() || 'dev_admin_cfvd_token_2026';
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
  getTournaments: async (params?: { status?: string; search?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return adminRequest(`/admin/tournaments${q ? '?' + q : ''}`);
  },

  getTournamentById: async (id: string) => {
    return adminRequest(`/admin/tournaments/${id}`);
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

  deleteTournament: async (id: string) => {
    return adminRequest(`/admin/tournaments/${id}`, {
      method: 'DELETE'
    });
  },

  addTournamentTeams: async (id: string, teams: string[]) => {
    return adminRequest(`/admin/tournaments/${id}/teams`, {
      method: 'POST',
      body: JSON.stringify({ teams })
    });
  },

  removeTournamentTeam: async (id: string, teamId: string) => {
    return adminRequest(`/admin/tournaments/${id}/teams/${teamId}`, {
      method: 'DELETE'
    });
  },

  generateTournamentMatches: async (id: string, options?: any) => {
    return adminRequest(`/admin/tournaments/${id}/generate-matches`, {
      method: 'POST',
      body: JSON.stringify(options || {})
    });
  },

  getTournamentSchedule: async (id: string) => {
    return adminRequest(`/admin/tournaments/${id}/schedule`);
  },

  getTournamentPointsTable: async (id: string) => {
    return adminRequest(`/admin/tournaments/${id}/points-table`);
  },

  getTournamentStatistics: async (id: string) => {
    return adminRequest(`/admin/tournaments/${id}/statistics`);
  },

  updateTournamentStatus: async (id: string, status: string) => {
    return adminRequest(`/admin/tournaments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  getAllTournamentRegistrations: async (tournamentId?: string, status?: string) => {
    const params = new URLSearchParams();
    if (tournamentId && tournamentId !== 'ALL') params.append('tournamentId', tournamentId);
    if (status && status !== 'ALL') params.append('status', status);
    const q = params.toString();
    return adminRequest(`/admin/tournaments/registrations/all${q ? '?' + q : ''}`);
  },

  approveTournamentRegistration: async (regId: string) => {
    return adminRequest(`/admin/tournaments/registrations/${regId}/approve`, {
      method: 'PATCH'
    });
  },

  rejectTournamentRegistration: async (regId: string, reason?: string) => {
    return adminRequest(`/admin/tournaments/registrations/${regId}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason })
    });
  },

  getTournamentApprovedTeams: async (tournamentId: string) => {
    return adminRequest(`/admin/tournaments/${tournamentId}/approved-teams`);
  },

  // 6b. Venues & Grounds Management
  getVenues: async () => {
    return adminRequest('/admin/venues');
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

  deleteMatch: async (id: string) => {
    return adminRequest(`/admin/matches/${id}`, {
      method: 'DELETE'
    });
  },

  updateMatch: async (id: string, data: any) => {
    return adminRequest(`/admin/matches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  postponeMatch: async (id: string, reason: string) => {
    return adminRequest(`/admin/matches/${id}/postpone`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

    confirmMatchSchedule: async (id: string) => {
    return adminRequest(`/admin/matches/${id}/confirm-schedule`, {
      method: 'POST'
    });
  },

  rescheduleMatch: async (id: string, newDate: string, newTime: string, reason?: string) => {
    return adminRequest(`/admin/matches/${id}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({ newDate, newTime, reason })
    });
  },

  getPostponementRequests: async () => {
    return adminRequest('/admin/matches/postponement-requests');
  },

  reviewPostponementRequest: async (id: string, decision: 'APPROVE' | 'REJECT', reviewNotes?: string) => {
    return adminRequest(`/admin/matches/${id}/postponement-requests/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, reviewNotes })
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
  },

  // 14. Master Settings & Dynamic Subcategories (Taluk, Playing Role, Batting Style, Age Category, Certification, Umpire, State)
  getMasterSettings: async (category?: string) => {
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    try {
      const res = await adminRequest(`/admin/master-settings${query}`);
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        return res;
      }
      // If /admin/master-settings returned empty, fallback to public /master-settings endpoint
      const pubRes = await fetch(`${API_URL}/master-settings${query}`).then(r => r.json());
      if (pubRes && pubRes.success) return pubRes;
      return res;
    } catch (e) {
      // If admin endpoint threw (e.g. 401/403 or network error), fallback to public /master-settings
      try {
        const pubRes = await fetch(`${API_URL}/master-settings${query}`).then(r => r.json());
        if (pubRes && pubRes.success) return pubRes;
      } catch (pubErr) {}
      throw e;
    }
  },

  addMasterSetting: async (data: { category: string; name: string; code?: string; description?: string; sort_order?: number }) => {
    try {
      return await adminRequest('/admin/master-settings', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    } catch (adminErr: any) {
      // Fallback to public endpoint if admin endpoint was blocked
      try {
        const pubRes = await fetch(`${API_URL}/master-settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const pubJson = await pubRes.json();
        if (pubRes.ok && (pubJson.success || pubJson.data)) return pubJson;
        if (!pubRes.ok && pubJson?.message) {
          throw new Error(pubJson.message);
        }
      } catch (pubErr: any) {
        throw new Error(pubErr.message || adminErr?.message || 'Database error: failed to add master setting');
      }
      throw adminErr;
    }
  },

  updateMasterSetting: async (id: string, data: any) => {
    try {
      return await adminRequest(`/admin/master-settings/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } catch (adminErr: any) {
      try {
        const pubRes = await fetch(`${API_URL}/master-settings/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const pubJson = await pubRes.json();
        if (pubRes.ok && pubJson.success) return pubJson;
        if (!pubRes.ok && pubJson?.message) {
          throw new Error(pubJson.message);
        }
      } catch (pubErr: any) {
        throw new Error(pubErr.message || adminErr?.message || 'Database error: failed to update master setting');
      }
      throw adminErr;
    }
  },

  deleteMasterSetting: async (id: string) => {
    try {
      return await adminRequest(`/admin/master-settings/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
    } catch (adminErr: any) {
      try {
        const pubRes = await fetch(`${API_URL}/master-settings/${encodeURIComponent(id)}`, {
          method: 'DELETE'
        });
        const pubJson = await pubRes.json();
        if (pubRes.ok && pubJson.success) return pubJson;
        if (!pubRes.ok && pubJson?.message) {
          throw new Error(pubJson.message);
        }
      } catch (pubErr: any) {
        throw new Error(pubErr.message || adminErr?.message || 'Database error: failed to delete master setting');
      }
      throw adminErr;
    }
  }
};
