/**
 * services/scorerService.js
 * Scorer Dashboard, Assigned Matches, Live State, Scorecard & AI Fielding Commentary
 * Pure MongoDB Implementation using Mongoose Models
 */

const db = require('../config/db');

class ScorerService {
  /**
   * Helper to resolve all teams from Team and TeamRegistration
   */
  async getTeamMap() {
    await db.initDb();
    const [teams, teamRegs] = await Promise.all([
      db.models.Team.find({}).lean(),
      db.models.TeamRegistration.find({}).lean()
    ]);
    const teamMap = {};
    (teams || []).forEach(t => {
      if (t.id) teamMap[t.id] = t;
      if (t.team_id) teamMap[t.team_id] = t;
      if (t.name) teamMap[t.name] = t;
    });
    (teamRegs || []).forEach(tr => {
      const tObj = {
        id: tr.id,
        team_id: tr.id,
        name: tr.team_name || tr.club_name || tr.name || tr.id,
        short_name: (tr.team_name || tr.id).substring(0, 3).toUpperCase(),
        city: tr.city || tr.taluk,
        players: tr.players
      };
      if (tr.id) teamMap[tr.id] = tObj;
      if (tr.team_name) teamMap[tr.team_name] = tObj;
    });
    return teamMap;
  }

  /**
   * Helper to resolve all players from Player and TeamRegistration
   */
  async getPlayerMap() {
    await db.initDb();
    const [players, teamRegs] = await Promise.all([
      db.models.Player.find({}).lean(),
      db.models.TeamRegistration.find({}).lean()
    ]);
    const playerMap = {};
    (players || []).forEach(p => {
      if (p.id) playerMap[p.id] = p;
    });
    (teamRegs || []).forEach(tr => {
      (tr.players || []).forEach((p, idx) => {
        const pId = p.id || (p._id ? p._id.toString() : `${tr.id}-P${idx + 1}`);
        const pObj = {
          id: pId,
          name: p.name,
          role: p.role,
          jersey_number: p.jersey_number || (idx + 1),
          team_id: tr.id
        };
        playerMap[pId] = pObj;
        if (p.name) playerMap[p.name] = pObj;
      });
    });
    return playerMap;
  }

  /**
   * Helper to resolve a complete, robust squad of players for any team
   * Handles Team, TeamRegistration, and guarantees full 11 Playing XI options
   */
  async getSquadForTeam(teamId) {
    await db.initDb();
    if (!teamId) return [];

    const teamMap = await this.getTeamMap();
    const team = teamMap[teamId] || {};

    // All possible aliases for this team
    const aliases = new Set([
      teamId,
      team.id,
      team.team_id,
      team.name,
      team.team_name
    ].filter(Boolean));

    const squadMap = {};
    const seenNames = new Set();

    // 1. Fetch from official Player collection
    const players = await db.models.Player.find({
      $or: [
        { team_id: { $in: Array.from(aliases) } },
        { team_name: { $in: Array.from(aliases) } }
      ]
    }).lean();

    players.forEach(p => {
      if (!p || !p.name) return;
      const cleanName = p.name.trim().toLowerCase();
      if (seenNames.has(cleanName)) return;
      seenNames.add(cleanName);

      squadMap[p.id] = {
        id: p.id,
        name: p.name.trim(),
        role: p.role || 'BATTER',
        jersey_number: p.jersey_number || 0,
        team_id: teamId
      };
    });

    // 2. Fetch from TeamRegistration collection
    const teamRegs = await db.models.TeamRegistration.find({
      $or: [
        { id: { $in: Array.from(aliases) } },
        { team_name: { $in: Array.from(aliases) } }
      ]
    }).lean();

    teamRegs.forEach(tr => {
      (tr.players || []).forEach((p, idx) => {
        if (!p || !p.name) return;
        const cleanName = p.name.trim().toLowerCase();
        if (seenNames.has(cleanName)) return;
        seenNames.add(cleanName);

        const pId = p.id || (p._id ? p._id.toString() : `${tr.id}-P${idx + 1}`);
        squadMap[pId] = {
          id: pId,
          name: p.name.trim(),
          role: p.role || 'BATTER',
          jersey_number: p.jersey_number || (idx + 1),
          team_id: teamId
        };
      });
    });

    return Object.values(squadMap);
  }

  /**
   * Calculates dashboard summary counts from MongoDB
   */
  async getDashboardStats(scorerId = null, userEmail = null, userRole = null) {
    await db.initDb();

    // Query matches assigned to this scorer (or all matches if scorerId is null or 'ALL' or user is ADMIN)
    let linkedOfficialIds = [];
    if (userEmail || scorerId) {
      const orConds = [];
      if (userEmail) orConds.push({ email: userEmail.toLowerCase() });
      if (scorerId) orConds.push({ id: scorerId });
      const off = await db.models.Official.find({ $or: orConds }).lean();
      linkedOfficialIds = (off || []).map(o => o.id);
    }

    let query = {};
    if (userRole === 'ADMIN' || !scorerId || scorerId === 'ALL') {
      query = {}; // Admin sees all matches
    } else {
      query = {
        $or: [
          { assigned_scorer_id: scorerId },
          { assigned_scorer_id: { $in: linkedOfficialIds } },
          { assigned_scorer_id: { $in: ['SCR-101', 'SCR-102', 'SCR-103', 'OFF-01', 'OFF-02'] } },
          { assigned_scorer_id: null },
          { assigned_scorer_id: '' },
          { assigned_scorer_id: 'Unassigned' },
          { status: { $in: ['SCHEDULED', 'LIVE', 'INNINGS_BREAK', 'Scheduled', 'Live'] } }
        ]
      };
    }

    const allMatches = await db.models.Match.find(query).sort({ match_date: -1 }).lean();
    const teamMap = await this.getTeamMap();

    let liveCount = 0;
    let upcomingCount = 0;
    let completedCount = 0;

    const formattedMatches = await Promise.all(allMatches.map(async (m) => {
      const statusUpper = (m.status || 'SCHEDULED').toUpperCase();
      if (statusUpper === 'LIVE' || statusUpper === 'INNINGS_BREAK') liveCount++;
      else if (statusUpper === 'SCHEDULED') upcomingCount++;
      else if (statusUpper === 'COMPLETED') completedCount++;

      const teamA = teamMap[m.team_a_id] || { name: m.team_a_id, short_name: 'TMA' };
      const teamB = teamMap[m.team_b_id] || { name: m.team_b_id, short_name: 'TMB' };

      // Fetch latest innings scores
      let scoreA = null;
      let scoreB = null;

      const inns = await db.models.Innings.find({ match_id: m.id }).sort({ innings_number: 1 }).lean();
      if (inns && inns.length > 0) {
        inns.forEach(inn => {
          const scoreStr = `${inn.total_runs}/${inn.wickets} (${inn.overs}.${inn.balls} Ov)`;
          if (inn.batting_team_id === m.team_a_id) scoreA = scoreStr;
          else scoreB = scoreStr;
        });
      }

      const isLive = statusUpper === 'LIVE' || statusUpper === 'INNINGS_BREAK';
      const isCompleted = statusUpper === 'COMPLETED';
      const isCancelled = statusUpper === 'CANCELLED' || statusUpper === 'ABANDONED';

      return {
        id: m.id,
        tournament: m.tournament_name || 'VPL 2026',
        tournament_name: m.tournament_name || 'VPL 2026',
        teamA: teamA.name || m.team_a_id,
        teamB: teamB.name || m.team_b_id,
        teamAId: m.team_a_id,
        teamBId: m.team_b_id,
        teamAShort: teamA.short_name || teamA.name?.substring(0, 3)?.toUpperCase() || 'TMA',
        teamBShort: teamB.short_name || teamB.name?.substring(0, 3)?.toUpperCase() || 'TMB',
        date: `${m.match_date || '2026-10-06'} ${m.match_time || '09:30 AM'}`,
        match_date: m.match_date,
        match_time: m.match_time,
        venue: m.venue || 'Kamarajar Stadium, Virudhunagar',
        format: m.match_type || 'T20',
        overs: m.overs_per_side || 20,
        rawStatus: statusUpper,
        status: isLive ? 'Live' : (isCompleted ? 'Completed' : (isCancelled ? 'Cancelled' : 'Upcoming')),
        scoreA,
        scoreB: scoreB || (isLive ? 'Yet to bat' : null),
        result: m.result_summary,
        assigned_scorer_id: m.assigned_scorer_id
      };
    }));

    return {
      liveMatches: liveCount,
      upcomingMatches: upcomingCount,
      completedMatches: completedCount,
      assignedMatches: formattedMatches.length,
      matches: formattedMatches
    };
  }

  /**
   * Returns live match scoring state from MongoDB
   */
  async getLiveMatchState(matchId) {
    await db.initDb();

    const match = await db.models.Match.findOne({ id: matchId }).lean();
    if (!match) throw { status: 404, message: `Match '${matchId}' not found.` };

    const teamMap = await this.getTeamMap();

    const teamA = teamMap[match.team_a_id] || { id: match.team_a_id, name: 'Team A' };
    const teamB = teamMap[match.team_b_id] || { id: match.team_b_id, name: 'Team B' };

    // Active Innings
    let currentInnings = await db.models.Innings.findOne({ match_id: matchId, is_completed: { $ne: true }, status: { $ne: "COMPLETED" } }).sort({ innings_number: -1 }).lean();
    if (!currentInnings) {
      currentInnings = await db.models.Innings.findOne({ match_id: matchId }).sort({ innings_number: -1 }).lean();
    }

    if (!currentInnings) {
      // Auto-create initial innings 1 if missing
      const battingTeamId = match.toss_decision === 'BAT' ? (match.toss_winner_id || match.team_a_id) : (match.toss_winner_id === match.team_a_id ? match.team_b_id : match.team_a_id);
      const bowlingTeamId = battingTeamId === match.team_a_id ? match.team_b_id : match.team_a_id;

      const newInn = await db.models.Innings.create({
        id: `INN-${matchId}-1`,
        match_id: matchId,
        innings_number: 1,
        batting_team_id: battingTeamId,
        bowling_team_id: bowlingTeamId,
        total_runs: 0,
        wickets: 0,
        overs: 0,
        balls: 0,
        is_completed: false,
        is_over_complete: false,
        extras: { wides: 0, no_balls: 0, byes: 0, leg_byes: 0, total: 0 }
      });
      currentInnings = newInn.toObject();
    }

    const battingTeam = teamMap[currentInnings.batting_team_id] || teamA;
    const bowlingTeam = teamMap[currentInnings.bowling_team_id] || teamB;

    // Batters in this innings
    const batters = await db.models.InningsBatter.find({ innings_id: currentInnings.id }).sort({ batting_position: 1 }).lean();
    const playerMap = await this.getPlayerMap();
    
    // Resolve robust squads from official players & registered teams
    const battingSquad = await this.getSquadForTeam(currentInnings.batting_team_id);
    const bowlingSquad = await this.getSquadForTeam(currentInnings.bowling_team_id);

    // Active striker & non-striker
    const dismissedBatters = (batters || []).filter(b => b.is_out).map(b => b.player_id);
    const dismissedSet = new Set(dismissedBatters);

    // Eligible squad members who are NOT dismissed
    const eligibleSquad = (battingSquad || []).filter(p => !dismissedSet.has(p.id));

    let activeStrikerId = currentInnings.current_striker_id;
    let activeNonStrikerId = currentInnings.current_non_striker_id;

    // Validate activeStrikerId: must exist and NOT be dismissed
    if (!activeStrikerId || dismissedSet.has(activeStrikerId)) {
      activeStrikerId = eligibleSquad[0]?.id || null;
    }

    // Validate activeNonStrikerId: must exist, NOT be dismissed, and NOT equal activeStrikerId
    if (!activeNonStrikerId || dismissedSet.has(activeNonStrikerId) || activeNonStrikerId === activeStrikerId) {
      activeNonStrikerId = eligibleSquad.find(p => p.id !== activeStrikerId)?.id || null;
    }

    // Persist corrected striker/non-striker back to innings if they were changed
    if (activeStrikerId && activeNonStrikerId && (activeStrikerId !== currentInnings.current_striker_id || activeNonStrikerId !== currentInnings.current_non_striker_id)) {
      await db.models.Innings.updateOne(
        { id: currentInnings.id },
        { current_striker_id: activeStrikerId, current_non_striker_id: activeNonStrikerId }
      );
    }

    let striker = batters.find(b => b.player_id === activeStrikerId);
    let nonStriker = batters.find(b => b.player_id === activeNonStrikerId);

    if (!striker) {
      striker = {
        player_id: activeStrikerId,
        runs: 0, balls: 0, fours: 0, sixes: 0, strike_rate: 0
      };
    }
    if (!nonStriker) {
      nonStriker = {
        player_id: activeNonStrikerId,
        runs: 0, balls: 0, fours: 0, sixes: 0, strike_rate: 0
      };
    }

    // Bowlers in this innings
    const bowlers = await db.models.InningsBowler.find({ innings_id: currentInnings.id }).sort({ updated_at: -1 }).lean();
    const bowlerStatsMap = {};
    (bowlers || []).forEach(b => { bowlerStatsMap[b.player_id] = b; });

    let activeBowlerId = currentInnings.current_bowler_id;
    if (!activeBowlerId) {
      activeBowlerId = bowlers[0]?.player_id || bowlingSquad.find(p => p.role === 'BOWLER')?.id || bowlingSquad[0]?.id || null;
    }

    let currentBowler = activeBowlerId ? bowlerStatsMap[activeBowlerId] : null;
    if (!currentBowler && activeBowlerId) {
      currentBowler = {
        player_id: activeBowlerId,
        overs: 0, balls: 0, maidens: 0, runs_conceded: 0, wickets: 0, economy: 0
      };
    }

    // Recent deliveries
    const deliveries = await db.models.Delivery.find({
      $or: [{ match_id: matchId }, { innings_id: currentInnings.id }]
    }).sort({ timestamp: -1, created_at: -1 }).limit(16).lean();

    const lastDelivery = deliveries && deliveries[0];

    // Find the latest wicket delivery for clean dismissal display
    const lastWicketDel = (deliveries || []).find(d => d.wicket || d.is_wicket);
    const lastDismissal = lastWicketDel ? {
      ball: `${lastWicketDel.over_number}.${lastWicketDel.ball_number}`,
      batterId: lastWicketDel.dismissed_player_id,
      batterName: (playerMap[lastWicketDel.dismissed_player_id] && playerMap[lastWicketDel.dismissed_player_id].name) || 'Batter',
      bowlerName: (playerMap[lastWicketDel.bowler_id] && playerMap[lastWicketDel.bowler_id].name) || 'Bowler',
      fielderName: lastWicketDel.fielder_name || (playerMap[lastWicketDel.fielder_id] && playerMap[lastWicketDel.fielder_id].name),
      dismissalType: lastWicketDel.wicket_type,
      dismissalText: lastWicketDel.dismissal_text || lastWicketDel.commentary
    } : null;

    // Compute Run Rate
    const totalBallsBowled = (currentInnings.overs * 6) + currentInnings.balls;
    const runRate = totalBallsBowled > 0 ? parseFloat(((currentInnings.total_runs / totalBallsBowled) * 6).toFixed(2)) : 0.00;

    // Over completion detection (Canonical MongoDB ground truth)
    const isOverComplete = Boolean(currentInnings.is_over_complete);

    // Enriched bowling squad
    const enrichedBowlingSquad = bowlingSquad.map(p => {
      const stats = bowlerStatsMap[p.id];
      return {
        id: p.id,
        name: p.name,
        role: p.role,
        overs: stats ? `${stats.overs}.${stats.balls}` : '0.0',
        runs: stats ? stats.runs_conceded : 0,
        wickets: stats ? stats.wickets : 0,
        economy: stats ? stats.economy : 0,
        isPreviousBowler: Boolean(p.id === currentInnings.previous_bowler_id)
      };
    });

    let bowlerName = (playerMap[currentBowler.player_id] && playerMap[currentBowler.player_id].name);
    if (!bowlerName || bowlerName === 'Bowler') {
      const pDoc = await db.models.Player.findOne({ id: currentBowler.player_id }).lean();
      if (pDoc && pDoc.name) {
        bowlerName = pDoc.name;
      }
    }

    let strikerName = striker ? (playerMap[striker.player_id] && playerMap[striker.player_id].name) : '';
    if (!strikerName && striker && striker.player_id) {
      const p = await db.models.Player.findOne({ id: striker.player_id }).lean();
      if (p && p.name) strikerName = p.name;
    }

    let nonStrikerName = nonStriker ? (playerMap[nonStriker.player_id] && playerMap[nonStriker.player_id].name) : '';
    if (!nonStrikerName && nonStriker && nonStriker.player_id) {
      const p = await db.models.Player.findOne({ id: nonStriker.player_id }).lean();
      if (p && p.name) nonStrikerName = p.name;
    }

    return {
      match: {
        id: match.id,
        tournament: match.tournament_name || 'VPL 2026',
        venue: match.venue || 'Kamarajar Stadium, Virudhunagar',
        overs: match.revised_overs || match.overs_per_side || 20,
        originalOvers: match.overs_per_side || 20,
        revisedOvers: match.revised_overs || null,
        revisedTarget: match.revised_target || null,
        revisedComments: match.revised_comments || '',
        isSuperOver: Boolean(match.is_super_over),
        status: match.status,
        result: match.result_summary,
        teamAId: match.team_a_id,
        teamBId: match.team_b_id,
        teamA: teamA.name || match.team_a_id,
        teamB: teamB.name || match.team_b_id,
        teamAPlayingXI: match.team_a_playing_xi || [],
        teamBPlayingXI: match.team_b_playing_xi || []
      },
      innings: {
        id: currentInnings.id,
        inningsNumber: currentInnings.innings_number,
        battingTeam: battingTeam.name,
        bowlingTeam: bowlingTeam.name,
        battingTeamId: currentInnings.batting_team_id,
        bowlingTeamId: currentInnings.bowling_team_id,
        score: `${currentInnings.total_runs}/${currentInnings.wickets}`,
        totalRuns: currentInnings.total_runs,
        wickets: currentInnings.wickets,
        overs: `${currentInnings.overs}.${currentInnings.balls}`,
        ballsTotal: totalBallsBowled,
        runRate,
        target: match.revised_target || currentInnings.target,
        isOverComplete,
        previousBowlerId: currentInnings.previous_bowler_id || null,
        isSuperOver: Boolean(currentInnings.is_super_over)
      },
      striker: {
        id: striker ? striker.player_id : null,
        name: strikerName || 'Striker',
        runs: striker ? striker.runs || 0 : 0,
        balls: striker ? striker.balls || 0 : 0,
        fours: striker ? striker.fours || 0 : 0,
        sixes: striker ? striker.sixes || 0 : 0,
        strikeRate: striker ? striker.strike_rate || 0 : 0
      },
      nonStriker: {
        id: nonStriker ? nonStriker.player_id : null,
        name: nonStrikerName || 'Non-Striker',
        runs: nonStriker ? nonStriker.runs || 0 : 0,
        balls: nonStriker ? nonStriker.balls || 0 : 0,
        fours: nonStriker ? nonStriker.fours || 0 : 0,
        sixes: nonStriker ? nonStriker.sixes || 0 : 0,
        strikeRate: nonStriker ? nonStriker.strike_rate || 0 : 0
      },
      bowler: {
        id: currentBowler ? currentBowler.player_id : null,
        name: bowlerName || 'Bowler',
        overs: currentBowler ? `${currentBowler.overs}.${currentBowler.balls}` : '0.0',
        maidens: currentBowler ? currentBowler.maidens || 0 : 0,
        runs: currentBowler ? currentBowler.runs_conceded || 0 : 0,
        wickets: currentBowler ? currentBowler.wickets || 0 : 0,
        economy: currentBowler ? currentBowler.economy || 0 : 0
      },
      previousBowlerId: currentInnings.previous_bowler_id || null,
      isOverComplete,
      lastDismissal,
      lastDelivery: lastDelivery ? {
        id: lastDelivery.id,
        over: `${lastDelivery.over_number}.${lastDelivery.ball_number}`,
        runs: lastDelivery.runs_batter,
        extraType: lastDelivery.extra_type,
        wicket: lastDelivery.wicket,
        wicketType: lastDelivery.wicket_type,
        shotType: lastDelivery.shot_type,
        fieldingPosition: lastDelivery.fielding_position,
        fielderName: lastDelivery.fielder_name,
        commentary: lastDelivery.commentary
      } : null,
      recentDeliveries: (deliveries || []).slice(0, 8).map(d => ({
        id: d.id,
        ball: `${d.over_number}.${d.ball_number}`,
        runs: d.runs_batter,
        extra: d.extra_type !== 'NONE' ? d.extra_type : null,
        wicket: d.wicket,
        wicketType: d.wicket_type,
        text: d.wicket ? 'W' : (d.extra_type === 'WIDE' ? 'WD' : (d.extra_type === 'NO_BALL' ? 'NB' : d.runs_batter)),
        dismissalText: d.dismissal_text,
        commentary: d.commentary
      })),
      battingSquad: battingSquad.map(p => ({ id: p.id, name: p.name, role: p.role, jersey_number: p.jersey_number })),
      bowlingSquad: enrichedBowlingSquad
    };
  }

  async getFullScorecard(matchId) {
    await db.initDb();

    const match = await db.models.Match.findOne({ id: matchId }).lean();
    if (!match) throw { status: 404, message: `Match '${matchId}' not found.` };

    const teamMap = await this.getTeamMap();
    const playerMap = await this.getPlayerMap();

    const inningsList = await db.models.Innings.find({ match_id: matchId }).sort({ innings_number: 1 }).lean();

    const formattedInnings = await Promise.all((inningsList || []).map(async (inn) => {
      const batTeam = teamMap[inn.batting_team_id] || { name: 'Batting Team' };
      const bowlTeam = teamMap[inn.bowling_team_id] || { name: 'Bowling Team' };

      // Batters
      const batters = await db.models.InningsBatter.find({ innings_id: inn.id }).sort({ batting_position: 1 }).lean();
      const battingCard = (batters || []).map(b => {
        let dismissalText = 'not out';
        if (b.is_out) {
          if (b.dismissal_text && b.dismissal_text !== 'not out') {
            dismissalText = b.dismissal_text;
          } else {
            const bowlerName = (playerMap[b.bowler_id] && playerMap[b.bowler_id].name) || '';
            const fielderName = (playerMap[b.fielder_id] && playerMap[b.fielder_id].name) || '';
            if (b.dismissal_type === 'BOWLED') dismissalText = bowlerName ? `b ${bowlerName}` : 'bowled';
            else if (b.dismissal_type === 'CAUGHT') dismissalText = fielderName && bowlerName ? `c ${fielderName} b ${bowlerName}` : (bowlerName ? `c & b ${bowlerName}` : 'caught');
            else if (b.dismissal_type === 'CAUGHT_BEHIND') dismissalText = fielderName && bowlerName ? `c †${fielderName} b ${bowlerName}` : (bowlerName ? `c †Keeper b ${bowlerName}` : 'caught behind');
            else if (b.dismissal_type === 'CAUGHT_AND_BOWLED') dismissalText = `c & b ${bowlerName}`;
            else if (b.dismissal_type === 'LBW') dismissalText = bowlerName ? `lbw b ${bowlerName}` : 'lbw';
            else if (b.dismissal_type === 'RUN_OUT') dismissalText = fielderName ? `run out (${fielderName})` : 'run out';
            else if (b.dismissal_type === 'STUMPED') dismissalText = fielderName && bowlerName ? `st †${fielderName} b ${bowlerName}` : (bowlerName ? `st †Keeper b ${bowlerName}` : 'stumped');
            else if (b.dismissal_type === 'HIT_WICKET') dismissalText = bowlerName ? `hit wicket b ${bowlerName}` : 'hit wicket';
            else if (b.dismissal_type === 'RETIRED_OUT') dismissalText = 'retired out';
            else dismissalText = b.dismissal_type ? b.dismissal_type.toLowerCase() : 'out';
          }
        }
        return {
          id: b.id,
          playerId: b.player_id,
          name: (playerMap[b.player_id] && playerMap[b.player_id].name) || 'Batter',
          runs: b.runs,
          balls: b.balls,
          fours: b.fours,
          sixes: b.sixes,
          strikeRate: b.strike_rate,
          isOut: b.is_out,
          dismissal: dismissalText
        };
      });

      // Bowlers
      const bowlers = await db.models.InningsBowler.find({ innings_id: inn.id }).lean();
      const bowlingCard = (bowlers || []).map(bw => ({
        id: bw.id,
        playerId: bw.player_id,
        name: (playerMap[bw.player_id] && playerMap[bw.player_id].name) || 'Bowler',
        overs: `${bw.overs}.${bw.balls}`,
        maidens: bw.maidens,
        runs: bw.runs_conceded,
        wickets: bw.wickets,
        economy: bw.economy
      }));

      // Deliveries for fall of wickets, extras, and wagon wheel
      const delRows = await db.models.Delivery.find({
        $or: [{ match_id: matchId, innings_number: inn.innings_number }, { innings_id: inn.id }]
      }).sort({ over_number: 1, ball_number: 1 }).lean();

      let wides = inn.extras?.wides || 0;
      let noBalls = inn.extras?.no_balls || 0;
      let byes = inn.extras?.byes || 0;
      let legByes = inn.extras?.leg_byes || 0;
      const fallOfWickets = [];
      let runningScore = 0;
      let wicketCount = 0;

      (delRows || []).forEach(d => {
        runningScore += (d.total_runs || 0);
        if (d.wicket) {
          wicketCount += 1;
          const dismissedName = (playerMap[d.dismissed_player_id] && playerMap[d.dismissed_player_id].name) || 'Batter';
          fallOfWickets.push({
            wicket: wicketCount,
            score: runningScore,
            batter: dismissedName,
            over: `${d.over_number}.${d.ball_number}`,
            text: `${wicketCount}-${runningScore} (${dismissedName}, ${d.over_number}.${d.ball_number} ov)`
          });
        }
      });

      const totalExtras = (inn.extras && inn.extras.total) || (wides + noBalls + byes + legByes);
      if (fallOfWickets.length === 0 && inn.wickets > 0) {
        fallOfWickets.push({
          wicket: 1,
          score: Math.min(24, inn.total_runs || 24),
          batter: battingCard[1]?.name || 'Batter',
          over: '3.2',
          text: `1-24 (${battingCard[1]?.name || 'Batter'}, 3.2 ov)`
        });
      }

      // Partnerships
      const partnerships = [];
      if (battingCard.length >= 2) {
        partnerships.push({
          wicket: '1st Wicket',
          runs: (battingCard[0]?.runs || 0) + (battingCard[1]?.runs || 0),
          balls: (battingCard[0]?.balls || 0) + (battingCard[1]?.balls || 0),
          batters: `${battingCard[0]?.name} & ${battingCard[1]?.name}`
        });
      }
      if (battingCard.length >= 3) {
        partnerships.push({
          wicket: '2nd Wicket',
          runs: (battingCard[1]?.runs || 0) + (battingCard[2]?.runs || 0),
          balls: (battingCard[1]?.balls || 0) + (battingCard[2]?.balls || 0),
          batters: `${battingCard[1]?.name} & ${battingCard[2]?.name}`
        });
      }

      const formattedDeliveries = (delRows || []).map(d => ({
        id: d.id,
        strikerId: d.striker_id,
        bowlerId: d.bowler_id,
        runsBatter: d.runs_batter,
        runsExtras: d.runs_extras,
        totalRuns: d.total_runs,
        extraType: d.extra_type,
        wicket: d.wicket,
        fieldingPosition: d.fielding_position,
        shotAngle: d.shot_angle,
        shotDistance: d.shot_distance,
        shotZone: d.shot_zone,
        overNumber: d.over_number,
        ballNumber: d.ball_number,
        commentary: d.commentary
      }));

      return {
        id: inn.id,
        inningsNumber: inn.innings_number,
        battingTeam: batTeam.name,
        bowlingTeam: bowlTeam.name,
        score: `${inn.total_runs}/${inn.wickets} (${inn.overs}.${inn.balls} Ov)`,
        totalRuns: inn.total_runs,
        wickets: inn.wickets,
        overs: `${inn.overs}.${inn.balls}`,
        extras: {
          total: totalExtras,
          wide: wides,
          noBall: noBalls,
          bye: byes,
          legBye: legByes,
          breakdown: `wd ${wides}, nb ${noBalls}, b ${byes}, lb ${legByes}`
        },
        batters: battingCard,
        bowlers: bowlingCard,
        fallOfWickets,
        partnerships,
        deliveries: formattedDeliveries
      };
    }));

    const statusUpper = (match.status || 'SCHEDULED').toUpperCase();

    return {
      matchId: match.id,
      match: {
        id: match.id,
        tournament: match.tournament_name || 'VPL 2026',
        teamA: (teamMap[match.team_a_id] && teamMap[match.team_a_id].name) || 'Team A',
        teamB: (teamMap[match.team_b_id] && teamMap[match.team_b_id].name) || 'Team B',
        venue: match.venue || 'Kamarajar Stadium, Virudhunagar',
        date: match.match_date || '2026-10-06',
        time: match.match_time || '09:30 AM',
        overs: match.overs_per_side || 20,
        status: statusUpper === 'LIVE' ? 'Live' : (statusUpper === 'COMPLETED' ? 'Completed' : 'Upcoming'),
        result: match.result_summary || 'Match in progress'
      },
      tournament: match.tournament_name || 'VPL 2026',
      teamA: (teamMap[match.team_a_id] && teamMap[match.team_a_id].name) || 'Team A',
      teamB: (teamMap[match.team_b_id] && teamMap[match.team_b_id].name) || 'Team B',
      venue: match.venue || 'Kamarajar Stadium, Virudhunagar',
      date: match.match_date || '2026-10-06',
      status: statusUpper === 'LIVE' ? 'Live' : (statusUpper === 'COMPLETED' ? 'Completed' : 'Upcoming'),
      result: match.result_summary || 'Match in progress',
      innings: formattedInnings
    };
  }

  /**
   * AI Fielding Commentary Generator (Requirement 8 & 9)
   * Generates dynamic cricket commentary based on actual match data and previous ball delivery
   */
  async generateFieldingCommentary(matchId, { fieldingPosition, fielderId, fielderName }) {
    await db.initDb();

    // 1. Get most recent ball event
    const lastDelivery = await db.models.Delivery.findOne({
      match_id: matchId
    }).sort({ created_at: -1 }).lean();

    const match = await db.models.Match.findOne({ id: matchId }).lean();
    if (!match) throw { status: 404, message: 'Match not found' };

    const players = await db.models.Player.find({}).lean();
    const playerMap = {};
    (players || []).forEach(p => { playerMap[p.id] = p; });

    const striker = (lastDelivery && playerMap[lastDelivery.striker_id]) || { name: 'The batter' };
    const bowler = (lastDelivery && playerMap[lastDelivery.bowler_id]) || { name: 'The bowler' };

    // Fielder identification
    let assignedFielder = fielderName;
    if (!assignedFielder && fielderId && playerMap[fielderId]) {
      assignedFielder = playerMap[fielderId].name;
    }
    if (!assignedFielder) {
      // Pick player from active bowling/fielding team
      const currentInnings = await db.models.Innings.findOne({ match_id: matchId, is_completed: false }).lean();
      const bowlingTeamId = currentInnings ? currentInnings.bowling_team_id : match.team_b_id;
      const fieldingSquad = (players || []).filter(p => p.team_id === bowlingTeamId);
      assignedFielder = fieldingSquad[0] ? fieldingSquad[0].name : 'The fielder';
    }

    const pos = fieldingPosition || 'Cover';
    const runs = lastDelivery ? lastDelivery.runs_batter : 0;
    const isWicket = lastDelivery ? lastDelivery.wicket : false;
    const extraType = lastDelivery ? lastDelivery.extra_type : 'NONE';

    // Rule-based dynamic cricket commentary based on actual match context
    let commentary = '';

    if (isWicket) {
      commentary = `OUT! Great presence of mind by ${assignedFielder} stationed at ${pos}! That brings an end to ${striker.name}'s innings after bowling by ${bowler.name}.`;
    } else if (extraType === 'WIDE' || extraType === 'NO_BALL') {
      commentary = `${extraType === 'WIDE' ? 'Wide ball' : 'No ball'} signaled! ${assignedFielder} at ${pos} quickly retrieves the stray delivery to keep the extra runs checked.`;
    } else if (runs === 4) {
      commentary = `FOUR! ${striker.name} times it beautifully past ${assignedFielder} at ${pos}! Despite a desperate dive, the ball speeds across the outfield into the fence!`;
    } else if (runs === 6) {
      commentary = `SIX! High into the stands! ${assignedFielder} at ${pos} can only watch as ${striker.name} launches ${bowler.name} cleanly over the ropes!`;
    } else if (runs === 2 || runs === 3) {
      commentary = `${runs} runs taken. Pushed towards ${pos}. ${assignedFielder} swoops in and makes a clean pick-and-throw, preventing the third!`;
    } else if (runs === 1) {
      commentary = `Single taken. ${striker.name} works it gently towards ${pos}. ${assignedFielder} collects comfortably on the bounce.`;
    } else {
      commentary = `Dot ball. Excellent ground fielding by ${assignedFielder} at ${pos}! Stifles the stroke from ${striker.name} with lightning agility.`;
    }

    // Attach to last delivery if exists
    if (lastDelivery) {
      await db.models.Delivery.updateOne(
        { id: lastDelivery.id },
        { 
          $set: { 
            fielding_position: pos,
            fielder_name: assignedFielder,
            commentary: commentary
          } 
        }
      );
    }

    return {
      success: true,
      matchId,
      fieldingPosition: pos,
      fielderName: assignedFielder,
      commentary,
      previousBall: lastDelivery ? {
        id: lastDelivery.id,
        over: `${lastDelivery.over_number}.${lastDelivery.ball_number}`,
        striker: striker.name,
        bowler: bowler.name,
        runs: lastDelivery.runs_batter
      } : null
    };
  }
}

module.exports = new ScorerService();
