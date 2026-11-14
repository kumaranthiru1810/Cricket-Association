/**
 * teamRoutes.js
 *
 * Express routes for Team Registration, Login, Email Verification, and Profile.
 */

const express = require('express');
const router = express.Router();
const teamService = require('../services/teamService');
const scorerService = require('../services/scorerService');
const { requireTeamAuth, requireAdminAuth } = require('../middleware/authMiddleware');

// ──────────────────────────────────────────────
// PUBLIC ROUTES (no auth required)
// ──────────────────────────────────────────────

/**
 * GET /api/team/districts
 * Fetch all available districts for the registration form
 */
router.get('/districts', async (req, res) => {
  try {
    const districts = await teamService.getDistricts();
    res.json({ success: true, districts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/team/register
 * Register a new team account
 * Body: { teamName, districtId, captainName, phone, email, password }
 */
router.post('/register', async (req, res) => {
  try {
    const { teamName, districtId, captainName, phone, email, password, players } = req.body;
    const result = await teamService.registerTeam({ teamName, districtId, captainName, phone, email, password, players });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/team/verify-email
 * Verify email using the token received after registration
 * Body: { token }
 */
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    const result = await teamService.verifyEmail(token);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const authController = require('../controllers/authController');

/**
 * POST /api/team/login
 * Team login endpoint
 * Body: { email, password }
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await teamService.loginTeam({ email, password });
    if (result && result.token) {
      authController.setAuthCookies(res, result.token);
    }
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// ──────────────────────────────────────────────
// DYNAMIC TEAM STATS CALCULATION HELPER
// ──────────────────────────────────────────────
async function calculateTeamStatistics(db, teamDoc, teamReg, reqUser, reqTeam) {
  const teamId = teamDoc?.id || teamDoc?.team_id || teamReg?.id || reqTeam?.id || reqUser?.teamId || reqUser?.team_id;
  const teamName = teamDoc?.name || teamDoc?.team_name || teamReg?.team_name || reqTeam?.name || '';
  const teamNameLower = teamName.toLowerCase().trim();

  const defaultZeroStats = {
    matches: 0,
    matchesPlayed: 0,
    won: 0,
    matchesWon: 0,
    lost: 0,
    matchesLost: 0,
    tied: 0,
    matchesTied: 0,
    winRate: 0,
    totalRunsScored: 0,
    totalWicketsTaken: 0,
    highestScore: 0,
    lowestScore: 0,
    points: 0,
    nrr: teamDoc?.stats?.nrr || 0.0
  };

  if (!teamId && !teamNameLower) {
    return defaultZeroStats;
  }

  // Fetch all matches from DB
  const allMatches = await db.models.Match.find({}).lean();
  if (!allMatches || allMatches.length === 0) {
    return defaultZeroStats;
  }

  // Filter matches involving this team
  const myMatches = allMatches.filter(m => {
    if (teamId && (m.team_a_id === teamId || m.team_b_id === teamId)) return true;
    const tA = (m.team_a_name || '').toLowerCase();
    const tB = (m.team_b_name || '').toLowerCase();
    return teamNameLower && (tA.includes(teamNameLower) || tB.includes(teamNameLower));
  });

  const completedMatches = myMatches.filter(m => {
    const st = (m.status || '').toUpperCase();
    return st === 'COMPLETED' || st === 'FINISHED';
  });

  if (completedMatches.length === 0) {
    return defaultZeroStats;
  }

  const matchIds = completedMatches.map(m => m.id);
  const allInnings = await db.models.Innings.find({ match_id: { $in: matchIds } }).lean();

  const inningsByMatch = {};
  (allInnings || []).forEach(inn => {
    if (!inningsByMatch[inn.match_id]) inningsByMatch[inn.match_id] = [];
    inningsByMatch[inn.match_id].push(inn);
  });

  let matchesWon = 0;
  let matchesLost = 0;
  let matchesTied = 0;
  let totalRunsScored = 0;
  let totalWicketsTaken = 0;
  let highestScore = 0;
  let lowestScore = 0;

  for (const m of completedMatches) {
    const matchInns = inningsByMatch[m.id] || [];
    const isTeamA = (teamId && m.team_a_id === teamId) || (teamNameLower && (m.team_a_name || '').toLowerCase().includes(teamNameLower));
    const isTeamB = (teamId && m.team_b_id === teamId) || (teamNameLower && (m.team_b_name || '').toLowerCase().includes(teamNameLower));

    // Calculate runs and wickets from innings
    matchInns.forEach(inn => {
      const innBattingIsMe = (teamId && inn.batting_team_id === teamId) ||
        (isTeamA && inn.innings_number === 1 && m.toss_decision === 'BAT' && m.toss_winner_id === m.team_a_id) ||
        (isTeamA && inn.batting_team_id === m.team_a_id) ||
        (isTeamB && inn.batting_team_id === m.team_b_id);

      if (innBattingIsMe) {
        const runs = inn.total_runs || 0;
        totalRunsScored += runs;
        if (runs > highestScore) highestScore = runs;
        if (lowestScore === 0 || runs < lowestScore) lowestScore = runs;
      } else {
        totalWicketsTaken += (inn.wickets || 0);
      }
    });

    // Check match winner
    const resSummary = (m.result_summary || '').toLowerCase();
    const teamAName = (m.team_a_name || '').toLowerCase();
    const teamBName = (m.team_b_name || '').toLowerCase();

    let didWin = false;
    let didLose = false;
    let didTie = false;

    if (m.winner_id) {
      if (teamId && m.winner_id === teamId) didWin = true;
      else didLose = true;
    } else if (resSummary.includes('tied') || resSummary.includes('match tied')) {
      didTie = true;
    } else if (teamNameLower && resSummary.includes(teamNameLower) && resSummary.includes('won')) {
      didWin = true;
    } else if (isTeamA && teamAName && resSummary.includes(teamAName) && resSummary.includes('won')) {
      didWin = true;
    } else if (isTeamB && teamBName && resSummary.includes(teamBName) && resSummary.includes('won')) {
      didWin = true;
    } else if (resSummary.includes('won')) {
      didLose = true;
    } else {
      // Compare innings runs
      const inn1 = matchInns.find(i => i.innings_number === 1);
      const inn2 = matchInns.find(i => i.innings_number === 2);
      if (inn1 && inn2) {
        if (inn1.total_runs === inn2.total_runs) {
          didTie = true;
        } else {
          const inn1IsMe = (teamId && inn1.batting_team_id === teamId) || (isTeamA && inn1.batting_team_id === m.team_a_id);
          const meRuns = inn1IsMe ? inn1.total_runs : inn2.total_runs;
          const oppRuns = inn1IsMe ? inn2.total_runs : inn1.total_runs;
          if (meRuns > oppRuns) didWin = true;
          else didLose = true;
        }
      }
    }

    if (didWin) matchesWon++;
    else if (didLose) matchesLost++;
    else if (didTie) matchesTied++;
  }

  const matchesPlayed = completedMatches.length;
  const winRate = matchesPlayed > 0 ? Number(((matchesWon / matchesPlayed) * 100).toFixed(1)) : 0;

  return {
    matches: matchesPlayed,
    matchesPlayed,
    won: matchesWon,
    matchesWon,
    lost: matchesLost,
    matchesLost,
    tied: matchesTied,
    matchesTied,
    winRate,
    totalRunsScored,
    totalWicketsTaken,
    highestScore,
    lowestScore,
    points: (matchesWon * 2) + (matchesTied * 1),
    nrr: teamDoc?.stats?.nrr || 0.0
  };
}

// PROTECTED TEAM ROUTES (JWT required)
// ──────────────────────────────────────────────

/**
 * GET /api/team/profile
 * Get the logged-in team's profile from MongoDB
 */
router.get('/profile', requireTeamAuth, async (req, res) => {
  try {
    const db = require('../config/db');
    await db.initDb();
    const teamId = req.team?.id || req.user?.teamId || 'TM-01';
    let team = await db.models.Team.findOne({ id: teamId }).lean();
    if (!team) {
      team = await db.models.Team.findOne({
        $or: [
          { coach_email: req.user?.email },
          { name: { $regex: req.team?.name || '', $options: 'i' } }
        ]
      }).lean();
    }
    const profile = {
      id: team?.id || teamId,
      teamId: team?.id || teamId,
      name: team?.name || req.team?.name || 'Virudhunagar Spartans',
      teamName: team?.name || req.team?.name || 'Virudhunagar Spartans',
      shortName: team?.short_name || 'VND',
      city: team?.city || 'Virudhunagar',
      taluk: team?.taluk || 'Virudhunagar',
      coachName: team?.coach_name || req.user?.name || 'Coach',
      coachPhone: team?.phone || '+91 94431 23456',
      coachEmail: team?.coach_email || req.user?.email || '',
      captain: team?.captain || 'Suresh Kumar',
      viceCaptain: team?.vice_captain || 'Vijay Anand',
      status: team?.status || 'APPROVED',
      homeGround: team?.home_ground || 'Kamarajar Stadium Sports Complex, Virudhunagar',
      certification: 'BCCI / TNCA Level 2 Certified',
      stats: await calculateTeamStatistics(db, team, teamReg, req.user, req.team)
    };
    res.json({ success: true, profile, team: profile });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/team/profile
 * Update allowed team profile fields in MongoDB
 */
router.put('/profile', requireTeamAuth, async (req, res) => {
  try {
    const db = require('../config/db');
    await db.initDb();
    const teamId = req.team?.id || req.user?.teamId || 'TM-01';
    const { coachPhone, homeGround, captain, viceCaptain, certification } = req.body;

    const updates = {};
    if (coachPhone !== undefined) updates.phone = coachPhone;
    if (homeGround !== undefined) updates.home_ground = homeGround;
    if (captain !== undefined) updates.captain = captain;
    if (viceCaptain !== undefined) updates.vice_captain = viceCaptain;

    const updated = await db.models.Team.findOneAndUpdate(
      { id: teamId },
      { $set: updates },
      { new: true }
    ).lean();

    res.json({ success: true, message: 'Team profile updated successfully.', team: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/team/squad
 * Full official roster from MongoDB
 */
router.get('/squad', requireTeamAuth, async (req, res) => {
  try {
    const db = require('../config/db');
    await db.initDb();
    const teamId = req.team?.id || req.user?.teamId || 'TM-01';
    const teamDoc = await db.models.Team.findOne({ $or: [{ id: teamId }, { team_id: teamId }] }).lean();
    const teamName = teamDoc?.name || req.team?.name || '';
    const coachEmail = (req.team?.coachEmail || req.user?.coachEmail || req.user?.email || '').toLowerCase().trim();

    let players = await db.models.Player.find({
      $or: [
        { team_id: teamId },
        ...(teamName ? [{ club_choice: new RegExp(`^${teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }] : [])
      ]
    }).lean();

    // If empty or less, check TeamRegistration players
    if (!players || players.length === 0) {
      const reg = await db.models.TeamRegistration.findOne({
        $or: [
          { id: teamId },
          ...(coachEmail ? [{ coach_email: coachEmail }, { coachEmail: coachEmail }] : []),
          ...(teamName ? [{ team_name: new RegExp(`^${teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }] : [])
        ]
      }).lean();

      if (reg && Array.isArray(reg.players) && reg.players.length > 0) {
        players = reg.players.map((rp, idx) => ({
          id: rp._id ? String(rp._id) : (rp.id || `PL-${reg.id}-${idx + 1}`),
          name: rp.name,
          email: rp.email,
          role: rp.role || 'All-Rounder',
          jersey_number: rp.jersey_number || rp.jerseyNumber || (idx + 1),
          batting_style: rp.batting_style || rp.battingStyle || 'Right Hand Bat',
          bowling_style: rp.bowling_style || rp.bowlingStyle || 'Right Arm Medium',
          mobile: rp.mobile || rp.phone || '',
          status: rp.status || 'ACTIVE',
          stats: rp.stats || { runs: 0, balls: 0, wickets: 0 }
        }));
      }
    }

    const squad = (players || []).map((p, idx) => ({
      id: p.id || (p._id ? String(p._id) : `PL-${idx + 1}`),
      name: p.name,
      email: p.email,
      role: p.role,
      jerseyNumber: p.jersey_number || p.jerseyNumber || (idx + 1),
      battingStyle: p.batting_style || p.battingStyle || 'Right Hand Bat',
      bowlingStyle: p.bowling_style || p.bowlingStyle || 'Right Arm Medium',
      mobile: p.mobile || p.phone || '',
      status: p.status === 'ACTIVE' ? 'Verified' : p.status,
      stats: p.stats || { runs: 0, balls: 0, wickets: 0 }
    }));
    res.json({ success: true, squad });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/team/matches
 * Retrieve upcoming, live, and past matches with dynamic live scores from MongoDB
 */
router.get('/matches', requireTeamAuth, async (req, res) => {
  try {
    const db = require('../config/db');
    await db.initDb();
    const teamId = req.team?.id || req.user?.teamId || 'TM-01';
    const teamDoc = await db.models.Team.findOne({ id: teamId }).lean();
    const teamNameLower = (teamDoc?.name || req.team?.name || '').toLowerCase().trim();

    const [allTeams, tournaments, matches] = await Promise.all([
      db.models.Team.find({}).lean(),
      db.models.Tournament.find({}).lean(),
      db.models.Match.find({}).sort({ match_date: -1, created_at: -1 }).lean()
    ]);

    const teamMap = {};
    allTeams.forEach(t => { teamMap[t.id] = t; });

    const tourMap = {};
    tournaments.forEach(t => { tourMap[t.id] = t; });

    // Filter matches involving this team
    const myMatches = matches.filter(m => {
      if (m.team_a_id === teamId || m.team_b_id === teamId) return true;
      const tA = (teamMap[m.team_a_id]?.name || m.team_a_name || '').toLowerCase();
      const tB = (teamMap[m.team_b_id]?.name || m.team_b_name || '').toLowerCase();
      return teamNameLower && (tA.includes(teamNameLower) || tB.includes(teamNameLower));
    });

    const formattedMatches = await Promise.all(myMatches.map(async (m) => {
      const teamA = teamMap[m.team_a_id] || { id: m.team_a_id, name: m.team_a_name || 'Virudhunagar Spartans', short_name: m.team_a_short || 'VND' };
      const teamB = teamMap[m.team_b_id] || { id: m.team_b_id, name: m.team_b_name || 'Rajapalayam Royals', short_name: m.team_b_short || 'RPY' };
      const statusUpper = (m.status || 'SCHEDULED').toUpperCase();
      const isLive = statusUpper === 'LIVE' || statusUpper === 'INNINGS_BREAK';
      const isCompleted = statusUpper === 'COMPLETED' || statusUpper === 'FINISHED';

      // Dynamically get live score from Innings in MongoDB
      let scoreA = null;
      let scoreB = null;
      const inns = await db.models.Innings.find({ match_id: m.id }).sort({ innings_number: 1 }).lean();
      if (inns && inns.length > 0) {
        inns.forEach(inn => {
          const str = `${inn.total_runs}/${inn.wickets} (${inn.overs}.${inn.balls} ov)`;
          if (inn.batting_team_id === m.team_a_id) scoreA = str;
          else if (inn.batting_team_id === m.team_b_id) scoreB = str;
        });
      }

      const isCurrentTeamA = (teamA.id === teamId) || (teamNameLower && teamA.name.toLowerCase().includes(teamNameLower));
      const myAllocationStatus = isCurrentTeamA ? (m.team_a_allocation_status || 'PENDING') : (m.team_b_allocation_status || 'PENDING');
      const oppAllocationStatus = isCurrentTeamA ? (m.team_b_allocation_status || 'PENDING') : (m.team_a_allocation_status || 'PENDING');
      const bothAllocationsSubmitted = (m.team_a_allocation_status === 'SUBMITTED' && m.team_b_allocation_status === 'SUBMITTED');
      const scheduleConfirmationStatus = m.schedule_confirmation_status || 'PENDING';

      return {
        id: m.id,
        tournament: m.tournament_name || tourMap[m.tournament_id]?.name || 'Virudhunagar Premier League 2026',
        teamA: { id: teamA.id, name: teamA.name, shortName: teamA.short_name || teamA.name },
        teamB: { id: teamB.id, name: teamB.name, shortName: teamB.short_name || teamB.name },
        team_a_id: teamA.id,
        team_b_id: teamB.id,
        team_a_name: teamA.name,
        team_b_name: teamB.name,
        venue: m.venue || 'Kamarajar District Stadium',
        date: m.match_date || '',
        time: m.match_time || '',
        format: m.match_type || 'T20',
        overs: m.overs_per_side || 20,
        status: isLive ? statusUpper : (isCompleted ? 'COMPLETED' : (statusUpper === 'POSTPONED' ? 'POSTPONED' : (statusUpper === 'CANCELLED' ? 'CANCELLED' : 'SCHEDULED'))),
        scoreA,
        scoreB,
        currentBreak: m.current_break || null,
        statusComment: m.status_comment || null,
        result: m.result_summary || (isLive ? (statusUpper === 'INNINGS_BREAK' ? 'Innings Break' : (m.current_break ? `☕ ${m.current_break.title || 'Break'}` : 'Match in Progress')) : (isCompleted ? 'Match Completed' : (statusUpper === 'POSTPONED' ? `Postponed: ${m.postponement?.reason || 'Awaiting reschedule'}` : 'Scheduled Match'))),
        isLive,
        isCompleted,
        isPostponed: statusUpper === 'POSTPONED',
        postponement: m.postponement || null,
        postponementReason: m.postponement?.reason || null,
        originalDate: m.postponement?.original_date || m.match_date,
        originalTime: m.postponement?.original_time || m.match_time,
        rescheduledDate: m.postponement?.rescheduled_date || null,
        rescheduledTime: m.postponement?.rescheduled_time || null,
        postponementHistory: m.postponement_history || [],
        umpirePostponementRequest: m.umpire_postponement_request || null,
        isCurrentTeamA,
        myAllocationStatus,
        oppAllocationStatus,
        bothAllocationsSubmitted,
        scheduleConfirmationStatus,
        myPlayingXI: isCurrentTeamA ? (m.team_a_playing_xi || []) : (m.team_b_playing_xi || []),
        mySubstitutes: isCurrentTeamA ? (m.team_a_substitutes || []) : (m.team_b_substitutes || []),
        myLineup: isCurrentTeamA ? (m.team_a_lineup || []) : (m.team_b_lineup || []),
        myAllocationSubmittedAt: isCurrentTeamA ? m.team_a_allocation_submitted_at : m.team_b_allocation_submitted_at,
        team_a_allocation_status: m.team_a_allocation_status || 'PENDING',
        team_b_allocation_status: m.team_b_allocation_status || 'PENDING',
        team_a_playing_xi: m.team_a_playing_xi || [],
        team_b_playing_xi: m.team_b_playing_xi || [],
        team_a_substitutes: m.team_a_substitutes || [],
        team_b_substitutes: m.team_b_substitutes || []
      };
    }));

    res.json({ success: true, matches: formattedMatches });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/team/matches/:id
 * Specific match details
 */

/**
 * POST /api/team/matches/:id/allocate
 * Submit Playing XI player allocation for a scheduled match.
 * Dispatches notification to Admin and to all selected players.
 */
router.post('/matches/:id/allocate', requireTeamAuth, async (req, res) => {
  try {
    const db = require('../config/db');
    await db.initDb();
    const teamId = req.team?.id || req.user?.teamId || 'TM-01';
    const teamDoc = await db.models.Team.findOne({ id: teamId }).lean();
    const teamName = teamDoc?.name || req.team?.name || 'Your Team';

    const match = await db.models.Match.findOne({ id: req.params.id });
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }

    // Determine if caller is Team A or Team B
    const isTeamA = match.team_a_id === teamId || (match.team_a_name && match.team_a_name.toLowerCase() === teamName.toLowerCase());
    const isTeamB = match.team_b_id === teamId || (match.team_b_name && match.team_b_name.toLowerCase() === teamName.toLowerCase());

    if (!isTeamA && !isTeamB) {
      return res.status(403).json({ success: false, message: 'Your team is not a participant in this fixture.' });
    }

    const { playingXI, substitutes = [], lineup } = req.body;

    if (!Array.isArray(playingXI) || playingXI.length !== 11) {
      return res.status(400).json({
        success: false,
        message: `Exactly 11 players must be selected for the Playing XI. You selected ${Array.isArray(playingXI) ? playingXI.length : 0} players.`
      });
    }

    if (!Array.isArray(substitutes) || substitutes.length < 1 || substitutes.length > 5) {
      return res.status(400).json({
        success: false,
        message: `Between 1 and 5 substitute players must be selected. You selected ${Array.isArray(substitutes) ? substitutes.length : 0} substitute players.`
      });
    }

    const overlap = playingXI.filter(id => substitutes.includes(id));
    if (overlap.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A player cannot be selected as both Playing XI and Substitute.'
      });
    }

    const oppTeamName = isTeamA ? (match.team_b_name || match.team_b_id) : (match.team_a_name || match.team_a_id);

    // Fetch player records to enrich lineup with names, roles, and jersey numbers
    const allIds = [...(playingXI || []), ...(substitutes || [])];
    const playerDocs = await db.models.Player.find({ id: { $in: allIds } }).lean();
    const playerLookup = {};
    (playerDocs || []).forEach(p => { playerLookup[p.id] = p; });

    const enrichedLineup = (lineup || []).map((item, idx) => {
      const p = playerLookup[item.playerId] || {};
      return {
        ...item,
        name: p.name || item.name || item.playerId,
        role: p.role || item.role || 'Player',
        jerseyNumber: p.jersey_number || item.jerseyNumber || '',
        battingOrder: item.battingOrder || idx + 1
      };
    });

    if (isTeamA) {
      match.team_a_playing_xi = playingXI;
      match.team_a_substitutes = substitutes;
      match.team_a_lineup = enrichedLineup;
      match.team_a_allocation_status = 'SUBMITTED';
      match.team_a_allocation_submitted_at = new Date();
    } else {
      match.team_b_playing_xi = playingXI;
      match.team_b_substitutes = substitutes;
      match.team_b_lineup = enrichedLineup;
      match.team_b_allocation_status = 'SUBMITTED';
      match.team_b_allocation_submitted_at = new Date();
    }

    // Check if both teams have submitted player allocations
    const bothAllocated = match.team_a_allocation_status === 'SUBMITTED' && match.team_b_allocation_status === 'SUBMITTED';

    match.updated_at = new Date();
    await match.save();

    // 1. Dispatch Notification to ADMIN
    try {
      await db.models.Notification.create({
        id: `NOTIF-ALLOC-ADMIN-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: 'MATCH_SCHEDULED',
        recipient_role: 'ADMIN',
        recipient_id: null,
        title: bothAllocated ? '📋 Both Squads Submitted - Ready For Admin Confirmation' : '📋 Squad Allocation Submitted',
        message: bothAllocated
          ? `Both "${match.team_a_name || match.team_a_id}" and "${match.team_b_name || match.team_b_id}" have submitted their Playing XI. Please click "Confirm Schedule" in Admin Match Schedules to release this fixture to Scorer.`
          : `Team "${teamName}" has submitted their match allocation: 11 Playing XI + ${substitutes.length} Substitutes for match vs ${oppTeamName} on ${match.match_date} at ${match.venue}.`,
        reference_id: match.id,
        team_id: teamId,
        team_name: teamName,
        status: 'UNREAD'
      });
    } catch (e) {
      console.warn('Failed to send admin allocation notification:', e.message);
    }

    // 2. Dispatch Notifications to 11 Playing XI + 2 Substitutes
    try {
      const allSelectedIds = [...playingXI, ...substitutes];
      const squadPlayers = await db.models.Player.find({
        $or: [
          { id: { $in: allSelectedIds } },
          { name: { $in: allSelectedIds } }
        ]
      }).lean();

      const playerMap = {};
      squadPlayers.forEach(p => {
        playerMap[p.id] = p;
        playerMap[p.name] = p;
      });

      // Playing XI notifications
      for (const sel of playingXI) {
        const pObj = playerMap[sel] || { id: sel, name: sel, email: null };
        await db.models.Notification.create({
          id: `NOTIF-ALLOC-PL-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: 'MATCH_SCHEDULED',
          recipient_role: 'PLAYER',
          recipient_id: pObj.id,
          recipient_email: pObj.email || null,
          team_id: teamId,
          team_name: teamName,
          title: '🏏 Selected in Playing XI',
          message: `Congratulations! You have been selected in the Playing XI for ${teamName} vs ${oppTeamName} on ${match.match_date} at ${match.match_time} (${match.venue}).`,
          reference_id: match.id,
          status: 'UNREAD'
        });
      }

      // Substitutes notifications
      for (const sub of substitutes) {
        const pObj = playerMap[sub] || { id: sub, name: sub, email: null };
        await db.models.Notification.create({
          id: `NOTIF-ALLOC-SUB-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: 'MATCH_SCHEDULED',
          recipient_role: 'PLAYER',
          recipient_id: pObj.id,
          recipient_email: pObj.email || null,
          team_id: teamId,
          team_name: teamName,
          title: '🔄 Selected as Substitute',
          message: `You have been selected as a Reserve / Substitute player for ${teamName} vs ${oppTeamName} on ${match.match_date} at ${match.match_time} (${match.venue}).`,
          reference_id: match.id,
          status: 'UNREAD'
        });
      }
    } catch (e) {
      console.warn('Failed to send player allocation notifications:', e.message);
    }

    res.json({
      success: true,
      message: 'Playing XI allocated successfully. Admin and selected players have been notified.',
      match: match.toObject()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/matches/:id', requireTeamAuth, async (req, res) => {
  try {
    const db = require('../config/db');
    await db.initDb();
    const match = await db.models.Match.findOne({ id: req.params.id }).lean();
    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });
    res.json({ success: true, match });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/team/matches/:id/scorecard
 * Full detailed scorecard connected with scorer engine
 */
router.get('/matches/:id/scorecard', requireTeamAuth, async (req, res) => {
  try {
    const scorecard = await scorerService.getFullScorecard(req.params.id);
    res.json({ success: true, scorecard });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/team/statistics
 * Aggregated club statistics
 */
router.get('/statistics', requireTeamAuth, async (req, res) => {
  try {
    const db = require('../config/db');
    await db.initDb();
    const teamId = req.team?.id || req.user?.teamId || req.user?.team_id;
    const coachEmail = (req.team?.coachEmail || req.user?.email || '').toLowerCase().trim();
    const teamNameQuery = req.team?.name || '';

    let team = null;
    if (teamId || coachEmail || teamNameQuery) {
      team = await db.models.Team.findOne({
        $or: [
          ...(teamId ? [{ id: teamId }, { team_id: teamId }] : []),
          ...(coachEmail ? [{ coach_email: coachEmail }] : []),
          ...(teamNameQuery ? [{ name: new RegExp('^' + teamNameQuery + '$', 'i') }] : [])
        ]
      }).lean();
    }

    let teamReg = null;
    if (coachEmail || teamId || teamNameQuery) {
      teamReg = await db.models.TeamRegistration.findOne({
        $or: [
          ...(teamId ? [{ id: teamId }] : []),
          ...(coachEmail ? [{ coach_email: coachEmail }] : []),
          ...(teamNameQuery ? [{ team_name: new RegExp('^' + teamNameQuery + '$', 'i') }] : [])
        ]
      }).lean();
    }

    const statistics = await calculateTeamStatistics(db, team, teamReg, req.user, req.team);
    res.json({
      success: true,
      statistics
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/team/players/statistics
 * Per-player batting and bowling figures
 */
router.get('/players/statistics', requireTeamAuth, async (req, res) => {
  try {
    const db = require('../config/db');
    await db.initDb();
    const teamId = req.team?.id || req.user?.teamId || 'TM-01';
    const players = await db.models.Player.find({ team_id: teamId }).lean();
    const stats = players.map(p => ({
      playerId: p.id,
      name: p.name,
      role: p.role,
      batting: {
        runs: p.stats?.runs || 0,
        balls: p.stats?.balls || 0,
        fours: p.stats?.fours || 0,
        sixes: p.stats?.sixes || 0,
        highestScore: p.stats?.highest_score || 0
      },
      bowling: {
        wickets: p.stats?.wickets || 0,
        overs: p.stats?.overs || 0,
        runsConceded: p.stats?.runs_conceded || 0
      }
    }));
    res.json({ success: true, statistics: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────
// ADMIN-ONLY TEAM MANAGEMENT ROUTES
// ──────────────────────────────────────────────

/**
 * GET /api/team/admin/teams
 * Admin: list all teams and their registration status
 */
router.get('/admin/teams', requireAdminAuth, async (req, res) => {
  try {
    const teams = await teamService.getAllTeams();
    res.json({ success: true, teams });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/team/admin/teams/:teamId/status
 * Admin: approve, reject, or disable a team account
 * Body: { status: 'APPROVED' | 'REJECTED' | 'DISABLED' }
 */
router.put('/admin/teams/:teamId/status', requireAdminAuth, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { status } = req.body;
    const result = await teamService.updateTeamAccountStatus({ teamId, status });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/team/notifications
 * Official match schedule notifications for this team
 */
router.get('/notifications', requireTeamAuth, async (req, res) => {
  try {
    const db = require('../config/db');
    await db.initDb();
    const teamId = req.team?.id || req.user?.teamId || req.user?.team_id;
    const coachEmail = (req.team?.coachEmail || req.user?.email || '').toLowerCase().trim();
    const teamNameQuery = req.team?.name || '';

    let team = null;
    if (teamId || coachEmail || teamNameQuery) {
      team = await db.models.Team.findOne({
        $or: [
          ...(teamId ? [{ id: teamId }, { team_id: teamId }] : []),
          ...(coachEmail ? [{ coach_email: coachEmail }] : []),
          ...(teamNameQuery ? [{ name: new RegExp('^' + teamNameQuery + '$', 'i') }] : [])
        ]
      }).lean();
    }

    let teamReg = null;
    if (coachEmail || teamId || teamNameQuery) {
      teamReg = await db.models.TeamRegistration.findOne({
        $or: [
          ...(teamId ? [{ id: teamId }] : []),
          ...(coachEmail ? [{ coach_email: coachEmail }] : []),
          ...(teamNameQuery ? [{ team_name: new RegExp('^' + teamNameQuery + '$', 'i') }] : [])
        ]
      }).lean();
    }

    const targetTeamIds = [
      teamId,
      team?.id,
      team?.team_id,
      teamReg?.id
    ].filter(Boolean);

    const query = {
      type: { $in: ['MATCH_SCHEDULED', 'MATCH_RESCHEDULED'] },
      recipient_role: 'TEAM',
      $or: [
        { recipient_id: { $in: targetTeamIds } },
        { team_id: { $in: targetTeamIds } }
      ]
    };

    const notifications = await db.models.Notification.find(query).sort({ created_at: -1 }).limit(40).lean();
    res.json({
      success: true,
      notifications: notifications.map(n => ({
        id: n.id,
        _id: n._id,
        type: n.type || 'MATCH_SCHEDULED',
        title: n.title,
        message: n.message,
        reference_id: n.reference_id,
        link: n.link || null,
        status: n.status,
        isRead: n.status === 'READ',
        createdAt: n.created_at || new Date().toISOString()
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/team/notifications/:id/read
 * Mark notification as read
 */
router.put('/notifications/:id/read', async (req, res) => {
  try {
    const db = require('../config/db');
    const mongoose = require('mongoose');
    await db.initDb();
    const isMongoId = mongoose.Types.ObjectId.isValid(req.params.id);
    const query = isMongoId ? { $or: [{ id: req.params.id }, { _id: req.params.id }] } : { id: req.params.id };
    await db.models.Notification.findOneAndUpdate(
      query,
      { $set: { status: 'READ' } }
    );
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


/**
 * Helper to normalize role to Player schema enum
 */
const normalizeRole = (r) => {
  if (!r) return 'BATTER';
  const clean = String(r).toUpperCase().trim().replace(/[-\s]+/g, '_');
  if (clean.includes('BATT')) return 'BATTER';
  if (clean.includes('BOWL')) return 'BOWLER';
  if (clean.includes('ROUND') || clean.includes('ALL')) return 'ALL_ROUNDER';
  if (clean.includes('KEEP') || clean.includes('WICKET')) return 'WICKET_KEEPER';
  return 'BATTER';
};

const formatDisplayRole = (r) => {
  const norm = normalizeRole(r);
  if (norm === 'BATTER') return 'Batter';
  if (norm === 'BOWLER') return 'Bowler';
  if (norm === 'ALL_ROUNDER') return 'All-Rounder';
  if (norm === 'WICKET_KEEPER') return 'Wicket Keeper';
  return 'Batter';
};

/**
 * POST /api/team/players
 * Add a new player to the team (updates Player collection and TeamRegistration.players)
 */
router.post('/players', requireTeamAuth, async (req, res) => {
  try {
    const db = require('../config/db');
    await db.initDb();
    const { TeamRegistration, Player, Team } = db.models;

    const teamEmail = (req.team?.coachEmail || req.user?.coachEmail || req.user?.email || '').toLowerCase().trim();
    const teamId = req.team?.id || req.user?.teamId || 'TM-01';
    const teamDoc = await Team.findOne({ $or: [{ id: teamId }, { team_id: teamId }] }).lean();
    const teamName = teamDoc?.name || req.team?.name || '';

    const { name, email, role, jerseyNumber, battingStyle, bowlingStyle, mobile, aadhaar } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'Player name is required.' });
    if (!email || !email.trim()) return res.status(400).json({ success: false, error: 'Player email is required.' });

    const cleanEmail = email.trim().toLowerCase();
    const newId = 'PL-' + Date.now();

    // Find TeamRegistration
    let teamReg = await TeamRegistration.findOne({
      $or: [
        ...(teamEmail ? [{ coach_email: teamEmail }, { coachEmail: teamEmail }] : []),
        ...(teamId ? [{ id: teamId }, { team_id: teamId }] : []),
        ...(teamName ? [{ team_name: new RegExp(`^${teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }] : [])
      ]
    });

    if (teamReg && Array.isArray(teamReg.players)) {
      const existing = teamReg.players.find(p => p.email && p.email.toLowerCase() === cleanEmail);
      if (existing) {
        return res.status(400).json({ success: false, error: 'A player with this email already exists in your team.' });
      }
    }

    const schemaRole = normalizeRole(role);
    const displayRole = formatDisplayRole(role);
    const resolvedTeamId = teamDoc?.id || teamReg?.id || teamId;

    // 1. Save or update in Player collection
    let playerDoc = await Player.findOne({ email: cleanEmail });
    if (!playerDoc) {
      playerDoc = await Player.create({
        id: newId,
        team_id: resolvedTeamId,
        club_choice: teamName || teamReg?.team_name || '',
        name: name.trim(),
        email: cleanEmail,
        role: schemaRole,
        jersey_number: jerseyNumber ? Number(jerseyNumber) : (teamReg?.players?.length ? teamReg.players.length + 1 : 1),
        batting_style: battingStyle || 'Right Hand Bat',
        bowling_style: bowlingStyle || 'Right Arm Medium',
        status: 'ACTIVE',
        stats: { runs: 0, balls: 0, wickets: 0 }
      });
    } else {
      playerDoc.team_id = resolvedTeamId;
      playerDoc.name = name.trim();
      playerDoc.role = schemaRole;
      if (jerseyNumber !== undefined) playerDoc.jersey_number = Number(jerseyNumber);
      if (battingStyle) playerDoc.batting_style = battingStyle;
      if (bowlingStyle !== undefined) playerDoc.bowling_style = bowlingStyle;
      await playerDoc.save();
    }

    // 2. Also save to TeamRegistration if exists
    const newRegPlayer = {
      id: newId,
      name: name.trim(),
      email: cleanEmail,
      role: displayRole,
      jerseyNumber: jerseyNumber ? Number(jerseyNumber) : (playerDoc.jersey_number || 1),
      jersey_number: jerseyNumber ? Number(jerseyNumber) : (playerDoc.jersey_number || 1),
      battingStyle: battingStyle || 'Right Hand Bat',
      batting_style: battingStyle || 'Right Hand Bat',
      bowlingStyle: bowlingStyle || '',
      bowling_style: bowlingStyle || '',
      mobile: mobile || '',
      aadhaar: aadhaar || '',
      status: 'ACTIVE',
      joinedAt: new Date()
    };

    if (teamReg) {
      teamReg.players = teamReg.players || [];
      const idx = teamReg.players.findIndex(p => p.email && p.email.toLowerCase() === cleanEmail);
      if (idx !== -1) {
        teamReg.players[idx] = { ...teamReg.players[idx], ...newRegPlayer };
      } else {
        teamReg.players.push(newRegPlayer);
      }
      teamReg.squad_count = teamReg.players.length;
      await teamReg.save();
    }

    res.json({ success: true, player: newRegPlayer, message: 'Player added successfully.' });
  } catch (err) {
    console.error('POST /team/players error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/team/players/:playerId
 * Update an existing player's details in both collections
 */
router.put('/players/:playerId', requireTeamAuth, async (req, res) => {
  try {
    const db = require('../config/db');
    await db.initDb();
    const mongoose = require('mongoose');
    const { TeamRegistration, Player, Team } = db.models;

    const teamEmail = (req.team?.coachEmail || req.user?.coachEmail || req.user?.email || '').toLowerCase().trim();
    const teamId = req.team?.id || req.user?.teamId || 'TM-01';
    const teamDoc = await Team.findOne({ $or: [{ id: teamId }, { team_id: teamId }] }).lean();
    const teamName = teamDoc?.name || req.team?.name || '';

    const { playerId } = req.params;
    const { name, role, jerseyNumber, battingStyle, bowlingStyle, mobile, aadhaar, email } = req.body;

    let updated = false;
    let savedPlayer = null;

    // 1. Try Player collection
    const isObjectId = mongoose.isValidObjectId && mongoose.isValidObjectId(playerId);
    const playerQuery = {
      $or: [
        { id: playerId },
        ...(isObjectId ? [{ _id: playerId }] : []),
        ...(email ? [{ email: email.toLowerCase().trim() }] : [])
      ]
    };

    const playerDoc = await Player.findOne(playerQuery);
    if (playerDoc) {
      if (name && name.trim()) playerDoc.name = name.trim();
      if (email && email.trim()) playerDoc.email = email.trim().toLowerCase();
      if (role) playerDoc.role = normalizeRole(role);
      if (jerseyNumber !== undefined) playerDoc.jersey_number = Number(jerseyNumber);
      if (battingStyle) playerDoc.batting_style = battingStyle;
      if (bowlingStyle !== undefined) playerDoc.bowling_style = bowlingStyle;
      await playerDoc.save();
      updated = true;
      savedPlayer = {
        id: playerDoc.id,
        name: playerDoc.name,
        email: playerDoc.email,
        role: formatDisplayRole(playerDoc.role),
        jerseyNumber: playerDoc.jersey_number,
        battingStyle: playerDoc.batting_style,
        bowlingStyle: playerDoc.bowling_style,
        mobile: mobile || ''
      };
    }

    // 2. Try TeamRegistration.players
    let teamReg = await TeamRegistration.findOne({
      $or: [
        ...(teamEmail ? [{ coach_email: teamEmail }, { coachEmail: teamEmail }] : []),
        ...(teamId ? [{ id: teamId }, { team_id: teamId }] : []),
        ...(teamName ? [{ team_name: new RegExp(`^${teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }] : [])
      ]
    });

    if (teamReg && Array.isArray(teamReg.players)) {
      const idx = teamReg.players.findIndex(p =>
        p.id === playerId ||
        String(p._id) === playerId ||
        (email && p.email && p.email.toLowerCase() === email.toLowerCase().trim())
      );

      if (idx !== -1) {
        const p = teamReg.players[idx];
        if (name && name.trim()) p.name = name.trim();
        if (email && email.trim()) p.email = email.trim().toLowerCase();
        if (role) {
          p.role = formatDisplayRole(role);
        }
        if (jerseyNumber !== undefined) {
          p.jerseyNumber = Number(jerseyNumber);
          p.jersey_number = Number(jerseyNumber);
        }
        if (battingStyle) {
          p.battingStyle = battingStyle;
          p.batting_style = battingStyle;
        }
        if (bowlingStyle !== undefined) {
          p.bowlingStyle = bowlingStyle;
          p.bowling_style = bowlingStyle;
        }
        if (mobile !== undefined) p.mobile = mobile;
        if (aadhaar !== undefined) p.aadhaar = aadhaar;
        teamReg.players[idx] = p;
        await teamReg.save();
        updated = true;
        if (!savedPlayer) {
          savedPlayer = p;
        }
      }
    }

    if (updated) {
      return res.json({ success: true, player: savedPlayer, message: 'Player updated successfully.' });
    }

    return res.status(404).json({ success: false, error: 'Player not found in your team.' });
  } catch (err) {
    console.error('PUT /team/players/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/team/players/:playerId
 * Remove a player from the team squad
 */
router.delete('/players/:playerId', requireTeamAuth, async (req, res) => {
  try {
    const db = require('../config/db');
    await db.initDb();
    const mongoose = require('mongoose');
    const { TeamRegistration, Player, Team } = db.models;

    const teamEmail = (req.team?.coachEmail || req.user?.coachEmail || req.user?.email || '').toLowerCase().trim();
    const teamId = req.team?.id || req.user?.teamId || 'TM-01';
    const teamDoc = await Team.findOne({ $or: [{ id: teamId }, { team_id: teamId }] }).lean();
    const teamName = teamDoc?.name || req.team?.name || '';
    const { playerId } = req.params;

    let removed = false;

    // 1. Remove or deactivate in Player collection
    const isObjectId = mongoose.isValidObjectId && mongoose.isValidObjectId(playerId);
    const playerQuery = {
      $or: [
        { id: playerId },
        ...(isObjectId ? [{ _id: playerId }] : [])
      ]
    };
    const playerDoc = await Player.findOne(playerQuery);
    if (playerDoc) {
      await Player.deleteOne({ _id: playerDoc._id });
      removed = true;
    }

    // 2. Remove from TeamRegistration
    let teamReg = await TeamRegistration.findOne({
      $or: [
        ...(teamEmail ? [{ coach_email: teamEmail }, { coachEmail: teamEmail }] : []),
        ...(teamId ? [{ id: teamId }, { team_id: teamId }] : []),
        ...(teamName ? [{ team_name: new RegExp(`^${teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }] : [])
      ]
    });

    if (teamReg && Array.isArray(teamReg.players)) {
      const initLen = teamReg.players.length;
      teamReg.players = teamReg.players.filter(p => p.id !== playerId && String(p._id) !== playerId);
      if (teamReg.players.length !== initLen) {
        teamReg.squad_count = teamReg.players.length;
        await teamReg.save();
        removed = true;
      }
    }

    if (removed) {
      return res.json({ success: true, message: 'Player removed successfully from squad.' });
    }

    return res.status(404).json({ success: false, error: 'Player not found in team squad.' });
  } catch (err) {
    console.error('DELETE /team/players/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
