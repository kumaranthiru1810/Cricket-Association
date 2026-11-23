/**
 * services/scoring/deliveryService.js
 * Handles ball-by-ball delivery processing, strike swapping, bowler changes, and ball changes.
 */

const db = require('../../config/db');
const socketService = require('../socketService');
const {
  broadcastScoreUpdate,
  getFullPlayerMap,
  getMaxWicketsForInnings,
  buildDismissalText,
  generateCommentary
} = require('./deliveryHelpers');

let deliverySequence = 10000;

class DeliveryService {
  /**
   * Records a single delivery in MongoDB (Ball-by-Ball)
   */
  async recordDelivery(matchId, deliveryData, scorerId) {
    await db.initDb();

    // 1. Fetch Match
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: `Match '${matchId}' not found.` };
    
    // Status checks
    if (match.status === 'SCHEDULED') {
      throw { status: 400, message: 'Match is SCHEDULED. Please perform toss and start match before recording deliveries.' };
    }
    if (match.status === 'COMPLETED') {
      throw { status: 400, message: 'Match is already COMPLETED. Live scoring is disabled.' };
    }
    if (match.status === 'ABANDONED') {
      throw { status: 400, message: 'Match has been ABANDONED. Scoring is disabled.' };
    }

    // Auto-resume play if match was on break
    if (match.current_break) {
      match.current_break = null;
      match.status_comment = '';
      match.markModified('current_break');
      match.markModified('status_comment');
      await match.save();
      try {
        broadcastScoreUpdate(matchId, {
          action: 'BREAK_ENDED',
          matchId,
          currentBreak: null,
          statusComment: ''
        });
      } catch (_) {}
    }

    // 2. Fetch Active Innings
    let innings = await db.models.Innings.findOne({ match_id: matchId, is_completed: { $ne: true }, status: { $ne: "COMPLETED" } }).sort({ innings_number: -1 });
    if (!innings) {
      const inn1 = await db.models.Innings.findOne({ match_id: matchId, innings_number: 1 });
      if (inn1 && inn1.is_completed && match.status !== 'COMPLETED') {
        const target = (inn1.total_runs || 0) + 1;
        const inn2Id = `INN-${matchId}-2`;
        innings = await db.models.Innings.findOne({ id: inn2Id });
        if (!innings) {
          innings = await db.models.Innings.create({
            id: inn2Id,
            match_id: matchId,
            innings_number: 2,
            batting_team_id: inn1.bowling_team_id,
            bowling_team_id: inn1.batting_team_id,
            total_runs: 0,
            wickets: 0,
            overs: 0,
            balls: 0,
            target,
            status: 'LIVE',
            is_completed: false,
            is_over_complete: false,
            extras: { wides: 0, no_balls: 0, byes: 0, leg_byes: 0, total: 0 }
          });
        } else {
          innings.is_completed = false;
          innings.status = 'LIVE';
          await innings.save();
        }
        match.current_innings_number = 2;
        match.target_runs = target;
        match.status = 'LIVE';
        await match.save();
      } else {
        innings = await db.models.Innings.findOne({ match_id: matchId }).sort({ innings_number: -1 });
      }
    }
    if (!innings) {
      throw { status: 400, message: 'No active innings found for this match. Please start the match first.' };
    }

    // State conflict check: prevent duplicate or stale delivery execution
    if (deliveryData.expectedOver !== undefined && deliveryData.expectedBall !== undefined) {
      if (innings.overs !== Number(deliveryData.expectedOver) || innings.balls !== Number(deliveryData.expectedBall)) {
        throw { status: 409, message: `Conflict: Stale delivery state. Expected ${deliveryData.expectedOver}.${deliveryData.expectedBall}, current is ${innings.overs}.${innings.balls}.` };
      }
    }

    // Input extraction
    const {
      strikerId,
      nonStrikerId,
      bowlerId,
      runsBatter = 0,
      runsExtras = 0,
      extraType = 'NONE',
      wicket = false,
      wicketType = null,
      dismissedPlayerId = null,
      shotType = null,
      fieldingPosition = null,
      shotAngle = null,
      shotDistance = null,
      shotZone = null,
      shotX = null,
      shotY = null,
      fielderId = null,
      fielderName = null,
      fieldingAction = null,
      reason = null,
      note = null
    } = deliveryData;

    const isOverthrow = Boolean(
      deliveryData.is_overthrow ||
      deliveryData.isOverthrow ||
      (deliveryData.remarks && deliveryData.remarks.toLowerCase().includes('overthrow'))
    );
    const overthrowFielders = Array.isArray(deliveryData.overthrowFielders)
      ? deliveryData.overthrowFielders
      : (Array.isArray(deliveryData.overthrow_fielders) ? deliveryData.overthrow_fielders : []);
    const resolvedFielderName = fielderName || (overthrowFielders.length ? overthrowFielders.join(', ') : null);

    const isLegal = extraType === 'NONE' || extraType === 'BYE' || extraType === 'LEG_BYE';
    const totalRuns = Number(runsBatter) + Number(runsExtras);

    let overNumber = innings.overs;
    let ballNumber = innings.balls;
    let isOverFinished = false;

    if (isLegal) {
      ballNumber += 1;
      if (ballNumber === 6) {
        overNumber += 1;
        ballNumber = 0;
        isOverFinished = true;
      }
    }

    let boundaryType = null;
    if (runsBatter === 4) boundaryType = 'FOUR';
    if (runsBatter === 6) boundaryType = 'SIX';

    const playerMap = await getFullPlayerMap();

    let activeStrikerId = strikerId || innings.current_striker_id;
    let activeNonStrikerId = nonStrikerId || innings.current_non_striker_id;
    let activeBowlerId = bowlerId || innings.current_bowler_id;

    if (!activeStrikerId || !activeNonStrikerId || !activeBowlerId) {
      try {
        const scorerService = require('../scorerService');
        const matchDoc = await db.models.Match.findOne({ id: innings.match_id }).lean();
        const battingSquad = await scorerService.getSquadForTeam(innings.batting_team_id, matchDoc);
        const bowlingSquad = await scorerService.getSquadForTeam(innings.bowling_team_id, matchDoc);
        if (!activeStrikerId) activeStrikerId = battingSquad[0]?.id || 'P101';
        if (!activeNonStrikerId) activeNonStrikerId = battingSquad.find(p => p.id !== activeStrikerId)?.id || battingSquad[1]?.id || 'P102';
        if (!activeBowlerId) activeBowlerId = bowlingSquad.find(p => p.role === 'BOWLER')?.id || bowlingSquad[0]?.id || 'P201';
        innings.current_striker_id = activeStrikerId;
        innings.current_non_striker_id = activeNonStrikerId;
        innings.current_bowler_id = activeBowlerId;
        await innings.save();
      } catch (_e) {
        if (!activeStrikerId) activeStrikerId = 'P101';
        if (!activeNonStrikerId) activeNonStrikerId = 'P102';
        if (!activeBowlerId) activeBowlerId = 'P201';
      }
    }

    const actualDismissedId = dismissedPlayerId || (wicket ? activeStrikerId : null);
    const dismissedBatterName = actualDismissedId ? (playerMap[actualDismissedId]?.name || 'Batter') : null;

    const strikerName = (activeStrikerId && playerMap[activeStrikerId]?.name) || 'Batter';
    const bowlerName = (activeBowlerId && playerMap[activeBowlerId]?.name) || 'Bowler';
    const actualFielderName = resolvedFielderName || (fielderId && playerMap[fielderId]?.name) || null;

    const dismissalText = wicket ? buildDismissalText(wicketType, bowlerName, actualFielderName) : null;

    let commentary = generateCommentary(
      strikerName,
      bowlerName,
      Number(runsBatter),
      Number(runsExtras),
      extraType,
      Boolean(wicket),
      wicketType,
      fieldingPosition,
      actualFielderName,
      dismissedBatterName
    );

    if (isOverthrow) {
      const fNames = actualFielderName || (overthrowFielders.length ? overthrowFielders.join(', ') : 'fielding side');
      commentary = `Overthrow! Stray throw by ${fNames} conceded ${Number(runsBatter) || totalRuns} extra runs.`;
    }

    const runReason = (reason || note || deliveryData.customReason || '').trim();
    if (runReason) {
      commentary = `${commentary} [${runReason}]`;
    }

    const replacementId = deliveryData.replacementBatterId || deliveryData.nextBatterId;

    const deliveryId = 'DEL-' + Date.now() + '-' + String(++deliverySequence).padStart(6, '0');
    const wasDeliveryFreeHit = !!innings.is_free_hit;
    const deliveryDoc = await db.models.Delivery.create({
      id: deliveryId,
      match_id: matchId,
      innings_id: innings.id,
      innings_number: innings.innings_number,
      over_number: isLegal && ballNumber === 0 ? overNumber : overNumber + 1,
      ball_number: isLegal ? (ballNumber === 0 ? 6 : ballNumber) : ballNumber,
      striker_id: activeStrikerId,
      non_striker_id: activeNonStrikerId,
      bowler_id: activeBowlerId,
      runs_batter: Number(runsBatter),
      runs_extras: Number(runsExtras),
      total_runs: totalRuns,
      extra_type: extraType,
      is_free_hit: wasDeliveryFreeHit,
      wicket: Boolean(wicket),
      wicket_type: wicketType,
      dismissal_type: wicketType,
      dismissal_text: dismissalText,
      dismissed_player_id: actualDismissedId,
      replacement_batter_id: replacementId || null,
      reason: runReason || null,
      boundary_type: boundaryType,
      is_legal_delivery: isLegal,
      shot_type: shotType,
      fielding_position: fieldingPosition,
      shot_angle: shotAngle !== null && shotAngle !== undefined ? Number(shotAngle) : (deliveryData.shot_angle !== undefined && deliveryData.shot_angle !== null ? Number(deliveryData.shot_angle) : null),
      shot_distance: shotDistance !== null && shotDistance !== undefined ? Number(shotDistance) : (deliveryData.shot_distance !== undefined && deliveryData.shot_distance !== null ? Number(deliveryData.shot_distance) : null),
      shot_zone: shotZone || deliveryData.shot_zone || fieldingPosition || null,
      shot_x: shotX !== null && shotX !== undefined ? Number(shotX) : (deliveryData.shot_x !== undefined && deliveryData.shot_x !== null ? Number(deliveryData.shot_x) : null),
      shot_y: shotY !== null && shotY !== undefined ? Number(shotY) : (deliveryData.shot_y !== undefined && deliveryData.shot_y !== null ? Number(deliveryData.shot_y) : null),
      fielder_id: fielderId,
      fielder_name: actualFielderName,
      fielding_action: fieldingAction || deliveryData.fielding_action || deliveryData.fieldingAction || (isOverthrow ? 'Overthrow' : null),
      is_overthrow: isOverthrow,
      overthrow_fielders: overthrowFielders,
      remarks: deliveryData.remarks || null,
      commentary,
      created_by: scorerId || 'SCR-101',
      timestamp: new Date()
    });

    innings.total_runs += totalRuns;
    const isRetiredHurt = wicket && wicketType === 'RETIRED_HURT';
    if (wicket && !isRetiredHurt) {
      innings.wickets += 1;
    }
    innings.overs = overNumber;
    innings.balls = ballNumber;

    if (!innings.extras) {
      innings.extras = { wides: 0, no_balls: 0, byes: 0, leg_byes: 0, total: 0 };
    }
    if (extraType === 'WIDE') innings.extras.wides += Number(runsExtras);
    if (extraType === 'NO_BALL') innings.extras.no_balls += Number(runsExtras);
    if (extraType === 'BYE') innings.extras.byes += Number(runsExtras);
    if (extraType === 'LEG_BYE') innings.extras.leg_byes += Number(runsExtras);
    innings.extras.total += Number(runsExtras);

    let nextStriker = activeStrikerId;
    let nextNonStriker = activeNonStrikerId;

    if (wicket && replacementId) {
      if (dismissedPlayerId && dismissedPlayerId === activeNonStrikerId) {
        nextNonStriker = replacementId;
      } else {
        nextStriker = replacementId;
      }
    }

    let runsThatRotate = 0;
    if (extraType === 'NONE') {
      runsThatRotate = Number(runsBatter) || 0;
    } else if (extraType === 'WIDE') {
      runsThatRotate = Number(runsBatter) > 0 ? Number(runsBatter) : Math.max(0, Number(runsExtras) - 1);
    } else if (extraType === 'NO_BALL') {
      runsThatRotate = Number(runsBatter) > 0 ? Number(runsBatter) : Math.max(0, Number(runsExtras) - 1);
    } else if (extraType === 'BYE' || extraType === 'LEG_BYE') {
      runsThatRotate = Number(runsExtras) || Number(runsBatter) || 0;
    } else if (extraType === 'PENALTY') {
      runsThatRotate = 0;
    } else {
      runsThatRotate = Number(runsBatter) || 0;
    }

    if (deliveryData.runs_ran !== undefined && deliveryData.runs_ran !== null) {
      runsThatRotate = Number(deliveryData.runs_ran);
    }

    let isOdd = runsThatRotate % 2 !== 0;
    if (deliveryData.rotateStrike !== undefined) {
      isOdd = Boolean(deliveryData.rotateStrike);
    }

    if (isOdd) {
      const temp = nextStriker;
      nextStriker = nextNonStriker;
      nextNonStriker = temp;
    }

    if (isOverFinished) {
      const temp = nextStriker;
      nextStriker = nextNonStriker;
      nextNonStriker = temp;
      innings.is_over_complete = true;
      innings.previous_bowler_id = activeBowlerId;
    } else {
      innings.is_over_complete = false;
    }

    innings.current_striker_id = nextStriker;
    innings.current_non_striker_id = nextNonStriker;
    innings.current_bowler_id = activeBowlerId;

    let nextIsFreeHit = false;
    if (extraType === 'NO_BALL') {
      nextIsFreeHit = true;
    } else if (wasDeliveryFreeHit) {
      if (extraType === 'WIDE') {
        nextIsFreeHit = true;
      } else {
        nextIsFreeHit = false;
      }
    } else {
      nextIsFreeHit = false;
    }
    innings.is_free_hit = nextIsFreeHit;

    await innings.save();

    // Update Batter
    let batter = await db.models.InningsBatter.findOne({ innings_id: innings.id, player_id: activeStrikerId });
    if (!batter) {
      try {
        batter = await db.models.InningsBatter.create({
          id: `BAT-${innings.id}-${activeStrikerId}`,
          innings_id: innings.id,
          player_id: activeStrikerId,
          batting_position: (await db.models.InningsBatter.countDocuments({ innings_id: innings.id })) + 1,
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          is_out: false,
          dismissal_text: 'not out'
        });
      } catch (_err) {
        batter = await db.models.InningsBatter.findOne({ innings_id: innings.id, player_id: activeStrikerId });
      }
    }

    if (extraType === 'NONE' || extraType === 'NO_BALL') {
      batter.runs += Number(runsBatter);
      if (runsBatter === 4) batter.fours += 1;
      if (runsBatter === 6) batter.sixes += 1;
    }
    if (isLegal || extraType === 'NO_BALL') {
      batter.balls += 1;
    }
    batter.strike_rate = batter.balls > 0 ? parseFloat(((batter.runs / batter.balls) * 100).toFixed(2)) : 0.00;

    const nonBowlerDismissals = ['RUN_OUT', 'RETIRED_OUT', 'RETIRED_HURT', 'OBSTRUCTING_FIELD', 'HIT_BALL_TWICE', 'TIMED_OUT'];

    if (wicket && (!dismissedPlayerId || dismissedPlayerId === activeStrikerId)) {
      batter.is_out = !isRetiredHurt;
      batter.dismissal_type = wicketType || 'BOWLED';
      batter.dismissal_text = isRetiredHurt ? 'retired hurt (not out)' : (dismissalText || 'out');
      batter.bowler_id = nonBowlerDismissals.includes(wicketType) ? null : activeBowlerId;
      batter.fielder_id = fielderId || null;
    }
    await batter.save();

    // Non-striker Batter
    if (activeNonStrikerId && activeNonStrikerId !== activeStrikerId) {
      let nonStrikerBatter = await db.models.InningsBatter.findOne({ innings_id: innings.id, player_id: activeNonStrikerId });
      if (!nonStrikerBatter) {
        try {
          nonStrikerBatter = await db.models.InningsBatter.create({
            id: `BAT-${innings.id}-${activeNonStrikerId}`,
            innings_id: innings.id,
            player_id: activeNonStrikerId,
            batting_position: (await db.models.InningsBatter.countDocuments({ innings_id: innings.id })) + 1,
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            is_out: false,
            dismissal_text: 'not out'
          });
        } catch (_err) {
          nonStrikerBatter = await db.models.InningsBatter.findOne({ innings_id: innings.id, player_id: activeNonStrikerId });
        }
      }

      if (wicket && dismissedPlayerId === activeNonStrikerId) {
        nonStrikerBatter.is_out = !isRetiredHurt;
        nonStrikerBatter.dismissal_type = wicketType || 'RUN_OUT';
        nonStrikerBatter.dismissal_text = isRetiredHurt ? 'retired hurt (not out)' : (dismissalText || 'run out');
        nonStrikerBatter.bowler_id = nonBowlerDismissals.includes(wicketType) ? null : activeBowlerId;
        nonStrikerBatter.fielder_id = fielderId || null;
      }
      await nonStrikerBatter.save();
    }

    // Replacement incoming batter
    if (replacementId) {
      if (deliveryData.replacementBatterName && deliveryData.replacementBatterName.trim()) {
        const cleanRepName = deliveryData.replacementBatterName.trim();
        const existingPlayer = await db.models.Player.findOne({
          $or: [{ id: replacementId }, { name: cleanRepName }]
        });
        if (!existingPlayer) {
          await db.models.Player.create({
            id: replacementId,
            name: cleanRepName,
            role: 'BATTER',
            team_id: innings.batting_team_id
          });
        }
      }

      let repBatter = await db.models.InningsBatter.findOne({ innings_id: innings.id, player_id: replacementId });
      if (!repBatter) {
        repBatter = new db.models.InningsBatter({
          id: `BAT-${innings.id}-${replacementId}`,
          innings_id: innings.id,
          player_id: replacementId,
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
      }
    }

    // Update Bowler
    let bowler = await db.models.InningsBowler.findOne({ innings_id: innings.id, player_id: activeBowlerId });
    if (!bowler) {
      try {
        bowler = await db.models.InningsBowler.create({
          id: `BWL-${innings.id}-${activeBowlerId}`,
          innings_id: innings.id,
          player_id: activeBowlerId,
          overs: 0,
          balls: 0,
          maidens: 0,
          runs_conceded: 0,
          wickets: 0,
          wides: 0,
          no_balls: 0
        });
      } catch (_err) {
        bowler = await db.models.InningsBowler.findOne({ innings_id: innings.id, player_id: activeBowlerId });
      }
    }

    if (isLegal) {
      bowler.balls += 1;
      if (bowler.balls === 6) {
        bowler.overs += 1;
        bowler.balls = 0;
      }
    }
    const bowlerRuns = Number(runsBatter) + (extraType === 'WIDE' || extraType === 'NO_BALL' ? Number(runsExtras) : 0);
    bowler.runs_conceded += bowlerRuns;
    const bowlerCreditedDismissals = ['BOWLED', 'CAUGHT', 'CAUGHT_BEHIND', 'CAUGHT_AND_BOWLED', 'LBW', 'STUMPED', 'HIT_WICKET'];
    if (wicket && bowlerCreditedDismissals.includes(wicketType)) {
      bowler.wickets += 1;
    }
    if (extraType === 'WIDE') bowler.wides += Number(runsExtras);
    if (extraType === 'NO_BALL') bowler.no_balls += Number(runsExtras);

    const totalBowlerOvers = bowler.overs + (bowler.balls / 6);
    bowler.economy = totalBowlerOvers > 0 ? parseFloat((bowler.runs_conceded / totalBowlerOvers).toFixed(2)) : 0.00;
    await bowler.save();

    // Check match completion
    const maxWickets = getMaxWicketsForInnings(innings, match);
    let isMatchCompleted = false;
    if (innings.innings_number === 2 && innings.target && innings.total_runs >= innings.target) {
      match.status = 'COMPLETED';
      isMatchCompleted = true;
      const winnerTeam = await db.models.Team.findOne({ id: innings.batting_team_id }).lean();
      const wicketsRemaining = Math.max(0, maxWickets - innings.wickets);
      match.result_summary = `${winnerTeam?.name || 'Chasing Team'} won by ${wicketsRemaining} wicket${wicketsRemaining > 1 ? 's' : ''}`;
      match.winner_id = innings.batting_team_id;
      innings.is_completed = true;
      innings.is_over_complete = false;
      await match.save();
      await innings.save();
    } else if (innings.wickets >= maxWickets || (match.overs_per_side && overNumber >= match.overs_per_side)) {
      if (innings.innings_number === 1) {
        innings.is_completed = true;
        innings.is_over_complete = false;
        match.status = 'INNINGS_BREAK';
        await innings.save();

        const target = (innings.total_runs || 0) + 1;
        const inn2Id = `INN-${matchId}-2`;
        let inn2 = await db.models.Innings.findOne({ id: inn2Id });
        if (!inn2) {
          await db.models.Innings.create({
            id: inn2Id,
            match_id: matchId,
            innings_number: 2,
            batting_team_id: innings.bowling_team_id,
            bowling_team_id: innings.batting_team_id,
            total_runs: 0,
            wickets: 0,
            overs: 0,
            balls: 0,
            target,
            status: 'LIVE',
            is_completed: false,
            is_over_complete: false,
            extras: { wides: 0, no_balls: 0, byes: 0, leg_byes: 0, total: 0 }
          });
        } else {
          inn2.target = target;
          inn2.is_completed = false;
          await inn2.save();
        }
        match.target_runs = target;
        match.current_innings_number = 2;
        await match.save();
      } else {
        innings.is_completed = true;
        innings.is_over_complete = false;
        match.status = 'COMPLETED';
        isMatchCompleted = true;
        const inn1 = await db.models.Innings.findOne({ match_id: matchId, innings_number: 1 }).lean();
        const runsDiff = (inn1?.total_runs || 0) - innings.total_runs;
        if (runsDiff > 0) {
          const winnerTeam = await db.models.Team.findOne({ id: inn1.batting_team_id }).lean();
          match.result_summary = `${winnerTeam?.name || 'Defending Team'} won by ${runsDiff} runs`;
          match.winner_id = inn1.batting_team_id;
        } else if (runsDiff === 0) {
          match.result_summary = 'Match Tied';
          match.winner_id = 'TIE';
        }
        await innings.save();
        await match.save();
      }
    }

    if (isMatchCompleted) {
      try {
        const tournamentService = require('../tournamentService');
        tournamentService.onMatchCompleted(matchId);
      } catch (_err) {}
    }

    // Warnings and Analysis
    let noBallWarning = null;
    let dangerousBowlingWarning = null;
    const isDangerousBeamer = deliveryData.noBallReason === 'BEAMER' || deliveryData.isDangerousDelivery || deliveryData.remarks?.toLowerCase().includes('beamer');

    if (extraType === 'NO_BALL') {
      try {
        const totalNoBalls = await db.models.Delivery.countDocuments({
          innings_id: innings.id,
          bowler_id: activeBowlerId,
          extra_type: 'NO_BALL'
        });

        if (totalNoBalls >= 2) {
          dangerousBowlingWarning = {
            level: 'SUSPENSION',
            action: 'MANDATORY_SUSPENSION',
            bowlerId: activeBowlerId,
            bowlerName,
            noBallCount: totalNoBalls,
            message: `MCC Law 41.7 Violation: Bowler ${bowlerName} has bowled ${totalNoBalls} No-Balls in this innings. Under cricket rules, the umpire directs the captain to take the bowler off immediately.`
          };
          noBallWarning = dangerousBowlingWarning;
        } else if (isDangerousBeamer) {
          dangerousBowlingWarning = {
            level: 'WARNING',
            action: 'FIRST_WARNING',
            bowlerId: activeBowlerId,
            bowlerName,
            noBallCount: 1,
            message: `WARNING (MCC Law 41.7): First dangerous waist-high beamer bowled by ${bowlerName}. A second beamer will result in mandatory bowling suspension.`
          };
          noBallWarning = dangerousBowlingWarning;
        }
      } catch (_e) {}
    }

    let consecutiveWidesWarning = null;
    if (extraType === 'WIDE') {
      try {
        const recentOverDeliveries = await db.models.Delivery.find({
          innings_id: innings.id,
          over_number: overNumber
        }).sort({ created_at: -1, delivery_sequence: -1 }).limit(3).lean();

        if (recentOverDeliveries.length >= 2 && recentOverDeliveries[1].extra_type === 'WIDE') {
          const wideCountInOver = await db.models.Delivery.countDocuments({
            innings_id: innings.id,
            over_number: overNumber,
            extra_type: 'WIDE'
          });
          consecutiveWidesWarning = {
            bowlerId: activeBowlerId,
            bowlerName,
            overNumber: overNumber + 1,
            count: wideCountInOver,
            message: `Bowler ${bowlerName} has bowled ${wideCountInOver} Wides in Over ${overNumber + 1}. Check wide tramlines (MCC Law 22).`
          };
        }
      } catch (_e) {}
    }

    const matchTotalOvers = match.overs || 20;
    const maxQuota = Math.ceil(matchTotalOvers / 5) || 4;
    let bowlerQuotaWarning = null;
    if (bowler && bowler.overs >= maxQuota) {
      bowlerQuotaWarning = {
        bowlerId: activeBowlerId,
        bowlerName,
        overs: bowler.overs,
        maxQuota,
        isQuotaFull: true,
        message: `Bowler ${bowlerName} has completed their maximum bowling quota (${bowler.overs}/${maxQuota} overs).`
      };
    }

    const powerplayOvers = Math.round(matchTotalOvers * 0.3) || 6;
    const currentOverNumber = innings.overs + (innings.balls > 0 ? 1 : 0);
    const isPowerplay = currentOverNumber <= powerplayOvers;
    const powerplay = {
      isPowerplay,
      powerplayOvers,
      currentOver: currentOverNumber,
      maxFieldersOutside: isPowerplay ? 2 : 5
    };

    const isBoundary = Number(runsBatter) === 4 || boundaryType === 'FOUR';
    const isSix = Number(runsBatter) === 6 || boundaryType === 'SIX';
    const isWkt = Boolean(wicket);
    const totalDeliveryRuns = Number(runsBatter) + Number(runsExtras);

    const currentScoreStr = `${innings.total_runs}/${innings.wickets} (${innings.overs}.${innings.balls} Ov)`;
    let scoreAStr = null;
    let scoreBStr = null;
    if (innings.batting_team_id === match.team_a_id) {
      scoreAStr = currentScoreStr;
      scoreBStr = match.score_b || null;
    } else {
      scoreAStr = match.score_a || null;
      scoreBStr = currentScoreStr;
    }

    try {
      match.score_a = scoreAStr;
      match.score_b = scoreBStr;
      match.markModified('score_a');
      match.markModified('score_b');
      await match.save();
    } catch (_mErr) {}

    const lastDelPayload = {
      ball: `${overNumber}.${ballNumber}`,
      runs: totalDeliveryRuns,
      runsBatter: Number(runsBatter),
      runsExtras: Number(runsExtras),
      extraType: extraType || null,
      isBoundary,
      isSix,
      isWicket: isWkt,
      wicketType: wicketType || null,
      batterName: dismissedBatterName || strikerName || 'Striker',
      bowlerName: bowlerName || 'Bowler',
      shotZone: shotZone || null,
      commentary,
      timestamp: Date.now()
    };

    try {
      socketService.emitScoreUpdate(matchId, {
        matchId,
        score: currentScoreStr,
        overs: `${innings.overs}.${innings.balls}`,
        scoreA: scoreAStr,
        scoreB: scoreBStr,
        battingTeamId: innings.batting_team_id,
        currentInnings: innings.innings_number,
        isOverComplete: isOverFinished,
        isFreeHit: nextIsFreeHit,
        currentBreak: match.current_break || null,
        statusComment: match.status_comment || '',
        noBallWarning,
        consecutiveWidesWarning,
        bowlerQuotaWarning,
        powerplay,
        lastDelivery: lastDelPayload,
        lastEvent: lastDelPayload
      });
    } catch (e) {}

    return {
      success: true,
      message: 'Delivery recorded successfully in MongoDB.',
      deliveryId,
      score: `${innings.total_runs}/${innings.wickets}`,
      overs: `${innings.overs}.${innings.balls}`,
      commentary,
      matchStatus: match.status,
      isOverComplete: isOverFinished,
      isFreeHit: nextIsFreeHit,
      strikerId: nextStriker,
      nonStrikerId: nextNonStriker,
      bowlerId: activeBowlerId,
      noBallWarning,
      consecutiveWidesWarning,
      bowlerQuotaWarning,
      powerplay,
      data: {
        deliveryId,
        score: `${innings.total_runs}/${innings.wickets}`,
        overs: `${innings.overs}.${innings.balls}`,
        totalRuns: innings.total_runs,
        wickets: innings.wickets,
        isFreeHit: nextIsFreeHit,
        strikerId: nextStriker,
        nonStrikerId: nextNonStriker,
        bowlerId: activeBowlerId,
        isOverComplete: isOverFinished,
        isMatchCompleted,
        noBallWarning,
        consecutiveWidesWarning,
        bowlerQuotaWarning,
        powerplay,
        lastDelivery: {
          id: deliveryId,
          runsBatter: Number(runsBatter),
          runsExtras: Number(runsExtras),
          totalRuns,
          extraType,
          isFreeHit: wasDeliveryFreeHit,
          boundaryType,
          wicket: Boolean(wicket),
          isLegalDelivery: isLegal,
          commentary
        }
      }
    };
  }

  async swapStrike(matchId) {
    await db.initDb();
    let innings = await db.models.Innings.findOne({ match_id: matchId, is_completed: { $ne: true }, status: { $ne: "COMPLETED" } }).sort({ innings_number: -1 });
    if (!innings) {
      innings = await db.models.Innings.findOne({ match_id: matchId }).sort({ innings_number: -1 });
    }
    if (!innings) throw { status: 404, message: 'Active innings not found.' };

    const oldStriker = innings.current_striker_id;
    const oldNonStriker = innings.current_non_striker_id;

    innings.current_striker_id = oldNonStriker;
    innings.current_non_striker_id = oldStriker;
    await innings.save();

    return {
      success: true,
      message: 'Strike swapped successfully.',
      strikerId: innings.current_striker_id,
      nonStrikerId: innings.current_non_striker_id
    };
  }

  async changeBowler(matchId, { newBowlerId, newBowlerName, reason, situation, suspendCurrentBowler } = {}) {
    await db.initDb();
    let innings = await db.models.Innings.findOne({ match_id: matchId, is_completed: { $ne: true }, status: { $ne: "COMPLETED" } }).sort({ innings_number: -1 });
    if (!innings) {
      innings = await db.models.Innings.findOne({ match_id: matchId }).sort({ innings_number: -1 });
    }
    if (!innings) throw { status: 404, message: 'Active innings not found.' };

    let resolvedId = newBowlerId;
    let finalBowlerName = newBowlerName ? newBowlerName.trim() : '';

    if (finalBowlerName) {
      const existingPlayer = await db.models.Player.findOne({
        $or: [
          ...(resolvedId ? [{ id: resolvedId }] : []),
          { name: finalBowlerName }
        ]
      });
      if (existingPlayer) {
        resolvedId = existingPlayer.id;
        finalBowlerName = existingPlayer.name;
      } else {
        if (!resolvedId) {
          resolvedId = `PLY-BWL-${Date.now()}`;
        }
        await db.models.Player.create({
          id: resolvedId,
          name: finalBowlerName,
          role: 'BOWLER',
          team_id: innings.bowling_team_id
        });
      }
    } else if (resolvedId) {
      const pDoc = await db.models.Player.findOne({ id: resolvedId }).lean();
      if (pDoc && pDoc.name) {
        finalBowlerName = pDoc.name;
      }
    }

    if (!resolvedId) throw { status: 400, message: 'Bowler ID or name required.' };

    if (innings.suspended_bowler_ids && innings.suspended_bowler_ids.includes(resolvedId)) {
      throw { status: 400, message: 'This bowler is suspended from bowling for 2 dangerous no-balls (MCC Law 41.7).' };
    }

    const oldBowlerId = innings.current_bowler_id;
    if (suspendCurrentBowler && oldBowlerId) {
      if (!innings.suspended_bowler_ids) innings.suspended_bowler_ids = [];
      if (!innings.suspended_bowler_ids.includes(oldBowlerId)) {
        innings.suspended_bowler_ids.push(oldBowlerId);
      }
      innings.markModified('suspended_bowler_ids');
    }

    let bowlerStats = await db.models.InningsBowler.findOne({ innings_id: innings.id, player_id: resolvedId });
    if (!bowlerStats) {
      bowlerStats = new db.models.InningsBowler({
        id: `BWL-${innings.id}-${resolvedId}`,
        innings_id: innings.id,
        player_id: resolvedId,
        overs: 0,
        balls: 0,
        maidens: 0,
        runs_conceded: 0,
        wickets: 0,
        economy: 0
      });
      await bowlerStats.save();
    }

    const ballsInOver = innings.balls || 0;
    const remainingBalls = (6 - ballsInOver) % 6;
    const isMidOver = ballsInOver > 0 && ballsInOver < 6;

    if (!innings.bowler_substitutions) innings.bowler_substitutions = [];
    if (oldBowlerId && oldBowlerId !== resolvedId) {
      const oldDoc = await db.models.Player.findOne({ id: oldBowlerId }).lean();
      innings.bowler_substitutions.push({
        oldBowlerId,
        oldBowlerName: oldDoc?.name || oldBowlerId,
        newBowlerId: resolvedId,
        newBowlerName: finalBowlerName || resolvedId,
        isMidOver,
        ballsInOver,
        remainingBalls,
        reason: reason || (isMidOver ? 'INJURY' : 'TACTICAL'),
        situation: situation || (isMidOver ? 'Injured / Retired Hurt' : 'Tactical Change'),
        suspended: !!suspendCurrentBowler,
        overNumber: innings.overs || 0,
        timestamp: new Date()
      });
      innings.markModified('bowler_substitutions');
    }

    innings.current_bowler_id = resolvedId;
    innings.is_over_complete = false;
    await innings.save();

    let changeMessage = `Bowler changed to ${finalBowlerName || resolvedId}`;
    if (isMidOver) {
      changeMessage = situation
        ? `${finalBowlerName || resolvedId} will complete remaining ${remainingBalls} ball(s) [${situation}]`
        : `${finalBowlerName || resolvedId} will complete the remaining ${remainingBalls} ball(s) of this over.`;
    }

    try {
      socketService.emitScoreUpdate(matchId, {
        matchId,
        event: 'BOWLER_CHANGED',
        bowlerId: resolvedId,
        bowlerName: finalBowlerName || resolvedId,
        isMidOver,
        ballsInOver,
        remainingBalls,
        reason: reason || (isMidOver ? 'INJURY_SUBSTITUTION' : 'REGULAR'),
        situation: situation || reason
      });
    } catch (e) {}

    return {
      success: true,
      message: changeMessage,
      currentBowlerId: innings.current_bowler_id,
      isMidOver,
      ballsInOver,
      remainingBalls,
      reason,
      situation: situation || reason,
      bowler: {
        id: resolvedId,
        name: finalBowlerName || bowlerStats?.name || resolvedId,
        overs: bowlerStats?.overs || 0,
        balls: bowlerStats?.balls || 0,
        runs: bowlerStats?.runs_conceded || 0,
        wickets: bowlerStats?.wickets || 0,
        economy: bowlerStats?.economy || 0
      }
    };
  }

  async recordBallChange(matchId, ballData = {}) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: 'Match not found.' };

    if (!Array.isArray(match.ball_changes)) match.ball_changes = [];
    match.ball_changes.push({
      ballType: ballData.ballType || 'New Ball',
      over: ballData.over || '0.0',
      time: ballData.time || new Date().toLocaleTimeString(),
      comments: ballData.comments || '',
      created_at: new Date()
    });
    await match.save();

    return {
      success: true,
      message: `Ball change recorded: ${ballData.ballType || 'New Ball'}`,
      data: match.ball_changes
    };
  }
}

module.exports = new DeliveryService();
