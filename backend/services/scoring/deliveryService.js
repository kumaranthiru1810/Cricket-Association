/**
 * services/scoring/deliveryService.js
 * Handles ball-by-ball delivery processing, strike swapping, bowler changes, and ball changes.
 */

const db = require('../../config/db');
const socketService = require('../socketService');
const { invalidateCache } = require('../../middleware/cacheMiddleware');
const {
  broadcastScoreUpdate,
  getMaxWicketsForInnings,
  computeAutoBonusWinner,
  buildDismissalText,
  generateCommentary
} = require('./deliveryHelpers');

let deliverySequence = 10000;

// Per-match player cache: matchId -> { expiresAt: number, players: Map<string, { id, name, role }> }
const MATCH_PLAYER_CACHE_TTL_MS = 30 * 60 * 1000;
const matchPlayerCache = new Map();

// Recent idempotency response cache: `${matchId}:${clientDeliveryId}` -> { expiresAt, response }
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;
const idempotencyCache = new Map();

function invalidateMatchPlayerCache(matchId) {
  if (matchId) matchPlayerCache.delete(matchId);
  else matchPlayerCache.clear();
}

async function getMatchPlayersByIds(matchId, ids) {
  const now = Date.now();
  let entry = matchPlayerCache.get(matchId);
  if (!entry || entry.expiresAt <= now) {
    entry = { expiresAt: now + MATCH_PLAYER_CACHE_TTL_MS, players: new Map() };
    matchPlayerCache.set(matchId, entry);
  }
  const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
  const missing = uniqueIds.filter((id) => !entry.players.has(id));
  if (missing.length > 0) {
    const docs = await db.models.Player.find({ id: { $in: missing } }, 'id name role').lean();
    for (const d of docs) {
      entry.players.set(d.id, { id: d.id, name: d.name, role: d.role });
    }
  }
  const result = {};
  for (const id of uniqueIds) {
    if (entry.players.has(id)) result[id] = entry.players.get(id);
  }
  return result;
}

const hrMs = (start) => Number(process.hrtime.bigint() - start) / 1e6;

class DeliveryService {
  /**
   * Records a single delivery in MongoDB (Ball-by-Ball)
   */
  async recordDelivery(matchId, deliveryData, scorerId) {
    const tTotalStart = process.hrtime.bigint();
    const _timings = {};

    if (!db.models || !db.models.Match) {
      await db.initDb();
    }

    // 0. Idempotency check
    const tIdemStart = process.hrtime.bigint();
    const clientDeliveryId = deliveryData.clientDeliveryId ? String(deliveryData.clientDeliveryId) : null;
    if (clientDeliveryId) {
      const cacheKey = `${matchId}:${clientDeliveryId}`;
      const cached = idempotencyCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        _timings.idempotency = hrMs(tIdemStart);
        _timings.total = hrMs(tTotalStart);
        return { ...cached.response, idempotent: true, _timings };
      }
      const existingDel = await db.models.Delivery.findOne(
        { match_id: matchId, client_delivery_id: clientDeliveryId },
        'id total_runs runs_batter runs_extras extra_type is_free_hit boundary_type wicket is_legal_delivery commentary over_number ball_number'
      ).lean();
      if (existingDel) {
        const [mSnap, iSnap] = await Promise.all([
          db.models.Match.findOne({ id: matchId }, 'status').lean(),
          db.models.Innings.findOne({ match_id: matchId }).sort({ innings_number: -1 }).lean()
        ]);
        _timings.idempotency = hrMs(tIdemStart);
        _timings.total = hrMs(tTotalStart);
        return {
          success: true,
          idempotent: true,
          message: 'Delivery already recorded (idempotent replay).',
          deliveryId: existingDel.id,
          score: `${iSnap?.total_runs || 0}/${iSnap?.wickets || 0}`,
          overs: `${iSnap?.overs || 0}.${iSnap?.balls || 0}`,
          commentary: existingDel.commentary || '',
          matchStatus: mSnap?.status || 'LIVE',
          isOverComplete: Boolean(iSnap?.is_over_complete),
          isFreeHit: Boolean(iSnap?.is_free_hit),
          strikerId: iSnap?.current_striker_id || null,
          nonStrikerId: iSnap?.current_non_striker_id || null,
          bowlerId: iSnap?.current_bowler_id || null,
          data: {
            deliveryId: existingDel.id,
            score: `${iSnap?.total_runs || 0}/${iSnap?.wickets || 0}`,
            overs: `${iSnap?.overs || 0}.${iSnap?.balls || 0}`,
            totalRuns: iSnap?.total_runs || 0,
            wickets: iSnap?.wickets || 0,
            isFreeHit: Boolean(iSnap?.is_free_hit),
            strikerId: iSnap?.current_striker_id || null,
            nonStrikerId: iSnap?.current_non_striker_id || null,
            bowlerId: iSnap?.current_bowler_id || null,
            isOverComplete: Boolean(iSnap?.is_over_complete),
            isMatchCompleted: mSnap?.status === 'COMPLETED',
            lastDelivery: {
              id: existingDel.id,
              runsBatter: existingDel.runs_batter,
              runsExtras: existingDel.runs_extras,
              totalRuns: existingDel.total_runs,
              extraType: existingDel.extra_type,
              isFreeHit: existingDel.is_free_hit,
              boundaryType: existingDel.boundary_type,
              wicket: existingDel.wicket,
              isLegalDelivery: existingDel.is_legal_delivery,
              commentary: existingDel.commentary
            }
          },
          _timings
        };
      }
    }
    _timings.idempotency = hrMs(tIdemStart);

    // 1. Parallel Match + Active Innings Read
    const tReadStart = process.hrtime.bigint();
    const [match, activeInnings] = await Promise.all([
      db.models.Match.findOne({ id: matchId }),
      db.models.Innings.findOne({
        match_id: matchId,
        is_completed: { $ne: true },
        status: { $ne: 'COMPLETED' }
      }).sort({ innings_number: -1 })
    ]);

    if (!match) throw { status: 404, message: `Match '${matchId}' not found.` };
    if (match.status === 'SCHEDULED') {
      throw { status: 400, message: 'Match is SCHEDULED. Please perform toss and start match before recording deliveries.' };
    }
    if (match.status === 'COMPLETED') {
      throw { status: 400, message: 'Match is already COMPLETED. Live scoring is disabled.' };
    }
    if (match.status === 'ABANDONED') {
      throw { status: 400, message: 'Match has been ABANDONED. Scoring is disabled.' };
    }

    let innings = activeInnings;
    if (!innings) {
      const inn1 = await db.models.Innings.findOne({ match_id: matchId, innings_number: 1 }).lean();
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
      } else {
        innings = await db.models.Innings.findOne({ match_id: matchId }).sort({ innings_number: -1 });
      }
    }
    if (!innings) {
      throw { status: 400, message: 'No active innings found for this match. Please start the match first.' };
    }

    // State conflict check
    if (deliveryData.expectedOver !== undefined && deliveryData.expectedBall !== undefined) {
      if (innings.overs !== Number(deliveryData.expectedOver) || innings.balls !== Number(deliveryData.expectedBall)) {
        throw {
          status: 409,
          message: `Conflict: Stale delivery state. Expected ${deliveryData.expectedOver}.${deliveryData.expectedBall}, current is ${innings.overs}.${innings.balls}.`
        };
      }
    }
    _timings.read = hrMs(tReadStart);

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

    let activeStrikerId = strikerId || innings.current_striker_id;
    let activeNonStrikerId = nonStrikerId || innings.current_non_striker_id;
    let activeBowlerId = bowlerId || innings.current_bowler_id;

    if (!activeStrikerId || !activeNonStrikerId || !activeBowlerId) {
      try {
        const scorerService = require('../scorerService');
        const [battingSquad, bowlingSquad] = await Promise.all([
          scorerService.getSquadForTeam(innings.batting_team_id, match),
          scorerService.getSquadForTeam(innings.bowling_team_id, match)
        ]);
        if (!activeStrikerId) activeStrikerId = battingSquad[0]?.id || null;
        if (!activeNonStrikerId) activeNonStrikerId = battingSquad.find(p => p.id !== activeStrikerId)?.id || battingSquad[1]?.id || null;
        if (!activeBowlerId) activeBowlerId = bowlingSquad.find(p => p.role === 'BOWLER')?.id || bowlingSquad[0]?.id || null;
      } catch (_e) {
        // Handled by missing-player validation below
      }
      if (!activeStrikerId || !activeNonStrikerId || !activeBowlerId) {
        throw { status: 400, message: 'Striker, non-striker, and bowler must be selected before recording a delivery.' };
      }
    }

    const actualDismissedId = dismissedPlayerId || (wicket ? activeStrikerId : null);
    const replacementId = deliveryData.replacementBatterId || deliveryData.nextBatterId;

    // 2. Parallel Players (cached/projected $in) + Batter/Bowler Stats Read
    const tPlayersStart = process.hrtime.bigint();
    const neededPlayerIds = [
      activeStrikerId,
      activeNonStrikerId,
      activeBowlerId,
      actualDismissedId,
      fielderId,
      replacementId
    ].filter(Boolean);

    const needsNonStrikerStat = Boolean(
      activeNonStrikerId &&
      activeNonStrikerId !== activeStrikerId &&
      (wicket && dismissedPlayerId === activeNonStrikerId)
    );

    const [playerMap, existingStriker, existingNonStriker, existingBowler] = await Promise.all([
      getMatchPlayersByIds(matchId, neededPlayerIds),
      db.models.InningsBatter.findOne({ innings_id: innings.id, player_id: activeStrikerId }),
      needsNonStrikerStat
        ? db.models.InningsBatter.findOne({ innings_id: innings.id, player_id: activeNonStrikerId })
        : Promise.resolve(null),
      db.models.InningsBowler.findOne({ innings_id: innings.id, player_id: activeBowlerId })
    ]);
    _timings.players = hrMs(tPlayersStart);

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
    if (runReason) commentary = `${commentary} [${runReason}]`;

    // Update innings in-memory state
    const wasDeliveryFreeHit = !!innings.is_free_hit;
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
    if (extraType === 'NONE') runsThatRotate = Number(runsBatter) || 0;
    else if (extraType === 'WIDE' || extraType === 'NO_BALL') {
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
    if (deliveryData.rotateStrike !== undefined) isOdd = Boolean(deliveryData.rotateStrike);

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
      let freeHitAll = match.rules_snapshot?.free_hit_on_all_noballs;
      if (freeHitAll === undefined) {
        const tournamentDoc = await db.models.Tournament.findOne({
          $or: [
            ...(match.tournament_id ? [{ id: match.tournament_id }] : []),
            ...(match.tournament_name ? [{ name: match.tournament_name }] : [])
          ]
        }, 'playing_rules.free_hit_on_all_noballs').lean();
        freeHitAll = tournamentDoc?.playing_rules?.free_hit_on_all_noballs;
      }
      const nbReason = String(deliveryData.noBallReason || deliveryData.no_ball_reason || '').toUpperCase();
      nextIsFreeHit = (freeHitAll !== false) || !nbReason || nbReason === 'OVERSTEP';
    } else if (wasDeliveryFreeHit) {
      nextIsFreeHit = extraType === 'WIDE';
    }
    innings.is_free_hit = nextIsFreeHit;

    // In-innings counters for warnings (avoids extra Delivery.countDocuments / find queries!)
    let noBallWarning = null;
    let dangerousBowlingWarning = null;
    const isDangerousBeamer = deliveryData.noBallReason === 'BEAMER' || deliveryData.isDangerousDelivery || deliveryData.remarks?.toLowerCase().includes('beamer');
    if (extraType === 'NO_BALL') {
      const nbMap = { ...(innings.bowler_no_balls || {}) };
      const totalNoBalls = Number(nbMap[activeBowlerId] || 0) + 1;
      nbMap[activeBowlerId] = totalNoBalls;
      innings.bowler_no_balls = nbMap;
      innings.markModified('bowler_no_balls');

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
    }

    let consecutiveWidesWarning = null;
    if (extraType === 'WIDE') {
      const prevWasWide = Boolean(innings.prev_ball_was_wide) && innings.last_wide_over === overNumber;
      const wideCountInOver = (innings.last_wide_over === overNumber ? Number(innings.over_wide_count || 0) : 0) + 1;
      innings.last_wide_over = overNumber;
      innings.over_wide_count = wideCountInOver;
      innings.prev_ball_was_wide = true;
      if (prevWasWide) {
        consecutiveWidesWarning = {
          bowlerId: activeBowlerId,
          bowlerName,
          overNumber: overNumber + 1,
          count: wideCountInOver,
          message: `Bowler ${bowlerName} has bowled ${wideCountInOver} Wides in Over ${overNumber + 1}. Check wide tramlines (MCC Law 22).`
        };
      }
    } else {
      innings.prev_ball_was_wide = false;
    }

    // Prepare Striker update
    const nonBowlerDismissals = ['RUN_OUT', 'RETIRED_OUT', 'RETIRED_HURT', 'OBSTRUCTING_FIELD', 'HIT_BALL_TWICE', 'TIMED_OUT'];
    const batRunsInc = (extraType === 'NONE' || extraType === 'NO_BALL') ? Number(runsBatter) : 0;
    const batFoursInc = (extraType === 'NONE' || extraType === 'NO_BALL') && runsBatter === 4 ? 1 : 0;
    const batSixesInc = (extraType === 'NONE' || extraType === 'NO_BALL') && runsBatter === 6 ? 1 : 0;
    const batBallsInc = (isLegal || extraType === 'NO_BALL') ? 1 : 0;
    const newBatRuns = (existingStriker?.runs || 0) + batRunsInc;
    const newBatBalls = (existingStriker?.balls || 0) + batBallsInc;
    const newStrikeRate = newBatBalls > 0 ? parseFloat(((newBatRuns / newBatBalls) * 100).toFixed(2)) : 0.00;
    const strikerDismissed = Boolean(wicket && (!dismissedPlayerId || dismissedPlayerId === activeStrikerId));

    // Prepare Bowler update
    let bwlOvers = existingBowler?.overs || 0;
    let bwlBalls = existingBowler?.balls || 0;
    if (isLegal) {
      bwlBalls += 1;
      if (bwlBalls === 6) {
        bwlOvers += 1;
        bwlBalls = 0;
      }
    }
    const bowlerRuns = Number(runsBatter) + (extraType === 'WIDE' || extraType === 'NO_BALL' ? Number(runsExtras) : 0);
    const newBwlRuns = (existingBowler?.runs_conceded || 0) + bowlerRuns;
    const bowlerCreditedDismissals = ['BOWLED', 'CAUGHT', 'CAUGHT_BEHIND', 'CAUGHT_AND_BOWLED', 'LBW', 'STUMPED', 'HIT_WICKET'];
    const bwlWktInc = (wicket && bowlerCreditedDismissals.includes(wicketType)) ? 1 : 0;
    const totalBowlerOvers = bwlOvers + (bwlBalls / 6);
    const newBwlEcon = totalBowlerOvers > 0 ? parseFloat((newBwlRuns / totalBowlerOvers).toFixed(2)) : 0.00;

    // Match completion & score strings
    const maxWickets = getMaxWicketsForInnings(innings, match);
    let isMatchCompleted = false;
    const inningsMaxOvers = innings.revised_overs || match.revised_overs || match.overs_per_side;
    const postWriteOps = [];

    if (innings.innings_number === 2 && innings.target && innings.total_runs >= innings.target) {
      match.status = 'COMPLETED';
      isMatchCompleted = true;
      const [winnerTeam, inn1] = await Promise.all([
        db.models.Team.findOne({ id: innings.batting_team_id }, 'name').lean(),
        db.models.Innings.findOne({ match_id: matchId, innings_number: 1 }, 'total_runs batting_team_id overs balls wickets').lean()
      ]);
      const wicketsRemaining = Math.max(0, maxWickets - innings.wickets);
      match.result_summary = `${winnerTeam?.name || 'Chasing Team'} won by ${wicketsRemaining} wicket${wicketsRemaining > 1 ? 's' : ''}`;
      match.winner_id = innings.batting_team_id;
      match.bonus_point_winner = computeAutoBonusWinner(match, inn1, innings, match.winner_id);
      innings.is_completed = true;
      innings.is_over_complete = false;
    } else if (innings.wickets >= maxWickets || (inningsMaxOvers && overNumber >= inningsMaxOvers)) {
      if (innings.innings_number === 1) {
        innings.is_completed = true;
        innings.is_over_complete = false;
        match.status = 'INNINGS_BREAK';
        const target = (innings.total_runs || 0) + 1;
        const inn2Id = `INN-${matchId}-2`;
        const inn2BattingTeamId = innings.bowling_team_id;
        const inn2RevisedOvers = (inn2BattingTeamId === match.team_a_id ? match.team_a_overs : match.team_b_overs) || match.revised_overs || match.overs_per_side || null;
        match.target_runs = target;
        match.current_innings_number = 2;
        postWriteOps.push(
          db.models.Innings.findOneAndUpdate(
            { id: inn2Id },
            {
              $setOnInsert: {
                id: inn2Id,
                match_id: matchId,
                innings_number: 2,
                batting_team_id: inn2BattingTeamId,
                bowling_team_id: innings.batting_team_id,
                total_runs: 0,
                wickets: 0,
                overs: 0,
                balls: 0,
                status: 'LIVE',
                extras: { wides: 0, no_balls: 0, byes: 0, leg_byes: 0, total: 0 }
              },
              $set: { target, revised_overs: inn2RevisedOvers, is_completed: false }
            },
            { upsert: true }
          )
        );
      } else {
        innings.is_completed = true;
        innings.is_over_complete = false;
        match.status = 'COMPLETED';
        isMatchCompleted = true;
        const inn1 = await db.models.Innings.findOne({ match_id: matchId, innings_number: 1 }, 'total_runs batting_team_id overs balls wickets').lean();
        const runsDiff = (inn1?.total_runs || 0) - innings.total_runs;
        if (runsDiff > 0) {
          const winnerTeam = await db.models.Team.findOne({ id: inn1.batting_team_id }, 'name').lean();
          match.result_summary = `${winnerTeam?.name || 'Defending Team'} won by ${runsDiff} runs`;
          match.winner_id = inn1.batting_team_id;
          match.bonus_point_winner = computeAutoBonusWinner(match, inn1, innings, match.winner_id);
        } else if (runsDiff === 0) {
          match.result_summary = 'Match Tied';
          match.winner_id = 'TIE';
          match.bonus_point_winner = false;
        }
      }
    }

    const currentScoreStr = `${innings.total_runs}/${innings.wickets} (${innings.overs}.${innings.balls} Ov)`;
    let scoreAStr = match.score_a || null;
    let scoreBStr = match.score_b || null;
    if (innings.batting_team_id === match.team_a_id) scoreAStr = currentScoreStr;
    else scoreBStr = currentScoreStr;

    const matchUpdateFields = {
      score_a: scoreAStr,
      score_b: scoreBStr,
      status: match.status,
      current_innings_number: match.current_innings_number,
      target_runs: match.target_runs,
      result_summary: match.result_summary,
      winner_id: match.winner_id
    };
    if (isMatchCompleted) {
      matchUpdateFields.bonus_point_winner = Boolean(match.bonus_point_winner);
    }
    if (match.current_break) {
      matchUpdateFields.current_break = null;
      matchUpdateFields.status_comment = '';
    }

    const deliveryId = 'DEL-' + Date.now() + '-' + String(++deliverySequence).padStart(6, '0');

    // 3. Parallel Core Writes (Delivery + Innings + Striker + Bowler + Match + optional NonStriker/Replacement)
    const tWriteStart = process.hrtime.bigint();
    const coreWrites = [
      db.models.Delivery.create({
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
        client_delivery_id: clientDeliveryId,
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
      }),
      innings.save(),
      db.models.InningsBatter.findOneAndUpdate(
        { innings_id: innings.id, player_id: activeStrikerId },
        {
          $setOnInsert: {
            id: `BAT-${innings.id}-${activeStrikerId}`,
            innings_id: innings.id,
            player_id: activeStrikerId,
            batting_position: existingStriker ? existingStriker.batting_position : 1
          },
          $set: {
            runs: newBatRuns,
            balls: newBatBalls,
            fours: (existingStriker?.fours || 0) + batFoursInc,
            sixes: (existingStriker?.sixes || 0) + batSixesInc,
            strike_rate: newStrikeRate,
            ...(strikerDismissed
              ? {
                  is_out: !isRetiredHurt,
                  dismissal_type: wicketType || 'BOWLED',
                  dismissal_text: isRetiredHurt ? 'retired hurt (not out)' : (dismissalText || 'out'),
                  bowler_id: nonBowlerDismissals.includes(wicketType) ? null : activeBowlerId,
                  fielder_id: fielderId || null
                }
              : existingStriker ? {} : { is_out: false, dismissal_text: 'not out' })
          }
        },
        { upsert: true, returnDocument: 'after' }
      ),
      db.models.InningsBowler.findOneAndUpdate(
        { innings_id: innings.id, player_id: activeBowlerId },
        {
          $setOnInsert: {
            id: `BWL-${innings.id}-${activeBowlerId}`,
            innings_id: innings.id,
            player_id: activeBowlerId,
            maidens: 0
          },
          $set: {
            overs: bwlOvers,
            balls: bwlBalls,
            runs_conceded: newBwlRuns,
            wickets: (existingBowler?.wickets || 0) + bwlWktInc,
            wides: (existingBowler?.wides || 0) + (extraType === 'WIDE' ? Number(runsExtras) : 0),
            no_balls: (existingBowler?.no_balls || 0) + (extraType === 'NO_BALL' ? Number(runsExtras) : 0),
            economy: newBwlEcon
          }
        },
        { upsert: true, returnDocument: 'after' }
      ),
      db.models.Match.updateOne({ id: matchId }, { $set: matchUpdateFields }),
      ...postWriteOps
    ];

    if (needsNonStrikerStat) {
      coreWrites.push(
        db.models.InningsBatter.findOneAndUpdate(
          { innings_id: innings.id, player_id: activeNonStrikerId },
          {
            $setOnInsert: {
              id: `BAT-${innings.id}-${activeNonStrikerId}`,
              innings_id: innings.id,
              player_id: activeNonStrikerId,
              batting_position: existingNonStriker ? existingNonStriker.batting_position : 2,
              runs: 0,
              balls: 0,
              fours: 0,
              sixes: 0
            },
            $set: {
              is_out: !isRetiredHurt,
              dismissal_type: wicketType || 'RUN_OUT',
              dismissal_text: isRetiredHurt ? 'retired hurt (not out)' : (dismissalText || 'run out'),
              bowler_id: nonBowlerDismissals.includes(wicketType) ? null : activeBowlerId,
              fielder_id: fielderId || null
            }
          },
          { upsert: true }
        )
      );
    }

    if (replacementId) {
      coreWrites.push(
        db.models.InningsBatter.findOneAndUpdate(
          { innings_id: innings.id, player_id: replacementId },
          {
            $setOnInsert: {
              id: `BAT-${innings.id}-${replacementId}`,
              innings_id: innings.id,
              player_id: replacementId,
              batting_position: 3,
              runs: 0,
              balls: 0,
              fours: 0,
              sixes: 0,
              strike_rate: 0.0,
              is_out: false,
              dismissal_text: 'not out'
            }
          },
          { upsert: true }
        )
      );
      if (deliveryData.replacementBatterName && deliveryData.replacementBatterName.trim()) {
        const cleanRepName = deliveryData.replacementBatterName.trim();
        coreWrites.push(
          db.models.Player.updateOne(
            { id: replacementId },
            { $setOnInsert: { id: replacementId, name: cleanRepName, role: 'BATTER', team_id: innings.batting_team_id } },
            { upsert: true }
          )
        );
      }
    }

    await Promise.all(coreWrites);
    _timings.writes = hrMs(tWriteStart);

    // 4. Invalidate portal-home cache & emit Socket.IO delta immediately
    const tEmitStart = process.hrtime.bigint();
    invalidateCache('portal-home');

    const matchTotalOvers = match.overs || match.overs_per_side || 20;
    const maxQuota = Math.ceil(matchTotalOvers / 5) || 4;
    let bowlerQuotaWarning = null;
    if (bwlOvers >= maxQuota) {
      bowlerQuotaWarning = {
        bowlerId: activeBowlerId,
        bowlerName,
        overs: bwlOvers,
        maxQuota,
        isQuotaFull: true,
        message: `Bowler ${bowlerName} has completed their maximum bowling quota (${bwlOvers}/${maxQuota} overs).`
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
        totalRuns: innings.total_runs,
        wickets: innings.wickets,
        status: match.status,
        scoreA: scoreAStr,
        scoreB: scoreBStr,
        battingTeamId: innings.batting_team_id,
        currentInnings: innings.innings_number,
        isOverComplete: isOverFinished,
        isFreeHit: nextIsFreeHit,
        currentBreak: null,
        statusComment: '',
        noBallWarning,
        consecutiveWidesWarning,
        bowlerQuotaWarning,
        powerplay,
        lastDelivery: lastDelPayload,
        lastEvent: lastDelPayload
      });
    } catch (_e) {}
    _timings.emit = hrMs(tEmitStart);
    _timings.total = hrMs(tTotalStart);

    // 5. Run non-critical post-delivery tasks in background after response
    if (isMatchCompleted) {
      setImmediate(() => {
        try {
          const tournamentService = require('../tournamentService');
          Promise.resolve(tournamentService.onMatchCompleted(matchId)).catch((err) => {
            console.error('[BG onMatchCompleted error]', err?.message || err);
          });
        } catch (err) {
          console.error('[BG onMatchCompleted require error]', err?.message || err);
        }
        try {
          require('../playerRatingService').enqueueMatchRatingRecalculation(matchId, 'DELIVERY_COMPLETED');
        } catch (_ratingErr) {}
      });
    }

    const responseObj = {
      success: true,
      message: 'Delivery recorded successfully.',
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
        strikerStats: {
          id: activeStrikerId,
          runs: newBatRuns,
          balls: newBatBalls,
          fours: (existingStriker?.fours || 0) + batFoursInc,
          sixes: (existingStriker?.sixes || 0) + batSixesInc,
          strikeRate: newStrikeRate
        },
        bowlerStats: {
          id: activeBowlerId,
          overs: `${bwlOvers}.${bwlBalls}`,
          runs: newBwlRuns,
          wickets: (existingBowler?.wickets || 0) + bwlWktInc,
          economy: newBwlEcon
        },
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
      },
      _timings
    };

    if (clientDeliveryId) {
      idempotencyCache.set(`${matchId}:${clientDeliveryId}`, {
        expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
        response: responseObj
      });
    }

    return responseObj;
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

    const match = await db.models.Match.findOne({ id: matchId }).lean();
    const tournamentDoc = match
      ? await db.models.Tournament.findOne({
          $or: [
            ...(match.tournament_id ? [{ id: match.tournament_id }] : []),
            ...(match.tournament_name ? [{ name: match.tournament_name }] : [])
          ]
        }).lean()
      : null;
    const snap = match?.rules_snapshot || null;
    const allowChainOver = snap?.allow_chain_over !== undefined
      ? Boolean(snap.allow_chain_over)
      : Boolean(tournamentDoc?.playing_rules?.allow_chain_over);
    if (!allowChainOver && innings.previous_bowler_id && resolvedId === innings.previous_bowler_id) {
      throw {
        status: 400,
        message: 'Bowler who bowled the previous over cannot bowl consecutive overs (Chain Over is disabled).'
      };
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
    } catch (e) { }

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

