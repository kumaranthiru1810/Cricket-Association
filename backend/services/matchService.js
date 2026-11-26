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

  async startMatch(matchId, { tossWinner, tossDecision, teamAPlayingXI, teamBPlayingXI, overs, totalOvers }, user = null) {
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

    // Optional custom overs at start of match (e.g. 20 reduced to 15)
    const customOvers = parseInt(overs || totalOvers, 10);
    if (!isNaN(customOvers) && customOvers > 0) {
      match.overs = customOvers;
      match.revised_overs = customOvers;
    }

    // Update match state
    match.status = 'LIVE';
    match.toss_winner_id = winnerTeamId;
    match.toss_decision = decision;
    match.current_innings_number = 1;
    match.result_summary = '';
    match.target_runs = undefined;

    // Association Rule 15: At least 9 players must be present at the start of the match to begin innings
    if (teamAPlayingXI && Array.isArray(teamAPlayingXI) && teamAPlayingXI.length > 0 && teamAPlayingXI.length < 9) {
      throw { status: 400, message: `Rule 15 Violation: ${match.team_a_name || 'Team A'} has only ${teamAPlayingXI.length} players present. At least 9 players must be present to begin the match.` };
    }
    if (teamBPlayingXI && Array.isArray(teamBPlayingXI) && teamBPlayingXI.length > 0 && teamBPlayingXI.length < 9) {
      throw { status: 400, message: `Rule 15 Violation: ${match.team_b_name || 'Team B'} has only ${teamBPlayingXI.length} players present. At least 9 players must be present to begin the match.` };
    }

    // Record verified match attendance and official Playing XI
    if (teamAPlayingXI && Array.isArray(teamAPlayingXI) && teamAPlayingXI.length >= 9) {
      match.team_a_playing_xi = teamAPlayingXI;
      match.team_a_attendance = teamAPlayingXI;
    }
    if (teamBPlayingXI && Array.isArray(teamBPlayingXI) && teamBPlayingXI.length >= 9) {
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
