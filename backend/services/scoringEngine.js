/**
 * services/scoringEngine.js
 * Comprehensive Cricket Scoring Engine & Rules Service
 * Pure MongoDB Implementation using Mongoose Models
 */

const db = require('../config/db');
const socketService = require('./socketService');

let deliverySequence = 10000;

class ScoringEngine {
  /**
   * Generates realistic rule-based cricket commentary
   */
  /**
   * Helper to resolve all players across official Player and registered team squads
   */
  async getFullPlayerMap() {
    await db.initDb();
    const [players, teamRegs] = await Promise.all([
      db.models.Player.find({}).lean(),
      db.models.TeamRegistration.find({}).lean()
    ]);
    const playerMap = {};
    (players || []).forEach(p => { playerMap[p.id] = p; });
    (teamRegs || []).forEach(tr => {
      (tr.players || []).forEach((p, idx) => {
        const pId = p.id || (p._id ? p._id.toString() : `${tr.id}-P${idx + 1}`);
        if (!playerMap[pId]) {
          playerMap[pId] = {
            id: pId,
            name: p.name,
            role: p.role || 'BATTER',
            jersey_number: p.jersey_number || (idx + 1),
            team_id: tr.id
          };
        }
      });
    });
    return playerMap;
  }

  /**
   * Formats official cricket dismissal string
   */
  buildDismissalText(wicketType, bowlerName, fielderName) {
    switch (wicketType) {
      case 'BOWLED':
        return `b ${bowlerName}`;
      case 'CAUGHT':
        return fielderName ? `c ${fielderName} b ${bowlerName}` : `c & b ${bowlerName}`;
      case 'CAUGHT_BEHIND':
        return fielderName ? `c †${fielderName} b ${bowlerName}` : `c †Keeper b ${bowlerName}`;
      case 'CAUGHT_AND_BOWLED':
        return `c & b ${bowlerName}`;
      case 'LBW':
        return `lbw b ${bowlerName}`;
      case 'RUN_OUT':
        return fielderName ? `run out (${fielderName})` : 'run out';
      case 'STUMPED':
        return fielderName ? `st †${fielderName} b ${bowlerName}` : `st †Keeper b ${bowlerName}`;
      case 'HIT_WICKET':
        return `hit wicket b ${bowlerName}`;
      case 'RETIRED_OUT':
        return 'retired out';
      default:
        return wicketType ? wicketType.toLowerCase() : 'out';
    }
  }

  /**
   * Generates realistic rule-based cricket commentary
   */
  generateCommentary(strikerName, bowlerName, runsBatter, runsExtras, extraType, wicket, wicketType, fieldingPosition, fielderName, dismissedName = null) {
    const posText = fieldingPosition ? ` towards ${fieldingPosition}` : '';
    const fielderText = fielderName ? ` (${fielderName})` : '';
    const victim = dismissedName || strikerName;

    if (wicket) {
      switch (wicketType) {
        case 'BOWLED': return `OUT! Clean bowled! ${bowlerName} rattles the timber! ${victim} has to walk.`;
        case 'CAUGHT': return `OUT! Caught! ${victim} slices it in the air${posText} and taken cleanly by ${fielderName || 'the fielder'}! Breakthrough for ${bowlerName}!`;
        case 'CAUGHT_BEHIND': return `OUT! Edged and taken! Wicketkeeper ${fielderName || 'behind the stumps'} takes a clean catch! ${victim} departs off ${bowlerName}!`;
        case 'CAUGHT_AND_BOWLED': return `OUT! Caught & Bowled! Sensational reflex return catch by ${bowlerName}! ${victim} is out!`;
        case 'LBW': return `OUT! Plumb in front! Huge appeal and the umpire raises the finger. LBW given! ${victim} departs.`;
        case 'RUN_OUT': return `OUT! RUN OUT! Direct hit${posText}${fielderText}! ${victim} is caught well short of the crease!`;
        case 'STUMPED': return `OUT! Stumped! ${victim} dances down the track, beaten in the flight by ${bowlerName}, keeper whips off the bails!`;
        case 'HIT_WICKET': return `OUT! Hit wicket! ${victim} accidentally dislodges the bails while playing the stroke!`;
        case 'RETIRED_OUT': return `${victim} has retired out and returns to the pavilion.`;
        default: return `OUT! ${victim} dismissed (${wicketType || 'Wicket'}).`;
      }
    }

    if (extraType === 'WIDE') {
      const extraRuns = runsExtras > 1 ? ` plus ${runsExtras - 1} extra runs` : '';
      return `Wide ball signaled by the umpire. 1 extra run${extraRuns}.`;
    }
    if (extraType === 'NO_BALL') {
      const batText = runsBatter > 0 ? ` and ${strikerName} scores ${runsBatter} runs` : '';
      return `No ball! Bowler oversteps. 1 extra${batText}. Free hit coming up.`;
    }
    if (extraType === 'BYE') {
      return `${runsExtras} bye${runsExtras > 1 ? 's' : ''} signaled as the ball beats batter and wicketkeeper.`;
    }
    if (extraType === 'LEG_BYE') {
      return `${runsExtras} leg bye${runsExtras > 1 ? 's' : ''} taken after deflecting off the pads${posText}.`;
    }

    if (runsBatter === 6) {
      return `SIX! Magnificent stroke by ${strikerName}! Clean connection over the boundary${posText}!`;
    }
    if (runsBatter === 4) {
      return `FOUR! Beautifully timed drive by ${strikerName}! Pierces the infield${posText} and races away to the fence!`;
    }
    if (runsBatter === 3) {
      return `3 runs. Excellent placement${posText} and great running between the wickets.`;
    }
    if (runsBatter === 2) {
      return `2 runs. Worked into the gap${posText}, easy double taken.`;
    }
    if (runsBatter === 1) {
      return `1 run. ${strikerName} rotates the strike with a push${posText}.`;
    }
    return `Dot ball. Good bowling by ${bowlerName}, solid defense${posText}.`;
  }

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

    // 2. Fetch Active Innings
    let innings = await db.models.Innings.findOne({ match_id: matchId, is_completed: { $ne: true }, status: { $ne: "COMPLETED" } }).sort({ innings_number: -1 });
    if (!innings) {
      // Check if 1st innings was completed and 2nd innings needs to be started
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
      fielderId = null,
      fielderName = null,
      reason = null,
      note = null
    } = deliveryData;

    // Delivery legality: Wide & No Ball are illegal deliveries
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

    // Player Names for Commentary & Scorecard
    const playerMap = await this.getFullPlayerMap();

    let activeStrikerId = strikerId || innings.current_striker_id;
    let activeNonStrikerId = nonStrikerId || innings.current_non_striker_id;
    let activeBowlerId = bowlerId || innings.current_bowler_id;

    if (!activeStrikerId || !activeNonStrikerId || !activeBowlerId) {
      try {
        const scorerService = require('./scorerService');
        const battingSquad = await scorerService.getSquadForTeam(innings.batting_team_id);
        const bowlingSquad = await scorerService.getSquadForTeam(innings.bowling_team_id);
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
    const actualFielderName = fielderName || (fielderId && playerMap[fielderId]?.name) || null;

    const dismissalText = wicket ? this.buildDismissalText(wicketType, bowlerName, actualFielderName) : null;

    let commentary = this.generateCommentary(
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

    const runReason = (reason || note || deliveryData.customReason || '').trim();
    if (runReason) {
      commentary = `${commentary} [${runReason}]`;
    }

    const replacementId = deliveryData.replacementBatterId || deliveryData.nextBatterId;

    // 3. Create Delivery Document in MongoDB
    const deliveryId = 'DEL-' + Date.now() + '-' + String(++deliverySequence).padStart(6, '0');
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
      fielder_id: fielderId,
      fielder_name: actualFielderName,
      commentary,
      created_by: scorerId || 'SCR-101',
      timestamp: new Date()
    });

    // 4. Update Innings Document in MongoDB
    innings.total_runs += totalRuns;
    if (wicket) innings.wickets += 1;
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

    // 5. Strike Rotation Logic
    let nextStriker = activeStrikerId;
    let nextNonStriker = activeNonStrikerId;

    if (wicket && replacementId) {
      if (dismissedPlayerId && dismissedPlayerId === activeNonStrikerId) {
        nextNonStriker = replacementId;
      } else {
        nextStriker = replacementId;
      }
    }

    const runsThatRotate = (extraType === 'NONE' || extraType === 'NO_BALL') 
      ? Number(runsBatter) 
      : ((extraType === 'BYE' || extraType === 'LEG_BYE') ? Number(runsExtras) : 0);

    const isOdd = runsThatRotate % 2 !== 0;

    if (isOdd) {
      const temp = nextStriker;
      nextStriker = nextNonStriker;
      nextNonStriker = temp;
    }

    if (isOverFinished) {
      // Rotate strike at the end of the over
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

    await innings.save();

    // 6. Update or Create Batter records in MongoDB
    // 6a. Striker Batter record
    let batter = await db.models.InningsBatter.findOne({ innings_id: innings.id, player_id: activeStrikerId });
    if (!batter) {
      batter = new db.models.InningsBatter({
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

    if (wicket && (!dismissedPlayerId || dismissedPlayerId === activeStrikerId)) {
      batter.is_out = true;
      batter.dismissal_type = wicketType || 'BOWLED';
      batter.dismissal_text = dismissalText || 'out';
      batter.bowler_id = (wicketType === 'RUN_OUT' || wicketType === 'RETIRED_OUT') ? null : activeBowlerId;
      batter.fielder_id = fielderId || null;
    }
    await batter.save();

    // 6b. Non-striker Batter record
    if (activeNonStrikerId && activeNonStrikerId !== activeStrikerId) {
      let nonStrikerBatter = await db.models.InningsBatter.findOne({ innings_id: innings.id, player_id: activeNonStrikerId });
      if (!nonStrikerBatter) {
        nonStrikerBatter = new db.models.InningsBatter({
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
      }

      if (wicket && dismissedPlayerId === activeNonStrikerId) {
        nonStrikerBatter.is_out = true;
        nonStrikerBatter.dismissal_type = wicketType || 'RUN_OUT';
        nonStrikerBatter.dismissal_text = dismissalText || 'run out';
        nonStrikerBatter.bowler_id = (wicketType === 'RUN_OUT' || wicketType === 'RETIRED_OUT') ? null : activeBowlerId;
        nonStrikerBatter.fielder_id = fielderId || null;
      }
      await nonStrikerBatter.save();
    }

    // 6c. Initialize replacement incoming batter if provided
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

    // 7. Update or Create Bowler record in MongoDB
    let bowler = await db.models.InningsBowler.findOne({ innings_id: innings.id, player_id: activeBowlerId });
    if (!bowler) {
      bowler = new db.models.InningsBowler({
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
    if (wicket && wicketType !== 'RUN_OUT' && wicketType !== 'RETIRED_OUT') {
      bowler.wickets += 1;
    }
    if (extraType === 'WIDE') bowler.wides += Number(runsExtras);
    if (extraType === 'NO_BALL') bowler.no_balls += Number(runsExtras);

    const totalBowlerOvers = bowler.overs + (bowler.balls / 6);
    bowler.economy = totalBowlerOvers > 0 ? parseFloat((bowler.runs_conceded / totalBowlerOvers).toFixed(2)) : 0.00;
    await bowler.save();

    // 8. Check match completion / target chasing
    let isMatchCompleted = false;
    if (innings.innings_number === 2 && innings.target && innings.total_runs >= innings.target) {
      match.status = 'COMPLETED';
      isMatchCompleted = true;
      const winnerTeam = await db.models.Team.findOne({ id: innings.batting_team_id }).lean();
      const wicketsRemaining = 10 - innings.wickets;
      match.result_summary = `${winnerTeam?.name || 'Chasing Team'} won by ${wicketsRemaining} wicket${wicketsRemaining > 1 ? 's' : ''}`;
      innings.is_completed = true;
      innings.is_over_complete = false;
      await match.save();
      await innings.save();
    } else if (innings.wickets >= 10 || (match.overs_per_side && overNumber >= match.overs_per_side)) {
      if (innings.innings_number === 1) {
        innings.is_completed = true;
        innings.is_over_complete = false;
        match.status = 'INNINGS_BREAK';
        await innings.save();

        // Prepare 2nd Innings in DB immediately with target
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
        } else if (runsDiff === 0) {
          match.result_summary = 'Match Tied';
        }
        await innings.save();
        await match.save();
      }
    }

    // 9. Real-time Socket.IO Broadcast
    try {
      socketService.emitScoreUpdate(matchId, {
        matchId,
        score: `${innings.total_runs}/${innings.wickets}`,
        overs: `${innings.overs}.${innings.balls}`,
        isOverComplete: isOverFinished,
        lastDelivery: {
          ball: `${overNumber}.${ballNumber}`,
          runs: Number(runsBatter),
          commentary
        }
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
      strikerId: nextStriker,
      nonStrikerId: nextNonStriker,
      bowlerId: activeBowlerId,
      data: {
        deliveryId,
        score: `${innings.total_runs}/${innings.wickets}`,
        overs: `${innings.overs}.${innings.balls}`,
        totalRuns: innings.total_runs,
        wickets: innings.wickets,
        strikerId: nextStriker,
        nonStrikerId: nextNonStriker,
        bowlerId: activeBowlerId,
        isOverComplete: isOverFinished,
        isMatchCompleted,
        lastDelivery: {
          id: deliveryId,
          runsBatter: Number(runsBatter),
          runsExtras: Number(runsExtras),
          totalRuns,
          extraType,
          boundaryType,
          wicket: Boolean(wicket),
          isLegalDelivery: isLegal,
          commentary
        }
      }
    };
  }

  /**
   * End Over & Rotate to Next Bowler
   */
  async endOver(matchId, nextBowlerId) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: `Match '${matchId}' not found.` };
    if (match.status !== 'LIVE') {
      throw { status: 400, message: `Match is not LIVE (current status: ${match.status}). Cannot change bowler.` };
    }

    const innings = await db.models.Innings.findOne({ match_id: matchId, is_completed: false }).sort({ innings_number: -1 });
    if (!innings) throw { status: 400, message: 'No active innings found for this match.' };

    if (!nextBowlerId) {
      throw { status: 400, message: 'Next bowler ID is required.' };
    }

    // Bowler cannot bowl consecutive overs
    if (innings.previous_bowler_id && nextBowlerId === innings.previous_bowler_id) {
      throw { status: 400, message: 'Bowler cannot bowl consecutive overs. Please select a different bowler.' };
    }

    // Validate next bowler belongs to bowling team or match squad
    const playerMap = await this.getFullPlayerMap();
    let bowlerPlayer = playerMap[nextBowlerId];
    if (!bowlerPlayer) {
      bowlerPlayer = await db.models.Player.findOne({ id: nextBowlerId }).lean();
    }
    const bowlerName = bowlerPlayer ? bowlerPlayer.name : nextBowlerId;

    innings.current_bowler_id = nextBowlerId;
    innings.is_over_complete = false;
    await innings.save();

    // Ensure InningsBowler record exists
    let bowlerStats = await db.models.InningsBowler.findOne({ innings_id: innings.id, player_id: nextBowlerId });
    if (!bowlerStats) {
      bowlerStats = await db.models.InningsBowler.create({
        id: `BWL-${innings.id}-${nextBowlerId}`,
        innings_id: innings.id,
        player_id: nextBowlerId,
        overs: 0,
        balls: 0,
        maidens: 0,
        runs_conceded: 0,
        wickets: 0,
        economy: 0
      });
    }

    // Socket.IO update
    try {
      socketService.emitScoreUpdate(matchId, {
        matchId,
        event: 'OVER_COMPLETED',
        nextBowlerId,
        bowlerName: bowlerName,
        currentOvers: `${innings.overs}.${innings.balls}`,
        isOverComplete: false
      });
    } catch (e) {}

    return {
      success: true,
      message: `Over completed. ${bowlerName} will bowl the next over.`,
      matchId,
      nextBowlerId,
      currentBowlerId: nextBowlerId,
      bowlerName: bowlerName,
      currentBowlerName: bowlerName,
      currentOvers: `${innings.overs}.${innings.balls}`,
      isOverComplete: false,
      data: {
        nextBowlerId,
        currentBowlerId: nextBowlerId,
        bowlerName: bowlerName,
        currentBowlerName: bowlerName,
        currentOvers: `${innings.overs}.${innings.balls}`,
        isOverComplete: false
      }
    };
  }

  /**
   * Edit Delivery
   */
  async editDelivery(matchId, deliveryId, updateData, scorerId) {
    await db.initDb();
    const delivery = await db.models.Delivery.findOne({ id: deliveryId });
    if (!delivery) throw { status: 404, message: `Delivery '${deliveryId}' not found.` };

    const innings = await db.models.Innings.findOne({ id: delivery.innings_id });
    if (innings) {
      innings.total_runs -= delivery.total_runs;
      if (delivery.wicket) innings.wickets = Math.max(0, innings.wickets - 1);

      const newRuns = typeof updateData.runsBatter === 'number' ? updateData.runsBatter : delivery.runs_batter;
      const newExtras = typeof updateData.runsExtras === 'number' ? updateData.runsExtras : delivery.runs_extras;
      const newTotal = newRuns + newExtras;
      const newWicket = typeof updateData.wicket === 'boolean' ? updateData.wicket : delivery.wicket;

      delivery.runs_batter = newRuns;
      delivery.runs_extras = newExtras;
      delivery.total_runs = newTotal;
      delivery.wicket = newWicket;
      await delivery.save();

      innings.total_runs += newTotal;
      if (newWicket) innings.wickets += 1;
      await innings.save();
    }

    return {
      success: true,
      message: 'Delivery edited successfully.',
      deliveryId,
      data: { action: 'EDIT_DELIVERY', deliveryId }
    };
  }

  /**
   * Undo Last Delivery
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
        innings.extras.wides = Math.max(0, innings.extras.wides - lastDelivery.runs_extras);
        innings.extras.total = Math.max(0, innings.extras.total - lastDelivery.runs_extras);
      }
      if (lastDelivery.extra_type === 'NO_BALL' && innings.extras) {
        innings.extras.no_balls = Math.max(0, innings.extras.no_balls - lastDelivery.runs_extras);
        innings.extras.total = Math.max(0, innings.extras.total - lastDelivery.runs_extras);
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
      const bowlerRuns = lastDelivery.runs_batter + (lastDelivery.extra_type === 'WIDE' || lastDelivery.extra_type === 'NO_BALL' ? lastDelivery.runs_extras : 0);
      bowler.runs_conceded = Math.max(0, bowler.runs_conceded - bowlerRuns);
      if (lastDelivery.wicket && lastDelivery.wicket_type !== 'RUN_OUT') {
        bowler.wickets = Math.max(0, bowler.wickets - 1);
      }
      await bowler.save();
    }

    // Delete the delivery
    await db.models.Delivery.deleteOne({ id: lastDelivery.id });

    // Emit Socket Update
    try {
      socketService.emitScoreUpdate(matchId, {
        matchId,
        score: `${innings ? innings.total_runs : 0}/${innings ? innings.wickets : 0}`,
        overs: `${innings ? innings.overs : 0}.${innings ? innings.balls : 0}`,
        undoneDeliveryId: lastDelivery.id
      });
    } catch (e) {}

    return {
      success: true,
      message: 'Last delivery successfully undone.',
      undoneDeliveryId: lastDelivery.id,
      score: `${innings ? innings.total_runs : 0}/${innings ? innings.wickets : 0}`,
      overs: `${innings ? innings.overs : 0}.${innings ? innings.balls : 0}`,
      data: {
        undoneDeliveryId: lastDelivery.id,
        score: `${innings ? innings.total_runs : 0}/${innings ? innings.wickets : 0}`,
        overs: `${innings ? innings.overs : 0}.${innings ? innings.balls : 0}`
      }
    };
  }

  /**
   * End Innings
   */
  async endInnings(matchId) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: 'Match not found' };

    const currentInnings = await db.models.Innings.findOne({ match_id: matchId, is_completed: false }).sort({ innings_number: -1 });
    if (!currentInnings) throw { status: 400, message: 'No active innings to end.' };

    currentInnings.is_completed = true;
    currentInnings.is_over_complete = false;
    await currentInnings.save();

    if (currentInnings.innings_number === 1) {
      // Prepare 2nd Innings
      const target = currentInnings.total_runs + 1;
      const inn2Id = `INN-${matchId}-2`;
      let inn2 = await db.models.Innings.findOne({ id: inn2Id });
      if (!inn2) {
        inn2 = await db.models.Innings.create({
          id: inn2Id,
          match_id: matchId,
          innings_number: 2,
          batting_team_id: currentInnings.bowling_team_id,
          bowling_team_id: currentInnings.batting_team_id,
          total_runs: 0,
          wickets: 0,
          overs: 0,
          balls: 0,
          target,
          is_completed: false,
          is_over_complete: false,
          extras: { wides: 0, no_balls: 0, byes: 0, leg_byes: 0, total: 0 }
        });
      } else {
        inn2.target = target;
        inn2.is_completed = false;
        inn2.is_over_complete = false;
        await inn2.save();
      }

      match.current_innings_number = 2;
      match.status = 'INNINGS_BREAK';
      await match.save();

      return {
        success: true,
        message: '1st Innings ended. 2nd Innings target set.',
        target,
        matchStatus: 'INNINGS_BREAK',
        data: {
          target,
          matchStatus: 'INNINGS_BREAK'
        }
      };
    } else {
      // 2nd innings ended -> Conclude Match
      match.status = 'COMPLETED';
      const inn1 = await db.models.Innings.findOne({ match_id: matchId, innings_number: 1 }).lean();
      const diff = (inn1?.total_runs || 0) - currentInnings.total_runs;
      if (diff > 0) {
        const team1 = await db.models.Team.findOne({ id: inn1.batting_team_id }).lean();
        match.result_summary = `${team1?.name || 'Team 1'} won by ${diff} runs`;
      } else if (diff < 0) {
        const team2 = await db.models.Team.findOne({ id: currentInnings.batting_team_id }).lean();
        match.result_summary = `${team2?.name || 'Team 2'} won by ${10 - currentInnings.wickets} wickets`;
      } else {
        match.result_summary = 'Match Tied';
      }
      await match.save();

      return {
        success: true,
        message: 'Match concluded.',
        result: match.result_summary,
        matchStatus: 'COMPLETED',
        data: {
          result: match.result_summary,
          status: 'COMPLETED',
          matchStatus: 'COMPLETED'
        }
      };
    }
  }

  /**
   * Update Match Status
   */
  async updateMatchStatus(matchId, status) {
    await db.initDb();
    const normalized = String(status).toUpperCase();
    const validStatuses = ['SCHEDULED', 'LIVE', 'INNINGS_BREAK', 'COMPLETED', 'ABANDONED'];
    if (!validStatuses.includes(normalized)) {
      throw { status: 400, message: `Invalid match status. Must be one of: ${validStatuses.join(', ')}` };
    }

    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: 'Match not found.' };

    // When moving to LIVE, if 1st innings is completed, activate 2nd innings
    if (normalized === 'LIVE') {
      const inn1 = await db.models.Innings.findOne({ match_id: matchId, innings_number: 1 });
      if (inn1 && inn1.is_completed) {
        const target = (inn1.total_runs || 0) + 1;
        const inn2Id = `INN-${matchId}-2`;
        let inn2 = await db.models.Innings.findOne({ id: inn2Id });
        if (!inn2) {
          inn2 = await db.models.Innings.create({
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
          inn2.target = target;
          inn2.is_completed = false;
          inn2.status = 'LIVE';
          inn2.is_over_complete = false;
          await inn2.save();
        }
        match.current_innings_number = 2;
        match.target_runs = target;
      }
    }

    match.status = normalized;
    await match.save();

    return {
      success: true,
      message: `Match status updated to ${normalized}`,
      matchId,
      status: normalized,
      data: {
        matchId,
        status: normalized
      }
    };
  }

  /**
   * Start 2nd / Next Innings
   */
  async startNextInnings(matchId) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: 'Match not found' };

    const inn1 = await db.models.Innings.findOne({ match_id: matchId, innings_number: 1 });
    if (!inn1) throw { status: 400, message: 'First innings not found.' };

    inn1.is_completed = true;
    await inn1.save();

    const target = (inn1.total_runs || 0) + 1;
    const inn2Id = `INN-${matchId}-2`;
    let inn2 = await db.models.Innings.findOne({ id: inn2Id });
    if (!inn2) {
      inn2 = await db.models.Innings.create({
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
      inn2.target = target;
      inn2.is_completed = false;
      inn2.status = 'LIVE';
      inn2.is_over_complete = false;
      await inn2.save();
    }

    match.status = 'LIVE';
    match.current_innings_number = 2;
    match.target_runs = target;
    await match.save();

    return {
      success: true,
      message: '2nd Innings started successfully.',
      matchId,
      status: 'LIVE',
      currentInningsNumber: 2,
      target
    };
  }

  /**
   * Conclude / End Match manually
   */
  async endMatch(matchId, payload = {}) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: 'Match not found.' };

    match.status = 'COMPLETED';
    if (payload.resultText || payload.result) {
      match.result_summary = payload.resultText || payload.result;
    }
    if (payload.playerOfMatch) {
      match.player_of_match = payload.playerOfMatch;
    }
    await match.save();

    return {
      success: true,
      message: 'Match officially ended.',
      matchId,
      status: 'COMPLETED',
      result: match.result_summary,
      data: {
        status: 'COMPLETED',
        matchId,
        result: match.result_summary
      }
    };
  }

  /**
   * Swap strike between striker and non-striker
   */
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

    // Initialize InningsBatter record if not present
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

  /**
   * Change / Substitute Active Bowler
   */
  async changeBowler(matchId, { newBowlerId, newBowlerName } = {}) {
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

    // Initialize InningsBowler record if not present
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

    innings.current_bowler_id = resolvedId;
    innings.is_over_complete = false;
    await innings.save();

    // Socket.IO update
    try {
      socketService.emitScoreUpdate(matchId, {
        matchId,
        event: 'BOWLER_CHANGED',
        bowlerId: resolvedId,
        bowlerName: finalBowlerName || resolvedId
      });
    } catch (e) {}

    return {
      success: true,
      message: `Bowler changed to ${finalBowlerName || resolvedId}`,
      currentBowlerId: innings.current_bowler_id,
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

  /**
   * Revised Overs & Revised Target
   * Scorer updates total overs and/or revised target (e.g. rain interruption / DLS)
   */
  async setRevisedOvers(matchId, payload = {}) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: 'Match not found.' };

    const totalOvers = payload.totalOvers ? parseInt(payload.totalOvers, 10) : null;
    const revisedTarget = payload.revisedTarget ? parseInt(payload.revisedTarget, 10) : null;
    const comments = payload.comments || '';

    if (totalOvers && totalOvers > 0) {
      match.revised_overs = totalOvers;
    }
    if (revisedTarget && revisedTarget > 0) {
      match.revised_target = revisedTarget;
    }
    if (comments) {
      match.revised_comments = comments;
    }
    await match.save();

    // Update active innings
    const currentInnings = await db.models.Innings.findOne({ match_id: matchId, is_completed: false }).sort({ innings_number: -1 });
    if (currentInnings) {
      if (totalOvers) currentInnings.revised_overs = totalOvers;
      if (revisedTarget && currentInnings.innings_number === 2) {
        currentInnings.target = revisedTarget;
      }
      await currentInnings.save();
    }

    try {
      broadcastScoreUpdate(matchId, {
        action: 'REVISED_OVERS',
        revisedOvers: match.revised_overs,
        revisedTarget: match.revised_target,
        comments: match.revised_comments
      });
    } catch (_) {}

    return {
      success: true,
      message: 'Revised overs/target successfully updated.',
      data: {
        revisedOvers: match.revised_overs,
        revisedTarget: match.revised_target,
        comments: match.revised_comments
      }
    };
  }

  /**
   * Playing XI Edit
   * Rule: Applicable ONLY for players who have not batted or bowled a single delivery
   */
  async editPlayingXI(matchId, payload = {}) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: 'Match not found.' };

    const { teamId, playingXI } = payload;
    if (!teamId || !Array.isArray(playingXI)) {
      throw { status: 400, message: 'teamId and playingXI array are required.' };
    }

    // Determine current playing XI
    const isTeamA = teamId === match.team_a_id;
    const currentPlayingXI = isTeamA ? (match.team_a_playing_xi || []) : (match.team_b_playing_xi || []);

    // Find players who were removed from current Playing XI
    const removedPlayerIds = currentPlayingXI.filter(pid => !playingXI.includes(pid));

    if (removedPlayerIds.length > 0) {
      // Find all innings for this match
      const inningsList = await db.models.Innings.find({ match_id: matchId }).lean();
      const inningsIds = inningsList.map(inn => inn.id);

      // Check if any removed player has batted (balls > 0 or runs > 0)
      const batted = await db.models.InningsBatter.find({
        innings_id: { $in: inningsIds },
        player_id: { $in: removedPlayerIds },
        $or: [{ balls: { $gt: 0 } }, { runs: { $gt: 0 } }, { is_out: true }]
      }).lean();

      if (batted.length > 0) {
        throw {
          status: 400,
          message: `Cannot replace player who has already batted in the match.`
        };
      }

      // Check if any removed player has bowled (overs > 0 or balls > 0)
      const bowled = await db.models.InningsBowler.find({
        innings_id: { $in: inningsIds },
        player_id: { $in: removedPlayerIds },
        $or: [{ balls: { $gt: 0 } }, { overs: { $gt: 0 } }]
      }).lean();

      if (bowled.length > 0) {
        throw {
          status: 400,
          message: `Cannot replace player who has already bowled in the match.`
        };
      }
    }

    // Save updated Playing XI
    if (isTeamA) {
      match.team_a_playing_xi = playingXI;
    } else {
      match.team_b_playing_xi = playingXI;
    }
    await match.save();

    try {
      broadcastScoreUpdate(matchId, {
        action: 'PLAYING_XI_UPDATED',
        teamId,
        playingXI
      });
    } catch (_) {}

    return {
      success: true,
      message: 'Playing XI successfully updated.',
      teamId,
      playingXI
    };
  }

  /**
   * Start T20 Super Over
   */
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

  /**
   * Slide Menu: Add or Update Break (Lunch, Tea, Drinks, Rain, Bad Light, etc.)
   */
  async addBreak(matchId, breakData = {}) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: 'Match not found.' };

    if (!Array.isArray(match.breaks)) match.breaks = [];
    match.breaks.push({
      type: breakData.type || 'Drinks',
      startTime: breakData.startTime || new Date().toLocaleTimeString(),
      endTime: breakData.endTime || '',
      duration: breakData.duration || '5',
      comments: breakData.comments || '',
      excludeBatsmanTime: Boolean(breakData.excludeBatsmanTime),
      created_at: new Date()
    });
    await match.save();

    try {
      broadcastScoreUpdate(matchId, { action: 'BREAK_ADDED', breaks: match.breaks });
    } catch (_) {}

    return {
      success: true,
      message: 'Break successfully recorded.',
      data: match.breaks
    };
  }

  /**
   * Slide Menu: Add or End Session (Lunch, Tea, End of Day)
   */
  async addSession(matchId, sessionData = {}) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: 'Match not found.' };

    if (!Array.isArray(match.sessions)) match.sessions = [];
    match.sessions.push({
      dayNo: sessionData.dayNo || 1,
      type: sessionData.type || 'Lunch',
      startInningsNo: sessionData.startInningsNo || 1,
      endInningsNo: sessionData.endInningsNo || 1,
      startOver: sessionData.startOver || '0.0',
      endOver: sessionData.endOver || '0.0',
      startTime: sessionData.startTime || new Date().toLocaleTimeString(),
      endTime: sessionData.endTime || '',
      duration: sessionData.duration || '40',
      created_at: new Date()
    });
    await match.save();

    return {
      success: true,
      message: 'Session successfully recorded.',
      data: match.sessions
    };
  }

  /**
   * Slide Menu: End Day
   */
  async addEndDay(matchId, endDayData = {}) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: 'Match not found.' };

    if (!Array.isArray(match.end_days)) match.end_days = [];
    match.end_days.push({
      dayNo: endDayData.dayNo || 1,
      startInningsNo: endDayData.startInningsNo || 1,
      endInningsNo: endDayData.endInningsNo || 1,
      startOver: endDayData.startOver || '0.0',
      endOver: endDayData.endOver || '0.0',
      startTime: endDayData.startTime || '09:30 AM',
      endTime: endDayData.endTime || new Date().toLocaleTimeString(),
      duration: endDayData.duration || '360',
      comments: endDayData.comments || 'End of Day',
      created_at: new Date()
    });
    await match.save();

    return {
      success: true,
      message: 'End of Day recorded successfully.',
      data: match.end_days
    };
  }

  /**
   * Slide Menu: Declare Innings
   */
  async declareInnings(matchId) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: 'Match not found.' };

    const currentInnings = await db.models.Innings.findOne({ match_id: matchId, is_completed: false }).sort({ innings_number: -1 });
    if (!currentInnings) throw { status: 400, message: 'No active innings to declare.' };

    currentInnings.is_declared = true;
    currentInnings.is_completed = true;
    await currentInnings.save();

    // Trigger endInnings workflow
    return this.endInnings(matchId);
  }

  /**
   * Slide Menu: Match Start & End Time
   */
  async updateMatchTimes(matchId, timesData = {}) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: 'Match not found.' };

    if (timesData.startTime) match.match_start_time = timesData.startTime;
    if (timesData.endTime) match.match_end_time = timesData.endTime;
    if (timesData.date) match.match_date = timesData.date;
    await match.save();

    return {
      success: true,
      message: 'Match start/end times updated successfully.',
      startTime: match.match_start_time,
      endTime: match.match_end_time
    };
  }

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

    // Award points as extras to current innings
    currentInnings.total_runs += points;
    if (!currentInnings.extras) {
      currentInnings.extras = { wides: 0, no_balls: 0, byes: 0, leg_byes: 0, total: 0 };
    }
    currentInnings.extras.total = (currentInnings.extras.total || 0) + points;
    await currentInnings.save();

    // Create a penalty Delivery record
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

    // Create Official Team Inbox / Notice Notification in MongoDB
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

    // Replace the batter at crease
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
   * Slide Menu: Change Ball
   */
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

  /**
   * Slide Menu: Umpire Assessment
   */
  async saveUmpireAssessment(matchId, assessmentData = {}) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: 'Match not found.' };

    match.umpire_assessment = {
      umpire1: assessmentData.umpire1 || '',
      rating1: assessmentData.rating1 || 5,
      umpire2: assessmentData.umpire2 || '',
      rating2: assessmentData.rating2 || 5,
      pitchReport: assessmentData.pitchReport || 'Good sporting pitch',
      comments: assessmentData.comments || ''
    };
    await match.save();

    return {
      success: true,
      message: 'Umpire assessment saved successfully.',
      data: match.umpire_assessment
    };
  }

  /**
   * Slide Menu: Change Team (Before 1st delivery of match)
   */
  async changeTeamBeforeStart(matchId, payload = {}) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: 'Match not found.' };

    const totalDeliveries = await db.models.Delivery.countDocuments({ match_id: matchId });
    if (totalDeliveries > 0) {
      throw { status: 400, message: 'Change team is applicable only before the first ball of the match is started in the Scoring App.' };
    }

    const { battingTeamId, strikerId, nonStrikerId, bowlerId } = payload;
    const currentInnings = await db.models.Innings.findOne({ match_id: matchId, innings_number: 1 });
    if (!currentInnings) throw { status: 400, message: 'First innings record not found.' };

    if (battingTeamId) {
      const bowlingTeamId = battingTeamId === match.team_a_id ? match.team_b_id : match.team_a_id;
      currentInnings.batting_team_id = battingTeamId;
      currentInnings.bowling_team_id = bowlingTeamId;
    }
    if (strikerId) currentInnings.current_striker_id = strikerId;
    if (nonStrikerId) currentInnings.current_non_striker_id = nonStrikerId;
    if (bowlerId) currentInnings.current_bowler_id = bowlerId;

    await currentInnings.save();

    return {
      success: true,
      message: 'Teams and opening players updated successfully before match start.',
      battingTeamId: currentInnings.batting_team_id,
      bowlingTeamId: currentInnings.bowling_team_id,
      strikerId: currentInnings.current_striker_id,
      nonStrikerId: currentInnings.current_non_striker_id,
      bowlerId: currentInnings.current_bowler_id
    };
  }
}

module.exports = new ScoringEngine();
