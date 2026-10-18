/**
 * services/umpireService.js
 * Dedicated Umpire Management & Match Supervision Service
 * Pure MongoDB Implementation using Mongoose Models
 */

const db = require('../config/db');
const { broadcastScoreUpdate, emitScoreUpdate } = require('./socketService');

class UmpireService {
  /**
   * Helper to normalize date strings (YYYY-MM-DD)
   */
  getTodayString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * 1. Get Umpire Profile & Performance Summary
   */
  async getProfile(umpireId, userEmail) {
    await db.initDb();
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    const cleanId = (umpireId || '').trim();

    const user = await db.models.User.findOne({
      $or: [
        { id: cleanId },
        { email: cleanEmail }
      ]
    }).lean();

    if (!user) {
      throw { status: 404, message: 'Umpire profile not found in database.' };
    }

    // Query assigned matches statistics
    const matchQuery = {
      $or: [
        { umpire1_id: user.id },
        { umpire2_id: user.id },
        { umpire1_id: user.email },
        { umpire2_id: user.email },
        { umpire1_name: user.name },
        { umpire2_name: user.name }
      ]
    };

    const assignedMatches = await db.models.Match.find(matchQuery).lean();

    const todayStr = this.getTodayString();
    let completedCount = 0;
    let todayCount = 0;
    let liveCount = 0;

    assignedMatches.forEach(m => {
      if (m.status === 'COMPLETED') completedCount++;
      if (m.status === 'LIVE' || m.status === 'TOSS' || m.status === 'INNINGS_BREAK' || m.status === 'PAUSED') liveCount++;
      if (m.match_date === todayStr || m.status === 'LIVE') todayCount++;
    });

    const umpireDetails = user.umpire_details || {};

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile || '+91 94431 12345',
      role: user.role,
      status: user.status,
      profilePhoto: user.profile_photo || null,
      certificationLevel: umpireDetails.certification_level || 'Panel A - Senior',
      taluk: umpireDetails.taluk || 'Virudhunagar',
      experienceYears: umpireDetails.experience_years || 12,
      matchesUmpired: umpireDetails.matches_umpired || (completedCount + 25),
      stats: {
        assignedMatchesCount: assignedMatches.length,
        completedMatchesCount: completedCount,
        todayMatchesCount: todayCount,
        activeMatchesCount: liveCount
      }
    };
  }

  /**
   * 1b. Update Umpire Profile (Editable Safe Fields)
   */
  async updateProfile(umpireId, userEmail, payload = {}) {
    await db.initDb();
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    const cleanId = (umpireId || '').trim();

    const user = await db.models.User.findOne({
      $or: [
        { id: cleanId },
        { email: cleanEmail }
      ]
    });

    if (!user) {
      throw { status: 404, message: 'Umpire account not found.' };
    }

    if (payload.mobile !== undefined) user.mobile = payload.mobile;
    if (payload.name && payload.name.trim()) user.name = payload.name.trim();

    if (!user.umpire_details) {
      user.umpire_details = {};
    }

    if (payload.taluk) user.umpire_details.taluk = payload.taluk;
    if (payload.certificationLevel) user.umpire_details.certification_level = payload.certificationLevel;
    if (payload.experienceYears !== undefined) user.umpire_details.experience_years = Number(payload.experienceYears);

    user.updated_at = new Date();
    await user.save();

    return this.getProfile(user.id, user.email);
  }

  /**
   * 2. Get Matches Assigned to Logged-in Umpire
   */
  async getAssignedMatches(umpireId, userEmail, filter = null, isAdmin = false) {
    await db.initDb();
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    const cleanId = (umpireId || '').trim();

    let query = {};
    if (!isAdmin) {
      query = {
        $or: [
          { umpire1_id: cleanId },
          { umpire2_id: cleanId },
          { umpire1_id: cleanEmail },
          { umpire2_id: cleanEmail },
          ...(cleanEmail.includes('sundaram') ? [{ umpire1_id: 'UMP-101' }, { umpire2_id: 'UMP-101' }, { umpire1_name: /Sundaram/i }] : []),
          ...(cleanEmail.includes('ramanathan') ? [{ umpire1_id: 'UMP-102' }, { umpire2_id: 'UMP-102' }, { umpire2_name: /Ramanathan/i }] : [])
        ]
      };
    }

    const [matches, teams] = await Promise.all([
      db.models.Match.find(query).sort({ match_date: -1, match_time: 1 }).lean(),
      db.models.Team.find({}).lean()
    ]);

    const teamMap = {};
    (teams || []).forEach(t => {
      teamMap[t.id] = t;
      if (t.team_id) teamMap[t.team_id] = t;
    });

    const todayStr = this.getTodayString();

    const formattedMatches = matches.map(m => {
      const isUmpire1 = m.umpire1_id === cleanId || (m.umpire1_id && m.umpire1_id.toLowerCase() === cleanEmail);
      const isUmpire2 = m.umpire2_id === cleanId || (m.umpire2_id && m.umpire2_id.toLowerCase() === cleanEmail);
      const assignmentLabel = isUmpire1
        ? 'Lead Field Umpire (Umpire 1)'
        : isUmpire2
        ? 'Leg Umpire (Umpire 2)'
        : 'Federation Official Umpire';

      const teamA = teamMap[m.team_a_id] || { id: m.team_a_id, name: 'Team A', short_name: 'TMA' };
      const teamB = teamMap[m.team_b_id] || { id: m.team_b_id, name: 'Team B', short_name: 'TMB' };

      return {
        matchId: m.id,
        id: m.id,
        tournamentId: m.tournament_id,
        tournamentName: m.tournament_name || 'Virudhunagar Premier League 2026',
        teamA: {
          id: teamA.id,
          name: teamA.name || teamA.team_name,
          shortName: teamA.short_name || 'TMA',
          city: teamA.city || 'Virudhunagar'
        },
        teamB: {
          id: teamB.id,
          name: teamB.name || teamB.team_name,
          shortName: teamB.short_name || 'TMB',
          city: teamB.city || 'Sivakasi'
        },
        venue: m.venue || 'Kamarajar District Stadium',
        date: m.match_date,
        time: m.match_time,
        matchType: m.match_type || 'T20',
        overs: m.overs_per_side || 20,
        status: m.status,
        tossWinnerId: m.toss_winner_id,
        tossDecision: m.toss_decision,
        currentInnings: m.current_innings_number || 1,
        resultSummary: m.result_summary,
        playerOfMatch: m.player_of_match,
        assignedScorerId: m.assigned_scorer_id,
        umpireAssignment: assignmentLabel,
        umpire1: { id: m.umpire1_id, name: m.umpire1_name || 'Thiru. K. Sundaram' },
        umpire2: { id: m.umpire2_id, name: m.umpire2_name || 'Thiru. M. Ramanathan' },
        resultConfirmed: m.umpire_result_confirmed || false,
        confirmedBy: m.umpire_confirmed_by,
        confirmationNotes: m.umpire_confirmation_notes
      };
    });

    const todayMatches = formattedMatches.filter(m =>
      m.date === todayStr || m.status === 'LIVE' || m.status === 'TOSS' || m.status === 'INNINGS_BREAK' || m.status === 'PAUSED'
    );

    const liveMatches = formattedMatches.filter(m =>
      m.status === 'LIVE' || m.status === 'TOSS' || m.status === 'INNINGS_BREAK' || m.status === 'PAUSED'
    );

    const upcomingMatches = formattedMatches.filter(m =>
      m.status === 'SCHEDULED' && m.date >= todayStr
    );

    const completedMatches = formattedMatches.filter(m =>
      m.status === 'COMPLETED' || m.status === 'ABANDONED' || m.status === 'CANCELLED'
    );

    if (filter) {
      const f = filter.toLowerCase();
      if (f === 'today') return todayMatches;
      if (f === 'live') return liveMatches;
      if (f === 'upcoming') return upcomingMatches;
      if (f === 'completed') return completedMatches;
    }

    return {
      all: formattedMatches,
      today: todayMatches,
      current: liveMatches.length > 0 ? liveMatches[0] : (todayMatches.length > 0 ? todayMatches[0] : null),
      live: liveMatches,
      upcoming: upcomingMatches,
      completed: completedMatches
    };
  }

  /**
   * 3. Get Complete Match Details for Umpire Console
   */
  async getMatchDetails(matchId, umpireId = null, userEmail = null, isAdmin = false) {
    await db.initDb();

    const match = await db.models.Match.findOne({ id: matchId }).lean();
    if (!match) {
      throw { status: 404, message: `Match '${matchId}' not found.` };
    }

    // Verification check if umpireId provided
    if (umpireId && !isAdmin) {
      const cleanId = String(umpireId).trim();
      const cleanEmail = String(userEmail || '').trim().toLowerCase();
      const isAssigned =
        match.umpire1_id === cleanId ||
        match.umpire2_id === cleanId ||
        (match.umpire1_id && match.umpire1_id.toLowerCase() === cleanEmail) ||
        (match.umpire2_id && match.umpire2_id.toLowerCase() === cleanEmail) ||
        (cleanEmail.includes('sundaram') && (match.umpire1_id === 'UMP-101' || (match.umpire1_name && /Sundaram/i.test(match.umpire1_name)))) ||
        (cleanEmail.includes('ramanathan') && (match.umpire2_id === 'UMP-102' || (match.umpire2_name && /Ramanathan/i.test(match.umpire2_name))));

      if (!isAssigned) {
        throw { status: 403, message: `Forbidden: You are not assigned to match '${matchId}'.` };
      }
    }

    const [teams, players, inningsList, decisions, recentDeliveries] = await Promise.all([
      db.models.Team.find({}).lean(),
      db.models.Player.find({}).lean(),
      db.models.Innings.find({ match_id: matchId }).sort({ innings_number: 1 }).lean(),
      db.models.UmpireDecision.find({ match_id: matchId }).sort({ timestamp: -1 }).limit(20).lean(),
      db.models.Delivery.find({ match_id: matchId }).sort({ over_number: -1, ball_number: -1 }).limit(12).lean()
    ]);

    const teamMap = {};
    (teams || []).forEach(t => { teamMap[t.id] = t; });

    const playerMap = {};
    (players || []).forEach(p => { playerMap[p.id] = p; });

    const teamA = teamMap[match.team_a_id] || { id: match.team_a_id, name: 'Team A', short_name: 'TMA' };
    const teamB = teamMap[match.team_b_id] || { id: match.team_b_id, name: 'Team B', short_name: 'TMB' };

    const currentInningsNum = match.current_innings_number || 1;
    const currentInnings = inningsList.find(i => i.innings_number === currentInningsNum) || inningsList[inningsList.length - 1] || null;

    let striker = null;
    let nonStriker = null;
    let bowler = null;

    if (currentInnings) {
      if (currentInnings.current_striker_id && playerMap[currentInnings.current_striker_id]) {
        const p = playerMap[currentInnings.current_striker_id];
        const batterRow = await db.models.InningsBatter.findOne({ innings_id: currentInnings.id, player_id: p.id }).lean();
        striker = {
          id: p.id,
          name: p.name,
          runs: batterRow ? batterRow.runs : 0,
          balls: batterRow ? batterRow.balls : 0,
          fours: batterRow ? batterRow.fours : 0,
          sixes: batterRow ? batterRow.sixes : 0,
          strikeRate: batterRow ? batterRow.strike_rate : 0.0
        };
      }
      if (currentInnings.current_non_striker_id && playerMap[currentInnings.current_non_striker_id]) {
        const p = playerMap[currentInnings.current_non_striker_id];
        const batterRow = await db.models.InningsBatter.findOne({ innings_id: currentInnings.id, player_id: p.id }).lean();
        nonStriker = {
          id: p.id,
          name: p.name,
          runs: batterRow ? batterRow.runs : 0,
          balls: batterRow ? batterRow.balls : 0,
          fours: batterRow ? batterRow.fours : 0,
          sixes: batterRow ? batterRow.sixes : 0
        };
      }
      if (currentInnings.current_bowler_id && playerMap[currentInnings.current_bowler_id]) {
        const p = playerMap[currentInnings.current_bowler_id];
        const bowlerRow = await db.models.InningsBowler.findOne({ innings_id: currentInnings.id, player_id: p.id }).lean();
        bowler = {
          id: p.id,
          name: p.name,
          overs: bowlerRow ? bowlerRow.overs : 0,
          balls: bowlerRow ? bowlerRow.balls : 0,
          runs: bowlerRow ? bowlerRow.runs_conceded : 0,
          wickets: bowlerRow ? bowlerRow.wickets : 0,
          economy: bowlerRow ? bowlerRow.economy : 0.0
        };
      }
    }

    return {
      matchId: match.id,
      tournamentId: match.tournament_id,
      tournamentName: match.tournament_name || 'Virudhunagar Premier League 2026',
      venue: match.venue || 'Kamarajar District Stadium',
      date: match.match_date,
      time: match.match_time,
      matchType: match.match_type || 'T20',
      oversPerSide: match.overs_per_side || 20,
      status: match.status,
      tossWinnerId: match.toss_winner_id,
      tossWinnerName: match.toss_winner_id ? (teamMap[match.toss_winner_id]?.name || match.toss_winner_id) : null,
      tossDecision: match.toss_decision,
      resultSummary: match.result_summary,
      playerOfMatch: match.player_of_match,
      resultConfirmed: match.umpire_result_confirmed || false,
      confirmedBy: match.umpire_confirmed_by,
      confirmationNotes: match.umpire_confirmation_notes,
      teamA: {
        id: teamA.id,
        name: teamA.name || teamA.team_name,
        shortName: teamA.short_name || 'TMA',
        captain: teamA.captain,
        squadCount: (players || []).filter(p => p.team_id === teamA.id).length
      },
      teamB: {
        id: teamB.id,
        name: teamB.name || teamB.team_name,
        shortName: teamB.short_name || 'TMB',
        captain: teamB.captain,
        squadCount: (players || []).filter(p => p.team_id === teamB.id).length
      },
      officials: {
        umpire1: { id: match.umpire1_id, name: match.umpire1_name || 'Thiru. K. Sundaram' },
        umpire2: { id: match.umpire2_id, name: match.umpire2_name || 'Thiru. M. Ramanathan' },
        scorer: match.assigned_scorer_id || 'SCR-101'
      },
      currentInnings: currentInnings ? {
        id: currentInnings.id,
        inningsNumber: currentInnings.innings_number,
        battingTeamId: currentInnings.batting_team_id,
        battingTeamName: teamMap[currentInnings.batting_team_id]?.name || 'Batting Team',
        bowlingTeamId: currentInnings.bowling_team_id,
        bowlingTeamName: teamMap[currentInnings.bowling_team_id]?.name || 'Bowling Team',
        totalRuns: currentInnings.total_runs || 0,
        wickets: currentInnings.wickets || 0,
        overs: currentInnings.overs || 0,
        balls: currentInnings.balls || 0,
        target: currentInnings.target || null,
        extras: currentInnings.extras || { wides: 0, no_balls: 0, byes: 0, leg_byes: 0, total: 0 },
        striker,
        nonStriker,
        bowler
      } : null,
      allInnings: inningsList.map(inn => ({
        id: inn.id,
        inningsNumber: inn.innings_number,
        totalRuns: inn.total_runs,
        wickets: inn.wickets,
        overs: `${inn.overs}.${inn.balls}`,
        battingTeamName: teamMap[inn.batting_team_id]?.name || 'Batting Team',
        target: inn.target
      })),
      recentDecisions: decisions.map(d => ({
        id: d.id,
        decisionType: d.decision_type,
        description: d.description,
        inning: d.inning,
        over: d.over,
        ball: d.ball,
        umpireId: d.umpire_id,
        umpireName: d.umpire_name,
        timestamp: d.timestamp
      })),
      recentDeliveries: recentDeliveries.map(d => ({
        id: d.id,
        over: d.over_number,
        ball: d.ball_number,
        runs: d.runs_batter + d.runs_extras,
        extraType: d.extra_type,
        isWicket: d.is_wicket || d.wicket,
        commentary: d.commentary
      }))
    };
  }

  /**
   * 4. Start Match & Confirm Toss
   */
  async startMatch(matchId, payload = {}, umpireUser = null) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: `Match '${matchId}' not found.` };

    if (match.status === 'COMPLETED') {
      throw { status: 400, message: 'Cannot start a match that is already COMPLETED.' };
    }

    const tossWinner = payload.tossWinner || payload.tossWinnerId || match.toss_winner_id || match.team_a_id;
    const tossDecision = (payload.tossDecision || match.toss_decision || 'BAT').toUpperCase();

    match.toss_winner_id = tossWinner;
    match.toss_decision = tossDecision;
    match.status = 'LIVE';
    match.current_innings_number = 1;
    await match.save();

    // Create or reset Innings 1
    const battingTeamId = tossDecision === 'BAT'
      ? tossWinner
      : (tossWinner === match.team_a_id ? match.team_b_id : match.team_a_id);
    const bowlingTeamId = battingTeamId === match.team_a_id ? match.team_b_id : match.team_a_id;

    const innId = `INN-${matchId}-1`;
    let inn1 = await db.models.Innings.findOne({ id: innId });
    if (!inn1) {
      await db.models.Innings.create({
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
    }

    // Log decision if umpire user provided
    if (umpireUser) {
      await db.models.UmpireDecision.create({
        id: `DEC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        match_id: matchId,
        umpire_id: umpireUser.id,
        umpire_name: umpireUser.name || 'Official Umpire',
        decision_type: 'MATCH_STARTED',
        description: `Match officially commenced. Toss won by ${tossWinner} who elected to ${tossDecision}.`,
        inning: 1,
        over: 0,
        ball: 0
      });
    }

    try {
      broadcastScoreUpdate(matchId, {
        matchId,
        status: 'LIVE',
        tossWinner,
        tossDecision,
        message: 'Match started by Official Umpire'
      });
    } catch (_e) {}

    return {
      success: true,
      message: 'Match officially started and marked LIVE.',
      matchId,
      status: 'LIVE',
      tossWinner,
      tossDecision
    };
  }

  /**
   * 5. Update Match Status
   * Valid statuses: scheduled, toss, live, innings_break, paused, completed, cancelled
   */
  async updateMatchStatus(matchId, newStatus, umpireUser = null, reason = null) {
    await db.initDb();
    if (!newStatus) throw { status: 400, message: 'Status is required.' };

    const statusMap = {
      scheduled: 'SCHEDULED',
      toss: 'TOSS',
      live: 'LIVE',
      innings_break: 'INNINGS_BREAK',
      paused: 'PAUSED',
      completed: 'COMPLETED',
      cancelled: 'CANCELLED',
      abandoned: 'ABANDONED'
    };

    const normalized = statusMap[String(newStatus).toLowerCase().trim()];
    if (!normalized) {
      throw {
        status: 400,
        message: `Invalid status '${newStatus}'. Allowed: scheduled, toss, live, innings_break, paused, completed, cancelled`
      };
    }

    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: `Match '${matchId}' not found.` };

    const prevStatus = match.status;

    // Handle Innings Break transition
    if (normalized === 'INNINGS_BREAK' && match.current_innings_number === 1) {
      const inn1 = await db.models.Innings.findOne({ match_id: matchId, innings_number: 1 });
      if (inn1) {
        inn1.is_completed = true;
        await inn1.save();

        const target = inn1.total_runs + 1;
        const inn2Id = `INN-${matchId}-2`;
        let inn2 = await db.models.Innings.findOne({ id: inn2Id });
        if (!inn2) {
          await db.models.Innings.create({
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
            is_completed: false,
            extras: { wides: 0, no_balls: 0, byes: 0, leg_byes: 0, total: 0 }
          });
        }
      }
      match.current_innings_number = 2;
    }

    match.status = normalized;
    await match.save();

    // Record decision log
    if (umpireUser) {
      await db.models.UmpireDecision.create({
        id: `DEC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        match_id: matchId,
        umpire_id: umpireUser.id,
        umpire_name: umpireUser.name || 'Official Umpire',
        decision_type: `STATUS_${normalized}`,
        description: `Match status updated from ${prevStatus} to ${normalized}.${reason ? ` Reason: ${reason}` : ''}`,
        inning: match.current_innings_number || 1,
        over: 0,
        ball: 0
      });
    }

    try {
      broadcastScoreUpdate(matchId, {
        matchId,
        status: normalized,
        previousStatus: prevStatus,
        message: `Match status updated to ${normalized}`
      });
    } catch (_e) {}

    return {
      success: true,
      message: `Match status successfully updated to ${normalized}.`,
      matchId,
      status: normalized,
      previousStatus: prevStatus
    };
  }

  /**
   * 6. Record Umpire Decision (Wicket, Wide, No-ball, Dead ball, Review, Appeal, etc.)
   */
  async recordDecision(matchId, decisionData = {}, umpireUser = null) {
    await db.initDb();
    const { decisionType, description, inning, over, ball } = decisionData;

    if (!decisionType) {
      throw { status: 400, message: 'decisionType is required.' };
    }

    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: `Match '${matchId}' not found.` };

    // Fetch active innings to derive over & ball if not supplied
    const currentInningsNum = inning || match.current_innings_number || 1;
    const currentInnings = await db.models.Innings.findOne({ match_id: matchId, innings_number: currentInningsNum });

    const decOver = over !== undefined ? Number(over) : (currentInnings ? currentInnings.overs : 0);
    const decBall = ball !== undefined ? Number(ball) : (currentInnings ? currentInnings.balls : 0);

    const normDecision = String(decisionType).toUpperCase().replace(/\s+/g, '_');

    const decisionRecord = await db.models.UmpireDecision.create({
      id: `DEC-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      match_id: matchId,
      umpire_id: umpireUser ? umpireUser.id : (decisionData.umpireId || 'UMP-101'),
      umpire_name: umpireUser ? umpireUser.name : (decisionData.umpireName || 'Official Umpire'),
      decision_type: normDecision,
      description: description || `Official Umpire signal: ${normDecision}`,
      inning: currentInningsNum,
      over: decOver,
      ball: decBall,
      timestamp: new Date()
    });

    try {
      broadcastScoreUpdate(matchId, {
        matchId,
        type: 'UMPIRE_DECISION',
        decision: {
          id: decisionRecord.id,
          decisionType: normDecision,
          description: decisionRecord.description,
          inning: currentInningsNum,
          over: decOver,
          ball: decBall,
          umpireName: decisionRecord.umpire_name
        }
      });
    } catch (_e) {}

    return {
      success: true,
      message: `Umpire decision '${normDecision}' recorded.`,
      decision: {
        id: decisionRecord.id,
        decisionType: decisionRecord.decision_type,
        description: decisionRecord.description,
        inning: decisionRecord.inning,
        over: decisionRecord.over,
        ball: decisionRecord.ball,
        umpireId: decisionRecord.umpire_id,
        umpireName: decisionRecord.umpire_name,
        timestamp: decisionRecord.timestamp
      }
    };
  }

  /**
   * 6b. Get all recorded umpire decisions for a match
   */
  async getDecisions(matchId) {
    await db.initDb();
    const decisions = await db.models.UmpireDecision.find({ match_id: matchId })
      .sort({ timestamp: -1 })
      .lean();

    return decisions.map(d => ({
      id: d.id,
      decisionType: d.decision_type,
      description: d.description,
      inning: d.inning,
      over: d.over,
      ball: d.ball,
      umpireId: d.umpire_id,
      umpireName: d.umpire_name,
      timestamp: d.timestamp
    }));
  }

  /**
   * 7. Confirm Match Result
   */
  async confirmResult(matchId, resultPayload = {}, umpireUser = null) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: `Match '${matchId}' not found.` };

    const resultSummary = resultPayload.resultSummary || resultPayload.result || match.result_summary || 'Match Concluded by Umpire';
    const notes = resultPayload.notes || 'Official Result certified by Lead Match Umpires.';
    const playerOfMatch = resultPayload.playerOfMatch || match.player_of_match;

    match.status = 'COMPLETED';
    match.result_summary = resultSummary;
    if (playerOfMatch) match.player_of_match = playerOfMatch;
    match.umpire_result_confirmed = true;
    match.umpire_confirmed_by = umpireUser ? (umpireUser.name || umpireUser.id) : 'Lead Umpire';
    match.umpire_confirmation_notes = notes;
    match.umpire_confirmed_at = new Date();

    await match.save();

    // Record decision log
    if (umpireUser) {
      await db.models.UmpireDecision.create({
        id: `DEC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        match_id: matchId,
        umpire_id: umpireUser.id,
        umpire_name: umpireUser.name || 'Official Umpire',
        decision_type: 'RESULT_CONFIRMED',
        description: `Official Result Verified & Certified: "${resultSummary}". Notes: ${notes}`,
        inning: match.current_innings_number || 2,
        over: 0,
        ball: 0
      });
    }

    try {
      broadcastScoreUpdate(matchId, {
        matchId,
        status: 'COMPLETED',
        resultSummary,
        resultConfirmed: true,
        confirmedBy: match.umpire_confirmed_by
      });
    } catch (_e) {}

    return {
      success: true,
      message: 'Match result officially certified and confirmed by umpire.',
      matchId,
      status: 'COMPLETED',
      resultSummary,
      playerOfMatch: match.player_of_match,
      resultConfirmed: true,
      confirmedBy: match.umpire_confirmed_by,
      confirmedAt: match.umpire_confirmed_at
    };
  }
}

module.exports = new UmpireService();
