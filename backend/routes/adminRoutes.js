/**
 * routes/adminRoutes.js
 * Comprehensive Administrative & Association Management APIs
 */

const express = require('express');
const router = express.Router();
const adminService = require('../services/adminService');
const authService = require('../services/authService');
const tournamentController = require('../controllers/tournamentController');
const adminDashboardController = require('../controllers/adminDashboardController');
const { requireAdminAuth } = require('../middleware/authMiddleware');

// Enforce ADMIN role across all administrative management routes
router.use(requireAdminAuth);

/**
 * GET /api/admin/overview
 * Dashboard metrics summary
 */
router.get('/overview', async (req, res) => {
  try {
    const overview = await adminService.getAdminOverview();
    res.json({ success: true, data: overview });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/admin/users
 * Manage players, team officials, scorers, content staff, admins
 */
router.get('/users', async (req, res) => {
  try {
    const { role } = req.query;
    const users = await adminService.getUsers(role);
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/admin/users/:id/status
 * Activate or suspend user
 */
router.patch('/users/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const adminEmail = req.adminUser?.email || 'admin@cfvd.org';
    const user = await adminService.updateUserStatus(req.params.id, status, adminEmail);
    res.json({ success: true, message: `User status set to ${status}`, user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/admin/officials & POST /api/admin/officials
 * Officials Management (scorers, umpires, match officials)
 */
router.get('/officials', async (req, res) => {
  try {
    const officials = await adminService.getOfficials();
    res.json({ success: true, officials });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/officials', async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'admin@cfvd.org';
    const official = await adminService.saveOfficial(req.body, adminEmail);
    res.json({ success: true, message: 'Official saved successfully', official });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete('/officials/:id', async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'admin@cfvd.org';
    const result = await adminService.deleteOfficial(req.params.id, adminEmail);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/admin/venues & POST /api/admin/venues
 * Venue & Ground Management
 */
router.get('/venues', async (req, res) => {
  try {
    const venues = await adminService.getVenues();
    res.json({ success: true, venues });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/venues', async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'admin@cfvd.org';
    const venue = await adminService.saveVenue(req.body, adminEmail);
    res.json({ success: true, message: 'Venue saved successfully', venue });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete('/venues/:id', async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'admin@cfvd.org';
    const result = await adminService.deleteVenue(req.params.id, adminEmail);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/admin/teams/pending
 * View pending teams awaiting approval with all 15 players
 */
router.get('/teams/pending', async (req, res) => {
  try {
    const teamRegistrationModel = require('../models/teamRegistrationModel');
    const pendingTeams = await teamRegistrationModel.getAll('PENDING');
    res.json({ success: true, count: pendingTeams.length, teams: pendingTeams });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/admin/teams & POST /api/admin/teams
 */
router.get('/teams', async (req, res) => {
  try {
    const status = req.query.status || null;
    const teamRegistrationModel = require('../models/teamRegistrationModel');
    const teams = await teamRegistrationModel.getAll(status);
    res.json({ success: true, count: teams.length, teams });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/admin/teams/:id
 * View team details, coach, and all 15 players
 */
router.get('/teams/:id', async (req, res) => {
  try {
    const teamRegistrationModel = require('../models/teamRegistrationModel');
    const team = await teamRegistrationModel.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ success: false, message: `Team '${req.params.id}' not found.` });
    }
    res.json({ success: true, team });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/admin/teams/:id/approve & POST /api/admin/teams/:id/approve
 */
const handleApproveTeam = async (req, res) => {
  try {
    const adminId = req.adminUser?.email || 'ADMIN';
    const result = await authService.approveRegistration(req.params.id, 'TEAM', adminId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
router.put('/teams/:id/approve', handleApproveTeam);
router.post('/teams/:id/approve', handleApproveTeam);

/**
 * PUT /api/admin/teams/:id/reject & POST /api/admin/teams/:id/reject
 */
const handleRejectTeam = async (req, res) => {
  try {
    const adminId = req.adminUser?.email || 'ADMIN';
    const reason = req.body.reason || 'Criteria not met';
    const result = await authService.rejectRegistration(req.params.id, 'TEAM', reason, adminId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
router.put('/teams/:id/reject', handleRejectTeam);
router.post('/teams/:id/reject', handleRejectTeam);

router.post('/teams', async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'admin@cfvd.org';
    const team = await adminService.saveTeam(req.body, adminEmail);
    res.json({ success: true, message: 'Team saved successfully', team });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Tournament Management APIs under /api/admin/tournaments
 */
router.get('/tournaments', (req, res) => tournamentController.getTournaments(req, res));
router.get('/tournaments/:id', (req, res) => tournamentController.getTournamentById(req, res));
router.post('/tournaments', (req, res) => tournamentController.createTournament(req, res));
router.put('/tournaments/:id', (req, res) => tournamentController.updateTournament(req, res));
router.delete('/tournaments/:id', (req, res) => tournamentController.deleteTournament(req, res));
router.post('/tournaments/:id/teams', (req, res) => tournamentController.addTeams(req, res));
router.delete('/tournaments/:id/teams/:teamId', (req, res) => tournamentController.removeTeam(req, res));
router.post('/tournaments/:id/generate-matches', (req, res) => tournamentController.generateMatches(req, res));
router.get('/tournaments/:id/schedule', (req, res) => tournamentController.getSchedule(req, res));
router.get('/tournaments/:id/points-table', (req, res) => tournamentController.getPointsTable(req, res));
router.get('/tournaments/:id/statistics', (req, res) => tournamentController.getStatistics(req, res));
router.get('/tournaments/registrations/all', (req, res) => tournamentController.getAllRegistrations(req, res));
router.patch('/tournaments/registrations/:regId/approve', (req, res) => tournamentController.approveRegistration(req, res));
router.post('/tournaments/registrations/:regId/approve', (req, res) => tournamentController.approveRegistration(req, res));
router.patch('/tournaments/registrations/:regId/reject', (req, res) => tournamentController.rejectRegistration(req, res));
router.post('/tournaments/registrations/:regId/reject', (req, res) => tournamentController.rejectRegistration(req, res));
router.get('/tournaments/:id/registrations', (req, res) => tournamentController.getAllRegistrations(req, res));
router.get('/tournaments/:id/approved-teams', (req, res) => tournamentController.getApprovedTeams(req, res));
router.patch('/tournaments/:id/status', (req, res) => tournamentController.updateStatus(req, res));

/**
 * Match Schedule Management APIs
 * GET /api/admin/matches - List all matches
 * POST /api/admin/matches/schedule - Create match schedule
 * PUT /api/admin/matches/:id - Update or reschedule match
 * PATCH /api/admin/matches/:id/cancel - Cancel match
 * DELETE /api/admin/matches/:id - Delete match
 */
router.get('/matches', async (req, res) => {
  try {
    const matches = await adminService.getMatches();
    res.json({ success: true, matches });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/matches/schedule', async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'admin@cfvd.org';
    const match = await adminService.scheduleMatch(req.body, adminEmail);
    res.json({ success: true, message: 'Match scheduled successfully', match });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/matches/:id', async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'admin@cfvd.org';
    const match = await adminService.updateMatch(req.params.id, req.body, adminEmail);
    res.json({ success: true, message: 'Match updated successfully', match });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

const handleCancelMatch = async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'admin@cfvd.org';
    const reason = req.body?.reason || req.query?.reason;
    const match = await adminService.cancelMatch(req.params.id, reason, adminEmail);
    res.json({ success: true, message: 'Match cancelled successfully', match });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};
router.patch('/matches/:id/cancel', handleCancelMatch);
router.post('/matches/:id/cancel', handleCancelMatch);

router.delete('/matches/:id', async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'admin@cfvd.org';
    const result = await adminService.deleteMatch(req.params.id, adminEmail);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/admin/audit-logs
 */
router.get('/audit-logs', async (req, res) => {
  try {
    const logs = await adminService.getAuditLogs();
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Two-Person Admin Approval
 */
router.get('/admins', async (req, res) => {
  try {
    const admins = await adminService.getAdmins();
    res.json({ success: true, admins });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/admins/add/request', async (req, res) => {
  try {
    const { name, email, phone, username } = req.body;
    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'Full Name, Email, and Phone are required.' });
    }
    const result = await adminService.initiateAddAdminRequest({
      initiatorEmail: req.adminUser.email,
      name,
      email,
      phone,
      username,
      ip_address: req.ip || '127.0.0.1'
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/admins/add/verify-current', async (req, res) => {
  try {
    const { requestId, otp } = req.body;
    const result = await adminService.verifyAddCurrentAdminOtp({
      requestId,
      otp,
      currentAdminEmail: req.adminUser.email
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/admins/add/verify-target', async (req, res) => {
  try {
    const { requestId, otp, newAdminEmail } = req.body;
    const result = await adminService.verifyAddTargetAdminOtp({
      requestId,
      otp,
      newAdminEmail
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * --------------------------------------------------------------------------
 * Content, News & Notices Management (Admin Only)
 * --------------------------------------------------------------------------
 */

// GET /api/admin/content - List all news & notices
router.get('/content', async (req, res) => {
  try {
    const { category, status, search, limit } = req.query;
    const articles = await adminService.getContentList({ category, status, search, limit });
    res.json({ success: true, count: articles.length, data: articles });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/content/stats - Content counts by category & status
router.get('/content/stats', async (req, res) => {
  try {
    const stats = await adminService.getContentStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/content - Create news/notice
router.post('/content', async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'admin@cfvd.org';
    const article = await adminService.createContent(req.body, adminEmail);
    res.status(201).json({ success: true, message: 'Article published successfully', data: article });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/admin/content/:id - Edit news/notice
router.put('/content/:id', async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'admin@cfvd.org';
    const updated = await adminService.updateContent(req.params.id, req.body, adminEmail);
    res.json({ success: true, message: 'Article updated successfully', data: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/admin/content/:id - Delete news/notice
router.delete('/content/:id', async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'admin@cfvd.org';
    const result = await adminService.deleteContent(req.params.id, adminEmail);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * --------------------------------------------------------------------------
 * Admin Panel Dedicated Endpoints (powering mobile_frontend/src/admin)
 * --------------------------------------------------------------------------
 */
router.get('/dashboard-stats', (req, res) => adminDashboardController.getDashboardStats(req, res));
router.put('/users/:id', (req, res) => adminDashboardController.updateUser(req, res));
router.delete('/users/:id', (req, res) => adminDashboardController.deleteUser(req, res));

router.get('/approvals', (req, res) => adminDashboardController.getApprovals(req, res));
router.post('/approvals/:type/:id', (req, res) => adminDashboardController.handleApproval(req, res));

router.get('/notifications', (req, res) => adminDashboardController.getNotifications(req, res));
router.post('/notifications', (req, res) => adminDashboardController.createNotification(req, res));
router.patch('/notifications/:id/read', (req, res) => adminDashboardController.markNotificationRead(req, res));
router.delete('/notifications/:id', (req, res) => adminDashboardController.deleteNotification(req, res));

router.get('/teams-list', (req, res) => adminDashboardController.getTeams(req, res));
router.get('/teams-list/:id', (req, res) => adminDashboardController.getTeamById(req, res));
router.patch('/teams-list/:id/status', (req, res) => adminDashboardController.updateTeamStatus(req, res));

router.get('/players', (req, res) => adminDashboardController.getPlayers(req, res));
router.post('/players', (req, res) => adminDashboardController.createPlayer(req, res));
router.put('/players/:id', (req, res) => adminDashboardController.updatePlayer(req, res));

router.get('/live-scoring', (req, res) => adminDashboardController.getLiveScoring(req, res));
router.get('/statistics', (req, res) => adminDashboardController.getStatistics(req, res));
router.get('/settings', (req, res) => adminDashboardController.getSettings(req, res));
router.put('/settings', (req, res) => adminDashboardController.updateSettings(req, res));

module.exports = router;
