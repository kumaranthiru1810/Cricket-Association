/**
 * services/scoring/undoEditService.js
 * Handles transaction-safe undo and delivery editing with scorecard recalculation.
 */

const db = require('../../config/db');
const socketService = require('../socketService');
const { broadcastScoreUpdate } = require('./deliveryHelpers');

class UndoEditService {
  /**
   * Undo Last Delivery in MongoDB
   */
  async undoLastDelivery(matchId) {
    await db.initDb();

    // 1. Find the latest delivery
    const lastDelivery = await db.models.Delivery.findOne({ match_id: matchId }).sort({ created_at: -1 });
    if (!lastDelivery) {
      throw { status: 400, message: 'No deliveries recorded yet to undo.' };
    }

    const innings = await db.models.Innings.findOne({ id: lastDelivery.innings_id });
    if (innings) {
      innings.total_runs = Math.max(0, innings.total_runs - lastDelivery.total_runs);
      if (lastDelivery.wicket) {
        innings.wickets = Math.max(0, innings.wickets - 1);
      }

      if (lastDelivery.is_legal_delivery) {
        if (innings.balls === 0) {
          innings.overs = Math.max(0, innings.overs - 1);
          innings.balls = 5;
        } else {
          innings.balls = Math.max(0, innings.balls - 1);
        }
      }

      innings.is_over_complete = false;

      if (lastDelivery.extra_type === 'WIDE' && innings.extras) {
        innings.extras.wides = Math.max(0, (innings.extras.wides || 0) - lastDelivery.runs_extras);
        innings.extras.total = Math.max(0, (innings.extras.total || 0) - lastDelivery.runs_extras);
      }
      if (lastDelivery.extra_type === 'NO_BALL' && innings.extras) {
        innings.extras.no_balls = Math.max(0, (innings.extras.no_balls || 0) - lastDelivery.runs_extras);
        innings.extras.total = Math.max(0, (innings.extras.total || 0) - lastDelivery.runs_extras);
      }
      if (lastDelivery.extra_type === 'BYE' && innings.extras) {
        innings.extras.byes = Math.max(0, (innings.extras.byes || 0) - lastDelivery.runs_extras);
        innings.extras.total = Math.max(0, (innings.extras.total || 0) - lastDelivery.runs_extras);
      }
      if (lastDelivery.extra_type === 'LEG_BYE' && innings.extras) {
        innings.extras.leg_byes = Math.max(0, (innings.extras.leg_byes || 0) - lastDelivery.runs_extras);
        innings.extras.total = Math.max(0, (innings.extras.total || 0) - lastDelivery.runs_extras);
      }
      if (lastDelivery.extra_type === 'PENALTY' && innings.extras) {
        innings.extras.penalty = Math.max(0, ((innings.extras.penalty || 0) - lastDelivery.runs_extras));
        innings.extras.total = Math.max(0, (innings.extras.total || 0) - lastDelivery.runs_extras);
      }

      // Restore active striker and non-striker
      innings.current_striker_id = lastDelivery.striker_id;
      innings.current_non_striker_id = lastDelivery.non_striker_id;
      innings.current_bowler_id = lastDelivery.bowler_id;

      await innings.save();
    }

    // Revert Batter
    const batter = await db.models.InningsBatter.findOne({ innings_id: lastDelivery.innings_id, player_id: lastDelivery.striker_id });
    if (batter) {
      if (lastDelivery.extra_type === 'NONE' || lastDelivery.extra_type === 'NO_BALL') {
        batter.runs = Math.max(0, batter.runs - lastDelivery.runs_batter);
        if (lastDelivery.runs_batter === 4) batter.fours = Math.max(0, batter.fours - 1);
        if (lastDelivery.runs_batter === 6) batter.sixes = Math.max(0, batter.sixes - 1);
      }
      if (lastDelivery.is_legal_delivery || lastDelivery.extra_type === 'NO_BALL') {
        batter.balls = Math.max(0, batter.balls - 1);
      }
      if (lastDelivery.wicket && lastDelivery.dismissed_player_id === batter.player_id) {
        batter.is_out = false;
        batter.dismissal_type = null;
      }
      batter.strike_rate = batter.balls > 0 ? parseFloat(((batter.runs / batter.balls) * 100).toFixed(2)) : 0.00;
      await batter.save();
    }

    // Revert Bowler
    const bowler = await db.models.InningsBowler.findOne({ innings_id: lastDelivery.innings_id, player_id: lastDelivery.bowler_id });
    if (bowler) {
      if (lastDelivery.is_legal_delivery) {
        if (bowler.balls === 0) {
          bowler.overs = Math.max(0, bowler.overs - 1);
          bowler.balls = 5;
        } else {
          bowler.balls = Math.max(0, bowler.balls - 1);
        }
      }
      if (lastDelivery.extra_type !== 'BYE' && lastDelivery.extra_type !== 'LEG_BYE') {
        bowler.runs_conceded = Math.max(0, bowler.runs_conceded - lastDelivery.total_runs);
      }
      if (lastDelivery.wicket && lastDelivery.wicket_type !== 'RUN_OUT') {
        bowler.wickets = Math.max(0, bowler.wickets - 1);
      }
      const totalBowlerBalls = (bowler.overs * 6) + bowler.balls;
      bowler.economy = totalBowlerBalls > 0 ? parseFloat(((bowler.runs_conceded / totalBowlerBalls) * 6).toFixed(2)) : 0.00;
      await bowler.save();
    }

    // If match was completed by this delivery, safely check & revert tournament stats before deleting delivery
    const match = await db.models.Match.findOne({ id: matchId });
    if (match && match.status === 'COMPLETED' && match.stats_processed) {
      const tournamentService = require('../tournamentService');
      await tournamentService.revertMatchCompletion(matchId, 'UNDO_LAST_DELIVERY');
    }

    // Remove the delivery from DB
    await db.models.Delivery.deleteOne({ id: lastDelivery.id });

    // Revert match & innings status to LIVE
    if (match && match.status === 'COMPLETED') {
      match.status = 'LIVE';
      match.winner_id = null;
      match.result_summary = 'In Progress';
      match.stats_processed = false;
      match.stats_processing_status = 'IDLE';
      match.stats_processed_at = null;
      await match.save();
    }
    if (innings && innings.is_completed) {
      innings.is_completed = false;
      await innings.save();
    }

    try {
      broadcastScoreUpdate(matchId, {
        action: 'DELIVERY_UNDONE',
        undoneDeliveryId: lastDelivery.id,
        currentScore: `${innings ? innings.total_runs : 0}/${innings ? innings.wickets : 0}`,
        currentOvers: `${innings ? innings.overs : 0}.${innings ? innings.balls : 0}`,
        strikerId: innings ? innings.current_striker_id : null,
        nonStrikerId: innings ? innings.current_non_striker_id : null,
        bowlerId: innings ? innings.current_bowler_id : null
      });
    } catch (_) {}

    return {
      success: true,
      message: 'Last delivery successfully undone.',
      undoneDeliveryId: lastDelivery.id,
      currentScore: `${innings ? innings.total_runs : 0}/${innings ? innings.wickets : 0}`,
      currentOvers: `${innings ? innings.overs : 0}.${innings ? innings.balls : 0}`
    };
  }

  /**
   * Edit Delivery in MongoDB
   */
  async editDelivery(matchId, deliveryId, updateData, scorerId) {
    await db.initDb();
    const mongoose = require('mongoose');
    const isObjectId = mongoose.Types.ObjectId.isValid(deliveryId);
    let query = isObjectId ? { $or: [{ id: deliveryId }, { _id: deliveryId }] } : { id: deliveryId };
    let delivery = await db.models.Delivery.findOne(query);
    if (!delivery && matchId) {
      delivery = await db.models.Delivery.findOne({
        match_id: matchId,
        $or: [{ id: deliveryId }, { id: String(deliveryId) }]
      });
    }
    if (!delivery) throw { status: 404, message: `Delivery '${deliveryId}' not found.` };

    const oldBatterRuns = Number(delivery.runs_batter) || 0;
    const oldExtrasRuns = Number(delivery.runs_extras) || 0;

    const newRunsBatter = typeof updateData.runsBatter === 'number' ? Number(updateData.runsBatter) : (typeof updateData.runs === 'number' ? Number(updateData.runs) : oldBatterRuns);
    const newRunsExtras = typeof updateData.runsExtras === 'number' ? Number(updateData.runsExtras) : oldExtrasRuns;
    const newTotalRuns = newRunsBatter + newRunsExtras;
    const newWicket = typeof updateData.wicket === 'boolean' ? updateData.wicket : Boolean(delivery.wicket);
    const newWicketType = updateData.wicketType || delivery.wicket_type;
    const newExtraType = updateData.extraType || delivery.extra_type || 'NONE';
    const isLegal = newExtraType !== 'WIDE' && newExtraType !== 'NO_BALL';

    delivery.runs_batter = newRunsBatter;
    delivery.runs_extras = newRunsExtras;
    delivery.total_runs = newTotalRuns;
    delivery.wicket = newWicket;
    if (newWicketType) {
      delivery.wicket_type = newWicketType;
      delivery.dismissal_type = newWicketType;
    }
    delivery.extra_type = newExtraType;
    delivery.is_legal_delivery = isLegal;
    if (typeof updateData.shotAngle === 'number') delivery.shot_angle = updateData.shotAngle;
    if (typeof updateData.shotDistance === 'number') delivery.shot_distance = updateData.shotDistance;
    if (updateData.shotZone) delivery.shot_zone = updateData.shotZone;
    if (typeof updateData.shotX === 'number') delivery.shot_x = updateData.shotX;
    if (typeof updateData.shotY === 'number') delivery.shot_y = updateData.shotY;
    if (updateData.fielderId) delivery.fielder_id = updateData.fielderId;
    if (updateData.fielderName) delivery.fielder_name = updateData.fielderName;
    if (updateData.dismissedPlayerId) delivery.dismissed_player_id = updateData.dismissedPlayerId;
    if (typeof updateData.isOverthrow === 'boolean') delivery.is_overthrow = updateData.isOverthrow;
    if (Array.isArray(updateData.overthrowFielders)) delivery.overthrow_fielders = updateData.overthrowFielders;
    if (updateData.remarks) delivery.remarks = updateData.remarks;

    delivery.boundary_type = (newRunsBatter === 4 ? 'FOUR' : (newRunsBatter === 6 ? 'SIX' : null));

    // Auto-generate fresh commentary matching edited event
    let newCommentary = '';
    const shotZone = updateData.shotZone || delivery.shot_zone || 'covers';
    if (newWicket) {
      if (newWicketType === 'CAUGHT') {
        newCommentary = `OUT! Caught by ${delivery.fielder_name || 'Fielder'} off ${delivery.bowler_name || 'Bowler'}.`;
        delivery.dismissal_text = `c ${delivery.fielder_name || 'Fielder'} b ${delivery.bowler_name || 'Bowler'}`;
      } else if (newWicketType === 'BOWLED') {
        newCommentary = `OUT! Clean bowled by ${delivery.bowler_name || 'Bowler'}! Shattered the stumps.`;
        delivery.dismissal_text = `b ${delivery.bowler_name || 'Bowler'}`;
      } else if (newWicketType === 'LBW') {
        newCommentary = `OUT! LBW! Struck on the pads in front of middle stump.`;
        delivery.dismissal_text = `lbw b ${delivery.bowler_name || 'Bowler'}`;
      } else if (newWicketType === 'RUN_OUT') {
        newCommentary = `OUT! Run out (${delivery.fielder_name || 'Fielder'}). Stranded short of crease.`;
        delivery.dismissal_text = `run out (${delivery.fielder_name || 'Fielder'})`;
      } else if (newWicketType === 'STUMPED') {
        newCommentary = `OUT! Stumped by †${delivery.fielder_name || 'Wicketkeeper'} off ${delivery.bowler_name || 'Bowler'}.`;
        delivery.dismissal_text = `st †${delivery.fielder_name || 'Wicketkeeper'} b ${delivery.bowler_name || 'Bowler'}`;
      } else {
        newCommentary = `OUT! Dismissed (${newWicketType}).`;
        delivery.dismissal_text = `${newWicketType}`;
      }
    } else {
      delivery.dismissal_text = null;
      if (delivery.is_overthrow || updateData.isOverthrow) {
        const fld = delivery.fielder_name || (delivery.overthrow_fielders?.length ? delivery.overthrow_fielders.join(', ') : 'fielding side');
        newCommentary = `Overthrow! Fielder (${fld}) errant throw results in ${newRunsBatter} extra runs.`;
      } else if (newRunsBatter === 4) {
        newCommentary = `FOUR! Beautifully timed drive towards ${shotZone}! Races away to the fence!`;
      } else if (newRunsBatter === 6) {
        newCommentary = `SIX! Magnificent stroke over ${shotZone}! Clean connection!`;
      } else if (newRunsBatter === 0 && newExtraType === 'NONE') {
        newCommentary = `Dot ball. Good line and length towards ${shotZone}.`;
      } else if (newExtraType === 'WIDE') {
        newCommentary = `Wide ball! Bowler strays outside the marker.`;
      } else if (newExtraType === 'NO_BALL') {
        newCommentary = `No ball! Bowler oversteps the crease.`;
      } else {
        newCommentary = `${newRunsBatter} run(s) pushed towards ${shotZone}.`;
      }
    }
    delivery.commentary = newCommentary;
    await delivery.save();

    // Recalculate whole innings totals from Deliveries
    const inningsId = delivery.innings_id;
    const allDeliveries = await db.models.Delivery.find({ innings_id: inningsId }).sort({ over_number: 1, ball_number: 1, created_at: 1 });

    let totalRuns = 0;
    let wickets = 0;
    let legalBalls = 0;
    let wides = 0;
    let noBalls = 0;
    let byes = 0;
    let legByes = 0;
    let penalty = 0;

    const batterStats = {};
    const bowlerStats = {};

    for (const d of allDeliveries) {
      const bRuns = Number(d.runs_batter) || 0;
      const eRuns = Number(d.runs_extras) || 0;
      totalRuns += (bRuns + eRuns);

      if (d.wicket) {
        wickets += 1;
      }

      if (d.is_legal_delivery) {
        legalBalls += 1;
      }

      if (d.extra_type === 'WIDE') wides += eRuns;
      else if (d.extra_type === 'NO_BALL') noBalls += eRuns;
      else if (d.extra_type === 'BYE') byes += eRuns;
      else if (d.extra_type === 'LEG_BYE') legByes += eRuns;
      else if (d.extra_type === 'PENALTY') penalty += eRuns;

      // Batter accumulation
      if (d.striker_id) {
        if (!batterStats[d.striker_id]) {
          batterStats[d.striker_id] = { runs: 0, balls: 0, fours: 0, sixes: 0, is_out: false, dismissal_type: null, dismissal_text: 'not out' };
        }
        if (d.extra_type === 'NONE' || d.extra_type === 'NO_BALL') {
          batterStats[d.striker_id].runs += bRuns;
          if (bRuns === 4) batterStats[d.striker_id].fours += 1;
          if (bRuns === 6) batterStats[d.striker_id].sixes += 1;
        }
        if (d.is_legal_delivery || d.extra_type === 'NO_BALL') {
          batterStats[d.striker_id].balls += 1;
        }
      }

      // Track dismissal
      if (d.wicket) {
        const outPlayerId = d.dismissed_player_id || d.striker_id;
        if (outPlayerId) {
          if (!batterStats[outPlayerId]) {
            batterStats[outPlayerId] = { runs: 0, balls: 0, fours: 0, sixes: 0, is_out: true, dismissal_type: d.wicket_type, dismissal_text: d.dismissal_text || 'out' };
          } else {
            batterStats[outPlayerId].is_out = true;
            batterStats[outPlayerId].dismissal_type = d.wicket_type;
            batterStats[outPlayerId].dismissal_text = d.dismissal_text || 'out';
          }
        }
      }

      // Bowler accumulation
      if (d.bowler_id) {
        if (!bowlerStats[d.bowler_id]) {
          bowlerStats[d.bowler_id] = { balls: 0, runs_conceded: 0, wickets: 0 };
        }
        if (d.is_legal_delivery) {
          bowlerStats[d.bowler_id].balls += 1;
        }
        if (d.extra_type !== 'BYE' && d.extra_type !== 'LEG_BYE' && d.extra_type !== 'PENALTY') {
          bowlerStats[d.bowler_id].runs_conceded += (bRuns + eRuns);
        }
        if (d.wicket && d.wicket_type !== 'RUN_OUT') {
          bowlerStats[d.bowler_id].wickets += 1;
        }
      }
    }

    const overs = Math.floor(legalBalls / 6);
    const balls = legalBalls % 6;

    // Update Innings
    await db.models.Innings.updateOne(
      { id: inningsId },
      {
        $set: {
          total_runs: totalRuns,
          wickets: wickets,
          overs: overs,
          balls: balls,
          extras: {
            wides,
            no_balls: noBalls,
            byes,
            leg_byes: legByes,
            penalty,
            total: wides + noBalls + byes + legByes + penalty
          }
        }
      }
    );

    // Update Batter figures
    for (const [pId, stats] of Object.entries(batterStats)) {
      const sr = stats.balls > 0 ? parseFloat(((stats.runs / stats.balls) * 100).toFixed(2)) : 0.00;
      await db.models.InningsBatter.updateOne(
        { innings_id: inningsId, player_id: pId },
        {
          $set: {
            runs: stats.runs,
            balls: stats.balls,
            fours: stats.fours,
            sixes: stats.sixes,
            strike_rate: sr,
            is_out: stats.is_out,
            dismissal_type: stats.dismissal_type,
            dismissal_text: stats.dismissal_text
          }
        }
      );
    }

    // Update Bowler figures
    for (const [bId, stats] of Object.entries(bowlerStats)) {
      const bOvers = Math.floor(stats.balls / 6);
      const bBalls = stats.balls % 6;
      const econ = stats.balls > 0 ? parseFloat(((stats.runs_conceded / stats.balls) * 6).toFixed(2)) : 0.00;
      await db.models.InningsBowler.updateOne(
        { innings_id: inningsId, player_id: bId },
        {
          $set: {
            overs: bOvers,
            balls: bBalls,
            runs_conceded: stats.runs_conceded,
            wickets: stats.wickets,
            economy: econ
          }
        }
      );
    }

    try {
      broadcastScoreUpdate(matchId, {
        action: 'DELIVERY_EDITED',
        deliveryId: delivery.id,
        currentScore: `${totalRuns}/${wickets}`,
        currentOvers: `${overs}.${balls}`
      });
    } catch (_) {}

    return {
      success: true,
      message: `Delivery ${delivery.over_number}.${delivery.ball_number} corrected successfully.`,
      deliveryId,
      delivery,
      currentScore: `${totalRuns}/${wickets}`,
      currentOvers: `${overs}.${balls}`,
      data: {
        action: 'EDIT_DELIVERY',
        deliveryId,
        runsBatter: newRunsBatter,
        runsExtras: newRunsExtras,
        totalRuns: newTotalRuns,
        wicket: newWicket
      }
    };
  }
}

module.exports = new UndoEditService();
