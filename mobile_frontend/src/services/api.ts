/**
 * src/services/api.ts
 * Frontend REST API & Socket.IO Client for Cricket Scorer & Association Management System
 * Connected to pure MongoDB backend.
 */

import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';

// Determine backend host
const getBaseUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const host = window.location.hostname || 'localhost';
    return `http://${host}:5000/api`;
  }
  return 'http://10.0.2.2:5000/api'; // Android Emulator alias or fallback
};

const getSocketUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const host = window.location.hostname || 'localhost';
    return `http://${host}:5000`;
  }
  return 'http://10.0.2.2:5000';
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

export const setAuthToken = (newToken: string | null) => {
  token = newToken;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (newToken) {
      localStorage.setItem('auth_token', newToken);
      localStorage.setItem('team_token', newToken);
      localStorage.setItem('cfvd_admin_token', newToken);
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
      if (user.role === 'ADMIN') {
        localStorage.setItem('cfvd_admin_user', JSON.stringify(user));
      }
      if (user.role === 'COACH' || user.role === 'TEAM' || user.teamId) {
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

  try {
    const res = await fetch(url, {
      credentials: 'include',
      ...options,
      headers: { ...headers, ...(options.headers as any) }
    });

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
    console.warn(`API Error on ${endpoint}:`, err?.message || err);
    if (
      err.message === 'Failed to fetch' ||
      err.message === 'Network request failed' ||
      err.message?.includes('ERR_CONNECTION_REFUSED') ||
      err.message?.includes('ECONNREFUSED')
    ) {
      const friendly = new Error(
        'Cannot connect to the backend server (port 5000). Please make sure the backend is running. Start it with: cd backend && node server.js'
      );
      (friendly as any).isNetworkError = true;
      throw friendly;
    }
    throw err;
  }
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
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch (_e) {}
    setAuthToken(null);
    setCurrentUser(null);
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

  loginWithPassword: async (email: string, password: string, role?: string) => {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, role })
    });
    if (res.token) {
      setAuthToken(res.token);
      if (res.user) setCurrentUser(res.user);
    }
    return res;
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
      setAuthToken(res.token);
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
      setAuthToken(res.token);
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
    clubChoice?: string;
    otp?: string;
  }) => {
    const res = await request('/auth/register-player', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.token) {
      setAuthToken(res.token);
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
      setAuthToken(res.token);
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
      setAuthToken(res.token);
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
      setAuthToken(res.token);
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
      setAuthToken(res.token);
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

  deleteMatch: async (matchId: string) => {
    return request(`/admin/matches/${matchId}`, {
      method: 'DELETE'
    });
  },

  getTournaments: async () => {
    return request('/admin/tournaments');
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
      setAuthToken(res.token);
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
    return request(`/scorer/matches/${matchId}/deliveries`, {
      method: 'POST',
      body: JSON.stringify(delivery)
    });
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

  changeBowler: async (matchId: string, payload: { newBowlerId?: string; newBowlerName?: string }) => {
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

  addPenalty: async (matchId: string, payload: { points: number; type: string; reason: string }) => {
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
      setAuthToken(res.token);
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
  }) => {
    return request('/player/profile', {
      method: 'PUT',
      body: JSON.stringify(updates)
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
    return request(`/player/matches/${id}/scorecard`);
  },

  getStatistics: async () => {
    return request('/player/statistics');
  },

  getNotifications: async () => {
    return request('/player/notifications');
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
      setAuthToken(res.token);
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
    return request(`/team/matches/${id}/scorecard`);
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

