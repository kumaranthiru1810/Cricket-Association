/**
 * services/scoring/inningsService.js
 * Handles match lifecycle, over completion, innings transition, declare, breaks, revised overs, playing XI edits.
 */

const db = require('../../config/db');
const socketService = require('../socketService');
const { broadcastScoreUpdate, getFullPlayerMap, getMaxWicketsForInnings } = require('./deliveryHelpers');

class InningsService {
  /**
   * Concludes the over and sets the next bowler
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

    if (innings.previous_bowler_id && nextBowlerId === innings.previous_bowler_id) {
      throw { status: 400, message: 'Bowler cannot bowl consecutive overs. Please select a different bowler.' };
    }

    const playerMap = await getFullPlayerMap();
    let bowlerPlayer = playerMap[nextBowlerId];
    if (!bowlerPlayer) {
      bowlerPlayer = await db.models.Player.findOne({ id: nextBowlerId }).lean();
    }
    const bowlerName = bowlerPlayer ? bowlerPlayer.name : nextBowlerId;

    innings.current_bowler_id = nextBowlerId;
    innings.is_over_complete = false;
    await innings.save();

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
   * End current active innings and initialize next innings or conclude match
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
      match.status = 'COMPLETED';
      const inn1 = await db.models.Innings.findOne({ match_id: matchId, innings_number: 1 }).lean();
      const diff = (inn1?.total_runs || 0) - currentInnings.total_runs;
      if (diff > 0) {
        const team1 = await db.models.Team.findOne({ id: inn1.batting_team_id }).lean();
        match.result_summary = `${team1?.name || 'Team 1'} won by ${diff} runs`;
        match.winner_id = inn1.batting_team_id;
      } else if (diff < 0) {
        const team2 = await db.models.Team.findOne({ id: currentInnings.batting_team_id }).lean();
        const maxWickets = getMaxWicketsForInnings(currentInnings, match);
        const wRem = Math.max(0, maxWickets - currentInnings.wickets);
        match.result_summary = `${team2?.name || 'Team 2'} won by ${wRem} wickets`;
        match.winner_id = currentInnings.batting_team_id;
      } else {
        match.result_summary = 'Match Tied';
        match.winner_id = 'TIE';
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

  async updateMatchStatus(matchId, status) {
    await db.initDb();
    const normalized = String(status).toUpperCase();
    const validStatuses = ['SCHEDULED', 'LIVE', 'INNINGS_BREAK', 'COMPLETED', 'ABANDONED', 'POSTPONED'];
    if (!validStatuses.includes(normalized)) {
      throw { status: 400, message: `Invalid match status. Must be one of: ${validStatuses.join(', ')}` };
    }

    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: 'Match not found.' };

    if (normalized === 'LIVE' && match.postponement && match.postponement.is_postponed) {
      match.postponement.is_postponed = false;
      match.status_comment = 'Resumed live by official scorer';
    }

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

  async endMatch(matchId, payload = {}) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: 'Match not found.' };

    match.status = 'COMPLETED';
    if (payload.resultText || payload.result || payload.resultSummary) {
      match.result_summary = payload.resultText || payload.result || payload.resultSummary;
    }
    if (payload.playerOfMatch) {
      match.player_of_match = payload.playerOfMatch;
    }
    await match.save();

    try {
      const tournamentService = require('../tournamentService');
      tournamentService.onMatchCompleted(matchId);
    } catch (_err) {}

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

  async editPlayingXI(matchId, payload = {}) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: 'Match not found.' };

    const { teamId, replacedPlayerId, newPlayerId, newPlayerName } = payload;
    if (!teamId || !replacedPlayerId || (!newPlayerId && !newPlayerName)) {
      throw { status: 400, message: 'teamId, replacedPlayerId, and newPlayerId or newPlayerName are required.' };
    }

    // Rule: Applicable ONLY for players who have not batted or bowled a single delivery
    const inningsList = await db.models.Innings.find({ match_id: matchId }).lean();
    const inningsIds = inningsList.map(i => i.id);

    const hasBatted = await db.models.Delivery.findOne({
      innings_id: { $in: inningsIds },
      $or: [{ striker_id: replacedPlayerId }, { non_striker_id: replacedPlayerId }]
    });

    const hasBowled = await db.models.Delivery.findOne({
      innings_id: { $in: inningsIds },
      bowler_id: replacedPlayerId
    });

    if (hasBatted || hasBowled) {
      throw {
        status: 400,
        message: 'Cannot substitute player in Playing XI: The player has already taken part in active match play (batted or bowled).'
      };
    }

    let finalNewPlayerId = newPlayerId;
    if (!finalNewPlayerId && newPlayerName) {
      finalNewPlayerId = `PLY-SUB-${Date.now()}`;
      await db.models.Player.create({
        id: finalNewPlayerId,
        name: newPlayerName.trim(),
        role: 'ALL_ROUNDER',
        team_id: teamId
      });
    }

    const isTeamA = teamId === match.team_a_id;
    let xi = isTeamA ? (match.team_a_playing_xi || []) : (match.team_b_playing_xi || []);

    const idx = xi.findIndex(p => (typeof p === 'string' ? p === replacedPlayerId : (p.id === replacedPlayerId || p.player_id === replacedPlayerId)));
    if (idx !== -1) {
      if (typeof xi[idx] === 'string') {
        xi[idx] = finalNewPlayerId;
      } else {
        xi[idx].id = finalNewPlayerId;
        xi[idx].player_id = finalNewPlayerId;
        if (newPlayerName) xi[idx].name = newPlayerName.trim();
      }
    } else {
      xi.push({ id: finalNewPlayerId, name: newPlayerName || finalNewPlayerId });
    }

    if (isTeamA) {
      match.team_a_playing_xi = xi;
      match.markModified('team_a_playing_xi');
    } else {
      match.team_b_playing_xi = xi;
      match.markModified('team_b_playing_xi');
    }
    await match.save();

    return {
      success: true,
      message: 'Playing XI player successfully updated before player participation.',
      teamId,
      replacedPlayerId,
      newPlayerId: finalNewPlayerId,
      newPlayerName
    };
  }

  async addBreak(matchId, breakData = {}) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: 'Match not found.' };

    const newBreak = {
      type: breakData.type || 'Drinks',
      startTime: breakData.startTime || new Date().toLocaleTimeString(),
      endTime: breakData.endTime || '',
      duration: breakData.duration || '5',
      comments: breakData.comments || '',
      excludeBatsmanTime: Boolean(breakData.excludeBatsmanTime),
      created_at: new Date()
    };

    if (!Array.isArray(match.breaks)) match.breaks = [];
    match.breaks.push(newBreak);
    match.current_break = newBreak;
    match.status_comment = `${newBreak.type} in progress`;
    match.markModified('breaks');
    match.markModified('current_break');
    await match.save();

    try {
      broadcastScoreUpdate(matchId, { action: 'BREAK_ADDED', breaks: match.breaks, currentBreak: newBreak });
    } catch (_) {}

    return {
      success: true,
      message: 'Break successfully recorded.',
      data: match.breaks,
      currentBreak: newBreak
    };
  }

  async endBreak(matchId) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: 'Match not found.' };

    match.current_break = null;
    match.status_comment = '';
    match.markModified('current_break');
    await match.save();

    try {
      broadcastScoreUpdate(matchId, { action: 'BREAK_ENDED', matchId, currentBreak: null, statusComment: '' });
    } catch (_) {}

    return {
      success: true,
      message: 'Break ended, play resumed.',
      data: match
    };
  }

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

  async declareInnings(matchId) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: 'Match not found.' };

    const currentInnings = await db.models.Innings.findOne({ match_id: matchId, is_completed: false }).sort({ innings_number: -1 });
    if (!currentInnings) throw { status: 400, message: 'No active innings to declare.' };

    currentInnings.is_declared = true;
    currentInnings.is_completed = true;
    await currentInnings.save();

    return this.endInnings(matchId);
  }

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

module.exports = new InningsService();
