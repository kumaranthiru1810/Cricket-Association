/**
 * services/scoring/superOverService.js
 * Handles Super Over initiation and state transition.
 */

const db = require('../../config/db');
const { broadcastScoreUpdate } = require('./deliveryHelpers');

class SuperOverService {
  async startSuperOver(matchId, payload = {}) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: 'Match not found.' };

    const { battingTeamId, bowlingTeamId, strikerId, nonStrikerId, bowlerId } = payload;
    const bTeamId = battingTeamId || match.team_a_id;
    const fTeamId = bowlingTeamId || (bTeamId === match.team_a_id ? match.team_b_id : match.team_a_id);

    // End any existing uncompleted innings
    await db.models.Innings.updateMany({ match_id: matchId, is_completed: false }, { is_completed: true });

    // Create Super Over Innings
    const soInningsId = `INN-${matchId}-SO-1`;
    let soInnings = await db.models.Innings.findOne({ id: soInningsId });
    if (!soInnings) {
      soInnings = await db.models.Innings.create({
        id: soInningsId,
        match_id: matchId,
        innings_number: 3,
        batting_team_id: bTeamId,
        bowling_team_id: fTeamId,
        total_runs: 0,
        wickets: 0,
        overs: 0,
        balls: 0,
        revised_overs: 1,
        is_super_over: true,
        is_completed: false,
        is_over_complete: false,
        current_striker_id: strikerId || null,
        current_non_striker_id: nonStrikerId || null,
        current_bowler_id: bowlerId || null,
        extras: { wides: 0, no_balls: 0, byes: 0, leg_byes: 0, total: 0 }
      });
    } else {
      soInnings.batting_team_id = bTeamId;
      soInnings.bowling_team_id = fTeamId;
      soInnings.total_runs = 0;
      soInnings.wickets = 0;
      soInnings.overs = 0;
      soInnings.balls = 0;
      soInnings.revised_overs = 1;
      soInnings.is_super_over = true;
      soInnings.is_completed = false;
      soInnings.is_over_complete = false;
      soInnings.current_striker_id = strikerId || null;
      soInnings.current_non_striker_id = nonStrikerId || null;
      soInnings.current_bowler_id = bowlerId || null;
      await soInnings.save();
    }

    match.status = 'LIVE';
    match.is_super_over = true;
    match.current_innings_number = 3;
    match.overs_per_side = 1;
    match.revised_overs = 1;
    match.result_summary = 'Super Over in progress';
    await match.save();

    try {
      broadcastScoreUpdate(matchId, {
        action: 'SUPER_OVER_STARTED',
        inningsId: soInningsId,
        battingTeamId: bTeamId
      });
    } catch (_) {}

    return {
      success: true,
      message: 'Super Over successfully started.',
      inningsId: soInningsId,
      matchStatus: 'LIVE',
      isSuperOver: true
    };
  }
}

module.exports = new SuperOverService();

