/**
 * src/services/api.ts
 * Frontend REST API & Socket.IO Client for Cricket Scorer & Association Management System
 * Connected to pure MongoDB backend.
 */

import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Determine backend host
export const getBackendHost = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const host = window.location.hostname || 'localhost';
    return host;
  }
  // On mobile devices (Expo Go / dev client), dynamically get Metro host IP
  try {
    const hostUri =
      Constants?.expoConfig?.hostUri ||
      (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost ||
      (Constants as any)?.manifest?.debuggerHost ||
      (Constants as any)?.linkingUri?.replace(/^https?:\/\/|^exp:\/\//, '');
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        return ip;
      }
    }
  } catch (_e) {}
  // Fallback to local network IP of the host machine
  return '10.34.20.112';
};

const PROD_BACKEND_URL = 'https://cricket-backend-dqdm.onrender.com';

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1' && !host.startsWith('192.168.') && !host.startsWith('10.')) {
      return `${PROD_BACKEND_URL}/api`;
    }
  }
  return `http://${getBackendHost()}:5000/api`;
};

const getSocketUrl = () => {
  if (process.env.EXPO_PUBLIC_SOCKET_URL) {
    return process.env.EXPO_PUBLIC_SOCKET_URL;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1' && !host.startsWith('192.168.') && !host.startsWith('10.')) {
      return PROD_BACKEND_URL;
    }
  }
  return `http://${getBackendHost()}:5000`;
};

export const API_URL = getBaseUrl();
export const SOCKET_URL = getSocketUrl();

let token: string | null = null;
let currentUser: any = null;

export const getAuthToken = (): string | null => {
  if (token) return token;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return (
      localStorage.getItem('auth_token') ||
      localStorage.getItem('team_token') ||
      localStorage.getItem('cfvd_admin_token') ||
      sessionStorage.getItem('cfvd_admin_token') ||
      null
    );
  }
  return null;
};

export const getCurrentUser = (): any => {
  if (currentUser) return currentUser;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const u =
        localStorage.getItem('auth_user') ||
        localStorage.getItem('cfvd_admin_user') ||
        sessionStorage.getItem('cfvd_admin_user') ||
        localStorage.getItem('team_session');
      if (u) {
        currentUser = JSON.parse(u);
        return currentUser;
      }
    } catch (e) {
      return null;
    }
  }
  return null;
};

// Initialize from storage on load
token = getAuthToken();
currentUser = getCurrentUser();

let currentSocket: Socket | null = null;

export const logoutAndClearAllSessions = async () => {
  try {
    await request('/auth/logout', { method: 'POST' });
  } catch (_e) {}
  setAuthToken(null);
  setCurrentUser(null);
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('team_token');
      localStorage.removeItem('cfvd_admin_token');
      sessionStorage.removeItem('cfvd_admin_token');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('cfvd_admin_user');
      sessionStorage.removeItem('cfvd_admin_user');
      localStorage.removeItem('team_session');
      localStorage.removeItem('cfvd_last_scorer_screen');
      localStorage.removeItem('cfvd_last_scorer_match_id');
      localStorage.removeItem('cfvd_last_scorecard_match_id');
      localStorage.removeItem('cfvd_player_active_tab');
      localStorage.removeItem('cfvd_team_active_tab');
      localStorage.setItem('cfvd_last_app_screen', 'Home');
    } catch (_e) {}
  }
};

export const setAuthToken = (newToken: string | null, role?: string) => {
  token = newToken;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (newToken) {
      localStorage.setItem('auth_token', newToken);

      const activeRole = (role || currentUser?.role || '').toUpperCase();
      if (activeRole === 'ADMIN') {
        localStorage.setItem('cfvd_admin_token', newToken);
        localStorage.removeItem('team_token');
      } else if (activeRole === 'COACH' || activeRole === 'TEAM') {
        localStorage.setItem('team_token', newToken);
        localStorage.removeItem('cfvd_admin_token');
      } else {
        // PLAYER or other roles: token is created and stored strictly as player auth_token.
        // Never create or retain admin or team tokens.
        localStorage.removeItem('team_token');
        localStorage.removeItem('cfvd_admin_token');
        try {
          sessionStorage.removeItem('cfvd_admin_token');
        } catch (_e) {}
      }
    } else {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('team_token');
      localStorage.removeItem('cfvd_admin_token');
      try {
        sessionStorage.removeItem('cfvd_admin_token');
      } catch (_e) {}
    }
  }
};

export const setCurrentUser = (user: any) => {
  currentUser = user;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (user) {
      localStorage.setItem('auth_user', JSON.stringify(user));
      const activeRole = (user.role || '').toUpperCase();
      if (activeRole === 'ADMIN') {
        localStorage.setItem('cfvd_admin_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('cfvd_admin_user');
        try {
          sessionStorage.removeItem('cfvd_admin_user');
        } catch (_e) {}
      }

      // ONLY set team_session for coach/team, NEVER for player!
      if ((activeRole === 'COACH' || activeRole === 'TEAM') && user.teamId) {
        localStorage.setItem(
          'team_session',
          JSON.stringify({
            teamId: user.teamId,
            teamName: user.teamName,
            coach: { name: user.name, email: user.email },
            status: 'Approved',
            loginTime: new Date().toISOString()
          })
        );
      } else {
        localStorage.removeItem('team_session');
      }
    } else {
      localStorage.removeItem('auth_user');
      localStorage.removeItem('cfvd_admin_user');
      try {
        sessionStorage.removeItem('cfvd_admin_user');
      } catch (_e) {}
      localStorage.removeItem('team_session');
    }
  }
};

async function request(endpoint: string, options: RequestInit = {}) {
  const url = `${API_URL}${endpoint}`;
  const activeToken = getAuthToken();
  const activeUser = getCurrentUser();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
    ...(activeUser?.role
      ? {
          'x-user-role': String(activeUser.role).toUpperCase(),
          'x-user-email': activeUser.email || '',
          'x-user-id': activeUser.id || activeUser._id || ''
        }
      : {})
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, {
      credentials: 'include',
      signal: options.signal || controller.signal,
      ...options,
      headers: { ...headers, ...(options.headers as any) }
    });
    clearTimeout(timeoutId);

    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_e) {
      if (!res.ok) {
        throw new Error(`Server returned error (${res.status}): ${res.statusText || 'Endpoint unavailable'}`);
      }
      throw new Error('Unexpected response format from server');
    }

    if (!res.ok) {
      const err: any = new Error(data.message || data.error || `Request failed with status ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn(`API Error on ${endpoint}:`, err?.message || err);
    if (err.name === 'AbortError' || err.message?.includes('aborted')) {
      const timeoutErr = new Error(
        `Connection timed out (${getBackendHost()}:5000). Please check if your mobile and computer are on the same Wi-Fi network.`
      );
      (timeoutErr as any).isNetworkError = true;
      throw timeoutErr;
    }
    if (
      err.message === 'Failed to fetch' ||
      err.message === 'Network request failed' ||
      err.message?.includes('ERR_CONNECTION_REFUSED') ||
      err.message?.includes('ECONNREFUSED')
    ) {
      const friendly = new Error(
        `Cannot connect to backend (${getBackendHost()}:5000). Ensure the backend server is running and your mobile is on the same Wi-Fi.`
      );
      (friendly as any).isNetworkError = true;
      throw friendly;
    }
    throw err;
  }
}

// ==========================================
// OFFLINE QUEUE MANAGER (MCC / Rural Ground Resilience)
// ==========================================
const OFFLINE_QUEUE_KEY = 'cfvd_offline_delivery_queue';
let memoryOfflineQueue: Array<{ id: string; matchId: string; delivery: any; timestamp: number }> = [];

export const OfflineQueue = {
  getQueue: (): Array<{ id: string; matchId: string; delivery: any; timestamp: number }> => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY);
        return raw ? JSON.parse(raw) : [];
      }
    } catch (_e) {}
    return memoryOfflineQueue;
  },
  enqueue: (matchId: string, delivery: any) => {
    try {
      const q = OfflineQueue.getQueue();
      const item = {
        id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        matchId,
        delivery,
        timestamp: Date.now()
      };
      q.push(item);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
      } else {
        memoryOfflineQueue = q;
      }
      return item;
    } catch (_e) {
      return null;
    }
  },
  clear: () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(OFFLINE_QUEUE_KEY);
      }
      memoryOfflineQueue = [];
    } catch (_e) {}
  },
  remove: (id: string) => {
    try {
      const q = OfflineQueue.getQueue().filter(item => item.id !== id);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
      } else {
        memoryOfflineQueue = q;
      }
    } catch (_e) {}
  },
  sync: async (): Promise<{ synced: number; remaining: number }> => {
    const q = OfflineQueue.getQueue();
    if (q.length === 0) return { synced: 0, remaining: 0 };
    let synced = 0;
    for (const item of q) {
      try {
        const res = await request(`/scorer/matches/${item.matchId}/deliveries`, {
          method: 'POST',
          body: JSON.stringify(item.delivery)
        });
        if (res && (res.success || res.status === 'success' || res.data)) {
          synced++;
          OfflineQueue.remove(item.id);
        }
      } catch (_e) {
        break; // Stop syncing to preserve order if still failing
      }
    }
    return { synced, remaining: OfflineQueue.getQueue().length };
  }
};

// Auto-sync whenever online connectivity resumes
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('online', () => {
    OfflineQueue.sync().catch(() => {});
  });
}

export const ScorerApi = {
  // --- REAL AUTHENTICATION & PASSWORD APIs ---
  getMe: async () => {
    const activeToken = getAuthToken();
    const activeUser = getCurrentUser();
    if (!activeToken && !activeUser && Platform.OS !== 'web') {
      return { success: false, message: 'No active session' };
    }
    return request('/auth/me');
  },

  logout: async () => {
    await logoutAndClearAllSessions();
    return { success: true };
  },

  checkAuthSession: async () => {
    try {
      const res = await request('/auth/me');
      if (res && res.success && res.user) {
        setCurrentUser(res.user);
        return res.user;
      }
    } catch (_e) {
      // Token expired or unauthenticated
    }
    return currentUser;
  },

  sendRegistrationOtp: async (email: string, name?: string, role?: string) => {
    return request('/auth/send-registration-otp', {
      method: 'POST',
      body: JSON.stringify({ email, name, role })
    });
  },

  verifyRegistrationOtp: async (email: string, otp: string) => {
    return request('/auth/verify-registration-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp })
    });
  },

  loginWithPassword: async (email: string, password: string, role?: string, teamName?: string) => {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, role, teamName })
    });
    if (res.token) {
      setAuthToken(res.token, res.user?.role || role);
      if (res.user) setCurrentUser(res.user);
    }
    return res;
  },

  // Forgot Password Flow (Step 1: Request 4-digit OTP)
  requestForgotPasswordOtp: async (email: string, role?: string) => {
    return request('/auth/forgot-password/request-otp', {
      method: 'POST',
      body: JSON.stringify({ email, role })
    });
  },

  // Forgot Password Flow (Step 2: Verify 4-digit OTP)
  verifyForgotPasswordOtp: async (email: string, otp: string) => {
    return request('/auth/forgot-password/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp })
    });
  },

  // Forgot Password Flow (Step 3: Reset & Encrypt Password)
  resetPassword: async (email: string, otp: string, newPassword: string, confirmPassword?: string) => {
    return request('/auth/forgot-password/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, newPassword, confirmPassword })
    });
  },


  requestOtp: async (email: string, role?: string) => {
    return request('/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ email, role: role || 'SCORER' })
    });
  },

  verifyOtp: async (email: string, otp: string, role?: string) => {
    const res = await request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp, role: role || 'SCORER' })
    });
    if (res.token) {
      setAuthToken(res.token, res.user?.role || role);
      if (res.user) setCurrentUser(res.user);
    }
    return res;
  },

  requestRegistrationOtp: async (email: string, name?: string, role?: string) => {
    return ScorerApi.sendRegistrationOtp(email, name, role);
  },

  login: async (email: string, passwordOrOtp: string, role?: string) => {
    return ScorerApi.loginWithPassword(email, passwordOrOtp, role);
  },

  // Team / Coach
  requestTeamOtp: async (coachName: string, coachEmail: string) => {
    return request('/auth/send-registration-otp', {
      method: 'POST',
      body: JSON.stringify({ name: coachName, email: coachEmail, role: 'COACH' })
    });
  },

  verifyTeamOtp: async (coachEmail: string, otp: string) => {
    return ScorerApi.loginWithPassword(coachEmail, otp, 'COACH');
  },

  // Player
  requestPlayerOtp: async (nameOrEmail: string) => {
    return request('/auth/send-registration-otp', {
      method: 'POST',
      body: JSON.stringify({ email: nameOrEmail, role: 'PLAYER' })
    });
  },

  verifyPlayerOtp: async (nameOrEmail: string, otp: string) => {
    return ScorerApi.loginWithPassword(nameOrEmail, otp, 'PLAYER');
  },

  register: async (payload: any) => {
    const res = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.token) {
      setAuthToken(res.token, res.user?.role || payload?.role);
      if (res.user) setCurrentUser(res.user);
    }
    return res;
  },

  // Player Registration (PDF Module 2)
  registerPlayer: async (payload: {
    name: string;
    email: string;
    password?: string;
    mobile?: string;
    role?: string;
    category?: string;
    taluk?: string;
    battingStyle?: string;
    bowlingStyle?: string;
    bowlingArm?: string;
    bowlingCategory?: string;
    bowlingAction?: string;
    clubChoice?: string;
    otp?: string;
  }) => {
    const res = await request('/auth/register-player', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.token) {
      setAuthToken(res.token, 'PLAYER');
      if (res.user) setCurrentUser(res.user);
    }
    return res;
  },

  // Scorer Registration (PDF Module 5 & 10)
  registerScorer: async (payload: {
    name: string;
    email: string;
    password?: string;
    mobile?: string;
    taluk?: string;
    certificationLevel?: string;
    pin?: string;
    otp?: string;
  }) => {
    const res = await request('/auth/register-scorer', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.token) {
      setAuthToken(res.token, 'SCORER');
      if (res.user) setCurrentUser(res.user);
    }
    return res;
  },

  // Umpire Registration
  registerUmpire: async (payload: {
    name: string;
    email: string;
    password?: string;
    mobile?: string;
    dateOfBirth?: string;
    gender?: string;
    experience?: string;
    experienceYears?: number;
    qualification?: string;
    certificationNumber?: string;
    previousOrganization?: string;
    specialization?: string;
    address?: string;
    district?: string;
    state?: string;
    taluk?: string;
    certificationLevel?: string;
    profilePhoto?: string;
    additionalInfo?: string;
    pin?: string;
    otp?: string;
  }) => {
    const res = await request('/auth/register-umpire', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.token) {
      setAuthToken(res.token, 'UMPIRE');
      if (res.user) setCurrentUser(res.user);
    }
    return res;
  },

  // Content Staff Registration (PDF Module 7 & 10)
  registerContentStaff: async (payload: {
    name: string;
    email: string;
    password?: string;
    mobile?: string;
    specialization?: string;
    credentials?: string;
    otp?: string;
  }) => {
    const res = await request('/auth/register-content', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.token) {
      setAuthToken(res.token, 'CONTENT');
      if (res.user) setCurrentUser(res.user);
    }
    return res;
  },

  // Team Registration with 15 Squad Players (PDF Module 3)
  registerTeam: async (payload: {
    teamName: string;
    coachName: string;
    coachEmail: string;
    password?: string;
    taluk?: string;
    city?: string;
    players: Array<{ name: string; email: string; role?: string; jerseyNumber?: number }>;
    otp?: string;
  }) => {
    const res = await request('/auth/register-team', {

      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.token) {
      setAuthToken(res.token, 'TEAM');
      if (res.user) setCurrentUser(res.user);
    }
    return res;
  },

  getTeams: async (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return request(`/auth/teams${query}`);
  },

  getAllRegistrations: async (filter?: { status?: string; role?: string }) => {
    let q: string[] = [];
    if (filter?.status) q.push(`status=${encodeURIComponent(filter.status)}`);
    if (filter?.role) q.push(`role=${encodeURIComponent(filter.role)}`);
    const qs = q.length ? `?${q.join('&')}` : '';
    return request(`/auth/admin/all-registrations${qs}`);
  },

  approveRegistration: async (id: string, type: string = 'TEAM') => {
    return request('/auth/admin/approve-registration', {
      method: 'POST',
      body: JSON.stringify({ id, type })
    });
  },

  rejectRegistration: async (id: string, type: string = 'TEAM', reason?: string) => {
    return request('/auth/admin/reject-registration', {
      method: 'POST',
      body: JSON.stringify({ id, type, reason })
    });
  },

  updateScorerStatus: async (idOrEmail: string, status: string, reason?: string) => {
    return request('/auth/admin/scorer-status', {
      method: 'POST',
      body: JSON.stringify({ id: idOrEmail, email: idOrEmail, status, reason })
    });
  },

  updateUmpireStatus: async (idOrEmail: string, status: string, reason?: string) => {
    return request('/auth/admin/umpire-status', {
      method: 'POST',
      body: JSON.stringify({ id: idOrEmail, email: idOrEmail, status, reason })
    });
  },

  approveTeam: async (teamId: string) => {
    return request(`/auth/admin/teams/${teamId}/approve`, {
      method: 'POST'
    });
  },

  rejectTeam: async (teamId: string, reason?: string) => {
    return request(`/auth/admin/teams/${teamId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  getAdminNotifications: async (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return request(`/auth/admin/notifications${query}`);
  },

  getProfile: async () => {
    return request('/auth/me');
  },

  // --- DYNAMIC PUBLIC PORTAL APIs (MongoDB) ---
  getPortalHome: async () => {
    return request('/portal/home');
  },

  getPortalStats: async () => {
    return request('/portal/stats');
  },

  getPortalEvents: async () => {
    return request('/portal/events');
  },

  searchPortal: async (query: string) => {
    return request(`/portal/search?q=${encodeURIComponent(query)}`);
  },

  submitContact: async (data: { name: string; email: string; subject?: string; message: string }) => {
    return request('/portal/contact', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // --- NEWS & CONTENT APIs ---
  getNews: async (category?: string, search?: string) => {
    let q = [];
    if (category) q.push(`category=${encodeURIComponent(category)}`);
    if (search) q.push(`search=${encodeURIComponent(search)}`);
    const query = q.length ? `?${q.join('&')}` : '';
    return request(`/news${query}`);
  },

  getNewsById: async (id: string) => {
    return request(`/news/${id}`);
  },

  createNews: async (payload: any) => {
    return request('/news', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  deleteNews: async (id: string) => {
    return request(`/news/${id}`, {
      method: 'DELETE'
    });
  },

  // --- ADMIN & ASSOCIATION MANAGEMENT APIs ---
  getAdminOverview: async () => {
    return request('/admin/overview');
  },

  getAdminUsers: async (role?: string) => {
    const q = role ? `?role=${role}` : '';
    return request(`/admin/users${q}`);
  },

  updateUserStatus: async (userId: string, status: string) => {
    return request(`/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  getOfficials: async () => {
    return request('/admin/officials');
  },

  saveOfficial: async (data: any) => {
    return request('/admin/officials', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getVenues: async () => {
    return request('/admin/venues');
  },

  saveVenue: async (data: any) => {
    return request('/admin/venues', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  scheduleMatch: async (data: any) => {
    return request('/admin/matches/schedule', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateMatch: async (matchId: string, data: any) => {
    return request(`/admin/matches/${matchId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  cancelMatch: async (matchId: string, reason?: string) => {
    return request(`/admin/matches/${matchId}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason })
    });
  },

  postponeMatch: async (matchId: string, reason: string) => {
    return request(`/admin/matches/${matchId}/postpone`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  rescheduleMatch: async (matchId: string, newDate: string, newTime: string, reason?: string) => {
    return request(`/admin/matches/${matchId}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({ newDate, newTime, reason })
    });
  },

  getPostponementRequests: async () => {
    return request('/admin/matches/postponement-requests');
  },

  reviewPostponementRequest: async (matchId: string, decision: 'APPROVE' | 'REJECT', reviewNotes?: string) => {
    return request(`/admin/matches/${matchId}/postponement-requests/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, reviewNotes })
    });
  },

  deleteMatch: async (matchId: string) => {
    return request(`/admin/matches/${matchId}`, {
      method: 'DELETE'
    });
  },

  getTournaments: async (params?: { status?: string; search?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return request(`/tournaments${q ? '?' + q : ''}`);
  },

  getTournamentById: async (id: string) => {
    return request(`/tournaments/${id}`);
  },

  createTournament: async (data: any) => {
    return request('/tournaments', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateTournament: async (id: string, data: any) => {
    return request(`/tournaments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteTournament: async (id: string) => {
    return request(`/tournaments/${id}`, {
      method: 'DELETE'
    });
  },

  addTournamentTeams: async (id: string, teams: string[]) => {
    return request(`/tournaments/${id}/teams`, {
      method: 'POST',
      body: JSON.stringify({ teams })
    });
  },

  removeTournamentTeam: async (id: string, teamId: string) => {
    return request(`/tournaments/${id}/teams/${teamId}`, {
      method: 'DELETE'
    });
  },

  generateTournamentMatches: async (id: string, options?: any) => {
    return request(`/tournaments/${id}/generate-matches`, {
      method: 'POST',
      body: JSON.stringify(options || {})
    });
  },

  getTournamentSchedule: async (id: string) => {
    return request(`/tournaments/${id}/schedule`);
  },

  getTournamentPointsTable: async (id: string) => {
    return request(`/tournaments/${id}/points-table`);
  },

  getTournamentStatistics: async (id: string) => {
    return request(`/tournaments/${id}/statistics`);
  },

  updateTournamentStatus: async (id: string, status: string) => {
    return request(`/tournaments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  registerTeamForTournament: async (tournamentId: string, payloadOrNotes?: string | { notes?: string }) => {
    const notes = typeof payloadOrNotes === 'string' ? payloadOrNotes : payloadOrNotes?.notes;
    return request(`/tournaments/${tournamentId}/register`, {
      method: 'POST',
      body: JSON.stringify({ notes })
    });
  },

  getMyTournamentRegistrations: async () => {
    return request('/tournaments/my-registrations');
  },

  getAllTournamentRegistrations: async (params?: { tournamentId?: string; status?: string; search?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return request(`/tournaments/registrations/all${q ? '?' + q : ''}`);
  },

  approveTournamentRegistration: async (regId: string) => {
    return request(`/tournaments/registrations/${regId}/approve`, {
      method: 'PATCH'
    });
  },

  rejectTournamentRegistration: async (regId: string, reason?: string) => {
    return request(`/tournaments/registrations/${regId}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason })
    });
  },

  getTournamentApprovedTeams: async (tournamentId: string) => {
    return request(`/tournaments/${tournamentId}/approved-teams`);
  },

  getPublicMatches: async () => {
    return request('/matches');
  },

  getPublicScorecard: async (matchId: string) => {
    return request(`/matches/${matchId}/scorecard`);
  },

  getAuditLogs: async () => {
    return request('/admin/audit-logs');
  },

  adminLogin: async (email: string, password?: string) => {
    const res = await request('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (res.token) {
      setAuthToken(res.token, 'ADMIN');
      if (res.user) setCurrentUser(res.user);
    }
    return res;
  },

  getAdminTeams: async () => {
    return request('/admin/teams');
  },

  saveAdminTeam: async (data: any) => {
    return request('/admin/teams', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getAdminMatches: async () => {
    return request('/admin/matches');
  },

  deleteOfficial: async (id: string) => {
    return request(`/admin/officials/${id}`, {
      method: 'DELETE'
    });
  },

  deleteVenue: async (id: string) => {
    return request(`/admin/venues/${id}`, {
      method: 'DELETE'
    });
  },

  // --- DASHBOARD & MATCH MANAGEMENT ---
  getDashboard: async () => {
    return request('/scorer/dashboard');
  },

  getMatches: async (filter?: string) => {
    const query = filter ? `?filter=${filter}` : '';
    return request(`/scorer/matches${query}`);
  },

  getMatchSetup: async (matchId: string) => {
    return request(`/scorer/matches/${matchId}/setup`);
  },

  startMatch: async (matchId: string, setup: any) => {
    return request(`/scorer/matches/${matchId}/start`, {
      method: 'POST',
      body: JSON.stringify(setup)
    });
  },

  // --- LIVE SCORING ENGINE ---
  getLiveState: async (matchId: string) => {
    try {
      const res = await request(`/matches/${matchId}/live`);
      if (res && res.data) return res;
    } catch (_e) {}
    return request(`/scorer/matches/${matchId}/live`);
  },

  recordDelivery: async (matchId: string, delivery: any) => {
    const isOnline = typeof window !== 'undefined' && typeof window.navigator !== 'undefined' ? window.navigator.onLine : true;
    if (!isOnline) {
      OfflineQueue.enqueue(matchId, delivery);
      return {
        success: true,
        offlineQueued: true,
        message: 'Network offline. Delivery saved to local queue and will sync automatically.',
        queueCount: OfflineQueue.getQueue().length
      };
    }
    try {
      return await request(`/scorer/matches/${matchId}/deliveries`, {
        method: 'POST',
        body: JSON.stringify(delivery)
      });
    } catch (err: any) {
      if (
        (typeof window !== 'undefined' && !window.navigator?.onLine) ||
        err?.message?.includes('Network') ||
        err?.message?.includes('Failed to fetch') ||
        err?.message?.includes('Network request failed')
      ) {
        OfflineQueue.enqueue(matchId, delivery);
        return {
          success: true,
          offlineQueued: true,
          message: 'Connection dropped. Delivery queued offline.',
          queueCount: OfflineQueue.getQueue().length
        };
      }
      throw err;
    }
  },

  syncOfflineDeliveries: async () => {
    return await OfflineQueue.sync();
  },

  getOfflineQueueCount: () => {
    return OfflineQueue.getQueue().length;
  },

  undoDelivery: async (matchId: string) => {
    return request(`/scorer/matches/${matchId}/undo`, {
      method: 'POST'
    });
  },

  swapStrike: async (matchId: string) => {
    return request(`/scorer/matches/${matchId}/swap-strike`, {
      method: 'POST'
    });
  },

  changeBatter: async (matchId: string, payload: { target: 'striker' | 'nonStriker'; newBatterId?: string; newBatterName?: string }) => {
    return request(`/scorer/matches/${matchId}/change-batter`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  changeBowler: async (matchId: string, payload: { newBowlerId?: string; newBowlerName?: string; reason?: string; situation?: string; suspendCurrentBowler?: boolean }) => {
    return request(`/scorer/matches/${matchId}/change-bowler`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  endOver: async (matchId: string, nextBowlerId?: string) => {
    return request(`/scorer/matches/${matchId}/end-over`, {
      method: 'POST',
      body: JSON.stringify({ nextBowlerId })
    });
  },

  endInnings: async (matchId: string) => {
    return request(`/scorer/matches/${matchId}/end-innings`, {
      method: 'POST'
    });
  },

  startNextInnings: async (matchId: string) => {
    try {
      const res = await request(`/scorer/matches/${matchId}/start-next-innings`, { method: 'POST' });
      if (res && res.success) return res;
    } catch (_e) {}
    return request(`/scorer/matches/${matchId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'LIVE' })
    });
  },

  editDelivery: async (matchId: string, deliveryId: string, delivery: any) => {
    return request(`/scorer/matches/${matchId}/deliveries/${deliveryId}`, {
      method: 'PATCH',
      body: JSON.stringify(delivery)
    });
  },

  endMatch: async (matchId: string, payload?: any) => {
    return request(`/scorer/matches/${matchId}/end`, {
      method: 'POST',
      body: JSON.stringify(payload || {})
    });
  },

  setRevisedOvers: async (matchId: string, payload: { totalOvers?: number; revisedTarget?: number; comments?: string }) => {
    return request(`/scorer/matches/${matchId}/revised-overs`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },


  editPlayingXI: async (matchId: string, payload: { teamId: string; playingXI: string[] }) => {
    return request(`/scorer/matches/${matchId}/playing-xi`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  startSuperOver: async (matchId: string, payload?: { battingTeamId?: string; bowlingTeamId?: string }) => {
    return request(`/scorer/matches/${matchId}/super-over`, {
      method: 'POST',
      body: JSON.stringify(payload || {})
    });
  },

  addBreak: async (matchId: string, payload: any) => {
    return request(`/scorer/matches/${matchId}/breaks`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  endBreak: async (matchId: string) => {
    return request(`/scorer/matches/${matchId}/end-break`, {
      method: 'POST'
    });
  },

  addSession: async (matchId: string, payload: any) => {
    return request(`/scorer/matches/${matchId}/sessions`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  addEndDay: async (matchId: string, payload: any) => {
    return request(`/scorer/matches/${matchId}/end-day`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  declareInnings: async (matchId: string) => {
    return request(`/scorer/matches/${matchId}/declare-innings`, {
      method: 'POST'
    });
  },

  updateMatchTimes: async (matchId: string, payload: { date?: string; startTime?: string; endTime?: string }) => {
    return request(`/scorer/matches/${matchId}/match-times`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  addPenalty: async (matchId: string, payload: { points: number; type: string; reason: string; targetTeamName?: string; targetTeamId?: string }) => {
    return request(`/scorer/matches/${matchId}/penalty`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  recordOtherWicket: async (matchId: string, payload: { playerId: string; wicketType: string; comments?: string; replacementBatterId?: string }) => {
    return request(`/scorer/matches/${matchId}/other-wicket`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  recordBallChange: async (matchId: string, payload: { ballType: string; over?: string; time?: string; comments?: string }) => {
    return request(`/scorer/matches/${matchId}/change-ball`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  saveUmpireAssessment: async (matchId: string, payload: any) => {
    return request(`/scorer/matches/${matchId}/umpire-assessment`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  changeTeamBeforeStart: async (matchId: string, payload: { battingTeamId: string; strikerId: string; nonStrikerId: string; bowlerId: string }) => {
    return request(`/scorer/matches/${matchId}/change-team`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  updateMatchStatus: async (matchId: string, status: string) => {
    return request(`/scorer/matches/${matchId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  getUmpireDecisions: async (matchId: string) => {
    return request(`/scorer/matches/${matchId}/umpire-decisions`);
  },

  recordUmpireDecision: async (matchId: string, payload: any) => {
    return request(`/scorer/matches/${matchId}/umpire-decisions`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // --- AI FIELDING COMMENTARY ---
  getFieldingCommentary: async (matchId: string, data: { fieldingPosition: string; fielderId?: string; fielderName?: string }) => {
    return request(`/scorer/matches/${matchId}/fielding-commentary`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // --- SCORECARD ---
  getScorecard: async (matchId: string) => {
    return request(`/matches/${matchId}/scorecard`);
  },

  // --- REAL-TIME SOCKET.IO CONNECTION ---
  connectSocket: (matchId: string, onUpdate: (data: any) => void) => {
    if (currentSocket) {
      currentSocket.disconnect();
    }

    try {
      currentSocket = io(SOCKET_URL, {
        transports: ['websocket', 'polling']
      });

      currentSocket.on('connect', () => {
        currentSocket?.emit('join:match', matchId);
      });

      currentSocket.on('score:update', (payload) => {
        if (!payload.matchId || payload.matchId === matchId) {
          onUpdate(payload);
        }
      });

      return currentSocket;
    } catch (e) {
      console.warn('Socket.IO connection could not be established; falling back to REST.');
      return null;
    }
  },

  disconnectSocket: () => {
    if (currentSocket) {
      currentSocket.disconnect();
      currentSocket = null;
    }
  }
};

export const PlayerApi = {
  // --- PLAYER AUTHENTICATION ---
  register: async (payload: {
    name: string;
    email: string;
    mobile?: string;
    role?: string;
    category?: string;
    taluk?: string;
    battingStyle?: string;
    bowlingStyle?: string;
    clubChoice?: string;
  }) => {
    return request('/player/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  login: async (identifier: string) => {
    return request('/player/login', {
      method: 'POST',
      body: JSON.stringify({ nameOrEmail: identifier })
    });
  },

  verifyOtp: async (identifier: string, otp: string) => {
    const res = await request('/player/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ nameOrEmail: identifier, otp })
    });
    if (res.token) {
      setAuthToken(res.token, 'PLAYER');
      if (res.user) setCurrentUser(res.user);
    }
    return res;
  },

  // --- PROTECTED PLAYER OPERATIONS ---
  getProfile: async () => {
    return request('/player/profile');
  },

  updateProfile: async (updates: {
    battingStyle?: string;
    bowlingStyle?: string;
    jerseyNumber?: number;
    mobile?: string;
    taluk?: string;
    photo?: string | null;
    image_path?: string | null;
  }) => {
    return request('/player/profile', {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  },

  uploadPhoto: async (photo: string) => {
    return request('/player/upload-photo', {
      method: 'POST',
      body: JSON.stringify({ photo, image_path: photo })
    });
  },

  getTeam: async () => {
    return request('/player/team');
  },

  getMatches: async () => {
    return request('/player/matches');
  },

  getMatchById: async (id: string) => {
    return request(`/player/matches/${id}`);
  },

  getScorecard: async (id: string) => {
    try {
      const res = await request(`/player/matches/${id}/scorecard`);
      if (res && (res.scorecard || res.data)) return res;
    } catch (_e) {}
    return request(`/matches/${id}/scorecard`);
  },

  getStatistics: async () => {
    return request('/player/statistics');
  },

  getNotifications: async () => {
    return request('/player/notifications');
  },

  getCareerRatings: async (playerId?: string) => {
    return request(playerId ? `/players/${playerId}/career-ratings` : '/player/career-ratings');
  },

  getPlayerForm: async (playerId?: string, matches: number = 5) => {
    return request(playerId ? `/players/${playerId}/form?matches=${matches}` : `/player/form?matches=${matches}`);
  },

  getPlayerRatings: async (playerId?: string) => {
    return request(playerId ? `/players/${playerId}/ratings` : '/player/ratings');
  },

  getRatingsLeaderboard: async (params?: { category?: string; format?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.category) query.append('category', params.category);
    if (params?.format) query.append('format', params.format);
    if (params?.limit) query.append('limit', String(params.limit));
    const qs = query.toString();
    return request(`/players/leaderboards/ratings${qs ? `?${qs}` : ''}`);
  },

  logout: async () => {
    return ScorerApi.logout();
  }
};

export const TeamApi = {
  // --- TEAM REGISTRATION & AUTHENTICATION ---
  register: async (payload: {
    teamName: string;
    coachName: string;
    coachEmail: string;
    taluk?: string;
    city?: string;
    players: Array<{ name: string; email: string; role?: string; jerseyNumber?: number }>;
  }) => {
    return request('/team/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  login: async (coachName: string, coachEmail: string) => {
    return request('/team/login', {
      method: 'POST',
      body: JSON.stringify({ coachName, coachEmail })
    });
  },

  verifyOtp: async (coachEmail: string, otp: string) => {
    const res = await request('/team/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ coachEmail, otp })
    });
    if (res.token) {
      setAuthToken(res.token, 'TEAM');
      if (res.user) setCurrentUser(res.user);
    }
    return res;
  },

  // --- PROTECTED TEAM OPERATIONS ---
  getProfile: async () => {
    return request('/team/profile');
  },

  updateProfile: async (updates: {
    coachPhone?: string;
    certification?: string;
    homeGround?: string;
    captain?: string;
    viceCaptain?: string;
    teamLogo?: string;
  }) => {
    return request('/team/profile', {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  },

  getSquad: async () => {
    return request('/team/squad');
  },

  getMatches: async () => {
    return request('/team/matches');
  },

  getMatchById: async (id: string) => {
    return request(`/team/matches/${id}`);
  },

  getScorecard: async (id: string) => {
    try {
      const res = await request(`/team/matches/${id}/scorecard`);
      if (res && (res.scorecard || res.data)) return res;
    } catch (_e) {}
    return request(`/matches/${id}/scorecard`);
  },

  getStatistics: async () => {
    return request('/team/statistics');
  },

  getPlayerStatistics: async () => {
    return request('/team/players/statistics');
  },

  getNotifications: async () => {
    return request('/team/notifications');
  },

  markNotificationRead: async (id: string) => {
    return request(`/team/notifications/${id}/read`, {
      method: 'PUT'
    });
  },

  // --- TOURNAMENTS & REGISTRATION ---
  getTournaments: async (params?: { status?: string; search?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return request(`/tournaments${q ? '?' + q : ''}`);
  },

  registerForTournament: async (tournamentId: string, payloadOrNotes?: string | { notes?: string }) => {
    const notes = typeof payloadOrNotes === 'string' ? payloadOrNotes : payloadOrNotes?.notes;
    return request(`/tournaments/${tournamentId}/register`, {
      method: 'POST',
      body: JSON.stringify({ notes })
    });
  },

  getMyRegistrations: async () => {
    return request('/tournaments/my-registrations');
  },

  getTournamentApprovedTeams: async (tournamentId: string) => {
    return request(`/tournaments/${tournamentId}/approved-teams`);
  }
};

export const UmpireApi = {
  // --- UMPIRE PROFILE ---
  getProfile: async () => {
    return request('/umpire/profile');
  },

  updateProfile: async (payload: {
    mobile?: string;
    taluk?: string;
    certificationLevel?: string;
    experienceYears?: number;
    name?: string;
  }) => {
    return request('/umpire/profile', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  // --- ASSIGNED MATCHES ---
  getMatches: async (filter?: string) => {
    const q = filter ? `?filter=${encodeURIComponent(filter)}` : '';
    return request(`/umpire/matches${q}`);
  },

  // --- MATCH SUPERVISION & DETAILS ---
  getMatchById: async (matchId: string) => {
    return request(`/umpire/matches/${matchId}`);
  },

  // --- MATCH CONTROL ---
  startMatch: async (matchId: string, payload?: { tossWinner?: string; tossWinnerId?: string; tossDecision?: string }) => {
    return request(`/umpire/matches/${matchId}/start`, {
      method: 'PUT',
      body: JSON.stringify(payload || {})
    });
  },

  updateMatchStatus: async (matchId: string, status: string, reason?: string) => {
    return request(`/umpire/matches/${matchId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, reason })
    });
  },

  requestPostponement: async (matchId: string, reasonOrPayload: string | { reason: string; notes?: string }, notes?: string) => {
    const bodyObj = typeof reasonOrPayload === 'string'
      ? { reason: reasonOrPayload, notes }
      : reasonOrPayload;
    return request(`/umpire/matches/${matchId}/request-postponement`, {
      method: 'POST',
      body: JSON.stringify(bodyObj)
    });
  },

  // --- UMPIRE DECISIONS ---
  recordDecision: async (
    matchId: string,
    decision: {
      decisionType: string;
      description?: string;
      inning?: number;
      over?: number;
      ball?: number;
    }
  ) => {
    return request(`/umpire/matches/${matchId}/decisions`, {
      method: 'POST',
      body: JSON.stringify(decision)
    });
  },

  getDecisions: async (matchId: string) => {
    return request(`/umpire/matches/${matchId}/decisions`);
  },

  // --- CONFIRM RESULT ---
  confirmResult: async (
    matchId: string,
    payload: {
      resultSummary?: string;
      result?: string;
      notes?: string;
      playerOfMatch?: string;
    }
  ) => {
    return request(`/umpire/matches/${matchId}/result`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  logout: async () => {
    return ScorerApi.logout();
  }
};

export const authService = ScorerApi;

