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
  Alert,
  Image
} from 'react-native';
import { ScorerApi, API_URL } from '../../services/api';
import { showSuccess, showError, showWarning, showConfirm } from '../../utils/sweetalert';

export interface TournamentManagementProps {
  onOpenScheduler?: (tournament: any, match?: any) => void;
  onExit?: () => void;
}

type TournamentFilterStatus = 'ALL' | 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
type TournamentTab = 'overview' | 'teams' | 'schedule' | 'points' | 'stats' | 'rules';
type TournamentType = 'LEAGUE' | 'KNOCKOUT' | 'LEAGUE_KNOCKOUT';
type MatchFormat = 'T10' | 'T20' | 'ODI' | 'CUSTOM';

export const TournamentManagement: React.FC<TournamentManagementProps> = ({
  onOpenScheduler,
  onExit
}) => {
  // ── Main State ─────────────────────────────────────────────────────────
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<TournamentFilterStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // ── Admin Sub-Sections (Directory / Registrations / Approved Teams) ──────
  const [adminSection, setAdminSection] = useState<'directory' | 'registrations' | 'approved'>('directory');
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [regLoading, setRegLoading] = useState<boolean>(false);
  const [regTournamentFilter, setRegTournamentFilter] = useState<string>('ALL');
  const [regStatusFilter, setRegStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [regSearchQuery, setRegSearchQuery] = useState<string>('');

  // Rejection Reason Prompt Modal
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [selectedRegForReject, setSelectedRegForReject] = useState<any | null>(null);
  const [rejectionReasonText, setRejectionReasonText] = useState<string>('');
  const [rejectSubmitting, setRejectSubmitting] = useState<boolean>(false);

  // Approved Teams Tab State
  const [approvedTabTournamentId, setApprovedTabTournamentId] = useState<string>('');
  const [approvedTeamsList, setApprovedTeamsList] = useState<any[]>([]);
  const [approvedTeamsLoading, setApprovedTeamsLoading] = useState<boolean>(false);

  // Database Teams & Umpires
  const [dbTeams, setDbTeams] = useState<any[]>([]);
  const [dbUmpires, setDbUmpires] = useState<any[]>([]);
  const [dbVenues, setDbVenues] = useState<any[]>([]);

  // ── Create / Edit Modal State ──────────────────────────────────────────
  const [wizardOpen, setWizardOpen] = useState<boolean>(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editingTournamentId, setEditingTournamentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form Fields
  const [formName, setFormName] = useState<string>('');
  const [formShortName, setFormShortName] = useState<string>('');
  const [formLogoUrl, setFormLogoUrl] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formTournamentType, setFormTournamentType] = useState<TournamentType>('LEAGUE');
  const [formCategory, setFormCategory] = useState<string>('Senior Men');
  const [formGender, setFormGender] = useState<string>('Men');
  const [formBallType, setFormBallType] = useState<string>('Red Leather');
  const [formMatchFormat, setFormMatchFormat] = useState<MatchFormat>('T20');
  const [formOvers, setFormOvers] = useState<string>('20');
  const [formSeason, setFormSeason] = useState<string>('2026');

  // Schedule & Rules Fields
  const [formStartDate, setFormStartDate] = useState<string>('');
  const [formEndDate, setFormEndDate] = useState<string>('');
  const [formRegStartDate, setFormRegStartDate] = useState<string>('');
  const [formRegEndDate, setFormRegEndDate] = useState<string>('');
  const [formVenue, setFormVenue] = useState<string>('Kamarajar District Stadium');
  const [formMaxTeams, setFormMaxTeams] = useState<string>('16');
  const [formMinTeams, setFormMinTeams] = useState<string>('2');
  const [formPointsWin, setFormPointsWin] = useState<string>('2');
  const [formPointsTie, setFormPointsTie] = useState<string>('1');
  const [formPointsNR, setFormPointsNR] = useState<string>('1');
  const [formPlayingXI, setFormPlayingXI] = useState<string>('11');
  const [formSubstitutes, setFormSubstitutes] = useState<string>('4');
  const [formAllowSuperOver, setFormAllowSuperOver] = useState<boolean>(true);
  const [formAllowDLS, setFormAllowDLS] = useState<boolean>(false);
  const [formRulesText, setFormRulesText] = useState<string>('Standard ICC / TNCA Playing Conditions apply.');

  // Team Selection Fields
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [teamSearchQuery, setTeamSearchQuery] = useState<string>('');

  // Format Configuration Fields
  const [formRoundRobinType, setFormRoundRobinType] = useState<'SINGLE' | 'DOUBLE'>('SINGLE');
  const [formQualifyingTeamsCount, setFormQualifyingTeamsCount] = useState<string>('4');
  const [formQualificationRules, setFormQualificationRules] = useState<string>('Top 4 teams advance to semi-finals');

  // ── Details Dashboard Modal State ──────────────────────────────────────
  const [detailsModalOpen, setDetailsModalOpen] = useState<boolean>(false);
  const [selectedTournament, setSelectedTournament] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [detailsTab, setDetailsTab] = useState<TournamentTab>('overview');
  const [matchStatusFilter, setMatchStatusFilter] = useState<'ALL' | 'SCHEDULED' | 'LIVE' | 'COMPLETED'>('ALL');
  const [generatingMatches, setGeneratingMatches] = useState<boolean>(false);

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
      const res = await ScorerApi.getAllRegistrations();
      const raw = res?.registrations || res?.data || [];
      const approved: any[] = [];
      raw.forEach((r: any) => {
        const s = (r.status || '').toUpperCase();
        if (r.type === 'TEAM' && (s === 'APPROVED' || s === 'ACTIVE')) {
          approved.push({
            id: r.id || r.mongoId,
            team_id: r.id,
            name: r.name,
            team_name: r.name,
            coach_name: r.contactName || r.name,
            coach_email: r.email || r.contactEmail || '',
            taluk: r.taluk || r.details?.taluk || 'Virudhunagar',
            status: 'Approved'
          });
        }
      });

      // Also fetch from /api/matches or fallback
      if (approved.length === 0) {
        // Fallback default clubs
        setDbTeams([
          { id: 'TM-01', name: 'Sattur Spartans', coach_name: 'K. Muthu', taluk: 'Virudhunagar' },
          { id: 'TM-02', name: 'Virudhunagar Strikers', coach_name: 'S. Ganesan', taluk: 'Sivakasi' },
          { id: 'TM-03', name: 'Rajapalayam Royals', coach_name: 'R. Subramanian', taluk: 'Rajapalayam' },
          { id: 'TM-04', name: 'Aruppukottai Aces', coach_name: 'V. Raman', taluk: 'Aruppukottai' }
        ]);
      } else {
        setDbTeams(approved);
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
      if (res && res.venues) {
        setDbVenues(res.venues);
      } else {
        setDbVenues([
          { id: 'VEN-01', name: 'Kamarajar District Stadium', location: 'Virudhunagar' },
          { id: 'VEN-02', name: 'Sivakasi Cricket Ground', location: 'Sivakasi' },
          { id: 'VEN-03', name: 'PACR Sports Complex', location: 'Rajapalayam' },
          { id: 'VEN-04', name: 'Aruppukottai Pavilion Turf Ground', location: 'Aruppukottai' }
        ]);
      }
    } catch (err) {
      setDbVenues([
        { id: 'VEN-01', name: 'Kamarajar District Stadium', location: 'Virudhunagar' },
        { id: 'VEN-02', name: 'Sivakasi Cricket Ground', location: 'Sivakasi' }
      ]);
    }
  };

  // ── Open Create Tournament Wizard ─────────────────────────────────────
  const handleOpenCreateWizard = () => {
    setIsEditMode(false);
    setEditingTournamentId(null);
    setWizardStep(1);

    // Default pre-fills
    setFormName('');
    setFormShortName('');
    setFormLogoUrl('');
    setFormDescription('Annual premier district championship organized by Cricket Federation of Virudhunagar District.');
    setFormTournamentType('LEAGUE');
    setFormCategory('Senior Men');
    setFormGender('Men');
    setFormBallType('Red Leather');
    setFormMatchFormat('T20');
    setFormOvers('20');
    setFormSeason('2026');

    const today = new Date();
    const plus30 = new Date(today.getTime() + 30 * 86400000);
    setFormStartDate(today.toISOString().split('T')[0]);
    setFormEndDate(plus30.toISOString().split('T')[0]);
    setFormRegStartDate(today.toISOString().split('T')[0]);
    setFormRegEndDate(new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0]);

    setFormVenue('Kamarajar District Stadium');
    setFormMaxTeams('16');
    setFormMinTeams('2');
    setFormPointsWin('2');
    setFormPointsTie('1');
    setFormPointsNR('1');
    setFormPlayingXI('11');
    setFormSubstitutes('4');
    setFormAllowSuperOver(true);
    setFormAllowDLS(false);
    setFormRulesText('Official ICC / TNCA Playing Conditions. 20 Overs per side. Win = 2 Pts, Tie/NR = 1 Pt. Super Over applies in tied knockouts.');

    // Select existing approved teams by default if available
    setSelectedTeamIds(dbTeams.slice(0, 4).map(t => t.id));
    setFormRoundRobinType('SINGLE');
    setFormQualifyingTeamsCount('4');
    setFormQualificationRules('Top 4 teams advance to semi-finals');

    setWizardOpen(true);
  };

  // ── Open Edit Tournament Wizard ───────────────────────────────────────
  const handleOpenEditWizard = (tour: any) => {
    setIsEditMode(true);
    setEditingTournamentId(tour.id);
    setWizardStep(1);

    setFormName(tour.name || '');
    setFormShortName(tour.short_name || '');
    setFormLogoUrl(tour.logo_url || '');
    setFormDescription(tour.description || '');
    setFormTournamentType(tour.tournament_type || 'LEAGUE');
    setFormCategory(tour.category || 'Senior Men');
    setFormGender(tour.gender || 'Men');
    setFormBallType(tour.ball_type || 'Red Leather');
    setFormMatchFormat(tour.match_format || tour.format || 'T20');
    setFormOvers(String(tour.overs_per_match || 20));
    setFormSeason(tour.season || '2026');

    setFormStartDate(tour.start_date || '');
    setFormEndDate(tour.end_date || '');
    setFormRegStartDate(tour.registration_start_date || '');
    setFormRegEndDate(tour.registration_end_date || '');
    setFormVenue(tour.venue || 'Kamarajar District Stadium');

    setFormMaxTeams(String(tour.max_teams || 16));
    setFormMinTeams(String(tour.min_teams || 2));
    setFormPointsWin(String(tour.points_win !== undefined ? tour.points_win : 2));
    setFormPointsTie(String(tour.points_tie !== undefined ? tour.points_tie : 1));
    setFormPointsNR(String(tour.points_no_result !== undefined ? tour.points_no_result : 1));
    setFormPlayingXI(String(tour.playing_xi_size || 11));
    setFormSubstitutes(String(tour.substitute_count || 4));
    setFormAllowSuperOver(tour.allow_super_over !== false);
    setFormAllowDLS(Boolean(tour.allow_dls));
    setFormRulesText(tour.rules || 'Standard ICC / TNCA Playing Conditions.');

    setSelectedTeamIds(tour.teams || []);
    setFormRoundRobinType(tour.format_config?.round_robin_type || 'SINGLE');
    setFormQualifyingTeamsCount(String(tour.format_config?.qualifying_teams_count || 4));
    setFormQualificationRules(tour.format_config?.qualification_rules || 'Top 4 teams advance to semi-finals');

    setWizardOpen(true);
  };

  // ── Step Navigation & Validations ─────────────────────────────────────
  const handleProceedToStep2 = async () => {
    if (!formName.trim()) {
      await showWarning('Required Field', 'Tournament Name is required.');
      return;
    }
    setWizardStep(2);
  };

  const handleProceedToStep3 = async () => {
    if (!formStartDate || !formEndDate) {
      await showWarning('Required Fields', 'Both Start Date and End Date are required.');
      return;
    }
    const s = new Date(formStartDate);
    const e = new Date(formEndDate);
    if (e < s) {
      await showWarning('Invalid Dates', 'Tournament End Date cannot be before Start Date.');
      return;
    }
    setWizardStep(3);
  };

  const handleProceedToStep4 = async () => {
    const minT = parseInt(formMinTeams, 10) || 2;
    const maxT = parseInt(formMaxTeams, 10) || 16;
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
        `Selected team count (${selectedTeamIds.length}) exceeds maximum allowed teams (${maxT}).`
      );
      return;
    }
    setWizardStep(4);
  };

  // ── Toggle Team Selection ─────────────────────────────────────────────
  const toggleTeamSelection = (teamId: string) => {
    const maxT = parseInt(formMaxTeams, 10) || 16;
    if (selectedTeamIds.includes(teamId)) {
      setSelectedTeamIds(selectedTeamIds.filter(id => id !== teamId));
    } else {
      if (selectedTeamIds.length >= maxT) {
        showWarning('Limit Reached', `Maximum team capacity is set to ${maxT} teams.`);
        return;
      }
      setSelectedTeamIds([...selectedTeamIds, teamId]);
    }
  };

  const selectAllTeams = () => {
    const maxT = parseInt(formMaxTeams, 10) || 16;
    const allFiltered = filteredTeams.slice(0, maxT).map(t => t.id);
    setSelectedTeamIds(allFiltered);
  };

  const deselectAllTeams = () => {
    setSelectedTeamIds([]);
  };

  // ── Submit Create / Update Tournament ─────────────────────────────────
  const handleSubmitTournament = async () => {
    if (!formName.trim()) {
      setWizardStep(1);
      await showWarning('Validation Error', 'Tournament Name is required.');
      return;
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
      ball_type: formBallType,
      match_format: formMatchFormat,
      overs_per_match: parseInt(formOvers, 10) || 20,
      season: formSeason,
      venue: formVenue,
      start_date: formStartDate,
      end_date: formEndDate,
      registration_start_date: formRegStartDate || null,
      registration_end_date: formRegEndDate || null,
      max_teams: parseInt(formMaxTeams, 10) || 16,
      min_teams: parseInt(formMinTeams, 10) || 2,
      points_win: parseInt(formPointsWin, 10) || 2,
      points_tie: parseInt(formPointsTie, 10) || 1,
      points_no_result: parseInt(formPointsNR, 10) || 1,
      playing_xi_size: parseInt(formPlayingXI, 10) || 11,
      substitute_count: parseInt(formSubstitutes, 10) || 4,
      allow_super_over: formAllowSuperOver,
      allow_dls: formAllowDLS,
      rules: formRulesText,
      format_config: {
        round_robin_type: formRoundRobinType,
        knockout_stages: formTournamentType === 'KNOCKOUT' ? ['Semi Final', 'Final'] : [],
        qualifying_teams_count: parseInt(formQualifyingTeamsCount, 10) || 4,
        qualification_rules: formQualificationRules
      },
      teams: selectedTeamIds
    };

    try {
      if (isEditMode && editingTournamentId) {
        await ScorerApi.updateTournament(editingTournamentId, payload);
        await showSuccess('Tournament Updated', `Championship '${payload.name}' has been updated successfully.`);
      } else {
        await ScorerApi.createTournament(payload);
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

  // ── Open Tournament Details Dashboard ──────────────────────────────────
  const handleOpenDetails = async (tournamentId: string) => {
    setDetailsModalOpen(true);
    setDetailsLoading(true);
    setDetailsTab('overview');
    try {
      const res = await ScorerApi.getTournamentById(tournamentId);
      const data = res.tournament || res.data;
      setSelectedTournament(data);
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
    } catch (err) {
      console.warn('Failed to refresh details:', err);
    } finally {
      setDetailsLoading(false);
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

    const confirmGen = await showConfirm(
      'Generate Championship Matches?',
      `This will generate official match pairings for all ${teamCount} registered teams (${selectedTournament.tournament_type || 'LEAGUE'}). Existing scheduled fixtures will be refreshed. Proceed?`,
      '⚡ Generate Matches',
      'Cancel',
      'question'
    );
    if (!confirmGen) return;

    setGeneratingMatches(true);
    try {
      const res = await ScorerApi.generateTournamentMatches(selectedTournament.id, {
        tournament_type: selectedTournament.tournament_type,
        round_robin_type: selectedTournament.format_config?.round_robin_type || 'SINGLE',
        venue: selectedTournament.venue,
        match_format: selectedTournament.match_format,
        overs_per_match: selectedTournament.overs_per_match
      });

      await showSuccess(
        'Fixtures Generated!',
        `Successfully generated ${res.total_matches_generated || 'championship'} matches. You can now schedule dates, venues, scorers, and umpires.`
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

  // ── Filtered Tournaments List ──────────────────────────────────────────
  const filteredTournaments = useMemo(() => {
    return tournaments.filter(t => {
      // Status filter
      if (statusFilter !== 'ALL') {
        const s = (t.status || 'UPCOMING').toUpperCase();
        if (statusFilter === 'ONGOING' && s !== 'ONGOING' && s !== 'ACTIVE') return false;
        if (statusFilter !== 'ONGOING' && s !== statusFilter) return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const term = searchQuery.toLowerCase();
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
  }, [tournaments, statusFilter, searchQuery]);

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
    if (formTournamentType === 'LEAGUE') {
      return formRoundRobinType === 'SINGLE' ? (count * (count - 1)) / 2 : count * (count - 1);
    } else if (formTournamentType === 'KNOCKOUT') {
      return count - 1;
    } else {
      // League + Knockout (Single RR + 2 Semi Finals + 1 Final)
      const leagueMatches = (count * (count - 1)) / 2;
      return leagueMatches + 3;
    }
  }, [selectedTeamIds.length, formTournamentType, formRoundRobinType]);

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
      if (regSearchQuery.trim()) {
        const q = regSearchQuery.toLowerCase();
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
  }, [registrations, regTournamentFilter, regStatusFilter, regSearchQuery]);

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
            🏆 Tournament Directory ({tournaments.length})
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
          <View style={styles.kpiCardsRow}>
            <View style={[styles.kpiCard, styles.kpiCardTotal]}>
              <View style={styles.kpiIconWrapTotal}>
                <Text style={{ fontSize: 20 }}>🏆</Text>
              </View>
              <View>
                <Text style={styles.kpiVal}>{summaryCounts.total}</Text>
                <Text style={styles.kpiLabel}>Total Championships</Text>
              </View>
            </View>

            <View style={[styles.kpiCard, styles.kpiCardOngoing]}>
              <View style={styles.kpiIconWrapOngoing}>
                <Text style={{ fontSize: 20 }}>⚡</Text>
              </View>
              <View>
                <Text style={[styles.kpiVal, { color: '#16a34a' }]}>{summaryCounts.ongoing}</Text>
                <Text style={styles.kpiLabel}>Ongoing Tournaments</Text>
              </View>
            </View>

            <View style={[styles.kpiCard, styles.kpiCardUpcoming]}>
              <View style={styles.kpiIconWrapUpcoming}>
                <Text style={{ fontSize: 20 }}>📅</Text>
              </View>
              <View>
                <Text style={[styles.kpiVal, { color: '#0284c7' }]}>{summaryCounts.upcoming}</Text>
                <Text style={styles.kpiLabel}>Upcoming Leagues</Text>
              </View>
            </View>

            <View style={[styles.kpiCard, styles.kpiCardCompleted]}>
              <View style={styles.kpiIconWrapCompleted}>
                <Text style={{ fontSize: 20 }}>🎖️</Text>
              </View>
              <View>
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

            {/* Filter Pills */}
            <View style={styles.filterPillsRow}>
              {(['ALL', 'ONGOING', 'UPCOMING', 'COMPLETED', 'CANCELLED'] as TournamentFilterStatus[]).map(st => {
                const active = statusFilter === st;
                return (
                  <TouchableOpacity
                    key={st}
                    style={[styles.filterPill, active && styles.filterPillActive]}
                    onPress={() => setStatusFilter(st)}
                  >
                    <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                      {st === 'ALL' ? 'All Competitions' : st}
                    </Text>
                  </TouchableOpacity>
                );
              })}
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
                          <Text style={styles.metaChipText}>{t.tournament_type || 'LEAGUE'}</Text>
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
          <View style={styles.toolbarCard}>
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

            {/* Tournament Selector Filter */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={styles.filterSectionLabel}>Championship:</Text>
              <TouchableOpacity
                style={[styles.filterPill, regTournamentFilter === 'ALL' && styles.filterPillActive]}
                onPress={() => setRegTournamentFilter('ALL')}
              >
                <Text style={[styles.filterPillText, regTournamentFilter === 'ALL' && styles.filterPillTextActive]}>
                  All Tournaments
                </Text>
              </TouchableOpacity>
              {tournaments.map(t => {
                const active = regTournamentFilter === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.filterPill, active && styles.filterPillActive]}
                    onPress={() => setRegTournamentFilter(t.id)}
                  >
                    <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                      {t.short_name || t.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Status Filter Pills */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <Text style={styles.filterSectionLabel}>Approval Status:</Text>
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(st => {
                const active = regStatusFilter === st;
                return (
                  <TouchableOpacity
                    key={st}
                    style={[styles.filterPill, active && styles.filterPillActive]}
                    onPress={() => setRegStatusFilter(st)}
                  >
                    <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                      {st === 'ALL' ? 'All Status' : st}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.filterPill, { backgroundColor: '#f1f5f9', marginLeft: 'auto' }]}
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
                        <View style={[styles.teamCrestAvatar, { backgroundColor: crestBg }]}>
                          <Text style={styles.teamCrestText}>{initials}</Text>
                        </View>
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
                        <Text style={styles.regInfoVal}>{r.squad_count || 15} Players Registered</Text>
                      </View>
                      {r.captain ? (
                        <View style={styles.regInfoItem}>
                          <Text style={styles.regInfoLabel}>TEAM CAPTAIN</Text>
                          <Text style={styles.regInfoVal}>👑 {r.captain}</Text>
                        </View>
                      ) : null}
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

                    {/* Action Buttons for Pending Registrations */}
                    {isPending && (
                      <View style={styles.regActionsRow}>
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
                      </View>
                    )}
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
          <View style={styles.toolbarCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={styles.filterSectionLabel}>Select Championship:</Text>
              {tournaments.map(t => {
                const active = (approvedTabTournamentId || tournaments[0]?.id) === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.filterPill, active && styles.filterPillActive]}
                    onPress={() => {
                      setApprovedTabTournamentId(t.id);
                      loadApprovedTeams(t.id);
                    }}
                  >
                    <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                      🏆 {t.short_name || t.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {activeApprovedTournament && (
              <View style={styles.approvedTourSummaryBanner}>
                <View>
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
                      <View style={[styles.teamCrestAvatar, { backgroundColor: '#059669', width: 44, height: 44 }]}>
                        <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 16 }}>{initials}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.approvedTeamName}>{t.team_name || t.name}</Text>
                        <Text style={styles.approvedTeamTaluk}>📍 {t.team_city || t.team_taluk || t.taluk || 'Virudhunagar'}</Text>
                      </View>
                      <View style={styles.officialBadge}>
                        <Text style={styles.officialBadgeText}>OFFICIAL</Text>
                      </View>
                    </View>

                    <View style={styles.approvedMetaRow}>
                      <View style={styles.approvedMetaCol}>
                        <Text style={styles.approvedMetaLabel}>COACH</Text>
                        <Text style={styles.approvedMetaVal}>{t.coach_name || 'Coach'}</Text>
                      </View>
                      <View style={styles.approvedMetaCol}>
                        <Text style={styles.approvedMetaLabel}>ROSTER</Text>
                        <Text style={styles.approvedMetaVal}>{t.squad_count || (t.squad || []).length || 15} Squad</Text>
                      </View>
                      {t.captain ? (
                        <View style={styles.approvedMetaCol}>
                          <Text style={styles.approvedMetaLabel}>CAPTAIN</Text>
                          <Text style={styles.approvedMetaVal}>👑 {t.captain}</Text>
                        </View>
                      ) : null}
                    </View>

                    {t.approved_at ? (
                      <View style={styles.approvedTimestampRow}>
                        <Text style={styles.approvedTimestampText}>
                          Approved on {t.approved_at.split('T')[0]} by {t.approved_by || 'Apex Council'}
                        </Text>
                      </View>
                    ) : null}
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
        <View style={styles.modalOverlay}>
          <View style={styles.wizardModalCard}>
            {/* Modal Header */}
            <View style={styles.wizardHeader}>
              <View>
                <Text style={styles.wizardHeaderTitle}>
                  {isEditMode ? '✏️ Edit Tournament Details' : '🏆 Create Official Cricket Championship'}
                </Text>
                <Text style={styles.wizardHeaderSub}>
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
            <View style={styles.stepperBar}>
              {[
                { step: 1, label: '1. Basic Information' },
                { step: 2, label: '2. Schedule & Rules' },
                { step: 3, label: `3. Team Selection (${selectedTeamIds.length})` },
                { step: 4, label: '4. Format Configuration' }
              ].map(item => {
                const active = wizardStep === item.step;
                const completed = wizardStep > item.step;
                return (
                  <TouchableOpacity
                    key={item.step}
                    style={[styles.stepperItem, active && styles.stepperItemActive]}
                    onPress={() => {
                      if (item.step === 1) setWizardStep(1);
                      else if (item.step === 2 && formName.trim()) setWizardStep(2);
                      else if (item.step === 3 && formStartDate && formEndDate) setWizardStep(3);
                      else if (item.step === 4 && selectedTeamIds.length >= 2) setWizardStep(4);
                    }}
                  >
                    <Text
                      style={[
                        styles.stepperText,
                        active && styles.stepperTextActive,
                        completed && styles.stepperTextCompleted
                      ]}
                    >
                      {completed ? '✓ ' : ''}{item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Modal Scrollable Body */}
            <ScrollView style={styles.wizardBody} contentContainerStyle={{ padding: 20 }}>
              {/* ── STEP 1: BASIC INFORMATION ─────────────────────────────── */}
              {wizardStep === 1 && (
                <View style={styles.formSection}>
                  <Text style={styles.sectionHeading}>Championship Basic Information</Text>

                  <View style={styles.formRow}>
                    <View style={styles.formColFull}>
                      <Text style={styles.inputLabel}>Tournament Name *</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="e.g. Virudhunagar Premier League 2026"
                        placeholderTextColor="#94a3b8"
                        value={formName}
                        onChangeText={setFormName}
                      />
                    </View>
                  </View>

                  <View style={styles.formRow}>
                    <View style={styles.formColHalf}>
                      <Text style={styles.inputLabel}>Short Name / Abbreviation</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="e.g. VPL 2026"
                        placeholderTextColor="#94a3b8"
                        value={formShortName}
                        onChangeText={setFormShortName}
                      />
                    </View>

                    <View style={styles.formColHalf}>
                      <Text style={styles.inputLabel}>Season</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="2026"
                        placeholderTextColor="#94a3b8"
                        value={formSeason}
                        onChangeText={setFormSeason}
                      />
                    </View>
                  </View>

                  <View style={styles.formRow}>
                    <View style={styles.formColFull}>
                      <Text style={styles.inputLabel}>Tournament Logo URL</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="https://example.com/logo.png or leave blank for default crest"
                        placeholderTextColor="#94a3b8"
                        value={formLogoUrl}
                        onChangeText={setFormLogoUrl}
                      />
                    </View>
                  </View>

                  <View style={styles.formRow}>
                    <View style={styles.formColHalf}>
                      <Text style={styles.inputLabel}>Tournament Type *</Text>
                      <View style={styles.selectWrap}>
                        <select
                          value={formTournamentType}
                          onChange={(e: any) => setFormTournamentType(e.target.value as TournamentType)}
                          style={styles.nativeSelect as any}
                        >
                          <option value="LEAGUE">League (Round Robin)</option>
                          <option value="KNOCKOUT">Knockout (Bracket Elimination)</option>
                          <option value="LEAGUE_KNOCKOUT">League + Knockout (Group Stage + Playoffs)</option>
                        </select>
                      </View>
                    </View>

                    <View style={styles.formColHalf}>
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
                          }}
                          style={styles.nativeSelect as any}
                        >
                          <option value="T20">T20 (20 Overs per side)</option>
                          <option value="T10">T10 (10 Overs per side)</option>
                          <option value="ODI">One Day (50 Overs per side)</option>
                          <option value="CUSTOM">Custom Overs</option>
                        </select>
                      </View>
                    </View>
                  </View>

                  <View style={styles.formRow}>
                    <View style={styles.formColThird}>
                      <Text style={styles.inputLabel}>Category / Age Group</Text>
                      <View style={styles.selectWrap}>
                        <select
                          value={formCategory}
                          onChange={(e: any) => setFormCategory(e.target.value)}
                          style={styles.nativeSelect as any}
                        >
                          <option value="Senior Men">Senior Men</option>
                          <option value="Under-19">Under-19 District</option>
                          <option value="Under-16">Under-16 Talent Trophy</option>
                          <option value="Under-14">Under-14 Cadets</option>
                          <option value="Senior Women">Senior Women</option>
                          <option value="Open District">Open District Championship</option>
                        </select>
                      </View>
                    </View>

                    <View style={styles.formColThird}>
                      <Text style={styles.inputLabel}>Gender</Text>
                      <View style={styles.selectWrap}>
                        <select
                          value={formGender}
                          onChange={(e: any) => setFormGender(e.target.value)}
                          style={styles.nativeSelect as any}
                        >
                          <option value="Men">Men</option>
                          <option value="Women">Women</option>
                          <option value="Open">Open</option>
                        </select>
                      </View>
                    </View>

                    <View style={styles.formColThird}>
                      <Text style={styles.inputLabel}>Ball Type</Text>
                      <View style={styles.selectWrap}>
                        <select
                          value={formBallType}
                          onChange={(e: any) => setFormBallType(e.target.value)}
                          style={styles.nativeSelect as any}
                        >
                          <option value="Red Leather">Red Leather</option>
                          <option value="White Leather">White Leather</option>
                          <option value="Pink Leather">Pink Leather</option>
                          <option value="Tennis">Heavy Tennis Ball</option>
                        </select>
                      </View>
                    </View>
                  </View>

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
                </View>
              )}

              {/* ── STEP 2: SCHEDULE & RULES ──────────────────────────────── */}
              {wizardStep === 2 && (
                <View style={styles.formSection}>
                  <Text style={styles.sectionHeading}>Championship Schedule & Playing Rules</Text>

                  <View style={styles.formRow}>
                    <View style={styles.formColHalf}>
                      <Text style={styles.inputLabel}>Championship Start Date *</Text>
                      <input
                        type="date"
                        value={formStartDate}
                        onChange={(e: any) => setFormStartDate(e.target.value)}
                        style={styles.nativeDateInput as any}
                      />
                    </View>

                    <View style={styles.formColHalf}>
                      <Text style={styles.inputLabel}>Championship End Date *</Text>
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

                  <View style={styles.formRow}>
                    <View style={styles.formColFull}>
                      <Text style={styles.inputLabel}>Primary District Venue / Stadium</Text>
                      <View style={styles.selectWrap}>
                        <select
                          value={formVenue}
                          onChange={(e: any) => setFormVenue(e.target.value)}
                          style={styles.nativeSelect as any}
                        >
                          {dbVenues.map(v => (
                            <option key={v.id || v.name} value={v.name}>
                              {v.name} ({v.location || 'Virudhunagar'})
                            </option>
                          ))}
                        </select>
                      </View>
                    </View>
                  </View>

                  <View style={styles.formRow}>
                    <View style={styles.formColFourth}>
                      <Text style={styles.inputLabel}>Min Teams</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={formMinTeams}
                        onChangeText={setFormMinTeams}
                      />
                    </View>
                    <View style={styles.formColFourth}>
                      <Text style={styles.inputLabel}>Max Teams</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={formMaxTeams}
                        onChangeText={setFormMaxTeams}
                      />
                    </View>
                    <View style={styles.formColFourth}>
                      <Text style={styles.inputLabel}>Overs / Match</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={formOvers}
                        onChangeText={setFormOvers}
                      />
                    </View>
                    <View style={styles.formColFourth}>
                      <Text style={styles.inputLabel}>Playing XI Size</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={formPlayingXI}
                        onChangeText={setFormPlayingXI}
                      />
                    </View>
                  </View>

                  {/* Points System */}
                  <View style={styles.pointsConfigBox}>
                    <Text style={styles.pointsConfigTitle}>🏆 Points Allocation Rules</Text>
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.inputLabel}>Points for Win</Text>
                        <TextInput
                          style={styles.textInput}
                          keyboardType="numeric"
                          value={formPointsWin}
                          onChangeText={setFormPointsWin}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.inputLabel}>Points for Tie</Text>
                        <TextInput
                          style={styles.textInput}
                          keyboardType="numeric"
                          value={formPointsTie}
                          onChangeText={setFormPointsTie}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.inputLabel}>Points for No Result (NR)</Text>
                        <TextInput
                          style={styles.textInput}
                          keyboardType="numeric"
                          value={formPointsNR}
                          onChangeText={setFormPointsNR}
                        />
                      </View>
                    </View>
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
                              <Text style={styles.teamCardName} numberOfLines={1}>
                                {t.name || t.team_name}
                              </Text>
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
                  <Text style={styles.sectionHeading}>Dynamic Tournament Format Configuration</Text>
                  <Text style={styles.sectionSub}>
                    Configure match pairings, round-robin stages, and knockout progression rules.
                  </Text>

                  {/* Summary Card */}
                  <View style={styles.formatSummaryCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={{ fontSize: 28 }}>⚙️</Text>
                      <View>
                        <Text style={styles.formatSummaryTitle}>
                          {formTournamentType === 'LEAGUE'
                            ? 'League Stage (Round Robin)'
                            : formTournamentType === 'KNOCKOUT'
                            ? 'Knockout Bracket System'
                            : 'League + Knockout Hybrid System'}
                        </Text>
                        <Text style={styles.formatSummarySub}>
                          {selectedTeamIds.length} Teams Selected • Estimated Matches: {estimatedMatchesCount}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Dynamic Controls by Type */}
                  {formTournamentType === 'LEAGUE' && (
                    <View style={styles.formatConfigBox}>
                      <Text style={styles.configBoxTitle}>Round Robin Format</Text>
                      <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                        <TouchableOpacity
                          style={[styles.formatOptionBtn, formRoundRobinType === 'SINGLE' && styles.formatOptionBtnActive]}
                          onPress={() => setFormRoundRobinType('SINGLE')}
                        >
                          <Text style={[styles.formatOptionTitle, formRoundRobinType === 'SINGLE' && styles.formatOptionTitleActive]}>
                            Single Round Robin
                          </Text>
                          <Text style={styles.formatOptionSub}>
                            Every team plays every other team once ({selectedTeamIds.length * (selectedTeamIds.length - 1) / 2} matches).
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.formatOptionBtn, formRoundRobinType === 'DOUBLE' && styles.formatOptionBtnActive]}
                          onPress={() => setFormRoundRobinType('DOUBLE')}
                        >
                          <Text style={[styles.formatOptionTitle, formRoundRobinType === 'DOUBLE' && styles.formatOptionTitleActive]}>
                            Double Round Robin
                          </Text>
                          <Text style={styles.formatOptionSub}>
                            Each team plays home & away fixtures ({selectedTeamIds.length * (selectedTeamIds.length - 1)} matches).
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {formTournamentType === 'KNOCKOUT' && (
                    <View style={styles.formatConfigBox}>
                      <Text style={styles.configBoxTitle}>Bracket Elimination Progression</Text>
                      <Text style={styles.configBoxSub}>
                        Automatically calculated stages based on {selectedTeamIds.length} participating clubs:
                      </Text>
                      <View style={styles.knockoutStagesList}>
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
                      </View>
                    </View>
                  )}

                  {formTournamentType === 'LEAGUE_KNOCKOUT' && (
                    <View style={styles.formatConfigBox}>
                      <Text style={styles.configBoxTitle}>League + Knockout Configuration</Text>
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
        <View style={styles.modalOverlay}>
          <View style={styles.detailsModalCard}>
            {detailsLoading || !selectedTournament ? (
              <View style={[styles.centerLoading, { height: 400 }]}>
                <ActivityIndicator size="large" color="#d4af37" />
                <Text style={styles.loadingText}>Loading Championship Central Dashboard...</Text>
              </View>
            ) : (
              <>
                {/* ── ROYAL HEADER BANNER ─────────────────────────────────── */}
                <View style={styles.detailsBanner}>
                  <View style={styles.detailsBannerLeft}>
                    <View style={styles.detailsBannerLogo}>
                      {selectedTournament.logo_url ? (
                        <Image source={{ uri: selectedTournament.logo_url }} style={styles.detailsLogoImg} />
                      ) : (
                        <Text style={styles.detailsLogoFallback}>
                          {(selectedTournament.short_name || selectedTournament.name || 'TN').slice(0, 3).toUpperCase()}
                        </Text>
                      )}
                    </View>

                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={styles.bannerSeasonTag}>Season {selectedTournament.season || '2026'}</Text>
                        <Text style={styles.bannerCategoryTag}>{selectedTournament.category || 'Senior District'}</Text>
                        <View style={styles.statusBadgeOngoing}>
                          <Text style={[styles.statusBadgeText, { color: '#15803d' }]}>
                            {selectedTournament.status || 'ONGOING'}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.detailsBannerTitle}>{selectedTournament.name}</Text>
                      <Text style={styles.detailsBannerMeta}>
                        📍 {selectedTournament.venue || 'Kamarajar District Stadium'} • 📅 {selectedTournament.start_date} to {selectedTournament.end_date} • 🏏 {selectedTournament.match_format || 'T20'} ({selectedTournament.overs_per_match || 20} Overs)
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailsBannerActions}>
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

                {/* ── DETAILS TABS BAR ────────────────────────────────────── */}
                <View style={styles.detailsTabsBar}>
                  {[
                    { key: 'overview', label: '📊 Overview' },
                    { key: 'teams', label: `🛡️ Participating Teams (${(selectedTournament.participating_teams || []).length})` },
                    { key: 'schedule', label: `📅 Matches (${(selectedTournament.matches || []).length})` },
                    { key: 'points', label: '🏆 Points Table' },
                    { key: 'stats', label: '📈 Statistics' },
                    { key: 'rules', label: '📜 Rules & Playing Conditions' }
                  ].map(tab => {
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
                </View>

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

                  {/* TAB 3: SCHEDULE & MATCHES */}
                  {detailsTab === 'schedule' && (
                    <View>
                      {/* Filter Bar */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
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
                                  <Text style={styles.matchMetaText}>📍 {m.venue}</Text>
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

                      {(selectedTournament.points_table || []).length === 0 ? (
                        <View style={styles.emptyStateCard}>
                          <Text style={{ fontSize: 32, marginBottom: 8 }}>📊</Text>
                          <Text style={styles.emptyStateTitle}>Points Table Empty</Text>
                          <Text style={styles.emptyStateSub}>Standings will update automatically as tournament matches are completed and scored.</Text>
                        </View>
                      ) : (
                        <View style={styles.tableCard}>
                          {/* Table Header */}
                          <View style={styles.tableHeaderRow}>
                            <Text style={[styles.thCell, { width: 44, textAlign: 'center' }]}>POS</Text>
                            <Text style={[styles.thCell, { flex: 2 }]}>TEAM</Text>
                            <Text style={[styles.thCell, { width: 40, textAlign: 'center' }]}>P</Text>
                            <Text style={[styles.thCell, { width: 40, textAlign: 'center' }]}>W</Text>
                            <Text style={[styles.thCell, { width: 40, textAlign: 'center' }]}>L</Text>
                            <Text style={[styles.thCell, { width: 40, textAlign: 'center' }]}>T</Text>
                            <Text style={[styles.thCell, { width: 40, textAlign: 'center' }]}>NR</Text>
                            <Text style={[styles.thCell, { width: 50, textAlign: 'center', color: '#020612', fontWeight: '800' }]}>PTS</Text>
                            <Text style={[styles.thCell, { width: 75, textAlign: 'center' }]}>NRR</Text>
                            <Text style={[styles.thCell, { width: 85, textAlign: 'center' }]}>LAST 5</Text>
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

                                <View style={{ flex: 2, paddingLeft: 8 }}>
                                  <Text style={styles.tableTeamName}>{row.team_name}</Text>
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
                                <View style={{ width: 85, flexDirection: 'row', justifyContent: 'center', gap: 3 }}>
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
                      )}
                    </View>
                  )}

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
                      <Text style={styles.cardSectionTitle}>Official Playing Conditions & Championship Constitution</Text>
                      <View style={styles.rulesTextBox}>
                        <Text style={styles.rulesContentText}>
                          {selectedTournament.rules || 'Standard ICC / TNCA Playing Conditions apply to all district matches.'}
                        </Text>
                      </View>
                    </View>
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
    minWidth: 160,
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
    minWidth: 260,
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
    minWidth: 320,
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

  // Modal common
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
    maxHeight: '92%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 20px 40px rgba(0,0,0,0.35)'
  },
  wizardHeader: {
    backgroundColor: '#0a2540',
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: '#d4af37'
  },
  wizardHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff'
  },
  wizardHeaderSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center'
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
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  stepperItemActive: {
    borderBottomColor: '#d4af37',
    backgroundColor: '#ffffff'
  },
  stepperText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b'
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
    flex: 1
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
    gap: 12,
    marginBottom: 4
  },
  formColFull: { flex: 1 },
  formColHalf: { flex: 1 },
  formColThird: { flex: 1 },
  formColFourth: { flex: 1 },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 5
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
    outlineStyle: 'none'
  },
  nativeSelect: {
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    outlineStyle: 'none'
  },
  selectWrap: {
    width: '100%'
  },
  nativeDateInput: {
    width: '100%',
    paddingVertical: 7,
    paddingHorizontal: 10,
    fontSize: 13,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    outlineStyle: 'none'
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
    maxHeight: '94%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 25px 50px rgba(0,0,0,0.45)'
  },
  detailsBanner: {
    backgroundColor: '#020612',
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: '#d4af37'
  },
  detailsBannerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center'
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
  detailsBannerTitle: { fontSize: 20, fontWeight: '900', color: '#ffffff', marginTop: 3 },
  detailsBannerMeta: { fontSize: 12, color: '#94a3b8', marginTop: 3 },
  detailsBannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
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
    paddingHorizontal: 12,
    overflow: 'scroll'
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
    backgroundColor: '#f8fafc'
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
    minWidth: 280,
    maxWidth: 380,
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
