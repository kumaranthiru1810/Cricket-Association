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
      stats: team?.stats || { matches: 5, won: 4, lost: 1, tied: 0, points: 8, nrr: 1.25 }
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
    const players = await db.models.Player.find({ team_id: teamId }).lean();
    const squad = players.map((p, idx) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      role: p.role,
      jerseyNumber: p.jersey_number || (idx + 1),
      battingStyle: p.batting_style || 'Right Hand Bat',
      bowlingStyle: p.bowling_style || 'Right Arm Medium',
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

      return {
        id: m.id,
        tournament: m.tournament_name || tourMap[m.tournament_id]?.name || 'Virudhunagar Premier League 2026',
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
        currentBreak: m.current_break || null,
        statusComment: m.status_comment || null,
        result: m.result_summary || (isLive ? (statusUpper === 'INNINGS_BREAK' ? 'Innings Break' : (m.current_break ? `☕ ${m.current_break.title || 'Break'}` : 'Match in Progress')) : (isCompleted ? 'Match Completed' : 'Scheduled Match')),
        isLive,
        isCompleted
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
    const teamId = req.team?.id || req.user?.teamId || 'TM-01';
    const team = await db.models.Team.findOne({ id: teamId }).lean();
    res.json({
      success: true,
      statistics: team?.stats || { matches: 5, won: 4, lost: 1, tied: 0, points: 8, nrr: 1.25 }
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
 * Official bulletins, penalty alerts & communications for team dashboard
 */
router.get('/notifications', async (req, res) => {
  try {
    const db = require('../config/db');
    await db.initDb();
    const notifications = await db.models.Notification.find({}).sort({ created_at: -1 }).limit(40).lean();
    res.json({
      success: true,
      notifications: notifications.map(n => ({
        id: n.id,
        _id: n._id,
        type: n.type || 'SYSTEM',
        title: n.title,
        message: n.message,
        reference_id: n.reference_id,
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

module.exports = router;
