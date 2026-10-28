/**
 * services/tournamentService.js
 * Comprehensive Tournament Management & Championship Operations Service.
 * Implements tournament creation, team selection, dynamic fixture generation,
 * live points table calculation, and tournament statistical aggregation.
 */

const db = require('../config/db');
const tournamentModel = require('../models/tournamentModel');
const tournamentRegistrationModel = require('../models/tournamentRegistrationModel');

class TournamentService {
  /**
   * Helper: Add administrative audit log
   */
  async _logAudit(action, adminEmail, target, result, details) {
    try {
      await db.initDb();
      await db.models.AuditLog.create({
        id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        action,
        initiated_by: adminEmail || 'admin@cfvd.org',
        target_user: target || 'Tournament',
        result,
        details,
        timestamp: new Date()
      });
    } catch (_err) {
      // Non-blocking audit error
    }
  }

  /**
   * Get all tournaments with computed metrics
   */
  async getTournaments({ status, search } = {}) {
    await db.initDb();
    const rawTournaments = await tournamentModel.getAll({ status, search });

    // Fetch match counts and tournament registration counts per tournament in parallel
    const tournamentIds = rawTournaments.map(t => t.id);
    const [matches, registrations] = await Promise.all([
      db.models.Match.find({
        tournament_id: { $in: tournamentIds }
      }).select('id tournament_id status').lean(),
      db.models.TournamentRegistration.find({
        tournament_id: { $in: tournamentIds }
      }).select('tournament_id status').lean()
    ]);

    const matchesByTour = {};
    matches.forEach(m => {
      if (!matchesByTour[m.tournament_id]) {
        matchesByTour[m.tournament_id] = { total: 0, scheduled: 0, live: 0, completed: 0, cancelled: 0 };
      }
      matchesByTour[m.tournament_id].total++;
      const s = (m.status || '').toUpperCase();
      if (s === 'SCHEDULED') matchesByTour[m.tournament_id].scheduled++;
      else if (s === 'LIVE' || s === 'INNINGS_BREAK' || s === 'TOSS' || s === 'PAUSED') matchesByTour[m.tournament_id].live++;
      else if (s === 'COMPLETED') matchesByTour[m.tournament_id].completed++;
      else if (s === 'CANCELLED' || s === 'ABANDONED') matchesByTour[m.tournament_id].cancelled++;
    });

    const regStatsByTour = {};
    registrations.forEach(r => {
      if (!regStatsByTour[r.tournament_id]) {
        regStatsByTour[r.tournament_id] = { total: 0, pending: 0, approved: 0, rejected: 0 };
      }
      regStatsByTour[r.tournament_id].total++;
      const st = (r.status || '').toUpperCase();
      if (st === 'APPROVED') regStatsByTour[r.tournament_id].approved++;
      else if (st === 'PENDING') regStatsByTour[r.tournament_id].pending++;
      else if (st === 'REJECTED') regStatsByTour[r.tournament_id].rejected++;
    });

    const todayStr = new Date().toISOString().split('T')[0];

    return rawTournaments.map(t => {
      const matchStats = matchesByTour[t.id] || { total: 0, scheduled: 0, live: 0, completed: 0, cancelled: 0 };
      const regStat = regStatsByTour[t.id] || { total: 0, pending: 0, approved: 0, rejected: 0 };
      
      let currentStatus = (t.status || 'UPCOMING').toUpperCase();
      if (currentStatus === 'ACTIVE') currentStatus = 'REGISTRATION_OPEN';
      
      // Auto-compute status if still UPCOMING but start_date has arrived
      if (currentStatus === 'UPCOMING' && t.start_date && t.start_date <= todayStr) {
        currentStatus = 'ONGOING';
      }
      // If end_date passed and all matches completed
      if (currentStatus === 'ONGOING' && t.end_date && t.end_date < todayStr && matchStats.total > 0 && matchStats.completed === matchStats.total) {
        currentStatus = 'COMPLETED';
      }

      const approvedTeamsCount = Math.max((t.teams || []).length, regStat.approved);
      const maxTeams = Number(t.max_teams || 16);
      const availableSlots = Math.max(0, maxTeams - approvedTeamsCount);
      const isFull = approvedTeamsCount >= maxTeams;

      let isRegistrationOpen = currentStatus === 'REGISTRATION_OPEN';
      if (t.registration_end_date && t.registration_end_date < todayStr) {
        isRegistrationOpen = false;
      }
      if (isFull || currentStatus === 'COMPLETED' || currentStatus === 'CANCELLED' || currentStatus === 'INACTIVE' || currentStatus === 'REGISTRATION_CLOSED') {
        isRegistrationOpen = false;
      }

      return {
        ...t,
        status: currentStatus,
        teams_count: approvedTeamsCount,
        approved_teams_count: approvedTeamsCount,
        registered_teams_count: regStat.total,
        pending_registrations_count: regStat.pending,
        available_slots: availableSlots,
        is_full: isFull,
        is_registration_open: isRegistrationOpen,
        registration_stats: regStat,
        match_stats: matchStats
      };
    });
  }

  /**
   * Get tournament details by ID, populated with teams, matches, points table, and statistics
   */
  async getTournamentById(tournamentId) {
    await db.initDb();
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw { status: 404, message: `Tournament with ID '${tournamentId}' not found.` };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    let currentStatus = (tournament.status || 'UPCOMING').toUpperCase();
    if (currentStatus === 'ACTIVE') currentStatus = 'ONGOING';
    if (currentStatus === 'UPCOMING' && tournament.start_date && tournament.start_date <= todayStr) {
      currentStatus = 'ONGOING';
    }

    // 1. Fetch participating teams details
    const teamIds = tournament.teams || [];
    let participatingTeams = [];
    if (teamIds.length > 0) {
      const [regularTeams, regTeams] = await Promise.all([
        db.models.Team.find({ id: { $in: teamIds } }).lean(),
        db.models.TeamRegistration.find({ id: { $in: teamIds } }).lean()
      ]);

      const teamMap = {};
      regularTeams.forEach(rt => {
        teamMap[rt.id] = {
          id: rt.id,
          team_id: rt.team_id || rt.id,
          name: rt.name || rt.team_name,
          short_name: rt.short_name || 'VND',
          coach_name: rt.coach_name || '—',
          coach_email: rt.coach_email || '',
          city: rt.city || rt.taluk || 'Virudhunagar',
          captain: rt.captain || '—',
          vice_captain: rt.vice_captain || '—',
          status: rt.status || 'ACTIVE'
        };
      });

      regTeams.forEach(reg => {
        if (!teamMap[reg.id]) {
          teamMap[reg.id] = {
            id: reg.id,
            team_id: reg.id,
            name: reg.team_name,
            short_name: reg.team_name.split(' ').map(w => w[0]).join('').slice(0, 4).toUpperCase(),
            coach_name: reg.coach_name,
            coach_email: reg.coach_email,
            city: reg.city || reg.taluk || 'Virudhunagar',
            captain: '—',
            vice_captain: '—',
            status: reg.status
          };
        }
      });

      participatingTeams = teamIds.map(tid => teamMap[tid] || { id: tid, name: tid });
    }

    // 2. Fetch all matches for this tournament
    const matches = await db.models.Match.find({
      $or: [
        { tournament_id: tournament.id },
        { tournament_name: tournament.name }
      ]
    }).sort({ match_date: 1, match_time: 1 }).lean();

    // 3. Populate team names on matches for quick display
    const teamNameMap = {};
    participatingTeams.forEach(t => {
      teamNameMap[t.id] = t.name;
    });

    const formattedMatches = matches.map(m => ({
      ...m,
      team_a_name: m.team_a_name || teamNameMap[m.team_a_id] || m.team_a_id,
      team_b_name: m.team_b_name || teamNameMap[m.team_b_id] || m.team_b_id
    }));

    // 4. Compute Points Table
    const pointsTable = await this.getPointsTable(tournament.id, tournament, participatingTeams, formattedMatches);

    // 5. Compute Statistics
    const statistics = await this.getTournamentStatistics(tournament.id, formattedMatches);

    return {
      ...tournament,
      status: currentStatus,
      participating_teams: participatingTeams,
      teams_count: participatingTeams.length,
      matches: formattedMatches,
      matches_count: formattedMatches.length,
      points_table: pointsTable,
      statistics
    };
  }

  /**
   * Create a new tournament
   */
  async createTournament(payload, adminEmail) {
    await db.initDb();

    // Validate Tournament Name
    if (!payload.name || !String(payload.name).trim()) {
      throw { status: 400, message: 'Tournament Name is required.' };
    }
    const cleanName = String(payload.name).trim();

    // Check duplicate tournament name
    const existing = await tournamentModel.findByName(cleanName);
    if (existing) {
      throw { status: 400, message: `A tournament with name '${cleanName}' already exists. Please choose a unique name.` };
    }

    // Validate Dates
    if (!payload.start_date || !String(payload.start_date).trim()) {
      throw { status: 400, message: 'Tournament Start Date is required.' };
    }
    if (!payload.end_date || !String(payload.end_date).trim()) {
      throw { status: 400, message: 'Tournament End Date is required.' };
    }

    const startDate = new Date(payload.start_date);
    const endDate = new Date(payload.end_date);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw { status: 400, message: 'Start Date and End Date must be valid dates (YYYY-MM-DD).' };
    }
    if (endDate < startDate) {
      throw { status: 400, message: 'Tournament End Date cannot be before Start Date.' };
    }

    // Validate Registration Dates if supplied
    if (payload.registration_start_date && payload.registration_end_date) {
      const regStart = new Date(payload.registration_start_date);
      const regEnd = new Date(payload.registration_end_date);
      if (regEnd < regStart) {
        throw { status: 400, message: 'Registration End Date cannot be before Registration Start Date.' };
      }
    }

    // Validate Teams selection limits
    const teams = Array.isArray(payload.teams) ? payload.teams : [];
    const maxTeams = Number(payload.max_teams || 16);
    const minTeams = Number(payload.min_teams || 2);

    if (teams.length > maxTeams) {
      throw { status: 400, message: `Selected teams count (${teams.length}) exceeds the maximum team limit of ${maxTeams}.` };
    }

    // Determine initial status & tournament type
    const todayStr = new Date().toISOString().split('T')[0];
    let initialStatus = payload.status ? String(payload.status).toUpperCase() : 'UPCOMING';
    if (!payload.status) {
      if (payload.registration_start_date && payload.registration_start_date <= todayStr && (!payload.registration_end_date || payload.registration_end_date >= todayStr)) {
        initialStatus = 'REGISTRATION_OPEN';
      } else if (payload.start_date <= todayStr && payload.end_date >= todayStr) {
        initialStatus = 'ONGOING';
      } else if (payload.end_date < todayStr) {
        initialStatus = 'COMPLETED';
      }
    }

    let tourType = 'LEAGUE';
    const rawType = String(payload.tournament_type || payload.type || '').toUpperCase();
    if (rawType.includes('KNOCKOUT') && rawType.includes('LEAGUE')) tourType = 'LEAGUE_KNOCKOUT';
    else if (rawType.includes('KNOCKOUT')) tourType = 'KNOCKOUT';
    else tourType = 'LEAGUE';

    const tourId = payload.id || `T-${Date.now()}`;
    const newTournamentData = {
      id: tourId,
      name: cleanName,
      short_name: (payload.short_name || '').trim(),
      logo_url: (payload.logo_url || '').trim(),
      description: (payload.description || '').trim(),
      tournament_type: tourType,
      category: payload.category || 'Senior District Trophy',
      gender: payload.gender || 'Men',
      ball_type: payload.ball_type || 'Red Leather',
      match_format: payload.match_format || 'T20',
      format: payload.match_format || 'T20',
      overs_per_match: Number(payload.overs_per_match || payload.overs || 20),
      season: payload.season || '2026',
      venue: (payload.venue || 'Kamarajar District Stadium').trim(),
      start_date: payload.start_date,
      end_date: payload.end_date,
      registration_start_date: payload.registration_start_date || null,
      registration_end_date: payload.registration_end_date || null,
      max_teams: maxTeams,
      min_teams: minTeams,
      points_win: Number(payload.points_win !== undefined ? payload.points_win : 2),
      points_tie: Number(payload.points_tie !== undefined ? payload.points_tie : 1),
      points_no_result: Number(payload.points_no_result !== undefined ? payload.points_no_result : 1),
      playing_xi_size: Number(payload.playing_xi_size || 11),
      substitute_count: Number(payload.substitute_count || 4),
      allow_super_over: payload.allow_super_over !== false,
      allow_dls: Boolean(payload.allow_dls),
      rules: (payload.rules || 'Standard ICC / TNCA Playing Conditions').trim(),
      format_config: {
        round_robin_type: payload.format_config?.round_robin_type || 'SINGLE',
        knockout_stages: payload.format_config?.knockout_stages || ['Semi Final', 'Final'],
        qualifying_teams_count: Number(payload.format_config?.qualifying_teams_count || 4),
        qualification_rules: payload.format_config?.qualification_rules || 'Top qualifying teams advance to knockout stage'
      },
      teams,
      status: initialStatus,
      created_by: adminEmail || 'admin@cfvd.org'
    };

    const tournament = await tournamentModel.create(newTournamentData);

    await this._logAudit(
      'CREATE_TOURNAMENT',
      adminEmail,
      cleanName,
      `Tournament '${cleanName}' created successfully`,
      `Type: ${newTournamentData.tournament_type}, Teams: ${teams.length}, Format: ${newTournamentData.match_format}`
    );

    return tournament.toObject ? tournament.toObject() : tournament;
  }

  /**
   * Update tournament
   */
  async updateTournament(tournamentId, payload, adminEmail) {
    await db.initDb();
    const existing = await tournamentModel.findById(tournamentId);
    if (!existing) {
      throw { status: 404, message: `Tournament with ID '${tournamentId}' not found.` };
    }

    // Name uniqueness validation if changed
    if (payload.name && payload.name.trim() !== existing.name) {
      const duplicate = await tournamentModel.findByName(payload.name, existing.id);
      if (duplicate) {
        throw { status: 400, message: `A tournament with name '${payload.name.trim()}' already exists.` };
      }
    }

    // Date range validation if changed
    const startDateStr = payload.start_date || existing.start_date;
    const endDateStr = payload.end_date || existing.end_date;
    if (startDateStr && endDateStr) {
      const s = new Date(startDateStr);
      const e = new Date(endDateStr);
      if (e < s) {
        throw { status: 400, message: 'Tournament End Date cannot be before Start Date.' };
      }
    }

    const updateFields = {
      ...(payload.name && { name: payload.name.trim() }),
      ...(payload.short_name !== undefined && { short_name: String(payload.short_name).trim() }),
      ...(payload.logo_url !== undefined && { logo_url: String(payload.logo_url).trim() }),
      ...(payload.description !== undefined && { description: String(payload.description).trim() }),
      ...(payload.tournament_type && { tournament_type: payload.tournament_type }),
      ...(payload.category && { category: payload.category }),
      ...(payload.gender && { gender: payload.gender }),
      ...(payload.ball_type && { ball_type: payload.ball_type }),
      ...(payload.match_format && { match_format: payload.match_format, format: payload.match_format }),
      ...(payload.overs_per_match && { overs_per_match: Number(payload.overs_per_match) }),
      ...(payload.season && { season: payload.season }),
      ...(payload.venue && { venue: payload.venue.trim() }),
      ...(payload.start_date && { start_date: payload.start_date }),
      ...(payload.end_date && { end_date: payload.end_date }),
      ...(payload.registration_start_date !== undefined && { registration_start_date: payload.registration_start_date }),
      ...(payload.registration_end_date !== undefined && { registration_end_date: payload.registration_end_date }),
      ...(payload.max_teams && { max_teams: Number(payload.max_teams) }),
      ...(payload.min_teams && { min_teams: Number(payload.min_teams) }),
      ...(payload.points_win !== undefined && { points_win: Number(payload.points_win) }),
      ...(payload.points_tie !== undefined && { points_tie: Number(payload.points_tie) }),
      ...(payload.points_no_result !== undefined && { points_no_result: Number(payload.points_no_result) }),
      ...(payload.playing_xi_size && { playing_xi_size: Number(payload.playing_xi_size) }),
      ...(payload.substitute_count && { substitute_count: Number(payload.substitute_count) }),
      ...(payload.allow_super_over !== undefined && { allow_super_over: Boolean(payload.allow_super_over) }),
      ...(payload.allow_dls !== undefined && { allow_dls: Boolean(payload.allow_dls) }),
      ...(payload.rules && { rules: payload.rules }),
      ...(payload.format_config && { format_config: payload.format_config }),
      ...(Array.isArray(payload.teams) && { teams: payload.teams }),
      ...(payload.status && { status: payload.status.toUpperCase() }),
      updatedAt: new Date()
    };

    const updated = await tournamentModel.update(tournamentId, updateFields);

    await this._logAudit(
      'UPDATE_TOURNAMENT',
      adminEmail,
      updated.name,
      `Tournament '${updated.name}' updated`,
      `Updated fields: ${Object.keys(updateFields).join(', ')}`
    );

    return updated;
  }

  /**
   * Delete or deactivate tournament
   */
  async deleteTournament(tournamentId, adminEmail) {
    await db.initDb();
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw { status: 404, message: `Tournament with ID '${tournamentId}' not found.` };
    }

    // Check if tournament has completed or active matches
    const activeMatchesCount = await db.models.Match.countDocuments({
      tournament_id: tournament.id,
      status: { $in: ['LIVE', 'COMPLETED', 'INNINGS_BREAK'] }
    });

    if (activeMatchesCount > 0) {
      // Soft-deactivate by setting status to CANCELLED to preserve history
      const updated = await tournamentModel.update(tournament.id, {
        status: 'CANCELLED',
        updatedAt: new Date()
      });
      await this._logAudit(
        'CANCEL_TOURNAMENT',
        adminEmail,
        tournament.name,
        `Tournament '${tournament.name}' deactivated (marked CANCELLED) due to existing matches`,
        `Preserved ${activeMatchesCount} active/completed match scorecards.`
      );
      return {
        success: true,
        deactivated: true,
        message: `Tournament has ${activeMatchesCount} completed/active matches. It has been deactivated and marked CANCELLED to preserve match history and player statistics.`,
        tournament: updated
      };
    }

    // Otherwise, clean up scheduled matches and remove tournament
    await db.models.Match.deleteMany({
      tournament_id: tournament.id,
      status: 'SCHEDULED'
    });

    await tournamentModel.delete(tournament.id);

    await this._logAudit(
      'DELETE_TOURNAMENT',
      adminEmail,
      tournament.name,
      `Tournament '${tournament.name}' completely deleted`,
      `Removed tournament and cleaned up unscheduled fixtures.`
    );

    return {
      success: true,
      deleted: true,
      message: `Tournament '${tournament.name}' has been deleted successfully.`
    };
  }

  /**
   * Add teams to a tournament
   */
  async addTeams(tournamentId, teamIds, adminEmail) {
    await db.initDb();
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw { status: 404, message: `Tournament with ID '${tournamentId}' not found.` };
    }

    const currentTeams = tournament.teams || [];
    const newTeamIds = Array.isArray(teamIds) ? teamIds : [teamIds];
    const combined = Array.from(new Set([...currentTeams, ...newTeamIds]));

    if (combined.length > (tournament.max_teams || 16)) {
      throw {
        status: 400,
        message: `Total teams (${combined.length}) would exceed maximum allowed teams (${tournament.max_teams || 16}).`
      };
    }

    const updated = await tournamentModel.update(tournament.id, {
      teams: combined,
      updatedAt: new Date()
    });

    await this._logAudit(
      'ADD_TOURNAMENT_TEAMS',
      adminEmail,
      tournament.name,
      `Added ${newTeamIds.length} teams to tournament '${tournament.name}'`,
      `Total participating teams: ${combined.length}`
    );

    return updated;
  }

  /**
   * Remove a team from a tournament
   */
  async removeTeam(tournamentId, teamId, adminEmail) {
    await db.initDb();
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw { status: 404, message: `Tournament with ID '${tournamentId}' not found.` };
    }

    // Check if team has played matches in this tournament
    const matchesPlayed = await db.models.Match.countDocuments({
      tournament_id: tournament.id,
      $or: [{ team_a_id: teamId }, { team_b_id: teamId }],
      status: { $in: ['LIVE', 'COMPLETED', 'INNINGS_BREAK'] }
    });

    if (matchesPlayed > 0) {
      throw {
        status: 400,
        message: `Cannot remove team '${teamId}' because they have already participated in ${matchesPlayed} live or completed match(es).`
      };
    }

    const currentTeams = tournament.teams || [];
    const filtered = currentTeams.filter(t => t !== teamId);

    const updated = await tournamentModel.update(tournament.id, {
      teams: filtered,
      updatedAt: new Date()
    });

    await this._logAudit(
      'REMOVE_TOURNAMENT_TEAM',
      adminEmail,
      tournament.name,
      `Removed team '${teamId}' from tournament '${tournament.name}'`,
      `Remaining teams: ${filtered.length}`
    );

    return updated;
  }

  /**
   * Generate Tournament Matches Fixtures
   * Supports Single Round-Robin, Double Round-Robin, Knockout Brackets, and League + Knockout
   */
  async generateMatches(tournamentId, options = {}, adminEmail) {
    await db.initDb();
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw { status: 404, message: `Tournament with ID '${tournamentId}' not found.` };
    }

    const teams = tournament.teams || [];
    if (teams.length < 2) {
      throw {
        status: 400,
        message: `Cannot generate matches. Tournament has ${teams.length} team(s). At least 2 participating teams are required.`
      };
    }

    // Check if active/live/completed matches already exist
    const completedMatches = await db.models.Match.countDocuments({
      tournament_id: tournament.id,
      status: { $in: ['LIVE', 'COMPLETED', 'INNINGS_BREAK'] }
    });

    if (completedMatches > 0 && !options.force) {
      throw {
        status: 400,
        message: `Cannot regenerate tournament fixtures. ${completedMatches} match(es) have already begun or completed.`
      };
    }

    // Clean up existing scheduled matches if regenerating
    await db.models.Match.deleteMany({
      tournament_id: tournament.id,
      status: 'SCHEDULED'
    });

    // Fetch team names for readable fixture creation
    const [teamDocs, regDocs] = await Promise.all([
      db.models.Team.find({ id: { $in: teams } }).lean(),
      db.models.TeamRegistration.find({ id: { $in: teams } }).lean()
    ]);
    const teamNameMap = {};
    teamDocs.forEach(t => { teamNameMap[t.id] = t.name || t.team_name; });
    regDocs.forEach(t => { if (!teamNameMap[t.id]) teamNameMap[t.id] = t.team_name; });

    const tournamentType = options.tournament_type || tournament.tournament_type || 'LEAGUE';
    const roundRobinType = options.round_robin_type || tournament.format_config?.round_robin_type || 'SINGLE';
    const venue = options.venue || tournament.venue || 'Kamarajar District Stadium';
    const matchType = options.match_format || tournament.match_format || 'T20';
    const oversPerSide = Number(options.overs_per_match || tournament.overs_per_match || 20);

    // Calculate dates spread across tournament window
    const startDate = new Date(tournament.start_date || new Date().toISOString().split('T')[0]);
    const endDate = new Date(tournament.end_date || new Date(startDate.getTime() + 14 * 86400000).toISOString().split('T')[0]);
    const totalDays = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / 86400000));

    const generatedFixtures = [];
    let matchCounter = 1;

    // Helper: calculate date for match index
    const getMatchDate = (index, total) => {
      const dayOffset = Math.floor((index / Math.max(1, total)) * totalDays);
      const d = new Date(startDate.getTime() + dayOffset * 86400000);
      return d.toISOString().split('T')[0];
    };

    // 1. LEAGUE / ROUND-ROBIN GENERATION
    if (tournamentType === 'LEAGUE' || tournamentType === 'LEAGUE_KNOCKOUT') {
      const pairings = [];
      const n = teams.length;

      // Single Round-Robin: Every pair plays once
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          pairings.push({ home: teams[i], away: teams[j], stage: 'LEAGUE_STAGE' });
        }
      }

      // Double Round-Robin: Reverse pairings for home & away
      if (roundRobinType === 'DOUBLE') {
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            pairings.push({ home: teams[j], away: teams[i], stage: 'LEAGUE_STAGE_RETURN' });
          }
        }
      }

      // Create fixtures
      pairings.forEach((p, idx) => {
        const matchId = `M-${tournament.id.replace(/[^a-zA-Z0-9]/g, '')}-${String(matchCounter).padStart(3, '0')}`;
        matchCounter++;
        const matchDate = getMatchDate(idx, pairings.length);
        const matchTime = idx % 2 === 0 ? '09:30 AM' : '02:30 PM';

        generatedFixtures.push({
          id: matchId,
          tournament_id: tournament.id,
          tournament_name: tournament.name,
          team_a_id: p.home,
          team_b_id: p.away,
          team_a_name: teamNameMap[p.home] || p.home,
          team_b_name: teamNameMap[p.away] || p.away,
          venue,
          match_date: matchDate,
          match_time: matchTime,
          match_type: matchType,
          overs_per_side: oversPerSide,
          stage: p.stage,
          status: 'SCHEDULED',
          assigned_scorer_id: 'SCR-101',
          umpire1_id: 'UMP-1894',
          umpire2_id: 'UMP-102',
          umpire1_name: 'Thiru. K. Sundaram',
          umpire2_name: 'Thiru. M. Ramanathan'
        });
      });
    }

    // 2. KNOCKOUT TOURNAMENT GENERATION
    if (tournamentType === 'KNOCKOUT') {
      const n = teams.length;
      let stageName = 'FINAL';
      if (n > 8) stageName = 'ROUND_OF_16';
      else if (n > 4) stageName = 'QUARTER_FINAL';
      else if (n > 2) stageName = 'SEMI_FINAL';

      // Seed initial round matches
      for (let i = 0; i < Math.floor(n / 2); i++) {
        const home = teams[i];
        const away = teams[n - 1 - i];
        const matchId = `M-${tournament.id.replace(/[^a-zA-Z0-9]/g, '')}-KO-${String(matchCounter).padStart(2, '0')}`;
        matchCounter++;
        const matchDate = getMatchDate(i, Math.floor(n / 2));
        const matchTime = i % 2 === 0 ? '09:30 AM' : '02:30 PM';

        generatedFixtures.push({
          id: matchId,
          tournament_id: tournament.id,
          tournament_name: tournament.name,
          team_a_id: home,
          team_b_id: away,
          team_a_name: teamNameMap[home] || home,
          team_b_name: teamNameMap[away] || away,
          venue,
          match_date: matchDate,
          match_time: matchTime,
          match_type: matchType,
          overs_per_side: oversPerSide,
          stage: stageName,
          status: 'SCHEDULED',
          assigned_scorer_id: 'SCR-101',
          umpire1_id: 'UMP-1894',
          umpire2_id: 'UMP-102',
          umpire1_name: 'Thiru. K. Sundaram',
          umpire2_name: 'Thiru. M. Ramanathan'
        });
      }
    }

    // Insert all generated fixtures atomically into MongoDB Match collection
    if (generatedFixtures.length > 0) {
      await db.models.Match.insertMany(generatedFixtures);
    }

    // If tournament was UPCOMING and now has matches, keep it ready
    await this._logAudit(
      'GENERATE_MATCHES',
      adminEmail,
      tournament.name,
      `Generated ${generatedFixtures.length} matches for tournament '${tournament.name}'`,
      `Format: ${tournamentType} (${roundRobinType}), Teams: ${teams.length}`
    );

    return {
      success: true,
      tournament_id: tournament.id,
      tournament_name: tournament.name,
      total_matches_generated: generatedFixtures.length,
      fixtures: generatedFixtures
    };
  }

  /**
   * Get official tournament points table calculated live from completed matches
   */
  async getPointsTable(tournamentId, cachedTournament = null, cachedTeams = null, cachedMatches = null) {
    await db.initDb();
    const tournament = cachedTournament || await tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw { status: 404, message: `Tournament with ID '${tournamentId}' not found.` };
    }

    const pointsWin = Number(tournament.points_win !== undefined ? tournament.points_win : 2);
    const pointsTie = Number(tournament.points_tie !== undefined ? tournament.points_tie : 1);
    const pointsNoResult = Number(tournament.points_no_result !== undefined ? tournament.points_no_result : 1);

    const teamIds = tournament.teams || [];
    let teams = cachedTeams;
    if (!teams) {
      const [regTeams, appTeams] = await Promise.all([
        db.models.Team.find({ id: { $in: teamIds } }).lean(),
        db.models.TeamRegistration.find({ id: { $in: teamIds } }).lean()
      ]);
      const teamMap = {};
      regTeams.forEach(t => { teamMap[t.id] = t.name || t.team_name; });
      appTeams.forEach(t => { if (!teamMap[t.id]) teamMap[t.id] = t.team_name; });
      teams = teamIds.map(id => ({ id, name: teamMap[id] || id }));
    }

    // Fetch all completed matches for this tournament
    const matches = cachedMatches ? cachedMatches.filter(m => m.status === 'COMPLETED') : await db.models.Match.find({
      $or: [
        { tournament_id: tournament.id },
        { tournament_name: tournament.name }
      ],
      status: 'COMPLETED'
    }).lean();

    // Fetch all completed innings for completed matches to calculate exact NRR
    const matchIds = matches.map(m => m.id);
    const inningsList = await db.models.Innings.find({
      match_id: { $in: matchIds },
      $or: [{ is_completed: true }, { status: 'COMPLETED' }]
    }).lean();

    const inningsByMatch = {};
    inningsList.forEach(inn => {
      if (!inningsByMatch[inn.match_id]) inningsByMatch[inn.match_id] = [];
      inningsByMatch[inn.match_id].push(inn);
    });

    // Initialize standings table
    const standings = {};
    teams.forEach(t => {
      standings[t.id] = {
        team_id: t.id,
        team_name: t.name,
        played: 0,
        won: 0,
        lost: 0,
        tied: 0,
        no_result: 0,
        points: 0,
        runs_scored: 0,
        overs_faced: 0,
        runs_conceded: 0,
        overs_bowled: 0,
        nrr: 0.00,
        form: []
      };
    });

    // Helper: convert overs string/decimal to real decimal overs (e.g. 19.3 -> 19 + 3/6 = 19.5)
    const toDecimalOvers = (oversVal, ballsVal = 0, isAllOut = false, maxOvers = 20) => {
      if (isAllOut && maxOvers > 0) return maxOvers;
      const o = typeof oversVal === 'number' ? oversVal : parseFloat(oversVal || 0);
      const b = typeof ballsVal === 'number' ? ballsVal : parseFloat(ballsVal || 0);
      const wholeOvers = Math.floor(o);
      const remainderBalls = Math.round((o - wholeOvers) * 10) || b;
      return wholeOvers + (remainderBalls / 6);
    };

    // Calculate match outcomes
    matches.forEach(m => {
      const teamA = m.team_a_id;
      const teamB = m.team_b_id;

      if (!standings[teamA]) {
        standings[teamA] = {
          team_id: teamA,
          team_name: m.team_a_name || teamA,
          played: 0, won: 0, lost: 0, tied: 0, no_result: 0, points: 0,
          runs_scored: 0, overs_faced: 0, runs_conceded: 0, overs_bowled: 0, nrr: 0.00, form: []
        };
      }
      if (!standings[teamB]) {
        standings[teamB] = {
          team_id: teamB,
          team_name: m.team_b_name || teamB,
          played: 0, won: 0, lost: 0, tied: 0, no_result: 0, points: 0,
          runs_scored: 0, overs_faced: 0, runs_conceded: 0, overs_bowled: 0, nrr: 0.00, form: []
        };
      }

      standings[teamA].played++;
      standings[teamB].played++;

      const res = (m.result_summary || '').toLowerCase();
      const teamAName = (m.team_a_name || '').toLowerCase();
      const teamBName = (m.team_b_name || '').toLowerCase();

      let winner = null;
      let isTie = false;
      let isNoResult = false;

      if (res.includes('tied') || res.includes('match tied')) {
        isTie = true;
      } else if (res.includes('no result') || res.includes('abandoned') || res.includes('cancelled')) {
        isNoResult = true;
      } else if (teamAName && res.includes(teamAName) && res.includes('won')) {
        winner = teamA;
      } else if (teamBName && res.includes(teamBName) && res.includes('won')) {
        winner = teamB;
      } else if (res.includes('won by')) {
        // Fallback: check runs from innings
        const matchInnings = inningsByMatch[m.id] || [];
        const inn1 = matchInnings.find(i => i.innings_number === 1);
        const inn2 = matchInnings.find(i => i.innings_number === 2);
        if (inn1 && inn2) {
          if (inn1.total_runs > inn2.total_runs) winner = inn1.batting_team_id;
          else if (inn2.total_runs > inn1.total_runs) winner = inn2.batting_team_id;
          else isTie = true;
        }
      }

      if (isTie) {
        standings[teamA].tied++;
        standings[teamB].tied++;
        standings[teamA].points += pointsTie;
        standings[teamB].points += pointsTie;
        standings[teamA].form.push('T');
        standings[teamB].form.push('T');
      } else if (isNoResult) {
        standings[teamA].no_result++;
        standings[teamB].no_result++;
        standings[teamA].points += pointsNoResult;
        standings[teamB].points += pointsNoResult;
        standings[teamA].form.push('NR');
        standings[teamB].form.push('NR');
      } else if (winner === teamA) {
        standings[teamA].won++;
        standings[teamA].points += pointsWin;
        standings[teamA].form.push('W');
        standings[teamB].lost++;
        standings[teamB].form.push('L');
      } else if (winner === teamB) {
        standings[teamB].won++;
        standings[teamB].points += pointsWin;
        standings[teamB].form.push('W');
        standings[teamA].lost++;
        standings[teamA].form.push('L');
      } else {
        // Fallback default
        standings[teamA].no_result++;
        standings[teamB].no_result++;
        standings[teamA].points += pointsNoResult;
        standings[teamB].points += pointsNoResult;
        standings[teamA].form.push('NR');
        standings[teamB].form.push('NR');
      }

      // Add NRR tallies from Innings
      const matchInns = inningsByMatch[m.id] || [];
      matchInns.forEach(inn => {
        const batTeam = inn.batting_team_id;
        const bowlTeam = inn.bowling_team_id;
        const isAllOut = inn.wickets >= 10;
        const maxOvers = m.overs_per_side || tournament.overs_per_match || 20;
        const decOvers = toDecimalOvers(inn.overs, inn.balls, isAllOut, maxOvers);

        if (standings[batTeam]) {
          standings[batTeam].runs_scored += (inn.total_runs || 0);
          standings[batTeam].overs_faced += decOvers;
        }
        if (standings[bowlTeam]) {
          standings[bowlTeam].runs_conceded += (inn.total_runs || 0);
          standings[bowlTeam].overs_bowled += decOvers;
        }
      });
    });

    // Calculate final Net Run Rate (NRR) & format
    const rows = Object.values(standings).map(row => {
      let nrr = 0.00;
      const runRateFor = row.overs_faced > 0 ? (row.runs_scored / row.overs_faced) : 0;
      const runRateAgainst = row.overs_bowled > 0 ? (row.runs_conceded / row.overs_bowled) : 0;
      nrr = parseFloat((runRateFor - runRateAgainst).toFixed(3));

      return {
        ...row,
        nrr: isNaN(nrr) ? 0.00 : nrr,
        nrr_formatted: (nrr > 0 ? `+${nrr.toFixed(3)}` : `${nrr.toFixed(3)}`),
        recent_form: row.form.slice(-5)
      };
    });

    // Sort by Points DESC, then NRR DESC, then Won DESC
    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.nrr !== a.nrr) return b.nrr - a.nrr;
      return b.won - a.won;
    });

    // Assign rank positions
    return rows.map((r, index) => ({
      position: index + 1,
      ...r
    }));
  }

  /**
   * Get tournament statistics (Top Batters, Top Bowlers, Team High Scores, Boundaries)
   */
  async getTournamentStatistics(tournamentId, cachedMatches = null) {
    await db.initDb();
    const matches = cachedMatches || await db.models.Match.find({
      $or: [
        { tournament_id: tournamentId },
        { tournament_name: tournamentId }
      ]
    }).lean();

    const matchIds = matches.map(m => m.id);
    if (matchIds.length === 0) {
      return {
        top_batters: [],
        top_bowlers: [],
        highest_team_totals: [],
        boundaries: { total_fours: 0, total_sixes: 0, total_boundaries: 0 }
      };
    }

    // 1. Fetch Batter stats across tournament
    const [batters, bowlers, inningsList] = await Promise.all([
      db.models.InningsBatter.find({ match_id: { $in: matchIds } }).lean(),
      db.models.InningsBowler.find({ match_id: { $in: matchIds } }).lean(),
      db.models.Innings.find({ match_id: { $in: matchIds } }).lean()
    ]);

    // Aggregate Batter stats
    const batterMap = {};
    let totalFours = 0;
    let totalSixes = 0;

    batters.forEach(b => {
      totalFours += (b.fours || 0);
      totalSixes += (b.sixes || 0);
      const pid = b.player_id || b.player_name;
      if (!batterMap[pid]) {
        batterMap[pid] = {
          player_id: pid,
          player_name: b.player_name || 'Batter',
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          highest_score: 0,
          innings_count: 0,
          fifties: 0,
          hundreds: 0
        };
      }
      batterMap[pid].runs += (b.runs || 0);
      batterMap[pid].balls += (b.balls || 0);
      batterMap[pid].fours += (b.fours || 0);
      batterMap[pid].sixes += (b.sixes || 0);
      batterMap[pid].innings_count++;
      if ((b.runs || 0) > batterMap[pid].highest_score) {
        batterMap[pid].highest_score = b.runs;
      }
      if (b.runs >= 100) batterMap[pid].hundreds++;
      else if (b.runs >= 50) batterMap[pid].fifties++;
    });

    const topBatters = Object.values(batterMap)
      .map(b => ({
        ...b,
        strike_rate: b.balls > 0 ? parseFloat(((b.runs / b.balls) * 100).toFixed(2)) : 0.00,
        average: b.innings_count > 0 ? parseFloat((b.runs / b.innings_count).toFixed(2)) : b.runs
      }))
      .sort((a, b) => b.runs - a.runs)
      .slice(0, 10);

    // Aggregate Bowler stats
    const bowlerMap = {};
    bowlers.forEach(b => {
      const pid = b.player_id || b.player_name;
      if (!bowlerMap[pid]) {
        bowlerMap[pid] = {
          player_id: pid,
          player_name: b.player_name || 'Bowler',
          wickets: 0,
          runs_conceded: 0,
          balls: 0,
          overs: 0,
          maidens: 0,
          best_bowling_wickets: 0,
          best_bowling_runs: 999
        };
      }
      bowlerMap[pid].wickets += (b.wickets || 0);
      bowlerMap[pid].runs_conceded += (b.runs_conceded || 0);
      bowlerMap[pid].maidens += (b.maidens || 0);
      const decOvers = (b.overs || 0) + ((b.balls || 0) / 6);
      bowlerMap[pid].overs += decOvers;

      if ((b.wickets || 0) > bowlerMap[pid].best_bowling_wickets ||
          ((b.wickets || 0) === bowlerMap[pid].best_bowling_wickets && (b.runs_conceded || 0) < bowlerMap[pid].best_bowling_runs)) {
        bowlerMap[pid].best_bowling_wickets = b.wickets || 0;
        bowlerMap[pid].best_bowling_runs = b.runs_conceded || 0;
      }
    });

    const topBowlers = Object.values(bowlerMap)
      .map(b => ({
        ...b,
        overs_formatted: b.overs.toFixed(1),
        economy: b.overs > 0 ? parseFloat((b.runs_conceded / b.overs).toFixed(2)) : 0.00,
        best_bowling: `${b.best_bowling_wickets}/${b.best_bowling_runs === 999 ? 0 : b.best_bowling_runs}`
      }))
      .sort((a, b) => b.wickets - a.wickets || a.economy - b.economy)
      .slice(0, 10);

    // Aggregate Highest Team Totals
    const teamTotals = inningsList.map(inn => ({
      match_id: inn.match_id,
      team_id: inn.batting_team_id,
      score: `${inn.total_runs}/${inn.wickets}`,
      runs: inn.total_runs || 0,
      wickets: inn.wickets || 0,
      overs: inn.overs || 0
    })).sort((a, b) => b.runs - a.runs).slice(0, 5);

    return {
      top_batters: topBatters,
      top_bowlers: topBowlers,
      highest_team_totals: teamTotals,
      boundaries: {
        total_fours: totalFours,
        total_sixes: totalSixes,
        total_boundaries: totalFours + totalSixes
      }
    };
  }

  /**
   * Hook called when a match completes to synchronize tournament status
   */
  async onMatchCompleted(matchId) {
    try {
      await db.initDb();
      const match = await db.models.Match.findOne({ id: matchId }).lean();
      if (!match || !match.tournament_id) return;

      const tour = await db.models.Tournament.findOne({ id: match.tournament_id });
      if (!tour) return;

      let changed = false;
      if (tour.status === 'UPCOMING') {
        tour.status = 'ONGOING';
        changed = true;
      }

      // Check remaining matches
      const activePendingCount = await db.models.Match.countDocuments({
        tournament_id: match.tournament_id,
        status: { $in: ['SCHEDULED', 'LIVE', 'INNINGS_BREAK', 'TOSS', 'PAUSED'] }
      });

      if (activePendingCount === 0) {
        const completedCount = await db.models.Match.countDocuments({
          tournament_id: match.tournament_id,
          status: 'COMPLETED'
        });
        if (completedCount > 0) {
          tour.status = 'COMPLETED';
          changed = true;
        }
      }

      if (changed) {
        tour.updatedAt = new Date();
        await tour.save();
      }
    } catch (_err) {
      // Non-blocking
    }
  }

  /**
   * Register a team for a tournament (Coach / Team side)
   */
  async registerTeamForTournament(payloadOrId, requesterUser = {}, maybeNotes = '') {
    await db.initDb();

    let tournamentId, teamId, coachEmail, coachName, teamName, notes;
    if (typeof payloadOrId === 'string') {
      tournamentId = payloadOrId;
      notes = maybeNotes;
      teamId = requesterUser?.id || requesterUser?.teamId;
      coachEmail = requesterUser?.email || requesterUser?.coachEmail;
      coachName = requesterUser?.name || requesterUser?.coachName;
      teamName = requesterUser?.teamName || requesterUser?.name;
    } else {
      ({ tournamentId, teamId, coachEmail, coachName, teamName, notes } = payloadOrId || {});
    }

    // 1. Verify tournament exists
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw { status: 404, message: `Tournament with ID '${tournamentId}' not found.` };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const tourStatus = (tournament.status || 'UPCOMING').toUpperCase();

    // 2. Status validations
    if (tourStatus === 'CANCELLED' || tourStatus === 'INACTIVE' || tourStatus === 'COMPLETED') {
      throw { status: 400, message: `Tournament is currently '${tourStatus}'. Registrations are not accepted.` };
    }
    if (tourStatus === 'REGISTRATION_CLOSED') {
      throw { status: 400, message: 'Registration has been closed for this tournament.' };
    }

    // 3. Deadline check
    if (tournament.registration_end_date && tournament.registration_end_date < todayStr) {
      throw { status: 400, message: `Registration deadline for this tournament passed on ${tournament.registration_end_date}.` };
    }

    // 4. Resolve team data automatically from database
    let resolvedTeamId = teamId || requesterUser?.teamId || requesterUser?.id;
    let resolvedEmail = (coachEmail || requesterUser?.email || '').trim().toLowerCase();
    let resolvedTeamName = teamName;
    let resolvedCoachName = coachName || requesterUser?.name;
    let resolvedCity = 'Virudhunagar';
    let resolvedTaluk = 'Virudhunagar';
    let resolvedCaptain = '';
    let squadCount = 15;

    // Search existing team in Team or TeamRegistration collection
    let teamDoc = null;
    if (resolvedTeamId) {
      teamDoc = await db.models.Team.findOne({
        $or: [{ id: resolvedTeamId }, { team_id: resolvedTeamId }]
      }).lean();
    }
    if (!teamDoc && resolvedEmail) {
      teamDoc = await db.models.Team.findOne({ coach_email: resolvedEmail }).lean();
    }
    if (!teamDoc && resolvedEmail) {
      teamDoc = await db.models.TeamRegistration.findOne({ coach_email: resolvedEmail }).lean();
    }

    if (teamDoc) {
      resolvedTeamId = teamDoc.id || teamDoc.team_id || resolvedTeamId;
      resolvedTeamName = teamDoc.name || teamDoc.team_name || resolvedTeamName;
      resolvedCoachName = teamDoc.coach_name || resolvedCoachName;
      resolvedEmail = (teamDoc.coach_email || resolvedEmail).toLowerCase();
      resolvedCity = teamDoc.city || teamDoc.taluk || 'Virudhunagar';
      resolvedTaluk = teamDoc.taluk || teamDoc.city || 'Virudhunagar';
      resolvedCaptain = teamDoc.captain || '';
      if (teamDoc.players && Array.isArray(teamDoc.players)) {
        squadCount = teamDoc.players.length;
      }
    }

    if (!resolvedTeamId) {
      resolvedTeamId = `TM-${Date.now()}`;
    }
    if (!resolvedTeamName) {
      resolvedTeamName = requesterUser?.teamName || requesterUser?.name || 'Registered Club';
    }

    // 5. Max teams quota check
    const maxTeams = Number(tournament.max_teams || 16);
    const currentApprovedCount = await tournamentRegistrationModel.countApproved(tournament.id);
    const existingApprovedList = tournament.teams || [];
    const totalApproved = Math.max(currentApprovedCount, existingApprovedList.length);
    if (totalApproved >= maxTeams) {
      throw { status: 400, message: `Tournament has reached its maximum quota of ${maxTeams} participating teams.` };
    }

    // 6. Prevent duplicate registrations
    const existingReg = (await tournamentRegistrationModel.findByTournamentAndTeam(tournament.id, resolvedTeamId)) ||
      (resolvedEmail ? await tournamentRegistrationModel.findByTournamentAndCoachEmail(tournament.id, resolvedEmail) : null);

    if (existingReg) {
      if (existingReg.status === 'PENDING') {
        throw { status: 400, message: `Your team '${resolvedTeamName}' has already submitted a registration for this tournament and is currently Pending Approval.` };
      }
      if (existingReg.status === 'APPROVED') {
        throw { status: 400, message: `Your team '${resolvedTeamName}' is already an Approved official participant in this tournament.` };
      }
      if (existingReg.status === 'REJECTED') {
        // Re-open rejected registration as PENDING
        const updated = await tournamentRegistrationModel.updateStatus(existingReg.id, {
          status: 'PENDING',
          adminEmail: null
        });
        await db.models.TournamentRegistration.findOneAndUpdate(
          { id: existingReg.id },
          {
            $set: {
              registration_date: new Date(),
              notes: notes || 'Re-submitted registration after revision',
              rejection_reason: null,
              rejected_at: null,
              rejected_by: null
            }
          }
        );
        return {
          ...updated,
          status: 'PENDING',
          message: `Tournament registration re-submitted successfully for '${tournament.name}'. Current Status: PENDING`
        };
      }
    }

    // 7. Create new registration in PENDING status
    const regId = `TREG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newReg = await tournamentRegistrationModel.create({
      id: regId,
      tournament_id: tournament.id,
      tournament_name: tournament.name,
      team_id: resolvedTeamId,
      team_name: resolvedTeamName,
      coach_name: resolvedCoachName,
      coach_email: resolvedEmail,
      team_city: resolvedCity,
      team_taluk: resolvedTaluk,
      captain: resolvedCaptain,
      squad_count: squadCount,
      status: 'PENDING',
      registration_date: new Date(),
      notes: notes || ''
    });

    // 8. Create administrative notification
    try {
      await db.models.Notification.create({
        id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 'TOURNAMENT_REGISTRATION',
        title: 'New Tournament Registration',
        message: `Team '${resolvedTeamName}' submitted registration for '${tournament.name}'. Pending administrative review.`,
        reference_id: regId,
        status: 'UNREAD'
      });
    } catch (_e) {}

    // 9. Audit Log
    await this._logAudit(
      'TEAM_REGISTER_TOURNAMENT',
      resolvedEmail,
      tournament.name,
      `Team '${resolvedTeamName}' registered for tournament '${tournament.name}'`,
      `Registration ID: ${regId}, Status: PENDING`
    );

    return newReg.toObject ? newReg.toObject() : newReg;
  }

  /**
   * Get team's tournament registrations (Coach/Team Side)
   */
  async getTeamRegistrations(coachEmail, teamId) {
    await db.initDb();
    const query = { $or: [] };
    if (coachEmail) {
      query.$or.push({ coach_email: String(coachEmail).trim().toLowerCase() });
    }
    if (teamId) {
      query.$or.push({ team_id: String(teamId).trim() });
    }
    if (query.$or.length === 0) return [];

    const registrations = await db.models.TournamentRegistration.find(query).sort({ registration_date: -1 }).lean();
    
    // Populate live tournament details on each registration
    const tourIds = [...new Set(registrations.map(r => r.tournament_id))];
    const tournaments = await db.models.Tournament.find({ id: { $in: tourIds } }).lean();
    const tourMap = {};
    tournaments.forEach(t => { tourMap[t.id] = t; });

    return registrations.map(reg => {
      const tour = tourMap[reg.tournament_id] || {};
      return {
        ...reg,
        tournament_details: {
          id: tour.id,
          name: tour.name,
          short_name: tour.short_name,
          venue: tour.venue,
          tournament_type: tour.tournament_type,
          format: tour.format || tour.match_format,
          start_date: tour.start_date,
          end_date: tour.end_date,
          registration_end_date: tour.registration_end_date,
          status: tour.status,
          max_teams: tour.max_teams
        }
      };
    });
  }

  /**
   * Get tournament registrations for Admin with filtering
   */
  async getTournamentRegistrations({ tournamentId, status, search } = {}) {
    await db.initDb();
    const registrations = await tournamentRegistrationModel.getAll({ tournamentId, status, search });
    
    // Attach tournament metadata
    const tourIds = [...new Set(registrations.map(r => r.tournament_id))];
    const tournaments = await db.models.Tournament.find({ id: { $in: tourIds } }).lean();
    const tourMap = {};
    tournaments.forEach(t => { tourMap[t.id] = t; });

    return registrations.map(reg => {
      const tour = tourMap[reg.tournament_id] || {};
      return {
        ...reg,
        tournament_status: tour.status,
        tournament_venue: tour.venue,
        tournament_dates: tour.start_date && tour.end_date ? `${tour.start_date} to ${tour.end_date}` : ''
      };
    });
  }

  /**
   * Admin approves team tournament registration
   */
  async approveRegistration(registrationId, adminEmail = 'admin@cfvd.org') {
    await db.initDb();
    const registration = await tournamentRegistrationModel.findById(registrationId);
    if (!registration) {
      throw { status: 404, message: `Registration with ID '${registrationId}' not found.` };
    }

    const tournament = await tournamentModel.findById(registration.tournament_id);
    if (!tournament) {
      throw { status: 404, message: `Tournament '${registration.tournament_id}' not found.` };
    }

    // Check maximum teams capacity
    const maxTeams = Number(tournament.max_teams || 16);
    const currentApprovedCount = await tournamentRegistrationModel.countApproved(tournament.id);
    if (registration.status !== 'APPROVED' && currentApprovedCount >= maxTeams) {
      throw { status: 400, message: `Cannot approve registration: Tournament max team limit of ${maxTeams} has been reached.` };
    }

    // Update registration to APPROVED
    const updated = await tournamentRegistrationModel.updateStatus(registration.id, {
      status: 'APPROVED',
      adminEmail
    });

    // Add team to tournament.teams array if not present
    const existingTeams = tournament.teams || [];
    if (!existingTeams.includes(registration.team_id)) {
      await db.models.Tournament.findOneAndUpdate(
        { id: tournament.id },
        { $addToSet: { teams: registration.team_id } }
      );
    }

    // Notify Coach
    try {
      await db.models.Notification.create({
        id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 'REGISTRATION_APPROVED',
        title: 'Tournament Registration Approved! 🏆',
        message: `Congratulations! Team '${registration.team_name}' has been officially approved to participate in '${tournament.name}'.`,
        reference_id: registration.id,
        status: 'UNREAD'
      });
    } catch (_e) {}

    // Audit log
    await this._logAudit(
      'APPROVE_TOURNAMENT_REGISTRATION',
      adminEmail,
      registration.team_name,
      `Approved team '${registration.team_name}' for '${tournament.name}'`,
      `Registration ID: ${registration.id}`
    );

    return updated;
  }

  /**
   * Admin rejects team tournament registration
   */
  async rejectRegistration(registrationId, reason, adminEmail = 'admin@cfvd.org') {
    await db.initDb();
    const registration = await tournamentRegistrationModel.findById(registrationId);
    if (!registration) {
      throw { status: 404, message: `Registration with ID '${registrationId}' not found.` };
    }

    const tournament = await tournamentModel.findById(registration.tournament_id);

    // Update registration to REJECTED
    const updated = await tournamentRegistrationModel.updateStatus(registration.id, {
      status: 'REJECTED',
      adminEmail,
      rejectionReason: reason || 'Application declined by tournament committee.'
    });

    // Remove team from tournament.teams array if present
    if (tournament) {
      await db.models.Tournament.findOneAndUpdate(
        { id: tournament.id },
        { $pull: { teams: registration.team_id } }
      );
    }

    // Notify Coach
    try {
      await db.models.Notification.create({
        id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 'REGISTRATION_REJECTED',
        title: 'Tournament Registration Update',
        message: `Registration for team '${registration.team_name}' in '${registration.tournament_name}' was not approved. Reason: ${reason || 'Capacity or eligibility constraints.'}`,
        reference_id: registration.id,
        status: 'UNREAD'
      });
    } catch (_e) {}

    // Audit log
    await this._logAudit(
      'REJECT_TOURNAMENT_REGISTRATION',
      adminEmail,
      registration.team_name,
      `Rejected team '${registration.team_name}' for '${registration.tournament_name}'`,
      `Reason: ${reason || 'Declined'}`
    );

    return updated;
  }

  /**
   * Get approved participant teams for a tournament
   */
  async getApprovedTeams(tournamentId) {
    await db.initDb();
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw { status: 404, message: `Tournament with ID '${tournamentId}' not found.` };
    }

    // 1. Fetch from approved tournament registrations
    const approvedRegistrations = await db.models.TournamentRegistration.find({
      tournament_id: tournament.id,
      status: 'APPROVED'
    }).lean();

    // 2. Fetch from tournament.teams array
    const teamIds = [
      ...new Set([
        ...(tournament.teams || []),
        ...approvedRegistrations.map(r => r.team_id)
      ])
    ];

    if (teamIds.length === 0) return [];

    const [regularTeams, regTeams] = await Promise.all([
      db.models.Team.find({ $or: [{ id: { $in: teamIds } }, { team_id: { $in: teamIds } }] }).lean(),
      db.models.TeamRegistration.find({ id: { $in: teamIds } }).lean()
    ]);

    const teamMap = {};
    regularTeams.forEach(t => {
      teamMap[t.id] = t;
      if (t.team_id) teamMap[t.team_id] = t;
    });
    regTeams.forEach(t => {
      teamMap[t.id] = t;
    });

    const regMap = {};
    approvedRegistrations.forEach(r => {
      regMap[r.team_id] = r;
    });

    return teamIds.map(tid => {
      const t = teamMap[tid] || {};
      const r = regMap[tid] || {};
      return {
        id: tid,
        team_id: t.team_id || tid,
        name: r.team_name || t.name || t.team_name || tid,
        coach_name: r.coach_name || t.coach_name || '—',
        coach_email: r.coach_email || t.coach_email || '',
        city: r.team_city || t.city || t.taluk || 'Virudhunagar',
        captain: r.captain || t.captain || '—',
        squad_count: r.squad_count || (t.players ? t.players.length : 15),
        registration_id: r.id || null,
        approved_at: r.approved_at || null,
        status: 'APPROVED'
      };
    });
  }
}

module.exports = new TournamentService();
