/**
 * services/matchService.js
 * Match Setup, Squads, Toss & Lifecycle
 * Pure MongoDB Implementation using Mongoose Models
 */

const db = require('../config/db');

class MatchService {
  async getMatchSetup(matchId) {
    await db.initDb();
    const scorerService = require('./scorerService');

    const match = await db.models.Match.findOne({ id: matchId }).lean();
    if (!match) throw { status: 404, message: `Match '${matchId}' not found in MongoDB database.` };

    const teamMap = await scorerService.getTeamMap();
    const teamA = teamMap[match.team_a_id] || { id: match.team_a_id, name: match.team_a_id };
    const teamB = teamMap[match.team_b_id] || { id: match.team_b_id, name: match.team_b_id };

    const [teamAPlayers, teamBPlayers] = await Promise.all([
      scorerService.getSquadForTeam(match.team_a_id),
      scorerService.getSquadForTeam(match.team_b_id)
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
      tossWinner: match.toss_winner_id,
      tossDecision: match.toss_decision,
      status: match.status
    };
  }

  async startMatch(matchId, { tossWinner, tossDecision, teamAPlayingXI, teamBPlayingXI }) {
    await db.initDb();

    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: `Match '${matchId}' not found.` };

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
    await match.save();

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
        extras: { wides: 0, no_balls: 0, byes: 0, leg_byes: 0, total: 0 }
      });
    } else {
      inn1.batting_team_id = battingTeamId;
      inn1.bowling_team_id = bowlingTeamId;
      inn1.is_completed = false;
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
