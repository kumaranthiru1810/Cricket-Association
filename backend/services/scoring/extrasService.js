/**
 * services/scoring/extrasService.js
 * Handles penalty runs and extras calculations.
 */

const db = require('../../config/db');
const { broadcastScoreUpdate } = require('./deliveryHelpers');

class ExtrasService {
  /**
   * Slide Menu: Penalty Runs (Batting or Bowling 5 points)
   */
  async addPenalty(matchId, penaltyData = {}) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: 'Match not found.' };

    let currentInnings = await db.models.Innings.findOne({ match_id: matchId, is_completed: false }).sort({ innings_number: -1 });
    if (!currentInnings) {
      currentInnings = await db.models.Innings.findOne({ match_id: matchId }).sort({ innings_number: -1 });
    }
    if (!currentInnings) throw { status: 400, message: 'No innings found for penalty.' };

    const points = penaltyData.points ? parseInt(penaltyData.points, 10) : 5;
    const penaltyType = penaltyData.type || 'Batting Penalty';
    const reason = (penaltyData.reason || 'Penalty Points awarded').trim();
    const targetTeamName = penaltyData.targetTeamName || penaltyData.teamName || (penaltyType === 'Batting Penalty' ? (match.team_a_name || 'Batting Team') : (match.team_b_name || 'Bowling Team'));
    const targetTeamId = penaltyData.targetTeamId || null;

    currentInnings.total_runs += points;
    if (!currentInnings.extras) {
      currentInnings.extras = { wides: 0, no_balls: 0, byes: 0, leg_byes: 0, total: 0 };
    }
    currentInnings.extras.total = (currentInnings.extras.total || 0) + points;
    await currentInnings.save();

    const deliveryId = `DEL-${matchId}-${Date.now()}`;
    await db.models.Delivery.create({
      id: deliveryId,
      match_id: matchId,
      innings_id: currentInnings.id,
      over_number: currentInnings.overs,
      ball_number: currentInnings.balls,
      striker_id: currentInnings.current_striker_id || 'P1',
      non_striker_id: currentInnings.current_non_striker_id || 'P2',
      bowler_id: currentInnings.current_bowler_id || 'B1',
      runs_batter: 0,
      runs_extras: points,
      total_runs: points,
      extra_type: 'BYE',
      is_legal_delivery: false,
      reason: `[${penaltyType}] ${targetTeamName ? `(${targetTeamName}) ` : ''}${reason}`,
      commentary: `Penalty of ${points} runs awarded against ${targetTeamName}: ${reason}`
    });

    try {
      if (db.models.Notification) {
        const notifId = `NOTIF-PENALTY-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
        await db.models.Notification.create({
          id: notifId,
          type: 'PENALTY',
          title: `⚠️ Official Match Notice: ${points} Runs Penalty (${targetTeamName})`,
          message: `Official Scorer & Match Notice: A penalty of ${points} runs was awarded against ${targetTeamName} (${penaltyType}). Reason: "${reason}". Match: ${match.team_a_name || 'Team A'} vs ${match.team_b_name || 'Team B'}.`,
          reference_id: targetTeamId || matchId,
          status: 'UNREAD',
          created_at: new Date()
        });
      }
    } catch (notifErr) {
      console.warn('Penalty notification create note:', notifErr.message);
    }

    try {
      broadcastScoreUpdate(matchId, {
        action: 'PENALTY_AWARDED',
        points,
        reason,
        targetTeamName,
        score: `${currentInnings.total_runs}/${currentInnings.wickets}`
      });
    } catch (_) {}

    return {
      success: true,
      message: `${points} Penalty runs successfully recorded.`,
      points,
      reason
    };
  }
}

module.exports = new ExtrasService();

