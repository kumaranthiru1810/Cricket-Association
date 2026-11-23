/**
 * services/scoring/wicketService.js
 * Handles special dismissals (retired hurt, timed out, mankading) and batter changes.
 */

const db = require('../../config/db');
const { broadcastScoreUpdate } = require('./deliveryHelpers');

class WicketService {
  /**
   * Slide Menu: Other Wickets (Absent Hurt, Timed Out, Mankading, Retired Out, Retired Hurt)
   */
  async recordOtherWicket(matchId, payload = {}) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: 'Match not found.' };

    let currentInnings = await db.models.Innings.findOne({ match_id: matchId, is_completed: false }).sort({ innings_number: -1 });
    if (!currentInnings) {
      currentInnings = await db.models.Innings.findOne({ match_id: matchId }).sort({ innings_number: -1 });
    }
    if (!currentInnings) throw { status: 400, message: 'No innings found for wicket.' };

    const { playerId, wicketType, comments, replacementBatterId } = payload;
    if (!playerId || !wicketType) {
      throw { status: 400, message: 'playerId and wicketType are required.' };
    }

    const isRetiredHurt = wicketType === 'RETIRED_HURT';

    let batter = await db.models.InningsBatter.findOne({ innings_id: currentInnings.id, player_id: playerId });
    if (!batter) {
      batter = await db.models.InningsBatter.create({
        id: `IB-${currentInnings.id}-${playerId}`,
        innings_id: currentInnings.id,
        player_id: playerId,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        strike_rate: 0.0,
        is_out: !isRetiredHurt,
        dismissal_type: wicketType,
        dismissal_text: isRetiredHurt ? 'retired hurt' : wicketType.replace(/_/g, ' ').toLowerCase()
      });
    } else {
      batter.is_out = !isRetiredHurt;
      batter.dismissal_type = wicketType;
      batter.dismissal_text = isRetiredHurt ? 'retired hurt' : wicketType.replace(/_/g, ' ').toLowerCase();
      await batter.save();
    }

    if (!isRetiredHurt) {
      currentInnings.wickets += 1;
    }

    if (replacementBatterId) {
      if (currentInnings.current_striker_id === playerId) {
        currentInnings.current_striker_id = replacementBatterId;
      } else if (currentInnings.current_non_striker_id === playerId) {
        currentInnings.current_non_striker_id = replacementBatterId;
      }
    }
    await currentInnings.save();

    try {
      broadcastScoreUpdate(matchId, {
        action: 'OTHER_WICKET',
        wicketType,
        playerId,
        score: `${currentInnings.total_runs}/${currentInnings.wickets}`
      });
    } catch (_) {}

    return {
      success: true,
      message: `${wicketType} recorded for player successfully.`,
      playerId,
      wicketType
    };
  }

  /**
   * Change or substitute active batter
   */
  async changeBatter(matchId, { target = 'striker', newBatterId, newBatterName }) {
    await db.initDb();
    let innings = await db.models.Innings.findOne({ match_id: matchId, is_completed: { $ne: true }, status: { $ne: "COMPLETED" } }).sort({ innings_number: -1 });
    if (!innings) {
      innings = await db.models.Innings.findOne({ match_id: matchId }).sort({ innings_number: -1 });
    }
    if (!innings) throw { status: 404, message: 'Active innings not found.' };

    let resolvedId = newBatterId;
    if (newBatterName && newBatterName.trim()) {
      const cleanName = newBatterName.trim();
      if (!resolvedId) {
        resolvedId = `PLY-MANUAL-${Date.now()}`;
      }
      const existingPlayer = await db.models.Player.findOne({
        $or: [{ id: resolvedId }, { name: cleanName }]
      });
      if (!existingPlayer) {
        await db.models.Player.create({
          id: resolvedId,
          name: cleanName,
          role: 'BATTER',
          team_id: innings.batting_team_id
        });
      }
    }

    if (!resolvedId) throw { status: 400, message: 'Batter ID or name required.' };

    let repBatter = await db.models.InningsBatter.findOne({ innings_id: innings.id, player_id: resolvedId });
    if (!repBatter) {
      repBatter = new db.models.InningsBatter({
        id: `BAT-${innings.id}-${resolvedId}`,
        innings_id: innings.id,
        player_id: resolvedId,
        batting_position: (await db.models.InningsBatter.countDocuments({ innings_id: innings.id })) + 1,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        strike_rate: 0.0,
        is_out: false,
        dismissal_text: 'not out'
      });
      await repBatter.save();
    } else {
      repBatter.is_out = false;
      repBatter.dismissal_text = 'not out';
      await repBatter.save();
    }

    if (target === 'nonStriker') {
      innings.current_non_striker_id = resolvedId;
    } else {
      innings.current_striker_id = resolvedId;
    }
    await innings.save();

    return {
      success: true,
      message: `${target === 'striker' ? 'Striker' : 'Non-striker'} updated to ${newBatterName || resolvedId}`,
      strikerId: innings.current_striker_id,
      nonStrikerId: innings.current_non_striker_id
    };
  }
}

module.exports = new WicketService();
