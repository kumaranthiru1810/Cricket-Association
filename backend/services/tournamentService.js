/**
 * services/tournamentService.js
 * Comprehensive Tournament Management & Championship Operations Service.
 * Implements tournament creation, team selection, dynamic fixture generation,
 * live points table calculation, and tournament statistical aggregation.
 */

const db = require('../config/db');
const tournamentModel = require('../models/tournamentModel');
const tournamentRegistrationModel = require('../models/tournamentRegistrationModel');
const tournamentEngine = require('./tournamentEngine');

const _tournamentLocks = new Map();

class TournamentService {
  async _withTournamentLock(tournamentId, fn) {
    const prev = _tournamentLocks.get(tournamentId) || Promise.resolve();
    const runWithDbLease = async () => {
      await db.initDb();
      let acquired = false;
      const leaseMs = 15000;
      for (let attempt = 0; attempt < 20; attempt++) {
        const now = new Date();
        const lockUntil = new Date(now.getTime() + leaseMs);
        const leased = await db.models.Tournament.findOneAndUpdate(
          {
            id: tournamentId,
            $or: [{ progression_lock_until: null }, { progression_lock_until: { $lte: now } }]
          },
          { $set: { progression_lock_until: lockUntil } },
          { new: true }
        ).lean();
        if (leased) {
          acquired = true;
          break;
        }
        const exists = await db.models.Tournament.exists({ id: tournamentId });
        if (!exists) break;
        await new Promise(r => setTimeout(r, 75));
      }
      try {
        return await fn();
      } finally {
        if (acquired) {
          await db.models.Tournament.updateOne(
            { id: tournamentId },
            { $set: { progression_lock_until: null } }
          ).catch(() => { });
        }
      }
    };
    const next = prev.then(runWithDbLease, runWithDbLease);
    _tournamentLocks.set(tournamentId, next.catch(() => { }));
    return next;
  }
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

    const enriched = rawTournaments.map(t => {
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

    // Enforce strictly one tournament per normalized name
    const uniqueByName = new Map();
    enriched.forEach(t => {
      const key = (t.name || '').trim().toLowerCase() || t.id;
      const existing = uniqueByName.get(key);
      if (!existing) {
        uniqueByName.set(key, t);
      } else {
        const existingScore = (existing.match_stats?.total || 0) * 10 + (existing.approved_teams_count || 0);
        const currentScore = (t.match_stats?.total || 0) * 10 + (t.approved_teams_count || 0);
        if (currentScore > existingScore) {
          uniqueByName.set(key, t);
        }
      }
    });

    return Array.from(uniqueByName.values());
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
      const validObjIds = teamIds.filter(id => typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/));
      const [regularTeams, regTeams] = await Promise.all([
        db.models.Team.find({
          $or: [
            { id: { $in: teamIds } },
            { team_id: { $in: teamIds } },
            { name: { $in: teamIds } },
            { team_name: { $in: teamIds } },
            ...(validObjIds.map(id => ({ _id: id })))
          ]
        }).lean(),
        db.models.TeamRegistration.find({
          $or: [
            { id: { $in: teamIds } },
            { team_name: { $in: teamIds } },
            ...(validObjIds.map(id => ({ _id: id })))
          ]
        }).lean()
      ]);

      const teamMap = {};
      regularTeams.forEach(rt => {
        const item = {
          id: rt.id || rt.team_id || rt._id?.toString(),
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
        if (rt.id) teamMap[rt.id] = item;
        if (rt.team_id) teamMap[rt.team_id] = item;
        if (rt._id) teamMap[rt._id.toString()] = item;
        if (rt.name) teamMap[rt.name] = item;
        if (rt.team_name) teamMap[rt.team_name] = item;
      });

      regTeams.forEach(reg => {
        const item = {
          id: reg.id || reg._id?.toString(),
          team_id: reg.id || reg._id?.toString(),
          name: reg.team_name,
          short_name: reg.team_name ? reg.team_name.split(' ').map(w => w[0]).join('').slice(0, 4).toUpperCase() : 'VND',
          coach_name: reg.coach_name || '—',
          coach_email: reg.coach_email || '',
          city: reg.city || reg.taluk || 'Virudhunagar',
          captain: '—',
          vice_captain: '—',
          status: reg.status || 'PENDING'
        };
        if (reg.id && !teamMap[reg.id]) teamMap[reg.id] = item;
        if (reg._id && !teamMap[reg._id.toString()]) teamMap[reg._id.toString()] = item;
        if (reg.team_name && !teamMap[reg.team_name]) teamMap[reg.team_name] = item;
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

    // Validate Dates if supplied
    if (payload.start_date && payload.end_date) {
      const startDate = new Date(payload.start_date);
      const endDate = new Date(payload.end_date);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw { status: 400, message: 'Start Date and End Date must be valid dates (YYYY-MM-DD).' };
      }
      if (endDate < startDate) {
        throw { status: 400, message: 'Tournament End Date cannot be before Start Date.' };
      }
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

    const VALID_TYPES = [
      'SINGLE_ROUND_ROBIN', 'DOUBLE_ROUND_ROBIN',
      'SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION',
      'GROUP_KNOCKOUT', 'GROUP_SUPER_LEAGUE',
      'LEAGUE_PLAYOFFS', 'LEAGUE_KNOCKOUT',
      'KNOCKOUT', 'LEAGUE'
    ];
    const rawType = String(payload.tournament_type || payload.type || '').toUpperCase().trim();
    let tourType = VALID_TYPES.includes(rawType) ? rawType : 'LEAGUE';
    if (!VALID_TYPES.includes(rawType)) {
      if (rawType.includes('KNOCKOUT') && rawType.includes('LEAGUE')) tourType = 'LEAGUE_KNOCKOUT';
      else if (rawType.includes('KNOCKOUT')) tourType = 'KNOCKOUT';
    }

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
      start_date: payload.start_date || null,
      end_date: payload.end_date || null,
      registration_start_date: payload.registration_start_date || null,
      registration_end_date: payload.registration_end_date || null,
      max_teams: maxTeams,
      min_teams: minTeams,
      points_win: Number(payload.points_win !== undefined ? payload.points_win : 4),
      points_loss: Number(payload.points_loss !== undefined ? payload.points_loss : 0),
      points_tie: Number(payload.points_tie !== undefined ? payload.points_tie : 2),
      points_no_result: Number(payload.points_no_result !== undefined ? payload.points_no_result : 2),
      points_bonus_win: Number(payload.points_bonus_win !== undefined ? payload.points_bonus_win : 1),
      points_bonus_loss: Number(payload.points_bonus_loss !== undefined ? payload.points_bonus_loss : -1),
      points_walkover_win: Number(payload.points_walkover_win !== undefined ? payload.points_walkover_win : 4),
      points_walkover_loss: Number(payload.points_walkover_loss !== undefined ? payload.points_walkover_loss : -1),
      playing_xi_size: Number(payload.playing_xi_size || 11),
      substitute_count: Number(payload.substitute_count || 4),
      allow_super_over: payload.allow_super_over !== false,
      allow_dls: Boolean(payload.allow_dls),
      rules: (payload.rules || 'Standard ICC / TNCA Playing Conditions').trim(),
      playing_rules: {
        powerplay_overs: Number(payload.playing_rules?.powerplay_overs ?? 5),
        max_outside_powerplay: Number(payload.playing_rules?.max_outside_powerplay ?? 2),
        max_outside_post_powerplay: Number(payload.playing_rules?.max_outside_post_powerplay ?? 5),
        max_on_side_fielders: Number(payload.playing_rules?.max_on_side_fielders ?? 5),
        max_on_side_behind_crease: Number(payload.playing_rules?.max_on_side_behind_crease ?? 2),
        free_hit_on_all_noballs: payload.playing_rules?.free_hit_on_all_noballs !== false,
        delay_penalty_enabled: payload.playing_rules?.delay_penalty_enabled !== false,
        delay_interval_value: Number(payload.playing_rules?.delay_interval_value ?? 4),
        delay_interval_unit: ['HOURS', 'MINUTES', 'SECONDS'].includes(payload.playing_rules?.delay_interval_unit)
          ? payload.playing_rules.delay_interval_unit
          : 'MINUTES',
        delay_reduce_unit: payload.playing_rules?.delay_reduce_unit === 'BALLS' ? 'BALLS' : 'OVERS',
        delay_overs_reduced_per_interval: Number(payload.playing_rules?.delay_overs_reduced_per_interval ?? 1),
        tie_handling: payload.playing_rules?.tie_handling === 'SUPER_OVER' ? 'SUPER_OVER' : 'SHARE_POINTS'
      },
      format_config: {
        round_robin_type: payload.tournament_type === 'DOUBLE_ROUND_ROBIN'
          ? 'DOUBLE'
          : (payload.tournament_type === 'SINGLE_ROUND_ROBIN' ? 'SINGLE' : (payload.format_config?.round_robin_type || 'SINGLE')),
        knockout_stages: payload.format_config?.knockout_stages || ['Semi Final', 'Final'],
        qualifying_teams_count: Number(payload.format_config?.qualifying_teams_count || 4),
        qualification_rules: payload.format_config?.qualification_rules || 'Top qualifying teams advance to knockout stage',
        group_count: Number(payload.format_config?.group_count ?? 5),
        allow_extra_group: payload.format_config?.allow_extra_group !== false,
        teams_per_group: Number(payload.format_config?.teams_per_group ?? 8),
        qualifiers_per_group: Number(payload.format_config?.qualifiers_per_group ?? 2),
        super_league_enabled: payload.format_config?.super_league_enabled !== false,
        super_league_groups: Number(payload.format_config?.super_league_groups ?? 4),
        super_league_qualifiers_per_group: Number(payload.format_config?.super_league_qualifiers_per_group ?? 1),
        include_semifinals: payload.format_config?.include_semifinals !== false,
        include_final: payload.format_config?.include_final !== false,
        group_distribution: payload.format_config?.group_distribution || 'BALANCED',
        manual_groups: payload.format_config?.manual_groups || null,
        best_runners_up_count: Number(payload.format_config?.best_runners_up_count ?? payload.format_config?.best_third_place_count ?? 0),
        tie_breaker_order: Array.isArray(payload.format_config?.tie_breaker_order) && payload.format_config.tie_breaker_order.length > 0
          ? payload.format_config.tie_breaker_order
          : ['POINTS', 'WINS', 'NRR', 'HEAD_TO_HEAD']
      },
      teams,
      winner_team_id: payload.winner_team_id || null,
      winner_team_name: String(payload.winner_team_name || '').trim(),
      runner_up_team_id: payload.runner_up_team_id || null,
      runner_up_team_name: String(payload.runner_up_team_name || '').trim(),
      awards_config: {
        winner_trophy_title: String(payload.awards_config?.winner_trophy_title || 'Championship Winner Trophy').trim(),
        runner_up_trophy_title: String(payload.awards_config?.runner_up_trophy_title || 'Runner-Up Trophy').trim(),
        potm_every_match: payload.awards_config?.potm_every_match !== false
      },
      status: initialStatus,
      created_by: adminEmail || 'admin@cfvd.org'
    };

    if (teams.length >= 2) {
      tournamentEngine.validateGroupAndQualificationConfig(teams, tourType, newTournamentData.format_config);
    }

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
      ...(payload.points_loss !== undefined && { points_loss: Number(payload.points_loss) }),
      ...(payload.points_tie !== undefined && { points_tie: Number(payload.points_tie) }),
      ...(payload.points_no_result !== undefined && { points_no_result: Number(payload.points_no_result) }),
      ...(payload.points_bonus_win !== undefined && { points_bonus_win: Number(payload.points_bonus_win) }),
      ...(payload.points_bonus_loss !== undefined && { points_bonus_loss: Number(payload.points_bonus_loss) }),
      ...(payload.points_walkover_win !== undefined && { points_walkover_win: Number(payload.points_walkover_win) }),
      ...(payload.points_walkover_loss !== undefined && { points_walkover_loss: Number(payload.points_walkover_loss) }),
      ...(payload.playing_xi_size && { playing_xi_size: Number(payload.playing_xi_size) }),
      ...(payload.substitute_count && { substitute_count: Number(payload.substitute_count) }),
      ...(payload.allow_super_over !== undefined && { allow_super_over: Boolean(payload.allow_super_over) }),
      ...(payload.allow_dls !== undefined && { allow_dls: Boolean(payload.allow_dls) }),
      ...(payload.rules && { rules: payload.rules }),
      ...(payload.playing_rules && { playing_rules: payload.playing_rules }),
      ...(payload.format_config && { format_config: payload.format_config }),
      ...(Array.isArray(payload.teams) && { teams: payload.teams }),
      ...(payload.winner_team_id !== undefined && { winner_team_id: payload.winner_team_id }),
      ...(payload.winner_team_name !== undefined && { winner_team_name: String(payload.winner_team_name).trim() }),
      ...(payload.runner_up_team_id !== undefined && { runner_up_team_id: payload.runner_up_team_id }),
      ...(payload.runner_up_team_name !== undefined && { runner_up_team_name: String(payload.runner_up_team_name).trim() }),
      ...(payload.awards_config && { awards_config: payload.awards_config }),
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
   * Update group allocation & qualification settings before matches start
   */
  async updateTournamentGroups(tournamentId, payload = {}, adminEmail = 'admin@cfvd.org') {
    await db.initDb();
    const existing = await tournamentModel.findById(tournamentId);
    if (!existing) {
      throw { status: 404, message: `Tournament with ID '${tournamentId}' not found.` };
    }

    const startedCount = await db.models.Match.countDocuments({
      tournament_id: existing.id,
      status: { $in: ['LIVE', 'INNINGS_BREAK', 'TOSS', 'PAUSED', 'COMPLETED'] }
    });
    if (startedCount > 0) {
      throw {
        status: 409,
        code: 'GROUPS_LOCKED_MATCHES_STARTED',
        message: 'Cannot modify groups or qualification rules because matches have already started or completed.'
      };
    }

    const scheduledCount = await db.models.Match.countDocuments({ tournament_id: existing.id });
    if (scheduledCount > 0) {
      throw {
        status: 409,
        code: 'GROUPS_LOCKED_FIXTURES_EXIST',
        message: 'Fixtures have already been generated for this tournament. Group modifications are locked.'
      };
    }

    const teams = Array.isArray(payload.teams) ? payload.teams : (existing.teams || []);
    const mergedFormatConfig = {
      ...(existing.format_config || {}),
      ...(payload.format_config || {}),
      ...(payload.group_count !== undefined && { group_count: Number(payload.group_count) }),
      ...(payload.teams_per_group !== undefined && { teams_per_group: Number(payload.teams_per_group) }),
      ...(payload.allow_extra_group !== undefined && { allow_extra_group: Boolean(payload.allow_extra_group) }),
      ...(payload.group_distribution !== undefined && { group_distribution: String(payload.group_distribution).toUpperCase() }),
      ...(payload.manual_groups !== undefined && { manual_groups: payload.manual_groups }),
      ...(payload.qualifiers_per_group !== undefined && { qualifiers_per_group: Number(payload.qualifiers_per_group) }),
      ...(payload.best_runners_up_count !== undefined && { best_runners_up_count: Number(payload.best_runners_up_count) }),
      ...(payload.best_third_place_count !== undefined && { best_runners_up_count: Number(payload.best_third_place_count) })
    };

    const validation = tournamentEngine.validateGroupAndQualificationConfig(
      teams,
      existing.tournament_type,
      mergedFormatConfig,
      { requireManualGroups: mergedFormatConfig.group_distribution === 'MANUAL' }
    );

    const alloc = tournamentEngine.allocateGroups(teams, mergedFormatConfig);
    mergedFormatConfig.groups_snapshot = alloc.groups.map(g => ({ key: g.key, label: g.label, teams: g.teams }));

    const updated = await tournamentModel.update(existing.id, {
      teams,
      format_config: mergedFormatConfig,
      updatedAt: new Date()
    });

    await this._logAudit(
      'UPDATE_TOURNAMENT_GROUPS',
      adminEmail,
      existing.name,
      `Updated groups (${mergedFormatConfig.group_distribution}, ${alloc.groups.length} groups, ${validation.totalQualifiers || 0} qualifiers)`,
      `Teams: ${teams.length}`
    );

    return {
      success: true,
      tournament: updated,
      groups: alloc.groups,
      validation
    };
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
   * Delegates to unified tournamentEngine supporting Single/Double Round Robin,
   * Single Elimination, Double Elimination, Group+Knockout, and League+IPL Playoffs.
   */
  async generateMatches(tournamentId, options = {}, adminEmail) {
    const tournamentEngine = require('./tournamentEngine');
    return tournamentEngine.generateAndSaveMatches(tournamentId, options, adminEmail);
  }

  /**
   * Legacy placeholder kept for reference — replaced by tournamentEngine.generateAndSaveMatches
   */
  async _legacyGenerateMatchesUnused(tournamentId, options = {}, adminEmail) {
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

    // Clean up existing scheduled matches if regenerating (unless preserveExisting/preventDuplicate is requested)
    const existingScheduled = await db.models.Match.find({
      tournament_id: tournament.id,
      status: 'SCHEDULED'
    }).lean();

    if (existingScheduled.length > 0 && options.preventDuplicateIfExists) {
      return {
        success: true,
        already_generated: true,
        tournament_id: tournament.id,
        tournament_name: tournament.name,
        total_matches_generated: existingScheduled.length,
        generated_count: existingScheduled.length,
        fixtures: existingScheduled
      };
    }

    const effType = options.tournament_type || tournament.tournament_type || 'SINGLE_ROUND_ROBIN';
    if (effType === 'GROUP_SUPER_LEAGUE' || effType === 'GROUP_KNOCKOUT') {
      const mergedFmt = { ...(tournament.format_config || {}), ...(options.format_config || {}) };
      tournamentEngine.validateGroupAndQualificationConfig(teams, effType, mergedFmt, {
        requireManualGroups: mergedFmt.group_distribution === 'MANUAL'
      });
    }

    if (existingScheduled.length > 0) {
      await db.models.Match.deleteMany({
        tournament_id: tournament.id,
        status: 'SCHEDULED'
      });
    }

    // Fetch team names for readable fixture creation
    const validTeamsObjIds = teams.filter(id => typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/));
    const [teamDocs, regDocs] = await Promise.all([
      db.models.Team.find({
        $or: [
          { id: { $in: teams } },
          { team_id: { $in: teams } },
          { name: { $in: teams } },
          { team_name: { $in: teams } },
          ...(validTeamsObjIds.map(id => ({ _id: id })))
        ]
      }).lean(),
      db.models.TeamRegistration.find({
        $or: [
          { id: { $in: teams } },
          { team_name: { $in: teams } },
          ...(validTeamsObjIds.map(id => ({ _id: id })))
        ]
      }).lean()
    ]);
    const teamNameMap = {};
    teamDocs.forEach(t => {
      const name = t.name || t.team_name;
      if (t.id) teamNameMap[t.id] = name;
      if (t.team_id) teamNameMap[t.team_id] = name;
      if (t._id) teamNameMap[t._id.toString()] = name;
      if (t.name) teamNameMap[t.name] = name;
    });
    regDocs.forEach(t => {
      const name = t.team_name;
      if (t.id && !teamNameMap[t.id]) teamNameMap[t.id] = name;
      if (t._id && !teamNameMap[t._id.toString()]) teamNameMap[t._id.toString()] = name;
      if (t.team_name && !teamNameMap[t.team_name]) teamNameMap[t.team_name] = name;
    });

    const tournamentType = options.tournament_type || tournament.tournament_type || 'SINGLE_ROUND_ROBIN';
    const roundRobinType = tournamentType === 'DOUBLE_ROUND_ROBIN'
      ? 'DOUBLE'
      : tournamentType === 'SINGLE_ROUND_ROBIN'
        ? 'SINGLE'
        : (options.round_robin_type || tournament.format_config?.round_robin_type || 'SINGLE');
    const venue = options.venue || tournament.venue || 'Kamarajar District Stadium';
    const matchType = options.match_format || tournament.match_format || 'T20';
    const oversPerSide = Number(options.overs_per_match || tournament.overs_per_match || 20);
    const pr = tournament.playing_rules || {};
    const rulesSnapshot = {
      ...pr,
      tournament_type: tournamentType,
      overs_per_match: oversPerSide,
      playing_xi_size: tournament.playing_xi_size ?? 11,
      allow_super_over: tournament.allow_super_over !== false,
      allow_dls: Boolean(tournament.allow_dls),
      allow_chain_over: Boolean(pr.allow_chain_over),
      max_overs_per_bowler: pr.max_overs_per_bowler ?? 4,
      free_hit_on_all_noballs: pr.free_hit_on_all_noballs !== false,
      powerplay_overs: pr.powerplay_overs ?? 5,
      max_outside_powerplay: pr.max_outside_powerplay ?? 2,
      max_outside_post_powerplay: pr.max_outside_post_powerplay ?? 5,
      max_on_side_fielders: pr.max_on_side_fielders ?? 5,
      max_on_side_behind_crease: pr.max_on_side_behind_crease ?? 2,
      tie_handling: pr.tie_handling || 'SHARE_POINTS',
      snapshot_at: new Date()
    };
    const defaultScorerId = options.assigned_scorer_id || 'SCR-101';
    const defaultScorerName = options.assigned_scorer_name || 'Official Scorer';
    const defaultUmpire1Id = options.umpire1_id || 'UMP-101';
    const defaultUmpire1Name = options.umpire1_name || 'Thiru. K. Sundaram';
    const defaultUmpire2Id = options.umpire2_id || 'UMP-102';
    const defaultUmpire2Name = options.umpire2_name || 'Thiru. M. Ramanathan';

    // Calculate dates spread across tournament window
    const startDate = new Date(tournament.start_date || new Date().toISOString().split('T')[0]);
    const endDate = new Date(tournament.end_date || new Date(startDate.getTime() + 14 * 86400000).toISOString().split('T')[0]);
    const totalDays = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / 86400000));

    const generatedFixtures = [];
    let matchCounter = 1;

    // Helper: calculate date for match index
    const getMatchDate = (index, total) => {
      const offsetDays = Math.floor((index / Math.max(1, total)) * totalDays);
      const d = new Date(startDate.getTime() + offsetDays * 86400000);
      return d.toISOString().split('T')[0];
    };

    if (tournamentType === 'GROUP_SUPER_LEAGUE' || tournamentType === 'GROUP_KNOCKOUT') {
      const mergedFormatCfg = {
        ...(tournament.format_config || {}),
        ...(options.format_config || {})
      };
      const alloc = tournamentEngine.allocateGroups(teams, mergedFormatCfg);
      const groups = alloc.groups;
      const effectiveGroupCount = alloc.groupCount;

      const pairs = [];
      const groupByes = [];
      groups.forEach((grp) => {
        const rr = tournamentEngine.generateRoundRobinRounds(grp.teams, {
          doubleLeg: roundRobinType === 'DOUBLE',
          stagePrefix: grp.key
        });
        rr.pairings.forEach(p => {
          pairs.push({
            teamA: p.home,
            teamB: p.away,
            stage: grp.key,
            group_key: grp.key,
            round_number: p.round
          });
        });
        rr.byes.forEach(b => groupByes.push({ ...b, group_key: grp.key }));
      });

      // Interleave rounds across groups for balanced scheduling
      pairs.sort((a, b) => (a.round_number - b.round_number) || a.group_key.localeCompare(b.group_key));

      for (let i = 0; i < pairs.length; i++) {
        const p = pairs[i];
        const matchId = `M-${tournament.id.slice(-4)}-${String(matchCounter).padStart(3, '0')}`;
        generatedFixtures.push({
          id: matchId,
          tournament_id: tournament.id,
          tournament_name: tournament.name,
          team_a_id: p.teamA,
          team_b_id: p.teamB,
          team_a_name: teamNameMap[p.teamA] || p.teamA,
          team_b_name: teamNameMap[p.teamB] || p.teamB,
          venue,
          match_date: getMatchDate(i, pairs.length),
          match_time: i % 2 === 0 ? '09:30 AM' : '02:00 PM',
          match_type: matchType,
          overs_per_side: oversPerSide,
          stage: p.stage,
          group_key: p.group_key,
          round_number: p.round_number,
          fixture_seq: matchCounter,
          status: 'SCHEDULED',
          schedule_confirmation_status: 'CONFIRMED',
          schedule_confirmed_at: new Date(),
          schedule_confirmed_by: adminEmail || 'admin@cfvd.org',
          rules_snapshot: rulesSnapshot,
          assigned_scorer_id: defaultScorerId,
          assigned_scorer_name: defaultScorerName,
          scorer_name: defaultScorerName,
          umpire1_id: defaultUmpire1Id,
          umpire2_id: defaultUmpire2Id,
          umpire1_name: defaultUmpire1Name,
          umpire2_name: defaultUmpire2Name
        });
        matchCounter++;
      }

      // Persist group allocation snapshot & byes onto Tournament
      await db.models.Tournament.updateOne(
        { id: tournament.id },
        {
          $set: {
            'format_config.groups_snapshot': groups.map(g => ({
              key: g.key,
              label: g.label,
              teams: g.teams
            })),
            'format_config.byes': groupByes,
            'format_config.unresolved_ties': []
          }
        }
      );

      if (generatedFixtures.length > 0) {
        await db.models.Match.insertMany(generatedFixtures);
        const ts = Date.now();
        const notifBatch = [];
        generatedFixtures.forEach((m, idx) => {
          notifBatch.push({
            id: `NOTIF-M-${m.id}-TEAM-A-${ts}-${idx}`,
            type: 'MATCH_SCHEDULED',
            recipient_role: 'TEAM',
            recipient_id: m.team_a_id,
            team_id: m.team_a_id,
            team_name: m.team_a_name,
            title: `🏏 Match Scheduled vs ${m.team_b_name}`,
            message: `Your match vs ${m.team_b_name} (${m.stage}) has been scheduled on ${m.match_date} at ${m.match_time} at ${m.venue}.`,
            reference_id: m.id,
            status: 'UNREAD'
          });
          notifBatch.push({
            id: `NOTIF-M-${m.id}-TEAM-B-${ts}-${idx}`,
            type: 'MATCH_SCHEDULED',
            recipient_role: 'TEAM',
            recipient_id: m.team_b_id,
            team_id: m.team_b_id,
            team_name: m.team_b_name,
            title: `🏏 Match Scheduled vs ${m.team_a_name}`,
            message: `Your match vs ${m.team_a_name} (${m.stage}) has been scheduled on ${m.match_date} at ${m.match_time} at ${m.venue}.`,
            reference_id: m.id,
            status: 'UNREAD'
          });
        });
        if (notifBatch.length > 0) {
          await db.models.Notification.insertMany(notifBatch).catch(() => { });
        }
      }

      await this._logAudit(
        'GENERATE_TOURNAMENT_MATCHES',
        adminEmail,
        tournament.name,
        `Generated ${generatedFixtures.length} Group Stage fixtures across ${effectiveGroupCount} groups`,
        `Type: ${tournamentType}, Distribution: ${alloc.distribution}, Teams: ${teams.length}`
      );

      return {
        success: true,
        tournament_id: tournament.id,
        tournament_name: tournament.name,
        generated_count: generatedFixtures.length,
        total_matches_generated: generatedFixtures.length,
        groups: effectiveGroupCount,
        groups_allocation: groups,
        byes: groupByes,
        fixtures: generatedFixtures
      };
    }

    // 1. LEAGUE / ROUND-ROBIN GENERATION (Circle Method / Berger Table)
    if (
      tournamentType === 'LEAGUE' ||
      tournamentType === 'SINGLE_ROUND_ROBIN' ||
      tournamentType === 'DOUBLE_ROUND_ROBIN' ||
      tournamentType === 'LEAGUE_KNOCKOUT' ||
      tournamentType === 'LEAGUE_PLAYOFFS'
    ) {
      const rr = tournamentEngine.generateRoundRobinRounds(teams, {
        doubleLeg: roundRobinType === 'DOUBLE',
        stagePrefix: 'LEAGUE_STAGE'
      });

      await db.models.Tournament.updateOne(
        { id: tournament.id },
        {
          $set: {
            'format_config.byes': rr.byes,
            'format_config.unresolved_ties': []
          }
        }
      );

      // Create fixtures ordered round-by-round
      rr.pairings.forEach((p, idx) => {
        const matchId = `M-${tournament.id.replace(/[^a-zA-Z0-9]/g, '')}-${String(matchCounter).padStart(3, '0')}`;
        const seq = matchCounter;
        matchCounter++;
        const matchDate = getMatchDate(idx, rr.pairings.length);
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
          round_number: p.round,
          fixture_seq: seq,
          status: 'SCHEDULED',
          schedule_confirmation_status: 'CONFIRMED',
          schedule_confirmed_at: new Date(),
          schedule_confirmed_by: adminEmail || 'admin@cfvd.org',
          rules_snapshot: rulesSnapshot,
          assigned_scorer_id: defaultScorerId,
          assigned_scorer_name: defaultScorerName,
          scorer_name: defaultScorerName,
          umpire1_id: defaultUmpire1Id,
          umpire2_id: defaultUmpire2Id,
          umpire1_name: defaultUmpire1Name,
          umpire2_name: defaultUmpire2Name
        });
      });
    }

    // 2. KNOCKOUT / ELIMINATION TOURNAMENT GENERATION (Power-of-2 with Byes)
    if (tournamentType === 'KNOCKOUT' || tournamentType === 'SINGLE_ELIMINATION' || tournamentType === 'DOUBLE_ELIMINATION') {
      const ko = tournamentEngine.generateSingleEliminationRound1(teams, {
        seeding: options.seeding || 'AS_IS',
        doubleElimination: tournamentType === 'DOUBLE_ELIMINATION'
      });

      await db.models.Tournament.updateOne(
        { id: tournament.id },
        {
          $set: {
            'format_config.byes': ko.byes,
            'format_config.unresolved_ties': []
          }
        }
      );

      ko.pairings.forEach((p, idx) => {
        const matchId = `M-${tournament.id.replace(/[^a-zA-Z0-9]/g, '')}-KO-R1-${String(matchCounter).padStart(2, '0')}`;
        const seq = matchCounter;
        matchCounter++;
        const matchDate = getMatchDate(idx, ko.pairings.length);
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
          round_number: p.round,
          fixture_seq: seq,
          bracket: p.bracket,
          status: 'SCHEDULED',
          schedule_confirmation_status: 'CONFIRMED',
          schedule_confirmed_at: new Date(),
          schedule_confirmed_by: adminEmail || 'admin@cfvd.org',
          rules_snapshot: rulesSnapshot,
          assigned_scorer_id: defaultScorerId,
          assigned_scorer_name: defaultScorerName,
          scorer_name: defaultScorerName,
          umpire1_id: defaultUmpire1Id,
          umpire2_id: defaultUmpire2Id,
          umpire1_name: defaultUmpire1Name,
          umpire2_name: defaultUmpire2Name
        });
      });
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

    const pointsWin = Number(tournament.points_win !== undefined ? tournament.points_win : 4);
    const pointsLoss = Number(tournament.points_loss !== undefined ? tournament.points_loss : 0);
    const pointsTie = Number(tournament.points_tie !== undefined ? tournament.points_tie : (pointsWin / 2));
    const pointsNoResult = Number(tournament.points_no_result !== undefined ? tournament.points_no_result : (pointsWin / 2));
    const pointsBonusWin = Number(tournament.points_bonus_win !== undefined ? tournament.points_bonus_win : 1);
    const pointsBonusLoss = Number(tournament.points_bonus_loss !== undefined ? tournament.points_bonus_loss : -1);
    const pointsWalkoverWin = Number(tournament.points_walkover_win !== undefined ? tournament.points_walkover_win : 4);
    const pointsWalkoverLoss = Number(tournament.points_walkover_loss !== undefined ? tournament.points_walkover_loss : -1);

    const teamIds = tournament.teams || [];
    let teams = cachedTeams;
    if (!teams) {
      const validTidsObjIds = teamIds.filter(id => typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/));
      const [regTeams, appTeams] = await Promise.all([
        db.models.Team.find({
          $or: [
            { id: { $in: teamIds } },
            { team_id: { $in: teamIds } },
            { name: { $in: teamIds } },
            { team_name: { $in: teamIds } },
            ...(validTidsObjIds.map(id => ({ _id: id })))
          ]
        }).lean(),
        db.models.TeamRegistration.find({
          $or: [
            { id: { $in: teamIds } },
            { team_name: { $in: teamIds } },
            ...(validTidsObjIds.map(id => ({ _id: id })))
          ]
        }).lean()
      ]);
      const teamMap = {};
      regTeams.forEach(t => {
        const name = t.name || t.team_name;
        if (t.id) teamMap[t.id] = name;
        if (t.team_id) teamMap[t.team_id] = name;
        if (t._id) teamMap[t._id.toString()] = name;
      });
      appTeams.forEach(t => {
        const name = t.team_name;
        if (t.id && !teamMap[t.id]) teamMap[t.id] = name;
        if (t._id && !teamMap[t._id.toString()]) teamMap[t._id.toString()] = name;
      });
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

    // Helper: determine maximum wickets based on squad size / playing XI
    const getMaxWicketsForInnings = (inn, m) => {
      if (!m) return 10;
      const isTeamA = inn?.batting_team_id === m.team_a_id;
      const lineup = isTeamA ? (m.team_a_playing_xi || m.team_a_lineup) : (m.team_b_playing_xi || m.team_b_lineup);
      if (Array.isArray(lineup) && lineup.length > 1) {
        return Math.max(1, lineup.length - 1);
      }
      if (m.players_per_side && m.players_per_side > 1) {
        return Math.max(1, m.players_per_side - 1);
      }
      return 10;
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

      let winner = null;
      let isTie = false;
      let isNoResult = false;

      // 1. Check winner_id in database directly (avoids name overlap / substring bugs)
      if (m.winner_id) {
        if (m.winner_id === teamA) {
          winner = teamA;
        } else if (m.winner_id === teamB) {
          winner = teamB;
        } else if (m.winner_id === 'TIE' || m.winner_id === 'MATCH_TIED') {
          isTie = true;
        } else if (m.winner_id === 'NO_RESULT' || m.winner_id === 'ABANDONED') {
          isNoResult = true;
        }
      }

      // 2. Fallback to text matching if winner_id was not set
      if (!winner && !isTie && !isNoResult) {
        const res = (m.result_summary || '').toLowerCase();
        const teamAName = (m.team_a_name || '').toLowerCase().trim();
        const teamBName = (m.team_b_name || '').toLowerCase().trim();

        if (res.includes('tied') || res.includes('match tied')) {
          isTie = true;
        } else if (res.includes('no result') || res.includes('abandoned') || res.includes('cancelled')) {
          isNoResult = true;
        } else {
          // Sort by name length descending so "Spartans XI" matches before "Spartans"
          const candidates = [
            { id: teamA, name: teamAName },
            { id: teamB, name: teamBName }
          ].sort((a, b) => b.name.length - a.name.length);

          for (const cand of candidates) {
            if (cand.name && res.includes(cand.name) && res.includes('won')) {
              winner = cand.id;
              break;
            }
          }

          if (!winner && res.includes('won by')) {
            const matchInnings = inningsByMatch[m.id] || [];
            const inn1 = matchInnings.find(i => i.innings_number === 1);
            const inn2 = matchInnings.find(i => i.innings_number === 2);
            if (inn1 && inn2) {
              if (inn1.total_runs > inn2.total_runs) winner = inn1.batting_team_id;
              else if (inn2.total_runs > inn1.total_runs) winner = inn2.batting_team_id;
              else isTie = true;
            }
          }
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
      } else if (winner === teamA || winner === teamB) {
        const loser = winner === teamA ? teamB : teamA;
        standings[winner].won++;
        standings[loser].lost++;
        if (m.is_walkover) {
          standings[winner].points += pointsWalkoverWin;
          standings[loser].points += pointsWalkoverLoss;
        } else {
          standings[winner].points += pointsWin + (m.bonus_point_winner ? pointsBonusWin : 0);
          standings[loser].points += pointsLoss + (m.bonus_point_loser_penalty ? pointsBonusLoss : 0);
        }
        standings[winner].form.push('W');
        standings[loser].form.push('L');
      } else {
        // Fallback default
        standings[teamA].no_result++;
        standings[teamB].no_result++;
        standings[teamA].points += pointsNoResult;
        standings[teamB].points += pointsNoResult;
        standings[teamA].form.push('NR');
        standings[teamB].form.push('NR');
      }

      // Rules: No-result / Abandoned matches do NOT count towards NRR calculations
      if (isNoResult || m.status === 'ABANDONED' || m.status === 'CANCELLED') {
        return;
      }

      // Add NRR tallies from Innings
      const matchInns = inningsByMatch[m.id] || [];
      const inn1 = matchInns.find(i => i.innings_number === 1);
      const inn2 = matchInns.find(i => i.innings_number === 2);

      // Check if DLS or rain revised target/overs was applied
      const isDlsOrRevised = Boolean(m.revised_target || m.revised_overs || inn2?.revised_overs);
      const revisedOvers = m.revised_overs || inn2?.revised_overs || null;
      const revisedTarget = m.revised_target || inn2?.target || null;

      matchInns.forEach(inn => {
        const batTeam = inn.batting_team_id;
        const bowlTeam = inn.bowling_team_id;
        const maxWickets = getMaxWicketsForInnings(inn, m);
        const isAllOut = inn.wickets >= maxWickets;
        const standardMaxOvers = m.overs_per_side || tournament.overs_per_match || 20;

        let runsScored = inn.total_runs || 0;
        let decOvers = 0;

        if (isDlsOrRevised && revisedOvers && inn.innings_number === 1) {
          // Team 1 DLS adjustment: accredited with revised target - 1 and revised overs
          runsScored = revisedTarget ? Math.max(0, revisedTarget - 1) : runsScored;
          decOvers = revisedOvers;
        } else if (isDlsOrRevised && revisedOvers && inn.innings_number === 2) {
          // Team 2 DLS adjustment: accredited with actual runs and overs faced (capped at revised overs if all out)
          decOvers = toDecimalOvers(inn.overs, inn.balls, isAllOut, revisedOvers);
        } else {
          // Standard match calculation
          decOvers = toDecimalOvers(inn.overs, inn.balls, isAllOut, standardMaxOvers);
        }

        if (standings[batTeam]) {
          standings[batTeam].runs_scored += runsScored;
          standings[batTeam].overs_faced += decOvers;
        }
        if (standings[bowlTeam]) {
          standings[bowlTeam].runs_conceded += runsScored;
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
      // Atomic idempotency guard: claim processing once per completed match
      const claimedMatch = await db.models.Match.findOneAndUpdate(
        {
          id: matchId,
          status: 'COMPLETED',
          stats_processed: { $ne: true },
          stats_processing_status: { $ne: 'PROCESSING' }
        },
        { $set: { stats_processing_status: 'PROCESSING', stats_processing_error: null } },
        { new: true }
      ).lean();

      const match = claimedMatch || await db.models.Match.findOne({ id: matchId }).lean();
      if (!match) return { processed: false, progression: { advanced: false } };

      if (claimedMatch) {
        const statsSnapshot = { teams: [], players: [], potm: null };
        try {
          // 1. Trigger PlayerMatchRating calculation idempotently
          try {
            const playerRatingService = require('./playerRatingService');
            await playerRatingService.recalculateMatchRatings(matchId);
          } catch (_ratingErr) { }

          // 2. Roll up permanent Team.stats (with exact snapshot for safe reversal)
          const isTie = match.winner_id === 'TIE' || match.winner_id === 'MATCH_TIED';
          const isNR = match.winner_id === 'NO_RESULT' || match.winner_id === 'ABANDONED';
          const teamIds = [match.team_a_id, match.team_b_id].filter(Boolean);
          for (const tId of teamIds) {
            const inc = { 'stats.matches': 1 };
            if (isTie) inc['stats.tied'] = 1;
            else if (isNR) inc['stats.no_result'] = 1;
            else if (match.winner_id === tId) inc['stats.won'] = 1;
            else if (match.winner_id) inc['stats.lost'] = 1;

            const updatedTeam = await db.models.Team.findOneAndUpdate(
              { $or: [{ id: tId }, { team_id: tId }] },
              { $inc: inc },
              { new: true }
            );
            if (updatedTeam) {
              statsSnapshot.teams.push({ team_id: tId, inc });
              if (updatedTeam.stats && updatedTeam.stats.matches > 0) {
                updatedTeam.stats.win_percentage = parseFloat(
                  (((updatedTeam.stats.won || 0) / updatedTeam.stats.matches) * 100).toFixed(1)
                );
                await updatedTeam.save();
              }
            }
          }

          // 3. Roll up permanent Player.stats from InningsBatter / InningsBowler
          const matchInns = await db.models.Innings.find({ match_id: matchId }).lean();
          const innIds = matchInns.map(i => i.id);
          const [batters, bowlers] = await Promise.all([
            db.models.InningsBatter.find({ innings_id: { $in: innIds } }).lean(),
            db.models.InningsBowler.find({ innings_id: { $in: innIds } }).lean()
          ]);
          const playerDeltaMap = {};
          const addDelta = (pId, fields) => {
            if (!playerDeltaMap[pId]) playerDeltaMap[pId] = {};
            Object.entries(fields).forEach(([k, v]) => {
              playerDeltaMap[pId][k] = (playerDeltaMap[pId][k] || 0) + v;
            });
          };

          for (const b of batters) {
            if (!b.player_id) continue;
            const inc = {
              'stats.innings': 1,
              'stats.runs': b.runs || 0,
              'stats.balls': b.balls || 0,
              'stats.fours': b.fours || 0,
              'stats.sixes': b.sixes || 0
            };
            if (!b.is_out) inc['stats.not_outs'] = 1;
            if ((b.runs || 0) >= 100) inc['stats.hundreds'] = 1;
            else if ((b.runs || 0) >= 50) inc['stats.fifties'] = 1;

            addDelta(b.player_id, inc);
            await db.models.Player.updateOne(
              { id: b.player_id },
              { $inc: inc, $max: { 'stats.highest_score': b.runs || 0 } }
            );
          }

          for (const bw of bowlers) {
            if (!bw.player_id) continue;
            const inc = {
              'stats.wickets': bw.wickets || 0,
              'stats.overs': bw.overs || 0,
              'stats.maidens': bw.maidens || 0,
              'stats.runs_conceded': bw.runs_conceded || 0
            };
            addDelta(bw.player_id, inc);
            await db.models.Player.updateOne({ id: bw.player_id }, { $inc: inc });
          }

          for (const pId of Object.keys(playerDeltaMap)) {
            addDelta(pId, { 'stats.matches': 1 });
            await db.models.Player.updateOne({ id: pId }, { $inc: { 'stats.matches': 1 } });
            statsSnapshot.players.push({ player_id: pId, inc: playerDeltaMap[pId] });
          }

          if (match.player_of_match) {
            statsSnapshot.potm = match.player_of_match;
            await db.models.Player.updateOne(
              { $or: [{ id: match.player_of_match }, { name: match.player_of_match }] },
              { $inc: { 'stats.potm_awards': 1 } }
            );
          }

          await db.models.Match.updateOne(
            { id: matchId },
            {
              $set: {
                stats_processed: true,
                stats_processing_status: 'COMPLETED',
                stats_processed_at: new Date(),
                stats_snapshot: statsSnapshot,
                stats_processing_error: null
              }
            }
          );
        } catch (rollupErr) {
          // Roll back any partial Team/Player increments applied before failure so retries never duplicate stats
          try {
            for (const tEntry of (statsSnapshot.teams || [])) {
              const dec = {};
              Object.entries(tEntry.inc || {}).forEach(([k, v]) => { dec[k] = -Math.abs(v); });
              const revTeam = await db.models.Team.findOneAndUpdate(
                { $or: [{ id: tEntry.team_id }, { team_id: tEntry.team_id }] },
                { $inc: dec },
                { new: true }
              );
              if (revTeam && revTeam.stats) {
                revTeam.stats.matches = Math.max(0, revTeam.stats.matches || 0);
                revTeam.stats.won = Math.max(0, revTeam.stats.won || 0);
                revTeam.stats.lost = Math.max(0, revTeam.stats.lost || 0);
                revTeam.stats.tied = Math.max(0, revTeam.stats.tied || 0);
                revTeam.stats.no_result = Math.max(0, revTeam.stats.no_result || 0);
                revTeam.stats.win_percentage = revTeam.stats.matches > 0
                  ? parseFloat(((revTeam.stats.won / revTeam.stats.matches) * 100).toFixed(1))
                  : 0;
                await revTeam.save();
              }
            }
            for (const pEntry of (statsSnapshot.players || [])) {
              const dec = {};
              Object.entries(pEntry.inc || {}).forEach(([k, v]) => { dec[k] = -Math.abs(v); });
              await db.models.Player.updateOne({ id: pEntry.player_id }, { $inc: dec });
            }
          } catch (_rbErr) { }

          await db.models.Match.updateOne(
            { id: matchId },
            {
              $set: {
                stats_processing_status: 'FAILED',
                stats_processing_error: rollupErr?.message || 'Stats rollup failed'
              }
            }
          );
          throw rollupErr;
        }
      }

      if (!match.tournament_id) return { processed: Boolean(claimedMatch), progression: { advanced: false } };

      // Advance knockout / playoff stages if current stage is complete
      const progression = await this.advanceTournamentStage(match.tournament_id);

      const tour = await db.models.Tournament.findOne({ id: match.tournament_id });
      if (!tour) return { processed: Boolean(claimedMatch), progression };

      // Run idempotent bracket/knockout progression & team stats sync FIRST
      // so next-round fixtures are created before checking if tournament is finished
      const tournamentEngine = require('./tournamentEngine');
      await tournamentEngine.processMatchProgression(matchId);

      // Re-fetch tournament after progression
      const refreshedTour = await db.models.Tournament.findOne({ id: match.tournament_id });
      if (!refreshedTour) return;

      let changed = false;
      if (refreshedTour.status === 'UPCOMING') {
        refreshedTour.status = 'ONGOING';
        changed = true;
      }

      // Check remaining matches (only mark COMPLETED if no pending matches and no unresolved ties)
      const activePendingCount = await db.models.Match.countDocuments({
        tournament_id: match.tournament_id,
        status: { $in: ['SCHEDULED', 'LIVE', 'INNINGS_BREAK', 'TOSS', 'PAUSED'] }
      });
      const hasUnresolvedTies = Array.isArray(progression?.unresolved_ties) && progression.unresolved_ties.length > 0;

      if (activePendingCount === 0 && !hasUnresolvedTies) {
        const completedCount = await db.models.Match.countDocuments({
          tournament_id: match.tournament_id,
          status: 'COMPLETED'
        });
        if (completedCount > 0 && refreshedTour.status !== 'COMPLETED') {
          refreshedTour.status = 'COMPLETED';
          changed = true;
        }
      }

      if (changed) {
        refreshedTour.updatedAt = new Date();
        await refreshedTour.save();
      }
      return { processed: Boolean(claimedMatch), progression };
    } catch (err) {
      return { processed: false, progression: { advanced: false, error: err?.message || 'Processing failed' } };
    }
  }

  /**
   * Safely revert a completed match's stats contribution and unstarted downstream fixtures.
   * Blocks with 409 if downstream knockout/playoff matches have already started or completed.
   */
  async revertMatchCompletion(matchId, reason = 'RESULT_CORRECTION') {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId }).lean();
    if (!match) throw { status: 404, message: 'Match not found.' };

    const runRevert = async () => {
      const freshMatch = await db.models.Match.findOne({ id: matchId }).lean();
      if (!freshMatch || !freshMatch.stats_processed) {
        return { reverted: false };
      }

      // Check downstream progression safety if part of a tournament
      let downstreamToRemove = [];
      if (freshMatch.tournament_id) {
        const allMatches = await db.models.Match.find({ tournament_id: freshMatch.tournament_id }).lean();
        const st = String(freshMatch.stage || '');
        const isGroupMatch = st.startsWith('GROUP_');
        const isLeagueMatch = st.startsWith('LEAGUE_STAGE');

        const downstream = allMatches.filter(m => {
          if (m.id === freshMatch.id) return false;
          const mst = String(m.stage || '');
          if (isGroupMatch) return !mst.startsWith('GROUP_');
          if (isLeagueMatch) return ['QUALIFIER_1', 'ELIMINATOR', 'QUALIFIER_2', 'FINAL'].includes(mst);
          if (st === 'QUALIFIER_1' || st === 'ELIMINATOR') return ['QUALIFIER_2', 'FINAL'].includes(mst);
          if (st === 'QUALIFIER_2') return mst === 'FINAL';
          return Number(m.round_number || 1) > Number(freshMatch.round_number || 1);
        });

        const activeDownstream = downstream.filter(m =>
          ['LIVE', 'INNINGS_BREAK', 'TOSS', 'PAUSED', 'COMPLETED'].includes(m.status)
        );
        if (activeDownstream.length > 0) {
          throw {
            status: 409,
            code: 'DOWNSTREAM_STAGE_ACTIVE',
            message: `Cannot reverse match '${matchId}' because downstream stage matches (${activeDownstream.map(m => m.id).join(', ')}) have already started or completed. Admin intervention is required.`
          };
        }
        downstreamToRemove = downstream.filter(m => m.status === 'SCHEDULED' && m.schedule_confirmed_by === 'SYSTEM_QUALIFICATION');
      }

      // Atomically claim reversal
      const claimed = await db.models.Match.findOneAndUpdate(
        { id: matchId, stats_processed: true },
        { $set: { stats_processed: false, stats_processing_status: 'IDLE', stats_processed_at: null } },
        { new: false }
      ).lean();
      if (!claimed) return { reverted: false };

      // Reverse Team & Player stats from exact snapshot
      const snap = claimed.stats_snapshot;
      if (snap) {
        for (const tEntry of (snap.teams || [])) {
          const dec = {};
          Object.entries(tEntry.inc || {}).forEach(([k, v]) => { dec[k] = -Math.abs(v); });
          const updatedTeam = await db.models.Team.findOneAndUpdate(
            { $or: [{ id: tEntry.team_id }, { team_id: tEntry.team_id }] },
            { $inc: dec },
            { new: true }
          );
          if (updatedTeam && updatedTeam.stats) {
            updatedTeam.stats.matches = Math.max(0, updatedTeam.stats.matches || 0);
            updatedTeam.stats.won = Math.max(0, updatedTeam.stats.won || 0);
            updatedTeam.stats.lost = Math.max(0, updatedTeam.stats.lost || 0);
            updatedTeam.stats.tied = Math.max(0, updatedTeam.stats.tied || 0);
            updatedTeam.stats.no_result = Math.max(0, updatedTeam.stats.no_result || 0);
            updatedTeam.stats.win_percentage = updatedTeam.stats.matches > 0
              ? parseFloat(((updatedTeam.stats.won / updatedTeam.stats.matches) * 100).toFixed(1))
              : 0;
            await updatedTeam.save();
          }
        }

        for (const pEntry of (snap.players || [])) {
          const dec = {};
          Object.entries(pEntry.inc || {}).forEach(([k, v]) => { dec[k] = -Math.abs(v); });
          await db.models.Player.updateOne({ id: pEntry.player_id }, { $inc: dec });
        }

        if (snap.potm) {
          await db.models.Player.updateOne(
            { $or: [{ id: snap.potm }, { name: snap.potm }] },
            { $inc: { 'stats.potm_awards': -1 } }
          );
        }

        await db.models.Match.updateOne({ id: matchId }, { $set: { stats_snapshot: null } });
      }

      if (downstreamToRemove.length > 0) {
        await db.models.Match.deleteMany({ id: { $in: downstreamToRemove.map(m => m.id) } });
      }

      if (freshMatch.tournament_id) {
        await db.models.Tournament.updateOne(
          { id: freshMatch.tournament_id, status: 'COMPLETED' },
          {
            $set: {
              status: 'ONGOING',
              winner_team_id: null,
              winner_team_name: '',
              runner_up_team_id: null,
              runner_up_team_name: '',
              'format_config.unresolved_ties': []
            }
          }
        );
      }

      await this._logAudit(
        'MATCH_COMPLETION_REVERTED',
        'SYSTEM',
        matchId,
        'SUCCESS',
        `Reverted completion for ${matchId} (Reason: ${reason}). Removed ${downstreamToRemove.length} unstarted downstream fixtures.`
      );

      return { reverted: true, removed_downstream_count: downstreamToRemove.length };
    };

    if (match.tournament_id) {
      return this._withTournamentLock(match.tournament_id, runRevert);
    }
    return runRevert();
  }

  /**
   * Preview fixture distribution, rounds, byes, groups & expected total matches without writing to DB
   */
  async previewFixtures(tournamentId, options = {}) {
    await db.initDb();
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw { status: 404, message: `Tournament with ID '${tournamentId}' not found.` };
    }
    const teams = options.teams || tournament.teams || [];
    const tournamentType = options.tournament_type || tournament.tournament_type || 'SINGLE_ROUND_ROBIN';
    const roundRobinType = tournamentType === 'DOUBLE_ROUND_ROBIN'
      ? 'DOUBLE'
      : tournamentType === 'SINGLE_ROUND_ROBIN'
        ? 'SINGLE'
        : (options.round_robin_type || tournament.format_config?.round_robin_type || 'SINGLE');
    const mergedFormatCfg = { ...(tournament.format_config || {}), ...(options.format_config || {}) };

    // Resolve team names
    const teamDocs = await db.models.Team.find({ $or: [{ id: { $in: teams } }, { team_id: { $in: teams } }] }).lean();
    const regDocs = await db.models.TeamRegistration.find({ id: { $in: teams } }).lean();
    const nameMap = {};
    teamDocs.forEach(t => { if (t.id) nameMap[t.id] = t.name || t.team_name; });
    regDocs.forEach(r => { if (r.id && !nameMap[r.id]) nameMap[r.id] = r.team_name; });

    if (tournamentType === 'GROUP_KNOCKOUT' || tournamentType === 'GROUP_SUPER_LEAGUE') {
      const alloc = tournamentEngine.allocateGroups(teams, mergedFormatCfg);
      let totalGroupMatches = 0;
      const groupSummaries = alloc.groups.map(g => {
        const rr = tournamentEngine.generateRoundRobinRounds(g.teams, { doubleLeg: roundRobinType === 'DOUBLE', stagePrefix: g.key });
        totalGroupMatches += rr.totalMatches;
        return {
          key: g.key,
          label: g.label,
          teamCount: g.teams.length,
          teams: g.teams.map(id => ({ id, name: nameMap[id] || id })),
          matchesPerGroup: rr.totalMatches,
          rounds: rr.totalRounds,
          byesCount: rr.byes.length
        };
      });
      const qPerGroup = Math.max(1, Number(mergedFormatCfg.qualifiers_per_group || 1));
      const bestRU = Math.max(0, Number(mergedFormatCfg.best_runners_up_count || 0));
      const qualifyingTeamsCount = Math.min(teams.length, alloc.groups.length * qPerGroup + bestRU);
      const knockoutMatchesCount = qualifyingTeamsCount >= 2 ? qualifyingTeamsCount - 1 : 0;

      return {
        success: true,
        tournament_id: tournament.id,
        tournament_type: tournamentType,
        team_count: teams.length,
        groups: groupSummaries,
        total_group_matches: totalGroupMatches,
        qualifying_teams_count: qualifyingTeamsCount,
        knockout_matches_count: knockoutMatchesCount,
        total_expected_matches: totalGroupMatches + knockoutMatchesCount,
        byes_count: groupSummaries.reduce((s, g) => s + g.byesCount, 0)
      };
    }

    if (tournamentType === 'SINGLE_ELIMINATION' || tournamentType === 'KNOCKOUT' || tournamentType === 'DOUBLE_ELIMINATION') {
      const ko = tournamentEngine.generateSingleEliminationRound1(teams, {
        seeding: options.seeding || 'AS_IS',
        doubleElimination: tournamentType === 'DOUBLE_ELIMINATION'
      });
      return {
        success: true,
        tournament_id: tournament.id,
        tournament_type: tournamentType,
        team_count: teams.length,
        bracket_size: ko.bracketSize,
        byes_count: ko.byesCount,
        byes: ko.byes.map(b => ({ ...b, team_name: nameMap[b.team_id] || b.team_id })),
        round1_matches_count: ko.pairings.length,
        total_expected_matches: ko.totalExpectedMatches
      };
    }

    const rr = tournamentEngine.generateRoundRobinRounds(teams, { doubleLeg: roundRobinType === 'DOUBLE' });
    const playoffMatches = (tournamentType === 'LEAGUE_PLAYOFFS' || tournamentType === 'LEAGUE_KNOCKOUT') && teams.length >= 4 ? 4 : 0;
    return {
      success: true,
      tournament_id: tournament.id,
      tournament_type: tournamentType,
      team_count: teams.length,
      total_rounds: rr.totalRounds,
      league_matches_count: rr.totalMatches,
      byes_count: rr.byes.length,
      byes: rr.byes.map(b => ({ ...b, team_name: nameMap[b.team_id] || b.team_id })),
      playoff_matches_count: playoffMatches,
      total_expected_matches: rr.totalMatches + playoffMatches
    };
  }

  /**
   * Compute group-wise points tables + qualifier preview + unresolved tie warnings
   */
  async getGroupPointsTables(tournamentId) {
    await db.initDb();
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) {
      throw { status: 404, message: `Tournament with ID '${tournamentId}' not found.` };
    }
    const allMatches = await db.models.Match.find({
      $or: [{ tournament_id: tournament.id }, { tournament_name: tournament.name }]
    }).lean();
    const completedMatches = allMatches.filter(m => m.status === 'COMPLETED');
    const matchIds = completedMatches.map(m => m.id);
    const inningsList = await db.models.Innings.find({
      match_id: { $in: matchIds },
      $or: [{ is_completed: true }, { status: 'COMPLETED' }]
    }).lean();
    const inningsByMatch = {};
    inningsList.forEach(inn => {
      if (!inningsByMatch[inn.match_id]) inningsByMatch[inn.match_id] = [];
      inningsByMatch[inn.match_id].push(inn);
    });

    const teamDocs = await db.models.Team.find({ $or: [{ id: { $in: tournament.teams || [] } }, { team_id: { $in: tournament.teams || [] } }] }).lean();
    const regDocs = await db.models.TeamRegistration.find({ id: { $in: tournament.teams || [] } }).lean();
    const nameMap = {};
    teamDocs.forEach(t => { if (t.id) nameMap[t.id] = t.name || t.team_name; });
    regDocs.forEach(r => { if (r.id && !nameMap[r.id]) nameMap[r.id] = r.team_name; });

    let groupsSnapshot = tournament.format_config?.groups_snapshot || [];
    if (groupsSnapshot.length === 0) {
      const alloc = tournamentEngine.allocateGroups(tournament.teams || [], tournament.format_config || {});
      groupsSnapshot = alloc.groups;
    }

    const groupsTable = {};
    groupsSnapshot.forEach(grp => {
      const grpTeams = (grp.teams || []).map(id => ({ id, name: nameMap[id] || id }));
      const grpMatches = completedMatches.filter(m => m.group_key === grp.key || m.stage === grp.key);
      groupsTable[grp.key] = tournamentEngine.computeStandings(grpTeams, grpMatches, inningsByMatch, tournament, {
        manualTieResolution: tournament.format_config?.manual_groups_tie_resolution || {}
      });
    });

    const qualRes = tournamentEngine.computeGroupQualifiers(groupsTable, tournament.format_config || {});
    return {
      success: true,
      tournament_id: tournament.id,
      groups: groupsTable,
      qualifiers: qualRes.qualifiers,
      unresolved_ties: qualRes.unresolvedTies
    };
  }

  /**
   * Automatic Stage Progression Engine (serialized per tournament to avoid duplicate fixtures)
   */
  async advanceTournamentStage(tournamentId) {
    return this._withTournamentLock(tournamentId, async () => {
      await db.initDb();
      const tour = await db.models.Tournament.findOne({ id: tournamentId });
      if (!tour) return { advanced: false };

      const tType = tour.tournament_type || 'SINGLE_ROUND_ROBIN';
      const allMatches = await db.models.Match.find({ tournament_id: tour.id }).sort({ fixture_seq: 1, round_number: 1 }).lean();
      if (allMatches.length === 0) return { advanced: false };

      const teamDocs = await db.models.Team.find({ $or: [{ id: { $in: tour.teams || [] } }, { team_id: { $in: tour.teams || [] } }] }).lean();
      const regDocs = await db.models.TeamRegistration.find({ id: { $in: tour.teams || [] } }).lean();
      const nameMap = {};
      teamDocs.forEach(t => { if (t.id) nameMap[t.id] = t.name || t.team_name; });
      regDocs.forEach(r => { if (r.id && !nameMap[r.id]) nameMap[r.id] = r.team_name; });

      const pr = tour.playing_rules || {};
      const rulesSnapshot = {
        ...pr,
        tournament_type: tType,
        overs_per_match: tour.overs_per_match || 20,
        playing_xi_size: tour.playing_xi_size ?? 11,
        allow_super_over: tour.allow_super_over !== false,
        allow_dls: Boolean(tour.allow_dls),
        allow_chain_over: Boolean(pr.allow_chain_over),
        max_overs_per_bowler: pr.max_overs_per_bowler ?? 4,
        free_hit_on_all_noballs: pr.free_hit_on_all_noballs !== false,
        powerplay_overs: pr.powerplay_overs ?? 5,
        tie_handling: pr.tie_handling || 'SHARE_POINTS',
        snapshot_at: new Date()
      };

      const maxSeq = allMatches.reduce((mx, m) => Math.max(mx, Number(m.fixture_seq || 0)), 0);
      const createStageMatches = async (pairingsList, stagePrefix) => {
        if (!pairingsList || pairingsList.length === 0) return [];
        const docs = pairingsList.map((p, idx) => {
          const seq = maxSeq + idx + 1;
          return {
            id: `M-${tour.id.replace(/[^a-zA-Z0-9]/g, '')}-${stagePrefix}-${seq}`,
            tournament_id: tour.id,
            tournament_name: tour.name,
            team_a_id: p.home,
            team_b_id: p.away,
            team_a_name: nameMap[p.home] || p.home,
            team_b_name: nameMap[p.away] || p.away,
            venue: tour.venue || 'Kamarajar District Stadium',
            match_date: tour.end_date || new Date().toISOString().split('T')[0],
            match_time: idx % 2 === 0 ? '09:30 AM' : '02:00 PM',
            match_type: tour.match_format || 'T20',
            overs_per_side: tour.overs_per_match || 20,
            stage: p.stage,
            round_number: p.round || 1,
            fixture_seq: seq,
            bracket: p.bracket || 'MAIN',
            qualification_source: p.qualification_source || null,
            status: 'SCHEDULED',
            schedule_confirmation_status: 'CONFIRMED',
            schedule_confirmed_at: new Date(),
            schedule_confirmed_by: 'SYSTEM_QUALIFICATION',
            rules_snapshot: rulesSnapshot,
            assigned_scorer_id: 'SCR-101',
            assigned_scorer_name: 'Official Scorer',
            scorer_name: 'Official Scorer',
            umpire1_id: 'UMP-101',
            umpire2_id: 'UMP-102'
          };
        });
        await db.models.Match.insertMany(docs);
        return docs;
      };

      const crownChampion = async (finalMatch) => {
        if (!finalMatch || finalMatch.status !== 'COMPLETED' || !finalMatch.winner_id) return;
        const winId = finalMatch.winner_id;
        const runId = winId === finalMatch.team_a_id ? finalMatch.team_b_id : finalMatch.team_a_id;
        tour.winner_team_id = winId;
        tour.winner_team_name = nameMap[winId] || winId;
        tour.runner_up_team_id = runId;
        tour.runner_up_team_name = nameMap[runId] || runId;
        tour.status = 'COMPLETED';
        await tour.save();

        await db.models.Team.updateOne(
          { $or: [{ id: winId }, { team_id: winId }], 'championship_titles.tournament_id': { $ne: tour.id } },
          { $push: { championship_titles: { tournament_id: tour.id, tournament_name: tour.name, season: tour.season || '2026' } } }
        );
        await db.models.Team.updateOne(
          { $or: [{ id: runId }, { team_id: runId }], 'runner_up_titles.tournament_id': { $ne: tour.id } },
          { $push: { runner_up_titles: { tournament_id: tour.id, tournament_name: tour.name, season: tour.season || '2026' } } }
        );
      };

      // A. SINGLE ELIMINATION / KNOCKOUT PROGRESSION
      if (tType === 'SINGLE_ELIMINATION' || tType === 'KNOCKOUT') {
        const maxRound = allMatches.reduce((mx, m) => Math.max(mx, Number(m.round_number || 1)), 1);
        const curRoundMatches = allMatches.filter(m => Number(m.round_number || 1) === maxRound);
        if (curRoundMatches.some(m => m.status !== 'COMPLETED' || !m.winner_id)) return { advanced: false };

        const roundWinners = curRoundMatches.map(m => m.winner_id);
        const r1Byes = maxRound === 1 ? (tour.format_config?.byes || []).map(b => b.team_id) : [];
        const advancing = [...r1Byes, ...roundWinners].filter(Boolean);

        if (advancing.length === 1 && curRoundMatches.length === 1) {
          await crownChampion(curRoundMatches[0]);
          return { advanced: true, completed: true };
        }

        if (advancing.length >= 2) {
          const nextRound = maxRound + 1;
          const alreadyExists = allMatches.some(m => Number(m.round_number) === nextRound);
          if (alreadyExists) return { advanced: false };

          const nextStage = tournamentEngine.getKnockoutStageName(advancing.length);
          const nextPairings = [];
          for (let i = 0; i < Math.floor(advancing.length / 2); i++) {
            nextPairings.push({
              home: advancing[i],
              away: advancing[advancing.length - 1 - i],
              stage: nextStage,
              round: nextRound,
              qualification_source: { round: maxRound }
            });
          }
          const created = await createStageMatches(nextPairings, `R${nextRound}`);
          return { advanced: true, created_count: created.length, stage: nextStage };
        }
      }

      // B. GROUP STAGE + KNOCKOUT PROGRESSION
      if (tType === 'GROUP_KNOCKOUT' || tType === 'GROUP_SUPER_LEAGUE') {
        const groupMatches = allMatches.filter(m => String(m.stage || '').startsWith('GROUP_'));
        const koMatches = allMatches.filter(m => !String(m.stage || '').startsWith('GROUP_'));

        if (koMatches.length === 0) {
          if (groupMatches.length === 0 || groupMatches.some(m => m.status !== 'COMPLETED')) return { advanced: false };

          const grpTables = await this.getGroupPointsTables(tour.id);
          if (grpTables.unresolved_ties && grpTables.unresolved_ties.length > 0) {
            await db.models.Tournament.updateOne(
              { id: tour.id },
              { $set: { 'format_config.unresolved_ties': grpTables.unresolved_ties } }
            );
            return { advanced: false, unresolved_ties: grpTables.unresolved_ties };
          }

          await db.models.Tournament.updateOne(
            { id: tour.id },
            { $set: { 'format_config.unresolved_ties': [] } }
          );

          const seededIds = grpTables.qualifiers.map(q => q.team_id);
          if (seededIds.length < 2) return { advanced: false };

          const ko = tournamentEngine.generateSingleEliminationRound1(seededIds);
          await db.models.Tournament.updateOne(
            { id: tour.id },
            { $set: { 'format_config.byes': ko.byes } }
          );
          const qualSourceMap = {};
          grpTables.qualifiers.forEach(q => { qualSourceMap[q.team_id] = q.qualification_source; });

          const koPairings = ko.pairings.map(p => ({
            ...p,
            round: 1,
            qualification_source: { home: qualSourceMap[p.home], away: qualSourceMap[p.away] }
          }));
          const created = await createStageMatches(koPairings, 'KO-R1');
          return { advanced: true, created_count: created.length, stage: ko.stageName };
        } else {
          // Advance Knockout rounds once started
          const maxKoRound = koMatches.reduce((mx, m) => Math.max(mx, Number(m.round_number || 1)), 1);
          const curKoMatches = koMatches.filter(m => Number(m.round_number || 1) === maxKoRound);
          if (curKoMatches.some(m => m.status !== 'COMPLETED' || !m.winner_id)) return { advanced: false };

          const roundWinners = curKoMatches.map(m => m.winner_id);
          const r1Byes = maxKoRound === 1 ? (tour.format_config?.byes || []).map(b => b.team_id) : [];
          const advancing = [...r1Byes, ...roundWinners].filter(Boolean);

          if (advancing.length === 1 && curKoMatches.length === 1) {
            await crownChampion(curKoMatches[0]);
            return { advanced: true, completed: true };
          }

          if (advancing.length >= 2) {
            const nextRound = maxKoRound + 1;
            if (koMatches.some(m => Number(m.round_number) === nextRound)) return { advanced: false };
            const nextStage = tournamentEngine.getKnockoutStageName(advancing.length);
            const nextPairings = [];
            for (let i = 0; i < Math.floor(advancing.length / 2); i++) {
              nextPairings.push({
                home: advancing[i],
                away: advancing[advancing.length - 1 - i],
                stage: nextStage,
                round: nextRound
              });
            }
            const created = await createStageMatches(nextPairings, `KO-R${nextRound}`);
            return { advanced: true, created_count: created.length, stage: nextStage };
          }
        }
      }

      // C. LEAGUE + PLAYOFFS (IPL-STYLE) PROGRESSION
      if (tType === 'LEAGUE_PLAYOFFS' || tType === 'LEAGUE_KNOCKOUT') {
        const leagueMatches = allMatches.filter(m => String(m.stage || '').startsWith('LEAGUE_STAGE'));
        const playoffMatches = allMatches.filter(m => ['QUALIFIER_1', 'ELIMINATOR', 'QUALIFIER_2', 'FINAL'].includes(m.stage));

        if (leagueMatches.length === 0 || leagueMatches.some(m => m.status !== 'COMPLETED')) return { advanced: false };

        const finalMatch = playoffMatches.find(m => m.stage === 'FINAL');
        if (finalMatch && finalMatch.status === 'COMPLETED' && finalMatch.winner_id) {
          await crownChampion(finalMatch);
          return { advanced: true, completed: true };
        }

        const standings = await this.getPointsTable(tour.id, tour, null, leagueMatches);
        const nextPlayoffs = tournamentEngine.getNextIplPlayoffMatches(standings, playoffMatches);
        if (nextPlayoffs.length > 0) {
          const created = await createStageMatches(nextPlayoffs, 'PO');
          return { advanced: true, created_count: created.length };
        }
      }

      return { advanced: false };
    });
  }

  /**
   * Admin manual tie-breaker resolution + stage progression retry
   */
  async resolveTie(tournamentId, orderedTeamIds = [], adminEmail = 'admin@cfvd.org') {
    await db.initDb();
    const tour = await db.models.Tournament.findOne({ id: tournamentId });
    if (!tour) throw { status: 404, message: 'Tournament not found.' };

    const overrides = { ...(tour.format_config?.manual_groups_tie_resolution || {}) };
    orderedTeamIds.forEach((tId, idx) => {
      overrides[tId] = idx + 1;
    });

    await db.models.Tournament.updateOne(
      { id: tour.id },
      {
        $set: {
          'format_config.manual_groups_tie_resolution': overrides,
          'format_config.unresolved_ties': []
        }
      }
    );

    await this._logAudit('RESOLVE_TOURNAMENT_TIE', adminEmail, tour.name, `Resolved tie order: ${orderedTeamIds.join(', ')}`, '');
    return this.advanceTournamentStage(tour.id);
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
    } catch (_e) { }

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
   * Shared helper: Resolve real team metadata, captain, exact player count, and players roster
   * across Team, TeamRegistration, and Player collections.
   */
  async _loadTeamRosterContext() {
    const [allTeams, allTeamRegs, allPlayers] = await Promise.all([
      db.models.Team.find({}).lean(),
      db.models.TeamRegistration ? db.models.TeamRegistration.find({}).lean() : [],
      db.models.Player.find({}).lean()
    ]);

    const teamById = {};
    const teamByName = {};
    const teamByEmail = {};
    (allTeams || []).forEach(t => {
      if (t.id) teamById[t.id] = t;
      if (t.team_id) teamById[t.team_id] = t;
      const n = (t.name || '').trim().toLowerCase();
      if (n) teamByName[n] = t;
      const e = (t.coach_email || '').trim().toLowerCase();
      if (e) teamByEmail[e] = t;
    });

    const regById = {};
    const regByName = {};
    const regByEmail = {};
    (allTeamRegs || []).forEach(tr => {
      if (tr.id) regById[tr.id] = tr;
      const n = (tr.team_name || '').trim().toLowerCase();
      if (n) regByName[n] = tr;
      const e = (tr.coach_email || '').trim().toLowerCase();
      if (e) regByEmail[e] = tr;
    });

    const playersByTeamId = {};
    (allPlayers || []).forEach(p => {
      const tid = p.team_id;
      if (!tid) return;
      if (!playersByTeamId[tid]) playersByTeamId[tid] = [];
      playersByTeamId[tid].push(p);
    });

    const resolveFor = ({ teamId, teamName, coachEmail }) => {
      const nameKey = (teamName || '').trim().toLowerCase();
      const emailKey = (coachEmail || '').trim().toLowerCase();

      const tDoc = (teamId && teamById[teamId]) || (nameKey && teamByName[nameKey]) || (emailKey && teamByEmail[emailKey]) || null;
      const rDoc = (teamId && regById[teamId]) || (nameKey && regByName[nameKey]) || (emailKey && regByEmail[emailKey]) || null;

      const candidateIds = new Set([teamId, tDoc?.id, tDoc?.team_id, rDoc?.id].filter(Boolean));
      const playerMap = new Map();

      candidateIds.forEach(cid => {
        (playersByTeamId[cid] || []).forEach(p => {
          const pk = (p.email || p.id || p.name || '').toLowerCase();
          if (pk && !playerMap.has(pk)) {
            playerMap.set(pk, {
              id: p.id,
              name: p.name,
              email: p.email || '',
              mobile: p.mobile || p.phone || '',
              role: p.role || 'PLAYER',
              jersey_number: p.jersey_number ?? null,
              is_captain: Boolean(p.is_captain) || String(p.role || '').toLowerCase().includes('captain')
            });
          }
        });
      });

      if (rDoc && Array.isArray(rDoc.players)) {
        rDoc.players.forEach((p, idx) => {
          const pk = (p.email || p.name || `${rDoc.id}-${idx}`).toLowerCase();
          if (pk && !playerMap.has(pk)) {
            playerMap.set(pk, {
              id: p.id || `PLY-${rDoc.id}-${idx + 1}`,
              name: p.name || 'Player',
              email: p.email || '',
              mobile: p.phone || p.mobile || '',
              role: p.role || 'PLAYER',
              jersey_number: p.jersey_number ?? (idx + 1),
              is_captain: Boolean(p.is_captain) || String(p.role || '').toLowerCase().includes('captain')
            });
          }
        });
      }

      const players = Array.from(playerMap.values());
      const captainPlayer = players.find(p => p.is_captain) || players.find(p => String(p.role || '').toLowerCase().includes('captain'));

      return {
        tDoc,
        rDoc,
        players,
        squad_count: players.length,
        captain: tDoc?.captain || rDoc?.captain || captainPlayer?.name || null,
        coach_name: tDoc?.coach_name || rDoc?.coach_name || null,
        coach_email: tDoc?.coach_email || rDoc?.coach_email || null,
        coach_phone: tDoc?.coach_phone || rDoc?.coach_phone || rDoc?.coach_mobile || null,
        city: tDoc?.city || tDoc?.taluk || rDoc?.taluk || rDoc?.city || null,
        resolved_name: tDoc?.name || rDoc?.team_name || null
      };
    };

    return { resolveFor };
  }

  /**
   * Get tournament registrations for Admin with filtering
   */
  async getTournamentRegistrations({ tournamentId, status, search } = {}) {
    await db.initDb();
    const registrations = await tournamentRegistrationModel.getAll({ tournamentId, status, search });

    // Attach tournament metadata + real team roster metadata
    const tourIds = [...new Set(registrations.map(r => r.tournament_id))];
    const [tournaments, rosterCtx] = await Promise.all([
      db.models.Tournament.find({ id: { $in: tourIds } }).lean(),
      this._loadTeamRosterContext()
    ]);
    const tourMap = {};
    tournaments.forEach(t => { tourMap[t.id] = t; });

    return registrations.map(reg => {
      const tour = tourMap[reg.tournament_id] || {};
      const resolved = rosterCtx.resolveFor({
        teamId: reg.team_id,
        teamName: reg.team_name,
        coachEmail: reg.coach_email
      });
      return {
        ...reg,
        team_name: reg.team_name || resolved.resolved_name || reg.team_id,
        coach_name: reg.coach_name || resolved.coach_name || 'Coach',
        coach_email: reg.coach_email || resolved.coach_email || '',
        coach_phone: reg.coach_phone || resolved.coach_phone || '',
        captain: reg.captain || resolved.captain || '',
        squad_count: resolved.squad_count > 0 ? resolved.squad_count : (reg.squad_count || 0),
        players: resolved.players,
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
    } catch (_e) { }

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
    } catch (_e) { }

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

    const [approvedRegistrations, rosterCtx] = await Promise.all([
      db.models.TournamentRegistration.find({
        tournament_id: tournament.id,
        status: 'APPROVED'
      }).lean(),
      this._loadTeamRosterContext()
    ]);

    // 2. Fetch from tournament.teams array
    const teamIds = [
      ...new Set([
        ...(tournament.teams || []),
        ...approvedRegistrations.map(r => r.team_id)
      ])
    ];

    if (teamIds.length === 0) return [];

    const regMap = {};
    approvedRegistrations.forEach(r => {
      regMap[r.team_id] = r;
    });

    return teamIds.map(tid => {
      const r = regMap[tid] || {};
      const resolved = rosterCtx.resolveFor({
        teamId: tid,
        teamName: r.team_name,
        coachEmail: r.coach_email
      });
      return {
        id: tid,
        team_id: resolved.tDoc?.team_id || resolved.tDoc?.id || tid,
        name: r.team_name || resolved.resolved_name || tid,
        team_name: r.team_name || resolved.resolved_name || tid,
        coach_name: r.coach_name || resolved.coach_name || '—',
        coach_email: r.coach_email || resolved.coach_email || '',
        coach_phone: r.coach_phone || resolved.coach_phone || '',
        city: r.team_city || r.team_taluk || resolved.city || 'Virudhunagar',
        captain: r.captain || resolved.captain || '—',
        squad_count: resolved.squad_count > 0 ? resolved.squad_count : (r.squad_count || 0),
        players: resolved.players,
        registration_id: r.id || null,
        approved_at: r.approved_at || null,
        approved_by: r.approved_by || null,
        status: 'APPROVED'
      };
    });
  }
}

module.exports = new TournamentService();
