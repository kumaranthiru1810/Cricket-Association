/**
 * services/matchService.js
 * Match Setup, Squads, Toss & Lifecycle
 * Pure MongoDB Implementation using Mongoose Models
 */

const db = require('../config/db');

class MatchService {
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

    const [teamAPlayers, teamBPlayers] = await Promise.all([
      scorerService.getSquadForTeam(match.team_a_id, match),
      scorerService.getSquadForTeam(match.team_b_id, match)
    ]);

    return {
      matchId: match.id,
      tournament: match.tournament_name || 'VPL 2026',
      venue: match.venue || 'Kamarajar Stadium, Virudhunagar',
      overs: match.overs_per_side || 20,
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
      status: match.status
    };
  }

  async startMatch(matchId, { tossWinner, tossDecision, teamAPlayingXI, teamBPlayingXI }, user = null) {
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

    // Update match state
    match.status = 'LIVE';
    match.toss_winner_id = winnerTeamId;
    match.toss_decision = decision;
    match.current_innings_number = 1;
    match.result_summary = '';
    match.target_runs = undefined;

    // If team has not allocated, use provided playing XI; if already allocated by coach, preserve coach's official 11!
    if (teamAPlayingXI && Array.isArray(teamAPlayingXI) && teamAPlayingXI.length > 0) {
      if (!match.team_a_playing_xi || match.team_a_playing_xi.length === 0) {
        match.team_a_playing_xi = teamAPlayingXI;
      }
    }
    if (teamBPlayingXI && Array.isArray(teamBPlayingXI) && teamBPlayingXI.length > 0) {
      if (!match.team_b_playing_xi || match.team_b_playing_xi.length === 0) {
        match.team_b_playing_xi = teamBPlayingXI;
      }
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
