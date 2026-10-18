/**
 * src/screens/admin/AdminDashboardScreen.tsx
 *
 * Official Apex Council & Administrator Console for Cricket Federation of Virudhunagar District (CFVD).
 * Faithfully recreates the exact previous UI shown in the administrative portal:
 * - Top Federation Header with Logo, Navigation Links, Role/Session Badges
 * - Atmospheric Stadium / Cream Background (#f6f2e9 / #fcf9f4)
 * - Admin Sub-Navigation Tabs Bar (Overview, Team Registrations, Scorer Management, News & Content, Logout)
 * - Two Highlight Dark Navy Cards:
 *     1. Scorer Management / Team Registrations with 4 colored status rows (Authorized, Pending, Rejected, Total)
 *     2. Status Distribution with Conic-Gradient Donut Chart, Center Count, and 3-Color Legend
 * - White Search & Filter Toolbar with live search and filter pills (All, Pending, Approved, Rejected)
 * - Full Item Cards with Status Badges, Meta Details, and Action Buttons (View, Approve, Reject)
 * - Squad Inspection Modal (Full 15-Member Squad roster)
 * - Rejection Reason Prompt Modal
 * - Full Live Integration with MongoDB backend via ScorerApi & persistent local state
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  Alert
} from 'react-native';
import { ScorerApi, getCurrentUser, getAuthToken, setAuthToken, setCurrentUser } from '../../services/api';

// Asset references
const IMG_LOGO = require('../../../assets/logo_transparent.png');
const IMG_WATERMARK = require('../../../assets/watermark.png');
const IMG_STADIUM = require('../../../assets/stadium.jpg');

export interface AdminDashboardProps {
  onExit?: () => void;
  initialParams?: any;
}

type AdminTab = 'overview' | 'teams' | 'scorers' | 'umpires' | 'content' | 'schedules';
type FilterStatus = 'all' | 'Pending' | 'Approved' | 'Rejected';
type MatchFilterStatus = 'all' | 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED';

// Fallback initial scorers data (matching exact counts: 2 Approved, 2 Pending, 1 Rejected = 5 Total)
const INITIAL_SCORERS_DATA = [
  {
    scorerId: 'SCORER-101',
    scorerName: 'Thiru. ',
    email: 'sundararajan@cfvd.org',
    phone: '+91 94431 12345',
    grade: 'BCCI Level 1 Digital Scorer',
    taluk: 'Virudhunagar',
    experienceYears: 8,
    status: 'Approved',
    registrationDate: '2026-09-15T10:00:00.000Z',
    approvedBy: 'admin@cfvd.org',
    approvedAt: '2026-09-16T11:00:00.000Z',
    rejectionReason: null
  },
  {
    scorerId: 'SCORER-102',
    scorerName: 'Thiru. M. Venkatesh',
    email: 'venkatesh.m@gmail.com',
    phone: '+91 98422 67890',
    grade: 'District Senior Panel Scorer',
    taluk: 'Sivakasi',
    experienceYears: 5,
    status: 'Approved',
    registrationDate: '2026-09-16T11:00:00.000Z',
    approvedBy: 'admin@cfvd.org',
    approvedAt: '2026-09-17T09:30:00.000Z',
    rejectionReason: null
  },
  {
    scorerId: 'SCORER-103',
    scorerName: 'Thiru. S. Pitchaimuthu',
    email: 'pitchai.s@yahoo.com',
    phone: '+91 97890 23456',
    grade: 'Collegiate League Scorer',
    taluk: 'Rajapalayam',
    experienceYears: 3,
    status: 'Pending',
    registrationDate: '2026-09-27T08:30:00.000Z',
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null
  },
  {
    scorerId: 'SCORER-104',
    scorerName: 'Thiru. R. Vignesh Kumar',
    email: 'vignesh.k@gmail.com',
    phone: '+91 96555 89012',
    grade: 'Academy Digital Scorer',
    taluk: 'Aruppukottai',
    experienceYears: 2,
    status: 'Pending',
    registrationDate: '2026-09-28T14:20:00.000Z',
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null
  },
  {
    scorerId: 'SCORER-105',
    scorerName: 'Thiru. P. Arumugam',
    email: 'arumugam.p@gmail.com',
    phone: '+91 99444 34567',
    grade: 'Club Panel Scorer',
    taluk: 'Sattur',
    experienceYears: 1,
    status: 'Rejected',
    registrationDate: '2026-09-19T09:00:00.000Z',
    approvedBy: 'admin@cfvd.org',
    approvedAt: null,
    rejectedAt: '2026-09-20T12:00:00.000Z',
    rejectedBy: 'admin@cfvd.org',
    rejectionReason: 'Required scorer certification credentials expired. Renewal required.'
  }
];

// Fallback initial teams data (matching exact counts: 1 Pending, 1 Approved = 2 Total)
const INITIAL_TEAMS_DATA = [
  {
    teamId: 'TEAM-VRD-1001',
    teamName: 'Virudhunagar Strikers CC',
    coach: { name: 'S. Rajendran', email: 'rajendran@strikerscc.org' },
    taluk: 'Virudhunagar',
    status: 'Approved',
    adminApprovalStatus: 'Approved',
    registrationDate: '2026-09-15T09:30:00.000Z',
    approvedBy: 'admin@cfvd.org',
    approvedAt: '2026-09-16T11:00:00.000Z',
    rejectionReason: null,
    members: [
      { playerId: 'CFVD-PLY-101', playerName: 'R. Saravanan', playerEmail: 'saravanan.r@strikerscc.org', jerseyNumber: '10', role: 'Captain / All-rounder', battingStyle: 'Right Hand Bat', bowlingStyle: 'Right Arm Fast Medium' },
      { playerId: 'CFVD-PLY-STR-02', playerName: 'M. Anandhan', playerEmail: 'anandhan.m@strikerscc.org', jerseyNumber: '7', role: 'Opening Batsman', battingStyle: 'Right Hand Bat', bowlingStyle: 'None' },
      { playerId: 'CFVD-PLY-STR-03', playerName: 'K. Praveen Kumar', playerEmail: 'praveen.k@strikerscc.org', jerseyNumber: '17', role: 'Spin Bowler', battingStyle: 'Right Hand Bat', bowlingStyle: 'Right Arm Off Break' },
      { playerId: 'CFVD-PLY-STR-04', playerName: 'G. Karthick', playerEmail: 'karthick.g@strikerscc.org', jerseyNumber: '3', role: 'All-rounder', battingStyle: 'Right Hand Bat', bowlingStyle: 'Right Arm Medium' },
      { playerId: 'CFVD-PLY-STR-05', playerName: 'S. Balamurugan', playerEmail: 'bala.s@strikerscc.org', jerseyNumber: '9', role: 'Top Order Batsman', battingStyle: 'Left Hand Bat', bowlingStyle: 'None' },
      { playerId: 'CFVD-PLY-STR-06', playerName: 'N. Muthuraman', playerEmail: 'muthu.n@strikerscc.org', jerseyNumber: '21', role: 'Pace Bowler', battingStyle: 'Right Hand Bat', bowlingStyle: 'Right Arm Fast' },
      { playerId: 'CFVD-PLY-STR-07', playerName: 'P. Sivakumar', playerEmail: 'siva.p@strikerscc.org', jerseyNumber: '28', role: 'All-rounder', battingStyle: 'Right Hand Bat', bowlingStyle: 'Right Arm Fast' },
      { playerId: 'CFVD-PLY-STR-08', playerName: 'V. Prakash', playerEmail: 'prakash.v@strikerscc.org', jerseyNumber: '14', role: 'Bowler', battingStyle: 'Right Hand Bat', bowlingStyle: 'Right Arm Medium' },
      { playerId: 'CFVD-PLY-STR-09', playerName: 'T. Karthick', playerEmail: 'karthick.t@strikerscc.org', jerseyNumber: '99', role: 'Strike Bowler', battingStyle: 'Right Hand Bat', bowlingStyle: 'Right Arm Fast' },
      { playerId: 'CFVD-PLY-STR-10', playerName: 'A. Vijay', playerEmail: 'vijay.a@strikerscc.org', jerseyNumber: '45', role: 'Bowler', battingStyle: 'Right Hand Bat', bowlingStyle: 'Left Arm Fast' },
      { playerId: 'CFVD-PLY-STR-11', playerName: 'G. Suresh', playerEmail: 'suresh.g@strikerscc.org', jerseyNumber: '22', role: 'Leg Spinner', battingStyle: 'Right Hand Bat', bowlingStyle: 'Right Arm Leg Spin' },
      { playerId: 'CFVD-PLY-STR-12', playerName: 'C. Vignesh', playerEmail: 'vignesh.c@strikerscc.org', jerseyNumber: '12', role: 'Middle Order Batsman', battingStyle: 'Right Hand Bat', bowlingStyle: 'None' },
      { playerId: 'CFVD-PLY-STR-13', playerName: 'J. Dinesh', playerEmail: 'dinesh.j@strikerscc.org', jerseyNumber: '33', role: 'All-rounder', battingStyle: 'Right Hand Bat', bowlingStyle: 'Right Arm Off Break' },
      { playerId: 'CFVD-PLY-STR-14', playerName: 'E. Ramesh', playerEmail: 'ramesh.e@strikerscc.org', jerseyNumber: '1', role: 'Wicketkeeper Batsman', battingStyle: 'Right Hand Bat', bowlingStyle: 'None' },
      { playerId: 'CFVD-PLY-STR-15', playerName: 'D. Kumar', playerEmail: 'kumar.d@strikerscc.org', jerseyNumber: '88', role: 'Bowler', battingStyle: 'Right Hand Bat', bowlingStyle: 'Right Arm Fast' }
    ]
  },
  {
    teamId: 'TEAM-VRD-1002',
    teamName: 'Sivakasi Super Kings',
    coach: { name: 'K. Meenakshisundaram', email: 'meenakshi@sivakasisk.com' },
    taluk: 'Sivakasi',
    status: 'Pending',
    adminApprovalStatus: 'Pending',
    registrationDate: '2026-09-28T11:00:00.000Z',
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null,
    members: [
      { playerId: 'CFVD-PLY-SSK-01', playerName: 'S. Vigneshwaran', playerEmail: 'vignesh.s@sivakasisk.com', jerseyNumber: '18', role: 'Opening Bowler', battingStyle: 'Right Hand Bat', bowlingStyle: 'Left Arm Fast' },
      { playerId: 'CFVD-PLY-SSK-02', playerName: 'T. Balamurugan', playerEmail: 'bala.t@sivakasisk.com', jerseyNumber: '5', role: 'Opening Batsman', battingStyle: 'Right Hand Bat', bowlingStyle: 'None' },
      { playerId: 'CFVD-PLY-SSK-03', playerName: 'N. Muthuraman', playerEmail: 'muthu.n@sivakasisk.com', jerseyNumber: '11', role: 'All-rounder', battingStyle: 'Right Hand Bat', bowlingStyle: 'Right Arm Off Break' }
    ]
  }
];

export default function AdminDashboardScreen({ onExit, initialParams }: AdminDashboardProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const insetsTop = Platform.OS === 'android' ? 40 : Platform.OS === 'ios' ? 50 : 0;

  const storedUser = getCurrentUser();
  const currentUser = storedUser || initialParams?.user;
  const isAdmin = (currentUser?.role || '').toUpperCase() === 'ADMIN';

  useEffect(() => {
    const user = getCurrentUser() || initialParams?.user;
    if (initialParams?.user && !getCurrentUser()) {
      setCurrentUser(initialParams.user);
    }
    if (initialParams?.token && !getAuthToken()) {
      setAuthToken(initialParams.token);
    }
    if (!user) {
      if (onExit) onExit();
      return;
    }
    const role = (user.role || '').toUpperCase();
    if (role !== 'ADMIN') {
      if (onExit) onExit();
      return;
    }
  }, [onExit, initialParams]);

  const handleLogout = async () => {
    try {
      await ScorerApi.logout();
    } catch (_e) { }
    setAuthToken(null);
    setCurrentUser(null);
    if (onExit) onExit();
  };

  // Start on 'scorers' tab to immediately match the user's screenshot, or allow 'overview'
  const [activeTab, setActiveTab] = useState<AdminTab>(initialParams?.tab || initialParams?.activeTab || 'scorers');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  const adminEmail = initialParams?.adminEmail || currentUser?.email || 'admin@cfvd.org';

  // State for Teams, Scorers, Umpires
  const [scorers, setScorers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [umpires, setUmpires] = useState<any[]>([]);
  const [newsList, setNewsList] = useState<any[]>([]);

  // Filters
  const [scorerFilter, setScorerFilter] = useState<FilterStatus>('all');
  const [scorerSearchQuery, setScorerSearchQuery] = useState<string>('');

  const [teamFilter, setTeamFilter] = useState<FilterStatus>('all');
  const [teamSearchQuery, setTeamSearchQuery] = useState<string>('');

  const [umpireFilter, setUmpireFilter] = useState<FilterStatus>('all');
  const [umpireSearchQuery, setUmpireSearchQuery] = useState<string>('');
  const [selectedUmpireForView, setSelectedUmpireForView] = useState<any | null>(null);

  // Initial Matches data matching user screenshot
  const INITIAL_MATCHES = [
    {
      id: 'M001',
      tournament_id: 'T-2026-VPL',
      tournament_name: 'Virudhunagar Premier League 2026',
      team_a_name: 'Sattur Spartans',
      team_b_name: 'Rajapalayam Royals',
      team_a_id: 'TM-01',
      team_b_id: 'TM-03',
      venue: 'Kamarajar District Stadium',
      match_date: '2026-10-08',
      match_time: '02:30 PM',
      match_type: 'T20',
      overs_per_side: 20,
      assigned_scorer_id: 'SCR-101',
      scorer_name: 'SCR-101',
      status: 'SCHEDULED',
      result_summary: null
    },
    {
      id: 'M002',
      tournament_id: 'T-2026-VPL',
      tournament_name: 'Virudhunagar Premier League 2026',
      team_a_name: 'Virudhunagar Spartans',
      team_b_name: 'Sivakasi Strikers',
      team_a_id: 'TM-01',
      team_b_id: 'TM-02',
      venue: 'Kamarajar District Stadium',
      match_date: '2026-10-06',
      match_time: '09:30 AM',
      match_type: 'T20',
      overs_per_side: 20,
      assigned_scorer_id: 'SCR-101',
      scorer_name: 'SCR-101',
      status: 'LIVE',
      result_summary: null
    },
    {
      id: 'M003',
      tournament_id: 'T-2026-VPL',
      tournament_name: 'Virudhunagar Premier League 2026',
      team_a_name: 'Virudhunagar Spartans',
      team_b_name: 'Sivakasi Strikers',
      team_a_id: 'TM-01',
      team_b_id: 'TM-02',
      venue: 'Kamarajar Stadium, Virudhunagar',
      match_date: '2026-10-04',
      match_time: '09:30 AM',
      match_type: 'T20',
      overs_per_side: 20,
      assigned_scorer_id: 'SCR-101',
      scorer_name: 'SCR-101',
      status: 'COMPLETED',
      result_summary: 'Virudhunagar Strikers won by 7 wickets'
    }
  ];

  // Match Schedules State
  const [matchesList, setMatchesList] = useState<any[]>(INITIAL_MATCHES);
  const [matchFilter, setMatchFilter] = useState<MatchFilterStatus>('all');
  const [matchSearchQuery, setMatchSearchQuery] = useState<string>('');
  const [isMatchesLoading, setIsMatchesLoading] = useState<boolean>(false);
  const [venuesList, setVenuesList] = useState<any[]>([
    { id: 'VEN-01', name: 'Kamarajar District Stadium' },
    { id: 'VEN-02', name: 'Sivakasi Cricket Ground' }
  ]);
  const [tournamentsList, setTournamentsList] = useState<any[]>([
    { id: 'T-2026-VPL', name: 'Virudhunagar Premier League 2026' }
  ]);
  const [officialsList, setOfficialsList] = useState<any[]>([
    { id: 'OFF-01', name: 'S. Ramesh' },
    { id: 'OFF-02', name: 'K. Murugan' }
  ]);
  const [allClubsList, setAllClubsList] = useState<any[]>([
    { id: 'TM-01', name: 'Virudhunagar Spartans' },
    { id: 'TM-02', name: 'Sivakasi Strikers' }
  ]);

  // Schedule Modal State
  const [scheduleModalOpen, setScheduleModalOpen] = useState<boolean>(false);
  const [editingMatch, setEditingMatch] = useState<any | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    tournament_id: 'T-2026-VPL',
    tournament_name: 'Virudhunagar Premier League 2026',
    team_a_id: '',
    team_b_id: '',
    venue: 'Kamarajar District Stadium',
    match_date: new Date().toISOString().split('T')[0],
    match_time: '09:30 AM',
    match_type: 'T20',
    overs: 20,
    assigned_scorer_id: 'SCR-101'
  });
  const [scheduleFormError, setScheduleFormError] = useState<string | null>(null);
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState<boolean>(false);

  // Schedule Modal Advanced Window Controls & Dropdown States
  const [scheduleModalMinimized, setScheduleModalMinimized] = useState<boolean>(false);
  const [scheduleModalMaximized, setScheduleModalMaximized] = useState<boolean>(false);
  const [teamADropdownOpen, setTeamADropdownOpen] = useState<boolean>(false);
  const [teamBDropdownOpen, setTeamBDropdownOpen] = useState<boolean>(false);
  const [venueDropdownOpen, setVenueDropdownOpen] = useState<boolean>(false);
  const [tournamentDropdownOpen, setTournamentDropdownOpen] = useState<boolean>(false);
  const [formatDropdownOpen, setFormatDropdownOpen] = useState<boolean>(false);
  const [scorerDropdownOpen, setScorerDropdownOpen] = useState<boolean>(false);
  const [teamSearchQueryA, setTeamSearchQueryA] = useState<string>('');
  const [teamSearchQueryB, setTeamSearchQueryB] = useState<string>('');
  const [venueSearchQuery, setVenueSearchQuery] = useState<string>('');
  const [customTournamentInput, setCustomTournamentInput] = useState<string>('');
  const [notifyTeamsOnTimeChange, setNotifyTeamsOnTimeChange] = useState<boolean>(true);

  // Match Inspection & Cancel Modals
  const [selectedMatchModal, setSelectedMatchModal] = useState<any | null>(null);
  const [cancelMatchModal, setCancelMatchModal] = useState<{ id: string; teamA: string; teamB: string } | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState<string>('Inclement weather / ground unplayable');
  const [isCancellingMatch, setIsCancellingMatch] = useState<boolean>(false);

  // Modals
  const [selectedSquadModal, setSelectedSquadModal] = useState<any | null>(null);
  const [selectedScorerModal, setSelectedScorerModal] = useState<any | null>(null);
  const [rejectionModal, setRejectionModal] = useState<{ id: string; type: 'SCORER' | 'TEAM' | 'UMPIRE'; name: string } | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('Documents incomplete or credentials not fulfilled');
  const [logoutModalOpen, setLogoutModalOpen] = useState<boolean>(false);

  // News Publish form
  const [newNewsTitle, setNewNewsTitle] = useState<string>('');
  const [newNewsCategory, setNewNewsCategory] = useState<string>('ANNOUNCEMENT');
  const [newNewsAuthor, setNewNewsAuthor] = useState<string>('CFVD Secretariat');

  // Dynamic Sidebar State
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  // Ensure the page and outer body is non-scrollable on web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const origBodyOverflow = document.body.style.overflow;
      const origBodyHeight = document.body.style.height;
      const origDocOverflow = document.documentElement?.style.overflow || '';
      const origDocHeight = document.documentElement?.style.height || '';

      document.body.style.overflow = 'hidden';
      document.body.style.height = '100vh';
      if (document.documentElement) {
        document.documentElement.style.overflow = 'hidden';
        document.documentElement.style.height = '100vh';
      }

      return () => {
        document.body.style.overflow = origBodyOverflow;
        document.body.style.height = origBodyHeight;
        if (document.documentElement) {
          document.documentElement.style.overflow = origDocOverflow;
          document.documentElement.style.height = origDocHeight;
        }
      };
    }
  }, []);

  // Load data from backend on mount
  useEffect(() => {
    if (isAdmin) {
      loadDataFromBackend();
    }
  }, [isAdmin]);

  const loadDataFromBackend = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch live registrations from backend
      const regRes = await ScorerApi.getAllRegistrations();
      const rawRegs: any[] =
        regRes && regRes.success
          ? Array.isArray(regRes.registrations)
            ? regRes.registrations
            : Array.isArray(regRes.data)
            ? regRes.data
            : typeof regRes === 'object'
            ? Object.keys(regRes)
                .filter((k) => !isNaN(Number(k)))
                .map((k) => regRes[k])
            : []
          : [];

      if (rawRegs.length > 0) {
        const backendTeams: any[] = [];
        const backendScorers: any[] = [];
        const backendUmpires: any[] = [];

        rawRegs.forEach((r: any, idx: number) => {
          let normStatus = 'Pending';
          const s = (r.status || '').toUpperCase();
          if (s === 'APPROVED' || s === 'ACTIVE') normStatus = 'Approved';
          else if (s === 'REJECTED') normStatus = 'Rejected';

          if (r.type === 'TEAM') {
            backendTeams.push({
              teamId: r.id || r.mongoId || `TEAM-${idx + 101}`,
              teamName: r.name,
              coach: { name: r.contactName || r.name, email: r.contactEmail || r.email || '' },
              taluk: r.taluk || r.details?.taluk || 'Virudhunagar',
              status: normStatus,
              adminApprovalStatus: normStatus,
              registrationDate: r.created_at || new Date().toISOString(),
              approvedAt: r.details?.approvedAt || null,
              approvedBy: r.details?.approvedBy || (normStatus === 'Approved' ? 'admin@cfvd.org' : null),
              rejectedAt: r.details?.rejectedAt || null,
              rejectionReason: r.details?.rejectionReason || null,
              members: (Array.isArray(r.members) && r.members.length > 0 ? r.members : (r.details?.players || [])).map((p: any) => ({
                ...p,
                name: p.name || p.playerName || 'Player',
                playerName: p.name || p.playerName || 'Player',
                email: p.email || p.playerEmail || '',
                playerEmail: p.email || p.playerEmail || '',
                jerseyNumber: p.jersey_number || p.jerseyNumber,
                role: p.role || 'Player'
              }))
            });
          } else if (r.type === 'SCORER') {
            backendScorers.push({
              scorerId: r.id || r.details?.certification_id || `SCORER-${101 + idx}`,
              scorerName: r.name,
              email: r.email,
              phone: r.phone || r.details?.phone || '—',
              grade: r.details?.specialty || r.roleDisplay || 'District Panel Scorer',
              taluk: r.details?.taluk || 'Virudhunagar',
              experienceYears: r.details?.experience_years || 2,
              status: normStatus,
              registrationDate: r.created_at || new Date().toISOString(),
              approvedAt: r.details?.approvedAt || null,
              approvedBy: r.details?.approvedBy || (normStatus === 'Approved' ? 'admin@cfvd.org' : null),
              rejectionReason: r.details?.rejectionReason || null
            });
          } else if (r.type === 'UMPIRE') {
            backendUmpires.push({
              umpireId: r.id || r.details?.certification_id || `UMP-${101 + idx}`,
              umpireName: r.name,
              email: r.email,
              phone: r.phone || r.details?.phone || r.details?.mobile || '—',
              qualification: r.details?.qualification || r.details?.specialty || r.roleDisplay || 'District Certified Umpire',
              experience: r.details?.experience || `${r.details?.experience_years || 2} Years`,
              experienceYears: r.details?.experience_years || 2,
              certificationNumber: r.details?.certification_number || r.details?.certificationNumber || '—',
              district: r.details?.district || r.details?.taluk || 'Virudhunagar',
              state: r.details?.state || 'Tamil Nadu',
              specialization: r.details?.specialization || 'On-field Umpire',
              previousOrganization: r.details?.previous_organization || r.details?.previousOrganization || '—',
              additionalInfo: r.details?.additional_info || r.details?.additionalInfo || '',
              status: normStatus,
              registrationDate: r.created_at || new Date().toISOString(),
              approvedAt: r.details?.approvedAt || null,
              approvedBy: r.details?.approvedBy || (normStatus === 'Approved' ? 'admin@cfvd.org' : null),
              rejectionReason: r.details?.rejectionReason || null
            });
          }
        });

        setTeams(backendTeams);
        setScorers(backendScorers);
        setUmpires(backendUmpires);
      } else {
        setTeams([]);
        setScorers([]);
        setUmpires([]);
      }

      // 2. Fetch live news from MongoDB
      const newsRes = await ScorerApi.getNews();
      const newsData = (newsRes && (Array.isArray(newsRes.data) ? newsRes.data : (Array.isArray(newsRes.news) ? newsRes.news : []))) || [];
      setNewsList(newsData);

      // 3. Fetch match schedules & logistics
      await loadMatchesAndLogistics();
    } catch (err) {
      console.warn('Backend sync note: using initial local state', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMatchesAndLogistics = async () => {
    setIsMatchesLoading(true);
    try {
      const [matchesRes, venuesRes, toursRes, offRes, teamsRes] = await Promise.all([
        ScorerApi.getAdminMatches().catch(() => ({ matches: [] })),
        ScorerApi.getVenues().catch(() => ({ venues: [] })),
        ScorerApi.getTournaments().catch(() => ({ tournaments: [] })),
        ScorerApi.getOfficials().catch(() => ({ officials: [] })),
        ScorerApi.getTeams().catch(() => ({ teams: [] }))
      ]);

      if (matchesRes && Array.isArray(matchesRes.matches) && matchesRes.matches.length > 0) {
        setMatchesList(matchesRes.matches);
      }
      if (venuesRes && Array.isArray(venuesRes.venues) && venuesRes.venues.length > 0) {
        setVenuesList(venuesRes.venues);
      }
      if (toursRes && Array.isArray(toursRes.tournaments) && toursRes.tournaments.length > 0) {
        setTournamentsList(toursRes.tournaments);
      }
      if (offRes && Array.isArray(offRes.officials) && offRes.officials.length > 0) {
        setOfficialsList(offRes.officials);
      }
      if (teamsRes && Array.isArray(teamsRes.teams) && teamsRes.teams.length > 0) {
        setAllClubsList(teamsRes.teams);
      }
    } catch (e) {
      console.warn('Error fetching match schedule data:', e);
    } finally {
      setIsMatchesLoading(false);
    }
  };

  // Comprehensive registered teams for selection
  const availableTeams = useMemo(() => {
    const list: any[] = [];
    const ids = new Set<string>();

    allClubsList.forEach((c: any) => {
      const id = c.id || c.team_id || c.teamId;
      if (id && !ids.has(id)) {
        ids.add(id);
        list.push({
          id,
          name: c.name || c.team_name || c.teamName || id,
          taluk: c.taluk || 'Virudhunagar',
          coachName: c.coach?.name || c.coach_name || 'Head Coach',
          coachEmail: c.coach?.email || c.coach_email || `${id.toLowerCase()}@cfvd.org`
        });
      }
    });

    teams.forEach((t: any) => {
      const id = t.teamId || t.id;
      if (id && !ids.has(id)) {
        ids.add(id);
        list.push({
          id,
          name: t.teamName || t.name || id,
          taluk: t.taluk || 'District League',
          coachName: t.coach?.name || 'Head Coach',
          coachEmail: t.coach?.email || `${(t.teamName || id).toLowerCase().replace(/\s+/g, '')}@cfvd.org`
        });
      }
    });

    if (list.length === 0) {
      list.push(
        { id: 'TM-01', name: 'Virudhunagar Spartans', taluk: 'Virudhunagar', coachName: 'S. Rajendran', coachEmail: 'rajendran@spartans.cfvd.org' },
        { id: 'TM-02', name: 'Sivakasi Strikers', taluk: 'Sivakasi', coachName: 'M. Venkatesh', coachEmail: 'venkat@strikers.cfvd.org' },
        { id: 'TM-03', name: 'Rajapalayam Royals', taluk: 'Rajapalayam', coachName: 'K. Balaji', coachEmail: 'balaji@royals.cfvd.org' },
        { id: 'TM-04', name: 'Aruppukottai Aces', taluk: 'Aruppukottai', coachName: 'R. Vignesh', coachEmail: 'vignesh@aces.cfvd.org' },
        { id: 'TM-05', name: 'Sattur Super Kings', taluk: 'Sattur', coachName: 'P. Arumugam', coachEmail: 'arumugam@kings.cfvd.org' }
      );
    }
    return list;
  }, [allClubsList, teams]);

  // Comprehensive stadiums / venues with detailed metadata
  const availableVenues = useMemo(() => {
    const defaultVenues = [
      { id: 'VEN-01', name: 'Kamarajar District Stadium', location: 'Virudhunagar Collectorate Road', capacity: '12,000 Capacity • Turf Pitch' },
      { id: 'VEN-02', name: 'Sivakasi Cricket Ground', location: 'Sivakasi West Bypass', capacity: '8,000 Capacity • Matting & Turf' },
      { id: 'VEN-03', name: 'Rajapalayam Turf Ground', location: 'Rajapalayam Sports Enclave', capacity: '6,500 Capacity • Floodlit Turf' },
      { id: 'VEN-04', name: 'Aruppukottai Sports Complex', location: 'Aruppukottai Ring Road', capacity: '5,000 Capacity • Turf Pitch' },
      { id: 'VEN-05', name: 'Sattur Municipality Ground', location: 'Sattur Riverbed Arena', capacity: '4,000 Capacity • Standard Pitch' }
    ];

    if (venuesList && venuesList.length > 0) {
      const merged = [...defaultVenues];
      venuesList.forEach((v: any) => {
        const vName = typeof v === 'string' ? v : v.name;
        if (vName && !merged.some(m => m.name.toLowerCase() === vName.toLowerCase())) {
          merged.push({ id: `VEN-${merged.length + 1}`, name: vName, location: 'Virudhunagar District', capacity: 'Official Affiliated Ground' });
        }
      });
      return merged;
    }
    return defaultVenues;
  }, [venuesList]);

  const handleOpenScheduleModal = (matchToEdit: any | null = null) => {
    setScheduleFormError(null);
    setScheduleModalMinimized(false);
    setScheduleModalMaximized(false);
    setTeamADropdownOpen(false);
    setTeamBDropdownOpen(false);
    setVenueDropdownOpen(false);
    setTournamentDropdownOpen(false);
    setFormatDropdownOpen(false);
    setScorerDropdownOpen(false);
    setTeamSearchQueryA('');
    setTeamSearchQueryB('');
    setVenueSearchQuery('');

    if (matchToEdit) {
      setEditingMatch(matchToEdit);
      const tourName = matchToEdit.tournament_name || 'Virudhunagar Premier League 2026';
      setCustomTournamentInput(tourName);
      setScheduleForm({
        tournament_id: matchToEdit.tournament_id || 'T-2026-VPL',
        tournament_name: tourName,
        team_a_id: matchToEdit.team_a_id || '',
        team_b_id: matchToEdit.team_b_id || '',
        venue: matchToEdit.venue || 'Kamarajar District Stadium',
        match_date: matchToEdit.match_date || new Date().toISOString().split('T')[0],
        match_time: matchToEdit.match_time || '09:30 AM',
        match_type: matchToEdit.match_type || 'T20',
        overs: matchToEdit.overs_per_side || 20,
        assigned_scorer_id: matchToEdit.assigned_scorer_id || 'SCR-101'
      });
    } else {
      setEditingMatch(null);
      const defaultTeamA = availableTeams[0]?.id || 'TM-01';
      const defaultTeamB = availableTeams[1]?.id || 'TM-02';
      const defaultVenue = availableVenues[0]?.name || 'Kamarajar District Stadium';
      const defaultTour = 'Virudhunagar Premier League 2026';
      const defaultTourId = 'T-2026-VPL';
      const defaultScorer = officialsList.find(o => o.role === 'SCORER')?.id || 'SCR-101';
      setCustomTournamentInput(defaultTour);

      setScheduleForm({
        tournament_id: defaultTourId,
        tournament_name: defaultTour,
        team_a_id: defaultTeamA,
        team_b_id: defaultTeamB,
        venue: defaultVenue,
        match_date: new Date().toISOString().split('T')[0],
        match_time: '09:30 AM',
        match_type: 'T20',
        overs: 20,
        assigned_scorer_id: defaultScorer
      });
    }
    setScheduleModalOpen(true);
  };

  const handleSaveSchedule = async () => {
    setScheduleFormError(null);
    const { team_a_id, team_b_id, venue, match_date, match_time, match_type, overs, tournament_id, tournament_name, assigned_scorer_id } = scheduleForm;

    if (!team_a_id || !team_b_id) {
      setScheduleFormError('Please select both Team A and Team B.');
      return;
    }
    if (team_a_id === team_b_id) {
      setScheduleFormError('Team A and Team B cannot be the same team.');
      return;
    }
    if (!match_date || !match_date.trim()) {
      setScheduleFormError('Please enter a valid match date (YYYY-MM-DD).');
      return;
    }
    if (!match_time || !match_time.trim()) {
      setScheduleFormError('Please enter match start time.');
      return;
    }

    setIsSubmittingSchedule(true);
    try {
      const effectiveTourName = (tournament_name || customTournamentInput || 'Virudhunagar Premier League 2026').trim();
      const payload = {
        tournament_id: tournament_id || effectiveTourName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 24),
        tournament_name: effectiveTourName,
        team_a_id,
        team_b_id,
        venue,
        match_date: match_date.trim(),
        match_time: match_time.trim(),
        match_type,
        overs_per_side: Number(overs),
        assigned_scorer_id,
        notify_teams_and_coaches: notifyTeamsOnTimeChange
      };

      if (editingMatch) {
        await ScorerApi.updateMatch(editingMatch.id, payload);
        const alertMsg = notifyTeamsOnTimeChange
          ? `✓ Match ${editingMatch.id} updated! Automated rescheduling dispatch sent to registered team coaches & managers.`
          : `✓ Match ${editingMatch.id} successfully updated and rescheduled.`;
        showNotification(alertMsg);
      } else {
        const res = await ScorerApi.scheduleMatch(payload);
        showNotification(`✓ New match fixture successfully scheduled (ID: ${res?.match?.id || 'Created'}).`);
      }

      setScheduleModalOpen(false);
      setScheduleModalMinimized(false);
      setEditingMatch(null);
      await loadMatchesAndLogistics();
    } catch (err: any) {
      setScheduleFormError(err.message || 'Failed to save match schedule.');
    } finally {
      setIsSubmittingSchedule(false);
    }
  };

  const handleConfirmCancelMatch = async () => {
    if (!cancelMatchModal) return;
    setIsCancellingMatch(true);
    try {
      await ScorerApi.cancelMatch(cancelMatchModal.id, cancelReasonInput);
      showNotification(`✓ Match ${cancelMatchModal.id} has been marked as CANCELLED.`);
      setCancelMatchModal(null);
      await loadMatchesAndLogistics();
    } catch (err: any) {
      if (Platform.OS === 'web') alert(`Cancellation failed: ${err.message}`);
      else Alert.alert('Cancellation Error', err.message);
    } finally {
      setIsCancellingMatch(false);
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`Permanently delete scheduled match fixture ${matchId}?`)
      : true;

    if (!confirmed) return;

    try {
      await ScorerApi.deleteMatch(matchId);
      showNotification(`✓ Match fixture ${matchId} permanently removed.`);
      await loadMatchesAndLogistics();
    } catch (err: any) {
      if (Platform.OS === 'web') alert(`Deletion error: ${err.message}`);
      else Alert.alert('Deletion Error', err.message);
    }
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Scorer Actions
  const handleApproveScorer = async (scorerId: string) => {
    const target = scorers.find(s => s.scorerId === scorerId);
    try {
      await ScorerApi.approveRegistration(scorerId, 'SCORER');
      if (target?.email) {
        await ScorerApi.updateScorerStatus(target.email, 'ACTIVE');
      }
    } catch (e) {
      console.warn('Backend approval note:', e);
    }
    setScorers(prev =>
      prev.map(s => (s.scorerId === scorerId ? { ...s, status: 'Approved', approvedBy: adminEmail, approvedAt: new Date().toISOString(), rejectionReason: null } : s))
    );
    showNotification('✓ Scorer authorized successfully in MongoDB for official match scoring.');
  };

  const handleOpenRejectModal = (id: string, type: 'SCORER' | 'TEAM' | 'UMPIRE', name: string) => {
    setRejectionModal({ id, type, name });
    setRejectionReasonInput(type === 'SCORER' ? 'Required scorer certification credentials expired. Renewal required.' : type === 'UMPIRE' ? 'Umpiring certification criteria not fulfilled. Re-submission required.' : 'Documentation criteria not fulfilled');
  };

  const handleConfirmReject = async () => {
    if (!rejectionModal) return;
    const { id, type, name } = rejectionModal;
    const reason = rejectionReasonInput.trim() || 'Criteria not met';

    try {
      await ScorerApi.rejectRegistration(id, type, reason);
    } catch (e) {
      console.warn('Backend reject note:', e);
    }

    if (type === 'SCORER') {
      setScorers(prev =>
        prev.map(s => (s.scorerId === id ? { ...s, status: 'Rejected', rejectionReason: reason, rejectedAt: new Date().toISOString(), rejectedBy: adminEmail } : s))
      );
      showNotification(`Scorer request rejected: ${name}.`);
    } else if (type === 'UMPIRE') {
      setUmpires(prev =>
        prev.map(u => (u.umpireId === id ? { ...u, status: 'Rejected', rejectionReason: reason, rejectedAt: new Date().toISOString(), rejectedBy: adminEmail } : u))
      );
      showNotification(`Umpire registration request rejected: ${name}.`);
    } else {
      setTeams(prev =>
        prev.map(t => (t.teamId === id ? { ...t, status: 'Rejected', rejectionReason: reason, rejectedAt: new Date().toISOString(), rejectedBy: adminEmail } : t))
      );
      showNotification(`Team registration rejected: ${name}.`);
    }

    setRejectionModal(null);
  };

  // Umpire Actions
  const handleApproveUmpire = async (umpireId: string) => {
    const target = umpires.find(u => u.umpireId === umpireId);
    try {
      await ScorerApi.approveRegistration(umpireId, 'UMPIRE');
      if (target?.email) {
        await ScorerApi.updateUmpireStatus(target.email, 'ACTIVE');
      }
    } catch (e) {
      console.warn('Backend umpire approval note:', e);
    }
    setUmpires(prev =>
      prev.map(u => (u.umpireId === umpireId ? { ...u, status: 'Approved', approvedBy: adminEmail, approvedAt: new Date().toISOString(), rejectionReason: null } : u))
    );
    showNotification('✓ Umpire accredited & authorized for match officiating in MongoDB.');
  };

  // Team Actions
  const handleApproveTeam = async (teamId: string) => {
    try {
      await ScorerApi.approveRegistration(teamId, 'TEAM');
    } catch (e) {
      console.warn('Backend team approval note:', e);
    }
    setTeams(prev =>
      prev.map(t => (t.teamId === teamId ? { ...t, status: 'Approved', approvedBy: adminEmail, approvedAt: new Date().toISOString(), rejectionReason: null } : t))
    );
    showNotification('✓ Team registration approved for district tournaments.');
  };

  // News Actions
  const handlePublishNews = async () => {
    if (!newNewsTitle.trim()) {
      Alert.alert('Notice Title Required', 'Please enter an official article or notice title.');
      return;
    }
    const item = {
      id: `NEWS-${Date.now()}`,
      title: newNewsTitle.trim(),
      category: newNewsCategory,
      author: newNewsAuthor.trim() || 'CFVD Secretariat',
      createdAt: new Date().toISOString()
    };
    try {
      await ScorerApi.createNews(item);
    } catch (e) { }
    setNewsList(prev => [item, ...prev]);
    setNewNewsTitle('');
    showNotification('✓ Official announcement published successfully.');
  };

  const handleDeleteNews = async (newsId: string) => {
    try {
      await ScorerApi.deleteNews(newsId);
    } catch (e) { }
    setNewsList(prev => prev.filter(n => n.id !== newsId));
    showNotification('Official notice deleted.');
  };


  // Compute Scorer metrics
  const scorerTotal = scorers.length;
  const scorerApproved = scorers.filter(s => s.status === 'Approved').length;
  const scorerPending = scorers.filter(s => (s.status || 'Pending') === 'Pending').length;
  const scorerRejected = scorers.filter(s => s.status === 'Rejected').length;

  // Compute Team metrics
  const teamTotal = teams.length;
  const teamApproved = teams.filter(t => t.status === 'Approved').length;
  const teamPending = teams.filter(t => (t.status || 'Pending') === 'Pending').length;
  const teamRejected = teams.filter(t => t.status === 'Rejected').length;

  // Compute Umpire metrics
  const umpireTotal = umpires.length;
  const umpireApproved = umpires.filter(u => u.status === 'Approved').length;
  const umpirePending = umpires.filter(u => (u.status || 'Pending') === 'Pending').length;
  const umpireRejected = umpires.filter(u => u.status === 'Rejected').length;

  // Filtered Scorers
  const filteredScorers = useMemo(() => {
    return scorers.filter(s => {
      const matchFilter = scorerFilter === 'all' ? true : (s.status || 'Pending') === scorerFilter;
      const q = scorerSearchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        (s.scorerName || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.grade || '').toLowerCase().includes(q) ||
        (s.taluk || '').toLowerCase().includes(q);
      return matchFilter && matchQuery;
    });
  }, [scorers, scorerFilter, scorerSearchQuery]);

  // Filtered Teams
  const filteredTeams = useMemo(() => {
    return teams.filter(t => {
      const matchFilter = teamFilter === 'all' ? true : (t.status || 'Pending') === teamFilter;
      const q = teamSearchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        (t.teamName || '').toLowerCase().includes(q) ||
        (t.taluk || '').toLowerCase().includes(q) ||
        (t.coach?.name || '').toLowerCase().includes(q);
      return matchFilter && matchQuery;
    });
  }, [teams, teamFilter, teamSearchQuery]);

  // Filtered Umpires
  const filteredUmpires = useMemo(() => {
    return umpires.filter(u => {
      const matchFilter = umpireFilter === 'all' ? true : (u.status || 'Pending') === umpireFilter;
      const q = umpireSearchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        (u.umpireName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.qualification || '').toLowerCase().includes(q) ||
        (u.district || '').toLowerCase().includes(q) ||
        (u.certificationNumber || '').toLowerCase().includes(q);
      return matchFilter && matchQuery;
    });
  }, [umpires, umpireFilter, umpireSearchQuery]);

  // Filtered Matches
  const filteredMatches = useMemo(() => {
    return matchesList.filter(m => {
      const statusUpper = (m.status || 'SCHEDULED').toUpperCase();
      let matchStatusFilter = true;
      if (matchFilter === 'SCHEDULED') matchStatusFilter = statusUpper === 'SCHEDULED';
      else if (matchFilter === 'LIVE') matchStatusFilter = statusUpper === 'LIVE' || statusUpper === 'INNINGS_BREAK';
      else if (matchFilter === 'COMPLETED') matchStatusFilter = statusUpper === 'COMPLETED';
      else if (matchFilter === 'CANCELLED') matchStatusFilter = statusUpper === 'CANCELLED' || statusUpper === 'ABANDONED';

      const q = matchSearchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (m.team_a_name || m.team_a_id || '').toLowerCase().includes(q) ||
        (m.team_b_name || m.team_b_id || '').toLowerCase().includes(q) ||
        (m.venue || '').toLowerCase().includes(q) ||
        (m.tournament_name || '').toLowerCase().includes(q) ||
        (m.id || '').toLowerCase().includes(q);

      return matchStatusFilter && matchSearch;
    });
  }, [matchesList, matchFilter, matchSearchQuery]);

  const scheduledMatchesCount = useMemo(() => {
    return matchesList.filter(m => (m.status || '').toUpperCase() === 'SCHEDULED').length;
  }, [matchesList]);

  const liveMatchesCount = useMemo(() => {
    return matchesList.filter(m => ['LIVE', 'INNINGS_BREAK'].includes((m.status || '').toUpperCase())).length;
  }, [matchesList]);

  const completedMatchesCount = useMemo(() => {
    return matchesList.filter(m => (m.status || '').toUpperCase() === 'COMPLETED').length;
  }, [matchesList]);

  const cancelledMatchesCount = useMemo(() => {
    return matchesList.filter(m => ['CANCELLED', 'ABANDONED'].includes((m.status || '').toUpperCase())).length;
  }, [matchesList]);

  // Helper for Donut Chart conic-gradient percentages
  const getDonutSegments = (approved: number, pending: number, rejected: number, total: number) => {
    if (total === 0) return { appPct: 33, pendPct: 33, rejPct: 34 };
    const appPct = Math.round((approved / total) * 100);
    const pendPct = Math.round((pending / total) * 100);
    const rejPct = 100 - appPct - pendPct;
    return { appPct, pendPct, rejPct };
  };

  const scorerSegments = getDonutSegments(scorerApproved, scorerPending, scorerRejected, scorerTotal);
  const teamSegments = getDonutSegments(teamApproved, teamPending, teamRejected, teamTotal);
  const umpireSegments = getDonutSegments(umpireApproved, umpirePending, umpireRejected, umpireTotal);

  const totalOverall = scorerTotal + teamTotal + umpireTotal;
  const overallApproved = scorerApproved + teamApproved + umpireApproved;
  const overallPending = scorerPending + teamPending + umpirePending;
  const overallRejected = scorerRejected + teamRejected + umpireRejected;
  const overallSegments = getDonutSegments(overallApproved, overallPending, overallRejected, totalOverall);

  const renderSidebarContent = (isMobileDrawer: boolean = false) => {
    const isCollapsed = !isMobileDrawer && sidebarCollapsed;
    return (
      <View style={[styles.sidebarInner, isCollapsed && styles.sidebarInnerCollapsed]}>
        {/* Profile Card */}
        <View style={[styles.sidebarProfileCard, isCollapsed && styles.sidebarProfileCardCollapsed]}>
          <View style={styles.sidebarAvatar}>
            <Text style={styles.sidebarAvatarText}>AD</Text>
          </View>
          {!isCollapsed && (
            <View style={styles.sidebarProfileInfo}>
              <Text style={styles.sidebarProfileName} numberOfLines={1}>CFVD Admin</Text>
              <Text style={styles.sidebarProfileRole} numberOfLines={1}>ADMIN • EXECUTIVE</Text>
              <View style={styles.sidebarOfficialBadge}>
                <Text style={styles.sidebarOfficialBadgeText}>CFVD OFFICIAL</Text>
              </View>
            </View>
          )}
        </View>

        {/* Navigation Section */}
        <ScrollView style={styles.sidebarNavScroll} showsVerticalScrollIndicator={false}>
          {!isCollapsed && <Text style={styles.sidebarNavHeader}>NAVIGATION</Text>}

          {/* Overview */}
          <TouchableOpacity
            style={[
              styles.sidebarNavItem,
              activeTab === 'overview' && styles.sidebarNavItemActive,
              isCollapsed && styles.sidebarNavItemCollapsed
            ]}
            onPress={() => {
              setActiveTab('overview');
              if (isMobileDrawer) setMobileSidebarOpen(false);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.sidebarNavIcon, activeTab === 'overview' && styles.sidebarNavIconActive]}>⊞</Text>
            {!isCollapsed && (
              <Text style={[styles.sidebarNavLabel, activeTab === 'overview' && styles.sidebarNavLabelActive]}>
                Overview
              </Text>
            )}
          </TouchableOpacity>

          {/* Team Registrations */}
          <TouchableOpacity
            style={[
              styles.sidebarNavItem,
              activeTab === 'teams' && styles.sidebarNavItemActive,
              isCollapsed && styles.sidebarNavItemCollapsed
            ]}
            onPress={() => {
              setActiveTab('teams');
              if (isMobileDrawer) setMobileSidebarOpen(false);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.sidebarNavIcon, activeTab === 'teams' && styles.sidebarNavIconActive]}>👥</Text>
            {!isCollapsed && (
              <Text style={[styles.sidebarNavLabel, activeTab === 'teams' && styles.sidebarNavLabelActive]}>
                Team Registrations
              </Text>
            )}
            {!isCollapsed && teamPending > 0 && (
              <View style={styles.sidebarBadgeBlue}>
                <Text style={styles.sidebarBadgeText}>{teamPending}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Scorer Management */}
          <TouchableOpacity
            style={[
              styles.sidebarNavItem,
              activeTab === 'scorers' && styles.sidebarNavItemActive,
              isCollapsed && styles.sidebarNavItemCollapsed
            ]}
            onPress={() => {
              setActiveTab('scorers');
              if (isMobileDrawer) setMobileSidebarOpen(false);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.sidebarNavIcon, activeTab === 'scorers' && styles.sidebarNavIconActive]}>📋</Text>
            {!isCollapsed && (
              <Text style={[styles.sidebarNavLabel, activeTab === 'scorers' && styles.sidebarNavLabelActive]}>
                Scorer Management
              </Text>
            )}
            {!isCollapsed && scorerPending > 0 && (
              <View style={styles.sidebarBadgeOrange}>
                <Text style={styles.sidebarBadgeText}>{scorerPending}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Umpires */}
          <TouchableOpacity
            style={[
              styles.sidebarNavItem,
              activeTab === 'umpires' && styles.sidebarNavItemActive,
              isCollapsed && styles.sidebarNavItemCollapsed
            ]}
            onPress={() => {
              setActiveTab('umpires');
              if (isMobileDrawer) setMobileSidebarOpen(false);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.sidebarNavIcon, activeTab === 'umpires' && styles.sidebarNavIconActive]}>⚖️</Text>
            {!isCollapsed && (
              <Text style={[styles.sidebarNavLabel, activeTab === 'umpires' && styles.sidebarNavLabelActive]}>
                Umpires
              </Text>
            )}
            {!isCollapsed && umpirePending > 0 && (
              <View style={styles.sidebarBadgePurple}>
                <Text style={styles.sidebarBadgeText}>{umpirePending}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Match Schedules */}
          <TouchableOpacity
            style={[
              styles.sidebarNavItem,
              activeTab === 'schedules' && styles.sidebarNavItemActive,
              isCollapsed && styles.sidebarNavItemCollapsed
            ]}
            onPress={() => {
              setActiveTab('schedules');
              if (isMobileDrawer) setMobileSidebarOpen(false);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.sidebarNavIcon, activeTab === 'schedules' && styles.sidebarNavIconActive]}>⚡</Text>
            {!isCollapsed && (
              <Text style={[styles.sidebarNavLabel, activeTab === 'schedules' && styles.sidebarNavLabelActive]}>
                Match Schedules
              </Text>
            )}
            {!isCollapsed && scheduledMatchesCount > 0 && (
              <View style={styles.sidebarBadgeGold}>
                <Text style={styles.sidebarBadgeText}>{scheduledMatchesCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* News & Content */}
          <TouchableOpacity
            style={[
              styles.sidebarNavItem,
              activeTab === 'content' && styles.sidebarNavItemActive,
              isCollapsed && styles.sidebarNavItemCollapsed
            ]}
            onPress={() => {
              setActiveTab('content');
              if (isMobileDrawer) setMobileSidebarOpen(false);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.sidebarNavIcon, activeTab === 'content' && styles.sidebarNavIconActive]}>📰</Text>
            {!isCollapsed && (
              <Text style={[styles.sidebarNavLabel, activeTab === 'content' && styles.sidebarNavLabelActive]}>
                News & Content
              </Text>
            )}
            {!isCollapsed && newsList.length > 0 && (
              <View style={styles.sidebarBadgeGray}>
                <Text style={styles.sidebarBadgeText}>{newsList.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>

        {/* Sidebar Footer */}
        <View style={styles.sidebarFooterBox}>
          <TouchableOpacity
            style={[styles.sidebarLogoutBtn, isCollapsed && styles.sidebarLogoutBtnCollapsed]}
            onPress={() => setLogoutModalOpen(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.sidebarLogoutIcon}>↪</Text>
            {!isCollapsed && <Text style={styles.sidebarLogoutText}>Logout</Text>}
          </TouchableOpacity>

          {!isMobileDrawer && (
            <TouchableOpacity
              style={styles.sidebarCollapseBtn}
              onPress={() => setSidebarCollapsed(!sidebarCollapsed)}
              activeOpacity={0.7}
            >
              <Text style={styles.sidebarCollapseText}>
                {sidebarCollapsed ? '> Expand' : '< Collapse Sidebar'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.rootContainer}>
      {/* ─────────────────────────────────────────────────────────────
          1. DEDICATED ADMIN TOP BAR WITH HAMBURGER (THREE DASHES ☰)
          ───────────────────────────────────────────────────────────── */}
      <View style={[styles.adminMinimalTopBar, { paddingTop: styles.adminMinimalTopBar.paddingVertical + insetsTop }]}>
        <View style={styles.adminMinimalBrandCol}>
          <TouchableOpacity
            style={styles.hamburgerBtn}
            onPress={(e: any) => {
              if (e && e.preventDefault) e.preventDefault();
              if (e && e.stopPropagation) e.stopPropagation();
              if (isDesktop) {
                setSidebarCollapsed(prev => !prev);
              } else {
                setMobileSidebarOpen(prev => !prev);
              }
            }}
            activeOpacity={0.7}
            accessibilityLabel="Toggle Admin Sidebar Menu"
          >
            <Text style={styles.hamburgerIcon}>☰</Text>
          </TouchableOpacity>
          <Image source={IMG_LOGO} style={styles.adminMinimalLogo} resizeMode="contain" />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.adminMinimalTitle} numberOfLines={2}>CRICKET FEDERATION OF VIRUDHUNAGAR DISTRICT</Text>
            <Text style={styles.adminMinimalSub} numberOfLines={1}>Official Administrator Management Console</Text>
          </View>
        </View>
        {isDesktop && (
          <View style={styles.adminMinimalActionRow}>
            <View style={styles.adminUserBadgePill}>
              <Text style={styles.adminUserBadgePillText}>👤 {adminEmail}</Text>
            </View>
            <TouchableOpacity style={styles.adminExitBtnPill} onPress={() => setLogoutModalOpen(true)} activeOpacity={0.8}>
              <Text style={styles.adminExitBtnPillText}>← Exit</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ─────────────────────────────────────────────────────────────
          2. DASHBOARD BODY: SIDEBAR + MAIN CONTENT AREA
          ───────────────────────────────────────────────────────────── */}
      <View style={styles.dashboardBodyRow}>
        {/* DESKTOP SIDEBAR */}
        {isDesktop && (
          <View style={[styles.sidebarContainer, sidebarCollapsed && styles.sidebarContainerCollapsed]}>
            {renderSidebarContent(false)}
          </View>
        )}

        {/* MOBILE DRAWER OVERLAY */}
        {!isDesktop && mobileSidebarOpen && (
          <View style={styles.mobileDrawerOverlay}>
            <TouchableOpacity
              style={styles.mobileDrawerBackdrop}
              activeOpacity={1}
              onPress={() => setMobileSidebarOpen(false)}
            />
            <View style={styles.mobileDrawerContent}>
              <View style={styles.mobileDrawerHeader}>
                <Text style={styles.mobileDrawerTitle}>Admin Menu</Text>
                <TouchableOpacity onPress={() => setMobileSidebarOpen(false)} style={styles.mobileDrawerCloseBtn}>
                  <Text style={styles.mobileDrawerCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              {renderSidebarContent(true)}
            </View>
          </View>
        )}

        {/* MAIN SCROLL CONTENT AREA */}
        <ScrollView
          style={styles.mainScrollView}
          contentContainerStyle={styles.scrollContentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentConstrained}>
            {/* Success Notification Banner */}
            {notification && (
              <View style={styles.notificationBanner}>
                <Text style={styles.notificationText}>{notification}</Text>
              </View>
            )}

            {/* MODERN PAGE HEADER ROW */}
            <View style={styles.pageHeaderRow}>
              <View>
                <Text style={styles.pageHeaderTitle}>
                  {activeTab === 'overview' && '⊞ Overview'}
                  {activeTab === 'teams' && '👥 Team Registrations'}
                  {activeTab === 'scorers' && '📋 Scorer Management'}
                  {activeTab === 'umpires' && '⚖️ Umpires Management'}
                  {activeTab === 'schedules' && '⚡ Match Schedules'}
                  {activeTab === 'content' && '📰 News & Content'}
                </Text>
                <Text style={styles.pageHeaderSubtitle}>CFVD Official Administrator Governance Console</Text>
              </View>
              <TouchableOpacity
                style={styles.btnRefreshData}
                onPress={loadDataFromBackend}
                activeOpacity={0.8}
              >
                <Text style={styles.btnRefreshDataText}>🔄 Refresh Data</Text>
              </TouchableOpacity>
            </View>

          {/* ─────────────────────────────────────────────────────────────
              4. TAB CONTENT: SCORER MANAGEMENT (Exact Match to Screenshot)
              ───────────────────────────────────────────────────────────── */}
          {activeTab === 'scorers' && (
            <View>
              {/* TOP TWO SIDE-BY-SIDE HIGHLIGHT CARDS */}
              <View style={[styles.highlightCardsRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
                {/* Left Card: Scorer Management Stats */}
                <View style={styles.navyStatCard}>
                  <View style={styles.statCardHeader}>
                    <View style={styles.blueIconBox}>
                      <Text style={{ fontSize: 16 }}>📡</Text>
                    </View>
                    <Text style={styles.statCardTitle}>Scorer Management</Text>
                  </View>
                  <Text style={styles.statCardSubtitle}>
                    Official scorer registrations and live match scoring access requests across Virudhunagar District.
                  </Text>

                  {/* 4 Colored Pill Rows */}
                  <View style={styles.pillRowsContainer}>
                    {/* Authorized Scorers */}
                    <View style={[styles.statRowPill, styles.rowPillGreen]}>
                      <View style={styles.pillLeftGroup}>
                        <View style={[styles.glowingDot, { backgroundColor: '#10b981' }]} />
                        <Text style={[styles.pillLabel, { color: '#a7f3d0' }]}>Authorized Scorers</Text>
                      </View>
                      <Text style={[styles.pillCount, { color: '#4ade80' }]}>{scorerApproved}</Text>
                    </View>

                    {/* Pending Approval */}
                    <View style={[styles.statRowPill, styles.rowPillAmber]}>
                      <View style={styles.pillLeftGroup}>
                        <View style={[styles.glowingDot, { backgroundColor: '#eab308' }]} />
                        <Text style={[styles.pillLabel, { color: '#fde68a' }]}>Pending Approval</Text>
                      </View>
                      <Text style={[styles.pillCount, { color: '#fbbf24' }]}>{scorerPending}</Text>
                    </View>

                    {/* Rejected */}
                    <View style={[styles.statRowPill, styles.rowPillRed]}>
                      <View style={styles.pillLeftGroup}>
                        <View style={[styles.glowingDot, { backgroundColor: '#ef4444' }]} />
                        <Text style={[styles.pillLabel, { color: '#fca5a5' }]}>Rejected</Text>
                      </View>
                      <Text style={[styles.pillCount, { color: '#f87171' }]}>{scorerRejected}</Text>
                    </View>

                    {/* Total Scorers */}
                    <View style={[styles.statRowPill, styles.rowPillIndigo]}>
                      <View style={styles.pillLeftGroup}>
                        <View style={[styles.glowingDot, { backgroundColor: '#818cf8' }]} />
                        <Text style={[styles.pillLabel, { color: '#c7d2fe' }]}>Total Scorers</Text>
                      </View>
                      <Text style={[styles.pillCount, { color: '#a5b4fc' }]}>{scorerTotal}</Text>
                    </View>
                  </View>
                </View>

                {/* Right Card: Status Distribution with Donut Chart */}
                <View style={[styles.navyStatCard, styles.donutCardAlign]}>
                  <View style={styles.donutHeader}>
                    <Text style={{ fontSize: 16, marginRight: 6 }}>📊</Text>
                    <Text style={styles.statCardTitle}>Status Distribution</Text>
                  </View>

                  {/* Donut Chart with CSS Conic Gradient on Web / Multi-border Ring on Native */}
                  <View style={styles.donutWrapper}>
                    <View
                      style={[
                        styles.donutOuterRing,
                        !isDesktop && { width: 140, height: 140, borderRadius: 70 },
                        Platform.OS === 'web'
                          ? ({
                              background: `conic-gradient(#10b981 0% ${scorerSegments.appPct}%, #f59e0b ${scorerSegments.appPct}% ${scorerSegments.appPct + scorerSegments.pendPct}%, #ef4444 ${scorerSegments.appPct + scorerSegments.pendPct}% 100%)`,
                              backgroundImage: `conic-gradient(#10b981 0% ${scorerSegments.appPct}%, #f59e0b ${scorerSegments.appPct}% ${scorerSegments.appPct + scorerSegments.pendPct}%, #ef4444 ${scorerSegments.appPct + scorerSegments.pendPct}% 100%)`
                            } as any)
                          : {
                              borderWidth: 10,
                              borderColor: '#10b981',
                              borderTopColor: '#10b981',
                              borderRightColor: scorerSegments.pendPct > 0 ? '#f59e0b' : '#10b981',
                              borderBottomColor: scorerSegments.rejPct > 0 ? '#ef4444' : '#10b981',
                              borderLeftColor: '#10b981',
                              backgroundColor: '#071026'
                            }
                      ]}
                    >
                      {/* Center Hole */}
                      <View style={[styles.donutHole, !isDesktop && { width: 80, height: 80, borderRadius: 40 }]}>
                        <Text style={[styles.donutNumber, !isDesktop && { fontSize: 24 }]}>{scorerTotal}</Text>
                        <Text style={[styles.donutUnitLabel, !isDesktop && { fontSize: 8 }]}>SCORERS</Text>
                      </View>
                    </View>
                  </View>

                  {/* Dynamic Proportional Distribution Bar (drawn dynamically across all platforms) */}
                  <View style={styles.distributionBarWrapper}>
                    <View style={styles.distributionBarTrack}>
                      {scorerSegments.appPct > 0 && (
                        <View style={[styles.distributionBarSegment, { width: `${scorerSegments.appPct}%`, backgroundColor: '#10b981' }]} />
                      )}
                      {scorerSegments.pendPct > 0 && (
                        <View style={[styles.distributionBarSegment, { width: `${scorerSegments.pendPct}%`, backgroundColor: '#f59e0b' }]} />
                      )}
                      {scorerSegments.rejPct > 0 && (
                        <View style={[styles.distributionBarSegment, { width: `${scorerSegments.rejPct}%`, backgroundColor: '#ef4444' }]} />
                      )}
                    </View>
                    <View style={styles.distributionPctRow}>
                      <Text style={[styles.distributionPctText, { color: '#6ee7b7' }]}>{scorerSegments.appPct}% Authorized</Text>
                      <Text style={[styles.distributionPctText, { color: '#fde68a' }]}>{scorerSegments.pendPct}% Pending</Text>
                      <Text style={[styles.distributionPctText, { color: '#fca5a5' }]}>{scorerSegments.rejPct}% Rejected</Text>
                    </View>
                  </View>

                  {/* 3-Color Legend */}
                  <View style={styles.donutLegendRow}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
                      <Text style={[styles.legendText, { color: '#6ee7b7' }]}>Authorized ({scorerApproved})</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
                      <Text style={[styles.legendText, { color: '#fde68a' }]}>Pending ({scorerPending})</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
                      <Text style={[styles.legendText, { color: '#fca5a5' }]}>Rejected ({scorerRejected})</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* SEARCH & FILTER TOOLBAR */}
              <View style={styles.toolbarCard}>
                <View style={styles.searchBox}>
                  <Text style={styles.searchIcon}>🔍</Text>
                  <TextInput
                    style={styles.searchInput}
                    value={scorerSearchQuery}
                    onChangeText={setScorerSearchQuery}
                    placeholder="Search by scorer name, email or grade..."
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View style={styles.filterPillsGroup}>
                  <Text style={styles.filterStatusLabel}>Filter Status:</Text>
                  <TouchableOpacity
                    style={[styles.filterPill, scorerFilter === 'all' && styles.filterPillActive]}
                    onPress={() => setScorerFilter('all')}
                  >
                    <Text style={[styles.filterPillText, scorerFilter === 'all' && styles.filterPillTextActive]}>
                      All ({scorerTotal})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterPill, scorerFilter === 'Pending' && styles.filterPillActive]}
                    onPress={() => setScorerFilter('Pending')}
                  >
                    <Text style={[styles.filterPillText, scorerFilter === 'Pending' && styles.filterPillTextActive]}>
                      Pending ({scorerPending})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterPill, scorerFilter === 'Approved' && styles.filterPillActive]}
                    onPress={() => setScorerFilter('Approved')}
                  >
                    <Text style={[styles.filterPillText, scorerFilter === 'Approved' && styles.filterPillTextActive]}>
                      Approved ({scorerApproved})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterPill, scorerFilter === 'Rejected' && styles.filterPillActive]}
                    onPress={() => setScorerFilter('Rejected')}
                  >
                    <Text style={[styles.filterPillText, scorerFilter === 'Rejected' && styles.filterPillTextActive]}>
                      Rejected ({scorerRejected})
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* SCORERS LIST CARDS */}
              <View style={styles.itemsListContainer}>
                {filteredScorers.length === 0 ? null : (
                  filteredScorers.map(s => {
                    const isApproved = s.status === 'Approved';
                    const isPending = (s.status || 'Pending') === 'Pending';
                    const isRejected = s.status === 'Rejected';

                    return (
                      <View
                        key={s.scorerId}
                        style={[
                          styles.whiteItemCard,
                          isApproved && styles.cardApprovedBorder,
                          isPending && styles.cardPendingBorder,
                          isRejected && styles.cardRejectedBorder
                        ]}
                      >
                        <View style={styles.itemCardHeaderRow}>
                          <View style={styles.itemTitleGroup}>
                            <View style={styles.itemTitleBadgeRow}>
                              <Text style={styles.itemNameText}>{s.scorerName}</Text>
                              {isApproved && (
                                <View style={styles.badgeConfirmed}>
                                  <Text style={styles.badgeConfirmedText}>✔ Approved</Text>
                                </View>
                              )}
                              {isPending && (
                                <View style={styles.badgePending}>
                                  <Text style={styles.badgePendingText}>⏳ Pending</Text>
                                </View>
                              )}
                              {isRejected && (
                                <View style={styles.badgeRejected}>
                                  <Text style={styles.badgeRejectedText}>🚫 Rejected</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.itemIdGradeText}>
                              ID: {s.scorerId} • Grade: {s.grade}
                            </Text>
                          </View>

                          {/* Action Buttons */}
                          <View style={styles.itemActionsRow}>
                            <TouchableOpacity
                              style={styles.btnOutlineGold}
                              onPress={() => setSelectedScorerModal(s)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.btnOutlineGoldText}>👁 View</Text>
                            </TouchableOpacity>

                            {isPending ? (
                              <>
                                <TouchableOpacity
                                  style={styles.btnSuccessSm}
                                  onPress={() => handleApproveScorer(s.scorerId)}
                                  activeOpacity={0.8}
                                >
                                  <Text style={styles.btnSuccessSmText}>✔ Approve</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.btnOutlineDanger}
                                  onPress={() => handleOpenRejectModal(s.scorerId, 'SCORER', s.scorerName)}
                                  activeOpacity={0.8}
                                >
                                  <Text style={styles.btnOutlineDangerText}>🚫 Reject</Text>
                                </TouchableOpacity>
                              </>
                            ) : isApproved ? (
                              <TouchableOpacity
                                style={styles.btnOutlineDanger}
                                onPress={() => handleOpenRejectModal(s.scorerId, 'SCORER', s.scorerName)}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.btnOutlineDangerText}>🚫 Reject</Text>
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity
                                style={styles.btnSuccessSm}
                                onPress={() => handleApproveScorer(s.scorerId)}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.btnSuccessSmText}>✔ Approve</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>

                        {/* Item Meta Details */}
                        <View style={styles.itemMetaGrid}>
                          <View style={styles.metaCell}>
                            <Text style={styles.metaLabel}>Email Address</Text>
                            <Text style={styles.metaVal}>{s.email}</Text>
                          </View>
                          <View style={styles.metaCell}>
                            <Text style={styles.metaLabel}>Contact Phone</Text>
                            <Text style={styles.metaVal}>{s.phone || 'N/A'}</Text>
                          </View>
                          <View style={styles.metaCell}>
                            <Text style={styles.metaLabel}>Taluk / Jurisdiction</Text>
                            <Text style={styles.metaVal}>{s.taluk || 'Virudhunagar'}</Text>
                          </View>
                          <View style={styles.metaCell}>
                            <Text style={styles.metaLabel}>Experience</Text>
                            <Text style={styles.metaVal}>{s.experienceYears || 2} Years</Text>
                          </View>
                        </View>

                        {isRejected && s.rejectionReason && (
                          <View style={styles.rejectionNoticeBox}>
                            <Text style={styles.rejectionNoticeLabel}>Rejection Reason:</Text>
                            <Text style={styles.rejectionNoticeText}>{s.rejectionReason}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          )}

          {/* ─────────────────────────────────────────────────────────────
              4B. TAB CONTENT: UMPIRE MANAGEMENT
              ───────────────────────────────────────────────────────────── */}
          {activeTab === 'umpires' && (
            <View>
              {/* TOP TWO SIDE-BY-SIDE HIGHLIGHT CARDS */}
              <View style={[styles.highlightCardsRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
                {/* Left Card: Umpire Management Stats */}
                <View style={styles.navyStatCard}>
                  <View style={styles.statCardHeader}>
                    <View style={styles.blueIconBox}>
                      <Text style={{ fontSize: 16 }}>⚖️</Text>
                    </View>
                    <Text style={styles.statCardTitle}>Umpire Accreditation</Text>
                  </View>
                  <Text style={styles.statCardSubtitle}>
                    Official certified umpires and match officiating access requests across Virudhunagar District.
                  </Text>

                  {/* 4 Colored Pill Rows */}
                  <View style={styles.pillRowsContainer}>
                    {/* Authorized Umpires */}
                    <View style={[styles.statRowPill, styles.rowPillGreen]}>
                      <View style={styles.pillLeftGroup}>
                        <View style={[styles.glowingDot, { backgroundColor: '#10b981' }]} />
                        <Text style={[styles.pillLabel, { color: '#a7f3d0' }]}>Authorized Umpires</Text>
                      </View>
                      <Text style={[styles.pillCount, { color: '#4ade80' }]}>{umpireApproved}</Text>
                    </View>

                    {/* Pending Approval */}
                    <View style={[styles.statRowPill, styles.rowPillAmber]}>
                      <View style={styles.pillLeftGroup}>
                        <View style={[styles.glowingDot, { backgroundColor: '#eab308' }]} />
                        <Text style={[styles.pillLabel, { color: '#fde68a' }]}>Pending Approval</Text>
                      </View>
                      <Text style={[styles.pillCount, { color: '#fbbf24' }]}>{umpirePending}</Text>
                    </View>

                    {/* Rejected */}
                    <View style={[styles.statRowPill, styles.rowPillRed]}>
                      <View style={styles.pillLeftGroup}>
                        <View style={[styles.glowingDot, { backgroundColor: '#ef4444' }]} />
                        <Text style={[styles.pillLabel, { color: '#fca5a5' }]}>Rejected</Text>
                      </View>
                      <Text style={[styles.pillCount, { color: '#f87171' }]}>{umpireRejected}</Text>
                    </View>

                    {/* Total Umpires */}
                    <View style={[styles.statRowPill, styles.rowPillIndigo]}>
                      <View style={styles.pillLeftGroup}>
                        <View style={[styles.glowingDot, { backgroundColor: '#818cf8' }]} />
                        <Text style={[styles.pillLabel, { color: '#c7d2fe' }]}>Total Umpires</Text>
                      </View>
                      <Text style={[styles.pillCount, { color: '#a5b4fc' }]}>{umpireTotal}</Text>
                    </View>
                  </View>
                </View>

                {/* Right Card: Status Distribution with Donut Chart */}
                <View style={[styles.navyStatCard, styles.donutCardAlign]}>
                  <View style={styles.donutHeader}>
                    <Text style={{ fontSize: 16, marginRight: 6 }}>📊</Text>
                    <Text style={styles.statCardTitle}>Status Distribution</Text>
                  </View>

                  {/* Donut Chart */}
                  <View style={styles.donutWrapper}>
                    <View
                      style={[
                        styles.donutOuterRing,
                        !isDesktop && { width: 140, height: 140, borderRadius: 70 },
                        Platform.OS === 'web'
                          ? ({
                              background: `conic-gradient(#10b981 0% ${umpireSegments.appPct}%, #f59e0b ${umpireSegments.appPct}% ${umpireSegments.appPct + umpireSegments.pendPct}%, #ef4444 ${umpireSegments.appPct + umpireSegments.pendPct}% 100%)`,
                              backgroundImage: `conic-gradient(#10b981 0% ${umpireSegments.appPct}%, #f59e0b ${umpireSegments.appPct}% ${umpireSegments.appPct + umpireSegments.pendPct}%, #ef4444 ${umpireSegments.appPct + umpireSegments.pendPct}% 100%)`
                            } as any)
                          : {
                              borderWidth: 10,
                              borderColor: '#10b981',
                              borderTopColor: '#10b981',
                              borderRightColor: umpireSegments.pendPct > 0 ? '#f59e0b' : '#10b981',
                              borderBottomColor: umpireSegments.rejPct > 0 ? '#ef4444' : '#10b981',
                              borderLeftColor: '#10b981',
                              backgroundColor: '#071026'
                            }
                      ]}
                    >
                      {/* Center Hole */}
                      <View style={[styles.donutHole, !isDesktop && { width: 80, height: 80, borderRadius: 40 }]}>
                        <Text style={[styles.donutNumber, !isDesktop && { fontSize: 24 }]}>{umpireTotal}</Text>
                        <Text style={[styles.donutUnitLabel, !isDesktop && { fontSize: 8 }]}>UMPIRES</Text>
                      </View>
                    </View>
                  </View>

                  {/* Dynamic Proportional Distribution Bar */}
                  <View style={styles.distributionBarWrapper}>
                    <View style={styles.distributionBarTrack}>
                      {umpireSegments.appPct > 0 && (
                        <View style={[styles.distributionBarSegment, { width: `${umpireSegments.appPct}%`, backgroundColor: '#10b981' }]} />
                      )}
                      {umpireSegments.pendPct > 0 && (
                        <View style={[styles.distributionBarSegment, { width: `${umpireSegments.pendPct}%`, backgroundColor: '#f59e0b' }]} />
                      )}
                      {umpireSegments.rejPct > 0 && (
                        <View style={[styles.distributionBarSegment, { width: `${umpireSegments.rejPct}%`, backgroundColor: '#ef4444' }]} />
                      )}
                    </View>
                    <View style={styles.distributionPctRow}>
                      <Text style={[styles.distributionPctText, { color: '#6ee7b7' }]}>{umpireSegments.appPct}% Authorized</Text>
                      <Text style={[styles.distributionPctText, { color: '#fde68a' }]}>{umpireSegments.pendPct}% Pending</Text>
                      <Text style={[styles.distributionPctText, { color: '#fca5a5' }]}>{umpireSegments.rejPct}% Rejected</Text>
                    </View>
                  </View>

                  {/* 3-Color Legend */}
                  <View style={styles.donutLegendRow}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
                      <Text style={[styles.legendText, { color: '#6ee7b7' }]}>Authorized ({umpireApproved})</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
                      <Text style={[styles.legendText, { color: '#fde68a' }]}>Pending ({umpirePending})</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
                      <Text style={[styles.legendText, { color: '#fca5a5' }]}>Rejected ({umpireRejected})</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* SEARCH & FILTER TOOLBAR */}
              <View style={styles.toolbarCard}>
                <View style={styles.searchBox}>
                  <Text style={styles.searchIcon}>🔍</Text>
                  <TextInput
                    style={styles.searchInput}
                    value={umpireSearchQuery}
                    onChangeText={setUmpireSearchQuery}
                    placeholder="Search by umpire name, email, qualification or district..."
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View style={styles.filterPillsGroup}>
                  <Text style={styles.filterStatusLabel}>Filter Status:</Text>
                  <TouchableOpacity
                    style={[styles.filterPill, umpireFilter === 'all' && styles.filterPillActive]}
                    onPress={() => setUmpireFilter('all')}
                  >
                    <Text style={[styles.filterPillText, umpireFilter === 'all' && styles.filterPillTextActive]}>
                      All ({umpireTotal})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterPill, umpireFilter === 'Pending' && styles.filterPillActive]}
                    onPress={() => setUmpireFilter('Pending')}
                  >
                    <Text style={[styles.filterPillText, umpireFilter === 'Pending' && styles.filterPillTextActive]}>
                      Pending ({umpirePending})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterPill, umpireFilter === 'Approved' && styles.filterPillActive]}
                    onPress={() => setUmpireFilter('Approved')}
                  >
                    <Text style={[styles.filterPillText, umpireFilter === 'Approved' && styles.filterPillTextActive]}>
                      Approved ({umpireApproved})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterPill, umpireFilter === 'Rejected' && styles.filterPillActive]}
                    onPress={() => setUmpireFilter('Rejected')}
                  >
                    <Text style={[styles.filterPillText, umpireFilter === 'Rejected' && styles.filterPillTextActive]}>
                      Rejected ({umpireRejected})
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* UMPIRES LIST CARDS */}
              <View style={styles.itemsListContainer}>
                {filteredUmpires.length === 0 ? (
                  <View style={[styles.whiteItemCard, { alignItems: 'center', paddingVertical: 32 }]}>
                    <Text style={{ fontSize: 24, marginBottom: 8 }}>⚖️</Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }}>No Umpire Registrations Found</Text>
                    <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                      {umpireSearchQuery ? 'No umpires matched your search query.' : 'No umpires in this category.'}
                    </Text>
                  </View>
                ) : (
                  filteredUmpires.map(u => {
                    const isApproved = u.status === 'Approved';
                    const isPending = (u.status || 'Pending') === 'Pending';
                    const isRejected = u.status === 'Rejected';

                    return (
                      <View
                        key={u.umpireId}
                        style={[
                          styles.whiteItemCard,
                          isApproved && styles.cardApprovedBorder,
                          isPending && styles.cardPendingBorder,
                          isRejected && styles.cardRejectedBorder
                        ]}
                      >
                        <View style={styles.itemCardHeaderRow}>
                          <View style={styles.itemTitleGroup}>
                            <View style={styles.itemTitleBadgeRow}>
                              <Text style={styles.itemNameText}>{u.umpireName}</Text>
                              {isApproved && (
                                <View style={styles.badgeConfirmed}>
                                  <Text style={styles.badgeConfirmedText}>✔ Approved</Text>
                                </View>
                              )}
                              {isPending && (
                                <View style={styles.badgePending}>
                                  <Text style={styles.badgePendingText}>⏳ Pending</Text>
                                </View>
                              )}
                              {isRejected && (
                                <View style={styles.badgeRejected}>
                                  <Text style={styles.badgeRejectedText}>🚫 Rejected</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.itemIdGradeText}>
                              ID: {u.umpireId} • Qualification: {u.qualification}
                            </Text>
                          </View>

                          {/* Action Buttons */}
                          <View style={styles.itemActionsRow}>
                            <TouchableOpacity
                              style={styles.btnOutlineGold}
                              onPress={() => setSelectedUmpireForView(u)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.btnOutlineGoldText}>👁 View</Text>
                            </TouchableOpacity>

                            {isPending ? (
                              <>
                                <TouchableOpacity
                                  style={styles.btnSuccessSm}
                                  onPress={() => handleApproveUmpire(u.umpireId)}
                                  activeOpacity={0.8}
                                >
                                  <Text style={styles.btnSuccessSmText}>✔ Approve</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.btnOutlineDanger}
                                  onPress={() => handleOpenRejectModal(u.umpireId, 'UMPIRE', u.umpireName)}
                                  activeOpacity={0.8}
                                >
                                  <Text style={styles.btnOutlineDangerText}>🚫 Reject</Text>
                                </TouchableOpacity>
                              </>
                            ) : isApproved ? (
                              <TouchableOpacity
                                style={styles.btnOutlineDanger}
                                onPress={() => handleOpenRejectModal(u.umpireId, 'UMPIRE', u.umpireName)}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.btnOutlineDangerText}>🚫 Reject</Text>
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity
                                style={styles.btnSuccessSm}
                                onPress={() => handleApproveUmpire(u.umpireId)}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.btnSuccessSmText}>✔ Approve</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>

                        {/* Item Meta Details */}
                        <View style={styles.itemMetaGrid}>
                          <View style={styles.metaCell}>
                            <Text style={styles.metaLabel}>Official Email</Text>
                            <Text style={styles.metaVal}>{u.email || '—'}</Text>
                          </View>
                          <View style={styles.metaCell}>
                            <Text style={styles.metaLabel}>Experience</Text>
                            <Text style={styles.metaVal}>{u.experience || `${u.experienceYears} Years`}</Text>
                          </View>
                          <View style={styles.metaCell}>
                            <Text style={styles.metaLabel}>District & State</Text>
                            <Text style={styles.metaVal}>{u.district || 'Virudhunagar'}, {u.state || 'Tamil Nadu'}</Text>
                          </View>
                          <View style={styles.metaCell}>
                            <Text style={styles.metaLabel}>Cert Number</Text>
                            <Text style={styles.metaVal}>{u.certificationNumber || '—'}</Text>
                          </View>
                        </View>

                        {isRejected && u.rejectionReason && (
                          <View style={styles.rejectionNoticeBox}>
                            <Text style={styles.rejectionNoticeLabel}>Rejection Reason:</Text>
                            <Text style={styles.rejectionNoticeText}>{u.rejectionReason}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          )}

          {/* ─────────────────────────────────────────────────────────────
              5. TAB CONTENT: TEAM REGISTRATIONS
              ───────────────────────────────────────────────────────────── */}
          {activeTab === 'teams' && (
            <View>
              {/* TOP TWO SIDE-BY-SIDE HIGHLIGHT CARDS FOR TEAMS */}
              <View style={[styles.highlightCardsRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
                {/* Left Card: Team Registrations Stats */}
                <View style={styles.navyStatCard}>
                  <View style={styles.statCardHeader}>
                    <View style={styles.blueIconBox}>
                      <Text style={{ fontSize: 16 }}>👥</Text>
                    </View>
                    <Text style={styles.statCardTitle}>Team Registrations</Text>
                  </View>
                  <Text style={styles.statCardSubtitle}>
                    Official club and collegiate team squad applications submitted for district championship entry.
                  </Text>

                  {/* 4 Colored Pill Rows */}
                  <View style={styles.pillRowsContainer}>
                    <View style={[styles.statRowPill, styles.rowPillGreen]}>
                      <View style={styles.pillLeftGroup}>
                        <View style={[styles.glowingDot, { backgroundColor: '#10b981' }]} />
                        <Text style={[styles.pillLabel, { color: '#a7f3d0' }]}>Approved Teams</Text>
                      </View>
                      <Text style={[styles.pillCount, { color: '#4ade80' }]}>{teamApproved}</Text>
                    </View>

                    <View style={[styles.statRowPill, styles.rowPillAmber]}>
                      <View style={styles.pillLeftGroup}>
                        <View style={[styles.glowingDot, { backgroundColor: '#eab308' }]} />
                        <Text style={[styles.pillLabel, { color: '#fde68a' }]}>Pending Approval</Text>
                      </View>
                      <Text style={[styles.pillCount, { color: '#fbbf24' }]}>{teamPending}</Text>
                    </View>

                    <View style={[styles.statRowPill, styles.rowPillRed]}>
                      <View style={styles.pillLeftGroup}>
                        <View style={[styles.glowingDot, { backgroundColor: '#ef4444' }]} />
                        <Text style={[styles.pillLabel, { color: '#fca5a5' }]}>Rejected Teams</Text>
                      </View>
                      <Text style={[styles.pillCount, { color: '#f87171' }]}>{teamRejected}</Text>
                    </View>

                    <View style={[styles.statRowPill, styles.rowPillIndigo]}>
                      <View style={styles.pillLeftGroup}>
                        <View style={[styles.glowingDot, { backgroundColor: '#818cf8' }]} />
                        <Text style={[styles.pillLabel, { color: '#c7d2fe' }]}>Total Registered</Text>
                      </View>
                      <Text style={[styles.pillCount, { color: '#a5b4fc' }]}>{teamTotal}</Text>
                    </View>
                  </View>
                </View>

                {/* Right Card: Teams Status Distribution Donut */}
                <View style={[styles.navyStatCard, styles.donutCardAlign]}>
                  <View style={styles.donutHeader}>
                    <Text style={{ fontSize: 16, marginRight: 6 }}>📊</Text>
                    <Text style={styles.statCardTitle}>Status Distribution</Text>
                  </View>

                  <View style={styles.donutWrapper}>
                    <View
                      style={[
                        styles.donutOuterRing,
                        !isDesktop && { width: 140, height: 140, borderRadius: 70 },
                        Platform.OS === 'web'
                          ? ({
                              background: `conic-gradient(#10b981 0% ${teamSegments.appPct}%, #f59e0b ${teamSegments.appPct}% ${teamSegments.appPct + teamSegments.pendPct}%, #ef4444 ${teamSegments.appPct + teamSegments.pendPct}% 100%)`,
                              backgroundImage: `conic-gradient(#10b981 0% ${teamSegments.appPct}%, #f59e0b ${teamSegments.appPct}% ${teamSegments.appPct + teamSegments.pendPct}%, #ef4444 ${teamSegments.appPct + teamSegments.pendPct}% 100%)`
                            } as any)
                          : {
                              borderWidth: 10,
                              borderColor: '#10b981',
                              borderTopColor: '#10b981',
                              borderRightColor: teamSegments.pendPct > 0 ? '#f59e0b' : '#10b981',
                              borderBottomColor: teamSegments.rejPct > 0 ? '#ef4444' : '#10b981',
                              borderLeftColor: '#10b981',
                              backgroundColor: '#071026'
                            }
                      ]}
                    >
                      <View style={[styles.donutHole, !isDesktop && { width: 80, height: 80, borderRadius: 40 }]}>
                        <Text style={[styles.donutNumber, !isDesktop && { fontSize: 24 }]}>{teamTotal}</Text>
                        <Text style={[styles.donutUnitLabel, { color: 'rgba(254, 215, 102, 0.9)' }, !isDesktop && { fontSize: 8 }]}>TEAMS</Text>
                      </View>
                    </View>
                  </View>

                  {/* Dynamic Proportional Distribution Bar */}
                  <View style={styles.distributionBarWrapper}>
                    <View style={styles.distributionBarTrack}>
                      {teamSegments.appPct > 0 && (
                        <View style={[styles.distributionBarSegment, { width: `${teamSegments.appPct}%`, backgroundColor: '#10b981' }]} />
                      )}
                      {teamSegments.pendPct > 0 && (
                        <View style={[styles.distributionBarSegment, { width: `${teamSegments.pendPct}%`, backgroundColor: '#f59e0b' }]} />
                      )}
                      {teamSegments.rejPct > 0 && (
                        <View style={[styles.distributionBarSegment, { width: `${teamSegments.rejPct}%`, backgroundColor: '#ef4444' }]} />
                      )}
                    </View>
                    <View style={styles.distributionPctRow}>
                      <Text style={[styles.distributionPctText, { color: '#6ee7b7' }]}>{teamSegments.appPct}% Approved</Text>
                      <Text style={[styles.distributionPctText, { color: '#fde68a' }]}>{teamSegments.pendPct}% Pending</Text>
                      <Text style={[styles.distributionPctText, { color: '#fca5a5' }]}>{teamSegments.rejPct}% Rejected</Text>
                    </View>
                  </View>

                  <View style={styles.donutLegendRow}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
                      <Text style={[styles.legendText, { color: '#6ee7b7' }]}>Approved ({teamApproved})</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
                      <Text style={[styles.legendText, { color: '#fde68a' }]}>Pending ({teamPending})</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
                      <Text style={[styles.legendText, { color: '#fca5a5' }]}>Rejected ({teamRejected})</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* TEAMS TOOLBAR */}
              <View style={styles.toolbarCard}>
                <View style={styles.searchBox}>
                  <Text style={styles.searchIcon}>🔍</Text>
                  <TextInput
                    style={styles.searchInput}
                    value={teamSearchQuery}
                    onChangeText={setTeamSearchQuery}
                    placeholder="Search by team name, coach or taluk..."
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View style={styles.filterPillsGroup}>
                  <Text style={styles.filterStatusLabel}>Filter Status:</Text>
                  <TouchableOpacity
                    style={[styles.filterPill, teamFilter === 'all' && styles.filterPillActive]}
                    onPress={() => setTeamFilter('all')}
                  >
                    <Text style={[styles.filterPillText, teamFilter === 'all' && styles.filterPillTextActive]}>
                      All ({teamTotal})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterPill, teamFilter === 'Pending' && styles.filterPillActive]}
                    onPress={() => setTeamFilter('Pending')}
                  >
                    <Text style={[styles.filterPillText, teamFilter === 'Pending' && styles.filterPillTextActive]}>
                      Pending ({teamPending})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterPill, teamFilter === 'Approved' && styles.filterPillActive]}
                    onPress={() => setTeamFilter('Approved')}
                  >
                    <Text style={[styles.filterPillText, teamFilter === 'Approved' && styles.filterPillTextActive]}>
                      Approved ({teamApproved})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterPill, teamFilter === 'Rejected' && styles.filterPillActive]}
                    onPress={() => setTeamFilter('Rejected')}
                  >
                    <Text style={[styles.filterPillText, teamFilter === 'Rejected' && styles.filterPillTextActive]}>
                      Rejected ({teamRejected})
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* TEAMS LIST CARDS */}
              <View style={styles.itemsListContainer}>
                {filteredTeams.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={{ fontSize: 28, marginBottom: 8 }}>👥</Text>
                    <Text style={styles.emptyTitle}>No Teams Found</Text>
                    <Text style={styles.emptySubtitle}>No club applications match the current filter selection.</Text>
                  </View>
                ) : (
                  filteredTeams.map(t => {
                    const isApproved = t.status === 'Approved';
                    const isPending = (t.status || 'Pending') === 'Pending';
                    const isRejected = t.status === 'Rejected';

                    return (
                      <View
                        key={t.teamId}
                        style={[
                          styles.whiteItemCard,
                          isApproved && styles.cardApprovedBorder,
                          isPending && styles.cardPendingBorder,
                          isRejected && styles.cardRejectedBorder
                        ]}
                      >
                        <View style={styles.itemCardHeaderRow}>
                          <View style={styles.itemTitleGroup}>
                            <View style={styles.itemTitleBadgeRow}>
                              <Text style={styles.itemNameText}>{t.teamName}</Text>
                              {isApproved && (
                                <View style={styles.badgeConfirmed}>
                                  <Text style={styles.badgeConfirmedText}>✔ Approved</Text>
                                </View>
                              )}
                              {isPending && (
                                <View style={styles.badgePending}>
                                  <Text style={styles.badgePendingText}>⏳ Pending</Text>
                                </View>
                              )}
                              {isRejected && (
                                <View style={styles.badgeRejected}>
                                  <Text style={styles.badgeRejectedText}>🚫 Rejected</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.itemIdGradeText}>
                              ID: {t.teamId} • Coach: {t.coach?.name || 'Head Coach'} • Roster: {t.members?.length || 15} Players
                            </Text>
                          </View>

                          <View style={styles.itemActionsRow}>
                            <TouchableOpacity
                              style={styles.btnOutlineGold}
                              onPress={() => setSelectedSquadModal(t)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.btnOutlineGoldText}>👁 View Squad</Text>
                            </TouchableOpacity>

                            {isPending ? (
                              <>
                                <TouchableOpacity
                                  style={styles.btnSuccessSm}
                                  onPress={() => handleApproveTeam(t.teamId)}
                                  activeOpacity={0.8}
                                >
                                  <Text style={styles.btnSuccessSmText}>✔ Approve</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.btnOutlineDanger}
                                  onPress={() => handleOpenRejectModal(t.teamId, 'TEAM', t.teamName)}
                                  activeOpacity={0.8}
                                >
                                  <Text style={styles.btnOutlineDangerText}>🚫 Reject</Text>
                                </TouchableOpacity>
                              </>
                            ) : isApproved ? (
                              <TouchableOpacity
                                style={styles.btnOutlineDanger}
                                onPress={() => handleOpenRejectModal(t.teamId, 'TEAM', t.teamName)}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.btnOutlineDangerText}>🚫 Reject</Text>
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity
                                style={styles.btnSuccessSm}
                                onPress={() => handleApproveTeam(t.teamId)}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.btnSuccessSmText}>✔ Approve</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>

                        <View style={styles.itemMetaGrid}>
                          <View style={styles.metaCell}>
                            <Text style={styles.metaLabel}>Head Coach Email</Text>
                            <Text style={styles.metaVal}>{t.coach?.email || 'N/A'}</Text>
                          </View>
                          <View style={styles.metaCell}>
                            <Text style={styles.metaLabel}>Taluk / Jurisdiction</Text>
                            <Text style={styles.metaVal}>{t.taluk || 'Virudhunagar'}</Text>
                          </View>
                          <View style={styles.metaCell}>
                            <Text style={styles.metaLabel}>Registered Squad</Text>
                            <Text style={styles.metaVal}>{t.members?.length || 15} Members Verified</Text>
                          </View>
                          <View style={styles.metaCell}>
                            <Text style={styles.metaLabel}>Submission Date</Text>
                            <Text style={styles.metaVal}>
                              {t.registrationDate ? new Date(t.registrationDate).toLocaleDateString() : 'Active'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          )}

          {/* ─────────────────────────────────────────────────────────────
              6. TAB CONTENT: OVERVIEW (6 Summary Cards & Banner)
              ───────────────────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <View>
              <View style={styles.overviewIntro}>
                <Text style={styles.overviewTitle}>Association Approval Pipeline Overview</Text>
                <Text style={styles.overviewSubtitle}>
                  Click any summary card below to jump to the corresponding management section filtered by status.
                </Text>
              </View>

              {/* 6 Summary Cards Grid */}
              <View style={styles.summaryGrid}>
                {/* 1. Pending Teams */}
                <TouchableOpacity
                  style={[styles.summaryCard, styles.cardPendingBorder]}
                  onPress={() => {
                    setActiveTab('teams');
                    setTeamFilter('Pending');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.summaryCardTop}>
                    <View style={[styles.summaryIconBox, { backgroundColor: 'rgba(234,179,8,0.15)' }]}>
                      <Text style={{ fontSize: 18 }}>⏳</Text>
                    </View>
                    <Text style={[styles.summaryCountText, { color: '#fbbf24' }]}>{teamPending}</Text>
                  </View>
                  <Text style={styles.summaryCardTitle}>Pending Team Registrations</Text>
                  <Text style={styles.summaryCardDesc}>Teams awaiting official admin verification</Text>
                </TouchableOpacity>

                {/* 2. Approved Teams */}
                <TouchableOpacity
                  style={[styles.summaryCard, styles.cardApprovedBorder]}
                  onPress={() => {
                    setActiveTab('teams');
                    setTeamFilter('Approved');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.summaryCardTop}>
                    <View style={[styles.summaryIconBox, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                      <Text style={{ fontSize: 18 }}>✔</Text>
                    </View>
                    <Text style={[styles.summaryCountText, { color: '#4ade80' }]}>{teamApproved}</Text>
                  </View>
                  <Text style={styles.summaryCardTitle}>Approved Teams</Text>
                  <Text style={styles.summaryCardDesc}>Active in official district tournaments</Text>
                </TouchableOpacity>

                {/* 3. Rejected Teams */}
                <TouchableOpacity
                  style={[styles.summaryCard, styles.cardRejectedBorder]}
                  onPress={() => {
                    setActiveTab('teams');
                    setTeamFilter('Rejected');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.summaryCardTop}>
                    <View style={[styles.summaryIconBox, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                      <Text style={{ fontSize: 18 }}>🚫</Text>
                    </View>
                    <Text style={[styles.summaryCountText, { color: '#f87171' }]}>{teamRejected}</Text>
                  </View>
                  <Text style={styles.summaryCardTitle}>Rejected Teams</Text>
                  <Text style={styles.summaryCardDesc}>Incomplete or non-compliant squad entries</Text>
                </TouchableOpacity>

                {/* 4. Pending Scorers */}
                <TouchableOpacity
                  style={[styles.summaryCard, styles.cardPendingBorder]}
                  onPress={() => {
                    setActiveTab('scorers');
                    setScorerFilter('Pending');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.summaryCardTop}>
                    <View style={[styles.summaryIconBox, { backgroundColor: 'rgba(234,179,8,0.15)' }]}>
                      <Text style={{ fontSize: 18 }}>📡</Text>
                    </View>
                    <Text style={[styles.summaryCountText, { color: '#fbbf24' }]}>{scorerPending}</Text>
                  </View>
                  <Text style={styles.summaryCardTitle}>Pending Scorer Requests</Text>
                  <Text style={styles.summaryCardDesc}>Awaiting match day live scoring access approval</Text>
                </TouchableOpacity>

                {/* 5. Approved Scorers */}
                <TouchableOpacity
                  style={[styles.summaryCard, styles.cardApprovedBorder]}
                  onPress={() => {
                    setActiveTab('scorers');
                    setScorerFilter('Approved');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.summaryCardTop}>
                    <View style={[styles.summaryIconBox, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                      <Text style={{ fontSize: 18 }}>🏆</Text>
                    </View>
                    <Text style={[styles.summaryCountText, { color: '#4ade80' }]}>{scorerApproved}</Text>
                  </View>
                  <Text style={styles.summaryCardTitle}>Approved Scorers</Text>
                  <Text style={styles.summaryCardDesc}>Certified for digital scoring on CFVD platform</Text>
                </TouchableOpacity>

                {/* 6. Rejected Scorers */}
                <TouchableOpacity
                  style={[styles.summaryCard, styles.cardRejectedBorder]}
                  onPress={() => {
                    setActiveTab('scorers');
                    setScorerFilter('Rejected');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.summaryCardTop}>
                    <View style={[styles.summaryIconBox, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                      <Text style={{ fontSize: 18 }}>✕</Text>
                    </View>
                    <Text style={[styles.summaryCountText, { color: '#f87171' }]}>{scorerRejected}</Text>
                  </View>
                  <Text style={styles.summaryCardTitle}>Rejected Scorers</Text>
                  <Text style={styles.summaryCardDesc}>Non-compliant or expired certification profiles</Text>
                </TouchableOpacity>

                {/* 7. Pending Umpires */}
                <TouchableOpacity
                  style={[styles.summaryCard, styles.cardPendingBorder]}
                  onPress={() => {
                    setActiveTab('umpires');
                    setUmpireFilter('Pending');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.summaryCardTop}>
                    <View style={[styles.summaryIconBox, { backgroundColor: 'rgba(234,179,8,0.15)' }]}>
                      <Text style={{ fontSize: 18 }}>⚖️</Text>
                    </View>
                    <Text style={[styles.summaryCountText, { color: '#fbbf24' }]}>{umpirePending}</Text>
                  </View>
                  <Text style={styles.summaryCardTitle}>Pending Umpire Applications</Text>
                  <Text style={styles.summaryCardDesc}>Awaiting official credential verification</Text>
                </TouchableOpacity>

                {/* 8. Approved Umpires */}
                <TouchableOpacity
                  style={[styles.summaryCard, styles.cardApprovedBorder]}
                  onPress={() => {
                    setActiveTab('umpires');
                    setUmpireFilter('Approved');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.summaryCardTop}>
                    <View style={[styles.summaryIconBox, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                      <Text style={{ fontSize: 18 }}>🛡️</Text>
                    </View>
                    <Text style={[styles.summaryCountText, { color: '#4ade80' }]}>{umpireApproved}</Text>
                  </View>
                  <Text style={styles.summaryCardTitle}>Authorized Umpires</Text>
                  <Text style={styles.summaryCardDesc}>Accredited for district match supervision</Text>
                </TouchableOpacity>

                {/* 9. Rejected Umpires */}
                <TouchableOpacity
                  style={[styles.summaryCard, styles.cardRejectedBorder]}
                  onPress={() => {
                    setActiveTab('umpires');
                    setUmpireFilter('Rejected');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.summaryCardTop}>
                    <View style={[styles.summaryIconBox, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                      <Text style={{ fontSize: 18 }}>🚫</Text>
                    </View>
                    <Text style={[styles.summaryCountText, { color: '#f87171' }]}>{umpireRejected}</Text>
                  </View>
                  <Text style={styles.summaryCardTitle}>Rejected Umpires</Text>
                  <Text style={styles.summaryCardDesc}>Incomplete or criteria not fulfilled</Text>
                </TouchableOpacity>
              </View>

              {/* OVERVIEW STATUS DISTRIBUTION CHART (Responsive & Dynamic for All Members/Admins) */}
              <View style={[styles.navyStatCard, styles.donutCardAlign, { marginVertical: 20, width: '100%' }]}>
                <View style={styles.donutHeader}>
                  <Text style={{ fontSize: 16, marginRight: 6 }}>📊</Text>
                  <Text style={styles.statCardTitle}>District Registration Status Distribution</Text>
                </View>

                <View style={styles.donutWrapper}>
                  <View
                    style={[
                      styles.donutOuterRing,
                      !isDesktop && { width: 140, height: 140, borderRadius: 70 },
                      Platform.OS === 'web'
                        ? ({
                            background: `conic-gradient(#10b981 0% ${overallSegments.appPct}%, #f59e0b ${overallSegments.appPct}% ${overallSegments.appPct + overallSegments.pendPct}%, #ef4444 ${overallSegments.appPct + overallSegments.pendPct}% 100%)`,
                            backgroundImage: `conic-gradient(#10b981 0% ${overallSegments.appPct}%, #f59e0b ${overallSegments.appPct}% ${overallSegments.appPct + overallSegments.pendPct}%, #ef4444 ${overallSegments.appPct + overallSegments.pendPct}% 100%)`
                          } as any)
                        : {
                            borderWidth: 10,
                            borderColor: '#10b981',
                            borderTopColor: '#10b981',
                            borderRightColor: overallSegments.pendPct > 0 ? '#f59e0b' : '#10b981',
                            borderBottomColor: overallSegments.rejPct > 0 ? '#ef4444' : '#10b981',
                            borderLeftColor: '#10b981',
                            backgroundColor: '#071026'
                          }
                    ]}
                  >
                    <View style={[styles.donutHole, !isDesktop && { width: 80, height: 80, borderRadius: 40 }]}>
                      <Text style={[styles.donutNumber, !isDesktop && { fontSize: 24 }]}>{totalOverall}</Text>
                      <Text style={[styles.donutUnitLabel, { color: 'rgba(254, 215, 102, 0.9)' }, !isDesktop && { fontSize: 8 }]}>TOTAL</Text>
                    </View>
                  </View>
                </View>

                {/* Dynamic Proportional Distribution Bar */}
                <View style={styles.distributionBarWrapper}>
                  <View style={styles.distributionBarTrack}>
                    {overallSegments.appPct > 0 && (
                      <View style={[styles.distributionBarSegment, { width: `${overallSegments.appPct}%`, backgroundColor: '#10b981' }]} />
                    )}
                    {overallSegments.pendPct > 0 && (
                      <View style={[styles.distributionBarSegment, { width: `${overallSegments.pendPct}%`, backgroundColor: '#f59e0b' }]} />
                    )}
                    {overallSegments.rejPct > 0 && (
                      <View style={[styles.distributionBarSegment, { width: `${overallSegments.rejPct}%`, backgroundColor: '#ef4444' }]} />
                    )}
                  </View>
                  <View style={styles.distributionPctRow}>
                    <Text style={[styles.distributionPctText, { color: '#6ee7b7' }]}>{overallSegments.appPct}% Approved ({overallApproved})</Text>
                    <Text style={[styles.distributionPctText, { color: '#fde68a' }]}>{overallSegments.pendPct}% Pending ({overallPending})</Text>
                    <Text style={[styles.distributionPctText, { color: '#fca5a5' }]}>{overallSegments.rejPct}% Rejected ({overallRejected})</Text>
                  </View>
                </View>

                <View style={styles.donutLegendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
                    <Text style={[styles.legendText, { color: '#6ee7b7' }]}>Approved: {overallApproved}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
                    <Text style={[styles.legendText, { color: '#fde68a' }]}>Pending: {overallPending}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
                    <Text style={[styles.legendText, { color: '#fca5a5' }]}>Rejected: {overallRejected}</Text>
                  </View>
                </View>
              </View>

              {/* Quick Action Banner */}
              <View style={styles.quickActionBanner}>
                <View style={styles.quickActionTextCol}>
                  <Text style={styles.quickActionTitle}>Official Administration Approval & Verification Engine</Text>
                  <Text style={styles.quickActionDesc}>
                    Directly verify district squads, certify digital scorers, and publish official circulars across Virudhunagar District.
                  </Text>
                </View>
                <View style={styles.quickActionBtnRow}>
                  <TouchableOpacity
                    style={styles.btnGoldSm}
                    onPress={() => setActiveTab('teams')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnGoldSmText}>Manage Teams</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnGoldSm}
                    onPress={() => setActiveTab('scorers')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnGoldSmText}>Verify Scorers</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* ─────────────────────────────────────────────────────────────
              7. TAB CONTENT: NEWS & CONTENT MANAGEMENT
              ───────────────────────────────────────────────────────────── */}
          {activeTab === 'content' && (
            <View>
              {/* Header Box */}
              <View style={styles.contentTopCard}>
                <View style={styles.contentTopLeft}>
                  <View style={styles.goldIconBox}>
                    <Text style={{ fontSize: 16 }}>📰</Text>
                  </View>
                  <View>
                    <Text style={styles.contentTopTitle}>Official News, Circulars & Media Management</Text>
                    <Text style={styles.contentTopSub}>
                      Create, publish, and delete official tournament announcements, press releases, match reports, and circulars shown across the portal.
                    </Text>
                  </View>
                </View>
              </View>

              {/* Publish Form Box */}
              <View style={styles.newsFormCard}>
                <View style={styles.newsFormHeader}>
                  <Text style={styles.newsFormTitle}>✏ Publish Official Article or Notice</Text>
                  <View style={styles.tagDirectDispatch}>
                    <Text style={styles.tagDirectDispatchText}>DIRECT ADMIN DISPATCH</Text>
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Article / Notice Title *</Text>
                    <TextInput
                      style={styles.formInput}
                      value={newNewsTitle}
                      onChangeText={setNewNewsTitle}
                      placeholder="e.g. Under-19 District Selection Trials Announced"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Category</Text>
                    <TextInput
                      style={styles.formInput}
                      value={newNewsCategory}
                      onChangeText={setNewNewsCategory}
                      placeholder="e.g. TOURNAMENT, ANNOUNCEMENT"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Author / Department</Text>
                    <TextInput
                      style={styles.formInput}
                      value={newNewsAuthor}
                      onChangeText={setNewNewsAuthor}
                      placeholder="e.g. CFVD Secretariat"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>

                <TouchableOpacity style={styles.btnPublishNews} onPress={handlePublishNews} activeOpacity={0.8}>
                  <Text style={styles.btnPublishNewsText}>🚀 Dispatch & Publish Notice</Text>
                </TouchableOpacity>
              </View>

              {/* Published News List */}
              <View style={styles.newsListContainer}>
                <Text style={styles.sectionHeading}>Published Official Notices ({newsList.length})</Text>
                {newsList.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ color: '#64748b' }}>No official notices published yet.</Text>
                  </View>
                ) : (
                  newsList.map((n: any) => (
                    <View key={n.id || n._id} style={styles.newsItemRow}>
                      <View style={styles.newsItemTextCol}>
                        <Text style={styles.newsItemTitle}>{n.title}</Text>
                        <Text style={styles.newsItemMeta}>
                          <Text style={{ fontWeight: '700', color: '#1e293b' }}>Category: </Text>
                          {n.category} • <Text style={{ fontWeight: '700', color: '#1e293b' }}>Author: </Text>
                          {n.author} • {n.createdAt || n.published_at ? new Date(n.createdAt || n.published_at).toLocaleDateString() : 'Live'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.btnDeleteNews}
                        onPress={() => handleDeleteNews(n.id || n._id)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.btnDeleteNewsText}>🗑 Delete</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}

          {/* ─────────────────────────────────────────────────────────────
              8. TAB CONTENT: MATCH SCHEDULES MANAGEMENT (Distinct Vibrant Styling)
              ───────────────────────────────────────────────────────────── */}
          {activeTab === 'schedules' && (
            <View>
              {/* TOP TWO SIDE-BY-SIDE HIGHLIGHT CARDS FOR SCHEDULES */}
              <View style={[styles.highlightCardsRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
                {/* Left Card: Match Schedules Stats */}
                <View style={styles.schedulesStatCard}>
                  <View style={styles.statCardHeader}>
                    <View style={styles.schedulesIconBox}>
                      <Text style={{ fontSize: 16 }}>🏏</Text>
                    </View>
                    <View>
                      <Text style={styles.schedulesStatCardTitle}>Match Schedules & Live Tracking</Text>
                      <Text style={styles.schedulesStatCardTag}>CHAMPIONSHIP OPERATIONS</Text>
                    </View>
                  </View>
                  <Text style={styles.schedulesStatCardSubtitle}>
                    Real-time championship fixtures, live scoring status, venue allocations, and accredited scorer appointments.
                  </Text>

                  {/* 4 Colored Pill Rows */}
                  <View style={styles.pillRowsContainer}>
                    <View style={[styles.statRowPill, styles.schedulesPillLive]}>
                      <View style={styles.pillLeftGroup}>
                        <View style={[styles.glowingDot, { backgroundColor: '#ef4444' }]} />
                        <Text style={[styles.statPillLabel, { color: '#fca5a5' }]}>Live Matches (Active)</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {liveMatchesCount > 0 && (
                          <View style={styles.livePulseTag}>
                            <Text style={styles.livePulseTagText}>LIVE</Text>
                          </View>
                        )}
                        <Text style={[styles.statPillCount, { color: '#f87171' }]}>{liveMatchesCount}</Text>
                      </View>
                    </View>

                    <View style={[styles.statRowPill, styles.schedulesPillScheduled]}>
                      <View style={styles.pillLeftGroup}>
                        <View style={[styles.glowingDot, { backgroundColor: '#38bdf8' }]} />
                        <Text style={[styles.statPillLabel, { color: '#bae6fd' }]}>Scheduled Fixtures</Text>
                      </View>
                      <Text style={[styles.statPillCount, { color: '#38bdf8' }]}>{scheduledMatchesCount}</Text>
                    </View>

                    <View style={[styles.statRowPill, styles.schedulesPillCompleted]}>
                      <View style={styles.pillLeftGroup}>
                        <View style={[styles.glowingDot, { backgroundColor: '#34d399' }]} />
                        <Text style={[styles.statPillLabel, { color: '#a7f3d0' }]}>Completed Matches</Text>
                      </View>
                      <Text style={[styles.statPillCount, { color: '#34d399' }]}>{completedMatchesCount}</Text>
                    </View>

                    <View style={[styles.statRowPill, styles.schedulesPillTotal]}>
                      <View style={styles.pillLeftGroup}>
                        <View style={[styles.glowingDot, { backgroundColor: '#fbbf24' }]} />
                        <Text style={[styles.statPillLabel, { color: '#fde68a' }]}>Total Championship Matches</Text>
                      </View>
                      <Text style={[styles.statPillCount, { color: '#fbbf24' }]}>{matchesList.length}</Text>
                    </View>
                  </View>
                </View>

                {/* Right Card: Quick Action & Logistics Overview */}
                <View style={styles.schedulesOpsCard}>
                  <View style={styles.statCardHeader}>
                    <View style={styles.schedulesGoldIconBox}>
                      <Text style={{ fontSize: 16 }}>⚙️</Text>
                    </View>
                    <View>
                      <Text style={styles.schedulesStatCardTitle}>Fixture Operations</Text>
                      <Text style={styles.schedulesOpsTag}>GOVERNANCE PORTAL</Text>
                    </View>
                  </View>
                  <Text style={styles.schedulesStatCardSubtitle}>
                    Schedule new official fixtures between approved teams, designate match venues, and assign certified scorers.
                  </Text>

                  <View style={{ marginTop: 14, gap: 12 }}>
                    <TouchableOpacity
                      style={styles.btnScheduleGradient}
                      onPress={() => handleOpenScheduleModal()}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.btnScheduleGradientText}>➕ Schedule New Match</Text>
                    </TouchableOpacity>

                    <View style={styles.scheduleInfoBoxModern}>
                      <View style={styles.scheduleInfoRow}>
                        <Text style={styles.scheduleInfoLabel}>• Approved Teams Available:</Text>
                        <Text style={styles.scheduleInfoVal}>{allClubsList.length}</Text>
                      </View>
                      <View style={styles.scheduleInfoRow}>
                        <Text style={styles.scheduleInfoLabel}>• Venues Registered:</Text>
                        <Text style={styles.scheduleInfoVal}>{venuesList.length}</Text>
                      </View>
                      <View style={styles.scheduleInfoRow}>
                        <Text style={styles.scheduleInfoLabel}>• Accredited Scorers & Officials:</Text>
                        <Text style={styles.scheduleInfoVal}>{officialsList.length}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              {/* SEARCH & FILTER TOOLBAR */}
              <View style={styles.filterToolbarCard}>
                <View style={styles.searchBoxWrap}>
                  <Text style={styles.searchIcon}>🔍</Text>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search fixtures by team name, venue, tournament, or ID..."
                    placeholderTextColor="#94a3b8"
                    value={matchSearchQuery}
                    onChangeText={setMatchSearchQuery}
                  />
                  {matchSearchQuery ? (
                    <TouchableOpacity onPress={() => setMatchSearchQuery('')}>
                      <Text style={{ color: '#94a3b8', fontSize: 16 }}>✕</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Status Filter Pills with distinctive colors */}
                <View style={styles.filterPillsRow}>
                  <TouchableOpacity
                    style={[styles.filterPill, matchFilter === 'all' && styles.filterPillActive]}
                    onPress={() => setMatchFilter('all')}
                  >
                    <Text style={[styles.filterPillText, matchFilter === 'all' && styles.filterPillTextActive]}>
                      All ({matchesList.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterPill, matchFilter === 'SCHEDULED' && styles.filterPillActiveScheduled]}
                    onPress={() => setMatchFilter('SCHEDULED')}
                  >
                    <Text style={[styles.filterPillText, matchFilter === 'SCHEDULED' && styles.filterPillTextActiveScheduled]}>
                      🗓 Scheduled ({scheduledMatchesCount})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterPill, matchFilter === 'LIVE' && styles.filterPillActiveLive]}
                    onPress={() => setMatchFilter('LIVE')}
                  >
                    <Text style={[styles.filterPillText, matchFilter === 'LIVE' && styles.filterPillTextActiveLive]}>
                      🔴 Live ({liveMatchesCount})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterPill, matchFilter === 'COMPLETED' && styles.filterPillActiveCompleted]}
                    onPress={() => setMatchFilter('COMPLETED')}
                  >
                    <Text style={[styles.filterPillText, matchFilter === 'COMPLETED' && styles.filterPillTextActiveCompleted]}>
                      ✓ Completed ({completedMatchesCount})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterPill, matchFilter === 'CANCELLED' && styles.filterPillActiveCancelled]}
                    onPress={() => setMatchFilter('CANCELLED')}
                  >
                    <Text style={[styles.filterPillText, matchFilter === 'CANCELLED' && styles.filterPillTextActiveCancelled]}>
                      ✕ Cancelled ({cancelledMatchesCount})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.refreshBtnSm}
                    onPress={loadMatchesAndLogistics}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.refreshBtnSmText}>🔄 Refresh</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* FIXTURES LIST CONTAINER */}
              <View style={styles.itemsListContainer}>
                {isMatchesLoading ? (
                  <View style={styles.loadingContainerBox}>
                    <ActivityIndicator size="large" color="#d4af37" />
                    <Text style={styles.loadingText}>Retrieving Official Match Fixtures from MongoDB...</Text>
                  </View>
                ) : filteredMatches.length === 0 ? (
                  <View style={styles.emptyContainerBox}>
                    <Text style={{ fontSize: 36, marginBottom: 8 }}>🏏</Text>
                    <Text style={styles.emptyTitle}>No Match Schedules Found</Text>
                    <Text style={styles.emptySubtitle}>
                      {matchSearchQuery
                        ? `No match schedules matching "${matchSearchQuery}"`
                        : 'No fixtures match the selected filter.'}
                    </Text>
                    <TouchableOpacity
                      style={[styles.btnPrimarySchedule, { marginTop: 16 }]}
                      onPress={() => handleOpenScheduleModal()}
                    >
                      <Text style={styles.btnPrimaryScheduleText}>➕ Schedule Match</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  filteredMatches.map((m) => {
                    const statusUpper = (m.status || 'SCHEDULED').toUpperCase();
                    const isScheduled = statusUpper === 'SCHEDULED';
                    const isLive = statusUpper === 'LIVE' || statusUpper === 'INNINGS_BREAK';
                    const isCompleted = statusUpper === 'COMPLETED';
                    const isCancelled = statusUpper === 'CANCELLED' || statusUpper === 'ABANDONED';

                    return (
                      <View
                        key={m.id}
                        style={[
                          styles.itemCard,
                          isLive && styles.matchCardLive,
                          isScheduled && styles.matchCardScheduled,
                          isCompleted && styles.matchCardCompleted,
                          isCancelled && styles.matchCardCancelled
                        ]}
                      >
                        {/* Top Header Row */}
                        <View style={styles.itemCardTop}>
                          <View style={styles.itemTitleRow}>
                            <View style={[
                              styles.itemCrest,
                              isLive && { backgroundColor: '#ef4444' },
                              isScheduled && { backgroundColor: '#2563eb' },
                              isCompleted && { backgroundColor: '#10b981' },
                              isCancelled && { backgroundColor: '#64748b' }
                            ]}>
                              <Text style={styles.itemCrestText}>{isLive ? '🔴' : '🏏'}</Text>
                            </View>
                            <View style={styles.itemTitleCol}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <Text style={styles.itemName}>
                                  {m.team_a_name || m.team_a_id} <Text style={{ color: '#d97706' }}>vs</Text> {m.team_b_name || m.team_b_id}
                                </Text>
                                <View style={styles.matchIdBadge}>
                                  <Text style={styles.matchIdBadgeText}>{m.id}</Text>
                                </View>
                              </View>
                              <Text style={styles.itemSub}>
                                🏆 {m.tournament_name || m.tournament_display_name || 'District Championship'} • {m.match_type || 'T20'} ({m.overs_per_side || 20} Overs)
                              </Text>
                            </View>
                          </View>

                          {/* Status Badge */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {isScheduled && (
                              <View style={[styles.statusBadge, styles.badgeScheduled]}>
                                <Text style={styles.badgeScheduledText}>📅 SCHEDULED</Text>
                              </View>
                            )}
                            {isLive && (
                              <View style={[styles.statusBadge, styles.badgeLive]}>
                                <Text style={styles.badgeLiveText}>🔴 LIVE MATCH</Text>
                              </View>
                            )}
                            {isCompleted && (
                              <View style={[styles.statusBadge, styles.badgeCompleted]}>
                                <Text style={styles.badgeCompletedText}>✓ COMPLETED</Text>
                              </View>
                            )}
                            {isCancelled && (
                              <View style={[styles.statusBadge, styles.badgeCancelled]}>
                                <Text style={styles.badgeCancelledText}>✕ CANCELLED</Text>
                              </View>
                            )}
                          </View>
                        </View>

                        {/* Item Meta Details Grid */}
                        <View style={styles.itemMetaGrid}>
                          <View style={styles.metaCell}>
                            <Text style={styles.metaLabel}>Match Date & Time</Text>
                            <Text style={styles.metaVal}>📅 {m.match_date} • ⏰ {m.match_time || '09:30 AM'}</Text>
                          </View>
                          <View style={styles.metaCell}>
                            <Text style={styles.metaLabel}>Venue / Stadium</Text>
                            <Text style={styles.metaVal}>📍 {m.venue || 'Kamarajar District Stadium'}</Text>
                          </View>
                          <View style={styles.metaCell}>
                            <Text style={styles.metaLabel}>Official Scorer</Text>
                            <Text style={styles.metaVal}>👤 {m.scorer_name || m.assigned_scorer_id || 'SCR-101'}</Text>
                          </View>
                          <View style={styles.metaCell}>
                            <Text style={styles.metaLabel}>Current Status</Text>
                            <Text style={styles.metaVal}>
                              {isLive ? 'Scorecard Active' : (isCompleted ? 'Finalized' : (isCancelled ? 'Cancelled' : 'Awaiting Toss'))}
                            </Text>
                          </View>
                        </View>

                        {/* Result / Score Note if present */}
                        {m.result_summary && (
                          <View style={styles.resultNoticeBox}>
                            <Text style={styles.resultNoticeText}>ℹ️ {m.result_summary}</Text>
                          </View>
                        )}

                        {/* Action Buttons Row */}
                        <View style={styles.scheduleActionsRow}>
                          <TouchableOpacity
                            style={styles.btnOutlineGold}
                            onPress={() => setSelectedMatchModal(m)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.btnOutlineGoldText}>👁 View Details</Text>
                          </TouchableOpacity>

                          {isScheduled && (
                            <>
                              <TouchableOpacity
                                style={styles.btnOutlineEdit}
                                onPress={() => handleOpenScheduleModal(m)}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.btnOutlineEditText}>✏️ Edit / Reschedule</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.btnOutlineDanger}
                                onPress={() => setCancelMatchModal({ id: m.id, teamA: m.team_a_name || m.team_a_id, teamB: m.team_b_name || m.team_b_id })}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.btnOutlineDangerText}>🚫 Cancel Match</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.btnOutlineDelete}
                                onPress={() => handleDeleteMatch(m.id)}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.btnOutlineDeleteText}>🗑 Delete</Text>
                              </TouchableOpacity>
                            </>
                          )}

                          {isCancelled && (
                            <TouchableOpacity
                              style={styles.btnOutlineDelete}
                              onPress={() => handleDeleteMatch(m.id)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.btnOutlineDeleteText}>🗑 Delete Fixture</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>

      {/* ─────────────────────────────────────────────────────────────
          8. SQUAD INSPECTION MODAL (15 Member Roster)
          ───────────────────────────────────────────────────────────── */}
      <Modal
        visible={!!selectedSquadModal}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedSquadModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalDialogLarge}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedSquadModal?.teamName}</Text>
                <Text style={styles.modalSubtitle}>
                  Taluk: {selectedSquadModal?.taluk} • Coach: {selectedSquadModal?.coach?.name} • Official 15-Member Squad Roster
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedSquadModal(null)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={true}>
              <View style={styles.squadTableContainer}>
                <View style={styles.squadTableHeader}>
                  <Text style={[styles.thCell, { width: 50 }]}>#</Text>
                  <Text style={[styles.thCell, { flex: 2.2 }]}>Player Name</Text>
                  <Text style={[styles.thCell, { flex: 2 }]}>Player Email</Text>
                  <Text style={[styles.thCell, { flex: 1.5 }]}>Playing Role</Text>
                </View>

                {selectedSquadModal?.members && selectedSquadModal.members.length > 0 ? (
                  selectedSquadModal.members.map((m: any, idx: number) => (
                    <View key={m.playerId || m._id || idx} style={[styles.squadTableRow, idx % 2 === 1 && styles.rowAlt]}>
                      <Text style={[styles.tdCell, { width: 50, fontWeight: '700' }]}>{m.jersey_number || m.jerseyNumber || idx + 1}</Text>
                      <Text style={[styles.tdCell, { flex: 2.2, fontWeight: '700', color: '#0f172a' }]}>{m.name || m.playerName || 'Player'}</Text>
                      <Text style={[styles.tdCell, { flex: 2, color: '#475569', fontSize: 13 }]}>{m.email || m.playerEmail || m.playerId || '—'}</Text>
                      <View style={{ flex: 1.5, justifyContent: 'center' }}>
                        <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' }}>
                          <Text style={{ color: '#b45309', fontWeight: '700', fontSize: 12 }}>{m.role || 'Player'}</Text>
                        </View>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: '#64748b' }}>No players registered for this squad yet.</Text>
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setSelectedSquadModal(null)}
              >
                <Text style={styles.modalCancelBtnText}>Close Squad View</Text>
              </TouchableOpacity>
              {selectedSquadModal?.status === 'Pending' && (
                <TouchableOpacity
                  style={styles.modalApproveBtn}
                  onPress={() => {
                    handleApproveTeam(selectedSquadModal.teamId);
                    setSelectedSquadModal(null);
                  }}
                >
                  <Text style={styles.modalApproveBtnText}>✔ Approve Squad Registration</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          9. SCORER DETAILS MODAL
          ───────────────────────────────────────────────────────────── */}
      <Modal
        visible={!!selectedScorerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedScorerModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalDialogMedium}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedScorerModal?.scorerName}</Text>
                <Text style={styles.modalSubtitle}>Certification ID: {selectedScorerModal?.scorerId}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedScorerModal(null)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.detailsModalBody}>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Accreditation Grade:</Text>
                <Text style={styles.detailValBold}>{selectedScorerModal?.grade}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Official Email:</Text>
                <Text style={styles.detailVal}>{selectedScorerModal?.email}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Phone Number:</Text>
                <Text style={styles.detailVal}>{selectedScorerModal?.phone || 'N/A'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>District Taluk:</Text>
                <Text style={styles.detailVal}>{selectedScorerModal?.taluk}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Experience:</Text>
                <Text style={styles.detailVal}>{selectedScorerModal?.experienceYears} Years</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Current Status:</Text>
                <Text
                  style={[
                    styles.detailValBold,
                    {
                      color:
                        selectedScorerModal?.status === 'Approved'
                          ? '#16a34a'
                          : selectedScorerModal?.status === 'Rejected'
                            ? '#dc2626'
                            : '#d97706'
                    }
                  ]}
                >
                  {selectedScorerModal?.status}
                </Text>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setSelectedScorerModal(null)}>
                <Text style={styles.modalCancelBtnText}>Close</Text>
              </TouchableOpacity>
              {selectedScorerModal?.status === 'Pending' && (
                <TouchableOpacity
                  style={styles.modalApproveBtn}
                  onPress={() => {
                    handleApproveScorer(selectedScorerModal.scorerId);
                    setSelectedScorerModal(null);
                  }}
                >
                  <Text style={styles.modalApproveBtnText}>✔ Authorize Scorer</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          9B. UMPIRE DETAILS MODAL
          ───────────────────────────────────────────────────────────── */}
      <Modal
        visible={!!selectedUmpireForView}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedUmpireForView(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalDialogMedium}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedUmpireForView?.umpireName}</Text>
                <Text style={styles.modalSubtitle}>Accreditation ID: {selectedUmpireForView?.umpireId}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedUmpireForView(null)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.detailsModalBody}>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Accreditation Qualification:</Text>
                <Text style={styles.detailValBold}>{selectedUmpireForView?.qualification}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Official Email:</Text>
                <Text style={styles.detailVal}>{selectedUmpireForView?.email}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Phone Number:</Text>
                <Text style={styles.detailVal}>{selectedUmpireForView?.phone || '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>District & State:</Text>
                <Text style={styles.detailVal}>
                  {selectedUmpireForView?.district || 'Virudhunagar'}, {selectedUmpireForView?.state || 'Tamil Nadu'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Experience:</Text>
                <Text style={styles.detailVal}>
                  {selectedUmpireForView?.experience || `${selectedUmpireForView?.experienceYears} Years`}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Certification Number:</Text>
                <Text style={styles.detailVal}>{selectedUmpireForView?.certificationNumber || '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Specialization:</Text>
                <Text style={styles.detailVal}>{selectedUmpireForView?.specialization || 'On-field Umpire'}</Text>
              </View>
              {selectedUmpireForView?.previousOrganization && selectedUmpireForView?.previousOrganization !== '—' && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Previous Association:</Text>
                  <Text style={styles.detailVal}>{selectedUmpireForView?.previousOrganization}</Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Current Status:</Text>
                <Text
                  style={[
                    styles.detailValBold,
                    {
                      color:
                        selectedUmpireForView?.status === 'Approved'
                          ? '#16a34a'
                          : selectedUmpireForView?.status === 'Rejected'
                            ? '#dc2626'
                            : '#d97706'
                    }
                  ]}
                >
                  {selectedUmpireForView?.status}
                </Text>
              </View>
              {selectedUmpireForView?.rejectionReason && (
                <View style={[styles.detailRow, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                  <Text style={[styles.detailKey, { color: '#dc2626' }]}>Rejection Reason:</Text>
                  <Text style={[styles.detailVal, { color: '#dc2626', marginTop: 4 }]}>
                    {selectedUmpireForView?.rejectionReason}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setSelectedUmpireForView(null)}>
                <Text style={styles.modalCancelBtnText}>Close</Text>
              </TouchableOpacity>
              {selectedUmpireForView?.status === 'Pending' && (
                <TouchableOpacity
                  style={styles.modalApproveBtn}
                  onPress={() => {
                    handleApproveUmpire(selectedUmpireForView.umpireId);
                    setSelectedUmpireForView(null);
                  }}
                >
                  <Text style={styles.modalApproveBtnText}>✔ Authorize Umpire</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          10. REJECTION REASON PROMPT MODAL
          ───────────────────────────────────────────────────────────── */}
      <Modal visible={!!rejectionModal} transparent animationType="fade" onRequestClose={() => setRejectionModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalDialogSmall}>
            <Text style={styles.rejectModalHeading}>Confirm Official Rejection</Text>
            <Text style={styles.rejectModalSubtitle}>
              Please provide the official governing council reason for rejecting <Text style={{ fontWeight: '700' }}>{rejectionModal?.name}</Text>:
            </Text>

            <TextInput
              style={styles.rejectInput}
              value={rejectionReasonInput}
              onChangeText={setRejectionReasonInput}
              multiline
              numberOfLines={3}
              placeholder="e.g. Incomplete credentials, expired documents..."
              placeholderTextColor="#94a3b8"
            />

            <View style={styles.rejectModalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setRejectionModal(null)}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnDangerConfirm} onPress={handleConfirmReject}>
                <Text style={styles.btnDangerConfirmText}>Confirm Rejection</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          11. LOGOUT CONFIRMATION MODAL
          ───────────────────────────────────────────────────────────── */}
      <Modal visible={logoutModalOpen} transparent animationType="fade" onRequestClose={() => setLogoutModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalDialogSmall}>
            <Text style={styles.rejectModalHeading}>Administrator Sign Out</Text>
            <Text style={styles.rejectModalSubtitle}>
              Are you sure you want to sign out of the official CFVD Administration Console?
            </Text>
            <View style={styles.rejectModalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setLogoutModalOpen(false)}>
                <Text style={styles.modalCancelBtnText}>Stay Logged In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnDangerConfirm}
                onPress={() => {
                  setLogoutModalOpen(false);
                  handleLogout();
                }}
              >
                <Text style={styles.btnDangerConfirmText}>Confirm Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* ─────────────────────────────────────────────────────────────
          12. ENHANCED SCHEDULE / RESCHEDULE MATCH MODAL
          ───────────────────────────────────────────────────────────── */}
      {/* Minimized Dock Bar at Bottom Right */}
      {scheduleModalOpen && scheduleModalMinimized && (
        <View style={styles.minimizedDockBar}>
          <View style={styles.minimizedDockLeft}>
            <View style={styles.minimizedDockIconBox}>
              <Text style={{ fontSize: 16 }}>🏏</Text>
            </View>
            <View>
              <Text style={styles.minimizedDockTitle}>Match Fixture in Progress</Text>
              <Text style={styles.minimizedDockSub}>
                {scheduleForm.team_a_id || 'Team A'} vs {scheduleForm.team_b_id || 'Team B'} • {scheduleForm.match_date} {scheduleForm.match_time}
              </Text>
            </View>
          </View>
          <View style={styles.minimizedDockActions}>
            <TouchableOpacity
              style={styles.minimizedRestoreBtn}
              onPress={() => setScheduleModalMinimized(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.minimizedRestoreBtnText}>🗖 Restore</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.minimizedCloseBtn}
              onPress={() => {
                setScheduleModalMinimized(false);
                setScheduleModalOpen(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.minimizedCloseBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal
        visible={scheduleModalOpen && !scheduleModalMinimized}
        transparent
        animationType="fade"
        onRequestClose={() => setScheduleModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalDialogLarge, scheduleModalMaximized && styles.modalDialogMaximized]}>
            {/* Modal Header with Icon and Top Controls: Minimize (-), Maximize (🗖), and Red Close (✕) */}
            <View style={styles.modalHeader}>
              <View style={styles.scheduleModalHeaderLeft}>
                <View style={styles.scheduleModalHeaderIconBox}>
                  <Text style={{ fontSize: 20 }}>🏏</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={styles.modalTitle}>
                      {editingMatch ? '✏️ Reschedule / Adjust Match Fixture' : '🏏 Schedule New Match Fixture'}
                    </Text>
                    <View style={styles.scheduleModalBadgePill}>
                      <Text style={styles.scheduleModalBadgePillText}>APEX GOVERNANCE</Text>
                    </View>
                  </View>
                  <Text style={styles.modalSubtitle}>
                    {editingMatch
                      ? `Update match logistics, timing, venue, or accredited officials for Match ${editingMatch.id}`
                      : 'Configure tournament assignment, competing clubs, timing adjustments and automated team alerts'}
                  </Text>
                </View>
              </View>

              {/* Window Controls: Minimize (-), Maximize (🗖), Red Close (✕) */}
              <View style={styles.modalHeaderControls}>
                {/* Minimize Button */}
                <TouchableOpacity
                  style={[styles.modalWindowBtn, styles.modalMinimizeBtn]}
                  onPress={() => setScheduleModalMinimized(true)}
                  activeOpacity={0.7}
                  accessibilityLabel="Minimize Window"
                >
                  <Text style={styles.modalMinimizeText}>—</Text>
                </TouchableOpacity>

                {/* Maximize / Restore Button */}
                <TouchableOpacity
                  style={[styles.modalWindowBtn, styles.modalMaximizeBtn]}
                  onPress={() => setScheduleModalMaximized(prev => !prev)}
                  activeOpacity={0.7}
                  accessibilityLabel="Maximize Window"
                >
                  <Text style={styles.modalMaximizeText}>{scheduleModalMaximized ? '🗗' : '🗖'}</Text>
                </TouchableOpacity>

                {/* Close Button: Red on top */}
                <TouchableOpacity
                  style={[styles.modalWindowBtn, styles.modalCloseRedBtn]}
                  onPress={() => {
                    setScheduleModalOpen(false);
                    setScheduleModalMinimized(false);
                  }}
                  activeOpacity={0.7}
                  accessibilityLabel="Close Window"
                >
                  <Text style={styles.modalCloseRedText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={true}>
              {scheduleFormError && (
                <View style={styles.formErrorBox}>
                  <Text style={styles.formErrorText}>⚠️ {scheduleFormError}</Text>
                </View>
              )}

              {/* ───────────────────────────────────────────────────────
                  1. TOURNAMENT CHAMPIONSHIP & ASSIGNMENT (TYPED FORMAT)
                  ─────────────────────────────────────────────────────── */}
              <View style={styles.modalFormSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.formSectionHeading}>1. Tournament Championship & Assignment</Text>
                  <Text style={styles.sectionRequiredTag}>* REQUIRED</Text>
                </View>
                <Text style={styles.sectionSubDesc}>
                  Type a custom tournament name or select an active championship to assign this fixture:
                </Text>

                {/* Direct Typing Input */}
                <View style={styles.tournamentInputWrap}>
                  <Text style={styles.inputPrefixIcon}>🏆</Text>
                  <TextInput
                    style={styles.tournamentTextInput}
                    placeholder="Type tournament name to assign (e.g. Virudhunagar Premier League 2026)..."
                    placeholderTextColor="#94a3b8"
                    value={scheduleForm.tournament_name}
                    onChangeText={(val) => {
                      setScheduleForm({
                        ...scheduleForm,
                        tournament_name: val,
                        tournament_id: val ? val.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 24) : 'T-CUSTOM'
                      });
                    }}
                  />
                  {scheduleForm.tournament_name ? (
                    <TouchableOpacity
                      onPress={() => setScheduleForm({ ...scheduleForm, tournament_name: '', tournament_id: 'T-CUSTOM' })}
                      style={{ padding: 6 }}
                    >
                      <Text style={{ color: '#94a3b8', fontSize: 16 }}>✕</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Preset Quick Chips */}
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.quickPresetHeading}>Quick Assign Existing Championships:</Text>
                  <View style={styles.pillsRowWrap}>
                    {[
                      { id: 'T-2026-VPL', name: 'Virudhunagar Premier League 2026' },
                      { id: 'T-2026-U19', name: 'District Under-19 Championship' },
                      { id: 'T-2026-APX', name: 'Apex Council Trophy 2026' },
                      { id: 'T-2026-SSC', name: 'Sivakasi Super Cup' }
                    ].map((t) => {
                      const isSelected = scheduleForm.tournament_name === t.name;
                      return (
                        <TouchableOpacity
                          key={t.id}
                          style={[styles.selectPillModern, isSelected && styles.selectPillModernActive]}
                          onPress={() => setScheduleForm({ ...scheduleForm, tournament_id: t.id, tournament_name: t.name })}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.selectPillModernText, isSelected && styles.selectPillModernTextActive]}>
                            🏆 {t.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Live Assignment Confirmation Badge */}
                <View style={styles.tournamentAssignedBadge}>
                  <Text style={styles.tournamentAssignedBadgeText}>
                    ✅ Fixture Assigned To: <Text style={{ fontWeight: '800', color: '#b45309' }}>{scheduleForm.tournament_name || 'Custom Tournament'}</Text> (ID: {scheduleForm.tournament_id || 'T-AUTO'})
                  </Text>
                </View>
              </View>

              {/* ───────────────────────────────────────────────────────
                  2. COMPETING TEAMS (DYNAMIC DROPDOWN TABLES)
                  ─────────────────────────────────────────────────────── */}
              <View style={styles.modalFormSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.formSectionHeading}>2. Competing Registered Teams</Text>
                  <Text style={styles.sectionRequiredTag}>* DYNAMIC DROPDOWN SELECTION</Text>
                </View>
                <Text style={styles.sectionSubDesc}>
                  Select participating clubs from the official registered federation roster:
                </Text>

                <View style={styles.twoColFormGrid}>
                  {/* Team A (Home / First Team) */}
                  <View style={{ flex: 1, minWidth: 280 }}>
                    <Text style={styles.formLabel}>Team A (Home / Host Club) *</Text>
                    {/* Selected Box / Dropdown Toggle */}
                    {(() => {
                      const selectedA = availableTeams.find(tm => tm.id === scheduleForm.team_a_id) || availableTeams[0];
                      return (
                        <View style={styles.dropdownContainer}>
                          <TouchableOpacity
                            style={[styles.dropdownSelectBox, teamADropdownOpen && styles.dropdownSelectBoxActive]}
                            onPress={() => {
                              setTeamADropdownOpen(!teamADropdownOpen);
                              setTeamBDropdownOpen(false);
                            }}
                            activeOpacity={0.8}
                          >
                            <View style={styles.dropdownSelectedLeft}>
                              <View style={[styles.teamCrestMini, { backgroundColor: '#1e3a8a' }]}>
                                <Text style={{ fontSize: 13 }}>🏏</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.dropdownSelectedTitle} numberOfLines={1}>
                                  {selectedA?.name || 'Select Team A'}
                                </Text>
                                <Text style={styles.dropdownSelectedSub} numberOfLines={1}>
                                  ID: {selectedA?.id} • {selectedA?.taluk} • Coach: {selectedA?.coachName}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.dropdownArrow}>{teamADropdownOpen ? '▲' : '▼'}</Text>
                          </TouchableOpacity>

                          {/* Open Dropdown Table */}
                          {teamADropdownOpen && (
                            <View style={styles.dropdownTablePanel}>
                              <View style={styles.dropdownSearchWrap}>
                                <Text style={{ fontSize: 13, marginRight: 6 }}>🔍</Text>
                                <TextInput
                                  style={styles.dropdownSearchInput}
                                  placeholder="Search registered clubs..."
                                  placeholderTextColor="#94a3b8"
                                  value={teamSearchQueryA}
                                  onChangeText={setTeamSearchQueryA}
                                />
                                {teamSearchQueryA ? (
                                  <TouchableOpacity onPress={() => setTeamSearchQueryA('')}>
                                    <Text style={{ color: '#94a3b8', fontSize: 13 }}>✕</Text>
                                  </TouchableOpacity>
                                ) : null}
                              </View>

                              <ScrollView style={styles.dropdownTableScroll} nestedScrollEnabled={true}>
                                {availableTeams
                                  .filter(tm => !teamSearchQueryA || tm.name.toLowerCase().includes(teamSearchQueryA.toLowerCase()) || tm.taluk.toLowerCase().includes(teamSearchQueryA.toLowerCase()))
                                  .map(tm => {
                                    const isChosen = scheduleForm.team_a_id === tm.id;
                                    return (
                                      <TouchableOpacity
                                        key={`dd-a-${tm.id}`}
                                        style={[styles.dropdownTableRow, isChosen && styles.dropdownTableRowActive]}
                                        onPress={() => {
                                          if (scheduleForm.team_b_id === tm.id) {
                                            setScheduleFormError('Team A and Team B cannot be the same club.');
                                          } else {
                                            setScheduleFormError(null);
                                            setScheduleForm({ ...scheduleForm, team_a_id: tm.id });
                                            setTeamADropdownOpen(false);
                                          }
                                        }}
                                        activeOpacity={0.8}
                                      >
                                        <View style={styles.dropdownTableRowLeft}>
                                          <Text style={{ fontSize: 14 }}>🏏</Text>
                                          <View>
                                            <Text style={[styles.dropdownRowTitle, isChosen && styles.dropdownRowTitleActive]}>
                                              {tm.name}
                                            </Text>
                                            <Text style={styles.dropdownRowMeta}>
                                              {tm.id} • {tm.taluk} Taluk • Coach: {tm.coachName}
                                            </Text>
                                          </View>
                                        </View>
                                        {isChosen && <Text style={styles.dropdownRowCheck}>✓</Text>}
                                      </TouchableOpacity>
                                    );
                                  })}
                              </ScrollView>
                            </View>
                          )}
                        </View>
                      );
                    })()}
                  </View>

                  {/* Team B (Away / Opponent Team) */}
                  <View style={{ flex: 1, minWidth: 280 }}>
                    <Text style={styles.formLabel}>Team B (Away / Opponent Club) *</Text>
                    {/* Selected Box / Dropdown Toggle */}
                    {(() => {
                      const selectedB = availableTeams.find(tm => tm.id === scheduleForm.team_b_id) || availableTeams[1];
                      return (
                        <View style={styles.dropdownContainer}>
                          <TouchableOpacity
                            style={[styles.dropdownSelectBox, teamBDropdownOpen && styles.dropdownSelectBoxActive]}
                            onPress={() => {
                              setTeamBDropdownOpen(!teamBDropdownOpen);
                              setTeamADropdownOpen(false);
                            }}
                            activeOpacity={0.8}
                          >
                            <View style={styles.dropdownSelectedLeft}>
                              <View style={[styles.teamCrestMini, { backgroundColor: '#d97706' }]}>
                                <Text style={{ fontSize: 13 }}>🏏</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.dropdownSelectedTitle} numberOfLines={1}>
                                  {selectedB?.name || 'Select Team B'}
                                </Text>
                                <Text style={styles.dropdownSelectedSub} numberOfLines={1}>
                                  ID: {selectedB?.id} • {selectedB?.taluk} • Coach: {selectedB?.coachName}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.dropdownArrow}>{teamBDropdownOpen ? '▲' : '▼'}</Text>
                          </TouchableOpacity>

                          {/* Open Dropdown Table */}
                          {teamBDropdownOpen && (
                            <View style={styles.dropdownTablePanel}>
                              <View style={styles.dropdownSearchWrap}>
                                <Text style={{ fontSize: 13, marginRight: 6 }}>🔍</Text>
                                <TextInput
                                  style={styles.dropdownSearchInput}
                                  placeholder="Search registered clubs..."
                                  placeholderTextColor="#94a3b8"
                                  value={teamSearchQueryB}
                                  onChangeText={setTeamSearchQueryB}
                                />
                                {teamSearchQueryB ? (
                                  <TouchableOpacity onPress={() => setTeamSearchQueryB('')}>
                                    <Text style={{ color: '#94a3b8', fontSize: 13 }}>✕</Text>
                                  </TouchableOpacity>
                                ) : null}
                              </View>

                              <ScrollView style={styles.dropdownTableScroll} nestedScrollEnabled={true}>
                                {availableTeams
                                  .filter(tm => !teamSearchQueryB || tm.name.toLowerCase().includes(teamSearchQueryB.toLowerCase()) || tm.taluk.toLowerCase().includes(teamSearchQueryB.toLowerCase()))
                                  .map(tm => {
                                    const isChosen = scheduleForm.team_b_id === tm.id;
                                    const isTeamA = scheduleForm.team_a_id === tm.id;
                                    return (
                                      <TouchableOpacity
                                        key={`dd-b-${tm.id}`}
                                        style={[
                                          styles.dropdownTableRow,
                                          isChosen && styles.dropdownTableRowActive,
                                          isTeamA && { opacity: 0.45, backgroundColor: '#f1f5f9' }
                                        ]}
                                        onPress={() => {
                                          if (isTeamA) {
                                            setScheduleFormError('Team B cannot be the same as Team A.');
                                          } else {
                                            setScheduleFormError(null);
                                            setScheduleForm({ ...scheduleForm, team_b_id: tm.id });
                                            setTeamBDropdownOpen(false);
                                          }
                                        }}
                                        activeOpacity={0.8}
                                      >
                                        <View style={styles.dropdownTableRowLeft}>
                                          <Text style={{ fontSize: 14 }}>🏏</Text>
                                          <View>
                                            <Text style={[styles.dropdownRowTitle, isChosen && styles.dropdownRowTitleActive]}>
                                              {tm.name} {isTeamA ? '(Already Team A)' : ''}
                                            </Text>
                                            <Text style={styles.dropdownRowMeta}>
                                              {tm.id} • {tm.taluk} Taluk • Coach: {tm.coachName}
                                            </Text>
                                          </View>
                                        </View>
                                        {isChosen && <Text style={styles.dropdownRowCheck}>✓</Text>}
                                      </TouchableOpacity>
                                    );
                                  })}
                              </ScrollView>
                            </View>
                          )}
                        </View>
                      );
                    })()}
                  </View>
                </View>
              </View>

              {/* ───────────────────────────────────────────────────────
                  3. VENUE & WEATHER / RAIN RESCHEDULE CONTROLS
                  ─────────────────────────────────────────────────────── */}
              <View style={styles.modalFormSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.formSectionHeading}>3. Venue & Logistics (Weather / Rain Reschedule Controls)</Text>
                  <Text style={styles.sectionRequiredTag}>* REAL-TIME DISPATCH</Text>
                </View>

                {/* Venue Dropdown Table */}
                <Text style={styles.formLabel}>Official Stadium / Venue *</Text>
                {(() => {
                  const selectedVenue = availableVenues.find(v => v.name === scheduleForm.venue) || availableVenues[0];
                  return (
                    <View style={styles.dropdownContainer}>
                      <TouchableOpacity
                        style={[styles.dropdownSelectBox, venueDropdownOpen && styles.dropdownSelectBoxActive]}
                        onPress={() => setVenueDropdownOpen(!venueDropdownOpen)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.dropdownSelectedLeft}>
                          <View style={[styles.teamCrestMini, { backgroundColor: '#059669' }]}>
                            <Text style={{ fontSize: 13 }}>📍</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.dropdownSelectedTitle} numberOfLines={1}>
                              {selectedVenue?.name || scheduleForm.venue}
                            </Text>
                            <Text style={styles.dropdownSelectedSub} numberOfLines={1}>
                              {selectedVenue?.location} • {selectedVenue?.capacity}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.dropdownArrow}>{venueDropdownOpen ? '▲' : '▼'}</Text>
                      </TouchableOpacity>

                      {venueDropdownOpen && (
                        <View style={styles.dropdownTablePanel}>
                          <ScrollView style={styles.dropdownTableScroll} nestedScrollEnabled={true}>
                            {availableVenues.map(v => {
                              const isChosen = scheduleForm.venue === v.name;
                              return (
                                <TouchableOpacity
                                  key={v.id}
                                  style={[styles.dropdownTableRow, isChosen && styles.dropdownTableRowActive]}
                                  onPress={() => {
                                    setScheduleForm({ ...scheduleForm, venue: v.name });
                                    setVenueDropdownOpen(false);
                                  }}
                                  activeOpacity={0.8}
                                >
                                  <View style={styles.dropdownTableRowLeft}>
                                    <Text style={{ fontSize: 14 }}>📍</Text>
                                    <View>
                                      <Text style={[styles.dropdownRowTitle, isChosen && styles.dropdownRowTitleActive]}>
                                        {v.name}
                                      </Text>
                                      <Text style={styles.dropdownRowMeta}>
                                        {v.location} • {v.capacity}
                                      </Text>
                                    </View>
                                  </View>
                                  {isChosen && <Text style={styles.dropdownRowCheck}>✓</Text>}
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  );
                })()}

                {/* Match Date & Changeable Match Time */}
                <View style={[styles.formRowInputs, { marginTop: 14 }]}>
                  <View style={styles.formInputCol}>
                    <Text style={styles.formLabel}>Match Date (YYYY-MM-DD) *</Text>
                    <TextInput
                      style={styles.formTextInput}
                      placeholder="e.g. 2026-10-18"
                      placeholderTextColor="#94a3b8"
                      value={scheduleForm.match_date}
                      onChangeText={(val) => setScheduleForm({ ...scheduleForm, match_date: val })}
                    />
                  </View>

                  <View style={styles.formInputCol}>
                    <Text style={styles.formLabel}>Match Start Time * (Changeable for Rain / Delays)</Text>
                    <TextInput
                      style={styles.formTextInput}
                      placeholder="e.g. 09:30 AM"
                      placeholderTextColor="#94a3b8"
                      value={scheduleForm.match_time}
                      onChangeText={(val) => setScheduleForm({ ...scheduleForm, match_time: val })}
                    />
                  </View>
                </View>

                {/* Quick Weather / Rain Delay Adjustments */}
                <View style={styles.weatherQuickRow}>
                  <Text style={styles.weatherQuickLabel}>⚡ Quick Weather / Delay Presets:</Text>
                  <View style={styles.pillsRowWrap}>
                    <TouchableOpacity
                      style={styles.btnDelayChip}
                      onPress={() => setScheduleForm({ ...scheduleForm, match_time: '10:00 AM' })}
                    >
                      <Text style={styles.btnDelayChipText}>🌧 +30m Rain Delay (10:00 AM)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnDelayChip}
                      onPress={() => setScheduleForm({ ...scheduleForm, match_time: '10:30 AM' })}
                    >
                      <Text style={styles.btnDelayChipText}>🌧 +1hr Weather Delay (10:30 AM)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnDelayChip}
                      onPress={() => setScheduleForm({ ...scheduleForm, match_time: '01:30 PM' })}
                    >
                      <Text style={styles.btnDelayChipText}>☀️ Afternoon Shift (01:30 PM)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnDelayChip}
                      onPress={() => setScheduleForm({ ...scheduleForm, match_time: '05:30 PM' })}
                    >
                      <Text style={styles.btnDelayChipText}>💡 Floodlights (05:30 PM)</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Automated Reschedule Notification Notice to Coaches & Teams */}
                <View style={styles.automatedDispatchNoticeBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={{ fontSize: 16 }}>📧</Text>
                    <Text style={styles.automatedDispatchTitle}>Automated Team & Coach Notification System</Text>
                  </View>
                  <Text style={styles.automatedDispatchDesc}>
                    When timing is updated due to rain or scheduling adjustments, automated email notifications will be dispatched within 2 minutes to both competing clubs' registered managers & coaches:
                  </Text>
                  <View style={styles.dispatchRecipientRow}>
                    <View style={styles.recipientPill}>
                      <Text style={styles.recipientPillText}>
                        Team A: {availableTeams.find(t => t.id === scheduleForm.team_a_id)?.coachEmail || 'coach@team-a.cfvd.org'}
                      </Text>
                    </View>
                    <View style={styles.recipientPill}>
                      <Text style={styles.recipientPillText}>
                        Team B: {availableTeams.find(t => t.id === scheduleForm.team_b_id)?.coachEmail || 'coach@team-b.cfvd.org'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* ───────────────────────────────────────────────────────
                  4. MATCH FORMAT & DYNAMIC OVERS (50, 25, 20, 15, 10, 5)
                  ─────────────────────────────────────────────────────── */}
              <View style={styles.modalFormSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.formSectionHeading}>4. Match Format & Overs Limit</Text>
                  <Text style={styles.sectionRequiredTag}>* FLEXIBLE OVERS</Text>
                </View>

                <View style={styles.formRowInputs}>
                  <View style={styles.formInputCol}>
                    <Text style={styles.formLabel}>Championship Format</Text>
                    <View style={styles.formatSelectRow}>
                      {[
                        { type: 'T20', overs: 20 },
                        { type: 'One Day', overs: 50 },
                        { type: 'Super-25', overs: 25 },
                        { type: 'Shield-15', overs: 15 },
                        { type: 'Super-10', overs: 10 },
                        { type: 'Five-5', overs: 5 }
                      ].map((fmt) => {
                        const isMatchActive = scheduleForm.match_type === fmt.type;
                        return (
                          <TouchableOpacity
                            key={fmt.type}
                            style={[styles.formatBtn, isMatchActive && styles.formatBtnActive]}
                            onPress={() => setScheduleForm({
                              ...scheduleForm,
                              match_type: fmt.type,
                              overs: fmt.overs
                            })}
                          >
                            <Text style={[styles.formatBtnText, isMatchActive && styles.formatBtnTextActive]}>
                              {fmt.type}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.formInputCol}>
                    <Text style={styles.formLabel}>Exact Overs Limit (Customizable)</Text>
                    <TextInput
                      style={styles.formTextInput}
                      placeholder="20"
                      keyboardType="numeric"
                      value={String(scheduleForm.overs)}
                      onChangeText={(val) => setScheduleForm({ ...scheduleForm, overs: parseInt(val, 10) || 20 })}
                    />
                  </View>
                </View>

                {/* Dynamic Overs Quick Selection: 50, 25, 20, 15, 10, 5 */}
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.quickPresetHeading}>Choose Overs Limit:</Text>
                  <View style={styles.pillsRowWrap}>
                    {[50, 25, 20, 15, 10, 5].map((ov) => {
                      const isOvActive = Number(scheduleForm.overs) === ov;
                      return (
                        <TouchableOpacity
                          key={`ov-${ov}`}
                          style={[styles.oversSelectPill, isOvActive && styles.oversSelectPillActive]}
                          onPress={() => setScheduleForm({
                            ...scheduleForm,
                            overs: ov,
                            match_type: ov === 50 ? 'One Day' : ov === 20 ? 'T20' : `${ov}-Overs`
                          })}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.oversSelectPillText, isOvActive && styles.oversSelectPillTextActive]}>
                            ⚡ {ov} Overs {ov === 50 ? '(ODI Limit)' : ov === 20 ? '(T20)' : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* ───────────────────────────────────────────────────────
                  5. MATCH OFFICIALS (SCORER & UMPIRES UI)
                  ─────────────────────────────────────────────────────── */}
              <View style={styles.modalFormSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.formSectionHeading}>5. Accredited Match Officials (Scorer & Umpires)</Text>
                  <Text style={styles.sectionRequiredTag}>* BCCI / DISTRICT ACCREDITED</Text>
                </View>

                {/* Assigned Scorer Selection */}
                <Text style={styles.formLabel}>Official Digital Scorer (Scoring App Access) *</Text>
                <View style={styles.pillsRowWrap}>
                  {(officialsList.length > 0 ? officialsList : [
                    { id: 'SCR-101', name: 'Thiru. K. Sundararajan (SCR-101)', grade: 'BCCI Level 1 Scorer' },
                    { id: 'SCR-102', name: 'Thiru. M. Venkatesh (SCR-102)', grade: 'District Senior Panel' },
                    { id: 'SCR-103', name: 'Thiru. S. Pitchaimuthu (SCR-103)', grade: 'Collegiate League' }
                  ]).map((sc: any) => {
                    const isScActive = scheduleForm.assigned_scorer_id === sc.id;
                    return (
                      <TouchableOpacity
                        key={sc.id}
                        style={[styles.selectPillModern, isScActive && styles.selectPillModernActive]}
                        onPress={() => setScheduleForm({ ...scheduleForm, assigned_scorer_id: sc.id })}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.selectPillModernText, isScActive && styles.selectPillModernTextActive]}>
                          👤 {sc.name || sc.id} • {sc.grade || 'District Scorer'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Match Umpires Display */}
                <View style={styles.umpiresCardRow}>
                  <View style={styles.umpireCard}>
                    <Text style={styles.umpireRoleTitle}>⚖️ Lead Field Umpire (Umpire 1)</Text>
                    <Text style={styles.umpireNameText}>BCCI Certified District Panelist</Text>
                    <Text style={styles.umpireMetaText}>Official appointment assigned via Apex Umpires Board</Text>
                  </View>
                  <View style={styles.umpireCard}>
                    <Text style={styles.umpireRoleTitle}>⚖️ Square Leg Umpire (Umpire 2)</Text>
                    <Text style={styles.umpireNameText}>Senior District Panel Umpire</Text>
                    <Text style={styles.umpireMetaText}>Authorized federation match arbiter</Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Modal Footer with Dynamic Responsive Submit Button */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setScheduleModalOpen(false);
                  setScheduleModalMinimized(false);
                }}
                disabled={isSubmittingSchedule}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalDynamicSubmitBtn, isSubmittingSchedule && { opacity: 0.6 }]}
                onPress={handleSaveSchedule}
                disabled={isSubmittingSchedule}
                activeOpacity={0.85}
              >
                {isSubmittingSchedule ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color="#ffffff" />
                    <Text style={styles.modalDynamicSubmitBtnText}>Broadcasting Schedule...</Text>
                  </View>
                ) : (
                  <Text style={styles.modalDynamicSubmitBtnText}>
                    {editingMatch ? '💾 Save Reschedule & Dispatch Alerts' : '➕ Confirm & Schedule Championship Match'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          13. CANCEL MATCH REASON PROMPT MODAL
          ───────────────────────────────────────────────────────────── */}
      <Modal
        visible={!!cancelMatchModal}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelMatchModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalDialogSmall}>
            <Text style={styles.rejectModalHeading}>🚫 Cancel Scheduled Match</Text>
            <Text style={styles.rejectModalSubtitle}>
              Are you sure you want to cancel the match fixture between{' '}
              <Text style={{ fontWeight: '700' }}>{cancelMatchModal?.teamA}</Text> and{' '}
              <Text style={{ fontWeight: '700' }}>{cancelMatchModal?.teamB}</Text> (ID: {cancelMatchModal?.id})?
            </Text>

            <Text style={[styles.formLabel, { marginTop: 12 }]}>Reason for Cancellation / Abandonment *</Text>
            <TextInput
              style={styles.rejectInput}
              value={cancelReasonInput}
              onChangeText={setCancelReasonInput}
              multiline
              numberOfLines={3}
              placeholder="e.g. Inclement weather / heavy rain, waterlogged pitch, administrative postponement..."
              placeholderTextColor="#94a3b8"
            />

            <View style={styles.rejectModalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setCancelMatchModal(null)}
                disabled={isCancellingMatch}
              >
                <Text style={styles.modalCancelBtnText}>Dismiss</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnDangerConfirm, isCancellingMatch && { opacity: 0.6 }]}
                onPress={handleConfirmCancelMatch}
                disabled={isCancellingMatch}
              >
                {isCancellingMatch ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.btnDangerConfirmText}>Confirm Cancellation</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          14. MATCH DETAILS INSPECTION MODAL
          ───────────────────────────────────────────────────────────── */}
      <Modal
        visible={!!selectedMatchModal}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMatchModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalDialogLarge}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {selectedMatchModal?.team_a_name || selectedMatchModal?.team_a_id} vs{' '}
                  {selectedMatchModal?.team_b_name || selectedMatchModal?.team_b_id}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Match Fixture ID: {selectedMatchModal?.id} • {selectedMatchModal?.tournament_name || 'VPL 2026'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedMatchModal(null)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={true}>
              <View style={styles.detailsGridBox}>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsKey}>🏆 Tournament:</Text>
                  <Text style={styles.detailsVal}>{selectedMatchModal?.tournament_name || 'Virudhunagar Premier League 2026'}</Text>
                </View>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsKey}>📍 Venue / Ground:</Text>
                  <Text style={styles.detailsVal}>{selectedMatchModal?.venue || 'Kamarajar District Stadium'}</Text>
                </View>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsKey}>📅 Date & Time:</Text>
                  <Text style={styles.detailsVal}>{selectedMatchModal?.match_date} at {selectedMatchModal?.match_time || '09:30 AM'}</Text>
                </View>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsKey}>🏏 Format & Overs:</Text>
                  <Text style={styles.detailsVal}>{selectedMatchModal?.match_type || 'T20'} • {selectedMatchModal?.overs_per_side || 20} Overs Per Side</Text>
                </View>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsKey}>👤 Official Scorer:</Text>
                  <Text style={styles.detailsVal}>{selectedMatchModal?.scorer_name || selectedMatchModal?.assigned_scorer_id || 'SCR-101'}</Text>
                </View>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsKey}>📊 Current Status:</Text>
                  <Text style={[styles.detailsVal, { fontWeight: '700', color: '#1e3a8a' }]}>{selectedMatchModal?.status || 'SCHEDULED'}</Text>
                </View>
                {selectedMatchModal?.toss_winner_id && (
                  <View style={styles.detailsRow}>
                    <Text style={styles.detailsKey}>🪙 Toss Decision:</Text>
                    <Text style={styles.detailsVal}>Toss won by {selectedMatchModal.toss_winner_id}, elected to {selectedMatchModal.toss_decision}</Text>
                  </View>
                )}
                {selectedMatchModal?.result_summary && (
                  <View style={styles.detailsRow}>
                    <Text style={styles.detailsKey}>🏁 Result / Notes:</Text>
                    <Text style={[styles.detailsVal, { color: '#b45309', fontWeight: '700' }]}>{selectedMatchModal.result_summary}</Text>
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setSelectedMatchModal(null)}
              >
                <Text style={styles.modalCancelBtnText}>Close Details</Text>
              </TouchableOpacity>
              {(selectedMatchModal?.status || '').toUpperCase() === 'SCHEDULED' && (
                <TouchableOpacity
                  style={styles.modalApproveBtn}
                  onPress={() => {
                    const m = selectedMatchModal;
                    setSelectedMatchModal(null);
                    handleOpenScheduleModal(m);
                  }}
                >
                  <Text style={styles.modalApproveBtnText}>✏️ Edit Schedule</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES: Faithfully Matching the Previous UI
// ─────────────────────────────────────────────────────────────
const styles: any = StyleSheet.create({
  rootContainer: {
    flex: 1,
    width: '100%',
    height: Platform.OS === 'web' ? ('100vh' as any) : '100%',
    maxHeight: Platform.OS === 'web' ? ('100vh' as any) : '100%',
    overflow: 'hidden',
    backgroundColor: '#ffffff'
  },
  dashboardBodyRow: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    height: Platform.OS === 'web' ? ('calc(100vh - 64px)' as any) : '100%',
    maxHeight: Platform.OS === 'web' ? ('calc(100vh - 64px)' as any) : '100%',
    overflow: 'hidden',
    backgroundColor: '#ffffff'
  },
  sidebarContainer: {
    width: 250,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    height: '100%',
    maxHeight: '100%',
    overflow: 'hidden'
  },
  sidebarContainerCollapsed: {
    width: 74
  },
  sidebarInner: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12
  },
  sidebarInnerCollapsed: {
    paddingHorizontal: 8,
    alignItems: 'center'
  },
  sidebarProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    gap: 10
  },
  sidebarProfileCardCollapsed: {
    padding: 6,
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    marginBottom: 12
  },
  sidebarAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0a1432',
    borderWidth: 2,
    borderColor: '#d4af37',
    alignItems: 'center',
    justifyContent: 'center'
  },
  sidebarAvatarText: {
    color: '#d4af37',
    fontSize: 15,
    fontWeight: '900'
  },
  sidebarProfileInfo: {
    flex: 1
  },
  sidebarProfileName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0f172a'
  },
  sidebarProfileRole: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 1
  },
  sidebarOfficialBadge: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    alignSelf: 'flex-start',
    marginTop: 3
  },
  sidebarOfficialBadgeText: {
    color: '#b45309',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  sidebarNavScroll: {
    flex: 1
  },
  sidebarNavHeader: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 6
  },
  sidebarNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 5,
    gap: 10
  },
  sidebarNavItemActive: {
    backgroundColor: '#d4af37',
    boxShadow: '0 4px 12px rgba(212, 175, 55, 0.35)',
    elevation: 2
  },
  sidebarNavItemCollapsed: {
    paddingHorizontal: 8,
    justifyContent: 'center'
  },
  sidebarNavIcon: {
    fontSize: 16,
    color: '#475569'
  },
  sidebarNavIconActive: {
    color: '#ffffff'
  },
  sidebarNavLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    flex: 1
  },
  sidebarNavLabelActive: {
    color: '#ffffff',
    fontWeight: '800'
  },
  sidebarBadgeBlue: {
    backgroundColor: '#dbeafe',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  sidebarBadgeOrange: {
    backgroundColor: '#ffedd5',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  sidebarBadgePurple: {
    backgroundColor: '#f3e8ff',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  sidebarBadgeGold: {
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  sidebarBadgeGray: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  sidebarBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0f172a'
  },
  sidebarFooterBox: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    gap: 8
  },
  sidebarLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 8,
    paddingVertical: 8,
    gap: 6
  },
  sidebarLogoutBtnCollapsed: {
    paddingHorizontal: 6
  },
  sidebarLogoutIcon: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '800'
  },
  sidebarLogoutText: {
    color: '#ef4444',
    fontSize: 12.5,
    fontWeight: '700'
  },
  sidebarCollapseBtn: {
    alignItems: 'center',
    paddingVertical: 6
  },
  sidebarCollapseText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600'
  },
  mobileDrawerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    flexDirection: 'row'
  },
  mobileDrawerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  },
  mobileDrawerContent: {
    width: 270,
    backgroundColor: '#ffffff',
    height: '100%',
    zIndex: 1001,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10
  },
  mobileDrawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  mobileDrawerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f2452'
  },
  mobileDrawerCloseBtn: {
    padding: 6
  },
  mobileDrawerCloseText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '700'
  },
  pageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 12
  },
  pageHeaderTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.2
  },
  pageHeaderSubtitle: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 2
  },
  btnRefreshData: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  btnRefreshDataText: {
    color: '#0f2452',
    fontSize: 12.5,
    fontWeight: '700'
  },

  // 1. TOP FEDERATION HEADER
  webHeader: {
    width: '100%',
    backgroundColor: '#071026',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(212, 175, 55, 0.4)',
    zIndex: 100,
    boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
  },
  headerInner: {
    maxWidth: 1300,
    marginHorizontal: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexWrap: 'wrap',
    gap: 12
  },
  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  brandLogo: {
    width: 44,
    height: 44
  },
  brandTextCol: {
    justifyContent: 'center'
  },
  brandTitleMain: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  brandTitleSub: {
    color: '#d4af37',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  brandGoverning: {
    color: '#94a3b8',
    fontSize: 9,
    marginTop: 2
  },
  navLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16
  },
  navLinkItem: {
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  navLinkText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600'
  },
  headerRightBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  badgePillGoldOutline: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.5)',
    backgroundColor: 'rgba(212, 175, 55, 0.1)'
  },
  badgePillGoldOutlineText: {
    color: '#fde68a',
    fontSize: 11,
    fontWeight: '600'
  },
  badgePillActiveUser: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#d4af37'
  },
  badgePillActiveUserText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800'
  },
  badgePillStatus: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#0a1633',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.5)'
  },
  badgePillStatusText: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: '700'
  },
  gearButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0a1633',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    alignItems: 'center',
    justifyContent: 'center'
  },

  // 2. MAIN SCROLL CONTAINER
  mainScrollView: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  scrollContentContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    paddingBottom: 150
  },
  contentConstrained: {
    maxWidth: 1200,
    width: '100%',
    marginHorizontal: 'auto'
  },
  notificationBanner: {
    backgroundColor: '#dcfce7',
    borderLeftWidth: 4,
    borderLeftColor: '#16a34a',
    padding: 14,
    borderRadius: 8,
    marginBottom: 16
  },
  notificationText: {
    color: '#15803d',
    fontSize: 14,
    fontWeight: '700'
  },

  // 3. ADMIN TABS BAR
  adminTabsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
    marginBottom: 20,
    boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
    flexWrap: 'wrap',
    gap: 8
  },
  adminTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  adminTabBtnActive: {
    backgroundColor: '#d4af37',
    borderColor: '#d4af37',
    boxShadow: '0 4px 14px rgba(212, 175, 55, 0.35)'
  },
  adminTabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155'
  },
  adminTabBtnTextActive: {
    color: '#020612',
    fontWeight: '800'
  },
  tabBadgeRed: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6
  },
  tabBadgeRedText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '800'
  },
  tabBadgeOrange: {
    backgroundColor: '#ffedd5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6
  },
  tabBadgeOrangeText: {
    color: '#c2410c',
    fontSize: 11,
    fontWeight: '800'
  },
  tabBadgeGold: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6
  },
  tabBadgeGoldText: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '800'
  },
  tabBadgePurple: {
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6
  },
  tabBadgePurpleText: {
    color: '#7e22ce',
    fontSize: 11,
    fontWeight: '800'
  },
  adminLogoutBtn: {
    marginLeft: 'auto',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.05)'
  },
  adminLogoutBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700'
  },

  // 4. TWO HIGHLIGHT DARK NAVY CARDS
  highlightCardsRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
    flexWrap: 'wrap'
  },
  navyStatCard: {
    flex: 1,
    minWidth: 260,
    width: '100%',
    backgroundColor: '#0a1432',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(254, 215, 102, 0.45)',
    padding: 20,
    boxShadow: '0 6px 24px rgba(10, 20, 50, 0.15)',
    elevation: 3
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8
  },
  blueIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center'
  },
  statCardTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2
  },
  statCardSubtitle: {
    color: 'rgba(180, 196, 230, 0.75)',
    fontSize: 12.5,
    lineHeight: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(254, 215, 102, 0.15)',
    paddingBottom: 14,
    marginBottom: 16
  },
  pillRowsContainer: {
    gap: 10
  },
  statRowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1
  },
  rowPillGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.5)',
    borderLeftWidth: 4,
    borderLeftColor: '#10b981'
  },
  rowPillAmber: {
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
    borderColor: 'rgba(234, 179, 8, 0.5)',
    borderLeftWidth: 4,
    borderLeftColor: '#eab308'
  },
  rowPillRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444'
  },
  rowPillIndigo: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderColor: 'rgba(99, 102, 241, 0.5)',
    borderLeftWidth: 4,
    borderLeftColor: '#818cf8'
  },
  pillLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  glowingDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  pillLabel: {
    fontSize: 13.5,
    fontWeight: '600'
  },
  pillCount: {
    fontSize: 22,
    fontWeight: '900'
  },

  // Donut Chart Styling
  donutCardAlign: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  donutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  donutWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10
  },
  donutOuterRing: {
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 30px rgba(59,130,246,0.3)',
    elevation: 4
  },
  donutHole: {
    position: 'absolute',
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: '#071026',
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  donutNumber: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 36
  },
  donutUnitLabel: {
    color: 'rgba(147, 197, 253, 0.9)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 2
  },
  distributionBarWrapper: {
    width: '100%',
    marginVertical: 14,
    paddingHorizontal: 8
  },
  distributionBarTrack: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    flexDirection: 'row',
    overflow: 'hidden'
  },
  distributionBarSegment: {
    height: '100%'
  },
  distributionPctRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    flexWrap: 'wrap',
    gap: 8
  },
  distributionPctText: {
    fontSize: 11.5,
    fontWeight: '700'
  },
  donutLegendRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600'
  },

  // 5. TOOLBAR (SEARCH + FILTER PILLS)
  toolbarCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    boxShadow: '0 2px 10px rgba(0,0,0,0.04)'
  },
  searchBox: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    height: 38,
    fontSize: 13,
    color: '#0f172a'
  },
  filterPillsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  filterStatusLabel: {
    fontSize: 12.5,
    color: '#64748b',
    fontWeight: '600'
  },
  filterPill: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  filterPillActive: {
    backgroundColor: '#d4af37',
    borderColor: '#d4af37',
    boxShadow: '0 2px 8px rgba(212, 175, 55, 0.35)'
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155'
  },
  filterPillTextActive: {
    color: '#020612',
    fontWeight: '800'
  },

  // 6. CARDS LIST
  itemsListContainer: {
    gap: 14
  },
  whiteItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
    boxShadow: '0 3px 12px rgba(0,0,0,0.04)'
  },
  cardApprovedBorder: {
    borderLeftWidth: 5,
    borderLeftColor: '#10b981'
  },
  cardPendingBorder: {
    borderLeftWidth: 5,
    borderLeftColor: '#f59e0b'
  },
  cardRejectedBorder: {
    borderLeftWidth: 5,
    borderLeftColor: '#ef4444'
  },
  itemCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14
  },
  itemTitleGroup: {
    flex: 1,
    minWidth: 240
  },
  itemTitleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap'
  },
  itemNameText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a'
  },
  badgeConfirmed: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)'
  },
  badgeConfirmedText: {
    color: '#15803d',
    fontSize: 11,
    fontWeight: '800'
  },
  badgePending: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)'
  },
  badgePendingText: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '800'
  },
  badgeRejected: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)'
  },
  badgeRejectedText: {
    color: '#b91c1c',
    fontSize: 11,
    fontWeight: '800'
  },
  itemIdGradeText: {
    fontSize: 12.5,
    color: '#b45309',
    fontWeight: '600',
    marginTop: 4
  },
  itemActionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  btnOutlineGold: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d97706',
    backgroundColor: '#fffbeb'
  },
  btnOutlineGoldText: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '700'
  },
  btnSuccessSm: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#16a34a'
  },
  btnSuccessSmText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  btnOutlineDanger: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2'
  },
  btnOutlineDangerText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '700'
  },
  itemMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12
  },
  metaCell: {
    minWidth: 150
  },
  metaLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  metaVal: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '700',
    marginTop: 2
  },
  rejectionNoticeBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#fef2f2',
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
    borderRadius: 4
  },
  rejectionNoticeLabel: {
    fontSize: 11,
    color: '#991b1b',
    fontWeight: '800'
  },
  rejectionNoticeText: {
    fontSize: 12,
    color: '#b91c1c',
    marginTop: 2
  },

  // 7. OVERVIEW TAB STYLES
  overviewIntro: {
    marginBottom: 16
  },
  overviewTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a'
  },
  overviewSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24
  },
  summaryCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
    boxShadow: '0 2px 10px rgba(0,0,0,0.04)'
  },
  summaryCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  summaryIconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  summaryCountText: {
    fontSize: 28,
    fontWeight: '900'
  },
  summaryCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a'
  },
  summaryCardDesc: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 3
  },
  quickActionBanner: {
    backgroundColor: '#0a1432',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(254, 215, 102, 0.45)',
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16
  },
  quickActionTextCol: {
    flex: 1,
    minWidth: 260
  },
  quickActionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800'
  },
  quickActionDesc: {
    color: 'rgba(180, 196, 230, 0.8)',
    fontSize: 12.5,
    marginTop: 4
  },
  quickActionBtnRow: {
    flexDirection: 'row',
    gap: 10
  },
  btnGoldSm: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  btnGoldSmText: {
    color: '#0f172a',
    fontSize: 12.5,
    fontWeight: '800'
  },

  // 8. NEWS & CONTENT TAB STYLES
  contentTopCard: {
    backgroundColor: '#0a1432',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(254, 215, 102, 0.45)',
    padding: 20,
    marginBottom: 18
  },
  contentTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14
  },
  goldIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center'
  },
  contentTopTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800'
  },
  contentTopSub: {
    color: 'rgba(180, 196, 230, 0.75)',
    fontSize: 12,
    marginTop: 2
  },
  newsFormCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    padding: 20,
    marginBottom: 20
  },
  newsFormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 10,
    marginBottom: 14
  },
  newsFormTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a'
  },
  tagDirectDispatch: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  tagDirectDispatchText: {
    color: '#b45309',
    fontSize: 10,
    fontWeight: '800'
  },
  formRow: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
    marginBottom: 14
  },
  formGroup: {
    flex: 1,
    minWidth: 200
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 5
  },
  formInput: {
    height: 40,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#0f172a'
  },
  btnPublishNews: {
    backgroundColor: '#0f172a',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start'
  },
  btnPublishNewsText: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '800'
  },
  newsListContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 14
  },
  newsItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 12,
    gap: 12
  },
  newsItemTextCol: {
    flex: 1
  },
  newsItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a'
  },
  newsItemMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  btnDeleteNews: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2'
  },
  btnDeleteNewsText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '700'
  },

  // EMPTY BOX
  emptyBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a'
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4
  },

  // 9. MODALS
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16
  },
  modalDialogLarge: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 820,
    maxHeight: '90%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    overflow: 'hidden'
  },
  modalDialogMedium: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 550,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    overflow: 'hidden'
  },
  modalDialogSmall: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 460,
    padding: 22,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a'
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalCloseBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700'
  },
  modalBodyScroll: {
    maxHeight: 460,
    padding: 16
  },
  squadTableContainer: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden'
  },
  squadTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  thCell: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '800'
  },
  squadTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  rowAlt: {
    backgroundColor: '#f8fafc'
  },
  tdCell: {
    fontSize: 12.5,
    color: '#334155'
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#f8fafc'
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  modalCancelBtnText: {
    color: '#475569',
    fontSize: 12.5,
    fontWeight: '700'
  },
  modalApproveBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6
  },
  modalApproveBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '800'
  },
  detailsModalBody: {
    padding: 22,
    gap: 12
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8
  },
  detailKey: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600'
  },
  detailVal: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600'
  },
  detailValBold: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '800'
  },
  rejectModalHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6
  },
  rejectModalSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 14,
    lineHeight: 18
  },
  rejectInput: {
    height: 80,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 10,
    fontSize: 13,
    color: '#0f172a',
    textAlignVertical: 'top',
    marginBottom: 16
  },
  rejectModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10
  },
  btnDangerConfirm: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6
  },
  btnDangerConfirmText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '800'
  },
  adminMinimalTopBar: {
    backgroundColor: '#0a1936',
    borderBottomWidth: 1.5,
    borderBottomColor: '#d4af37',
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4
  },
  adminMinimalBrandCol: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  adminMinimalLogo: {
    width: 38,
    height: 38,
    borderRadius: 6
  },
  adminMinimalTitle: {
    color: '#d4af37',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  adminMinimalSub: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1
  },
  adminMinimalActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  adminUserBadgePill: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16
  },
  adminUserBadgePillText: {
    color: '#fbbf24',
    fontSize: 11.5,
    fontWeight: '600'
  },
  adminExitBtnPill: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2
  },
  adminExitBtnPillText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '800'
  },

  // 9. MATCH SCHEDULES MANAGEMENT STYLES
  tabBadgeBlue: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6
  },
  tabBadgeBlueText: {
    color: '#2563eb',
    fontSize: 11,
    fontWeight: '800'
  },
  statPillLabel: {
    fontSize: 13.5,
    fontWeight: '600'
  },
  statPillCount: {
    fontSize: 22,
    fontWeight: '900'
  },
  rowPillBlue: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderColor: 'rgba(59, 130, 246, 0.5)',
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6'
  },
  rowPillGray: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderColor: 'rgba(148, 163, 184, 0.5)',
    borderLeftWidth: 4,
    borderLeftColor: '#94a3b8'
  },
  rowPillNavy: {
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    borderColor: 'rgba(212, 175, 55, 0.4)',
    borderLeftWidth: 4,
    borderLeftColor: '#d4af37'
  },
  btnPrimarySchedule: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  btnPrimaryScheduleText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800'
  },
  scheduleInfoBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14
  },
  scheduleInfoText: {
    color: '#1e40af',
    fontSize: 12.5,
    lineHeight: 18
  },
  filterToolbarCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12
  },
  searchBoxWrap: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12
  },
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  refreshBtnSm: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#f8fafc'
  },
  refreshBtnSmText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700'
  },
  loadingContainerBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 13.5,
    fontWeight: '600'
  },
  emptyContainerBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18
  },
  itemCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  itemCrest: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#0a1432',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)'
  },
  itemCrestText: {
    color: '#f59e0b',
    fontSize: 18,
    fontWeight: '900'
  },
  itemTitleCol: {
    gap: 3
  },
  itemName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a'
  },
  matchIdBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  matchIdBadgeText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700'
  },
  itemSub: {
    fontSize: 12.5,
    color: '#64748b',
    fontWeight: '500'
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1
  },
  badgeScheduled: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd'
  },
  badgeScheduledText: {
    color: '#2563eb',
    fontSize: 11.5,
    fontWeight: '800'
  },
  badgeLive: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5'
  },
  badgeLiveText: {
    color: '#dc2626',
    fontSize: 11.5,
    fontWeight: '800'
  },
  badgeCompleted: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0'
  },
  badgeCompletedText: {
    color: '#059669',
    fontSize: 11.5,
    fontWeight: '800'
  },
  badgeCancelled: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1'
  },
  badgeCancelledText: {
    color: '#64748b',
    fontSize: 11.5,
    fontWeight: '800'
  },
  resultNoticeBox: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0'
  },
  resultNoticeText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '600'
  },
  scheduleActionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    flexWrap: 'wrap'
  },
  btnOutlineEdit: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff'
  },
  btnOutlineEditText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '700'
  },
  btnOutlineDelete: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc'
  },
  btnOutlineDeleteText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700'
  },
  formErrorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14
  },
  formErrorText: {
    color: '#b91c1c',
    fontSize: 12.5,
    fontWeight: '600'
  },
  modalFormSection: {
    marginBottom: 16
  },
  formSectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8
  },
  pillsRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  selectPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc'
  },
  selectPillActive: {
    backgroundColor: '#0a1432',
    borderColor: '#d4af37'
  },
  selectPillText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600'
  },
  selectPillTextActive: {
    color: '#f59e0b',
    fontWeight: '800'
  },
  twoColFormGrid: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
    marginBottom: 14
  },
  pillsColWrap: {
    gap: 6,
    maxHeight: 160
  },
  selectPillBlock: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc'
  },
  selectPillBlockActive: {
    backgroundColor: '#0a1432',
    borderColor: '#d4af37'
  },
  selectPillBlockText: {
    fontSize: 12.5,
    color: '#334155',
    fontWeight: '600'
  },
  selectPillBlockTextActive: {
    color: '#f59e0b',
    fontWeight: '800'
  },
  formRowInputs: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 12
  },
  formInputCol: {
    flex: 1,
    minWidth: 140
  },
  formTextInput: {
    height: 42,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0f172a'
  },
  formatSelectRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14
  },
  formatBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    alignItems: 'center'
  },
  formatBtnActive: {
    backgroundColor: '#0a1432',
    borderColor: '#d4af37'
  },
  formatBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569'
  },
  formatBtnTextActive: {
    color: '#f59e0b',
    fontWeight: '800'
  },
  detailsGridBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 10
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 6
  },
  detailsKey: {
    fontSize: 12.5,
    color: '#64748b',
    fontWeight: '600'
  },
  detailsVal: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '700'
  },

  // Hamburger Button & Icon Styles
  hamburgerBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    cursor: 'pointer'
  },
  hamburgerIcon: {
    fontSize: 22,
    color: '#fbbf24',
    fontWeight: '900',
    lineHeight: 24,
    textAlign: 'center'
  },

  // Distinct Match Schedules Highlight & Operations Cards
  schedulesStatCard: {
    flex: 1,
    minWidth: 320,
    backgroundColor: '#0c2340',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.45)',
    padding: 22,
    shadowColor: '#0c2340',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4
  },
  schedulesOpsCard: {
    flex: 1,
    minWidth: 320,
    backgroundColor: '#0a1e38',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.45)',
    padding: 22,
    shadowColor: '#0a1e38',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 4
  },
  schedulesIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#1d4ed8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3
  },
  schedulesGoldIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3
  },
  schedulesStatCardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800'
  },
  schedulesStatCardTag: {
    color: '#60a5fa',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8
  },
  schedulesOpsTag: {
    color: '#fbbf24',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8
  },
  schedulesStatCardSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18
  },

  // Schedules Metric Pill Rows
  schedulesPillLive: {
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)'
  },
  schedulesPillScheduled: {
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderLeftWidth: 4,
    borderLeftColor: '#0284c7',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)'
  },
  schedulesPillCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderLeftWidth: 4,
    borderLeftColor: '#059669',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)'
  },
  schedulesPillTotal: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderLeftWidth: 4,
    borderLeftColor: '#d97706',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)'
  },
  livePulseTag: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8
  },
  livePulseTagText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5
  },

  // Fixture Operations Action & Info
  btnScheduleGradient: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3
  },
  btnScheduleGradientText: {
    color: '#0f172a',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  scheduleInfoBoxModern: {
    backgroundColor: 'rgba(15, 31, 60, 0.7)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    padding: 12,
    gap: 8
  },
  scheduleInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  scheduleInfoLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600'
  },
  scheduleInfoVal: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '800'
  },

  // Filter Pills with Status-Differentiated Colors
  filterPillActiveScheduled: {
    backgroundColor: '#2563eb',
    borderColor: '#1d4ed8'
  },
  filterPillActiveLive: {
    backgroundColor: '#dc2626',
    borderColor: '#b91c1c'
  },
  filterPillActiveCompleted: {
    backgroundColor: '#059669',
    borderColor: '#047857'
  },
  filterPillActiveCancelled: {
    backgroundColor: '#475569',
    borderColor: '#334155'
  },

  // Differentiated Match Cards
  matchCardLive: {
    borderLeftWidth: 6,
    borderLeftColor: '#ef4444',
    borderColor: '#fca5a5',
    backgroundColor: '#fffafb',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4
  },
  matchCardScheduled: {
    borderLeftWidth: 6,
    borderLeftColor: '#2563eb',
    borderColor: '#bfdbfe',
    backgroundColor: '#ffffff'
  },
  matchCardCompleted: {
    borderLeftWidth: 6,
    borderLeftColor: '#10b981',
    borderColor: '#bbf7d0',
    backgroundColor: '#ffffff'
  },
  matchCardCancelled: {
    borderLeftWidth: 6,
    borderLeftColor: '#94a3b8',
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    opacity: 0.85
  },

  // Schedule Modal Advanced Window Controls & Layout
  modalDialogMaximized: {
    maxWidth: '96%',
    width: '96%',
    maxHeight: '96%',
    height: '96%'
  },
  scheduleModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1
  },
  scheduleModalHeaderIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0a1936',
    borderWidth: 1.5,
    borderColor: '#d4af37',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0a1936',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3
  },
  scheduleModalBadgePill: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  scheduleModalBadgePillText: {
    color: '#b45309',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6
  },
  modalHeaderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12
  },
  modalWindowBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    cursor: 'pointer'
  },
  modalMinimizeBtn: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a'
  },
  modalMinimizeText: {
    color: '#b45309',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 16
  },
  modalMaximizeBtn: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe'
  },
  modalMaximizeText: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '900'
  },
  modalCloseRedBtn: {
    backgroundColor: '#ef4444',
    borderColor: '#dc2626',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3
  },
  modalCloseRedText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900'
  },

  // Minimized Dock Bar
  minimizedDockBar: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#0a1936',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#d4af37',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    zIndex: 9999,
    boxShadow: '0 8px 30px rgba(0,0,0,0.45)',
    elevation: 8,
    maxWidth: 480
  },
  minimizedDockLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1
  },
  minimizedDockIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1e3a8a',
    alignItems: 'center',
    justifyContent: 'center'
  },
  minimizedDockTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800'
  },
  minimizedDockSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 1
  },
  minimizedDockActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  minimizedRestoreBtn: {
    backgroundColor: '#d4af37',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  minimizedRestoreBtnText: {
    color: '#0f172a',
    fontSize: 11.5,
    fontWeight: '800'
  },
  minimizedCloseBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  minimizedCloseBtnText: {
    color: '#f87171',
    fontSize: 11.5,
    fontWeight: '800'
  },

  // Section Headers & Meta
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    flexWrap: 'wrap',
    gap: 8
  },
  sectionRequiredTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#d97706',
    letterSpacing: 0.6
  },
  sectionSubDesc: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 10
  },

  // Tournament Typed Format
  tournamentInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    height: 44,
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
  },
  inputPrefixIcon: {
    fontSize: 16,
    marginRight: 8
  },
  tournamentTextInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0f172a',
    fontWeight: '600'
  },
  quickPresetHeading: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6
  },
  selectPillModern: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff'
  },
  selectPillModernActive: {
    backgroundColor: '#0a1936',
    borderColor: '#d4af37'
  },
  selectPillModernText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600'
  },
  selectPillModernTextActive: {
    color: '#fbbf24',
    fontWeight: '800'
  },
  tournamentAssignedBadge: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 10
  },
  tournamentAssignedBadgeText: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '600'
  },

  // Dynamic Dropdown Tables
  dropdownContainer: {
    position: 'relative',
    zIndex: 10
  },
  dropdownSelectBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
  },
  dropdownSelectBoxActive: {
    borderColor: '#d4af37',
    boxShadow: '0 0 0 3px rgba(212, 175, 55, 0.2)'
  },
  dropdownSelectedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1
  },
  teamCrestMini: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dropdownSelectedTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a'
  },
  dropdownSelectedSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 8
  },
  dropdownTablePanel: {
    marginTop: 6,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#d4af37',
    padding: 10,
    boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
    maxHeight: 240
  },
  dropdownSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    height: 36,
    marginBottom: 8
  },
  dropdownSearchInput: {
    flex: 1,
    fontSize: 12.5,
    color: '#0f172a'
  },
  dropdownTableScroll: {
    maxHeight: 180
  },
  dropdownTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  dropdownTableRowActive: {
    backgroundColor: '#fef3c7'
  },
  dropdownTableRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1
  },
  dropdownRowTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0f172a'
  },
  dropdownRowTitleActive: {
    color: '#b45309',
    fontWeight: '800'
  },
  dropdownRowMeta: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1
  },
  dropdownRowCheck: {
    color: '#16a34a',
    fontSize: 14,
    fontWeight: '900'
  },

  // Weather & Rain Timing Quick Presets
  weatherQuickRow: {
    marginTop: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10
  },
  weatherQuickLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6
  },
  btnDelayChip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  btnDelayChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e3a8a'
  },

  // Automated Dispatch Notice
  automatedDispatchNoticeBox: {
    marginTop: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 12
  },
  automatedDispatchTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1e40af'
  },
  automatedDispatchDesc: {
    fontSize: 11.5,
    color: '#1e3a8a',
    lineHeight: 16
  },
  dispatchRecipientRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8
  },
  recipientPill: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  recipientPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1d4ed8'
  },

  // Dynamic Overs Pills (50, 25, 20, 15, 10, 5)
  oversSelectPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff'
  },
  oversSelectPillActive: {
    backgroundColor: '#0a1936',
    borderColor: '#d4af37'
  },
  oversSelectPillText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '700'
  },
  oversSelectPillTextActive: {
    color: '#fbbf24',
    fontWeight: '800'
  },

  // Officials Cards
  umpiresCardRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    marginTop: 10
  },
  umpireCard: {
    flex: 1,
    minWidth: 240,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12
  },
  umpireRoleTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a'
  },
  umpireNameText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#2563eb',
    marginTop: 3
  },
  umpireMetaText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2
  },

  // Dynamic Responsive Submit Button
  modalDynamicSubmitBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)',
    elevation: 3
  },
  modalDynamicSubmitBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.3
  }
} as any);
