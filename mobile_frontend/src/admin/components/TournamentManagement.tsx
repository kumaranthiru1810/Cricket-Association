/**
 * src/admin/components/TournamentManagement.tsx
 * Comprehensive Tournament Management & Championship Hub for Cricket Association Admin Panel.
 * Implements tournament listings, advanced multi-step creation wizard, team selection from database,
 * dynamic format configuration (Round Robin / Knockout), automatic fixture generator,
 * scheduler integration, umpire appointments, and live MongoDB points table calculation.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
  Linking,
  Alert,
  Image,
  useWindowDimensions
} from 'react-native';
import { ScorerApi, API_URL, resolveImageUrl } from '../../services/api';
import { adminApi } from '../services/adminApi';
import { showSuccess, showError, showWarning, showConfirm } from '../../utils/sweetalert';
import { useDebounce } from '../../utils/debounce';
import { Ionicons } from '@expo/vector-icons';
import TournamentAdvancedTabs from './TournamentAdvancedTabs';

export interface TournamentManagementProps {
  onOpenScheduler?: (tournament: any, match?: any) => void;
  onExit?: () => void;
}

type TournamentFilterStatus = 'ALL' | 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
type TournamentTab = 'overview' | 'teams' | 'groups' | 'schedule' | 'points' | 'bracket' | 'simulator' | 'stats' | 'rules';
type TournamentType =
  | 'SINGLE_ROUND_ROBIN'
  | 'DOUBLE_ROUND_ROBIN'
  | 'SINGLE_ELIMINATION'
  | 'DOUBLE_ELIMINATION'
  | 'GROUP_KNOCKOUT'
  | 'LEAGUE_PLAYOFFS';

const TOURNAMENT_FORMAT_META: Record<TournamentType, { label: string; easyExplain: string; unavailable?: boolean }> = {
  SINGLE_ROUND_ROBIN: {
    label: 'Single Round Robin',
    easyExplain: 'Every team plays every other team once. Each win earns points, and the top team on the points table wins.'
  },
  DOUBLE_ROUND_ROBIN: {
    label: 'Double Round Robin',
    easyExplain: 'Every team plays every other team twice (home & away). The team with the highest points after all matches wins.'
  },
  SINGLE_ELIMINATION: {
    label: 'Single Elimination',
    easyExplain: 'Lose one match and the team is out. Winners move to the next round until the Grand Final.'
  },
  DOUBLE_ELIMINATION: {
    label: 'Double Elimination',
    easyExplain: 'Coming Soon — Full Losers Bracket & Grand Final Reset is reserved for a future update.',
    unavailable: true
  },
  GROUP_KNOCKOUT: {
    label: 'Group + Knockout',
    easyExplain: 'Teams are split into groups and play within their group. Top teams from each group advance to the knockout rounds.'
  },
  LEAGUE_PLAYOFFS: {
    label: 'League + Playoffs',
    easyExplain: 'All teams play in a league table first. The top teams advance to the Playoffs (Qualifier, Eliminator & Final) for the trophy.'
  }
};

const normalizeTournamentType = (rawType?: string, rrType?: string): TournamentType => {
  if (rawType === 'SINGLE_ROUND_ROBIN' || rawType === 'DOUBLE_ROUND_ROBIN' || rawType === 'SINGLE_ELIMINATION' || rawType === 'DOUBLE_ELIMINATION' || rawType === 'GROUP_KNOCKOUT' || rawType === 'LEAGUE_PLAYOFFS') {
    return rawType;
  }
  if (rawType === 'KNOCKOUT') return 'SINGLE_ELIMINATION';
  if (rawType === 'LEAGUE_KNOCKOUT') return 'LEAGUE_PLAYOFFS';
  if (rawType === 'GROUP_SUPER_LEAGUE') return 'GROUP_KNOCKOUT';
  if (rawType === 'LEAGUE') return rrType === 'DOUBLE' ? 'DOUBLE_ROUND_ROBIN' : 'SINGLE_ROUND_ROBIN';
  return 'SINGLE_ROUND_ROBIN';
};
type MatchFormat = 'T10' | 'T20' | 'ODI' | 'CUSTOM';

// Helper to sanitize unsigned integer inputs (only 0-9) and signed integer inputs (optional leading '-' + 0-9)
const sanitizeUnsignedInt = (val: string) => val.replace(/[^0-9]/g, '');
const sanitizeSignedInt = (val: string) => val.replace(/(?!^)-|[^0-9-]/g, '');

// Web select inline style to ensure appearance: none and full width render across all browsers
const webSelectStyle: any = {
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  minHeight: 44,
  boxSizing: 'border-box',
  paddingLeft: 14,
  paddingRight: 38,
  paddingTop: 10,
  paddingBottom: 10,
  fontSize: 14,
  fontWeight: '600',
  borderRadius: 8,
  border: '1.5px solid #cbd5e1',
  backgroundColor: '#ffffff',
  color: '#0f172a',
  outline: 'none',
  cursor: 'pointer',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  appearance: 'none',
  display: 'block',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

export const TournamentManagement: React.FC<TournamentManagementProps> = ({
  onOpenScheduler,
  onExit
}) => {
  // ── Main State ─────────────────────────────────────────────────────────
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<TournamentFilterStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // ── Admin Sub-Sections (Directory / Registrations / Approved Teams) ──────
  const [adminSection, setAdminSection] = useState<'directory' | 'registrations' | 'approved'>('directory');
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [regLoading, setRegLoading] = useState<boolean>(false);
  const [regTournamentFilter, setRegTournamentFilter] = useState<string>('ALL');
  const [regStatusFilter, setRegStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [regTourDropdownOpen, setRegTourDropdownOpen] = useState<boolean>(false);
  const [regStatusDropdownOpen, setRegStatusDropdownOpen] = useState<boolean>(false);
  const [regSearchQuery, setRegSearchQuery] = useState<string>('');
  const debouncedRegSearchQuery = useDebounce(regSearchQuery, 300);

  // Rejection Reason Prompt Modal
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [selectedRegForReject, setSelectedRegForReject] = useState<any | null>(null);
  const [rejectionReasonText, setRejectionReasonText] = useState<string>('');
  const [rejectSubmitting, setRejectSubmitting] = useState<boolean>(false);

  // Approved Teams Tab State
  const [approvedTabTournamentId, setApprovedTabTournamentId] = useState<string>('');
  const [approvedTourDropdownOpen, setApprovedTourDropdownOpen] = useState<boolean>(false);
  const [approvedTeamsList, setApprovedTeamsList] = useState<any[]>([]);
  const [approvedTeamsLoading, setApprovedTeamsLoading] = useState<boolean>(false);

  // View Team & Players Roster Modal State
  const [viewTeamModal, setViewTeamModal] = useState<any | null>(null);

  // Database Teams & Umpires
  const [dbTeams, setDbTeams] = useState<any[]>([]);
  const [dbUmpires, setDbUmpires] = useState<any[]>([]);
  const [dbVenues, setDbVenues] = useState<any[]>([]);

  // ── Create / Edit Modal State ──────────────────────────────────────────
  const { width: winWidth } = useWindowDimensions();
  const isMobile = winWidth < 640;
  const [wizardOpen, setWizardOpen] = useState<boolean>(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editingTournamentId, setEditingTournamentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form Fields
  const [formName, setFormName] = useState<string>('');
  const [formNameError, setFormNameError] = useState<string | null>(null);
  const [formShortName, setFormShortName] = useState<string>('');
  const [formShortNameError, setFormShortNameError] = useState<string | null>(null);
  const [formLogoUrl, setFormLogoUrl] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formTournamentType, setFormTournamentType] = useState<TournamentType>('SINGLE_ROUND_ROBIN');
  const [formCategory, setFormCategory] = useState<string>('Senior Men');
  const [formGender, setFormGender] = useState<string>('Men');
  const [formBallType, setFormBallType] = useState<string>('Red Leather');
  const [formCustomBallType, setFormCustomBallType] = useState<string>('');
  const [formCustomBallTypeError, setFormCustomBallTypeError] = useState<string | null>(null);
  const [formMatchFormat, setFormMatchFormat] = useState<MatchFormat>('T20');
  const [formOvers, setFormOvers] = useState<string>('20');
  const [formSeason, setFormSeason] = useState<string>('2026');

  // Season Year Picker Modal State
  const [showYearPicker, setShowYearPicker] = useState<boolean>(false);
  const [pickerDecadeStart, setPickerDecadeStart] = useState<number>(() => {
    const yr = parseInt(formSeason, 10) || new Date().getFullYear();
    return Math.floor(yr / 10) * 10;
  });

  // Tournament Name live validation: letters, numbers, spaces, and underscore only
  const handleTournamentNameChange = (val: string) => {
    setFormName(val);
    if (!val.trim()) {
      setFormNameError('Tournament Name is required.');
    } else if (!/^[a-zA-Z0-9_\s]+$/.test(val)) {
      setFormNameError('Only letters, numbers, spaces, and underscores (_) are allowed.');
    } else {
      setFormNameError(null);
    }
  };

  // Tournament Short Name live validation: letters, numbers, spaces, and underscore only
  const handleTournamentShortNameChange = (val: string) => {
    setFormShortName(val);
    if (!val.trim()) {
      setFormShortNameError('Short Name / Abbreviation is required.');
    } else if (!/^[a-zA-Z0-9_\s]+$/.test(val)) {
      setFormShortNameError('Only letters, numbers, spaces, and underscores (_) are allowed.');
    } else {
      setFormShortNameError(null);
    }
  };

  // Custom Ball Type live validation: letters, spaces, and hyphens only
  const handleCustomBallTypeChange = (val: string) => {
    setFormCustomBallType(val);
    if (!val.trim()) {
      setFormCustomBallTypeError('Custom Ball Type is required.');
    } else if (!/^[a-zA-Z\s-]+$/.test(val)) {
      setFormCustomBallTypeError('Only letters, spaces, and hyphens (-) are allowed. Numbers and special characters are not allowed.');
    } else if (val.trim().length < 2) {
      setFormCustomBallTypeError('Custom Ball Type must be at least 2 characters.');
    } else {
      setFormCustomBallTypeError(null);
    }
  };

  // Schedule & Rules Fields
  const [formStartDate, setFormStartDate] = useState<string>('');
  const [formEndDate, setFormEndDate] = useState<string>('');
  const [formRegStartDate, setFormRegStartDate] = useState<string>('');
  const [formRegEndDate, setFormRegEndDate] = useState<string>('');
  const [formVenue, setFormVenue] = useState<string>('Kamarajar District Stadium');
  const [formMaxTeams, setFormMaxTeams] = useState<string>('8');
  const [formMinTeams, setFormMinTeams] = useState<string>('2');
  const [formPointsWin, setFormPointsWin] = useState<string>('4');
  const [formPointsLoss, setFormPointsLoss] = useState<string>('0');
  const [formPointsTie, setFormPointsTie] = useState<string>('2');
  const [formPointsNR, setFormPointsNR] = useState<string>('2');
  const [formPointsBonusWin, setFormPointsBonusWin] = useState<string>('1');
  const [formPointsBonusLoss, setFormPointsBonusLoss] = useState<string>('-1');
  const [formPointsWalkoverWin, setFormPointsWalkoverWin] = useState<string>('4');
  const [formPointsWalkoverLoss, setFormPointsWalkoverLoss] = useState<string>('-1');
  const [formPlayingXI, setFormPlayingXI] = useState<string>('11');
  const [formSubstitutes, setFormSubstitutes] = useState<string>('4');
  const [formAllowSuperOver, setFormAllowSuperOver] = useState<boolean>(true);
  const [formAllowDLS, setFormAllowDLS] = useState<boolean>(false);
  const [formRulesText, setFormRulesText] = useState<string>('Standard ICC / TNCA Playing Conditions apply.');

  // Dynamic Playing Rules (Rules 5, 8, 14, 18)
  const [formPowerplayOvers, setFormPowerplayOvers] = useState<string>('5');
  const [formMaxOutsidePP, setFormMaxOutsidePP] = useState<string>('2');
  const [formMaxOutsidePostPP, setFormMaxOutsidePostPP] = useState<string>('5');
  const [formMaxOnSide, setFormMaxOnSide] = useState<string>('5');
  const [formMaxBehindCrease, setFormMaxBehindCrease] = useState<string>('2');
  const [formFreeHitAllNoBalls, setFormFreeHitAllNoBalls] = useState<boolean>(true);
  const [formAllowChainOver, setFormAllowChainOver] = useState<boolean>(false);
  const [formMaxOversPerBowler, setFormMaxOversPerBowler] = useState<string>('4');
  const [formDelayPenaltyEnabled, setFormDelayPenaltyEnabled] = useState<boolean>(true);
  const [formDelayIntervalValue, setFormDelayIntervalValue] = useState<string>('4');
  const [formDelayIntervalUnit, setFormDelayIntervalUnit] = useState<'HOURS' | 'MINUTES' | 'SECONDS'>('MINUTES');
  const [formDelayReduceUnit, setFormDelayReduceUnit] = useState<'OVERS' | 'BALLS'>('OVERS');
  const [formDelayOversReduced, setFormDelayOversReduced] = useState<string>('1');
  const [formTieHandling, setFormTieHandling] = useState<'SHARE_POINTS' | 'SUPER_OVER'>('SHARE_POINTS');

  // Tournament Winner & Runner-Up Trophies & Awards
  const [formWinnerTeamName, setFormWinnerTeamName] = useState<string>('');
  const [formRunnerUpTeamName, setFormRunnerUpTeamName] = useState<string>('');
  const [formWinnerTrophyTitle, setFormWinnerTrophyTitle] = useState<string>('Championship Winner Trophy');
  const [formRunnerUpTrophyTitle, setFormRunnerUpTrophyTitle] = useState<string>('Runner-Up Trophy');
  const [formPotmEveryMatch, setFormPotmEveryMatch] = useState<boolean>(true);

  // Team Selection Fields
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [teamSearchQuery, setTeamSearchQuery] = useState<string>('');

  // Format Configuration Fields
  const [formRoundRobinType, setFormRoundRobinType] = useState<'SINGLE' | 'DOUBLE'>('SINGLE');
  const [formQualifyingTeamsCount, setFormQualifyingTeamsCount] = useState<string>('4');
  const [formQualificationRules, setFormQualificationRules] = useState<string>('Top 4 teams advance to semi-finals');
  const [formGroupCount, setFormGroupCount] = useState<string>('5');
  const [formAllowExtraGroup, setFormAllowExtraGroup] = useState<boolean>(true);
  const [formTeamsPerGroup, setFormTeamsPerGroup] = useState<string>('8');
  const [formQualifiersPerGroup, setFormQualifiersPerGroup] = useState<string>('2');
  const [formSuperLeagueEnabled, setFormSuperLeagueEnabled] = useState<boolean>(true);
  const [formSuperLeagueGroups, setFormSuperLeagueGroups] = useState<string>('4');
  const [formSuperLeagueQualifiers, setFormSuperLeagueQualifiers] = useState<string>('1');
  const [formIncludeSemis, setFormIncludeSemis] = useState<boolean>(true);
  const [formIncludeFinal, setFormIncludeFinal] = useState<boolean>(true);
  const [formGroupDistribution, setFormGroupDistribution] = useState<'BALANCED' | 'RANDOM' | 'SEEDED' | 'MANUAL'>('BALANCED');
  const [formManualGroups, setFormManualGroups] = useState<Record<string, string[]>>({});
  const [formBestRunnersUp, setFormBestRunnersUp] = useState<string>('0');
  const [formTieBreakerOrder, setFormTieBreakerOrder] = useState<string>('POINTS,WINS,NRR,HEAD_TO_HEAD');

  // ── Details Dashboard Modal State ──────────────────────────────────────
  const [detailsModalOpen, setDetailsModalOpen] = useState<boolean>(false);
  const [selectedTournament, setSelectedTournament] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [detailsTab, setDetailsTab] = useState<TournamentTab>('overview');
  const [matchStatusFilter, setMatchStatusFilter] = useState<'ALL' | 'SCHEDULED' | 'LIVE' | 'COMPLETED'>('ALL');
  const [matchGroupFilter, setMatchGroupFilter] = useState<string>('ALL');
  const [generatingMatches, setGeneratingMatches] = useState<boolean>(false);
  const [genModalOpen, setGenModalOpen] = useState<boolean>(false);
  const [genStartDate, setGenStartDate] = useState<string>('');
  const [genMatchesPerDay, setGenMatchesPerDay] = useState<string>('2');
  const [genTimeSlots, setGenTimeSlots] = useState<string>('09:30 AM, 02:30 PM');
  const [genSelectedVenues, setGenSelectedVenues] = useState<string[]>([]);
  const [genIgnoreConflicts, setGenIgnoreConflicts] = useState<boolean>(false);
  const [backendPreviewData, setBackendPreviewData] = useState<any | null>(null);
  const [backendPreviewLoading, setBackendPreviewLoading] = useState<boolean>(false);
  const [groupPointsData, setGroupPointsData] = useState<any | null>(null);
  const [groupPointsLoading, setGroupPointsLoading] = useState<boolean>(false);
  const [groupPointsError, setGroupPointsError] = useState<string | null>(null);

  // ── Load Data on Mount ─────────────────────────────────────────────────
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadTournaments(),
        loadRegistrations(),
        loadTeamsFromDb(),
        loadUmpiresFromDb(),
        loadVenuesFromDb()
      ]);
    } catch (err) {
      console.warn('Failed to load initial tournament data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTournaments = async () => {
    try {
      const res = await ScorerApi.getTournaments();
      const list = res.tournaments || res.data || [];
      setTournaments(list);
    } catch (err: any) {
      console.warn('Load tournaments error:', err.message);
    }
  };

  const loadRegistrations = async () => {
    setRegLoading(true);
    try {
      const res = await ScorerApi.getAllTournamentRegistrations();
      const list = res.registrations || res.data || [];
      setRegistrations(list);
    } catch (err: any) {
      console.warn('Load registrations error:', err.message);
    } finally {
      setRegLoading(false);
    }
  };

  const loadApprovedTeams = async (tourId: string) => {
    if (!tourId) return;
    setApprovedTeamsLoading(true);
    try {
      const res = await ScorerApi.getTournamentApprovedTeams(tourId);
      setApprovedTeamsList(res.teams || res.data || []);
    } catch (err: any) {
      console.warn('Load approved teams error:', err.message);
    } finally {
      setApprovedTeamsLoading(false);
    }
  };

  const handleApproveRegistration = async (reg: any) => {
    const confirmed = await showConfirm(
      `Approve ${reg.team_name}?`,
      `Approving this registration will officially enroll ${reg.team_name} in ${reg.tournament_name || 'the championship'} and allocate an official participant slot.`,
      '✅ Approve Team',
      'Cancel',
      'question'
    );
    if (!confirmed) return;

    try {
      await ScorerApi.approveTournamentRegistration(reg.id || reg._id);
      await showSuccess('Registration Approved', `${reg.team_name} is now officially registered in ${reg.tournament_name || 'the tournament'}!`);
      await Promise.all([loadRegistrations(), loadTournaments()]);
      if (approvedTabTournamentId === (reg.tournament_id || reg.tournamentId)) {
        await loadApprovedTeams(approvedTabTournamentId);
      }
    } catch (err: any) {
      await showError('Approval Failed', err.message || 'Could not approve registration.');
    }
  };

  const handleOpenRejectModal = (reg: any) => {
    setSelectedRegForReject(reg);
    setRejectionReasonText('Team registration criteria not met or roster limits reached.');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedRegForReject) return;
    if (!rejectionReasonText.trim()) {
      await showWarning('Reason Required', 'Please enter a reason for rejecting this registration.');
      return;
    }
    setRejectSubmitting(true);
    try {
      await ScorerApi.rejectTournamentRegistration(
        selectedRegForReject.id || selectedRegForReject._id,
        rejectionReasonText.trim()
      );
      await showSuccess('Registration Rejected', `Registration for ${selectedRegForReject.team_name} has been rejected.`);
      setRejectModalOpen(false);
      setSelectedRegForReject(null);
      setRejectionReasonText('');
      await Promise.all([loadRegistrations(), loadTournaments()]);
    } catch (err: any) {
      await showError('Rejection Failed', err.message || 'Could not reject registration.');
    } finally {
      setRejectSubmitting(false);
    }
  };

  const handleToggleTournamentStatus = async (tour: any) => {
    const current = (tour.status || 'UPCOMING').toUpperCase();
    const isCurrentlyActive = current === 'REGISTRATION_OPEN' || current === 'ACTIVE' || current === 'ONGOING';
    const newStatus = isCurrentlyActive ? 'INACTIVE' : 'REGISTRATION_OPEN';
    const actionLabel = isCurrentlyActive ? 'Deactivate' : 'Activate (Open Registration)';

    const confirmToggle = await showConfirm(
      `${actionLabel} Tournament?`,
      `Set status for '${tour.name}' to ${newStatus}?`,
      actionLabel,
      'Cancel',
      'question'
    );
    if (!confirmToggle) return;

    try {
      await ScorerApi.updateTournament(tour.id, { status: newStatus });
      await showSuccess('Status Updated', `Tournament status changed to ${newStatus}.`);
      await loadTournaments();
    } catch (err: any) {
      await showError('Update Failed', err.message || 'Could not update tournament status.');
    }
  };

  const loadTeamsFromDb = async () => {
    try {
      const [regRes, teamsRes, adminTeamsRes, playersRes] = await Promise.all([
        ScorerApi.getAllRegistrations().catch(err => {
          console.warn('[TournamentManagement] getAllRegistrations error:', err);
          return { success: false, registrations: [] };
        }),
        ScorerApi.getTeams().catch(err => {
          console.warn('[TournamentManagement] getTeams error:', err);
          return { success: false, teams: [] };
        }),
        adminApi.getTeams().catch(err => {
          console.warn('[TournamentManagement] adminApi.getTeams error:', err);
          return { success: false, data: [] };
        }),
        adminApi.getPlayers().catch(err => {
          console.warn('[TournamentManagement] adminApi.getPlayers error:', err);
          return { success: false, data: [] };
        })
      ]);

      const raw = regRes?.registrations || regRes?.data || [];
      const teamsList = teamsRes?.teams || teamsRes?.data || [];
      const adminTeamsList = adminTeamsRes?.data || adminTeamsRes?.teams || (Array.isArray(adminTeamsRes) ? adminTeamsRes : []);
      const playersList = playersRes?.data || playersRes?.players || (Array.isArray(playersRes) ? playersRes : []);

      // Map each team ID to its players (with mobile/phone) for per-tournament duplicate player checking
      const teamPlayersMap: Record<string, Array<{ name: string; mobile: string }>> = {};
      const addPlayerToTeamMap = (tid: string, pName: string, pPhone: string) => {
        const key = (tid || '').trim().toLowerCase();
        const digits = String(pPhone || '').replace(/\D/g, '');
        const normMobile = digits.length >= 10 ? digits.slice(-10) : digits;
        if (!key || !normMobile) return;
        if (!teamPlayersMap[key]) teamPlayersMap[key] = [];
        if (!teamPlayersMap[key].some(p => p.mobile === normMobile)) {
          teamPlayersMap[key].push({ name: pName || 'Player', mobile: normMobile });
        }
      };

      if (Array.isArray(raw)) {
        raw.forEach((r: any) => {
          if (r.type === 'TEAM') {
            const tid = r.id || r.mongoId || r._id;
            const members = r.members || r.players || r.details?.players || [];
            if (Array.isArray(members)) {
              members.forEach((m: any) => addPlayerToTeamMap(tid, m.name || m.playerName, m.phone || m.mobile));
            }
          }
        });
      }
      if (Array.isArray(teamsList)) {
        teamsList.forEach((t: any) => {
          const tid = t.id || t.team_id || t._id;
          const members = t.members || t.players || [];
          if (Array.isArray(members)) {
            members.forEach((m: any) => addPlayerToTeamMap(tid, m.name || m.playerName, m.phone || m.mobile));
          }
        });
      }
      if (Array.isArray(playersList)) {
        playersList.forEach((p: any) => {
          const tid = p.team_id || p.teamId;
          if (tid) addPlayerToTeamMap(tid, p.name || p.playerName, p.mobile || p.phone);
        });
      }

      const allTeams: any[] = [];
      const seenIds = new Set<string>();

      const addTeam = (
        teamId: string,
        name: string,
        coachName: string,
        coachEmail: string,
        taluk: string,
        status: string,
        createdAt?: string | null
      ) => {
        const tName = (name || '').trim();
        const tid = teamId || tName;
        const key = (tid || tName).toLowerCase();
        if (key && !seenIds.has(key)) {
          seenIds.add(key);
          const s = (status || 'PENDING').toUpperCase();
          const isApproved = s === 'APPROVED' || s === 'ACTIVE';
          allTeams.push({
            id: tid || `TM-${allTeams.length + 1}`,
            team_id: tid,
            name: tName || 'Registered Team',
            team_name: tName || 'Registered Team',
            coach_name: coachName || 'Official',
            coach_email: coachEmail || '',
            taluk: taluk || 'Virudhunagar',
            status: isApproved ? 'Approved' : 'Pending',
            created_at: createdAt || null,
            players: teamPlayersMap[key] || []
          });
        }
      };

      // 1. Process registrations from database
      if (Array.isArray(raw)) {
        raw.forEach((r: any) => {
          if (r.type === 'TEAM') {
            addTeam(
              r.id || r.mongoId || r._id,
              r.name || r.team_name,
              r.contactName || r.coach_name || r.name,
              r.email || r.contactEmail || r.coach_email,
              r.taluk || r.details?.taluk || r.city,
              r.status,
              r.created_at || r.createdAt || null
            );
          }
        });
      }

      // 2. Process teams from /auth/teams
      if (Array.isArray(teamsList)) {
        teamsList.forEach((t: any) => {
          addTeam(
            t.id || t.team_id || t._id,
            t.team_name || t.name,
            t.coach_name,
            t.coach_email,
            t.taluk || t.city,
            t.status,
            t.created_at || t.createdAt || null
          );
        });
      }

      // 3. Process teams from adminApi.getTeams() (/admin/teams-list)
      if (Array.isArray(adminTeamsList)) {
        adminTeamsList.forEach((t: any) => {
          addTeam(
            t.id || t.teamId || t.team_id || t._id,
            t.name || t.teamName || t.team_name,
            t.coachName || t.coach_name,
            t.coachEmail || t.coach_email,
            t.city || t.taluk,
            t.status,
            t.created_at || t.createdAt || null
          );
        });
      }

      // Sort by registration time ascending (first registered -> first, last registered -> last)
      allTeams.sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : Number.MAX_SAFE_INTEGER;
        const tb = b.created_at ? new Date(b.created_at).getTime() : Number.MAX_SAFE_INTEGER;
        const va = Number.isNaN(ta) ? Number.MAX_SAFE_INTEGER : ta;
        const vb = Number.isNaN(tb) ? Number.MAX_SAFE_INTEGER : tb;
        return va - vb;
      });

      if (allTeams.length > 0) {
        setDbTeams(allTeams);
      } else {
        // Fallback default clubs only if database is completely empty
        setDbTeams([
          { id: 'TM-01', name: 'Sattur Spartans', coach_name: 'K. Muthu', taluk: 'Virudhunagar', status: 'Approved' },
          { id: 'TM-02', name: 'Virudhunagar Strikers', coach_name: 'S. Ganesan', taluk: 'Sivakasi', status: 'Approved' },
          { id: 'TM-03', name: 'Rajapalayam Royals', coach_name: 'R. Subramanian', taluk: 'Rajapalayam', status: 'Approved' },
          { id: 'TM-04', name: 'Aruppukottai Aces', coach_name: 'V. Raman', taluk: 'Aruppukottai', status: 'Approved' }
        ]);
      }
    } catch (err) {
      console.warn('Load teams error:', err);
    }
  };

  const loadUmpiresFromDb = async () => {
    try {
      const token = Platform.OS === 'web' && typeof window !== 'undefined' ? (localStorage.getItem('cfvd_admin_token') || sessionStorage.getItem('cfvd_admin_token')) : null;
      const res = await fetch(`${API_URL}/admin/users?role=UMPIRE`, {
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'ADMIN',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (data && data.users && data.users.length > 0) {
        setDbUmpires(data.users);
      } else {
        setDbUmpires([
          { id: 'UMP-1894', name: 'Thiru. K. Sundaram', email: 'sundaram.umpire@cfvd.org', qualification: 'Panel A - Senior' },
          { id: 'UMP-102', name: 'Thiru. M. Ramanathan', email: 'ramanathan.umpire@cfvd.org', qualification: 'Senior Panel' },
          { id: 'UMP-779', name: 'Thiru. K. Senthil Nathan', email: 'senthil.umpire@cfvd.org', qualification: 'BCCI Level 2' }
        ]);
      }
    } catch (err) {
      setDbUmpires([
        { id: 'UMP-1894', name: 'Thiru. K. Sundaram', email: 'sundaram.umpire@cfvd.org' },
        { id: 'UMP-102', name: 'Thiru. M. Ramanathan', email: 'ramanathan.umpire@cfvd.org' }
      ]);
    }
  };

  const loadVenuesFromDb = async () => {
    try {
      const res = await ScorerApi.getVenues();
      let loaded: any[] = [];
      if (res && Array.isArray(res.venues) && res.venues.length > 0) {
        loaded = res.venues;
      } else if (res && Array.isArray(res.data) && res.data.length > 0) {
        loaded = res.data;
      } else if (res && Array.isArray(res) && res.length > 0) {
        loaded = res;
      }
      if (loaded.length > 0) {
        setDbVenues(loaded);
      } else {
        setDbVenues([
          { id: 'VEN-01', name: 'Kamarajar District Stadium', location: 'Virudhunagar' },
          { id: 'VEN-02', name: 'Municipal Cricket Complex', location: 'Sivakasi' },
          { id: 'VEN-03', name: 'Rajapalayam RAC Ground', location: 'Rajapalayam' },
          { id: 'VEN-04', name: 'Aruppukottai Pavilion Turf Ground', location: 'Aruppukottai' }
        ]);
      }
    } catch (err) {
      setDbVenues([
        { id: 'VEN-01', name: 'Kamarajar District Stadium', location: 'Virudhunagar' },
        { id: 'VEN-02', name: 'Municipal Cricket Complex', location: 'Sivakasi' },
        { id: 'VEN-03', name: 'Rajapalayam RAC Ground', location: 'Rajapalayam' },
        { id: 'VEN-04', name: 'Aruppukottai Pavilion Turf Ground', location: 'Aruppukottai' }
      ]);
    }
  };

  // Listen for dynamic venue updates from Settings
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleVenueUpdate = () => {
        loadVenuesFromDb();
      };
      window.addEventListener('venues_updated', handleVenueUpdate);
      window.addEventListener('master_settings_updated', handleVenueUpdate);
      return () => {
        window.removeEventListener('venues_updated', handleVenueUpdate);
        window.removeEventListener('master_settings_updated', handleVenueUpdate);
      };
    }
  }, []);

  // ── Open Create Tournament Wizard ─────────────────────────────────────
  const handleOpenCreateWizard = () => {
    loadTeamsFromDb();
    setIsEditMode(false);
    setEditingTournamentId(null);
    setWizardStep(1);

    // Default pre-fills
    setFormName('');
    setFormNameError(null);
    setFormShortName('');
    setFormShortNameError(null);
    setFormLogoUrl('');
    setFormDescription('Annual premier district championship organized by Cricket Federation of Virudhunagar District.');
    setFormTournamentType('SINGLE_ROUND_ROBIN');
    setFormCategory('Senior Men');
    setFormGender('Men');
    setFormBallType('Red Leather');
    setFormCustomBallType('');
    setFormCustomBallTypeError(null);
    setFormMatchFormat('T20');
    setFormOvers('20');
    setFormSeason(String(new Date().getFullYear()));

    const today = new Date();
    const plus30 = new Date(today.getTime() + 30 * 86400000);
    setFormStartDate(today.toISOString().split('T')[0]);
    setFormEndDate(plus30.toISOString().split('T')[0]);
    setFormRegStartDate(today.toISOString().split('T')[0]);
    setFormRegEndDate(new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0]);

    setFormVenue('Kamarajar District Stadium');
    setFormMaxTeams('8');
    setFormMinTeams('2');
    setFormPointsWin('4');
    setFormPointsLoss('0');
    setFormPointsTie('2');
    setFormPointsNR('2');
    setFormPointsBonusWin('1');
    setFormPointsBonusLoss('-1');
    setFormPointsWalkoverWin('4');
    setFormPointsWalkoverLoss('-1');
    setFormPlayingXI('11');
    setFormSubstitutes('4');
    setFormAllowSuperOver(true);
    setFormAllowDLS(false);
    setFormRulesText('Official ICC / TNCA Playing Conditions. Win = 4 Pts, Bonus = +1/-1, Tie = 2 Pts, Walkover = +4/-1.');
    setFormPowerplayOvers('5');
    setFormMaxOutsidePP('2');
    setFormMaxOutsidePostPP('5');
    setFormMaxOnSide('5');
    setFormMaxBehindCrease('2');
    setFormFreeHitAllNoBalls(true);
    setFormDelayPenaltyEnabled(true);
    setFormDelayIntervalValue('4');
    setFormDelayIntervalUnit('MINUTES');
    setFormDelayReduceUnit('OVERS');
    setFormDelayOversReduced('1');
    setFormTieHandling('SHARE_POINTS');
    setFormWinnerTeamName('');
    setFormRunnerUpTeamName('');
    setFormWinnerTrophyTitle('Championship Winner Trophy');
    setFormRunnerUpTrophyTitle('Runner-Up Trophy');
    setFormPotmEveryMatch(true);

    // Select existing approved teams by default if available
    setSelectedTeamIds(dbTeams.slice(0, 4).map(t => t.id));
    setFormRoundRobinType('SINGLE');
    setFormQualifyingTeamsCount('4');
    setFormQualificationRules('Top 4 teams advance to semi-finals');
    setFormGroupCount('5');
    setFormAllowExtraGroup(true);
    setFormTeamsPerGroup('8');
    setFormQualifiersPerGroup('2');
    setFormSuperLeagueEnabled(true);
    setFormSuperLeagueGroups('4');
    setFormSuperLeagueQualifiers('1');
    setFormIncludeSemis(true);
    setFormIncludeFinal(true);
    setFormGroupDistribution('BALANCED');
    setFormManualGroups({});
    setFormBestRunnersUp('0');
    setFormTieBreakerOrder('POINTS,WINS,NRR,HEAD_TO_HEAD');

    setWizardOpen(true);
  };

  // ── Open Edit Tournament Wizard ───────────────────────────────────────
  const handleOpenEditWizard = (tour: any) => {
    setIsEditMode(true);
    setEditingTournamentId(tour.id);
    setWizardStep(1);

    setFormName(tour.name || '');
    setFormNameError(null);
    setFormShortName(tour.short_name || '');
    setFormShortNameError(null);
    setFormLogoUrl(tour.logo_url || '');
    setFormDescription(tour.description || '');
    setFormTournamentType(normalizeTournamentType(tour.tournament_type, tour.format_config?.round_robin_type));
    setFormCategory(tour.category || 'Senior Men');
    setFormGender(tour.gender || 'Men');
    const standardBallTypes = ['Red Leather', 'White Leather', 'Pink Leather', 'Tennis'];
    const incomingBallType = tour.ball_type || 'Red Leather';
    if (standardBallTypes.includes(incomingBallType)) {
      setFormBallType(incomingBallType);
      setFormCustomBallType('');
    } else {
      setFormBallType('CUSTOM');
      setFormCustomBallType(incomingBallType);
    }
    setFormCustomBallTypeError(null);
    setFormMatchFormat(tour.match_format || tour.format || 'T20');
    setFormOvers(String(tour.overs_per_match || 20));
    setFormSeason(tour.season || '2026');

    setFormStartDate(tour.start_date || '');
    setFormEndDate(tour.end_date || '');
    setFormRegStartDate(tour.registration_start_date || '');
    setFormRegEndDate(tour.registration_end_date || '');
    setFormVenue(tour.venue || 'Kamarajar District Stadium');

    setFormMaxTeams(String(tour.max_teams && tour.max_teams >= 8 ? tour.max_teams : 8));
    setFormMinTeams(String(tour.min_teams || 2));
    setFormPointsWin(String(tour.points_win !== undefined ? tour.points_win : 4));
    setFormPointsLoss(String(tour.points_loss !== undefined ? tour.points_loss : 0));
    setFormPointsTie(String(tour.points_tie !== undefined ? tour.points_tie : 2));
    setFormPointsNR(String(tour.points_no_result !== undefined ? tour.points_no_result : 2));
    setFormPointsBonusWin(String(tour.points_bonus_win !== undefined ? tour.points_bonus_win : 1));
    setFormPointsBonusLoss(String(tour.points_bonus_loss !== undefined ? tour.points_bonus_loss : -1));
    setFormPointsWalkoverWin(String(tour.points_walkover_win !== undefined ? tour.points_walkover_win : 4));
    setFormPointsWalkoverLoss(String(tour.points_walkover_loss !== undefined ? tour.points_walkover_loss : -1));
    setFormPlayingXI(String(tour.playing_xi_size || 11));
    setFormSubstitutes(String(tour.substitute_count || 4));
    setFormAllowSuperOver(tour.allow_super_over !== false);
    setFormAllowDLS(Boolean(tour.allow_dls));
    setFormRulesText(tour.rules || 'Standard ICC / TNCA Playing Conditions.');

    const pr = tour.playing_rules || {};
    setFormPowerplayOvers(String(pr.powerplay_overs ?? 5));
    setFormMaxOutsidePP(String(pr.max_outside_powerplay ?? 2));
    setFormMaxOutsidePostPP(String(pr.max_outside_post_powerplay ?? 5));
    setFormMaxOnSide(String(pr.max_on_side_fielders ?? 5));
    setFormMaxBehindCrease(String(pr.max_on_side_behind_crease ?? 2));
    setFormFreeHitAllNoBalls(pr.free_hit_on_all_noballs !== false);
    setFormAllowChainOver(Boolean(pr.allow_chain_over));
    setFormMaxOversPerBowler(String(pr.max_overs_per_bowler ?? Math.max(1, Math.ceil((tour.overs_per_match || 20) / 5))));
    setFormDelayPenaltyEnabled(pr.delay_penalty_enabled !== false);
    setFormDelayIntervalValue(String(pr.delay_interval_value ?? 4));
    setFormDelayIntervalUnit(
      ['HOURS', 'MINUTES', 'SECONDS'].includes(pr.delay_interval_unit) ? pr.delay_interval_unit : 'MINUTES'
    );
    setFormDelayReduceUnit(pr.delay_reduce_unit === 'BALLS' ? 'BALLS' : 'OVERS');
    setFormDelayOversReduced(String(pr.delay_overs_reduced_per_interval ?? 1));
    setFormTieHandling(pr.tie_handling === 'SUPER_OVER' ? 'SUPER_OVER' : 'SHARE_POINTS');
    setFormWinnerTeamName(tour.winner_team_name || '');
    setFormRunnerUpTeamName(tour.runner_up_team_name || '');
    setFormWinnerTrophyTitle(tour.awards_config?.winner_trophy_title || 'Championship Winner Trophy');
    setFormRunnerUpTrophyTitle(tour.awards_config?.runner_up_trophy_title || 'Runner-Up Trophy');
    setFormPotmEveryMatch(tour.awards_config?.potm_every_match !== false);

    setSelectedTeamIds(tour.teams || []);
    const fc = tour.format_config || {};
    setFormRoundRobinType(fc.round_robin_type || 'SINGLE');
    setFormQualifyingTeamsCount(String(fc.qualifying_teams_count || 4));
    setFormQualificationRules(fc.qualification_rules || 'Top 4 teams advance to semi-finals');
    setFormGroupCount(String(fc.group_count ?? 5));
    setFormAllowExtraGroup(fc.allow_extra_group !== false);
    setFormTeamsPerGroup(String(fc.teams_per_group ?? 8));
    setFormQualifiersPerGroup(String(fc.qualifiers_per_group ?? 2));
    setFormSuperLeagueEnabled(fc.super_league_enabled !== false);
    setFormSuperLeagueGroups(String(fc.super_league_groups ?? 4));
    setFormSuperLeagueQualifiers(String(fc.super_league_qualifiers_per_group ?? 1));
    setFormIncludeSemis(fc.include_semifinals !== false);
    setFormIncludeFinal(fc.include_final !== false);
    setFormGroupDistribution(
      ['BALANCED', 'RANDOM', 'SEEDED', 'MANUAL'].includes(fc.group_distribution) ? fc.group_distribution : 'BALANCED'
    );
    setFormManualGroups(fc.manual_groups && typeof fc.manual_groups === 'object' ? fc.manual_groups : {});
    setFormBestRunnersUp(String(fc.best_runners_up_count ?? 0));
    if (Array.isArray(fc.tie_breaker_order) && fc.tie_breaker_order.length > 0) {
      setFormTieBreakerOrder(fc.tie_breaker_order.join(','));
    }
    setFormQualifyingTeamsCount(String(tour.format_config?.qualifying_teams_count || 4));
    setFormQualificationRules(tour.format_config?.qualification_rules || 'Top 4 teams advance to semi-finals');

    setWizardOpen(true);
  };

  // ── Step Navigation & Validations ─────────────────────────────────────
  const handleProceedToStep2 = async () => {
    if (!formName.trim()) {
      setFormNameError('Tournament Name is required.');
      await showWarning('Required Field', 'Tournament Name is required.');
      return;
    }
    if (!/^[a-zA-Z0-9_\s]+$/.test(formName.trim())) {
      setFormNameError('Only letters, numbers, spaces, and underscores (_) are allowed. Special characters are not allowed.');
      await showWarning(
        'Invalid Tournament Name',
        'Tournament Name can only contain letters, numbers, spaces, and underscores (_). Special characters are not allowed.'
      );
      return;
    }
    if (!formShortName.trim()) {
      setFormShortNameError('Short Name / Abbreviation is required.');
      await showWarning('Required Field', 'Short Name / Abbreviation is required.');
      return;
    }
    if (!/^[a-zA-Z0-9_\s]+$/.test(formShortName.trim())) {
      setFormShortNameError('Only letters, numbers, spaces, and underscores (_) are allowed. Special characters are not allowed.');
      await showWarning(
        'Invalid Short Name',
        'Short Name / Abbreviation can only contain letters, numbers, spaces, and underscores (_). Special characters are not allowed.'
      );
      return;
    }
    if (formBallType === 'CUSTOM') {
      const trimmedBall = formCustomBallType.trim();
      if (!trimmedBall) {
        setFormCustomBallTypeError('Custom Ball Type is required.');
        await showWarning('Required Field', 'Please enter a Custom Ball Type.');
        return;
      }
      if (!/^[a-zA-Z\s-]+$/.test(trimmedBall)) {
        setFormCustomBallTypeError('Only letters, spaces, and hyphens (-) are allowed. Numbers and special characters are not allowed.');
        await showWarning(
          'Invalid Ball Type',
          'Custom Ball Type can only contain letters, spaces, and hyphens (-). Numbers and special characters are not allowed.'
        );
        return;
      }
      if (trimmedBall.length < 2) {
        setFormCustomBallTypeError('Custom Ball Type must be at least 2 characters.');
        await showWarning('Invalid Ball Type', 'Custom Ball Type must be at least 2 characters.');
        return;
      }
    }
    if (formMatchFormat === 'CUSTOM') {
      const oversNum = parseInt(formOvers, 10);
      if (!formOvers.trim() || isNaN(oversNum) || oversNum <= 0) {
        await showWarning('Invalid Custom Overs', 'Please enter a valid number of overs per match (greater than 0).');
        return;
      }
    }
    setFormNameError(null);
    setFormShortNameError(null);
    setFormCustomBallTypeError(null);
    setWizardStep(2);
  };

  const handleProceedToStep3 = async () => {
    if (formStartDate && formEndDate) {
      const s = new Date(formStartDate);
      const e = new Date(formEndDate);
      if (e < s) {
        await showWarning('Invalid Dates', 'Tournament End Date cannot be before Start Date.');
        return;
      }
    }
    const firstRuleErr = Object.values(step2RuleErrors).find(Boolean);
    if (firstRuleErr) {
      await showWarning('Invalid Rule Configuration', firstRuleErr);
      return;
    }
    loadTeamsFromDb();
    setWizardStep(3);
  };

  // Live inline cricket-logic validation for Step 2 (Schedule & Playing Rules)
  const step2RuleErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    const minT = parseInt(formMinTeams, 10);
    const maxT = parseInt(formMaxTeams, 10);
    const oversNum = parseInt(formOvers, 10);
    const xiNum = parseInt(formPlayingXI, 10);
    const maxFielders = !isNaN(xiNum) && xiNum >= 2 ? Math.max(0, xiNum - 2) : 9;

    if (isNaN(minT) || minT < 2) errs.minTeams = 'Min Teams must be at least 2.';
    if (isNaN(maxT) || (!isNaN(minT) && maxT < minT)) errs.maxTeams = `Max Teams cannot be less than Min Teams (${isNaN(minT) ? 2 : minT}).`;
    if (isNaN(oversNum) || oversNum < 1) errs.overs = 'Overs / Match must be at least 1.';
    if (isNaN(xiNum) || xiNum < 2 || xiNum > 11) errs.playingXI = 'Playing XI must be between 2 and 11.';

    const pp = parseInt(formPowerplayOvers, 10);
    if (!isNaN(pp) && !isNaN(oversNum) && oversNum >= 1 && pp > oversNum) {
      errs.powerplayOvers = `Powerplay (${pp}) cannot exceed Overs / Match (${oversNum}).`;
    }

    const outPP = parseInt(formMaxOutsidePP, 10);
    if (!isNaN(outPP) && outPP > maxFielders) {
      errs.maxOutsidePP = `Cannot exceed ${maxFielders} fielders (excl. Bowler & WK).`;
    }

    const outPost = parseInt(formMaxOutsidePostPP, 10);
    if (!isNaN(outPost) && outPost > maxFielders) {
      errs.maxOutsidePostPP = `Cannot exceed ${maxFielders} fielders (excl. Bowler & WK).`;
    }

    const onSide = parseInt(formMaxOnSide, 10);
    if (!isNaN(onSide) && onSide > maxFielders) {
      errs.maxOnSide = `Cannot exceed ${maxFielders} fielders (excl. Bowler & WK).`;
    }

    const behind = parseInt(formMaxBehindCrease, 10);
    if (!isNaN(behind) && !isNaN(onSide) && behind > onSide) {
      errs.maxBehindCrease = `Behind crease (${behind}) cannot exceed Max Leg-Side (${onSide}).`;
    } else if (!isNaN(behind) && behind > maxFielders) {
      errs.maxBehindCrease = `Cannot exceed ${maxFielders} fielders.`;
    }

    const maxBowlerOv = parseInt(formMaxOversPerBowler, 10);
    if (isNaN(maxBowlerOv) || maxBowlerOv < 1) {
      errs.maxOversPerBowler = 'Must be at least 1 over.';
    } else if (!isNaN(oversNum) && oversNum >= 1 && maxBowlerOv > oversNum) {
      errs.maxOversPerBowler = `Cannot exceed Overs / Match (${oversNum}).`;
    }

    if (formDelayPenaltyEnabled) {
      const iv = parseInt(formDelayIntervalValue, 10);
      if (isNaN(iv) || iv < 1) {
        errs.delayIntervalValue = 'Interval must be at least 1.';
      }
      const red = parseInt(formDelayOversReduced, 10);
      if (isNaN(red) || red < 1) {
        errs.delayReduceVal = 'Reduction must be at least 1.';
      } else if (!isNaN(oversNum) && oversNum >= 1) {
        if (formDelayReduceUnit === 'OVERS' && red >= oversNum) {
          errs.delayReduceVal = `Reduce Overs (${red}) must be less than Overs / Match (${oversNum}).`;
        } else if (formDelayReduceUnit === 'BALLS' && red >= oversNum * 6) {
          errs.delayReduceVal = `Reduce Balls (${red}) must be less than total match balls (${oversNum * 6}).`;
        }
      }
    }
    return errs;
  }, [
    formMinTeams,
    formMaxTeams,
    formOvers,
    formPlayingXI,
    formPowerplayOvers,
    formMaxOutsidePP,
    formMaxOutsidePostPP,
    formMaxOnSide,
    formMaxBehindCrease,
    formMaxOversPerBowler,
    formDelayPenaltyEnabled,
    formDelayIntervalValue,
    formDelayOversReduced,
    formDelayReduceUnit
  ]);

  const handleProceedToStep4 = async () => {
    const minT = parseInt(formMinTeams, 10) || 2;
    const maxT = parseInt(formMaxTeams, 10) || 8;
    if (selectedTeamIds.length < minT) {
      await showWarning(
        'Team Selection Notice',
        `Please select at least ${minT} participating team(s). Currently selected: ${selectedTeamIds.length}.`
      );
      return;
    }
    if (selectedTeamIds.length > maxT) {
      await showWarning(
        'Maximum Limit Exceeded',
        `A tournament can have at most ${maxT} participating teams. Currently selected: ${selectedTeamIds.length}.`
      );
      return;
    }
    setWizardStep(4);
  };

  // Check if any player (by mobile number) in candidateTeamId already belongs to another selected team in this tournament
  const findDuplicatePlayerConflict = (candidateTeamId: string, currentSelectedIds: string[]) => {
    const candidate = dbTeams.find(t => t.id === candidateTeamId);
    const candidatePlayers: Array<{ name: string; mobile: string }> = candidate?.players || [];
    if (candidatePlayers.length === 0) return null;

    for (const selId of currentSelectedIds) {
      if (selId === candidateTeamId) continue;
      const otherTeam = dbTeams.find(t => t.id === selId);
      const otherPlayers: Array<{ name: string; mobile: string }> = otherTeam?.players || [];
      for (const cp of candidatePlayers) {
        const match = otherPlayers.find(op => op.mobile && op.mobile === cp.mobile);
        if (match) {
          return {
            playerName: cp.name || match.name || 'Player',
            mobile: cp.mobile,
            conflictingTeamName: otherTeam?.name || otherTeam?.team_name || selId
          };
        }
      }
    }
    return null;
  };

  // ── Toggle Team Selection ─────────────────────────────────────────────
  const toggleTeamSelection = (teamId: string) => {
    const maxT = parseInt(formMaxTeams, 10) || 8;
    if (selectedTeamIds.includes(teamId)) {
      setSelectedTeamIds(selectedTeamIds.filter(id => id !== teamId));
    } else {
      if (selectedTeamIds.length >= maxT) {
        showWarning('Limit Reached', `Only ${maxT} teams can be selected for this tournament.`);
        return;
      }
      const conflict = findDuplicatePlayerConflict(teamId, selectedTeamIds);
      if (conflict) {
        showWarning(
          'Duplicate Player in Tournament',
          `Player "${conflict.playerName}" (Mobile: ${conflict.mobile}) is already in selected team "${conflict.conflictingTeamName}". A player cannot play for two teams in the same tournament.`
        );
        return;
      }
      setSelectedTeamIds([...selectedTeamIds, teamId]);
    }
  };

  const selectAllTeams = () => {
    const maxT = parseInt(formMaxTeams, 10) || 8;
    const accepted: string[] = [];
    const skipped: string[] = [];
    for (const t of filteredTeams) {
      if (accepted.length >= maxT) break;
      const conflict = findDuplicatePlayerConflict(t.id, accepted);
      if (conflict) {
        skipped.push(`${t.name || t.team_name} (Player: ${conflict.playerName}, ${conflict.mobile})`);
      } else {
        accepted.push(t.id);
      }
    }
    setSelectedTeamIds(accepted);
    if (skipped.length > 0) {
      showWarning(
        'Some Teams Skipped (Duplicate Players)',
        `Skipped ${skipped.length} team(s) with players already in another selected team for this tournament:\n${skipped.slice(0, 3).join('\n')}`
      );
    }
  };

  const deselectAllTeams = () => {
    setSelectedTeamIds([]);
  };

  // ── Submit Create / Update Tournament ─────────────────────────────────
  const handleSubmitTournament = async () => {
    if (!formName.trim()) {
      setWizardStep(1);
      setFormNameError('Tournament Name is required.');
      await showWarning('Validation Error', 'Tournament Name is required.');
      return;
    }
    if (!/^[a-zA-Z0-9_\s]+$/.test(formName.trim())) {
      setWizardStep(1);
      setFormNameError('Only letters, numbers, spaces, and underscores (_) are allowed. Special characters are not allowed.');
      await showWarning(
        'Invalid Tournament Name',
        'Tournament Name can only contain letters, numbers, spaces, and underscores (_). Special characters are not allowed.'
      );
      return;
    }
    if (!formShortName.trim()) {
      setWizardStep(1);
      setFormShortNameError('Short Name / Abbreviation is required.');
      await showWarning('Validation Error', 'Short Name / Abbreviation is required.');
      return;
    }
    if (!/^[a-zA-Z0-9_\s]+$/.test(formShortName.trim())) {
      setWizardStep(1);
      setFormShortNameError('Only letters, numbers, spaces, and underscores (_) are allowed. Special characters are not allowed.');
      await showWarning(
        'Invalid Short Name',
        'Short Name / Abbreviation can only contain letters, numbers, spaces, and underscores (_). Special characters are not allowed.'
      );
      return;
    }
    if (formMatchFormat === 'CUSTOM') {
      const oversNum = parseInt(formOvers, 10);
      if (!formOvers.trim() || isNaN(oversNum) || oversNum <= 0) {
        setWizardStep(1);
        await showWarning('Invalid Custom Overs', 'Please enter a valid number of overs per match (greater than 0).');
        return;
      }
    }

    setSubmitting(true);
    const payload = {
      name: formName.trim(),
      short_name: formShortName.trim(),
      logo_url: formLogoUrl.trim(),
      description: formDescription.trim(),
      tournament_type: formTournamentType,
      category: formCategory,
      gender: formGender,
      ball_type: formBallType === 'CUSTOM' ? (formCustomBallType.trim() || 'Red Leather') : formBallType,
      match_format: formMatchFormat,
      overs_per_match: parseInt(formOvers, 10) || 20,
      season: formSeason,
      venue: formVenue,
      start_date: formStartDate,
      end_date: formEndDate,
      registration_start_date: formRegStartDate || null,
      registration_end_date: formRegEndDate || null,
      max_teams: parseInt(formMaxTeams, 10) || 8,
      min_teams: parseInt(formMinTeams, 10) || 2,
      points_win: Number(formPointsWin) || 4,
      points_loss: Number(formPointsLoss) || 0,
      points_tie: Number(formPointsTie) || 2,
      points_no_result: Number(formPointsNR) || 2,
      points_bonus_win: Number(formPointsBonusWin) || 1,
      points_bonus_loss: Number(formPointsBonusLoss) ?? -1,
      points_walkover_win: Number(formPointsWalkoverWin) || 4,
      points_walkover_loss: Number(formPointsWalkoverLoss) ?? -1,
      playing_xi_size: parseInt(formPlayingXI, 10) || 11,
      substitute_count: parseInt(formSubstitutes, 10) || 4,
      allow_super_over: formAllowSuperOver,
      allow_dls: formAllowDLS,
      rules: formRulesText,
      playing_rules: {
        powerplay_overs: Math.max(0, parseInt(formPowerplayOvers, 10) || 5),
        max_outside_powerplay: Math.max(0, parseInt(formMaxOutsidePP, 10) || 2),
        max_outside_post_powerplay: Math.max(0, parseInt(formMaxOutsidePostPP, 10) || 5),
        max_on_side_fielders: Math.max(0, parseInt(formMaxOnSide, 10) || 5),
        max_on_side_behind_crease: Math.max(0, parseInt(formMaxBehindCrease, 10) || 2),
        free_hit_on_all_noballs: formFreeHitAllNoBalls,
        allow_chain_over: formAllowChainOver,
        max_overs_per_bowler: Math.max(1, parseInt(formMaxOversPerBowler, 10) || 4),
        delay_penalty_enabled: formDelayPenaltyEnabled,
        delay_interval_value: Math.max(1, parseInt(formDelayIntervalValue, 10) || 4),
        delay_interval_unit: formDelayIntervalUnit,
        delay_reduce_unit: formDelayReduceUnit,
        delay_overs_reduced_per_interval: Math.max(1, parseInt(formDelayOversReduced, 10) || 1),
        tie_handling: formTieHandling
      },
      format_config: {
        round_robin_type: formTournamentType === 'DOUBLE_ROUND_ROBIN' ? 'DOUBLE' : (formTournamentType === 'SINGLE_ROUND_ROBIN' ? 'SINGLE' : formRoundRobinType),
        knockout_stages: (formTournamentType === 'SINGLE_ELIMINATION' || formTournamentType === 'DOUBLE_ELIMINATION')
          ? ['Semi Final', 'Final']
          : [
            ...(formIncludeSemis ? ['Semi Final'] : []),
            ...(formIncludeFinal ? ['Final'] : [])
          ],
        qualifying_teams_count: parseInt(formQualifyingTeamsCount, 10) || 4,
        qualification_rules: formQualificationRules,
        group_count: Math.max(1, parseInt(formGroupCount, 10) || 5),
        allow_extra_group: formAllowExtraGroup,
        teams_per_group: Math.max(2, parseInt(formTeamsPerGroup, 10) || 8),
        qualifiers_per_group: Math.max(1, parseInt(formQualifiersPerGroup, 10) || 2),
        super_league_enabled: formSuperLeagueEnabled,
        super_league_groups: Math.max(1, parseInt(formSuperLeagueGroups, 10) || 4),
        super_league_qualifiers_per_group: Math.max(1, parseInt(formSuperLeagueQualifiers, 10) || 1),
        include_semifinals: formIncludeSemis,
        include_final: formIncludeFinal,
        group_distribution: formGroupDistribution,
        manual_groups: formGroupDistribution === 'MANUAL' ? formManualGroups : null,
        best_runners_up_count: Math.max(0, parseInt(formBestRunnersUp, 10) || 0),
        tie_breaker_order: formTieBreakerOrder.split(',').map(s => s.trim()).filter(Boolean)
      },
      teams: selectedTeamIds,
      winner_team_name: formWinnerTeamName.trim(),
      runner_up_team_name: formRunnerUpTeamName.trim(),
      awards_config: {
        winner_trophy_title: formWinnerTrophyTitle.trim() || 'Championship Winner Trophy',
        runner_up_trophy_title: formRunnerUpTrophyTitle.trim() || 'Runner-Up Trophy',
        potm_every_match: formPotmEveryMatch
      }
    };

    try {
      if (isEditMode && editingTournamentId) {
        try {
          await ScorerApi.updateTournament(editingTournamentId, payload);
        } catch (_uErr) {
          await adminApi.updateTournament(editingTournamentId, payload);
        }
        await showSuccess('Tournament Updated', `Championship '${payload.name}' has been updated successfully.`);
      } else {
        try {
          await ScorerApi.createTournament(payload);
        } catch (_cErr) {
          await adminApi.createTournament(payload);
        }
        await showSuccess('Tournament Created', `Official Tournament '${payload.name}' has been created with ${selectedTeamIds.length} team(s).`);
      }
      setWizardOpen(false);
      await loadTournaments();
    } catch (err: any) {
      await showError('Operation Failed', err.message || 'Unable to save tournament to database.');
    } finally {
      setSubmitting(false);
    }
  };

  const loadGroupPointsForTournament = async (tId: string, tType?: string) => {
    const norm = normalizeTournamentType(tType);
    if (norm !== 'GROUP_KNOCKOUT') {
      setGroupPointsData(null);
      setGroupPointsError(null);
      return;
    }
    setGroupPointsLoading(true);
    setGroupPointsError(null);
    try {
      const gpRes = await ScorerApi.getGroupPointsTable(tId);
      if (gpRes && gpRes.success) {
        setGroupPointsData(gpRes);
      } else {
        setGroupPointsData(null);
      }
    } catch (e: any) {
      setGroupPointsError(e?.message || 'Unable to load group standings.');
    } finally {
      setGroupPointsLoading(false);
    }
  };

  // ── Open Tournament Details Dashboard ──────────────────────────────────
  const handleOpenDetails = async (tournamentId: string) => {
    setDetailsModalOpen(true);
    setDetailsLoading(true);
    setDetailsTab('overview');
    setMatchGroupFilter('ALL');
    setGroupPointsData(null);
    setGroupPointsError(null);
    setBackendPreviewData(null);
    try {
      const res = await ScorerApi.getTournamentById(tournamentId);
      const data = res.tournament || res.data;
      setSelectedTournament(data);
      loadGroupPointsForTournament(tournamentId, data?.tournament_type);
    } catch (err: any) {
      await showError('Error', `Failed to load tournament details: ${err.message}`);
      setDetailsModalOpen(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  const refreshTournamentDetails = async () => {
    if (!selectedTournament) return;
    setDetailsLoading(true);
    try {
      const res = await ScorerApi.getTournamentById(selectedTournament.id);
      const data = res.tournament || res.data;
      setSelectedTournament(data);
      await loadGroupPointsForTournament(selectedTournament.id, data?.tournament_type);
    } catch (err) {
      console.warn('Failed to refresh details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  // ── Preview Championship Fixtures (Backend) ───────────────────────────
  const handlePreviewMatches = async () => {
    if (!selectedTournament) return;
    setBackendPreviewLoading(true);
    const payload = {
      tournament_type: selectedTournament.tournament_type,
      round_robin_type: selectedTournament.format_config?.round_robin_type || 'SINGLE',
      format_config: selectedTournament.format_config || {}
    };
    try {
      let res: any = null;
      try {
        res = await adminApi.previewTournamentMatches(selectedTournament.id, payload);
      } catch (primaryErr: any) {
        if (String(primaryErr?.message || '').includes('404')) {
          res = await adminApi.previewTournamentSchedule(selectedTournament.id, payload);
        } else {
          throw primaryErr;
        }
      }
      setBackendPreviewData(res);
    } catch (err: any) {
      await showError('Preview Failed', err?.message || 'Unable to preview fixtures.');
    } finally {
      setBackendPreviewLoading(false);
    }
  };

  // ── Generate Tournament Matches ───────────────────────────────────────
  const handleGenerateMatches = async () => {
    if (!selectedTournament) return;
    const teamCount = (selectedTournament.participating_teams || selectedTournament.teams || []).length;
    if (teamCount < 2) {
      await showWarning('Insufficient Teams', 'At least 2 participating teams are required to generate matches.');
      return;
    }

    const defaultStart = selectedTournament.start_date || new Date().toISOString().split('T')[0];
    const defaultPerDay = Number(selectedTournament.format_config?.matches_per_day || 2);
    setGenStartDate(defaultStart);
    setGenMatchesPerDay(String(defaultPerDay));
    setGenTimeSlots(
      defaultPerDay > 2
        ? '07:00 AM, 10:30 AM, 02:00 PM, 05:30 PM'
        : '09:30 AM, 02:30 PM'
    );
    const primaryVenue = selectedTournament.venue || (dbVenues[0]?.name || 'Kamarajar District Stadium');
    setGenSelectedVenues([primaryVenue]);
    setGenIgnoreConflicts(false);
    setGenModalOpen(true);
  };

  const handleConfirmGenerateMatches = async () => {
    if (!selectedTournament) return;
    const perDayNum = Math.max(1, parseInt(genMatchesPerDay, 10) || 1);
    const parsedSlots = genTimeSlots
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const venuesToUse = genSelectedVenues.length > 0
      ? genSelectedVenues
      : [selectedTournament.venue || 'Kamarajar District Stadium'];

    setGeneratingMatches(true);
    try {
      const res = await ScorerApi.generateTournamentMatches(selectedTournament.id, {
        tournament_type: selectedTournament.tournament_type,
        round_robin_type: selectedTournament.format_config?.round_robin_type || 'SINGLE',
        venue: venuesToUse[0],
        venues: venuesToUse,
        start_date: genStartDate || undefined,
        matches_per_day: perDayNum,
        time_slots: parsedSlots.length > 0 ? parsedSlots : undefined,
        ignoreConflicts: genIgnoreConflicts,
        match_format: selectedTournament.match_format,
        overs_per_match: selectedTournament.overs_per_match
      });

      setGenModalOpen(false);
      await showSuccess(
        'Fixtures Generated!',
        `Successfully generated ${res.total_matches_generated || 'championship'} matches (${perDayNum} match(es)/day starting ${genStartDate || 'tournament start'}).`
      );
      await refreshTournamentDetails();
      await loadTournaments();
      setDetailsTab('schedule');
    } catch (err: any) {
      await showError('Generation Failed', err.message || 'Unable to generate matches.');
    } finally {
      setGeneratingMatches(false);
    }
  };

  // ── Delete / Deactivate Tournament ─────────────────────────────────────
  const handleDeleteTournament = async (tour: any) => {
    const confirmed = await showConfirm(
      `Delete Tournament '${tour.name}'?`,
      'Are you sure you want to delete or deactivate this tournament? If it contains completed match scorecards, it will be safely deactivated to preserve historical statistics.',
      'Delete Tournament',
      'Keep Active',
      'warning'
    );
    if (!confirmed) return;

    try {
      const res = await ScorerApi.deleteTournament(tour.id);
      await showSuccess('Championship Updated', res.message || 'Tournament deleted.');
      if (detailsModalOpen && selectedTournament?.id === tour.id) {
        setDetailsModalOpen(false);
      }
      await loadTournaments();
    } catch (err: any) {
      await showError('Delete Failed', err.message || 'Unable to delete tournament.');
    }
  };

  // Unique tournaments deduplicated by normalized name
  const uniqueTournaments = useMemo(() => {
    const seen = new Set<string>();
    return tournaments.filter(t => {
      const key = (t.name || '').trim().toLowerCase();
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [tournaments]);

  // ── Filtered Tournaments List (strictly one tournament per name) ──────────
  const filteredTournaments = useMemo(() => {
    const seenNames = new Set<string>();
    return tournaments.filter(t => {
      const nameKey = (t.name || '').trim().toLowerCase();
      if (nameKey) {
        if (seenNames.has(nameKey)) return false;
        seenNames.add(nameKey);
      }
      // Status filter
      if (statusFilter !== 'ALL') {
        const s = (t.status || 'UPCOMING').toUpperCase();
        if (statusFilter === 'ONGOING' && s !== 'ONGOING' && s !== 'ACTIVE') return false;
        if (statusFilter !== 'ONGOING' && s !== statusFilter) return false;
      }
      // Search filter
      if (debouncedSearchQuery.trim()) {
        const term = debouncedSearchQuery.toLowerCase();
        const n = (t.name || '').toLowerCase();
        const sn = (t.short_name || '').toLowerCase();
        const c = (t.category || '').toLowerCase();
        const v = (t.venue || '').toLowerCase();
        const sea = (t.season || '').toLowerCase();
        if (!n.includes(term) && !sn.includes(term) && !c.includes(term) && !v.includes(term) && !sea.includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [tournaments, statusFilter, debouncedSearchQuery]);

  // Statistics Summary
  const summaryCounts = useMemo(() => {
    let ongoing = 0;
    let upcoming = 0;
    let completed = 0;
    tournaments.forEach(t => {
      const s = (t.status || 'UPCOMING').toUpperCase();
      if (s === 'ONGOING' || s === 'ACTIVE') ongoing++;
      else if (s === 'UPCOMING') upcoming++;
      else if (s === 'COMPLETED') completed++;
    });
    return { total: tournaments.length, ongoing, upcoming, completed };
  }, [tournaments]);

  // Filtered Teams in Wizard
  const filteredTeams = useMemo(() => {
    if (!teamSearchQuery.trim()) return dbTeams;
    const q = teamSearchQuery.toLowerCase();
    return dbTeams.filter(t =>
      (t.name || t.team_name || '').toLowerCase().includes(q) ||
      (t.coach_name || '').toLowerCase().includes(q) ||
      (t.taluk || '').toLowerCase().includes(q)
    );
  }, [dbTeams, teamSearchQuery]);

  // Dynamic calculated match count preview for Wizard Step 4
  const estimatedMatchesCount = useMemo(() => {
    const count = selectedTeamIds.length;
    if (count < 2) return 0;
    if (formTournamentType === 'SINGLE_ROUND_ROBIN') {
      return (count * (count - 1)) / 2;
    } else if (formTournamentType === 'DOUBLE_ROUND_ROBIN') {
      return count * (count - 1);
    } else if (formTournamentType === 'SINGLE_ELIMINATION') {
      return count - 1;
    } else if (formTournamentType === 'DOUBLE_ELIMINATION') {
      return 2 * (count - 1);
    } else if (formTournamentType === 'GROUP_KNOCKOUT') {
      const grpCount = Math.max(2, parseInt(formGroupCount, 10) || 2);
      const perGrp = Math.floor(count / grpCount);
      const rem = count % grpCount;
      let grpMatches = 0;
      for (let g = 0; g < grpCount; g++) {
        const size = perGrp + (g < rem ? 1 : 0);
        if (size >= 2) grpMatches += (size * (size - 1)) / 2;
      }
      const koMatches = (formIncludeSemis ? 2 : 0) + (formIncludeFinal ? 1 : 0);
      return grpMatches + koMatches;
    } else {
      // LEAGUE_PLAYOFFS: Round Robin + Playoffs (Q1, Eliminator, Q2, Final = 4)
      const leagueMatches = formRoundRobinType === 'DOUBLE' ? count * (count - 1) : (count * (count - 1)) / 2;
      return leagueMatches + 4;
    }
  }, [selectedTeamIds.length, formTournamentType, formRoundRobinType, formGroupCount, formIncludeSemis, formIncludeFinal]);

  // Filtered Registrations List
  const filteredRegistrations = useMemo(() => {
    return registrations.filter(r => {
      // Tournament filter
      if (regTournamentFilter !== 'ALL' && (r.tournament_id || r.tournamentId) !== regTournamentFilter) {
        return false;
      }
      // Status filter
      if (regStatusFilter !== 'ALL' && (r.status || 'PENDING').toUpperCase() !== regStatusFilter) {
        return false;
      }
      // Search filter
      if (debouncedRegSearchQuery.trim()) {
        const q = debouncedRegSearchQuery.toLowerCase();
        const tn = (r.team_name || r.teamName || '').toLowerCase();
        const tourName = (r.tournament_name || r.tournamentName || '').toLowerCase();
        const cn = (r.coach_name || r.coachName || '').toLowerCase();
        const ce = (r.coach_email || r.coachEmail || '').toLowerCase();
        const taluk = (r.team_taluk || r.team_city || '').toLowerCase();
        if (!tn.includes(q) && !tourName.includes(q) && !cn.includes(q) && !ce.includes(q) && !taluk.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [registrations, regTournamentFilter, regStatusFilter, debouncedRegSearchQuery]);

  const pendingRegistrationsCount = useMemo(() => {
    return registrations.filter(r => (r.status || 'PENDING').toUpperCase() === 'PENDING').length;
  }, [registrations]);

  // Selected tournament for Approved Teams view
  const activeApprovedTournament = useMemo(() => {
    return tournaments.find(t => (t.id || t._id) === approvedTabTournamentId) || tournaments[0] || null;
  }, [tournaments, approvedTabTournamentId]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Main Tournament Management Screen
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* ── TOP FEDERATION SUB-NAV TABS BAR ─────────────────────────────────── */}
      <View style={styles.adminSectionTabsBar}>
        <TouchableOpacity
          style={[styles.adminSectionTabBtn, adminSection === 'directory' && styles.adminSectionTabBtnActive]}
          onPress={() => setAdminSection('directory')}
          activeOpacity={0.8}
        >
          <Text style={[styles.adminSectionTabText, adminSection === 'directory' && styles.adminSectionTabTextActive]}>
            🏆 Tournament Directory ({uniqueTournaments.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.adminSectionTabBtn, adminSection === 'registrations' && styles.adminSectionTabBtnActive]}
          onPress={() => {
            setAdminSection('registrations');
            loadRegistrations();
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.adminSectionTabText, adminSection === 'registrations' && styles.adminSectionTabTextActive]}>
            📝 Registrations & Approvals
          </Text>
          {pendingRegistrationsCount > 0 && (
            <View style={styles.sectionBadgePending}>
              <Text style={styles.sectionBadgePendingText}>{pendingRegistrationsCount} Pending</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.adminSectionTabBtn, adminSection === 'approved' && styles.adminSectionTabBtnActive]}
          onPress={() => {
            setAdminSection('approved');
            const targetId = approvedTabTournamentId || tournaments[0]?.id || '';
            if (targetId) {
              setApprovedTabTournamentId(targetId);
              loadApprovedTeams(targetId);
            }
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.adminSectionTabText, adminSection === 'approved' && styles.adminSectionTabTextActive]}>
            🛡️ Approved Teams List
          </Text>
        </TouchableOpacity>
      </View>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 1: TOURNAMENTS DIRECTORY                                   */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {adminSection === 'directory' && (
        <View style={{ flex: 1 }}>
          {/* ── TOP HIGHLIGHT ROW: STAT CARDS ─────────────────────────────────── */}
          <View style={[styles.kpiCardsRow, isMobile && { flexDirection: 'column', gap: 10 }]}>
            <View style={[styles.kpiCard, styles.kpiCardTotal, isMobile && { width: '100%', minWidth: 0 }]}>
              <View style={styles.kpiIconWrapTotal}>
                <Text style={{ fontSize: 20 }}>🏆</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.kpiVal}>{summaryCounts.total}</Text>
                <Text style={styles.kpiLabel}>Total Championships</Text>
              </View>
            </View>

            <View style={[styles.kpiCard, styles.kpiCardOngoing, isMobile && { width: '100%', minWidth: 0 }]}>
              <View style={styles.kpiIconWrapOngoing}>
                <Text style={{ fontSize: 20 }}>⚡</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.kpiVal, { color: '#16a34a' }]}>{summaryCounts.ongoing}</Text>
                <Text style={styles.kpiLabel}>Ongoing Tournaments</Text>
              </View>
            </View>

            <View style={[styles.kpiCard, styles.kpiCardUpcoming, isMobile && { width: '100%', minWidth: 0 }]}>
              <View style={styles.kpiIconWrapUpcoming}>
                <Text style={{ fontSize: 20 }}>📅</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.kpiVal, { color: '#0284c7' }]}>{summaryCounts.upcoming}</Text>
                <Text style={styles.kpiLabel}>Upcoming Leagues</Text>
              </View>
            </View>

            <View style={[styles.kpiCard, styles.kpiCardCompleted, isMobile && { width: '100%', minWidth: 0 }]}>
              <View style={styles.kpiIconWrapCompleted}>
                <Text style={{ fontSize: 20 }}>🎖️</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.kpiVal, { color: '#7c3aed' }]}>{summaryCounts.completed}</Text>
                <Text style={styles.kpiLabel}>Completed Seasons</Text>
              </View>
            </View>
          </View>

          {/* ── SEARCH & FILTER TOOLBAR ───────────────────────────────────────── */}
          <View style={styles.toolbarCard}>
            <View style={styles.searchBox}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search tournament by championship name, season, venue, category..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                  <Text style={{ fontSize: 13, color: '#64748b' }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Status Filter Dropdown */}
            <View style={{ minWidth: isMobile ? '100%' : 190 }}>
              <View style={styles.selectWrap}>
                <select
                  value={statusFilter}
                  onChange={(e: any) => setStatusFilter(e.target.value as TournamentFilterStatus)}
                  style={{ ...webSelectStyle, paddingRight: 28, height: 38, fontSize: 12.5, fontWeight: '700' }}
                >
                  <option value="ALL">All Competitions</option>
                  <option value="ONGOING">Ongoing</option>
                  <option value="UPCOMING">Upcoming</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
                <View style={styles.selectChevron}>
                  <Text style={styles.selectChevronText}>▾</Text>
                </View>
              </View>
            </View>

            {/* Create Tournament Action Button */}
            <TouchableOpacity
              style={styles.createBtnGradient}
              onPress={handleOpenCreateWizard}
              activeOpacity={0.85}
            >
              <Text style={styles.createBtnText}>➕ Create Tournament</Text>
            </TouchableOpacity>
          </View>

          {/* ── TOURNAMENTS CARDS GRID ────────────────────────────────────────── */}
          {loading ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color="#d4af37" />
              <Text style={styles.loadingText}>Fetching Official District Championships...</Text>
            </View>
          ) : filteredTournaments.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <Text style={{ fontSize: 44, marginBottom: 12 }}>🏏</Text>
              <Text style={styles.emptyStateTitle}>No Tournaments Found</Text>
              <Text style={styles.emptyStateSub}>
                {searchQuery
                  ? `No tournaments matching '${searchQuery}'. Try another query or clear filters.`
                  : 'No tournaments have been registered in this status. Click Create Tournament to schedule your first championship.'}
              </Text>
              <TouchableOpacity style={styles.createBtnGradient} onPress={handleOpenCreateWizard}>
                <Text style={styles.createBtnText}>➕ Create First Tournament</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
              <View style={styles.tournamentsGrid}>
                {filteredTournaments.map(t => {
                  const statusUpper = (t.status || 'UPCOMING').toUpperCase();
                  const isOngoing = statusUpper === 'ONGOING' || statusUpper === 'ACTIVE' || statusUpper === 'REGISTRATION_OPEN';
                  const isUpcoming = statusUpper === 'UPCOMING';
                  const isCompleted = statusUpper === 'COMPLETED';
                  const isCancelled = statusUpper === 'CANCELLED' || statusUpper === 'INACTIVE';

                  const matchStats = t.match_stats || { total: 0, scheduled: 0, completed: 0, live: 0 };
                  const teamsCount = t.teams_count || (t.teams || []).length;
                  const approvedCount = t.approved_teams_count || teamsCount;
                  const registeredCount = t.registered_teams_count || teamsCount;
                  const maxTeams = t.max_teams || 16;
                  const availableSlots = t.available_slots !== undefined ? t.available_slots : Math.max(0, maxTeams - approvedCount);

                  return (
                    <View
                      key={t.id || t._id}
                      style={[
                        styles.tourCard,
                        isMobile && { width: '100%', minWidth: 0, padding: 14 },
                        isOngoing && styles.tourCardOngoing,
                        isCompleted && styles.tourCardCompleted
                      ]}
                    >
                      {/* Top Header */}
                      <View style={styles.tourCardHeader}>
                        <View style={styles.tourLogoBox}>
                          {t.logo_url ? (
                            <Image source={{ uri: t.logo_url }} style={styles.tourLogoImg} />
                          ) : (
                            <Text style={styles.tourLogoFallback}>
                              {(t.short_name || t.name || 'TN').slice(0, 3).toUpperCase()}
                            </Text>
                          )}
                        </View>

                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                            <Text style={styles.tourSeasonTag}>Season {t.season || '2026'}</Text>
                            <View
                              style={[
                                styles.statusBadge,
                                isOngoing && styles.statusBadgeOngoing,
                                isUpcoming && styles.statusBadgeUpcoming,
                                isCompleted && styles.statusBadgeCompleted,
                                isCancelled && styles.statusBadgeCancelled
                              ]}
                            >
                              <View
                                style={[
                                  styles.statusDot,
                                  isOngoing && { backgroundColor: '#16a34a' },
                                  isUpcoming && { backgroundColor: '#0284c7' },
                                  isCompleted && { backgroundColor: '#7c3aed' },
                                  isCancelled && { backgroundColor: '#ef4444' }
                                ]}
                              />
                              <Text
                                style={[
                                  styles.statusBadgeText,
                                  isOngoing && { color: '#15803d' },
                                  isUpcoming && { color: '#0369a1' },
                                  isCompleted && { color: '#6d28d9' },
                                  isCancelled && { color: '#b91c1c' }
                                ]}
                              >
                                {statusUpper}
                              </Text>
                            </View>
                          </View>

                          <Text style={styles.tourCardTitle} numberOfLines={2}>
                            {t.name}
                          </Text>
                          {t.short_name ? <Text style={styles.tourCardShortName}>{t.short_name}</Text> : null}
                          {(t.winner_team_name || t.runner_up_team_name || t.awards_config?.potm_every_match !== false) && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                              {t.winner_team_name ? (
                                <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B' }}>
                                  <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#92400E' }}>
                                    🏆 {t.awards_config?.winner_trophy_title || 'Winner'}: {t.winner_team_name}
                                  </Text>
                                </View>
                              ) : null}
                              {t.runner_up_team_name ? (
                                <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' }}>
                                  <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#334155' }}>
                                    🥈 {t.awards_config?.runner_up_trophy_title || 'Runner-Up'}: {t.runner_up_team_name}
                                  </Text>
                                </View>
                              ) : null}
                              {!t.winner_team_name && !t.runner_up_team_name ? (
                                <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', maxWidth: '100%', flexShrink: 1 }}>
                                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#B45309', flexShrink: 1 }}>
                                    🏆 Winner &amp; Runner-Up Trophies • ⭐ POTM Every Match
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Meta Chips */}
                      <View style={styles.chipsRow}>
                        <View style={styles.metaChip}>
                          <Text style={styles.metaChipText}>Format: {t.match_format || t.format || 'T20'}</Text>
                        </View>
                        <View style={styles.metaChip}>
                          <Text style={styles.metaChipText}>Overs: {t.overs_per_match || 20}</Text>
                        </View>
                        <View style={styles.metaChip}>
                          <Text style={styles.metaChipText}>
                            {TOURNAMENT_FORMAT_META[normalizeTournamentType(t.tournament_type, t.format_config?.round_robin_type)].label}
                          </Text>
                        </View>
                        <View style={styles.metaChip}>
                          <Text style={styles.metaChipText}>{t.category || 'Senior Men'}</Text>
                        </View>
                      </View>

                      {/* Dates & Venue Info */}
                      <View style={styles.infoRowBox}>
                        <View style={styles.infoRowItem}>
                          <Text style={styles.infoRowIcon}>📅</Text>
                          <Text style={styles.infoRowVal}>
                            {t.start_date || 'TBD'} — {t.end_date || 'TBD'}
                          </Text>
                        </View>
                        <View style={styles.infoRowItem}>
                          <Text style={styles.infoRowIcon}>📍</Text>
                          <Text style={styles.infoRowVal} numberOfLines={1}>
                            {t.venue || 'Kamarajar District Stadium'}
                          </Text>
                        </View>
                        <View style={styles.infoRowItem}>
                          <Text style={styles.infoRowIcon}>🛡️</Text>
                          <Text style={styles.infoRowVal}>
                            {approvedCount} / {maxTeams} Teams Approved ({availableSlots} Slots Open)
                          </Text>
                        </View>
                        <View style={styles.infoRowItem}>
                          <Text style={styles.infoRowIcon}>⏳</Text>
                          <Text style={styles.infoRowVal}>
                            Reg Deadline: {t.registration_end_date ? t.registration_end_date.split('T')[0] : 'Open until season start'}
                          </Text>
                        </View>
                      </View>

                      {/* Match Progress Summary */}
                      <View style={styles.progressWrap}>
                        <View style={styles.progressLabelRow}>
                          <Text style={styles.progressLabel}>Championship Matches</Text>
                          <Text style={styles.progressVal}>
                            {matchStats.completed} / {matchStats.total} Completed ({matchStats.scheduled} Scheduled)
                          </Text>
                        </View>
                        <View style={styles.progressBarTrack}>
                          <View
                            style={[
                              styles.progressBarFill,
                              {
                                width:
                                  matchStats.total > 0
                                    ? `${Math.min(100, (matchStats.completed / matchStats.total) * 100)}%`
                                    : '0%'
                              }
                            ]}
                          />
                        </View>
                      </View>

                      {/* Action Buttons Row */}
                      <View style={styles.cardActionsRow}>
                        <TouchableOpacity
                          style={styles.btnCardDashboard}
                          onPress={() => handleOpenDetails(t.id)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.btnCardDashboardText}>👁️ Dashboard</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.btnCardEdit}
                          onPress={() => handleOpenEditWizard(t)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.btnCardEditText}>✏️ Edit</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.btnCardToggleStatus,
                            isCancelled ? styles.btnCardActivate : styles.btnCardDeactivate
                          ]}
                          onPress={() => handleToggleTournamentStatus(t)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.btnCardToggleStatusText}>
                            {isCancelled ? '▶️ Activate' : '⏸️ Deactivate'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.btnCardRegistrations}
                          onPress={() => {
                            setRegTournamentFilter(t.id);
                            setAdminSection('registrations');
                            loadRegistrations();
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.btnCardRegistrationsText}>
                            📝 Regs ({registeredCount})
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.btnCardApprovedTeams}
                          onPress={() => {
                            setApprovedTabTournamentId(t.id);
                            setAdminSection('approved');
                            loadApprovedTeams(t.id);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.btnCardApprovedTeamsText}>
                            🛡️ Approved ({approvedCount})
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.btnCardDelete}
                          onPress={() => handleDeleteTournament(t)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.btnCardDeleteText}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 2: TOURNAMENT REGISTRATIONS & ADMIN APPROVALS               */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {adminSection === 'registrations' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Header & Controls Toolbar */}
          <View style={[styles.toolbarCard, { zIndex: 50, position: 'relative' }]}>
            <View style={styles.searchBox}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search registrations by team name, coach, taluk or championship..."
                placeholderTextColor="#94a3b8"
                value={regSearchQuery}
                onChangeText={setRegSearchQuery}
              />
              {regSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setRegSearchQuery('')} style={styles.clearSearchBtn}>
                  <Text style={{ fontSize: 13, color: '#64748b' }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Championship & Approval Status Dropdowns Row */}
            <View style={[{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 10, zIndex: 100 }, isMobile && { flexDirection: 'column', alignItems: 'stretch' }]}>
              {/* Championship Dropdown */}
              <View style={[{ flex: 1, minWidth: 210, flexDirection: 'row', alignItems: 'center', gap: 8, position: 'relative' }, isMobile && { flex: 0, width: '100%', minWidth: 0, flexDirection: 'column', alignItems: 'stretch', gap: 4 }, regTourDropdownOpen && { zIndex: 200 }]}>
                <Text style={styles.filterSectionLabel}>Championship:</Text>
                <View style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#f8fafc',
                      borderWidth: 1.5,
                      borderColor: regTourDropdownOpen ? '#0f172a' : '#cbd5e1',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      gap: 8
                    }}
                    onPress={() => {
                      setRegTourDropdownOpen(prev => !prev);
                      setRegStatusDropdownOpen(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#0f172a', flex: 1 }} numberOfLines={1}>
                      {regTournamentFilter === 'ALL'
                        ? 'All Tournaments'
                        : (uniqueTournaments.find(t => t.id === regTournamentFilter)?.name || 'Selected Championship')}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#64748b', fontWeight: '800' }}>{regTourDropdownOpen ? '▲' : '▼'}</Text>
                  </TouchableOpacity>

                  {regTourDropdownOpen && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 42,
                        left: 0,
                        right: 0,
                        maxHeight: 240,
                        backgroundColor: '#ffffff',
                        borderWidth: 1,
                        borderColor: '#cbd5e1',
                        borderRadius: 8,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.14,
                        shadowRadius: 12,
                        elevation: 14,
                        zIndex: 9999,
                        overflow: 'hidden'
                      }}
                    >
                      <ScrollView nestedScrollEnabled style={{ maxHeight: 240 }}>
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            backgroundColor: regTournamentFilter === 'ALL' ? '#eff6ff' : '#ffffff',
                            borderBottomWidth: 1,
                            borderBottomColor: '#f1f5f9'
                          }}
                          onPress={() => {
                            setRegTournamentFilter('ALL');
                            setRegTourDropdownOpen(false);
                          }}
                        >
                          <Text style={{ fontSize: 12.5, fontWeight: regTournamentFilter === 'ALL' ? '800' : '600', color: '#0f172a' }}>
                            All Tournaments
                          </Text>
                          {regTournamentFilter === 'ALL' && <Text style={{ fontSize: 12, fontWeight: '800', color: '#1d4ed8' }}>✓</Text>}
                        </TouchableOpacity>
                        {uniqueTournaments.map(t => {
                          const isSelected = regTournamentFilter === t.id;
                          return (
                            <TouchableOpacity
                              key={t.id}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                                borderBottomWidth: 1,
                                borderBottomColor: '#f1f5f9'
                              }}
                              onPress={() => {
                                setRegTournamentFilter(t.id);
                                setRegTourDropdownOpen(false);
                              }}
                            >
                              <Text style={{ fontSize: 12.5, fontWeight: isSelected ? '800' : '600', color: isSelected ? '#1d4ed8' : '#334155', flex: 1 }} numberOfLines={1}>
                                🏆 {t.name || t.short_name}
                              </Text>
                              {isSelected && <Text style={{ fontSize: 12, fontWeight: '800', color: '#1d4ed8', marginLeft: 6 }}>✓</Text>}
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>

              {/* Approval Status Dropdown */}
              <View style={[{ flex: 1, minWidth: 190, flexDirection: 'row', alignItems: 'center', gap: 8, position: 'relative' }, isMobile && { flex: 0, width: '100%', minWidth: 0, flexDirection: 'column', alignItems: 'stretch', gap: 4 }, regStatusDropdownOpen && { zIndex: 200 }]}>
                <Text style={styles.filterSectionLabel}>Approval Status:</Text>
                <View style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#f8fafc',
                      borderWidth: 1.5,
                      borderColor: regStatusDropdownOpen ? '#0f172a' : '#cbd5e1',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      gap: 8
                    }}
                    onPress={() => {
                      setRegStatusDropdownOpen(prev => !prev);
                      setRegTourDropdownOpen(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#0f172a' }} numberOfLines={1}>
                      {regStatusFilter === 'ALL' ? 'All Status' : regStatusFilter}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#64748b', fontWeight: '800' }}>{regStatusDropdownOpen ? '▲' : '▼'}</Text>
                  </TouchableOpacity>

                  {regStatusDropdownOpen && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 42,
                        left: 0,
                        right: 0,
                        backgroundColor: '#ffffff',
                        borderWidth: 1,
                        borderColor: '#cbd5e1',
                        borderRadius: 8,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.14,
                        shadowRadius: 12,
                        elevation: 14,
                        zIndex: 9999,
                        overflow: 'hidden'
                      }}
                    >
                      {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(st => {
                        const isSelected = regStatusFilter === st;
                        return (
                          <TouchableOpacity
                            key={st}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                              borderBottomWidth: 1,
                              borderBottomColor: '#f1f5f9'
                            }}
                            onPress={() => {
                              setRegStatusFilter(st);
                              setRegStatusDropdownOpen(false);
                            }}
                          >
                            <Text style={{ fontSize: 12.5, fontWeight: isSelected ? '800' : '600', color: isSelected ? '#1d4ed8' : '#334155' }}>
                              {st === 'ALL' ? 'All Status' : st}
                            </Text>
                            {isSelected && <Text style={{ fontSize: 12, fontWeight: '800', color: '#1d4ed8' }}>✓</Text>}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.filterPill, { backgroundColor: '#f1f5f9' }]}
                onPress={loadRegistrations}
              >
                <Text style={{ fontSize: 12, color: '#0f172a', fontWeight: '700' }}>🔄 Refresh</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Registrations List Cards */}
          {regLoading ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color="#d4af37" />
              <Text style={styles.loadingText}>Fetching Registered Team Applications...</Text>
            </View>
          ) : filteredRegistrations.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>📋</Text>
              <Text style={styles.emptyStateTitle}>No Tournament Registrations Found</Text>
              <Text style={styles.emptyStateSub}>
                {regSearchQuery || regTournamentFilter !== 'ALL' || regStatusFilter !== 'ALL'
                  ? 'No applications match your selected filters. Try adjusting query or status.'
                  : 'No teams have applied for tournaments yet. Applications will appear here for apex council review.'}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              {filteredRegistrations.map(r => {
                const status = (r.status || 'PENDING').toUpperCase();
                const isPending = status === 'PENDING';
                const isApproved = status === 'APPROVED';
                const isRejected = status === 'REJECTED';

                const initials = (r.team_name || 'TM')
                  .split(' ')
                  .map((w: string) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();

                const crestBg = isApproved ? '#059669' : isPending ? '#d97706' : '#dc2626';

                return (
                  <View
                    key={r.id || r._id}
                    style={[
                      styles.regCard,
                      isApproved && styles.regCardApproved,
                      isPending && styles.regCardPending,
                      isRejected && styles.regCardRejected
                    ]}
                  >
                    {/* Header Row */}
                    <View style={styles.regCardHeaderRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                        {resolveImageUrl(r.team_logo || r.photo || r.logo || r.image_path) ? (
                          <Image
                            source={{ uri: resolveImageUrl(r.team_logo || r.photo || r.logo || r.image_path)! }}
                            style={[styles.teamCrestAvatar, { resizeMode: 'cover', overflow: 'hidden' }]}
                          />
                        ) : (
                          <View style={[styles.teamCrestAvatar, { backgroundColor: crestBg }]}>
                            <Text style={styles.teamCrestText}>{initials}</Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <Text style={styles.regTeamTitle}>{r.team_name}</Text>
                            <View style={styles.regTournamentTag}>
                              <Text style={styles.regTournamentTagText}>🏆 {r.tournament_name || 'Championship'}</Text>
                            </View>
                          </View>
                          <Text style={styles.regMetaSub}>
                            📍 {r.team_taluk || r.team_city || 'Virudhunagar District'} • Registered on {r.registration_date ? r.registration_date.split('T')[0] : 'Recent'}
                          </Text>
                        </View>
                      </View>

                      {/* Status Badge */}
                      <View
                        style={[
                          styles.statusBadge,
                          isApproved && styles.statusBadgeOngoing,
                          isPending && styles.statusBadgeUpcoming,
                          isRejected && styles.statusBadgeCancelled
                        ]}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            isApproved && { backgroundColor: '#16a34a' },
                            isPending && { backgroundColor: '#f59e0b' },
                            isRejected && { backgroundColor: '#ef4444' }
                          ]}
                        />
                        <Text
                          style={[
                            styles.statusBadgeText,
                            isApproved && { color: '#15803d' },
                            isPending && { color: '#b45309' },
                            isRejected && { color: '#b91c1c' }
                          ]}
                        >
                          {status === 'APPROVED' ? 'APPROVED' : status === 'PENDING' ? 'PENDING APPROVAL' : 'REJECTED'}
                        </Text>
                      </View>
                    </View>

                    {/* Team & Coach Details Grid */}
                    <View style={styles.regInfoGrid}>
                      <View style={styles.regInfoItem}>
                        <Text style={styles.regInfoLabel}>HEAD COACH</Text>
                        <Text style={styles.regInfoVal}>{r.coach_name || 'Coach'}</Text>
                      </View>
                      <View style={styles.regInfoItem}>
                        <Text style={styles.regInfoLabel}>CONTACT EMAIL</Text>
                        <Text style={styles.regInfoVal}>{r.coach_email || 'N/A'}</Text>
                      </View>
                      <View style={styles.regInfoItem}>
                        <Text style={styles.regInfoLabel}>PHONE / MOBILE</Text>
                        <Text style={styles.regInfoVal}>{r.coach_phone || 'N/A'}</Text>
                      </View>
                      <View style={styles.regInfoItem}>
                        <Text style={styles.regInfoLabel}>ROSTER SQUAD</Text>
                        <Text style={styles.regInfoVal}>{r.squad_count ?? (r.players ? r.players.length : 0)} Players Registered</Text>
                      </View>
                      <View style={styles.regInfoItem}>
                        <Text style={styles.regInfoLabel}>TEAM CAPTAIN</Text>
                        <Text style={styles.regInfoVal}>👑 {r.captain || '—'}</Text>
                      </View>
                    </View>

                    {r.notes ? (
                      <View style={styles.regNotesBox}>
                        <Text style={styles.regNotesLabel}>📝 Coach Notes:</Text>
                        <Text style={styles.regNotesText}>{r.notes}</Text>
                      </View>
                    ) : null}

                    {/* Approved / Rejected Meta Notification */}
                    {isApproved && (
                      <View style={styles.approvalMetaBox}>
                        <Text style={styles.approvalMetaText}>
                          ✅ Approved by {r.approved_by || 'Apex Council'} • Officially added to tournament participants.
                        </Text>
                      </View>
                    )}

                    {isRejected && (
                      <View style={styles.rejectionMetaBox}>
                        <Text style={styles.rejectionMetaTitle}>❌ Registration Rejected by {r.rejected_by || 'Apex Council'}:</Text>
                        <Text style={styles.rejectionMetaReason}>"{r.rejection_reason || 'Criteria not fulfilled'}"</Text>
                      </View>
                    )}

                    {/* Action Buttons (View Team always available, plus Approve/Reject for Pending) */}
                    <View style={styles.regActionsRow}>
                      <TouchableOpacity
                        style={{
                          backgroundColor: '#eff6ff',
                          borderWidth: 1,
                          borderColor: '#bfdbfe',
                          borderRadius: 8,
                          paddingHorizontal: 14,
                          paddingVertical: 9,
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onPress={() => setViewTeamModal({
                          teamName: r.team_name,
                          teamId: r.team_id,
                          coachName: r.coach_name,
                          coachEmail: r.coach_email,
                          coachPhone: r.coach_phone,
                          captain: r.captain,
                          city: r.team_taluk || r.team_city || 'Virudhunagar',
                          status: status,
                          squadCount: r.squad_count ?? (r.players ? r.players.length : 0),
                          players: r.players || []
                        })}
                        activeOpacity={0.8}
                      >
                        <Text style={{ color: '#1d4ed8', fontSize: 12.5, fontWeight: '700' }}>
                          👁 View Team ({r.squad_count ?? (r.players ? r.players.length : 0)})
                        </Text>
                      </TouchableOpacity>

                      {isPending && (
                        <>
                          <TouchableOpacity
                            style={styles.btnApproveReg}
                            onPress={() => handleApproveRegistration(r)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.btnApproveRegText}>✅ Approve Registration</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.btnRejectReg}
                            onPress={() => handleOpenRejectModal(r)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.btnRejectRegText}>❌ Reject Registration</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 3: APPROVED TEAMS DIRECTORY PER TOURNAMENT                  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {adminSection === 'approved' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Tournament Selection Bar */}
          <View style={[styles.toolbarCard, { zIndex: 50, position: 'relative' }]}>
            <View style={[{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, zIndex: 100 }, isMobile && { flexDirection: 'column', alignItems: 'stretch', gap: 6 }]}>
              <Text style={styles.filterSectionLabel}>Select Championship:</Text>
              <View style={[{ flex: 1, minWidth: 210, position: 'relative' }, isMobile && { flex: 0, width: '100%', minWidth: 0 }]}>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#f8fafc',
                    borderWidth: 1.5,
                    borderColor: approvedTourDropdownOpen ? '#0f172a' : '#cbd5e1',
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    gap: 8
                  }}
                  onPress={() => setApprovedTourDropdownOpen(prev => !prev)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a', flex: 1 }} numberOfLines={1}>
                    🏆 {activeApprovedTournament?.name || uniqueTournaments[0]?.name || 'Select Championship'}
                  </Text>
                  <Text style={{ fontSize: 10, color: '#64748b', fontWeight: '800' }}>{approvedTourDropdownOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {approvedTourDropdownOpen && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 44,
                      left: 0,
                      right: 0,
                      maxHeight: 250,
                      backgroundColor: '#ffffff',
                      borderWidth: 1,
                      borderColor: '#cbd5e1',
                      borderRadius: 8,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.14,
                      shadowRadius: 12,
                      elevation: 14,
                      zIndex: 9999,
                      overflow: 'hidden'
                    }}
                  >
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 250 }}>
                      {uniqueTournaments.map(t => {
                        const isSelected = (approvedTabTournamentId || uniqueTournaments[0]?.id) === t.id;
                        return (
                          <TouchableOpacity
                            key={t.id}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                              borderBottomWidth: 1,
                              borderBottomColor: '#f1f5f9'
                            }}
                            onPress={() => {
                              setApprovedTabTournamentId(t.id);
                              setApprovedTourDropdownOpen(false);
                              loadApprovedTeams(t.id);
                            }}
                          >
                            <Text style={{ fontSize: 12.5, fontWeight: isSelected ? '800' : '600', color: isSelected ? '#1d4ed8' : '#334155', flex: 1 }} numberOfLines={1}>
                              🏆 {t.name || t.short_name}
                            </Text>
                            {isSelected && <Text style={{ fontSize: 12, fontWeight: '800', color: '#1d4ed8', marginLeft: 6 }}>✓</Text>}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            {activeApprovedTournament && (
              <View style={[styles.approvedTourSummaryBanner, { flexWrap: 'wrap', gap: 10 }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.approvedTourBannerTitle}>{activeApprovedTournament.name}</Text>
                  <Text style={styles.approvedTourBannerSub}>
                    {activeApprovedTournament.season || '2026'} Season • {activeApprovedTournament.match_format || 'T20'} • {activeApprovedTournament.venue}
                  </Text>
                </View>
                <View style={styles.approvedCountPill}>
                  <Text style={styles.approvedCountPillText}>
                    {approvedTeamsList.length} / {activeApprovedTournament.max_teams || 16} Official Teams
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Approved Teams Cards Grid */}
          {approvedTeamsLoading ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color="#d4af37" />
              <Text style={styles.loadingText}>Fetching Official Participating Squads...</Text>
            </View>
          ) : approvedTeamsList.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>🛡️</Text>
              <Text style={styles.emptyStateTitle}>No Approved Teams Yet</Text>
              <Text style={styles.emptyStateSub}>
                There are no approved teams currently assigned to this championship. Check the Registrations tab to approve applied teams.
              </Text>
              <TouchableOpacity
                style={styles.createBtnGradient}
                onPress={() => {
                  setRegTournamentFilter(approvedTabTournamentId);
                  setAdminSection('registrations');
                  loadRegistrations();
                }}
              >
                <Text style={styles.createBtnText}>Review Registration Applications</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.approvedTeamsGrid}>
              {approvedTeamsList.map((t, idx) => {
                const initials = (t.team_name || t.name || 'TM')
                  .split(' ')
                  .map((w: string) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <View key={t.id || t.team_id || idx} style={styles.approvedTeamCard}>
                    <View style={styles.approvedTeamTop}>
                      {resolveImageUrl(t.team_logo || t.photo || t.logo || t.image_path) ? (
                        <Image
                          source={{ uri: resolveImageUrl(t.team_logo || t.photo || t.logo || t.image_path)! }}
                          style={[styles.teamCrestAvatar, { width: 44, height: 44, resizeMode: 'cover', overflow: 'hidden' }]}
                        />
                      ) : (
                        <View style={[styles.teamCrestAvatar, { backgroundColor: '#059669', width: 44, height: 44 }]}>
                          <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 16 }}>{initials}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.approvedTeamName}>{t.team_name || t.name}</Text>
                        <Text style={styles.approvedTeamTaluk}>📍 {t.team_city || t.team_taluk || t.taluk || 'Virudhunagar'}</Text>
                      </View>
                      <View style={[styles.officialBadge, { flexShrink: 0 }]}>
                        <Text style={styles.officialBadgeText}>OFFICIAL</Text>
                      </View>
                    </View>

                    <View style={styles.approvedMetaRow}>
                      <View style={styles.approvedMetaCol}>
                        <Text style={styles.approvedMetaLabel}>COACH</Text>
                        <Text style={styles.approvedMetaVal}>{t.coach_name || '—'}</Text>
                      </View>
                      <View style={styles.approvedMetaCol}>
                        <Text style={styles.approvedMetaLabel}>ROSTER</Text>
                        <Text style={styles.approvedMetaVal}>{t.squad_count ?? (t.players || []).length ?? 0} Players</Text>
                      </View>
                      <View style={styles.approvedMetaCol}>
                        <Text style={styles.approvedMetaLabel}>CAPTAIN</Text>
                        <Text style={styles.approvedMetaVal}>👑 {t.captain || '—'}</Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                      {t.approved_at ? (
                        <Text style={styles.approvedTimestampText}>
                          Approved on {t.approved_at.split('T')[0]} by {t.approved_by || 'Apex Council'}
                        </Text>
                      ) : <View />}
                      <TouchableOpacity
                        style={{
                          backgroundColor: '#eff6ff',
                          borderWidth: 1,
                          borderColor: '#bfdbfe',
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 7
                        }}
                        onPress={() => setViewTeamModal({
                          teamName: t.team_name || t.name,
                          teamId: t.team_id || t.id,
                          coachName: t.coach_name,
                          coachEmail: t.coach_email,
                          coachPhone: t.coach_phone,
                          captain: t.captain,
                          city: t.team_city || t.city || 'Virudhunagar',
                          status: 'APPROVED',
                          squadCount: t.squad_count ?? (t.players ? t.players.length : 0),
                          players: t.players || []
                        })}
                        activeOpacity={0.8}
                      >
                        <Text style={{ color: '#1d4ed8', fontSize: 12, fontWeight: '700' }}>
                          👁 View Team ({t.squad_count ?? (t.players ? t.players.length : 0)})
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL 1: MULTI-STEP TOURNAMENT CREATION & EDIT WIZARD              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Modal visible={wizardOpen} transparent animationType="fade">
        <View style={[styles.modalOverlay, isMobile && { padding: 8 }]}>
          <View style={[styles.wizardModalCard, isMobile && { maxWidth: '100%', maxHeight: '95%', borderRadius: 12 }]}>
            {/* Modal Header */}
            <View style={[styles.wizardHeader, isMobile && { padding: 12 }]}>
              <View style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                <Text style={[styles.wizardHeaderTitle, isMobile && { fontSize: 15 }]}>
                  {isEditMode ? '✏️ Edit Tournament Details' : '🏆 Create Official Cricket Championship'}
                </Text>
                <Text style={[styles.wizardHeaderSub, isMobile && { fontSize: 11 }]}>
                  {isEditMode
                    ? 'Update tournament parameters, participating squads, and playing conditions.'
                    : 'Configure basic information, competition schedule, select registered teams, and format rules.'}
                </Text>
              </View>

              <TouchableOpacity style={styles.closeBtn} onPress={() => setWizardOpen(false)}>
                <Text style={{ fontSize: 18, color: '#64748b', fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Stepper Tabs Bar */}
            <ScrollView
              horizontal={isMobile}
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#f8fafc' }}
              contentContainerStyle={[styles.stepperBar, { borderBottomWidth: 0 }, !isMobile && { flexGrow: 1 }]}
            >
              {[
                { step: 1, label: '1. Basic Information' },
                { step: 2, label: '2. Schedule & Rules' },
                { step: 3, label: `3. Team Selection (${selectedTeamIds.length}/${formMaxTeams || 8})` },
                { step: 4, label: '4. Format Configuration' }
              ].map(item => {
                const active = wizardStep === item.step;
                const completed = wizardStep > item.step;
                return (
                  <TouchableOpacity
                    key={item.step}
                    style={[
                      styles.stepperItem,
                      isMobile && { flex: 0, flexShrink: 0, paddingHorizontal: 14, paddingVertical: 10 },
                      active && styles.stepperItemActive
                    ]}
                    onPress={() => {
                      if (item.step === 1) setWizardStep(1);
                      else if (item.step === 2 && formName.trim() && formShortName.trim()) setWizardStep(2);
                      else if (item.step === 3 && formName.trim() && formShortName.trim()) setWizardStep(3);
                      else if (item.step === 4 && selectedTeamIds.length >= 2) setWizardStep(4);
                    }}
                  >
                    <Text
                      style={[
                        styles.stepperText,
                        isMobile && { fontSize: 11 },
                        active && styles.stepperTextActive,
                        completed && styles.stepperTextCompleted
                      ]}
                    >
                      {completed ? '✓ ' : ''}{item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Modal Scrollable Body */}
            <ScrollView style={styles.wizardBody} contentContainerStyle={{ padding: isMobile ? 12 : 20 }}>
              {/* ── STEP 1: BASIC INFORMATION ─────────────────────────────── */}
              {wizardStep === 1 && (
                <View style={styles.formSection}>
                  <Text style={styles.sectionHeading}>Championship Basic Information</Text>

                  <View style={styles.formRow}>
                    <View style={styles.formColFull}>
                      <Text style={styles.inputLabel}>Tournament Name *</Text>
                      <TextInput
                        style={[styles.textInput, formNameError ? styles.textInputError : null]}
                        placeholder="e.g. Virudhunagar Premier League 2026"
                        placeholderTextColor="#94a3b8"
                        value={formName}
                        onChangeText={handleTournamentNameChange}
                      />
                      {formNameError && (
                        <Text style={styles.formFieldErrorText}>⚠️ {formNameError}</Text>
                      )}
                    </View>
                  </View>

                  <View style={[styles.formRow, isMobile && { flexDirection: 'column', gap: 10 }]}>
                    <View style={[styles.formColHalf, isMobile && { flex: 0, width: '100%' }]}>
                      <Text style={styles.inputLabel}>Short Name / Abbreviation *</Text>
                      <TextInput
                        style={[styles.textInput, formShortNameError ? styles.textInputError : null]}
                        placeholder="e.g. VPL 2026"
                        placeholderTextColor="#94a3b8"
                        value={formShortName}
                        onChangeText={handleTournamentShortNameChange}
                      />
                      {formShortNameError && (
                        <Text style={styles.formFieldErrorText}>⚠️ {formShortNameError}</Text>
                      )}
                    </View>

                    <View style={[styles.formColHalf, isMobile && { flex: 0, width: '100%' }]}>
                      <Text style={styles.inputLabel}>Season (Year) *</Text>
                      <View style={styles.seasonInputWrapper}>
                        <TextInput
                          style={styles.seasonTextInput}
                          value={formSeason}
                          onChangeText={(val) => {
                            const clean = val.replace(/[^0-9]/g, '').slice(0, 4);
                            setFormSeason(clean);
                          }}
                          placeholder="e.g. 2026"
                          placeholderTextColor="#94a3b8"
                          keyboardType="numeric"
                          maxLength={4}
                        />
                        <TouchableOpacity
                          style={styles.seasonCalendarBtn}
                          onPress={() => {
                            const yr = parseInt(formSeason, 10) || new Date().getFullYear();
                            setPickerDecadeStart(Math.floor(yr / 10) * 10);
                            setShowYearPicker(true);
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="calendar-outline" size={20} color="#0a2540" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.formRow, isMobile && { flexDirection: 'column', gap: 10 }]}>
                    <View style={[styles.formColHalf, isMobile && { flex: 0, width: '100%' }]}>
                      <Text style={styles.inputLabel}>Tournament Type *</Text>
                      <View style={styles.selectWrap}>
                        <select
                          value={formTournamentType}
                          onChange={(e: any) => {
                            const val = e.target.value as TournamentType;
                            setFormTournamentType(val);
                            if (val === 'DOUBLE_ROUND_ROBIN') setFormRoundRobinType('DOUBLE');
                            else if (val === 'SINGLE_ROUND_ROBIN') setFormRoundRobinType('SINGLE');
                          }}
                          style={webSelectStyle}
                        >
                          <option value="SINGLE_ROUND_ROBIN">Single Round Robin</option>
                          <option value="DOUBLE_ROUND_ROBIN">Double Round Robin</option>
                          <option value="SINGLE_ELIMINATION">Single Elimination</option>
                          <option value="DOUBLE_ELIMINATION">Double Elimination</option>
                          <option value="GROUP_KNOCKOUT">Group + Knockout</option>
                          <option value="LEAGUE_PLAYOFFS">League + Playoffs</option>
                        </select>
                        <View style={styles.selectChevron}>
                          <Text style={styles.selectChevronText}>▾</Text>
                        </View>
                      </View>
                    </View>

                    <View style={[styles.formColHalf, isMobile && { flex: 0, width: '100%' }]}>
                      <Text style={styles.inputLabel}>Match Format *</Text>
                      <View style={styles.selectWrap}>
                        <select
                          value={formMatchFormat}
                          onChange={(e: any) => {
                            const val = e.target.value as MatchFormat;
                            setFormMatchFormat(val);
                            if (val === 'T10') setFormOvers('10');
                            else if (val === 'T20') setFormOvers('20');
                            else if (val === 'ODI') setFormOvers('50');
                            else if (val === 'CUSTOM') {
                              if (['10', '20', '50'].includes(formOvers)) setFormOvers('');
                            }
                          }}
                          style={webSelectStyle}
                        >
                          <option value="T20">T20 (20 Overs per side)</option>
                          <option value="T10">T10 (10 Overs per side)</option>
                          <option value="ODI">One Day (50 Overs per side)</option>
                          <option value="CUSTOM">Custom Overs</option>
                        </select>
                        <View style={styles.selectChevron}>
                          <Text style={styles.selectChevronText}>▾</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Extra field when Custom Overs is selected - accepts only numbers and stores in DB */}
                  {formMatchFormat === 'CUSTOM' && (
                    <View style={styles.formRow}>
                      <View style={styles.formColFull}>
                        <Text style={styles.inputLabel}>Custom Overs Per Side / Match *</Text>
                        <View style={{ position: 'relative', width: '100%', justifyContent: 'center' }}>
                          <TextInput
                            style={[styles.textInput, { paddingRight: 68 }]}
                            placeholder="Enter overs per match (e.g. 15, 25, 30, 45)"
                            placeholderTextColor="#94a3b8"
                            keyboardType="number-pad"
                            value={formOvers}
                            onChangeText={(val) => {
                              const clean = val.replace(/[^0-9]/g, '');
                              setFormOvers(clean);
                            }}
                            maxLength={3}
                          />
                          <View style={styles.inputSuffixBadge}>
                            <Text style={styles.inputSuffixBadgeText}>Overs</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  )}

                  <View style={styles.formRow}>
                    <View style={styles.formColFull}>
                      <Text style={styles.inputLabel}>Category / Age Group</Text>
                      <View style={styles.selectWrap}>
                        <select
                          value={formCategory}
                          onChange={(e: any) => setFormCategory(e.target.value)}
                          style={webSelectStyle}
                        >
                          <option value="Senior Men">Senior Men</option>
                          <option value="Under-19">Under-19 District</option>
                          <option value="Under-16">Under-16 Talent Trophy</option>
                          <option value="Under-14">Under-14 Cadets</option>
                          <option value="Senior Women">Senior Women</option>
                          <option value="Open District">Open District Championship</option>
                        </select>
                        <View style={styles.selectChevron}>
                          <Text style={styles.selectChevronText}>▾</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.formRow, isMobile && { flexDirection: 'column', gap: 10 }]}>
                    <View style={[styles.formColHalf, isMobile && { flex: 0, width: '100%' }]}>
                      <Text style={styles.inputLabel}>Gender</Text>
                      <View style={styles.selectWrap}>
                        <select
                          value={formGender}
                          onChange={(e: any) => setFormGender(e.target.value)}
                          style={webSelectStyle}
                        >
                          <option value="Men">Men</option>
                          <option value="Women">Women</option>
                          <option value="Open">Open</option>
                        </select>
                        <View style={styles.selectChevron}>
                          <Text style={styles.selectChevronText}>▾</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.formColHalf}>
                      <Text style={styles.inputLabel}>Ball Type</Text>
                      <View style={styles.selectWrap}>
                        <select
                          value={formBallType}
                          onChange={(e: any) => {
                            const val = e.target.value;
                            setFormBallType(val);
                            if (val !== 'CUSTOM') setFormCustomBallTypeError(null);
                          }}
                          style={webSelectStyle}
                        >
                          <option value="Red Leather">Red Leather</option>
                          <option value="White Leather">White Leather</option>
                          <option value="Pink Leather">Pink Leather</option>
                          <option value="Tennis">Heavy Tennis Ball</option>
                          <option value="CUSTOM">Custom (Enter Ball Type)</option>
                        </select>
                        <View style={styles.selectChevron}>
                          <Text style={styles.selectChevronText}>▾</Text>
                        </View>
                      </View>
                      {formBallType === 'CUSTOM' && (
                        <>
                          <TextInput
                            style={[
                              styles.textInput,
                              { marginTop: 8 },
                              formCustomBallTypeError ? styles.textInputError : null,
                            ]}
                            placeholder="Enter custom ball type (e.g. SG Club Leather)"
                            placeholderTextColor="#94a3b8"
                            value={formCustomBallType}
                            onChangeText={handleCustomBallTypeChange}
                          />
                          {formCustomBallTypeError && (
                            <Text style={styles.formFieldErrorText}>⚠️ {formCustomBallTypeError}</Text>
                          )}
                        </>
                      )}
                    </View>
                  </View>

                  {/* Tournament Description - commented out as requested */}
                  {/*
                  <View style={styles.formRow}>
                    <View style={styles.formColFull}>
                      <Text style={styles.inputLabel}>Tournament Description</Text>
                      <TextInput
                        style={[styles.textInput, { height: 75, textAlignVertical: 'top' }]}
                        multiline
                        placeholder="Describe tournament prestige, affiliated sponsors, and official rules..."
                        placeholderTextColor="#94a3b8"
                        value={formDescription}
                        onChangeText={setFormDescription}
                      />
                    </View>
                  </View>
                  */}
                </View>
              )}

              {/* ── STEP 2: SCHEDULE & RULES ──────────────────────────────── */}
              {wizardStep === 2 && (
                <View style={styles.formSection}>
                  <Text style={styles.sectionHeading}>Championship Schedule & Playing Rules</Text>

                  {/* Championship Dates & Registration Window - commented out as requested */}
                  {/*
                  <View style={styles.formRow}>
                    <View style={styles.formColHalf}>
                      <Text style={styles.inputLabel}>Championship Start Date</Text>
                      <input
                        type="date"
                        value={formStartDate}
                        onChange={(e: any) => setFormStartDate(e.target.value)}
                        style={styles.nativeDateInput as any}
                      />
                    </View>

                    <View style={styles.formColHalf}>
                      <Text style={styles.inputLabel}>Championship End Date</Text>
                      <input
                        type="date"
                        value={formEndDate}
                        onChange={(e: any) => setFormEndDate(e.target.value)}
                        style={styles.nativeDateInput as any}
                      />
                    </View>
                  </View>

                  <View style={styles.formRow}>
                    <View style={styles.formColHalf}>
                      <Text style={styles.inputLabel}>Registration Window Start</Text>
                      <input
                        type="date"
                        value={formRegStartDate}
                        onChange={(e: any) => setFormRegStartDate(e.target.value)}
                        style={styles.nativeDateInput as any}
                      />
                    </View>

                    <View style={styles.formColHalf}>
                      <Text style={styles.inputLabel}>Registration Window Close</Text>
                      <input
                        type="date"
                        value={formRegEndDate}
                        onChange={(e: any) => setFormRegEndDate(e.target.value)}
                        style={styles.nativeDateInput as any}
                      />
                    </View>
                  </View>
                  */}

                  <View style={styles.formRow}>
                    <View style={styles.formColFull}>
                      <Text style={styles.inputLabel}>Primary District Venue / Stadium</Text>
                      <View style={styles.selectWrap}>
                        <select
                          value={formVenue}
                          onChange={(e: any) => setFormVenue(e.target.value)}
                          style={webSelectStyle}
                        >
                          {dbVenues.map(v => (
                            <option key={v.id || v.name} value={v.name}>
                              {v.name} {v.location ? `(${v.location})` : ''}
                            </option>
                          ))}
                        </select>
                        <View style={styles.selectChevron}>
                          <Text style={styles.selectChevronText}>▾</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={styles.formRow}>
                    <View style={styles.formColFourth}>
                      <Text style={styles.inputLabel}>Min Teams</Text>
                      <TextInput
                        style={[styles.textInput, step2RuleErrors.minTeams && { borderColor: '#DC2626', backgroundColor: '#FEF2F2' }]}
                        keyboardType="numeric"
                        value={formMinTeams}
                        onChangeText={(v) => setFormMinTeams(sanitizeUnsignedInt(v))}
                      />
                      {step2RuleErrors.minTeams ? <Text style={{ color: '#DC2626', fontSize: 10.5, fontWeight: '700', marginTop: 3 }}>⚠️ {step2RuleErrors.minTeams}</Text> : null}
                    </View>
                    <View style={styles.formColFourth}>
                      <Text style={styles.inputLabel}>Max Teams</Text>
                      <TextInput
                        style={[styles.textInput, step2RuleErrors.maxTeams && { borderColor: '#DC2626', backgroundColor: '#FEF2F2' }]}
                        keyboardType="numeric"
                        value={formMaxTeams}
                        onChangeText={(v) => setFormMaxTeams(sanitizeUnsignedInt(v))}
                      />
                      {step2RuleErrors.maxTeams ? <Text style={{ color: '#DC2626', fontSize: 10.5, fontWeight: '700', marginTop: 3 }}>⚠️ {step2RuleErrors.maxTeams}</Text> : null}
                    </View>
                    <View style={styles.formColFourth}>
                      <Text style={styles.inputLabel}>Overs / Match</Text>
                      <TextInput
                        style={[styles.textInput, step2RuleErrors.overs && { borderColor: '#DC2626', backgroundColor: '#FEF2F2' }]}
                        keyboardType="numeric"
                        value={formOvers}
                        onChangeText={(v) => setFormOvers(sanitizeUnsignedInt(v))}
                      />
                      {step2RuleErrors.overs ? <Text style={{ color: '#DC2626', fontSize: 10.5, fontWeight: '700', marginTop: 3 }}>⚠️ {step2RuleErrors.overs}</Text> : null}
                    </View>
                    <View style={styles.formColFourth}>
                      <Text style={styles.inputLabel}>Playing XI Size</Text>
                      <TextInput
                        style={[styles.textInput, step2RuleErrors.playingXI && { borderColor: '#DC2626', backgroundColor: '#FEF2F2' }]}
                        keyboardType="numeric"
                        value={formPlayingXI}
                        onChangeText={(v) => setFormPlayingXI(sanitizeUnsignedInt(v))}
                      />
                      {step2RuleErrors.playingXI ? <Text style={{ color: '#DC2626', fontSize: 10.5, fontWeight: '700', marginTop: 3 }}>⚠️ {step2RuleErrors.playingXI}</Text> : null}
                    </View>
                  </View>

                  {/* Points System */}
                  <View style={styles.pointsConfigBox}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <Text style={styles.pointsConfigTitle}>🏆 Points Allocation & Walkover Rules</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setFormPointsWin('4');
                          setFormPointsLoss('0');
                          setFormPointsTie('2');
                          setFormPointsNR('2');
                          setFormPointsBonusWin('1');
                          setFormPointsBonusLoss('-1');
                          setFormPointsWalkoverWin('4');
                          setFormPointsWalkoverLoss('-1');
                          setFormPowerplayOvers('5');
                          setFormMaxOutsidePP('2');
                          setFormMaxOutsidePostPP('5');
                          setFormMaxOnSide('5');
                          setFormMaxBehindCrease('2');
                          setFormFreeHitAllNoBalls(true);
                          setFormDelayPenaltyEnabled(true);
                          setFormDelayIntervalValue('4');
                          setFormDelayIntervalUnit('MINUTES');
                          setFormDelayReduceUnit('OVERS');
                          setFormDelayOversReduced('1');
                          setFormTieHandling('SHARE_POINTS');
                          setFormWinnerTeamName('');
                          setFormRunnerUpTeamName('');
                          setFormWinnerTrophyTitle('Championship Winner Trophy');
                          setFormRunnerUpTrophyTitle('Runner-Up Trophy');
                          setFormPotmEveryMatch(true);
                        }}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 6,
                          backgroundColor: '#FEF3C7',
                          borderWidth: 1,
                          borderColor: '#F59E0B'
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#92400E' }}>⚡ Association Preset</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                      <View style={{ flex: 1, minWidth: isMobile ? '46%' : 80 }}>
                        <Text style={styles.inputLabel}>Win</Text>
                        <TextInput style={styles.textInput} keyboardType="numeric" value={formPointsWin} onChangeText={(v) => setFormPointsWin(sanitizeUnsignedInt(v))} />
                      </View>
                      <View style={{ flex: 1, minWidth: isMobile ? '46%' : 80 }}>
                        <Text style={styles.inputLabel}>Loss</Text>
                        <TextInput style={styles.textInput} keyboardType="numeric" value={formPointsLoss} onChangeText={(v) => setFormPointsLoss(sanitizeSignedInt(v))} />
                      </View>
                      <View style={{ flex: 1, minWidth: isMobile ? '46%' : 80 }}>
                        <Text style={styles.inputLabel}>Tie (Each)</Text>
                        <TextInput style={styles.textInput} keyboardType="numeric" value={formPointsTie} onChangeText={(v) => setFormPointsTie(sanitizeUnsignedInt(v))} />
                      </View>
                      <View style={{ flex: 1, minWidth: isMobile ? '46%' : 80 }}>
                        <Text style={styles.inputLabel}>No Result</Text>
                        <TextInput style={styles.textInput} keyboardType="numeric" value={formPointsNR} onChangeText={(v) => setFormPointsNR(sanitizeUnsignedInt(v))} />
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                      <View style={{ flex: 1, minWidth: isMobile ? '46%' : 80 }}>
                        <Text style={styles.inputLabel}>Bonus Win (+)</Text>
                        <TextInput style={styles.textInput} keyboardType="numeric" value={formPointsBonusWin} onChangeText={(v) => setFormPointsBonusWin(sanitizeUnsignedInt(v))} />
                      </View>
                      <View style={{ flex: 1, minWidth: isMobile ? '46%' : 80 }}>
                        <Text style={styles.inputLabel}>Loss Bonus Pen.</Text>
                        <TextInput style={styles.textInput} keyboardType="numeric" value={formPointsBonusLoss} onChangeText={(v) => setFormPointsBonusLoss(sanitizeSignedInt(v))} />
                      </View>
                      <View style={{ flex: 1, minWidth: isMobile ? '46%' : 80 }}>
                        <Text style={styles.inputLabel}>Walkover Win</Text>
                        <TextInput style={styles.textInput} keyboardType="numeric" value={formPointsWalkoverWin} onChangeText={(v) => setFormPointsWalkoverWin(sanitizeUnsignedInt(v))} />
                      </View>
                      <View style={{ flex: 1, minWidth: isMobile ? '46%' : 80 }}>
                        <Text style={styles.inputLabel}>Walkover Given</Text>
                        <TextInput style={styles.textInput} keyboardType="numeric" value={formPointsWalkoverLoss} onChangeText={(v) => setFormPointsWalkoverLoss(sanitizeSignedInt(v))} />
                      </View>
                    </View>
                  </View>

                  {/* Rules 5, 8, 14, 18 */}
                  <View style={[styles.pointsConfigBox, { marginTop: 10, backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' }]}>
                    <Text style={styles.pointsConfigTitle}>📜 Fielding, Delay Penalty & Free Hit Rules</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                      <View style={{ flex: 1, minWidth: isMobile ? '46%' : 95 }}>
                        <Text style={styles.inputLabel}>Powerplay Overs</Text>
                        <TextInput style={[styles.textInput, step2RuleErrors.powerplayOvers && { borderColor: '#DC2626', backgroundColor: '#FEF2F2' }]} keyboardType="numeric" value={formPowerplayOvers} onChangeText={(v) => setFormPowerplayOvers(sanitizeUnsignedInt(v))} />
                        {step2RuleErrors.powerplayOvers ? <Text style={{ color: '#DC2626', fontSize: 10.5, fontWeight: '700', marginTop: 3 }}>⚠️ {step2RuleErrors.powerplayOvers}</Text> : null}
                      </View>
                      <View style={{ flex: 1, minWidth: isMobile ? '46%' : 95 }}>
                        <Text style={styles.inputLabel}>Max Outside (PP)</Text>
                        <TextInput style={[styles.textInput, step2RuleErrors.maxOutsidePP && { borderColor: '#DC2626', backgroundColor: '#FEF2F2' }]} keyboardType="numeric" value={formMaxOutsidePP} onChangeText={(v) => setFormMaxOutsidePP(sanitizeUnsignedInt(v))} />
                        {step2RuleErrors.maxOutsidePP ? <Text style={{ color: '#DC2626', fontSize: 10.5, fontWeight: '700', marginTop: 3 }}>⚠️ {step2RuleErrors.maxOutsidePP}</Text> : null}
                      </View>
                      <View style={{ flex: 1, minWidth: isMobile ? '100%' : 95 }}>
                        <Text style={styles.inputLabel}>Max Outside (Post-PP)</Text>
                        <TextInput style={[styles.textInput, step2RuleErrors.maxOutsidePostPP && { borderColor: '#DC2626', backgroundColor: '#FEF2F2' }]} keyboardType="numeric" value={formMaxOutsidePostPP} onChangeText={(v) => setFormMaxOutsidePostPP(sanitizeUnsignedInt(v))} />
                        {step2RuleErrors.maxOutsidePostPP ? <Text style={{ color: '#DC2626', fontSize: 10.5, fontWeight: '700', marginTop: 3 }}>⚠️ {step2RuleErrors.maxOutsidePostPP}</Text> : null}
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                      <View style={{ flex: 1, minWidth: isMobile ? '46%' : 120 }}>
                        <Text style={styles.inputLabel}>Max Leg-Side (excl WK/Bwl)</Text>
                        <TextInput style={[styles.textInput, step2RuleErrors.maxOnSide && { borderColor: '#DC2626', backgroundColor: '#FEF2F2' }]} keyboardType="numeric" value={formMaxOnSide} onChangeText={(v) => setFormMaxOnSide(sanitizeUnsignedInt(v))} />
                        {step2RuleErrors.maxOnSide ? <Text style={{ color: '#DC2626', fontSize: 10.5, fontWeight: '700', marginTop: 3 }}>⚠️ {step2RuleErrors.maxOnSide}</Text> : null}
                      </View>
                      <View style={{ flex: 1, minWidth: isMobile ? '46%' : 120 }}>
                        <Text style={styles.inputLabel}>Max Behind Crease (On-Side)</Text>
                        <TextInput style={[styles.textInput, step2RuleErrors.maxBehindCrease && { borderColor: '#DC2626', backgroundColor: '#FEF2F2' }]} keyboardType="numeric" value={formMaxBehindCrease} onChangeText={(v) => setFormMaxBehindCrease(sanitizeUnsignedInt(v))} />
                        {step2RuleErrors.maxBehindCrease ? <Text style={{ color: '#DC2626', fontSize: 10.5, fontWeight: '700', marginTop: 3 }}>⚠️ {step2RuleErrors.maxBehindCrease}</Text> : null}
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 8 }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#334155', flex: 1 }}>Rule 5 • Post-Toss Delay Penalty</Text>
                      <TouchableOpacity
                        onPress={() => setFormDelayPenaltyEnabled(p => !p)}
                        style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: formDelayPenaltyEnabled ? '#DCFCE7' : '#E2E8F0' }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '800', color: formDelayPenaltyEnabled ? '#166534' : '#475569' }}>
                          {formDelayPenaltyEnabled ? 'ENABLED' : 'OFF'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {formDelayPenaltyEnabled && (
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                        <View style={{ flex: 1, minWidth: isMobile ? '46%' : 80 }}>
                          <Text style={styles.inputLabel}>Every</Text>
                          <TextInput style={[styles.textInput, step2RuleErrors.delayIntervalValue && { borderColor: '#DC2626', backgroundColor: '#FEF2F2' }]} keyboardType="numeric" value={formDelayIntervalValue} onChangeText={(v) => setFormDelayIntervalValue(sanitizeUnsignedInt(v))} />
                          {step2RuleErrors.delayIntervalValue ? <Text style={{ color: '#DC2626', fontSize: 10.5, fontWeight: '700', marginTop: 3 }}>⚠️ {step2RuleErrors.delayIntervalValue}</Text> : null}
                        </View>
                        <View style={{ flex: 1, minWidth: isMobile ? '46%' : 110 }}>
                          <Text style={styles.inputLabel}>Time Unit</Text>
                          <select
                            value={formDelayIntervalUnit}
                            onChange={(e) => setFormDelayIntervalUnit(e.target.value as 'HOURS' | 'MINUTES' | 'SECONDS')}
                            style={{ ...webSelectStyle, paddingRight: 24 }}
                          >
                            <option value="HOURS">Hours</option>
                            <option value="MINUTES">Minutes</option>
                            <option value="SECONDS">Seconds</option>
                          </select>
                        </View>
                        <View style={{ flex: 1, minWidth: isMobile ? '46%' : 80 }}>
                          <Text style={styles.inputLabel}>Reduce By</Text>
                          <TextInput style={[styles.textInput, step2RuleErrors.delayReduceVal && { borderColor: '#DC2626', backgroundColor: '#FEF2F2' }]} keyboardType="numeric" value={formDelayOversReduced} onChangeText={(v) => setFormDelayOversReduced(sanitizeUnsignedInt(v))} />
                          {step2RuleErrors.delayReduceVal ? <Text style={{ color: '#DC2626', fontSize: 10.5, fontWeight: '700', marginTop: 3 }}>⚠️ {step2RuleErrors.delayReduceVal}</Text> : null}
                        </View>
                        <View style={{ flex: 1, minWidth: isMobile ? '46%' : 100 }}>
                          <Text style={styles.inputLabel}>Penalty Unit</Text>
                          <select
                            value={formDelayReduceUnit}
                            onChange={(e) => setFormDelayReduceUnit(e.target.value as 'OVERS' | 'BALLS')}
                            style={{ ...webSelectStyle, paddingRight: 24 }}
                          >
                            <option value="OVERS">Overs</option>
                            <option value="BALLS">Balls</option>
                          </select>
                        </View>
                      </View>
                    )}

                    <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 10, marginTop: 10, alignItems: isMobile ? 'stretch' : 'center' }}>
                      <View style={{ flex: 1, minWidth: isMobile ? '100%' : 140 }}>
                        <Text style={styles.inputLabel}>Max Overs / Bowler</Text>
                        <TextInput
                          style={[styles.textInput, step2RuleErrors.maxOversPerBowler && { borderColor: '#DC2626', backgroundColor: '#FEF2F2' }]}
                          keyboardType="numeric"
                          value={formMaxOversPerBowler}
                          onChangeText={(v) => setFormMaxOversPerBowler(sanitizeUnsignedInt(v))}
                          placeholder="e.g. 4"
                        />
                        {step2RuleErrors.maxOversPerBowler ? (
                          <Text style={{ color: '#DC2626', fontSize: 10.5, fontWeight: '700', marginTop: 3 }}>⚠️ {step2RuleErrors.maxOversPerBowler}</Text>
                        ) : null}
                      </View>
                      <View style={{ flex: 1, minWidth: isMobile ? '100%' : 190 }}>
                        <Text style={styles.inputLabel}>Chain Over (Consecutive Overs)</Text>
                        <TouchableOpacity
                          style={[styles.toggleBtn, formAllowChainOver && styles.toggleBtnActive, { width: '100%' }]}
                          onPress={() => setFormAllowChainOver(v => !v)}
                        >
                          <Text style={[styles.toggleBtnText, formAllowChainOver && styles.toggleBtnTextActive]}>
                            {formAllowChainOver ? '✓ Chain Over ALLOWED (Same Bowler)' : '✕ No Chain Over (Standard)'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 10, marginTop: 10, alignItems: isMobile ? 'stretch' : 'center' }}>
                      <TouchableOpacity
                        style={[styles.toggleBtn, formFreeHitAllNoBalls && styles.toggleBtnActive, { width: isMobile ? '100%' : undefined }]}
                        onPress={() => setFormFreeHitAllNoBalls(v => !v)}
                      >
                        <Text style={[styles.toggleBtnText, formFreeHitAllNoBalls && styles.toggleBtnTextActive]}>
                          {formFreeHitAllNoBalls ? '✓ Rule 18: Free Hit on ALL No-Balls' : '✕ Overstep No-Ball Only'}
                        </Text>
                      </TouchableOpacity>
                      <View style={{ flex: 1, minWidth: isMobile ? '100%' : 170 }}>
                        <select
                          value={formTieHandling}
                          onChange={(e) => setFormTieHandling(e.target.value as 'SHARE_POINTS' | 'SUPER_OVER')}
                          style={{ ...webSelectStyle, paddingRight: 24 }}
                        >
                          <option value="SHARE_POINTS">Rule 14: Tie → Share Points</option>
                          <option value="SUPER_OVER">Rule 14: Tie → Super Over</option>
                        </select>
                      </View>
                    </View>
                  </View>

                  {/* Winner & Runner-Up Trophies + POTM Award */}
                  <View style={[styles.pointsConfigBox, { marginTop: 10, backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                    <Text style={styles.pointsConfigTitle}>🏆 Winner, Runner-Up Trophies &amp; Match Awards</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                      <View style={{ flex: 1, minWidth: isMobile ? '100%' : 140 }}>
                        <Text style={styles.inputLabel}>Winner Trophy Title</Text>
                        <TextInput style={styles.textInput} value={formWinnerTrophyTitle} onChangeText={setFormWinnerTrophyTitle} />
                      </View>
                      <View style={{ flex: 1, minWidth: isMobile ? '100%' : 140 }}>
                        <Text style={styles.inputLabel}>Runner-Up Trophy Title</Text>
                        <TextInput style={styles.textInput} value={formRunnerUpTrophyTitle} onChangeText={setFormRunnerUpTrophyTitle} />
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.toggleBtn, formPotmEveryMatch && styles.toggleBtnActive, { marginTop: 10 }]}
                      onPress={() => setFormPotmEveryMatch(v => !v)}
                    >
                      <Text style={[styles.toggleBtnText, formPotmEveryMatch && styles.toggleBtnTextActive]}>
                        {formPotmEveryMatch ? '✓ Player of the Match Award in Every Match' : '✕ POTM Award Optional'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Toggles */}
                  <View style={styles.togglesRow}>
                    <TouchableOpacity
                      style={[styles.toggleBtn, formAllowSuperOver && styles.toggleBtnActive]}
                      onPress={() => setFormAllowSuperOver(!formAllowSuperOver)}
                    >
                      <Text style={[styles.toggleBtnText, formAllowSuperOver && styles.toggleBtnTextActive]}>
                        {formAllowSuperOver ? '✓ Allow Super Over' : '✕ Super Over Disabled'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.toggleBtn, formAllowDLS && styles.toggleBtnActive]}
                      onPress={() => setFormAllowDLS(!formAllowDLS)}
                    >
                      <Text style={[styles.toggleBtnText, formAllowDLS && styles.toggleBtnTextActive]}>
                        {formAllowDLS ? '✓ Allow DLS Method' : '✕ DLS Disabled'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.formRow, { marginTop: 12 }]}>
                    <View style={styles.formColFull}>
                      <Text style={styles.inputLabel}>Playing Conditions & Regulations</Text>
                      <TextInput
                        style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                        multiline
                        value={formRulesText}
                        onChangeText={setFormRulesText}
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* ── STEP 3: TEAM SELECTION FROM DATABASE ──────────────────── */}
              {wizardStep === 3 && (
                <View style={styles.formSection}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <View>
                      <Text style={styles.sectionHeading}>Participating Team Selection</Text>
                      <Text style={styles.sectionSub}>
                        Select eligible, approved clubs from the database. (Minimum: {formMinTeams}, Maximum: {formMaxTeams})
                      </Text>
                    </View>

                    {/* Team Counter Badge */}
                    <View style={styles.selectedCountBadge}>
                      <Text style={styles.selectedCountText}>
                        Selected: <Text style={{ fontWeight: '800', color: '#020612' }}>{selectedTeamIds.length}</Text> / {formMaxTeams}
                      </Text>
                    </View>
                  </View>

                  {/* Team Search & Quick Select Toolbar */}
                  <View style={styles.teamSearchRow}>
                    <TextInput
                      style={styles.teamSearchInput}
                      placeholder="Search club name, coach, or taluk..."
                      placeholderTextColor="#94a3b8"
                      value={teamSearchQuery}
                      onChangeText={setTeamSearchQuery}
                    />
                    <TouchableOpacity style={styles.btnSmallAction} onPress={loadTeamsFromDb}>
                      <Text style={styles.btnSmallActionText}>🔄 Refresh</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnSmallAction} onPress={selectAllTeams}>
                      <Text style={styles.btnSmallActionText}>Select All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnSmallAction} onPress={deselectAllTeams}>
                      <Text style={styles.btnSmallActionText}>Clear</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Teams Selection List */}
                  {filteredTeams.length === 0 ? (
                    <View style={styles.noTeamsBox}>
                      <Text style={{ fontSize: 24, marginBottom: 6 }}>🛡️</Text>
                      <Text style={{ fontWeight: '700', color: '#334155' }}>No approved teams found</Text>
                      <Text style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                        Ensure registered clubs are approved under the Team Registrations tab.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.teamCardsContainer}>
                      {filteredTeams.map(t => {
                        const isSelected = selectedTeamIds.includes(t.id);
                        return (
                          <TouchableOpacity
                            key={t.id}
                            style={[styles.teamSelectCard, isSelected && styles.teamSelectCardActive]}
                            onPress={() => toggleTeamSelection(t.id)}
                            activeOpacity={0.8}
                          >
                            <View style={[styles.checkboxCircle, isSelected && styles.checkboxCircleActive]}>
                              {isSelected ? <Text style={styles.checkIcon}>✓</Text> : null}
                            </View>

                            <View style={styles.teamCardAvatar}>
                              <Text style={styles.teamCardAvatarText}>
                                {(t.name || t.team_name || 'TM').slice(0, 2).toUpperCase()}
                              </Text>
                            </View>

                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 4 }}>
                                <Text style={[styles.teamCardName, { flex: 1, marginRight: 8 }]} numberOfLines={1}>
                                  {t.name || t.team_name}
                                </Text>
                                <View style={{
                                  paddingHorizontal: 7,
                                  paddingVertical: 2,
                                  borderRadius: 10,
                                  backgroundColor: t.status === 'Approved' ? '#ecfdf5' : '#fffbeb',
                                  borderWidth: 1,
                                  borderColor: t.status === 'Approved' ? '#a7f3d0' : '#fde68a'
                                }}>
                                  <Text style={{
                                    fontSize: 10,
                                    fontWeight: '700',
                                    color: t.status === 'Approved' ? '#047857' : '#b45309'
                                  }}>
                                    {t.status || 'Club'}
                                  </Text>
                                </View>
                              </View>
                              <Text style={styles.teamCardCoach}>
                                Coach: {t.coach_name || 'Official'} • {t.taluk || 'Virudhunagar'}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {/* ── STEP 4: TOURNAMENT FORMAT CONFIGURATION ───────────────── */}
              {wizardStep === 4 && (
                <View style={styles.formSection}>
                  {/* Summary Card with Dynamic Easy-English Explanation */}
                  <View style={styles.formatSummaryCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                      <Text style={{ fontSize: 28, marginTop: 2 }}>⚙️</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.formatSummaryTitle}>
                          {TOURNAMENT_FORMAT_META[formTournamentType].label}
                        </Text>
                        <Text style={styles.formatSummarySub}>
                          {selectedTeamIds.length} Teams Selected • Estimated Matches: {estimatedMatchesCount}
                        </Text>
                        <Text style={{ color: '#e2e8f0', fontSize: 12.5, lineHeight: 18, marginTop: 6, fontWeight: '500' }}>
                          {TOURNAMENT_FORMAT_META[formTournamentType].easyExplain}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Interactive Format Selector */}
                  <View style={styles.formatConfigBox}>
                    <Text style={styles.configBoxTitle}>Format</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
                      {(Object.keys(TOURNAMENT_FORMAT_META) as TournamentType[]).map((fmtKey) => {
                        const meta = TOURNAMENT_FORMAT_META[fmtKey];
                        const isActive = formTournamentType === fmtKey;
                        const isDisabled = Boolean(meta.unavailable);
                        return (
                          <TouchableOpacity
                            key={fmtKey}
                            disabled={isDisabled}
                            style={[
                              styles.formatOptionBtn,
                              { minWidth: 165, flex: 1, opacity: isDisabled ? 0.55 : 1 },
                              isActive && styles.formatOptionBtnActive
                            ]}
                            onPress={() => {
                              if (isDisabled) return;
                              setFormTournamentType(fmtKey);
                              if (fmtKey === 'DOUBLE_ROUND_ROBIN') setFormRoundRobinType('DOUBLE');
                              else if (fmtKey === 'SINGLE_ROUND_ROBIN') setFormRoundRobinType('SINGLE');
                            }}
                          >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                              <Text style={[styles.formatOptionTitle, isActive && styles.formatOptionTitleActive]}>
                                {meta.label}
                              </Text>
                              {isDisabled ? (
                                <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#F59E0B' }}>
                                  <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#92400E' }}>UNAVAILABLE</Text>
                                </View>
                              ) : null}
                            </View>
                            <Text style={styles.formatOptionSub}>
                              {meta.easyExplain}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Dynamic Controls by Selected Format */}
                  {(formTournamentType === 'SINGLE_ELIMINATION' || formTournamentType === 'DOUBLE_ELIMINATION') && (
                    <View style={styles.formatConfigBox}>
                      <Text style={styles.configBoxTitle}>
                        {formTournamentType === 'DOUBLE_ELIMINATION'
                          ? 'Double Elimination Brackets'
                          : 'Single Elimination Bracket'}
                      </Text>
                      <View style={styles.knockoutStagesList}>
                        {formTournamentType === 'DOUBLE_ELIMINATION' ? (
                          <>
                            <View style={styles.stagePill}>
                              <Text style={styles.stagePillText}>Winners Bracket</Text>
                            </View>
                            <View style={styles.stagePill}>
                              <Text style={styles.stagePillText}>Losers Bracket (2nd Chance)</Text>
                            </View>
                            <View style={[styles.stagePill, { backgroundColor: '#fef3c7', borderColor: '#fde047' }]}>
                              <Text style={[styles.stagePillText, { color: '#854d0e', fontWeight: '800' }]}>🏆 Grand Final</Text>
                            </View>
                          </>
                        ) : (
                          <>
                            {selectedTeamIds.length > 8 && (
                              <View style={styles.stagePill}>
                                <Text style={styles.stagePillText}>Round of 16 (8 Matches)</Text>
                              </View>
                            )}
                            {selectedTeamIds.length > 4 && (
                              <View style={styles.stagePill}>
                                <Text style={styles.stagePillText}>Quarter Finals ({Math.floor(selectedTeamIds.length / 2)} Matches)</Text>
                              </View>
                            )}
                            <View style={styles.stagePill}>
                              <Text style={styles.stagePillText}>Semi Finals (2 Matches)</Text>
                            </View>
                            <View style={[styles.stagePill, { backgroundColor: '#fef3c7', borderColor: '#fde047' }]}>
                              <Text style={[styles.stagePillText, { color: '#854d0e', fontWeight: '800' }]}>🏆 Grand Final (1 Match)</Text>
                            </View>
                          </>
                        )}
                      </View>
                    </View>
                  )}

                  {formTournamentType === 'GROUP_KNOCKOUT' && (
                    <View style={styles.formatConfigBox}>
                      <Text style={styles.configBoxTitle}>Multi-Stage Format (Groups → Super League → Knockouts)</Text>
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                        <View style={{ flex: 1, minWidth: 95 }}>
                          <Text style={styles.inputLabel}>Stage 1 Groups</Text>
                          <TextInput style={styles.textInput} keyboardType="numeric" value={formGroupCount} onChangeText={(v) => setFormGroupCount(sanitizeUnsignedInt(v))} />
                        </View>
                        <View style={{ flex: 1, minWidth: 95 }}>
                          <Text style={styles.inputLabel}>Teams / Group</Text>
                          <TextInput style={styles.textInput} keyboardType="numeric" value={formTeamsPerGroup} onChangeText={(v) => setFormTeamsPerGroup(sanitizeUnsignedInt(v))} />
                        </View>
                        <View style={{ flex: 1, minWidth: 105 }}>
                          <Text style={styles.inputLabel}>Top Qualifiers / Grp</Text>
                          <TextInput style={styles.textInput} keyboardType="numeric" value={formQualifiersPerGroup} onChangeText={(v) => setFormQualifiersPerGroup(sanitizeUnsignedInt(v))} />
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                        <TouchableOpacity
                          style={[styles.toggleBtn, formAllowExtraGroup && styles.toggleBtnActive]}
                          onPress={() => setFormAllowExtraGroup(v => !v)}
                        >
                          <Text style={[styles.toggleBtnText, formAllowExtraGroup && styles.toggleBtnTextActive]}>
                            {formAllowExtraGroup ? '✓ Auto-add Extra Group (e.g. 6th)' : '✕ Fixed Group Count'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.toggleBtn, formSuperLeagueEnabled && styles.toggleBtnActive]}
                          onPress={() => setFormSuperLeagueEnabled(v => !v)}
                        >
                          <Text style={[styles.toggleBtnText, formSuperLeagueEnabled && styles.toggleBtnTextActive]}>
                            {formSuperLeagueEnabled ? '✓ Stage 2: Super League' : '✕ Skip Super League'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {formSuperLeagueEnabled && (
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                          <View style={{ flex: 1, minWidth: 120 }}>
                            <Text style={styles.inputLabel}>Super League Groups</Text>
                            <TextInput style={styles.textInput} keyboardType="numeric" value={formSuperLeagueGroups} onChangeText={(v) => setFormSuperLeagueGroups(sanitizeUnsignedInt(v))} />
                          </View>
                          <View style={{ flex: 1, minWidth: 120 }}>
                            <Text style={styles.inputLabel}>Top Qualifiers / SL Grp</Text>
                            <TextInput style={styles.textInput} keyboardType="numeric" value={formSuperLeagueQualifiers} onChangeText={(v) => setFormSuperLeagueQualifiers(sanitizeUnsignedInt(v))} />
                          </View>
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                        <TouchableOpacity
                          style={[styles.toggleBtn, formIncludeSemis && styles.toggleBtnActive]}
                          onPress={() => setFormIncludeSemis(v => !v)}
                        >
                          <Text style={[styles.toggleBtnText, formIncludeSemis && styles.toggleBtnTextActive]}>
                            {formIncludeSemis ? '✓ Semi-Finals' : '✕ No Semi-Finals'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.toggleBtn, formIncludeFinal && styles.toggleBtnActive]}
                          onPress={() => setFormIncludeFinal(v => !v)}
                        >
                          <Text style={[styles.toggleBtnText, formIncludeFinal && styles.toggleBtnTextActive]}>
                            {formIncludeFinal ? '✓ Grand Final' : '✕ No Final'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                        <View style={{ flex: 1, minWidth: 130 }}>
                          <Text style={styles.inputLabel}>Group Distribution</Text>
                          <select
                            value={formGroupDistribution}
                            onChange={(e) => setFormGroupDistribution(e.target.value as any)}
                            style={{ ...webSelectStyle, paddingRight: 24 }}
                          >
                            <option value="BALANCED">Balanced (Round-Robin)</option>
                            <option value="SEEDED">Seeded (Snake Draft)</option>
                            <option value="RANDOM">Random Draw</option>
                            <option value="MANUAL">Manual Allocation</option>
                          </select>
                        </View>
                        <View style={{ flex: 1, minWidth: 130 }}>
                          <Text style={styles.inputLabel}>Best Runners-Up (Wildcard)</Text>
                          <TextInput
                            style={styles.textInput}
                            keyboardType="numeric"
                            value={formBestRunnersUp}
                            onChangeText={(v) => setFormBestRunnersUp(sanitizeUnsignedInt(v))}
                            placeholder="0"
                          />
                        </View>
                      </View>
                      <Text style={{ fontSize: 11.5, color: '#1E40AF', fontWeight: '700', marginTop: 10 }}>
                        Flow: {formGroupCount} Groups × {formTeamsPerGroup} Teams → Top {formQualifiersPerGroup}/Group{Number(formBestRunnersUp) > 0 ? ` + ${formBestRunnersUp} Best Runners-Up` : ''} → {formSuperLeagueEnabled ? `${formSuperLeagueGroups} Super League Groups → Top ${formSuperLeagueQualifiers}/Group → ` : ''}{formIncludeSemis ? 'Semi-Finals → ' : ''}{formIncludeFinal ? 'Final' : ''}
                      </Text>
                    </View>
                  )}

                  {formTournamentType === 'LEAGUE_PLAYOFFS' && (
                    <View style={styles.formatConfigBox}>
                      <Text style={styles.configBoxTitle}>League + Playoffs Configuration</Text>
                      <View style={{ marginTop: 10, gap: 12 }}>
                        <View>
                          <Text style={styles.inputLabel}>Number of Qualifying Teams to Knockouts</Text>
                          <TextInput
                            style={styles.textInput}
                            keyboardType="numeric"
                            value={formQualifyingTeamsCount}
                            onChangeText={setFormQualifyingTeamsCount}
                          />
                        </View>
                        <View>
                          <Text style={styles.inputLabel}>Qualification Criteria / Rule Description</Text>
                          <TextInput
                            style={styles.textInput}
                            value={formQualificationRules}
                            onChangeText={setFormQualificationRules}
                          />
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Live Fixture Preview Summary (Yellow-Themed Review Box) */}
                  {(() => {
                    const n = selectedTeamIds.length;
                    if (n < 2) return null;
                    let rounds = 0;
                    let byes = 0;
                    let groupInfo = '';
                    let groupMatches = 0;
                    let koMatches = 0;
                    let totalMatches = 0;
                    let qualifiers = 0;

                    if (formTournamentType === 'SINGLE_ROUND_ROBIN' || formTournamentType === 'DOUBLE_ROUND_ROBIN') {
                      const isDouble = formTournamentType === 'DOUBLE_ROUND_ROBIN';
                      const rPerLeg = n % 2 === 0 ? n - 1 : n;
                      rounds = isDouble ? rPerLeg * 2 : rPerLeg;
                      byes = n % 2 === 1 ? rounds : 0;
                      totalMatches = isDouble ? n * (n - 1) : Math.floor((n * (n - 1)) / 2);
                    } else if (formTournamentType === 'SINGLE_ELIMINATION' || formTournamentType === 'DOUBLE_ELIMINATION') {
                      let bSize = 1;
                      while (bSize < n) bSize *= 2;
                      byes = bSize - n;
                      rounds = Math.log2(bSize);
                      koMatches = formTournamentType === 'DOUBLE_ELIMINATION' ? (n * 2 - 2) : (n - 1);
                      totalMatches = koMatches;
                    } else if (formTournamentType === 'GROUP_KNOCKOUT') {
                      const baseG = Math.max(1, parseInt(formGroupCount, 10) || 2);
                      const maxPerG = Math.max(2, parseInt(formTeamsPerGroup, 10) || 8);
                      const effG = Math.max(1, Math.min((formAllowExtraGroup && n > baseG * maxPerG) ? baseG + 1 : baseG, Math.floor(n / 2) || 1));
                      const baseSize = Math.floor(n / effG);
                      const rem = n % effG;
                      groupMatches = rem * Math.floor(((baseSize + 1) * baseSize) / 2) + (effG - rem) * Math.floor((baseSize * (baseSize - 1)) / 2);
                      const qPerG = Math.max(1, parseInt(formQualifiersPerGroup, 10) || 1);
                      const bestRU = Math.max(0, parseInt(formBestRunnersUp, 10) || 0);
                      qualifiers = Math.min(n, effG * qPerG + bestRU);
                      koMatches = qualifiers >= 2 ? qualifiers - 1 : 0;
                      totalMatches = groupMatches + koMatches;
                      groupInfo = `${effG} Groups (${rem > 0 ? `${baseSize}–${baseSize + 1}` : baseSize} teams/grp)`;
                    } else if (formTournamentType === 'LEAGUE_PLAYOFFS') {
                      const rPerLeg = n % 2 === 0 ? n - 1 : n;
                      rounds = rPerLeg;
                      byes = n % 2 === 1 ? rounds : 0;
                      groupMatches = Math.floor((n * (n - 1)) / 2);
                      qualifiers = n >= 4 ? 4 : 0;
                      koMatches = n >= 4 ? 4 : 0;
                      totalMatches = groupMatches + koMatches;
                    }

                    return (
                      <View style={{
                        marginTop: 12,
                        padding: 14,
                        borderRadius: 12,
                        backgroundColor: '#FFFBEB',
                        borderWidth: 1.5,
                        borderColor: '#F59E0B'
                      }}>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: '#92400E', marginBottom: 8 }}>
                          📋 Fixture Preview Before Creation
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                          <Text style={{ fontSize: 12, color: '#334155', fontWeight: '700' }}>• Selected Teams: {n}</Text>
                          {groupInfo ? <Text style={{ fontSize: 12, color: '#334155', fontWeight: '700' }}>• Groups: {groupInfo}</Text> : null}
                          {rounds > 0 ? <Text style={{ fontSize: 12, color: '#334155', fontWeight: '700' }}>• Rounds: {rounds}</Text> : null}
                          {byes > 0 ? <Text style={{ fontSize: 12, color: '#B45309', fontWeight: '800' }}>• Byes: {byes}</Text> : null}
                          {groupMatches > 0 ? <Text style={{ fontSize: 12, color: '#334155', fontWeight: '700' }}>• Stage 1 Matches: {groupMatches}</Text> : null}
                          {qualifiers > 0 ? <Text style={{ fontSize: 12, color: '#334155', fontWeight: '700' }}>• Qualifiers: {qualifiers}</Text> : null}
                          {koMatches > 0 ? <Text style={{ fontSize: 12, color: '#334155', fontWeight: '700' }}>• Knockout/Playoff Matches: {koMatches}</Text> : null}
                          <Text style={{ fontSize: 12.5, color: '#92400E', fontWeight: '900' }}>• Total Expected Fixtures: {totalMatches}</Text>
                        </View>
                        <Text style={{ fontSize: 11, color: '#64748B', marginTop: 6 }}>
                          Tie-Breaker Order: {formTieBreakerOrder.split(',').join(' → ')}
                        </Text>

                        {/* Group Allocation Preview for GROUP_KNOCKOUT */}
                        {formTournamentType === 'GROUP_KNOCKOUT' && n >= 2 && (() => {
                          const baseG = Math.max(1, parseInt(formGroupCount, 10) || 2);
                          const maxPerG = Math.max(2, parseInt(formTeamsPerGroup, 10) || 8);
                          const effG = Math.max(1, Math.min((formAllowExtraGroup && n > baseG * maxPerG) ? baseG + 1 : baseG, Math.floor(n / 2) || 1));
                          const groupKeys = Array.from({ length: effG }, (_, i) => `GROUP_${String.fromCharCode(65 + i)}`);
                          const grpBuckets: string[][] = Array.from({ length: effG }, () => []);
                          const ordered = [...selectedTeamIds];
                          let unassignedIds: string[] = [];

                          if (formGroupDistribution === 'MANUAL') {
                            const hasManual = Object.keys(formManualGroups).length > 0;
                            if (!hasManual) {
                              ordered.forEach((tId, idx) => { grpBuckets[idx % effG].push(tId); });
                            } else {
                              const placed = new Set<string>();
                              groupKeys.forEach((gk, gIdx) => {
                                const savedList = Array.isArray(formManualGroups[gk]) ? formManualGroups[gk] : [];
                                savedList.forEach(tId => {
                                  if (ordered.includes(tId) && !placed.has(tId)) {
                                    grpBuckets[gIdx].push(tId);
                                    placed.add(tId);
                                  }
                                });
                              });
                              unassignedIds = ordered.filter(tId => !placed.has(tId));
                            }
                          } else if (formGroupDistribution === 'SEEDED') {
                            ordered.forEach((tId, idx) => {
                              const cyc = Math.floor(idx / effG);
                              const pos = idx % effG;
                              const gIdx = cyc % 2 === 0 ? pos : (effG - 1 - pos);
                              grpBuckets[gIdx].push(tId);
                            });
                          } else {
                            ordered.forEach((tId, idx) => { grpBuckets[idx % effG].push(tId); });
                          }

                          const assignTeamToGroup = (teamId: string, targetKey: string | null) => {
                            const next: Record<string, string[]> = {};
                            groupKeys.forEach((gk, gIdx) => {
                              next[gk] = grpBuckets[gIdx].filter(id => id !== teamId);
                            });
                            if (targetKey && next[targetKey]) {
                              next[targetKey].push(teamId);
                            }
                            setFormManualGroups(next);
                          };

                          const minSize = Math.min(...grpBuckets.map(b => b.length));
                          const qPerG = Math.max(1, parseInt(formQualifiersPerGroup, 10) || 1);
                          const bestRU = Math.max(0, parseInt(formBestRunnersUp, 10) || 0);
                          const totalQuals = effG * qPerG + bestRU;
                          const validationIssues: string[] = [];
                          if (unassignedIds.length > 0) validationIssues.push(`${unassignedIds.length} unassigned team(s)`);
                          if (minSize < 2) validationIssues.push('Each group needs ≥ 2 teams');
                          if (qPerG > minSize && minSize > 0) validationIssues.push(`Top ${qPerG}/group exceeds smallest group (${minSize})`);
                          if (totalQuals < 2) validationIssues.push('At least 2 total qualifiers needed for knockout');
                          if (totalQuals > n) validationIssues.push(`Total qualifiers (${totalQuals}) exceeds ${n} teams`);

                          const teamMapById: Record<string, string> = {};
                          [...dbTeams, ...approvedTeamsList].forEach((t: any) => { if (t?.id) teamMapById[t.id] = t.name; });
                          return (
                            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#FDE68A' }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                                <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#92400E' }}>
                                  Group Allocation Preview ({formGroupDistribution}):
                                </Text>
                                <View style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 3,
                                  borderRadius: 999,
                                  backgroundColor: validationIssues.length === 0 ? '#DCFCE7' : '#FEE2E2'
                                }}>
                                  <Text style={{ fontSize: 10.5, fontWeight: '800', color: validationIssues.length === 0 ? '#166534' : '#991B1B' }}>
                                    {validationIssues.length === 0
                                      ? `✓ Valid (${effG} Groups · ${totalQuals} Qualifiers)`
                                      : `⚠️ ${validationIssues.join(' · ')}`}
                                  </Text>
                                </View>
                              </View>
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {grpBuckets.map((bucket, gIdx) => {
                                  const mCount = Math.floor((bucket.length * (bucket.length - 1)) / 2);
                                  return (
                                    <View key={gIdx} style={{ flex: 1, minWidth: 150, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: bucket.length < 2 ? '#FCA5A5' : '#FDE68A' }}>
                                      <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#0F172A' }}>
                                        Group {String.fromCharCode(65 + gIdx)} ({bucket.length} Teams · {mCount} Matches)
                                      </Text>
                                      <Text style={{ fontSize: 10.5, color: '#475569', marginTop: 3 }} numberOfLines={3}>
                                        {bucket.length > 0 ? bucket.map(id => teamMapById[id] || id).join(', ') : 'No teams assigned'}
                                      </Text>
                                    </View>
                                  );
                                })}
                              </View>
                              {formGroupDistribution === 'MANUAL' && (
                                <View style={{ marginTop: 10, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#FDE68A', gap: 6 }}>
                                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#92400E' }}>
                                    Manual Team-to-Group Assignment (Move, Add, or Unassign):
                                  </Text>
                                  {unassignedIds.length > 0 && (
                                    <View style={{ backgroundColor: '#FEF2F2', borderRadius: 6, padding: 8, borderWidth: 1, borderColor: '#FECACA', gap: 4 }}>
                                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#991B1B' }}>
                                        Unassigned Teams ({unassignedIds.length}):
                                      </Text>
                                      {unassignedIds.map(uId => (
                                        <View key={uId} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#7F1D1D' }}>{teamMapById[uId] || uId}</Text>
                                          <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
                                            {groupKeys.map((gk, gIdx) => (
                                              <TouchableOpacity
                                                key={gk}
                                                onPress={() => assignTeamToGroup(uId, gk)}
                                                style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B' }}
                                              >
                                                <Text style={{ fontSize: 10, fontWeight: '800', color: '#92400E' }}>+ Grp {String.fromCharCode(65 + gIdx)}</Text>
                                              </TouchableOpacity>
                                            ))}
                                          </View>
                                        </View>
                                      ))}
                                    </View>
                                  )}
                                  {ordered.filter(id => !unassignedIds.includes(id)).map(tId => {
                                    const currentIdx = grpBuckets.findIndex(b => b.includes(tId));
                                    return (
                                      <View key={tId} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#FEF3C7' }}>
                                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#0F172A', flex: 1, minWidth: 120 }}>
                                          {teamMapById[tId] || tId}
                                        </Text>
                                        <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
                                          {groupKeys.map((gk, gIdx) => {
                                            const active = currentIdx === gIdx;
                                            return (
                                              <TouchableOpacity
                                                key={gk}
                                                onPress={() => assignTeamToGroup(tId, gk)}
                                                style={{
                                                  paddingHorizontal: 8,
                                                  paddingVertical: 4,
                                                  borderRadius: 6,
                                                  backgroundColor: active ? '#F59E0B' : '#FFFBEB',
                                                  borderWidth: 1,
                                                  borderColor: active ? '#D97706' : '#FDE68A'
                                                }}
                                              >
                                                <Text style={{ fontSize: 10.5, fontWeight: '800', color: active ? '#FFFFFF' : '#92400E' }}>
                                                  Grp {String.fromCharCode(65 + gIdx)}
                                                </Text>
                                              </TouchableOpacity>
                                            );
                                          })}
                                          <TouchableOpacity
                                            onPress={() => assignTeamToGroup(tId, null)}
                                            style={{ paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' }}
                                          >
                                            <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#991B1B' }}>✕</Text>
                                          </TouchableOpacity>
                                        </View>
                                      </View>
                                    );
                                  })}
                                </View>
                              )}
                            </View>
                          );
                        })()}
                      </View>
                    );
                  })()}
                </View>
              )}
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.wizardFooter}>
              {wizardStep > 1 && (
                <TouchableOpacity
                  style={styles.btnSecondary}
                  onPress={() => setWizardStep((wizardStep - 1) as any)}
                >
                  <Text style={styles.btnSecondaryText}>← Back</Text>
                </TouchableOpacity>
              )}

              <View style={{ flex: 1 }} />

              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => setWizardOpen(false)}
              >
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>

              {wizardStep < 4 ? (
                <TouchableOpacity
                  style={styles.btnPrimary}
                  onPress={() => {
                    if (wizardStep === 1) handleProceedToStep2();
                    else if (wizardStep === 2) handleProceedToStep3();
                    else if (wizardStep === 3) handleProceedToStep4();
                  }}
                >
                  <Text style={styles.btnPrimaryText}>Continue →</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.btnSaveGold}
                  onPress={handleSubmitTournament}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#020612" />
                  ) : (
                    <Text style={styles.btnSaveGoldText}>
                      {isEditMode ? '💾 Save Changes' : '🏆 Create Tournament'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL 2: TOURNAMENT DETAILS DASHBOARD                               */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Modal visible={detailsModalOpen} transparent animationType="slide">
        <View style={[styles.modalOverlay, isMobile && { padding: 8 }]}>
          <View style={[styles.detailsModalCard, isMobile && { maxWidth: '100%', maxHeight: '95%', borderRadius: 12 }]}>
            {detailsLoading || !selectedTournament ? (
              <View style={[styles.centerLoading, { height: 400 }]}>
                <ActivityIndicator size="large" color="#d4af37" />
                <Text style={styles.loadingText}>Loading Championship Central Dashboard...</Text>
              </View>
            ) : (
              <>
                {/* ── ROYAL HEADER BANNER ─────────────────────────────────── */}
                <View style={[styles.detailsBanner, isMobile && { flexDirection: 'column', alignItems: 'stretch', padding: 14, gap: 12 }]}>
                  <View style={[styles.detailsBannerLeft, isMobile && { flex: 0, width: '100%', alignItems: 'flex-start' }]}>
                    <View style={[styles.detailsBannerLogo, isMobile && { width: 46, height: 46, borderRadius: 10 }]}>
                      {selectedTournament.logo_url ? (
                        <Image source={{ uri: selectedTournament.logo_url }} style={[styles.detailsLogoImg, isMobile && { width: 46, height: 46 }]} />
                      ) : (
                        <Text style={[styles.detailsLogoFallback, isMobile && { fontSize: 16 }]}>
                          {(selectedTournament.short_name || selectedTournament.name || 'TN').slice(0, 3).toUpperCase()}
                        </Text>
                      )}
                    </View>

                    <View style={{ flex: 1, minWidth: 0, marginLeft: isMobile ? 10 : 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={styles.bannerSeasonTag}>Season {selectedTournament.season || '2026'}</Text>
                        <Text style={styles.bannerCategoryTag}>{selectedTournament.category || 'Senior District'}</Text>
                        <View style={styles.statusBadgeOngoing}>
                          <Text style={[styles.statusBadgeText, { color: '#15803d' }]}>
                            {selectedTournament.status || 'ONGOING'}
                          </Text>
                        </View>
                      </View>

                      <Text style={[styles.detailsBannerTitle, isMobile && { fontSize: 16, lineHeight: 22 }]}>{selectedTournament.name}</Text>
                      <Text style={[styles.detailsBannerMeta, isMobile && { fontSize: 11, lineHeight: 16 }]}>
                        📍 {selectedTournament.venue || 'Kamarajar District Stadium'} • 📅 {selectedTournament.start_date} to {selectedTournament.end_date} • 🏏 {selectedTournament.match_format || 'T20'} ({selectedTournament.overs_per_match || 20} Overs)
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.detailsBannerActions, isMobile && { flexWrap: 'wrap', justifyContent: 'flex-start' }]}>
                    <TouchableOpacity
                      style={[styles.btnActionGold, { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#F59E0B' }]}
                      onPress={handlePreviewMatches}
                      disabled={backendPreviewLoading}
                    >
                      {backendPreviewLoading ? (
                        <ActivityIndicator size="small" color="#92400E" />
                      ) : (
                        <Text style={[styles.btnActionGoldText, { color: '#92400E' }]}>📋 Preview Fixtures</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.btnActionGold}
                      onPress={handleGenerateMatches}
                      disabled={generatingMatches}
                    >
                      {generatingMatches ? (
                        <ActivityIndicator size="small" color="#020612" />
                      ) : (
                        <Text style={styles.btnActionGoldText}>⚡ Generate Fixtures</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.btnActionSchedule}
                      onPress={() => {
                        setDetailsModalOpen(false);
                        if (onOpenScheduler) {
                          onOpenScheduler(selectedTournament);
                        }
                      }}
                    >
                      <Text style={styles.btnActionScheduleText}>📅 Open Scheduler</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.btnBannerClose}
                      onPress={() => setDetailsModalOpen(false)}
                    >
                      <Text style={{ fontSize: 18, color: '#ffffff' }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {backendPreviewData && (
                  <View style={{ backgroundColor: '#FFFBEB', borderBottomWidth: 1.5, borderBottomColor: '#F59E0B', paddingHorizontal: 20, paddingVertical: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <Text style={{ fontSize: 12.5, fontWeight: '900', color: '#92400E' }}>
                        📋 Backend Fixture Preview: {backendPreviewData.total_expected_matches ?? backendPreviewData.total_matches ?? 0} Expected Matches
                        {backendPreviewData.rounds ? ` · ${backendPreviewData.rounds} Rounds` : ''}
                        {backendPreviewData.byes_count ? ` · ${backendPreviewData.byes_count} Byes` : ''}
                        {backendPreviewData.qualifying_teams_count ? ` · ${backendPreviewData.qualifying_teams_count} Qualifiers` : ''}
                      </Text>
                      <TouchableOpacity onPress={() => setBackendPreviewData(null)}>
                        <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#92400E' }}>✕ Dismiss</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* ── DETAILS TABS BAR ────────────────────────────────────── */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ flexGrow: 0, backgroundColor: '#0a2540' }}
                  contentContainerStyle={styles.detailsTabsBar}
                >
                  {(() => {
                    const normType = normalizeTournamentType(selectedTournament.tournament_type, selectedTournament.format_config?.round_robin_type);
                    const hasGroups = normType === 'GROUP_KNOCKOUT';
                    const hasBracket = normType === 'SINGLE_ELIMINATION' || normType === 'GROUP_KNOCKOUT' || normType === 'LEAGUE_PLAYOFFS';
                    return [
                      { key: 'overview', label: '📊 Overview' },
                      { key: 'teams', label: `🛡️ Teams (${(selectedTournament.participating_teams || []).length})` },
                      ...(hasGroups ? [{ key: 'groups', label: '👥 Groups' }] : []),
                      { key: 'schedule', label: `📅 Fixtures (${(selectedTournament.matches || []).length})` },
                      { key: 'points', label: '🏆 Points Table' },
                      ...(hasBracket ? [{ key: 'bracket', label: normType === 'LEAGUE_PLAYOFFS' ? '🔥 Playoffs' : '🥊 Bracket' }] : []),
                      { key: 'stats', label: '📈 Statistics' },
                      { key: 'rules', label: '📜 Rules' }
                    ];
                  })().map(tab => {
                    const active = detailsTab === tab.key;
                    return (
                      <TouchableOpacity
                        key={tab.key}
                        style={[styles.detailsTabBtn, active && styles.detailsTabBtnActive]}
                        onPress={() => setDetailsTab(tab.key as TournamentTab)}
                      >
                        <Text style={[styles.detailsTabText, active && styles.detailsTabTextActive]}>
                          {tab.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* ── DETAILS TAB CONTENT AREA ────────────────────────────── */}
                <ScrollView style={styles.detailsContentScroll} contentContainerStyle={{ padding: 20 }}>
                  {/* TAB 1: OVERVIEW */}
                  {detailsTab === 'overview' && (
                    <View style={{ gap: 20 }}>
                      {/* Metric summary boxes */}
                      <View style={styles.detailsSummaryGrid}>
                        <View style={styles.summaryBox}>
                          <Text style={styles.summaryBoxVal}>{(selectedTournament.participating_teams || []).length}</Text>
                          <Text style={styles.summaryBoxLabel}>Clubs Enrolled</Text>
                        </View>
                        <View style={styles.summaryBox}>
                          <Text style={styles.summaryBoxVal}>{(selectedTournament.matches || []).length}</Text>
                          <Text style={styles.summaryBoxLabel}>Total Fixtures</Text>
                        </View>
                        <View style={styles.summaryBox}>
                          <Text style={[styles.summaryBoxVal, { color: '#16a34a' }]}>
                            {(selectedTournament.matches || []).filter((m: any) => m.status === 'COMPLETED').length}
                          </Text>
                          <Text style={styles.summaryBoxLabel}>Completed Matches</Text>
                        </View>
                        <View style={styles.summaryBox}>
                          <Text style={[styles.summaryBoxVal, { color: '#0284c7' }]}>
                            {(selectedTournament.matches || []).filter((m: any) => m.status === 'SCHEDULED').length}
                          </Text>
                          <Text style={styles.summaryBoxLabel}>Upcoming Fixtures</Text>
                        </View>
                      </View>

                      {/* Description & Rules Summary */}
                      <View style={styles.cardSection}>
                        <Text style={styles.cardSectionTitle}>Championship Summary</Text>
                        <Text style={styles.cardSectionText}>
                          {selectedTournament.description || 'No description provided.'}
                        </Text>
                      </View>

                      <View style={styles.cardSection}>
                        <Text style={styles.cardSectionTitle}>Rules Summary</Text>
                        <View style={styles.rulesGrid}>
                          <View style={styles.ruleItem}>
                            <Text style={styles.ruleItemLabel}>• Match Format:</Text>
                            <Text style={styles.ruleItemVal}>{selectedTournament.match_format || 'T20'} ({selectedTournament.overs_per_match || 20} Overs)</Text>
                          </View>
                          <View style={styles.ruleItem}>
                            <Text style={styles.ruleItemLabel}>• Points for Win:</Text>
                            <Text style={styles.ruleItemVal}>{selectedTournament.points_win || 2} Points</Text>
                          </View>
                          <View style={styles.ruleItem}>
                            <Text style={styles.ruleItemLabel}>• Points for Tie / NR:</Text>
                            <Text style={styles.ruleItemVal}>{selectedTournament.points_tie || 1} / {selectedTournament.points_no_result || 1} Pt</Text>
                          </View>
                          <View style={styles.ruleItem}>
                            <Text style={styles.ruleItemLabel}>• Playing XI Size:</Text>
                            <Text style={styles.ruleItemVal}>{selectedTournament.playing_xi_size || 11} Players</Text>
                          </View>
                          <View style={styles.ruleItem}>
                            <Text style={styles.ruleItemLabel}>• Super Over:</Text>
                            <Text style={styles.ruleItemVal}>{selectedTournament.allow_super_over ? 'Enabled' : 'Disabled'}</Text>
                          </View>
                          <View style={styles.ruleItem}>
                            <Text style={styles.ruleItemLabel}>• DLS Method:</Text>
                            <Text style={styles.ruleItemVal}>{selectedTournament.allow_dls ? 'Enabled' : 'Disabled'}</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* TAB 2: TEAMS */}
                  {detailsTab === 'teams' && (
                    <View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <Text style={styles.cardSectionTitle}>Participating Clubs & Squads</Text>
                        <Text style={styles.sectionSub}>Total: {(selectedTournament.participating_teams || []).length} Teams</Text>
                      </View>

                      <View style={styles.teamsGridDetails}>
                        {(selectedTournament.participating_teams || []).map((tm: any, idx: number) => (
                          <View key={tm.id || idx} style={styles.teamDetailsCard}>
                            <View style={styles.teamCardAvatar}>
                              <Text style={styles.teamCardAvatarText}>
                                {(tm.name || 'TM').slice(0, 2).toUpperCase()}
                              </Text>
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={styles.teamCardName}>{tm.name}</Text>
                              <Text style={styles.teamCardCoach}>Coach: {tm.coach_name || 'Official'} ({tm.coach_email || '—'})</Text>
                              <Text style={styles.teamCardTaluk}>Taluk: {tm.city || tm.taluk || 'Virudhunagar'}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* TAB 2B: GROUPS (GROUP_KNOCKOUT) */}
                  {detailsTab === 'groups' && (
                    <View style={{ gap: 14 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <View>
                          <Text style={styles.cardSectionTitle}>Group Allocation &amp; Qualification Rules</Text>
                          <Text style={styles.sectionSub}>
                            Distribution: {selectedTournament.format_config?.group_distribution || 'BALANCED'} • Top {selectedTournament.format_config?.qualifiers_per_group || 1}/Group
                            {Number(selectedTournament.format_config?.best_runners_up_count || 0) > 0
                              ? ` + ${selectedTournament.format_config.best_runners_up_count} Best Runners-Up`
                              : ''}
                          </Text>
                        </View>
                        <TouchableOpacity style={styles.btnSmallRefresh} onPress={refreshTournamentDetails}>
                          <Text style={styles.btnSmallRefreshText}>🔄 Refresh</Text>
                        </TouchableOpacity>
                      </View>

                      {groupPointsLoading ? (
                        <ActivityIndicator size="large" color="#f59e0b" />
                      ) : groupPointsError ? (
                        <View style={styles.emptyStateCard}>
                          <Text style={styles.emptyStateTitle}>Unable to Load Groups</Text>
                          <Text style={styles.emptyStateSub}>{groupPointsError}</Text>
                        </View>
                      ) : (selectedTournament.format_config?.groups_snapshot || []).length === 0 ? (
                        <View style={{ gap: 12 }}>
                          {(selectedTournament.matches || []).length === 0 && (
                            <View style={{ backgroundColor: '#FFFBEB', borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: '#F59E0B', gap: 10 }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 13.5, fontWeight: '900', color: '#92400E' }}>
                                    Pre-Generation Group Controls
                                  </Text>
                                  <Text style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                                    Review backend fixture preview or edit team-to-group assignments before generating fixtures.
                                  </Text>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                                  <TouchableOpacity
                                    style={[styles.btnSmallRefresh, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}
                                    onPress={handlePreviewMatches}
                                  >
                                    <Text style={[styles.btnSmallRefreshText, { color: '#92400E' }]}>📋 Preview Groups</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[styles.btnSmallRefresh, { backgroundColor: '#0A2540', borderColor: '#0A2540' }]}
                                    onPress={() => {
                                      setDetailsModalOpen(false);
                                      handleOpenEditWizard(selectedTournament);
                                      setWizardStep(4);
                                    }}
                                  >
                                    <Text style={[styles.btnSmallRefreshText, { color: '#FFFFFF' }]}>✏️ Edit Group Assignments</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                              {backendPreviewData && Array.isArray(backendPreviewData.groups) && (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
                                  {backendPreviewData.groups.map((grp: any) => (
                                    <View key={grp.key} style={{ flex: 1, minWidth: 180, backgroundColor: '#FFFFFF', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#FDE68A' }}>
                                      <Text style={{ fontSize: 13, fontWeight: '900', color: '#92400E' }}>
                                        {grp.label || grp.key} ({grp.teamCount} Teams · {grp.matchesPerGroup} Matches)
                                      </Text>
                                      {(grp.teams || []).map((tm: any, idx: number) => (
                                        <Text key={tm.id || idx} style={{ fontSize: 11.5, color: '#0F172A', marginTop: 3 }}>
                                          {idx + 1}. {tm.name || tm.id}
                                        </Text>
                                      ))}
                                    </View>
                                  ))}
                                </View>
                              )}
                            </View>
                          )}
                          <View style={styles.emptyStateCard}>
                            <Text style={{ fontSize: 32, marginBottom: 8 }}>👥</Text>
                            <Text style={styles.emptyStateTitle}>No Group Allocation Generated Yet</Text>
                            <Text style={styles.emptyStateSub}>Click '⚡ Generate Fixtures' above to allocate teams into groups.</Text>
                          </View>
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                          {(selectedTournament.format_config?.groups_snapshot || []).map((grp: any) => {
                            const teamNameMap: Record<string, string> = {};
                            (selectedTournament.participating_teams || []).forEach((pt: any) => {
                              teamNameMap[pt.id] = pt.name;
                            });
                            const grpMatchCount = (selectedTournament.matches || []).filter((m: any) => m.group_key === grp.key || m.stage === grp.key).length;
                            return (
                              <View key={grp.key} style={{ flex: 1, minWidth: 220, backgroundColor: '#FFFBEB', borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: '#FDE68A' }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                  <Text style={{ fontSize: 15, fontWeight: '900', color: '#92400E' }}>{grp.label || grp.key}</Text>
                                  <View style={{ backgroundColor: '#F59E0B', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                                    <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#FFFFFF' }}>
                                      {(grp.teams || []).length} Teams · {grpMatchCount} Matches
                                    </Text>
                                  </View>
                                </View>
                                {(grp.teams || []).map((tId: string, idx: number) => (
                                  <Text key={tId} style={{ fontSize: 12.5, fontWeight: '700', color: '#0F172A', paddingVertical: 3 }}>
                                    {idx + 1}. {teamNameMap[tId] || tId}
                                  </Text>
                                ))}
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  )}

                  {/* TAB 3: SCHEDULE & MATCHES */}
                  {detailsTab === 'schedule' && (
                    <View>
                      {/* Filter Bar */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          {(['ALL', 'SCHEDULED', 'LIVE', 'COMPLETED'] as any[]).map(st => (
                            <TouchableOpacity
                              key={st}
                              style={[styles.smallFilterPill, matchStatusFilter === st && styles.smallFilterPillActive]}
                              onPress={() => setMatchStatusFilter(st)}
                            >
                              <Text style={[styles.smallFilterPillText, matchStatusFilter === st && styles.smallFilterPillTextActive]}>
                                {st}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <TouchableOpacity
                          style={styles.btnActionGoldSmall}
                          onPress={() => {
                            setDetailsModalOpen(false);
                            if (onOpenScheduler) onOpenScheduler(selectedTournament);
                          }}
                        >
                          <Text style={styles.btnActionGoldSmallText}>➕ Schedule in Scheduler</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Group-wise Fixture Filter */}
                      {(() => {
                        const groupKeys = Array.from(new Set(
                          (selectedTournament.matches || [])
                            .map((m: any) => m.group_key || (String(m.stage || '').startsWith('GROUP_') ? m.stage : null))
                            .filter(Boolean)
                        )) as string[];
                        if (groupKeys.length === 0) return null;
                        return (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                            {['ALL', ...groupKeys.sort(), 'KNOCKOUT'].map(gk => (
                              <TouchableOpacity
                                key={gk}
                                style={[
                                  styles.smallFilterPill,
                                  matchGroupFilter === gk && { backgroundColor: '#FFFBEB', borderColor: '#F59E0B' }
                                ]}
                                onPress={() => setMatchGroupFilter(gk)}
                              >
                                <Text style={[
                                  styles.smallFilterPillText,
                                  matchGroupFilter === gk && { color: '#92400E', fontWeight: '800' }
                                ]}>
                                  {gk === 'ALL' ? 'All Groups' : gk.replace('_', ' ')}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        );
                      })()}

                      {/* Matches Cards */}
                      {(selectedTournament.matches || []).length === 0 ? (
                        <View style={styles.emptyStateCard}>
                          <Text style={{ fontSize: 32, marginBottom: 8 }}>📅</Text>
                          <Text style={styles.emptyStateTitle}>No Matches Generated</Text>
                          <Text style={styles.emptyStateSub}>
                            Click the '⚡ Generate Fixtures' button above to automatically create match pairings based on the format.
                          </Text>
                        </View>
                      ) : (
                        <View style={{ gap: 12 }}>
                          {(selectedTournament.matches || [])
                            .filter((m: any) => matchStatusFilter === 'ALL' || (m.status || '').toUpperCase() === matchStatusFilter)
                            .filter((m: any) => {
                              if (matchGroupFilter === 'ALL') return true;
                              const gKey = m.group_key || (String(m.stage || '').startsWith('GROUP_') ? m.stage : null);
                              if (matchGroupFilter === 'KNOCKOUT') return !gKey;
                              return gKey === matchGroupFilter;
                            })
                            .map((m: any) => (
                              <View key={m.id} style={styles.matchDetailCard}>
                                <View style={styles.matchDetailHeader}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Text style={styles.matchIdTag}>{m.id}</Text>
                                    <Text style={styles.matchStageTag}>{m.stage || 'LEAGUE'}</Text>
                                  </View>
                                  <View
                                    style={[
                                      styles.statusBadge,
                                      m.status === 'COMPLETED' && styles.statusBadgeCompleted,
                                      m.status === 'LIVE' && styles.statusBadgeOngoing,
                                      m.status === 'SCHEDULED' && styles.statusBadgeUpcoming
                                    ]}
                                  >
                                    <Text style={styles.statusBadgeText}>{m.status}</Text>
                                  </View>
                                </View>

                                {/* Teams vs */}
                                <View style={styles.matchTeamsRow}>
                                  <Text style={styles.matchTeamTitle}>{m.team_a_name || m.team_a_id}</Text>
                                  <Text style={styles.matchVsText}>VS</Text>
                                  <Text style={styles.matchTeamTitle}>{m.team_b_name || m.team_b_id}</Text>
                                </View>

                                {/* Match Date / Venue / Officials */}
                                <View style={styles.matchMetaRow}>
                                  <Text style={styles.matchMetaText}>📅 {m.match_date} at {m.match_time || '09:30 AM'}</Text>
                                  <TouchableOpacity
                                    onPress={() => {
                                      const mapUrl = m.venue_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((m.venue || 'Kamarajar District Stadium') + ', Virudhunagar')}`;
                                      if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(mapUrl, '_blank');
                                      else Linking.openURL(mapUrl).catch(() => { });
                                    }}
                                  >
                                    <Text style={[styles.matchMetaText, { color: '#0284c7', textDecorationLine: 'underline' }]}>📍 {m.venue} ↗</Text>
                                  </TouchableOpacity>
                                  <Text style={styles.matchMetaText}>⚖️ Umpire: {m.umpire1_name || 'Appointed Official'}</Text>
                                </View>

                                {m.result_summary && (
                                  <View style={styles.matchResultBanner}>
                                    <Text style={styles.matchResultText}>🏆 Result: {m.result_summary}</Text>
                                  </View>
                                )}

                                <View style={styles.matchActionFooter}>
                                  <TouchableOpacity
                                    style={styles.btnSmallSchedule}
                                    onPress={() => {
                                      setDetailsModalOpen(false);
                                      if (onOpenScheduler) onOpenScheduler(selectedTournament, m);
                                    }}
                                  >
                                    <Text style={styles.btnSmallScheduleText}>📅 Edit in Scheduler</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            ))}
                        </View>
                      )}
                    </View>
                  )}

                  {/* TAB 4: POINTS TABLE */}
                  {detailsTab === 'points' && (
                    <View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <View>
                          <Text style={styles.cardSectionTitle}>Official League Points Table</Text>
                          <Text style={styles.sectionSub}>Calculated live from official completed match results and certified innings in MongoDB.</Text>
                        </View>
                        <TouchableOpacity style={styles.btnSmallRefresh} onPress={refreshTournamentDetails}>
                          <Text style={styles.btnSmallRefreshText}>🔄 Refresh Table</Text>
                        </TouchableOpacity>
                      </View>

                      {groupPointsLoading ? (
                        <ActivityIndicator size="large" color="#f59e0b" />
                      ) : (normalizeTournamentType(selectedTournament.tournament_type) === 'GROUP_KNOCKOUT' && groupPointsData?.groups && Object.keys(groupPointsData.groups).length > 0) ? (
                        <View style={{ gap: 16 }}>
                          {/* Unresolved Tie Banner */}
                          {(groupPointsData.unresolved_ties || []).length > 0 && (
                            <View style={{ padding: 14, borderRadius: 12, backgroundColor: '#FEF2F2', borderWidth: 1.5, borderColor: '#EF4444' }}>
                              <Text style={{ fontSize: 13.5, fontWeight: '900', color: '#991B1B' }}>
                                ⚠️ Unresolved Qualification Tie Detected
                              </Text>
                              {(groupPointsData.unresolved_ties || []).map((tie: any, tIdx: number) => (
                                <View key={tIdx} style={{ marginTop: 6 }}>
                                  <Text style={{ fontSize: 12, color: '#7F1D1D', fontWeight: '700' }}>• {tie.reason}</Text>
                                  {Array.isArray(tie.teams) && tie.teams.length >= 2 && (
                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                                      <TouchableOpacity
                                        style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#F59E0B' }}
                                        onPress={async () => {
                                          try {
                                            await ScorerApi.resolveTournamentTie(selectedTournament.id, tie.teams);
                                            await refreshTournamentDetails();
                                          } catch (e: any) {
                                            await showError('Tie Resolution Error', e?.message || 'Failed to resolve tie.');
                                          }
                                        }}
                                      >
                                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF' }}>
                                          Advance {tie.teams[0]} Over {tie.teams[1]}
                                        </Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#0A2540' }}
                                        onPress={async () => {
                                          try {
                                            await ScorerApi.resolveTournamentTie(selectedTournament.id, [...tie.teams].reverse());
                                            await refreshTournamentDetails();
                                          } catch (e: any) {
                                            await showError('Tie Resolution Error', e?.message || 'Failed to resolve tie.');
                                          }
                                        }}
                                      >
                                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF' }}>
                                          Advance {tie.teams[1]} Over {tie.teams[0]}
                                        </Text>
                                      </TouchableOpacity>
                                    </View>
                                  )}
                                </View>
                              ))}
                            </View>
                          )}

                          {/* Separate Points Table Per Group */}
                          {Object.entries(groupPointsData.groups).map(([grpKey, grpRows]: [string, any]) => {
                            const qualifiedIds = new Set((groupPointsData.qualifiers || []).map((q: any) => q.team_id));
                            return (
                              <View key={grpKey} style={styles.tableCard}>
                                <View style={{ paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#FFFBEB', borderBottomWidth: 1, borderBottomColor: '#FDE68A' }}>
                                  <Text style={{ fontSize: 14, fontWeight: '900', color: '#92400E' }}>
                                    {grpKey.replace(/_/g, ' ')} Standings
                                  </Text>
                                </View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                                  <View style={{ minWidth: 620, width: '100%' }}>
                                    <View style={styles.tableHeaderRow}>
                                      <Text style={[styles.thCell, { width: 44, textAlign: 'center' }]}>POS</Text>
                                      <Text style={[styles.thCell, { flex: 2, minWidth: 140 }]}>TEAM</Text>
                                      <Text style={[styles.thCell, { width: 38, textAlign: 'center' }]}>P</Text>
                                      <Text style={[styles.thCell, { width: 38, textAlign: 'center' }]}>W</Text>
                                      <Text style={[styles.thCell, { width: 38, textAlign: 'center' }]}>L</Text>
                                      <Text style={[styles.thCell, { width: 38, textAlign: 'center' }]}>T</Text>
                                      <Text style={[styles.thCell, { width: 38, textAlign: 'center' }]}>NR</Text>
                                      <Text style={[styles.thCell, { width: 48, textAlign: 'center', color: '#020612', fontWeight: '800' }]}>PTS</Text>
                                      <Text style={[styles.thCell, { width: 72, textAlign: 'center' }]}>NRR</Text>
                                    </View>
                                    {(grpRows || []).map((row: any, idx: number) => {
                                      const isQual = qualifiedIds.has(row.team_id);
                                      return (
                                        <View key={row.team_id || idx} style={[styles.tableDataRow, isQual && styles.tableRowTopZone, idx % 2 === 1 && styles.tableRowAlt]}>
                                          <View style={[styles.posBadge, isQual && styles.posBadgeTop]}>
                                            <Text style={[styles.posBadgeText, isQual && styles.posBadgeTextTop]}>{row.position}</Text>
                                          </View>
                                          <View style={{ flex: 2, minWidth: 140, paddingLeft: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={styles.tableTeamName} numberOfLines={1}>{row.team_name}</Text>
                                            {isQual && (
                                              <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                                                <Text style={{ fontSize: 9.5, fontWeight: '900', color: '#166534' }}>Q</Text>
                                              </View>
                                            )}
                                          </View>
                                          <Text style={[styles.tdCell, { width: 38, textAlign: 'center' }]}>{row.played}</Text>
                                          <Text style={[styles.tdCell, { width: 38, textAlign: 'center', color: '#16a34a', fontWeight: '700' }]}>{row.won}</Text>
                                          <Text style={[styles.tdCell, { width: 38, textAlign: 'center', color: '#dc2626' }]}>{row.lost}</Text>
                                          <Text style={[styles.tdCell, { width: 38, textAlign: 'center' }]}>{row.tied}</Text>
                                          <Text style={[styles.tdCell, { width: 38, textAlign: 'center' }]}>{row.no_result}</Text>
                                          <Text style={[styles.tdCell, { width: 48, textAlign: 'center', fontWeight: '800', color: '#020612' }]}>{row.points}</Text>
                                          <Text style={[styles.tdCell, { width: 72, textAlign: 'center', fontWeight: '600' }]}>{row.nrr_formatted || row.nrr}</Text>
                                        </View>
                                      );
                                    })}
                                  </View>
                                </ScrollView>
                              </View>
                            );
                          })}
                        </View>
                      ) : (selectedTournament.points_table || []).length === 0 ? (
                        <View style={styles.emptyStateCard}>
                          <Text style={{ fontSize: 32, marginBottom: 8 }}>📊</Text>
                          <Text style={styles.emptyStateTitle}>Points Table Empty</Text>
                          <Text style={styles.emptyStateSub}>Standings will update automatically as tournament matches are completed and scored.</Text>
                        </View>
                      ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ width: '100%' }}>
                          <View style={[styles.tableCard, { minWidth: 620 }]}>
                            {/* Table Header */}
                            <View style={styles.tableHeaderRow}>
                              <Text style={[styles.thCell, { width: 44, textAlign: 'center' }]}>POS</Text>
                              <Text style={[styles.thCell, { width: 150, minWidth: 150 }]}>TEAM</Text>
                              <Text style={[styles.thCell, { width: 40, textAlign: 'center' }]}>P</Text>
                              <Text style={[styles.thCell, { width: 40, textAlign: 'center' }]}>W</Text>
                              <Text style={[styles.thCell, { width: 40, textAlign: 'center' }]}>L</Text>
                              <Text style={[styles.thCell, { width: 40, textAlign: 'center' }]}>T</Text>
                              <Text style={[styles.thCell, { width: 40, textAlign: 'center' }]}>NR</Text>
                              <Text style={[styles.thCell, { width: 50, textAlign: 'center', color: '#F59E0B', fontWeight: '800' }]}>PTS</Text>
                              <Text style={[styles.thCell, { width: 75, textAlign: 'center' }]}>NRR</Text>
                              <Text style={[styles.thCell, { width: 95, textAlign: 'center' }]}>LAST 5</Text>
                            </View>

                            {/* Table Rows */}
                            {selectedTournament.points_table.map((row: any, idx: number) => {
                              const isTopZone = row.position <= 2;
                              return (
                                <View
                                  key={row.team_id || idx}
                                  style={[
                                    styles.tableDataRow,
                                    isTopZone && styles.tableRowTopZone,
                                    idx % 2 === 1 && styles.tableRowAlt
                                  ]}
                                >
                                  <View style={[styles.posBadge, isTopZone && styles.posBadgeTop]}>
                                    <Text style={[styles.posBadgeText, isTopZone && styles.posBadgeTextTop]}>
                                      {row.position}
                                    </Text>
                                  </View>

                                  <View style={{ width: 150, minWidth: 150, paddingLeft: 8 }}>
                                    <Text style={styles.tableTeamName} numberOfLines={2}>{row.team_name}</Text>
                                  </View>

                                  <Text style={[styles.tdCell, { width: 40, textAlign: 'center' }]}>{row.played}</Text>
                                  <Text style={[styles.tdCell, { width: 40, textAlign: 'center', color: '#16a34a', fontWeight: '700' }]}>{row.won}</Text>
                                  <Text style={[styles.tdCell, { width: 40, textAlign: 'center', color: '#dc2626' }]}>{row.lost}</Text>
                                  <Text style={[styles.tdCell, { width: 40, textAlign: 'center' }]}>{row.tied}</Text>
                                  <Text style={[styles.tdCell, { width: 40, textAlign: 'center' }]}>{row.no_result}</Text>
                                  <Text style={[styles.tdCell, { width: 50, textAlign: 'center', fontWeight: '800', color: '#020612', fontSize: 14 }]}>
                                    {row.points}
                                  </Text>
                                  <Text style={[styles.tdCell, { width: 75, textAlign: 'center', fontWeight: '600' }]}>
                                    {row.nrr_formatted || row.nrr}
                                  </Text>

                                  {/* Form Guide (W, L, T, NR) */}
                                  <View style={{ width: 95, flexDirection: 'row', justifyContent: 'center', gap: 3 }}>
                                    {(row.recent_form || []).map((f: string, fIdx: number) => (
                                      <View
                                        key={fIdx}
                                        style={[
                                          styles.formPill,
                                          f === 'W' && styles.formPillWin,
                                          f === 'L' && styles.formPillLoss,
                                          f === 'T' && styles.formPillTie,
                                          f === 'NR' && styles.formPillNR
                                        ]}
                                      >
                                        <Text style={styles.formPillText}>{f}</Text>
                                      </View>
                                    ))}
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        </ScrollView>
                      )}
                    </View>
                  )}

                  {/* TAB 4B: BRACKET / IPL PLAYOFFS */}
                  {detailsTab === 'bracket' && (() => {
                    const normType = normalizeTournamentType(selectedTournament.tournament_type, selectedTournament.format_config?.round_robin_type);
                    const matchesList = selectedTournament.matches || [];
                    const byesList = selectedTournament.format_config?.byes || [];

                    const renderBracketMatchCard = (m: any, placeholderLabel?: string) => (
                      <View
                        key={m?.id || placeholderLabel}
                        style={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: 10,
                          padding: 12,
                          borderWidth: 1.5,
                          borderColor: m?.status === 'COMPLETED' ? '#10B981' : (m?.status === 'LIVE' ? '#F59E0B' : '#E2E8F0'),
                          minWidth: 210
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#92400E' }}>
                            {m ? (m.stage || 'KNOCKOUT').replace(/_/g, ' ') : placeholderLabel}
                          </Text>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: m?.status === 'COMPLETED' ? '#16A34A' : '#64748B' }}>
                            {m ? m.status : 'AWAITING'}
                          </Text>
                        </View>
                        {m ? (
                          <>
                            <Text style={{ fontSize: 13, fontWeight: m.winner_id === m.team_a_id ? '900' : '700', color: '#0F172A' }}>
                              {m.winner_id === m.team_a_id ? '🏆 ' : ''}{m.team_a_name || m.team_a_id}
                            </Text>
                            <Text style={{ fontSize: 10.5, color: '#94A3B8', fontWeight: '700', marginVertical: 2 }}>VS</Text>
                            <Text style={{ fontSize: 13, fontWeight: m.winner_id === m.team_b_id ? '900' : '700', color: '#0F172A' }}>
                              {m.winner_id === m.team_b_id ? '🏆 ' : ''}{m.team_b_name || m.team_b_id}
                            </Text>
                            {m.result_summary ? (
                              <Text style={{ fontSize: 11, color: '#065F46', fontWeight: '700', marginTop: 6 }}>
                                {m.result_summary}
                              </Text>
                            ) : null}
                          </>
                        ) : (
                          <Text style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>
                            Participants will populate automatically once previous stage completes.
                          </Text>
                        )}
                      </View>
                    );

                    if (normType === 'LEAGUE_PLAYOFFS') {
                      const q1 = matchesList.find((m: any) => m.stage === 'QUALIFIER_1');
                      const elim = matchesList.find((m: any) => m.stage === 'ELIMINATOR');
                      const q2 = matchesList.find((m: any) => m.stage === 'QUALIFIER_2');
                      const fin = matchesList.find((m: any) => m.stage === 'FINAL');
                      return (
                        <View style={{ gap: 16 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            <Text style={styles.cardSectionTitle}>🔥 IPL-Style Playoff Progression</Text>
                            <TouchableOpacity style={styles.btnSmallRefresh} onPress={refreshTournamentDetails}>
                              <Text style={styles.btnSmallRefreshText}>🔄 Refresh</Text>
                            </TouchableOpacity>
                          </View>

                          {selectedTournament.winner_team_name ? (
                            <View style={{ padding: 14, borderRadius: 12, backgroundColor: '#FFFBEB', borderWidth: 1.5, borderColor: '#F59E0B' }}>
                              <Text style={{ fontSize: 15, fontWeight: '900', color: '#92400E' }}>
                                🏆 Champion: {selectedTournament.winner_team_name}
                              </Text>
                              {selectedTournament.runner_up_team_name ? (
                                <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#475569', marginTop: 2 }}>
                                  🥈 Runner-Up: {selectedTournament.runner_up_team_name}
                                </Text>
                              ) : null}
                            </View>
                          ) : null}

                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'center', paddingVertical: 6 }}>
                            <View style={{ gap: 12 }}>
                              <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B' }}>PLAYOFF ROUND 1</Text>
                              {renderBracketMatchCard(q1, 'QUALIFIER 1 (Rank 1 vs Rank 2)')}
                              {renderBracketMatchCard(elim, 'ELIMINATOR (Rank 3 vs Rank 4)')}
                            </View>
                            <Text style={{ fontSize: 20, color: '#F59E0B', fontWeight: '900' }}>→</Text>
                            <View style={{ gap: 12 }}>
                              <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B' }}>PLAYOFF ROUND 2</Text>
                              {renderBracketMatchCard(q2, 'QUALIFIER 2 (Loser Q1 vs Winner Elim)')}
                            </View>
                            <Text style={{ fontSize: 20, color: '#F59E0B', fontWeight: '900' }}>→</Text>
                            <View style={{ gap: 12 }}>
                              <Text style={{ fontSize: 11, fontWeight: '800', color: '#92400E' }}>🏆 GRAND FINAL</Text>
                              {renderBracketMatchCard(fin, 'FINAL (Winner Q1 vs Winner Q2)')}
                            </View>
                          </View>
                        </View>
                      );
                    }

                    // Knockout Bracket (SINGLE_ELIMINATION / GROUP_KNOCKOUT)
                    const koMatches = matchesList.filter((m: any) => !String(m.stage || '').startsWith('GROUP_') && !String(m.stage || '').startsWith('LEAGUE_'));
                    const roundsMap: Record<number, any[]> = {};
                    koMatches.forEach((m: any) => {
                      const r = Number(m.round_number || 1);
                      if (!roundsMap[r]) roundsMap[r] = [];
                      roundsMap[r].push(m);
                    });
                    const roundNums = Object.keys(roundsMap).map(Number).sort((a, b) => a - b);

                    return (
                      <View style={{ gap: 16 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                          <Text style={styles.cardSectionTitle}>🥊 Knockout Bracket &amp; Progression</Text>
                          <TouchableOpacity style={styles.btnSmallRefresh} onPress={refreshTournamentDetails}>
                            <Text style={styles.btnSmallRefreshText}>🔄 Refresh</Text>
                          </TouchableOpacity>
                        </View>

                        {selectedTournament.winner_team_name ? (
                          <View style={{ padding: 14, borderRadius: 12, backgroundColor: '#FFFBEB', borderWidth: 1.5, borderColor: '#F59E0B' }}>
                            <Text style={{ fontSize: 15, fontWeight: '900', color: '#92400E' }}>
                              🏆 Champion: {selectedTournament.winner_team_name}
                            </Text>
                            {selectedTournament.runner_up_team_name ? (
                              <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#475569', marginTop: 2 }}>
                                🥈 Runner-Up: {selectedTournament.runner_up_team_name}
                              </Text>
                            ) : null}
                          </View>
                        ) : null}

                        {byesList.length > 0 && (
                          <View style={{ padding: 10, borderRadius: 10, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' }}>
                            <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#92400E' }}>
                              ⚡ Round-1 Byes ({byesList.length}): {byesList.map((b: any) => {
                                const pt = (selectedTournament.participating_teams || []).find((t: any) => t.id === b.team_id);
                                return pt?.name || b.team_id;
                              }).join(', ')}
                            </Text>
                          </View>
                        )}

                        {roundNums.length === 0 ? (
                          <View style={styles.emptyStateCard}>
                            <Text style={{ fontSize: 32, marginBottom: 8 }}>🥊</Text>
                            <Text style={styles.emptyStateTitle}>Knockout Bracket Pending</Text>
                            <Text style={styles.emptyStateSub}>
                              {normType === 'GROUP_KNOCKOUT'
                                ? 'Knockout matches will be generated automatically once all Group Stage matches are completed.'
                                : "Click '⚡ Generate Fixtures' above to initialize the Knockout bracket."}
                            </Text>
                          </View>
                        ) : (
                          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start', paddingVertical: 6 }}>
                              {roundNums.map((rNum, idx) => (
                                <React.Fragment key={rNum}>
                                  <View style={{ gap: 10 }}>
                                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B' }}>
                                      {(roundsMap[rNum][0]?.stage || `ROUND ${rNum}`).replace(/_/g, ' ')}
                                    </Text>
                                    {roundsMap[rNum].map((m: any) => renderBracketMatchCard(m))}
                                  </View>
                                  {idx < roundNums.length - 1 && (
                                    <Text style={{ fontSize: 20, color: '#F59E0B', fontWeight: '900', alignSelf: 'center' }}>→</Text>
                                  )}
                                </React.Fragment>
                              ))}
                            </View>
                          </ScrollView>
                        )}
                      </View>
                    );
                  })()}

                  {/* TAB 5: STATISTICS */}
                  {detailsTab === 'stats' && (
                    <View style={{ gap: 20 }}>
                      <Text style={styles.cardSectionTitle}>Championship Leaders & Performance Statistics</Text>

                      {/* Top Batters */}
                      <View style={styles.cardSection}>
                        <Text style={styles.statsTableHeading}>🏏 Leading Run Scorers (Orange Cap)</Text>
                        {selectedTournament.statistics?.top_batters?.length === 0 ? (
                          <Text style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>No batting innings recorded yet.</Text>
                        ) : (
                          <View style={{ marginTop: 8 }}>
                            {selectedTournament.statistics?.top_batters?.map((b: any, bIdx: number) => (
                              <View key={b.player_id || bIdx} style={styles.statsRow}>
                                <Text style={{ width: 28, fontWeight: '700', color: '#020612' }}>#{bIdx + 1}</Text>
                                <Text style={{ flex: 2, fontWeight: '700', color: '#0f172a' }}>{b.player_name}</Text>
                                <Text style={{ width: 70, textAlign: 'right', fontWeight: '800', color: '#d97706' }}>{b.runs} Runs</Text>
                                <Text style={{ width: 80, textAlign: 'right', color: '#64748b', fontSize: 12 }}>SR: {b.strike_rate}</Text>
                                <Text style={{ width: 60, textAlign: 'right', color: '#64748b', fontSize: 12 }}>{b.fours} 4s • {b.sixes} 6s</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>

                      {/* Top Bowlers */}
                      <View style={styles.cardSection}>
                        <Text style={styles.statsTableHeading}>🎯 Leading Wicket Takers (Purple Cap)</Text>
                        {selectedTournament.statistics?.top_bowlers?.length === 0 ? (
                          <Text style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>No bowling figures recorded yet.</Text>
                        ) : (
                          <View style={{ marginTop: 8 }}>
                            {selectedTournament.statistics?.top_bowlers?.map((bw: any, bwIdx: number) => (
                              <View key={bw.player_id || bwIdx} style={styles.statsRow}>
                                <Text style={{ width: 28, fontWeight: '700', color: '#020612' }}>#{bwIdx + 1}</Text>
                                <Text style={{ flex: 2, fontWeight: '700', color: '#0f172a' }}>{bw.player_name}</Text>
                                <Text style={{ width: 80, textAlign: 'right', fontWeight: '800', color: '#7c3aed' }}>{bw.wickets} Wickets</Text>
                                <Text style={{ width: 80, textAlign: 'right', color: '#64748b', fontSize: 12 }}>Econ: {bw.economy}</Text>
                                <Text style={{ width: 60, textAlign: 'right', color: '#64748b', fontSize: 12 }}>Best: {bw.best_bowling}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>

                      {/* Boundaries Banner */}
                      <View style={styles.boundariesBanner}>
                        <View style={styles.boundaryStatCol}>
                          <Text style={styles.boundaryVal}>{selectedTournament.statistics?.boundaries?.total_fours || 0}</Text>
                          <Text style={styles.boundaryLabel}>Total Fours (4s)</Text>
                        </View>
                        <View style={styles.boundaryStatCol}>
                          <Text style={[styles.boundaryVal, { color: '#e11d48' }]}>{selectedTournament.statistics?.boundaries?.total_sixes || 0}</Text>
                          <Text style={styles.boundaryLabel}>Total Sixes (6s)</Text>
                        </View>
                        <View style={styles.boundaryStatCol}>
                          <Text style={[styles.boundaryVal, { color: '#16a34a' }]}>{selectedTournament.statistics?.boundaries?.total_boundaries || 0}</Text>
                          <Text style={styles.boundaryLabel}>Total Boundaries</Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* TAB 6: RULES */}
                  {detailsTab === 'rules' && (
                    <View style={{ gap: 14 }}>
                      <Text style={styles.cardSectionTitle}>Official Playing Conditions &amp; Bowling Rules</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                        <View style={{ flex: 1, minWidth: 160, padding: 12, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>MAX OVERS / BOWLER</Text>
                          <Text style={{ fontSize: 16, fontWeight: '900', color: '#0F172A', marginTop: 4 }}>
                            {selectedTournament.playing_rules?.max_overs_per_bowler ?? Math.max(1, Math.ceil((selectedTournament.overs_per_match || 20) / 5))} Overs
                          </Text>
                        </View>
                        <View style={{
                          flex: 1,
                          minWidth: 160,
                          padding: 12,
                          borderRadius: 10,
                          backgroundColor: selectedTournament.playing_rules?.allow_chain_over ? '#ECFDF5' : '#F8FAFC',
                          borderWidth: 1,
                          borderColor: selectedTournament.playing_rules?.allow_chain_over ? '#A7F3D0' : '#E2E8F0'
                        }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>CHAIN OVER (CONSECUTIVE)</Text>
                          <Text style={{ fontSize: 15, fontWeight: '900', color: selectedTournament.playing_rules?.allow_chain_over ? '#065F46' : '#334155', marginTop: 4 }}>
                            {selectedTournament.playing_rules?.allow_chain_over ? '✓ Allowed (Same Bowler)' : '✕ Not Allowed (Standard)'}
                          </Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 160, padding: 12, borderRadius: 10, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#92400E' }}>POWERPLAY OVERS</Text>
                          <Text style={{ fontSize: 16, fontWeight: '900', color: '#78350F', marginTop: 4 }}>
                            {selectedTournament.playing_rules?.powerplay_overs ?? 5} Overs
                          </Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 160, padding: 12, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>FREE HIT &amp; TIE RULE</Text>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A', marginTop: 4 }}>
                            {selectedTournament.playing_rules?.free_hit_on_all_noballs !== false ? 'All No-Balls' : 'Overstep Only'} • {selectedTournament.playing_rules?.tie_handling === 'SUPER_OVER' ? 'Super Over' : 'Share Points'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.rulesTextBox}>
                        <Text style={styles.rulesContentText}>
                          {selectedTournament.rules || 'Standard ICC / TNCA Playing Conditions apply to all district matches.'}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* ADVANCED TABS: GROUPS / BRACKET / SIMULATOR */}
                  {(detailsTab === 'groups' || detailsTab === 'bracket' || detailsTab === 'simulator') && (
                    <TournamentAdvancedTabs
                      tournament={selectedTournament}
                      activeTab={detailsTab}
                      onRefresh={() => handleOpenDetails(selectedTournament)}
                    />
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL 3: REJECTION REASON PROMPT MODAL                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Modal visible={rejectModalOpen} transparent animationType="fade">
        <View style={styles.rejectModalOverlay}>
          <View style={styles.rejectModalCard}>
            <View style={styles.rejectModalHeader}>
              <View>
                <Text style={styles.rejectModalTitle}>❌ Reject Tournament Registration</Text>
                <Text style={styles.rejectModalSub}>
                  Club: {selectedRegForReject?.team_name || 'Team'} • Championship: {selectedRegForReject?.tournament_name || 'Tournament'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setRejectModalOpen(false)}
                style={{ padding: 4 }}
              >
                <Text style={{ fontSize: 18, color: '#64748b' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ padding: 20 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a', marginBottom: 6 }}>
                Reason for Rejection (Visible to Team / Coach):
              </Text>
              <TextInput
                style={styles.rejectInput}
                multiline
                numberOfLines={4}
                placeholder="State the official association reason for rejecting this tournament registration..."
                placeholderTextColor="#94a3b8"
                value={rejectionReasonText}
                onChangeText={setRejectionReasonText}
              />
              <Text style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                Note: The rejected club coach can view this reason and re-apply with corrected information if permitted.
              </Text>

              <View style={styles.rejectModalActions}>
                <TouchableOpacity
                  style={styles.btnRejectCancel}
                  onPress={() => setRejectModalOpen(false)}
                  disabled={rejectSubmitting}
                >
                  <Text style={styles.btnRejectCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.btnRejectConfirm}
                  onPress={handleConfirmReject}
                  disabled={rejectSubmitting}
                >
                  {rejectSubmitting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.btnRejectConfirmText}>Confirm Rejection</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL 4: VIEW TEAM DETAILS & PLAYERS ROSTER                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Modal
        visible={Boolean(viewTeamModal)}
        transparent
        animationType="fade"
        onRequestClose={() => setViewTeamModal(null)}
      >
        <View style={styles.rejectModalOverlay}>
          <View style={[styles.rejectModalCard, { maxWidth: 640, maxHeight: '88%' }]}>
            <View style={styles.rejectModalHeader}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.rejectModalTitle}>🛡️ {viewTeamModal?.teamName || 'Team Details'}</Text>
                <Text style={styles.rejectModalSub}>
                  ID: {viewTeamModal?.teamId || '—'} • 📍 {viewTeamModal?.city || 'Virudhunagar'} • 🏏 {viewTeamModal?.squadCount ?? 0} Players
                </Text>
              </View>
              <TouchableOpacity onPress={() => setViewTeamModal(null)} style={{ padding: 4 }}>
                <Text style={{ fontSize: 18, color: '#64748b' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator>
              {/* Summary Grid */}
              <View style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 10,
                backgroundColor: '#f8fafc',
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderRadius: 10,
                padding: 12,
                marginBottom: 14
              }}>
                <View style={{ flex: 1, minWidth: 130 }}>
                  <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Total Players</Text>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#059669', marginTop: 2 }}>
                    🏏 {viewTeamModal?.squadCount ?? 0} Players
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 140 }}>
                  <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Head Coach</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a', marginTop: 2 }}>
                    {viewTeamModal?.coachName || '—'}
                  </Text>
                  {Boolean(viewTeamModal?.coachEmail) && (
                    <Text style={{ fontSize: 11, color: '#475569' }}>{viewTeamModal.coachEmail}</Text>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 130 }}>
                  <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Team Captain</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a', marginTop: 2 }}>
                    👑 {viewTeamModal?.captain || '—'}
                  </Text>
                </View>
              </View>

              {/* Players List */}
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a', marginBottom: 8 }}>
                Registered Squad Roster ({viewTeamModal?.players?.length || 0})
              </Text>
              {viewTeamModal?.players && viewTeamModal.players.length > 0 ? (
                <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                  {viewTeamModal.players.map((p: any, i: number) => (
                    <View
                      key={p.id || i}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        backgroundColor: i % 2 === 1 ? '#f8fafc' : '#ffffff',
                        borderBottomWidth: i < viewTeamModal.players.length - 1 ? 1 : 0,
                        borderBottomColor: '#f1f5f9'
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 180 }}>
                        <View style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor: '#e0f2fe',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#0369a1' }}>
                            {p.jersey_number || i + 1}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>
                            {p.name || 'Player'} {p.is_captain ? '👑' : ''}
                          </Text>
                          {Boolean(p.email || p.mobile) && (
                            <Text style={{ fontSize: 11, color: '#64748b' }}>
                              {[p.email, p.mobile].filter(Boolean).join(' • ')}
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#b45309' }}>
                          {p.role || 'PLAYER'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={{ padding: 20, alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 10 }}>
                  <Text style={{ color: '#64748b', fontSize: 12.5 }}>No squad players registered for this team yet.</Text>
                </View>
              )}
            </ScrollView>

            <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: '#e2e8f0', alignItems: 'flex-end' }}>
              <TouchableOpacity
                style={styles.btnRejectCancel}
                onPress={() => setViewTeamModal(null)}
              >
                <Text style={styles.btnRejectCancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Season Year Picker Modal (Like input type="year") ── */}
      {showYearPicker && (
        <Modal
          transparent
          animationType="fade"
          visible={showYearPicker}
          onRequestClose={() => setShowYearPicker(false)}
        >
          <TouchableOpacity
            style={styles.yearPickerOverlay}
            activeOpacity={1}
            onPress={() => setShowYearPicker(false)}
          >
            <View
              style={styles.yearPickerCard}
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.yearPickerHeader}>
                <TouchableOpacity
                  style={styles.yearPickerNavBtn}
                  onPress={() => setPickerDecadeStart(pickerDecadeStart - 12)}
                >
                  <Ionicons name="chevron-back" size={16} color="#334155" />
                </TouchableOpacity>
                <Text style={styles.yearPickerTitle}>
                  {pickerDecadeStart} – {pickerDecadeStart + 11}
                </Text>
                <TouchableOpacity
                  style={styles.yearPickerNavBtn}
                  onPress={() => setPickerDecadeStart(pickerDecadeStart + 12)}
                >
                  <Ionicons name="chevron-forward" size={16} color="#334155" />
                </TouchableOpacity>
              </View>

              <View style={styles.yearPickerGrid}>
                {Array.from({ length: 12 }, (_, i) => pickerDecadeStart + i).map((yr) => {
                  const isSelected = String(yr) === String(formSeason);
                  const isCurrentYear = yr === new Date().getFullYear();
                  return (
                    <TouchableOpacity
                      key={yr}
                      style={[
                        styles.yearPickerCell,
                        isSelected && styles.yearPickerCellSelected,
                        isCurrentYear && !isSelected && styles.yearPickerCellCurrent
                      ]}
                      onPress={() => {
                        setFormSeason(String(yr));
                        setShowYearPicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.yearPickerCellText,
                          isSelected && styles.yearPickerCellTextSelected,
                          isCurrentYear && !isSelected && styles.yearPickerCellTextCurrent
                        ]}
                      >
                        {yr}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.yearPickerFooter}>
                <TouchableOpacity
                  style={styles.yearPickerQuickBtn}
                  onPress={() => {
                    const thisYr = new Date().getFullYear();
                    setFormSeason(String(thisYr));
                    setPickerDecadeStart(Math.floor(thisYr / 10) * 10);
                    setShowYearPicker(false);
                  }}
                >
                  <Text style={styles.yearPickerQuickText}>Current Year ({new Date().getFullYear()})</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.yearPickerCloseBtn}
                  onPress={() => setShowYearPicker(false)}
                >
                  <Text style={styles.yearPickerCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 5: GENERATE FIXTURES & MULTI-MATCH PER DAY SCHEDULE CONFIG
      ═══════════════════════════════════════════════════════════════════════ */}
      {genModalOpen && selectedTournament && (
        <Modal transparent animationType="fade" visible={genModalOpen} onRequestClose={() => setGenModalOpen(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.wizardCard, { maxWidth: 560, width: '94%', maxHeight: '90%' }]}>
              <View style={styles.wizardHeader}>
                <View>
                  <Text style={styles.wizardTitle}>⚡ Generate Fixtures & Schedule</Text>
                  <Text style={styles.wizardSub}>
                    Configure how many matches to schedule per date for {selectedTournament.name}.
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setGenModalOpen(false)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>
                <View style={styles.formRow}>
                  <View style={styles.formColHalf}>
                    <Text style={styles.inputLabel}>Start Date</Text>
                    <input
                      type="date"
                      value={genStartDate}
                      onChange={(e: any) => setGenStartDate(e.target.value)}
                      style={styles.nativeDateInput as any}
                    />
                  </View>
                  <View style={styles.formColHalf}>
                    <Text style={styles.inputLabel}>Matches Per Day</Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      value={genMatchesPerDay}
                      onChangeText={(val) => {
                        const cleaned = sanitizeUnsignedInt(val);
                        setGenMatchesPerDay(cleaned);
                        const n = parseInt(cleaned, 10) || 1;
                        if (n > 2 && genSelectedVenues.length <= 1 && genTimeSlots === '09:30 AM, 02:30 PM') {
                          setGenTimeSlots('07:00 AM, 10:30 AM, 02:00 PM, 05:30 PM');
                        }
                      }}
                      placeholder="e.g. 2, 3, 4"
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {[
                    { label: '1 / day', value: '1', slots: '09:30 AM' },
                    { label: '2 / day', value: '2', slots: '09:30 AM, 02:30 PM' },
                    { label: '3 / day', value: '3', slots: '07:00 AM, 11:00 AM, 03:00 PM' },
                    { label: '4 / day', value: '4', slots: '07:00 AM, 10:30 AM, 02:00 PM, 05:30 PM' },
                    { label: '6 / day', value: '6', slots: '07:00 AM, 10:30 AM, 02:00 PM, 05:30 PM' },
                    { label: 'All on 1 Date', value: '99', slots: '07:00 AM, 10:30 AM, 02:00 PM, 05:30 PM' }
                  ].map((preset) => {
                    const active = genMatchesPerDay === preset.value;
                    return (
                      <TouchableOpacity
                        key={preset.label}
                        onPress={() => {
                          setGenMatchesPerDay(preset.value);
                          setGenTimeSlots(preset.slots);
                          if (Number(preset.value) > 4 && genSelectedVenues.length <= 1) {
                            setGenIgnoreConflicts(true);
                          }
                        }}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: active ? '#F59E0B' : '#CBD5E1',
                          backgroundColor: active ? '#FEF3C7' : '#F8FAFC'
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#92400E' : '#334155' }}>
                          {preset.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={{ marginBottom: 14 }}>
                  <Text style={styles.inputLabel}>Time Slots (comma-separated)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={genTimeSlots}
                    onChangeText={setGenTimeSlots}
                    placeholder="07:00 AM, 10:30 AM, 02:00 PM, 05:30 PM"
                  />
                </View>

                <View style={{ marginBottom: 14 }}>
                  <Text style={styles.inputLabel}>Grounds / Venues (select multiple for parallel matches on same date)</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                    {(dbVenues.length > 0 ? dbVenues : [{ name: selectedTournament.venue || 'Kamarajar District Stadium' }]).map((v: any) => {
                      const vName = v.name || v;
                      const selected = genSelectedVenues.includes(vName);
                      return (
                        <TouchableOpacity
                          key={v.id || vName}
                          onPress={() => {
                            setGenSelectedVenues(prev =>
                              prev.includes(vName)
                                ? (prev.length > 1 ? prev.filter(x => x !== vName) : prev)
                                : [...prev, vName]
                            );
                          }}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: selected ? '#0EA5E9' : '#CBD5E1',
                            backgroundColor: selected ? '#E0F2FE' : '#FFFFFF'
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '600', color: selected ? '#0369A1' : '#475569' }}>
                            {selected ? '✓ ' : ''}{vName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setGenIgnoreConflicts(prev => !prev)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    padding: 12,
                    borderRadius: 10,
                    backgroundColor: genIgnoreConflicts ? '#FEF3C7' : '#F8FAFC',
                    borderWidth: 1,
                    borderColor: genIgnoreConflicts ? '#F59E0B' : '#E2E8F0',
                    marginBottom: 10
                  }}
                >
                  <Text style={{ fontSize: 16 }}>{genIgnoreConflicts ? '☑️' : '⬜'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#0F172A' }}>
                      Allow overlapping / same-venue slots on the same date
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748B' }}>
                      Enable if you want multiple matches on the same date even at the same ground/time.
                    </Text>
                  </View>
                </TouchableOpacity>
              </ScrollView>

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0' }}>
                <TouchableOpacity
                  onPress={() => setGenModalOpen(false)}
                  style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#F1F5F9' }}
                  disabled={generatingMatches}
                >
                  <Text style={{ fontWeight: '700', color: '#475569' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleConfirmGenerateMatches}
                  style={[styles.btnActionGold, { paddingHorizontal: 18, paddingVertical: 10 }]}
                  disabled={generatingMatches}
                >
                  {generatingMatches ? (
                    <ActivityIndicator size="small" color="#020612" />
                  ) : (
                    <Text style={styles.btnActionGoldText}>⚡ Generate Fixtures</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// STYLES: Royal Cricket Association Theme
// ─────────────────────────────────────────────────────────────────────────────
const styles: any = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },

  // KPI Highlight Row
  kpiCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap'
  },
  kpiCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
  },
  kpiCardTotal: { borderLeftWidth: 4, borderLeftColor: '#d4af37' },
  kpiCardOngoing: { borderLeftWidth: 4, borderLeftColor: '#16a34a' },
  kpiCardUpcoming: { borderLeftWidth: 4, borderLeftColor: '#0284c7' },
  kpiCardCompleted: { borderLeftWidth: 4, borderLeftColor: '#7c3aed' },
  kpiIconWrapTotal: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center'
  },
  kpiIconWrapOngoing: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center'
  },
  kpiIconWrapUpcoming: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center'
  },
  kpiIconWrapCompleted: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#f3e8ff',
    justifyContent: 'center',
    alignItems: 'center'
  },
  kpiVal: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a'
  },
  kpiLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600'
  },

  // Toolbar
  toolbarCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
  },
  searchBox: {
    flex: 1,
    minWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    outlineStyle: 'none'
  },
  clearSearchBtn: {
    padding: 4
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap'
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f1f5f9'
  },
  filterPillActive: {
    backgroundColor: '#0a2540'
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569'
  },
  filterPillTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  createBtnGradient: {
    backgroundColor: '#d4af37',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    boxShadow: '0 4px 12px rgba(212, 175, 55, 0.35)'
  },
  createBtnText: {
    color: '#020612',
    fontSize: 13,
    fontWeight: '800'
  },

  // Grid
  tournamentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16
  },
  tourCard: {
    width: Platform.OS === 'web' ? 'calc(50% - 8px)' : '100%',
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    boxShadow: '0 4px 16px rgba(0,0,0,0.05)'
  },
  tourCardOngoing: {
    borderColor: '#86efac'
  },
  tourCardCompleted: {
    borderColor: '#ddd6fe'
  },
  tourCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  tourLogoBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#0a2540',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#d4af37',
    overflow: 'hidden'
  },
  tourLogoImg: {
    width: 52,
    height: 52,
    resizeMode: 'cover'
  },
  tourLogoFallback: {
    fontSize: 16,
    fontWeight: '900',
    color: '#d4af37'
  },
  tourSeasonTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase'
  },
  tourCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2
  },
  tourCardShortName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d4af37',
    marginTop: 1
  },

  // Status Badges
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#f1f5f9'
  },
  statusBadgeOngoing: { backgroundColor: '#dcfce7' },
  statusBadgeUpcoming: { backgroundColor: '#e0f2fe' },
  statusBadgeCompleted: { backgroundColor: '#f3e8ff' },
  statusBadgeCancelled: { backgroundColor: '#fee2e2' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#64748b' },
  statusBadgeText: { fontSize: 11, fontWeight: '800' },

  // Chips
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 12
  },
  metaChip: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569'
  },

  // Info Box
  infoRowBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    gap: 6
  },
  infoRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  infoRowIcon: { fontSize: 12 },
  infoRowVal: { fontSize: 12, color: '#334155', fontWeight: '500' },

  // Progress Wrap
  progressWrap: {
    marginTop: 12
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  progressLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  progressVal: { fontSize: 11, color: '#0f172a', fontWeight: '700' },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden'
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#d4af37'
  },

  // Card Actions
  cardActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    alignItems: 'center'
  },
  btnCardDashboard: {
    flex: 1,
    backgroundColor: '#0a2540',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center'
  },
  btnCardDashboardText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  btnCardEdit: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  btnCardEditText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155'
  },
  btnCardDelete: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5'
  },
  btnCardDeleteText: {
    fontSize: 12
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 18, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  wizardModalCard: {
    width: '100%',
    maxWidth: 820,
    maxHeight: '95%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 20px 40px rgba(0,0,0,0.35)'
  },
  wizardHeader: {
    backgroundColor: '#0a2540',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: '#d4af37'
  },
  wizardHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    flexShrink: 1,
    flexWrap: 'wrap' as any
  },
  wizardHeaderSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
    flexWrap: 'wrap' as any
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0
  },

  // Stepper
  stepperBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc'
  },
  stepperItem: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  stepperItemActive: {
    borderBottomColor: '#d4af37',
    backgroundColor: '#ffffff'
  },
  stepperText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center' as any
  },
  stepperTextActive: {
    color: '#0a2540',
    fontWeight: '800'
  },
  stepperTextCompleted: {
    color: '#16a34a'
  },

  // Form
  wizardBody: {
    flex: 1,
    ...(Platform.OS === 'web' ? {
      scrollbarWidth: 'thin' as any,
      scrollbarColor: '#cbd5e1 transparent' as any
    } : {})
  },
  formSection: {
    gap: 12
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2
  },
  sectionSub: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 10
  },
  formRow: {
    flexDirection: 'row',
    flexWrap: 'wrap' as any,
    gap: 12,
    marginBottom: 4
  },
  formColFull: { flex: 1, minWidth: 200 },
  formColHalf: { flex: 1, minWidth: 160 },
  formColThird: { flex: 1, minWidth: 130 },
  formColFourth: { flex: 1, minWidth: 110 },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 5
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    color: '#0f172a',
    outlineStyle: 'none' as any
  },
  textInputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fff5f5'
  },
  formFieldErrorText: {
    fontSize: 11.5,
    color: '#dc2626',
    fontWeight: '600',
    marginTop: 4
  },
  nativeSelect: {
    width: '100%',
    height: 44,
    boxSizing: 'border-box' as any,
    paddingLeft: 14,
    paddingRight: 38,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    outlineStyle: 'none' as any,
    cursor: 'pointer' as any,
    appearance: 'none' as any,
    WebkitAppearance: 'none' as any,
    MozAppearance: 'none' as any
  },
  selectWrap: {
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
    flex: 1
  },
  selectChevron: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none' as any,
    zIndex: 2
  },
  selectChevronText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: 'bold'
  },
  nativeDateInput: {
    width: '100%',
    height: 44,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 13.5,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    outlineStyle: 'none' as any
  },

  // Season Year Input & Calendar Button
  seasonInputWrapper: {
    position: 'relative',
    width: '100%',
    justifyContent: 'center'
  },
  seasonTextInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingLeft: 14,
    paddingRight: 48,
    height: 44,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    outlineStyle: 'none' as any
  },
  inputSuffixBadge: {
    position: 'absolute',
    right: 8,
    top: 6,
    bottom: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  inputSuffixBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b'
  },
  seasonCalendarBtn: {
    position: 'absolute',
    right: 6,
    top: 5,
    bottom: 5,
    width: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    cursor: 'pointer' as any
  },
  calendarIconText: {
    fontSize: 18
  },

  // Year Picker Modal
  yearPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  yearPickerCard: {
    width: 360,
    maxWidth: '95%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 28,
    elevation: 20
  },
  yearPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  yearPickerNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer' as any
  },
  yearPickerNavText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: 'bold'
  },
  yearPickerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a'
  },
  yearPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    marginBottom: 16
  },
  yearPickerCell: {
    width: '31%',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer' as any
  },
  yearPickerCellSelected: {
    backgroundColor: '#d97706',
    borderColor: '#b45309'
  },
  yearPickerCellCurrent: {
    borderColor: '#d97706',
    borderWidth: 1.5
  },
  yearPickerCellText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155'
  },
  yearPickerCellTextSelected: {
    color: '#ffffff'
  },
  yearPickerCellTextCurrent: {
    color: '#d97706'
  },
  yearPickerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12
  },
  yearPickerQuickBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde047',
    cursor: 'pointer' as any
  },
  yearPickerQuickText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#854d0e'
  },
  yearPickerCloseBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    cursor: 'pointer' as any
  },
  yearPickerCloseText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569'
  },

  // Points Config Box
  pointsConfigBox: {
    backgroundColor: '#fefce8',
    borderWidth: 1,
    borderColor: '#fef08a',
    borderRadius: 8,
    padding: 12,
    marginTop: 6
  },
  pointsConfigTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#854d0e'
  },

  // Toggles Row
  togglesRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    alignItems: 'center'
  },
  toggleBtnActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac'
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b'
  },
  toggleBtnTextActive: {
    color: '#15803d',
    fontWeight: '700'
  },

  // Team Selection
  selectedCountBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fde047'
  },
  selectedCountText: {
    fontSize: 12,
    color: '#78350f'
  },
  teamSearchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    alignItems: 'center'
  },
  teamSearchInput: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 13,
    color: '#0f172a',
    outlineStyle: 'none'
  },
  btnSmallAction: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#e2e8f0',
    borderRadius: 6
  },
  btnSmallActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155'
  },
  teamCardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  teamSelectCard: {
    width: Platform.OS === 'web' ? 'calc(50% - 5px)' : '100%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center'
  },
  teamSelectCardActive: {
    borderColor: '#d4af37',
    backgroundColor: '#fffdf5',
    boxShadow: '0 2px 8px rgba(212, 175, 55, 0.2)'
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8
  },
  checkboxCircleActive: {
    backgroundColor: '#d4af37',
    borderColor: '#d4af37'
  },
  checkIcon: {
    fontSize: 12,
    color: '#020612',
    fontWeight: '900'
  },
  teamCardAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0a2540',
    justifyContent: 'center',
    alignItems: 'center'
  },
  teamCardAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#d4af37'
  },
  teamCardName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a'
  },
  teamCardCoach: {
    fontSize: 11,
    color: '#64748b'
  },
  teamCardTaluk: {
    fontSize: 11,
    color: '#94a3b8'
  },
  noTeamsBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },

  // Format Config Step 4
  formatSummaryCard: {
    backgroundColor: '#0a2540',
    padding: 14,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#d4af37',
    marginBottom: 14
  },
  formatSummaryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff'
  },
  formatSummarySub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2
  },
  formatConfigBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 14
  },
  configBoxTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a'
  },
  configBoxSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  formatOptionBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12
  },
  formatOptionBtnActive: {
    borderColor: '#d4af37',
    backgroundColor: '#fffdf5',
    boxShadow: '0 2px 8px rgba(212, 175, 55, 0.2)'
  },
  formatOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4
  },
  formatOptionTitleActive: {
    color: '#854d0e'
  },
  formatOptionSub: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 15
  },
  knockoutStagesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10
  },
  stagePill: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6
  },
  stagePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155'
  },

  // Wizard Footer
  wizardFooter: {
    backgroundColor: '#ffffff',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  btnSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 6,
    backgroundColor: '#f1f5f9'
  },
  btnSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569'
  },
  btnCancel: {
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  btnCancelText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600'
  },
  btnPrimary: {
    backgroundColor: '#0a2540',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 6
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  btnSaveGold: {
    backgroundColor: '#d4af37',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    boxShadow: '0 4px 12px rgba(212, 175, 55, 0.35)'
  },
  btnSaveGoldText: {
    color: '#020612',
    fontSize: 13,
    fontWeight: '800'
  },

  // ── DETAILS MODAL STYLES ───────────────────────────────────────────────
  detailsModalCard: {
    width: '100%',
    maxWidth: 1000,
    maxHeight: '95%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 25px 50px rgba(0,0,0,0.45)'
  },
  detailsBanner: {
    backgroundColor: '#020612',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 3,
    borderBottomColor: '#d4af37',
    flexWrap: 'wrap' as any,
    gap: 10
  },
  detailsBannerLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  detailsBannerLogo: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: '#0a2540',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#d4af37',
    overflow: 'hidden'
  },
  detailsLogoImg: { width: 60, height: 60 },
  detailsLogoFallback: { fontSize: 20, fontWeight: '900', color: '#d4af37' },
  bannerSeasonTag: { fontSize: 11, fontWeight: '800', color: '#d4af37' },
  bannerCategoryTag: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  detailsBannerTitle: { fontSize: 18, fontWeight: '900', color: '#ffffff', marginTop: 3, flexShrink: 1, flexWrap: 'wrap' as any },
  detailsBannerMeta: { fontSize: 11.5, color: '#94a3b8', marginTop: 3, flexWrap: 'wrap' as any },
  detailsBannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap' as any,
    gap: 8,
    flexShrink: 0
  },
  btnActionGold: {
    backgroundColor: '#d4af37',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6
  },
  btnActionGoldText: { color: '#020612', fontSize: 12, fontWeight: '800' },
  btnActionSchedule: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6
  },
  btnActionScheduleText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  btnBannerClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4
  },

  // Details Tabs
  detailsTabsBar: {
    flexDirection: 'row',
    backgroundColor: '#0a2540',
    paddingHorizontal: 4,
    flexShrink: 0
  },
  detailsTabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent'
  },
  detailsTabBtnActive: {
    borderBottomColor: '#d4af37',
    backgroundColor: 'rgba(212, 175, 55, 0.1)'
  },
  detailsTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8'
  },
  detailsTabTextActive: {
    color: '#d4af37'
  },
  detailsContentScroll: {
    flex: 1,
    backgroundColor: '#f8fafc',
    ...(Platform.OS === 'web' ? {
      scrollbarWidth: 'thin' as any,
      scrollbarColor: '#cbd5e1 transparent' as any
    } : {})
  },

  // Details Summary Grid
  detailsSummaryGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap'
  },
  summaryBox: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center'
  },
  summaryBoxVal: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
  summaryBoxLabel: { fontSize: 11, fontWeight: '600', color: '#64748b', marginTop: 2 },

  // Card Sections
  cardSection: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  cardSectionTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 6 },
  cardSectionText: { fontSize: 13, color: '#334155', lineHeight: 20 },
  rulesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  ruleItem: { width: '48%', flexDirection: 'row', gap: 6 },
  ruleItemLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  ruleItemVal: { fontSize: 12, color: '#0f172a', fontWeight: '700' },

  // Teams Grid in Details
  teamsGridDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  teamDetailsCard: {
    width: Platform.OS === 'web' ? 'calc(50% - 6px)' : '100%',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center'
  },

  // Matches in Details
  smallFilterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#e2e8f0'
  },
  smallFilterPillActive: { backgroundColor: '#0a2540' },
  smallFilterPillText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  smallFilterPillTextActive: { color: '#ffffff' },
  btnActionGoldSmall: {
    backgroundColor: '#d4af37',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  btnActionGoldSmallText: { fontSize: 12, fontWeight: '800', color: '#020612' },
  matchDetailCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14
  },
  matchDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  matchIdTag: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  matchStageTag: { fontSize: 11, fontWeight: '700', color: '#d4af37' },
  matchTeamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9'
  },
  matchTeamTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', flex: 1, textAlign: 'center' },
  matchVsText: { fontSize: 12, fontWeight: '900', color: '#d4af37', paddingHorizontal: 12 },
  matchMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    flexWrap: 'wrap',
    gap: 8
  },
  matchMetaText: { fontSize: 12, color: '#475569' },
  matchResultBanner: {
    marginTop: 10,
    backgroundColor: '#f0fdf4',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0'
  },
  matchResultText: { fontSize: 12, fontWeight: '700', color: '#166534' },
  matchActionFooter: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end'
  },
  btnSmallSchedule: {
    backgroundColor: '#0a2540',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  btnSmallScheduleText: { fontSize: 11, fontWeight: '700', color: '#ffffff' },

  // Points Table Styles
  tableCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden'
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#0a2540',
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center'
  },
  thCell: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5
  },
  tableDataRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  tableRowTopZone: {
    borderLeftWidth: 4,
    borderLeftColor: '#16a34a',
    backgroundColor: '#fcfdfd'
  },
  tableRowAlt: {
    backgroundColor: '#fcfcfc'
  },
  posBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  posBadgeTop: {
    backgroundColor: '#dcfce7'
  },
  posBadgeText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  posBadgeTextTop: { color: '#15803d' },
  tableTeamName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  tdCell: { fontSize: 12, color: '#334155' },
  formPill: { width: 14, height: 14, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
  formPillWin: { backgroundColor: '#16a34a' },
  formPillLoss: { backgroundColor: '#dc2626' },
  formPillTie: { backgroundColor: '#0284c7' },
  formPillNR: { backgroundColor: '#64748b' },
  formPillText: { fontSize: 8, color: '#ffffff', fontWeight: '900' },
  btnSmallRefresh: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  btnSmallRefreshText: { fontSize: 11, fontWeight: '700', color: '#334155' },

  // Stats
  statsTableHeading: { fontSize: 13, fontWeight: '800', color: '#0a2540' },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  boundariesBanner: {
    flexDirection: 'row',
    backgroundColor: '#0a2540',
    borderRadius: 10,
    padding: 16,
    justifyContent: 'space-around'
  },
  boundaryStatCol: { alignItems: 'center' },
  boundaryVal: { fontSize: 24, fontWeight: '900', color: '#d4af37' },
  boundaryLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  rulesTextBox: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16
  },
  rulesContentText: { fontSize: 13, color: '#334155', lineHeight: 22 },

  // Loading & Empty
  centerLoading: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 10,
    fontWeight: '600'
  },
  emptyStateCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 12
  },
  emptyStateTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a'
  },
  emptyStateSub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 440,
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 19
  },

  // ── Sub-Nav Tabs & Reg Styles ──
  adminSectionTabsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 6,
    marginBottom: 16,
    gap: 8,
    flexWrap: 'wrap'
  },
  adminSectionTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    gap: 8
  },
  adminSectionTabBtnActive: {
    backgroundColor: '#0a2540',
    borderColor: '#0a2540'
  },
  adminSectionTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155'
  },
  adminSectionTabTextActive: {
    color: '#ffffff',
    fontWeight: '800'
  },
  sectionBadgePending: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f59e0b'
  },
  sectionBadgePendingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309'
  },
  filterSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b'
  },
  btnCardToggleStatus: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 7,
    borderWidth: 1
  },
  btnCardActivate: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981'
  },
  btnCardDeactivate: {
    backgroundColor: '#fff1f2',
    borderColor: '#f43f5e'
  },
  btnCardToggleStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a'
  },
  btnCardRegistrations: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#3b82f6'
  },
  btnCardRegistrationsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8'
  },
  btnCardApprovedTeams: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#8b5cf6'
  },
  btnCardApprovedTeamsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6d28d9'
  },

  // ── Registration Cards ──
  regCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
    gap: 14
  },
  regCardApproved: {
    borderLeftWidth: 5,
    borderLeftColor: '#10b981'
  },
  regCardPending: {
    borderLeftWidth: 5,
    borderLeftColor: '#f59e0b'
  },
  regCardRejected: {
    borderLeftWidth: 5,
    borderLeftColor: '#ef4444'
  },
  regCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10
  },
  teamCrestAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center'
  },
  teamCrestText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff'
  },
  regTeamTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a'
  },
  regTournamentTag: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  regTournamentTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e'
  },
  regMetaSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  regInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  regInfoItem: {
    minWidth: 160,
    flex: 1
  },
  regInfoLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  regInfoVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 2
  },
  regNotesBox: {
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#fef3c7'
  },
  regNotesLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400e'
  },
  regNotesText: {
    fontSize: 12,
    color: '#78350f',
    marginTop: 2
  },
  approvalMetaBox: {
    backgroundColor: '#ecfdf5',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0'
  },
  approvalMetaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065f46'
  },
  rejectionMetaBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#fecaca'
  },
  rejectionMetaTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991b1b'
  },
  rejectionMetaReason: {
    fontSize: 12,
    color: '#b91c1c',
    marginTop: 2,
    fontStyle: 'italic'
  },
  regActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4
  },
  btnApproveReg: {
    flex: 1,
    backgroundColor: '#059669',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnApproveRegText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff'
  },
  btnRejectReg: {
    flex: 1,
    backgroundColor: '#dc2626',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnRejectRegText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff'
  },

  // ── Approved Teams View ──
  approvedTourSummaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0a2540',
    borderRadius: 10,
    padding: 14,
    marginTop: 10,
    flexWrap: 'wrap',
    gap: 10
  },
  approvedTourBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff'
  },
  approvedTourBannerSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2
  },
  approvedCountPill: {
    backgroundColor: '#d4af37',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  approvedCountPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a'
  },
  approvedTeamsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14
  },
  approvedTeamCard: {
    flex: 1,
    minWidth: 240,
    maxWidth: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 10
  },
  approvedTeamTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  approvedTeamName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a'
  },
  approvedTeamTaluk: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  officialBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0'
  },
  officialBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857'
  },
  approvedMetaRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  approvedMetaCol: {
    flex: 1
  },
  approvedMetaLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8'
  },
  approvedMetaVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 2
  },
  approvedTimestampRow: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8
  },
  approvedTimestampText: {
    fontSize: 11,
    color: '#64748b'
  },

  // ── Rejection Modal ──
  rejectModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  rejectModalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
  },
  rejectModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef2f2',
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
    padding: 16
  },
  rejectModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#991b1b'
  },
  rejectModalSub: {
    fontSize: 12,
    color: '#b91c1c',
    marginTop: 2
  },
  rejectInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#ffffff',
    textAlignVertical: 'top',
    minHeight: 90
  },
  rejectModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 18
  },
  btnRejectCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9'
  },
  btnRejectCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569'
  },
  btnRejectConfirm: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#dc2626'
  },
  btnRejectConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff'
  }
} as any);

export default TournamentManagement;
