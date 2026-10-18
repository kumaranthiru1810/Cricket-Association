/**
 * routes/umpireRoutes.js
 * Comprehensive REST API Routes for Umpire Module
 */

const express = require('express');
const router = express.Router();

const umpireController = require('../controllers/umpireController');
const { requireUmpireAuth, verifyUmpireMatchPermission } = require('../middleware/authMiddleware');

// All umpire routes are protected by requireUmpireAuth (Role = UMPIRE or ADMIN)
router.use(requireUmpireAuth);

// 1. Umpire Profile APIs
router.get('/profile', (req, res) => umpireController.getProfile(req, res));
router.put('/profile', (req, res) => umpireController.updateProfile(req, res));

// 2. Assigned Matches APIs
router.get('/matches', (req, res) => umpireController.getAssignedMatches(req, res));

// 3. Match Details API
router.get('/matches/:matchId', verifyUmpireMatchPermission, (req, res) => umpireController.getMatchDetails(req, res));

// 4. Start Match API
router.put('/matches/:matchId/start', verifyUmpireMatchPermission, (req, res) => umpireController.startMatch(req, res));
router.post('/matches/:matchId/start', verifyUmpireMatchPermission, (req, res) => umpireController.startMatch(req, res)); // alias

// 5. Update Match Status API
router.put('/matches/:matchId/status', verifyUmpireMatchPermission, (req, res) => umpireController.updateMatchStatus(req, res));

// 6. Record Umpire Decision API
router.post('/matches/:matchId/decisions', verifyUmpireMatchPermission, (req, res) => umpireController.recordDecision(req, res));
router.get('/matches/:matchId/decisions', verifyUmpireMatchPermission, (req, res) => umpireController.getDecisions(req, res));

// 7. Confirm Match Result API
router.put('/matches/:matchId/result', verifyUmpireMatchPermission, (req, res) => umpireController.confirmResult(req, res));

module.exports = router;
