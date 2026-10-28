/**
 * routes/tournamentRoutes.js
 * Comprehensive Tournament & Championship Management Routes.
 */

const express = require('express');
const router = express.Router();
const tournamentController = require('../controllers/tournamentController');
const { requireAdminAuth, requireTeamAuth } = require('../middleware/authMiddleware');

// ── Coach / Team Protected Registration Endpoints ──────────────────────
// NOTE: Specific non-parameterized routes are declared first to prevent collision with /:id

// GET /api/tournaments/my-registrations - Get registrations submitted by current team/coach
router.get('/my-registrations', requireTeamAuth, (req, res) => tournamentController.getMyRegistrations(req, res));
router.get('/registrations/my-team', requireTeamAuth, (req, res) => tournamentController.getMyRegistrations(req, res));

// ── Admin Protected Registration & Management Endpoints ─────────────────

// GET /api/tournaments/registrations/all - View all registrations across all tournaments
router.get('/registrations/all', requireAdminAuth, (req, res) => tournamentController.getAllRegistrations(req, res));

// PATCH/POST /api/tournaments/registrations/:regId/approve - Approve team registration
router.patch('/registrations/:regId/approve', requireAdminAuth, (req, res) => tournamentController.approveRegistration(req, res));
router.post('/registrations/:regId/approve', requireAdminAuth, (req, res) => tournamentController.approveRegistration(req, res));

// PATCH/POST /api/tournaments/registrations/:regId/reject - Reject team registration
router.patch('/registrations/:regId/reject', requireAdminAuth, (req, res) => tournamentController.rejectRegistration(req, res));
router.post('/registrations/:regId/reject', requireAdminAuth, (req, res) => tournamentController.rejectRegistration(req, res));

// ── Public / Read Endpoints ──────────────────────────────────────────────

// GET /api/tournaments - List tournaments with optional filtering
router.get('/', (req, res) => tournamentController.getTournaments(req, res));

// GET /api/tournaments/:id - Single tournament details
router.get('/:id', (req, res) => tournamentController.getTournamentById(req, res));

// GET /api/tournaments/:id/schedule - Match fixtures & schedule
router.get('/:id/schedule', (req, res) => tournamentController.getSchedule(req, res));

// GET /api/tournaments/:id/points-table - Live calculated points table
router.get('/:id/points-table', (req, res) => tournamentController.getPointsTable(req, res));

// GET /api/tournaments/:id/statistics - Top batters, bowlers, totals
router.get('/:id/statistics', (req, res) => tournamentController.getStatistics(req, res));

// GET /api/tournaments/:id/approved-teams - Get officially approved teams
router.get('/:id/approved-teams', (req, res) => tournamentController.getApprovedTeams(req, res));

// GET /api/tournaments/:id/registrations - View registrations for a specific tournament (Admin)
router.get('/:id/registrations', requireAdminAuth, (req, res) => tournamentController.getAllRegistrations(req, res));

// ── Team Action Endpoints ────────────────────────────────────────────────

// POST /api/tournaments/:id/register - Submit registration for tournament
router.post('/:id/register', requireTeamAuth, (req, res) => tournamentController.registerTeam(req, res));
router.post('/register', requireTeamAuth, (req, res) => tournamentController.registerTeam(req, res));

// ── Admin Protected Endpoints ────────────────────────────────────────────

// POST /api/tournaments - Create a new tournament
router.post('/', requireAdminAuth, (req, res) => tournamentController.createTournament(req, res));

// PUT /api/tournaments/:id - Update tournament details
router.put('/:id', requireAdminAuth, (req, res) => tournamentController.updateTournament(req, res));

// DELETE /api/tournaments/:id - Delete or deactivate tournament
router.delete('/:id', requireAdminAuth, (req, res) => tournamentController.deleteTournament(req, res));

// POST /api/tournaments/:id/teams - Add participating teams
router.post('/:id/teams', requireAdminAuth, (req, res) => tournamentController.addTeams(req, res));

// DELETE /api/tournaments/:id/teams/:teamId - Remove team
router.delete('/:id/teams/:teamId', requireAdminAuth, (req, res) => tournamentController.removeTeam(req, res));

// POST /api/tournaments/:id/generate-matches - Automatically generate fixtures
router.post('/:id/generate-matches', requireAdminAuth, (req, res) => tournamentController.generateMatches(req, res));

// PATCH /api/tournaments/:id/status - Update tournament status
router.patch('/:id/status', requireAdminAuth, (req, res) => tournamentController.updateStatus(req, res));

module.exports = router;
