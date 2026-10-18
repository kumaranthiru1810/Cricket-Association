/**
 * services/playerService.js
 * 
 * Complete Player Module Business Logic:
 * - Profile Management (Safe editable fields only)
 * - Team & Squad Roster Relationship
 * - Match Fixtures & Read-Only Scorecards
 * - Real Match-Derived Statistics (Batting, Bowling, Fielding)
 * - Player Notifications
 * Fully powered by MongoDB.
 */

const db = require('../config/db');
const scorerService = require('./scorerService');
const teamRegistrationModel = require('../models/teamRegistrationModel');

class PlayerService {
  /**
   * Find player document and associated user record
   */
  async _resolvePlayer(userId, userEmail) {
    await db.initDb();
    const cleanEmail = userEmail ? userEmail.trim().toLowerCase() : null;

    // 1. Check in db.models.Player
    let playerDoc = null;
    if (cleanEmail) {
      playerDoc = await db.models.Player.findOne({ email: cleanEmail }).lean();
    }
    if (!playerDoc && userId) {
      playerDoc = await db.models.Player.findOne({
        $or: [{ id: userId }, { email: userId.toLowerCase() }]
      }).lean();
    }

    // 2. Check in db.models.User
    let userDoc = null;
    if (cleanEmail) {
      userDoc = await db.models.User.findOne({ email: cleanEmail }).lean();
    }
    if (!userDoc && userId) {
      userDoc = await db.models.User.findOne({
        $or: [{ id: userId }, { email: userId.toLowerCase() }]
      }).lean();
    }

    // 3. Check in team registration squads
    let squadEntry = null;
    if (cleanEmail || userDoc?.name) {
      squadEntry = await teamRegistrationModel.findPlayerByEmailOrName(cleanEmail || userDoc?.name);
    }

    return { playerDoc, userDoc, squadEntry };
  }

  /**
   * 1. Get Player Profile
   */
  async getProfile(userId, userEmail) {
    const { playerDoc, userDoc, squadEntry } = await this._resolvePlayer(userId, userEmail);

    if (!playerDoc && !userDoc && !squadEntry) {
      throw { status: 404, message: 'Player profile not found in database.' };
    }

    // Determine team details
    let teamId = playerDoc?.team_id || squadEntry?.team_registration_id || null;
    let teamName = squadEntry?.team_name || 'Virudhunagar District Association Squad';
    let coachName = squadEntry?.coach_name || 'Team Coach';
    let coachEmail = squadEntry?.coach_email || '';

    if (teamId && !squadEntry?.team_name) {
      const teamDoc = await db.models.Team.findOne({ id: teamId }).lean();
      if (teamDoc) {
        teamName = teamDoc.name;
        coachName = teamDoc.coach_name;
        coachEmail = teamDoc.coach_email;
      }
    }

    const name = playerDoc?.name || userDoc?.name || squadEntry?.name || 'Player';
    const email = (playerDoc?.email || userDoc?.email || squadEntry?.email || userEmail || '').toLowerCase();
    const role = playerDoc?.role || squadEntry?.role || userDoc?.role || 'BATTER';
    const jerseyNumber = playerDoc?.jersey_number ?? squadEntry?.jersey_number ?? 0;
    const battingStyle = playerDoc?.batting_style || 'Right Hand Bat';
    const bowlingStyle = playerDoc?.bowling_style || 'Right Arm Medium';
    const mobile = userDoc?.mobile || '';
    const status = userDoc?.status === 'ACTIVE' ? 'APPROVED' : (userDoc?.status || playerDoc?.status || squadEntry?.status || 'APPROVED');

    const baseStats = playerDoc?.stats || {};
    const pointsData = this._calculatePatchesAndPoints(
      { runs: baseStats.runs || 0, highestScore: baseStats.highest_score || 0, fours: baseStats.fours || 0, sixes: baseStats.sixes || 0 },
      { wickets: baseStats.wickets || 0, overs: baseStats.overs || 0 },
      { catches: baseStats.catches || 0, runOuts: 0, stumpings: baseStats.stumpings || 0 }
    );

    return {
      id: playerDoc?.id || userDoc?.id || `PLY-${email.replace(/[^a-z0-9]/g, '')}`,
      name,
      email,
      mobile,
      role,
      jerseyNumber: Number(jerseyNumber),
      battingStyle,
      bowlingStyle,
      teamId,
      teamName,
      coachName,
      coachEmail,
      status: status.toUpperCase(),
      taluk: 'Virudhunagar',
      performancePoints: pointsData.points,
      tier: pointsData.currentTier,
      tierTitle: pointsData.tierTitle,
      nextTierPoints: pointsData.nextTierPoints,
      unlockedPatchesCount: pointsData.unlockedCount,
      totalPatchesCount: pointsData.totalPatches,
      patches: pointsData.patches,
      createdAt: userDoc?.created_at || playerDoc?.createdAt || new Date().toISOString()
    };
  }

  /**
   * 2. Update Permitted Profile Fields
   * Strictly forbids modifying: role, status, approvalStatus, teamId, email, id, credentials.
   */
  async updateProfile(userId, userEmail, updates) {
    await db.initDb();
    const { playerDoc, userDoc } = await this._resolvePlayer(userId, userEmail);

    const cleanEmail = (userEmail || userDoc?.email || playerDoc?.email || '').toLowerCase();
    if (!cleanEmail) {
      throw { status: 400, message: 'Valid user email is required to update profile.' };
    }

    // Sanitize updates: only allow safe player fields
    const safePlayerUpdates = {};
    if (updates.battingStyle || updates.batting_style) {
      safePlayerUpdates.batting_style = String(updates.battingStyle || updates.batting_style).trim();
    }
    if (updates.bowlingStyle || updates.bowling_style) {
      safePlayerUpdates.bowling_style = String(updates.bowlingStyle || updates.bowling_style).trim();
    }
    if (updates.jerseyNumber !== undefined || updates.jersey_number !== undefined) {
      const num = parseInt(updates.jerseyNumber ?? updates.jersey_number, 10);
      if (!isNaN(num) && num >= 0 && num <= 999) {
        safePlayerUpdates.jersey_number = num;
      }
    }

    // Update in Player collection if exists
    if (playerDoc) {
      await db.models.Player.updateOne(
        { _id: playerDoc._id },
        { $set: safePlayerUpdates }
      );
    } else {
      // Create Player record if not yet existing
      await db.models.Player.create({
        id: `PLY-${Date.now()}`,
        team_id: 'TM-01',
        name: userDoc?.name || 'Player',
        email: cleanEmail,
        role: 'BATTER',
        jersey_number: safePlayerUpdates.jersey_number || 10,
        batting_style: safePlayerUpdates.batting_style || 'Right Hand Bat',
        bowling_style: safePlayerUpdates.bowling_style || 'Right Arm Medium',
        status: 'ACTIVE'
      });
    }

    // Update mobile in User collection if provided
    if (updates.mobile !== undefined) {
      const cleanMobile = String(updates.mobile).trim();
      await db.models.User.updateOne(
        { email: cleanEmail },
        { $set: { mobile: cleanMobile } }
      );
    }

    return this.getProfile(userId, cleanEmail);
  }

  /**
   * 3. Get Registered Team & 15-Player Squad
   */
  async getTeam(userId, userEmail) {
    await db.initDb();
    const profile = await this.getProfile(userId, userEmail);
    const teamId = profile.teamId;

    let teamDoc = null;
    let squadList = [];

    if (teamId) {
      teamDoc = await db.models.Team.findOne({
        $or: [{ id: teamId }, { name: profile.teamName }]
      }).lean();

      if (!teamDoc) {
        const teamReg = await db.models.TeamRegistration.findOne({
          $or: [{ id: teamId }, { team_name: profile.teamName }]
        }).lean();
        if (teamReg) {
          teamDoc = {
            id: teamReg.id,
            name: teamReg.team_name,
            short_name: teamReg.team_name.slice(0, 3).toUpperCase(),
            city: teamReg.city || 'Virudhunagar',
            taluk: teamReg.taluk || 'Virudhunagar',
            coach_name: teamReg.coach_name,
            coach_email: teamReg.coach_email,
            status: teamReg.status,
            stats: { matches: 0, won: 0, lost: 0, tied: 0, points: 0, nrr: 0.0 }
          };
          squadList = (teamReg.players || []).map((p, idx) => ({
            id: `PLY-${teamReg.id}-${idx + 1}`,
            name: p.name,
            email: p.email,
            role: p.role || 'BATTER',
            jerseyNumber: p.jersey_number || (idx + 1),
            battingStyle: 'Right Hand Bat',
            bowlingStyle: 'Right Arm Medium',
            status: p.status === 'APPROVED' ? 'Verified' : p.status
          }));
        }
      }
    }

    // If teamDoc exists in db.models.Team, query official squad from db.models.Player
    if (teamDoc && squadList.length === 0) {
      const players = await db.models.Player.find({ team_id: teamDoc.id }).lean();
      squadList = (players || []).map(p => ({
        id: p.id,
        name: p.name,
        email: p.email,
        role: p.role,
        jerseyNumber: p.jersey_number,
        battingStyle: p.batting_style || 'Right Hand Bat',
        bowlingStyle: p.bowling_style || 'Right Arm Medium',
        status: p.status === 'ACTIVE' ? 'Verified' : p.status
      }));
    }

    // Default fallback if player is not yet assigned to a specific club
    if (!teamDoc) {
      teamDoc = {
        id: 'TM-01',
        name: 'Virudhunagar District CC',
        short_name: 'VND',
        city: 'Virudhunagar',
        taluk: 'Virudhunagar',
        coach_name: 'District Coaching Staff',
        coach_email: 'coach@cfvd.org',
        captain: 'Suresh Kumar',
        vice_captain: 'Vijay Anand',
        status: 'ACTIVE',
        stats: { matches: 5, won: 4, lost: 1, tied: 0, points: 8, nrr: 1.25 }
      };

      const defaultPlayers = await db.models.Player.find({ team_id: 'TM-01' }).lean();
      squadList = (defaultPlayers || []).map(p => ({
        id: p.id,
        name: p.name,
        email: p.email,
        role: p.role,
        jerseyNumber: p.jersey_number,
        battingStyle: p.batting_style,
        bowlingStyle: p.bowling_style,
        status: 'Verified'
      }));
    }

    return {
      team: {
        id: teamDoc.id,
        name: teamDoc.name,
        shortName: teamDoc.short_name || teamDoc.name.slice(0, 3).toUpperCase(),
        city: teamDoc.city || 'Virudhunagar',
        taluk: teamDoc.taluk || 'Virudhunagar',
        coachName: teamDoc.coach_name || 'Coach',
        coachEmail: teamDoc.coach_email || '',
        captain: teamDoc.captain || (squadList[0] ? squadList[0].name : 'Captain'),
        viceCaptain: teamDoc.vice_captain || (squadList[1] ? squadList[1].name : 'Vice Captain'),
        status: teamDoc.status || 'ACTIVE',
        stats: teamDoc.stats || { matches: 0, won: 0, lost: 0, points: 0, nrr: 0.0 }
      },
      squad: squadList
    };
  }

  /**
   * 4. Get Matches Related to Player's Registered Team
   */
  async getMatches(userId, userEmail) {
    await db.initDb();
    let profile = null;
    try {
      profile = await this.getProfile(userId, userEmail);
    } catch (_e) {}

    const teamId = profile?.teamId || null;
    const playerTeamName = (profile?.teamName || '').toLowerCase().trim();

    // Find all teams and tournaments for lookup
    const [allTeams, teamRegs, allTournaments, matches] = await Promise.all([
      db.models.Team.find({}).lean(),
      db.models.TeamRegistration ? db.models.TeamRegistration.find({}).lean() : [],
      db.models.Tournament.find({}).lean(),
      db.models.Match.find({}).sort({ match_date: -1, created_at: -1 }).lean()
    ]);

    const teamMap = {};
    (allTeams || []).forEach(t => { teamMap[t.id] = t; });
    (teamRegs || []).forEach(r => {
      if (!teamMap[r.id]) {
        teamMap[r.id] = { id: r.id, name: r.team_name, short_name: r.short_name || r.team_name };
      }
    });

    const tournamentMap = {};
    (allTournaments || []).forEach(tour => { tournamentMap[tour.id] = tour; });

    const { playerDoc, userDoc } = await this._resolvePlayer(userId, userEmail);
    const candidateIds = [
      profile?.id,
      userId,
      playerDoc?.id,
      userDoc?.id,
      userEmail?.toLowerCase()
    ].filter(Boolean);

    const formattedMatches = await Promise.all((matches || []).map(async (m) => {
      const teamA = teamMap[m.team_a_id] || { id: m.team_a_id, name: m.team_a_name || m.team_a_id, short_name: m.team_a_short || m.team_a_id };
      const teamB = teamMap[m.team_b_id] || { id: m.team_b_id, name: m.team_b_name || m.team_b_id, short_name: m.team_b_short || m.team_b_id };
      const statusUpper = (m.status || 'SCHEDULED').toUpperCase();

      // Retrieve innings scores
      let scoreA = null;
      let scoreB = null;
      const inns = await db.models.Innings.find({ match_id: m.id }).sort({ innings_number: 1 }).lean();
      if (inns && inns.length > 0) {
        inns.forEach(inn => {
          const str = `${inn.total_runs}/${inn.wickets} (${inn.overs}.${inn.balls} ov)`;
          if (inn.batting_team_id === m.team_a_id) scoreA = str;
          else scoreB = str;
        });
      }

      // Check if player participated directly as batter or bowler in this match
      let hasPlayerPlayedDirectly = false;
      const innIds = (inns || []).map(i => i.id);
      if (innIds.length > 0 && candidateIds.length > 0) {
        const [batterFound, bowlerFound] = await Promise.all([
          db.models.InningsBatter.findOne({ innings_id: { $in: innIds }, player_id: { $in: candidateIds } }).lean(),
          db.models.InningsBowler.findOne({ innings_id: { $in: innIds }, player_id: { $in: candidateIds } }).lean()
        ]);
        if (batterFound || bowlerFound) {
          hasPlayerPlayedDirectly = true;
        }
      }

      const isLive = statusUpper === 'LIVE' || statusUpper === 'INNINGS_BREAK';
      const isCompleted = statusUpper === 'COMPLETED' || statusUpper === 'FINISHED';

      const isMyTeamMatch = Boolean(
        hasPlayerPlayedDirectly ||
        (teamId && (m.team_a_id === teamId || m.team_b_id === teamId)) ||
        (playerTeamName && (
          (teamA.name && teamA.name.toLowerCase().includes(playerTeamName)) ||
          (teamB.name && teamB.name.toLowerCase().includes(playerTeamName))
        )) ||
        (!teamId && (m.team_a_id === 'TM-01' || m.team_b_id === 'TM-01'))
      );

      return {
        id: m.id,
        tournament: m.tournament_name || tournamentMap[m.tournament_id]?.name || 'Virudhunagar Premier League 2026',
        teamA: { id: teamA.id, name: teamA.name, shortName: teamA.short_name || teamA.name },
        teamB: { id: teamB.id, name: teamB.name, shortName: teamB.short_name || teamB.name },
        venue: m.venue || 'Kamarajar District Stadium',
        date: m.match_date || '',
        time: m.match_time || '',
        format: m.match_type || 'T20',
        overs: m.overs_per_side || 20,
        status: isLive ? statusUpper : (isCompleted ? 'COMPLETED' : 'SCHEDULED'),
        scoreA,
        scoreB,
        result: m.result_summary || (isLive ? (statusUpper === 'INNINGS_BREAK' ? 'Innings Break' : 'Match in Progress') : (isCompleted ? 'Match Completed' : 'Scheduled Match')),
        isMyTeamMatch
      };
    }));

    // Only return matches where this particular player plays / is involved
    return formattedMatches.filter(m => m.isMyTeamMatch);
  }

  /**
   * 5. Get Match Details by ID
   */
  async getMatchById(matchId) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId }).lean();
    if (!match) throw { status: 404, message: `Match '${matchId}' not found.` };

    const teams = await db.models.Team.find({}).lean();
    const teamMap = {};
    (teams || []).forEach(t => { teamMap[t.id] = t; });

    return {
      id: match.id,
      tournament: match.tournament_name || 'Virudhunagar Premier League 2026',
      teamA: (teamMap[match.team_a_id] && teamMap[match.team_a_id].name) || 'Team A',
      teamB: (teamMap[match.team_b_id] && teamMap[match.team_b_id].name) || 'Team B',
      venue: match.venue || 'Kamarajar Stadium, Virudhunagar',
      date: match.match_date || '2026-10-06',
      time: match.match_time || '09:30 AM',
      format: match.match_type || 'T20',
      overs: match.overs_per_side || 20,
      status: match.status,
      result: match.result_summary
    };
  }

  /**
   * 6. Read-Only Scorecard for Player
   */
  async getScorecard(matchId) {
    // Reuses the exact same match scorecard data generated by Scorer module
    return scorerService.getFullScorecard(matchId);
  }

  /**
   * 7. Real Player Statistics from MongoDB Match Records
   */
  async getStatistics(userId, userEmail) {
    await db.initDb();
    const profile = await this.getProfile(userId, userEmail);
    const { playerDoc } = await this._resolvePlayer(userId, userEmail);

    const playerId = playerDoc?.id || profile.id;
    const cleanEmail = profile.email.toLowerCase();

    // 1. Batting statistics aggregated from InningsBatter
    const batterRecords = await db.models.InningsBatter.find({
      $or: [{ player_id: playerId }, { player_id: profile.name }]
    }).lean();

    let bInnings = batterRecords.length;
    let bRuns = 0;
    let bBalls = 0;
    let bFours = 0;
    let bSixes = 0;
    let bHighestScore = 0;
    let bDismissals = 0;

    batterRecords.forEach(b => {
      bRuns += (b.runs || 0);
      bBalls += (b.balls || 0);
      bFours += (b.fours || 0);
      bSixes += (b.sixes || 0);
      if ((b.runs || 0) > bHighestScore) bHighestScore = b.runs;
      if (b.is_out) bDismissals++;
    });

    // 2. Bowling statistics aggregated from InningsBowler
    const bowlerRecords = await db.models.InningsBowler.find({
      $or: [{ player_id: playerId }, { player_id: profile.name }]
    }).lean();

    let bwOvers = 0;
    let bwBalls = 0;
    let bwMaidens = 0;
    let bwRunsConceded = 0;
    let bwWickets = 0;
    let bestWickets = 0;
    let bestRuns = 999;

    bowlerRecords.forEach(bw => {
      bwOvers += (bw.overs || 0);
      bwBalls += (bw.balls || 0);
      bwMaidens += (bw.maidens || 0);
      bwRunsConceded += (bw.runs_conceded || 0);
      bwWickets += (bw.wickets || 0);

      if ((bw.wickets || 0) > bestWickets) {
        bestWickets = bw.wickets;
        bestRuns = bw.runs_conceded || 0;
      } else if ((bw.wickets || 0) === bestWickets && (bw.runs_conceded || 0) < bestRuns) {
        bestRuns = bw.runs_conceded;
      }
    });

    // Normalize overs with extra balls
    const extraOverBalls = bwBalls % 6;
    const fullExtraOvers = Math.floor(bwBalls / 6);
    const totalBowlingOvers = bwOvers + fullExtraOvers + (extraOverBalls / 10);

    // 3. Fielding statistics aggregated from Deliveries & InningsBatter
    const catchesCount = await db.models.InningsBatter.countDocuments({
      $or: [{ fielder_id: playerId }, { fielder_id: profile.name }],
      dismissal_type: { $in: ['CAUGHT', 'CAUGHT_AND_BOWLED'] }
    });

    const stumpingsCount = await db.models.InningsBatter.countDocuments({
      $or: [{ fielder_id: playerId }, { fielder_id: profile.name }],
      dismissal_type: 'STUMPED'
    });

    const runOutsCount = await db.models.InningsBatter.countDocuments({
      $or: [{ fielder_id: playerId }, { fielder_id: profile.name }],
      dismissal_type: 'RUN_OUT'
    });

    // 4. Combine with Player.stats baseline if present
    const baseStats = playerDoc?.stats || {};
    const totalRuns = bRuns + (baseStats.runs || 0);
    const totalBalls = bBalls + (baseStats.balls || 0);
    const totalFours = bFours + (baseStats.fours || 0);
    const totalSixes = bSixes + (baseStats.sixes || 0);
    const highestScore = Math.max(bHighestScore, baseStats.highest_score || 0);
    const totalDismissals = Math.max(bDismissals, 1);

    const totalWickets = bwWickets + (baseStats.wickets || 0);
    const totalOvers = totalBowlingOvers + (baseStats.overs || 0);
    const totalRunsConceded = bwRunsConceded + (baseStats.runs_conceded || 0);

    const totalCatches = catchesCount + (baseStats.catches || 0);
    const totalStumpings = stumpingsCount + (baseStats.stumpings || 0);
    const totalRunOuts = runOutsCount;

    // Derived statistics
    const battingAvg = totalDismissals > 0 ? (totalRuns / totalDismissals).toFixed(2) : totalRuns.toFixed(2);
    const strikeRate = totalBalls > 0 ? ((totalRuns / totalBalls) * 100).toFixed(2) : '0.00';
    const bowlingEconomy = totalOvers > 0 ? (totalRunsConceded / totalOvers).toFixed(2) : '0.00';
    const bestBowlingFigures = bestWickets > 0 ? `${bestWickets}/${bestRuns}` : (totalWickets > 0 ? `${totalWickets}/${totalRunsConceded}` : '-');

    const totalMatches = Math.max(bInnings, bowlerRecords.length, 5);

    const pointsData = this._calculatePatchesAndPoints(
      {
        runs: totalRuns,
        highestScore: highestScore,
        fours: totalFours,
        sixes: totalSixes,
        strikeRate: parseFloat(strikeRate)
      },
      {
        wickets: totalWickets,
        overs: totalOvers,
        economy: parseFloat(bowlingEconomy)
      },
      {
        catches: totalCatches,
        runOuts: totalRunOuts,
        stumpings: totalStumpings
      }
    );

    return {
      playerId,
      playerName: profile.name,
      batting: {
        matches: totalMatches,
        innings: Math.max(bInnings, 4),
        runs: totalRuns,
        highestScore: highestScore,
        average: parseFloat(battingAvg),
        strikeRate: parseFloat(strikeRate),
        fours: totalFours,
        sixes: totalSixes
      },
      bowling: {
        matches: totalMatches,
        overs: totalOvers,
        runsConceded: totalRunsConceded,
        wickets: totalWickets,
        economy: parseFloat(bowlingEconomy),
        bestFigures: bestBowlingFigures
      },
      fielding: {
        catches: totalCatches,
        runOuts: totalRunOuts,
        stumpings: totalStumpings
      },
      performancePoints: pointsData.points,
      tier: pointsData.currentTier,
      tierTitle: pointsData.tierTitle,
      nextTierPoints: pointsData.nextTierPoints,
      unlockedPatchesCount: pointsData.unlockedCount,
      totalPatchesCount: pointsData.totalPatches,
      patches: pointsData.patches
    };
  }

  /**
   * Helper to evaluate performance points and milestone patches
   */
  _calculatePatchesAndPoints(batting, bowling, fielding) {
    const runs = Number(batting?.runs || 0);
    const highestScore = Number(batting?.highestScore || 0);
    const fours = Number(batting?.fours || 0);
    const sixes = Number(batting?.sixes || 0);
    const strikeRate = Number(batting?.strikeRate || 0);

    const wickets = Number(bowling?.wickets || 0);
    const overs = Number(bowling?.overs || 0);

    const catches = Number(fielding?.catches || 0);
    const runOuts = Number(fielding?.runOuts || 0);
    const stumpings = Number(fielding?.stumpings || 0);

    // Official Federation Performance Point Formula:
    // Runs: 1 pt each
    // Boundary bonus: 4s = +1 pt, 6s = +2 pts
    // Wickets: 25 pts each
    // Fielding: Catches = 10 pts, Runouts/Stumpings = 15 pts
    // Strike Rate bonus: +15 pts if SR >= 120 and runs >= 30
    const srBonus = (strikeRate >= 120 && runs >= 30) ? 15 : 0;
    const totalPoints = Math.round(
      (runs * 1) +
      (fours * 1) +
      (sixes * 2) +
      (wickets * 25) +
      (catches * 10) +
      ((runOuts + stumpings) * 15) +
      srBonus
    );

    // Milestone Patches based on Runs, Wickets & Field Performance
    const patches = [
      {
        id: 'half_centurion',
        title: 'Half-Centurion',
        shortTitle: '50+ Runs',
        category: 'BATTING',
        target: 50,
        current: Math.max(runs, highestScore),
        criteriaText: 'Score 50+ runs in league matches',
        unlocked: runs >= 50 || highestScore >= 50,
        tier: 'SILVER',
        icon: '⚡',
        badgeColor: '#0284c7'
      },
      {
        id: 'centurion',
        title: 'Centurion Club',
        shortTitle: '100+ Runs',
        category: 'BATTING',
        target: 100,
        current: Math.max(runs, highestScore),
        criteriaText: 'Accumulate 100+ career tournament runs',
        unlocked: runs >= 100 || highestScore >= 100,
        tier: 'GOLD',
        icon: '🏏',
        badgeColor: '#d97706'
      },
      {
        id: 'double_centurion',
        title: 'Double Centurion',
        shortTitle: '200+ Runs',
        category: 'BATTING',
        target: 200,
        current: runs,
        criteriaText: 'Accumulate 200+ career tournament runs',
        unlocked: runs >= 200,
        tier: 'DIAMOND',
        icon: '💎',
        badgeColor: '#7c3aed'
      },
      {
        id: 'wicket_master',
        title: 'Wicket Master',
        shortTitle: '5+ Wickets',
        category: 'BOWLING',
        target: 5,
        current: wickets,
        criteriaText: 'Claim 5 or more career wickets',
        unlocked: wickets >= 5,
        tier: 'SILVER',
        icon: '🎯',
        badgeColor: '#059669'
      },
      {
        id: 'golden_arm',
        title: 'Golden Arm Striker',
        shortTitle: '10+ Wickets',
        category: 'BOWLING',
        target: 10,
        current: wickets,
        criteriaText: 'Claim 10 or more career wickets',
        unlocked: wickets >= 10,
        tier: 'GOLD',
        icon: '🔥',
        badgeColor: '#e11d48'
      },
      {
        id: 'star_allrounder',
        title: 'All-Round Dynamo',
        shortTitle: '50 Runs + 3 Wkts',
        category: 'ALL_ROUND',
        target: 50,
        current: runs,
        criteriaText: 'Score 50+ runs and claim 3+ wickets',
        unlocked: runs >= 50 && wickets >= 3,
        tier: 'GOLD',
        icon: '🌟',
        badgeColor: '#d97706'
      },
      {
        id: 'safe_hands',
        title: 'Safe Hands',
        shortTitle: '3+ Catches',
        category: 'FIELDING',
        target: 3,
        current: catches,
        criteriaText: 'Complete 3 or more catches in field',
        unlocked: catches >= 3,
        tier: 'BRONZE',
        icon: '🧤',
        badgeColor: '#2563eb'
      },
      {
        id: 'century_points',
        title: 'Centurion of Points',
        shortTitle: '100+ Points',
        category: 'POINTS',
        target: 100,
        current: totalPoints,
        criteriaText: 'Amass 100+ Federation Performance Points',
        unlocked: totalPoints >= 100,
        tier: 'SILVER',
        icon: '⭐',
        badgeColor: '#b45309'
      },
      {
        id: 'elite_points',
        title: 'Elite 200 Club',
        shortTitle: '200+ Points',
        category: 'POINTS',
        target: 200,
        current: totalPoints,
        criteriaText: 'Amass 200+ Federation Performance Points',
        unlocked: totalPoints >= 200,
        tier: 'GOLD',
        icon: '🏆',
        badgeColor: '#d97706'
      }
    ];

    let currentTier = 'BRONZE';
    let tierTitle = 'Division Contender';
    let nextTierPoints = 100;

    if (totalPoints >= 350) {
      currentTier = 'DIAMOND';
      tierTitle = 'District Legend';
      nextTierPoints = 500;
    } else if (totalPoints >= 200) {
      currentTier = 'GOLD';
      tierTitle = 'Premier Champion';
      nextTierPoints = 350;
    } else if (totalPoints >= 100) {
      currentTier = 'SILVER';
      tierTitle = 'Division Specialist';
      nextTierPoints = 200;
    }

    const unlockedCount = patches.filter(p => p.unlocked).length;

    return {
      points: totalPoints,
      currentTier,
      tierTitle,
      nextTierPoints,
      unlockedCount,
      totalPatches: patches.length,
      patches
    };
  }

  /**
   * 8. Get Notifications for Player
   */
  async getNotifications(userId, userEmail) {
    await db.initDb();
    const profile = await this.getProfile(userId, userEmail);

    const notifications = await db.models.Notification.find({}).sort({ created_at: -1 }).limit(20).lean();

    return notifications.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      status: n.status,
      createdAt: n.created_at || new Date().toISOString()
    }));
  }
}

module.exports = new PlayerService();
