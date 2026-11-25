/**
 * services/matchService.js
 * Match Setup, Squads, Toss & Lifecycle
 * Pure MongoDB Implementation using Mongoose Models
 */

const db = require('../config/db');

class MatchService {
  async getRule15Config() {
    await db.initDb();
    const record = await db.models.MasterSetting.findOne({ id: 'ADMIN_RULE_15' }).lean();
    let config = { enabled: true, minPlayers: 9, ruleText: '' };
    if (record?.description) {
      try {
        const parsed = JSON.parse(record.description);
        const parsedMin = parseInt(parsed.minPlayers, 10);
        config = {
          enabled: record.is_active !== false,
          minPlayers: (!isNaN(parsedMin) && parsedMin >= 1 && parsedMin <= 11) ? parsedMin : 9,
          ruleText: typeof parsed.ruleText === 'string' ? parsed.ruleText : ''
        };
      } catch (_e) {}
    }
    return config;
  }

  async getMatchSetup(matchId, user = null) {
    await db.initDb();
    const scorerService = require('./scorerService');

    const match = await db.models.Match.findOne({ id: matchId }).lean();
    if (!match) throw { status: 404, message: `Match '${matchId}' not found in MongoDB database.` };

    if (match.status === 'SCHEDULED' && match.schedule_confirmation_status !== 'CONFIRMED' && user?.role !== 'ADMIN') {
      throw { status: 403, message: 'Match schedule is pending confirmation by Admin after team allocations.' };
    }

    const teamMap = await scorerService.getTeamMap();
    const teamA = teamMap[match.team_a_id] || { id: match.team_a_id, name: match.team_a_id };
    const teamB = teamMap[match.team_b_id] || { id: match.team_b_id, name: match.team_b_id };

    const [teamAPlayers, teamBPlayers, rule15, tournamentDoc] = await Promise.all([
      scorerService.getSquadForTeam(match.team_a_id, match),
      scorerService.getSquadForTeam(match.team_b_id, match),
      this.getRule15Config(),
      db.models.Tournament.findOne({
        $or: [
          ...(match.tournament_id ? [{ id: match.tournament_id }] : []),
          ...(match.tournament_name ? [{ name: match.tournament_name }] : [])
        ]
      }).lean()
    ]);

    const FORMAT_LABELS = {
      SINGLE_ROUND_ROBIN: 'Single Round Robin',
      DOUBLE_ROUND_ROBIN: 'Double Round Robin',
      SINGLE_ELIMINATION: 'Single Elimination',
      DOUBLE_ELIMINATION: 'Double Elimination',
      GROUP_KNOCKOUT: 'Group + Knockout',
      LEAGUE_PLAYOFFS: 'League + Playoffs',
      LEAGUE: tournamentDoc?.format_config?.round_robin_type === 'DOUBLE' ? 'Double Round Robin' : 'Single Round Robin',
      KNOCKOUT: 'Single Elimination',
      LEAGUE_KNOCKOUT: 'League + Playoffs',
      GROUP_SUPER_LEAGUE: 'Group + Knockout'
    };
    const rawFormat = tournamentDoc?.tournament_type || 'SINGLE_ROUND_ROBIN';

    const tournamentRules = {
      ...(tournamentDoc?.playing_rules || {}),
      tournament_type: rawFormat,
      tournament_format_label: FORMAT_LABELS[rawFormat] || 'Single Round Robin',
      match_stage: match.stage || 'LEAGUE_STAGE',
      powerplay_overs: tournamentDoc?.playing_rules?.powerplay_overs ?? 5,
      max_outside_powerplay: tournamentDoc?.playing_rules?.max_outside_powerplay ?? 2,
      max_outside_post_powerplay: tournamentDoc?.playing_rules?.max_outside_post_powerplay ?? 5,
      max_on_side_fielders: tournamentDoc?.playing_rules?.max_on_side_fielders ?? 5,
      max_on_side_behind_crease: tournamentDoc?.playing_rules?.max_on_side_behind_crease ?? 2,
      free_hit_on_all_noballs: tournamentDoc?.playing_rules?.free_hit_on_all_noballs !== false,
      delay_penalty_enabled: tournamentDoc?.playing_rules?.delay_penalty_enabled !== false,
      delay_interval_value: tournamentDoc?.playing_rules?.delay_interval_value ?? 4,
      delay_interval_unit: tournamentDoc?.playing_rules?.delay_interval_unit || 'MINUTES',
      delay_reduce_unit: tournamentDoc?.playing_rules?.delay_reduce_unit || 'OVERS',
      delay_overs_reduced_per_interval: tournamentDoc?.playing_rules?.delay_overs_reduced_per_interval ?? 1,
      tie_handling: tournamentDoc?.playing_rules?.tie_handling || 'SHARE_POINTS',
      points_win: tournamentDoc?.points_win ?? 4,
      points_loss: tournamentDoc?.points_loss ?? 0,
      points_tie: tournamentDoc?.points_tie ?? 2,
      points_bonus_win: tournamentDoc?.points_bonus_win ?? 1,
      points_bonus_loss: tournamentDoc?.points_bonus_loss ?? -1,
      points_walkover_win: tournamentDoc?.points_walkover_win ?? 4,
      points_walkover_loss: tournamentDoc?.points_walkover_loss ?? -1
    };

    return {
      matchId: match.id,
      tournament: match.tournament_name || 'VPL 2026',
      venue: match.venue || 'Kamarajar Stadium, Virudhunagar',
      overs: match.overs_per_side || tournamentDoc?.overs_per_match || 20,
      rule15,
      tournamentRules,
      teamA,
      teamB,
      teamAPlayers,
      teamBPlayers,
      teamAPlayingXI: match.team_a_playing_xi || [],
      teamBPlayingXI: match.team_b_playing_xi || [],
      teamASubstitutes: match.team_a_substitutes || [],
      teamBSubstitutes: match.team_b_substitutes || [],
      teamAAllocationStatus: match.team_a_allocation_status || 'PENDING',
      teamBAllocationStatus: match.team_b_allocation_status || 'PENDING',
      tossWinner: match.toss_winner_id,
      tossDecision: match.toss_decision,
      status: match.status,
      umpire1_id: match.umpire1_id || null,
      umpire2_id: match.umpire2_id || null,
      umpire1_name: match.umpire1_name || null,
      umpire2_name: match.umpire2_name || null,
      umpire1Name: match.umpire1_name || null,
      umpire2Name: match.umpire2_name || null,
      assigned_scorer_name: match.assigned_scorer_name || match.scorer_name || null,
      umpire_assessment: match.umpire_assessment || null
    };
  }

  async startMatch(matchId, { tossWinner, tossDecision, teamAPlayingXI, teamBPlayingXI, overs, totalOvers, delayPenaltyOvers, delayPenaltySkipped }, user = null) {
    await db.initDb();

    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: `Match '${matchId}' not found.` };

    if (match.schedule_confirmation_status !== 'CONFIRMED' && user?.role !== 'ADMIN') {
      throw { status: 403, message: 'Cannot start match: Schedule confirmation is pending Admin approval.' };
    }

    const winnerTeamId = tossWinner || match.team_a_id;
    const decision = tossDecision || 'BAT';

    // Batting & Bowling team logic
    const battingTeamId = decision === 'BAT' ? winnerTeamId : (winnerTeamId === match.team_a_id ? match.team_b_id : match.team_a_id);
    const bowlingTeamId = battingTeamId === match.team_a_id ? match.team_b_id : match.team_a_id;

    // Optional custom overs at start of match (e.g. 20 reduced to 15, or delay penalty reduced)
    const customOvers = parseInt(overs || totalOvers, 10);
    if (!isNaN(customOvers) && customOvers > 0) {
      match.overs_per_side = customOvers;
      match.revised_overs = customOvers;
    }
    match.delay_penalty_overs = Number(delayPenaltyOvers || 0);
    match.delay_penalty_skipped = Boolean(delayPenaltySkipped);

    // Update match state
    match.status = 'LIVE';
    match.toss_winner_id = winnerTeamId;
    match.toss_decision = decision;
    match.current_innings_number = 1;
    match.result_summary = '';
    match.target_runs = undefined;

    // Association Rule 15: Dynamic minimum players per team configured by Admin
    const rule15 = await this.getRule15Config();
    const minRequired = rule15.enabled ? rule15.minPlayers : 1;

    if (teamAPlayingXI && Array.isArray(teamAPlayingXI) && teamAPlayingXI.length > 0 && teamAPlayingXI.length < minRequired) {
      throw { status: 400, message: `Rule 15 Violation: ${match.team_a_name || 'Team A'} has only ${teamAPlayingXI.length} players present. At least ${minRequired} players must be present to begin the match.` };
    }
    if (teamBPlayingXI && Array.isArray(teamBPlayingXI) && teamBPlayingXI.length > 0 && teamBPlayingXI.length < minRequired) {
      throw { status: 400, message: `Rule 15 Violation: ${match.team_b_name || 'Team B'} has only ${teamBPlayingXI.length} players present. At least ${minRequired} players must be present to begin the match.` };
    }

    // Record verified match attendance and official Playing XI
    if (teamAPlayingXI && Array.isArray(teamAPlayingXI) && teamAPlayingXI.length >= minRequired) {
      match.team_a_playing_xi = teamAPlayingXI;
      match.team_a_attendance = teamAPlayingXI;
    }
    if (teamBPlayingXI && Array.isArray(teamBPlayingXI) && teamBPlayingXI.length >= minRequired) {
      match.team_b_playing_xi = teamBPlayingXI;
      match.team_b_attendance = teamBPlayingXI;
    }
    await match.save();

    // Clean up any stale subsequent innings & deliveries from previous runs
    await db.models.Innings.deleteMany({ match_id: matchId, innings_number: { $gt: 1 } });
    await db.models.Delivery.deleteMany({ match_id: matchId });

    // Create or reset Innings 1
    const innId = `INN-${matchId}-1`;
    let inn1 = await db.models.Innings.findOne({ id: innId });
    if (!inn1) {
      inn1 = await db.models.Innings.create({
        id: innId,
        match_id: matchId,
        innings_number: 1,
        batting_team_id: battingTeamId,
        bowling_team_id: bowlingTeamId,
        total_runs: 0,
        wickets: 0,
        overs: 0,
        balls: 0,
        is_completed: false,
        is_over_complete: false,
        extras: { wides: 0, no_balls: 0, byes: 0, leg_byes: 0, total: 0 }
      });
    } else {
      inn1.batting_team_id = battingTeamId;
      inn1.bowling_team_id = bowlingTeamId;
      inn1.total_runs = 0;
      inn1.wickets = 0;
      inn1.overs = 0;
      inn1.balls = 0;
      inn1.is_completed = false;
      inn1.is_over_complete = false;
      inn1.extras = { wides: 0, no_balls: 0, byes: 0, leg_byes: 0, total: 0 };
      await inn1.save();
    }

    return {
      success: true,
      message: 'Match successfully started. Live scoring initiated.',
      matchId,
      inningsId: innId,
      battingTeamId,
      bowlingTeamId
    };
  }
}

module.exports = new MatchService();
